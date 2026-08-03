// src/ttReadout.js — MacroDash v3.3 · TT ("Ticker Terminal") regime readout mapping (FEAT-330).
//
// PURE, React-free, Node-testable. Imports only { isStale } from ./sources.js (also pure).
// Consumed by THREE call sites — keep it dependency-free so all three bundle cleanly:
//   1. functions/readout.json.js  (Cloudflare Pages Function; esbuild inlines this relative
//      import — the first functions/→src/ import in the repo, so it MUST stay React/DOM-free)
//   2. src/dashboard.jsx          (the Macro Flip banner + "Copy TT readout" button)
//   3. test/smoke.mjs             (every band boundary below is asserted)
//
// ⚠ THIS TABLE GATES REAL ORDERS in the maintainer's TT framework (Engine 0 / Macro Flip
// circuit). Every band boundary is smoke-tested (DEC-33). Change a band ONLY with a matching
// test change — a silent drift here mis-classifies live capital.

import { isStale, DERIVED_OF, govAsOf, sessionsBehind, etYmd } from "./sources.js";
// Re-exported for existing importers (test/smoke.mjs imports DERIVED_OF from here) — the
// table itself now lives in sources.js (FEAT-DERIV-OWN, v3.41): that module already owns the
// staleness vocabulary and every consumer (mergeLiveOverMock, this file, dashboard's modeOf)
// already imports from it, so one table now governs all three surfaces instead of one.
export { DERIVED_OF };

const round2 = (n) => Math.round(n * 100) / 100;
const bandLabel = (s) => (s == null ? "unavailable" : s); // null band -> "unavailable" check state

// ─── Per-check band functions (DEC-33 — boundaries pinned; null input -> null) ───────────

// SPY vs 200-day SMA (percent). >+3% bullish · within ±3% neutral · <−3% bearish.
export function bandSpyVs200d(pct) {
  if (pct == null || !isFinite(pct)) return null;
  if (pct > 3) return "bullish";
  if (pct < -3) return "bearish";
  return "neutral";
}

// VIX level. <18 bullish · 18–25 neutral · >25 bearish. (25 is still neutral; panic needs >25.)
export function bandVix(v) {
  if (v == null || !isFinite(v)) return null;
  if (v < 18) return "bullish";
  if (v > 25) return "bearish";
  return "neutral";
}

// CNN Fear & Greed. 25–55 bullish · <20 or >75 bearish · everything between neutral
// (the 20–25 and 55–75 ranges are doc gaps in the TT §1.2 table — resolved to neutral, DEC-33).
export function bandFearGreed(v) {
  if (v == null || !isFinite(v)) return null;
  if (v < 20 || v > 75) return "bearish";
  if (v >= 25 && v <= 55) return "bullish";
  return "neutral";
}

// QQQ/SPY relative strength from the 1-day change delta (pp). Returns an RS state, not a
// bull/bear state (mapped separately). ±0.3pp deadband so a normal same-direction day = "inline".
export function bandRs(delta) {
  if (delta == null || !isFinite(delta)) return null;
  if (delta > 0.3) return "leading";
  if (delta < -0.3) return "breaking_down";
  return "inline";
}

// 10Y monthly trend (m1 delta, ppt). Mirrors computeRegime() in dashboard.jsx:
// < −0.10 falling · −0.10…+0.15 rangebound · > +0.15 spiking. Never substitute a weekly delta.
export function bandTenYear(m1) {
  if (m1 == null || !isFinite(m1)) return null;
  if (m1 < -0.1) return "falling";
  if (m1 > 0.15) return "spiking";
  return "rangebound";
}

// Kalshi NEXT-MEETING odds (not "by December"). cut>50 bullish · hike>50 bearish · else neutral.
export function bandFedOdds({ hold, cut, hike } = {}) {
  const anyLive = [hold, cut, hike].some((x) => typeof x === "number" && isFinite(x));
  if (!anyLive) return null;
  if (typeof cut === "number" && cut > 50) return "bullish";
  if (typeof hike === "number" && hike > 50) return "bearish";
  return "neutral";
}

