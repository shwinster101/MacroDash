// MacroDash v2.0 — Cron Worker (Cloudflare Workers, scheduled handler)
// Pulls FRED macro twice daily (legacy KV key) + force-refreshes /api/snapshot at 10am ET.
// The browser never sees this Worker; it only reads the KV key via the
// Pages Function (functions/api/fred.js). FRED_KEY is a Worker secret.
//
// Deploy:  cd worker && npx wrangler deploy
// Secret:  npx wrangler secret put FRED_KEY
// Crons defined in worker/wrangler.toml (UTC).

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const KV_KEY = "pulse:macro:latest";
const FETCH_TIMEOUT_MS = 8000;

// v2.5.4 — 10am ET weekday snapshot FORCE-REFRESH. The dashboard reads /api/snapshot
// (per-ET-day cache; first load wins for the day). FRED publishes the prior close with a
// lag, so an early first-load can lock in stale data all day. This cron busts the day's
// cache key then re-fetches, pulling FRED's freshest each weekday at 10am ET.
const SNAPSHOT_WARM_CRON = "0 14 * * 1-5"; // 10am America/New_York (EDT); EST -> "0 15 * * 1-5"
// FEAT-SNAP-SAFE: pre-open warm. Without it the day's cache is built by whoever visits
// first — paying the full cold-fetch latency, and if several people land together there
// is no single-flight, so N visitors issue N x ~32 upstream calls straight into FRED's and
// Finnhub's rate limits. A degraded pull then risks being locked in for the day. Warming
// while upstreams are quiet means humans essentially always hit a warm cache.
const SNAPSHOT_PREWARM_CRON = "0 12 * * 1-5"; // 8am America/New_York (EDT); EST -> "0 13 * * 1-5"
const SNAPSHOT_URL = "https://macrodash.pages.dev/api/snapshot";

// Metric map. `kind`: 'latest' = newest non-missing observation;
// 'yoy' = year-over-year % computed from a monthly index series.
// `displayClass`: drives the public/private view filter on the front end.
//   public   = US-gov public-domain, safe on shared link
//   citation = free but attribution-required (source box covers it)
//   licensed = redistribution-restricted; HIDE on ?view=public
export const SERIES = {
  tenYear:      { series: "DGS10",        kind: "latest", displayClass: "public",   source: "FRED DGS10" },
  fedFunds:     { series: "FEDFUNDS",     kind: "latest", displayClass: "public",   source: "FRED FEDFUNDS" },
  cpiHeadline:  { series: "CPIAUCSL",     kind: "yoy",    displayClass: "citation", source: "FRED CPIAUCSL" },
  cpiCore:      { series: "CPILFESL",     kind: "yoy",    displayClass: "citation", source: "FRED CPILFESL" },
  unemployment: { series: "UNRATE",       kind: "latest", displayClass: "public",   source: "FRED UNRATE" },
  lfpr:         { series: "CIVPART",      kind: "latest", displayClass: "public",   source: "FRED CIVPART" },
  mortgage30:   { series: "MORTGAGE30US", kind: "latest", displayClass: "public",   source: "FRED MORTGAGE30US" },
  vix:          { series: "VIXCLS",       kind: "latest", displayClass: "citation", source: "FRED VIXCLS" },
  wti:          { series: "DCOILWTICO",   kind: "latest", displayClass: "public",   source: "FRED DCOILWTICO" },
  sp500:        { series: "SP500",        kind: "latest", displayClass: "licensed", source: "FRED SP500" },
};

// ---- pure helpers (exported for smoke testing) -------------------------

// FRED returns value "." for missing days (weekends/holidays). Scan newest→oldest.
export function getLatestValid(observations) {
  for (const o of observations) {
    if (o && o.value !== "." && o.value != null && o.value !== "") {
      const n = Number(o.value);
      if (Number.isFinite(n)) return { value: n, asOf: o.date };
    }
  }
  return null;
}

// YoY % from a monthly index: (latest / value 12 months earlier - 1) * 100.
// Filter to valid observations FIRST (FRED returns a "." row for the current,
// not-yet-released month), then compare valid[0] to valid[12]. Because monthly
// CPI has no internal gaps, valid[12] is exactly 12 months before valid[0].
export function computeYoY(observations) {
  const valid = observations.filter(
    (o) => o && o.value !== "." && Number.isFinite(Number(o.value))
  );
  if (valid.length < 13) return null;
  const latest = Number(valid[0].value);
  const prior = Number(valid[12].value);
  if (!prior) return null;
  return { value: Math.round((latest / prior - 1) * 1000) / 10, asOf: valid[0].date };
}

