// FEAT-TT-LIVEPX (v3.24) — current prices for the TT board's computed-upside ranking.
//
// WHY THIS EXISTS: `ref_px` is a MANUAL mark, stamped by the daily triage. Between runs
// it goes stale, so a name that has moved 8% since the stamp still ranks off yesterday's
// price — and "which name is cheap RIGHT NOW" is precisely the question the ranking is
// asked. This endpoint supplies the live half; the terminal falls back to the stamped
// mark whenever it is unavailable, so the board never breaks on a bad quote feed.
//
// KEY SAFETY: env.FINNHUB_KEY stays in the Function, exactly as snapshot.js holds it.
// The browser only ever talks to this endpoint, never to Finnhub.
//
// AUTH: same gate as /api/tt (shared authorize()), so the owner's Finnhub quota cannot be
// spent by anonymous callers. Prices are not secret; the quota is the thing being guarded.
import { authorize } from "./tt.js";

const CACHE_PREFIX = "tt:quote:";
const CACHE_TTL = 120;      // seconds — Finnhub free tier is 60 calls/min; a 2-min cache
const MAX_SYMS = 40;        // keeps one board refresh well inside that budget
const SYM_RE = /^[A-Z.\-]{1,8}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// One Finnhub quote. Returns null on any failure — a missing symbol must degrade to the
// stamped ref_px, never to a fabricated or zero price.
// Mirrors fetchEquities() in snapshot.js EXACTLY on the wire: the Accept header and an
// explicit timeout are load-bearing. A first cut here used a bare fetch with a cf cacheTtl
// option and every symbol came back empty from production while snapshot.js read ok:5 on
// the same key — proof the difference is the request, not the feed. Do not "simplify" this.
async function fetchQuote(sym, key) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`,
      { headers: { Accept: "application/json" }, signal: ctl.signal }
    );
    if (!r.ok) return null;
    const q = await r.json();
    // `c` is the current price. Finnhub returns c:0 for unknown symbols — that is a
    // MISS, not a free stock, so it must be rejected rather than passed through.
    const px = parseFloat(q && q.c);
    if (!isFinite(px) || px <= 0) return null;
    const dp = parseFloat(q.dp);   // Finnhub's own day-change %, same field snapshot.js uses
    return {
      px: parseFloat(px.toFixed(2)),
      chg: isFinite(dp) ? parseFloat(dp.toFixed(2)) : null,
    };
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);
  if (!env.FINNHUB_KEY) return json({ quotes: {}, degraded: "no FINNHUB_KEY configured" });

  const raw = new URL(request.url).searchParams.get("syms") || "";
  const syms = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYM_RE.test(s)))]
    .slice(0, MAX_SYMS);
  if (!syms.length) return json({ quotes: {} });

  const now = Date.now();
  const quotes = {};
  const misses = [];

  // KV first — a board refresh on every page load must not burn the rate limit.
  await Promise.all(syms.map(async (s) => {
    if (!env.PULSE_CACHE) { misses.push(s); return; }
    try {
      const hit = await env.PULSE_CACHE.get(CACHE_PREFIX + s, "json");
      if (hit && Number.isFinite(hit.px)) quotes[s] = hit; else misses.push(s);
    } catch (_e) { misses.push(s); }
  }));

  // Fetch misses in small batches — Cloudflare caps concurrent subrequests, and
  // saturating it makes queued calls time out (the same lesson snapshot.js encodes).
  for (let i = 0; i < misses.length; i += 5) {
    const batch = misses.slice(i, i + 5);
    const got = await Promise.all(batch.map((s) => fetchQuote(s, env.FINNHUB_KEY)));
    await Promise.all(batch.map(async (s, j) => {
      const q = got[j];
      if (!q) return;                       // stays absent -> client uses ref_px
      const rec = { ...q, at: new Date(now).toISOString() };
      quotes[s] = rec;
      if (env.PULSE_CACHE) {
        try { await env.PULSE_CACHE.put(CACHE_PREFIX + s, JSON.stringify(rec), { expirationTtl: CACHE_TTL }); } catch (_e) {}
      }
    }));
  }

  return json({
    quotes,
    asOf: new Date(now).toISOString(),
    requested: syms.length,
    // Named so the client can say WHICH names fell back rather than implying all are live.
    missing: syms.filter((s) => !quotes[s]),
  });
}
