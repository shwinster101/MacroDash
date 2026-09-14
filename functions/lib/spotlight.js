// ─── STOCK SPOTLIGHT — the pure core (v6.5.0, docs/plans/stock-spotlight.md) ──────────
// ONE educational widget answering "what do this business's latest results and its stock's
// current price tell me?" for NBIS beside one rotating Mag Seven comparison. This module is
// PURE and Node-importable: no network, no KV, no React. Provider adapters live in
// functions/api/stock-spotlight/refresh.js (the tt-facts convention); the public GET in
// functions/api/stock-spotlight.js serves a stored model through projectSpotlight().
//
// Doctrine carried in from the rest of the repo, each one load-bearing here:
//   · Missing data reads "Unavailable" WITH a reason — never zero, never an invented value,
//     never a substitute dressed as the original (the v3.1 invariant, the tt-facts rule).
//   · Every number states its basis and its date: quarterly vs TTM vs run-rate, the
//     observation date of a cap, the through-date of a return (label-outlives-data class).
//   · Assessments are DETERMINISTIC templates over measured changes. No buy/sell rating, no
//     score, no "cheap"/"safe"/"quality" word (the plan's explicit prohibition).
//   · The YTD figure and the chart share ONE series and ONE endpoint (the ptModelRows rule:
//     one computation, two altitudes) so the number can never disagree with the line.
//   · Freshness is RECOMPUTED at serve time from observation dates — a stored LIVE flag is
//     not trusted (freshenSpotlight).
//   · The projection is a WHITELIST (the readout.json / picks.js pattern). Nothing from the
//     Terminal's book, positions, scores, targets or credentials can enter this model, and
//     smoke sweeps the module for `tt:` key references to keep it that way.

import { sma } from "./tt-technicals.js";
import { sessionsBehind, etYmd, isSessionDay } from "../../src/sources.js";

export const SPOTLIGHT_SCHEMA = "md-spotlight-v1";
export const SPOTLIGHT_ISSUER_SCHEMA = "md-spotlight-issuer-v1";
export const SPOTLIGHT_ANCHOR = "NBIS";
/* The weekly rotation, in the order the plan fixes: Microsoft first. All visitors see the
   same pair because the pair is chosen server-side from ONE stored rotation record. */
export const SPOTLIGHT_ROTATION = Object.freeze(["MSFT", "AAPL", "AMZN", "GOOGL", "META", "NVDA", "TSLA"]);
export const SPOTLIGHT_COMPARISON_LABEL = "Established growth";
export const COMPANY_NAMES = Object.freeze({
  NBIS: "Nebius Group", MSFT: "Microsoft", AAPL: "Apple", AMZN: "Amazon", GOOGL: "Alphabet",
  META: "Meta Platforms", NVDA: "NVIDIA", TSLA: "Tesla",
});
/* One authored line per company on what the business does — the plan's "planned one-line
   explanation". Descriptive only; no judgment words. */
export const COMPANY_BLURBS = Object.freeze({
  NBIS: "Builds and rents out AI computing capacity — data centers full of GPUs that other companies pay to use.",
  MSFT: "Sells software and cloud computing to businesses (Windows, Office, Azure) plus gaming and LinkedIn.",
  AAPL: "Designs and sells the iPhone, Mac and other devices, plus the services that run on them.",
  AMZN: "Runs the largest online store and the largest cloud-computing business (AWS), plus advertising.",
  GOOGL: "Runs Google Search, YouTube and Android, earning mostly from advertising, plus Google Cloud.",
  META: "Runs Facebook, Instagram and WhatsApp, earning almost entirely from advertising.",
  NVDA: "Designs the chips (GPUs) that power AI data centers and gaming PCs.",
  TSLA: "Makes electric vehicles and energy storage, and is building driver-assistance software.",
});
export const SPOTLIGHT_KEYS = Object.freeze({
  model: "spotlight:model:v1",
  rotation: "spotlight:rotation:v1",
  diag: "spotlight:diag:v1",
  facts: (sym) => `spotlight:facts:v1:${sym}`,
  issuer: (sym) => `spotlight:issuer:v1:${sym}`,
  cik: "spotlight:sec:cik:",
});
/* SEC forms the extractor accepts. The Terminal's extractor was limited to 10-Q/10-K; Nebius
   is a foreign private issuer (20-F annual, 6-K interim), and the plan's inspection named
   that gap explicitly. 40-F covers Canadian issuers on the same footing. */
