// FEAT-TT-DDSTORE (v3.75): /api/deepdive — thesis payloads moved OUT of the shared book
// document (tt:book:v1) into per-ticker KV documents (tt:dd:v1:<SYM>).
//
// WHY THIS EXISTS: this is the third time the same wall has been hit, and the changelog
// called it both times. `pos` was split out in v3.34 (FEAT-TT-POSSTORE) and the belief
// ledger in v3.32, each because a growing thing was riding inside a single fixed-size PUT.
// `deepDive` is by far the largest such thing and the fastest-growing: consensus tables,
// pt_model schedules, hinges, gates, projections, capex/tokens blocks and pre-committed
// falsifier drafts, per name. DD_MAX went 8KB → 15KB (v3.63) → 45KB (v3.70) and MAX_BODY
// 64KB → 200KB (v3.34) → 300KB (v3.70) chasing it; v3.70's own note said plainly that
// raising the cap "is a stopgap, not the fix" and that this split "is the permanent answer
// and remains deliberately deferred." On 2026-08-05 the book reached 306,425 of 307,200
// bytes — 99.7% — and a routine two-name TT pass had to be written tighter to fit. That is
// the deferral coming due, so this is the fix, not another cap raise.
//
// STORAGE: ONE KEY PER SYMBOL (tt:dd:v1:<SYM>), unlike positions' single map. The shape
// is different and so is the right answer: position records are tiny and the terminal
// needs all of them at boot to compute caps/clusters, so one document beats a fan-out.
// Thesis payloads are up to DD_MAX each and the terminal only ever renders ONE at a time
// (the deep-dive tab), so per-symbol keys mean a tab open reads ~10KB instead of ~300KB,
// and one name's growth can never squeeze another's. The board still needs cheap access to
// the SMALL fields it ranks on, which is what the index below is for.
//
// tt:dd:index:v1 — the board's working set: for each sym only the fields the ranking,
// readiness and chip surfaces actually read (pt_model, consensus, ref_px, hinge states,
// key_dates, composite score/tier, thesis dates). Full payloads are fetched per tab.
//
// AUTH: same PIN gate as /api/tt — thesis content is exactly as private as the book.
// WRITE SHAPE: PUT is per-symbol and whole-payload for that symbol only; one name's save
// can never touch another's, which is a strictly stronger guarantee than the whole-book
// replace it replaces.
import { authorize, diffDeepDive, appendLedger } from "./tt.js";

const DD_PREFIX = "tt:dd:v1:";
const DD_INDEX = "tt:dd:index:v1";
const BOOK_KEY = "tt:book:v1";               // mirrors the constant in functions/api/tt.js
const SNAP_PREFIX = "tt:book:snap:";         // mirrors the constant in functions/api/tt.js
const SNAP_TTL = 30 * 24 * 3600;
const SYM_RE = /^[A-Z.\-]{1,8}$/;

/* Mirrors DD_MAX in public/admin.html (45KB, v3.70). Stated rather than implied: this store
   holds ONE thesis payload per key, so the per-payload cap IS the per-key cap — the two
   numbers coincide here, unlike the book where DD_MAX and MAX_BODY were different limits on
   nested things. A payload larger than this is a runaway write, not a richer thesis. */
const MAX_BODY = 45 * 1024;

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

async function kvGet(env, key) {
  try { return await env.PULSE_CACHE.get(key, "json"); } catch (_e) { return null; }
}

/* The board's working set for ONE payload. Deliberately a WHITELIST, not a blacklist: a new
   payload block added later must not silently start bloating the index the whole board
   loads. Everything omitted here is still stored in full and read when the tab opens. */
