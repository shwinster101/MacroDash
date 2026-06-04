// MacroDash v2.0 — end-to-end smoke test (Node, no network).
// Mocks FRED responses and exercises: cron transform, fake-KV round trip,
// Pages function read, merge-over-mock, public-view filter, and security
// assertions (FRED_KEY never appears in any output).
//
// Run:  node test/smoke.mjs

import assert from "node:assert";
import {
  SERIES,
  getLatestValid,
  computeYoY,
  fredUrl,
  buildMacroPayload,
} from "../worker/cron.js";
import { onRequestGet } from "../functions/api/fred.js";
import { mergeLiveOverMock, SOURCES } from "../src/sources.js";

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
};

const FAKE_KEY = "FAKE_FRED_KEY_should_never_leak_1234567890";

// ---- mock FRED responses ------------------------------------------------
// Build a desc-sorted observations array for a "latest" series, with a "." gap
// at the newest position to prove gap-skipping.
function obsLatest(values, startDate = "2026-06-02") {
  // values[0] is newest. Insert a "." as the very newest to test skipping.
  const d = new Date(startDate);
  const out = [{ date: startDate, value: "." }];
  for (let i = 0; i < values.length; i++) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() - (i + 1));
    out.push({ date: dt.toISOString().slice(0, 10), value: String(values[i]) });
  }
  return { observations: out };
}
// 13 monthly index points (newest first) for a YoY series.
function obsYoY(latestIndex, yearAgoIndex) {
  const obs = [];
  for (let i = 0; i < 13; i++) {
    const dt = new Date("2026-04-01");
    dt.setMonth(dt.getMonth() - i);
    // interpolate between yearAgo (i=12) and latest (i=0) just for realism
    const v = i === 0 ? latestIndex : i === 12 ? yearAgoIndex : (latestIndex - (i / 12) * (latestIndex - yearAgoIndex));
    obs.push({ date: dt.toISOString().slice(0, 10), value: v.toFixed(3) });
  }
  return { observations: obs };
}

// series_id -> mock response. One series (VIXCLS) is rigged to FAIL.
const MOCK = {
  DGS10:        obsLatest([4.32, 4.30, 4.28]),
  FEDFUNDS:     obsLatest([3.58, 3.58, 3.58]),
  CPIAUCSL:     obsYoY(322.0, 310.2), // ~3.8% YoY
  CPILFESL:     obsYoY(328.0, 319.1), // ~2.8% YoY
  UNRATE:       obsLatest([4.3, 4.3, 4.2]),
  CIVPART:      obsLatest([62.4, 62.4, 62.5]),
  MORTGAGE30US: obsLatest([6.51, 6.23, 6.26]),
  VIXCLS:       "__FAIL__", // simulate upstream outage
  DCOILWTICO:   obsLatest([96.43, 98.1, 100.2]),
  SP500:        obsLatest([7473.0, 7415.0, 7400.0]),
};

// mock fetch that returns canned FRED JSON or throws for the rigged failure.
function makeMockFetch({ capturedUrls }) {
  return async (url) => {
    capturedUrls.push(url);
    const u = new URL(url);
    const sid = u.searchParams.get("series_id");
    const resp = MOCK[sid];
    if (resp === "__FAIL__") return { ok: false, status: 503, json: async () => ({}) };
    if (!resp) throw new Error(`no mock for ${sid}`);
    return { ok: true, status: 200, json: async () => resp };
  };
}

// fake KV namespace (Map-backed).
function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

// ---- 1. pure helpers ----------------------------------------------------
console.log("\n[1] pure helpers");
ok("getLatestValid skips '.' and returns newest numeric",
  getLatestValid(obsLatest([4.32, 4.30]).observations)?.value === 4.32);
ok("getLatestValid returns null on all-missing",
  getLatestValid([{ date: "2026-06-02", value: "." }]) === null);
{
  const yoy = computeYoY(obsYoY(322.0, 310.2).observations);
  ok("computeYoY ~3.8% from index", yoy && Math.abs(yoy.value - 3.8) < 0.2);
}
ok("computeYoY null when <13 points",
  computeYoY(obsLatest([1, 2, 3]).observations) === null);
{
  const url = fredUrl("DGS10", FAKE_KEY, "latest");
  ok("fredUrl includes series_id + limit=5", url.includes("series_id=DGS10") && url.includes("limit=5"));
  ok("fredUrl uses limit=13 for yoy", fredUrl("CPIAUCSL", FAKE_KEY, "yoy").includes("limit=13"));
}

// ---- 2. cron transform (the real pipeline) ------------------------------
console.log("\n[2] cron buildMacroPayload");
const capturedUrls = [];
const env = { FRED_KEY: FAKE_KEY, PULSE_CACHE: fakeKV() };
const payload = await buildMacroPayload(env, {
  fetchImpl: makeMockFetch({ capturedUrls }),
  now: "2026-06-03T21:00:00.000Z",
  cron: "0 21 * * 1-5",
});

