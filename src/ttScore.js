// src/ttScore.js — MacroDash v3.73 (TT-SCORE commit 2)
// PURE, React-free, token-free, Node-importable — the same convention as sources.js,
// ttReadout.js, regime.js, evidence.js and ptModel.js.
//
// THE TT UNDERWRITING SCORE ENGINE (tt-underwriting-v2.3.0): four evidence-typed pillars
// at fixed 25% weights → raw score/tier; route gates (via ttScoreRegistry.js) → capped
// tier; actionability rollup; eligibility; outcome memory; canonical input hashing.
// The SERVER computes — functions/api/score.js imports this and is authoritative; the
// buildless admin client only ever renders what the server returned (§5.2: no
// floating-point acceptance loophole, 409 on any client-computed divergence >0.01).
//
// Doctrine encoded here, not just documented:
//   · No missing pillar is neutralized, omitted, or reweighted — all four or UNSCORABLE.
//   · Evidence state and score are orthogonal (§7): DERIVED/OWNER_ASSERTED move
//     actionability, never the number. Duration (P2) is the ONE deliberate exception.
//   · Momentum is nowhere in this file's pillar math — execution is WHEN, not WHAT.
//   · A premium valuation is never scored when its prerequisite gate is not PASS; a
//     pre-profit name with no floor is NO_FLOOR_PREPROFIT, never a manufactured number.
//   · UNKNOWN never passes anything. Missing is never 5.
//
// ⚠ This engine will gate real orders after activation (§14.8). Every anchor, boundary
// and precedence rule below carries smoke coverage at −ε/boundary/+ε; changing any of
// them is a methodology version bump (§4.3), never an in-place edit.

import { ptModelRows, lintPtModel, pickRow } from "./ptModel.js";
import { routeFor, gatesFor, premiumPrerequisiteFor, ROUTE_MAP_VERSION } from "./ttScoreRegistry.js";

export const METHODOLOGY_VERSION = "tt-underwriting-v2.3.0";
export const GATE_NORMALIZATION_VERSION = "tt-gate-normalization-v1";

/* ═══════════ §5.1 piecewise — the ONE numerical map ═══════════ */
export function piecewise(x, anchors) {
  if (typeof x !== "number" || !isFinite(x)) return null;
  const a = [...anchors].sort((p, q) => p[0] - q[0]);
  if (x <= a[0][0]) return clamp10(a[0][1]);
  if (x >= a[a.length - 1][0]) return clamp10(a[a.length - 1][1]);
  for (let i = 0; i < a.length - 1; i++) {
    const [x0, y0] = a[i], [x1, y1] = a[i + 1];
    if (x >= x0 && x <= x1) return clamp10(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return null;
}
const clamp10 = (v) => Math.min(10, Math.max(0, v));
const round2 = (v) => Math.round(v * 100) / 100;

/* Anchor tables — spec §6, verbatim. */
export const ANCHORS = {
  P1_RETURN:   [[-30, 0], [0, 3], [10, 5], [25, 7], [50, 9], [100, 10]],
  REV_CAGR:    [[-20, 0], [0, 2], [5, 4], [15, 7], [30, 9], [50, 10]],
  EARN_CAGR:   [[-20, 0], [0, 3], [10, 5], [20, 7], [35, 9], [50, 10]],
  OP_MARGIN:   [[-10, 0], [0, 2], [5, 4], [10, 6], [20, 8], [30, 9], [40, 10]],
  MARGIN_DIR:  [[-5, 0], [-2, 2], [0, 5], [2, 7], [5, 9], [10, 10]],
  FCF_MARGIN:  [[-10, 0], [0, 3], [5, 5], [10, 7], [20, 9], [30, 10]],
  ROIC:        [[0, 2], [5, 4], [10, 6], [15, 8], [25, 10]],
  ROE:         [[0, 2], [8, 4], [12, 6], [18, 8], [25, 10]],
  RUNWAY_MO:   [[0, 0], [6, 1], [12, 3], [18, 5], [24, 7], [36, 9], [48, 10]],
};
export const DURATION_SCORE = (years) => (years >= 4 ? 10.0 : years === 3 ? 7.5 : years === 2 ? 5.0 : null);

/* ═══════════ §5.3 dates, age, freshness ═══════════ */
export function etDateOf(nowMs) {
  return new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
export function ageDaysET(asOf, etToday) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return null;
  const d = Math.round((Date.parse(etToday + "T12:00:00Z") - Date.parse(asOf + "T12:00:00Z")) / 86400000);
  return d;
}
export function freshnessOf(asOf, cadenceDays, etToday) {
  const age = ageDaysET(asOf, etToday);
  if (age === null || age < 0) return "INVALID";          // missing/malformed/future-dated
  if (age <= cadenceDays) return "CURRENT";
  if (age <= 2 * cadenceDays) return "AGING";
  return "STALE";
}
const SOURCE_KINDS = ["MARKET", "PRIMARY", "CONSENSUS", "COMPANY_GUIDANCE", "OWNER_ASSERTED"];
export function validateAtomic(rec, { etToday, nowMs, allowOwnerAsserted = false } = {}) {
  if (!rec || typeof rec !== "object") return "missing record";
  if (typeof rec.value !== "number" || !isFinite(rec.value)) {
    if (typeof rec.value === "string" && rec.value.trim() !== "" && isFinite(Number(rec.value)))
      return "numeric string — \"" + rec.value + "\" is not " + Number(rec.value);
    return "value not a finite number";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rec.as_of || ""))) return "as_of missing/malformed";
  if (etToday && rec.as_of > etToday) return "as_of after the scoring ET date";
  if (rec.observed_at != null) {
    const t = Date.parse(rec.observed_at);
    if (!isFinite(t)) return "observed_at malformed";
    if (nowMs != null && t > nowMs + 5 * 60000) return "observed_at more than five minutes in the future";
  }
  const k = rec.source && rec.source.kind;
  if (!SOURCE_KINDS.includes(k)) return "source.kind must be one of " + SOURCE_KINDS.join("|");
  if (k === "OWNER_ASSERTED" && !allowOwnerAsserted) return "OWNER_ASSERTED not permitted for this input";
  if (k === "DERIVED") return "DERIVED is an evidence state, not a source kind";
  return null;
}

