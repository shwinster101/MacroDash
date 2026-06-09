// functions/api/snapshot.js — MacroDash v2.0 live data assembler
// Called by useMarketData() in LIVE mode: GET /api/snapshot[?view=public]
//
// ARCHITECTURE:
//   1. Check PULSE_CACHE KV — if warm, return immediately (badge = CACHED)
//   2. Fetch all sources in parallel (FRED + Stooq + scrapers)
//   3. Assemble into { live: {...} } matching mergeSnapshot() field names
//   4. Write-through cache (TTL 6hr default; open/close runs refresh cron)
//   5. Return { live, asOf, cached: false }
//
// KEY SAFETY: env.FRED_KEY, env.STOOQ_KEY live here. Never in src/ (frontend).
// Set in Cloudflare: Workers & Pages → MacroDash → Settings → Variables & Secrets

const CACHE_TTL = 48 * 60 * 60;   // 48h cleanup; the per-day cache KEY drives freshness
const SETTLING_TTL = 60 * 60;     // short lock-in while the latest close looks not-yet-posted

export async function onRequest(context) {
  const { request, env } = context;
  const isPublic = new URL(request.url).searchParams.get("view") === "public";

  // Per-ET-day cache key: first load each morning fetches fresh (FRED has the
  // prior close settled overnight), every load the rest of the day is instant.
  // No cron needed — your morning visit is the refresh trigger.
  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const cacheKey = `pulse:snapshot:v7:${etDate}`; // v7: flush v6 pre-fix cache (YTD Dec31 anchor)

  // ── 1. KV Cache check ─────────────────────────────────────────────────
  try {
    const cached = await env.PULSE_CACHE?.get(cacheKey, "json");
    if (cached) {
      const payload = isPublic ? stripPrivate(cached) : cached;
      return json({ ...payload, cached: true });
    }
  } catch {
    // KV unavailable — skip cache, fetch fresh
  }

  // ── 2. Fetch sources in PHASES (stay under Cloudflare's ~6-connection cap) ──
  // 13 simultaneous fetches saturate the cap; queued calls burn their
  // AbortSignal.timeout budget while waiting, and the heavy SP500 (limit=220)
  // holds a slot — starving the FRED burst (=> fred:ok:4, spy:TimeoutError).
  // Phase 1: FRED macro alone (batched to <=5 inside fetchFred), no competition.
  const [fred] = await Promise.allSettled([fetchFred(env.FRED_KEY)]);
  // Phase 2: heavy SPY (220-pt) + two light scrapers = 3 connections, under cap.
  // FEAT-R8: the two scrapers are wrapped in withLastGood — a failed fetch serves the
  // last good scrape from KV (with its real date) instead of reverting to mock. The
  // stale date then trips the existing STALE badge, so an outage degrades honestly.
  const [spy, fearGreed, putCall, rateOdds] = await Promise.allSettled([
    fetchSpy(env.FRED_KEY),   // SPY via FRED SP500 — Stooq blocks Cloudflare edge IPs
    withLastGood(env, "feargreed", fetchFearGreed),
    withLastGood(env, "putcall", fetchPutCall),
    withLastGood(env, "rateodds", fetchRateOdds),
  ]);

  // ── 3. Assemble live overlay ───────────────────────────────────────────
  // Only include fields where we got a valid value.
  // mergeSnapshot() in useMarketData.js falls back to mock for anything missing.
  const now = new Date().toISOString();
  const live = {
    lastRefresh: formatET(now),
    session:     marketSession(),
    ...(fred.status === "fulfilled" ? fred.value : {}),
    ...(spy.status === "fulfilled" ? spy.value : {}),
    ...(fearGreed.status === "fulfilled" ? fearGreed.value : {}),
    ...(putCall.status === "fulfilled" ? putCall.value : {}),
    ...(rateOdds.status === "fulfilled" ? rateOdds.value : {}),
  };

  const snapshot = { live, asOf: now, cached: false };

  const diag = {
    hasFredKey: !!env.FRED_KEY,
    hasKV: !!env.PULSE_CACHE,
    fred: fred.status === "fulfilled" ? `ok:${Object.keys(fred.value).length}` : String(fred.reason),
    spy: spy.status === "fulfilled" ? "ok" : String(spy.reason),
    fearGreed: fearGreed.status === "fulfilled" ? "ok" : String(fearGreed.reason),
    putCall: putCall.status === "fulfilled" ? "ok" : String(putCall.reason),
    rateOdds: rateOdds.status === "fulfilled" ? "ok" : String(rateOdds.reason),
  };
  snapshot._diag = diag;

  // ── 4. Write-through cache (ONLY if healthy — never lock in a degraded pull) ──
  const fredCount = fred.status === "fulfilled" ? Object.keys(fred.value).length : 0;
  const healthy = spy.status === "fulfilled" && fredCount >= 6;
  // BUGFIX (2026-06-08): FRED doesn't always have the prior session's close posted
  // by the time of the day's FIRST visit — a 10:01 ET fetch this morning locked in
  // Thursday's SPY close (Friday's hadn't posted yet) into the full-day cache, so the
  // dashboard served 2-session-stale prices straight through to market close. If the
  // freshest SPY date trails today by more than the normal ~1-session lag (mirrors
  // isStale() in sources.js), write through with a short SETTLING_TTL instead — a
  // later visit re-fetches and, once FRED catches up, locks in the settled close for
  // the rest of the day as before.
  const spyAsOf = spy.status === "fulfilled" ? spy.value.spyPriceAsOf : null;
  const settled = healthy && !looksBehind(spyAsOf, etDate);
  snapshot._diag.healthy = healthy;
  snapshot._diag.settled = settled;
  if (healthy) {
    try {
      await env.PULSE_CACHE?.put(cacheKey, JSON.stringify(snapshot), {
        expirationTtl: settled ? CACHE_TTL : SETTLING_TTL,
      });
    } catch {
      // Cache write failed — return uncached, non-fatal
    }
  }

  // ── 5. Return (strip FMP/licensed fields if public view) ─────────────
  return json(isPublic ? { ...stripPrivate(snapshot), cached: false } : snapshot);
}

