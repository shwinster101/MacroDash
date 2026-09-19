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
import { publicEditionLabel } from "./publicCopy.js";

export const CALL_SCHEMA = "md-call-v1";
// FEAT-NEWCOMER-RULER (8/29): the constants moved to regime.js (the band-constants home,
// so the valuation ruler derives 26.1 from CAPE_MEAN with no second literal). Re-exported
// here so this module's public surface is unchanged.
import { CAPE_MEAN, CAPE_ATH } from "./regime.js";
export { CAPE_MEAN, CAPE_ATH };
/* v7.2 — the Sahm rule as a BEARISH-ONLY safety override. SAHM_TRIGGER is Sahm's own printed
   definition (src/sahm.js — a CITATION, never re-fitted here), and it is the SAME constant the
   labour row already reads, so the tile and the circuit can never disagree about the edge.
   Importing it HERE rather than into evidence.js or regime.js is load-bearing: the v3.88
   separation pin asserts `sahm` is absent from the band-table slice, evidence.js and
   ttReadout.js, and this override is call state, not a vote. The seat stays empty (v7.1's
   owner ruling) and the uncovered growth channel gets instrumented anyway. */
import { SAHM_TRIGGER } from "./sahm.js";
export { SAHM_TRIGGER };

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

/* The recession gauge's own provenance, resolved exactly the way macroFlipFromLive resolves the
   crash circuit's — same helper, same LIVE/CACHED vocabulary, so the two circuits cannot come to
   different conclusions about what "usable" means. It reports the reading and its mode; the
   TRIGGER comparison lives inside callFromEvidence, so the client mirror and the server build
   cannot apply different edges to the same number. */
export function sahmFromLive(live = {}, { cached = false, now = new Date() } = {}) {
  const provenance = {};
  const dataAsOf = {};
  if (finite(live.sahm)) {
    provenance.sahm = cached ? "CACHED" : "LIVE";
    const d = govAsOf(live, "sahm");
    if (d) dataAsOf.sahm = d;
  }
  return {
    value: finite(live.sahm) ? live.sahm : null,
    mode: fieldMode(provenance, dataAsOf, "sahm", now),
    as_of: dataAsOf.sahm || null,
  };
}