/* ═══════════ §8.1 legacy gate-vocabulary normalization ═══════════ */
export function normalizeLegacyGateState(raw, typedResult) {
  const s = String(raw == null ? "" : raw).trim();
  const out = (state, note) => ({
    state, raw_state: s || null, normalization_version: GATE_NORMALIZATION_VERSION,
    ...(note ? { note } : {}),
  });
  // After a gate is encoded, typed inputs win and the legacy string is historical context.
  if (typedResult === "PASS" || typedResult === "FAIL" || typedResult === "UNKNOWN")
    return out(typedResult, s ? "legacy label retained as context" : undefined);
  const U = s.toUpperCase();
  if (U === "PASS") return out("PASS");
  if (U === "FAIL") return out("FAIL");
  if (U === "PASS-WITH-NOTE") return out("PASS", "original note carried to warnings; self-attested during migration");
  if (["NO_EVIDENCE", "NOT_STARTED", "UNEVIDENCED", "EARLY", "IN_PROGRESS", "DEMANDING-BUT-CREDIBLE", "UNKNOWN"].includes(U))
    return out("UNKNOWN");
  if (U === "MARGINAL" || /^PARTIAL/.test(U))
    return out("UNKNOWN", "string alone never passes; typed inputs may independently meet a registry boundary");
  if (U === "FLAG")
    return out("UNKNOWN", "untyped FLAG — a typed cluster/sizing limit routes to §10, a bare FLAG cannot pass");
  // No label normalization may manufacture FAIL — unrecognized fails CLOSED to UNKNOWN, logged.
  return out("UNKNOWN", "unrecognized legacy label \"" + s + "\" — fail closed");
}

