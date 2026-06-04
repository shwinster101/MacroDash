// MacroDash v2.0 — Pages Function: GET /api/fred
// Reads ONLY the pre-computed KV key the cron Worker writes. This function
// has NO API key and makes NO upstream calls — even if fully exposed, no
// secret can leak. (Satisfies static-gate #4: no keys reachable from the edge
// surface the browser talks to.)
//
// Binds the SAME PULSE_CACHE KV namespace as the cron Worker (read access).

const KV_KEY = "pulse:macro:latest";

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Edge-cache the response briefly; the data only changes twice a day.
      "cache-control": "public, max-age=300",
      ...extraHeaders,
    },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const raw = await env.PULSE_CACHE.get(KV_KEY);
    if (!raw) {
      // Cold cache: return an explicit empty-but-valid shape so the hook
      // cleanly falls back to mock instead of throwing.
      return json({ error: "no_data", metrics: {}, generatedAt: null });
    }
    const payload = JSON.parse(raw);
    return json(payload);
  } catch (e) {
    // KV read or parse failed: degrade to mock on the client, don't 500.
    return json({ error: "read_failed", metrics: {}, generatedAt: null });
  }
}
