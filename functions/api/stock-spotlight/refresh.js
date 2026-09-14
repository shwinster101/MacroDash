// /api/stock-spotlight/refresh — the ONE writer of the Stock Spotlight model (v6.5.0).
// Route: POST (GET → 405). Auth mirrors functions/api/snapshot/refresh.js: the cron Worker's
// x-refresh-token, else the terminal's own PIN/Access gate. Anonymous POST fails closed.
//
// What a refresh does, in order:
//   1. Reads the rotation record and computes the pair for THIS ET calendar week
//      (nextRotation): a new week advances the comparison; the same week keeps it.
//   2. Refreshes provider facts for the anchor (NBIS), the active comparison, and the NEXT
//      comparison ("prepare the next comparison company"), each behind the tt-facts
//      merge-only last-good rule so a provider failure retains dated evidence marked STALE.
//   3. Builds the model from those facts through the pure lib and stores it.
//   4. Persists the rotation ONLY after a successful build — a failed refresh never advances
//      the pair, so the first SUCCESSFUL refresh of the week is what moves it.
// A refresh failure is recorded under spotlight:diag:v1 and returned in the body; it never
// throws past the handler, which is what lets the 6pm cron call it without risk to the
// macro evening update (the cron wraps it again, belt and suspenders).
//
// PROVIDER LADDER for the return series (the basis travels WITH the series, never implied):
//   · Finnhub daily candles with adjusted=true   → total_return (premium entitlement)
//   · Tiingo daily adjClose (TIINGO_KEY)         → total_return (adjusted for splits AND
//                                                  dividends per Tiingo's documentation)
//   · Nasdaq daily history (keyless, existing)   → price_return, labelled as such
// The widget renders the label the series carries. A price-return series is shown AS price
// return with the dividend caveat stated, never silently as total return.
//
// Fundamentals: SEC companyfacts (10-Q/10-K/20-F/6-K, us-gaap + ifrs-full) merged with an
// optional operator-curated issuer-report record (spotlight:issuer:v1:<SYM>) for issuers
// whose interim results are not XBRL-tagged. The merge keeps the NEWER quarter per concept.

import { authorize } from "../tt.js";
import { quoteFact, nasdaqCandles, earningsFact, cikForSymbol } from "../ticker-facts.js";
import { mergeFactsRecord, candleSeriesFault } from "../../lib/tt-facts.js";
import {
  SPOTLIGHT_KEYS, SPOTLIGHT_ANCHOR, COMPANY_NAMES, etWeekKey, nextRotation, comparisonAt,
  extractSpotlightFundamentals, unavailableFundamentals, issuerFundamentals, mergeFundamentals, buildCompany, buildTracker, buildSpotlightModel,
} from "../../lib/spotlight.js";
import { etYmd } from "../../../src/sources.js";

const DAY = 86400;
const COOLDOWN_KEY = "spotlight:refresh:cooldown";
const COOLDOWN_SEC = 60;

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body, null, 2), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
});
function crossOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; } catch (_e) { return true; }
}
const missing = (provider, reason, retrievedAt, sourceUrl = null) => ({
  value: null, status: "MISSING", provider, reason, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}),
});