/* ═══════════ P1 — Owner Valuation Underwriting (§6.1) ═══════════ */
export function scoreP1({ dd, horizon, price, premiumGateState, etToday, nowMs }) {
  const res = { pillar: "owner_valuation", score: null, basis_used: "NONE", blockers: [], warnings: [],
    annualized_return_pct: null, target: null, target_year: null, rolled_from: null,
    premium_prerequisite_state: premiumGateState || "UNKNOWN" };
  const lints = lintPtModel(dd, etToday ? etToday.slice(0, 4) : undefined);
  if (lints.some((l) => l.sev === "error")) {
    res.blockers.push("hard model lint: " + lints.filter((l) => l.sev === "error").map((l) => l.code).join("/"));
    return res;
  }
  if (!price || typeof price.px !== "number" || !(price.px > 0)) { res.blockers.push("no usable price"); return res; }
  const pxAge = price.live ? 0 : ageDaysET(price.at, etToday);
  if (pxAge === null || pxAge > 4) { res.blockers.push("price mark older than 4 calendar days"); return res; }
  const rr = ptModelRows(dd, etToday ? etToday.slice(0, 4) : undefined)
    .filter((r) => typeof r.prem === "number" || typeof r.fl === "number");
  if (!rr.length) { res.blockers.push("no computable model row"); return res; }
  const pk = pickRow(rr, horizon || null, nowMs);
  if (!pk) { res.blockers.push("no row at the shared horizon — never substituted"); return res; }
  res.rolled_from = pk.rolled;
  const row = pk.row;
  // Premium only on prerequisite PASS; otherwise the floor; no floor → NO_FLOOR_PREPROFIT.
  let target = null;
  if (premiumGateState === "PASS" && typeof row.prem === "number") { target = row.prem; res.basis_used = "PREMIUM"; }
  else if (typeof row.fl === "number") {
    target = row.fl; res.basis_used = "FLOOR";
    if (typeof row.prem === "number") res.warnings.push("premium exists but prerequisite gate is " + (premiumGateState || "UNKNOWN") + " — floor scored");
  } else {
    res.blockers.push("NO_FLOOR_PREPROFIT");
    if (typeof row.prem === "number")
      res.context_premium = { target: row.prem, note: "CONTEXT ONLY — contingent premium, not a pillar score" };
    return res;
  }
  const years = (Date.parse(row.y + "-12-31T21:00:00Z") - nowMs) / (365.25 * 86400000);
  if (!(years >= 0.25)) { res.blockers.push("selected row inside ANN_MIN_Y with no honest roll"); return res; }
  const ann = 100 * (Math.pow(target / price.px, 1 / years) - 1);
  res.annualized_return_pct = round2(ann);
  res.target = target; res.target_year = row.y;
  res.score = round2(piecewise(ann, ANCHORS.P1_RETURN));
  return res;
}

