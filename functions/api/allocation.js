// FEAT-TT-ALLOC (v3.100): /api/allocation — the server-authoritative allocation evaluator.
//
// Answers, with a persisted receipt: "if this is the best ELIGIBLE buy, what should fund it,
// and what portfolio context could invalidate the recommendation?" The pure math lives in
// functions/lib/tt-alloc.js (Node-importable, smoke-run); this file is transport + storage.
//
// AUTHORITY: the browser never submits a client-computed eligible set — every input is
// loaded server-side (book+board, tt:pos:v1, tt:dd:index:v1, tt:quote:*, /readout.json).
// RECOMMENDATION-ONLY: confirmation persists INTENT, never places an order; no broker API
// is referenced anywhere in this repo (smoke pins the absence).
//
// VERBS (the v3.54 rule — GET must be safe):
//   GET             → the stored current receipt, or 404. NEVER evaluates.
//   GET ?intents=1  → the paginated intent journal (read-only).
//   POST            → evaluate + persist: history key FIRST, current pointer second (the
//                     ticker-analysis order, so a pointer can never exist without its
//                     immutable copy). Returns the complete receipt in the body.
//   POST ?confirm=1 → {intent:{action:"FUND"|"TRIM", sym, note?, amount_usd?,
//                     options_sleeve?}, result_hash, supersede?}
//                     — verifies the hash against the stored receipt; binds the intent to the
//                     receipt's own candidate (FUND: state ALLOCATABLE + the eligible sym;
//                     TRIM: a funding-ranking row, options sleeves only when explicitly
//                     flagged); re-derives the BASIS from current KV naming any drifted
//                     input; a FUND additionally re-fetches the readout and re-binds the
//                     macro axis (day, actionability, flip, body hash) plus the structured
//                     circuit; 409 STALE_ALLOCATION on drift, 409 ALREADY_CONFIRMED on a
//                     second confirm without supersede:true; then persists an immutable
//                     intent record. amount_usd is owner-supplied or absent — never
//                     invented (review resolution #7).
//
// HASHES (documented because two would otherwise read as one):
//   input_hash  — full inputs incl. per-quote stamps. The audit identity: what exactly fed
//                 this evaluation.
//   basis_hash  — versioned context only (book_version · positions_snap · dd_index_asOf ·
//                 readout as_of · ALLOC_RULE_VERSION). CONFIRM CHECKS THIS ONE: the quote
//                 cache turns over every 2 minutes, and a price tick is not a context change
//                 in a recommendation-only layer — binding confirm to input_hash would 409
//                 every confirmation that took longer than a quote TTL to tap.
//   result_hash — the evaluation output; names the history key.
import { authorize, crossOrigin } from "./tt.js";
import { sha256Hex } from "../lib/tt-v2.js";
import { evaluateAllocation, ALLOC_RULE_VERSION, circuitState } from "../lib/tt-alloc.js";
import { etYmd } from "../../src/sources.js";

const CUR_KEY = "tt:alloc:v1";
const HIST_PREFIX = "tt:alloc:history:";
const INTENT_PREFIX = "tt:alloc:intent:v1:";
const INTENT_TTL = 450 * 24 * 3600;          // the decision-journal retention (score.js)
const BOOK_KEY = "tt:book:v1";
const POS_KEY = "tt:pos:v1";
const DD_INDEX = "tt:dd:index:v1";
const QUOTE_PREFIX = "tt:quote:";
/* Deliberately 64KB like positions.js, NOT the book's 300KB: a confirm body carries one
   intent and one hash; an evaluate body carries nothing at all. Anything larger is a
   malformed caller, not a legitimate request. */
const MAX_BODY = 64 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function kvGet(env, key) {
  try { return await env.PULSE_CACHE.get(key, "json"); } catch (_e) { return null; }
}

