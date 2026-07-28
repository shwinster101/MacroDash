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
const LEDGER_PREFIX = "tt:ledger:";        // FEAT-TT-LEDGER: per-sym belief history
const LEDGER_INDEX_KEY = "tt:ledger:index";
const LEDGER_CAP = 500;                    // entries per sym; oldest pruned first
const QUOTE_PREFIX = "tt:quote:";          // mirrors CACHE_PREFIX in functions/api/quotes.js
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
export async function authorize(request, env) {
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
// FEAT-TT-SESSION (v3.28): board-level state — the things a TT session produces that no
// single ticker owns (correlation clusters, the leverage circuit, the funding queue, open
// decisions, non-ticker binaries, the session's asserted regime). Same doctrine as
// deepDive: validate only the shape the terminal RENDERS, pass unknown keys through, so
// the server never learns the private content. `as_of` is REQUIRED because every field
// here is self-attested and the strips age it — undated session state must not be storable.
const BOARD_MAX = 16 * 1024;
const CIRCUIT_STATES = ["clear", "armed", "tripped"];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
export function validateBoard(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return "board must be an object";
  if (!ISO_RE.test(String(b.as_of || ""))) return "board.as_of (YYYY-MM-DD) is required — session state ages";
  if (JSON.stringify(b).length > BOARD_MAX) return "board exceeds " + BOARD_MAX / 1024 + "KB";
  const c = b.circuit;
  if (c !== undefined) {
    if (!c || typeof c !== "object" || Array.isArray(c)) return "circuit must be an object";
    if (!CIRCUIT_STATES.includes(String(c.state))) return "circuit.state must be clear|armed|tripped";
    if (!ISO_RE.test(String(c.as_of || ""))) return "circuit.as_of (YYYY-MM-DD) is required";
    // as_of dates the asserted STATE; measured_at dates the NUMBER behind it. Optional,
    // because a state can legitimately be asserted with no fresh measurement — but if it
    // is given it must be a real date, since the strip ages it as evidence.
    if (c.measured_at !== undefined && !ISO_RE.test(String(c.measured_at))) return "circuit.measured_at must be YYYY-MM-DD";
  }
  if (b.clusters !== undefined) {
    if (!Array.isArray(b.clusters)) return "clusters must be an array";
    for (const cl of b.clusters) {
      if (!cl || typeof cl !== "object") return "each cluster must be an object";
      if (typeof (cl.label || cl.id) !== "string") return "each cluster needs a label or id";
      if (!Array.isArray(cl.members) || !cl.members.length) return "each cluster needs a non-empty members array";
      for (const m of cl.members) if (typeof m !== "string" || !SYM_RE.test(m)) return "bad cluster member: " + JSON.stringify(m);
    }
  }
  const f = b.funding;
  if (f !== undefined) {
    if (!f || typeof f !== "object" || Array.isArray(f)) return "funding must be an object";
    if (f.order !== undefined) {
      if (!Array.isArray(f.order)) return "funding.order must be an array";
      for (const o of f.order) if (!o || typeof o !== "object" || !SYM_RE.test(String(o.sym))) return "each funding.order row needs a sym";
    }
    if (f.do_not_trim !== undefined) {
      if (!Array.isArray(f.do_not_trim)) return "funding.do_not_trim must be an array";
      for (const s of f.do_not_trim) if (typeof s !== "string" || !SYM_RE.test(s)) return "bad do_not_trim sym: " + JSON.stringify(s);
    }
  }
  if (b.decisions !== undefined) {
    if (!Array.isArray(b.decisions)) return "decisions must be an array";
    for (const d of b.decisions) {
      if (!d || typeof d !== "object" || typeof d.q !== "string" || !d.q) return "each decision needs a q (the question)";
      if (d.asked !== undefined && !ISO_RE.test(String(d.asked))) return "decision.asked must be YYYY-MM-DD";
    }
  }
  if (b.binaries !== undefined) {
    if (!Array.isArray(b.binaries)) return "binaries must be an array";
    for (const k of b.binaries)
      if (!k || !ISO_RE.test(String(k.date)) || typeof (k.label || k.event) !== "string")
        return "each binary needs {date: YYYY-MM-DD, label|event}";
  }
  if (b.regime !== undefined) {
    if (!b.regime || typeof b.regime !== "object" || Array.isArray(b.regime)) return "regime must be an object";
    if (typeof b.regime.asserted !== "string" || !b.regime.asserted) return "regime.asserted (the session's read) is required";
  }
  // FEAT-TT-POS: the account-level measured block. `formula` is REQUIRED because mapping
  // broker fields to a leverage ratio is a judgment call, not a lookup — recording which
  // numbers were divided makes the figure that vetoes every add inspectable and correctable
  // instead of magic arriving from a script nobody can audit.
  if (b.account !== undefined) {
    const a = b.account;
    if (!a || typeof a !== "object" || Array.isArray(a)) return "account must be an object";
    if (!ISO_DT_RE.test(String(a.at || ""))) return "account.at (ISO date/time) is required";
    if (typeof a.src !== "string" || !a.src) return "account.src is required";
    if (typeof a.formula !== "string" || !a.formula) return "account.formula is required — the leverage number must say how it was computed";
    for (const k of ["nav", "debt", "debt_pct_nav"])
      if (a[k] !== undefined && !isFinite(Number(a[k]))) return "account." + k + " must be a number";
  }
  return null;
}

// FEAT-TT-POS (v3.30): a MEASURED position, written by the broker sync — never typed.
// This is a different epistemic class from everything else in an entry: tier/lens/note/
// deepDive are ASSERTED by a human and aged by lastRun, while `pos` is a fact with its own
// timestamp and source. It sits at entry level (beside `dots`) and NOT inside deepDive on
// purpose — the payload editor replaces deepDive wholesale, so a thesis paste would destroy
// measured facts stored there.
// Values are plausibility-banded in the spirit of BANDS/applyBands in snapshot.js: reject
// the impossible, not the unusual. A decimal-shifted weight would otherwise sail through
// and trip a cap breach (or, worse, silently clear one).
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/;
export function validatePos(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return "pos must be an object";
  if (!ISO_DT_RE.test(String(p.at || ""))) return "pos.at (ISO date/time) is required — a measured fact without a time cannot be aged";
  if (typeof p.src !== "string" || !p.src) return "pos.src is required — a measured fact must name where it came from";
  const num = (k, lo, hi) => {
    if (p[k] === undefined || p[k] === null) return null;
    const v = Number(p[k]);
    if (!isFinite(v)) return `pos.${k} must be a number`;
    if (v < lo || v > hi) return `pos.${k} out of band (${lo}..${hi}): ${p[k]}`;
    return null;
  };
  // Wide bands. A short equity position is real (sh < 0), a position worth more than the
  // account is not, and a weight outside 0..100 is arithmetic that already went wrong.
  for (const e of [num("sh", -1e9, 1e9), num("mv", -1e12, 1e12), num("pct", 0, 100),
                   num("cb", -1e12, 1e12), num("upl_pct", -100, 1e5)])
    if (e) return e;
  if (p.opt !== undefined) {
    if (!Array.isArray(p.opt)) return "pos.opt must be an array";
    for (const o of p.opt) {
      if (!o || typeof o !== "object") return "each pos.opt leg must be an object";
      if (!["call", "put"].includes(String(o.k))) return "option leg k must be call|put";
      if (!["long", "short"].includes(String(o.side))) return "option leg side must be long|short";
      if (!isFinite(Number(o.n)) || Number(o.n) <= 0) return "option leg n must be a positive contract count";
      if (o.exp !== undefined && !ISO_RE.test(String(o.exp))) return "option leg exp must be YYYY-MM-DD";
    }
  }
  return null;
}

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
    if (e.pos !== undefined && e.pos !== null) {
      const pe = validatePos(e.pos);
      if (pe) return e.sym + " pos: " + pe;
    }
  }
  for (const s of cut) if (typeof s !== "string" || s.length > 12) return "bad cut entry";
  if (body.board !== undefined && body.board !== null) {
    const be = validateBoard(body.board);
    if (be) return "board: " + be;
  }
  return null;
}

