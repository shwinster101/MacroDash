// MacroDash v2.0.1 — snapshot field map + pure merge logic (FEAT-200/201/202/204).
// Pure module (no React): unit-testable in Node, reusable by useMarketData.
//
// The dashboard reads /api/snapshot, which returns a FLAT { live: {...} } object.
// Each SOURCES key is the EXACT field name snapshot.js emits; `path` is the
// location in MOCK_DATA (dashboard.jsx), audited to resolve. `kind` validates:
//   num    -> Number.isFinite required
//   series -> non-empty numeric Array required (sparkline)
//   str    -> non-empty string required (labels / meta)

export const SOURCES = {
  // META (snapshot top-level)
  lastRefresh:    { path: "lastRefresh",                    kind: "str",    displayClass: "public" },
  session:        { path: "session",                        kind: "str",    displayClass: "public" },
  // EQUITY (fetchSpy — FRED SP500 / 10 proxy)
  spyPrice:       { path: "marketPulse.spy.price",          kind: "num",    displayClass: "public" },
  spyChangePct:   { path: "marketPulse.spy.changePct",      kind: "num",    displayClass: "public" },
  spyYtd:         { path: "marketPulse.spy.ytd",            kind: "num",    displayClass: "public" },
  spyMa100:       { path: "marketPulse.spy.ma100",          kind: "num",    displayClass: "public" },
  spyMa200:       { path: "marketPulse.spy.ma200",          kind: "num",    displayClass: "public" },
  spySeries:      { path: "marketPulse.spy.series",         kind: "series", displayClass: "public" },
  spxIndex:       { path: "marketPulse.spx.index",          kind: "num",    displayClass: "public" },
  spxPrevClose:   { path: "marketPulse.spx.prevClose",      kind: "num",    displayClass: "public" },
  // QQQ (Finnhub equity quote — Nasdaq-100 ETF; FRED can't source individual equities)
  qqqPrice:       { path: "marketPulse.qqq.price",          kind: "num",    displayClass: "public" },
  qqqChangePct:   { path: "marketPulse.qqq.changePct",      kind: "num",    displayClass: "public" },
  // MAG 10 live prices (Finnhub) — JSON passthrough [{ticker,price,chgPct}]; fundamentals stay curated
  mag10PricesJson:{ path: "mag10PricesJson",                kind: "str",    displayClass: "public" },
  // RATES / MACRO (fetchFred)
  tenYear:        { path: "crossAsset.treasury10y.current", kind: "num",    displayClass: "public" },
  tenYearD1:      { path: "crossAsset.treasury10y.d1",      kind: "num",    displayClass: "public" },
  tenYearW1:      { path: "crossAsset.treasury10y.w1",      kind: "num",    displayClass: "public" },
  tenYearM1:      { path: "crossAsset.treasury10y.m1",      kind: "num",    displayClass: "public" },
  tenYearSeries:  { path: "crossAsset.treasury10y.series",  kind: "series", displayClass: "public" },
  // FEAT-30Y (v3.55) — the long end + the 10s30s term-premium spread. DGS30 is NOT derivable
  // from DGS10 (which is why TLT was rejected in v3.43 but this is not): the SPREAD is the
  // fiscal-risk gauge, and a long end breaking out while the front holds is its own channel.
  thirtyYear:       { path: "crossAsset.treasury30y.current", kind: "num",    displayClass: "public" },
  thirtyYearD1:     { path: "crossAsset.treasury30y.d1",      kind: "num",    displayClass: "public" },
  thirtyYearW1:     { path: "crossAsset.treasury30y.w1",      kind: "num",    displayClass: "public" },
  thirtyYearM1:     { path: "crossAsset.treasury30y.m1",      kind: "num",    displayClass: "public" },
  thirtyYearSeries: { path: "crossAsset.treasury30y.series",  kind: "series", displayClass: "public" },
  spread10s30s:       { path: "crossAsset.term.spread10s30s", kind: "num",    displayClass: "public" },
  spread10s30sSeries: { path: "crossAsset.term.series",       kind: "series", displayClass: "public" },
  // FEAT-SAHM (v3.84): the short leg + the classic recession-lead spread (10y–3m). The
  // spread is stamped its own AsOf in snapshot.js (tenYearAsOf || threeMonthAsOf), so its
  // series derivative inherits from IT — the spread10s30s shape exactly.
  threeMonth:         { path: "crossAsset.treasury3m.current", kind: "num",    displayClass: "public" },
  spread10y3m:        { path: "crossAsset.term.spread10y3m",   kind: "num",    displayClass: "public" },
  spread10y3mSeries:  { path: "crossAsset.term.series10y3m",   kind: "series", displayClass: "public" },
  fedFunds:       { path: "macro.fedFunds.rate",            kind: "num",    displayClass: "public" },
  // v3.99: the Fed's own DAILY target-range bounds (DFEDTARU/DFEDTARL). Daily cadence by
  // default — unlike FEDFUNDS these step on a decision day, which is the whole point.
  fedTargetUpper: { path: "macro.fedFunds.targetUpper",     kind: "num",    displayClass: "public" },
  fedTargetLower: { path: "macro.fedFunds.targetLower",     kind: "num",    displayClass: "public" },
  unemployment:   { path: "macro.unemployment.national",    kind: "num",    displayClass: "public" },
  unemploymentTrend: { path: "macro.unemployment.trend",    kind: "series", displayClass: "public" },
  lfpr:           { path: "macro.unemployment.lfpr",        kind: "num",    displayClass: "public" },
  savings:        { path: "macro.savings.rate",             kind: "num",    displayClass: "public" },
  savingsTrend:   { path: "macro.savings.trend",            kind: "series", displayClass: "public" },
  mortgage30:     { path: "macro.mortgage.national",        kind: "num",    displayClass: "public" },
  // INFLATION (FEAT-R10 — FRED index → YoY %; CPIAUCSL/CPILFESL + PCEPI/PCEPILFE)
  cpiHeadline:    { path: "macro.cpi.headline",             kind: "num",    displayClass: "public" },
  cpiCore:        { path: "macro.cpi.core",                 kind: "num",    displayClass: "public" },
  cpiTrend:       { path: "macro.cpi.trend",                kind: "series", displayClass: "public" },
  pceHeadline:    { path: "macro.pce.headline",             kind: "num",    displayClass: "public" },
  pceCore:        { path: "macro.pce.core",                 kind: "num",    displayClass: "public" },
  pceTrend:       { path: "macro.pce.trend",                kind: "series", displayClass: "public" },
  wti:            { path: "crossAsset.wti.current",         kind: "num",    displayClass: "public" },
  wtiD1:          { path: "crossAsset.wti.d1pct",           kind: "num",    displayClass: "public" },
  wtiW1:          { path: "crossAsset.wti.w1pct",           kind: "num",    displayClass: "public" },
  wtiM1:          { path: "crossAsset.wti.m1pct",           kind: "num",    displayClass: "public" },
  vix:            { path: "marketPulse.vix.current",        kind: "num",    displayClass: "citation" },
  vixWeekChg:     { path: "marketPulse.vix.weekChg",        kind: "num",    displayClass: "citation" },
  vixSeries:      { path: "marketPulse.vix.series",         kind: "series", displayClass: "citation" },
  btc:            { path: "crossAsset.btc.current",         kind: "num",    displayClass: "public" },
  btcD1:          { path: "crossAsset.btc.d1pct",           kind: "num",    displayClass: "public" },
  btcW1:          { path: "crossAsset.btc.w1pct",           kind: "num",    displayClass: "public" },
  btcM1:          { path: "crossAsset.btc.m1pct",           kind: "num",    displayClass: "public" },
  // CREDIT SPREADS (ICE BofA OAS via FRED — BAMLH0A0HYM2 + BAMLC0A0CM)
  // HY-IG spread: widening = bearish leading indicator (inverse correlation to S&P 500)
  hySpread:           { path: "macro.credit.hy",          kind: "num",    displayClass: "public" },
  igSpread:           { path: "macro.credit.ig",          kind: "num",    displayClass: "public" },
  // FINANCIAL CONDITIONS (FEAT-NFCI, v3.43 — Chicago Fed NFCI, weekly)
  // Zero is the historical average BY CONSTRUCTION (the index is standardized), so the sign
  // is the signal: positive = tighter than average, negative = looser.
  nfci:               { path: "macro.nfci.current",       kind: "num",    displayClass: "public" },
  nfciW1:             { path: "macro.nfci.w1",            kind: "num",    displayClass: "public" },
  nfciSeries:         { path: "macro.nfci.series",        kind: "series", displayClass: "public" },
  creditSpread:       { path: "macro.credit.spread",      kind: "num",    displayClass: "public" },
  creditSpreadD1:     { path: "macro.credit.spreadD1",    kind: "num",    displayClass: "public" },
  creditSpreadSeries: { path: "macro.credit.series",      kind: "series", displayClass: "public" },
  // FEAT-CCC (v3.84): the junk TAIL (ICE BofA CCC & Lower OAS) — AI-infra debt is rated
  // single-B/CCC, and the tail widens FIRST while broad HY still looks calm.
  creditTail:         { path: "macro.credit.tail",        kind: "num",    displayClass: "public" },
  creditTailD1:       { path: "macro.credit.tailD1",      kind: "num",    displayClass: "public" },
  creditTailSeries:   { path: "macro.credit.tailSeries",  kind: "series", displayClass: "public" },
  // FEAT-SAHM (v3.84): computed from the same UNRATE pull (src/sahm.js), stamped its own
  // AsOf (the UNRATE observation date) in snapshot.js — PRIMARY, not derived.
  sahm:               { path: "macro.unemployment.sahm",  kind: "num",    displayClass: "public" },
  // SENTIMENT (scrapers — CNN F&G). DEC-31 (v3.2): CBOE Put/Call retired (feed dead since 2019).
  fearGreed:      { path: "marketPulse.fearGreed.score",    kind: "num",    displayClass: "citation" },
  fearGreedLabel: { path: "marketPulse.fearGreed.label",    kind: "str",    displayClass: "citation" },
  // TOP MARKET HEADLINE (FEAT-NEWS — non-FRED RSS; date-verified, staleness via asOf)
  marketHeadline:       { path: "marketPulse.headline.text",   kind: "str", displayClass: "public" },
  marketHeadlineSource: { path: "marketPulse.headline.source", kind: "str", displayClass: "public" },
  // VALUATION (Shiller CAPE — multpl.com scrape; the regime's valuation vote, monthly cadence)
  shillerPe:      { path: "macro.shillerPe.current",       kind: "num",    displayClass: "public" },
  // AI TOKEN ECONOMICS (the moat — OpenRouter public models API; price side of AI unit economics)
  tokenBlendedMtok: { path: "tokenomics.blendedMtok",      kind: "num",    displayClass: "public" },
  tokenTrend:       { path: "tokenomics.trend",            kind: "series", displayClass: "public" },
  tokenModelsJson:  { path: "tokenomics.modelsJson",       kind: "str",    displayClass: "public" },
  // FEAT-TOKVOL (v3.85): the Q leg (OpenRouter datasets API, key-gated) — P×Q is the demand read.
  tokenVolDay:      { path: "tokenomics.volDay",           kind: "num",    displayClass: "public" },
  tokenVolTrend:    { path: "tokenomics.volTrend",         kind: "series", displayClass: "public" },
  // RATE-DECISION ODDS (FEAT-R9 — Kalshi KXFEDDECISION prediction market)
  rateOddsHold:   { path: "macro.fedFunds.odds.hold",       kind: "num",    displayClass: "public" },
  rateOddsCut:    { path: "macro.fedFunds.odds.cut",        kind: "num",    displayClass: "public" },
  rateOddsHike:   { path: "macro.fedFunds.odds.hike",       kind: "num",    displayClass: "public" },
  fomcDays:       { path: "macro.fedFunds.daysUntil",       kind: "num",    displayClass: "public" },
  nextFomcDate:   { path: "macro.fedFunds.nextFOMC",        kind: "str",    displayClass: "public" },
};

