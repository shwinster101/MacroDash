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

const CACHE_TTL = 48 * 60 * 60; // 48h cleanup; the per-day cache KEY drives freshness

export async function onRequest(context) {
  const { request, env } = context;
  const isPublic = new URL(request.url).searchParams.get("view") === "public";

  // Per-ET-day cache key: first load each morning fetches fresh (FRED has the
  // prior close settled overnight), every load the rest of the day is instant.
  // No cron needed — your morning visit is the refresh trigger.
  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const cacheKey = `pulse:snapshot:v5:${etDate}`; // v5: abandon poisoned v4 day-key

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
  const [spy, fearGreed, putCall] = await Promise.allSettled([
    fetchSpy(env.FRED_KEY),   // SPY via FRED SP500 — Stooq blocks Cloudflare edge IPs
    fetchFearGreed(),
    fetchPutCall(),
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
  };

  const snapshot = { live, asOf: now, cached: false };

  const diag = {
    hasFredKey: !!env.FRED_KEY,
    hasKV: !!env.PULSE_CACHE,
    fred: fred.status === "fulfilled" ? `ok:${Object.keys(fred.value).length}` : String(fred.reason),
    spy: spy.status === "fulfilled" ? "ok" : String(spy.reason),
    fearGreed: fearGreed.status === "fulfilled" ? "ok" : String(fearGreed.reason),
    putCall: putCall.status === "fulfilled" ? "ok" : String(putCall.reason),
  };
  snapshot._diag = diag;

  // ── 4. Write-through cache (ONLY if healthy — never lock in a degraded pull) ──
  const fredCount = fred.status === "fulfilled" ? Object.keys(fred.value).length : 0;
  const healthy = spy.status === "fulfilled" && fredCount >= 6;
  snapshot._diag.healthy = healthy;
  if (healthy) {
    try {
      await env.PULSE_CACHE?.put(cacheKey, JSON.stringify(snapshot), {
        expirationTtl: CACHE_TTL,
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
    cpiHeadline:  "CPIAUCSL",
    cpiCore:      "CPILFESL",
    unemployment: "UNRATE",
    lfpr:         "CIVPART",
    mortgage30:   "MORTGAGE30US",
    wti:          "DCOILWTICO",
    vix:          "VIXCLS",
    btc:          "CBBTCUSD",
  };

  // Fetch FRED series in batches of 5 — even alone, 10 parallel exceeds the
  // ~6-connection cap, so a queued call's timeout fires before it gets a socket.
  // Two sequential batches of 5 complete reliably (~0.5s each for small payloads).
  const entries = Object.entries(series);
  const results = [];
  for (let i = 0; i < entries.length; i += 5) {
    const settled = await Promise.allSettled(
      entries.slice(i, i + 5).map(async ([field, id]) => {
        const url = `https://api.stlouisfed.org/fred/series/observations`
          + `?series_id=${id}&api_key=${key}&limit=10&sort_order=desc&file_type=json`;
        const r = await fetchRetry(url, {}, 2, 9000);
        const d = await r.json();
        const obs = d.observations?.filter(o => o.value !== ".") ?? [];
        const latest = parseFloat(obs[0]?.value);
        const prev   = parseFloat(obs[1]?.value);
        // Series of last 10 for sparkline (newest last)
        const spark  = obs.slice(0, 10).reverse().map(o => parseFloat(o.value)).filter(v => !isNaN(v));
        return [field, latest, prev, spark];
      })
    );
    results.push(...settled);
  }

  const out = {};
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const [field, latest, prev, spark] = r.value;
    if (isNaN(latest)) continue;
    out[field] = latest;
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
    if (field === "cpiHeadline") {
      // CPI trend: 6 most recent monthly readings (oldest→newest)
      out.cpiTrend = spark.slice(-6);
    }
  }
  return out;
}

// ─── SPY fetcher (via FRED SP500) ─────────────────────────────────────────
// Stooq blocks Cloudflare edge IPs, so we source SPY from FRED's SP500 index.
// SPY ≈ S&P 500 index / 10 (the ETF was designed at ~1/10th of the index).
// This reuses the proven-working FRED path (same key as VIX/10Y which already work).
async function fetchSpy(key) {
  if (!key) throw new Error("FRED_KEY not set");
  const url = `https://api.stlouisfed.org/fred/series/observations`
    + `?series_id=SP500&api_key=${key}&limit=220&sort_order=desc&file_type=json`;
  const r = await fetchRetry(url, {}, 2, 9000);
  const d = await r.json();

  // FRED returns "." for non-trading days — filter them. Newest first (desc).
  const idx = (d.observations ?? [])
    .filter(o => o.value !== ".")
    .map(o => parseFloat(o.value))
    .filter(v => !isNaN(v));

  if (idx.length < 2) throw new Error("SP500 no data");

  const toSpy = (v) => parseFloat((v / 10).toFixed(2)); // index → SPY proxy
  const latest = idx[0], prev = idx[1];
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const ma100 = idx.length >= 100 ? toSpy(avg(idx.slice(0, 100))) : null;
  const ma200 = idx.length >= 200 ? toSpy(avg(idx.slice(0, 200))) : null;

  // YTD anchor = oldest value in the ~1yr window (approximate; exact Jan-1 = v2.1)
  const ytdBase = idx[idx.length - 1];

  // 20-day sparkline, oldest→newest, in SPY scale
  const series = idx.slice(0, 20).reverse().map(toSpy);

  return {
    spyPrice:     toSpy(latest),
    spyChangePct: parseFloat((((latest - prev) / prev) * 100).toFixed(2)),
    spyYtd:       parseFloat((((latest - ytdBase) / ytdBase) * 100).toFixed(2)),
    spySeries:    series,
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
  return { fearGreed: score, fearGreedLabel: fgLabel(score) };
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
      return { putCall: ratio };
    }
  }
  throw new Error("P/C parse failed");
}

// ─── Helpers ──────────────────────────────────────────────────────────────
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
