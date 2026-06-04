// MacroDash v2.0 — source map + pure merge logic (FEAT-200/201/202/204).
// Pure module (no React) so it is unit-testable in Node and reusable by the hook.
//
// Maps each live metric key to (a) where it lands in the dashboard DATA object,
// (b) the FRED series behind it, (c) its display class for the public/private
// view filter.
//
// INTEGRATION CHECK FOR T2: confirm each `path` matches the actual key in the
// `const DATA = {...}` object in dashboard.jsx (~line 87). Paths below reflect
// the audit's documented shape; verify before flipping live.

export const SOURCES = {
  tenYear:      { path: "treasury10y.current", series: "DGS10",        displayClass: "public",   source: "FRED DGS10" },
  fedFunds:     { path: "fedFunds.rate",        series: "FEDFUNDS",     displayClass: "public",   source: "FRED FEDFUNDS" },
  cpiHeadline:  { path: "cpi.headline",         series: "CPIAUCSL",     displayClass: "citation", source: "FRED CPIAUCSL" },
  cpiCore:      { path: "cpi.core",             series: "CPILFESL",     displayClass: "citation", source: "FRED CPILFESL" },
  unemployment: { path: "unemployment.rate",    series: "UNRATE",       displayClass: "public",   source: "FRED UNRATE" },
  lfpr:         { path: "unemployment.lfpr",    series: "CIVPART",      displayClass: "public",   source: "FRED CIVPART" },
  mortgage30:   { path: "mortgage.national",    series: "MORTGAGE30US", displayClass: "public",   source: "FRED MORTGAGE30US" },
  vix:          { path: "vix.current",          series: "VIXCLS",       displayClass: "citation", source: "FRED VIXCLS" },
  wti:          { path: "wti.price",            series: "DCOILWTICO",   displayClass: "public",   source: "FRED DCOILWTICO" },
  sp500:        { path: "spx.index",            series: "SP500",        displayClass: "licensed", source: "FRED SP500" },
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

// Merge a live payload over the mock DATA object. Pure.
//   mockData   : shaped DATA object (mock fallback)
//   payload    : { metrics: { tenYear:{value,asOf,stale,displayClass}, ... } }
//   publicView : when true, licensed-class metrics are skipped (not overlaid)
// Returns { data, badge, asOf } where badge in MOCK | LIVE | STALE.
export function mergeLiveOverMock(mockData, payload, publicView = false) {
  if (!payload || !payload.metrics || Object.keys(payload.metrics).length === 0) {
    return { data: mockData, badge: "MOCK", asOf: null };
  }
  let data = mockData;
  let anyLive = false;
  let anyStale = false;
  let latestAsOf = null;

  for (const key of Object.keys(SOURCES)) {
    const src = SOURCES[key];
    if (publicView && PUBLIC_HIDDEN_CLASSES.includes(src.displayClass)) continue;
    const m = payload.metrics[key];
    if (!m || !Number.isFinite(m.value)) continue;
    data = setPath(data, src.path, m.value);
    if (m.stale) anyStale = true;
    else anyLive = true;
    if (m.asOf && (!latestAsOf || m.asOf > latestAsOf)) latestAsOf = m.asOf;
  }

  let badge = "MOCK";
  if (anyLive) badge = "LIVE";
  else if (anyStale) badge = "STALE";
  return { data, badge, asOf: latestAsOf };
}