// Display classes that must NOT render on the public friend view.
export const PUBLIC_HIDDEN_CLASSES = ["licensed"];

// FEAT-DERIV-OWN (v3.41): a DERIVED field has no observation date of its own — snapshot.js
// computes it FROM a primary field's pull and never stamps a `<key>AsOf` sibling for it — so
// it must inherit the date (and cadence) of the field it was derived from. Lives here, not in
// ttReadout.js, because this module already owns the staleness vocabulary (isStale/cadenceOf/
// parseObsDate) and every consumer (mergeLiveOverMock, ttReadout.js, the dashboard's modeOf)
// already imports from here. v3.40 caught this for 6 fields locally inside buildTtReadout;
// this is the same fix, generalized to every derivative SOURCES declares, owned in one place.
// ⚠ Add an entry whenever functions/api/snapshot.js emits a value with no `<field>AsOf`
// sibling of its own — the smoke reconciliation (test/smoke.mjs) asserts this table covers
// every such SOURCES key and fails the build if a new one is missed.
export const DERIVED_OF = {
  // equity (fetchSpy — FRED SP500/10 proxy; spyPrice/spxIndex are the primary pulls)
  spyChangePct: "spyPrice", spyYtd: "spyPrice", spyMa100: "spyPrice", spyMa200: "spyPrice",
  spySeries: "spyPrice", spxPrevClose: "spxIndex",
  // QQQ (Finnhub quote — qqqPrice is the primary pull)
  qqqChangePct: "qqqPrice",
  // rates (fetchFred — tenYear is the primary pull)
  tenYearD1: "tenYear", tenYearW1: "tenYear", tenYearM1: "tenYear", tenYearSeries: "tenYear",
  thirtyYearD1: "thirtyYear", thirtyYearW1: "thirtyYear", thirtyYearM1: "thirtyYear",
  thirtyYearSeries: "thirtyYear",
  // spread10s30s IS stamped its own AsOf in snapshot.js (copied from thirtyYearAsOf), so its
  // own derivative inherits from IT — the same shape as creditSpreadSeries.
  spread10s30sSeries: "spread10s30s",
  // VIX (fetchFred — vix is the primary pull)
  vixWeekChg: "vix", vixSeries: "vix",
  // WTI / BTC (fetchFred)
  wtiD1: "wti", wtiW1: "wti", wtiM1: "wti",
  btcD1: "btc", btcW1: "btc", btcM1: "btc",
  // credit spread (creditSpread itself IS stamped its own AsOf — copied from hySpreadAsOf in
  // snapshot.js — so its own derivatives inherit from IT, not from hySpread directly)
  creditSpreadD1: "creditSpread", creditSpreadSeries: "creditSpread",
  // FEAT-CCC (v3.84): the tail is a direct pull with its own AsOf; derivatives inherit.
  creditTailD1: "creditTail", creditTailSeries: "creditTail",
  // FEAT-SAHM (v3.84): spread10y3m carries its own AsOf (tenYearAsOf || threeMonthAsOf).
  spread10y3mSeries: "spread10y3m",
  nfciW1: "nfci", nfciSeries: "nfci",
  // monthly/weekly FRED trends (primary field already carries its own AsOf)
  unemploymentTrend: "unemployment", savingsTrend: "savings",
  cpiTrend: "cpiHeadline", pceTrend: "pceHeadline",
  // sentiment (CNN F&G — fearGreed is the primary pull)
  fearGreedLabel: "fearGreed",
  // headline (RSS — marketHeadline is the primary pull)
  marketHeadlineSource: "marketHeadline",
  // AI token economics (OpenRouter — tokenBlendedMtok is the primary pull)
  tokenTrend: "tokenBlendedMtok", tokenModelsJson: "tokenBlendedMtok",
  // FEAT-TOKVOL (v3.85): tokenVolDay carries its own AsOf; only its trend derives from it.
  tokenVolTrend: "tokenVolDay",
  // Kalshi FOMC odds (rateOddsHold is the only field snapshot.js stamps an AsOf on —
  // FOUND during the v3.41 audit: cut/hike/fomcDays/nextFomcDate rode with NO date at all,
  // so bandFedOdds (keyed on cut/hike) could vote off a stale Kalshi pull undetected)
  rateOddsCut: "rateOddsHold", rateOddsHike: "rateOddsHold",
  fomcDays: "rateOddsHold", nextFomcDate: "rateOddsHold",
};
// Meta fields with no parent and no date to inherit — the reconciliation exemption list.
export const DERIVED_EXEMPT = ["lastRefresh", "session"];