export function callFromEvidence(evidence, {
  macroFlip = null,
  panic = false,
  sahm = null,
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

  /* v7.2 — THE SAHM OVERRIDE. Three conditions, all required, each failing CLOSED toward "does
     not fire": the reading must be usable (LIVE or CACHED), it must carry a DATED observation,
     and it must be at or above Sahm's own trigger. `>=` is the rule's own comparison — 0.50 or
     more, as the labour row already states it.

     A BLIND OR STALE GAUGE WITHHOLDS NOTHING, and that is deliberately the OPPOSITE of the
     crash circuit's blind rule rather than an inconsistency. The v3.40 asymmetry withholds a
     risk-on call when the crash circuit cannot see, because the crash circuit is the thing that
     would SEE a crash — its silence is uninformative about the very event it exists to catch.
     A missing recession gauge makes no claim about the economy in either direction, so
     withholding on it would invent caution from an outage. Stated here for the case it does
     NOT apply to, so the difference reads as a ruling and not an oversight. */
  const s = sahm || {};
  const sahmUsable = ["LIVE", "CACHED"].includes(s.mode) && finite(s.value) && !!s.as_of;
  const sahmFired = sahmUsable && s.value >= SAHM_TRIGGER;

  let effective = base;
  let override = null;
  let downgraded = null;
  if (base && panic) {
    effective = CALL_VOCABULARY["RISK-OFF"];
    override = "PANIC";
  } else if (base && sahmFired) {
    /* BEARISH-ONLY and PANIC-SECOND. It can only ever set RISK-OFF, so no path exists by which
       it makes a call more bullish — that is the one-way property, structural rather than
       remembered. PANIC keeps precedence when both fire: a confirmed crash is the more immediate
       fact, and one override word has to own the banner (the v5.6 one-word-one-verdict rule). */
    effective = CALL_VOCABULARY["RISK-OFF"];
    override = "SAHM";
  } else if (!isDemo && base && base.direction === "BULLISH" && flip.evaluable !== true) {
    effective = CALL_VOCABULARY.MIXED;
    downgraded = "BULLISH withheld — the crash circuit cannot see; a risk-on call requires current SPY, 200-day, and VIX evidence";
  }

  const counted = Number.isFinite(e.counted) ? e.counted : 0;
  const total = Number.isFinite(e.totalFactors) ? e.totalFactors : 6;
  const confidence = counted === total && hasPosture ? "HIGH"
    : counted >= 4 && hasPosture ? "MEDIUM" : "LOW";
  /* v7.2 — ACTIONABILITY IS DELIBERATELY UNTOUCHED BY A FIRED SAHM, and the reason is
     substantive rather than scope-avoidance. This axis answers "may this call gate capital",
     and its inputs are evidence QUALITY plus the crash circuit: PANIC forces HOLD because a
     confirmed crash is a market-structure event that suspends action. A recession rule is a
     DIRECTIONAL claim, and a bearish call with full evidence is exactly the kind a reader
     should act on — HOLDing it would say "we are confident and you may not use it". Pinned in
     both directions, because the terminal's macro gate reads this field (FULL → SEND IT) and
     coupling it here would be an unannounced change to an order-gating surface. */
  const actionability = !published || confidence === "LOW" || panic || flip.evaluable !== true
    ? "HOLD"
    : confidence === "HIGH" && flip.armed !== true ? "FULL" : "RESTRICTED";
  /* SAHM takes its OWN status word rather than reusing PANIC. Two different circuits fired for
     two different reasons, and the banner and the paste block already distinguish them — a
     shared word would make the one field a machine consumer reads lie about WHICH circuit
     fired. It is keyed on `override` (the circuit that actually moved the call), never on the
     gauge, so a fired Sahm beside a PANIC day still reads PANIC. */
  const status = isDemo ? "DEMO"
    : !published ? "DATA HOLD"
    : panic ? "PANIC"
    : override === "SAHM" ? "SAHM"
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
      /* v7.2 — ADDITIVE and ALWAYS PRESENT, so a pre-7.2 stored record simply lacks the key and
         reads `fired:false` by absence rather than flipping the whole frozen history red (the
         v5.1.1 rule: failing closed on a field nobody had written yet is an outage dressed as a
         safety rule). `fired` is a fact about the GAUGE, so it can be true while `type` is not
         "SAHM" — on a withheld call there is no direction to override, and on a PANIC day the
         crash circuit owns the word. `value` is null unless the reading was usable, so an
         unusable gauge can never print a number that looks like a measurement. */
      sahm: {
        value: sahmUsable ? s.value : null,
        trigger: SAHM_TRIGGER,
        fired: sahmFired,
        as_of: s.as_of || null,
        mode: s.mode || null,
      },
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
  const sahm = sahmFromLive(live, { cached: !!opts.cached, now });
  const panicInputsUsable = ["vix", "fearGreed"].every((key) => {
    const f = evidence.factors.find((x) => x.field === key);
    return f && !f.excluded;
  });
  const panic = macroFlip.tripped === true || (panicInputsUsable && live.vix > 25 && live.fearGreed < 20);
  return callFromEvidence(evidence, {
    macroFlip, panic, sahm,
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
  const publicEd = publicEditionLabel(ed);
  const label = call.headline ? `${call.headline}${call.emoji ? ` ${call.emoji}` : ""}` : "CAN'T CALL IT 🌫️";
  const lines = [
    `MACRODASH ${publicEd} · ${call.effective_date || "undated"} · macrodash.pages.dev`,
    `${label} · ${call.direction || "DATA HOLD"}`,
    `EVIDENCE ${call.confidence || "LOW"} · actionability ${call.actionability || "HOLD"} · ${call.counts?.usable ?? 0} of ${call.counts?.total ?? 6} signals counted`,
  ];
  if (ed === "CLOSE READ") lines.push("UNSCORED · 6pm evening update — the 10am call is the scored one");
  /* v7.2 — the override line NAMES its circuit. "crash circuit tripped" was correct while PANIC
     was the only override; printing it under a SAHM would be a fabricated cause, which is the
     same defect class as a fabricated number. */
  const sahmOv = call.override?.sahm || {};
  const sahmTrig = Number.isFinite(sahmOv.trigger) ? sahmOv.trigger : SAHM_TRIGGER;
  const sahmRead = `${Number.isFinite(sahmOv.value) ? sahmOv.value.toFixed(2) : "unavailable"} vs ${sahmTrig.toFixed(2)} trigger${sahmOv.as_of ? ` · as of ${sahmOv.as_of}` : ""}`;
  if (call.override?.active) lines.push(call.override.type === "SAHM"
    ? `OVERRIDE SAHM · recession rule triggered — ${sahmRead}`
    : `OVERRIDE ${call.override.type} · crash circuit tripped`);
  else if (call.override?.macro_flip?.armed) lines.push("MACRO FLIP ARMED");
  else if (call.override?.macro_flip?.evaluable === false) lines.push("MACRO FLIP BLIND");
  /* The gauge can fire while nothing was overridden — a withheld call has no direction to move,
     and on a PANIC day the crash circuit owns the word. Stated on its own line either way: a
     fired recession rule that printed nowhere would be a red fact hidden by its own precedence
     rule (v3.25), which is exactly the case a reader would most want to know about. */
  if (sahmOv.fired && call.override?.type !== "SAHM") lines.push(
    `SAHM RULE TRIGGERED · ${sahmRead} — ${call.override?.type ? `${call.override.type} owns the override` : "no call was published to override"}`);
  if (call.downgraded) lines.push(`⚠ ${call.downgraded}`);
  for (const f of call.factors || []) {
    lines.push(`${String(f.key).padEnd(12)} ${f.state || "UNAVAILABLE"}${f.as_of ? ` · as of ${f.as_of}` : ""}${f.reason ? ` · ${f.reason}` : ""}`);
  }
  lines.push("Six-signal macro backdrop · end-of-day sources · not financial advice");
  return lines.join("\n");
}

// The friend-facing posture card is intentionally shorter than the operator paste above.
// Both consume the SAME md-call-v1 object; this formatter does not recompute a vote.
// Always exactly FIVE lines: the CLOSE READ edition swaps line 5 rather than adding one.
export function formatMacroShareCard(call = {}, { frozen = false, edition = null } = {}) {
  const ed = callEdition({ edition, frozen });
  const publicEd = publicEditionLabel(ed);
  const label = call.headline ? `${call.headline}${call.emoji ? ` ${call.emoji}` : ""}` : "CAN'T CALL IT 🌫️";
  const usable = call.counts?.usable ?? 0, total = call.counts?.total ?? 6;
  return [
    `MACRODASH ${publicEd} · ${call.effective_date || "undated"}`,
    `${label} · ${call.direction || "DATA HOLD"}`,
    `${call.confidence || "LOW"} confidence · ${usable} of ${total} signals counted`,
    "Track record: https://macrodash.pages.dev/history",
    ed === "CLOSE READ" ? "Unscored evening update · not financial advice"
      : "End-of-day macro evidence · not financial advice",
  ].join("\n");
}
