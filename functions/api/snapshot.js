// functions/api/snapshot.js — MacroDash v2.0 live data assembler
// Called by useMarketData() in LIVE mode: GET /api/snapshot[?view=public]
//
// ARCHITECTURE:
//   1. Check PULSE_CACHE KV — if warm, return immediately (badge = CACHED).
//      `session` is recomputed on that path: it describes the CURRENT session, so it is
//      the one field that must never be served frozen from a per-day cache.
//   2. Fetch sources in PHASES (FRED batched, then SPY + 3 scrapers, then 3 more) to stay
//      under the ~6-connection cap. Every fetch carries AbortSignal.timeout(9000).
//   3. Assemble into { live: {...} } matching the SOURCES field names in src/sources.js,
//      then applyBands() drops implausible values before anything renders or caches.
//   4. Write-through cache. QUORUM over named regime-voting fields decides the TTL:
//      at quorum + settled → CACHE_TTL (locks the day); below → SETTLING_TTL (retry soon).
//   5. Return { live, asOf, cached: false }
//
// KEY SAFETY: env.FRED_KEY and env.FINNHUB_KEY live here. Never in src/ (frontend).
// (Equity prices come from FRED's SP500 series + Finnhub — Stooq was dropped; it blocks
// Cloudflare edge IPs. There is no STOOQ_KEY.)
// Set in Cloudflare: Workers & Pages → MacroDash → Settings → Variables & Secrets

// SECOND functions/→src/ import (readout.json.js → ttReadout was the first; esbuild
// inlines it). sources.js is pure ESM, no React — the ONE market-holiday table feeds
// marketSession/looksBehind here and isStale/etSession client-side, so the two sides
// can never disagree about which weekdays had a session.
import { isMarketHoliday } from "../../src/sources.js";
// FEAT-SAHM (v3.84): the Sahm math — one home (src/sahm.js), same esbuild-inline path.
import { sahmFrom } from "../../src/sahm.js";

// ENGINE0-CONT: the readout contract now lives in src/ttReadout.js and the snapshot layer
// consumes it for publish decisions — THIRD functions/→src/ import, same esbuild-inline path.
import { buildTtReadout, readoutQuality, compareQuality } from "../../src/ttReadout.js";

const CACHE_TTL = 48 * 60 * 60;   // 48h cleanup; the per-day cache KEY drives freshness
const SETTLING_TTL = 60 * 60;     // short lock-in while the latest close looks not-yet-posted
/* ENGINE0-CONT §7.3 TTL policy — NAMED, driven by CONFIDENCE (data quality), deliberately NOT
   by actionability: a tripped Macro Flip on fully-current data is HOLD but perfect evidence,
   and a 5-minute TTL there would hammer FRED/CNN all day during the exact tape that rate-limits
   matter most. The plan's "HIGH+FULL / MEDIUM / LOW" ladder is preserved on its data axis. */
export const TTL_MEDIUM = 15 * 60;  // MEDIUM confidence: retry in 15 minutes
export const TTL_LOW = 5 * 60;      // LOW confidence: retry in 5 minutes
export function chooseTtl(readout, settled = true) {
  const c = readout && readout.regime && readout.regime.confidence;
  if (c === "HIGH") return settled ? CACHE_TTL : SETTLING_TTL;
  if (c === "MEDIUM") return TTL_MEDIUM;
  return TTL_LOW;
}

// ENGINE0-CONT §7.1: per-FIELD last-good store — one partial FRED batch must not erase
// unrelated history. Retention (30d) is diagnosis retention, NOT voting freshness: the
// evidence-tier carry windows in src/ttReadout.js independently enforce how long a stored
// observation may still vote. Records carry their REAL observation dates, so the readout
// layer classifies them honestly (HISTORICAL/MISSING) downstream.
const LG_PREFIX = "pulse:source:lastgood:";
const LG_TTL = 30 * 24 * 3600;

// ── FEAT-SNAP-SAFE: plausibility bands ──────────────────────────────────────
// The v3.1 honesty invariant enforced LIVENESS and PROVENANCE but never PLAUSIBILITY:
// a decimal-shifted upstream value passed every check, rendered with a green LIVE badge
// and cast a regime vote. Bands cover the fields a wrong number is ACTIONABLE on. An
// out-of-band value is dropped (→ mock/last-good), never rendered — being silent beats
// being confidently wrong. Deliberately wide: reject the impossible, not the unusual.
export const BANDS = {
  vix:          [1, 150],      // VIX high is 89.5 (2008); 150 is well past any real print
  tenYear:      [0, 20],       // 10Y: 1981 peak ~15.8%
  // 30Y: same band as the 10Y — the 1981 long-bond peak was ~15.2%. Wide enough to accept
  // anything the bond market has ever actually done, narrow enough to catch a decimal shift.
  thirtyYear:   [0, 20],
  // 10s30s term spread: deeply inverted (~-2pp) through to steep (~+4pp) covers every
  // observed regime; ±10 rejects only a parse fault. An INVERTED curve is the signal, not
  // an error, so the band must not exclude it (the negative-WTI rule).
  spread10s30s: [-10, 10],
  fedFunds:     [0, 25],
  mortgage30:   [0, 25],
  fearGreed:    [0, 100],      // index is defined 0-100
  spyPrice:     [1, 100000],
  spxIndex:     [1, 1000000],
  qqqPrice:     [1, 100000],
  wti:          [-100, 1000],  // NEGATIVE IS REAL: WTI settled -$37.63 on 2020-04-20
  btc:          [0, 100000000],
  cpiHeadline:  [-15, 30],     // YoY %; US deflation trough ~-10 (1932)
  cpiCore:      [-15, 30],
  pceHeadline:  [-15, 30],
  pceCore:      [-15, 30],
  unemployment: [0, 40],
  lfpr:         [20, 90],
  savings:      [0, 60],
  shillerPe:    [3, 100],      // was an inline guard in fetchShiller; centralized here
  creditSpread: [0, 30],
  // FEAT-CCC (v3.84): CCC-and-lower OAS — the junk TAIL. Record ~44pp (2008-12); 60 rejects
  // a decimal shift without excluding any print that has ever happened. ≤0 is a parse fault
  // for an OAS.
  creditTail:   [0, 60],
  // FEAT-SAHM (v3.84): a difference of unemployment-rate averages — ±a few tenths in normal
  // times, ~+9 at the 2020 spike. [-5, 10] rejects the impossible only.
  sahm:         [-5, 10],
  threeMonth:   [0, 25],       // 3-month bill: 1981 peak ~17%; same family as fedFunds
  // 10y–3m term spread: inverted is the SIGNAL (the classic recession lead), not a parse
  // fault — the same negative-WTI rule as spread10s30s above.
  spread10y3m:  [-10, 10],
  tokenBlendedMtok: [0, 10000],
  // NFCI is standardized to mean 0 / SD 1 over its full 1971– history. Its record high is
  // ~+3.3 (2008-10) and its record low ~-1.0, so ±5 rejects the impossible (a decimal shift,
  // a parse fault) without rejecting the unusual — the same rule that keeps negative WTI.
  nfci:         [-5, 5],
};
// True when v is absent (nothing to judge) or inside its band. Unbanded fields pass.
export function plausible(key, v) {
  const band = BANDS[key];
  if (!band) return true;
  if (v === undefined || v === null) return true;
  if (!Number.isFinite(v)) return false;
  return v >= band[0] && v <= band[1];
}
// Strip out-of-band values from an assembled live object. Returns the dropped keys so
// _diag can say WHY a field vanished instead of it silently reverting to mock.
export function applyBands(live) {
  const dropped = [];
  for (const k of Object.keys(live)) {
    if (!plausible(k, live[k])) { dropped.push(`${k}=${live[k]}`); delete live[k]; }
  }
  return dropped;
}

// ── FEAT-SNAP-SAFE: minimum viable snapshot ─────────────────────────────────
// The old gate was `fredCount >= 6`, which counts OUTPUT KEYS, not series — and one
// series (tenYear) emits exactly 6 (value, AsOf, D1, W1, M1, Series). So 1 of 15 FRED
// series succeeding locked a gutted snapshot in for the whole ET day. Worse, `spy` and
// `fred` hit the same host with the same key, so the two "independent" votes were one.
// Gate instead on the fields the product's central claim actually rests on: the regime
// engine's voters. Below quorum we still SERVE the degraded payload (mock-first still
// holds) but cache it only briefly, so the next visit retries instead of locking the day.
export const QUORUM_FIELDS = ["spyPrice", "vix", "tenYear", "fearGreed", "cpiHeadline", "shillerPe"];
export const QUORUM_MIN = 4;
export function quorum(live) {
  const present = QUORUM_FIELDS.filter((k) => Number.isFinite(live?.[k]));
  return { present, count: present.length, ok: present.length >= QUORUM_MIN,
           missing: QUORUM_FIELDS.filter((k) => !present.includes(k)) };
}

