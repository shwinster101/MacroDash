import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useMarketData } from "./useMarketData.js"; // FEAT-204 wiring
import { computeFiveWhys } from "./fiveWhys.js"; // v2.5: rule-based 5 Whys ($0, derived from live data)
import { isStale } from "./sources.js"; // FEAT-R3: per-tile staleness

// ─── DESIGN TOKENS v1.6 (FEAT-152 + FEAT-167) ─────────────────────────────
// design-tokens.json canonical. Inline mirror — keep in sync.
const DT = {
  // Brand
  "amber":          "#f0a500",
  "amber-dim":      "#8a5f00",
  // Stoplights
  "green":          "#2ecc71",
  "green-dim":      "#1a5c3a",
  "red":            "#e74c3c",
  "red-dim":        "#5c1a1a",
  "yellow":         "#f39c12",
  // Regime tints (soft — AS2-01 alarm calibration fix)
  "regime-on-bg":   "#0d2218",   // risk-on: deep green tint, NOT stoplight green
  "regime-off-bg":  "#1a0f0f",   // risk-off: deep red tint
  "regime-mix-bg":  "#1a1408",   // mixed: deep amber tint
  // DataMode states (FEAT-150)
  "live-cyan-700":  "#0e7490",   // WCAG AA verified
  "stale-amber":    "#f0a500",
  "cached":         "#a1a1aa",   // FEAT-167: zinc-400, NOT gray-500 (#6b7280)
  // Sources
  "src-fmp":        "#3b82f6",
  "src-fred":       "#10b981",
  "src-anthropic":  "#f97316",
  "src-cnn":        "#ef4444",
  "src-cboe":       "#8b5cf6",
  "src-zillow":     "#14b8a6",
  "src-manual":     "#6b7280",
  // Surfaces
  "bg":             "#08090b",
  "surface":        "#0f1115",
  "surface-high":   "#161921",
  "border":         "#1a1f2e",
  "border-accent":  "#252d40",
  // Text
  "text-primary":   "#e8eaf0",
  "text-secondary": "#8892a4",
  "text-muted":     "#3d4760",
  // Type
  "font-mono":      "'IBM Plex Mono','Courier New',monospace",
  "font-sans":      "'DM Sans',system-ui,sans-serif",
  "font-display":   "'Syne',sans-serif",
};
const T = {
  bg:DT["bg"], surface:DT["surface"], surfaceHigh:DT["surface-high"],
  border:DT["border"], borderAccent:DT["border-accent"],
  amber:DT["amber"], amberDim:DT["amber-dim"],
  green:DT["green"], greenDim:DT["green-dim"],
  red:DT["red"], redDim:DT["red-dim"], yellow:DT["yellow"],
  blue:"#3498db", purple:"#9b59b6",
  textPrimary:DT["text-primary"], textSecondary:DT["text-secondary"], textMuted:DT["text-muted"],
  fontMono:DT["font-mono"], fontSans:DT["font-sans"], fontDisplay:DT["font-display"],
};

// ─── WEN MOON METER THRESHOLDS (configurable) ─────────────────────────────
// SPY daily change % thresholds for the mood badge on the Macro Strip
const WEN_MOON_UP = 0.5;    // above this → MOONING
const WEN_MOON_DOWN = -0.5; // below this → DIAMOND HANDS

// ─── IPO COUNTDOWN TARGETS ────────────────────────────────────────────────
// Dates and valuations for the Countdown to Launch strip
const IPO_SPACEX = {
  name: "SpaceX", ticker: "SPACEX", color: "#3b82f6",
  ipoDate: new Date("2026-06-12T09:30:00-04:00"), // June 12 2026 market open ET
  isExact: true,
  stage: "PRICING → TRADING", stageNote: "Roadshow active, pricing June 11",
  pricePerShare: "$135", valuation: "$1.77T",
  progressPct: 90,
  stageIndex: 2, // 0=Filed, 1=Roadshow, 2=Pricing, 3=Trading
};
const IPO_ANTHROPIC = {
  name: "Anthropic", ticker: "ANTH", color: "#f97316",
  ipoDate: new Date("2026-10-15T09:30:00-04:00"), // ~October 2026 (approximate)
  isExact: false,
  stage: "S-1 FILED → ROADSHOW",
  pricePerShare: null, valuation: "$965B",
  progressPct: 40,
  stageIndex: 1,
};
const IPO_OPENAI = {
  name: "OpenAI", ticker: "OAII", color: "#10b981",
  ipoDate: new Date("2026-12-01T09:30:00-05:00"), // ~Q4 2026 (approximate)
  isExact: false,
  stage: "S-1 FILED → REVIEW",
  pricePerShare: null, valuation: "$852B–$1T",
  progressPct: 30,
  stageIndex: 0,
};
const IPO_TARGETS = [IPO_SPACEX, IPO_ANTHROPIC, IPO_OPENAI];
const IPO_STAGES = ["Filed", "Roadshow", "Pricing", "Trading"];

