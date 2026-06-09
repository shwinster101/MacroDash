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
  // RATES / MACRO (fetchFred)
  tenYear:        { path: "crossAsset.treasury10y.current", kind: "num",    displayClass: "public" },
  tenYearD1:      { path: "crossAsset.treasury10y.d1",      kind: "num",    displayClass: "public" },
  tenYearSeries:  { path: "crossAsset.treasury10y.series",  kind: "series", displayClass: "public" },
  fedFunds:       { path: "macro.fedFunds.rate",            kind: "num",    displayClass: "public" },
  unemployment:   { path: "macro.unemployment.national",    kind: "num",    displayClass: "public" },
  lfpr:           { path: "macro.unemployment.lfpr",        kind: "num",    displayClass: "public" },
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
  vix:            { path: "marketPulse.vix.current",        kind: "num",    displayClass: "citation" },
  vixWeekChg:     { path: "marketPulse.vix.weekChg",        kind: "num",    displayClass: "citation" },
  vixSeries:      { path: "marketPulse.vix.series",         kind: "series", displayClass: "citation" },
  btc:            { path: "crossAsset.btc.current",         kind: "num",    displayClass: "public" },
  btcD1:          { path: "crossAsset.btc.d1pct",           kind: "num",    displayClass: "public" },
  // CREDIT SPREADS (ICE BofA OAS via FRED — BAMLH0A0HYM2 + BAMLC0A0CM)
  // HY-IG spread: widening = bearish leading indicator (inverse correlation to S&P 500)
  hySpread:           { path: "macro.credit.hy",          kind: "num",    displayClass: "public" },
  igSpread:           { path: "macro.credit.ig",          kind: "num",    displayClass: "public" },
  creditSpread:       { path: "macro.credit.spread",      kind: "num",    displayClass: "public" },
  creditSpreadD1:     { path: "macro.credit.spreadD1",    kind: "num",    displayClass: "public" },
  creditSpreadSeries: { path: "macro.credit.series",      kind: "series", displayClass: "public" },
  // SENTIMENT (scrapers — CNN F&G, CBOE Put/Call)
  fearGreed:      { path: "marketPulse.fearGreed.score",    kind: "num",    displayClass: "citation" },
  fearGreedLabel: { path: "marketPulse.fearGreed.label",    kind: "str",    displayClass: "citation" },
  putCall:        { path: "marketPulse.putCall.current",    kind: "num",    displayClass: "public" },
  // RATE-DECISION ODDS (FEAT-R9 — Kalshi KXFEDDECISION prediction market)
  rateOddsHold:   { path: "macro.fedFunds.odds.hold",       kind: "num",    displayClass: "public" },
  rateOddsCut:    { path: "macro.fedFunds.odds.cut",        kind: "num",    displayClass: "public" },
  rateOddsHike:   { path: "macro.fedFunds.odds.hike",       kind: "num",    displayClass: "public" },
  fomcDays:       { path: "macro.fedFunds.daysUntil",       kind: "num",    displayClass: "public" },
  nextFomcDate:   { path: "macro.fedFunds.nextFOMC",        kind: "str",    displayClass: "public" },
};

// Display classes that must NOT render on the public friend view.
export const PUBLIC_HIDDEN_CLASSES = ["licensed"];

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
    if (live[`${key}AsOf`]) dataAsOf[key] = live[`${key}AsOf`]; // observation date, if the source emits one
    if (key !== "lastRefresh" && key !== "session") anyLive = true; // meta alone isn't "live"
  }
  if (!anyLive) {
    for (const key of Object.keys(provenance)) provenance[key] = "MOCK";
    return { data: mockData, badge: "MOCK", asOf: payload.asOf || null, provenance, dataAsOf: {} };
  }
  return { data, badge: liveBadge, asOf: payload.asOf || null, provenance, dataAsOf };
}

// FEAT-R3: a live field is STALE when its observation date trails the current trading day by
// more than the normal ~1-session FRED lag (weekday-aware; holidays are out of scope).
export function isStale(dateStr, now = new Date()) {
  if (!dateStr) return false;
  const dt = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dt.getTime())) return false;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  // Count completed weekday sessions strictly between the data date and today. Today is
  // excluded (its close may not be published yet — the normal EOD lag), so any missing
  // PRIOR weekday means the feed is behind = stale (e.g. Thursday data viewed on a Sunday).
  let missed = 0;
  const cur = new Date(dt);
  cur.setDate(cur.getDate() + 1);
  while (cur < today) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) missed++;
    cur.setDate(cur.getDate() + 1);
  }
  return missed >= 1;
}
