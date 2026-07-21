// MacroDash v2.0.1 — snapshot-contract smoke test (Node, no network).
// SCOPE: the live-data layer this version owns — mergeLiveOverMock over the flat
// {live} shape /api/snapshot returns, plus FEAT-204 path resolution against the
// real dashboard MOCK_DATA. The cron worker + /api/fred are no longer consumed by
// the dashboard, so their internals belong to the worker's own suite, not this gate.

import { readFileSync } from "node:fs";
import { mergeLiveOverMock, SOURCES, isStale, cadenceOf, parseObsDate, isMarketHoliday, MARKET_HOLIDAYS } from "../src/sources.js";
import { computeFiveWhys } from "../src/fiveWhys.js";
import {
  bandSpyVs200d, bandVix, bandFearGreed, bandRs, bandTenYear, bandFedOdds,
  aggregateVerdict, computeMacroFlip, buildTtReadout, formatTtPaste,
} from "../src/ttReadout.js";
import { validateBook, conflictCheck, authMode, lockoutState, recordFailure, parseCookie, hashPin, LOCK_TIERS } from "../functions/api/tt.js";
import { plausible, applyBands, quorum, QUORUM_FIELDS, QUORUM_MIN, marketSession } from "../functions/api/snapshot.js";

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
    fearGreed: 62, fearGreedLabel: "Greed",
    rateOddsHold: 98, rateOddsCut: 1, rateOddsHike: 1, fomcDays: 10, nextFomcDate: "2026-06-17", rateOddsHoldAsOf: "2026-06-07",
    cpiHeadline: 3.9, cpiCore: 2.9, cpiTrend: [3.5, 3.6, 3.7, 3.8, 3.85, 3.9],
    pceHeadline: 3.0, pceCore: 2.8, pceTrend: [2.5, 2.6, 2.7, 2.75, 2.8, 2.8],
    tokenBlendedMtok: 5.4, tokenTrend: [8.0, 7.1, 6.3, 5.4], tokenModelsJson: '[{"name":"Claude Sonnet","mtok":9.0},{"name":"DeepSeek","mtok":1.0}]', tokenBlendedMtokAsOf: "2026-06-12",
    qqqPrice: 720.1, qqqChangePct: 0.6, qqqPriceAsOf: "2026-06-12",
    shillerPe: 38.4, shillerPeAsOf: "2026-06-12",
    mag10PricesJson: '[{"ticker":"NVDA","price":140.5,"chgPct":2.1},{"ticker":"AAPL","price":215.0,"chgPct":-0.3}]', mag10PricesJsonAsOf: "2026-06-12",
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
ok("isStale daily: dead 2019-dated source is stale", isStale("2019-10-04", new Date("2026-06-08")) === true);
// BUGFIX: a legacy M/D/YYYY date must ALSO be recognized as stale (it silently parsed to
// Invalid Date before, so a dead 2019-dated feed could dodge the STALE check and keep voting).
// (The format the retired CBOE feed used — kept as generic legacy-date support.)
ok("isStale: legacy M/D/YYYY 2019 date is stale", isStale("10/04/2019", new Date("2026-06-08")) === true);
ok("parseObsDate: handles both ISO and M/D/YYYY",
  parseObsDate("2026-06-04").getFullYear() === 2026 && parseObsDate("10/04/2019").getFullYear() === 2019);
ok("cadenceOf: monthly for CPI, daily default for VIX", cadenceOf("cpiHeadline") === "monthly" && cadenceOf("vix") === "daily");
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
ok("Kalshi rate-odds overlaid (hold/cut/hike)", mPriv.data.macro.fedFunds.odds.hold === 98 && mPriv.data.macro.fedFunds.odds.cut === 1 && mPriv.data.macro.fedFunds.odds.hike === 1);
ok("FOMC days + next date overlaid", mPriv.data.macro.fedFunds.daysUntil === 10 && mPriv.data.macro.fedFunds.nextFOMC === "2026-06-17");
ok("provenance rateOddsHold LIVE", mPriv.provenance.rateOddsHold === "LIVE");
ok("meta lastRefresh + session overlaid", mPriv.data.lastRefresh === "06/04/2026 14:00 ET" && mPriv.data.session === "OPEN");
ok("CPI YoY overlaid (FRED index→YoY, R10)", mPriv.data.macro.cpi.headline === 3.9 && mPriv.data.macro.cpi.core === 2.9 && mPriv.data.macro.cpi.trend.length === 6);
ok("PCE YoY overlaid (Fed's preferred gauge)", mPriv.data.macro.pce.headline === 3.0 && mPriv.data.macro.pce.core === 2.8 && mPriv.data.macro.pce.trend.length === 6);
ok("tokenomics: blended $/Mtok + trend + models JSON overlaid (moat)",
  mPriv.data.tokenomics.blendedMtok === 5.4 && mPriv.data.tokenomics.trend.length === 4 && JSON.parse(mPriv.data.tokenomics.modelsJson).length === 2);
