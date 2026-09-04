// functions/api/snapshot/refresh.js — ENGINE0-CONT §8: the REAL refresh endpoint.
// Route: POST /api/snapshot/refresh   (GET → 405; anonymous POST fails closed)
//
// WHY: the admin "⟳ RANKS" button only re-GET /readout.json, which rereads the same
// per-day KV value; the cron Worker's POST /refresh wrote the LEGACY pulse:macro:latest
// key. Neither could actually rebuild the active pulse:snapshot:v16:<ET-date> document.
// This endpoint builds a fresh candidate WITHOUT deleting the current snapshot (KV is
// eventually consistent — delete-then-refetch was a self-inflicted race), publishes it
// only if it is no worse (publishIfNoWorse, §7.2), and returns the candidate's readout
// DIRECTLY in the response so the caller never has to reread KV and hope the write is
// globally visible yet.
//
// AUTH (two paths, both fail closed):
//   - operator: the terminal's existing PIN session / x-tt-pin / Access JWT (authorize()
//     in ../tt.js — the same gate /api/tt uses), plus an Origin check on browser POSTs.
//   - server-to-server (the cron Worker): x-refresh-token matching env.REFRESH_TOKEN.
//     No secret configured → no token path for anyone.
//
// LLM TOOL CONTRACT (§10): this is `refresh_macro_readout` — operator-authorized only.
// The response body carries the complete deterministic readout; a model may SUMMARIZE it
// but never recomputes bands, substitutes values, or invents inputs. The read-only
// counterpart `get_macro_readout` is public GET /readout.json. Credentials live in the
// tool executor / env — never in model-visible text.

import { authorize } from "../tt.js";
import { buildSnapshot, publishIfNoWorse } from "../snapshot.js";
import { buildMacroCall } from "../../../src/macroCall.js";
import { historyKey, validFrozenCall } from "../../../src/publicHistory.js";
import { buildCloseRead } from "../../../src/closeRead.js";

const COOLDOWN_KEY = "pulse:refresh:cooldown";
const COOLDOWN_SEC = 60;                 // KV minimum TTL — also a sane upstream floor
const ATTEMPTS_KEY = "pulse:refresh:attempts";
const ATTEMPTS_CAP = 20;                 // §9: keep the evidence of prior failures

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

// Same CSRF guard as tt.js/positions.js (mirrored, not exported there — their precedent).
function crossOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; } catch (_e) { return true; }
}

// §9: ONE rolling attempt log for both editions (v6.2) — diagnostic, never blocks a build.
async function appendAttempt(env, entry) {
  try {
    let log = [];
    try { const prev = await env.PULSE_CACHE?.get(ATTEMPTS_KEY, "json"); if (Array.isArray(prev)) log = prev; } catch {}
    log.push(entry);
    if (log.length > ATTEMPTS_CAP) log = log.slice(-ATTEMPTS_CAP);
    await env.PULSE_CACHE?.put(ATTEMPTS_KEY, JSON.stringify(log), { expirationTtl: 30 * 24 * 3600 });
  } catch { /* diagnostic only */ }
}

export async function onRequestGet() {
  return json({ error: "method not allowed — this endpoint mutates state; use POST" }, 405, { Allow: "POST" });
}