async function getJson(url, { headers = {}, timeout = 9000 } = {}, fetchImpl = fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetchImpl(url, { headers: { Accept: "application/json", ...headers }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}
async function finnhub(path, env, fetchImpl) {
  if (!env.FINNHUB_KEY) throw new Error("FINNHUB_KEY is not configured");
  const join = path.includes("?") ? "&" : "?";
  return getJson(`https://finnhub.io/api/v1/${path}${join}token=${encodeURIComponent(env.FINNHUB_KEY)}`, {}, fetchImpl);
}
const dateFromUnix = (sec) => { const d = new Date(Number(sec) * 1000); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null; };

// ── series adapters (each returns a `series` fact: {value: rows, basis, ...} or MISSING) ──
export function finnhubAdjustedSeries(raw, retrievedAt, refPx) {
  if (!raw || raw.s !== "ok" || !Array.isArray(raw.t)) return missing("Finnhub", raw?.s || "adjusted daily candles unavailable (premium entitlement)", retrievedAt, "https://finnhub.io/");
  const rows = raw.t.map((t, i) => ({ date: dateFromUnix(t), value: Number(raw.c?.[i]), close: Number(raw.c?.[i]) }))
    .filter((r) => r.date && Number.isFinite(r.value) && r.value > 0);
  if (rows.length < 2) return missing("Finnhub", "adjusted candle response was empty", retrievedAt, "https://finnhub.io/");
  const fault = candleSeriesFault(rows, refPx);
  if (fault) return missing("Finnhub", "adjusted series failed continuity: " + fault, retrievedAt, "https://finnhub.io/");
  return { value: rows, basis: "total_return", status: "LIVE", provider: "Finnhub (adjusted daily candles)", sourceUrl: "https://finnhub.io/", observedAt: rows[rows.length - 1].date, retrievedAt };
}
export function tiingoSeries(raw, retrievedAt, refPx) {
  const rows = (Array.isArray(raw) ? raw : []).map((r) => ({ date: String(r?.date || "").slice(0, 10), value: Number(r?.adjClose), close: Number(r?.close) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.value) && r.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 2) return missing("Tiingo", "daily adjusted-close response was empty", retrievedAt, "https://www.tiingo.com/");
  // Continuity is judged on the raw close (the adjusted column legitimately steps at a split).
  const fault = candleSeriesFault(rows.filter((r) => Number.isFinite(r.close)), refPx);
  if (fault) return missing("Tiingo", "series failed continuity: " + fault, retrievedAt, "https://www.tiingo.com/");
  return { value: rows, basis: "total_return", status: "LIVE", provider: "Tiingo (adjClose — split- and dividend-adjusted)", sourceUrl: "https://www.tiingo.com/", observedAt: rows[rows.length - 1].date, retrievedAt };
}
export function nasdaqPriceSeries(candles) {
  if (!candles || candles.status === "MISSING" || !Array.isArray(candles.value)) return { ...candles, basis: null };
  return { value: candles.value.map((r) => ({ date: r.date, value: r.close, close: r.close })), basis: "price_return", status: candles.status,
    provider: "Nasdaq daily history (closes — dividends not included)", sourceUrl: candles.sourceUrl, observedAt: candles.observedAt, retrievedAt: candles.retrievedAt };
}

async function fetchSeries(sym, env, now, retrievedAt, refPx, fetchImpl) {
  const fromUnix = Math.floor((now.getTime() - 420 * DAY * 1000) / 1000);
  const toUnix = Math.floor(now.getTime() / 1000);
  const attempts = [];
  try {
    const raw = await finnhub(`stock/candle?symbol=${encodeURIComponent(sym)}&resolution=D&from=${fromUnix}&to=${toUnix}&adjusted=true`, env, fetchImpl);
    const s = finnhubAdjustedSeries(raw, retrievedAt, refPx);
    if (s.status === "LIVE") return { series: s, attempts };
    attempts.push(`Finnhub adjusted: ${s.reason}`);
  } catch (e) { attempts.push(`Finnhub adjusted: ${e?.message || "failed"}`); }
  if (env.TIINGO_KEY) {
    try {
      const start = new Date(now.getTime() - 420 * DAY * 1000).toISOString().slice(0, 10);
      const raw = await getJson(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(sym)}/prices?startDate=${start}&token=${encodeURIComponent(env.TIINGO_KEY)}`, { timeout: 12000 }, fetchImpl);
      const s = tiingoSeries(raw, retrievedAt, refPx);
      if (s.status === "LIVE") return { series: s, attempts };
      attempts.push(`Tiingo: ${s.reason}`);
    } catch (e) { attempts.push(`Tiingo: ${e?.message || "failed"}`); }
  } else attempts.push("Tiingo: TIINGO_KEY not configured");
  try {
    const candles = await nasdaqCandles(sym, now, retrievedAt, refPx, fetchImpl);
    const s = nasdaqPriceSeries(candles);
    if (s.status === "LIVE") return { series: s, attempts };
    attempts.push(`Nasdaq: ${candles.reason}`);
  } catch (e) { attempts.push(`Nasdaq: ${e?.message || "failed"}`); }
  return { series: missing("series", attempts.join("; "), retrievedAt), attempts };
}

async function secCompanyFacts(sym, env, retrievedAt, fetchImpl) {
  if (!env.SEC_USER_AGENT) return { fields: null, error: "SEC_USER_AGENT is not configured" };
  const headers = { "User-Agent": env.SEC_USER_AGENT, "Accept-Encoding": "gzip, deflate" };
  // Own cache prefix: the spotlight touches no tt:* key, not even the public CIK lookup's.
  const identity = await cikForSymbol(sym, env, headers, fetchImpl, SPOTLIGHT_KEYS.cik);
  if (!identity) return { fields: null, error: "SEC CIK not found" };
  const facts = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${identity.cik}.json`, { headers, timeout: 15000 }, fetchImpl);
  const sourceUrl = `https://www.sec.gov/edgar/browse/?CIK=${identity.cik}`;
  return { fields: extractSpotlightFundamentals(facts, { retrievedAt, sourceUrl }), name: facts?.entityName || identity.title || null };
}

/* Per-company provider pull. Returns a tt-facts-shaped record so mergeFactsRecord can carry
   last-good values with their real dates. `series` is stored whole (rows are ~400 points). */
export async function refreshSpotlightFacts(sym, env, now = new Date(), fetchImpl = fetch) {
  const retrievedAt = now.toISOString();
  const today = etYmd(now);
  const future = new Date(now.getTime() + 120 * DAY * 1000).toISOString().slice(0, 10);
  const fields = {};
  const failures = [];
  const [quote, profile, earnings, sec] = await Promise.allSettled([
    finnhub(`quote?symbol=${encodeURIComponent(sym)}`, env, fetchImpl),
    finnhub(`stock/profile2?symbol=${encodeURIComponent(sym)}`, env, fetchImpl),
    finnhub(`calendar/earnings?from=${today}&to=${future}&symbol=${encodeURIComponent(sym)}`, env, fetchImpl),
    secCompanyFacts(sym, env, retrievedAt, fetchImpl),
  ]);
  const p = profile.status === "fulfilled" && profile.value && Object.keys(profile.value).length ? profile.value : null;
  fields.quote = quote.status === "fulfilled" ? quoteFact(quote.value, p, retrievedAt) : missing("Finnhub", quote.reason?.message || "quote unavailable", retrievedAt, "https://finnhub.io/");
  if (fields.quote.status === "MISSING") failures.push({ symbol: sym, item: "quote", reason: fields.quote.reason });
  if (p) {
    fields.profile = { value: { name: p.name || null, currency: p.currency || null, exchange: p.exchange || null }, status: "LIVE", provider: "Finnhub", sourceUrl: "https://finnhub.io/", observedAt: today, retrievedAt };
    // Finnhub reports marketCapitalization in MILLIONS of the profile currency; the unit is
    // carried, never assumed away. The observation date is the retrieval day (a profile
    // figure updates daily; it carries no timestamp of its own).
    if (Number(p.marketCapitalization) > 0) fields.marketCap = { value: Number(p.marketCapitalization), unit: "USD M", currency: p.currency || null, status: "LIVE", provider: "Finnhub (profile market capitalization)", sourceUrl: "https://finnhub.io/", observedAt: today, retrievedAt };
    else fields.marketCap = missing("Finnhub", "profile carries no market capitalization", retrievedAt, "https://finnhub.io/");
    if (Number(p.shareOutstanding) > 0) fields.sharesOutstanding = { value: Number(p.shareOutstanding) * 1e6, unit: "shares", kind: "outstanding", status: "LIVE", provider: "Finnhub (profile shares outstanding)", sourceUrl: "https://finnhub.io/", observedAt: today, retrievedAt };
  } else {
    fields.profile = missing("Finnhub", profile.reason?.message || "profile unavailable", retrievedAt, "https://finnhub.io/");
    fields.marketCap = missing("Finnhub", profile.reason?.message || "profile unavailable", retrievedAt, "https://finnhub.io/");
    failures.push({ symbol: sym, item: "profile", reason: fields.profile.reason });
  }
  fields.nextEarnings = earnings.status === "fulfilled" ? earningsFact(earnings.value, today, retrievedAt) : missing("Finnhub", earnings.reason?.message || "earnings calendar unavailable", retrievedAt, "https://finnhub.io/");
  if (sec.status === "fulfilled" && sec.value.fields) {
    fields.secFundamentals = { value: sec.value.fields, status: "LIVE", provider: "SEC", sourceUrl: "https://data.sec.gov/", observedAt: today, retrievedAt };
    if (sec.value.name) fields.issuerName = { value: sec.value.name, status: "LIVE", provider: "SEC", observedAt: today, retrievedAt };
  } else {
    const why = sec.status === "fulfilled" ? sec.value.error : (sec.reason?.message || "SEC facts unavailable");
    fields.secFundamentals = missing("SEC", why, retrievedAt, "https://data.sec.gov/");
    failures.push({ symbol: sym, item: "sec", reason: why });
  }
  const refPx = fields.quote.status === "LIVE" && Number(fields.quote.value) > 0 ? Number(fields.quote.value) : null;
  const { series, attempts } = await fetchSeries(sym, env, now, retrievedAt, refPx, fetchImpl);
  fields.series = series;
  if (series.status === "MISSING") failures.push({ symbol: sym, item: "series", reason: series.reason });
  return { record: { schema: "md-spotlight-facts-v1", symbol: sym, updatedAt: retrievedAt, fields }, failures, seriesAttempts: attempts };
}

const readJson = async (env, key) => { try { return await env.PULSE_CACHE.get(key, "json"); } catch (_e) { return null; } };

/* Assemble one company from its (merged) facts record + optional issuer record. */
export function companyFromRecord(sym, record, issuerRecord, now) {
  const f = record?.fields || {};
  const secF = f.secFundamentals && f.secFundamentals.value ? f.secFundamentals.value : null;
  const issuerF = issuerRecord ? issuerFundamentals(issuerRecord, { retrievedAt: now.toISOString() }) : null;
  const fundamentals = mergeFundamentals(secF, issuerF)
    || unavailableFundamentals(f.secFundamentals?.reason || f.secFundamentals?.lastRefreshError || "no structured filing data and no issuer-report record", { retrievedAt: now.toISOString() });
  const seriesFact = f.series && f.series.status !== "MISSING" && Array.isArray(f.series.value)
    ? { symbol: sym, basis: f.series.basis, provider: f.series.provider, sourceUrl: f.series.sourceUrl, rows: f.series.value, currency: f.quote?.currency || null, observedAt: f.series.observedAt, status: f.series.status }
    : { symbol: sym, rows: null, unavailable: f.series?.reason || f.series?.lastRefreshError || "return series unavailable" };
  const name = f.issuerName?.value || fundamentals.issuerName || f.profile?.value?.name || COMPANY_NAMES[sym] || sym;
  const company = buildCompany({ symbol: sym, name, facts: f, fundamentals, series: seriesFact.rows ? seriesFact : null, today: etYmd(now), now });
  return { company, series: seriesFact };
}

export async function runSpotlightRefresh(env, { now = new Date(), fetchImpl = fetch, reason = "operator" } = {}) {
  const today = etYmd(now);
  const weekKey = etWeekKey(today);
  const storedRotation = await readJson(env, SPOTLIGHT_KEYS.rotation);
  const rotation = nextRotation(storedRotation, weekKey);
  const comparison = comparisonAt(rotation.index);
  const next = comparisonAt(rotation.index + 1);
  const failures = [];
  const records = {};
  for (const sym of [SPOTLIGHT_ANCHOR, comparison, next]) {
    const previous = await readJson(env, SPOTLIGHT_KEYS.facts(sym));
    let fresh;
    try { fresh = await refreshSpotlightFacts(sym, env, now, fetchImpl); }
    catch (e) { fresh = { record: { symbol: sym, fields: {} }, failures: [{ symbol: sym, item: "refresh", reason: e?.message || "refresh threw" }] }; }
    failures.push(...fresh.failures);
    const merged = mergeFactsRecord(previous, fresh.record, now);
    merged.schema = "md-spotlight-facts-v1";
    records[sym] = merged;
    try { await env.PULSE_CACHE.put(SPOTLIGHT_KEYS.facts(sym), JSON.stringify(merged)); }
    catch (e) { failures.push({ symbol: sym, item: "facts-store", reason: e?.message || "KV put failed" }); }
  }
  const issuer = {};
  for (const sym of [SPOTLIGHT_ANCHOR, comparison]) issuer[sym] = await readJson(env, SPOTLIGHT_KEYS.issuer(sym));
  const a = companyFromRecord(SPOTLIGHT_ANCHOR, records[SPOTLIGHT_ANCHOR], issuer[SPOTLIGHT_ANCHOR], now);
  const b = companyFromRecord(comparison, records[comparison], issuer[comparison], now);
  const tracker = buildTracker(a.series, b.series, today);
  const model = buildSpotlightModel({ anchor: a.company, comparison: b.company, rotation, tracker, now, failures });
  let stored = false;
  try { await env.PULSE_CACHE.put(SPOTLIGHT_KEYS.model, JSON.stringify(model)); stored = true; }
  catch (e) { failures.push({ item: "model-store", reason: e?.message || "KV put failed" }); }
  // The rotation advances ONLY on a successful store — a failed week retries without moving.
  if (stored) {
    try { await env.PULSE_CACHE.put(SPOTLIGHT_KEYS.rotation, JSON.stringify({ index: rotation.index, weekKey, comparison, updatedAt: now.toISOString() })); }
    catch (e) { failures.push({ item: "rotation-store", reason: e?.message || "KV put failed" }); }
  }
  const diag = { at: now.toISOString(), reason, ok: stored, pair: { anchor: SPOTLIGHT_ANCHOR, comparison, next, weekKey, advanced: rotation.advanced }, failures };
  try { await env.PULSE_CACHE.put(SPOTLIGHT_KEYS.diag, JSON.stringify(diag), { expirationTtl: 30 * 24 * 3600 }); } catch (_e) { /* diagnostic only */ }
  return { ok: stored, pair: diag.pair, failures, model: stored ? model : null };
}

export async function onRequestGet() {
  return json({ error: "method not allowed — this endpoint mutates state; use POST" }, 405, { Allow: "POST" });
}

export async function onRequestPost({ request, env }) {
  if (crossOrigin(request)) return json({ error: "cross-origin refresh rejected" }, 403);
  const hdrToken = request.headers.get("x-refresh-token");
  const serverAuthed = !!(env.REFRESH_TOKEN && hdrToken && hdrToken === env.REFRESH_TOKEN);
  if (!serverAuthed) {
    const auth = await authorize(request, env);
    if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  }
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  try {
    const cd = await env.PULSE_CACHE.get(COOLDOWN_KEY);
    if (cd) return json({ error: "spotlight refresh cooling down — try again shortly", retry_after_sec: COOLDOWN_SEC }, 429, { "Retry-After": String(COOLDOWN_SEC) });
    await env.PULSE_CACHE.put(COOLDOWN_KEY, "1", { expirationTtl: COOLDOWN_SEC });
  } catch { /* KV fault — proceed; the build reports its own faults */ }
  let reason = serverAuthed ? "cron" : "operator";
  try { const body = await request.json(); if (body && typeof body.reason === "string") reason = body.reason.slice(0, 32); } catch { /* empty body */ }
  try {
    const out = await runSpotlightRefresh(env, { reason });
    return json({ ok: out.ok, pair: out.pair, failures: out.failures, generatedAt: out.model?.generatedAt || null });
  } catch (e) {
    return json({ ok: false, error: e?.message || "spotlight refresh failed" }, 500);
  }
}
