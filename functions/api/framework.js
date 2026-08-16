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
import { authorize, crossOrigin } from "./tt.js";

const KEY = "tt:framework:v1";
const MAX = 128 * 1024;   // generous vs the ~20KB document; still a hard stop on runaway writes
const AI_RUBRIC_MAX = 8 * 1024;

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
    if (new URL(request.url).searchParams.get("aiRubric") === "1") return json(rec ? {
      hasFramework: typeof rec.md === "string" && !!rec.md.trim(), version: rec.version || null,
      aiRubric: rec.aiRubric || null,
    } : { empty: true, hasFramework: false, aiRubric: null });
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
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);

  const raw = await request.text();
  if (raw.length > MAX) return json({ error: "payload too large" }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "JSON object is required" }, 400);
  let previous = null;
  try { previous = await env.PULSE_CACHE.get(KEY, "json"); } catch (_e) {}
  const hasAiRubric = Object.prototype.hasOwnProperty.call(body, "aiRubric");
  const rubricOnly = !Object.prototype.hasOwnProperty.call(body, "md") && hasAiRubric;
  const md = rubricOnly ? previous?.md : body?.md;
  if (typeof md !== "string" || !md.trim())
    return json({ error: rubricOnly ? "an existing framework is required" : "md (string) is required" }, 400);
  let aiRubric = previous?.aiRubric || null;
  if (hasAiRubric) {
    if (body.aiRubric === null) aiRubric = null;
    else {
      const r = body.aiRubric;
      if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.text !== "string" || !r.text.trim())
        return json({ error: "aiRubric must be null or an object with non-empty text" }, 400);
      if (r.text.length > AI_RUBRIC_MAX) return json({ error: "aiRubric text exceeds 8 KiB" }, 400);
      if (typeof r.version !== "string" || !r.version.trim()) return json({ error: "aiRubric.version is required" }, 400);
      if (typeof r.approvedAt !== "string" || !Number.isFinite(Date.parse(r.approvedAt)))
        return json({ error: "aiRubric.approvedAt must be an ISO timestamp" }, 400);
      aiRubric = { text: r.text.trim(), version: r.version.trim().slice(0, 120), approvedAt: new Date().toISOString() };
    }
  }

  // Keep the OUTGOING copy before overwriting — KV holds one value per key, so without a
  // rollback the previous doctrine revision is gone. Mirrors the book's snapshot rule.
  try {
    if (previous) await env.PULSE_CACHE.put(KEY + ":prev", JSON.stringify(previous), { expirationTtl: 60 * 60 * 24 * 30 });
  } catch (_e) { /* a missing rollback point must not block the write */ }

  const rec = {
    version: rubricOnly ? previous.version : body.version || "unversioned",
    stored: rubricOnly ? previous.stored : body.stored || new Date().toISOString().slice(0, 10),
    bytes: md.length,
    md,
    ...(aiRubric ? { aiRubric } : {}),
  };
  try {
    await env.PULSE_CACHE.put(KEY, JSON.stringify(rec));
  } catch (_e) {
    return json({ error: "write failed" }, 500);
  }
  return json({ ok: true, version: rec.version, bytes: rec.bytes,
    aiRubric: aiRubric ? { version: aiRubric.version, approvedAt: aiRubric.approvedAt, bytes: aiRubric.text.length } : null });
}