// SOURCE CADENCE — how often each field's upstream actually updates. Drives
// cadence-aware staleness: a monthly print (CPI/PCE/FEDFUNDS) dated 6 weeks ago is
// the FRESHEST available, not stale — so it must not trip a daily-cadence STALE flag.
// Default is "daily"; only the non-daily fields are listed here.
const CADENCE = {
  // monthly FRED releases (period-dated at month start + a publication lag)
  fedFunds: "monthly", unemployment: "monthly", unemploymentTrend: "monthly", lfpr: "monthly",
  sahm: "monthly",     // FEAT-SAHM (v3.84): derived from monthly UNRATE — ages with it
  savings: "monthly", savingsTrend: "monthly",
  shillerPe: "monthly", // CAPE is a monthly-cadence metric
  cpiHeadline: "monthly", cpiCore: "monthly", cpiTrend: "monthly",
  pceHeadline: "monthly", pceCore: "monthly", pceTrend: "monthly",
  // weekly (Freddie Mac primary mortgage survey, Thursday)
  mortgage30: "weekly",
  // weekly (Chicago Fed NFCI — released Wednesday for the week ending the prior Friday;
  // nfciW1/nfciSeries inherit this through the DERIVED_OF parent fallback in cadenceOf)
  nfci: "weekly",
  // weekly (LLM token prices reprice on model launches, not daily)
  tokenBlendedMtok: "weekly", tokenTrend: "weekly", tokenModelsJson: "weekly",
  // FEAT-TOKVOL (v3.85): same weekly read as the price leg — the tokenDemand window math
  // interprets trend points as weeks, so the cadences must agree (mirrored, incl. the
  // pre-existing per-ET-day-accrual-vs-weekly-read tension — flagged, not fixed here).
  tokenVolDay: "weekly", tokenVolTrend: "weekly",
};
// Own cadence first; else the DERIVED_OF parent's cadence (so a future derivative under a
// non-daily parent is correct by default even if nobody remembers to list it explicitly
// above — the trend fields above already ARE listed explicitly, this is the safety net for
// the next one); else daily.
export function cadenceOf(key) {
  if (CADENCE[key]) return CADENCE[key];
  const parent = DERIVED_OF[key];
  if (parent && CADENCE[parent]) return CADENCE[parent];
  return "daily";
}

