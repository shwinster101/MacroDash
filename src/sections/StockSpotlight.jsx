import SectionHeader from "../primitives/SectionHeader.jsx";
// ─── STOCK SPOTLIGHT (v6.5.0, docs/plans/stock-spotlight.md) ─────────────────────────
// NBIS beside one rotating "Established growth" comparison, answering ONE question in both
// modes: what do this business's latest results and its stock's current price tell me?
//
// PRESENTATION ONLY (the v3.73 boundary): every number, label, basis and sentence here was
// computed server-side by functions/lib/spotlight.js and arrives already projected. This
// file formats nothing that could disagree with the model — it joins strings. The fetch
// lives in the orchestrator (the TerminalDock precedent). No hooks, no storage.
//
// Rules this component enforces at render:
//   · Renders NOTHING without an enabled feed and a model (a feature flag off, a failed
//     fetch or a demo build must never show example companies).
//   · Company name + ticker, YTD return and the shared YTD chart are ALWAYS visible in both
//     modes — never behind a disclosure. Missing = "Unavailable" + the reason, never 0.
//   · Simple: company name + market cap + return this year + one fundamental, with a
//     whole-card tap opening the existing three-bullet FactSheet. The owner restored size
//     and requested company teaching on 2026-09-15. Degen keeps the detailed profile.
//   · The tracker draws ONLY verified total-return legs; a withheld leg reads Unavailable
//     with its reason, and a new year before its first close reads "awaiting".
//   · No verdict badges, no rating words: the assessment text is the model's deterministic
//     template and is rendered verbatim.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { T } from "../design-tokens.js";
import { Explainable } from "../primitives/FactSheet.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";
import { spotlightFace, lessonTitle, lessonBody, chartTitle, EXPLORE_FOLD_LABEL } from "../simpleFace.js";

import { spotlightExplain, valuationExplain, peDisplay } from "../spotlightExplain.js";

const LINE = { anchor: { stroke: T.amber, dash: null }, comparison: { stroke: T.blue, dash: "5 3" } };
/* v6.8.3 (PUBLIC TERMINAL SKIN, Slice 2 item 3 — "Spotlight: same panel chrome as a Simple
   card … no rounded consumer-card look"). ONE panel object, shared by both profiles, both
   supporting-analysis panels and the chart frame, carrying the Simple card's own container
   (radius 5, 8px/10px padding) instead of the widget's old radius-6 / 10px-12px consumer card.
   The 3px left rule is the Simple card's too — but here it is DERIVED, not decoration: it is
   the company's own chart-line colour, so the rule IS the legend and a panel can never claim a
   line it does not draw. The chart frame belongs to BOTH companies, so it wears the panel and
   no rule — a coloured rule there would assert an owner that does not exist. */
const PANEL = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, padding: "8px 10px", minWidth: 0 };
const legColor = (i) => (i === 0 ? LINE.anchor.stroke : LINE.comparison.stroke);

/* v6.9.5 — THE CADENCE, IN BOTH MODES (owner, on a live Simple screenshot: "Still shows
   Microsoft and it's been 3 days"). The rotation was working correctly; what was missing was
   any way to know that, because `week of … · next: …` was gated `!simple` and Simple is the
   default. Three days of one name with nothing stating the cadence leaves "it is stuck" as
   the only available reading — the label-outlives-its-data defect in reverse, where the fact
   exists on the model and no surface carries it.

   The model's `forDate` is the ET day the pick BELONGS to, never the build timestamp, so a
   pair held over a weekend (the spotlight leg rides the weekday crons) or served the morning
   before the day's refresh SAYS which day it is showing instead of implying it is today's.
   That distinction is the whole point: "changes daily" and "today's pick is on screen" are
   different claims, and only the first is always true. Never fabricated — a model without a
   `forDate` (written before v6.9.5) states the cadence alone rather than guessing a date. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : null;
};
export function cadenceLine(pair, servedDate) {
  if (!pair) return null;
  const forDate = pair.forDate || null;
  const behind = !!(forDate && servedDate && forDate < servedDate);
  const parts = ["a new name each day"];
  if (behind) parts.push(`showing ${shortDate(forDate)}'s pick`);
  if (pair.nextComparison) parts.push(`next: ${pair.nextComparison}`);
  return { text: parts.join(" · "), behind };
}
const panel = (rule) => (rule ? { ...PANEL, borderLeft: `3px solid ${rule}` } : PANEL);
const money = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const s = v < 0 ? "−" : "", a = Math.abs(v);
  return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(0)}M` : `${s}$${a.toFixed(0)}`;
};
const pct = (v, d = 1) => typeof v === "number" && Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%` : null;
const hostOf = (u) => { try { return new URL(u).host; } catch (_e) { return null; } };
// One tick per calendar month (the first plotted date of each), so a wide chart never repeats
// a month label — a display choice, not a computation on the data.
const monthStarts = (pts) => pts.filter((p, i) => i === 0 || String(p.date).slice(0, 7) !== String(pts[i - 1].date).slice(0, 7)).map((p) => p.date);
const monthTick = (d) => { const m = String(d || "").slice(5, 7); return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] || ""; };

/* Chip-length CAUSE for the Simple face (presentation only — the model's long reason is the
   source of truth and is never shortened there). Unmatched reasons fall back to the bare word;
   the full reason always rides the element title and the explore block. */
