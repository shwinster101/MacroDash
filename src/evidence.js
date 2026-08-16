// src/evidence.js — MacroDash v3.60 (C1, UX-re-audit sprint) — the EvidenceSet contract.
//
// PURE, React-free, Node-importable. This is the typed state the re-audit (and the 11.4.5
// audit before it) named as the highest-leverage improvement: ONE derivation of "what state
// is the page in, what voted, what was excluded and why" that components RENDER — instead of
// each component re-interpreting provenance/MOCK_DATA on its own.
//
// It WRAPS, never re-derives: computeRegime/flipConditions/regimeFactors come from regime.js,
// staleness from sources.js — the ptModelRows rule (one computation, many altitudes). The
// state names map 1:1 onto the re-audit's interface-state contract:
//
//   LOADING       fetch in flight             → posture withheld, nothing narrates
//   LIVE          fresh snapshot, quorate     → posture published
//   CACHED        today's KV snapshot         → publishable, named CACHED (fresh ≠ live, B2)
//   DEGRADED      quorate but factors excluded → publish with the exclusions named
//   INSUFFICIENT  below REGIME_QUORUM         → posture withheld, count + missing named
//   ERROR         live fetch failed           → posture withheld, retry offered (B1)
//   DEMO          mock build                  → demo posture allowed, everything ILLUSTRATIVE

import { isStale, cadenceOf } from "./sources.js";
// REGIME_BAND_TABLE is read here ONLY for each factor's plain-English name (`plain`), which
// postureSummary needs. The VOTE is no longer re-derived from it: since FEAT-NEUTRAL (v3.62)
// regimeFactors carries the vote it already derived, so a threshold has one consumer, not two.
import { REGIME_BAND_TABLE, REGIME_QUORUM, computeRegime, flipConditions, regimeFactors } from "./regime.js";

// The six regime voters by SOURCES field key (the staleness vocabulary), plus the one
// factor-key alias: the valuation factor's field is shillerPe. Moved here from dashboard.jsx
// so the exclusion derivation has exactly one home.
export const REGIME_FACTOR_FIELDS = ["tenYear", "vix", "fearGreed", "cpiHeadline", "nfci"];
export const FACTOR_FIELD = {
  tenYear: "tenYear", vix: "vix", fearGreed: "fearGreed",
  cpiHeadline: "cpiHeadline", valuation: "shillerPe", nfci: "nfci",
};

// Cadence-aware per-field mode: LIVE | CACHED | STALE | MOCK. The same rule the dashboard's
// modeOf always applied — now importable, so the two can never drift.
export function fieldMode(provenance, dataAsOf, key, now = new Date()) {
  const m = (provenance && provenance[key]) || "MOCK";
  return (m === "LIVE" || m === "CACHED") && isStale(dataAsOf && dataAsOf[key], now, cadenceOf(key)) ? "STALE" : m;
}

// Which factors may NOT vote. STALE always excludes; in a live build anything not LIVE/CACHED
// excludes too (FEAT-QUORUM v3.54 — mock must never vote; `liveBuild` is the INTENT, because
// mode "MOCK" is ambiguous between a demo build and a live build whose fetch failed).
export function factorExclusions({ provenance, dataAsOf, liveBuild, now = new Date() } = {}) {
  const unusable = (k) => {
    const m = fieldMode(provenance, dataAsOf, k, now);
    return m === "STALE" || (liveBuild && m !== "LIVE" && m !== "CACHED");
  };
  const stale = new Set(REGIME_FACTOR_FIELDS.filter(unusable));
  if (unusable("shillerPe")) stale.add("valuation");
  return stale;
}

const WITHHELD = new Set(["LOADING", "ERROR", "INSUFFICIENT"]);

export function buildEvidenceSet({ d, provenance, dataAsOf, mode, liveBuild, now = new Date() } = {}) {
  const exclusions = factorExclusions({ provenance, dataAsOf, liveBuild, now });
  const regime = computeRegime(d, exclusions);

  // State resolution order matters: transport states first (they describe the FETCH, and the
  // regime computed under them is vacuous), then build intent, then evidence quality.
  const state =
    mode === "LOADING" ? "LOADING"
    : mode === "ERROR" ? "ERROR"
    : !liveBuild ? "DEMO"
    : regime.insufficient ? "INSUFFICIENT"
    : exclusions.size ? "DEGRADED"
    : mode === "CACHED" ? "CACHED" : "LIVE";
  const withheld = WITHHELD.has(state);

  // Per-factor rows: display copy AND the vote both come from regimeFactors, which since
  // FEAT-NEUTRAL (v3.62) derives the vote from REGIME_BAND_TABLE itself (the only expression
  // of a band) and already resolves an excluded factor to "excluded". This used to re-derive
  // `band.vote(...)` here — correct, but a second call site for the same rule; now there is
  // one. Freshness still comes from fieldMode. An excluded factor's vote is "excluded" with
  // the reason named — "4 of 6 usable" without saying which is half a fact.
  const rows = regimeFactors(d, exclusions);
  const factors = rows.map((f) => {
    const field = FACTOR_FIELD[f.key];
    const fm = fieldMode(provenance, dataAsOf, field, now);
    const excluded = exclusions.has(f.key);
    return {
      key: f.key, short: f.short, label: f.label, field,
      display: f.val,
      vote: f.vote,
      mode: fm,
      asOf: (dataAsOf && dataAsOf[field]) || null,
      excluded,
      reason: !excluded ? null
        : fm === "STALE" ? "stale for its cadence"
        : "not live in a live build",
    };
  });

  // Flip conditions only when a posture exists — there is nothing to flip on a withheld one.
  const flips = withheld ? null : flipConditions(d, exclusions);

  return {
    state, withheld, regime, factors, flips,
    quorum: REGIME_QUORUM,
    counted: regime.counted,
    totalFactors: regime.totalFactors,
    freshSummary: `${regime.counted}/${regime.totalFactors} factors usable`,
    excludedKeys: factors.filter((f) => f.excluded).map((f) => f.short),
    summary: postureSummary(factors),
  };
}