export const SPOTLIGHT_FORMS = /^(?:10-Q|10-K|20-F|6-K|40-F)(?:\/A)?$/;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, p = 2) => finite(v) ? Math.round((v + Number.EPSILON) * 10 ** p) / 10 ** p : null;
const dayMs = 86400000;
const daysBetween = (a, b) => (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / dayMs;
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const unavailable = (reason) => ({ value: null, unavailable: reason });

// ─── money / percent display ───────────────────────────────────────────────────────
export function fmtCap(usd) {
  if (!finite(usd) || usd <= 0) return null;
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  return `$${(usd / 1e6).toFixed(0)}M`;
}
export function fmtMoney(usd) {
  if (!finite(usd)) return null;
  const sign = usd < 0 ? "−" : "";
  const a = Math.abs(usd);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(0)}M`;
  return `${sign}$${a.toFixed(0)}`;
}
export const fmtPct = (v, d = 1) => finite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%` : null;

// ─── the weekly rotation ───────────────────────────────────────────────────────────
/* The ET calendar week is keyed by its MONDAY. "Advance the pair on the first successful
   refresh of each new ET calendar week": the stored record carries the week key of the last
   successful refresh; a refresh in a later week advances the index. A FAILED refresh must not
   advance (the caller persists only after a successful build), so a Tuesday retry after a
   Monday failure still moves the pair exactly once. */
export function etWeekKey(ymd) {
  if (!isYmd(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;   // Monday = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
export function nextRotation(stored, weekKey) {
  const n = SPOTLIGHT_ROTATION.length;
  const idx = stored && Number.isInteger(stored.index) ? ((stored.index % n) + n) % n : null;
  if (idx === null || !stored.weekKey) return { index: 0, weekKey, advanced: false, first: true };
  if (stored.weekKey === weekKey) return { index: idx, weekKey, advanced: false, first: false };
  return { index: (idx + 1) % n, weekKey, advanced: true, first: false };
}
export const comparisonAt = (index) => SPOTLIGHT_ROTATION[((index % SPOTLIGHT_ROTATION.length) + SPOTLIGHT_ROTATION.length) % SPOTLIGHT_ROTATION.length];

// ─── YTD total return + the comparison tracker ─────────────────────────────────────
/* The FINAL trading session of the calendar year before `year` — the one baseline date both
   stocks must share (walks back from Dec 31 over weekends and market holidays). */
export function yearEndSession(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) return null;
  let d = `${y - 1}-12-31`;
  for (let i = 0; i < 10 && !isSessionDay(d); i++) d = addDays(d, -1);
  return isSessionDay(d) ? d : null;
}

/* rows: ascending [{date, value}] of a provider series whose BASIS the caller declares.
   Baseline = the ACTUAL final trading close of the previous calendar year — the row dated
   exactly yearEndSession(year). A series whose last prior-year row is any other date (review
   #2: an August observation followed by January data read +100% "YTD" off August) is
   UNAVAILABLE with the missing date named; the baseline is never substituted. YTD % =
   100 × (value / baseline − 1). Before the first close of a new year the figure is explicitly
   "awaiting the first close", never 0. */
export function ytdReturn(rows, today) {
  const xs = (Array.isArray(rows) ? rows : []).filter((r) => r && isYmd(r.date) && finite(r.value) && r.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!isYmd(today)) return { unavailable: "no business date to anchor the year" };
  const year = today.slice(0, 4);
  const jan1 = `${year}-01-01`;
  const baseDate = yearEndSession(year);
  const baseline = xs.find((r) => r.date === baseDate);
  if (!baseline) {
    const lastPrior = xs.filter((r) => r.date < jan1).pop();
    return { unavailable: `series lacks the final ${Number(year) - 1} trading close (${baseDate})${lastPrior ? ` — last prior-year row is ${lastPrior.date}` : ""}; baseline not substituted` };
  }
  const cur = xs.filter((r) => r.date >= jan1 && r.date <= today);
  if (!cur.length) return { baseline: { date: baseline.date, value: baseline.value }, points: [],
    awaiting: true, unavailable: `YTD awaits the first ${year} trading close` };
  const points = cur.map((r) => ({ date: r.date, pct: round(100 * (r.value / baseline.value - 1), 2) }));
  return { baseline: { date: baseline.date, value: baseline.value }, points, through: points[points.length - 1].date,
    pct: points[points.length - 1].pct };
}

const BASIS_LABEL = { total_return: "YTD total return", price_return: "YTD price return" };
const BASIS_NOTE = {
  total_return: "includes dividends · adjusted for splits and distributions",
  price_return: "dividends NOT included",
};
export const TOTAL_RETURN_REQUIRED = "no verified total-return series — price return is not a substitute for total return, so the leg is withheld";

/* seriesX: { symbol, basis, provider, rows, currency, sourceUrl } or null. Both stocks plot
   as cumulative % from 0 at their own baseline (the same date for two US-listed names, and
   named if not). The endpoint is the LATEST COMMON valid date — and the visible YTD numbers
   are read AT that endpoint, from the same points the chart draws, so the figure and the line
   agree by construction. A missing observation is a null (a gap), never interpolated. */
export function buildTracker(seriesA, seriesB, today) {
  const leg = (s) => {
    if (!s || !Array.isArray(s.rows)) return { symbol: s?.symbol || null, basis: null, provider: s?.provider || null, pct: null, through: null, baseline: null, awaiting: false,
      unavailable: s?.unavailable || "return series unavailable", points: [] };
    if (s.currency && s.currency !== "USD") return { symbol: s.symbol, basis: s.basis, provider: s.provider,
      unavailable: `series quoted in ${s.currency}; not converted`, points: [] };
    /* Review #1: the comparison is total return against total return, or it is not drawn. A
       price-return series is never a substitute (the two are not equivalent, and the plan
       agreed on total return for both); the leg is WITHHELD with the reason named. */
    if (s.basis !== "total_return" || s.verified !== true) return { symbol: s.symbol, basis: s.basis || null, provider: s.provider || null, pct: null, through: null, baseline: null, awaiting: false,
      unavailable: TOTAL_RETURN_REQUIRED + (s.basis ? ` (on file: ${s.basis === "price_return" ? "price return" : "total return"}${s.verified !== true ? ", adjustment not verified" : ""})` : ""), points: [] };
    const y = ytdReturn(s.rows, today);
    return { symbol: s.symbol, basis: "total_return",
      provider: s.provider || null, sourceUrl: s.sourceUrl || null,
      baseline: y.baseline || null, points: y.points || [], through: y.through || null, pct: finite(y.pct) ? y.pct : null,
      awaiting: !!y.awaiting, unavailable: y.unavailable || null };
  };
  const a = leg(seriesA), b = leg(seriesB);
  for (const l of [a, b]) {
    l.label = l.basis ? BASIS_LABEL[l.basis] : "YTD return";
    l.basisNote = l.basis ? BASIS_NOTE[l.basis] : null;
  }
  const aOk = a.points.length > 0, bOk = b.points.length > 0;
  let through = null, points = [];
  if (aOk && bOk) {
    const bDates = new Set(b.points.map((p) => p.date));
    const common = a.points.map((p) => p.date).filter((d) => bDates.has(d));
    through = common.length ? common[common.length - 1] : null;
    if (through) {
      const am = new Map(a.points.map((p) => [p.date, p.pct])), bm = new Map(b.points.map((p) => [p.date, p.pct]));
      const dates = [...new Set([...am.keys(), ...bm.keys()])].filter((d) => d <= through).sort();
      points = dates.map((d) => ({ date: d, [a.symbol]: am.has(d) ? am.get(d) : null, [b.symbol]: bm.has(d) ? bm.get(d) : null }));
      a.pct = am.get(through); a.through = through;
      b.pct = bm.get(through); b.through = through;
    }
  } else if (aOk || bOk) {
    const l = aOk ? a : b;
    through = l.through;
    points = l.points.map((p) => ({ date: p.date, [l.symbol]: p.pct }));
  }
  const baselineDate = a.baseline?.date || b.baseline?.date || yearEndSession(String(today).slice(0, 4));
  // Both legs anchor on yearEndSession(year) by construction; a mismatch can no longer occur,
  // but the field stays in the contract (and is asserted null) so a regression is visible.
  const baselineMismatch = a.baseline && b.baseline && a.baseline.date !== b.baseline.date
    ? `baselines differ: ${a.symbol} ${a.baseline.date} · ${b.symbol} ${b.baseline.date}` : null;
  return {
    year: String(today).slice(0, 4),
    baselineDate, baselineMismatch, through, points,
    legs: { [a.symbol || "A"]: a, [b.symbol || "B"]: b },
    unavailable: !aOk && !bOk ? `comparison tracker unavailable — ${a.symbol || "anchor"}: ${a.unavailable}; ${b.symbol || "comparison"}: ${b.unavailable}` : null,
    partial: (aOk !== bOk) ? `${aOk ? b.symbol : a.symbol} series unavailable — ${aOk ? b.unavailable : a.unavailable}` : null,
    method: "total return only (split- and dividend-adjusted, verified): 100 × (adjusted value ÷ the final trading close of the previous calendar year − 1), both lines from 0% at that same date, endpoint = latest common valid trading date",
  };
}

// ─── market capitalization ────────────────────────────────────────────────────────
/* Prefer a DATED provider-reported cap. Derive only from a dated price × ACTUAL shares
   outstanding (kind "outstanding") — never the diluted weighted-average count used for EPS,
   which is an earnings denominator, not a share count. Never enterprise value. Units and
   currency are preserved and named; a non-USD quote is not converted. */
export function resolveMarketCap({ reported = null, price = null, shares = null } = {}) {
  const r = reported;
  if (r && finite(r.value) && r.value > 0 && isYmd(r.observedAt)) {
    const mult = r.unit === "USD M" ? 1e6 : r.unit === "USD B" ? 1e9 : 1;
    if (r.currency && r.currency !== "USD") return { ...unavailable(`provider cap is quoted in ${r.currency}; not converted`), observedAt: r.observedAt };
    const usd = r.value * mult;
    return { usd, display: fmtCap(usd), observedAt: r.observedAt, method: "provider-reported", provider: r.provider || null,
      currency: "USD", note: null, unavailable: null };
  }
  if (price && finite(price.value) && price.value > 0 && shares && finite(shares.value) && shares.value > 0) {
    if (shares.kind !== "outstanding")
      return { ...unavailable("only a diluted weighted-average share count is on file — an EPS denominator, not shares outstanding; no substitute made"), observedAt: null };
    if (price.currency && price.currency !== "USD") return { ...unavailable(`quote currency ${price.currency} is not USD; not converted`), observedAt: null };
    if (!isYmd(price.observedAt) || !isYmd(shares.observedAt)) return { ...unavailable("price or share count carries no observation date"), observedAt: null };
    const usd = price.value * shares.value;
    const gap = Math.abs(daysBetween(shares.observedAt, price.observedAt));
    return { usd, display: fmtCap(usd), observedAt: price.observedAt, method: "derived", provider: [price.provider, shares.provider].filter(Boolean).join(" × ") || null,
      currency: "USD", note: `price ${price.observedAt} × shares outstanding ${shares.observedAt}` + (gap > 0 ? ` (inputs ${Math.round(gap)}d apart)` : ""), unavailable: null };
  }
  return { ...unavailable(r?.unavailable || r?.reason || price?.unavailable || shares?.unavailable || "no dated market cap, and no dated price + shares outstanding to derive one"), observedAt: null };
}

// ─── SEC fundamentals: concepts, periods, TTM ─────────────────────────────────────
export const SPOTLIGHT_CONCEPTS = Object.freeze({
  revenue: { kind: "duration", tags: { "us-gaap": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"], "ifrs-full": ["Revenue", "RevenueFromContractsWithCustomers"] } },
  operatingIncome: { kind: "duration", tags: { "us-gaap": ["OperatingIncomeLoss"], "ifrs-full": ["ProfitLossFromOperatingActivities"] } },
  netIncome: { kind: "duration", tags: { "us-gaap": ["NetIncomeLoss"], "ifrs-full": ["ProfitLoss", "ProfitLossAttributableToOwnersOfParent"] } },
  ocf: { kind: "duration", tags: { "us-gaap": ["NetCashProvidedByUsedInOperatingActivities"], "ifrs-full": ["CashFlowsFromUsedInOperatingActivities"] } },
  capex: { kind: "duration", tags: { "us-gaap": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"], "ifrs-full": ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"] } },
  cash: { kind: "instant", tags: { "us-gaap": ["CashAndCashEquivalentsAtCarryingValue"], "ifrs-full": ["CashAndCashEquivalents"] } },
  debt: { kind: "instant", tags: { "us-gaap": ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"], "ifrs-full": ["Borrowings", "NoncurrentBorrowings"] } },
  sharesOutstanding: { kind: "instant", unit: "shares", tags: { dei: ["EntityCommonStockSharesOutstanding"] } },
});

const Q = [80, 100], H = [170, 195], N9 = [260, 285], FY = [350, 380];
const inBand = (d, [lo, hi]) => d >= lo && d <= hi;

/* Every reported fact for a concept, USD only (a foreign issuer's non-USD concept is named
   as unconverted upstream, never silently scaled), across the accepted forms and taxonomies.
   Dedupe by (start,end): the LATEST FILED value wins — a restatement supersedes. */
export function secFacts(companyfacts, concept) {
  const spec = SPOTLIGHT_CONCEPTS[concept];
  if (!spec) return { rows: [], currency: null };
  const unit = spec.unit || "USD";
  const out = new Map();
  let seenCurrency = null;
  for (const [tax, tags] of Object.entries(spec.tags)) {
    for (const tag of tags) {
      const units = companyfacts?.facts?.[tax]?.[tag]?.units || {};
      const keys = Object.keys(units);
      if (!keys.length) continue;
      if (!units[unit]) { seenCurrency = seenCurrency || keys[0]; continue; }
      for (const x of units[unit]) {
        if (!x || !finite(x.val) || !SPOTLIGHT_FORMS.test(String(x.form || "")) || !isYmd(x.end)) continue;
        if (spec.kind === "duration" && !isYmd(x.start)) continue;
        const key = spec.kind === "duration" ? `${x.start}|${x.end}` : `|${x.end}`;
        const prev = out.get(key);
        const cand = { start: spec.kind === "duration" ? x.start : null, end: x.end, val: x.val, form: x.form,
          filed: x.filed || null, accn: x.accn || null, tag, taxonomy: tax, fp: x.fp || null, fy: x.fy || null };
        if (!prev || String(cand.filed || "").localeCompare(String(prev.filed || "")) > 0) out.set(key, cand);
      }
    }
  }
  const rows = [...out.values()].sort((a, b) => a.end.localeCompare(b.end) || String(a.start || "").localeCompare(String(b.start || "")));
  return { rows, currency: rows.length ? unit : seenCurrency, unit };
}

/* Discrete quarters from a mix of quarterly, half-year, nine-month and full-year duration
   facts. A direct ~90-day fact IS a quarter. A cumulative fact minus the cumulative fact with
   the SAME start ending one quarter earlier is a derived quarter (Q4 = FY − 9M, Q2 = H1 − Q1).
   Direct beats derived for the same end date. Nothing is derived across different starts. */
/* DISCRETE PERIODS — quarters AND half-years, direct or derived, keyed by (start,end).
   Two derivations, both exact arithmetic on the filer's own figures, never estimates:
     · HEAD subtraction: a cumulative period minus a shorter period with the SAME START gives
       the tail (Q4 = FY − 9M, H2 = FY − H1, Q2 = H1 − Q1).
     · TAIL subtraction (v6.5.1, the foreign-issuer shape): a cumulative period minus a direct
       period with the SAME END gives the head (Q1 = H1 − Q2). A 6-K reports the three-month
       AND six-month columns but no Q1 row, so without this the first quarter of every year
       was unreachable for a 6-K filer.
   A direct row always beats a derived one for the same span; only quarter- and half-length
   remainders are kept (a derived 9-month stub is not a period the widget ever prints). */
export function discretePeriods(rows) {
  const xs = (rows || []).filter((r) => r && isYmd(r.start) && isYmd(r.end) && finite(r.val));
  const span = (r) => daysBetween(r.start, r.end);
  const kindOf = (d) => inBand(d, Q) ? "Q" : inBand(d, H) ? "H" : null;
  const out = new Map();
  const put = (r) => { const k = `${r.start}|${r.end}`; if (!out.has(k) || (out.get(k).derived && !r.derived)) out.set(k, r); };
  for (const r of xs) { const kind = kindOf(span(r)); if (kind) put({ start: r.start, end: r.end, val: r.val, kind, derived: false, filed: r.filed, form: r.form, accn: r.accn, tag: r.tag }); }
  const cumul = xs.filter((r) => { const d = span(r); return inBand(d, H) || inBand(d, N9) || inBand(d, FY); });
  for (const c of cumul) {
    for (const p of xs) {
      if (p === c || p.end > c.end || p.start < c.start) continue;
      let start = null, end = null;
      if (p.start === c.start && p.end < c.end) { start = addDays(p.end, 1); end = c.end; }          // head subtraction → tail
      else if (p.end === c.end && p.start > c.start) { start = c.start; end = addDays(p.start, -1); }  // tail subtraction → head
      else continue;
      const kind = kindOf(daysBetween(start, end));
      if (!kind) continue;
      put({ start, end, val: c.val - p.val, kind, derived: true, filed: c.filed, form: c.form, accn: c.accn, tag: c.tag, from: [`${c.start}→${c.end}`, `${p.start}→${p.end}`] });
    }
  }
  return [...out.values()].sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start));
}
export function discreteQuarters(rows) {
  return discretePeriods(rows).filter((p) => p.kind === "Q").map(({ kind, ...q }) => q);
}

/* TTM = a CHAIN of tiling periods (quarters, or halves where a filer reports only six-month
   cash flows) walking back from the latest period end until exactly ~12 months are covered.
   A quarter is preferred at each step; a half is used only where no quarter ends there. A
   chain that cannot reach 12 months without a hole reads unavailable with the hole named —
   nothing is ever summed across a gap. `quarters` may be the output of discreteQuarters
   (legacy callers) or discretePeriods. */
export function ttmFrom(periods) {
  const ps = (periods || []).map((p) => ({ ...p, kind: p.kind || (inBand(daysBetween(p.start, p.end), H) ? "H" : "Q") }));
  if (!ps.length) return unavailable("only 0 of the 4 quarters needed for a trailing twelve months are on file");
  const latestEnd = ps.map((p) => p.end).sort().pop();
  const chain = [];
  let cursor = latestEnd, covered = 0;
  while (covered < 350) {
    const atCursor = ps.filter((p) => p.end === cursor);
    const pick = atCursor.find((p) => p.kind === "Q") || atCursor.find((p) => p.kind === "H");
    if (!pick) break;
    chain.unshift(pick);
    covered += daysBetween(pick.start, pick.end) + 1;
    cursor = addDays(pick.start, -1);
  }
  if (covered < 350) {
    const qs = ps.filter((p) => p.kind === "Q");
    const have = chain.map((p) => `${p.kind}→${p.end}`).join(", ");
    if (chain.length && chain.length < ps.length && ps.some((p) => p.end < chain[0].start))
      return unavailable(`the reported periods do not tile back to twelve months (${have}${have ? "; " : ""}gap before ${chain[0]?.start || latestEnd}) — no TTM summed across a gap`);
    return unavailable(`only ${qs.length} of the 4 quarters needed for a trailing twelve months are on file${chain.length > qs.length ? ` (${chain.length} tiling periods cover ${Math.round(covered / 30)} months)` : ""}`);
  }
  if (covered > 380) return unavailable(`the tiling periods overshoot twelve months (${Math.round(covered)} days) — periods overlap`);
  return { value: chain.reduce((s, p) => s + p.val, 0), start: chain[0].start, end: chain[chain.length - 1].end,
    quarters: chain.map((p) => p.end), periods: chain.map((p) => `${p.kind === "H" ? "half" : "quarter"} to ${p.end}`),
    derived: chain.some((p) => p.derived), halves: chain.filter((p) => p.kind === "H").length };
}

/* The comparable quarter a year earlier: the discrete quarter ending 350–380 days before. */
export function priorYearQuarter(quarters, latest) {
  if (!latest) return null;
  return (quarters || []).filter((q) => q.end < latest.end && inBand(daysBetween(q.end, latest.end), FY))
    .sort((a, b) => b.end.localeCompare(a.end))[0] || null;
}

const periodLabel = (q) => q ? `${q.derived ? "derived quarter" : "quarter"} to ${q.end}` : null;

function durationField(companyfacts, concept, { retrievedAt, sourceUrl }) {
  const { rows, currency, unit } = secFacts(companyfacts, concept);
  if (!rows.length) return { ...unavailable(currency && currency !== unit ? `${concept} is reported in ${currency}; not converted` : `${concept} not found in the issuer's structured filings (10-Q/10-K/20-F/6-K)`), status: "MISSING", provider: "SEC", sourceUrl, retrievedAt };
  const quarters = discreteQuarters(rows);
  const latest = quarters[quarters.length - 1] || null;
  const ttm = ttmFrom(discretePeriods(rows));
  const annual = rows.filter((r) => inBand(daysBetween(r.start, r.end), FY)).sort((a, b) => b.end.localeCompare(a.end))[0] || null;
  // v6.5.2: the newest PERIOD of any length dates the field — a half-year-only cash-flow line
  // (the 6-K shape) must not lose the per-concept merge to an older annual row for want of a date.
  const halves = discretePeriods(rows).filter((p) => p.kind === "H");
  const newestEnd = [latest?.end, halves[halves.length - 1]?.end, annual?.end].filter(Boolean).sort().pop() || null;
  return {
    value: latest ? latest.val : null, status: latest || halves.length ? "LIVE" : "MISSING", provider: "SEC", sourceUrl, retrievedAt,
    observedAt: newestEnd,
    quarter: latest ? { value: latest.val, start: latest.start, end: latest.end, derived: latest.derived, form: latest.form, filed: latest.filed, accn: latest.accn, tag: latest.tag, label: periodLabel(latest) } : null,
    priorYearQuarter: (() => { const p = priorYearQuarter(quarters, latest); return p ? { value: p.val, end: p.end, derived: p.derived, label: periodLabel(p) } : null; })(),
    ttm: ttm.value === null ? ttm : { ...ttm, label: `TTM to ${ttm.end}${ttm.halves ? " (from half-year periods)" : ""}` },
    annual: annual ? { value: annual.val, start: annual.start, end: annual.end, form: annual.form, filed: annual.filed, label: `fiscal year to ${annual.end}` } : null,
    half: (() => { const hs = discretePeriods(rows).filter((p) => p.kind === "H"); const h = hs[hs.length - 1]; return h ? { value: h.val, start: h.start, end: h.end, derived: h.derived, label: `${h.derived ? "derived half-year" : "half-year"} to ${h.end}` } : null; })(),
    ...(latest ? {} : { unavailable: annual ? `only annual ${concept} is on file (fiscal year to ${annual.end}); no quarterly period could be derived` : `no usable ${concept} period on file` }),
    currency: "USD",
  };
}
function instantField(companyfacts, concept, { retrievedAt, sourceUrl }) {
  const { rows, currency, unit } = secFacts(companyfacts, concept);
  const latest = rows[rows.length - 1] || null;
  if (!latest) return { ...unavailable(currency && currency !== unit ? `${concept} is reported in ${currency}; not converted` : `${concept} not found in the issuer's structured filings`), status: "MISSING", provider: "SEC", sourceUrl, retrievedAt };
  return { value: latest.val, status: "LIVE", provider: "SEC", sourceUrl, retrievedAt, observedAt: latest.end, form: latest.form, filed: latest.filed, accn: latest.accn, tag: latest.tag, taxonomy: latest.taxonomy,
    ...(concept === "sharesOutstanding" ? { kind: "outstanding", unit: "shares" } : { currency: "USD" }) };
}

/* When no structured source answered at all (SEC unreachable, no issuer record), every concept
   still carries the CAUSE — "no reported quarter" would hide an unset SEC_USER_AGENT behind a
   generic absence (the 8/31 SEC-identity lesson, one layer over). */
export function unavailableFundamentals(reason, { retrievedAt = new Date().toISOString() } = {}) {
  const f = {};
  for (const concept of Object.keys(SPOTLIGHT_CONCEPTS)) f[concept] = { ...unavailable(`${concept} unavailable — ${reason}`), status: "MISSING", provider: "SEC", retrievedAt };
  f.issuerName = null;
  return f;
}
export function extractSpotlightFundamentals(companyfacts, { retrievedAt = new Date().toISOString(), sourceUrl = "https://data.sec.gov/" } = {}) {
  const ctx = { retrievedAt, sourceUrl };
  const f = {};
  for (const concept of Object.keys(SPOTLIGHT_CONCEPTS))
    f[concept] = SPOTLIGHT_CONCEPTS[concept].kind === "duration" ? durationField(companyfacts, concept, ctx) : instantField(companyfacts, concept, ctx);
  f.issuerName = companyfacts?.entityName || null;
  return f;
}

// ─── issuer-report mapping (when structured filing data is insufficient) ──────────
/* An OPERATOR-curated record of reported figures with their source filing, for issuers whose
   interim results are not XBRL-tagged (Nebius's 6-K press releases). Validated on write;
   consumed exactly like SEC facts, with the source URL carried through to the citation. The
   repo ships NO records — same rule as SEED/BOARD: content lives only in KV. */
const NUM_FIELDS = ["revenue", "operatingIncome", "netIncome", "ocf", "capex", "cash", "debt", "sharesOutstanding"];
export function validateIssuerReport(x) {
  if (!x || typeof x !== "object") return { ok: false, error: "record must be an object" };
  if (x.schema !== SPOTLIGHT_ISSUER_SCHEMA) return { ok: false, error: `schema must be ${SPOTLIGHT_ISSUER_SCHEMA}` };
  if (!/^[A-Z.\-]{1,8}$/.test(String(x.symbol || ""))) return { ok: false, error: "symbol is required" };
  if (!Array.isArray(x.periods) || !x.periods.length) return { ok: false, error: "at least one period is required" };
  if (x.periods.length > 12) return { ok: false, error: "at most 12 periods" };
  for (const p of x.periods) {
    if (!p || !isYmd(p.start) || !isYmd(p.end) || p.end <= p.start) return { ok: false, error: "each period needs start < end as YYYY-MM-DD" };
    const d = daysBetween(p.start, p.end);
    if (!(inBand(d, Q) || inBand(d, H) || inBand(d, N9) || inBand(d, FY))) return { ok: false, error: `period ${p.start}→${p.end} is ${Math.round(d)} days — not a quarter, half, nine months or year` };
    if (!p.source || typeof p.source.url !== "string" || !/^https:\/\/(www\.)?sec\.gov\//.test(p.source.url) || !p.source.form)
      return { ok: false, error: `period ${p.end} needs source.url on sec.gov and source.form` };
    if (p.currency && p.currency !== "USD") return { ok: false, error: `period ${p.end} is in ${p.currency}; only USD records are accepted (no conversion is performed)` };
    for (const k of NUM_FIELDS) if (p[k] !== undefined && p[k] !== null && !finite(p[k])) return { ok: false, error: `period ${p.end}: ${k} must be a number or absent` };
    if (finite(p.sharesOutstanding) && p.sharesOutstanding <= 0) return { ok: false, error: `period ${p.end}: sharesOutstanding must be positive` };
    if (finite(p.capex) && p.capex < 0) return { ok: false, error: `period ${p.end}: capex is a cash outflow — record it as a positive amount` };
  }
  return { ok: true };
}
/* Turn an issuer record into the SAME fields shape as extractSpotlightFundamentals, so the
   metric layer never learns which path fed it. */
export function issuerFundamentals(record, { retrievedAt = new Date().toISOString() } = {}) {
  const v = validateIssuerReport(record);
  if (!v.ok) return null;
  const f = {};
  const url = record.periods[record.periods.length - 1].source.url;
  const rowsFor = (k) => record.periods.filter((p) => finite(p[k])).map((p) => ({ start: p.start, end: p.end, val: p[k], form: p.source.form, filed: p.source.filed || null, accn: null, tag: `issuer-report:${k}` }));
  for (const concept of ["revenue", "operatingIncome", "netIncome", "ocf", "capex"]) {
    const rows = rowsFor(concept);
    if (!rows.length) { f[concept] = { ...unavailable(`${concept} not in the issuer-report record`), status: "MISSING", provider: "issuer report", sourceUrl: url, retrievedAt }; continue; }
    const quarters = discreteQuarters(rows);
    const latest = quarters[quarters.length - 1] || null;
    const ttm = ttmFrom(discretePeriods(rows));
    const p = priorYearQuarter(quarters, latest);
    const halvesI = discretePeriods(rows).filter((x) => x.kind === "H");
    f[concept] = { value: latest ? latest.val : null, status: latest || halvesI.length ? "LIVE" : "MISSING", provider: "issuer report", sourceUrl: url, retrievedAt,
      observedAt: [latest?.end, halvesI[halvesI.length - 1]?.end].filter(Boolean).sort().pop() || null,
      quarter: latest ? { value: latest.val, start: latest.start, end: latest.end, derived: latest.derived, form: latest.form, filed: latest.filed, label: periodLabel(latest) } : null,
      priorYearQuarter: p ? { value: p.val, end: p.end, derived: p.derived, label: periodLabel(p) } : null,
      half: (() => { const hs = discretePeriods(rows).filter((x) => x.kind === "H"); const h = hs[hs.length - 1]; return h ? { value: h.val, start: h.start, end: h.end, derived: h.derived, label: `${h.derived ? "derived half-year" : "half-year"} to ${h.end}` } : null; })(),
      ttm: ttm.value === null ? ttm : { ...ttm, label: `TTM to ${ttm.end}${ttm.halves ? " (from half-year periods)" : ""}` }, annual: null, currency: "USD",
      ...(latest ? {} : { unavailable: `no quarterly ${concept} period in the issuer-report record` }) };
  }
  for (const concept of ["cash", "debt", "sharesOutstanding"]) {
    const p = record.periods.filter((x) => finite(x[concept])).sort((a, b) => b.end.localeCompare(a.end))[0];
    f[concept] = p ? { value: p[concept], status: "LIVE", provider: "issuer report", sourceUrl: p.source.url, retrievedAt, observedAt: p.end, form: p.source.form, filed: p.source.filed || null,
      ...(concept === "sharesOutstanding" ? { kind: "outstanding", unit: "shares" } : { currency: "USD" }) }
      : { ...unavailable(`${concept} not in the issuer-report record`), status: "MISSING", provider: "issuer report", sourceUrl: url, retrievedAt };
  }
  f.issuerName = record.name || null;
  return f;
}
/* Prefer whichever source has the NEWER quarter for revenue; a record filed to cover a 6-K
   gap must not be overridden by an older 20-F annual, and a fresh 10-Q must not be overridden
   by a stale hand record. Per-concept, by the quarter end date. */
export function mergeFundamentals(sec, issuer) {
  if (!sec) return issuer; if (!issuer) return sec;
  const out = { ...sec };
  for (const k of Object.keys(SPOTLIGHT_CONCEPTS)) {
    const a = sec[k], b = issuer[k];
    const da = a?.observedAt || "", db = b?.observedAt || "";
    if ((b && b.status === "LIVE") && (!a || a.status !== "LIVE" || db > da)) out[k] = b;
  }
  out.issuerName = sec.issuerName || issuer.issuerName || null;
  return out;
}

// ─── derived metrics ───────────────────────────────────────────────────────────────
const q = (f) => f && f.status === "LIVE" && f.quarter ? f.quarter : null;
const ttmOf = (f) => f && f.ttm && finite(f.ttm.value) ? f.ttm : null;

export function deriveMetrics({ fundamentals: f, marketCap, series, today }) {
  const m = {};
  const rq = q(f?.revenue), rp = f?.revenue?.priorYearQuarter || null, rt = ttmOf(f?.revenue);
  // Revenue growth: same-quarter YoY from compatible periods.
  m.revenueGrowth = rq && rp && rp.value > 0
    ? { pct: round(100 * (rq.value / rp.value - 1), 1), period: rq.label, priorPeriod: rp.label, latest: rq.value, prior: rp.value, deltaUsd: rq.value - rp.value, unavailable: null }
    : { pct: null, unavailable: !rq ? (f?.revenue?.unavailable || "no reported quarter") : !rp ? `no comparable quarter a year before ${rq.end} on file` : "prior-year revenue is not positive; growth not computed" };
  // Operating margin: same quarter, plus the prior-year quarter for direction.
  const oq = q(f?.operatingIncome), op = f?.operatingIncome?.priorYearQuarter || null;
  const marginPct = (inc, rev) => inc && rev && rev.value > 0 && inc.end === rev.end ? round(100 * inc.value / rev.value, 1) : null;
  const cur = marginPct(oq, rq), prior = marginPct(op, rp);
  m.operatingMargin = cur !== null
    ? { pct: cur, priorPct: prior, period: rq.label, deltaPts: prior !== null ? round(cur - prior, 1) : null, operatingIncome: oq.value, unavailable: null }
    : { pct: null, unavailable: !oq ? (f?.operatingIncome?.unavailable || "no reported operating income") : !rq ? "no reported revenue for the same quarter" : `operating income (to ${oq.end}) and revenue (to ${rq.end}) are not the same period` };
  // Free cash flow = OCF − capex, SAME period (quarter, else TTM).
  const cq = q(f?.ocf), xq = q(f?.capex), ct = ttmOf(f?.ocf), xt = ttmOf(f?.capex);
  const ch = f?.ocf?.half || null, xh = f?.capex?.half || null;
  if (cq && xq && cq.end === xq.end) m.fcf = { value: cq.value - xq.value, ocf: cq.value, capex: xq.value, period: cq.label, basis: "quarter", unavailable: null };
  // A 6-K filer reports six-month cash flows only: the half-year is the honest period, named as such.
  else if (ch && xh && ch.end === xh.end && ch.start === xh.start) m.fcf = { value: ch.value - xh.value, ocf: ch.value, capex: xh.value, period: ch.label, basis: "half", unavailable: null };
  else if (ct && xt && ct.end === xt.end) m.fcf = { value: ct.value - xt.value, ocf: ct.value, capex: xt.value, period: ct.label, basis: "ttm", unavailable: null };
  else m.fcf = { value: null, unavailable: !cq && !ct ? (f?.ocf?.unavailable || "no operating cash flow on file") : !xq && !xt ? (f?.capex?.unavailable || "no capital expenditure on file") : "operating cash flow and capex are not on file for the same period" };
  m.fcfTtm = ct && xt && ct.end === xt.end ? { value: ct.value - xt.value, period: ct.label } : null;
  // Valuation: cap ÷ TTM revenue; trailing P/E only where TTM earnings are positive.
  const nt = ttmOf(f?.netIncome);
  const capUsd = marketCap && finite(marketCap.usd) ? marketCap.usd : null;
  m.valuation = {
    capToTtmRevenue: capUsd && rt && rt.value > 0 ? round(capUsd / rt.value, 1) : null,
    ttmRevenue: rt ? rt.value : null, ttmRevenuePeriod: rt ? rt.label : null,
    trailingPe: capUsd && nt && nt.value > 0 ? round(capUsd / nt.value, 1) : null,
    ttmNetIncome: nt ? nt.value : null,
    peNote: !nt ? (f?.netIncome?.ttm?.unavailable || "TTM net income unavailable") : nt.value <= 0 ? "trailing earnings are negative — no P/E" : null,
    unavailable: !capUsd ? `no market cap (${marketCap?.unavailable || "no cap"})` : !rt ? (f?.revenue?.ttm?.unavailable || "TTM revenue unavailable") : null,
  };
  // Run-rate vs reported: latest quarter × 4 against the TTM actually reported.
  m.runRate = rq ? { quarter: rq.value, annualized: rq.value * 4, ttm: rt ? rt.value : null, gapPct: rt && rt.value > 0 ? round(100 * (rq.value * 4 / rt.value - 1), 1) : null, period: rq.label } : null;
  // Price trend: moving averages from the return series' own closes (no Terminal levels).
  const closes = (series?.rows || []).filter((r) => isYmd(r.date) && finite(r.value)).sort((a, b) => a.date.localeCompare(b.date));
  const last = closes[closes.length - 1] || null;
  const ma50 = sma(closes.map((r) => r.value), 50), ma200 = sma(closes.map((r) => r.value), 200);
  m.trend = last ? { px: round(last.value, 2), asOf: last.date, ma50: round(ma50, 2), ma200: round(ma200, 2),
    above200: ma200 !== null ? last.value > ma200 : null, above50: ma50 !== null ? last.value > ma50 : null,
    fiftyAbove200: ma50 !== null && ma200 !== null ? ma50 > ma200 : null,
    basis: series?.basis || null, unavailable: ma200 === null ? `${closes.length} closes on file — 200 needed for the 200-day average` : null }
    : { px: null, unavailable: series?.unavailable || "no price series" };
  // Balance sheet.
  m.cash = f?.cash?.status === "LIVE" ? { value: f.cash.value, asOf: f.cash.observedAt, unavailable: null } : { value: null, unavailable: f?.cash?.unavailable || "cash unavailable" };
  m.debt = f?.debt?.status === "LIVE" ? { value: f.debt.value, asOf: f.debt.observedAt, unavailable: null } : { value: null, unavailable: `${f?.debt?.unavailable || "debt not reported under the tracked tags"} — absent is not zero` };
  m.shares = f?.sharesOutstanding?.status === "LIVE" ? { value: f.sharesOutstanding.value, asOf: f.sharesOutstanding.observedAt, unavailable: null } : { value: null, unavailable: f?.sharesOutstanding?.unavailable || "shares outstanding unavailable" };
  m.fundamentalsPeriod = rq ? { label: rq.label, end: rq.end, form: rq.form || null, filed: rq.filed || null } : null;
  void today;
  return m;
}

// ─── deterministic assessments ────────────────────────────────────────────────────
const pctWord = (v, up, down, flat = "was flat") => v > 0.05 ? up : v < -0.05 ? down : flat;
export function assessCompany({ symbol, metrics: m, nextEarnings, freshness }) {
  const rg = m.revenueGrowth, om = m.operatingMargin, val = m.valuation, tr = m.trend;
  // 1. Business — is revenue growing, and is profitability improving?
  let business;
  if (finite(rg.pct)) {
    business = `Revenue ${pctWord(rg.pct, "grew", "fell")} ${Math.abs(rg.pct).toFixed(1)}% versus the same quarter a year earlier (${rg.period}).`;
    if (finite(om.pct) && finite(om.priorPct)) business += ` Operating margin ${om.deltaPts > 0.05 ? "widened" : om.deltaPts < -0.05 ? "narrowed" : "held"} from ${om.priorPct.toFixed(1)}% to ${om.pct.toFixed(1)}%.`;
    else if (finite(om.pct)) business += ` Operating margin was ${om.pct.toFixed(1)}% (no prior-year margin on file to compare).`;
    else business += ` Operating margin is unavailable — ${om.unavailable}.`;
  } else business = `Revenue growth is unavailable — ${rg.unavailable}.` + (finite(om.pct) ? ` Operating margin was ${om.pct.toFixed(1)}% (${om.period}).` : "");
  // 2. Stock — what multiple is the market paying, and how is the price trending?
  let stock;
  if (finite(val.capToTtmRevenue)) {
    stock = `The market pays ${val.capToTtmRevenue.toFixed(1)}× trailing-twelve-month revenue` +
      (finite(val.trailingPe) ? ` and ${val.trailingPe.toFixed(1)}× trailing earnings.` : ` (${val.peNote}).`);
  } else stock = `Valuation multiple is unavailable — ${val.unavailable}.`;
  const suppressed = !!(freshness && freshness.market && freshness.market.stale);
  if (suppressed) stock += " Price trend not assessed — the latest expected session close is missing from the series.";
  else if (finite(tr.px) && tr.above200 !== null) {
    stock += ` The price is ${tr.above200 ? "above" : "below"} its 200-day average` +
      (tr.fiftyAbove200 !== null ? ` and the 50-day average is ${tr.fiftyAbove200 ? "above" : "below"} the 200-day.` : ".");
  } else if (tr.unavailable) stock += ` Price trend is unavailable — ${tr.unavailable}.`;
  // 3. Watch next — which reported metric or announced event could change this?
  const next = nextEarnings && isYmd(nextEarnings.value) ? `Next scheduled report: ${nextEarnings.value}.` : "Next report date is not on the calendar feed.";
  const watchNext = `${next} Check whether revenue growth and operating margin hold versus ${finite(rg.pct) ? `${fmtPct(rg.pct)}` : "this quarter's growth"}${finite(om.pct) ? ` and ${om.pct.toFixed(1)}%` : ""}.`;
  /* The two-sentence face (review: Simple was too dense): one business sentence, one stock
     sentence, each a compression of the full clause above — never a different claim. */
  const s1 = finite(rg.pct)
    ? `Revenue ${pctWord(rg.pct, "grew", "fell")} ${Math.abs(rg.pct).toFixed(1)}% year over year` + (finite(om.pct) && finite(om.priorPct) ? ` and operating margin ${om.deltaPts > 0.05 ? "widened" : om.deltaPts < -0.05 ? "narrowed" : "held"} to ${om.pct.toFixed(1)}%.` : finite(om.pct) ? ` at a ${om.pct.toFixed(1)}% operating margin.` : ".")
    : `Revenue growth is unavailable — ${rg.unavailable}.`;
  const s2 = finite(val.capToTtmRevenue)
    ? `The market pays ${val.capToTtmRevenue.toFixed(1)}× trailing revenue` + (finite(val.trailingPe) ? ` (${val.trailingPe.toFixed(1)}× earnings)` : "") +
      (suppressed ? "; the price trend is not assessed on a stale tape." : finite(tr.px) && tr.above200 !== null ? `; the price is ${tr.above200 ? "above" : "below"} its 200-day average.` : ".")
    : `Valuation multiple is unavailable — ${val.unavailable}.`;
  const summary = [s1, s2];
  const inputs = [];
  if (finite(rg.pct)) inputs.push(`revenue ${fmtMoney(rg.latest)} (${rg.period}) vs ${fmtMoney(rg.prior)} (${rg.priorPeriod}) → ${fmtPct(rg.pct)}`);
  if (finite(om.pct)) inputs.push(`operating income ${fmtMoney(om.operatingIncome)} ÷ revenue → ${om.pct.toFixed(1)}%${finite(om.priorPct) ? ` (prior year ${om.priorPct.toFixed(1)}%)` : ""}`);
  if (finite(m.fcf.value)) inputs.push(`free cash flow = OCF ${fmtMoney(m.fcf.ocf)} − capex ${fmtMoney(m.fcf.capex)} = ${fmtMoney(m.fcf.value)} (${m.fcf.period})`);
  if (finite(val.capToTtmRevenue)) inputs.push(`market cap ÷ TTM revenue ${fmtMoney(val.ttmRevenue)} (${val.ttmRevenuePeriod}) → ${val.capToTtmRevenue.toFixed(1)}×`);
  if (finite(val.trailingPe)) inputs.push(`market cap ÷ TTM net income ${fmtMoney(val.ttmNetIncome)} → ${val.trailingPe.toFixed(1)}×`);
  if (finite(tr.px) && finite(tr.ma200)) inputs.push(`close $${tr.px} on ${tr.asOf} vs 50-day $${tr.ma50 ?? "n/a"} · 200-day $${tr.ma200}`);
  return { symbol, summary, business, stock, watchNext, priceTrendSuppressed: suppressed, inputs };
}

// ─── the seven lessons ─────────────────────────────────────────────────────────────
/* Authored, conceptual, tied to the comparison in rotation. `example(ctx)` returns a worked
   example ONLY when the evidence exists; null means the widget states that the worked example
   is unavailable rather than inventing numbers. ctx = { anchor, comparison } companies. */
const exBoth = (ctx, fn) => {
  const parts = [ctx.anchor, ctx.comparison].map(fn).filter(Boolean);
  return parts.length === 2 ? parts.join(" ") : null;
};
export const LESSONS = Object.freeze({
  MSFT: {
    title: "Reported revenue versus annualized run-rate",
    body: "A quarter's revenue multiplied by four is a run-rate, not a year of results. Run-rate assumes the latest quarter simply repeats; reported trailing-twelve-month revenue is what actually happened. The gap between the two is the growth or seasonality packed into the latest quarter.",
    example: (ctx) => exBoth(ctx, (c) => { const r = c.metrics?.runRate; return r && finite(r.ttm) && finite(r.gapPct)
      ? `${c.symbol}: ${fmtMoney(r.quarter)} × 4 = ${fmtMoney(r.annualized)} run-rate vs ${fmtMoney(r.ttm)} reported TTM (${fmtPct(r.gapPct)}).` : null; }),
  },
  AAPL: {
    title: "Business growth versus growth per share",
    body: "Buybacks shrink the share count, so per-share figures can grow faster than the business itself. Compare revenue growth with the change in shares outstanding to see how much of the per-share growth came from the business and how much from a smaller denominator.",
    example: (ctx) => exBoth(ctx, (c) => { const rg = c.metrics?.revenueGrowth, sh = c.metrics?.shares; return finite(rg?.pct) && finite(sh?.value)
      ? `${c.symbol}: revenue ${fmtPct(rg.pct)} year over year; ${(sh.value / 1e9).toFixed(2)}B shares outstanding at ${sh.asOf}.` : null; }),
  },
  AMZN: {
    title: "Operating cash flow versus capital spending",
    body: "Operating cash flow is what the business generates; capital spending is what it reinvests. Free cash flow is the difference. A heavy build-out can push free cash flow toward zero or below even while operating cash flow keeps rising — the same statement read two ways.",
    example: (ctx) => exBoth(ctx, (c) => { const f = c.metrics?.fcf; return finite(f?.value)
      ? `${c.symbol}: OCF ${fmtMoney(f.ocf)} − capex ${fmtMoney(f.capex)} = ${fmtMoney(f.value)} free cash flow (${f.period}).` : null; }),
  },
  GOOGL: {
    title: "Cash generation versus valuation",
    body: "A market cap is a price; free cash flow is what the business produces for that price. Dividing the cap by trailing free cash flow tells you how many years of today's cash the price implies — one axis on which very different companies can be compared.",
    example: (ctx) => exBoth(ctx, (c) => { const f = c.metrics?.fcfTtm, cap = c.marketCap; return finite(f?.value) && f.value > 0 && finite(cap?.usd)
      ? `${c.symbol}: ${cap.display} ÷ ${fmtMoney(f.value)} TTM free cash flow ≈ ${(cap.usd / f.value).toFixed(0)}× (${f.period}).`
      : finite(f?.value) && finite(cap?.usd) ? `${c.symbol}: TTM free cash flow is ${fmtMoney(f.value)} — the ratio is not meaningful when it is not positive.` : null; }),
  },
  META: {
    title: "Margins and reinvestment",
    body: "Operating margin shows what is left after running costs; capital spending shows what is being reinvested after that. High margins can fund a very large capex program from operations alone, while a thin-margin business has to borrow or raise equity to build the same thing.",
    example: (ctx) => exBoth(ctx, (c) => { const om = c.metrics?.operatingMargin, f = c.metrics?.fcf, rg = c.metrics?.revenueGrowth; return finite(om?.pct) && finite(f?.capex) && finite(rg?.latest) && rg.latest > 0
      ? `${c.symbol}: ${om.pct.toFixed(1)}% operating margin; capex equal to ${(100 * f.capex / rg.latest).toFixed(0)}% of quarterly revenue.` : null; }),
  },
  NVDA: {
    title: "Growth rates, scale, and expectations",
    body: "A high growth rate on a small base and a moderate rate on a huge base can add similar dollars. Compare the dollar change in revenue, not only the percentage — and remember the multiple the market pays already encodes the growth it expects to continue.",
    example: (ctx) => exBoth(ctx, (c) => { const rg = c.metrics?.revenueGrowth; return finite(rg?.deltaUsd)
      ? `${c.symbol}: ${fmtPct(rg.pct)} year over year adds ${fmtMoney(rg.deltaUsd)} of quarterly revenue.` : null; }),
  },
  TSLA: {
    title: "Reported results versus market expectations",
    body: "A stock reacts to results relative to what was expected, not to the results alone. The multiple the market pays is a compressed statement of those expectations, so the same revenue growth can move two stocks in opposite directions depending on what each price already assumed.",
    example: (ctx) => exBoth(ctx, (c) => { const v = c.metrics?.valuation, rg = c.metrics?.revenueGrowth; return finite(v?.capToTtmRevenue) && finite(rg?.pct)
      ? `${c.symbol}: ${v.capToTtmRevenue.toFixed(1)}× TTM revenue alongside ${fmtPct(rg.pct)} revenue growth (expectations themselves are not measured here).` : null; }),
  },
});

// ─── freshness (recomputed at serve, never trusted from storage) ──────────────────
export function marketFreshness(observedAt, now = new Date()) {
  if (!isYmd(observedAt)) return { observedAt: null, stale: true, sessionsBehind: null, reason: "no observation date" };
  const behind = sessionsBehind(observedAt, now);
  return { observedAt, stale: behind === null ? true : behind >= 1, sessionsBehind: behind,
    reason: behind >= 1 ? `${behind} completed session${behind === 1 ? "" : "s"} missing since ${observedAt}` : null };
}
export function freshenSpotlight(model, now = new Date()) {
  if (!model || model.schema !== SPOTLIGHT_SCHEMA) return model;
  const servedDate = etYmd(now);
  const out = { ...model, servedAt: now.toISOString(), businessDateServed: servedDate, companies: {} };
  /* Review #3: a December model served in January must not keep showing last year's YTD as
     if it were this year's. The served ET year is compared with the tracker's year; on a
     rollover every leg is reset to "awaiting the first trading close" and the line is
     withdrawn, until a refresh with a new-year observation replaces the model. */
  const t = model.tracker;
  const trackerYear = t?.year || (t?.baselineDate ? String(Number(t.baselineDate.slice(0, 4)) + 1) : null);
  if (t && trackerYear && servedDate.slice(0, 4) > trackerYear) {
    const legs = {};
    for (const [sym, l] of Object.entries(t.legs || {})) legs[sym] = { ...l, pct: null, through: null, points: [], awaiting: true,
      baseline: null, unavailable: `YTD awaits the first ${servedDate.slice(0, 4)} trading close (stored series ends ${l.through || "—"})` };
    out.tracker = { ...t, year: servedDate.slice(0, 4), yearRollover: true, baselineDate: yearEndSession(servedDate.slice(0, 4)), through: null, points: [], legs, partial: null,
      unavailable: `YTD awaits the first ${servedDate.slice(0, 4)} trading close — the stored ${trackerYear} series is last year's` };
  }
  for (const [sym, c] of Object.entries(model.companies || {})) {
    const market = marketFreshness(c.marketCap?.observedAt || null, now);
    const trackerLeg = model.tracker?.legs?.[sym];
    const series = marketFreshness(trackerLeg?.through || null, now);
    const freshness = { market, series, fundamentals: c.freshness?.fundamentals || null };
    const assessment = assessCompany({ symbol: sym, metrics: c.metrics, nextEarnings: c.nextEarnings, freshness: { market: series } });
    out.companies[sym] = { ...c, freshness, assessment };
  }
  return out;
}

// ─── the model, and its public projection ─────────────────────────────────────────
/* buildSpotlightModel is what the refresh assembles from per-company facts; the shape is the
   whole contract the widget renders. Nothing here reads book state — the inputs are provider
   facts only, and the projection below is a field-by-field whitelist. */
export function buildCompany({ symbol, name, facts, fundamentals, series, today, now }) {
  const price = facts?.quote && facts.quote.status !== "MISSING" && finite(facts.quote.value)
    ? { value: facts.quote.value, currency: facts.quote.currency || null, observedAt: (facts.quote.observedAt || "").slice(0, 10) || null, provider: facts.quote.provider || null } : null;
  const shares = fundamentals?.sharesOutstanding?.status === "LIVE"
    ? { value: fundamentals.sharesOutstanding.value, observedAt: fundamentals.sharesOutstanding.observedAt, kind: "outstanding", provider: fundamentals.sharesOutstanding.provider }
    : facts?.sharesOutstanding && finite(facts.sharesOutstanding.value)
      ? { value: facts.sharesOutstanding.value, observedAt: (facts.sharesOutstanding.observedAt || "").slice(0, 10), kind: facts.sharesOutstanding.kind || "outstanding", provider: facts.sharesOutstanding.provider } : null;
  const marketCap = resolveMarketCap({ reported: facts?.marketCap || null, price, shares });
  const metrics = deriveMetrics({ fundamentals, marketCap, series, today });
  const fundamentalsFreshness = metrics.fundamentalsPeriod
    ? { label: "latest reported", period: metrics.fundamentalsPeriod.label, end: metrics.fundamentalsPeriod.end, form: metrics.fundamentalsPeriod.form, filed: metrics.fundamentalsPeriod.filed }
    : { label: "latest reported", period: null, unavailable: fundamentals?.revenue?.unavailable || "no reported period" };
  const nextEarnings = facts?.nextEarnings && isYmd(facts.nextEarnings.value) ? { value: facts.nextEarnings.value, provider: facts.nextEarnings.provider || null } : null;
  const sources = [];
  // A duration concept's filing identity lives on its latest quarter; lift it into the citation.
  const cite = (label, f) => { if (f && f.sourceUrl) sources.push({ label, provider: f.provider || null, url: f.sourceUrl, observedAt: f.observedAt || null,
    form: f.form || f.quarter?.form || null, filed: f.filed || f.quarter?.filed || null }); };
  cite("market cap", facts?.marketCap || facts?.quote); cite("revenue", fundamentals?.revenue); cite("operating income", fundamentals?.operatingIncome);
  cite("operating cash flow", fundamentals?.ocf); cite("capital expenditure", fundamentals?.capex); cite("cash", fundamentals?.cash); cite("debt", fundamentals?.debt);
  cite("shares outstanding", fundamentals?.sharesOutstanding); cite("price series", series); cite("earnings calendar", facts?.nextEarnings);
  const company = { symbol, name: name || COMPANY_NAMES[symbol] || symbol, blurb: COMPANY_BLURBS[symbol] || null, currency: "USD", marketCap, metrics, nextEarnings,
    freshness: { market: marketFreshness(marketCap.observedAt, now), fundamentals: fundamentalsFreshness }, sources };
  company.assessment = assessCompany({ symbol, metrics, nextEarnings, freshness: { market: marketFreshness(series?.rows?.length ? series.rows[series.rows.length - 1].date : null, now) } });
  return company;
}

/* Review #4: "success" is a DATA condition, not a KV write. A refresh counts as successful
   only when, for BOTH companies, a market cap is on file and the total-return leg either has
   a figure or is honestly awaiting the year's first close. Anything less keeps the previous
   pair — the rotation is never advanced onto a name the widget cannot show. */
/* `freshStatus` (optional): per symbol, the status of the market cap and total-return
   series as returned by THIS run's providers — before the last-good merge. A pair prepared
   last week and carried as STALE is not a successful refresh, so it must not advance the
   rotation on a night every provider was dark. */
export function refreshSucceeded(model, freshStatus = null) {
  if (!model || !model.pair) return { ok: false, reasons: ["no model"] };
  const reasons = [];
  for (const sym of [model.pair.anchor, model.pair.comparison]) {
    const c = model.companies?.[sym], leg = model.tracker?.legs?.[sym];
    if (!c || !finite(c.marketCap?.usd)) reasons.push(`${sym}: market cap unavailable`);
    if (!leg || (!finite(leg.pct) && !leg.awaiting)) reasons.push(`${sym}: total-return leg unavailable`);
    const fs = freshStatus && freshStatus[sym];
    if (fs) {
      if (fs.marketCap !== "LIVE") reasons.push(`${sym}: market cap not refreshed this run (${fs.marketCap || "absent"})`);
      if (fs.totalReturn !== "LIVE") reasons.push(`${sym}: total-return series not refreshed this run (${fs.totalReturn || "absent"})`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export function buildSpotlightModel({ anchor, comparison, rotation, tracker, now = new Date(), failures = [] }) {
  const comp = rotation ? comparisonAt(rotation.index) : comparison.symbol;
  const lesson = LESSONS[comp] || null;
  const example = lesson ? lesson.example({ anchor, comparison }) : null;
  return {
    schema: SPOTLIGHT_SCHEMA,
    generatedAt: now.toISOString(),
    businessDate: etYmd(now),
    pair: { anchor: anchor.symbol, comparison: comp, comparisonLabel: SPOTLIGHT_COMPARISON_LABEL,
      weekKey: rotation?.weekKey || etWeekKey(etYmd(now)), rotationIndex: rotation?.index ?? SPOTLIGHT_ROTATION.indexOf(comp),
      nextComparison: comparisonAt((rotation?.index ?? SPOTLIGHT_ROTATION.indexOf(comp)) + 1) },
    companies: { [anchor.symbol]: anchor, [comp]: comparison },
    tracker,
    lesson: lesson ? { key: comp, title: lesson.title, body: lesson.body, example, exampleUnavailable: example ? null : "worked example unavailable — the supporting figures are not on file for both companies" } : null,
    disclaimer: "Educational comparison of reported figures and market prices. Not a rating, not a recommendation, not investment advice.",
    diagnostics: { failures },
  };
}

const PUBLIC_METRIC_KEYS = ["revenueGrowth", "operatingMargin", "fcf", "fcfTtm", "valuation", "runRate", "trend", "cash", "debt", "shares", "fundamentalsPeriod"];
export function projectSpotlight(model) {
  if (!model || model.schema !== SPOTLIGHT_SCHEMA) return null;
  const companies = {};
  for (const [sym, c] of Object.entries(model.companies || {})) {
    const metrics = {};
    for (const k of PUBLIC_METRIC_KEYS) if (c.metrics && c.metrics[k] !== undefined) metrics[k] = c.metrics[k];
    companies[sym] = {
      symbol: c.symbol, name: c.name, blurb: c.blurb || null, currency: c.currency,
      marketCap: c.marketCap ? { usd: c.marketCap.usd ?? null, display: c.marketCap.display ?? null, observedAt: c.marketCap.observedAt ?? null, method: c.marketCap.method ?? null, provider: c.marketCap.provider ?? null, note: c.marketCap.note ?? null, unavailable: c.marketCap.unavailable ?? null } : null,
      metrics,
      nextEarnings: c.nextEarnings ? { value: c.nextEarnings.value, provider: c.nextEarnings.provider } : null,
      freshness: c.freshness || null,
      assessment: c.assessment ? { summary: Array.isArray(c.assessment.summary) ? c.assessment.summary.slice(0, 2) : [], business: c.assessment.business, stock: c.assessment.stock, watchNext: c.assessment.watchNext, priceTrendSuppressed: !!c.assessment.priceTrendSuppressed, inputs: c.assessment.inputs || [] } : null,
      sources: Array.isArray(c.sources) ? c.sources.map((s) => ({ label: s.label, provider: s.provider, url: s.url, observedAt: s.observedAt, form: s.form, filed: s.filed })) : [],
    };
  }
  const t = model.tracker || null;
  const legs = {};
  for (const [sym, l] of Object.entries(t?.legs || {})) legs[sym] = { symbol: l.symbol, basis: l.basis, label: l.label, basisNote: l.basisNote, provider: l.provider, sourceUrl: l.sourceUrl || null,
    baseline: l.baseline || null, through: l.through || null, pct: l.pct ?? null, awaiting: !!l.awaiting, unavailable: l.unavailable || null };
  return {
    schema: model.schema, generatedAt: model.generatedAt, businessDate: model.businessDate,
    servedAt: model.servedAt || null, businessDateServed: model.businessDateServed || null,
    pair: model.pair, companies,
    tracker: t ? { year: t.year || null, yearRollover: !!t.yearRollover, baselineDate: t.baselineDate, baselineMismatch: t.baselineMismatch, through: t.through, points: t.points || [], legs, unavailable: t.unavailable, partial: t.partial, method: t.method } : null,
    lesson: model.lesson, disclaimer: model.disclaimer,
    diagnostics: { failures: (model.diagnostics?.failures || []).map((f) => ({ symbol: f.symbol || null, item: f.item || null, reason: String(f.reason || "").slice(0, 200) })) },
  };
}
