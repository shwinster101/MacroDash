// MacroDash v2.0.1 — snapshot-contract smoke test (Node, no network).
// SCOPE: the live-data layer this version owns — mergeLiveOverMock over the flat
// {live} shape /api/snapshot returns, plus FEAT-204 path resolution against the
// real dashboard MOCK_DATA. The cron worker + /api/fred are no longer consumed by
// the dashboard, so their internals belong to the worker's own suite, not this gate.

import { readFileSync } from "node:fs";
import { mergeLiveOverMock, SOURCES } from "../src/sources.js";
import { computeFiveWhys } from "../src/fiveWhys.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name); } };

// Load real MOCK_DATA from dashboard.jsx (catches sources.js <-> dashboard drift).
const dashSrc = readFileSync(new URL("../src/dashboard.jsx", import.meta.url), "utf8");
const _s = dashSrc.indexOf("const MOCK_DATA = {");
let _i = dashSrc.indexOf("{", _s), _d = 0, _e = -1;
for (; _i < dashSrc.length; _i++) { if (dashSrc[_i] === "{") _d++; else if (dashSrc[_i] === "}") { _d--; if (_d === 0) { _e = _i; break; } } }
const MOCK_DATA = eval("(" + dashSrc.slice(dashSrc.indexOf("{", _s), _e + 1) + ")");

// ---- 1. mergeLiveOverMock — snapshot {live} flat shape ------------------
console.log("\n[1] mergeLiveOverMock (snapshot live shape)");
const snapPayload = {
  live: {
    lastRefresh: "06/04/2026 14:00 ET", session: "OPEN",
    spyPrice: 741.2, spyChangePct: 0.41, spyYtd: 7.9, spyMa100: 718.0, spyMa200: 690.5,
    spySeries: [730, 735, 738, 741],
    spxIndex: 7500, spxPrevClose: 7450,
    tenYear: 4.46, tenYearD1: 0.03, tenYearSeries: [4.4, 4.43, 4.46],
    fedFunds: 3.63, unemployment: 4.3, lfpr: 61.8, mortgage30: 6.48,
    wti: 71.2, wtiD1: -0.8, vix: 16.06, vixWeekChg: -2.1, vixSeries: [18, 17, 16.06],
    btc: 109200, btcD1: 1.2,
    fearGreed: 62, fearGreedLabel: "Greed", putCall: 0.79,
  },
  asOf: "2026-06-04T18:00:00Z", cached: false,
};
const mPriv = mergeLiveOverMock(MOCK_DATA, snapPayload, false);
ok("SPY price overlaid (num)", mPriv.data.marketPulse.spy.price === 741.2);
ok("SPY series overlaid (array)", Array.isArray(mPriv.data.marketPulse.spy.series) && mPriv.data.marketPulse.spy.series.length === 4);
ok("SPY ma100/ma200 overlaid", mPriv.data.marketPulse.spy.ma100 === 718.0 && mPriv.data.marketPulse.spy.ma200 === 690.5);
ok("SPX index overlaid (live, $0 extra)", mPriv.data.marketPulse.spx.index === 7500 && mPriv.data.marketPulse.spx.prevClose === 7450);
ok("provenance spxIndex LIVE", mPriv.provenance.spxIndex === "LIVE");
ok("10Y overlaid + d1 + series", mPriv.data.crossAsset.treasury10y.current === 4.46 && mPriv.data.crossAsset.treasury10y.d1 === 0.03 && mPriv.data.crossAsset.treasury10y.series.length === 3);
ok("Fed funds overlaid", mPriv.data.macro.fedFunds.rate === 3.63);
ok("unemployment + lfpr overlaid", mPriv.data.macro.unemployment.national === 4.3 && mPriv.data.macro.unemployment.lfpr === 61.8);
ok("mortgage30 overlaid", mPriv.data.macro.mortgage.national === 6.48);
ok("WTI + d1 overlaid", mPriv.data.crossAsset.wti.current === 71.2 && mPriv.data.crossAsset.wti.d1pct === -0.8);
ok("VIX + weekChg + series overlaid", mPriv.data.marketPulse.vix.current === 16.06 && mPriv.data.marketPulse.vix.weekChg === -2.1 && mPriv.data.marketPulse.vix.series.length === 3);
ok("BTC + d1 overlaid", mPriv.data.crossAsset.btc.current === 109200 && mPriv.data.crossAsset.btc.d1pct === 1.2);
ok("F&G score overlaid (num)", mPriv.data.marketPulse.fearGreed.score === 62);
ok("F&G label overlaid (string)", mPriv.data.marketPulse.fearGreed.label === "Greed");
ok("Put/Call overlaid", mPriv.data.marketPulse.putCall.current === 0.79);
ok("meta lastRefresh + session overlaid", mPriv.data.lastRefresh === "06/04/2026 14:00 ET" && mPriv.data.session === "OPEN");
ok("CPI left as mock (snapshot emits raw index — DEFERRED v2.1)", mPriv.data.macro.cpi.headline === 3.8 && mPriv.data.macro.cpi.core === 2.8);
ok("badge LIVE when cached:false", mPriv.badge === "LIVE");
ok("merge does not mutate original mock", MOCK_DATA.marketPulse.spy.price === 745.83);

