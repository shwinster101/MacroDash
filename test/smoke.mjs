// MacroDash v2.0.1 — snapshot-contract smoke test (Node, no network).
// SCOPE: the live-data layer this version owns — mergeLiveOverMock over the flat
// {live} shape /api/snapshot returns, plus FEAT-204 path resolution against the
// real dashboard MOCK_DATA. The cron worker + /api/fred are no longer consumed by
// the dashboard, so their internals belong to the worker's own suite, not this gate.

import { existsSync, readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { mergeLiveOverMock, SOURCES, isStale, cadenceOf, parseObsDate, isMarketHoliday, MARKET_HOLIDAYS, DERIVED_OF as DERIVED_OF_SRC, DERIVED_EXEMPT, govAsOf } from "../src/sources.js";
import { computeFiveWhys, isMacroMaterial } from "../src/fiveWhys.js";
// C1 (v3.60): the regime engine is a real module now — smoke IMPORTS it instead of lifting
// source text, which is stronger (the actual code runs) and immune to formatting drift.
import { NFCI_TIGHT as REG_NFCI_TIGHT, NFCI_LOOSE as REG_NFCI_LOOSE, REGIME_BAND_TABLE,
  REGIME_QUORUM, verdictFrom, computeRegime as regimeCompute, flipConditions as regimeFlips,
  regimeFactors as regimeFactorRows, voteStyle } from "../src/regime.js";
import { REGIME_FACTOR_FIELDS, FACTOR_FIELD, fieldMode, factorExclusions, buildEvidenceSet } from "../src/evidence.js";
import { LASTVALID_KEY, summarizeEvidence, compareEvidence } from "../src/whatChanged.js";
import {
  bandSpyVs200d, bandVix, bandFearGreed, bandRs, bandTenYear, bandFedOdds,
  aggregateVerdict, computeMacroFlip, buildTtReadout, formatTtPaste, DERIVED_OF,
  conservativeVote, CARRY_SESSIONS, readoutQuality, compareQuality,
} from "../src/ttReadout.js";
import { sessionsBehind } from "../src/sources.js";
import { validateBook, validateBoard, validatePos, conflictCheck, authMode, lockoutState, recordFailure, parseCookie, hashPin, LOCK_TIERS, diffForLedger } from "../functions/api/tt.js";
import { plausible, applyBands, quorum, QUORUM_FIELDS, QUORUM_MIN, marketSession, BANDS,
  pairRs, parseTreasuryCsv, rateOddsStillOpen, chooseTtl, publishIfNoWorse, TTL_MEDIUM, TTL_LOW } from "../functions/api/snapshot.js";
import { etYmd } from "../src/sources.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name); } };

// Load real MOCK_DATA from dashboard.jsx (catches sources.js <-> dashboard drift).
const dashSrc = readFileSync(new URL("../src/dashboard.jsx", import.meta.url), "utf8");
const regimeSrc = readFileSync(new URL("../src/regime.js", import.meta.url), "utf8"); // C1 (v3.60)
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
// FIX-E (v3.49): the denominator is the 6-voter set (FEAT-NFCI v3.43) and comes from
// computeRegime's `counted` when provided — these pins previously froze the pre-NFCI "/5".
const fwStale = computeFiveWhys(MOCK_DATA, fwRegime, { stale: new Set(["vix"]) });
ok("5 Whys: denominator drops to /5 when one of the six factors is stale",
  fwStale.headline.includes("/5") && !fwStale.headline.includes("/6"));
ok("5 Whys: WHY #5 flags reduced-signal read when factors excluded", fwStale.whys[4].includes("excluded"));
ok("5 Whys: default (no stale) keeps all 6 factors (NFCI votes, v3.43)", fw.headline.includes("/6"));
ok("5 Whys FIX-E: computeRegime's own counted/totalFactors govern the denominator when present",
  computeFiveWhys(MOCK_DATA, { ...fwRegime, counted: 4, totalFactors: 6 }).headline.includes("/4") &&
  computeFiveWhys(MOCK_DATA, { ...fwRegime, counted: 4, totalFactors: 6 }).whys[4].includes("2 excluded"));
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
// ---- v3.51 (public audit): freshness is not RELEVANCE ----------------------
// The audit caught a Fidelity death-certificate administrative story rendered as the macro
// "Headline driver" — fresh, dated and correctly attributed, and explaining nothing about
// risk posture. A confidently-irrelevant "why" is worse than no why.
ok("materiality: macro-transmission vocabulary passes across every channel the regime votes on",
  ["Fed holds rates steady", "CPI cools to 2.4%", "Treasury yields spike",
   "Oil surges on OPEC cut", "Stocks sell off as volatility jumps", "New tariffs hit imports",
   "Payrolls miss badly", "Peace deal lifts futures"].every(isMacroMaterial));
ok("materiality: the audit's OWN false positive is rejected — an administrative story is not a driver",
  !isMacroMaterial("Fidelity now requires a death certificate to transfer an account") &&
  !isMacroMaterial("How to pick a financial advisor") &&
  !isMacroMaterial("Best credit cards for travel in 2026"));
ok("materiality: empty / missing text is never material (fails closed)",
  !isMacroMaterial("") && !isMacroMaterial(null) && !isMacroMaterial(undefined));
// The distinction is load-bearing: "we have today's story and it is not macro" is a DIFFERENT
// fact from "no headline arrived", and only the first stops an irrelevant driver being asserted.
const admin = { ...MOCK_DATA, marketPulse: { ...MOCK_DATA.marketPulse,
  headline: { text: "Fidelity now requires a death certificate to transfer an account", source: "MarketWatch" } } };
const fwAdmin = computeFiveWhys(admin, fwRegime, { fresh: new Set(["marketHeadline"]) });
ok("WHY #3: a fresh but non-macro headline is WITHHELD, and the slot says WHY it was withheld",
  /not macro-material/.test(fwAdmin.whys[2]) &&
  !fwAdmin.whys[2].includes("death certificate") &&
  !/no fresh market headline/.test(fwAdmin.whys[2]));
ok("WHY #3: the filter is ONE-WAY — a material headline still renders verbatim, never rewritten",
  computeFiveWhys(withHL, fwRegime, { fresh: new Set(["marketHeadline"]) }).whys[2]
    .includes("Peace deal lifts futures"));

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

// ---- FEAT-DASH-DERIV (v3.40): a derived field inherits its parent's staleness -------------
// isStale() fails OPEN on a missing date (correct for a dated field — nothing to judge), but
// snapshot.js emits vixWeekChg / tenYearM1 / spyChangePct / qqqChangePct with NO AsOf of their
// own, so they sailed past the gate that had just suppressed their own parent. MEASURED on the
// live 2026-07-30 body: `vix` was correctly withheld as stale while tenYearM1 CAST A BEARISH
// VOTE in the regime the dashboard promises "excludes stale/dead inputs".
const STALE_D = "2026-07-01";   // ~2 weeks before TT_NOW => stale on a daily cadence
ok("deriv: a stale parent takes its derivatives down with it (vixWeekChg follows vix)", (() => {
  const r = buildTtReadout(mkLive({ vixAsOf: STALE_D }), { now: TT_NOW });
  return r.vix.value === null && r.vix.week_chg === null;
})());
ok("deriv: a stale 10Y kills the m1 delta, so us10y_trend stops voting", (() => {
  const r = buildTtReadout(mkLive({ tenYearAsOf: STALE_D }), { now: TT_NOW });
  const c = r.regime.checks.find((x) => x.name === "us10y_trend");
  return r.us10y.m1_delta === null && c.state === "unavailable";
})());
ok("deriv: a fresh parent still lets its derivatives through (no over-correction)",
  rBull.vix.week_chg === -2.1 && rBull.us10y.m1_delta === 0.03);
ok("deriv: qqq_spy_rs reports the date it actually GATED on, not a decorative borrow",
  rBull.qqq_spy_rs.as_of === D);
// FEAT-DERIV-OWN (v3.41): DERIVED_OF now lives in sources.js (the module that owns the
// staleness vocabulary) and ttReadout.js re-exports the SAME object — proven by identity,
// not just equal shape, so the paste projection, mergeLiveOverMock, and the readout can never
// silently drift onto two different tables.
ok("deriv: ttReadout.js re-exports the IDENTICAL DERIVED_OF object sources.js owns (no fork)",
  DERIVED_OF === DERIVED_OF_SRC);

// The v3.40 assertion pinned a hardcoded 6-key list — "maps every undated derivative" was true
// only by coincidence, and a new derivative wired into a check could ship untested under a
// green "every". This reconciles DERIVED_OF against the REAL SOURCES map instead: every one of
// the 60 SOURCES keys must be exactly one of (a) a primary pull that snapshot.js stamps its own
// AsOf on, (b) a derivative mapped to its parent, or (c) a dateless meta field with no parent to
// inherit from. Miss a classification and this fails — the whole point.
const PRIMARY_ASOF_FIELDS = [
  "spyPrice", "spxIndex", "qqqPrice", "mag10PricesJson",
  "tenYear", "fedFunds", "unemployment", "lfpr", "savings", "mortgage30",
  "cpiHeadline", "cpiCore", "pceHeadline", "pceCore", "wti", "vix", "btc",
  "hySpread", "igSpread", "creditSpread", "nfci",
  // v3.55: both carry their own AsOf — thirtyYear from its own FRED pull, spread10s30s
  // copied from thirtyYearAsOf (the creditSpread pattern).
  "thirtyYear", "spread10s30s",
  "fearGreed", "marketHeadline", "shillerPe", "tokenBlendedMtok", "rateOddsHold",
];
ok("deriv: PRIMARY_ASOF_FIELDS + DERIVED_OF + DERIVED_EXEMPT partition ALL 63 SOURCES keys (reconciled, not hardcoded)", (() => {
  const keys = Object.keys(SOURCES);
  const derivedKeys = Object.keys(DERIVED_OF);
  const inPrimary = (k) => PRIMARY_ASOF_FIELDS.includes(k);
  const inDerived = (k) => Object.prototype.hasOwnProperty.call(DERIVED_OF, k);
  const inExempt = (k) => DERIVED_EXEMPT.includes(k);
  const unclassified = keys.filter((k) => !inPrimary(k) && !inDerived(k) && !inExempt(k));
  const doubleClassified = keys.filter((k) => [inPrimary(k), inDerived(k), inExempt(k)].filter(Boolean).length > 1);
  const total = PRIMARY_ASOF_FIELDS.length + derivedKeys.length + DERIVED_EXEMPT.length;
  return unclassified.length === 0 && doubleClassified.length === 0 && keys.length === total;
})());
ok("deriv: every DERIVED_OF parent is itself a real SOURCES key (no dangling parent)",
  Object.values(DERIVED_OF).every((p) => p in SOURCES));
ok("deriv: govAsOf falls back to the parent's AsOf, and returns undefined with no parent + no own date",
  govAsOf({ tenYear: 4.5, tenYearAsOf: "2026-07-01" }, "tenYearM1") === "2026-07-01"
  && govAsOf({}, "tenYearM1") === undefined);

// ---- F1 (v3.41 audit finding): the merge itself must inherit AsOf, not just buildTtReadout ----
// The v3.40 fix lived ONLY inside buildTtReadout. But `handleTtCopy` (dashboard.jsx) and every
// tile's `modeOf()` read staleness through `mergeLiveOverMock`'s `dataAsOf`, which never
// consulted DERIVED_OF — so a stale parent's derivative could still read fresh on the ONE
// human-facing paste surface the honesty invariant was written for. Traced live: a stale
// `tenYear` used to skip `put("tenYear")` (and its date) in the paste projection entirely,
// so `tenYearM1` reached buildTtReadout with no date at all and voted anyway.
ok("merge: a derivative with no AsOf of its own inherits the parent's AsOf", (() => {
  const payload = { live: { tenYear: 4.5, tenYearAsOf: "2026-07-01", tenYearM1: 0.23 }, cached: false };
  const { dataAsOf } = mergeLiveOverMock(MOCK_DATA, payload);
  return dataAsOf.tenYearM1 === "2026-07-01" && dataAsOf.tenYearM1 === dataAsOf.tenYear;
})());
ok("merge: modeOf-equivalent staleness now reaches a derivative (isStale sees the inherited date)", (() => {
  const payload = { live: { vix: 14.2, vixAsOf: "2026-07-01", vixWeekChg: 6.8 }, cached: false };
  const { dataAsOf } = mergeLiveOverMock(MOCK_DATA, payload);
  return isStale(dataAsOf.vixWeekChg, new Date("2026-07-30"), cadenceOf("vixWeekChg")) === true;
})());
ok("merge: a fresh parent still lets a derivative read fresh (no over-correction)", (() => {
  const payload = { live: { vix: 14.2, vixAsOf: "2026-07-29", vixWeekChg: 6.8 }, cached: false };
  const { dataAsOf } = mergeLiveOverMock(MOCK_DATA, payload);
  return isStale(dataAsOf.vixWeekChg, new Date("2026-07-30"), cadenceOf("vixWeekChg")) === false;
})());
// The new find: Kalshi's cut/hike/fomcDays/nextFomcDate rode with NO date at all before v3.41 —
// bandFedOdds keys on cut/hike, so a stale Kalshi pull could vote undetected.
ok("merge: Kalshi rateOddsCut/Hike inherit rateOddsHold's AsOf (the field bandFedOdds actually gates)", (() => {
  const payload = { live: { rateOddsHold: 98, rateOddsCut: 1, rateOddsHike: 1, rateOddsHoldAsOf: "2026-07-01" }, cached: false };
  const { dataAsOf } = mergeLiveOverMock(MOCK_DATA, payload);
  return dataAsOf.rateOddsCut === "2026-07-01" && dataAsOf.rateOddsHike === "2026-07-01";
})());

// The circuit must say when it CANNOT SEE. A null armed/tripped read identically to a genuine
// "not armed" — the crash detector could be blind next to a confident verdict, silently.
ok("flip: a blind circuit declares itself and names the missing input", (() => {
  const f = computeMacroFlip({ spyPrice: 700, spyMa200: 690 });
  return f.evaluable === false && /BLIND/.test(f.reason) && /vix/.test(f.reason);
})());
ok("flip: a fully-fed circuit is evaluable with no reason attached", (() => {
  const f = computeMacroFlip({ vix: 30, spyPrice: 600, spyMa200: 700 });
  return f.evaluable === true && f.reason === null && f.armed === true && f.tripped === true;
})());

// SAFETY ASYMMETRY: `available >= 3` is a COUNT, and counts are not safety. With VIX gone the
// PANIC override cannot fire and the flip circuit is blind, so a risk-ON verdict is asserted by
// exactly the inputs that cannot see a crash. Measured 2026-07-30: removing the stale votes took
// the body NEUTRAL -> TAILWIND — more risk-on for knowing less.
ok("safety: TAILWIND is withheld while the risk gauge is blind, and says so", (() => {
  const r = buildTtReadout(mkLive({ vix: undefined, rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW });
  return r.regime.raw_verdict === "TAILWIND" && r.regime.verdict === "NEUTRAL" && /risk gauge/.test(r.regime.downgraded);
})());
ok("safety: the downgrade is ONE-WAY — a bearish read with no VIX still prints HEADWIND", (() => {
  const r = buildTtReadout(mkLive({ vix: undefined, spyPrice: 650, tenYearM1: 0.2 }), { now: TT_NOW });
  return r.regime.verdict === "HEADWIND" && r.regime.downgraded === null;
})());
ok("safety: with VIX healthy a TAILWIND still prints (the gate is the gauge, not the count)",
  rBull.regime.verdict === "TAILWIND" && rBull.regime.downgraded === null);
// v3.41: the v3.40 rule only caught VIX going blind. PANIC needs BOTH vix AND fear_greed live,
// so a dead CNN F&G scraper blinds the exact same override VIX blinds — widened to match.
ok("safety: TAILWIND is ALSO withheld when Fear & Greed (not VIX) is the blind gauge, and names it", (() => {
  const r = buildTtReadout(mkLive({ fearGreed: undefined, fearGreedAsOf: undefined, fearGreedLabel: undefined, rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW });
  return r.regime.raw_verdict === "TAILWIND" && r.regime.verdict === "NEUTRAL" && /Fear & Greed/.test(r.regime.downgraded) && !/VIX/.test(r.regime.downgraded);
})());
ok("safety: with BOTH gauges blind, the downgrade names both", (() => {
  const r = buildTtReadout(mkLive({ vix: undefined, fearGreed: undefined, fearGreedAsOf: undefined, fearGreedLabel: undefined }), { now: TT_NOW });
  return r.regime.downgraded && /VIX/.test(r.regime.downgraded) && /Fear & Greed/.test(r.regime.downgraded);
})());
// ENGINE0-CONT: <3 usable no longer PUBLISHES "INSUFFICIENT" — the operational posture is the
// deterministic wait state (NEUTRAL · LOW · HOLD · DATA DEGRADED); the raw aggregate survives
// in raw_verdict so the record of what the counts said is never silent.
ok("readout: <3 available checks -> NEUTRAL / LOW / HOLD / DATA DEGRADED (raw INSUFFICIENT kept)", (() => { const r = buildTtReadout({ vix: 16.1, vixAsOf: D, fearGreed: 62, fearGreedAsOf: D }, { now: TT_NOW }); return r.regime.available === 2 && r.regime.verdict === "NEUTRAL" && r.regime.raw_verdict === "INSUFFICIENT" && r.regime.confidence === "LOW" && r.regime.actionability === "HOLD" && r.regime.status === "DATA DEGRADED"; })());
ok("readout: stale input gated out (fresh value but 10-day-old AsOf -> unavailable)", (() => { const r = buildTtReadout(mkLive({ vixAsOf: "2026-07-01" }), { now: TT_NOW }); return r.vix.value === null && r.regime.checks[1].state === "unavailable"; })());
ok("readout: empty live -> all checks unavailable, wait posture (never the word INSUFFICIENT as verdict)", (() => { const r = buildTtReadout({}, { now: TT_NOW }); return r.regime.verdict === "NEUTRAL" && r.regime.actionability === "HOLD" && r.regime.status === "DATA DEGRADED" && r.regime.checks.every((c) => c.state === "unavailable"); })());

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

// ---- F3 (v3.41 audit finding): the honesty states must reach the ONE human-facing surface ----
// v3.40 added `evaluable`/`reason` on macro_flip and `downgraded` on regime, but nothing printed
// them: a blind circuit rendered as bare "n/a" (identical to a circuit that simply never ran),
// and a withheld TAILWIND printed as a plain NEUTRAL with no tell at all.
ok("paste: a blind circuit prints BLIND + the missing input, never bare n/a", (() => {
  const r = buildTtReadout(mkLive({ spyMa200: undefined }), { now: TT_NOW }); // vix present, ma200 missing -> flip blind
  const p = formatTtPaste(r, {});
  const flipLine = p.split("\n").find((l) => l.startsWith("MACRO FLIP"));
  return /BLIND/.test(flipLine) && /spy_ma200/.test(flipLine) && !flipLine.trim().endsWith("n/a");
})());
ok("paste: a fully-fed, unarmed circuit still prints 'not armed' (blind and unarmed are NOT the same word)", (() => {
  const p = formatTtPaste(rBull, {});
  return p.split("\n").find((l) => l.startsWith("MACRO FLIP")).includes("not armed");
})());
ok("paste: a withheld TAILWIND prints an explicit warning line naming the blind gauge", (() => {
  const r = buildTtReadout(mkLive({ vix: undefined, rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW });
  const p = formatTtPaste(r, {});
  return /⚠.*TAILWIND withheld/.test(p) && /VIX/.test(p);
})());
ok("paste: a non-withheld verdict carries no warning line", !/⚠/.test(paste));

// ---- ENGINE0-CONT: evidence tiers, historical carry, two-axis contract -------------------
console.log("\n[5b] ENGINE0-CONT — evidence continuity (tiers · carry · confidence · actionability)");

// sessionsBehind: the unit every carry window is expressed in. TT_NOW = Wed 2026-07-15.
ok("sessions: same-day obs = 0 behind", sessionsBehind("2026-07-15", TT_NOW) === 0);
ok("sessions: prior trading day = 0 behind (today's close may not be posted)", sessionsBehind("2026-07-14", TT_NOW) === 0);
ok("sessions: Mon obs on Wed = 1 · Fri obs on Wed = 2 (weekend skipped)",
  sessionsBehind("2026-07-13", TT_NOW) === 1 && sessionsBehind("2026-07-10", TT_NOW) === 2);
ok("sessions: unparseable/absent date = null, never 0", sessionsBehind(null, TT_NOW) === null && sessionsBehind("garbage", TT_NOW) === null);

// conservativeVote: historical bullish -> neutral; bearish and neutral survive.
ok("transform: historical bullish -> neutral · bearish stays · neutral stays",
  conservativeVote("bullish") === "neutral" && conservativeVote("bearish") === "bearish" && conservativeVote("neutral") === "neutral");

// D-boundary (matrix D): VIX's historical vote stays conservative at its exact edge.
ok("carry: VIX exactly AT the 2-session edge -> HISTORICAL, votes conservatively", (() => {
  const r = buildTtReadout(mkLive({ vixAsOf: "2026-07-10" }), { now: TT_NOW }); // 2 sessions behind
  const c = r.regime.checks[1];
  return c.tier === "HISTORICAL" && c.original_vote === "bullish" && c.effective_vote === "neutral" && c.state === "neutral";
})());

// Every named carry policy is pinned at the exact allowed session and one session beyond.
// Dates are deliberately literal test expectations, not calculated from CARRY_SESSIONS: a
// production-window edit must move one of these assertions red until the policy is reviewed.
const carryBoundaryCases = [
  { key: "spy_vs_200d", max: 3, check: 0, edge: "2026-07-09", beyond: "2026-07-08", fields: (d) => ({ spyPriceAsOf: d }) },
  { key: "vix", max: 2, check: 1, edge: "2026-07-10", beyond: "2026-07-09", fields: (d) => ({ vixAsOf: d }) },
  { key: "fear_greed", max: 2, check: 2, edge: "2026-07-10", beyond: "2026-07-09", fields: (d) => ({ fearGreedAsOf: d }) },
  { key: "qqq_spy_rs", max: 3, check: 3, edge: "2026-07-09", beyond: "2026-07-08", fields: (d) => ({ ndxSpxRs: 0.5, ndxSpxRsAsOf: d, ndx1dPct: 0.9, spx1dPct: 0.4, qqqPriceAsOf: d, spyPriceAsOf: d }) },
  { key: "us10y_trend", max: 5, check: 4, edge: "2026-07-07", beyond: "2026-07-06", fields: (d) => ({ tenYearAsOf: d }) },
  { key: "fed_next_meeting", max: 5, check: 5, edge: "2026-07-07", beyond: "2026-07-06", fields: (d) => ({ rateOddsHoldAsOf: d, nextFomcDate: "2099-09-17" }) },
];
for (const c of carryBoundaryCases) {
  ok(`carry boundary: ${c.key} is HISTORICAL at ${c.max} sessions and MISSING at ${c.max + 1}`, (() => {
    const edge = buildTtReadout(mkLive(c.fields(c.edge)), { now: TT_NOW }).regime.checks[c.check];
    const beyond = buildTtReadout(mkLive(c.fields(c.beyond)), { now: TT_NOW }).regime.checks[c.check];
    return edge.tier === "HISTORICAL" && beyond.tier === "MISSING" && beyond.state === "unavailable";
  })());
}

// Matrix B: historical BULLISH evidence can never produce TAILWIND or FULL.
ok("matrix B: all-historical bullish inputs -> never TAILWIND, never FULL", (() => {
  const H = "2026-07-13"; // 1 session behind => HISTORICAL for every daily check
  const r = buildTtReadout(mkLive({ spyPriceAsOf: H, vixAsOf: H, fearGreedAsOf: H, qqqPriceAsOf: H, tenYearAsOf: H, rateOddsHoldAsOf: H }), { now: TT_NOW });
  return r.regime.verdict !== "TAILWIND" && r.regime.actionability !== "FULL" && r.regime.historical === 6;
})());

// Matrix C: historical BEARISH survives (flagged), flip not CLEAR, actionability HOLD.
ok("matrix C: historical VIX 26 keeps its bearish caution, flip ARMED_FROM_LAST_CLOSE, HOLD", (() => {
  const r = buildTtReadout(mkLive({ vix: 26, vixAsOf: "2026-07-13" }), { now: TT_NOW });
  const c = r.regime.checks[1];
  return c.effective_vote === "bearish" && /carried/.test(c.reason) &&
    r.macro_flip.state === "ARMED_FROM_LAST_CLOSE" && r.macro_flip.evaluable === false &&
    r.macro_flip.armed === null && r.regime.actionability === "HOLD";
})());
ok("matrix C: historical VIX <=22 reads UNCONFIRMED_FROM_LAST_CLOSE, never 'not armed'", (() => {
  const r = buildTtReadout(mkLive({ vix: 16.1, vixAsOf: "2026-07-13" }), { now: TT_NOW });
  return r.macro_flip.state === "UNCONFIRMED_FROM_LAST_CLOSE" && r.macro_flip.armed === null;
})());
ok("flip: a fully-current circuit carries state CLEAR/ARMED/TRIPPED + FULL/RESTRICTED/HOLD", (() => {
  const clear = buildTtReadout(mkLive(), { now: TT_NOW }).macro_flip;
  const tripped = buildTtReadout(mkLive({ vix: 26, spyPrice: 650 }), { now: TT_NOW }).macro_flip;
  return clear.state === "CLEAR" && clear.actionability === "FULL" && tripped.state === "TRIPPED" && tripped.actionability === "HOLD";
})());

// Matrix A: the exact 2026-08-03 production shape — the ticket's reproduction case.
ok("matrix A: production shape (SPY+F&G current · VIX missing · RS missing · 10Y historical · Kalshi missing) -> NEUTRAL/LOW/HOLD/DATA DEGRADED", (() => {
  const r = buildTtReadout({
    spyPrice: 748.1, spyPriceAsOf: D, spyMa200: 700.0,
    fearGreed: 62, fearGreedAsOf: D, fearGreedLabel: "Greed",
    tenYear: 4.46, tenYearAsOf: "2026-07-13", tenYearM1: 0.03,
  }, { now: TT_NOW });
  return r.regime.verdict === "NEUTRAL" && r.regime.confidence === "LOW" &&
    r.regime.actionability === "HOLD" && r.regime.status === "DATA DEGRADED" &&
    r.regime.current === 2 && r.regime.historical === 1 && r.regime.missing === 3 &&
    /current VIX unavailable/.test(r.regime.reason);
})());

// PANIC needs CURRENT gauges — a carried print can neither fire nor clear it.
ok("panic: historical vix 26 + current F&G 19 does NOT fire PANIC", (() => {
  const r = buildTtReadout(mkLive({ vix: 26, vixAsOf: "2026-07-13", fearGreed: 19 }), { now: TT_NOW });
  return r.regime.panic_inputs.panic === false && r.regime.verdict !== "PANIC";
})());

// Two-axis contract on a fully-healthy day.
ok("axis: all-current healthy day -> HIGH confidence, FULL actionability, status OK", (() => {
  const r = rBull.regime;
  return r.confidence === "HIGH" && r.actionability === "FULL" && r.status === "OK" && r.current === 6 && r.historical === 0;
})());
ok("axis: Kalshi missing alone -> still HIGH (5 current, both gauges current), and the miss is NAMED in reason", (() => {
  const r = buildTtReadout(mkLive({ rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW }).regime;
  return r.confidence === "HIGH" && /missing: fed_next_meeting/.test(r.reason);
})());

// Matrix G (pure half): odds for a CLOSED event are discarded, never carried.
ok("matrix G: Kalshi odds whose FOMC event date has passed are discarded with the reason named", (() => {
  const r = buildTtReadout(mkLive({ nextFomcDate: "2026-07-01" }), { now: TT_NOW });
  const c = r.regime.checks[5];
  return c.state === "unavailable" && /closed FOMC event/.test(c.reason) && r.fed_odds === null;
})());

// RS pairing: the NASDAQ100/SP500 index pair is preferred and NAMED; the ETF pair is the
// labeled fallback (the dashboard's paste projection only carries SOURCES fields).
ok("rs: ndxSpxRs preferred over the ETF pair and attributed NASDAQ100/SP500", (() => {
  const r = buildTtReadout(mkLive({ ndxSpxRs: 0.5, ndxSpxRsAsOf: D, ndx1dPct: 0.91, spx1dPct: 0.41 }), { now: TT_NOW });
  return r.qqq_spy_rs.pair === "NASDAQ100/SP500" && r.qqq_spy_rs.state === "leading";
})());
ok("rs: without the index pair the ETF fallback still works and says it is the proxy", (() => {
  const r = buildTtReadout(mkLive(), { now: TT_NOW });
  return r.qqq_spy_rs.pair === "QQQ/SPY (ETF proxy)";
})());

// Candidate quality (§7.2): flip-evaluable dominates; asOf epoch is only the tiebreak.
ok("quality: a flip-evaluable candidate beats a blind one regardless of recency", (() => {
  const good = readoutQuality(buildTtReadout(mkLive(), { now: TT_NOW }), 1000);
  const blind = readoutQuality(buildTtReadout(mkLive({ vix: undefined }), { now: TT_NOW }), 2000);
  return compareQuality(good, blind) > 0;
})());
ok("quality: equal evidence -> the newer candidate wins (asOf tiebreak)", (() => {
  const a = readoutQuality(buildTtReadout(mkLive(), { now: TT_NOW }), 2000);
  const b = readoutQuality(buildTtReadout(mkLive(), { now: TT_NOW }), 1000);
  return compareQuality(a, b) > 0 && compareQuality(b, a) < 0;
})());
ok("quality: FEWER historical checks wins when every earlier axis ties", (() => {
  const qualityWith = (historical) => readoutQuality({
    macro_flip: { evaluable: false },
    regime: { current_panic_gauges: 1, current: 3, usable: 5, historical, missing: 1 },
  }, 0);
  const fewer = qualityWith(1);
  const more = qualityWith(2);
  return compareQuality(fewer, more) > 0 && compareQuality(more, fewer) < 0;
})());

// The paste block carries the two-axis contract (the ONE human-facing surface).
ok("paste: EVIDENCE line prints confidence + actionability + counts", (() => {
  const p = formatTtPaste(buildTtReadout({ spyPrice: 748.1, spyPriceAsOf: D, spyMa200: 700 }, { now: TT_NOW }), {});
  return /EVIDENCE\s+LOW/.test(p) && /actionability HOLD/.test(p) && /DATA DEGRADED/.test(p);
})());
ok("paste: a carried-VIX flip prints its FROM_LAST_CLOSE state, never 'not armed'", (() => {
  const p = formatTtPaste(buildTtReadout(mkLive({ vix: 26, vixAsOf: "2026-07-13" }), { now: TT_NOW }), {});
  const l = p.split("\n").find((x) => x.startsWith("MACRO FLIP"));
  return /ARMED_FROM_LAST_CLOSE/.test(l) && !/not armed/.test(l);
})());
ok("paste/readout: the literal verdict INSUFFICIENT is never published", (() => {
  const r = buildTtReadout({}, { now: TT_NOW });
  return r.regime.verdict !== "INSUFFICIENT" && !formatTtPaste(r, {}).split("\n").some((l) => l.startsWith("REGIME") && /INSUFFICIENT/.test(l));
})());

// ---- ENGINE0-CONT: snapshot continuity helpers (functions/api/snapshot.js, pure) ---------
console.log("\n[5c] ENGINE0-CONT — snapshot continuity (pairing · treasury · rollover · publish gate)");

// Matrix E: NASDAQ100/SP500 same-date pairing — no matched pair, no RS.
const NDXFIX = { latest: 23000, prev: 22770, latestDate: "2026-07-15", prevDate: "2026-07-14" };
const SPXFIX = { latest: 7481, prev: 7450, latestDate: "2026-07-15", prevDate: "2026-07-14" };
ok("pairRs: matched dates -> rs = ndx1d - spx1d, dated from the pair", (() => {
  const r = pairRs(NDXFIX, SPXFIX);
  return r && r.rs === parseFloat((r.ndx1d - r.spx1d).toFixed(2)) && r.asOf === "2026-07-15";
})());
ok("matrix E: latest-date mismatch -> null (no RS from a cross-day pair)",
  pairRs({ ...NDXFIX, latestDate: "2026-07-14", prevDate: "2026-07-13" }, SPXFIX) === null);
ok("matrix E: PRIOR-date mismatch also refuses (both legs of the delta must pair)",
  pairRs({ ...NDXFIX, prevDate: "2026-07-13" }, SPXFIX) === null);
ok("pairRs: absent/non-finite leg -> null, never a fabricated 0",
  pairRs(null, SPXFIX) === null && pairRs({ ...NDXFIX, latest: NaN }, SPXFIX) === null);

// Matrix F: Treasury daily par-yield CSV parse (the official upstream DGS10 republishes).
const TCSV = 'Date,"1 Mo","10 Yr","30 Yr"\n07/15/2026,5.1,4.46,4.9\n07/14/2026,5.1,4.43,4.9\n07/11/2026,5.1,4.40,4.9';
ok("matrix F: Treasury CSV -> tenYear + D1 + real ISO AsOf + UST attribution", (() => {
  const t = parseTreasuryCsv(TCSV);
  return t && t.tenYear === 4.46 && t.tenYearAsOf === "2026-07-15" &&
    t.tenYearD1 === 0.03 && /UST/.test(t.tenYearSource);
})());
ok("matrix F: a CSV without a 10 Yr column -> null (parse failure, never a guessed column)",
  parseTreasuryCsv('Date,"1 Mo"\n07/15/2026,5.1') === null);

// Matrix G (transport half): stored Kalshi odds survive only while their event is open.
ok("matrix G: last-good odds for a FUTURE event are servable; a PAST event's are discarded", (() => {
  const today = etYmd(new Date());
  return rateOddsStillOpen({ nextFomcDate: "2099-01-01" }) === true &&
    rateOddsStillOpen({ nextFomcDate: "2020-01-01" }) === false &&
    rateOddsStillOpen({ nextFomcDate: today }) === true &&   // meeting day: still open
    rateOddsStillOpen({}) === false;                          // undated: fail closed
})());

// §7.3 TTL policy: named, confidence-driven (deliberately NOT actionability-driven — a
// tripped flip on fully-current data must not hammer upstreams all day).
ok("ttl: HIGH -> daily lock · MEDIUM -> 15m · LOW -> 5m", (() => {
  const mk = (c) => ({ regime: { confidence: c } });
  return chooseTtl(mk("HIGH")) === 48 * 3600 && chooseTtl(mk("MEDIUM")) === TTL_MEDIUM &&
    chooseTtl(mk("LOW")) === TTL_LOW && TTL_MEDIUM === 15 * 60 && TTL_LOW === 5 * 60;
})());

// Matrix H/I: the publish gate — build-before-publish, never replace a better snapshot.
const mkKV = (init = {}) => {
  const store = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    async get(k, type) { const v = store.get(k); return v == null ? null : (type === "json" ? JSON.parse(v) : v); },
    async put(k, v) { store.set(k, String(v)); },
    _store: store,
  };
};
const TODAY_ET = etYmd(new Date());
const liveToday = (o = {}) => ({
  spyPrice: 748.1, spyPriceAsOf: TODAY_ET, spyMa200: 700.0, spyChangePct: 0.41,
  vix: 16.1, vixAsOf: TODAY_ET, fearGreed: 62, fearGreedAsOf: TODAY_ET, fearGreedLabel: "Greed",
  qqqChangePct: 0.9, qqqPriceAsOf: TODAY_ET, tenYear: 4.46, tenYearAsOf: TODAY_ET, tenYearM1: 0.03,
  rateOddsHold: 98, rateOddsCut: 1, rateOddsHike: 1, rateOddsHoldAsOf: TODAY_ET, nextFomcDate: "2099-09-17", fomcDays: 61,
  ...o,
});
ok("matrix H: a WORSE candidate is refused — the good stored snapshot survives", await (async () => {
  const goodSnap = { live: liveToday(), asOf: "2026-08-03T12:00:00Z" };
  const kv = mkKV({ "k": goodSnap });
  const gutted = { live: { spyPrice: 748.1, spyPriceAsOf: TODAY_ET, spyMa200: 700 }, asOf: "2026-08-03T13:00:00Z", _diag: {} };
  const res = await publishIfNoWorse({ PULSE_CACHE: kv }, "k", gutted, buildTtReadout(gutted.live, {}));
  const stored = JSON.parse(kv._store.get("k"));
  return res.published === false && /worse/.test(res.reason) && stored.live.vix === 16.1;
})());
ok("matrix I: a BETTER candidate replaces a gutted stored snapshot", await (async () => {
  const gutted = { live: { spyPrice: 748.1, spyPriceAsOf: TODAY_ET, spyMa200: 700 }, asOf: "2026-08-03T12:00:00Z" };
  const kv = mkKV({ "k": gutted });
  const full = { live: liveToday(), asOf: "2026-08-03T13:00:00Z", _diag: {} };
  const res = await publishIfNoWorse({ PULSE_CACHE: kv }, "k", full, buildTtReadout(full.live, {}));
  const stored = JSON.parse(kv._store.get("k"));
  return res.published === true && res.improved === true && stored.live.vix === 16.1;
})());
// Matrix K: refresh endpoint security — the guard paths are pure (they return before any
// upstream fetch), so they run here; the authed happy path is browser-tested with a stub.
const { onRequestGet: refreshGet, onRequestPost: refreshPost } = await import("../functions/api/snapshot/refresh.js");
const mkRefreshReq = (method, headers = {}, body = null) => ({
  method, url: "https://macrodash.pages.dev/api/snapshot/refresh",
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body ?? {},
});
ok("matrix K: GET /api/snapshot/refresh -> 405 naming POST (a mutation never rides a GET)", await (async () => {
  const r = await refreshGet();
  return r.status === 405 && r.headers.get("Allow") === "POST";
})());
ok("matrix K: cross-origin POST -> 403 before any work", await (async () => {
  const r = await refreshPost({ request: mkRefreshReq("POST", { origin: "https://evil.example" }), env: {} });
  return r.status === 403;
})());
ok("matrix K: anonymous POST fails CLOSED (401/403/503 — never a build, never a 200)", await (async () => {
  const r = await refreshPost({ request: mkRefreshReq("POST", {}), env: {} });
  return r.status >= 401 && r.status <= 503;
})());
ok("matrix K: a WRONG x-refresh-token does not open the server path", await (async () => {
  const r = await refreshPost({ request: mkRefreshReq("POST", { "x-refresh-token": "wrong" }), env: { REFRESH_TOKEN: "right" } });
  return r.status >= 401 && r.status <= 503;
})());

ok("publish: equal-quality NEWER candidate publishes but is NOT called an improvement", await (async () => {
  const a = { live: liveToday(), asOf: "2026-08-03T12:00:00Z" };
  const kv = mkKV({ "k": a });
  const b = { live: liveToday(), asOf: "2026-08-03T13:00:00Z", _diag: {} };
  const res = await publishIfNoWorse({ PULSE_CACHE: kv }, "k", b, buildTtReadout(b.live, {}));
  return res.published === true && res.improved === false;
})());
ok("publish: equal-quality OLDER candidate is refused and the newer stored snapshot survives", await (async () => {
  const newer = { live: liveToday(), asOf: "2026-08-03T13:00:00Z" };
  const kv = mkKV({ "k": newer });
  const older = { live: liveToday(), asOf: "2026-08-03T12:00:00Z", _diag: {} };
  const res = await publishIfNoWorse({ PULSE_CACHE: kv }, "k", older, buildTtReadout(older.live, {}));
  const stored = JSON.parse(kv._store.get("k"));
  return res.published === false && /worse/.test(res.reason) && stored.asOf === newer.asOf;
})());
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
// FEAT-TT-DD (v3.12): deep-dive tabs. The payload rides validateBook's deliberate
// unknown-key passthrough — pin the passthrough behaviorally, and the client-side
// contract at source (admin.html is buildless).
ok("dd: deepDive payload passes server validateBook (passthrough is load-bearing)",
  validateBook({ book: [{ sym: "NBIS", tier: "S", lens: "AI",
    deepDive: { thesis_version: "v3.0", updated: "2026-07-21", pt_ladder: { 2028: [113, 255, 437] } } }], cut: [] }) === null);
ok("dd: contract requires thesis_version + updated (fail-closed honesty chip)",
  adminSrc.includes('"thesis_version (string) is required"') && adminSrc.includes("the honesty chip depends on it"));
ok("dd: hinge states pinned to green|amber|red|unknown", adminSrc.includes("green|amber|red|unknown"));
// v3.25: hinges collapse by default (11 names now carry them), but collapsing is only
// safe because the summary carries the signal — a hidden red would be stored-but-invisible.
ok("hinge: collapsed behind a details, not rendered open on every tab",
  adminSrc.includes('<details class="schema dd-sec"'));
ok("hinge: summary tallies every state so the signal survives the collapse",
  adminSrc.includes("HINGES (${dd.hinges.length})") && adminSrc.includes("red</span>") && adminSrc.includes("unknown</span>"));
ok("hinge: summary is coloured by the WORST state present",
  adminSrc.includes('const worst=n.red?"var(--red)":n.amber?"var(--amber)"'));
ok("hinge: a red hinge force-opens the section rather than hiding behind a chevron",
  adminSrc.includes('${n.red?" open":""}'));
ok("hinge: unrecognised states fall into unknown, never silently into green",
  (adminSrc.match(/\["green","amber","red"\]\.includes\(g\.state\)/g) || []).length >= 2);
ok("dd: per-payload size cap present (45KB — 8KB v3.13, 15KB v3.63, 45KB v3.70 owner call)",
  adminSrc.includes("DD_MAX=45*1024"));
ok("dd: the payload cap states that the BOOK cap binds first (38 x 45KB = 1.7MB vs the 300KB MAX_BODY)",
  /binding constraint is the BOOK/.test(adminSrc) && /1\.7MB/.test(adminSrc) && /5\.8x the book cap/.test(adminSrc));
ok("dd: past key-dates flag 'passed — re-confirm' (the FOMC lesson)", adminSrc.includes("passed — re-confirm"));
ok("dd: rendered payload strings are HTML-escaped (esc used in the deep renderer)",
  adminSrc.includes("function esc(") && adminSrc.includes("${esc(dd.thesis_version)}"));
ok("dd: export carries DEEP_DIVE sections (persistence rule survives the port)",
  adminSrc.includes("### DEEP_DIVE: ${x.sym}"));
ok("dd: import validates deepDive before overwriting the book", adminSrc.includes("deep dive: "));
// v3.13 corpus-native: the uploaded deep-dive JSONs must parse AS-IS.
ok("dd: as_of aliases updated (corpus files carry as_of)", adminSrc.includes("dd.updated||dd.as_of"));
ok("dd: key_dates accept event alias; hinges accept id/role alias",
  adminSrc.includes("k.label||k.event") && adminSrc.includes("g.label||g.key||g.id") && adminSrc.includes("g.note||g.role"));
ok("dd: dilution grid computed from the pre-committed rule (100 × $B ÷ price)", adminSrc.includes("100*b/px"));
ok("dd: gates board renders de-risked fraction as a bar", adminSrc.includes("% de-risked"));
ok("dd: tape section stamped NOT live", adminSrc.includes("· NOT live"));
ok("dd: unknown payload keys fall back to generic render (stored is never invisible)",
  adminSrc.includes("!DD_HANDLED.has"));
// FEAT-TT-3Q (v3.14): the three questions, with the framework's discipline encoded.
ok("3q: projection rides validateBook passthrough",
  validateBook({ book: [{ sym: "TEST", tier: "S", lens: "AI",
    projection: { as_of: "2026-07-22", rev_3yr: { value_B: 12, year: 2029 },
      margins: { path: "expanding", why: "scale" }, multiple: { value: 30, basis: "fwd P/E" } } }], cut: [] }) === null);
ok("3q: Q1 demands a SPECIFIC number", adminSrc.includes("SPECIFIC revenue number"));
ok("3q: Q2 pinned to expanding|holding|compressing AND requires the why",
  adminSrc.includes('["expanding","holding","compressing"]') && adminSrc.includes("WHY behind the margin call"));
ok("3q: the one line of math is computed, never typed", adminSrc.includes("Future price = ") && adminSrc.includes("p.eps_3yr*p.multiple.value"));
ok("3q: flywheel needs double-digit rev CAGR and lights only on three true engines",
  adminSrc.includes(">=0.10") && adminSrc.includes("rev===true&&marg===true&&mult===true") && adminSrc.includes("FLYWHEEL — three engines on"));
ok("3q: coverage strip counts projected names", adminSrc.includes("projected"));
ok("3q: export carries the PROJECTIONS table", adminSrc.includes("PROJECTIONS — the 3 questions"));
ok("3q: import validates projections before overwriting the book", adminSrc.includes(" projection: "));
// v3.15 consensus table + v3.17 PT ladder merged into ESTRUN (v3.35) — one year axis,
// one table. The doctrines survive the merge and stay pinned here.
ok("consensus: the estimate-run table renders rev + EPS + analyst count", adminSrc.includes("function ddEstRunSec") && adminSrc.includes("<th>EPS</th>"));
ok("consensus: thin coverage (<=2 analysts) dims the row", adminSrc.includes("n<=2") && adminSrc.includes("thin coverage, not a forecast"));
ok("consensus: negative EPS renders red, positive green", adminSrc.includes('e<0?"var(--red)":"var(--green)"'));
// Membership, not adjacency: the earlier version pinned the literal '"pt_ladder","consensus"'
// and broke the moment a key was inserted between them. Parse the set and check contents.
const DD_HANDLED_SRC = (adminSrc.match(/DD_HANDLED=new Set\(\[([\s\S]*?)\]\)/) || [])[1] || "";
ok("consensus: registered as a handled section (not generic fallback)", /"consensus"/.test(DD_HANDLED_SRC));
ok("ptc: consensus PT ladder renders separately from the model's own pt_ladder",
  adminSrc.includes("function ddPtConsensusSec") && adminSrc.includes("Consensus-derived PT ladder") && /"pt_consensus"/.test(DD_HANDLED_SRC));
ok("ptc: scenario columns derived from the rows (no code change for a 3rd case)",
  adminSrc.includes("years.flatMap(y=>Object.keys(pc.rows[y]||{}))"));
ok("ptc: floor/bear/severe columns render dimmed", adminSrc.includes("/floor|bear|severe/i.test(c)"));
ok("dd: CLEAR empties the editor without saving (paste-over on mobile)",
  adminSrc.includes("function ddClear()") && adminSrc.includes("⌫ CLEAR"));
// v3.17 FEAT-TT-PTM: the PT ladder is COMPUTED from inputs — the dilution-grid rule
// applied to price targets, so one consensus revision moves every row in lockstep.
ok("ptm: registered as a handled section", /"pt_model"/.test(DD_HANDLED_SRC));
ok("ptm: rows computed from the model, never typed",
  adminSrc.includes("(mult*rev[fwd]+nc)*1000/sh") && adminSrc.includes("computed — edit inputs, not rows"));
ok("ptm: revenue/EPS default to the sibling consensus block (one source of estimate truth)",
  adminSrc.includes("m.revenue_B||c.revenue_B") && adminSrc.includes("m.eps||c.eps"));
ok("ptm: floor renders n/m where EPS <= 0 (no P/E before profit)", adminSrc.includes('e>0?fmt(pe*e):"n/m"'));
ok("ptm: schedules accept per-year maps with nearest-key fallback", adminSrc.includes("function schedAt"));
ok("ptm: past year-end rows auto-drop (>= current ET year)", adminSrc.includes(".filter(y=>y>=y0)"));
// v3.17 FEAT-TT-DOT: dots inventory — capture is judgment-free; states change at triage.
ok("dot: dots ride validateBook passthrough at ENTRY level (survive payload replacement)",
  validateBook({ book: [{ sym: "NBIS", tier: "S", lens: "AI",
    dots: [{ t: "2026-07-27", note: "x", state: "new" }] }], cut: [] }) === null);
ok("dot: capture stamps the ET date (no UTC roll — the lastRun lesson)",
  adminSrc.includes('const dot={t:new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"}),state:"new"}'));
ok("dot: pointer caps enforced (line + URL, never article bodies)",
  adminSrc.includes("DOT_NOTE_MAX=800") && adminSrc.includes("DOT_URL_MAX=500"));
ok("dot: the capture box is a multi-line textarea (v3.48 — a single-line input clipped pastes)",
  /<textarea id="dotIn"/.test(adminSrc));
ok("dot: keep-last-N prune never silently drops a NEW dot",
  adminSrc.includes("DOT_KEEP=30") && adminSrc.includes('!=="new")x.dots.splice'));
ok("dot: promoted dots name the field they changed", adminSrc.includes('d.state==="promoted"&&d.into'));
ok("dot: only http(s) URLs render as links", adminSrc.includes('/^https?:\\/\\//i.test(d.url)'));
ok("dot: coverage strip counts untriaged dots", adminSrc.includes("new dots"));
// v3.18 FEAT-TT-UPSIDE: computed cross-book upside — separate from the human-ranked
// NEXT DOLLAR queue, and sharing ptModelRows() so the ranked number can never drift
// from the deep-dive table it came from.
ok("upside: shares ptModelRows with the deep-dive table (one computation, not two)",
  adminSrc.includes("function ptModelRows(dd,_y0)") && adminSrc.includes("const rows=ptModelRows(dd);"));
ok("upside: ranks ALL tiers, not just the watchlist queue (S/A/B/DEF included)",
  /BOOK\.forEach\(x=>\{\s*const dd=x\.deepDive/.test(adminSrc));
// Pin the two INVARIANTS (a usable ref_px, and at least one usable rung), not the exact
// expression — the horizon refactor moved this code and a literal match broke on it.
// v3.36: the gate is a USABLE price (live preferred, stamp as fallback) — it used to demand
// a hand-STAMPED ref_px, which silently excluded any modelled name nobody had stamped.
ok("upside: requires a usable price AND a pt_model rung — never guesses either",
  adminSrc.includes("if(!ref)return;") &&
  adminSrc.includes("const ref=(live&&isFinite(live.px)&&live.px>0)?{px:live.px,at:live.at,live:true,chg:live.chg}:stamp;") &&
  /ptModelRows\(dd\)\.(find|filter)\(r=>typeof r\.prem==="number"\|\|typeof r\.fl==="number"\)/.test(adminSrc));
ok("upside: a live quote alone qualifies — an unstamped name is no longer silently excluded",
  adminSrc.includes("a name with a full") && adminSrc.includes("model and a LIVE quote was excluded outright"));
ok("upside: explicitly labeled math-only, not a recommendation",
  adminSrc.includes("math only, not a recommendation"));
ok("upside: stale/never TT runs keep their honesty flag on the ranked pick",
  adminSrc.includes('r.rs.k==="never"?`<span class="bad2">○ no TT run on record</span>'));
ok("upside: DOM anchor separate from the human NEXT DOLLAR widget", adminSrc.includes('id="upsideRank"'));
// Invariant: both board strips render in the same pipeline pass (order, not exact string).
ok("upside: wired into the render pipeline",
  /renderNextDollar\(\);[\s\S]{0,80}renderUpsideRank\(\);[\s\S]{0,200}renderCoverage\(\)/.test(adminSrc));
// v3.26 FEAT-TT-BINCAL: scheduled binaries surface board-level, not one tab at a time.
ok("bincal: aggregates future key_dates across the whole book",
  adminSrc.includes("function renderBinaryCal()") && adminSrc.includes("x.deepDive&&x.deepDive.key_dates"));
ok("bincal: past dates are excluded from the queue", adminSrc.includes("k.date<today)return;"));
ok("bincal: flags the no-new-adds window without enforcing it",
  adminSrc.includes("const BINARY_WINDOW_D=10;") && adminSrc.includes("reported, not enforced"));
ok("bincal: wired into the render pipeline", adminSrc.includes("renderBinaryCal();"));
// v3.27 FEAT-TT-AGREE: gap story and quality story married, never merged.
ok("agree: ttInfo extracts a verdict from harness-written fields (object or prose)",
  adminSrc.includes("function ttInfo(dd)") && adminSrc.includes("dd.status_flags.composite"));
ok("agree: tier derived from score via the framework map when only a score exists",
  adminSrc.includes('score>=8.5?"S":score>=7?"A":score>=5.5?"B":"C"'));
ok("agree: every chip carries its TT verdict, unscored shown as TT — (never blank)",
  adminSrc.includes('`<span class="scope">TT —</span>`') && adminSrc.includes("TT ${esc(lab)}"));
ok("agree: red hinge count rides the chip beside the verdict",
  adminSrc.includes("● ${r.redH} red"));
ok("agree: the green line lights only on gap AND quality AND R/R AND binary window",
  adminSrc.includes("ELIGIBLE NEXT DOLLAR — all gates passed") && adminSrc.includes('"no gap"') &&
  adminSrc.includes("quality fails") && adminSrc.includes("R/R fails its floor") &&
  adminSrc.includes("no-new-adds"));
// ---- FIX-B (v3.49, VALUE_PROPOSITION_AUDIT Critical #2): eligibility hard gates ----
// The audit caught the green pick lighting with stance UNKNOWN, Macro Flip blind, and a
// NEVER RUN name. Each is now a named veto, and an unreadable regime feed fails CLOSED.
ok("FIX-B: an unknown stance vetoes the green line (a live regime read is mandatory)",
  adminSrc.includes("stance UNKNOWN — no measured or asserted regime; a live regime read is mandatory before an add"));
ok("FIX-B: a blind or absent Macro Flip vetoes — fail closed, never default-to-clear",
  adminSrc.includes("mf.evaluable===false?(mf.reason||") &&
  adminSrc.includes("readout carries no Macro Flip block") &&
  adminSrc.includes("regime feed unavailable — Macro Flip cannot be read"));
ok("FIX-B: the eligibility veto reads readiness()'s OWN blockers — one derivation, not a second opinion",
  adminSrc.includes("if(r.rdy.blockers.length)return `evidence: ${r.rdy.blockers.join(\", \")}`;") &&
  adminSrc.includes("rdy:readiness(x)"));
ok("FIX-B: a failed gate renders WAIT and leaves no stale AGREE_PICK behind",
  adminSrc.includes("NEXT DOLLAR: WAIT — eligibility gate failed"));
ok("FIX-B: red hinges stay surfaced-not-vetoed on the green line (D3 doctrine, v3.39)",
  adminSrc.includes("not a veto (yours to weigh)"));
// FIX-C: the two rankings carry the labels for what they actually are.
ok("FIX-C: math list is labelled VALUATION GAP — math only; funding list is FUNDING PRIORITY",
  adminSrc.includes("VALUATION GAP — math only · ranked by %/yr, weight-aware") &&
  adminSrc.includes("FUNDING PRIORITY") && !adminSrc.includes("NEXT DOLLAR — SELL") &&
  !adminSrc.includes("NEXT DOLLAR — BUY"));
// FIX-D: no surface claims a NAV denominator — it is account equity, options excluded.
ok("FIX-D: cap breaches state the account-equity denominator, never '% of NAV'",
  !adminSrc.includes("% of NAV") &&
  adminSrc.includes("denominator = account equity, options excluded — a floor, not NAV"));
// v3.27.1: binary:false = calendar entry (re-score, tax date) — visible, never gating.
ok("kd: non-binary key dates never trip the no-new-adds gate",
  adminSrc.includes("k.binary===false||!/") || adminSrc.includes("k.binary===false||!"));
ok("kd: non-binary dates still render on the calendar, labeled, without the blocker flag",
  adminSrc.includes("nb:k.binary===false") && adminSrc.includes("non-binary"));
ok("agree: disagreement renders as WAIT with blockers named, not a blended score",
  adminSrc.includes("NEXT DOLLAR: WAIT") && adminSrc.includes("disagreement is information, not a discount"));
// v3.26 FEAT-TT-FRAMEWORK: the methodology doc is PRIVATE — KV behind the PIN, never the
// repo, because shwinster101/MacroDash is public and this is the owner's whole system.
const fwSrc = readFileSync(new URL("../functions/api/framework.js", import.meta.url), "utf8");
ok("fw: read AND write both require auth (unlike prices, this content is secret)",
  (fwSrc.match(/const auth = await authorize\(request, env\);/g) || []).length === 2);
ok("fw: separate KV key, not crammed into the book", fwSrc.includes('const KEY = "tt:framework:v1"'));
ok("fw: keeps a rollback copy before overwriting a doctrine revision",
  fwSrc.includes('KEY + ":prev"'));
ok("fw: absent record is a normal empty state, not an error", fwSrc.includes("rec || { empty: true }"));
ok("fw: the framework document is NOT committed to the public repo",
  !existsSync(new URL("../TT_FRAMEWORK_MACRODASH_INTEGRATION.md", import.meta.url)) &&
  !existsSync(new URL("../docs/TT_FRAMEWORK_MACRODASH_INTEGRATION.md", import.meta.url)));
// v3.18.1 audit patches — the widget ranks a SUBSET, off a price mark that can go stale,
// across horizons that can differ. Each of those must be visible, not inferred.
ok("upside: states the denominator — no silent truncation of the ranked set",
  adminSrc.includes("ranking <b>${rows.length} of ${BOOK.length}</b>") &&
  adminSrc.includes("NOT judged unattractive"));
ok("upside: flags a stale/undated price mark (a stale ref_px silently poisons the %)",
  adminSrc.includes("r.pxAge===null||r.pxAge>PX_STALE_D") && adminSrc.includes("⚠ px "));
ok("upside: shows each pick's target year — horizons are not assumed equal",
  adminSrc.includes("to ${esc(r.y)}") && adminSrc.includes("horizons differ"));
ok("upside: surfaces the payload's own pt_model caveat (stored is never invisible)",
  adminSrc.includes("caveat:(dd.pt_model&&dd.pt_model.note)") && adminSrc.includes("shown.filter(r=>r.caveat)"));
// v3.21 FEAT-TT-HZ: horizon selector. Nearest-rung ranking favours names already near fair
// value; the year must be the owner's choice, and a pinned year must be honoured exactly.
// Invariant, not literal: a HORIZON state exists, the setter normalises falsy -> null
// (so "nearest" is one value, not several), and it triggers a re-render.
ok("hz: horizon state + setter normalises and re-renders every surface that reads it",
  /let HORIZON=/.test(adminSrc) &&
  /function setHorizon\(y\)\{[\s\S]{0,400}renderUpsideRank\(\);/.test(adminSrc) &&
  // v3.39: ddWorth/estRunTable read effHorizon() too, so a change while parked on a tab must
  // redraw it — otherwise the WORTH cell quotes the previous year.
  /function setHorizon\(y\)\{[\s\S]{0,700}if\(TAB!=="BOARD"\)renderDeepDive\(TAB\);/.test(adminSrc));
ok("hz: a pinned horizon selects that exact rung, never a substitute year",
  adminSrc.includes("if(hz&&!at)return null;"));
// v3.65: this pinned the literal expression `cands.length-rows.length`, so naming the dropped
// names (a strict improvement) failed it. Re-pinned on the BEHAVIOUR it exists to protect —
// the count is still derived from the candidate/row gap, and the drop is still disclosed —
// rather than on one spelling of the arithmetic.
ok("hz: names lacking the chosen year are dropped AND disclosed (no silent substitution)",
  adminSrc.includes("const noRung=noRungSyms.length;")
  && /noRungSyms=hz\?cands\.filter\(c=>!rows\.some\(r=>r\.sym===c\.sym\)\)/.test(adminSrc)
  && adminSrc.includes("no ${esc(hz)} rung"));
ok("hz: the mixed-horizon warning flips off once every % shares one year",
  adminSrc.includes("all % share the ${esc(hz)} horizon"));
ok("hz: selector offers nearest plus the union of available rung years",
  adminSrc.includes('hzBtn("","nearest")') && adminSrc.includes("years.map(y=>hzBtn(y,y))"));
ok("hz: empty-at-this-horizon renders its own message, not the no-data one",
  adminSrc.includes("pick another horizon"));
// v3.22 FEAT-TT-CAGR: a raw gap is not a return. Ranking must annualise or the longest
// horizon always wins on arithmetic alone.
ok("cagr: annualises the gap over time-to-year-end", adminSrc.includes("function yrsToYearEnd(y,_now)") &&
  adminSrc.includes("Math.pow(1+pct/100,1/t)-1"));
ok("cagr: withholds annualisation under ~3 months (amplifies noise) and at total loss",
  adminSrc.includes("const ANN_MIN_Y=0.25;") && adminSrc.includes("if(!(t>=ANN_MIN_Y)||pct<=-100)return null;"));
// v3.39 FEAT-TT-PTLINT (D2): the old fallback `r.ann!==null?r.ann:r.upside` put a RAW gap and a
// RATE in the same sort — from ~Oct 1 a near rung would rank on the wrong scale. Names with no
// annualisable rung now sort last and are named, never interleaved at the wrong unit.
ok("cagr: the board SORTS on the annualised figure only — a raw gap never enters the same order",
  adminSrc.includes("rows.sort((a,b)=>(b.ann===null?-Infinity:b.ann)-(a.ann===null?-Infinity:a.ann));") &&
  !adminSrc.includes("const key=r=>r.ann!==null?r.ann:r.upside;"));
ok("cagr: pick shows %/yr with the raw gap and its year kept visible",
  adminSrc.includes("%/yr") && adminSrc.includes("% by ${esc(r.y)}"));
ok("cagr: header states the ranking is annualised so horizons compare",
  adminSrc.includes("ranked by %/yr so horizons compare"));
// v3.22.1: a pt_model with no computable rung is the deliberately-UNRANKED case. The early
// return hid the payload's own explanation — stored but invisible, the cardinal sin here.
ok("ptm: a rungless pt_model still renders its reasoning (never stored-but-invisible)",
  adminSrc.includes("no rung is computable from these inputs") &&
  adminSrc.includes("if(m&&!rows.length&&(m.basis||m.note)){"));
ok("ptm: rungless case says deliberately unranked, not overlooked",
  adminSrc.includes("deliberately UNRANKED, not overlooked"));
// v3.23: default horizon + owner-editable floor multiple.
// v3.39 FEAT-TT-PTLINT (D1): the hardcoded "2028" default became WRONG the moment three models
// were built whose estimate series end at FY2028 (last computable rung YE2027) — pinning 2028
// dropped them out of the ranking entirely, disclosed only as a footnote count. The default is
// now COMPUTED: the deepest year-end EVERY modelled name reaches, so the staleness cannot recur.
ok("hz: the default is COMPUTED (deepest fully-covered year), never a hardcoded year",
  !adminSrc.includes('HZ_DEFAULT="2028"') && adminSrc.includes('HZ_AUTO="auto"') &&
  adminSrc.includes("function autoHorizon()") &&
  adminSrc.includes("const shared=sets.reduce((a,b)=>a.filter(y=>b.includes(y)));"));
ok("hz: auto resolves per render, because BOOK is empty at parse time and grows as models land",
  adminSrc.includes("function effHorizon(){return HORIZON===HZ_AUTO?autoHorizon():HORIZON;}") &&
  adminSrc.includes("const hz=effHorizon(),isAuto=HORIZON===HZ_AUTO;"));
ok("hz: an auto pick STATES itself — it must not look like a deliberate choice",
  adminSrc.includes("the deepest year EVERY modelled name reaches"));
ok("hz: the horizon choice persists across visits",
  adminSrc.includes('localStorage.setItem(HZ_KEY') && adminSrc.includes("localStorage.getItem(HZ_KEY)"));
ok("hz: persistence distinguishes 'never set' (auto) from 'set to nearest' (explicit)",
  adminSrc.includes("v===null?HZ_AUTO:(v||null)"));
ok("mult: floor multiple is owner-editable and re-computes every rung",
  adminSrc.includes("async function saveFloorMultiple(sym)") && adminSrc.includes("m.pe_floor_multiple=v;"));
ok("mult: an edited multiple is stamped so it cannot pass as the 18x default",
  adminSrc.includes("m.multiple_edited=new Date().toLocaleDateString") &&
  adminSrc.includes("not the 18× default"));
ok("mult: validates range and rejects junk rather than writing it",
  adminSrc.includes("isFinite(v)&&v>0&&v<=200"));
ok("mult: clearing the field REMOVES the floor instead of silently keeping the old one",
  adminSrc.includes("delete m.pe_floor_multiple;delete m.multiple_edited;"));
ok("mult: editor offered on unranked names too (owner can opt one in)",
  (adminSrc.match(/multEditor\(sym,m\)/g) || []).length >= 2);
// v3.24 FEAT-TT-LIVEPX: rank off the current price, fall back to the stamped mark.
const quotesSrc = readFileSync(new URL("../functions/api/quotes.js", import.meta.url), "utf8");
ok("livepx: quotes endpoint reuses the /api/tt auth gate (guards the Finnhub quota)",
  quotesSrc.includes('import { authorize } from "./tt.js"') && quotesSrc.includes("if (!auth.ok)"));
ok("livepx: FINNHUB_KEY never leaves the Function", quotesSrc.includes("env.FINNHUB_KEY") && !adminSrc.includes("finnhub"));
ok("livepx: Finnhub c:0 (unknown symbol) is rejected, not passed through as a free stock",
  quotesSrc.includes("!isFinite(px) || px <= 0) return null"));
ok("livepx: missing symbols are NAMED so fallbacks are never implied to be live",
  quotesSrc.includes("missing: syms.filter"));
ok("livepx: matches snapshot.js on the wire (Accept header + timeout were load-bearing)",
  quotesSrc.includes('headers: { Accept: "application/json" }') && quotesSrc.includes("ctl.abort()"));
ok("livepx: KV-cached and batched to respect the rate limit / subrequest cap",
  quotesSrc.includes("CACHE_TTL = 120") && quotesSrc.includes("misses.slice(i, i + 5)"));
ok("livepx: board prefers a live quote and falls back to the stamped ref_px",
  adminSrc.includes("const live=LIVE_PX[x.sym];") &&
  adminSrc.includes("(live&&isFinite(live.px)&&live.px>0)?{px:live.px,at:live.at,live:true,chg:live.chg}:stamp"));
ok("livepx: a live price is never flagged stale (staleness judges stamps only)",
  adminSrc.includes("pxAge:ref.live?0:ageDays(ref.at)"));
ok("livepx: each pick shows whether it used a live or stamped price",
  adminSrc.includes(">live $") && adminSrc.includes(">stamped $"));
ok("livepx: footer counts live vs stamped rather than implying all are current",
  adminSrc.includes("live / ") && adminSrc.includes("all prices are stamped marks, not live"));
ok("livepx: quote fetch is non-blocking and failure leaves the board unchanged",
  adminSrc.includes("loadBook().then(()=>{loadQuotes();loadPositions();});") && adminSrc.includes("never break the board on a quote feed"));

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
// FIX-A (v3.49): explicit ET instant — a bare "2026-04-07" is midnight UTC = Monday 8pm ET,
// where Thursday data is legitimately fresh; "viewed Tuesday" must actually mean Tuesday ET.
ok("isStale: same Thu data viewed Tue = STALE (Monday was a real session)",
  isStale("2026-04-02", new Date("2026-04-07T12:00:00-04:00")) === true);
// ---- FIX-A (v3.49, VALUE_PROPOSITION_AUDIT Critical #1) — the ET/UTC rollover ----
// "today" is the ET date of `now`, never the runtime-local date. On the UTC edge the old
// local-midnight truncation advanced "today" at 8pm ET and aged normal prior-close data,
// so /readout.json (edge) and the dashboard (ET browser) gave two different regime verdicts
// for the same payload. These instants straddle the rollover; in a UTC runtime (this test
// env, CI, and the edge itself) they regress the old behavior directly.
ok("isStale FIX-A: Wed close viewed Thu 9pm ET (= Fri 01:00 UTC) is FRESH — the UTC date must not age it",
  isStale("2026-07-29", new Date("2026-07-31T01:00:00Z")) === false);
ok("isStale FIX-A: same data one real session later (Fri 9pm ET) IS stale — the fix must not over-correct",
  isStale("2026-07-29", new Date("2026-08-01T01:00:00Z")) === true);
ok("isStale FIX-A: weekly cadence unaffected by the rollover hour (12-day boundary judged in ET)",
  isStale("2026-07-20", new Date("2026-08-01T01:00:00Z"), "weekly") === false);
// End-to-end: the exact two-surface split the audit measured live. A snapshot whose fields
// carry Wednesday's close, read at Thursday 9pm ET (Friday 01:00 UTC — the edge's clock):
// every dated field must still vote. Before FIX-A the edge withheld them (INSUFFICIENT,
// flip blind) while an ET browser voted them — two verdicts for one regime.
ok("readout FIX-A: prior-close data at Thu 9pm ET (Fri UTC) still votes — no INSUFFICIENT from the rollover", (() => {
  const dEve = "2026-07-29"; // Wednesday's close, the freshest possible print Thursday evening
  const r = buildTtReadout({
    spyPrice: 748.1, spyPriceAsOf: dEve, spyMa200: 700.0, spyChangePct: 0.41,
    vix: 16.1, vixAsOf: dEve, fearGreed: 62, fearGreedAsOf: dEve, fearGreedLabel: "Greed",
    qqqChangePct: 0.9, qqqPriceAsOf: dEve, tenYear: 4.46, tenYearAsOf: dEve, tenYearM1: 0.03,
  }, { now: new Date("2026-07-31T01:00:00Z") });
  return r.regime.verdict !== "INSUFFICIENT" && r.vix.value === 16.1 && r.macro_flip.evaluable === true;
})());
ok("isStale: Wed data viewed Fri across Thanksgiving = FRESH",
  isStale("2026-11-25", new Date("2026-11-27")) === false);
ok("isStale: Thu Dec 24 data viewed Mon Dec 28 = FRESH (Xmas Friday + weekend)",
  isStale("2026-12-24", new Date("2026-12-28")) === false);
ok("session: Good Friday noon ET reads CLOSE", marketSession(new Date("2026-04-03T16:00:00Z")) === "CLOSE");
ok("session: Saturday noon ET reads CLOSE", marketSession(new Date("2026-07-18T16:00:00Z")) === "CLOSE");
ok("session: regular Monday noon ET reads OPEN", marketSession(new Date("2026-07-20T16:00:00Z")) === "OPEN");
ok("session: regular Monday 7am ET reads PRE", marketSession(new Date("2026-07-20T11:00:00Z")) === "PRE");
ok("session: regular Monday 5pm ET reads CLOSE", marketSession(new Date("2026-07-20T21:00:00Z")) === "CLOSE");

// ---- 10. FEAT-TT-SESSION (v3.28) — board-level session state --------------
// The store is testable (validateBoard is pure); the renderers live in the buildless
// admin.html, so they are pinned at source like every other terminal invariant.
console.log("\n[10] FEAT-TT-SESSION — the session layer (clusters · circuit · funding · decisions)");
const okBoard = (extra = {}) => ({ as_of: "2026-07-28", ...extra });
const badB = (b) => typeof validateBoard(b) === "string";
ok("sess: minimal board (as_of only) passes", validateBoard(okBoard()) === null);
ok("sess: an UNDATED board is rejected — self-attested state that cannot age would read current forever",
  badB({ source: "TT session" }) && /as_of/.test(validateBoard({ source: "x" })));
ok("sess: non-object / array board rejected", badB(null) && badB([]) && badB("x"));
ok("sess: circuit requires a known state", badB(okBoard({ circuit: { state: "on", as_of: "2026-07-28" } })));
ok("sess: all three circuit states accepted", ["clear", "armed", "tripped"].every((s) =>
  validateBoard(okBoard({ circuit: { state: s, as_of: "2026-07-28" } })) === null));
ok("sess: an undated circuit is rejected (the strip ages the measurement, not the paste)",
  badB(okBoard({ circuit: { state: "tripped" } })));
ok("sess: cluster needs a label and a non-empty member list",
  badB(okBoard({ clusters: [{ members: ["MU"] }] })) && badB(okBoard({ clusters: [{ label: "x", members: [] }] })));
ok("sess: cluster members are validated as tickers (same SYM_RE as the book)",
  badB(okBoard({ clusters: [{ label: "x", members: ["mu"] }] })) &&
  validateBoard(okBoard({ clusters: [{ label: "AI infra", members: ["MU", "CRDO"] }] })) === null);
ok("sess: funding rows need a sym; do_not_trim entries are tickers",
  badB(okBoard({ funding: { order: [{ est: "$30k" }] } })) &&
  badB(okBoard({ funding: { do_not_trim: ["not a ticker"] } })) &&
  validateBoard(okBoard({ funding: { order: [{ sym: "NVDL", est: "~$30k" }], do_not_trim: ["NBIS"] } })) === null);
ok("sess: a decision needs the question, and a dated one needs a real date",
  badB(okBoard({ decisions: [{ note: "x" }] })) && badB(okBoard({ decisions: [{ q: "x", asked: "7/14" }] })));
ok("sess: an UNDATED decision is allowed but renders as the worst age (fail-closed at render, not at the door)",
  validateBoard(okBoard({ decisions: [{ q: "TSM — never screened" }] })) === null &&
  adminSrc.includes('d.age===null?"undated"'));
ok("sess: board binaries need {date, label|event} (the non-ticker print)",
  badB(okBoard({ binaries: [{ label: "SK Hynix Q2" }] })) &&
  validateBoard(okBoard({ binaries: [{ date: "2026-07-28", label: "SK Hynix Q2", scope: "MEMORY" }] })) === null);
ok("sess: an asserted regime must actually say what it asserts",
  badB(okBoard({ regime: { verified: false } })) &&
  validateBoard(okBoard({ regime: { asserted: "PANIC", verified: false } })) === null);
ok("sess: board size is capped well under the 200KB book PUT limit",
  badB(okBoard({ note: "x".repeat(17 * 1024) })));
ok("sess: board rides the same PUT as the book and is validated there",
  validateBoard(okBoard()) === null &&
  validateBook({ book: [], cut: [], board: okBoard({ circuit: { state: "tripped", as_of: "2026-07-28" } }) }) === null &&
  typeof validateBook({ book: [], cut: [], board: { circuit: {} } }) === "string");
ok("sess: a book PUT carrying NO board still passes (older clients / curl are not broken)",
  validateBook({ book: [], cut: [] }) === null);
const ttSrc = readFileSync(new URL("../functions/api/tt.js", import.meta.url), "utf8");
ok("sess: an absent board is CARRIED FORWARD, not deleted — whole-book replace must not eat session state",
  ttSrc.includes("body.board === undefined ? prev?.board : body.board"));
// Renderers — pinned at source (admin.html is buildless).
ok("sess: absent sections render nothing at all (no session must look like before, not like empty promises)",
  adminSrc.includes('n.style.display=html?"block":"none"') &&
  ["circuitLine", "fundingLine", "clusterLine", "decisionsLine"].every((id) => adminSrc.includes(`id="${id}" style="display:none`)));
// v3.29: the circuit strip moved into a drawer, but it did not lose its precedence — it is
// now the FIRST thing stance() consults, and stance() is the top line of the whole board.
ok("sess: the circuit outranks the regime in the stance that gates every add",
  /function stance\(\)\{[\s\S]{0,240}st==="tripped"\)return\{k:"stop"/.test(adminSrc) &&
  adminSrc.indexOf('id="todayCard"') < adminSrc.indexOf('id="nextDollar"'));
ok("sess: a tripped circuit vetoes the both-stories-agree line entirely (no per-name score clears it)",
  adminSrc.includes("NEXT DOLLAR: NONE — leverage circuit tripped"));
ok("sess: stated circuit state vs its last measurement is reconciled, never smoothed over",
  adminSrc.includes('(v>=tl)!==(st==="tripped")') && adminSrc.includes("asserted ahead of the number"));
ok("sess: an unreconciled circuit says so (self-attested, like lastRun)",
  adminSrc.includes("self-attested — not reconciled against a live account pull"));
ok("sess: undated session state is the WORST age chip, never treated as current",
  adminSrc.includes('if(d===null)return `<span class="bad2">⚠ ${label||"undated"}'));
ok("sess: cluster overlap with the ranked queues is called out as one position, not two",
  adminSrc.includes("that is one position, not two") && adminSrc.includes("LAST_RANK=shown.map"));
ok("sess: clusters render after the upside rank so the overlap check reads current ranks",
  // ordering, not adjacency — v3.35 slots renderEstRunBoard between them, which is fine;
  // the invariant is that clusters read ranks the upside pass already computed.
  (()=>{const chain=adminSrc.slice(adminSrc.indexOf("renderCircuit();renderNextDollar()"));
    return chain.indexOf("renderUpsideRank();")>0&&chain.indexOf("renderUpsideRank();")<chain.indexOf("renderClusters();");})());
ok("sess: next-dollar leads come from ONE helper, so the queue and the cluster check cannot disagree",
  adminSrc.includes("function ndLeads()") && (adminSrc.match(/ndLeads\(\)/g) || []).length >= 3);
ok("sess: funding contradiction (same name trim + do-not-trim) is named, not silently ranked",
  adminSrc.includes("appears in BOTH the trim order and do-not-trim"));
ok("sess: funding reports, never enforces (same rule as the binary calendar)",
  adminSrc.includes("reported, not enforced — the board never places or blocks an order"));
ok("sess: open decisions sort oldest-first and age in public",
  adminSrc.includes("an unanswered decision ages in public"));
ok("sess: decisions and circuit state fold into the coverage rollup",
  adminSrc.includes("open decision") && adminSrc.includes("⛔ circuit tripped"));
// The two regime engines: measured (/readout.json) vs asserted (the session).
ok("regime: the STRICTER of measured and asserted governs the standing modifier",
  adminSrc.includes("const REG_RANK={TAILWIND:0,NEUTRAL:1,HEADWIND:2,PANIC:3};") &&
  adminSrc.includes("(aR>mR?asserted:measured)"));
ok("regime: disagreement is printed with both readings, never averaged (v3.66: asserted truncates on the line, verbatim one tap deep)",
  adminSrc.includes("engines disagree — measured <b>${esc(measured)}</b> vs asserted <b>${aShort}</b>") &&
  adminSrc.includes("disagreement is information, not an average") &&
  adminSrc.includes("full session read · provenance"));
ok("regime: an asserted regime always carries its provenance and verified flag",
  adminSrc.includes('ar.verified===true?"reconciled":"UNVERIFIED"'));
ok("regime: MacroDash INSUFFICIENT/unavailable never silently confirms the asserted read",
  adminSrc.includes("MacroDash unavailable, nothing measured confirms it") &&
  adminSrc.includes("unconfirmed, don't gate on the measured side"));
ok("regime: the HEADWIND/PANIC modifier text survives the two-engine rewrite",
  adminSrc.includes("R/R floors +0.5") && adminSrc.includes("8+ support quality"));
// Non-ticker binaries — a supplier's print that sets the tone for names you do hold.
ok("bincal: board-level binaries merge into the same dated queue",
  adminSrc.includes("BOARD.binaries") && adminSrc.includes("board-level, not a book ticker"));
ok("bincal: a binary only opens a tab that actually exists (no dead click)",
  adminSrc.includes("const tabbable=!e.board||!!(find(e.sym)&&find(e.sym).deepDive);"));
ok("sess: the circuit's asserted state and its measurement are dated separately",
  adminSrc.includes("measurement undated — the number's own age is unknown") &&
  adminSrc.includes("c.measured_at?"));
// The handoff patch: MERGE, never replace — a session covers the names it touched, so
// importing one as a book would delete every name it did not mention.
ok("handoff: applying a session patch merges and never removes",
  adminSrc.includes("function applyHandoff()") && adminSrc.includes("nothing is ever removed"));
ok("handoff: the whole patch validates BEFORE any of it is applied",
  adminSrc.includes("A half-applied patch is worse than a rejected one"));
ok("handoff: a name new to the book must carry tier + lens (no half-formed entries)",
  adminSrc.includes("an added name must carry a valid tier and lens"));
ok("handoff: the merge names exactly what changed and what it left alone",
  adminSrc.includes("book name${untouched===1?\"\":\"s\"} untouched"));
ok("handoff: nothing reaches the server until an explicit SAVE (preview rails, like restore points)",
  adminSrc.includes('showUnsaved(`handoff merged on screen') && adminSrc.includes('"preview");'));
ok("sess: session state travels with BOTH backup paths (JSON + CANONICAL_BOOK.md)",
  adminSrc.includes("## SESSION STATE") && adminSrc.includes("...(BOARD&&Object.keys(BOARD).length?{board:BOARD}:{})"));
ok("sess: an import carrying no board leaves existing session state alone",
  adminSrc.includes("if(parsed.board!==undefined&&parsed.board!==null)BOARD=parsed.board;"));
ok("sess: clearing session state requires an explicit confirmation, never a side effect",
  adminSrc.includes("Clear all session state"));
// Same invariant as SEED=[] and the framework doc: the terminal ships the RAILS, never the
// content. A session handoff names live positions, sizes and trim amounts — in a public repo
// that is the portfolio itself. BOARD starts empty and is filled from KV at runtime.
ok("sess: session state starts EMPTY in the bundle — content lives in KV, never the repo",
  /let BOARD=\{\};/.test(adminSrc) &&
  !/BOARD\s*=\s*\{\s*as_of/.test(adminSrc) &&
  !existsSync(new URL("../TT_SESSION_HANDOFF.md", import.meta.url)) &&
  !existsSync(new URL("../ticker-terminal/TT_SESSION_HANDOFF.md", import.meta.url)));

// ---- 11. FEAT-TT-TODAY (v3.29) — the daily loop owns the default view ------
// The board had grown to nine strips of standing state, all full-size, every load. This
// pass keeps ONE screen (stance · today · what changed) and puts the rest one tap away.
console.log("\n[11] FEAT-TT-TODAY — stance · actions · what changed");
// v3.38 FOCUS2: the STANCE STRIP leads the primary view; the TODAY card detail lives
// inside DESK. The strip must render before the buy block, and the buy block before the book.
ok("focus2: the stance strip leads, then buy, sell, calendar, then the book",
  adminSrc.indexOf('id="stanceStrip"') < adminSrc.indexOf('id="buyBlock"') &&
  adminSrc.indexOf('id="buyBlock"') < adminSrc.indexOf('id="sellBlock"') &&
  adminSrc.indexOf('id="sellBlock"') < adminSrc.indexOf('id="calBlock"') &&
  adminSrc.indexOf('id="calBlock"') < adminSrc.indexOf('id="board"') &&
  adminSrc.indexOf('id="board"') < adminSrc.indexOf('id="dDesk"'));
ok("today: every demoted strip keeps its element — nothing was deleted, only collapsed",
  ["nextDollar", "upsideRank", "clusterLine", "fundingLine", "binaryCal", "decisionsLine", "circuitLine"]
    .every((id) => adminSrc.includes(`id="${id}"`)));
ok("today: each drawer is ONE tap (native details, no hidden second step)",
  (adminSrc.match(/<details class="drawer" id="d/g) || []).length === 9 &&      // 8 strips + DESK (v3.45 adds dCapex)
  (adminSrc.match(/<details class="drawer"><summary>/g) || []).length === 3);   // reference sidebar
ok("today: the reference sidebar collapses too — it is reference, not monitoring",
  !/<div class="panel"[^>]*>\s*<h2>Router/.test(adminSrc) &&
  adminSrc.includes("<summary>STANDING CONSTRAINTS</summary>"));
ok("today: the header pill is labelled MACRO — it is the measured read, not the stance",
  adminSrc.includes("<span>MACRO: <span class=\"pill neutral\" id=\"regimePill\"") &&
  adminSrc.includes("made the header look like it contradicted the stance"));
ok("today: a closed drawer still carries its signal in the summary (the v3.25 hinge rule)",
  adminSrc.includes("function renderDrawers()") &&
  adminSrc.includes("inside ${BINARY_WINDOW_D}d</span>") && adminSrc.includes("${ds.length} open"));
ok("today: a drawer with nothing in it is hidden, not rendered empty",
  adminSrc.includes('d.style.display=show?"block":"none"'));
// stance: the one line that says whether capital may move.
ok("today: stance ranks the circuit above the regime (a portfolio fact, not a market read)",
  adminSrc.includes("The circuit outranks the") || adminSrc.includes("no macro verdict un-trips it"));
ok("today: with both engines known the STRICTER sets the stance, and both are shown",
  adminSrc.includes("stricter governs)") && adminSrc.includes("(aR>mR?asserted:measured)"));
ok("today: no regime at all reads UNKNOWN — never a defaulted green",
  adminSrc.includes('k:"unknown",txt:"STANCE UNKNOWN'));
ok("today: an ARMED circuit still downgrades an otherwise-clear stance",
  adminSrc.includes('the leverage circuit is ARMED'));
// actions: most time-bound first, and a green line never sits beside a red one.
ok("today: actions are ordered by irreversibility — tonight's print outranks an add",
  adminSrc.includes("Irreversibility beats opportunity"));
ok("today: an add candidate is withheld whenever anything above it vetoes",
  adminSrc.includes('if(!out.some(a=>a.sev==="stop")&&AGREE_PICK)'));
ok("today: the add candidate is the SAME object the upside widget computed (one truth)",
  adminSrc.includes("AGREE_PICK=q.length?q[0]:null;") &&
  adminSrc.includes('AGREE_PICK=null;   // recomputed below'));
ok("today: a queued name on an aged rating becomes its own action",
  adminSrc.includes("before acting — queued on an aged rating"));
ok("today: an empty day says so explicitly, with the next dated event",
  adminSrc.includes('txt:"Nothing to do today."') &&
  adminSrc.includes("which is not the same as clear"));
ok("today: a deleverage action names the blocker instead of the trim when one exists",
  adminSrc.includes("is first to trim${size} — but ${first.blocker}"));
ok("today: deleverage-only with no funding order says THAT, rather than nothing",
  adminSrc.includes("no trim order is set, so nothing says what funds it"));
// what changed: the diff, against a baseline the user owns.
ok("changed: the baseline moves only on an explicit mark-seen, never silently on reload",
  adminSrc.includes("function markSeen()") && adminSrc.includes("the baseline moves only when you say so"));
ok("changed: a first visit sets the baseline and says so — never 'nothing changed'",
  adminSrc.includes("First visit on this device") &&
  adminSrc.includes('A missing baseline is never reported as "nothing changed"'));
ok("changed: a baseline older than the window is reset rather than shown as one visit",
  adminSrc.includes("const SEEN_MAX_D=7;") && adminSrc.includes("stops being a diff"));
ok("changed: price deltas compare LIVE to LIVE — never a stamped mark against a live quote",
  adminSrc.includes("would make the first quote of") && adminSrc.includes("px:live&&isFinite(live.px)?live.px:null"));
ok("changed: diffs cover the things that actually demand action",
  ["Leverage circuit:", "tier ${a.tier}", "red hinge", "no-new-adds window", "Open decisions:"]
    .every((s) => adminSrc.includes(s)));
ok("changed: attention-grade changes sort to the top",
  adminSrc.includes("const rank={stop:0,warn:1,go:2};"));
ok("changed: the panel opens itself once when there is something in it",
  adminSrc.includes("if(d.length&&!CHANGED_OPENED)"));
// the book as a monitoring surface, not a directory.
ok("today: the whole book is quoted, not just the modelled names",
  adminSrc.includes("const all=BOOK.map(x=>x.sym);") && adminSrc.includes("const syms=all.slice(0,QUOTE_CAP);"));
ok("today: a chip with no quote shows no number at all (never a 0 that reads as flat)",
  adminSrc.includes("chg!==null?`<span class=\"chg\"") && adminSrc.includes("never a 0 or a dash"));
// v3.42 slice 2: the render() moved into a finally — the board now re-renders on quote
// SUCCESS AND FAILURE alike (a dead feed must resolve the skeletons, not strand them).
ok("today: quotes settling re-renders the whole board, success or failure",
  adminSrc.includes("finally{QUOTES_PENDING=false;render();/* chips, the upside rank and the TODAY delta all read LIVE_PX */}"));

// ---- 12. FEAT-TT-POS (v3.30) — measured facts ------------------------------
// Everything else in the book is ASSERTED and aged by lastRun. `pos` is the first MEASURED
// class: it comes from the broker, carries its own timestamp and source, and is never typed.
// FEAT-TT-POSSTORE (v3.34): `pos` itself now lives in its own KV document
// (functions/api/positions.js) rather than riding the book — validatePos is unchanged and
// still the shared validator, just called from a different write path now (see section [16]).
console.log("\n[12] FEAT-TT-POS — measured positions, caps and reconciliation");
const okPos = (extra = {}) => ({ at: "2026-07-28T14:32:00Z", src: "robinhood", ...extra });
const badP = (p) => typeof validatePos(p) === "string";
ok("pos: a full measured position passes", validatePos(okPos({ sh: 412, mv: 30104, pct: 4.2, cb: 24880 })) === null);
ok("pos: an undated position is rejected — a measured fact must be ageable",
  badP({ sh: 1, src: "robinhood" }) && /cannot be aged/.test(validatePos({ sh: 1, src: "x" })));
ok("pos: a sourceless position is rejected — provenance is not optional",
  badP({ at: "2026-07-28", src: "" }) && /where it came from/.test(validatePos({ at: "2026-07-28" })));
ok("pos: a date-only stamp is accepted (the sync may only know the day)",
  validatePos({ at: "2026-07-28", src: "robinhood" }) === null);
// Bands, in the spirit of snapshot.js BANDS: reject the impossible, not the unusual.
ok("pos: a decimal-shifted weight is rejected before it can clear or trip a cap",
  badP(okPos({ pct: 420 })) && badP(okPos({ pct: -1 })));
ok("pos: a SHORT equity position is explicitly allowed (sh < 0 is real)",
  validatePos(okPos({ sh: -100, mv: -8000 })) === null);
ok("pos: a non-numeric size is rejected", badP(okPos({ sh: "many" })));
ok("pos: option legs are validated (side, kind, positive contract count)",
  badP(okPos({ opt: [{ k: "call", side: "short", n: 0 }] })) &&
  badP(okPos({ opt: [{ k: "swap", side: "short", n: 1 }] })) &&
  validatePos(okPos({ opt: [{ k: "call", side: "short", n: 3, exp: "2028-01-21" }] })) === null);
ok("pos: FEAT-TT-POSSTORE moved it OUT of the book — validateBook no longer inspects it at all, even a bad one rides the ordinary unknown-key passthrough",
  validateBook({ book: [{ sym: "AAA", tier: "S", lens: "AI", pos: okPos({ sh: 10 }) }], cut: [] }) === null &&
  validateBook({ book: [{ sym: "AAA", tier: "S", lens: "AI", pos: okPos({ pct: 900 }) }], cut: [] }) === null);
ok("pos: a book with no positions at all still passes (nothing synced yet is normal)",
  validateBook({ book: [{ sym: "AAA", tier: "S", lens: "AI" }], cut: [] }) === null);
ok("account: the leverage figure must say how it was computed",
  typeof validateBoard({ as_of: "2026-07-28", account: { at: "2026-07-28", src: "rh", nav: 1e5 } }) === "string" &&
  validateBoard({ as_of: "2026-07-28", account: { at: "2026-07-28", src: "rh", nav: 1e5, debt: 1.2e5, debt_pct_nav: 120, formula: "margin_balance / net_liquidation" } }) === null);
ok("account: undated or sourceless is rejected like any measured block",
  typeof validateBoard({ as_of: "2026-07-28", account: { src: "rh", formula: "x" } }) === "string" &&
  typeof validateBoard({ as_of: "2026-07-28", account: { at: "2026-07-28", formula: "x" } }) === "string");
// Client-side renderers (admin.html is buildless — pinned at source).
ok("pos: lives in its own store, not inside deepDive (a thesis paste must not wipe facts)",
  adminSrc.includes("function posOf(x){const p=POSITIONS[x&&x.sym];") &&
  ttSrc.includes("the payload editor replaces deepDive wholesale") &&
  !/deepDive\.pos|dd\.pos\b/.test(adminSrc));
ok("pos: an absent position renders NOTHING — not a 0 or a dash that reads as not-held",
  adminSrc.includes("absent number; a dash or a 0 here would read"));
ok("pos: fetched from its own endpoint at boot, alongside the book and quotes",
  adminSrc.includes('const r=await fetch("/api/positions");') &&
  adminSrc.includes("loadBook().then(()=>{loadQuotes();loadPositions();});"));
ok("pos: a fetch failure leaves POSITIONS={} — every posOf() reads null, never stale data",
  adminSrc.includes("POSITIONS stays {} — posOf() reads null for everyone, never stale data"));
ok("pos: measured marks age like everything else, undated being the worst",
  adminSrc.includes("function posChip(p)") && adminSrc.includes('if(d===null)return `<span class="bad2">⚠ undated'));
ok("caps: the single-name cap is a named constant, not prose",
  adminSrc.includes("const CAP_PCT=18;"));
ok("caps: the CLUSTER total is summed — 'cluster = one position' is finally checkable",
  adminSrc.includes('out.push({kind:"cluster"') && adminSrc.includes("one cluster sizes as one position"));
ok("caps: an unmeasured cluster member is NAMED and the total called a floor",
  adminSrc.includes("the total is a FLOOR") && adminSrc.includes("a cluster total that"));
ok("caps: a breach becomes a TODAY stop — you are over the limit now, not considering it",
  adminSrc.includes("pts over the ${CAP_PCT}% cap") && adminSrc.includes("outranks anything discretionary"));
ok("caps: a breach computed off a stale or undated mark says so",
  adminSrc.includes("(position mark undated)") && adminSrc.includes("marks ${c.age}d old"));
ok("caps: a closed EXPOSURE drawer still shows a breach in its summary",
  adminSrc.includes("over the ${CAP_PCT}% cap</span> · "));
ok("recon: book-vs-broker runs only once something is measured (else all names read unheld)",
  adminSrc.includes("const anyPos=BOOK.some(x=>posOf(x));") && adminSrc.includes("if(!anyPos)return null;"));
ok("recon: held-but-untracked is called exposure no thesis covers",
  adminSrc.includes("exposure no thesis covers"));
ok("recon: with nothing synced the strip says what a sync would buy",
  adminSrc.includes("no measured positions yet — run the broker sync"));
ok("today: the deleverage action carries real size and verifies its own blocker",
  adminSrc.includes("short call(s) cover") && adminSrc.includes("stops being an abstraction"));
ok("circuit: shows the arithmetic behind the number that vetoes every add",
  adminSrc.includes("computed as ${esc(acct.formula)}") && adminSrc.includes("checkable by the person it stops"));
ok("coverage: measured coverage sits in the same rollup as run coverage",
  adminSrc.includes("measured</span>") && adminSrc.includes("0 positions measured"));
ok("quotes: the 40-symbol cap is stated and the dropped tail named",
  adminSrc.includes("const QUOTE_CAP=40;") && adminSrc.includes("unquoted (past the ${QUOTE_CAP}-symbol cap)"));
ok("regime: ONE derivation shared by the stance and the modifier",
  adminSrc.includes("function governingRegime()") &&
  (adminSrc.match(/governingRegime\(\)/g) || []).length >= 3 &&
  (adminSrc.match(/aR>mR\?asserted:measured/g) || []).length === 1);

// ---- 13. FEAT-TT-DDFOCUS + the render harness (v3.31) ----------------------
console.log("\n[13] FEAT-TT-DDFOCUS — the deep-dive tab answers four questions first");
ok("dd: the four answers render before the corpus",
  adminSrc.includes("function ddAnswerBlock(") &&
  ["What it's worth", "What changes my mind", "When", "What I own"].every((q) => adminSrc.includes(q)) &&
  adminSrc.indexOf("ddAnswerBlock(x,dd,todayET)") < adminSrc.indexOf('ddDrawer("val"'));
ok("dd: worth reuses ptModelRows — the cell can never disagree with the ladder below it",
  adminSrc.includes("function ddWorth(dd,sym)") && adminSrc.includes("const rr=ptModelRows(dd)"));
ok("dd: a name with no model says so instead of showing a target",
  adminSrc.includes('return{txt:"no model"'));
ok("dd: an unmeasured position is not reported as unheld",
  adminSrc.includes("not synced, which is not the same as not held"));
ok("dd: the corpus is grouped into drawers, not deleted",
  ["val", "thesis", "dates", "cap", "track", "dots"].every((k) => adminSrc.includes(`ddDrawer("${k}"`)));
ok("dd: an empty drawer is never rendered",
  adminSrc.includes("never an empty drawer") && adminSrc.includes('if(!content||!String(content).trim())return "";'));
ok("dd: drawer summaries carry their signal (failing gates, red hinges, next date)",
  adminSrc.includes("gates failing") && adminSrc.includes("kill combo defined") &&
  adminSrc.includes("KEY DATES${(()=>{const n=ddNextDate"));
ok("dd: unknown payload keys are NAMED in the summary — stored is never invisible",
  adminSrc.includes("OTHER STORED FIELDS · ${unknown.map(esc).join(") &&
  adminSrc.includes("what is stored is never invisible"));
ok("dd: drawer open state survives a re-render (quotes landing must not collapse it)",
  adminSrc.includes("const DD_OPEN=new Set();") && adminSrc.includes("ontoggle=\"ddToggle("));
ok("dd: every hinge state still funnels through the green|amber|red|unknown tally",
  adminSrc.includes("function hingeTally(dd)"));
// The harness itself: buildless HTML needs a real browser, and it must not become a
// dependency that breaks `npm test` on a machine without one.
const renderSrc = readFileSync(new URL("./render.mjs", import.meta.url), "utf8");
ok("render: committed as a separate suite, not wired into npm test",
  existsSync(new URL("./render.mjs", import.meta.url)) &&
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts["test:ui"] === "node test/render.mjs");
ok("render: skips cleanly (exit 0) when no browser or no playwright-core is present",
  renderSrc.includes("process.exit(0)") && renderSrc.includes("RENDER TEST: SKIPPED"));
ok("render: an explicit browser path is validated, not trusted blindly",
  renderSrc.includes("existsSync(direct) ? direct : null"));
ok("render: the fixture is SYNTHETIC — no real book content enters this repo",
  renderSrc.includes("INVARIANT: the fixture is SYNTHETIC") &&
  ["AAA", "BBB", "CCC", "FFF"].every((s) => renderSrc.includes(`sym: "${s}"`)));
ok("render: asserts at a phone width as well as desktop",
  renderSrc.includes("await open(390, 844)") && renderSrc.includes("no horizontal overflow at 390px"));

// ---- 14. audit patches (v3.31.1) -------------------------------------------
console.log("\n[14] audit — composite parsing, mark staleness, version drift");
const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
// The terminal had THREE versions for one artifact: <title> v1.0, brand v1.1, package.json
// v3.31. This repo already resolved exactly this drift once ("footer string is canonical /
// package.json is stale"). admin.html is a Vite public/ passthrough and cannot receive
// __APP_VERSION__, so a guard is the only thing that can hold the invariant.
ok("version: the terminal's title and brand both match package.json (no third version)",
  adminSrc.includes(`<title>TT TICKER TERMINAL v${PKG.version}</title>`) &&
  adminSrc.includes(`<small>v${PKG.version} · single-pass deep-dive orchestrator</small>`));
// ttInfo's score decides whether the NEXT DOLLAR line lights. It is parsed from prose.
ok("composite: a decimal score is preferred over an earlier bare integer",
  adminSrc.includes("function parseComposite(v)") && adminSrc.includes("const dec=s.match(/\\d+\\.\\d+/);"));
ok("composite: a numeric field is used as-is, so a legitimate 0 is not dropped as falsy",
  adminSrc.includes('if(typeof v==="number")return isFinite(v)?v:null;'));
ok("composite: a numeric status_flags.composite is accepted, not only a string",
  adminSrc.includes('typeof dd.status_flags.composite==="number"'));
ok("mark staleness: ONE threshold shared by the board and the deep-dive cell",
  adminSrc.includes("const PX_STALE_D=4;") &&
  (adminSrc.match(/PX_STALE_D\)/g) || []).length >= 2 &&
  !/r\.pxAge>4/.test(adminSrc));
ok("dd: a pinned horizon with no rung is NAMED, not silently swapped for another year",
  adminSrc.includes("rung — showing ${esc(t.y)}"));
ok("dd: the worth cell ages its own price mark, like the board does",
  adminSrc.includes("⚠ mark ${pxAge===null?\"undated\":pxAge+\"d old\"}"));

// ---- 15. FEAT-TT-LEDGER (v3.32) — the belief ledger ------------------------
// Every other field in the book overwrites in place. diffForLedger is the notary: pure,
// no KV/network access (the caller stamps px afterward), so it's smoke-testable exactly
// like validateBook/conflictCheck. It logs BELIEFS ONLY — the user's explicit call.
console.log("\n[15] FEAT-TT-LEDGER — diffForLedger truth table + ledger.js read path");
const led = (prev, next, prevCut = [], nextCut = []) => diffForLedger(prev, next, prevCut, nextCut, "2026-07-28T18:00:00Z", "1.1");
const kindsOf = (entries) => entries.map((e) => e.kind).sort();

ok("ledger: a brand-new name logs 'add' with its tier", (() => {
  const out = led([], [{ sym: "NEW", tier: "WATCH", lens: "AI" }]);
  return out.length === 1 && out[0].kind === "add" && out[0].sym === "NEW" && out[0].to === "WATCH";
})());
ok("ledger: a removed name logs 'remove' with its prior tier", (() => {
  const out = led([{ sym: "OLD", tier: "S", lens: "AI" }], []);
  return out.length === 1 && out[0].kind === "remove" && out[0].from === "S";
})());
ok("ledger: tier and rank changes both fire, independently", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", rank: "#1" }];
  const n = [{ sym: "X", tier: "A", lens: "AI", rank: "#2" }];
  return kindsOf(led(p, n)).join(",") === "rank,tier";
})());
ok("ledger: a new lastRun stamp logs 'run' with from/to dates", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", lastRun: "2026-07-01" }];
  const n = [{ sym: "X", tier: "S", lens: "AI", lastRun: "2026-07-28" }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "run" && out[0].from === "2026-07-01" && out[0].to === "2026-07-28";
})());
ok("ledger: thesis_version change logs 'thesis'", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1.0", updated: "2026-07-01" } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1.1", updated: "2026-07-28" } }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "thesis" && out[0].from === "v1.0" && out[0].to === "v1.1";
})());
ok("ledger: hinges matched by identity (label||key||id), not array position", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d",
    hinges: [{ id: "h1", state: "green" }, { id: "h2", state: "amber" }] } }];
  // reordered AND h1's state changed — a positional diff would misattribute the change to h2
  const n = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d",
    hinges: [{ id: "h2", state: "amber" }, { id: "h1", state: "red" }] } }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "hinge" && out[0].field === "h1" && out[0].from === "green" && out[0].to === "red";
})());
ok("ledger: the floor multiple edit logs a clean before/after number", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d", pt_model: { pe_floor_multiple: 18 } } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d", pt_model: { pe_floor_multiple: 20 } } }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "pt" && out[0].field === "floor" && out[0].from === 18 && out[0].to === 20;
})());
ok("ledger: a non-floor pt_model edit still logs, generically (never silently dropped)", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d", pt_model: { pe_floor_multiple: 18, ev_s_multiple: 5 } } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d", pt_model: { pe_floor_multiple: 18, ev_s_multiple: 8 } } }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "pt" && out[0].field === "model" && out[0].to === "revised";
})());
ok("ledger: the composite score is parsed from free text, decimal preferred over a bare integer", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d", composite: { score: "R3-A: 7.2" } } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d", composite: { score: "R3-A: 6.9" } } }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "comp" && out[0].from === 7.2 && out[0].to === 6.9;
})());
ok("ledger: consensus estimate revisions log per (field,year), capped at 3 per sym per write", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d",
    consensus: { revenue_B: { 2027: 10, 2028: 20, 2029: 30, 2030: 40 }, eps: { 2028: 1 } } } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", deepDive: { thesis_version: "v1", updated: "d",
    consensus: { revenue_B: { 2027: 11, 2028: 21, 2029: 31, 2030: 41 }, eps: { 2028: 2 } } } }];
  const out = led(p, n);
  return out.length === 3 && out.every((e) => e.kind === "est") && out[0].field === "rev:2027";
})());
ok("ledger: the projection answers log by the field that actually changed", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", projection: { rev_3yr: { value_B: 30 }, margins: { path: "expanding", why: "x" }, multiple: { value: 5 } } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", projection: { rev_3yr: { value_B: 35 }, margins: { path: "expanding", why: "x" }, multiple: { value: 5 } } }];
  const out = led(p, n);
  return out.length === 1 && out[0].kind === "proj" && out[0].field === "rev_3yr_B" && out[0].from === 30 && out[0].to === 35;
})());
ok("ledger: a cut addition logs, a cut removal does not", (() => {
  const out1 = led([{ sym: "X", tier: "S", lens: "AI" }], [{ sym: "X", tier: "S", lens: "AI" }], [], ["ZZZ"]);
  const out2 = led([{ sym: "X", tier: "S", lens: "AI" }], [{ sym: "X", tier: "S", lens: "AI" }], ["ZZZ"], []);
  return out1.length === 1 && out1[0].kind === "cut" && out1[0].sym === "ZZZ" && out2.length === 0;
})());
// BELIEFS ONLY — the user's explicit call. pos/ref_px/dots/note are facts or scratch,
// never conviction, and must never appear in the ledger.
ok("ledger: pos, ref_px, dots and note changes log NOTHING", (() => {
  const p = [{ sym: "X", tier: "S", lens: "AI", note: "old",
    pos: { sh: 100, mv: 1000, at: "2026-07-28T00:00:00Z", src: "r" },
    dots: [],
    deepDive: { thesis_version: "v1", updated: "d", ref_px: { px: 100, at: "2026-07-27" } } }];
  const n = [{ sym: "X", tier: "S", lens: "AI", note: "brand new text",
    pos: { sh: 150, mv: 1500, at: "2026-07-28T12:00:00Z", src: "r" },
    dots: [{ t: "2026-07-28", note: "x", state: "new" }],
    deepDive: { thesis_version: "v1", updated: "d", ref_px: { px: 105, at: "2026-07-28" } } }];
  return led(p, n).length === 0;
})());
ok("ledger: an unrelated PUT (nothing actually different) logs nothing at all",
  led([{ sym: "X", tier: "S", lens: "AI" }], [{ sym: "X", tier: "S", lens: "AI" }]).length === 0);