export function ddIndexEntry(dd) {
  if (!dd || typeof dd !== "object") return null;
  /* Hinges ride the index as a TRIMMED array of the same shape, not as a precomputed tally.
     Every board surface that counts reds (readiness, the chip strip, the coverage strip, the
     BUY-row red naming) reads `dd.hinges` directly, and a summary field would have made all
     of them silently report ZERO reds for any name whose tab was never opened — a red fact
     disappearing behind a collapse, which is exactly the rule (v3.25) this repo enforces
     everywhere else. Keeping the array shape means those readers work unchanged, the same
     property posOf() gave the position split. Only the identity and the state travel; notes,
     evidence and observation dates stay in the full payload. */
  const hinges = (Array.isArray(dd.hinges) ? dd.hinges : []).map((h) => ({
    label: (h && (h.label || h.key || h.id)) || "unnamed",
    state: ["green", "amber", "red"].includes(h && h.state) ? h.state : "unknown",
  }));
  const e = {
    hinges,
    // the PT chain reads these two directly — they ARE the ranking inputs
    pt_model: dd.pt_model || null,
    consensus: dd.consensus ? { revenue_B: dd.consensus.revenue_B, eps: dd.consensus.eps,
      analysts: dd.consensus.analysts, derived: dd.consensus.derived } : null,
    ref_px: dd.ref_px || null,
    key_dates: Array.isArray(dd.key_dates) ? dd.key_dates : [],
    // the capex conservation lint (FEAT-TT-CAPEX) sums this ACROSS THE BOOK on the board —
    // omitting it would have dropped names out of the sum and called the total a floor for
    // a reason that was really just lazy loading
    capex_exposure: dd.capex_exposure || null,
    pt_consensus: dd.pt_consensus || null,   // FEAT-TT-SPREAD's "street vs mine" is board-visible
    // FEAT-TT-ENTRY (v3.82): the eligible line renders entry distance at BOARD altitude,
    // before any tab is opened — omitting this would make the WHEN chip silently vanish for
    // any store-only name (the same lazy-loading trap that put hinges in this index).
    // `subsidiaries` is deliberately NOT here: it renders only on the tab, and the whitelist
    // doctrine is that the index carries exactly what the board reads, nothing more.
    price_action: dd.price_action || null,
    thesis_version: dd.thesis_version || null,
    as_of: dd.as_of || dd.updated || null,
    // the quality gate reads score+tier only, never the prose
    composite: dd.composite ? { score: dd.composite.score, raw_tier: dd.composite.raw_tier,
      capped_tier: dd.composite.capped_tier } : null,
    // v3.75: presence flags so the board can SAY a name has depth without loading it
    has_deep_dive: true,
    has_falsifier_draft: !!dd.falsifiers_v2_draft,
    gates_n: Array.isArray(dd.gates) ? dd.gates.length : (dd.gates ? Object.keys(dd.gates).length : 0),
  };
  return e;
}

async function rebuildIndexEntry(env, sym, dd) {
  const idx = (await kvGet(env, DD_INDEX)) || { version: 1, asOf: etDate(), entries: {} };
  if (dd === null) delete idx.entries[sym];
  else idx.entries[sym] = ddIndexEntry(dd);
  idx.asOf = etDate();
  await env.PULSE_CACHE.put(DD_INDEX, JSON.stringify(idx));
  return idx;
}

/* THE SERVER-SIDE CHOKE POINT — the counterpart to admin.html's ddOf(). v3.75 gave the CLIENT
   one resolution point and claimed the storage move was "invisible to every renderer", which
   was true and also incomplete: `functions/api/score.js` and the belief ledger read
   `entry.deepDive` straight off the book, and the migration silently emptied it under them.
   Every server consumer now goes through here: the payload store first, then a still-embedded
   payload for a pre-migration book — the same fallback order, so nothing breaks mid-migration. */
