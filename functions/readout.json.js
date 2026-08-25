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
import { buildMacroCall } from "../src/macroCall.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  /* v3.99.4 (codex ambiguity review P1): debug rides the SAME fail-closed token rule as
     /api/snapshot — honored only when the DEBUG_TOKEN secret is SET and ?debug=<token>
     matches; no secret configured means no diagnostics for anyone. This endpoint is
     CORS-OPEN, so the old bare ?debug=1 disclosed kv_key / kv_hit / snapshot _diag (source
     statuses, latencies, upstream hosts) to any origin that knew the parameter — while the
     docs claimed the debug policy was token-gated everywhere. B3's rule, applied to the one
     public endpoint it missed. */
  const debugParam = url.searchParams.get("debug");
  const debug = !!(env.DEBUG_TOKEN && debugParam && debugParam === env.DEBUG_TOKEN);

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
  //    Empty/failed live still yields a stable shape — ENGINE0-CONT: the wait posture is
  //    NEUTRAL · LOW · HOLD · DATA DEGRADED, never the literal verdict INSUFFICIENT.
  const generatedAt = new Date().toISOString();
  const readout = buildTtReadout(live || {}, { cached });
  // v4.0: the public CPI/CAPE/NFCI engine is the canonical MacroDash call. The existing
  // tt-v1 body remains byte-semantics-compatible for older Engine 0 consumers; `call` is
  // additive, and all first-party public surfaces consume it.
  const call = buildMacroCall(live || {}, {
    cached,
    effectiveDate: etDate,
    generatedAt,
  });
  const body = {
    schema: "tt-v1",
    as_of: asOf,
    generated_at: generatedAt,
    cached,
    ...readout,
    call,
    compatibility: {
      canonical: "call (md-call-v1)",
      legacy: "regime (tt-v1 Engine 0; retained for existing operator consumers)",
    },
  };
  // ENGINE0-CONT §6/§10: machine-consumable health — enough structured provenance for an
  // external terminal (or an LLM read tool) to EXPLAIN the state without fetching or
  // inventing raw finance values. Names only; private diagnostics stay debug-gated.
  const conf = readout.regime.confidence;
  const retryMs = conf === "HIGH" ? null : conf === "MEDIUM" ? 15 * 60 * 1000 : 5 * 60 * 1000;
  body.health = {
    // One contract across every consumer: only FULL may gate capital. RESTRICTED is a
    // named wait state, never a softer route around the canonical Engine 0 veto.
    can_gate: readout.regime.actionability === "FULL",
    gate_mode: readout.regime.actionability,
    current_inputs: readout.regime.current,
    historical_inputs: readout.regime.historical,
    missing: readout.regime.checks.filter((c) => c.tier === "MISSING").map((c) => c.name),
    next_retry_at: retryMs ? new Date(Date.now() + retryMs).toISOString() : null,
    sources: readout.attribution,
  };
  if (debug) body.debug = { kv_key: cacheKey, kv_hit: kvHit, snapshot_diag: snapDiag };

  // ?fresh=1: an explicit operator/refresh re-check must not be hidden by the 5-minute
  // shared cache (§8 HTTP-cache rule) — no-store on demand, shared caching otherwise.
  // A debug response is no-store too: a body carrying diagnostics must never sit in a
  // shared cache, and the token-bearing URL should not be cached anywhere.
  const noStore = url.searchParams.get("fresh") === "1" || debug;
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",              // survives _middleware (non-/api path)
      "cache-control": noStore ? "no-store" : "public, max-age=300",
    },
  });
}
