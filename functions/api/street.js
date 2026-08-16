// FEAT-TT-V2: reviewed licensed street inputs, stored outside the replace-all book.
// Screenshots and OCR drafts never reach this route; only a confirmed typed packet does.

import { authorize, crossOrigin } from "./tt.js";
import { sha256Hex, stableStringify, validateStreetPacket } from "../lib/tt-v2.js";

const KEY_PREFIX = "tt:street:";
const HISTORY_PREFIX = "tt:street:history:";
const MAX_BODY = 96 * 1024;
const MAX_SYMS = 40;
const SYMBOL_RE = /^[A-Z.\-]{1,8}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

const keyFor = (sym) => `${KEY_PREFIX}${sym}:v1`;

function authError(auth) {
  return json({ error: auth.error || "unauthorized" }, auth.status || 401);
}

function flatten(value, prefix = "", out = {}) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = value;
  return out;
}

function revisionPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  // `storedAt` and `version` describe the KV envelope, not the owner's reviewed evidence.
  // Comparing them to a normalized incoming packet made every identical re-submit look like
  // a revision because those envelope fields are intentionally absent from the request.
  // v3.91: `lastEstRevision` is DERIVED metadata stamped by the server (audit #6) — same
  // class, same rule, or every identical re-submit after an estimate revision loops forever.
  const { storedAt: _storedAt, version: _version, lastEstRevision: _rev, ...packet } = value;
  return packet;
}

export function streetRevision(previous, next) {
  const a = flatten(revisionPayload(previous) || {}), b = flatten(revisionPayload(next) || {});
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter((path) =>
    stableStringify(a[path]) !== stableStringify(b[path])).map((path) => ({
      path,
      from: a[path] === undefined ? null : a[path],
      to: b[path] === undefined ? null : b[path],
    }));
}

/* v3.91 (audit #6): the direction of an ESTIMATE revision, derived from the revision's own
   change list — this is what feeds the CRDO divergence flag now that estimate intake moves
   through street packets instead of hand-typed consensus (the ledger's `est` entries only
   ever saw the legacy path, so the flag was going progressively blind as intake migrated).
   Only numeric eps/revenue moves count; mixed directions are NOT a signal ("up" must mean
   the revision as a whole raised the estimates). Pure + exported for smoke. */
export function estRevisionDir(changes) {
  let up = 0, down = 0;
  for (const c of Array.isArray(changes) ? changes : []) {
    if (!/\b(eps|revenue)\b/i.test(String(c.path || ""))) continue;
    const from = Number(c.from), to = Number(c.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) continue;
    if (to > from) up++; else down++;
  }
  if (!up && !down) return null;
  if (up && down) return "mixed";
  return up ? "up" : "down";
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return authError(auth);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const url = new URL(request.url);
  const one = String(url.searchParams.get("sym") || "").trim().toUpperCase();

  if (url.searchParams.get("history") === "1") {
    if (!SYMBOL_RE.test(one)) return json({ error: "valid sym is required for history" }, 400);
    try {
      const list = await env.PULSE_CACHE.list({ prefix: `${HISTORY_PREFIX}${one}:`, limit: 100 });
      const records = await Promise.all(list.keys.map((k) => env.PULSE_CACHE.get(k.name, "json")));
      return json({ symbol: one, history: records.filter(Boolean).sort((a, b) => String(b.storedAt).localeCompare(String(a.storedAt))) });
    } catch (e) {
      return json({ error: `history read failed: ${e?.message || "unknown"}` }, 503);
    }
  }

  const raw = one || url.searchParams.get("syms") || "";
  const syms = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)))].slice(0, MAX_SYMS);
  if (!syms.length) return json({ records: {} });
  const records = {};
  await Promise.all(syms.map(async (sym) => {
    try {
      const rec = await env.PULSE_CACHE.get(keyFor(sym), "json");
      if (rec) records[sym] = rec;
    } catch (_e) { /* named in missing below */ }
  }));
  return json({ records, missing: syms.filter((s) => !records[s]) });
}