const SHORT_REASON = [
  [/only annual .* is on file/, "annual filing only"],
  [/not found in the issuer's structured filings/, "not in filings"],
  [/no usable .* period on file|no reported quarter|no comparable quarter/, "no period"],
  [/quoted in [A-Z]{3}; not converted|not USD/, "non-USD"],
  [/no verified total-return series|price return is not a substitute|adjustment not verified/, "not total return"],
  [/quarters needed for a trailing twelve months|do not tile/, "no full year"],
  [/awaits the first \d{4} trading close/, "awaiting first close"],
  [/lacks the final \d{4} trading close/, "no year-end close"],
  [/SEC_USER_AGENT|FINNHUB_KEY|TIINGO_KEY/, "feed not configured"],
  [/market cap unavailable|no dated market cap|no market cap/, "no market cap"],
];
export const shortReason = (reason) => { for (const [re, chip] of SHORT_REASON) if (re.test(String(reason || ""))) return chip; return null; };

/* "Unavailable" is a first-class value: the word, then the reason at caption weight. In
   compact form the reason moves to the title and a chip-length cause takes its place. */
const Unavail = ({ reason, compact = false }) => (
  <span title={reason || undefined} style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.amber }}>Unavailable
    {compact
      ? (shortReason(reason) ? <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}> · {shortReason(reason)}</span> : null)
      : (reason ? <span style={{ color: T.textMuted, fontFamily: T.fontSans, fontSize: T.fsS }}> — {reason}</span> : null)}</span>
);
/* The row IS the strip's anatomy — eyebrow · value · sub — in the strip's own tokens: the
   label reads mono fs-s (11) tracked and muted like a strip label (was fs-xs 10), the value
   keeps fs-m / fs-l, the sub stays fs-xs. The ⓘ is KEPT here, and the v6.8.1/v6.8.2 deletions
   are why: there the whole tile and the whole card were already the Explainable button, so the
   glyph was a SECOND affordance on a target under the thumb. Here only the LABEL is the button
   — the value sits outside it — so the glyph is the FIRST and only visible affordance, and
   dropping it would remove the affordance rather than de-duplicate it. */
const Row = ({ label, value, sub, unavailable, big = false, compact = false, explain }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", minWidth: 0, padding: "2px 0" }}>
    {explain ? <span style={{ flexShrink: 0, minWidth: 92 }}><Explainable explain={explain} title={explain.full} eyebrow={explain.eyebrow} className="stock-metric-trigger"
      style={{ background: "none", border: 0, padding: "8px 0", minHeight: 44, minWidth: 92, flex: "0 1 auto" }}>
      <span className="stock-row-label" style={{ fontFamily: T.fontMono, fontSize: T.fsS, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label} <span style={{ color: T.amber }}>ⓘ</span></span>
    </Explainable></span> : <span className="stock-row-label" style={{ fontFamily: T.fontMono, fontSize: T.fsS, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0, minWidth: 92 }}>{label}</span>}
    {value != null && !unavailable
      ? <span title={compact && typeof sub === "string" ? sub : undefined} style={{ fontFamily: T.fontMono, fontSize: big ? T.fsL : T.fsM, fontWeight: big ? 700 : 500, color: T.textPrimary, minWidth: 0 }}>{value}</span>
      : <Unavail reason={unavailable} compact={compact} />}
    {sub && !compact && value != null && !unavailable ? <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, minWidth: 0 }}>{sub}</span> : null}
  </div>
);
/* The summary is printed on the Simple face only when BOTH sentences carry a real number —
   a sentence that begins by restating a gap the row above already named is the double-print
   the density review called out. */
