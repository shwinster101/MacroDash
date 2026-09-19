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
/* v7.3 — THE SECOND CAUSE, and it is a DIFFERENT sentence on purpose. A company can be net
   profitable and still have an earnings line the business did not produce, and printing
   PS_REASON there would tell a reader NBIS "isn't profitable" when its TTM net income is
   +$115.1M — a fabricated cause, the same defect class as a fabricated number (the v7.2
   five-naming-sites rule, one surface over). Same shape as PS_REASON so the two read as one
   vocabulary. */
export const PS_REASON_NONOPERATING = "P/E isn’t meaningful because the profit isn’t from operations.";

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

/* v7.3 — IS THE TRAILING PROFIT PRODUCED BY THE BUSINESS? (owner, 2026-09-19: "stop dividing
   by a broken denominator"). v7.1 tested the SIGN of TTM earnings, which is not the same claim
   as "this company earns" — the v3.47 LENS lint learned exactly this one engine over, and the
   public selector never did. Measured on the live model the day it was reported: NBIS carried
   TTM net income +$115.1M against operating income of −$175.9M for the quarter, so the
   denominator was non-operating (stake and divestiture gains) and the row printed 514.9×.

   TWO BASES, PREFERRED IN ORDER, AND THE BASIS IS NAMED RATHER THAN ASSUMED.
     1. TTM operating income — the SAME window as the net line the P/E divides by, so the
        comparison is apples to apples. Added to the model in this release.
     2. The latest QUARTER's operating margin — already on the model, so the gate works on a
        record written before this release (the v5.1.1 rule: an additive field nobody has
        written yet must not blank a working surface). It is a different window from the net
        line, which is a real mismatch, so the basis rides on the result and the caller states it.
     3. Neither -> UNKNOWN, and the P/E still renders. ⚠ THIS IS THE HONEST LIMIT, recorded
        rather than papered over: a company whose operating line is unavailable can still show
        a pathological P/E. The alternative — withholding the multiple on evidence we do not
        have, or calling the profit non-operating — would assert something nobody measured,
        which is the rule the MISSING branch above already follows ("missing earnings evidence
        is not a loss", so missing operating evidence is not a non-operating profit).

   ⚠ NO MAGNITUDE ARM. Owner ruling 2026-09-19, taken against a measured roster: a P/E > 80
   gate would also demote TSLA at 338.4×, which earns from operations and is simply expensive.
   Suppressing a real 338× and printing ~7× P/S in its place would make the most expensive name
   on the roster read CHEAPER than it is — the opposite of the defect being fixed. Magnitude is
   the market's opinion; this gate is about whether the denominator is a measurement. */
export function operatingEvidence(c) {
  const v = c?.metrics?.valuation || {};
  if (finite(v.ttmOperatingIncome) && dated(v.ttmOperatingIncomePeriod)) {
    return { state: v.ttmOperatingIncome > 0 ? "operating" : "nonoperating", basis: "ttm",
      period: v.ttmOperatingIncomePeriod, value: v.ttmOperatingIncome, reason: null };
  }
  const om = c?.metrics?.operatingMargin || {};
  if (finite(om.pct) && dated(om.period)) {
    return { state: om.pct > 0 ? "operating" : "nonoperating", basis: "quarter",
      period: om.period, value: om.pct, reason: null };
  }
  return { state: "unknown", basis: null, period: null, value: null,
    reason: om.unavailable || "operating income unavailable" };
}

/* ONE home for which sentence a P/S row carries, so the row and its explainer sheet can never
   state different causes for the same substitution (the v6.3.0 identity rule, applied to copy
   rather than to an object). */
export function psReasonFor(c) {
  const e = earningsEvidence(c);
  if (e.state === "loss" || e.state === "zero") return PS_REASON;
  if (e.state === "profit" && operatingEvidence(c).state === "nonoperating") return PS_REASON_NONOPERATING;
  return null;
}

/* Returns the ONE multiple that applies to this company, or an honest unavailable naming the
   gap. `kind` is null exactly when nothing is shown, so a caller can never render a label with
   no number behind it. Never throws on a partial or absent model (Property 9). */
export function applicableMultiple(c) {
  const v = c?.metrics?.valuation || {};
  const e = earningsEvidence(c);
  const d = multipleDates(c);
  const base = { kind: null, label: null, value: null, period: null, asOf: d.asOf, basis: d.basis,
    derived: d.derived, reason: null, explainKind: null, unavailable: null, operatingBasis: null };

  /* The sales multiple, built ONCE and reached from two different causes. Two constructions
     would be two copies waiting to disagree about what a complete P/S is. ONLY when the sales
     multiple is itself complete and dated: a P/S with no period would be the same
     undated-reference defect the earnings branch refuses. */
  const sales = (reason, operatingBasis) => (
    !finite(v.capToTtmRevenue) || !finite(v.ttmRevenue) || v.ttmRevenue <= 0 || !dated(v.ttmRevenuePeriod)
      ? { ...base, unavailable: v.unavailable || "revenue multiple unavailable", reason, operatingBasis }
      : { ...base, kind: "ps", label: MULTIPLE_LABELS.ps, value: `${v.capToTtmRevenue.toFixed(1)}×`,
        period: v.ttmRevenuePeriod, reason, explainKind: "ps", operatingBasis });

  // MISSING comes first and returns before any fallback can exist. Ordering is the rule.
  if (e.state === "missing") return { ...base, unavailable: e.reason };
  if (!capReady(c)) return { ...base, unavailable: c?.marketCap?.unavailable || "dated market capitalization unavailable" };

  if (e.state === "profit") {
    const o = operatingEvidence(c);
    // Net profitable, but not FROM the business -> the earnings multiple has no denominator
    // worth dividing by. UNKNOWN deliberately falls through to P/E (see the limit above).
    if (o.state === "nonoperating") return sales(PS_REASON_NONOPERATING, o.basis);
    if (!finite(v.trailingPe)) return { ...base, unavailable: "earnings multiple unavailable" };
    return { ...base, kind: "pe", label: MULTIPLE_LABELS.pe, value: `${v.trailingPe.toFixed(1)}×`,
      period: e.period, explainKind: "pe", operatingBasis: o.basis };
  }
  return sales(PS_REASON, null); // loss | zero
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
