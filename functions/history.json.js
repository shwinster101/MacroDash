// MacroDash v4.0 — public live-forward regime history.
// Route: GET /history.json (CORS-open, read-only)

import { HISTORY_PREFIX, OUTCOME_SCHEMA, outcomeKey } from "../src/publicHistory.js";

const MAX_ROWS = 400;

export async function onRequest({ env }) {
  let rows = [];
  let available = true;
  try {
    if (!env.PULSE_CACHE) throw new Error("history store unavailable");
    const listed = await env.PULSE_CACHE.list({ prefix: HISTORY_PREFIX, limit: MAX_ROWS });
    const records = await Promise.all((listed?.keys || []).map((k) => env.PULSE_CACHE.get(k.name, "json")));
    rows = await Promise.all(records.filter((r) => r && r.date).map(async (record) => {
      let outcome = null;
      try {
        const candidate = await env.PULSE_CACHE.get(outcomeKey(record.date), "json");
        if (candidate?.schema === OUTCOME_SCHEMA && candidate.call_date === record.date) outcome = candidate;
      } catch { /* a missing companion means pending, never a failed history feed */ }
      return { ...record, outcomes: outcome || null };
    }));
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch (_e) {
    available = false;
  }
  const historyStart = rows.length ? rows[rows.length - 1].date : null;
  return new Response(JSON.stringify({
    schema: "md-history-v1",
    live_forward_only: true,
    history_start: historyStart,
    outcomes_live_forward_only: true,
    available,
    rows,
  }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    },
  });
}