// FEAT-TT-LEDGER (v3.32): the belief ledger. Every OTHER field in this book is a snapshot
// that overwrites in place — tier, projection, hinge state, all replaced silently on the
// next PUT. The terminal has no memory: it cannot say "you were S at $170 and now it's
// $190", cannot show what you believed the day before a name re-rated, cannot flag the
// exact "estimates up, price down" pattern the 7/28 handoff had to catch BY HAND for CRDO.
//
// diffForLedger is the notary. It is pure and takes no KV/network access — the caller
// (onRequestPut) supplies book snapshots and stamps px afterward, so this stays smoke-
// testable like validateBook/conflictCheck. It logs BELIEFS ONLY (the user's explicit
// call): tier, rank, run stamps, thesis version, hinge transitions, PT-model edits,
// projection answers, the composite score, and consensus-estimate revisions. It does NOT
// log `pos`, `ref_px`, `dots`, or note text — those are facts or scratch, not conviction.
//
// Entry shape: {t, v, kind, sym, field, from, to} — px is added by the caller. `field` is
// an optional sub-identifier (a hinge's label, an "rev:2028"/"eps:2028" tag) used only by
// kinds where "sym" alone doesn't name what changed.
const parseCompositeScore = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v == null ? "" : v);
  const dec = s.match(/\d+\.\d+/);
  if (dec) return parseFloat(dec[0]);
  const int = s.match(/\d+/);
  return int ? parseFloat(int[0]) : null;
};
const hingeKey = (h) => (h && (h.label || h.key || h.id)) || null;
const compositeScoreOf = (dd) => {
  const c = dd && dd.composite;
  if (c && typeof c === "object") return parseCompositeScore(c.score);
  if (dd && dd.status_flags && (typeof dd.status_flags.composite === "string" || typeof dd.status_flags.composite === "number"))
    return parseCompositeScore(dd.status_flags.composite);
  return null;
};
export function diffForLedger(prevBook, nextBook, prevCut, nextCut, t, v) {
  const out = [];
  const push = (kind, sym, from, to, field) => out.push({ t, v, kind, sym, field: field ?? null, from: from ?? null, to: to ?? null });
  const prevMap = new Map((Array.isArray(prevBook) ? prevBook : []).map((e) => [e.sym, e]));
  const nextMap = new Map((Array.isArray(nextBook) ? nextBook : []).map((e) => [e.sym, e]));

  for (const [sym, e] of nextMap) if (!prevMap.has(sym)) push("add", sym, null, e.tier);
  for (const [sym, e] of prevMap) if (!nextMap.has(sym)) push("remove", sym, e.tier, null);

  for (const [sym, next] of nextMap) {
    const prev = prevMap.get(sym);
    if (!prev) continue;
    if (prev.tier !== next.tier) push("tier", sym, prev.tier, next.tier);
    if ((prev.rank || null) !== (next.rank || null)) push("rank", sym, prev.rank || null, next.rank || null);
    if ((prev.lastRun || null) !== (next.lastRun || null)) push("run", sym, prev.lastRun || null, next.lastRun || null);

    const pdd = prev.deepDive, ndd = next.deepDive;
    if (pdd || ndd) {
      const pThesis = pdd && (pdd.thesis_version || pdd.updated || pdd.as_of);
      const nThesis = ndd && (ndd.thesis_version || ndd.updated || ndd.as_of);
      if ((pThesis || null) !== (nThesis || null)) push("thesis", sym, pThesis || null, nThesis || null);

      // Hinges: matched by identity (same rule as the client's validateDeepDive), so a
      // reordered array never reads as N state changes.
      const pHinges = new Map((Array.isArray(pdd && pdd.hinges) ? pdd.hinges : []).map((h) => [hingeKey(h), h]).filter(([k]) => k));
      const nHinges = new Map((Array.isArray(ndd && ndd.hinges) ? ndd.hinges : []).map((h) => [hingeKey(h), h]).filter(([k]) => k));
      for (const [key, nh] of nHinges) {
        const ph = pHinges.get(key);
        if (ph && (ph.state || "unknown") !== (nh.state || "unknown"))
          push("hinge", sym, ph.state || "unknown", nh.state || "unknown", key);
      }

      // pt_model: the floor multiple is the one owner-editable field with a clean before/
      // after number (multEditor); any other change to the model still counts, generically.
      const pPt = (pdd && pdd.pt_model) || null, nPt = (ndd && ndd.pt_model) || null;
      if (JSON.stringify(pPt) !== JSON.stringify(nPt)) {
        const pFloor = pPt && pPt.pe_floor_multiple, nFloor = nPt && nPt.pe_floor_multiple;
        if (pFloor !== nFloor) push("pt", sym, pFloor ?? null, nFloor ?? null, "floor");
        else push("pt", sym, null, "revised", "model");
      }

      const comp = compositeScoreOf(pdd) !== null || compositeScoreOf(ndd) !== null ? [compositeScoreOf(pdd), compositeScoreOf(ndd)] : null;
      if (comp && comp[0] !== comp[1]) push("comp", sym, comp[0], comp[1]);

      // Estimate revisions feed FEAT-TT-SPREAD's divergence flag (est up + price down =
      // the CRDO pattern). Capped at 3 changed (year,field) pairs per sym per write so a
      // bulk consensus refresh can't flood the ledger.
      const pCons = (pdd && pdd.consensus) || {}, nCons = (ndd && ndd.consensus) || {};
      const estChanges = [];
      for (const field of ["revenue_B", "eps"]) {
        const pf = pCons[field] || {}, nf = nCons[field] || {};
        const years = [...new Set([...Object.keys(pf), ...Object.keys(nf)])].sort();
        for (const y of years) {
          if (pf[y] !== undefined && nf[y] !== undefined && pf[y] !== nf[y])
            estChanges.push([`${field === "eps" ? "eps" : "rev"}:${y}`, pf[y], nf[y]]);
        }
      }
      estChanges.slice(0, 3).forEach(([field, from, to]) => push("est", sym, from, to, field));
    }

    const pProj = prev.projection, nProj = next.projection;
    if (JSON.stringify(pProj || null) !== JSON.stringify(nProj || null)) {
      const pRev = pProj && pProj.rev_3yr && pProj.rev_3yr.value_B, nRev = nProj && nProj.rev_3yr && nProj.rev_3yr.value_B;
      const pMult = pProj && pProj.multiple && pProj.multiple.value, nMult = nProj && nProj.multiple && nProj.multiple.value;
      const pPath = pProj && pProj.margins && pProj.margins.path, nPath = nProj && nProj.margins && nProj.margins.path;
      if (pRev !== nRev) push("proj", sym, pRev ?? null, nRev ?? null, "rev_3yr_B");
      else if (pMult !== nMult) push("proj", sym, pMult ?? null, nMult ?? null, "multiple");
      else if (pPath !== nPath) push("proj", sym, pPath || null, nPath || null, "margins");
    }
  }

  const pCutSet = new Set(Array.isArray(prevCut) ? prevCut : []);
  for (const s of Array.isArray(nextCut) ? nextCut : []) if (!pCutSet.has(s)) push("cut", s, null, "cut");

  return out;
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
  // FEAT-TT-SESSION: the book is a whole-document replace, but `board` must not inherit
  // that. An ABSENT board means "this client doesn't know about board" (curl recovery, an
  // older cached bundle) — deleting the session state on their behalf would be a silent
  // data loss the operator never asked for. Absent → carry forward; explicit null → clear.
  const carried = body.board === undefined ? prev?.board : body.board;
  if (carried) stored.board = carried;

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

  // FEAT-TT-LEDGER: notarize what changed. Fire-and-forget — a ledger fault must never
  // fail the book write the user is waiting on; the belief just goes unrecorded this once.
  try {
    const entries = diffForLedger(prev?.book, stored.book, prev?.cut, stored.cut, new Date().toISOString(), stored.version);
    if (entries.length) await appendLedger(env, entries);
  } catch (_e) { /* the book write already succeeded; the ledger is best-effort */ }

  return json({ ...stored, empty: false });
}

