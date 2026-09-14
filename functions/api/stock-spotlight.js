// /api/stock-spotlight — the PUBLIC read of the Stock Spotlight model (v6.5.0).
//
// GET only. No PIN — this is a public educational widget over provider data (SEC filings,
// market caps, prices); it reads ONLY the spotlight:* keys the refresh route writes and
// NEVER the Terminal's book, positions, scores, targets or credentials (smoke sweeps this
// file and the pure lib for `tt:` key references). A public read never triggers a provider
// refresh: a cold store reads as unavailable, and the 6pm cron (or an operator POST to
// /api/stock-spotlight/refresh) is the only writer.
//
// FEATURE FLAG — SHIPS DISABLED. `env.SPOTLIGHT_ENABLED === "1"` is the only value that
// serves a model; anything else returns {enabled:false} and the dashboard renders nothing.
// Production activation also requires approved public-display coverage for market caps,
// prices and derived total returns (docs/plans/stock-spotlight.md §5) — the flag is the
// switch the owner throws once that is settled, not a default.
//
// Freshness is RECOMPUTED here from observation dates (freshenSpotlight) — a stored LIVE
// flag is not trusted, because the store is written at 6pm and read all the next day.

import { SPOTLIGHT_KEYS, SPOTLIGHT_SCHEMA, freshenSpotlight, projectSpotlight } from "../lib/spotlight.js";

const json = (body, status = 200, cache = "public, max-age=300") => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": cache },
});

export const spotlightEnabled = (env) => String(env?.SPOTLIGHT_ENABLED || "") === "1";

export async function onRequestGet({ env }) {
  if (!spotlightEnabled(env)) return json({ schema: SPOTLIGHT_SCHEMA, enabled: false, reason: "feature flag off" });
  let stored = null;
  try { stored = await env.PULSE_CACHE.get(SPOTLIGHT_KEYS.model, "json"); } catch (_e) { /* a KV fault reads as unavailable, never a 500 */ }
  if (!stored || stored.schema !== SPOTLIGHT_SCHEMA)
    return json({ schema: SPOTLIGHT_SCHEMA, enabled: true, model: null, reason: "no spotlight model stored yet — the evening refresh has not run" }, 200, "public, max-age=60");
  const model = projectSpotlight(freshenSpotlight(stored, new Date()));
  return json({ schema: SPOTLIGHT_SCHEMA, enabled: true, model });
}