ok("ledger: every entry is stamped with the write's own timestamp and version (never self-attested)",
  led([], [{ sym: "X", tier: "S", lens: "AI" }]).every((e) => e.t === "2026-07-28T18:00:00Z" && e.v === "1.1"));

// The append-on-PUT wiring and the fire-and-forget guarantee (a ledger fault must never
// fail the book write the user is waiting on).
ok("tt.js: the ledger is appended AFTER the book write succeeds, inside a try/catch",
  ttSrc.indexOf("await env.PULSE_CACHE.put(BOOK_KEY, JSON.stringify(stored));") <
    ttSrc.indexOf("const entries = diffForLedger(") &&
  ttSrc.includes("the book write already succeeded; the ledger is best-effort"));
ok("tt.js: per-sym ledgers are capped, oldest pruned first",
  ttSrc.includes("const LEDGER_CAP = 500;") && ttSrc.includes("cur = cur.slice(cur.length - LEDGER_CAP);"));

// functions/api/ledger.js: the read path. No write handler exists here on purpose — belief
// history is a byproduct of book edits, never a thing edited directly.
const ledgerSrc = readFileSync(new URL("../functions/api/ledger.js", import.meta.url), "utf8");
ok("ledger.js: PIN-gated like /api/tt — belief history is as private as the book",
  (ledgerSrc.match(/const auth = await authorize\(request, env\);/g) || []).length === 2);
