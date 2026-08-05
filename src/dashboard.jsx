import { useState, useEffect, useCallback } from "react"; // Fragment left with MarketDetail (wave 9)
import { LineChart, Line, BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useMarketData } from "./useMarketData.js"; // FEAT-204 wiring
import { computeFiveWhys } from "./fiveWhys.js"; // v2.5: rule-based 5 Whys ($0, derived from live data)
import { NFCI_TIGHT, NFCI_LOOSE, REGIME_BAND_TABLE, REGIME_QUORUM, verdictFrom, computeRegime, flipConditions, regimeFactors, voteStyle } from "./regime.js"; // C1 (v3.60): the extracted engine; voteStyle = FEAT-NEUTRAL (v3.62)
import { buildEvidenceSet, factorExclusions, fieldMode, FACTOR_FIELD } from "./evidence.js"; // C1 (v3.60): the typed contract
import { LASTVALID_KEY, summarizeEvidence, compareEvidence } from "./whatChanged.js"; // C4 (v3.60)
import { isStale, cadenceOf, parseObsDate, isMarketHoliday } from "./sources.js"; // FEAT-R3: per-tile, cadence-aware staleness + shared market calendar
import { computeMacroFlip, buildTtReadout, formatTtPaste } from "./ttReadout.js"; // FEAT-331/332: Macro Flip + TT paste
import { fmt, pctColor } from "./format.js"; // task 1.3/3.1: one shared copy
import RegimeBand, { WITHHELD_LABEL, WEN_MOON_STATES } from "./sections/RegimeBand.jsx"; // task 1.3: the verdict band + its vocabulary
import FiveWhys from "./sections/FiveWhys.jsx"; // task 1.4: presentation only — computeFiveWhys stays here
import SourceBox, { DataModeBadge } from "./primitives/SourceBox.jsx"; // task 1.4
import SectionHeader from "./primitives/SectionHeader.jsx"; // task 1.4
import CollapsedGroup from "./primitives/CollapsedGroup.jsx"; // task 5.1
import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "./primitives/Illustrative.jsx"; // task 5.1
import { Badge, Label } from "./primitives/atoms.jsx"; // wave 9
import MarketDetail from "./sections/MarketDetail.jsx"; // task 5.2: presentation only
import MacroRegime from "./sections/MacroRegime.jsx"; // task 5.3: presentation only
import Headwinds from "./sections/Headwinds.jsx"; // task 5.4: presentation only
import MacroStrip from "./sections/MacroStrip.jsx"; // task 3.1: presentation only
import SignalQuality from "./sections/SignalQuality.jsx"; // task 3.2: presentation only
import WhatChanged from "./sections/WhatChanged.jsx"; // task 3.3: presentation only

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
// UI-OVERHAUL Slice 1 (task 1.1): tokens live in src/design-tokens.js — the ONE
// home (the old "design-tokens.json canonical" comment named a file that never
// existed in the repo). Deliberate deviation from spec Req 11.4: no inline
// fallback copy is kept — a static-ESM Vite bundle turns a missing module into
// a BUILD failure, not a runtime state, and a byte-copy fallback would be the
// exact second-copy drift defect this repo keeps paying for. The guard below
// covers the only reachable failure (an emptied export) by warning, not lying.
import { DT, T } from "./design-tokens.js";
if (!DT || !Object.keys(DT).length)
  console.warn("design-tokens module could not be resolved — token lookups will render unstyled");

// ─── WEN MOON METER THRESHOLDS (configurable) ─────────────────────────────
// SPY daily change % thresholds for the mood badge on the Macro Strip
const WEN_MOON_UP = 0.5;    // above this → MOONING
const WEN_MOON_DOWN = -0.5; // below this → DIAMOND HANDS


// COST TO ORBIT — $ to put 1 kg into Low Earth Orbit, by era. Curated/Manual: there
// is no free live feed for launch cost, and it changes on the order of years, not days.
// The secular collapse (Shuttle → Falcon 9 reusable → Starship target) is the signal.
// ⚠️ Update `costPerKg` + `series` as new vehicles/prices are confirmed.
const LAUNCH_COST = {
  vehicle: "Falcon 9 reusable",
  costPerKg: 2720,
  prevEra:  { name: "Space Shuttle", costPerKg: 54500 },
  target:   { name: "Starship",      costPerKg: 200 },
  // Era progression, oldest→newest (Shuttle → EELV → Falcon 9 expendable → F9 reusable → trend)
  series: [54500, 18500, 9100, 4700, 2720, 2200],
};

// GPU ON-DEMAND LIST PRICING — leading indicator for the AI margin-compression hinge.
// Curated/Manual, updated QUARTERLY: there is no free live feed for neocloud/hyperscaler
// on-demand $/GPU-hr, and published rates reprice on a quarterly cadence, not daily. This
// is the cleanest EXTERNAL read on AI-infra pricing power — visible before it shows up in
// hyperscaler earnings. Falling $/hr ⇒ eroding pricing power ⇒ margin compression (ties to
// the "AI CapEx ROI Gap" headwind). ⚠️ Update `onDemand`/`prevQ`/`trend` each quarter.
const GPU_PRICING = {
  quarter: "Q2 2026",
  chips: [
    { name: "H200",  onDemand: 3.10, prevQ: 3.40 }, // Hopper refresh — most liquid market
    { name: "B200",  onDemand: 5.40, prevQ: 5.70 }, // Blackwell — repricing as supply lands
    { name: "GB300", onDemand: 7.20, prevQ: 7.20 }, // Grace-Blackwell Ultra — newest, still scarce
  ],
  // Blended on-demand index, oldest→newest (quarterly) — the decline IS the signal.
  trend: [6.80, 6.10, 5.50, 5.20, 5.00, 4.90],
  note: "Falling on-demand $/hr = eroding AI-infra pricing power → the margin-compression hinge, visible before earnings.",
};

// FEAT-CAPEX (v3.45) — hyperscaler capex tape: the FUNDING FLOW leg of AI unit economics.
// GPU $/hr is the supply cost, token $/Mtok the demand price; this is the pipe that pays for
// both. Curated at each print (guidance has no $0 live source); `dir` is the revision
// direction vs the prior guide — the number the market actually trades. ⚠ CURATED — figures
// are placeholders to review at each print; the reviewed date is the honesty stamp.
// FEAT-TOKW (v3.46) — TOKENS/WATT: the CONVERSION leg of AI unit economics.
//
// FIRST PRINCIPLES. Power is the binding CONSTRAINT, not the dominant cost: a ~1kW accelerator
// costing ~$40k burns roughly $1.5k of electricity over three years at industrial rates, so
// depreciation dominates energy ~25:1. Tokens/watt matters because MW ALLOCATIONS are the input
// that cannot be bought on demand — grid interconnect, not capital, gates a neocloud's capacity.
// It is therefore a CAPACITY-PRODUCTIVITY metric: how much sellable output a fixed, hard-to-
// expand power envelope yields.
//
// THE IDENTITY:  revenue per MW  ∝  (tokens per watt) × ($ per token)
// In growth terms the two rates COMPOSE: (1+efficiency%) × (1+price%) − 1. That product is the
// only part of this that is honestly sourceable — the absolute levels are not. Published
// tokens/watt swings 10-50x on model size, batch depth, quantization and GPU-only-vs-PUE, and
// $/Mtok is RETAIL api pricing carrying the model provider's margin, not a neocloud's wholesale
// realization. Both scale factors CANCEL in the ratio, so the index is defensible where a
// dollar figure would be confidently wrong. Hence: stored as a RELATIVE INDEX, and this card is
// forbidden by construction from ever printing a $/MW figure (smoke-pinned).
//
// WHY IT EARNS SCREEN SPACE: utilization underwriting answers "will the capacity sell?" It
// cannot answer "is a sold MW worth less than last year?" A fully-utilized neocloud can still
// see revenue per MW compress — the margin-compression hinge arriving through the physical
// layer rather than the P&L. ⚠ CURATED, relative: review at each chip-generation step.
const TOKEN_EFFICIENCY = {
  basis: "system-level tokens/W, relative index (H100 generation = 1.00)",
  reviewed: "2026-07-30",
  // oldest→newest; `at` dates the generation's volume availability, not its announcement.
  gens: [
    { gen: "H100",  at: "2023-06-30", idx: 1.00 },
    { gen: "H200",  at: "2024-06-30", idx: 1.40 },
    { gen: "B200",  at: "2025-06-30", idx: 3.00 },
    { gen: "GB300", at: "2026-06-30", idx: 4.50 },
  ],
  // THE WINDOW IS NEVER ANNUALISED. The rolling $/Mtok series is ~12 weekly points at most, and
  // raising a 12-week move to the 52/11 power turns a −35% drift into −98.8%/yr — a number that
  // is arithmetically correct and economically absurd, the same units error DEC-D2 removed from
  // sellRank. So the EFFICIENCY CAGR (multi-year, robust) is instead projected DOWN onto the
  // price window's own span, and the scissors is reported over that observed span, stated.
  minWeeks: 8,      // below this the window is noise; the band is withheld, not guessed.
  deadbandPct: 5,   // % move over the OBSERVED window — measurement noise, not an economic line.
  note: "Efficiency vs price: if $/Mtok falls faster than tokens/W improves, revenue per MW compresses EVEN AT FULL UTILIZATION — the neocloud risk utilization alone cannot see.",
};

// Compose the two rates into the scissors. Pure, and deliberately returns NO dollar figure.
// `trend` is the live rolling $/Mtok series (weekly cadence, values only — the emitted field
// drops its dates), so its span is inferred from the point count and STATED on the card.
//
// Returns: effCagr (%/yr, the durable multi-year rate) · effWin/pxWin (both over the SAME
// observed window) · idx (the composite over that window) · weeks · band. Comparing a rate to
// a window move would be the units error; both legs are always in window terms.
function tokenScissors(trend) {
  const g = TOKEN_EFFICIENCY.gens;
  const yrs = (a, b) => (Date.parse(b) - Date.parse(a)) / (365.25 * 86400000);
  const effYrsSpan = yrs(g[0].at, g[g.length - 1].at);
  const effCagr = (effYrsSpan > 0 && g[0].idx > 0 && g[g.length - 1].idx > 0)
    ? Math.pow(g[g.length - 1].idx / g[0].idx, 1 / effYrsSpan) - 1 : null;
  const t = Array.isArray(trend) ? trend.filter(v => Number.isFinite(v) && v > 0) : [];
  // Weekly cadence (CADENCE.tokenTrend), so n points span (n-1) weeks.
  const weeks = t.length >= 2 ? t.length - 1 : null;
  const none = { effCagr, effWin: null, pxWin: null, idx: null, weeks, band: null };
  if (effCagr === null || weeks === null) return none;
  const pxWin = t[t.length - 1] / t[0] - 1;                       // observed, never annualised
  const effWin = Math.pow(1 + effCagr, weeks / 52) - 1;           // CAGR projected onto that span
  const idx = (1 + effWin) * (1 + pxWin) - 1;
  if (weeks < TOKEN_EFFICIENCY.minWeeks) return { ...none, effWin, pxWin, idx, short: true };
  const dbd = TOKEN_EFFICIENCY.deadbandPct / 100;
  return { effCagr, effWin, pxWin, idx, weeks, short: false,
    band: idx > dbd ? "EXPANDING" : idx < -dbd ? "COMPRESSING" : "FLAT" };
}

const HYPERSCALER_CAPEX = {
  fy: "FY26", reviewed: "2026-07-30",
  rows: [
    { co: "MSFT",  guideB: 120, dir: "up"   },
    { co: "AMZN",  guideB: 118, dir: "up"   },
    { co: "GOOGL", guideB: 92,  dir: "up"   },
    { co: "META",  guideB: 70,  dir: "hold" },
  ],
  note: "Big-4 guided capex — the pool that funds every AI-infra beneficiary's revenue. ≥2 guiding down = the regime-turn tell (headwind #1's $705B counts ALL AI capex incl. neoclouds; this tape tracks the four the market prices).",
};

