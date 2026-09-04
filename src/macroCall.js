// MacroDash v4.0 — the canonical public daily call.
//
// One public engine, two projections:
//   human   MOONING / HODL / DIAMOND HANDS
//   machine BULLISH / NEUTRAL / BEARISH
//
// The public six-factor engine in regime.js remains the only expression of the bands.
// This module only projects flat snapshot data into that engine and applies the existing
// crash circuit as an asymmetric safety override. It is pure and safe to bundle into Pages
// Functions, the React app, and Node smoke tests.

import { buildEvidenceSet, fieldMode } from "./evidence.js";
import { computeMacroFlip } from "./ttReadout.js";
import { govAsOf } from "./sources.js";

export const CALL_SCHEMA = "md-call-v1";
// FEAT-NEWCOMER-RULER (8/29): the constants moved to regime.js (the band-constants home,
// so the valuation ruler derives 26.1 from CAPE_MEAN with no second literal). Re-exported
// here so this module's public surface is unchanged.
import { CAPE_MEAN, CAPE_ATH } from "./regime.js";
export { CAPE_MEAN, CAPE_ATH };

export const CALL_VOCABULARY = Object.freeze({
  "RISK-ON":  { headline: "MOONING",       emoji: "🚀", direction: "BULLISH" },
  "MIXED":    { headline: "HODL",          emoji: "💎", direction: "NEUTRAL" },
  "RISK-OFF": { headline: "DIAMOND HANDS", emoji: "🙌", direction: "BEARISH" },
});

const voteDirection = (vote) => vote === "bull" ? "BULLISH"
  : vote === "bear" ? "BEARISH"
  : vote === "neutral" ? "NEUTRAL" : null;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const series = (v) => Array.isArray(v) && v.length >= 2 && v.every(finite);
const cleanDisplay = (v) => typeof v === "string" ? v.replace(/\s+—\s+(undefined|null)\b/g, "").trim() : v;

// Minimal no-mock projection for the public engine. Missing values are placeholders only;
// the provenance map below excludes them before REGIME_BAND_TABLE can read them.
export function regimeInputFromLive(live = {}) {
  return {
    crossAsset: { treasury10y: { m1: finite(live.tenYearM1) ? live.tenYearM1 : 0 } },
    marketPulse: {
      vix: { current: finite(live.vix) ? live.vix : 0 },
      fearGreed: {
        score: finite(live.fearGreed) ? live.fearGreed : 0,
        label: typeof live.fearGreedLabel === "string" ? live.fearGreedLabel : null,
      },
    },
    macro: {
      cpi: { trend: series(live.cpiTrend) ? live.cpiTrend : [0, 0] },
      shillerPe: {
        current: finite(live.shillerPe) ? live.shillerPe : 0,
        mean: CAPE_MEAN,
        ath: CAPE_ATH,
        pctOfAth: finite(live.shillerPe) ? (live.shillerPe / CAPE_ATH) * 100 : 0,
      },
      nfci: { current: finite(live.nfci) ? live.nfci : 0 },
    },
  };
}

// Build the same EvidenceSet the dashboard renders, directly from a flat snapshot. A factor
// is LIVE/CACHED only when every value its band needs exists; no mock value can enter the vote.
export function evidenceFromLive(live = {}, { cached = false, now = new Date() } = {}) {
  const sourceMode = cached ? "CACHED" : "LIVE";
  const requirements = {
    tenYear: finite(live.tenYear) && finite(live.tenYearM1),
    vix: finite(live.vix),
    fearGreed: finite(live.fearGreed),
    cpiHeadline: finite(live.cpiHeadline) && series(live.cpiTrend),
    shillerPe: finite(live.shillerPe),
    nfci: finite(live.nfci),
  };
  const provenance = {};
  const dataAsOf = {};
  for (const [key, usable] of Object.entries(requirements)) {
    if (!usable) continue;
    provenance[key] = sourceMode;
    const d = govAsOf(live, key);
    if (d) dataAsOf[key] = d;
  }
  return buildEvidenceSet({
    d: regimeInputFromLive(live), provenance, dataAsOf,
    mode: sourceMode, liveBuild: true, now,
  });
}

