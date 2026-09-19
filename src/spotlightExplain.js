// One evidence set, two reading depths. These helpers format reported data; they do not
// estimate earnings, infer a fair price, or turn a multiple into an investment call.
import { spotlightFace } from "./simpleFace.js";
import { earningsEvidence, PS_REASON } from "./spotlightMultiple.js";

export const SPOTLIGHT_WORD_MAX = Object.freeze({ simple: 90, degen: 110 });
const BUSINESS = Object.freeze({
  NBIS: "Nebius rents AI computing capacity.",
  MSFT: "Microsoft sells software and cloud services.",
  AAPL: "Apple sells devices and digital services.",
  AMZN: "Amazon runs retail, advertising, and cloud businesses.",
  GOOGL: "Alphabet sells advertising and cloud services.",
  META: "Meta sells advertising across its social apps.",
  NVDA: "Nvidia designs chips and computing systems.",
  TSLA: "Tesla sells electric vehicles and energy products.",
});
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const dated = (v) => typeof v === "string" && /\d{4}-\d{2}-\d{2}/.test(v);
const dollars = (v) => {
  if (!finite(v)) return "unavailable";
  const a = Math.abs(v), sign = v < 0 ? "−" : "";
  const [scale, unit] = a >= 1e12 ? [1e12, "trillion"] : a >= 1e9 ? [1e9, "billion"] : a >= 1e6 ? [1e6, "million"] : [1, ""];
  return `${sign}$${(a / scale).toFixed(scale === 1 ? 0 : 2)}${unit ? ` ${unit}` : ""}`;
};
const capReady = (c) => finite(c?.marketCap?.usd) && c.marketCap.usd > 0 && dated(c.marketCap.observedAt) && !c.marketCap.unavailable;
const sourcesFor = (c, labels) => (c.sources || []).filter((s) => labels.includes(s.label) && /^https?:\/\//.test(s.url || ""));
const capDate = (c) => c.marketCap?.observedAt
  ? `Market capitalization as of ${c.marketCap.observedAt}${c.marketCap.method === "derived" ? " (derived)" : ""}${c.freshness?.market?.stale ? " · STALE" : ""}.` : null;

/* v7.1: earningsEvidence MOVED to src/spotlightMultiple.js — it is the applicable-multiple
   rule's own input, and that module must be a LEAF (simpleFace.js reads it too) or the import
   graph cycles. Re-exported here so every existing caller and pin resolves unchanged; the
   function itself is byte-identical, including the missing-period rule it exists to enforce. */
export { earningsEvidence } from "./spotlightMultiple.js";

export function peDisplay(c) {
  const e = earningsEvidence(c), v = c?.metrics?.valuation || {};
  if (e.state === "missing") return { value: null, unavailable: e.reason };
  if (e.state === "loss" || e.state === "zero") return { value: "Not meaningful", sub: `${e.state === "loss" ? "net loss" : "zero net earnings"} · ${e.period}` };
  if (!capReady(c) || !finite(v.trailingPe)) return { value: null, unavailable: "dated market capitalization or earnings multiple unavailable" };
  return { value: `${v.trailingPe.toFixed(1)}×`, sub: `net earnings ${dollars(e.value)} · ${e.period}` };
}

export function spotlightExplain(c, leg) {
  if (!c) return null;
  const face = spotlightFace(c, leg), m = c.metrics || {}, v = m.valuation || {}, e = earningsEvidence(c);
  const metric = face.stat.label === "Operating margin" ? m.operatingMargin : face.stat.label === "Free cash flow" ? m.fcf : m.revenueGrowth;
  const meaning = face.stat.label === "Operating margin"
    ? "Operating margin measures operating profit per sales dollar, before interest and taxes."
    : face.stat.label === "Free cash flow" ? "Free cash flow is operating cash after spending on long-lived assets."
      : "Revenue growth measures sales growth, not profit growth.";
  const operatingLoss = finite(m.operatingMargin?.pct) && m.operatingMargin.pct < 0 && dated(m.operatingMargin.period) && !m.operatingMargin.unavailable;
  const earnings = e.state === "missing" ? `Profitability unavailable: ${e.reason}. Price-to-earnings (P/E) cannot be assessed.`
    : e.state === "loss" ? "Reported a net loss over the past year. The price-to-earnings (P/E) ratio is not meaningful; valuing future profits requires more assumptions."
      : e.state === "zero" ? "Reported zero net earnings over the past year. The price-to-earnings (P/E) ratio is not meaningful; future profits remain uncertain."
        : capReady(c) && finite(v.trailingPe)
          ? `Investors pay $${v.trailingPe.toFixed(1)} per $1 earned over the past year. This price-to-earnings (P/E) ratio does not predict future profits.`
          : "Reported a net profit over the past year. Price-to-earnings (P/E) is unavailable without dated market capitalization and a usable earnings multiple.";
  return {
    full: c.name,
    what: [
      `${BUSINESS[c.symbol] || "Business description unavailable."} ${meaning} Return this year measures gains or losses since last year’s final close, including reinvested dividends.`,
      `${capReady(c) ? `Market capitalization: ${dollars(c.marketCap.usd)}.` : "Dated market capitalization unavailable."} Share price × total shares outstanding = market capitalization: the value of all shares. A lower share price does not necessarily mean a cheaper company.`,
      earnings + (e.state === "profit" && operatingLoss ? " Latest reported operations still lost money." : ""),
    ],
    metadata: [capDate(c), leg?.through ? `Return through ${leg.through}${c.freshness?.series?.stale ? " · STALE" : ""}.` : null,
      metric?.period ? `${face.stat.label}: ${metric.period}.` : null,
      e.period ? `Net earnings: ${e.period.replace(/^TTM to /, "12 months to ")}.` : null,
      e.state === "profit" && operatingLoss && metric !== m.operatingMargin ? `Operating margin: ${m.operatingMargin.period}.` : null].filter(Boolean).join(" "),
    sources: sourcesFor(c, ["market cap", ...(face.stat.label === "Free cash flow" ? ["operating cash flow", "capital expenditure"] : face.stat.label === "Operating margin" ? ["revenue", "operating income"] : ["revenue"]), "net earnings", ...(e.state === "profit" && operatingLoss ? ["operating income"] : [])]),
  };
}

export function valuationExplain(c, kind) {
  if (!c) return null;
  const v = c.metrics?.valuation || {}, e = earningsEvidence(c), pe = peDisplay(c);
  const cap = capReady(c) ? dollars(c.marketCap.usd) : "unavailable";
  const revenueReady = finite(v.ttmRevenue) && v.ttmRevenue > 0 && dated(v.ttmRevenuePeriod);
  let title, what, inputs, labels;
  if (kind === "cap") {
    title = "Market capitalization";
    what = [
      `Market capitalization = share price × total shares outstanding. Reported equity market value: ${cap}.`,
      "Hypothetical: $10 × 1 billion shares and $100 × 100 million shares both equal $10 billion. Share price alone cannot compare company values.",
      "This values equity, not the whole business including debt. Outstanding shares differ from the weighted-average diluted shares used for earnings per share.",
    ];
    inputs = [capDate(c)]; labels = ["market cap", "shares outstanding"];
  } else if (kind === "pe") {
    title = "Trailing price-to-earnings ratio";
    what = [
      `This dashboard calculates trailing P/E as market capitalization ÷ reported net earnings for the last twelve months. ${pe.value ? `Result: ${pe.value}.` : `Unavailable: ${pe.unavailable}.`}`,
      e.state === "profit" ? "A positive multiple measures dollars paid per dollar of historical net profit. It uses reported earnings, not forecasts or adjusted earnings."
        : e.state === "missing" ? "Missing earnings evidence is not a loss. An earnings amount and its own reporting period are required."
          : e.state === "loss" ? "Net earnings were negative. P/E is not meaningful; a negative number would not indicate a cheap stock."
            : "Net earnings were zero. Dividing by zero cannot produce a meaningful P/E ratio.",
      "One-off gains can boost net earnings despite operating losses. Check operating results and cash flow separately; this multiple is not an entry signal.",
    ];
    inputs = [capDate(c), e.period ? `Net earnings: ${dollars(e.value)} · ${e.period}.` : null]; labels = ["market cap", "net earnings"];
  } else if (kind === "revenue" || kind === "ps") {
    /* v7.1 — THE MULTIPLE IS NAMED. This sheet has described price-to-sales since v6.6.3 under
       a title that never said so, which made the one multiple that applies to an unprofitable
       company the one a reader could not look up. "ps" is accepted as an alias of "revenue" so
       no existing caller changes, and the title now carries both the name and the arithmetic —
       renaming it away would lose the equity-value-to-sales precision bullet 1 states. */
    title = "P/S — price-to-sales (market value ÷ revenue)";
    const multiple = capReady(c) && revenueReady && finite(v.capToTtmRevenue) ? `${v.capToTtmRevenue.toFixed(1)}×` : "unavailable";
    what = [
      `Market capitalization ÷ reported revenue for the last twelve months = ${multiple}. This is an equity-value-to-sales multiple, not enterprise value divided by sales.`,
      `${e.state === "loss" || e.state === "zero" ? PS_REASON + " " : ""}It measures dollars paid per dollar of sales, not profitability. Revenue is not profit.`,
      "A lower multiple does not establish cheapness. Compare margins, spending needs, debt, and share dilution; growth alone does not establish future profitability.",
    ];
    inputs = [capDate(c), revenueReady ? `Revenue: ${dollars(v.ttmRevenue)} · ${v.ttmRevenuePeriod}.` : null]; labels = ["market cap", "revenue"];
  } else return null;
  return { full: title, eyebrow: `${c.name} · ${c.symbol}`, what, metadata: inputs.filter(Boolean).join(" "), sources: sourcesFor(c, labels) };
}
