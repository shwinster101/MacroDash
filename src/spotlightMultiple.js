/* THE APPLICABLE VALUATION MULTIPLE (v7.1) — one rule, one home.
   Pure, React-free, Node-importable, and deliberately a LEAF: it imports nothing, so
   simpleFace.js and spotlightExplain.js can both read it without a cycle. `earningsEvidence`
   MOVED here from spotlightExplain.js for that reason and because this is the rule's own
   consumer; spotlightExplain re-exports it, so every existing caller and pin is untouched
   (the v6.1.0 isMacroMaterial precedent).

   THE PROBLEM. Both multiples have existed since v6.6.3 and NEITHER was ever selected. Degen
   rendered `Trailing P/E` and `Cap ÷ TTM revenue` as two unconditional rows, Simple rendered
   neither, and a reader was left to work out which one describes this company. Worse, the
   sales multiple has never been NAMED: `capToTtmRevenue` is arithmetically price-to-sales —
   equity market value over trailing revenue — and the string "P/S" appears nowhere in the
   product, so the one multiple that applies to an unprofitable company was the one a reader
   could not look up.

   ⚠ THE RULE, and the third branch is the load-bearing one (owner, 2026-09-19).
     positive TTM earnings  -> trailing P/E
     negative or zero       -> P/S, EXPLICITLY LABELLED, with the reason stated
     earnings data MISSING  -> UNAVAILABLE. Never P/S.
   That last branch is not a convenience. Falling through to P/S when earnings are absent would
   show a reader the multiple this product reserves for unprofitable companies, which asserts a
   loss nobody measured — "missing earnings evidence is not a loss", the rule spotlightExplain
   already states in the P/E sheet and which earningsEvidence was written to enforce. A missing
   PERIOD counts as missing for the same reason: a net-income figure with no period of its own
   cannot establish an earnings reference, and borrowing the revenue period would date one
   number with another's clock.

   NO CHEAP/EXPENSIVE COLOUR, in either mode (owner). Neither multiple means anything without a
   comparison this product does not make — no peer set, no history, no growth adjustment — so a
   green or red multiple would be a verdict the evidence cannot support. That is the v3.1
   invariant pointed at a valuation number, and the whole Spotlight already honours it: every
   value in the widget renders in one neutral colour. This module returns no colour at all, so
   a caller has nothing to paint with. */

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const dated = (v) => typeof v === "string" && /\d{4}-\d{2}-\d{2}/.test(v);

/* A net-income number without its OWN period cannot establish the earnings reference.
   In particular, never borrow ttmRevenuePeriod for an older cached model. */
export function earningsEvidence(c) {
  const v = c?.metrics?.valuation || {};
  if (!finite(v.ttmNetIncome)) return { state: "missing", reason: "reported net earnings unavailable" };
  if (!dated(v.ttmNetIncomePeriod)) return { state: "missing", reason: "earnings reporting period unavailable" };
  return { state: v.ttmNetIncome < 0 ? "loss" : v.ttmNetIncome === 0 ? "zero" : "profit", value: v.ttmNetIncome, period: v.ttmNetIncomePeriod };
}

export const MULTIPLE_LABELS = Object.freeze({ pe: "P/E · trailing", ps: "P/S · trailing" });
/* The sentence the owner wrote, and the one a reader needs at the exact moment the label
   changes under them. It states WHY the substitution happened, so P/S never reads as an
   arbitrary second metric. */
export const PS_REASON = "P/E isn’t meaningful because the company isn’t profitable.";

const capReady = (c) => finite(c?.marketCap?.usd) && c.marketCap.usd > 0
  && dated(c.marketCap.observedAt) && !c.marketCap.unavailable;

/* THE DATE LINE. The owner asked for "its actual reporting period and price timestamp — not a
   blanket 'live' label", and those are two different clocks that must not be merged: the
   period is the metric's own (TTM to <end>), while the cap is observed on a trading day.
   The second is NAMED for what it is rather than always called a price: marketCap.observedAt
   IS the price date when the cap was DERIVED (price × shares outstanding), and is the
   provider's own cap date otherwise. Calling a provider figure "price" would be a small
   fabricated provenance, which is the same defect class as a fabricated number. */
export function multipleDates(c) {
  const cap = c?.marketCap || {};
  return dated(cap.observedAt)
    ? { asOf: cap.observedAt, basis: cap.method === "derived" ? "price" : "cap", derived: cap.method === "derived" }
    : { asOf: null, basis: null, derived: false };
}

/* Returns the ONE multiple that applies to this company, or an honest unavailable naming the
   gap. `kind` is null exactly when nothing is shown, so a caller can never render a label with
   no number behind it. Never throws on a partial or absent model (Property 9). */
export function applicableMultiple(c) {
  const v = c?.metrics?.valuation || {};
  const e = earningsEvidence(c);
  const d = multipleDates(c);
  const base = { kind: null, label: null, value: null, period: null, asOf: d.asOf, basis: d.basis,
    derived: d.derived, reason: null, explainKind: null, unavailable: null };

  // MISSING comes first and returns before any fallback can exist. Ordering is the rule.
  if (e.state === "missing") return { ...base, unavailable: e.reason };
  if (!capReady(c)) return { ...base, unavailable: c?.marketCap?.unavailable || "dated market capitalization unavailable" };

  if (e.state === "profit") {
    if (!finite(v.trailingPe)) return { ...base, unavailable: "earnings multiple unavailable" };
    return { ...base, kind: "pe", label: MULTIPLE_LABELS.pe, value: `${v.trailingPe.toFixed(1)}×`,
      period: e.period, explainKind: "pe" };
  }
  // loss | zero -> P/S, and ONLY when the sales multiple is itself complete and dated. A P/S
  // with no period would be the same undated-reference defect the earnings branch refuses.
  if (!finite(v.capToTtmRevenue) || !finite(v.ttmRevenue) || v.ttmRevenue <= 0 || !dated(v.ttmRevenuePeriod)) {
    return { ...base, unavailable: v.unavailable || "revenue multiple unavailable", reason: PS_REASON };
  }
  return { ...base, kind: "ps", label: MULTIPLE_LABELS.ps, value: `${v.capToTtmRevenue.toFixed(1)}×`,
    period: v.ttmRevenuePeriod, reason: PS_REASON, explainKind: "ps" };
}

/* The one-line date sub a row renders beneath the multiple: the metric's own period and the
   market-cap observation, each named. Null when there is nothing dated to state. */
export function multipleSub(m) {
  if (!m) return null;
  const parts = [];
  if (m.period) parts.push(m.period);
  if (m.asOf) parts.push(`${m.basis} ${m.asOf}`);
  return parts.length ? parts.join(" · ") : null;
}