const summaryIsNumeric = (summary) => Array.isArray(summary) && summary.length === 2 &&
  summary.every((s) => /\d/.test(s) && !/is unavailable|unavailable —/i.test(s));
const Stale = ({ f }) => f && f.stale
  ? <span title={f.reason || "stale"} style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 3, padding: "0 4px", marginLeft: 4 }}>STALE</span>
  : null;

const Profile = ({ c, leg, simple, rule }) => {
  const m = c.metrics || {};
  const rg = m.revenueGrowth || {}, om = m.operatingMargin || {}, fcf = m.fcf || {};
  const cap = c.marketCap || {};
  if (simple) {
    const face = spotlightFace(c, leg);
    if (!face) return null;
    return (
      <Explainable explain={spotlightExplain(c, leg)} title={c.name} eyebrow={c.symbol} className="stock-profile-trigger" style={panel(rule)}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="stock-name" style={{ fontFamily: T.fontMono, fontSize: T.fsL, fontWeight: 700, color: T.textPrimary }}>{face.name}</span>
          <span className="stock-ticker" style={{ fontFamily: T.fontMono, fontSize: T.fsS, color: T.amber, letterSpacing: "0.08em" }}>{face.symbol}</span>
          {face.stale && <Stale f={{ stale: true }} />}
        </div>
        <Row label="Market cap" compact value={cap.display} unavailable={cap.unavailable} />
        <Row label="Return this year" big compact
          value={face.ytd.value}
          unavailable={face.ytd.unavailable} />
        <Row label={face.stat.label} compact
          value={face.stat.value}
          unavailable={face.stat.unavailable} />
        <span style={{ display: "block", marginTop: 4, fontFamily: T.fontMono, fontSize: T.fsS, color: T.amber }}>Learn about this stock →</span>
      </Explainable>
    );
  }
  return (
    <div style={panel(rule)} role="group" aria-label={`${c.name} (${c.symbol}) profile`}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span className="stock-name" style={{ fontFamily: T.fontMono, fontSize: T.fsL, fontWeight: 700, color: T.textPrimary }}>{c.name}</span>
        <span className="stock-ticker" style={{ fontFamily: T.fontMono, fontSize: T.fsS, color: T.amber, letterSpacing: "0.08em" }}>{c.symbol}</span>
      </div>
      {!simple && c.blurb && <div style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.textSecondary, lineHeight: 1.35, marginBottom: 3 }}>{c.blurb}</div>}
      {/* Always visible, both modes: the market cap NUMBER and the YTD NUMBER. Degen adds the
          observation/through dates on the row; Simple keeps them in the title and explore. */}
      <Row label="Market cap" big explain={valuationExplain(c, "cap")} compact={simple} value={cap.display} unavailable={cap.unavailable}
        sub={cap.observedAt ? (simple ? `as of ${cap.observedAt}` : <>as of {cap.observedAt}{cap.method === "derived" ? " · derived" : ""}<Stale f={c.freshness && c.freshness.market} /></>) : null} />
      {simple && c.freshness && c.freshness.market && c.freshness.market.stale && cap.display && <div style={{ marginTop: -2 }}><Stale f={c.freshness.market} /></div>}
      {leg && leg.awaiting
        ? <Row label="YTD total return" big compact={simple} value="awaiting first trading close" sub={leg.unavailable || null} />
        : <Row label="YTD total return" big compact={simple}
            value={leg && typeof leg.pct === "number" ? pct(leg.pct, 2) : null}
            unavailable={leg ? (leg.unavailable || (typeof leg.pct !== "number" ? "no common trading date yet" : null)) : "return series unavailable"}
            sub={leg && leg.through ? (simple ? `through ${leg.through}` : <>through {leg.through}<Stale f={c.freshness && c.freshness.series} /></>) : null} />}
      {simple && c.freshness && c.freshness.series && c.freshness.series.stale && leg && typeof leg.pct === "number" && <div style={{ marginTop: -2 }}><Stale f={c.freshness.series} /></div>}
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0 4px" }} />
      <Row label="Revenue growth" compact={simple} value={pct(rg.pct)} unavailable={rg.unavailable} sub={rg.period ? `${rg.period} vs a year earlier` : null} />
      <Row label="Operating margin" compact={simple} value={typeof om.pct === "number" ? `${om.pct.toFixed(1)}%` : null} unavailable={om.unavailable}
        sub={typeof om.priorPct === "number" ? `from ${om.priorPct.toFixed(1)}% a year earlier` : om.period || null} />
      <Row label="Free cash flow" compact={simple} value={money(fcf.value)} unavailable={fcf.unavailable} sub={fcf.period ? `${fcf.period} · OCF − capex` : null} />
      {!simple && c.freshness && c.freshness.fundamentals &&
        <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, marginTop: 2 }}>
          {c.freshness.fundamentals.label}{c.freshness.fundamentals.period ? ` · ${c.freshness.fundamentals.period}` : ""}{c.freshness.fundamentals.form ? ` · ${c.freshness.fundamentals.form}` : ""}
        </div>}
      {c.assessment && (simple
        ? (summaryIsNumeric(c.assessment.summary)
            ? <div style={{ marginTop: 6, fontFamily: T.fontSans, fontSize: T.fsM, color: T.textPrimary, lineHeight: 1.45 }}>{c.assessment.summary.join(" ")}</div>
            : null)
        : <AssessmentFacts c={c} a={c.assessment} />)}
    </div>
  );
};
/* Simple's explore block: the dates and full reasons the flash card withheld, per company. */
const DataNotes = ({ c, leg }) => {
  const m = c.metrics || {}, cap = c.marketCap || {};
  const rg = m.revenueGrowth || {}, om = m.operatingMargin || {}, fcf = m.fcf || {};
  const gaps = [["revenue growth", m.revenueGrowth], ["operating margin", m.operatingMargin], ["free cash flow", m.fcf], ["valuation", m.valuation], ["market cap", cap]]
    .filter(([, x]) => x && x.unavailable).map(([k, x]) => `${k}: ${x.unavailable}`);
  if (leg && leg.unavailable) gaps.push(`YTD: ${leg.unavailable}`);
  return (
    <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, lineHeight: 1.5 }} role="group" aria-label={`${c.symbol} data notes`}>
      <div style={{ color: T.amber, letterSpacing: "0.1em" }}>{c.symbol} · DATES & DATA NOTES</div>
      {c.blurb && <div style={{ fontFamily: T.fontSans, color: T.textSecondary }}>{c.blurb}</div>}
      <div>{cap.display ? `market cap ${cap.display}` : "market cap: unavailable"}{cap.observedAt ? ` as of ${cap.observedAt}${cap.method === "derived" ? " (derived)" : ""}` : cap.display ? "" : ""}
        {leg && leg.through ? ` · YTD through ${leg.through}` : ""}
        {c.freshness && c.freshness.fundamentals && c.freshness.fundamentals.period ? ` · ${c.freshness.fundamentals.label} ${c.freshness.fundamentals.period}${c.freshness.fundamentals.form ? ` (${c.freshness.fundamentals.form})` : ""}` : ""}</div>
      <div>operating margin {typeof om.pct === "number" ? `${om.pct.toFixed(1)}%` : "unavailable"}{om.period ? ` · ${om.period}` : ""}</div>
      <div>free cash flow {money(fcf.value) || "unavailable"}{fcf.period ? ` · ${fcf.period}` : ""}</div>
      {c.assessment && summaryIsNumeric(c.assessment.summary) && <div style={{ fontFamily: T.fontSans, color: T.textPrimary }}>{c.assessment.summary.join(" ")}</div>}
      {gaps.map((g, i) => <div key={i} style={{ color: T.amber }}>Unavailable — {g}</div>)}
    </div>
  );
};
/* v6.9.1 READ THE ROOM Slice 2 — the FACE carries only what the rows cannot.
   Measured on the Degen face at 390: the three-question block was 330px / 139 words across the
   two companies — ~20% of every word in the widget — and it restated the labelled rows on both
   sides of itself. BUSINESS ("Revenue grew 454.3% … Operating margin widened from -76.2% to
   -6.9%") is the Revenue growth and Operating margin rows DIRECTLY ABOVE it; STOCK ("the market
   pays 52.9× … the price is above its 200-day average") is the Cap ÷ TTM revenue, Trailing P/E
   and Price trend rows of the SUPPORTING ANALYSIS panel DIRECTLY BELOW it. That is the v3.43
   Yahoo-dupe test applied to prose: a second rendering of the same facts is duplication, not
   depth. Deleted from the face, kept verbatim one tap deep (nothing is lost).
   Two things those paragraphs carried that NO row does, so they stay ON the face:
     · the next scheduled report date — nothing else on either panel carries a forward date;
     · the price-trend SUPPRESSION notice, which is an honesty fact about what was withheld
       (v6.5.0), not a restatement of a number.
   The date is read from the model's own typed `nextEarnings`, never parsed back out of the
   watchNext sentence — a display string is the wrong integrity boundary (the v4.0.3 ruling). */
