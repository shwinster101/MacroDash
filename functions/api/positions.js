// FEAT-TT-POSSTORE (v3.34): /api/positions — measured `pos` facts, moved OUT of the
// shared 64KB book document (tt:book:v1) into their own KV document (tt:pos:v1).
//
// WHY THIS EXISTS: a broker sync writes `pos` (shares, market value, cost basis, option
// legs — see validatePos in tt.js) for every held name. Three separate sync passes this
// week hit the SAME wall: the book document is a single 64KB PUT, shared with tiers,
// theses, PT models, hinges, projections and dots for 30+ names, so adding position data
// for the names that were still missing it meant trimming fields just to fit — the same
// squeeze, over and over, on a document that keeps growing for unrelated reasons. The
// belief ledger (v3.32) already proved the fix for this shape of problem: give the
// growing thing its own KV key. Positions get the same treatment. `pos` is a MEASURED
// fact (see validatePos's own comment in tt.js) — a different epistemic class from every
// asserted field left in the book — so splitting it out is also the more honest home for
// it, not just a byte-budget dodge.
//
// STORAGE: KV PULSE_CACHE, key tt:pos:v1, no TTL: {asOf, positions: {sym: pos}}. One
// document, not one-key-per-sym — the whole map is small (a broker sync writes tens of
// names, not thousands) and the terminal always wants the whole thing at boot to compute
// caps/clusters/reconcile across the book, so one GET beats an N-symbol fan-out.
//
// AUTH: same PIN gate as /api/tt — position data is at least as sensitive as the book.
// WRITE SHAPE: PUT is MERGE-ONLY ({updates: {sym: pos|null}}), never a whole-map replace —
// a sync that only touched 6 names must never be able to silently blank the other 25.
// {sym: null} is the explicit removal path (a name that's been fully exited).
import { authorize, validatePos } from "./tt.js";

const POS_KEY = "tt:pos:v1";
const BOOK_KEY = "tt:book:v1";               // mirrors the constant in functions/api/tt.js
const SNAP_PREFIX = "tt:book:snap:";         // mirrors the constant in functions/api/tt.js
const SNAP_TTL = 30 * 24 * 3600;
const SYM_RE = /^[A-Z.\-]{1,8}$/;
/* Deliberately 64KB, NOT the book's 200KB (v3.57, E2E). The split exists because this store
   holds ONLY {sym: pos} records — no theses, no models, no dots — so 40 names of position data
   with option legs sits comfortably inside it, and a merge PUT far larger than that is a
   malformed sync rather than a legitimate one. Stated because three files carrying two
   different caps with no reason reads as an oversight. The terminal never PUTs here (it GETs
   only); the writer is the broker sync. */
const MAX_BODY = 64 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const etDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

// Same CSRF guard as tt.js's crossOrigin (not exported there — small enough to mirror
// rather than widen tt.js's export surface for one four-line check).
function crossOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; } catch (_e) { return true; }
}

function posMapFrom(stored) {
  return (stored && typeof stored.positions === "object" && !Array.isArray(stored.positions))
    ? stored.positions : {};
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);

  const url = new URL(request.url);
  /* SEMANTICS (v3.54, 11.4.5 audit): the one-time migration MUTATES the book (it strips
     embedded `pos` and re-saves), and it used to run on GET — so a prefetch, a link
     preview, an uptime monitor or a replayed URL could trigger a write. GET must be safe.
     It is now POST-only, behind the same Origin/CSRF guard every other mutation uses; the
     idempotency contract is unchanged, so a re-run is still a no-op. A GET is answered with
     405 + the correct verb rather than silently doing nothing. */
  if (url.searchParams.get("migrate") === "1")
    return json({ error: "migrate mutates state — use POST /api/positions?migrate=1" }, 405);

  let stored = null;
  try { stored = await env.PULSE_CACHE.get(POS_KEY, "json"); } catch (_e) {}
  const positions = posMapFrom(stored);

  const sym = url.searchParams.get("sym");
  if (sym) {
    if (!SYM_RE.test(sym)) return json({ error: "bad sym" }, 400);
    return json({ sym, pos: positions[sym] || null });
  }
  return json({ asOf: stored?.asOf || null, positions });
}

