// MacroDash v6.1.0 — the ranked headline layer. PURE: no React, no network, no LLM, $0.
// Node-importable; smoke RUNS it (a ranking is a claim about order, and a string pin cannot
// prove one). Imported by src/fiveWhys.js (WHY #3) and functions/api/snapshot.js
// (fetchHeadlines) — the third functions→src import, same esbuild-inline path as the others.
//
// DOCTRINE (v3.51 FEAT-WHY3-MATERIAL, restated for a RANKER — the original rule was written
// about ONE item and its "never scored" clause was about the WITHHOLD decision):
//   · The allowlist decision is ONE-WAY and is never scored. A title either matches a
//     macro-transmission term or it is withheld; a withheld title is never rewritten.
//   · The score below ORDERS items that have already passed that gate. It can never admit
//     one, it never appears on any surface as a number, and it is stripped before storage.
//   · Headlines are context only and never cast a vote.
//
// ⚠ Curated, like MARKET_HOLIDAYS. The terms are the v3.51 allowlist VERBATIM, now grouped as
// DATA rather than as comments, so isMacroMaterial() is behaviourally byte-identical (MACRO_TERMS
// is DERIVED from this table). The weights are ASSERTED, owner-tunable — one edit + one red pin
// — and spaced so recency can order WITHIN a category but never flip one (score = weight × 100
// + recency, recency ≤ 72). A title that matches several categories takes the MAX weight,
// never a sum: a sum would reward keyword stuffing.
import { etYmd } from "./sources.js";

export const HEADLINE_CATEGORIES = Object.freeze([
  { key: "policy", weight: 7, terms: [
    "fed", "fomc", "powell", "rate cut", "rate hike", "central bank", "ecb", "boj", "monetary",
    "quantitative", "basis point", "bps", "tightening", "easing",
  ] },
  { key: "inflation", weight: 6, terms: [
    "inflation", "cpi", "pce", "deflation", "price index", "wage growth",
  ] },
  { key: "rates_credit", weight: 5, terms: [
    "treasury", "yield", "bond", "credit spread", "default", "downgrade", "debt ceiling",
    "dollar", "currency",
  ] },
  { key: "market_wide", weight: 4, terms: [
    "stocks", "equities", "s&p", "nasdaq", "dow", "selloff", "sell-off", "rally", "correction",
    "bear market", "bull market", "volatility", "vix", "risk-off", "risk off", "drawdown",
    "futures", "index", "benchmark",
  ] },
  { key: "growth_labor", weight: 3, terms: [
    "gdp", "recession", "jobs report", "payroll", "unemployment", "jobless", "labor market",
    "consumer spending", "retail sales", "manufacturing", "ism", "pmi",
  ] },
  { key: "energy", weight: 2, terms: [
    "oil", "crude", "opec", "energy prices", "gold",
  ] },
  { key: "systemic", weight: 1, terms: [
    "tariff", "trade war", "sanctions", "war", "shutdown", "banking crisis", "bank failure",
    "contagion", "sovereign", "stimulus",
  ] },
  // the RESOLUTION of a geopolitical shock moves the tape as much as its onset
  { key: "resolution", weight: 1, terms: ["peace", "ceasefire", "truce"] },
]);

// DERIVED, never hand-copied — the one-table rule (a second copy of a threshold is the drift
// defect this repo keeps paying for; a second copy of an allowlist is the same defect).
export const MACRO_TERMS = Object.freeze(HEADLINE_CATEGORIES.flatMap((c) => c.terms));

export function isMacroMaterial(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return MACRO_TERMS.some((k) => t.includes(k));
}

// Highest-weight matching category, or null. The table is ordered by weight (desc), so the
// first match IS the max — and an equal-weight tie resolves by table order, which is stated.
export function categoryOf(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  for (const c of HEADLINE_CATEGORIES) if (c.terms.some((k) => t.includes(k))) return c;
  return null;
}

export const RECENCY_MAX_H = 72;
export function recencyPoints(pubMs, nowMs) {
  const ageH = (nowMs - pubMs) / 3600000;
  return Math.round(Math.max(0, Math.min(RECENCY_MAX_H, RECENCY_MAX_H - ageH)));
}