const AssessmentFacts = ({ c, a }) => {
  const ne = c.nextEarnings || null;
  const date = ne && /^\d{4}-\d{2}-\d{2}$/.test(String(ne.value || "")) ? ne.value : null;
  if (!date && !(a && a.priceTrendSuppressed)) return null;
  return (
    <div style={{ marginTop: 6, fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, lineHeight: 1.5 }}
      role="group" aria-label={`${c.symbol} forward facts`}>
      <div><span style={{ color: T.textMuted, letterSpacing: "0.1em" }}>NEXT REPORT · </span>
        {date || "not on the calendar feed"}</div>
      {a && a.priceTrendSuppressed &&
        <div style={{ color: T.amber }}>Price trend not assessed — the latest expected session close is missing from the series.</div>}
    </div>
  );
};
/* The three questions in full — one tap deep in BOTH modes since v6.9.1. */
const FullAssessment = ({ a }) => (
  <div style={{ marginTop: 6, fontFamily: T.fontSans, fontSize: T.fsS, color: T.textPrimary, lineHeight: 1.45 }} role="group" aria-label="Full assessment">
    <div><span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}>BUSINESS · </span>{a.business}</div>
    <div style={{ marginTop: 3 }}><span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}>STOCK · </span>{a.stock}</div>
    <div style={{ marginTop: 3, color: T.textSecondary }}><span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}>WATCH NEXT · </span>{a.watchNext}</div>
  </div>
);