const RS_TO_STATE = { leading: "bullish", inline: "neutral", breaking_down: "bearish" };
const TREND_TO_STATE = { falling: "bullish", rangebound: "neutral", spiking: "bearish" };

// ─── ENGINE0-CONT: evidence tiers + historical carry policy ──────────────────────────────
// Every Engine 0 input resolves to an EvidencePoint BEFORE it reaches the bands:
//   CURRENT     latest source observation, fresh for its cadence — full vote
//   CACHED      same observation served from the same-day KV cache — full vote, never "LIVE"
//   HISTORICAL  latest official observation beyond normal freshness but within the carry
//               window below — voted through the SAME band, then conservatively transformed
//               (bullish → neutral; bearish survives, flagged as carried). Cannot clear the
//               Macro Flip circuit and cannot produce FULL actionability.
//   MISSING     nothing bounded and source-backed within the carry window — no vote.
// (PROXY exists in the vocabulary for future explicitly-approved substitutes; nothing in
// this build emits it — a proxy must never pass through the original metric's bands.)
export const EVIDENCE_TIERS = ["CURRENT", "CACHED", "HISTORICAL", "PROXY", "MISSING"];

// Historical carry windows, in COMPLETED MARKET SESSIONS (sessionsBehind in sources.js —
// the same counter isStale's daily gate uses, so the two can never disagree about what a
// session is). These are data-availability policy, NOT new economic thresholds: the band
// boundaries above are untouched. Exact boundaries are smoke-tested (DEC-33 convention).
export const CARRY_SESSIONS = {
  spy_vs_200d: 3,      // needs >=200 official closes; the MA barely moves in 3 sessions
  vix: 2,              // the crash gauge decays fastest — shortest carry
  fear_greed: 2,
  qqq_spy_rs: 3,       // a 1-day RS print; stale RS is weak evidence quickly
  us10y_trend: 5,      // a monthly-delta trend; tolerates a longer publisher lag
  fed_next_meeting: 5, // AND only while the referenced FOMC event is still open
};

// The panic gauges — the two inputs the PANIC override and the TAILWIND withhold key on.
export const CRITICAL_CHECKS = ["vix", "fear_greed"];

// Conservative transform for a HISTORICAL vote: stale bullishness is not evidence of
// safety (bullish → neutral), but stale bearishness is still a caution worth carrying.
export function conservativeVote(vote) {
  if (vote === "bullish") return "neutral";
  return vote; // neutral stays neutral; bearish stays bearish; unavailable stays unavailable
}