/* ═══════════ P2 — Growth Quality and Duration (§6.2) ═══════════ */
function cagrPct(begin, end, years) {
  if (!(begin > 0) || !(end > 0) || !(years > 0)) return null;    // no sign-stripping, ever
  return 100 * (Math.pow(end / begin, 1 / years) - 1);
}
function seriesCagr(series) {
  // series: [{fy:"2027", value, source:{kind}, analyst_count?}, ...] — one comparable source set.
  if (!Array.isArray(series) || series.length < 2) return { err: "fewer than two dated future observations" };
  const kinds = new Set(series.map((p) => p.source && p.source.kind));
  if (kinds.size > 1 && !(kinds.size === 1)) {
    if (kinds.has("CONSENSUS") && kinds.has("COMPANY_GUIDANCE"))
      return { err: "mixed consensus and company guidance inside one CAGR" };
  }
  const sorted = [...series].sort((a, b) => String(a.fy).localeCompare(String(b.fy)));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const years = +last.fy - +first.fy;
  const c = cagrPct(first.value, last.value, years);
  if (c === null) return { err: "nonpositive endpoint — CAGR not meaningful" };
  return { cagr: c, first, last, years };
}
function supportedDuration(rows) {
  // Consecutive supported forward fiscal years: CONSENSUS needs analyst_count>=3 on EVERY
  // required metric that year; PRIMARY/COMPANY_GUIDANCE count under their own provenance.
  let run = 0;
  for (const yr of rows) {
    const okYear = yr.metrics.every((m) => {
      const k = m.source && m.source.kind;
      if (k === "PRIMARY" || k === "COMPANY_GUIDANCE") return true;
      if (k === "CONSENSUS") return typeof m.analyst_count === "number" && m.analyst_count >= 3;
      return false;                                                // DERIVED never extends duration
    });
    if (!okYear) break;
    run++;
  }
  return run;
}
export function scoreP2(traj, { etToday } = {}) {
  const res = { pillar: "trajectory", score: null, blockers: [], warnings: [], components: {} };
  if (!traj || typeof traj !== "object") { res.blockers.push("trajectory inputs missing"); return res; }
  const mode = traj.mode;
  if (mode !== "PROFITABLE" && mode !== "PREPROFIT") { res.blockers.push("trajectory_mode required (PROFITABLE|PREPROFIT)"); return res; }
  const rev = seriesCagr(traj.revenue);
  if (rev.err) { res.blockers.push("revenue series: " + rev.err); return res; }
  let secondName, secondAnchors, second;
  if (mode === "PROFITABLE") {
    secondName = "earnings_or_fcf"; secondAnchors = ANCHORS.EARN_CAGR; second = seriesCagr(traj.earnings_or_fcf);
  } else {
    const decl = traj.preprofit_second_series;
    if (decl !== "GROSS_PROFIT_CAGR" && decl !== "EBITDA_CAGR") { res.blockers.push("preprofit_second_series must be declared (GROSS_PROFIT_CAGR|EBITDA_CAGR) before scoring"); return res; }
    if (decl === "EBITDA_CAGR") {
      if (traj.ebitda_basis !== "GAAP" && traj.ebitda_basis !== "ADJUSTED") { res.blockers.push("EBITDA_CAGR requires a declared GAAP|ADJUSTED basis"); return res; }
      if (traj.ebitda_basis === "ADJUSTED" && !traj.ebitda_reconciliation) { res.blockers.push("ADJUSTED EBITDA requires a reconciliation source"); return res; }
      secondName = "ebitda"; secondAnchors = ANCHORS.EARN_CAGR; second = seriesCagr(traj.ebitda);
    } else {
      secondName = "gross_profit"; secondAnchors = ANCHORS.REV_CAGR; second = seriesCagr(traj.gross_profit);
    }
  }
  if (second.err) { res.blockers.push(secondName + " series: " + second.err); return res; }
  const durRows = (traj.duration_years || []).map((y) => ({ fy: y.fy, metrics: y.metrics || [] }));
  const dur = supportedDuration(durRows);
  const durScore = DURATION_SCORE(dur);
  if (durScore === null) { res.blockers.push("duration: fewer than two consecutive supported forward years (" + dur + ")"); return res; }
  const revScore = piecewise(rev.cagr, ANCHORS.REV_CAGR);
  const secScore = piecewise(second.cagr, secondAnchors);
  res.components = { revenue_cagr_pct: round2(rev.cagr), revenue_score: round2(revScore),
    [secondName + "_cagr_pct"]: round2(second.cagr), second_series_score: round2(secScore),
    supported_years: dur, duration_score: durScore };
  res.score = round2(0.5 * revScore + 0.3 * secScore + 0.2 * durScore);
  return res;
}