export async function readDeepDive(env, sym, book) {
  const stored = await kvGet(env, DD_PREFIX + sym);
  if (stored) return stored;
  const b = book || (await kvGet(env, BOOK_KEY));
  const e = b && Array.isArray(b.book) ? b.book.find((x) => x && x.sym === sym) : null;
  return (e && e.deepDive) || null;
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const url = new URL(request.url);

  /* SEMANTICS (the v3.54 rule): migrate MUTATES, so it is POST-only and a GET says so with
     the correct verb rather than silently doing nothing. */
  if (url.searchParams.get("migrate") === "1")
    return json({ error: "migrate mutates state — use POST /api/deepdive?migrate=1" }, 405);

  if (url.searchParams.get("index") === "1") {
    const idx = (await kvGet(env, DD_INDEX)) || { version: 1, asOf: null, entries: {} };
    return json({ asOf: idx.asOf, entries: idx.entries });
  }

  /* ?all=1 — every full payload in one body. Exists for ONE reason: EXPORT INTEGRITY. The
     terminal loads payloads lazily (one per tab open), so a backup built from what the client
     happens to hold in memory would silently omit every name the user never opened — a backup
     that looks complete and is not is worse than no backup, which is the same invisible-loss
     rule the migration's oversize naming follows. The board never calls this; it is the export
     path only, which is why the working set stays the small index above. */
  if (url.searchParams.get("all") === "1") {
    const idx = (await kvGet(env, DD_INDEX)) || { entries: {} };
    const syms = Object.keys(idx.entries || {}).sort();
    const out = {}, missing = [];
    for (const s of syms) {
      const dd = await kvGet(env, DD_PREFIX + s);
      if (dd) out[s] = dd; else missing.push(s);
    }
    // A sym the index claims but whose payload key is gone is NAMED, never quietly absent.
    return json({ asOf: idx.asOf || null, deepDives: out, count: syms.length - missing.length, missing });
  }
  const sym = url.searchParams.get("sym");
  if (!sym || !SYM_RE.test(sym)) return json({ error: "sym required" }, 400);
  const dd = await kvGet(env, DD_PREFIX + sym);
  return json({ sym, deepDive: dd || null });
}

export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  const sym = url.searchParams.get("sym");
  if (!sym || !SYM_RE.test(sym)) return json({ error: "sym required" }, 400);

  const raw = await request.text();
  if (raw.length > MAX_BODY)
    return json({ error: "oversize", key: DD_PREFIX + sym, bytes: raw.length, limit: MAX_BODY }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const dd = body && body.deepDive;
  // null is the explicit removal path (a name whose thesis is being cleared), mirroring
  // positions' {sym: null}. Anything else must be an object.
  if (dd !== null && (!dd || typeof dd !== "object" || Array.isArray(dd)))
    return json({ error: "deepDive must be an object, or null to remove" }, 400);

  /* FEAT-TT-DOTHOME (v3.84): `dots` belong to the BOOK ENTRY, never to the payload — and until
     now nothing enforced it. FEAT-TT-DOT (v3.17) put them on the entry precisely so that
     "replacing a deepDive payload can never wipe the inventory"; after the v3.75 split this
     endpoint became the one write path that replaces a payload wholesale, so a dot stored here
     is a dot with a single copy sitting in the blast radius of the next save.
     MEASURED 2026-08-13: ACHR, NU, SOFI and SYM each carried one, and for ACHR/NU/SOFI it was
     their ONLY dot — the 8/04 "first gates+composite pass" record, one editor save away from
     silent loss, and invisible to the terminal's dots UI (which reads e.dots) the whole time.
     A triage run had to notice by hand; an invariant a human has to police is not an invariant.
     HARD REJECT, not a silent strip: the caller holds the only copy at that moment, so dropping
     it quietly would destroy exactly what this guard exists to protect. The live store was
     cleaned before this shipped, so no existing payload can be rejected on re-save — the same
     rule MISKEY was held to in v3.39. */
  if (dd && Object.prototype.hasOwnProperty.call(dd, "dots"))
    return json({
      error: "deepDive must not carry `dots` — they belong on the book entry (e.dots), " +
        "so that replacing a payload can never wipe the inventory. Move them to the book " +
        "entry via PUT /api/tt FIRST, then re-save this payload without the key.",
      key: DD_PREFIX + sym,
    }, 400);

  // The belief ledger has to see this write. Before v3.75 a payload change arrived inside the
  // whole-book PUT and tt.js's diff caught it; after the split it arrives HERE and nowhere
  // else, so without this the ledger's thesis/hinge/pt/comp/est kinds go silent — the
  // terminal's memory, which is the one thing it has that a quote screen does not.
  const before = await kvGet(env, DD_PREFIX + sym);
  try {
    if (dd === null) await env.PULSE_CACHE.delete(DD_PREFIX + sym);
    else await env.PULSE_CACHE.put(DD_PREFIX + sym, JSON.stringify(dd));
    await rebuildIndexEntry(env, sym, dd);
  } catch (e) {
    return json({ error: "storage write failed: " + (e?.message || "unknown") }, 503);
  }
  // Fire-and-forget AFTER the write succeeds, exactly as tt.js does it: a ledger fault must
  // never fail the save the user is waiting on.
  try {
    const entries = diffDeepDive(before, dd, sym, new Date().toISOString(), null);
    if (entries.length) await appendLedger(env, entries);
  } catch (_e) { /* belief history is best-effort; the payload is already stored */ }
  return json({ sym, deepDive: dd, stored: true });
}