export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return authError(auth);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return json({ error: "payload too large" }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const checked = validateStreetPacket(body);
  if (!checked.ok) return json({ error: "invalid street packet", details: checked.errors }, 400);

  const record = checked.value;
  let previous = null;
  try { previous = await env.PULSE_CACHE.get(keyFor(record.symbol), "json"); } catch (_e) {}
  const changes = streetRevision(previous, record);
  if (previous && !changes.length) return json({ record: previous, unchanged: true, changes: [] });
  const storedAt = new Date().toISOString();
  const version = await sha256Hex(record);
  const stored = { ...record, storedAt, version };
  /* v3.91 (audit #6): stamp the estimate-revision direction + the price at revision time on
     the CURRENT record, so the client's divergence flag can read street-based revisions
     without an N-fetch history walk. px rides the same tt:quote cache the belief ledger
     already stamps from — best-effort, null when cold, never fabricated. Carried forward
     from the previous record when THIS revision touched no estimates (a target-only update
     must not erase the last real estimate move). */
  const dir = estRevisionDir(changes);
  if (dir) {
    let px = null;
    try { const q = await env.PULSE_CACHE.get(`tt:quote:${record.symbol}`, "json"); if (q && isFinite(q.px)) px = q.px; } catch (_e) {}
    stored.lastEstRevision = { at: storedAt, dir, px };
  } else if (previous?.lastEstRevision) stored.lastEstRevision = previous.lastEstRevision;
  const revision = {
    schema: "tt-street-revision-v1",
    symbol: record.symbol,
    storedAt,
    version,
    previousVersion: previous?.version || null,
    changes,
    record: stored,
  };
  const stamp = storedAt.replace(/[^0-9]/g, "");
  try {
    // Write history first: a current record must never point at a revision that failed to persist.
    await env.PULSE_CACHE.put(`${HISTORY_PREFIX}${record.symbol}:${stamp}:${version.slice(0, 10)}`, JSON.stringify(revision));
    await env.PULSE_CACHE.put(keyFor(record.symbol), JSON.stringify(stored));
  } catch (e) {
    return json({ error: `street write failed: ${e?.message || "unknown"}` }, 503);
  }
  return json({ record: stored, changes }, previous ? 200 : 201);
}

/* v3.91 (audit #8): the TOMBSTONE — merge-only + immutable history had no retraction path
   for a wrongly-CONFIRMED packet (bad OCR, confirmed anyway). Voiding APPENDS an audited
   tombstone to the history (nothing is ever deleted) and removes the CURRENT record, so
   every downstream gate honestly reads "confirmed street packet is unavailable" → WAIT
   until a corrected packet is re-confirmed. A reason is REQUIRED — an unexplained void is
   the same defect as an unexplained number. Version must match the current record: voiding
   blind, or voiding a record another device already superseded, is refused with the
   server's copy named (the If-Match spirit). */
export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return authError(auth);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  if (url.searchParams.get("void") !== "1") return json({ error: "unknown action — POST supports ?void=1" }, 405);
  let body;
  try { body = JSON.parse(await request.text()); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const sym = String(body.symbol || "").trim().toUpperCase();
  const reason = String(body.reason || "").trim();
  const version = String(body.version || "").trim();
  if (!SYMBOL_RE.test(sym)) return json({ error: "valid symbol is required" }, 400);
  if (!reason) return json({ error: "a reason is required — an unexplained void is an unexplained number" }, 400);
  if (!version) return json({ error: "the version being voided is required" }, 400);
  let current = null;
  try { current = await env.PULSE_CACHE.get(keyFor(sym), "json"); } catch (_e) {}
  if (!current) return json({ error: "no current street record to void" }, 404);
  if (current.version !== version)
    return json({ error: "version mismatch — the current record is not the one being voided", current: { version: current.version, storedAt: current.storedAt } }, 409);
  const voidedAt = new Date().toISOString();
  const tomb = { schema: "tt-street-tombstone-v1", symbol: sym, voidedVersion: version,
    voidedAt, reason, record: current };
  const stamp = voidedAt.replace(/[^0-9]/g, "");
  try {
    // Tombstone lands in history FIRST — the void must be auditable before it takes effect.
    await env.PULSE_CACHE.put(`${HISTORY_PREFIX}${sym}:${stamp}:void-${version.slice(0, 10)}`, JSON.stringify(tomb));
    await env.PULSE_CACHE.delete(keyFor(sym));
  } catch (e) {
    return json({ error: `void failed: ${e?.message || "unknown"}` }, 503);
  }
  return json({ voided: true, symbol: sym, voidedVersion: version, voidedAt, reason });
}
