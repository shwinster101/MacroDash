// ─── FEAT-SAHM (v3.84): the Sahm rule, pure ─────────────────────────────────
// Claudia Sahm's recession indicator: the 3-month average of the U-3 unemployment
// rate, minus the MINIMUM of that same 3-month average over the prior 12 months.
// A reading of 0.50pp OR MORE has marked the start of every US recession since
// 1970 with no false positives in real time. The trigger is a CITATION (Sahm's
// own printed definition), not a fitted threshold — unlike the NFCI deadband,
// there is nothing here to calibrate.
//
// One home for the math and the trigger: functions/api/snapshot.js computes the
// value at the edge (this module rides the proven functions/→src/ esbuild-inline
// path readout.json.js established), src/sections/MacroRegime.jsx renders the
// verdict against the SAME constant, and smoke imports and RUNS both. No React.
//
// Convention note: computed from the same UNRATE pull the dashboard already
// makes, so it can differ from FRED's SAHMREALTIME series by ±0.01 (rounding,
// vintage revisions). Stated here rather than hidden; deriving beats pulling a
// 20th series that restates 15 points we already hold.

export const SAHM_TRIGGER = 0.5;

// vals: monthly U-3 readings, NEWEST FIRST (the snapshot fetcher's native order,
// sort_order=desc). Needs 15 points: 3 for the current average plus 12 prior
// months of rolling averages to take the minimum over. Fewer → null (fail
// closed: "cannot compute" must never read as 0.00 = maximally clear).
export function sahmFrom(vals) {
  if (!Array.isArray(vals)) return null;
  const v = vals.filter((x) => Number.isFinite(x));
  if (v.length < 15) return null;
  const avg3 = (i) => (v[i] + v[i + 1] + v[i + 2]) / 3;   // 3-mo avg ending at month i
  const current = avg3(0);
  let min = Infinity;
  for (let m = 1; m <= 12; m++) min = Math.min(min, avg3(m));
  return parseFloat((current - min).toFixed(2));
}
