/* MacroDash v7.1.5 — the year-over-year derivation for every price-index series,
   paired by CALENDAR MONTH rather than by array position.

   THE DEFECT THIS CLOSES, and it lived inside a VOTE. `functions/api/snapshot.js` derived
   CPI/PCE year-over-year as `obs[m] / obs[m + 12]` — twelve ROWS back, not twelve MONTHS
   back — and never read either observation's `date`. It was correct only because the caller
   pre-filters `o.value !== "."`, so ANY month BLS suppresses is silently dropped and the
   array closes ranks: "12 months prior" quietly becomes "13 months prior", with no error,
   no symptom and no tell. Three consequences, all inside the backdrop's inflation voter:
     1. the pairing can compare the wrong months;
     2. the trend loop dropped every non-finite point SILENTLY, so the array shortened and
        `t[0]` — the anchor the CPI vote's drift arm reads — became a different month;
     3. nothing pinned the derivation at all: `(a / b - 1) * 100` was untested.

   THE RULE IS REFUSE, NEVER SUBSTITUTE (v4.1.4). A month whose own twelve-months-earlier
   observation is absent yields NO value and is NAMED in `holes`; it is never quietly paired
   against the nearest row that happens to be there. A hole is a fact about coverage, and the
   caller records it as evidence rather than letting it vanish into a shorter array.

   The module is pure and Node-importable (the src/sahm.js precedent — FRED-derived math has
   one home and is testable without the Functions graph). The month arithmetic itself is
   imported from src/sources.js, which owns every date judgement in this stack: the YoY
   pairing and the release-aware freshness gate MUST agree about what a month is. */
import { monthKey, monthsBefore } from "./sources.js";

// Six points, the length every consumer already reads (`cpiTrend`, `pceTrend`, the chart and
// the voter sheet's trend-window start). Not a threshold — a display/lookback length.
export const YOY_TREND_POINTS = 6;

/* Derive YoY % from a monthly price-index series.
   `obs` is FRED's own newest-first observation list ({date, value}); the caller may have
   filtered suppressed rows out already, in which case the missing month simply has no key —
   which is exactly the state that must REFUSE rather than shift.
   Returns { yoy, period, asOf, trend, holes, points }:
     yoy    — the newest computable YoY, or null (never NaN dressed as a number)
     period — its reference month, "YYYY-MM"
     asOf   — that observation's own date, the value the snapshot stamps as <field>AsOf
     trend  — oldest→newest finite YoY values, for the chart and the voter's drift arm
     holes  — the months that could NOT be paired, each naming the month it needed */
export function yoyFromObservations(obs, { points = YOY_TREND_POINTS } = {}) {
  const byMonth = new Map();
  for (const o of Array.isArray(obs) ? obs : []) {
    const k = monthKey(o && o.date);
    if (!k || byMonth.has(k)) continue;   // FRED serves newest-first; the first row for a period wins
    const v = parseFloat(o && o.value);
    byMonth.set(k, { value: Number.isFinite(v) ? v : null, date: String(o.date) });
  }
  const periods = [...byMonth.keys()].sort().reverse();   // newest first
  const rows = [];
  for (const period of periods) {
    if (rows.length >= points) break;
    const cur = byMonth.get(period);
    if (!Number.isFinite(cur.value)) continue;  // a suppressed month is not a period we can report
    const priorPeriod = monthsBefore(period, 12);
    const prior = priorPeriod ? byMonth.get(priorPeriod) : null;
    // b > 0 guards the ratio: a price index is positive by construction, so a zero or
    // negative base is a malformed row, not a deflation reading.
    const paired = !!prior && Number.isFinite(prior.value) && prior.value > 0;
    rows.push({
      period, priorPeriod, date: cur.date, paired,
      value: paired ? parseFloat(((cur.value / prior.value - 1) * 100).toFixed(1)) : null,
    });
  }
  rows.reverse();   // oldest → newest, the order every consumer reads
  const newest = rows.length ? rows[rows.length - 1] : null;
  return {
    yoy: newest && newest.value !== null ? newest.value : null,
    period: newest ? newest.period : null,
    asOf: newest ? newest.date : null,
    trend: rows.filter((r) => r.value !== null).map((r) => r.value),
    holes: rows.filter((r) => r.value === null).map((r) => `${r.period} (needs ${r.priorPeriod || "an unparseable month"})`),
    points: rows.length,
  };
}
