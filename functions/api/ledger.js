// FEAT-TT-LEDGER (v3.32): /api/ledger — read path for the belief-change history that
// functions/api/tt.js appends on every PUT (see diffForLedger + appendLedger there).
//
// WHY THIS EXISTS: every other field in the book overwrites in place. This is the one
// place the terminal remembers what you believed BEFORE, so it can finally answer "was I
// right?" and (paired with FEAT-TT-SPREAD) flag "estimates up, price down" automatically
// instead of relying on a human to notice, the way the 7/28 CRDO read had to be.
//
// STORAGE: KV PULSE_CACHE, key tt:ledger:<sym> (JSON array, capped 500 entries, oldest
// pruned) + tt:ledger:index ({sym: {count, last}}). Both written only by tt.js's PUT path;
// this file is READ-ONLY by design — there is no POST/PUT here, belief history is a
// byproduct of book edits, never a thing edited directly.
//
// AUTH: same PIN gate as /api/tt — this is as private as the book itself (a competitor
// seeing exactly when and why a tier flipped is worth more than the tier alone).
import { authorize, diffForLedger } from "./tt.js";

const LEDGER_PREFIX = "tt:ledger:";   // mirrors the constant in functions/api/tt.js
const LEDGER_INDEX_KEY = "tt:ledger:index";
const SYM_RE = /^[A-Z.\-]{1,8}$/;

// Mirrors the guard in tt.js / positions.js — a same-origin check on every mutation.
function crossOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; } catch (_e) { return true; }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);

  const url = new URL(request.url);

  /* SEMANTICS (v3.54, 11.4.5 audit): the backfill WRITES ledger entries, and it used to run
     on GET — a prefetch, link preview, uptime monitor or replayed URL could trigger it. GET
     must be safe. POST-only now, behind the same Origin/CSRF guard the other mutations use;
     the one-time idempotency contract is unchanged, so a re-run remains a no-op. */
  if (url.searchParams.get("seed") === "1")
    return json({ error: "seed mutates state — use POST /api/ledger?seed=1" }, 405);

  // Two client features need belief changes across the WHOLE book, not one sym: the
  // SCORECARD (tier/rank/comp, ranked by since-move) and FEAT-TT-SPREAD's divergence flag
  // (est entries — "estimates up, price down" is the automated CRDO pattern, and it can't
  // wait for someone to open that one tab to notice it). One list + N gets here beats an
  // N+1 round trip from the client for every board render, so this returns every kind in
  // the window and lets each client feature filter to what it needs.
  if (url.searchParams.get("recent") === "1") {
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days"), 10) || 90));
    const cutoff = Date.now() - days * 86400000;
    let list;
    try { list = await env.PULSE_CACHE.list({ prefix: LEDGER_PREFIX }); }
    catch (e) { return json({ error: "list failed: " + (e?.message || "unknown") }, 503); }
    const syms = list.keys.map((k) => k.name.slice(LEDGER_PREFIX.length)).filter((s) => s && s !== "index");
    const out = [];
    await Promise.all(syms.map(async (sym) => {
      let entries = null;
      try { entries = await env.PULSE_CACHE.get(LEDGER_PREFIX + sym, "json"); } catch (_e) {}
      if (!Array.isArray(entries)) return;
      for (const e of entries) {
        const ts = Date.parse(e.t);
        if (isFinite(ts) && ts >= cutoff) out.push(e);
      }
    }));
    out.sort((a, b) => Date.parse(b.t) - Date.parse(a.t));
    return json({ days, entries: out });
  }

  const sym = url.searchParams.get("sym");
  if (sym) {
    if (!SYM_RE.test(sym)) return json({ error: "bad sym" }, 400);
    let entries = null;
    try { entries = await env.PULSE_CACHE.get(LEDGER_PREFIX + sym, "json"); } catch (_e) {}
    return json({ sym, entries: Array.isArray(entries) ? entries : [] });
  }

  // Default: the index — every sym with history, a count, and its last-touched date.
  // Absent is a normal empty state (nothing has changed since the ledger shipped, or the
  // one-time seed hasn't run yet) — never an error.
  let idx = null;
  try { idx = await env.PULSE_CACHE.get(LEDGER_INDEX_KEY, "json"); } catch (_e) {}
  return json({ index: (idx && typeof idx === "object" && !Array.isArray(idx)) ? idx : {} });
}