// Build the FRED URL for a series.
// FIX (2026-06-04): yoy now fetches 18 rows (was 13). FRED returns a trailing
// "." placeholder for the current not-yet-released month, which dropped CPI to
// 12 valid observations → computeYoY returned null → "no_valid_observation".
// 18 rows leaves ≥13 valid even with 1–2 trailing placeholders; valid[12] is
// still exactly the year-ago month because the valid array is gap-free monthly.
export function fredUrl(seriesId, apiKey, kind) {
  const limit = kind === "yoy" ? 18 : 5;
  const p = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: String(limit),
  });
  return `${FRED_BASE}?${p.toString()}`;
}

// Fetch one series with timeout + one retry. Returns observations array or throws.
async function fetchSeries(seriesId, apiKey, kind, fetchImpl) {
  const url = fredUrl(seriesId, apiKey, kind);
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body || !Array.isArray(body.observations)) throw new Error("bad_shape");
      return body.observations;
    } catch (e) {
      clearTimeout(t);
      if (attempt === 1) throw e;
    }
  }
}

// Core: fetch every series, compute values, merge over last-good on failure.
// Returns the payload object to be written to KV. Never includes the API key.
export async function buildMacroPayload(env, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const now = opts.now ? new Date(opts.now) : new Date();
  const apiKey = env.FRED_KEY;
  if (!apiKey) throw new Error("FRED_KEY missing");

  // Read last-good payload so a transient FRED outage doesn't blank the dash.
  let prev = {};
  try {
    const rawPrev = await env.PULSE_CACHE.get(KV_KEY);
    if (rawPrev) prev = JSON.parse(rawPrev);
  } catch { /* ignore; treat as cold start */ }
  const prevMetrics = (prev && prev.metrics) || {};

  const keys = Object.keys(SERIES);
  const settled = await Promise.allSettled(
    keys.map((k) =>
      fetchSeries(SERIES[k].series, apiKey, SERIES[k].kind, fetchImpl).then((obs) => ({ k, obs }))
    )
  );

  const metrics = {};
  const errors = {};
  for (let i = 0; i < settled.length; i++) {
    const k = keys[i];
    const cfg = SERIES[k];
    const base = { source: cfg.source, displayClass: cfg.displayClass };
    if (settled[i].status === "fulfilled") {
      const { obs } = settled[i].value;
      const r = cfg.kind === "yoy" ? computeYoY(obs) : getLatestValid(obs);
      if (r) {
        metrics[k] = { ...base, value: r.value, asOf: r.asOf, stale: false };
        continue;
      }
      errors[k] = "no_valid_observation";
    } else {
      errors[k] = String(settled[i].reason && settled[i].reason.message || settled[i].reason);
    }
    // Carry forward last-good, marked stale, so the dashboard keeps a number.
    if (prevMetrics[k] && Number.isFinite(prevMetrics[k].value)) {
      metrics[k] = { ...base, value: prevMetrics[k].value, asOf: prevMetrics[k].asOf, stale: true };
    }
  }

  return {
    generatedAt: now.toISOString(),
    schedule: opts.cron || null,
    metrics,
    errors: Object.keys(errors).length ? errors : undefined,
  };
}

// Manual cache-warm guard: protect the optional HTTP trigger with a shared secret.
function authorized(request, env) {
  const got = request.headers.get("x-refresh-secret");
  return env.REFRESH_SECRET && got && got === env.REFRESH_SECRET;
}

// Record each warm/refresh outcome in KV so /api/snapshot?debug=1 can surface cron health
// from a browser (_diag.cronLastWarm) — a silently edge-blocked warm previously looked
// identical to no cron at all, and only `wrangler tail` at the right moment could tell.
async function recordWarm(env, job, ok, status) {
  try {
    await env.PULSE_CACHE.put("pulse:cron:lastwarm",
      JSON.stringify({ at: new Date().toISOString(), job, ok, status }),
      { expirationTtl: 7 * 24 * 3600 });
  } catch { /* diagnostic only — never blocks the warm itself */ }
}

