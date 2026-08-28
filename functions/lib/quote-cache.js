// functions/lib/quote-cache.js — the ONE home of the quote cache's key shape (v5.0.0, W0).
//
// WHY THIS EXISTS. Until v5 the quote cache was ONE KV KEY PER SYMBOL
// (`tt:quote:<SYM>`, 120s TTL). The terminal quotes the whole book (<=40 symbols) on every
// page load and every ⟳ tap, so a single cold refresh was ~40 writes and ~40 TTL
// expirations — and on 2026-08-23 the account blew through the Workers KV free-tier
// 1000-deletes/day cap mid-session (whether Cloudflare bills TTL expiry against that quota
// is a platform semantic this repo cannot settle; per-symbol keys were the only
// 1000/day-magnitude path either way, and they pressed the 1000-writes/day cap identically).
// The fix is the key SHAPE, not the freshness contract: one batch key, merge-on-write, so a
// cold whole-book refresh is 1 write instead of 40.
//
// THE FRESHNESS CONTRACT DID NOT MOVE. The terminal states a 2-minute quote-cache window in
// its own UI, so 120 seconds stays the freshness rule — but it now lives on EACH ENTRY's
// own `at` stamp instead of on key expiry. That matters because merge-on-write refreshes
// the key, so an entry could physically outlive 120s inside a fresh key; `freshEntry()` is
// what keeps such an entry from ever being SERVED as live. Every consumer (quotes.js GET,
// tt.js's ledger px stamp, allocation.js's liveQuotes) judges freshness through this one
// function — three copies of an age rule is the drift this repo keeps paying for.
//
// The key's own TTL (1h) is garbage collection, not freshness. Races: two concurrent
// merge-on-writes can drop each other's symbols — the loser's entries are just cache
// misses on the next call. Acceptable for a cache; never for a system of record.

export const QUOTE_BATCH_KEY = "tt:quote:batch:v1";
export const QUOTE_TTL_S = 120;        // the stated 2-minute freshness window, per ENTRY
export const QUOTE_KEY_TTL_S = 3600;   // key-level GC only — freshness never reads this
export const QUOTE_PRUNE_S = 3600;     // entries older than this are dropped at write time

// The whole batch, or an empty shape — never null, so callers index without guards.
export async function readQuoteBatch(env) {
  if (!env || !env.PULSE_CACHE) return { quotes: {} };
  try {
    const b = await env.PULSE_CACHE.get(QUOTE_BATCH_KEY, "json");
    if (b && typeof b === "object" && b.quotes && typeof b.quotes === "object") return b;
  } catch (_e) {}
  return { quotes: {} };
}

// An entry is servable as live iff it has a finite px AND its own stamp is inside the
// window. A missing/old/garbled stamp fails CLOSED to null — the caller's ref_px fallback
// is the honest degradation, a silently-stale "live" price is not.
export function freshEntry(rec, nowMs, ttlS = QUOTE_TTL_S) {
  if (!rec || !Number.isFinite(rec.px)) return null;
  const t = Date.parse(rec.at || "");
  if (!isFinite(t)) return null;
  return (nowMs - t) <= ttlS * 1000 ? rec : null;
}

// Merge-on-write: read the current batch, overlay `updates` (sym -> record with its own
// `at`), prune anything past QUOTE_PRUNE_S, put ONCE. A subset request can therefore never
// clobber the book-wide cache — the symbols it did not touch ride through untouched.
export async function writeQuoteBatch(env, updates, nowMs) {
  if (!env || !env.PULSE_CACHE || !updates || !Object.keys(updates).length) return;
  try {
    const batch = await readQuoteBatch(env);
    const merged = { ...batch.quotes, ...updates };
    for (const [sym, rec] of Object.entries(merged)) {
      const t = Date.parse((rec && rec.at) || "");
      if (!isFinite(t) || (nowMs - t) > QUOTE_PRUNE_S * 1000) delete merged[sym];
    }
    await env.PULSE_CACHE.put(
      QUOTE_BATCH_KEY,
      JSON.stringify({ at: new Date(nowMs).toISOString(), quotes: merged }),
      { expirationTtl: QUOTE_KEY_TTL_S }
    );
  } catch (_e) { /* cache write failure must never fail the request being served */ }
}