// ─── resilient fetch: 1 retry + generous timeout (mirrors the cron worker) ──
async function fetchRetry(url, opts = {}, attempts = 2, timeoutMs = 9000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// ─── FRED fetcher ─────────────────────────────────────────────────────────
async function fetchFred(key) {
  if (!key) throw new Error("FRED_KEY not set");

  const series = {
    tenYear:      "DGS10",
    fedFunds:     "FEDFUNDS",
    cpiHeadline:  "CPIAUCSL",   // CPI index  → YoY % below
    cpiCore:      "CPILFESL",   // core CPI index → YoY %
    pceHeadline:  "PCEPI",      // PCE index  → YoY %  (Fed's preferred gauge)
    pceCore:      "PCEPILFE",   // core PCE index → YoY %
    unemployment: "UNRATE",
    lfpr:         "CIVPART",
    mortgage30:   "MORTGAGE30US",
    wti:          "DCOILWTICO",
    vix:          "VIXCLS",
    btc:          "CBBTCUSD",
  };
  // FEAT-R10: these arrive as a price INDEX; the dashboard wants year-over-year %.
  // We pull enough monthly history to derive YoY (latest vs 12 months prior) plus a
  // 6-point YoY trend (obs[m] vs obs[m+12]).
  const INFLATION = new Set(["cpiHeadline", "cpiCore", "pceHeadline", "pceCore"]);

  // Fetch FRED series in batches of 5 — even alone, 10 parallel exceeds the
  // ~6-connection cap, so a queued call's timeout fires before it gets a socket.
  // Two sequential batches of 5 complete reliably (~0.5s each for small payloads).
  const entries = Object.entries(series);
  const results = [];
  for (let i = 0; i < entries.length; i += 5) {
    const settled = await Promise.allSettled(
      entries.slice(i, i + 5).map(async ([field, id]) => {
        // Inflation series need ~18 monthly points to derive a 6-point YoY trend;
        // everyone else only needs ~10 for a sparkline. Over-fetching daily series
        // to 20 is a trivially small payload.
        const limit = INFLATION.has(field) ? 20 : 10;
        const url = `https://api.stlouisfed.org/fred/series/observations`
          + `?series_id=${id}&api_key=${key}&limit=${limit}&sort_order=desc&file_type=json`;
        const r = await fetchRetry(url, {}, 2, 9000);
        const d = await r.json();
        const obs = d.observations?.filter(o => o.value !== ".") ?? [];
        if (INFLATION.has(field)) {
          // Convert index → YoY %: (this month / 12 months ago − 1) × 100.
          const yoyAt = (m) => {
            const a = parseFloat(obs[m]?.value), b = parseFloat(obs[m + 12]?.value);
            return (isFinite(a) && isFinite(b) && b > 0) ? parseFloat(((a / b - 1) * 100).toFixed(1)) : NaN;
          };
          const yoy = yoyAt(0);
          const trend = [];
          for (let m = 5; m >= 0; m--) { const v = yoyAt(m); if (isFinite(v)) trend.push(v); } // oldest→newest
          return [field, yoy, NaN, trend, obs[0]?.date];
        }
        const latest = parseFloat(obs[0]?.value);
        const prev   = parseFloat(obs[1]?.value);
        // Series of last 10 for sparkline (newest last)
        const spark  = obs.slice(0, 10).reverse().map(o => parseFloat(o.value)).filter(v => !isNaN(v));
        return [field, latest, prev, spark, obs[0]?.date];
      })
    );
    results.push(...settled);
  }

  const out = {};
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const [field, latest, prev, spark, asOf] = r.value;
    if (isNaN(latest)) continue;
    out[field] = latest;
    out[field + "AsOf"] = asOf; // FEAT-R2: observation date, for per-tile freshness
    // Derived deltas for specific fields
    if (field === "tenYear" && !isNaN(prev)) {
      out.tenYearD1 = parseFloat((latest - prev).toFixed(4));
    }
    if (field === "vix" && !isNaN(prev)) {
      out.vixWeekChg = parseFloat((((latest - prev) / prev) * 100).toFixed(2));
    }
    if (field === "wti" && !isNaN(prev)) {
      out.wtiD1 = parseFloat((((latest - prev) / prev) * 100).toFixed(2));
    }
    if (field === "btc" && !isNaN(prev)) {
      out.btcD1 = parseFloat((((latest - prev) / prev) * 100).toFixed(2));
    }
    if (field === "tenYear") out.tenYearSeries = spark;
    if (field === "vix")     out.vixSeries     = spark;
    // Inflation: `spark` here is the 6-point YoY trend computed in the fetcher.
    if (field === "cpiHeadline") out.cpiTrend = spark;
    if (field === "pceHeadline") out.pceTrend = spark;
  }
  return out;
}

