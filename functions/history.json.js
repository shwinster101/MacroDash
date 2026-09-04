// MacroDash v4.0 — public live-forward regime history.
// Route: GET /history.json (CORS-open, read-only)

import { HISTORY_PREFIX, OUTCOME_SCHEMA, outcomeKey, CLOSE_READ_PREFIX, closeReadKey, validCloseRead } from "../src/publicHistory.js";

const MAX_ROWS = 400;

export async function onRequest({ env }) {
  let rows = [];
  let available = true;
  let orphaned = [];
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
      /* v6.2: the 6pm CLOSE READ joins the day's row the way the outcome companion does —
         INTO the row, never as a second row (the row count is the number of scored calls).
         A FAILED capture is served as itself; an absent key means no read that evening. */
      let closeRead = null;
      try { closeRead = validCloseRead(await env.PULSE_CACHE.get(closeReadKey(record.date), "json"), record.date); }
      catch { /* absent or unreadable: no close read, never a failed history feed */ }
      return { ...record, outcomes: outcome || null, close_read: closeRead };
    }));
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    /* A close read with NO 10am row is an ORPHAN — surfaced by date, never manufactured into
       a row: an absent 10am row still means the 10am branch never ran (the Friday-miss
       diagnostic property), and a manufactured row would hide exactly that. */
    try {
      const listedClose = await env.PULSE_CACHE.list({ prefix: CLOSE_READ_PREFIX, limit: MAX_ROWS });
      const rowDates = new Set(rows.map((r) => String(r.date)));
      orphaned = (listedClose?.keys || []).map((k) => k.name.slice(CLOSE_READ_PREFIX.length))
        .filter((d) => d && !rowDates.has(d)).sort().reverse();
    } catch { /* diagnostic list only */ }
  } catch (_e) {
    available = false;
  }
  const historyStart = rows.length ? rows[rows.length - 1].date : null;
  return new Response(JSON.stringify({
    schema: "md-history-v1",
    live_forward_only: true,
    history_start: historyStart,
    outcomes_live_forward_only: true,
    close_reads_unscored: true,
    close_reads_orphaned: orphaned,
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