// ─── SOURCE BOX ────────────────────────────────────────────────────────────
// FEAT-167: CACHED badge uses dashed border + zinc-400 (#a1a1aa)
const apiColors = {
  FMP:DT["src-fmp"], FRED:DT["src-fred"], Anthropic:DT["src-anthropic"],
  CNN:DT["src-cnn"], CBOE:DT["src-cboe"], Zillow:DT["src-zillow"], Manual:DT["src-manual"], "Rule-based":DT["src-manual"],
  CACHED:DT["cached"],
};
const DataModeBadge = ({ mode }) => {
  const cfg = {
    MOCK:    { label:"MOCK",    bg:"#1a1f2e", color:T.textMuted,         border:`1px solid ${T.border}` },
    LOADING: { label:"↻ LOADING", bg:"#1a140a", color:T.amber,           border:`1px solid ${T.amber}44` },
    LIVE:    { label:"LIVE",    bg:"#0a1e24", color:DT["live-cyan-700"], border:`1px solid ${DT["live-cyan-700"]}66` },
    STALE:   { label:"⏱ STALE", bg:"#1a140a", color:T.amber,            border:`1px solid ${T.amber}44` },
    CACHED:  { label:"CACHED",  bg:"#18181b", color:DT["cached"],        border:`1px dashed ${DT["cached"]}` },  // FEAT-167
  }[mode] || { label:mode, bg:T.surface, color:T.textMuted, border:`1px solid ${T.border}` };
  return (
    <span style={{background:cfg.bg, color:cfg.color, border:cfg.border, borderRadius:3, padding:"1px 6px", fontSize:9, fontFamily:T.fontMono, letterSpacing:"0.04em"}}>{cfg.label}</span>
  );
};
const SourceBox = ({ api, endpoint, asOf, mode }) => (
  <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:6, flexWrap:"wrap" }}>
    {mode && <DataModeBadge mode={mode}/>}
    <span style={{ background:(apiColors[api]||T.border)+"22", color:apiColors[api]||T.textMuted, border:`1px solid ${(apiColors[api]||T.border)}44`, borderRadius:3, padding:"1px 5px", fontSize:9, fontFamily:T.fontMono, flexShrink:0 }}>{api}</span>
    <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{endpoint}</span>
    {asOf && <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, flexShrink:0 }}>{asOf}</span>}
  </div>
);

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
    putCall:{ current:0.74, series30d:[0.82,0.79,0.76,0.81,0.78,0.74,0.72,0.71,0.69,0.72,0.75,0.78,0.74,0.71,0.69,0.68,0.70,0.73,0.75,0.72,0.70,0.68,0.70,0.73,0.76,0.74,0.72,0.73,0.75,0.74] },
  },
  crossAsset:{
    treasury10y:{ current:4.32, d1:+0.08, w1:+0.12, m1:-0.15, yellowBand:0.10, series:[4.52,4.48,4.41,4.35,4.29,4.22,4.18,4.24,4.28,4.32] },
    wti:{         current:68.42, d1pct:-0.8, w1pct:-2.1, m1pct:+3.2, yellowBand:1.0, series:[64,65,66,67,69,70,69,68,69,68] },
    gold:{        current:3318,  d1pct:+0.3, w1pct:+1.8, m1pct:+5.2, yellowBand:1.0, series:[3050,3100,3150,3200,3220,3280,3300,3310,3315,3318] },
    btc:{         current:109200,d1pct:+1.2, w1pct:+4.8, m1pct:+12.1,yellowBand:2.0, series:[88000,90000,92000,95000,98000,100000,104000,106000,108000,109200] },
  },
  macro:{
    fedFunds:{ rate:3.625, nextFOMC:"2026-06-17", daysUntil:14, odds:{ hold:84, cut:13, hike:3 } }, // odds: Kalshi FOMC market (mock; live Kalshi wiring TODO)
    cpi:{ headline:3.8, core:2.8, nextRelease:"2026-06-11", trend:[3.2,3.4,3.5,3.6,3.7,3.8] },
    pce:{ headline:3.1, core:2.9, nextRelease:"2026-06-26", trend:[2.6,2.7,2.8,2.9,3.0,3.1] }, // Fed's preferred inflation gauge (FRED PCEPI/PCEPILFE — mock until YoY wired)
    unemployment:{ national:4.3, entryLevel:6.1, lfpr:62.4, trend:[3.8,3.9,4.0,4.1,4.2,4.3] },
    mortgage:{ national:6.51, peoria:6.31 },
    credit:{ hy:3.85, ig:0.92, spread:2.93, spreadD1:+0.04,
             series:[2.80,2.78,2.82,2.85,2.88,2.84,2.87,2.90,2.91,2.93] },
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
  // FEAT-164: 9-row Mag 10 with FCF + merged CapEx; EV/EBITDA computed
  mag10:[
    { ticker:"NVDA",  color:"#f0a500", isPrivate:false, isMusk:false,
      price:134.72, chgPct:+3.4, mktCapT:5.32,
      ttmPe:52.1, fwdPe:29.4,
      q1RevB:44.1, q1Label:"Q1 FY27", fwdRevB:195, yoyRevGrowth:+69.2,
      netMarginPct:55.9, fcfTtmB:48.0, fcfMarginPct:32.4,
      capex26B:3.0, capex27B:5.0,
      aiRevNote:"Data center rev: $39.1B Q1 FY27 (+427% vs Q1 FY25)" },
    { ticker:"GOOGL", color:"#3498db", isPrivate:false, isMusk:false,
      price:178.34, chgPct:+0.6, mktCapT:4.68,
      ttmPe:24.8, fwdPe:21.2,
      q1RevB:90.2, q1Label:"Q1 2026", fwdRevB:430, yoyRevGrowth:+12.0,
      netMarginPct:28.6, fcfTtmB:62.0, fcfMarginPct:16.2,
      capex26B:75.0, capex27B:90.0 },
    { ticker:"AAPL",  color:"#9b59b6", isPrivate:false, isMusk:false,
      price:211.42, chgPct:+0.8, mktCapT:4.56,
      ttmPe:32.1, fwdPe:29.8,
      q1RevB:95.4, q1Label:"Q2 FY26", fwdRevB:412, yoyRevGrowth:+4.0,
      netMarginPct:26.4, fcfTtmB:94.0, fcfMarginPct:24.1,
      capex26B:14.0, capex27B:16.0 },
    { ticker:"MSFT",  color:"#2ecc71", isPrivate:false, isMusk:false,
      price:462.18, chgPct:+1.2, mktCapT:3.20,
      ttmPe:38.2, fwdPe:33.1,
      q1RevB:70.1, q1Label:"Q3 FY26", fwdRevB:298, yoyRevGrowth:+13.3,
      netMarginPct:35.8, fcfTtmB:72.0, fcfMarginPct:27.2,
      capex26B:80.0, capex27B:105.0 },
    { ticker:"AVGO",  color:"#06b6d4", isPrivate:false, isMusk:false,
      price:242.18, chgPct:+3.7, mktCapT:3.18,
      ttmPe:58.4, fwdPe:31.2,
      q1RevB:22.19, q1Label:"Q2 FY26", fwdRevB:87, yoyRevGrowth:+48.0,
      netMarginPct:41.9, fcfTtmB:10.26, fcfMarginPct:46.2,
      capex26B:1.0, capex27B:1.2,
      aiRevNote:"AI chip rev $10.8B Q2 (+143% YoY). CEO: >$100B AI in 2027" },
    { ticker:"AMZN",  color:"#f39c12", isPrivate:false, isMusk:false,
      price:224.61, chgPct:+1.8, mktCapT:2.38,
      ttmPe:42.1, fwdPe:32.8,
      q1RevB:187.8, q1Label:"Q1 2026", fwdRevB:710, yoyRevGrowth:+9.0,
      netMarginPct:9.7, fcfTtmB:38.0, fcfMarginPct:6.0,
      capex26B:100.0, capex27B:120.0 },
    { ticker:"META",  color:"#e74c3c", isPrivate:false, isMusk:false,
      price:618.42, chgPct:+2.1, mktCapT:1.57,
      ttmPe:28.4, fwdPe:23.1,
      q1RevB:42.3, q1Label:"Q1 2026", fwdRevB:220, yoyRevGrowth:+16.1,
      netMarginPct:37.8, fcfTtmB:45.0, fcfMarginPct:24.3,
      capex26B:64.0, capex27B:78.0 },
    { ticker:"PLTR",  color:"#8b5cf6", isPrivate:false, isMusk:false,
      price:158.23, chgPct:+1.4, mktCapT:0.36,
      ttmPe:null, ttmPeDisplay:"~340x", fwdPe:null, fwdPeDisplay:"~180x",
      q1RevB:1.633, q1Label:"Q1 2026", fwdRevB:7.66, yoyRevGrowth:+85.0,
      netMarginPct:53.3, fcfTtmB:3.2, fcfMarginPct:57.0,
      capex26B:0.07, capex27B:0.10,
      aiRevNote:"Rule of 40: 145%. US rev +104% YoY." },
    { ticker:"TSLA",  color:"#dc2626", isPrivate:false, isMusk:true,
      price:348.21, chgPct:-0.4, mktCapT:1.40,
      ttmPe:148.2, fwdPe:92.4,
      q1RevB:19.3, q1Label:"Q1 2026", fwdRevB:110, yoyRevGrowth:-9.2,
      netMarginPct:2.1, fcfTtmB:1.0, fcfMarginPct:5.2,
      capex26B:8.0, capex27B:10.0 },
    { ticker:"SPACEX", color:"#475569", isPrivate:true, isMusk:true,
      ipoValuationT:1.5,
      ttmPe:null, ttmPeDisplay:"N/A", fwdPe:null, fwdPeDisplay:"N/A",
      q1RevB:4.7, q1Label:"Q1 2026", fwdRevB:23, yoyRevGrowth:+33.0,
      netMarginPct:null, netMarginDisplay:"−26% GAAP",
      fcfTtmB:null, fcfDisplay:"−$9.1B FCF", ebitdaMarginPct:35.2,
      capex26B:40, capex27B:null, capex27Display:"N/A",
      sources:"S-1 filed May 20, 2026 (SEC)" },
  ],
  headwinds:[
    { id:1, name:"AI CapEx ROI Gap",    severity:"High", trend:"worsening", claim:"$705B FY26 capex vs $215B AI revenue. No hyperscaler can trace $X spent → $Y gained.", triggers:["AI rev <25% of CapEx","Hyperscaler guide-down"] },
    { id:2, name:"US Debt Service",     severity:"High", trend:"worsening", claim:"Interest payments ~18% of federal revenue. Crowding-out accelerating.", triggers:["10Y sustained >5%","Debt service >25% revenue"] },
    { id:3, name:"SPY Concentration",   severity:"Med",  trend:"stable",    claim:"Top-10 names = 38% of SPY weight. Near 2000 dot-com peak levels.", triggers:["Top-10 weight >42%"] },
    { id:4, name:"CRE / CMBS Stress",   severity:"Med",  trend:"stable",    claim:"CMBS delinquency 5.8%; office vacancy >20% in major metros.", triggers:["CMBS >8%","Bank NPL >4%"] },
    { id:5, name:"Labor Deceleration",  severity:"Low",  trend:"improving", claim:"Entry-level unemployment 6.1%; LFPR flat. Cooling without crashing.", triggers:["U-3 >5%","NFP <50K ×2"] },
  ],
  // fiveWhys: now computed at render time by computeFiveWhys() (src/fiveWhys.js) from live data.
  sessionDelta:{ alertsDelta:0, regimeDelta:"none", vixPct:-2.1, tenYBps:-4, spyPct:+0.29 },
};

