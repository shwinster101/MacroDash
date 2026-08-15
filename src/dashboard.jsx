import { useState, useEffect, useCallback, useRef } from "react"; // Fragment left with MarketDetail (wave 9)
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
import AIUnitEconomics from "./sections/AIUnitEconomics.jsx"; // task 7.1: presentation only
import Alerts from "./sections/Alerts.jsx"; // task 7.2: evaluation stays here
import DataHealth from "./sections/DataHealth.jsx"; // task 7.3: presentation only
import Watchlist from "./sections/Watchlist.jsx"; // task 7.4: A4 gate stays at the call site
import StickyNav from "./sections/StickyNav.jsx"; // task 9.2: viewport-tracked active state
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


// GPU_PRICING / TOKEN_EFFICIENCY / tokenScissors / HYPERSCALER_CAPEX moved to
// src/aiEcon.js (wave 12). LAUNCH_COST + EVTOL_CERT are DELETED, not moved — their
// consumer components (LaunchCostCard/EvtolCertCard) were removed in v3.69 and the
// constants rendered nowhere since (the Divider rule: dead data is a rot vector).

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
    // FEAT-SAHM (v3.84): 3M bill + the 10y–3m recession lead. Mock spread is POSITIVE-normal
    // on purpose — the demo must not fake a recession signal (the NFCI abstain precedent).
    treasury3m:{ current:3.95 },
    term:{ spread10s30s:0.86, series:[0.40,0.49,0.60,0.69,0.80,0.90,1.00,0.90,0.88,0.86],
           spread10y3m:0.37, series10y3m:[0.10,0.14,0.18,0.22,0.25,0.28,0.30,0.33,0.35,0.37] },
    wti:{         current:68.42, d1pct:-0.8, w1pct:-2.1, m1pct:+3.2, yellowBand:1.0, series:[64,65,66,67,69,70,69,68,69,68] },
    btc:{         current:109200,d1pct:+1.2, w1pct:+4.8, m1pct:+12.1,yellowBand:2.0, series:[88000,90000,92000,95000,98000,100000,104000,106000,108000,109200] },
  },
  macro:{
    fedFunds:{ rate:3.625, nextFOMC:"2026-06-17", daysUntil:14, odds:{ hold:84, cut:13, hike:3 } }, // odds: Kalshi FOMC market — LIVE since v2.6.3 (fetchRateOdds); these are the mock baseline only
    cpi:{ headline:3.8, core:2.8, nextRelease:"2026-06-11", trend:[3.2,3.4,3.5,3.6,3.7,3.8] },
    pce:{ headline:3.1, core:2.9, nextRelease:"2026-06-26", trend:[2.6,2.7,2.8,2.9,3.0,3.1] }, // Fed's preferred inflation gauge (FRED PCEPI/PCEPILFE — mock until YoY wired)
    // sahm 0.13 = deliberately CLEAR (trigger is >= 0.50) — the demo abstains, never a verdict.
    unemployment:{ national:4.3, entryLevel:6.1, lfpr:62.4, sahm:0.13, trend:[3.8,3.9,4.0,4.1,4.2,4.3] },
    savings:{ rate:4.2, trend:[4.6,4.5,4.4,4.3,4.3,4.2] }, // FRED PSAVERT — personal saving rate, % of disposable income
    mortgage:{ national:6.51, peoria:6.31 },
    // FEAT-CCC (v3.84): tail 9.4 sits in the NEUTRAL zone (calm <7, stress >12) on purpose —
    // the demo shows a gauge that abstains in ordinary conditions (the NFCI mock precedent).
    credit:{ hy:3.85, ig:0.92, spread:2.93, spreadD1:+0.04,
             series:[2.80,2.78,2.82,2.85,2.88,2.84,2.87,2.90,2.91,2.93],
             tail:9.4, tailD1:+0.05,
             tailSeries:[9.1,9.0,9.2,9.3,9.2,9.1,9.3,9.4,9.3,9.4] },
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
  // the P leg beside GPU $/hr (volDay/volTrend are the Q leg, v3.85; P×Q is the demand read).
  tokenomics:{
    blendedMtok:6.20,
    trend:[9.5,8.8,8.0,7.2,6.7,6.20], // oldest→newest; the decline IS the signal
    modelsJson:'[{"name":"Claude Sonnet","mtok":9.0},{"name":"GPT frontier","mtok":7.5},{"name":"Gemini Pro","mtok":6.2},{"name":"Llama large","mtok":2.4},{"name":"DeepSeek","mtok":1.1}]',
    // FEAT-TOKVOL (v3.85): the Q leg. 6 pts = 5 intervals — below minWeeks like the price
    // trend above, so the mock P×Q read is "window too short" by construction (never a
    // fabricated demand verdict; the demand line is also illustrative-suppressed).
    volDay:2.95, volTrend:[2.1,2.3,2.4,2.6,2.8,2.95],
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

// AI cards extracted to src/sections/AIUnitEconomics.jsx (wave 12).

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
  // FEAT-SAHM (v3.84): the 10y–3m inversion — the two-leg blind rule: one MOCK leg blinds
  // the alert (a spread judged off one stale leg is a fabricated number).
  term10y3m:   {fields:["tenYear","threeMonth"], read:(d)=>({v:d.crossAsset.term.spread10y3m})},
  // FEAT-CCC (v3.84): the junk tail, single-leg.
  credittail:  {fields:["creditTail"],  read:(d)=>({v:d.macro.credit.tail})},
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
// AlertRow moved into src/sections/Alerts.jsx (wave 12) — its only consumer.
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
  // FEAT-CCC/FEAT-SAHM (v3.84): both OFF by default — thresholds to watch, arriving with
  // the same author-time-number convention as the 30Y 5.2 (not imported constants).
  {id:8,label:"CCC Tail Above 12pp",metric:"credittail",condition:"above",value:12,unit:"pp",active:false},
  {id:9,label:"10y–3m Inverts",metric:"term10y3m",condition:"below",value:0,unit:"pp",active:false},
];

// ─── MAIN DASHBOARD (FEAT-161: Command Center spatial layout) ─────────────
// publicView prop (from App.jsx ?view=public / VITE_PUBLIC_VIEW) is now consumed.
// NOTE: this build has NO Zone E (401k / compound sim) — that lived only in the
// artifact fork. There is currently no private-only section to gate; the guard
// pattern below is wired and ready for when private content is added.
// Every SOURCES field that casts a regime vote (all six, CAPE's shillerPe alias included).
const VOTING_FIELDS=new Set(Object.values(FACTOR_FIELD));

// SectionNav extracted to src/sections/StickyNav.jsx (wave 15, task 9.2) — the v3.62
// hash-only active state is SUPERSEDED by IntersectionObserver viewport tracking
// (Req 3.7); a click still wins instantly via the hash. Hamburger form at ≤320px.

export default function Dashboard({ publicView = false } = {}) {
  const [alerts,setAlerts]=useState(DEFAULT_ALERTS);
  const [copied,setCopied]=useState(false);
  const [ttCopied,setTtCopied]=useState(false); // FEAT-332: "Copy TT readout" button state
  // Re-render every 10 min so the live 5-Whys session frame advances (pre-open→midday→
  // post-close) in an already-open tab without a manual reload. Pure clock tick, $0.
  const [,setSessionTick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setSessionTick(t=>t+1),10*60*1000);return ()=>clearInterval(id);},[]);
  const { toasts, show:showToast, dismiss } = useUndoToast();
  // 9.3 (Req 8.9): when the FIRST fetch resolves (LOADING -> LIVE/CACHED/ERROR), move
  // keyboard focus to the verdict region so a screen reader hears the settled posture
  // without hunting for it. Only on that one transition — later snapshot refreshes must
  // never steal focus from whatever the user is doing.
  const prevModeRef=useRef(null);
  useEffect(()=>{
    const prev=prevModeRef.current; prevModeRef.current=mode;
    if(prev==="LOADING"&&(mode==="LIVE"||mode==="CACHED"||mode==="ERROR"))
      document.getElementById("overview")?.focus();
  });
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
  const SIGNAL_FIELDS=["spyPrice","vix","fearGreed","tenYear","cpiHeadline","fedFunds","creditSpread","nfci","wti","btc","rateOddsHold","marketHeadline","savings","tokenBlendedMtok","shillerPe","creditTail"]; // creditTail appended at the END — smoke pins the "creditSpread","nfci" adjacency
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

  // FEAT-165: Share button.
  // Wave 16 (Req 7.9): the ✓ COPIED claim is CONFIRMED, never optimistic — the old handler
  // set it before the write settled, so a denied clipboard permission still flashed a green
  // success for 2s (a false success claim, the honesty invariant applied to an affordance).
  // A failed or cancelled write reverts to the idle label immediately (<300ms) with NO error
  // toast — the user cancelled or the browser refused; nagging adds nothing.
  const handleShare=()=>{
    const p=navigator.clipboard?.writeText(window.location.href);
    if(!p){return;} // no clipboard API — claim nothing
    p.then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})
     .catch(()=>{setCopied(false);});
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
    // Wave 16 (Req 7.9): same confirmed-not-optimistic rule as handleShare — this block gates
    // real orders, so a false "✓ TT COPIED" over an empty clipboard is strictly worse here.
    const p=navigator.clipboard?.writeText(block);
    if(!p){return;}
    p.then(()=>{setTtCopied(true);setTimeout(()=>setTtCopied(false),2000);})
     .catch(()=>{setTtCopied(false);});
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
      {/* 9.3 (Req 8.2): skip-navigation — first focusable element, visually hidden until
          focused, jumps keyboard/SR users straight to the verdict region. */}
      <a href="#overview" className="skip-link">Skip to verdict</a>
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
          /* .hide-mobile rule DELETED (wave 17 audit): zero consumers since FINDING-1. */
          /* IPO strip stays a horizontal swipeable row on mobile (not 3 stacked cards) */
          .wen-moon-mobile{display:none!important;}
        }
        @media(prefers-reduced-motion:reduce){.pulse-anim{animation:none!important;}}
        /* A2 (v3.58): 320px contract — the duplicate wordmark is the first thing to go. */
        @media(max-width:359px){.sub-wordmark{display:none;}}
        /* 9.3 (Req 8.2): the skip link is the first focusable element — hidden until focused. */
        .skip-link{position:absolute;left:-9999px;z-index:100;background:${T.surfaceHigh};color:${T.textPrimary};font-family:${T.fontMono};font-size:11px;padding:10px 16px;border:1px solid ${DT["focus-ring"]};border-radius:3px;}
        .skip-link:focus{left:8px;top:calc(8px + env(safe-area-inset-top));}
        /* 9.1 (Req 6.4): ≤320px — nav collapses to a hamburger, header stays ≤56px. */
        @media(max-width:320px){
          .nav-row{display:none!important;}
          .nav-burger{display:block!important;}
          header{max-height:56px;overflow:hidden;flex-wrap:nowrap!important;}
          .wordmark{font-size:16px!important;}
        }
        /* 9.1 (Req 6.3): 44px tap targets on the remaining interactive controls at phone width. */
        @media(max-width:480px){
          .nav-link,.cg-toggle,.hw-row{min-height:44px;}
        }
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
          <div className="wordmark" style={{fontFamily:T.fontDisplay,fontSize:20,fontWeight:800,color:T.amber,letterSpacing:"-0.02em"}}>MacroDash</div>
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
      <StickyNav/>

      {/* 9.3: the overview heading is the skip-link target — tabIndex -1 makes it
          programmatically focusable for the skip jump AND the LOADING-resolve focus move. */}
      <h2 id="overview" tabIndex={-1} className="visually-hidden">Overview — posture, confidence, and what changed</h2>
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
      {/* ── AI UNIT ECONOMICS — extracted to src/sections/AIUnitEconomics.jsx
          (task 7.1), presentation only; data + scissors in src/aiEcon.js. ── */}
      <AIUnitEconomics d={d} modeOf={modeOf} asOfOf={asOfOf}/>
      </section>

      {/* v3.69: operator monitors + health + footer share the bottom padded container the old
          command-center wrapper used to provide. */}
      <div style={{padding:"0 20px 16px"}}>

        {/* MAG 10 quote strip CUT (v3.51, public audit). v3.43 cut its curated fundamentals
            on the Yahoo-dupe test ("Yahoo/SA do this better and fresher"); the surviving live
            price + day-move strip fails the SAME test — it is the raw-data layer, and the moat
            is the judgment layer. mag10PricesJson/SOURCES/fetchEquities stay wired: QQQ still
            renders from the same Finnhub pull, so nothing upstream is removed. */}
        {/* ── MY CONVICTION — extracted to src/sections/Watchlist.jsx (task 7.4);
            A4: the !publicView gate stays on this wrapper. ── */}
        {!publicView&&(<section aria-label="Operator monitors — conviction and alerts">
        <Watchlist watchlist={d.watchlist}/>

        {/* ── ALERTS STRIP — extracted to src/sections/Alerts.jsx (task 7.2);
            evaluation + state stay here, the A4 gate stays on the wrapper. ── */}
        <Alerts alerts={alerts} alertEval={alertEval}
          onToggle={id=>setAlerts(prev=>prev.map(x=>x.id===id?{...x,active:!x.active}:x))}
          onDelete={handleDeleteAlert}/>
        </section>)}

        {/* ── DATA HEALTH — extracted to src/sections/DataHealth.jsx (task 7.3);
            the whole <section> moved so the health anchor + h2 travel together. ── */}
        <DataHealth signalFields={SIGNAL_FIELDS} modeOf={modeOf} dataAsOf={dataAsOf}
          mode={mode} lastError={lastError} retry={retry}/>

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
