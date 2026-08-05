// src/ttScoreRegistry.js — MacroDash v3.73 (TT-SCORE commit 2)
// PURE, React-free, token-free, Node-importable — the same convention as sources.js,
// ttReadout.js, regime.js, evidence.js and ptModel.js.
//
// THE VERSIONED ROUTE REGISTRY for the TT Underwriting Score (METHODOLOGY_VERSION lives in ttScore.js):
//   1. tt-route-v1 — the lens→route/profile mapping (§4.4). Lens is the book/UI taxonomy,
//      route is the scorer methodology; the server derives route from THIS table and a
//      client-supplied route is ignored. Unknown lens → UNMAPPED → UNSCORABLE/BLOCKED,
//      never inferred from ticker, sector, or prose.
//   2. Route-gate registry (§8, Appendix C) — every gate as a pure function with typed
//      inputs, exact boundaries (equality included), an explicit single effect, and its
//      premium-prerequisite flag. UNKNOWN never passes. Boundaries here are the generic
//      ROUTE-level methodology (the CAP_PCT/DEC-33 precedent for what may live in public
//      code); per-name falsifier content lives ONLY in KV score records, never this repo.
//
// Consumers: src/ttScore.js (gate evaluation + premium prerequisite), functions/api/score.js
// (via ttScore), test/smoke.mjs (boundary tests at −ε/boundary/+ε).
//
// ⚠ Gate boundaries were drafted from the live book's own stored evidence at the 2026-08-05
// kickoff and ship as the owner-ratifiable defaults; changing any boundary is a registry
// version bump + boundary tests (§4.3), never an in-place edit.

export const ROUTE_MAP_VERSION = "tt-route-v1";

// §4.4 verbatim. IND is a QUALITY_COMPOUNDER profile, not a sixth route.
const LENS_ROUTES = {
  AI:  { route: "AI_INFRA",           profile: null },
  PH:  { route: "PHYSICAL_AI",        profile: null },
  QC:  { route: "QUALITY_COMPOUNDER", profile: "STANDARD" },
  IND: { route: "QUALITY_COMPOUNDER", profile: "INDUSTRIAL_CYCLICAL" },
  VEH: { route: "VEHICLE",            profile: null },
  SP:  { route: "SPECULATIVE",        profile: null },
};

export function routeFor(lens) {
  const hit = LENS_ROUTES[String(lens || "").toUpperCase()];
  if (!hit) return { route: "UNMAPPED", profile: null, mapping_version: ROUTE_MAP_VERSION };
  return { route: hit.route, profile: hit.profile, mapping_version: ROUTE_MAP_VERSION };
}
export function knownLenses() { return Object.keys(LENS_ROUTES); }

/* ── gate helpers ────────────────────────────────────────────────────────────────────
   Typed inputs only: a boolean must be exactly true/false, a number finite — anything
   else reads as ABSENT, and an absent required input yields UNKNOWN (which blocks).
   No string, grade, or de-risking fraction can pass a gate (§8.1). */
const b = (v) => (v === true ? true : v === false ? false : null);
const n = (v) => (typeof v === "number" && isFinite(v) ? v : null);

/* Every entry: { id, route, profile (null = whole route), premium_prerequisite,
   effect: {kind:"TIER_CAP",tier}|{kind:"BLOCK_ADD"}|{kind:"BROKEN_THESIS"},
   cadence_days, inputs: {name: "unit/desc"}, evaluate(inp) -> "PASS"|"FAIL"|"UNKNOWN",
   constraint?(inp) -> CLUSTER_CONSTRAINT partial (§10) emitted alongside a PASS —
   sizing is WHETHER, never a tier effect (§8.2). } */