// Set a dotted path on a CLONE of obj (no mutation of the original).
export function setPath(obj, path, value) {
  const keys = path.split(".");
  const root = structuredClone(obj);
  let node = root;
  for (let i = 0; i < keys.length - 1; i++) {
    if (node[keys[i]] == null || typeof node[keys[i]] !== "object") node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
  return root;
}

// Like setPath but mutates `obj` IN PLACE (caller owns a copy). The merge clones once,
// then calls this per field — so N overlays cost ONE clone instead of N.
function setPathMut(obj, path, value) {
  const keys = path.split(".");
  let node = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (node[keys[i]] == null || typeof node[keys[i]] !== "object") node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
  return obj;
}

function validValue(v, kind) {
  if (kind === "series") return Array.isArray(v) && v.length > 0 && v.every((n) => Number.isFinite(n));
  if (kind === "str")    return typeof v === "string" && v.length > 0;
  return Number.isFinite(v);
}

// The date that GOVERNS a field: its own AsOf if the source stamped one, else the AsOf of the
// parent it was derived from (DERIVED_OF), else undefined (nothing to judge — isStale fails
// open on that, correctly, for a field with no date at all). Single source of truth so a
// derivative can never sail past the staleness gate its parent was just caught by.
export function govAsOf(live, key) {
  return (live && live[`${key}AsOf`]) ?? (DERIVED_OF[key] ? live?.[`${DERIVED_OF[key]}AsOf`] : undefined);
}

// Merge a /api/snapshot payload over mock DATA. Pure.
//   mockData   : shaped DATA object (mock fallback)
//   payload    : { live: { fieldName: value, ... }, cached: bool, asOf }
//   publicView : when true, licensed-class fields are skipped (not overlaid)
// Returns { data, badge, asOf, provenance }: badge in MOCK | LIVE | CACHED, and
// provenance maps every SOURCES key -> its own LIVE | CACHED | MOCK (drives per-tile badges).
export function mergeLiveOverMock(mockData, payload, publicView = false) {
  // Per-field provenance + freshness date, defaulting every mapped field to MOCK.
  const provenance = {};
  const dataAsOf = {}; // FEAT-R2: per-field observation date, read from live[`${key}AsOf`]
  for (const key of Object.keys(SOURCES)) provenance[key] = "MOCK";

  const live = payload && payload.live;
  if (!live || Object.keys(live).length === 0) {
    return { data: mockData, badge: "MOCK", asOf: null, provenance, dataAsOf };
  }
  const liveBadge = payload.cached ? "CACHED" : "LIVE";
  // Clone the mock ONCE (lazily, on the first valid overlay), then mutate that single copy
  // for every field — not once per field. The original mockData is never mutated.
  let data = mockData;
  let anyLive = false;
  for (const key of Object.keys(SOURCES)) {
    const src = SOURCES[key];
    if (publicView && PUBLIC_HIDDEN_CLASSES.includes(src.displayClass)) continue;
    const v = live[key];
    if (!validValue(v, src.kind || "num")) continue;
    if (data === mockData) data = structuredClone(mockData); // one clone for the whole merge
    setPathMut(data, src.path, v);
    provenance[key] = liveBadge;
    // FEAT-DERIV-OWN (v3.41): own AsOf if the source stamped one, else the parent's — a
    // derivative with no date of its own must not read fresher than the field it came from.
    const gov = govAsOf(live, key);
    if (gov) dataAsOf[key] = gov;
    if (key !== "lastRefresh" && key !== "session") anyLive = true; // meta alone isn't "live"
  }
  if (!anyLive) {
    for (const key of Object.keys(provenance)) provenance[key] = "MOCK";
    return { data: mockData, badge: "MOCK", asOf: payload.asOf || null, provenance, dataAsOf: {} };
  }
  return { data, badge: liveBadge, asOf: payload.asOf || null, provenance, dataAsOf };
}

// Parse an observation date from either ISO (YYYY-MM-DD, all FRED/scraper fields) or a
// legacy M/D/YYYY (e.g. "10/04/2019" — the format the retired CBOE feed used; kept as
// generic date support). The raw-Date path silently failed on M/D/YYYY → isStale returned
// false → a dead 2019-dated feed could dodge the STALE check. Returns a Date or null.
export function parseObsDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);          // ISO YYYY-MM-DD
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);        // M/D/YYYY (CBOE)
  if (m) return new Date(`${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}T00:00:00`);
  return null;
}

