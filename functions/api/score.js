// functions/api/score.js — the TT Underwriting Score endpoint (METHODOLOGY_VERSION in ttScore.js)
//
// THE SERVER COMPUTES; THE CLIENT SUBMITS EVIDENCE (spec §5.2/§13). The buildless admin
// client never calculates a score, tier, cap, or eligibility result — it PUTs normalized
// `underwriting_inputs` here, this handler recomputes the scorecard via src/ttScore.js
// (esbuild-inlined, the readout.json.js precedent), and the PUT response carries the
// normalized server result so no caller ever rereads eventually-consistent KV hoping the
// write is visible yet (the ENGINE0-CONT refresh lesson).
//
// STORAGE (§4.5) — dedicated keys, deliberately OUTSIDE the book document and the belief
// ledger. A complete scoring record is richer than a deepDive payload and has a different
// retention lifecycle; embedding it would re-create the exact squeeze FEAT-TT-POSSTORE
// (v3.34) split `pos` out to escape. Score writes add ZERO bytes to the book PUT.
//   tt:score:v1:<SYM>              current inputs + scorecard      64KB   no TTL
//   tt:score:snap:v1:<SYM>:<hash>  immutable snapshot              64KB   450d
//   tt:score:index:v1              compact board summary           —      no TTL
//   tt:decision:v1:<ts>:<id>       eligible-set candidate event    16KB   450d
//
// AUTH: same wall as /api/tt — authorize() imported (PIN session / x-tt-pin / Access JWT
// + the escalating KV lockout), crossOrigin mirrored (deliberately not exported by tt.js;
// the positions.js/ledger.js precedent). Belief history is as private as the book.

import { authorize } from "./tt.js";
import { buildScorecard, inputHash, METHODOLOGY_VERSION, commitFingerprint } from "../../src/ttScore.js";
import { readDeepDive } from "./deepdive.js";
import { routeFor, ROUTE_MAP_VERSION } from "../../src/ttScoreRegistry.js";

const SCORE_PREFIX = "tt:score:v1:";
const SNAP_PREFIX = "tt:score:snap:v1:";
const INDEX_KEY = "tt:score:index:v1";
const DECISION_PREFIX = "tt:decision:v1:";
const BOOK_KEY = "tt:book:v1";
const LEDGER_PREFIX = "tt:ledger:";
const LEDGER_INDEX = "tt:ledger:index";
const LEDGER_CAP = 500;

/* §4.5 application limits — smaller than the book's MAX_BODY on purpose: one ticker's
   normalized evidence, not a 40-name document. A larger body is a malformed client, not a
   bigger thesis (the positions.js 64KB precedent, same reasoning, now documented). */
const MAX_SCORE_BODY = 64 * 1024;
const MAX_DECISION_BODY = 16 * 1024;
const SNAP_TTL = 450 * 24 * 3600;      // covers the 365-day evaluation window + delay
const SYM_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/* §4.1: book caps are DEPLOYMENT FACTS recorded as implementation metadata, not
   methodology constants. These mirror functions/api/tt.js MAX_BODY and admin.html DD_MAX;
   smoke pins the three-way agreement, and activation fails on any mismatch. */
const DEPLOYED_CAPS = { dd_max: 100 * 1024, max_body: 300 * 1024 };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

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

/* Compact belief diff to the EXISTING per-symbol ledger — score/tier/version changes only,
   never full input snapshots or decision events (§4.5: a cross-book decision event must not
   consume the ledger's 500-entry budget). Fire-and-forget: a ledger fault must never fail
   the write the user is waiting on (the FEAT-TT-LEDGER rule, mirrored not imported —
   appendLedger is private to tt.js). */