// ─── SPY fetcher (via FRED SP500) ─────────────────────────────────────────
// Stooq blocks Cloudflare edge IPs, so we source SPY from FRED's SP500 index.
// SPY ≈ S&P 500 index / 10 (the ETF was designed at ~1/10th of the index).
// This reuses the proven-working FRED path (same key as VIX/10Y which already work).
async function fetchSpy(key) {
  if (!key) throw new Error("FRED_KEY not set");
  // 265 obs (~1yr + buffer) so the prior Dec 31 is always in the window for
  // any month of the year (220 misses Nov–Dec; 265 is safe year-round).
  const url = `https://api.stlouisfed.org/fred/series/observations`
    + `?series_id=SP500&api_key=${key}&limit=265&sort_order=desc&file_type=json`;
  const r = await fetchRetry(url, {}, 2, 9000);
  const d = await r.json();

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
  };
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
async function withLastGood(env, key, fetcher) {
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
      if (lg && Object.keys(lg).length) return lg; // stale but real — beats mock
    } catch {}
    throw err;
  }
}

async function fetchFearGreed() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const url = `https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${day}`;
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
  if (!r.ok) throw new Error(`F&G ${r.status}`);
  const d = await r.json();
  // Current value lives in fear_and_greed.score; historical points in
  // fear_and_greed_historical.data[].y — prefer the live score, fall back to
  // the newest historical point.
  const hist = d?.fear_and_greed_historical?.data;
  const histLatest = Array.isArray(hist) && hist.length ? hist[hist.length - 1]?.y : undefined;
  const raw = d?.fear_and_greed?.score ?? d?.score ?? histLatest;
  if (raw == null || isNaN(Number(raw))) throw new Error("F&G parse failed");
  const score = Math.round(Number(raw));
  return { fearGreed: score, fearGreedLabel: fgLabel(score), fearGreedAsOf: day };
}