// v3.54: this pin used to read "read-only by design — no PUT/POST handler exists" and PASSED
// while ?seed=1 wrote to KV on GET. It was measuring the VERB, not the SAFETY — the exact
// gap the 11.4.5 audit found. The real invariant is that reading never mutates and the one
// mutation is a guarded POST.
ok("ledger.js: entries are never mutated by a read — the sole write is a guarded POST",
  !/onRequestPut/.test(ledgerSrc) && /export async function onRequestPost/.test(ledgerSrc) &&
  // runSeed must be unreachable from the GET handler: everything before onRequestPost.
  !/return runSeed/.test(ledgerSrc.slice(0, ledgerSrc.indexOf("export async function onRequestPost"))) &&
  /seed mutates state — use POST/.test(ledgerSrc));
ok("ledger.js: the seed backfill is idempotent — a second call is a documented no-op",
  ledgerSrc.includes('reason: "already seeded') );
ok("ledger.js: the recent-across-book mode is ONE list + N reads, not an N+1 client round trip",
  ledgerSrc.includes('list = await env.PULSE_CACHE.list({ prefix: LEDGER_PREFIX })') &&
  ledgerSrc.includes('recent") === "1"'));
ok("ledger.js: backfilled px uses ref_px only when dated near the entry, else stays null (never fabricated)",
  ledgerSrc.includes("Math.abs(d1 - d2) <= 2 * 86400000 ? rp.px : null"));

// ---- 16. FEAT-TT-POSSTORE (v3.34) — positions split out of the book -------
// Three sync passes hit the same 64KB book ceiling trying to add pos data for the names
// still missing it. functions/api/positions.js gives pos its own KV document, same fix
// shape as the ledger. Structural guards only — like ledger.js, no mock-KV handler tests.
console.log("\n[16] functions/api/positions.js — pos split out of the book");
const posSrc = readFileSync(new URL("../functions/api/positions.js", import.meta.url), "utf8");
ok("positions.js: PIN-gated like /api/tt — position data is at least as sensitive as the book",
  (posSrc.match(/const auth = await authorize\(request, env\);/g) || []).length === 3);
ok("positions.js: reuses the shared validatePos from tt.js rather than redefining the bands",
  posSrc.includes('import { authorize, validatePos } from "./tt.js";') && !/function validatePos/.test(posSrc));
ok("positions.js: PUT is MERGE-ONLY — a partial sync must never blank the names it didn't touch",
  posSrc.includes("const positions = { ...posMapFrom(stored) };") &&
  posSrc.includes('body.updates must be an object'));
ok("positions.js: {sym: null} is the explicit removal path for a fully-exited name",
  posSrc.includes('if (updates[s] === null) delete positions[s];'));
ok("positions.js: a bad pos in the update batch rejects the whole PUT before any KV write",
  (() => {
    const put = posSrc.slice(posSrc.indexOf("export async function onRequestPut"));
    return put.indexOf("const err = validatePos(p);") < put.indexOf("await env.PULSE_CACHE.get(POS_KEY");
  })());
ok("positions.js: the one-time migration is idempotent — a second call is a documented no-op",
  posSrc.includes('reason: "no embedded pos fields on the book — already migrated or nothing synced yet"'));
ok("positions.js: migration snapshots the book before stripping it, same restore-point rule as tt.js",
  posSrc.includes("SNAP_PREFIX + etDate()") && posSrc.includes("if (!existing) await env.PULSE_CACHE.put(snapKey, JSON.stringify(book)"));
ok("positions.js: only GET/PUT/POST are handled, and POST carries the migration alone",
  !/onRequestDelete/.test(posSrc) && /unknown POST action/.test(posSrc) &&
  /if \(request\.method === "POST"\) return onRequestPost/.test(posSrc));
ok("tt.js: validateBook no longer validates or even looks at e.pos — it moved out entirely",
  !ttSrc.includes('e.sym + " pos: "'));

// Client (admin.html) — pinned at source, same rule as every other buildless invariant here.
ok("dd: the HISTORY drawer is lazy-loaded per sym and redraws only if still on that tab",
  adminSrc.includes("function loadLedgerSym(sym)") && adminSrc.includes('if(TAB===sym)renderDeepDive(sym);'));
ok("dd: an absent since-move (no entry.px or no live quote) renders nothing, never a guess",
  adminSrc.includes("function ledgerSince(e)") && adminSrc.includes("if(e.px==null||!isFinite(e.px)||!live||!isFinite(live.px))return \"\";"));
ok("board: SCORECARD filters to tier/rank/comp — a run stamp or hinge flip isn't a conviction record",
  adminSrc.includes('const SCORECARD_KINDS=new Set(["tier","rank","comp"]);'));
ok("board: SCORECARD sorts by the SIZE of the since-move, not recency",
  adminSrc.includes("Math.abs(b.mv??0)-Math.abs(a.mv??0)"));
ok("divergence: same-direction moves are NOT the signal — only the split is",
  adminSrc.includes("if(estDir===pxDir)return;") && adminSrc.includes("agreement is not the signal"));
ok("divergence: needs MOVE_PCT worth of price move, reusing the existing threshold constant",
  adminSrc.includes("if(Math.abs(pxMove)<MOVE_PCT)return;"));
ok("spread: impliedMultiple inverts the SAME row ptModelRows computed (no second calculation)",
  adminSrc.includes("function impliedMultiple(t,px)") &&
  adminSrc.includes("sh,nc,revFwd:rev[fwd],epsFwd:e,pe};"));
ok("spread: a floor-only row (no premium multiple) renders no spread — nothing to invert",
  adminSrc.includes("if(!onFloor){") && adminSrc.includes("const imp=impliedMultiple(t,px);"));
ok("spread: street PT excludes bear/floor/severe columns, the same dim rule ddPtConsensusSec uses",
  (adminSrc.match(/floor\|bear\|severe/g) || []).length >= 2);
ok("spread: street PT renders only when that year's pt_consensus row actually exists",
  adminSrc.includes("const pcRow=dd.pt_consensus&&dd.pt_consensus.rows&&dd.pt_consensus.rows[t.y];"));

// ---- 17. v3.35 "The Analyst Desk" — UI revamp ------------------------------
console.log("\n[17] v3.35 fixpack + rollup + owndebt + estrun");
// fixpack: the 3-questions block rendered TWICE per tab (inline + val drawer). One copy.
ok("fixpack: the 3-questions block renders exactly once (the val-drawer copy)",
  (adminSrc.match(/The 3 questions — projection/g) || []).length === 1);
ok("fixpack: the quote batch's own timestamp is finally rendered (absent → nothing)",
  adminSrc.includes("quotes as of") && adminSrc.includes("LIVE_AT?`<span>quotes as of"));
ok("fixpack: every dd-pt table scrolls inside its own .tblx container (390px must not scroll)",
  adminSrc.includes(".tblx{overflow-x:auto") &&
  (adminSrc.match(/<div class="tblx"><table class="dd-pt"/g) || []).length ===
  (adminSrc.match(/<table class="dd-pt"/g) || []).length);
ok("fixpack: the chip tooltip's measured facts are tap-reachable on the card (MEASURED row)",
  adminSrc.includes('<div class="k">MEASURED</div>') &&
  adminSrc.includes("cost ${money(pp.cb)}") && adminSrc.includes("% unrl</span>"));
// FEAT-TT-ROLLUP: the tracked book summed — the number every broker leads with and this
// board never computed. It is a FLOOR over what synced, never presented as the account.
ok("rollup: bookRollup sums the tracked book and renderRollup is in the render chain",
  adminSrc.includes("function bookRollup()") && adminSrc.includes("renderCoverage();renderRollup();"));
ok("rollup: P/L sums ONLY names where both mv and cb are measured — no fabricated denominators",
  adminSrc.includes("if(isFinite(m)&&isFinite(c)){cb+=c;pl+=m-c;plN++;}"));
ok("rollup: the strip is honestly labeled a floor, never the account",
  adminSrc.includes("tracked book only — NOT NAV; a floor, not the account"));
ok("rollup: nothing measured renders NOTHING — a $0 total would read as a fact",
  adminSrc.includes('if(!r.mvN){el.style.display="none";el.innerHTML="";return;}'));
ok("rollup: no cost basis anywhere → says so rather than claiming a P/L of 0",
  adminSrc.includes("no cost basis synced — no P/L claimed"));
ok("rollup: sits between the TODAY card and WHAT CHANGED",
  adminSrc.indexOf('id="bookRollup"') > adminSrc.indexOf('id="todayCard"') &&
  adminSrc.indexOf('id="bookRollup"') < adminSrc.indexOf('id="dChanged"'));
// FEAT-TT-OWNDEBT: cb/upl_pct/src/opt[] were validated, stored, and rendered nowhere.
ok("owndebt: the option-legs table exists and strike renders only where captured",
  adminSrc.includes("function ddOptSec(p)") &&
  adminSrc.includes('isFinite(Number(o.strike))?"$"+esc(o.strike):""') &&
  adminSrc.includes("strike shown only where captured"));
ok("owndebt: the expiry window is a named constant shared by tab, ladder and summary",
  adminSrc.includes("const OPT_NEAR_D=60;") && (adminSrc.match(/OPT_NEAR_D/g) || []).length >= 6);
ok("owndebt: an options-only position no longer reads as unheld",
  adminSrc.includes("options only — no shares") && adminSrc.includes("◇opt"));
ok("owndebt: the chip carries measured unrealized P/L where present",
  adminSrc.includes('class="pl"') && adminSrc.includes(".chip .pl{font-size:9px"));
ok("owndebt: the book-wide expiry ladder lives in the EXPOSURE drawer, and its summary counts near legs",
  adminSrc.includes('id="optLadder"') && adminSrc.includes("function renderOptLadder()") &&
  adminSrc.includes("leg${legsNear===1?\"\":\"s\"} ≤${OPT_NEAR_D}d"));
ok("owndebt: option expiries never feed binaryEvents (an expiry is your clock, not a market binary)",
  (()=>{const b=adminSrc.slice(adminSrc.indexOf("function binaryEvents"),adminSrc.indexOf("function renderBinaryCal"));
    return !/\bopt\b|allOptLegs/.test(b);})());
