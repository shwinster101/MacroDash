// functions/api/snapshot.js — PULSE v2.0 live data assembler
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

const CACHE_TTL = 6 * 60 * 60; // 6 hours — cron refresh overrides at open/close
const CACHE_KEY = "pulse:snapshot:v2"; // bumped from v1 → forces fresh fetch (was caching mock SPY)

export async function onRequest(context) {
  const { request, env } = context;
  const isPublic = new URL(request.url).searchParams.get("view") === "public";

  // ── 1. KV Cache check ─────────────────────────────────────────────────
  try {
    const cached = await env.PULSE_CACHE?.get(CACHE_KEY, "json");
    if (cached) {
      const payload = isPublic ? stripPrivate(cached) : cached;
      return json({ ...payload, cached: true });
    }
  } catch {
    // KV unavailable — skip cache, fetch fresh
  }

  // ── 2. Fetch all sources in parallel ──────────────────────────────────
  const [fred, spy, fearGreed, putCall] = await Promise.allSettled([
    fetchFred(env.FRED_KEY),
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

  // ── 4. Write-through cache ─────────────────────────────────────────────
  try {
    await env.PULSE_CACHE?.put(CACHE_KEY, JSON.stringify(snapshot), {
      expirationTtl: CACHE_TTL,
    });
  } catch {
    // Cache write failed — return uncached, non-fatal
  }

  // ── 5. Return (strip FMP/licensed fields if public view) ─────────────
  return json(isPublic ? { ...stripPrivate(snapshot), cached: false } : snapshot);
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

  // Fetch all FRED series in parallel
  const results = await Promise.allSettled(
    Object.entries(series).map(async ([field, id]) => {
      const url = `https://api.stlouisfed.org/fred/series/observations`
        + `?series_id=${id}&api_key=${key}&limit=10&sort_order=desc&file_type=json`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`FRED ${id} ${r.status}`);
      const d = await r.json();
      const obs = d.observations?.filter(o => o.value !== ".") ?? [];
      const latest = parseFloat(obs[0]?.value);
      const prev   = parseFloat(obs[1]?.value);
      // Return series of last 10 for sparkline (newest last)
      const spark  = obs.slice(0, 10).reverse().map(o => parseFloat(o.value)).filter(v => !isNaN(v));
      return [field, latest, prev, spark];
    })
  );

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
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`FRED SP500 ${r.status}`);
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
async function fetchFearGreed() {
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://edition.cnn.com/" },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`F&G ${r.status}`);
  const d = await r.json();
  const score = Math.round(d?.fear_and_greed?.score ?? d?.score ?? 50);
  const label = fgLabel(score);
  return { fearGreed: score, fearGreedLabel: label };
}

// ─── CBOE Put/Call scraper ────────────────────────────────────────────────
async function fetchPutCall() {
  // CBOE publishes daily equity put/call ratio at:
  const url = "https://www.cboe.com/data/volatility/volatility-get-data/?dt=d&sid=0";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`CBOE P/C ${r.status}`);
  const d = await r.json();
  // CBOE API shape may vary — parse defensively
  const ratio = parseFloat(
    d?.data?.[0]?.["PC Equity"] ?? d?.data?.[0]?.ratio ?? d?.ratio ?? NaN
  );
  if (isNaN(ratio)) throw new Error("P/C parse failed");
  return { putCall: ratio };
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