ok("tokenomics is weekly cadence", cadenceOf("tokenBlendedMtok") === "weekly");
ok("provenance tokenBlendedMtok LIVE", mPriv.provenance.tokenBlendedMtok === "LIVE");
ok("QQQ price + change overlaid (Finnhub equity feed)", mPriv.data.marketPulse.qqq.price === 720.1 && mPriv.data.marketPulse.qqq.changePct === 0.6);
ok("Shiller CAPE overlaid live (multpl), monthly cadence", mPriv.data.macro.shillerPe.current === 38.4 && cadenceOf("shillerPe") === "monthly");
ok("provenance shillerPe LIVE", mPriv.provenance.shillerPe === "LIVE");
ok("Mag 10 live prices passthrough overlaid + parseable", (() => { const a = JSON.parse(mPriv.data.mag10PricesJson); return Array.isArray(a) && a.length === 2 && a[0].ticker === "NVDA"; })());
ok("mag10PricesJson defaults to '[]' in mock baseline (path resolves)", MOCK_DATA.mag10PricesJson === "[]");
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
ok("WHY #4 attributes headwinds as a curated register (not live tape)", /Risk register/.test(fw.whys[3]) && /curated/.test(fw.whys[3]));
// FEAT-DQ: stale factor excluded from the vote tally (headline denominator + WHY #5 caveat)
const fwStale = computeFiveWhys(MOCK_DATA, fwRegime, { stale: new Set(["vix"]) });
ok("5 Whys: denominator drops to /4 when one factor is stale",
  fwStale.headline.includes("/4") && !fwStale.headline.includes("/5"));
ok("5 Whys: WHY #5 flags reduced-signal read when factors excluded", fwStale.whys[4].includes("excluded"));
ok("5 Whys: default (no stale) keeps all 5 factors (DEC-31: P/C retired)", fw.headline.includes("/5"));
// ---- DEC-31 (v3.2): Put/Call fully retired ------------------------------
ok("DEC-31: putCall absent from SOURCES", !("putCall" in SOURCES));
ok("DEC-31: MOCK_DATA no longer carries marketPulse.putCall", MOCK_DATA.marketPulse.putCall === undefined);
ok("DEC-31: dashboard.jsx has zero putCall references", !dashSrc.includes("putCall"));
const snapSrc = readFileSync(new URL("../functions/api/snapshot.js", import.meta.url), "utf8");
ok("DEC-31: fetchPutCall scraper deleted from snapshot.js", !snapSrc.includes("putCall") && !snapSrc.includes("fetchPutCall"));
ok("5 Whys: WHY #5 reads full-signal at 5/5", computeFiveWhys(MOCK_DATA, fwRegime).whys[4].includes("full-signal"));
// FEAT-NEWS WHY #2: only LIVE+fresh fields appear; stale/mock are named as excluded
const fwFresh = computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set(["fearGreed"]) });
ok("WHY #2 includes a fresh field (F&G) and excludes a non-fresh one (VIX)",
  fwFresh.whys[1].includes("F&G") && !fwFresh.whys[1].includes("VIX ") && /Excluded/.test(fwFresh.whys[1]));
// FEAT-NEWS WHY #3: shows a live headline when fresh, falls back to "no fresh headline" otherwise
const withHL = { ...MOCK_DATA, marketPulse: { ...MOCK_DATA.marketPulse, headline: { text: "Peace deal lifts futures", source: "MarketWatch" } } };
ok("WHY #3 renders a fresh market headline when present",
  computeFiveWhys(withHL, fwRegime, { fresh: new Set(["marketHeadline"]) }).whys[2].includes("Peace deal lifts futures"));