async function appendScoreDiff(env, sym, prev, next) {
  try {
    const changed =
      !prev || prev.scorecard?.raw_score !== next.scorecard?.raw_score ||
      prev.scorecard?.capped_tier !== next.scorecard?.capped_tier ||
      prev.scorecard?.status !== next.scorecard?.status ||
      prev.underwriting_inputs?.thesis_version !== next.underwriting_inputs?.thesis_version;
    if (!changed) return;
    const key = LEDGER_PREFIX + sym;
    const cur = (await kvGet(env, key)) || [];
    cur.unshift({
      t: new Date().toISOString(), v: "score", kind: "score", sym,
      field: "tt_underwriting",
      from: prev ? { score: prev.scorecard?.raw_score ?? null, tier: prev.scorecard?.capped_tier ?? null,
        status: prev.scorecard?.status ?? null } : null,
      to: { score: next.scorecard?.raw_score ?? null, tier: next.scorecard?.capped_tier ?? null,
        status: next.scorecard?.status ?? null,
        mv: next.scorecard?.methodology_version, hash: next.scorecard?.input_hash },
    });
    if (cur.length > LEDGER_CAP) cur.length = LEDGER_CAP;
    await env.PULSE_CACHE.put(key, JSON.stringify(cur));
    const idx = (await kvGet(env, LEDGER_INDEX)) || [];
    if (!idx.includes(sym)) { idx.push(sym); await env.PULSE_CACHE.put(LEDGER_INDEX, JSON.stringify(idx)); }
  } catch (_e) { /* fire-and-forget by contract */ }
}