/* The ticker-analysis sourceReadout pattern: the readout is fetched from THIS deployment so
   the evaluator and the pill read the same document; a client-supplied readout is accepted
   only under the local-dev bypass. Fail-closed: unreachable → null → the gate ladder vetoes
   with the reason named, never a default-to-clear. */
async function sourceReadout(request, devFallback, env) {
  try {
    const r = await fetch(new URL("/readout.json", request.url), {
      headers: { accept: "application/json" }, cf: { cacheTtl: 0 },
    });
    if (r.ok) return await r.json();
  } catch (_e) { /* fall through */ }
  if (env.ACCESS_DEV_BYPASS === "1" && devFallback && typeof devFallback === "object") return devFallback;
  return null;
}

async function loadQuotes(env, syms) {
  const out = {};
  // Bounded fan-out, batch of 6 — the same shape the ledger's px stamp reads.
  for (let i = 0; i < syms.length; i += 6) {
    const batch = syms.slice(i, i + 6);
    const got = await Promise.all(batch.map((s) => kvGet(env, QUOTE_PREFIX + s)));
    got.forEach((q, j) => { if (q && isFinite(q.px)) out[batch[j]] = q; });
  }
  return out;
}

function basisOf(result) {
  return {
    book_version: result.inputs.book_version,
    positions_snap: result.inputs.positions_snap,
    dd_index_asOf: result.inputs.dd_index_asOf,
    readout_as_of: result.inputs.readout_as_of,
    rule_version: ALLOC_RULE_VERSION,
  };
}

async function evaluate(env, request, devReadout) {
  const [book, posDoc, ddIndex] = await Promise.all([
    kvGet(env, BOOK_KEY), kvGet(env, POS_KEY), kvGet(env, DD_INDEX)]);
  if (!book || !Array.isArray(book.book)) return { error: json({ error: "no book found — nothing to allocate against" }, 409) };
  const readout = await sourceReadout(request, devReadout, env);
  const syms = book.book.map((e) => e.sym);
  const quotes = await loadQuotes(env, syms);
  const now = new Date();
  const result = evaluateAllocation({ book, ddIndex, posDoc, quotes, readout, now });
  /* v4.1 Step 6: readout_as_of is a DAY key, so basis_hash alone froze the entire macro axis
     intraday — a readout that rebuilt (actionability moved, flip tripped) between evaluate and
     confirm passed the basis check. The receipt now records the hash of the readout BODY it
     evaluated against; confirm re-fetches and compares. Deliberately NOT in basis_hash: the
     quote-tick rule's shape — binding semantics live at confirm, where the reason can be named. */
  result.inputs.readout_hash = readout ? await sha256Hex(readout) : null;
  const quoteStamps = {};
  for (const [s, q] of Object.entries(quotes)) quoteStamps[s] = q.at || null;
  const input_hash = await sha256Hex({ ...basisOf(result), quotes: quoteStamps });
  const basis_hash = await sha256Hex(basisOf(result));
  const result_hash = await sha256Hex(result);
  /* v4.1 Step 3: the receipt names its own ET identity. The client used to slice the UTC
     instant to a date — a 01:07Z receipt (21:07 ET the prior business evening) read "today"
     (8/18 audit, P1). at_et is human-readable ET; business_date_et is the ET calendar date
     via the same etYmd clock every other time-judge in this stack uses. */
  const at_et = now.toLocaleString("en-US", { timeZone: "America/New_York",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "") + " ET";
  return { receipt: {
    schema: "tt-alloc-receipt-v1",
    at: now.toISOString(),                      // server-stamped, never client
    at_et,
    business_date_et: etYmd(now),
    ...result,
    attestation: { input_hash, basis_hash, result_hash, rule_version: ALLOC_RULE_VERSION },
    confirmation: null,
  } };
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get("intents") === "1") {
    try {
      const cursor = url.searchParams.get("cursor") || undefined;
      const l = await env.PULSE_CACHE.list({ prefix: INTENT_PREFIX, limit: 50, cursor });
      const intents = [];
      for (const k of l.keys) { const v = await kvGet(env, k.name); if (v) intents.push(v); }
      return json({ intents, cursor: l.list_complete ? null : l.cursor });
    } catch (e) { return json({ error: "list failed: " + (e?.message || "unknown") }, 503); }
  }
  const cur = await kvGet(env, CUR_KEY);
  if (!cur) return json({ error: "no allocation receipt stored — POST to evaluate", receipt: null }, 404);
  return json({ receipt: cur });
}