ok("WHY #3 falls back when no fresh headline", computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set() }).whys[2].includes("no fresh market headline"));

// ---- 4. ttReadout — TT mapping table (FEAT-330 / DEC-33; gates real orders) ----------
console.log("\n[4] ttReadout — TT band table + verdict + macro flip (every boundary)");
// Band functions (pure, boundary-pinned)
ok("spy_vs_200d: +3.1 bullish, +3.0 neutral, +2.9 neutral", bandSpyVs200d(3.1) === "bullish" && bandSpyVs200d(3.0) === "neutral" && bandSpyVs200d(2.9) === "neutral");
ok("spy_vs_200d: -2.9 neutral, -3.0 neutral, -3.1 bearish", bandSpyVs200d(-2.9) === "neutral" && bandSpyVs200d(-3.0) === "neutral" && bandSpyVs200d(-3.1) === "bearish");
ok("spy_vs_200d: null in -> null", bandSpyVs200d(null) === null && bandSpyVs200d(NaN) === null);
ok("vix: 17.9 bullish, 18 neutral, 25 neutral, 25.1 bearish", bandVix(17.9) === "bullish" && bandVix(18) === "neutral" && bandVix(25) === "neutral" && bandVix(25.1) === "bearish");
ok("fear_greed: 19 bearish, 20 neutral, 24.9 neutral, 25 bullish", bandFearGreed(19) === "bearish" && bandFearGreed(20) === "neutral" && bandFearGreed(24.9) === "neutral" && bandFearGreed(25) === "bullish");
ok("fear_greed: 55 bullish, 56 neutral, 70 neutral, 71 neutral, 75 neutral, 76 bearish", bandFearGreed(55) === "bullish" && bandFearGreed(56) === "neutral" && bandFearGreed(70) === "neutral" && bandFearGreed(71) === "neutral" && bandFearGreed(75) === "neutral" && bandFearGreed(76) === "bearish");
ok("rs: +0.4 leading, 0 inline, -0.4 breaking_down, null->null", bandRs(0.4) === "leading" && bandRs(0) === "inline" && bandRs(-0.4) === "breaking_down" && bandRs(null) === null);
ok("ten_year: -0.11 falling, -0.10 rangebound, +0.15 rangebound, +0.16 spiking", bandTenYear(-0.11) === "falling" && bandTenYear(-0.1) === "rangebound" && bandTenYear(0.15) === "rangebound" && bandTenYear(0.16) === "spiking");
ok("fed_odds: cut 60 bullish, hike 60 bearish, hold 98 neutral, all-null -> null", bandFedOdds({ cut: 60 }) === "bullish" && bandFedOdds({ hike: 60 }) === "bearish" && bandFedOdds({ hold: 98, cut: 1, hike: 1 }) === "neutral" && bandFedOdds({}) === null);

