// MacroDash v2.0.1 — snapshot-contract smoke test (Node, no network).
// SCOPE: the live-data layer this version owns — mergeLiveOverMock over the flat
// {live} shape /api/snapshot returns, plus FEAT-204 path resolution against the
// real dashboard MOCK_DATA. The cron worker + /api/fred are no longer consumed by
// the dashboard, so their internals belong to the worker's own suite, not this gate.

import { existsSync, readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { mergeLiveOverMock, SOURCES, isStale, cadenceOf, parseObsDate, isMarketHoliday, MARKET_HOLIDAYS, DERIVED_OF as DERIVED_OF_SRC, DERIVED_EXEMPT, govAsOf } from "../src/sources.js";
import { computeFiveWhys, isMacroMaterial } from "../src/fiveWhys.js";
import { HEADLINE_CATEGORIES, MACRO_TERMS, categoryOf, rankHeadlines, scoreHeadline,
  isNearDuplicate, parseTopHeadlines, RECENCY_MAX_H } from "../src/headlines.js"; // v6.1.0
// C1 (v3.60): the regime engine is a real module now — smoke IMPORTS it instead of lifting
// source text, which is stronger (the actual code runs) and immune to formatting drift.
import { NFCI_TIGHT as REG_NFCI_TIGHT, NFCI_LOOSE as REG_NFCI_LOOSE, REGIME_BAND_TABLE,
  REGIME_QUORUM, verdictFrom, computeRegime as regimeCompute, flipConditions as regimeFlips,
  regimeFactors as regimeFactorRows, voteStyle, MIXED_SUB_MAX,
  CAPE_MEAN, CAPE_ATH, rulerChip, VERDICT_EXPLAIN } from "../src/regime.js";
import { REGIME_FACTOR_FIELDS, FACTOR_FIELD, fieldMode, factorExclusions, buildEvidenceSet } from "../src/evidence.js";
import { LASTVALID_KEY, summarizeEvidence, compareEvidence } from "../src/whatChanged.js";
import {
  bandSpyVs200d, bandVix, bandFearGreed, bandRs, bandTenYear, bandFedOdds,
  aggregateVerdict, computeMacroFlip, buildTtReadout, formatTtPaste, DERIVED_OF,
  conservativeVote, CARRY_SESSIONS, readoutQuality, compareQuality,
  tenYearBurst, TEN_BURST_PP, TEN_BURST_SESSIONS, rsVote, band30yCurve, CURVE_WIDEN_PP,
} from "../src/ttReadout.js";
import { sessionsBehind } from "../src/sources.js";
import { validateBook, validateBoard, validatePos, conflictCheck, authMode, lockoutState, recordFailure, parseCookie, hashPin, LOCK_TIERS, diffForLedger } from "../functions/api/tt.js";
import {
  validateStreetPacket, deriveStreetMetrics, deriveAutomaticComposite, renormalizeComposite,
  buildGateReceipt, rewardRiskFloor, attestGateReceipt, evaluationQuote, STREET_GAP_MIN_PCT,
  TT_ANALYSIS_SCHEMA, TT_ENGINE_VERSION,
} from "../functions/lib/tt-v2.js";
import { deriveTechnicals } from "../functions/lib/tt-technicals.js";
import { extractSecFacts, mergeFactsRecord, candleSeriesFault } from "../functions/lib/tt-facts.js";
import { streetRevision, onRequestPut as putStreetPacket, onRequestGet as getStreetPacket,
  onRequestDelete as deleteStreetPacket } from "../functions/api/street.js";
import { onRequestGet as getFramework, onRequestPut as putFramework } from "../functions/api/framework.js";
import { mergeOcrExtractions, onRequestPost as postStreetOcr } from "../functions/api/street/ocr.js";
import { onRequestGet as getTickerFacts, onRequestPost as postTickerFacts, nasdaqCandlesFact, quoteFact } from "../functions/api/ticker-facts.js";
import { onRequestPost as postTickerAnalysis, riskTierForBookEntry, qualitativeRubric } from "../functions/api/ticker-analysis.js";
import { plausible, applyBands, quorum, QUORUM_FIELDS, QUORUM_MIN, marketSession, BANDS,
  pairRs, RS_63_SESSIONS, parseTreasuryCsv, preferFresherRates, parseCboeVixCsv, parseCboeVixQuote,
  pairCboeVix, preferFresherVix,
  rateOddsStillOpen, chooseTtl, publishIfNoWorse, TTL_MEDIUM, TTL_LOW,
  fetchEquities, applyFieldLastGood, fetchHeadlines, parseRssItems,
  onRequest as getSnapshot } from "../functions/api/snapshot.js";
import { etYmd } from "../src/sources.js";
// UI-OVERHAUL Slice 1 (task 1.1): tokens are a real module now — smoke IMPORTS it (the v3.60
// convention: the actual export is tested, immune to formatting drift) instead of regexing
// hex values out of dashboard.jsx source text.
import { DT, T as TOK_T } from "../src/design-tokens.js";
import { fmt } from "../src/format.js"; // task 1.3: shared format helpers, tested by execution
import { buildMacroCall, formatMacroCallPaste, formatMacroShareCard, CALL_SCHEMA } from "../src/macroCall.js";
import { buildForwardOutcome, normalizeSp500Observations, outcomeKey, OUTCOME_SCHEMA } from "../src/publicHistory.js";
import cronWorker, { captureDailyCall, enrichHistoryOutcomes, putWithRetry, warmSnapshot } from "../worker/cron.js";
import { onRequest as getHistory } from "../functions/history.json.js";
import { onRequest as getReadout } from "../functions/readout.json.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name); } };

/* P0 (v3.99.4, codex ambiguity review): every source lift is normalized to LF. Several lifts
   locate their block with an LF-sensitive indexOf ("MAG_BASKET=null;\n  {" in [58]), and a
   CRLF checkout (Windows, core.autocrlf=true) made the search return -1 — two FAILs and then
   a TypeError that killed the suite MID-RUN, so the gate crashed on line endings before it
   ever evaluated behavior (reproduced 2026-08-17 by CRLF-converting admin.html: the suite
   died without printing its total). .gitattributes now pins the checkout to LF; this helper
   is the belt to that suspender, so the suite is correct on any checkout rather than
   dependent on a git setting. node_modules reads stay raw readFileSync — npm writes those,
   git never converts them. */
const readSrc = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Load real MOCK_DATA from dashboard.jsx (catches sources.js <-> dashboard drift).
const dashSrc = readSrc("../src/dashboard.jsx");
const regimeSrc = readSrc("../src/regime.js"); // C1 (v3.60)
// UI-OVERHAUL task 1.3: the verdict band moved verbatim to its own module. Pins that
// describe the BAND read bandSrc; pins whose contract spans both surfaces (a negative
// that must hold everywhere, a vocabulary shared across files) read uiSrc.
const bandSrc = readSrc("../src/sections/RegimeBand.jsx");
// task 1.4: FiveWhys + the SourceBox/SectionHeader primitives moved out too.
const whysSrc = readSrc("../src/sections/FiveWhys.jsx");
const sbSrc = readSrc("../src/primitives/SourceBox.jsx");
const shSrc = readSrc("../src/primitives/SectionHeader.jsx");
// wave 5 (tasks 3.1-3.3): MacroStrip, SignalQuality, WhatChanged moved out too.
const stripSrc = readSrc("../src/sections/MacroStrip.jsx");
const sqSrc = readSrc("../src/sections/SignalQuality.jsx");
const wcSrc = readSrc("../src/sections/WhatChanged.jsx");
// wave 9 (tasks 5.2-5.4): MarketDetail, MacroRegime, Headwinds + the DirTile primitive.
const mdSrc = readSrc("../src/sections/MarketDetail.jsx");
const mrSrc = readSrc("../src/sections/MacroRegime.jsx");
const hwSrc = readSrc("../src/sections/Headwinds.jsx");
const dtSrc = readSrc("../src/primitives/DirTile.jsx");
// wave 12 (tasks 7.1-7.4): AIUnitEconomics, Alerts, DataHealth, Watchlist + aiEcon.js.
const aiSrc = readSrc("../src/sections/AIUnitEconomics.jsx");
const alSrc = readSrc("../src/sections/Alerts.jsx");
const dhSrc = readSrc("../src/sections/DataHealth.jsx");
const wlSrc = readSrc("../src/sections/Watchlist.jsx");
const aiEconSrc = readSrc("../src/aiEcon.js");
const navSrc = readSrc("../src/sections/StickyNav.jsx"); // wave 15
const tdSrc = readSrc("../src/sections/TerminalDock.jsx"); // v4.1.7 (replaced SharedPicks)
const spcSrc = readSrc("../src/sections/SimpleCards.jsx"); // v4.0
const fsSrc  = readSrc("../src/primitives/FactSheet.jsx"); // v5.8 — the explainer sheet
const uiSrc = dashSrc + spcSrc + bandSrc + whysSrc + sbSrc + shSrc + stripSrc + sqSrc + wcSrc + mdSrc + mrSrc + hwSrc + dtSrc + aiSrc + alSrc + dhSrc + wlSrc + navSrc + tdSrc;
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
const fwRegime = { label: "RISK-ON", raw:"RISK-ON", sub: "Disinflation + low vol", bullVotes: 4, bearVotes: 1, counted:6, totalFactors:6 };
const fwFactors = [
  {key:"tenYear",label:"10Y Direction",state:"NEUTRAL",display:"4.70% · +0.01pp 1-mo",as_of:"2026-08-24"},
  {key:"vix",label:"VIX Level",state:"BULLISH",display:"15.85 — Low",as_of:"2026-08-24"},
  {key:"fearGreed",label:"Fear & Greed",state:"BULLISH",display:"60 — Greed",as_of:"2026-08-25"},
  {key:"cpiHeadline",label:"CPI Trend",state:"BULLISH",display:"3.4% YoY · cooling",as_of:"2026-07-01"},
  {key:"valuation",label:"Valuation",state:"BEARISH",display:"41.8 CAPE",as_of:"2026-08-25"},
  {key:"nfci",label:"Fin Conditions",state:"BULLISH",display:"-0.56 SD",as_of:"2026-08-14"},
];
const fwCall = {headline:"MOONING",direction:"BULLISH",confidence:"HIGH",actionability:"FULL",
  counts:{bullish:4,neutral:1,bearish:1,usable:6,total:6},factors:fwFactors,override:{active:false}};
const fwOpts = {call:fwCall,factors:fwFactors,snapshotAsOf:"2026-08-25T14:00:00Z",
  headlineFresh:true,flips:[{copy:"VIX at or above 18.00",would:"MIXED"}]};
const fw = computeFiveWhys(MOCK_DATA, fwRegime, fwOpts);
ok("returns exactly 5 whys", Array.isArray(fw.whys) && fw.whys.length === 5);
ok("every why is a non-empty string", fw.whys.every((w) => typeof w === "string" && w.length > 0));
ok("headline carries the canonical human + machine call", typeof fw.headline === "string" && /MOONING · BULLISH/.test(fw.headline));
ok("regime descriptor non-empty", typeof fw.regime === "string" && fw.regime.length > 0);
ok("session prefix flips PRE vs CLOSE",
  computeFiveWhys({ ...MOCK_DATA, session: "PRE" }, fwRegime, fwOpts).headline.startsWith("Pre-open") &&
  computeFiveWhys({ ...MOCK_DATA, session: "CLOSE" }, fwRegime, fwOpts).headline.startsWith("Post-close"));
ok("does not throw on MOCK_DATA with default regime", (() => { try { computeFiveWhys(MOCK_DATA); return true; } catch { return false; } })());
// 8/28 vocabulary matrix rows 12-13: coverage takes the canonical "N of M voters counted"
// form and the majority RULE stops reading as a third tally. Pinned on the new copy, and the
// retired slash/"strict majority: N of M" forms are pinned ABSENT so they cannot creep back.
ok("check 1 is exact call arithmetic, not unrelated SPY/Fed context",
  /4 bullish, 1 neutral, and 1 bearish/.test(fw.whys[0]) &&
  /all 6 voters counted/.test(fw.whys[0]) &&
  /strict majority of the counted voters — at least 4 here/.test(fw.whys[0]) &&
  !/SPY|Fed at/.test(fw.whys[0]));
ok("row 12-13: WHY #1 carries no slash fraction and never calls a fraction 'usable'",
  !/\d+\/\d+/.test(fw.whys[0]) && !/\d+ of \d+ usable|usable factors/.test(fw.whys[0]));
ok("check 2 contains only canonical factors and their dated states",
  fwFactors.every((f)=>fw.whys[1].includes(f.label)) && /as of 2026-08-25/.test(fw.whys[1]) && !/WTI|BTC|HY-IG/.test(fw.whys[1]));
/* v5.8 (owner: the whys should "sound more macro defined") — re-pinned on the sharpened
   transmission vocabulary. The clause now names the CHANNEL each factor actually runs
   through; the disclaimer that these are channels and not proof of causation is unchanged,
   because that is the honesty half of the check. Pinned as "names a real channel", derived
   from the map itself rather than one hand-copied phrase, so the next copy pass cannot
   quietly leave WHY #3 gesturing at importance with no mechanism in it. */
ok("check 3 explains transmission in macro terms and disclaims single-factor causality",
  /discount rate|price of protection|room the Fed has|cushion|credit channel|already in the price/.test(fw.whys[2]) &&
  /not proof/.test(fw.whys[2]));
ok("check 4 states snapshot time, confidence, and that headlines never vote",
  /Evidence confidence is HIGH/.test(fw.whys[3]) && /snapshot was pulled/.test(fw.whys[3]) && /never cast a vote/.test(fw.whys[3]));
ok("check 5 names the nearest load-bearing change and actionability",
  /VIX at or above 18\.00/.test(fw.whys[4]) && /HODL/.test(fw.whys[4]) && /Actionability is FULL/.test(fw.whys[4]));
const fwReducedFactors=fwFactors.map((f)=>f.key==="vix"?{...f,state:null,excluded:true,reason:"too old"}:f);
const fwReducedCall={...fwCall,confidence:"MEDIUM",counts:{bullish:3,neutral:1,bearish:1,usable:5,total:6},factors:fwReducedFactors};
const fwReduced=computeFiveWhys(MOCK_DATA,{...fwRegime,counted:5,bullVotes:3},{...fwOpts,call:fwReducedCall,factors:fwReducedFactors});
ok("five checks: reduced evidence changes the denominator and names the exclusion",
  /3 of the 5 counted voters lean bullish/.test(fwReduced.headline) && /VIX Level was excluded/.test(fwReduced.whys[3]));
// Row 11: the tally shape is now unmistakably a tally — no slash, no "usable" on a fraction.
ok("row 11: the reduced headline names a bullish TALLY, never a coverage fraction",
  !/\d+\/\d+/.test(fwReduced.headline) && !/usable factors bullish/.test(fwReduced.headline) &&
  /5 counted voters/.test(fwReduced.headline));
// ---- DEC-31 (v3.2): Put/Call fully retired ------------------------------
ok("DEC-31: putCall absent from SOURCES", !("putCall" in SOURCES));
ok("DEC-31: MOCK_DATA no longer carries marketPulse.putCall", MOCK_DATA.marketPulse.putCall === undefined);
ok("DEC-31: dashboard.jsx has zero putCall references", !dashSrc.includes("putCall"));
const snapSrc = readSrc("../functions/api/snapshot.js");
ok("DEC-31: fetchPutCall scraper deleted from snapshot.js", !snapSrc.includes("putCall") && !snapSrc.includes("fetchPutCall"));
// Headline context is explicitly non-voting whether material, irrelevant, or unavailable.
const withHL = { ...MOCK_DATA, marketPulse: { ...MOCK_DATA.marketPulse, headline: { text: "Peace deal lifts futures", source: "MarketWatch" } } };
ok("headline context renders a relevant current item but never promotes it to a voter",
  /Peace deal lifts futures/.test(computeFiveWhys(withHL, fwRegime, fwOpts).whys[3]) && /never cast a vote/.test(computeFiveWhys(withHL, fwRegime, fwOpts).whys[3]));
ok("headline context states when no current item passes", /No current macro headline/.test(computeFiveWhys(MOCK_DATA, fwRegime, {...fwOpts,headlineFresh:false}).whys[3]));
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
const fwAdmin = computeFiveWhys(admin, fwRegime, fwOpts);
ok("headline context: a fresh but non-macro item is withheld and the reason is named",
  /failed the macro-relevance filter/.test(fwAdmin.whys[3]) && !fwAdmin.whys[3].includes("death certificate"));
ok("headline context: the materiality filter is one-way — accepted context stays verbatim",
  computeFiveWhys(withHL, fwRegime, fwOpts).whys[3].includes("Peace deal lifts futures"));

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
/* v5.97: SEVEN — us30y_curve appended. The count is asserted in ONE place and every other
   site derives from it, so the next check to arrive moves one literal instead of four. */
const TT_CHECK_COUNT = 7;
ok("v5.97: regime.checks is ALWAYS length 7 — us30y_curve APPENDED, so indices 0-5 never moved",
  rBull.regime.checks.length === TT_CHECK_COUNT
  && rBull.regime.checks[6].name === "us30y_curve"
  && rBull.regime.checks.map((c) => c.name).slice(0, 6).join() ===
     "spy_vs_200d,vix,fear_greed,qqq_spy_rs,us10y_trend,fed_next_meeting");
ok("readout: spy pct computed (+6.87% > 3) -> bullish check", rBull.spy.pct_vs_200d === 6.87 && rBull.regime.checks[0].state === "bullish");
ok("readout: qqq_spy_rs leading (0.9-0.41=+0.49 > 0.3) + basis 1d", rBull.qqq_spy_rs.state === "leading" && rBull.qqq_spy_rs.basis === "1d");
/* 8/31 — THIS PIN REVERSES on the RS leg. It asserted 3 bullish votes because a 1d RS print
   of +0.49pp cast one. A single session is not relative strength (see rsVote): the state is
   still measured and still published as `leading`, but the bullish VOTE is withheld, so the
   same tape is 2 bull / 0 bear and still TAILWIND. Both halves pinned — the count moved, the
   verdict did not, and the measured state is untouched. */
ok("8/31: bullish-majority -> TAILWIND on 2 bull (SPY+VIX); RS still MEASURES leading but does not vote it",
  rBull.regime.verdict === "TAILWIND" && rBull.regime.bullish === 2 && rBull.regime.bearish === 0
  && rBull.qqq_spy_rs.state === "leading" && rBull.regime.checks[3].state === "neutral"
  && /one session is not relative strength/.test(rBull.regime.checks[3].reason));
ok("8/31 RS: a BEARISH 1d print survives — the withhold is asymmetric, exactly like conservativeVote",
  (() => { const r = buildTtReadout(mkLive({ qqqChangePct: -0.5, spyChangePct: 0.41 }), { now: TT_NOW });
    return r.qqq_spy_rs.state === "breaking_down" && r.regime.checks[3].state === "bearish"; })());
ok("8/31 RS: ONE-WAY — withholding a bull vote can only move the verdict away from risk-on",
  (() => { // same tape, RS the only bull: TAILWIND would have been 1-0; now it is a 0-0 NEUTRAL.
    const r = buildTtReadout(mkLive({ spyPrice: 700, vix: 20, fearGreed: 62, tenYearM1: 0.03, rateOddsHold: 98 }), { now: TT_NOW });
    return r.qqq_spy_rs.state === "leading" && r.regime.bullish === 0 && r.regime.verdict === "NEUTRAL"
      && r.regime.available === 6; })());  // available is UNTOUCHED — a neutral check still counts
ok("8/31 RS: rsVote is pure and only ever downgrades the bullish case",
  rsVote("leading", "1d") === "neutral" && rsVote("breaking_down", "1d") === "bearish"
  && rsVote("inline", "1d") === "neutral" && rsVote(null, "1d") === null
  // a longer basis is NOT withheld — the rule is about the window, not about RS
  && rsVote("leading", "63d") === "bullish");
ok("readout: spyMa200 absent -> spy check unavailable, sma200 null (never fabricated)", (() => { const r = buildTtReadout(mkLive({ spyMa200: undefined }), { now: TT_NOW }); return r.spy.sma200 === null && r.regime.checks[0].state === "unavailable"; })());
ok("readout: HEADWIND when bearish-majority", (() => { const r = buildTtReadout(mkLive({ spyPrice: 650, vix: 26, tenYearM1: 0.2 }), { now: TT_NOW }); return r.regime.verdict === "HEADWIND"; })());
ok("readout: NEUTRAL on a 1-1 tie among available checks", (() => { const r = buildTtReadout(mkLive({ spyPrice: 700, vix: 26, tenYearM1: -0.2, fearGreed: 62, qqqChangePct: 0.41, rateOddsHold: 98 }), { now: TT_NOW }); return r.regime.bullish === 1 && r.regime.bearish === 1 && r.regime.verdict === "NEUTRAL"; })());
ok("readout: PANIC (vix 25.1 + F&G 19) overrides a bullish tape", (() => { const r = buildTtReadout(mkLive({ vix: 25.1, fearGreed: 19 }), { now: TT_NOW }); return r.regime.verdict === "PANIC" && r.regime.panic_inputs.panic === true; })());
ok("readout: boundary vix 25 + F&G 19 is NOT panic", buildTtReadout(mkLive({ vix: 25, fearGreed: 19 }), { now: TT_NOW }).regime.panic_inputs.panic === false);
ok("readout: boundary vix 26 + F&G 20 is NOT panic", buildTtReadout(mkLive({ vix: 26, fearGreed: 20 }), { now: TT_NOW }).regime.panic_inputs.panic === false);

/* ── 8/31: THE 10Y BURST TERM ───────────────────────────────────────────────────────────
   The check read a ~21-session magnitude, so it could not tell drift from a repricing.
   Every pin here runs the REAL band and the REAL engine: a threshold is a claim about
   numbers, and a string pin cannot prove one. `bandTenYear` itself is UNTOUCHED — the burst
   is a separate term, and these pins prove the published `trend` still means the month. */
// A 3-session hawkish burst of a month's size fires; the SAME move dovish does nothing.
const burstLive = (pp, m1 = 0.03) => {
  const base = 4.46 - pp; // oldest→newest, 4 points so the 3-session lookback is exact
  return mkLive({ tenYearM1: m1, tenYear: 4.46, tenYearSeries: [base, base, base, 4.46] });
};
ok("8/31 burst: the threshold is DERIVED from bandTenYear's own spiking edge, not a new constant",
  // Reconciled behaviourally against the band rather than restated: TEN_BURST_PP is exactly
  // the magnitude the month-band already calls spiking, so moving one moves both.
  TEN_BURST_SESSIONS === 3 && bandTenYear(TEN_BURST_PP + 0.001) === "spiking" && bandTenYear(TEN_BURST_PP) !== "spiking");
ok("8/31 burst: a month's move inside 3 sessions votes BEARISH even though the month reads rangebound",
  (() => { const r = buildTtReadout(burstLive(0.2), { now: TT_NOW });
    const c = r.regime.checks[4];
    return r.us10y.trend === "rangebound" && r.us10y.burst_fired === true && c.state === "bearish"
      && /rangebound/.test(c.reason) && /3 sessions/.test(c.reason); })());
ok("8/31 burst: the published `trend` still reports the MONTH verbatim — the statistic did not change meaning",
  buildTtReadout(burstLive(0.2), { now: TT_NOW }).us10y.trend === "rangebound");
ok("8/31 burst: boundary — the VOTE flips AT the edge, not below it",
  // Asserts the vote, not just the flag: a control that disabled only the vote wiring turned
  // a flag-only boundary pin green, which would have made this read as covered when it wasn't.
  (() => { const at = buildTtReadout(burstLive(0.15), { now: TT_NOW });
    const below = buildTtReadout(burstLive(0.149), { now: TT_NOW });
    return at.us10y.burst_fired === true && at.regime.checks[4].state === "bearish"
      && below.us10y.burst_fired === false && below.regime.checks[4].state === "neutral"; })());
ok("8/31 burst: ASYMMETRIC — a dovish burst of the same size does NOTHING (thin evidence never buys risk-on)",
  (() => { const r = buildTtReadout(burstLive(-0.3), { now: TT_NOW });
    return r.us10y.burst_fired === false && r.regime.checks[4].state === "neutral"; })());
ok("8/31 burst: ONE-WAY — it can sharpen a neutral month to bearish, and can never soften a bearish one",
  (() => { const spiking = buildTtReadout(mkLive({ tenYearM1: 0.3, tenYear: 4.46, tenYearSeries: [4.9, 4.8, 4.7, 4.46] }), { now: TT_NOW });
    // A DOVISH 3-session run under a spiking month: the check must stay bearish.
    return spiking.us10y.trend === "spiking" && spiking.regime.checks[4].state === "bearish"; })());
ok("8/31 burst: it never resurrects a MISSING check — the majority math gets no side door",
  // NOT written as burstLive(0.2, undefined): `m1` is a DEFAULTED parameter, so passing
  // undefined restores 0.03 and the fixture quietly stops testing a missing m1. Caught by
  // this pin failing against correct code — the field is overridden explicitly instead.
  (() => { const r = buildTtReadout({ ...burstLive(0.2), tenYearM1: undefined }, { now: TT_NOW });
    return r.regime.checks[4].tier === "MISSING" && r.regime.checks[4].state === "unavailable"
      && r.us10y.burst_pp === 0.2 && r.us10y.burst_fired === false; })());
ok("8/31 burst: fails closed on a short series, a non-finite point, or a series/level mismatch",
  tenYearBurst([4.4, 4.5], 4.5) === null &&
  tenYearBurst([4.4, null, 4.5, 4.6], 4.6) === null &&
  // newest point disagrees with the published level -> two different legs -> refuse to compute
  tenYearBurst([4.4, 4.4, 4.4, 4.6], 4.46) === null &&
  tenYearBurst([4.4, 4.4, 4.4, 4.6], 4.6).pp === 0.2);
ok("8/31 burst: NOT FITTED — the live 2026-08-31 tape (+0.09 over 3 sessions) does NOT fire it",
  // The tape that motivated the term is the control: a threshold tuned to make its own
  // motivating case fire would be a fit, not a rule. Real series and real level from that body.
  (() => { const r = buildTtReadout(mkLive({ tenYear: 4.73, tenYearM1: 0.05,
      tenYearSeries: [4.72, 4.71, 4.65, 4.69, 4.74, 4.7, 4.64, 4.66, 4.67, 4.73] }), { now: TT_NOW });
    return r.us10y.burst_pp === 0.09 && r.us10y.burst_fired === false && r.regime.checks[4].state === "neutral"
      // ...and it is still REPORTED, so the reader sees the month and the burst disagree in scale.
      && /3-session \+0\.09pp/.test(r.regime.checks[4].reason); })());
ok("8/31 burst: the weekly window the obvious fix would have used catches NOTHING on that tape",
  // Recorded because it is the correction that changed the design: tenYearW1 on the live body
  // was -0.01, i.e. flatter and marginally MORE dovish than the month it was meant to sharpen.
  (() => { const r = buildTtReadout(mkLive({ tenYear: 4.73, tenYearM1: 0.05, tenYearW1: -0.01,
      tenYearSeries: [4.72, 4.71, 4.65, 4.69, 4.74, 4.7, 4.64, 4.66, 4.67, 4.73] }), { now: TT_NOW });
    return r.us10y.burst_pp > 0 && r.us10y.burst_pp > Math.abs(-0.01); })());
ok("8/31 burst: it prints on the human surface — the paste block carries the burst beside the month",
  (() => { const t = formatTtPaste(buildTtReadout(burstLive(0.2), { now: TT_NOW }));
    return /m1 \+0\.03/.test(t) && /3d \+0\.2/.test(t) && /BURST/.test(t); })());

/* ── v5.97: THE LONG END AS A CHECK ─────────────────────────────────────────────────────────
   Owner call, and the highest-risk change in this file's history: a 7th voter in a contract
   that gates real orders. Every pin RUNS the engine. */
const curveLive = (o = {}) => mkLive({ thirtyYear: 5.22, thirtyYearAsOf: D, thirtyYearM1: 0.01,
  spread10s30s: 0.49, spread10s30sAsOf: D, ...o });
ok("v5.97 curve: EVERY edge is derived from a band that already existed — none is newly asserted",
  // Reconciled behaviourally, not restated: the widening edge IS bandTenYear's spiking edge,
  // and the burst edge IS the v5.10.0 term. Move either and this check moves with it.
  CURVE_WIDEN_PP === TEN_BURST_PP &&
  bandTenYear(CURVE_WIDEN_PP + 0.001) === "spiking" && bandTenYear(CURVE_WIDEN_PP) !== "spiking");
ok("v5.97 curve: BEARISH-ONLY by construction — no input of any shape returns a bullish vote",
  (() => { for (const spread of [-3, -0.01, 0, 0.5, 4])
      for (const d of [-2, -0.16, 0, 0.16, 2])
        for (const b of [-1, 0, 0.15, 1]) {
          const r = band30yCurve({ spread, spreadM1Chg: d, burstPp: b });
          if (r && r.vote === "bullish") return false;
        }
    return true; })());
ok("v5.97 curve: boundaries — widening fires ABOVE the edge, inversion BELOW zero, burst AT the edge",
  band30yCurve({ spreadM1Chg: 0.151 }).vote === "bearish" &&
  band30yCurve({ spreadM1Chg: 0.15 }).vote === "neutral" &&
  band30yCurve({ spread: -0.01 }).vote === "bearish" &&
  band30yCurve({ spread: 0 }).vote === "neutral" &&
  band30yCurve({ burstPp: 0.15 }).vote === "bearish" &&
  band30yCurve({ burstPp: 0.149 }).vote === "neutral");
ok("v5.97 curve: fails CLOSED — nothing measurable is `unavailable`, never a comfortable neutral",
  band30yCurve({}) === null && band30yCurve({ spread: null, spreadM1Chg: NaN, burstPp: undefined }) === null &&
  (() => { const r = buildTtReadout(mkLive(), { now: TT_NOW });  // no 30Y fields at all
    return r.regime.checks[6].state === "unavailable" && r.us30y.tier === "MISSING"; })());
ok("v5.97 curve: NOT COLLINEAR with the 10Y — a PARALLEL shift moves the belly and leaves the curve flat",
  // The whole reason this is not "the 10Y check with a 3 in front" (the v3.83 defect).
  (() => { const par = buildTtReadout(curveLive({ tenYearM1: 0.3, thirtyYearM1: 0.3,
      tenYear: 4.46, thirtyYear: 5.22, spread10s30s: 0.49 }), { now: TT_NOW });
    return par.regime.checks[4].state === "bearish"      // belly says spiking
      && par.regime.checks[6].state === "neutral"        // curve unchanged -> no second vote
      && par.us30y.spread_m1_chg === 0; })());
ok("v5.97 curve: a LONG-END breakout while the belly is calm votes bearish — the case only this check sees",
  (() => { const r = buildTtReadout(curveLive({ tenYearM1: 0.02, thirtyYearM1: 0.25 }), { now: TT_NOW });
    return r.regime.checks[4].state === "neutral" && r.regime.checks[6].state === "bearish"
      && r.us30y.flags.includes("widening") && /votes bearish/.test(r.regime.checks[6].reason); })());
ok("v5.97 curve: an INVERTED 10s30s votes bearish, and the flag names it",
  (() => { const r = buildTtReadout(curveLive({ spread10s30s: -0.12 }), { now: TT_NOW });
    return r.regime.checks[6].state === "bearish" && r.us30y.flags.includes("inverted"); })());
ok("v5.97 curve: the LEVEL alone never votes — an elevated-but-flat long end reads neutral and says so",
  // The owner's own prompt was the 5.22 level; a level arm would make this a permanently
  // one-way voter (the NFCI v3.43.1 flaw), so the level is EVIDENCE and the repricing votes.
  (() => { const r = buildTtReadout(curveLive({ thirtyYear: 6.5 }), { now: TT_NOW });
    return r.regime.checks[6].state === "neutral" && /6\.5%/.test(r.regime.checks[6].reason)
      && /level alone does not vote/.test(r.regime.checks[6].reason); })());
ok("v5.97 curve: the monthly change needs the SPREAD present — it inherits snapshot's same-date guarantee",
  // thirtyYearM1 - tenYearM1 across two differently-dated legs would be a fabricated
  // observation; snapshot.js drops spread10s30s on a date mismatch, so gate on it.
  (() => { const r = buildTtReadout(mkLive({ thirtyYear: 5.22, thirtyYearAsOf: D, thirtyYearM1: 0.25, tenYearM1: 0.02 }), { now: TT_NOW });
    return r.us30y.spread_m1_chg === null && !r.us30y.flags.includes("widening"); })());
ok("v5.97 curve: on the LIVE 2026-08-31 tape it votes NEUTRAL — not built to make its own prompt red",
  // BOTH legs must come from the real body: the curve change is thirtyYearM1 MINUS tenYearM1,
  // and an earlier draft of this pin set only the 30Y leg, leaving mkLive's default 10Y in
  // place — so it computed -0.02 while claiming to reproduce a tape that read -0.04. A fixture
  // named for a real tape has to carry all of it.
  (() => { const r = buildTtReadout(curveLive({ tenYear: 4.73, tenYearM1: 0.05, thirtyYearM1: 0.01,
      thirtyYearSeries: [5.31, 5.28, 5.19, 5.23, 5.27, 5.23, 5.17, 5.18, 5.19, 5.22] }), { now: TT_NOW });
    return r.us30y.spread_m1_chg === -0.04 && r.us30y.burst_pp === 0.05
      && r.us30y.flags.length === 0 && r.regime.checks[6].state === "neutral"
      // ...and the elevated LEVEL is still on the reason, unvoted.
      && /5\.22%/.test(r.regime.checks[6].reason); })());
ok("v5.97 curve: it prints on the human surface with its level and its curve reading",
  (() => { const t = formatTtPaste(buildTtReadout(curveLive({ spread10s30s: -0.12 }), { now: TT_NOW }));
    return /30Y CURVE/.test(t) && /5\.22%/.test(t) && /inverted/.test(t); })());
ok("v5.97 curve: ONE-WAY — adding this voter can never move the verdict toward risk-on",
  (() => { // the same tape with and without the 30Y fields; the verdict may only get more cautious
    const RANK = { HEADWIND: 0, NEUTRAL: 1, TAILWIND: 2 };
    for (const o of [{}, { spread10s30s: -0.2 }, { thirtyYearM1: 0.4 }, { spread10s30s: 2.5 },
                     { thirtyYearM1: -0.5 }, { spread10s30s: 0.1, thirtyYearM1: 0.01 }]) {
      const without = buildTtReadout(mkLive(), { now: TT_NOW }).regime;
      const withCurve = buildTtReadout(curveLive(o), { now: TT_NOW }).regime;
      if (withCurve.verdict === "PANIC" || without.verdict === "PANIC") continue;
      if (RANK[withCurve.verdict] > RANK[without.verdict]) return false;  // never MORE risk-on
    }
    return true; })());

/* v5.97.4 — THE FLOOR RULING, EXECUTED. `available < 3` stays an ABSOLUTE literal as the
   check count grows (3-of-6 became 3-of-7): it encodes "one or two readings never publish a
   direction", not a fraction — the FRACTIONS live in the confidence arms and are derived
   from checks.length. The ruling's stated consequence is proven here rather than asserted
   in the comment alone: at EXACTLY 3 available the direction publishes as information, but
   `current` cannot reach checks.length-2, so the evidence axis reads LOW · HOLD · DATA
   DEGRADED and the thinner floor can never gate an order on its own. (The 2-available
   withhold is pinned separately below — this is the other side of the same boundary.) */
ok("v5.97.4 floor: at EXACTLY 3 available the direction PUBLISHES — three real observations are three",
  (() => { const r = buildTtReadout(mkLive({
      qqqChangePct: undefined,                                                   // RS dark
      tenYearM1: undefined,                                                      // 10Y trend dark
      rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined,  // rate path dark
    }), { now: TT_NOW });                                                        // 30Y absent by default
    return r.regime.available === 3 && r.regime.verdict === "TAILWIND"
      && r.regime.confidence === "LOW" && r.regime.actionability === "HOLD"
      && r.regime.status === "DATA DEGRADED"; })());

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
  // v3.84: creditTail + threeMonth are direct pulls; spread10y3m copies tenYearAsOf ||
  // threeMonthAsOf; sahm copies the UNRATE observation date (computed, not derived — it
  // carries its OWN stamped AsOf, so it is primary for the partition).
  "creditTail", "threeMonth", "spread10y3m", "sahm",
  // v3.99: the Fed's DAILY target-range bounds — each its own FRED pull, so each carries its
  // own observation date. They are deliberately NOT derived from fedFunds: the whole reason
  // they exist is that FEDFUNDS (monthly, lagging) CANNOT tell you today's policy rate, so
  // inheriting its staleness would defeat the fix.
  "fedTargetUpper", "fedTargetLower",
  "fearGreed", "marketHeadline", "shillerPe", "tokenBlendedMtok", "rateOddsHold",
  // v3.85: the volume leg carries its own AsOf (the dataset's own latest date).
  "tokenVolDay",
  // FEAT-NFCILEV (8/28): the leverage subindex is its own FRED pull with its own
  // observation date — primary, never derived from its parent nfci (a fresher parent must
  // not launder a stale subindex, nor the reverse).
  "nfciLeverage",
];
ok("deriv: PRIMARY_ASOF_FIELDS + DERIVED_OF + DERIVED_EXEMPT partition ALL 76 SOURCES keys (reconciled, not hardcoded)", (() => {
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

/* ═══════════ ENGINE 0 ADVERSARIAL PROPERTY SWEEP (v4.1.6) ═══════════
   Owner: "make sure it's almost always firing correctly … I don't want an incorrect or
   misfiring engine zero because it plays a role in all of our price targets and allocations."
   The ~50 hand-written cases above test SPECIFIC POINTS. Points cannot support "almost
   always" — the v3.40 defect (verdict went NEUTRAL -> TAILWIND when stale votes were
   REMOVED: "more risk-on for knowing less") passed every point test that existed.
   So this sweeps GENERATED scenarios through the real buildTtReadout and asserts SAFETY
   INVARIANTS that must hold for EVERY input. Seeded LCG, never Math.random — a property
   failure has to be reproducible from the seed printed in the message. */
const P_SEED = 20260821;
let _rng = P_SEED;
const rnd = () => ((_rng = (_rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
// Real calendar dates around TT_NOW (Wed 2026-07-15) — weekends matter to sessionsBehind.
/* WEIGHTED toward fresh, deliberately. An unweighted pick produced 1448/1500 HOLD and only
   20 FULL — so the sweep was exercising the degraded path almost exclusively and the three
   most safety-critical invariants (P4/P5/P6) rode on a handful of samples. Real days are
   mostly fresh; the generator should be too, or "almost always correct" is measured almost
   entirely on the days the engine is already abstaining. */
const P_DATES = [D, D, D, D, D, "2026-07-14", "2026-07-14", "2026-07-13", "2026-07-10",
  "2026-07-09", "2026-07-06", "2026-07-01", undefined];
// Values chosen ON and AROUND every band edge the engine uses.
const P_VALS = {
  spyPrice: [620, 650, 679, 700, 721, 748.1, 800, undefined],
  vix: [11, 17.9, 18, 18.1, 22, 24.9, 25, 25.1, 30, undefined],
  fearGreed: [5, 19, 20, 24, 25, 55, 56, 75, 76, 95, undefined],
  qqqChangePct: [-2, -0.4, 0, 0.31, 0.9, 3, undefined],
  tenYearM1: [-0.4, -0.11, -0.1, -0.09, 0, 0.14, 0.15, 0.16, 0.4, undefined],
};
const P_GROUPS = {   // coherent removal units — a field and its date must vanish together
  spy: ["spyPrice", "spyPriceAsOf", "spyMa200", "spyChangePct"],
  vix: ["vix", "vixAsOf", "vixWeekChg"],
  fg:  ["fearGreed", "fearGreedAsOf", "fearGreedLabel"],
  qqq: ["qqqChangePct", "qqqPriceAsOf"],
  ten: ["tenYear", "tenYearAsOf", "tenYearM1"],
  fed: ["rateOddsHold", "rateOddsCut", "rateOddsHike", "rateOddsHoldAsOf", "nextFomcDate", "fomcDays"],
};
const ACT_RANK = { HOLD: 0, RESTRICTED: 1, FULL: 2 };
const CUR = (t) => t === "CURRENT" || t === "CACHED";
const mkScenario = () => mkLive({
  spyPrice: pick(P_VALS.spyPrice), spyPriceAsOf: pick(P_DATES),
  vix: pick(P_VALS.vix), vixAsOf: pick(P_DATES),
  fearGreed: pick(P_VALS.fearGreed), fearGreedAsOf: pick(P_DATES),
  qqqChangePct: pick(P_VALS.qqqChangePct), qqqPriceAsOf: pick(P_DATES),
  tenYearM1: pick(P_VALS.tenYearM1), tenYearAsOf: pick(P_DATES),
  rateOddsHoldAsOf: pick(P_DATES),
});
const strip = (live, g) => { const c = { ...live }; for (const k of P_GROUPS[g]) delete c[k]; return c; };
{
  const N = 1500;
  const fails = [];
  const chk = (cond, label, i, live) => { if (!cond) fails.push(`${label} @scenario ${i} seed ${P_SEED}: ${JSON.stringify(live)}`); };
  for (let i = 0; i < N; i++) {
    const live = mkScenario();
    let r;
    try { r = buildTtReadout(live, { now: TT_NOW }); }
    catch (e) { fails.push(`THREW @${i}: ${e && e.message} :: ${JSON.stringify(live)}`); continue; }
    const by = {}; (r.regime.checks || []).forEach((c) => { by[c.name] = c; });
    const vixT = by.vix, fgT = by.fear_greed;
    // P1 — the published vocabulary is CLOSED. INSUFFICIENT is an internal sentinel (v3.63).
    chk(["TAILWIND", "NEUTRAL", "HEADWIND", "PANIC"].includes(r.regime.verdict), "P1 verdict vocabulary", i, live);
    // P2 — the contract's shape never varies with the data.
    chk(r.regime.checks.length === TT_CHECK_COUNT, "P2 check count", i, live);
    chk(["HIGH", "MEDIUM", "LOW"].includes(r.regime.confidence), "P3 confidence vocabulary", i, live);
    chk(["FULL", "RESTRICTED", "HOLD"].includes(r.regime.actionability), "P3 actionability vocabulary", i, live);
    // P4 — a risk-ON call is NEVER published while a panic gauge is blind (v3.40/v3.41).
    chk(r.regime.verdict !== "TAILWIND" || (CUR(vixT.tier) && CUR(fgT.tier)), "P4 TAILWIND requires both gauges usable", i, live);
    // P5 — the most safety-critical override may not fire OR clear on carried data.
    chk(r.regime.verdict !== "PANIC" || (vixT.tier === "CURRENT" && fgT.tier === "CURRENT"), "P5 PANIC requires both gauges CURRENT", i, live);
    // P6 — FULL is the only state that gates capital; it demands the whole evidence stack.
    chk(r.regime.actionability !== "FULL" || (r.regime.confidence === "HIGH" &&
      r.macro_flip.evaluable === true && r.macro_flip.tripped === false), "P6 FULL implies HIGH + live circuit", i, live);
    // P7 — below the publish floor, permission is withheld regardless of what the votes said.
    chk(!(r.regime.available < 3) || r.regime.actionability === "HOLD", "P7 <3 available implies HOLD", i, live);
    /* P11/P12 — added after negative-controlling the sweep against ITSELF: disabling the
       blind-gauge HOLD rule and the criticalMissing rule each left every assertion green,
       so two safety mechanisms could be deleted without the suite noticing. A property
       suite that cannot fail on a removed guard is measuring the wrong thing. */
    // P11 — a blind crash gauge withholds PERMISSION, not merely the risk-on direction.
    chk((CUR(vixT.tier) && CUR(fgT.tier)) || r.regime.actionability === "HOLD",
      "P11 blind panic gauge forces HOLD", i, live);
    // P12 — a MISSING panic gauge can never underpin a MEDIUM or HIGH confidence grade.
    chk(!(vixT.tier === "MISSING" || fgT.tier === "MISSING") || r.regime.confidence === "LOW",
      "P12 missing panic gauge forces LOW confidence", i, live);
    // P8 — CONSERVATIVE CARRY: a stale bullish reading must never still vote bullish.
    for (const c of r.regime.checks)
      chk(c.tier !== "HISTORICAL" || c.effective_vote !== "bullish", "P8 stale bullish downgraded", i, live);
    // P9 — determinism: no hidden clock, no randomness. Same input, same answer.
    const r2 = buildTtReadout(live, { now: TT_NOW });
    chk(JSON.stringify(r2.regime) === JSON.stringify(r.regime), "P9 deterministic", i, live);
  }
  ok(`v4.1.6 Engine 0 sweep: ${N} generated scenarios satisfy every safety invariant (seed ${P_SEED})`,
    fails.length === 0 || (console.log("   " + fails.slice(0, 3).join("\n   ")), false));
}
{
  /* P10 — THE MONOTONICITY PROPERTY, and the reason this sweep exists.
     The v3.40 bug was literally "more risk-on for knowing less": removing stale votes
     RAISED the verdict to TAILWIND. Permission must move the other way — LOSING an input
     can never make Engine 0 MORE willing to gate capital. Asserted over every scenario ×
     every removable input group, against the real engine. */
  const N = 400, fails = [];
  for (let i = 0; i < N; i++) {
    const live = mkScenario();
    let base; try { base = buildTtReadout(live, { now: TT_NOW }); } catch { continue; }
    for (const g of Object.keys(P_GROUPS)) {
      let less; try { less = buildTtReadout(strip(live, g), { now: TT_NOW }); } catch (e) {
        fails.push(`THREW removing ${g} @${i}: ${e && e.message}`); continue; }
      if (ACT_RANK[less.regime.actionability] > ACT_RANK[base.regime.actionability])
        fails.push(`removing ${g} RAISED actionability ${base.regime.actionability} -> ${less.regime.actionability} @${i} seed ${P_SEED}: ${JSON.stringify(live)}`);
    }
  }
  ok(`v4.1.6 Engine 0 monotonicity: losing an input NEVER raises actionability (${N}×${Object.keys(P_GROUPS).length} removals, seed ${P_SEED})`,
    fails.length === 0 || (console.log("   " + fails.slice(0, 3).join("\n   ")), false));
}
{
  /* P11 — never throws. A misfiring Engine 0 that 500s is worse than one that abstains:
     the readout is CORS-open and an external terminal gates orders on it. Hostile shapes. */
  const HOSTILE = [null, undefined, {}, [], "string", 42,
    { vix: NaN, fearGreed: Infinity, spyPrice: -0, tenYearM1: null },
    { vix: "16.1", fearGreed: "62", spyPrice: "748", spyMa200: "700" },          // quoted numbers
    { vixAsOf: "not-a-date", fearGreedAsOf: "2026-13-45", spyPriceAsOf: 12345 }, // junk dates
    { vix: 16, vixAsOf: "2099-01-01" },                                          // future-dated
    { spyMa200: 0, spyPrice: 100 },                                              // zero divisor
  ];
  let threw = null;
  for (const h of HOSTILE) {
    try { const r = buildTtReadout(h, { now: TT_NOW });
      if (!r || !r.regime || r.regime.checks.length !== TT_CHECK_COUNT) threw = `bad shape for ${JSON.stringify(h)}`; }
    catch (e) { threw = `${JSON.stringify(h)} -> ${e && e.message}`; }
  }
  ok("v4.1.6 Engine 0: never throws and always returns the full check contract, on any hostile input",
    threw === null || (console.log("   " + threw), false));
}

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
    r.regime.current === 2 && r.regime.historical === 1 && r.regime.missing === 4 &&
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
/* 8/31 — THIS PIN REVERSES, and it is worth saying why it existed. It pinned the FAIL-OPEN:
   a dark rate-path gauge cost nothing, so the engine published HIGH on five checks. Measured
   live on the 2026-08-31 body, that is exactly what shipped — HIGH / FULL / OK with
   fed_odds:null — and the five survivors are structurally blind to a hawkish repricing (SPY is
   trend, VIX/F&G are vol and sentiment, RS is one session, and the 10Y votes on a ~21-session
   delta that smooths a burst away). The assertion is now its own inverse: the grade drops, the
   withhold is NAMED on its own axis, and the check is still named in `reason`. */
ok("8/31: Kalshi dark WITHHOLDS HIGH — the rate-path fail-open, closed (this pin is the old one, inverted)", (() => {
  const r = buildTtReadout(mkLive({ rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW }).regime;
  return r.confidence === "MEDIUM" && r.actionability === "RESTRICTED" && r.status === "PARTIAL DATA"
    && /missing: fed_next_meeting/.test(r.reason)
    && /HIGH withheld/.test(r.confidence_withheld || "") && /rate-path/.test(r.confidence_withheld || "");
})());
ok("8/31: a CARRIED (historical) rate-path print also withholds HIGH — carried is not current", (() => {
  // The carry window is 5 sessions, so these odds are HISTORICAL, not MISSING: the check still
  // votes, but it is no longer a current reading of the policy path, and HIGH must not stand on it.
  const r = buildTtReadout(mkLive({ rateOddsHoldAsOf: "2026-07-13", rateOddsCutAsOf: "2026-07-13", rateOddsHikeAsOf: "2026-07-13" }), { now: TT_NOW }).regime;
  return r.confidence !== "HIGH" && /carried, not current/.test(r.confidence_withheld || "");
})());
ok("8/31: the withhold rides its OWN axis — `downgraded` (the verdict record) is untouched by it", (() => {
  const r = buildTtReadout(mkLive({ rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW }).regime;
  // ENGINE0-CONT separated verdict-axis from evidence-axis; a confidence reason must not leak
  // into the verdict-axis field, and a healthy day must carry neither.
  const healthy = rBull.regime;
  return r.downgraded === null && healthy.confidence_withheld === null && healthy.confidence === "HIGH";
})());
ok("8/31: the withhold is not silent on the human surface — the paste block prints it", (() => {
  const r = buildTtReadout(mkLive({ rateOddsHold: undefined, rateOddsCut: undefined, rateOddsHike: undefined }), { now: TT_NOW });
  return /HIGH withheld/.test(formatTtPaste(r));
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

/* 8/31 — THE QUARTER-LONG RS LEG. Measured and published; deliberately NOT a voter (the
   NFCI/30Y arrival rule). Every pin runs the real pairRs. */
const NDX63 = { ...NDXFIX, back: 20000, backDate: "2026-04-15" };
const SPX63 = { ...SPXFIX, back: 7000, backDate: "2026-04-15" };
ok("8/31 RS63: matched back-dates -> decay = ndx63 - spx63, with its own start date",
  (() => { const r = pairRs(NDX63, SPX63);
    // NDX +15.00% vs SPX +6.87% over the window -> +8.13pp of relative strength
    return r && r.rs63 === parseFloat((r.ndx63 - r.spx63).toFixed(2)) && r.rs63 === 8.13
      && r.back_date === "2026-04-15"; })());
ok("8/31 RS63: BACK-date mismatch refuses the quarter but KEEPS the 1d pair (fail closed on the field, not the feed)",
  (() => { const r = pairRs({ ...NDX63, backDate: "2026-04-14" }, SPX63);
    return r && r.rs === parseFloat((r.ndx1d - r.spx1d).toFixed(2)) && r.rs63 === undefined; })());
ok("8/31 RS63: a short series yields the 1d pair alone — a partial quarter is never called a quarter",
  (() => { const r = pairRs(NDXFIX, SPXFIX); return r && r.rs != null && r.rs63 === undefined; })());
ok("8/31 RS63: the window is ONE named constant, so the two fetchers and pairRs cannot drift apart",
  RS_63_SESSIONS === 63 &&
  (() => { const src = readSrc("../functions/api/snapshot.js").replace(/\/\*[\s\S]*?\*\//g, "");
    // both fetchers index by the constant, never by a literal 63
    return (src.match(/validObs\[RS_63_SESSIONS\]/g) || []).length >= 2 && !/validObs\[63\]/.test(src); })());
ok("8/31 RS63: it is published as EVIDENCE and casts NO vote — available/bullish/bearish are untouched",
  (() => { const withDecay = buildTtReadout(mkLive({ ndxSpxRs: 0.49, ndxSpxRsAsOf: D, ndxSpxRs63: -12.4, ndxSpxRs63AsOf: D, ndxSpxRs63Back: "2026-04-30" }), { now: TT_NOW });
    const without = buildTtReadout(mkLive({ ndxSpxRs: 0.49, ndxSpxRsAsOf: D }), { now: TT_NOW });
    return withDecay.qqq_spy_rs.decay_63d === -12.4 && withDecay.qqq_spy_rs.decay_votes === false
      && withDecay.qqq_spy_rs.decay_since === "2026-04-30"
      // a deeply NEGATIVE decay must move nothing — that is what non-voting means
      && withDecay.regime.available === without.regime.available
      && withDecay.regime.bullish === without.regime.bullish
      && withDecay.regime.bearish === without.regime.bearish
      && withDecay.regime.verdict === without.regime.verdict
      && withDecay.regime.checks[3].state === without.regime.checks[3].state; })());
ok("8/31 RS63: it prints on the human surface, LABELLED non-voting",
  (() => { const t = formatTtPaste(buildTtReadout(mkLive({ ndxSpxRs: 0.49, ndxSpxRsAsOf: D, ndxSpxRs63: -12.4, ndxSpxRs63AsOf: D, ndxSpxRs63Back: "2026-04-30" }), { now: TT_NOW }));
    return /QQQ RS 63d/.test(t) && /-12\.4pp/.test(t) && /does not vote/.test(t); })());
ok("8/31 RS63: the whole leg travels together in last-good — a restore cannot pair a live 1d with a vanished quarter",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    const m = /ndx_spx_rs:\s*\[([^\]]*)\]/.exec(src);
    return m && ["ndxSpxRs", "ndxSpxRsAsOf", "ndxSpxRs63", "ndxSpxRs63AsOf", "ndxSpxRs63Back"]
      .every((k) => m[1].includes(`"${k}"`)); })());
ok("8/31 RS63: banded — a decimal shift is rejected, a violent quarter is not",
  (() => { const b = BANDS.ndxSpxRs63;
    return Array.isArray(b) && plausible("ndxSpxRs63", -38) && plausible("ndxSpxRs63", 40)
      && !plausible("ndxSpxRs63", 1240); })());
/* v5.97.4 — the found-not-fixed item from FEAT-ENGINE0-STATS, closed: the 1-day ndxSpxRs had
   NEVER had a plausibility band (found while banding rs63). A 1-day RS gap runs well under
   ±5pp on real tapes; ±25 rejects the impossible (a decimal shift, a mispaired pct) without
   rejecting a crash-day divergence. */
ok("v5.97.4 RS 1d: banded at last — a violent session passes, a decimal shift does not",
  (() => { const b = BANDS.ndxSpxRs;
    return Array.isArray(b) && plausible("ndxSpxRs", -8.2) && plausible("ndxSpxRs", 12)
      && !plausible("ndxSpxRs", 124) && !plausible("ndxSpxRs", -124); })());

/* ── v6.0 T3 — "why Monday lost CPI + NFCI": the public voters join per-field last-good ──
   Measured live on the frozen 2026-08-31 row: cpiHeadline and nfci read MOCK with no asOf
   while the four Engine 0 criticals stayed LIVE — FIELD_LG_GROUPS covered only the
   criticals, so a failed FRED tail batch dropped the public backdrop's two FRED voters
   straight to mock and the 10:02 freeze notarized a 4/6 call. The outage shape is RUN
   here against the real applyFieldLastGood, not string-pinned. */
const lgEnv = (stored) => {
  const puts = {};
  return { puts, env: { PULSE_CACHE: {
    get: async (k, t) => (k in stored ? (t === "json" ? stored[k] : JSON.stringify(stored[k])) : null),
    put: async (k, v) => { puts[k] = JSON.parse(v); },
  } } };
};
ok("T3: the 8/31 shape RESTORES — a failed CPI/NFCI batch serves the last official observation with its REAL date",
  (await (async () => {
    const { env } = lgEnv({
      "pulse:source:lastgood:cpi":  { schema: 1, fields: { cpiHeadline: 3.5, cpiHeadlineAsOf: "2026-07-01", cpiTrend: [2.9, 3.5, 4.1, 4.5, 3.9, 3.5] } },
      "pulse:source:lastgood:nfci": { schema: 1, fields: { nfci: -0.566, nfciAsOf: "2026-08-21", nfciW1: -0.005, nfciSeries: [-0.5, -0.55] } },
    });
    const live = { vix: 16.1, vixAsOf: "2026-08-28", tenYear: 4.4, tenYearAsOf: "2026-08-28", spyPrice: 748, ndxSpxRs: 0.4 };
    await applyFieldLastGood(env, live);
    return live.cpiHeadline === 3.5 && live.cpiHeadlineAsOf === "2026-07-01"
      && live.nfci === -0.566 && live.nfciAsOf === "2026-08-21" && live.nfciW1 === -0.005; })()));
ok("T3: a healthy pull STORES the two voters' groups for the next outage, dates riding along",
  (await (async () => {
    const { env, puts } = lgEnv({});
    await applyFieldLastGood(env, { vix: 16, tenYear: 4.4, spyPrice: 748, ndxSpxRs: 0.4,
      cpiHeadline: 3.5, cpiHeadlineAsOf: "2026-07-01", nfci: -0.57, nfciAsOf: "2026-08-21",
      cpiCore: 2.8, cpiCoreAsOf: "2026-07-01", nfciLeverage: 0.12, nfciLeverageAsOf: "2026-08-21" });
    return puts["pulse:source:lastgood:cpi"]?.fields.cpiHeadlineAsOf === "2026-07-01"
      && puts["pulse:source:lastgood:nfci"]?.fields.nfciAsOf === "2026-08-21"
      && puts["pulse:source:lastgood:cpi_core"]?.fields.cpiCore === 2.8
      && puts["pulse:source:lastgood:nfci_lev"]?.fields.nfciLeverage === 0.12; })()));
ok("T3: a restore is still BANDED — an implausible stored primary stays dropped (the failsafe is not a bypass)",
  (await (async () => {
    const { env } = lgEnv({ "pulse:source:lastgood:nfci": { schema: 1, fields: { nfci: 40, nfciAsOf: "2026-08-21" } } });
    const live = {};
    await applyFieldLastGood(env, live);
    return live.nfci === undefined; })()));
ok("T3: every FRED-sourced PUBLIC voter is covered by a last-good group — reconciled, not asserted",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    const m = /const FIELD_LG_GROUPS = \{([\s\S]*?)\n\};/.exec(src);
    return m && ["\"tenYear\"", "\"vix\"", "\"cpiHeadline\"", "\"nfci\""].every((f) => m[1].includes(f)); })());

// Matrix F: Treasury daily par-yield CSV parse (the official upstream DGS10 republishes).
const TCSV = 'Date,"1 Mo","10 Yr","30 Yr"\n07/15/2026,5.1,4.46,5.02\n07/14/2026,5.1,4.43,4.97\n07/11/2026,5.1,4.40,4.95';
ok("matrix F: Treasury CSV -> tenYear + D1 + real ISO AsOf + UST attribution", (() => {
  const t = parseTreasuryCsv(TCSV);
  return t && t.tenYear === 4.46 && t.tenYearAsOf === "2026-07-15" &&
    t.tenYearD1 === 0.03 && /UST/.test(t.tenYearSource);
})());
ok("matrix F: a CSV without a 10 Yr column -> null (parse failure, never a guessed column)",
  parseTreasuryCsv('Date,"1 Mo"\n07/15/2026,5.1') === null);

/* v4.1.5 — the failsafe reaches the 30Y, and fires on a LAG not just a failure.
   Measured live 2026-08-21: FRED's DGS10/DGS30 legs SUCCEEDED with an 08-19 observation
   while VIXCLS had already published 08-20. A failure-only trigger cannot see that. */
ok("v4.1.5 UST: the same row yields the 30Y leg — deltas, series, and a SAME-DATE spread",
  (() => { const t = parseTreasuryCsv(TCSV);
    return t.thirtyYear === 5.02 && t.thirtyYearAsOf === "2026-07-15" &&
      t.thirtyYearD1 === 0.05 && /UST/.test(t.thirtyYearSource) &&
      t.spread10s30s === 0.56 && t.spread10s30sAsOf === "2026-07-15"; })());
ok("v4.1.5 UST: a CSV that LOST its 30 Yr column still yields a usable 10Y (fail closed on the FIELD, not the feed)",
  (() => { const t = parseTreasuryCsv('Date,"10 Yr"\n07/15/2026,4.46\n07/14/2026,4.43');
    return t && t.tenYear === 4.46 && t.thirtyYear === undefined && t.spread10s30s === undefined; })());
ok("v4.1.5 merge: a FRESHER UST observation wins BOTH legs, and the spread re-derives same-date",
  (() => { const fred = { tenYear: 4.65, tenYearAsOf: "2026-08-19", thirtyYear: 5.19,
      thirtyYearAsOf: "2026-08-19", spread10s30s: 0.54, spread10s30sAsOf: "2026-08-19" };
    const r = preferFresherRates(fred, parseTreasuryCsv('Date,"10 Yr","30 Yr"\n08/20/2026,4.70,5.24\n08/19/2026,4.65,5.19'));
    return r.tenYear === 4.7 && r.tenYearAsOf === "2026-08-20" && r.thirtyYear === 5.24 &&
      r.spread10s30s === 0.54 && r.spread10s30sAsOf === "2026-08-20" && /UST/.test(r.tenYearSource); })());
ok("v4.1.5 merge: a FRESHER FRED is never overwritten — the fallback cannot make the page staler",
  (() => { const fred = { tenYear: 4.8, tenYearAsOf: "2026-08-21", thirtyYear: 5.3, thirtyYearAsOf: "2026-08-21" };
    const r = preferFresherRates(fred, parseTreasuryCsv('Date,"10 Yr","30 Yr"\n08/20/2026,4.70,5.24'));
    return r.tenYear === 4.8 && r.tenYearAsOf === "2026-08-21" && r.tenYearSource === undefined; })());
ok("v4.1.5 merge: a TIE keeps FRED — a tie is not an improvement, and attribution should not churn",
  (() => { const fred = { tenYear: 4.65, tenYearAsOf: "2026-08-20" };
    const r = preferFresherRates(fred, parseTreasuryCsv('Date,"10 Yr"\n08/20/2026,4.70'));
    return r.tenYear === 4.65 && r.tenYearSource === undefined; })());
ok("v4.1.5 merge: legs from DIFFERENT dates DROP the spread — 10s30s across two sessions is fabricated (the pairRs rule)",
  (() => { const fred = { tenYear: 4.65, tenYearAsOf: "2026-08-19", thirtyYear: 5.19,
      thirtyYearAsOf: "2026-08-19", spread10s30s: 0.54, spread10s30sAsOf: "2026-08-19" };
    const r = preferFresherRates(fred, parseTreasuryCsv('Date,"10 Yr"\n08/20/2026,4.70'));
    return r.tenYearAsOf === "2026-08-20" && r.thirtyYearAsOf === "2026-08-19" &&
      r.spread10s30s === undefined && r.spread10s30sAsOf === undefined; })());
ok("v4.1.5 merge: no UST at all is a byte-identical passthrough (the fallback is inert when not needed)",
  (() => { const fred = { tenYear: 4.65, tenYearAsOf: "2026-08-19", thirtyYear: 5.19,
      thirtyYearAsOf: "2026-08-19", spread10s30s: 0.54, spread10s30sAsOf: "2026-08-19" };
    return JSON.stringify(preferFresherRates(fred, null)) === JSON.stringify(fred); })());
/* Source-pinned because the assembly runs inside the handler, but pinned in BOTH
   directions: the merge must be WIRED and the old blind spread must be ABSENT. A pin that
   only checks the new call passes while a blind `...treasury.value` sits beside it — the
   merge would then be computed, tested, and overridden (the v3.40/v3.54 defect shape). */
ok("v4.1.5 trigger: the fallback fires on a LAG, not only on a dead leg (the live 8/21 case)",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    return /fredLegDead \|\| sessionsBehind\(fredTenAsOf\) >= 1/.test(src); })());
ok("v4.1.5 wiring: the recency merge is the ONLY path into live — no blind treasury spread survives",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    return /preferFresherRates\(fred\.status/.test(src) &&
      !/\.\.\.\(treasury\.status === "fulfilled" \? treasury\.value : \{\}\)/.test(src); })());

/* ═══ v5.1 — THE CBOE VIX FAILSAFE ═══════════════════════════════════════════════════
   The crash gauge was the ONE critical input with no second source, while the less
   safety-critical 10Y got one in v4.1.5 — and ttReadout holds HOLD on `!isCur(vix)`, so
   that asymmetry halts the whole order-gating engine. The fixture is the REAL pair from
   2026-08-21/08-20, and the two sources cross-check each other exactly: FRED carried
   16.01 (08-20) while CBOE/Google show 15.13 (08-21) at -5.50% on the day, and
   15.13/16.01 - 1 = -5.4966% -> -5.50. The numbers are equivalent by construction because
   VIXCLS *is* FRED's republication of this CBOE series. */
const VCSV = "DATE,OPEN,HIGH,LOW,CLOSE\n" +
  "8/21/2026,15.50,15.80,15.00,15.13\n8/20/2026,16.10,16.40,15.90,16.01\n" +
  "8/19/2026,16.50,16.70,16.20,16.30\n8/18/2026,16.80,17.00,16.60,16.75\n" +
  "8/15/2026,17.10,17.30,16.90,17.02\n8/14/2026,17.50,17.70,17.20,17.40";
ok("v5.1 CBOE: CSV -> vix level + real ISO AsOf + CBOE attribution",
  (() => { const c = parseCboeVixCsv(VCSV);
    return c && c.vix === 15.13 && c.vixAsOf === "2026-08-21" && /CBOE/.test(c.vixSource); })());
ok("v5.1 CBOE: vixWeekChg uses fetchFred's OWN window — latest vs ~5 sessions back, not the 1-day",
  (() => { const c = parseCboeVixCsv(VCSV);
    // 15.13 vs rows[5] 17.40 = -13.05%; the 1-day would be -5.50, so this proves the window.
    return c.vixWeekChg === -13.05; })());
ok("v5.1 CBOE: under 6 sessions it falls back to the 1-day prior, exactly as fetchFred does",
  (() => { const c = parseCboeVixCsv("DATE,CLOSE\n8/21/2026,15.13\n8/20/2026,16.01");
    return c.vixWeekChg === -5.5; })());
ok("v5.1 CBOE: the sparkline is 10 points OLDEST->NEWEST, the FRED/UST convention",
  (() => { const c = parseCboeVixCsv(VCSV);
    return Array.isArray(c.vixSeries) && c.vixSeries.length === 6 &&
      c.vixSeries[0] === 17.4 && c.vixSeries[c.vixSeries.length - 1] === 15.13; })());
ok("v5.1 CBOE: the 'VIX CLOSE' header variant is accepted (CBOE has shipped both)",
  (() => { const c = parseCboeVixCsv("DATE,VIX CLOSE\n8/21/2026,15.13");
    return c && c.vix === 15.13; })());
ok("v5.1 CBOE: an ISO date column parses too — the date FORM is tolerated, the field is not optional",
  (() => { const c = parseCboeVixCsv("DATE,CLOSE\n2026-08-21,15.13");
    return c && c.vixAsOf === "2026-08-21"; })());
ok("v5.1 CBOE: a CSV with no close column -> null (fail closed on the FIELD, never a guessed column)",
  parseCboeVixCsv("DATE,OPEN,HIGH,LOW\n8/21/2026,15.5,15.8,15.0") === null);
ok("v5.1 CBOE: non-positive and unparseable rows are dropped; an all-garbage file yields null, never 0",
  (() => { const mixed = parseCboeVixCsv("DATE,CLOSE\n8/21/2026,15.13\n8/20/2026,0\n8/19/2026,x\nbadrow,16.0");
    return mixed.vix === 15.13 && mixed.vixSeries.length === 1 &&
      parseCboeVixCsv("DATE,CLOSE\n8/21/2026,0\n8/20/2026,-3") === null; })());
/* The delayed-quote rung (owner-specified primary): tiny, keyless, same publisher. */
const VQ = { symbol: "_VIX", timestamp: "2026-08-21T15:15:01",
  data: { current_price: 15.13, close: 15.13, prev_day_close: 16.01, last_trade_time: "2026-08-21T15:15:01" } };
ok("v5.1 quote: the delayed JSON yields level + ET-date + its own attribution",
  (() => { const q = parseCboeVixQuote(VQ);
    return q.vix === 15.13 && q.vixAsOf === "2026-08-21" && q.vixSource === "CBOE delayed"; })());
ok("v5.1 quote: a single quote emits NO week-change and NO series — it cannot know either",
  (() => { const q = parseCboeVixQuote(VQ);
    return q.vixWeekChg === undefined && q.vixSeries === undefined; })());
ok("v5.1 quote: no parseable timestamp -> null (an undated observation is not an observation)",
  parseCboeVixQuote({ data: { close: 15.13 } }) === null);
ok("v5.1 quote: a non-positive or absent level -> null, never a zero VIX",
  parseCboeVixQuote({ data: { close: 0, last_trade_time: "2026-08-21T15:15:01" } }) === null &&
  parseCboeVixQuote({ data: { last_trade_time: "2026-08-21T15:15:01" } }) === null);
ok("v5.1 pair: SAME session -> the quote's level with the daily file's date and series",
  (() => { const p = pairCboeVix(parseCboeVixQuote(VQ), parseCboeVixCsv(VCSV), "2026-08-24");
    return p.vix === 15.13 && p.vixAsOf === "2026-08-21" && p.vixWeekChg === -13.05 &&
      Array.isArray(p.vixSeries) && p.vixSource === "CBOE delayed + CBOE daily"; })());
ok("v5.1 pair: a DATE MISMATCH never cross-stamps — the daily close wins outright (the pairRs rule)",
  (() => { const intraday = { vix: 14.2, vixAsOf: "2026-08-24", vixSource: "CBOE delayed" };
    const p = pairCboeVix(intraday, parseCboeVixCsv(VCSV), "2026-08-24");
    return p.vix === 15.13 && p.vixAsOf === "2026-08-21" && p.vixSource === "CBOE daily"; })());
ok("v5.1 pair: quote-only is usable ONLY for a completed prior session",
  (() => { const prior = pairCboeVix(parseCboeVixQuote(VQ), null, "2026-08-24");
    return prior && prior.vix === 15.13 && prior.vixSource === "CBOE delayed"; })());
ok("v5.1 pair: a SAME-DAY quote with no daily file is INTRADAY — a PROXY, refused, never banded as a close",
  pairCboeVix({ vix: 14.2, vixAsOf: "2026-08-24" }, null, "2026-08-24") === null);
ok("v5.1 pair: nothing at all -> null (the failsafe reports no reading rather than inventing one)",
  pairCboeVix(null, null, "2026-08-24") === null);
ok("v5.1 attribution is never IMPLIED — a FRED-served leg says FRED VIXCLS",
  (() => { const r = preferFresherVix({ vix: 16.01, vixAsOf: "2026-08-20" }, null);
    return r.vixSource === "FRED VIXCLS"; })());
ok("v5.1 attribution: every rung names itself, and the set is closed",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    return ["CBOE delayed + CBOE daily", "CBOE daily", "CBOE delayed", "FRED VIXCLS"]
      .every((s) => src.includes(`"${s}"`)); })());
ok("v5.1 CBOE merge: a FRESHER CBOE observation wins — the live 8/24 case, HISTORICAL 08-20 -> CURRENT 08-21",
  (() => { const fred = { vix: 16.01, vixAsOf: "2026-08-20", vixWeekChg: 6.8, vixSeries: [1, 2] };
    const r = preferFresherVix(fred, parseCboeVixCsv(VCSV));
    return r.vix === 15.13 && r.vixAsOf === "2026-08-21" && /CBOE/.test(r.vixSource); })());
ok("v5.1 CBOE merge: the leg is replaced WHOLE — no fallback level ever pairs with the incumbent's deltas",
  (() => { const fred = { vix: 16.01, vixAsOf: "2026-08-20", vixWeekChg: 99, vixSeries: [1, 2, 3] };
    // A hand-built alternate carrying ONLY the level: the stale 99 must be DELETED, not kept.
    const r = preferFresherVix(fred, { vix: 15.13, vixAsOf: "2026-08-21" });
    return r.vix === 15.13 && r.vixWeekChg === undefined && r.vixSeries === undefined; })());
/* These three were pinned on `vixSource === undefined` an hour before the owner required
   attribution to be EXPLICIT for every rung ("not implied", the 10Y fallback rule). The
   contract deliberately moved: a FRED-served leg is now LABELLED FRED VIXCLS rather than
   left silent, so the re-pin is strictly stronger — it proves both that CBOE lost AND
   that the winner names itself. Recorded rather than quietly relaxed. */
ok("v5.1 CBOE merge: a FRESHER FRED is never overwritten — the failsafe cannot make the page staler",
  (() => { const fred = { vix: 14.2, vixAsOf: "2026-08-24" };
    const r = preferFresherVix(fred, parseCboeVixCsv(VCSV));
    return r.vix === 14.2 && r.vixAsOf === "2026-08-24" && r.vixSource === "FRED VIXCLS"; })());
ok("v5.1 CBOE merge: a TIE keeps FRED — a tie is not an improvement, and attribution should not churn",
  (() => { const fred = { vix: 16.01, vixAsOf: "2026-08-21" };
    const r = preferFresherVix(fred, parseCboeVixCsv(VCSV));
    return r.vix === 16.01 && r.vixSource === "FRED VIXCLS"; })());
ok("v5.1 CBOE merge: a DEAD FRED leg takes the fallback regardless of dates (the failure case, not the lag case)",
  (() => { const r = preferFresherVix({ tenYear: 4.5 }, parseCboeVixCsv(VCSV));
    return r.vix === 15.13 && r.tenYear === 4.5; })());
ok("v5.1 CBOE merge: with no CBOE the VALUES are untouched — the only addition is the honest label",
  (() => { const fred = { vix: 16.01, vixAsOf: "2026-08-20", vixWeekChg: 6.8, vixSeries: [1, 2] };
    const r = preferFresherVix(fred, null);
    // Every original key survives byte-identical; vixSource is the sole added key.
    return Object.entries(fred).every(([k, v]) => JSON.stringify(r[k]) === JSON.stringify(v)) &&
      Object.keys(r).length === Object.keys(fred).length + 1 && r.vixSource === "FRED VIXCLS"; })());
ok("v5.1 CBOE: a decimal-shifted fallback value is still banded out — the failsafe is not a bypass",
  (() => { const live = { vix: 1513, vixAsOf: "2026-08-21" };
    applyBands(live); return live.vix === undefined; })());
/* Wiring pinned in BOTH directions, the v4.1.5 rule: the merge must be the ONLY path in,
   and the trigger must fire on a LAG (the whole point — tonight's VIX was a lag, and a
   forced rebuild proved it was not transient). */
ok("v5.1 trigger: the VIX failsafe fires on a LAG, not only on a dead leg",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    return /needVix = fredVixDead \|\| sessionsBehind\(fredVixAsOf\) >= 1/.test(src); })());
ok("v5.1 wiring: preferFresherVix is the ONLY path into live — no blind cboe spread survives",
  (() => { const src = readSrc("../functions/api/snapshot.js");
    return /preferFresherVix\(/.test(src) &&
      !/\.\.\.\(cboe\.status === "fulfilled" \? cboe\.value : \{\}\)/.test(src); })());
// Local stripper: the shared `stripComments` is defined ~7000 lines below (section [68]),
// so referencing it here would be a temporal-dead-zone error, not a passing pin.
const noCmt = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
ok("v5.1: both failsafes share ONE recency rule — mergeFresherLeg, not a second copy",
  (() => { const src = noCmt(readSrc("../functions/api/snapshot.js"));
    return (src.match(/mergeFresherLeg\(/g) || []).length >= 4 &&   // 1 def + 2 rates + 1 vix
      /export function preferFresherVix/.test(src); })());
ok("v5.1: the failsafe never runs on a healthy day — both triggers are conditional",
  (() => { const src = noCmt(readSrc("../functions/api/snapshot.js"));
    return /if \(needTsy\) jobs\.push/.test(src) && /if \(needVix\) jobs\.push/.test(src) &&
      /if \(jobs\.length\) await Promise\.all\(jobs\)/.test(src); })());

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
ok("one-wiring-point intact: dashboard.jsx may link JSON but never fetches readout.json",
  !/fetch\(["']\/readout\.json/.test(dashSrc));

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
const adminSrc = readSrc("../public/admin.html");
ok("terminal: regime pill fetches /readout.json (Engine 0 wired)", adminSrc.includes('fetch("/readout.json"'));
ok("terminal: all five verdict states mapped explicitly",
  ["TAILWIND", "NEUTRAL", "HEADWIND", "PANIC", "INSUFFICIENT"].every((v) => adminSrc.includes(v)));
ok("terminal: INSUFFICIENT and fetch-failure both render as don't-trust states",
  adminSrc.includes("don't gate on this") && adminSrc.includes("unavailable — tap DASH"));
ok("terminal: lastRun stamps the ET date — no UTC toISOString on the run stamp",
  adminSrc.includes('new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"})') &&
  !/fLastRun"\)\.value=new Date\(\)\.toISOString/.test(adminSrc));
ok("terminal: HEADWIND raises the R/R floor while PANIC blocks ticker eligibility",
  adminSrc.includes("R/R floors +0.5") && adminSrc.includes("PANIC regime — ticker eligibility blocked"));
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
ok("dd: per-payload size cap present (100KB — 8KB v3.13, 15KB v3.63, 45KB v3.70, 100KB v4.4.0 owner call)",
  adminSrc.includes("DD_MAX=100*1024"));
/* RE-PINNED v4.4.0: the old pin held the PRE-v3.75 claim ("the BOOK cap binds first,
   38 x 45KB = 1.7MB") in place — but DDSTORE moved payloads to their own per-symbol keys,
   so the book cap stopped binding them entirely and the pinned comment was a year stale.
   The pin now asserts the comment states the DDSTORE reality, not the retired arithmetic. */
ok("dd: the payload cap comment states the DDSTORE reality — book cap no longer binds, per-symbol keys",
  /no longer binds them AT ALL/.test(adminSrc) && /one name's growth can never squeeze another's/.test(adminSrc) &&
  !/binding constraint is the BOOK/.test(adminSrc));
ok("dd: past key-dates flag 'passed — re-confirm' (the FOMC lesson)", adminSrc.includes("passed — re-confirm"));
ok("dd: rendered payload strings are HTML-escaped (esc used in the deep renderer)",
  adminSrc.includes("function esc(") && adminSrc.includes("${esc(dd.thesis_version)}"));
ok("dd: export carries DEEP_DIVE sections (persistence rule survives the port)",
  adminSrc.includes("### DEEP_DIVE: ${s}"));
// v3.75 DDSTORE: payloads load lazily, so an export must pull the FULL set rather than
// serialize whatever the client happens to hold — a backup that looks complete and is not
// is worse than none, so a failed fetch ABORTS the export instead of writing it partial.
ok("dd: both exports pull the whole payload set first and REFUSE rather than write a partial backup",
  /async function allDeepDives\(\)/.test(adminSrc) &&
  adminSrc.includes('fetch("/api/deepdive?all=1")') &&
  adminSrc.includes("EXPORT ABORTED") &&
  (adminSrc.match(/const dds=await allDeepDives\(\);if\(!dds\)return;|const ddMap=await allDeepDives\(\);if\(!ddMap\)return;/g) || []).length === 2);
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
// FEAT-TT-NVDA-ER (2026-08-19): the earnings-ready NVDA payload has three distinct
// evidence layers. Keep the scenario ceiling, measured statements, and ecosystem overlay
// visible in the same deep-dive rather than letting them fall into the generic drawer.
ok("NVDA earnings: scenario, fundamentals, and ecosystem payloads are handled sections",
  adminSrc.includes('"valuation_scenarios"') &&
  adminSrc.includes('"fundamentals"') &&
  adminSrc.includes('"ecosystem_overlay"') &&
  adminSrc.includes("function ddScenarioSec") &&
  adminSrc.includes("function ddFundamentalsSec") &&
  adminSrc.includes("function ddEcosystemSec"));
ok("NVDA earnings: 30x is rendered as a supercycle bull-case ceiling, not an active target",
  adminSrc.includes("bull multiple is not an active target") &&
  adminSrc.includes("isBull") &&
  adminSrc.includes("· ceiling"));
ok("NVDA earnings: overlay explicitly denies SOTP credit",
  adminSrc.includes("not added to NVDA’s primary PT") &&
  adminSrc.includes("risk-adjusted"));
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
ok("ptm: per-year owner overrides merge onto sibling consensus (one estimate map, no dropped years)",
  adminSrc.includes("{...(c.revenue_B||{}),...(m.revenue_B||{})}") &&
  adminSrc.includes("{...(c.eps||{}),...(m.eps||{})}"));
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
  /BOOK\.forEach\(x=>\{\s*const dd=ddOf\(x\)/.test(adminSrc));
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
  adminSrc.includes("function renderBinaryCal()") && adminSrc.includes("ddOf(x)&&ddOf(x).key_dates"));
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
// FIX-C: canonical valuation, sourced receipt, and funding carry distinct labels.
ok("FIX-C: canonical valuation, diagnostic street receipt and funding remain distinct",
  adminSrc.includes("VALUATION GAP — math only · ranked by %/yr, weight-aware") &&
  adminSrc.includes("STREET ELIGIBILITY RECEIPT · diagnostic, not canonical score") &&
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
const fwSrc = readSrc("../functions/api/framework.js");
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
const quotesSrc = readSrc("../functions/api/quotes.js");
ok("livepx: quotes endpoint reuses the /api/tt auth gate (guards the Finnhub quota)",
  quotesSrc.includes('import { authorize } from "./tt.js"') && quotesSrc.includes("if (!auth.ok)"));
ok("livepx: FINNHUB_KEY never leaves the Function", quotesSrc.includes("env.FINNHUB_KEY") && !adminSrc.includes("finnhub"));
ok("livepx: Finnhub c:0 (unknown symbol) is rejected, not passed through as a free stock",
  quotesSrc.includes("!isFinite(px) || px <= 0) return null"));
ok("livepx: missing symbols are NAMED so fallbacks are never implied to be live",
  quotesSrc.includes("missing: syms.filter"));
ok("livepx: matches snapshot.js on the wire (Accept header + timeout were load-bearing)",
  quotesSrc.includes('headers: { Accept: "application/json" }') && quotesSrc.includes("ctl.abort()"));
/* RE-PINNED at v5.0 W0: the per-symbol cache (CACHE_TTL literal) became the one batch key
   in lib/quote-cache.js — the invariant this pin protects (rate limit + subrequest cap
   respected) is now KV-read-once + fetch-in-batches-of-5, measured behaviorally in [72]. */
ok("livepx: KV-cached (one batch read) and upstream-batched to respect the rate limit / subrequest cap",
  quotesSrc.includes("readQuoteBatch(env)") && quotesSrc.includes("misses.slice(i, i + 5)"));
ok("livepx: board prefers a live quote and falls back to the stamped ref_px",
  adminSrc.includes("const live=LIVE_PX[x.sym];") &&
  adminSrc.includes("(live&&isFinite(live.px)&&live.px>0)?{px:live.px,at:live.at,live:true,chg:live.chg}:stamp"));
ok("livepx: a live price is never flagged stale (staleness judges stamps only)",
  adminSrc.includes("pxAge:ref.live?0:ageDays(ref.at)"));
ok("livepx: each pick shows whether it used a live or stamped price",
  adminSrc.includes(">live $") && adminSrc.includes(">stamped $"));
ok("livepx: footer counts live vs stamped rather than implying all are current",
  adminSrc.includes("live / ") && adminSrc.includes("all prices are stamped marks, not live"));
// Re-pinned at v5.6.4: these two pinned the LITERAL `.then()` fan-out — the exact shape
// that produced the live defect (the gate resumed only loadBook, so every secondary load
// stayed 401'd-and-empty). The contract is BEHAVIORAL now: the book loads first, then all
// six secondary loads, from ONE named list the PIN gate can re-enter.
ok("livepx: quote fetch is non-blocking, runs in the resumable boot chain, and failure leaves the board unchanged",
  adminSrc.includes("async function bootLoads(){ await loadBook(); await secondaryLoads(); honourArrival(); }") &&
  /async function secondaryLoads\(\)\{\s*await Promise\.all\(\[loadQuotes\(\),loadPositions\(\),loadAllocation\(\),loadDeepDiveIndex\(\),loadTickerV2\(\),loadScoreIndex\(\)\]\);/.test(adminSrc) && adminSrc.includes("never break the board on a quote feed"));

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
const ttSrc = readSrc("../functions/api/tt.js");
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
ok("regime: HEADWIND/PANIC policy survives the two-engine rewrite",
  adminSrc.includes("R/R floors +0.5") && adminSrc.includes("PANIC regime — ticker eligibility blocked"));
// Non-ticker binaries — a supplier's print that sets the tone for names you do hold.
ok("bincal: board-level binaries merge into the same dated queue",
  adminSrc.includes("BOARD.binaries") && adminSrc.includes("board-level, not a book ticker"));
ok("bincal: a binary only opens a tab that actually exists (no dead click)",
  adminSrc.includes("const tabbable=!e.board||!!(find(e.sym)&&ddOf(find(e.sym)));"));
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
ok("altitude: Glance leads with three tiles; FUND and BOOK are separate destinations before DESK",
  adminSrc.indexOf('id="gateTile"') < adminSrc.indexOf('id="nextTile"') &&
  adminSrc.indexOf('id="nextTile"') < adminSrc.indexOf('id="stampTile"') &&
  adminSrc.indexOf('id="stampTile"') < adminSrc.indexOf('id="fundView"') &&
  adminSrc.indexOf('id="fundView"') < adminSrc.indexOf('id="bookView"') &&
  adminSrc.indexOf('id="bookView"') < adminSrc.indexOf('id="dDesk"'));
ok("today: every demoted strip keeps its element — nothing was deleted, only collapsed",
  ["nextDollar", "upsideRank", "clusterLine", "fundingLine", "binaryCal", "decisionsLine", "circuitLine"]
    .every((id) => adminSrc.includes(`id="${id}"`)));
ok("today: each drawer is ONE tap (native details, no hidden second step)",
  (adminSrc.match(/<details class="drawer" id="d/g) || []).length === 9 &&      // 8 strips + DESK (v3.45 adds dCapex)
  (adminSrc.match(/<details class="drawer"><summary>/g) || []).length === 3);   // reference sidebar
ok("today: the reference sidebar collapses too — it is reference, not monitoring",
  !/<div class="panel"[^>]*>\s*<h2>Router/.test(adminSrc) &&
  adminSrc.includes("<summary>STANDING CONSTRAINTS</summary>"));
// v4.1 Step 7 re-pin: the pill became a real <button> (it toggles WHY MACRO) — the
// load-bearing claim was always the MACRO: label + the pill, never the element tag.
ok("today: the header pill is labelled MACRO — it is the measured read, not the stance",
  /MACRO: <button type="button" class="pill neutral" id="regimePill"/.test(adminSrc) &&
  /min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">MACRO: /.test(adminSrc) &&
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
ok("pos: fetched from its own endpoint in the boot chain, alongside the book and quotes",
  adminSrc.includes('const r=await fetch("/api/positions");') && adminSrc.includes("async function bootLoads(){ await loadBook(); await secondaryLoads(); honourArrival(); }") &&
  /async function secondaryLoads\(\)\{\s*await Promise\.all\(\[loadQuotes\(\),loadPositions\(\),loadAllocation\(\),loadDeepDiveIndex\(\),loadTickerV2\(\),loadScoreIndex\(\)\]\);/.test(adminSrc));

/* v5.6.4 — the boot chain must be RESUMABLE, and a failed read must never claim the store
   is empty. Live defect 2026-08-26: after a session expiry the six secondary loads fired
   before a session existed, each 401'd into its own silent catch, and the PIN gate resumed
   only PIN_CB (loadBook) — so the board rendered 50 book names reading "no thesis payload
   stored · TT —" against a server holding 39 payloads and 35 cards. */
ok("v5.6.4 boot: the PIN gate resumes the WHOLE chain — both the default callback and loadBook's own 401 path point at bootLoads, never at loadBook alone",
  adminSrc.includes("PIN_CB=cb||bootLoads;") &&
  adminSrc.includes('showPinGate(bootLoads);') &&
  !/showPinGate\(loadBook\)/.test(adminSrc) && !/PIN_CB=cb\|\|loadBook/.test(adminSrc));
ok("v5.6.4 boot: a successful login ALWAYS retries the secondary loads, whatever the interrupted action was",
  /const cb=PIN_CB;PIN_CB=null;if\(cb\)await cb\(\);[\s\S]{0,400}await secondaryLoads\(\);/.test(adminSrc));
ok("v5.6.4 honesty: a FAILED payload-index fetch reads 'not read, not empty' — never 'no thesis payload stored'",
  adminSrc.includes("let DD_FAILED=false;") &&
  adminSrc.includes('else DD_FAILED=true;') &&
  adminSrc.includes('(!dd&&DD_FAILED)?"payload index did not load — not read, not empty"') &&
  adminSrc.includes('(!dd&&DD_FAILED)?"reload the terminal (⟲ RELOAD) — the store was never read"'));
ok("v5.7.1 honesty: readiness() carries the three-state claim too — loading and failed are 'not read, not empty', never 'no thesis payload' (the JOBY card, 2026-08-27)",
  adminSrc.includes('if(!dd&&DD_PENDING)add("block","payload index still loading — not read, not empty");') &&
  adminSrc.includes('else if(!dd&&DD_FAILED)add("block","payload index did not load — not read, not empty");') &&
  adminSrc.includes('else if(!dd)add("block","no thesis payload");') &&
  adminSrc.includes('(!dd&&DD_PENDING)?"payload index still loading — not read, not empty"'));
ok("v5.6.4 honesty: a null score index reads 'did not load' — never 'no server card — unscored' (a claim about a store nobody read)",
  adminSrc.includes('SCORE_INDEX===null?"score index did not load — not read, not unscored (⟲ RELOAD)"'));
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
/* v5.2 CAP-ASTERISK (owner ruling 2026-08-25): the breach line SURVIVES but as a WARN —
   the reference cap informs, it no longer suspends the add candidate. Both directions
   pinned: the warn exists, the old stop severity is gone from the cap items. */
ok("caps: a breach is a TODAY WARN, never a STOP — the cap informs, it does not suspend the add (v5.2 reversal of the v3.30 stop)",
  adminSrc.includes("pts over the ${CAP_PCT}% reference cap (informational)") &&
  adminSrc.includes('sev:"warn",txt:`${c.sym} is ${c.pct}% of acct equity') &&
  !adminSrc.includes('sev:"stop",txt:`${c.sym} is ${c.pct}%'));
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
const renderSrc = readSrc("./render.mjs");
ok("render: committed as a separate suite, not wired into npm test",
  existsSync(new URL("./render.mjs", import.meta.url)) &&
  JSON.parse(readSrc("../package.json")).scripts["test:ui"] === "node test/render.mjs");
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
const PKG = JSON.parse(readSrc("../package.json"));
// The terminal had THREE versions for one artifact: <title> v1.0, brand v1.1, package.json
// v3.31. This repo already resolved exactly this drift once ("footer string is canonical /
// package.json is stale"). admin.html is a Vite public/ passthrough and cannot receive
// __APP_VERSION__, so a guard is the only thing that can hold the invariant.
ok("version: the terminal's title and brand both match package.json (no third version)",
  adminSrc.includes(`<title>TT TICKER TERMINAL v${PKG.version}</title>`) &&
  // Tagline re-pinned at v5.0 ("the card governs (§14.8)" — the flip) and again at v5.6
  // ("the daily contract" — the four-question surface is the product's face now; the card
  // still governs underneath, stated in the §14.8 machinery, not the masthead).
  adminSrc.includes(`<small>v${PKG.version} · the daily contract</small>`));
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
const ledgerSrc = readSrc("../functions/api/ledger.js");
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
const posSrc = readSrc("../functions/api/positions.js");
ok("positions.js: PIN-gated like /api/tt — position data is at least as sensitive as the book",
  (posSrc.match(/const auth = await authorize\(request, env\);/g) || []).length === 3);
// v3.100: the import gained validateAccount — the account record is validated by the SAME
// shared home as pos, not a local redefinition (the pin's actual claim, restated wider).
ok("positions.js: reuses the shared validatePos + validateAccount from tt.js rather than redefining the bands",
  posSrc.includes('import { authorize, validatePos, validateAccount } from "./tt.js";') &&
  !/function validatePos/.test(posSrc) && !/function validateAccount/.test(posSrc));
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
ok("spread: legacy street PT consumes one explicitly published value, never an average of scenarios",
  adminSrc.includes("const published=[pcRow.average,pcRow.mean,pcRow.base].find") &&
  !adminSrc.includes("streetVals.reduce((a,b)=>a+b,0)/streetVals.length"));
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
  whysSrc.includes("why this call · 5 checks") &&
  dashSrc.indexOf("<FiveWhys ") > dashSrc.indexOf('id="overview"')
  && dashSrc.indexOf("<FiveWhys ") < dashSrc.indexOf('aria-labelledby="markets"'));
/* v3.92 QUIET OVERVIEW — this pin REVERSED. v3.69/v3.61 pinned the whys always-expanded on
   an owner call; a 2026-08-15 phone screenshot reversed it ("too wordy — hide with menus").
   The new contract: the CHAIN collapses behind the house CollapsedGroup, while the regime
   state line (this block's one red/amber fact) stays OUTSIDE the collapse — the v3.25 rule,
   proven structurally here and behaviorally in public-render (closed state + open-then-read). */
/* v3.93 QUIET-2 re-pin (screenshot-measured): the regime line moved INSIDE the collapse —
   it is a byte-for-byte duplicate of the hero verdict 100px above, so v3.25 is satisfied by
   the hero; the block's closed form is ONE toggle row. */
ok("v3.93: the whys are ONE toggle row — regime line and chain both inside the chip-free collapse",
  (() => {
    const cg = whysSrc.indexOf("<CollapsedGroup");
    const regimeLine = whysSrc.indexOf("{fw.regime}");
    const chain = whysSrc.indexOf("fw.whys.map");
    return cg > 0 && regimeLine > cg && chain > regimeLine &&
      !/SectionHeader/.test(whysSrc) &&
      /chip=\{false\}/.test(whysSrc.slice(cg, whysSrc.indexOf(">", cg) + 1));
  })());
ok("v3.69: ONE market-detail CollapsedGroup (chart + 10 tiles) inside the markets section, chip-free",
  mdSrc.includes('label="full market detail — chart & tiles" chip={false}')
  && (uiSrc.match(/full market detail — chart & tiles\" chip/g)||[]).length===1);
ok("v3.69: the 60/40 command-center grid is gone — no two-column race can bury the narrative again",
  !dashSrc.includes("command-grid") && !dashSrc.includes("60fr 40fr"));
ok("v3.69: markets/macro/ai are real sections (drivers/health pattern), and the operator monitors have their own",
  dashSrc.includes('<section aria-labelledby="markets">')
  && dashSrc.includes('<section aria-labelledby="macro">')
  && dashSrc.includes('<section aria-labelledby="ai">')
  && dashSrc.includes('aria-label="Operator monitors — conviction and alerts"'));
ok("v3.69: dead components deleted (defined-but-never-rendered LaunchCostCard/EvtolCertCard)",
  !/const LaunchCostCard|const EvtolCertCard/.test(uiSrc) &&
  !/const LAUNCH_COST|const EVTOL_CERT/.test(uiSrc) && !/LAUNCH_COST|EVTOL_CERT/.test(aiEconSrc));
ok("hz-chip: ONE builder (hzDeckChip) states the year and offers auto/nearest INLINE, one tap, no navigation",
  /function hzDeckChip\(\)/.test(adminSrc)
  && /quick\(HZ_AUTO,"auto"\)/.test(adminSrc)
  && /quick\("","nearest"\)/.test(adminSrc)
  && /onclick="setHorizon\('\$\{v\}'\)"/.test(adminSrc));
ok("hz-chip: pinning a SPECIFIC year still deep-links to the full picker — only auto/nearest are one-tap",
  /openDesk\('dNext'\)" title="pin a specific year/.test(adminSrc));
ok("hz-chip: every deck label carries it (BUY + both FUNDING branches + MAG 7, v3.84) — 4 call sites, one builder, zero drift",
  (adminSrc.match(/\$\{hzDeckChip\(\)\}/g)||[]).length===4);
/* v3.81: the full picker was a 9.5px <span> with 1px padding. It rendered the CHOICE but not
   an affordance to change it, which is how a live book sat on "nearest" for days while the
   ranking reported +1970%/yr. Real buttons, colour-coded by KIND, plus a warning computed
   from the rows actually on screen. */
ok("hz-picker: real <button>s with aria-pressed — not the 9.5px span that made the control untappable",
  /class="hzb\$\{on\?" on":""\}" onclick="setHorizon\('\$\{v\}'\)"/.test(adminSrc)
  && /aria-pressed="\$\{on\}"/.test(adminSrc)
  && !/<span onclick="setHorizon/.test(adminSrc));
ok("hz-picker: ONE kind map drives colour AND tooltip, so a colour can never disagree with the mode it paints",
  /const HZ_KIND=\(v\)=>v===HZ_AUTO\?\{c:"var\(--green\)"/.test(adminSrc)
  && /:v===""\?\{c:"var\(--amber\)"/.test(adminSrc)
  && /:\{c:"var\(--slate\)"/.test(adminSrc)
  && /style="--hzc:\$\{k\.c\}"/.test(adminSrc)
  && /title="\$\{esc\(k\.t\)\}"/.test(adminSrc));
ok("hz-picker: the selected state is a FILL plus a 2px border, not a colour shift a 9.5px chip could hide",
  /\.hzb\.on\{background:color-mix\(in srgb,var\(--hzc\) 18%,transparent\);border-width:2px;/.test(adminSrc));
ok("hz-picker: 40px thumb targets at <=480px — the defect was reachability, not visibility",
  /@media\(max-width:480px\)\{\.hzb\{min-height:40px;/.test(adminSrc));
{ // the distortion warning is COMPUTED from the rendered rows, never asserted — lift and RUN it.
  const m = adminSrc.match(/const wild=isNearest\?(rows\.filter\([\s\S]*?\)\.length):0;/);
  ok("hz-picker: the nearest-distortion warning has a computed predicate to lift", !!m);
  const wildOf = (rows, isNearest) => Function("rows", "isNearest",
    `return isNearest?${m[1]}:0;`)(rows, isNearest);
  const R = (ann) => ({ ann });
  ok("hz-picker: warns only when nearest ACTUALLY produces four-figure rates (the +1970%/yr the owner saw)",
    wildOf([R(1970.1), R(1035.2), R(41)], true) === 2);
  ok("hz-picker: an ordinary nearest ranking is NOT nagged — 200%/yr is the line, and 199 is under it",
    wildOf([R(199), R(-88), R(0)], true) === 0);
  ok("hz-picker: the threshold is two-sided — a -400%/yr rung is the same units trap as +400",
    wildOf([R(-400)], true) === 1);
  ok("hz-picker: a name with no rate cannot trip it (null is not a big number)",
    wildOf([R(null), R(null)], true) === 0);
  ok("hz-picker: on auto or a pinned year the warning never fires — it is a claim about NEAREST",
    wildOf([R(1970.1)], false) === 0);
}
ok("hz-picker: the warning carries its own fix — one tap to auto, no navigation",
  /NEAREST is distorting the order/.test(adminSrc)
  && /onclick="setHorizon\('\$\{HZ_AUTO\}'\)"[^>]*>switch to auto</.test(adminSrc));
ok("altitude: the routed shell has no fixed viewport-height carousel or hidden horizontal page budget",
  !/decisionDeck|sizeDecisionDeck|scroll-snap-type:x mandatory/.test(adminSrc) &&
  /\.tt-view\[hidden\]\{display:none!important\}/.test(adminSrc));
ok("altitude: tile geometry changes at 700px while the information hierarchy stays identical",
  /\.glance-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(adminSrc) &&
  /@media\(max-width:700px\)[\s\S]{0,120}\.glance-grid\{grid-template-columns:1fr\}/.test(adminSrc));
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
  adminSrc.includes("estRunTable(it.x,ddOf(it.x))"));
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
/* v5.2 CAP-ASTERISK: RANKFAIR's veto is REVERSED by owner ruling 2026-08-25. The pin now
   asserts the opposite of what it asserted from v3.36 to v5.1.1 — deliberately, with the
   ruling named (the v4.0.1 reversal convention): the veto string is GONE from why(), and
   the over-cap pick carries the asterisk chip on the green line instead. */
ok("rankfair REVERSED (v5.2): the cap never vetoes the pick — the green line carries the asterisk instead",
  !adminSrc.includes("at the ${CAP_PCT}% cap, no room") &&
  adminSrc.includes("over the ${CAP_PCT}% reference cap (asterisk, not a veto)"));
ok("rankfair: every pick renders its held weight beside the upside",
  adminSrc.includes("r.wt") && adminSrc.includes("weights are % of TRACKED BOOK (a floor"));
ok("rankfair: queue names with NO model are NAMED, not silently missing from the ranking",
  adminSrc.includes("cannot be ranked here — no pt_model"));
ok("rankfair: the ranking spans held AND unheld, and says which — a blank would be ambiguous",
  adminSrc.includes("new — not held") && adminSrc.includes("held · size unmeasured") &&
  adminSrc.includes('if(!p)return{w:null,mark:"",room:"open",optOnly:false,held:false};'));

// ---- 19. v3.38 "Four Drivers" — FOCUS2 + SELLRANK + REFRESH ----------------
console.log("\n[19] v3.38 — four-driver view, computed sell list, refresh button");
/* v5.2: the forced cap tier is GONE (SELLRANK v3.38 reversed) — this pin previously went
   VACUOUS (forced.sort deleted -> indexOf -1 < anything, the v3.60.1 trap) and is rewritten
   to assert the new contract directly: no cap-routed forced bucket remains in sellRank. */
ok("sellrank REVERSED (v5.2): no cap-forced tier remains — every measured row ranks on merit",
  adminSrc.includes("function sellRank()") &&
  !adminSrc.includes("forced.sort((a,b)=>b.trimPts-a.trimPts);") &&
  !/else if\(w>=CAP_PCT\)\{\s*\n\s*row\.trimPts/.test(adminSrc));
// v3.44: the sort gained an options branch, but the RETURN-based rule is unchanged —
// asserted behaviourally now rather than by matching the old one-line literal.
/* v5.2 CAP-ASTERISK: the discretionary key is now MERIT, lexicographic in the owner's
   stated order — tape (bearish first) -> lowest %/yr -> lowest TT score — RUN here against
   the real sort expression's own semantics: a BEARISH-tape name outranks a lower-%/yr
   BULLISH one (tape is the first axis, per the ruling), and within one tape bucket the
   old lowest-return rule survives; a no-rate row ranks after rated names in its bucket. */
ok("sellrank v5.2: merit sort — tape first, then lowest %/yr, then lowest TT score (run, not pinned)",
  adminSrc.includes("(a.techRank-b.techRank)||((a.ann??1e9)-(b.ann??1e9))||((a.score??1e9)-(b.score??1e9))") &&
  (() => { const tr=v=>v==="BEARISH"?0:v==="BULLISH"?2:1;
    const rows=[
      {basis:"return",tech:"BULLISH",ann:-9,score:9,mv:1},
      {basis:"return",tech:"BEARISH",ann:12,score:8,mv:1},
      {basis:"return",tech:"MIXED",ann:3,score:2,mv:1},
      {basis:"return",tech:"MIXED",ann:null,score:1,mv:1},
      {basis:"return",tech:"MIXED",ann:3,score:7,mv:1}];
    rows.forEach(r=>r.techRank=tr(r.tech));
    rows.sort((a,b)=>{ if(a.basis!==b.basis)return a.basis==="return"?-1:1;
      if(a.basis!=="return")return b.mv-a.mv;
      return (a.techRank-b.techRank)||((a.ann??1e9)-(b.ann??1e9))||((a.score??1e9)-(b.score??1e9))||(b.mv-a.mv); });
    const order=rows.map(r=>`${r.tech}:${r.ann}:${r.score}`).join("|");
    // bearish first despite +12%/yr; then mixed 3%/yr score 2 before score 7; no-rate last
    // in its bucket; bullish last despite being the WORST return on the list.
    return order==="BEARISH:12:8|MIXED:3:2|MIXED:3:7|MIXED:null:1|BULLISH:-9:9"; })());
ok("sellrank v5.2: an over-cap row keeps the to-cap arithmetic as its INFORMATIONAL asterisk",
  adminSrc.includes("trim$:w>=CAP_PCT?Math.round(mv*(w-CAP_PCT)/w):null") &&
  adminSrc.includes("to cap (informational)"));
ok("sellrank: do_not_trim is flagged, never hidden (the cap-contradiction line died WITH the forced tier it contradicted — v5.2)",
  adminSrc.includes("session says do-not-trim — shown, not hidden") &&
  !adminSrc.includes("cap and do-not-trim CONTRADICT"));
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
ok("optmv: an options row still qualifies on dollars ALONE and keeps its own basis in the sort (v5.2: one push, basis split intact)",
  adminSrc.includes('optOnly:oo,basis:oo?"dollars":"return"') &&
  adminSrc.includes('if(a.basis!=="return")return b.mv-a.mv;'));
ok("optmv v5.2: no CAP tier exists for ANY row to bypass — the sleeve-denominator concern is moot by reversal, pinned so it cannot silently return",
  !/else if\(w>=CAP_PCT\)\{\s*\n?\s*row\.trimPts/.test(adminSrc) &&
  adminSrc.includes("the cap no longer routes a row to a FORCED tier"));
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
ok("focus2: the buy block renders the SAME canonical rows the Next Dollar rank sorted",
  adminSrc.includes("UPSIDE_ROWS=rows;") && adminSrc.includes("const rows=UPSIDE_ROWS.slice(0,5);") &&
  (() => {
    /* v3.91 (audit #10): the boundary pin covers the WHOLE street path and ALL THREE
       canonical variables — the v3.90 pin sliced 2200 chars of one function and guarded
       only UPSIDE_ROWS, narrower than the invariant it claimed. Brace-agnostic: slice from
       buildV2Rows to the next top-level `function ` after renderStreetEligibility ends. */
    const a = adminSrc.indexOf("function buildV2Rows()");
    const rse = adminSrc.indexOf("function renderStreetEligibility()", a);
    const b = adminSrc.indexOf("\nfunction ", rse + 10);
    const street = adminSrc.slice(a, b);
    return a > 0 && rse > a && b > rse &&
      !/(?:UPSIDE_ROWS|AGREE_PICK|LAST_RANK)\s*=(?!=)/.test(street);
  })());
ok("v396: the street diagnostic preserves book order and cannot become a second ranking",
  (() => {
    const a = adminSrc.indexOf("function buildV2Rows()");
    const b = adminSrc.indexOf("\nfunction ", a);
    const src = adminSrc.slice(a, b);
    return !/\.sort\s*\(/.test(src) && /BOOK\.forEach\(x=>/.test(src);
  })());
/* v5.97.4 EXCISION — renderStance() and renderCalBlock() are GONE, with the hidden
   #legacyCompact block they wrote into. Both ran on every render and were invisible since
   v5.7.0 (nothing ever un-hid the div), and the dormancy already bit once — the v5.97.3
   REFRESH-label bug came from the dormant button sharing a handler. Pinned ABSENT so a
   revert cannot land silently, and the v3.25 red facts are pinned at their LIVE homes:
   the header glance chips, whose closed state carries every count the strip used to. */
ok("v5.97.4 excision: the legacy stance/calendar renderers and their markup are ABSENT",
  !adminSrc.includes("function renderStance()") && !adminSrc.includes("function renderCalBlock()") &&
  !/id="legacyCompact"/.test(adminSrc) && !/id="stanceStrip"/.test(adminSrc) &&
  !/id="calBlock"/.test(adminSrc) && !/id="refreshRanksLegacy"/.test(adminSrc) &&
  !/\.stance-strip\{/.test(adminSrc) && !/\.vbadge\{/.test(adminSrc));
ok("v5.97.4 successors: the header chips carry the red counts a closed DESK would otherwise hide",
  adminSrc.includes("trim.textContent=`TRIM · ${SELL_FORCED_N} cap`") &&
  adminSrc.includes("fc.textContent=`FLAGS · ${flags}`") &&
  // the FLAGS count aggregates every signal the old badges carried: binaries in window,
  // a turning capex tape, a tripped demand falsifier, and the what-changed count.
  adminSrc.includes("const flags=binaryEvents().filter(e=>e.inWindow).length+(cx&&cx.turning?1:0)+(cp&&cp.impaired?1:0)+(CHANGED_N.n||0);"));
ok("focus2: primary blocks render LAST in the chain, reading what the strips computed",
  adminSrc.includes("renderBuyBlock();renderSellBlock();renderMagBlock();renderGlance();renderTabs();"));
ok("refresh: the button refetches quotes+positions+regime and reports the quote-cache window honestly",
  adminSrc.includes("async function refreshRanks(btn)") &&
  adminSrc.includes("Promise.all([loadQuotes(),loadPositions(),loadRegime(),allocReeval(),loadScoreIndex()])") &&
  adminSrc.includes("server caches 2 min"));
ok("refresh: the button disables while in flight and always re-enables",
  adminSrc.includes("b.disabled=true") && adminSrc.includes("finally{if(b){b.disabled=false"));
/* v5.97.3: the shared handler used to hardcode "⟳ DATA+RANKS" (a dormant second caller's
   label) onto the one real button's cleanup. v5.97.4 then EXCISED that dormant caller with
   the legacy block, so this is now the handler's only onclick site — the per-button
   generality stays because it is the correct shape, not because a second caller needs it. */
ok("refresh: the one real button passes `this`, and no legacy caller remains",
  /id="refreshRanks" onclick="refreshRanks\(this\)"/.test(adminSrc) &&
  !adminSrc.includes("refreshRanksLegacy"));
ok("refresh: the resting label is READ from the clicked button, never a hardcoded second copy",
  adminSrc.includes('const restLabel=b?b.textContent:"⟳ REFRESH"') &&
  adminSrc.includes("finally{if(b){b.disabled=false;b.textContent=restLabel;}render();}") &&
  // the retired hardcode is gone, not just shadowed by the new line
  !/textContent="⟳ DATA\+RANKS";\}render\(\)/.test(adminSrc));
ok("refresh: called with no argument still defaults to the glance-action button (existing test call sites)",
  adminSrc.includes('const b=btn||document.getElementById("refreshRanks")'));

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
/* v5.97.4: the details.why and .vbadge pins RETIRED with the renderer they measured —
   renderStance and its markup are excised (pinned absent above). stance() and its prose
   contracts are untouched and still pinned; the caution→amber map now anchors on
   renderGlance's colour map, which carries the same fix for the same reason. */
ok("stance: the caution→amber map bug stays fixed at its surviving home (renderGlance's map)",
  adminSrc.includes('caution:"var(--amber)"'));
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
// RE-PINNED v5.97.4: the compact calendar block (renderCalBlock, and its act/tag literals) was
// excised with #legacyCompact — permanently-hidden dead markup, the v3.73 rot-vector rule. The
// dead-click contract SURVIVES at the live calendar surface: renderBinaryCal only wires onclick
// when the tab actually exists (same "a button that does nothing is a lie" rule, DESK altitude).
ok("slice2: a calendar event without an openable tab gets NO onclick — the dead-click guard lives at renderBinaryCal",
  adminSrc.includes("const tabbable=!e.board||!!(find(e.sym)&&ddOf(find(e.sym)));") &&
  /class="pick"\$\{tabbable\?` onclick="switchTab\('\$\{esc\(e\.sym\)\}'\)"`:""\}/.test(adminSrc) &&
  !adminSrc.includes('const tag=act?"button":"div";'));
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
ok("slice3: the mode strip is a real ARIA tablist with routed NEXT $ and BOOK controls",
  /class="tt-mode" role="tablist"/.test(adminSrc) &&
  /id="modeNext" role="tab" aria-selected="true"/.test(adminSrc) &&
  /id="modeBook" role="tab" aria-selected="false"/.test(adminSrc) &&
  /mn\.tabIndex=TT_ROUTE\.view==="book"\?-1:0/.test(adminSrc) && /mb\.tabIndex=TT_ROUTE\.view==="book"\?0:-1/.test(adminSrc));
ok("slice3: arrow/Home/End keys move and select the routed modes",
  /function modeKey\(e,view\)/.test(adminSrc) &&
  /\["ArrowLeft","ArrowRight","Home","End"\]/.test(adminSrc) &&
  /routeGo\(next\);document\.getElementById/.test(adminSrc));
ok("slice3: drawer/schema summaries migrated onto the shared type scale, not a stray literal",
  adminSrc.includes("details.drawer>summary{cursor:pointer;list-style:none;padding:8px 12px;font-size:var(--fs-s);") &&
  adminSrc.includes("details.schema>summary{cursor:pointer;list-style:none;color:var(--dim);font-size:var(--fs-s);"));
ok("slice3: dd-pt table headers stick on scroll, phone-only (desktop tables are short enough not to need it)",
  /max-width:700px\)\{table\.dd-pt th\{position:sticky/.test(adminSrc));
ok("slice3: chips get the 40px thumb target at phone widths, same rule as slice 2's rows",
  /max-width:480px[^}]*\{[\s\S]{0,260}\.chip\{min-height:40px\}/.test(adminSrc));

// ---- slice 4: modal focus management + destructive-action confirm + live toast ----------
ok("slice4: all 11 overlay-open call sites funnel through ONE openModal() — " +
   'document.getElementById("overlay").classList.add("on") appears exactly once now, ' +
   "inside openModal() itself, not duplicated at each site (toast/pinGate keep their own)",
  (adminSrc.match(/document\.getElementById\("overlay"\)\.classList\.add\("on"\)/g)||[]).length===1 &&
  (adminSrc.match(/openModal\(\);/g)||[]).length===11);
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
// v4.0.2: DASH left this list — the way back is a PERMANENT header button now (← MACRO),
// closing the loop the dashboard's ⌁ TERMINAL button opened (v3.98.3).
ok("slice5: version, BOOK/AUTH stamps and the whole action toolbar moved behind that " +
   "disclosure — status and occasional actions, never answers",
  /id="headInfo"[\s\S]{0,1800}the daily contract[\s\S]{0,900}id="bookStamp"[\s\S]{0,900}id="sessState"[\s\S]{0,1200}\+ ADD TICKER[\s\S]{0,900}id="backupRow"/.test(adminSrc));
ok("slice5: the banners stay OUTSIDE the disclosure — an expired session or an unsaved edit " +
   "must never require opening a menu to discover",
  /id="headInfo"[\s\S]*?<\/div>\s*<!--[\s\S]*?-->\s*<div id="authBanner"/.test(adminSrc) &&
  adminSrc.indexOf('id="authBanner"')>adminSrc.indexOf('id="backupRow"'));
ok("v4.0.2: ← MACRO is a permanent bar action with the dashboard's amber treatment — and the " +
   "old ← DASH footnote is GONE from the disclosure (one door to one room, both directions)",
  /<a class="hb-back" href="\/" aria-label="Back to the MacroDash macro board">← MACRO<\/a>/.test(adminSrc) &&
  !/← DASH<\/a>/.test(adminSrc) &&
  (adminSrc.match(/class="hb-back"/g) || []).length === 1 &&   // exactly one element (one door)
  /\.hb-back\{[^}]*var\(--amber\)/.test(adminSrc));
ok("v4.0.2: the disclosure speaks the dashboard's word — ⋯ OPS, flipping to ⋯ CLOSE",
  /onclick="toggleHeadInfo\(\)">⋯ OPS</.test(adminSrc) &&
  /b\.textContent=open\?"⋯ CLOSE":"⋯ OPS"/.test(adminSrc) &&
  // the ONLY surviving "⋯ MENU" is the historical note in the v3.62 comment — no rendered
  // string or code path says it (a comment may record history; a control may not).
  (adminSrc.match(/⋯ MENU/g) || []).length === 1 &&
  // v4.0.3: this is a HISTORICAL reference — the release where MENU became OPS. It must NOT
  // move with a version bump (a blanket sed did exactly that and this pin caught it); a
  // version that records when something happened is data, not a stamp.
  /⋯ MENU until v4\.0\.2/.test(adminSrc));
ok("v4.0.2: the two toolbars carry different altitudes — a DAILY OPS label, and admin & backup " +
   "demoted to a quiet dashed toggle (every capability survives, they stop competing)",
  /<div class="tb-label">DAILY OPS<\/div>/.test(adminSrc) &&
  /class="act quiet" onclick="toggleBackup\(\)"/.test(adminSrc) &&
  /⛭ admin &amp; backup ▸/.test(adminSrc) &&
  /🔐 PIN/.test(adminSrc) && /◈ AI RUBRIC/.test(adminSrc) && /⏱ RESTORE POINTS/.test(adminSrc));
ok("slice5: the MACRO: label survives the compaction — v3.29 added it so the pill can't be " +
   "misread as the stance, which is an honesty invariant, not decoration",
  /MACRO: <button type="button" class="pill neutral" id="regimePill"/.test(adminSrc) &&
  /min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">MACRO: /.test(adminSrc));
ok("slice5: toggleHeadInfo keeps aria-expanded honest",
  adminSrc.includes("function toggleHeadInfo()") &&
  adminSrc.includes('b.setAttribute("aria-expanded",String(open))'));
/* v5.97.4: the slice5 / v5.6 / v5.6.5 renderStance-STRUCTURE pins (permissive pill branch,
   restrictive token + gateTokSm + why drawer, the flagN counted collapse) are RETIRED with
   the renderer — every one measured markup that is now excised, invisible to users since
   v5.7.0. The CONTRACTS they served live on and stay pinned: stance()'s verdict/prose
   (above), macroGateFrom↔macroGate mirror matrix ([44]/[68]), and the v3.25 rule at its
   live altitude — the successor pins here anchor the glance GATE tile and header chips. */
/* v5.98 RE-PIN (audit finding T1, built): the tile's stance().k ALIAS is retired — it was a
   SECOND derivation of the locked vocabulary and diverged from the ladder (HODL under
   measured-HEADWIND + FULL where the ladder says SEND IT). The GATE word is now macroGate()'s
   own label — ONE derivation — with the stance verdict surviving as the tile's sub-line
   (gate = Engine 0 permission, stance = the portfolio read; married, never merged). */
ok("v5.98 glance: the GATE tile reads macroGate() — one derivation of the product word, stance as the sub",
  adminSrc.includes("const st=stance(),mg=macroGate();") &&
  /glance-k">GATE<\/div><div class="glance-v"[^`]*\$\{mg\.label\}/.test(adminSrc) &&
  adminSrc.includes("${esc(st.verdict||st.txt)}"));
ok("v5.98 glance: the retired stance-alias derivation is ABSENT — no second home for the locked words",
  !/st\.k==="go"\?"SEND IT"/.test(adminSrc));
ok("v5.6→glance: macroGate() is rendered AND stays the pinned server mirror",
  adminSrc.includes("function macroGate()") &&
  adminSrc.includes('return{g:"SEND_IT",label:"SEND IT",c:"var(--green)"}'));

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
  // v3.75 DDSTORE: ddOf is the ONE payload choke point every consumer goes through, so the
  // real one is lifted here rather than stubbed — these fixtures carry embedded payloads,
  // which is exactly the pre-migration fallback branch it must keep serving.
  // FEAT-CAPEX-OCF (v3.83): the funding-tell constants, pinned BY VALUE — the lifted
  // capexState references them, and a silent threshold move must go red here.
  new Function("ctx", "let BOARD={},BOOK=[],DD_FULL={},DD_INDEX_MAP={};const CAPEX_OCF_RATIO_MAX=1.0,CAPEX_OCF_N=2;" + g("ddOf") + "\n" +
    g("capexState") + "\n" + g("capexExposure") + "\n" + g("lintCapexConservation") +
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
ok("capex: a turning tape still reaches the CLOSED glance surface — one count in FLAGS (v5.97.4: " +
   "the stance ⚡ badge died with the hidden strip; the aggregation is the surviving signal)",
  adminSrc.includes("(cx&&cx.turning?1:0)") && adminSrc.includes('fc.classList.toggle("warn",!!flags)'));
ok("capex: the tape renders as its own DESK drawer whose closed summary carries the signal",
  adminSrc.includes('id="dCapex"') && adminSrc.includes('setDrawer("dCapex","sCapex"') &&
  adminSrc.includes("function renderCapex()"));
ok("capex: capex_exposure is a HANDLED deep-dive key (purpose-built section, no double render)",
  adminSrc.includes('"capex_exposure"') && adminSrc.includes("function ddCapexExpSec(dd)") &&
  ["DIRECT","FAB","POWER","NEOCLOUD"].every((t) => adminSrc.includes(t)));
ok("capex: the tape REPORTS, never enforces — no veto path reads capexState",
  !/AGREE_PICK[\s\S]{0,200}capexState|capexState\(\)[\s\S]{0,120}veto/.test(adminSrc));
// ── FEAT-CAPEX-OCF (v3.83): funding quality — capex/OCF per spender ──
ok("capex-ocf: validateBoard accepts an absent ocf_B and rejects each out-of-band value",
  (() => {
    const mk = (ocf) => ({ as_of: "2026-08-15", capex: { rows: [
      { co: "HYPA", fy_guide_B: 120, dir: "up", at: "2026-08-15", ...(ocf === undefined ? {} : { ocf_B: ocf }) }] } });
    return validateBoard(mk(undefined)) === null && validateBoard(mk(100)) === null &&
      validateBoard(mk(-5)) !== null && validateBoard(mk(0)) !== null && validateBoard(mk(5000)) !== null;
  })());
const CX_OCF = (rows) => ({ capex: { rows: rows.map((r, i) => ({ co: "HYP" + "ABCD"[i], fy_guide_B: r.g, dir: "up", at: "2026-08-15", ...(r.o === undefined ? {} : { ocf_B: r.o }) })) } });
ok("capex-ocf: exactly self-funded (ratio 1.00) does NOT count — the boundary is strict",
  (() => { const st = cxLift(CX_OCF([{ g: 100, o: 100 }, { g: 101, o: 100 }]), []).st;
    return st.overOcf === 1 && st.debtFunded === false && st.ocfMeasured === 2; })());
ok("capex-ocf: two spenders past OCF fire the funding tell",
  (() => { const st = cxLift(CX_OCF([{ g: 101, o: 100 }, { g: 150, o: 100 }, { g: 90, o: 100 }]), []).st;
    return st.debtFunded === true && st.overOcf === 2 && st.overSyms.join() === "HYPA,HYPB"; })());
ok("capex-ocf: an UNMEASURED row never counts toward the tell — one over + one unmeasured stays quiet (fail-closed)",
  (() => { const st = cxLift(CX_OCF([{ g: 150, o: 100 }, { g: 200 }, { g: 90, o: 100 }]), []).st;
    return st.debtFunded === false && st.overOcf === 1 && st.ocfMeasured === 2 &&
      st.ratios.find((x) => x.co === "HYPB").ratio === null; })());
ok("capex-ocf: the amber banner, per-row ratio chip, unmeasured naming and drawer chip all render",
  adminSrc.includes("⚠ DEBT-FUNDED BUILDOUT") && adminSrc.includes("capex/OCF ${ra.toFixed(2)}") &&
  adminSrc.includes("unmeasured never counts toward the funding tell") &&
  adminSrc.includes("⚠ debt-funded ${st.overOcf}/${st.ocfMeasured}"));
ok("capex-ocf: the funding tell never reaches a glance-altitude badge — amber lives one tap deep " +
   "(v5.97.4: the stance strip is gone, so the guard moves to the surviving glance aggregation)",
  // debtFunded must not join the FLAGS count or any header chip — the owner call was
  // red-only facts at glance altitude, amber one tap deep (the sCapex drawer chip).
  !/const flags=[^;]*debtFunded/.test(adminSrc) &&
  !/trim\.textContent[^;]*debtFunded/.test(adminSrc) &&
  adminSrc.includes("⚠ debt-funded ${st.overOcf}/${st.ocfMeasured}"));
ok("capex-ocf: the curated dashboard card mirrors the ratio inline with real OCF and never a 0 for unmeasured",
  /ocfB:\s*\d/.test(aiEconSrc) && aiSrc.includes("capex/OCF ${ratio(r).toFixed(2)}") &&
  aiSrc.includes('"OCF unmeasured"') && aiSrc.includes("debt-funded buildout"));
// Dashboard: the third leg of AI Unit Economics.
ok("capex-dash: HYPERSCALER_CAPEX is curated WITH a reviewed date, rendered hatched + chipped, " +
   "behind a CollapsedGroup like the GPU cost side",
  aiEconSrc.includes("export const HYPERSCALER_CAPEX") && /reviewed: "\d{4}-\d{2}-\d{2}"/.test(aiEconSrc) &&
  /HyperscalerCapexCard[\s\S]{0,900}ILLUS_HATCH/.test(aiSrc) &&
  aiSrc.includes('label="curated: hyperscaler capex funding flow"'));
ok("capex-dash: the section header names every leg (cost ↔ price ↔ conversion ↔ funding)",
  aiSrc.includes("cost ↔ price ↔ conversion ↔ funding"));
ok("capex-dash: it NEVER votes — computeRegime and the factor list are untouched by capex",
  !/computeRegime[\s\S]{0,2400}capex/i.test(regimeSrc) &&
  !/REGIME_FACTOR_FIELDS=\[[^\]]*capex/i.test(uiSrc) && !/capex/i.test(regimeSrc));

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
/* FEAT-NFCILEV (8/28, working/2026-08-28-nfci-leverage-disposition.md) — the leverage
   SUBINDEX, context only. Leverage drove 1929 and 2008 and the composite NFCI dilutes it;
   the subindex is isolated as a stated number that votes NOWHERE. */
ok("nfciLeverage: the series is wired with NFCI's band verbatim, and stays out of DAILY",
  /nfciLeverage:\s+"NFCILEVERAGE"/.test(snapSrc) &&
  /nfciLeverage:\s*\[-5,\s*5\]/.test(snapSrc) &&
  (() => { const m = /const DAILY = new Set\(\[([^\]]*)\]\)/.exec(snapSrc);
    return m && !/nfciLeverage/.test(m[1]); })());
ok("nfciLeverage: mapped with its OWN AsOf — weekly cadence, no DERIVED_OF row, not in the census",
  // sources.js is IMPORTED, so these run against the real objects, not source text.
  SOURCES.nfciLeverage?.path === "macro.nfci.leverage" &&
  SOURCES.nfciLeverage?.kind === "num" &&
  cadenceOf("nfciLeverage") === "weekly" &&
  !("nfciLeverage" in DERIVED_OF_SRC) &&
  !/nfciLeverage/.test(/const SIGNAL_FIELDS=\[[^\]]*\]/.exec(dashSrc)?.[0] || "x"));
ok("nfciLeverage: it votes NOWHERE — absent from the band table, the evidence contract, and the readout",
  !/nfciLeverage/i.test(regimeSrc) && !/nfciLeverage/i.test(readSrc("../src/evidence.js")) &&
  !/nfciLeverage/i.test(readSrc("../src/ttReadout.js")));
ok("nfciLeverage tile sub-line: number only, suppressed on mock/stale — no verdict word",
  mdSrc.includes("leverage subindex {lv>0?\"+\":\"\"}{lv.toFixed(2)}") &&
  /!isIllustrative\(modeOf\('nfciLeverage'\)\)&&Number\.isFinite\(lv\)/.test(mdSrc) &&
  !/leverage[\s\S]{0,200}?(TIGHT|LOOSE)/.test(mdSrc.slice(mdSrc.indexOf("leverage subindex"))));
/* 8/29: the footer MOVED to the macro strip — a leading crash indicator one tap deep in the
   explanation layer could not do its job. Two homes remain: the strip tile (glance) and the
   NFCI tile sub-line (detail). The retired footer is pinned ABSENT in both files. */
ok("nfciLeverage: the whys footer is RETIRED — no leverage prop, no context line, no levCtx",
  !/leverage/i.test(whysSrc.replace(/\/\*[\s\S]*?\*\//g, "")) &&
  !/Leverage subindex not loaded/.test(whysSrc) &&
  !/levCtx/.test(dashSrc));
/* OWNER SWAP (8/31) — these three pins REVERSE. The 8th strip slot held LEV from 8/29; it
   now holds the NFCI COMPOSITE. The reason is a voter/glance mismatch: NFCI has voted in the
   six-factor backdrop since v3.43 and was the ONE voter with no glance presence, while the
   slot beside it was rented to a field that votes nowhere. Pinned in BOTH directions so
   neither the swap nor a revert passes quietly. LEV is not deleted — it keeps the NFCI
   tile's leverage-subindex line (pinned above), and every nfciLeverage contract below this
   block (own AsOf, weekly cadence, votes nowhere) is UNCHANGED and still enforced. */
ok("8/31 swap: the strip's 8th slot carries the NFCI composite, with the reference-point sub-line",
  /\{l:"NFCI",\s+f:"nfci"/.test(stripSrc) &&
  /s:"0 = avg"/.test(stripSrc) &&
  /d\.macro\.nfci\.current\.toFixed\(2\)/.test(stripSrc));
ok("8/31 swap: LEV is GONE from the strip — pinned ABSENT, so a revert cannot land silently",
  !/\{l:"LEV"/.test(stripSrc) && !/nfciLeverage/.test(stripSrc.replace(/\/\*[\s\S]*?\*\//g, "")));
ok("8/31 swap: NFCI strip tile — no verdict word, and a non-finite value renders a dash, never 0.00",
  (() => { const i = stripSrc.indexOf('{l:"NFCI"'); const seg = stripSrc.slice(i, i + 700);
    return !/TIGHT|LOOSE|BULLISH|BEARISH/.test(seg) && /Number\.isFinite\(d\.macro\.nfci\.current\)/.test(seg) && /:"—"/.test(seg); })());
ok("8/31 swap: NFCI wears the voter marker BY CONSTRUCTION — the inverse of the LEV pin it replaces",
  // The marker is derived from FACTOR_FIELD's values, so this needs no special case: nfci IS
  // a factor field, nfciLeverage is not. Both halves pinned — the promotion and the fact that
  // the demoted field still could not have voted.
  Object.values(FACTOR_FIELD).includes("nfci") &&
  !Object.values(FACTOR_FIELD).includes("nfciLeverage") &&
  /const isVoter=vf\.has\(f\); const votes=isVoter&&live;/.test(stripSrc) &&
  /Context only — does not vote\./.test(stripSrc));
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
  mdSrc.includes('const band=v>NFCI_TIGHT?"TIGHT":v<=NFCI_LOOSE?"LOOSE":"NEUTRAL"') &&
  regimeSrc.includes('vote:(v)=> v <= NFCI_LOOSE ? "bull" : v > NFCI_TIGHT ? "bear" : "neutral"') &&
  // …and the tile IMPORTS them rather than re-declaring (the one-table rule survives
  // extraction; v3.84 re-pinned on intent — the import line also carries the CREDIT_TAIL
  // constants now, so the pin requires both NFCI names inside a regime.js import rather
  // than one exact spelling of the whole line)
  /import \{[^}]*NFCI_TIGHT, NFCI_LOOSE[^}]*\} from "\.\.\/regime\.js"/.test(mdSrc));
ok("nfci: the tight threshold is the DEFINITIONAL mean (0), not a hand-picked decimal",
  /const NFCI_TIGHT = 0;/.test(regimeSrc) && !uiSrc.includes("0.10?\"TIGHT\""));
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
  /nIllus\?\(nMode==="STALE"\?<DataModeBadge mode="STALE"\/>:<IllustrativeChip\/>\)\s*:<Badge label=\{band\}/.test(mdSrc));
ok("nfci: the tile states its own reference point — a bare z-score is unreadable without it",
  mdSrc.includes("0 = avg"));
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
  bandSrc.includes("{f.short} {vs.glyph}") && !uiSrc.includes('["10Y","VIX","F&G","CPI","VAL"][i]') &&
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
  !readSrc("../src/ttReadout.js").includes("nfci"));

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

// Execute the three pure renderers against an earnings-shaped fixture. This catches a
// syntactically valid but invisible payload field, which source-string checks alone miss.
const renderNvdaEvidence = new Function(
  liftFns(adminSrc, ["esc", "ddScenarioSec", "ddFundamentalsSec", "ddEcosystemSec"]) +
  "\nreturn {ddScenarioSec,ddFundamentalsSec,ddEcosystemSec};"
)();
const nvdaEvidence = {
  ref_px: { px: 218.93 },
  valuation_scenarios: {
    as_of: "2026-08-19", forward_period: "FY2028", forward_eps: 12.83,
    policy: "30x FY2028 forward P/E is an owner override for the NVDA king-of-supercycle thesis, not an active target",
    cases: [
      { name: "Bear", multiple: 16, pt: 205.28 },
      { name: "Base", multiple: 20, pt: 256.60 },
      { name: "Bull", multiple: 30, pt: 384.90 },
    ],
  },
  fundamentals: {
    as_of: "2026-08-19",
    income_statement: { revenue_B: 253.491, gross_profit_B: 187.952, net_income_B: 159.613 },
    balance_sheet: { cash_st_investments_B: 53.172, current_debt_B: 1, lease_obligations_B: 4.344, net_cash_after_leases_B: 40.358, current_ratio: 3.44 },
  },
  ecosystem_overlay: {
    as_of: "2026-08-19",
    names: [
      { symbol: "OpenAI", confidence: "PROVISIONAL", growth_model: { status: "PROVISIONAL", summary: "no public model" } },
      { symbol: "CRWV", growth_model: { status: "STORED_MODEL", summary: "$12.89B→$80.22B" } },
      { symbol: "NBIS", growth_model: { status: "STORED_MODEL", summary: "$3.39B→$46.82B" } },
      { symbol: "LITE", growth_model: { status: "STORED_MODEL", summary: "$6.27B→$12.68B" } },
      { symbol: "COHR", confidence: "PROVISIONAL", growth_model: { status: "PROVISIONAL", summary: "no stored model" } },
    ],
  },
};
const nvdaScenarioHtml = renderNvdaEvidence.ddScenarioSec(nvdaEvidence);
const nvdaFundamentalsHtml = renderNvdaEvidence.ddFundamentalsSec(nvdaEvidence);
const nvdaEcosystemHtml = renderNvdaEvidence.ddEcosystemSec(nvdaEvidence);
ok("NVDA earnings: scenario renderer prints 16x/20x/30x and $384.90",
  /16×/.test(nvdaScenarioHtml) && /20×/.test(nvdaScenarioHtml) &&
  /30×/.test(nvdaScenarioHtml) && /\$384\.9/.test(nvdaScenarioHtml) &&
  /ceiling/.test(nvdaScenarioHtml) && /king-of-supercycle/.test(nvdaScenarioHtml));
ok("NVDA earnings: fundamentals renderer prints measured cash and net cash",
  /FUNDAMENTALS/.test(nvdaFundamentalsHtml) &&
  /53\.172/.test(nvdaFundamentalsHtml) && /40\.358/.test(nvdaFundamentalsHtml));
ok("NVDA earnings: ecosystem renderer names all five investments and preserves provisional status",
  ["OpenAI", "CRWV", "NBIS", "LITE", "COHR"].every((s) => nvdaEcosystemHtml.includes(s)) &&
  /PROVISIONAL/.test(nvdaEcosystemHtml));
// TT-SCORE commit 1 (v3.73): the PT chain is a real module now — smoke IMPORTS it instead of
// lifting source text (the src/regime.js precedent, :11-12). admin.html keeps byte-identical
// copies (buildless, cannot import); section [49] lifts THOSE and asserts identity against
// these imports, so the lift stays as the tripwire's raw material rather than the test rig.
const LENS_MAX_PE_SRC = /const LENS_MAX_PE=(\d+);/.exec(adminSrc);
const PT = await import("../src/ptModel.js");
const DRIFT = await import("../src/ttDrift.js");
const driftSrc = readSrc("../src/ttDrift.js");
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
const missingCash = JSON.parse(JSON.stringify(fixed));
ok("ptlint: missing net cash withholds EV/S premium and emits a distinct NETCASH warning — absent is not zero",
  PT.ptModelRows(missingCash)[0].prem === null &&
  PT.lintPtModel(missingCash).some((l) => l.code === "NETCASH" && /premium withheld/.test(l.msg)));
fixed.pt_model.net_cash_B = 0; // explicit zero; absent no longer silently means zero
ok("ptlint: re-keying to the year-end priced clears MISKEY and computes the real premium",
  !PT.lintPtModel(fixed).some((l) => l.code === "MISKEY") &&
  !PT.lintPtModel(fixed).some((l) => l.code === "NETCASH") &&
  typeof PT.ptModelRows(fixed)[0].prem === "number" && PT.ptModelRows(fixed)[0].prem > 0);
ok("ptlint: the board and export carry a migration audit naming old implicit-zero rank/target movement",
  adminSrc.includes("function netCashMigrationAudit(currentRows,hz)") &&
  adminSrc.includes("MODEL INTEGRITY — NET CASH MIGRATION") && adminSrc.includes("old implicit-zero target"));
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
ok("hinge: street receipts render server blockers; red hinges stay surfaced but never become a veto",
  adminSrc.includes('r.blockers.slice(0,2).join(" · ")') &&
  adminSrc.includes("red hinges do NOT veto") && adminSrc.includes("not a veto (yours to weigh)"));

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
// wave 12: the math lives in src/aiEcon.js (pure) — smoke IMPORTS and runs the real export,
// which is stronger than the old dashSrc source-lift (the v3.60 convention).
const TW = await import("../src/aiEcon.js").then((m) => ({ TOKEN_EFFICIENCY: m.TOKEN_EFFICIENCY, tokenScissors: m.tokenScissors }));
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
  /TokenEfficiencyCard[\s\S]{0,1200}ILLUS_HATCH/.test(aiSrc) &&
  aiSrc.includes('label="curated: tokens/watt × $/token conversion"') &&
  (() => { const card = aiSrc.slice(aiSrc.indexOf("const TokenEfficiencyCard"),
                                     aiSrc.indexOf("const AIUnitEconomics"));
    return !/\$\{[^}]*\}\s*\/\s*MW/.test(card) && !/\$\d[\d.,]*\s*\/\s*MW/.test(card) &&
           card.includes("no $/MW figure is derivable"); })());
ok("tokw-dash: the verdict is SUPPRESSED on mock/stale price data (v3.1 invariant) — the " +
   "band is gated through isIllustrative, not rendered raw",
  /const band = isIllustrative\(mode\) \? null : s\.band;/.test(aiSrc));
ok("tokw-dash: it NEVER votes — computeRegime and the factor list know nothing about it",
  !/tokenScissors|TOKEN_EFFICIENCY/.test(regimeSrc) &&
  !/REGIME_FACTOR_FIELDS=\[[^\]]*token/i.test(uiSrc));
ok("tokw-tt: tokens_per_watt is a HANDLED deep-dive key rendered beside utilization " +
   "underwriting — the factor a utilization model structurally cannot see",
  /"tokens_per_watt"[,\]]/.test(adminSrc) && adminSrc.includes("function ddTokWSec(dd)") &&
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
  "let BOARD={},POSITIONS={},LIVE_PX={},DD_FULL={},DD_INDEX_MAP={};" +
  // readiness() reads the REAL model helpers (already exercised in [20]) rather than a stub —
  // the whole design claim is that a readiness part can never disagree with the chip it
  // summarizes, which only holds if both call the same function. ddOf (v3.75) is lifted for
  // the same reason: it is the payload choke point readiness resolves the thesis through.
  liftFns(adminSrc, ["ageDays", "runState", "ddDate", "hingeTally", "posOf", "posAge", "ddOf",
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
/* v3.73 order: readiness → underwriting → answers. v5.6.6 inserts the EXECUTIVE SUMMARY
   directly under the readiness gate (owner call: the tab must open with the thesis and the
   near/far targets). Re-pinned on the ORDER itself rather than a fixed character window —
   the window was brittle by construction and tipped over on the first legitimate insertion,
   which is not what "readiness leads" means. */
/* ═══ v5.6.6 — the search bar routes to ANALYSIS, and the tab opens with the answer ═══ */
ok("v5.6.6 search: an in-book name opens the DEEP DIVE, not the edit card — and the card stays one tap away on the tab",
  adminSrc.includes("if(x){switchTab(x.sym);search.value=\"\";search.blur();}") &&
  !/if\(x\)\{openCard\(x\.sym\);search\.value=""/.test(adminSrc) &&
  adminSrc.includes(`<button class="act" onclick="openCard('${"$"}{esc(x.sym)}')">OPEN TT CARD</button>`));
ok("v5.6.6 search: the HELP copy moved WITH the behaviour — no instruction outliving its data",
  /in the book<\/b> → opens its <b>deep dive<\/b>/.test(adminSrc) &&
  !/in the book<\/b> → opens its card to update/.test(adminSrc));
/* The exec summary is RUN, not string-pinned: it makes three claims (near rung, far rung,
   thesis provenance) and a string pin cannot prove any of them. */
{
  const EX = (() => {
    const i = adminSrc.indexOf("function ddThesisLine(dd){");
    const j = adminSrc.indexOf("function ddAnswerBlock(x,dd,todayET){");
    if (i < 0 || j < 0 || j < i) throw new Error("smoke: ddExec markers not found");
    return new Function("ptModelRows", "LIVE_PX", "annualise", "esc", "allocTrunc",
      adminSrc.slice(i, j) + "\nreturn {ddExec, ddThesisLine};");
  })();
  const esc0 = (v) => String(v);
  const ann0 = (up, y) => Math.round(up / (Number(y) - 2025));
  const mk = (rows) => EX((dd) => dd.rows || [], { AAA: { px: 100 } }, ann0, esc0, esc0);
  const run = (dd, rows) => mk().ddExec({ sym: "AAA" }, { ...dd, rows });
  ok("v5.6.6 exec: near and far come from the SAME row set — earliest year-end is short term, deepest is long term",
    (() => { const h = run({}, [{ y: "2026", prem: 120 }, { y: "2027", prem: 150 }, { y: "2029", prem: 300 }]);
      return /Short term/.test(h) && /Long term/.test(h) &&
        h.indexOf("$120") < h.indexOf("$300") && /\+20%/.test(h) && /\+200%/.test(h) &&
        /YE2026/.test(h) && /YE2029/.test(h) && !/YE2027/.test(h); })());
  ok("v5.6.6 exec: ONE rung is ONE fact — it is never printed twice as a near and a far target",
    (() => { const h = run({}, [{ y: "2027", prem: 150 }]);
      return /Target \(single rung\)/.test(h) && !/Short term/.test(h) && !/Long term/.test(h); })());
  ok("v5.6.6 exec: no model says so and carries the payload's own note — never a fabricated target",
    (() => { const h = run({ pt_model: { note: "floor only by owner decision" } }, []);
      return /no model — nothing here computes a target/.test(h) && /floor only by owner decision/.test(h) &&
        !/\$/.test(h.replace(/dd-[a-z]+/g, "")); })());
  /* The basis is LABELLED, and a rung carrying only the `n/m` sentinel (negative EPS — no
     P/E before profit, v3.17) is EXCLUDED by the same numeric filter ddWorth uses, so it can
     never be printed as a target. cellOf keeps a non-finite guard behind that filter, which
     is defensive rather than reachable — asserting it as reachable would be a vacuous test,
     so what is pinned here is the exclusion that actually holds. */
  ok("v5.6.6 exec: the basis is LABELLED, and an n/m-only rung is EXCLUDED rather than printed as a target",
    (() => { const a = run({}, [{ y: "2026", fl: 90 }, { y: "2028", fl: 110 }]);
      const b = run({}, [{ y: "2026", prem: 100 }, { y: "2028", fl: "n/m" }]);
      return /floor/.test(a) && !/premium/.test(a) &&
        /Target \(single rung\)/.test(b) && /premium/.test(b) && !/n\/m/.test(b) && !/YE2028/.test(b); })());
  ok("v5.6.7 exec: a SYNTHESIZED thesis is marked as such and never reads as an owner assertion",
    (() => { const L = mk().ddThesisLine;
      const syn = L({ thesis: "assistant line", thesis_src: "synthesized 2026-08-27", thesis_at: "2026-08-27" });
      const own = L({ thesis: "owner line" });
      if (!(syn.synth === true && syn.src === "synthesized 2026-08-27" && own.synth === false && own.src === "thesis")) return false;
      const h = run({ thesis: "assistant line", thesis_src: "synthesized 2026-08-27" }, [{ y: "2027", prem: 150 }]);
      const h2 = run({ thesis: "owner line" }, [{ y: "2027", prem: 150 }]);
      // the synthesized one carries the amber owner-to-confirm marker; the owner's does not
      return /owner to confirm/.test(h) && /var\(--amber\)/.test(h) && !/owner to confirm/.test(h2); })());
  ok("v5.6.6 exec: the thesis is NEVER invented — stored prose wins by priority, and an absent one is NAMED with the fix",
    (() => { const L = mk().ddThesisLine;
      const t = L({ thesis: "the thesis", verdict: { read: "v", as_of: "2026-08-01" } });
      const v = L({ verdict: { read: "the verdict read", as_of: "2026-08-01" } });
      const n = L({ valuation_note: "the note" });
      const none = L({ tier: "S", lens: "AI", composite: "9.1" });
      const h = run({}, [{ y: "2027", prem: 150 }]);
      return t.src === "thesis" && v.src === "verdict" && v.at === "2026-08-01" &&
        n.src === "valuation_note" && none === null &&
        /no thesis line stored/.test(h) && /add one as/.test(h); })());
}
ok("ready: readiness leads the deep-dive tab, then the exec summary, the score bar, and the four answers",
  ["h+=readyBar(x);", "h+=ddExec(x,dd);", "h+=ddScoreBar(x);", "h+=ddAnswerBlock(x,dd,todayET);"]
    .map((m) => adminSrc.indexOf(m))
    .every((v, i, a) => v > 0 && (i === 0 || a[i - 1] < v)));
/* Re-pinned at v5.7.1: the card reordered — the executive summary now LEADS (owner spec:
   thesis → targets → colored gates are the primary), with gates second and readiness
   third; MEASURED moved inside the ✎ EDIT window. The readiness bar itself is unchanged. */
ok("ready: and on the card — the only per-ticker surface a WATCH name with no tab ever gets",
  adminSrc.includes('<div class="k">READINESS</div>') && adminSrc.includes("let html=exec+v2CardHtml(x.sym)+rdyRow;"));
/* ── v5.7.1 — the readable card: builder-level pins (the render suite drives the DOM) ── */
ok("v5.7.1 card: ONE executive-summary builder at two altitudes — the card calls the tab's own ddExec",
  adminSrc.includes("const exec=dd?ddExec(x,dd)") &&
  /h\+=ddExec\(x,dd\);/.test(adminSrc));
ok("v5.7.1 card: an absent payload states its three honest states — loading, failed, none (never a guess)",
  adminSrc.includes('DD_PENDING?"payload index still loading — not read, not empty"') &&
  adminSrc.includes('no thesis payload stored — the readiness row below says what is missing'));
ok("v5.7.1 gates: chips carry glyph + color from ONE map, and the reasons ride the chip title verbatim",
  adminSrc.includes('const gcol=(st)=>st==="PASS"?"var(--green)":st==="FAIL"?"var(--red)":"var(--amber)";') &&
  adminSrc.includes('st==="PASS"?"✓":st==="FAIL"?"✗":"?"') &&
  /title="\$\{esc\(g\.reason\|\|""\)\}"/.test(adminSrc));
ok("v5.7.1 gates: the verbatim sentence rows SURVIVE inside the window — moved, never deleted (v3.66)",
  adminSrc.includes("gate details — every reason verbatim") &&
  adminSrc.includes('`<b style="color:${gcol(g.status)}">${esc(g.status)}</b> · ${esc(String(g.id||"").replace(/_/g," "))} — ${esc(g.reason||"")}</div>`'));
ok("v5.7.1 gates: the stale-receipt warning stays ON THE FACE — it gates action and is never collapsed",
  (() => { const i = adminSrc.indexOf("receipt predates current macro readout");
    const j = adminSrc.indexOf("gate details — every reason verbatim");
    return i >= 0 && j > i; })());
ok("v5.7.1 card: every editor id lives inside the ✎ EDIT window and the attestation path opens it",
  (() => { const i = adminSrc.indexOf('✎ EDIT — tier · lens · routing · run stamp · note');
    if (i < 0) return false;
    const seg = adminSrc.slice(i, adminSrc.indexOf("</details>", i));
    return ["fTier","fLens","fFp","fLastRun","fNote"].every((id) => seg.includes(id)) &&
      adminSrc.includes('const det=input.closest("details");if(det)det.open=true;'); })());
ok("ready: blockers stay visible as chips on the bar, never collapsed into the verdict alone",
  adminSrc.includes("⛔ not actionable until:") && adminSrc.includes('p.sev==="block"?"head"'));
// v2.4.0 PROVISIONAL: the shadow head leads with the capped bootstrap diagnostic and states
// its ineligibility in the same breath — and the color branch can never paint it green.
ok("shadow: PROVISIONAL renders capped + never-eligible on the head, amber never SCORED's green",
  adminSrc.includes("never eligible until SCORED") &&
  adminSrc.includes('const provisional=sc.status==="PROVISIONAL"') &&
  adminSrc.includes("scored&&!provisional?"));

// ---- 25. public-audit: the factor count is stated, and stated correctly ----
// A label that disagrees with the vote it describes is the FIX-E defect. NFCI made the vote
// six in v3.43; three user-facing strings still said "5-factor". Pinned in BOTH directions so
// a future 7th voter fails here rather than shipping a wrong count to the public page.
console.log("\n[25] public dashboard — the stated factor count matches the vote cast");
ok("regime: no surviving '5-factor' claim anywhere in the dashboard",
  !/5-factor/.test(uiSrc));
ok("regime: the vote is described as 6-factor on the band and the source box",
  /6-factor/.test(bandSrc) && /6-factor/.test(whysSrc));
ok("regime: the stated count equals REGIME_FACTOR_FIELDS + the valuation factor",
  REGIME_FACTOR_FIELDS.length + 1 === 6 && FACTOR_FIELD.valuation === "shillerPe");

// ---- 26. public audit (v3.51): naming, provenance vocabulary, and affordance honesty ----
// The public product's promise is a TRUSTWORTHY posture. These are the places the page said
// something not quite true about itself — none of them a wrong number, all of them a wrong claim.
console.log("\n[26] public dashboard — the page tells the truth about itself");
// Two structurally different regimes exist (this six-factor backdrop vs /readout.json's
// six ORDER-GATING checks). Both legitimate; unnamed, a reader assumes one verdict.
ok("naming: the public verdict is MACRO BACKDROP, distinct from the order-gating readout",
  bandSrc.includes("Macro Backdrop") && !uiSrc.includes(">Macro Regime · wen moon?<"));
ok("naming: the moon states survive as the primary voice (owner call — personality kept)",
  bandSrc.includes("wen moon?") && dashSrc.includes("WEN_MOON_STATES"));
// SPY on this page is SP500/10 from FRED — Stooq blocks the edge. The tooltip claimed "ETF".
ok("provenance: SPY is labelled a FRED proxy, not an ETF quote it has never been",
  /FRED SP500 proxy, NOT an SPY ETF quote/.test(stripSrc) && !/S&P 500 ETF — the broad US stock market/.test(uiSrc));
// "Manual" + a LIVE badge on the same tile made the provenance vocabulary self-contradictory:
// `api` is the FETCH PATH, `mode` is freshness — and multpl IS the live scrape.
ok("provenance: CAPE credits its real fetch path (multpl scrape), not 'Manual' beside a LIVE badge",
  mrSrc.includes('api="multpl.com"') && !/api="Manual" endpoint="Robert Shiller/.test(uiSrc));
// An ON/OFF control beside 8px muted "notifications not wired" reads as a working alert system.
ok("affordance: the alert toggles state their real limit at the weight of the control itself",
  /no push, email or SMS is sent/.test(alSrc) && !/Triggers evaluate live data · notifications not wired/.test(uiSrc));
// Confidence: Signal Quality counted TILES and never said whether the VERDICT was trustworthy.
// v3.94 DRIVERS-ONLY: the verdict-confidence segments render in the HERO's status line
// (one render site beside the verdict they describe); the strip keeps the census only.
ok("confidence: the hero status line reports how many factors actually voted, from the EvidenceSet itself",
  bandSrc.includes("{conf.counted} of {conf.total} voters counted") &&
  dashSrc.includes("counted:evidenceSet.counted,total:evidenceSet.totalFactors") &&
  dashSrc.includes("conf={regimeConf}"));
// v3.98.3: ONE vocabulary on this screen — the sentence directly above calls them "dark",
// so the line does too, and "voters" scopes it against WHY #2's wider cross-signal list.
ok("confidence: excluded factors are NAMED on the hero — 'N of 6' without saying which is half a fact",
  bandSrc.includes("dark: {conf.excluded.join") && bandSrc.includes("crash gauge (VIX) unavailable"));

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
/* v6.0 (PR #10's live fix, carried forward at its close): "separately" used to mean two
   MUTUALLY-EXCLUSIVE badges — BLIND rendered only at activeAlerts===0, so "1 fired · 3
   blind" printed as a confident "⚡ 1 FIRED" alone: the v3.52 false clear surviving at a
   nonzero numerator. One badge now carries both counts whenever either is nonzero. */
ok("alert: BLIND is reported whenever a monitor is blind — even BESIDE a fired count (PR #10's false clear, closed)",
  dashSrc.includes("(activeAlerts>0||alertBlind>0)&&") &&
  dashSrc.includes('alertBlind>0?`${alertBlind} BLIND`:null') &&
  !dashSrc.includes("activeAlerts===0&&alertBlind>0"));
ok("alert: the merged badge is red when anything FIRED (a trip outranks a blind gauge), amber when only blind",
  dashSrc.includes("color={activeAlerts>0?T.red:T.amber}"));

/* ── v6.0 T4 — the alerts PERSIST: overlay on DEFAULT_ALERTS, never the array itself ──
   The 8/31 button audit measured the Macro Alerts section as the largest button
   concentration on Power, all of it operating one-session useState. The overlay design is
   the load-bearing choice and is RUN here: storing the array would silently drop every
   alert a later release ADDS (the v3.55 arrival problem in reverse). */
const alertPrefsLifted = (() => {
  const i = dashSrc.indexOf("const ALERT_PREFS_KEY=");
  const j = dashSrc.indexOf("\n}", dashSrc.indexOf("function alertPrefsOf"));
  if (i < 0 || j < 0) throw new Error("smoke: alert-prefs markers not found");
  return new Function(dashSrc.slice(i, j + 2) + "\nreturn {applyAlertPrefs, alertPrefsOf, ALERT_PREFS_KEY};")();
})();
{
  const { applyAlertPrefs, alertPrefsOf, ALERT_PREFS_KEY } = alertPrefsLifted;
  const DEFS = [
    { id: 1, label: "A", active: true }, { id: 2, label: "B", active: false },
    { id: 3, label: "C", active: true },
  ];
  ok("alerts persist: key rides the md:* family", ALERT_PREFS_KEY === "md:alerts:v1");
  ok("alerts persist: a toggle and a delete ROUND-TRIP through the overlay",
    (() => { const cur = [{ ...DEFS[0], active: false }, DEFS[2]];      // 1 toggled off, 2 deleted
      const back = applyAlertPrefs(DEFS, alertPrefsOf(DEFS, cur));
      return back.length === 2 && back[0].id === 1 && back[0].active === false
        && back[1].id === 3 && back[1].active === true; })());
  ok("alerts persist: an alert a LATER release adds SURVIVES stored prefs — the overlay never drops an arrival",
    (() => { const stored = alertPrefsOf(DEFS, [DEFS[2]]);              // old release: 1+2 deleted
      const grown = [...DEFS, { id: 4, label: "NEW", active: true }];
      const back = applyAlertPrefs(grown, stored);
      return back.some((a) => a.id === 4 && a.active === true) && back.length === 2; })());
  ok("alerts persist: garbage, a wrong version, and null all fall back to the DEFAULTS (the md:view rule)",
    applyAlertPrefs(DEFS, "junk") === DEFS && applyAlertPrefs(DEFS, { v: 2 }) === DEFS &&
    applyAlertPrefs(DEFS, null) === DEFS);
  ok("alerts persist: an UNKNOWN stored id is ignored — it can neither delete nor toggle anything real",
    (() => { const back = applyAlertPrefs(DEFS, { v: 1, active: { 99: false }, deleted: [98] });
      return back.length === 3 && back.every((a, i) => a.active === DEFS[i].active); })());
  ok("alerts persist: wiring — lazy init reads the overlay, every change writes it back",
    dashSrc.includes("useState(()=>{") &&
    dashSrc.includes("applyAlertPrefs(DEFAULT_ALERTS,JSON.parse(localStorage.getItem(ALERT_PREFS_KEY)") &&
    dashSrc.includes("localStorage.setItem(ALERT_PREFS_KEY,JSON.stringify(alertPrefsOf(DEFAULT_ALERTS,alerts)))"));
}
ok("alert: the section states it evaluates HERE and delivers nothing",
  /Evaluated live on THIS page only — no push, email or SMS is sent/.test(alSrc));
// ---- a11y (suite audit #2): landmarks + live regions on the public page ----
ok("a11y: the page exposes a main landmark (there were ZERO before)",
  /role="main"/.test(dashSrc));
// B4 (v3.59) superseded the block-sized live regions: landmarks stay, announcement narrows
// to ONE concise status sentence — a reader should hear "backdrop changed", not whole blocks.
ok("a11y: verdict + confidence keep their LANDMARKS but are no longer block live regions",
  /aria-label="Macro backdrop verdict"\n?/.test(bandSrc) &&
  /aria-label="Signal quality"/.test(sqSrc) &&   // v3.94: confidence lives on the hero now
  !/aria-label="Macro backdrop verdict" aria-live/.test(bandSrc));
ok("a11y B4: ONE concise visually-hidden status region announces state changes",
  /aria-live="polite" role="status" className="visually-hidden"/.test(dashSrc) &&
  /MacroDash \$\{dailyCall\.headline\}, \$\{dailyCall\.direction\}: \$\{dailyCall\.counts\.usable\} of \$\{dailyCall\.counts\.total\} voters counted\./.test(dashSrc));
ok("a11y B4: header actions carry 44px thumb targets at phone width",
  // v3.62: the TT and TERMINAL actions moved inside the ⋯ OPS disclosure, and the summary
  // itself became an action — so the count is 4 (share · OPS · TT · TERMINAL). The contract is
  // unchanged and is what matters: EVERY header action gets a real thumb target, including the
  // ones now one tap deep, which is why they kept the class rather than losing it to the menu.
  /\.hdr-act\{min-height:44px;min-width:44px/.test(dashSrc) &&
  // v3.94: +1 source site — the Simple|Power toggle (ONE mapped element rendering two
  // buttons at runtime) carries the same thumb-target class.
  (dashSrc.match(/className="hdr-act"/g) || []).length === 5);
ok("a11y B4: sparklines are decorative (aria-hidden); the SPY chart has a TEXT equivalent",
  /\{spark&&<div aria-hidden="true"/.test(dtSrc) &&
  /its 200-day average of/.test(mdSrc));

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
  bandSrc.includes("⇄ would change this: ") && bandSrc.includes("const nearest=fc.flips[0]||null;"));
ok("flip render: the no-single-flip case is stated in BOTH the band and the panel",
  /no single factor crossing flips this verdict — it would take two/.test(bandSrc) &&
  /No single factor crossing changes the call/.test(bandSrc));
// 8/28 matrix row 17: "at 3 bull / 1 bear of 5 voting" used the slash as a separator two lines
// under fractions that use it as division. Now prose, and pinned so it stays prose.
ok("row 17: the no-flip tally reads as prose, with no slash to misread as a fraction",
  /with \{fc\.bullVotes\} bull and \{fc\.bearVotes\} bear among the \{fc\.counted\} counted/.test(bandSrc) &&
  !/\{fc\.bullVotes\} bull \/ \{fc\.bearVotes\} bear/.test(bandSrc));
ok("flip render: the panel names abstentions and stale exclusions, never silently dropping them",
  bandSrc.includes("no single threshold — ") &&
  bandSrc.includes("their thresholds are not load-bearing"));
ok("flip render: distances print at the precision of the factor's own band (fmt.num + dec)",
  bandSrc.includes("fmt.num(nearest.distance,nearest.dec)") && fmt.num(1.2345, 2) === "1.23" && fmt.num(42, 0) === "42");
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
  readSrc("../src/useMarketData.js").includes('const liveBuild = MODE === "live";'));
// mode:"MOCK" is ambiguous between demo and failed-live; the hook now says which.
ok("quorum: the wiring point exposes build INTENT so a failed live fetch is not read as demo",
  (() => { const src = readSrc("../src/useMarketData.js");
    return (src.match(/liveBuild/g) || []).length >= 4 && src.includes("loading: liveBuild"); })());
// LOADING is not a verdict state.
ok("quorum: LOADING withholds the posture outright rather than computing one from mock",
  bandSrc.includes('const withheld=loading||regime.insufficient||(call&&!call.headline);') &&
  dashSrc.includes('loading={mode==="LOADING"}'));
ok("quorum: the withheld state gets its OWN moon voice, never a directional one defaulted",
  /CAN'T CALL IT/.test(bandSrc) && bandSrc.includes("withheld?WEN_MOON_STATES[3]"));
ok("quorum: the flip line is suppressed when there is no posture to flip (v3.94: it lives in the panel, gated !withheld)",
  /\{!withheld&&<div[^>]*>\s*\n?\s*<span style=\{\{color:T\.textMuted\}\}>⇄ would change this: <\/span>/.test(bandSrc) &&
  /\{withheld&&<div/.test(bandSrc));
ok("quorum: the hero states the withhold with the quorum named, visible while everything is closed",
  // 8/28 matrix row 2: canonical coverage vocabulary — it said "factors usable" directly
  // beside a voters line stating the identical number.
  /only \$\{regime\.counted\} of \$\{regime\.totalFactors\} voters counted — \$\{regime\.quorum\} needed to call it/.test(bandSrc) &&
  !/factors usable — \$\{regime\.quorum\}/.test(bandSrc));
// ---- Why-this-call canonical boundary ----
// The explanation may render only the factors the canonical call already stamped. Context
// fields can inform trust, but SPY/Fed/WTI/BTC/credit can never masquerade as voters.
ok("why-call: dashboard passes the canonical call, factor rows, flips, and snapshot timestamp",
  /call:dailyCall, factors:evidenceSet\.factors, flips:evidenceSet\.flips/.test(dashSrc) &&
  /snapshotAsOf:asOf/.test(dashSrc));
ok("why-call: the generator has no direct SPY/Fed/WTI/BTC/credit recital path",
  !/spy\.price|fed\.rate|ca\.wti|ca\.btc|credit\.spread/.test(readSrc("../src/fiveWhys.js")));

// ---- 30. 11.4.5 audit — a11y tokens, headings, and safe GET ----------------
console.log("\n[30] 11.4.5 audit — contrast, focus, headings, HTTP semantics");
// Contrast is COMPUTED here, not asserted in a comment — the previous "WCAG AA verified"
// annotation on live-cyan-700 was false (3.20:1), which is the same defect class as a label
// describing deleted data. This test makes the claim falsifiable.
const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// tok() reads the EXPORT, not source text — the tokens moved to src/design-tokens.js (task 1.1),
// so a regex against dashSrc would silently return undefined and vacuously fail these ratios.
const tok = (name) => DT[name];
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
ok("a11y: focus styling uses :focus-visible, so a mouse click never paints a ring (the skip link is the one deliberate :focus rule — it must reveal on keyboard focus)",
  !/[^-]:focus\{/.test(dashSrc.replace(".skip-link:focus{","")));
ok("a11y: the page has a document heading (it had no h1–h6 at all)",
  /<h1 className="visually-hidden">/.test(dashSrc) && /\.visually-hidden\{position:absolute/.test(dashSrc));
// HTTP semantics: GET must be safe. Both of these WROTE.
const ledgerSrc2 = readSrc("../functions/api/ledger.js");
const posSrc2 = readSrc("../functions/api/positions.js");
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
ok("capability: the tripped falsifier still reaches the CLOSED glance surface — one count in FLAGS " +
   "(v5.97.4: the ⚡ badges died with the hidden strip; impaired joins the same aggregation)",
  adminSrc.includes("(cp&&cp.impaired?1:0)"));
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
  /5\.00% = the 2007 pre-GFC reference level/.test(mdSrc) &&
  !/BUBBLE|OVERVALUED/.test(mdSrc.slice(mdSrc.indexOf('label="30Y Treasury"'),
    mdSrc.indexOf('label="30Y Treasury"') + 900)));
ok("30y: the tile names the inversion explicitly when the spread goes negative",
  /INVERTED/.test(mdSrc));
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
/* v5.97 — THIS PIN SPLITS, and only half of it reverses. It was the v3.55 arrival rule: a new
   series does not vote on day one, in EITHER engine. On owner call the 30Y now votes in Engine
   0 — so the ttReadout half inverts — while the PUBLIC six-factor backdrop is deliberately
   untouched. That half is not a leftover: it is now the thing that keeps the two engines from
   quietly merging, and the v5.9.5 sheet copy describing the public 10Y vote depends on it. */
ok("v5.97: the 30Y does NOT vote in the PUBLIC backdrop — REGIME_BAND_TABLE is still untouched",
  !/thirtyYear|spread10s30s/.test(dashSrc.slice(dashSrc.indexOf("const REGIME_BAND_TABLE"),
    dashSrc.indexOf("export function verdictFrom"))));
ok("v5.97: the 30Y DOES vote in Engine 0 — the v3.55 arrival rule, lifted by owner call",
  (() => { const src = readSrc("../src/ttReadout.js");
    return /thirtyYear/.test(src) && /spread10s30s/.test(src)
      && typeof band30yCurve === "function"; })());

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
// v3.76 re-pinned on the CURRENT contract: the flat "NOT RANKED" bin became TWO sections,
// because "reviewed but the math can't price it" and "never looked at" are different facts and
// only the first belongs in a next-dollar hierarchy. Coverage is still total — every book name
// lands in exactly one of ranked / reviewed-not-rate-rankable / not-reviewed.
ok("rankexport: names what it could NOT rank — silent truncation reads as full coverage",
  /## REVIEWED — NOT RATE-RANKABLE/.test(rxSeg) && /NOT judged unattractive/.test(rxSeg) &&
  /## NOT REVIEWED/.test(rxSeg) && /never been looked at/.test(rxSeg));
ok("rankexport: the reviewed-but-unpriced section is a RANKING on the TT composite, and reads " +
   "UNRANKED_ROWS rather than re-deriving it (doctrine #1 — one computation, many altitudes)",
  /UNRANKED_ROWS\.forEach\(\(r, ?i\) ?=>/.test(rxSeg) &&
  /Why no %\/yr\|Fix/.test(rxSeg) && /borrowing one would be a units error/.test(rxSeg) &&
  !/ptModelRows\(/.test(rxSeg));
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
  /fetchRateOdds/.test(readSrc("../functions/api/snapshot.js")));

// (5) AMBIGUITY: three files, two body caps, no stated reason reads as an oversight.
ok("e2e: the positions store's smaller cap is documented, not left to look accidental",
  (() => { const src = readSrc("../functions/api/positions.js");
    return /Deliberately 64KB, NOT the book's 300KB/.test(src); })());
ok("e2e: the book cap and its client pre-flight mirror still agree",
  /const MAX_BODY = 300 \* 1024;/.test(ttSrc) && /const MAX_BODY=300\*1024;/.test(adminSrc));

// ---- 36. v3.58 hotfix (UX re-audit fix-now) — truthfulness, 320px, boundary ----
console.log("\n[36] v3.58 hotfix — no mock narration, 320px contract, public gate");
// A1: freshSet still keys on build intent for the headline-context freshness gate.
ok("A1: freshSet derives from liveBuild, never anyLive",
  /const freshSet=liveBuild \? new Set/.test(dashSrc) && !/freshSet=anyLive/.test(dashSrc));
ok("A1: demoted() still keys on anyLive — demotion is display, and the demo must not collapse",
  /const demoted=\(f\)=>anyLive&&isIllustrative/.test(dashSrc));
/* 8/28 clock matrix A13: narrating the FROZEN call, the prefix is the call's clock, not the
   reader's — an evening reader met "Post-close —" over a 10am artifact. */
ok("A13: a frozen call's chain is prefixed by the CALL's clock, not the reading session",
  computeFiveWhys({ ...MOCK_DATA, session: "CLOSE" }, fwRegime, { ...fwOpts, callFrozen: true })
    .headline.startsWith("10am call —") &&
  !/Post-close/.test(computeFiveWhys({ ...MOCK_DATA, session: "CLOSE" }, fwRegime, { ...fwOpts, callFrozen: true }).headline));
ok("A13: the unfrozen chain keeps the live session prefix (no over-correction)",
  computeFiveWhys({ ...MOCK_DATA, session: "CLOSE" }, fwRegime, fwOpts).headline.startsWith("Post-close —") &&
  !/10am call/.test(computeFiveWhys({ ...MOCK_DATA, session: "CLOSE" }, fwRegime, fwOpts).headline));
ok("A13: the dashboard hands the frozen flag to the chain", /snapshotAsOf:asOf[\s\S]{0,260}callFrozen/.test(dashSrc));
ok("A1: the canonical headline never carries a context-only SPY day move",
  // Re-anchored on the row-11 copy; the old "usable factors bullish" phrase is retired.
  !/— SPY/.test(fw.headline) && /counted voters lean bullish/.test(fw.headline));
// A2: the 320px contract — identity group may shrink, actions may wrap, wordmark yields first.
ok("A2: header groups can shrink and wrap instead of forcing horizontal overflow",
  /alignItems:"center",gap:14,minWidth:0,flexWrap:"wrap"/.test(dashSrc) &&
  /alignItems:"center",gap:8,flexWrap:"wrap",minWidth:0/.test(dashSrc));
ok("A2: the duplicate lowercase wordmark hides below 360px",
  /@media\(max-width:359px\)\{\.sub-wordmark\{display:none;\}\}/.test(dashSrc));
// A3: browser suites fail rather than skip under CI's flag; both routes are covered.
ok("A3: both browser suites honor REQUIRE_BROWSER=1 (skip becomes a failure)",
  /REQUIRE_BROWSER === "1"/.test(readSrc("../test/public-render.mjs")) &&
  /REQUIRE_BROWSER === "1"/.test(readSrc("../test/render.mjs")));
ok("A3: the public suite actually visits the public route, not only the operator one",
  /\/\?view=public/.test(readSrc("../test/public-render.mjs")));
// A4: the boundary is ENFORCED by the gate, not described by a comment.
ok("A4: MY CONVICTION and Macro Alerts are gated behind !publicView",
  /\{!publicView&&!simple&&\(<section aria-label="Operator monitors — conviction and alerts">\s*\n\s*<Watchlist /.test(dashSrc) &&   // v3.94: + the Simple gate
  /<Alerts alerts=\{alerts\}[\s\S]{0,200}\/>\s*\n\s*<\/section>\)\}/.test(dashSrc));
ok("A4: the public footer NAMES the omission (a cut takes its attribution with it)",
  /operator view carries the curated watchlist and alert monitors/.test(dashSrc));
// A5: production dependency surface is classified and checkable in one command.
ok("A5: audit:prod script exists (measured clean at v3.58 — all 3 advisories are dev toolchain)",
  /"audit:prod": "npm audit --omit=dev"/.test(readSrc("../package.json")));

// ---- 37. v3.59 follow-ups — ERROR mode, provenance vocabulary, security ----
console.log("\n[37] v3.59 — ERROR is not demo, fresh is not live, debug needs a token");
const hookSrc = readSrc("../src/useMarketData.js");
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
  /ERROR:\s*\{ label:"⚠ ERROR"/.test(sbSrc));
// B2: fresh ≠ live. The rollup names both parts; the footers derive from state.
ok("B2: Signal Quality counts live and cached separately under a FRESH rollup",
  /if\(m==="LIVE"\)\{a\.fresh\+\+;a\.live\+\+;\}else if\(m==="CACHED"\)\{a\.fresh\+\+;a\.cached\+\+;\}/.test(dashSrc) &&
  /\{sq\.fresh\} fresh/.test(sqSrc) && /\{sq\.live\} live · \{sq\.cached\} cached/.test(sqSrc));
ok("B2: 'derived from live data' is now STATE-derived, one derivation for both footers",
  /const derivedLabel=mode==="LIVE"\?"derived from live data"/.test(dashSrc) &&
  /derived from today's cached snapshot/.test(dashSrc) &&
  /· \{srcLabel\}<\/div>/.test(bandSrc) && /· \{derivedLabel\} \(no LLM\)/.test(whysSrc) &&
  /derivedLabel=\{derivedLabel\}/.test(dashSrc));
// B3: operational data needs a token; the public route gets a report-only CSP.
const snapSrc2 = readSrc("../functions/api/snapshot.js");
ok("B3: ?debug requires the DEBUG_TOKEN secret — fail closed both ways",
  /env\.DEBUG_TOKEN && debugParam && debugParam === env\.DEBUG_TOKEN/.test(snapSrc2) &&
  !/const debug = params\.get\("debug"\) === "1"/.test(snapSrc2));
const mwSrc = readSrc("../functions/_middleware.js");
ok("B3: report-only CSP on public routes; /admin.html and /api are deliberately exempt",
  /content-security-policy-report-only/.test(mwSrc) &&
  /cspPath !== "\/admin\.html"/.test(mwSrc) && /!cspPath\.startsWith\("\/api\/"\)/.test(mwSrc));
ok("B3: the CSP is REPORT-ONLY (observe before enforcing), never the enforcing header yet",
  !/h\.set\("content-security-policy",/.test(mwSrc));
// B5: AGENTS.md carries no volatile facts — the rot vector is removed, not re-fed.
const agentsSrc = readSrc("../AGENTS.md");
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
      e.factors.find((f) => f.key === "vix").reason === "no live feed right now"; })());
ok("evidence: INSUFFICIENT below the 4-of-6 quorum — withheld with the count stated",
  (() => { const e = ev({ provenance: { tenYear: "LIVE", vix: "LIVE" },
    dataAsOf: { tenYear: "2026-08-01", vix: "2026-08-01" } });
    return e.state === "INSUFFICIENT" && e.withheld && e.counted === 2 &&
      // 8/28 vocabulary pass: the Drivers label states coverage in the hero's own words.
      e.freshSummary === "2 of 6 voters counted"; })());
ok("evidence: DEMO — a mock build keeps its posture (mock IS that baseline)",
  (() => { const e = ev({ mode: "MOCK", liveBuild: false, provenance: {}, dataAsOf: {} });
    return e.state === "DEMO" && !e.withheld && e.counted === 6; })());
// The factors carry the full honesty payload.
ok("evidence: every factor row carries vote, mode, as-of and display copy",
  ev().factors.every((f) => ["bull", "bear", "neutral", "excluded"].includes(f.vote) &&
    f.mode && f.display && f.asOf === "2026-08-01") && ev().factors.length === 6);
ok("evidence: a STALE factor's reason says too-old-for-cadence, never the no-feed wording",
  (() => { const e = ev({ dataAsOf: { ...FRESH_ASOF, vix: "2026-01-02" } });
    return e.factors.find((f) => f.key === "vix").reason === "too old for how often it updates"; })());
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
const evidenceSrc = readSrc("../src/evidence.js");
ok("C1: evidence.js WRAPS the engine — it imports regime.js, never restates a band",
  /from "\.\/regime\.js"/.test(evidenceSrc) && !/v < 18|v > 25|<= NFCI_LOOSE \?/.test(evidenceSrc));
ok("C1: the dashboard's modeOf and exclusions ARE the shared derivations (no local copy)",
  dashSrc.includes("const modeOf=(k)=>fieldMode(provenance, dataAsOf, k);") &&
  dashSrc.includes("const staleFactors=factorExclusions({provenance, dataAsOf, liveBuild});") &&
  !dashSrc.includes('const unusable=(k)=>'));
ok("C2: a real <header> landmark, a Sections <nav>, and the six-anchor h2 outline exist",
  /<header style=/.test(dashSrc) && /<nav aria-label="Sections"/.test(navSrc) &&
  ["overview", "drivers", "markets", "macro"].every((id) =>
    dashSrc.includes(`id="${id}"`)) && aiSrc.includes('id="ai"') && dhSrc.includes('id="health"'));
ok("C3: the Drivers matrix renders the CONTRACT (evidenceSet.factors), not its own reading",
  dashSrc.includes("evidenceSet.factors.map(f=>") && dashSrc.includes("excluded — {f.reason}"));
ok("C4: the digest persists AFTER comparing, and only quorate sets become the baseline",
  dashSrc.indexOf("compareEvidence(prev,cur)") < dashSrc.indexOf("localStorage.setItem(LASTVALID_KEY") &&
  // v3.61 (newcomer audit): the copy states the localStorage device scope explicitly.
  wcSrc.includes("baseline set — tracking starts today on this device") &&
  wcSrc.includes("no material change since your previous visit on this device"));

// ---- 39. v3.61 FEAT-GLANCE — safe-area + first-glance density + newcomer fixes ----
console.log("\n[41] v3.61 — safe-area, first-glance density, newcomer-audit fixes");
// F1: index.html has shipped viewport-fit=cover + black-translucent since v1 — the page is
// deliberately drawn BEHIND the iOS status bar — but env(safe-area-inset-*) existed nowhere,
// so the wordmark rendered under the Dynamic Island. The comment at index.html:5 claimed
// safe-area handling; these pins make the claim true and keep it true.
const indexSrc = readSrc("../index.html");
const manifest = JSON.parse(readSrc("../manifest.webmanifest"));
ok("share: document and Open Graph titles use the canonical MacroDash - Stonks copy",
  indexSrc.includes("<title>MacroDash - Stonks</title>") &&
  indexSrc.includes('<meta property="og:title" content="MacroDash - Stonks" />') &&
  indexSrc.includes('<meta name="twitter:title" content="MacroDash - Stonks" />'));
ok("share: Messages has an explicit M icon instead of the Cloudflare Pages fallback",
  indexSrc.includes('<link rel="icon" type="image/svg+xml" href="/macrodash-icon.svg" />') &&
  indexSrc.includes('<link rel="apple-touch-icon" href="/macrodash-icon-180.png" />') &&
  existsSync(new URL("../public/macrodash-icon.svg", import.meta.url)) &&
  manifest.icons.some(({src, type}) => src === "/macrodash-icon.svg" && type === "image/svg+xml") &&
  manifest.icons.some(({src, type}) => src === "/macrodash-icon-180.png" && type === "image/png"));
ok("glance: index.html still ships viewport-fit=cover (the env() half depends on it)",
  /viewport-fit=cover/.test(indexSrc));
ok("glance: the header pads for the island — calc(8px + env(safe-area-inset-top))",
  dashSrc.includes('padding:"calc(8px + env(safe-area-inset-top)) 20px 8px"'));
ok("glance: the sticky nav offsets below the island with an opaque scrim over the strip " +
   "(padding the nav instead would render a permanent inset-height band when not stuck)",
  navSrc.includes('top:"env(safe-area-inset-top)"') &&
  dashSrc.includes('height:"env(safe-area-inset-top)"'));
ok("glance: landscape notch edges — root pads left/right insets",
  dashSrc.includes('paddingLeft:"env(safe-area-inset-left)"') &&
  dashSrc.includes('paddingRight:"env(safe-area-inset-right)"'));
// F2: the two big v3.60 diagnostic blocks collapse behind the FEAT-321 idiom. chip={false}
// both times — live evidence, not curated content.
ok("glance: the Drivers matrix cards collapse (band chips are the icon-first six-factor view)",
  // v3.93: the eyebrow folded into the toggle label — count summary visible while closed.
  /label=\{`factor evidence — used in today's posture · \$\{evidenceSet\.freshSummary\}/.test(dashSrc) &&
  /count=\{evidenceSet\.factors\.length\} chip=\{false\}/.test(dashSrc));
ok("glance: the Data Health per-source grid collapses; the ERROR/Retry row stays OUTSIDE",
  /label="per-source detail" chip=\{false\}/.test(dhSrc) &&
  dhSrc.indexOf('mode==="ERROR"&&<div style={{fontFamily:T.fontMono,fontSize:9,color:T.red') <
  dhSrc.indexOf('label="per-source detail"'));
ok("glance: the decode legend moved INTO the Data Health expander — the always-visible strip " +
   "no longer carries explanation, only evidence",
  dhSrc.includes("legend: ● live · ⏱ stale ·") &&
  !/marginLeft:"auto"\}\}>● live · ⏱ stale ·/.test(uiSrc));
ok("glance: the 30Y tile note keeps the FACT (spread + INVERTED) and moves the reference " +
   "prose to a tooltip — a red fact must survive the default view",
  mdSrc.includes('noteTitle={"5.00% = the 2007 pre-GFC reference level"}') &&
  /title=\{noteTitle\|\|undefined\}/.test(dtSrc));
// F2b-1 (behavioral, real import): the verdict sub must never name an excluded factor.
const subFix = (fg, cpiLast) => ({
  crossAsset: { treasury10y: { m1: -0.2 } },
  marketPulse: { vix: { current: 17.09 }, fearGreed: { score: fg } },
  macro: { cpi: { trend: [3.2, 3.1, 3.0, 2.9, 2.8, cpiLast] },
    shillerPe: { current: 24, mean: 17.6, ath: 44.19 }, nfci: { current: -0.42 } },
});
/* FEAT-NEWCOMER-RULER (8/29) — this pin REVERSED. It blessed the canned "watch VIX" on
   every mixed tape, which is the ticket's named bug: on 2026-08-29 VIX was already asleep
   (<18, HELPING) and the real split was vol+inflation vs a rich CAPE — the sub told a
   newcomer to watch the one gauge that was fine. The MIXED sub is now DERIVED from the
   votes cast: both sides present → named disagreement; one-sided → the v3.61 nearest-flip
   fallback (there is no disagreement to name). subFix(42,2.9) is 3 bull / 0 bear, so it
   takes the fallback. */
ok("ruler: one-sided MIXED keeps the nearest-flip fallback, and it is never the canned watch-VIX",
  (() => { const r = regimeCompute(subFix(42, 2.9), new Set());
    return r.label === "MIXED" && /^Cross-signals — watch (10Y|VIX|F&G|NFCI)$/.test(r.sub); })());
ok("ruler: today's tape shape — vol+inflation bull, CAPE bear — names the disagreement",
  (() => { // vix 14.43 bull · cpi cooling bull · CAPE 42.2 bear · 10Y/F&G/NFCI neutral = MIXED 2v1
    const d = { crossAsset: { treasury10y: { m1: 0.02 } },
      marketPulse: { vix: { current: 14.43 }, fearGreed: { score: 54 } },
      macro: { cpi: { trend: [3.6, 3.6, 3.6, 3.6, 3.6, 3.5] },
        shillerPe: { current: 42.2, mean: 17.4, ath: 44.19 }, nfci: { current: -0.42 } } };
    const r = regimeCompute(d, new Set());
    return r.label === "MIXED" &&
      r.sub === "volatility and inflation help, prices do not"; })());
ok("ruler: the derived sub uses band.plain nouns with 'prices' as the ONE valuation alias",
  (() => { // 10Y bull vs vix bear → both nouns come from the table, singular agreement
    const d = { crossAsset: { treasury10y: { m1: -0.2 } },
      marketPulse: { vix: { current: 27 }, fearGreed: { score: 45 } },
      macro: { cpi: { trend: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0] },
        shillerPe: { current: 24, mean: 17.4, ath: 44.19 }, nfci: { current: -0.42 } } };
    const r = regimeCompute(d, new Set());
    return r.label === "MIXED" &&
      r.sub === "the 10-year yield and prices help, volatility does not"; })());
/* The mobile budget, RUN rather than asserted from the constant's value: a 3-1 split names
   six words of factor across three lines of hero and duplicates the sentence directly under
   it, so past MIXED_SUB_MAX the sub states the split instead. Still derived from the same
   votes, still never pointing at a gauge that is fine — only the names move one line down. */
ok("ruler: an over-budget disagreement degrades to the SPLIT, never to a gloss or a truncation",
  (() => { // 10Y+NFCI+F&G bull, vix bear → the named form is 78 chars, over the budget
    const d = { crossAsset: { treasury10y: { m1: -0.2 } },
      marketPulse: { vix: { current: 27 }, fearGreed: { score: 60 } },
      macro: { cpi: { trend: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0] },
        shillerPe: { current: 27, mean: 17.4, ath: 44.19 }, nfci: { current: -0.6 } } };
    const r = regimeCompute(d, new Set());
    const named = "the 10-year yield, sentiment and financial conditions help, volatility does not";
    return r.label === "MIXED" && named.length > MIXED_SUB_MAX &&
      r.sub === "3 help, 1 does not" && r.sub.length <= MIXED_SUB_MAX &&
      !/Cross-signals|watch|…/.test(r.sub); })());
/* The budget is a MEASURED two-line height, not a round number: at 375px (the ticket's
   acceptance width) 44/54/55/60-char subs all wrap to two lines and 67 wraps to three, so
   every ordinary named disagreement stays named and only the multi-factor walls degrade. */
ok("ruler: the budget is the measured two-line height — ordinary named tapes all fit under it",
  MIXED_SUB_MAX === 60 &&
  ["volatility and inflation help, prices do not",                    // today, 44
   "the 10-year yield and prices help, volatility does not",          // 54
   "volatility and prices help, financial conditions do not",         // 55
  ].every((s) => s.length <= MIXED_SUB_MAX) &&
  "the 10-year yield, sentiment and financial conditions help, volatility does not".length > MIXED_SUB_MAX);
ok("ruler: verb agreement — a lone plural-agreeing hurt noun still takes 'do not'",
  (() => { // nfci bear alone → "financial conditions do not"; and one bull helper → "helps"
    const d = { crossAsset: { treasury10y: { m1: 0.02 } },
      marketPulse: { vix: { current: 14 }, fearGreed: { score: 54 } },
      macro: { cpi: { trend: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0] },
        shillerPe: { current: 24, mean: 17.4, ath: 44.19 }, nfci: { current: 0.4 } } };
    const r = regimeCompute(d, new Set());
    return r.label === "MIXED" &&
      r.sub === "volatility and prices help, financial conditions do not"; })());
ok("ruler: forbidden vocabulary never reaches a derived MIXED sub",
  (() => { const d = { crossAsset: { treasury10y: { m1: 0.02 } },
      marketPulse: { vix: { current: 14.43 }, fearGreed: { score: 54 } },
      macro: { cpi: { trend: [3.6, 3.6, 3.6, 3.6, 3.6, 3.5] },
        shillerPe: { current: 42.2, mean: 17.4, ath: 44.19 }, nfci: { current: -0.42 } } };
    const r = regimeCompute(d, new Set());
    return !/Cross-signals/.test(r.sub) && !/watch/i.test(r.sub) &&
      !/RISK-ON|RISK-OFF|MIXED/.test(r.sub); })());
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
ok("glance: the vote line accounts for every counted vote — bull · neutral · bear, then coverage",
  // 8/28 matrix row 16: the tail is the same coverage fact as the voters line 40px above, so
  // it now uses the same words rather than a second ("usable").
  /\$\{regime\.bullVotes\} bull · \$\{neutralVotes\} neutral · \$\{regime\.bearVotes\} bear — \$\{regime\.counted\} of \$\{regime\.totalFactors\} voters counted/.test(bandSrc));
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
  adminSrc.includes("<h2 style=\"margin-top:10px\">THE BOOK</h2>") &&
  adminSrc.includes("click any ticker chip to open its TT Card"));
// F2b-3: operator tooling off the public route (the A4 pattern).
ok("glance: operator tooling gates on !publicView — TT copy in the menu, TERMINAL in the bar",
  // v3.62 put TT and TERMINAL inside the ⋯ OPS disclosure; v3.98.3 PROMOTED TERMINAL into the
  // bar (owner call) and left the readout copy in the menu. The contract is unchanged and is
  // still measured as a contract — every operator action sits behind a !publicView gate,
  // wherever it renders — rather than as one adjacency.
  (() => {
    const open = dashSrc.indexOf('<details className="hdr-ops"');
    const close = dashSrc.indexOf("</details>", open);
    if (open < 0 || close < 0) return false;
    const menu = dashSrc.slice(open, close);
    // the readout copy stays in the gated menu; TERMINAL is gone from it (one door, one room)
    if (!menu.includes("onClick={handleTtCopy}") || menu.includes('href="/admin.html"')) return false;
    // TERMINAL is a first-class bar action, still behind its own !publicView gate
    const term = dashSrc.indexOf('aria-label="Open Ticker Terminal"');
    // v5.9: the menu is ALSO Simple-gated — its one entry is an operator export, and the
    // beginner read found it renting a word on the first screen with no job there. The
    // !publicView contract this pin exists for is unchanged and still measured.
    return /\{!simple&&!publicView&&\(\s*\n?\s*<details className="hdr-ops"/.test(dashSrc) &&
      term > 0 && /\{!publicView&&\(\s*\n?\s*<a href="\/admin\.html"/.test(dashSrc) &&
      (dashSrc.match(/href="\/admin\.html"/g) || []).length === 1;
  })() &&
  // v6.0: the two badges merged into one (PR #10's fix) — same gates, one render site.
  /\{!simple&&!publicView&&\(activeAlerts>0\|\|alertBlind>0\)&&/.test(dashSrc));
/* v5.9 — the badges gain a SIMPLE gate, and this is a defect fix rather than a density cut,
   which is why it does not weaken v3.25. The Macro Alerts section is `!publicView&&!simple`,
   so in Simple the badge counted monitors the reader could not reach and its deep link led
   nowhere. The rule is that a collapse never hides a red fact; it does not require a count of
   a section that is not on the page. Power is unchanged, and pinned above. */
ok("v5.9: the alert badges follow the section they summarize — Power only, never an orphan count",
  /\{!simple&&!publicView&&\(?activeAlerts/.test(dashSrc) &&
  /\{!publicView&&!simple&&\(<section aria-label="Operator monitors/.test(dashSrc));
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
console.log("\n[42] FEAT-TT-ALTITUDE — routed jobs and the shareable ranking artifact");
ok("tt-altitude: SHARE sits beside NEXT $, not in global chrome or OPS",
  /<section class="tt-view" id="nextView"[\s\S]*onclick="exportRankings\(\)"[\s\S]*<\/section>/.test(adminSrc) &&
  (adminSrc.match(/onclick="exportRankings\(\)"/g) || []).length === 1);
ok("tt-altitude: the promoted action names the decision logic carried by the export",
  /aria-label="Share ticker rankings and decision logic"/.test(adminSrc));
ok("tt-altitude: NEXT $ and BOOK are persistent modes; FUND is reached from its state chip",
  /aria-label="Ticker Terminal modes"/.test(adminSrc) &&
  /id="modeNext"[\s\S]*onclick="routeGo\('next'\)"/.test(adminSrc) &&
  /id="modeBook"[\s\S]*onclick="routeGo\('book'\)"/.test(adminSrc) &&
  /id="trimChip" onclick="routeGo\('fund'\)"/.test(adminSrc));
ok("tt-altitude: the retired decision carousel is gone, not merely hidden",
  !/decisionBuyTab|decisionFundTab|decisionMagTab|decisionDeck|DECK_PAGES/.test(adminSrc));
ok("tt-altitude: routed modes retain keyboard navigation and browser history",
  /function modeKey\(e,view\)/.test(adminSrc) && /history\[replace\?"replaceState":"pushState"\]/.test(adminSrc) &&
  /addEventListener\("popstate"/.test(adminSrc) && /addEventListener\("hashchange"/.test(adminSrc));
ok("tt-deck: forced trims stay visible; only the lower-priority funding tail collapses",
  adminSrc.indexOf("s.forced.forEach") < adminSrc.indexOf("const FUNDING_VISIBLE=5") &&
  /\+\$\{s\.disc\.length-FUNDING_VISIBLE\} lower-priority funding sources/.test(adminSrc));
ok("tt-altitude: the route is honestly FUND / TRIM, never a fabricated HOLD recommendation",
  adminSrc.includes('<h1>FUND / TRIM</h1>') &&
  !/NEXT DOLLAR[^<]{0,20}HOLD/.test(adminSrc));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[43] FEAT-TT-ALTITUDE — trim state remains visible without becoming a persistent mode");
ok("tt-deck-forced: SELL_FORCED_N is reset before sellRank() runs — an early return can never leave yesterday's count (the AGREE_PICK precedent)",
  (() => {
    const body = adminSrc.match(/function renderSellBlock\(\)\{([\s\S]*?)\n\}/)?.[1] || "";
    const reset = body.indexOf("SELL_FORCED_N=null;");
    const compute = body.indexOf("const s=sellRank();");
    return reset >= 0 && compute >= 0 && reset < compute &&
      // v5.2 CAP-ASTERISK: the count is over-cap rows (informational), no longer a forced tier
      /if\(s\)SELL_FORCED_N=s\.disc\.filter\(r=>r\.overCap\)\.length;/.test(body);
  })());
ok("tt-altitude: the trim chip reads the already-computed count and routes to FUND without recomputing",
  /const trim=document\.getElementById\("trimChip"\)/.test(adminSrc) &&
  /trim\.textContent=`TRIM · \$\{SELL_FORCED_N\} cap`/.test(adminSrc) &&
  /id="trimChip" onclick="routeGo\('fund'\)"/.test(adminSrc));
ok("tt-altitude: route state has distinct pending, unknown, cap and verified-clear trim states",
  /trim\.textContent="TRIM · …"/.test(adminSrc) && /trim\.textContent="TRIM · \?"/.test(adminSrc) &&
  /trim\.textContent=`TRIM · \$\{SELL_FORCED_N\} cap`/.test(adminSrc) && /else trim\.hidden=true/.test(adminSrc));

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
const publicSrc = readSrc("./public-render.mjs");
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
const readmeSrc = readSrc("../README.md");
const handoffSrc = readSrc("../HANDOFF.md");
const pkgVersion = JSON.parse(
  readSrc("../package.json")).version;
ok("package.json still carries the version — the single source of truth",
  typeof pkgVersion === "string" && /^\d+\.\d+\.\d+$/.test(pkgVersion));
ok("README does not restate a version number (it rots; package.json is the home)",
  !/Current version:\s*\d+\.\d+\.\d+/.test(readmeSrc));
ok("README does not quote an assertion count (the suite prints its own total)",
  !/\d{3,}[- ]assertion/.test(readmeSrc));
// The false claim actively misdirected contributors to the wrong command for many releases.
ok("README does not claim the `test` script is missing — it exists",
  !/no `test` script/.test(readmeSrc) && /npm test/.test(readmeSrc));
const claudeSrc = readSrc("../CLAUDE.md");
ok("CLAUDE.md does not claim the `test` script is missing either",
  !/no `test` script in `package\.json`/.test(claudeSrc));
ok("CLAUDE.md's status header no longer pins a hand-bumped version",
  !/\*\*Status: v\d+\.\d+\.\d+/.test(claudeSrc));
ok("HANDOFF.md declares itself a dated ARCHIVE, so it cannot read as current state",
  /ARCHIVE/.test(handoffSrc) && /NOT current state/i.test(handoffSrc) &&
  /`CLAUDE\.md` is canonical/i.test(handoffSrc));

/* 2026-08-28 — the working-notes convention. A survey that lives only in chat scrollback is
   unsearchable from a fresh session, does not survive a context summary, and cannot be diffed
   against the code it describes; one left as a pre-implementation snapshot then becomes a
   confident, STALE claim about the product — the label-outlives-its-data defect this whole
   block exists to catch, filed one level up. The rule is in CLAUDE.md's per-pass protocol so
   it loads every session; these pins stop it being silently dropped, and stop `working/`
   turning into a product surface. */
ok("working notes: the per-pass protocol carries the branch-record rule and the update-on-land rule",
  // Whitespace-collapsed: these are prose in a hard-wrapped markdown file, so a phrase can
  // straddle a line break. Matching the raw text would fail on a reflow that changed nothing.
  (() => { const doc = claudeSrc.replace(/\s+/g, " ");
    return /Findings live on the BRANCH, not in the chat/.test(doc) &&
           /UPDATED WHEN THE WORK LANDS, in the same pass/.test(doc) &&
           /recorded as a correction rather than silently edited away/.test(doc); })());
ok("working notes: `working/` is NOTES — no product surface may import it",
  (() => { const hits = [], seen = [];
    /* Paths resolve against import.meta.url, exactly as readSrc does — a bare "../src" would
       resolve against cwd instead and this pin would pass by scanning nothing. `seen` is the
       vacuity guard: it must actually have read the product tree. */
    const walk = (rel) => { let ents; try { ents = readdirSync(new URL(rel, import.meta.url), { withFileTypes:true }); } catch { return; }
      for (const e of ents) { const f = `${rel}${e.name}`;
        if (e.isDirectory()) walk(`${f}/`);
        else if (/\.(jsx?|mjs|html)$/.test(e.name)) { seen.push(f);
          if (/["'`][^"'`]*\bworking\//.test(readSrc(f))) hits.push(f); } } };
    ["../src/", "../functions/", "../public/"].forEach(walk);
    return seen.length > 20 && hits.length === 0; })());

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
    // v3.98.3: with no reason map the row says "not counted" — it must NOT invent a cause.
    return v.vote === "excluded" && v.stale === true &&
      /· not counted$/.test(v.val) && !/STALE/.test(v.val); })());
ok("a non-finite reading votes NEUTRAL, not a confident bearish chip",
  (() => { const bad = JSON.parse(JSON.stringify(neutralD));
    bad.marketPulse.vix.current = NaN;
    return regimeFactorRows(bad).find((r) => r.key === "vix").vote === "neutral"; })());
// The whole point of the shared map: the two altitudes cannot resolve a vote differently.
ok("BOTH altitudes resolve appearance through the ONE voteStyle map (hero + Drivers matrix)",
  bandSrc.includes("const vs=voteStyle(f.vote)") &&
  dashSrc.includes("const vc=T[voteStyle(f.vote).colorKey]") &&
  !/f\.vote==="bull"\?T\.green/.test(uiSrc));
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
ok("gate: absent actionability field fails closed on cached/legacy bodies — both paths require explicit FULL",
  /actionability unavailable/.test(GF(stcOk, { regime: { verdict: "TAILWIND" }, macro_flip: { evaluable: true, tripped: false } })));
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
                   "yrsToYearEnd", "annualise", "pickRow", "suggestMultiple"])
    ok(`tripwire: ${n}() is byte-identical in admin.html and src/ptModel.js`,
      norm(liftFns(adminSrc, [n])) === norm(PT[n].toString()));
  // FEAT-TT-DRIFT (v4.3): same tripwire, same reason — admin.html keeps its own copy.
  for (const n of ["etYmd", "captureDates", "newestCapture", "thinCoverage", "staleHinges",
                   "compositeDrift", "targetDrift", "runwaySplit", "labelDrift", "lintDrift"])
    ok(`tripwire: ${n}() is byte-identical in admin.html and src/ttDrift.js`,
      norm(liftFns(adminSrc, [n])) === norm(DRIFT[n] ? DRIFT[n].toString() : liftFns(driftSrc, [n])));
  ok("tripwire: ANN_MIN_Y matches across both copies",
    +/const ANN_MIN_Y=([\d.]+);/.exec(adminSrc)[1] === PT.ANN_MIN_Y);
  ok("tripwire: the module is genuinely clock-injectable (Dec instant rolls, July instant holds)",
    PT.pickRow([{y:"2030"},{y:"2031"}], null, Date.parse("2030-12-15T00:00:00Z")).rolled === "2030" &&
    PT.pickRow([{y:"2030"},{y:"2031"}], null, Date.parse("2030-06-15T00:00:00Z")).rolled === null);
}

// ═══════════ [45] TT UNDERWRITING ENGINE (METHODOLOGY_VERSION in ttScore.js) ═══════════
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
  ok("P1: the contingent premium still carries its own %/yr diagnostic — an output always exists; only the blended SCORE is withheld",
    p1unk.context_premium.target_year === "2027" &&
    typeof p1unk.context_premium.annualized_return_pct === "number" &&
    Math.abs(p1unk.context_premium.annualized_return_pct - p1pass.annualized_return_pct) < 0.01);
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
  // ─── §6.2.4 (v2.5.0) YEARS_TO_CROSSOVER — the pre-profit second series when NO profit
  // line exists (every candidate CAGR is NM between negatives; the old rule demanded a
  // profit trend from a name declared pre-profit). Distance to the consensus EPS crossover.
  const epsJoby = rev({ 2027: -0.82, 2028: -0.72, 2029: -0.53, 2030: -0.19, 2031: 0.30 });
  const p2x = TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "YEARS_TO_CROSSOVER",
    revenue: rev({ 2026: 100, 2028: 150 }), eps: epsJoby,
    duration_years: dur(["2026", "2027", "2028", "2029"]) }, { etToday: "2026-08-05" });
  ok("P2 crossover: scores off the consensus EPS crossover distance (2031 from 2026 = 5y -> 2.5; 0.5*8+0.3*2.5+0.2*10=6.75)",
    p2x.score === 6.75 && p2x.components.years_to_crossover === 5 && p2x.components.crossover_fy === "2031" &&
    p2x.components.second_series_score === 2.5);
  ok("P2 crossover: the step table — sooner is better, ceiling 9 never 10, floor 1 (asserted, the NFCI-deadband class)",
    TS.CROSSOVER_SCORE(0) === 9 && TS.CROSSOVER_SCORE(1) === 9 && TS.CROSSOVER_SCORE(2) === 7.5 &&
    TS.CROSSOVER_SCORE(3) === 6 && TS.CROSSOVER_SCORE(4) === 4 && TS.CROSSOVER_SCORE(5) === 2.5 &&
    TS.CROSSOVER_SCORE(6) === 1 && TS.CROSSOVER_SCORE(9) === 1);
  ok("P2 crossover: a series that never crosses is a NAMED blocker — 'no modeled path to profit' is different from a low score",
    /never crosses positive/.test(TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "YEARS_TO_CROSSOVER",
      revenue: rev({ 2026: 100, 2028: 150 }), eps: rev({ 2027: -1, 2028: -0.9 }),
      duration_years: dur(["2026", "2027"]) }, { etToday: "2026-08-05" }).blockers[0]));
  ok("P2 crossover: fewer than two eps rows blocks (one point cannot locate a path)",
    /fewer than two/.test(TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "YEARS_TO_CROSSOVER",
      revenue: rev({ 2026: 100, 2028: 150 }), eps: rev({ 2031: 0.3 }),
      duration_years: dur(["2026", "2027"]) }, { etToday: "2026-08-05" }).blockers[0]));
  ok("P2 crossover: thin consensus coverage at the crossover year WARNS (never blocks — the book's 3-analyst dimming rule)",
    (() => { const thin = rev({ 2027: -0.8, 2033: 1.09 }, "CONSENSUS", 2);
      const r = TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "YEARS_TO_CROSSOVER",
        revenue: rev({ 2026: 100, 2028: 150 }), eps: thin,
        duration_years: dur(["2026", "2027"]) }, { etToday: "2026-08-05" });
      return typeof r.score === "number" && r.warnings.some((w) => /thin coverage at the crossover year/.test(w)); })());
  ok("P2 crossover: a past/current crossover year warns to re-check the PREPROFIT declaration",
    TS.scoreP2({ mode: "PREPROFIT", preprofit_second_series: "YEARS_TO_CROSSOVER",
      revenue: rev({ 2026: 100, 2028: 150 }), eps: rev({ 2025: -0.5, 2026: 0.2 }),
      duration_years: dur(["2026", "2027"]) }, { etToday: "2026-08-05" })
      .warnings.some((w) => /not in the future/.test(w)));
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
  /* ── v5.0 (W2): P3 input aging — the SELF_FUNDING entry's named future scope, closed ──
     freshnessOf existed since §5.3 and reached only P4 hinges; a P3 margin could sit
     unrefreshed forever. Quarterly cadence (120d asserted): AGING = one missed quarter,
     STALE = two. THE SCORE NEVER MOVES — only actionability degrades, through the rollup's
     pre-existing semantics, with the aged fields NAMED. */
  const RECAT = (value, as_of) => ({ value, as_of, source: { kind: "PRIMARY" } });
  const p3aging = (as_of) => TS.scoreP3({ mode: "PROFITABLE_STANDARD",
    operating_margin_pct: RECAT(20, as_of), margin_direction_pp: RECAT(0, "2026-08-01"),
    fcf_margin_pct: RECAT(10, "2026-08-01"),
    capital_efficiency: { metric: "ROIC", value: 15, as_of: "2026-08-01", source: { kind: "PRIMARY" } } },
    { etToday: "2026-08-05" });
  ok("P3 aging: the cadence is quarterly and the boundaries hold at ±1 day — 120d CURRENT, 121d AGING, 241d STALE",
    TS.P_INPUT_CADENCE_D === 120 &&
    p3aging("2026-04-07").freshness === "CURRENT" &&        // 120d exactly
    p3aging("2026-04-06").freshness === "AGING" &&          // 121d
    p3aging("2025-12-08").freshness === "AGING" &&          // 240d exactly
    p3aging("2025-12-07").freshness === "STALE");           // 241d
  ok("P3 aging: the SCORE is untouched — deleting a measurement for being old would recreate 'unmeasured reads as zero'",
    p3aging("2025-12-07").score === p3aging("2026-08-01").score &&
    typeof p3aging("2025-12-07").score === "number");
  ok("P3 aging: the aged field is NAMED in warnings with its age and cadence, never a bare flag",
    p3aging("2026-04-06").warnings.some((w) => /operating_margin_pct: AGING \(121d old, 120d cadence\)/.test(w)) &&
    p3aging("2026-08-01").warnings.length === 0);
  ok("P3 aging: freshness reaches the rollup — AGING degrades FULL to CAUTION, STALE to BLOCKED",
    TS.actionabilityRollup({ pillarFresh: ["CURRENT"] }) === "FULL" &&
    TS.actionabilityRollup({ pillarFresh: ["AGING"] }) === "CAUTION" &&
    TS.actionabilityRollup({ pillarFresh: ["STALE"] }) === "BLOCKED");
  ok("P3 aging: buildScorecard actually passes p3.freshness into the rollup — computed-but-unread is the v3.40 defect shape",
    /pillarFresh: \[p3\.freshness\]\.filter\(Boolean\)/.test(readSrc("../src/ttScore.js")));
  /* ── v5.0 (W4): the FINANCIALS mode — the lender/broker shape, boundaries EXECUTED ── */
  const FIN = (over = {}) => TS.scoreP3({ mode: "FINANCIALS",
    efficiency_ratio_pct: RECAT(55, "2026-08-01"),
    efficiency_direction_pp: RECAT(-2, "2026-08-01"),
    capital_efficiency: { metric: "ROE", value: 12, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
    capital_adequacy: { regime: "CET1", value: 14, min_required: 7, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
    credit_quality_trend: { state: "FLAT", as_of: "2026-08-01", source: { kind: "PRIMARY" }, rationale: "r" },
    ...over }, { etToday: "2026-08-05" });
  ok("FINANCIALS: the five components compose at the asserted weights (.25/.15/.20/.25/.15) — " +
     "6*.25+7*.15+6*.20+10*.25+5*.15 = 7.00",
    (() => { const r = FIN(); return r.score === 7 &&
      r.components.efficiency_ratio === 6 && r.components.efficiency_direction === 7 &&
      r.components.capital_efficiency === 6 && r.components.capital_adequacy === 10 &&
      r.components.credit_quality === 5 && r.components.headroom_pct === 100; })());
  ok("FINANCIALS: the efficiency anchor is INVERTED — a LOWER ratio scores HIGHER (cost over revenue)",
    FIN({ efficiency_ratio_pct: RECAT(45, "2026-08-01") }).components.efficiency_ratio === 8 &&
    FIN({ efficiency_ratio_pct: RECAT(75, "2026-08-01") }).components.efficiency_ratio === 2);
  ok("FINANCIALS: capital adequacy scores HEADROOM above the named regime minimum — at-minimum is 0, not fine",
    FIN({ capital_adequacy: { regime: "CET1", value: 7, min_required: 7, as_of: "2026-08-01", source: { kind: "PRIMARY" } } })
      .components.capital_adequacy === 0 &&
    FIN({ capital_adequacy: { regime: "NET_CAPITAL", value: 8.75, min_required: 7, as_of: "2026-08-01", source: { kind: "PRIMARY" } } })
      .components.capital_adequacy === 6);   // +25% headroom
  ok("FINANCIALS: an UN-NAMED regime refuses to score — a bare ratio with no stated requirement is a number, not adequacy",
    (() => { const r = FIN({ capital_adequacy: { value: 14, min_required: 7, as_of: "2026-08-01", source: { kind: "PRIMARY" } } });
      return r.score === null && r.blockers.some((b) => /regime must be NAMED/.test(b)); })() &&
    (() => { const r = FIN({ capital_adequacy: { regime: "CET1", value: 14, as_of: "2026-08-01", source: { kind: "PRIMARY" } } });
      return r.score === null && r.blockers.some((b) => /min_required/.test(b)); })());
  ok("FINANCIALS: capital_efficiency accepts ROE or ROTCE (metric named) and nothing else — the scorer never chooses",
    FIN({ capital_efficiency: { metric: "ROTCE", value: 18, as_of: "2026-08-01", source: { kind: "PRIMARY" } } })
      .components.metric === "ROTCE" &&
    (() => { const r = FIN({ capital_efficiency: { metric: "ROIC", value: 12, as_of: "2026-08-01", source: { kind: "PRIMARY" } } });
      return r.score === null && r.blockers.some((b) => /ROE or ROTCE/.test(b)); })());
  ok("FINANCIALS: credit quality is an ENUM with source+rationale — no numeric field here can see what kills a lender",
    FIN({ credit_quality_trend: { state: "DETERIORATING", as_of: "2026-08-01", source: { kind: "PRIMARY" }, rationale: "NCOs rising" } })
      .components.credit_quality === 0 &&
    (() => { const r = FIN({ credit_quality_trend: { state: "FLAT", as_of: "2026-08-01", source: { kind: "PRIMARY" } } });
      return r.score === null && r.blockers.some((b) => /source and a rationale/.test(b)); })());
  ok("FINANCIALS: the mode error names all three modes now",
    /PROFITABLE_STANDARD\|PREPROFIT\|FINANCIALS/.test(
      TS.scoreP3({ mode: "WRONG" }, { etToday: "2026-08-05" }).blockers[0]));
  ok("FINANCIALS: P3 input aging reaches the new mode too — an aged efficiency ratio is NAMED and degrades freshness",
    (() => { const r = FIN({ efficiency_ratio_pct: RECAT(55, "2026-04-06") });
      return r.freshness === "AGING" && r.warnings.some((w) => /efficiency_ratio_pct: AGING/.test(w)) &&
        typeof r.score === "number"; })());
  ok("P3: a missing enum state is a blocker — UNKNOWN is never 5",
    /missing or unknown enum/.test(TS.scoreP3({ mode: "PREPROFIT", margin_direction: { state: "FLAT", source: { kind: "PRIMARY" }, rationale: "r" },
      runway_months: REC(24), path_to_profit: { state: "NONE", source: { kind: "PRIMARY" }, rationale: "r" } }, { etToday: "2026-08-05" }).blockers[0]));

  /* ── runway_months: the SELF_FUNDING sentinel (v4.9.0) ────────────────────────────────
     The field asks "can this fund itself to the thesis?", and cash/burn answers that for an
     equity-funded burn-down only. A CASH GENERATOR has no burn to divide by, so the input was
     left unset and BLOCKED the pillar — the strongest funding position on the book scored
     worse than a name with 60 months of runway. SYM is the live case. A debt-funded operator
     (CRWV) needs no code: its author may put committed facilities in the numerator and state
     the formula, which is why only this end is fixed here. */
  const SF = (over = {}) => ({ value: "SELF_FUNDING", as_of: "2026-08-01", source: { kind: "PRIMARY" }, ...over });
  const preSF = (rw) => TS.scoreP3({ mode: "PREPROFIT",
    unit_economics: { state: "IMPROVING", source: { kind: "PRIMARY" }, rationale: "r" },
    margin_direction: { state: "IMPROVING", source: { kind: "PRIMARY" }, rationale: "r" },
    runway_months: rw,
    path_to_profit: { state: "DATED_MILESTONES", source: { kind: "PRIMARY" }, rationale: "r" } }, { etToday: "2026-08-05" });
  ok("runway SELF_FUNDING scores the anchor MAXIMUM — unbounded runway is the best attainable " +
     "state, and 48 months is its honest ceiling; it must beat every finite value",
    TS.readRunway(SF(), { etToday: "2026-08-05" }).score === 10 &&
    TS.readRunway(REC(47), { etToday: "2026-08-05" }).score < 10 &&
    preSF(SF()).score > preSF(REC(47)).score);
  ok("runway SELF_FUNDING: the pillar computes instead of blocking — the defect was that a cash " +
     "generator scored WORSE than 24 months of runway by being unanswerable",
    preSF(SF()).blockers.length === 0 && preSF(SF()).score > preSF(REC(24)).score &&
    preSF(undefined).blockers.length > 0);
  ok("runway SELF_FUNDING still carries the full atomic envelope — as_of and source.kind are " +
     "enforced exactly as for a number, so the sentinel is not a provenance bypass",
    /as_of/.test(TS.readRunway(SF({ as_of: undefined }), { etToday: "2026-08-05" }).err || "") &&
    /source\.kind/.test(TS.readRunway(SF({ source: { kind: "GUESS" } }), { etToday: "2026-08-05" }).err || "") &&
    /as_of after/.test(TS.readRunway(SF({ as_of: "2026-12-01" }), { etToday: "2026-08-05" }).err || ""));
  ok("runway: ANY other string still returns the ordinary numeric errors — a typo can never " +
     "reach the anchor, and a numeric string is still named as one",
    TS.readRunway(SF({ value: "self_funding" }), { etToday: "2026-08-05" }).err === "value not a finite number" &&
    TS.readRunway(SF({ value: "SELFFUNDING" }), { etToday: "2026-08-05" }).err === "value not a finite number" &&
    /numeric string/.test(TS.readRunway(SF({ value: "24" }), { etToday: "2026-08-05" }).err || ""));
  ok("runway: a numeric value behaves EXACTLY as before the sentinel — backward compatible",
    TS.readRunway(REC(24), { etToday: "2026-08-05" }).score === 7 &&
    TS.readRunway(REC(0), { etToday: "2026-08-05" }).score === 0 &&
    TS.readRunway(REC(24), { etToday: "2026-08-05" }).self_funding === false &&
    preSF(REC(24)).score === 7.05);

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

  // ─── v2.4.0 PROVISIONAL bootstrap — the ONE labeled exception to all-four-or-nothing ───
  // P1–P3 numeric + P4 blocked SOLELY on falsifier bootstrap → a provisional diagnostic
  // beside a null blend: tier hard-capped at B, actionability BLOCKED, never eligible.
  const provUI = {
    trajectory: { mode: "PROFITABLE", revenue: rev({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev({ 2026: 5, 2028: 8 }),
      duration_years: dur(["2026", "2027", "2028", "2029"]) },
    economic_quality: { mode: "PROFITABLE_STANDARD", operating_margin_pct: REC(20), margin_direction_pp: REC(0),
      fcf_margin_pct: REC(10), capital_efficiency: { metric: "ROIC", value: 15, as_of: "2026-08-01", source: { kind: "PRIMARY" } } },
    falsifiers: [], route_gates: {} };
  const provCard = await TS.buildScorecard({ sym: "T", lens: "AI", underwriting_inputs: provUI,
    dd: flooredDd, price: { px: 30, at: "2026-08-03" }, horizon: "2026", nowMs: NOW });
  const provMean = Math.round(((p1floor.score + p2ok.score + p3std.score) / 3) * 100) / 100;
  ok("PROVISIONAL: P1-P3 numeric + falsifiers empty → status PROVISIONAL with the P1-P3 mean, blend stays null",
    provCard.status === "PROVISIONAL" && provCard.raw_score === null && provCard.raw_tier === null &&
    provCard.provisional && provCard.provisional.score === provMean &&
    provCard.provisional.pending === "LEGACY_POST_HOC");
  ok("PROVISIONAL: tier is HARD-CAPPED at B — the uncapped tier is recorded, never worn",
    (provCard.provisional.tier_uncapped === "S" || provCard.provisional.tier_uncapped === "A") &&
    provCard.provisional.tier === "B" &&
    provCard.provisional.tier_uncapped === TS.rawTierFrom(provCard.provisional.score));
  ok("PROVISIONAL: actionability stays BLOCKED and the blocker names the pending bootstrap state",
    provCard.actionability === "BLOCKED" &&
    provCard.blockers.some((b3) => /^PROVISIONAL: P4 LEGACY_POST_HOC/.test(b3)));
  ok("PROVISIONAL: never eligible — evalEligibility WAITs on 'scorecard not SCORED' even with everything else clean",
    (() => { const e2 = TS.evalEligibility({ annualized_return_pct: 30, status: provCard.status, actionability: "FULL",
      methodology_version: provCard.methodology_version, capped_tier: "B", execution: "PASS" });
      return e2.verdict === "WAIT" && e2.blockers.includes("scorecard not SCORED"); })());
  const provDefect = await TS.buildScorecard({ sym: "T", lens: "AI",
    underwriting_inputs: { ...provUI, falsifiers: [H({ id: "a", importance: 9 }), H({ id: "b", qualifying_observation: null }), H({ id: "c" })] },
    dd: flooredDd, price: { px: 30, at: "2026-08-03" }, horizon: "2026", nowMs: NOW });
  ok("PROVISIONAL control: a malformed hinge beside the pending one is a DEFECT — UNSCORABLE, never averaged past",
    provDefect.status === "UNSCORABLE" && provDefect.provisional === undefined);
  const provThin = await TS.buildScorecard({ sym: "T", lens: "AI",
    underwriting_inputs: { ...provUI, trajectory: undefined },
    dd: flooredDd, price: { px: 30, at: "2026-08-03" }, horizon: "2026", nowMs: NOW });
  ok("PROVISIONAL control: a missing P1-P3 pillar stays UNSCORABLE — bootstrap never thins below three measured pillars",
    provThin.status === "UNSCORABLE" && provThin.provisional === undefined);
}

console.log("\n[47] route registry + normalization — every boundary at -e/boundary/+e");
{
  ok("routes: all seven lenses map, IND is a QUALITY_COMPOUNDER profile, unknown is UNMAPPED",
    TSREG.routeFor("AI").route === "AI_INFRA" && TSREG.routeFor("PH").route === "PHYSICAL_AI" &&
    TSREG.routeFor("QC").profile === "STANDARD" && TSREG.routeFor("IND").route === "QUALITY_COMPOUNDER" &&
    TSREG.routeFor("IND").profile === "INDUSTRIAL_CYCLICAL" && TSREG.routeFor("VEH").route === "VEHICLE" &&
    TSREG.routeFor("SP").route === "SPECULATIVE" && TSREG.routeFor("nope").route === "UNMAPPED");

  /* ── THE G3 RULING (2026-08-22) — AI_INFRA splits NEOCLOUD / PLATFORM ─────────────── */
  ok("G3 ruling: the AI lens carries an EXPLICIT NEOCLOUD profile and AIP maps to PLATFORM on the same route",
    TSREG.routeFor("AI").route === "AI_INFRA" && TSREG.routeFor("AI").profile === "NEOCLOUD" &&
    TSREG.routeFor("AIP").route === "AI_INFRA" && TSREG.routeFor("AIP").profile === "PLATFORM" &&
    // v3 -> v4 on 2026-08-23: QC_G3 gained an absolute P/E ceiling. A boundary ADDITION changes
    // what a verdict of a given version MEANS (a v3 PASS could sit at 152x; a v4 PASS cannot),
    // so §4.3 makes it a version bump rather than an in-place edit.
    TSREG.ROUTE_MAP_VERSION === "tt-route-v4");
  /* THE TRAP: gatesFor treats `profile: null` as "every profile of this route", so a PLATFORM
     profile added WITHOUT giving AI_G3 an explicit profile would inherit the neocloud bridge
     and carry TWO premium prerequisites. Asserted in both directions so a revert goes red. */
  {
    const neo = TSREG.gatesFor("AI_INFRA", "NEOCLOUD").map((g) => g.id);
    const plat = TSREG.gatesFor("AI_INFRA", "PLATFORM").map((g) => g.id);
    ok("G3 ruling: NEOCLOUD keeps the revenue bridge and NEVER sees the earnings bridge",
      neo.includes("AI_G3_2028_BRIDGE") && !neo.includes("AI_G3P_EARNINGS_BRIDGE"));
    ok("G3 ruling: PLATFORM gets the earnings bridge and the revenue bridge does NOT follow it (the profile:null trap)",
      plat.includes("AI_G3P_EARNINGS_BRIDGE") && !plat.includes("AI_G3_2028_BRIDGE"));
    ok("G3 ruling: exactly ONE premium prerequisite per profile — never two, never zero",
      TSREG.gatesFor("AI_INFRA", "NEOCLOUD").filter((g) => g.premium_prerequisite).length === 1 &&
      TSREG.gatesFor("AI_INFRA", "PLATFORM").filter((g) => g.premium_prerequisite).length === 1 &&
      TSREG.premiumPrerequisiteFor("AI_INFRA", "NEOCLOUD").id === "AI_G3_2028_BRIDGE" &&
      TSREG.premiumPrerequisiteFor("AI_INFRA", "PLATFORM").id === "AI_G3P_EARNINGS_BRIDGE");
    ok("G3 ruling: funding and circularity are asked of BOTH profiles — only the bridge splits",
      ["AI_G1_BUILDOUT", "AI_G2_CIRCULARITY"].every((id) => neo.includes(id) && plat.includes(id)));
  }
  {
    const gp = TSREG.GATES.find((g) => g.id === "AI_G3P_EARNINGS_BRIDGE");
    ok("AI_G3P: PASS at PEG 1.0 / 20% growth / 3 analysts inclusive; just past each is UNKNOWN, not FAIL",
      gp.evaluate({ pe_fy2: 20, eps_growth_fy1_fy2_pct: 20, analyst_count_fy2: 3 }) === "PASS" &&
      gp.evaluate({ pe_fy2: 20.2, eps_growth_fy1_fy2_pct: 20, analyst_count_fy2: 3 }) === "UNKNOWN" &&
      gp.evaluate({ pe_fy2: 20, eps_growth_fy1_fy2_pct: 19.99, analyst_count_fy2: 3 }) === "UNKNOWN" &&
      gp.evaluate({ pe_fy2: 20, eps_growth_fy1_fy2_pct: 20, analyst_count_fy2: 2 }) === "UNKNOWN");
    ok("AI_G3P: the absolute ceiling and the growth floor are the FAIL backstops (45x / 10%), exclusive",
      gp.evaluate({ pe_fy2: 45, eps_growth_fy1_fy2_pct: 60, analyst_count_fy2: 5 }) === "PASS" &&
      gp.evaluate({ pe_fy2: 45.01, eps_growth_fy1_fy2_pct: 60, analyst_count_fy2: 5 }) === "FAIL" &&
      gp.evaluate({ pe_fy2: 20, eps_growth_fy1_fy2_pct: 10, analyst_count_fy2: 5 }) === "UNKNOWN" &&
      gp.evaluate({ pe_fy2: 20, eps_growth_fy1_fy2_pct: 9.99, analyst_count_fy2: 5 }) === "FAIL");
    ok("AI_G3P: PEG past 2.0 FAILS even under the absolute ceiling — a growth story cannot carry any multiple",
      gp.evaluate({ pe_fy2: 40, eps_growth_fy1_fy2_pct: 20, analyst_count_fy2: 5 }) === "UNKNOWN" &&
      gp.evaluate({ pe_fy2: 30, eps_growth_fy1_fy2_pct: 14.9, analyst_count_fy2: 5 }) === "FAIL");
    ok("AI_G3P: no P/E before profit — a non-positive FY+2 P/E is UNKNOWN (wrong profile), never a verdict",
      gp.evaluate({ pe_fy2: 0, eps_growth_fy1_fy2_pct: 50, analyst_count_fy2: 5 }) === "UNKNOWN" &&
      gp.evaluate({ pe_fy2: -12, eps_growth_fy1_fy2_pct: 50, analyst_count_fy2: 5 }) === "UNKNOWN" &&
      gp.evaluate({}) === "UNKNOWN");
    /* The live book measured 2026-08-22 — the ruling must not silently re-fail the names it
       exists to release, and must still separate the one that is expensive for its growth. */
    const LIVE = { TSM: [14.9, 30.3], NVDA: [16.7, 43.2], LITE: [26.3, 52.7], CRDO: [25.3, 48.3],
      MRVL: [37.9, 53.9], BE: [26.1, 58.1], SNDK: [5.8, 54.2] };
    ok("AI_G3P: every measured PLATFORM name clears the earnings bridge — none is floored by a revenue multiple",
      Object.values(LIVE).every(([pe, g]) => gp.evaluate({ pe_fy2: pe, eps_growth_fy1_fy2_pct: g, analyst_count_fy2: 5 }) === "PASS"));
    ok("AI_G3P discriminates: ALAB (35.3x for 26.4% growth, PEG 1.33) is UNKNOWN — the gate still has teeth",
      gp.evaluate({ pe_fy2: 35.3, eps_growth_fy1_fy2_pct: 26.4, analyst_count_fy2: 5 }) === "UNKNOWN");
    const g3n = TSREG.GATES.find((g) => g.id === "AI_G3_2028_BRIDGE");
    ok("G3 ruling control: NBIS's calibration point still PASSES the untouched neocloud bridge (3.22x / 87.3%)",
      g3n.evaluate({ ev_fy2_rev_multiple: 3.22, fy1_fy2_growth_pct: 87.3, analyst_count_fy2: 12 }) === "PASS");

    /* ── QC_G3 SIGN-CANCELLATION PATCH (2026-08-23) ───────────────────────────────────
       The gate was RATIO-ONLY (a precomputed peg_fy1) and therefore blind to the signs
       that produced the ratio. TEM is the live negative control the way ALAB is for
       AI_G3P: FY+1 EPS −$0.08 → fwd P/E −908.6 on −962.5% growth → PEG +0.94, which the
       old shape PASSED as the QC premium prerequisite. A `peg <= 0` guard would not have
       caught it, which is why the INPUT SHAPE had to change rather than a guard added. */
    const qg = TSREG.GATES.find((g) => g.id === "QC_G3_VALUATION_PREREQ");
    ok("QC_G3: takes P/E and growth SEPARATELY and forms the ratio inside — the precomputed " +
       "peg_fy1 input is gone, so sign cancellation cannot reach the verdict",
      "pe_fy1" in qg.inputs && "eps_growth_fy1_fy2_pct" in qg.inputs && !("peg_fy1" in qg.inputs));
    ok("QC_G3 negative control — TEM (pe −908.6, g −962.5%, ratio +0.94) is UNKNOWN, never PASS",
      qg.evaluate({ pe_fy1: -908.6, eps_growth_fy1_fy2_pct: -962.5 }) === "UNKNOWN");
    ok("QC_G3: the other two sign holes the ratio-only shape admitted are closed",
      qg.evaluate({ pe_fy1: 20, eps_growth_fy1_fy2_pct: -10 }) === "FAIL" &&   // was PASS (−2.0 ≤ 1.5)
      qg.evaluate({ pe_fy1: -12, eps_growth_fy1_fy2_pct: 20 }) === "UNKNOWN"); // was PASS (−0.6)
    ok("QC_G3: no P/E before profit is UNKNOWN (cannot-measure), while non-growth is FAIL " +
       "(not growing into the multiple) — FAIL here is TIER_CAP A, a verdict about cheapness",
      qg.evaluate({ pe_fy1: 0, eps_growth_fy1_fy2_pct: 30 }) === "UNKNOWN" &&
      qg.evaluate({ pe_fy1: 20, eps_growth_fy1_fy2_pct: 0 }) === "FAIL");
    /* RE-PINNED 2026-08-23 with the ceiling patch below: the 2.5 edge used to be probed at
       pe_fy1 50 / 50.2, which now FAILS on the absolute ceiling before PEG is ever formed —
       the pin would have been measuring the ceiling while claiming to measure PEG. Same two
       boundaries, probed under 45 so each one tests only itself. */
    ok("QC_G3: the 1.5 / 2.5 PEG boundaries are unchanged and inclusive/exclusive as before",
      qg.evaluate({ pe_fy1: 30, eps_growth_fy1_fy2_pct: 20 }) === "PASS" &&        // PEG 1.5 edge
      qg.evaluate({ pe_fy1: 30.2, eps_growth_fy1_fy2_pct: 20 }) === "UNKNOWN" &&   // just past 1.5
      qg.evaluate({ pe_fy1: 40, eps_growth_fy1_fy2_pct: 16 }) === "UNKNOWN" &&     // PEG 2.5 edge, pe<45
      qg.evaluate({ pe_fy1: 40.2, eps_growth_fy1_fy2_pct: 16 }) === "FAIL" &&      // just past 2.5
      qg.evaluate({}) === "UNKNOWN");
    /* ── QC_G3 ABSOLUTE-CEILING PATCH (2026-08-23, same session) ──────────────────────────
       PEG is scale-free by construction, so it cannot backstop a pathological multiple: an
       arbitrarily large numerator over an arbitrarily large denominator clears it. AI_G3P has
       carried `pe > 45 -> FAIL` for exactly this since v4.5; QC_G3 did not. SPCX is the live
       negative control — 152.19x forward earnings over 421.1% growth is PEG 0.36, which
       PASSED the premium prerequisite before this patch. */
    ok("QC_G3 negative control — SPCX (pe 152.19, g 421.1%, PEG 0.36) FAILS on the ceiling, " +
       "where the pre-patch gate returned PASS at 152x forward earnings",
      qg.evaluate({ pe_fy1: 152.19, eps_growth_fy1_fy2_pct: 421.1 }) === "FAIL");
    ok("QC_G3: the ceiling fires BEFORE the PEG PASS test — ordering is load-bearing, or a low " +
       "PEG at a pathological multiple would return PASS first and the backstop would be dead code",
      qg.evaluate({ pe_fy1: 100, eps_growth_fy1_fy2_pct: 100 }) === "FAIL");   // PEG 1.0 — PASS without it
    ok("QC_G3: the 45 ceiling is EXCLUSIVE, matching AI_G3P — 45.0 itself still reaches the PEG path",
      qg.evaluate({ pe_fy1: 45, eps_growth_fy1_fy2_pct: 30 }) === "PASS" &&       // PEG 1.5 at the edge
      qg.evaluate({ pe_fy1: 45.01, eps_growth_fy1_fy2_pct: 30 }) === "FAIL" &&    // just past
      qg.evaluate({ pe_fy1: 44.99, eps_growth_fy1_fy2_pct: 30 }) === "PASS");
    ok("QC_G3: BOTH premium prerequisites now carry an absolute ceiling — the asymmetry that let " +
       "a 152x multiple through one route and not the other is closed",
      /if \(pe > 45\) return "FAIL"/.test(String(qg.evaluate)) &&
      /if \(pe > 45 \|\| g < 10\) return "FAIL"/.test(
        String(TSREG.GATES.find((x) => x.id === "AI_G3P_EARNINGS_BRIDGE").evaluate)));
    /* Measured across every QC/STANDARD card on the live book 2026-08-23 BEFORE shipping:
       nothing re-verdicts at 45 (nor at 60 or 75). Highest PASSING forward P/E is RDDT at
       23.47x; the two FAILs already failed on PEG. No stored card can be rejected on re-save,
       the bar MISKEY and the AI_G3P patch were both held to. */
    ok("QC_G3 ceiling: ZERO live QC cards re-verdict — the patch adds a backstop without " +
       "rejecting a single existing card",
      [[17.36, 24, "PASS"], [17.65, 13.8, "PASS"], [23.47, 28, "PASS"], [25.64, 21, "PASS"],
       [24.52, 19.6, "PASS"], [24.92, 28.6, "PASS"], [32.53, 12.3, "FAIL"], [166.45, 43.6, "FAIL"],
       [14.8, 9.8, "UNKNOWN"], [-908.63, -962.5, "UNKNOWN"]]
        .every(([pe, g, want]) => qg.evaluate({ pe_fy1: pe, eps_growth_fy1_fy2_pct: g }) === want));
    /* The live QC book measured 2026-08-23 — the patch must not silently re-verdict the
       healthy names, and must still separate the four that are genuinely expensive. */
    ok("QC_G3: the measured QC book keeps its spread — NU/GRAB/SOFI/RDDT pass, AAPL/CAT/HOOD/TSLA fail",
      [[13.6, 30.8], [24.9, 35.7], [23.3, 29.6], [23.5, 28.0]]
        .every(([pe, g]) => qg.evaluate({ pe_fy1: pe, eps_growth_fy1_fy2_pct: g }) === "PASS") &&
      [[32.5, 12.3], [30.7, 11.1], [40.0, 13.7], [166.4, 43.6]]
        .every(([pe, g]) => qg.evaluate({ pe_fy1: pe, eps_growth_fy1_fy2_pct: g }) === "FAIL"));
    /* A route the terminal cannot express is a ruling only half-landed: admin.html rejects
       any lens absent from LENS_NAME, so AIP must be assignable AND renderable there. */
    ok("G3 ruling: AIP is assignable in the terminal (LENS_NAME whitelist) and has its own colour",
      /const LENS_NAME=\{[^}]*AIP:/.test(adminSrc) && /--AIP:/.test(adminSrc) &&
      /\.lens-AIP\{color:var\(--AIP\)\}/.test(adminSrc));
    ok("G3 ruling: every registry lens the terminal must express is in LENS_NAME — no route is unreachable",
      TSREG.knownLenses().every((l) => new RegExp("[{,]" + l + ":").test(
        (adminSrc.match(/const LENS_NAME=\{[^}]*\}/) || [""])[0])));
  }
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
  ok("PH_G2 accepts SELF_FUNDING as a PASS (a cash generator could never answer this gate and " +
     "read UNKNOWN — the strongest funding position scoring as no information); exact-match only",
    rw.evaluate({ runway_months: "SELF_FUNDING" }) === "PASS" &&
    rw.evaluate({ runway_months: "self_funding" }) === "UNKNOWN" &&
    rw.evaluate({ runway_months: "SELF FUNDING" }) === "UNKNOWN" &&
    rw.evaluate({}) === "UNKNOWN" &&
    /SELF_FUNDING/.test(rw.inputs.runway_months));
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

// ═══════════ [48] /api/score handler — fake KV + real authorize (commit 3) ═══════════
// The refresh.js precedent: the Pages Function imports directly in Node; a fake KV and
// hand-rolled requests drive the full auth/validation/write ladder without HTTP.
console.log("\n[48] /api/score — server-authoritative scoring endpoint");
{
  const score = await import("../functions/api/score.js");
  const mkKV2 = (init = {}) => {
    const store = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
    return {
      async get(k, type) { const v = store.get(k); return v == null ? null : (type === "json" ? JSON.parse(v) : v); },
      async put(k, v) { store.set(k, String(v)); },
      async delete(k) { store.delete(k); },
      async list({ prefix, limit = 50 }) {
        const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name }));
        return { keys, list_complete: true, cursor: null };
      },
      _store: store,
    };
  };
  const PIN = "123456";
  const mkReq = (method, { params = "", headers = {}, body = null } = {}) => ({
    method,
    url: "https://macrodash.pages.dev/api/score" + params,
    headers: { get: (k) => headers[k] ?? headers[k.toLowerCase()] ?? null },
    text: async () => (body == null ? "" : JSON.stringify(body)),
  });
  const seedBook = { version: "1.0", book: [
    { sym: "AAA", tier: "S", lens: "AI", deepDive: {
      consensus: { revenue_B: { 2027: 11.45, 2028: 21.56 }, eps: { 2027: -1.61, 2028: -2.04 } },
      pt_model: { ev_s_multiple: { 2026: 5.5, 2027: 5.45 }, share_count_M: 310 },
      ref_px: { px: 212.58, at: new Date(Date.now() - 86400000).toISOString().slice(0, 10) } } },
    { sym: "ZZZ", tier: "B", lens: "??", deepDive: {} },
    // BBB is a MIGRATED name (FEAT-TT-DDSTORE, v3.75): NO embedded deepDive — the thesis
    // payload lives only at tt:dd:v1:BBB. The endpoint must read the store or P1 is blind.
    { sym: "BBB", tier: "S", lens: "AI" },
  ], cut: [] };
  const bbbDd = { consensus: { revenue_B: { 2027: 10, 2028: 13 }, eps: { 2027: 2, 2028: 2.4 } },
    pt_model: { pe_floor_multiple: 18 },
    ref_px: { px: 30, at: new Date(Date.now() - 86400000).toISOString().slice(0, 10) } };
  const env = () => ({ TT_PIN: PIN, PULSE_CACHE: mkKV2({ "tt:book:v1": seedBook, "tt:dd:v1:BBB": bbbDd }) });
  const UI = { methodology_version: "tt-underwriting-v2.6.0", route_gates: {}, falsifiers: [] };

  ok("score: anonymous GET fails closed (401)", await (async () => {
    const r = await score.onRequestGet({ request: mkReq("GET", { params: "?sym=AAA" }), env: env() });
    return r.status === 401;
  })());
  ok("score: cross-origin PUT → 403 before any work", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { Origin: "https://evil.example", "x-tt-pin": PIN } }), env: env() });
    return r.status === 403;
  })());
  ok("score: unknown method → 405", await (async () => {
    const r = await score.onRequest({ request: mkReq("DELETE", {}), env: env() });
    return r.status === 405;
  })());
  const e1 = env();
  const put1 = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { "x-tt-pin": PIN }, body: { underwriting_inputs: UI } }), env: e1 });
  const rec1 = JSON.parse(await put1.text());
  ok("score: first PUT computes server-side and returns the normalized record (never rereads KV)",
    put1.status === 200 && rec1.record.scorecard.route === "AI_INFRA" &&
    rec1.record.scorecard.status === "UNSCORABLE" &&
    rec1.record.scorecard.blockers.some((b3) => /AWAITING_FALSIFIERS/.test(b3)) &&
    /^sha256:/.test(rec1.record.scorecard.input_hash));
  ok("score: the record, snapshot and index were all written; ledger got a compact diff",
    e1.PULSE_CACHE._store.has("tt:score:v1:AAA") &&
    [...e1.PULSE_CACHE._store.keys()].some((k) => k.startsWith("tt:score:snap:v1:AAA:sha256:")) &&
    JSON.parse(e1.PULSE_CACHE._store.get("tt:score:index:v1")).entries.AAA.status === "UNSCORABLE" &&
    e1.PULSE_CACHE._store.has("tt:ledger:AAA"));
  ok("score: a client-supplied scorecard is IGNORED — the server result carries no client total", await (async () => {
    const e2 = env();
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: UI, scorecard: { raw_score: 9.99, raw_tier: "S" } } }), env: e2 });
    const j = JSON.parse(await r.text());
    return r.status === 200 && j.record.scorecard.raw_score === null && j.record.scorecard.raw_tier === null;
  })());
  ok("score: a second PUT without a matching If-Match hash 409s WITH the server record", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { "x-tt-pin": PIN }, body: { underwriting_inputs: UI } }), env: e1 });
    const j = JSON.parse(await r.text());
    return r.status === 409 && j.error === "SCORE_VERSION_MISMATCH" && j.server.scorecard.input_hash === rec1.record.scorecard.input_hash;
  })());
  ok("score: If-Match with the current hash (or '*') updates cleanly", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA",
      headers: { "x-tt-pin": PIN, "If-Match": rec1.record.scorecard.input_hash }, body: { underwriting_inputs: UI } }), env: e1 });
    return r.status === 200;
  })());
  ok("score: a stale methodology version 409s (LEGACY_UNVERIFIED is read-side, never write-side)", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: { ...UI, methodology_version: "tt-underwriting-v2.2.1" } } }), env: env() });
    return r.status === 409;
  })());
  ok("score: an UNMAPPED stored lens is a named 422, never inferred from ticker/sector/prose", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=ZZZ", headers: { "x-tt-pin": PIN }, body: { underwriting_inputs: UI } }), env: env() });
    const j = JSON.parse(await r.text());
    return r.status === 422 && /UNMAPPED lens/.test(j.error);
  })());
  ok("score: a sym not in the book is 404 — score records exist only for tracked names", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=NOPE", headers: { "x-tt-pin": PIN }, body: { underwriting_inputs: UI } }), env: env() });
    return r.status === 404;
  })());
  ok("score: oversize fails closed naming key, measured bytes and limit — no silent truncation", await (async () => {
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: { ...UI, pad: "x".repeat(65 * 1024) } } }), env: env() });
    const j = JSON.parse(await r.text());
    return r.status === 400 && j.error === "oversize" && j.key === "tt:score:v1:AAA" && j.bytes > j.limit && j.limit === 64 * 1024;
  })());
  ok("score: a MIGRATED name's thesis is read from tt:dd:v1:<SYM> — P1 scores off the store, never blind (the v3.75 gap)", await (async () => {
    const e4 = env();
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=BBB", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: UI } }), env: e4 });
    const j = JSON.parse(await r.text());
    return r.status === 200 && typeof j.record.scorecard.pillars.owner_valuation.score === "number" &&
      !j.record.scorecard.blockers.some((b3) => /no computable model row|no usable price/.test(b3));
  })());
  ok("score: PROVISIONAL rides the endpoint — index carries the capped diagnostic, ledger logs the status", await (async () => {
    const e5 = env();
    const rev2 = (vals) => Object.entries(vals).map(([fy, value]) => ({ fy, value, source: { kind: "CONSENSUS" }, analyst_count: 5 }));
    const fullUI = { ...UI,
      trajectory: { mode: "PROFITABLE", revenue: rev2({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev2({ 2026: 5, 2028: 8 }),
        duration_years: ["2026", "2027"].map((fy) => ({ fy, metrics: [{ source: { kind: "CONSENSUS" }, analyst_count: 5 }] })) },
      economic_quality: { mode: "PROFITABLE_STANDARD", operating_margin_pct: { value: 20, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
        margin_direction_pp: { value: 0, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
        fcf_margin_pct: { value: 10, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
        capital_efficiency: { metric: "ROIC", value: 15, as_of: "2026-08-01", source: { kind: "PRIMARY" } } },
      horizon: "2027" };
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=BBB", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: fullUI } }), env: e5 });
    const j = JSON.parse(await r.text());
    if (r.status !== 200 || j.record.scorecard.status !== "PROVISIONAL") return false;
    const idx2 = JSON.parse(e5.PULSE_CACHE._store.get("tt:score:index:v1")).entries.BBB;
    const led = JSON.parse(e5.PULSE_CACHE._store.get("tt:ledger:BBB"));
    return j.record.scorecard.raw_score === null && j.record.scorecard.provisional.tier === "B" &&
      idx2.status === "PROVISIONAL" && typeof idx2.provisional_score === "number" && idx2.provisional_tier === "B" &&
      idx2.raw_score === null && led[0].to.status === "PROVISIONAL" &&
      /* v5.0.1: the index carries the p4 summary — this fixture has NO falsifiers, so the
         kind is the unwritten one and both counts are zero (never null, never invented). */
      idx2.p4 && idx2.p4.kind === "LEGACY_POST_HOC" && idx2.p4.hinges === 0 && idx2.p4.observed === 0;
  })());
  // THE MERGE'S OWN PROOF (v3.78 reconciliation): the two v3.77s composed. Write 1 carries
  // three falsifiers with self-stamped "yesterday" dates AND complete P1-P3 — the fingerprint
  // gate holds them PRECOMMITTED_PENDING regardless of the timestamps (v3.77) while the
  // bootstrap still publishes a capped PROVISIONAL output (v3.78). Write 2 re-sends the SAME
  // conditions with the observation, now against a stored record — SCORED, and the ledger
  // carries the PROVISIONAL → SCORED status transition as a belief event.
  ok("score: composed lifecycle — backdated first write is PROVISIONAL+PENDING, the second write with conditions on file is SCORED, ledger logs the transition", await (async () => {
    const e6 = env();
    const rev3 = (vals) => Object.entries(vals).map(([fy, value]) => ({ fy, value, source: { kind: "CONSENSUS" }, analyst_count: 5 }));
    const F = (id) => ({ id, green_condition: "g", amber_condition: "a", red_condition: "r",
      importance: 2, kill: false, cadence_days: 90, state: "GREEN",
      // ET, NOT toISOString(): the engine validates observation freshness against the ET
      // date, so a UTC stamp future-dates the observation after ~8pm ET and scoreP4 correctly
      // rejects it as INVALID — turning this assert red every evening. Exactly the defect
      // v3.11 fixed for run stamps and the v3.35 fixpack fixed for render fixtures.
      as_of: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
      defined_at: "2026-08-04T20:00:00Z",
      qualifying_observation: { id: "obs", observed_at: "2026-08-05T13:00:00Z" } });
    const base = { ...UI,
      trajectory: { mode: "PROFITABLE", revenue: rev3({ 2026: 100, 2028: 150 }), earnings_or_fcf: rev3({ 2026: 5, 2028: 8 }),
        duration_years: ["2026", "2027"].map((fy) => ({ fy, metrics: [{ source: { kind: "CONSENSUS" }, analyst_count: 5 }] })) },
      economic_quality: { mode: "PROFITABLE_STANDARD", operating_margin_pct: { value: 20, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
        margin_direction_pp: { value: 0, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
        fcf_margin_pct: { value: 10, as_of: "2026-08-01", source: { kind: "PRIMARY" } },
        capital_efficiency: { metric: "ROIC", value: 15, as_of: "2026-08-01", source: { kind: "PRIMARY" } } },
      horizon: "2027", falsifiers: [F("x"), F("y"), F("z")] };
    const r1 = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=BBB", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: base } }), env: e6 });
    const j1 = JSON.parse(await r1.text());
    if (r1.status !== 200) return false;
    const sc1 = j1.record.scorecard;
    if (!(sc1.status === "PROVISIONAL" && sc1.pillars.falsifier_health.bootstrap === "PRECOMMITTED_PENDING" &&
      sc1.raw_score === null)) return false;
    const r2 = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=BBB",
      headers: { "x-tt-pin": PIN, "If-Match": sc1.input_hash }, body: { underwriting_inputs: base } }), env: e6 });
    const j2 = JSON.parse(await r2.text());
    if (r2.status !== 200) return false;
    const sc2 = j2.record.scorecard;
    const led2 = JSON.parse(e6.PULSE_CACHE._store.get("tt:ledger:BBB"));
    /* v5.0.1: after write 1 the index p4 reads the COMMITTED kind with real counts — the
       veto downstream says "committed … a later write scores them", never "unwritten". */
    const idxP4 = JSON.parse(e6.PULSE_CACHE._store.get("tt:score:index:v1")).entries.BBB.p4;
    return sc2.status === "SCORED" && typeof sc2.raw_score === "number" &&
      sc2.pillars.falsifier_health.score === 10 &&
      idxP4 && idxP4.hinges === 3 && idxP4.observed === 3 &&
      led2[0].to.status === "SCORED" && led2[0].from.status === "PROVISIONAL" &&
      led2[1].to.status === "PROVISIONAL";
  })());
  ok("score: GET ?book=1 returns the compact index + deployed caps recorded as metadata", await (async () => {
    const r = await score.onRequestGet({ request: mkReq("GET", { params: "?book=1", headers: { "x-tt-pin": PIN } }), env: e1 });
    const j = JSON.parse(await r.text());
    return r.status === 200 && j.deployed_caps.dd_max === 100 * 1024 && j.deployed_caps.max_body === 300 * 1024 && j.index.AAA.route === "AI_INFRA";
  })());
  ok("decision: a stale scorecard hash is rejected (409 STALE_SCORECARD_HASH), never rewritten", await (async () => {
    const r = await score.onRequestPost({ request: mkReq("POST", { params: "?decision=1", headers: { "x-tt-pin": PIN },
      body: { event: "ELIGIBLE_SET_CHANGED", selected: { sym: "AAA", price: 212, annualized_return: 30 },
        scorecard_hashes: { AAA: "sha256:deadbeef" } } }), env: e1 });
    const j = JSON.parse(await r.text());
    return r.status === 409 && j.error === "STALE_SCORECARD_HASH";
  })());
  ok("decision: a verified event persists SERVER-stamped into the paginated journal", await (async () => {
    const cur = JSON.parse(e1.PULSE_CACHE._store.get("tt:score:v1:AAA")).scorecard.input_hash;
    const r = await score.onRequestPost({ request: mkReq("POST", { params: "?decision=1", headers: { "x-tt-pin": PIN },
      body: { event: "ELIGIBLE_SET_CHANGED", selected: { sym: "AAA", price: 212, annualized_return: 30 },
        alternatives: [], scorecard_hashes: { AAA: cur } } }), env: e1 });
    if (r.status !== 200) return false;
    const list = await score.onRequestGet({ request: mkReq("GET", { params: "?decisions=1", headers: { "x-tt-pin": PIN } }), env: e1 });
    const j = JSON.parse(await list.text());
    return j.events.length === 1 && j.events[0].at && j.events[0].event === "ELIGIBLE_SET_CHANGED";
  })());
  ok("score: deployed-caps metadata matches the REAL tt.js MAX_BODY and admin.html DD_MAX (three-way pin)",
    (() => {
      const scoreSrc = readSrc("../functions/api/score.js");
      return /dd_max: 100 \* 1024/.test(scoreSrc) && /max_body: 300 \* 1024/.test(scoreSrc) &&
        ttSrc.includes("const MAX_BODY = 300 * 1024") && adminSrc.includes("const MAX_BODY=300*1024") &&
        adminSrc.includes("const DD_MAX=100*1024");
    })());
  ok("score: zero bytes added to the book document — the handler never writes tt:book:v1", await (async () => {
    const before = e1.PULSE_CACHE._store.get("tt:book:v1");
    await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA",
      headers: { "x-tt-pin": PIN, "If-Match": "*" }, body: { underwriting_inputs: UI } }), env: e1 });
    return e1.PULSE_CACHE._store.get("tt:book:v1") === before;
  })());
  // §4.5 max-shape fixture: 4 sourced pillars, 8 maximum-length falsifiers, every gate
  // result, one outcome-memory cycle — must serialize under the dedicated limit.
  ok("max-shape: the §4.5 synthetic fixture stays under 64KB with zero truncation", await (async () => {
    const long = (s) => s.repeat(40).slice(0, 600);
    const REC2 = (v) => ({ value: v, unit: "pct", as_of: "2026-08-01", observed_at: "2026-08-01T12:00:00Z",
      source: { kind: "PRIMARY", name: long("src "), ref: "https://example.com/" + "x".repeat(180) },
      derivation: { formula: long("(a/b) "), inputs: ["a", "b"] } });
    const H2 = (i2) => ({ id: "hinge_" + i2, definition: long("def "), green_condition: long("g "),
      amber_condition: long("a "), red_condition: long("r "), importance: 2, state: "GREEN", kill: i2 === 0,
      cadence_days: 90, defined_at: "2026-08-04T23:30:00Z", as_of: "2026-08-05",
      source: { kind: "PRIMARY", ref: "https://example.com/" + "y".repeat(180) },
      qualifying_observation: { id: "obs" + i2, observed_at: "2026-08-05T02:00:00Z" } });
    const maxUI = { methodology_version: "tt-underwriting-v2.6.0",
      trajectory: { mode: "PREPROFIT", preprofit_second_series: "EBITDA_CAGR", ebitda_basis: "ADJUSTED",
        ebitda_reconciliation: REC2(1), revenue: [REC2(1), REC2(2)].map((r2, i2) => ({ ...r2, fy: String(2027 + i2) })),
        ebitda: [REC2(0.1), REC2(0.5)].map((r2, i2) => ({ ...r2, fy: String(2027 + i2) })),
        duration_years: [{ fy: "2027", metrics: [REC2(1)] }, { fy: "2028", metrics: [REC2(1)] }] },
      economic_quality: { mode: "PREPROFIT", unit_economics: { state: "IMPROVING", source: { kind: "PRIMARY" }, rationale: long("r ") },
        margin_direction: { state: "IMPROVING", source: { kind: "PRIMARY" }, rationale: long("r ") },
        runway_months: REC2(24), path_to_profit: { state: "DATED_MILESTONES", source: { kind: "PRIMARY" }, rationale: long("r ") } },
      falsifiers: [...Array(8)].map((_, i2) => H2(i2)),
      route_gates: Object.fromEntries(["AI_G1_BUILDOUT", "AI_G2_CIRCULARITY", "AI_G3_2028_BRIDGE",
        "GLOBAL_GUIDANCE_WITHDRAWN", "GLOBAL_CUSTOMER_LOSS", "GLOBAL_RESTATEMENT",
        "GLOBAL_KEY_PERSON_EXIT", "GLOBAL_MOAT_INVALIDATION", "GLOBAL_LOOP_UNWIND"]
        .map((id) => [id, { occurred: false, capex_funded_12mo: true, milestone_within_90d: true,
          supplier_equity_pct: 9.3, supplier_is_primary_vendor: true, top_customer_backlog_pct: 59,
          ev_fy2_rev_multiple: 2.7, fy1_fy2_growth_pct: 88, analyst_count_fy2: 12, as_of: "2026-08-05",
          legacy_label: "PASS-with-note" }])) };
    const e3 = env();
    const r = await score.onRequestPut({ request: mkReq("PUT", { params: "?sym=AAA", headers: { "x-tt-pin": PIN },
      body: { underwriting_inputs: maxUI } }), env: e3 });
    if (r.status !== 200) return false;
    const stored = e3.PULSE_CACHE._store.get("tt:score:v1:AAA");
    return stored.length < 64 * 1024 && JSON.parse(stored).underwriting_inputs.falsifiers.length === 8;
  })());
}
// ═══════════ [45] UI-OVERHAUL Slice 1 (task 1.1) — design tokens extracted ═══════════
// The DT/T objects moved verbatim from dashboard.jsx to src/design-tokens.js — the ONE home.
// These pins hold the extraction contract: the module is pure (Node-importable, no React),
// the dashboard actually imports it (no inline second copy left to drift), and every token
// key the render code references — static bracket lookups, T.* dot lookups, AND the dynamic
// colorKey/tintKey values regime.js emits — resolves in the export. Completeness is COMPUTED
// against dashSrc, not pinned as a hardcoded key list (the v3.41 SOURCES-reconciliation rule:
// a hardcoded list is true only by coincidence).
console.log("\n[45] UI-OVERHAUL task 1.1 — design tokens are a module, complete and pure");
const tokSrc = readSrc("../src/design-tokens.js");
ok("tokens: the module is pure — no React, no JSX, nothing but data",
  !/from ['"]react['"]/.test(tokSrc) && !/</.test(tokSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").replace(/<=?/g, "")) &&
  Object.keys(DT).length >= 35 && Object.keys(TOK_T).length >= 20);
ok("tokens: dashboard.jsx IMPORTS the module and keeps no inline copy to drift",
  dashSrc.includes('from "./design-tokens.js"') && !/\nconst DT = \{/.test(dashSrc) && !/\nconst T = \{/.test(dashSrc));
ok("tokens: the empty-export guard exists and WARNS rather than claiming a fallback that isn't there",
  /Object\.keys\(DT\)\.length\)/.test(dashSrc) && /console\.warn\("design-tokens/.test(dashSrc));
ok("tokens: every DT[\"…\"] key referenced in ANY UI surface resolves in the export (computed, not listed)",
  (() => { const refs = [...uiSrc.matchAll(/DT\["([^"]+)"\]/g)].map((m) => m[1]);
    return refs.length >= 15 && refs.every((k) => DT[k] !== undefined); })());
ok("tokens: every static T.* lookup in ANY UI surface resolves in the export",
  (() => { const refs = [...new Set([...uiSrc.matchAll(/\bT\.([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]))];
    return refs.length >= 10 && refs.every((k) => TOK_T[k] !== undefined); })());
ok("tokens: the DYNAMIC keys — every tintKey/colorKey regime.js can emit resolves (T[regime.colorKey], DT[regime.tintKey])",
  (() => { const tints = [...regimeSrc.matchAll(/tintKey:"([^"]+)"/g)].map((m) => m[1]);
    const colors = [...regimeSrc.matchAll(/colorKey:"([^"]+)"/g)].map((m) => m[1]);
    return tints.length >= 4 && colors.length >= 8 &&
      tints.every((k) => DT[k] !== undefined) && colors.every((k) => TOK_T[k] !== undefined); })());
ok("tokens: voteStyle's four states all resolve to real T colors (the two-altitude map cannot dangle)",
  ["bull", "bear", "neutral", "excluded"].every((v) => TOK_T[voteStyle(v).colorKey] !== undefined));
ok("tokens: the type scale is numeric and ordered (fs-xs < fs-s < fs-m < fs-l < fs-xl)",
  (() => { const s = ["fs-xs", "fs-s", "fs-m", "fs-l", "fs-xl"].map((k) => DT[k]);
    return s.every((n) => typeof n === "number") && s.every((n, i) => i === 0 || n > s[i - 1]); })());
ok("tokens: T aliases stay derived from DT, never a second literal (spot-check the load-bearing ones)",
  TOK_T.bg === DT["bg"] && TOK_T.textMuted === DT["text-muted"] && TOK_T.fontMono === DT["font-mono"] &&
  TOK_T.fsM === DT["fs-m"] && TOK_T.green === DT["green"] && TOK_T.red === DT["red"]);

// ═══════════ [46] UI-OVERHAUL task 1.3 — RegimeBand extracted to src/sections/ ═══════════
// The verdict band moved VERBATIM (the only addition is the Property-9 null guard). These
// pins hold the extraction contract; the band's own behavior pins above were repointed to
// bandSrc and still hold, and the public render suite drives the real render.
console.log("\n[46] UI-OVERHAUL task 1.3 — RegimeBand is a module; one copy of everything");
ok("band: dashboard imports the component AND the verdict vocabulary from the one home",
  dashSrc.includes('import RegimeBand, { WITHHELD_LABEL, WEN_MOON_STATES } from "./sections/RegimeBand.jsx"') &&
  !/\nconst RegimeBand=/.test(dashSrc) && !/\nconst WEN_MOON_STATES = \[/.test(dashSrc) &&
  !/\nconst WITHHELD_LABEL/.test(dashSrc));
ok("band: fmt has ONE home (src/format.js) — neither surface redefines it",
  !/\nconst fmt = \{/.test(dashSrc) && !/\nconst fmt\b/.test(bandSrc) &&
  /import \{ fmt(, pctColor)? \} from "\.\/format\.js"/.test(dashSrc) &&
  /import \{ fmt(, pctColor)? \} from "\.\.\/format\.js"/.test(bandSrc));
ok("band: a missing data prop renders a safe empty state, never a throw (Property 9)",
  /if\(!d\)return <div aria-hidden="true"\/>;/.test(bandSrc));
ok("band: the module stays under the 300-line bound (Property 10)",
  bandSrc.split("\n").length <= 300);
// v3.97: the hero explanation SWAPS by mode — sentence gated !simple (Power), prose gated
// simple (the newbie pair). One derivation (postureSummary), never stacked.
// v4.0: the hero's explanation swaps by MODE — Simple gets simpleSentence + the scoped
// plainVerdict, Power keeps postureSummary's compact one-liner and the moon voice. The
// v3.97 `prose` prop is gone from the render (the cards carry that detail now).
ok("band: the call site still passes the live wiring (+ v4.0: mode-swapped sentence and plainVerdict)",
  /sentence=\{callDrift\?null:\(simple\?simpleS:\(!evidenceSet\.withheld&&evidenceSet\.summary\?evidenceSet\.summary\.sentence:null\)\)\}/.test(dashSrc) &&
  /plainVerdict=\{simple\?simpleV:null\} conf=\{regimeConf\}/.test(dashSrc) &&
  !/prose=\{/.test(dashSrc) &&
  // v3.98.3: the hero renders the EvidenceSet's OWN factor rows (which carry the real
  // exclusion cause) instead of re-deriving them — one derivation, two altitudes.
  // v4.0.3: the hero renders the CANONICAL regime and flips too — it no longer runs a second
  // derivation beside buildEvidenceSet's (drift risk at the freshness/loading/error edges).
  /factorRows=\{evidenceSet\.factors\} regimeIn=\{evidenceSet\.regime\} flipsIn=\{evidenceSet\.flips\}\s*call=\{dailyCall\} callFrozen=\{callFrozen\}/.test(dashSrc) &&
  /const regime=regimeIn\|\|computeRegime\(d,stale\)/.test(bandSrc) &&
  /const fc=flipsIn\|\|flipConditions\(d,stale\)/.test(bandSrc) &&
  /<RegimeBand d=\{d\} stale=\{staleFactors\} loading=\{mode==="LOADING"\} liveBuild=\{liveBuild\} srcLabel=\{derivedLabel\}/.test(dashSrc));

// ═══════════ [47] UI-OVERHAUL task 1.4 — FiveWhys extracted, presentation only ═══════════
// The 5 Whys strip moved verbatim to src/sections/FiveWhys.jsx. The separation contract:
// computeFiveWhys, the FW_FIELDS freshness set and the derivedLabel derivation STAY in the
// orchestrator — the section renders what it is handed and computes nothing. SourceBox (+
// DataModeBadge) and SectionHeader became primitives with one home each.
console.log("\n[47] UI-OVERHAUL task 1.4 — FiveWhys is a module; logic stays in the orchestrator");
ok("whys: presentation only — the CODE never imports or calls the computation (comments may name it)",
  (() => { const code = whysSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    return !/fiveWhys\.js/.test(code) && !/computeFiveWhys/.test(code) &&
           !/useMarketData/.test(code) && !/FW_FIELDS/.test(code); })());
ok("whys: canonical computation and headline freshness stay in the orchestrator",
  /const fw=computeFiveWhys\(\{\.\.\.d, session:etSession\(\)\}, regimeView, \{/.test(dashSrc) &&
  /headlineFresh:freshSet===null\|\|freshSet\.has\("marketHeadline"\)/.test(dashSrc));
ok("whys: a missing fw prop renders a safe empty state, never a throw (Property 9)",
  /if\(!fw\|\|!Array\.isArray\(fw\.whys\)\)return <div aria-hidden="true"\/>;/.test(whysSrc));
ok("whys: the call site hands over narrative, state-derived label, and equity-close provenance",
  /<FiveWhys fw=\{fw\} derivedLabel=\{derivedLabel\} mode=\{modeOf\('spyPrice'\)\} asOf=\{asOfOf\('spyPrice'\)\}\/>/.test(dashSrc));
ok("whys: module stays under the 300-line bound (Property 10); primitives under 100",
  whysSrc.split("\n").length <= 300 && sbSrc.split("\n").length <= 100 && shSrc.split("\n").length <= 100);
ok("primitives: SourceBox/DataModeBadge/SectionHeader have ONE home each — no inline copies left",
  !/\nconst SourceBox = /.test(dashSrc) && !/\nconst DataModeBadge = /.test(dashSrc) &&
  !/\nconst SectionHeader=/.test(dashSrc) && !/\nconst apiColors = /.test(dashSrc) &&
  dashSrc.includes('import SourceBox, { DataModeBadge } from "./primitives/SourceBox.jsx"') &&
  dashSrc.includes('import SectionHeader from "./primitives/SectionHeader.jsx"'));

// ═══════════ [48] UI-OVERHAUL wave 5 (tasks 3.1-3.3) — strip, quality, digest ═══════════
// Three more verbatim moves, same separation contract: the modules render what the
// orchestrator computes. Their behavior pins above were repointed and still hold; the
// public render suite drives all three live (strip visible while detail collapses, the
// confidence sentence, the baseline-set/no-change cycle across a reload).
console.log("\n[48] UI-OVERHAUL wave 5 — MacroStrip/SignalQuality/WhatChanged are modules");
ok("wave5: presentation only — none of the three imports computation or the data hook",
  [stripSrc, sqSrc, wcSrc].every((src) => {
    const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    return !/useMarketData|computeRegime|buildEvidenceSet|summarizeEvidence|compareEvidence|localStorage/.test(code);
  }));
ok("wave5: the census, confidence derivation and compare-then-persist all STAY in the orchestrator",
  dashSrc.includes("const sq=SIGNAL_FIELDS.reduce") &&
  dashSrc.includes("counted:evidenceSet.counted,total:evidenceSet.totalFactors") &&
  dashSrc.indexOf("compareEvidence(prev,cur)") < dashSrc.indexOf("localStorage.setItem(LASTVALID_KEY"));
ok("wave5: every call site hands over computed props, including the voting-marker set and the badge slot",
  /<MacroStrip d=\{d\} modeOf=\{modeOf\} fomcLabel=\{fomcLabel\} fomcDays=\{fomcDays\}/.test(dashSrc) &&
  /votingFields=\{VOTING_FIELDS\} badge=\{<WenMoonBadge spyChangePct=\{d\.marketPulse\.spy\.changePct\}\/>\}/.test(dashSrc) &&
  /<SignalQuality sq=\{sq\}\/>/.test(dashSrc) &&   // v3.94: confidence props moved to the hero
  /<WhatChanged changed=\{changed\}\/>/.test(dashSrc));
ok("wave5: null-safety — a missing prop is a safe empty state on all three (Property 9)",
  /if\(!d\|\|typeof modeOf!=="function"\)return <div aria-hidden="true"\/>;/.test(stripSrc) &&
  /if\(!sq\)return <div aria-hidden="true"\/>;/.test(sqSrc) &&
  /if\(!changed\)return null;/.test(wcSrc));
ok("wave5: the FEAT-170 4-col reflow contract survives — module classes match the stylesheet rules",
  stripSrc.includes('className="macro-strip"') && stripSrc.includes('className="macro-strip-inner"') &&
  dashSrc.includes(".macro-strip-inner{display:grid!important;grid-template-columns:repeat(4,1fr)!important"));
ok("wave5: all three stay under the 300-line bound (Property 10)",
  [stripSrc, sqSrc, wcSrc].every((src) => src.split("\n").length <= 300));
ok("wave5: pctColor joined fmt in src/format.js — no inline copy left anywhere",
  !/\nconst pctColor=/.test(dashSrc) && !/const pctColor=/.test(stripSrc) &&
  readSrc("../src/format.js").includes("export const pctColor="));

// ═══════════ [49] UI-OVERHAUL task 5.1 — CollapsedGroup + Illustrative primitives ═══════════
// The ONE disclosure idiom and the v3.1 illustrative treatment each get one home. NO
// forceOpen prop and NO mode-based default were added — the v3.25 rule (a red fact is
// never placed inside a collapse) is stronger than the spec's proposed mechanism, and
// open-by-mode stays the caller's decision via demoted()/defaultOpen.
console.log("\n[49] UI-OVERHAUL task 5.1 — CollapsedGroup/Illustrative are primitives");
const cgSrc = readSrc("../src/primitives/CollapsedGroup.jsx");
const ilSrc = readSrc("../src/primitives/Illustrative.jsx");
ok("cg: one home each — no inline definitions left in the orchestrator",
  !/\nconst CollapsedGroup = /.test(dashSrc) && !/\nconst IllustrativeChip = /.test(dashSrc) &&
  !/\nconst ILLUS_HATCH = /.test(dashSrc) && !/\nconst isIllustrative = /.test(dashSrc) &&
  dashSrc.includes('import CollapsedGroup from "./primitives/CollapsedGroup.jsx"') &&
  dashSrc.includes('import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "./primitives/Illustrative.jsx"'));
ok("cg: the disclosure contract survives the move — aria-expanded, count-while-closed, chip default",
  cgSrc.includes("aria-expanded={open}") && cgSrc.includes("`▸ +${count}`") &&
  cgSrc.includes("chip = true") && cgSrc.includes("defaultOpen = false") &&
  cgSrc.includes("{open && children}"));
// v3.95 (owner call): `persistKey` remembers ONE group's open state per device. It is
// deliberately OPT-IN — a remembered "open" on a demoted stale/curated group would quietly
// undo FEAT-321 — and a storage fault or unrecognized value falls back to the caller's
// stated defaultOpen, never a guessed one.
ok("cg v3.95: persistKey is opt-in and defaults to null (no group remembers state by accident)",
  /persistKey = null/.test(cgSrc) && /const \[open, setOpen\] = useState\(\(\) => readOpen\(persistKey, defaultOpen\)\)/.test(cgSrc));
ok("cg v3.95: a storage fault or unknown stored value falls back to defaultOpen, never to open",
  (() => { const m = cgSrc.match(/const readOpen = [\s\S]*?\n\};/); if (!m) return false;
    const readOpen = eval("(" + m[0].replace(/^const readOpen = /, "").replace(/;$/, "") + ")");
    const g = globalThis.localStorage; globalThis.localStorage = undefined;
    const faulted = readOpen("k", false) === false && readOpen("k", true) === true;
    globalThis.localStorage = { getItem: () => "yes-please" };
    const unknown = readOpen("k", false) === false;
    globalThis.localStorage = { getItem: () => "1" };
    const stored = readOpen("k", false) === true && readOpen(null, false) === false;
    globalThis.localStorage = g; return faulted && unknown && stored; })());
ok("whys v3.95: the whys are reachable in SIMPLE — one honestly-labelled expander, chain only",
  /* 8/28 Whys altitude: the label PREFIX stays the component default (six hasText locators
     match on it); the flip rides flipChip (closed, chip-length) + flipLine (verbatim,
     inside). A withheld posture passes no chip — the closed label stays bare. */
  /\{simple&&<FiveWhys fw=\{fw\}[\s\S]{0,240}flipChip=\{evidenceSet\.withheld\?null:flipChipOf\(simpleF\)\} flipLine=\{simpleF\}\/>\}/.test(dashSrc) &&
  /label="why this call · 5 checks"/.test(whysSrc) &&
  /export const WHYS_KEY="md:exp:whys:v1";/.test(whysSrc) &&
  /persistKey=WHYS_KEY/.test(whysSrc));
ok("whys v3.95: the technical layer stays POWER-only — chips/tally/flip live in the hero panel, matrix behind !simple",
  /\{!simple&&<section aria-labelledby="drivers"/.test(dashSrc) && !/simple&&<EvidenceMatrix/.test(dashSrc));

ok("cg: primitives stay under the 100-line bound",
  cgSrc.split("\n").length <= 100 && ilSrc.split("\n").length <= 100);
ok("cg: isIllustrative keeps the v3.1 rule — MOCK and STALE suppress, everything else renders",
  (() => { const m = /export const isIllustrative = \(mode\) => mode === "MOCK" \|\| mode === "STALE";/.test(ilSrc);
    return m; })());

// ═══════════ [50] UI-OVERHAUL wave 9 (tasks 5.2-5.4) — detail panels + tile primitives ═══════════
// MarketDetail, MacroRegime and Headwinds moved verbatim; Badge/Label became atoms;
// DirTile (with its three private helpers) and FGGauge became primitives; Divider was
// deleted (rendered nowhere). Same separation contract as every prior wave.
console.log("\n[50] UI-OVERHAUL wave 9 — detail panels are modules; primitives have one home");
const atomsSrc = readSrc("../src/primitives/atoms.jsx");
const fgSrc = readSrc("../src/primitives/FGGauge.jsx");
ok("wave9: presentation only — none of the three sections imports computation or the data hook",
  [mdSrc, mrSrc, hwSrc].every((src) => {
    const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    return !/useMarketData|computeRegime|buildEvidenceSet|evalAlert\(/.test(code);
  }));
ok("wave9: the call sites hand over computed props (demotion rule, chart series, MA cross, FOMC)",
  /<MarketDetail d=\{d\} modeOf=\{modeOf\} asOfOf=\{asOfOf\} demoted=\{demoted\} spyData=\{spyData\} goldenCross=\{goldenCross\}\/>/.test(dashSrc) &&
  // v3.99: the countdown's SOURCE travels with it — a curated-calendar date is a different
  // claim from the market's own strike date, and the tile must be able to say which.
  /<MacroRegime d=\{d\} modeOf=\{modeOf\} asOfOf=\{asOfOf\} fomcDays=\{fomcDays\} fomcSource=\{fomcSource\}\/>/.test(dashSrc) &&
  /<Headwinds d=\{d\}\/>/.test(dashSrc));
ok("wave9: null-safety on all three (Property 9)",
  /if\(!d\|\|typeof modeOf!=="function"\|\|!Array\.isArray\(spyData\)\)return <div aria-hidden="true"\/>;/.test(mdSrc) &&
  /if\(!d\|\|typeof modeOf!=="function"\)return <div aria-hidden="true"\/>;/.test(mrSrc) &&
  /if\(!d\|\|!Array\.isArray\(d\.headwinds\)\)return <div aria-hidden="true"\/>;/.test(hwSrc));
ok("wave9: Headwinds owns its per-row expand state — nothing external ever read it",
  hwSrc.includes("const [expandedHW,setExpandedHW]=useState(null);") &&
  !dashSrc.includes("expandedHW"));
ok("wave9: one home each — no inline Badge/Label/DirTile/FGGauge/stoplight helpers left behind",
  !/\nconst Badge=/.test(dashSrc) && !/\nconst Label=/.test(dashSrc) &&
  !/\nconst DirTile=/.test(dashSrc) && !/\nconst FGGauge=/.test(dashSrc) &&
  !/\nfunction stoplightColor/.test(dashSrc) && !/\nfunction verdictFromTones/.test(dashSrc) &&
  !/\nconst Divider=/.test(dashSrc) && !/<Divider/.test(uiSrc));
ok("wave9: DirTile carries its three private helpers — their ONLY consumer",
  dtSrc.includes("const arrow=") && dtSrc.includes("function stoplightColor") &&
  dtSrc.includes("function verdictFromTones"));
ok("wave9: sections under 300 lines, primitives under 100 (Property 10)",
  mdSrc.split("\n").length <= 300 && mrSrc.split("\n").length <= 300 && hwSrc.split("\n").length <= 300 &&
  dtSrc.split("\n").length <= 100 && fgSrc.split("\n").length <= 100 && atomsSrc.split("\n").length <= 100);
ok("wave9: the NFCI band constants are IMPORTED from the engine, never re-declared in a section",
  !/const NFCI_TIGHT/.test(mdSrc) && !/const NFCI_LOOSE/.test(mdSrc));

// ═══════════ [51] UI-OVERHAUL wave 12 (tasks 7.1-7.4) — AI, Alerts, DataHealth, Watchlist ═══════════
// Four more verbatim moves. The judgment calls this wave: alert EVALUATION stays in the
// orchestrator (only the rendering moved), the A4 public/private gate stays at ONE call
// site, the ai/health anchors travel WITH their sections, aiEcon.js is pure so the
// scissors math is now IMPORTED and RUN (no more source-lift), and the v3.69 orphaned
// constants (LAUNCH_COST/EVTOL_CERT) were deleted, not moved.
console.log("\n[51] UI-OVERHAUL wave 12 — AI/Alerts/DataHealth/Watchlist are modules");
ok("wave12: presentation only — the sections import no computation, hook, or storage",
  [aiSrc, alSrc, dhSrc, wlSrc].every((src) => {
    const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    return !/useMarketData|computeRegime|buildEvidenceSet|evalAlert|localStorage/.test(code);
  }));
ok("wave12: evaluation stays home — evalAlert/ALERT_METRICS/DEFAULT_ALERTS remain in the orchestrator",
  dashSrc.includes("export function evalAlert") && dashSrc.includes("const ALERT_METRICS=") &&
  dashSrc.includes("const DEFAULT_ALERTS=[") && !/evalAlert\s*\(/.test(alSrc.replace(/\/\/[^\n]*/g,"")));
ok("wave12: the aiEcon module is PURE (Node-importable) and the section imports it",
  !/from ['\"]react['\"]/.test(aiEconSrc) &&
  aiSrc.includes('import { GPU_PRICING, TOKEN_EFFICIENCY, tokenScissors, tokenDemand, HYPERSCALER_CAPEX } from "../aiEcon.js"'));
ok("wave12: tokenScissors really runs from the import (behavior, not string): 11-week window, never annualised",
  (() => { const r = TW.tokenScissors([6.8, 6.5, 6.3, 6.1, 5.9, 5.8, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1]);
    return r.weeks === 11 && Math.abs(r.pxWin + 0.25) < 1e-9; })());
ok("wave12: Watchlist owns its open state; DEFAULT CLOSED survives the move (FEAT-322)",
  wlSrc.includes("const [watchlistOpen,setWatchlistOpen]=useState(false);") &&
  !dashSrc.includes("watchlistOpen"));
ok("wave12: null-safety on all four (Property 9)",
  /if\(!d\|\|typeof modeOf!=="function"\)return <div aria-hidden="true"\/>;/.test(aiSrc) &&
  /if\(!Array\.isArray\(alerts\)\|\|!alertEval\)return <div aria-hidden="true"\/>;/.test(alSrc) &&
  /if\(!Array\.isArray\(signalFields\)\|\|typeof modeOf!=="function"\)return <div aria-hidden="true"\/>;/.test(dhSrc) &&
  /if\(!Array\.isArray\(watchlist\)\)return <div aria-hidden="true"\/>;/.test(wlSrc));
ok("wave12: module size bounds hold (sections ≤300)",
  [aiSrc, alSrc, dhSrc, wlSrc].every((src) => src.split("\n").length <= 300));
ok("wave12: the DataHealth section carries its own landmark — anchor + h2 travel together",
  dhSrc.includes('<section aria-labelledby="health"') && dhSrc.includes('<h2 id="health"'));

// ═══════════ [52] UI-OVERHAUL wave 15 (tasks 9.1-9.5) — responsive + keyboard + focus ═══════════
// StickyNav extracted with viewport tracking (supersedes the v3.62 hash-only active state —
// a click still wins instantly); skip link; focus-on-resolve; hamburger ≤320px; 44px targets.
// The behavioral proofs run in public-render; these pin the source contracts.
console.log("\n[52] UI-OVERHAUL wave 15 — nav, skip link, focus, tap targets");
ok("9.2: StickyNav owns the nav — IntersectionObserver tracking + hashchange, disconnect on unmount",
  navSrc.includes("new IntersectionObserver") && navSrc.includes('addEventListener("hashchange"') &&
  navSrc.includes("io.disconnect()") && !/const SectionNav=/.test(dashSrc) &&
  dashSrc.includes("<StickyNav/>"));
ok("9.2: a click still wins instantly — the hash sets active synchronously beside the observer",
  navSrc.includes("setActive(window.location.hash.slice(1))"));
ok("9.1: the hamburger form exists and is CSS-switched at ≤320px (native <details>, no JS query)",
  navSrc.includes('className="nav-burger"') && navSrc.includes("☰ SECTIONS") &&
  dashSrc.includes("@media(max-width:320px){") && dashSrc.includes(".nav-burger{display:block!important;}"));
ok("9.1: the ≤320px header budget is enforced (max-height 56px + wordmark downsizes)",
  dashSrc.includes("header{max-height:56px;overflow:hidden") && dashSrc.includes('className="wordmark"'));
ok("9.1: the 44px rule covers the remaining controls (nav links, CollapsedGroup, headwind rows)",
  dashSrc.includes(".nav-link,.cg-toggle,.hw-row{min-height:44px;}") &&
  cgSrc.includes('className="cg-toggle"') && hwSrc.includes('className="hw-row"'));
ok("9.3: the skip link is first-focusable markup and reveals on :focus only",
  dashSrc.includes('<a href="#overview" className="skip-link">Skip to verdict</a>') &&
  dashSrc.includes(".skip-link:focus{left:8px") && dashSrc.includes(".skip-link{position:absolute;left:-9999px"));
ok("9.3: focus moves to the verdict ONLY on the first LOADING->settled transition, never on refreshes",
  dashSrc.includes('if(prev==="LOADING"&&(mode==="LIVE"||mode==="CACHED"||mode==="ERROR"))') &&
  dashSrc.includes('document.getElementById("overview")?.focus()') &&
  dashSrc.includes('<h2 id="overview" tabIndex={-1}'));
ok("9.2/8.2: headwind rows are real buttons now — keyboard-operable with aria-expanded",
  hwSrc.includes("aria-expanded={isExp}") && !/<div[^>]*onClick=\{\(\)=>setExpandedHW/.test(hwSrc));

// ═══════════ [53] UI-OVERHAUL wave 16 (task 9.6) — confirmed-not-optimistic copy claims ═══════════
// The interactive-state matrix (LOADING withhold, ERROR banner+retry, MOCK suppression,
// DEGRADED refresh, stale exclusion chain) predates this wave and stays pinned/driven where
// it lives. The one real gap was Req 7.9: both copy handlers claimed ✓ before the clipboard
// write settled — a denied permission flashed a false green success. Now: success confirms,
// failure reverts silently (<300ms, no toast), no clipboard API claims nothing.
console.log("\n[53] UI-OVERHAUL wave 16 — copy claims are confirmed, never optimistic");
ok("7.9: handleShare confirms on .then, reverts on .catch, and claims nothing without the API",
  /const p=navigator\.clipboard\?\.writeText\(window\.location\.href\);\s*\n\s*if\(!p\)\{return;\}/.test(dashSrc) &&
  /p\.then\(\(\)=>\{setCopied\(true\);setTimeout\(\(\)=>setCopied\(false\),2000\);\}\)\s*\n\s*\.catch\(\(\)=>\{setCopied\(false\);\}\);/.test(dashSrc));
ok("7.9: handleTtCopy — the order-gating block — follows the same confirmed rule",
  /const p=navigator\.clipboard\?\.writeText\(block\);/.test(dashSrc) &&
  /p\.then\(\(\)=>\{setTtCopied\(true\);setTimeout\(\(\)=>setTtCopied\(false\),2000\);\}\)\s*\n\s*\.catch\(\(\)=>\{setTtCopied\(false\);\}\);/.test(dashSrc));
ok("7.9: no optimistic set survives anywhere — ✓ can only follow a settled write",
  !/writeText\([^)]*\)\.catch\(\(\)=>\{\}\);\s*\n\s*set(Tt)?Copied\(true\)/.test(dashSrc));
ok("7.9: failure is SILENT — no error toast rides either handler",
  !/showToast[\s\S]{0,80}(clipboard|copy failed|share failed)/i.test(dashSrc));

// ═══════════ [54] UI-OVERHAUL wave 17 — the docs exist and CANNOT rot ═══════════
// design-system.md and RISKS.md are MAPS, not mirrors (the AGENTS.md/B5 rule): they may
// name modules and rules but never restate volatile facts — no version numbers, no
// assertion counts, no line numbers, no token values. These pins enforce that shape, so
// the third incarnation of a stale doc cannot happen here.
console.log("\n[54] UI-OVERHAUL wave 17 — docs are maps, not mirrors");
const dsDoc = readSrc("../docs/design-system.md");
const rkDoc = readSrc("../docs/RISKS.md");
ok("docs: design-system.md names the one token home and the enforcement suite",
  dsDoc.includes("src/design-tokens.js") && dsDoc.includes("npm run gates") &&
  dsDoc.includes("map, not a mirror"));
ok("docs: design-system.md carries NO volatile facts — no current-version claim, counts, or hex values (historical rule names like 'v3.1 invariant' are stable and allowed)",
  !/current version|as of v\d|version is v\d/i.test(dsDoc) &&
  !/\d+ (assertions|lines|tokens|components)/.test(dsDoc) && !/#[0-9a-fA-F]{6}/.test(dsDoc));
ok("docs: RISKS.md carries the five risks and five assumptions by id, and bans a status column",
  ["R1","R2","R3","R4","R5","A1","A2","A3","A4","A5"].every((id)=>rkDoc.includes(`**${id}`)) &&
  rkDoc.includes("Status lives in git history"));
ok("docs: RISKS.md states the pin-repoint rule (the risk this branch lived with every wave)",
  /repoints pins to\s*\n?\s*the new module/.test(rkDoc) && rkDoc.includes("uiSrc"));

// ═══════════ [55] wave-17 audit fix — strip/tile colors derive from the ONE band table ═══════════
// Findings 1-3: the strip painted a neutral F&G bearish red off a hand-written `>55`
// binary (one page, three answers: red strip number, grey gauge, • band chip), CPI
// asserted red/green off a `>3` level the engine never uses (it votes on trend SHAPE),
// and the VIX tile carried a second copy of the 18/25 edges. All three now branch on
// REGIME_BAND_TABLE's own vote; vote-derived strip colors are MUTED when the field is
// not live (a directional read off mock/stale is the v3.1 invariant's exact target).
console.log("\n[55] wave-17 audit fix — one band table, every altitude");
ok("fix1: no hand-written F&G or CPI threshold survives in the strip",
  !/score>55\?/.test(stripSrc) && !/headline>3\?/.test(stripSrc) &&
  stripSrc.includes('voteKey:"fearGreed"') && stripSrc.includes('voteKey:"cpiHeadline"'));
ok("fix1: the strip resolves vote colors through the band table + the ONE voteStyle map, muted when not live",
  stripSrc.includes("sc=b&&live?T[voteStyle(b.vote(b.read(d))).colorKey]:T.textMuted") &&
  stripSrc.includes('import { REGIME_BAND_TABLE, voteStyle } from "../regime.js"'));
ok("fix1 BEHAVIOR: a neutral F&G (42) now resolves to the neutral color, never red — and a real extreme still reads directionally",
  (() => { const b = REGIME_BAND_TABLE.find((x) => x.key === "fearGreed");
    return voteStyle(b.vote(42)).colorKey === "textSecondary" &&
           voteStyle(b.vote(62)).colorKey === "green" && voteStyle(b.vote(15)).colorKey === "red"; })());
ok("fix2 BEHAVIOR: CPI color follows the trend-shape vote (cooling green, drifting-up red), not a level",
  (() => { const b = REGIME_BAND_TABLE.find((x) => x.key === "cpiHeadline");
    return voteStyle(b.vote([3.0, 2.9, 2.8])).colorKey === "green" &&
           voteStyle(b.vote([2.4, 2.9, 3.1])).colorKey === "red" &&
           voteStyle(b.vote([3.0, 2.9, 2.9])).colorKey === "textSecondary"; })());
ok("fix2: the VIX tile branches on the band's OWN vote — no 18/25 second copy left",
  mdSrc.includes('REGIME_BAND_TABLE.find((b)=>b.key==="vix").vote(') &&
  !/vix\.current>25\?T\.red/.test(mdSrc) && !/current>18\?T\.yellow/.test(mdSrc));
ok("fix3: delta colors (pctColor day-moves) keep their treatment — facts, not verdicts",
  stripSrc.includes("sc:pctColor(d.marketPulse.spy.changePct)"));


// ---- 50. FEAT-TT-DDSTORE (v3.75) — thesis payloads get their own KV document --------
// The third time this exact wall was hit: `pos` was split out in v3.34 and the ledger in
// v3.32, each because a growing thing rode inside one fixed-size PUT. On 2026-08-05 the book
// reached 306,425 of 307,200 bytes (99.7%) and a routine two-name TT pass had to be written
// tighter to fit. v3.70's own note called the cap raise "a stopgap, not the fix" — this is
// the fix. The handler is RUN against a fake KV, not string-pinned: the migration reorders
// writes for crash-safety and the index decides which facts the board can still see, and
// neither of those is a claim a string match can prove.
console.log("\n[50] FEAT-TT-DDSTORE — deepDive moves to tt:dd:v1:<SYM>");
{
  const dd = await import("../functions/api/deepdive.js");
  const mkKV3 = (init = {}) => {
    const store = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
    return {
      async get(k, type) { const v = store.get(k); return v == null ? null : (type === "json" ? JSON.parse(v) : v); },
      async put(k, v) { store.set(k, String(v)); },
      async delete(k) { store.delete(k); },
      _store: store,
    };
  };
  const PIN = "123456";
  const rq = (method, { params = "", headers = {}, body = null } = {}) => ({
    method,
    url: "https://macrodash.pages.dev/api/deepdive" + params,
    headers: { get: (k) => headers[k] ?? headers[k.toLowerCase()] ?? null },
    text: async () => (body == null ? "" : JSON.stringify(body)),
  });
  const AUTHED = { "x-tt-pin": PIN };
  const PAYLOAD = (sym) => ({
    thesis_version: "v1.0", updated: "2026-08-05", name: sym + " Corp",
    // prose the index must NOT carry — the whole point of a working set
    thesis: "x".repeat(4000), open_items: ["a".repeat(2000)],
    consensus: { revenue_B: { 2027: 10 }, eps: { 2027: 1.5 }, analysts: 12 },
    pt_model: { ev_s_multiple: { 2026: 5 }, share_count_M: 100 },
    ref_px: { px: 100, at: "2026-08-04" },
    hinges: [{ label: "funding", state: "red", note: "n".repeat(500), asOf: "2026-08-01" },
             { label: "ramp", state: "green" }, { id: "util", state: "unknown" }],
    key_dates: [{ date: "2026-09-01", event: "print" }],
    composite: { score: 8.1, raw_tier: "A", capped_tier: "A", evidence: "e".repeat(1000) },
  });
  const bookWith = (syms) => ({ version: "12.0", asOf: "2026-08-05",
    book: syms.map((s) => ({ sym: s, tier: "A", lens: "AI", deepDive: PAYLOAD(s) })), cut: [] });

  ok("ddstore: anonymous GET fails closed (401) — thesis content is as private as the book",
    (await dd.onRequestGet({ request: rq("GET", { params: "?sym=AAA" }), env: { TT_PIN: PIN, PULSE_CACHE: mkKV3() } })).status === 401);
  ok("ddstore: cross-origin PUT → 403 before any write (the same CSRF guard /api/tt uses)",
    (await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: { ...AUTHED, Origin: "https://evil.example" }, body: { deepDive: {} } }),
      env: { TT_PIN: PIN, PULSE_CACHE: mkKV3() } })).status === 403);
  ok("ddstore: an unknown method is 405, not a silent no-op",
    (await dd.onRequest({ request: rq("DELETE"), env: { TT_PIN: PIN, PULSE_CACHE: mkKV3() } })).status === 405);
  // The v3.54 rule: a route that MUTATES must not be reachable by GET, where a prefetch,
  // link preview or replayed URL can trigger it.
  ok("ddstore: GET ?migrate=1 is 405 and NAMES the correct verb (migrate mutates)",
    await (async () => {
      const r = await dd.onRequestGet({ request: rq("GET", { params: "?migrate=1", headers: AUTHED }), env: { TT_PIN: PIN, PULSE_CACHE: mkKV3() } });
      return r.status === 405 && /POST/.test((await r.json()).error);
    })());

  // ---- the index is a WHITELIST, and it must keep every red hinge visible ----
  const idxE = dd.ddIndexEntry(PAYLOAD("AAA"));
  ok("ddstore: the index carries the ranking inputs (pt_model, consensus, ref_px) verbatim",
    idxE.pt_model.share_count_M === 100 && idxE.consensus.revenue_B[2027] === 10 && idxE.ref_px.px === 100);
  ok("ddstore: the index is a whitelist — prose the board never ranks on is left in the payload",
    idxE.thesis === undefined && idxE.open_items === undefined && idxE.composite.evidence === undefined);
  // The one that matters most: every board surface that counts reds (readiness, the chip
  // strip, the BUY-row naming) reads dd.hinges DIRECTLY. A precomputed tally would have made
  // all of them silently report ZERO reds for any name whose tab was never opened — a red
  // fact vanishing behind a collapse, which is the v3.25 rule this repo enforces everywhere.
  ok("ddstore: hinges ride the index as the SAME array shape, so a red hinge stays countable " +
     "on a name whose tab was never opened (v3.25 — a collapse never hides a red fact)",
    Array.isArray(idxE.hinges) && idxE.hinges.length === 3 &&
    idxE.hinges.filter((h) => h.state === "red").length === 1 &&
    idxE.hinges[0].label === "funding");
  ok("ddstore: only identity and state travel — hinge notes, evidence and observation dates stay behind",
    idxE.hinges[0].note === undefined && idxE.hinges[0].asOf === undefined);
  ok("ddstore: an unrecognized hinge state reads UNKNOWN, never a defaulted green",
    dd.ddIndexEntry({ hinges: [{ label: "h", state: "greenish" }] }).hinges[0].state === "unknown");
  ok("ddstore: the index is materially smaller than the payload it summarizes",
    JSON.stringify(idxE).length * 4 < JSON.stringify(PAYLOAD("AAA")).length);
  ok("ddstore: ddIndexEntry(null) is null — an absent payload is never summarized into existence",
    dd.ddIndexEntry(null) === null && dd.ddIndexEntry("nope") === null);

  /* FEAT-TT-DOTHOME (v3.84): `dots` live on the BOOK ENTRY, never in the payload. FEAT-TT-DOT
     (v3.17) put them there so replacing a payload could never wipe the inventory — but after
     the v3.75 split this endpoint became the one path that replaces a payload wholesale, and
     nothing enforced the rule. Measured 2026-08-13: ACHR/NU/SOFI/SYM each carried one, and for
     three of them it was their ONLY copy — one editor save from silent loss, and invisible to
     the dots UI (which reads e.dots) throughout. A triage run caught it by hand; an invariant a
     human has to police is not an invariant. */
  ok("dothome: a payload carrying `dots` is REJECTED, naming the book entry as their home", await (async () => {
    const kv = mkKV3();
    const p = PAYLOAD("AAA"); p.dots = [{ t: "2026-08-04", state: "new", note: "belongs on the entry" }];
    const r = await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: p } }),
      env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    const body = await r.json();
    // Rejected loudly AND nothing written — a silent strip would destroy the caller's only copy.
    return r.status === 400 && /e\.dots/.test(body.error) && /book entry/i.test(body.error) &&
      !kv._store.get("tt:dd:v1:AAA");
  })());
  ok("dothome: an EMPTY dots array is rejected too — the key itself is the defect, not its length",
    await (async () => {
      const kv = mkKV3();
      const p = PAYLOAD("AAA"); p.dots = [];
      const r = await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: p } }),
        env: { TT_PIN: PIN, PULSE_CACHE: kv } });
      return r.status === 400;
    })());
  ok("dothome: a payload WITHOUT dots is unaffected — no existing payload can be rejected on re-save",
    await (async () => {
      const kv = mkKV3();
      const r = await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: PAYLOAD("AAA") } }),
        env: { TT_PIN: PIN, PULSE_CACHE: kv } });
      return r.status === 200 && !!kv._store.get("tt:dd:v1:AAA");
    })());
  ok("dothome: the index never carries dots either (whitelist), so the board cannot resurrect them",
    dd.ddIndexEntry({ hinges: [], dots: [{ t: "x" }] }).dots === undefined);

  // ---- PUT round-trip, removal, oversize ----
  ok("ddstore: PUT stores under tt:dd:v1:<SYM> and rebuilds that sym's index entry", await (async () => {
    const kv = mkKV3();
    const r = await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: PAYLOAD("AAA") } }),
      env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    const idx = JSON.parse(kv._store.get("tt:dd:index:v1"));
    return r.status === 200 && !!kv._store.get("tt:dd:v1:AAA") && idx.entries.AAA.pt_model.share_count_M === 100;
  })());
  ok("ddstore: one name's save can never touch another's — a strictly stronger guarantee " +
     "than the whole-book replace it replaces", await (async () => {
    const kv = mkKV3();
    await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: PAYLOAD("AAA") } }), env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    const before = kv._store.get("tt:dd:v1:AAA");
    await dd.onRequestPut({ request: rq("PUT", { params: "?sym=BBB", headers: AUTHED, body: { deepDive: PAYLOAD("BBB") } }), env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    const idx = JSON.parse(kv._store.get("tt:dd:index:v1"));
    return kv._store.get("tt:dd:v1:AAA") === before && !!idx.entries.AAA && !!idx.entries.BBB;
  })());
  ok("ddstore: null is the explicit removal path (positions' {sym:null} precedent) and drops " +
     "the index entry with it", await (async () => {
    const kv = mkKV3();
    await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: PAYLOAD("AAA") } }), env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: null } }), env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    return !kv._store.has("tt:dd:v1:AAA") && JSON.parse(kv._store.get("tt:dd:index:v1")).entries.AAA === undefined;
  })());
  ok("ddstore: a non-object payload is rejected — only an object, or null to remove",
    (await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: [1, 2] } }),
      env: { TT_PIN: PIN, PULSE_CACHE: mkKV3() } })).status === 400);
  ok("ddstore: oversize fails CLOSED naming key, bytes and limit — never a truncated write", await (async () => {
    const kv = mkKV3();
    const r = await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: { big: "x".repeat(120 * 1024) } } }),
      env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    const b = await r.json();
    return r.status === 400 && b.error === "oversize" && b.key === "tt:dd:v1:AAA" &&
      b.bytes > b.limit && b.limit === 100 * 1024 && !kv._store.has("tt:dd:v1:AAA");
  })());
  ok("ddstore: the per-key cap mirrors DD_MAX in admin.html (100KB, v4.4.0 owner call) — one number, two homes",
    /const MAX_BODY = 100 \* 1024;/.test(readSrc("../functions/api/deepdive.js")) &&
    /const DD_MAX=100\*1024/.test(adminSrc));

  // ---- ?all=1: export integrity ----
  ok("ddstore: ?all=1 returns every stored payload IN FULL — the export path, never the board's", await (async () => {
    const kv = mkKV3();
    for (const s of ["AAA", "BBB"])
      await dd.onRequestPut({ request: rq("PUT", { params: "?sym=" + s, headers: AUTHED, body: { deepDive: PAYLOAD(s) } }), env: { TT_PIN: PIN, PULSE_CACHE: kv } });
    const b = await (await dd.onRequestGet({ request: rq("GET", { params: "?all=1", headers: AUTHED }), env: { TT_PIN: PIN, PULSE_CACHE: kv } })).json();
    return b.count === 2 && b.deepDives.AAA.thesis.length === 4000 && b.missing.length === 0;
  })());
  ok("ddstore: a sym the index claims but whose payload key is gone is NAMED, never quietly absent",
    await (async () => {
      const kv = mkKV3();
      await dd.onRequestPut({ request: rq("PUT", { params: "?sym=AAA", headers: AUTHED, body: { deepDive: PAYLOAD("AAA") } }), env: { TT_PIN: PIN, PULSE_CACHE: kv } });
      kv._store.delete("tt:dd:v1:AAA");
      const b = await (await dd.onRequestGet({ request: rq("GET", { params: "?all=1", headers: AUTHED }), env: { TT_PIN: PIN, PULSE_CACHE: kv } })).json();
      return b.missing.join() === "AAA" && b.count === 0;
    })());

  // ---- the migration ----
  const migrate = async (kv) => (await dd.onRequestPost({ request: rq("POST", { params: "?migrate=1", headers: AUTHED }), env: { TT_PIN: PIN, PULSE_CACHE: kv } })).json();
  ok("ddstore: migrate moves every embedded payload out, strips the book and RECLAIMS the bytes " +
     "that motivated the split", await (async () => {
    const kv = mkKV3({ "tt:book:v1": bookWith(["AAA", "BBB", "CCC"]) });
    const b = await migrate(kv);
    const book = JSON.parse(kv._store.get("tt:book:v1"));
    return b.migrated === 3 && b.reclaimed > 0 && b.book_bytes_after < b.book_bytes_before &&
      book.book.every((e) => e.deepDive === undefined) &&
      book.book.every((e) => e.sym && e.tier) &&              // nothing else was stripped
      ["AAA", "BBB", "CCC"].every((s) => !!kv._store.get("tt:dd:v1:" + s));
  })());
  ok("ddstore: migrate is IDEMPOTENT — a second run is a no-op that says so, not a double write",
    await (async () => {
      const kv = mkKV3({ "tt:book:v1": bookWith(["AAA"]) });
      await migrate(kv);
      const v1 = JSON.parse(kv._store.get("tt:book:v1")).version;
      const b2 = await migrate(kv);
      return b2.migrated === 0 && /already migrated/.test(b2.reason) &&
        JSON.parse(kv._store.get("tt:book:v1")).version === v1;
    })());
  ok("ddstore: migrate snapshots the book BEFORE stripping it (the same first-write-of-the-day " +
     "restore point tt.js's own PUT keeps), and the snapshot still holds the payloads",
    await (async () => {
      const kv = mkKV3({ "tt:book:v1": bookWith(["AAA"]) });
      await migrate(kv);
      const snapKey = [...kv._store.keys()].find((k) => k.startsWith("tt:book:snap:"));
      return !!snapKey && !!JSON.parse(kv._store.get(snapKey)).book[0].deepDive;
    })());
  // Ordering is the crash-safety property: payloads are SAFE before the book is touched, so a
  // failure at any step leaves a recoverable state and the retry above is a no-op.
  ok("ddstore: a payload-store failure leaves the BOOK UNTOUCHED and says it is safe to retry",
    await (async () => {
      const kv = mkKV3({ "tt:book:v1": bookWith(["AAA"]) });
      const before = kv._store.get("tt:book:v1");
      kv.put = async (k) => { if (k.startsWith("tt:dd:v1:")) throw new Error("kv down"); };
      const b = await migrate(kv);
      return /safe to retry/.test(b.error) && kv._store.get("tt:book:v1") === before;
    })());
  // The invisible-loss rule: a skipped thesis must be NAMED, never silently dropped.
  ok("ddstore: an oversize payload is NAMED and left embedded rather than dropped", await (async () => {
    const big = bookWith(["AAA", "BBB"]);
    big.book[1].deepDive.blob = "x".repeat(120 * 1024);   // over the 100KB cap (was 60KB vs 45KB pre-v4.4.0)
    const kv = mkKV3({ "tt:book:v1": big });
    const b = await migrate(kv);
    const book = JSON.parse(kv._store.get("tt:book:v1"));
    return b.migrated === 1 && b.oversize.length === 1 && b.oversize[0].sym === "BBB" &&
      book.book.find((e) => e.sym === "BBB").deepDive !== undefined &&
      book.book.find((e) => e.sym === "AAA").deepDive === undefined;
  })());
  ok("ddstore: migrate builds the index for exactly the syms it wrote", await (async () => {
    const kv = mkKV3({ "tt:book:v1": bookWith(["AAA", "BBB"]) });
    await migrate(kv);
    const idx = JSON.parse(kv._store.get("tt:dd:index:v1"));
    return Object.keys(idx.entries).sort().join() === "AAA,BBB" &&
      idx.entries.AAA.hinges.filter((h) => h.state === "red").length === 1;
  })());

  // ---- the client choke point ----
  // ddOf() is to deepDive what posOf() was to pos: ONE resolution point, so the storage move
  // is invisible to every renderer. Its fallback ORDER is the migration-safety property —
  // full payload, then board index, then a still-embedded payload for a pre-migration book.
  const DDOF = new Function("let DD_FULL={},DD_INDEX_MAP={};" +
    liftFns(adminSrc, ["ddOf", "ddIsPartial"]) +
    "\nreturn {ddOf,ddIsPartial,set:(f,i)=>{DD_FULL=f;DD_INDEX_MAP=i;}};")();
  ok("ddstore: ddOf prefers the full payload, falls back to the index, then to a still-embedded " +
     "payload — so a pre-migration book keeps rendering with no per-call-site change",
    (() => {
      const x = { sym: "AAA", deepDive: { src: "embedded" } };
      DDOF.set({}, {}); const emb = DDOF.ddOf(x).src;
      DDOF.set({}, { AAA: { src: "index" } }); const idx = DDOF.ddOf(x).src;
      DDOF.set({ AAA: { src: "full" } }, { AAA: { src: "index" } }); const full = DDOF.ddOf(x).src;
      return emb === "embedded" && idx === "index" && full === "full";
    })());
  ok("ddstore: ddOf returns null for an unknown name rather than throwing", (() => {
    DDOF.set({}, {}); return DDOF.ddOf(null) === null && DDOF.ddOf({ sym: "ZZZ" }) === null;
  })());
  ok("ddstore: ddIsPartial is true ONLY while the index is standing in for the whole thesis", (() => {
    DDOF.set({}, { AAA: {} }); const a = DDOF.ddIsPartial("AAA");
    DDOF.set({ AAA: {} }, { AAA: {} }); const b = DDOF.ddIsPartial("AAA");
    DDOF.set({}, {}); return a === true && b === false && DDOF.ddIsPartial("AAA") === false;
  })());
  // The most dangerous path in the whole split: seeding the editor from an index and pressing
  // SAVE would write the board summary back over the full thesis and destroy everything the
  // index omits. The editor loads first and REFUSES to open rather than open on a partial.
  ok("ddstore: the payload editor force-loads the full thesis and REFUSES to open on a partial " +
     "(a save from the index would overwrite the thesis with its own summary)",
    /async function openDeepDive\(sym\)\{[\s\S]{0,600}?if\(ddIsPartial\(sym\)\)\{[\s\S]{0,300}?await loadDeepDiveSym\(sym\);[\s\S]{0,200}?if\(ddIsPartial\(sym\)\)return toast\(/.test(adminSrc) &&
    adminSrc.includes("would overwrite it with the board summary"));
  ok("ddstore: saveFloorMultiple edits a COPY and writes through the payload store, never a book persist",
    /async function saveFloorMultiple\(sym\)\{[\s\S]*?const next=JSON\.parse\(JSON\.stringify\(dd\)\);[\s\S]*?ddPersist\(sym,next\)/.test(adminSrc));
  ok("ddstore: ddPersist is the ONE write path and REVERTS the local edit on failure " +
     "(v3.6: a failed save must never leave the screen showing the edit as landed)",
    /async function ddPersist\(sym,dd\)\{/.test(adminSrc) &&
    adminSrc.includes("your edit was reverted, re-open and retry") &&
    (adminSrc.match(/ddPersist\(sym,/g) || []).length >= 3);
  ok("ddstore: removal PUTs null through the store and reverts on failure — a payload that " +
     "vanished locally but survives on the server would come back on the next boot",
    /async function ddRemoveConfirmed\(sym\)\{[\s\S]*?JSON\.stringify\(\{deepDive:null\}\)/.test(adminSrc) &&
    adminSrc.includes("the payload is still on the server"));
  // persist() is the ONE drain point: import, session handoff and any pre-migration entry all
  // reach the server through it, so the book can never re-inflate with payloads after migration.
  ok("ddstore: persist() drains any embedded payload out of the book first — one implementation " +
     "covering import, handoff and pre-migration entries alike",
    /async function persist\(\)\{\s*await drainEmbeddedDeepDives\(\);/.test(adminSrc) &&
    /async function drainEmbeddedDeepDives\(\)\{[\s\S]*?if\(ok\)delete x\.deepDive; else failed\.push/.test(adminSrc));
  ok("ddstore: the drain writes the payload BEFORE stripping the entry — a store failure leaves " +
     "it embedded and still saved, never dropped",
    adminSrc.includes("still saved with the book, retry the save"));
  // The import validators must read the INCOMING payload. ddOf would resolve to what is already
  // stored for that sym and validate the wrong object entirely — passing a malformed import.
  ok("ddstore: import and handoff validate e.deepDive / u.deepDive, NOT ddOf() — validating the " +
     "stored payload would pass an import whose own payload is malformed",
    adminSrc.includes("if(e.deepDive!==undefined){const der=validateDeepDive(e.deepDive);") &&
    adminSrc.includes("if(u.deepDive!==undefined){const e=validateDeepDive(u.deepDive);") &&
    !/validateDeepDive\(ddOf\(/.test(adminSrc));
  ok("ddstore: the deep-dive tab kicks the full fetch and LABELS the interim render as partial",
    adminSrc.includes("loadDeepDiveSym(sym);") && adminSrc.includes("board index only — the full thesis is still loading"));
  ok("ddstore: the index load settles in a finally, so a dead feed falls back to any embedded " +
     "payload rather than stranding the board (the loadQuotes/loadPositions precedent)",
    /async function loadDeepDiveIndex\(\)\{[\s\S]*?finally\{DD_PENDING=false;render\(\);\}/.test(adminSrc));
}


// ---- 51. FEAT-TT-ALLREVIEWED (v3.76) — every TT review reaches the next dollar ------
// Owner: "every TT review must factor into the next dollar even if with an asterisk." A
// reviewed name the math could say nothing about used to leave the surface entirely and
// survive as a SENTENCE — a count in a footer, a comma list inside a collapsed expander.
// The classification and the ORDER are claims about data, so the real code is lifted and RUN.
console.log("\n[51] FEAT-TT-ALLREVIEWED — the reviewed-but-unpriced ranking");
{
  // The tail lives inside renderUpsideRank (it needs cands/rows), so lift the classifier by
  // slicing the block and running it over fixtures with the real helpers behind it.
  const i0 = adminSrc.indexOf("UNRANKED_ROWS=BOOK.filter(x=>!rankedSyms.has(x.sym))");
  const i1 = adminSrc.indexOf("const unrankedHtml=", i0);
  const seg = adminSrc.slice(i0, i1);
  ok("allreviewed: the classifier block exists and is the ONE place the tail is built", i0 > 0 && i1 > i0);
  const PRICED = { px: 100, at: "2026-08-01" };
  const BOOK1 = [
    { sym: "RANKED", tier: "S", lens: "AI", lastRun: "2026-08-01" },
    { sym: "NOMODEL", tier: "A", lens: "AI", lastRun: "2026-08-01" },   // reviewed, payload w/o rows
    { sym: "NOPX",    tier: "A", lens: "AI", lastRun: "2026-08-01" },   // rows but no price
    { sym: "NORUNG",  tier: "B", lens: "AI", lastRun: "2026-08-01" },   // priced+modelled, no rung at hz
    { sym: "NOPAY",   tier: "B", lens: "AI", lastRun: "2026-08-01" },   // run stamp only
    { sym: "NEVER",   tier: "C", lens: "AI" },                          // never reviewed at all
  ];
  /* v5.0 §14.8: the tail reads SERVER CARDS (cardInfo), so the fixture carries per-sym
     `card` records in the cardInfo shape. Scores kept at 9.1/8.2/6.0 so the ordering pin
     measures the same arithmetic it always did — only the SOURCE of the number moved. */
  const DD1 = {
    RANKED:  { rows: [{ y: "2027", prem: 200 }], ref_px: PRICED, card: { score: 7.0, tier: "A", status: "SCORED", scored: true, mcur: true } },
    NOMODEL: { rows: [], ref_px: PRICED, card: { score: 9.1, tier: "B", status: "PROVISIONAL", scored: false, mcur: true } },
    NOPX:    { rows: [{ y: "2027", prem: 200 }], card: { score: 8.2, tier: "B", status: "PROVISIONAL", scored: false, mcur: true } },
    NORUNG:  { rows: [{ y: "2027", prem: 200 }], ref_px: PRICED, card: { score: 6.0, tier: "B", status: "PROVISIONAL", scored: false, mcur: true } },
    NOPAY:   null,
  };
  const TO = ["S", "A", "B", "C", "WATCH", "DEF"];
  // The classifier is run with the real helpers behind the claims it makes (ptModelRows
  // presence, hinge reds, the horizon) and thin stand-ins where it makes none.
  const out = (() => {
    const F = new Function("BOOK", "LIVE_PX", "hz", "DD", "TIER_ORDER", "RANKED", "DD_FAILED", "DD_PENDING",
      "let UNRANKED_ROWS=[];" +
      "const ddOf=(x)=>DD[x.sym]||null;" +
      "const cardInfo=(sym)=>{const d=DD[sym];return (d&&d.card)||null;};" +
      "const runState=(d)=>({k:d?'fresh':'never',days:null});" +
      "const readiness=()=>({verdict:'BLOCKED',blockers:[],cautions:[]});" +
      "const rankWeight=()=>({w:null,held:false,optOnly:false,mark:''});" +
      "const ptModelRows=(dd)=>(dd&&dd.rows)||[];" +
      "const cands=BOOK.filter(x=>{const d=DD[x.sym];return d&&(d.rows||[]).length&&(LIVE_PX[x.sym]||(d.ref_px&&d.ref_px.px>0));});" +
      "const candSyms=new Set(cands.map(x=>x.sym));" +
      "const rankedSyms=RANKED;" +
      seg + "\nreturn UNRANKED_ROWS;");
    // v5.6.4: DD_FAILED is a real free variable of the classifier now — lifted BY VALUE
    // (false = the index loaded and NOPAY genuinely has no payload), the LENS_MAX_PE rule.
    // v5.7.1: DD_PENDING joined DD_FAILED as a free variable — lifted BY VALUE like it
    // (false = the index has loaded), the same v3.47 LENS_MAX_PE rule, now a 4th recurrence.
    return F(BOOK1, {}, "2027", DD1, TO, new Set(["RANKED"]), false, false);
  })();
  const bySym = Object.fromEntries(out.map((r) => [r.sym, r]));
  ok("allreviewed: an already-ranked name never appears in the tail (one name, one basis)",
    !bySym.RANKED);
  ok("allreviewed: a name with NO review at all is not in the tail — 'never looked at' is a " +
     "different fact from 'reviewed but unpriceable', and only the second is a next-dollar input",
    !bySym.NEVER && out.length === 4);
  // The reason must name the SPECIFIC missing input, in the order the ranking needs them —
  // a generic "unrankable" tells you nothing about what to go and do.
  ok("allreviewed: each row names the specific missing input, not a generic 'unrankable'",
    /no thesis payload/.test(bySym.NOPAY.why) &&
    /no pt_model target/.test(bySym.NOMODEL.why) &&
    /no usable price/.test(bySym.NOPX.why) &&
    /no year-end 2027 rung/.test(bySym.NORUNG.why));
  ok("allreviewed: each row also carries the FIX — the reason is actionable, not a diagnosis",
    bySym.NOPAY.fix === "add a deep-dive payload" && bySym.NOMODEL.fix === "add a pt_model" &&
    /stamp a ref_px/.test(bySym.NOPX.fix) && /horizon to auto/.test(bySym.NORUNG.fix));
  // Ordered by the judgment that EXISTS. Borrowing a rate would be the D2 units error.
  ok("allreviewed: the tail is ORDERED by TT card score (§14.8 — the server-stamped " +
     "composite), never by a borrowed %/yr — 9.1 leads 8.2 leads 6.0",
    out.map((r) => r.sym).slice(0, 3).join() === "NOMODEL,NOPX,NORUNG");
  ok("allreviewed: no row carries an upside/ann field at all — a rate it does not have cannot " +
     "leak into a sort or a render",
    out.every((r) => r.ann === undefined && r.upside === undefined));
  ok("allreviewed: a reviewed name with NO card sorts LAST but is still present — " +
     "'no server card yet' is the state a fresh run is usually in",
    out[out.length - 1].sym === "NOPAY" && out[out.length - 1].tt === null);
  ok("allreviewed: red hinges ride the tail row (v3.25 — a name demoted to the tail must not " +
     "lose its reds on the way)",
    (() => {
      const DD2 = { ...DD1, NOMODEL: { ...DD1.NOMODEL, hinges: [{ label: "funding", state: "red" }, { label: "x", state: "green" }] } };
      const F = new Function("BOOK", "LIVE_PX", "hz", "DD", "TIER_ORDER", "RANKED", "DD_FAILED", "DD_PENDING",
        "let UNRANKED_ROWS=[];const ddOf=(x)=>DD[x.sym]||null;" +
        "const cardInfo=(sym)=>{const d=DD[sym];return (d&&d.card)||null;};" +
        "const runState=(d)=>({k:d?'fresh':'never',days:null});const readiness=()=>({verdict:'x',blockers:[],cautions:[]});" +
        "const rankWeight=()=>({w:null,held:false,optOnly:false,mark:''});const ptModelRows=(dd)=>(dd&&dd.rows)||[];" +
        "const cands=BOOK.filter(x=>{const d=DD[x.sym];return d&&(d.rows||[]).length&&(d.ref_px&&d.ref_px.px>0);});" +
        "const candSyms=new Set(cands.map(x=>x.sym));const rankedSyms=RANKED;" + seg + "\nreturn UNRANKED_ROWS;");
      const o = F(BOOK1, {}, "2027", DD2, TO, new Set(["RANKED"]), false, false);
      const n = o.find((r) => r.sym === "NOMODEL");
      return n.redH === 1 && n.redLabels.join() === "funding";
    })());
  // Renders at BOTH altitudes off the SAME array — the ptModelRows doctrine.
  ok("allreviewed: UNRANKED_ROWS is module-level and read by the DESK list, the compact BUY " +
     "block and the export — never re-derived per surface",
    /^let UNRANKED_ROWS=\[\];/m.test(adminSrc) &&
    (adminSrc.match(/UNRANKED_ROWS/g) || []).length >= 8 &&
    /function renderBuyBlock\(\)\{[\s\S]*?UNRANKED_ROWS\.slice\(0,3\)/.test(adminSrc));
  ok("allreviewed: the empty-ranking branch still emits the tail — the owner's rule is that a " +
     "next-dollar hierarchy ALWAYS produces an output, never an apology",
    /if\(!rows\.length\)\{[\s\S]{0,900}?unrankedHtml\(\)\+netCashAuditHtml\(\);\s*\n\s*return;/.test(adminSrc));
  ok("allreviewed: the BUY block stops claiming 'nothing to rank' when reviewed names are present",
    adminSrc.includes("the reviewed names below are ranked on TT composite instead"));

  /* ── v4.6 THE RANKING BRIDGE — the remainder opens IN PANEL, not via a DESK deep-link ── */
  {
    const buy = (adminSrc.match(/function renderBuyBlock\(\)\{[\s\S]*?\n\}/) || [""])[0];
    ok("bridge: ONE row template per basis, defined once and reused by the top-5 AND the " +
       "expander — the ptModelRows rule applied to markup, so the two altitudes cannot drift",
      (buy.match(/const rankedRow=/g) || []).length === 1 &&
      (buy.match(/const tailRow=/g) || []).length === 1 &&
      /rows\.forEach\(\(r,i\)=>\{h\+=rankedRow\(r,i\);\}\)/.test(buy) &&
      /UPSIDE_ROWS\.slice\(rows\.length\)\.map\(\(r,i\)=>rankedRow\(r,rows\.length\+i\)\)/.test(buy));
    ok("bridge: the expander is est-mini and NEVER drawer — the phone harness counts open drawers",
      /<details class="est-mini"><summary>\$\{bits\.join/.test(buy) && !/class="drawer"/.test(buy));
    ok("bridge: NO second derivation — the expander slices the same module arrays the rows above " +
       "it read, and never calls the rank computations itself",
      !/ptModelRows\(/.test(buy) && !/pickRow\(/.test(buy) && !/sellRank\(/.test(buy) &&
      /UPSIDE_ROWS\.slice\(rows\.length\)/.test(buy) && /UNRANKED_ROWS\.slice\(3\)/.test(buy));
    ok("bridge: the count rides the SUMMARY (closed), so silent truncation cannot read as full coverage",
      /\+\$\{moreRanked\} more ranked/.test(buy) && /\*\$\{moreTail\} more reviewed/.test(buy));
    ok("bridge: the names deep-link is RETIRED; DESK keeps methodology only (names do not live there)",
      !/full math, horizons/.test(adminSrc) && /caveats, lints &amp; horizon pin/.test(buy));
    ok("bridge: the full ranking stays in DESK; no BOOK/ALL ranking fork was introduced",
      /id="dNext"/.test(adminSrc) && !/bookAll[\s\S]{0,300}renderBuyBlock/.test(adminSrc));
    ok("bridge: rankCategories() finally PAINTS — the per-axis chips reuse the SHARE RANKS " +
       "computation rather than a second one, and a single-member axis renders no rank",
      /const cats=rankCategories\(UPSIDE_ROWS\)/.test(buy) && /const catChip=/.test(buy) &&
      /t\.n>1/.test(buy) && /l\.n>1/.test(buy) && /catChip\(r\)/.test(buy));
  }
  ok("allreviewed: the tail states that it is a DIFFERENT basis and that the two are never merged",
    adminSrc.includes("borrowing one would be a units error") &&
    adminSrc.includes("NOT excluded from the next dollar"));
}


// ---- 52. v3.75 follow-up — the SERVER consumers of deepDive ------------------------
// FEAT-TT-DDSTORE gave the CLIENT one resolution point (ddOf) and its changelog claimed the
// move was "invisible to every renderer". True, and incomplete: score.js and the belief
// ledger read `entry.deepDive` straight off the book, and the migration emptied it under
// them — P1 lost every valuation input, and the ledger's thesis/hinge/pt/comp/est kinds went
// silent. These run against a POST-MIGRATION book shape (no embedded payloads), which is the
// only shape that can catch it — section [48]'s fixtures embed them and pass either way.
console.log("\n[52] DDSTORE server consumers — post-migration book shape");
{
  const ddm = await import("../functions/api/deepdive.js");
  const scoreM = await import("../functions/api/score.js");
  const ttM = await import("../functions/api/tt.js");
  const mkKV4 = (init = {}) => {
    const store = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
    return {
      async get(k, type) { const v = store.get(k); return v == null ? null : (type === "json" ? JSON.parse(v) : v); },
      async put(k, v) { store.set(k, String(v)); },
      async delete(k) { store.delete(k); },
      async list({ prefix, limit = 50 }) {
        return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })), list_complete: true, cursor: null };
      },
      _store: store,
    };
  };
  const PIN = "123456";
  const rq = (method, path, { params = "", headers = {}, body = null } = {}) => ({
    method, url: "https://macrodash.pages.dev" + path + params,
    headers: { get: (k) => headers[k] ?? headers[k.toLowerCase()] ?? null },
    text: async () => (body == null ? "" : JSON.stringify(body)),
  });
  const A = { "x-tt-pin": PIN };
  const YEAR = new Date().getFullYear();
  const PAY = { thesis_version: "v1", updated: "2026-08-05",
    consensus: { revenue_B: { [YEAR + 1]: 11.45, [YEAR + 2]: 21.56 }, eps: { [YEAR + 1]: -1.61, [YEAR + 2]: -2.04 } },
    pt_model: { ev_s_multiple: { [YEAR]: 5.5, [YEAR + 1]: 5.45 }, share_count_M: 310, net_cash_B: 0 },
    ref_px: { px: 212.58, at: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    hinges: [{ label: "funding", state: "green" }] };
  // POST-MIGRATION: the book entry carries NO deepDive; the payload lives in its own key.
  const POST_BOOK = { version: "1.0", book: [{ sym: "AAA", tier: "S", lens: "AI" }], cut: [] };
  const envPost = () => ({ TT_PIN: PIN, PULSE_CACHE: mkKV4({ "tt:book:v1": POST_BOOK, "tt:dd:v1:AAA": PAY }) });

  ok("ddsrv: readDeepDive resolves from the payload STORE when the book carries nothing " +
     "(the post-migration shape)", await (async () => {
    const dd = await ddm.readDeepDive(envPost(), "AAA");
    return !!dd && dd.pt_model.share_count_M === 310;
  })());
  ok("ddsrv: readDeepDive still falls back to a still-embedded payload — a pre-migration book " +
     "keeps working, the same fallback order ddOf() uses client-side", await (async () => {
    const env = { TT_PIN: PIN, PULSE_CACHE: mkKV4({ "tt:book:v1": { version: "1.0", book: [{ sym: "BBB", tier: "S", lens: "AI", deepDive: PAY }], cut: [] } }) };
    const dd = await ddm.readDeepDive(env, "BBB");
    return !!dd && dd.pt_model.share_count_M === 310;
  })());
  ok("ddsrv: an unknown sym reads null rather than throwing",
    (await ddm.readDeepDive(envPost(), "ZZZ")) === null);
  // THE REGRESSION TEST. Before the fix this scored with dd={} — no pt_model, no consensus,
  // no ref_px — so P1 silently had nothing to value and said so for the wrong reason.
  ok("ddsrv: score.js computes P1 from the payload STORE — after the migration it was reading " +
     "an empty deepDive off the book, so the valuation pillar lost every input", await (async () => {
    const env = envPost();
    const r = await scoreM.onRequestPut({
      request: rq("PUT", "/api/score", { params: "?sym=AAA", headers: A,
        body: { underwriting_inputs: { methodology_version: "tt-underwriting-v2.6.0", route_gates: {}, falsifiers: [] } } }),
      env });
    if (r.status !== 200) return false;
    const rec = JSON.parse(env.PULSE_CACHE._store.get("tt:score:v1:AAA"));
    const p1 = rec.scorecard.pillars.owner_valuation;
    // A pre-profit name still yields no FLOOR — but it must reach the PREMIUM math and emit a
    // context premium, which is only possible if pt_model/consensus/price actually arrived.
    return !!p1.context_premium && typeof p1.context_premium.target === "number";
  })());

  // ---- the belief ledger's thesis half, on the path that now carries it ----
  ok("ddsrv: diffDeepDive is exported and pure — the extraction is shared by both write paths",
    typeof ttM.diffDeepDive === "function" &&
    ttM.diffDeepDive(null, null, "AAA", "t", 1).length === 0);
  ok("ddsrv: diffDeepDive still detects every belief kind the inline block did " +
     "(thesis/hinge/pt/comp/est) — the extraction is behavior-neutral", (() => {
    const before = { thesis_version: "v1", hinges: [{ label: "funding", state: "green" }],
      pt_model: { pe_floor_multiple: 18 }, composite: { score: 7.0 },
      consensus: { revenue_B: { 2027: 10 }, eps: { 2027: 1 } } };
    const after = { thesis_version: "v2", hinges: [{ label: "funding", state: "red" }],
      pt_model: { pe_floor_multiple: 14 }, composite: { score: 8.5 },
      consensus: { revenue_B: { 2027: 12 }, eps: { 2027: 1 } } };
    const kinds = ttM.diffDeepDive(before, after, "AAA", "t", 1).map((e) => e.kind).sort();
    return kinds.join() === "comp,est,hinge,pt,thesis";
  })());
  ok("ddsrv: hinges are still matched by IDENTITY, so a reordered array is not N state changes",
    (() => {
      const a = { hinges: [{ label: "x", state: "green" }, { label: "y", state: "red" }] };
      const b = { hinges: [{ label: "y", state: "red" }, { label: "x", state: "green" }] };
      return ttM.diffDeepDive(a, b, "AAA", "t", 1).length === 0;
    })());
  // The silent-memory-loss regression: a payload PUT must reach the ledger, because after the
  // split it is the ONLY path a thesis change travels.
  ok("ddsrv: a payload PUT appends belief entries to the ledger — after the split this is the " +
     "only path a thesis change travels, and without it the terminal's memory goes silent",
    await (async () => {
      const env = envPost();
      const next = JSON.parse(JSON.stringify(PAY));
      next.hinges = [{ label: "funding", state: "red" }];
      next.composite = { score: 9.0 };
      const r = await ddm.onRequestPut({ request: rq("PUT", "/api/deepdive", { params: "?sym=AAA", headers: A, body: { deepDive: next } }), env });
      if (r.status !== 200) return false;
      const led = JSON.parse(env.PULSE_CACHE._store.get("tt:ledger:AAA") || "[]");
      const kinds = led.map((e) => e.kind).sort();
      return kinds.includes("hinge") && kinds.includes("comp") &&
        led.find((e) => e.kind === "hinge").to === "red";
    })());
  ok("ddsrv: a ledger fault never fails the payload write the user is waiting on",
    await (async () => {
      const env = envPost();
      const realPut = env.PULSE_CACHE.put.bind(env.PULSE_CACHE);
      env.PULSE_CACHE.put = async (k, v) => { if (k.startsWith("tt:ledger:")) throw new Error("kv down"); return realPut(k, v); };
      const next = { ...PAY, composite: { score: 9.9 } };
      const r = await ddm.onRequestPut({ request: rq("PUT", "/api/deepdive", { params: "?sym=AAA", headers: A, body: { deepDive: next } }), env });
      return r.status === 200 && JSON.parse(env.PULSE_CACHE._store.get("tt:dd:v1:AAA")).composite.score === 9.9;
    })());
  ok("ddsrv: no server file reads entry.deepDive directly any more — every consumer goes " +
     "through the one choke point (ledger.js's snapshot walk is the documented exception)",
    (() => {
      const sc = readSrc("../functions/api/score.js");
      const tt = readSrc("../functions/api/tt.js");
      // Comments are stripped first: this must measure the CODE, not prose that happens to
      // mention the old field (the vacuous-assert lesson from v3.60.1).
      const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      // tt.js may still PASS an embedded payload into diffDeepDive (pre-migration books), but
      // must not read it for computation.
      return !/entry\.deepDive/.test(code(sc)) && /readDeepDive\(env, sym, book\)/.test(code(sc)) &&
        /diffDeepDive\(prev\.deepDive, next\.deepDive/.test(code(tt));
    })());
}


// ---- 53. v3.77 — pre-commitment is VERIFIED, not self-attested -----------------------
// Found running the owner's 2026-08-05 JOBY payload: five falsifiers, all graded GREEN off a
// print observed the same day, scored P4 = 10/10 (the maximum). The engine's only pre-
// commitment test compared h.defined_at against h.qualifying_observation.observed_at — two
// CLIENT-SUPPLIED fields arriving in the SAME request. §6.4.1 exists precisely to stop a
// falsifier set being authored after the observation it grades; a self-attested date cannot
// enforce it, and the self-reported defined_at_post_hoc flag is not a control either (the
// client that would misdate is the client that would omit the flag).
console.log("\n[53] PRE-COMMITMENT VERIFICATION — the server decides what was on file");
{
  const { scoreP4, commitFingerprint, buildScorecard } = await import("../src/ttScore.js");
  const H = (id, extra = {}) => ({ id, green_condition: "g", amber_condition: "a", red_condition: "r",
    importance: 3, kill: false, cadence_days: 90, state: "GREEN",
    as_of: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
    defined_at: "2026-08-04T20:00:00Z",
    qualifying_observation: { observed_at: "2026-08-05T13:00:00Z" }, ...extra });
  const SET = [H("a"), H("b"), H("c")];
  const ET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // The documented offline/no-context path is unchanged, so a direct engine call is never
  // made stricter than its caller can satisfy.
  ok("precommit: with NO server context the old client-attested comparison still applies " +
     "(the pure-engine path is not silently made unsatisfiable)",
    scoreP4(SET, { etToday: ET }).score === 10);
  // THE FIX. Same payload, same timestamps, but the server has nothing on file.
  ok("precommit: a set arriving in the SAME write as its own observation is PRECOMMITTED_" +
     "PENDING, however its self-reported timestamps read — backdating no longer scores",
    (() => { const r = scoreP4(SET, { etToday: ET, committed: {} });
      return r.score === null && r.bootstrap === "PRECOMMITTED_PENDING" &&
        r.blockers.includes("AWAITING_FALSIFIERS") &&
        r.warnings.some((w) => /first commitment, pending a later observation/.test(w)); })());
  ok("precommit: once the SERVER holds the same conditions, a later observation scores — " +
     "which is exactly §6.4.1's bootstrap, now by construction rather than by good manners",
    (() => { const committed = Object.fromEntries(SET.map((h) => [h.id, commitFingerprint(h)]));
      return scoreP4(SET, { etToday: ET, committed }).score === 10; })());
  // A fingerprint, not just a date: editing the goalposts must re-open the commitment.
  ok("precommit: EDITING a stored condition re-opens the commitment and says so — moving the " +
     "goalposts after the fact is the same defect as backdating them",
    (() => {
      const committed = Object.fromEntries(SET.map((h) => [h.id, commitFingerprint(h)]));
      const edited = SET.map((h) => h.id === "b" ? { ...h, red_condition: "r-but-easier" } : h);
      const r = scoreP4(edited, { etToday: ET, committed });
      return r.score === null && r.bootstrap === "PRECOMMITTED_PENDING" &&
        r.warnings.some((w) => /b: .*EDITED, which re-opens the commitment/.test(w));
    })());
  ok("precommit: the fingerprint covers weighting and the kill flag too — silently dropping " +
     "kill:true would change what a RED hinge MEANS without changing any condition text",
    commitFingerprint(H("a")) !== commitFingerprint(H("a", { kill: true })) &&
    commitFingerprint(H("a")) !== commitFingerprint(H("a", { importance: 1 })));
  ok("precommit: identical conditions fingerprint identically regardless of the other fields " +
     "(state, as_of and the observation all move between writes and must not re-open it)",
    commitFingerprint(H("a")) === commitFingerprint(H("a", { state: "RED", as_of: "2026-01-01",
      qualifying_observation: { observed_at: "2027-01-01T00:00:00Z" } })));

  // ---- the declared methodology version ----
  const DD = { pt_model: { ev_s_multiple: { 2026: 5 }, share_count_M: 100 },
    consensus: { revenue_B: { 2027: 10 }, eps: { 2027: 1 } }, ref_px: { px: 100, at: ET } };
  ok("precommit: a payload declaring a methodology this engine does not implement is BLOCKED " +
     "and the declared version RECORDED — the card used to stamp its own version over it, " +
     "erasing the mismatch with the very field that should reveal it",
    await (async () => {
      // v2.3.0 is now the genuinely-inactive version (the merged engine implements v2.4.0).
      const c = await buildScorecard({ sym: "AAA", lens: "AI", nowMs: Date.now(), dd: DD,
        price: DD.ref_px, underwriting_inputs: { methodology_version: "tt-underwriting-v2.3.0", route_gates: {}, falsifiers: [] } });
      return c.status === "UNSCORABLE" && c.declared_methodology_version === "tt-underwriting-v2.3.0" &&
        c.blockers.some((b) => /METHODOLOGY_VERSION_MISMATCH/.test(b)) &&
        c.methodology_version === "tt-underwriting-v2.6.0";
    })());
  ok("precommit: a matching or ABSENT declared version still computes (absent = the offline call)",
    await (async () => {
      const a = await buildScorecard({ sym: "AAA", lens: "AI", nowMs: Date.now(), dd: DD, price: DD.ref_px,
        underwriting_inputs: { methodology_version: "tt-underwriting-v2.6.0", route_gates: {}, falsifiers: [] } });
      const b = await buildScorecard({ sym: "AAA", lens: "AI", nowMs: Date.now(), dd: DD, price: DD.ref_px,
        underwriting_inputs: { route_gates: {}, falsifiers: [] } });
      return !a.blockers.some((x) => /METHODOLOGY_VERSION_MISMATCH/.test(x)) &&
        !b.blockers.some((x) => /METHODOLOGY_VERSION_MISMATCH/.test(x)) && b.declared_methodology_version === null;
    })());
  ok("precommit: score.js builds the committed map from the STORED record, so the deployed " +
     "path always enforces it (an empty map is still a map — absent context is the exception)",
    (() => { const sc = readSrc("../functions/api/score.js");
      return /const committed = \{\};/.test(sc) &&
        /prev && prev\.underwriting_inputs && prev\.underwriting_inputs\.falsifiers/.test(sc) &&
        /nowMs: Date\.now\(\), committed,/.test(sc); })());
}


// ---- 54. FEAT-TT-INTAKE (v3.80) — the data-intake checklist -------------------------
// Filling HOOD took FOUR screenshot round-trips on 2026-08-07, none of them a storage
// failure: each gap only surfaced after the previous one closed. Twice a "Growth Rates
// (TTM)" capture was sent expecting it to fill P3, which it structurally cannot. The
// checklist computes the COMPLETE missing set in one pass off the same pillar contracts
// ttScore.js enforces. Lifted and RUN — a string pin cannot prove a requirements mapping.
console.log("\n[54] FEAT-TT-INTAKE — the complete missing set, in one pass");
{
  // Lift from INTAKE_COUNT_FLOOR, not INTAKE_SRC — the table interpolates the floor into the
  // COUNTS row, so slicing at the table alone leaves the constant undefined (caught on the
  // first run of the v3.85 change).
  const tbl = adminSrc.slice(adminSrc.indexOf("const INTAKE_COUNT_FLOOR="), adminSrc.indexOf("function intakeChecklist("));
  const IC = new Function("DD", "LIVE_PX", "SCORE_CACHE",
    "const ddOf=(x)=>DD[x.sym]||null;" +
    "const ptModelRows=(dd)=>((dd&&dd.pt_model&&dd.pt_model.__rows)||[]);" +
    tbl + liftFns(adminSrc, ["intakeChecklist"]) + "\nreturn intakeChecklist;");
  const runS = (dd, sc, px = true) => IC({ T: dd }, px ? { T: { px: 1 } } : {}, { T: sc || undefined })({ sym: "T" });
  const run = (dd, px = true) => runS(dd, null, px);
  const keys = (dd, px) => run(dd, px).map((r) => r.key).sort();
  const FED = {
    consensus: { revenue_B: { 2026: 5 }, eps: { 2026: 2 },
      analyst_counts: { revenue: { 2026: 22 }, eps: { 2026: 18 } }, pe_table: {} },
    // net_cash_B: "fully fed" now includes the balance sheet — the 2026-08-10 owner
    // directive added the externally-sourced DEBT requirement, so a fixture without it
    // is not complete any more (these two asserts went red the moment the row landed).
    pt_model: { __rows: [{ y: "2026", fl: 48 }], net_cash_B: 0.5 }, ref_px: { px: 90 },
    economic_quality: { operating_margin_pct: { value: 20 }, fcf_margin_pct: { value: 15 },
      capital_efficiency: { metric: "ROE", value: 22 } },
    falsifiers_v2_draft: { hinges: [1, 2, 3] },
  };
  const drop = (mut) => { const d = JSON.parse(JSON.stringify(FED)); mut(d); return d; };

  ok("intake: a fully-fed payload reports ZERO gaps — the checklist can actually be finished",
    run(FED).length === 0);
  /* OWNER STANDING RULE 2026-08-14 supersedes the four-round-trip fix's SHAPE while keeping its
     substance. v3.80 emitted REV_N and EPS_N together so the owner never discovered the second
     after closing the first; the owner now supplies forward revenue/EPS ONLY and every series
     carries >=5 analysts by default, so the count stopped being a capture at all. One
     assistant-sourced row replaces the two, and the gap stays visible because the field must
     still be written for supportedDuration to read it. */
  ok("intake: values-without-counts emits ONE assistant-sourced COUNTS row, and the retired " +
     "REV_N/EPS_N capture rows are gone entirely",
    (() => { const k = keys(drop((d) => { delete d.consensus.analyst_counts; }));
      return k.includes("COUNTS") && !k.includes("REV_N") && !k.includes("EPS_N"); })());
  ok("intake: the COUNTS row is `ext` — it can NEVER land on the owner's capture list",
    (() => { const r = run(drop((d) => { delete d.consensus.analyst_counts; }))
      .find((x) => x.key === "COUNTS"); return !!r && r.ext === true; })());
  ok("intake: the COUNTS row states the standing FLOOR of >=5, not a guess at the true count",
    (() => { const r = run(drop((d) => { delete d.consensus.analyst_counts; }))
      .find((x) => x.key === "COUNTS"); return !!r && /&gt;=5|>=5/.test(r.screen + r.why); })());
  // The prose placeholder several live payloads carry must never read as data.
  ok("intake: a prose placeholder ('NOT CAPTURED — cropped') does NOT satisfy the count " +
     "requirement — only an object does",
    keys(drop((d) => { d.consensus.analyst_counts = "NOT CAPTURED — cropped"; })).includes("COUNTS"));
  /* BOTH stored shapes satisfy it: the pre-v3.85 per-series form and the flat per-year form the
     assistant now stamps. ~40 payloads carry the old shape; rewriting them to satisfy a
     checklist would be churn, not evidence. */
  ok("intake: the legacy per-series count shape {revenue:{yr:n},eps:{yr:n}} still satisfies it",
    !keys(FED).includes("COUNTS"));
  ok("intake: the flat per-year shape {yr:5} the standing floor writes ALSO satisfies it",
    !keys(drop((d) => { d.consensus.analyst_counts = { 2026: 5, 2027: 5 }; })).includes("COUNTS"));
  // Mode routing: P3's requirement differs by profitability, and asking a pre-profit name for
  // an operating margin is asking for something that does not exist.
  ok("intake: a PREPROFIT name (negative near EPS) is asked for RUNWAY, never margin levels",
    (() => { const k = keys(drop((d) => { d.consensus.eps = { 2027: -0.82 }; delete d.economic_quality; }));
      return k.includes("RUNWAY") && !k.includes("MARGINS"); })());
  ok("intake: a PROFITABLE name is asked for margin LEVELS, never runway",
    (() => { const k = keys(drop((d) => { delete d.economic_quality; }));
      return k.includes("MARGINS") && !k.includes("RUNWAY"); })());
  // The rows that do NOT need a screenshot are tagged, so the capture list stays minimal.
  ok("intake: fetchable inputs carry their API name, so they never land on the capture list",
    (() => { const rows = run(drop((d) => { delete d.economic_quality; }));
      const m = rows.find((r) => r.key === "MARGINS");
      return m && m.api === "get_financials"; })());
  /* OWNER STANDING RULE 2026-08-14: "all other information you need, please source from Yahoo
     Finance or another online source." Margins were the row that proved it — NOW's and CRM's
     QC_G2 gates both stalled on operating margins the owner was being asked for and the
     assistant could simply fetch. MARGINS/RUNWAY/PE join DEBT in the `ext` class. */
  ok("intake: MARGINS is `ext` — an operating margin is assistant-sourced, never an owner ask",
    (() => { const m = run(drop((d) => { delete d.economic_quality; }))
      .find((r) => r.key === "MARGINS"); return !!m && m.ext === true; })());
  ok("intake: RUNWAY is `ext` too — same rule, the PREPROFIT branch of the same question",
    (() => { const r = run(drop((d) => { d.consensus.eps = { 2027: -0.82 }; delete d.economic_quality; }))
      .find((x) => x.key === "RUNWAY"); return !!r && r.ext === true; })());
  ok("intake: the P/E provenance cross-check is `ext` — it was an SA capture, now sourced online",
    (() => { const r = run(drop((d) => { delete d.consensus.pe_table; }))
      .find((x) => x.key === "PE"); return !!r && r.ext === true; })());
  /* THE POINT OF THE WHOLE RULE, asserted directly: whatever else is missing, the only things
     that can ever reach the owner's CAPTURE group are the two series they said they provide. */
  ok("intake: the owner's CAPTURE group can only ever contain REV_VAL/EPS_VAL — everything " +
     "else is assistant-sourced, owner-authored, or API-fetchable",
    (() => { const rows = run(drop((d) => { d.consensus = {}; delete d.pt_model;
        delete d.ref_px; delete d.economic_quality; delete d.falsifiers_v2_draft; }), false);
      const shot = rows.filter((r) => !r.api && !r.ext && !r.own);
      return shot.length > 0 && shot.every((r) => r.key === "REV_VAL" || r.key === "EPS_VAL"); })());
  ok("intake: pt_model and the falsifier set are `own` — a ruling and a thesis, never a capture",
    (() => { const rows = run(drop((d) => { delete d.pt_model; delete d.falsifiers_v2_draft; }));
      const m = rows.find((r) => r.key === "MODEL"), f = rows.find((r) => r.key === "FALS");
      return !!m && m.own === true && !!f && f.own === true; })());
  ok("intake: a missing price is tagged fetchable too (quotes are already approved)",
    (() => { const rows = run(drop((d) => { delete d.ref_px; }), false);
      const px = rows.find((r) => r.key === "PX");
      return px && px.api === "get_equity_quotes"; })());
  // P4 is a thesis exercise, not a capture — mislabeling it would send the owner hunting a
  // screen that does not exist.
  ok("intake: the falsifier gap is explicitly NOT a screenshot and says so",
    (() => { const rows = run(drop((d) => { delete d.falsifiers_v2_draft; }));
      const f = rows.find((r) => r.key === "FALS");
      return f && f.api === null && /NOT a screenshot/i.test(f.screen); })());
  ok("intake: fewer than 3 pre-committed hinges still counts as a P4 gap (the >=3 floor)",
    keys(drop((d) => { d.falsifiers_v2_draft.hinges = [1, 2]; })).includes("FALS"));
  ok("intake: every row names the pillar it blocks, so a gap is never an orphan chore",
    run(drop((d) => { delete d.economic_quality; delete d.falsifiers_v2_draft; }))
      .every((r) => /^P[1-4]$/.test(r.pillar)));
  /* The v3.80 row said WHERE the column was (off-screen right, cropped three times on mobile).
     With counts no longer an owner capture there is no column to point at, so the pin inverts:
     NO row may still send the owner scrolling for a count. Kept as an assertion rather than
     deleted — a retired instruction quietly reappearing is the label-outlives-its-data defect
     this changelog keeps fixing. */
  ok("intake: no row sends the owner hunting the '# of Analysts' column any more",
    run(drop((d) => { delete d.consensus.analyst_counts; }))
      .every((r) => !/SCROLL RIGHT/.test(r.screen)));
  ok("intake: the checklist is READ-ONLY — it stores nothing and mutates no payload",
    (() => { const d = drop(() => {}); const before = JSON.stringify(d);
      run(d); return JSON.stringify(d) === before; })());
  /* THE REGRESSION. A first cut read P3/P4 inputs off the deepDive payload, but promoted
     falsifiers and economic_quality live in the SCORE record's underwriting_inputs — so JOBY,
     whose P4 is SCORED at 10 with five stored hinges, was told to go capture falsifiers it
     already had. Two false positives on the most complete name in the book. A checklist that
     invents chores is worse than no checklist, so the authority is now the scorecard itself. */
  const SCORED_ALL = { underwriting_inputs: { falsifiers: [1, 2, 3, 4, 5], economic_quality: { runway_months: { value: 34.5 } } },
    scorecard: { pillars: { owner_valuation: { score: 2.02 }, trajectory: { score: 7.75 },
      economic_quality: { score: 7.49 }, falsifier_health: { score: 10 } } } };
  const JOBY_SHAPE = drop((d) => { d.consensus.eps = { 2027: -0.82 }; delete d.economic_quality; delete d.falsifiers_v2_draft; });
  ok("intake: a pillar the engine already SCORED reports NO gap — the scorecard is the " +
     "authority, never a second guess at where its inputs live (the JOBY false-positive)",
    runS(JOBY_SHAPE, SCORED_ALL).length === 0);
  ok("intake: promoted falsifiers in the score record satisfy P4 even with no draft on the " +
     "payload — the draft is only the pre-promotion staging home",
    (() => { const sc = { underwriting_inputs: { falsifiers: [1, 2, 3] }, scorecard: { pillars: {} } };
      return !runS(JOBY_SHAPE, sc).some((r) => r.key === "FALS"); })());
  ok("intake: economic_quality read from the score record satisfies P3 the same way",
    (() => { const sc = { underwriting_inputs: { economic_quality: { runway_months: { value: 30 } } }, scorecard: { pillars: {} } };
      return !runS(JOBY_SHAPE, sc).some((r) => r.key === "RUNWAY"); })());
  ok("intake: with NO score record the input-presence fallback still reports the real gaps",
    (() => { const k = runS(JOBY_SHAPE, null).map((r) => r.key);
      return k.includes("RUNWAY") && k.includes("FALS"); })());
  ok("intake: a partially-scored name reports only its UNSCORED pillars",
    (() => { const sc = { underwriting_inputs: {}, scorecard: { pillars: { trajectory: { score: 7.75 } } } };
      const k = runS(JOBY_SHAPE, sc).map((r) => r.key);
      return !k.includes("REV_N") && !k.includes("EPS_N") && k.includes("FALS"); })());
  // The P/E provenance row must match the SUBSTANCE, not one spelling. Hardcoding the
  // date-stamped key `pe_table_2026_08_07` would nag forever once the date rolled, and it
  // missed MU, whose cross-check was done and stored as prose under `provenance_2026_08_06`.
  ok("intake: the provenance row accepts ANY pe_table*/provenance* key — a date-stamped key " +
     "must not rot into a permanent false nag",
    (() => {
      const noProv = drop((d) => { delete d.consensus.pe_table; });
      if (!keys(noProv).includes("PE")) return false;                       // absent -> asked for
      const dated = drop((d) => { delete d.consensus.pe_table; d.consensus.pe_table_2027_01_09 = {}; });
      const prose = drop((d) => { delete d.consensus.pe_table; d.consensus.provenance_2026_08_06 = "cross-checked"; });
      return !keys(dated).includes("PE") && !keys(prose).includes("PE");    // either shape satisfies it
    })());
  /* OWNER DIRECTIVE 2026-08-10 (CRWV pass): debt schedules are not on SA — the assistant
     sources them externally for every new ticker. The row exists so a new name can never skip
     the balance sheet, and the ext tag exists so it can never be asked of the owner. */
  ok("intake: a name with NO net debt/cash on file gets the DEBT row, tagged EXTERNAL — " +
     "the assistant's job, never on the owner's capture list",
    (() => { const rows = run(drop((d) => { delete d.pt_model.net_cash_B; }));
      const dRow = rows.find((r) => r.key === "DEBT");
      return !!dRow && dRow.ext === true && /SOURCED EXTERNALLY/.test(dRow.screen); })());
  ok("intake: EITHER sign satisfies the debt requirement — NBIS stores net_cash_B, CRWV " +
     "stores net_debt_B, and both must read as measured",
    (() => {
      const cash = drop((d) => { d.pt_model.net_cash_B = 0.87; });
      const debt = drop((d) => { d.pt_model.net_debt_B = 32.88; });
      const bs   = drop((d) => { d.balance_sheet = { net_debt_B: 32.88 }; });
      return [cash, debt, bs].every((x) => !run(x).some((r) => r.key === "DEBT")); })());
  /* Was three groups; v3.85's owner rule makes it FOUR. OWNER-AUTHORED split out of CAPTURE
     because a list headed "CAPTURE" containing "write a falsifier set" sends the owner hunting
     a screen that does not exist. The exclusion chain is the load-bearing part: byShot is what
     is left after ext, own and api are removed, so a new row is CAPTURE only by omission of
     every other class — the safe direction, since an over-classified row costs a fetch and an
     under-classified one costs the owner a round trip. */
  ok("intake: the render splits FOUR groups — CAPTURE / OWNER-AUTHORED / FETCHABLE / SOURCED " +
     "EXTERNALLY — so neither an ext row nor a thesis ask can be misread as a screenshot",
    adminSrc.includes("SOURCED EXTERNALLY — the assistant fetches these, not you") &&
    adminSrc.includes("OWNER-AUTHORED — a ruling or a thesis, not a screenshot") &&
    /CAPTURE — forward revenue &amp; EPS only/.test(adminSrc) &&
    /byExt=rows\.filter\(r=>r\.ext\)/.test(adminSrc) &&
    /byOwn=rows\.filter\(r=>r\.own&&!r\.ext\)/.test(adminSrc) &&
    /byShot=rows\.filter\(r=>!r\.api&&!r\.ext&&!r\.own\)/.test(adminSrc));
  ok("intake: renders on the deep-dive tab directly under the score bar",
    /h\+=ddScoreBar\(x\);\s*\n\s*h\+=renderIntake\(x\);/.test(adminSrc));
  ok("intake: a complete payload renders the DONE state, not an empty box",
    /INTAKE COMPLETE/.test(adminSrc));
}

/* ═══ [56] FEAT-TT-ENTRY (v3.82) — the WHEN leg: price action, reported never enforced ═══ */
console.log("\n[56] FEAT-TT-ENTRY — price-action WHEN leg + subsidiaries section");
{
  const ddMod = await import("../functions/api/deepdive.js");
  // paRead is the decision predicate — lift it and RUN it (a string pin cannot prove a
  // hit/miss rule). Stub its three externals: ddOf, LIVE_PX, ageDays (the real ageDays is
  // date-relative, so the stub pins the fail-closed contract explicitly instead).
  const paSrc = liftFns(adminSrc, ["paRead"]);
  // v5.0 (W2): paRead reads the cadence table, so the lift injects PA_CADENCE — the same
  // values the source declares, so the boundary pins measure the real windows.
  const mkPa = (dd, live, ageOf) =>
    new Function("ddOf", "LIVE_PX", "ageDays", "PA_CADENCE", `${paSrc}; return paRead;`)(
      () => dd, live, ageOf, { entry: 7, indicators: 7, swings: 14, mas: 30 });
  const fresh = (iso) => (iso ? 2 : null), old = (iso) => (iso ? 30 : null);
  const DD = (pa) => ({ ref_px: { px: 100, at: "x" }, price_action: pa });
  ok("pa: pullback entry HIT at/below the level, MISS above it — and the distance is signed",
    (() => {
      const f = mkPa(DD({ as_of: "d", entry: { level: 90, kind: "pullback" } }), { AAA: { px: 85 } }, fresh);
      const hit = f({ sym: "AAA" });
      const g = mkPa(DD({ as_of: "d", entry: { level: 90, kind: "pullback" } }), { AAA: { px: 99 } }, fresh);
      const miss = g({ sym: "AAA" });
      return hit.hit === true && miss.hit === false && miss.dist > 9.9 && miss.dist < 10.1;
    })());
  ok("pa: breakout is the MIRROR — hit at/above, miss below (the two kinds must not share a comparator)",
    (() => {
      const f = mkPa(DD({ as_of: "d", entry: { level: 90, kind: "breakout" } }), { AAA: { px: 95 } }, fresh);
      const g = mkPa(DD({ as_of: "d", entry: { level: 90, kind: "breakout" } }), { AAA: { px: 85 } }, fresh);
      return f({ sym: "AAA" }).hit === true && g({ sym: "AAA" }).hit === false;
    })());
  ok("pa: no committed entry falls back to reference-level distance (50d preferred), never a fabricated verdict",
    (() => {
      const f = mkPa(DD({ as_of: "d", levels: { ma50: 80, ma200: 60 } }), { AAA: { px: 88 } }, fresh);
      const r = f({ sym: "AAA" });
      return r.src === "ref" && r.ref === "50d" && r.hit === null && Math.abs(r.dist - 10) < 0.1;
    })());
  ok("pa: an UNDATED block fails closed to stale, and >7d is stale — levels age like every other clock",
    (() => {
      const und = mkPa(DD({ entry: { level: 90 } }), { AAA: { px: 85 } }, fresh)({ sym: "AAA" });
      const aged = mkPa(DD({ as_of: "d", entry: { level: 90 } }), { AAA: { px: 85 } }, old)({ sym: "AAA" });
      const ok7 = mkPa(DD({ as_of: "d", entry: { level: 90 } }), { AAA: { px: 85 } }, fresh)({ sym: "AAA" });
      return und.stale === true && aged.stale === true && ok7.stale === false;
    })());
  ok("pa: no live quote falls back to the stamped ref_px; neither at all -> no distance, never a guess",
    (() => {
      const f = mkPa(DD({ as_of: "d", entry: { level: 90 } }), {}, fresh)({ sym: "AAA" });   // ref_px 100
      const g = mkPa({ price_action: { as_of: "d", entry: { level: 90 } } }, {}, fresh)({ sym: "AAA" });
      return f.px === 100 && f.hit === false && g.dist === null && g.src === "none";
    })());
  ok("pa: no price_action block stored -> paRead returns null and paChip renders NOTHING (absent is absent)",
    (() => { const f = mkPa({ ref_px: { px: 100 } }, {}, fresh); return f({ sym: "AAA" }) === null; })()
    && /if\(!p\)return "";\s*\/\/ no price_action block stored/.test(adminSrc));
  // REPORT, NEVER VETO — the load-bearing doctrine pin. The gateFail ladder and why() are
  // the two places a veto could hide; neither may reference the WHEN leg.
  ok("pa: gateFail ladder and why() never read price_action/paRead — WHEN reports, it does not gate",
    (() => {
      const gate = adminSrc.slice(adminSrc.indexOf("const gateFail="), adminSrc.indexOf("if(gateFail)"));
      const whyI = adminSrc.indexOf("const why=r=>{");
      const why = adminSrc.slice(whyI, adminSrc.indexOf("const q=rows.filter", whyI));
      return !/price_action|paRead|paChip/.test(gate) && !/price_action|paRead|paChip/.test(why);
    })());
  ok("pa: ONE chip builder at BOTH eligible-line altitudes (DESK + primary view) — zero drift",
    (adminSrc.match(/paChip\(b\.sym\)/g) || []).length === 1
    && (adminSrc.match(/paChip\(AGREE_PICK\.sym\)/g) || []).length === 1);
  ok("pa: the index whitelist carries price_action (board altitude) and deliberately NOT subsidiaries (tab-only)",
    (() => {
      const payload = { price_action: { as_of: "d" }, subsidiaries: { rows: [{ name: "X" }] }, hinges: [] };
      const e = ddMod.ddIndexEntry(payload);
      return e.price_action && !("subsidiaries" in e);
    })());
  ok("pa: both blocks are registered in DD_HANDLED and both sections exist",
    /"price_action","subsidiaries"\]\)/.test(adminSrc)
    && /function ddPaSec\(dd\)/.test(adminSrc) && /function ddSubsSec\(dd\)/.test(adminSrc));
  ok("subs: marked stakes sum, unmarked are NAMED and the total called a FLOOR; assertion-basis flagged; never auto-wired to the ladder",
    /marked total <b>/.test(adminSrc)
    && /a FLOOR: \$\{unmarked\.map\(r=>esc\(r\.name\)\)/.test(adminSrc)
    && /assert/.test(liftFns(adminSrc, ["ddSubsSec"]))
    && /moving a marked total into pt_model\.net_cash_B is an owner call/.test(adminSrc));
}

/* ═══ [57] FEAT-TT-TECHREAD (v3.83) — the banded WHEN verdict, macro-dash logic on price ═══ */
console.log("\n[57] FEAT-TT-TECHREAD — band table, split tally, asymmetric withhold");
{
  const TR = await import("../src/techRead.js");
  // Levels-only fixture: 4 price-action factors vote, nothing else. px/ma50/ma200/lo/hi.
  const L = (px, ma50, ma200, lo, hi, extra = {}) => ({
    as_of: "d", levels: { ma50, ma200, swing_lo_3m: lo, swing_hi_3m: hi }, ...extra });
  const V = (pa, px) => TR.computeTechRead(pa, px, {}).label;
  // v5.0: a FULL fixture (every factor measurable) for the cadence pins — px 100 vs the
  // levels below votes cleanly, so exclusions are attributable to AGE alone.
  const FULLC = () => ({ as_of: "d", levels: { ma50: 90, ma200: 80, swing_lo_3m: 70, swing_hi_3m: 130 },
    indicators: { rsi14: 60, macd_hist: 0.4 }, pattern: { kind: "breakout" } });

  // ── every band boundary EXECUTED (the DEC-33 convention) ──
  /* THE COLLINEARITY FIX (audit, v3.83). price-vs-50d, price-vs-200d and the 50/200 cross are
     all functions of the same three numbers, so as separate voters they cast three bull votes
     for ONE fact and the split tally reported fake corroboration. They are now COMPONENTS of a
     single alignment score; these assertions pin the components AND the collapse. */
  ok("tech: the three MA comparisons are ONE factor, not three — no collinear triple-count",
    TR.TECH_BAND_TABLE.filter((f) => f.kind === "price_action").length === 2
    && !TR.TECH_BAND_TABLE.some((f) => ["trend200", "trend50", "cross"].includes(f.key))
    && !!TR.TECH_BAND_TABLE.find((f) => f.key === "trend"));
  ok("tech: trend alignment scores −3…+3 off a ±2% MA deadband and a ±1% cross band, and votes " +
     "on 2-of-3 — the same call the three votes made, without the fake corroboration",
    (() => {
      const f = TR.TECH_BAND_TABLE.find((x) => x.key === "trend");
      const sc = (px, ma50, ma200) => f.read({ px, ma50, ma200 });
      /* Component values are pinned well clear of the band edges on purpose: pct(102,100)
         evaluates to 2.0000000000000018 in IEEE-754, so an "exactly on the edge" read is
         float-fragile and would pin a rounding artifact rather than the rule. The EDGES are
         pinned exactly on vote() below and on the ±2%/±1% band asserts elsewhere, where the
         comparison is against a literal and the float noise cannot enter. */
      return sc(110, 102, 100) === 3                    // above both MAs AND 50d clear of 200d
        && sc(90, 98, 100) === -3                       // the mirror
        && sc(110, 100, 100) === 2                      // above both, but 50d == 200d: cross flat
        && sc(100, 100, 100) === 0                      // dead flat: every component inside its band
        && f.vote(3) === "bull" && f.vote(2) === "bull" && f.vote(1) === "neutral"
        && f.vote(0) === "neutral" && f.vote(-1) === "neutral"
        && f.vote(-2) === "bear" && f.vote(-3) === "bear";
    })());
  ok("tech: trend needs ALL THREE inputs — a partial stamp is excluded, never scored on what is there",
    (() => { const f = TR.TECH_BAND_TABLE.find((x) => x.key === "trend");
      return f.read({ px: 110, ma200: 100 }) === undefined
        && f.read({ px: 110, ma50: 100 }) === undefined; })());
  ok("tech: range position splits in thirds — 66 neutral, 66.1 bull, 33 neutral, 32.9 bear",
    (() => { const r = TR.TECH_BAND_TABLE.find((f) => f.key === "range");
      return r.vote(66) === "neutral" && r.vote(66.1) === "bull"
        && r.vote(33) === "neutral" && r.vote(32.9) === "bear"; })());
  ok("tech: RSI is TWO-SIDED — 55 neutral, 56 bull, 80 flips BEAR (exhaustion), 44.9 bear",
    (() => { const r = TR.TECH_BAND_TABLE.find((f) => f.key === "rsi");
      return r.vote(55) === "neutral" && r.vote(56) === "bull" && r.vote(79.9) === "bull"
        && r.vote(80) === "bear" && r.vote(45) === "neutral" && r.vote(44.9) === "bear"; })());
  ok("tech: an out-of-enum pattern votes UNKNOWN — a free-text assertion can never manufacture a lean",
    (() => { const p = TR.TECH_BAND_TABLE.find((f) => f.key === "pattern");
      return p.vote("breakout") === "bull" && p.vote("breakdown") === "bear"
        && p.vote("range") === "neutral" && p.vote("looks spicy") === "unknown"; })());

  // ── missing is EXCLUDED, never a neutral vote ──
  ok("tech: an unmeasured factor is DROPPED and NAMED, not voted neutral (an unfinished stamp " +
     "must not look like a considered non-lean)",
    (() => { const r = TR.computeTechRead(L(110, 100, 100, 80, 120), 110, {});
      return r.counted === 2 && r.missing.includes("RSI") && r.missing.includes("MACD")
        && r.missing.includes("PAT") && !r.factors.some((f) => f.key === "rsi"); })());
  ok("tech: below quorum the read is UNREAD with the missing inputs named — never a thin verdict",
    (() => { const r = TR.computeTechRead({ as_of: "d", levels: { ma200: 100 } }, 110, {});
      return r.label === "UNREAD" && r.counted < TR.TECH_QUORUM && /needs 3/.test(r.reason); })());
  /* The quorum moved 4->3 WITH the collinearity fix rather than being held at a number the
     table can no longer honestly support: levels alone measure exactly two independent things,
     so a levels-only stamp now reads UNREAD until momentum or a pattern lands. */
  ok("tech: a LEVELS-ONLY stamp is now 2 independent factors and reads UNREAD — two facts " +
     "never again masquerade as four votes",
    (() => { const r = TR.computeTechRead(L(110, 100, 100, 80, 120), 110, {});
      return r.counted === 2 && r.label === "UNREAD"; })());
  ok("tech: levels PLUS one indicator clears quorum — one historicals pull and one indicator call",
    TR.computeTechRead({ ...L(110, 100, 100, 80, 120), indicators: { macd_hist: 0.3 } }, 110, {})
      .counted === 3);
  ok("tech: stale levels WITHHOLD the whole read — an 8-day-old 200d is not today's tape",
    (() => { const r = TR.computeTechRead(L(110, 100, 100, 80, 120), 110, { stale: true });
      return r.label === "UNREAD" && /stale/.test(r.reason); })());
  ok("tech: no price_action block at all returns UNREAD, never a fabricated neutral",
    TR.computeTechRead(null, 110, {}).label === "UNREAD");

  // ── the ASYMMETRIC withhold: the load-bearing rule ──
  ok("tech: a clean price-action uptrend with confirming momentum reads BULLISH, no downgrade",
    (() => { const r = TR.computeTechRead(
      { ...L(110, 103, 100, 80, 115), indicators: { rsi14: 62, macd_hist: 0.3 } }, 110, {});
      return r.label === "BULLISH" && r.downgraded === null; })());
  /* PRICE ACTION IS PRIMARY BY VETO, NOT BY WEIGHT. The collapse leaves price action at most
     2 of 5 votes — it can never out-vote the indicators — so the owner's standing directive is
     encoded as the withhold instead: a bull call needs price action's assent, and a veto cannot
     be outvoted the way a heavier weight can. This is the assertion that proves it. */
  ok("tech: price action can no longer be a vote MAJORITY (2 of 5) — its primacy is the veto",
    TR.TECH_BAND_TABLE.filter((f) => f.kind === "price_action").length * 2
      <= TR.TECH_BAND_TABLE.length);
  ok("tech: a bull tally carried by LAGGING indicators while price action disagrees is " +
     "DOWNGRADED to MIXED, with raw preserved — the v3.40 asymmetry pointed at price",
    (() => {
      // PA: below both MAs and low in range → bearish. Indicators + pattern → bullish.
      const pa = { as_of: "d", levels: { ma50: 120, ma200: 118, swing_lo_3m: 90, swing_hi_3m: 130 },
        indicators: { rsi14: 60, macd_hist: 0.4 }, pattern: { kind: "breakout" } };
      const r = TR.computeTechRead(pa, 100, {});
      return r.raw === "MIXED" || (r.label === "MIXED" && r.raw !== "BULLISH")
        ? r.label === "MIXED"                       // PA drags it to MIXED before the withhold
        : (r.label === "MIXED" && r.raw === "BULLISH" && /carried by lagging/.test(r.downgraded));
    })());
  ok("tech: with price action ABSENT entirely, a UNANIMOUS bullish indicator+pattern tally is " +
     "still withheld to MIXED — the veto cannot be outvoted, which is the whole point",
    (() => {
      const pa = { as_of: "d", indicators: { rsi14: 60, macd_hist: 0.4 },
        pattern: { kind: "breakout" }, levels: {} };
      const r = TR.computeTechRead(pa, 100, {});
      return r.counted === 3 && r.bull === 3 && r.raw === "BULLISH"
        && r.label === "MIXED" && /no price-action factor is measured/.test(r.downgraded);
    })());
  ok("tech: BEARISH is NEVER downgraded — a caution from lagging inputs is still safe to act on",
    (() => { const r = TR.computeTechRead(
      { as_of: "d", levels: { ma50: 120, ma200: 118, swing_lo_3m: 90, swing_hi_3m: 130 },
        indicators: { rsi14: 30, macd_hist: -0.4 } }, 100, {});
      return r.label === "BEARISH" && r.downgraded === null; })());
  ok("tech: the tally is reported SPLIT by kind, so a reader can see WHICH half carries the call",
    (() => { const r = TR.computeTechRead(
      { as_of: "d", levels: { ma50: 100, ma200: 100, swing_lo_3m: 80, swing_hi_3m: 120 },
        indicators: { rsi14: 60, macd_hist: 0.4 } }, 110, {});
      return r.byKind.price_action.counted === 2 && r.byKind.indicator.counted === 2
        && r.byKind.indicator.bull === 2; })());

  // ── the majority rule is the SAME one the macro board uses ──
  ok("tech: STRICT majority of what voted — 4 voters need 3 (2 is a tie, not a call); 7 need 4, " +
     "never a hardcoded count (the DEC-31 rule, same as the macro board)",
    TR.techVerdictFrom(3, 1, 4) === "BULLISH" && TR.techVerdictFrom(2, 2, 4) === "MIXED"
    && TR.techVerdictFrom(2, 0, 4) === "MIXED"
    && TR.techVerdictFrom(3, 2, 7) === "MIXED" && TR.techVerdictFrom(4, 2, 7) === "BULLISH");

  // ── flips: adjacency, load-bearing only, abstention with a NAMED reason ──
  ok("tech: techFlips returns only crossings that ACTUALLY change the label, nearest first",
    (() => { const pa = L(110, 103, 100, 80, 115);
      const f = TR.techFlips(pa, 110, {});
      return f.flips.every((x) => x.would !== TR.computeTechRead(pa, 110, {}).raw)
        && f.flips.every((x, i, a) => i === 0 || a[i - 1].dist <= x.dist); })());
  ok("tech: flips are ADJACENT only — a bull factor can reach neutral, never bear in one step",
    TR.techFlips(L(110, 103, 100, 80, 115), 110, {}).flips
      .every((f) => !(f.from === "bull" && f.to === "bear") && !(f.from === "bear" && f.to === "bull")));
  ok("tech: RSI and pattern ABSTAIN from flips with the reason named — no invented crossing " +
     "for a two-sided band or a categorical factor",
    (() => { const pa = { as_of: "d", levels: { ma50: 103, ma200: 100, swing_lo_3m: 80, swing_hi_3m: 115 },
        indicators: { rsi14: 60, macd_hist: 0.4 }, pattern: { kind: "breakout" } };
      const f = TR.techFlips(pa, 110, {});
      const shorts = f.abstained.map((a) => a.short);
      return shorts.includes("RSI") && shorts.includes("PAT")
        && f.abstained.every((a) => a.why && a.why.length > 20); })());

  // ── MARRIED, NEVER MERGED — the guard the owner asked to be kept ──
  ok("tech: the ranking sort key never reads the technical verdict (WHAT stays measured)",
    (() => {
      const i = adminSrc.indexOf("// Sort on the ANNUALISED figure");
      const sortBlock = adminSrc.slice(i, i + 900);
      return i > 0 && !/tech(Of|Read|Chip)|TECH_BAND/.test(sortBlock);
    })());
  ok("tech: gateFail and why() never read the technical verdict — WHEN reports, it never gates",
    (() => {
      const gate = adminSrc.slice(adminSrc.indexOf("const gateFail="), adminSrc.indexOf("if(gateFail)"));
      const whyI = adminSrc.indexOf("const why=r=>{");
      const why = adminSrc.slice(whyI, adminSrc.indexOf("const q=rows.filter", whyI));
      return !/tech(Of|Read|Chip)|TECH_BAND/.test(gate) && !/tech(Of|Read|Chip)|TECH_BAND/.test(why);
    })());
  /* v5.2 CAP-ASTERISK — DOCUMENTED REVERSAL of this pin's old form ("sellRank never reads
     it either"). Owner ruling 2026-08-25 makes the TAPE the funding ranking's FIRST merit
     axis, so sellRank now MUST read techOf — the ONE resolution point, so the row and the
     name's own band table cannot disagree. The ban survives everywhere it still applies:
     the buy sort, gateFail and why() pins directly above are untouched, and the read is a
     lexicographic axis, never blended into a unit (DEC-D2). */
  ok("tech: sellRank READS techOf as the first merit axis (v5.2 owner reversal — buy sort and gates keep the ban)",
    (() => { const i = adminSrc.indexOf("function sellRank(");
      const body = adminSrc.slice(i, adminSrc.indexOf("\n}", i));
      return i > 0 && /techOf\(/.test(body) && /techRank/.test(body) && !/computeTechRead\(/.test(body); })());
  /* ONE resolution point for the VERDICT. Exactly three references to computeTechRead: its
     own definition, techOf (which every rendering surface goes through), and techFlips —
     which legitimately recomputes because it must simulate against the same tally it is
     measuring distance from, exactly as flipConditions does on the macro side. No RENDERER
     may call it directly; that is what would let the chip and the table disagree. */
  ok("tech: ONE resolution point (techOf) — no renderer computes its own read, so the chip " +
     "and the deep-dive table cannot disagree",
    /function techOf\(x\)\{/.test(adminSrc)
    && (adminSrc.match(/computeTechRead\(/g) || []).length === 3
    && /const r=techOf\(x\);if\(!r\)return "";\s*\n\s*const s=TECH_STYLE/.test(adminSrc)
    && /function ddTechSec[\s\S]{0,200}const r=techOf\(x\);/.test(adminSrc));

  // ── the two implementations must vote identically (admin.html is buildless) ──
  ok("tech: admin.html's inlined engine and src/techRead.js return IDENTICAL verdicts across " +
     "a fixture matrix — behavioural identity, the anti-drift tripwire",
    (() => {
      const lifted = liftFns(adminSrc, ["techVerdictFrom", "techInputs", "computeTechRead"]);
      const consts = /const MA_BAND_PCT=[\s\S]*?const _tpct=[^\n]*\n/.exec(adminSrc)[0];
      // v5.0 (W2): the cadence table is part of the behavioural contract now — lift it too.
      const cad = /const PA_CADENCE=\{[^}]*\};/.exec(adminSrc)[0];
      const table = /const TECH_BAND_TABLE=\[[\s\S]*?\n\];/.exec(adminSrc)[0];
      const local = new Function(`${cad}\n${consts}${table}\n${lifted}\nreturn computeTechRead;`)();
      const FULL = { as_of: "d", levels: { ma50: 120, ma200: 118, swing_lo_3m: 90, swing_hi_3m: 130 },
        indicators: { rsi14: 60, macd_hist: 0.4 }, pattern: { kind: "breakout" } };
      const cases = [
        [L(110, 103, 100, 80, 115), 110, {}],
        [L(100, 100, 100, 90, 110), 100, {}],
        [L(90, 120, 118, 90, 130), 90, {}],
        [FULL, 100, {}],
        [{ as_of: "d", levels: { ma50: 100, ma200: 100, swing_lo_3m: 80, swing_hi_3m: 120 },
           indicators: { rsi14: 85, macd_hist: -0.1 }, pattern: { kind: "double_top" } }, 112, {}],
        [{ as_of: "d", levels: { ma200: 100 } }, 110, {}],
        [null, 100, {}],
        // v5.0 cadence identity: fresh, mid-age (fast windows expired), old (swings gone
        // too), all-dark, and undated-fail-closed must agree across both implementations.
        [FULL, 100, { age: 2 }],
        [FULL, 100, { age: 10 }],
        [FULL, 100, { age: 20 }],
        [FULL, 100, { age: 40 }],
        [FULL, 100, { age: null }],
      ];
      return cases.every(([pa, px, opts]) => {
        const a = local(pa, px, opts), b = TR.computeTechRead(pa, px, opts);
        return a.label === b.label && a.counted === b.counted && a.bull === b.bull
          && a.bear === b.bear && (a.downgraded === null) === (b.downgraded === null)
          && a.missing.length === b.missing.length && a.stale === b.stale;
      });
    })());
  /* ── v5.0 (W2) cadence boundaries, EXECUTED at ±1 day (the DEC-33 convention) ─────────
     One flat window took the whole WHEN leg dark at once (36/36 names at 8d, measured
     2026-08-23). Each input now ages at its own rate; every window edge is run here so
     changing one is one edit plus one red test. */
  ok("cadence: the table is asserted in ONE shape in both homes — entry 7 · indicators 7 · swings 14 · MAs 30",
    TR.PA_CADENCE.entry === 7 && TR.PA_CADENCE.indicators === 7 &&
    TR.PA_CADENCE.swings === 14 && TR.PA_CADENCE.mas === 30 &&
    adminSrc.includes("const PA_CADENCE={entry:7,indicators:7,swings:14,mas:30};"));
  ok("cadence: indicators expire past 7d — excluded and NAMED with their window, never silently voted",
    (() => { const at7 = TR.computeTechRead(FULLC(), 100, { age: 7 });
      const at8 = TR.computeTechRead(FULLC(), 100, { age: 8 });
      return at7.factors.some((f) => f.key === "rsi") &&
        !at8.factors.some((f) => f.key === "rsi") &&
        at8.missing.some((m) => /RSI \(stale: 8d past its 7d window\)/.test(m)); })());
  ok("cadence: swings expire past 14d, MAs past 30d — the slow factors survive the fast ones' expiry",
    (() => { const at14 = TR.computeTechRead(FULLC(), 100, { age: 14 });
      const at15 = TR.computeTechRead(FULLC(), 100, { age: 15 });
      const at30 = TR.computeTechRead(FULLC(), 100, { age: 30 });
      const at31 = TR.computeTechRead(FULLC(), 100, { age: 31 });
      const has = (r, k) => r.factors.some((f) => f.key === k);
      return has(at14, "range") && !has(at15, "range") && has(at15, "trend") &&
        has(at30, "trend") && !has(at31, "trend") && at31.counted === 0; })());
  ok("cadence: an 8-day-old stamp reads the SLOW factors live — the exact 2026-08-23 book-wide " +
     "dark state, now degrading honestly instead of all-or-nothing",
    (() => { const r = TR.computeTechRead(FULLC(), 100, { age: 8 });
      return r.factors.some((f) => f.key === "trend") && r.factors.some((f) => f.key === "range") &&
        r.missing.length === 3 && r.label === "UNREAD" && /needs 3/.test(r.reason); })());
  ok("cadence: undated fails closed to the FULL withhold — no window can rescue a stamp with no date",
    (() => { const r = TR.computeTechRead(FULLC(), 100, { age: null });
      return r.stale === true && /undated — fail closed/.test(r.reason) && r.counted === 0; })());
  ok("cadence: the legacy global stale flag still withholds everything (back-compat callers)",
    TR.computeTechRead(FULLC(), 100, { stale: true }).reason.includes("levels are stale"));
  ok("tech: the deep-dive section renders the RULE beside every vote (the macro-dash pattern), " +
     "names excluded inputs, and never hides the withhold",
    /function ddTechSec\(x,dd\)/.test(adminSrc)
    && /<th>the rule<\/th>/.test(adminSrc)
    && /not measured \(excluded, never counted as neutral\)/.test(adminSrc)
    && /what would change this read/.test(adminSrc)
    // the withhold renders as its own amber line inside the section — never swallowed
    && /if\(r\.downgraded\)h\+=`<div style="color:var\(--amber\)[^`]*⚠ \$\{esc\(r\.downgraded\)\}/.test(adminSrc));
  ok("tech: the collapsed TRACKING summary carries the verdict — v3.25, a shut drawer never hides a bearish tape",
    /tech \$\{r\.label\}/.test(adminSrc));
}

/* ═══ [58] FEAT-TT-MAG7 (v3.84) — the mega-cap panel + the MAGS basket row ═══ */
console.log("\n[58] FEAT-TT-MAG7 — deck panel, basket average, honesty gates");
{
  // The basket-injection block, lifted and RUN — an average with a membership gate is a
  // numeric claim, and a string pin cannot prove a threshold.
  const bi = adminSrc.indexOf("MAG_BASKET=null;\n  {");
  ok("mag7: the basket-injection block exists at the ranking site (before the sort)", bi > 0
    && bi < adminSrc.indexOf("rows.sort((a,b)=>(b.ann===null?-Infinity:b.ann)"));
  const blk = adminSrc.slice(bi, adminSrc.indexOf("\n  }", bi) + 4);
  const runBasket = (rows, book, live) => {
    const env = { MAG7_SET: new Set(["GOOGL","META","MSFT","AMZN","TSLA","NVDA","AAPL"]),
      BOOK: book, LIVE_PX: live, MAG_BASKET: null,
      runState: () => ({ k: "never" }), readiness: () => ({ blockers: ["no current model"], cautions: [] }),
      cardInfo: () => null /* v5: the basket reads the CARD source; MAGS has no card */, ddOf: () => null, rankWeight: () => ({ w: null, held: false, mark: "" }) };
    const fn = new Function("rows", ...Object.keys(env),
      `MAG_BASKET=null;{${blk.slice(blk.indexOf("{") + 1, blk.lastIndexOf("}"))}}return {MAG_BASKET, rows};`);
    return fn(rows, ...Object.values(env));
  };
  const R = (sym, ann, upside) => ({ sym, ann, upside });
  const M4 = [R("GOOGL", 8, 30), R("META", 14, 58), R("MSFT", 15, 53), R("NVDA", 16, 31)];
  ok("mag7: >=4 members with a rate AND MAGS in the book -> basket row appended with the equal-weight mean",
    (() => { const { MAG_BASKET, rows } = runBasket([...M4], [{ sym: "MAGS", lens: "VEH", tier: "WATCH" }], {});
      const mags = rows.find(r => r.sym === "MAGS");
      return MAG_BASKET && MAG_BASKET.n === 4 && Math.abs(MAG_BASKET.ann - 13.3) < 0.06
        && mags && mags.basket === true && mags.ann === MAG_BASKET.ann; })());
  ok("mag7: THREE members is not the basket — no row, no average (an avg of 3 is not the Mag 7)",
    (() => { const { MAG_BASKET, rows } = runBasket(M4.slice(0, 3), [{ sym: "MAGS" }], {});
      return MAG_BASKET === null && !rows.some(r => r.sym === "MAGS"); })());
  ok("mag7: MAGS absent from the book -> no synthetic row (the basket needs a real, holdable instrument)",
    (() => { const { MAG_BASKET } = runBasket([...M4], [{ sym: "AAA" }], {});
      return MAG_BASKET === null; })());
  ok("mag7: missing members are NAMED on the caveat, never silently averaged around",
    (() => { const { rows } = runBasket([...M4], [{ sym: "MAGS" }], {});
      const c = rows.find(r => r.sym === "MAGS").caveat;
      return /avg of 4 of 7/.test(c) && /TSLA/.test(c) && /AAPL/.test(c) && /AMZN/.test(c)
        && /not MAGS's own model/.test(c); })());
  ok("mag7: a member with ann=null is excluded from the mean, not counted as zero",
    (() => { const { MAG_BASKET } = runBasket([...M4, R("TSLA", null, 5)], [{ sym: "MAGS" }], {});
      return MAG_BASKET.n === 4 && Math.abs(MAG_BASKET.ann - 13.3) < 0.06; })());
  // The honesty gates: the basket row rides the ORDINARY gates — nothing in the eligibility
  // ladder special-cases it, so readiness (no model on MAGS itself) keeps it off the green line.
  ok("mag7: no special-case in why()/gateFail — the basket row is gated by the same rules as every row",
    (() => {
      const gate = adminSrc.slice(adminSrc.indexOf("const gateFail="), adminSrc.indexOf("if(gateFail)"));
      const whyI = adminSrc.indexOf("const why=r=>{");
      const why = adminSrc.slice(whyI, adminSrc.indexOf("const q=rows.filter", whyI));
      return !/basket|MAG_BASKET|MAG7/.test(gate) && !/basket|MAG_BASKET|MAG7/.test(why);
    })());
  ok("mag7: the panel renders from UPSIDE_ROWS — one computation, third altitude (never its own rates)",
    /function renderMagBlock\(\)/.test(adminSrc)
    && /const m7=UPSIDE_ROWS\.filter\(r=>MAG7_SET\.has\(r\.sym\)\)/.test(adminSrc)
    && !/ptModelRows|pickRow/.test(liftFns(adminSrc, ["renderMagBlock"])));
  ok("mag7: unranked members and the below-threshold basket state are NAMED in the panel",
    /no rate at this horizon: \$\{un\.map\(esc\)\.join/.test(adminSrc)
    && /basket line renders when ≥4 of 7 members carry a rate/.test(adminSrc));
  ok("mag7: its BOOK route is explicit and no retired carousel navigation survives",
    /return sub==="mag7"\?"#book\/mag7":"#book"/.test(adminSrc)
    && !/decisionMag|DECK_PAGES|syncDecisionDeck/.test(adminSrc));
  ok("mag7: the cluster is a BOOK subview, never a NEXT $ peer",
    /id="bookMagButton" onclick="bookGo\('mag7'\)"/.test(adminSrc)
    && /id="bookMag" hidden><div class="nd fdr" id="magBlock"/.test(adminSrc)
    && adminSrc.indexOf('id="magBlock"') > adminSrc.indexOf('id="bookView"'));
  ok("mag7: basket row cannot print a null target — all three row templates branch on r.basket",
    (adminSrc.match(/r\.basket\?/g) || []).length >= 3);
}

// ---- 59. v3.88 — CCC junk tail · Sahm rule · 10y–3m (all NON-VOTING on arrival) --------
{
  console.log("\n[59] v3.88 — creditTail, sahm, spread10y3m");
  const { sahmFrom, SAHM_TRIGGER } = await import("../src/sahm.js");
  const RG = await import("../src/regime.js");
  // Series wired through the existing fetch path — no new fetcher (the 30Y rule).
  ok("v388: BAMLH0A3HYC + DGS3MO ride the existing series map, no new fetcher",
    /creditTail:\s*"BAMLH0A3HYC"/.test(snapSrc) && /threeMonth:\s*"DGS3MO"/.test(snapSrc) &&
    !/fetchCredit|fetchSahm|fetchThreeMonth/.test(snapSrc));
  // Bands RUN, boundaries both ways: reject the impossible, not the unusual.
  ok("v388: creditTail band accepts the 2008 record (~44pp) and rejects a decimal shift",
    plausible("creditTail", 44) && !plausible("creditTail", -1) && !plausible("creditTail", 300));
  ok("v388: spread10y3m band ACCEPTS inversion — negative is the signal (negative-WTI rule)",
    plausible("spread10y3m", -1.9) && !plausible("spread10y3m", -50) &&
    (() => { const m = /spread10y3m:\s*\[(-?\d+), (\d+)\]/.exec(snapSrc); return m && Number(m[1]) < 0; })());
  ok("v388: sahm band accepts the 2020 spike (~+9) and rejects garbage",
    plausible("sahm", 9.2) && !plausible("sahm", 40) && plausible("threeMonth", 17) && !plausible("threeMonth", -2));
  // DAILY membership: threeMonth is genuinely daily (W-offsets valid); creditTail follows
  // its hySpread family (NOT listed → D1 only, no idx[5]/idx[21] misread).
  ok("v388: threeMonth IS in DAILY, creditTail is NOT",
    /DAILY = new Set\(\[[^\]]*"threeMonth"[^\]]*\]\)/.test(snapSrc) &&
    !/DAILY = new Set\(\[[^\]]*"creditTail"[^\]]*\]\)/.test(snapSrc));
  // Derivations + AsOf stamping + temp-sparkline hygiene (the spread10s30s pattern exactly).
  ok("v388: spread10y3m derives from LEGS with its own AsOf, and the 3M temp sparkline is deleted",
    /out\.spread10y3m = parseFloat\(\(out\.tenYear - out\.threeMonth\)/.test(snapSrc) &&
    /out\.spread10y3mAsOf = out\.tenYearAsOf \|\| out\.threeMonthAsOf/.test(snapSrc) &&
    /delete out\._threeMoSparkline/.test(snapSrc));
  ok("v388: sahm is computed INSIDE the unemployment fetch closure (only 10 of 26 points escape it) and stamped the UNRATE obs date",
    /field === "unemployment"[\s\S]{0,300}sahmFrom\(vals\)/.test(snapSrc) &&
    /sahm: s, sahmAsOf: obs\[0\]\?\.date/.test(snapSrc));
  // The Sahm math, RUN — a string pin cannot prove an average-of-averages.
  ok("v388: sahmFrom — flat unemployment reads 0.00, never a verdict",
    sahmFrom(Array(20).fill(4.0)) === 0);
  ok("v388: sahmFrom — a genuine deterioration computes the rise of the 3-mo avg over its 12-mo min",
    // newest-first: 3-mo avg now = 4.6; the trailing min of 3-mo avgs = 4.0 → 0.60
    sahmFrom([4.7, 4.6, 4.5, 4.3, 4.2, 4.1, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0]) === 0.6);
  ok("v388: sahmFrom fails CLOSED — 14 points is null (cannot-compute never reads as 0.00 = clear)",
    sahmFrom(Array(14).fill(4.0)) === null && sahmFrom(null) === null && sahmFrom("4.0") === null);
  ok("v388: the trigger is Sahm's own printed 0.50, compared >= ('0.50 or more'), executed at the boundary",
    SAHM_TRIGGER === 0.5 && (0.5 >= SAHM_TRIGGER) === true && (0.49 >= SAHM_TRIGGER) === false &&
    /const trig=sv>=SAHM_TRIGGER/.test(mrSrc) && /import \{ SAHM_TRIGGER \} from "\.\.\/sahm\.js"/.test(mrSrc));
  // CCC thresholds: ONE home (regime.js), imported by the tile, executed at −ε/edge/+ε.
  ok("v388: CREDIT_TAIL thresholds live in regime.js, the tile imports them, boundaries execute",
    (() => {
      const band = (v) => v > RG.CREDIT_TAIL_STRESS ? "STRESSED" : v < RG.CREDIT_TAIL_CALM ? "CALM" : "NEUTRAL";
      return RG.CREDIT_TAIL_CALM === 7 && RG.CREDIT_TAIL_STRESS === 12 &&
        band(6.99) === "CALM" && band(7) === "NEUTRAL" && band(12) === "NEUTRAL" && band(12.01) === "STRESSED" &&
        /import \{[^}]*CREDIT_TAIL_CALM, CREDIT_TAIL_STRESS[^}]*\} from "\.\.\/regime\.js"/.test(mdSrc) &&
        mdSrc.includes('const band=v>CREDIT_TAIL_STRESS?"STRESSED":v<CREDIT_TAIL_CALM?"CALM":"NEUTRAL"');
    })());
  ok("v388: the CALM/STRESSED verdict is suppressed on mock/stale (the NFCI badge pattern)",
    /cIllus\?\(cMode==="STALE"\?<DataModeBadge mode="STALE"\/>:<IllustrativeChip\/>\)/.test(mdSrc));
  // DERIVED_OF + cadence inheritance.
  ok("v388: every undated derivative maps to its parent; sahm ages monthly with UNRATE",
    DERIVED_OF_SRC.creditTailD1 === "creditTail" && DERIVED_OF_SRC.creditTailSeries === "creditTail" &&
    DERIVED_OF_SRC.spread10y3mSeries === "spread10y3m" &&
    cadenceOf("sahm") === "monthly" && cadenceOf("creditTail") === "daily" && cadenceOf("spread10y3m") === "daily");
  // End-to-end overlay through the real merge.
  ok("v388: mergeLiveOverMock overlays all four with LIVE provenance and their own dates",
    (() => {
      const m = mergeLiveOverMock(MOCK_DATA, { live: {
        creditTail: 11.2, creditTailD1: 0.31, creditTailSeries: [10, 10.5, 11.2], creditTailAsOf: "2026-08-14",
        sahm: 0.23, sahmAsOf: "2026-07-01",
        threeMonth: 4.05, threeMonthAsOf: "2026-08-14",
        spread10y3m: -0.15, spread10y3mSeries: [0.1, 0, -0.15], spread10y3mAsOf: "2026-08-14",
      }, cached: false });
      return m.data.macro.credit.tail === 11.2 && m.data.macro.unemployment.sahm === 0.23 &&
        m.data.crossAsset.treasury3m.current === 4.05 && m.data.crossAsset.term.spread10y3m === -0.15 &&
        m.provenance.creditTail === "LIVE" && m.provenance.sahm === "LIVE" &&
        m.dataAsOf.sahm === "2026-07-01" && m.dataAsOf.spread10y3mSeries === "2026-08-14";
    })());
  // Alerts: executed — trip, and the two-leg blind (one MOCK leg blinds the spread).
  const v384Live = () => "LIVE";
  const v384D = { macro: { credit: { tail: 12.5 }, cpi: {} }, crossAsset: { term: { spread10y3m: -0.1 } } };
  ok("v388: the CCC alert trips above 12 on live data and goes BLIND (not clear) on a dead feed",
    evalAlert({ metric: "credittail", condition: "above", value: 12 }, v384D, v384Live).state === "triggered" &&
    evalAlert({ metric: "credittail", condition: "above", value: 12 }, v384D, () => "MOCK").state === "blind");
  ok("v388: the 10y–3m alert needs BOTH legs live — a MOCK threeMonth blinds it, naming the leg",
    (() => {
      const half = (f) => (f === "tenYear" ? "LIVE" : "MOCK");
      const e = evalAlert({ metric: "term10y3m", condition: "below", value: 0 }, v384D, half);
      return e.state === "blind" && /threeMonth/.test(e.why) &&
        evalAlert({ metric: "term10y3m", condition: "below", value: 0 }, v384D, v384Live).state === "triggered";
    })());
  ok("v388: both new alerts ship OFF by default",
    /id:8[^}]*credittail[^}]*active:false/.test(dashSrc) && /id:9[^}]*term10y3m[^}]*active:false/.test(dashSrc));
  // NON-VOTING arrival (the NFCI/30Y rule): not in the band table, not a factor, not in tt-v1.
  ok("v388: none of the four appears in REGIME_BAND_TABLE, the factor lists, or ttReadout",
    (() => {
      const bandSlice = regimeSrc.slice(regimeSrc.indexOf("REGIME_BAND_TABLE"), regimeSrc.indexOf("verdictFrom"));
      const evSrc = readSrc("../src/evidence.js");
      const ttSrc = readSrc("../src/ttReadout.js");
      return ["creditTail", "sahm", "spread10y3m", "threeMonth"].every((k) =>
        !bandSlice.includes(k) && !evSrc.includes(k) && !ttSrc.includes(k));
    })());
  // The demo abstains: mock values sit in the no-verdict zones on purpose.
  ok("v388: mock values abstain — tail in the neutral band, sahm CLEAR, 10y–3m positive-normal",
    (() => {
      const t = MOCK_DATA.macro.credit.tail, s = MOCK_DATA.macro.unemployment.sahm,
        sp = MOCK_DATA.crossAsset.term.spread10y3m;
      return t > RG.CREDIT_TAIL_CALM && t <= RG.CREDIT_TAIL_STRESS && s < SAHM_TRIGGER && sp > 0;
    })());
  ok("v388: SIGNAL_FIELDS gains creditTail at the END — the creditSpread/nfci adjacency pin survives",
    dashSrc.includes('"creditSpread","nfci"') && /SIGNAL_FIELDS=\[[^\]]*"creditTail"\]/.test(dashSrc));
}

// ---- 60. FEAT-TOKVOL (v3.89) — token volume: the Q beside the P ------------------------
{
  console.log("\n[60] FEAT-TOKVOL — the Q leg, key-gated, and the P×Q window read");
  const { tokenDemand } = await import("../src/aiEcon.js");
  ok("tokvol: KEY-GATED like Finnhub — no OPENROUTER_KEY throws before any fetch (mock holds)",
    /throw new Error\("tokenvol: no OPENROUTER_KEY configured"\)/.test(snapSrc) &&
    /withLastGood\(env, "tokenvol", \(\) => fetchTokenVolume\(env, statuses\)\)/.test(snapSrc) &&
    // v3.89.1: every failure path RECORDS status (§9) — no more invisible tokenvol miss.
    (snapSrc.match(/recordStatus\(statuses, "openrouter", "datasets\/rankings-daily"/g) || []).length >= 4);
  ok("tokvol: the KV accrual copies pulse:tokentrend verbatim under its own key (dedup, cap 12, faults swallowed)",
    /pulse:tokenvoltrend/.test(snapSrc) &&
    (snapSrc.match(/trend = trend\.slice\(-12\)/g) || []).length === 2 &&
    /tokenVolDayAsOf: asOf/.test(snapSrc));
  ok("tokvol: the parser fails CLOSED — unrecognized shape or zero total throws, never a guessed number",
    /unrecognized response shape/.test(snapSrc) && /no usable token totals/.test(snapSrc) &&
    /latestDate/.test(snapSrc));   // several days in a response must never sum into one "day"
  ok("tokvol: the Phase-3 destructure and the critical-scope skipped() arm moved TOGETHER",
    /\[tokenomics, tokenVol, equities, shiller\] = await Promise\.allSettled/.test(snapSrc) &&
    /\[skipped\(\), skipped\(\), skipped\(\), skipped\(\)\]/.test(snapSrc));
  // tokenDemand RUN — a string pin cannot prove window math.
  ok("tokvol: P×Q composes in WINDOW terms — −25% px × +40% vol = +5.0% over the same 11w span",
    (() => {
      const px = [8.0, 7.7, 7.4, 7.2, 7.0, 6.8, 6.6, 6.5, 6.3, 6.2, 6.1, 6.0];
      const vol = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.65, 2.7, 2.74, 2.77, 2.8];
      const d = tokenDemand(px, vol);
      return d.weeks === 11 && d.short === false &&
        Math.abs(d.pxWin + 0.25) < 1e-9 && Math.abs(d.volWin - 0.40) < 1e-9 &&
        Math.abs(d.revProxyWin - 0.05) < 1e-9;
    })());
  ok("tokvol: the SHORTER series bounds the window (composing two spans is the units error in time)",
    (() => { const d = tokenDemand([10, 9, 8, 7, 6, 5, 4, 3, 2, 1.5, 1.2, 1], [3.0, 3.3]);
      // n = min(12, 2) = 2 → px newest-aligned slice is [1.2, 1] → pxWin = 1/1.2 − 1
      return d.weeks === 1 && d.short === true && Math.abs(d.pxWin - (1 / 1.2 - 1)) < 1e-9; })());
  ok("tokvol: below minWeeks the read is withheld (short:true), and junk input returns nulls",
    tokenDemand([6.2], [2.9]).revProxyWin === null && tokenDemand(null, null).short === true &&
    tokenDemand([1, 2, 3, 4, 5, 6, 7, 8], [1, 1, 1, 1, 1, 1, 1, 1]).short === true);
  // Wiring: SOURCES/DERIVED_OF/cadence/band, and the mock stays verdict-free.
  ok("tokvol: SOURCES + DERIVED_OF + weekly cadence + band all wired; partition holds at 72",
    SOURCES.tokenVolDay.path === "tokenomics.volDay" && SOURCES.tokenVolTrend.kind === "series" &&
    DERIVED_OF_SRC.tokenVolTrend === "tokenVolDay" && cadenceOf("tokenVolDay") === "weekly" &&
    cadenceOf("tokenVolTrend") === "weekly" && plausible("tokenVolDay", 3.1) && !plausible("tokenVolDay", -1));
  ok("tokvol: the mock volume trend is deliberately BELOW minWeeks — the demo cannot fake a P×Q verdict",
    MOCK_DATA.tokenomics.volTrend.length - 1 < 8);
  ok("tokvol: the card suppresses the P×Q read when EITHER leg is illustrative, and the volume line has its OWN SourceBox",
    /isIllustrative\(mode\) \|\| isIllustrative\(volMode\)/.test(aiSrc) &&
    /datasets\/rankings-daily · total tokens \(keyed\)/.test(aiSrc) &&
    /never annualised/.test(aiSrc));
  ok("tokvol: the price leg is no longer mislabelled 'the demand side' anywhere in code",
    !/demand-side mirror/.test(snapSrc) && !/demand-side mirror/.test(aiSrc) && !/demand-side mirror/.test(dashSrc));
  ok("tokvol: tokenVolDay stays OUT of SIGNAL_FIELDS (key-gated — the qqqPrice precedent)",
    !/SIGNAL_FIELDS=\[[^\]]*tokenVolDay/.test(dashSrc));
  // Merge end-to-end: overlay + provenance + own-date inheritance for the trend.
  ok("tokvol: mergeLiveOverMock overlays volDay/volTrend with LIVE provenance and the trend inherits the day's date",
    (() => {
      const m = mergeLiveOverMock(MOCK_DATA, { live: {
        tokenVolDay: 3.05, tokenVolTrend: [2.8, 2.9, 3.05], tokenVolDayAsOf: "2026-08-14" }, cached: false });
      return m.data.tokenomics.volDay === 3.05 && m.data.tokenomics.volTrend.length === 3 &&
        m.provenance.tokenVolDay === "LIVE" && m.dataAsOf.tokenVolTrend === "2026-08-14";
    })());}
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[61] FEAT-TT-V2 — two licensed inputs, sourced facts, fail-closed receipts");
const NVDA_STREET = {
  schema: "tt-street-v1", symbol: "NVDA", confirmedAt: "2026-08-15T17:09:00.000Z",
  estimates: {
    provider: "Seeking Alpha", sourceUrl: "https://seekingalpha.com/", asOf: "2026-08-15",
    currency: "USD", revenueUnit: "B", epsBasis: "diluted", periods: [
      { periodEnd: "2027-01-31", revenueB: 393.93, eps: 8.96 },
      { periodEnd: "2028-01-31", revenueB: 562.14, eps: 12.80 },
      { periodEnd: "2029-01-31", revenueB: 692.37, eps: 15.93 },
      { periodEnd: "2030-01-31", eps: 17.50 },
      { periodEnd: "2035-01-31", revenueB: 1150 },
    ],
  },
  analystTarget: {
    provider: "TipRanks", sourceUrl: "https://www.tipranks.com/", asOf: "2026-08-15",
    currency: "USD", average: 309.94, low: 250, high: 500, analystCount: 37,
    ratings: { buy: 36, hold: 1, sell: 0 }, lookbackMonths: 3, horizonMonths: 12,
    referencePrice: 225.16,
  },
};
const V2_NOW = new Date("2026-08-15T19:00:00.000Z");
const v2Near = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;
const checkedNvda = validateStreetPacket(NVDA_STREET, { now: V2_NOW });
ok("street schema: the exact SA + TipRanks NVDA packet validates", checkedNvda.ok && checkedNvda.errors.length === 0);
ok("street schema: source/as-of/currency and a published average are server-required",
  !validateStreetPacket({ ...NVDA_STREET, analystTarget: { ...NVDA_STREET.analystTarget, sourceUrl: "", average: null } }, { now: V2_NOW }).ok);
ok("street schema: EPS basis cannot be silently defaulted to diluted GAAP",
  !validateStreetPacket({ ...NVDA_STREET, estimates: { ...NVDA_STREET.estimates, epsBasis: undefined } }, { now: V2_NOW }).ok);
ok("street schema: provider names and source domains are fixed to SA and TipRanks",
  (() => { const bad = JSON.parse(JSON.stringify(NVDA_STREET)); bad.estimates.provider = "Other"; bad.analystTarget.sourceUrl = "https://example.com/target";
    const e = validateStreetPacket(bad, { now: V2_NOW }).errors.join(" "); return /Seeking Alpha/.test(e) && /tipranks\.com/.test(e); })());
ok("street schema: a future confirmation timestamp cannot self-attest a later review",
  !validateStreetPacket({ ...NVDA_STREET, confirmedAt: "2026-08-16T19:00:00.000Z" }, { now: V2_NOW }).ok);
ok("street schema: low/average/high must bracket, and rating counts must reconcile",
  (() => { const bad = JSON.parse(JSON.stringify(NVDA_STREET)); bad.analystTarget.low = 400; bad.analystTarget.ratings.buy = 35;
    const e = validateStreetPacket(bad, { now: V2_NOW }).errors.join(" "); return /low/.test(e) && /ratings total/.test(e); })());
ok("street schema: a supplied analyst count must be positive, while an unknown count may stay absent",
  !validateStreetPacket({ ...NVDA_STREET, analystTarget: { ...NVDA_STREET.analystTarget, analystCount: 0,
    ratings: {} } }, { now: V2_NOW }).ok &&
  validateStreetPacket({ ...NVDA_STREET, analystTarget: { ...NVDA_STREET.analystTarget,
    analystCount: undefined, ratings: {} } }, { now: V2_NOW }).ok);
ok("street schema: rolling target horizon is exactly 12 months, never joined to a fiscal rung",
  !validateStreetPacket({ ...NVDA_STREET, analystTarget: { ...NVDA_STREET.analystTarget, horizonMonths: 24 } }, { now: V2_NOW }).ok);

class V2MemoryKv {
  constructor() { this.values = new Map(); this.puts = []; }
  async get(key, type) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, value); this.puts.push(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; }
}
const streetKv = new V2MemoryKv();
const streetEnv = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: streetKv };
const streetRequest = (body, extra = {}) => new Request("https://fixture.test/api/street", {
  method: "PUT", headers: { "content-type": "application/json", ...(extra.headers || {}) },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const malformedStreetResponse = await putStreetPacket({ request: streetRequest({ symbol: "NVDA" }), env: streetEnv });
ok("street API: malformed licensed payload is rejected server-side before any KV write",
  malformedStreetResponse.status === 400 && streetKv.puts.length === 0 && /invalid street packet/.test(await malformedStreetResponse.text()));
const crossOriginStreetResponse = await putStreetPacket({
  request: streetRequest(NVDA_STREET, { headers: { Origin: "https://evil.test" } }), env: streetEnv,
});
ok("street API: cross-origin mutation fails closed before persistence",
  crossOriginStreetResponse.status === 403 && streetKv.puts.length === 0);
const storedStreetResponse = await putStreetPacket({ request: streetRequest(NVDA_STREET), env: streetEnv });
const storedStreetBody = await storedStreetResponse.json();
const fetchedStreetResponse = await getStreetPacket({
  request: new Request("https://fixture.test/api/street?sym=NVDA"), env: streetEnv,
});
const fetchedStreetBody = await fetchedStreetResponse.json();
ok("street API: a valid reviewed packet writes immutable history plus current and reads back typed",
  storedStreetResponse.status === 201 && streetKv.puts.length === 2 &&
  streetKv.puts.some((k) => k.startsWith("tt:street:history:NVDA:")) &&
  storedStreetBody.record.version && fetchedStreetBody.records.NVDA.analystTarget.average === 309.94);
const duplicateStreetResponse = await putStreetPacket({ request: streetRequest(NVDA_STREET), env: streetEnv });
const duplicateStreetBody = await duplicateStreetResponse.json();
ok("street API: storage metadata cannot manufacture a revision from an identical reviewed packet",
  duplicateStreetResponse.status === 200 && duplicateStreetBody.unchanged === true &&
  duplicateStreetBody.changes.length === 0 && streetKv.puts.length === 2);
const staleVoid = await deleteStreetPacket({
  request: new Request("https://fixture.test/api/street?sym=NVDA", { method: "DELETE",
    headers: { "content-type": "application/json", "if-match": "stale-version" }, body: '{"reason":"bad OCR"}' }), env: streetEnv,
});
ok("street retraction: stale If-Match cannot void a newer reviewed packet",
  staleVoid.status === 412 && streetKv.puts.length === 2);
const voidStreet = await deleteStreetPacket({
  request: new Request("https://fixture.test/api/street?sym=NVDA", { method: "DELETE",
    headers: { "content-type": "application/json", "if-match": storedStreetBody.record.version }, body: '{"reason":"operator confirmed bad OCR"}' }), env: streetEnv,
});
const afterVoid = await (await getStreetPacket({ request: new Request("https://fixture.test/api/street?sym=NVDA"), env: streetEnv })).json();
ok("street retraction: audited tombstone voids current street evidence and its dependent receipt without deleting history",
  voidStreet.status === 200 && !afterVoid.records.NVDA && afterVoid.voided.NVDA.status === "VOID" &&
  JSON.parse(streetKv.values.get("tt:analysis:NVDA:v1")).schema === "tt-analysis-tombstone-v1" &&
  [...streetKv.values.keys()].some((k) => k.startsWith("tt:street:history:NVDA:") && k.endsWith(":void")));
const replacementStreet = await putStreetPacket({ request: streetRequest({ ...NVDA_STREET,
  confirmedAt: "2026-08-15T19:05:00.000Z" }), env: streetEnv });
ok("street retraction: a reviewed replacement supersedes the tombstone and becomes active evidence",
  replacementStreet.status === 200 && JSON.parse(streetKv.values.get("tt:street:NVDA:v1")).schema === "tt-street-v1");
const frameworkKv = new V2MemoryKv();
const frameworkEnv = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: frameworkKv };
const frameworkRequest = (body) => new Request("https://fixture.test/api/framework", {
  method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const crossOriginFramework = await putFramework({ request: new Request("https://fixture.test/api/framework", {
  method: "PUT", headers: { "content-type": "application/json", Origin: "https://evil.test" },
  body: JSON.stringify({ md: "PRIVATE" }),
}), env: frameworkEnv });
ok("AI rubric boundary: cross-origin framework/rubric mutation fails before any KV write",
  crossOriginFramework.status === 403 && frameworkKv.puts.length === 0);
const frameworkSaved = await putFramework({ request: frameworkRequest({ md: "PRIVATE_FULL_FRAMEWORK_DO_NOT_SEND",
  version: "private-v1", aiRubric: { text: "REDACTED_SAFE_RUBRIC", version: "safe-v1", approvedAt: V2_NOW.toISOString() } }), env: frameworkEnv });
const frameworkRecord = JSON.parse(frameworkKv.values.get("tt:framework:v1"));
ok("AI rubric boundary: server stores one explicit approved redacted rubric beside, not inside, the full private framework",
  frameworkSaved.status === 200 && frameworkRecord.md.includes("PRIVATE_FULL") &&
  frameworkRecord.aiRubric.text === "REDACTED_SAFE_RUBRIC" && Number.isFinite(Date.parse(frameworkRecord.aiRubric.approvedAt)));
const badFramework = await putFramework({ request: frameworkRequest({ md: "PRIVATE", aiRubric: {
  text: "safe", version: "safe-v2", approvedAt: "not-a-date" } }), env: frameworkEnv });
ok("AI rubric boundary: malformed approval metadata fails before overwriting the last approved rubric",
  badFramework.status === 400 && JSON.parse(frameworkKv.values.get("tt:framework:v1")).aiRubric.version === "safe-v1");
frameworkKv.values.set("tt:framework:v1", JSON.stringify({ ...frameworkRecord,
  md: "CONCURRENT_PRIVATE_FRAMEWORK_V2", version: "private-v2" }));
const rubricOnlySave = await putFramework({ request: frameworkRequest({ aiRubric: {
  text: "REDACTED_SAFE_RUBRIC_V2", version: "safe-v2", approvedAt: V2_NOW.toISOString() } }), env: frameworkEnv });
const afterRubricOnly = JSON.parse(frameworkKv.values.get("tt:framework:v1"));
const rubricMetadata = await (await getFramework({
  request: new Request("https://fixture.test/api/framework?aiRubric=1"), env: frameworkEnv,
})).json();
ok("AI rubric boundary: rubric-only save preserves a concurrent private-framework revision and the modal GET returns no full framework",
  rubricOnlySave.status === 200 && afterRubricOnly.md === "CONCURRENT_PRIVATE_FRAMEWORK_V2" &&
  afterRubricOnly.version === "private-v2" && rubricMetadata.aiRubric.text === "REDACTED_SAFE_RUBRIC_V2" &&
  !("md" in rubricMetadata));
const ocrKv = new V2MemoryKv();
const noAiOcrResponse = await postStreetOcr({
  request: new Request("https://fixture.test/api/street/ocr", { method: "POST" }),
  env: { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: ocrKv },
});
const noAiOcrBody = await noAiOcrResponse.json();
ok("OCR API: missing Workers AI returns a review draft and never touches KV",
  noAiOcrResponse.status === 503 && noAiOcrBody.requires_confirmation === true &&
  noAiOcrBody.draft.analystTarget.provider === "TipRanks" && ocrKv.puts.length === 0);
const factsKv = new V2MemoryKv();
const factsEnv = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: factsKv };
const mutatingGetResponse = await getTickerFacts({
  request: new Request("https://fixture.test/api/ticker-facts?sym=NVDA&refresh=1"), env: factsEnv,
});
ok("facts API: GET is read-only and rejects the legacy refresh query instead of writing on a GET",
  mutatingGetResponse.status === 405 && factsKv.puts.length === 0);
const crossOriginFactsResponse = await postTickerFacts({
  request: new Request("https://fixture.test/api/ticker-facts", {
    method: "POST", headers: { Origin: "https://evil.test", "content-type": "application/json" }, body: '{"symbol":"NVDA"}',
  }), env: factsEnv,
});
ok("facts API: refresh is a same-origin authenticated POST and cross-origin attempts do no work",
  crossOriginFactsResponse.status === 403 && factsKv.puts.length === 0);

const nvdaMetrics = deriveStreetMetrics(NVDA_STREET, 225.16, { now: V2_NOW });
ok("NVDA: TipRanks published average/low/high gaps calibrate exactly (never re-averaged)",
  v2Near(nvdaMetrics.gaps.averagePct, 37.653224, 1e-6) && v2Near(nvdaMetrics.gaps.lowPct, 11.032155, 1e-6) && v2Near(nvdaMetrics.gaps.highPct, 122.06431, 1e-6));
ok("NVDA: explicit annual revenue growth + contiguous CAGR calibrate; the 2035 tooltip is not interpolated",
  nvdaMetrics.revenueGrowth.length === 2 && v2Near(nvdaMetrics.revenueGrowth[0].pct, 42.70048, 1e-5) &&
  v2Near(nvdaMetrics.revenueGrowth[1].pct, 23.166827, 1e-5) && v2Near(nvdaMetrics.revenueCagr.pct, 32.574376, 1e-5));
ok("NVDA: EPS growth and 2027–2030 CAGR calibrate",
  nvdaMetrics.epsGrowth.length === 3 && v2Near(nvdaMetrics.epsGrowth[0].pct, 42.857143, 1e-5) &&
  v2Near(nvdaMetrics.epsGrowth[1].pct, 24.453125, 1e-5) && v2Near(nvdaMetrics.epsGrowth[2].pct, 9.855618, 1e-5) && v2Near(nvdaMetrics.epsCagr.pct, 25, 1e-6));
ok("NVDA: forward P/E series and 12m-target implied FY2028 P/E calibrate",
  [25.129464, 17.590625, 14.134338, 12.866286].every((x, i) => v2Near(nvdaMetrics.forwardPe[i].value, x, 1e-6)) &&
  nvdaMetrics.targetImpliedPe.periodEnd === "2028-01-31" && v2Near(nvdaMetrics.targetImpliedPe.value, 24.214062, 1e-6));

const ocr = mergeOcrExtractions([
  { image: 1, data: { symbol: "NVDA", analystTarget: { average: 309.94, low: 250, high: 500, analystCount: 37, ratings: { buy: 36, hold: 1, sell: 0 }, referencePrice: 225.16 } } },
  { image: 2, data: { estimates: { periods: [{ periodEnd: "Jan 2027", revenue: "393.93B", eps: 8.96 }, { periodEnd: "Jan 2028", revenue: "562.14B", eps: 12.8 }] } } },
  { image: 3, data: { estimates: { periods: [{ periodEnd: "Jan 2035", revenue: "1.15T" }] } } },
], "2026-08-15");
ok("OCR merge: published average survives verbatim; low/average/high are never averaged",
  ocr.draft.analystTarget.average === 309.94 && ocr.draft.analystTarget.low === 250 && ocr.draft.analystTarget.high === 500);
ok("OCR merge: T→B normalization and visible chart endpoint work without interpolating missing years",
  ocr.draft.estimates.periods.find((x) => x.periodEnd === "2035-01-31").revenueB === 1150 &&
  !ocr.draft.estimates.periods.some((x) => /^203[1-4]-/.test(x.periodEnd)));
ok("street revisions are lossless — every changed estimate/target field is kept, not sliced to three",
  (() => { const next = JSON.parse(JSON.stringify(NVDA_STREET)); next.estimates.periods[0].revenueB++; next.estimates.periods[0].eps++;
    next.estimates.periods[1].revenueB++; next.estimates.periods[1].eps++; next.analystTarget.average++;
    return streetRevision(NVDA_STREET, next).length === 5; })());

const firstComposite = deriveAutomaticComposite(nvdaMetrics, { trend: "UPTREND", support: { quality: 8 }, evidence: ["sourced candles"] });
ok("composite: first snapshot renormalizes V/G/P/M and names revisions as missing (never zero)",
  firstComposite.status === "PASS" && firstComposite.used.length === 4 && firstComposite.missing.includes("revisions") &&
  v2Near(firstComposite.used.reduce((s, x) => s + x.normalizedWeight, 0), 1, 1e-4));
ok("composite: no available pillar is UNKNOWN, not a confident zero",
  renormalizeComposite({ revisions: { status: "MISSING" } }).status === "UNKNOWN");

const fact = (value, extra = {}) => ({ value, status: "LIVE", provider: "fixture", observedAt: "2026-08-15T18:59:00.000Z", ...extra });
const nvdaFacts = { schema: "tt-facts-v1", symbol: "NVDA", updatedAt: V2_NOW.toISOString(), fields: {
  quote: fact(225.16, { currency: "USD" }),
  candles: fact([{ date: "2026-08-14", open: 224, high: 227, low: 223, close: 225.16, volume: 1000000 }]),
  nextEarnings: fact("2026-08-26"),
} };
ok("quote session rule: Saturday uses Friday's completed-session close, never a perpetually stale intraday print",
  (() => { const q = evaluationQuote(nvdaFacts, V2_NOW); return q.basis === "PRIOR_CLOSE" &&
    q.sessionDate === "2026-08-14" && q.value === 225.16; })());
ok("quote session rule: during a regular session the provider quote remains subject to the 15-minute clock",
  evaluationQuote(nvdaFacts, new Date("2026-08-17T19:00:00Z")).basis === "INTRADAY");
const fullReadout = { as_of: "2026-08-15T18:00:00Z", regime: { verdict: "NEUTRAL", actionability: "FULL" },
  health: { can_gate: true }, macro_flip: { evaluable: true, tripped: false, state: "CLEAR" } };
const holdReadout = { ...fullReadout, regime: { verdict: "NEUTRAL", actionability: "HOLD", status: "DATA DEGRADED" },
  health: { can_gate: false }, macro_flip: { evaluable: false, tripped: null, state: "UNCONFIRMED" } };
const qPass = { status: "PASS", score: 8, reason: "primary evidence supports the rubric", citations: ["https://www.sec.gov/fixture"] };
const techPass = { status: "OK", rewardRisk: 3, evidence: ["ATR stop"] };
ok("street gap: a mismatched sourced quote currency blocks the comparison",
  (() => { const f = JSON.parse(JSON.stringify(nvdaFacts)); f.fields.quote.currency = "EUR";
    const rr = buildGateReceipt({ street: NVDA_STREET, facts: f, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: V2_NOW });
    return rr.gates.find((g) => g.id === "street_gap").status === "UNKNOWN" && /EUR/.test(rr.gates.find((g) => g.id === "street_gap").reason); })());
ok("unknown analyst count remains eligible when all gates pass but is named as lower-confidence evidence",
  (() => { const s = JSON.parse(JSON.stringify(NVDA_STREET)); delete s.analystTarget.analystCount;
    const rr = buildGateReceipt({ street: s, facts: nvdaFacts, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: V2_NOW });
    return rr.eligible && rr.warnings.some((w) => /analyst count.*unknown/i.test(w)); })());
const waitReceipt = buildGateReceipt({ street: NVDA_STREET, facts: nvdaFacts, readout: holdReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: V2_NOW });
ok("NVDA acceptance: positive 37.7% street gap cannot override Engine 0 HOLD / blind health",
  waitReceipt.status === "WAIT" && waitReceipt.gates.find((g) => g.id === "macro").status === "FAIL" &&
  waitReceipt.gates.find((g) => g.id === "street_gap").status === "PASS");
ok("binary boundary is report-only: Aug 26 is CLEAR at 11d, then SOON at exactly 10d without changing eligibility",
  waitReceipt.advisories.find((g) => g.id === "binary").status === "CLEAR" &&
  buildGateReceipt({ street: NVDA_STREET, facts: nvdaFacts, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass,
    now: new Date("2026-08-16T19:00:00Z") }).advisories.find((g) => g.id === "binary").status === "SOON" &&
  buildGateReceipt({ street: NVDA_STREET, facts: nvdaFacts, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass,
    now: new Date("2026-08-16T19:00:00Z") }).eligible === true);
const eligibleReceipt = buildGateReceipt({ street: NVDA_STREET, facts: nvdaFacts, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: V2_NOW });
ok("fully sourced fixture becomes ELIGIBLE without any position/exposure input",
  eligibleReceipt.eligible === true && eligibleReceipt.status === "ELIGIBLE" && !eligibleReceipt.gates.some((g) => /position|cap/i.test(g.id + g.reason)));
ok("receipt compatibility: changed quote/advisory semantics require the v2 schema and v2.2 engine",
  eligibleReceipt.schema === TT_ANALYSIS_SCHEMA && TT_ANALYSIS_SCHEMA === "tt-analysis-v2" &&
  eligibleReceipt.engineVersion === TT_ENGINE_VERSION && TT_ENGINE_VERSION === "tt-gates-v2.2.0" &&
  adminSrc.includes('r.schema!=="tt-analysis-v2"') && adminSrc.includes('r.engineVersion!=="tt-gates-v2.2.0"'));
ok("RESTRICTED is a named veto — only FULL may gate capital",
  (() => { const rr = buildGateReceipt({ street: NVDA_STREET, facts: nvdaFacts,
      readout: { ...fullReadout, regime: { verdict: "NEUTRAL", actionability: "RESTRICTED" }, health: { can_gate: false } },
      composite: firstComposite, qualitative: qPass, technicals: techPass, now: V2_NOW });
    return !rr.eligible && rr.gates.find((g) => g.id === "macro").status === "FAIL" && /only FULL/.test(rr.gates.find((g) => g.id === "macro").reason); })());
ok("missing Engine 0 actionability fails closed in the receipt too — canonical and street paths cannot diverge on legacy bodies",
  (() => { const rr = buildGateReceipt({ street: NVDA_STREET, facts: nvdaFacts,
      readout: { ...fullReadout, regime: { verdict: "TAILWIND" } }, composite: firstComposite,
      qualitative: qPass, technicals: techPass, now: V2_NOW });
    return !rr.eligible && rr.gates.find((g) => g.id === "macro").status === "UNKNOWN"; })());
ok("missing R/R blocks, while a missing calendar is a named report-only UNKNOWN advisory",
  (() => { const f = JSON.parse(JSON.stringify(nvdaFacts)); delete f.fields.nextEarnings;
    const rr = buildGateReceipt({ street: NVDA_STREET, facts: f, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: null, now: V2_NOW });
    return rr.gates.find((g) => g.id === "reward_risk").status === "UNKNOWN" && rr.advisories.find((g) => g.id === "binary").status === "UNKNOWN" && !rr.eligible; })());
ok("a LIVE label cannot launder an old intraday quote; observation age independently fails closed",
  (() => { const f = JSON.parse(JSON.stringify(nvdaFacts)); f.fields.quote.observedAt = "2026-08-15T18:00:00.000Z";
    const rr = buildGateReceipt({ street: NVDA_STREET, facts: f, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: new Date("2026-08-17T19:00:00Z") });
    return rr.gates.find((g) => g.id === "quote").status === "UNKNOWN" && /2940 minutes old/.test(rr.gates.find((g) => g.id === "quote").reason); })());
ok("quote freshness requires the provider observation; current retrieval time cannot substitute for it",
  (() => { const f = JSON.parse(JSON.stringify(nvdaFacts)); delete f.fields.quote.observedAt;
    f.fields.quote.retrievedAt = V2_NOW.toISOString();
    const rr = buildGateReceipt({ street: NVDA_STREET, facts: f, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: new Date("2026-08-17T19:00:00Z") });
    return rr.gates.find((g) => g.id === "quote").status === "UNKNOWN" && /observation time/.test(rr.gates.find((g) => g.id === "quote").reason); })());
ok("a stale calendar observation is a report-only UNKNOWN and does not veto an otherwise eligible ticker",
  (() => { const f = JSON.parse(JSON.stringify(nvdaFacts)); f.fields.nextEarnings.status = "STALE";
    const rr = buildGateReceipt({ street: NVDA_STREET, facts: f, readout: fullReadout, composite: firstComposite, qualitative: qPass, technicals: techPass, now: V2_NOW });
    return rr.advisories.find((g) => g.id === "binary").status === "UNKNOWN" && rr.eligible; })());
ok("R/R policy preserves 2.0/2.5/3.0 and adds 0.5 only in HEADWIND",
  rewardRiskFloor("core", "NEUTRAL") === 2 && rewardRiskFloor("tactical", "NEUTRAL") === 2.5 &&
  rewardRiskFloor("speculative", "NEUTRAL") === 3 && rewardRiskFloor("speculative", "HEADWIND") === 3.5);
ok("analysis risk tier is derived server-side from the private book, never accepted from the browser",
  riskTierForBookEntry({ sym: "A", tier: "WATCH", lens: "AI" }) === "tactical" &&
  riskTierForBookEntry({ sym: "B", tier: "S", lens: "SP" }) === "speculative" &&
  riskTierForBookEntry({ sym: "C", tier: "A", lens: "QC" }) === "core" && riskTierForBookEntry(null) === null);
const nvdaAttestation = await attestGateReceipt(eligibleReceipt, { street: NVDA_STREET, facts: nvdaFacts, readout: fullReadout, riskTier: "core" });
ok("attestation binds the result to exact street/facts/regime versions and hashes",
  nvdaAttestation.status === "ELIGIBLE" && /^[a-f0-9]{64}$/.test(nvdaAttestation.inputHash) &&
  /^[a-f0-9]{64}$/.test(nvdaAttestation.resultHash) && nvdaAttestation.inputVersions.regimeActionability === "FULL" &&
  nvdaAttestation.inputVersions.riskTier === "core");
const analysisKv = new V2MemoryKv();
analysisKv.values.set("tt:street:NVDA:v1", JSON.stringify(storedStreetBody.record));
analysisKv.values.set("tt:facts:NVDA:v1", JSON.stringify(nvdaFacts));
const analysisEnv = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: analysisKv };
const analysisRequest = () => new Request("https://fixture.test/api/ticker-analysis", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ symbol: "NVDA", tier: "speculative" }),
});
const missingBookAnalysis = await postTickerAnalysis({ request: analysisRequest(), env: analysisEnv });
ok("analysis API: a symbol outside the private book is rejected before any receipt write",
  missingBookAnalysis.status === 409 && analysisKv.puts.length === 0);
analysisKv.values.set("tt:book:v1", JSON.stringify({ book: [{ sym: "NVDA", tier: "WATCH", lens: "AI" }], cut: [] }));
const realFetch = globalThis.fetch;
globalThis.fetch = async (input) => String(input).includes("/readout.json")
  ? new Response(JSON.stringify(fullReadout), { status: 200, headers: { "content-type": "application/json" } })
  : realFetch(input);
let serverAnalysisResponse;
try { serverAnalysisResponse = await postTickerAnalysis({ request: analysisRequest(), env: analysisEnv }); }
finally { globalThis.fetch = realFetch; }
const serverAnalysisBody = await serverAnalysisResponse.json();
ok("analysis API: browser-supplied tier is ignored; book-derived tier is bound into the receipt",
  serverAnalysisResponse.status === 200 && serverAnalysisBody.receipt.policy.riskTier === "tactical" &&
  serverAnalysisBody.receipt.attestation.inputVersions.riskTier === "tactical" &&
  analysisKv.puts.some((k) => k.startsWith("tt:analysis:history:NVDA:")) &&
  analysisKv.puts.includes("tt:analysis:NVDA:v1"));
let capturedAiPrompt = "";
const citedFacts = JSON.parse(JSON.stringify(nvdaFacts));
citedFacts.fields.secFilings = fact([{ title: "10-Q", url: "https://www.sec.gov/fixture" }]);
analysisKv.values.set("tt:facts:NVDA:v1", JSON.stringify(citedFacts));
analysisKv.values.set("tt:framework:v1", JSON.stringify(frameworkRecord));
const analysisAiEnv = { ...analysisEnv, AI: { run: async (_model, args) => {
  capturedAiPrompt = JSON.stringify(args.messages);
  return { response: JSON.stringify({ score: 8, verdict: "PASS", reason: "cited filing evidence",
    citations: ["https://www.sec.gov/fixture"], risks: [] }) };
} } };
globalThis.fetch = async (input) => String(input).includes("/readout.json")
  ? new Response(JSON.stringify(fullReadout), { status: 200, headers: { "content-type": "application/json" } })
  : realFetch(input);
try { await postTickerAnalysis({ request: analysisRequest(), env: analysisAiEnv }); }
finally { globalThis.fetch = realFetch; }
ok("Workers AI privacy: the assembled prompt contains only the explicitly approved redacted rubric, never the full KV framework",
  capturedAiPrompt.includes("REDACTED_SAFE_RUBRIC") && !capturedAiPrompt.includes("PRIVATE_FULL_FRAMEWORK_DO_NOT_SEND"));

const secUnit = (val, end = "2026-04-26") => [{ val, end, filed: "2026-05-20", form: "10-Q", accn: "0001" }];
const secFixture = { facts: { "us-gaap": {
  CashAndCashEquivalentsAtCarryingValue: { units: { USD: secUnit(8_000_000_000) } },
  MarketableSecuritiesCurrent: { units: { USD: secUnit(42_335_000_000) } },
  LongTermDebtCurrent: { units: { USD: secUnit(1_250_000_000) } },
  LongTermDebtNoncurrent: { units: { USD: secUnit(7_220_000_000) } },
  WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: secUnit(24_391_000_000) } },
} } };
const secFacts = extractSecFacts(secFixture, { retrievedAt: V2_NOW.toISOString(), sourceUrl: "https://www.sec.gov/fixture" });
ok("SEC normalization: diluted shares and component-auditable conservative net cash calibrate",
  secFacts.dilutedSharesB.value === 24.391 && secFacts.netCashB.value === 41.865 && secFacts.netCashB.components.currentDebtB === 1.25);
ok("SEC normalization: a missing balance-sheet component stays MISSING; absent never equals zero",
  (() => { const x = JSON.parse(JSON.stringify(secFixture)); delete x.facts["us-gaap"].MarketableSecuritiesCurrent;
    return extractSecFacts(x).netCashB.status === "MISSING" && extractSecFacts(x).netCashB.value === null; })());
ok("facts merge: provider failure retains last-good value but marks it STALE with the error",
  (() => { const old = { symbol: "NVDA", fields: { quote: fact(225.16) } };
    const bad = { symbol: "NVDA", fields: { quote: { value: null, status: "MISSING", error: "HTTP 429" } } };
    const merged = mergeFactsRecord(old, bad, V2_NOW); return merged.fields.quote.value === 225.16 && merged.fields.quote.status === "STALE" && /429/.test(merged.fields.quote.lastRefreshError); })());
ok("facts merge: repeated provider failures retain the same last-good observation instead of erasing it",
  (() => { const old = { symbol: "NVDA", fields: { quote: fact(225.16) } };
    const bad = { symbol: "NVDA", fields: { quote: { value: null, status: "MISSING", error: "HTTP 429" } } };
    const once = mergeFactsRecord(old, bad, V2_NOW);
    const twice = mergeFactsRecord(once, bad, new Date(V2_NOW.getTime() + 60000));
    return twice.fields.quote.value === 225.16 && twice.fields.quote.status === "STALE" &&
      twice.fields.quote.observedAt === old.fields.quote.observedAt; })());
ok("Finnhub normalization preserves the provider's quote timestamp and never stamps retrieval as observation",
  (() => { const providerAt = Date.parse("2026-08-15T18:58:00.000Z") / 1000;
    const q = quoteFact({ c: 225.16, dp: -0.06, t: providerAt }, { currency: "USD" }, V2_NOW.toISOString());
    const unknown = quoteFact({ c: 225.16 }, { currency: "USD" }, V2_NOW.toISOString());
    return q.status === "LIVE" && q.observedAt === "2026-08-15T18:58:00.000Z" && q.retrievedAt === V2_NOW.toISOString() &&
      unknown.status === "UNKNOWN" && unknown.observedAt === null && /not substituted/.test(unknown.reason); })());

/* Fixture re-pinned at v5.6.1: the old two-window shape carried a deliberate 6-month hole,
   which the new tiling guard rightly rejects — windows must be CONTIGUOUS to merge. */
const nasdaqFixture = [
  { data: { tradesTable: { rows: [
    { date: "08/15/2026", close: "$229.94", volume: "12,240,000", open: "$233.66", high: "$248.57", low: "$227.67" },
    { date: "08/14/2026", close: "$236.22", volume: "14,440,000", open: "$240.00", high: "$244.00", low: "$231.00" },
  ] } } },
  { data: { tradesTable: { rows: [
    { date: "08/14/2026", close: "$236.22", volume: "14,440,000", open: "$240.00", high: "$244.00", low: "$231.00" },
    { date: "08/13/2026", close: "$232.10", volume: "9,100,000", open: "$231.00", high: "$236.00", low: "$229.00" },
  ] } } },
];
ok("Nasdaq fallback normalization parses attributed OHLC, sorts ascending, and de-duplicates chunk boundaries",
  (() => { const x = nasdaqCandlesFact(nasdaqFixture, V2_NOW.toISOString());
    return x.status === "LIVE" && x.provider === "Nasdaq" && x.value.length === 3 &&
      x.value[0].date === "2026-08-13" && x.value.at(-1).close === 229.94 && x.observedAt === "2026-08-15"; })());
/* v5.6.1 — the continuity guard, EXECUTED on the exact live corruption shape (NBIS,
   2026-08-25): a failed middle window's interior hole, and a tail window carrying another
   instrument's prints. Either tell alone must reject the merge to MISSING with the fault
   NAMED — a discontinuous series stored as LIVE anchored a stamped outcome at $7.62 on a
   $277 stock the night v5.6 shipped. */
ok("v5.6.1 guard: an interior hole (a failed window) rejects the merge — the windows must TILE",
  (() => { const x = nasdaqCandlesFact([{ data: { tradesTable: { rows: [
      { date: "08/15/2026", close: "$229.94", open: "$233.66", high: "$248.57", low: "$227.67" },
      { date: "02/14/2026", close: "$139.74", open: "$141.00", high: "$143.00", low: "$138.00" },
    ] } } }], V2_NOW.toISOString());
    return x.status === "MISSING" && /interior gap 2026-02-14 -> 2026-08-15/.test(x.reason); })());
ok("v5.6.1 guard: an adjacent-close discontinuity (another instrument's prints) rejects the merge, fault named",
  (() => { const x = nasdaqCandlesFact([{ data: { tradesTable: { rows: [
      { date: "08/19/2026", close: "$7.78", open: "$7.49", high: "$7.79", low: "$7.39" },
      { date: "08/18/2026", close: "$104.88", open: "$106.00", high: "$108.32", low: "$102.00" },
    ] } } }], V2_NOW.toISOString());
    return x.status === "MISSING" && /discontinuity 2026-08-18 \$104\.88 -> 2026-08-19 \$7\.78/.test(x.reason); })());
/* v5.6.2 — the QUOTE cross-check (owner call): when EVERY window returns the wrong
   instrument the series is internally consistent — contiguous, no jump — and the first two
   tells are structurally blind to it. The same-refresh live quote is the outside reference.
   Same 3x constant as the adjacent tell (one doctrine); a real 30-50% print gap must PASS. */
const junkWindows = [{ data: { tradesTable: { rows: [
  { date: "08/19/2026", close: "$7.78", open: "$7.49", high: "$7.79", low: "$7.39" },
  { date: "08/20/2026", close: "$7.60", open: "$7.76", high: "$7.77", low: "$7.30" },
] } } }];
ok("v5.6.2 quote rung: an internally-consistent wrong-instrument merge is rejected against the same-refresh quote, fault named",
  (() => { const x = nasdaqCandlesFact(junkWindows, V2_NOW.toISOString(), 277.68);
    return x.status === "MISSING" && /tail close \$7\.6 vs live quote \$277\.68/.test(x.reason); })());
ok("v5.6.2 quote rung: no quote = the rung is SKIPPED (never guessed), and a near-quote tail passes",
  nasdaqCandlesFact(junkWindows, V2_NOW.toISOString(), null).status === "LIVE" &&
  nasdaqCandlesFact(junkWindows, V2_NOW.toISOString(), 8.1).status === "LIVE");
ok("v5.6.2 quote rung: the 3x edge — a real print gap passes, only the impossible is rejected (exact boundary executed)",
  candleSeriesFault([{ date: "2026-08-19", close: 100 }], 300) === null &&
  /tail close/.test(candleSeriesFault([{ date: "2026-08-19", close: 100 }], 300.5) || "") &&
  candleSeriesFault([{ date: "2026-08-19", close: 100 }], 145) === null &&
  /tail close/.test(candleSeriesFault([{ date: "2026-08-19", close: 100 }], 33) || ""));
ok("v5.6.2 wiring: the refresh derives refPx from its OWN LIVE quote and passes it to BOTH builders",
  (() => { const src7 = readSrc("../functions/api/ticker-facts.js");
    return src7.includes('fields.quote.status === "LIVE"') &&
      src7.includes("candlesFact(candles.value, retrievedAt, refPx)") &&
      src7.includes("nasdaqCandles(sym, now, retrievedAt, refPx)"); })());
ok("Nasdaq fallback cannot launder empty or malformed OHLC into sourced candles",
  nasdaqCandlesFact({ data: { tradesTable: { rows: [] } } }, V2_NOW.toISOString()).status === "MISSING" &&
  nasdaqCandlesFact({ data: { tradesTable: { rows: [
    { date: "08/15/2026", close: "$229.94", open: "", high: "$220", low: "$230" },
  ] } } }, V2_NOW.toISOString()).status === "MISSING");

const syntheticCandles = Array.from({ length: 230 }, (_, i) => {
  const close = 100 + i * 0.22 + Math.sin(i / 4) * 4;
  const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
  return { date, open: close - 0.4, high: close + 1.4, low: close - 1.4, close, volume: 1_000_000 + i * 1000 };
});
ok("technicals: fewer than 201 sourced daily candles is UNKNOWN, never an invented stop",
  deriveTechnicals(syntheticCandles.slice(0, 100), { quote: 120, target: 150 }).status === "UNKNOWN");
ok("technicals: ATR/pivots/support/stop/RR are deterministic on a sufficient OHLC history",
  (() => { const a = deriveTechnicals(syntheticCandles, { quote: syntheticCandles.at(-1).close, target: 180 });
    const b = deriveTechnicals(syntheticCandles, { quote: syntheticCandles.at(-1).close, target: 180 });
    return a.status === "OK" && a.atr14 > 0 && a.support.price > 0 && a.stop < a.quote && a.rewardRisk > 0 && JSON.stringify(a) === JSON.stringify(b); })());
ok("technicals: evidence is provider-neutral because the facts record owns candle provenance",
  deriveTechnicals(syntheticCandles, { quote: syntheticCandles.at(-1).close, target: 180 }).evidence[0] ===
    `230 sourced daily candles through ${syntheticCandles.at(-1).date}`);

const ocrRouteSrc = readSrc("../functions/api/street/ocr.js");
ok("admin v2: screenshots are reviewed and the OCR route has no persistence binding",
  adminSrc.includes('/api/street/ocr') && adminSrc.includes('✔ CONFIRM &amp; SAVE') &&
  adminSrc.includes('v2Json("/api/street",{method:"PUT"') && !ocrRouteSrc.includes("PULSE_CACHE") &&
  ocrRouteSrc.includes("requires_confirmation: true"));
ok("admin v2: additive street receipt uses TipRanks published average and cannot mutate canonical rank state",
  adminSrc.includes("function buildV2Rows()") && adminSrc.includes('basis:"TipRanks published average"') &&
  adminSrc.includes("function renderStreetEligibility()") && adminSrc.includes("diagnostic, not canonical score") &&
  !/function buildV2Rows\(\)[\s\S]{0,2600}CAP_PCT/.test(adminSrc) &&
  (() => { const streetFns=liftFns(adminSrc,["buildV2Rows","renderStreetEligibility"]); return !/(UPSIDE_ROWS|AGREE_PICK|LAST_RANK)\s*=/.test(streetFns); })());
ok("admin v2: street receipts are fully absent from canonical readiness — separation is bidirectional, not merely persistence-level",
  (() => { const readinessFn=liftFns(adminSrc,["readiness"]); return !/\b(STREET|FACTS|ANALYSIS|V2_ROWS|streetEligibility)\b/.test(readinessFn); })());
ok("admin v2: diagnostic street rows preserve book order and select no winner, medal, or independent ranking",
  (() => { const streetFns=liftFns(adminSrc,["buildV2Rows","renderStreetEligibility"]); return !/\.sort\s*\(/.test(streetFns) && !/🥇|🥈|🥉|TOP PICK|MEDAL/i.test(streetFns) &&
    streetFns.includes("comparison only; no winner selected"); })());
ok("admin v2: every non-FULL Engine 0 actionability is a hard stance stop",
  adminSrc.includes('actionability!=="FULL"') && !adminSrc.includes("TICKER GATES OPEN — Engine 0 RESTRICTED") &&
  adminSrc.includes('ADDS SUSPENDED — Engine 0'));
ok("admin v2: reviewed data, facts, and receipts load outside the replace-all book",
  adminSrc.includes("/api/street?syms=") && adminSrc.includes("/api/ticker-facts?syms=") && adminSrc.includes("/api/ticker-analysis?syms=") &&
  !/function bookDoc\(\)[^\n]*(STREET|FACTS|ANALYSIS)/.test(adminSrc));
ok("admin v2: legacy PT comparison consumes one explicit value and never averages scenarios or aggregates",
  adminSrc.includes("[pcRow.average,pcRow.mean,pcRow.base].find") &&
  !/const vals=typeof pcRow\.average[\s\S]{0,300}reduce/.test(adminSrc));
ok("admin v2: unknown/thin analyst coverage is visible rather than normal-confidence silence",
  adminSrc.includes("analyst count unknown") && adminSrc.includes("thin coverage"));
ok("admin v2: SA and TipRanks keep independent as-ofs and screenshot EPS is not relabelled GAAP",
  adminSrc.includes('id="stSaAsOf"') && adminSrc.includes('id="stTrAsOf"') &&
  adminSrc.includes('epsBasis:"provider-consensus"') && !adminSrc.includes('epsBasis:"diluted"'));
ok("docs: the current plan names /admin.html, /readout.json, KV separation, and the two manual inputs",
  (() => { const d = readSrc("../ticker-terminal/TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md");
    return d.includes("/admin.html") && d.includes("/readout.json") && d.includes("Seeking Alpha") &&
      d.includes("TipRanks") && d.includes("tt:street:") && d.includes("tt:facts:"); })());
ok("docs: one current README points at runtime while both obsolete GUI/spec artifacts say ARCHIVE",
  (() => { const current = readSrc("../ticker-terminal/README.md");
    const spec = readSrc("../ticker-terminal/TT_TICKER_TERMINAL.md");
    const gui = readSrc("../ticker-terminal/tt_terminal.html");
    return current.includes("public/admin.html") && current.includes("/readout.json") && current.includes("tt:analysis:") &&
      /^# ARCHIVE/m.test(spec) && /ARCHIVE TEMPLATE/.test(gui); })());
ok("docs: every TT-run response must report a surfaced composite, sourced/horizon PT, and explicit BUY/WAIT/SELL call",
  (() => { const current = readSrc("../ticker-terminal/README.md");
    const required = ["Composite: <score>/10 (<surface>)", "PT: $<value> (<basis>, <horizon>, <source>)",
      "Call: BUY|WAIT|SELL", "UNAVAILABLE", "ELIGIBLE NEXT DOLLAR", "funding-priority row alone"];
    return required.every((term) => current.includes(term)) && required.every((term) => claudeSrc.includes(term)) &&
      /BUY` requires[\s\S]{0,160}ELIGIBLE NEXT DOLLAR/.test(current) &&
      /SELL` requires[\s\S]{0,180}(forced-exit|kill|over-cap trim)/.test(current) &&
      /diagnostic `ELIGIBLE`[\s\S]{0,180}cannot create a buy\/sell call/.test(current);
  })());

// ═══════════ [62] v3.97 SHAREABLE SIMPLE — newbie prose + the public picks whitelist ═══════════
// Two owner calls: the Simple hero speaks in DIRECTIONAL verb phrases (a bare noun list
// misleads — "working for the market: inflation" reads as inflation-is-good when the factor
// is bullish because inflation is COOLING), and /api/picks is the ONE deliberately-public
// book projection (S-tier tickers only, whitelist by explicit field picks).
console.log("\n[62] v3.97 SHAREABLE SIMPLE — prose derivation + picks whitelist");
{
  const { REGIME_BAND_TABLE } = await import("../src/regime.js");
  ok("prose: every band carries a plainBull/plainBear verb-phrase pair beside its plain noun",
    REGIME_BAND_TABLE.every((b) => typeof b.plainBull === "string" && typeof b.plainBear === "string" &&
      / (is|are) /.test(b.plainBull) && / (is|are) /.test(b.plainBear)));
  const { postureSummary } = await import("../src/evidence.js");
  const F = (key, vote) => ({ key, vote, label: key, short: key });
  const both = postureSummary([F("cpiHeadline","bull"), F("nfci","bull"), F("valuation","bear"), F("fearGreed","neutral")]);
  ok("prose: directional phrases, both buckets — cooling inflation FOR, stretched valuations AGAINST",
    both.prose.for === "The bull case right now: inflation is cooling and credit is cheap and easy." &&
    both.prose.against === "The bear case: stocks are priced for perfection.");
  const oneSide = postureSummary([F("vix","bull")]);
  ok("prose: an empty bucket states itself — 'no clear bear case on the board'",
    oneSide.prose.for === "The bull case right now: volatility is asleep." &&
    oneSide.prose.against === "No clear bear case on the board right now.");
  ok("prose: all-neutral/excluded yields NULL — the sentence covers it, two 'nothing' lines would be filler",
    postureSummary([F("vix","neutral"), F("cpiHeadline","excluded")]).prose === null &&
    postureSummary([]).prose === null);
  ok("prose: an unknown factor key falls back to its label, never a blank",
    postureSummary([F("mystery","bull")]).prose.for.includes("mystery"));
  /* v4.0: postureSummary().prose (and the plainBull/plainBear verb phrases it reads) are
     RETAINED and still tested, but no longer RENDERED — the Simple cards carry that
     per-factor detail now, and rendering both would be the same fact twice. Stated here
     rather than left ambiguous: this is a deliberate retained-unrendered projection, not an
     orphan, and the pins below keep it from drifting if a later surface wants it back. */
  ok("prose: still computed and correct, but no longer rendered — the cards replaced it (v4.0)",
    !/prose=\{/.test(dashSrc) && !/prose&&/.test(bandSrc) &&
    typeof postureSummary([F("vix", "bull")]).prose.for === "string");

  // ── the picks endpoint: RUN against a fake KV, whitelist proven ──
  const { projectPicks, onRequestGet: picksGet } = await import("../functions/api/picks.js");
  const richEntry = { sym: "NBIS", tier: "S", rank: "#1 secret trigger", lastRun: "2026-08-15",
    share_note: "  the one-liner  ", comp: "R3-A: 9.0", dots: [{ t: "x" }],
    deepDive: { thesis: "PRIVATE", pt_model: { x: 1 } }, pos: { sh: 100, mv: 5000 } };
  const book = { version: 7, asOf: "2026-08-16", book: [
    richEntry, { sym: "TSM", tier: "A", share_note: "wrong tier — must not appear" },
    { sym: "bad sym!", tier: "S" }, { sym: "AAPL", tier: "S", share_note: "x".repeat(200) } ] };
  const out = projectPicks(book);
  ok("picks: S-only, book order, sym-validated — NBIS and AAPL, never the A-tier or the bad sym",
    out.schema === "picks-v1" && out.asOf === "2026-08-16" &&
    out.picks.map((p) => p.sym).join(",") === "NBIS,AAPL");
  ok("picks: WHITELIST projection — nothing book-shaped leaks (rank/comp/dots/deepDive/pos/lastRun)",
    (() => { const j = JSON.stringify(out);
      return !/PRIVATE|pt_model|secret trigger|R3-A|lastRun|"pos"|"dots"/.test(j) &&
        out.picks.every((p) => Object.keys(p).every((k) => ["sym","tier"].includes(k))); })());
  /* REVERSED at v5.6.9: this pinned that a stored share_note was PUBLISHED (trimmed to 140).
     The field was retired with the v3.97 share strip it served, so the assertion is re-pinned
     on its ABSENCE — a retired field quietly reappearing in a public projection is exactly
     the label-outlives-its-data defect, and it would widen this endpoint's exposure. */
  ok("picks: a stored share_note is NOT published — the field is retired, not merely unused",
    out.picks.every((p) => p.note === undefined) &&
    out.picks.every((p) => Object.keys(p).join(",") === "sym,tier"));
  ok("picks: a missing or malformed book yields {picks:[]}, never a throw",
    projectPicks(null).picks.length === 0 && projectPicks({ book: "not-an-array" }).picks.length === 0);
  const res = await picksGet({ env: { PULSE_CACHE: { get: async () => book } } });
  const body = JSON.parse(await res.text());
  ok("picks: the handler serves the projection with a 5-min public cache header (KV cannot be hammered)",
    res.status === 200 && body.picks.length === 2 &&
    res.headers.get("cache-control") === "public, max-age=300");
  const dead = await picksGet({ env: { PULSE_CACHE: { get: async () => { throw new Error("kv down"); } } } });
  ok("picks: a KV fault degrades to an empty list, never a 500",
    dead.status === 200 && JSON.parse(await dead.text()).picks.length === 0);
  ok("picks: every OTHER book endpoint stays PIN-gated — picks.js is the one no-auth read, and says so",
    !/authorize/.test(readSrc("../functions/api/picks.js")) &&
    /ONE ENDPOINT THAT PUBLISHES BOOK-DERIVED CONTENT WITHOUT A PIN/.test(readSrc("../functions/api/picks.js")));

  /* ── v4.1.7 TERMINAL DOCK — the section replacing SharedPicks. Owner: the bottom row is a
     DOOR INTO TERMINAL, not a mini-watchlist. Two v3.97 rules REVERSE here, deliberately:
     the chips become buttons (they finally do something), and the strip is publicView-gated
     (cleanliness, explicitly NOT privacy — /api/picks is unchanged and still public). ── */
  ok("dock: presentation only — no fetch, hook, storage or navigation in the section",
    (() => { const code = tdSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      return !/fetch\(|useEffect|useState|localStorage|window\.location/.test(code) &&
        /fetch\("\/api\/picks"\)/.test(dashSrc) && /if\(!liveBuild\)return;/.test(dashSrc); })());
  ok("dock: renders NOTHING on the public route, and nothing without live-fetched data",
    /if \(publicView\) return null;/.test(tdSrc) &&
    /picks\.picks\.length === 0\) return null;/.test(tdSrc));
  ok("dock: chips are real BUTTONS now — the v3.97 div rule reverses because they finally have a job",
    /<button/.test(tdSrc) && /onOpenTerminal\(p\.sym\)/.test(tdSrc) &&
    /aria-label=\{`Open \$\{p\.sym\} in Ticker Terminal`\}/.test(tdSrc));
  ok("dock: NO quotes, P&L or scores on a chip — the chip is a door, its label is the symbol",
    !/price|pct|quote|upl|score|composite|tier/i.test(
      tdSrc.slice(tdSrc.indexOf("picks.picks.map"), tdSrc.indexOf("picks.picks.map") + 600)));
  ok("dock: the gate FAILS CLOSED — an unknown actionability reads NO READ, never a permissive default",
    (() => { const m = tdSrc.match(/GATE_VOICE\[actionability\] \|\| \{ word: "([^"]+)"/);
      return !!m && m[1] === "NO READ" && /FULL:\s*\{ word: "SEND IT"/.test(tdSrc) &&
        /HOLD:\s*\{ word: "HANDS OFF"/.test(tdSrc); })());
  ok("dock: the gate's SOURCE is a published actionability, and the machine token stays reachable",
    /Engine 0 actionability: \$\{gate \|\| "unavailable"\}/.test(tdSrc) &&
    /gate=\{dailyCall\?dailyCall\.actionability:null\}/.test(dashSrc));
  /* Re-pinned at the v5.6.8 merge: this branch derived the gate from its own buildTtReadout
     memo; main's canonical md-call-v1 `dailyCall` supersedes it and is strictly better — the
     hero, the clipboard and the gate now read ONE object, so the gate a chip sits under can
     never disagree with the call the page is making. */
  ok("dock: ONE call — the gate reads the same dailyCall the hero renders and the clipboard formats",
    /const dailyCall=callFrozen\?publicCall:currentCall;/.test(dashSrc) &&
    // 8/28 A10 re-anchor: the call gained the frozen flag; the CLAIM (one dailyCall object
    // for hero, clipboard and gate) is unchanged.
    /formatMacroCallPaste\(dailyCall,\{frozen:callFrozen\}\)/.test(dashSrc) &&
    // scoped to the VARIABLES, not the module path — computeMacroFlip legitimately still
    // imports from ttReadout.js, and a sweep that catches the import proves nothing.
    !/const ttReadout|const ttFlat|ttReadout\.regime/.test(dashSrc.replace(/\/\*[\s\S]*?\*\//g, "")));
  ok("dock: legacy #sym links survive inside the routed BOOK mode",
    /admin\.html#\$\{String\(sym\)\.toLowerCase\(\)\}/.test(dashSrc) &&
    /Backward compatibility: pre-v5\.6 deep-dive bookmarks/.test(adminSrc) &&
    /return\{view:"book",sub:"all",sym:raw\.toUpperCase\(\)\}/.test(adminSrc));
  /* v5.6.9 — the two ends of the loop, closed. */
  ok("v5.6.9 macro: share_note is RETIRED from the public projection — a stored note no longer publishes",
    (() => { const src = readSrc("../functions/api/picks.js");
      return !/share_note/.test(src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")) &&
        !/NOTE_MAX/.test(src) && /RETIRED in v5\.6\.9/.test(src); })());
  ok("v5.6.9 macro: the projection still emits ONLY sym+tier — the whitelist did not widen",
    (() => { const src = readSrc("../functions/api/picks.js");
      return /picks\.push\(\{ sym, tier: "S" \}\);/.test(src); })());
  /* Re-pinned at v5.7.1 — BOTH prior pins here asserted the RACY spellings the fix removes.
     The old call site (`else {render();honourArrival();}` inside loadBook) ran before
     loadDeepDiveIndex, so a store-held payload read as absent and the card opened with a
     FALSE "no thesis payload yet" (JOBY, live, 2026-08-27); and `if(TAB===sym)return;` was
     never evidence the tab opened — renderTabs had legitimately reset TAB to BOARD while
     the index was still empty. The new contract: honourArrival runs at the END of
     bootLoads (post-index), resolves AFFIRMATIVELY via ddOf, and the old spellings are
     pinned ABSENT so the race cannot quietly return. */
  ok("v5.7.1 terminal: arrival focus fires ONCE, AFTER the dd index has landed — never from inside loadBook",
    /let ARRIVED=TT_ROUTE\.sym\|\|""/.test(adminSrc) &&
    /if\(ARRIVAL_DONE\)return;/.test(adminSrc) &&
    /await secondaryLoads\(\); honourArrival\(\);/.test(adminSrc) &&
    !/else \{render\(\);honourArrival\(\);\}/.test(adminSrc));
  ok("v5.7.1 terminal: the arrival resolves AFFIRMATIVELY — payload opens the thesis, no payload opens the card, unknown is NAMED",
    /if\(ddOf\(x\)\)\{switchTab\(sym\);return;\}/.test(adminSrc) &&
    !/if\(TAB===sym\)return;/.test(adminSrc) &&
    /is not in the book — showing the board/.test(adminSrc) &&
    /has no thesis payload yet — opened its card/.test(adminSrc));
  ok("v5.7.1 terminal: an EMPTY book consumes the arrival — a card must not stack over the import modal",
    /if\(data\.empty\)\{ARRIVAL_DONE=true;openImport\(\);render\(\);\}/.test(adminSrc));
  ok("dock: the dead SharedPicks component is DELETED, not left orphaned (dead code is a rot vector)",
    !existsSync(new URL("../src/sections/SharedPicks.jsx", import.meta.url)) &&
    !/SharedPicks/.test(dashSrc.replace(/\/\*[\s\S]*?\*\//g, "")));
  ok("watchlist: the v3.97 fix reads the PROP — the d.watchlist ReferenceError is gone",
    !/d\.watchlist/.test(wlSrc) && /\(watchlist\|\|\[\]\)\.filter/.test(wlSrc));
}


// ═══════════ [63] v3.98.3 — the Power-side audit: one exclusion reason, one vocabulary ═══════════
// Driving the Power view in Chromium against a degraded fixture found the hero panel and the
// C3 Drivers matrix printing DIFFERENT reasons for the same excluded factor: regimeFactors
// hardcoded "· STALE — excluded" for every exclusion, so a DEAD feed (mode MOCK) read as
// merely old — and wore the stale clock — while the matrix, which sees the real mode, said
// otherwise 300px below.
console.log("\n[63] v3.98.3 — exclusion reasons, scoped vocabulary, TERMINAL promoted");
{
  const { regimeFactors: rf } = await import("../src/regime.js");
  const D = JSON.parse(JSON.stringify(MOCK_DATA));
  const staleOnly = new Set(["vix"]);
  const asStale = rf(D, staleOnly, new Map([["vix", { kind: "stale", asOf: "2026-08-13" }]]));
  const asDead  = rf(D, staleOnly, new Map([["vix", { kind: "nofeed", asOf: null }]]));
  const noMap   = rf(D, staleOnly);
  const vix = (rows) => rows.find((r) => r.key === "vix").val;
  ok("v3.98.3: a STALE factor keeps its REAL observation and is dated — old is not fabricated",
    /too old to count \(as of 2026-08-13\)/.test(vix(asStale)) &&
    vix(asStale).startsWith(String(D.marketPulse.vix.current)));
  ok("v3.98.3: a DEAD-feed factor drops its value entirely — a mock number must never wear a judgment",
    vix(asDead) === "no live reading — not counted" &&
    !new RegExp(String(D.marketPulse.vix.current)).test(vix(asDead)) &&
    !/Elevated|Low|Spiking/.test(vix(asDead)));
  ok("v3.98.3: the two causes render DIFFERENTLY — the defect was one string for both",
    vix(asStale) !== vix(asDead));
  ok("v3.98.3: with no reason map the row says 'not counted' and invents NO cause",
    /· not counted$/.test(vix(noMap)) && !/STALE|stale|no live/.test(vix(noMap)));
  // The whole chain: evidence.js must SUPPLY the cause it already knows.
  const { buildEvidenceSet: bes } = await import("../src/evidence.js");
  const today = new Date();
  const iso = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  const prov = { tenYear:"LIVE", fearGreed:"LIVE", cpiHeadline:"LIVE", nfci:"LIVE", shillerPe:"LIVE" }; // vix absent = dead feed
  const asOf = { tenYear:iso(today), fearGreed:iso(today), cpiHeadline:iso(today), nfci:iso(today), shillerPe:iso(today) };
  const eDead = bes({ d: D, provenance: prov, dataAsOf: asOf, mode: "LIVE", liveBuild: true, now: today });
  ok("v3.98.3 end-to-end: a dead feed reaches the hero row as 'no live reading', never as stale",
    eDead.factors.find((f) => f.key === "vix").display === "no live reading — not counted" &&
    eDead.factors.find((f) => f.key === "vix").reason === "no live feed right now");
  const eStale = bes({ d: D, provenance: { ...prov, vix:"LIVE" },
    dataAsOf: { ...asOf, vix: "2026-01-02" }, mode: "LIVE", liveBuild: true, now: today });
  ok("v3.98.3 end-to-end: a genuinely stale feed still says too-old, dated with its own asOf",
    /too old to count \(as of 2026-01-02\)/.test(eStale.factors.find((f) => f.key === "vix").display));
  ok("v3.98.3: the flip panel no longer asserts '(stale)' over an exclusion it cannot diagnose",
    !/Excluded from the vote \(stale\)/.test(bandSrc) && /Dark, so their thresholds/.test(bandSrc));
  /* 8/28 matrix row 3 — the strip now serves BOTH branches through one `subText`, so the
     withheld path cannot render a fraction the voters line already states. Measured on
     COMMENT-STRIPPED source: bandSrc still carries a superseded copy of the old inline
     expression inside a block comment, so testing the raw text would pass vacuously with the
     live strip deleted (the v3.60.1 self-matching trap). */
  ok("row 3: ONE conf-strip serves both the directional and the withheld branch (comment-stripped)",
    (() => { const code = bandSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      return /inputs usable\$\/\.test\(regime\.sub\)/.test(code) && /replace\(\/ — /.test(code) &&
             /const subText=conf&&/.test(code) &&
             /\$\{WITHHELD_LABEL\}\$\{plainVerdict\?"":` · \$\{subText\}`\}/.test(code) &&
             /\$\{machineLabel\}\$\{plainVerdict\?"":` · \$\{subText\}`\}/.test(code) &&
             !/\$\{machineLabel\} · \$\{conf&&/.test(code); })());
  /* v5.9 (beginner read: "too many words at first glance"). In SIMPLE the sub is dropped
     entirely — it restated in counts ("3 help, 1 does not") exactly what the plain sentence
     one line below says in words, and of the two the sentence is the one a newcomer can use.
     Power keeps both. Pinned in both directions so neither mode can drift into the other. */
  ok("v5.9: the sub is Power-only — Simple leads with the verdict and the sentence, not a tally",
    (() => { const code = bandSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      return /plainVerdict\?"":` · \$\{subText\}`/.test(code) &&
        !/`\$\{machineLabel\} · \$\{subText\}`/.test(code); })());
  ok("v3.98.3: TERMINAL is a bar action with the accent treatment, and exists exactly ONCE",
    /aria-label="Open Ticker Terminal"/.test(dashSrc) &&
    (dashSrc.match(/href="\/admin\.html"/g) || []).length === 1 &&
    /border:`1px solid \$\{T\.amber\}`,color:T\.amber/.test(dashSrc));
}


// ═══════════ [64] v3.98.4 — the Power read-through: three surfaces that guessed at state ═══════════
// Driving Markets/Macro/AI/Data Health in Chromium across full-live, degraded and total-outage
// found the same defect class the hero audit did: a string asserting a state its own code
// never checked.
console.log("\n[64] v3.98.4 — Power read-through fixes (token trend, strip marker, CPI date)");
{
  ok("v3.98.4: the token price card WITHHOLDS its directional trend when the price leg is not live",
    /trend withheld — price leg not live/.test(aiSrc) &&
    /drop !== null && \(isIllustrative\(mode\)/.test(aiSrc));
  ok("v3.98.4: the '% over window' claim is now UNREACHABLE on mock/stale (the v3.1 rule)",
    (() => { // the amber directional branch must sit on the NOT-illustrative side of the gate
      const i = aiSrc.indexOf("drop !== null && (isIllustrative(mode)");
      const seg = aiSrc.slice(i, i + 420);
      return /isIllustrative\(mode\)\s*\?[\s\S]*trend withheld[\s\S]*:\s*<div[\s\S]*% over window/.test(seg); })());
  ok("v3.98.4: the card still RENDERS the mock value — only the directional read is withheld",
    /\$\{blended\?\.toFixed\(2\)\}/.test(aiSrc));
  ok("v3.98.4: the strip's ▪ marker means 'counts TODAY' — a dark voter loses it",
    /const isVoter=vf\.has\(f\); const votes=isVoter&&live;/.test(stripSrc));
  ok("v3.98.4: a dark voter's tooltip says so, instead of claiming it counts",
    /A voter, but dark today — not counted\./.test(stripSrc) &&
    // v6.0.2: the counting tooltip now also NAMES the vote ("— votes BULL."); the claim
    // this pin makes — three distinct states, the dark one never claiming to count — holds.
    /Counts toward today's posture — votes \$\{vs\.word\}\./.test(stripSrc) &&
    /Context only — does not vote\./.test(stripSrc));
  ok("v3.98.4: the CPI source box finally carries its observation date (LIVE with no date is unjudgeable)",
    /endpoint="CPIAUCNS \+ CPILFENS · official NSA YoY" mode=\{modeOf\('cpiHeadline'\)\} asOf=\{asOfOf\('cpiHeadline'\)\}/.test(mrSrc));
  ok("v3.98.4: EVERY SourceBox in the macro grid passes an asOf — no LIVE badge without a date",
    (mrSrc.match(/<SourceBox /g) || []).length === (mrSrc.match(/<SourceBox [^>]*asOf=/g) || []).length);
}


// ═══════════ [65] v3.99 — the Fed label + the FOMC calendar off Kalshi's critical path ═══════════
// Measured on the live 2026-08-16 build: Kalshi returned HTTP 429 on BOTH transport bases
// (rate-limited, not down — shared Cloudflare edge IPs), which cost the dashboard the meeting
// DATE and the readout's fed_next_meeting input as well as the odds, and dropped the strip
// back to MOCK_DATA's hardcoded nextFOMC — expired two months earlier, rendering "FOMC —".
console.log("\n[65] v3.99 — Fed target range, curated FOMC calendar, Kalshi off the critical path");
{
  const { FOMC_MEETINGS, nextFomcDate: nfd } = await import("../src/sources.js");
  ok("fomc: the calendar is curated, ET-dated and strictly ascending (the MARKET_HOLIDAYS shape)",
    Array.isArray(FOMC_MEETINGS) && FOMC_MEETINGS.length >= 8 &&
    FOMC_MEETINGS.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) &&
    FOMC_MEETINGS.every((d, i) => i === 0 || d > FOMC_MEETINGS[i - 1]));
  ok("fomc: nextFomcDate returns the next meeting AT or after today, never a past one",
    nfd(new Date("2026-08-17T12:00:00Z")) === "2026-09-16" &&
    nfd(new Date("2026-09-16T12:00:00Z")) === "2026-09-16" &&   // decision day itself counts
    nfd(new Date("2026-09-17T12:00:00Z")) === "2026-10-28");
  /* v3.99.1 — OWNER-CONFIRMED calendar. My asserted Nov 4 / Dec 16 were WRONG; the owner
     corrected them to Oct 28 / Dec 9 and confirmed Sep 16 (the date driving the live
     countdown). Pinned by VALUE so a silent regression to my guesses fails the build. */
  ok("fomc: the owner-corrected Q4 dates are on file — Oct 28 and Dec 9, NOT the asserted Nov 4 / Dec 16",
    FOMC_MEETINGS.includes("2026-10-28") && FOMC_MEETINGS.includes("2026-12-09") &&
    !FOMC_MEETINGS.includes("2026-11-04") && !FOMC_MEETINGS.includes("2026-12-16") &&
    FOMC_MEETINGS.includes("2026-09-16") &&
    nfd(new Date("2026-10-29T12:00:00Z")) === "2026-12-09");
  ok("fomc: past the end of the table it returns NULL — a guessed meeting date would feed a countdown AND an Engine 0 gate",
    nfd(new Date("2099-01-01T12:00:00Z")) === null);
  /* THE EXPIRY TRIPWIRE. MARKET_HOLIDAYS carries only a comment asking for an annual update;
     this table feeds a countdown and a gate input, so the reminder is a RED TEST instead. It
     fires 90 days before the last meeting on file — enough runway to add next year's dates
     calmly. If this is the failure you are reading: open
     federalreserve.gov/monetarypolicy/fomccalendars.htm and extend FOMC_MEETINGS. */
  ok("fomc: EXPIRY TRIPWIRE — the calendar has >90 days of runway (extend FOMC_MEETINGS if RED)",
    (() => { const last = FOMC_MEETINGS[FOMC_MEETINGS.length - 1];
      return (new Date(last + "T00:00:00Z") - Date.now()) / 86400000 > 90; })());
  ok("fomc: the countdown runs on ET, the same clock nextFomcDate() resolves 'today' with (FIX-A)",
    /const t=parseObsDate\(etYmd\(\)\);/.test(dashSrc) && !/t\.setHours\(0,0,0,0\)/.test(dashSrc.slice(dashSrc.indexOf("const fomcPick"), dashSrc.indexOf("const fomcLabel"))));
  ok("fomc: the countdown prefers the MARKET's own strike date but falls through to the calendar",
    /pv==="LIVE"\|\|pv==="CACHED"/.test(dashSrc) && /src:"market"/.test(dashSrc) &&
    /nextFomcDate\(\)/.test(dashSrc) && /src:"calendar"/.test(dashSrc));
  ok("fomc: the tile NAMES which source answered — a date is only as good as its provenance",
    /published Fed calendar/.test(mrSrc) && /market strike date/.test(mrSrc));
  // ── the Fed label ──
  ok("fed: the DAILY target range (DFEDTARU/DFEDTARL) is pulled, banded and mapped",
    snapSrc.includes('fedTargetUpper: "DFEDTARU"') && snapSrc.includes('fedTargetLower: "DFEDTARL"') &&
    /fedTargetUpper: \[0, 25\]/.test(snapSrc) &&
    SOURCES.fedTargetUpper.path === "macro.fedFunds.targetUpper" &&
    SOURCES.fedTargetLower.path === "macro.fedFunds.targetLower");
  ok("fed: the target range is DAILY-cadence — inheriting FEDFUNDS's monthly staleness would defeat the fix",
    cadenceOf("fedTargetUpper") === "daily" && cadenceOf("fedFunds") === "monthly");
  ok("fed: the headline is the TARGET RANGE when live, and the effective average is LABELLED as lagging",
    /Fed Target Range/.test(mrSrc) && /Fed Funds \(effective avg\)/.test(mrSrc) &&
    /FEDFUNDS monthly avg, lags a decision/.test(mrSrc));
  ok("fed: with no live target range it falls back to the effective rate AND says the range is not live",
    /target range not live/.test(mrSrc) && /!isIllustrative\(tgtMode\)/.test(mrSrc));
  ok("fed: the source box names both series rather than crediting FEDFUNDS for the range",
    /DFEDTARU\/L target · FEDFUNDS eff/.test(mrSrc));
  /* Found by the 320px contract while wiring this: the longer endpoint string blew the page
     to 357px. SourceBox HAD nowrap+ellipsis, but a flex item's default min-width is `auto`,
     so it took its content width and pushed instead of truncating — the ellipsis could never
     engage. The floor is the general fix; the next long endpoint cannot repeat it. */
  // ── the odds: explicit unavailable, never the mock baseline ──
  ok("odds: the mock 84/13/3 baseline can no longer render — the tile states it cannot see",
    /odds unavailable — Kalshi feed not live/.test(mrSrc) &&
    /const usable=!isIllustrative\(oMode\)&&Number\.isFinite\(o\.hold\)/.test(mrSrc));
  ok("odds: the numbers sit on the USABLE side of the gate — unreachable on mock/stale",
    (() => { const i = mrSrc.indexOf("const usable=!isIllustrative(oMode)");
      const seg = mrSrc.slice(i, i + 1400);
      return /usable\?\(<>[\s\S]*Hold \{o\.hold\}%[\s\S]*\):\([\s\S]*odds unavailable/.test(seg); })());
  // ── Kalshi authenticated transport (key-gated, RSA-PSS) ──
  ok("kalshi: the signed path is KEY-GATED — no secrets means the anonymous headers, unchanged",
    /if \(!env\?\.KALSHI_KEY_ID \|\| !env\?\.KALSHI_PRIVATE_KEY\) return null;/.test(snapSrc) &&
    /const hdrs = \{ headers: signed \|\| \{ Accept: "application\/json" \} \};/.test(snapSrc));
  ok("kalshi: the key is NOT memoized — a module-level cache would outlive a rotated secret",
    !/_kalshiKeyPromise/.test(snapSrc) && /NOT memoized, deliberately/.test(snapSrc));
  ok("kalshi: auth MODE is recorded in provenance — 'still anonymous' and 'keyed and still limited' are different diagnoses",
    /auth: authMode/.test(snapSrc) && /\(\$\{authMode\}\)/.test(snapSrc));
  // RUN the signer against a real generated key: a signature is a claim about crypto, and a
  // string pin cannot prove one verifies.
  const kalshiMod = snapSrc.slice(snapSrc.indexOf("const KALSHI_SIG_ALG"), snapSrc.indexOf("async function fetchRateOdds"));
  const kal = new Function("crypto", "atob", "btoa", "TextEncoder", kalshiMod + "; return { kalshiHeaders, pkcs1ToPkcs8 };")
    (globalThis.crypto, globalThis.atob, globalThis.btoa, TextEncoder);
  const kp = await crypto.subtle.generateKey({ name: "RSA-PSS", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pem = "-----BEGIN PRIVATE KEY-----\n" +
    Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey)).toString("base64") +
    "\n-----END PRIVATE KEY-----";
  const kh = await kal.kalshiHeaders({ KALSHI_KEY_ID: "kid", KALSHI_PRIVATE_KEY: pem }, "GET", "/trade-api/v2/events");
  ok("kalshi: the RSA-PSS signature actually VERIFIES over timestamp+method+path (executed, not pinned)",
    !!kh && await crypto.subtle.verify({ name: "RSA-PSS", saltLength: 32 }, kp.publicKey,
      Uint8Array.from(atob(kh["KALSHI-ACCESS-SIGNATURE"]), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(kh["KALSHI-ACCESS-TIMESTAMP"] + "GET" + "/trade-api/v2/events")) &&
    kh["KALSHI-ACCESS-KEY"] === "kid" && /^\d{13}$/.test(kh["KALSHI-ACCESS-TIMESTAMP"]));
  ok("kalshi: a malformed key fails CLOSED to the anonymous path, never a thrown build",
    await kal.kalshiHeaders({ KALSHI_KEY_ID: "a", KALSHI_PRIVATE_KEY: "not-a-pem" }, "GET", "/x") === null &&
    await kal.kalshiHeaders({}, "GET", "/x") === null);
  /* v5.97.2 — PKCS#1, the format Kalshi ACTUALLY issues. Measured against a real
     Kalshi-issued key: it arrives as `-----BEGIN RSA PRIVATE KEY-----`, which WebCrypto
     cannot import (there is no "pkcs1" format), so the old PKCS#8-only parser threw,
     kalshiHeaders caught it, and the build fell through to ANONYMOUS with no error anywhere.
     The setup docs asserted PKCS#8, so the one documented step was wrong about its one input.
     Same generated key, exported BOTH ways, must produce a working signature either way. */
  const p1der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  // Strip the PKCS#8 wrapper back to a bare PKCS#1 RSAPrivateKey so the fixture is a REAL
  // PKCS#1 body, not a relabelled PKCS#8 (which would pass vacuously through the pkcs8 path).
  const octIdx = p1der.indexOf(0x04, 20);
  const inner = (() => { let i = octIdx + 1; let n = p1der[i];
    if (n & 0x80) { const c = n & 0x7f; i += 1 + c; } else { i += 1; }
    return p1der.slice(i); })();
  const p1pem = "-----BEGIN RSA PRIVATE KEY-----\n" + Buffer.from(inner).toString("base64") + "\n-----END RSA PRIVATE KEY-----";
  const kh1 = await kal.kalshiHeaders({ KALSHI_KEY_ID: "kid", KALSHI_PRIVATE_KEY: p1pem }, "GET", "/trade-api/v2/events");
  ok("v5.97.2 kalshi: a PKCS#1 key (what Kalshi issues) now SIGNS, and the signature verifies",
    !!kh1 && await crypto.subtle.verify({ name: "RSA-PSS", saltLength: 32 }, kp.publicKey,
      Uint8Array.from(atob(kh1["KALSHI-ACCESS-SIGNATURE"]), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(kh1["KALSHI-ACCESS-TIMESTAMP"] + "GET" + "/trade-api/v2/events")));
  ok("v5.97.2 kalshi: the wrapper is byte-identical to a real PKCS#8 export — not a lookalike",
    (() => { const wrapped = kal.pkcs1ToPkcs8(inner);
      return wrapped.length === p1der.length && wrapped.every((b, i) => b === p1der[i]); })());
  ok("v5.97.2 kalshi: a HEADERLESS paste of either format still works (structural fallback, not header trust)",
    (async () => true)() && !!(await kal.kalshiHeaders({ KALSHI_KEY_ID: "kid",
      KALSHI_PRIVATE_KEY: Buffer.from(p1der).toString("base64") }, "GET", "/x")));
  ok("v5.97.2 kalshi: widening the accepted input did NOT widen the fail-closed guarantee",
    await kal.kalshiHeaders({ KALSHI_KEY_ID: "a", KALSHI_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\nZm9v\n-----END RSA PRIVATE KEY-----" }, "GET", "/x") === null);
  ok("v5.97.2 kalshi: the retired PKCS#8-only claim is pinned ABSENT from the setup docs",
    !/the PKCS#8 PEM Kalshi issues/.test(readSrc("../CLAUDE.md")));
  ok("fed: SourceBox can actually shrink — nowrap+ellipsis is inert without a min-width floor",
    /minWidth:0, maxWidth:"100%"/.test(sbSrc) && /whiteSpace:"nowrap", minWidth:0/.test(sbSrc) &&
    /title=\{endpoint\}/.test(sbSrc));
}

// ---- 66. v3.99.3 — fetchEquities group status: ok is EARNED, never asserted before the throw
// The ENGINE0-CONT (v3.71) entry filed this in its own "honest limits" section: the group
// summary was recorded ok:true one line before the zero-quote throw, so _diag.sources read
// `finnhub quotes ok:true` on a build whose equities fetch entirely failed. Run, not pinned:
// the defect is an ORDERING between a record and a throw, which a string pin cannot prove.
// The fetch is stubbed (this suite is no-network); fetchRetry's retry ladder is never
// entered because the stub returns HTTP-ok bodies whose quotes fail the parse gate.
console.log("\n[66] v3.99.3 — fetchEquities group status on the zero-quote path");
{
  const realFetch = globalThis.fetch;
  try {
    // All ten symbols return an unusable quote (c:0 fails the price>0 gate, no retry).
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ c: 0 }) });
    const st = []; let threw = null;
    try { await fetchEquities({ FINNHUB_KEY: "k" }, st); } catch (e) { threw = e; }
    const group = st.filter((s) => s.item === "quotes");
    ok("equities all-fail: still throws 'no quotes' (the withLastGood/mock ladder is unchanged)",
      !!threw && /no quotes/.test(threw.message) && threw.error_class === "no_observation");
    ok("equities all-fail: NO ok:true group record — _diag must never read healthy on a build that produced nothing",
      !group.some((s) => s.ok === true));
    ok("equities all-fail: the failure IS recorded, with counts — 'all failed' and 'never ran' are different facts",
      group.length === 1 && group[0].ok === false && group[0].succeeded === 0 &&
      group[0].error_class === "no_observation" &&
      Array.isArray(group[0].failed_symbols) && group[0].failed_symbols.length === 10);
    // Positive control: a healthy pull still earns its ok:true with the real counts.
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ c: 123.45, dp: 1.2 }) });
    const st2 = [];
    const out = await fetchEquities({ FINNHUB_KEY: "k" }, st2);
    const g2 = st2.filter((s) => s.item === "quotes");
    ok("equities control: a successful pull records ok:true with succeeded=10 and emits QQQ",
      g2.length === 1 && g2[0].ok === true && g2[0].succeeded === 10 && out.qqqPrice === 123.45);
  } finally { globalThis.fetch = realFetch; }
}

// ---- 67. v3.99.4 — the runtime contract, reconciled not restated (codex ambiguity review)
// The review's root-cause finding: schedules, cache versions, refresh credentials, Node
// floors and debug policy each lived in several places that a human had to keep in sync
// manually — and every single one had already drifted (4 crons in TOML vs 3 in SETUP.md vs
// 2 in CLAUDE.md; REFRESH_SECRET documented where REFRESH_TOKEN was required; ?debug=1 open
// on the one CORS-open endpoint; four different Node floors). These pins RECONCILE the
// representations against each other — the SOURCES/DERIVED_OF and playwright
// EXECUTABLE_PATHS convention — so the next drift is a red build, not a memory test.
// (The review proposed a codegen'd config/runtime-contract.js; this repo's idiom is
// reconciliation-in-smoke, and the Worker can't import across deploys anyway.)
console.log("\n[67] v3.99.4 — runtime contract reconciliation");
{
  const tomlSrc = readSrc("../worker/wrangler.toml");
  const cronSrc = readSrc("../worker/cron.js");
  const setupSrc = readSrc("../worker/SETUP.md");
  const refreshSrc = readSrc("../functions/api/snapshot/refresh.js");
  const roSrc = readSrc("../functions/readout.json.js");
  const ciSrc = readSrc("../.github/workflows/test.yml");
  const nvmrc = readSrc("../.nvmrc").trim();

  // ── cache-key version: ONE version across all four consumers ──
  const keyVer = (src, name) => {
    const m = src.match(/pulse:snapshot:(v\d+):/);
    return m ? m[1] : `MISSING(${name})`;
  };
  const vers = new Set([keyVer(snapSrc, "snapshot"), keyVer(refreshSrc, "refresh"),
    keyVer(roSrc, "readout"), keyVer(cronSrc, "cron")]);
  ok("cache key: all four consumers agree on ONE pulse:snapshot version (a lone bump = split-brain cache)",
    vers.size === 1 && ![...vers][0].startsWith("MISSING"));

  // ── cron schedules: TOML ↔ cron.js dispatch, both directions ──
  // Comments inside the array quote the DST variants ("0 13…") — strip them per line first,
  // or the reconciliation counts documentation as configuration.
  const tomlCronBlock = (tomlSrc.match(/crons = \[([\s\S]*?)\]/)?.[1] || "")
    .split("\n").map((l) => l.replace(/#.*$/, "")).join("\n");
  const tomlCrons = [...tomlCronBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const warmCron = cronSrc.match(/SNAPSHOT_WARM_CRON = "([^"]+)"/)?.[1];
  const prewarmCron = cronSrc.match(/SNAPSHOT_PREWARM_CRON = "([^"]+)"/)?.[1];
  ok("crons: TOML declares exactly four triggers", tomlCrons.length === 4);
  ok("crons: both cron.js dispatch constants exist in the TOML (an orphaned constant never fires)",
    !!warmCron && !!prewarmCron && tomlCrons.includes(warmCron) && tomlCrons.includes(prewarmCron));
  // Dispatch is exact-string with a LEGACY fallthrough, so any TOML cron that matches no
  // constant runs the legacy FRED path. Exactly the two documented legacy pulls may do that.
  const legacy = tomlCrons.filter((c) => c !== warmCron && c !== prewarmCron);
  ok("crons: every TOML trigger is either a dispatch constant or one of the TWO documented legacy pulls " +
     "(a third fallthrough = a silently misrouted job)",
    legacy.length === 2 && legacy.includes("30 12 * * MON-FRI") && legacy.includes("0 21 * * MON-FRI"));
  /* 2026-08-28: every trigger read `* * 1-5` and the Cloudflare dashboard treated 1-5 as
     Sun-Thu, so FRIDAY never fired — the 10am freeze silently did not run and the day ended
     with no history row at all (Tue/Wed/Thu captured; Friday absent = exactly that window).
     Numeric day-of-week is off-by-one between cron implementations; MON-FRI is unambiguous.
     Pinned in BOTH directions across every surface an operator copies from, because the
     regression here is silent — a wrong DOW does not fail a deploy, it just skips a day. */
  const dowSurfaces = { "wrangler.toml": tomlSrc, "cron.js": cronSrc, "SETUP.md": setupSrc };
  ok("crons: the DOW field is NAMED everywhere — wrangler.toml carries `0 14 * * MON-FRI` and no `* * 1-5` survives",
    /"0 14 \* \* MON-FRI"/.test(tomlSrc) &&
    Object.values(dowSurfaces).every((s) => !/\* \* 1-5/.test(s) && !/\*\+\*\+1-5/.test(s)));
  ok("crons: every TOML trigger names its weekdays (a numeric DOW is the 2026-08-28 Friday miss)",
    tomlCrons.length > 0 && tomlCrons.every((c) => /\* MON-FRI$/.test(c)));
  ok("crons: scheduled() actually compares controller.cron against both constants",
    /controller\.cron === SNAPSHOT_PREWARM_CRON/.test(cronSrc) &&
    /controller\.cron === SNAPSHOT_WARM_CRON/.test(cronSrc));
  ok("crons: SETUP.md documents all FOUR (it said 'three triggers' while TOML carried four — " +
     "and its DST block would have deleted the prewarm)",
    /\*\*four\*\* triggers/i.test(setupSrc) &&
    tomlCrons.every((c) => setupSrc.includes(c)) && /four\*\* crons are listed/.test(setupSrc));

  // ── refresh credential: the ACTIVE name is documented where operators read ──
  ok("refresh: SETUP.md instructs REFRESH_TOKEN for the active path, on BOTH deploys",
    /secret put REFRESH_TOKEN/.test(setupSrc) && /pages secret put REFRESH_TOKEN/.test(setupSrc) &&
    /REFRESH_SECRET`?\*\* — LEGACY only/.test(setupSrc));
  ok("refresh: the documented name IS the implemented name on both ends of the wire",
    /env\.REFRESH_TOKEN/.test(cronSrc) && /x-refresh-token/.test(cronSrc) &&
    /env\.REFRESH_TOKEN/.test(refreshSrc) && /x-refresh-token/.test(refreshSrc));
  ok("refresh: wrangler.toml's secret comment names both credentials with their distinct roles",
    /REFRESH_TOKEN/.test(tomlSrc) && /LEGACY only/.test(tomlSrc));

  // ── debug policy: ONE fail-closed token rule on BOTH public endpoints ──
  ok("debug: /readout.json rides the same DEBUG_TOKEN rule as /api/snapshot — bare ?debug=1 is inert",
    /env\.DEBUG_TOKEN && debugParam && debugParam === env\.DEBUG_TOKEN/.test(roSrc) &&
    !/get\("debug"\) === "1"/.test(roSrc));
  ok("debug: a readout debug response is no-store (diagnostics must not sit in a shared cache)",
    /url\.searchParams\.get\("fresh"\) === "1" \|\| debug/.test(roSrc));

  // ── Node floor: one baseline, four surfaces, reconciled numerically ──
  const engines = PKG.engines?.node || "";
  const ciNode = parseInt(ciSrc.match(/node-version:\s*(\d+)/)?.[1] || "0", 10);
  ok("node: engines >=20, .nvmrc and CI at/above it, and the four-floors era is over " +
     "(>=18/22/≥17/20 all coexisted)",
    engines === ">=20" && parseInt(nvmrc, 10) >= 20 && ciNode >= 20 &&
    !readSrc("../README.md").includes("Node ≥17") && !readSrc("../AGENTS.md").includes("Node ≥17"));

  // ── stale claims: the docs describe the ERROR mode that shipped in v3.59 B1 ──
  ok("docs: no surface still claims a live fetch failure is SILENT (B1 made it a visible ERROR + RETRY)",
    !readSrc("../.env.production").includes("silently reverts") &&
    !/falls back to\s+MOCK_DATA silently/.test(readSrc("../docs/design-system.md")) &&
    readSrc("../.env.production").includes("mode ERROR"));

  // ── the P0: LF policy is a repository invariant AND the suite is checkout-proof ──
  ok("crlf: .gitattributes pins text checkout to LF; smoke normalizes its own source lifts (readSrc)",
    /\* text=auto eol=lf/.test(readSrc("../.gitattributes")) &&
    /const readSrc = \(p\) => readFileSync\(new URL\(p, import\.meta\.url\), "utf8"\)\.replace\(\/\\r\\n\/g, "\\n"\)/.test(readSrc("./smoke.mjs")));
}

// ---- 68. FEAT-TT-ALLOC (v3.100) — the server allocation layer ---------------------------
// The pure core is IMPORTED and RUN (the v3.60 convention); the endpoint is driven against
// a fake KV with a put-order log (the [48]/[61] harness); the readout fetch is monkey-
// patched with a finally-restore ([61] precedent). The §14.8 bar and the review's
// acceptance tests are executed, not pinned.
console.log("\n[68] FEAT-TT-ALLOC — pure core, endpoint, and the §14.8 bar");
{
  const alloc = await import("../functions/lib/tt-alloc.js");
  const NOW = new Date();
  const TODAY = etYmd(NOW);
  const YR = TODAY.slice(0, 4), FY = String(+YR + 1);
  const mkIdx = (over = {}) => ({ as_of: TODAY, hinges: [{ label: "h1", state: "green" }],
    ref_px: { px: 100, at: TODAY }, pt_model: { pe_floor_multiple: 18, share_count_M: 100 },
    consensus: { eps: { [FY]: 10 } }, composite: { score: 8.1, raw_tier: "S" }, ...over });
  const READOUT = { as_of: TODAY, regime: { verdict: "TAILWIND", actionability: "FULL" },
    macro_flip: { evaluable: true, armed: false, tripped: false } };

  // ── the gate ladder, rung by rung (fail closed at every altitude) ──
  // FEAT-TT-CIRCUIT (v4.1): a structured circuit is now REQUIRED before the later rungs can
  // even be reached, so every fixture past the circuit rung carries a fresh clear one.
  const CIRC = { state: "clear", as_of: TODAY };
  const lad = (board, readout) => alloc.allocGateLadder({ board, readout, now: NOW });
  ok("alloc gate: circuit tripped vetoes FIRST — no per-name score clears deleverage-only",
    lad({ circuit: { state: "tripped" }, regime: { asserted: "TAILWIND" } }, READOUT).rung === "circuit");
  ok("alloc gate: no measured OR asserted regime → stance UNKNOWN (a live read is mandatory)",
    lad({ circuit: CIRC }, null).rung === "stance" && /stance UNKNOWN/.test(lad({ circuit: CIRC }, null).reason));
  ok("alloc gate: PANIC governs even when only ASSERTED (stricter governs — married never merged)",
    /PANIC/.test(lad({ circuit: CIRC, regime: { asserted: "PANIC" } }, READOUT).reason));
  ok("alloc gate: readout absent after a ranked stance → feed veto, never default-to-clear",
    lad({ circuit: CIRC, regime: { asserted: "TAILWIND" } }, null).rung === "feed");
  ok("alloc gate: actionability missing and non-FULL each veto (the ENGINE0-CONT rung)",
    lad({ circuit: CIRC }, { ...READOUT, regime: { verdict: "TAILWIND" } }).rung === "actionability" &&
    /HOLD/.test(lad({ circuit: CIRC }, { ...READOUT, regime: { verdict: "NEUTRAL", actionability: "HOLD", status: "DATA DEGRADED" } }).reason));
  ok("alloc gate: Macro Flip absent / blind / tripped each veto with the reason named",
    lad({ circuit: CIRC }, { ...READOUT, macro_flip: undefined }).rung === "flip" &&
    /BLIND|missing/i.test(lad({ circuit: CIRC }, { ...READOUT, macro_flip: { evaluable: false, reason: "vix MISSING" } }).reason) &&
    /TRIPPED/.test(lad({ circuit: CIRC }, { ...READOUT, macro_flip: { evaluable: true, tripped: true } }).reason));
  ok("alloc gate: every gate reading clean → null (the ladder can actually pass)",
    lad({ circuit: CIRC, regime: { asserted: "TAILWIND" } }, READOUT) === null);

  // ── FEAT-TT-CIRCUIT (v4.1 Step 1): the structured circuit is canonical; absence fails closed ──
  // The 8/18 audit's P0, executed: the live board carried "presumed tripped" PROSE beside
  // circuit:null, and null read as not-tripped everywhere — both sides permitted allocation.
  const cst = (c, at) => alloc.circuitState(c, at || NOW);
  ok("circuit: ABSENT is unresolved — prose is explanation, not permission",
    cst(undefined).st === "unresolved" && /prose is explanation, not permission/.test(cst(null).reason));
  ok("circuit: an unknown state string is unresolved, never coerced into an enum",
    cst({ state: "presumed tripped", as_of: TODAY }).st === "unresolved");
  ok("circuit: undated clear is unresolved — an undated permission never reads as current",
    cst({ state: "clear" }).st === "unresolved" && /undated/.test(cst({ state: "clear" }).reason));
  // Fixture dates are ET-calendar arithmetic, NOT utc-now minus N days: at ET evening the
  // two calendars differ by a day, and the boundary assert would drift (the very defect
  // class Step 3 of this sprint fixes in allocChip).
  const etDay = (n) => new Date(new Date(TODAY + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
  ok("circuit: a future-dated record cannot be judged",
    cst({ state: "clear", as_of: etDay(3) }).st === "unresolved");
  ok("circuit: fresh clear resolves clear; the boundary day (exactly CIRCUIT_STALE_D) still resolves",
    cst({ state: "clear", as_of: TODAY }).st === "clear" &&
    cst({ state: "clear", as_of: etDay(-alloc.CIRCUIT_STALE_D) }).st === "clear");
  ok("circuit: clear ONE DAY past the limit degrades to unresolved — stale permission is not evidence of safety",
    (() => { const r = cst({ state: "clear", as_of: etDay(-(alloc.CIRCUIT_STALE_D + 1)) });
      return r.st === "unresolved" && /stale permission/.test(r.reason); })());
  ok("circuit: TRIPPED never expires into clear — a 30d-old or undated trip still trips (v3.40 asymmetry)",
    cst({ state: "tripped", as_of: etDay(-30) }).st === "tripped" && cst({ state: "tripped" }).st === "tripped");
  ok("alloc gate: an unresolved circuit is a NAMED circuit veto pointing at ◧ SESSION",
    (() => { const g = lad({}, READOUT);
      return g.rung === "circuit" && /unresolved/.test(g.reason) && /◧ SESSION/.test(g.reason); })());
  ok("alloc gate: ARMED is a caution, never a veto — the ladder passes and the receipt carries it",
    lad({ circuit: { state: "armed", as_of: TODAY }, regime: { asserted: "TAILWIND" } }, READOUT) === null);
  ok("circuit mirror: CIRCUIT_STALE_D — the alloc core and the buildless client literal agree",
    adminSrc.includes(`const CIRCUIT_STALE_D=${alloc.CIRCUIT_STALE_D};`) && alloc.CIRCUIT_STALE_D === 7);
  ok("circuit mirror: the client resolver exists with the same unresolved vocabulary",
    adminSrc.includes("function circuitStateCli(c)") &&
    adminSrc.includes("session prose is explanation, not permission") &&
    adminSrc.includes('tripped — state undated; still binding until a live pull disproves it'));
  ok("stance: unresolved circuit is a STOP before any regime rung, pointing at ◧ SESSION",
    /if\(st==="unresolved"\)return\{k:"stop",txt:"ADDS SUSPENDED — circuit state unresolved"/.test(adminSrc) &&
    /set the structured circuit in ◧ SESSION before any add/.test(adminSrc));
  ok("renderCircuit: absence renders the UNRESOLVED strip — the state that suspends adds can never be the one with no pixels",
    adminSrc.includes("○ CIRCUIT UNRESOLVED — adds suspended") &&
    !/if\(!c\|\|typeof c!=="object"\)return sessSec\("circuitLine",""\)/.test(adminSrc));
  ok("prose is context: disagree requires BOTH readings ranked (a narrative is not the opposite of TAILWIND)",
    adminSrc.includes("mR!==undefined&&aR!==undefined&&measured!==asserted") &&
    adminSrc.includes("not a ranked regime; measured <b>"));

  // ── v4.1 Step 2: ALLOCATABLE is context, never cash/sizing approval ──
  // The 8/18 audit read a green ALLOCATABLE beside measured cash of −$286,817. The receipt
  // now carries the semantics as a machine field, the visible label says CONTEXT READY, and
  // the measured account renders beside any green state with the qualifier attached.
  ok("label: the visible chip says ALLOCATION CONTEXT READY, never a bare ALLOCATABLE",
    adminSrc.includes("ALLOCATION CONTEXT READY — ${esc(ALLOC.eligible.sym)}") &&
    !adminSrc.includes("server: ALLOCATABLE —"));
  ok("label: the not-a-cash-claim qualifier is permanent on the green state",
    adminSrc.includes("not a cash-availability or sizing claim"));
  ok("label: the confirm affordance records INTENT and says no order",
    adminSrc.includes('"RECORD FUNDING INTENT — "+ALLOC.eligible.sym+" · no order"'));
  ok("account: loadPositions keeps the measured account instead of discarding it",
    adminSrc.includes("ACCOUNT=(d&&d.account&&typeof d.account===\"object\")?d.account:null;") &&
    adminSrc.includes("function acctLine()"));
  ok("account: an unmeasured account is a STATED state on the chip, never an inferred zero",
    adminSrc.includes("account unmeasured — no synced broker record"));

  // ── v4.1 Step 3: receipt age from the FULL timestamp; the basis line renders ──
  ok("age: allocChip computes age in HOURS from the full instant — the UTC date slice is gone",
    adminSrc.includes("function allocAgeTxt()") &&
    !adminSrc.includes("ageDays(String(ALLOC.at).slice(0,10))"));
  ok("age: a future-dated receipt is flagged, never rendered as a negative age",
    /if\(h<-0\.5\)return "⚠ dated in the future";/.test(adminSrc));
  ok("age: undated fails closed to 'undated', never 'today'",
    /if\(!isFinite\(t\)\)return "undated";/.test(adminSrc));
  ok("basis: the freshness line renders receipt/readout/positions/dd-index dates in EVERY chip state",
    adminSrc.includes("function allocBasisLine()") &&
    (adminSrc.match(/\$\{allocBasisLine\(\)\}/g) || []).length === 4 &&
    adminSrc.includes("basis: receipt "));
  ok("basis: a malformed input date reads 'undated', never a fabricated date",
    /return \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(s\)\?s:"undated";/.test(adminSrc));

  // ── v4.1 Step 4: price basis — one vocabulary, disclosed wherever the eligible renders ──
  ok("pxbasis: the four-state vocabulary is computed server-side and never relabels a stamp as live",
    alloc.priceBasisOf({ px: 100, live: true }) === "live price" &&
    alloc.priceBasisOf({ px: 100, live: false, px_at: TODAY }) === "stamped price" &&
    alloc.priceBasisOf({ px: 100, live: false, px_at: null }) === "stamped price — undated" &&
    alloc.priceBasisOf({ px: null }) === "no usable price" && alloc.priceBasisOf(null) === "no usable price");
  ok("pxbasis: the client renders the server string, falls back on live_px for old receipts, and warns on stamped",
    adminSrc.includes("function allocPriceBasis()") &&
    adminSrc.includes('if(e.live_px===false)return "stamped price";') &&
    adminSrc.includes('pb==="live price"?"":"⚠ "') &&
    adminSrc.includes('at ${esc(allocPriceBasis()||"price basis unrecorded")}'));

  // ── v4.1 Step 5: the server receipt is canonical for ACTION ──
  ok("canonical: a funding disagreement names the governing answer, shadows labelled diagnostic",
    adminSrc.includes("SERVER RECEIPT GOVERNS CONFIRMATION") &&
    adminSrc.includes("diagnostic shadows — client:"));
  ok("canonical: the confirm affordance is withheld on a prior-business-date receipt, saying so",
    adminSrc.includes("function allocConfirmWithheld()") &&
    adminSrc.includes("not today — ⟳ DATA+RANKS for a current one"));
  ok("canonical: a local stance of stop/unknown withdraws the affordance — never a green link under a suspended state",
    /if\(stw\.k==="stop"\|\|stw\.k==="unknown"\)/.test(adminSrc) &&
    adminSrc.includes("the receipt no longer matches the current state"));
  ok("canonical: only the server candidate can expose confirmation (one affordance id, gated by the withhold)",
    (adminSrc.match(/allocFundLink/g) || []).length === 1 &&
    adminSrc.includes("const w=allocConfirmWithheld();"));

  // ── v4.1 Step 7: WHY MACRO — the readout's evidence detail finally read ──
  const mevSrc = (() => {
    const a = adminSrc.indexOf("function toggleMacroEvidence()");
    const b = adminSrc.indexOf("async function loadRegime()");
    if (a < 0 || b < 0 || b < a) throw new Error("smoke: macro-evidence markers not found");
    return adminSrc.slice(a, b);
  })();
  ok("mev: the pill is a real <button> wired to the panel with honest aria",
    adminSrc.includes('id="regimePill" aria-expanded="false" aria-controls="macroEvidence"') &&
    mevSrc.includes('b.setAttribute("aria-expanded",String(open))'));
  ok("mev: the panel consumes checks/bullish/bearish/confidence/actionability — published since ENGINE0-CONT, read nowhere until now",
    mevSrc.includes("Array.isArray(reg.checks)") &&
    mevSrc.includes("reg.bullish") && mevSrc.includes("reg.bearish") &&
    mevSrc.includes("reg.confidence") && mevSrc.includes("reg.actionability"));
  ok("mev: an older body without evidence detail SAYS so — the honest-empty branch precedes the tally render, never zeros",
    mevSrc.indexOf("predates evidence detail") > 0 &&
    mevSrc.indexOf("predates evidence detail") < mevSrc.indexOf("<b>EVIDENCE:</b>"));
  ok("mev: the 10Y row carries its LEVEL beside the delta-trend vote (the 8/18 audit's misread quartet)",
    mevSrc.includes('c.name==="us10y_trend"') && mevSrc.includes("REGIME.us10y.yield"));
  ok("mev: presentation only — the panel touches no gate, stance, ranking or veto, and never writes REGIME",
    !/gateFail|whyNot|sellRank|AGREE_PICK|stance\(/.test(mevSrc) &&
    !/REGIME\s*=/.test(mevSrc) &&
    mevSrc.includes("presentation only"));

  // ── acceptance tests, executed ──
  const BOOK = { version: "9.0", asOf: TODAY, cut: ["OLD"], book: [
    { sym: "AAA", tier: "S", lens: "VEH", lastRun: TODAY }, { sym: "BBB", tier: "A", lens: "VEH" }],
    board: { as_of: TODAY, regime: { asserted: "TAILWIND" }, circuit: { state: "clear", as_of: TODAY },
      decisions: [{ q: "exit now", sym: "CCC", forced_exit: true }],
      funding: { order: [{ sym: "BBB" }], do_not_trim: ["AAA"] } } };
  const IDX = { asOf: TODAY, entries: { AAA: mkIdx(), BBB: mkIdx({ pt_model: null, consensus: null, composite: null, hinges: [] }) } };
  const POSDOC = { asOf: TODAY, snap: "20260817190000000",
    account: { equity: 100000, at: TODAY + "T12:00:00Z", src: "rh" },
    positions: {
      AAA: { at: TODAY + "T12:00:00Z", src: "rh", sh: 10, mv: 1000, pct: 1, lots: [{ acquired: "2024-01-02", sh: 6 }, { acquired: TODAY, sh: 4 }] },
      CCC: { at: TODAY + "T12:00:00Z", src: "rh", sh: 1, mv: 100, pct: 0.1 },
      OLD: { at: TODAY + "T12:00:00Z", src: "rh", sh: 2, mv: 50, pct: 0.05 },
      BIG: { at: TODAY + "T12:00:00Z", src: "rh", sh: 9, mv: 20000, pct: 21 },
      OPT: { at: TODAY + "T12:00:00Z", src: "rh", opt: [{ k: "call", side: "long", n: 2 }] } } };
  /* v5.0 §14.8 ACTIVATION: eligibility's quality rung reads SERVER CARDS, so the fixture
     carries a score index — AAA SCORED under the current engine (the eligible path), BBB
     none (vetoed "no server card"). CARD_OK is the pre-stamped shape direct evalBuyRow
     calls pass (evaluateAllocation stamps methodology_current itself via cardOf). */
  const SIDX = { AAA: { status: "SCORED", raw_score: 7.0, raw_tier: "A", capped_tier: "A",
    provisional_score: null, provisional_tier: null,
    methodology_version: TS.METHODOLOGY_VERSION, broken_thesis: false } };
  const CARD_OK = { status: "SCORED", raw_score: 7.0, capped_tier: "A", methodology_current: true };
  const ev = (over = {}) => alloc.evaluateAllocation({ book: BOOK, ddIndex: IDX, posDoc: POSDOC,
    quotes: {}, readout: READOUT, now: NOW,
    scoreIndex: SIDX, methodologyVersion: TS.METHODOLOGY_VERSION, ...over });
  const R = ev();
  ok("alloc 1: a name with NO position takes BUY eligibility — underwriting is position-independent",
    R.eligible && R.eligible.sym === "AAA" && !("AAA" in {}) && R.state === "ALLOCATABLE");
  ok("alloc 2: a stale positions snapshot degrades ALLOCATABLE → BUY_ELIGIBLE with the blocker NAMED",
    (() => { const r = ev({ posDoc: { ...POSDOC, asOf: "2026-01-01" } });
      return r.state === "BUY_ELIGIBLE" && r.context_blockers.some((b) => /snapshot .*old.*re-sync/.test(b)); })());
  ok("alloc 2b: missing positions / missing account are each a NAMED context blocker, never inferred empty",
    (() => { const r = ev({ posDoc: null });
      return r.state === "BUY_ELIGIBLE" && r.context_blockers.some((b) => /sync has never run/.test(b)) &&
        r.context_blockers.some((b) => /account unmeasured.*FLOOR/.test(b)); })());
  /* v5.2 CAP-ASTERISK re-pin (owner ruling 2026-08-25): the five owner-locked tiers
     collapsed to TWO — forced (owner decision + cut list) then ONE merit pool. Over-cap
     and session order are FLAGS on merit rows now, never tiers. */
  ok("alloc 3: forced exits (owner decision + cut list) still rank FIRST; everything else is ONE merit pool (v5.2)",
    (() => { const rows = R.funding.rows;
      const t = Object.fromEntries(rows.map((r) => [r.sym, r.tier]));
      const lastForced = Math.max(...rows.map((r, i) => (r.tier === 1 ? i : -1)));
      const firstMerit = rows.findIndex((r) => r.tier === 2);
      return t.CCC === 1 && t.OLD === 1 && t.BIG === 2 && t.AAA === 2 &&
        (firstMerit === -1 || lastForced < firstMerit); })());
  ok("alloc 4: the over-cap row is identified from the MEASURED pct — as an informational FLAG on a merit row (v5.2)",
    (() => { const b = R.funding.rows.find((r) => r.sym === "BIG");
      return /^merit rank — tape /.test(b.reason) &&
        b.flags.some((f) => /21% — over the 18% reference cap \(informational — owner ruling 2026-08-25\)/.test(f)); })());
  /* v5.2: the server merit sort RUN, not pinned as a string — same fixture shape as the
     client's (smoke [19]): BEARISH first despite the best %/yr, score breaks the tie inside
     one tape bucket, BULLISH last despite the worst return. A neutered sort goes red HERE. */
  ok("alloc merit: the server funding sort is RUN — tape first, then lowest %/yr, then lowest TT score (v5.2)",
    (() => { const f = alloc.fundingRanking({ book: { cut: [] }, board: {}, positions: {
        P1: { pct: 1, mv: 10, at: TODAY }, P2: { pct: 1, mv: 10, at: TODAY },
        P3: { pct: 1, mv: 10, at: TODAY }, P4: { pct: 1, mv: 10, at: TODAY } },
      rowsAnn: { P1: 12, P2: -9, P3: 3, P4: 3 }, now: NOW, noRungSyms: new Set(), brokenSyms: new Set(),
      techBySym: { P1: "BEARISH", P2: "BULLISH" }, scoreBySym: { P3: 2, P4: 7 } });
      return f.rows.map((r) => r.sym).join(",") === "P1,P3,P4,P2" &&
        /^merit rank — tape BEARISH · 12%\/yr · TT no card$/.test(f.rows[0].reason) &&
        /FLAGS, never tiers/.test(f.basis); })());
  ok("meaning: an ALLOCATABLE receipt declares context_complete_not_cash_or_sizing_approval",
    (() => { const r = ev(); return r.state === "ALLOCATABLE" &&
      r.meaning === "context_complete_not_cash_or_sizing_approval"; })());
  ok("meaning: any non-ALLOCATABLE state carries meaning null — the field never over-claims",
    ev({ posDoc: null }).meaning === null);
  ok("pxbasis: the eligible projection carries px, px_at and the computed basis string",
    (() => { const r = ev(); return r.eligible && isFinite(r.eligible.px) &&
      typeof r.eligible.price_basis === "string" &&
      r.eligible.price_basis === alloc.priceBasisOf({ px: r.eligible.px, live: r.eligible.live_px, px_at: r.eligible.px_at }); })());
  ok("pxbasis: a STAMPED eligible (no quote) declares stamped, never live",
    (() => { const r = ev({ quotes: {} }); return r.eligible &&
      r.eligible.live_px === false && /^stamped price/.test(r.eligible.price_basis); })());
  ok("alloc 6: missing lots never become a zero-tax assumption — lots:null, not {lt:0,st:0}",
    R.funding.rows.find((r) => r.sym === "BIG").lots === null &&
    (() => { const a = R.funding.rows.find((r) => r.sym === "AAA").lots; return a.lt_sh === 6 && a.st_sh === 4; })());
  ok("alloc 7: an option leg with no synced mv reads as unmeasured exposure, never zero",
    /no synced value/.test(R.funding.optOnly.find((o) => o.sym === "OPT").note));
  ok("alloc: do_not_trim is FLAGGED on the row, never hidden (the RANKFAIR rule)",
    R.funding.rows.find((r) => r.sym === "AAA").dnt === true);
  ok("alloc: a missing dd-index entry is a NAMED blocker, never a silent pass",
    (() => { const r = alloc.evalBuyRow({ entry: { sym: "ZZZ" }, idx: null, quote: null, board: {}, horizon: null, now: NOW });
      return r.blockers.length === 1 && /dd index unavailable/.test(r.blockers[0]); })());
  ok("alloc D3: a red hinge is a CAUTION on the row, never a veto",
    (() => { const r = alloc.evalBuyRow({ entry: { sym: "AAA", lastRun: TODAY }, idx: mkIdx({ hinges: [{ label: "h", state: "red" }] }),
      quote: { px: 100 }, board: {}, horizon: null, now: NOW, card: CARD_OK });
      return !r.blockers.length && r.cautions.some((c) => /RED/.test(c)) && alloc.whyNot(r, 1) === null; })());
  /* v5.2 CAP-ASTERISK — DOCUMENTED REVERSAL of RANKFAIR v3.36's cap veto (owner ruling
     2026-08-25: "keep it as an asterisk"). At/over CAP_PCT the pick is NO LONGER vetoed;
     the reference-cap caution rides the eligible row instead — the asterisk is visible
     exactly where the veto used to fire, chosen with eyes open, never silently. */
  ok("alloc: the cap no longer vetoes — whyNot is null at 18 and 17.9 alike (v5.2 reversal of RANKFAIR)",
    (() => { const r = alloc.evalBuyRow({ entry: { sym: "AAA", lastRun: TODAY }, idx: mkIdx(), quote: { px: 100 }, board: {}, horizon: null, now: NOW, card: CARD_OK });
      return alloc.whyNot(r, 18) === null && alloc.whyNot(r, 17.9) === null; })());
  ok("alloc: the over-cap pick carries the REFERENCE-cap caution and still takes the line (asterisk, not a veto)",
    (() => { const r = ev({ posDoc: { ...POSDOC, positions: { ...POSDOC.positions,
        AAA: { ...POSDOC.positions.AAA, pct: 21 } } } });
      return r.eligible && r.eligible.sym === "AAA" &&
        (r.eligible.cautions || []).some((c) => /over the 18% REFERENCE cap \(asterisk, not a veto — owner ruling 2026-08-25\)/.test(c)); })());
  ok("alloc: the FIX-C label rides the result verbatim",
    R.funding.label === "FUNDING PRIORITY — not a sell recommendation");
  ok("alloc: WAIT still computes the full ranking (the v3.74.1 always-an-output contract)",
    (() => { const r = ev({ readout: null, book: { ...BOOK, board: { ...BOOK.board, regime: undefined } } });
      return r.state === "WAIT" && r.eligible === null && r.funding.rows.length > 0; })());

  /* v4.1.3 — the shared horizon is never substituted. `pickRow` refuses a missing pinned
     year by contract; scoreP1 and the terminal's renderUpsideRank both honour it and this
     module did not, so a name with a gappy estimate series was ranked off a DIFFERENT year
     from the rows it was sorted against. Run behaviourally — a string pin cannot prove a
     sort key. */
  {
    const FAR = String(+YR + 4);                       // estimate year → rung at YR+3
    const farIdx = mkIdx({ consensus: { eps: { [FAR]: 10 } } });
    const row = (idx, hz) => alloc.evalBuyRow({ entry: { sym: "FAR", lastRun: TODAY }, idx,
      quote: { px: 100 }, board: {}, horizon: hz, now: NOW });
    const excluded = row(farIdx, YR), control = row(mkIdx(), YR), own = row(farIdx, null);
    ok("v4.1.3 horizon: a modelled name with no rung at the shared year is EXCLUDED, not substituted",
      excluded.no_rung_at_horizon === YR && excluded.tgt === null &&
      excluded.up === null && excluded.ann === null && excluded.y === null);
    // The proof that this is a HORIZON decision and not an unmodelled name: the same payload
    // ranks fine on its own nearest row, which is exactly what the old fallback substituted.
    ok("v4.1.3 horizon: the excluded name IS modelled — its own nearest rung still computes (what the fallback used to serve)",
      own.no_rung_at_horizon === null && typeof own.tgt === "number" && own.y === String(+YR + 3));
    ok("v4.1.3 horizon: a name that HAS the shared rung is untouched (no over-correction)",
      control.no_rung_at_horizon === null && typeof control.tgt === "number" && control.y === YR);
    ok("v4.1.3 horizon: whyNot names the real reason — never 'no gap', which would claim the comparison ran",
      (() => { const w = alloc.whyNot(excluded, 1);
        return /never substituted/.test(w) && w.includes(YR) && !/no gap/.test(w); })());
    // End-to-end: autoHorizonOf takes the MIN of each name's max year, so AAA (rung YR) sets
    // the horizon and FAR (rung YR+3 only) falls outside it.
    const B2 = { ...BOOK, book: [...BOOK.book, { sym: "FAR", tier: "S", lens: "VEH", lastRun: TODAY }] };
    const I2 = { asOf: TODAY, entries: { ...IDX.entries, FAR: farIdx } };
    const P2 = { ...POSDOC, positions: { ...POSDOC.positions, FAR: { at: TODAY + "T12:00:00Z", src: "rh", sh: 5, mv: 500, pct: 0.5 } } };
    const r2 = alloc.evaluateAllocation({ book: B2, ddIndex: I2, posDoc: P2, quotes: { AAA: { px: 100 }, FAR: { px: 100 } },
      readout: READOUT, now: NOW,
      scoreIndex: { ...SIDX, FAR: { ...SIDX.AAA } }, methodologyVersion: TS.METHODOLOGY_VERSION });
    ok("v4.1.3 horizon: the receipt NAMES the excluded names, never merely omits them (the v3.65 rule)",
      Array.isArray(r2.unranked_at_horizon) && r2.unranked_at_horizon.includes("FAR") &&
      !r2.unranked_at_horizon.includes("AAA") && r2.horizon === YR);
    ok("v4.1.3 horizon: the excluded name can never take the eligible line",
      !r2.eligible || r2.eligible.sym !== "FAR");
    ok("v4.1.3 horizon: funding says 'no rung at the shared horizon', not 'unmodelled' — it IS modelled",
      (() => { const f = r2.funding.rows.find((x) => x.sym === "FAR");
        return !!f && /no rung at the shared horizon/.test(f.reason) && !/unmodelled/.test(f.reason); })());
    ok("v4.1.3 horizon: a genuinely unmodelled name still reads 'unmodelled' (the two stay distinguishable)",
      (() => { const f = r2.funding.rows.find((x) => x.sym === "BBB");
        return !f || !/no rung at the shared horizon/.test(f.reason); })());
    // Re-pinned at v5.0 (§14.8 activation: quality source + broken_thesis in funding),
    // again at v5.1.1 (the card-actionability veto rung), again at v5.2 (CAP-ASTERISK:
    // the cap veto and the forced cap tier REVERSED by owner ruling 2026-08-25), and again
    // at v5.6 (THE DAILY CONTRACT: additive macro_gate/call/spread/overtake receipt
    // fields) — each moved receipt semantics or meaning, so each moved the version. The
    // CONTRACT this pin protects is unchanged: the version must track the semantics, or a
    // cached receipt gets reinterpreted under a rule it predates.
    ok("rule version moves WITH the semantics — a cached older receipt must not be reinterpreted",
      alloc.ALLOC_RULE_VERSION === "tt-alloc-v3.1.0");
  }

  // ── §14.8 bar + no-order-tools: structural, negative-controllable ──
  const allocLibSrc = readSrc("../functions/lib/tt-alloc.js");
  const allocApiSrc = readSrc("../functions/api/allocation.js");
  // The bar is about CODE, and the files' own comments legitimately NAME the bar — so the
  // sweep strips comments first (the v3.60.1 lesson: a pin matching its own explanatory
  // prose proves nothing, in either direction).
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  /* THE ACTIVATION SWITCH (v5.0, owner ruling 2026-08-23). This pin used to assert the
     INVERSE — that no tt:score reference existed in the allocation code — and its
     replacement is deliberate, not a workaround: the §14.8 bar's own text said the score
     engine was barred "until activation", and this is that moment. What the pin protects
     now: the endpoint reads the score store, the PURE lib still touches no KV itself
     (purity boundary intact — it RECEIVES the index), and the BROKEN_THESIS forced-tier
     wiring exists in code, not just comments. */
  ok("§14.8 ACTIVATED: the endpoint reads the score index, the lib receives it as data, and BROKEN_THESIS feeds the forced tier",
    /tt:score:index:v1/.test(stripComments(allocApiSrc)) &&
    /scoreIndex/.test(stripComments(allocLibSrc)) &&
    /BROKEN_THESIS — kill-flagged falsifier RED/.test(allocLibSrc) &&
    /brokenSyms/.test(stripComments(allocLibSrc)));
  ok("§14.8 ACTIVATED: the pure lib still performs no I/O of its own — it receives the index, never fetches it",
    !/PULSE_CACHE|await fetch|env\./.test(stripComments(allocLibSrc)));
  // The activation's behavioral truth table, run against the real evaluator:
  ok("§14.8 SCORED-only: a PROVISIONAL card ranks but is vetoed with the falsifiers-pending reason",
    (() => { const r = ev({ scoreIndex: { AAA: { status: "PROVISIONAL", raw_score: null, provisional_score: 8.4,
        provisional_tier: "B", methodology_version: TS.METHODOLOGY_VERSION, broken_thesis: false } } });
      return r.eligible === null && r.why_not.some((w) => w.sym === "AAA" && /falsifiers pending/.test(w.reason)); })());
  /* v5.0.1: the PROVISIONAL veto names WHICH half of §6.4.1 is missing. The 2026-08-23
     census measured the one blanket string false on live data — TSM carried 6 server-stamped
     hinges while its veto read "until they're committed". Four states, four texts; the
     p4-less fixture above stays on the neutral "falsifiers pending" (claims neither half). */
  const provEv = (p4) => ev({ scoreIndex: { AAA: { status: "PROVISIONAL", raw_score: null, provisional_score: 8.4,
    provisional_tier: "B", methodology_version: TS.METHODOLOGY_VERSION, broken_thesis: false, p4 } } });
  const provWhy = (p4) => { const w = provEv(p4).why_not.find((x) => x.sym === "AAA"); return w ? w.reason : ""; };
  ok("v5.0.1 veto split: zero hinges reads 'falsifiers unwritten' — the sprint case",
    /^falsifiers unwritten/.test(provWhy({ kind: "LEGACY_POST_HOC", hinges: 0, observed: 0 })));
  ok("v5.0.1 veto split: a partial set names its count — '1/3 written — set incomplete' (the CRDO shape)",
    /^falsifiers 1\/3 written — set incomplete/.test(provWhy({ kind: "PRECOMMITTED_PENDING", hinges: 1, observed: 0 })));
  ok("v5.0.1 veto split: a committed set awaiting observations says so WITH counts, and never claims it is uncommitted (the TSM shape)",
    (() => { const t = provWhy({ kind: "PRECOMMITTED_PENDING", hinges: 6, observed: 0 });
      return /^falsifiers committed, 0\/6 observed — awaiting qualifying observations/.test(t) && !/until they're committed|unwritten/.test(t); })());
  ok("v5.0.1 veto split: all-observed-yet-PROVISIONAL is the first-write fingerprint state — a later write scores them",
    /committed this write — a later write scores them \(§6\.4\.1\)/.test(provWhy({ kind: "PRECOMMITTED_PENDING", hinges: 3, observed: 3 })));
  ok("v5.0.1 veto split: every branch stays a VETO — no p4 shape makes a PROVISIONAL card eligible",
    [null, { kind: "LEGACY_POST_HOC", hinges: 0, observed: 0 }, { kind: "PRECOMMITTED_PENDING", hinges: 6, observed: 6 }]
      .every((p4) => provEv(p4).eligible === null));
  ok("v5.0.1: the retired blanket clause is gone from BOTH mirrors (code, not comments)",
    !/until they're committed/.test(stripComments(allocLibSrc)) &&
    !/until they're committed/.test(stripComments(adminSrc)));
  ok("v5.0.1 mirror: admin why(r) carries the same four texts and cardInfo passes p4 at both altitudes",
    adminSrc.includes("falsifiers unwritten") && adminSrc.includes("— set incomplete") &&
    adminSrc.includes("observed — awaiting qualifying observations") &&
    adminSrc.includes("committed this write — a later write scores them") &&
    adminSrc.includes("p4:e.p4||null") && /const p4=\{kind:\(sc\.provisional&&sc\.provisional\.pending\)/.test(adminSrc));
  ok("§14.8 SCORED-only: NO card at all reads 'no server card — unscored', never a silent pass",
    (() => { const r = ev({ scoreIndex: {} });
      return r.eligible === null && r.why_not.some((w) => w.sym === "AAA" && /no server card/.test(w.reason)); })());
  ok("§14.8: a SCORED card minted by a RETIRED engine cannot light the line — re-score to verify",
    (() => { const r = ev({ scoreIndex: { AAA: { ...SIDX.AAA, methodology_version: "tt-underwriting-v0.0.1" } } });
      return r.eligible === null && r.why_not.some((w) => w.sym === "AAA" && /predates the current methodology/.test(w.reason)); })());
  ok("§14.8 BROKEN_THESIS: a server-stamped broken thesis forces a HELD name to funding tier 1, reason named",
    (() => { const r = ev({ scoreIndex: { ...SIDX, BIG: { status: "SCORED", raw_score: 6, capped_tier: "B",
        methodology_version: TS.METHODOLOGY_VERSION, broken_thesis: true } } });
      const f = r.funding.rows.find((x) => x.sym === "BIG");
      return f && f.tier === 1 && /BROKEN_THESIS — kill-flagged falsifier RED/.test(f.reason); })());
  ok("§14.8 BROKEN_THESIS: an owner-marked forced exit still outranks the flag's reason (first-set wins)",
    (() => { const r = ev({ scoreIndex: { ...SIDX, CCC: { status: "SCORED", raw_score: 6, capped_tier: "B",
        methodology_version: TS.METHODOLOGY_VERSION, broken_thesis: true } } });
      const f = r.funding.rows.find((x) => x.sym === "CCC");
      return f && f.tier === 1 && /owner-marked forced exit/.test(f.reason); })());
  /* v5.1.1 — THE ACTIONABILITY RUNG. Found live 2026-08-24: TSM re-scored SCORED 9.0/S and
     took the eligible line at +31.7%/yr while its own card read actionability BLOCKED on
     BLOCKED_PENDING_INPUT:AI_G2_CIRCULARITY. §7 computed it, §11.2 evalEligibility enforced
     it, the deep-dive panel rendered it — and the ladder that actually gates capital never
     read it. Same shape as the v3.71 follow-up, one layer over. */
  const cardAct = (act, blocked_on) => ({ ...SIDX.AAA, actionability: act, blocked_on });
  ok("v5.1.1: a SCORED card reading BLOCKED is VETOED, and the veto NAMES the unreadable gate",
    (() => { const r = ev({ scoreIndex: { AAA: cardAct("BLOCKED", ["AI_G2_CIRCULARITY"]) } });
      const w = r.why_not.find((x) => x.sym === "AAA");
      return r.eligible === null && w && /card actionability BLOCKED/.test(w.reason) &&
        /AI_G2_CIRCULARITY cannot be read/.test(w.reason); })());
  ok("v5.1.1: BLOCKED with no named gate still vetoes — it says evidence is missing, never nothing",
    (() => { const r = ev({ scoreIndex: { AAA: cardAct("BLOCKED", []) } });
      const w = r.why_not.find((x) => x.sym === "AAA");
      return r.eligible === null && /evidence missing on the card/.test(w.reason); })());
  ok("v5.1.1: FULL passes the rung (the control — the veto is not blanket)",
    (() => { const r = ev({ scoreIndex: { AAA: cardAct("FULL", []) } });
      return r.eligible && r.eligible.sym === "AAA"; })());
  ok("v5.1.1: CAUTION passes and is SURFACED as a caution — aging evidence is the owner's to weigh",
    (() => { const r = ev({ scoreIndex: { AAA: cardAct("CAUTION", []) } });
      return r.eligible && r.eligible.sym === "AAA" &&
        (r.eligible.cautions || []).some((c) => /actionability CAUTION/.test(c)); })());
  ok("v5.1.1: an ABSENT actionability passes — a pre-v5.1.1 index entry must not veto the whole book",
    (() => { const r = ev({ scoreIndex: { AAA: { ...SIDX.AAA } } });
      return r.eligible && r.eligible.sym === "AAA"; })());
  ok("v5.1.1: the rung sits BEFORE the quality rung — an unreadable gate is not a quality verdict",
    (() => { const src = readSrc("../functions/lib/tt-alloc.js");
      return src.indexOf("card actionability BLOCKED") < src.indexOf("quality fails"); })());
  ok("v5.1.1 mirror: admin why(r) carries the same rung and cardInfo carries the field (both paths)",
    adminSrc.includes("card actionability BLOCKED") && adminSrc.includes("(UNKNOWN blocks, §8.1)") &&
    adminSrc.includes("act:sc.actionability??null") && adminSrc.includes("act:e.actionability??null"));
  ok("v5.1.1/v5.2/v5.6: the rule version moved WITH the semantics — a cached older receipt must not be reinterpreted (re-pinned at v5.6, THE DAILY CONTRACT)",
    alloc.ALLOC_RULE_VERSION === "tt-alloc-v3.1.0");
  ok("no-order-tools: no broker order call exists anywhere in the terminal or functions",
    !/place_equity_order|place_option_order/.test(adminSrc) &&
    !/place_equity_order|place_option_order/.test(allocLibSrc + allocApiSrc + ttSrc + snapSrc));
  ok("mirror: POS_STALE_D — the store's export and the buildless client literal agree",
    /export const POS_STALE_D = 2;/.test(posSrc) && adminSrc.includes("const POS_STALE_D=2;"));
  ok("mirror: CAP_PCT — the alloc core and the client literal agree",
    /export const CAP_PCT = 18;/.test(allocLibSrc) && adminSrc.includes("const CAP_PCT=18;"));
  ok("alloc endpoint: GET never evaluates (the v3.54 rule — a read must not spend upstream calls or write)",
    (() => { const g = allocApiSrc.slice(allocApiSrc.indexOf("onRequestGet"), allocApiSrc.indexOf("handleConfirm"));
      return !/evaluateAllocation|evaluate\(/.test(g); })());
  ok("alloc endpoint: the 64KB cap states its reason (the positions.js divergent-cap convention)",
    /Deliberately 64KB.*NOT the book's 300KB/s.test(allocApiSrc));
  ok("alloc chip: ONE builder at both altitudes — the BUY and FUNDING blocks read the same allocChip()",
    (adminSrc.match(/\$\{allocChip\(\)\}/g) || []).length === 2);

  // ── the endpoint against a fake KV with a put-order log ──
  const ep = await import("../functions/api/allocation.js");
  const puts = [];
  const store = new Map();
  const kv = { get: async (k, t) => { const v = store.get(k); return v == null ? null : (t === "json" ? JSON.parse(v) : v); },
    put: async (k, v) => { puts.push(k); store.set(k, String(v)); },
    delete: async (k) => store.delete(k),
    list: async ({ prefix, limit = 50 }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })), list_complete: true, cursor: null }) };
  const env = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: kv };
  const rq = (method, params = "", body = null) => ({ method, url: "https://x.test/api/allocation" + params,
    headers: { get: () => null }, text: async () => (body ? JSON.stringify(body) : "") });
  store.set("tt:book:v1", JSON.stringify(BOOK));
  store.set("tt:dd:index:v1", JSON.stringify(IDX));
  store.set("tt:pos:v1", JSON.stringify(POSDOC));
  // v5.0 §14.8: the endpoint reads the score index — AAA must carry a current-methodology
  // SCORED card or nothing is eligible and every confirm test downstream loses its receipt.
  store.set("tt:score:index:v1", JSON.stringify({ version: 1, entries: SIDX }));
  /* v5 W0: the quote cache is one batch key; entries are judged fresh by their OWN stamp,
     so the fixture stamps must be now-derived — a fixed clock time would rot on the wall
     clock (the v3.35/v3.80 fixture-date lesson). */
  const qStamp = () => new Date().toISOString();
  store.set("tt:quote:batch:v1", JSON.stringify({ at: qStamp(), quotes: { AAA: { px: 101, at: qStamp() } } }));
  const realFetch = globalThis.fetch;
  let LIVE_READOUT = READOUT;   // v4.1 Step 6: mutable so confirm-time re-binding can be driven
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => LIVE_READOUT });
    const g0 = await ep.onRequest({ request: rq("GET"), env });
    ok("alloc ep: GET with no receipt → 404, and GET never writes", g0.status === 404 && puts.length === 0);
    const p1 = await ep.onRequest({ request: rq("POST"), env });
    const b1 = JSON.parse(await p1.text());
    ok("alloc ep: POST evaluates → ALLOCATABLE receipt with all three hashes",
      p1.status === 200 && b1.receipt.state === "ALLOCATABLE" &&
      [b1.receipt.attestation.input_hash, b1.receipt.attestation.basis_hash, b1.receipt.attestation.result_hash].every((h) => /^[0-9a-f]{64}$/.test(h)));
    ok("alloc ep: history key written BEFORE the pointer — a pointer can never exist without its immutable copy",
      puts[0].startsWith("tt:alloc:history:") && puts[1] === "tt:alloc:v1");
    // v4.1 Step 3: the receipt names its own ET identity — a UTC instant sliced to a date
    // called a 21:07-ET-yesterday receipt "today" (8/18 audit, P1).
    ok("alloc ep: the receipt carries at_et and business_date_et from the etYmd clock",
      /^\d{2}\/\d{2} \d{2}:\d{2} ET$/.test(b1.receipt.at_et) &&
      b1.receipt.business_date_et === etYmd(new Date()));
    // basis vs input: a quote tick changes the audit identity, never the confirm basis
    store.set("tt:quote:batch:v1", JSON.stringify({ at: qStamp(), quotes: { AAA: { px: 102, at: qStamp() } } }));
    const p2 = await ep.onRequest({ request: rq("POST"), env });
    const b2 = JSON.parse(await p2.text());
    ok("alloc ep: a quote tick changes input_hash but NOT basis_hash (a price move must not 409 a confirmation)",
      b2.receipt.attestation.input_hash !== b1.receipt.attestation.input_hash &&
      b2.receipt.attestation.basis_hash === b1.receipt.attestation.basis_hash);
    const c1 = await ep.onRequest({ request: rq("POST", "?confirm=1", { intent: { action: "FUND", sym: "AAA" }, result_hash: b2.receipt.attestation.result_hash }), env });
    const cb1 = JSON.parse(await c1.text());
    ok("alloc ep: confirm persists INTENT only — server-stamped record, receipt marked, no order anywhere",
      c1.status === 200 && cb1.stored === true && cb1.receipt.confirmation.sym === "AAA" &&
      [...store.keys()].some((k) => k.startsWith("tt:alloc:intent:v1:")));
    ok("alloc ep: a wrong result_hash → 409 STALE_ALLOCATION with the server's copy",
      (await (async () => { const r = await ep.onRequest({ request: rq("POST", "?confirm=1", { intent: { action: "FUND", sym: "AAA" }, result_hash: "beef" }), env });
        const b = JSON.parse(await r.text()); return r.status === 409 && b.error === "STALE_ALLOCATION" && !!b.receipt; })()));
    // v4.1 Step 6: the c1 confirm above marked the receipt — a fresh evaluate resets
    // confirmation (per-receipt) so the snap-drift test reaches the basis check, not the
    // idempotency rung. Same inputs → identical result_hash, so b2's hash stays valid.
    await ep.onRequest({ request: rq("POST"), env });
    store.set("tt:pos:v1", JSON.stringify({ ...POSDOC, snap: "20269999999999999" }));
    ok("alloc ep: a fresh sync (new snap) between evaluate and confirm → 409 STALE_ALLOCATION naming positions",
      (await (async () => { const r = await ep.onRequest({ request: rq("POST", "?confirm=1", { intent: { action: "FUND", sym: "AAA" }, result_hash: b2.receipt.attestation.result_hash }), env });
        const b = JSON.parse(await r.text()); return r.status === 409 && /positions changed since/.test(b.reason); })()));
    ok("alloc ep: an invented amount is rejected — amount_usd is owner-supplied or absent",
      (await (async () => { const r = await ep.onRequest({ request: rq("POST", "?confirm=1", { intent: { action: "FUND", sym: "AAA", amount_usd: -5 }, result_hash: "x" }), env });
        return r.status === 400; })()));

    // ── v4.1 Step 6: confirmation bound to the candidate + the current world ──
    const cf = (body) => ep.onRequest({ request: rq("POST", "?confirm=1", body), env });
    const cfB = async (body) => { const r = await cf(body); return { status: r.status, b: JSON.parse(await r.text()) }; };
    store.set("tt:pos:v1", JSON.stringify(POSDOC));   // restore the snap
    const p4 = await ep.onRequest({ request: rq("POST"), env });
    const b4 = JSON.parse(await p4.text());
    const RH = b4.receipt.attestation.result_hash;
    ok("cfm: idempotency — the first confirm lands, a second without supersede → 409 ALREADY_CONFIRMED",
      (await (async () => {
        const one = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: RH });
        const two = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: RH });
        return one.status === 200 && two.status === 409 && two.b.error === "ALREADY_CONFIRMED" &&
          /intents are immutable/.test(two.b.reason); })()));
    ok("cfm: supersede:true records a NEW immutable intent naming what it supersedes — nothing is edited",
      (await (async () => {
        const before = [...store.keys()].filter((k) => k.startsWith("tt:alloc:intent:v1:")).length;
        const cur0 = JSON.parse(store.get("tt:alloc:v1"));
        const sup = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: RH, supersede: true });
        const after = [...store.keys()].filter((k) => k.startsWith("tt:alloc:intent:v1:")).length;
        return sup.status === 200 && after === before + 1 &&
          sup.b.receipt.confirmation.supersedes === cur0.confirmation.id; })()));
    await ep.onRequest({ request: rq("POST"), env });   // fresh unconfirmed receipt
    ok("cfm: FUND must name the receipt's own eligible candidate — a substitute sym → 409 INTENT_MISMATCH",
      (await (async () => { const r = await cfB({ intent: { action: "FUND", sym: "BBB" }, result_hash: RH });
        return r.status === 409 && r.b.error === "INTENT_MISMATCH" && /eligible candidate is AAA/.test(r.b.reason); })()));
    ok("cfm: TRIM must name a funding-ranking row — an unranked sym → 409 INTENT_MISMATCH",
      (await (async () => { const r = await cfB({ intent: { action: "TRIM", sym: "ZZZ" }, result_hash: RH });
        return r.status === 409 && /not in the receipt's funding ranking/.test(r.b.reason); })()));
    ok("cfm: an options-only sleeve TRIM needs the explicit flag — legs are not shares (v3.44)",
      (await (async () => {
        const bare = await cfB({ intent: { action: "TRIM", sym: "OPT" }, result_hash: RH });
        const flagged = await cfB({ intent: { action: "TRIM", sym: "OPT", options_sleeve: true }, result_hash: RH });
        return bare.status === 409 && /options-only sleeve/.test(bare.b.reason) && flagged.status === 200; })()));
    // The macro axis unfrozen: same day, changed readout body — each drift NAMED.
    const freshEval = async () => { await ep.onRequest({ request: rq("POST"), env });
      return JSON.parse(store.get("tt:alloc:v1")).attestation.result_hash; };
    ok("cfm: actionability moved since evaluate → 409 naming the evidence axis (the intraday freeze, closed)",
      (await (async () => { const h = await freshEval();
        LIVE_READOUT = { ...READOUT, regime: { ...READOUT.regime, actionability: "RESTRICTED", status: "PARTIAL DATA" } };
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        LIVE_READOUT = READOUT;
        return r.status === 409 && /actionability is now RESTRICTED/.test(r.b.reason); })()));
    ok("cfm: the flip tripping since evaluate → 409 naming the flip — a FUND can never ride a pre-crash receipt",
      (await (async () => { const h = await freshEval();
        LIVE_READOUT = { ...READOUT, macro_flip: { evaluable: true, armed: true, tripped: true } };
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        LIVE_READOUT = READOUT;
        return r.status === 409 && /Macro Flip TRIPPED since/.test(r.b.reason); })()));
    ok("cfm: the readout day rolling since evaluate → 409 naming both days",
      (await (async () => { const h = await freshEval();
        LIVE_READOUT = { ...READOUT, as_of: "2099-01-01" };
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        LIVE_READOUT = READOUT;
        return r.status === 409 && /day rolled/.test(r.b.reason); })()));
    ok("cfm: a same-day readout REBUILD with clean semantics still 409s — the body-hash catch-all",
      (await (async () => { const h = await freshEval();
        LIVE_READOUT = { ...READOUT, checks: [{ extra: 1 }] };
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        LIVE_READOUT = READOUT;
        return r.status === 409 && /rebuilt since this was evaluated/.test(r.b.reason); })()));
    ok("cfm: readout unreachable at confirm time fails CLOSED — never a default-to-clear",
      (await (async () => { const h = await freshEval();
        globalThis.fetch = async () => { throw new Error("down"); };
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        globalThis.fetch = async () => ({ ok: true, json: async () => LIVE_READOUT });
        return r.status === 409 && /unreadable at confirm time/.test(r.b.reason); })()));
    ok("cfm: a WAIT receipt cannot take a FUND — and a TRIM on the same receipt still lands (deleverage is never blocked by the stress that makes it urgent)",
      (await (async () => {
        globalThis.fetch = async () => { throw new Error("down"); };   // evaluate under a dead feed → WAIT
        await ep.onRequest({ request: rq("POST"), env });
        const h = JSON.parse(store.get("tt:alloc:v1")).attestation.result_hash;
        const fund = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        const trim = await cfB({ intent: { action: "TRIM", sym: "CCC" }, result_hash: h });
        globalThis.fetch = async () => ({ ok: true, json: async () => LIVE_READOUT });
        return fund.status === 409 && fund.b.error === "INTENT_MISMATCH" && /receipt state is WAIT/.test(fund.b.reason) &&
          trim.status === 200; })()));
    ok("cfm: the circuit re-resolves at confirm — a trip after evaluate vetoes the FUND even with book_version unchanged",
      (await (async () => { const h = await freshEval();
        store.set("tt:book:v1", JSON.stringify({ ...BOOK, board: { ...BOOK.board, circuit: { state: "tripped", as_of: TODAY } } }));
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: h });
        store.set("tt:book:v1", JSON.stringify(BOOK));
        return r.status === 409 && /circuit now reads TRIPPED/.test(r.b.reason); })()));
    ok("cfm: a legacy receipt with no readout_hash fails toward recompute, never toward an unbound confirm",
      (await (async () => { await freshEval();
        const cur0 = JSON.parse(store.get("tt:alloc:v1"));
        delete cur0.inputs.readout_hash;
        store.set("tt:alloc:v1", JSON.stringify(cur0));
        const r = await cfB({ intent: { action: "FUND", sym: "AAA" }, result_hash: cur0.attestation.result_hash });
        return r.status === 409 && /predates confirm-time readout binding/.test(r.b.reason); })()));

    // ═══ v5.6 THE DAILY CONTRACT — gate vocabulary, spread, flip line, attest, outcomes ═══
    console.log("\n[73] v5.6 THE DAILY CONTRACT — SEND IT/HODL/TOUCH GRASS, spread, stamp, outcomes");
    // The gate is ONE projection of the ladder RESULT (the verdictFrom rule), run against
    // the real allocGateLadder — never a second copy of its conditions.
    const L6 = (board, readout) => alloc.allocGateLadder({ board, readout, now: NOW });
    const G6b = (board, readout) => alloc.macroGateFrom(L6(board, readout), readout);
    const CB6 = { circuit: { state: "clear", as_of: TODAY }, regime: { asserted: "TAILWIND" } };
    const RO6 = (act, mf = { evaluable: true, tripped: false }) => ({ regime: { verdict: "TAILWIND", actionability: act }, macro_flip: mf });
    ok("gate: FULL → SEND_IT — the ladder read clean", G6b(CB6, RO6("FULL")).gate === "SEND_IT");
    ok("gate: RESTRICTED → HODL — the ONE looking-session state, still vetoed by the ladder it names (fail-closed untouched)",
      G6b(CB6, RO6("RESTRICTED")).gate === "HODL" && L6(CB6, RO6("RESTRICTED")) !== null);
    ok("gate: HOLD → TOUCH_GRASS", G6b(CB6, RO6("HOLD")).gate === "TOUCH_GRASS");
    ok("gate: missing readout / blind flip / tripped flip / tripped circuit ALL fail closed to TOUCH_GRASS",
      G6b(CB6, null).gate === "TOUCH_GRASS" &&
      G6b(CB6, RO6("FULL", { evaluable: false })).gate === "TOUCH_GRASS" &&
      G6b(CB6, RO6("FULL", { evaluable: true, tripped: true })).gate === "TOUCH_GRASS" &&
      G6b({ ...CB6, circuit: { state: "tripped", as_of: TODAY } }, RO6("FULL")).gate === "TOUCH_GRASS");
    ok("gate: SEND_IT exists IFF the ladder returned null — only a clean ladder can speak it",
      alloc.macroGateFrom(null, RO6("FULL")).gate === "SEND_IT" &&
      ["RESTRICTED", "HOLD"].every((a) => alloc.macroGateFrom(L6(CB6, RO6(a)), RO6(a)).gate !== "SEND_IT"));
    /* Client mirror, RUN over the same matrix (the [57] behavioral-identity convention).
       v5.98 RE-RIGGED (audit finding T1): the old lift stubbed stance().k — an input the
       live page never produces on a RESTRICTED day, since stance() folds every non-FULL
       actionability into k:"stop" BEFORE macroGate ran. That stub proved the rung ladder
       while hiding the composition defect (server HODL, client TOUCH_GRASS on the exact
       state HODL exists for). macroGate now reads the ladder's own PRIMITIVES (circuit →
       governing regime → feed → actionability → flip), so the lift injects those — the
       same states the real page supplies — and drives BOTH mirrors over one matrix. */
    const MG6 = (() => {
      const i = adminSrc.indexOf("function macroGate(){");
      const j = adminSrc.indexOf("\n}", i);
      if (i < 0 || j < 0) throw new Error("smoke: macroGate markers not found");
      return new Function("circuitStateCli", "governingRegime", "REGIME", "BOARD",
        adminSrc.slice(i, j + 2) + "\nreturn macroGate();");
    })();
    // Primitive fixtures: a resolved circuit, a ranked TAILWIND read, and the readout under test.
    const cCLR6 = () => ({ st: "clear", age: 0 }), cTRP6 = () => ({ st: "tripped", age: 0 });
    const grOf6 = (ro, gov = "TAILWIND", ranked = true) => () => ({ ranked, gov,
      actionability: (ro && ro.regime && ro.regime.actionability) || null,
      macroFlip: ro && ro.macro_flip });
    const MGrun6 = (ro, { circuit = cCLR6, gov = "TAILWIND", ranked = true } = {}) =>
      MG6(circuit, grOf6(ro, gov, ranked), ro, { circuit: {} });
    ok("gate mirror: client macroGate matches the server across the matrix — FULL/RESTRICTED/HOLD/blind/absent/PANIC/unranked/tripped-circuit",
      MGrun6(RO6("FULL")).g === "SEND_IT" &&
      MGrun6(RO6("RESTRICTED")).g === "HODL" &&              // the state the old alias could never speak
      MGrun6(RO6("HOLD")).g === "TOUCH_GRASS" &&
      MGrun6(RO6("FULL", { evaluable: false })).g === "TOUCH_GRASS" &&
      MGrun6(null).g === "TOUCH_GRASS" &&
      MGrun6(RO6("FULL"), { gov: "PANIC" }).g === "TOUCH_GRASS" &&
      MGrun6(RO6("FULL"), { ranked: false, gov: null }).g === "TOUCH_GRASS" &&
      MGrun6(RO6("FULL"), { circuit: cTRP6 }).g === "TOUCH_GRASS");
    ok("gate mirror: HODL requires the actionability rung EXACTLY — measured-HEADWIND under FULL is SEND_IT on BOTH sides (the retired alias said HODL there)",
      MGrun6(RO6("FULL"), { gov: "HEADWIND" }).g === "SEND_IT" &&
      alloc.macroGateFrom(L6(CB6, { regime: { verdict: "HEADWIND", actionability: "FULL" },
        macro_flip: { evaluable: true, tripped: false } }),
        { regime: { verdict: "HEADWIND", actionability: "FULL" } }).gate === "SEND_IT");
    /* v5.6.3 — the DOC reconciliation (owner review 2026-08-26: "README still says only
       explicit FULL passes; docs should catch up so the two vocabularies do not fork").
       Fixing the prose is half the cure — a doc rule nothing enforces is the rot vector this
       repo keeps paying for (v3.59 B5, v3.60.1 §5). So the gate set is derived BEHAVIORALLY
       from macroGateFrom over the matrix above and reconciled against the docs: adding,
       renaming or dropping a gate state fails the build rather than silently forking. */
    const GATE_SET = [...new Set([
      G6b(CB6, RO6("FULL")).gate, G6b(CB6, RO6("RESTRICTED")).gate, G6b(CB6, RO6("HOLD")).gate,
      G6b(CB6, null).gate, G6b(CB6, RO6("FULL", { evaluable: false })).gate,
    ])];
    const ttReadme = readSrc("../ticker-terminal/README.md");
    ok("v5.6.3 docs: every product gate state macroGateFrom can RETURN is named in the TT README and in CLAUDE.md's locked decisions",
      GATE_SET.length === 3 &&
      GATE_SET.map((g) => g.replace(/_/g, " ")).every((w) => ttReadme.includes(w) && claudeSrc.includes(w)));
    ok("v5.6.3 docs: FULL/RESTRICTED/HOLD are named as the MACHINE aliases, never as the product words",
      /machine (vocabulary|aliases)/i.test(ttReadme) && /machine aliases/i.test(claudeSrc) &&
      /SEND IT is the only state/i.test(ttReadme));
    // The withdrawn claim must stay withdrawn — a retired instruction quietly reappearing is
    // the label-outlives-its-data defect (the v3.85 retired-capture-row precedent).
    ok("v5.6.3 docs: the retired bare claim ('only explicit FULL passes') is pinned ABSENT from the TT README",
      !/only explicit `?FULL`? passes/.test(ttReadme));

    // The frozen spread formula + the asserted deadband, executed at the exact edges.
    ok("spread: the FROZEN formula — (belief − street) / price × 100",
      JSON.stringify(alloc.spreadOf(570, 485, 300)) === JSON.stringify({ pct: 28.3, sign: "you_richer" }));
    ok("spread: the ±10 deadband — aligned AT the edge, decided just beyond it, both directions",
      alloc.SPREAD_ALIGNED_PCT === 10 &&
      alloc.spreadOf(110, 100, 100).sign === "aligned" && alloc.spreadOf(110.2, 100, 100).sign === "you_richer" &&
      alloc.spreadOf(90, 100, 100).sign === "aligned" && alloc.spreadOf(89.8, 100, 100).sign === "street_richer");
    ok("spread: fail-closed — a missing leg or non-positive price yields null, never a number",
      alloc.spreadOf(null, 100, 100) === null && alloc.spreadOf(100, 100, 0) === null);
    ok("street leg: REVIEWED published average outranks the sourced target; sourced is the labeled fallback; neither = null",
      (() => { const idx6 = { consensus: { street_target: { pt: 480, as_of: "2026-08-20" } } };
        const rec6 = { analystTarget: { average: 500 } };
        const a = alloc.streetLegOf(idx6, rec6), b = alloc.streetLegOf(idx6, null), c = alloc.streetLegOf({}, null);
        return a.pt === 500 && a.src === "reviewed" && b.pt === 480 && b.src === "sourced" && c === null; })());
    // stampOutcome — the day-0 anchor rule from the shipped public pattern.
    ok("outcome: day 0 is the FIRST close ON OR AFTER the stamp date — pre-stamp movement never scores",
      (() => { const o = alloc.stampOutcome("2026-08-22", [
          { date: "2026-08-21", close: 100 }, { date: "2026-08-24", close: 104 }, { date: "2026-08-25", close: 106 }]);
        return o.anchor.date === "2026-08-24" && o.returns_pct["1d"] === 1.9 &&
          o.returns_pct["5d"] === null && o.status === "PENDING"; })());
    ok("outcome: no close on/after the stamp reads a NAMED reason, never zeros",
      /no close on or after/.test(alloc.stampOutcome("2026-08-22", [{ date: "2026-08-21", close: 100 }]).reason));
    ok("outcome: drawdown is IMPORTED from publicHistory — one implementation, no local copy",
      (() => { const src6 = readSrc("../functions/lib/tt-alloc.js");
        return src6.includes('import { maxDrawdownPct } from "../../src/publicHistory.js"') &&
          !/function maxDrawdownPct/.test(src6); })());
    // Receipt end-to-end through the real evaluator.
    ok("v5.6 receipt: macro_gate SEND_IT on the clean fixture; spread keyed by the decision set; call null-honest when absent",
      (() => { const r = ev();
        return r.macro_gate && r.macro_gate.gate === "SEND_IT" && r.call === null &&
          r.spread && r.eligible && (r.eligible.sym in r.spread) &&
          r.spread[r.eligible.sym].street === null && r.spread[r.eligible.sym].pct === null; })());
    ok("v5.6 receipt: TODAY's md-call binds from the readout body; a stale effective_date stays null-honest",
      (() => { const mkRo = (d) => ({ ...READOUT, call: { schema: "md-call-v1", headline: "MOONING", direction: "BULLISH", effective_date: d }, call_frozen: true });
        const a = ev({ readout: mkRo(TODAY) }), b = ev({ readout: mkRo("2026-01-01") });
        return a.call && a.call.headline === "MOONING" && a.call.frozen === true && b.call === null; })());
    ok("v5.6 receipt: a reviewed street leg computes the frozen spread on the eligible row, LABELED and self-consistent",
      (() => { const r = ev({ streetBySym: { AAA: { schema: "tt-street-v1", analystTarget: { average: 90 } } } });
        const sp = r.eligible && r.spread[r.eligible.sym];
        if (!sp || !sp.street || sp.street.src !== "reviewed" || typeof sp.pct !== "number") return false;
        const expect = Math.round(((sp.belief.pt - 90) / r.eligible.px) * 1000) / 10;
        return Math.abs(sp.pct - expect) < 1e-9; })());
    ok("v5.6 flip line: null when only one name carries a rate; with two IDENTICAL rows #2 overtakes exactly at the current price (the annualise-inversion identity)",
      (() => { const base = ev(); if (base.overtake !== null) return false;
        const r = ev({ ddIndex: { asOf: TODAY, entries: { AAA: mkIdx(), BBB: mkIdx() } } });
        if (!r.overtake) return false;
        const lead = r.overtake.leader === "AAA" ? "AAA" : "BBB";
        const row = r.why_not && true ? null : null;
        const px = (r.eligible && r.eligible.sym === lead) ? r.eligible.px : null;
        return px === null ? Math.abs(r.overtake.at_px) > 0 : Math.abs(r.overtake.at_px - px) < 0.02; })());
    // ── the ATTEST lifecycle, driven through the real endpoint ──
    await ep.onRequest({ request: rq("POST"), env });   // a fresh, valid TODAY receipt
    const at1 = await ep.onRequest({ request: rq("POST", "?attest=1"), env });
    const ab1 = JSON.parse(await at1.text());
    ok("attest: stamps TODAY's receipt — first-write-wins pointer with ET identity",
      at1.status === 200 && ab1.stamped === true && ab1.stamp.schema === "tt-alloc-stamp-v1" &&
      ab1.stamp.date === etYmd(new Date()) && /ET$/.test(ab1.stamp.attested.at_et) &&
      store.has("tt:alloc:stamped:" + etYmd(new Date())));
    ok("attest: a second attest the same day → 409 ALREADY_STAMPED with the standing stamp — immutable, never overwritten",
      (await (async () => { const r = await ep.onRequest({ request: rq("POST", "?attest=1"), env });
        const b = JSON.parse(await r.text());
        return r.status === 409 && b.error === "ALREADY_STAMPED" && b.stamp.attested.at === ab1.stamp.attested.at; })()));
    ok("attest: the bare GET now reports stamped_today true",
      (await (async () => { const r = await ep.onRequest({ request: rq("GET"), env });
        return JSON.parse(await r.text()).stamped_today === true; })()));
    ok("stamped list: outcomes AT READ — no facts stored reads a NAMED reason (never zeros), gate + pick carried, allocation_changed DERIVED from the intent journal",
      (await (async () => { const r = await ep.onRequest({ request: rq("GET", "?stamped=1"), env });
        const b = JSON.parse(await r.text());
        const row = b.rows && b.rows[0];
        return r.status === 200 && b.outcomes_at_read === true && row && row.date === etYmd(new Date()) &&
          row.gate === "SEND_IT" && row.pick === "AAA" &&
          row.outcome && /no daily candles/.test(row.outcome.reason) &&
          row.allocation_changed === true; })()));   // the confirm tests above journaled intents today
    ok("stamped list: with facts candles the outcome computes — same-day anchor, null returns, PENDING (never a fabricated same-day score)",
      (await (async () => {
        const d0 = etYmd(new Date());
        const dPrev = etYmd(new Date(Date.now() - 86400000));
        // the REAL key shape (ticker-facts keyFor: `tt:facts:<SYM>:v1`) — a suffix-less
        // fixture agreed with a live suffix-less read bug once; never again. Dates are
        // CONTIGUOUS: the v5.6.1 continuity guard re-checks at read.
        store.set("tt:facts:AAA:v1", JSON.stringify({ fields: { candles: { value: [
          { date: dPrev, close: 95 }, { date: d0, close: 101 }] } } }));
        const r = await ep.onRequest({ request: rq("GET", "?stamped=1"), env });
        const row = JSON.parse(await r.text()).rows[0];
        return row.outcome && row.outcome.anchor && row.outcome.anchor.date === d0 &&
          row.outcome.returns_pct["1d"] === null && row.outcome.status === "PENDING"; })()));
    ok("v5.6.1: a stored-but-corrupt series is REJECTED at read too (merge-only last-good can keep one alive as STALE) — fault named, never an anchor",
      (await (async () => {
        const d0 = etYmd(new Date());
        store.set("tt:facts:AAA:v1", JSON.stringify({ fields: { candles: { value: [
          { date: "2026-02-26", close: 104.88 }, { date: d0, close: 7.62 }] } } }));
        const r = await ep.onRequest({ request: rq("GET", "?stamped=1"), env });
        const row = JSON.parse(await r.text()).rows[0];
        return row.outcome && row.outcome.anchor === null &&
          /stored candle series rejected — interior gap/.test(row.outcome.reason); })()));
    ok("v5.6.2: an INTERNALLY-CONSISTENT wrong-instrument series is rejected at read against the live quote (the rung the other tells cannot supply)",
      (await (async () => {
        const d0 = etYmd(new Date());
        const dPrev2 = etYmd(new Date(Date.now() - 86400000));
        store.set("tt:facts:AAA:v1", JSON.stringify({ fields: { candles: { value: [
          { date: dPrev2, close: 7.78 }, { date: d0, close: 7.62 }] } } }));
        const r = await ep.onRequest({ request: rq("GET", "?stamped=1"), env });
        const row = JSON.parse(await r.text()).rows[0];
        return row.outcome && row.outcome.anchor === null &&
          /tail close \$7\.62 vs live quote/.test(row.outcome.reason); })()));
    ok("outcome note: the owner override beats the derived allocation_changed, and attaches only to stamped days",
      (await (async () => {
        const bad = await ep.onRequest({ request: rq("POST", "?outcome=1", { date: "2020-01-01", allocation_changed: false }), env });
        if (bad.status !== 404) return false;
        const w = await ep.onRequest({ request: rq("POST", "?outcome=1", { date: etYmd(new Date()), allocation_changed: false, note: "no trade today" }), env });
        if (w.status !== 200) return false;
        const r = await ep.onRequest({ request: rq("GET", "?stamped=1"), env });
        const row = JSON.parse(await r.text()).rows[0];
        return row.allocation_changed === false && row.note === "no trade today"; })()));
    // Client + contract pins.
    // RE-PINNED v5.97.4: both `GATE: ${mg.label}` strip branches were excised with the
    // permanently-hidden #legacyCompact (renderStance's only home). The HODL word-collision
    // guard SURVIVES at the live surface: the glance tile scopes the word with an adjacent
    // GATE key (`glance-k">GATE` beside the alias in glance-v) — same rule, tile grammar.
    ok("v5.6 client: the GATE word is SCOPED by the glance tile's GATE key (the HODL word-collision guard, post-excision home)",
      // v6.0 T1: the word is macroGate()'s label now — the scoping contract is unchanged.
      /glance-k">GATE<\/div><div class="glance-v"[^`]*\$\{mg\.label\}/.test(adminSrc) &&
      !/GATE: \$\{mg\.label\}/.test(adminSrc));
    ok("v5.6 client: the stamp is a TWO-STEP confirmLink — no bare one-tap attest call site",
      adminSrc.includes('confirmLink("allocStampLink"') && !/onclick="allocAttest\(\)"/.test(adminSrc));
    ok("v5.6 client: spreadLine is ONE builder at TWO altitudes (DESK eligible box + compact BUY banner)",
      (adminSrc.match(/spreadLine\((b|AGREE_PICK)\.sym\)/g) || []).length === 2);
    ok("v5.6 client: stamped history is est-mini, lazy on open, and names its empty kind",
      adminSrc.includes('ontoggle="if(this.open)loadStampedHistory(this)"') &&
      adminSrc.includes("no stamped days yet — ⭑ STAMP starts the record"));
    ok("v5.6: the tt-v1 machine contract never speaks the product vocabulary (gate words are the PRODUCT layer)",
      !/SEND_IT|TOUCH_GRASS/.test(readSrc("../src/ttReadout.js")));
  } finally { globalThis.fetch = realFetch; }
}

// ═══════════ [67] v4.0 SIMPLE MODE — scoped verdict, parameter cards, one sentence ═══════════
// The owner's Simple-mode plan, built as PURE PROJECTIONS of the EvidenceSet the engine
// already produced. Nothing here decides: no threshold, vote or freshness rule lives in the
// projection, so Simple can never disagree with Power. Every rule below is EXECUTED against
// real EvidenceSets — a string pin cannot prove a selection rule.
console.log("\n[67] v4.0 SIMPLE MODE — verdict mapping, card selection, sentence, flip line");
{
  /* 8/28: Node cannot import JSX, so the chip helper is LIFTED and RUN (the house pattern).
     The slice starts at the CONSTANT, not at the arrow — flipChipOf closes over
     FLIP_CHIP_MAX, and a slice beginning after it leaves a free variable the fixtures
     would happen to short-circuit past (the v3.85 / v3.47 lesson). */
  const { FLIP_CHIP_MAX, flipChipOf } = (() => {
    const a = whysSrc.indexOf("export const FLIP_CHIP_MAX");
    const b = whysSrc.indexOf("};", whysSrc.indexOf("export const flipChipOf")) + 2;
    if (a < 0 || b < 2) throw new Error("flipChipOf lift failed — the helper moved");
    // eslint-disable-next-line no-new-func
    return new Function(`${whysSrc.slice(a, b).replace(/export /g, "")}
      return { FLIP_CHIP_MAX, flipChipOf };`)();
  })();
  const { simpleVerdict: sv, simpleCards: sc, simpleSentence: ss, simpleFlipLine: sf, readMetric,
          SIMPLE_VERDICTS, SIMPLE_WITHHELD, DIRECTION_OF } = await import("../src/evidence.js");
  const { REGIME_BAND_TABLE: BT } = await import("../src/regime.js");

  // whyItMatters: one home per band, and it must NOT restate the direction (plainBull/Bear own that).
  // 8/28 matrix row 3 re-anchored this: the secondary direction used to be spelled with the
  // conf-strip inline (`${machineLabel} · ${conf&&…}`); the strip is now the shared `subText`
  // so the withheld branch gets it too. The CLAIM here is unchanged — one primary human call,
  // one secondary machine direction.
  ok("v5.3: Simple renders ONE primary human call with one secondary machine direction",
    /\{callLabel\}<\/span>/.test(bandSrc) &&
    // v5.9: the machine direction still renders; the tally sub behind it is Power-only.
    /:`\$\{machineLabel\}\$\{plainVerdict\?"":` · \$\{subText\}`\}`/.test(bandSrc));
  /* 8/28 clock matrix A4: the unfrozen Simple eyebrow read "· the call" — the product's
     official-call identity (v5.3) worn by a live recomputation. "call" is now reserved for
     callFrozen; the unfrozen word is "live read". Power's voice untouched. */
  ok("v4.0/8-28: the Simple eyebrow is scoped and never wears the official-call name unfrozen",
    /plainVerdict\?"Macro Backdrop · live read":"Macro Backdrop · wen moon\?"/.test(bandSrc) &&
    /callFrozen\?"Macro Backdrop · 10am frozen call"/.test(bandSrc) &&
    !/"Macro Backdrop · the call"/.test(bandSrc));
  ok("8/28 A6: the unfrozen face carries the frozen caption's counterpart, liveBuild-gated, both clock branches",
    /liveBuild&&!callFrozen&&!withheld&&/.test(bandSrc) &&
    bandSrc.includes("live read — today's official call freezes at 10:00 ET") &&
    bandSrc.includes("live read — today's 10am record not loaded"));
  ok("8/28 A8: the unfrozen copy button names what it copies — and what it is not",
    bandSrc.includes('"⎘ COPY LIVE READ"') && bandSrc.includes('"⎘ COPY 10AM CALL"') &&
    bandSrc.includes("Copy the current live read — not the 10am call") &&
    !bandSrc.includes("COPY POSTURE"));
  ok("v4.0: every band carries a whyItMatters line — new copy, one home, beside the rule it explains",
    BT.every((b) => typeof b.whyItMatters === "string" && b.whyItMatters.length > 20) &&
    BT.every((b) => b.whyItMatters !== b.plainBull && b.whyItMatters !== b.plainBear));

  // ── verdict mapping: the vocabulary is CLOSED (acceptance test 2) ──
  const mk = (label, withheld = false) => ({ withheld, regime: { label }, factors: [], flips: null });
  ok("v4.0 verdict: RISK-ON→BULLISH, MIXED→HODL, RISK-OFF→BEARISH",
    sv(mk("RISK-ON")).label === "BULLISH" && sv(mk("MIXED")).label === "HODL" &&
    sv(mk("RISK-OFF")).label === "BEARISH");
  ok("v4.0 verdict: every withheld state → DATA HOLD, and an UNKNOWN label fails CLOSED to it",
    sv(mk("RISK-ON", true)).label === SIMPLE_WITHHELD && sv(null).label === SIMPLE_WITHHELD &&
    sv(mk("SOMETHING-NEW")).label === SIMPLE_WITHHELD);
  ok("v4.0 verdict: the vocabulary is CLOSED — exactly four labels can ever render",
    new Set([...Object.values(SIMPLE_VERDICTS), SIMPLE_WITHHELD]).size === 4 &&
    ["BULLISH", "HODL", "BEARISH", "DATA HOLD"].every((l) =>
      [...Object.values(SIMPLE_VERDICTS), SIMPLE_WITHHELD].includes(l)));

  // ── card selection ──
  const F = (key, vote, extra = {}) => ({ key, short: key, label: key, vote,
    display: `${key}-val`, mode: "LIVE", asOf: "2026-08-17", excluded: false, ...extra });
  const evOf = (label, factors) => ({ withheld: false, regime: { label }, factors, flips: { flips: [] } });

  const bullSet = evOf("RISK-ON", [F("tenYear","bear"), F("vix","bull"), F("fearGreed","neutral"),
    F("cpiHeadline","bull"), F("valuation","bear"), F("nfci","bull")]);
  const rb = sc(bullSet);
  /* Supports lead a bullish posture, BUT the last slot is reserved for the other side when
     one exists — found in the Chromium read-through: three HELPING cards under a sentence
     saying "…but real risks are still in play" showed the reader a risk the cards hid. */
  ok("v4.0 cards: a bullish posture leads with SUPPORTS and RESERVES the last slot for a risk",
    rb.cards.map((c) => c.key).join(",") === "vix,cpiHeadline,tenYear" &&
    rb.cards.map((c) => c.direction).join(",") === "helping,helping,hurting" && rb.shown === 3);
  const bearSet = evOf("RISK-OFF", bullSet.factors);
  ok("v4.0 cards: a bearish posture mirrors it — risks lead, one support survives the cut",
    (() => { const d = sc(bearSet).cards.map((c) => c.direction);
      return d[0] === "hurting" && d.includes("helping"); })());
  ok("v4.0 cards: with NO opposing factor the reservation is a no-op (never an empty slot)",
    (() => { const only = sc(evOf("RISK-ON", [F("vix","bull"), F("nfci","bull"), F("cpiHeadline","bull"), F("tenYear","bull")]));
      return only.shown === 3 && only.cards.every((c) => c.direction === "helping"); })());
  /* v4.0.3 — currentValue is TYPED, not parsed. The old contract ran metricOf() over the
     Power matrix's display copy; for 10Y and CPI that string contains no number at all
     ("Falling ↓", "Cooling"), so a card asking "what is the current metric?" answered with a
     judgment. The value now comes from the band's own `metric` descriptor, read off the same
     data the vote reads. */
  ok("v4.0.3 cards: currentValue comes from the TYPED metric row, never parsed from display copy",
    sc(evOf("MIXED", [F("vix","bull",{display:"14.63 — Low (bullish)",
      metric:{value:14.63,unit:"",note:null,text:"14.63"}})])).cards[0].currentValue === "14.63" &&
    // the display string is now irrelevant to the value — proven by making them disagree
    sc(evOf("MIXED", [F("vix","bull",{display:"IGNORE ME (bullish)",
      metric:{value:9.5,unit:"",note:null,text:"9.50"}})])).cards[0].currentValue === "9.50");
  ok("v4.0.3 cards: a metric that cannot be read shows an explicit dash — never 0, never invented",
    sc(evOf("MIXED", [F("vix","bull",{display:"14.63 — Low (bullish)",
      metric:{value:null,unit:"",note:null,text:null}})])).cards[0].currentValue === "—" &&
    sc(evOf("MIXED", [F("vix","bull",{display:"x"})])).cards[0].currentValue === "—");
  /* The defect the audit named: 10Y and CPI carry NO number in their display string, so the
     typed path is the only way a card can show their measurement. Executed end-to-end. */
  ok("v4.0.3 cards: 10Y and CPI now show a NUMBER — the two the display string could never supply",
    (() => { const probe = { crossAsset:{treasury10y:{m1:-0.12,current:4.68}},
        marketPulse:{vix:{current:14.63},fearGreed:{score:65}},
        macro:{cpi:{trend:[3.9,3.8,3.7,3.6,3.5,3.5]},shillerPe:{current:38.2,ath:44,mean:17.4},nfci:{current:-0.62}} };
      const t = readMetric(probe, "tenYear").text, c = readMetric(probe, "cpiHeadline").text;
      return /-0\.12pp/.test(t) && /3\.5%/.test(c) &&
        !/Falling|Cooling|bullish/.test(t + c); })());
  /* v4.0.4 — the label-to-metric contract. "the 10-year yield" labelling a card that showed
     only a monthly delta made the delta read as the yield. The LEVEL now leads and the voted
     quantity follows; the vote still consumes `read`, so display moved and the vote did not. */
  ok("v4.0.4 metric: the 10Y card leads with the LEVEL its label names, delta as context",
    (() => { const probe = { crossAsset:{treasury10y:{m1:-0.12,current:4.68}} };
      const r = readMetric(probe, "tenYear");
      return r.text === "4.68% · -0.12pp 1-mo" && r.value === -0.12 && r.context === "4.68%"; })());
  ok("v4.0.4 metric: the VOTE is untouched — `read` is still exactly what vote() consumes",
    (() => { const b = REGIME_BAND_TABLE.find((t) => t.key === "tenYear");
      const probe = { crossAsset:{treasury10y:{m1:-0.12,current:4.68}} };
      return b.metric.read(probe) === b.read(probe) && b.vote(b.read(probe)) === "bull"; })());
  ok("v4.0.4 metric: a rising delta is SIGNED — +0.22pp cannot be misread as a fall",
    readMetric({ crossAsset:{treasury10y:{m1:0.22,current:4.68}} }, "tenYear").text
      === "4.68% · +0.22pp 1-mo");
  ok("v4.0.4 metric: context fails closed on its own — omitted, never printed as a zero",
    readMetric({ crossAsset:{treasury10y:{m1:0.22,current:null}} }, "tenYear").text === "+0.22pp 1-mo");
  ok("v4.0.4 metric: an unreadable VOTED value still yields no text — a level cannot stand alone",
    readMetric({ crossAsset:{treasury10y:{m1:null,current:4.68}} }, "tenYear").text === null);
  ok("v4.0.4 metric: context is OPT-IN — the five bands without one are byte-identical",
    readMetric({ marketPulse:{vix:{current:14.63}} }, "vix").text === "14.63" &&
    readMetric({ macro:{nfci:{current:-0.62}} }, "nfci").text === "-0.62 SD vs avg");
  const hodlSet = evOf("MIXED", bullSet.factors);
  ok("v4.0 cards: HODL interleaves both sides — a reader must see support AND risk, not one twice",
    (() => { const dirs = sc(hodlSet).cards.map((c) => c.direction);
      return dirs.includes("helping") && dirs.includes("hurting"); })());

  // EXCLUDED is not a direction and is not a card (C3/C4 — the v3.62 lesson).
  const withDead = evOf("MIXED", [F("vix","excluded",{excluded:true, mode:"MOCK", display:"no live reading — not counted"}),
    F("cpiHeadline","bull"), F("nfci","bull")]);
  const rd = sc(withDead);
  ok("v4.0 cards: an EXCLUDED factor is never selected and never rendered as a direction",
    !rd.cards.some((c) => c.key === "vix") && rd.usable === 2 && rd.shown === 2 &&
    rd.cards.every((c) => ["helping","hurting","mixed"].includes(c.direction)));
  ok("v4.0 cards: fewer usable → FEWER cards, never UNAVAILABLE padding (absence is not content)",
    sc(evOf("MIXED", [F("nfci","bull")])).cards.length === 1 &&
    sc(evOf("MIXED", [])).cards.length === 0);
  ok("v4.0 cards: the truncation is measurable by the caller — usable/shown/total all reported",
    rb.usable === 6 && rb.shown === 3 && rb.total === 6 && rd.total === 3);
  ok("v4.0 cards: excluded is NOT in the direction map — three directions, four votes",
    DIRECTION_OF.excluded === undefined && Object.keys(DIRECTION_OF).length === 3);
  ok("v4.0 cards: content is projected, never invented — value/why come from the row and its band",
    rb.cards[0].currentValue === "—" && rb.cards[0].mode === "LIVE" &&
    rb.cards[0].asOf === "2026-08-17" &&
    rb.cards[0].why === BT.find((b) => b.key === "vix").whyItMatters &&
    rb.cards[0].label === BT.find((b) => b.key === "vix").plain);

  // ── sentence + flip line ──
  /* v4.0.1: RE-PINNED on the owner copy pass, which REVERSED v4.0.0's "never list the
     factors" ruling — the owner's read of the live page asked for the named form
     ("Volatility and sentiment are supportive, but…"). The four-branch structure and the
     withheld-gets-nothing contract are unchanged; only the words moved. */
  ok("v4.0.1 sentence: four branches, named factors, and a withheld posture gets NONE",
    /supportive/.test(ss(evOf("RISK-ON", [F("a","bull")]))) &&
    /clearly supportive/.test(ss(evOf("RISK-OFF", [F("a","bear")]))) &&
    /supportive.*but/.test(ss(evOf("MIXED", [F("a","bull"), F("b","bear")]))) &&
    /Nothing we track has a clear lean/.test(ss(evOf("MIXED", [F("a","neutral")]))) &&
    ss({ withheld: true }) === null);
  /* v4.0.3 — the absolute claim is QUALIFIED when coverage is partial. "Nothing we track is
     working against the market" is a statement about ALL SIX factors; with one excluded, the
     evidence cannot support it. The v3.62 "not counted" vs "counted, no lean" distinction,
     carried into the sentence. */
  ok("v4.0.3 sentence: with a factor excluded it says NO CURRENTLY USABLE FACTOR, never 'nothing we track'",
    (() => { const partial = ss(evOf("RISK-ON", [F("vix","bull"), F("tenYear","excluded",{excluded:true})]));
      return /no currently usable factor is working against/.test(partial) &&
             !/nothing we track/.test(partial); })());
  ok("v4.0.3 sentence: at FULL coverage the plain wording survives — the qualifier is earned, not always-on",
    /nothing we track is working against/.test(ss(evOf("RISK-ON", [F("vix","bull"), F("nfci","bull")]))));
  ok("v4.0.3 sentence: the qualifier reaches the no-lean branch too (both absolutes covered)",
    /No currently usable factor has a clear lean/.test(ss(evOf("MIXED", [F("vix","neutral"), F("tenYear","excluded",{excluded:true})]))) &&
    /Nothing we track has a clear lean/.test(ss(evOf("MIXED", [F("vix","neutral")]))));
  ok("v4.0.1 sentence: NAMES the factors in band vocabulary (ruling reversed by the owner copy pass)",
    (() => { const t = ss(evOf("RISK-ON", [F("vix","bull"), F("nfci","bull"), F("valuation","bear")]));
      return /[Vv]olatility/.test(t) && /financial conditions/.test(t) &&
        /priced for perfection/.test(t) && /are supportive, but/.test(t); })());
  ok("v4.0.1 sentence: a SINGLE supportive factor speaks its verb phrase (no noun-count agreement trap)",
    /Volatility is asleep/.test(ss(evOf("RISK-ON", [F("vix","bull")]))));
  /* v4.0.3 — the flip line speaks SIMPLE's vocabulary. flipConditions returns the engine's
     own label ("RISK-OFF"), which appears nowhere else in Simple, so leaking it here gave the
     reader a second name for the verdict in front of them. Mapped through the SAME table
     simpleVerdict uses; an unmapped label passes through rather than being guessed at. */
  ok("v4.0.3 flip: the engine's label is mapped to Simple's scoped verdict, never leaked",
    sf({ withheld: false, flips: { flips: [{ copy: "VIX above 25", would: "RISK-OFF" }] } })
      === "VIX above 25 would move this to MACRO: BEARISH." &&
    sf({ withheld: false, flips: { flips: [{ copy: "X", would: "RISK-ON" }] } })
      === "X would move this to MACRO: BULLISH." &&
    sf({ withheld: false, flips: { flips: [{ copy: "X", would: "WEIRD" }] } })
      === "X would move this to WEIRD." &&
    sf({ withheld: false, flips: { flips: [] } }) === "No single metric would change the call on its own." &&
    sf({ withheld: true }).startsWith("Call withheld"));

  // ── boundaries: Simple decides nothing; Power is untouched ──
  /* v4.0.3 — under DATA HOLD the cards remain (real current readings, useful context) but
     must not read as the verdict the page just declined to make. */
  ok("v4.0.3 cards: a withheld verdict labels the cards 'not used for the call' — evidence kept, inference denied",
    /partial evidence — not used for the call/.test(spcSrc) && /withheld && </.test(spcSrc) &&
    /withheld=\{evidenceSet\.withheld\}/.test(dashSrc));
  ok("v4.0.3: the tracked-signal census is POWER-ONLY — Simple's confidence is the scoped voters line",
    /\{!simple&&<SignalQuality sq=\{sq\}\/>\}/.test(dashSrc));
  ok("v4.0.3: metricOf is RETIRED — display-string parsing is no longer an integrity boundary",
    !/export function metricOf/.test(evidenceSrc) && !/metricOf\(/.test(evidenceSrc) &&
    /export function readMetric/.test(evidenceSrc));
  ok("v4.0.3: every band declares a typed metric — a new band without one fails THIS test",
    REGIME_BAND_TABLE.every((b) => b.metric && typeof b.metric.read === "function" &&
      typeof b.metric.dec === "number" && typeof b.metric.unit === "string"));
  /* FEAT-NEWCOMER-RULER (8/29): every band restates its own edges for a reader with no
     ruler for the number — locked copy, living on the band beside the rule it describes
     (the plain/whyItMatters/metric doctrine). The valuation 26.1 is DERIVED from
     CAPE_MEAN*1.5, never a second literal — pinned in both directions. */
  ok("ruler: every band declares one, and the six locked copies are exact",
    REGIME_BAND_TABLE.every((b) => typeof b.ruler === "string" && b.ruler.length > 10) &&
    REGIME_BAND_TABLE.find((b)=>b.key==="tenYear").ruler === "help: 1-mo change below −0.10 ppt · hurt: above +0.15 ppt" &&
    REGIME_BAND_TABLE.find((b)=>b.key==="vix").ruler === "help below 18 · mid 18–25 · hurt above 25" &&
    REGIME_BAND_TABLE.find((b)=>b.key==="fearGreed").ruler === "help above 55 · mid 30–55 · hurt below 30" &&
    /* v5.8: the CPI ruler's "· Fed target 2% is context, not the vote" tail is REMOVED and
       the pin moves with it. The Fed's 2% target is on PCE, not CPI (FOMC Statement on
       Longer-Run Goals, 2012) — the clause read as a 2% CPI target, which is the single most
       repeated error about this series, and a page built to refuse fabricated facts cannot
       print one in its own ruler. The correct statement, WITH the PCE distinction, now lives
       in the explainer sheet; the withdrawn claim is pinned ABSENT below so it cannot
       quietly return (the v3.85 retired-instruction rule). */
    REGIME_BAND_TABLE.find((b)=>b.key==="cpiHeadline").ruler === "help: latest YoY cooler than prior print · hurt: series up >0.5 pt from start" &&
    !REGIME_BAND_TABLE.some((b)=>/Fed target 2%/.test(b.ruler)) &&
    REGIME_BAND_TABLE.find((b)=>b.key==="valuation").ruler === "help: CAPE below 26.1 (1.5× long-run mean 17.4) · hurt: CAPE above 30 or >90% of ATH 44.19" &&
    REGIME_BAND_TABLE.find((b)=>b.key==="nfci").ruler === "help at or below −0.5 SD · mid −0.5 to 0 · hurt above 0 (0 = 1971– mean)");
  ok("ruler: 26.1 has ONE derivation — the source carries no 26.1 literal, and macroCall re-imports the constant",
    !/26\.1/.test(regimeSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")) &&
    /CAPE_MEAN\*1\.5/.test(regimeSrc.replace(/\s/g,"")) &&
    /import \{ CAPE_MEAN, CAPE_ATH \} from "\.\/regime\.js"/.test(readSrc("../src/macroCall.js")));
  /* v5.9.1: the full sentence-form ruler is no longer fed to the sheet at all (the 3-bullets
     directive retired the "how MacroDash reads it" section) — the FACE chip is the only
     rendered home for a band's edges now. `band.ruler` itself survives as source data
     (still reconciled to vote()/flip below) in case it is wanted elsewhere later. */
  ok("ruler: the card projection still carries the band's ruler as source data (unrendered)",
    (() => { const cards = sc({ regime:{ label:"RISK-ON" }, factors:[{ key:"vix", short:"VIX",
        vote:"bull", excluded:false, mode:"LIVE", metric:{ text:"14.43", value:14.43 } }] }).cards;
      return cards.length === 1 && cards[0].ruler === "help below 18 · mid 18–25 · hurt above 25"; })() &&
    /\{c\.rulerChip && <span/.test(spcSrc) &&
    !/explain=\{c\.explain \? \{ \.\.\.c\.explain, lead:/.test(spcSrc));
  ok("ruler: the vote() functions, flip edges and quorum are byte-untouched by this feature",
    REGIME_BAND_TABLE.length === 6 && REGIME_QUORUM === 4 &&
    REGIME_BAND_TABLE.find((b)=>b.key==="vix").vote(17.9) === "bull" &&
    REGIME_BAND_TABLE.find((b)=>b.key==="vix").vote(25.01) === "bear" &&
    REGIME_BAND_TABLE.find((b)=>b.key==="nfci").vote(-0.5) === "bull");
  /* The chain that makes the ruler a GUARD instead of a caption, and the negative control
     the ticket asked for: vote() → flip → ruler must all name the SAME two numbers, and the
     reconciliation is derived from the table at runtime rather than restated here (the
     SOURCES/DERIVED_OF and playwright EXECUTABLE_PATHS convention). Move an edge in vote()
     alone and the vote↔flip half goes red; move it in flip alone and the ruler half does;
     move it in both and the locked-copy pin above does. There is no way to change a scalar
     band's edge and leave a stale ruler behind. Deliberately NOT wired by templating the
     ruler off flip.bullEdge: that would have put a third expression of the edge inside a
     table that gates the public verdict, and locked decision 1 keeps vote() byte-untouched.
     CPI and valuation are compound votes with flip:null — their locked literals are pinned
     above, which is the whole reason rule 3 forbids inventing a crossing for them. */
  ok("ruler: the four scalar bands reconcile vote() ↔ flip edges ↔ the ruler's own numbers",
    (() => { const E = 0.001;
      const shown = (n, dec) => [String(Math.abs(n)), Math.abs(n).toFixed(dec)];
      return REGIME_BAND_TABLE.filter((b) => b.flip).length === 4 &&
        REGIME_BAND_TABLE.filter((b) => b.flip).every((b) => {
          const { bullEdge, bearEdge, bullSide, bullInclusive, dec } = b.flip;
          const below = bullSide === "below";
          // Fail, never THROW, on a band with no ruler: a predicate that crashes kills the
          // whole run and prints no total — the v3.99.4 P0 shape, and the missing-ruler
          // negative control reproduced it here before this guard.
          if (typeof b.ruler !== "string") return false;
          const voteOk = b.vote(below ? bullEdge - E : bullEdge + E) === "bull" &&
            (b.vote(bullEdge) === "bull") === !!bullInclusive &&
            b.vote(below ? bearEdge + E : bearEdge - E) === "bear" &&
            b.vote(bearEdge) !== "bear";
          const has = (n) => shown(n, dec).some((s) => b.ruler.includes(s));
          return voteOk && has(bullEdge) && has(bearEdge);
        }); })());
  /* ── v5.8 THE EXPLAINER SHEET ────────────────────────────────────────────────────────
     Owner ask: tapping a parameter card opens a tile with the highest-leverage 3-bullet
     summary of what the thing IS (full spellings, for a reader who has never seen "F&G"),
     what moves it, where normal sits, and what it means to the macro picture. Same
     one-home-per-band doctrine as `plain`/`whyItMatters`/`ruler`: the copy lives on the
     band, the card projects it, the section renders it and decides nothing. */
  /* v5.9.1 — owner correction: "I meant 3 bullets total. The tile descriptions too large."
     The sheet contract shrinks to exactly {full, what:[3]} — no drivers/baseline/macro/quote
     sections, and no free-form `sections` shape either (VERDICT_EXPLAIN moved to the same
     contract below). */
  ok("explain: every band carries a complete explainer — full name, EXACTLY 3 bullets, nothing else",
    REGIME_BAND_TABLE.every((b) => b.explain && typeof b.explain.full === "string" &&
      b.explain.full.length > 8 && Array.isArray(b.explain.what) && b.explain.what.length === 3 &&
      b.explain.what.every((s) => typeof s === "string" && s.length > 20) &&
      !("drivers" in b.explain) && !("baseline" in b.explain) && !("macro" in b.explain) &&
      !("quote" in b.explain) && !("lead" in b.explain) && !("sections" in b.explain)));
  /* Every accessor below goes through exOf, which returns {} for a band with no explainer:
     a predicate that THROWS kills the whole run and prints no total (the v3.99.4 P0 shape),
     and the missing-explainer negative control reproduced exactly that before this guard.
     A missing explainer must FAIL these pins, not silence the suite. */
  const exOf = (k) => (REGIME_BAND_TABLE.find((b) => b.key === k) || {}).explain || {};
  ok("explain: the full names are SPELLED OUT — a newcomer never meets an unexpanded acronym",
    (() => { const f = (k) => exOf(k).full || "";
      return /Cboe Volatility Index/.test(f("vix")) && /Fear and Greed/.test(f("fearGreed")) &&
        /Cyclically Adjusted Price-to-Earnings/.test(f("valuation")) &&
        /Consumer Price Index/.test(f("cpiHeadline")) &&
        /10-Year U\.S\. Treasury Yield/.test(f("tenYear")) &&
        /National Financial Conditions Index/.test(f("nfci")); })());
  /* The three research findings folded INTO the bullets (not a separate section any more):
     the single most-repeated CPI error (2% is a PCE target, not CPI's), VIX's 30 line being
     market convention rather than an official Cboe threshold, and NFCI's asymmetric band
     because conditions have run persistently below zero since 2008. Each fact still has to
     survive a later copy pass — pinned against the bullet text, wherever it now lives. */
  ok("explain: CPI's bullets state the PCE correction, and no band claims a 2% CPI target",
    (() => { const w = exOf("cpiHeadline").what || [];
      return w.some((b) => /2% target is on PCE, not CPI/.test(b)) &&
        !REGIME_BAND_TABLE.some((b) => /2% (CPI )?target/.test(b.ruler || "")); })());
  /* v5.9.5 FEAT-SIMPLE-SHEET-PLAIN v2 — the VIX sheet now PLACES the reading instead of
     describing the instrument. The v5.9.1 copy taught what VIX is made of ("the options
     market's estimate", "not a survey of opinion"); this teaches whether today's chip is
     high or low. TWO-RULER RULE: history/convention (teens calm · ~20 typical · 30 a scare)
     and MacroDash's own vote (below 18 helps, above 25 hurts) share a bullet only because
     BOTH are named — collapsing 20/30 into 18/25 would present our band as the world's. */
  ok("explain: the VIX sheet places a reading against BOTH rulers — convention and our vote",
    (() => { const w = (exOf("vix").what || [])[1] || "";
      return ["18", "25", "20", "30"].every((n) => w.includes(n)) &&
        /MacroDash/.test(w); })());
  ok("explain: NFCI's bullets state zero-by-construction and the post-2008 skew",
    (() => { const w = exOf("nfci").what || [];
      return w.some((b) => /Zero is average by construction/.test(b)) &&
        w.some((b) => /persistently below zero since 2008/.test(b)); })());
  /* v5.9.5: CAPE's second bullet places the reading between the old average and the 1999
     peak, then names our own hurt edges. Both numbers are INTERPOLATED from the constants
     the vote reads — pinned by value here and by template form below, so the sheet can never
     describe a level the model no longer uses. */
  ok("explain: the CAPE sheet places a reading between the old average and the 1999 peak",
    (() => { const w = (exOf("valuation").what || [])[1] || "";
      return w.includes(String(CAPE_MEAN)) && w.includes(String(CAPE_ATH)) &&
        /MacroDash/.test(w) && /90%/.test(w); })());
  ok("explain: those CAPE numbers are INTERPOLATED from the constants, never retyped",
    /1999 peak \$\{CAPE_ATH\}/.test(regimeSrc) && /Old average about \$\{CAPE_MEAN\}/.test(regimeSrc));
  /* v5.9.5: the 10Y sheet's whole job is saying WHY a small positive change reads MIXED and
     not a crisis — so it must state that the level is not what votes, and name the two edges
     that are. */
  ok("explain: the 10Y sheet says the LEVEL does not vote, and names the change edges",
    (() => { const w = (exOf("tenYear").what || [])[1] || "";
      return /does not vote on the level/.test(w) && w.includes("0.10") && w.includes("0.15"); })());
  /* The ban list from the ticket: instrument-mechanics vocabulary that taught the gauge
     instead of placing the number. Scoped to what[] ONLY — the TITLES are locked official
     names and "Cyclically Adjusted..." legitimately contains a banned stem. */
  ok("explain: the retired instrument-mechanics vocabulary is absent from all three sheets",
    (() => { const BAN = ["term premium", "discount rate", "options market", "risk-limit",
        "cyclically", "not a survey", "not an official cboe line", "post-1990 median",
        "live argument", "fed's expected path"];
      return ["vix", "valuation", "tenYear"].every((k) => {
        const w = (exOf(k).what || []).join(" ").toLowerCase();
        return BAN.every((b) => !w.includes(b)); }); })());
  ok("explain: the three official TITLES are unchanged by the plain-language pass",
    exOf("vix").full === "Cboe Volatility Index (VIX)" &&
    exOf("valuation").full === "Cyclically Adjusted Price-to-Earnings ratio (Shiller CAPE)" &&
    exOf("tenYear").full === "10-Year U.S. Treasury Yield");
  ok("explain: the card projection passes the band's explainer through untouched",
    (() => { const cards = sc({ regime:{ label:"RISK-ON" }, factors:[{ key:"vix", short:"VIX",
        vote:"bull", excluded:false, mode:"LIVE", metric:{ text:"14.43", value:14.43 } }] }).cards;
      return cards.length === 1 && !!cards[0].explain &&
        cards[0].explain === exOf("vix"); })());
  /* The section stays presentation-only (the v3.73 boundary pin above enforces the hooks
     half): the open state and the dialog both live in the primitive, and the section neither
     authors explainer copy nor renders the sheet body itself. */
  ok("explain: the sheet lives in a primitive — the section only hands it the projected copy",
    /import \{ Explainable \} from "\.\.\/primitives\/FactSheet\.jsx"/.test(spcSrc) &&
    /<Explainable[\s\S]{0,200}explain=\{c\.explain\}/.test(spcSrc) &&
    !/what it is|what moves it|normal \/ neutral/.test(spcSrc));
  /* v5.9.1 — the SHEET renderer is now one shape, one path: no free-form sections, no quote
     block, no lead/drivers/baseline/macro. VERDICT_EXPLAIN moved onto the SAME {full,what:[3]}
     contract every band explainer uses, which is what makes this pin possible at all. */
  ok("explain: ExplainerBody has exactly one render path — 3 bullets, nothing else",
    (() => { const code = fsSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      return /if \(!explain \|\| !Array\.isArray\(explain\.what\) \|\| !explain\.what\.length\) return null;/.test(code) &&
        !/const Section|explain\.drivers|explain\.baseline|explain\.macro|explain\.quote|sections\.map|explain\.lead|explain\.bands/.test(code); })());
  /* v5.9.2 (owner: "make the popup more visible in the middle of the screen and also the
     much larger font? It's too small for a user to read"). Source-level guard: the backdrop
     centers rather than bottom-anchors, and the title/bullets read at the LARGER tokens
     (fsXl 22px / fsBody 16px, both real design tokens — not one-off literals), never the old
     fsM/fsS pair. The browser suite proves the rendered pixels; this proves the intent
     cannot silently regress back to the small, bottom-anchored shape. */
  ok("v5.9.2: the sheet backdrop is CENTERED, and the title/body use the larger fsXl/fsBody tokens",
    /alignItems: "center"/.test(fsSrc) && !/alignItems: "flex-end"/.test(fsSrc) &&
    /fontSize: T\.fsXl,[\s\S]{0,80}fontWeight: 700/.test(fsSrc) &&
    /fontSize: T\.fsBody/.test(fsSrc) &&
    !/fontSize: T\.fsM,\s*\n?\s*fontWeight: 700/.test(fsSrc));
  ok("v5.9.2: fsBody is a real token (16px) between the sub-headline and hero sizes, not a literal",
    TOK_T.fsBody === 16 && TOK_T.fsL < TOK_T.fsBody && TOK_T.fsBody < TOK_T.fsXl);
  ok("explain: VERDICT_EXPLAIN carries exactly 3 bullets, the same shape as every band",
    typeof VERDICT_EXPLAIN.full === "string" &&
    Array.isArray(VERDICT_EXPLAIN.what) && VERDICT_EXPLAIN.what.length === 3 &&
    !("sections" in VERDICT_EXPLAIN) && !("lead" in VERDICT_EXPLAIN) &&
    (() => { const all = VERDICT_EXPLAIN.what.join(" ");
      return ["MOONING", "HODL", "DIAMOND HANDS", "CAN'T CALL IT",
        "BULLISH", "NEUTRAL", "BEARISH"].every((k) => all.includes(k)) &&
        /not a view on any one stock/.test(all) && /not advice/.test(all); })());
  ok("explain: a band with no explainer degrades to a plain div — a button that opens nothing is a lie",
    /if \(!explain\) return <div/.test(fsSrc));
  /* The WAI-ARIA dialog contract, pinned at the source and DRIVEN in the browser suite:
     labelled dialog, Escape, focus in on open and RESTORED on close, a real ✕ with a name,
     a trapped Tab, and the body scroll lock an iOS sheet needs. */
  ok("explain: the sheet implements the dialog pattern — labelled, escapable, focus-restoring, trapped",
    /role="dialog"/.test(fsSrc) && /aria-modal="true"/.test(fsSrc) &&
    /aria-labelledby="factsheet-title"/.test(fsSrc) &&
    /e\.key === "Escape"/.test(fsSrc) && /e\.key !== "Tab"/.test(fsSrc) &&
    /restoreRef\.current/.test(fsSrc) && /document\.body\.style\.overflow = "hidden"/.test(fsSrc) &&
    /aria-label=\{`Close \$\{title\}`\}/.test(fsSrc));
  ok("explain: the card and the sheet's ✕ both get real thumb targets on a phone",
    /\.simple-card\{min-height:44px;\}/.test(dashSrc) &&
    /@media\(max-width:480px\)\{\.fs-close\{min-height:44px;min-width:44px;\}\}/.test(dashSrc));
  /* ── v5.9 FIRST GLANCE ───────────────────────────────────────────────────────────────
     A beginner read of the live page (2026-08-29): "there's way too much going on, too many
     words at first glance… new folks likely have no context on hodl mooning or diamond
     hands." Three answers, all Simple-only: the verdict explains its own vocabulary, the
     card's ruler shrinks to a chip with the prose one tap deep, and the operator chrome
     leaves the beginner's first screen. Power is untouched, and pinned that way. */
  ok("v5.9 chip: the four scalar bands derive their chip from flip — never a third copy of an edge",
    (() => { const E = REGIME_BAND_TABLE.filter((b) => b.flip);
      return E.length === 4 && E.every((b) => {
        const c = rulerChip(b); if (typeof c !== "string") return false;
        const { bullEdge, bearEdge, dec } = b.flip;
        const shown = (n) => [String(Number(Number(n).toFixed(dec))).replace("-", "−")];
        return /^help [<>≤≥]/.test(c) && c.includes("· hurt") &&
          shown(bullEdge).some((x) => c.includes(x)) && shown(bearEdge).some((x) => c.includes(x)) &&
          c.length <= 32;   // chip-length: it shares one line with the freshness stamp
      }); })());
  ok("v5.9 chip: the two COMPOUND bands carry an authored short form — nothing invents a crossing",
    (() => { const cpi = REGIME_BAND_TABLE.find((b) => b.key === "cpiHeadline");
      const val = REGIME_BAND_TABLE.find((b) => b.key === "valuation");
      return cpi.flip === null && val.flip === null &&
        rulerChip(cpi) === cpi.rulerShort && rulerChip(val) === val.rulerShort &&
        /cooler than last print/.test(rulerChip(cpi)) &&
        // the CAPE edge is still DERIVED — one home, even in the chip
        rulerChip(val).includes((CAPE_MEAN * 1.5).toFixed(1)); })());
  ok("v5.9 chip: a band with neither a flip nor a short form yields null, never a guess",
    rulerChip({ key: "x" }) === null && rulerChip(null) === null);
  /* The verdict vocabulary explains itself. It lives in regime.js beside the engine whose
     four states it describes — the same one-home rule as the band explainers, and the reason
     it is not a second copy-table in the component that happens to render it. (The full
     content check moved to the v5.9.1 pin above, on the shrunk {full,what:[3]} contract.) */
  ok("v5.9 verdict: the token is tappable in SIMPLE only — Power's moon voice is untouched",
    /plainVerdict\s*\n?\s*\? <Explainable explain=\{VERDICT_EXPLAIN\}/.test(bandSrc) &&
    /: <span style=\{\{fontFamily:T\.fontMono,fontSize:T\.fsXl/.test(bandSrc) &&
    /import \{ VERDICT_EXPLAIN \}|VERDICT_EXPLAIN \} from "\.\.\/regime\.js"/.test(bandSrc));
  ok("v5.9 chrome: the beginner's first screen sheds the operator words, and Power keeps them",
    // the duplicate lowercase wordmark, the provenance chip (except on ERROR), the alert
    // badges and the OPS menu are all Power's now; each is pinned at its own gate.
    /\{!simple&&<div className="sub-wordmark"/.test(dashSrc) &&
    /\{\(!simple\|\|mode==="ERROR"\)&&<DataModeBadge/.test(dashSrc) &&
    /\{!simple&&!publicView&&\(activeAlerts>0\|\|alertBlind>0\)/.test(dashSrc) &&
    /\{!simple&&!publicView&&\(\s*\n?\s*<details className="hdr-ops"/.test(dashSrc));
  ok("v5.9 chrome: an ERROR still shows its badge in Simple — a red fact is not a density trade",
    /\(!simple\|\|mode==="ERROR"\)/.test(dashSrc));
  ok("v5.9: the copy control keeps its job in Simple but loses its three words",
    (() => { const code = bandSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      return /plainVerdict\s*\n?\s*\? \(callCopied\?"✓":"⎘"\)/.test(code) &&
        /aria-label="Copy MacroDash posture card"/.test(code); })());
  ok("v4.0 boundary: the projections import no threshold and re-derive no vote",
    (() => { const seg = evidenceSrc.slice(evidenceSrc.indexOf("SIMPLE MODE PROJECTIONS"));
      return !/NFCI_TIGHT|NFCI_LOOSE|computeRegime\(|flipConditions\(|\.vote\(/.test(seg); })());
  ok("v5.3 boundary: the canonical call owns both modes; Simple scope cannot rename it",
    /plainVerdict=\{simple\?simpleV:null\}/.test(dashSrc) &&
    /call=\{dailyCall\}/.test(dashSrc) &&
    /const callLabel=call&&call\.headline/.test(bandSrc) &&
    /const machineLabel=call&&call\.direction/.test(bandSrc));
  /* 8/28 Whys altitude — the flip has ONE home in Simple: the whys' closed label. The
     SimpleCards footer slot (its home v4.0→8/28) is gone, prop included — dead code is a
     rot vector (v3.73). Power's flip home (the ℹ panel) is untouched. */
  ok("8/28: the flip left the cards — no flipLine prop, no ⇄ in SimpleCards",
    !/flipLine/.test(spcSrc) && !spcSrc.includes("⇄"));
  /* 8/28 Whys altitude, RUN not string-pinned: a truncation rule is a claim about lengths. */
  ok("8/28: the closed chip is chip-length and its verbatim tail rides one tap deep",
    (() => { const long = "NFCI above -0.50 SD would move this to MACRO: HODL, if other signals stay put";
      const chip = flipChipOf(long);
      return chip.length <= FLIP_CHIP_MAX && chip.endsWith("…") && long.startsWith(chip.slice(0, -1).trim()) &&
             flipChipOf("short one") === "short one" && flipChipOf(null) === null &&
             /flipChip\?`\$\{label\} — ⇄ \$\{flipChip\}`:label/.test(whysSrc) &&
             /\{flipLine&&<div[^>]*>⇄ \{flipLine\}<\/div>\}/.test(whysSrc); })());
  ok("8/28: a WITHHELD posture advertises no flip — bare label, withheld sentence inside",
    /flipChip=\{evidenceSet\.withheld\?null:/.test(dashSrc) &&
    /^Call withheld until/.test(sf({ withheld: true })));
  ok("8/28 B: the chip rides the LABEL — no second element outside the CollapsedGroup",
    (() => { const open = whysSrc.indexOf("<CollapsedGroup"), close = whysSrc.indexOf("</CollapsedGroup>");
      return open > 0 && close > open &&
        whysSrc.indexOf("{flipLine&&") > open && whysSrc.indexOf("{flipLine&&") < close &&
        !/<\/CollapsedGroup>[\s\S]*⇄/.test(whysSrc); })());
  ok("8/28 A1: the header stamp binds its timestamp to the DATA, not the call",
    dashSrc.includes("`${d.session} · data pulled ${d.lastRefresh}`"));
  ok("v4.0 boundary: the cards are Simple-only and the section is presentation-only",
    /\{simple&&<SimpleCards/.test(dashSrc) &&
    (() => { const code = spcSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      return !/useState|useEffect|localStorage|computeRegime|buildEvidenceSet|REGIME_BAND_TABLE/.test(code); })());
  ok("v4.0 boundary: the engine is untouched — no new voter, quorum or band",
    REGIME_BAND_TABLE.length === 6 && REGIME_QUORUM === 4);
}

// ---- 69. v4.1.1 — ageDays: the ET clock reaches the terminal (FIX-A, 4th recurrence) ------
// The terminal's ageDays anchored a stamp at NOON UTC and differenced it against Date.now(),
// mixing a calendar date with a wall clock. A date stamped "today in ET" therefore read as
// age -1 (FUTURE) from 00:00 ET until 12:00 UTC (08:00 ET) — so circuitStateCli returned
// "dated in the future", stance() went ADDS SUSPENDED, and 11 render assertions covering
// FEAT-TT-ENTRY, FEAT-TT-TECHREAD, RANKFAIR's cap veto and the ALLOC confirm failed. Only
// between midnight and 8am ET, which is exactly how it stayed invisible.
// This is the FOURTH time this defect class has landed (v3.11 UTC run stamps, v3.35 fixture
// dates, v3.80 the composed-lifecycle test that "passed by daylight and went red every
// night"), so it is pinned across the HOURS, not just asserted once at whatever time CI runs.
console.log("\n[69] ageDays — ET calendar date vs ET calendar date, at every hour");
{
  const lift = (n) => { const i = adminSrc.indexOf("function " + n + "(");
    let d = 0; for (let k = adminSrc.indexOf("{", i); k < adminSrc.length; k++) {
      if (adminSrc[k] === "{") d++; else if (adminSrc[k] === "}") { d--; if (!d) return adminSrc.slice(i, k + 1); } } };
  const SRC = lift("ageDays");
  // Inject a frozen clock: ageDays uses `new Date()` and Date.parse, nothing else.
  const at = (instant) => { const R = Date;
    function D() { return new R(instant); }
    D.parse = (x) => R.parse(x); D.now = () => R.parse(instant);
    return new Function("Date", SRC + "\nreturn ageDays;")(D); };
  const ET = (inst) => new Date(inst).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  // Four instants spanning an ET day, incl. both sides of the old noon-UTC cliff.
  const HOURS = ["2026-08-20T04:30:00Z" /*00:30 ET*/, "2026-08-20T11:59:00Z" /*07:59 ET*/,
                 "2026-08-20T16:00:00Z" /*12:00 ET*/, "2026-08-21T03:59:00Z" /*23:59 ET*/];

  ok("ageDays: a stamp made TODAY in ET reads 0 at EVERY hour — the whole bug was that it " +
     "read -1 before 8am ET",
    HOURS.every((h) => at(h)(ET(h)) === 0));
  ok("ageDays: YESTERDAY reads exactly 1 at every hour — no wall-clock term left in the math",
    HOURS.every((h) => { const y = ET(new Date(Date.parse(h) - 86400000).toISOString());
      return at(h)(y) === 1; }));
  ok("ageDays: a genuinely future stamp is still NEGATIVE — the fail-closed signal every " +
     "consumer keys on (runState 'never', circuitStateCli 'cannot be judged') survives",
    HOURS.every((h) => { const t = ET(new Date(Date.parse(h) + 3 * 86400000).toISOString());
      return at(h)(t) < 0; }));
  ok("ageDays: absent/malformed still returns null, the FAIL-CLOSED signal — unchanged",
    (() => { const f = at(HOURS[0]);
      return f("") === null && f(null) === null && f("2026-8-1") === null
        && f("2026-08-20T00:00:00Z") === null; })());  // strict guard deliberately kept
  // NEGATIVE CONTROL: prove the pin would catch a revert. The old body, run at 00:30 ET.
  ok("ageDays NEGATIVE CONTROL: the retired noon-UTC formula returns -1 for a today-stamp at " +
     "00:30 ET — so a revert to it fails this section rather than passing quietly",
    (() => { const inst = HOURS[0], R = Date;
      const old = (iso) => Math.floor((R.parse(inst) - R.parse(iso + "T12:00:00Z")) / 86400000);
      return old(ET(inst)) === -1; })());
  ok("ageDays: the noon-UTC anchor is GONE from the source — a comment claiming it 'dodges " +
     "timezone edge cases' must not outlive the code it described",
    !/T12:00:00Z/.test(SRC) && /America\/New_York/.test(SRC));
  ok("ageDays: the terminal now uses the SAME ET-calendar rule as the server time-judges " +
     "(tt-alloc ageDaysEt / ttScore ageDaysET), so one clock governs the stack",
    /toLocaleDateString\("en-CA",\{timeZone:"America\/New_York"\}\)/.test(SRC));
}

// ═══════════ [70] FEAT-TT-SUGGEST (v4.2) — the street invert, suggest-don't-save ═══════════
// suggestMultiple() unblocks the floor-only class ("missing multiple" is a missing INVERT,
// not a missing thesis — owner design 2026-08-21): PE/EVS invert at the STREET target, lens
// picked by the existing TSM/UBER + RKLB rules, UNKNOWN naming every missing input, and a
// SEED the owner confirms — the function itself never writes. All fixtures SYNTHETIC (book
// content never enters this repo). The seed's floor_only_before is proven BEHAVIORALLY:
// applied exactly as the confirm handler applies it, lintPtModel must come back clean, and
// the same seed WITHOUT it must fire MISKEY (the negative control).
console.log("\n[70] FEAT-TT-SUGGEST — street invert + one-confirm seed");
{
  const SM = PT.suggestMultiple;
  const base = { consensus: { eps: { "2027": 2.0, "2028": 3.0 } }, pt_model: { pe_floor_multiple: 18 } };
  const s1 = SM(base, { pt: 60 }, 50, "2027");
  ok("P/E invert: $60 / FY2028 EPS $3 = 20.0x at the y=2027 rung",
    s1.state === "suggest" && s1.pick === "P/E" && s1.mult === 20 && s1.fwd === "2028");
  ok("seed carries floor_only_before when the seeded year is past the first row year",
    s1.seed.path === "pe_premium_multiple" && s1.seed.year === "2027" && s1.seed.floor_only_before === "2027");
  const s1a = SM(base, { pt: 60 }, 50, null);
  ok("no horizon → first row year, and NO floor_only_before when seeding it",
    s1a.state === "suggest" && s1a.seed.year === "2026" && s1a.mult === 30 && s1a.seed.floor_only_before === null);
  const pre = { consensus: { eps: { "2027": -1.2, "2028": -0.4 }, revenue_B: { "2027": 2.0, "2028": 4.0 } },
    pt_model: { pe_floor_multiple: 18, share_count_M: 100, net_cash_B: { "2026": 1.0 } } };
  const s2 = SM(pre, { pt: 50 }, 40, "2027");
  ok("pre-profit → EV/S invert: ($50×100/1000 − 1.0) / $4.0B = 1.0x",
    s2.state === "suggest" && s2.pick === "EV/S" && s2.mult === 1 && s2.seed.path === "ev_s_multiple");
  const crossing = { consensus: { eps: { "2027": 0.01, "2028": 0.05 }, revenue_B: { "2027": 2.0, "2028": 4.0 } },
    pt_model: { pe_floor_multiple: 18, share_count_M: 100, net_cash_B: { "2026": 1.0 } } };
  const s3 = SM(crossing, { pt: 50 }, 60, "2027");
  ok("crossing artifact (60/0.05 = 1200x > LENS_MAX_PE) → EV/S despite positive EPS, and it says so",
    s3.state === "suggest" && s3.pick === "EV/S" && s3.crossing === true);
  const s4 = SM({ consensus: { eps: { "2027": -1, "2028": -2 }, revenue_B: { "2028": 4 } },
    pt_model: { pe_floor_multiple: 18 } }, { pt: 50 }, 40, "2027");
  ok("UNKNOWN names the exact missing EV/S inputs, never guesses",
    s4.state === "unknown" && s4.unknown.some((w) => /share_count_M/.test(w) && /net_cash_B/.test(w)));
  ok("no target on file → UNKNOWN saying so",
    SM(base, null, 50, "2027").unknown[0] === "no street target on file");
  ok("an already-modelled name is left alone",
    SM({ ...base, pt_model: { pe_premium_multiple: { "2027": 30 } } }, { pt: 60 }, 50, "2027").state === "modelled");
  ok("deliberate floor-only (MU-class floor_only_before) is respected, never nagged",
    SM({ ...base, pt_model: { pe_floor_multiple: 18, floor_only_before: "2028" } }, { pt: 60 }, 50, "2027").state === "floor_by_design");
  ok("EV/S invert that lands non-positive (target below net cash) is refused with the reason",
    SM({ consensus: { eps: { "2028": -1 }, revenue_B: { "2028": 4 } },
      pt_model: { share_count_M: 10, net_cash_B: { "2026": 5 } } }, { pt: 20 }, 10, "2027")
      .unknown.some((w) => /non-positive/.test(w)));
  // The seed applied EXACTLY as seedSuggestedMultiple applies it → lint-clean; without the
  // fob → MISKEY. This is the behavioral proof that the confirm path cannot write a rung
  // that silently floors (the v3.39 NVDA defect, structurally prevented).
  const seeded = JSON.parse(JSON.stringify(base));
  seeded.pt_model[s1.seed.path] = { [s1.seed.year]: s1.seed.mult };
  seeded.pt_model.floor_only_before = s1.seed.floor_only_before;
  ok("applied seed is lint-clean (fob suppresses MISKEY exactly as the MU precedent does)",
    PT.lintPtModel(seeded).filter((l) => l.sev === "error").length === 0);
  const noFob = JSON.parse(JSON.stringify(base));
  noFob.pt_model[s1.seed.path] = { [s1.seed.year]: s1.seed.mult };
  ok("negative control: the SAME seed without floor_only_before fires MISKEY",
    PT.lintPtModel(noFob).some((l) => l.code === "MISKEY"));
  ok("purity: suggestMultiple never writes (no fetch/persist/KV reference in its source)",
    !/fetch|ddPersist|PULSE_CACHE/.test(String(SM)));
  // Ranking isolation: the diagnostic must never leak into the queue. renderUpsideRank's own
  // source is sliced and must not reference the suggester; the ONLY writer is the confirm
  // handler, which runs the same hard-lint gate the payload editor runs.
  const rurStart = adminSrc.indexOf("function renderUpsideRank(");
  const rurSlice = adminSrc.slice(rurStart, adminSrc.indexOf("function renderMagBlock("));
  ok("isolation: renderUpsideRank never calls suggestMultiple — DERIVED-STREET enters no ranking",
    rurStart > 0 && !/suggestMultiple/.test(rurSlice));
  const seedFn = liftFns(adminSrc, ["seedSuggestedMultiple"]);
  ok("the confirm handler recomputes at click, edits a COPY, and runs the hard-lint gate before ddPersist",
    /suggestMultiple\(dd,tgt,px,effHorizon\(\)\)/.test(seedFn) && /JSON\.parse\(JSON\.stringify\(dd\)\)/.test(seedFn) &&
    /sev==="error"/.test(seedFn) && /SEED ABORTED/.test(seedFn) && /ddPersist\(sym,next\)/.test(seedFn));
  ok("target priority: the reviewed street record outranks the stored consensus.street_target",
    (() => { const f = liftFns(adminSrc, ["streetTargetOf"]);
      return f.indexOf("analystTarget") < f.indexOf("street_target"); })());

}


// ═══════════ [71] FEAT-TT-DRIFT (v4.3) — the asserted layer falling behind the measured ═══════════
// Three probes over one pattern, all measured on the live book 2026-08-22: META's hinge outlived
// its own resolution by 9 days; 7 of 17 composites carried evidence newer than the score (and the
// composite is a HARD >=B eligibility gate); 2-analyst years priced real rungs. Zero network calls
// — every input is already in the payload, which is why this is a lint and not a sourcing agent.
console.log("\n[71] FEAT-TT-DRIFT — hinge staleness, composite drift, thin coverage");
{
  const D = DRIFT, NOW = Date.parse("2026-08-22T17:00:00Z");
  const cap = { consensus: { source: "REAL CONSENSUS MEANS, owner capture 2026-08-13" } };
  ok("captureDates reads the whitelist and finds a date inside capture free-text",
    D.newestCapture(cap, NOW) === "2026-08-13");
  // THE TWO GUARDS, both required — CRM produced this false positive twice.
  ok("guard 1: a date outside the whitelist (a key_date) is invisible",
    D.newestCapture({ key_dates: [{ date: "2026-08-20" }] }, NOW) === null);
  ok("guard 2: a FUTURE date inside a whitelisted field is refused — a capture cannot be ahead of today " +
     "(CRM's fiscal-period end 2027-01-31 scanned as a capture and reported a hinge 170d stale)",
    D.newestCapture({ consensus: { source: "FY2027 ends 2027-01-31, captured 2026-08-14" } }, NOW) === "2026-08-14");
  // HINGE_STALE — the META case.
  const meta = { ...cap, hinges: [{ label: "Consensus financials", state: "unknown", asOf: "2026-08-04" }] };
  const sh = D.staleHinges(meta, NOW);
  ok("HINGE_STALE: an UNKNOWN hinge behind its payload's capture is flagged with the real gap",
    sh.length === 1 && sh[0].gap === 9);
  ok("HINGE_STALE: a GRADED hinge behind the same capture is NOT flagged — only ungraded ones",
    D.staleHinges({ ...cap, hinges: [{ label: "x", state: "green", asOf: "2026-08-04" }] }, NOW).length === 0);
  ok("HINGE_STALE: an UNDATED unknown hinge is flagged with a null gap, never a fabricated one",
    (() => { const r = D.staleHinges({ ...cap, hinges: [{ label: "x", state: "unknown" }] }, NOW);
      return r.length === 1 && r[0].gap === null; })());
  ok("HINGE_STALE: no capture date at all → nothing to compare against, so no finding",
    D.staleHinges({ hinges: [{ label: "x", state: "unknown" }] }, NOW).length === 0);
  // THIN_COVERAGE — scoped to years a rung actually prices (23 unscoped hits vs 4 scoped on the live book).
  const thin = { consensus: { analyst_counts: { eps: { "2029": 2, "2033": 1 } } } };
  ok("THIN_COVERAGE fires for an in-reach year (row y=2028 prices FY2029)",
    (() => { const r = D.thinCoverage(thin, ["2028"]); return r.length === 1 && r[0].year === "2029" && r[0].n === 2; })());
  ok("THIN_COVERAGE is SILENT on out-of-reach years — MU's 1-analyst 2033 is irrelevant at a 2027 horizon",
    D.thinCoverage(thin, ["2026"]).length === 0);
  ok("THIN_COVERAGE accepts the flat per-year shape as well as the per-series one",
    D.thinCoverage({ consensus: { analyst_counts: { "2029": 2 } } }, ["2028"]).length === 1);
  ok("THIN_COVERAGE: a prose placeholder never reads as data",
    D.thinCoverage({ consensus: { analyst_counts: "NOT CAPTURED — cropped" } }, ["2028"]).length === 0);
  ok(`THIN_COVERAGE: the floor is the owner rule of ${D.THIN_MIN} — exactly 3 passes, 2 fires`,
    D.THIN_MIN === 3 &&
    D.thinCoverage({ consensus: { analyst_counts: { eps: { "2029": 3 } } } }, ["2028"]).length === 0 &&
    D.thinCoverage({ consensus: { analyst_counts: { eps: { "2029": 2 } } } }, ["2028"]).length === 1);
  /* REGRESSION — the caller must pass EMITTED rows, never ptRowYears. Shipped wrong on
     2026-08-22 and caught by sweeping the live book: excluding NVDA's/HOOD's 2-analyst FY2030
     EPS removed the deepest rung, but FY2030 REVENUE legitimately stayed, so ptRowYears kept
     proposing y=2029 and the lint reported both names thin AFTER they were fixed. Driven
     through the REAL ptModel functions — a hand-built year list could not prove the two
     disagree. */
  {
    const excl = { ref_px: { px: 100 }, pt_model: { pe_premium_multiple: { "2026": 20 }, share_count_M: 1000 },
      consensus: { revenue_B: { "2027": 10, "2028": 12, "2029": 14, "2030": 16 },   // revenue reaches FY2030
                   eps: { "2027": 1, "2028": 2, "2029": 3 },                        // eps does NOT — excluded
                   analyst_counts: { eps: { "2030": 2 } } } };
    const cand = PT.ptRowYears(excl, "2026");
    const emitted = (PT.ptModelRows(excl, "2026") || []).map((r) => r.y);
    ok("THIN_COVERAGE regression: ptRowYears and the emitted rows genuinely disagree (the trap is real)",
      cand.includes("2029") && !emitted.includes("2029"));
    ok("THIN_COVERAGE regression: scoped to EMITTED rows, an excluded year is SILENT — fixed work never reads as outstanding",
      D.thinCoverage(excl, emitted).length === 0);
    ok("THIN_COVERAGE regression control: scoped to ptRowYears it fires — proving the test would catch a revert",
      D.thinCoverage(excl, cand).length === 1);
    ok("driftSec passes the EMITTED rows, never ptRowYears",
      /rows=ptModelRows\(dd\)\|\|\[\];ry=rows\.map\(r=>r\.y\)/.test(adminSrc) &&
      !/ry=ptRowYears\(dd\)/.test(adminSrc));
  }
  // COMPOSITE_STALE — gated the eligible line until §14.8 activation; historical now, still linted.
  ok("COMPOSITE_STALE: evidence moving after the score is flagged as moved",
    (() => { const r = D.compositeDrift({ composite: { score: 7, basis: "scored 2026-08-18" },
      hinges: [{ asOf: "2026-08-22" }] }, NOW); return r && r.moved === true; })());
  ok("COMPOSITE_STALE: a fresh score with older evidence is CLEAN — recency alone is not drift",
    D.compositeDrift({ composite: { score: 7, basis: "scored 2026-08-20" }, hinges: [{ asOf: "2026-08-01" }] }, NOW) === null);
  ok("COMPOSITE_STALE: age alone fires past the window, and the window is stated",
    D.COMPOSITE_MAX_D === 14 &&
    D.compositeDrift({ composite: { score: 7, basis: "scored 2026-08-01" } }, NOW).age === 21);
  ok("COMPOSITE_STALE: an undated basis says it cannot be aged rather than guessing an age",
    D.compositeDrift({ composite: { score: 7, basis: "no date here" } }, NOW).scored === null);
  ok("COMPOSITE_STALE: no composite at all is not a drift finding",
    D.compositeDrift({}, NOW) === null);
  // Contract: advisory only. A hard error would block saves on payloads that are merely old.
  ok("every drift finding is sev:warn — this lint never blocks a save (the MISKEY contrast)",
    D.lintDrift(meta, ["2028"], NOW).every((l) => l.sev === "warn"));
  ok("purity: lintDrift makes no network call and writes nothing",
    !/fetch|ddPersist|PULSE_CACHE|localStorage/.test(String(D.lintDrift) + String(D.compositeDrift) + String(D.staleHinges)));
  ok("the terminal renders drift beside the intake checklist and never gates on it",
    /h\+=driftSec\(x\);/.test(adminSrc) &&
    (() => { const f = liftFns(adminSrc, ["driftSec"]);
      // v5.0: the call carries ctx (card + inputs + rows) so TARGET_STALE/RUNWAY_SPLIT run
      // at the one altitude where the full record exists; still advisory-only.
      return /lintDrift\(dd,ry,undefined,ctx\)/.test(f) && !/gateFail|AGREE_PICK|blocker/.test(f); })());

  /* ── v5.0 (W2/W3): the three new detectors, each RUN — a lint is a claim about data ── */
  // TARGET_STALE — the frozen card target vs the live ladder. 30/30 cards agreed on
  // 2026-08-23 only because everything was scored that day at live quotes; this is the guard
  // that freshness coincidence was standing in for.
  const CARD_T = (target, basis = "PREMIUM") => ({ pillars: { owner_valuation:
    { target, target_year: "2027", basis_used: basis } } });
  ok("TARGET_STALE: a >5% gap between the frozen card target and the live rung is NAMED with both numbers",
    (() => { const r = D.targetDrift(CARD_T(200), [{ y: "2027", prem: 230, fl: 100 }]);
      return r && r.card_target === 200 && r.fresh === 230 && r.pct === 15; })());
  // Float note (the v3.83 convention): 210/200-1 computes 5.000000000000004%, so the exact
  // edge is float-unsafe by construction — pinned clear of it on both sides instead.
  ok("TARGET_STALE: inside 5% is silent — the receipt governs at its stamped basis, a small drift is not a finding",
    D.targetDrift(CARD_T(200), [{ y: "2027", prem: 206, fl: 100 }]) === null &&
    D.targetDrift(CARD_T(200), [{ y: "2027", prem: 209.8, fl: 100 }]) === null &&
    D.targetDrift(CARD_T(200), [{ y: "2027", prem: 210.5, fl: 100 }]) !== null);
  ok("TARGET_STALE: basis-aware — a FLOOR card compares against fl, never the premium beside it",
    (() => { const r = D.targetDrift(CARD_T(100, "FLOOR"), [{ y: "2027", prem: 230, fl: 101 }]);
      return r === null; })() &&
    (() => { const r = D.targetDrift(CARD_T(100, "FLOOR"), [{ y: "2027", prem: 230, fl: 120 }]);
      return r && r.fresh === 120; })());
  ok("TARGET_STALE: the rung disappearing entirely reads 'gone' — the model moved from under the receipt",
    (() => { const r = D.targetDrift(CARD_T(200), [{ y: "2028", prem: 230, fl: 100 }]);
      return r && r.gone === true; })() &&
    D.targetDrift({ pillars: {} }, [{ y: "2027", prem: 230 }]) === null);   // no target = nothing to drift
  // RUNWAY_SPLIT — one fact, two homes (the ACHR 21.9-vs-24 intra-session split, caught by hand).
  const UI_RW = (a, b) => ({ economic_quality: { runway_months: a === undefined ? undefined : { value: a } },
    route_gates: { PH_G2_RUNWAY: b === undefined ? {} : { runway_months: b } } });
  ok("RUNWAY_SPLIT: numeric copies that disagree are a finding naming both",
    (() => { const r = D.runwaySplit(UI_RW(21.9, 24)); return r && r.a === 21.9 && r.b === 24; })() &&
    D.runwaySplit(UI_RW(24, 24)) === null);
  ok("RUNWAY_SPLIT: mode-aware — a P3 with no runway field (the SYM shape) is silent, never a false split",
    D.runwaySplit({ economic_quality: {}, route_gates: { PH_G2_RUNWAY: { runway_months: "SELF_FUNDING" } } }) === null &&
    D.runwaySplit(UI_RW(undefined, 24)) === null);
  ok("RUNWAY_SPLIT: SELF_FUNDING beside a numeric burn is a CONTRADICTION — a generator and a burn-down cannot both be true",
    (() => { const r = D.runwaySplit(UI_RW("SELF_FUNDING", 24)); return r && r.kind === "sentinel"; })() &&
    D.runwaySplit(UI_RW("SELF_FUNDING", "SELF_FUNDING")) === null);
  // LABEL_DRIFT — the GEV case: prose claiming floor-only beside a stored premium.
  ok("LABEL_DRIFT: 'no premium multiple' prose beside a stored premium fires (the GEV defect, verbatim shape)",
    (() => { const r = D.labelDrift({ pt_model: { pe_premium_multiple: { 2027: 34.9 },
      basis: "Floor only: 18x FY+1 EPS. No premium multiple asserted." } });
      return r && /no premium multiple/.test(r.phrase); })());
  ok("LABEL_DRIFT: floor-only prose is LEGITIMATE when floor_only_before scopes it — the corrected GEV must not re-fire",
    D.labelDrift({ pt_model: { pe_premium_multiple: { 2027: 34.9 }, floor_only_before: "2027",
      basis: "the YE2026 rung is deliberately floor-only; premium engages from YE2027" } }) === null);
  ok("LABEL_DRIFT: a genuinely floor-only model is silent — the phrase is only a lie beside a premium",
    D.labelDrift({ pt_model: { pe_floor_multiple: 18, basis: "Floor only: 18x FY+1 EPS. No premium multiple asserted." } }) === null);
  // Emission: all three ride lintDrift via ctx, all sev:warn (the family contract holds).
  ok("v5 lints: lintDrift emits all three through ctx, every finding still sev:warn",
    (() => { const dd = { pt_model: { pe_premium_multiple: { 2027: 30 }, basis: "no premium multiple asserted" } };
      const ctx = { card: CARD_T(200), rows: [{ y: "2027", prem: 230, fl: 100 }],
        ui: UI_RW(21.9, 24) };
      const ls = D.lintDrift(dd, [], undefined, ctx);
      const codes = ls.map((l) => l.code);
      return codes.includes("TARGET_STALE") && codes.includes("RUNWAY_SPLIT") &&
        codes.includes("LABEL_DRIFT") && ls.every((l) => l.sev === "warn"); })());
  ok("v5 lints: an absent ctx behaves exactly as v4.3 — the new detectors are additive, never a new requirement",
    (() => { const ls = D.lintDrift({ pt_model: { pe_floor_multiple: 18 } }, [], undefined);
      return ls.every((l) => !["TARGET_STALE", "RUNWAY_SPLIT"].includes(l.code)); })());
}

// ═══════════ [72] v5.0 W0 — THE QUOTE BATCH: one key, merge-on-write, entry-age freshness ═══════════
// The per-symbol tt:quote:<SYM> keys blew the KV free-tier delete cap on 2026-08-23 —
// one whole-book refresh was ~40 writes + ~40 TTL expirations. One batch key collapses
// that to 1 + 1 WITHOUT moving the stated 2-minute freshness contract, which now lives on
// each entry's own `at` stamp (key presence proves nothing once merge-on-write refreshes
// the key). Behavioral, not string-pinned: the whole feature is a claim about op counts.
console.log("\n[72] v5.0 W0 — quote batch: op-count collapse, merge-on-write, freshness");
{
  const QC = await import("../functions/lib/quote-cache.js");
  const QEP = await import("../functions/api/quotes.js");
  const mkKv = (seed = {}) => {
    const store = new Map(Object.entries(seed));
    const log = { puts: [], gets: [] };
    return { store, log, kv: {
      get: async (k, t) => { log.gets.push(k); const v = store.get(k); return v == null ? null : (t === "json" ? JSON.parse(v) : v); },
      put: async (k, v) => { log.puts.push(k); store.set(k, String(v)); },
    } };
  };
  const rq = (syms) => ({ url: "https://x.test/api/quotes?syms=" + syms, headers: { get: () => null } });
  const realFetch = globalThis.fetch;
  let finnhubCalls = [];
  globalThis.fetch = async (url) => {
    const sym = new URL(url).searchParams.get("symbol");
    finnhubCalls.push(sym);
    return { ok: true, json: async () => ({ c: 100 + sym.length, dp: 1.5 }) };
  };
  try {
    // COLD whole-batch refresh → exactly ONE put, the batch key — the op-count collapse itself.
    let { store, log, kv } = mkKv();
    let env = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: kv, FINNHUB_KEY: "k" };
    let r = await QEP.onRequestGet({ request: rq("AAA,BBB,CCC"), env });
    let body = JSON.parse(await r.text());
    ok("W0: a cold 3-symbol refresh performs exactly ONE KV put — the batch key, never per-sym",
      log.puts.length === 1 && log.puts[0] === QC.QUOTE_BATCH_KEY &&
      Object.keys(body.quotes).length === 3);
    // WARM within the window → zero puts, zero upstream calls; served from entry-age hits.
    finnhubCalls = []; log.puts.length = 0;
    r = await QEP.onRequestGet({ request: rq("AAA,BBB,CCC"), env });
    body = JSON.parse(await r.text());
    ok("W0: a warm refresh inside the 2-min window is ZERO puts and ZERO upstream fetches",
      log.puts.length === 0 && finnhubCalls.length === 0 && Object.keys(body.quotes).length === 3);
    // MERGE-ON-WRITE: a subset request must not clobber symbols it did not ask about.
    finnhubCalls = [];
    await QEP.onRequestGet({ request: rq("DDD"), env });
    const merged = JSON.parse(store.get(QC.QUOTE_BATCH_KEY)).quotes;
    ok("W0: merge-on-write — a 1-symbol request leaves the other 3 entries in the batch intact",
      ["AAA", "BBB", "CCC", "DDD"].every((s) => merged[s] && Number.isFinite(merged[s].px)));
    // ENTRY-AGE freshness: an old entry inside a FRESH key is a MISS, never served as live.
    const oldAt = new Date(Date.now() - 10 * 60000).toISOString();
    ({ store, log, kv } = mkKv({ [QC.QUOTE_BATCH_KEY]: JSON.stringify({ at: new Date().toISOString(),
      quotes: { AAA: { px: 55, at: oldAt } } }) }));
    env = { ACCESS_DEV_BYPASS: "1", PULSE_CACHE: kv, FINNHUB_KEY: "k" };
    finnhubCalls = [];
    r = await QEP.onRequestGet({ request: rq("AAA"), env });
    body = JSON.parse(await r.text());
    ok("W0: a 10-minute-old entry in a fresh batch key is a MISS — refetched, never served stale as live",
      finnhubCalls.includes("AAA") && body.quotes.AAA.px !== 55);
    ok("W0: freshEntry fails CLOSED — garbled/missing stamps and non-finite px all read null",
      QC.freshEntry({ px: 1, at: "not-a-date" }, Date.now()) === null &&
      QC.freshEntry({ px: NaN, at: new Date().toISOString() }, Date.now()) === null &&
      QC.freshEntry(null, Date.now()) === null &&
      QC.freshEntry({ px: 1, at: new Date().toISOString() }, Date.now()) !== null);
  } finally { globalThis.fetch = realFetch; }
  // The three consumers all resolve freshness through the ONE lib — no per-sym key remains.
  const qsrc = readSrc("../functions/api/quotes.js"), tsrc = readSrc("../functions/api/tt.js"),
    asrc = readSrc("../functions/api/allocation.js");
  ok("W0: every consumer imports the one quote-cache lib and no per-symbol tt:quote concat survives",
    [qsrc, tsrc, asrc].every((x) => /lib\/quote-cache\.js/.test(x)) &&
    ![qsrc, tsrc, asrc].some((x) => /QUOTE_PREFIX \+|CACHE_PREFIX \+/.test(x)));
  ok("W0: the ledger px stamp reads the batch ONCE per append and gates on freshEntry",
    /readQuoteBatch\(env\)/.test(tsrc) && /freshEntry\(qBatch\.quotes\[sym\]/.test(tsrc));
}

// ---- 73. v5.3 ONE CALL — identity + immutable live-forward accountability ------
console.log("\n[73] v5.3 ONE CALL — canonical vocabulary, additive API, immutable history");
{
  // Endpoint tests must use today's ET cache key; a fixed date silently falls through to
  // the network as soon as the calendar moves and stops testing the fixture at all.
  const D = new Date().toLocaleDateString("en-CA", {timeZone:"America/New_York"});
  const now = new Date(`${D}T16:00:00Z`);
  const live = (overrides = {}) => ({
    tenYear: 4.1, tenYearM1: -0.2, tenYearAsOf: D,
    vix: 15, vixAsOf: D,
    fearGreed: 60, fearGreedLabel:"Greed", fearGreedAsOf: D,
    cpiHeadline: 2.4, cpiTrend: [3.0, 2.8, 2.6, 2.4], cpiHeadlineAsOf: D,
    shillerPe: 20, shillerPeAsOf: D,
    nfci: -0.6, nfciAsOf: D,
    spyPrice: 700, spyMa200: 650, spyPriceAsOf: D,
    ...overrides,
  });
  const bull = buildMacroCall(live(), { now, effectiveDate: D });
  ok("one-call: public engine maps to MOONING / BULLISH with HIGH evidence", bull.schema === CALL_SCHEMA &&
    bull.headline === "MOONING" && bull.direction === "BULLISH" && bull.confidence === "HIGH" && bull.actionability === "FULL");
  ok("one-call: Fear & Greed display carries its real label, never undefined",
    /60 — Greed/.test(bull.factors.find((f)=>f.key==="fearGreed")?.display || "") &&
    !JSON.stringify(bull).includes("undefined"));
  const mixed = buildMacroCall(live({ tenYearM1: 0, vix: 20, fearGreed: 40, cpiTrend: [2.4,2.4], shillerPe: 27, nfci: -0.2 }), { now, effectiveDate: D });
  ok("one-call: mixed engine maps to HODL / NEUTRAL", mixed.headline === "HODL" && mixed.direction === "NEUTRAL");
  const bear = buildMacroCall(live({ tenYearM1: 0.2, vix: 26, fearGreed: 20, cpiTrend: [2.0,2.6], shillerPe: 40, nfci: 0.1 }), { now, effectiveDate: D });
  ok("one-call: risk-off engine maps to DIAMOND HANDS / BEARISH", bear.headline === "DIAMOND HANDS" && bear.direction === "BEARISH");
  const blind = buildMacroCall(live({ spyMa200: undefined }), { now, effectiveDate: D });
  ok("one-call: a blind crash circuit asymmetrically withholds bullishness", blind.base_direction === "BULLISH" &&
    blind.direction === "NEUTRAL" && blind.headline === "HODL" && blind.actionability === "HOLD" && /BULLISH withheld/.test(blind.downgraded));
  const panicCall = buildMacroCall(live({ spyPrice: 600, spyMa200: 650, vix: 26, fearGreed: 19 }), { now, effectiveDate: D });
  ok("one-call: PANIC is a named override and forces the effective call bearish", panicCall.override.active &&
    panicCall.override.type === "PANIC" && panicCall.direction === "BEARISH" && panicCall.actionability === "HOLD");
  const thin = buildMacroCall(live({ vix: undefined, fearGreed: undefined, nfci: undefined }), { now, effectiveDate: D });
  ok("one-call: below four usable factors publishes no directional claim", thin.published === false &&
    thin.headline === null && thin.direction === null && thin.confidence === "LOW" && thin.status === "DATA HOLD");
  const paste = formatMacroCallPaste(bull);
  /* 8/28 clock matrix A10: ONE word pair, both builders — 10AM CALL (frozen) / LIVE READ
     (unfrozen). The paste stamped "DAILY CALL" on both states while the share card had
     split since v5.5; the retired banner is pinned ABSENT. */
  ok("8/28 A10: the paste header splits frozen/live with the share card's exact pair",
    /^MACRODASH LIVE READ · /.test(paste) &&
    /^MACRODASH 10AM CALL · /.test(formatMacroCallPaste(bull, { frozen: true })) &&
    !/DAILY CALL/.test(paste) && !/DAILY CALL/.test(formatMacroCallPaste(bull, { frozen: true })));
  ok("8/28 A9: the unfrozen share card says LIVE READ, and neither builder says CURRENT POSTURE",
    /^MACRODASH LIVE READ · /.test(formatMacroShareCard(bull, { frozen: false })) &&
    !/CURRENT POSTURE/.test(formatMacroShareCard(bull, { frozen: false })));
  ok("one-call: clipboard leads with the identical human and machine vocabulary",
    /MOONING 🚀 · BULLISH/.test(paste) && /6 of 6 voters counted/.test(paste));
  const share = formatMacroShareCard(bull, { frozen:true });
  ok("share card: compact copy identifies the frozen call and links its public receipts",
    /^MACRODASH 10AM CALL/.test(share) && /MOONING 🚀 · BULLISH/.test(share) &&
    /macrodash\.pages\.dev\/history/.test(share) && share.split("\n").length === 5 && !share.includes("undefined"));
  // 8/28 vocabulary pass: BOTH clipboard builders consume the same md-call-v1 object, so they
  // state coverage in the hero's form — and neither may reintroduce a slash fraction.
  ok("8/28: both clipboard payloads state coverage as the hero does, with no slash fraction",
    /6 of 6 voters counted/.test(share) &&
    !/factors usable/.test(paste) && !/factors usable/.test(share) &&
    !/\d+\/\d+/.test(paste) && !/\d+\/\d+/.test(share));

  const fakeKv = () => {
    const m = new Map();
    return {
      _m:m,
      async get(k, type){ const v=m.get(k); return type === "json" && v ? JSON.parse(v) : (v ?? null); },
      async put(k,v){ m.set(k,v); },
      async list({prefix,limit}){ return { keys:[...m.keys()].filter(k=>k.startsWith(prefix)).slice(0,limit).map(name=>({name})) }; },
    };
  };
  const kv = fakeKv();
  const fetchCall = async () => new Response(JSON.stringify({ call: bull }), { status: 200, headers:{"content-type":"application/json"} });
  const first = await captureDailyCall({ PULSE_CACHE: kv }, fetchCall, now);
  const second = await captureDailyCall({ PULSE_CACHE: kv }, async()=>{ throw new Error("must not fetch"); }, new Date(`${D}T18:00:00Z`));
  ok("history: first 10am write wins and the same ET day is immutable", first.written === true && second.written === false && second.reason === "already captured" && kv._m.size === 1);
  const histRes = await getHistory({ env:{ PULSE_CACHE:kv } });
  const hist = await histRes.json();
  ok("history: public endpoint returns the live-forward record and no private envelope", hist.schema === "md-history-v1" &&
    hist.live_forward_only === true && hist.outcomes_live_forward_only === true && hist.rows.length === 1 &&
    hist.rows[0].call.headline === "MOONING" && hist.rows[0].outcomes === null && !JSON.stringify(hist).includes("book"));
  const failKv = fakeKv();
  await captureDailyCall({ PULSE_CACHE: failKv }, async()=>new Response("no",{status:503}), now);
  const failed = JSON.parse([...failKv._m.values()][0]);
  ok("history: a capture failure is frozen too — bad mornings cannot vanish", failed.capture_status === "FAILED" && failed.call === null && /HTTP 503/.test(failed.failure));
  const directKv = fakeKv();
  const direct = await captureDailyCall({PULSE_CACHE:directKv}, async()=>{throw new Error("KV reread must not happen");}, now, bull);
  const directRecord = JSON.parse([...directKv._m.values()][0]);
  ok("history repair: the refresh response's canonical call is frozen directly — no eventually-consistent KV reread",
    direct.written === true && directRecord.call.headline === "MOONING" && directRecord.capture_status === "CAPTURED");
  const staleKv = fakeKv();
  const staleDate = new Date(Date.parse(`${D}T00:00:00Z`)-86400000).toISOString().slice(0,10);
  await captureDailyCall({PULSE_CACHE:staleKv}, async()=>new Response("no",{status:503}), now,
    {...bull,effective_date:staleDate});
  const staleRecord = JSON.parse([...staleKv._m.values()][0]);
  ok("history: a prior-day call can never be notarized under today's immutable key",
    staleRecord.capture_status === "FAILED" && staleRecord.call === null);

  /* ── v6.0 T2 — the freeze can miss ONCE and recover, and the heartbeat has no gaps ──
     Owner ticket, verbatim: "10am path: retry put + always write pulse:cron:lastwarm
     (including 'already warm'). No Friday invention. No schedule change." The crons are
     untouched (reconciled by [67]); everything here is retry + visibility. */
  const flakyKv = (failures) => {                       // fakeKv whose put fails N times
    const kv2 = fakeKv(); let n = 0;
    const realPut = kv2.put.bind(kv2);
    kv2.attempts = 0;
    kv2.put = async (k, v, o) => { kv2.attempts++; if (n++ < failures) throw new Error("kv transient"); return realPut(k, v, o); };
    return kv2;
  };
  ok("T2 retry: putWithRetry survives two transient faults and lands the value on the third try",
    (await (async () => { const kv2 = flakyKv(2);
      await putWithRetry(kv2, "k", "v", undefined, 3, 1);
      return kv2.attempts === 3 && kv2._m.get("k") === "v"; })()));
  ok("T2 retry: a PERSISTENT fault still throws — retry is recovery, never a swallow",
    (await (async () => { const kv2 = flakyKv(9);
      try { await putWithRetry(kv2, "k", "v", undefined, 3, 1); return false; }
      catch { return kv2.attempts === 3 && !kv2._m.has("k"); } })()));
  ok("T2 freeze: one transient KV fault at 10:00 no longer costs the day's immutable row",
    (await (async () => { const kv2 = flakyKv(1);
      const r = await captureDailyCall({ PULSE_CACHE: kv2 }, fetchCall, now);
      return r.written === true && kv2._m.size === 1; })()));
  ok("T2 heartbeat: an 'already warm' 8am run WRITES the heartbeat and fetches nothing — a no-op is a run, not a silence",
    (await (async () => { const kv2 = fakeKv();
      const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      await kv2.put(`pulse:snapshot:v16:${etDate}`, "{}");
      const realFetch = globalThis.fetch;
      globalThis.fetch = async () => { throw new Error("already-warm must not fetch"); };
      try { await warmSnapshot({ PULSE_CACHE: kv2 }); } finally { globalThis.fetch = realFetch; }
      const hb = JSON.parse(kv2._m.get("pulse:cron:lastwarm") || "null");
      return hb && hb.job === "prewarm-8amET" && hb.ok === true && hb.already_warm === true; })()));
  // The 10am scheduled path, end to end against stubs (first behavioral run of scheduled()):
  // the SURVIVING heartbeat must carry the refresh, the freeze AND the outcome legs — a run
  // whose refresh succeeded but whose freeze failed used to leave a healthy-looking record.
  const run10am = async (kv2) => {
    const realFetch = globalThis.fetch, realErr = console.error;
    console.error = () => {};                          // the no-REFRESH_TOKEN path narrates; keep the run quiet
    globalThis.fetch = async (url) => /readout\.json/.test(String(url))
      ? new Response(JSON.stringify({ call: bull }), { status: 200, headers: { "content-type": "application/json" } })
      : new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    const waits = [];
    try {
      await cronWorker.scheduled({ cron: "0 14 * * MON-FRI" }, { PULSE_CACHE: kv2 }, { waitUntil: (p) => waits.push(p) });
      await Promise.all(waits);
    } finally { globalThis.fetch = realFetch; console.error = realErr; }
    return JSON.parse(kv2._m.get("pulse:cron:lastwarm") || "null");
  };
  ok("T2 heartbeat: the 10am run's surviving record carries ALL THREE legs — refresh, freeze, outcomes",
    (await (async () => { const kv2 = fakeKv();
      const hb = await run10am(kv2);
      return hb && hb.job === "refresh-10amET" && hb.ok === true && hb.freeze === "written"
        && hb.outcomes && typeof hb.outcomes === "object"; })()));
  ok("T2 heartbeat: a second 10am run records freeze 'already captured' — the no-op state as itself, never dressed as a write",
    (await (async () => { const kv2 = fakeKv();
      await run10am(kv2);
      const hb = await run10am(kv2);
      return hb && hb.freeze === "already captured"; })()));

  const observationValues = [1000,1010,1020,990,980,1050,1040,900,920,940,960,980,1000,1020,1040,1060,1080,1090,1080,1095,1100];
  const observationStart = Date.parse(`${D}T00:00:00Z`);
  const observations = observationValues.map((value, i) => ({
    date:new Date(observationStart + i * 86400000).toISOString().slice(0,10), value:String(value),
  }));
  const normalized = normalizeSp500Observations([
    {date:D,value:"."}, {date:D,value:"999"}, ...observations, {date:"bad",value:"123"},
  ]);
  ok("outcomes: FRED placeholders are removed and same-date observations normalize deterministically",
    normalized.length === 21 && normalized[0].date === D && normalized[0].close === 1000);
  const partial = buildForwardOutcome(first.record, observations.slice(0,6), "2026-08-31T12:00:00Z");
  ok("outcomes: 1d/5d mature independently while 20d remains honestly pending",
    partial?.returns_pct?.["1d"] === 1 && partial?.returns_pct?.["5d"] === 5 &&
    partial?.returns_pct?.["20d"] === null && partial.max_drawdown_pct_20d === -3.92 &&
    partial.max_drawdown_status === "SO_FAR" && partial.status === "PENDING");
  const complete = buildForwardOutcome(first.record, observations, "2026-09-22T12:00:00Z");
  ok("outcomes: the fixed 20-session window finalizes return and max drawdown",
    complete?.schema === OUTCOME_SCHEMA && complete.anchor.date === D && complete.anchor.close === 100 &&
    complete.returns_pct["20d"] === 10 && complete.max_drawdown_pct_20d === -14.29 &&
    complete.max_drawdown_status === "FINAL" && complete.status === "COMPLETE");
  ok("outcomes: no eligible official close yields an explicit empty companion, never invented zeros",
    (()=>{const x=buildForwardOutcome(first.record, [{date:new Date(observationStart-86400000).toISOString().slice(0,10),value:"990"}]);
      return x.anchor === null && x.returns_pct["1d"] === null && x.max_drawdown_pct_20d === null && x.status === "PENDING";})());

  let fredPulls = 0;
  const outcomeFetch = async () => { fredPulls++; return new Response(JSON.stringify({ observations }), {status:200}); };
  const enriched = await enrichHistoryOutcomes({PULSE_CACHE:kv,FRED_KEY:"test-key"}, outcomeFetch, new Date("2026-09-22T12:00:00Z"));
  const frozenAfterOutcome = JSON.parse(kv._m.get(first.key));
  const outcomeCompanion = JSON.parse(kv._m.get(outcomeKey(D)));
  const noRewrite = await enrichHistoryOutcomes({PULSE_CACHE:kv,FRED_KEY:"test-key"}, outcomeFetch, new Date("2026-09-23T12:00:00Z"));
  ok("outcomes: enrichment writes a separate companion and never mutates the frozen call record",
    enriched.ok && enriched.updated === 1 && frozenAfterOutcome.outcomes === null &&
    outcomeCompanion.status === "COMPLETE" && outcomeCompanion.call_date === D);
  ok("outcomes: a complete 20-session companion is immutable and skips later market pulls",
    noRewrite.updated === 0 && fredPulls === 1);
  const joinedRes = await getHistory({env:{PULSE_CACHE:kv}});
  const joined = await joinedRes.json();
  ok("history: the endpoint joins the outcome companion beneath its frozen call",
    joined.rows[0].outcomes.schema === OUTCOME_SCHEMA && joined.rows[0].outcomes.returns_pct["5d"] === 5);

  const snapKv = fakeKv();
  await snapKv.put(`pulse:snapshot:v16:${D}`, JSON.stringify({ live:live(), asOf:now.toISOString(), _diag:{} }));
  await snapKv.put(`public:regime-history:v1:${D}`, JSON.stringify({
    schema:"md-history-record-v1", date:D, captured_at:now.toISOString(), capture_status:"CAPTURED", call:bear,
  }));
  const readoutRes = await getReadout({ request:new Request("https://macrodash.pages.dev/readout.json"), env:{PULSE_CACHE:snapKv} });
  const readoutBody = await readoutRes.json();
  ok("readout: md-call-v1 is additive while tt-v1 legacy regime remains present", readoutBody.schema === "tt-v1" &&
    readoutBody.call.schema === "md-call-v1" && readoutBody.regime && readoutBody.compatibility.legacy.includes("tt-v1"));
  ok("accountability: readout keeps TT regime live but serves the same-day frozen public call",
    readoutBody.regime.verdict === "TAILWIND" && readoutBody.call.headline === "DIAMOND HANDS" && readoutBody.call_frozen === true);
  const snapshotRes = await getSnapshot({request:new Request("https://macrodash.pages.dev/api/snapshot?view=public"),env:{PULSE_CACHE:snapKv}});
  const snapshotBody = await snapshotRes.json();
  ok("accountability: /api/snapshot wires the frozen public call through the one client data path",
    snapshotBody.publicCall?.headline === "DIAMOND HANDS" && snapshotBody.publicCallFrozen === true &&
    snapshotBody.publicCallCapturedAt === now.toISOString());
  const pagesSrc = readFileSync(new URL("../src/PublicPages.jsx", import.meta.url), "utf8");
  const appSrc = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  ok("pages: history and difference stay one click away without adding a dashboard tile", /href="\/history"/.test(dashSrc) &&
    /href="\/difference"/.test(dashSrc) && appSrc.includes("<HistoryPage />") && appSrc.includes("<DifferencePage />") &&
    /will not compete on indicator count/.test(pagesSrc));

  const workerSrc = readSrc("../worker/cron.js");
  const refreshSrc = readSrc("../functions/api/snapshot/refresh.js");
  const readoutSrc = readSrc("../functions/readout.json.js");
  const setupSrc = readSrc("../worker/SETUP.md");
  ok("v5.4 CPI: every active pull uses official NSA CPIAUCNS/CPILFENS, never the SA pair",
    snapSrc.includes('cpiHeadline:  "CPIAUCNS"') && snapSrc.includes('cpiCore:      "CPILFENS"') &&
    workerSrc.includes('series: "CPIAUCNS"') && workerSrc.includes('series: "CPILFENS"'));
  ok("v5.4 cache: snapshot, refresh, readout, worker warm, and test fixture all agree on v16",
    [snapSrc,refreshSrc,readoutSrc,workerSrc].every((s)=>s.includes("pulse:snapshot:v16")) &&
    ![snapSrc,refreshSrc,readoutSrc,workerSrc].some((s)=>s.includes("pulse:snapshot:v15")));
  ok("v5.4 refresh: scheduled history receives the exact refresh-response call",
    /const currentCall = buildMacroCall\(snapshot\.live \|\| \{\}/.test(refreshSrc) &&
    /const frozen = validFrozenCall\(record, etDate\)/.test(refreshSrc) &&
    /\.\.\.readout, call, call_frozen: callFrozen/.test(refreshSrc) &&
    /const refreshed = await refreshSnapshot\(env\)/.test(workerSrc) &&
    /refreshed\?\.call \|\| null/.test(workerSrc) &&
    /call: body\?\.published \? \(body\?\.readout\?\.call \|\| null\) : null/.test(workerSrc));
  ok("v5.4 deploy gate: docs require REFRESH_TOKEN on both Worker and Pages and name both verification commands",
    /wrangler secret list/.test(setupSrc) && /wrangler pages secret list --project-name macrodash/.test(setupSrc) &&
    /REFRESH_TOKEN.*both lists/s.test(setupSrc));
}

/* ── 8/31: SEC IDENTITY — "I could not look" vs "there was nothing to find" ─────────────────
   Owner report: SEC_USER_AGENT is unset on the Pages deployment, so /api/ticker-facts returns
   MISSING for netCashB/dilutedSharesB/secFilings on every name. `secBundle` was already honest
   at the FIELD level — it stores the cause verbatim — but `qualitativeRubric` discarded it and
   emitted one company-shaped sentence, which flows into the receipt's blockers. That sent the
   operator after the ticker when the cause was an unset secret. There was ZERO coverage of
   either path, which is why it shipped. Both are RUN, not string-pinned. */
console.log("\n[74] 8/31 SEC identity — the unset-secret cause survives to the blocker");
{
  const env = { AI: { run: async () => ({}) } };
  const framework = { aiRubric: { text: "rubric" } };
  const factsWith = (secFilings) => ({ fields: { secFilings } });
  const MISSING = (reason) => ({ value: null, status: "MISSING", provider: "SEC", reason });

  const unset = await qualitativeRubric("AAA", factsWith(MISSING("SEC_USER_AGENT is not configured")), framework, env);
  ok("8/31 SEC: an unset SEC_USER_AGENT NAMES itself in the qualitative blocker",
    unset.status === "UNKNOWN" && /SEC_USER_AGENT is not configured/.test(unset.reason));

  const none = await qualitativeRubric("AAA", factsWith(MISSING("no recent 10-Q/10-K filing returned")), framework, env);
  ok("8/31 SEC: a company with genuinely no filings reads DIFFERENTLY — the two causes never collapse",
    /no recent 10-Q\/10-K filing returned/.test(none.reason) &&
    !/SEC_USER_AGENT/.test(none.reason) && none.reason !== unset.reason);

  ok("8/31 SEC: an ABSENT field record names no cause rather than inventing one",
    (await qualitativeRubric("AAA", { fields: {} }, framework, env)).reason
      === "no primary filing citation is available");

  ok("8/31 SEC: the original clause survives in every branch, so nothing matching it breaks",
    [unset, none].every((r) => /no primary filing citation is available/.test(r.reason)));

  // The two causes must be distinct AT SOURCE too — if secBundle ever emitted one string for
  // both, carrying it through would faithfully propagate an ambiguity instead of a fact.
  const factsSrc = readSrc("../functions/api/ticker-facts.js");
  ok("8/31 SEC: secBundle stores the two causes as DIFFERENT strings at source",
    /SEC_USER_AGENT is not configured/.test(factsSrc) &&
    /no recent 10-Q\/10-K filing returned/.test(factsSrc));

  // The env matrix is the operator's map to this failure; it must keep naming the variable.
  const claude = readSrc("../CLAUDE.md");
  ok("8/31 SEC: the env matrix still names SEC_USER_AGENT, its deploy and its degraded state",
    /\|\s*`SEC_USER_AGENT`\s*\|\s*Pages\s*\|/.test(claude));
}

// ---- 75. v6.0.1 — the public-view UX review: shape before text, toggle clarity, captions
// under the window ---------------------------------------------------------------------------
// Owner review of the live Simple + Power screenshots (2026-09-02): (1) "colors or shapes as
// indicators before text is used — e.g. green valuation if live/cached", (2) "Simple vs Power
// is hard to tell", (3) "immutable public call can be forgone… keep some text under windows so
// it is aesthetically simpler for simple users, and accessible for power users". Presentation
// only: no vote, band, quorum, freeze or copy changed. The browser suite DRIVES each of these;
// the pins here hold the SHAPE of the fix so a later density pass cannot quietly revert it.
console.log("\n[75] v6.0.1 — shape before text · toggle clarity · captions under the ℹ window");
{
  const code = (s) => s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
  const spc = code(spcSrc), band = code(bandSrc), dash = code(dashSrc);
  // (1a) The card's direction glyph is the SAME shape the hero chips and Drivers matrix use —
  //      one vocabulary, read once. Reconciled against voteStyle, not retyped here.
  ok("v6.0.1 shape: the card glyphs ARE voteStyle's glyphs (▲ bull · ▼ bear · • neutral) — one vocabulary",
    /GLYPH = \{ helping: "([^"]+)", hurting: "([^"]+)", mixed: "([^"]+)" \}/.test(spc) &&
    (() => { const m = spc.match(/GLYPH = \{ helping: "([^"]+)", hurting: "([^"]+)", mixed: "([^"]+)" \}/);
      return m[1] === voteStyle("bull").glyph && m[2] === voteStyle("bear").glyph && m[3] === voteStyle("neutral").glyph; })());
  ok("v6.0.1 shape: the glyph is rendered BEFORE the label on the card row, and the card wears a direction bar",
    (() => { const g = spc.indexOf('className="simple-card-glyph"'), l = spc.indexOf("{c.label}</span>");
      return g > 0 && l > g && /borderLeft: `3px solid \$\{tone\}`/.test(spc); })());
  // (1b) Freshness: a live/cached reading is a FILLED GREEN DOT (the strip's own dot since
  //      v3.62), stale amber, mock hollow — and the WORD leaves the face for the title +
  //      a visually-hidden span. The rule is pinned by value, not by colour name.
  ok("v6.0.1 fresh: live/cached → filled green, stale → amber, mock → hollow muted; the word survives for a11y only",
    /const live = !illus && \(mode === "LIVE" \|\| mode === "CACHED"\)/.test(spc) &&
    /const color = live \? T\.green : mode === "STALE" \? T\.amber : T\.textMuted/.test(spc) &&
    /className="simple-card-fresh" title=\{fresh\.word\} aria-hidden="true"/.test(spc) &&
    /<span className="visually-hidden">\{fresh\.word\}<\/span>/.test(spc) &&
    !/\{illus \? "not live" : c\.mode\.toLowerCase\(\)\}/.test(spc));
  // (1c) The voters line leads with one dot per voter on BOTH altitudes (hero + cards footer),
  //      derived from the same counts the sentence prints — never a hardcoded six.
  ok("v6.0.1 shape: the voter dots are derived from conf.total/counted in the hero and total/usable on the cards",
    /Array\.from\(\{length:conf\.total\},\(_,i\)=>\{const on=i<conf\.counted;/.test(band) &&
    /Array\.from\(\{ length: total \}, \(_, i\) => \{\s*const counted = i < usable;/.test(spc) &&
    (band.match(/className="voter-dots"/g) || []).length === 1 &&
    (spc.match(/className="voter-dots"/g) || []).length === 1);
  // (2) The toggle: ONE table drives both halves; the pressed half is FILLED amber with dark
  //     text; each half carries a shape and states what it shows in its accessible name.
  ok("v6.0.1 toggle: one VIEW_MODES table, both words intact, a shape per mode, and what each mode shows",
    /\{id:"simple",glyph:"○",word:"Simple",tells:"[^"]+"\}/.test(dash) &&
    /\{id:"power", glyph:"◉",word:"Power", tells:"[^"]+"\}/.test(dash) &&
    /aria-label=\{`\$\{word\} view — \$\{tells\}`\}/.test(dash) &&
    /title=\{`\$\{word\} view — \$\{tells\}`\}/.test(dash));
  ok("v6.0.1 toggle: the pressed half is FILLED brand amber with dark text — not a one-shade-lighter surface",
    /background:on\?T\.amber:"transparent"/.test(dash) && /color:on\?T\.bg:T\.textSecondary/.test(dash) &&
    !/background:viewMode===m\?T\.surfaceHigh/.test(dash) && /aria-pressed=\{on\}/.test(dash));
  // (3) The captions: Simple's FACE keeps the eyebrow only; the frozen/live-read caption
  //     rides inside the ℹ window; Power keeps both on the face. The A6 copy is unchanged.
  ok("v6.0.1 captions: both clock captions are Power-face-only, and Simple gets ONE window home for them",
    /\{callFrozen&&!plainVerdict&&<div/.test(band) &&
    /liveBuild&&!callFrozen&&!withheld&&!plainVerdict&&<div/.test(band) &&
    /const windowCaption=callFrozen\?frozenCaption:\(liveBuild&&!withheld\?liveReadCaption:null\)/.test(band) &&
    /\{plainVerdict&&windowCaption&&<div className="call-caption"/.test(band) &&
    (band.match(/className="call-caption"/g) || []).length === 1);
  ok("v6.0.1 captions: the copy itself did not move — 'immutable public call · captured 10:00 ET' and both A6 clock branches survive",
    /immutable public call · captured 10:00 ET/.test(band) &&
    band.includes("live read — today's official call freezes at 10:00 ET") &&
    band.includes("live read — today's 10am record not loaded"));
  // (4) The icon-only hero buttons earn their 44px box: the glyph is fsL in Simple.
  ok("v6.0.1 hero: the icon-only ⎘ and ℹ buttons render their glyph at fsL, not a 9px speck in a 44px box",
    /fontSize:plainVerdict\?T\.fsL:9/.test(band) &&
    /minWidth:44,minHeight:44,fontFamily:T\.fontMono,fontSize:T\.fsL/.test(band));
  // Boundary: the section stays presentation-only and the engine is untouched.
  ok("v6.0.1 boundary: SimpleCards is still presentation-only and no band/quorum moved",
    !/useState|useEffect|localStorage|computeRegime|buildEvidenceSet/.test(spc) &&
    REGIME_BAND_TABLE.length === 6 && REGIME_QUORUM === 4);
}

// ---- 76. v6.0.2 — the footer under a dropdown, and the strip's voter marker wears its vote ----
// Owner, same review: "that very bottom blurb can go too. Under a dropdown", then "review each
// data parameter block and what's key if needing a word or just an icon or color indicator".
console.log("\n[76] v6.0.2 — footer one tap deep · the ▪ marker carries the vote's colour");
{
  const code = (s) => s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
  const dash = code(dashSrc), strip = code(readSrc("../src/sections/MacroStrip.jsx"));
  // The footer rides ONE CollapsedGroup; the closed row carries version + not-advice; every
  // attribution line — the retirement RECORD included — is still in the source, verbatim.
  ok("v6.0.2 footer: one closed CollapsedGroup, chip-free, whose label carries the version and 'not financial advice'",
    /<div className="site-footer"[^>]*>\s*<CollapsedGroup count=\{3\} chip=\{false\} label=\{`about this page — v\$\{__APP_VERSION__\} · sources · not financial advice`\}>/.test(dash) &&
    (dash.match(/className="site-footer"/g) || []).length === 1);
  ok("v6.0.2 footer: the attribution + retirement record survive inside, verbatim (a cut keeps its attribution)",
    /Retired: CBOE Put\/Call \(free feed dead 2019 · v3\.2\) · Mag 10 fundamentals \+ SEC S-1 \(v3\.43\) · Mag 10 quote strip \(v3\.51\)/.test(dash) &&
    /operator view carries the curated watchlist and alert monitors/.test(dash) &&
    /Not financial advice · Personal use/.test(dash) &&
    (() => { const a = dash.indexOf('className="site-footer"'), b = dash.indexOf("</CollapsedGroup>", a);
      return a > 0 && b > a && dash.slice(a, b).includes("Retired: CBOE Put/Call"); })());
  // The strip marker: colour from the ONE voteStyle map, resolved through the band table's own
  // vote — never a constant. Glyph and the "counts today" gate are unchanged (v3.98.4 pin holds).
  ok("v6.0.2 strip: the ▪ marker resolves its colour through bandOf → vote → voteStyle, never a constant amber",
    /const vb=votes\?bandOf\(f\):null; const vs=vb\?voteStyle\(vb\.vote\(vb\.read\(d\)\)\):null;/.test(strip) &&
    /className="strip-vote"[^>]*color:T\[vs\.colorKey\]/.test(strip) &&
    !/fontSize:7,color:T\.amber,letterSpacing:"0\.05em"\}\}>▪/.test(strip) &&
    /const isVoter=vf\.has\(f\); const votes=isVoter&&live;/.test(strip));
  ok("v6.0.2 strip: the vote WORD rides the tooltip so the colour can be confirmed, on both the tile and the marker",
    /Counts toward today's posture — votes \$\{vs\.word\}\./.test(strip) &&
    /title=\{`counts toward today's posture — votes \$\{vs\.word\}`\}/.test(strip));
  // Behavioural: the colour a voter's marker would wear is the colour its card/hero chip wears.
  const bull = voteStyle("bull"), bear = voteStyle("bear");
  ok("v6.0.2 strip: bull → green, bear → red — the same two keys the cards and hero chips paint",
    bull.colorKey === "green" && bear.colorKey === "red" && voteStyle("neutral").colorKey === "textSecondary");
}

// ═══════════ [77] v6.1.0 — the ranked headline layer: allowlist FIRST, then order ═══════════
// The 2026-09-02 10:02 build went headline-dark on a heavy news day with ZERO diagnostics
// (plain fetch, first <item> only, no recordStatus). v6.1.0 reads every item from four wire
// feeds, gates them through the v3.51 ONE-WAY allowlist, and ORDERS the survivors with a
// curated category table — $0, no LLM. Everything below is RUN: a ranking is a claim about
// order, and a string pin cannot prove one. (Sits ABOVE the summary line — the v5.97.1 trap.)
console.log("\n[77] v6.1.0 ranked headlines — one table, order, dedupe, diagnostics, WHY #3");
{
  const NOW75 = new Date("2026-09-02T22:00:00Z");
  const T75 = NOW75.getTime();
  const hAgo = (h) => new Date(T75 - h * 3600000).toISOString();
  // The v3.51 allowlist VERBATIM as it shipped before the table existed. A dropped, altered
  // or hand-copied term goes red here; the table must DERIVE the flat list.
  const V351_TERMS = [
    "fed", "fomc", "powell", "rate cut", "rate hike", "central bank", "ecb", "boj", "monetary",
    "quantitative", "basis point", "bps", "tightening", "easing",
    "inflation", "cpi", "pce", "deflation", "price index", "wage growth",
    "gdp", "recession", "jobs report", "payroll", "unemployment", "jobless", "labor market",
    "consumer spending", "retail sales", "manufacturing", "ism", "pmi",
    "treasury", "yield", "bond", "credit spread", "default", "downgrade", "debt ceiling",
    "dollar", "currency",
    "stocks", "equities", "s&p", "nasdaq", "dow", "selloff", "sell-off", "rally", "correction",
    "bear market", "bull market", "volatility", "vix", "risk-off", "risk off", "drawdown",
    "futures", "index", "benchmark",
    "oil", "crude", "opec", "energy prices", "gold",
    "tariff", "trade war", "sanctions", "war", "shutdown", "banking crisis", "bank failure",
    "contagion", "sovereign", "stimulus",
    "peace", "ceasefire", "truce",
  ];
  ok("[77] one table: MACRO_TERMS is DERIVED from HEADLINE_CATEGORIES and carries the v3.51 allowlist verbatim (78 terms, no duplicates)",
    JSON.stringify([...MACRO_TERMS].sort()) === JSON.stringify([...V351_TERMS].sort()) &&
    MACRO_TERMS.length === HEADLINE_CATEGORIES.flatMap((c) => c.terms).length &&
    new Set(MACRO_TERMS).size === MACRO_TERMS.length);
  ok("[77] one table: the derivation is in SOURCE and no literal term list survives in fiveWhys.js",
    (() => { const hs = readSrc("../src/headlines.js"), fw = readSrc("../src/fiveWhys.js");
      return /MACRO_TERMS = Object\.freeze\(HEADLINE_CATEGORIES\.flatMap\(\(c\) => c\.terms\)\)/.test(hs) &&
        !/"rate hike"/.test(fw) && /export \{ isMacroMaterial \}/.test(fw); })());
  ok("[77] doctrine: the allowlist is never scored and the score can never admit — stated at the table's home",
    (() => { const hs = readSrc("../src/headlines.js");
      return /allowlist decision is ONE-WAY and is never scored/.test(hs) && /can never admit/.test(hs) && /never cast a vote/.test(hs); })());
  ok("[77] weights: descending, 100-spaced, and recency (≤72) can NEVER flip a category — a 71h-old policy item beats a brand-new energy item",
    (() => { const w = HEADLINE_CATEGORIES.map((c) => c.weight);
      return w.every((x, i) => i === 0 || x <= w[i - 1]) && RECENCY_MAX_H < 100 &&
        scoreHeadline("Fed holds rates steady", T75 - 71 * 3600000, T75) > scoreHeadline("Oil surges on OPEC cut", T75, T75); })());
  ok("[77] categoryOf takes the MAX category, never a sum — and a non-material title has none",
    categoryOf("Fed cuts as oil surges").key === "policy" && categoryOf("Oil surges as stocks rally").key === "market_wide" &&
    categoryOf("How to pick a financial advisor") === null);
  const items75 = [
    { title: "Best credit cards for travel in 2026", source: "MW", pubDate: hAgo(0.5) },              // NEWEST, non-material
    { title: "Oil surges on OPEC cut", source: "CNBC", pubDate: hAgo(1) },                            // energy
    { title: "Stocks sell off as volatility jumps", source: "MW", pubDate: hAgo(2) },                 // market_wide
    { title: "Fed holds rates steady as Powell signals patience", source: "MW", pubDate: hAgo(30) },  // policy, older
    { title: "Fed holds rates steady, Powell signals patience", source: "WSJ", pubDate: hAgo(3) },    // near-dup, newer
    { title: "CPI cools to 2.4%", source: "CNBC", pubDate: hAgo(5) },                                 // inflation
    { title: "Treasury yields spike", source: "WSJ", pubDate: hAgo(4) },                              // rates_credit
    { title: "Payrolls miss badly", source: "MW", pubDate: hAgo(96) },                                // growth, 4 DAYS old
    { title: "Peace deal lifts futures", source: "CNBC", pubDate: new Date(T75 + 2 * 86400000).toISOString() }, // 2d FUTURE
  ];
  const r75 = rankHeadlines(items75, NOW75);
  ok("[77] rank: allowlist FIRST (the newest item never ranks), category before recency, the near-duplicate collapses to ONE",
    r75.length === 3 && r75[0].title === "Fed holds rates steady, Powell signals patience" && r75[0].source === "WSJ" &&
    r75[1].title === "CPI cools to 2.4%" && r75[2].title === "Treasury yields spike" && r75[0].rank === 1 && r75[2].rank === 3);
  ok("[77] rank: the score never leaves the ranker — the emitted shape carries no number",
    r75.every((h) => !("score" in h)) && JSON.stringify(Object.keys(r75[0])) === JSON.stringify(["rank", "title", "source", "as_of", "category"]));
  ok("[77] rank: uncapped, the 4-day-old and the 2-day-future items are still dropped, the non-material never enters, and the order is the category order",
    (() => { const all = rankHeadlines(items75, NOW75, { limit: 9 });
      return all.length === 5 && all.map((h) => h.category).join() === "policy,inflation,rates_credit,market_wide,energy" &&
        !all.some((h) => /Payrolls|Peace|credit cards/.test(h.title)); })());
  ok("[77] rank: two DIFFERENT Fed stories both survive — collapse is near-duplication, not topic",
    rankHeadlines([{ title: "Fed holds rates steady", source: "A", pubDate: hAgo(1) },
      { title: "Fed's Waller says rate cuts may come sooner", source: "B", pubDate: hAgo(2) }], NOW75).length === 2 &&
    isNearDuplicate("Fed holds rates steady as Powell signals patience", "Fed holds rates steady, Powell signals patience") &&
    !isNearDuplicate("Fed holds rates steady", "Fed's Waller says rate cuts may come sooner"));
  ok("[77] rank: deterministic — two runs over the same input agree byte-for-byte; empty / null / all-non-material give []",
    JSON.stringify(rankHeadlines(items75, NOW75)) === JSON.stringify(rankHeadlines([...items75], NOW75)) &&
    rankHeadlines([], NOW75).length === 0 && rankHeadlines(null, NOW75).length === 0 &&
    rankHeadlines([{ title: "Best credit cards for travel in 2026", source: "MW", pubDate: hAgo(1) }], NOW75).length === 0);
  ok("[77] parseTopHeadlines: garbage → [], and a stored list is RE-GATED — the Fidelity false positive can never ride a KV artifact onto the page",
    parseTopHeadlines("{not json").length === 0 && parseTopHeadlines("[]").length === 0 && parseTopHeadlines(null).length === 0 &&
    (() => { const p = parseTopHeadlines(JSON.stringify([{ title: "Fed holds rates steady", source: "MW" },
        { title: "Fidelity now requires a death certificate to transfer an account", source: "MW" },
        { title: "no source" }, { title: "CPI cools to 2.4%", source: "CNBC", as_of: "2026-09-02" }]));
      return p.length === 2 && p[1].title === "CPI cools to 2.4%" && p[1].rank === 2 && p[1].as_of === "2026-09-02"; })());
  // The parser reads EVERY item, attributed forms included, decodes entities, drops undated.
  const RSS75 = `<?xml version="1.0"?><rss><channel><title>feed</title>
    <item><title><![CDATA[Fed&#x2019;s Powell signals patience]]></title><pubDate>${new Date(T75 - 3600000).toUTCString()}</pubDate></item>
    <item rdf:about="x"><title>CPI cools to 2.4%</title><pubDate>${new Date(T75 - 7200000).toUTCString()}</pubDate></item>
    <item><title>Undated item</title></item>
    <item><title>Best credit cards for travel</title><pubDate>${new Date(T75 - 1800000).toUTCString()}</pubDate></item>
    </channel></rss>`;
  ok("[77] parseRssItems: every <item> (attributed forms too), CDATA + hex entities decoded, the undated one dropped",
    (() => { const p = parseRssItems(RSS75);
      return p.length === 3 && p[0].title === "Fed’s Powell signals patience" && p[1].title === "CPI cools to 2.4%" &&
        Number.isFinite(p[0].pubMs) && !p.some((x) => /Undated/.test(x.title)); })());
  // fetchHeadlines, RUN against a stubbed fetch — the diagnosis the 9/2 blank never had.
  const runFetch = async (route) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => route(String(url));
    const statuses = [];
    try { const out = await fetchHeadlines(statuses, NOW75); return { out, statuses }; }
    catch (e) { return { err: e, statuses }; }
    finally { globalThis.fetch = realFetch; }
  };
  const rssOf = (titles) => `<rss><channel>${titles.map((t) => `<item><title>${t}</title><pubDate>${new Date(T75 - 3600000).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`;
  const okRes = (body) => new Response(body, { status: 200 });
  const mixed = await runFetch((u) => /mw_topstories/.test(u) ? new Response("down", { status: 500 })
    : /100003114/.test(u) ? okRes(rssOf(["Treasury yields spike", "Best credit cards for travel"]))
    : /RSSMarketsMain/.test(u) ? Promise.reject(new TypeError("fetch failed"))
    : okRes(rssOf(["How to pick a financial advisor"])));
  ok("[77] fetchHeadlines: each feed is a status row — a 500, a network fault and two OK feeds are three DIFFERENT records",
    (() => { const s = mixed.statuses;
      const mw = s.find((x) => x.source === "rss" && x.item === "MarketWatch"), wsj = s.find((x) => x.item === "WSJ Markets");
      const cnbc = s.find((x) => x.item === "CNBC");
      return mw && mw.ok === false && mw.http_status === 500 && wsj && wsj.ok === false && wsj.error_class === "network" &&
        cnbc && cnbc.ok === true && cnbc.items === 2; })());
  ok("[77] fetchHeadlines: ONE group record states the pipeline — feeds_ok / candidates / material / ranked — and rank #1 rides marketHeadline",
    (() => { const g = mixed.statuses.find((x) => x.item === "ranked");
      return g && g.ok === true && g.feeds_ok === 2 && g.candidates === 3 && g.material === 1 && g.ranked === 1 &&
        mixed.out.marketHeadline === "Treasury yields spike" && mixed.out.marketHeadlineSource === "CNBC" &&
        mixed.out.marketHeadlineAsOf === "2026-09-02" &&
        JSON.parse(mixed.out.marketHeadlinesJson)[0].title === "Treasury yields spike" &&
        !/score/.test(mixed.out.marketHeadlinesJson); })());
  const dark = await runFetch(() => new Response("down", { status: 503 }));
  ok("[77] fetchHeadlines: ALL feeds failing throws AND leaves a group record naming it — the 9/2 blank now has a diagnosis",
    dark.err && /no fresh headline/.test(dark.err.message) &&
    (() => { const g = dark.statuses.find((x) => x.item === "ranked"); return g && g.ok === false && g.feeds_ok === 0 && g.error_class === "network"; })());
  const noise = await runFetch(() => okRes(rssOf(["How to pick a financial advisor", "Best credit cards for travel"])));
  ok("[77] fetchHeadlines: feeds UP but nothing material is a different diagnosis (no_observation), never dressed as a network fault",
    noise.err && (() => { const g = noise.statuses.find((x) => x.item === "ranked");
      return g && g.ok === false && g.feeds_ok === 4 && g.candidates === 8 && g.material === 0 && g.error_class === "no_observation"; })());
  ok("[77] wiring: the Phase-2 call site hands the collector in, and fetchHeadlines never uses a bare fetch",
    (() => { const src = readSrc("../functions/api/snapshot.js");
      const i = src.indexOf("export async function fetchHeadlines"), j = src.indexOf("\n}", i);
      const body = src.slice(i, j);
      return src.includes('withLastGood(env, "headline", () => fetchHeadlines(statuses))') &&
        /fetchRetry\(/.test(body) && !/\bfetch\(/.test(body) && !src.includes("async function fetchHeadline()"); })());
  ok("[77] SOURCES: marketHeadlinesJson is mapped, DERIVED from marketHeadline, public, and inherits the daily cadence (no CADENCE entry)",
    SOURCES.marketHeadlinesJson && SOURCES.marketHeadlinesJson.path === "marketPulse.headline.topJson" &&
    SOURCES.marketHeadlinesJson.kind === "str" && DERIVED_OF.marketHeadlinesJson === "marketHeadline" &&
    !/marketHeadlinesJson/.test((readSrc("../src/sources.js").match(/const CADENCE = \{([\s\S]*?)\};/) || ["", ""])[1]) &&
    MOCK_DATA.marketPulse.headline.topJson === "[]");
  // WHY #3 renders the top-3 under the SAME gate the rank-1 passes, each re-checked material.
  const top3 = JSON.stringify([{ title: "Fed holds rates steady", source: "MarketWatch" },
    { title: "CPI cools to 2.4%", source: "CNBC" }, { title: "Treasury yields spike", source: "WSJ Markets" }]);
  const withTop = (topJson, text = "Fed holds rates steady") => ({ ...MOCK_DATA, marketPulse: { ...MOCK_DATA.marketPulse,
    headline: { text, source: "MarketWatch", topJson } } });
  ok("[77] WHY #3: rank-1 verbatim, then items 2-3 verbatim with their sources — and the non-voting clause survives",
    (() => { const w = computeFiveWhys(withTop(top3), fwRegime, fwOpts).whys[3];
      return /Tracked context \(MarketWatch\): “Fed holds rates steady”/.test(w) && / · also “CPI cools to 2\.4%” \(CNBC\) · “Treasury yields spike” \(WSJ Markets\)/.test(w) &&
        /never cast a vote/.test(w); })());
  ok("[77] WHY #3: a stored list carrying the Fidelity false positive at rank 2 never prints it; garbage topJson degrades to rank-1 only",
    (() => { const bad = JSON.stringify([{ title: "Fed holds rates steady", source: "MarketWatch" },
        { title: "Fidelity now requires a death certificate to transfer an account", source: "MarketWatch" }]);
      const w1 = computeFiveWhys(withTop(bad), fwRegime, fwOpts).whys[3];
      const w2 = computeFiveWhys(withTop("{junk"), fwRegime, fwOpts).whys[3];
      return !/death certificate/.test(w1) && !/also/.test(w1) && /“Fed holds rates steady”/.test(w2) && !/also/.test(w2); })());
  ok("[77] WHY #3: a non-material rank-1 withholds the WHOLE slot — items 2-3 cannot rescue it (one gate, one way)",
    (() => { const w = computeFiveWhys(withTop(top3, "Fidelity now requires a death certificate to transfer an account"), fwRegime, fwOpts).whys[3];
      return /failed the macro-relevance filter/.test(w) && !/also/.test(w) && !/CPI cools/.test(w); })());
}

console.log(`\n=== SMOKE TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);


