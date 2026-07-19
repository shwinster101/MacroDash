// FEAT-TT (v3.4.0): /api/tt — Ticker Terminal CANONICAL_BOOK store.
// Auth: Cloudflare Access. The path is edge-protected by a Zero Trust Access app;
// as defense-in-depth this function ALSO verifies the Cf-Access-Jwt-Assertion JWT
// (RS256, certs from the team domain, aud = env.ACCESS_AUD). Fail closed: missing
// env config → 503. Local dev only: env.ACCESS_DEV_BYPASS === "1" skips the check.
// Storage: KV PULSE_CACHE key tt:book:v1, no TTL. Book data never ships in the bundle.

const BOOK_KEY = "tt:book:v1";
const TIERS = ["S", "A", "B", "DEF", "WATCH"];
const SYM_RE = /^[A-Z.\-]{1,8}$/;
const MAX_BODY = 64 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// ── Access JWT verification ─────────────────────────────────────────────────
let certCache = null; // { fetchedAt, keys: Map<kid, CryptoKey> }

function b64uToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys(teamDomain) {
  const now = Date.now();
  if (certCache && now - certCache.fetchedAt < 6 * 3600 * 1000) return certCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("certs fetch failed: " + res.status);
  const { keys: jwks } = await res.json();
  const keys = new Map();
  for (const jwk of jwks || []) {
    if (jwk.kty !== "RSA") continue;
    const key = await crypto.subtle.importKey(
      "jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["verify"]
    );
    keys.set(jwk.kid, key);
  }
  certCache = { fetchedAt: now, keys };
  return keys;
}

async function verifyAccessJwt(request, env) {
  if (env.ACCESS_DEV_BYPASS === "1") return { ok: true };
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN)
    return { ok: false, status: 503, error: "ACCESS_AUD / ACCESS_TEAM_DOMAIN not configured" };
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 403, error: "unauthorized" };
  try {
    const [h, p, sig] = token.split(".");
    if (!h || !p || !sig) throw new Error("malformed");
    const header = JSON.parse(new TextDecoder().decode(b64uToBytes(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64uToBytes(p)));
    const keys = await getKeys(env.ACCESS_TEAM_DOMAIN);
    const key = keys.get(header.kid);
    if (!key) throw new Error("unknown kid");
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, b64uToBytes(sig),
      new TextEncoder().encode(h + "." + p)
    );
    if (!valid) throw new Error("bad signature");
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) throw new Error("aud mismatch");
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now())
      throw new Error("expired");
    return { ok: true, email: payload.email };
  } catch (_e) {
    return { ok: false, status: 403, error: "unauthorized" };
  }
}

// ── Book validation ─────────────────────────────────────────────────────────
// Checks sym/tier/lens/note only and DELIBERATELY PASSES THROUGH unknown per-entry
// keys — the admin client owns their shape (`fp`, `rank`, and FEAT-TT-RUN's `lastRun`
// all ride this). Load-bearing behavior, not an oversight. Exported for the smoke test.
export function validateBook(body) {
  if (!body || typeof body !== "object") return "body must be an object";
  const { book, cut } = body;
  if (!Array.isArray(book)) return "book must be an array";
  if (!Array.isArray(cut)) return "cut must be an array";
  for (const e of book) {
    if (!e || typeof e !== "object") return "book entries must be objects";
    if (typeof e.sym !== "string" || !SYM_RE.test(e.sym)) return "bad sym: " + JSON.stringify(e.sym);
    if (!TIERS.includes(e.tier)) return "bad tier for " + e.sym;
    if (typeof e.lens !== "string" || e.lens.length > 4) return "bad lens for " + e.sym;
    if (typeof (e.note ?? "") !== "string" || (e.note || "").length > 500) return "bad note for " + e.sym;
  }
  for (const s of cut) if (typeof s !== "string" || s.length > 12) return "bad cut entry";
  return null;
}

const etDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

// ── Handlers ────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const auth = await verifyAccessJwt(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  let stored = null;
  try { stored = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  if (!stored) return json({ version: null, asOf: null, book: [], cut: [], empty: true });
  return json({ ...stored, empty: false });
}

export async function onRequestPut({ request, env }) {
  const auth = await verifyAccessJwt(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const err = validateBook(body);
  if (err) return json({ error: err }, 400);

  let prev = null;
  try { prev = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  const prevV = parseFloat(prev?.version);
  const version = Number.isFinite(prevV) ? (prevV + 0.1).toFixed(1) : (body.version || "1.0");
  const stored = { version, asOf: etDate(), book: body.book, cut: body.cut };
  await env.PULSE_CACHE.put(BOOK_KEY, JSON.stringify(stored)); // no TTL — persistent
  return json({ ...stored, empty: false });
}

export async function onRequest({ request, ...rest }) {
  if (request.method === "GET") return onRequestGet({ request, ...rest });
  if (request.method === "PUT") return onRequestPut({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