ok("payload has generatedAt", payload.generatedAt === "2026-06-03T21:00:00.000Z");
ok("tenYear parsed = 4.32", payload.metrics.tenYear?.value === 4.32);
ok("cpiHeadline YoY ~3.8", Math.abs(payload.metrics.cpiHeadline?.value - 3.8) < 0.2);
ok("cpiCore YoY ~2.8", Math.abs(payload.metrics.cpiCore?.value - 2.8) < 0.2);
ok("sp500 parsed = 7473", payload.metrics.sp500?.value === 7473.0);
ok("failed VIXCLS recorded in errors", !!payload.errors && !!payload.errors.vix);
ok("failed VIXCLS not present (cold start, no last-good)", !payload.metrics.vix);
ok("displayClass carried on metric", payload.metrics.sp500?.displayClass === "licensed");

// ---- 3. SECURITY: key never leaks --------------------------------------
console.log("\n[3] security — FRED_KEY isolation");
const payloadStr = JSON.stringify(payload);
ok("FRED_KEY absent from KV payload", !payloadStr.includes(FAKE_KEY));
// The key DOES appear in the outbound FRED URL (server-side only) — confirm it
// is present there (so the call works) but that URL never enters the payload.
ok("FRED_KEY used server-side in FRED URL", capturedUrls.some((u) => u.includes(FAKE_KEY)));
ok("no FRED URL (with key) stored in payload", !payloadStr.includes("api_key"));

// ---- 4. merge-over-last-good on failure --------------------------------
console.log("\n[4] robustness — merge over last-good");
// Seed KV with a previous good VIX, then re-run with VIX still failing.
const envWithPrev = {
  FRED_KEY: FAKE_KEY,
  PULSE_CACHE: fakeKV({
    "pulse:macro:latest": JSON.stringify({
      metrics: { vix: { value: 16.81, asOf: "2026-05-22", source: "FRED VIXCLS", displayClass: "citation" } },
    }),
  }),
};
const payload2 = await buildMacroPayload(envWithPrev, {
  fetchImpl: makeMockFetch({ capturedUrls: [] }),
  now: "2026-06-03T21:00:00.000Z",
});
ok("VIX carried forward from last-good", payload2.metrics.vix?.value === 16.81);
ok("carried VIX flagged stale", payload2.metrics.vix?.stale === true);
ok("fresh metrics not flagged stale", payload2.metrics.tenYear?.stale === false);

// ---- 5. Pages function read round-trip ---------------------------------
console.log("\n[5] Pages function GET /api/fred");
const pagesEnv = { PULSE_CACHE: fakeKV({ "pulse:macro:latest": JSON.stringify(payload) }) };
const res = await onRequestGet({ env: pagesEnv });
ok("function returns 200", res.status === 200);
const served = await res.json();
ok("served payload matches stored tenYear", served.metrics.tenYear.value === 4.32);
ok("served body has no api key", !JSON.stringify(served).includes(FAKE_KEY));
ok("cache-control header set", (res.headers.get("cache-control") || "").includes("max-age"));
// cold cache fallback
const coldRes = await onRequestGet({ env: { PULSE_CACHE: fakeKV() } });
const coldBody = await coldRes.json();
ok("cold cache returns valid empty shape", coldRes.status === 200 && coldBody.error === "no_data");

// ---- 6. merge into mock DATA -------------------------------------------
console.log("\n[6] mergeLiveOverMock");
const MOCK_DATA = {
  treasury10y: { current: 0 },
  fedFunds: { rate: 0 },
  cpi: { headline: 0, core: 0 },
  unemployment: { rate: 0, lfpr: 0 },
  mortgage: { national: 0 },
  vix: { current: 0 },
  wti: { price: 0 },
  spx: { index: 0 },
};
const mergedPriv = mergeLiveOverMock(MOCK_DATA, payload, /*publicView=*/ false);
ok("private merge overlays tenYear at path", mergedPriv.data.treasury10y.current === 4.32);
ok("private merge overlays sp500 (licensed) on private view", mergedPriv.data.spx.index === 7473.0);
ok("badge LIVE when fresh values present", mergedPriv.badge === "LIVE");
ok("merge does not mutate original mock", MOCK_DATA.treasury10y.current === 0);

const mergedPub = mergeLiveOverMock(MOCK_DATA, payload, /*publicView=*/ true);
ok("PUBLIC view hides licensed sp500 (stays mock 0)", mergedPub.data.spx.index === 0);
ok("PUBLIC view still shows public tenYear", mergedPub.data.treasury10y.current === 4.32);

const mergedEmpty = mergeLiveOverMock(MOCK_DATA, { metrics: {} }, false);
ok("empty payload => MOCK badge, untouched data", mergedEmpty.badge === "MOCK" && mergedEmpty.data.treasury10y.current === 0);

// ---- 7. coverage check --------------------------------------------------
console.log("\n[7] coverage — SERIES vs SOURCES alignment");
const seriesKeys = Object.keys(SERIES).sort();
const sourceKeys = Object.keys(SOURCES).sort();
ok("worker SERIES keys === front-end SOURCES keys", JSON.stringify(seriesKeys) === JSON.stringify(sourceKeys));
ok("every SOURCES entry has a path", sourceKeys.every((k) => typeof SOURCES[k].path === "string"));

// ---- summary ------------------------------------------------------------
console.log(`\n=== SMOKE TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