// Force-refresh the /api/snapshot per-day cache: delete the day's key, then trigger the
// Pages Function (now a cache MISS) so it pulls fresh FRED and write-throughs to KV.
// The short delay lets the KV delete propagate before the re-fetch — KV is eventually
// consistent, so without it the Function may still read the pre-delete value.
async function refreshSnapshot(env) {
  try {
    // Reachability pre-check BEFORE deleting: if the edge is blocking this Worker (e.g. a
    // Cloudflare Access app scoped beyond /admin* + /api/tt*, or a WAF/bot rule), a
    // delete-then-fail would leave the day COLD for the first human visitor. Never destroy
    // a cache you haven't proven you can rebuild. The pre-check GET is cheap — it hits KV.
    const pre = await fetch(SNAPSHOT_URL, { headers: { "user-agent": "macrodash-snapshot-refresher" } });
    if (!pre.ok) {
      console.error(`snapshot refresh: pre-check got HTTP ${pre.status} from ${SNAPSHOT_URL} — the cron is blocked at the edge (check Cloudflare Access app scope / WAF rules); NOT deleting the day's cache`);
      await recordWarm(env, "refresh-10amET", false, pre.status);
      return;
    }
    const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
    // SYNC HAZARD: this key version MUST match the cacheKey in functions/api/snapshot.js (and
    // functions/readout.json.js). Separate deploys, no shared module — this literal drifted once
    // (deleted v5 while snapshot wrote v15 → the 10am force-refresh was inert). Fixed v3.3.0.
    // Grep "pulse:snapshot:v" across worker/ + functions/ on every bump.
    await env.PULSE_CACHE.delete(`pulse:snapshot:v15:${etDate}`);
    await new Promise((r) => setTimeout(r, 3000)); // let the delete propagate before re-fetch
    const res = await fetch(SNAPSHOT_URL, { headers: { "user-agent": "macrodash-snapshot-refresher" } });
    if (!res.ok) console.error(`snapshot refresh: rebuild fetch got HTTP ${res.status} — next visitor pays the cold fetch`);
    await recordWarm(env, "refresh-10amET", res.ok, res.status);
  } catch (e) {
    /* a degraded fetch won't re-cache (snapshot.js healthy-gate); next visitor refetches */
    console.error("snapshot refresh failed:", (e && e.message) || e);
    await recordWarm(env, "refresh-10amET", false, 0);
  }
}

// Pre-open warm: populate the day's snapshot key if it isn't already there. Unlike
// refreshSnapshot() this does NOT delete first — if a night owl already warmed the cache,
// re-fetching would just burn upstream calls for the same data.
async function warmSnapshot(env) {
  try {
    const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    // SYNC HAZARD: keep this key version in step with functions/api/snapshot.js.
    const existing = await env.PULSE_CACHE.get(`pulse:snapshot:v15:${etDate}`);
    if (existing) return; // already warm — nothing to do
    const res = await fetch(SNAPSHOT_URL, { headers: { "user-agent": "macrodash-snapshot-prewarm" } });
    if (!res.ok) console.error(`snapshot pre-warm got HTTP ${res.status} from ${SNAPSHOT_URL} — the cron is blocked at the edge (check Cloudflare Access app scope / WAF rules); first visitor pays the cold fetch`);
    await recordWarm(env, "prewarm-8amET", res.ok, res.status);
  } catch (e) {
    /* the first human visitor still warms it the old way */
    console.error("snapshot pre-warm failed:", (e && e.message) || e);
    await recordWarm(env, "prewarm-8amET", false, 0);
  }
}

export default {
  // Cron Triggers invoke scheduled(). UTC. controller.cron tells which fired.
  async scheduled(controller, env, ctx) {
    // 8am ET weekday: pre-open warm so no human pays the cold fetch (see SNAPSHOT_PREWARM_CRON).
    if (controller.cron === SNAPSHOT_PREWARM_CRON) {
      ctx.waitUntil(warmSnapshot(env));
      return;
    }
    // 10am ET weekday: force-refresh the /api/snapshot per-day cache (see SNAPSHOT_WARM_CRON note).
    if (controller.cron === SNAPSHOT_WARM_CRON) {
      ctx.waitUntil(refreshSnapshot(env));
      return;
    }
    // Legacy stage-1 path: FRED macro -> KV pulse:macro:latest (dashboard now reads /api/snapshot).
    ctx.waitUntil(
      (async () => {
        const payload = await buildMacroPayload(env, { cron: controller.cron });
        // 26h TTL: longer than the ~13h gap between the two daily pulls, so a
        // single missed run never expires the cache to empty.
        await env.PULSE_CACHE.put(KV_KEY, JSON.stringify(payload), { expirationTtl: 93600 });
      })()
    );
  },

  // Optional manual warm: POST /refresh with x-refresh-secret. Lets the operator
  // populate the cache once before flipping VITE_DATA_MODE=live. Not required.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/refresh" && request.method === "POST") {
      if (!authorized(request, env)) return new Response("forbidden", { status: 403 });
      const payload = await buildMacroPayload(env, { cron: "manual" });
      await env.PULSE_CACHE.put(KV_KEY, JSON.stringify(payload), { expirationTtl: 93600 });
      return new Response(JSON.stringify({ ok: true, wrote: Object.keys(payload.metrics).length }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("macrodash-cron: scheduled worker. POST /refresh to warm cache.", {
      status: 200,
    });
  },
};
