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
  // v3.98.3: hand the engine the REAL exclusion cause per factor. fieldMode already knows it;
  // without this the display string guessed "STALE" for every exclusion, including dead feeds.
  const reasons = new Map();
  for (const key of exclusions) {
    const field = FACTOR_FIELD[key];
    const fm = fieldMode(provenance, dataAsOf, field, now);
    reasons.set(key, { kind: fm === "STALE" ? "stale" : "nofeed",
                       asOf: (dataAsOf && dataAsOf[field]) || null });
  }
  const rows = regimeFactors(d, exclusions, reasons);
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
      // v3.98.3 (owner voice rules): say it the way a person would. Same two states, same
      // gate — "stale for its cadence" / "not live in a live build" was memo-speak.
      reason: !excluded ? null
        : fm === "STALE" ? "too old for how often it updates"
        : "no live feed right now",
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
  // v3.98.2 (owner voice rules): the Power one-liner talks retail too — factors "lean
  // bullish/bearish", unusable ones are "dark". Same buckets, same honesty, sharper words.
  if (buckets.supports.length)  parts.push(`${listOf(names("supports"))} lean${buckets.supports.length === 1 ? "s" : ""} bullish`);
  if (buckets.addsRisk.length)  parts.push(`${listOf(names("addsRisk"))} lean${buckets.addsRisk.length === 1 ? "s" : ""} bearish`);
  if (buckets.neutral.length)   parts.push(`${listOf(names("neutral"))} ${buckets.neutral.length === 1 ? "is" : "are"} neutral`);
  if (buckets.unavailable.length) parts.push(`${listOf(names("unavailable"))} ${buckets.unavailable.length === 1 ? "is" : "are"} dark`);
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
      ? `The bull case right now: ${listOf(buckets.supports.map(verbOf("plainBull")))}.`
      : "No clear bull case on the board right now.",
    against: buckets.addsRisk.length
      ? `The bear case: ${listOf(buckets.addsRisk.map(verbOf("plainBear")))}.`
      : "No clear bear case on the board right now.",
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

/* ═══ SIMPLE MODE PROJECTIONS (v4.0) ══════════════════════════════════════════
   Simple is an ORIENTATION LAYER: it projects the EvidenceSet the engine already
   built and decides nothing. No thresholds, no votes, no freshness rules live here —
   every one of those has exactly one home upstream, and a second copy in a
   presentation projection is the drift defect this repo keeps paying for.
   All three functions are pure and Node-importable, the postureSummary pattern. */

// The scoped plain-language verdict. SCOPED on purpose: "MACRO:" says which engine is
// speaking — this six-factor BACKDROP vote, not /readout.json's order-gating checks
// (v3.51 named them) and not a position stance. That prefix is load-bearing, not
// decoration: it is what keeps "HODL" readable as "the evidence has no edge" rather
// than as advice to hold a position.
export const SIMPLE_VERDICTS = { "RISK-ON": "BULLISH", "MIXED": "HODL", "RISK-OFF": "BEARISH" };
export const SIMPLE_WITHHELD = "DATA HOLD";
export function simpleVerdict(ev) {
  if (!ev) return { label: SIMPLE_WITHHELD, tone: "muted", withheld: true };
  // LOADING / ERROR / INSUFFICIENT are the withheld states (WITHHELD above). DEMO is
  // deliberately NOT among them: a demo build publishes a posture by design (mock IS its
  // baseline — the demoted()/anyLive doctrine), and the ILLUSTRATIVE treatment is what
  // marks it. Conflating DEMO with DATA HOLD would break the demo build on purpose.
  if (ev.withheld) return { label: SIMPLE_WITHHELD, tone: "muted", withheld: true };
  const label = SIMPLE_VERDICTS[ev.regime && ev.regime.label];
  if (!label) return { label: SIMPLE_WITHHELD, tone: "muted", withheld: true };
  return { label, tone: label === "BULLISH" ? "good" : label === "BEARISH" ? "bad" : "warn", withheld: false };
}

// vote → the card's direction word. THREE directions, FOUR votes: "excluded" is not a
// direction and never becomes one — "not counted" and "counted, no lean" are different
// facts (the whole v3.62 lesson), so an excluded factor is dropped from selection below
// rather than rendered as "mixed".
export const DIRECTION_OF = { bull: "helping", bear: "hurting", neutral: "mixed" };

/* Up to `max` parameter cards, projected from ev.factors.
   - EXCLUDED factors are not eligible AT ALL. A card is a claim about a current usable
     reading; an excluded factor has none. Nor do we pad to `max` with UNAVAILABLE
     placeholders — that would present absence as content. Fewer cards, and the caller
     states the shortfall.
   - Order follows the posture (what a reader most needs to see first), then canonical
     REGIME_BAND_TABLE order for ties. Deliberately NO numeric importance score: an
     invented ranking would be a decision, and Simple decides nothing.
   - `usable`/`shown` are returned so the caller can NAME the truncation — three of six
     means half the evidence is off-screen, and silent truncation reads as full coverage
     (the v3.65 / v3.76 rule). */
/* The card's CURRENT VALUE. `display` is built for the Power matrix, so it carries the
   judgment inline ("14.63 — Low (bullish)", "-0.62 SD — ≥½ SD below mean (bullish)"). On a
   card that already has a direction chip that is the same fact twice, and the band jargon is
   Power-grade language in a newcomer surface. This PROJECTS the measurement out of the
   string — it never invents one: no separator and no parenthetical means the string is
   returned whole. */
