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

  // Per-factor rows: display copy from regimeFactors, the VOTE from the band table itself
  // (the only expression of a band), freshness from fieldMode. An excluded factor's vote is
  // "excluded" with the reason named — "4 of 6 usable" without saying which is half a fact.
  const rows = regimeFactors(d, exclusions);
  const factors = rows.map((f) => {
    const field = FACTOR_FIELD[f.key];
    const fm = fieldMode(provenance, dataAsOf, field, now);
    const excluded = exclusions.has(f.key);
    const band = REGIME_BAND_TABLE.find((t) => t.key === f.key);
    return {
      key: f.key, short: f.short, label: f.label, field,
      display: f.val,
      vote: excluded ? "excluded" : band.vote(band.read(d), d),
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
  };
}