// buildTtReadout — full body against a fresh flat live object (fixed `now` = Wed 2026-07-15)
const TT_NOW = new Date("2026-07-15T14:00:00");
const D = "2026-07-15"; // same-day => not stale
const mkLive = (o = {}) => ({
  spyPrice: 748.1, spyPriceAsOf: D, spyMa200: 700.0, spyChangePct: 0.41,
  vix: 16.1, vixAsOf: D, vixWeekChg: -2.1,
  fearGreed: 62, fearGreedAsOf: D, fearGreedLabel: "Greed",
  qqqChangePct: 0.9, qqqPriceAsOf: D,
  tenYear: 4.46, tenYearAsOf: D, tenYearM1: 0.03,
  rateOddsHold: 98, rateOddsCut: 1, rateOddsHike: 1, rateOddsHoldAsOf: D, nextFomcDate: "2026-09-17", fomcDays: 61,
  ...o,
});
const rBull = buildTtReadout(mkLive(), { now: TT_NOW });
ok("readout: schema-body has the 9 stable top-level keys", ["spy", "vix", "fear_greed", "qqq_spy_rs", "us10y", "fed_odds", "regime", "macro_flip", "attribution"].every((k) => k in rBull));
ok("readout: regime.checks is ALWAYS length 6", rBull.regime.checks.length === 6);
ok("readout: spy pct computed (+6.87% > 3) -> bullish check", rBull.spy.pct_vs_200d === 6.87 && rBull.regime.checks[0].state === "bullish");
ok("readout: qqq_spy_rs leading (0.9-0.41=+0.49 > 0.3) + basis 1d", rBull.qqq_spy_rs.state === "leading" && rBull.qqq_spy_rs.basis === "1d");
ok("readout: bullish-majority -> TAILWIND (SPY+VIX+RS bull, F&G/10Y/Fed neutral)", rBull.regime.verdict === "TAILWIND" && rBull.regime.bullish === 3 && rBull.regime.bearish === 0);
ok("readout: spyMa200 absent -> spy check unavailable, sma200 null (never fabricated)", (() => { const r = buildTtReadout(mkLive({ spyMa200: undefined }), { now: TT_NOW }); return r.spy.sma200 === null && r.regime.checks[0].state === "unavailable"; })());
ok("readout: HEADWIND when bearish-majority", (() => { const r = buildTtReadout(mkLive({ spyPrice: 650, vix: 26, tenYearM1: 0.2 }), { now: TT_NOW }); return r.regime.verdict === "HEADWIND"; })());
ok("readout: NEUTRAL on a 1-1 tie among available checks", (() => { const r = buildTtReadout(mkLive({ spyPrice: 700, vix: 26, tenYearM1: -0.2, fearGreed: 62, qqqChangePct: 0.41, rateOddsHold: 98 }), { now: TT_NOW }); return r.regime.bullish === 1 && r.regime.bearish === 1 && r.regime.verdict === "NEUTRAL"; })());
ok("readout: PANIC (vix 25.1 + F&G 19) overrides a bullish tape", (() => { const r = buildTtReadout(mkLive({ vix: 25.1, fearGreed: 19 }), { now: TT_NOW }); return r.regime.verdict === "PANIC" && r.regime.panic_inputs.panic === true; })());
ok("readout: boundary vix 25 + F&G 19 is NOT panic", buildTtReadout(mkLive({ vix: 25, fearGreed: 19 }), { now: TT_NOW }).regime.panic_inputs.panic === false);
ok("readout: boundary vix 26 + F&G 20 is NOT panic", buildTtReadout(mkLive({ vix: 26, fearGreed: 20 }), { now: TT_NOW }).regime.panic_inputs.panic === false);
ok("readout: INSUFFICIENT with <3 available checks", (() => { const r = buildTtReadout({ vix: 16.1, vixAsOf: D, fearGreed: 62, fearGreedAsOf: D }, { now: TT_NOW }); return r.regime.available === 2 && r.regime.verdict === "INSUFFICIENT"; })());
ok("readout: stale input gated out (fresh value but 10-day-old AsOf -> unavailable)", (() => { const r = buildTtReadout(mkLive({ vixAsOf: "2026-07-01" }), { now: TT_NOW }); return r.vix.value === null && r.regime.checks[1].state === "unavailable"; })());
ok("readout: empty live -> all checks unavailable, verdict INSUFFICIENT", (() => { const r = buildTtReadout({}, { now: TT_NOW }); return r.regime.verdict === "INSUFFICIENT" && r.regime.checks.every((c) => c.state === "unavailable"); })());

// macro_flip truth table (null-safe)
ok("macro_flip: vix 22 not armed, 22.1 armed", computeMacroFlip({ vix: 22 }).armed === false && computeMacroFlip({ vix: 22.1 }).armed === true);
ok("macro_flip: SPY 700<MA710 & VIX 25.1 -> tripped", computeMacroFlip({ vix: 25.1, spyPrice: 700, spyMa200: 710 }).tripped === true);
ok("macro_flip: VIX 25 (not >25) -> not tripped", computeMacroFlip({ vix: 25, spyPrice: 700, spyMa200: 710 }).tripped === false);
ok("macro_flip: SPY above MA -> not tripped", computeMacroFlip({ vix: 26, spyPrice: 720, spyMa200: 710 }).tripped === false);
ok("macro_flip: vix null -> armed null AND tripped null", (() => { const f = computeMacroFlip({ spyPrice: 700, spyMa200: 710 }); return f.armed === null && f.tripped === null; })());
ok("macro_flip: ma200 null + vix 26 -> armed true but tripped null", (() => { const f = computeMacroFlip({ vix: 26, spyPrice: 700 }); return f.armed === true && f.tripped === null; })());