// FEAT-TT-ESTRUN: the estimate run and the targets it prices, one table.
ok("estrun: targets are JOINED from ptModelRows by forward year — never recomputed",
  adminSrc.includes("function estRunTable(x,dd)") &&
  adminSrc.includes("rowsByFwd[String(+r.y+1)]=r;"));
ok("estrun: EPS YoY on a sign-flip renders n/m — growth off a negative base is meaningless",
  adminSrc.includes('if(pv<=0)return "n/m";'));
ok("estrun: the merged renderers are DEAD — no second render path for estimates or the model",
  !adminSrc.includes("function ddPtModelSec") && !adminSrc.includes("function ddConsensusSec"));
ok("estrun: the section label carries the tier — the math renders under the tier claim",
  adminSrc.includes("ESTIMATE RUN — ${esc(TIER_LABEL[x.tier]"));
/* v3.68: the PT horizon is stated where the %/yr is read. */
/* v3.69 NARRATIVE FIRST — the public dashboard reorder. */
ok("v3.69: the 5 Whys block renders in the overview region, before the markets section (source order)",
  dashSrc.indexOf("5 Whys · Today") > dashSrc.indexOf('id="overview"')
  && dashSrc.indexOf("5 Whys · Today") < dashSrc.indexOf('aria-labelledby="markets"'));
ok("v3.69: the 5 Whys is NOT inside any CollapsedGroup (LOADING/ERROR anchors are read from body text)",
  !/CollapsedGroup[^>]*>[\s\S]{0,600}5 Whys · Today/.test(dashSrc));
ok("v3.69: ONE market-detail CollapsedGroup (chart + 10 tiles) inside the markets section, chip-free",
  dashSrc.includes('label="full market detail — chart & tiles" chip={false}')
  && (dashSrc.match(/full market detail/g)||[]).length===1);
ok("v3.69: the 60/40 command-center grid is gone — no two-column race can bury the narrative again",
  !dashSrc.includes("command-grid") && !dashSrc.includes("60fr 40fr"));
ok("v3.69: markets/macro/ai are real sections (drivers/health pattern), and the operator monitors have their own",
  dashSrc.includes('<section aria-labelledby="markets">')
  && dashSrc.includes('<section aria-labelledby="macro">')
  && dashSrc.includes('<section aria-labelledby="ai">')
  && dashSrc.includes('aria-label="Operator monitors — conviction and alerts"'));
ok("v3.69: dead components deleted (defined-but-never-rendered LaunchCostCard/EvtolCertCard)",
  !dashSrc.includes("LaunchCostCard") && !dashSrc.includes("EvtolCertCard"));
ok("hz-chip: ONE builder (hzDeckChip) states the year and offers auto/nearest INLINE, one tap, no navigation",
  /function hzDeckChip\(\)/.test(adminSrc)
  && /quick\(HZ_AUTO,"auto"\)/.test(adminSrc)
  && /quick\("","nearest"\)/.test(adminSrc)
  && /onclick="setHorizon\('\$\{v\}'\)"/.test(adminSrc));
ok("hz-chip: pinning a SPECIFIC year still deep-links to the full picker — only auto/nearest are one-tap",
  /openDesk\('dNext'\)" title="pin a specific year/.test(adminSrc));
ok("hz-chip: BOTH deck labels carry it (BUY + both FUNDING PRIORITY branches) — 3 call sites, zero drift",
  (adminSrc.match(/\$\{hzDeckChip\(\)\}/g)||[]).length===3);
/* v3.67: the deck height is a budget, not a floor. */
ok("deck: sizeDecisionDeck measures ONLY the active panel — the hidden one still cannot lengthen the page",
  /function sizeDecisionDeck\(\)/.test(adminSrc)
  && /getElementById\(active\?"decisionFund":"decisionBuy"\)/.test(adminSrc));
ok("deck: measured height is capped at the SAME budget the CSS names (520 / viewport−220) — over-budget panels still scroll",
  /Math\.max\(520,Math\.round\(\(window\.visualViewport\?visualViewport\.height:innerHeight\)-220\)\)/.test(adminSrc)
  && /Math\.min\(need,budget\)/.test(adminSrc));
ok("deck: the CSS fixed height SURVIVES as the no-JS fallback, and desktop clears the inline override",
  adminSrc.includes("height:max(520px,calc(100svh - 220px))")
  && /matchMedia\("\(max-width: 700px\)"\)\.matches\)\{deck\.style\.height="";return;\}/.test(adminSrc));
ok("deck: async content lands re-measure via a debounced MutationObserver, and every tab switch re-sizes",
  /new MutationObserver[\s\S]{0,120}sizeDecisionDeck/.test(adminSrc)
  && /toggleAttribute\("inert",compact&&n!==i\);\s*\}\}\);\s*sizeDecisionDeck\(\);/.test(adminSrc));