export const GATES = [
  // ── AI_INFRA ──────────────────────────────────────────────────────────────────────
  {
    id: "AI_G1_BUILDOUT", route: "AI_INFRA", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { capex_funded_12mo: "bool — next-12mo capex funded w/o new common equity", buildout_halted: "bool", milestone_within_90d: "bool — delivery/validation milestone ≤90d" },
    evaluate(i) {
      if (b(i.buildout_halted) === true || b(i.capex_funded_12mo) === false) return "FAIL";
      if (b(i.capex_funded_12mo) === true && b(i.milestone_within_90d) === true) return "PASS";
      return "UNKNOWN";
    },
  },
  {
    id: "AI_G2_CIRCULARITY", route: "AI_INFRA", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { supplier_equity_pct: "pct — equity stake held by a primary input vendor", supplier_is_primary_vendor: "bool", top_customer_backlog_pct: "pct" },
    evaluate(i) {
      const stake = n(i.supplier_equity_pct), conc = n(i.top_customer_backlog_pct), vend = b(i.supplier_is_primary_vendor);
      if (stake === null || conc === null || vend === null) return "UNKNOWN";
      const loop = stake >= 5 && vend === true;                       // ≥5 inclusive
      if (loop && conc > 70) return "FAIL";                           // >70 exclusive
      return "PASS";                                                  // loop alone → PASS + constraint
    },
    constraint(i) {
      const stake = n(i.supplier_equity_pct), vend = b(i.supplier_is_primary_vendor);
      if (stake !== null && vend === true && stake >= 5)
        return { kind: "CLUSTER_CONSTRAINT", reason: "vendor-equity loop — cluster = one position", cluster: "AI_INFRA" };
      return null;
    },
  },
  {
    id: "AI_G3_2028_BRIDGE", route: "AI_INFRA", profile: null, premium_prerequisite: true,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { ev_fy2_rev_multiple: "x — EV / FY+2 consensus revenue", fy1_fy2_growth_pct: "pct", analyst_count_fy2: "count" },
    evaluate(i) {
      const m = n(i.ev_fy2_rev_multiple), g = n(i.fy1_fy2_growth_pct), a = n(i.analyst_count_fy2);
      if (m === null || g === null || a === null) return "UNKNOWN";
      if (m > 6.0 || g < 20) return "FAIL";                           // >6.0 / <20 exclusive
      if (m <= 4.0 && g >= 40 && a >= 3) return "PASS";               // all inclusive
      return "UNKNOWN";                                               // the honest middle
    },
  },
  // ── PHYSICAL_AI ───────────────────────────────────────────────────────────────────
  {
    id: "PH_G1_CERTIFICATION", route: "PHYSICAL_AI", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { tc_achieved: "bool", for_credit_underway: "bool", dated_tc_path: "bool", program_halted: "bool" },
    evaluate(i) {
      if (b(i.program_halted) === true) return "FAIL";
      if (b(i.tc_achieved) === true) return "PASS";
      if (b(i.for_credit_underway) === true && b(i.dated_tc_path) === true) return "PASS";
      if (b(i.for_credit_underway) === null && b(i.tc_achieved) === null) return "UNKNOWN";
      return "UNKNOWN";                                               // pre-for-credit = not passable
    },
  },
  {
    id: "PH_G2_RUNWAY", route: "PHYSICAL_AI", profile: null, premium_prerequisite: false,
    effect: { kind: "BROKEN_THESIS" }, cadence_days: 90,
    inputs: { runway_months: "months — (cash+equivalents)/trailing-4q avg burn", committed_facility: "bool" },
    evaluate(i) {
      const r = n(i.runway_months);
      if (r === null) return "UNKNOWN";
      if (r < 12 && b(i.committed_facility) !== true) return "FAIL";  // <12 exclusive (12.0 passes)
      return "PASS";
    },
  },
  {
    id: "PH_G3_AUTONOMY_OWNERSHIP", route: "PHYSICAL_AI", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 365,
    inputs: { in_house_stack: "bool", competitor_dependency: "bool" },
    evaluate(i) {
      if (b(i.competitor_dependency) === true) return "FAIL";
      if (b(i.in_house_stack) === true) return "PASS";
      return "UNKNOWN";
    },
  },
  {
    // §6.1.5: the ONE spec-defined premium prerequisite — full PASS or nothing.
    id: "PH_G4_DEMONSTRABLE_ECONOMICS", route: "PHYSICAL_AI", profile: null, premium_prerequisite: true,
    effect: { kind: "TIER_CAP", tier: "C" }, cadence_days: 90,
    inputs: { msa_signed_with_price: "bool", utilization_fpd: "flights/day", utilization_days_sustained: "days", unit_revenue_disclosed: "bool", economics_negative: "bool — disclosed unit economics are negative" },
    evaluate(i) {
      if (b(i.economics_negative) === true) return "FAIL";
      if (b(i.msa_signed_with_price) === true) return "PASS";
      const fpd = n(i.utilization_fpd), days = n(i.utilization_days_sustained);
      if (fpd !== null && days !== null && fpd >= 10 && days >= 90 && b(i.unit_revenue_disclosed) === true) return "PASS";
      return "UNKNOWN";                                               // NO_EVIDENCE lives here
    },
  },
  // ── QUALITY_COMPOUNDER / STANDARD ─────────────────────────────────────────────────
  {
    id: "QC_G1_ROUTE_FIT", route: "QUALITY_COMPOUNDER", profile: "STANDARD", premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "C" }, cadence_days: 365,
    inputs: { operating_business: "bool", profitable_or_declared_path: "bool" },
    evaluate(i) {
      if (b(i.operating_business) === false) return "FAIL";
      if (b(i.operating_business) === true && b(i.profitable_or_declared_path) === true) return "PASS";
      return "UNKNOWN";
    },
  },
  {
    id: "QC_G2_UNIT_ECONOMICS", route: "QUALITY_COMPOUNDER", profile: "STANDARD", premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { profitable: "bool — GAAP or declared-adjusted, sourced", margin_deteriorating_periods: "count — consecutive" },
    evaluate(i) {
      const det = n(i.margin_deteriorating_periods);
      if (det !== null && det >= 2) return "FAIL";                    // ≥2 inclusive
      if (b(i.profitable) === true && det !== null) return "PASS";
      return "UNKNOWN";
    },
  },
  {
    id: "QC_G3_VALUATION_PREREQ", route: "QUALITY_COMPOUNDER", profile: "STANDARD", premium_prerequisite: true,
    effect: { kind: "TIER_CAP", tier: "A" }, cadence_days: 30,
    inputs: { peg_fy1: "x — fwd P/E ÷ FY+1→FY+2 EPS growth" },
    evaluate(i) {
      const peg = n(i.peg_fy1);
      if (peg === null) return "UNKNOWN";
      if (peg > 2.5) return "FAIL";                                   // >2.5 exclusive
      if (peg <= 1.5) return "PASS";                                  // ≤1.5 inclusive
      return "UNKNOWN";
    },
  },
  // ── QUALITY_COMPOUNDER / INDUSTRIAL_CYCLICAL ──────────────────────────────────────
  {
    // Encodes the book's own doctrine: "a cresting cycle earns a LOWER terminal multiple" —
    // the exact defect the MU/SNDK mechanical 18x-on-peak floors exhibited.
    id: "INDC_G1_THROUGH_CYCLE", route: "QUALITY_COMPOUNDER", profile: "INDUSTRIAL_CYCLICAL", premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { normalized_basis_documented: "bool — pt_model basis uses trough/normalized earnings" },
    evaluate(i) {
      const v = b(i.normalized_basis_documented);
      return v === true ? "PASS" : v === false ? "FAIL" : "UNKNOWN";
    },
  },
  {
    id: "INDC_G2_BACKLOG", route: "QUALITY_COMPOUNDER", profile: "INDUSTRIAL_CYCLICAL", premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { backlog_yoy_growth_pct: "pct", declining_consecutive_quarters: "count" },
    evaluate(i) {
      const d = n(i.declining_consecutive_quarters), g = n(i.backlog_yoy_growth_pct);
      if (d !== null && d >= 2) return "FAIL";
      if (g !== null && g > 0) return "PASS";
      if (g !== null && d !== null) return "PASS";                    // flat-but-not-2-down holds
      return "UNKNOWN";
    },
  },
  {
    id: "INDC_G3_SURVIVABILITY", route: "QUALITY_COMPOUNDER", profile: "INDUSTRIAL_CYCLICAL", premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { net_debt_to_equity: "x", core_loss_making: "bool" },
    evaluate(i) {
      const de = n(i.net_debt_to_equity), loss = b(i.core_loss_making);
      if (de === null || loss === null) return "UNKNOWN";
      if (de > 3 && loss === true) return "FAIL";                     // BA's current shape
      return "PASS";
    },
  },
  {
    id: "INDC_G4_VALUATION_NORM", route: "QUALITY_COMPOUNDER", profile: "INDUSTRIAL_CYCLICAL", premium_prerequisite: true,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 90,
    inputs: { premium_on_normalized: "bool — premium multiple applied to documented normalized earnings" },
    evaluate(i) {
      const v = b(i.premium_on_normalized);
      return v === true ? "PASS" : v === false ? "FAIL" : "UNKNOWN";
    },
  },
  // ── VEHICLE ───────────────────────────────────────────────────────────────────────
  {
    id: "VEH_G1_NAV", route: "VEHICLE", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 30,
    inputs: { premium_to_nav_pct: "pct" },
    evaluate(i) { const p = n(i.premium_to_nav_pct); return p === null ? "UNKNOWN" : p > 50 ? "FAIL" : "PASS"; },
  },
  {
    id: "VEH_G2_FEES", route: "VEHICLE", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 365,
    inputs: { expense_drag_pct_yr: "pct/yr" },
    evaluate(i) { const e = n(i.expense_drag_pct_yr); return e === null ? "UNKNOWN" : e > 2 ? "FAIL" : "PASS"; },
  },
  {
    // A leveraged daily-reset product is a standing HOLD — decay is structural, not cyclical.
    id: "VEH_G3_LEVERAGE_DECAY", route: "VEHICLE", profile: null, premium_prerequisite: false,
    effect: { kind: "BLOCK_ADD" }, cadence_days: 365,
    inputs: { leveraged_daily_reset: "bool" },
    evaluate(i) { const v = b(i.leveraged_daily_reset); return v === true ? "FAIL" : v === false ? "PASS" : "UNKNOWN"; },
  },
  {
    id: "VEH_G4_SIZING", route: "VEHICLE", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 365,
    inputs: { route_sizing_limit_pct: "pct — owner policy cap for vehicle exposure" },
    evaluate(i) { return n(i.route_sizing_limit_pct) === null ? "UNKNOWN" : "PASS"; },
    constraint(i) {
      const lim = n(i.route_sizing_limit_pct);
      return lim === null ? null : { kind: "CLUSTER_CONSTRAINT", reason: "vehicle route sizing cap", cluster: "VEHICLE", limit_pct: lim };
    },
  },
  // ── SPECULATIVE ───────────────────────────────────────────────────────────────────
  {
    id: "SP_G1_DEMONSTRABLE_ECONOMICS", route: "SPECULATIVE", profile: null, premium_prerequisite: true,
    effect: { kind: "TIER_CAP", tier: "C" }, cadence_days: 90,
    inputs: { unit_economics_positive_evidence: "bool" },
    evaluate(i) {
      const v = b(i.unit_economics_positive_evidence);
      return v === true ? "PASS" : v === false ? "FAIL" : "UNKNOWN";
    },
  },
  {
    id: "SP_G2_RUNWAY", route: "SPECULATIVE", profile: null, premium_prerequisite: false,
    effect: { kind: "BROKEN_THESIS" }, cadence_days: 90,
    inputs: { runway_months: "months", committed_facility: "bool" },
    evaluate(i) {
      const r = n(i.runway_months);
      if (r === null) return "UNKNOWN";
      if (r < 12 && b(i.committed_facility) !== true) return "FAIL";
      return "PASS";
    },
  },
  {
    id: "SP_G3_OPTIONALITY_CAP", route: "SPECULATIVE", profile: null, premium_prerequisite: false,
    effect: { kind: "TIER_CAP", tier: "B" }, cadence_days: 365,
    inputs: { optionality_limit_pct: "pct — owner policy cap, default proposal 2" },
    evaluate(i) { return n(i.optionality_limit_pct) === null ? "UNKNOWN" : "PASS"; },
    constraint(i) {
      const lim = n(i.optionality_limit_pct);
      return lim === null ? null : { kind: "CLUSTER_CONSTRAINT", reason: "speculative optionality cap", cluster: "SPECULATIVE", limit_pct: lim };
    },
  },
  // ── GLOBAL broken-thesis checks (every route; §Appendix C) ────────────────────────
  // Event-driven booleans the owner asserts explicitly each cycle: true = the event
  // occurred (FAIL→AVOID), false = affirmed absent (PASS), missing = UNKNOWN (blocks —
  // "no assumed pass"). One record, six keys, part of underwriting_inputs.route_gates.
  ...["GLOBAL_GUIDANCE_WITHDRAWN", "GLOBAL_CUSTOMER_LOSS", "GLOBAL_RESTATEMENT",
      "GLOBAL_KEY_PERSON_EXIT", "GLOBAL_MOAT_INVALIDATION", "GLOBAL_LOOP_UNWIND"].map((id) => ({
    id, route: "*", profile: null, premium_prerequisite: false,
    effect: { kind: "BROKEN_THESIS" }, cadence_days: 90,
    inputs: { occurred: "bool — explicitly affirmed each cycle" },
    evaluate(i) { const v = b(i.occurred); return v === true ? "FAIL" : v === false ? "PASS" : "UNKNOWN"; },
  })),
];

/* Gates applicable to a resolved route/profile: route-specific (profile match when the gate
   declares one) plus every global. Order is registry order; precedence is the engine's job
   and must be order-independent (§16). */
export function gatesFor(route, profile) {
  return GATES.filter((g) =>
    g.route === "*" ||
    (g.route === route && (g.profile === null || g.profile === (profile || null))));
}
export function premiumPrerequisiteFor(route, profile) {
  return gatesFor(route, profile).find((g) => g.premium_prerequisite) || null;
}