// ─── US equity market calendar (full-closure holidays) ────────────────────────
// The honesty stack judges time by "completed trading sessions", so every time-judge
// must know which WEEKDAYS had no session: session labels (marketSession in
// snapshot.js, etSession in dashboard.jsx) and the staleness counters (isStale below,
// looksBehind in snapshot.js) all consume this ONE table. FULL closures only — NYSE
// early-close half days (day after Thanksgiving, some Christmas Eves) are NOT modeled.
// ⚠️ CURATED, update annually (same convention as GPU_PRICING): an unlisted year
// simply falls back to weekday-only logic — degraded toward the old behavior, never wrong-crashing.
export const MARKET_HOLIDAYS = new Set([
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Washington's Birthday
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day observed (Jul 4 = Saturday)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
  // 2027
  "2027-01-01", // New Year's Day
  "2027-01-18", // MLK Day
  "2027-02-15", // Washington's Birthday
  "2027-03-26", // Good Friday
  "2027-05-31", // Memorial Day
  "2027-06-18", // Juneteenth observed (Jun 19 = Saturday)
  "2027-07-05", // Independence Day observed (Jul 4 = Sunday)
  "2027-09-06", // Labor Day
  "2027-11-25", // Thanksgiving
  "2027-12-24", // Christmas observed (Dec 25 = Saturday)
]);
export function isMarketHoliday(dateStr) { return MARKET_HOLIDAYS.has(String(dateStr)); }