// aggregateVerdict direct
ok("aggregateVerdict: 3 checks, 2 bull 1 bear -> TAILWIND", aggregateVerdict([{ state: "bullish" }, { state: "bullish" }, { state: "bearish" }]).verdict === "TAILWIND");
ok("aggregateVerdict: unavailable checks don't count toward available", aggregateVerdict([{ state: "bullish" }, { state: "unavailable" }, { state: "unavailable" }]).available === 1);

// ---- 5. formatTtPaste — the §1.2 human paste block ----------------------
console.log("\n[5] formatTtPaste (human fallback block)");
const paste = formatTtPaste(rBull, { generatedEt: "2026-07-15 14:00 ET" });
ok("paste: carries REGIME + verdict + MACRO FLIP lines", paste.includes("REGIME") && paste.includes("TAILWIND") && paste.includes("MACRO FLIP"));
ok("paste: honesty footer present (RS basis + not advice)", paste.includes("basis=1d") && paste.includes("not advice"));
ok("paste: null-input body still returns a string with n/a", (() => { const p = formatTtPaste(buildTtReadout({}, { now: TT_NOW })); return typeof p === "string" && p.includes("n/a"); })());
ok("one-wiring-point intact: dashboard.jsx does not fetch readout.json", !dashSrc.includes("readout.json"));

// ---- 6. /api/tt validateBook — the TT book contract ---------------------
// FEAT-TT-RUN: first behavioral coverage of functions/ in this suite. validateBook is
// pure (tt.js's top level is consts + function declarations only), so it imports in Node.
console.log("\n[6] /api/tt validateBook (book contract)");
const okBook = (extra = {}) => ({ book: [{ sym: "NVDA", tier: "S", lens: "AI", note: "n", ...extra }], cut: [] });
const bad = (b) => typeof validateBook(b) === "string";
ok("tt: valid minimal book passes", validateBook(okBook()) === null);
ok("tt: null / non-object body rejected", bad(null) && bad("x"));
ok("tt: missing book array rejected", bad({ cut: [] }));
ok("tt: missing cut array rejected", bad({ book: [] }));
ok("tt: non-object book entry rejected", bad({ book: [null], cut: [] }));
ok("tt: lowercase sym rejected", bad({ book: [{ sym: "nvda", tier: "S", lens: "AI" }], cut: [] }));
ok("tt: sym >8 chars rejected", bad({ book: [{ sym: "ABCDEFGHI", tier: "S", lens: "AI" }], cut: [] }));
ok("tt: unknown tier rejected", bad({ book: [{ sym: "NVDA", tier: "Z", lens: "AI" }], cut: [] }));
ok("tt: all 5 tiers accepted", ["S", "A", "B", "DEF", "WATCH"].every(t =>
  validateBook({ book: [{ sym: "X", tier: t, lens: "AI" }], cut: [] }) === null));
ok("tt: lens >4 chars rejected", bad({ book: [{ sym: "NVDA", tier: "S", lens: "TOOLONG" }], cut: [] }));
ok("tt: note >500 chars rejected", bad(okBook({ note: "x".repeat(501) })));
ok("tt: absent note allowed", validateBook({ book: [{ sym: "NVDA", tier: "S", lens: "AI" }], cut: [] }) === null);
ok("tt: cut entry >12 chars rejected", bad({ book: [], cut: ["ABCDEFGHIJKLM"] }));
// The zero-server-change premise: unknown per-entry keys pass through by design.
ok("tt: lastRun round-trips (unknown key passthrough)", validateBook(okBook({ lastRun: "2026-07-18" })) === null);
ok("tt: fp + rank still pass through", validateBook(okBook({ fp: true, rank: "#1" })) === null);
// FEAT-TT-SAFE: dupes rendered twice but find() resolved only the first — ghost entries.
ok("tt: duplicate sym rejected", bad({ book: [
  { sym: "NVDA", tier: "S", lens: "AI" }, { sym: "NVDA", tier: "A", lens: "AI" }], cut: [] }));
