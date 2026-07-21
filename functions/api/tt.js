// FEAT-TT (v3.4.0): /api/tt — Ticker Terminal CANONICAL_BOOK store.
// Auth is CONFIG-GATED (FEAT-TT-PIN, v3.9.0):
//   env.TT_PIN set (exactly 6 digits) → PIN mode: POST {pin} mints a 30-day KV device
//     session (HttpOnly cookie); an x-tt-pin header serves automation. The PIN is NOT
//     the wall — the escalating KV lockout + fail-closed config are.
//   env.TT_PIN unset → legacy Cloudflare Access mode, unchanged: the Zero Trust app
//     edge-protects the path and this function verifies the Cf-Access-Jwt-Assertion JWT
//     (RS256, certs from the team domain, aud = env.ACCESS_AUD).
// Both modes fail closed: missing/malformed config → 503. Local dev only:
// env.ACCESS_DEV_BYPASS === "1" skips auth entirely.
// Storage: KV PULSE_CACHE key tt:book:v1, no TTL. Book data never ships in the bundle.

const BOOK_KEY = "tt:book:v1";
const SNAP_PREFIX = "tt:book:snap:";       // FEAT-TT-SAFE: dated rollback copies
const SNAP_TTL = 30 * 24 * 3600;           // 30 days of daily restore points
const TIERS = ["S", "A", "B", "DEF", "WATCH"];
const SYM_RE = /^[A-Z.\-]{1,8}$/;
const MAX_BODY = 64 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// ── FEAT-TT-PIN: PIN auth (config-gated) ────────────────────────────────────
const PIN_RE = /^\d{6}$/;
const SESSION_PREFIX = "tt:session:";
const LOCK_KEY = "tt:auth:lock";
const PIN_KEY = "tt:auth:pin";        // v3.10: KV pin record {salt, hash, setAt} — phone-only setup
const SESSION_TTL = 30 * 24 * 3600;   // 30-day device session
const LOCK_RECORD_TTL = 48 * 3600;    // failure history ages out of KV on its own
// Escalating lockout tiers [minFails, lockSeconds], checked top-down. At these rates a
// sustained 6-digit brute force needs years, and every failure is counted and surfaced.
export const LOCK_TIERS = [
  [10, 24 * 3600],                    // 10+ wrong PINs → 24h lock
  [5, 15 * 60],                       // 5+  → 15 min
];

// Which auth regime is this deploy running? Pure + exported for smoke. "misconfigured"
// (TT_PIN set but not exactly 6 digits) must fail CLOSED, never fall back to Access —
// a typo'd secret silently reopening the email gate would be an invisible downgrade.
export function authMode(env) {
  if (!env.TT_PIN) return "access";
  return PIN_RE.test(String(env.TT_PIN)) ? "pin" : "misconfigured";
}

// Pure lockout math (exported for smoke). rec = {fails, lockedUntil: ms-epoch|null}.
export function lockoutState(rec, nowMs) {
  const fails = (rec && rec.fails) || 0;
  const until = (rec && rec.lockedUntil) || 0;
  if (until > nowMs) return { locked: true, retryAfterSec: Math.ceil((until - nowMs) / 1000), fails };
  return { locked: false, retryAfterSec: 0, fails };
}
export function recordFailure(rec, nowMs) {
  const fails = ((rec && rec.fails) || 0) + 1;
  const tier = LOCK_TIERS.find(([min]) => fails >= min);
  return { fails, lockedUntil: tier ? nowMs + tier[1] * 1000 : null };
}