export async function onRequestPost({ request, env }) {
  if (crossOrigin(request)) return json({ error: "cross-origin refresh rejected" }, 403);

  // Auth: server token first (constant-time not required — the token is high-entropy and
  // the lockout story lives on the PIN path), else the terminal's own gate.
  const hdrToken = request.headers.get("x-refresh-token");
  const serverAuthed = !!(env.REFRESH_TOKEN && hdrToken && hdrToken === env.REFRESH_TOKEN);
  if (!serverAuthed) {
    const auth = await authorize(request, env);
    if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  }

  // Cooldown: a refresh spends real upstream calls; back-to-back operator taps (or an LLM
  // loop) must not stampede FRED. 429 carries when the window reopens.
  try {
    const cd = await env.PULSE_CACHE?.get(COOLDOWN_KEY);
    if (cd) return json({ error: "refresh cooling down — try again shortly", retry_after_sec: COOLDOWN_SEC }, 429, { "Retry-After": String(COOLDOWN_SEC) });
    await env.PULSE_CACHE?.put(COOLDOWN_KEY, "1", { expirationTtl: COOLDOWN_SEC });
  } catch { /* KV unavailable — proceed; the build itself will degrade honestly */ }

  let scope = "critical", reason = "operator", edition = "day";
  try {
    const body = await request.json();
    if (body && body.scope === "all") scope = "all";
    if (body && typeof body.reason === "string") reason = body.reason.slice(0, 32);
    if (body && body.edition === "close") edition = "close";   // v6.2: anything else is the day edition
  } catch { /* empty body — defaults stand */ }

  const startedAt = new Date().toISOString();
  const attemptId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  // SYNC HAZARD: key version must match functions/api/snapshot.js / readout.json.js / worker/cron.js.
  const cacheKey = `pulse:snapshot:v16:${etDate}`;

  /* v6.2 — the CLOSE edition (the 6pm cron). The SAME builder with time-aware failsafes and
     the display-only SPY leg — and NO publishIfNoWorse: the day key is never rebuilt by the
     6pm run. It is the basis every open receipt hashed and the basis the scored call was
     projected from; same-day legs must not leak, unlabeled, into Engine 0 or the hero's live
     evidence. The candidate lives under its OWN side key (48h, diagnostic — nothing reads it
     for a decision, readout.json ignores it) and the close read rides the response body with
     `published:false` stated, so no caller can mistake the read for a republish. */
  if (edition === "close") {
    const now = new Date();
    const { snapshot, statuses } = await buildSnapshot(env, { scope: "all", priorLive: null, edition: "close", now });
    const completedAt = new Date().toISOString();
    let frozenCall = null;
    try { frozenCall = validFrozenCall(await env.PULSE_CACHE?.get(historyKey(etDate), "json"), etDate); }
    catch { /* a day with no 10am row is a real state, stated in the read */ }
    const closeRead = buildCloseRead({ live: snapshot.live || {}, date: etDate, generatedAt: completedAt, frozenCall, now });
    const sideKey = `pulse:snapshot:close:v1:${etDate}`;
    try { await env.PULSE_CACHE?.put(sideKey, JSON.stringify(snapshot), { expirationTtl: 48 * 3600 }); }
    catch { /* diagnostic side key only */ }
    await appendAttempt(env, { at: startedAt, attempt_id: attemptId, reason, scope: "all", edition: "close",
      published: false, improved: false, direction: closeRead.read.direction, headline: closeRead.read.headline,
      legs_same_day: closeRead.legs_same_day,
      failures: (statuses || []).filter((s) => !s.ok).map((s) => `${s.source}:${s.item}:${s.error_class}`) });
    return json({
      ok: true,
      edition: "close",
      published: false,
      attempt_id: attemptId,
      started_at: startedAt,
      completed_at: completedAt,
      message: `close read built (unscored) · day key untouched · same-day legs: ${closeRead.legs_same_day.join(", ") || "none"}` +
        (frozenCall ? "" : " · no 10am call frozen today"),
      close_read: closeRead,
      source_status: statuses || [],
    });
  }

  // Read the CURRENT snapshot first — it is the critical-scope carry source, the
  // "no newer observation" baseline, and it is NEVER deleted before the rebuild.
  let prior = null;
  try { prior = await env.PULSE_CACHE?.get(cacheKey, "json"); } catch { /* treat as absent */ }

  const { snapshot, readout, statuses } = await buildSnapshot(env, { scope, priorLive: prior?.live ?? null });
  const pub = await publishIfNoWorse(env, cacheKey, snapshot, readout);
  const completedAt = new Date().toISOString();
  // Build the canonical public projection from THIS candidate. Returning only the legacy
  // TT readout would force the Worker back onto an eventually-consistent KV reread and could
  // freeze yesterday's call even after a successful refresh.
  const currentCall = buildMacroCall(snapshot.live || {}, {
    cached: false,
    effectiveDate: etDate,
    generatedAt: completedAt,
  });
  let call = currentCall, callFrozen = false, callCapturedAt = null;
  try {
    const record = await env.PULSE_CACHE?.get(historyKey(etDate), "json");
    const frozen = validFrozenCall(record, etDate);
    if (frozen) { call = frozen; callFrozen = true; callCapturedAt = record.captured_at || null; }
  } catch { /* first 10am capture has no record yet; its candidate is the call to freeze */ }

  // Message ladder (§8's required alternates): say what advanced and what could not.
  const messages = [];
  if (!pub.published) messages.push(pub.reason || "refresh completed but the candidate was worse; retained the prior snapshot");
  else if (pub.improved) messages.push(`Engine 0 recovered to ${readout.regime.current} current check(s) (${readout.regime.confidence} confidence, ${readout.regime.actionability})`);
  else {
    // Published (no worse, newer) but no evidence axis moved: did any publisher advance?
    const priorReadout = prior?.live ? { spy: prior.live.spyPriceAsOf ?? null, vix: prior.live.vixAsOf ?? null, ten: prior.live.tenYearAsOf ?? null } : null;
    const same = priorReadout && priorReadout.spy === (snapshot.live.spyPriceAsOf ?? null)
      && priorReadout.vix === (snapshot.live.vixAsOf ?? null) && priorReadout.ten === (snapshot.live.tenYearAsOf ?? null);
    messages.push(same ? "refresh succeeded but no newer observation is available from the publishers yet"
                       : "snapshot republished at equal evidence quality");
  }
  if (readout.vix && readout.vix.tier === "HISTORICAL") messages.push("VIX is carried from the last official close; Macro Flip remains unconfirmed");
  if ((statuses || []).some((s) => /no upcoming FOMC event/.test(String(s.message || "")))) messages.push("Kalshi returned no open KXFEDDECISION event");

  // §9: persist a rolling attempt log — never overwrite the only evidence of the prior failure.
  await appendAttempt(env, { at: startedAt, attempt_id: attemptId, reason, scope, edition, published: pub.published, improved: pub.improved,
    verdict: readout.regime.verdict, confidence: readout.regime.confidence, actionability: readout.regime.actionability,
    current: readout.regime.current, historical: readout.regime.historical, missing: readout.regime.missing,
    failures: (statuses || []).filter((s) => !s.ok).map((s) => `${s.source}:${s.item}:${s.error_class}`) });

  // The COMPLETE deterministic readout rides the response — the caller renders THIS, and
  // never rereads KV assuming global write visibility (KV is eventually consistent).
  return json({
    ok: true,
    published: pub.published,
    improved: pub.improved,
    attempt_id: attemptId,
    started_at: startedAt,
    completed_at: completedAt,
    message: messages.join(" · "),
    readout: { schema: "tt-v1", as_of: snapshot.asOf, generated_at: completedAt, cached: false,
      ...readout, call, call_frozen: callFrozen, call_captured_at: callCapturedAt },
    // Secrets/keys never appear here; recordStatus captures class/status/latency only.
    source_status: statuses || [],
  });
}

export async function onRequest({ request, ...rest }) {
  if (request.method === "POST") return onRequestPost({ request, ...rest });
  return onRequestGet();
}