ok("tt: distinct syms still pass", validateBook({ book: [
  { sym: "NVDA", tier: "S", lens: "AI" }, { sym: "PLTR", tier: "A", lens: "AI" }], cut: [] }) === null);
ok("tt: malformed lastRun rejected", bad(okBook({ lastRun: "07/13/2026" })));
ok("tt: non-string lastRun rejected", bad(okBook({ lastRun: 20260713 })));
ok("tt: ISO lastRun accepted", validateBook(okBook({ lastRun: "2026-07-13" })) === null);

// ---- 7. conflictCheck — optimistic concurrency truth table ----------------
// The failure this exists to stop: two devices each PUT a whole book; the later write
// silently erases the earlier one, with no error on either side and no history in KV.
console.log("\n[7] /api/tt conflictCheck (lost-update guard)");
ok("cc: no stored version -> first write always wins", conflictCheck(undefined, undefined) === null);
ok("cc: matching version -> allowed", conflictCheck("1.4", "1.4") === null);
ok("cc: stale version -> conflict", conflictCheck("1.3", "1.4") === "version conflict");
ok("cc: newer-than-server version -> conflict", conflictCheck("1.9", "1.4") === "version conflict");
ok("cc: '*' is an explicit override", conflictCheck("*", "1.4") === null);
ok("cc: absent header is the documented escape hatch", conflictCheck(null, "1.4") === null);
ok("cc: numeric prevVersion compares as string", conflictCheck("1.4", 1.4) === null);

// ---- 8. snapshot.js plausibility bands + quorum gate ---------------------
// FEAT-SNAP-SAFE: first behavioral coverage of snapshot.js. The v3.1 honesty invariant
// checked liveness and provenance but never whether a number could be TRUE; and the old
// health gate counted output keys, so one FRED series could lock in a gutted day.
console.log("\n[8] snapshot.js bands + quorum");
ok("band: normal VIX passes", plausible("vix", 16.7));
ok("band: decimal-shifted VIX rejected", !plausible("vix", 1850));
ok("band: VIX 89.5 (2008 record) still passes", plausible("vix", 89.5));
ok("band: negative VIX rejected", !plausible("vix", -3));
ok("band: NEGATIVE WTI accepted — it really happened 2020-04-20", plausible("wti", -37.63));
ok("band: absurd WTI rejected", !plausible("wti", 1e9));
ok("band: 10Y 15.8 (1981 peak) passes", plausible("tenYear", 15.8));
ok("band: 10Y 250 rejected", !plausible("tenYear", 250));
ok("band: F&G 0 and 100 both valid", plausible("fearGreed", 0) && plausible("fearGreed", 100));
ok("band: F&G 101 rejected", !plausible("fearGreed", 101));
ok("band: CPI deflation -8 passes", plausible("cpiHeadline", -8));
ok("band: CPI 400 rejected", !plausible("cpiHeadline", 400));
ok("band: non-finite rejected", !plausible("vix", Infinity) && !plausible("vix", NaN));
ok("band: absent value passes (nothing to judge)", plausible("vix", undefined) && plausible("vix", null));
ok("band: unbanded key always passes", plausible("someFutureField", 1e12));
ok("applyBands: strips bad, keeps good, reports what it dropped", (() => {
  const live = { vix: 1850, tenYear: 4.5, fearGreed: 37, session: "OPEN" };
  const dropped = applyBands(live);
  return live.vix === undefined && live.tenYear === 4.5 && live.fearGreed === 37
      && live.session === "OPEN" && dropped.length === 1 && dropped[0].startsWith("vix=");
})());
ok("quorum: full set is ok", quorum({ spyPrice: 700, vix: 16, tenYear: 4.5, fearGreed: 37, cpiHeadline: 3.7, shillerPe: 41 }).ok);
ok("quorum: exactly QUORUM_MIN is ok", quorum({ spyPrice: 700, vix: 16, tenYear: 4.5, fearGreed: 37 }).ok);
ok("quorum: one short is NOT ok", !quorum({ spyPrice: 700, vix: 16, tenYear: 4.5 }).ok);
// The regression that motivated this: tenYear alone emits 6 output keys and passed the
// old `fredCount >= 6` gate. It must now fail.
ok("quorum: lone tenYear (old gate's blind spot) is NOT ok", !quorum({
  tenYear: 4.5, tenYearAsOf: "2026-07-17", tenYearD1: 0.02, tenYearW1: 0.1, tenYearM1: 0.2, tenYearSeries: [1, 2] }).ok);