// ─── REGIME VERDICT ENGINE (FEAT-163, rule-based for v1.6 mock) ────────────
function computeRegime(d) {
  let bullVotes=0, bearVotes=0;
  // 10Y direction: falling = bullish for equities
  if(d.crossAsset.treasury10y.m1 < -0.10) bullVotes++; else if(d.crossAsset.treasury10y.m1 > 0.15) bearVotes++;
  // VIX level
  if(d.marketPulse.vix.current < 18) bullVotes++; else if(d.marketPulse.vix.current > 25) bearVotes++;
  // F&G
  if(d.marketPulse.fearGreed.score > 55) bullVotes++; else if(d.marketPulse.fearGreed.score < 30) bearVotes++;
  // CPI trend (last 2 readings)
  const cpiTrend=d.macro.cpi.trend;
  if(cpiTrend[cpiTrend.length-1] < cpiTrend[cpiTrend.length-2]) bullVotes++;
  else if(cpiTrend[cpiTrend.length-1] - cpiTrend[0] > 0.5) bearVotes++;
  // Put/Call
  if(d.marketPulse.putCall.current < 0.75) bullVotes++; else if(d.marketPulse.putCall.current > 1.0) bearVotes++;
  // Valuation (Shiller CAPE) — contrarian: a stretched market is bearish for forward returns (FEAT-R1)
  const cape=d.macro.shillerPe;
  if(cape.current < cape.mean*1.5) bullVotes++; else if(cape.current > 30 || cape.pctOfAth > 90) bearVotes++;

  const bull = bullVotes >= 3;
  const bear = bearVotes >= 3;
  // FEAT-v17-07: hyphen separators (was middot) for RISK-ON / RISK-OFF legibility
  if(bull && !bear) return { label:"RISK-ON", sub:"Disinflation + low vol", tint:DT["regime-on-bg"], color:T.green, bullVotes, bearVotes };
  if(bear && !bull) return { label:"RISK-OFF", sub:"Rate pressure + stress", tint:DT["regime-off-bg"], color:T.red, bullVotes, bearVotes };
  return { label:"MIXED", sub:"Cross-signals — watch VIX", tint:DT["regime-mix-bg"], color:T.yellow, bullVotes, bearVotes };
}