export async function onRequest(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;
  const isPublic = params.get("view") === "public";
  /* B3 (v3.59, re-audit MED-security): ?debug=1 exposed _diag (source health, key presence,
     cron outcomes) to ANYONE — operational data on a public endpoint. It now requires the
     DEBUG_TOKEN secret: honored only when the secret is SET and ?debug=<token> matches.
     Fail closed both ways — no secret configured means no _diag for anyone, and a bare
     ?debug=1 is inert. (Set via: npx wrangler pages secret put DEBUG_TOKEN.) */
  const debugParam = params.get("debug");
  const debug = !!(env.DEBUG_TOKEN && debugParam && debugParam === env.DEBUG_TOKEN);
  const publicize = (obj) => { if (debug) return obj; const { _diag, ...rest } = obj; return rest; };

  // Per-ET-day cache key: first load each morning fetches fresh (FRED has the
  // prior close settled overnight), every load the rest of the day is instant.
  // No cron needed — your morning visit is the refresh trigger.
  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  // SYNC HAZARD: this key version is duplicated in worker/cron.js (refreshSnapshot) and
  // functions/readout.json.js — no shared module spans them. Grep "pulse:snapshot:v" on every bump.
  const cacheKey = `pulse:snapshot:v15:${etDate}`; // v15: real 5-session VIX WoW (was mislabeled 1-day)

  // ── 1. KV Cache check ─────────────────────────────────────────────────
  try {
    const cached = await env.PULSE_CACHE?.get(cacheKey, "json");
    if (cached) {
      const payload = isPublic ? stripPrivate(cached) : cached;
      // FEAT-SNAP-SAFE: `session` describes the CURRENT market session — a pure function of
      // wall-clock time — so it must never be served from a per-day cache. Frozen, a 01:49 ET
      // cold fetch made the header read "PRE" straight through the close, while the 5-Whys
      // computed etSession() client-side and disagreed on the same page.
      // `lastRefresh` is deliberately NOT recomputed: it reports when the DATA was pulled,
      // so the cached value is the honest one. Everything else in `live` is data, kept as-is.
      const fresh = { ...payload, live: { ...payload.live, session: marketSession() } };
      // ?debug=1: attach the cron Worker's last warm/refresh outcome (pulse:cron:lastwarm)
      // so a silently-blocked 8am/10am warm is visible from a browser, not only wrangler tail.
      // Read fresh here — the copy frozen in the day's cached _diag would mask a later failure.
      if (debug) {
        try {
          const w = await env.PULSE_CACHE?.get("pulse:cron:lastwarm", "json");
          if (w) fresh._diag = { ...(fresh._diag || {}), cronLastWarm: w };
        } catch { /* diagnostic only */ }
      }
      return json(publicize({ ...fresh, cached: true }));
    }
  } catch {
    // KV unavailable — skip cache, fetch fresh
  }

  // ── 2. Build a complete candidate snapshot (phases live in buildSnapshot) ──
  const built = await buildSnapshot(env, { scope: "all" });
  const { snapshot, readout } = built;

  // ── 3. Publish only if NO WORSE than what the day's key already holds (§7.2) ──
  // On this GET path the key was a miss moments ago, so the compare is usually against
  // nothing — but a concurrent warm/refresh may have landed a better candidate in between,
  // and a partial rebuild must never replace it.
  const pub = await publishIfNoWorse(env, cacheKey, snapshot, readout);
  snapshot._diag.published = pub.published;
  snapshot._diag.improved = pub.improved;

  // ?debug=1: attach cron warm health AFTER the cache write, so the marker is always read
  // fresh at serve time and never frozen into the day's cached _diag.
  if (debug) {
    try {
      const w = await env.PULSE_CACHE?.get("pulse:cron:lastwarm", "json");
      if (w) snapshot._diag.cronLastWarm = w;
    } catch { /* diagnostic only */ }
  }

  // ── 4. Return (strip FMP/licensed fields if public view; _diag only on ?debug=1) ──
  return json(publicize(isPublic ? { ...stripPrivate(snapshot), cached: false } : snapshot));
}