const mCached = mergeLiveOverMock(MOCK_DATA, { ...snapPayload, cached: true }, false);
ok("badge CACHED when cached:true", mCached.badge === "CACHED");
const mPub = mergeLiveOverMock(MOCK_DATA, snapPayload, true);
ok("PUBLIC view overlays public SPY", mPub.data.marketPulse.spy.price === 741.2);
ok("PUBLIC view overlays citation VIX (no licensed fields to strip)", mPub.data.marketPulse.vix.current === 16.06);
const mEmpty = mergeLiveOverMock(MOCK_DATA, { live: {} }, false);
ok("empty live => MOCK badge, untouched", mEmpty.badge === "MOCK" && mEmpty.data.marketPulse.spy.price === 745.83);
const mBadShape = mergeLiveOverMock(MOCK_DATA, { metrics: {} }, false);
ok("old {metrics} shape => MOCK (no crash)", mBadShape.badge === "MOCK");
const mInvalid = mergeLiveOverMock(MOCK_DATA, { live: { spyPrice: "x", spySeries: "notarray", fearGreedLabel: 5 }, cached: false }, false);
ok("invalid num rejected (keeps mock)", mInvalid.data.marketPulse.spy.price === 745.83);
ok("invalid series rejected (keeps mock)", mInvalid.data.marketPulse.spy.series[0] === 686);
ok("invalid string rejected (keeps mock label)", typeof mInvalid.data.marketPulse.fearGreed.label === "string" && mInvalid.data.marketPulse.fearGreed.label !== 5);

// ---- 1b. provenance map (per-tile LIVE/CACHED/MOCK) ---------------------
console.log("\n[1b] mergeLiveOverMock provenance map");
ok("provenance spyPrice LIVE (cached:false)", mPriv.provenance.spyPrice === "LIVE");
ok("provenance fearGreed LIVE", mPriv.provenance.fearGreed === "LIVE");
ok("provenance CACHED when cached:true", mCached.provenance.spyPrice === "CACHED");
ok("provenance invalid value => MOCK", mInvalid.provenance.spyPrice === "MOCK");
ok("provenance empty live => all MOCK", Object.values(mEmpty.provenance).every((v) => v === "MOCK"));

// ---- 2. FEAT-204 path-resolution gate -----------------------------------
console.log("\n[2] FEAT-204 — every SOURCES path resolves in real MOCK_DATA");
const resolvePath = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const unresolved = Object.entries(SOURCES).filter(([, s]) => resolvePath(MOCK_DATA, s.path) === undefined).map(([k, s]) => `${k}->${s.path}`);
ok("all SOURCES paths resolve in dashboard MOCK_DATA", unresolved.length === 0);
if (unresolved.length) console.log("   unresolved:", unresolved.join(", "));
ok("CPI fields not mapped (deferred — raw index)", !("cpiHeadline" in SOURCES) && !("cpiCore" in SOURCES) && !("cpiTrend" in SOURCES));
ok("every SOURCES entry has path + valid kind", Object.values(SOURCES).every((s) => typeof s.path === "string" && ["num", "series", "str"].includes(s.kind)));

// ---- 3. computeFiveWhys — rule-based 5 Whys ----------------------------
console.log("\n[3] computeFiveWhys (rule-based 5 Whys)");
const fwRegime = { label: "RISK-ON", sub: "Disinflation + low vol", bullVotes: 4, bearVotes: 1 };
const fw = computeFiveWhys(MOCK_DATA, fwRegime);
ok("returns exactly 5 whys", Array.isArray(fw.whys) && fw.whys.length === 5);
ok("every why is a non-empty string", fw.whys.every((w) => typeof w === "string" && w.length > 0));
ok("headline carries the regime label", typeof fw.headline === "string" && fw.headline.includes("RISK-ON"));
ok("regime descriptor non-empty", typeof fw.regime === "string" && fw.regime.length > 0);
ok("session prefix flips PRE vs CLOSE",
  computeFiveWhys({ ...MOCK_DATA, session: "PRE" }, fwRegime).headline.startsWith("Pre-open") &&
  computeFiveWhys({ ...MOCK_DATA, session: "CLOSE" }, fwRegime).headline.startsWith("Post-close"));
ok("does not throw on MOCK_DATA with default regime", (() => { try { computeFiveWhys(MOCK_DATA); return true; } catch { return false; } })());

console.log(`\n=== SMOKE TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