// ELECTRIC SKIES — eVTOL FAA Type Certification tracker (Joby). The "next destination":
// a subset of the IPO launch-stage pattern, but the gate is regulatory, not financial.
// FAA TC is a 5-stage process; the final Type Certificate is the last gate before
// commercial passenger ops. Curated/Manual projection — no live feed, milestones move on
// a multi-quarter cadence. ⚠️ Update `stageIndex`/`progressPct`/`targetTC` as the FAA advances.
const EVTOL_CERT = {
  company: "Joby Aviation", ticker: "JOBY",
  stages: ["Cert Basis", "Cert Plan", "Testing", "For-Credit (TIA)", "Type Cert"], // FAA 5-stage TC
  stageIndex: 3,            // 0-based → Stage 4 of 5 (for-credit / TIA flight testing)
  stageLabel: "For-Credit Testing (TIA)",
  progressPct: 78,          // approx through the area-specific certification plans
  targetTC: "H2 2026",      // projected FAA Type Certificate (curated estimate)
  note: "FAA Type Certification — final regulatory gate before commercial eVTOL passenger ops.",
};

// ─── SOURCE BOX — extracted to src/primitives/SourceBox.jsx (task 1.4) ───────

// ─── ILLUSTRATIVE TREATMENT + COLLAPSED GROUP — extracted to src/primitives/
// (Illustrative.jsx + CollapsedGroup.jsx, task 5.1). One idiom, one home each.

// ─── DATA ─────────────────────────────────────────────────────────────────
const MOCK_DATA = {
  lastRefresh:"2026-05-23 16:15 ET", session:"CLOSE",
  nextRefresh:"2026-05-26 09:35 ET",
  marketPulse:{
    spy:{ price:745.83, changePct:0.29, ytd:8.74, pe:22.4, ma100:718.2, ma200:692.4,
          series:[686,688,692,695,700,698,704,708,712,710,715,718,720,722,719,724,728,732,740,746] },
    spx:{ index:7473, prevClose:7415 }, // FEAT-202: S&P 500 index (FRED SP500) — live merge target
    qqq:{ price:717.66, changePct:0.44, ytd:15.50 },
    vix:{ current:18.4, weekChg:-13.2, series:[24,22,21,20,22,21,19,18] },
    fearGreed:{ score:58, label:"Greed", prevWeek:44 },
    // DEC-31 (v3.2): Put/Call field removed — CBOE killed the free feed in 2019; retirement noted in footer.
    // FEAT-NEWS: top market headline — live overlay from RSS (marketHeadline/Source); mock is the fallback.
    headline:{ text:"No live headline feed", source:"—" },
  },
  crossAsset:{
    treasury10y:{ current:4.32, d1:+0.08, w1:+0.12, m1:-0.15, yellowBand:0.10, series:[4.52,4.48,4.41,4.35,4.29,4.22,4.18,4.24,4.28,4.32] },
    // FEAT-30Y (v3.55): the long end + the 10s30s term-premium spread. Mock baseline only —
    // live values overlay via SOURCES (DGS30 + the derived spread), exactly like the 10Y.
    treasury30y:{ current:5.18, d1:+0.02, w1:+0.09, m1:+0.21, series:[4.92,4.97,5.01,5.04,5.09,5.12,5.18,5.14,5.16,5.18] },
    term:{ spread10s30s:0.86, series:[0.40,0.49,0.60,0.69,0.80,0.90,1.00,0.90,0.88,0.86] },
    wti:{         current:68.42, d1pct:-0.8, w1pct:-2.1, m1pct:+3.2, yellowBand:1.0, series:[64,65,66,67,69,70,69,68,69,68] },
    btc:{         current:109200,d1pct:+1.2, w1pct:+4.8, m1pct:+12.1,yellowBand:2.0, series:[88000,90000,92000,95000,98000,100000,104000,106000,108000,109200] },
  },
  macro:{
    fedFunds:{ rate:3.625, nextFOMC:"2026-06-17", daysUntil:14, odds:{ hold:84, cut:13, hike:3 } }, // odds: Kalshi FOMC market — LIVE since v2.6.3 (fetchRateOdds); these are the mock baseline only
    cpi:{ headline:3.8, core:2.8, nextRelease:"2026-06-11", trend:[3.2,3.4,3.5,3.6,3.7,3.8] },
    pce:{ headline:3.1, core:2.9, nextRelease:"2026-06-26", trend:[2.6,2.7,2.8,2.9,3.0,3.1] }, // Fed's preferred inflation gauge (FRED PCEPI/PCEPILFE — mock until YoY wired)
    unemployment:{ national:4.3, entryLevel:6.1, lfpr:62.4, trend:[3.8,3.9,4.0,4.1,4.2,4.3] },
    savings:{ rate:4.2, trend:[4.6,4.5,4.4,4.3,4.3,4.2] }, // FRED PSAVERT — personal saving rate, % of disposable income
    mortgage:{ national:6.51, peoria:6.31 },
    credit:{ hy:3.85, ig:0.92, spread:2.93, spreadD1:+0.04,
             series:[2.80,2.78,2.82,2.85,2.88,2.84,2.87,2.90,2.91,2.93] },
    // FEAT-NFCI (v3.43): Chicago Fed National Financial Conditions Index (weekly).
    // Standardized so ZERO is the historical average: positive = tighter than average,
    // negative = looser. The post-GFC era has generally run negative (loose).
    nfci:{ current:-0.42, w1:+0.03,
           series:[-0.55,-0.53,-0.50,-0.49,-0.47,-0.46,-0.45,-0.44,-0.45,-0.42] },
    housing:{ peoria:218400 },
    shillerPe:{ current:42.78, mean:17.4, median:16.1, ath:44.19, pctOfAth:96.8 },
  },
  // PERSONAL CONVICTION WATCHLIST — names + tiers only (no live prices: FRED can't
  // source individual equities, and the stack is FRED-only $0). Pure manual list.
  // ⚠️ EXAMPLE DATA — replace `ticker`/`name`/`thesis` with your real S/A-tier holdings.
  watchlist:[
    { ticker:"NVDA", name:"NVIDIA",        tier:"S", thesis:"AI compute monopoly; data-center rev compounding" },
    { ticker:"MSFT", name:"Microsoft",     tier:"S", thesis:"Azure + Copilot moat; durable FCF" },
    { ticker:"ASML", name:"ASML Holding",  tier:"S", thesis:"EUV lithography sole-supplier chokepoint" },
    { ticker:"GOOGL",name:"Alphabet",      tier:"A", thesis:"Search cash engine funding AI optionality" },
    { ticker:"AMZN", name:"Amazon",        tier:"A", thesis:"AWS margins + retail operating leverage" },
    { ticker:"TSM",  name:"TSMC",          tier:"A", thesis:"Foundry leader; pricing power on leading nodes" },
  ],
  headwinds:[
    { id:1, name:"AI CapEx ROI Gap",    severity:"High", trend:"worsening", claim:"$705B FY26 capex vs $215B AI revenue. No hyperscaler can trace $X spent → $Y gained.", triggers:["AI rev <25% of CapEx","Hyperscaler guide-down"] },
    { id:2, name:"US Debt Service",     severity:"High", trend:"worsening", claim:"Interest payments ~18% of federal revenue. Crowding-out accelerating.", triggers:["10Y sustained >5%","Debt service >25% revenue"] },
    { id:3, name:"SPY Concentration",   severity:"Med",  trend:"stable",    claim:"Top-10 names = 38% of SPY weight. Near 2000 dot-com peak levels.", triggers:["Top-10 weight >42%"] },
    { id:4, name:"CRE / CMBS Stress",   severity:"Med",  trend:"stable",    claim:"CMBS delinquency 5.8%; office vacancy >20% in major metros.", triggers:["CMBS >8%","Bank NPL >4%"] },
    { id:5, name:"Labor Deceleration",  severity:"Low",  trend:"improving", claim:"Entry-level unemployment 6.1%; LFPR flat. Cooling without crashing.", triggers:["U-3 >5%","NFP <50K ×2"] },
  ],
  // Headwinds are a CURATED thesis register (no live feed) — this is the last-reviewed date,
  // surfaced in the UI + the 5 Whys so quarter-old claims aren't presented as today's tape.
  headwindsAsOf:"2026-Q1",
  // AI TOKEN ECONOMICS (the moat) — live overlay from OpenRouter (tokenBlendedMtok/Trend/ModelsJson);
  // mock is the fallback baseline. $/Mtok = blended frontier-basket price (3:1 in:out). Falling = the
  // demand-side mirror of GPU $/hr — together they frame the AI margin-compression hinge with live data.
  tokenomics:{
    blendedMtok:6.20,
    trend:[9.5,8.8,8.0,7.2,6.7,6.20], // oldest→newest; the decline IS the signal
    modelsJson:'[{"name":"Claude Sonnet","mtok":9.0},{"name":"GPT frontier","mtok":7.5},{"name":"Gemini Pro","mtok":6.2},{"name":"Llama large","mtok":2.4},{"name":"DeepSeek","mtok":1.1}]',
  },
  // MAG 10 live prices (Finnhub) — JSON passthrough. The per-ticker quote strip was CUT in
  // v3.51 (public audit, Yahoo-dupe test), so nothing renders these today; the field stays
  // mapped because the same Finnhub pull feeds QQQ and dropping it would change the fetch.
  // '[]' = no live prices yet (mock baseline).
  mag10PricesJson:"[]",
  // fiveWhys: now computed at render time by computeFiveWhys() (src/fiveWhys.js) from live data.
  sessionDelta:{ alertsDelta:0, regimeDelta:"none", vixPct:-2.1, tenYBps:-4, spyPct:+0.29 },
};
// ─── REGIME ENGINE: extracted to src/regime.js (C1, v3.60) ────────────────
// The band table, verdictFrom, computeRegime, flipConditions, regimeFactors and the NFCI
// thresholds now live in the pure module so evidence.js and Node tests import them directly.
// This file resolves tintKey/colorKey to actual colors at the one place they render.

// Live ET market session for the 5-Whys narrative frame (mirrors marketSession() in
// snapshot.js). Computed client-side from the CURRENT clock so a reload at 2pm reads
// "Midday —" and after 4pm "Post-close —", instead of the value frozen into the daily
// snapshot at fetch time. Pure/$0 — no LLM, no network.
function etSession(now = new Date()) {
  // No-session days (mirrors marketSession in snapshot.js — SAME shared table, so the
  // header and the 5-Whys can never disagree with the edge): weekends + market holidays.
  const dow = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" });
  const etDate = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  if (dow === "Sat" || dow === "Sun" || isMarketHoliday(etDate)) return "CLOSE";
  const hour = parseInt(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }), 10);
  if (hour >= 9 && hour < 16) return "OPEN";
  if (hour >= 16) return "CLOSE";
  return "PRE";
}



// ─── HELPERS ─────────────────────────────────────────────────────────────
// fmt moved to src/format.js (task 1.3) — one copy, shared with extracted sections.
// arrow moved into src/primitives/DirTile.jsx (its only consumer, wave 9).
// pctColor moved to src/format.js (task 3.1) — one copy, shared with MacroStrip.
const peColor=(pe)=>pe>80?T.red:pe>40?T.yellow:pe>25?T.textPrimary:T.green;
const marginColor=(m)=>m===null?T.textMuted:m>30?T.green:m>15?T.textPrimary:m>5?T.yellow:T.red;
const yoyColor=(g)=>g>50?T.green:g>15?T.green:g>0?T.textPrimary:g>=0?T.yellow:T.red;

// Returns `count` trading-day label strings (oldest→newest) anchored at anchorDateStr.
// Used to give the SPY sparkline tooltip real dates instead of index numbers.
function spyDatesFrom(anchorDateStr, count) {
  const anchor = anchorDateStr ? new Date(`${anchorDateStr}T00:00:00`) : new Date();
  if (isNaN(anchor.getTime())) return null;
  const dates = [];
  const cur = new Date(anchor);
  while (dates.length < count) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) dates.unshift(cur.toLocaleDateString("en-US", { month:"short", day:"numeric" }));
    cur.setDate(cur.getDate() - 1);
  }
  return dates;
}

