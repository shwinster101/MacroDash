// FEAT-TT-V2: per-symbol measured facts. This is a merge-only store: a licensed-input
// import or book paste cannot erase it, and a provider failure retains last-good evidence
// with its original observation date and a STALE status.

import { authorize, crossOrigin } from "./tt.js";
import { extractSecFacts, filingsFromSubmissions, mergeFactsRecord } from "../lib/tt-facts.js";

const KEY_PREFIX = "tt:facts:";
const CIK_PREFIX = "tt:sec:cik:";
const MAX_SYMS = 40;
const MAX_BODY = 4 * 1024;
const SYMBOL_RE = /^[A-Z.\-]{1,8}$/;
const DAY = 86400;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});
const keyFor = (sym) => `${KEY_PREFIX}${sym}:v1`;
const missing = (provider, reason, retrievedAt, sourceUrl = null) => ({
  value: null, status: "MISSING", provider, reason, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}),
});

async function getJson(url, { headers = {}, timeout = 9000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function finnhub(path, env) {
  if (!env.FINNHUB_KEY) throw new Error("FINNHUB_KEY is not configured");
  const join = path.includes("?") ? "&" : "?";
  return getJson(`https://finnhub.io/api/v1/${path}${join}token=${encodeURIComponent(env.FINNHUB_KEY)}`);
}

function dateFromUnix(sec) {
  const d = new Date(Number(sec) * 1000);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

function instantFromUnix(sec) {
  const d = new Date(Number(sec) * 1000);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function quoteFact(raw, profile, retrievedAt) {
  const value = Number(raw?.c);
  if (!(value > 0)) return missing("Finnhub", "quote unavailable", retrievedAt, "https://finnhub.io/");
  const observedAt = instantFromUnix(raw?.t);
  return {
    value: Number(value.toFixed(4)), currency: profile?.currency || null,
    changePct: Number.isFinite(Number(raw?.dp)) ? Number(Number(raw.dp).toFixed(3)) : null,
    status: observedAt ? "LIVE" : "UNKNOWN", provider: "Finnhub", sourceUrl: "https://finnhub.io/",
    observedAt, retrievedAt,
    ...(observedAt ? {} : { reason: "provider quote timestamp is unavailable; retrieval time was not substituted" }),
  };
}

function candlesFact(raw, retrievedAt) {
  if (!raw || raw.s !== "ok" || !Array.isArray(raw.t)) return missing("Finnhub", raw?.s || "premium daily candles unavailable", retrievedAt, "https://finnhub.io/");
  const rows = raw.t.map((t, i) => ({
    date: dateFromUnix(t), open: Number(raw.o?.[i]), high: Number(raw.h?.[i]), low: Number(raw.l?.[i]),
    close: Number(raw.c?.[i]), volume: Number(raw.v?.[i]),
  })).filter((r) => r.date && [r.open, r.high, r.low, r.close].every(Number.isFinite));
  if (rows.length < 2) return missing("Finnhub", "daily candle response was empty", retrievedAt, "https://finnhub.io/");
  return {
    value: rows, status: "LIVE", provider: "Finnhub", sourceUrl: "https://finnhub.io/",
    observedAt: rows.at(-1).date, retrievedAt, resolution: "D",
  };
}

function earningsFact(raw, today, retrievedAt) {
  const rows = Array.isArray(raw?.earningsCalendar) ? raw.earningsCalendar : [];
  const next = rows.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x?.date || "")) && x.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? {
    value: next.date, status: "LIVE", provider: "Finnhub", sourceUrl: "https://finnhub.io/",
    observedAt: today, retrievedAt, hour: next.hour || null, quarter: next.quarter || null, year: next.year || null,
  } : missing("Finnhub", "no future earnings date returned", retrievedAt, "https://finnhub.io/");
}

function newsFact(raw, retrievedAt) {
  const rows = (Array.isArray(raw) ? raw : []).filter((x) => x && x.headline && x.url).slice(0, 20).map((x) => ({
    headline: String(x.headline).slice(0, 500), source: String(x.source || "unknown").slice(0, 120),
    url: x.url, date: dateFromUnix(x.datetime), category: x.category || null,
  }));
  return rows.length ? {
    value: rows, status: "LIVE", provider: "Finnhub company news", sourceUrl: "https://finnhub.io/",
    observedAt: rows[0].date, retrievedAt,
  } : missing("Finnhub company news", "no recent company news returned", retrievedAt, "https://finnhub.io/");
}

async function cikForSymbol(sym, env, secHeaders) {
  try {
    const hit = await env.PULSE_CACHE.get(CIK_PREFIX + sym, "json");
    if (hit?.cik) return hit;
  } catch (_e) {}
  const data = await getJson("https://www.sec.gov/files/company_tickers.json", { headers: secHeaders, timeout: 12000 });
  const row = Object.values(data || {}).find((x) => String(x?.ticker || "").toUpperCase() === sym);
  if (!row?.cik_str) return null;
  const hit = { cik: String(row.cik_str).padStart(10, "0"), title: row.title || null };
  try { await env.PULSE_CACHE.put(CIK_PREFIX + sym, JSON.stringify(hit), { expirationTtl: 30 * DAY }); } catch (_e) {}
  return hit;
}

async function secBundle(sym, env, retrievedAt) {
  if (!env.SEC_USER_AGENT) return {
    fields: {
      netCashB: missing("SEC", "SEC_USER_AGENT is not configured", retrievedAt, "https://data.sec.gov/"),
      dilutedSharesB: missing("SEC", "SEC_USER_AGENT is not configured", retrievedAt, "https://data.sec.gov/"),
      secFilings: missing("SEC", "SEC_USER_AGENT is not configured", retrievedAt, "https://data.sec.gov/"),
    },
  };
  const headers = { "User-Agent": env.SEC_USER_AGENT, "Accept-Encoding": "gzip, deflate" };
  const identity = await cikForSymbol(sym, env, headers);
  if (!identity) throw new Error("SEC CIK not found");
  const [facts, submissions] = await Promise.all([
    getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${identity.cik}.json`, { headers, timeout: 15000 }),
    getJson(`https://data.sec.gov/submissions/CIK${identity.cik}.json`, { headers, timeout: 15000 }),
  ]);
  const sourceUrl = `https://www.sec.gov/edgar/browse/?CIK=${identity.cik}`;
  const fields = extractSecFacts(facts, { retrievedAt, sourceUrl });
  const filings = filingsFromSubmissions(submissions, identity.cik);
  fields.secFilings = filings.length ? {
    value: filings, status: "LIVE", provider: "SEC", sourceUrl, observedAt: filings[0].filed, retrievedAt,
  } : missing("SEC", "no recent 10-Q/10-K filing returned", retrievedAt, sourceUrl);
  fields.companyIdentity = {
    value: { cik: identity.cik, name: facts?.entityName || identity.title }, status: "LIVE", provider: "SEC",
    sourceUrl, observedAt: retrievedAt.slice(0, 10), retrievedAt,
  };
  return { fields };
}

export async function refreshTickerFacts(sym, env, now = new Date()) {
  const retrievedAt = now.toISOString();
  const today = retrievedAt.slice(0, 10);
  const fromUnix = Math.floor((now.getTime() - 420 * DAY * 1000) / 1000);
  const toUnix = Math.floor(now.getTime() / 1000);
  const future = new Date(now.getTime() + 120 * DAY * 1000).toISOString().slice(0, 10);
  const newsFrom = new Date(now.getTime() - 30 * DAY * 1000).toISOString().slice(0, 10);
  const fields = {};

  const calls = await Promise.allSettled([
    finnhub(`quote?symbol=${encodeURIComponent(sym)}`, env),
    finnhub(`stock/profile2?symbol=${encodeURIComponent(sym)}`, env),
    finnhub(`stock/candle?symbol=${encodeURIComponent(sym)}&resolution=D&from=${fromUnix}&to=${toUnix}`, env),
    finnhub(`calendar/earnings?from=${today}&to=${future}&symbol=${encodeURIComponent(sym)}`, env),
    finnhub(`company-news?symbol=${encodeURIComponent(sym)}&from=${newsFrom}&to=${today}`, env),
    secBundle(sym, env, retrievedAt),
  ]);
  const [quote, profile, candles, earnings, news, sec] = calls;
  if (quote.status === "fulfilled") fields.quote = quoteFact(
    quote.value, profile.status === "fulfilled" ? profile.value : null, retrievedAt,
  );
  else fields.quote = missing("Finnhub", quote.reason?.message || "quote unavailable", retrievedAt, "https://finnhub.io/");

  if (profile.status === "fulfilled" && profile.value && Object.keys(profile.value).length) {
    const p = profile.value;
    fields.profile = {
      value: { name: p.name || null, currency: p.currency || null, exchange: p.exchange || null, country: p.country || null,
        industry: p.finnhubIndustry || null, marketCapM: Number.isFinite(Number(p.marketCapitalization)) ? Number(p.marketCapitalization) : null },
      status: "LIVE", provider: "Finnhub", sourceUrl: "https://finnhub.io/", observedAt: today, retrievedAt,
    };
    if (Number(p.shareOutstanding) > 0) fields.sharesOutstandingB = {
      value: Number(p.shareOutstanding) / 1000, unit: "B shares", status: "LIVE", provider: "Finnhub",
      sourceUrl: "https://finnhub.io/", observedAt: today, retrievedAt,
    };
  } else fields.profile = missing("Finnhub", profile.reason?.message || "profile unavailable", retrievedAt, "https://finnhub.io/");
  fields.candles = candles.status === "fulfilled" ? candlesFact(candles.value, retrievedAt)
    : missing("Finnhub", candles.reason?.message || "daily candles unavailable", retrievedAt, "https://finnhub.io/");
  fields.nextEarnings = earnings.status === "fulfilled" ? earningsFact(earnings.value, today, retrievedAt)
    : missing("Finnhub", earnings.reason?.message || "earnings calendar unavailable", retrievedAt, "https://finnhub.io/");
  fields.companyNews = news.status === "fulfilled" ? newsFact(news.value, retrievedAt)
    : missing("Finnhub company news", news.reason?.message || "news unavailable", retrievedAt, "https://finnhub.io/");
  if (sec.status === "fulfilled") Object.assign(fields, sec.value.fields);
  else {
    fields.netCashB = missing("SEC", sec.reason?.message || "SEC facts unavailable", retrievedAt, "https://data.sec.gov/");
    fields.secFilings = missing("SEC", sec.reason?.message || "SEC filings unavailable", retrievedAt, "https://data.sec.gov/");
  }
  return { schema: "tt-facts-v1", symbol: sym, updatedAt: retrievedAt, fields };
}

async function storedFact(sym, env) {
  try { return await env.PULSE_CACHE.get(keyFor(sym), "json"); } catch (_e) { return null; }
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const url = new URL(request.url);
  if (url.searchParams.has("refresh"))
    return json({ error: "facts refresh is a mutation; POST {symbol} to /api/ticker-facts" }, 405);
  const one = String(url.searchParams.get("sym") || "").trim().toUpperCase();
  const raw = one || url.searchParams.get("syms") || "";
  const syms = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)))].slice(0, MAX_SYMS);
  if (!syms.length) return json({ records: {} });
  const records = {};
  for (const sym of syms) {
    const current = await storedFact(sym, env);
    if (current) records[sym] = current;
  }
  return json({ records, missing: syms.filter((s) => !records[s]) });
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return json({ error: "payload too large" }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 413);
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const sym = String(body.symbol || "").trim().toUpperCase();
  if (!SYMBOL_RE.test(sym)) return json({ error: "valid symbol is required" }, 400);
  const previous = await storedFact(sym, env);
  const incoming = await refreshTickerFacts(sym, env);
  const current = mergeFactsRecord(previous, incoming);
  try { await env.PULSE_CACHE.put(keyFor(sym), JSON.stringify(current)); }
  catch (e) { return json({ error: `facts write failed: ${e?.message || "unknown"}` }, 503); }
  return json({ records: { [sym]: current } });
}