/* ─── FOMC DECISION CALENDAR (v3.99) ─────────────────────────────────────────
   WHY THIS IS CURATED, NOT FETCHED. The FOMC countdown and `nextFomcDate` rode
   ENTIRELY on Kalshi, so when Kalshi rate-limited the edge (measured 2026-08-16:
   HTTP 429 on BOTH transport bases — see the ladder in snapshot.js) the dashboard
   lost the meeting DATE as well as the odds, `fed_next_meeting` became a MISSING
   input in /readout.json's health block, and the strip fell back to MOCK_DATA's
   hardcoded `nextFOMC` — which had silently expired two months earlier and rendered
   "FOMC —". Three failures from one upstream, two of which had no business
   depending on it.
   The Fed publishes this schedule a year ahead and it does not change intraday, so
   fetching it is strictly worse than curating it: a scrape adds a network dependency,
   a parser and a rate limit to a value that changes eight times a year. Same call, and
   the same shape, as MARKET_HOLIDAYS above.
   Dates are the DECISION day (day 2 of each two-day meeting), ET.
   ⚠ ASSERTED, NOT VERIFIED from this build environment — federalreserve.gov is blocked
   here (403 at the proxy), so these were entered from the published 2026 schedule and
   the OWNER should confirm them against federalreserve.gov/monetarypolicy/fomccalendars.htm.
   ⚠ UPDATE ANNUALLY. Unlike MARKET_HOLIDAYS this does NOT quietly fail open: smoke has an
   expiry tripwire that goes RED once the table has under 90 days of runway, so the update
   is forced rather than hoped for — a rotted calendar is exactly the defect this replaces. */
