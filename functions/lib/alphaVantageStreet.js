// Palette Move 1b — Alpha Vantage EARNINGS_ESTIMATES → a street ESTIMATES draft.
// Pure, browser-free, fail-closed. Annual rows only (the packet's growth math tiles fiscal
// YEARS — growthSeries/cagr gate on 300–430-day spacing, so a quarterly row would break the
// series it joins); revenue arrives as raw USD and leaves as $B; the quota message is parsed
// as EXHAUSTED and is never retried. The block is labelled Alpha Vantage, never Seeking Alpha.

import { matchStreetSource } from "./tt-v2.js";

const AV_SOURCE = matchStreetSource("estimates", "Alpha Vantage");
export const AV_ESTIMATES_PROVIDER = AV_SOURCE.canonical;
export const AV_SOURCE_URL = "https://www.alphavantage.co/";
export const AV_DAILY_CAP = 25;     // the free tier's hard wall; resets at 00:00 UTC — AV's clock
export const AV_DAILY_BUDGET = 20;  // what this route may spend; the other 5 stay for the owner's manual pulls
export const AV_CACHE_DAYS = 7;     // one call per symbol per week
export const AV_BUDGET_PREFIX = "tt:av:budget:";
export const AV_CACHE_PREFIX = "tt:av:estimates:";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const round4 = (v) => Math.round(v * 1e4) / 1e4;

function avNumber(value) {
  if (typeof value === "number") return finite(value) ? value : null;
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/[$,]/g, "");
  if (!s || /^(none|null|n\/a|-|—)$/i.test(s)) return null;
  const n = Number(s);
  return finite(n) ? n : null;
}

/* The daily budget is keyed by the UTC calendar date ON PURPOSE. Every other time-judge in
   this stack runs on the ET clock (FIX-A, v3.49 — five recurrences and counting); this is the
   one place UTC is correct, because the counter tracks ALPHA VANTAGE's quota window, which
   resets at midnight UTC. Keying it in ET would let a 20:00–23:59 ET session spend against a
   day AV had already reset — or refuse calls AV would still have honoured. */
export function avBudgetKey(now = new Date()) {
  return `${AV_BUDGET_PREFIX}${new Date(now).toISOString().slice(0, 10)}`;
}
export function avCacheKey(sym) {
  return `${AV_CACHE_PREFIX}${String(sym || "").trim().toUpperCase()}:v1`;
}
export function avEstimatesUrl(sym, key) {
  return `https://www.alphavantage.co/query?function=EARNINGS_ESTIMATES&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(key)}`;
}

// AV states the quota under "Information" (current) or "Note" (older). Either is a fact about
// the day, not an error to retry — the caller marks the day exhausted.
export function avCapMessage(raw) {
  const text = [raw?.Information, raw?.Note].filter((x) => typeof x === "string").join(" ");
  return /(rate limit|requests? per day|per minute|api call frequency|premium)/i.test(text) ? text : null;
}

export function blankAvEstimates(asOf) {
  return {
    provider: AV_ESTIMATES_PROVIDER, sourceUrl: AV_SOURCE_URL, asOf,
    currency: "USD", revenueUnit: "B", epsBasis: "provider-consensus", periods: [],
  };
}

/* avEstimatesDraft(raw, { asOf }) → { estimates, warnings, exhausted, skipped }.
   Row fields are the ones the plan documents (revenue_estimate_average · eps_estimate_average ·
   eps_estimate_analyst_count · date · horizon). A row missing BOTH numbers is dropped; a
   malformed date is dropped and NAMED; quarterly horizons are skipped and counted, never
   merged into the annual series; an unknown horizon is dropped, not guessed annual. */
export function avEstimatesDraft(raw, { asOf = new Date().toISOString().slice(0, 10) } = {}) {
  const warnings = [];
  const estimates = blankAvEstimates(asOf);
  const skipped = { quarterly: 0, dropped: 0, duplicates: 0 };
  const done = (exhausted = false) => ({ estimates, warnings, exhausted, skipped });
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  if (!root) { warnings.push("Alpha Vantage response was empty or not an object; no estimates drafted"); return done(); }
  const cap = avCapMessage(root);
  if (cap) { warnings.push(`Alpha Vantage daily quota is exhausted for this UTC day — ${cap.slice(0, 160)}`); return done(true); }
  if (typeof root["Error Message"] === "string") {
    warnings.push(`Alpha Vantage error: ${root["Error Message"].slice(0, 160)}`); return done();
  }
  const rows = Array.isArray(root.estimates) ? root.estimates : null;
  if (!rows) { warnings.push("Alpha Vantage payload did not match the EARNINGS_ESTIMATES shape; no estimates drafted"); return done(); }

  const byEnd = new Map();
  for (const r of rows) {
    const horizon = String(r?.horizon || "").toLowerCase();
    if (/quarter/.test(horizon)) { skipped.quarterly++; continue; }
    if (!/year|annual/.test(horizon)) { skipped.dropped++; continue; }
    const periodEnd = String(r?.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) { skipped.dropped++; warnings.push(`dropped an annual row with an unparseable date (${periodEnd || "blank"})`); continue; }
    const revenueUsd = avNumber(r?.revenue_estimate_average);
    const eps = avNumber(r?.eps_estimate_average);
    if (revenueUsd === null && eps === null) { skipped.dropped++; continue; }
    const analysts = avNumber(r?.eps_estimate_analyst_count ?? r?.revenue_estimate_analyst_count);
    const row = { periodEnd };
    if (revenueUsd !== null && revenueUsd > 0) row.revenueB = round4(revenueUsd / 1e9);
    if (eps !== null) row.eps = eps;
    if (analysts !== null && Number.isInteger(analysts) && analysts >= 0) row.analysts = analysts;
    if (row.revenueB === undefined && row.eps === undefined) { skipped.dropped++; continue; }
    if (byEnd.has(periodEnd)) { skipped.duplicates++; continue; }
    byEnd.set(periodEnd, row);
  }
  estimates.periods = [...byEnd.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  if (!estimates.periods.length) warnings.push("Alpha Vantage returned no usable annual rows; no estimates drafted");
  if (skipped.duplicates) warnings.push(`${skipped.duplicates} duplicate period end(s) ignored — the first row won`);
  return done();
}
