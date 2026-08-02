// src/whatChanged.js — MacroDash v3.60 (C4, UX-re-audit sprint) — the return-visit digest.
//
// PURE, React-free, Node-importable. A return user should see what MATERIALLY moved since
// the last valid snapshot rather than rereading every tile. Three rules, each with precedent:
//   1. Only a QUORATE, non-withheld, live-build EvidenceSet may become the baseline — a
//      baseline made of mock or thin evidence would diff noise (FEAT-QUORUM's spirit).
//   2. A first visit says "baseline set", never "nothing changed" — those are different
//      facts (the TT terminal's diffSince rule, applied to the public page).
//   3. "No material change" is an explicit state, never a blank (the flipConditions
//      "no single flip" rule — an empty answer is stated, not omitted).

export const LASTVALID_KEY = "md:lastvalid:v1";

// A summary is the persisted shape — small, versioned, and carrying only what compare()
// reads, so localStorage never becomes an accidental data store.
export function summarizeEvidence(ev, at = null) {
  if (!ev || ev.withheld || ev.state === "DEMO" || ev.regime.insufficient) return null;
  return {
    v: 1,
    at: at || new Date().toISOString(),
    posture: ev.regime.label,
    counted: ev.counted,
    factors: Object.fromEntries(ev.factors.map((f) => [f.key, { vote: f.vote, mode: f.mode }])),
  };
}

// Diff two summaries into material changes. `prev` may be null (first visit) or a
// wrong-version/garbled record (treated as first visit — fail toward "baseline set",
// never toward inventing a diff against a shape we do not understand).
export function compareEvidence(prev, cur) {
  if (!cur) return null;
  if (!prev || prev.v !== 1 || !prev.factors) return { baseline: true, since: null, changes: [] };
  const changes = [];
  if (prev.posture !== cur.posture)
    changes.push({ kind: "posture", from: prev.posture, to: cur.posture,
      text: `Posture ${prev.posture} → ${cur.posture}` });
  if (prev.counted !== cur.counted)
    changes.push({ kind: "confidence", from: prev.counted, to: cur.counted,
      text: `Evidence base ${prev.counted} → ${cur.counted} of 6 factors usable` });
  for (const [key, c] of Object.entries(cur.factors)) {
    const p = prev.factors[key];
    if (!p) continue; // a factor added since the baseline has no honest "from"
    if (p.vote !== c.vote) {
      const label = key === "cpiHeadline" ? "CPI" : key === "fearGreed" ? "F&G"
        : key === "tenYear" ? "10Y" : key === "valuation" ? "CAPE" : key.toUpperCase();
      changes.push({ kind: "vote", key, from: p.vote, to: c.vote,
        text: c.vote === "excluded" ? `${label} dropped out (${p.vote} → excluded)`
          : p.vote === "excluded" ? `${label} recovered (now voting ${c.vote})`
          : `${label} flipped ${p.vote} → ${c.vote}` });
    }
  }
  return { baseline: false, since: prev.at, changes };
}
