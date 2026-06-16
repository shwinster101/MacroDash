// MacroDash v2.0.1 — snapshot-contract smoke test (Node, no network).
// SCOPE: the live-data layer this version owns — mergeLiveOverMock over the flat
// {live} shape /api/snapshot returns, plus FEAT-204 path resolution against the
// real dashboard MOCK_DATA. The cron worker + /api/fred are no longer consumed by
// the dashboard, so their internals belong to the worker's own suite, not this gate.

import { readFileSync } from "node:fs";
import { mergeLiveOverMock, SOURCES, isStale, cadenceOf, parseObsDate } from "../src/sources.js";
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
    spxIndex: 7500, spxPrevClose: 7450, spyPriceAsOf: "2026-06-05",
    tenYear: 4.46, tenYearD1: 0.03, tenYearSeries: [4.4, 4.43, 4.46],
    fedFunds: 3.63, unemployment: 4.3, lfpr: 61.8, mortgage30: 6.48,
    savings: 3.8, savingsTrend: [4.5, 4.4, 4.3, 4.1, 4.0, 3.8], savingsAsOf: "2026-05-01",
    wti: 71.2, wtiD1: -0.8, vix: 16.06, vixWeekChg: -2.1, vixSeries: [18, 17, 16.06],
    btc: 109200, btcD1: 1.2,
    fearGreed: 62, fearGreedLabel: "Greed", putCall: 0.79,
    rateOddsHold: 98, rateOddsCut: 1, rateOddsHike: 1, fomcDays: 10, nextFomcDate: "2026-06-17", rateOddsHoldAsOf: "2026-06-07",
    cpiHeadline: 3.9, cpiCore: 2.9, cpiTrend: [3.5, 3.6, 3.7, 3.8, 3.85, 3.9],
    pceHeadline: 3.0, pceCore: 2.8, pceTrend: [2.5, 2.6, 2.7, 2.75, 2.8, 2.8],
  },
  asOf: "2026-06-04T18:00:00Z", cached: false,
};
const mPriv = mergeLiveOverMock(MOCK_DATA, snapPayload, false);
ok("SPY price overlaid (num)", mPriv.data.marketPulse.spy.price === 741.2);
ok("SPY series overlaid (array)", Array.isArray(mPriv.data.marketPulse.spy.series) && mPriv.data.marketPulse.spy.series.length === 4);
ok("SPY ma100/ma200 overlaid", mPriv.data.marketPulse.spy.ma100 === 718.0 && mPriv.data.marketPulse.spy.ma200 === 690.5);
ok("SPX index overlaid (live, $0 extra)", mPriv.data.marketPulse.spx.index === 7500 && mPriv.data.marketPulse.spx.prevClose === 7450);
ok("provenance spxIndex LIVE", mPriv.provenance.spxIndex === "LIVE");
ok("dataAsOf populated from live[fieldAsOf]", mPriv.dataAsOf.spyPrice === "2026-06-05");
ok("isStale: false when no date", isStale(undefined) === false);
ok("isStale: false same-day", isStale("2099-01-01", new Date("2099-01-01")) === false);
ok("isStale: true when a month behind", isStale("2026-06-01", new Date("2026-07-01")) === true);
ok("isStale: true — Thu data viewed Sun (missed Fri)", isStale("2026-06-04", new Date("2026-06-07")) === true);
ok("isStale: false — Mon data viewed Tue (normal EOD lag)", isStale("2026-06-08", new Date("2026-06-09")) === false);
// FEAT-DQ: cadence-aware staleness — monthly/weekly prints aren't stale at a daily threshold
ok("isStale monthly: false — 5wk-old print is current", isStale("2026-05-01", new Date("2026-06-08"), "monthly") === false);
ok("isStale monthly: true — >70d behind is genuinely stale", isStale("2026-03-01", new Date("2026-06-08"), "monthly") === true);
ok("isStale weekly: false — 6-day-old weekly print is current", isStale("2026-06-04", new Date("2026-06-10"), "weekly") === false);
ok("isStale daily: dead 2019 source is stale (Put/Call)", isStale("2019-10-04", new Date("2026-06-08")) === true);
// BUGFIX: the CBOE M/D/YYYY date must ALSO be recognized as stale (it silently parsed to
// Invalid Date before, so the dead 2019 Put/Call dodged the STALE check and kept voting).
ok("isStale: CBOE M/D/YYYY 2019 date is stale", isStale("10/04/2019", new Date("2026-06-08")) === true);
ok("parseObsDate: handles both ISO and M/D/YYYY",
  parseObsDate("2026-06-04").getFullYear() === 2026 && parseObsDate("10/04/2019").getFullYear() === 2019);