export function metricOf(display) {
  const t = String(display == null ? "" : display);
  const head = t.split(" — ")[0];
  return head.replace(/\s*\((bullish|bearish|neutral)\)\s*$/i, "").trim() || t;
}

export function simpleCards(ev, max = 3) {
  const factors = (ev && Array.isArray(ev.factors)) ? ev.factors : [];
  const usableRows = factors.filter((f) => !f.excluded && DIRECTION_OF[f.vote]);
  const pick = (v) => usableRows.filter((f) => f.vote === v);   // canonical order preserved
  const bull = pick("bull"), bear = pick("bear"), neutral = pick("neutral");
  const posture = (ev && ev.regime && ev.regime.label) || "MIXED";
  /* The OPPOSING side must survive the truncation. Found in the Chromium read-through: on a
     RISK-ON day with three supports the plain "supports first, then risks" order filled all
     three slots with HELPING cards while the sentence above them said "…but real risks are
     still in play" — the reader saw a stated risk the cards did not show. So the last slot
     is RESERVED for the other side whenever one exists. Same instinct as the v3.25 rule that
     a collapse never hides a red fact: a summary that drops the counter-evidence is not a
     summary, it is a lean. */
  const withCounter = (lead, counter, rest) => {
    if (!counter.length || lead.length < max) return [...lead, ...counter, ...rest];
    return [...lead.slice(0, max - 1), counter[0], ...lead.slice(max - 1), ...counter.slice(1), ...rest];
  };
  let ordered;
  if (posture === "RISK-ON")       ordered = withCounter(bull, bear, neutral);
  else if (posture === "RISK-OFF") ordered = withCounter(bear, bull, neutral);
  else {
    // HODL/withheld: interleave so the reader sees BOTH sides, not one side twice.
    ordered = [];
    for (let i = 0; i < Math.max(bull.length, bear.length); i++) {
      if (bull[i]) ordered.push(bull[i]);
      if (bear[i]) ordered.push(bear[i]);
    }
    ordered.push(...neutral);
  }
  const cards = ordered.slice(0, max).map((f) => {
    const band = REGIME_BAND_TABLE.find((t) => t.key === f.key);
    return {
      key: f.key, short: f.short,
      label: (band && band.plain) || f.label,       // plain-language parameter name
      currentValue: metricOf(f.display),
      direction: DIRECTION_OF[f.vote],
      why: (band && band.whyItMatters) || null,     // never fabricated if a band lacks one
      mode: f.mode, asOf: f.asOf,
    };
  });
  return { cards, usable: usableRows.length, shown: cards.length, total: factors.length };
}

/* The one Simple sentence. Same rows as the cards — one derivation, so it can never
   contradict them. v4.0.1 (owner copy pass, 2026-08-17) REVERSES v4.0.0's "never list the
   factors" ruling: the owner's read of the live page asked for exactly the named form —
   "Volatility and sentiment are supportive, but stocks are priced for perfection" — the
   cards carry the numbers, the sentence carries the names, and that is division of labor,
   not duplication. Vocabulary comes from REGIME_BAND_TABLE (plain nouns for the supportive
   list, each factor's own plainBear verb phrase for the risk side) — no third copy-table.
   A single supportive factor speaks its plainBull PHRASE ("inflation is cooling") rather
   than "<noun> are supportive", because noun-count agreement ("financial conditions is
   supportive") cannot be made safe for one item. */
export function simpleSentence(ev) {
  if (!ev || ev.withheld) return null;   // a withheld posture has no "why" — the shortfall line renders instead
  const f = (ev.factors || []).filter((x) => !x.excluded);
  const bandOf = (x) => REGIME_BAND_TABLE.find((t) => t.key === x.key);
  const nounOf = (x) => { const b = bandOf(x); return (b && b.plain) || x.label || x.key; };
  const bullOf = (x) => { const b = bandOf(x); return (b && b.plainBull) || `${nounOf(x)} is supportive`; };
  const bearOf = (x) => { const b = bandOf(x); return (b && b.plainBear) || `${nounOf(x)} is working against it`; };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const bullRows = f.filter((x) => x.vote === "bull");
  const bears = f.filter((x) => x.vote === "bear").map(bearOf);
  const bullLead = bullRows.length === 1
    ? cap(bullOf(bullRows[0]))
    : `${cap(listOf(bullRows.map(nounOf)))} are supportive`;
  if (bullRows.length && bears.length) return `${bullLead}, but ${listOf(bears)}.`;
  if (bullRows.length) return `${bullLead}, and nothing we track is working against the market right now.`;
  if (bears.length)    return `${cap(listOf(bears))}, and nothing we track is clearly supportive right now.`;
  return "Nothing we track has a clear lean right now.";
}

/* "What would change the call" — reads flipConditions' OWN output and derives nothing.
   Inventing a threshold here would be a fabricated number in a decision surface. */
export function simpleFlipLine(ev) {
  if (!ev || ev.withheld) return "Call withheld until the required evidence is current and usable.";
  const nearest = ev.flips && Array.isArray(ev.flips.flips) ? ev.flips.flips[0] : null;
  if (!nearest) return "No single metric would change the call on its own.";
  return `${nearest.copy} would move this to ${nearest.would}.`;
}