// Shared 5-factor breakdown (used by RegimeBand · FEAT-169)
function regimeFactors(d) {
  return [
    {label:"10Y Direction",  val:d.crossAsset.treasury10y.m1<-0.10?"Falling ↓ (bullish)":"Flat/rising",  bull:d.crossAsset.treasury10y.m1<-0.10},
    {label:"VIX Level",      val:`${d.marketPulse.vix.current} — ${d.marketPulse.vix.current<18?"Low (bullish)":d.marketPulse.vix.current<25?"Elevated":"Spiking (bearish)"}`, bull:d.marketPulse.vix.current<18},
    {label:"Fear & Greed",   val:`${d.marketPulse.fearGreed.score} — ${d.marketPulse.fearGreed.label}`,   bull:d.marketPulse.fearGreed.score>55},
    {label:"CPI Trend",      val:d.macro.cpi.trend.slice(-1)[0]<d.macro.cpi.trend.slice(-2)[0]?"Cooling (bullish)":"Re-accelerating", bull:d.macro.cpi.trend.slice(-1)[0]<d.macro.cpi.trend.slice(-2)[0]},
    {label:"Put/Call Ratio", val:`${d.marketPulse.putCall.current} — ${d.marketPulse.putCall.current<0.75?"Bullish skew":"Neutral/bearish"}`, bull:d.marketPulse.putCall.current<0.75},
    {label:"Valuation",      val:`${d.macro.shillerPe.current} CAPE · ${d.macro.shillerPe.pctOfAth}% of ATH`, bull:d.macro.shillerPe.current<d.macro.shillerPe.mean*1.5},
  ];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
const fmt = {
  pct:(v,d=1)=>`${v>=0?"+":""}${v.toFixed(d)}%`,
  bps:(v)=>`${v>=0?"+":""}${(v*100).toFixed(0)}bps`,
  price:(v)=>v>=1000?`$${(v/1000).toFixed(1)}K`:`$${v.toFixed(2)}`,
};
const arrow=(v)=>v>0?"▲":v<0?"▼":"→";
const pctColor=(v,inv=false)=>(inv?v<0:v>0)?T.green:v===0?T.textSecondary:T.red;
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

// Stoplight color for direction tiles
function stoplightColor(val, band, invert=false) {
  if(Math.abs(val) <= band) return "yellow";
  const up = val > band;
  return (invert ? !up : up) ? T.green : T.red;
}
function verdictFromTones(tones) {
  const g=tones.filter(t=>t===T.green).length;
  const r=tones.filter(t=>t===T.red).length;
  if(g>=2) return { label:"BULLISH", color:T.green };
  if(r>=2) return { label:"BEARISH", color:T.red };
  return { label:"NEUTRAL", color:T.yellow };
}

// ─── PRIMITIVE COMPONENTS ─────────────────────────────────────────────────
const Badge=({label,color,small})=>(
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:3,padding:small?"0 4px":"1px 6px",fontSize:small?8:10,fontFamily:T.fontMono,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{label}</span>
);
const Label=({children,color})=>(
  <div style={{fontFamily:T.fontMono,fontSize:9,color:color||T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{children}</div>
);
const Divider=()=><div style={{height:1,background:T.border,margin:"10px 0"}}/>;
const SectionHeader=({children})=>(
  <div style={{fontFamily:T.fontMono,fontSize:9,color:DT["text-muted"],letterSpacing:"0.14em",textTransform:"uppercase",paddingBottom:6,marginBottom:10,borderBottom:`1px solid ${T.border}`}}>{children}</div>
);

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

// Direction tile (v1.3 stoplight)
const DirTile=({label,value,d1,w1,m1,band,invert=false,spark,source,sourceEp,mode="MOCK",asOf})=>{
  const tc=t=>t==="yellow"?T.yellow:t===T.green?T.green:T.red;
  const t1=stoplightColor(d1,band,invert), t2=stoplightColor(w1,band,invert), t3=stoplightColor(m1,band,invert);
  const verdict=verdictFromTones([t1,t2,t3]);
  return(
    <div style={{background:verdict.label==="BULLISH"?DT["regime-on-bg"]:verdict.label==="BEARISH"?DT["regime-off-bg"]:T.surface,border:`1px solid ${verdict.label==="BULLISH"?T.green+"44":verdict.label==="BEARISH"?T.red+"44":T.border}`,borderRadius:5,padding:"10px 12px",flex:"1 1 110px",minWidth:110}}>
      <Label>{label}</Label>
      <div style={{fontFamily:T.fontMono,fontSize:16,color:T.textPrimary,fontWeight:700,marginBottom:4}}>{value}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,marginBottom:5}}>
        {[["1D",d1,t1],["1W",w1,t2],["1M",m1,t3]].map(([p,v,t])=>(
          <div key={p}><div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{p}</div>
          <div style={{fontFamily:T.fontMono,fontSize:10,color:tc(t)}}>{arrow(v)} {Math.abs(v).toFixed(Math.abs(v)<1?1:2)}</div></div>
        ))}
      </div>
      <Badge label={verdict.label} color={verdict.color} small/>
      {spark&&<div style={{height:20,marginTop:5}}><ResponsiveContainer width="100%" height="100%"><LineChart data={spark.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1}/></LineChart></ResponsiveContainer></div>}
      {source&&<SourceBox api={source} endpoint={sourceEp||""} mode={mode} asOf={asOf}/>}
    </div>
  );
};

// ─── WEN MOON METER (mood badge for Macro Strip) ─────────────────────────
const WEN_MOON_STATES = [
  { label: "MOONING 🚀",       color: T.green, glow: T.green },
  { label: "HODL 💎",          color: T.amber, glow: T.amber },
  { label: "DIAMOND HANDS 🙌", color: T.red,   glow: T.red },
];
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
      title={IS_DEV ? "Click to cycle mood (dev only)" : undefined}
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
const IpoCard = ({ ipo }) => {
  const countdown = useCountdown(ipo.ipoDate, ipo.isExact);
  const approx = ipo.isExact ? null : approxCountdown(ipo.ipoDate);
  // Post-IPO: exact-date companies flip to TRADING state once countdown expires
  const isTrading = ipo.isExact && countdown.expired;
  const effectiveStageIndex = isTrading ? IPO_STAGES.length - 1 : ipo.stageIndex;
  const effectiveProgress = isTrading ? 100 : ipo.progressPct;
  const effectiveStage = isTrading ? "TRADING" : ipo.stage;
  return (
    <div style={{
      flex:"1 1 200px", minWidth:200,
      background: isTrading ? T.greenDim : T.surface,
      border: `1px solid ${isTrading ? T.green : ipo.color}44`,
      borderRadius: 6,
      padding: "12px 14px",
      display:"flex", flexDirection:"column", gap:8,
    }}>
      {/* Company header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:ipo.color, boxShadow:`0 0 6px ${ipo.color}88` }}/>
          <span style={{ fontFamily:T.fontDisplay, fontSize:14, fontWeight:700, color:T.textPrimary }}>{ipo.name}</span>
        </div>
        <span style={{ fontFamily:T.fontMono, fontSize:9, color:ipo.color, letterSpacing:"0.06em" }}>{ipo.ticker}</span>
      </div>

      {/* Countdown or TRADING state */}
      <div style={{ fontFamily:T.fontMono, fontWeight:700, letterSpacing:"0.04em", textAlign:"center" }}>
        {isTrading ? (
          <div>
            <div style={{ fontSize:18, color:T.green }}>TRADING 🎉</div>
            <div style={{ fontSize:9, color:T.textSecondary, fontWeight:400, marginTop:2 }}>Day-1 performance: awaiting data</div>
          </div>
        ) : ipo.isExact ? (
          <span style={{ fontSize:18, color:T.textPrimary }}>{countdown.text}</span>
        ) : (
          <span style={{ fontSize:16, color:T.textSecondary }}>{approx}</span>
        )}
      </div>

      {/* Stage pipeline dots */}
      <div style={{ display:"flex", alignItems:"center", gap:0, justifyContent:"center" }}>
        {IPO_STAGES.map((st, i) => {
          const active = i <= effectiveStageIndex;
          const isCurrent = i === effectiveStageIndex;
          return (
            <div key={st} style={{ display:"flex", alignItems:"center" }}>
              <div style={{
                width: isCurrent ? 10 : 7, height: isCurrent ? 10 : 7,
                borderRadius: "50%",
                background: active ? (isTrading ? T.green : ipo.color) : T.border,
                boxShadow: isCurrent ? `0 0 6px ${isTrading ? T.green : ipo.color}` : "none",
                transition: "all 0.3s",
              }}/>
              {i < IPO_STAGES.length - 1 && (
                <div style={{ width:20, height:2, background: i < effectiveStageIndex ? (isTrading ? T.green+"88" : ipo.color+"88") : T.border }}/>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontFamily:T.fontMono, fontSize:7, color:T.textMuted }}>
        {IPO_STAGES.map(st => <span key={st}>{st}</span>)}
      </div>

      {/* Stage label */}
      <div style={{ fontFamily:T.fontMono, fontSize:9, color:isTrading ? T.green : ipo.color, textAlign:"center", letterSpacing:"0.06em" }}>
        {effectiveStage}
      </div>

      {/* Progress bar */}
      <div style={{ height:4, background:T.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${effectiveProgress}%`, height:"100%", background:isTrading ? T.green : ipo.color, borderRadius:2, transition:"width 0.5s" }}/>
      </div>

      {/* Valuation & price */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <span style={{ fontFamily:T.fontMono, fontSize:11, color:T.textPrimary, fontWeight:700 }}>{ipo.valuation}</span>
        {ipo.pricePerShare && <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.textSecondary }}>{ipo.pricePerShare}/share</span>}
      </div>
    </div>
  );
};
const IpoCountdownStrip = () => (
  <div style={{
    background: T.bg,
    borderBottom: `1px solid ${T.border}`,
    padding: "10px 20px",
  }}>
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
      <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, letterSpacing:"0.12em", textTransform:"uppercase" }}>
        COUNTDOWN TO LAUNCH — IPO TRACKER
      </div>
      {/* Honest provenance: these IPO dates are curated estimates, not live data */}
      <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, border:`1px dashed ${T.border}`, borderRadius:3, padding:"0 5px", whiteSpace:"nowrap" }}>MOCK · curated · dates speculative</span>
    </div>
    <div style={{ display:"flex", gap:12, overflowX:"auto" }} className="ipo-strip-inner">
      {IPO_TARGETS.map(ipo => <IpoCard key={ipo.ticker} ipo={ipo}/>)}
    </div>
  </div>
);

// ─── FEAT-169 · REGIME VERDICT BAND (full-width, relocated under macro strip) ──
// The friend-readable headline ("wen moon?") — first signal
// seen on mobile (above the command grid) and prominent on desktop. Soft regime tint
// per AS2-01. Reuses computeRegime + regimeFactors.
const RegimeBand=({d})=>{
  const [open,setOpen]=useState(false);
  const regime=computeRegime(d);
  const factors=regimeFactors(d);
  const bulls=factors.filter(f=>f.bull).length;
  // "wen moon?" — map the regime verdict to our moon ratings: RISK-ON→MOONING, MIXED→HODL, RISK-OFF→DIAMOND HANDS
  const moon=WEN_MOON_STATES[{ "RISK-ON":0, "MIXED":1, "RISK-OFF":2 }[regime.label] ?? 1];
  return(
    <div style={{background:regime.tint,borderBottom:`1px solid ${regime.color}33`,borderTop:`1px solid ${regime.color}22`,padding:"10px 20px",position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        {/* Left: label + sub */}
        <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap",minWidth:0}}>
          <div>
            <div style={{fontFamily:T.fontMono,fontSize:8,color:regime.color,letterSpacing:"0.14em",textTransform:"uppercase"}}>Macro Regime · wen moon?</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:T.fontMono,fontSize:22,fontWeight:700,color:regime.color,letterSpacing:"-0.01em"}}>{moon.label}</span>
              <span style={{fontFamily:T.fontMono,fontSize:10,color:T.textSecondary}}>{regime.label} · {regime.sub}</span>
              <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>{bulls}/6 bullish · {regime.bullVotes} vote{regime.bullVotes===1?"":"s"} bull / {regime.bearVotes} bear</span>
            </div>
          </div>
        </div>
        {/* Right: factor chips (desktop) + info toggle */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* FINDING-2: compact factor "why" — now always visible (mobile too), short labels; full detail via ℹ */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {factors.map((f,i)=>(
              <span key={f.label} style={{fontFamily:T.fontMono,fontSize:8,color:f.bull?T.green:T.red,border:`1px solid ${f.bull?T.green:T.red}44`,borderRadius:3,padding:"1px 5px",letterSpacing:"0.03em",background:"#00000022",whiteSpace:"nowrap"}}>
                {["10Y","VIX","F&G","CPI","P/C","VAL"][i]} {f.bull?"▲":"▼"}
              </span>
            ))}
          </div>
          <button onClick={()=>setOpen(o=>!o)} aria-label="Show regime factors" aria-expanded={open}
            style={{background:"none",border:`1px solid ${regime.color}44`,borderRadius:3,color:regime.color,cursor:"pointer",padding:"4px 8px",minWidth:44,minHeight:44,fontFamily:T.fontMono,fontSize:11,flexShrink:0}}>
            {open?"▲":"ℹ"}
          </button>
        </div>
      </div>
      {/* Expandable plain-language breakdown */}
      {open&&(
        <div style={{marginTop:10,borderTop:`1px solid ${T.border}`,paddingTop:8,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"4px 18px"}}>
          {factors.map(f=>(
            <div key={f.label} style={{display:"flex",gap:8,alignItems:"baseline"}}>
              <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted,minWidth:100,flexShrink:0}}>{f.label}</div>
              <div style={{fontFamily:T.fontMono,fontSize:9,color:f.bull?T.green:T.red}}>{f.val}</div>
            </div>
          ))}
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,gridColumn:"1/-1"}}>Rule-based 5-factor vote · derived from live data</div>
        </div>
      )}
    </div>
  );
};

// Fear & Greed gauge
const FGGauge=({score,label,mode="MOCK",asOf})=>{
  const pct=score/100;
  const color=score<25?T.red:score<45?T.yellow:score<55?T.textSecondary:score<75?T.green:"#27ae60";
  const angle=-135+pct*270;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px",textAlign:"center"}}>
      <Label>Fear & Greed</Label>
      <div style={{position:"relative",width:80,height:48,margin:"4px auto 0"}}>
        <svg viewBox="0 0 80 48" style={{width:"100%",height:"100%"}}>
          <path d="M8,44 A36,36 0 0,1 72,44" fill="none" stroke={T.border} strokeWidth={6} strokeLinecap="round"/>
          <path d="M8,44 A36,36 0 0,1 72,44" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${pct*113} 113`}/>
          <line x1="40" y1="44" x2={40+30*Math.cos((angle-90)*Math.PI/180)} y2={44+30*Math.sin((angle-90)*Math.PI/180)} stroke={T.textSecondary} strokeWidth={1.5} strokeLinecap="round"/>
          <circle cx="40" cy="44" r="3" fill={T.textSecondary}/>
        </svg>
      </div>
      <div style={{fontFamily:T.fontMono,fontSize:20,color,fontWeight:700}}>{score}</div>
      <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>{label}</div>
      <SourceBox api="CNN" endpoint="fear-and-greed-index" mode={mode} asOf={asOf}/>
    </div>
  );
};

// Mag 10 Card (FEAT-164: 9 rows, FCF + merged CapEx)
const Mag10Card=({s})=>{
  const ip=s.isPrivate;
  const rows=[
    {lbl:"MKT CAP", val:ip?`~$${s.ipoValuationT}T IPO`:`$${s.mktCapT?.toFixed(2)}T`, color:T.textPrimary},
    {lbl:"TTM P/E",  val:s.ttmPe===null?(s.ttmPeDisplay||"—"):`${s.ttmPe}x`, color:s.ttmPe===null?T.yellow:peColor(s.ttmPe)},
    {lbl:"FWD P/E",  val:s.fwdPe===null?(s.fwdPeDisplay||"—"):`${s.fwdPe}x`, color:s.fwdPe===null?T.textMuted:peColor(s.fwdPe)},
    {lbl:s.q1Label,  val:`$${s.q1RevB?.toFixed(2)}B`, color:T.textPrimary},
    {lbl:"FWD REV",  val:`$${s.fwdRevB}B`, color:T.textSecondary},
    {lbl:"YoY REV",  val:`${s.yoyRevGrowth>=0?"+":""}${s.yoyRevGrowth?.toFixed(1)}%`, color:yoyColor(s.yoyRevGrowth)},
    {lbl:"NET MGN",  val:s.netMarginPct===null?(s.netMarginDisplay||"—"):`${s.netMarginPct?.toFixed(1)}%`, color:marginColor(s.netMarginPct)},
    {lbl:"FCF+MGN",  val:s.fcfTtmB===null?(s.fcfDisplay||"—"):`$${s.fcfTtmB?.toFixed(1)}B / ${s.fcfMarginPct?.toFixed(0)}%`, color:marginColor(s.fcfMarginPct)},
    {lbl:"CAPEX",    val:s.capex26B===null?"—":`${s.capex26B}B/${s.capex27B===null?(s.capex27Display||"N/A"):s.capex27B+"B"}`, color:T.textMuted},
  ];
  return(
    <div style={{background:ip?"#0a0d12":T.surface,border:`1px solid ${ip?"#1e3a5f":T.border}`,borderRadius:5,padding:"10px 10px",minWidth:112,flex:"1 1 112px",position:"relative"}}>
      {ip&&<span style={{position:"absolute",top:4,right:4,background:"#0d1f3c",color:"#60a5fa",border:"1px solid #1d4ed8",borderRadius:2,padding:"0 4px",fontSize:7,fontFamily:T.fontMono}}>S-1</span>}
      <div style={{marginBottom:7,paddingBottom:7,borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontFamily:T.fontMono,fontSize:13,fontWeight:700,color:s.color}}>{s.ticker}</div>
        {!ip&&<div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>${s.price}</span>
          <span style={{fontFamily:T.fontMono,fontSize:9,color:s.chgPct>=0?T.green:T.red}}>{s.chgPct>=0?"+":""}{s.chgPct}%</span>
        </div>}
        {ip&&<div style={{fontFamily:T.fontMono,fontSize:8,color:"#3b82f6"}}>IPO target ~${s.ipoValuationT}T</div>}
      </div>
      {rows.map(({lbl,val,color})=>(
        <div key={lbl} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"2px 0",borderBottom:`1px solid ${T.border}18`}}>
          <span style={{fontFamily:T.fontMono,fontSize:7,color:T.textMuted,letterSpacing:"0.03em"}}>{lbl}</span>
          <span style={{fontFamily:T.fontMono,fontSize:10,fontWeight:700,color}}>{val}</span>
        </div>
      ))}
      {s.aiRevNote&&<div style={{fontFamily:T.fontMono,fontSize:7,color:"#06b6d4",marginTop:4,lineHeight:1.4}}>{s.aiRevNote}</div>}
    </div>
  );
};

// Alert row
const AlertRow=({alert,onToggle,onDelete})=>{
  const color=alert.triggered?T.red:alert.active?T.green:T.textMuted;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:T.surface,borderRadius:4,border:`1px solid ${T.border}`}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,boxShadow:alert.active?`0 0 5px ${color}`:"none"}}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textPrimary}}>{alert.label}</div>
        <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>{alert.condition} {alert.value}{alert.unit}</div>
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
  {id:1,label:"SPY Below 200D MA",metric:"spy_200ma",condition:"below",value:692.4,unit:"$",active:true,triggered:false},
  {id:2,label:"VIX Spike",metric:"vix",condition:"above",value:25,unit:"",active:true,triggered:false},
  {id:3,label:"F&G Extreme Fear",metric:"feargreed",condition:"below",value:20,unit:"",active:true,triggered:false},
  {id:4,label:"10Y > 5%",metric:"treasury10y",condition:"above",value:5.0,unit:"%",active:true,triggered:false},
  {id:5,label:"CPI > 4%",metric:"cpi",condition:"above",value:4.0,unit:"%",active:false,triggered:false},
];