// ─── ENGINE0-CONT: the candidate builder (shared by GET, POST /api/snapshot/refresh, cron) ──
// scope "all"      — every phase (the daily build).
// scope "critical" — only the Engine 0 gating sources (FRED macro incl. VIX/10Y, SP500,
//                    NASDAQ100, F&G, Kalshi); non-gating feeds (headline, tokenomics,
//                    equities, CAPE) are FILLED FROM priorLive so an operator recovering
//                    Engine 0 never waits on — or loses — the add-ons.
export async function buildSnapshot(env, { scope = "all", priorLive = null } = {}) {
  const all = scope !== "critical";
  const statuses = []; // per-upstream-item status records (§9) — protected diagnostics
  // Phase 1: FRED macro alone (critical series first at low concurrency inside fetchFred).
  const [fred] = await Promise.allSettled([fetchFred(env.FRED_KEY, statuses)]);
  // Phase 2: heavy SPY (265-pt) + light NASDAQ100 + scrapers — ≤5 concurrent, under the cap.
  const [spy, ndx, fearGreed, rateOdds, headline] = await Promise.allSettled([
    fetchSpy(env.FRED_KEY, statuses),      // SPY via FRED SP500 — Stooq blocks Cloudflare edge IPs
    fetchNdx(env.FRED_KEY, statuses),      // NASDAQ100 — the RS check's index leg (no Finnhub dependency)
    withLastGood(env, "feargreed", () => fetchFearGreed(statuses)),
    withLastGood(env, "rateodds", () => fetchRateOdds(statuses), rateOddsStillOpen),
    all ? withLastGood(env, "headline", fetchHeadline) : Promise.reject(new Error("skipped (critical scope)")),
  ]);
  // Phase 2.5: official Treasury par-yield fallback for the 10Y — ONLY when FRED's DGS10
  // leg failed. DGS10 *is* FRED's republication of this same Treasury par yield curve
  // (H.15), so the numbers are equivalent by construction; the attribution changes.
  let treasury = { status: "rejected", reason: "not needed" };
  if (fred.status !== "fulfilled" || fred.value.tenYear === undefined) {
    [treasury] = await Promise.allSettled([fetchTreasury10y(statuses)]);
  }
  // Phase 3 (scope "all" only): tokenomics moat + equities + CAPE — add-ons, never gating.
  const skipped = () => Promise.reject(new Error("skipped (critical scope)"));
  const [tokenomics, equities, shiller] = await Promise.allSettled(all ? [
    withLastGood(env, "tokenomics", () => fetchTokenomics(env)),
    withLastGood(env, "equities", () => fetchEquities(env, statuses)),
    withLastGood(env, "shiller", fetchShiller), // CAPE for the regime's valuation vote
  ] : [skipped(), skipped(), skipped()]);

  // ── Assemble live overlay (only fields with a valid value; mock covers the rest) ──
  const now = new Date().toISOString();
  const live = {
    lastRefresh: formatET(now),
    session:     marketSession(),
    ...(fred.status === "fulfilled" ? fred.value : {}),
    ...(treasury.status === "fulfilled" ? treasury.value : {}),
    ...(spy.status === "fulfilled" ? spy.value : {}),
    ...(fearGreed.status === "fulfilled" ? fearGreed.value : {}),
    ...(rateOdds.status === "fulfilled" ? rateOdds.value : {}),
    ...(headline.status === "fulfilled" ? headline.value : {}),
    ...(tokenomics.status === "fulfilled" ? tokenomics.value : {}),
    ...(equities.status === "fulfilled" ? equities.value : {}),
    ...(shiller.status === "fulfilled" ? shiller.value : {}),
  };

  // NASDAQ100 vs SP500 1-day relative strength — SAME-DATE-PAIRED (§5.3): a mismatched
  // observation pair (one index posted, the other not) yields NO RS value, never a
  // cross-day delta dressed as a 1-day read.
  const rs = pairRs(ndx.status === "fulfilled" ? ndx.value : null,
                    spy.status === "fulfilled" ? spy.value._spx1d : null);
  if (rs) { live.ndxSpxRs = rs.rs; live.ndxSpxRsAsOf = rs.asOf; live.ndx1dPct = rs.ndx1d; live.spx1dPct = rs.spx1d; }
  delete live._spx1d; // internal pairing payload — never cached or served

  // FEAT-SNAP-SAFE: drop implausible values BEFORE anything renders or caches them.
  const droppedByBand = applyBands(live);

  // ENGINE0-CONT §7.1: per-field last-good — write what succeeded, fall back for what
  // did not. Records keep their REAL observation dates, so a served fallback reads
  // HISTORICAL (or MISSING, past its carry window) at the evidence layer — never LIVE.
  await applyFieldLastGood(env, live);

  // scope "critical": everything the critical phases did not (re)fetch is carried from
  // the prior snapshot — a targeted Engine 0 recovery must not blank the dashboard.
  if (!all && priorLive && typeof priorLive === "object") {
    for (const [k, v] of Object.entries(priorLive)) {
      if (live[k] === undefined && k !== "lastRefresh" && k !== "session") live[k] = v;
    }
  }

  const snapshot = { live, asOf: now, cached: false };
  const okOf = (s, extra = "") => (s.status === "fulfilled" ? `ok${extra}` : String(s.reason));
  const diag = {
    hasFredKey: !!env.FRED_KEY,
    hasKV: !!env.PULSE_CACHE,
    scope,
    bandDropped: droppedByBand.length ? droppedByBand : "none",
    fred: okOf(fred, fred.status === "fulfilled" ? `:${Object.keys(fred.value).length}` : ""),
    spy: okOf(spy),
    ndx: okOf(ndx),
    treasury: treasury.reason === "not needed" ? "not needed" : okOf(treasury),
    fearGreed: okOf(fearGreed),
    rateOdds: okOf(rateOdds),
    headline: okOf(headline),
    tokenomics: okOf(tokenomics),
    equities: okOf(equities, equities.status === "fulfilled" ? `:${Object.keys(equities.value).length}` : ""),
    shiller: okOf(shiller),
    // §9: per-upstream-item detail (http status / error class / attempts / latency) —
    // debug-token-gated like the rest of _diag; never in the public body.
    sources: statuses,
  };
  snapshot._diag = diag;

  // Legacy health markers (kept for continuity; the TTL now rides readout confidence).
  const q = quorum(live);
  const spyAsOf = live.spyPriceAsOf ?? null;
  snapshot._diag.healthy = q.ok;
  snapshot._diag.settled = q.ok && !looksBehind(spyAsOf, new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  snapshot._diag.quorum = `${q.count}/${QUORUM_FIELDS.length}` + (q.missing.length ? ` missing:${q.missing.join(",")}` : "");

  // The candidate's own readout — computed BEFORE any publish decision (§7.2).
  const readout = buildTtReadout(live, {});
  return { snapshot, readout, statuses };
}

// §7.2: publish a candidate to the day's key only if it is AT LEAST AS GOOD as what is
// already stored (lexicographic quality tuple from src/ttReadout.js; asOf epoch is the
// final tiebreak so an equal-quality newer candidate wins). A worse rebuild is returned
// to the caller for diagnosis but never replaces the better stored snapshot.
export async function publishIfNoWorse(env, cacheKey, snapshot, readout) {
  let existingQ = null;
  try {
    const existing = await env.PULSE_CACHE?.get(cacheKey, "json");
    if (existing && existing.live) {
      const exReadout = buildTtReadout(existing.live, { cached: true });
      existingQ = readoutQuality(exReadout, Date.parse(existing.asOf) || 0);
    }
  } catch { /* unreadable existing — treat as absent */ }
  const candQ = readoutQuality(readout, Date.parse(snapshot.asOf) || 0);
  if (existingQ && compareQuality(candQ, existingQ) < 0) {
    return { published: false, improved: false, reason: "candidate worse than stored snapshot — retained the prior snapshot" };
  }
  // improved = better on an EVIDENCE axis (not merely newer — the tiebreak is not improvement).
  const improved = !existingQ || compareQuality(candQ.slice(0, 6), existingQ.slice(0, 6)) > 0;
  try {
    await env.PULSE_CACHE?.put(cacheKey, JSON.stringify(snapshot), {
      expirationTtl: chooseTtl(readout, snapshot._diag ? snapshot._diag.settled !== false : true),
    });
  } catch {
    return { published: false, improved: false, reason: "KV write failed" };
  }
  return { published: true, improved };
}

// ─── resilient fetch: retries + generous timeout (mirrors the cron worker) ──
// ENGINE0-CONT §9: instrumented. Exponential backoff + jitter on 429/5xx (never an
// immediate hammer-retry into a rate limit); the thrown error carries http_status,
// error_class, attempts and latency_ms so callers can record REAL evidence of the miss
// instead of discarding it — the deployed code's per-series errors were unrecoverable.
function classifyError(e, httpStatus) {
  if (httpStatus === 429) return "rate_limit";
  if (httpStatus != null) return "http";
  const msg = String((e && e.name) || "") + String((e && e.message) || "");
  if (/Timeout|Abort/i.test(msg)) return "timeout";
  if (/JSON|parse/i.test(msg)) return "parse";
  return "network";
}
async function fetchRetry(url, opts = {}, attempts = 2, timeoutMs = 9000) {
  const started = Date.now();
  let lastErr, lastStatus = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0 && (lastStatus === 429 || (lastStatus != null && lastStatus >= 500) || lastStatus === null)) {
      // 500ms · 1s · 2s … + up to 250ms jitter — bounded so the phase budget survives.
      await new Promise((r) => setTimeout(r, Math.min(4000, 500 * 2 ** (i - 1)) + Math.random() * 250));
    }
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) { lastStatus = r.status; throw new Error(`HTTP ${r.status}`); }
      r._attempts = i + 1; r._latencyMs = Date.now() - started;
      return r;
    } catch (e) { lastErr = e; }
  }
  const err = lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  err.http_status = lastStatus;
  err.error_class = classifyError(err, lastStatus);
  err.attempts = attempts;
  err.latency_ms = Date.now() - started;
  throw err;
}
// One status record per upstream item (§9) — pushed into the per-build collector.
function recordStatus(statuses, source, item, okOrErr, extra = {}) {
  if (!Array.isArray(statuses)) return;
  if (okOrErr === true) statuses.push({ source, item, ok: true, ...extra });
  else statuses.push({
    source, item, ok: false,
    http_status: okOrErr?.http_status ?? null,
    error_class: okOrErr?.error_class ?? classifyError(okOrErr, okOrErr?.http_status ?? null),
    message: String(okOrErr?.message ?? okOrErr),
    attempts: okOrErr?.attempts ?? 1,
    latency_ms: okOrErr?.latency_ms ?? null,
    observed_at: null, ...extra,
  });
}