// ── one-time idempotent backfill ────────────────────────────────────────────
// Snapshots (tt:book:snap:<date>, written by tt.js on the first PUT of each ET day) are
// daily book states — the START of that day's book, not a continuous feed. Walking them
// oldest→newest and diffing consecutive pairs recovers the belief changes that happened
// EACH day, dated to the later day (the earliest point that state is known to exist).
// The final pair diffs the newest snapshot against the CURRENT live book, since today's
// edits have no snapshot of their own yet. Historical px is honestly best-effort: a
// snapshot doesn't carry a live quote, so this uses that sym's ref_px ONLY if it is dated
// within 2 days of the entry — otherwise px stays null, never fabricated.
const SNAP_PREFIX = "tt:book:snap:";   // mirrors the constant in functions/api/tt.js
const BOOK_KEY = "tt:book:v1";         // mirrors the constant in functions/api/tt.js
const LEDGER_CAP = 500;

async function runSeed(env) {
  let existingIdx = null;
  try { existingIdx = await env.PULSE_CACHE.get(LEDGER_INDEX_KEY, "json"); } catch (_e) {}
  if (existingIdx) return json({ seeded: false, reason: "already seeded — index exists; delete tt:ledger:index in KV to force a re-seed" });

  let list;
  try { list = await env.PULSE_CACHE.list({ prefix: SNAP_PREFIX }); }
  catch (e) { return json({ error: "snapshot list failed: " + (e?.message || "unknown") }, 503); }
  const dates = list.keys.map((k) => k.name.slice(SNAP_PREFIX.length)).sort(); // oldest first
  if (!dates.length) return json({ seeded: false, reason: "no snapshots to backfill from" });

  const snaps = [];
  for (const d of dates) {
    let snap = null;
    try { snap = await env.PULSE_CACHE.get(SNAP_PREFIX + d, "json"); } catch (_e) {}
    if (snap) snaps.push({ date: d, book: snap.book || [], cut: snap.cut || [] });
  }
  let current = null;
  try { current = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  const todayEt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  if (current) snaps.push({ date: todayEt, book: current.book || [], cut: current.cut || [] });
  if (snaps.length < 2) return json({ seeded: false, reason: "fewer than 2 states available to diff" });

  const pxFor = (bookAfter, sym, dateStr) => {
    const e = (bookAfter || []).find((x) => x.sym === sym);
    const rp = e && e.deepDive && e.deepDive.ref_px;
    if (!rp || !isFinite(rp.px) || !rp.at) return null;
    const d1 = Date.parse(rp.at + "T12:00:00Z"), d2 = Date.parse(dateStr + "T12:00:00Z");
    if (!isFinite(d1) || !isFinite(d2)) return null;
    return Math.abs(d1 - d2) <= 2 * 86400000 ? rp.px : null;
  };

  const allEntries = [];
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1], b = snaps[i];
    const entries = diffForLedger(a.book, b.book, a.cut, b.cut, b.date + "T12:00:00Z", "seed");
    for (const e of entries) allEntries.push({ ...e, px: pxFor(b.book, e.sym, b.date) });
  }
  if (!allEntries.length) return json({ seeded: true, entries: 0, states: snaps.length, note: "no belief changes detected across the available history" });

  const bySym = new Map();
  for (const e of allEntries) { if (!bySym.has(e.sym)) bySym.set(e.sym, []); bySym.get(e.sym).push(e); }
  const idx = {};
  for (const [sym, entries] of bySym) {
    const capped = entries.length > LEDGER_CAP ? entries.slice(entries.length - LEDGER_CAP) : entries;
    try { await env.PULSE_CACHE.put(LEDGER_PREFIX + sym, JSON.stringify(capped)); }
    catch (e) { return json({ error: "seed write failed for " + sym + ": " + (e?.message || "unknown") }, 503); }
    idx[sym] = { count: capped.length, last: capped[capped.length - 1].t.slice(0, 10) };
  }
  try { await env.PULSE_CACHE.put(LEDGER_INDEX_KEY, JSON.stringify(idx)); }
  catch (e) { return json({ error: "index write failed: " + (e?.message || "unknown") }, 503); }

  return json({ seeded: true, entries: allEntries.length, syms: bySym.size, states: snaps.length });
}

// The backfill is the ledger's ONLY mutation, so POST carries exactly it (v3.54).
export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  if (url.searchParams.get("seed") === "1") return runSeed(env);
  return json({ error: "unknown POST action" }, 400);
}