ok("quorum: non-finite values don't count toward quorum", !quorum({ spyPrice: NaN, vix: null, tenYear: "4.5", fearGreed: 37 }).ok);
ok("quorum: reports which fields are missing", (() => {
  const q = quorum({ spyPrice: 700, vix: 16 });
  return q.count === 2 && q.missing.includes("cpiHeadline") && q.missing.includes("shillerPe");
})());
ok("quorum: config sane (min <= field count, all voters named)", QUORUM_MIN <= QUORUM_FIELDS.length && QUORUM_FIELDS.length === 6);

// ---- 8b. /api/tt PIN auth (FEAT-TT-PIN) -----------------------------------
// The PIN is not the wall — the lockout is. Pure + boundary-pinned like DEC-33:
// a wrong tier table here converts "quick PIN" into "open door".
console.log("\n[8b] /api/tt PIN auth (config gate + lockout truth table)");
ok("pin: TT_PIN unset → legacy access mode", authMode({}) === "access");
ok("pin: 6-digit TT_PIN → pin mode", authMode({ TT_PIN: "123456" }) === "pin");
ok("pin: 4-digit TT_PIN → misconfigured (fails CLOSED, never falls back to Access)", authMode({ TT_PIN: "1234" }) === "misconfigured");
ok("pin: non-numeric TT_PIN → misconfigured", authMode({ TT_PIN: "12345a" }) === "misconfigured");
const T0 = 1_800_000_000_000;
ok("lockout: clean slate not locked", lockoutState(null, T0).locked === false && lockoutState(null, T0).fails === 0);
let lockRec = null;
for (let i = 0; i < 4; i++) lockRec = recordFailure(lockRec, T0);
ok("lockout: 4 failures → still open", lockRec.fails === 4 && lockRec.lockedUntil === null && !lockoutState(lockRec, T0).locked);
lockRec = recordFailure(lockRec, T0);
ok("lockout: 5th failure → 15-min lock", lockRec.lockedUntil === T0 + 900_000 && lockoutState(lockRec, T0 + 1).locked === true);
ok("lockout: retry-after counts down", lockoutState(lockRec, T0 + 1000).retryAfterSec === 899);
ok("lockout: lock expires but fails are retained", lockoutState(lockRec, T0 + 901_000).locked === false && lockoutState(lockRec, T0 + 901_000).fails === 5);
for (let i = 0; i < 5; i++) lockRec = recordFailure(lockRec, T0);
ok("lockout: 10th failure → 24h lock", lockRec.fails === 10 && lockRec.lockedUntil === T0 + 86_400_000);
ok("lockout: tier table sane (descending thresholds, escalating locks)",
  LOCK_TIERS[0][0] > LOCK_TIERS[1][0] && LOCK_TIERS[0][1] > LOCK_TIERS[1][1]);
ok("cookie: finds tt_session among other cookies", parseCookie("a=1; tt_session=deadbeef; b=2", "tt_session") === "deadbeef");
ok("cookie: missing / null header → null", parseCookie("a=1; b=2", "tt_session") === null && parseCookie(null, "tt_session") === null);
ok("cookie: exact-name match only (no suffix tricks)", parseCookie("xtt_session=evil", "tt_session") === null);
// v3.10 phone-only setup: the KV pin record stores hashPin(salt, pin) — deterministic,
// salt-bound, guess-sensitive, hex-shaped. (The 6-digit space makes any hash offline-weak
// by construction; the record exists so no plaintext sits at rest, not as a wall.)
const hp1 = await hashPin("aabb", "123456"), hp2 = await hashPin("aabb", "123456");
const hp3 = await hashPin("aabb", "123457"), hp4 = await hashPin("aabc", "123456");
ok("kv-pin: hash deterministic + 64-hex shaped", hp1 === hp2 && /^[a-f0-9]{64}$/.test(hp1));
ok("kv-pin: guess-sensitive (one digit changes the hash)", hp1 !== hp3);
ok("kv-pin: salt-bound (same pin, different salt, different hash)", hp1 !== hp4);