// ─── FRED fetcher ─────────────────────────────────────────────────────────
async function fetchFred(key, statuses = null) {
  if (!key) throw new Error("FRED_KEY not set");

  const series = {
    tenYear:      "DGS10",
    /* FEAT-30Y (v3.55): the LONG END. This is NOT the TLT rejection (v3.43) replayed — TLT
       was refused because it is a monotonic transform of the 10Y already displayed. DGS30 is
       not derivable from DGS10: the 10s30s spread is the term-premium / fiscal-risk gauge,
       and "long end breaking out while the Fed holds" is a different transmission channel
       from "the whole curve moved". 17 series now = one more batch of 5, which is exactly
       why the phase batching must not be collapsed. */
    thirtyYear:   "DGS30",
    // FEAT-SAHM/FEAT-CCC (v3.84): 19 series = one extra 2-wide tail batch (2+5+5+5+2). The
    // critical head (VIX/DGS10 first at concurrency 2) is untouched; the tail only delays
    // dashboard-grade fields, never the order-gating ones.
    threeMonth:   "DGS3MO",     // 3-month bill — the short leg of the 10y–3m recession lead
    fedFunds:     "FEDFUNDS",
    cpiHeadline:  "CPIAUCSL",   // CPI index  → YoY % below
    cpiCore:      "CPILFESL",   // core CPI index → YoY %
    pceHeadline:  "PCEPI",      // PCE index  → YoY %  (Fed's preferred gauge)
    pceCore:      "PCEPILFE",   // core PCE index → YoY %
    unemployment: "UNRATE",
    lfpr:         "CIVPART",
    savings:      "PSAVERT",    // Personal Saving Rate (% of disposable income) — household cushion
    mortgage30:   "MORTGAGE30US",
    wti:          "DCOILWTICO",
    vix:          "VIXCLS",
    btc:          "CBBTCUSD",
    hySpread:     "BAMLH0A0HYM2",  // ICE BofA US HY OAS — daily credit risk gauge
    igSpread:     "BAMLC0A0CM",    // ICE BofA US IG OAS — investment-grade counterpart
    /* FEAT-CCC (v3.84): the junk TAIL. AI-infra debt (the CRWV-class neocloud complex) is
       rated single-B/CCC, and the tail widens FIRST while the broad HY index still looks
       calm — the funding-pipe stress gauge for exactly the buildout this book is long.
       Passes the v3.43 sorting rule the same way NFCI did: Yahoo shows the level; it does
       not judge it, abstain when stale, or pair it with the transmission story. */
    creditTail:   "BAMLH0A3HYC",   // ICE BofA CCC & Lower US HY OAS
    // FEAT-NFCI (v3.43): Chicago Fed National Financial Conditions Index. WEEKLY (released
    // Wednesday for the week ending the prior Friday). 105 underlying measures across money
    // markets, debt/equity markets and the banking system — standardized so that ZERO is the
    // historical average by construction, POSITIVE = tighter than average, NEGATIVE = looser.
    // Chosen over TLT/2s10s as the single highest-leverage addition: it is the one free series
    // that restates this dashboard's own thesis question ("is it safe to be in the market?")
    // as a number, and it is effectively absent from retail finance sites.
    nfci:         "NFCI",
  };
  // FEAT-R10: these arrive as a price INDEX; the dashboard wants year-over-year %.
  // We pull enough monthly history to derive YoY (latest vs 12 months prior) plus a
  // 6-point YoY trend (obs[m] vs obs[m+12]).
  const INFLATION = new Set(["cpiHeadline", "cpiCore", "pceHeadline", "pceCore"]);

  // Fetch FRED series in batches — even alone, 10 parallel exceeds the ~6-connection
  // cap, so a queued call's timeout fires before it gets a socket. ENGINE0-CONT §9:
  // the Engine 0 CRITICAL series (VIX, DGS10) go FIRST at concurrency 2, so a
  // rate-limited or slow FRED degrades the dashboard-only tail, never the order-gating
  // head; the rest follow in batches of 5 as before. Every series records a status.
  const CRITICAL_SERIES = new Set(["vix", "tenYear"]);
  const entries = [...Object.entries(series)].sort(
    (a, b) => (CRITICAL_SERIES.has(b[0]) ? 1 : 0) - (CRITICAL_SERIES.has(a[0]) ? 1 : 0));
  const results = [];
  for (let i = 0; i < entries.length; i += (i < CRITICAL_SERIES.size ? 2 : 5)) {
    const batchSize = i < CRITICAL_SERIES.size ? 2 : 5;
    const settled = await Promise.allSettled(
      entries.slice(i, i + batchSize).map(async ([field, id]) => {
        // Inflation series need ~18 monthly points to derive a 6-point YoY trend.
        // Other series: 26 points so DAILY fields can derive a 1-week (idx[5]) and
        // 1-month (idx[21]) change off the same pull — zero extra fetches. Payload
        // is trivially small either way.
        const limit = INFLATION.has(field) ? 20 : 26;
        const url = `https://api.stlouisfed.org/fred/series/observations`
          + `?series_id=${id}&api_key=${key}&limit=${limit}&sort_order=desc&file_type=json`;
        let r, d;
        try {
          r = await fetchRetry(url, {}, 2, 9000);
          d = await r.json();
        } catch (e) {
          recordStatus(statuses, "fred", id, e); // §9: the miss is EVIDENCE, kept per series
          throw e;
        }
        const obs = d.observations?.filter(o => o.value !== ".") ?? [];
        recordStatus(statuses, "fred", id,
          obs.length ? true : Object.assign(new Error("no_observation"), { error_class: "no_observation", attempts: r._attempts }),
          obs.length ? { attempts: r._attempts, latency_ms: r._latencyMs, observed_at: obs[0]?.date ?? null } : {});
        if (INFLATION.has(field)) {
          // Convert index → YoY %: (this month / 12 months ago − 1) × 100.
          const yoyAt = (m) => {
            const a = parseFloat(obs[m]?.value), b = parseFloat(obs[m + 12]?.value);
            return (isFinite(a) && isFinite(b) && b > 0) ? parseFloat(((a / b - 1) * 100).toFixed(1)) : NaN;
          };
          const yoy = yoyAt(0);
          const trend = [];
          for (let m = 5; m >= 0; m--) { const v = yoyAt(m); if (isFinite(v)) trend.push(v); } // oldest→newest
          return [field, yoy, NaN, trend, obs[0]?.date, NaN, NaN];
        }
        const vals  = obs.map(o => parseFloat(o.value)).filter(v => !isNaN(v));
        const latest = vals[0];
        const prev   = vals[1];
        const wAgo   = vals[5];   // ~1 trading week back (DAILY fields only)
        const mAgo   = vals[21];  // ~1 trading month back (DAILY fields only)
        // Series of last 10 for sparkline (newest last)
        const spark  = vals.slice(0, 10).reverse();
        // FEAT-SAHM (v3.84): computed HERE because only 10 of the 26 monthly points escape
        // this closure via `spark`, and the rule needs 15. The math lives in src/sahm.js
        // (one home, Node-testable); the 8th tuple member is an extras object every other
        // series omits — the destructure downstream tolerates undefined.
        if (field === "unemployment") {
          const s = sahmFrom(vals);
          return [field, latest, prev, spark, obs[0]?.date, wAgo, mAgo,
            s === null ? undefined : { sahm: s, sahmAsOf: obs[0]?.date }];
        }
        return [field, latest, prev, spark, obs[0]?.date, wAgo, mAgo];
      })
    );
    results.push(...settled);
  }

  // DAILY-frequency fields only: idx[5]/idx[21] are ~1wk/~1mo back. Applying these
  // offsets to a MONTHLY series (FEDFUNDS, UNRATE…) would mean 5/21 *months* — garbage.
  // So w1/m1 derivation is gated to true daily series. threeMonth (DGS3MO) is genuinely
  // daily (the 30Y precedent); creditTail's legs-family (hySpread/igSpread) is not listed,
  // so the tail follows its family: D1-only.
  const DAILY = new Set(["tenYear", "thirtyYear", "threeMonth", "wti", "btc", "vix"]);
  // Percent-change helper (for price-like fields); rates use absolute yield deltas.
  // A zero base divides to Infinity; a NEGATIVE base inverts the sign, so a recovery
  // renders as a decline — and WTI really did settle at -$37.63 on 2020-04-20.
  // Return NaN instead: callers already drop non-finite values.
  const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0)
    ? parseFloat((((a - b) / b) * 100).toFixed(2)) : NaN;

  const out = {};
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const [field, latest, prev, spark, asOf, wAgo, mAgo, extra] = r.value;
    if (isNaN(latest)) continue;
    out[field] = latest;
    out[field + "AsOf"] = asOf; // FEAT-R2: observation date, for per-tile freshness
    // FEAT-SAHM (v3.84): per-series extras computed inside the fetch closure (where the
    // full 26-point pull is in scope) ride the 8th tuple slot; today only unemployment
    // emits one ({sahm, sahmAsOf} — its own AsOf, the creditSpread PRIMARY_ASOF pattern).
    if (extra && typeof extra === "object") Object.assign(out, extra);
    const daily = DAILY.has(field);
    // Derived deltas for specific fields. 10Y = absolute yield Δ (pp); WTI/BTC = % Δ.
    if (field === "tenYear") {
      if (!isNaN(prev)) out.tenYearD1 = parseFloat((latest - prev).toFixed(4));
      if (daily && !isNaN(wAgo)) out.tenYearW1 = parseFloat((latest - wAgo).toFixed(4));
      if (daily && !isNaN(mAgo)) out.tenYearM1 = parseFloat((latest - mAgo).toFixed(4));
    }
    // 30Y: absolute yield deltas, same convention as the 10Y (rates move in pp, not %).
    if (field === "thirtyYear") {
      if (!isNaN(prev)) out.thirtyYearD1 = parseFloat((latest - prev).toFixed(4));
      if (daily && !isNaN(wAgo)) out.thirtyYearW1 = parseFloat((latest - wAgo).toFixed(4));
      if (daily && !isNaN(mAgo)) out.thirtyYearM1 = parseFloat((latest - mAgo).toFixed(4));
      if (Array.isArray(spark)) out._thirtySparkline = spark;
    }
    if (field === "tenYear" && Array.isArray(spark)) out._tenSparkline = spark;
    if (field === "vix") {
      // Real week-over-week: latest vs ~5 trading sessions ago (the tile labels it "WoW").
      // Falls back to the 1-day prior only if the 5-session point isn't available.
      const base = (daily && isFinite(wAgo) && wAgo > 0) ? wAgo : prev;
      if (isFinite(base) && base > 0) out.vixWeekChg = parseFloat((((latest - base) / base) * 100).toFixed(2));
    }
    if (field === "wti") {
      if (!isNaN(prev)) out.wtiD1 = pct(latest, prev);
      if (daily && !isNaN(wAgo)) out.wtiW1 = pct(latest, wAgo);
      if (daily && !isNaN(mAgo)) out.wtiM1 = pct(latest, mAgo);
    }
    if (field === "btc") {
      if (!isNaN(prev)) out.btcD1 = pct(latest, prev);
      if (daily && !isNaN(wAgo)) out.btcW1 = pct(latest, wAgo);
      if (daily && !isNaN(mAgo)) out.btcM1 = pct(latest, mAgo);
    }
    // Unemployment: emit a 6-pt trend (oldest→newest) from the monthly UNRATE series.
    if (field === "unemployment") out.unemploymentTrend = spark.slice(-6);
    // Personal saving rate: 6-pt monthly trend (oldest→newest).
    if (field === "savings") out.savingsTrend = spark.slice(-6);
    if (field === "tenYear") out.tenYearSeries = spark;
    if (field === "vix")     out.vixSeries     = spark;
    // Inflation: `spark` here is the 6-point YoY trend computed in the fetcher.
    if (field === "cpiHeadline") out.cpiTrend = spark;
    if (field === "pceHeadline") out.pceTrend = spark;
    // FEAT-NFCI (v3.43): a WEEKLY series, so `prev` (vals[1]) is genuinely one week back —
    // the W1 suffix is accurate here, unlike the D1 the daily fields use. NOT in the DAILY
    // set, so the idx[5]/idx[21] offsets are correctly never applied to it.
    if (field === "nfci") {
      if (!isNaN(prev)) out.nfciW1 = parseFloat((latest - prev).toFixed(3));
      out.nfciSeries = spark;   // ~10 weeks
    }
    // Credit spreads: capture D1 and intermediate series for cross-field derivation below.
    if (field === "hySpread") {
      if (!isNaN(prev)) out.hySpreadD1 = parseFloat((latest - prev).toFixed(4));
      out._hySparkline = spark; // temp: used to derive creditSpreadSeries
    }
    if (field === "igSpread") {
      if (!isNaN(prev)) out.igSpreadD1 = parseFloat((latest - prev).toFixed(4));
      out._igSparkline = spark; // temp
    }
    // FEAT-CCC (v3.84): the junk tail — direct emission (own AsOf), D1 + series, following
    // its hySpread/igSpread family: absolute pp deltas, no W1/M1 (not in DAILY).
    if (field === "creditTail") {
      if (!isNaN(prev)) out.creditTailD1 = parseFloat((latest - prev).toFixed(4));
      out.creditTailSeries = spark;
    }
    // FEAT-SAHM (v3.84): the short leg of 10y–3m. Level + temp sparkline only — nothing
    // renders a 3-month D1, and the spread below carries the decision content.
    if (field === "threeMonth") out._threeMoSparkline = spark;
  }

  /* Derive the 10s30s term spread (FEAT-30Y). Steepening with the long end leading is the
     fiscal/term-premium signature — a different thing from a parallel shift, and the reason
     the 30Y earns a series of its own rather than riding the 10Y. Absolute pp, like its
     inputs. Sparkline is derived pointwise, same pattern as creditSpreadSeries. */
  if (out.tenYear !== undefined && out.thirtyYear !== undefined) {
    out.spread10s30s = parseFloat((out.thirtyYear - out.tenYear).toFixed(3));
    out.spread10s30sAsOf = out.thirtyYearAsOf || out.tenYearAsOf;
    if (Array.isArray(out._thirtySparkline) && Array.isArray(out._tenSparkline)) {
      const n = Math.min(out._thirtySparkline.length, out._tenSparkline.length);
      out.spread10s30sSeries = Array.from({length: n}, (_, i) =>
        parseFloat((out._thirtySparkline[i] - out._tenSparkline[i]).toFixed(3)));
    }
  }
  /* Derive the 10y–3m term spread (FEAT-SAHM, v3.84) — the classic recession lead (the
     NY Fed's own model basis). Derived from LEGS rather than FRED's precomputed T10Y3M so
     two-leg staleness stays honest: a stale leg blinds the spread instead of a precomputed
     number wearing a fresh date. Absolute pp; inversion is the signal (negative-WTI rule). */
  if (out.tenYear !== undefined && out.threeMonth !== undefined) {
    out.spread10y3m = parseFloat((out.tenYear - out.threeMonth).toFixed(3));
    out.spread10y3mAsOf = out.tenYearAsOf || out.threeMonthAsOf;
    if (Array.isArray(out._tenSparkline) && Array.isArray(out._threeMoSparkline)) {
      const n = Math.min(out._tenSparkline.length, out._threeMoSparkline.length);
      out.spread10y3mSeries = Array.from({length: n}, (_, i) =>
        parseFloat((out._tenSparkline[i] - out._threeMoSparkline[i]).toFixed(3)));
    }
  }
  delete out._thirtySparkline;
  delete out._tenSparkline;
  delete out._threeMoSparkline;

  // Derive HY-IG credit spread — the single highest-value cross-field metric.
  // Widening = bearish leading indicator (inverse correlation to S&P 500).
  if (out.hySpread !== undefined && out.igSpread !== undefined) {
    out.creditSpread    = parseFloat((out.hySpread - out.igSpread).toFixed(2));
    out.creditSpreadAsOf = out.hySpreadAsOf;
    if (out.hySpreadD1 !== undefined && out.igSpreadD1 !== undefined) {
      out.creditSpreadD1 = parseFloat((out.hySpreadD1 - out.igSpreadD1).toFixed(4));
    }
    if (Array.isArray(out._hySparkline) && Array.isArray(out._igSparkline)) {
      const n = Math.min(out._hySparkline.length, out._igSparkline.length);
      out.creditSpreadSeries = Array.from({length: n}, (_, i) =>
        parseFloat((out._hySparkline[i] - out._igSparkline[i]).toFixed(2))
      );
    }
    delete out._hySparkline;
    delete out._igSparkline;
  }

  return out;
}