/* ═══════════ P3 — Economic Quality / Path to Profit (§6.3) ═══════════ */
const ENUM_SCORES = {
  unit_economics: { NEGATIVE: 0, IMPROVING: 5, POSITIVE: 10 },
  margin_direction: { DETERIORATING: 0, FLAT: 5, IMPROVING: 10 },
  path_to_profit: { NONE: 0, NARRATIVE_ONLY: 3, DATED_MILESTONES: 7, FCF_POSITIVE: 10 },
};
function enumScore(field, rec, res, { allowOwnerAsserted = false } = {}) {
  if (!rec || typeof rec !== "object" || !(rec.state in ENUM_SCORES[field])) {
    res.blockers.push(field + ": missing or unknown enum state"); return null;   // no UNKNOWN=5
  }
  if (!rec.source || !rec.rationale) { res.blockers.push(field + ": enum states require a source and a rationale"); return null; }
  if (rec.source.kind === "OWNER_ASSERTED") {
    if (!allowOwnerAsserted) { res.blockers.push(field + ": OWNER_ASSERTED not permitted here"); return null; }
    res.owner_asserted = true;
  }
  return ENUM_SCORES[field][rec.state];
}
export function scoreP3(q, { etToday, nowMs } = {}) {
  const res = { pillar: "economic_quality", score: null, blockers: [], warnings: [], components: {}, owner_asserted: false };
  if (!q || typeof q !== "object") { res.blockers.push("quality inputs missing"); return res; }
  if (q.mode === "PROFITABLE_STANDARD") {
    const need = ["operating_margin_pct", "margin_direction_pp", "fcf_margin_pct"];
    for (const f of need) {
      const err = validateAtomic(q[f], { etToday, nowMs });
      if (err) res.blockers.push(f + ": " + err);
    }
    const ce = q.capital_efficiency;
    if (!ce || (ce.metric !== "ROIC" && ce.metric !== "ROE")) res.blockers.push("capital_efficiency: route profile must declare ROIC or ROE — the scorer never chooses");
    else { const err = validateAtomic(ce, { etToday, nowMs }); if (err) res.blockers.push("capital_efficiency: " + err); }
    if (res.blockers.length) return res;
    const om = piecewise(q.operating_margin_pct.value, ANCHORS.OP_MARGIN);
    const md = piecewise(q.margin_direction_pp.value, ANCHORS.MARGIN_DIR);
    const fm = piecewise(q.fcf_margin_pct.value, ANCHORS.FCF_MARGIN);
    const cap = piecewise(ce.value, ce.metric === "ROIC" ? ANCHORS.ROIC : ANCHORS.ROE);
    res.components = { operating_margin: round2(om), margin_direction: round2(md), fcf_margin: round2(fm), capital_efficiency: round2(cap), metric: ce.metric };
    res.score = round2(0.35 * om + 0.25 * md + 0.25 * fm + 0.15 * cap);
    return res;
  }
  if (q.mode === "PREPROFIT") {
    const ue = enumScore("unit_economics", q.unit_economics, res);
    const md = enumScore("margin_direction", q.margin_direction, res);
    const pp = enumScore("path_to_profit", q.path_to_profit, res, { allowOwnerAsserted: true });
    const rwErr = validateAtomic(q.runway_months, { etToday, nowMs });
    if (rwErr) res.blockers.push("runway_months: " + rwErr);
    if (res.blockers.length) return res;
    const rw = piecewise(q.runway_months.value, ANCHORS.RUNWAY_MO);
    res.components = { unit_economics: ue, margin_direction: md, runway_quality: round2(rw), path_to_profit: pp };
    res.score = round2(0.35 * ue + 0.25 * md + 0.25 * rw + 0.15 * pp);
    return res;
  }
  res.blockers.push("quality_mode required (PROFITABLE_STANDARD|PREPROFIT)");
  return res;
}

/* ═══════════ P4 — Falsifier Health (§6.4 + §6.4.1 bootstrap) ═══════════ */
const HINGE_SCORE = { GREEN: 10, AMBER: 5, RED: 0 };
export function scoreP4(falsifiers, { etToday } = {}) {
  const res = { pillar: "falsifier_health", score: null, blockers: [], warnings: [],
    states: [], broken_thesis: false, bootstrap: null };
  const all = Array.isArray(falsifiers) ? falsifiers : [];
  const required = all.filter((h) => h && !h.legacy);
  const legacy = all.length - required.length;
  if (legacy) res.warnings.push(legacy + " LEGACY_POST_HOC hinge(s) — visible history, never scored");
  if (required.length < 3) {
    res.blockers.push("AWAITING_FALSIFIERS");
    res.bootstrap = required.length ? "PRECOMMITTED_PENDING" : "LEGACY_POST_HOC";
    return res;
  }
  if (required.length > 8) { res.blockers.push("more than 8 required hinges"); return res; }
  let num = 0, den = 0;
  for (const h of required) {
    const id = h.id || "unnamed";
    if (!(h.green_condition && h.amber_condition && h.red_condition)) { res.blockers.push(id + ": conditions not pre-committed — UNKNOWN"); continue; }
    if (!(Number.isInteger(h.importance) && h.importance >= 1 && h.importance <= 3)) { res.blockers.push(id + ": importance must be integer 1..3"); continue; }
    if (!h.defined_at || !h.qualifying_observation || !(h.qualifying_observation.observed_at > h.defined_at)) {
      res.blockers.push("AWAITING_FALSIFIERS"); res.bootstrap = "PRECOMMITTED_PENDING";
      return res;                                                   // one pending hinge nulls the pillar
    }
    if (h.defined_at_post_hoc === true) { res.blockers.push(id + ": POST_HOC_DEFINITION"); continue; }
    if (!(h.state in HINGE_SCORE)) { res.blockers.push(id + ": state UNKNOWN — missing is not 5"); continue; }
    const fresh = freshnessOf(h.as_of, h.cadence_days || 90, etToday);
    if (fresh === "STALE" || fresh === "INVALID") { res.blockers.push(id + ": observation " + fresh); continue; }
    if (h.state === "RED" && h.kill === true) res.broken_thesis = true;
    num += HINGE_SCORE[h.state] * h.importance; den += h.importance;
    res.states.push({ id, state: h.state, importance: h.importance, kill: !!h.kill });
  }
  if (res.blockers.length) return res;                              // any unresolved hinge → unscorable
  res.score = round2(num / den);
  return res;
}