// stoplightColor/verdictFromTones moved into src/primitives/DirTile.jsx (wave 9).

// ─── PRIMITIVE COMPONENTS — Badge/Label extracted to src/primitives/atoms.jsx
// (wave 9; Divider was rendered nowhere and was deleted, not moved).

// UndoToast (FEAT-166: 5s mobile / 4s desktop). Stacks multiple toasts so a rapid second
// delete never overwrites the first one's undo — each toast has its own id, timer, and dismiss.
function useUndoToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const show = useCallback((msg, onUndo) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, msg, onUndo }]);
    const delay = (typeof window !== "undefined" && window.innerWidth < 768) ? 5000 : 4000; // FEAT-166
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), delay);
  }, []);
  return { toasts, show, dismiss };
}
const UndoToast=({toasts, dismiss})=>{
  if(!toasts || !toasts.length) return null;
  return(
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:8,zIndex:999}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:T.surfaceHigh,border:`1px solid ${T.amber}66`,borderRadius:6,padding:"10px 16px",display:"flex",gap:12,alignItems:"center",boxShadow:"0 4px 20px #00000088"}}>
          <span style={{fontFamily:T.fontMono,fontSize:11,color:T.textPrimary}}>{t.msg}</span>
          <button onClick={()=>{t.onUndo();dismiss(t.id);}} style={{fontFamily:T.fontMono,fontSize:11,background:T.amber,border:"none",color:"#000",padding:"3px 10px",borderRadius:3,cursor:"pointer",fontWeight:700}}>UNDO</button>
          <button onClick={()=>dismiss(t.id)} style={{fontFamily:T.fontMono,fontSize:11,background:"none",border:"none",color:T.textMuted,cursor:"pointer"}}>✕</button>
        </div>
      ))}
    </div>
  );
};

// DirTile extracted to src/primitives/DirTile.jsx (wave 9).

// ─── WEN MOON METER (mood badge for Macro Strip) ─────────────────────────
// WITHHELD_LABEL + WEN_MOON_STATES moved WITH the verdict band to
// src/sections/RegimeBand.jsx (task 1.3) — the verdict's vocabulary lives in the
// verdict's home, imported here so there is exactly one copy.
function wenMoonState(spyChangePct) {
  const pct = typeof spyChangePct === "number" && isFinite(spyChangePct) ? spyChangePct : 0;
  if (pct > WEN_MOON_UP)   return WEN_MOON_STATES[0]; // MOONING
  if (pct < WEN_MOON_DOWN) return WEN_MOON_STATES[2]; // DIAMOND HANDS
  return WEN_MOON_STATES[1]; // HODL
}
const IS_DEV = !(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_DATA_MODE === "live");
const WenMoonBadge = ({ spyChangePct }) => {
  const [demoIdx, setDemoIdx] = useState(null); // null = use real data
  const s = demoIdx !== null ? WEN_MOON_STATES[demoIdx] : wenMoonState(spyChangePct);
  const handleClick = IS_DEV ? () => {
    setDemoIdx(prev => prev === null ? 0 : (prev + 1) % WEN_MOON_STATES.length);
  } : undefined;
  return (
    <div
      onClick={handleClick}
      title={IS_DEV ? "Click to cycle mood (dev only)"
                    : "Today's tape — SPY's move so far today. Not the macro backdrop verdict, which is the six-factor call at the top of the page."}
      style={{
        display:"flex", alignItems:"center", gap:6, flexShrink:0,
        background: s.color + "18",
        border: `1px solid ${s.color}55`,
        borderRadius: 20,
        padding: "4px 12px",
        boxShadow: `0 0 8px ${s.glow}33`,
        cursor: IS_DEV ? "pointer" : "default",
        userSelect: "none",
        transition: "all 0.2s",
      }}>
      {/* FEAT-TAPE (v3.62): this badge and the hero verdict emit the SAME three words
          (MOONING / HODL / DIAMOND HANDS) from the shared WEN_MOON_STATES, but from
          unrelated inputs — this one is SPY's daily move (±0.5%), the hero is the six-factor
          regime. They can therefore disagree on one screen (hero HODL, badge MOONING) and
          nothing said which question each answered. The hero already labels itself "Macro
          Backdrop"; this one now names its own scope. The vibe is untouched (owner call) —
          only the ambiguity is removed. */}
      <div style={{ fontFamily:T.fontMono, fontSize:7, color:T.textMuted, letterSpacing:"0.1em", whiteSpace:"nowrap" }}>TAPE</div>
      <div style={{ fontFamily:T.fontMono, fontSize:10, fontWeight:700, color:s.color, whiteSpace:"nowrap", letterSpacing:"0.04em" }}>
        {s.label}
      </div>
      {IS_DEV && demoIdx !== null && (
        <div style={{ fontFamily:T.fontMono, fontSize:7, color:T.textMuted, whiteSpace:"nowrap" }}>DEMO</div>
      )}
    </div>
  );
};

// ─── IPO COUNTDOWN TO LAUNCH STRIP ───────────────────────────────────────
function useCountdown(targetDate, isExact) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isExact) return;
    if (targetDate.getTime() - Date.now() <= 0) return; // already launched: never start ticking
    const id = setInterval(() => {
      setNow(Date.now());
      if (targetDate.getTime() - Date.now() <= 0) clearInterval(id); // stop once it reaches zero
    }, 1000);
    return () => clearInterval(id);
  }, [isExact, targetDate]);
  const diff = targetDate.getTime() - now;
  if (diff <= 0) return { expired: true, text: "LAUNCHED", d:0, h:0, m:0, s:0 };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { expired: false, d, h, m, s, text: `${d}d ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` };
}
function approxCountdown(targetDate) {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return "LAUNCHED";
  const months = Math.round(diff / (30.44 * 86400000));
  if (months <= 1) return "~1 month";
  return `~${months} months`;
}

const HyperscalerCapexCard = () => {
  const cx = HYPERSCALER_CAPEX;
  const agg = cx.rows.reduce((a, r) => a + r.guideB, 0);
  const downs = cx.rows.filter(r => r.dir === "down").length;
  const glyph = (d) => d === "down" ? "▼" : d === "up" ? "▲" : "→";
  const gcol  = (d) => d === "down" ? T.red : d === "up" ? T.green : T.textMuted;
  return (
    <div style={{ marginTop:16, background:T.surface, backgroundImage:ILLUS_HATCH, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · Hyperscaler CapEx (funding flow)</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>{cx.fy} guides · reviewed {cx.reviewed}</span>
          <IllustrativeChip/>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, margin:"8px 0 2px", flexWrap:"wrap" }}>
        <span style={{ fontFamily:T.fontMono, fontSize:22, fontWeight:700, color:T.textPrimary }}>${agg}B</span>
        <span style={{ fontFamily:T.fontMono, fontSize:9, color:downs >= 2 ? T.red : T.textMuted }}>
          {downs >= 2 ? `⚡ ${downs} of ${cx.rows.length} guiding DOWN — the regime-turn tell` : `${downs} of ${cx.rows.length} guiding down`}
        </span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:8, marginTop:8 }}>
        {cx.rows.map(r => (
          <div key={r.co} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <span style={{ fontFamily:T.fontMono, fontSize:11, fontWeight:700, color:T.textPrimary }}>{r.co}</span>
              <span style={{ fontFamily:T.fontMono, fontSize:10, color:gcol(r.dir) }}>{glyph(r.dir)}</span>
            </div>
            <div style={{ fontFamily:T.fontMono, fontSize:14, fontWeight:700, color:T.textSecondary }}>${r.guideB}B</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, marginTop:8 }}>{cx.note}</div>
      <SourceBox api="Manual" endpoint="earnings prints · curated per quarter" mode="MOCK"/>
    </div>
  );
};

const GpuPricingCard = () => {
  const g = GPU_PRICING;
  const qoq = (c) => parseFloat((((c.onDemand - c.prevQ) / c.prevQ) * 100).toFixed(1));
  return (
    <div style={{ marginTop:16, background:T.surface, backgroundImage:ILLUS_HATCH, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · GPU On-Demand $/hr</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>{g.quarter} · curated quarterly</span>
          <IllustrativeChip/>
        </div>
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, margin:"6px 0 10px" }}>{g.note}</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
        {g.chips.map(c => {
          const dq = qoq(c);
          const col = dq < -2 ? T.amber : dq > 2 ? T.green : T.textMuted;
          return (
            <div key={c.name} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"9px 11px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                <span style={{ fontFamily:T.fontMono, fontSize:12, fontWeight:700, color:T.textPrimary }}>{c.name}</span>
                <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>NVIDIA</span>
              </div>
              <div style={{ fontFamily:T.fontMono, fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>${c.onDemand.toFixed(2)}</div>
              <div style={{ fontFamily:T.fontMono, fontSize:9, color:col }}>{dq>0?"▲":dq<0?"▼":"▬"} {Math.abs(dq).toFixed(1)}% QoQ</div>
            </div>
          );
        })}
      </div>
      <div style={{ height:30, marginTop:10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={g.trend.map((v,i)=>({v,i}))}>
            <Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SourceBox api="Manual" endpoint="GPU list/on-demand · curated quarterly" mode="MOCK"/>
    </div>
  );
};

// AI UNIT ECONOMICS · LLM token pricing (the moat — price side, pairs with GPU $/hr cost side).
// Live from OpenRouter (props.tok = d.tokenomics; mode/asOf from provenance). Falling $/Mtok is the
// bearish read (intelligence commoditizing → pricing-power erosion), colored amber like the GPU card.
const TokenomicsCard = ({ tok, mode = "MOCK", asOf }) => {
  let models = [];
  try { models = JSON.parse(tok?.modelsJson || "[]"); } catch { models = []; }
  const trend = Array.isArray(tok?.trend) ? tok.trend : [];
  const blended = tok?.blendedMtok;
  // QoQ-style read off the trend: first vs last (the decline is the signal).
  const drop = trend.length >= 2 ? Math.round((1 - trend[trend.length - 1] / trend[0]) * 100) : null;
  const cheapest = models.length ? models.reduce((a, b) => (b.mtok < a.mtok ? b : a)) : null;
  return (
    <div style={{ marginTop:16, background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · LLM Token Price $/Mtok</SectionHeader>
        <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>price side of AI unit economics · pairs with GPU $/hr</span>
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, margin:"6px 0 10px" }}>
        Falling $/Mtok = intelligence commoditizing → AI pricing-power erosion. The demand-side mirror of the GPU $/hr supply squeeze — together, the AI margin-compression hinge.
      </div>
      <div style={{ display:"flex", gap:18, alignItems:"baseline", flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>BLENDED FRONTIER · 3:1 in:out</div>
          <div style={{ fontFamily:T.fontMono, fontSize:24, fontWeight:700, color:T.textPrimary }}>${blended?.toFixed(2)}<span style={{ fontSize:11, color:T.textMuted }}>/Mtok</span></div>
        </div>
        {drop !== null && <div style={{ fontFamily:T.fontMono, fontSize:11, color:T.amber }}>▼ {drop}% over window</div>}
        {cheapest && <div style={{ fontFamily:T.fontMono, fontSize:9, color:T.textMuted }}>floor: {cheapest.name} ${cheapest.mtok}/Mtok</div>}
      </div>
      {models.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:8, marginTop:10 }}>
          {models.map((m) => (
            <div key={m.name} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 10px" }}>
              <div style={{ fontFamily:T.fontMono, fontSize:10, fontWeight:700, color:T.textPrimary }}>{m.name}</div>
              <div style={{ fontFamily:T.fontMono, fontSize:15, fontWeight:700, color:T.textPrimary, marginTop:2 }}>${Number(m.mtok).toFixed(2)}</div>
              <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>$/Mtok</div>
            </div>
          ))}
        </div>
      )}
      {trend.length >= 3 ? (
        <div style={{ height:30, marginTop:10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.map((v, i) => ({ v, i }))}>
              <Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        mode !== "MOCK" && <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, marginTop:8 }}>trend accruing ({trend.length} pt{trend.length === 1 ? "" : "s"}) — builds daily</div>
      )}
      <SourceBox api="OpenRouter" endpoint="api/v1/models · frontier basket · blended $/Mtok" mode={mode} asOf={asOf}/>
    </div>
  );
};

// FEAT-TOKW (v3.46): the CONVERSION leg — tokens/watt × $/token = revenue per MW (in RATES only;
// see the TOKEN_EFFICIENCY comment for why no level is printable). Half live (the $/Mtok window
// from OpenRouter), half curated (the efficiency index), so the card is ILLUSTRATIVE always and
// NEVER votes. The band is withheld on mock/stale price data AND on a window shorter than
// minWeeks — "too short to read" and "flat" are different facts.
const TokenEfficiencyCard = ({ tok, mode = "MOCK" }) => {
  const e = TOKEN_EFFICIENCY;
  const s = tokenScissors(Array.isArray(tok?.trend) ? tok.trend : []);
  const pct = (v) => v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
  // A directional read off mock/stale price data is exactly what the v3.1 invariant forbids.
  const band = isIllustrative(mode) ? null : s.band;
  const bcol = band === "COMPRESSING" ? T.red : band === "EXPANDING" ? T.green : T.textMuted;
  const win = s.weeks ? `${s.weeks}-week window` : "no price window";
  return (
    <div style={{ marginTop:16, background:T.surface, backgroundImage:ILLUS_HATCH, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · Tokens/Watt × $/Token (revenue per MW)</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>efficiency index reviewed {e.reviewed}</span>
          <IllustrativeChip/>
        </div>
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, margin:"6px 0 10px" }}>{e.note}</div>
      <div style={{ display:"flex", gap:18, alignItems:"baseline", flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>SCISSORS · {win}</div>
          <div style={{ fontFamily:T.fontMono, fontSize:24, fontWeight:700, color: band ? bcol : T.textPrimary }}>
            {s.idx === null ? "—" : pct(s.idx)}
          </div>
        </div>
        {band
          ? <span style={{ fontFamily:T.fontMono, fontSize:11, color:bcol }}>{band === "COMPRESSING" ? "▼" : band === "EXPANDING" ? "▲" : "▬"} {band}</span>
          : <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.textMuted }}>
              {s.short ? `window too short to read (<${e.minWeeks}w) — no verdict` : "verdict suppressed — price leg not live"}
            </span>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8, marginTop:10 }}>
        <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px" }}>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>EFFICIENCY (curated)</div>
          <div style={{ fontFamily:T.fontMono, fontSize:15, fontWeight:700, color:T.green }}>{pct(s.effWin)}</div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>{pct(s.effCagr)}/yr projected onto the window</div>
        </div>
        <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px" }}>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>TOKEN PRICE ({mode === "MOCK" ? "mock" : "observed"})</div>
          <div style={{ fontFamily:T.fontMono, fontSize:15, fontWeight:700, color:T.amber }}>{pct(s.pxWin)}</div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>never annualised — the window as measured</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:8, marginTop:8 }}>
        {e.gens.map(g => (
          <div key={g.gen} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"7px 10px" }}>
            <div style={{ fontFamily:T.fontMono, fontSize:10, fontWeight:700, color:T.textPrimary }}>{g.gen}</div>
            <div style={{ fontFamily:T.fontMono, fontSize:13, fontWeight:700, color:T.textSecondary }}>{g.idx.toFixed(2)}×</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, marginTop:8, lineHeight:1.5 }}>
        {e.basis} · relative only — no $/MW figure is derivable from public data and none is shown.
      </div>
      <SourceBox api="Manual" endpoint="chip-generation tokens/W index × live OpenRouter $/Mtok" mode="MOCK"/>
    </div>
  );
};