ok("cadenceOf: monthly for CPI, daily default for Put/Call", cadenceOf("cpiHeadline") === "monthly" && cadenceOf("putCall") === "daily");
ok("10Y overlaid + d1 + series", mPriv.data.crossAsset.treasury10y.current === 4.46 && mPriv.data.crossAsset.treasury10y.d1 === 0.03 && mPriv.data.crossAsset.treasury10y.series.length === 3);
ok("Fed funds overlaid", mPriv.data.macro.fedFunds.rate === 3.63);
ok("unemployment + lfpr overlaid", mPriv.data.macro.unemployment.national === 4.3 && mPriv.data.macro.unemployment.lfpr === 61.8);
ok("mortgage30 overlaid", mPriv.data.macro.mortgage.national === 6.48);
ok("savings rate + trend overlaid (PSAVERT)", mPriv.data.macro.savings.rate === 3.8 && mPriv.data.macro.savings.trend.length === 6);
ok("savings is monthly cadence", cadenceOf("savings") === "monthly");
ok("WTI + d1 overlaid", mPriv.data.crossAsset.wti.current === 71.2 && mPriv.data.crossAsset.wti.d1pct === -0.8);
ok("VIX + weekChg + series overlaid", mPriv.data.marketPulse.vix.current === 16.06 && mPriv.data.marketPulse.vix.weekChg === -2.1 && mPriv.data.marketPulse.vix.series.length === 3);
ok("BTC + d1 overlaid", mPriv.data.crossAsset.btc.current === 109200 && mPriv.data.crossAsset.btc.d1pct === 1.2);
ok("F&G score overlaid (num)", mPriv.data.marketPulse.fearGreed.score === 62);
ok("F&G label overlaid (string)", mPriv.data.marketPulse.fearGreed.label === "Greed");
ok("Put/Call overlaid", mPriv.data.marketPulse.putCall.current === 0.79);
ok("Kalshi rate-odds overlaid (hold/cut/hike)", mPriv.data.macro.fedFunds.odds.hold === 98 && mPriv.data.macro.fedFunds.odds.cut === 1 && mPriv.data.macro.fedFunds.odds.hike === 1);
ok("FOMC days + next date overlaid", mPriv.data.macro.fedFunds.daysUntil === 10 && mPriv.data.macro.fedFunds.nextFOMC === "2026-06-17");
ok("provenance rateOddsHold LIVE", mPriv.provenance.rateOddsHold === "LIVE");
ok("meta lastRefresh + session overlaid", mPriv.data.lastRefresh === "06/04/2026 14:00 ET" && mPriv.data.session === "OPEN");
ok("CPI YoY overlaid (FRED index→YoY, R10)", mPriv.data.macro.cpi.headline === 3.9 && mPriv.data.macro.cpi.core === 2.9 && mPriv.data.macro.cpi.trend.length === 6);
ok("PCE YoY overlaid (Fed's preferred gauge)", mPriv.data.macro.pce.headline === 3.0 && mPriv.data.macro.pce.core === 2.8 && mPriv.data.macro.pce.trend.length === 6);
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
ok("CPI + PCE YoY fields now mapped (R10)", ["cpiHeadline","cpiCore","cpiTrend","pceHeadline","pceCore","pceTrend"].every((k) => k in SOURCES));
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
// WHY #1 anchors on SPY/200DMA/CPI/Fed; WHY #5 is the synthesis
ok("WHY #1 is the SPY/200DMA/CPI/Fed core anchor",
  /SPY/.test(fw.whys[0]) && /200-DMA/.test(fw.whys[0]) && /CPI/.test(fw.whys[0]) && /Fed/.test(fw.whys[0]));
ok("WHY #5 is the synthesis (verdict + factor tally)", /Net:/.test(fw.whys[4]) && fw.whys[4].includes("RISK-ON"));
// FEAT-DQ: stale factor excluded from the vote tally (headline denominator + WHY #5 caveat)
const fwStale = computeFiveWhys(MOCK_DATA, fwRegime, { stale: new Set(["putCall"]) });
ok("5 Whys: denominator drops to /5 when one factor is stale",
  fwStale.headline.includes("/5") && !fwStale.headline.includes("/6"));
ok("5 Whys: WHY #5 flags reduced-signal read when factors excluded", fwStale.whys[4].includes("excluded"));
ok("5 Whys: default (no stale) keeps all 6 factors", fw.headline.includes("/6"));
// FEAT-NEWS WHY #2: only LIVE+fresh fields appear; stale/mock are named as excluded
const fwFresh = computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set(["fearGreed"]) });
ok("WHY #2 includes a fresh field (F&G) and excludes a non-fresh one (VIX)",
  fwFresh.whys[1].includes("F&G") && !fwFresh.whys[1].includes("VIX ") && /Excluded/.test(fwFresh.whys[1]));
// FEAT-NEWS WHY #3: shows a live headline when fresh, falls back to "no fresh headline" otherwise
const withHL = { ...MOCK_DATA, marketPulse: { ...MOCK_DATA.marketPulse, headline: { text: "Peace deal lifts futures", source: "MarketWatch" } } };
ok("WHY #3 renders a fresh market headline when present",
  computeFiveWhys(withHL, fwRegime, { fresh: new Set(["marketHeadline"]) }).whys[2].includes("Peace deal lifts futures"));
ok("WHY #3 falls back when no fresh headline", computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set() }).whys[2].includes("no fresh market headline"));

console.log(`\n=== SMOKE TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