export function macroFlipFromLive(live = {}, { cached = false, now = new Date() } = {}) {
  const provenance = {};
  const dataAsOf = {};
  for (const key of ["spyPrice", "spyMa200", "vix"]) {
    if (!finite(live[key])) continue;
    provenance[key] = cached ? "CACHED" : "LIVE";
    const d = govAsOf(live, key);
    if (d) dataAsOf[key] = d;
  }
  const usable = (key) => ["LIVE", "CACHED"].includes(fieldMode(provenance, dataAsOf, key, now));
  return computeMacroFlip({
    spyPrice: usable("spyPrice") ? live.spyPrice : null,
    spyMa200: usable("spyMa200") ? live.spyMa200 : null,
    vix: usable("vix") ? live.vix : null,
  });
}

export function callFromEvidence(evidence, {
  macroFlip = null,
  panic = false,
  effectiveDate = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const e = evidence || {};
  const regime = e.regime || {};
  const isDemo = e.state === "DEMO";
  const hasPosture = !e.withheld && CALL_VOCABULARY[regime.label];
  const published = !!hasPosture && !isDemo;
  const base = hasPosture ? CALL_VOCABULARY[regime.label] : null;
  const flip = macroFlip || { evaluable: false, armed: null, tripped: null, reason: "circuit unavailable" };

  let effective = base;
  let override = null;
  let downgraded = null;
  if (base && panic) {
    effective = CALL_VOCABULARY["RISK-OFF"];
    override = "PANIC";
  } else if (!isDemo && base && base.direction === "BULLISH" && flip.evaluable !== true) {
    effective = CALL_VOCABULARY.MIXED;
    downgraded = "BULLISH withheld — the crash circuit cannot see; a risk-on call requires current SPY, 200-day, and VIX evidence";
  }

  const counted = Number.isFinite(e.counted) ? e.counted : 0;
  const total = Number.isFinite(e.totalFactors) ? e.totalFactors : 6;
  const confidence = counted === total && hasPosture ? "HIGH"
    : counted >= 4 && hasPosture ? "MEDIUM" : "LOW";
  const actionability = !published || confidence === "LOW" || panic || flip.evaluable !== true
    ? "HOLD"
    : confidence === "HIGH" && flip.armed !== true ? "FULL" : "RESTRICTED";
  const status = isDemo ? "DEMO"
    : !published ? "DATA HOLD"
    : panic ? "PANIC"
    : confidence === "MEDIUM" ? "PARTIAL DATA" : "OK";

  const factors = Array.isArray(e.factors) ? e.factors.map((f) => ({
    key: f.key,
    label: f.label,
    state: voteDirection(f.vote),
    display: cleanDisplay(f.display),
    mode: f.mode,
    as_of: f.asOf || null,
    excluded: !!f.excluded,
    reason: f.reason || null,
  })) : [];
  const counts = factors.reduce((a, f) => {
    if (f.excluded || !f.state) a.unavailable++;
    else a[f.state.toLowerCase()]++;
    return a;
  }, { bullish: 0, neutral: 0, bearish: 0, unavailable: 0, usable: counted, total });

  return {
    schema: CALL_SCHEMA,
    effective_date: effectiveDate,
    generated_at: generatedAt,
    published,
    headline: effective ? effective.headline : null,
    emoji: effective ? effective.emoji : null,
    direction: effective ? effective.direction : null,
    base_direction: base ? base.direction : null,
    confidence,
    actionability,
    status,
    override: {
      type: override,
      active: !!override,
      panic: !!panic,
      macro_flip: {
        evaluable: flip.evaluable === true,
        armed: flip.armed ?? null,
        tripped: flip.tripped ?? null,
        reason: flip.reason || null,
      },
    },
    downgraded,
    counts,
    factors,
  };
}

export function buildMacroCall(live = {}, opts = {}) {
  const now = opts.now || new Date();
  const evidence = evidenceFromLive(live, { cached: !!opts.cached, now });
  const macroFlip = macroFlipFromLive(live, { cached: !!opts.cached, now });
  const panicInputsUsable = ["vix", "fearGreed"].every((key) => {
    const f = evidence.factors.find((x) => x.field === key);
    return f && !f.excluded;
  });
  const panic = macroFlip.tripped === true || (panicInputsUsable && live.vix > 25 && live.fearGreed < 20);
  return callFromEvidence(evidence, {
    macroFlip, panic,
    effectiveDate: opts.effectiveDate || null,
    generatedAt: opts.generatedAt || now.toISOString(),
  });
}

/* 8/28 clock matrix A10: the operator paste stamped "DAILY CALL" on frozen and unfrozen
   postures alike — the strongest official-call claim on the weakest evidence of being it,
   while the share-card sibling below had split since v5.5. Both builders now use ONE word
   pair: 10AM CALL (frozen artifact) / LIVE READ (current recomputation).
   v6.2 — a THIRD edition, CLOSE READ, for the 6pm unscored record. The edition is an
   ENVELOPE word: md-call-v1 itself never carries an edition axis (validFrozenCall,
   captureDailyCall and the tt-alloc binding cannot see it), so both builders take it as an
   option. `frozen` keeps its meaning as the 10AM CALL shorthand; an UNKNOWN edition falls
   to LIVE READ — the weakest claim, never the official one (fail closed on the label). */
export const CALL_EDITIONS = Object.freeze(["10AM CALL", "CLOSE READ", "LIVE READ"]);
export function callEdition({ edition = null, frozen = false } = {}) {
  if (edition == null) return frozen ? "10AM CALL" : "LIVE READ";
  return CALL_EDITIONS.includes(edition) ? edition : "LIVE READ";
}
export function formatMacroCallPaste(call = {}, { frozen = false, edition = null } = {}) {
  const ed = callEdition({ edition, frozen });
  const label = call.headline ? `${call.headline}${call.emoji ? ` ${call.emoji}` : ""}` : "CAN'T CALL IT 🌫️";
  const lines = [
    `MACRODASH ${ed} · ${call.effective_date || "undated"} · macrodash.pages.dev`,
    `${label} · ${call.direction || "DATA HOLD"}`,
    `EVIDENCE ${call.confidence || "LOW"} · actionability ${call.actionability || "HOLD"} · ${call.counts?.usable ?? 0} of ${call.counts?.total ?? 6} voters counted`,
  ];
  if (ed === "CLOSE READ") lines.push("UNSCORED · 6pm close read — the 10am call is the scored one");
  if (call.override?.active) lines.push(`OVERRIDE ${call.override.type} · crash circuit tripped`);
  else if (call.override?.macro_flip?.armed) lines.push("MACRO FLIP ARMED");
  else if (call.override?.macro_flip?.evaluable === false) lines.push("MACRO FLIP BLIND");
  if (call.downgraded) lines.push(`⚠ ${call.downgraded}`);
  for (const f of call.factors || []) {
    lines.push(`${String(f.key).padEnd(12)} ${f.state || "UNAVAILABLE"}${f.as_of ? ` · as of ${f.as_of}` : ""}${f.reason ? ` · ${f.reason}` : ""}`);
  }
  lines.push("Six-factor macro backdrop · end-of-day sources · not financial advice");
  return lines.join("\n");
}

// The friend-facing posture card is intentionally shorter than the operator paste above.
// Both consume the SAME md-call-v1 object; this formatter does not recompute a vote.
// Always exactly FIVE lines: the CLOSE READ edition swaps line 5 rather than adding one.
export function formatMacroShareCard(call = {}, { frozen = false, edition = null } = {}) {
  const ed = callEdition({ edition, frozen });
  const label = call.headline ? `${call.headline}${call.emoji ? ` ${call.emoji}` : ""}` : "CAN'T CALL IT 🌫️";
  const usable = call.counts?.usable ?? 0, total = call.counts?.total ?? 6;
  return [
    `MACRODASH ${ed} · ${call.effective_date || "undated"}`,
    `${label} · ${call.direction || "DATA HOLD"}`,
    `${call.confidence || "LOW"} confidence · ${usable} of ${total} voters counted`,
    "Track record: https://macrodash.pages.dev/history",
    ed === "CLOSE READ" ? "Unscored close read · not financial advice"
      : "End-of-day macro evidence · not financial advice",
  ].join("\n");
}