/* ═══════════ §6 composite, §8 gates, §7 actionability ═══════════ */
export function rawTierFrom(score) {
  if (typeof score !== "number" || !isFinite(score)) return null;
  if (score >= 8.5) return "S";
  if (score >= 7.0) return "A";
  if (score >= 5.5) return "B";
  return "C";
}
const TIER_ORDER = { S: 4, A: 3, B: 2, C: 1 };
export function gatePrecedence(gateResults, rawTier) {
  // Order-independent: BROKEN_THESIS > BLOCK_ADD > strictest TIER_CAP; UNKNOWN blocks.
  const rs = Array.isArray(gateResults) ? gateResults : [];
  const blockers = [];
  let capped = rawTier;
  if (rs.some((g) => g.state === "FAIL" && g.effect && g.effect.kind === "BROKEN_THESIS"))
    return { capped_tier: "AVOID", blockers: ["BROKEN_THESIS"], cap_source: rs.find((g) => g.state === "FAIL" && g.effect.kind === "BROKEN_THESIS").id };
  if (rs.some((g) => g.state === "FAIL" && g.effect && g.effect.kind === "BLOCK_ADD"))
    return { capped_tier: "HOLD", blockers: ["BLOCK_ADD"], cap_source: rs.find((g) => g.state === "FAIL" && g.effect.kind === "BLOCK_ADD").id };
  let capSource = null;
  for (const g of rs) {
    if (g.state === "FAIL" && g.effect && g.effect.kind === "TIER_CAP") {
      const t = g.effect.tier;
      if (capped === null || TIER_ORDER[t] < TIER_ORDER[capped]) { capped = t; capSource = g.id; }
    }
  }
  for (const g of rs) if (g.state === "UNKNOWN") blockers.push("BLOCKED_PENDING_INPUT:" + g.id);
  return { capped_tier: capped, blockers, cap_source: capSource };
}
export function actionabilityRollup({ pillarFresh = [], anyBlocked = false, anyOwnerAsserted = false, anyAging = false } = {}) {
  if (anyBlocked || pillarFresh.some((f) => f === "STALE" || f === "INVALID")) return "BLOCKED";
  if (anyAging || anyOwnerAsserted || pillarFresh.some((f) => f === "AGING")) return "CAUTION";
  return "FULL";
}

/* ═══════════ §10 typed portfolio constraint ═══════════ */
export function evalPortfolioConstraint(c) {
  if (!c || c.kind !== "CLUSTER_CONSTRAINT") return { state: "UNKNOWN", reason: "not a typed constraint" };
  const lim = typeof c.limit_pct === "number" && isFinite(c.limit_pct) ? c.limit_pct : null;
  const proj = typeof c.projected_pct === "number" && isFinite(c.projected_pct) ? c.projected_pct : null;
  if (lim === null || proj === null) return { ...c, state: "UNKNOWN", reason: "missing limit or measured exposure — WAIT/BLOCKED_PENDING_INPUT" };
  return { ...c, state: proj < lim ? "PASS" : "FAIL" };             // at-limit blocks (equality FAILs)
}

