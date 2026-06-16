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
  const params = new URL(request.url).searchParams;
  const isPublic = params.get("view") === "public";
  // _diag (source health, hasFredKey, etc.) is internal — only expose it on explicit ?debug=1.
  const debug = params.get("debug") === "1";
  const publicize = (obj) => { if (debug) return obj; const { _diag, ...rest } = obj; return rest; };

  // Per-ET-day cache key: first load each morning fetches fresh (FRED has the
  // prior close settled overnight), every load the rest of the day is instant.
  // No cron needed — your morning visit is the refresh trigger.
  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const cacheKey = `pulse:snapshot:v12:${etDate}`; // v12: + savings rate (PSAVERT) + tokenomics (OpenRouter)

  // ── 1. KV Cache check ─────────────────────────────────────────────────
  try {
    const cached = await env.PULSE_CACHE?.get(cacheKey, "json");
    if (cached) {
      const payload = isPublic ? stripPrivate(cached) : cached;
      return json(publicize({ ...payload, cached: true }));
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
  const [spy, fearGreed, putCall, rateOdds, headline] = await Promise.allSettled([
    fetchSpy(env.FRED_KEY),   // SPY via FRED SP500 — Stooq blocks Cloudflare edge IPs
    withLastGood(env, "feargreed", fetchFearGreed),
    withLastGood(env, "putcall", fetchPutCall),
    withLastGood(env, "rateodds", fetchRateOdds),
    withLastGood(env, "headline", fetchHeadline), // FEAT-NEWS: top market headline (non-FRED)
  ]);
  // Phase 3: tokenomics moat (OpenRouter, keyless) — its own phase so it never competes
  // with Phase 2 for the ~6-connection cap, and a slow/blocked OpenRouter can't starve the
  // core feeds. Not part of the write-through health gate (the moat is an add-on, not core).
  const [tokenomics] = await Promise.allSettled([
    withLastGood(env, "tokenomics", () => fetchTokenomics(env)),
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
    ...(headline.status === "fulfilled" ? headline.value : {}),
    ...(tokenomics.status === "fulfilled" ? tokenomics.value : {}),
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
    headline: headline.status === "fulfilled" ? "ok" : String(headline.reason),
    tokenomics: tokenomics.status === "fulfilled" ? "ok" : String(tokenomics.reason),
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

  // ── 5. Return (strip FMP/licensed fields if public view; _diag only on ?debug=1) ──
  return json(publicize(isPublic ? { ...stripPrivate(snapshot), cached: false } : snapshot));
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
    savings:      "PSAVERT",    // Personal Saving Rate (% of disposable income) — household cushion
    mortgage30:   "MORTGAGE30US",
    wti:          "DCOILWTICO",
    vix:          "VIXCLS",
    btc:          "CBBTCUSD",
    hySpread:     "BAMLH0A0HYM2",  // ICE BofA US HY OAS — daily credit risk gauge
    igSpread:     "BAMLC0A0CM",    // ICE BofA US IG OAS — investment-grade counterpart
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
        // Inflation series need ~18 monthly points to derive a 6-point YoY trend.
        // Other series: 26 points so DAILY fields can derive a 1-week (idx[5]) and
        // 1-month (idx[21]) change off the same pull — zero extra fetches. Payload
        // is trivially small either way.
        const limit = INFLATION.has(field) ? 20 : 26;
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
          return [field, yoy, NaN, trend, obs[0]?.date, NaN, NaN];
        }
        const vals  = obs.map(o => parseFloat(o.value)).filter(v => !isNaN(v));
        const latest = vals[0];
        const prev   = vals[1];
        const wAgo   = vals[5];   // ~1 trading week back (DAILY fields only)
        const mAgo   = vals[21];  // ~1 trading month back (DAILY fields only)
        // Series of last 10 for sparkline (newest last)
        const spark  = vals.slice(0, 10).reverse();
        return [field, latest, prev, spark, obs[0]?.date, wAgo, mAgo];
      })
    );
    results.push(...settled);
  }

  // DAILY-frequency fields only: idx[5]/idx[21] are ~1wk/~1mo back. Applying these
  // offsets to a MONTHLY series (FEDFUNDS, UNRATE…) would mean 5/21 *months* — garbage.
  // So w1/m1 derivation is gated to true daily series.
  const DAILY = new Set(["tenYear", "wti", "btc", "vix"]);
  // Percent-change helper (for price-like fields); rates use absolute yield deltas.
  const pct = (a, b) => parseFloat((((a - b) / b) * 100).toFixed(2));

  const out = {};
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const [field, latest, prev, spark, asOf, wAgo, mAgo] = r.value;
    if (isNaN(latest)) continue;
    out[field] = latest;
    out[field + "AsOf"] = asOf; // FEAT-R2: observation date, for per-tile freshness
    const daily = DAILY.has(field);
    // Derived deltas for specific fields. 10Y = absolute yield Δ (pp); WTI/BTC = % Δ.
    if (field === "tenYear") {
      if (!isNaN(prev)) out.tenYearD1 = parseFloat((latest - prev).toFixed(4));
      if (daily && !isNaN(wAgo)) out.tenYearW1 = parseFloat((latest - wAgo).toFixed(4));
      if (daily && !isNaN(mAgo)) out.tenYearM1 = parseFloat((latest - mAgo).toFixed(4));
    }
    if (field === "vix" && !isNaN(prev)) {
      out.vixWeekChg = parseFloat((((latest - prev) / prev) * 100).toFixed(2));
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
    // Credit spreads: capture D1 and intermediate series for cross-field derivation below.
    if (field === "hySpread") {
      if (!isNaN(prev)) out.hySpreadD1 = parseFloat((latest - prev).toFixed(4));
      out._hySparkline = spark; // temp: used to derive creditSpreadSeries
    }
    if (field === "igSpread") {
      if (!isNaN(prev)) out.igSpreadD1 = parseFloat((latest - prev).toFixed(4));
      out._igSparkline = spark; // temp
    }
  }

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
      // Normalize the CBOE M/D/YYYY date → ISO YYYY-MM-DD so it matches every other
      // asOf field and the dashboard's isStale()/asOfOf() (which expect ISO). Without
      // this, a retired feed's date silently fails the STALE check.
      const md = String(cols[0]).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const asOf = md ? `${md[3]}-${md[1].padStart(2,"0")}-${md[2].padStart(2,"0")}` : cols[0].trim();
      return { putCall: ratio, putCallAsOf: asOf };
    }
  }
  throw new Error("P/C parse failed");
}

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
    return parseFloat((((3 * p + c) / 4) * 1e6).toFixed(2));
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