// ─── FEAT-331 · MACRO FLIP BANNER (the TT circuit, surfaced on the page) ──────
// The maintainer's most consequential circuit lived only in the TT docs. Now it renders
// from live data: TRIPPED (SPY < 200d AND VIX > 25) = de-risk; ARMED (VIX > 22) = pre-stage.
// Rendered ONLY when flip is non-null (live+fresh inputs) AND armed/tripped — never rents
// space at rest, and never fabricates a circuit state on mock/stale data.
const MacroFlipBanner=({flip})=>{
  const tripped=flip.tripped===true;
  const {vix,spy_price,spy_ma200}=flip.inputs;
  const bg=tripped?DT["regime-off-bg"]:DT["regime-mix-bg"];
  const fg=tripped?T.red:T.amber;
  return(
    <div style={{background:bg,borderBottom:`1px solid ${fg}55`,padding:"7px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontFamily:T.fontMono,fontSize:11,fontWeight:700,color:fg,letterSpacing:"0.04em"}}>
        {tripped?"⛔ MACRO FLIP TRIPPED":"⚠ MACRO FLIP ARMED"}
      </span>
      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>
        {tripped
          ? `SPY $${spy_price} below 200-DMA $${spy_ma200} · VIX ${vix} > 25 — de-risk protocol`
          : `VIX ${vix} > 22 · trips if SPY < 200-DMA${spy_ma200!=null?` ($${spy_ma200})`:""} with VIX > 25 — pre-stage GTC buy-to-close`}
      </span>
    </div>
  );
};

// ─── FEAT-169 · REGIME VERDICT BAND ──────────────────────────────────────
// Extracted VERBATIM to src/sections/RegimeBand.jsx (UI-OVERHAUL task 1.3).

// FGGauge extracted to src/primitives/FGGauge.jsx (wave 9).

/* FEAT-ALERT-EVAL (v3.52, suite audit) — the alerts EVALUATE, or they say they cannot.
   The audit called this section "interface theater" for not delivering notifications. The
   defect was worse and one layer earlier: `triggered` was a hardcoded `false` that NOTHING
   ever wrote, while the header claimed "Triggers evaluate live data". No evaluation existed
   at all, so the red dot was unreachable and `activeAlerts` was permanently 0 — a directional
   claim ("nothing has tripped") asserted by code that had never looked. v3.51 fixed only the
   DELIVERY half of that sentence and left the evaluation half standing, which is why this is
   a follow-up rather than a new feature.
   Evaluation is now real AND rides the v3.1 honesty invariant: a threshold is judged ONLY
   from LIVE/CACHED, non-stale inputs. A mock or stale input yields BLIND — deliberately
   distinct from CLEAR, because "this has not tripped" and "I cannot see whether it tripped"
   are different facts, and only the second is true when the feed is dead. Same asymmetry as
   the TAILWIND withhold (v3.40) and readiness()'s fail-closed rule (v3.50). */
const ALERT_METRICS={
  // `ref` (when present) is the LIVE comparison basis — the SPY/200DMA cross must be judged
  // against today's actual moving average, not the 692.4 hardcoded when the alert was authored.
  spy_200ma:   {fields:["spyPrice","spyMa200"], read:(d)=>({v:d.marketPulse.spy.price, ref:d.marketPulse.spy.ma200, u:"$", pre:true}),
                basisLabel:"live 200-DMA"},
  vix:         {fields:["vix"],         read:(d)=>({v:d.marketPulse.vix.current})},
  feargreed:   {fields:["fearGreed"],   read:(d)=>({v:d.marketPulse.fearGreed.score})},
  treasury10y: {fields:["tenYear"],     read:(d)=>({v:d.crossAsset.treasury10y.current})},
  // FEAT-30Y (v3.55): the long end. Judged against LIVE data or BLIND — never a stored flag.
  treasury30y: {fields:["thirtyYear"],  read:(d)=>({v:d.crossAsset.treasury30y.current})},
  // The 10s30s spread. An INVERSION (below 0) is the condition worth waking for, so this
  // alert is authored "below 0" rather than as a level — the curve shape, not the yield.
  term10s30s:  {fields:["thirtyYear","tenYear"], read:(d)=>({v:d.crossAsset.term.spread10s30s})},
  cpi:         {fields:["cpiHeadline"], read:(d)=>({v:d.macro.cpi.headline})},
};
export function evalAlert(alert,d,modeOf){
  const m=ALERT_METRICS[alert.metric];
  if(!m)return{state:"blind",why:"no live metric is wired to this alert"};
  // FAIL CLOSED: every input the threshold depends on must be live+fresh, or we cannot judge.
  const dead=m.fields.filter(f=>{const x=modeOf(f);return x!=="LIVE"&&x!=="CACHED";});
  if(dead.length)return{state:"blind",why:`${dead.join(" + ")} not live — cannot evaluate`};
  const {v,ref,u,pre}=m.read(d);
  const threshold=ref!=null?ref:alert.value;
  if(!Number.isFinite(v)||!Number.isFinite(threshold))return{state:"blind",why:"value unavailable"};
  const hit=alert.condition==="below"?v<threshold:v>threshold;
  const unit=u||alert.unit||"";
  const fmtv=(n)=>pre?`${unit}${n}`:`${n}${unit}`;
  return{state:hit?"triggered":"clear",v,threshold,
    detail:`${fmtv(v)} vs ${fmtv(Math.round(threshold*100)/100)}${m.basisLabel?` (${m.basisLabel})`:""}`};
}
// Alert row
const AlertRow=({alert,ev,onToggle,onDelete})=>{
  // BLIND is amber, never the green that would read as "checked and clear".
  const color=!alert.active?T.textMuted:ev.state==="triggered"?T.red:ev.state==="blind"?T.amber:T.green;
  const badge=ev.state==="triggered"?"TRIPPED":ev.state==="blind"?"BLIND":"clear";
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:T.surface,borderRadius:4,border:`1px solid ${ev.state==="triggered"&&alert.active?T.red:T.border}`}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,boxShadow:alert.active?`0 0 5px ${color}`:"none"}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textPrimary}}>{alert.label}
          {alert.active&&<span style={{fontFamily:T.fontMono,fontSize:8,color,marginLeft:6,letterSpacing:"0.08em"}}>{badge}</span>}
        </div>
        <div style={{fontFamily:T.fontMono,fontSize:9,color:ev.state==="blind"?T.amber:T.textMuted}}>
          {ev.state==="blind"?ev.why:ev.detail||`${alert.condition} ${alert.value}${alert.unit}`}
        </div>
      </div>
      <button onClick={()=>onToggle(alert.id)} aria-label={`Toggle alert ${alert.label}`}
        style={{fontFamily:T.fontMono,fontSize:9,background:"none",border:`1px solid ${T.border}`,color:T.textSecondary,padding:"6px 10px",minWidth:44,minHeight:44,borderRadius:3,cursor:"pointer"}}>
        {alert.active?"ON":"OFF"}
      </button>
      <button onClick={()=>onDelete(alert.id)} aria-label={`Delete alert ${alert.label}`}
        style={{fontFamily:T.fontMono,fontSize:9,background:"none",border:`1px solid ${T.redDim}`,color:T.red,padding:"6px 8px",minWidth:44,minHeight:44,borderRadius:3,cursor:"pointer"}}>✕</button>
    </div>
  );
};

const DEFAULT_ALERTS=[
  // No `triggered` field: it is COMPUTED by evalAlert from live data every render. A stored
  // trigger state is exactly what let this section assert "nothing tripped" without looking.
  {id:1,label:"SPY Below 200D MA",metric:"spy_200ma",condition:"below",value:692.4,unit:"$",active:true},
  {id:2,label:"VIX Spike",metric:"vix",condition:"above",value:25,unit:"",active:true},
  {id:3,label:"F&G Extreme Fear",metric:"feargreed",condition:"below",value:20,unit:"",active:true},
  {id:4,label:"10Y > 5%",metric:"treasury10y",condition:"above",value:5.0,unit:"%",active:true},
  {id:5,label:"CPI > 4%",metric:"cpi",condition:"above",value:4.0,unit:"%",active:false},
  // FEAT-30Y (v3.55): 5.2% is the level the long end just crossed — the highest since 2007.
  // Stated as a threshold to watch, not a claim about what it means.
  {id:6,label:"30Y Above 5.2%",metric:"treasury30y",condition:"above",value:5.2,unit:"%",active:true},
  {id:7,label:"10s30s Inverts",metric:"term10s30s",condition:"below",value:0,unit:"pp",active:false},
];