/* ═══════════ §11.2 eligibility ═══════════ */
export function evalEligibility(ctx) {
  const blockers = [];
  const c = ctx || {};
  if (!(typeof c.annualized_return_pct === "number" && c.annualized_return_pct > 0)) blockers.push("no positive annualized modeled return");
  if (c.status !== "SCORED") blockers.push("scorecard not SCORED");
  if (c.actionability !== "FULL" && c.actionability !== "CAUTION") blockers.push("actionability " + (c.actionability || "missing"));
  if (c.methodology_version !== METHODOLOGY_VERSION) blockers.push("inactive methodology version");
  if (c.capped_tier === "HOLD" || c.capped_tier === "AVOID") blockers.push("capped tier " + c.capped_tier);
  if (c.tier_permitted === false) blockers.push("tier not permitted by regime/route");
  if (c.gates_unknown) blockers.push("route gate UNKNOWN");
  if (c.exposure_ok === false) blockers.push("account/exposure gate failed");
  if (typeof c.binary_days === "number" && c.binary_days >= 0 && c.binary_days <= 10) blockers.push("binary in the inclusive 10-day window");
  if (c.regime_blocking) blockers.push("regime/Macro Flip blocking");
  if (c.execution === "FAIL" || c.execution == null) blockers.push("execution " + (c.execution || "missing"));
  if (blockers.length) return { verdict: c.rule_failed ? "NAY" : "WAIT", blockers };
  if (c.actionability === "CAUTION")
    return c.execution === "TRIGGER_REQUIRED"
      ? { verdict: "YAY_ON_TRIGGER", blockers: [] }
      : { verdict: "YAY_ON_TRIGGER", blockers: [], note: "CAUTION evidence can never produce unconditional YAY" };
  if (c.execution === "TRIGGER_REQUIRED") return { verdict: "YAY_ON_TRIGGER", blockers: [] };
  return { verdict: "YAY", blockers: [] };
}

/* ═══════════ §12 outcome memory (risk-first, order-invariant) ═══════════ */
const HINGE_RANK = { RED: 0, AMBER: 1, GREEN: 2 };
const READY_RANK = { BLOCKED: 0, CAUTION: 1, FULL: 2 };
const GATE_RANK = { FAIL: 0, UNKNOWN: 0, PASS: 1 };
export function buildOutcomeMemory(prev, cur) {
  if (!prev || prev.thesis_version !== (cur && cur.thesis_version))
    return { state: "INSUFFICIENT", since: null, changes: [], calibration: "INSUFFICIENT_SAMPLE" };
  const changes = [];
  let worsened = false, improved = false, contradicted = false;
  const pH = prev.hinges || {}, cH = cur.hinges || {};
  for (const id of new Set([...Object.keys(pH), ...Object.keys(cH)])) {
    const a = pH[id], b2 = cH[id];
    if (a == null || b2 == null) continue;
    if (HINGE_RANK[b2] < HINGE_RANK[a]) { worsened = true; changes.push("hinge " + id + " " + a + "→" + b2); if (b2 === "RED" && (cur.kill_hinges || []).includes(id)) contradicted = true; }
    else if (HINGE_RANK[b2] > HINGE_RANK[a]) { improved = true; changes.push("hinge " + id + " " + a + "→" + b2); }
  }
  const pG = prev.gates || {}, cG = cur.gates || {};
  for (const id of new Set([...Object.keys(pG), ...Object.keys(cG)])) {
    const a = pG[id], b2 = cG[id];
    if (a == null || b2 == null) continue;
    if (a === "PASS" && b2 !== "PASS") { worsened = true; changes.push("gate " + id + " PASS→" + b2); }
    else if (a !== "PASS" && b2 === "PASS") { improved = true; changes.push("gate " + id + " " + a + "→PASS"); }
  }
  if (cur.broken_thesis === true && prev.broken_thesis !== true) contradicted = true;
  if (prev.readiness && cur.readiness && READY_RANK[cur.readiness] < READY_RANK[prev.readiness]) { worsened = true; changes.push("readiness " + prev.readiness + "→" + cur.readiness); }
  else if (prev.readiness && cur.readiness && READY_RANK[cur.readiness] > READY_RANK[prev.readiness]) { improved = true; changes.push("readiness " + prev.readiness + "→" + cur.readiness); }
  // Improvements never average away a worsening item (risk-first precedence).
  const state = contradicted ? "CONTRADICTED" : worsened ? "WEAKENING" : improved ? "STRENGTHENING" : "UNCHANGED";
  return { state, since: prev.stamped_at || null, changes, calibration: cur.calibration || "INSUFFICIENT_SAMPLE" };
}