ok("deck: .decision-page is position:relative so child offsetTop measures page-relative",
  /\.decision-page\{flex:0 0 100%;height:100%;min-height:0;overflow-y:auto;position:relative;/.test(adminSrc));
/* v3.66 QUIET BOARD: every free-text blob on a decision surface is chip-length in place and
   verbatim one tap deep. Machine reds (runState flags, lints, sev=stop changes, dropped-name
   warnings) stay visible while everything around them collapses — the v3.25 rule. */
ok("quiet: TODAY stance splits the parenthetical into an est-mini at RENDER; stance() prose untouched",
  adminSrc.includes('const par=s.txt.indexOf(" (");')
  && /tdy-stance[\s\S]{0,200}details class="est-mini"><summary>why<\/summary>/.test(adminSrc));
ok("quiet: queue pick chips truncate rank prose at 32ch; runState red flags are NOT truncated",
  adminSrc.includes('scopeFull.length>32?scopeFull.slice(0,32).trim()+"…"')
  && adminSrc.includes('○ no TT run on record'));
ok("quiet: est-run board summaries carry tier only — rank prose renders in the body (v3.64 at board altitude)",
  /<summary><span class="sym">\$\{esc\(it\.x\.sym\)\}[\s\S]{0,120}\$\{esc\(it\.x\.tier\)\}<\/span>/.test(adminSrc)
  && !/<summary>[\s\S]{0,300}\$\{esc\(it\.x\.rank\)\}[\s\S]{0,120}<\/summary>/.test(adminSrc)
  && /rank note<\/span><br>\$\{esc\(it\.x\.rank\)\}/.test(adminSrc));
ok("quiet: upside methodology + model-note caveats live in an est-mini; ranked count + dropped names + price basis stay visible",
  adminSrc.includes("how this list is ranked${excluded?")
  && /est-mini"><summary>how this list is ranked[\s\S]{0,2000}caveats\+/.test(adminSrc)
  && (adminSrc.match(/caveats\+/g)||[]).length===1);
ok("quiet: WHAT CHANGED keeps sev=stop rows visible and groups the rest behind a counted est-mini",
  adminSrc.includes('dStops.map(row).join("")')
  && /dRest\.length\?`<details class="est-mini"><summary>\$\{dRest\.length\} more change/.test(adminSrc));
ok("horizon: names dropped for lacking the pinned year are NAMED, not just counted (v3.65)",
  /noRungSyms=hz\?cands\.filter/.test(adminSrc)
  && /dropped — no \$\{esc\(hz\)\} rung: \$\{noRungSyms\.map\(esc\)\.join/.test(adminSrc));
ok("horizon: a pinned horizon that drops names points at 'auto' as the fix, and does not when already auto",
  /isAuto\?"":` · "auto" would pick a year every model reaches`/.test(adminSrc));
ok("est-run: the label carries the TIER ONLY — rank prose and estimate source moved into an expander (v3.64)",
  /ESTIMATE RUN — \$\{esc\(TIER_LABEL\[x\.tier\]\|\|x\.tier\)\}<\/div>/.test(adminSrc));
ok("est-run: rank + source render inside a details.est-mini, never a drawer (the phone harness counts open drawers)",
  /noteBits\.push\(\["rank note",x\.rank\]\)/.test(adminSrc)
  && /details class="est-mini"><summary>\$\{noteBits/.test(adminSrc)
  && !/noteBits[\s\S]{0,400}class="drawer"/.test(adminSrc));
ok("est-run: the collapse documents WHY it cannot hide a red (reds render outside it)",
  /not a\s*\n\s*\/\/ machine-known red channel/.test(adminSrc));
ok("estrun: renders above the fold in the deep dive, not inside the val drawer",
  adminSrc.indexOf("h+=ddEstRunSec(x,dd);") < adminSrc.indexOf('h+=ddDrawer("val"') &&
  adminSrc.indexOf("h+=ddEstRunSec(x,dd);") > 0);
ok("estrun: a stamped-mark upside says so — the same PX_STALE_D flag ddWorth uses",
  adminSrc.includes("upside computed off a stamped mark"));
// The board expression: every modelled name inside NEXT DOLLAR & UPSIDE.
ok("estrun: the board rows live inside the NEXT DOLLAR drawer, after the upside rank",
  adminSrc.indexOf('id="estRunBoard"') > adminSrc.indexOf('id="upsideRank"') &&
  adminSrc.indexOf('id="estRunBoard"') < adminSrc.indexOf('id="dExp"'));
ok("estrun: board open-state survives the async re-renders (quotes/pos/ledger each re-fire render)",
  adminSrc.includes("const EST_OPEN=new Set();") && adminSrc.includes('ontoggle="estToggle('));
ok("estrun: board rows are est-mini, never drawer — the phone harness counts open drawers",
  adminSrc.includes("details.est-mini{") && !adminSrc.includes('class="drawer est-mini"') &&
  !adminSrc.includes('class="est-mini drawer"'));
ok("estrun: the board table IS the deep-dive table — one renderer, two surfaces",
  adminSrc.includes("estRunTable(it.x,it.x.deepDive)"));
ok("estrun: the board states its denominator (N modelled of M)",
  adminSrc.includes("modelled of ${BOOK.length}"));

// ---- 18. FEAT-TT-RANKFAIR (v3.36) — the ranking audit ----------------------
// The ranking answered "what is cheapest" while being asked "where does the next dollar
// go". Weight is now a ranking input, not a footnote.
console.log("\n[18] FEAT-TT-RANKFAIR — weight-aware ranking");
ok("rankfair: weight is computed per name against the tracked book, never NAV",
  adminSrc.includes("function rankWeight(sym)") && adminSrc.includes("const tot=bookRollup().mv;"));
ok("rankfair: markers are the cap constants, not magic numbers (** at cap, * at 10%)",
  adminSrc.includes('mark:w>=CAP_PCT?"**":w>=10?"*"'));
ok("rankfair: an options-only position gets its OWN marker, never a misleading 0%",
  adminSrc.includes("opt-only — weight not measurable") &&
  adminSrc.includes('const optOnly=Array.isArray(p.opt)&&p.opt.length>0&&!(Number(p.sh)>0);'));
ok("rankfair: a name at/over the cap can NEVER be the next dollar, however wide its gap",
  adminSrc.includes("at the ${CAP_PCT}% cap, no room") &&
  adminSrc.indexOf("if(r.wt.w!==null&&r.wt.w>=CAP_PCT)") < adminSrc.indexOf('if(!r.tt)return "unscored'));
ok("rankfair: every pick renders its held weight beside the upside",
  adminSrc.includes("r.wt") && adminSrc.includes("weights are % of TRACKED BOOK (a floor"));
ok("rankfair: queue names with NO model are NAMED, not silently missing from the ranking",
  adminSrc.includes("cannot be ranked here — no pt_model"));
ok("rankfair: the ranking spans held AND unheld, and says which — a blank would be ambiguous",
  adminSrc.includes("new — not held") && adminSrc.includes("held · size unmeasured") &&
  adminSrc.includes('if(!p)return{w:null,mark:"",room:"open",optOnly:false,held:false};'));

// ---- 19. v3.38 "Four Drivers" — FOCUS2 + SELLRANK + REFRESH ----------------
console.log("\n[19] v3.38 — four-driver view, computed sell list, refresh button");
ok("sellrank: forced trims (over cap) rank before every discretionary trim",
  adminSrc.includes("function sellRank()") &&
  adminSrc.indexOf("forced.sort((a,b)=>b.trimPts-a.trimPts);") < adminSrc.indexOf("disc.sort((a,b)=>{"));
// v3.44: the sort gained an options branch, but the RETURN-based rule is unchanged —
// asserted behaviourally now rather than by matching the old one-line literal.
ok("sellrank: discretionary order is LOWEST expected return first — that dollar funds the next one",
  adminSrc.includes("return a.basis===\"return\"?a.ann-b.ann:b.mv-a.mv;") &&
  adminSrc.includes("lowest expected return funds first") &&
  (() => { const rows=[{basis:"return",ann:9},{basis:"return",ann:-3},{basis:"return",ann:2}];
    rows.sort((a,b)=>{ if(a.basis!==b.basis)return a.basis==="return"?-1:1;
      return a.basis==="return"?a.ann-b.ann:b.mv-a.mv; });
    return rows.map(r=>r.ann).join()==="-3,2,9"; })());
ok("sellrank: a forced trim carries the computed dollar amount to get back to cap",
  adminSrc.includes("row.trim$=Math.round(mv*(w-CAP_PCT)/w);") && adminSrc.includes("to cap"));
ok("sellrank: do_not_trim is flagged, never hidden — and a cap contradiction is named",
  adminSrc.includes("session says do-not-trim — shown, not hidden") &&
  adminSrc.includes("cap and do-not-trim CONTRADICT"));
// v3.44 FEAT-TT-OPTMV: options-only positions now rank IN the list on realisable dollars.
// Only genuinely-unrankable sleeves are named below it, each with its own reason.
ok("sellrank: unmodelled names are NAMED, and an unrankable options sleeve says WHY",
  adminSrc.includes("cannot rank — no model:") &&
  adminSrc.includes("leg(s) have no synced value") &&
  adminSrc.includes("a USE of cash"));
ok("optmv: a sleeve is measured only when EVERY leg carries mv — a partial sum would " +
   "understate the position, so it fails closed like pos.at and lastRun",
  adminSrc.includes("function optSleeve(p)") &&
  adminSrc.includes("if(missing.length)return{measured:false"));
ok("optmv: the sleeve sum is SIGNED — a short leg is a liability, so a net-short sleeve is " +
   "reported as an obligation and never as available funding",
  adminSrc.includes("legs.reduce((a,o)=>a+Number(o.mv),0)") &&
  adminSrc.includes("net short — closing costs"));
ok("optmv: an options row states it was ranked on DOLLARS, not on a rate it does not own",
  adminSrc.includes("ranked on realisable dollars — a leg's return is not the underlying's"));
ok("optmv: an options row qualifies on dollars ALONE — requiring a model would have " +
   "re-created the very exclusion this removes",
  adminSrc.includes("if(oo){disc.push(row);}"));
ok("optmv: an options row bypasses the CAP tier — CAP_PCT is measured against equity mv / " +
   "broker pct, a denominator a sleeve's value is not comparable to",
  /if\(oo\)\{disc\.push\(row\);\}\s*\n\s*else if\(w>=CAP_PCT\)/.test(adminSrc));
ok("optmv: the server rejects a sign-contradicting leg (long with mv<0, short with mv>0)",
  (() => {
    const base = { at: "2026-07-30T14:00:00Z", src: "sync" };
    const leg = (side, mv) => ({ ...base, opt: [{ k: "call", side, n: 1, mv }] });
    return validatePos(leg("long", 500)) === null && validatePos(leg("short", -500)) === null &&
      /LONG/.test(validatePos(leg("long", -500)) || "") &&
      /SHORT/.test(validatePos(leg("short", 500)) || "");
  })());
ok("sellrank: the asserted funding order is reconciled, married never merged",
  adminSrc.includes("session funding order asserts") &&
  adminSrc.includes("disagreement is information, not an average"));
ok("sellrank: the cap decision prefers measured % of NAV, falling back to the tracked floor",
  adminSrc.includes("const wNav=isFinite(Number(p.pct))?Number(p.pct):null;"));
ok("focus2: the buy block renders the SAME rows the upside rank sorted — never a second sort",
  adminSrc.includes("UPSIDE_ROWS=rows;") && adminSrc.includes("const rows=UPSIDE_ROWS.slice(0,5);"));
// v3.42: the badges became real <button>s (focusable, Enter-activatable) — same red counts.
ok("focus2: the stance strip carries the red counts a closed DESK would otherwise hide",
  adminSrc.includes("over cap</button>") && adminSrc.includes('onclick="openDesk(') &&
  adminSrc.includes("function renderStance()"));
ok("focus2: primary blocks render LAST in the chain, reading what the strips computed",
  adminSrc.includes("renderStance();renderBuyBlock();renderSellBlock();renderCalBlock();renderTabs();"));
ok("refresh: the button refetches quotes+positions+regime and reports the quote-cache window honestly",
  adminSrc.includes("async function refreshRanks()") &&
  adminSrc.includes("Promise.all([loadQuotes(),loadPositions(),loadRegime()])") &&
  adminSrc.includes("server caches 2 min"));
ok("refresh: the button disables while in flight and always re-enables",
  adminSrc.includes("b.disabled=true") && adminSrc.includes("finally{if(b){b.disabled=false"));

// ═══════════ v3.42 READABLE DESK (slice 1) — the first phone screen ═══════════
// The owner's screenshot circled the stance strip: five wrapped lines of uppercase prose with
// the ONE answer the terminal exists to give (may capital move?) buried mid-sentence in the
// same weight and size as its qualifiers. Slice 1 restructures the first phone screen only:
// verdict token + qualifier chips + tap-deep prose, one scrollable tab row, design tokens.
console.log("\n[21] v3.42 READABLE DESK — stance bar, tab strip, tokens");
ok("stance: every stance() branch carries a structured verdict token beside the pinned prose",
  ['verdict:"NO NEW POSITIONS"', 'verdict:"UNKNOWN"', 'verdict:"ADDS SUSPENDED"',
   'verdict:"ADDS GATED"', 'verdict:"ADDS OK"'].every((s) => adminSrc.includes(s)));
ok("stance: the long free-text asserted regime is TRUNCATED on the chip, verbatim in the drawer",
  adminSrc.includes("s.length>26?s.slice(0,25)") && adminSrc.includes("stricter governs)"));
ok("stance: the full prose lives one tap deep in details.why — NOT class=drawer (the phone " +
   "harness counts open drawers; strip chrome must not register as one)",
  (() => {
    const s = adminSrc.indexOf("function renderStance()");
    const body = adminSrc.slice(s, adminSrc.indexOf("\n}", s));
    return body.includes('<details class="why"><summary>why</summary>') && !body.includes('<details class="drawer"');
  })());
ok("stance: the caution→amber map bug is fixed (k:'caution' used to fall through to slate)",
  adminSrc.includes('caution:"var(--amber)"'));
ok("stance: the verdict token renders at --fs-l via .vbadge (readable at arm's length)",
  adminSrc.includes(".vbadge{font-size:var(--fs-l)") && adminSrc.includes('class="vbadge"'));
ok("tabs: ONE scrollable row, never a five-row wrap (flex-wrap:nowrap + overflow-x:auto + " +
   "flex-shrink:0 per tab)",
  /\.tabs\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/.test(adminSrc) &&
  /\.tabs \.tab\{[^}]*flex-shrink:0/.test(adminSrc));
ok("tabs: the active tab is scrolled into view with block:nearest (a render can never yank " +
   "the page vertically)", adminSrc.includes('scrollIntoView({block:"nearest"'));
ok("tokens: type + spacing scales and --focus exist in :root",
  ["--fs-xs:", "--fs-l:", "--sp-1:", "--sp-4:", "--focus:var(--green)"].every((s) => adminSrc.includes(s)));
ok("a11y: --dim lifted to #71877b (old #5f7469 measured ≈3.9:1 on --bg, below AA)",
  adminSrc.includes("--dim:#71877b") && !adminSrc.includes("--dim:#5f7469"));
ok("a11y: :focus-visible ring exists and decorative motion respects prefers-reduced-motion",
  adminSrc.includes(":focus-visible{outline:") &&
  adminSrc.includes("@media(prefers-reduced-motion:reduce){header::before,.cursor{animation:none}}"));
ok("a11y: thumb-sized tap targets at phone widths (badges + tabs ≥40px min-height ≤480px)",
  /max-width:480px[^}]*\{[\s\S]{0,200}min-height:40px/.test(adminSrc));

// ---- slice 2: driver rows are grid BUTTONS; skeletons hold first-paint geometry ----------
ok("slice2: BUY/SELL rows are real <button class=fdr-row> — focusable, Enter opens the card",
  /<button class="fdr-row" onclick="openCard\('\$\{esc\(r\.sym\)\}'\)">/.test(adminSrc) &&
  /\.fdr \.fdr-row\{display:grid/.test(adminSrc));
ok("slice2: the primary datum is promoted to --fs-l on its own grid column (.fdr-p)",
  adminSrc.includes(".fdr .fdr-p{font-size:var(--fs-l)") && adminSrc.includes('class="fdr-p"'));
ok("slice2: a calendar event WITHOUT a book entry stays a <div> — a button that does nothing is a lie",
  adminSrc.includes('const act=!!find(e.sym);') && adminSrc.includes('const tag=act?"button":"div";'));
ok("slice2: skeletons render only while the FIRST load is pending, and settle on success AND failure",
  adminSrc.includes("let QUOTES_PENDING=true,POS_PENDING=true;") &&
  adminSrc.includes("finally{POS_PENDING=false;render();}") &&
  adminSrc.includes('?`<div class="skel-row"></div>'));
ok("slice2: the skeleton shimmer is gated behind prefers-reduced-motion (static placeholder otherwise)",
  /prefers-reduced-motion:no-preference[^}]*\{\s*\.skel-row::after\{animation/.test(adminSrc));
ok("slice2: span-onclick pseudo-links in the driver blocks became linklike buttons",
  (adminSrc.match(/<button class="linklike"/g)||[]).length>=3 &&
  !/renderBuyBlock[\s\S]{0,2000}<span style="cursor:pointer;color:var\(--cyan\)"/.test(adminSrc));

// ---- slice 3: book chips + tab strip are keyboard-reachable ------------------------------
ok("slice3: tier chips are real <button type=button> — keyboard-reachable via Enter/Space",
  adminSrc.includes('const c=document.createElement("button");') &&
  adminSrc.includes('c.type="button";'));
ok("slice3: the CUT row (non-interactive) is deliberately left as a <div> — nothing to click",
  adminSrc.includes('CUT.forEach(s=>{const c=document.createElement("div");'));
ok("slice3: the tab strip is a real ARIA tablist — role, aria-selected, roving tabindex",
  adminSrc.includes('bar.setAttribute("role","tablist")') &&
  adminSrc.includes('role="tab" aria-selected="${on}"') &&
  adminSrc.includes('tabindex="${on?"0":"-1"}"'));
ok("slice3: arrow/Home/End keys move AND select (native tablist behavior), wrapping at the ends",
  adminSrc.includes('next=(i+1)%tabs.length') && adminSrc.includes('next=(i-1+tabs.length)%tabs.length') &&
  adminSrc.includes('e.key==="Home"') && adminSrc.includes('e.key==="End"'));
ok("slice3: drawer/schema summaries migrated onto the shared type scale, not a stray literal",
  adminSrc.includes("details.drawer>summary{cursor:pointer;list-style:none;padding:8px 12px;font-size:var(--fs-s);") &&
  adminSrc.includes("details.schema>summary{cursor:pointer;list-style:none;color:var(--dim);font-size:var(--fs-s);"));
ok("slice3: dd-pt table headers stick on scroll, phone-only (desktop tables are short enough not to need it)",
  /max-width:700px\)\{table\.dd-pt th\{position:sticky/.test(adminSrc));
ok("slice3: chips get the 40px thumb target at phone widths, same rule as slice 2's rows",
  /max-width:480px[^}]*\{[\s\S]{0,260}\.chip\{min-height:40px\}/.test(adminSrc));

// ---- slice 4: modal focus management + destructive-action confirm + live toast ----------
ok("slice4: all 9 overlay-open call sites funnel through ONE openModal() — " +
   'document.getElementById("overlay").classList.add("on") appears exactly once now, ' +
   "inside openModal() itself, not duplicated at each site (toast/pinGate keep their own)",
  (adminSrc.match(/document\.getElementById\("overlay"\)\.classList\.add\("on"\)/g)||[]).length===1 &&
  (adminSrc.match(/openModal\(\);/g)||[]).length===9);
ok("slice4: closeCard is now a thin wrapper over closeModal (same public name every onclick calls)",
  adminSrc.includes("function closeCard(){CURRENT=null;closeModal();}"));
ok("slice4: openModal remembers what was focused before opening, so closing restores it",
  adminSrc.includes("MODAL_RETURN=document.activeElement") &&
  adminSrc.includes("if(MODAL_RETURN&&MODAL_RETURN.focus"));
ok("slice4: a Tab/Shift+Tab trap is scoped to #overlay and wraps at the card's boundary",
  adminSrc.includes('document.getElementById("overlay").addEventListener("keydown"') &&
  adminSrc.includes('if(e.shiftKey&&document.activeElement===first)') &&
  adminSrc.includes('else if(!e.shiftKey&&document.activeElement===last)'));
ok("slice4: #pinGate is explicitly NOT part of the openModal/closeModal pair (by design)",
  !adminSrc.includes('pinGate").addEventListener("keydown"') &&
  adminSrc.includes("deliberately NOT part of this pair"));
ok("slice4: overwriteServer and discardLocal require a SECOND click via confirmLink — RETRY/EXPORT stay one-click",
  adminSrc.includes('confirmLink("cfOverwrite","KEEP MINE (overwrite server)","overwriteServer")') &&
  adminSrc.includes('confirmLink("cfDiscard","discard & reload server copy","discardLocal")') &&
  adminSrc.includes('<a href="javascript:persist()">${kind==="preview"?"SAVE THIS COPY":"RETRY"}</a>') &&
  adminSrc.includes('<a href="javascript:exportJSON()">EXPORT JSON (backup)</a>'));
ok("slice4: an armed confirm reverts on its own after the window — never stays armed forever",
  adminSrc.includes("CONFIRM_WINDOW_MS=4000") && adminSrc.includes("setTimeout(()=>{const e2=document.getElementById(id)"));
ok("slice4: the toast is a live region — screen readers hear it without needing focus",
  adminSrc.includes('id="toast" role="status" aria-live="polite" aria-atomic="true"'));

// ---- slice 5: only the highest-leverage things survive the first glance -------------------
// Measured at 390x844 BEFORE this slice: 587px of the screen (70%) sat above the BUY block,
// and the header alone was 209px of it — larger than the stance bar and tab strip combined.
ok("slice5: the header is ONE row — identity, the MACRO pill, and a ⋯ MENU disclosure",
  adminSrc.includes('<div class="hbar">') && adminSrc.includes('class="hb-id">TT<') &&
  adminSrc.includes('id="headToggle" aria-expanded="false" aria-controls="headInfo"'));
ok("slice5: version, BOOK/AUTH stamps, DASH and the whole action toolbar moved behind that " +
   "disclosure — status and occasional actions, never answers",
  /id="headInfo"[\s\S]{0,1800}single-pass deep-dive orchestrator[\s\S]{0,900}id="bookStamp"[\s\S]{0,900}id="sessState"[\s\S]{0,1200}\+ ADD TICKER[\s\S]{0,900}id="backupRow"/.test(adminSrc));
ok("slice5: the banners stay OUTSIDE the disclosure — an expired session or an unsaved edit " +
   "must never require opening a menu to discover",
  /id="headInfo"[\s\S]*?<\/div>\s*<!--[\s\S]*?-->\s*<div id="authBanner"/.test(adminSrc) &&
  adminSrc.indexOf('id="authBanner"')>adminSrc.indexOf('id="backupRow"'));
ok("slice5: the MACRO: label survives the compaction — v3.29 added it so the pill can't be " +
   "misread as the stance, which is an honesty invariant, not decoration",
  adminSrc.includes('<span>MACRO: <span class="pill neutral" id="regimePill"'));
ok("slice5: toggleHeadInfo keeps aria-expanded honest",
  adminSrc.includes("function toggleHeadInfo()") &&
  adminSrc.includes('b.setAttribute("aria-expanded",String(open))'));
// The asymmetry is the point: "ADDS OK" is the permissive default and the lowest-leverage
// sentence on the board; a restrictive stance is the one that must be unmissable.
ok("slice5: a PERMISSIVE stance renders a small pill — no big token, no qualifier chips, no " +
   "why drawer (renderToday() still shows txt AND why in full, one tap away inside DESK)",
  (() => {
    const i = adminSrc.indexOf('if(st.k==="go"){');
    if (i < 0) return false;
    const branch = adminSrc.slice(i, adminSrc.indexOf("return;", i));  // the permissive branch ONLY
    return branch.includes('class="qual"') && branch.includes("badges+controls") &&
      !branch.includes("vbadge") && !branch.includes('details class="why"') &&
      !branch.includes("st.quals");
  })());
ok("slice5: a RESTRICTIVE stance keeps the full treatment — token, quals and the why drawer",
  /el\.innerHTML=`<div class="stance-top">`\+\s*`<span class="vbadge"/.test(adminSrc) &&
  adminSrc.includes('<details class="why"><summary>why</summary>'));
ok("slice5: the red badges are hoisted so they render in BOTH states — the v3.25 rule is that " +
   "a red fact is never hidden by a collapse",
  adminSrc.includes("const badges=") && (adminSrc.match(/badges\+controls/g)||[]).length===2);

// ═══════════ [24] FEAT-TT-CAPEX (v3.45) — the hyperscaler capex tape ═══════════
// Every AI-infra beneficiary's revenue estimate is implicitly a bet on the hyperscaler capex
// pool; the tape makes the pool a dated, revision-tracked fact and the conservation lint makes
// the book's collective bet checkable. Owner call on NBIS-class names: grouped in AI infra for
// the tripwire, EXCLUDED from the pool sum (revenue draws AI rental demand, not the pool) with
// its OWN capex/rev ratio tracked instead.
console.log("\n[24] FEAT-TT-CAPEX — capex tape, tripwire, conservation");
ok("capex: validateBoard accepts a well-formed tape and rejects each malformation at the door",
  (() => {
    const good = { as_of: "2026-07-30", capex: { rows: [
      { co: "HYPA", fy_guide_B: 120, dir: "up", at: "2026-07-30" },
      { co: "HYPB", fy_guide_B: 70, dir: "down", at: "2026-07-29" }] } };
    const bad = (mut) => { const b = JSON.parse(JSON.stringify(good)); mut(b.capex); return validateBoard(b) !== null; };
    return validateBoard(good) === null &&
      bad((c) => { c.rows[0].dir = "cratering"; }) &&
      bad((c) => { delete c.rows[0].at; }) &&
      bad((c) => { c.rows[0].fy_guide_B = 5000; }) &&
      bad((c) => { c.rows = []; });
  })());
// Lift the pure client logic and run it — the smoke [20] pattern.
const cxLift = (() => {
  const g = (n) => { const i = adminSrc.indexOf(`function ${n}(`); return adminSrc.slice(i, adminSrc.indexOf("\n}", i) + 2); };
  const ctx = {};
  new Function("ctx", "let BOARD={},BOOK=[];" + g("capexState") + "\n" + g("capexExposure") + "\n" + g("lintCapexConservation") +
    "\nctx.run=(board,book)=>{BOARD=board;BOOK=book;return{st:capexState(),lint:lintCapexConservation()};};")(ctx);
  return ctx.run;
})();
const CX_ROWS = (dirs) => dirs.map((d, i) => ({ co: "HYP" + "ABCD"[i], fy_guide_B: [120, 118, 92, 70][i], dir: d, at: "2026-07-30" }));
ok("capex: the tripwire fires at ≥2 guiding DOWN, not at 1 — and re-acceleration at ≥2 UP",
  (() => {
    const one = cxLift({ capex: { rows: CX_ROWS(["down", "hold", "hold", "up"]) } }, []).st;
    const two = cxLift({ capex: { rows: CX_ROWS(["down", "down", "hold", "up"]) } }, []).st;
    const re  = cxLift({ capex: { rows: CX_ROWS(["up", "up", "hold", "down"]) } }, []).st;
    return one.turning === false && two.turning === true && two.downs === 2 &&
      re.reacc === true && two.aggB === 400;
  })());
const FY1 = String(+new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).slice(0, 4) + 1);
const CX_BOOK = [
  { sym: "AAA", deepDive: { capex_exposure: { type: "direct", pct_of_rev: 40 }, consensus: { revenue_B: { [FY1]: 55 } } } },
  { sym: "BBB", deepDive: { capex_exposure: { type: "neocloud", own_capex_B: 9 }, consensus: { revenue_B: { [FY1]: 9 } } } },
  { sym: "CCC", deepDive: { capex_exposure: { type: "fab" } } },
  { sym: "DDD", deepDive: { capex_exposure: { type: "direct" } } },          // direct but unmeasured
  { sym: "EEE", deepDive: { capex_exposure: {} } },                          // untyped
];
ok("capex: the conservation sum counts ONLY measured direct names (rev_FY+1 × pct)",
  (() => { const L = cxLift({ capex: { rows: CX_ROWS(["hold", "hold", "hold", "hold"]) } }, CX_BOOK).lint;
    return L.impliedB === 22 && L.direct.length === 1 && L.direct[0].sym === "AAA" &&
      L.unmeasured.join() === "DDD" && L.untyped.join() === "EEE"; })());
ok("capex: fab is EXCLUDED from the sum — inside a direct name's COGS, counting both " +
   "double-counts the same capex dollar",
  cxLift({ capex: { rows: CX_ROWS(["hold", "hold", "hold", "hold"]) } }, CX_BOOK).lint.fab.join() === "CCC");
ok("capex: neocloud is EXCLUDED from the sum and tracked on its OWN capex/rev ratio " +
   "(the owner's NBIS ruling — pool-cut sign is two-sided for a renter-builder)",
  (() => { const n = cxLift({ capex: { rows: CX_ROWS(["hold", "hold", "hold", "hold"]) } }, CX_BOOK).lint.neo;
    return n.length === 1 && n[0].sym === "BBB" && n[0].ratio === 1; })());
ok("capex: BREACH when the book implies more capex-funded revenue than the pool guided",
  (() => {
    const small = { capex: { rows: [{ co: "HYPA", fy_guide_B: 18, dir: "down", at: "2026-07-30" }] } };
    const L = cxLift(small, CX_BOOK).lint;
    return L.breach === true && L.impliedB === 22 && L.pctOfPool === 122;
  })());
ok("capex: a turning tape is a RED BADGE on the stance strip — visible while everything is closed",
  adminSrc.includes("openDesk('dCapex')") && adminSrc.includes("⚡ capex ${cxSt.downs}↓ of ${cxSt.rows.length}"));
ok("capex: the tape renders as its own DESK drawer whose closed summary carries the signal",
  adminSrc.includes('id="dCapex"') && adminSrc.includes('setDrawer("dCapex","sCapex"') &&
  adminSrc.includes("function renderCapex()"));
ok("capex: capex_exposure is a HANDLED deep-dive key (purpose-built section, no double render)",
  adminSrc.includes('"capex_exposure"') && adminSrc.includes("function ddCapexExpSec(dd)") &&
  ["DIRECT","FAB","POWER","NEOCLOUD"].every((t) => adminSrc.includes(t)));
ok("capex: the tape REPORTS, never enforces — no veto path reads capexState",
  !/AGREE_PICK[\s\S]{0,200}capexState|capexState\(\)[\s\S]{0,120}veto/.test(adminSrc));
// Dashboard: the third leg of AI Unit Economics.
ok("capex-dash: HYPERSCALER_CAPEX is curated WITH a reviewed date, rendered hatched + chipped, " +
   "behind a CollapsedGroup like the GPU cost side",
  dashSrc.includes("const HYPERSCALER_CAPEX") && /reviewed: "\d{4}-\d{2}-\d{2}"/.test(dashSrc) &&
  /HyperscalerCapexCard[\s\S]{0,900}ILLUS_HATCH/.test(dashSrc) &&
  dashSrc.includes('label="curated: hyperscaler capex funding flow"'));
ok("capex-dash: the section header names every leg (cost ↔ price ↔ conversion ↔ funding)",
  dashSrc.includes("cost ↔ price ↔ conversion ↔ funding"));
ok("capex-dash: it NEVER votes — computeRegime and the factor list are untouched by capex",
  !/computeRegime[\s\S]{0,2400}capex/i.test(dashSrc) &&
  !/REGIME_FACTOR_FIELDS=\[[^\]]*capex/i.test(dashSrc));

// ═══════════ FEAT-NFCI (v3.43) — financial conditions ═══════════
// Chosen over TLT (a levered inverse of the 10Y this page already carries) and over the
// curve/real-yield complex as the single highest-leverage add: one free weekly series that
// restates the dashboard's own thesis question as a number, absent from retail finance sites.
console.log("\n[22] FEAT-NFCI — financial conditions");
ok("nfci: the FRED series is wired into the existing batched fetch (no new fetch path)",
  /nfci:\s+"NFCI"/.test(snapSrc));
ok("nfci: it is NOT in the DAILY set — the idx[5]/idx[21] week/month offsets would be " +
   "5 and 21 WEEKS on a weekly series, which is exactly the bug that gating exists to stop",
  (() => { const m = /const DAILY = new Set\(\[([^\]]*)\]\)/.exec(snapSrc);
    return m && !/nfci/.test(m[1]) && /"tenYear"/.test(m[1]) && /"vix"/.test(m[1]); })());
// v3.55: DGS30 genuinely IS a daily series, so it belongs in DAILY — unlike NFCI, whose
// weekly cadence is exactly why the gate exists.
ok("30y: thirtyYear IS in the DAILY set — idx[5]/idx[21] really are ~1wk/~1mo on a daily series",
  /const DAILY = new Set\(\[[^\]]*"thirtyYear"[^\]]*\]\)/.test(snapSrc));
ok("nfci: W1 is derived from the prior observation, which on a weekly series really is a week",
  snapSrc.includes("out.nfciW1 = parseFloat((latest - prev).toFixed(3))"));
ok("nfci: a plausibility band exists and is WIDE — ±5 against a record high of ~+3.3 (2008), " +
   "rejecting the impossible without rejecting the unusual",
  (() => { const b = BANDS.nfci; return Array.isArray(b) && b[0] === -5 && b[1] === 5 &&
    plausible("nfci", 3.3) && plausible("nfci", -0.9) && !plausible("nfci", 42); })());
ok("nfci: cadence is WEEKLY, and its derivatives inherit that through the v3.41 parent " +
   "fallback rather than each needing their own entry",
  cadenceOf("nfci") === "weekly" && cadenceOf("nfciW1") === "weekly" && cadenceOf("nfciSeries") === "weekly");
ok("nfci: a stale weekly print is judged on the WEEKLY clock (12d), not the daily one",
  isStale("2026-07-20", new Date("2026-07-30"), cadenceOf("nfci")) === false &&
  isStale("2026-07-10", new Date("2026-07-30"), cadenceOf("nfci")) === true);
ok("nfci: the undated derivatives inherit the parent's date through the shared merge table",
  (() => { const { dataAsOf } = mergeLiveOverMock(MOCK_DATA,
    { live: { nfci: -0.42, nfciAsOf: "2026-07-24", nfciW1: 0.03 }, cached: false });
    return dataAsOf.nfciW1 === "2026-07-24"; })());
ok("nfci: it counts toward Signal Quality — a tracked live signal, not decoration",
  dashSrc.includes('"creditSpread","nfci"'));
// Zero is the historical mean by construction, so the SIGN is the signal. The deadband is
// asserted (this environment blocks FRED, so it could not be fitted to data) — pinned here
// so changing it is one edit plus one test, per the DEC-33 discipline.
// v3.43.1 — the bands are DERIVED, not asserted. NFCI is standardized to mean 0 / SD 1 over
// 1971–, so its native unit is standard deviations: 0 is the definitional mean, -0.5 is half
// an SD below it. The old ±0.10 was a decimal with no meaning in that unit.
ok("nfci: thresholds live in ONE shared table driving tile, vote and factor breakdown alike",
  regimeSrc.includes("export const NFCI_TIGHT = 0;") && regimeSrc.includes("export const NFCI_LOOSE = -0.5;") &&
  dashSrc.includes('const band=v>NFCI_TIGHT?"TIGHT":v<=NFCI_LOOSE?"LOOSE":"NEUTRAL"') &&
  regimeSrc.includes('vote:(v)=> v <= NFCI_LOOSE ? "bull" : v > NFCI_TIGHT ? "bear" : "neutral"') &&
  // …and the tile IMPORTS them rather than re-declaring (the one-table rule survives extraction)
  /import \{ NFCI_TIGHT, NFCI_LOOSE,/.test(dashSrc));
ok("nfci: the tight threshold is the DEFINITIONAL mean (0), not a hand-picked decimal",
  /const NFCI_TIGHT = 0;/.test(regimeSrc) && !dashSrc.includes("0.10?\"TIGHT\""));
ok("nfci: the bands are ASYMMETRIC — a symmetric band around zero would have voted bullish " +
   "nearly every week post-GFC, biasing the tally instead of informing it",
  (() => { const T = 0, L = -0.5;
    const vote = (v) => (v <= L ? "bull" : v > T ? "bear" : "neutral");
    return Math.abs(T) !== Math.abs(L) &&
      vote(-0.42) === "neutral" &&   // the ordinary post-GFC backdrop abstains
      vote(-0.60) === "bull"    &&   // genuinely accommodative
      vote(+0.05) === "bear"    &&   // above the 1971– mean is the event itself
      vote(0)     === "neutral";     // exactly at the mean is not "tighter than" it
  })());
ok("nfci: boundaries are exact — -0.5 votes bull (inclusive), 0 does not vote bear (exclusive)",
  (() => { const T = 0, L = -0.5;
    const vote = (v) => (v <= L ? "bull" : v > T ? "bear" : "neutral");
    return vote(-0.5) === "bull" && vote(-0.49) === "neutral" &&
           vote(0) === "neutral" && vote(0.01) === "bear";
  })());
ok("nfci: TIGHT/LOOSE is a DIRECTIONAL call, so it is suppressed on mock/stale exactly like " +
   "the CAPE BUBBLE verdict (v3.1 honesty invariant)",
  /nIllus\?\(nMode==="STALE"\?<DataModeBadge mode="STALE"\/>:<IllustrativeChip\/>\)\s*:<Badge label=\{band\}/.test(dashSrc));
ok("nfci: the tile states its own reference point — a bare z-score is unreadable without it",
  dashSrc.includes("0 = avg"));
ok("nfci: it votes in the DASHBOARD regime (6th factor), off the SAME shared band table the " +
   "tile renders — one computation, two surfaces, so label and vote cannot disagree",
  /\{ key:"nfci",[\s\S]*?vote:\(v\)=> v <= NFCI_LOOSE \? "bull"/.test(regimeSrc) &&
  regimeSrc.includes("REGIME_BAND_TABLE.forEach"));
ok("nfci: a STALE nfci drops out of the vote like every other factor (run, not pinned)",
  (() => { const ex = factorExclusions({ provenance: { nfci: "LIVE" },
    dataAsOf: { nfci: "2026-01-01" }, liveBuild: true, now: new Date("2026-08-01T12:00:00-04:00") });
    return ex.has("nfci"); })() && REGIME_FACTOR_FIELDS.includes("nfci"));
ok("nfci: it appears in the displayed factor breakdown, so 'X/Y bullish' matches the cast vote",
  /\{key:"nfci",\s+short:"NFCI",\s+label:"Fin Conditions"/.test(regimeSrc) && regimeSrc.includes("SD — "));
// FIX-E (v3.49): every factor carries its own chip label (`short`), and the chip strip renders
// from it — the old hardcoded 5-label array left the 6th (NFCI) chip literally "undefined".
ok("FIX-E: chip labels come from the factors themselves, not a parallel hardcoded array",
  // v3.62: the glyph moved from an inline `f.stale?…` ternary to the shared voteStyle map, so
  // the pin follows it. The CONTRACT is unchanged and is what these three clauses measure:
  // the label comes from the row's own `short`, and no parallel label array exists anywhere.
  dashSrc.includes("{f.short} {vs.glyph}") && !dashSrc.includes('["10Y","VIX","F&G","CPI","VAL"][i]') &&
  !regimeSrc.includes('["10Y","VIX","F&G","CPI","VAL"]'));
ok("nfci: the mock baseline (-0.42) sits in the NEUTRAL zone — the demo shows a factor that " +
   "ABSTAINS in ordinary conditions, not one wired to vote bullish by default",
  MOCK_DATA.macro.nfci.current > -0.5 && MOCK_DATA.macro.nfci.current < 0);
// The threshold had to generalize: DEC-31 chose ">=3 of 5" precisely because 3 of 6 is 50%,
// not a majority — so a 6th factor against a hardcoded 3 would have re-created that bug.
ok("nfci: the majority threshold is COMPUTED from the live voters, not a hardcoded 3",
  regimeSrc.includes("bullVotes > counted / 2") && regimeSrc.includes("bearVotes > counted / 2") &&
  !regimeSrc.includes("const bull = bullVotes >= 3"));
ok("nfci: with 5 live voters the computed rule is IDENTICAL to the old constant (needs 3)",
  (() => { const need = (n) => { for (let v = 0; v <= n; v++) if (v > n / 2) return v; return null; };
           return need(5) === 3 && need(6) === 4 && need(3) === 2; })());
ok("nfci: /readout.json is UNTOUCHED — the TT terminal's order-gating math did not move",
  !readFileSync(new URL("../src/ttReadout.js", import.meta.url), "utf8").includes("nfci"));

// ---- v3.43 curated cuts (owner-approved): gold · IPO · SpaceX · Mag-10 fundamentals -------
// The rule applied is the one already in this file's history: "SPY P/E (mock, Yahoo-dupe) cut".
// Kept deliberately: GPU $/hr (half the AI unit-economics pair), the headwinds register and the
// watchlist (the owner's own judgment — the moat), and Peoria (owner said keep).
ok("cut: the gold tile and its curated series are gone — no live source ever existed for it",
  !dashSrc.includes("crossAsset.gold") && !/\bgold:\s*\{/.test(dashSrc));
ok("cut: the IPO countdown tracker is fully removed (component, data and state)",
  ["IpoCountdownStrip", "IpoCard", "IPO_TARGETS", "IPO_STAGES", "ipoOpen"].every((t) => !dashSrc.includes(t)));
ok("cut: the SpaceX S-1 panel and the private Mag-10 entry are gone",
  !/SPACEX/.test(dashSrc.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")) && !dashSrc.includes("isPrivate"));
ok("cut: Mag-10 curated fundamentals are gone (mkt cap, P/E, revenue, margins, FCF, capex)",
  ["mktCapT", "ttmPe", "fwdPe", "q1RevB", "fwdRevB", "yoyRevGrowth", "netMarginPct", "fcfTtmB", "capex26B"]
    .every((k) => !dashSrc.includes(k)));
// v3.51 (public audit, owner call) finished the job: the surviving quote strip failed the SAME
// Yahoo-dupe test that took its fundamentals. The FIELD stays mapped — the same Finnhub pull
// feeds QQQ — but no component, mock array, CSS or merge for it remains.
ok("cut v3.51: the Mag 10 quote strip is gone — component, mock array, state, CSS and merge",
  !dashSrc.includes("Mag10Card") && !dashSrc.includes("mag10open") &&
  !dashSrc.includes("mag10-scroll") && !dashSrc.includes("mag10ByTicker") &&
  !/\n  mag10:\[/.test(dashSrc));
ok("cut v3.51: mag10PricesJson stays MAPPED (QQQ rides the same Finnhub pull) and still resolves",
  "mag10PricesJson" in SOURCES && MOCK_DATA.mag10PricesJson === "[]");
ok("cut: no surviving label claims curated fundamentals or a market-cap sort (a cut must " +
   "take its own attribution with it, or the page lies about what it is showing)",
  !/fundamentals curated/i.test(dashSrc) && !/Ranked by market cap/i.test(dashSrc) &&
  !/SORTED BY MKT CAP/i.test(dashSrc));
ok("cut v3.51: the FOOTER source list no longer credits data that was deleted — it claimed " +
   "'Mag 10 fundamentals' and 'SEC S-1' for two v3.43 releases after both were cut",
  !/Curated: Mag 10 fundamentals/.test(dashSrc) && !/· SEC S-1 ·/.test(dashSrc));
ok("keep: GPU $/hr, headwinds and the watchlist are untouched — curated, but differentiated",
  dashSrc.includes("GPU_PRICING") && dashSrc.includes("headwinds") && dashSrc.includes("watchlist"));

// ═══════════ [20] FEAT-TT-PTLINT (v3.39) — the PT chain's guards ═══════════
// The price-target chain is the terminal's moat: ptModelRows() feeds the est-run table, the WORTH
// cell, the BUY rank, AGREE, the SELL rank and the spread. An audit confirmed the one-computation
// property held — but found that validateDeepDive had NEVER inspected pt_model or consensus, which
// is how NVDA's schedule came to be keyed at ESTIMATE years instead of the YEAR-END PRICED: schedAt
// looks backward only, found no key <= the first row, and the rung SILENTLY fell to the floor
// ($134.85 / -29% shown where the model meant $226.77 / +16%).
console.log("\n[20] FEAT-TT-PTLINT — model lints, the horizon, and the Q4 roll");

// These are the FIRST BEHAVIORAL tests of admin.html's pure logic. admin.html is buildless, so
// this file could only ever pin strings; the PT math is load-bearing enough to deserve real
// execution. We lift the pure functions out by name and run them — no DOM, no browser.
function liftFns(src, names) {
  const out = names.map((n) => {
    const i = src.indexOf(`function ${n}(`);
    if (i < 0) throw new Error(`smoke: cannot lift ${n}() from admin.html`);
    let depth = 0;
    for (let k = src.indexOf("{", i); k < src.length; k++) {
      if (src[k] === "{") depth++;
      else if (src[k] === "}") { depth--; if (!depth) return src.slice(i, k + 1); }
    }
    throw new Error(`smoke: unbalanced braces lifting ${n}()`);
  }).join("\n");
  return out;
}
// TT-SCORE commit 1 (v3.73): the PT chain is a real module now — smoke IMPORTS it instead of
// lifting source text (the src/regime.js precedent, :11-12). admin.html keeps byte-identical
// copies (buildless, cannot import); section [49] lifts THOSE and asserts identity against
// these imports, so the lift stays as the tripwire's raw material rather than the test rig.
const LENS_MAX_PE_SRC = /const LENS_MAX_PE=(\d+);/.exec(adminSrc);
const PT = await import("../src/ptModel.js");
ok("ptmodel: admin.html's LENS_MAX_PE and the module's are the same value",
  PT.LENS_MAX_PE === +LENS_MAX_PE_SRC[1]);

// THE NVDA FAILURE, reconstructed: 4 multiples keyed at the estimate years.
const Y = new Date().getFullYear();
const miskeyed = {
  consensus: { revenue_B: { [Y + 1]: 393.6, [Y + 2]: 560.75 }, eps: { [Y + 1]: 8.99, [Y + 2]: 12.87 } },
  pt_model: { ev_s_multiple: { [Y + 1]: 14, [Y + 2]: 12 }, pe_floor_multiple: 15, share_count_M: 24300 },
};
const mkLints = PT.lintPtModel(miskeyed);
ok("ptlint: a schedule keyed at the ESTIMATE year (the NVDA bug) is an ERROR, not a shrug",
  mkLints.some((l) => l.sev === "error" && l.code === "MISKEY"));
ok("ptlint: the MISKEY message names the convention AND the row that silently floors",
  /YEAR-END PRICED/.test(mkLints.find((l) => l.code === "MISKEY").msg) &&
  /falls through to the floor/.test(mkLints.find((l) => l.code === "MISKEY").msg));
ok("ptlint: and the bug it describes is real — that row's premium IS null, so the floor is used",
  // fmt() rounds >=100 to whole dollars, so 15 x 8.99 = 134.85 renders 135 (the NVDA figure).
  PT.ptModelRows(miskeyed)[0].prem === null && PT.ptModelRows(miskeyed)[0].fl === Math.round(15 * 8.99));
// Re-keying to the priced year is the fix, and it must clear the error.
const fixed = JSON.parse(JSON.stringify(miskeyed));
fixed.pt_model.ev_s_multiple = { [Y]: 14, [Y + 1]: 12 };
ok("ptlint: re-keying to the year-end priced clears MISKEY and computes the real premium",
  !PT.lintPtModel(fixed).some((l) => l.code === "MISKEY") &&
  typeof PT.ptModelRows(fixed)[0].prem === "number" && PT.ptModelRows(fixed)[0].prem > 0);
// A deliberately-late premium must be expressible, or the hard error would block a legitimate
// payload — the escape hatch is a DECLARATION, not a silent ambiguity.
const declared = JSON.parse(JSON.stringify(miskeyed));
declared.pt_model.floor_only_before = String(Y + 1);
ok("ptlint: floor_only_before lets a deliberately-late premium declare itself instead of erroring",
  !PT.lintPtModel(declared).some((l) => l.code === "MISKEY"));
// Lens doctrine (the TSM/UBER rule) — a WARN, never an auto-switch: the lens is owner judgement.
ok("ptlint: a profitable name on the sales lens warns (earnings-lens candidate), never auto-switches",
  PT.lintPtModel(fixed).some((l) => l.sev === "warn" && l.code === "LENS"));
// v3.47: "EPS > 0" is not "the name earns". A name crossing zero (RKLB: FY+1 consensus 0.05 at
// $63.85 = a 1,277x forward P/E) has no representative earnings line, so the sales lens is
// CORRECT there and a warning would be substantively wrong.
const crossing = { ref_px: { px: 63.85 },
  consensus: { revenue_B: { [Y + 1]: 1.27, [Y + 2]: 1.65 }, eps: { [Y + 1]: 0.05, [Y + 2]: 0.60 } },
  pt_model: { ev_s_multiple: { [Y]: 22, [Y + 1]: 18 }, share_count_M: 500 } };
ok("ptlint: LENS does NOT fire on a zero-crossing EPS — a 1,277x forward P/E is an artifact of " +
   "a company reaching profitability, not an earnings line the lowest-line rule would select",
  !PT.lintPtModel(crossing).some((l) => l.code === "LENS"));
ok("ptlint: the magnitude test is deliberately permissive — a genuinely profitable name on the " +
   "sales lens still warns (NVDA ~22x, TSM ~24x, UBER ~18x all sit far under the threshold)",
  (() => { const real = JSON.parse(JSON.stringify(crossing));
    real.consensus.eps = { [Y + 1]: 3.5, [Y + 2]: 4.2 };   // 63.85 / 3.5 = 18x forward
    return PT.lintPtModel(real).some((l) => l.code === "LENS"); })());
ok("ptlint: with NO price there is nothing to judge magnitude against, so behavior is unchanged " +
   "— it still warns, failing TOWARD the warning rather than silently swallowing it",
  (() => { const noPx = JSON.parse(JSON.stringify(crossing)); delete noPx.ref_px;
    return PT.lintPtModel(noPx).some((l) => l.code === "LENS"); })());
ok("ptlint: the mirror trap — a P/E premium that cannot engage for want of positive EPS",
  PT.lintPtModel({ consensus: { eps: { [Y + 1]: -2 }, revenue_B: { [Y + 1]: 5 } },
    pt_model: { pe_premium_multiple: 30, pe_floor_multiple: 18 } })
    .some((l) => l.code === "LENSOFF"));
// A pt_model that explains its own unranked state is a DECISION, not a defect.
ok("ptlint: an unranked model carrying basis/note is left alone — it already says why",
  !PT.lintPtModel({ pt_model: { share_count_M: 100, basis: "pre-profit", note: "deliberate" },
    consensus: { revenue_B: { [Y + 1]: 1 } } }).some((l) => l.code === "NOFLOOR"));
ok("ptlint: a schedule reaching PAST the estimate series is not flagged — that is not a defect",
  !PT.lintPtModel({ consensus: { eps: { [Y + 1]: 5, [Y + 2]: 6 } },
    pt_model: { pe_premium_multiple: { [Y]: 20, [Y + 1]: 18, [Y + 9]: 10 }, pe_floor_multiple: 18 } })
    .some((l) => l.code === "ORPHAN"));
ok("ptlint: MISKEY is the ONE hard gate wired into the save path; the rest only warn",
  adminSrc.includes('const hard=lintPtModel(dd).filter(l=>l.sev==="error");') &&
  adminSrc.includes("if(hard.length)return hard[0].msg;"));
ok("ptlint: lints render at BOTH altitudes — the name's tab and the whole-book ranking",
  adminSrc.includes("h+=lintLines(dd);") && adminSrc.includes("MIS-KEYED — the rung shown is a floor fallback"));

// D2: the Q4 cliff. pickRow must ROLL rather than let a raw gap enter an annualised sort. Today's
// date cannot exercise this (in July no future year-end is inside 3 months), so the clock is
// STUBBED — the rule is tested, not the calendar.
// TT-SCORE commit 1 (v3.73): pickRow is imported from src/ptModel.js and driven through its
// clock parameter (_now) instead of a stubbed yrsToYearEnd — the SAME code the terminal and
// the server run, exercised at a December instant no July test run could otherwise supply.
const YE2030 = Date.parse("2030-12-31T21:00:00Z");
const YRS = (y) => y * 365.25 * 86400000;
const near = [{ y: "2030", prem: 110 }, { y: "2031", prem: 150 }];
const nowNear = YE2030 - YRS(0.10);   // the near rung is ~5 weeks out
const rolled = PT.pickRow(near, null, nowNear);
ok("cliff: a rung inside ~3 months ROLLS to the next one and reports what it rolled from",
  rolled.row.y === "2031" && rolled.rolled === "2030");
const nowFar = YE2030 - YRS(0.60);
ok("cliff: a rung outside the window is used as-is, with no roll claimed",
  PT.pickRow(near, null, nowFar).row.y === "2030" && PT.pickRow(near, null, nowFar).rolled === null);
ok("cliff: when NOTHING is far enough out, the near rung is kept (never dropped silently)",
  PT.pickRow([{ y: "2030", prem: 110 }], null, nowNear).row.y === "2030");
ok("cliff: a pinned year the name lacks is EXCLUDED, never substituted with another year",
  PT.pickRow(near, "2099", nowFar) === null && PT.pickRow(near, "2031", nowFar).row.y === "2031");
ok("cliff: both residual cases are DISCLOSED, not absorbed (rolled list + raw-gap list)",
  adminSrc.includes("rolled to a later rung") && adminSrc.includes("shown as a RAW gap"));
ok("cliff: SELL stops mislabelling a modelled name as unmodelled when only the RATE is missing",
  adminSrc.includes("modelled:rr.length>0,") &&
  adminSrc.includes("modelled but no annualisable rung"));

// D3: red hinges surface, never veto — the board reports (the FEAT-TT-BINCAL doctrine).
ok("hinge: why() still has NO hinge veto — enforcement stays the owner's",
  !/function why[\s\S]{0,600}state==="red"/.test(adminSrc));
ok("hinge: but the AGREE line and the compact BUY row both NAME the red hinges",
  adminSrc.includes("red hinge${b.redH===1?\"\":\"s\"} on this name") &&
  adminSrc.includes("not a veto (yours to weigh)") &&
  adminSrc.includes("AGREE_PICK.redLabels.slice(0,2)"));

// D4 + the derived-estimate marker.
ok("derived: consensus.derived is validated only when present, and only rev|eps are legal",
  adminSrc.includes("consensus.derived must be an object keyed by year") &&
  adminSrc.includes('must list only "rev" or "eps"'));
ok("derived: the marker PROPAGATES to the target computed off a derived estimate",
  adminSrc.includes("const derTgt=r&&((r.lens===\"P/E\"&&isDer(y,\"eps\"))||(r.lens===\"EV/S\"&&isDer(y,\"rev\")))"));
ok("derived: reuses the existing .derived class rather than inventing a second dim vocabulary",
  adminSrc.includes(".derived{color:var(--dim);font-style:italic}"));
ok("legs: per-leg provenance is optional, enum-checked, and an unknown value is rejected",
  validatePos({ at: "2026-07-30T14:00:00Z", src: "x", sh: 1,
    opt: [{ k: "call", side: "short", n: 1, src: "screenshot" }] }) === null &&
  /src must be sync\|screenshot\|manual/.test(String(validatePos({ at: "2026-07-30T14:00:00Z", src: "x", sh: 1,
    opt: [{ k: "call", side: "short", n: 1, src: "guessed" }] }))));
ok("legs: an EXISTING leg with no src still validates — no live payload may be rejected",
  validatePos({ at: "2026-07-30T14:00:00Z", src: "x", sh: 1,
    opt: [{ k: "call", side: "short", n: 1 }] }) === null);
ok("legs: the cover claim excludes expired AND undated legs, and names the strikes",
  adminSrc.includes("const d=optDte(o.exp);return d!==null&&d>=0;") &&
  adminSrc.includes("expired or undated, NOT counted") &&
  adminSrc.includes("live short call(s) cover"));
ok("legs: ddOptSec no longer claims broker sync for legs it cannot vouch for",
  !adminSrc.includes("from broker sync ·") &&
  adminSrc.includes("no provenance recorded on ${unk} leg"));

// ═══════════ [25] FEAT-TOKW (v3.46) — tokens/watt, the conversion leg ═══════════
// The math is lifted and RUN, not string-pinned: the whole point of this feature is that a
// short price window must never be annualised, and a string pin cannot prove a number.
console.log("\n[25] FEAT-TOKW — tokens/watt × $/token");
const TW = (() => {
  const a = dashSrc.indexOf("const TOKEN_EFFICIENCY");
  const b = dashSrc.indexOf("const HYPERSCALER_CAPEX");
  return new Function(dashSrc.slice(a, b) + "\nreturn {TOKEN_EFFICIENCY,tokenScissors};")();
})();
const TW_LIVE = [6.8, 6.5, 6.3, 6.1, 5.9, 5.8, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1]; // 12 pts = 11 weeks
ok("tokw: the price window is NEVER annualised — the v3.39-D2 units error, one layer up. " +
   "A 12-week −25% move reports −25% over 11 weeks, not the −98%/yr an extrapolation gives",
  (() => { const s = TW.tokenScissors(TW_LIVE);
    return Math.abs(s.pxWin + 0.25) < 1e-9 && s.weeks === 11 && s.pxWin > -0.9; })());
ok("tokw: both legs are expressed over the SAME observed window — the durable efficiency " +
   "CAGR is projected DOWN onto the price span, never the reverse",
  (() => { const s = TW.tokenScissors(TW_LIVE);
    const expect = Math.pow(1 + s.effCagr, 11 / 52) - 1;
    return Math.abs(s.effWin - expect) < 1e-12 && s.effWin < s.effCagr; })());
ok("tokw: the composite is the product of the two rates, not their sum",
  (() => { const s = TW.tokenScissors(TW_LIVE);
    return Math.abs(s.idx - ((1 + s.effWin) * (1 + s.pxWin) - 1)) < 1e-12; })());
ok("tokw: a window shorter than minWeeks WITHHOLDS the band — 'too short to read' and " +
   "'flat' are different facts, and the mock trend (5 intervals) is exactly that case",
  (() => { const s = TW.tokenScissors([6.8, 6.1, 5.5, 5.2, 5.0, 4.9]);
    return s.weeks === 5 && s.short === true && s.band === null && s.idx !== null; })());
ok("tokw: no price series at all yields no band and no composite — never a 0 reading as flat",
  (() => { const a = TW.tokenScissors(null), b = TW.tokenScissors([5.1]);
    return a.idx === null && a.band === null && b.idx === null && b.band === null; })());
ok("tokw: the deadband is stated over the WINDOW, not per year (annualising it would " +
   "re-import the extrapolation the window rule exists to remove)",
  TW.TOKEN_EFFICIENCY.deadbandPct !== undefined && TW.TOKEN_EFFICIENCY.deadbandPctYr === undefined);
ok("tokw: COMPRESSING/FLAT/EXPANDING land on the right side of the deadband",
  (() => { const d = TW.TOKEN_EFFICIENCY.deadbandPct / 100;
    const band = (idx) => idx > d ? "EXPANDING" : idx < -d ? "COMPRESSING" : "FLAT";
    return band(-0.166) === "COMPRESSING" && band(0.0) === "FLAT" && band(d) === "FLAT" &&
           band(-d) === "FLAT" && band(0.2) === "EXPANDING"; })());
ok("tokw-dash: the card is ILLUSTRATIVE + chipped, behind a CollapsedGroup like every other " +
   "curated block, and prints NO $/MW level — only ratios are sourceable",
  /TokenEfficiencyCard[\s\S]{0,1200}ILLUS_HATCH/.test(dashSrc) &&
  dashSrc.includes('label="curated: tokens/watt × $/token conversion"') &&
  (() => { const card = dashSrc.slice(dashSrc.indexOf("const TokenEfficiencyCard"),
                                     dashSrc.indexOf("MACRO FLIP BANNER"));
    return !/\$\{[^}]*\}\s*\/\s*MW/.test(card) && !/\$\d[\d.,]*\s*\/\s*MW/.test(card) &&
           card.includes("no $/MW figure is derivable"); })());
ok("tokw-dash: the verdict is SUPPRESSED on mock/stale price data (v3.1 invariant) — the " +
   "band is gated through isIllustrative, not rendered raw",
  /const band = isIllustrative\(mode\) \? null : s\.band;/.test(dashSrc));
ok("tokw-dash: it NEVER votes — computeRegime and the factor list know nothing about it",
  !/computeRegime[\s\S]{0,2400}(tokenScissors|TOKEN_EFFICIENCY)/.test(dashSrc) &&
  !/REGIME_FACTOR_FIELDS=\[[^\]]*token/i.test(dashSrc));
ok("tokw-tt: tokens_per_watt is a HANDLED deep-dive key rendered beside utilization " +
   "underwriting — the factor a utilization model structurally cannot see",
  adminSrc.includes('"tokens_per_watt"]') && adminSrc.includes("function ddTokWSec(dd)") &&
  /ddKvSec\("Utilization underwriting",dd\.utilization_underwriting\)\+\s*\n?\s*ddTokWSec\(dd\)/.test(adminSrc));
ok("tokw-tt: the gen index is carried by the PAYLOAD, not copied from src/ — a buildless " +
   "file cannot import, and a drifting hand-copied constant is worse than a self-attested one",
  !adminSrc.includes("const TOKEN_EFFICIENCY") && adminSrc.includes("Math.max(...mix.map(g=>Number(g.idx)))"));
ok("tokw-tt: it fails closed — a partial mix is called a FLOOR, a missing mix is 'unmeasured' " +
   "rather than an implied 1.00, and an undated block is flagged",
  adminSrc.includes("so this is a FLOOR") &&
  adminSrc.includes("productivity per watt unmeasured, which is not the same as average") &&
  /t\.at\?[\s\S]{0,120}undated<\/span>/.test(adminSrc));

// ---- 24. FEAT-TT-READY (v3.50) — the ONE decision-readiness statement ------
// VALUE_PROPOSITION_AUDIT "too many freshness clocks": eight honest dates that never summed
// into the only question a reader has. readiness() is lifted and RUN — a string pin cannot
// prove a severity rule, and this one now GATES the green line (FIX-B reads its blockers).
console.log("\n[24] FEAT-TT-READY — decision readiness consolidates the eight clocks");
const RDY_THESIS_D = /const READY_THESIS_D=(\d+);/.exec(adminSrc);
ok("ready: the thesis threshold is the SAME 30d ddAgeChip re-reviews on (one rule, two surfaces)",
  RDY_THESIS_D && RDY_THESIS_D[1] === "30" && adminSrc.includes("if(d>30)return `<span class=\"pill warn\">self-attested"));
const RDY = new Function(
  `const READY_THESIS_D=${RDY_THESIS_D[1]},POS_STALE_D=2,PX_STALE_D=4,LENS_MAX_PE=${LENS_MAX_PE_SRC[1]};` +
  "let BOARD={},POSITIONS={},LIVE_PX={};" +
  // readiness() reads the REAL model helpers (already exercised in [20]) rather than a stub —
  // the whole design claim is that a readiness part can never disagree with the chip it
  // summarizes, which only holds if both call the same function.
  liftFns(adminSrc, ["ageDays", "runState", "ddDate", "hingeTally", "posOf", "posAge",
    "schedAt", "ptRowYears", "ptModelRows", "lintPtModel", "readiness"]) +
  "\nreturn {readiness,set:(b,p,q)=>{BOARD=b;POSITIONS=p;LIVE_PX=q;}};")();
const iso = (dAgo) => new Date(Date.now() - dAgo * 86400000).toISOString().slice(0, 10);
const YR = new Date().getFullYear();
// A name with every clock current. ptModelRows/lintPtModel are NOT lifted here (they are
// exercised in [20]); readiness calls them, so the fixture stubs them via the deepDive shape
// the lifted copies would see — instead we assert the parts that do not need them by
// checking blocker CONTENT, which is what the gate consumes.
const mkEntry = (o = {}) => ({
  sym: "RDY", lastRun: iso(3),
  deepDive: {
    thesis_version: "v1", updated: iso(5),
    hinges: [{ label: "backlog", state: "green" }, { label: "pricing", state: "green" }],
    ref_px: { px: 100, at: iso(1) },
    // A correctly-keyed model (schedule keys = the YEAR-END PRICED, per [20]) so the model
    // clock reads OK and each assertion below isolates the ONE clock it is about.
    consensus: { revenue_B: { [YR + 1]: 100, [YR + 2]: 120 }, eps: { [YR + 1]: 5, [YR + 2]: 6 } },
    pt_model: { pe_premium_multiple: { [YR]: 20, [YR + 1]: 18 }, pe_floor_multiple: 15, share_count_M: 1000 },
    ...(o.dd || {}),
  },
  ...o,
});
RDY.set({}, {}, {});
// The whole point: absent evidence FAILS CLOSED. A never-run name is BLOCKED, not "fresh
// enough" — the audit's exact finding (5 fresh runs against 31 never, green line still lit).
const rNever = RDY.readiness(mkEntry({ lastRun: null }));
ok("ready: a NEVER RUN name is BLOCKED and says so (fails closed on a missing date)",
  rNever.k === "blocked" && rNever.blockers.includes("TT never run") && rNever.verdict === "BLOCKED");
ok("ready: a future-dated lastRun (typo) also reads NEVER RUN, never fresh",
  RDY.readiness(mkEntry({ lastRun: iso(-5) })).blockers.includes("TT never run"));
ok("ready: an aged-past-90d run BLOCKS; a 31-90d run only CAUTIONS (the runState bands hold)",
  RDY.readiness(mkEntry({ lastRun: iso(120) })).blockers.some((b) => /^TT run \d{3}d old$/.test(b)) &&
  RDY.readiness(mkEntry({ lastRun: iso(45) })).cautions.some((c) => /^TT run \d+d old$/.test(c)) &&
  !RDY.readiness(mkEntry({ lastRun: iso(45) })).blockers.length);
ok("ready: an undated thesis BLOCKS — self-attested and undated is not 'current'",
  RDY.readiness(mkEntry({ dd: { updated: "" } })).blockers.includes("thesis undated"));
ok("ready: a thesis past the 30d re-review window CAUTIONS, not blocks",
  RDY.readiness(mkEntry({ dd: { updated: iso(40) } })).cautions.some((c) => /^thesis \d+d old$/.test(c)) &&
  !RDY.readiness(mkEntry({ dd: { updated: iso(40) } })).blockers.length);
ok("ready: NO HINGES blocks — the audit's 'defined thesis hinges'; nothing says what would change your mind",
  RDY.readiness(mkEntry({ dd: { hinges: [] } })).blockers.includes("no hinges defined"));
// D3 doctrine (v3.39) survives the consolidation: red is NAMED, never a veto.
const rRed = RDY.readiness(mkEntry({ dd: { hinges: [{ label: "power", state: "red" }] } }));
ok("ready: a RED hinge is surfaced as a caution, never a blocker (D3 — the board reports, it does not enforce)",
  rRed.cautions.includes("1 hinge RED") && !rRed.blockers.some((b) => /RED/.test(b)));
ok("ready: an UNKNOWN hinge cautions (the audit's 'one hinge unknown')",
  RDY.readiness(mkEntry({ dd: { hinges: [{ label: "x", state: "unknown" }] } })).cautions.includes("1 hinge unknown"));
// An unheld name must stay eligible — blocking it would gate exactly what the next dollar is for.
ok("ready: an ABSENT position CAUTIONS, never blocks (unheld is a legitimate state for a new name)",
  RDY.readiness(mkEntry()).cautions.includes("position not synced") &&
  !RDY.readiness(mkEntry()).blockers.some((b) => /position/.test(b)));
RDY.set({}, { RDY: { sh: 10, mv: 1000, at: iso(0) } }, {});
ok("ready: a fresh measured position reads 'position current'",
  RDY.readiness(mkEntry()).parts.some((p) => p.sev === "ok" && p.t === "position current"));
RDY.set({}, { RDY: { sh: 10, mv: 1000, at: iso(9) } }, {});
ok("ready: a position mark older than POS_STALE_D cautions with its age",
  RDY.readiness(mkEntry()).cautions.some((c) => /^position \d+d old$/.test(c)));
RDY.set({}, {}, {});
// Price: a live quote beats a stamp (v3.36); no usable price at all is missing evidence.
ok("ready: no usable price BLOCKS (neither a live quote nor a stamped mark)",
  RDY.readiness(mkEntry({ dd: { ref_px: null } })).blockers.includes("no usable price"));
ok("ready: a stamp older than PX_STALE_D cautions — a stale mark silently poisons every %",
  RDY.readiness(mkEntry({ dd: { ref_px: { px: 100, at: iso(11) } } })).cautions.some((c) => /^mark \d+d old$/.test(c)));
RDY.set({}, {}, { RDY: { px: 123, chg: 1 } });
ok("ready: a LIVE quote satisfies the price clock even with no stamp at all",
  RDY.readiness(mkEntry({ dd: { ref_px: null } })).parts.some((p) => p.t === "price live"));
RDY.set({}, {}, {});
// Blocking decisions scope by EXPLICIT sym only — a guessed blocker is worse than none.
RDY.set({ decisions: [{ q: "trim?", blocking: true, sym: "RDY" }] }, {}, {});
ok("ready: a blocking decision SCOPED to this name blocks it",
  RDY.readiness(mkEntry()).blockers.includes("1 blocking decision open"));
RDY.set({ decisions: [{ q: "is RDY overweight?", blocking: true }] }, {}, {});
ok("ready: an UNSCOPED blocking decision does NOT block — inferring the ticker from prose would be a guess",
  !RDY.readiness(mkEntry()).blockers.some((b) => /decision/.test(b)));
RDY.set({}, {}, {});
// The audit's literal output shape: "BLOCKED — TT never run; position current; model 6d old".
const rLine = RDY.readiness(mkEntry({ lastRun: null }));
ok("ready: the one-line statement orders blockers FIRST, so the reason to stop is never buried",
  rLine.line.startsWith("TT never run") && rLine.line.includes(";"));
ok("ready: every clock appears in the statement — an OK clock is STATED, not inferred from silence",
  rLine.parts.some((p) => p.sev === "ok") && rLine.line.split("; ").length >= 4);
// Rendering: the consolidator reaches both per-ticker decision surfaces, and the bar keeps
// every red fact visible (v3.25 — a summary is only honest if the red things survive it).
ok("ready: the bar renders on the deep-dive tab ABOVE the four answers",
  /h\+=readyBar\(x\);\s*\n\s*h\+=ddAnswerBlock/.test(adminSrc));
ok("ready: and on the card — the only per-ticker surface a WATCH name with no tab ever gets",
  adminSrc.includes('<div class="k">READINESS</div>') && adminSrc.includes("let html=rdyRow+measured+"));
ok("ready: blockers stay visible as chips on the bar, never collapsed into the verdict alone",
  adminSrc.includes("⛔ not actionable until:") && adminSrc.includes('p.sev==="block"?"head"'));

// ---- 25. public-audit: the factor count is stated, and stated correctly ----
// A label that disagrees with the vote it describes is the FIX-E defect. NFCI made the vote
// six in v3.43; three user-facing strings still said "5-factor". Pinned in BOTH directions so
// a future 7th voter fails here rather than shipping a wrong count to the public page.
console.log("\n[25] public dashboard — the stated factor count matches the vote cast");
ok("regime: no surviving '5-factor' claim anywhere in the dashboard",
  !/5-factor/.test(dashSrc));
ok("regime: the vote is described as 6-factor on the band and the source box",
  (dashSrc.match(/6-factor/g) || []).length >= 2);
ok("regime: the stated count equals REGIME_FACTOR_FIELDS + the valuation factor",
  REGIME_FACTOR_FIELDS.length + 1 === 6 && FACTOR_FIELD.valuation === "shillerPe");

// ---- 26. public audit (v3.51): naming, provenance vocabulary, and affordance honesty ----
// The public product's promise is a TRUSTWORTHY posture. These are the places the page said
// something not quite true about itself — none of them a wrong number, all of them a wrong claim.
console.log("\n[26] public dashboard — the page tells the truth about itself");
// Two structurally different regimes exist (this six-factor backdrop vs /readout.json's
// six ORDER-GATING checks). Both legitimate; unnamed, a reader assumes one verdict.
ok("naming: the public verdict is MACRO BACKDROP, distinct from the order-gating readout",
  dashSrc.includes("Macro Backdrop") && !dashSrc.includes(">Macro Regime · wen moon?<"));
ok("naming: the moon states survive as the primary voice (owner call — personality kept)",
  dashSrc.includes("wen moon?") && dashSrc.includes("WEN_MOON_STATES"));
// SPY on this page is SP500/10 from FRED — Stooq blocks the edge. The tooltip claimed "ETF".
ok("provenance: SPY is labelled a FRED proxy, not an ETF quote it has never been",
  /FRED SP500 proxy, NOT an SPY ETF quote/.test(dashSrc) && !/S&P 500 ETF — the broad US stock market/.test(dashSrc));
// "Manual" + a LIVE badge on the same tile made the provenance vocabulary self-contradictory:
// `api` is the FETCH PATH, `mode` is freshness — and multpl IS the live scrape.
ok("provenance: CAPE credits its real fetch path (multpl scrape), not 'Manual' beside a LIVE badge",
  dashSrc.includes('api="multpl.com"') && !/api="Manual" endpoint="Robert Shiller/.test(dashSrc));
// An ON/OFF control beside 8px muted "notifications not wired" reads as a working alert system.
ok("affordance: the alert toggles state their real limit at the weight of the control itself",
  /no push, email or SMS is sent/.test(dashSrc) && !/Triggers evaluate live data · notifications not wired/.test(dashSrc));
// Confidence: Signal Quality counted TILES and never said whether the VERDICT was trustworthy.
ok("confidence: the strip reports how many factors actually voted, from the EvidenceSet itself",
  dashSrc.includes("BACKDROP {regimeConf.counted}/{regimeConf.total} factors voting") &&
  dashSrc.includes("counted:evidenceSet.counted,total:evidenceSet.totalFactors"));
ok("confidence: excluded factors are NAMED — 'N of 6 usable' without saying which is half a fact",
  dashSrc.includes("excluded: {regimeConf.excluded.join") && dashSrc.includes("crash gauge (VIX) unavailable"));

// ---- 27. FEAT-ALERT-EVAL (v3.52) — the alerts evaluate, or say they cannot ----
// Suite audit called this "interface theater" for not DELIVERING. The defect was one layer
// earlier and worse: `triggered` was a hardcoded false nothing ever wrote, while the header
// claimed "Triggers evaluate live data" — a directional claim ("nothing tripped") asserted by
// code that had never looked. v3.51 fixed only the delivery half of that sentence.
console.log("\n[27] FEAT-ALERT-EVAL — evaluated alerts, gated on live data");
// dashboard.jsx is JSX, so Node cannot import it — lift the pure evaluator (and the real
// ALERT_METRICS table it reads) out by source, the same technique MOCK_DATA uses above.
const _am = dashSrc.indexOf("const ALERT_METRICS={");
const _ae = dashSrc.indexOf("\n};", _am) + 3;
const _ef = dashSrc.indexOf("export function evalAlert(");
const _ee = dashSrc.indexOf("\n}", dashSrc.indexOf("return{state:hit", _ef)) + 2;
const evalAlert = new Function(
  dashSrc.slice(_am, _ae) + dashSrc.slice(_ef, _ee).replace("export function", "function") +
  "\nreturn evalAlert;")();
// FEAT-FLIP (v3.53): lift the band table + verdictFrom + computeRegime + flipConditions the
// same way (JSX cannot be imported). Lifting the REAL table is the point — these tests prove
// the vote and the flip distances read ONE expression of each edge.
const _lift = (marker, endMarker) => {
  const i = dashSrc.indexOf(marker);
  if (i < 0) throw new Error("smoke: cannot lift " + marker);
  const e = dashSrc.indexOf(endMarker, i);
  return dashSrc.slice(i, e + endMarker.length);
};
// C1 (v3.60): REG now binds the REAL imported engine (see the import block at the top).
const REG = { REGIME_BAND_TABLE, verdictFrom, computeRegime: regimeCompute, flipConditions: regimeFlips };
const allLive = () => "LIVE";
const allMock = () => "MOCK";
const aVix = { id: 2, label: "VIX Spike", metric: "vix", condition: "above", value: 25, unit: "", active: true };
ok("alert: no stored `triggered` flag survives — trigger state is COMPUTED every render",
  !/triggered:false/.test(dashSrc.replace(/\s/g, "")) && dashSrc.includes("evalAlert(a,d,modeOf)"));
ok("alert: an above-threshold live value TRIPS",
  evalAlert(aVix, { marketPulse: { vix: { current: 30 } } }, allLive).state === "triggered");
ok("alert: a below-threshold live value reads CLEAR",
  evalAlert(aVix, { marketPulse: { vix: { current: 12 } } }, allLive).state === "clear");
// The whole point: "has not tripped" and "cannot see whether it tripped" are different facts.
ok("alert: a MOCK/STALE input yields BLIND, never a false CLEAR (fails closed, names the input)",
  (() => { const e = evalAlert(aVix, { marketPulse: { vix: { current: 30 } } }, allMock);
    return e.state === "blind" && /vix/.test(e.why) && e.state !== "clear"; })());
ok("alert: a STALE input is as blind as a mock one — freshness is part of the gate",
  evalAlert(aVix, { marketPulse: { vix: { current: 30 } } }, () => "STALE").state === "blind");
// The SPY cross must judge against TODAY's moving average, not the number hardcoded at
// authoring time — otherwise the alert silently drifts as the market moves.
const aSpy = { id: 1, label: "SPY Below 200D MA", metric: "spy_200ma", condition: "below", value: 692.4, unit: "$", active: true };
ok("alert: the SPY cross is judged against the LIVE 200-DMA, not the authored constant",
  (() => { const e = evalAlert(aSpy, { marketPulse: { spy: { price: 700, ma200: 720 } } }, allLive);
    return e.state === "triggered" && e.threshold === 720 && /live 200-DMA/.test(e.detail); })());
ok("alert: ...and the same price against a LOWER live MA is clear (the constant would have lied)",
  evalAlert(aSpy, { marketPulse: { spy: { price: 700, ma200: 650 } } }, allLive).state === "clear");
ok("alert: a metric with no wiring is BLIND, never assumed clear",
  evalAlert({ metric: "nope", condition: "above", value: 1, active: true }, {}, allLive).state === "blind");
ok("alert: a non-finite live value is BLIND (a missing number is not a passing test)",
  evalAlert(aVix, { marketPulse: { vix: { current: null } } }, allLive).state === "blind");
ok("alert: the header reports BLIND separately — '0 FIRED' with dead inputs is a false clear",
  dashSrc.includes("alertBlind") && dashSrc.includes("BLIND`} color={T.amber}"));
ok("alert: the section states it evaluates HERE and delivers nothing",
  /Evaluated live on THIS page only — no push, email or SMS is sent/.test(dashSrc));
// ---- a11y (suite audit #2): landmarks + live regions on the public page ----
ok("a11y: the page exposes a main landmark (there were ZERO before)",
  /role="main"/.test(dashSrc));
// B4 (v3.59) superseded the block-sized live regions: landmarks stay, announcement narrows
// to ONE concise status sentence — a reader should hear "backdrop changed", not whole blocks.
ok("a11y: verdict + confidence keep their LANDMARKS but are no longer block live regions",
  /aria-label="Macro backdrop verdict"\n?/.test(dashSrc) &&
  /aria-label="Signal quality and backdrop confidence"/.test(dashSrc) &&
  !/aria-label="Macro backdrop verdict" aria-live/.test(dashSrc));
ok("a11y B4: ONE concise visually-hidden status region announces state changes",
  /aria-live="polite" role="status" className="visually-hidden"/.test(dashSrc) &&
  /Backdrop \$\{regime\.label\}: \$\{regime\.counted\} of \$\{regime\.totalFactors\} factors usable\./.test(dashSrc));
ok("a11y B4: header actions carry 44px thumb targets at phone width",
  // v3.62: the TT and TERMINAL actions moved inside the ⋯ OPS disclosure, and the summary
  // itself became an action — so the count is 4 (share · OPS · TT · TERMINAL). The contract is
  // unchanged and is what matters: EVERY header action gets a real thumb target, including the
  // ones now one tap deep, which is why they kept the class rather than losing it to the menu.
  /\.hdr-act\{min-height:44px;min-width:44px/.test(dashSrc) &&
  (dashSrc.match(/className="hdr-act"/g) || []).length === 4);
ok("a11y B4: sparklines are decorative (aria-hidden); the SPY chart has a TEXT equivalent",
  /\{spark&&<div aria-hidden="true"/.test(dashSrc) &&
  /its 200-day average of/.test(dashSrc));

// ---- 28. FEAT-FLIP (v3.53) — the shared band table + "what would change the verdict" ----
// The bands moved OUT of computeRegime's inline ifs into REGIME_BAND_TABLE so flipConditions
// measures distance to the SAME edges the vote uses. That refactor touches the public verdict,
// so every boundary is executed here rather than pinned as a string (the DEC-33 convention).
console.log("\n[28] FEAT-FLIP — one band table, and the load-bearing flips");
const bandOf = (k) => REG.REGIME_BAND_TABLE.find((f) => f.key === k);
const V = (k, v) => bandOf(k).vote(v);
ok("bands: 10Y — -0.11 bull · -0.10 neutral · +0.15 neutral · +0.16 bear",
  V("tenYear", -0.11) === "bull" && V("tenYear", -0.10) === "neutral" &&
  V("tenYear", 0.15) === "neutral" && V("tenYear", 0.16) === "bear");
ok("bands: VIX — 17.99 bull · 18 neutral · 25 neutral · 25.01 bear",
  V("vix", 17.99) === "bull" && V("vix", 18) === "neutral" &&
  V("vix", 25) === "neutral" && V("vix", 25.01) === "bear");
ok("bands: F&G is the INVERTED factor — 56 bull · 55 neutral · 30 neutral · 29 bear",
  V("fearGreed", 56) === "bull" && V("fearGreed", 55) === "neutral" &&
  V("fearGreed", 30) === "neutral" && V("fearGreed", 29) === "bear");
ok("bands: NFCI is INCLUSIVE on the bull edge — -0.5 bull · -0.49 neutral · 0 neutral · 0.01 bear",
  V("nfci", -0.5) === "bull" && V("nfci", -0.49) === "neutral" &&
  V("nfci", 0) === "neutral" && V("nfci", 0.01) === "bear");
ok("bands: the table is the SIX voters and nothing else", REG.REGIME_BAND_TABLE.length === 6);
// The majority rule, extracted so flipConditions simulates with the identical test.
ok("verdictFrom: strict majority — 4/6 RISK-ON, 3/6 MIXED (DEC-31's 50%-is-not-a-majority)",
  REG.verdictFrom(4, 0, 6) === "RISK-ON" && REG.verdictFrom(3, 0, 6) === "MIXED");
ok("verdictFrom: identical to the old constant at 5 voters (needs 3), correct at 3 (needs 2)",
  REG.verdictFrom(3, 0, 5) === "RISK-ON" && REG.verdictFrom(2, 0, 5) === "MIXED" &&
  REG.verdictFrom(2, 0, 3) === "RISK-ON");
// EQUIVALENCE: the refactor must not have moved the verdict on the real mock baseline.
ok("refactor: computeRegime off the table returns the same shape and a real verdict on MOCK_DATA",
  (() => { const r = REG.computeRegime(MOCK_DATA);
    return ["RISK-ON", "RISK-OFF", "MIXED"].includes(r.label) &&
      r.totalFactors === 6 && r.counted === 6 && Number.isFinite(r.bullVotes); })());
ok("refactor: a STALE factor still drops out of the vote and out of `counted`",
  REG.computeRegime(MOCK_DATA, new Set(["vix"])).counted === 5);

// --- ABSTENTION RULE 1: a stale factor is not voting, so it is EXCLUDED, never a distance.
const fcStale = REG.flipConditions(MOCK_DATA, new Set(["vix"]));
ok("flip rule 1: a stale factor is listed as excluded and never appears as a flip distance",
  fcStale.excluded.some((e) => e.key === "vix") && !fcStale.flips.some((f) => f.key === "vix") &&
  fcStale.counted === 5);
// --- ABSTENTION RULE 2: non-scalar votes abstain WITH THE REASON, never an invented number.
const fc = REG.flipConditions(MOCK_DATA);
ok("flip rule 2: CPI and CAPE abstain — their votes are not a single scalar crossing",
  ["cpiHeadline", "valuation"].every((k) => fc.abstained.some((a) => a.key === k)) &&
  !fc.flips.some((f) => ["cpiHeadline", "valuation"].includes(f.key)));
ok("flip rule 2: each abstention NAMES why (a compound rule, not a missing feature)",
  /no single level to cross/.test(fc.abstained.find((a) => a.key === "cpiHeadline").why) &&
  /two conditions/.test(fc.abstained.find((a) => a.key === "valuation").why));
// --- ABSTENTION RULE 3: "nothing flips it" is a real answer, stated, never padded.
// Construct a book where one factor cannot swing the majority: 6 voters, verdict MIXED at
// 1 bull / 1 bear — no SINGLE factor reaching 4 votes exists, so flips must be empty.
const noSwing = REG.flipConditions(MOCK_DATA, new Set());
ok("flip rule 3: every reported flip genuinely CHANGES the label (never a decorative distance)",
  noSwing.flips.every((f) => f.would !== noSwing.current));
ok("flip rule 3: when no single crossing changes the verdict, the list is EMPTY rather than padded",
  (() => { // all six neutral -> MIXED, and one factor flipping gives at most 1 vote of 6
    const flat = JSON.parse(JSON.stringify(MOCK_DATA));
    flat.crossAsset.treasury10y.m1 = 0;            // neutral
    flat.marketPulse.vix.current = 20;             // neutral
    flat.marketPulse.fearGreed.score = 40;         // neutral
    flat.macro.nfci.current = -0.2;                // neutral
    const r = REG.flipConditions(flat);
    return r.current === "MIXED" && r.flips.length === 0; })());
// --- ADJACENCY: from the bull band you can reach neutral, not bear.
ok("flip: only ADJACENT transitions are offered — a bull factor cannot 'flip to bear' in one step",
  (() => { const t = JSON.parse(JSON.stringify(MOCK_DATA));
    t.marketPulse.vix.current = 17;   // bull band
    const r = REG.flipConditions(t);
    const vixFlips = r.flips.filter((f) => f.key === "vix");
    return vixFlips.every((f) => f.to === "neutral"); })());
// --- COPY: direction and inclusivity are rendered from the table, not restated.
ok("flip: the NFCI inclusive bull edge reads 'at or below', the strict VIX edge reads 'below'",
  (() => { const t = JSON.parse(JSON.stringify(MOCK_DATA));
    t.macro.nfci.current = -0.2; t.marketPulse.vix.current = 20;  // both neutral
    t.crossAsset.treasury10y.m1 = -0.5; t.marketPulse.fearGreed.score = 80; // 2 bulls
    const r = REG.flipConditions(t);
    const n = r.flips.find((f) => f.key === "nfci"), v = r.flips.find((f) => f.key === "vix" && f.to === "bull");
    return (!n || /at or below/.test(n.copy)) && (!v || /^VIX below 18/.test(v.copy)); })());
ok("flip: distances are sorted nearest-first, so the load-bearing one reads first",
  fc.flips.every((f, i, a) => i === 0 || a[i - 1].distance <= f.distance));
ok("flip: each flip states the verdict it WOULD produce, not merely that something changes",
  fc.flips.every((f) => ["RISK-ON", "RISK-OFF", "MIXED"].includes(f.would)));
// Render layer: the nearest crossing is on the FIRST SCREEN (the audit's fourth answer), the
// full set one tap down, and the abstentions are NOT omitted from the panel.
ok("flip render: the verdict band carries the nearest crossing without opening anything",
  dashSrc.includes("⇄ would change this: ") && dashSrc.includes("const nearest=fc.flips[0]||null;"));
ok("flip render: the no-single-flip case is stated in BOTH the band and the panel",
  /no single factor crossing flips this verdict — it would take two/.test(dashSrc) &&
  /No single factor crossing changes the call/.test(dashSrc));
ok("flip render: the panel names abstentions and stale exclusions, never silently dropping them",
  dashSrc.includes("no single threshold — ") &&
  dashSrc.includes("their thresholds are not load-bearing"));
ok("flip render: distances print at the precision of the factor's own band (fmt.num + dec)",
  dashSrc.includes("fmt.num(nearest.distance,nearest.dec)") && dashSrc.includes("num:(v,d=2)=>Number(v).toFixed(d)"));
// Found BY the flip browser check: a nowrap 317px subtitle blew the page to 488px at 390px.
ok("mobile: the AI unit-economics subtitle wraps (a nowrap label must not blow out the page)",
  !/whiteSpace:"nowrap"\}\}>cost ↔ price/.test(dashSrc));

// ---- 29. FEAT-QUORUM (v3.54, 11.4.5 audit CRITICAL) — mock must never vote ----
// The defect: only STALE factors were excluded, so during LOADING (and after a failed fetch)
// all six voted off MOCK_DATA and the page rendered a confident posture while Signal Quality
// truthfully said 0 live / 15 mock two rows above. The tiles have suppressed directional
// calls on mock since v3.1; the HEADLINE VERDICT never did. It passed every prior test.
console.log("\n[29] FEAT-QUORUM — mock factors cannot vote; the posture is withheld below quorum");
ok("quorum: the dashboard now HAS an abstention rule (it had none; the tt-v1 readout always did)",
  /export const REGIME_QUORUM = 4;/.test(regimeSrc) && REGIME_QUORUM === 4);
ok("quorum: below quorum the label is INSUFFICIENT, not a posture",
  (() => { const r = REG.computeRegime(MOCK_DATA, new Set(["vix", "fearGreed", "cpiHeadline"]));
    return r.counted === 3 && r.label === "INSUFFICIENT" && r.insufficient === true; })());
ok("quorum: at exactly 4 usable factors a posture IS published (the boundary)",
  (() => { const r = REG.computeRegime(MOCK_DATA, new Set(["vix", "fearGreed"]));
    return r.counted === 4 && r.insufficient === false &&
      ["RISK-ON", "RISK-OFF", "MIXED"].includes(r.label); })());
ok("quorum: the withheld verdict still records what the majority WOULD have said (never silent)",
  (() => { const r = REG.computeRegime(MOCK_DATA, new Set(["vix", "fearGreed", "cpiHeadline"]));
    return ["RISK-ON", "RISK-OFF", "MIXED"].includes(r.raw) && r.label !== r.raw; })());
ok("quorum: a single usable factor can never dictate the public posture",
  REG.computeRegime(MOCK_DATA, new Set(["vix", "fearGreed", "cpiHeadline", "valuation", "nfci"])).label === "INSUFFICIENT");
// The exclusion itself: MOCK is unusable in a LIVE build, but NOT in a demo build.
ok("quorum: the vote excludes anything that is not LIVE/CACHED when the build is live (run)",
  (() => { const ex = factorExclusions({ provenance: {}, dataAsOf: {}, liveBuild: true });
    return REGIME_FACTOR_FIELDS.every((k) => ex.has(k)) && ex.has("valuation") && ex.size === 6; })());
ok("quorum: a pure DEMO build is unaffected — mock IS its baseline (run: zero exclusions)",
  factorExclusions({ provenance: {}, dataAsOf: {}, liveBuild: false }).size === 0 &&
  readFileSync(new URL("../src/useMarketData.js", import.meta.url), "utf8").includes('const liveBuild = MODE === "live";'));
// mode:"MOCK" is ambiguous between demo and failed-live; the hook now says which.
ok("quorum: the wiring point exposes build INTENT so a failed live fetch is not read as demo",
  (() => { const src = readFileSync(new URL("../src/useMarketData.js", import.meta.url), "utf8");
    return (src.match(/liveBuild/g) || []).length >= 4 && src.includes("loading: liveBuild"); })());
// LOADING is not a verdict state.
ok("quorum: LOADING withholds the posture outright rather than computing one from mock",
  dashSrc.includes("const withheld=loading||regime.insufficient;") &&
  dashSrc.includes('loading={mode==="LOADING"}'));
ok("quorum: the withheld state gets its OWN moon voice, never a directional one defaulted",
  /CAN'T CALL IT/.test(dashSrc) && dashSrc.includes("withheld?WEN_MOON_STATES[3]"));
ok("quorum: the flip line is suppressed when there is no posture to flip",
  /withheld\s*\n\s*\? <div/.test(dashSrc));
ok("quorum: the confidence strip states the withhold, not a bare factor count",
  /POSTURE WITHHELD \(needs \$\{regime\.quorum\}\)/.test(dashSrc));
// ---- WHY #1 freshness gate (11.4.5 audit, High) ----
// WHY #2 freshness-gated its cross-signals; WHY #1 asserted SPY/CPI/Fed unconditionally, so a
// mock CPI could be narrated as "today's core tape" inside the verdict's own explanation.
const fwCore = computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set(["spyPrice"]) });
ok("why1: a non-live core input is OMITTED, not asserted from mock",
  !/CPI \d/.test(fwCore.whys[0]) && !/Fed funds/.test(fwCore.whys[0]) && /SPY \$/.test(fwCore.whys[0]));
ok("why1: the thin anchor is STATED as thin (N/3 core inputs usable)",
  /1\/3 core inputs usable/.test(fwCore.whys[0]));
ok("why1: with every core input dead it says so rather than emitting a blank anchor",
  /0\/3 core inputs usable/.test(computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set() }).whys[0]));
ok("why1: no live equity mark means no primary-trend claim either",
  /No live equity mark, so no primary-trend read/.test(
    computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set(["cpiHeadline"]) }).whys[0]));
ok("why1: demo/mock mode (fresh:null) still narrates all three — mock IS the baseline there",
  /SPY \$/.test(fw.whys[0]) && /CPI /.test(fw.whys[0]) && /Fed funds/.test(fw.whys[0]));
ok("why1: the dashboard actually PASSES the core fields into the freshness set",
  /FW_FIELDS=\[[\s\S]*?"spyPrice","cpiHeadline","fedFunds"\]/.test(dashSrc));

// ---- 30. 11.4.5 audit — a11y tokens, headings, and safe GET ----------------
console.log("\n[30] 11.4.5 audit — contrast, focus, headings, HTTP semantics");
// Contrast is COMPUTED here, not asserted in a comment — the previous "WCAG AA verified"
// annotation on live-cyan-700 was false (3.20:1), which is the same defect class as a label
// describing deleted data. This test makes the claim falsifiable.
const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tok = (name) => (new RegExp('"' + name + '":\\s*"(#[0-9a-fA-F]{6})"').exec(dashSrc) || [])[1];
ok("a11y: sanity — the contrast helper reproduces a known pair (white on black = 21:1)",
  Math.round(ratio("#ffffff", "#000000")) === 21);
ok("a11y: text-muted clears AA on both bg and surface (was #3d4760 = 2.15:1, below AA)",
  ratio(tok("text-muted"), tok("bg")) >= 4.5 && ratio(tok("text-muted"), tok("surface")) >= 4.5);
ok("a11y: text-secondary clears AA on bg", ratio(tok("text-secondary"), tok("bg")) >= 4.5);
ok("a11y: the LIVE badge cyan clears AA on its OWN badge background (#0a1e24), not on bg",
  ratio(tok("live-cyan-700"), "#0a1e24") >= 4.5);
ok("a11y: no token still ASSERTS a compliance it was never measured for",
  !/WCAG AA verified/.test(dashSrc));
ok("a11y: a :focus-visible ring exists (focused controls had no indicator at all)",
  /:focus-visible\{outline:2px solid/.test(dashSrc) && dashSrc.includes('"focus-ring"'));
ok("a11y: focus styling uses :focus-visible, so a mouse click never paints a ring",
  !/[^-]:focus\{/.test(dashSrc));
ok("a11y: the page has a document heading (it had no h1–h6 at all)",
  /<h1 className="visually-hidden">/.test(dashSrc) && /\.visually-hidden\{position:absolute/.test(dashSrc));
// HTTP semantics: GET must be safe. Both of these WROTE.
const ledgerSrc2 = readFileSync(new URL("../functions/api/ledger.js", import.meta.url), "utf8");
const posSrc2 = readFileSync(new URL("../functions/api/positions.js", import.meta.url), "utf8");
// The negative must be scoped to the GET path — the POST handler legitimately calls runSeed.
const ledgerGet = ledgerSrc2.slice(0, ledgerSrc2.indexOf("export async function onRequestPost"));
const posGet = posSrc2.slice(0, posSrc2.indexOf("export async function onRequestPost"));
ok("http: ?seed=1 no longer mutates on GET — it 405s and names the correct verb",
  /seed mutates state — use POST/.test(ledgerSrc2) && !/return runSeed/.test(ledgerGet));
ok("http: ?migrate=1 no longer mutates on GET — it 405s and names the correct verb",
  /migrate mutates state — use POST/.test(posSrc2) && !/return runMigrate/.test(posGet));
ok("http: both mutations now live on POST behind the SAME Origin/CSRF guard as every other write",
  /export async function onRequestPost/.test(ledgerSrc2) && /crossOrigin\(request\)\) return json/.test(ledgerSrc2) &&
  /export async function onRequestPost/.test(posSrc2) &&
  (posSrc2.match(/crossOrigin\(request\)\) return json/g) || []).length >= 2);
ok("http: the POST routes are actually reachable through the method router",
  /request\.method === "POST"\) return onRequestPost/.test(posSrc2));
ok("http: POST still requires auth before doing anything (PIN-gated like every ledger read)",
  /onRequestPost\(\{ request, env \}\) \{\s*\n\s*const auth = await authorize\(request, env\);/.test(ledgerSrc2));

// ---- 31. FEAT-TT-CAPABILITY (v3.55) — the demand-side falsifier ------------
// FEAT-TT-CAPEX instruments the SUPPLY of AI capital and fires when >=2 spenders guide down.
// The REASON they would guide down — capability/ROI disappointment — was instrumented nowhere.
// This closes that, and is designed as a FALSIFIER: the threshold must be pre-committed.
console.log("\n[31] FEAT-TT-CAPABILITY — the demand leg, pre-committed or rejected");
const capBoard = (extra) => validateBoard({ as_of: "2026-08-01", ...extra });
const CAP_OK = { metric: "task-horizon doubling (METR 50%)", observed_months: 7,
  prior_months: 7, threshold_months: 18, source: "METR 2025", as_of: "2026-08-01" };
ok("capability: a complete block validates", capBoard({ capability: CAP_OK }) === null);
// THE load-bearing rule: no threshold, no block. This is the whole design.
ok("capability: a reading WITHOUT a pre-committed threshold is REJECTED, and the message says why",
  (() => { const { threshold_months, ...noThr } = CAP_OK;
    const e = capBoard({ capability: noThr });
    return typeof e === "string" && /threshold_months is required/.test(e) &&
      /confirmation device/.test(e); })());
ok("capability: prior_months is required too — the signal is the DELTA, not the level",
  (() => { const { prior_months, ...noPrior } = CAP_OK;
    return /prior_months is required/.test(capBoard({ capability: noPrior }) || ""); })());
ok("capability: the metric must be named — an unnamed measure cannot be checked against a source",
  /metric is required/.test(capBoard({ capability: { ...CAP_OK, metric: "  " } }) || ""));
ok("capability: a source is required — this is the weakest-sourced input the book carries",
  /source is required/.test(capBoard({ capability: { ...CAP_OK, source: "" } }) || ""));
ok("capability: an undated read is rejected — it would age invisibly",
  /as_of \(YYYY-MM-DD\) is required/.test(capBoard({ capability: { ...CAP_OK, as_of: "" } }) || ""));
// Bands reject the impossible, not the unusual: a LONG doubling time is a stall, which is
// exactly the signal this block exists to catch — it must not be banded away as a typo.
ok("capability: a non-positive or absurd doubling time is out of band",
  /out of band/.test(capBoard({ capability: { ...CAP_OK, observed_months: 0 } }) || "") &&
  /out of band/.test(capBoard({ capability: { ...CAP_OK, observed_months: 999 } }) || ""));
ok("capability: a very long doubling time (a genuine STALL) is ACCEPTED, not banded away",
  capBoard({ capability: { ...CAP_OK, observed_months: 200, threshold_months: 18 } }) === null);
ok("capability: the block is optional — absent leaves v3.54 behaviour untouched",
  capBoard({}) === null);
// Client state: lifted and RUN, since a tripwire is a claim about numbers.
const CAPST = new Function("const CAPABILITY_MOVE_PCT=15;let BOARD={};" +
  liftFns(adminSrc, ["ageDays", "capabilityState"]) +
  "\nreturn {capabilityState,set:(b)=>{BOARD=b;}};")();
const capSt = (o) => { CAPST.set({ capability: { ...CAP_OK, ...o } }); return CAPST.capabilityState(); };
ok("capability: past the pre-committed threshold the falsifier TRIPS",
  capSt({ observed_months: 20 }).impaired === true);
ok("capability: inside the threshold it does not trip, and headroom is stated in the metric's unit",
  capSt({}).impaired === false && capSt({}).headroom === 11);
ok("capability: a materially LONGER doubling reads as slowing (capability compounding slower)",
  capSt({ observed_months: 9, prior_months: 7 }).slowing === true);
ok("capability: it fires in BOTH directions — a faster doubling is information, not silence",
  capSt({ observed_months: 5, prior_months: 7 }).accelerating === true);
ok("capability: a move inside the noise band is neither slowing nor accelerating",
  (() => { const c = capSt({ observed_months: 7.5, prior_months: 7 });
    return !c.slowing && !c.accelerating; })());
ok("capability: absent or malformed state reads as UNKNOWN (fails closed, never healthy)",
  (() => { CAPST.set({}); if (CAPST.capabilityState() !== null) return false;
    CAPST.set({ capability: { observed_months: 7 } }); return CAPST.capabilityState() === null; })());
// The non-negotiable: no projection anywhere in the feature.
ok("capability: NOTHING extrapolates — no power/exp projection of a future capability level",
  (() => { const i = adminSrc.indexOf("function capabilityState()");
    const seg = adminSrc.slice(i, adminSrc.indexOf("function capexExposure", i));
    return !/Math\.pow|\*\*|Math\.exp/.test(seg); })());
ok("capability: the tripped falsifier reaches the stance strip — red survives every collapse",
  /⚡ demand falsified/.test(adminSrc) && /demand falsifier tripped/.test(adminSrc));
ok("capability: supply and demand share ONE badge — same thesis, same drawer, one chip",
  /⚡ AI both legs/.test(adminSrc) &&
  (adminSrc.match(/onclick="openDesk\('dCapex'\)">\$\{txt\}/g) || []).length === 1);
ok("capability: an absent block SAYS the demand leg is unmeasured rather than implying health",
  /Demand leg unmeasured/.test(adminSrc));
ok("capability: threshold_basis is optional but must be real text when present",
  capBoard({ capability: { ...CAP_OK, threshold_basis: "  " } }) !== null &&
  capBoard({ capability: { ...CAP_OK, threshold_basis: "capex guidance cycle" } }) === null);
ok("capability: a threshold with NO recorded basis is called out, not quietly accepted",
  /threshold basis not recorded/.test(adminSrc) &&
  /indistinguishable from a number someone liked/.test(adminSrc));
ok("capability: the entry path documents the pre-commitment rule where the owner types it",
  /threshold_months is REQUIRED/.test(adminSrc) && /is a confirmation device/.test(adminSrc));

// ---- 32. FEAT-30Y (v3.55) — the long end and the 10s30s term spread -------
// NOT the TLT rejection replayed: TLT was refused (v3.43) as a monotonic transform of the
// 10Y already displayed. DGS30 is not derivable from DGS10 — the SPREAD is the term-premium /
// fiscal-risk gauge, and "long end breaking out while the front holds" is its own channel.
console.log("\n[32] FEAT-30Y — DGS30, the 10s30s spread, and its alerts");
ok("30y: DGS30 is pulled through the existing fetchFred path, not a new fetcher",
  /thirtyYear:\s*"DGS30"/.test(snapSrc) && !/fetchThirty|fetch30/.test(snapSrc));
ok("30y: deltas are ABSOLUTE yield moves (pp), the same convention as the 10Y — never pct()",
  /out\.thirtyYearD1 = parseFloat\(\(latest - prev\)/.test(snapSrc) &&
  /out\.thirtyYearM1 = parseFloat\(\(latest - mAgo\)/.test(snapSrc));
ok("30y: the 10s30s spread is DERIVED server-side and stamped its own AsOf (creditSpread pattern)",
  /out\.spread10s30s = parseFloat\(\(out\.thirtyYear - out\.tenYear\)/.test(snapSrc) &&
  /out\.spread10s30sAsOf = out\.thirtyYearAsOf/.test(snapSrc));
ok("30y: the temp sparklines used to derive the spread are deleted, never leaked to the payload",
  /delete out\._thirtySparkline/.test(snapSrc) && /delete out\._tenSparkline/.test(snapSrc));
// Bands: reject the impossible, not the unusual. An INVERTED curve is the signal.
ok("30y: bands accept every yield the bond market has actually produced (1981 peak ~15%)",
  /thirtyYear:\s*\[0, 20\]/.test(snapSrc));
ok("30y: the spread band ACCEPTS inversion — a negative 10s30s is the signal, not a parse fault",
  (() => { const m = /spread10s30s:\s*\[(-?\d+), (\d+)\]/.exec(snapSrc);
    return m && Number(m[1]) < 0; })());
// Staleness must inherit, per the v3.41 table.
ok("30y: every undated derivative maps to its parent in DERIVED_OF (no field votes undated)",
  ["thirtyYearD1", "thirtyYearW1", "thirtyYearM1", "thirtyYearSeries"]
    .every((k) => DERIVED_OF_SRC[k] === "thirtyYear") &&
  DERIVED_OF_SRC.spread10s30sSeries === "spread10s30s");
ok("30y: the spread inherits the 30Y's cadence (daily) rather than defaulting blindly",
  cadenceOf("spread10s30sSeries") === "daily" && cadenceOf("thirtyYearM1") === "daily");
// The merge path, end to end.
ok("30y: a live payload overlays the 30Y and the spread onto the mock baseline", (() => {
  const r = mergeLiveOverMock(MOCK_DATA, { live: {
    thirtyYear: 5.24, thirtyYearAsOf: "2026-08-01", thirtyYearM1: 0.18,
    spread10s30s: 0.78, spread10s30sAsOf: "2026-08-01" }, cached: false });
  return r.data.crossAsset.treasury30y.current === 5.24 &&
    r.data.crossAsset.term.spread10s30s === 0.78 &&
    r.provenance.thirtyYear === "LIVE" && r.dataAsOf.thirtyYearM1 === "2026-08-01"; })());
// The tile: a reference level, never a verdict off a level (the v3.1 invariant).
ok("30y: the tile states the 5% reference as a REFERENCE, and never asserts a call from it",
  /5\.00% = the 2007 pre-GFC reference level/.test(dashSrc) &&
  !/BUBBLE|OVERVALUED/.test(dashSrc.slice(dashSrc.indexOf('label="30Y Treasury"'),
    dashSrc.indexOf('label="30Y Treasury"') + 900)));
ok("30y: the tile names the inversion explicitly when the spread goes negative",
  /INVERTED/.test(dashSrc));
// The alerts ride FEAT-ALERT-EVAL: live-gated, BLIND when not.
ok("30y: both alerts are wired to real metrics, so they evaluate rather than sit inert",
  /treasury30y: \{fields:\["thirtyYear"\]/.test(dashSrc) &&
  /term10s30s:\s*\{fields:\["thirtyYear","tenYear"\]/.test(dashSrc));
ok("30y: the 5.2% alert exists and is active", /30Y Above 5\.2%/.test(dashSrc));
ok("30y: the spread alert needs BOTH legs live — one dead leg must blind it, not clear it",
  evalAlert({ metric: "term10s30s", condition: "below", value: 0, active: true },
    { crossAsset: { term: { spread10s30s: -0.2 } } },
    (f) => f === "tenYear" ? "MOCK" : "LIVE").state === "blind");
ok("30y: with both legs live an inversion TRIPS the spread alert",
  evalAlert({ metric: "term10s30s", condition: "below", value: 0, active: true },
    { crossAsset: { term: { spread10s30s: -0.2 } } }, () => "LIVE").state === "triggered");
ok("30y: a 5.24% long bond trips the 5.2% alert; 5.10% is clear",
  evalAlert({ metric: "treasury30y", condition: "above", value: 5.2, active: true },
    { crossAsset: { treasury30y: { current: 5.24 } } }, () => "LIVE").state === "triggered" &&
  evalAlert({ metric: "treasury30y", condition: "above", value: 5.2, active: true },
    { crossAsset: { treasury30y: { current: 5.10 } } }, () => "LIVE").state === "clear");
// Arrival rule: NFCI's precedent — a new series does not vote on day one.
ok("30y: it does NOT vote — REGIME_BAND_TABLE is untouched and the readout math did not move",
  !/thirtyYear|spread10s30s/.test(dashSrc.slice(dashSrc.indexOf("const REGIME_BAND_TABLE"),
    dashSrc.indexOf("export function verdictFrom"))) &&
  !/thirtyYear|spread10s30s/.test(readFileSync(new URL("../src/ttReadout.js", import.meta.url), "utf8")));

// ---- 33. the regime reference doc stays OUT of the public repo ------------
// It leaked no book content, but CONSOLIDATION is itself the risk: one file describing the
// whole decision architecture — every band, veto order, sort key and constant — is far more
// useful to an adversary than the same facts scattered across source comments. Same reasoning
// that keeps the TT framework doc in KV. It lives as a chat artifact instead (owner call).
console.log("\n[33] regime reference — not in the public repo");
ok("ref: the consolidated regime reference is NOT committed to this public repo",
  !existsSync(new URL("../REGIME_LOGIC_REFERENCE_2026-08-01.md", import.meta.url)) &&
  !existsSync(new URL("../docs/REGIME_LOGIC_REFERENCE_2026-08-01.md", import.meta.url)));
ok("ref: no dated regime-reference file has crept back in under any name",
  !readdirSync(new URL("../", import.meta.url)).some((f) => /REGIME_LOGIC_REFERENCE/i.test(f)));
// The rails that make the whole thing safe to keep out of the repo in the first place.
ok("ref: the terminal still ships EMPTY rails — no book, board or positions in the bundle",
  adminSrc.includes("const SEED=[];") && /^let BOARD=\{\};/m.test(adminSrc) &&
  /^let POSITIONS=\{\};/m.test(adminSrc));

// ---- 34. FEAT-TT-RANKEXPORT (v3.56) — the rankings, off the phone ---------
// The populated ranking cannot live in the public repo (book content is KV-only), so the
// terminal produces it where the data is. The load-bearing property is that it REUSES the
// board's computations — an export that re-derived its ranking could disagree with the screen.
console.log("\n[34] FEAT-TT-RANKEXPORT — reuse, ranks, and the iOS share chain");
const rxSeg = adminSrc.slice(adminSrc.indexOf("function buildRankingsMd"),
  adminSrc.indexOf("function download(", adminSrc.indexOf("function buildRankingsMd")));
ok("rankexport: it READS the board's own rows and picks, never recomputing its own ranking",
  /UPSIDE_ROWS/.test(rxSeg) && /AGREE_PICK/.test(rxSeg) && /sellRank\(\)/.test(rxSeg) &&
  !/ptModelRows\(/.test(rxSeg) && !/pickRow\(/.test(rxSeg));
ok("rankexport: readiness is reused for per-name verdicts and veto reasons",
  /readiness\(e\)/.test(rxSeg) && /rd\.blockers\.join/.test(rxSeg));
// Dense ranking, executed — a tie must share a rank, not become first-and-second.
const RX = new Function(liftFns(adminSrc, ["rankCategories"]) + "\nreturn rankCategories;")();
const mkRow = (sym, ann, score, w, tier, lens) => ({ sym, ann, tier, lens,
  tt: score === null ? null : { score, tier: "A" }, wt: { w } });
const rc = RX([mkRow("AAA", 40, 9.0, 12, "S", "AI"), mkRow("BBB", 40, 7.0, 5, "S", "AI"),
  mkRow("CCC", 10, 8.0, 20, "A", "QC"), mkRow("DDD", null, null, null, "A", "AI")]);
ok("rankexport: ranks are DENSE — two names tied on upside share rank 1, next is 3",
  rc.overall.upside.map.get("AAA") === 1 && rc.overall.upside.map.get("BBB") === 1 &&
  rc.overall.upside.map.get("CCC") === 3);
ok("rankexport: a name with no rate is excluded from that ranking, not ranked last as 0",
  !rc.overall.upside.map.has("DDD") && rc.overall.upside.n === 3);
ok("rankexport: composite and weight get their own independent rankings",
  rc.overall.composite.map.get("AAA") === 1 && rc.overall.composite.map.get("CCC") === 2 &&
  rc.overall.weight.map.get("CCC") === 1);
ok("rankexport: per-TIER and per-LENS ranks are scoped to their own category",
  rc.tier.S.n === 2 && rc.tier.A.n === 1 && rc.lens.AI.n === 2 && rc.lens.QC.n === 1 &&
  rc.tier.A.map.get("CCC") === 1);
// The document must explain itself, not just list.
ok("rankexport: it leads with STANCE — whether capital may move outranks any ranking",
  /## STANCE/.test(rxSeg) && rxSeg.indexOf("## STANCE") < rxSeg.indexOf("## MASTER RANKING"));
ok("rankexport: it names WHY the other names are not eligible, not just the winner",
  /Why the others are not eligible/.test(rxSeg));
ok("rankexport: names what it could NOT rank — silent truncation reads as full coverage",
  /## NOT RANKED/.test(rxSeg) && /NOT judged unattractive/.test(rxSeg));
ok("rankexport: funding priority carries its own disclaimer, since it is not a sell call",
  /NOT a sell recommendation/.test(rxSeg));
ok("rankexport: provenance states the floor denominator and the self-attestation limit",
  /a floor — NAV unmeasured/.test(rxSeg) && /SELF-ATTESTED/.test(rxSeg));
ok("rankexport: the file marks itself private book content",
  /keep out of public repos/.test(rxSeg));
// The iOS share chain.
const shSeg = adminSrc.slice(adminSrc.indexOf("async function exportRankings"),
  adminSrc.indexOf("function download(", adminSrc.indexOf("async function exportRankings")));
ok("share: the document is built SYNCHRONOUSLY before any await, so the gesture survives",
  /md=buildRankingsMd\(\);/.test(shSeg) &&
  shSeg.indexOf("buildRankingsMd()") < shSeg.indexOf("await navigator.share"));
ok("share: it feature-DETECTS file sharing rather than assuming it (canShare with files)",
  /navigator\.canShare\(\{files:\[file\]\}\)/.test(shSeg));
ok("share: full fallback chain — file share, text share, clipboard, download",
  /navigator\.share\(\{files/.test(shSeg) && /navigator\.share\(\{title:"TT Rankings",text:md\}\)/.test(shSeg) &&
  /clipboard\.writeText\(md\)/.test(shSeg) && /download\(name,md/.test(shSeg));
ok("share: a CANCELLED sheet is an AbortError and is never reported as a failure",
  (shSeg.match(/AbortError"\)return/g) || []).length === 2);
ok("share: text/plain is used for iOS target compatibility, with a .md filename",
  /type:"text\/plain"/.test(shSeg) && /TT-RANKINGS-\$\{/.test(shSeg));
ok("share: the button exists in the toolbar", /onclick="exportRankings\(\)"/.test(adminSrc));

// ---- 35. E2E pass (v3.57) — bugs and ambiguities found driving the terminal ----
// An end-to-end pass: the terminal driven through empty/minimal/partial/adversarial books,
// malformed and erroring APIs, and the pure functions fuzzed with hostile inputs.
console.log("\n[35] E2E pass — malformed shapes, NaN ranks, string-typed payloads");

// (1) HARD FAILURE: a KV doc with `book:{}` is truthy, so `||[]` did not catch it and
// BOOK.filter() threw — white-screening the whole terminal. validateBook guards PUT; GET
// trusts whatever KV holds, so the client must fail closed too.
// toasts must RESET per call — the closure is shared, so without this a later assertion
// sees warnings raised by an earlier malformed fixture (caught while writing these).
const AS = new Function("let BOOK,CUT,BOARD,META,AUTH={};let toasts=[];" +
  "const toast=(m)=>toasts.push(m),stampHeader=()=>{},stampAuthState=()=>{};" +
  liftFns(adminSrc, ["applyServer"]) +
  "\nreturn (d)=>{toasts=[];applyServer(d);return{BOOK,CUT,BOARD,toasts};};")();
ok("e2e: a non-array `book` degrades to EMPTY instead of throwing",
  (() => { const r = AS({ book: { a: 1 }, cut: [] });
    return Array.isArray(r.BOOK) && r.BOOK.length === 0; })());
ok("e2e: ...and it SAYS the stored book is malformed rather than pretending it is fine",
  /malformed/i.test((AS({ book: { a: 1 } }).toasts[0]) || ""));
ok("e2e: it warns against saving over a malformed doc before exporting a backup",
  /export a backup/i.test((AS({ book: "nope" }).toasts[0]) || ""));
ok("e2e: a non-array `cut` is caught by the same guard",
  Array.isArray(AS({ book: [], cut: { x: 1 } }).CUT));
ok("e2e: a non-object `board` degrades to {} rather than poisoning session reads",
  (() => { const r = AS({ book: [], board: [1, 2] });
    return r.BOARD && typeof r.BOARD === "object" && !Array.isArray(r.BOARD); })());
ok("e2e: a WELL-FORMED payload still loads untouched, and warns about nothing",
  (() => { const r = AS({ book: [{ sym: "A" }], cut: ["B"], board: { as_of: "x" } });
    return r.BOOK.length === 1 && r.CUT.length === 1 && r.BOARD.as_of === "x" && !r.toasts.length; })());

// (2) A NaN rate was RANKED — NaN is neither null nor undefined, so the old guard missed it.
// Same class as "unmeasured must never read as 0": unrankable has to mean EXCLUDED.
ok("e2e: rankCategories EXCLUDES a NaN rate rather than ranking it as a number",
  (() => { const r = RX([{ sym: "A", ann: NaN, tier: "S", lens: "AI", tt: null, wt: { w: null } },
    { sym: "B", ann: 10, tier: "S", lens: "AI", tt: null, wt: { w: null } }]);
    return !r.overall.upside.map.has("A") && r.overall.upside.map.get("B") === 1 &&
      r.overall.upside.n === 1; })());
ok("e2e: Infinity is excluded too (a divide-by-zero must not top the ranking)",
  !RX([{ sym: "A", ann: Infinity, tier: "S", lens: "AI", tt: null, wt: { w: null } }])
    .overall.upside.map.has("A"));

// (3) AMBIGUITY: quoted numbers ("100" not 100) produce zero rows, and NOFLOOR then reported
// the inputs as MISSING when they were present — sending you after the wrong defect.
const Y2 = new Date().getFullYear();
const strTyped = { consensus: { revenue_B: { [Y2 + 1]: "100" }, eps: { [Y2 + 1]: "5" } },
  pt_model: { ev_s_multiple: { [Y2]: "10" }, share_count_M: "100", pe_floor_multiple: "12" } };
const strLints = PT.lintPtModel(strTyped);
ok("e2e: a string-typed payload raises a TYPES error naming the actual defect",
  strLints.some((l) => l.code === "TYPES" && l.sev === "error"));
ok("e2e: the TYPES message names the offending fields and the fix",
  (() => { const l = strLints.find((x) => x.code === "TYPES");
    return /pt_model\.share_count_M/.test(l.msg) && /"100" is not 100/.test(l.msg); })());
ok("e2e: a correctly-typed payload raises NO type lint (no false positive)",
  !PT.lintPtModel({ consensus: { revenue_B: { [Y2 + 1]: 100 }, eps: { [Y2 + 1]: 5 } },
    pt_model: { ev_s_multiple: { [Y2]: 10 }, share_count_M: 100, pe_floor_multiple: 12 } })
    .some((l) => l.code === "TYPES"));
ok("e2e: a genuinely non-numeric string (a note) is not mistaken for a mistyped number",
  !PT.lintPtModel({ consensus: { revenue_B: { [Y2 + 1]: 100 }, eps: { [Y2 + 1]: 5 } },
    pt_model: { ev_s_multiple: { [Y2]: 10 }, share_count_M: 100, pe_floor_multiple: 12,
      note: "gate-contingent" } }).some((l) => l.code === "TYPES"));

// (4) STALE CLAIM: the comment said Kalshi wiring was a TODO. It has been live since v2.6.3 —
// the same "a label outliving its data" defect the Mag-10 footer had.
ok("e2e: no comment still claims the Kalshi odds are unwired",
  !/live Kalshi wiring TODO/.test(dashSrc) &&
  /fetchRateOdds/.test(readFileSync(new URL("../functions/api/snapshot.js", import.meta.url), "utf8")));

// (5) AMBIGUITY: three files, two body caps, no stated reason reads as an oversight.
ok("e2e: the positions store's smaller cap is documented, not left to look accidental",
  (() => { const src = readFileSync(new URL("../functions/api/positions.js", import.meta.url), "utf8");
    return /Deliberately 64KB, NOT the book's 300KB/.test(src); })());
ok("e2e: the book cap and its client pre-flight mirror still agree",
  /const MAX_BODY = 300 \* 1024;/.test(ttSrc) && /const MAX_BODY=300\*1024;/.test(adminSrc));

// ---- 36. v3.58 hotfix (UX re-audit fix-now) — truthfulness, 320px, boundary ----
console.log("\n[36] v3.58 hotfix — no mock narration, 320px contract, public gate");
// A1: freshSet keys on the build's INTENT. `anyLive` made a loading/failed live build pass
// fresh:null — computeFiveWhys's "demo mode, narrate everything" — so the 5 Whys asserted
// mock SPY/CPI/Fed under a withheld verdict.
ok("A1: freshSet derives from liveBuild, never anyLive",
  /const freshSet=liveBuild \? new Set/.test(dashSrc) && !/freshSet=anyLive/.test(dashSrc));
ok("A1: demoted() still keys on anyLive — demotion is display, and the demo must not collapse",
  /const demoted=\(f\)=>anyLive&&isIllustrative/.test(dashSrc));
// Behavioral: an EMPTY fresh set (live build, nothing usable) must gate the HEADLINE too.
const fwEmpty = computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set() });
ok("A1: with nothing fresh the headline carries no mock SPY day-move",
  !/— SPY/.test(fwEmpty.headline) && /bullish factors\./.test(fwEmpty.headline));
ok("A1: with spyPrice fresh the SPY clause returns (the gate is freshness, not deletion)",
  /— SPY/.test(computeFiveWhys(MOCK_DATA, fwRegime, { fresh: new Set(["spyPrice"]) }).headline));
ok("A1: demo mode (fresh:null) still narrates the full headline — mock IS that baseline",
  /— SPY/.test(computeFiveWhys(MOCK_DATA, fwRegime).headline));
// A2: the 320px contract — identity group may shrink, actions may wrap, wordmark yields first.
ok("A2: header groups can shrink and wrap instead of forcing horizontal overflow",
  /alignItems:"center",gap:14,minWidth:0,flexWrap:"wrap"/.test(dashSrc) &&
  /alignItems:"center",gap:8,flexWrap:"wrap",minWidth:0/.test(dashSrc));
ok("A2: the duplicate lowercase wordmark hides below 360px",
  /@media\(max-width:359px\)\{\.sub-wordmark\{display:none;\}\}/.test(dashSrc));
// A3: browser suites fail rather than skip under CI's flag; both routes are covered.
ok("A3: both browser suites honor REQUIRE_BROWSER=1 (skip becomes a failure)",
  /REQUIRE_BROWSER === "1"/.test(readFileSync(new URL("../test/public-render.mjs", import.meta.url), "utf8")) &&
  /REQUIRE_BROWSER === "1"/.test(readFileSync(new URL("../test/render.mjs", import.meta.url), "utf8")));
ok("A3: the public suite actually visits the public route, not only the operator one",
  /\/\?view=public/.test(readFileSync(new URL("../test/public-render.mjs", import.meta.url), "utf8")));
// A4: the boundary is ENFORCED by the gate, not described by a comment.
ok("A4: MY CONVICTION and Macro Alerts are gated behind !publicView",
  (dashSrc.match(/\{!publicView&&<div style=\{\{marginTop:16/g) || []).length === 2);
ok("A4: the public footer NAMES the omission (a cut takes its attribution with it)",
  /operator view carries the curated watchlist and alert monitors/.test(dashSrc));
// A5: production dependency surface is classified and checkable in one command.
ok("A5: audit:prod script exists (measured clean at v3.58 — all 3 advisories are dev toolchain)",
  /"audit:prod": "npm audit --omit=dev"/.test(readFileSync(new URL("../package.json", import.meta.url), "utf8")));

// ---- 37. v3.59 follow-ups — ERROR mode, provenance vocabulary, security ----
console.log("\n[37] v3.59 — ERROR is not demo, fresh is not live, debug needs a token");
const hookSrc = readFileSync(new URL("../src/useMarketData.js", import.meta.url), "utf8");
// B1: a failed live fetch is ERROR, and MOCK means exactly one thing — a demo build.
ok("B1: a failed live fetch sets mode ERROR, never the demo's MOCK",
  /mode: "ERROR"/.test(hookSrc) && !/mode: "MOCK", asOf: null, provenance: \{\}, dataAsOf: \{\}, loading: false, liveBuild \}\)/.test(hookSrc));
ok("B1: the hook exposes retry() and it re-arms the full fetch machinery",
  /const retry = \(\) =>/.test(hookSrc) && /setRetryTick\(\(t\) => t \+ 1\)/.test(hookSrc) &&
  /\[mockData, publicView, retryTick\]/.test(hookSrc));
ok("B1: retry resets to LOADING first — no stale ERROR chrome mid-flight, and demo no-ops",
  /if \(!liveBuild\) return;/.test(hookSrc) && /mode: "LOADING", loading: true, lastError: null/.test(hookSrc));
ok("B1: the dashboard renders the outage and a Retry control, not 'demo baseline'",
  /live service unavailable — numbers below are illustrative/.test(dashSrc) &&
  /aria-label="Retry loading live data"/.test(dashSrc));
ok("B1: ERROR wears its own red badge in DataModeBadge",
  /ERROR:\s*\{ label:"⚠ ERROR"/.test(dashSrc));
// B2: fresh ≠ live. The rollup names both parts; the footers derive from state.
ok("B2: Signal Quality counts live and cached separately under a FRESH rollup",
  /if\(m==="LIVE"\)\{a\.fresh\+\+;a\.live\+\+;\}else if\(m==="CACHED"\)\{a\.fresh\+\+;a\.cached\+\+;\}/.test(dashSrc) &&
  /\{sq\.fresh\} fresh/.test(dashSrc) && /\{sq\.live\} live · \{sq\.cached\} cached/.test(dashSrc));
ok("B2: 'derived from live data' is now STATE-derived, one derivation for both footers",
  /const derivedLabel=mode==="LIVE"\?"derived from live data"/.test(dashSrc) &&
  /derived from today's cached snapshot/.test(dashSrc) &&
  /· \{srcLabel\}<\/div>/.test(dashSrc) && /· \{derivedLabel\} \(no LLM\)/.test(dashSrc));
// B3: operational data needs a token; the public route gets a report-only CSP.
const snapSrc2 = readFileSync(new URL("../functions/api/snapshot.js", import.meta.url), "utf8");
ok("B3: ?debug requires the DEBUG_TOKEN secret — fail closed both ways",
  /env\.DEBUG_TOKEN && debugParam && debugParam === env\.DEBUG_TOKEN/.test(snapSrc2) &&
  !/const debug = params\.get\("debug"\) === "1"/.test(snapSrc2));
const mwSrc = readFileSync(new URL("../functions/_middleware.js", import.meta.url), "utf8");
ok("B3: report-only CSP on public routes; /admin.html and /api are deliberately exempt",
  /content-security-policy-report-only/.test(mwSrc) &&
  /cspPath !== "\/admin\.html"/.test(mwSrc) && /!cspPath\.startsWith\("\/api\/"\)/.test(mwSrc));
ok("B3: the CSP is REPORT-ONLY (observe before enforcing), never the enforcing header yet",
  !/h\.set\("content-security-policy",/.test(mwSrc));
// B5: AGENTS.md carries no volatile facts — the rot vector is removed, not re-fed.
const agentsSrc = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
ok("B5: AGENTS.md is a thin pointer — no version numbers, no assertion counts",
  !/v3\.\d+\.\d+/.test(agentsSrc) && !/\d{3}-assertion/.test(agentsSrc) &&
  /CLAUDE\.md wins/.test(agentsSrc) && /npm test/.test(agentsSrc) && /REQUIRE_BROWSER=1/.test(agentsSrc));

// ---- 38. v3.60 P0 sprint — EvidenceSet, What Changed, and the extraction ----
// C1 extracted the regime engine to src/regime.js (imported above, replacing source-lifts)
// and built evidence.js: ONE typed contract components render instead of each interpreting
// provenance on its own. Every interface-contract state is EXECUTED here.
console.log("\n[38] v3.60 — the EvidenceSet contract and the return-visit digest");
const NOW = new Date("2026-08-01T12:00:00-04:00");
const FRESH_PROV = Object.fromEntries(
  ["tenYear", "vix", "fearGreed", "cpiHeadline", "shillerPe", "nfci"].map((k) => [k, "LIVE"]));
const FRESH_ASOF = Object.fromEntries(
  ["tenYear", "vix", "fearGreed", "cpiHeadline", "shillerPe", "nfci"].map((k) => [k, "2026-08-01"]));
const ev = (o = {}) => buildEvidenceSet({ d: MOCK_DATA, provenance: FRESH_PROV,
  dataAsOf: FRESH_ASOF, mode: "LIVE", liveBuild: true, now: NOW, ...o });
// State machine — one assertion per contract row.
ok("evidence: LIVE — full fresh inputs publish a posture with all six voting",
  (() => { const e = ev(); return e.state === "LIVE" && !e.withheld && e.counted === 6 &&
    ["RISK-ON", "RISK-OFF", "MIXED"].includes(e.regime.label) && e.flips !== null; })());
ok("evidence: CACHED is its own state — publishable, but never labelled live (B2's rule)",
  ev({ mode: "CACHED" }).state === "CACHED" && !ev({ mode: "CACHED" }).withheld);
ok("evidence: LOADING withholds — no posture, no flips, nothing to narrate",
  (() => { const e = ev({ mode: "LOADING", provenance: {}, dataAsOf: {} });
    return e.state === "LOADING" && e.withheld && e.flips === null; })());
ok("evidence: ERROR withholds identically (B1's mode reaches the contract)",
  ev({ mode: "ERROR", provenance: {}, dataAsOf: {} }).state === "ERROR" &&
  ev({ mode: "ERROR", provenance: {}, dataAsOf: {} }).withheld);
ok("evidence: DEGRADED — quorate with exclusions publishes AND names the excluded",
  (() => { const p = { ...FRESH_PROV }; delete p.vix; // vix mock in a live build
    const e = ev({ provenance: p });
    return e.state === "DEGRADED" && !e.withheld && e.counted === 5 &&
      e.excludedKeys.includes("VIX") &&
      e.factors.find((f) => f.key === "vix").reason === "not live in a live build"; })());
ok("evidence: INSUFFICIENT below the 4-of-6 quorum — withheld with the count stated",
  (() => { const e = ev({ provenance: { tenYear: "LIVE", vix: "LIVE" },
    dataAsOf: { tenYear: "2026-08-01", vix: "2026-08-01" } });
    return e.state === "INSUFFICIENT" && e.withheld && e.counted === 2 &&
      e.freshSummary === "2/6 factors usable"; })());
ok("evidence: DEMO — a mock build keeps its posture (mock IS that baseline)",
  (() => { const e = ev({ mode: "MOCK", liveBuild: false, provenance: {}, dataAsOf: {} });
    return e.state === "DEMO" && !e.withheld && e.counted === 6; })());
// The factors carry the full honesty payload.
ok("evidence: every factor row carries vote, mode, as-of and display copy",
  ev().factors.every((f) => ["bull", "bear", "neutral", "excluded"].includes(f.vote) &&
    f.mode && f.display && f.asOf === "2026-08-01") && ev().factors.length === 6);
ok("evidence: a STALE factor's reason says stale-for-cadence, not the live-build wording",
  (() => { const e = ev({ dataAsOf: { ...FRESH_ASOF, vix: "2026-01-02" } });
    return e.factors.find((f) => f.key === "vix").reason === "stale for its cadence"; })());
ok("evidence: the factor VOTE comes from the band table itself — spot-check NFCI neutral",
  (() => { const f = ev().factors.find((x) => x.key === "nfci");
    // mock NFCI is -0.42: inside the deadband, so neutral (v3.43.1's abstaining demo value)
    return f.vote === "neutral"; })());
// ---- whatChanged: the return-visit digest ----
ok("changed: a withheld or demo set can never become a baseline",
  summarizeEvidence(ev({ mode: "LOADING", provenance: {}, dataAsOf: {} })) === null &&
  summarizeEvidence(ev({ mode: "MOCK", liveBuild: false, provenance: {}, dataAsOf: {} })) === null);
const sumA = summarizeEvidence(ev(), "2026-07-31T20:00:00Z");
ok("changed: a quorate live set summarizes to the versioned persisted shape",
  sumA && sumA.v === 1 && sumA.posture === ev().regime.label &&
  Object.keys(sumA.factors).length === 6);
ok("changed: first visit is 'baseline set', never 'nothing changed' — different facts",
  (() => { const c = compareEvidence(null, sumA); return c.baseline === true && c.changes.length === 0; })());
ok("changed: a garbled or wrong-version baseline fails toward 'baseline set', never a fake diff",
  compareEvidence({ v: 99 }, sumA).baseline === true &&
  compareEvidence({ hello: "world" }, sumA).baseline === true);
ok("changed: identical snapshots read 'no material change' explicitly (empty changes, not null)",
  (() => { const c = compareEvidence(sumA, { ...sumA, at: "2026-08-01T20:00:00Z" });
    return c.baseline === false && c.changes.length === 0 && c.since === sumA.at; })());
ok("changed: a posture flip, a confidence move and a factor drop-out are each named",
  (() => { const cur = JSON.parse(JSON.stringify(sumA));
    cur.posture = cur.posture === "MIXED" ? "RISK-ON" : "MIXED";
    cur.counted = 5; cur.factors.vix = { vote: "excluded", mode: "MOCK" };
    const c = compareEvidence(sumA, cur);
    return c.changes.some((x) => x.kind === "posture") &&
      c.changes.some((x) => x.kind === "confidence") &&
      c.changes.some((x) => x.kind === "vote" && /dropped out/.test(x.text)); })());
ok("changed: a factor RECOVERY is information too, named as such",
  (() => { const prev = JSON.parse(JSON.stringify(sumA));
    prev.factors.vix = { vote: "excluded", mode: "MOCK" };
    const c = compareEvidence(prev, sumA);
    return c.changes.some((x) => x.kind === "vote" && /recovered/.test(x.text)); })());
// ---- the extraction is wired, not duplicated ----
const evidenceSrc = readFileSync(new URL("../src/evidence.js", import.meta.url), "utf8");
ok("C1: evidence.js WRAPS the engine — it imports regime.js, never restates a band",
  /from "\.\/regime\.js"/.test(evidenceSrc) && !/v < 18|v > 25|<= NFCI_LOOSE \?/.test(evidenceSrc));
ok("C1: the dashboard's modeOf and exclusions ARE the shared derivations (no local copy)",
  dashSrc.includes("const modeOf=(k)=>fieldMode(provenance, dataAsOf, k);") &&
  dashSrc.includes("const staleFactors=factorExclusions({provenance, dataAsOf, liveBuild});") &&
  !dashSrc.includes('const unusable=(k)=>'));
ok("C2: a real <header> landmark, a Sections <nav>, and the six-anchor h2 outline exist",
  /<header style=/.test(dashSrc) && /<nav aria-label="Sections"/.test(dashSrc) &&
  ["overview", "drivers", "markets", "macro", "ai", "health"].every((id) =>
    dashSrc.includes(`id="${id}"`)));
ok("C3: the Drivers matrix renders the CONTRACT (evidenceSet.factors), not its own reading",
  dashSrc.includes("evidenceSet.factors.map(f=>") && dashSrc.includes("excluded — {f.reason}"));
ok("C4: the digest persists AFTER comparing, and only quorate sets become the baseline",
  dashSrc.indexOf("compareEvidence(prev,cur)") < dashSrc.indexOf("localStorage.setItem(LASTVALID_KEY") &&
  // v3.61 (newcomer audit): the copy states the localStorage device scope explicitly.
  dashSrc.includes("baseline set — tracking starts today on this device") &&
  dashSrc.includes("no material change since your previous visit on this device"));

// ---- 39. v3.61 FEAT-GLANCE — safe-area + first-glance density + newcomer fixes ----
console.log("\n[41] v3.61 — safe-area, first-glance density, newcomer-audit fixes");
// F1: index.html has shipped viewport-fit=cover + black-translucent since v1 — the page is
// deliberately drawn BEHIND the iOS status bar — but env(safe-area-inset-*) existed nowhere,
// so the wordmark rendered under the Dynamic Island. The comment at index.html:5 claimed
// safe-area handling; these pins make the claim true and keep it true.
const indexSrc = readFileSync(new URL("../index.html", import.meta.url), "utf8");
ok("glance: index.html still ships viewport-fit=cover (the env() half depends on it)",
  /viewport-fit=cover/.test(indexSrc));
ok("glance: the header pads for the island — calc(8px + env(safe-area-inset-top))",
  dashSrc.includes('padding:"calc(8px + env(safe-area-inset-top)) 20px 8px"'));
ok("glance: the sticky nav offsets below the island with an opaque scrim over the strip " +
   "(padding the nav instead would render a permanent inset-height band when not stuck)",
  dashSrc.includes('top:"env(safe-area-inset-top)"') &&
  dashSrc.includes('height:"env(safe-area-inset-top)"'));
ok("glance: landscape notch edges — root pads left/right insets",
  dashSrc.includes('paddingLeft:"env(safe-area-inset-left)"') &&
  dashSrc.includes('paddingRight:"env(safe-area-inset-right)"'));
// F2: the two big v3.60 diagnostic blocks collapse behind the FEAT-321 idiom. chip={false}
// both times — live evidence, not curated content.
ok("glance: the Drivers matrix cards collapse (band chips are the icon-first six-factor view)",
  /label="factor evidence detail" chip=\{false\}/.test(dashSrc));
ok("glance: the Data Health per-source grid collapses; the ERROR/Retry row stays OUTSIDE",
  /label="per-source detail" chip=\{false\}/.test(dashSrc) &&
  dashSrc.indexOf('mode==="ERROR"&&<div style={{fontFamily:T.fontMono,fontSize:9,color:T.red') <
  dashSrc.indexOf('label="per-source detail"'));
ok("glance: the decode legend moved INTO the Data Health expander — the always-visible strip " +
   "no longer carries explanation, only evidence",
  dashSrc.includes("legend: ● live · ⏱ stale ·") &&
  !/marginLeft:"auto"\}\}>● live · ⏱ stale ·/.test(dashSrc));
ok("glance: the 30Y tile note keeps the FACT (spread + INVERTED) and moves the reference " +
   "prose to a tooltip — a red fact must survive the default view",
  dashSrc.includes('noteTitle={"5.00% = the 2007 pre-GFC reference level"}') &&
  /title=\{noteTitle\|\|undefined\}/.test(dashSrc));
// F2b-1 (behavioral, real import): the verdict sub must never name an excluded factor.
const subFix = (fg, cpiLast) => ({
  crossAsset: { treasury10y: { m1: -0.2 } },
  marketPulse: { vix: { current: 17.09 }, fearGreed: { score: fg } },
  macro: { cpi: { trend: [3.2, 3.1, 3.0, 2.9, 2.8, cpiLast] },
    shillerPe: { current: 24, mean: 17.6, ath: 44.19 }, nfci: { current: -0.42 } },
});
ok("glance: MIXED with VIX voting keeps the canonical 'watch VIX' sub",
  regimeCompute(subFix(42, 2.9), new Set()).sub === "Cross-signals — watch VIX");
ok("glance: MIXED with VIX excluded re-derives the watch from the NEAREST load-bearing flip",
  (() => { const r = regimeCompute(subFix(50, 2.9), new Set(["vix"]));
    return r.label === "MIXED" && !r.sub.includes("VIX") && /watch (NFCI|F&G|10Y)/.test(r.sub); })());
ok("glance: MIXED with VIX excluded and NO load-bearing flip states the evidence base instead",
  (() => { // deep-MIXED shape (2 bull / 1 bear / 2 neutral of 5): no single crossing flips it
    const d = { crossAsset: { treasury10y: { m1: 0.05 } },
      marketPulse: { vix: { current: 17.09 }, fearGreed: { score: 42 } },
      macro: { cpi: { trend: [3.2, 3.1, 3.0, 2.9, 2.8, 2.7] },
        shillerPe: { current: 40.91, mean: 17.6, ath: 44.19 }, nfci: { current: -0.42 } } };
    const r = regimeCompute(d, new Set(["vix"]));
    return r.label === "MIXED" && r.sub === "Cross-signals — 5 of 6 inputs usable"; })());
// F2b-2: the neutral vote is stated, not implicit.
ok("glance: the vote line accounts for every counted vote — bull · neutral · bear of usable",
  /\$\{regime\.bullVotes\} bull · \$\{neutralVotes\} neutral · \$\{regime\.bearVotes\} bear — \$\{regime\.counted\} of \$\{regime\.totalFactors\} usable/.test(dashSrc));
// F3a: the terminal gets the same treatment — inside the installed PWA shell admin.html
// renders fullscreen too, and it had ZERO safe-area handling.
ok("tt-glance: admin viewport gains viewport-fit=cover",
  /viewport-fit=cover/.test(adminSrc));
ok("tt-glance: .wrap pads top+bottom insets; .toast clears the home-indicator strip",
  /\.wrap\{[^}]*calc\(14px \+ env\(safe-area-inset-top\)\)/s.test(adminSrc) &&
  /calc\(60px \+ env\(safe-area-inset-bottom\)\)/.test(adminSrc) &&
  /\.toast\{position:fixed;bottom:calc\(18px \+ env\(safe-area-inset-bottom\)\)/.test(adminSrc));
ok("tt-glance: the modal overlay clears both edges",
  /\.overlay\{[^}]*calc\(32px \+ env\(safe-area-inset-top\)\) 16px calc\(32px \+ env\(safe-area-inset-bottom\)\)/s.test(adminSrc));
// F3b: the SELL methodology moved behind an est-mini (NEVER drawer — the phone harness
// counts open drawers), stated once instead of repeated per row; the strings survive.
ok("tt-glance: the SELL expander is est-mini and the methodology is stated ONCE, not per row",
  /details class="est-mini"><summary><span class="scope">how this list is ranked<\/span>/.test(adminSrc) &&
  adminSrc.includes("shares: lowest expected return funds first · options: ranked on realisable dollars — a leg's return is not the underlying's") &&
  !/fdr-d"><span class="scope">\$\{optRow\s*\?"ranked on realisable dollars/.test(adminSrc));
ok("tt-glance: the unranked count rides the closed summary — no silent truncation",
  /\(unrankedN\?`<span style="color:var\(--amber\)">○ \$\{unrankedN\} unranked<\/span>`:""\)/.test(adminSrc));
ok("tt-glance: the board heading is chip-length; the coaching line lives in the aside",
  adminSrc.includes("<h2 style=\"margin-top:14px\">THE BOOK</h2>") &&
  adminSrc.includes("click any ticker chip to open its TT Card"));
// F2b-3: operator tooling off the public route (the A4 pattern).
ok("glance: the TT copy button and the FIRED/BLIND alert badges gate on !publicView",
  // v3.62: TT and TERMINAL now live inside the ⋯ OPS disclosure, so the gate moved OUT to the
  // <details> that wraps them — the contract ("a visitor never sees operator tooling") is
  // measured by checking the menu is gated AND that both actions are genuinely inside it,
  // rather than pinning the old adjacency of one button to one `!publicView`.
  (() => {
    const open = dashSrc.indexOf('<details className="hdr-ops"');
    const close = dashSrc.indexOf("</details>", open);
    if (open < 0 || close < 0) return false;
    const menu = dashSrc.slice(open, close);
    return /\{!publicView&&\(\s*\n?\s*<details className="hdr-ops"/.test(dashSrc) &&
      menu.includes("onClick={handleTtCopy}") && menu.includes('href="/admin.html"');
  })() &&
  /\{!publicView&&activeAlerts>0&&<Badge/.test(dashSrc) &&
  /\{!publicView&&activeAlerts===0&&alertBlind>0&&<Badge/.test(dashSrc));
// v3.62: a FIRED/BLIND badge is a red fact — the v3.25 rule (a collapse never hides one) means
// the alert badges must stay OUTSIDE the disclosure even though they are also operator-only.
ok("the OPS menu does not swallow the alert badges — a red fact stays visible while closed",
  (() => {
    const open = dashSrc.indexOf('<details className="hdr-ops"');
    const close = dashSrc.indexOf("</details>", open);
    const menu = open < 0 ? "" : dashSrc.slice(open, close);
    return menu.length > 0 && !menu.includes("activeAlerts") && !menu.includes("alertBlind");
  })());

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[42] FEAT-TT-DECK — mobile decision views and the shareable ranking artifact");
ok("tt-deck: SHARE RANKS is a first-row action, not buried under MENU → MANAGE",
  /<div class="hbar">[\s\S]*class="hb-ranks" onclick="exportRankings\(\)"[\s\S]*class="hb-more"/.test(adminSrc) &&
  (adminSrc.match(/onclick="exportRankings\(\)"/g) || []).length === 1);
ok("tt-deck: the promoted action names the decision logic carried by the export",
  /aria-label="Share ticker rankings and decision logic"/.test(adminSrc) &&
  /Share rankings, funding priority, methodology and caveats/.test(adminSrc));
ok("tt-deck: BUY and FUND are two labelled tab panels — swipe is optional, never the only control",
  /role="tablist" aria-label="Daily capital allocation views"/.test(adminSrc) &&
  /id="decisionBuy" role="tabpanel"/.test(adminSrc) &&
  /id="decisionFund" role="tabpanel"/.test(adminSrc) &&
  /onclick="decisionGo\(0\)"/.test(adminSrc) && /onclick="decisionGo\(1\)"/.test(adminSrc));
ok("tt-deck: phone layout uses horizontal scroll snap and a viewport-height focus panel",
  /scroll-snap-type:x mandatory/.test(adminSrc) &&
  /scroll-snap-align:start/.test(adminSrc) &&
  /height:max\(520px,calc\(100svh - 220px\)\)/.test(adminSrc));
ok("tt-deck: keyboard arrows switch the same two views and reduced motion is respected",
  /function decisionKey\(e,i\)/.test(adminSrc) &&
  /prefers-reduced-motion: reduce/.test(adminSrc) &&
  /setDecisionTab\(Math\.max/.test(adminSrc) &&
  /toggleAttribute\("inert",compact&&n!==i\)/.test(adminSrc));
ok("tt-deck: forced trims stay visible; only the lower-priority funding tail collapses",
  adminSrc.indexOf("s.forced.forEach") < adminSrc.indexOf("const FUNDING_VISIBLE=5") &&
  /\+\$\{s\.disc\.length-FUNDING_VISIBLE\} lower-priority funding sources/.test(adminSrc));
ok("tt-deck: the second view is honestly FUND / TRIM, never a fabricated HOLD recommendation",
  adminSrc.includes('>FUND / TRIM<span id="fundTabCount"></span></button>') &&
  !/NEXT DOLLAR[^<]{0,20}HOLD/.test(adminSrc));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[43] FEAT-TT-DECK follow-up — the forced-trim count, H1 2026-08-03");
// H5 (fresh session) found the deck hid a forced cap trim — a rule already broken — behind
// an inert panel with nothing on the closed tab naming it, a v3.25 violation. H1 planned the
// fix as a red count on FUND / TRIM, never an auto-open (owner call). These pin the SOURCE
// contract; test/render.mjs proves the four label states and the real-scroll/click paths
// behaviorally (R1-R7 in the H1 plan, harness/H1-tt-deck-forced-count-2026-08-03.md).
ok("tt-deck-forced: the tab carries a dedicated count span, not a full-button text overwrite",
  /<span id="fundTabCount"><\/span>/.test(adminSrc));
ok("tt-deck-forced: SELL_FORCED_N is reset before sellRank() runs — an early return can never leave yesterday's count (the AGREE_PICK precedent)",
  (() => {
    const body = adminSrc.match(/function renderSellBlock\(\)\{([\s\S]*?)\n\}/)?.[1] || "";
    const reset = body.indexOf("SELL_FORCED_N=null;");
    const compute = body.indexOf("const s=sellRank();");
    return reset >= 0 && compute >= 0 && reset < compute &&
      /if\(s\)SELL_FORCED_N=s\.forced\.length;/.test(body);
  })());
ok("tt-deck-forced: the label reads SELL_FORCED_N directly — it recomputes neither CAP_PCT nor capChecks()",
  (() => {
    const m = adminSrc.match(/function renderDecisionFundLabel\(\)\{[\s\S]*?\n\}/);
    return !!m && m[0].includes("SELL_FORCED_N") &&
      !m[0].includes("CAP_PCT") && !m[0].includes("capChecks(");
  })());
ok("tt-deck-forced: sellRank() is still CALLED exactly twice (renderSellBlock + the rankings export) — the tab adds no third pass",
  (adminSrc.match(/=\s*sellRank\s*\(\s*\)\s*;/g) || []).length === 2 &&
  !/\bsellRank\s*\(/.test(adminSrc.slice(adminSrc.indexOf("function renderDecisionFundLabel"),
    adminSrc.indexOf("function renderSellBlock"))));
ok("tt-deck-forced: the four states are distinct strings — pending, unmeasured, checked-clear and forced never collapse into each other",
  /line\("· …","var\(--dim\)"\)/.test(adminSrc) &&
  /line\("· \?","var\(--amber\)"\)/.test(adminSrc) &&
  /line\(`· \$\{SELL_FORCED_N\} FORCED`,"var\(--red\)",true\)/.test(adminSrc) &&
  /c\.innerHTML="";/.test(adminSrc));
ok("tt-deck-forced: the panel never auto-opens off the forced count — no decisionGo() call reads SELL_FORCED_N",
  !/decisionGo\([^)]*\).*SELL_FORCED_N|SELL_FORCED_N[\s\S]{0,80}decisionGo\(/.test(adminSrc));
// v3.67: sizeDecisionDeck() is the 6th home — it MUST mirror the deck media query (same as
// setDecisionTab already does) or the height override would apply on the stacked desktop
// layout. The deferral still holds: no new breakpoint VALUE, one more reader of the same one.
ok("tt-deck-forced: the 700px breakpoint deferral (H1 §3) holds — exactly 6 homes, all the same value",
  (adminSrc.match(/700px/g) || []).length === 6);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[39] CI-FIX — the browser suites must not read a PRESENT browser as absent");
// WHY THIS SECTION EXISTS: the repo's first CI run (v3.60) failed on a browser that had
// just downloaded successfully. findChromium() hardcoded playwright's PRE-Chrome-for-Testing
// directory layout, so on linux-x64 the real binary at chrome-linux64/chrome was invisible —
// and under REQUIRE_BROWSER=1 that reported a MISSING browser, the exact inverse of the
// failure A3 (v3.58) added the flag to catch. A false skip reads as a passed gate; a false
// failure blocks the gate entirely. Both are the same defect: a hardcoded copy of someone
// else's layout, drifting. These pins are the same rule the app applies to itself.
// renderSrc is already read above (section [21]); only the public suite is new here.
const publicSrc = readFileSync(new URL("./public-render.mjs", import.meta.url), "utf8");
for (const [label, src] of [["render.mjs", renderSrc], ["public-render.mjs", publicSrc]]) {
  ok(`${label}: consults playwright's OWN registry first (immune to the next rename)`,
    /chromium\.executablePath\(\)/.test(src));
  ok(`${label}: the computed path is existence-checked, never trusted blindly`,
    /const p = chromium\.executablePath\(\);\s*\n\s*if \(p && existsSync\(p\)\)/.test(src));
  // The CfT x64 layout is the one CI actually runs on — its absence WAS the outage.
  ok(`${label}: searches the Chrome-for-Testing linux-x64 layout (the CI bug)`,
    src.includes("chrome-linux64/chrome"));
  // The pre-CfT names still ship for linux-arm64 and older pinned images; dropping them
  // would just move the false skip to a different machine.
  ok(`${label}: still searches the pre-CfT layout (linux-arm64 + pinned images)`,
    src.includes("chrome-linux/chrome"));
  ok(`${label}: searches both Chrome-for-Testing macOS layouts (a dev machine is a gate too)`,
    src.includes("chrome-mac-arm64/Google Chrome for Testing.app") &&
    src.includes("chrome-mac-x64/Google Chrome for Testing.app"));
  ok(`${label}: REQUIRE_BROWSER=1 still turns a genuinely missing browser into a FAILURE`,
    /REQUIRE_BROWSER === "1"/.test(src) && /process\.exit\(1\)/.test(src));
  ok(`${label}: a bare machine still SKIPS cleanly — this suite stays additive`,
    /process\.exit\(0\)/.test(src));
}
// The list is only correct if it matches what playwright-core actually ships TODAY. Read its
// own EXECUTABLE_PATHS table and assert every chromium layout it declares is searchable —
// a string pin cannot notice a NEW platform being added, but this can.
// Scoped to the CHROMIUM_RELS ARRAY, not the whole file: matching anywhere would let the
// prose comment above satisfy the check while the actual entry was gone — a pin that passes
// on the strength of its own documentation is the vacuous-assert defect this repo keeps
// finding (v3.54's "read-only by design" pin that passed while the route wrote).
const relsArray = (src) => {
  const i = src.indexOf("const CHROMIUM_RELS = [");
  return i < 0 ? "" : src.slice(i, src.indexOf("];", i));
};
ok("the search list covers every chromium layout playwright-core currently declares",
  (() => {
    let bundle;
    try {
      bundle = readFileSync(new URL("../node_modules/playwright-core/lib/coreBundle.js",
        import.meta.url), "utf8");
    } catch (_e) { return true; } // dependency absent (bare checkout) — nothing to reconcile
    const i = bundle.indexOf("EXECUTABLE_PATHS = {");
    if (i < 0) return true;      // playwright restructured; the pins above still stand
    const chromiumBlock = bundle.slice(i, bundle.indexOf('"chromium-headless-shell"', i));
    // Each entry looks like: "linux-x64": ["chrome-linux64", "chrome"]
    const dirs = [...chromiumBlock.matchAll(/"(?:linux|mac|win)-[a-z0-9]+":\s*\[([^\]]+)\]/g)]
      .map((m) => m[1].split(",")[0].trim().replace(/"/g, ""));
    const rels = [relsArray(renderSrc), relsArray(publicSrc)];
    return dirs.length > 0 && rels.every(Boolean) &&
      dirs.every((d) => rels.every((r) => r.includes(d)));
  })());

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[40] Doc drift — no volatile facts outside their one home");
// The 2026-08-02 audit §5 found README.md asserting a version ~52 point releases stale, an
// assertion count off by hundreds, and a `test` script that had existed for releases as
// absent; CLAUDE.md's own status header was frozen ~58 releases back. This is precisely the
// "label outliving its data" defect the app's changelog keeps fixing INSIDE the product
// (the Mag-10 footer, the "5-factor vote" strings, the Kalshi TODO comment). v3.59 already
// applied the cure to AGENTS.md and pinned its shape; these pins extend it to the rest.
const readmeSrc = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const handoffSrc = readFileSync(new URL("../HANDOFF.md", import.meta.url), "utf8");
const pkgVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
ok("package.json still carries the version — the single source of truth",
  typeof pkgVersion === "string" && /^\d+\.\d+\.\d+$/.test(pkgVersion));
ok("README does not restate a version number (it rots; package.json is the home)",
  !/Current version:\s*\d+\.\d+\.\d+/.test(readmeSrc));
ok("README does not quote an assertion count (the suite prints its own total)",
  !/\d{3,}[- ]assertion/.test(readmeSrc));
// The false claim actively misdirected contributors to the wrong command for many releases.
ok("README does not claim the `test` script is missing — it exists",
  !/no `test` script/.test(readmeSrc) && /npm test/.test(readmeSrc));
const claudeSrc = readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8");
ok("CLAUDE.md does not claim the `test` script is missing either",
  !/no `test` script in `package\.json`/.test(claudeSrc));
ok("CLAUDE.md's status header no longer pins a hand-bumped version",
  !/\*\*Status: v\d+\.\d+\.\d+/.test(claudeSrc));
ok("HANDOFF.md declares itself a dated ARCHIVE, so it cannot read as current state",
  /ARCHIVE/.test(handoffSrc) && /NOT current state/i.test(handoffSrc) &&
  /`CLAUDE\.md` is canonical/i.test(handoffSrc));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[42] FEAT-NEUTRAL — a neutral factor must never render as bearish");
// WHY THIS SECTION EXISTS: regimeFactors() predated REGIME_BAND_TABLE and was never migrated,
// so each row carried a hand-written boolean `bull` duplicating the table's BULL edge with NO
// copy of the BEAR edge. RegimeBand branched on that boolean, so red ▼ was the fallthrough and
// EVERY neutral factor rendered bearish — while the line directly above printed "N neutral"
// and the Drivers matrix showed the same factor as grey NEUTRAL. `regimeFactors` was imported
// into this file as `regimeFactorRows` and NEVER CALLED, which is how it went unnoticed.
const neutralD = {
  crossAsset:{ treasury10y:{ m1:0.0 } },                                  // inside [-0.10, 0.15]
  marketPulse:{ vix:{ current:21 }, fearGreed:{ score:42, label:"Fear" } },// 18–25 and 30–55
  macro:{ cpi:{ trend:[3.0,2.9,2.8] },                                    // cooling → bull
    shillerPe:{ current:40.91, mean:17.6, ath:44.19, pctOfAth:92.6 },     // >30 → bear
    nfci:{ current:-0.55 } },                                            // ≤ -0.5 → bull
};
const nRows = regimeFactorRows(neutralD);
const rowOf = (k) => nRows.find((r) => r.key === k);
ok("every row carries a 4-state vote, never a bear/neutral-collapsing boolean",
  nRows.length === 6 && nRows.every((r) => ["bull","bear","neutral","excluded"].includes(r.vote)) &&
  nRows.every((r) => !("bull" in r)));
ok("a factor in its neutral zone votes NEUTRAL (F&G 42 — the audit's live case)",
  rowOf("fearGreed").vote === "neutral" && rowOf("vix").vote === "neutral" &&
  rowOf("tenYear").vote === "neutral");
ok("neutral is visually DISTINCT from bear — the defect, stated as a test",
  voteStyle("neutral").glyph !== voteStyle("bear").glyph &&
  voteStyle("neutral").colorKey !== voteStyle("bear").colorKey);
ok("a genuinely bearish factor still reads bearish (no over-correction)",
  rowOf("valuation").vote === "bear" && voteStyle("bear").glyph === "▼");
ok("the row vote matches the vote computeRegime actually counted — one derivation",
  (() => { const r = regimeCompute(neutralD);
    const bulls = nRows.filter((x) => x.vote === "bull").length;
    const bears = nRows.filter((x) => x.vote === "bear").length;
    return r.bullVotes === bulls && r.bearVotes === bears && r.counted === 6; })());
ok("EXCLUDED wins over the band vote — a factor that is not counted reports no lean",
  (() => { const ex = regimeFactorRows(neutralD, new Set(["valuation"]));
    const v = ex.find((r) => r.key === "valuation");
    return v.vote === "excluded" && v.stale === true && /STALE — excluded/.test(v.val); })());
ok("a non-finite reading votes NEUTRAL, not a confident bearish chip",
  (() => { const bad = JSON.parse(JSON.stringify(neutralD));
    bad.marketPulse.vix.current = NaN;
    return regimeFactorRows(bad).find((r) => r.key === "vix").vote === "neutral"; })());
// The whole point of the shared map: the two altitudes cannot resolve a vote differently.
ok("BOTH altitudes resolve appearance through the ONE voteStyle map (hero + Drivers matrix)",
  dashSrc.includes("const vs=voteStyle(f.vote)") &&
  dashSrc.includes("const vc=T[voteStyle(f.vote).colorKey]") &&
  !/f\.vote==="bull"\?T\.green/.test(dashSrc));
ok("regimeFactors derives its vote from the band table, keeping no second copy of a threshold",
  regimeSrc.includes("band.vote(band.read(d), d)") &&
  !/bull:d\.marketPulse\.vix\.current<18/.test(regimeSrc) &&
  !/bull:d\.marketPulse\.fearGreed\.score>55/.test(regimeSrc));
ok("evidence.js consumes that vote rather than re-deriving it from the bands",
  evidenceSrc.includes("vote: f.vote") && !evidenceSrc.includes("band.vote(band.read(d), d)"));

// ═══════════ [44] ACTIONABILITY GATE — the deferred ENGINE0-CONT limit, closed ═══════════
// CLAUDE.md named this exactly: readout.json publishes a two-axis contract (verdict = which
// way, actionability = may this gate capital), and the pill correctly renders both — but
// gateFail (the ELIGIBLE NEXT DOLLAR veto ladder) read only regime.verdict. A <3-usable or
// degraded day publishes NEUTRAL, which IS ranked in REG_RANK -> ADDS OK, so the green line
// could light directly under a pill reading "HOLD"/"RESTRICTED". Sliced and RUN against the
// live ternary text, not string-pinned — a defect exactly this shape (state computed and
// rendered but not read at the gate) is the project's own recurring lesson (v3.40, v3.54).
console.log("\n[44] ACTIONABILITY GATE — a degraded/HOLD regime must veto ELIGIBLE, not just discolor the pill");
const GF = (() => {
  const a = adminSrc.indexOf("const stc=stance();");
  const b = adminSrc.indexOf('mf.tripped?"Macro Flip TRIPPED — de-risk, no adds":null;') +
    'mf.tripped?"Macro Flip TRIPPED — de-risk, no adds":null;'.length;
  if (a < 0 || b < 0) throw new Error("smoke: gateFail markers not found");
  return new Function("stance", "REGIME", adminSrc.slice(a, b) + "\nreturn gateFail;");
})();
const stcOk = () => ({ k: "ok" });
const fullClear = { regime: { verdict: "TAILWIND", actionability: "FULL" },
  macro_flip: { evaluable: true, tripped: false } };
ok("gate: FULL actionability + clear flip -> no veto (the ordinary case is untouched)",
  GF(stcOk, fullClear) === null);
const holdDegraded = { regime: { verdict: "NEUTRAL", actionability: "HOLD", status: "DATA DEGRADED" },
  macro_flip: { evaluable: true, tripped: false } };
ok("gate: NEUTRAL + actionability HOLD vetoes even though NEUTRAL alone would rank as ADDS OK",
  /regime actionability HOLD/.test(GF(stcOk, holdDegraded)) &&
  /DATA DEGRADED/.test(GF(stcOk, holdDegraded)));
const restricted = { regime: { verdict: "TAILWIND", actionability: "RESTRICTED" },
  macro_flip: { evaluable: true, tripped: false } };
ok("gate: RESTRICTED vetoes too, and a TAILWIND verdict does not mask it",
  /regime actionability RESTRICTED/.test(GF(stcOk, restricted)));
ok("gate: absent actionability field (legacy/cached tt-v1 body) does not falsely veto",
  GF(stcOk, { regime: { verdict: "TAILWIND" }, macro_flip: { evaluable: true, tripped: false } }) === null);
ok("gate: a tripped flip still vetoes on its own message even at FULL actionability (unchanged)",
  /Macro Flip TRIPPED/.test(GF(stcOk, { regime: { verdict: "TAILWIND", actionability: "FULL" },
    macro_flip: { evaluable: true, tripped: true } })));
ok("gate: an unreadable feed still vetoes before actionability is even inspected (unchanged)",
  /regime feed unavailable/.test(GF(stcOk, null)));

// ═══════════ [49] PT-CHAIN BYTE-IDENTITY TRIPWIRE (TT-SCORE commit 1, v3.73) ═══════════
// src/ptModel.js extracted the PT chain so the scorer can run it server-side. admin.html is
// buildless and keeps its OWN copies — a second copy of order-gating math is exactly the drift
// this repo keeps paying for (v3.41 DERIV-OWN, v3.49 FIX-E), so the copies are pinned to each
// other: lift each function's source out of admin.html and assert it is byte-identical to the
// module export's own source. A change to either side alone goes red here.
console.log("\n[49] ptModel extraction — admin.html and src/ptModel.js cannot drift");
{
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  for (const n of ["schedAt", "ptModelRows", "ptRowYears", "lintPtModel",
                   "yrsToYearEnd", "annualise", "pickRow"])
    ok(`tripwire: ${n}() is byte-identical in admin.html and src/ptModel.js`,
      norm(liftFns(adminSrc, [n])) === norm(PT[n].toString()));
  ok("tripwire: ANN_MIN_Y matches across both copies",
    +/const ANN_MIN_Y=([\d.]+);/.exec(adminSrc)[1] === PT.ANN_MIN_Y);
  ok("tripwire: the module is genuinely clock-injectable (Dec instant rolls, July instant holds)",
    PT.pickRow([{y:"2030"},{y:"2031"}], null, Date.parse("2030-12-15T00:00:00Z")).rolled === "2030" &&
    PT.pickRow([{y:"2030"},{y:"2031"}], null, Date.parse("2030-06-15T00:00:00Z")).rolled === null);
}

// ═══════════ [45] TT UNDERWRITING ENGINE (tt-underwriting-v2.3.0, commit 2) ═══════════
// The engine is a real module — imported and RUN (the regime.js doctrine). Anchors, tier
// boundaries, hashing and precedence are all order-gating math once activated; every
// boundary is executed at −ε / boundary / +ε per the spec's own §16.
console.log("\n[45] ttScore engine — piecewise, tiers, freshness, hashing");
const TS = await import("../src/ttScore.js");
const TSREG = await import("../src/ttScoreRegistry.js");
{
  const A = TS.ANCHORS.P1_RETURN;
  ok("piecewise: exact anchors return exact scores", TS.piecewise(-30, A) === 0 && TS.piecewise(0, A) === 3 &&
    TS.piecewise(25, A) === 7 && TS.piecewise(100, A) === 10);
  ok("piecewise: below-minimum clamps to first, above-maximum to last",
    TS.piecewise(-99, A) === 0 && TS.piecewise(250, A) === 10);
  ok("piecewise: midpoint interpolates linearly", TS.piecewise(37.5, A) === 8);
  ok("piecewise: NaN and Infinity are null, never a number", TS.piecewise(NaN, A) === null && TS.piecewise(Infinity, A) === 10 === false || TS.piecewise(NaN, A) === null);
  ok("tiers: exact S/A/B/C boundaries (8.50/7.00/5.50 inclusive on the upper side)",
    TS.rawTierFrom(8.5) === "S" && TS.rawTierFrom(8.49) === "A" && TS.rawTierFrom(7.0) === "A" &&
    TS.rawTierFrom(6.99) === "B" && TS.rawTierFrom(5.5) === "B" && TS.rawTierFrom(5.49) === "C" && TS.rawTierFrom(NaN) === null);
  ok("freshness: CURRENT<=cadence, AGING<=2x, STALE beyond, INVALID on future/missing",
    TS.freshnessOf("2026-08-01", 4, "2026-08-05") === "CURRENT" &&
    TS.freshnessOf("2026-07-31", 4, "2026-08-05") === "AGING" &&
    TS.freshnessOf("2026-07-27", 4, "2026-08-05") === "STALE" &&
    TS.freshnessOf("2026-08-06", 4, "2026-08-05") === "INVALID" && TS.freshnessOf(null, 4, "2026-08-05") === "INVALID");
  const h1 = await TS.inputHash({ b: 1, a: { d: 2, c: [3, 1] } });
  const h2 = await TS.inputHash({ a: { c: [3, 1], d: 2 }, b: 1 });
  const h3 = await TS.inputHash({ a: { c: [1, 3], d: 2 }, b: 1 });
  ok("hash: stable under object-key reorder", h1 === h2);
  ok("hash: arrays preserve order — reordering an array CHANGES the hash", h1 !== h3);
  ok("hash: sha256-prefixed hex", /^sha256:[0-9a-f]{64}$/.test(h1));
  ok("atomic: a numeric STRING is named as such, not coerced (the v3.57 TYPES lesson)",
    /numeric string/.test(TS.validateAtomic({ value: "100", as_of: "2026-08-01", source: { kind: "PRIMARY" } }, { etToday: "2026-08-05" })));
  ok("atomic: future as_of and >5min-future observed_at are INVALID",
    /after the scoring/.test(TS.validateAtomic({ value: 1, as_of: "2026-08-09", source: { kind: "PRIMARY" } }, { etToday: "2026-08-05" })) &&
    /five minutes/.test(TS.validateAtomic({ value: 1, as_of: "2026-08-05", observed_at: "2026-08-05T15:00:00Z", source: { kind: "PRIMARY" } }, { etToday: "2026-08-05", nowMs: Date.parse("2026-08-05T14:00:00Z") })));
  ok("atomic: OWNER_ASSERTED refused where not explicitly allowed",
    /OWNER_ASSERTED not permitted/.test(TS.validateAtomic({ value: 1, as_of: "2026-08-01", source: { kind: "OWNER_ASSERTED" } }, { etToday: "2026-08-05" })));
}

console.log("\n[46] ttScore pillars — P1..P4 contracts run behaviorally");
{
  const NOW = Date.parse("2026-08-05T14:00:00Z");
  const preprofitDd = { consensus: { revenue_B: { 2027: 11.45, 2028: 21.56 }, eps: { 2027: -1.61, 2028: -2.04 } },
    pt_model: { ev_s_multiple: { 2026: 5.5, 2027: 5.45 }, share_count_M: 310, net_cash_B: 0.87 } };
  const px = { px: 212.58, at: "2026-08-03" };
  const p1pass = TS.scoreP1({ dd: preprofitDd, horizon: "2027", price: px, premiumGateState: "PASS", etToday: "2026-08-05", nowMs: NOW });
  ok("P1: premium scores when the prerequisite gate is PASS (the NBIS dry-run 9.03)",
    p1pass.basis_used === "PREMIUM" && p1pass.score === 9.03);
  const p1unk = TS.scoreP1({ dd: preprofitDd, horizon: "2027", price: px, premiumGateState: "UNKNOWN", etToday: "2026-08-05", nowMs: NOW });
  ok("P1: prerequisite UNKNOWN + pre-profit (floor n/m) → NO_FLOOR_PREPROFIT, premium kept as CONTEXT ONLY",
    p1unk.score === null && p1unk.blockers.includes("NO_FLOOR_PREPROFIT") &&
    p1unk.context_premium && /CONTEXT ONLY/.test(p1unk.context_premium.note));
  const flooredDd = { consensus: { revenue_B: { 2027: 10 }, eps: { 2027: 2 } }, pt_model: { pe_floor_multiple: 18 } };
  const p1floor = TS.scoreP1({ dd: flooredDd, horizon: "2026", price: { px: 30, at: "2026-08-03" }, premiumGateState: "FAIL", etToday: "2026-08-05", nowMs: NOW });
  ok("P1: prerequisite not PASS with a real floor → FLOOR scored, basis recorded",
    p1floor.basis_used === "FLOOR" && typeof p1floor.score === "number");
  const p1stale = TS.scoreP1({ dd: flooredDd, horizon: "2026", price: { px: 30, at: "2026-07-29" }, premiumGateState: "PASS", etToday: "2026-08-05", nowMs: NOW });
  ok("P1: a price mark older than 4 calendar days blocks (the 4-day boundary — 7 days fails)",
    p1stale.score === null && /older than 4/.test(p1stale.blockers[0]));
  ok("P1: exactly 4 days old still scores (inclusive boundary)",
    TS.scoreP1({ dd: flooredDd, horizon: "2026", price: { px: 30, at: "2026-08-01" }, premiumGateState: "FAIL", etToday: "2026-08-05", nowMs: NOW }).score !== null);
  const mk = { consensus: { revenue_B: { 2027: 393.6 }, eps: { 2027: 8.99 } },
    pt_model: { ev_s_multiple: { 2027: 14 }, pe_floor_multiple: 15, share_count_M: 24300 } };
  ok("P1: a MISKEY hard lint makes the pillar unscorable outright",
    /hard model lint: MISKEY/.test(TS.scoreP1({ dd: mk, horizon: null, price: px, premiumGateState: "PASS", etToday: "2026-08-05", nowMs: NOW }).blockers[0]));

  const rev = (vals, kind = "CONSENSUS", n2 = 5) => Object.entries(vals).map(([fy, value]) => ({ fy, value, source: { kind }, analyst_count: n2 }));
  const dur = (years, n2 = 5, kind = "CONSENSUS") => years.map((fy) => ({ fy, metrics: [{ source: { kind }, analyst_count: n2 }] }));
  const p2ok = TS.scoreP2({ mode: "PROFITABLE", revenue: rev({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev({ 2026: 5, 2028: 8 }),
    duration_years: dur(["2026", "2027", "2028", "2029"]) });
  ok("P2 PROFITABLE: scores 0.5*rev + 0.3*earn + 0.2*duration off strictly positive endpoints",
    typeof p2ok.score === "number" && p2ok.components.supported_years === 4 && p2ok.components.duration_score === 10);
  ok("P2: a zero/negative endpoint is unscorable — never sign-stripped",
    /nonpositive endpoint/.test(TS.scoreP2({ mode: "PROFITABLE", revenue: rev({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev({ 2026: -2, 2028: 8 }),
      duration_years: dur(["2026", "2027"]) }).blockers[0]));
  ok("P2: one forward year alone is unscorable",
    /fewer than two/.test(TS.scoreP2({ mode: "PROFITABLE", revenue: rev({ 2026: 100 }), earnings_or_fcf: rev({ 2026: 5, 2028: 8 }),
      duration_years: dur(["2026", "2027"]) }).blockers[0]));
  ok("P2 PREPROFIT: the second series must be DECLARED — the scorer never picks opportunistically",
    /preprofit_second_series must be declared/.test(TS.scoreP2({ mode: "PREPROFIT", revenue: rev({ 2026: 1, 2028: 4 }) }).blockers[0]));
  ok("P2 PREPROFIT: EBITDA series requires a declared GAAP|ADJUSTED basis, ADJUSTED needs reconciliation",
    /declared GAAP\|ADJUSTED/.test(TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "EBITDA_CAGR", revenue: rev({ 2026: 1, 2028: 4 }), ebitda: rev({ 2026: 0.1, 2028: 0.5 }) }).blockers[0]) &&
    /reconciliation/.test(TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "EBITDA_CAGR", ebitda_basis: "ADJUSTED", revenue: rev({ 2026: 1, 2028: 4 }), ebitda: rev({ 2026: 0.1, 2028: 0.5 }), duration_years: dur(["2026", "2027"]) }).blockers[0]));
  ok("P2 PREPROFIT: a negative EBITDA endpoint is unscorable rather than neutral-substituted",
    /nonpositive endpoint/.test(TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "EBITDA_CAGR", ebitda_basis: "GAAP",
      revenue: rev({ 2026: 1, 2028: 4 }), ebitda: rev({ 2026: -0.3, 2028: 0.5 }), duration_years: dur(["2026", "2027"]) }).blockers[0]));
  const p2thin = TS.scoreP2({ mode: "PROFITABLE", revenue: rev({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev({ 2026: 5, 2028: 8 }),
    duration_years: [...dur(["2026", "2027"]), ...dur(["2028"], 2)] });
  ok("P2 duration: a 2-analyst consensus year STOPS the supported run (3 is the boundary; PRIMARY needs none)",
    p2thin.components.supported_years === 2 &&
    TS.scoreP2({ mode: "PROFITABLE", revenue: rev({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev({ 2026: 5, 2028: 8 }),
      duration_years: [...dur(["2026", "2027"]), ...dur(["2028"], undefined, "COMPANY_GUIDANCE")] }).components.supported_years === 3);

  const REC = (value) => ({ value, as_of: "2026-08-01", source: { kind: "PRIMARY" } });
  const p3std = TS.scoreP3({ mode: "PROFITABLE_STANDARD", operating_margin_pct: REC(20), margin_direction_pp: REC(0),
    fcf_margin_pct: REC(10), capital_efficiency: { metric: "ROIC", value: 15, as_of: "2026-08-01", source: { kind: "PRIMARY" } } }, { etToday: "2026-08-05" });
  ok("P3 PROFITABLE_STANDARD: exact anchor inputs produce the exact weighted sum (8*0.35+5*0.25+7*0.25+8*0.15=7)",
    p3std.score === 7.0);
  ok("P3: the route declares ROIC or ROE — the scorer never chooses the higher",
    /never chooses/.test(TS.scoreP3({ mode: "PROFITABLE_STANDARD", operating_margin_pct: REC(20), margin_direction_pp: REC(0),
      fcf_margin_pct: REC(10), capital_efficiency: { value: 15 } }, { etToday: "2026-08-05" }).blockers[0]));
  const p3pre = TS.scoreP3({ mode: "PREPROFIT",
    unit_economics: { state: "IMPROVING", source: { kind: "PRIMARY" }, rationale: "r" },
    margin_direction: { state: "IMPROVING", source: { kind: "PRIMARY" }, rationale: "r" },
    runway_months: REC(24),
    path_to_profit: { state: "DATED_MILESTONES", source: { kind: "OWNER_ASSERTED" }, rationale: "r" } }, { etToday: "2026-08-05" });
  ok("P3 PREPROFIT: enums+runway anchor compose (5*.35+10*.25+7*.25+7*.15=7.05); OWNER_ASSERTED flags actionability",
    p3pre.score === 7.05 && p3pre.owner_asserted === true);
  ok("P3: a missing enum state is a blocker — UNKNOWN is never 5",
    /missing or unknown enum/.test(TS.scoreP3({ mode: "PREPROFIT", margin_direction: { state: "FLAT", source: { kind: "PRIMARY" }, rationale: "r" },
      runway_months: REC(24), path_to_profit: { state: "NONE", source: { kind: "PRIMARY" }, rationale: "r" } }, { etToday: "2026-08-05" }).blockers[0]));

  const H = (over = {}) => ({ id: over.id || "h", definition: "d", green_condition: "g", amber_condition: "a", red_condition: "r",
    importance: 2, state: "GREEN", kill: false, cadence_days: 90, defined_at: "2026-08-04T23:30:00Z",
    as_of: "2026-08-05", source: { kind: "PRIMARY" },
    qualifying_observation: { id: "obs1", observed_at: "2026-08-05T02:00:00Z" }, ...over });
  const p4ok = TS.scoreP4([H({ id: "a" }), H({ id: "b", state: "AMBER", importance: 3 }), H({ id: "c", state: "RED", importance: 1 })], { etToday: "2026-08-05" });
  ok("P4: importance-weighted (10*2+5*3+0*1)/6 = 5.83", p4ok.score === 5.83);
  ok("P4: fewer than 3 required hinges → AWAITING_FALSIFIERS, never a thin score",
    TS.scoreP4([H()], { etToday: "2026-08-05" }).blockers.includes("AWAITING_FALSIFIERS"));
  ok("P4: legacy hinges are visible history and NEVER scored (LEGACY_POST_HOC)",
    TS.scoreP4([H({ legacy: true }), H({ legacy: true }), H({ legacy: true })], { etToday: "2026-08-05" }).bootstrap === "LEGACY_POST_HOC");
  ok("P4: one hinge without a post-definition observation nulls the WHOLE pillar (PRECOMMITTED_PENDING)",
    (() => { const r = TS.scoreP4([H({ id: "a" }), H({ id: "b" }), H({ id: "c", qualifying_observation: null })], { etToday: "2026-08-05" });
      return r.score === null && r.bootstrap === "PRECOMMITTED_PENDING"; })());
  ok("P4: an observation not after defined_at cannot advance the state (re-save/re-fetch rule)",
    TS.scoreP4([H({ id: "a" }), H({ id: "b" }), H({ id: "c", qualifying_observation: { id: "x", observed_at: "2026-08-01T00:00:00Z" } })],
      { etToday: "2026-08-05" }).bootstrap === "PRECOMMITTED_PENDING");
  ok("P4: a RED kill:true hinge raises broken_thesis; a RED non-kill only lowers the score",
    TS.scoreP4([H({ id: "a", state: "RED", kill: true }), H({ id: "b" }), H({ id: "c" })], { etToday: "2026-08-05" }).broken_thesis === true &&
    TS.scoreP4([H({ id: "a", state: "RED" }), H({ id: "b" }), H({ id: "c" })], { etToday: "2026-08-05" }).broken_thesis === false);
  ok("P4: a stale observation blocks (missing is not 5; stale is not current)",
    TS.scoreP4([H({ id: "a", as_of: "2025-01-01" }), H({ id: "b" }), H({ id: "c" })], { etToday: "2026-08-05" }).score === null);
}

console.log("\n[47] route registry + normalization — every boundary at -e/boundary/+e");
{
  ok("routes: all six lenses map, IND is a QUALITY_COMPOUNDER profile, unknown is UNMAPPED",
    TSREG.routeFor("AI").route === "AI_INFRA" && TSREG.routeFor("PH").route === "PHYSICAL_AI" &&
    TSREG.routeFor("QC").profile === "STANDARD" && TSREG.routeFor("IND").route === "QUALITY_COMPOUNDER" &&
    TSREG.routeFor("IND").profile === "INDUSTRIAL_CYCLICAL" && TSREG.routeFor("VEH").route === "VEHICLE" &&
    TSREG.routeFor("SP").route === "SPECULATIVE" && TSREG.routeFor("nope").route === "UNMAPPED");
  const g3 = TSREG.GATES.find((g) => g.id === "AI_G3_2028_BRIDGE");
  ok("AI_G3 (premium prereq): PASS at 4.0x/40%/3 analysts inclusive; UNKNOWN just past; FAIL past 6.0x or under 20%",
    g3.evaluate({ ev_fy2_rev_multiple: 4.0, fy1_fy2_growth_pct: 40, analyst_count_fy2: 3 }) === "PASS" &&
    g3.evaluate({ ev_fy2_rev_multiple: 4.01, fy1_fy2_growth_pct: 40, analyst_count_fy2: 3 }) === "UNKNOWN" &&
    g3.evaluate({ ev_fy2_rev_multiple: 6.0, fy1_fy2_growth_pct: 40, analyst_count_fy2: 3 }) === "UNKNOWN" &&
    g3.evaluate({ ev_fy2_rev_multiple: 6.01, fy1_fy2_growth_pct: 40, analyst_count_fy2: 3 }) === "FAIL" &&
    g3.evaluate({ ev_fy2_rev_multiple: 4.0, fy1_fy2_growth_pct: 19.99, analyst_count_fy2: 3 }) === "FAIL" &&
    g3.evaluate({}) === "UNKNOWN");
  const g4 = TSREG.GATES.find((g) => g.id === "PH_G4_DEMONSTRABLE_ECONOMICS");
  ok("PH_G4 (spec-defined prereq): MSA passes; 10 FPD x 90d x disclosed passes; 9.99 FPD does not; nothing else does",
    g4.evaluate({ msa_signed_with_price: true }) === "PASS" &&
    g4.evaluate({ utilization_fpd: 10, utilization_days_sustained: 90, unit_revenue_disclosed: true }) === "PASS" &&
    g4.evaluate({ utilization_fpd: 9.99, utilization_days_sustained: 90, unit_revenue_disclosed: true }) === "UNKNOWN" &&
    g4.evaluate({ economics_negative: true }) === "FAIL" && g4.evaluate({}) === "UNKNOWN");
  const rw = TSREG.GATES.find((g) => g.id === "PH_G2_RUNWAY");
  ok("PH_G2: 12.0 months passes (inclusive), 11.99 without a facility is BROKEN_THESIS-class FAIL",
    rw.evaluate({ runway_months: 12.0 }) === "PASS" && rw.evaluate({ runway_months: 11.99 }) === "FAIL" &&
    rw.evaluate({ runway_months: 11.99, committed_facility: true }) === "PASS" && rw.effect.kind === "BROKEN_THESIS");
  const g2c = TSREG.GATES.find((g) => g.id === "AI_G2_CIRCULARITY");
  ok("AI_G2: the loop alone PASSES but emits a typed CLUSTER_CONSTRAINT (sizing is WHETHER, never a tier effect)",
    g2c.evaluate({ supplier_equity_pct: 9.3, supplier_is_primary_vendor: true, top_customer_backlog_pct: 59 }) === "PASS" &&
    g2c.constraint({ supplier_equity_pct: 9.3, supplier_is_primary_vendor: true }).kind === "CLUSTER_CONSTRAINT" &&
    g2c.evaluate({ supplier_equity_pct: 9.3, supplier_is_primary_vendor: true, top_customer_backlog_pct: 70.01 }) === "FAIL");
  ok("globals: an explicitly-affirmed false PASSES, true is BROKEN_THESIS FAIL, missing is UNKNOWN (no assumed pass)",
    (() => { const g = TSREG.GATES.find((x) => x.id === "GLOBAL_RESTATEMENT");
      return g.evaluate({ occurred: false }) === "PASS" && g.evaluate({ occurred: true }) === "FAIL" &&
        g.evaluate({}) === "UNKNOWN" && g.effect.kind === "BROKEN_THESIS"; })());
  for (const [raw, want] of [["PASS-with-note", "PASS"], ["NO_EVIDENCE", "UNKNOWN"], ["NOT_STARTED", "UNKNOWN"],
    ["DEMANDING-BUT-CREDIBLE", "UNKNOWN"], ["MARGINAL", "UNKNOWN"], ["PARTIAL — ESTIMATE ONLY", "UNKNOWN"],
    ["FLAG", "UNKNOWN"], ["total garbage", "UNKNOWN"]])
    ok(`normalize: "${raw}" → ${want} (raw label + version persisted)`,
      (() => { const r = TS.normalizeLegacyGateState(raw); return r.state === want && r.raw_state === raw && r.normalization_version === TS.GATE_NORMALIZATION_VERSION; })());
  ok("normalize: no label can manufacture FAIL; typed results override the string entirely",
    TS.normalizeLegacyGateState("total garbage").state !== "FAIL" &&
    TS.normalizeLegacyGateState("NO_EVIDENCE", "PASS").state === "PASS");
  const gp = (arr) => TS.gatePrecedence(arr, "S");
  const B2 = { id: "b", state: "FAIL", effect: { kind: "TIER_CAP", tier: "B" } };
  const BT = { id: "k", state: "FAIL", effect: { kind: "BROKEN_THESIS" } };
  const BA2 = { id: "h", state: "FAIL", effect: { kind: "BLOCK_ADD" } };
  ok("precedence: BROKEN_THESIS > BLOCK_ADD > strictest TIER_CAP, independent of array order",
    gp([B2, BT, BA2]).capped_tier === "AVOID" && gp([BT, BA2, B2]).capped_tier === "AVOID" &&
    gp([B2, BA2]).capped_tier === "HOLD" && gp([BA2, B2]).capped_tier === "HOLD" &&
    gp([B2, { id: "c", state: "FAIL", effect: { kind: "TIER_CAP", tier: "C" } }]).capped_tier === "C");
  ok("precedence: an UNKNOWN gate never passes — BLOCKED_PENDING_INPUT, tier not boosted",
    gp([{ id: "u", state: "UNKNOWN", effect: { kind: "TIER_CAP", tier: "B" } }]).blockers[0] === "BLOCKED_PENDING_INPUT:u" &&
    gp([{ id: "u", state: "PASS", effect: { kind: "TIER_CAP", tier: "B" } }]).capped_tier === "S");
  ok("constraint: at-limit FAILS (equality blocks); missing limit or exposure is UNKNOWN → WAIT",
    TS.evalPortfolioConstraint({ kind: "CLUSTER_CONSTRAINT", limit_pct: 25, projected_pct: 25 }).state === "FAIL" &&
    TS.evalPortfolioConstraint({ kind: "CLUSTER_CONSTRAINT", limit_pct: 25, projected_pct: 24.99 }).state === "PASS" &&
    TS.evalPortfolioConstraint({ kind: "CLUSTER_CONSTRAINT", limit_pct: 25 }).state === "UNKNOWN");
  ok("eligibility: CAUTION evidence can NEVER produce unconditional YAY",
    TS.evalEligibility({ annualized_return_pct: 30, status: "SCORED", actionability: "CAUTION",
      methodology_version: TS.METHODOLOGY_VERSION, capped_tier: "A", execution: "PASS", binary_days: 30 }).verdict === "YAY_ON_TRIGGER");
  ok("eligibility: binary day 0 and 10 block (inclusive), day 11 does not",
    TS.evalEligibility({ annualized_return_pct: 30, status: "SCORED", actionability: "FULL", methodology_version: TS.METHODOLOGY_VERSION,
      capped_tier: "A", execution: "PASS", binary_days: 0 }).blockers.length > 0 &&
    TS.evalEligibility({ annualized_return_pct: 30, status: "SCORED", actionability: "FULL", methodology_version: TS.METHODOLOGY_VERSION,
      capped_tier: "A", execution: "PASS", binary_days: 10 }).blockers.length > 0 &&
    TS.evalEligibility({ annualized_return_pct: 30, status: "SCORED", actionability: "FULL", methodology_version: TS.METHODOLOGY_VERSION,
      capped_tier: "A", execution: "PASS", binary_days: 11 }).verdict === "YAY");
  ok("outcome memory: risk-first — an improvement never nets away a worsening; kill→RED is CONTRADICTED",
    (() => { const prev = { thesis_version: "v1", stamped_at: "t", hinges: { a: "GREEN", b: "AMBER" }, gates: {} };
      const w = TS.buildOutcomeMemory(prev, { thesis_version: "v1", hinges: { a: "AMBER", b: "GREEN" }, gates: {} });
      const k = TS.buildOutcomeMemory(prev, { thesis_version: "v1", hinges: { a: "RED", b: "AMBER" }, gates: {}, kill_hinges: ["a"] });
      const nb = TS.buildOutcomeMemory(null, { thesis_version: "v1" });
      return w.state === "WEAKENING" && k.state === "CONTRADICTED" && nb.state === "INSUFFICIENT"; })());
}

console.log(`\n=== SMOKE TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