const Detail = ({ c, simple, rule }) => {
  const m = c.metrics || {};
  const v = m.valuation || {}, tr = m.trend || {}, rr = m.runRate, cash = m.cash || {}, debt = m.debt || {}, sh = m.shares || {};
  return (
    <div style={{ ...panel(rule), background: T.surfaceHigh }} role="group" aria-label={`${c.symbol} supporting analysis`}>
      <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em", marginBottom: 4 }}>{c.symbol} · SUPPORTING ANALYSIS</div>
      <Row label="Cash" value={money(cash.value)} unavailable={cash.unavailable} sub={cash.asOf ? `at ${cash.asOf}` : null} />
      <Row label="Debt" value={money(debt.value)} unavailable={debt.unavailable} sub={debt.asOf ? `at ${debt.asOf}` : null} />
      <Row label="Cap ÷ TTM revenue" explain={!simple ? valuationExplain(c, "revenue") : null} value={typeof v.capToTtmRevenue === "number" ? `${v.capToTtmRevenue.toFixed(1)}×` : null} unavailable={v.unavailable} sub={v.ttmRevenuePeriod ? `${money(v.ttmRevenue)} ${v.ttmRevenuePeriod}` : null} />
      <Row label="Trailing P/E" explain={!simple ? valuationExplain(c, "pe") : null} {...peDisplay(c)} />
      <Row label="Shares out." value={typeof sh.value === "number" ? `${(sh.value / 1e9).toFixed(3)}B` : null} unavailable={sh.unavailable} sub={sh.asOf ? `at ${sh.asOf}` : null} />
      <Row label="Price trend"
        value={typeof tr.px === "number" && typeof tr.ma200 === "number" ? `$${tr.px} · ${tr.above200 ? "above" : "below"} 200-day $${tr.ma200}${typeof tr.ma50 === "number" ? ` · 50-day $${tr.ma50}` : ""}` : null}
        unavailable={typeof tr.px === "number" && typeof tr.ma200 === "number" ? null : (tr.unavailable || "unavailable")}
        sub={tr.asOf ? `close ${tr.asOf}${tr.basis === "total_return" ? " · adjusted series" : ""}` : null} />
      {rr && <Row label="Run-rate vs TTM" value={`${money(rr.annualized)} vs ${money(rr.ttm) || "TTM unavailable"}`} sub={typeof rr.gapPct === "number" ? `latest quarter × 4 is ${pct(rr.gapPct)} vs reported TTM` : "latest quarter × 4"} />}
      {c.assessment && c.assessment.inputs && c.assessment.inputs.length > 0 && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, letterSpacing: "0.1em" }}>CALCULATION INPUTS</div>
          <ul style={{ margin: "2px 0 0", paddingLeft: 16, fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, lineHeight: 1.5 }}>
            {c.assessment.inputs.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

const Sources = ({ companies, tracker }) => (
  <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, lineHeight: 1.6 }} role="group" aria-label="Sources and calculations">
    {tracker && tracker.method && <div>YTD method: {tracker.method}.</div>}
    {tracker && tracker.baselineMismatch && <div style={{ color: T.amber }}>{tracker.baselineMismatch}</div>}
    {companies.map((c) => (
      <div key={c.symbol} style={{ marginTop: 4 }}>
        <div style={{ color: T.textSecondary }}>{c.symbol}{c.marketCap && c.marketCap.note ? ` · market cap: ${c.marketCap.note}` : ""}{c.marketCap && c.marketCap.method ? ` (${c.marketCap.method})` : ""}</div>
        {(c.sources || []).map((s, i) => (
          <div key={i}>{s.label}: <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>{s.provider || s.url}</a>
            {hostOf(s.url) ? <span style={{ color: T.textMuted }}> ({hostOf(s.url)})</span> : null}{s.form ? ` · ${s.form}` : ""}{s.filed ? ` filed ${s.filed}` : s.observedAt ? ` · ${s.observedAt}` : ""}</div>
        ))}
      </div>
    ))}
  </div>
);