// ─── MAIN DASHBOARD (FEAT-161: Command Center spatial layout) ─────────────
// publicView prop (from App.jsx ?view=public / VITE_PUBLIC_VIEW) is now consumed.
// NOTE: this build has NO Zone E (401k / compound sim) — that lived only in the
// artifact fork. There is currently no private-only section to gate; the guard
// pattern below is wired and ready for when private content is added.
export default function Dashboard({ publicView = false } = {}) {
  const [alerts,setAlerts]=useState(DEFAULT_ALERTS);
  const [expandedHW,setExpandedHW]=useState(null);
  const [mag10open,setMag10open]=useState(true);
  const [watchlistOpen,setWatchlistOpen]=useState(true);
  const [copied,setCopied]=useState(false);
  const { toasts, show:showToast, dismiss } = useUndoToast();
  // FEAT-204 wiring — single-point hook swap; mock stays default, operator flips live post-deploy
  const { data: DATA, mode, asOf, provenance, dataAsOf } = useMarketData(MOCK_DATA, { publicView });
  const d=DATA;
  const regime=computeRegime(d);
  const modeOf=(k)=>{const m=provenance?.[k]||"MOCK"; return (m==="LIVE"||m==="CACHED")&&isStale(dataAsOf?.[k])?"STALE":m;}; // FEAT-R3: LIVE | CACHED | STALE | MOCK
  const asOfOf=(k)=>{const s=dataAsOf?.[k]; if(!s)return undefined; const dt=new Date(s+"T00:00:00"); return isNaN(dt.getTime())?s:`as of ${dt.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;}; // FEAT-R2: "as of Jun 4"
  const fw=computeFiveWhys(d, regime);        // v2.5: rule-based 5 Whys from live data
  const activeAlerts=alerts.filter(a=>a.active&&a.triggered).length;

  // FEAT-165: Share button
  const handleShare=()=>{
    navigator.clipboard?.writeText(window.location.href).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
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

  const pub=d.mag10.filter(s=>!s.isPrivate);
  const muskNames=d.mag10.filter(s=>s.isMusk);
  const totalMktCap=pub.reduce((a,s)=>a+s.mktCapT,0);

  return(
    <div style={{background:T.bg,minHeight:"100vh",fontFamily:T.fontSans,color:T.textPrimary}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;background:${T.bg};}
        ::-webkit-scrollbar-thumb{background:${T.borderAccent};border-radius:2px;}
        @media(max-width:1024px){.command-grid{display:block!important;}.zone-b{margin-top:16px!important;}}
        @media(max-width:640px){
          /* FEAT-170: macro strip reflows to 2 rows of 4 — all 8 signals visible, NO horizontal scroll */
          .macro-strip{overflow-x:visible!important;}
          .macro-strip-inner{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:10px 6px!important;min-width:0!important;}
          .macro-strip-inner>div{min-width:0!important;}
          .delta-bar-inner{flex-wrap:nowrap!important;overflow-x:auto!important;}
          .mag10-scroll{overflow-x:auto!important;}
          .dir-tiles{flex-wrap:wrap!important;}
          .hide-mobile{display:none!important;}
          /* IPO strip stays a horizontal swipeable row on mobile (not 3 stacked cards) */
          .wen-moon-mobile{display:none!important;}
        }
        .mag10-fade{-webkit-mask-image:linear-gradient(to right,black 85%,transparent 100%);mask-image:linear-gradient(to right,black 85%,transparent 100%);}
        @media(prefers-reduced-motion:reduce){.pulse-anim{animation:none!important;}}
      `}</style>

      <UndoToast toasts={toasts} dismiss={dismiss}/>

      {/* ── HEADER (FEAT-161, FEAT-165) ── */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"8px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontFamily:T.fontDisplay,fontSize:20,fontWeight:800,color:T.amber,letterSpacing:"-0.02em"}}>MacroDash</div>
          {/* FEAT-165: friendly sub-headline */}
          {/* FINDING-1: orientation line now visible on mobile (was hide-mobile) */}
          <div style={{fontFamily:T.fontSans,fontSize:10,color:T.textMuted}}>Macro intelligence for investors</div>
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:T.amber,boxShadow:`0 0 5px ${T.amber}`}} className="pulse-anim"/>
            <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>{d.session} · {d.lastRefresh}</span>
            {/* FINDING-4: set novice expectations — these are end-of-day, not real-time */}
            <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>· end-of-day, not real-time</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <DataModeBadge mode={mode}/>
          {activeAlerts>0&&<Badge label={`⚡ ${activeAlerts} FIRED`} color={T.red}/>}
          {/* FEAT-165: share button */}
          <button onClick={handleShare} aria-label="Copy dashboard link"
            style={{fontFamily:T.fontMono,fontSize:9,background:copied?"#1a3020":T.surfaceHigh,border:`1px solid ${copied?T.green:T.borderAccent}`,color:copied?T.green:T.textSecondary,padding:"5px 12px",borderRadius:4,cursor:"pointer",transition:"all 0.2s"}}>
            {copied?"✓ COPIED":"⤴ SHARE"}
          </button>
        </div>
      </div>

      {/* FEAT-169 + R4c: Regime Verdict band — HERO, now FIRST under the header (mobile-first) */}
      <RegimeBand d={d}/>

      {/* ── MACRO STRIP (persistent ticker — always visible; FEAT-170 reflows on mobile) ── */}
      <div style={{background:T.surfaceHigh,borderBottom:`1px solid ${T.border}`,padding:"6px 20px",overflowX:"auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}} className="macro-strip">
        <div style={{display:"flex",gap:20,minWidth:"max-content",flex:1}} className="macro-strip-inner">
          {[
            {l:"SPY",  v:`$${d.marketPulse.spy.price}`,      s:fmt.pct(d.marketPulse.spy.changePct), sc:pctColor(d.marketPulse.spy.changePct), t:"S&P 500 ETF — the broad US stock market"},
            {l:"QQQ",  v:`$${d.marketPulse.qqq.price}`,      s:fmt.pct(d.marketPulse.qqq.changePct), sc:pctColor(d.marketPulse.qqq.changePct), t:"Nasdaq-100 ETF — big tech"},
            {l:"VIX",  v:`${d.marketPulse.vix.current}`,     s:fmt.pct(d.marketPulse.vix.weekChg)+" WoW", sc:pctColor(d.marketPulse.vix.weekChg,true), t:"Volatility index — the market's fear gauge (lower = calmer)"},
            {l:"F&G",  v:`${d.marketPulse.fearGreed.score}`, s:d.marketPulse.fearGreed.label, sc:d.marketPulse.fearGreed.score>55?T.green:T.red, t:"Fear & Greed — market sentiment, 0 = fear, 100 = greed"},
            {l:"10Y",  v:`${d.crossAsset.treasury10y.current}%`, s:fmt.bps(d.crossAsset.treasury10y.d1)+" 1D", sc:pctColor(-d.crossAsset.treasury10y.d1), t:"10-year Treasury yield — the benchmark interest rate"},
            {l:"FED",  v:`${d.macro.fedFunds.rate}%`,        s:`FOMC ${d.macro.fedFunds.daysUntil}d`, sc:T.textMuted, t:"Fed funds rate — the central bank's policy rate"},
            {l:"CPI",  v:`${d.macro.cpi.headline}%`,         s:`Core ${d.macro.cpi.core}%`, sc:d.macro.cpi.headline>3?T.red:T.green, t:"Consumer Price Index — inflation, year-over-year"},
            {l:"P/C",  v:`${d.marketPulse.putCall.current}`, s:d.marketPulse.putCall.current>1?"BEAR SKEW":"NEUTRAL", sc:d.marketPulse.putCall.current>1?T.red:T.textSecondary, t:"Put/Call ratio — options positioning (above 1 = defensive)"},
          ].map(({l,v,s,sc,t})=>(
            <div key={l} title={t} style={{flexShrink:0,minWidth:68,cursor:"help"}}>
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{l}</div>
              <div style={{fontFamily:T.fontMono,fontSize:13,color:T.textPrimary,fontWeight:700,lineHeight:1.1}}>{v}</div>
              <div style={{fontFamily:T.fontMono,fontSize:9,color:sc}}>{s}</div>
            </div>
          ))}
        </div>
        {/* WEN MOON METER — mood badge based on SPY daily change (hidden on mobile to declutter the 2x4 strip, per the unused .wen-moon-mobile rule) */}
        <div className="wen-moon-mobile"><WenMoonBadge spyChangePct={d.marketPulse.spy.changePct}/></div>
      </div>

      {/* IPO COUNTDOWN TO LAUNCH — below regime band, above command center */}
      <IpoCountdownStrip/>

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

      {/* ── COMMAND CENTER GRID (FEAT-161: 60/40) ──
          FEAT-171 · ABOVE-FOLD CONTRACT (v1.7, DECISION-3 = YES):
            ABOVE FOLD @1280×800 → header + macro strip (all 8) + Regime Verdict band + SPY chart + YTD KPI tiles.
            BELOW FOLD (one scroll) → cross-asset tiles + full macro grid + headwinds + 5 Whys + Mag 10 + alerts.
            Maxim: "fit the content, don't squeeze the content." Zero-scroll abandoned as dishonest for a
            chart/gauge dashboard. Canonical contract owned by SRS §9/§12 (T1). */}
      <div style={{padding:"16px 20px"}}>
        <div className="command-grid" style={{display:"grid",gridTemplateColumns:"60fr 40fr",gap:16,alignItems:"start"}}>

          {/* ── ZONE A (left 60%) ── */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* A1: SPY Chart + MA cross */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <SectionHeader>Market Pulse</SectionHeader>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:6}}>
                <div>
                  <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textMuted}}>S&P 500 — 100D & 200D Moving Average</div>
                  <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                    <Badge label={`100D MA $${d.marketPulse.spy.ma100}`} color={T.blue} small/>
                    <Badge label={`200D MA $${d.marketPulse.spy.ma200}`} color={T.purple} small/>
                    <Badge label={goldenCross?"GOLDEN CROSS ✓":"DEATH CROSS ✗"} color={goldenCross?T.green:T.red} small/>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:T.fontMono,fontSize:22,color:T.textPrimary,fontWeight:700}}>${d.marketPulse.spy.price}</div>
                  <div style={{fontFamily:T.fontMono,fontSize:11,color:pctColor(d.marketPulse.spy.changePct)}}>{fmt.pct(d.marketPulse.spy.changePct)} today</div>
                  {/* FEAT-202: live S&P 500 index (FRED SP500) */}
                  <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>S&amp;P 500 index {d.marketPulse.spx.index.toLocaleString()}</div>
                </div>
              </div>
              <div style={{height:140}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spyData}>
                    <XAxis dataKey="date" hide/>
                    <YAxis domain={["auto","auto"]} tick={{fontSize:8,fill:T.textMuted}} width={38}/>
                    <Tooltip contentStyle={{background:T.surfaceHigh,border:`1px solid ${T.border}`,fontSize:10,fontFamily:T.fontMono}} formatter={(val)=>[`$${val.toFixed(2)}`,"Price"]}/>
                    <ReferenceLine y={d.marketPulse.spy.ma200} stroke={T.purple} strokeDasharray="4 2" strokeWidth={1}/>
                    <ReferenceLine y={d.marketPulse.spy.ma100} stroke={T.blue} strokeDasharray="4 2" strokeWidth={1}/>
                    <Line type="monotone" dataKey="price" stroke={T.amber} dot={false} strokeWidth={2}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <SourceBox api="FRED" endpoint="SP500 ÷10 proxy" mode={modeOf('spyPrice')} asOf={asOfOf('spyPrice')}/>
            </div>

            {/* A2-A5: KPI row */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[
                {l:"SPY YTD",  v:fmt.pct(d.marketPulse.spy.ytd),  c:pctColor(d.marketPulse.spy.ytd)},
                {l:"QQQ YTD",  v:fmt.pct(d.marketPulse.qqq.ytd),  c:pctColor(d.marketPulse.qqq.ytd)},
                {l:"SPY P/E",  v:`${d.marketPulse.spy.pe}x`, c:d.marketPulse.spy.pe>22?T.yellow:T.green, sub:d.marketPulse.spy.pe>22?"above avg":"below avg"},
              ].map(({l,v,c,sub})=>(
                <div key={l} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"8px 12px",flex:"1 1 90px"}}>
                  <Label>{l}</Label>
                  <div style={{fontFamily:T.fontMono,fontSize:18,color:c,fontWeight:700}}>{v}</div>
                  {sub&&<div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* A6-A9: Signal tiles — 2×2: equity fear (VIX | F&G) + multi-asset risk (P/C | Credit) */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {/* VIX */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px"}}>
                <Label>VIX</Label>
                <div style={{fontFamily:T.fontMono,fontSize:20,color:d.marketPulse.vix.current>25?T.red:d.marketPulse.vix.current>18?T.yellow:T.green,fontWeight:700}}>{d.marketPulse.vix.current}</div>
                <div style={{fontFamily:T.fontMono,fontSize:9,color:pctColor(d.marketPulse.vix.weekChg,true)}}>{fmt.pct(d.marketPulse.vix.weekChg)} WoW</div>
                <div style={{height:28,marginTop:6}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.marketPulse.vix.series.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/></LineChart></ResponsiveContainer></div>
                <SourceBox api="FRED" endpoint="VIXCLS" mode={modeOf('vix')} asOf={asOfOf('vix')}/>
              </div>
              {/* F&G */}
              <FGGauge score={d.marketPulse.fearGreed.score} label={d.marketPulse.fearGreed.label} mode={modeOf('fearGreed')} asOf={asOfOf('fearGreed')}/>
              {/* Put/Call */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px"}}>
                <Label>Put / Call</Label>
                <div style={{fontFamily:T.fontMono,fontSize:20,color:d.marketPulse.putCall.current>1?T.red:T.textPrimary,fontWeight:700}}>{d.marketPulse.putCall.current}</div>
                <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Bearish {">"} 1.0</div>
                <div style={{height:28,marginTop:6}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.marketPulse.putCall.series30d.slice(-10).map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/><ReferenceLine y={1.0} stroke={T.red} strokeDasharray="2 2" strokeWidth={1}/></LineChart></ResponsiveContainer></div>
                <SourceBox api="CBOE" endpoint="equity-put-call" mode={modeOf('putCall')} asOf={asOfOf('putCall')}/>
              </div>
              {/* HY-IG Credit Spread — widening is a bearish leading indicator for equities */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px"}}>
                <Label>HY–IG SPREAD</Label>
                <div style={{fontFamily:T.fontMono,fontSize:20,color:d.macro.credit.spread>5?T.red:d.macro.credit.spread>3.5?T.yellow:T.textPrimary,fontWeight:700}}>
                  {d.macro.credit.spread.toFixed(2)}<span style={{fontSize:11}}>pp</span>
                </div>
                <div style={{fontFamily:T.fontMono,fontSize:9,color:d.macro.credit.spreadD1>0?T.red:d.macro.credit.spreadD1<0?T.green:T.textMuted}}>
                  {d.macro.credit.spreadD1>0?"▲":d.macro.credit.spreadD1<0?"▼":"→"} {Math.abs(d.macro.credit.spreadD1).toFixed(2)}pp {d.macro.credit.spreadD1>0?"widening":d.macro.credit.spreadD1<0?"tightening":"unchanged"}
                </div>
                <div style={{height:28,marginTop:6}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.macro.credit.series.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={d.macro.credit.spreadD1>0?T.red:T.green} dot={false} strokeWidth={1.5}/></LineChart></ResponsiveContainer></div>
                <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:3}}>HY {d.macro.credit.hy.toFixed(2)}% · IG {d.macro.credit.ig.toFixed(2)}%</div>
                <SourceBox api="FRED" endpoint="ICE BofA OAS" mode={modeOf('creditSpread')} asOf={asOfOf('creditSpread')}/>
              </div>
            </div>

            {/* Cross-asset direction tiles */}
            <div>
              <SectionHeader>Cross-Asset Direction</SectionHeader>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}} className="dir-tiles">
                <DirTile label="10Y Treasury" value={`${d.crossAsset.treasury10y.current}%`} d1={d.crossAsset.treasury10y.d1} w1={d.crossAsset.treasury10y.w1} m1={d.crossAsset.treasury10y.m1} band={0.10} invert={true} spark={d.crossAsset.treasury10y.series} source="FRED" sourceEp="DGS10" mode={modeOf('tenYear')} asOf={asOfOf('tenYear')}/>
                <DirTile label="WTI Crude"   value={`$${d.crossAsset.wti.current}`}         d1={d.crossAsset.wti.d1pct}  w1={d.crossAsset.wti.w1pct}  m1={d.crossAsset.wti.m1pct}  band={1.0} spark={d.crossAsset.wti.series}  source="FRED" sourceEp="DCOILWTICO" mode={modeOf('wti')} asOf={asOfOf('wti')}/>
                <DirTile label="Gold"        value={`$${d.crossAsset.gold.current.toLocaleString()}`} d1={d.crossAsset.gold.d1pct} w1={d.crossAsset.gold.w1pct} m1={d.crossAsset.gold.m1pct} band={1.0} spark={d.crossAsset.gold.series} source="Manual" sourceEp="curated series" mode={modeOf('gold')}/>
                <DirTile label="Bitcoin"     value={`$${(d.crossAsset.btc.current/1000).toFixed(1)}K`} d1={d.crossAsset.btc.d1pct} w1={d.crossAsset.btc.w1pct} m1={d.crossAsset.btc.m1pct} band={2.0} spark={d.crossAsset.btc.series} source="FRED" sourceEp="CBBTCUSD" mode={modeOf('btc')} asOf={asOfOf('btc')}/>
              </div>
            </div>
          </div>

          {/* ── ZONE B (right 40%) ── */}
          <div className="zone-b" style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* FEAT-169: RegimeTile relocated to full-width RegimeBand under macro strip (was here). */}

            {/* Macro Regime grid */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <SectionHeader>Macro Regime</SectionHeader>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Fed */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div>
                    <Label>Fed Funds Rate</Label>
                    <div style={{fontFamily:T.fontMono,fontSize:22,color:T.amber,fontWeight:700}}>{d.macro.fedFunds.rate}%</div>
                    <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Next FOMC in {d.macro.fedFunds.daysUntil} days</div>
                    {/* Next-FOMC decision odds (Kalshi prediction market) */}
                    <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"baseline"}}>
                      <span style={{fontFamily:T.fontMono,fontSize:7,color:T.textMuted,letterSpacing:"0.08em"}}>NEXT-MTG</span>
                      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Hold {d.macro.fedFunds.odds.hold}%</span>
                      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.green}}>Cut {d.macro.fedFunds.odds.cut}%</span>
                      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.red}}>Hike {d.macro.fedFunds.odds.hike}%</span>
                      <span style={{fontFamily:T.fontMono,fontSize:7,color:T.textMuted,border:`1px dashed ${T.border}`,borderRadius:2,padding:"0 3px"}}>Kalshi · {modeOf('rateOddsHold').toLowerCase()}</span>
                    </div>
                  </div>
                  <SourceBox api="FRED" endpoint="FEDFUNDS · odds: Kalshi" mode={modeOf('fedFunds')} asOf={asOfOf('fedFunds')}/>
                </div>
                {/* CPI */}
                <div style={{paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginBottom:4,letterSpacing:"0.1em"}}>INFLATION · FED TARGETS CORE PCE</div>
                  <div style={{display:"flex",gap:14,marginBottom:5,flexWrap:"wrap"}}>
                    <div><Label>PCE Core</Label><div style={{fontFamily:T.fontMono,fontSize:18,color:d.macro.pce.core>2.5?T.yellow:T.green,fontWeight:700}}>{d.macro.pce.core}%</div></div>
                    <div><Label>PCE Head</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textSecondary,fontWeight:700}}>{d.macro.pce.headline}%</div></div>
                    <div><Label>CPI Head</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textSecondary,fontWeight:700}}>{d.macro.cpi.headline}%</div></div>
                    <div><Label>CPI Core</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textSecondary,fontWeight:700}}>{d.macro.cpi.core}%</div></div>
                  </div>
                  <div style={{height:36}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.macro.cpi.trend.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={T.red} dot={false} strokeWidth={1.5}/><ReferenceLine y={2.0} stroke={T.green} strokeDasharray="3 2" strokeWidth={1}/></LineChart></ResponsiveContainer></div>
                  <SourceBox api="FRED" endpoint="CPIAUCSL + CPILFESL" mode={modeOf('cpiHeadline')}/>
                </div>
                {/* Labor */}
                <div style={{display:"flex",gap:12,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div><Label>Unemployment</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textPrimary,fontWeight:700}}>{d.macro.unemployment.national}%</div></div>
                  <div><Label>Entry Level</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.yellow,fontWeight:700}}>{d.macro.unemployment.entryLevel}%</div></div>
                  <div><Label>LFPR</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textPrimary,fontWeight:700}}>{d.macro.unemployment.lfpr}%</div></div>
                </div>
                {/* Housing */}
                <div style={{display:"flex",gap:12,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div><Label>30Y Mortgage</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.red,fontWeight:700}}>{d.macro.mortgage.national}%</div></div>
                  <div><Label>Peoria IL</Label><div style={{fontFamily:T.fontMono,fontSize:14,color:T.yellow,fontWeight:700}}>{d.macro.mortgage.peoria}%</div><div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>${d.macro.housing.peoria.toLocaleString()}</div></div>
                </div>
                {/* Shiller PE */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <Label>Shiller P/E (CAPE)</Label>
                    <Badge label={d.macro.shillerPe.current>40?"BUBBLE":"ELEVATED"} color={d.macro.shillerPe.current>40?"#7f1d1d":T.red} small/>
                  </div>
                  <div style={{fontFamily:T.fontMono,fontSize:22,color:"#ef4444",fontWeight:700}}>{d.macro.shillerPe.current}</div>
                  <div style={{display:"flex",gap:12,marginTop:2}}>
                    <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Mean {d.macro.shillerPe.mean} · Median {d.macro.shillerPe.median}</div>
                    <div style={{fontFamily:T.fontMono,fontSize:8,color:T.red}}>{d.macro.shillerPe.pctOfAth}% of ATH</div>
                  </div>
                  <SourceBox api="Manual" endpoint="Robert Shiller · Yale data" mode={modeOf('shillerPe')}/>
                </div>
              </div>
            </div>

            {/* Top headwinds (compact) */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <SectionHeader>Top Headwinds</SectionHeader>
              {d.headwinds.slice(0,3).map(hw=>{
                const sevColor=hw.severity==="High"?T.red:hw.severity==="Med"?T.yellow:T.green;
                const isExp=expandedHW===hw.id;
                return(
                  <div key={hw.id} style={{borderBottom:`1px solid ${T.border}`,paddingBottom:8,marginBottom:8,cursor:"pointer"}} onClick={()=>setExpandedHW(isExp?null:hw.id)}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                      <Badge label={hw.severity} color={sevColor} small/>
                      <Badge label={hw.trend} color={hw.trend==="worsening"?T.red:hw.trend==="improving"?T.green:T.yellow} small/>
                      <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textPrimary,flex:1}}>{hw.name}</div>
                      <span style={{color:T.textMuted,fontSize:10}}>{isExp?"▲":"▼"}</span>
                    </div>
                    {isExp&&<div style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary,marginTop:4,lineHeight:1.6}}>{hw.claim}</div>}
                  </div>
                );
              })}
              <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>+ {d.headwinds.length-3} more headwinds tracked</div>
            </div>

            {/* 5 Whys headline */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <SectionHeader>5 Whys · Today</SectionHeader>
              <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,marginBottom:6}}>{fw.regime}</div>
              <div style={{fontFamily:T.fontSans,fontSize:12,color:T.textSecondary,lineHeight:1.6,fontStyle:"italic"}}>"{fw.headline}"</div>
              {fw.whys.map((w,i)=>(
                <div key={i} style={{borderLeft:`2px solid ${T.amber}44`,paddingLeft:8,marginTop:8}}>
                  <div style={{fontFamily:T.fontMono,fontSize:8,color:T.amber}}>WHY #{i+1}</div>
                  <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textSecondary,lineHeight:1.5}}>{w}</div>
                </div>
              ))}
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:8}}>Rule-based · derived from live data (no LLM)</div>
              <SourceBox api="Rule-based" endpoint="5-factor regime + live deltas" mode={modeOf('vix')} asOf={asOfOf('vix')}/>
            </div>
          </div>
        </div>

        {/* ── MAG 10 (full-width, collapsible) ── */}
        <div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
          <button onClick={()=>setMag10open(o=>!o)} aria-expanded={mag10open}
            style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"none",border:"none",cursor:"pointer",borderBottom:mag10open?`1px solid ${T.border}`:"none"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontFamily:T.fontMono,fontSize:10,color:T.amber,letterSpacing:"0.1em"}}>MAG 10</span>
              <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Ranked by market cap · Q1 2026 actuals · SEC verified</span>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontFamily:T.fontMono,fontSize:10,color:T.textMuted}}>{mag10open?"▲":"▼"}</span>
            </div>
          </button>
          {mag10open&&(
            <div style={{padding:"12px 16px 16px"}}>
              {/* Mag 8 (non-Musk public) */}
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.1em",marginBottom:8}}>PUBLIC · SORTED BY MKT CAP</div>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}} className="mag10-scroll mag10-fade">
                {d.mag10.filter(s=>!s.isMusk).sort((a,b)=>(b.mktCapT||0)-(a.mktCapT||0)).map(s=><Mag10Card key={s.ticker} s={s}/>)}
              </div>
              {/* Musk divider */}
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0 10px"}}>
                <div style={{height:1,flex:1,background:T.border}}/>
                <span style={{fontFamily:T.fontMono,fontSize:8,color:"#475569",whiteSpace:"nowrap",letterSpacing:"0.1em"}}>ELON MUSK VENTURES — DISTINCT ENTERPRISES</span>
                <div style={{height:1,flex:1,background:T.border}}/>
              </div>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}} className="mag10-scroll">
                {d.mag10.filter(s=>s.isMusk).map(s=><Mag10Card key={s.ticker} s={s}/>)}
                {/* SpaceX context panel */}
                <div style={{background:"#0a0d12",border:"1px solid #1e3a5f",borderRadius:5,padding:"10px 12px",minWidth:170,flex:"1 1 170px"}}>
                  <div style={{fontFamily:T.fontMono,fontSize:9,color:"#60a5fa",marginBottom:6}}>SPACEX S-1 CONTEXT</div>
                  {[
                    ["Starlink rev","$11.4B (FY25) · 10.3M subs"],
                    ["AI capex","$12.7B in 2025 (xAI acq.)"],
                    ["FCF","−$9.1B Q1 2026"],
                    ["IPO","S-1 May 2026 · mid-2026 target"],
                    ["API","Manual only (pre-IPO)"],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:"flex",gap:6,padding:"2px 0",borderBottom:`1px solid ${T.border}22`}}>
                      <div style={{fontFamily:T.fontMono,fontSize:7,color:"#334155",minWidth:56,flexShrink:0}}>{l}</div>
                      <div style={{fontFamily:T.fontMono,fontSize:8,color:"#475569"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Mkt cap treemap */}
              <div style={{marginTop:12}}>
                <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginBottom:4}}>RELATIVE MARKET CAP (public Mag 10, excl. SpaceX)</div>
                <div style={{display:"flex",height:20,borderRadius:3,overflow:"hidden",gap:1}}>
                  {pub.map(s=>(
                    <div key={s.ticker} style={{width:`${(s.mktCapT/totalMktCap*100).toFixed(1)}%`,background:s.color,display:"flex",alignItems:"center",justifyContent:"center",minWidth:2}}>
                      {s.mktCapT/totalMktCap>0.08&&<span style={{fontFamily:T.fontMono,fontSize:7,color:"#000",fontWeight:700}}>{s.ticker}</span>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap"}}>
                  {pub.map(s=><span key={s.ticker} style={{fontFamily:T.fontMono,fontSize:7,color:T.textMuted}}><span style={{color:s.color}}>■</span> {s.ticker} ${s.mktCapT.toFixed(2)}T</span>)}
                </div>
              </div>
              <SourceBox api="Manual" endpoint="curated · Q1 2026 actuals · SpaceX S-1 (SEC)" mode={modeOf('mag10')}/>
            </div>
          )}
        </div>

        {/* ── MY CONVICTION · S/A TIER (full-width, collapsible) ── */}
        <div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
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
        </div>

        {/* ── ALERTS STRIP (compact, at bottom) ── */}
        <div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <SectionHeader>Macro Alerts</SectionHeader>
            <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Triggers evaluate live data · notifications not wired</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:6}}>
            {alerts.map(a=><AlertRow key={a.id} alert={a} onToggle={id=>setAlerts(prev=>prev.map(x=>x.id===id?{...x,active:!x.active}:x))} onDelete={handleDeleteAlert}/>)}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{`MacroDash v${__APP_VERSION__} · Data refreshed daily · end-of-day sources`}</div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Not financial advice · Personal use</div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Live: FRED · CNN · CBOE · Curated: Shiller · Mag 10 · SEC S-1</div>
        </div>
      </div>
    </div>
  );
}
