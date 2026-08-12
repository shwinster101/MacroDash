// ─── AI UNIT ECONOMICS — CURATED DATA + SCISSORS MATH (wave 12, task 7.1) ───
// Moved VERBATIM from dashboard.jsx. Pure, no React — Node-importable, so smoke
// IMPORTS tokenScissors/TOKEN_EFFICIENCY and RUNS them (the v3.60 convention)
// instead of source-lifting. The section component renders these; edits to the
// curated figures happen HERE.
// GPU ON-DEMAND LIST PRICING — leading indicator for the AI margin-compression hinge.
// Curated/Manual, updated QUARTERLY: there is no free live feed for neocloud/hyperscaler
// on-demand $/GPU-hr, and published rates reprice on a quarterly cadence, not daily. This
// is the cleanest EXTERNAL read on AI-infra pricing power — visible before it shows up in
// hyperscaler earnings. Falling $/hr ⇒ eroding pricing power ⇒ margin compression (ties to
// the "AI CapEx ROI Gap" headwind). ⚠️ Update `onDemand`/`prevQ`/`trend` each quarter.
export const GPU_PRICING = {
  quarter: "Q2 2026",
  chips: [
    { name: "H200",  onDemand: 3.10, prevQ: 3.40 }, // Hopper refresh — most liquid market
    { name: "B200",  onDemand: 5.40, prevQ: 5.70 }, // Blackwell — repricing as supply lands
    { name: "GB300", onDemand: 7.20, prevQ: 7.20 }, // Grace-Blackwell Ultra — newest, still scarce
  ],
  // Blended on-demand index, oldest→newest (quarterly) — the decline IS the signal.
  trend: [6.80, 6.10, 5.50, 5.20, 5.00, 4.90],
  note: "Falling on-demand $/hr = eroding AI-infra pricing power → the margin-compression hinge, visible before earnings.",
};

// FEAT-CAPEX (v3.45) — hyperscaler capex tape: the FUNDING FLOW leg of AI unit economics.
// GPU $/hr is the supply cost, token $/Mtok the demand price; this is the pipe that pays for
// both. Curated at each print (guidance has no $0 live source); `dir` is the revision
// direction vs the prior guide — the number the market actually trades. ⚠ CURATED — figures
// are placeholders to review at each print; the reviewed date is the honesty stamp.
// FEAT-TOKW (v3.46) — TOKENS/WATT: the CONVERSION leg of AI unit economics.
//
// FIRST PRINCIPLES. Power is the binding CONSTRAINT, not the dominant cost: a ~1kW accelerator
// costing ~$40k burns roughly $1.5k of electricity over three years at industrial rates, so
// depreciation dominates energy ~25:1. Tokens/watt matters because MW ALLOCATIONS are the input
// that cannot be bought on demand — grid interconnect, not capital, gates a neocloud's capacity.
// It is therefore a CAPACITY-PRODUCTIVITY metric: how much sellable output a fixed, hard-to-
// expand power envelope yields.
//
// THE IDENTITY:  revenue per MW  ∝  (tokens per watt) × ($ per token)
// In growth terms the two rates COMPOSE: (1+efficiency%) × (1+price%) − 1. That product is the
// only part of this that is honestly sourceable — the absolute levels are not. Published
// tokens/watt swings 10-50x on model size, batch depth, quantization and GPU-only-vs-PUE, and
// $/Mtok is RETAIL api pricing carrying the model provider's margin, not a neocloud's wholesale
// realization. Both scale factors CANCEL in the ratio, so the index is defensible where a
// dollar figure would be confidently wrong. Hence: stored as a RELATIVE INDEX, and this card is
// forbidden by construction from ever printing a $/MW figure (smoke-pinned).
//
// WHY IT EARNS SCREEN SPACE: utilization underwriting answers "will the capacity sell?" It
// cannot answer "is a sold MW worth less than last year?" A fully-utilized neocloud can still
// see revenue per MW compress — the margin-compression hinge arriving through the physical
// layer rather than the P&L. ⚠ CURATED, relative: review at each chip-generation step.
export const TOKEN_EFFICIENCY = {
  basis: "system-level tokens/W, relative index (H100 generation = 1.00)",
  reviewed: "2026-07-30",
  // oldest→newest; `at` dates the generation's volume availability, not its announcement.
  gens: [
    { gen: "H100",  at: "2023-06-30", idx: 1.00 },
    { gen: "H200",  at: "2024-06-30", idx: 1.40 },
    { gen: "B200",  at: "2025-06-30", idx: 3.00 },
    { gen: "GB300", at: "2026-06-30", idx: 4.50 },
  ],
  // THE WINDOW IS NEVER ANNUALISED. The rolling $/Mtok series is ~12 weekly points at most, and
  // raising a 12-week move to the 52/11 power turns a −35% drift into −98.8%/yr — a number that
  // is arithmetically correct and economically absurd, the same units error DEC-D2 removed from
  // sellRank. So the EFFICIENCY CAGR (multi-year, robust) is instead projected DOWN onto the
  // price window's own span, and the scissors is reported over that observed span, stated.
  minWeeks: 8,      // below this the window is noise; the band is withheld, not guessed.
  deadbandPct: 5,   // % move over the OBSERVED window — measurement noise, not an economic line.
  note: "Efficiency vs price: if $/Mtok falls faster than tokens/W improves, revenue per MW compresses EVEN AT FULL UTILIZATION — the neocloud risk utilization alone cannot see.",
};

