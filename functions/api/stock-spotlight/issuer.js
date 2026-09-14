// /api/stock-spotlight/issuer — operator-curated issuer-report records (v6.5.0).
// PIN-gated on BOTH read and write (the framework.js precedent): the records are public
// filing figures, but the write path is a mutation of what the public widget will publish,
// and only the operator may author one. Used where structured SEC data is insufficient —
// Nebius's 6-K interim results are press releases, not XBRL — so quarterly figures can be
// entered WITH the sec.gov URL of the filing they came from. validateIssuerReport is the
// wall: every period is dated, sized, USD, sourced to sec.gov, and numeric-or-absent.
//   GET  ?sym=NBIS         → the stored record (or {record:null})
//   PUT  {record}          → validate, store under spotlight:issuer:v1:<SYM>
//   PUT  {symbol, remove:true} → delete the record

import { authorize } from "../tt.js";
import { SPOTLIGHT_KEYS, validateIssuerReport } from "../../lib/spotlight.js";

const MAX_BODY = 32 * 1024;
const SYMBOL_RE = /^[A-Z.\-]{1,8}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
function crossOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; } catch (_e) { return true; }
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const sym = String(new URL(request.url).searchParams.get("sym") || "").trim().toUpperCase();
  if (!SYMBOL_RE.test(sym)) return json({ error: "valid sym is required" }, 400);
  let record = null;
  try { record = await env.PULSE_CACHE.get(SPOTLIGHT_KEYS.issuer(sym), "json"); } catch (_e) {}
  return json({ symbol: sym, record });
}

export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  if (body && body.remove === true) {
    const sym = String(body.symbol || "").trim().toUpperCase();
    if (!SYMBOL_RE.test(sym)) return json({ error: "valid symbol is required" }, 400);
    try { await env.PULSE_CACHE.delete(SPOTLIGHT_KEYS.issuer(sym)); } catch (e) { return json({ error: `delete failed: ${e?.message || "unknown"}` }, 503); }
    return json({ symbol: sym, removed: true });
  }
  const record = body && body.record && typeof body.record === "object" ? { ...body.record, symbol: String(body.record.symbol || "").trim().toUpperCase() } : null;
  const v = validateIssuerReport(record);
  if (!v.ok) return json({ error: v.error }, 400);
  const sym = String(record.symbol).toUpperCase();
  const stored = { ...record, symbol: sym, storedAt: new Date().toISOString() };
  try { await env.PULSE_CACHE.put(SPOTLIGHT_KEYS.issuer(sym), JSON.stringify(stored)); }
  catch (e) { return json({ error: `write failed: ${e?.message || "unknown"}` }, 503); }
  return json({ symbol: sym, record: stored });
}
