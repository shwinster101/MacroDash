// FEAT-TT-FRAMEWORK (v3.26) — the TT methodology document, stored PRIVATELY.
//
// WHY A SEPARATE KEY: the framework is ~20KB and the book already runs ~55KB, so the two
// cannot share the 64KB book payload. More importantly they have different lifecycles —
// the book changes daily, the framework changes on doctrine revisions.
//
// WHY NOT THE REPO: shwinster101/MacroDash is PUBLIC. This document is the owner's entire
// methodology — every gate, threshold, R/R floor, position cap and tax route. It lives in
// KV behind the PIN for exactly the reason CANONICAL_BOOK does: committing it would
// publish it permanently and irreversibly. Same invariant, same enforcement.
//
// AUTH: shares /api/tt's gate. Read and write both require the PIN — unlike prices, this
// content IS secret.
import { authorize } from "./tt.js";

const KEY = "tt:framework:v1";
const MAX = 128 * 1024;   // generous vs the ~20KB document; still a hard stop on runaway writes

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  try {
    const rec = await env.PULSE_CACHE.get(KEY, "json");
    // Absent is a normal empty state, not an error — nothing has been stored yet.
    return json(rec || { empty: true });
  } catch (_e) {
    return json({ error: "read failed" }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);

  const raw = await request.text();
  if (raw.length > MAX) return json({ error: "payload too large" }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  if (!body || typeof body.md !== "string" || !body.md.trim())
    return json({ error: "md (string) is required" }, 400);

  // Keep the OUTGOING copy before overwriting — KV holds one value per key, so without a
  // rollback the previous doctrine revision is gone. Mirrors the book's snapshot rule.
  try {
    const prev = await env.PULSE_CACHE.get(KEY);
    if (prev) await env.PULSE_CACHE.put(KEY + ":prev", prev, { expirationTtl: 60 * 60 * 24 * 30 });
  } catch (_e) { /* a missing rollback point must not block the write */ }

  const rec = {
    version: body.version || "unversioned",
    stored: body.stored || new Date().toISOString().slice(0, 10),
    bytes: body.md.length,
    md: body.md,
  };
  try {
    await env.PULSE_CACHE.put(KEY, JSON.stringify(rec));
  } catch (_e) {
    return json({ error: "write failed" }, 500);
  }
  return json({ ok: true, version: rec.version, bytes: rec.bytes });
}