// ---- 8c. terminal source guards (v3.11 — admin.html is buildless, so guard at source) --
// Same technique as the DEC-31 guards on dashboard.jsx: admin.html has no bundler or
// test harness of its own, so the load-bearing strings are pinned here.
console.log("\n[8c] admin.html source guards (regime pill + ET stamping + stamp flow)");
const adminSrc = readFileSync(new URL("../public/admin.html", import.meta.url), "utf8");
ok("terminal: regime pill fetches /readout.json (Engine 0 wired)", adminSrc.includes('fetch("/readout.json"'));
ok("terminal: all five verdict states mapped explicitly",
  ["TAILWIND", "NEUTRAL", "HEADWIND", "PANIC", "INSUFFICIENT"].every((v) => adminSrc.includes(v)));
ok("terminal: INSUFFICIENT and fetch-failure both render as don't-trust states",
  adminSrc.includes("don't gate on this") && adminSrc.includes("unavailable — tap DASH"));
ok("terminal: lastRun stamps the ET date — no UTC toISOString on the run stamp",
  adminSrc.includes('new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"})') &&
  !/fLastRun"\)\.value=new Date\(\)\.toISOString/.test(adminSrc));
ok("terminal: HEADWIND/PANIC modifiers wired to the next-dollar line",
  adminSrc.includes("R/R floors +0.5") && adminSrc.includes("8+ support quality"));
ok("terminal: stamp flow routes through saveCard (persist rails, not a side channel)",
  adminSrc.includes("function stampAndSave(){stampRunToday();saveCard();}"));

// ---- 9. market calendar — holidays across the honesty stack ---------------
// The time-judges (isStale, marketSession/etSession, looksBehind) share ONE
// MARKET_HOLIDAYS table in sources.js. Boundary-pinned like DEC-33: a wrong
// calendar mislabels sessions and cries STALE on the freshest possible data.
console.log("\n[9] market calendar (sessions + staleness share one holiday table)");
ok("calendar: every entry is a weekday ISO date (a weekend 'holiday' would be dead weight)",
  [...MARKET_HOLIDAYS].every((d) => { const day = new Date(`${d}T12:00:00Z`).getUTCDay(); return /^\d{4}-\d{2}-\d{2}$/.test(d) && day !== 0 && day !== 6; }));
ok("holiday: Jul 4 2026 observed Fri Jul 3", isMarketHoliday("2026-07-03"));
ok("holiday: Thanksgiving 2026", isMarketHoliday("2026-11-26"));
ok("holiday: Christmas 2027 observed Fri Dec 24", isMarketHoliday("2027-12-24"));
ok("holiday: a regular Monday is not one", !isMarketHoliday("2026-07-06"));
ok("holiday: unknown year fails open (weekday-only fallback, never a crash)", !isMarketHoliday("2028-01-17"));
ok("isStale: Thu data viewed Mon across Good Friday = FRESH (holiday is not a missed session)",
  isStale("2026-04-02", new Date("2026-04-06")) === false);
ok("isStale: same Thu data viewed Tue = STALE (Monday was a real session)",
  isStale("2026-04-02", new Date("2026-04-07")) === true);
ok("isStale: Wed data viewed Fri across Thanksgiving = FRESH",
  isStale("2026-11-25", new Date("2026-11-27")) === false);
ok("isStale: Thu Dec 24 data viewed Mon Dec 28 = FRESH (Xmas Friday + weekend)",
  isStale("2026-12-24", new Date("2026-12-28")) === false);
ok("session: Good Friday noon ET reads CLOSE", marketSession(new Date("2026-04-03T16:00:00Z")) === "CLOSE");
ok("session: Saturday noon ET reads CLOSE", marketSession(new Date("2026-07-18T16:00:00Z")) === "CLOSE");
ok("session: regular Monday noon ET reads OPEN", marketSession(new Date("2026-07-20T16:00:00Z")) === "OPEN");
ok("session: regular Monday 7am ET reads PRE", marketSession(new Date("2026-07-20T11:00:00Z")) === "PRE");
ok("session: regular Monday 5pm ET reads CLOSE", marketSession(new Date("2026-07-20T21:00:00Z")) === "CLOSE");

console.log(`\n=== SMOKE TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