// ─── SPY fetcher (via FRED SP500) ─────────────────────────────────────────
// Stooq blocks Cloudflare edge IPs, so we source SPY from FRED's SP500 index.
// SPY ≈ S&P 500 index / 10 (the ETF was designed at ~1/10th of the index).
// This reuses the proven-working FRED path (same key as VIX/10Y which already work).
async function fetchSpy(key, statuses = null) {
  if (!key) throw new Error("FRED_KEY not set");
  // 265 obs (~1yr + buffer) so the prior Dec 31 is always in the window for
  // any month of the year (220 misses Nov–Dec; 265 is safe year-round).
  const url = `https://api.stlouisfed.org/fred/series/observations`
    + `?series_id=SP500&api_key=${key}&limit=265&sort_order=desc&file_type=json`;
  let r, d;
  try {
    r = await fetchRetry(url, {}, 2, 9000);
    d = await r.json();
  } catch (e) { recordStatus(statuses, "fred", "SP500", e); throw e; }

  // FRED returns "." for non-trading days — filter them. Newest first (desc).
  const validObs = (d.observations ?? []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
  const idx = validObs.map(o => parseFloat(o.value));

  if (idx.length < 2) throw new Error("SP500 no data");

  const toSpy = (v) => parseFloat((v / 10).toFixed(2)); // index → SPY proxy
  const latest = idx[0], prev = idx[1];
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const ma100 = idx.length >= 100 ? toSpy(avg(idx.slice(0, 100))) : null;
  const ma200 = idx.length >= 200 ? toSpy(avg(idx.slice(0, 200))) : null;

  // True YTD anchor = most recent Dec 31 (last trading day of prior year).
  // validObs is newest-first, so the first entry with year < currentYear is
  // the most recent prior-year close. Fall back to oldest-in-window if not found.
  const currentYear = new Date().getFullYear().toString();
  let ytdBase = idx[idx.length - 1]; // fallback
  for (let j = 0; j < validObs.length; j++) {
    if ((validObs[j].date ?? "").slice(0, 4) < currentYear) {
      ytdBase = parseFloat(validObs[j].value);
      break;
    }
  }

  // 20-day sparkline, oldest→newest, in SPY scale
  const series = idx.slice(0, 20).reverse().map(toSpy);

  recordStatus(statuses, "fred", "SP500", true, { attempts: r._attempts, latency_ms: r._latencyMs, observed_at: validObs[0]?.date ?? null });
  return {
    spyPrice:     toSpy(latest),
    spyChangePct: parseFloat((((latest - prev) / prev) * 100).toFixed(2)),
    spyYtd:       parseFloat((((latest - ytdBase) / ytdBase) * 100).toFixed(2)),
    spySeries:    series,
    spxIndex:     Math.round(latest),   // FEAT-202: raw S&P 500 index, now live (same SP500 pull — $0, zero extra fetch)
    spxPrevClose: Math.round(prev),
    spyPriceAsOf: validObs[0]?.date, spxIndexAsOf: validObs[0]?.date, // FEAT-R2: SP500 observation date
    ...(ma100 !== null ? { spyMa100: ma100 } : {}),
    ...(ma200 !== null ? { spyMa200: ma200 } : {}),
    // ENGINE0-CONT §5.3: internal pairing payload for the NASDAQ100/SP500 relative-strength
    // derivation — stripped from `live` before caching/serving (see buildSnapshot).
    _spx1d: { latest, prev, latestDate: validObs[0]?.date ?? null, prevDate: validObs[1]?.date ?? null },
  };
}

// ─── NASDAQ100 fetcher (ENGINE0-CONT §5.3) ────────────────────────────────
// The RS check's index leg — FRED NASDAQ100 daily closes, replacing the order-gating
// dependency on Finnhub's QQQ quote (Finnhub stays for display-only marks). 8 obs is
// plenty for a latest/prior pair across holidays.
async function fetchNdx(key, statuses = null) {
  if (!key) throw new Error("FRED_KEY not set");
  const url = `https://api.stlouisfed.org/fred/series/observations`
    + `?series_id=NASDAQ100&api_key=${key}&limit=8&sort_order=desc&file_type=json`;
  let r, d;
  try {
    r = await fetchRetry(url, {}, 2, 9000);
    d = await r.json();
  } catch (e) { recordStatus(statuses, "fred", "NASDAQ100", e); throw e; }
  const validObs = (d.observations ?? []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
  if (validObs.length < 2) {
    recordStatus(statuses, "fred", "NASDAQ100", Object.assign(new Error("no_observation"), { error_class: "no_observation" }));
    throw new Error("NASDAQ100 no data");
  }
  recordStatus(statuses, "fred", "NASDAQ100", true, { attempts: r._attempts, latency_ms: r._latencyMs, observed_at: validObs[0].date });
  return { latest: parseFloat(validObs[0].value), prev: parseFloat(validObs[1].value),
           latestDate: validObs[0].date, prevDate: validObs[1].date };
}

// PURE (exported for smoke): same-date pairing of the two index legs. Both the latest AND
// the prior observation dates must match — otherwise one leg's stale close would masquerade
// as a 1-day relative read. Returns null (no RS emitted) on any mismatch or bad input.
export function pairRs(ndx, spx) {
  if (!ndx || !spx) return null;
  const nums = [ndx.latest, ndx.prev, spx.latest, spx.prev];
  if (!nums.every((v) => Number.isFinite(v) && v > 0)) return null;
  if (!ndx.latestDate || ndx.latestDate !== spx.latestDate || !ndx.prevDate || ndx.prevDate !== spx.prevDate) return null;
  const p = (a, b) => parseFloat((((a - b) / b) * 100).toFixed(2));
  const ndx1d = p(ndx.latest, ndx.prev), spx1d = p(spx.latest, spx.prev);
  return { rs: parseFloat((ndx1d - spx1d).toFixed(2)), ndx1d, spx1d, asOf: ndx.latestDate };
}

// ─── Treasury 10Y fallback (ENGINE0-CONT §5.4) ────────────────────────────
// U.S. Treasury Daily Par Yield Curve — the OFFICIAL upstream FRED's DGS10 republishes
// (H.15 par yields), so the level is equivalent by construction; only the attribution
// changes. Invoked ONLY when FRED's DGS10 leg failed. The year CSV carries the full
// year-to-date history, so the same D1/W1/M1 deltas derive from one pull.
export function parseTreasuryCsv(csv) {
  const lines = String(csv || "").trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(",").map((s) => s.replace(/"/g, "").trim());
  const dateIdx = header.findIndex((h) => /^date$/i.test(h));
  const tenIdx = header.findIndex((h) => /^10\s*Yr$/i.test(h));
  if (dateIdx < 0 || tenIdx < 0) return null;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((s) => s.replace(/"/g, "").trim());
    const v = parseFloat(cells[tenIdx]);
    const dm = (cells[dateIdx] || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!Number.isFinite(v) || !dm) continue;
    rows.push({ date: `${dm[3]}-${dm[1].padStart(2, "0")}-${dm[2].padStart(2, "0")}`, v });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first, like FRED desc
  const latest = rows[0], prev = rows[1], wAgo = rows[5], mAgo = rows[21];
  const out = { tenYear: latest.v, tenYearAsOf: latest.date, tenYearSource: "UST par yield curve" };
  if (prev) out.tenYearD1 = parseFloat((latest.v - prev.v).toFixed(4));
  if (wAgo) out.tenYearW1 = parseFloat((latest.v - wAgo.v).toFixed(4));
  if (mAgo) out.tenYearM1 = parseFloat((latest.v - mAgo.v).toFixed(4));
  const spark = rows.slice(0, 10).map((r2) => r2.v).reverse();
  if (spark.length) out.tenYearSeries = spark;
  return out;
}
async function fetchTreasury10y(statuses = null) {
  const year = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).slice(0, 4);
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&_format=csv`;
  let r, csv;
  try {
    r = await fetchRetry(url, { headers: { Accept: "text/csv,*/*" } }, 2, 9000);
    csv = await r.text();
  } catch (e) { recordStatus(statuses, "treasury", "daily_treasury_yield_curve", e); throw e; }
  const out = parseTreasuryCsv(csv);
  if (!out) {
    recordStatus(statuses, "treasury", "daily_treasury_yield_curve", Object.assign(new Error("parse failed"), { error_class: "parse" }));
    throw new Error("Treasury CSV parse failed");
  }
  recordStatus(statuses, "treasury", "daily_treasury_yield_curve", true, { attempts: r._attempts, latency_ms: r._latencyMs, observed_at: out.tenYearAsOf });
  return out;
}

// ─── CNN Fear & Greed scraper ─────────────────────────────────────────────
// FIX (2026-06-04): 418 was bot-detection from a too-thin request. CNN's edge
// rejects requests missing a full browser UA + Accept + Origin/Referer triad.
// Working pattern (confirmed against TrendSpider + Part-Time Larry, current):
//   - full desktop Chrome User-Agent (not bare "Mozilla/5.0")
//   - Accept: application/json
//   - Origin + Referer = edition.cnn.com
//   - date-suffixed path /graphdata/YYYY-MM-DD (the bare path 418s more often)
// ─── FEAT-R8: scraper resilience (last-good fallback) ─────────────────────
// Wrap a flaky scraper so a failed fetch doesn't silently revert the tile to mock.
// On success we persist the result as the per-source "last good" (7-day TTL); on
// failure we serve that last good instead — it keeps its original observation date,
// so the dashboard's isStale() check flags it STALE automatically. If there is no
// last good either, we re-throw and the field falls back to mock (invariant holds).
// ENGINE0-CONT: optional `validate(lg)` gates the FALLBACK read — a stored last-good that
// no longer describes a live question (e.g. Kalshi odds for a meeting that has since
// happened) is discarded rather than served (§5.6 / matrix G).
async function withLastGood(env, key, fetcher, validate = null) {
  const lgKey = `pulse:lastgood:${key}`;
  try {
    const fresh = await fetcher();
    if (fresh && Object.keys(fresh).length) {
      try { await env.PULSE_CACHE?.put(lgKey, JSON.stringify(fresh), { expirationTtl: 7 * 24 * 3600 }); } catch {}
    }
    return fresh;
  } catch (err) {
    try {
      const lg = await env.PULSE_CACHE?.get(lgKey, "json");
      if (lg && Object.keys(lg).length && (!validate || validate(lg))) return lg; // stale but real — beats mock
    } catch {}
    throw err;
  }
}

// Matrix G guard: last-good FOMC odds are servable ONLY while their referenced event is
// still in the future — odds from a decided meeting must never carry into the next one.
export function rateOddsStillOpen(lg, now = new Date()) {
  const d = lg && typeof lg.nextFomcDate === "string" ? lg.nextFomcDate.slice(0, 10) : null;
  if (!d) return false;
  return d >= now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ENGINE0-CONT §7.1: per-FIELD last-good for the FRED-sourced Engine 0 criticals (the
// scrapers already ride withLastGood above). Grouped by source pull so a value never
// travels without its observation date and derivatives; each group's PRIMARY key decides
// presence. The group PRIMARY is band-checked on the way back in, so an implausible stored
// vix/tenYear/spyPrice/ndxSpxRs stays dropped. KNOWN GAP, stated rather than implied away:
// this restore runs AFTER applyBands(), and only the primary is re-checked — a group whose
// primary is plausible but whose DERIVATIVE is not (a poisoned vixWeekChg, a tenYearM1
// written before a band was tightened) is served unbanded. Closing it means either banding
// the whole restored group or moving applyBands() after this call; deliberately deferred,
// because reordering the band pass touches every field, not just the restored ones.
const FIELD_LG_GROUPS = {
  vix:        ["vix", "vixAsOf", "vixWeekChg", "vixSeries"],
  tenyear:    ["tenYear", "tenYearAsOf", "tenYearD1", "tenYearW1", "tenYearM1", "tenYearSeries", "tenYearSource"],
  spy:        ["spyPrice", "spyPriceAsOf", "spyChangePct", "spyYtd", "spySeries", "spyMa100", "spyMa200", "spxIndex", "spxIndexAsOf", "spxPrevClose"],
  ndx_spx_rs: ["ndxSpxRs", "ndxSpxRsAsOf", "ndx1dPct", "spx1dPct"],
};
const FIELD_LG_PRIMARY = { vix: "vix", tenyear: "tenYear", spy: "spyPrice", ndx_spx_rs: "ndxSpxRs" };
async function applyFieldLastGood(env, live) {
  for (const [group, keys] of Object.entries(FIELD_LG_GROUPS)) {
    const primary = FIELD_LG_PRIMARY[group];
    if (live[primary] !== undefined) {
      // Success path: persist the group (with its real dates) for the next outage.
      const rec = {};
      for (const k of keys) if (live[k] !== undefined) rec[k] = live[k];
      try { await env.PULSE_CACHE?.put(LG_PREFIX + group, JSON.stringify({ schema: 1, stored_at: new Date().toISOString(), fields: rec }), { expirationTtl: LG_TTL }); } catch {}
      continue;
    }
    // Miss path: serve the last official observation — its REAL date rides along, so the
    // evidence layer downstream classifies it HISTORICAL (or MISSING past its carry window).
    try {
      const lg = await env.PULSE_CACHE?.get(LG_PREFIX + group, "json");
      const rec = lg && lg.fields;
      if (rec && Number.isFinite(rec[primary]) && plausible(primary, rec[primary])) {
        for (const k of keys) if (rec[k] !== undefined && live[k] === undefined) live[k] = rec[k];
      }
    } catch { /* no last good — the field stays absent, mock-first covers it */ }
  }
}

async function fetchFearGreed(statuses = null) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const url = `https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${day}`;
  const started = Date.now();
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Origin": "https://edition.cnn.com",
      "Referer": "https://edition.cnn.com/markets/fear-and-greed",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) {
    recordStatus(statuses, "cnn", "fear_greed", Object.assign(new Error(`F&G ${r.status}`), { http_status: r.status, latency_ms: Date.now() - started }));
    throw new Error(`F&G ${r.status}`);
  }
  const d = await r.json();
  // Current value lives in fear_and_greed.score; historical points in
  // fear_and_greed_historical.data[].y — prefer the live score, fall back to
  // the newest historical point.
  const hist = d?.fear_and_greed_historical?.data;
  const histLatest = Array.isArray(hist) && hist.length ? hist[hist.length - 1]?.y : undefined;
  const raw = d?.fear_and_greed?.score ?? d?.score ?? histLatest;
  // `Number("") === 0` and `isNaN(0) === false`, so a BLANK score used to sail through as
  // fearGreed: 0 → "Extreme Fear" → a bear vote in the regime engine. Require real digits.
  if (raw == null || String(raw).trim() === "" || !Number.isFinite(Number(raw))) {
    recordStatus(statuses, "cnn", "fear_greed", Object.assign(new Error("F&G parse failed"), { error_class: "parse", latency_ms: Date.now() - started }));
    throw new Error("F&G parse failed");
  }
  const score = Math.round(Number(raw));
  recordStatus(statuses, "cnn", "fear_greed", true, { latency_ms: Date.now() - started, observed_at: day });
  return { fearGreed: score, fearGreedLabel: fgLabel(score), fearGreedAsOf: day };
}

// DEC-31 (v3.2): the CBOE P/C scraper was deleted — the CSV froze at Oct 2019 (feed
// retired), so it could only ever serve a relic the dashboard immediately STALE-excluded.

// ─── Top market headline (FEAT-NEWS) ──────────────────────────────────────────
// Breaks the FRED-only stance to answer "did a headline move direction today?". Pulls the
// TOP item from a market-focused RSS feed (Dow Jones / MarketWatch top-stories; CNBC top
// news as fallback). DATE-VERIFIED: we parse the item's pubDate and only accept a headline
// published within the last ~3 days, emitting its real ET date so isStale() flags anything
// older — we never present a stale headline as today's. Wrapped in withLastGood at the call
// site. We do not (cannot) verify the CLAIM's truth; we attribute the source + date so it's
// auditable, and rely on a reputable wire (Dow Jones/CNBC) for credibility.
async function fetchHeadline() {
  const feeds = [
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
    { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",      source: "CNBC" },
  ];
  const decode = (s) => s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘").replace(/&#8211;|&ndash;/g, "–")
    .trim();

  for (const { url, source } of feeds) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const item = xml.match(/<item>([\s\S]*?)<\/item>/i);
      if (!item) continue;
      const titleM = item[1].match(/<title>([\s\S]*?)<\/title>/i);
      const pubM   = item[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (!titleM || !pubM) continue;
      const title = decode(titleM[1]);
      const pub = new Date(pubM[1].trim());
      if (!title || isNaN(pub.getTime())) continue;
      // Date-accuracy gate: accept only a recently-published headline (last ~3 days; allow a
      // little clock skew into the future). Anything older is stale → skip to the next feed.
      const ageDays = (Date.now() - pub.getTime()) / 86400000;
      if (ageDays > 3 || ageDays < -1) continue;
      const asOf = pub.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD ET
      return { marketHeadline: title, marketHeadlineSource: source, marketHeadlineAsOf: asOf };
    } catch { /* try next feed */ }
  }
  throw new Error("no fresh headline");
}

// ─── Kalshi FOMC rate-decision odds (FEAT-R9) ────────────────────────────────
// Public market-data REST API (no auth, no key). The KXFEDDECISION series carries
// one mutually-exclusive event per FOMC meeting (e.g. KXFEDDECISION-26JUN) with
// buckets: H0 = hold · C25/C26 = cut 25 / >25 · H25/H26 = hike 25 / >25. We take
// the nearest open event and aggregate each bucket's last traded price
// (last_price_dollars, 0–1 = implied probability) into hold / cut / hike percents.
// Wrapped in withLastGood at the call site, so a Kalshi outage (or an edge-IP block,
// the way Stooq blocks us) serves the last good odds + STALE instead of mock.
async function fetchRateOdds(statuses = null) {
  /* ENGINE0-CONT §5.6: transport LADDER over the same API shape. The plan names
     external-api.kalshi.com as the currently-documented production base; the elections
     base is the deployed-working legacy transport, kept as the fallback because the doc
     claim could not be network-verified from this build environment (docs.kalshi.com is
     blocked here). Whichever base serves is recorded in provenance — never implied. */
  const KALSHI_BASES = [
    "https://external-api.kalshi.com/trade-api/v2",
    "https://api.elections.kalshi.com/trade-api/v2",
  ];
  const hdrs = { headers: { Accept: "application/json" } };
  let events = null, base = null, lastErr = null;
  for (const b of KALSHI_BASES) {
    try {
      // 1. nearest OPEN Fed-decision event (soonest future strike_date)
      const er = await fetchRetry(`${b}/events?series_ticker=KXFEDDECISION&status=open&limit=200`, hdrs);
      const body = await er.json();
      if (!Array.isArray(body.events)) throw Object.assign(new Error("Kalshi events: bad shape"), { error_class: "parse" });
      events = body.events; base = b;
      break;
    } catch (e) { lastErr = e; recordStatus(statuses, "kalshi", `events @ ${new URL(b).host}`, e); }
  }
  if (!events) throw lastErr || new Error("Kalshi unreachable");
  const now = Date.now();
  const ev = events
    .filter((e) => e.strike_date && new Date(e.strike_date).getTime() > now)
    .sort((a, b) => new Date(a.strike_date) - new Date(b.strike_date))[0];
  if (!ev) {
    // §9: "no future event" is a DIFFERENT fact from an HTTP failure — named as such.
    recordStatus(statuses, "kalshi", `events @ ${new URL(base).host}`, Object.assign(new Error("no upcoming FOMC event"), { error_class: "no_observation" }));
    throw new Error("Kalshi: no upcoming FOMC event");
  }
  // 2. its buckets
  const mr = await fetchRetry(`${base}/markets?event_ticker=${ev.event_ticker}&limit=50`, hdrs);
  const markets = (await mr.json()).markets || [];
  let hold = 0, cut = 0, hike = 0, seen = 0;
  for (const m of markets) {
    // Prefer last trade; fall back to bid/ask mid for thin buckets.
    let p = parseFloat(m.last_price_dollars);
    if (!(p > 0)) {
      const bid = parseFloat(m.yes_bid_dollars), ask = parseFloat(m.yes_ask_dollars);
      if (bid >= 0 && ask > 0) p = (bid + ask) / 2;
    }
    if (!isFinite(p)) continue;
    seen++;
    const suf = String(m.ticker).split("-").pop(); // H0 | C25 | C26 | H25 | H26
    if (suf === "H0") hold += p;
    else if (suf[0] === "C") cut += p;
    else if (suf[0] === "H") hike += p;
  }
  if (!seen) {
    recordStatus(statuses, "kalshi", ev.event_ticker, Object.assign(new Error("no priced buckets"), { error_class: "parse" }));
    throw new Error("Kalshi: no priced buckets");
  }
  recordStatus(statuses, "kalshi", ev.event_ticker, true, { base: new URL(base).host, markets: markets.length, priced: seen });
  // Buckets are independent YES markets, so their prices don't sum to exactly 1
  // (spreads + last-trade skew). Normalize to a clean 100% while preserving the
  // relative odds, so the three displayed numbers add up.
  const total = hold + cut + hike;
  if (total > 0) { hold /= total; cut /= total; hike /= total; }
  const pct = (x) => Math.round(x * 100);
  const days = Math.max(0, Math.round((new Date(ev.strike_date).getTime() - now) / 86400000));
  const asOf = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return {
    rateOddsHold: pct(hold),
    rateOddsCut:  pct(cut),
    rateOddsHike: pct(hike),
    rateOddsHoldAsOf: asOf,
    fomcDays:     days,
    nextFomcDate: ev.strike_date.slice(0, 10),
  };
}

// ─── Equity quotes (QQQ + Mag 10 prices) ─────────────────────────────────────
// FRED can't source individual equities/ETFs, so the only silent-mock left in the live
// strip (QQQ) and the biggest curated-stale block (Mag 10 prices) need a real equity feed.
// Finnhub's free tier (60 req/min, real-time US quotes) covers ~10 symbols/day at $0.
// KEY-GATED: with no FINNHUB_KEY this throws → withLastGood → field absent → mock (the
// invariant holds, nothing breaks). Prices go live; Mag 10 FUNDAMENTALS stay curated.
// NOTE (deploy): set env.FINNHUB_KEY in Pages Settings, and verify it isn't edge-IP
// blocked the way Stooq was (key-authed REST APIs usually pass; swap to Twelve Data if not).
async function fetchEquities(env, statuses = null) {
  const key = env.FINNHUB_KEY;
  if (!key) throw new Error("FINNHUB_KEY not set");
  const MAG10 = ["NVDA", "GOOGL", "AAPL", "MSFT", "AVGO", "AMZN", "META", "PLTR", "TSLA"];
  const symbols = ["QQQ", ...MAG10];
  const quotes = {};
  const failed = []; // §9: the group must never read healthy because one symbol succeeded
  // Batch ≤5 to stay under the ~6-connection cap (mirrors fetchFred).
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    const res = await Promise.allSettled(batch.map(async (sym) => {
      const r = await fetchRetry(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`,
        { headers: { Accept: "application/json" } }, 2, 9000);
      const q = await r.json();
      const price = parseFloat(q.c), chg = parseFloat(q.dp);
      if (!isFinite(price) || price <= 0) throw Object.assign(new Error(`${sym} no quote`), { error_class: "no_observation" });
      return [sym, { price: parseFloat(price.toFixed(2)), chgPct: isFinite(chg) ? parseFloat(chg.toFixed(2)) : null }];
    }));
    res.forEach((r, j) => {
      if (r.status === "fulfilled") quotes[r.value[0]] = r.value[1];
      else { failed.push(batch[j]); recordStatus(statuses, "finnhub", batch[j], r.reason); }
    });
  }
  recordStatus(statuses, "finnhub", "quotes", true,
    { requested: symbols.length, succeeded: Object.keys(quotes).length, failed_symbols: failed.length ? failed : undefined });
  if (!Object.keys(quotes).length) throw new Error("equities: no quotes");
  const asOf = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const out = {};
  if (quotes.QQQ) {
    out.qqqPrice = quotes.QQQ.price;
    if (quotes.QQQ.chgPct != null) out.qqqChangePct = quotes.QQQ.chgPct;
    out.qqqPriceAsOf = asOf;
  }
  const mag = MAG10.filter((s) => quotes[s]).map((s) => ({ ticker: s, price: quotes[s].price, chgPct: quotes[s].chgPct }));
  if (mag.length) { out.mag10PricesJson = JSON.stringify(mag); out.mag10PricesJsonAsOf = asOf; }
  return out;
}