// Merge-only: a request only ever describes the names it touched. {sym: null} removes a
// name (fully exited); anything else must pass validatePos exactly as the book used to
// require inline. No If-Match — this is a low-concurrency admin tool (one operator, one
// broker sync at a time), unlike the book's multi-device whole-document replace.
export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }

  const updates = body && body.updates;
  if (!updates || typeof updates !== "object" || Array.isArray(updates))
    return json({ error: "body.updates must be an object of {sym: pos|null}" }, 400);
  const syms = Object.keys(updates);
  if (!syms.length) return json({ error: "updates is empty" }, 400);
  for (const s of syms) {
    if (!SYM_RE.test(s)) return json({ error: "bad sym: " + s }, 400);
    const p = updates[s];
    if (p !== null) {
      const err = validatePos(p);
      if (err) return json({ error: s + ": " + err }, 400);
    }
  }

  let stored = null;
  try { stored = await env.PULSE_CACHE.get(POS_KEY, "json"); } catch (_e) {}
  const positions = { ...posMapFrom(stored) };
  for (const s of syms) {
    if (updates[s] === null) delete positions[s];
    else positions[s] = updates[s];
  }

  const next = { asOf: etDate(), positions };
  try {
    await env.PULSE_CACHE.put(POS_KEY, JSON.stringify(next)); // no TTL — persistent
  } catch (e) {
    return json({ error: "storage write failed: " + (e?.message || "unknown") }, 503);
  }
  return json({ ...next, empty: false });
}

// ── one-time idempotent migration ───────────────────────────────────────────
// Pulls any `pos` still embedded in book entries (from before this endpoint existed) into
// tt:pos:v1, then strips it from the book to reclaim the bytes that motivated this split.
// No-op (migrated:0) once nothing embedded remains — safe to call more than once, the same
// idempotency contract as ledger.js's ?seed=1.
async function runMigrate(env) {
  let book = null;
  try { book = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  if (!book || !Array.isArray(book.book)) return json({ migrated: 0, reason: "no book found" });

  const embedded = book.book.filter((e) => e && e.pos);
  if (!embedded.length) return json({ migrated: 0, reason: "no embedded pos fields on the book — already migrated or nothing synced yet" });

  let stored = null;
  try { stored = await env.PULSE_CACHE.get(POS_KEY, "json"); } catch (_e) {}
  const positions = { ...posMapFrom(stored) };
  for (const e of embedded) positions[e.sym] = e.pos;

  try {
    await env.PULSE_CACHE.put(POS_KEY, JSON.stringify({ asOf: etDate(), positions }));
  } catch (e) {
    return json({ error: "positions store failed — book was NOT touched, safe to retry: " + (e?.message || "unknown") }, 503);
  }

  // Snapshot before stripping — same first-write-of-the-day restore point tt.js's own PUT
  // path keeps, so a bad migration is still recoverable.
  try {
    const snapKey = SNAP_PREFIX + etDate();
    const existing = await env.PULSE_CACHE.get(snapKey);
    if (!existing) await env.PULSE_CACHE.put(snapKey, JSON.stringify(book), { expirationTtl: SNAP_TTL });
  } catch (_e) { /* a missing rollback point must not block the migration */ }

  const strippedBook = book.book.map((e) => {
    if (!e.pos) return e;
    const { pos: _pos, ...rest } = e;
    return rest;
  });
  const prevV = parseFloat(book.version);
  const version = Number.isFinite(prevV) ? (prevV + 0.1).toFixed(1) : "1.0";
  const nextBook = { ...book, version, asOf: etDate(), book: strippedBook };
  try {
    await env.PULSE_CACHE.put(BOOK_KEY, JSON.stringify(nextBook));
  } catch (e) {
    return json({ error: "positions ARE migrated and saved; book strip failed, safe to retry: " + (e?.message || "unknown") }, 503);
  }

  return json({ migrated: embedded.length, syms: embedded.map((e) => e.sym), bookVersion: version });
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  if (url.searchParams.get("migrate") === "1") return runMigrate(env);
  return json({ error: "unknown POST action" }, 400);
}
export async function onRequest({ request, ...rest }) {
  if (request.method === "GET") return onRequestGet({ request, ...rest });
  if (request.method === "PUT") return onRequestPut({ request, ...rest });
  if (request.method === "POST") return onRequestPost({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