// Cookie header → named value (exported for smoke; exact-name match, no suffix tricks).
export function parseCookie(header, name) {
  for (const part of String(header || "").split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

// Compare via SHA-256 digests so compare time is independent of where the guess diverges.
async function pinMatches(guess, actual) {
  const dig = async (s) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  const [a, b] = await Promise.all([dig(guess), dig(actual)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Hex SHA-256 of salt:pin for the KV record (exported for smoke). NOTE: a 6-digit space
// is trivially brute-forceable OFFLINE under any KDF, and an attacker who can read KV
// already holds the book itself — the hash is hygiene (no plaintext at rest), not a
// wall. The wall remains the online lockout above.
export async function hashPin(saltHex, pin) {
  const data = new TextEncoder().encode(String(saltHex) + ":" + String(pin));
  const dig = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...dig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Resolve the ACTIVE auth config. Precedence: env TT_PIN (wrangler/laptop path) → KV pin
// record (phone-only setup path) → legacy Access. env wins by design: a KV write must
// never be able to override an operator-set secret.
async function resolveAuth(env) {
  const m = authMode(env);
  if (m !== "access") return { mode: m, src: "env" };
  let rec = null;
  try { rec = await env.PULSE_CACHE?.get(PIN_KEY, "json"); } catch (_e) {}
  if (rec && rec.salt && rec.hash) return { mode: "pin", src: "kv", rec };
  return { mode: "access" };
}

// Evaluate ONE PIN attempt against the shared KV lockout. Used by the login POST, the
// x-tt-pin header path, AND rotation's current-PIN check, so an attacker can't shop
// for a cheaper door. `cfg` is the resolveAuth() result (env pin vs KV record).
async function checkPin(pin, env, cfg) {
  const nowMs = Date.now();
  let rec = null;
  try { rec = await env.PULSE_CACHE.get(LOCK_KEY, "json"); } catch (_e) {}
  const lock = lockoutState(rec, nowMs);
  if (lock.locked)
    return { ok: false, status: 429, error: `locked — retry in ${lock.retryAfterSec}s`, retryAfterSec: lock.retryAfterSec };
  let match = false;
  if (PIN_RE.test(String(pin))) {
    match = cfg.src === "env"
      ? await pinMatches(pin, env.TT_PIN)
      : (await hashPin(cfg.rec.salt, pin)) === cfg.rec.hash;
  }
  if (match) {
    try { await env.PULSE_CACHE.delete(LOCK_KEY); } catch (_e) {}
    return { ok: true, priorFails: lock.fails };
  }
  const next = recordFailure(rec, nowMs);
  try { await env.PULSE_CACHE.put(LOCK_KEY, JSON.stringify(next), { expirationTtl: LOCK_RECORD_TTL }); } catch (_e) {}
  return { ok: false, status: 401, error: "wrong PIN" };
}

// CSRF guard for state-changing methods: browsers always send Origin on POST/PUT; a
// value from another host is a cross-site request. Absent Origin (curl, native) passes —
// the cookie is SameSite=Strict, so a browser can't be tricked into sending it cross-site.
function crossOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; } catch (_e) { return true; }
}

// Unified gate for GET/PUT: dev bypass → mode dispatch → (PIN) session cookie, then
// x-tt-pin header, else 401 so the client can raise its PIN prompt (never a redirect).
async function authorize(request, env) {
  if (env.ACCESS_DEV_BYPASS === "1") return { ok: true };
  const cfg = await resolveAuth(env);
  if (cfg.mode === "misconfigured") return { ok: false, status: 503, error: "TT_PIN must be exactly 6 digits" };
  if (cfg.mode === "access") return verifyAccessJwt(request, env);
  if (!env.PULSE_CACHE) return { ok: false, status: 503, error: "KV unavailable" };
  const token = parseCookie(request.headers.get("Cookie"), "tt_session");
  if (token && /^[a-f0-9]{32}$/.test(token)) {
    try {
      const sess = await env.PULSE_CACHE.get(SESSION_PREFIX + token, "json");
      // v3.11: exp (ms epoch, stored at mint) feeds the header's honest "PIN · Nd" line.
      // v3.10 sessions lack it → null → the client omits the day count, never guesses.
      if (sess) return { ok: true, sessionDaysLeft: sess.exp ? Math.max(0, Math.round((sess.exp - Date.now()) / 86400000)) : null };
    } catch (_e) {}
  }
  const hdrPin = request.headers.get("x-tt-pin");
  if (hdrPin != null) return checkPin(hdrPin, env, cfg);
  // Transitional courtesy: while the Access app still fronts the path (not yet deleted),
  // a valid Access JWT is accepted so the operator isn't double-gated mid-migration.
  // After the app is deleted no JWT arrives and this branch is inert.
  if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN && request.headers.get("Cf-Access-Jwt-Assertion")) {
    const a = await verifyAccessJwt(request, env);
    if (a.ok) return a;
  }
  return { ok: false, status: 401, error: "pin required" };
}

// Auth-failure JSON with Retry-After carried through on lockout responses.
function authFail(auth) {
  const res = json({ error: auth.error }, auth.status);
  if (auth.retryAfterSec) res.headers.set("Retry-After", String(auth.retryAfterSec));
  return res;
}

// ── Access JWT verification (legacy mode — active only while TT_PIN is unset) ──
let certCache = null; // { fetchedAt, keys: Map<kid, CryptoKey> }

function b64uToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys(teamDomain, force = false) {
  const now = Date.now();
  if (!force && certCache && now - certCache.fetchedAt < 6 * 3600 * 1000) return certCache.keys;
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
    let keys = await getKeys(env.ACCESS_TEAM_DOMAIN);
    let key = keys.get(header.kid);
    // FEAT-TT-SAFE: a kid miss means Access rotated its signing keys inside our 6h cache
    // window. Refetch once before rejecting, or every request 403s until the isolate recycles.
    if (!key) {
      keys = await getKeys(env.ACCESS_TEAM_DOMAIN, true);
      key = keys.get(header.kid);
    }
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
  const seen = new Set();
  for (const e of book) {
    if (!e || typeof e !== "object") return "book entries must be objects";
    if (typeof e.sym !== "string" || !SYM_RE.test(e.sym)) return "bad sym: " + JSON.stringify(e.sym);
    // FEAT-TT-SAFE: dupes render twice but find() resolves only the first, so edits and
    // removals hit one copy and the other persists as an unreachable ghost. Reject at the door.
    if (seen.has(e.sym)) return "duplicate sym: " + e.sym;
    seen.add(e.sym);
    if (!TIERS.includes(e.tier)) return "bad tier for " + e.sym;
    if (typeof e.lens !== "string" || e.lens.length > 4) return "bad lens for " + e.sym;
    if (typeof (e.note ?? "") !== "string" || (e.note || "").length > 500) return "bad note for " + e.sym;
    if (e.lastRun !== undefined && !(typeof e.lastRun === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.lastRun)))
      return "bad lastRun for " + e.sym;
  }
  for (const s of cut) if (typeof s !== "string" || s.length > 12) return "bad cut entry";
  return null;
}

// FEAT-TT-SAFE: optimistic concurrency. The client echoes the version it last read as
// If-Match; a mismatch means another device wrote in between, and a whole-book PUT would
// silently clobber it. Pure + exported so the smoke test can pin the truth table.
// An absent header is the documented escape hatch (curl recovery), NOT the client path.
export function conflictCheck(ifMatch, prevVersion) {
  if (!prevVersion) return null;            // nothing stored yet — first write always wins
  if (!ifMatch || ifMatch === "*") return null;  // explicit override
  return ifMatch === String(prevVersion) ? null : "version conflict";
}

const etDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

// ── Handlers ────────────────────────────────────────────────────────────────
// Mint a device session + cookie around a success payload (login and set-PIN both end here).
async function mintSession(env, bodyObj) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  try {
    await env.PULSE_CACHE.put(SESSION_PREFIX + token,
      JSON.stringify({ at: new Date().toISOString(), exp: Date.now() + SESSION_TTL * 1000 }),
      { expirationTtl: SESSION_TTL });
  } catch (e) {
    return json({ error: "session store failed: " + (e?.message || "unknown") }, 503);
  }
  const res = json(bodyObj);
  res.headers.set("Set-Cookie",
    `tt_session=${token}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Strict`);
  return res;
}

// FEAT-TT-PIN: POST /api/tt = PIN login ({pin}) or set/rotate ({new_pin}, v3.10 phone-only
// setup). Login success reports failed_attempts_since_last_login — the guessing tell.
export async function onRequestPost({ request, env }) {
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  let body;
  try { body = JSON.parse(await request.text()); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const cfg = await resolveAuth(env);
  if (cfg.mode === "misconfigured") return json({ error: "TT_PIN must be exactly 6 digits" }, 503);

  // ── SET / ROTATE ({new_pin}) — the phone-only path: no wrangler, no dashboard ──
  if (body && body.new_pin !== undefined) {
    if (!PIN_RE.test(String(body.new_pin))) return json({ error: "new_pin must be exactly 6 digits" }, 400);
    if (cfg.src === "env")
      return json({ error: "PIN is managed by the TT_PIN secret — change it with wrangler, not here" }, 409);
    if (cfg.mode === "access") {
      // Initial claim: changing the auth scheme requires passing the CURRENT auth —
      // the operator's (last-ever) Cloudflare Access login authorizes it. Fail closed:
      // no JWT / broken Access config can never leave the claim open to the internet.
      const a = await verifyAccessJwt(request, env);
      if (!a.ok) return authFail(a);
    } else {
      // Rotation: the current PIN itself is required (shared lockout applies) — a
      // stolen 30-day device session alone must never be able to change the lock.
      const r = await checkPin(body.current_pin, env, cfg);
      if (!r.ok) return authFail(r);
    }
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = [...saltBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const recNew = { salt, hash: await hashPin(salt, body.new_pin), setAt: new Date().toISOString() };
    try {
      await env.PULSE_CACHE.put(PIN_KEY, JSON.stringify(recNew)); // no TTL — persistent
    } catch (e) {
      return json({ error: "pin store failed: " + (e?.message || "unknown") }, 503);
    }
    return mintSession(env, { ok: true, mode: "pin", rotated: cfg.mode === "pin" });
  }

  // ── LOGIN ({pin}) ──
  if (cfg.mode === "access")
    return json({ error: "PIN auth not configured — terminal uses Cloudflare Access" }, 404);
  const r = await checkPin(body && body.pin, env, cfg);
  if (!r.ok) return authFail(r);
  return mintSession(env, { ok: true, session_days: SESSION_TTL / 86400, failed_attempts_since_last_login: r.priorFails || 0 });
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return authFail(auth);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);

  // ?snapshots=1 lists restore points; ?snapshot=YYYY-MM-DD reads one. Without a read
  // path the snapshots would be write-only, i.e. not actually a recovery mechanism.
  const url = new URL(request.url);
  if (url.searchParams.get("snapshots") === "1") {
    try {
      const list = await env.PULSE_CACHE.list({ prefix: SNAP_PREFIX });
      return json({ snapshots: list.keys.map(k => k.name.slice(SNAP_PREFIX.length)).sort().reverse() });
    } catch (e) { return json({ error: "list failed: " + (e?.message || "unknown") }, 503); }
  }
  const snapDate = url.searchParams.get("snapshot");
  if (snapDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapDate)) return json({ error: "bad snapshot date" }, 400);
    let snap = null;
    try { snap = await env.PULSE_CACHE.get(SNAP_PREFIX + snapDate, "json"); } catch (_e) {}
    if (!snap) return json({ error: "no snapshot for " + snapDate }, 404);
    return json({ ...snap, snapshotOf: snapDate, empty: false });
  }

  // `auth` tells the client which PIN UI to offer: access → SET PIN (phone-only claim);
  // pin/kv → CHANGE PIN; pin/env → managed by wrangler, read-only here.
  // session_days_left comes from the session record itself (server truth, not a client guess).
  const cfg = await resolveAuth(env);
  const authInfo = { mode: cfg.mode, src: cfg.src || null, session_days_left: auth.sessionDaysLeft ?? null };
  let stored = null;
  try { stored = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  if (!stored) return json({ version: null, asOf: null, book: [], cut: [], empty: true, auth: authInfo });
  return json({ ...stored, empty: false, auth: authInfo });
}

export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return authFail(auth);
  if (!env.PULSE_CACHE) return json({ error: "KV unavailable" }, 503);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 400);
  let body;
  try { body = JSON.parse(raw); } catch (_e) { return json({ error: "invalid JSON" }, 400); }
  const err = validateBook(body);
  if (err) return json({ error: err }, 400);

  let prev = null;
  try { prev = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}

  // Conflict gate: return the server's copy so the client can show both sides rather
  // than silently losing whichever device saved first.
  const conflict = conflictCheck(request.headers.get("If-Match"), prev?.version);
  if (conflict) return json({ error: conflict, current: { ...prev, empty: false } }, 409);

  const prevV = parseFloat(prev?.version);
  const version = Number.isFinite(prevV) ? (prevV + 0.1).toFixed(1) : (body.version || "1.0");
  const stored = { version, asOf: etDate(), book: body.book, cut: body.cut };

  // Snapshot before overwriting — KV holds one value per key, so without this an overwrite
  // is unrecoverable. FIRST write of each ET day wins: the snapshot must preserve the
  // start-of-day state, so a later mistake can't overwrite the good copy it needs to restore.
  if (prev) {
    const snapKey = SNAP_PREFIX + etDate();
    try {
      const existing = await env.PULSE_CACHE.get(snapKey);
      if (!existing) await env.PULSE_CACHE.put(snapKey, JSON.stringify(prev), { expirationTtl: SNAP_TTL });
    } catch (_e) { /* a missing rollback point must not block the write */ }
  }

  try {
    await env.PULSE_CACHE.put(BOOK_KEY, JSON.stringify(stored)); // no TTL — persistent
  } catch (e) {
    // Unguarded, this threw an HTML error page; the client saw non-JSON and told the user
    // to re-authenticate — a storage fault impersonating an auth fault.
    return json({ error: "storage write failed: " + (e?.message || "unknown") }, 503);
  }
  return json({ ...stored, empty: false });
}

export async function onRequest({ request, ...rest }) {
  if (request.method === "GET") return onRequestGet({ request, ...rest });
  if (request.method === "PUT") return onRequestPut({ request, ...rest });
  if (request.method === "POST") return onRequestPost({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