// ─── CBOE Put/Call scraper ────────────────────────────────────────────────
// FIX (2026-06-04): old volatility-get-data JSON endpoint 404s — CBOE rotated
// it. The stable source is the static daily CSV on cdn.cboe.com, which CBOE
// has published at the same path for years and does not rate-limit edge IPs.
// Format: header rows, then DATE,CALL,PUT,TOTAL,P/C Ratio — newest row last.
async function fetchPutCall() {
  const url = "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/equitypc.csv";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error(`CBOE P/C ${r.status}`);
  const text = await r.text();
  // Parse: take the last non-empty line with a numeric P/C ratio in column 5.
  const lines = text.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;
    const ratio = parseFloat(cols[4]);
    // Validate: a real equity P/C ratio sits roughly in 0.3–2.0.
    if (!isNaN(ratio) && ratio > 0.1 && ratio < 5) {
      return { putCall: ratio, putCallAsOf: cols[0] };
    }
  }
  throw new Error("P/C parse failed");
}

// ─── Kalshi FOMC rate-decision odds (FEAT-R9) ────────────────────────────────
// Public market-data REST API (no auth, no key). The KXFEDDECISION series carries
// one mutually-exclusive event per FOMC meeting (e.g. KXFEDDECISION-26JUN) with
// buckets: H0 = hold · C25/C26 = cut 25 / >25 · H25/H26 = hike 25 / >25. We take
// the nearest open event and aggregate each bucket's last traded price
// (last_price_dollars, 0–1 = implied probability) into hold / cut / hike percents.
// Wrapped in withLastGood at the call site, so a Kalshi outage (or an edge-IP block,
// the way Stooq blocks us) serves the last good odds + STALE instead of mock.
async function fetchRateOdds() {
  const base = "https://api.elections.kalshi.com/trade-api/v2";
  const hdrs = { headers: { Accept: "application/json" } };
  // 1. nearest OPEN Fed-decision event (soonest future strike_date)
  const er = await fetchRetry(`${base}/events?series_ticker=KXFEDDECISION&status=open&limit=200`, hdrs);
  if (!er.ok) throw new Error(`Kalshi events ${er.status}`);
  const events = (await er.json()).events || [];
  const now = Date.now();
  const ev = events
    .filter((e) => e.strike_date && new Date(e.strike_date).getTime() > now)
    .sort((a, b) => new Date(a.strike_date) - new Date(b.strike_date))[0];
  if (!ev) throw new Error("Kalshi: no upcoming FOMC event");
  // 2. its buckets
  const mr = await fetchRetry(`${base}/markets?event_ticker=${ev.event_ticker}&limit=50`, hdrs);
  if (!mr.ok) throw new Error(`Kalshi markets ${mr.status}`);
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
  if (!seen) throw new Error("Kalshi: no priced buckets");
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
    if (dow !== 0 && dow !== 6) missed++;
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

function marketSession() {
  const h = new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" });
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