const Chart = ({ tracker, syms, simple }) => {
  if (!tracker) return null;
  if (tracker.yearRollover)
    return <div style={{ padding: "6px 0", fontFamily: T.fontMono, fontSize: T.fsM, color: T.textSecondary }}>Awaiting the first {tracker.year} trading close — both lines restart at 0% from {tracker.baselineDate}.</div>;
  if (tracker.unavailable || !tracker.points || tracker.points.length === 0)
    return <div style={{ padding: "6px 0" }}><Unavail reason={tracker.unavailable || "no chart points yet"} /></div>;
  const legs = tracker.legs || {};
  const pts = tracker.points;
  const sample = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 8)) === 0 || i === pts.length - 1);
  const drawn = syms.filter((s) => legs[s] && legs[s].points !== undefined ? true : pts.some((p) => typeof p[s] === "number"));
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 2 }} aria-hidden="true">
        {syms.map((s, i) => {
          const leg = legs[s]; const k = i === 0 ? "anchor" : "comparison";
          return (
            <span key={s} style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 14, height: 0, borderTop: `2px ${LINE[k].dash ? "dashed" : "solid"} ${LINE[k].stroke}` }} />
              {s}{leg && typeof leg.pct === "number" ? ` ${pct(leg.pct, 2)}` : leg && leg.unavailable ? " — unavailable" : ""}
            </span>
          );
        })}
        {!simple && <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted }}>from {tracker.baselineDate} · through {tracker.through}</span>}
      </div>
      {tracker.partial && <div style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.amber }}>{tracker.partial}</div>}
      <div aria-hidden="true" style={{ height: 160, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pts} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            {/* The axis ticks ARE read — they are the scale the two lines are judged against —
                so they take the token floor (fs-xs 10) rather than the 8px they carried since
                v6.5.0. The tick fontFamily leak is NOT fixed here and is not claimed: recharts
                inherits the container's family today, so these render mono by inheritance, not
                by declaration. */}
            <XAxis dataKey="date" ticks={monthStarts(pts)} tickFormatter={monthTick} tick={{ fontSize: T.fsXs, fill: T.textMuted }} interval={0} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: T.fsXs, fill: T.textMuted }} width={40} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, fontSize: T.fsXs, fontFamily: T.fontMono }}
              formatter={(val, name) => [typeof val === "number" ? pct(val, 2) : "gap", name]} labelFormatter={(d) => `${d}`} />
            <ReferenceLine y={0} stroke={T.textMuted} strokeDasharray="3 3" label={{ value: "0%", fontSize: T.fsXs, fill: T.textMuted, position: "insideTopLeft" }} />
            {drawn.map((s, i) => {
              const k = syms.indexOf(s) === 0 ? "anchor" : "comparison";
              return <Line key={s} type="linear" dataKey={s} name={s} stroke={LINE[k].stroke} strokeDasharray={LINE[k].dash || undefined}
                dot={false} strokeWidth={i === 0 ? 2 : 1.6} connectNulls={false} isAnimationActive={false} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Accessible inspection: the same points, as a table, keyboard- and reader-reachable. */}
      {!simple && <details style={{ marginTop: 2 }}>
        <summary style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, cursor: "pointer", letterSpacing: "0.08em" }}>▸ INSPECT CHART VALUES (date · YTD %)</summary>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, marginTop: 4 }}>
            <thead><tr><th style={{ textAlign: "left", padding: "1px 8px 1px 0" }}>date</th>{syms.map((s) => <th key={s} style={{ textAlign: "right", padding: "1px 8px" }}>{s}</th>)}</tr></thead>
            <tbody>{sample.map((p) => (
              <tr key={p.date}><td style={{ padding: "1px 8px 1px 0" }}>{p.date}</td>
                {syms.map((s) => <td key={s} style={{ textAlign: "right", padding: "1px 8px" }}>{typeof p[s] === "number" ? pct(p[s], 2) : "—"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </details>}
    </div>
  );
};

const Lesson = ({ lesson, simple }) => {
  const body = lessonBody(lesson);
  if (!body) return null;
  const inner = (
    <div style={{ marginTop: simple ? 0 : 8, borderLeft: `2px solid ${T.amber}`, padding: "4px 10px" }} role="group" aria-label="Learning moment">
      <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em" }}>{simple ? body.title : <>LEARNING MOMENT · {body.title}</>}</div>
      <div style={{ fontFamily: T.fontSans, fontSize: simple ? T.fsL : T.fsS, color: T.textPrimary, lineHeight: 1.45, marginTop: 2 }}>{body.body}</div>
      {body.example
        ? <div aria-label="Worked example" style={{ fontFamily: T.fontSans, fontSize: T.fsL, color: T.textPrimary, marginTop: 6, lineHeight: 1.5 }}>
            {body.exampleLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        : <div style={{ fontFamily: T.fontSans, fontSize: T.fsL, color: T.amber, marginTop: 4 }}>{body.exampleUnavailable}</div>}
      {body.limitation && <div style={{ fontFamily: T.fontSans, fontSize: T.fsL, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>{body.limitation}</div>}
    </div>
  );
  if (simple) {
    return (
      <CollapsedGroup count={1} label={lessonTitle(lesson)} chip={false} promise persistKey="md:exp:spotlight-lesson:v1">
        {inner}
      </CollapsedGroup>
    );
  }
  return inner;
};

const StockSpotlight = ({ spotlight, simple }) => {
  if (!spotlight || !spotlight.enabled || !spotlight.model || !spotlight.model.pair) return null;
  const m = spotlight.model;
  const syms = [m.pair.anchor, m.pair.comparison];
  const companies = syms.map((s) => m.companies && m.companies[s]).filter(Boolean);
  if (companies.length !== 2) return null;
  const legs = (m.tracker && m.tracker.legs) || {};
  const lesson = m.lesson;
  const cad = cadenceLine(m.pair, m.businessDateServed || null);
  return (
    <div role="region" aria-label="Stock Spotlight" className="stock-spotlight"
      style={{ padding: "16px 20px", marginTop:12, background: T.bg, borderTop:`2px solid ${T.amber}66`, borderBottom: `1px solid ${T.border}` }}>
      <SectionHeader major>Stock Spotlight</SectionHeader>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textPrimary }}>{m.pair.anchor} × {m.pair.comparisonLabel} ({m.pair.comparison})</span>
        {/* v6.9.5: rendered in BOTH modes — Simple is the default, so gating the cadence to
            Degen hid it from everyone who has not switched. Degen keeps the week seed too. */}
        {cad && <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: cad.behind ? T.amber : T.textMuted }}>{cad.text}</span>}
        {!simple && <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted }}>week of {m.pair.weekKey}</span>}
        {!simple && <span style={{ marginLeft: "auto", fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 3, padding: "0 5px" }}>educational · not advice</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8 }}>
        {companies.map((c, i) => <Profile key={c.symbol} c={c} leg={legs[c.symbol]} simple={simple} rule={legColor(i)} />)}
      </div>
      {/* Simple: the learning moment comes BEFORE the chart, right after the two compact
          profiles — the widget is a lesson first (review 2026-09-13). Degen keeps chart → lesson. */}
      {simple && lesson && <Lesson lesson={lesson} simple />}
      <div style={{ ...PANEL, marginTop: 8 }} role="group" aria-label="Year-to-date comparison chart">
        <div style={{ fontFamily: T.fontMono, fontSize: T.fsS, color: T.textMuted, letterSpacing: "0.1em", marginBottom: 2 }}>{simple ? chartTitle(m.pair) : "YTD COMPARISON · total return from 0% at the prior-year close"}</div>
        <Chart tracker={m.tracker} syms={syms} simple={simple} />
      </div>
      {!simple && lesson && <Lesson lesson={lesson} simple={false} />}
      {simple ? (
        /* v6.9.2 READ THE ROOM Slice 3 — a fold is not a dumping ground (owner: "Even explore the
           numbers on simple mode is just ridiculously long… no menu just unveiled an absolute
           novel"). Measured at 390 before this pass: ONE tap here unveiled 785 words / 2,233px —
           ~2.6 phone screens and SEVEN TIMES the next biggest fold on the page (Why this call 146
           · Learning moment 69 · About this page 70). Progressive disclosure means EVERY layer is
           budgeted, not just the first; Slice 2 was right to move prose off a face and wrong to
           assume the fold it landed in had no ceiling.
           The label promises the NUMBERS, so the first level is now exactly that — the two
           supporting-analysis panels — and everything that is prose, provenance or a citation
           takes a second tap. Each second-level fold is named for what it holds, so opening one
           is a choice rather than a scroll. */
        <CollapsedGroup count={companies.length * 7} label={EXPLORE_FOLD_LABEL} chip={false} promise>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 4 }}>
            {companies.map((c, i) => <Detail key={c.symbol} c={c} simple={simple} rule={legColor(i)} />)}
          </div>
          <CollapsedGroup count={companies.length} label="dates & data notes — what each figure is dated to" chip={false}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 4 }}>
              {companies.map((c) => <DataNotes key={c.symbol} c={c} leg={legs[c.symbol]} />)}
            </div>
          </CollapsedGroup>
          <CollapsedGroup count={companies.length} label="the three questions, in full — one reading per company" chip={false}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 4 }}>
              {companies.map((c) => (
                <div key={c.symbol} style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em" }}>{c.symbol} · THE THREE QUESTIONS</div>
                  {c.assessment && <FullAssessment a={c.assessment} />}
                </div>
              ))}
            </div>
          </CollapsedGroup>
          <CollapsedGroup count={companies.reduce((n, c) => n + ((c.sources || []).length), 0)} label="sources & calculations — dated citations" chip={false}>
            <div style={{ marginTop: 4 }}><Sources companies={companies} tracker={m.tracker} /></div>
          </CollapsedGroup>
        </CollapsedGroup>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 8 }}>
            {companies.map((c, i) => <Detail key={c.symbol} c={c} simple={simple} rule={legColor(i)} />)}
          </div>
          {/* v6.9.1: the prose the face stopped duplicating, kept verbatim one tap deep. It sits
              BELOW the supporting analysis on purpose — it is a reading of the rows above it, so
              it can never be met before the numbers it describes. Its own fold, not folded into
              `sources & calculations`, because provenance and interpretation are different claims. */}
          {/* The label deliberately does NOT spell out "business · stock · watch next": those are
              the literal eyebrows inside the fold, so a summary repeating them reads as a fourth
              paragraph on the face — and it defeated this pass's own de-dup pin on first run. */}
          <CollapsedGroup count={companies.length} label="the three questions, in full — one reading per company" chip={false}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 4 }}>
              {companies.map((c) => (
                <div key={c.symbol} style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em" }}>{c.symbol} · THE THREE QUESTIONS</div>
                  {c.assessment && <FullAssessment a={c.assessment} />}
                </div>
              ))}
            </div>
          </CollapsedGroup>
          <CollapsedGroup count={companies.reduce((n, c) => n + ((c.sources || []).length), 0)} label="sources & calculations — dated citations" chip={false}>
            <Sources companies={companies} tracker={m.tracker} />
          </CollapsedGroup>
        </>
      )}
      <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, marginTop: 4 }}>
        {m.disclaimer}{m.businessDate ? ` · refreshed ${m.businessDate}` : ""}
      </div>
    </div>
  );
};
export default StockSpotlight;