// ─── Shiller CAPE (valuation — the regime's 6th vote) ─────────────────────────
// The regime verdict a friend acts on counts a valuation factor; it must be real, not mock.
// No free API publishes CAPE, so we scrape multpl.com (the canonical public source). Monthly
// cadence on the staleness rails, on withLastGood — a failed scrape serves last-good (with its
// date, so isStale flags it) and ultimately falls back to mock → the tile's illustrative
// treatment kicks in (no fabricated BUBBLE verdict). Fragile-but-free, honestly degrading.
async function fetchShiller() {
  const r = await fetch("https://www.multpl.com/shiller-pe", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error(`multpl ${r.status}`);
  const html = await r.text();
  // The page renders "Current Shiller PE Ratio: NN.NN" (also in #current). Match a CAPE-plausible number.
  const m = html.match(/Current\s+Shiller\s+PE\s+Ratio[\s\S]{0,60}?(\d{2}\.\d{1,2})/i)
         || html.match(/id=["']current["'][\s\S]{0,120}?(\d{2}\.\d{1,2})/i);
  const v = m ? parseFloat(m[1]) : NaN;
  if (!isFinite(v) || v < 5 || v > 80) throw new Error("multpl CAPE parse failed");
  const asOf = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return { shillerPe: parseFloat(v.toFixed(2)), shillerPeAsOf: asOf };
}

// ─── AI token economics (the moat: price side of AI unit economics) ──────────
// OpenRouter's public models API (no auth, no key — like Kalshi, a sanctioned free
// source) lists every model's per-token pricing. We blend a fixed basket of frontier
// models into a single $/Mtok headline and a cheapest-frontier floor. Falling $/Mtok =
// intelligence commoditizing → pricing-power erosion, the demand-side mirror of the
// GPU $/hr supply-side squeeze (the two halves of AI unit economics). Wrapped in
// withLastGood at the call site, so an outage serves the last good prices + STALE.
//   - $/Mtok blend assumes a 3:1 input:output token mix (typical real-world usage).
//   - A rolling trend is accrued in KV (one point per ET-day, deduped, capped 12) so
//     the price-decline path is visible over time; model prices are sticky between
//     launches, so the trend reads flat with step-downs — exactly the signal we want.
async function fetchTokenomics(env) {
  const r = await fetchRetry("https://openrouter.ai/api/v1/models",
    { headers: { Accept: "application/json" } }, 2, 9000);
  const d = await r.json();
  const models = Array.isArray(d.data) ? d.data : [];
  // Blended $/Mtok (3 input : 1 output). pricing.prompt/completion are $/token strings.
  const mtokOf = (m) => {
    const p = parseFloat(m?.pricing?.prompt), c = parseFloat(m?.pricing?.completion);
    if (!isFinite(p) || !isFinite(c) || p < 0 || c < 0) return NaN;
    const v = parseFloat((((3 * p + c) / 4) * 1e6).toFixed(2));
    // Exclude free/$0-listed models: a $0 "frontier price" is a promotional/free-tier
    // listing, not a representative price. Left in, it polluted the basket and rendered as
    // the cheapest-frontier "floor: <model> $0/Mtok" — visibly wrong in the moat card.
    return v > 0 ? v : NaN;
  };
  // Frontier basket — matched by id prefix so a model-id bump doesn't silently drop one.
  const BASKET = [
    { label: "Claude Sonnet", match: ["anthropic/claude-sonnet", "anthropic/claude-3.7-sonnet", "anthropic/claude-3.5-sonnet"] },
    { label: "GPT frontier",  match: ["openai/gpt-5", "openai/gpt-4o", "openai/o4", "openai/o3"] },
    { label: "Gemini Pro",    match: ["google/gemini-2.5-pro", "google/gemini-2.0-pro", "google/gemini-pro-1.5"] },
    { label: "Llama large",   match: ["meta-llama/llama-3.3-70b", "meta-llama/llama-3.1-405b"] },
    { label: "DeepSeek",      match: ["deepseek/deepseek-chat", "deepseek/deepseek-v3"] },
  ];
  const picked = [];
  for (const b of BASKET) {
    const m = models.find((mm) => b.match.some((pre) => String(mm.id || "").startsWith(pre)) && isFinite(mtokOf(mm)));
    if (m) picked.push({ name: b.label, mtok: mtokOf(m) });
  }
  if (picked.length < 2) throw new Error("tokenomics: basket too thin");
  // Median is robust to a single outlier (e.g. a reasoning model priced 10x).
  const sorted = picked.map((p) => p.mtok).sort((a, b) => a - b);
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : parseFloat(((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(2));
  const asOf = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // Rolling trend in KV: append one point per ET-day, dedupe by date, cap at 12.
  let trend = [];
  try { const prev = await env.PULSE_CACHE?.get("pulse:tokentrend", "json"); if (Array.isArray(prev)) trend = prev; } catch {}
  if (!trend.length || trend[trend.length - 1].date !== asOf) {
    trend.push({ date: asOf, v: median });
    if (trend.length > 12) trend = trend.slice(-12);
  } else {
    trend[trend.length - 1].v = median; // refresh today's point on a same-day re-fetch
  }
  try { await env.PULSE_CACHE?.put("pulse:tokentrend", JSON.stringify(trend), { expirationTtl: 120 * 24 * 3600 }); } catch {}

  return {
    tokenBlendedMtok: median,
    tokenTrend: trend.map((t) => t.v),
    tokenModelsJson: JSON.stringify(picked),
    tokenBlendedMtokAsOf: asOf,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────
// Mirrors isStale() in src/sources.js: true when `dateStr` (an observation date,
// YYYY-MM-DD) trails `todayStr` (also YYYY-MM-DD, ET) by more than the normal
// ~1-session FRED lag. Today is excluded — its close may not be posted yet, that's
// the normal EOD lag, not "behind." Both inputs are plain calendar dates, so we
// anchor at UTC midnight purely to do day-of-week arithmetic — no real TZ at play.
function looksBehind(dateStr, todayStr) {
  if (!dateStr) return true;
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  if (isNaN(dt.getTime()) || isNaN(today.getTime())) return true;
  let missed = 0;
  const cur = new Date(dt);
  cur.setUTCDate(cur.getUTCDate() + 1);
  while (cur < today) {
    const dow = cur.getUTCDay();
    // Weekends and market holidays are not sessions FRED could have posted a close for.
    if (dow !== 0 && dow !== 6 && !isMarketHoliday(cur.toISOString().slice(0, 10))) missed++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return missed >= 1;
}

function fgLabel(score) {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

// `now` param + export exist solely so the smoke test can pin session boundaries
// (same convention as validateBook in tt.js). Call sites pass no argument.
export function marketSession(now = new Date()) {
  // No-session days: weekends and full-closure market holidays (shared table in
  // src/sources.js). Hour-only logic made Saturday noon — and Good Friday — read "OPEN".
  const dow = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" });
  const etDate = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  if (dow === "Sat" || dow === "Sun" || isMarketHoliday(etDate)) return "CLOSE";
  const h = now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" });
  const hour = parseInt(h);
  if (hour >= 9 && hour < 16) return "OPEN";
  if (hour >= 16) return "CLOSE";
  return "PRE";
}

function formatET(iso) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "America/New_York"
  }).replace(",", "") + " ET";
}

// Strip licensed/private fields from public view response
// (S&P-licensed fields stay in mock fallback — just don't override them)
function stripPrivate(snapshot) {
  // Currently all FRED fields are public-domain or citation-required.
  // Nothing to strip yet — extend here when FMP-licensed fields are added.
  return snapshot;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
