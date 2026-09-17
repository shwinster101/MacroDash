// Palette Move 1b — PIN Alpha Vantage ESTIMATES draft. POST-only: this route SPENDS a daily
// quota, so it is a mutation in the v3.54 sense (a prefetch or replayed URL must never burn a
// call). It writes exactly two KV families — the weekly per-symbol cache and the UTC-day budget
// counter — and NEVER the street record: the owner still CONFIRMs via PUT /api/street.
// The block is labelled Alpha Vantage, never Seeking Alpha.

import { authorize, crossOrigin } from "../tt.js";
import {
  avEstimatesDraft, blankAvEstimates, avBudgetKey, avCacheKey, avEstimatesUrl,
  AV_DAILY_BUDGET, AV_DAILY_CAP, AV_CACHE_DAYS,
} from "../../lib/alphaVantageStreet.js";

const SYMBOL_RE = /^[A-Z.\-]{1,8}$/;
const MAX_BODY = 1024;
const DAY = 86400;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

async function getJson(url, { headers = {}, timeout = 15000 } = {}, fetchImpl = fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetchImpl(url, { headers: { Accept: "application/json", ...headers }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);   // never the URL — it carries the key
    return await r.json();
  } finally { clearTimeout(timer); }
}

function etDate(now = new Date()) {
  return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
async function kvGet(env, key) {
  if (!env?.PULSE_CACHE || typeof env.PULSE_CACHE.get !== "function") return null;
  try { return await env.PULSE_CACHE.get(key, "json"); } catch (_e) { return null; }
}
async function kvPut(env, key, value, ttl) {
  if (!env?.PULSE_CACHE || typeof env.PULSE_CACHE.put !== "function") return false;
  try { await env.PULSE_CACHE.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined); return true; }
  catch (_e) { return false; }
}

export async function avDraftFor(sym, { env = {}, now = new Date(), fetchImpl = fetch } = {}) {
  const asOf = etDate(now);
  const warnings = [];
  const bKey = avBudgetKey(now);
  const budgetOf = (count) => ({ date: bKey.slice(-10), used: count, budget: AV_DAILY_BUDGET, cap: AV_DAILY_CAP });
  const envelope = (estimates, extra) => ({
    schema: "tt-street-av-draft-v1", symbol: sym, estimates, warnings,
    requires_confirmation: true, persisted: false, ...extra,
  });

  // 0. KEY-GATED like Finnhub/Tiingo: no key → no call, no KV write, the reason named.
  if (!env.ALPHAVANTAGE_KEY) {
    warnings.push("ALPHAVANTAGE_KEY is not configured — no Alpha Vantage call was made; set the secret or enter estimates manually");
    return envelope(blankAvEstimates(asOf), { cached: false, fetched: false, budget: null });
  }
  // 1. The weekly cache: one call per symbol per week, and a cache hit spends NOTHING.
  const cached = await kvGet(env, avCacheKey(sym));
  const ageMs = cached?.retrievedAt ? now.getTime() - Date.parse(cached.retrievedAt) : NaN;
  if (cached?.estimates && Number.isFinite(ageMs) && ageMs >= 0 && ageMs < AV_CACHE_DAYS * DAY * 1000) {
    warnings.push(`served from the weekly cache (retrieved ${String(cached.retrievedAt).slice(0, 10)}); no quota spent`);
    const b = (await kvGet(env, bKey)) || { count: 0 };
    return envelope(cached.estimates, { cached: true, fetched: false, budget: budgetOf(b.count || 0) });
  }
  // 2. The budget: stop at 20 of 25 so the owner always keeps 5 manual pulls.
  const before = (await kvGet(env, bKey)) || { count: 0 };
  const used = Number(before.count) || 0;
  if (used >= AV_DAILY_BUDGET) {
    warnings.push(`Alpha Vantage daily budget reached (${used}/${AV_DAILY_BUDGET}; the free tier allows ${AV_DAILY_CAP} and 5 are reserved for manual pulls) — resets at 00:00 UTC`);
    return envelope(blankAvEstimates(asOf), { cached: false, fetched: false, budget: budgetOf(used) });
  }
  // 3. Spend BEFORE fetching — AV counts the attempt whether or not the parse succeeds.
  const spent = { count: used + 1, date: bKey.slice(-10) };
  await kvPut(env, bKey, spent, 2 * DAY);
  let raw = null;
  try { raw = await getJson(avEstimatesUrl(sym, env.ALPHAVANTAGE_KEY), { timeout: 15000 }, fetchImpl); }
  catch (e) {
    warnings.push(`Alpha Vantage request failed (${e?.message || "unknown"}); enter estimates manually`);
    return envelope(blankAvEstimates(asOf), { cached: false, fetched: true, budget: budgetOf(spent.count) });
  }
  const mapped = avEstimatesDraft(raw, { asOf });
  warnings.push(...mapped.warnings);
  if (mapped.exhausted) {
    // The cap message is a fact about the day: mark it spent so no later call retries it.
    await kvPut(env, bKey, { count: AV_DAILY_CAP, date: spent.date, exhaustedAt: now.toISOString() }, 2 * DAY);
    return envelope(mapped.estimates, { cached: false, fetched: true, budget: budgetOf(AV_DAILY_CAP) });
  }
  if (mapped.estimates.periods.length)
    await kvPut(env, avCacheKey(sym), { retrievedAt: now.toISOString(), estimates: mapped.estimates }, AV_CACHE_DAYS * DAY);
  return envelope(mapped.estimates, { cached: false, fetched: true, budget: budgetOf(spent.count), skipped: mapped.skipped });
}

export async function onRequestGet() {
  return json({ error: "the Alpha Vantage draft spends a daily quota; POST {symbol} to /api/street/av-draft" }, 405);
}

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return json({ error: "payload too large" }, 413);
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return json({ error: "payload too large" }, 413);
  let body;
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const sym = String(body?.symbol || body?.sym || "").trim().toUpperCase();
  if (!SYMBOL_RE.test(sym)) return json({ error: "valid symbol is required" }, 400);
  return json(await avDraftFor(sym, { env, fetchImpl }));
}