/* ═══════════ §4.3 canonical hashing ═══════════ */
export function canonicalJson(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";  // arrays preserve order
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(v[k])).join(",") + "}";
}
export async function inputHash(normalizedInputs) {
  const bytes = new TextEncoder().encode(canonicalJson(normalizedInputs));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256:" + [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* ═══════════ the orchestrator — one scorecard from one input set ═══════════ */
export async function buildScorecard({ sym, lens, underwriting_inputs, dd, price, horizon, nowMs }) {
  const etToday = etDateOf(nowMs);
  const routed = routeFor(lens);
  const card = {
    methodology_version: METHODOLOGY_VERSION,
    computed_at: new Date(nowMs).toISOString(),
    scored_for_et_date: etToday,
    route: routed.route, profile: routed.profile, route_mapping_version: routed.mapping_version,
    status: "UNSCORABLE", actionability: "BLOCKED",
    pillars: {}, raw_score: null, raw_tier: null, capped_tier: null,
    gate_results: [], constraints: [], blockers: [], warnings: [], input_hash: null,
  };
  if (routed.route === "UNMAPPED") { card.blockers.push("UNMAPPED lens \"" + lens + "\""); return card; }
  const ui = underwriting_inputs || {};

  // Route gates first — P1's premium prerequisite needs them.
  const gateInputs = ui.route_gates || {};
  for (const g of gatesFor(routed.route, routed.profile)) {
    const inp = gateInputs[g.id] || {};
    const typed = g.evaluate(inp);
    const norm = normalizeLegacyGateState(inp.legacy_label, typed);
    card.gate_results.push({ id: g.id, state: norm.state, raw_state: norm.raw_state,
      normalization_version: norm.normalization_version, effect: g.effect,
      premium_prerequisite: !!g.premium_prerequisite, as_of: inp.as_of || null,
      ...(norm.note ? { note: norm.note } : {}) });
    if (g.constraint) { const c = g.constraint(inp); if (c) card.constraints.push(c); }
  }
  const prereq = premiumPrerequisiteFor(routed.route, routed.profile);
  const prereqState = prereq ? (card.gate_results.find((r) => r.id === prereq.id) || {}).state : "UNKNOWN";

  const p1 = scoreP1({ dd, horizon, price, premiumGateState: prereqState, etToday, nowMs });
  const p2 = scoreP2(ui.trajectory, { etToday });
  const p3 = scoreP3(ui.economic_quality, { etToday, nowMs });
  const p4 = scoreP4(ui.falsifiers, { etToday });
  const parts = { owner_valuation: p1, trajectory: p2, economic_quality: p3, falsifier_health: p4 };
  for (const [k, p] of Object.entries(parts)) {
    card.pillars[k] = { score: p.score, weight: 0.25, blockers: p.blockers, warnings: p.warnings || [],
      ...(k === "owner_valuation" ? { basis_used: p.basis_used, premium_prerequisite_state: p.premium_prerequisite_state,
        annualized_return_pct: p.annualized_return_pct, target: p.target, target_year: p.target_year,
        rolled_from: p.rolled_from, ...(p.context_premium ? { context_premium: p.context_premium } : {}) } : {}),
      ...(p.components ? { components: p.components } : {}),
      ...(k === "falsifier_health" ? { bootstrap: p.bootstrap, states: p.states } : {}) };
    card.blockers.push(...p.blockers.map((b2) => k + ": " + b2));
  }
  if (p4.broken_thesis) card.gate_results.push({ id: "P4_KILL_HINGE", state: "FAIL", effect: { kind: "BROKEN_THESIS" }, premium_prerequisite: false });

  const scores = [p1.score, p2.score, p3.score, p4.score];
  if (scores.every((s) => typeof s === "number")) {
    card.raw_score = round2(scores.reduce((a, b2) => a + b2, 0) * 0.25);
    card.raw_tier = rawTierFrom(card.raw_score);
    card.status = "SCORED";
  }
  const prec = gatePrecedence(card.gate_results, card.raw_tier);
  card.capped_tier = prec.capped_tier; card.cap_source = prec.cap_source || null;
  card.blockers.push(...prec.blockers);
  card.actionability = actionabilityRollup({
    anyBlocked: card.status !== "SCORED" || prec.blockers.some((b2) => b2.startsWith("BLOCKED_PENDING_INPUT")),
    anyOwnerAsserted: p3.owner_asserted === true,
  });
  card.input_hash = await inputHash({ methodology_version: METHODOLOGY_VERSION, lens, underwriting_inputs: ui,
    dd_pt_model: dd && dd.pt_model, dd_consensus: dd && dd.consensus, horizon: horizon || null });
  return card;
}