// ─── MAIN DASHBOARD (FEAT-161: Command Center spatial layout) ─────────────
// publicView prop (from App.jsx ?view=public / VITE_PUBLIC_VIEW) is now consumed.
// NOTE: this build has NO Zone E (401k / compound sim) — that lived only in the
// artifact fork. There is currently no private-only section to gate; the guard
// pattern below is wired and ready for when private content is added.
/* C2b (v3.62, newcomer audit) — the Sections nav gains an ACTIVE state.
   The six <h2>s are visually-hidden, so a jump previously landed with no orientation cue at
   all: every link looked identical before and after the click. Tracking the hash is enough to
   fix that and stays honest — it marks where the reader ASKED to go, which is a fact, rather
   than guessing a "current section" from scroll position (a scroll-spy would need to pick an
   arbitrary threshold and would disagree with the URL). `aria-current="location"` gives a
   screen reader the same cue the highlight gives everyone else. */
// Every SOURCES field that casts a regime vote (all six, CAPE's shillerPe alias included).
const VOTING_FIELDS=new Set(Object.values(FACTOR_FIELD));

const SECTIONS=[["overview","Overview"],["drivers","Drivers"],["markets","Markets"],["macro","Macro"],["ai","AI"],["health","Data Health"]];
const SectionNav=()=>{
  const [hash,setHash]=useState(typeof window!=="undefined"?window.location.hash.slice(1):"");
  useEffect(()=>{
    const onHash=()=>setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange",onHash);
    return()=>window.removeEventListener("hashchange",onHash);
  },[]);
  return(
    <nav aria-label="Sections" style={{display:"flex",gap:2,overflowX:"auto",padding:"4px 16px",background:T.surface,borderBottom:`1px solid ${T.border}`,position:"sticky",top:"env(safe-area-inset-top)",zIndex:40}}>
      {SECTIONS.map(([id,label])=>{
        const on=hash===id;
        return(
        <a key={id} href={`#${id}`} aria-current={on?"location":undefined}
          style={{fontFamily:T.fontMono,fontSize:T.fsS,letterSpacing:"0.08em",color:on?T.textPrimary:T.textSecondary,textDecoration:"none",padding:"6px 10px",borderRadius:3,whiteSpace:"nowrap",
            background:on?T.surfaceHigh:"transparent",border:`1px solid ${on?T.borderAccent:"transparent"}`}}>{label}</a>
      );})}
    </nav>
  );
};