// Stamp px per entry (from the quotes cache, else a same-day ref_px, else honestly null —
// never fabricated) and append to each affected sym's ledger, capping at LEDGER_CAP.
async function appendLedger(env, entries) {
  const today = etDate();
  const bySym = new Map();
  for (const e of entries) { if (!bySym.has(e.sym)) bySym.set(e.sym, []); bySym.get(e.sym).push(e); }
  await Promise.all([...bySym.entries()].map(async ([sym, syms]) => {
    let px = null;
    try {
      const q = await env.PULSE_CACHE.get(QUOTE_PREFIX + sym, "json");
      if (q && isFinite(q.px)) px = q.px;
    } catch (_e) {}
    const stamped = syms.map((e) => ({ ...e, px }));
    let cur = [];
    try { cur = (await env.PULSE_CACHE.get(LEDGER_PREFIX + sym, "json")) || []; } catch (_e) {}
    if (!Array.isArray(cur)) cur = [];
    cur.push(...stamped);
    if (cur.length > LEDGER_CAP) cur = cur.slice(cur.length - LEDGER_CAP);
    await env.PULSE_CACHE.put(LEDGER_PREFIX + sym, JSON.stringify(cur));
  }));
  try {
    let idx = (await env.PULSE_CACHE.get(LEDGER_INDEX_KEY, "json")) || {};
    if (typeof idx !== "object" || Array.isArray(idx)) idx = {};
    for (const [sym, syms] of bySym) idx[sym] = { count: (idx[sym]?.count || 0) + syms.length, last: today };
    await env.PULSE_CACHE.put(LEDGER_INDEX_KEY, JSON.stringify(idx));
  } catch (_e) { /* the per-sym ledgers already wrote; the index is a convenience list */ }
}

export async function onRequest({ request, ...rest }) {
  if (request.method === "GET") return onRequestGet({ request, ...rest });
  if (request.method === "PUT") return onRequestPut({ request, ...rest });
  if (request.method === "POST") return onRequestPost({ request, ...rest });
  return json({ error: "method not allowed" }, 405);
}
