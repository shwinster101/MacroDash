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

import {
  SPOTLIGHT_KEYS, SPOTLIGHT_SCHEMA, freshenSpotlight, projectSpotlight,
  restoreEarningsPeriod, mergeFundamentals, issuerFundamentals,
} from "../lib/spotlight.js";

const json = (body, status = 200, cache = "public, max-age=300") => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": cache },
});

export const spotlightEnabled = (env) => String(env?.SPOTLIGHT_ENABLED || "") === "1";

/* v6.6.4 — restore the earnings period on a model cached before v6.6.3 added it, from the
   SAME per-company facts record the refresh that built this model already wrote. A read-only
   KV lookup, never a provider call — stays inside the "a public read never calls a provider"
   invariant above. Companies whose period is already present or whose value is absent are
   skipped without a KV read. */
async function restoreEarningsPeriods(model, env) {
  const syms = Object.keys(model.companies || {}).filter((sym) => {
    const v = model.companies[sym]?.metrics?.valuation;
    return v && Number.isFinite(v.ttmNetIncome) && !/\d{4}-\d{2}-\d{2}/.test(String(v.ttmNetIncomePeriod || ""));
  });
  if (!syms.length) return model;
  const companies = { ...model.companies };
  for (const sym of syms) {
    try {
      const [factsRec, issuerRec] = await Promise.all([
        env.PULSE_CACHE.get(SPOTLIGHT_KEYS.facts(sym), "json"),
        env.PULSE_CACHE.get(SPOTLIGHT_KEYS.issuer(sym), "json"),
      ]);
      const fundamentals = mergeFundamentals(factsRec?.fields?.secFundamentals?.value || null, issuerFundamentals(issuerRec));
      if (fundamentals) companies[sym] = restoreEarningsPeriod(companies[sym], fundamentals);
    } catch (_e) { /* a KV fault leaves this company's period withheld, never guessed */ }
  }
  return { ...model, companies };
}

export async function onRequestGet({ env }) {
  if (!spotlightEnabled(env)) return json({ schema: SPOTLIGHT_SCHEMA, enabled: false, reason: "feature flag off" });
  let stored = null;
  try { stored = await env.PULSE_CACHE.get(SPOTLIGHT_KEYS.model, "json"); } catch (_e) { /* a KV fault reads as unavailable, never a 500 */ }
  if (!stored || stored.schema !== SPOTLIGHT_SCHEMA)
    return json({ schema: SPOTLIGHT_SCHEMA, enabled: true, model: null, reason: "no spotlight model stored yet — the evening refresh has not run" }, 200, "public, max-age=60");
  const restored = await restoreEarningsPeriods(stored, env);
  const model = projectSpotlight(freshenSpotlight(restored, new Date()));
  return json({ schema: SPOTLIGHT_SCHEMA, enabled: true, model });
}