// ─── ENGINE0-CONT: candidate quality tuple (§7.2 of the continuity plan) ─────────────────
// Comparable, lexicographic. Built FROM a readout (one computation — the same regime counts
// the readout renders), plus the candidate's asOf epoch as the final tiebreak so an
// equal-quality newer candidate wins. Used by the snapshot publisher to refuse replacing a
// better stored snapshot with a worse rebuild.
export function readoutQuality(readout, asOfEpoch = 0) {
  const r = (readout && readout.regime) || {};
  const flip = (readout && readout.macro_flip) || {};
  return [
    flip.evaluable === true ? 1 : 0,
    r.current_panic_gauges ?? 0,
    r.current ?? 0,
    r.usable ?? 0,
    -(r.historical ?? 0),
    -(r.missing ?? 0),
    Number.isFinite(asOfEpoch) ? asOfEpoch : 0,
  ];
}
export function compareQuality(a, b) { // >0: a better · 0: equal · <0: a worse
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ─── Verdict aggregation ─────────────────────────────────────────────────────────────────
// Plurality of bullish vs bearish among AVAILABLE checks (neutral counts only toward available).
// <3 available -> INSUFFICIENT (a 1–2-input verdict must never gate an order). Tie -> NEUTRAL.
// PANIC is applied by buildTtReadout (it needs the raw vix/F&G values), overriding everything.
export function aggregateVerdict(checks) {
  let available = 0, bullish = 0, bearish = 0;
  for (const c of checks) {
    if (c.state === "unavailable") continue;
    available++;
    if (c.state === "bullish") bullish++;
    else if (c.state === "bearish") bearish++;
  }
  let verdict;
  if (available < 3) verdict = "INSUFFICIENT";
  else if (bullish > bearish) verdict = "TAILWIND";
  else if (bearish > bullish) verdict = "HEADWIND";
  else verdict = "NEUTRAL";
  return { verdict, available, bullish, bearish };
}

// ─── Macro Flip circuit (null-safe) ──────────────────────────────────────────────────────
// armed = VIX > 22 · tripped = SPY < 200-day SMA AND VIX > 25. Any missing input -> null
// (a fabricated circuit state is worse than none — same doctrine as the dashboard honesty rule).
export function computeMacroFlip({ vix, spyPrice, spyMa200 } = {}) {
  const v = typeof vix === "number" && isFinite(vix) ? vix : null;
  const p = typeof spyPrice === "number" && isFinite(spyPrice) ? spyPrice : null;
  const m = typeof spyMa200 === "number" && isFinite(spyMa200) ? spyMa200 : null;
  const armed = v == null ? null : v > 22;
  const tripped = v == null || p == null || m == null ? null : p < m && v > 25;
  const pct_vs_200d = p != null && m != null && m !== 0 ? round2(((p - m) / m) * 100) : null;
  // FEAT-DASH-DERIV (v3.40): a null `armed`/`tripped` used to be indistinguishable from a
  // genuine "not armed" / "not tripped" — the crash detector could be BLIND and the body said
  // nothing, next to a confident verdict. It now declares inevaluability and names the missing
  // input, so a consumer gating capital can tell "the circuit says no" from "the circuit cannot see".
  const missing = [v == null && "vix", p == null && "spy_price", m == null && "spy_ma200"].filter(Boolean);
  return {
    armed, tripped,
    evaluable: missing.length === 0,
    reason: missing.length ? `circuit BLIND — missing or stale: ${missing.join(", ")}` : null,
    inputs: { vix: v, spy_price: p, spy_ma200: m, pct_vs_200d },
  };
}

// ─── The full readout body ───────────────────────────────────────────────────────────────
// `live` = flat snapshot fields (the `live` object /api/snapshot returns, or the projection the
// dashboard builds from LIVE/CACHED tiles). A field is USED only if present, finite, and not
// stale for its cadence (isStale reused from sources.js — the same gate the dashboard vote uses).
// FEAT-DASH-DERIV (v3.40) / FEAT-DERIV-OWN (v3.41): a DERIVED field must inherit the staleness
// of what it is derived FROM. isStale() fails OPEN on a missing date (sources.js:236) — correct
// for a dated field, since there is nothing to judge, but a hole for a derivative: snapshot.js
// emits fields like `vixWeekChg`/`tenYearM1`/`spyChangePct` with NO AsOf sibling of their own,
// so they sail past the gate that had just suppressed their own parent.
// MEASURED, live on 2026-07-30: `vix` (dated 07-28) was correctly withheld as stale — while
// `vixWeekChg` published 6.8, `tenYearM1` published +0.23 and CAST A BEARISH VOTE in the very
// regime the dashboard promises "excludes stale/dead inputs". v3.41 moved the mapping (DERIVED_OF,
// now imported from sources.js above) out of this file so mergeLiveOverMock/modeOf/the paste
// projection share the SAME table instead of only /readout.json being fixed.
export function buildTtReadout(live, { now = new Date(), cached = false } = {}) {
  const L = live || {};
  // govAsOf (sources.js): own AsOf if stamped, else the DERIVED_OF parent's. `asOf` is the
  // public alias a block uses to report the date it actually gated on.
  const govDate = (key) => govAsOf(L, key) ?? null;
  const asOf = govDate;
  const freshTier = cached ? "CACHED" : "CURRENT";
  const TIER_RANK = { CURRENT: 0, CACHED: 0, HISTORICAL: 1, PROXY: 2, MISSING: 3 };
  const isCur = (p) => p.tier === "CURRENT" || p.tier === "CACHED";

  // ENGINE0-CONT: EvidencePoint resolver. A value is CURRENT/CACHED when fresh for its
  // cadence (isStale — the same gate as before), HISTORICAL when stale but within the
  // check's carry window (sessionsBehind, the same session counter isStale uses), and
  // MISSING beyond it. isStale fails open on a MISSING date — correct for a dated field
  // (nothing to judge); DERIVED_OF closes the derivative holes (v3.40/v3.41, unchanged).
  const point = (checkName, key, cadence = "daily") => {
    const v = L[key];
    const d = govDate(key);
    const val = typeof v === "number" && isFinite(v) ? v : null;
    if (val === null) return { tier: "MISSING", value: null, asOf: d, sessions: null };
    if (!isStale(d, now, cadence)) return { tier: freshTier, value: val, asOf: d, sessions: d ? sessionsBehind(d, now) : 0 };
    const s = sessionsBehind(d, now);
    const carry = CARRY_SESSIONS[checkName] ?? 0;
    if (s != null && s <= carry) return { tier: "HISTORICAL", value: val, asOf: d, sessions: s };
    return { tier: "MISSING", value: null, asOf: d, sessions: s };
  };
  // Worst tier of a set of points — a multi-input check inherits its weakest input.
  const worstTier = (...pts) => pts.reduce((w, p) => (TIER_RANK[p.tier] > TIER_RANK[w] ? p.tier : w), pts[0].tier);

  // ── Resolve the six checks' evidence ──────────────────────────────────────────────────
  const spyP = point("spy_vs_200d", "spyPrice");
  const maP = point("spy_vs_200d", "spyMa200"); // governed by spyPriceAsOf via DERIVED_OF
  const spyTier = worstTier(spyP, maP);
  const spyPrice = spyTier === "MISSING" ? null : spyP.value;
  const spyMa200 = spyTier === "MISSING" ? null : maP.value;
  const pctVs200d = spyPrice != null && spyMa200 != null && spyMa200 !== 0 ? round2(((spyPrice - spyMa200) / spyMa200) * 100) : null;
  const spy = { price: spyPrice, sma200: spyMa200, pct_vs_200d: pctVs200d, as_of: asOf("spyPrice"), tier: pctVs200d == null ? "MISSING" : spyTier };

  const vixP = point("vix", "vix");
  const wkP = point("vix", "vixWeekChg");
  const vix = { value: vixP.value, week_chg: isCur(wkP) || wkP.tier === "HISTORICAL" ? wkP.value : null, as_of: asOf("vix"), tier: vixP.tier };

  const fgP = point("fear_greed", "fearGreed");
  const fgLabelRaw = L.fearGreedLabel;
  const fear_greed = {
    value: fgP.value,
    label: fgP.tier !== "MISSING" && typeof fgLabelRaw === "string" && fgLabelRaw ? fgLabelRaw : null,
    as_of: asOf("fearGreed"), tier: fgP.tier,
  };

  // RS: prefer the index pair (FRED NASDAQ100 vs SP500 — same-date-paired in snapshot.js);
  // fall back to the ETF 1-day pair (QQQ/SPY) so a surface that only carries SOURCES fields
  // (the dashboard's paste projection) keeps the check. Dimensionally identical intent —
  // 1-day large-cap-growth relative strength — and the pair used is NAMED, never implied.
  let qqq_spy_rs = null, rsDelta = null, rsTier = "MISSING";
  const ndxP = point("qqq_spy_rs", "ndxSpxRs");
  if (ndxP.tier !== "MISSING") {
    rsDelta = round2(ndxP.value);
    rsTier = ndxP.tier;
    qqq_spy_rs = { state: bandRs(rsDelta), basis: "1d", pair: "NASDAQ100/SP500",
      qqq_1d: typeof L.ndx1dPct === "number" && isFinite(L.ndx1dPct) ? L.ndx1dPct : null,
      spy_1d: typeof L.spx1dPct === "number" && isFinite(L.spx1dPct) ? L.spx1dPct : null,
      as_of: govDate("ndxSpxRs"), tier: rsTier };
  } else {
    const qP = point("qqq_spy_rs", "qqqChangePct");
    const sP = point("qqq_spy_rs", "spyChangePct");
    if (qP.tier !== "MISSING" && sP.tier !== "MISSING") {
      rsDelta = round2(qP.value - sP.value);
      rsTier = worstTier(qP, sP);
      qqq_spy_rs = { state: bandRs(rsDelta), basis: "1d", pair: "QQQ/SPY (ETF proxy)",
        qqq_1d: qP.value, spy_1d: sP.value, as_of: govDate("qqqChangePct"), tier: rsTier };
    }
  }

  const m1P = point("us10y_trend", "tenYearM1");
  const m1 = m1P.value;
  const tenYieldP = point("us10y_trend", "tenYear");
  const us10y = { yield: tenYieldP.tier === "MISSING" ? null : tenYieldP.value, trend: bandTenYear(m1), m1_delta: m1, as_of: asOf("tenYear"), tier: m1P.tier };

  // Fed odds: HISTORICAL carry is additionally gated on the referenced FOMC event still
  // being OPEN — odds from a decided meeting must never carry into the next one (§5.6).
  let holdP = point("fed_next_meeting", "rateOddsHold");
  let cutP = point("fed_next_meeting", "rateOddsCut");
  let hikeP = point("fed_next_meeting", "rateOddsHike");
  const fomcDateStr = typeof L.nextFomcDate === "string" ? L.nextFomcDate.slice(0, 10) : null;
  const eventClosed = fomcDateStr != null && fomcDateStr < etYmd(now);
  if (eventClosed) {
    holdP = { tier: "MISSING", value: null, asOf: holdP.asOf, sessions: holdP.sessions };
    cutP = { ...holdP }; hikeP = { ...holdP };
  }
  const hold = holdP.value, cut = cutP.value, hike = hikeP.value;
  const fedTier = hold == null && cut == null && hike == null ? "MISSING" : worstTier(holdP, cutP, hikeP);
  const fed_odds = fedTier === "MISSING" ? null
    : { next_meeting: fomcDateStr, days_out: point("fed_next_meeting", "fomcDays").value, hold, cut, hike, as_of: asOf("rateOddsHold"), tier: fedTier };

  // ── Checks — ALWAYS six, stable order. state = EFFECTIVE vote (backward compatible);
  // tier / original_vote / effective_vote / age_sessions are additive evidence metadata.
  // HISTORICAL votes pass the SAME band, then the conservative transform: stale bullish
  // evidence is downgraded to neutral (stale bullishness is not evidence of safety); stale
  // bearish evidence survives, flagged as carried from the last official observation.
  const carried = (p) => p.tier === "HISTORICAL" ? ` · carried from last official observation (${p.asOf ?? "undated"}, ${p.sessions} session${p.sessions === 1 ? "" : "s"} behind)` : "";
  const mkCheck = (name, tier, origVote, value, reason, p) => {
    const original = tier === "MISSING" ? null : origVote;
    const effective = tier === "HISTORICAL" ? conservativeVote(original) : original;
    return { name, state: bandLabel(effective), value, tier,
      original_vote: bandLabel(original), effective_vote: bandLabel(effective),
      as_of: p ? p.asOf : null, age_sessions: p ? p.sessions : null,
      reason: reason + (p ? carried(p) : "") };
  };
  const rsState = qqq_spy_rs ? RS_TO_STATE[qqq_spy_rs.state] : null;
  const trendState = us10y.trend ? TREND_TO_STATE[us10y.trend] : null;
  const fedState = fed_odds ? bandFedOdds({ hold, cut, hike }) : null;
  const checks = [
    mkCheck("spy_vs_200d", spy.tier, bandSpyVs200d(pctVs200d), pctVs200d,
      pctVs200d == null ? "SPY or 200d SMA unavailable" : `${pctVs200d > 0 ? "+" : ""}${pctVs200d}% vs 200d (bands ±3%)`,
      { asOf: spyP.asOf, sessions: spyP.sessions, tier: spy.tier }),
    mkCheck("vix", vixP.tier, bandVix(vixP.value), vixP.value,
      vixP.value == null ? "VIX unavailable" : `VIX ${vixP.value} (bands 18 / 25)`, vixP),
    mkCheck("fear_greed", fgP.tier, bandFearGreed(fgP.value), fgP.value,
      fgP.value == null ? "F&G unavailable" : `F&G ${fgP.value} (bull 25–55 · bear <20 / >75)`, fgP),
    mkCheck("qqq_spy_rs", rsTier, rsState, rsDelta,
      qqq_spy_rs == null ? "NASDAQ100/SP500 (or QQQ/SPY) 1d change unavailable" : `${qqq_spy_rs.pair} ${rsDelta > 0 ? "+" : ""}${rsDelta}pp (1d basis, ±0.3pp)`,
      qqq_spy_rs ? { asOf: qqq_spy_rs.as_of, sessions: ndxP.tier !== "MISSING" ? ndxP.sessions : null, tier: rsTier } : null),
    mkCheck("us10y_trend", m1P.tier, trendState, m1,
      m1 == null ? "10Y monthly delta unavailable" : `m1 ${m1 > 0 ? "+" : ""}${m1} → ${us10y.trend}`, m1P),
    mkCheck("fed_next_meeting", fedTier, fedState, fed_odds ? hold : null,
      fed_odds == null ? (eventClosed ? "Kalshi odds for a closed FOMC event — discarded, never carried forward" : "Kalshi odds unavailable") : `hold ${hold} / cut ${cut} / hike ${hike} (next meeting)`,
      fed_odds ? holdP : null),
  ];

  const agg = aggregateVerdict(checks);
  const tally = (t) => checks.filter((c) => c.tier === t).length;
  const current = checks.filter((c) => isCur(c)).length;
  const historical = tally("HISTORICAL");
  const missingChecks = checks.filter((c) => c.tier === "MISSING").map((c) => c.name);
  const currentPanicGauges = [vixP, fgP].filter(isCur).length;

  // PANIC — mechanized capitulation. Both inputs must be CURRENT/CACHED; a carried
  // (historical) print may keep a bearish vote but must never fire — or clear — the most
  // safety-critical override. Overrides any base verdict, including the degraded fallback.
  const panic = isCur(vixP) && isCur(fgP) && vixP.value > 25 && fgP.value < 20;
  /* FEAT-DASH-DERIV (v3.40) / FEAT-DERIV-OWN (v3.41) / ENGINE0-CONT: a TAILWIND must not be
     printable while the RISK GAUGE cannot see. PANIC needs BOTH vix and fear_greed at
     CURRENT/CACHED, so either gauge merely HISTORICAL — not just missing — blinds the
     override, and a "risk-on" verdict would be asserted by inputs that cannot see a crash.
     The rule stays deliberately ASYMMETRIC: HEADWIND/PANIC pass through untouched; only the
     risk-ON direction is withheld, and the downgrade names the blind gauge. */
  const blindGauges = [!isCur(vixP) && "VIX", !isCur(fgP) && "Fear & Greed"].filter(Boolean);
  const gaugeBlind = blindGauges.length > 0;
  const downgraded = !panic && gaugeBlind && agg.verdict === "TAILWIND";
  // ENGINE0-CONT: the <3-usable aggregate no longer PUBLISHES as a verdict. The word
  // INSUFFICIENT survives only in raw_verdict (the honest record of what the counts said);
  // the operational posture is a deterministic wait state: NEUTRAL · LOW · HOLD ·
  // DATA DEGRADED — a claim about the SYSTEM's evidence, never a claim the tape is neutral.
  const degradedFallback = agg.verdict === "INSUFFICIENT";
  const verdict = panic ? "PANIC" : downgraded || degradedFallback ? "NEUTRAL" : agg.verdict;

  // Macro Flip: the circuit evaluates ONLY CURRENT/CACHED inputs — a historical VIX may
  // narrate (ARMED_FROM_LAST_CLOSE) but can never mark the circuit armed, tripped or CLEAR.
  const cv = (p) => (isCur(p) ? p.value : null);
  const macro_flip = computeMacroFlip({ vix: cv(vixP), spyPrice: cv(spyP), spyMa200: cv(maP) });
  if (macro_flip.evaluable) {
    macro_flip.state = macro_flip.tripped ? "TRIPPED" : macro_flip.armed ? "ARMED" : "CLEAR";
    macro_flip.actionability = macro_flip.tripped ? "HOLD" : macro_flip.armed ? "RESTRICTED" : "FULL";
  } else if (vixP.tier === "HISTORICAL") {
    // Carried VIX: >22 reports ARMED_FROM_LAST_CLOSE (a caution worth carrying), <=22 reports
    // UNCONFIRMED_FROM_LAST_CLOSE — pointedly NOT "not armed": absence of confirmation is not
    // a clear ("I cannot see this" ≠ "this did not happen").
    macro_flip.state = vixP.value > 22 ? "ARMED_FROM_LAST_CLOSE" : "UNCONFIRMED_FROM_LAST_CLOSE";
    macro_flip.actionability = "HOLD";
    macro_flip.reason = `latest VIX is historical (${vixP.asOf ?? "undated"}) — circuit cannot confirm`;
  } else {
    macro_flip.state = "UNCONFIRMED";
    macro_flip.actionability = "HOLD";
  }

  // ── Confidence (data quality) and actionability (may the verdict gate capital) ────────
  const criticalMissing = vixP.tier === "MISSING" || fgP.tier === "MISSING";
  let confidence;
  if (current >= 5 && currentPanicGauges === 2 && macro_flip.evaluable) confidence = "HIGH";
  else if (current >= 3 && !criticalMissing && historical <= 2) confidence = "MEDIUM";
  else confidence = "LOW";

  let actionability;
  if (agg.available < 3 || confidence === "LOW" || !macro_flip.evaluable || macro_flip.tripped === true
      || verdict === "PANIC" || !isCur(vixP) || !isCur(fgP)) actionability = "HOLD";
  else if (confidence === "HIGH" && macro_flip.tripped === false) actionability = "FULL";
  else actionability = "RESTRICTED";

  const status = confidence === "LOW" ? "DATA DEGRADED" : confidence === "MEDIUM" ? "PARTIAL DATA" : "OK";

  const reasonParts = [];
  if (historical) reasonParts.push(`${historical} check${historical === 1 ? "" : "s"} use${historical === 1 ? "s" : ""} historical observations`);
  if (missingChecks.length) reasonParts.push(`missing: ${missingChecks.join(", ")}`);
  if (!isCur(vixP)) reasonParts.push("current VIX unavailable");
  if (!isCur(fgP)) reasonParts.push("current Fear & Greed unavailable");

  return {
    spy, vix, fear_greed, qqq_spy_rs, us10y, fed_odds,
    regime: {
      verdict, checks,
      available: agg.available, usable: agg.available, bullish: agg.bullish, bearish: agg.bearish,
      current, historical, proxy: 0, missing: missingChecks.length,
      current_panic_gauges: currentPanicGauges,
      confidence, actionability, status,
      reason: reasonParts.length ? reasonParts.join("; ") : null,
      panic_inputs: { vix: isCur(vixP) ? vixP.value : null, fear_greed: isCur(fgP) ? fgP.value : null, panic },
      // What the counts alone would have said, and why that was not printed. Never silent.
      raw_verdict: agg.verdict,
      downgraded: downgraded
        ? `TAILWIND withheld — ${blindGauges.join(" and ")} unavailable, so the PANIC override cannot fire; a risk-on call needs the risk gauge`
        : null,
    },
    macro_flip,
    attribution: ["FRED (SP500/10 proxy · VIXCLS · DGS10 · NASDAQ100)", "CNN Fear & Greed", "Kalshi KXFEDDECISION"],
  };
}

// ─── Human paste block (TT integration doc §1.2) ─────────────────────────────────────────
// Compact fixed-width text for the "Copy TT readout" button — a maintainer on mobile pastes
// this into a chat. `n/a` for any null; the footer carries the honesty caveats.
export function formatTtPaste(readout, { generatedEt } = {}) {
  const r = readout || {};
  const na = (v, suffix = "") => (v == null ? "n/a" : `${v}${suffix}`);
  const pct = (v) => (v == null ? "n/a" : `${v > 0 ? "+" : ""}${v}%`);
  // Value cell: pad to a column, but always leave ≥1 space so a long label can't touch the paren.
  const cell = (s) => { s = String(s); return s.length >= 11 ? s + " " : s.padEnd(11); };
  const spy = r.spy || {}, vix = r.vix || {}, fg = r.fear_greed || {}, rs = r.qqq_spy_rs, ten = r.us10y || {}, fed = r.fed_odds, reg = r.regime || {}, flip = r.macro_flip || {};
  const lines = [];
  lines.push(`TT READOUT${generatedEt ? ` · ${generatedEt}` : ""} · macrodash.pages.dev`);
  lines.push(`SPY vs 200d  ${cell(pct(spy.pct_vs_200d))}(${na(spy.price)} / ${na(spy.sma200)}${spy.as_of ? ` · as of ${spy.as_of}` : ""})`);
  lines.push(`VIX          ${cell(na(vix.value))}(${vix.week_chg == null ? "wk n/a" : `wk ${vix.week_chg > 0 ? "+" : ""}${vix.week_chg}%`}${vix.as_of ? ` · as of ${vix.as_of}` : ""})`);
  lines.push(`F&G          ${cell(`${na(fg.value)}${fg.label ? ` ${fg.label}` : ""}`)}(${fg.as_of ? `as of ${fg.as_of}` : "n/a"})`);
  lines.push(`QQQ RS 1d    ${cell(na(rs && rs.state))}(${rs ? `QQQ ${rs.qqq_1d > 0 ? "+" : ""}${rs.qqq_1d}% vs SPY ${rs.spy_1d > 0 ? "+" : ""}${rs.spy_1d}%` : "n/a"})`);
  lines.push(`10Y TREND    ${cell(na(ten.trend))}(${na(ten.yield, "%")}${ten.m1_delta == null ? "" : ` · m1 ${ten.m1_delta > 0 ? "+" : ""}${ten.m1_delta}`})`);
  lines.push(`FED NEXT     ${fed ? `hold ${fed.hold} / cut ${fed.cut} / hike ${fed.hike}` : "n/a"}${fed && fed.next_meeting ? `  (${fed.next_meeting}${fed.days_out != null ? ` · ${fed.days_out}d` : ""})` : ""}`);
  lines.push("-".repeat(56));
  lines.push(`REGIME       ${cell(na(reg.verdict))}(${reg.bullish ?? 0} bull / ${reg.bearish ?? 0} bear · ${reg.available ?? 0} checks)`);
  // ENGINE0-CONT: the two-axis contract on the human surface — the verdict says direction,
  // this line says whether it may gate capital and why. Never a bare verdict again.
  if (reg.confidence) {
    lines.push(`EVIDENCE     ${cell(na(reg.confidence))}(actionability ${na(reg.actionability)}${reg.status && reg.status !== "OK" ? ` · ${reg.status}` : ""} · ${reg.current ?? 0} current / ${reg.historical ?? 0} historical / ${reg.missing ?? 0} missing)`);
    if (reg.reason) lines.push(`  · ${reg.reason}`);
  }
  // FEAT-DERIV-OWN (v3.41): a withheld TAILWIND must say so on the ONE surface a human reads —
  // silent here would mean the maintainer never learns the safer verdict cost them nothing.
  if (reg.downgraded) lines.push(`  ⚠ ${reg.downgraded}`);
  // A blind circuit (evaluable:false) must read as "cannot see", never as the healthy "not
  // armed" it used to collapse into. `hasFlip` distinguishes a genuinely absent macro_flip
  // (readout too old / field missing) from one that ran and came back blind. A carried-VIX
  // state (…_FROM_LAST_CLOSE) prints itself — absence of confirmation is not a clear.
  const hasFlip = flip && typeof flip.evaluable !== "undefined";
  const flipTxt = !hasFlip ? "n/a"
    : flip.evaluable === false ? (flip.state && flip.state !== "UNCONFIRMED"
        ? `${flip.state}${flip.reason ? ` — ${flip.reason}` : ""}`
        : `BLIND — missing: ${(flip.reason || "").replace(/^circuit BLIND — missing or stale: /, "")}`)
    : flip.tripped ? "TRIPPED — de-risk" : flip.armed ? "ARMED" : "not armed";
  lines.push(`MACRO FLIP   ${flipTxt}`);
  lines.push("RS basis=1d only · Fed odds = next meeting (not by-Dec) · end-of-day data · not advice");
  return lines.join("\n");
}