export const FOMC_MEETINGS = [
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
];

/* The next FOMC decision date at or after `now` (ET), or null when the table has run out.
   NULL IS THE HONEST ANSWER past the end of the schedule — never an extrapolated date: a
   guessed meeting date would feed a countdown and an Engine 0 gate input, and a confidently
   wrong date there is worse than a stated gap (the isMacroMaterial withhold rule). */
export function nextFomcDate(now = new Date()) {
  const today = etYmd(now);
  for (const d of FOMC_MEETINGS) if (d >= today) return d;
  return null;
}

// FIX-A (v3.49, VALUE_PROPOSITION_AUDIT_2026-07-31 Critical #1): the ET calendar date of an
// instant. Every time-judge in this stack reasons in "completed ET trading sessions", so
// "today" must be the ET date of `now` — NEVER the runtime's local date. The old
// `setHours(0,0,0,0)` truncation was local-time: on Cloudflare's edge (UTC) it advanced
// "today" at 8pm ET, counted the still-open/just-closed session as a MISSED one, and aged
// normal prior-close data — /readout.json read INSUFFICIENT (1 input, flip blind) while the
// same payload in an ET browser read MIXED on 3-of-5. Two verdicts for one regime is the
// exact failure a decision system cannot have; one clock fixes all three consumers at once
// (buildTtReadout, the dashboard's modeOf, the paste projection — they all call isStale).
export function etYmd(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// FEAT-R3: a live field is STALE when its observation date trails the latest expected
// release by more than its source's normal cadence. `cadence` (daily|weekly|monthly):
//   - daily   → weekday-aware: any completed PRIOR trading session missing = stale.
//   - weekly  → stale only past ~12 days (covers a normal weekly release + a slip).
//   - monthly → stale only past ~70 days. FRED prints are PERIOD-dated (month start) with
//               a ~6-week publication lag, so a value dated ~2 months ago can still be the
//               freshest available; flagging earlier would cry wolf on CPI/PCE/FEDFUNDS.
// Default cadence is "daily" so existing 2-arg callers (and the daily tiles) are unchanged.
export function isStale(dateStr, now = new Date(), cadence = "daily") {
  if (!dateStr) return false;
  const dt = parseObsDate(dateStr);
  if (!dt || isNaN(dt.getTime())) return false;
  // FIX-A: today = the ET date of `now`, parsed the same way `dt` was (local midnight of a
  // Y-M-D), so the day-walk below compares like with like in every runtime timezone.
  const today = parseObsDate(etYmd(now));

  if (cadence === "monthly" || cadence === "weekly") {
    const ageDays = (today - dt) / 86400000;
    return ageDays > (cadence === "monthly" ? 70 : 12);
  }

  // daily (default): count completed TRADING sessions strictly between the data date and
  // today. Today is excluded (its close may not be published yet — normal EOD lag), so any
  // missing PRIOR session means the feed is behind = stale (e.g. Thursday data on a Sunday).
  // Weekends AND market holidays are skipped — Thursday data viewed the Monday after Good
  // Friday is the freshest possible, not stale (holiday false-positives cried wolf).
  // ENGINE0-CONT: the walk itself now lives in sessionsBehind() — ONE session counter for
  // this staleness gate AND the evidence-tier carry windows (a second copy of the walk is
  // exactly the drift defect §P.4 forbids).
  const missed = sessionsBehind(dateStr, now);
  return missed == null ? false : missed >= 1;
}

// ENGINE0-CONT: completed trading sessions strictly between an observation date and the ET
// "today" of `now` — the unit every historical carry window is expressed in. 0 = the freshest
// a prior-close series can be (today's own close may not be posted yet); 1+ = sessions the
// feed has missed. Returns null when the date is absent/unparseable (nothing to count — the
// caller must treat that as unjudgeable, not as fresh).
export function sessionsBehind(dateStr, now = new Date()) {
  const dt = parseObsDate(dateStr);
  if (!dt || isNaN(dt.getTime())) return null;
  const today = parseObsDate(etYmd(now));
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let missed = 0;
  const cur = new Date(dt);
  cur.setDate(cur.getDate() + 1);
  while (cur < today) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !isMarketHoliday(ymd(cur))) missed++;
    cur.setDate(cur.getDate() + 1);
  }
  return missed;
}