async function updateIndex(env, sym, rec) {
  const idx = (await kvGet(env, INDEX_KEY)) || { version: 1, entries: {} };
  const sc = rec.scorecard || {};
  idx.entries[sym] = {
    status: sc.status ?? null, raw_score: sc.raw_score ?? null,
    raw_tier: sc.raw_tier ?? null, capped_tier: sc.capped_tier ?? null,
    // PROVISIONAL (v2.4.0): the board summary carries the bootstrap diagnostic so a
    // provisional name can rank — capped at B by construction, never eligible.
    provisional_score: sc.provisional?.score ?? null, provisional_tier: sc.provisional?.tier ?? null,
    actionability: sc.actionability ?? null, route: sc.route ?? null, profile: sc.profile ?? null,
    input_hash: sc.input_hash ?? null, computed_at: sc.computed_at ?? null,
    blockers: (sc.blockers || []).length,
    /* v5.0 §14.8 ACTIVATION — two additive fields the flip needs at BOARD altitude:
       methodology_version: the per-sym GET relabels a stale-methodology card
       LEGACY_UNVERIFIED (line ~140) but the book=1 index path never could — an index entry
       carried a capped_tier with no way to verify what engine minted it, the exact failure
       §14.7 was written to prevent. The entry now self-identifies; the CLIENT compares it
       to the response's top-level current version and refuses eligibility on a mismatch.
       broken_thesis: a kill-flagged falsifier RED (P4) or a BROKEN_THESIS gate FAIL —
       the §14.8 bar's own text deferred this signal "until activation"; the funding
       forced tier may now read it, and only at this server-stamped altitude. */
    methodology_version: sc.methodology_version ?? null,
    broken_thesis: !!((sc.pillars && sc.pillars.falsifier_health && sc.pillars.falsifier_health.broken_thesis) ||
      (sc.gate_results || []).some((g) => g.state === "FAIL" && g.effect && g.effect.kind === "BROKEN_THESIS")),
  };
  await env.PULSE_CACHE.put(INDEX_KEY, JSON.stringify(idx));
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const url = new URL(request.url);

  if (url.searchParams.get("book") === "1") {
    const idx = (await kvGet(env, INDEX_KEY)) || { version: 1, entries: {} };
    return json({ methodology_version: METHODOLOGY_VERSION, route_mapping_version: ROUTE_MAP_VERSION,
      deployed_caps: DEPLOYED_CAPS, index: idx.entries });
  }
  if (url.searchParams.get("decisions") === "1") {
    // Paginated prefix list — a journal, never a truncating fixed-size array (§4.5).
    const cursor = url.searchParams.get("cursor") || undefined;
    let list;
    try { list = await env.PULSE_CACHE.list({ prefix: DECISION_PREFIX, limit: 50, cursor }); }
    catch (_e) { return json({ error: "list failed" }, 503); }
    const events = [];
    for (const k of list.keys) { const v = await kvGet(env, k.name); if (v) events.push(v); }
    return json({ events, cursor: list.list_complete ? null : list.cursor });
  }
  const sym = url.searchParams.get("sym");
  if (!sym || !SYM_RE.test(sym)) return json({ error: "sym required" }, 400);
  const rec = await kvGet(env, SCORE_PREFIX + sym);
  if (!rec) return json({ sym, record: null, methodology_version: METHODOLOGY_VERSION });
  if (rec.scorecard && rec.scorecard.methodology_version !== METHODOLOGY_VERSION)
    rec.scorecard.status = "LEGACY_UNVERIFIED";      // visible but ineligible (§4.3)
  return json({ sym, record: rec });
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
  if (raw.length > MAX_SCORE_BODY)
    return json({ error: "oversize", key: SCORE_PREFIX + sym, bytes: raw.length, limit: MAX_SCORE_BODY }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const ui = body && body.underwriting_inputs;
  if (!ui || typeof ui !== "object") return json({ error: "underwriting_inputs required" }, 400);
  if (ui.methodology_version !== METHODOLOGY_VERSION)
    return json({ error: "SCORE_VERSION_MISMATCH", expected: METHODOLOGY_VERSION, got: ui.methodology_version || null }, 409);

  // Two-device safety: If-Match against the CURRENT record's input hash (§13). "*" or
  // absent on a fresh record creates; absent on an existing record conflicts.
  const prev = await kvGet(env, SCORE_PREFIX + sym);
  const ifMatch = request.headers.get("If-Match");
  if (prev && ifMatch !== "*" && ifMatch !== (prev.scorecard && prev.scorecard.input_hash))
    return json({ error: "SCORE_VERSION_MISMATCH", server: prev }, 409);

  // Route/lens come from the BOOK (server-derived; a client-supplied route is ignored, §4.4).
  const book = await kvGet(env, BOOK_KEY);
  const entry = book && Array.isArray(book.book) ? book.book.find((x) => x && x.sym === sym) : null;
  if (!entry) return json({ error: "sym not in book — score records exist only for tracked names" }, 404);
  const lens = entry.lens || null;
  if (routeFor(lens).route === "UNMAPPED")
    return json({ error: "UNMAPPED lens \"" + (lens || "") + "\" — fix the stored lens via the normal book workflow" }, 422);

  /* v3.75 follow-up: the thesis payload no longer lives on the book entry (FEAT-TT-DDSTORE),
     so P1's whole valuation input — pt_model, consensus, ref_px — has to come from the payload
     store. Read through readDeepDive, the ONE server-side resolution point, which still falls
     back to an embedded payload for a pre-migration book. Reading entry.deepDive here after the
     migration silently produced an empty dd and therefore no valuation at all. */
  const dd = (await readDeepDive(env, sym, book)) || {};

  /* SERVER-VERIFIED PRE-COMMITMENT (v3.77). §6.4.1's whole point is that a falsifier set must
     be on file BEFORE the observation it is graded against. The engine used to check that by
     comparing two fields of the SAME request, so a set written today and stamped yesterday
     scored 10/10 — the failure mode the methodology was built to prevent, reachable by an
     honest client with a wrong clock as easily as a careless one. The server holds the prior
     record, so it can answer the question properly: which conditions were already on file?
     A fingerprint (not just the date) means EDITING a condition re-opens the commitment. */
  const committed = {};
  for (const h of (prev && prev.underwriting_inputs && prev.underwriting_inputs.falsifiers) || [])
    if (h && h.id) committed[h.id] = commitFingerprint(h);

  // Server-authoritative compute. Client-supplied scorecard fields are IGNORED entirely;
  // a recovery client's divergent copy surfaces as the 409 above, never a silent accept.
  let card;
  try {
    card = await buildScorecard({
      sym, lens, underwriting_inputs: ui, dd,
      price: ui.price || (dd && dd.ref_px) || null,
      horizon: ui.horizon || null, nowMs: Date.now(), committed,
    });
  } catch (e) {
    // A scorer exception fails the affected ticker CLOSED with a structured error — it must
    // not white-screen or discard anything (scoring storage is separate by design).
    return json({ error: "scorer exception", detail: String(e && e.message || e) }, 500);
  }
  card.deployed_caps = DEPLOYED_CAPS;

  const rec = { sym, updated_at: new Date().toISOString(), underwriting_inputs: ui, scorecard: card };
  const serialized = JSON.stringify(rec);
  if (serialized.length > MAX_SCORE_BODY)
    return json({ error: "oversize", key: SCORE_PREFIX + sym, bytes: serialized.length, limit: MAX_SCORE_BODY }, 400);
  try {
    await env.PULSE_CACHE.put(SCORE_PREFIX + sym, serialized);
    await env.PULSE_CACHE.put(SNAP_PREFIX + sym + ":" + card.input_hash, serialized, { expirationTtl: SNAP_TTL });
    await updateIndex(env, sym, rec);
  } catch (e) {
    return json({ error: "storage write failed: " + String(e && e.message || e) }, 503);
  }
  await appendScoreDiff(env, sym, prev, rec);
  return json({ sym, record: rec });      // the normalized server result, always (§13)
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  if (url.searchParams.get("decision") !== "1") return json({ error: "unknown action" }, 400);

  const raw = await request.text();
  if (raw.length > MAX_DECISION_BODY)
    return json({ error: "oversize", key: DECISION_PREFIX + "*", bytes: raw.length, limit: MAX_DECISION_BODY }, 400);
  let ev;
  try { ev = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  if (ev.event !== "ELIGIBLE_SET_CHANGED") return json({ error: "event must be ELIGIBLE_SET_CHANGED" }, 400);
  if (!ev.selected || !SYM_RE.test(String(ev.selected.sym || ""))) return json({ error: "selected.sym required" }, 400);

  /* The CLIENT computes the eligible set (it alone holds quotes+positions+regime at one
     instant); the SERVER stamps time and VERIFIES every named scorecard hash against the
     stored records. A mismatch means a stale client — reject, never silently rewrite. */
  const hashes = ev.scorecard_hashes || {};
  for (const [s, h] of Object.entries(hashes)) {
    if (!SYM_RE.test(s)) return json({ error: "bad sym in scorecard_hashes: " + s }, 400);
    const rec = await kvGet(env, SCORE_PREFIX + s);
    if (!rec || !rec.scorecard || rec.scorecard.input_hash !== h)
      return json({ error: "STALE_SCORECARD_HASH", sym: s }, 409);
  }
  const at = new Date().toISOString();                       // server-stamped, never client time
  const id = Math.random().toString(36).slice(2, 10);
  const stored = { ...ev, at, methodology_version: METHODOLOGY_VERSION };
  try {
    await env.PULSE_CACHE.put(DECISION_PREFIX + at + ":" + id, JSON.stringify(stored), { expirationTtl: SNAP_TTL });
  } catch (e) { return json({ error: "storage write failed: " + String(e && e.message || e) }, 503); }
  return json({ stored: true, at, id });
}

export async function onRequest({ request, ...rest }) {
  const m = request.method.toUpperCase();
  if (m === "GET") return onRequestGet({ request, ...rest });
  if (m === "PUT") return onRequestPut({ request, ...rest });
  if (m === "POST") return onRequestPost({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