export default function Dashboard({ publicView = false } = {}) {
  const [alerts,setAlerts]=useState(DEFAULT_ALERTS);
  const [watchlistOpen,setWatchlistOpen]=useState(false); // FEAT-322: default closed — curated content doesn't own the default view
  const [copied,setCopied]=useState(false);
  const [ttCopied,setTtCopied]=useState(false); // FEAT-332: "Copy TT readout" button state
  // Re-render every 10 min so the live 5-Whys session frame advances (pre-open→midday→
  // post-close) in an already-open tab without a manual reload. Pure clock tick, $0.
  const [,setSessionTick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setSessionTick(t=>t+1),10*60*1000);return ()=>clearInterval(id);},[]);
  const { toasts, show:showToast, dismiss } = useUndoToast();
  // FEAT-204 wiring — single-point hook swap; mock stays default, operator flips live post-deploy
  const { data: DATA, mode, asOf, provenance, dataAsOf, liveBuild, lastError, retry } = useMarketData(MOCK_DATA, { publicView });
  const d=DATA;
  // FOMC countdown computed CLIENT-SIDE from nextFOMC (the snapshot's daysUntil is frozen at
  // fetch time and rounds up — it read "1d" on decision day). 0 = today. Falls back to the
  // snapshot value if nextFOMC is missing/unparseable.
  // FEAT-SNAP-UX: a PAST nextFOMC date (stale mock/snapshot) must read as unknown (null),
  // not clamp to 0 — the old Math.max(0,…) rendered "FOMC decision today" forever once the
  // baked-in meeting date went by.
  const fomcDays=(()=>{const nx=d.macro.fedFunds.nextFOMC;const dt=nx?parseObsDate(nx):null;if(!dt||isNaN(dt.getTime()))return d.macro.fedFunds.daysUntil;const t=new Date();t.setHours(0,0,0,0);const days=Math.round((dt-t)/86400000);return days<0?null:days;})();
  const fomcLabel=fomcDays==null?"—":fomcDays===0?"today":`${fomcDays}d`;
  // C1 (v3.60): modeOf is now the SHARED fieldMode from evidence.js — the dashboard and the
  // EvidenceSet can never disagree about a field's freshness. Same rule, one home.
  const modeOf=(k)=>fieldMode(provenance, dataAsOf, k); // cadence-aware LIVE | CACHED | STALE | MOCK
  // FEAT-DQ: a regime factor backed by LIVE/CACHED data that has gone STALE (a dead feed)
  // must not cast a vote on today's tape.
  /* C1 (v3.60): the exclusion derivation (STALE always; MOCK-in-a-live-build per
     FEAT-QUORUM v3.54) moved to evidence.js — one home, imported by both this file and the
     EvidenceSet. The full contract is built once here and the new Overview/Drivers/Data
     Health surfaces render IT, never their own reading of provenance. */
  const staleFactors=factorExclusions({provenance, dataAsOf, liveBuild});
  const evidenceSet=buildEvidenceSet({d, provenance, dataAsOf, mode, liveBuild});
  /* ENGINE0-CONT §8: a REAL refresh, distinct from the network-error retry. The operator
     view first asks the server to REBUILD the active snapshot (POST /api/snapshot/refresh —
     authorized by the terminal's same-origin PIN session cookie when one exists; a 401/404
     falls through), then re-fetches. The public friend view only re-fetches (GET) — it must
     never hold an upstream-spending force endpoint. Offered for DEGRADED/withheld evidence,
     not only on HTTP ERROR: a cached-degraded day is exactly when a rebuild can help. */
  const refreshData=async()=>{
    if(!publicView){
      try{
        const r=await fetch("/api/snapshot/refresh",{method:"POST",cache:"no-store",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({scope:"critical",reason:"operator"})});
        if(r.ok){retry();return;}
      }catch(_e){/* endpoint unreachable/unauthorized — plain re-fetch below */}
    }
    retry();
  };
  const regime={...evidenceSet.regime, tint:DT[evidenceSet.regime.tintKey], color:T[evidenceSet.regime.colorKey]};
  /* ENGINE0-CONT: ONE presentation mapping for the withheld posture. The engine keeps its
     internal INSUFFICIENT sentinel (regime.js untouched); every surface that RENDERS the
     label — the verdict band, the 5 Whys narration — reads this view, so the literal
     verdict INSUFFICIENT never reaches a reader (it reads as a system dead end; DATA HOLD
     is the deterministic wait posture the continuity plan specifies). */
  const regimeView=regime.insufficient?{...regime,label:WITHHELD_LABEL}:regime;
  /* Public audit, "Confidence": Signal Quality counted TILES (13 live / 1 stale / 1 mock) and
     never answered the only question that matters about the verdict above it — is the REGIME
     safe to trust? A posture computed from 3 of 6 voters is a different claim from the same
     posture computed from 6, and nothing said which. `counted`/`totalFactors` come from
     computeRegime itself (FIX-E), so this can never drift from the vote it describes, and the
     EXCLUDED factors are NAMED — "5 of 6 usable" without saying which one is blind is half a
     fact. The crash gauge (VIX) is called out by name: it is the input whose absence the
     tt-v1 readout already refuses to print a TAILWIND without. */
  const regimeConf={counted:evidenceSet.counted,total:evidenceSet.totalFactors,
    excluded:evidenceSet.excludedKeys,
    blind:staleFactors.has("vix")||modeOf("vix")==="MOCK"};
  // Signal Quality rollup — at-a-glance trust: how many tracked signals are live+fresh vs
  // stale vs mock. Only meaningful in live mode (in mock everything is MOCK by design).
  const SIGNAL_FIELDS=["spyPrice","vix","fearGreed","tenYear","cpiHeadline","fedFunds","creditSpread","nfci","wti","btc","rateOddsHold","marketHeadline","savings","tokenBlendedMtok","shillerPe"];
  /* B2 (v3.59, re-audit MED-provenance): "13 live" counted LIVE+CACHED under one word, so a
     technically-fresh cached observation read as newly fetched. FRESH is the rollup (both are
     usable); live and cached are named separately inside it. */
  const sq=SIGNAL_FIELDS.reduce((a,k)=>{const m=modeOf(k);if(m==="LIVE"){a.fresh++;a.live++;}else if(m==="CACHED"){a.fresh++;a.cached++;}else if(m==="STALE")a.stale++;else a.mock++;return a;},{fresh:0,live:0,cached:0,stale:0,mock:0});
  sq.total=SIGNAL_FIELDS.length;
  const asOfOf=(k)=>{const s=dataAsOf?.[k]; if(!s)return undefined; const dt=parseObsDate(s); return !dt||isNaN(dt.getTime())?s:`as of ${dt.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;}; // FEAT-R2: "as of Jun 4" (parses ISO + legacy M/D/YYYY)
  // 5 Whys: recomputed every render ($0, no LLM). Override the session frame with the LIVE
  // ET session (not the value frozen in the daily snapshot) so the narrative advances
  // pre-open → midday → post-close through the day. sessionTick re-renders it on a timer.
  // WHY #2 must only assert LIVE+fresh data: build the `fresh` set from modeOf (LIVE/CACHED,
  // not STALE/MOCK). In mock/demo mode pass null so the demo still shows every signal.
  // v3.54: WHY #1's core anchor (SPY/CPI/Fed) is now freshness-gated too, so those three
  // fields MUST be in the set the `fresh` Set is built from — otherwise isLive() would read
  // false for them in live mode and the anchor would drop inputs that are perfectly fresh.
  const FW_FIELDS=["vix","fearGreed","tenYear","wti","btc","creditSpread","marketHeadline",
                   "spyPrice","cpiHeadline","fedFunds"];
  const anyLive=mode==="LIVE"||mode==="CACHED";
  // FEAT-322: live-first view only applies when the app is actually live. In mock/demo mode
  // EVERYTHING is MOCK by design (mock IS the baseline — same convention as fresh:null in
  // fiveWhys), so nothing provenance-dependent collapses there.
  const demoted=(f)=>anyLive&&isIllustrative(modeOf(f));
  /* A1 (v3.58, UX re-audit HIGH): this ternary keyed on `anyLive`, so a LIVE BUILD in its
     LOADING or fetch-error state passed `fresh:null` — which computeFiveWhys defines as
     "mock/demo mode, narrate everything". The verdict said CAN'T CALL IT while the 5 Whys
     asserted mock SPY/CPI/Fed as today's tape — the page's most explanatory section
     contradicting its own honesty contract. Keyed on `liveBuild` (the build's INTENT, the
     v3.54 disambiguation): a loading/failed live build passes an EMPTY set, so every WHY
     clause freshness-gates out and the anchor states itself as 0/3 usable. A demo build
     still passes null — mock IS its baseline (the demoted()/anyLive doctrine, unchanged). */
  const freshSet=liveBuild ? new Set(FW_FIELDS.filter(k=>{const m=modeOf(k);return m==="LIVE"||m==="CACHED";})) : null;
  const fw=computeFiveWhys({...d, session:etSession()}, regimeView, { stale:staleFactors, fresh:freshSet });
  /* B2 (v3.59): "derived from live data" was a STATIC string — it kept asserting liveness
     across cached, degraded, error and demo states. One derivation, both footers. */
  const derivedLabel=mode==="LIVE"?"derived from live data"
    :mode==="CACHED"?"derived from today's cached snapshot"
    :liveBuild?"live data unavailable — nothing derived":"illustrative demo — not live";
  // FEAT-ALERT-EVAL: evaluated from live data every render (see evalAlert). `alertBlind` is
  // reported separately — a header that says "0 FIRED" while every input is dead would be the
  // same false-clear the stored `triggered` flag used to assert.
  const alertEval=Object.fromEntries(alerts.map(a=>[a.id,evalAlert(a,d,modeOf)]));
  const activeAlerts=alerts.filter(a=>a.active&&alertEval[a.id].state==="triggered").length;
  /* C4 (v3.60): the return-visit digest. Compare against the stored last-valid summary, THEN
     store the current one — so the baseline advances exactly when a comparison was rendered.
     Only a quorate, non-withheld, live-build set may become the baseline (summarizeEvidence
     returns null otherwise), so mock/thin evidence can never seed a diff. Keyed on [mode,asOf]
     — once per settled data state, not per render. */
  const [changed,setChanged]=useState(null);
  useEffect(()=>{
    const cur=summarizeEvidence(evidenceSet, asOf||undefined);
    if(!cur){setChanged(null);return;}
    let prev=null;
    try{prev=JSON.parse(localStorage.getItem(LASTVALID_KEY)||"null");}catch{/* garbled = first visit */}
    setChanged(compareEvidence(prev,cur));
    try{localStorage.setItem(LASTVALID_KEY,JSON.stringify(cur));}catch{/* storage may be denied */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode,asOf]);
  const alertBlind=alerts.filter(a=>a.active&&alertEval[a.id].state==="blind").length;

  // FEAT-331: Macro Flip circuit. Render ONLY from live+fresh inputs (v3.1 honesty invariant —
  // a fabricated circuit state is worse than none). Mock/demo/stale => flip stays null => no banner.
  const flipLive=["spyPrice","spyMa200","vix"].every(k=>{const m=modeOf(k);return m==="LIVE"||m==="CACHED";});
  const flip=flipLive?computeMacroFlip({vix:d.marketPulse.vix.current,spyPrice:d.marketPulse.spy.price,spyMa200:d.marketPulse.spy.ma200}):null;

  // FEAT-165: Share button
  const handleShare=()=>{
    navigator.clipboard?.writeText(window.location.href).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  // FEAT-332: Copy TT readout — format the §1.2 paste block from LIVE/CACHED fields only, so a
  // stale/mock field prints n/a rather than a fabricated number in an order-gating block.
  const handleTtCopy=()=>{
    const flat={};
    // Project the live tiles back to flat snapshot field names + their AsOf dates.
    const put=(k,v,asOf)=>{const m=modeOf(k);if(m==="LIVE"||m==="CACHED"){flat[k]=v;if(dataAsOf?.[k])flat[k+"AsOf"]=dataAsOf[k];if(asOf!==undefined)flat[k]=asOf;}};
    put("spyPrice",d.marketPulse.spy.price); put("spyMa200",d.marketPulse.spy.ma200); put("spyChangePct",d.marketPulse.spy.changePct);
    put("vix",d.marketPulse.vix.current); put("vixWeekChg",d.marketPulse.vix.weekChg);
    put("fearGreed",d.marketPulse.fearGreed.score); put("fearGreedLabel",d.marketPulse.fearGreed.label);
    put("qqqChangePct",d.marketPulse.qqq.changePct);
    put("tenYear",d.crossAsset.treasury10y.current); put("tenYearM1",d.crossAsset.treasury10y.m1);
    put("rateOddsHold",d.macro.fedFunds.odds.hold); put("rateOddsCut",d.macro.fedFunds.odds.cut); put("rateOddsHike",d.macro.fedFunds.odds.hike);
    put("nextFomcDate",d.macro.fedFunds.nextFOMC); put("fomcDays",d.macro.fedFunds.daysUntil);
    // qqqChangePct/tenYearM1/etc. share AsOf with their tile's primary field where applicable.
    if(flat.qqqChangePct!==undefined&&dataAsOf?.qqqPrice)flat.qqqPriceAsOf=dataAsOf.qqqPrice;
    if(flat.rateOddsHold!==undefined&&dataAsOf?.rateOddsHold)flat.rateOddsHoldAsOf=dataAsOf.rateOddsHold;
    const block=formatTtPaste(buildTtReadout(flat,{}),{generatedEt:d.lastRefresh});
    navigator.clipboard?.writeText(block).catch(()=>{});
    setTtCopied(true); setTimeout(()=>setTtCopied(false),2000);
  };

  // Alert delete with undo (FEAT-166)
  const handleDeleteAlert=(id)=>{
    const removed=alerts.find(a=>a.id===id);
    setAlerts(prev=>prev.filter(a=>a.id!==id));
    showToast(`Alert "${removed?.label}" deleted`,()=>setAlerts(prev=>[...prev,removed]));
  };

  // SPY chart data
  const spyDateLabels = spyDatesFrom(dataAsOf?.spyPrice, d.marketPulse.spy.series.length);
  const spyData=d.marketPulse.spy.series.map((v,i)=>({
    date: spyDateLabels ? spyDateLabels[i] : i,
    price:v,
    ma200:d.marketPulse.spy.ma200-(d.marketPulse.spy.series.length-1-i)*0.4,
    ma100:d.marketPulse.spy.ma100-(d.marketPulse.spy.series.length-1-i)*0.2,
  }));
  const goldenCross=d.marketPulse.spy.ma100>d.marketPulse.spy.ma200;

  // FEAT-162: Session Delta Bar — Alerts Δ first, then Regime Δ
  const delta=d.sessionDelta;
  const showDeltaBar=!(delta.alertsDelta===0 && delta.regimeDelta==="none");
  const deltaSignals=[
    {label:"Alerts Δ", val:delta.alertsDelta===0?"—":`${delta.alertsDelta>0?"+":""}${delta.alertsDelta}`, color:delta.alertsDelta!==0?T.red:T.textMuted, important:delta.alertsDelta!==0},
    {label:"Regime Δ",  val:delta.regimeDelta==="none"?"—":delta.regimeDelta, color:delta.regimeDelta!=="none"?T.amber:T.textMuted, important:delta.regimeDelta!=="none"},
    {label:"VIX",    val:fmt.pct(delta.vixPct), color:pctColor(delta.vixPct,true)},
    {label:"10Y",    val:fmt.bps(delta.tenYBps), color:pctColor(-delta.tenYBps)},
    {label:"SPY",    val:fmt.pct(delta.spyPct), color:pctColor(delta.spyPct)},
  ];

  // Mag 10 strip CUT (v3.51). `mag10PricesJson` stays mapped in SOURCES and still arrives on
  // the payload — the same Finnhub pull feeds QQQ — but nothing on this page renders per-ticker
  // quotes any more, so the merge/derivation went with the UI. A live field with no consumer is
  // how a cut leaves attribution behind (the v3.43 lesson).

  return(
    <div role="main" aria-label="MacroDash macro backdrop dashboard"
      style={{background:T.bg,minHeight:"100vh",fontFamily:T.fontSans,color:T.textPrimary,paddingLeft:"env(safe-area-inset-left)",paddingRight:"env(safe-area-inset-right)"}}>
      {/* A11Y/IA (11.4.5 audit, High): the rendered page contained NO h1–h6 at all, so a
          screen reader had no document outline to navigate. The visible identity is the
          branded header below; duplicating it on screen would be noise, so the structural
          heading is visually hidden rather than invented as new chrome. */}
      <h1 className="visually-hidden">MacroDash — macro backdrop: is the market environment supportive of taking risk?</h1>
      {/* B4 (v3.59): ONE concise live region. Announcing the full verdict band + confidence
          strip read entire blocks aloud on every snapshot; a reader should hear one sentence. */}
      <div aria-live="polite" role="status" className="visually-hidden">
        {mode==="LOADING"?"Loading live data; posture withheld."
          :mode==="ERROR"?"Live service unavailable; posture withheld."
          :regime.insufficient?`Data hold: only ${regime.counted} of ${regime.totalFactors} factors usable; posture withheld.`
          :`Backdrop ${regime.label}: ${regime.counted} of ${regime.totalFactors} factors usable.`}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;background:${T.bg};}
        ::-webkit-scrollbar-thumb{background:${T.borderAccent};border-radius:2px;}
        @media(max-width:640px){
          /* FEAT-170: macro strip reflows to a 4-col grid (4+3 after DEC-31) — all signals visible, NO horizontal scroll */
          .macro-strip{overflow-x:visible!important;}
          .macro-strip-inner{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:10px 6px!important;min-width:0!important;}
          .macro-strip-inner>div{min-width:0!important;}
          .delta-bar-inner{flex-wrap:nowrap!important;overflow-x:auto!important;}
          .dir-tiles{flex-wrap:wrap!important;}
          .hide-mobile{display:none!important;}
          /* IPO strip stays a horizontal swipeable row on mobile (not 3 stacked cards) */
          .wen-moon-mobile{display:none!important;}
        }
        @media(prefers-reduced-motion:reduce){.pulse-anim{animation:none!important;}}
        /* A2 (v3.58): 320px contract — the duplicate wordmark is the first thing to go. */
        @media(max-width:359px){.sub-wordmark{display:none;}}
        /* B4 (v3.59): WCAG target size — header actions get real thumb targets on phones. */
        @media(max-width:480px){.hdr-act{min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;}}
        /* v3.62: the ⋯ OPS disclosure. The default triangle marker is suppressed so the summary
           reads as the button it is; it keeps native keyboard/AT behaviour either way. */
        .hdr-ops>summary::-webkit-details-marker{display:none;}
        .hdr-ops>summary::marker{content:"";}
        /* A11Y (11.4.5 audit, High): focused controls showed no outline or shadow at all.
           :focus-visible (not :focus) so a mouse click never paints a ring. */
        :focus-visible{outline:2px solid ${DT["focus-ring"]};outline-offset:2px;border-radius:3px;}
        /* The heading is for structure and screen readers; the visible identity is the
           branded header above it, so it is positioned off-screen rather than duplicated. */
        .visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
      `}</style>

      <UndoToast toasts={toasts} dismiss={dismiss}/>

      {/* ── HEADER (FEAT-161, FEAT-165) — a real <header> landmark since C2 (v3.60). The
          section nav below is the sticky element now, so the header scrolls away on phones
          instead of spending 60px of every viewport. ── */}
      {/* FEAT-GLANCE (v3.61): safe-area — index.html has shipped viewport-fit=cover +
          black-translucent since v1 (the page is deliberately drawn BEHIND the iOS status
          bar), but env(safe-area-inset-*) was never added, so the wordmark rendered under
          the Dynamic Island. env() resolves to 0 everywhere else — no visual change. */}
      <header style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"calc(8px + env(safe-area-inset-top)) 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {/* A2 (v3.58): minWidth:0 lets the identity group shrink inside the flex row instead of
            forcing overflow; the sub-wordmark hides below 360px (it duplicates the brand). */}
        <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0,flexWrap:"wrap"}}>
          <div style={{fontFamily:T.fontDisplay,fontSize:20,fontWeight:800,color:T.amber,letterSpacing:"-0.02em"}}>MacroDash</div>
          {/* FEAT-165: friendly sub-headline */}
          {/* FINDING-1: orientation line now visible on mobile (was hide-mobile) */}
          <div className="sub-wordmark" style={{fontFamily:T.fontSans,fontSize:10,color:T.textMuted}}>macrodash</div>
          {/* FEAT-SNAP-UX: the session · timestamp line renders ONLY from live data. The mock
              baseline's hardcoded lastRefresh next to a pulsing dot read as "the site last
              refreshed <months-old date>" — a timestamp is exactly the kind of number the
              v3.1 honesty invariant says must never look live when it isn't. */}
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:anyLive?T.amber:T.textMuted,boxShadow:anyLive?`0 0 5px ${T.amber}`:"none"}} className="pulse-anim"/>
            <span style={{fontFamily:T.fontMono,fontSize:9,color:mode==="ERROR"?T.red:T.textSecondary}}>
              {anyLive?`${d.session} · ${d.lastRefresh}`
                :mode==="LOADING"?"fetching live data…"
                :mode==="ERROR"?"live service unavailable — numbers below are illustrative"
                :"demo baseline — not live"}
            </span>
            {/* B1 (v3.59): the manual retry the re-audit asked for. Only meaningful on ERROR. */}
            {mode==="ERROR"&&<button onClick={retry} aria-label="Retry loading live data"
              style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.red}66`,color:T.red,padding:"2px 8px",borderRadius:3,cursor:"pointer"}}>
              ↻ RETRY
            </button>}
            {/* ENGINE0-CONT: degraded-but-served days get a real refresh, not only outages.
                Operator: rebuild-then-refetch; public: plain re-check (see refreshData). */}
            {mode!=="ERROR"&&mode!=="LOADING"&&liveBuild&&(regime.insufficient||evidenceSet.state==="DEGRADED")&&
              <button onClick={refreshData} aria-label={publicView?"Check for fresher data":"Rebuild and reload live data"}
                style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.amber}66`,color:T.amber,padding:"2px 8px",borderRadius:3,cursor:"pointer"}}>
                {publicView?"↻ CHECK AGAIN":"↻ REFRESH DATA"}
              </button>}
            {/* FINDING-4: set novice expectations — these are end-of-day, not real-time */}
            {anyLive&&<span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>· end-of-day, not real-time</span>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",minWidth:0}}>
          <DataModeBadge mode={mode}/>
          {/* FEAT-GLANCE (v3.61, newcomer audit): the alert badges are operator tooling — the
              Macro Alerts section itself is !publicView (A4), and "⚡ 3 BLIND" reads as a system
              failure to a visitor who can't see the monitors it describes. Same gate.
              v3.62: these stay OUTSIDE the ⋯ OPS menu. A FIRED alert is a red fact and the v3.25
              rule holds board-wide — a collapse must never hide one. Only the always-available
              actions below move behind the disclosure. */}
          {!publicView&&activeAlerts>0&&<Badge label={`⚡ ${activeAlerts} FIRED`} color={T.red}/>}
          {!publicView&&activeAlerts===0&&alertBlind>0&&<Badge label={`⚡ ${alertBlind} BLIND`} color={T.amber}/>}
          {/* FEAT-165: share button — stays in the bar; it is the one action a VISITOR wants. */}
          <button onClick={handleShare} aria-label="Copy dashboard link" className="hdr-act"
            style={{fontFamily:T.fontMono,fontSize:9,background:copied?"#1a3020":T.surfaceHigh,border:`1px solid ${copied?T.green:T.borderAccent}`,color:copied?T.green:T.textSecondary,padding:"5px 12px",borderRadius:4,cursor:"pointer",transition:"all 0.2s"}}>
            {copied?"✓ COPIED":"⤴ SHARE"}
          </button>
          {/* v3.62 (newcomer audit, "default route still shows TT and TERMINAL"): the operator
              ACTIONS consolidate behind one ⋯ OPS disclosure — the admin.html header pattern.
              Owner call: the default route stays the operator view, so this reduces the clutter
              without moving anyone's daily surface. Native <details> — no new state, keyboard
              and screen-reader behaviour for free. */}
          {!publicView&&(
            <details className="hdr-ops" style={{position:"relative"}}>
              <summary aria-label="Operator actions" className="hdr-act"
                style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.borderAccent}`,color:T.textSecondary,padding:"5px 12px",borderRadius:4,cursor:"pointer",listStyle:"none",whiteSpace:"nowrap"}}>
                ⋯ OPS
              </summary>
              <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",display:"flex",flexDirection:"column",gap:6,background:T.surface,border:`1px solid ${T.borderAccent}`,borderRadius:5,padding:8,zIndex:60,minWidth:150,boxShadow:"0 6px 18px #00000055"}}>
                {/* FEAT-332: Copy TT readout — disabled unless live (an order-gating paste block
                    must not ship mock numbers; a disabled button can't be trimmed the way a
                    warning header can). */}
                <button onClick={handleTtCopy} disabled={!anyLive} aria-label="Copy TT regime readout" className="hdr-act"
                  title={anyLive?"Copy the TT regime readout paste block":"live data required"}
                  style={{fontFamily:T.fontMono,fontSize:9,background:ttCopied?"#1a3020":T.surfaceHigh,border:`1px solid ${ttCopied?T.green:T.borderAccent}`,color:ttCopied?T.green:T.textSecondary,padding:"7px 12px",borderRadius:4,cursor:anyLive?"pointer":"not-allowed",opacity:anyLive?1:0.4,textAlign:"left"}}>
                  {ttCopied?"✓ TT COPIED":"⎘ TT readout"}
                </button>
                {/* FEAT-TT: link to the Access-gated Ticker Terminal admin portal */}
                <a href="/admin.html" aria-label="Open Ticker Terminal admin" className="hdr-act"
                  title="TT Ticker Terminal (admin — email-gated)"
                  style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.borderAccent}`,color:T.textSecondary,padding:"7px 12px",borderRadius:4,textDecoration:"none",whiteSpace:"nowrap"}}>
                  ⌁ TERMINAL
                </a>
              </div>
            </details>
          )}
        </div>
      </header>

      {/* FEAT-331: Macro Flip circuit — above the hero when armed/tripped (live data only) */}
      {flip&&(flip.tripped||flip.armed)&&<MacroFlipBanner flip={flip}/>}

      {/* C2 (v3.60): section navigation — the page had one hidden h1 and no way to jump.
          Real <nav> landmark; each link targets the section's h2. Sticky in the header's place. */}
      {/* Safe-area (v3.61): a fixed opaque scrim keeps scrolled content from showing through
          the island strip, and the sticky nav offsets below it — padding the nav instead
          would render a permanent inset-height band even when it isn't stuck. */}
      <div aria-hidden="true" style={{position:"fixed",top:0,left:0,right:0,height:"env(safe-area-inset-top)",background:T.bg,zIndex:45}}/>
      <SectionNav/>

      <h2 id="overview" className="visually-hidden">Overview — posture, confidence, and what changed</h2>
      {/* FEAT-169 + R4c: Regime Verdict band — HERO, now FIRST under the header (mobile-first) */}
      <RegimeBand d={d} stale={staleFactors} loading={mode==="LOADING"} liveBuild={liveBuild} srcLabel={derivedLabel}/>

      {/* ── FEAT-WHY (v3.62): WHY THIS POSTURE — the conclusion in words, before the reader has
          to decode six abbreviations and their thresholds. This is a PROJECTION of the same
          evidenceSet.factors the chips and the Drivers matrix render, so it cannot disagree
          with them. Withheld postures render nothing: there is no "why" for a call that was
          not made, and inventing one would be the fabricated-explanation defect (v3.51's
          isMacroMaterial rule). EXCLUDED factors are shown as UNAVAILABLE, never folded into
          NEUTRAL — "not counted" and "counted, no lean" are different facts. ── */}
      {!evidenceSet.withheld&&evidenceSet.summary&&(
        <div role="region" aria-label="Why this posture"
          style={{padding:"7px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>Why this posture</div>
          <div style={{fontFamily:T.fontMono,fontSize:T.fsL,color:T.textPrimary,lineHeight:1.5,maxWidth:"72ch"}}>{evidenceSet.summary.sentence}</div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:6}}>
            {evidenceSet.summary.groups.map(g=>(
              <div key={g.key} style={{minWidth:0}}>
                <div style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:T[voteStyle(g.vote).colorKey],letterSpacing:"0.1em"}}>{g.label}</div>
                {/* An empty bucket says so with an em dash — a blank cell reads as "not computed". */}
                <div style={{fontFamily:T.fontMono,fontSize:T.fsM,color:g.shorts.length?T.textSecondary:T.textMuted}}>{g.shorts.join(" · ")||"—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5 WHYS (moved here v3.69 NARRATIVE-FIRST — owner call: the narrative outranks
          the tiles). Extracted to src/sections/FiveWhys.jsx (task 1.4), presentation only —
          content and data flow byte-identical; must never collapse (LOADING/ERROR anchors
          are read from body innerText by the public-render suite). ── */}
      <FiveWhys fw={fw} derivedLabel={derivedLabel} mode={modeOf('spyPrice')} asOf={asOfOf('spyPrice')}/>

      {/* ── SIGNAL QUALITY — extracted to src/sections/SignalQuality.jsx (task 3.2),
          presentation only; the SIGNAL_FIELDS census + regimeConf derivation stay here. ── */}
      <SignalQuality sq={sq} regimeConf={regimeConf} regime={regime}/>

      {/* ── C4 (v3.60): WHAT CHANGED — extracted to src/sections/WhatChanged.jsx
          (task 3.3), presentation only; compare-then-persist sequencing stays here. ── */}
      <WhatChanged changed={changed}/>

      {/* ── C3 (v3.60): DRIVERS — the six-factor Evidence Matrix. Renders the EvidenceSet
          contract, never its own reading: value · vote · freshness · as-of · exclusion
          reason per factor. Cards wrap on phones, rows on desktop (flex-wrap). ── */}
      <section aria-labelledby="drivers" style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`}}>
        <h2 id="drivers" className="visually-hidden">Drivers — the six factors and their votes</h2>
        {/* v3.62 (newcomer audit): say which numbers actually DECIDED the posture. Voting and
            context indicators sat at the same visual weight all over the page, so a reader had
            no way to tell the six that cast a vote from the dozens that did not. */}
        <div style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>
          Used in today's posture · {evidenceSet.freshSummary}{evidenceSet.withheld?" · posture withheld":""}
        </div>
        {/* FEAT-GLANCE (v3.61): the six full cards collapse — the band's chip row above is
            already the icon-first six-factor view, so a second full-size rendering of the
            same six facts was the duplication the newcomer audit flagged. Red facts survive
            the collapse: the summary line above stays, exclusions stay named in Signal
            Quality, and the ⏱ chips stay on the band (the v3.25 rule). chip={false} — this
            is live evidence, not curated content. */}
        <CollapsedGroup count={evidenceSet.factors.length} label="factor evidence detail" chip={false}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {evidenceSet.factors.map(f=>{
            // FEAT-NEUTRAL (v3.62): resolves through the SAME shared map as the hero chips.
            // This card was already 4-state and correct; routing it through voteStyle is what
            // makes it structurally impossible for the two altitudes to disagree again.
            const vc=T[voteStyle(f.vote).colorKey];
            return (
              <div key={f.key} style={{flex:"1 1 240px",minWidth:0,background:T.surface,border:`1px solid ${f.excluded?T.amber+"44":T.border}`,borderRadius:5,padding:"8px 10px",opacity:f.excluded?0.85:1}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}>
                  <span style={{fontFamily:T.fontMono,fontSize:10,fontWeight:700,color:T.textPrimary}}>{f.short} <span style={{fontWeight:400,color:T.textMuted}}>{f.label}</span></span>
                  <span style={{fontFamily:T.fontMono,fontSize:9,fontWeight:700,color:vc,textTransform:"uppercase"}}>{f.vote}</span>
                </div>
                <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.display}</div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                  <DataModeBadge mode={f.mode}/>
                  {f.asOf&&<span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>as of {String(f.asOf).slice(0,10)}</span>}
                  {f.excluded&&<span style={{fontFamily:T.fontMono,fontSize:8,color:T.amber}}>excluded — {f.reason}</span>}
                </div>
              </div>
            );})}
        </div>
        </CollapsedGroup>
      </section>

      {/* v3.69 NARRATIVE-FIRST: markets/macro/ai gain real <section> extents (the drivers/
          health pattern) — previously bare h2s, so the ai anchor swallowed Conviction+Alerts. */}
      <section aria-labelledby="markets">
      <h2 id="markets" className="visually-hidden">Markets — equities, rates and cross-asset</h2>
      {/* ── MACRO STRIP — extracted to src/sections/MacroStrip.jsx (task 3.1),
          presentation only (FEAT-170 4-col mobile reflow rides the .macro-strip rules in
          the stylesheet above; v3.25: always visible while market detail collapses). ── */}
      <MacroStrip d={d} modeOf={modeOf} fomcLabel={fomcLabel} fomcDays={fomcDays}
        votingFields={VOTING_FIELDS} badge={<WenMoonBadge spyChangePct={d.marketPulse.spy.changePct}/>}/>


      {/* FEAT-162: Session Delta Bar — Alerts Δ first (conditional: hidden when nothing actionable) */}
      {showDeltaBar&&(
        <div style={{background:"#0a0c10",borderBottom:`1px solid ${T.border}`,padding:"5px 20px",position:"relative"}}>
          <div style={{display:"flex",gap:20,overflowX:"auto",alignItems:"center"}} className="delta-bar-inner">
            <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,flexShrink:0,letterSpacing:"0.1em"}}>SESSION Δ</div>
            {deltaSignals.map(sig=>(
              <div key={sig.label} style={{flexShrink:0}}>
                <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{sig.label}</div>
                <div style={{fontFamily:T.fontMono,fontSize:11,fontWeight:700,color:sig.color}}>{sig.val}</div>
              </div>
            ))}
          </div>
          {/* right-edge gradient fade for mobile overflow */}
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:32,background:"linear-gradient(to right,transparent,#0a0c10)",pointerEvents:"none"}}/>
        </div>
      )}

      {/* ── MARKET DETAIL — extracted to src/sections/MarketDetail.jsx (task 5.2),
          presentation only (v3.69: ONE expander behind the always-visible strip). ── */}
      <MarketDetail d={d} modeOf={modeOf} asOfOf={asOfOf} demoted={demoted} spyData={spyData} goldenCross={goldenCross}/>
      </section>

      <section aria-labelledby="macro">
      {/* C2 (v3.60): the macro anchor lands where the macro grid begins */}
      <h2 id="macro" className="visually-hidden">Macro — inflation, labor, credit and conditions</h2>
      <div style={{padding:"12px 20px 0"}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* FEAT-169: RegimeTile relocated to full-width RegimeBand under macro strip (was here). */}

            {/* Macro Regime grid + Top Headwinds — extracted to src/sections/
                MacroRegime.jsx + Headwinds.jsx (tasks 5.3/5.4), presentation only. */}
            <MacroRegime d={d} modeOf={modeOf} asOfOf={asOfOf} fomcDays={fomcDays}/>
            <Headwinds d={d}/>


          </div>
      </div>
      </section>

      <section aria-labelledby="ai">
      <div style={{padding:"0 20px"}}>
        <h2 id="ai" className="visually-hidden">AI unit economics — cost, price, conversion and funding</h2>
        {/* ── AI UNIT ECONOMICS · cost side (GPU $/hr) + price side (token $/Mtok) ── */}
        <div style={{marginTop:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:T.fontMono,fontSize:10,color:"#a78bfa",letterSpacing:"0.14em",whiteSpace:"nowrap"}}>◆ AI UNIT ECONOMICS</span>
          {/* v3.53: `whiteSpace:"nowrap"` on a 317px string blew the PAGE out to 488px at 390px
              wide — found by the flip-conditions browser check, pre-existing since v3.46. The
              label is a subtitle; it wraps. */}
          <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,minWidth:0}}>cost ↔ price ↔ conversion ↔ funding · the margin-compression hinge</span>
          <div style={{height:1,flex:1,background:T.border}}/>
        </div>
        {/* FEAT-322: the live price side (OpenRouter) leads; the curated GPU cost side is
            one tap away — always-curated content doesn't own the default view. */}
        <TokenomicsCard tok={d.tokenomics} mode={modeOf('tokenBlendedMtok')} asOf={asOfOf('tokenBlendedMtok')}/>
        <CollapsedGroup count={1} label="curated: GPU $/hr cost side">
          <GpuPricingCard />
        </CollapsedGroup>
        {/* FEAT-TOKW (v3.46): the conversion leg — what a fixed MW of power converts into. */}
        <CollapsedGroup count={1} label="curated: tokens/watt × $/token conversion">
          <TokenEfficiencyCard tok={d.tokenomics} mode={modeOf('tokenBlendedMtok')} />
        </CollapsedGroup>
        {/* FEAT-CAPEX (v3.45): the third leg — the capex pool that funds both sides above. */}
        <CollapsedGroup count={1} label="curated: hyperscaler capex funding flow">
          <HyperscalerCapexCard />
        </CollapsedGroup>
      </div>
      </section>

      {/* v3.69: operator monitors + health + footer share the bottom padded container the old
          command-center wrapper used to provide. */}
      <div style={{padding:"0 20px 16px"}}>

        {/* MAG 10 quote strip CUT (v3.51, public audit). v3.43 cut its curated fundamentals
            on the Yahoo-dupe test ("Yahoo/SA do this better and fresher"); the surviving live
            price + day-move strip fails the SAME test — it is the raw-data layer, and the moat
            is the judgment layer. mag10PricesJson/SOURCES/fetchEquities stay wired: QQQ still
            renders from the same Finnhub pull, so nothing upstream is removed. */}
        {/* ── MY CONVICTION · S/A TIER (full-width, collapsible) ── */}
        {/* A4 (v3.58): PRIVATE on the shareable route. Authored conviction tiers are the
            owner's judgment layer — the friend-share view must not disclose them (owner call,
            composing the v3.51 keep-on-default decision with the re-audit's public gate). */}
        {!publicView&&(<section aria-label="Operator monitors — conviction and alerts">
        {!publicView&&<div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
          <button onClick={()=>setWatchlistOpen(o=>!o)} aria-expanded={watchlistOpen}
            style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"none",border:"none",cursor:"pointer",borderBottom:watchlistOpen?`1px solid ${T.border}`:"none"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontFamily:T.fontMono,fontSize:10,color:T.amber,letterSpacing:"0.1em"}}>MY CONVICTION</span>
              <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Personal watchlist · tiered by conviction · no prices</span>
            </div>
            <span style={{fontFamily:T.fontMono,fontSize:10,color:T.textMuted}}>{watchlistOpen?"▲":"▼"}</span>
          </button>
          {watchlistOpen&&(
            <div style={{padding:"12px 16px 16px"}}>
              {[
                {tier:"S", accent:T.amber, blurb:"Highest conviction · core holdings"},
                {tier:"A", accent:T.blue,  blurb:"High conviction · sized below S"},
              ].map(({tier,accent,blurb})=>{
                const picks=d.watchlist.filter(w=>w.tier===tier);
                if(!picks.length) return null;
                return(
                  <div key={tier} style={{marginBottom:14}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                      <span style={{fontFamily:T.fontMono,fontSize:13,fontWeight:700,color:accent,border:`1px solid ${accent}66`,borderRadius:3,padding:"1px 8px",background:accent+"18"}}>{tier}</span>
                      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.08em"}}>{blurb.toUpperCase()}</span>
                      <div style={{height:1,flex:1,background:T.border}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                      {picks.map(w=>(
                        <div key={w.ticker} style={{background:T.surfaceHigh,border:`1px solid ${accent}33`,borderLeft:`3px solid ${accent}`,borderRadius:5,padding:"9px 11px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:6}}>
                            <span style={{fontFamily:T.fontMono,fontSize:13,fontWeight:700,color:T.textPrimary}}>{w.ticker}</span>
                            <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,textAlign:"right"}}>{w.name}</span>
                          </div>
                          {w.thesis&&<div style={{fontFamily:T.fontSans,fontSize:10,color:T.textSecondary,lineHeight:1.4,marginTop:5}}>{w.thesis}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <SourceBox api="Manual" endpoint="personal watchlist · names + tiers only" mode="MOCK"/>
            </div>
          )}
        </div>}

        {/* ── ALERTS STRIP (compact, at bottom) ── */}
        {/* A4 (v3.58): PRIVATE on the shareable route — page-local toggles imply user state a
            visitor does not have; monitors are the operator's, not the share view's. */}
        {!publicView&&<div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <SectionHeader>Macro Alerts</SectionHeader>
            {/* Public audit: an ON/OFF toggle beside 8px muted "notifications not wired" reads as
                a working alert system. The toggles are real (they gate the triggered dot on this
                page) but nothing is DELIVERED, so the limit is stated at the same weight as the
                control — the honesty invariant applied to an affordance instead of a number. */}
            <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,border:`1px solid ${T.amber}44`,borderRadius:3,padding:"2px 7px"}}>
              ⚠ Evaluated live on THIS page only — no push, email or SMS is sent
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:6}}>
            {alerts.map(a=><AlertRow key={a.id} alert={a} ev={alertEval[a.id]} onToggle={id=>setAlerts(prev=>prev.map(x=>x.id===id?{...x,active:!x.active}:x))} onDelete={handleDeleteAlert}/>)}
          </div>
        </div>}
        </section>)}

        {/* ── C2/C4 (v3.60): DATA HEALTH — is the product current, degraded, or recovering? ── */}

        <section aria-labelledby="health" style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"12px 16px"}}>
          <h2 id="health" className="visually-hidden">Data health — per-source freshness and recovery</h2>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <SectionHeader>Data Health</SectionHeader>
            {mode==="ERROR"&&<div style={{fontFamily:T.fontMono,fontSize:9,color:T.red,display:"flex",gap:8,alignItems:"center"}}>
              live fetch failed{lastError?`: ${String(lastError).slice(0,60)}`:""}
              <button onClick={retry} style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.red}66`,color:T.red,padding:"2px 8px",borderRadius:3,cursor:"pointer"}}>↻ RETRY</button>
            </div>}
          </div>
          {/* FEAT-GLANCE (v3.61): the 15-row per-source grid is diagnostic depth, one tap
              away. The section header + the ERROR/Retry row stay outside the collapse —
              an outage is a red fact and must not need a click to discover. */}
          <CollapsedGroup count={SIGNAL_FIELDS.length} label="per-source detail" chip={false}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:6}}>
            {SIGNAL_FIELDS.map(k=>(
              <div key={k} style={{display:"flex",gap:6,alignItems:"center",fontFamily:T.fontMono,fontSize:9,color:T.textSecondary,padding:"4px 6px",background:T.bg,borderRadius:3,flexWrap:"wrap"}}>
                <span style={{minWidth:88,color:T.textPrimary}}>{k}</span>
                <DataModeBadge mode={modeOf(k)}/>
                <span style={{fontSize:8,color:T.textMuted}}>{cadenceOf(k)}</span>
                {dataAsOf?.[k]&&<span style={{fontSize:8,color:T.textMuted}}>{String(dataAsOf[k]).slice(0,10)}</span>}
              </div>
            ))}
          </div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:6}}>
            cadence is each source's normal release rhythm — a monthly print weeks old can still be the freshest available
          </div>
          {/* The chip legend lives with the diagnostics it decodes (moved from the always-visible
              Signal Quality strip, v3.61 — explanation, not evidence). */}
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:4}}>legend: ● live · ⏱ stale · <span style={{color:T.amber}}>◫ illustrative = curated, not live</span></div>
          </CollapsedGroup>
        </section>

        {/* ── FOOTER ── */}
        <div style={{marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{`MacroDash v${__APP_VERSION__} · Data refreshed daily · end-of-day sources`}{publicView?" · public view — the operator view carries the curated watchlist and alert monitors":""}</div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Not financial advice · Personal use</div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Live: FRED · CNN · Kalshi · OpenRouter · Finnhub · multpl · Curated: GPU $/hr · hyperscaler capex · token efficiency · Retired: CBOE Put/Call (free feed dead 2019 · v3.2) · Mag 10 fundamentals + SEC S-1 (v3.43) · Mag 10 quote strip (v3.51)</div>
        </div>
      </div>
    </div>
  );
}
