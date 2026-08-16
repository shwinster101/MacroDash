// FEAT-TT-V2: reviewed licensed street inputs, stored outside the replace-all book.
// Screenshots and OCR drafts never reach this route; only a confirmed typed packet does.

import { authorize, crossOrigin } from "./tt.js";
import { sha256Hex, stableStringify, validateStreetPacket } from "../lib/tt-v2.js";

const KEY_PREFIX = "tt:street:";
const HISTORY_PREFIX = "tt:street:history:";
const ANALYSIS_PREFIX = "tt:analysis:";
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
  const { storedAt: _storedAt, version: _version, ...packet } = value;
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
      if (rec?.schema === "tt-street-v1") records[sym] = rec;
      else if (rec?.schema === "tt-street-tombstone-v1") records[sym] = rec;
    } catch (_e) { /* named in missing below */ }
  }));
  const active = {}, voided = {};
  for (const [sym, rec] of Object.entries(records)) {
    if (rec.schema === "tt-street-v1") active[sym] = rec;
    else voided[sym] = rec;
  }
  return json({ records: active, voided, missing: syms.filter((s) => !active[s] && !voided[s]) });
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

export async function onRequestDelete({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return authError(auth);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const sym = String(new URL(request.url).searchParams.get("sym") || "").trim().toUpperCase();
  if (!SYMBOL_RE.test(sym)) return json({ error: "valid sym is required" }, 400);
  const expected = String(request.headers.get("if-match") || "").replace(/^W\//, "").replace(/^"|"$/g, "");
  if (!expected) return json({ error: "If-Match current street version is required" }, 428);
  const raw = await request.text();
  if (raw.length > 2048) return json({ error: "payload too large" }, 413);
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const reason = String(body.reason || "").trim();
  if (!reason || reason.length > 500) return json({ error: "reason must be 1–500 characters" }, 400);

  let current;
  try { current = await env.PULSE_CACHE.get(keyFor(sym), "json"); }
  catch (e) { return json({ error: `street read failed: ${e?.message || "unknown"}` }, 503); }
  if (!current || current.schema !== "tt-street-v1") return json({ error: "active street packet not found" }, 404);
  if (current.version !== expected) return json({ error: "street packet changed; reload before voiding", currentVersion: current.version }, 412);
  const voidedAt = new Date().toISOString();
  const tombstone = {
    schema: "tt-street-tombstone-v1", symbol: sym, status: "VOID", voidedAt,
    voidedVersion: current.version, reason,
  };
  const history = {
    schema: "tt-street-retraction-v1", symbol: sym, storedAt: voidedAt,
    previousVersion: current.version, reason, tombstone,
  };
  const analysisTombstone = {
    schema: "tt-analysis-tombstone-v1", symbol: sym, status: "VOID", voidedAt,
    streetVersion: current.version, reason,
  };
  const stamp = voidedAt.replace(/[^0-9]/g, "");
  try {
    await env.PULSE_CACHE.put(`${HISTORY_PREFIX}${sym}:${stamp}:void`, JSON.stringify(history));
    await env.PULSE_CACHE.put(keyFor(sym), JSON.stringify(tombstone));
    await env.PULSE_CACHE.put(`${ANALYSIS_PREFIX}${sym}:v1`, JSON.stringify(analysisTombstone));
  } catch (e) {
    return json({ error: `street retraction failed: ${e?.message || "unknown"}` }, 503);
  }
  return json({ symbol: sym, voided: tombstone });
}
