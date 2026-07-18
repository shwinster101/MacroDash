// functions/readout.json.js — MacroDash v3.3 · TT ("Ticker Terminal") regime readout (FEAT-330)
// Route: GET /readout.json   (machine-readable; CORS-open)
//
// WHY THE PATH: this file is deliberately at /readout.json, NOT /api/readout. functions/
// _middleware.js DELETES Access-Control-Allow-Origin on /api/* (same-origin lockdown), so an
// /api path could not serve the `*` this endpoint needs. A non-/api path keeps the header.
//
// FIRST functions/→src/ IMPORT in the repo: wrangler's esbuild inlines this relative ESM
// import into the function bundle. src/ttReadout.js is kept pure (no React, no DOM) so it
// bundles here, in the SPA, and in the Node smoke test alike. If a Pages CI build ever rejects
// the import, the fallback is to inline the pure lines + a smoke byte-identity tripwire.
//
// DATA: derived from the SAME per-ET-day snapshot the site uses — read the KV cache directly,
// or (miss) subrequest /api/snapshot (which also write-through-warms KV). No new cron/infra.

import { buildTtReadout } from "../src/ttReadout.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  // SYNC HAZARD: this key version MUST match functions/api/snapshot.js (cacheKey) AND
  // worker/cron.js (refreshSnapshot). No shared module spans them — grep "pulse:snapshot:v".
  const cacheKey = `pulse:snapshot:v15:${etDate}`;

  let live = null, asOf = null, cached = false, kvHit = false, snapDiag = null;

  // 1) Try the day's KV snapshot (cheapest — no upstream calls).
  try {
    const snap = await env.PULSE_CACHE?.get(cacheKey, "json");
    if (snap && snap.live) {
      live = snap.live; asOf = snap.asOf ?? null; cached = true; kvHit = true; snapDiag = snap._diag ?? null;
    }
  } catch { /* KV unavailable — fall through to subrequest */ }

  // 2) KV miss → subrequest /api/snapshot (assembles + write-through-warms KV for us).
  if (!live) {
    try {
      const r = await fetch(new URL("/api/snapshot", request.url), { headers: { accept: "application/json" } });
      if (r.ok) {
        const snap = await r.json();
        if (snap && snap.live) { live = snap.live; asOf = snap.asOf ?? null; cached = !!snap.cached; }
      }
    } catch { /* upstream down — return the schema-stable INSUFFICIENT body below */ }
  }

  // 3) buildTtReadout projects ONLY a named whitelist of fields, so KV's _diag can never leak.
  //    Empty/failed live still yields a stable shape with verdict "INSUFFICIENT".
  const body = {
    schema: "tt-v1",
    as_of: asOf,
    generated_at: new Date().toISOString(),
    cached,
    ...buildTtReadout(live || {}, {}),
  };
  if (debug) body.debug = { kv_key: cacheKey, kv_hit: kvHit, snapshot_diag: snapDiag };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",              // survives _middleware (non-/api path)
      "cache-control": "public, max-age=300",          // per-ET-day data, but flip re-checks must not cache-stick
    },
  });
}