/* FEAT-WHY (v3.62) — "why this posture", in words, from the SAME factor rows.

   The newcomer audit's finding was that the verdict is defensible but not legible: every
   input was on screen, and the reader had to reconstruct the conclusion from six abbreviated
   chips and a threshold table. This states it once, in plain English.

   It is a PROJECTION of `factors`, never a second opinion — the buckets are the votes those
   rows already carry, so the sentence cannot contradict the chips, the matrix or the tally.
   Each factor's noun phrase (`plain`) lives on its band in REGIME_BAND_TABLE, beside the rule
   it describes, so there is no parallel copy-table to drift. An excluded factor is reported as
   UNAVAILABLE and never silently folded into "neutral" — "not counted" and "counted, no lean"
   are different facts, which is the whole lesson of this release. */
const listOf = (xs) => xs.length <= 1 ? (xs[0] || "")
  : xs.length === 2 ? `${xs[0]} and ${xs[1]}`
  : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

export function postureSummary(factors = []) {
  const plainOf = (f) => {
    const band = REGIME_BAND_TABLE.find((t) => t.key === f.key);
    return (band && band.plain) || f.label;
  };
  const pick = (v) => factors.filter((f) => f.vote === v);
  const buckets = {
    supports:    pick("bull"),
    neutral:     pick("neutral"),
    addsRisk:    pick("bear"),
    unavailable: pick("excluded"),
  };
  const names = (k) => buckets[k].map(plainOf);
  const parts = [];
  if (buckets.supports.length)  parts.push(`${listOf(names("supports"))} support${buckets.supports.length === 1 ? "s" : ""} risk`);
  if (buckets.addsRisk.length)  parts.push(`${listOf(names("addsRisk"))} add${buckets.addsRisk.length === 1 ? "s" : ""} risk`);
  if (buckets.neutral.length)   parts.push(`${listOf(names("neutral"))} ${buckets.neutral.length === 1 ? "is" : "are"} neutral`);
  if (buckets.unavailable.length) parts.push(`${listOf(names("unavailable"))} ${buckets.unavailable.length === 1 ? "is" : "are"} unavailable`);
  // No usable evidence at all is a real state (LOADING, or a live build with a dead feed) and
  // must read as an absence, not as a balanced picture.
  const sentence = parts.length
    ? parts.join("; ").replace(/^./, (c) => c.toUpperCase()) + "."
    : "No factor is currently usable, so nothing is being asserted.";
  // v3.97 SHAREABLE SIMPLE — the newbie prose: the SAME buckets rendered as two directional
  // sentences for the Simple hero. A bare noun list misleads a first-time reader ("working
  // for the market: inflation" reads as inflation-is-good when the factor is bullish because
  // inflation is COOLING), so each factor speaks through its `plainBull`/`plainBear` verb
  // phrase from the band table, falling back to the `plain` noun if a pair is missing —
  // fail toward the old copy, never a blank. Both buckets empty → null (the sentence above
  // covers it; two "nothing" sentences would be filler).
  const verbOf = (side) => (f) => {
    const band = REGIME_BAND_TABLE.find((t) => t.key === f.key);
    return (band && band[side]) || (band && band.plain) || f.label;
  };
  const prose = (buckets.supports.length || buckets.addsRisk.length) ? {
    for: buckets.supports.length
      ? `Working for the market right now: ${listOf(buckets.supports.map(verbOf("plainBull")))}.`
      : "Nothing is clearly working for the market right now.",
    against: buckets.addsRisk.length
      ? `Working against it: ${listOf(buckets.addsRisk.map(verbOf("plainBear")))}.`
      : "Nothing is clearly working against it right now.",
  } : null;
  return {
    sentence,
    prose,
    groups: [
      { key: "supports",    label: "SUPPORTS",    vote: "bull",     shorts: buckets.supports.map((f) => f.short) },
      { key: "neutral",     label: "NEUTRAL",     vote: "neutral",  shorts: buckets.neutral.map((f) => f.short) },
      { key: "addsRisk",    label: "ADDS RISK",   vote: "bear",     shorts: buckets.addsRisk.map((f) => f.short) },
      { key: "unavailable", label: "UNAVAILABLE", vote: "excluded", shorts: buckets.unavailable.map((f) => f.short) },
    ],
  };
}
