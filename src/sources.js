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
  // RATES / MACRO (fetchFred)
  tenYear:        { path: "crossAsset.treasury10y.current", kind: "num",    displayClass: "public" },
  tenYearD1:      { path: "crossAsset.treasury10y.d1",      kind: "num",    displayClass: "public" },
  tenYearSeries:  { path: "crossAsset.treasury10y.series",  kind: "series", displayClass: "public" },
  fedFunds:       { path: "macro.fedFunds.rate",            kind: "num",    displayClass: "public" },
  unemployment:   { path: "macro.unemployment.national",    kind: "num",    displayClass: "public" },
  lfpr:           { path: "macro.unemployment.lfpr",        kind: "num",    displayClass: "public" },
  mortgage30:     { path: "macro.mortgage.national",        kind: "num",    displayClass: "public" },
  wti:            { path: "crossAsset.wti.current",         kind: "num",    displayClass: "public" },
  wtiD1:          { path: "crossAsset.wti.d1pct",           kind: "num",    displayClass: "public" },
  vix:            { path: "marketPulse.vix.current",        kind: "num",    displayClass: "citation" },
  vixWeekChg:     { path: "marketPulse.vix.weekChg",        kind: "num",    displayClass: "citation" },
  vixSeries:      { path: "marketPulse.vix.series",         kind: "series", displayClass: "citation" },
  btc:            { path: "crossAsset.btc.current",         kind: "num",    displayClass: "public" },
  btcD1:          { path: "crossAsset.btc.d1pct",           kind: "num",    displayClass: "public" },
  // SENTIMENT (scrapers — CNN F&G, CBOE Put/Call)
  fearGreed:      { path: "marketPulse.fearGreed.score",    kind: "num",    displayClass: "citation" },
  fearGreedLabel: { path: "marketPulse.fearGreed.label",    kind: "str",    displayClass: "citation" },
  putCall:        { path: "marketPulse.putCall.current",    kind: "num",    displayClass: "public" },
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

function validValue(v, kind) {
  if (kind === "series") return Array.isArray(v) && v.length > 0 && v.every((n) => Number.isFinite(n));
  if (kind === "str")    return typeof v === "string" && v.length > 0;
  return Number.isFinite(v);
}

// Merge a /api/snapshot payload over mock DATA. Pure.
//   mockData   : shaped DATA object (mock fallback)
//   payload    : { live: { fieldName: value, ... }, cached: bool, asOf }
//   publicView : when true, licensed-class fields are skipped (not overlaid)
// Returns { data, badge, asOf } where badge in MOCK | LIVE | CACHED.
export function mergeLiveOverMock(mockData, payload, publicView = false) {
  const live = payload && payload.live;
  if (!live || Object.keys(live).length === 0) {
    return { data: mockData, badge: "MOCK", asOf: null };
  }
  let data = mockData;
  let anyLive = false;
  for (const key of Object.keys(SOURCES)) {
    const src = SOURCES[key];
    if (publicView && PUBLIC_HIDDEN_CLASSES.includes(src.displayClass)) continue;
    const v = live[key];
    if (!validValue(v, src.kind || "num")) continue;
    data = setPath(data, src.path, v);
    if (key !== "lastRefresh" && key !== "session") anyLive = true; // meta alone isn't "live"
  }
  if (!anyLive) return { data: mockData, badge: "MOCK", asOf: payload.asOf || null };
  return { data, badge: payload.cached ? "CACHED" : "LIVE", asOf: payload.asOf || null };
}
