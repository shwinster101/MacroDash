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
// v5.0.0 (W0): the per-symbol `tt:quote:<SYM>` keys are RETIRED — one board refresh was
// ~40 writes + ~40 TTL expirations, which is how the KV free-tier delete cap blew on
// 2026-08-23. One merge-on-write batch key now carries the whole cache; the 2-minute
// freshness contract is unchanged and lives on each entry's own `at` (see quote-cache.js).
import { readQuoteBatch, writeQuoteBatch, freshEntry, QUOTE_TTL_S } from "../lib/quote-cache.js";

// Freshness window = QUOTE_TTL_S (quote-cache.js, the one home) — Finnhub free tier is
// 60 calls/min; the 2-min window keeps one board refresh well inside that budget.
const MAX_SYMS = 40;
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

  // KV first — ONE batch read replaces N per-symbol gets. An entry is a hit only when its
  // OWN stamp is inside the window (freshEntry): merge-on-write refreshes the key, so key
  // presence proves nothing about entry age.
  const cached = await readQuoteBatch(env);
  for (const s of syms) {
    const hit = freshEntry(cached.quotes[s], now);
    if (hit) quotes[s] = hit; else misses.push(s);
  }

  // Fetch misses in small batches — Cloudflare caps concurrent subrequests, and
  // saturating it makes queued calls time out (the same lesson snapshot.js encodes).
  const fetched = {};
  for (let i = 0; i < misses.length; i += 5) {
    const batch = misses.slice(i, i + 5);
    const got = await Promise.all(batch.map((s) => fetchQuote(s, env.FINNHUB_KEY)));
    batch.forEach((s, j) => {
      const q = got[j];
      if (!q) return;                       // stays absent -> client uses ref_px
      const rec = { ...q, at: new Date(now).toISOString() };
      quotes[s] = rec;
      fetched[s] = rec;
    });
  }
  // ONE write for the whole refresh (merge-on-write — a subset request cannot clobber the
  // symbols it did not ask about). Zero fetches -> zero writes.
  await writeQuoteBatch(env, fetched, now);

  return json({
    quotes,
    asOf: new Date(now).toISOString(),
    requested: syms.length,
    // Named so the client can say WHICH names fell back rather than implying all are live.
    missing: syms.filter((s) => !quotes[s]),
  });
}