// Near-duplicate collapse: two wires carrying one story. Token-set Jaccard on the normalized
// title, OR an identical first-8-token prefix (syndicated rewrites keep the lead and change
// the tail). Asserted, boundary-pinned.
export const NEAR_DUP_JACCARD = 0.6;
export const NEAR_DUP_PREFIX_TOKENS = 8;
export function normalizeTitle(t) {
  return String(t || "").toLowerCase().replace(/[^a-z0-9$&%.]+/g, " ").trim().split(/\s+/).filter(Boolean);
}
export function titleSimilarity(a, b) {
  const A = new Set(normalizeTitle(a)), B = new Set(normalizeTitle(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
export function isNearDuplicate(a, b) {
  if (titleSimilarity(a, b) >= NEAR_DUP_JACCARD) return true;
  const pa = normalizeTitle(a).slice(0, NEAR_DUP_PREFIX_TOKENS), pb = normalizeTitle(b).slice(0, NEAR_DUP_PREFIX_TOKENS);
  return pa.length === NEAR_DUP_PREFIX_TOKENS && pa.join(" ") === pb.join(" ");
}

// Score for ORDER only (see the doctrine above). Exported for the boundary pins.
export function scoreHeadline(title, pubMs, nowMs) {
  const c = categoryOf(title);
  return (c ? c.weight : 0) * 100 + recencyPoints(pubMs, nowMs);
}

/* rankHeadlines(items, now, opts) → the top-N, each { rank, title, source, as_of, category }.
   items: [{ title, source, pubDate | pubMs, feedIndex, itemIndex }]. Order of operations is
   the contract and is pinned: drop untitled/undated → date gate (≤ maxAgeDays old, ≤ 1 day
   in the future for clock skew) → the ONE-WAY allowlist → score → sort (score desc, then
   feed order, then item order, then title — stable across runs) → near-duplicate collapse,
   keeping the first survivor → slice. The score never leaves this function. */
export function rankHeadlines(items, now = new Date(), { limit = 3, maxAgeDays = 3, futureSlackDays = 1 } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Array.isArray(items) || !Number.isFinite(nowMs)) return [];
  const cands = [];
  items.forEach((it, i) => {
    if (!it || typeof it.title !== "string") return;
    const title = it.title.trim();
    if (!title) return;
    const pubMs = Number.isFinite(it.pubMs) ? it.pubMs : Date.parse(it.pubDate);
    if (!Number.isFinite(pubMs)) return;
    const ageDays = (nowMs - pubMs) / 86400000;
    if (ageDays > maxAgeDays || ageDays < -futureSlackDays) return;
    if (!isMacroMaterial(title)) return;                       // the gate, BEFORE any score
    const cat = categoryOf(title);
    cands.push({ title, source: typeof it.source === "string" ? it.source : null, pubMs,
      feedIndex: Number.isFinite(it.feedIndex) ? it.feedIndex : 0,
      itemIndex: Number.isFinite(it.itemIndex) ? it.itemIndex : i,
      category: cat ? cat.key : null, score: scoreHeadline(title, pubMs, nowMs) });
  });
  cands.sort((a, b) => b.score - a.score || a.feedIndex - b.feedIndex || a.itemIndex - b.itemIndex
    || a.title.localeCompare(b.title));
  const out = [];
  for (const c of cands) {
    if (out.some((o) => isNearDuplicate(o.title, c.title))) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out.map((c, i) => ({ rank: i + 1, title: c.title, source: c.source,
    as_of: etYmd(new Date(c.pubMs)), category: c.category }));
}

// The stored top-N rides the snapshot as a JSON STRING (the mag10PricesJson precedent).
// Reading it back is defensive: a pre-v6.1 KV artifact, garbage, or a shape drift yields []
// — and every entry is re-checked against the allowlist, so a stored list can never smuggle
// a non-material title onto the page.
export function parseTopHeadlines(json) {
  let arr;
  try { arr = JSON.parse(String(json || "")); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.filter((h) => h && typeof h.title === "string" && typeof h.source === "string"
    && isMacroMaterial(h.title)).map((h, i) => ({ rank: i + 1, title: h.title, source: h.source,
    as_of: typeof h.as_of === "string" ? h.as_of : null, category: h.category ?? null }));
}
