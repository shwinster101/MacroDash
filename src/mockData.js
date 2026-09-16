// src/mockData.js — the always-present MOCK baseline (v6.5.5: extracted VERBATIM from
// dashboard.jsx, the Zone-1 move of the 2026-09-15 decomposition).
//
// This object is the mock-first / graceful-degradation invariant's floor: useMarketData()
// overlays live values ONLY on the paths sources.js declares in SOURCES, and everything else
// on the page renders from here. It is pure data — no React, no imports, no closures — so
// smoke IMPORTS it directly (the C1 regime.js form) instead of brace-count-slicing it out of
// the orchestrator's source text (which crashed the suite, not failed it, if the marker moved).
// docs/RISKS.md A4 records the move as an owner decision, never an extraction side-effect.
//
// Editing rule unchanged: a new live field is mapped in sources.js SOURCES and emitted from
// functions/api/snapshot.js; its mock baseline lands HERE on the same dotted path, and smoke
// reconciles every SOURCES path against this object (the sources.js <-> mock drift check).
export const MOCK_DATA = {
  lastRefresh:"2026-05-23 16:15 ET", session:"CLOSE",
  nextRefresh:"2026-05-26 09:35 ET",
  marketPulse:{
    spy:{ price:745.83, changePct:0.29, ytd:8.74, pe:22.4, ma100:718.2, ma200:692.4,
          series:[686,688,692,695,700,698,704,708,712,710,715,718,720,722,719,724,728,732,740,746] },
    spx:{ index:7473, prevClose:7415 }, // FEAT-202: S&P 500 index (FRED SP500) — live merge target
    qqq:{ price:717.66, changePct:0.44, ytd:15.50 },
    vix:{ current:18.4, weekChg:-13.2, series:[24,22,21,20,22,21,19,18] },
    fearGreed:{ score:58, label:"Greed", prevWeek:44 },
    // DEC-31 (v3.2): Put/Call field removed — CBOE killed the free feed in 2019; retirement noted in footer.
    // FEAT-NEWS: top market headline — live overlay from RSS (marketHeadline/Source); mock is the fallback.
    headline:{ text:"No live headline feed", source:"—", topJson:"[]" },
  },
  crossAsset:{
    treasury10y:{ current:4.32, d1:+0.08, w1:+0.12, m1:-0.15, yellowBand:0.10, series:[4.52,4.48,4.41,4.35,4.29,4.22,4.18,4.24,4.28,4.32] },
    // FEAT-30Y (v3.55): the long end + the 10s30s term-premium spread. Mock baseline only —
    // live values overlay via SOURCES (DGS30 + the derived spread), exactly like the 10Y.
    treasury30y:{ current:5.18, d1:+0.02, w1:+0.09, m1:+0.21, series:[4.92,4.97,5.01,5.04,5.09,5.12,5.18,5.14,5.16,5.18] },
    // FEAT-SAHM (v3.84): 3M bill + the 10y–3m recession lead. Mock spread is POSITIVE-normal
    // on purpose — the demo must not fake a recession signal (the NFCI abstain precedent).
    treasury3m:{ current:3.95 },
    term:{ spread10s30s:0.86, series:[0.40,0.49,0.60,0.69,0.80,0.90,1.00,0.90,0.88,0.86],
           spread10y3m:0.37, series10y3m:[0.10,0.14,0.18,0.22,0.25,0.28,0.30,0.33,0.35,0.37] },
    wti:{         current:68.42, d1pct:-0.8, w1pct:-2.1, m1pct:+3.2, yellowBand:1.0, series:[64,65,66,67,69,70,69,68,69,68] },
    btc:{         current:109200,d1pct:+1.2, w1pct:+4.8, m1pct:+12.1,yellowBand:2.0, series:[88000,90000,92000,95000,98000,100000,104000,106000,108000,109200] },
  },
  macro:{
    // v3.99: targetLower/Upper are the DAILY Fed target range (DFEDTARU/DFEDTARL) — the
    // headline number; `rate` is FEDFUNDS, the monthly-averaged EFFECTIVE rate, which lags a
    // decision by design. `nextFOMC` here is the mock baseline ONLY and WILL expire — the
    // real countdown falls through to the curated FOMC_MEETINGS calendar in sources.js, which
    // is precisely why a rotted date can no longer reach the strip.
    fedFunds:{ rate:3.625, targetLower:3.50, targetUpper:3.75, nextFOMC:"2026-06-17", daysUntil:14, odds:{ hold:84, cut:13, hike:3 } }, // odds: Kalshi FOMC market — LIVE since v2.6.3 (fetchRateOdds); these are the mock baseline only
    cpi:{ headline:3.8, core:2.8, nextRelease:"2026-06-11", trend:[3.2,3.4,3.5,3.6,3.7,3.8] },
    pce:{ headline:3.1, core:2.9, nextRelease:"2026-06-26", trend:[2.6,2.7,2.8,2.9,3.0,3.1] }, // Fed's preferred inflation gauge (FRED PCEPI/PCEPILFE — mock until YoY wired)
    // sahm 0.13 = deliberately CLEAR (trigger is >= 0.50) — the demo abstains, never a verdict.
    unemployment:{ national:4.3, entryLevel:6.1, lfpr:62.4, sahm:0.13, trend:[3.8,3.9,4.0,4.1,4.2,4.3] },
    savings:{ rate:4.2, trend:[4.6,4.5,4.4,4.3,4.3,4.2] }, // FRED PSAVERT — personal saving rate, % of disposable income
    mortgage:{ national:6.51, peoria:6.31 },
    // FEAT-CCC (v3.84): tail 9.4 sits in the NEUTRAL zone (calm <7, stress >12) on purpose —
    // the demo shows a gauge that abstains in ordinary conditions (the NFCI mock precedent).
    credit:{ hy:3.85, ig:0.92, spread:2.93, spreadD1:+0.04,
             series:[2.80,2.78,2.82,2.85,2.88,2.84,2.87,2.90,2.91,2.93],
             tail:9.4, tailD1:+0.05,
             tailSeries:[9.1,9.0,9.2,9.3,9.2,9.1,9.3,9.4,9.3,9.4] },
    // FEAT-NFCI (v3.43): Chicago Fed National Financial Conditions Index (weekly).
    // Standardized so ZERO is the historical average: positive = tighter than average,
    // negative = looser. The post-GFC era has generally run negative (loose).
    nfci:{ current:-0.42, w1:+0.03, leverage:-0.31,  // leverage subindex — context only (8/28)
           series:[-0.55,-0.53,-0.50,-0.49,-0.47,-0.46,-0.45,-0.44,-0.45,-0.42] },
    housing:{ peoria:218400 },
    shillerPe:{ current:42.78, mean:17.4, median:16.1, ath:44.19, pctOfAth:96.8 },
  },
  // PERSONAL CONVICTION WATCHLIST — names + tiers only (no live prices: FRED can't
  // source individual equities, and the stack is FRED-only $0). Pure manual list.
  // ⚠️ EXAMPLE DATA — replace `ticker`/`name`/`thesis` with your real S/A-tier holdings.
  watchlist:[
    { ticker:"NVDA", name:"NVIDIA",        tier:"S", thesis:"AI compute monopoly; data-center rev compounding" },
    { ticker:"MSFT", name:"Microsoft",     tier:"S", thesis:"Azure + Copilot moat; durable FCF" },
    { ticker:"ASML", name:"ASML Holding",  tier:"S", thesis:"EUV lithography sole-supplier chokepoint" },
    { ticker:"GOOGL",name:"Alphabet",      tier:"A", thesis:"Search cash engine funding AI optionality" },
    { ticker:"AMZN", name:"Amazon",        tier:"A", thesis:"AWS margins + retail operating leverage" },
    { ticker:"TSM",  name:"TSMC",          tier:"A", thesis:"Foundry leader; pricing power on leading nodes" },
  ],
  headwinds:[
    { id:1, name:"AI CapEx ROI Gap",    severity:"High", trend:"worsening", claim:"$705B FY26 capex vs $215B AI revenue. No hyperscaler can trace $X spent → $Y gained.", triggers:["AI rev <25% of CapEx","Hyperscaler guide-down"] },
    { id:2, name:"US Debt Service",     severity:"High", trend:"worsening", claim:"Interest payments ~18% of federal revenue. Crowding-out accelerating.", triggers:["10Y sustained >5%","Debt service >25% revenue"] },
    { id:3, name:"SPY Concentration",   severity:"Med",  trend:"stable",    claim:"Top-10 names = 38% of SPY weight. Near 2000 dot-com peak levels.", triggers:["Top-10 weight >42%"] },
    { id:4, name:"CRE / CMBS Stress",   severity:"Med",  trend:"stable",    claim:"CMBS delinquency 5.8%; office vacancy >20% in major metros.", triggers:["CMBS >8%","Bank NPL >4%"] },
    { id:5, name:"Labor Deceleration",  severity:"Low",  trend:"improving", claim:"Entry-level unemployment 6.1%; LFPR flat. Cooling without crashing.", triggers:["U-3 >5%","NFP <50K ×2"] },
  ],
  // Headwinds are a CURATED thesis register (no live feed) — this is the last-reviewed date,
  // surfaced in the UI + the 5 Whys so quarter-old claims aren't presented as today's tape.
  headwindsAsOf:"2026-Q1",
  // AI TOKEN ECONOMICS (the moat) — live overlay from OpenRouter (tokenBlendedMtok/Trend/ModelsJson);
  // mock is the fallback baseline. $/Mtok = blended frontier-basket price (3:1 in:out). Falling = the
  // the P leg beside GPU $/hr (volDay/volTrend are the Q leg, v3.85; P×Q is the demand read).
  tokenomics:{
    blendedMtok:6.20,
    trend:[9.5,8.8,8.0,7.2,6.7,6.20], // oldest→newest; the decline IS the signal
    modelsJson:'[{"name":"Claude Sonnet","mtok":9.0},{"name":"GPT frontier","mtok":7.5},{"name":"Gemini Pro","mtok":6.2},{"name":"Llama large","mtok":2.4},{"name":"DeepSeek","mtok":1.1}]',
    // FEAT-TOKVOL (v3.85): the Q leg. 6 pts = 5 intervals — below minWeeks like the price
    // trend above, so the mock P×Q read is "window too short" by construction (never a
    // fabricated demand verdict; the demand line is also illustrative-suppressed).
    volDay:2.95, volTrend:[2.1,2.3,2.4,2.6,2.8,2.95],
  },
  // MAG 10 live prices (Finnhub) — JSON passthrough. The per-ticker quote strip was CUT in
  // v3.51 (public audit, Yahoo-dupe test), so nothing renders these today; the field stays
  // mapped because the same Finnhub pull feeds QQQ and dropping it would change the fetch.
  // '[]' = no live prices yet (mock baseline).
  mag10PricesJson:"[]",
  // fiveWhys: now computed at render time by computeFiveWhys() (src/fiveWhys.js) from live data.
  sessionDelta:{ alertsDelta:0, regimeDelta:"none", vixPct:-2.1, tenYBps:-4, spyPct:+0.29 },
};