/* One-time, idempotent. Pulls every embedded deepDive out of the book into per-symbol keys,
   snapshots the book first (the same first-write-of-the-day restore point tt.js's own PUT
   keeps), then strips them and re-saves — reclaiming the bytes that motivated the split.
   Ordering is deliberate and identical to the positions migration: payloads are SAFE before
   the book is touched, so a failure at any step leaves a recoverable state and a retry is a
   no-op. */
async function runMigrate(env) {
  let book = null;
  try { book = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  if (!book || !Array.isArray(book.book)) return json({ migrated: 0, reason: "no book found" });

  const embedded = book.book.filter((e) => e && e.deepDive && typeof e.deepDive === "object");
  if (!embedded.length)
    return json({ migrated: 0, reason: "no embedded deepDive fields on the book — already migrated or nothing stored yet" });

  const before = JSON.stringify(book).length;
  const written = [], oversize = [];
  for (const e of embedded) {
    const payload = JSON.stringify(e.deepDive);
    if (payload.length > MAX_BODY) { oversize.push({ sym: e.sym, bytes: payload.length, limit: MAX_BODY }); continue; }
    try {
      await env.PULSE_CACHE.put(DD_PREFIX + e.sym, payload);
      written.push(e.sym);
    } catch (err) {
      return json({ error: "payload store failed for " + e.sym + " — book NOT touched, safe to retry: " + (err?.message || "unknown"),
        written }, 503);
    }
  }
  // An oversize payload is NAMED and left embedded rather than dropped: a silently skipped
  // thesis would be exactly the invisible-loss failure this repo keeps guarding against.
  if (oversize.length && !written.length)
    return json({ migrated: 0, oversize, reason: "every payload exceeded the per-key cap — nothing written, book untouched" }, 400);

  try {
    const idx = { version: 1, asOf: etDate(), entries: {} };
    for (const e of embedded) if (written.includes(e.sym)) idx.entries[e.sym] = ddIndexEntry(e.deepDive);
    await env.PULSE_CACHE.put(DD_INDEX, JSON.stringify(idx));
  } catch (err) {
    return json({ error: "payloads ARE saved; index build failed, safe to retry: " + (err?.message || "unknown"), written }, 503);
  }

  try {
    const snapKey = SNAP_PREFIX + etDate();
    const existing = await env.PULSE_CACHE.get(snapKey);
    if (!existing) await env.PULSE_CACHE.put(snapKey, JSON.stringify(book), { expirationTtl: SNAP_TTL });
  } catch (_e) { /* a missing rollback point must not block the migration */ }

  const strippedBook = book.book.map((e) => {
    if (!e.deepDive || !written.includes(e.sym)) return e;
    const { deepDive: _dd, ...rest } = e;
    return rest;
  });
  const prevV = parseFloat(book.version);
  const version = Number.isFinite(prevV) ? (prevV + 0.1).toFixed(1) : "1.0";
  const nextBook = { ...book, version, asOf: etDate(), book: strippedBook };
  const after = JSON.stringify(nextBook).length;
  try {
    await env.PULSE_CACHE.put(BOOK_KEY, JSON.stringify(nextBook));
  } catch (err) {
    return json({ error: "payloads ARE migrated and saved; book strip failed, safe to retry: " + (err?.message || "unknown"),
      written }, 503);
  }
  return json({ migrated: written.length, syms: written, oversize, bookVersion: version,
    book_bytes_before: before, book_bytes_after: after, reclaimed: before - after });
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
  const m = request.method.toUpperCase();
  if (m === "GET") return onRequestGet({ request, ...rest });
  if (m === "PUT") return onRequestPut({ request, ...rest });
  if (m === "POST") return onRequestPost({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