// Compose the two rates into the scissors. Pure, and deliberately returns NO dollar figure.
// `trend` is the live rolling $/Mtok series (weekly cadence, values only — the emitted field
// drops its dates), so its span is inferred from the point count and STATED on the card.
//
// Returns: effCagr (%/yr, the durable multi-year rate) · effWin/pxWin (both over the SAME
// observed window) · idx (the composite over that window) · weeks · band. Comparing a rate to
// a window move would be the units error; both legs are always in window terms.
export function tokenScissors(trend) {
  const g = TOKEN_EFFICIENCY.gens;
  const yrs = (a, b) => (Date.parse(b) - Date.parse(a)) / (365.25 * 86400000);
  const effYrsSpan = yrs(g[0].at, g[g.length - 1].at);
  const effCagr = (effYrsSpan > 0 && g[0].idx > 0 && g[g.length - 1].idx > 0)
    ? Math.pow(g[g.length - 1].idx / g[0].idx, 1 / effYrsSpan) - 1 : null;
  const t = Array.isArray(trend) ? trend.filter(v => Number.isFinite(v) && v > 0) : [];
  // Weekly cadence (CADENCE.tokenTrend), so n points span (n-1) weeks.
  const weeks = t.length >= 2 ? t.length - 1 : null;
  const none = { effCagr, effWin: null, pxWin: null, idx: null, weeks, band: null };
  if (effCagr === null || weeks === null) return none;
  const pxWin = t[t.length - 1] / t[0] - 1;                       // observed, never annualised
  const effWin = Math.pow(1 + effCagr, weeks / 52) - 1;           // CAGR projected onto that span
  const idx = (1 + effWin) * (1 + pxWin) - 1;
  if (weeks < TOKEN_EFFICIENCY.minWeeks) return { ...none, effWin, pxWin, idx, short: true };
  const dbd = TOKEN_EFFICIENCY.deadbandPct / 100;
  return { effCagr, effWin, pxWin, idx, weeks, short: false,
    band: idx > dbd ? "EXPANDING" : idx < -dbd ? "COMPRESSING" : "FLAT" };
}

export const HYPERSCALER_CAPEX = {
  fy: "FY26", reviewed: "2026-08-12",
  rows: [
    { co: "AMZN",  guideB: 220,   dir: "up" },   // raised 200→~220 at Q2 print 2026-07-30 (memory costs)
    { co: "GOOGL", guideB: 200,   dir: "up" },   // 195–205 mid, 3rd raise of 2026 (2026-07-22)
    { co: "META",  guideB: 137.5, dir: "up" },   // 130–145 mid, 2nd raise (2026-07-29)
    { co: "MSFT",  guideB: 257.5, dir: "up" },   // FY27 guide (Jul-26→Jun-27) 255–260 mid — see note
  ],
  note: "Big-4 guided capex — the pool that funds every AI-infra beneficiary's revenue. ≥2 guiding down = the regime-turn tell. All four RAISED at the Jul-26 Q2 prints. MSFT is its FY27 fiscal guide (Jul-26→Jun-27) — MSFT guides fiscal, not calendar (cal-26 ≈ $190B is an analyst estimate, not a guide), so the aggregate mixes windows and overstates calendar 2026.",
};

