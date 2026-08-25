// MacroDash v4.0 — public live-forward regime history.
// Route: GET /history.json (CORS-open, read-only)

const PREFIX = "public:regime-history:v1:";
const MAX_ROWS = 400;

export async function onRequest({ env }) {
  let rows = [];
  let available = true;
  try {
    if (!env.PULSE_CACHE) throw new Error("history store unavailable");
    const listed = await env.PULSE_CACHE.list({ prefix: PREFIX, limit: MAX_ROWS });
    const records = await Promise.all((listed?.keys || []).map((k) => env.PULSE_CACHE.get(k.name, "json")));
    rows = records.filter((r) => r && r.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch (_e) {
    available = false;
  }
  const historyStart = rows.length ? rows[rows.length - 1].date : null;
  return new Response(JSON.stringify({
    schema: "md-history-v1",
    live_forward_only: true,
    history_start: historyStart,
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