async function handleConfirm(env, request, body) {
  const intent = body && body.intent;
  if (!intent || typeof intent !== "object") return json({ error: "intent required" }, 400);
  if (!["FUND", "TRIM"].includes(String(intent.action))) return json({ error: "intent.action must be FUND|TRIM" }, 400);
  if (typeof intent.sym !== "string" || !/^[A-Z.\-]{1,8}$/.test(intent.sym)) return json({ error: "intent.sym required" }, 400);
  if (intent.amount_usd !== undefined) {
    const a = Number(intent.amount_usd);
    if (!isFinite(a) || a <= 0 || a > 1e9) return json({ error: "intent.amount_usd must be a positive dollar amount (owner-supplied, never invented)" }, 400);
  }
  const rh = body && body.result_hash;
  if (typeof rh !== "string" || !rh) return json({ error: "result_hash required — confirm binds to a specific receipt" }, 400);
  const cur = await kvGet(env, CUR_KEY);
  if (!cur) return json({ error: "no allocation receipt stored — evaluate first" }, 409);
  if (cur.attestation.result_hash !== rh)
    return json({ error: "STALE_ALLOCATION", reason: "the stored receipt is not the one you confirmed — re-read it", receipt: cur }, 409);
  /* v4.1 Step 6 — idempotency: a second confirm used to silently overwrite cur.confirmation
     and journal a second intent. Intents are immutable; superseding one is an explicit act. */
  if (cur.confirmation && body.supersede !== true)
    return json({ error: "ALREADY_CONFIRMED",
      reason: `this receipt was confirmed ${cur.confirmation.at} (${cur.confirmation.action} ${cur.confirmation.sym}) — intents are immutable; pass supersede:true to record a superseding one`,
      receipt: cur }, 409);
  /* v4.1 Step 6 — the intent must name the receipt's own candidate. A WAIT/NONE receipt has
     no candidate to confirm; a FUND naming any sym but the eligible one is a free choice the
     receipt never evaluated; a TRIM must name a row the funding ranking actually holds. */
  if (intent.action === "FUND") {
    if (cur.state !== "ALLOCATABLE")
      return json({ error: "INTENT_MISMATCH",
        reason: `receipt state is ${cur.state} — only an ALLOCATABLE receipt can take a FUND confirmation${cur.gate ? ` (gate: ${cur.gate.reason})` : ""}`,
        receipt: cur }, 409);
    if (!cur.eligible || cur.eligible.sym !== intent.sym)
      return json({ error: "INTENT_MISMATCH",
        reason: `FUND names ${intent.sym} but the receipt's eligible candidate is ${cur.eligible ? cur.eligible.sym : "none"} — confirmation binds to the evaluated candidate, never a substitute`,
        receipt: cur }, 409);
  } else {
    const f = cur.funding || {};
    const inRows = (Array.isArray(f.rows) ? f.rows : []).some((r) => r && r.sym === intent.sym);
    const inOpt = (Array.isArray(f.optOnly) ? f.optOnly : []).some((o) => o && o.sym === intent.sym);
    if (!inRows && !inOpt)
      return json({ error: "INTENT_MISMATCH",
        reason: `TRIM names ${intent.sym}, which is not in the receipt's funding ranking — an unranked name cannot take a trim intent from this receipt`,
        receipt: cur }, 409);
    if (!inRows && inOpt && intent.options_sleeve !== true)
      return json({ error: "INTENT_MISMATCH",
        reason: `${intent.sym} is an options-only sleeve in this receipt — legs are not shares (v3.44); pass options_sleeve:true to record a sleeve trim explicitly`,
        receipt: cur }, 409);
  }
  // Re-derive the BASIS from current KV: a book edit, a fresh sync (new snap), an index
  // rebuild or a rule change between evaluate and confirm invalidates the receipt.
  // v4.1 Step 6: the changed input is NAMED — "something changed" sends you hunting.
  const [book, posDoc, ddIndex] = await Promise.all([
    kvGet(env, BOOK_KEY), kvGet(env, POS_KEY), kvGet(env, DD_INDEX)]);
  const liveBasis = {
    book_version: (book && book.version) || null,
    positions_snap: (posDoc && posDoc.snap) || null,
    dd_index_asOf: (ddIndex && ddIndex.asOf) || null,
    readout_as_of: cur.inputs.readout_as_of,   // day key held here; the body re-check is below
    rule_version: ALLOC_RULE_VERSION,
  };
  const drift =
    liveBasis.book_version !== cur.inputs.book_version ? `the book changed since this was evaluated (version ${cur.inputs.book_version} → ${liveBasis.book_version})` :
    liveBasis.positions_snap !== cur.inputs.positions_snap ? "positions changed since this was evaluated — a fresh sync landed a new snapshot" :
    liveBasis.dd_index_asOf !== cur.inputs.dd_index_asOf ? "the dd index changed since this was evaluated — the working set was rebuilt" :
    liveBasis.rule_version !== cur.attestation.rule_version ? `the allocation rule changed since this was evaluated (${cur.attestation.rule_version} → ${ALLOC_RULE_VERSION})` : null;
  if (drift)
    return json({ error: "STALE_ALLOCATION", reason: drift + " — recompute before confirming", receipt: cur }, 409);
  const liveHash = await sha256Hex(liveBasis);
  if (liveHash !== cur.attestation.basis_hash)
    return json({ error: "STALE_ALLOCATION", reason: "context changed since this was evaluated — recompute before confirming", receipt: cur }, 409);
  /* v4.1 Step 6 — the macro axis unfroze: readout_as_of is a DAY key, so the old basis check
     held an entire ET day's worth of readout rebuilds invisible to confirm. A FUND re-fetches
     the readout NOW and re-binds: unreachable fails closed (the gate-ladder rule — an
     unreadable crash circuit vetoes, never defaults to clear); a rolled day, a moved
     actionability, a tripped/blind flip, or ANY body change (the hash catch-all) each 409
     with the input named. TRIM is deliberately exempt from the readout re-bind: the funding
     ranking derives from book + positions, never the readout, and a deleverage intent must
     not be blocked by the very stress that makes it urgent (the v3.40 asymmetry). */
  if (intent.action === "FUND") {
    const readout = await sourceReadout(request, body && body.readout, env);
    if (!readout)
      return json({ error: "STALE_ALLOCATION", reason: "readout unreadable at confirm time — an unreadable crash circuit vetoes rather than defaulting to clear; retry or recompute", receipt: cur }, 409);
    if (((readout.as_of || null)) !== cur.inputs.readout_as_of)
      return json({ error: "STALE_ALLOCATION", reason: `the readout day rolled since this was evaluated (${cur.inputs.readout_as_of} → ${readout.as_of || "undated"}) — recompute before confirming`, receipt: cur }, 409);
    const reg = readout.regime || {};
    if (reg.actionability !== "FULL")
      return json({ error: "STALE_ALLOCATION", reason: `regime actionability is now ${reg.actionability || "unavailable"}${reg.status ? ` (${reg.status})` : ""} — the evidence axis moved since this was evaluated`, receipt: cur }, 409);
    const mf = readout.macro_flip;
    if (!mf || mf.evaluable === false || mf.tripped)
      return json({ error: "STALE_ALLOCATION", reason: !mf ? "the readout no longer carries a Macro Flip block — the crash circuit cannot be read" : mf.tripped ? "Macro Flip TRIPPED since this was evaluated — de-risk, no adds" : (mf.reason || "Macro Flip went BLIND since this was evaluated"), receipt: cur }, 409);
    if (!cur.inputs.readout_hash)
      return json({ error: "STALE_ALLOCATION", reason: "this receipt predates confirm-time readout binding — recompute for a bindable one", receipt: cur }, 409);
    if ((await sha256Hex(readout)) !== cur.inputs.readout_hash)
      return json({ error: "STALE_ALLOCATION", reason: "the readout rebuilt since this was evaluated (same day, different body) — recompute before confirming", receipt: cur }, 409);
    /* The circuit re-resolves from the CLOCK, not just the book: a clear circuit ages past
       CIRCUIT_STALE_D into unresolved with no book edit, so book_version cannot catch it. */
    const csNow = circuitState(book && book.board && book.board.circuit, new Date());
    if (csNow.st === "tripped" || csNow.st === "unresolved")
      return json({ error: "STALE_ALLOCATION", reason: `the leverage circuit now reads ${csNow.st.toUpperCase()}${csNow.reason ? ` — ${csNow.reason}` : ""}`, receipt: cur }, 409);
  }
  const at = new Date().toISOString();
  const id = Math.random().toString(36).slice(2, 10);
  const rec = { schema: "tt-alloc-intent-v1", at, id,
    intent: { action: intent.action, sym: intent.sym,
      note: typeof intent.note === "string" ? intent.note.slice(0, 500) : undefined,
      amount_usd: intent.amount_usd !== undefined ? Number(intent.amount_usd) : undefined,
      options_sleeve: intent.options_sleeve === true ? true : undefined },
    supersedes: (cur.confirmation && body.supersede === true) ? cur.confirmation.id : undefined,
    result_hash: rh, basis_hash: cur.attestation.basis_hash, rule_version: ALLOC_RULE_VERSION };
  try {
    // The journal record is append-only — a supersede writes a NEW key; nothing is edited.
    await env.PULSE_CACHE.put(INTENT_PREFIX + at + ":" + id, JSON.stringify(rec), { expirationTtl: INTENT_TTL });
    const confirmed = { ...cur, confirmation: { at, id, action: intent.action, sym: intent.sym,
      supersedes: rec.supersedes } };
    await env.PULSE_CACHE.put(CUR_KEY, JSON.stringify(confirmed));
    return json({ stored: true, at, id, receipt: confirmed });
  } catch (e) { return json({ error: "storage write failed: " + (e?.message || "unknown") }, 503); }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "oversize", key: CUR_KEY, bytes: raw.length, limit: MAX_BODY }, 400);
  let body = null;
  if (raw) { try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); } }

  if (url.searchParams.get("confirm") === "1") return handleConfirm(env, request, body);

  const r = await evaluate(env, request, body && body.readout);
  if (r.error) return r.error;
  const receipt = r.receipt;
  try {
    // History FIRST, pointer second — a pointer must never exist without its immutable copy.
    const stamp = receipt.at.replace(/[^0-9]/g, "");
    await env.PULSE_CACHE.put(HIST_PREFIX + stamp + ":" + receipt.attestation.result_hash.slice(0, 10),
      JSON.stringify(receipt));
    await env.PULSE_CACHE.put(CUR_KEY, JSON.stringify(receipt));
  } catch (e) { return json({ error: "storage write failed: " + (e?.message || "unknown") }, 503); }
  return json({ receipt });
}

export async function onRequest({ request, ...rest }) {
  const m = request.method.toUpperCase();
  if (m === "GET") return onRequestGet({ request, ...rest });
  if (m === "POST") return onRequestPost({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
