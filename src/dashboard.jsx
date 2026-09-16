import { useState, useEffect, useMemo, useRef } from "react"; // Fragment left with MarketDetail (wave 9)
import { useMarketData } from "./useMarketData.js"; // FEAT-204 wiring
import { MOCK_DATA } from "./mockData.js"; // v6.5.5: the mock baseline, one home (was inline here)
import { computeFiveWhys } from "./fiveWhys.js"; // v2.5: rule-based 5 Whys ($0, derived from live data)
import { buildEvidenceSet, simpleVerdict, simpleCards, simpleFlipLine, factorExclusions, fieldMode, FACTOR_FIELD } from "./evidence.js"; // C1 (v3.60): the typed contract
import { holdReason, WHYS_FOLD_LABEL, ABOUT_FOLD_LABEL } from "./simpleFace.js"; // T1: Simple FACE registry
import { LASTVALID_KEY, summarizeEvidence, compareEvidence } from "./whatChanged.js"; // C4 (v3.60)
import { parseObsDate, nextFomcDate, etYmd } from "./sources.js"; // FEAT-R3: per-tile, cadence-aware staleness + shared market calendar; v3.99: curated FOMC calendar
import { computeMacroFlip } from "./ttReadout.js"; // FEAT-331: Macro Flip circuit
import { callFromEvidence, formatMacroCallPaste, formatMacroShareCard, callEdition } from "./macroCall.js"; // v5.5 frozen call + share card
import { evalAlert, DEFAULT_ALERTS, applyAlertPrefs, alertPrefsOf, ALERT_PREFS_KEY } from "./alertEngine.js"; // v6.5.5: FEAT-ALERT-EVAL definitions, one home; evaluation still runs HERE
import { closeReadLine } from "./closeRead.js"; // v6.2: the 6pm close read — ONE line builder, the ptModelRows rule
import { fmt, pctColor } from "./format.js"; // task 1.3/3.1: one shared copy
import RegimeBand, { WITHHELD_LABEL } from "./sections/RegimeBand.jsx"; // task 1.3: the verdict band + its vocabulary
import FiveWhys, { flipChipOf } from "./sections/FiveWhys.jsx"; // task 1.4: presentation only — computeFiveWhys stays here
import { DataModeBadge } from "./primitives/SourceBox.jsx"; // task 1.4 (SourceBox + SectionHeader render only inside sections now — v6.5.5 dead-import prune)
import CollapsedGroup from "./primitives/CollapsedGroup.jsx"; // task 5.1
import { isIllustrative } from "./primitives/Illustrative.jsx"; // task 5.1 (ILLUS_HATCH/IllustrativeChip render only inside sections — v6.5.5 dead-import prune)
import { Badge } from "./primitives/atoms.jsx"; // wave 9 (Label renders only inside sections — v6.5.5 dead-import prune)
import MarketDetail from "./sections/MarketDetail.jsx"; // task 5.2: presentation only
import MacroRegime from "./sections/MacroRegime.jsx"; // task 5.3: presentation only
import Headwinds from "./sections/Headwinds.jsx"; // task 5.4: presentation only
import AIUnitEconomics from "./sections/AIUnitEconomics.jsx"; // task 7.1: presentation only
import Alerts from "./sections/Alerts.jsx"; // task 7.2: evaluation stays here
import DataHealth from "./sections/DataHealth.jsx"; // task 7.3: presentation only
import Watchlist from "./sections/Watchlist.jsx"; // task 7.4: A4 gate stays at the call site
import TerminalDock from "./sections/TerminalDock.jsx"; // v4.1.7: the dock (Simple); fetch + nav stay here
import SimpleCards from "./sections/SimpleCards.jsx"; // v4.0: Simple parameter cards (presentation only)
import StockSpotlight from "./sections/StockSpotlight.jsx"; // v6.5.0: the NBIS × Established-growth widget (presentation only; fetch stays here)
import DriversMatrix from "./sections/DriversMatrix.jsx"; // v6.5.5: the C3 factor cards (presentation only; the !simple gate + landmark stay here)
import StickyNav from "./sections/StickyNav.jsx"; // task 9.2: viewport-tracked active state
import MacroStrip from "./sections/MacroStrip.jsx"; // task 3.1: presentation only
import SignalQuality from "./sections/SignalQuality.jsx"; // task 3.2: presentation only
import WhatChanged from "./sections/WhatChanged.jsx"; // task 3.3: presentation only
import { publicDashboardUrl, liveReadCaption, publicMarketClock, publicMarketClockLine, simpleCallLabel } from "./publicCopy.js";
import UndoToast, { useUndoToast } from "./primitives/UndoToast.jsx"; // v6.5.5: the toast stack, one home
import SpyTapeBadge from "./primitives/SpyTapeBadge.jsx"; // v6.5.5: TODAY/LAST SPY (Degen only; the call site gates it)
import { MacroFlipBanner, PanicOverrideBanner } from "./sections/CallBanners.jsx"; // v6.5.5: presentation only; the banner ladder stays here

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

// GPU_PRICING / TOKEN_EFFICIENCY / tokenScissors / HYPERSCALER_CAPEX moved to
// src/aiEcon.js (wave 12). LAUNCH_COST + EVTOL_CERT are DELETED, not moved — their
// consumer components (LaunchCostCard/EvtolCertCard) were removed in v3.69 and the
// constants rendered nowhere since (the Divider rule: dead data is a rot vector).

// ─── SOURCE BOX — extracted to src/primitives/SourceBox.jsx (task 1.4) ───────

// ─── ILLUSTRATIVE TREATMENT + COLLAPSED GROUP — extracted to src/primitives/
// (Illustrative.jsx + CollapsedGroup.jsx, task 5.1). One idiom, one home each.

// ─── DATA — MOCK_DATA extracted VERBATIM to src/mockData.js (v6.5.5, Zone 1 of the
// decomposition). Pure data, imported here and handed to useMarketData unchanged; smoke now
// IMPORTS it instead of slicing the orchestrator's source (docs/RISKS.md A4, owner decision).
// ─── REGIME ENGINE: extracted to src/regime.js (C1, v3.60) ────────────────
// The band table, verdictFrom, computeRegime, flipConditions, regimeFactors and the NFCI
// thresholds now live in the pure module so evidence.js and Node tests import them directly.
// This file resolves tintKey/colorKey to actual colors at the one place they render.

// Live ET market session for the 5-Whys narrative frame (mirrors marketSession() in
// snapshot.js). Computed client-side from the CURRENT clock so a reload at 2pm reads
// "Midday —" and after 4pm "Post-close —", instead of the value frozen into the daily
// snapshot at fetch time. Pure/$0 — no LLM, no network.
function etSession(now = new Date()) {
  const state = publicMarketClock(now).state;
  return state === "PRE" ? "PRE" : state === "OPEN" ? "OPEN" : "CLOSE";
}



// ─── HELPERS ─────────────────────────────────────────────────────────────
// fmt moved to src/format.js (task 1.3) — one copy, shared with extracted sections.
// arrow moved into src/primitives/DirTile.jsx (its only consumer, wave 9).
// pctColor moved to src/format.js (task 3.1) — one copy, shared with MacroStrip.
// peColor/marginColor/yoyColor DELETED (v6.5.5): their consumers (the Mag-10 fundamentals
// grid) were cut in v3.43 and the helpers rendered nowhere since — the Divider rule.

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

// UndoToast + useUndoToast extracted to src/primitives/UndoToast.jsx (v6.5.5, Zone 3).
// DirTile extracted to src/primitives/DirTile.jsx (wave 9).

// SpyTapeBadge extracted to src/primitives/SpyTapeBadge.jsx (v6.5.5, Zone 3).

// useCountdown/approxCountdown DELETED (v6.5.5): the IPO countdown strip they served was
// cut in v3.43 (component, data and state); the hook and helper had no consumer since.

// AI cards extracted to src/sections/AIUnitEconomics.jsx (wave 12).

// MacroFlipBanner + PanicOverrideBanner extracted to src/sections/CallBanners.jsx (v6.5.5, Zone 3).

// ─── FEAT-169 · REGIME VERDICT BAND ──────────────────────────────────────
// Extracted VERBATIM to src/sections/RegimeBand.jsx (UI-OVERHAUL task 1.3).

// FGGauge extracted to src/primitives/FGGauge.jsx (wave 9).

// ─── ALERT ENGINE — extracted VERBATIM to src/alertEngine.js (v6.5.5, Zone 2). The
// evaluation CALL, the alert state and its persistence stay below in Dashboard(). ───────

// ─── MAIN DASHBOARD (FEAT-161: Command Center spatial layout) ─────────────
// publicView prop (from App.jsx ?view=public / VITE_PUBLIC_VIEW) is now consumed.
// NOTE: this build has NO Zone E (401k / compound sim) — that lived only in the
// artifact fork. There is currently no private-only section to gate; the guard
// pattern below is wired and ready for when private content is added.
// Every SOURCES field that casts a regime vote (all six, CAPE's shillerPe alias included).
const VOTING_FIELDS=new Set(Object.values(FACTOR_FIELD));
const DEGEN_NOTICE_KEY="md:degen-notice:v1";

// SectionNav extracted to src/sections/StickyNav.jsx (wave 15, task 9.2) — the v3.62
// hash-only active state is SUPERSEDED by IntersectionObserver viewport tracking
// (Req 3.7); a click still wins instantly via the hash. Hamburger form at ≤320px.

export default function Dashboard({ publicView = false } = {}) {
  // v6.0 T4: lazy-init from the stored overlay; every change writes the overlay back.
  const [alerts,setAlerts]=useState(()=>{
    try{return applyAlertPrefs(DEFAULT_ALERTS,JSON.parse(localStorage.getItem(ALERT_PREFS_KEY)||"null"));}
    catch(_e){return DEFAULT_ALERTS;}
  });
  useEffect(()=>{
    try{localStorage.setItem(ALERT_PREFS_KEY,JSON.stringify(alertPrefsOf(DEFAULT_ALERTS,alerts)));}
    catch(_e){/* storage may be denied — the session still works, it just forgets */}
  },[alerts]);
  /* v3.94 SIMPLE/DEGEN (owner directive — three-layer progressive disclosure): SIMPLE is the
     default and shows the Glance layer only — the verdict + sentence + confidence, the data-
     freshness line, and the key market numbers. DEGEN is the full analytical view. Persisted
     per device (the localStorage precedent of md:lastvalid/tt:hz); an unknown stored value
     falls back to SIMPLE — the safe default is the readable one. Red facts ignore the mode:
     the ERROR banner, the FIRED/BLIND badges and the hero's crash-gauge warning render in
     BOTH (v3.25 — a mode switch must never hide a red fact). */
  const [viewMode,setViewModeRaw]=useState(()=>{
    try{return localStorage.getItem("md:view:v1")==="power"?"power":"simple";}catch(_e){return "simple";}
  });
  const setViewMode=(m)=>{setViewModeRaw(m);try{localStorage.setItem("md:view:v1",m);}catch(_e){/* private mode */}};
  const simple=viewMode==="simple";
  /* v6.0.1: the toggle's ONE table — id, the shape that leads its label, the word, and what
     the mode shows (rides the tooltip + accessible name, so "which one am I in, and what does
     the other one do" is answered before the tap). The compatibility id remains `power`; only
     the reader-facing name becomes Degen. */
  const VIEW_MODES=[
    {id:"simple",glyph:"○",word:"Simple",tells:"the call, three cards and the whys"},
    {id:"power", glyph:"◉",word:"Degen", tells:"the moon call, every section, signal evidence and tiles"},
  ];
  const [degenNoticeDismissed,setDegenNoticeDismissed]=useState(()=>{
    try{return localStorage.getItem(DEGEN_NOTICE_KEY)==="dismissed";}catch(_e){return false;}
  });
  const dismissDegenNotice=()=>{
    setDegenNoticeDismissed(true);
    try{localStorage.setItem(DEGEN_NOTICE_KEY,"dismissed");}catch(_e){/* private mode */}
  };
  const [copied,setCopied]=useState(false);
  const [ttCopied,setTtCopied]=useState(false); // v4.0: canonical daily-call copy state
  const [callShared,setCallShared]=useState(false); // v5.5: compact hero-adjacent posture card
  // Re-render every 10 min so the live 5-Whys session frame advances (pre-open→midday→
  // post-close) in an already-open tab without a manual reload. Pure clock tick, $0.
  const [sessionTick,setSessionTick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setSessionTick(t=>t+1),10*60*1000);return ()=>clearInterval(id);},[]);
  const renderNow=useMemo(()=>new Date(),[sessionTick]);
  const marketClock=publicMarketClock(renderNow);
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
  const { data: DATA, mode, asOf, provenance, dataAsOf, liveBuild, lastError, retry,
    publicCall, publicCallFrozen, publicCallCapturedAt, publicCloseRead } = useMarketData(MOCK_DATA, { publicView });
  /* v3.97 SHAREABLE SIMPLE: the live S-tier picks. Sections are presentation-only
     (smoke-enforced), so the fetch lives here. LIVE BUILDS ONLY — a demo build must never
     show a picks strip (mock conviction is the v3.1 invariant's exact target), and a fetch
     failure resolves to null so the strip renders nothing rather than example data. */
  const [picks,setPicks]=useState(null);
  useEffect(()=>{
    if(!liveBuild)return;
    let dead=false;
    fetch("/api/picks").then(r=>r.ok?r.json():null).then(j=>{if(!dead)setPicks(j);}).catch(()=>{/* strip renders nothing */});
    return ()=>{dead=true;};
  },[liveBuild]);
  /* v6.5.0 STOCK SPOTLIGHT: the public educational widget's model. LIVE BUILDS ONLY, and the
     section renders nothing unless the feed reports enabled:true with a model — the feature
     ships behind SPOTLIGHT_ENABLED on Pages, so a default deploy shows no widget at all.
     Nothing here is book-shaped: /api/stock-spotlight reads only its own spotlight:* keys. */
  const [spotlight,setSpotlight]=useState(null);
  useEffect(()=>{
    if(!liveBuild)return;
    let dead=false;
    fetch("/api/stock-spotlight").then(r=>r.ok?r.json():null).then(j=>{if(!dead)setSpotlight(j);}).catch(()=>{/* the widget renders nothing */});
    return ()=>{dead=true;};
  },[liveBuild]);
  const d=DATA;
  // FOMC countdown computed CLIENT-SIDE from nextFOMC (the snapshot's daysUntil is frozen at
  // fetch time and rounds up — it read "1d" on decision day). 0 = today. Falls back to the
  // snapshot value if nextFOMC is missing/unparseable.
  // FEAT-SNAP-UX: a PAST nextFOMC date (stale mock/snapshot) must read as unknown (null),
  // not clamp to 0 — the old Math.max(0,…) rendered "FOMC decision today" forever once the
  // baked-in meeting date went by.
  /* v3.99: the meeting DATE no longer rides on Kalshi. A live Kalshi strike_date still wins
     (it is the market's own reference for the odds beside it, so the two can never describe
     different meetings), but a dead/rate-limited feed now falls through to the CURATED Fed
     calendar instead of to MOCK_DATA's hardcoded date — which had expired and rendered
     "FOMC —" for two months. `fomcSource` records which one answered: a date is only as
     good as its provenance, and the tile says so. */
  /* v3.99.1 — ONE CLOCK. This compared against browser-LOCAL midnight while nextFomcDate()
     resolves "today" in ET, so in any non-ET runtime (a UTC container, or a user abroad) the
     two disagreed and the countdown could be a day out — the exact FIX-A defect (v3.49) that
     put etYmd() in sources.js in the first place. Caught by the browser suite comparing the
     rendered number against the active calendar entry. */
  const fomcPick=(()=>{
    const live=d.macro.fedFunds.nextFOMC;
    const lv=live?parseObsDate(live):null;
    const t=parseObsDate(etYmd());
    // "live" here means the field genuinely came from the market feed, not the mock
    // baseline — provenance is read directly because modeOf is declared below.
    const pv=(provenance&&provenance.nextFomcDate)||"MOCK";
    if(lv&&!isNaN(lv.getTime())&&(lv-t)>=0&&(pv==="LIVE"||pv==="CACHED")) return {date:lv, src:"market"};
    const cur=nextFomcDate();
    const cd=cur?parseObsDate(cur):null;
    return (cd&&!isNaN(cd.getTime())) ? {date:cd, src:"calendar"} : {date:null, src:null};
  })();
  const fomcSource=fomcPick.src;
  const fomcDays=(()=>{const dt=fomcPick.date;if(!dt)return null;const t=parseObsDate(etYmd());const days=Math.round((dt-t)/86400000);return days<0?null:days;})();
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
  /* v4.0 SIMPLE MODE — pure projections of the SAME EvidenceSet (src/evidence.js). Derived
     here, once, and handed down: the sections stay presentation-only, and Simple can never
     disagree with Power because neither re-derives anything. */
  const simpleV=simpleVerdict(evidenceSet);
  const simpleC=simpleCards(evidenceSet);
  const simpleS=holdReason(evidenceSet);
  const simpleF=simpleFlipLine(evidenceSet);
  // v5.3: one canonical public call. The six-factor EvidenceSet owns direction; the existing
  // Macro Flip/PANIC circuits are safety overrides, never a second directional opinion.
  const flipValue=(key,value)=>{const m=modeOf(key);return m==="LIVE"||m==="CACHED"?value:null;};
  const flipState=computeMacroFlip({
    vix:flipValue("vix",d.marketPulse.vix.current),
    spyPrice:flipValue("spyPrice",d.marketPulse.spy.price),
    spyMa200:flipValue("spyMa200",d.marketPulse.spy.ma200),
  });
  const panicInputsLive=["vix","fearGreed"].every(k=>{const m=modeOf(k);return m==="LIVE"||m==="CACHED";});
  const panic=flipState.tripped===true||(panicInputsLive&&d.marketPulse.vix.current>25&&d.marketPulse.fearGreed.score<20);
  const currentCall=callFromEvidence(evidenceSet,{
    macroFlip:flipState,
    panic,
    effectiveDate:etYmd(),
  });
  // v5.5 accountability: after the 10am capture, every PUBLIC call surface reads the
  // immutable history artifact. The live EvidenceSet continues to update; if it has moved
  // far enough to produce a different posture, the hero names that drift instead of silently
  // replacing the call whose outcomes will be scored.
  const callFrozen=publicCallFrozen===true&&publicCall?.schema==="md-call-v1";
  const dailyCall=callFrozen?publicCall:currentCall;
  const callDrift=callFrozen&&currentCall.direction&&
    (currentCall.direction!==dailyCall.direction||currentCall.headline!==dailyCall.headline)
      ?currentCall:null;
  /* v6.2: the 6pm CLOSE READ — a captured, UNSCORED record beside the frozen call. ONE
     builder (closeReadLine) feeds the hero's slot; `differs` is measured against the SAME
     dailyCall the hero shows, never a recomputation. Null before 18:00, on a FAILED capture
     (history carries that), and on any day the record is not today's. */
  const closeReadNote=closeReadLine(publicCloseRead,dailyCall,etYmd());
  const flip=flipState.evaluable?flipState:null;
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
  const regimeView={...regime,
    label:dailyCall.headline||WITHHELD_LABEL,
    sub:dailyCall.direction||dailyCall.status};
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
  // Why-this-call: recomputed every render ($0, no LLM). Override the session frame with the LIVE
  // ET session (not the value frozen in the daily snapshot) so the narrative advances
  // pre-open → midday → post-close through the day. sessionTick re-renders it on a timer.
  // The six factor rows already carry their own mode/date/exclusion. Only headline context
  // needs a separate freshness bit; it never votes and is withheld when not current.
  const FW_FIELDS=["marketHeadline"];
  const anyLive=mode==="LIVE"||mode==="CACHED";
  const marketClockCopy=publicMarketClockLine({
    now:renderNow,
    marketAsOf:dataAsOf?.spyPrice,
    snapshotAsOf:asOf,
  });
  const currentReadCaption=anyLive?liveReadCaption({
    now:renderNow,callFrozen,liveBuild,withheld:evidenceSet.withheld,
  }):null;
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
  const fw=computeFiveWhys({...d, session:etSession(renderNow)}, regimeView, {
    call:dailyCall, factors:evidenceSet.factors, flips:evidenceSet.flips?.flips,
    snapshotAsOf:asOf, headlineFresh:freshSet===null||freshSet.has("marketHeadline"),
    // 8/28 A13: narrating the frozen artifact, the prefix follows the CALL's clock, not the
    // reader's. Presentation only — the flag is the one the server already set.
    callFrozen,
    vocabulary:simple?"simple":"degen",
  });
  /* B2 (v3.59): "derived from live data" was a STATIC string — it kept asserting liveness
     across cached, degraded, error and demo states. One derivation, both footers. */
  const derivedLabel=mode==="LIVE"?"derived from live data"
    :mode==="CACHED"?"derived from a cached snapshot"
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

  // FEAT-165: Share button.
  // Wave 16 (Req 7.9): the ✓ COPIED claim is CONFIRMED, never optimistic — the old handler
  // set it before the write settled, so a denied clipboard permission still flashed a green
  // success for 2s (a false success claim, the honesty invariant applied to an affordance).
  // A failed or cancelled write reverts to the idle label immediately (<300ms) with NO error
  // toast — the user cancelled or the browser refused; nagging adds nothing.
  const handleShare=()=>{
    const p=navigator.clipboard?.writeText(publicDashboardUrl(window.location.href));
    if(!p){return;} // no clipboard API — claim nothing
    p.then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})
     .catch(()=>{setCopied(false);});
  };

  /* v4.1.7 — the dock's navigation. Uses TT's EXISTING focus route and invents no router:
     admin.html reads `TAB` straight off location.hash at load (`#nbis` -> the NBIS deep-dive
     tab). A symbol with no stored payload is safe — renderTabs falls back to BOARD when the
     hash names a sym with no dd entry ("payload removed -> fall back"), so a chip can never
     strand the reader on a broken tab. */
  const openTerminal=(sym)=>{
    if(!sym)return;
    window.location.href=`/admin.html#${String(sym).toLowerCase()}`;
  };

  // v4.0: copy the exact canonical call the hero and 5-Whys render. Factor provenance and
  // dates already live in md-call-v1, so the clipboard can never recompute a second opinion.
  const handleTtCopy=()=>{
    // 8/28 clock matrix A10: the paste header splits frozen/live exactly as the share
    // card does — one word pair, two builders (the clipboard-agreement rule).
    const block=formatMacroCallPaste(dailyCall,{frozen:callFrozen});
    // Wave 16 (Req 7.9): same confirmed-not-optimistic rule as handleShare — this block gates
    // real orders, so a false "✓ TT COPIED" over an empty clipboard is strictly worse here.
    const p=navigator.clipboard?.writeText(block);
    if(!p){return;}
    p.then(()=>{setTtCopied(true);setTimeout(()=>setTtCopied(false),2000);})
     .catch(()=>{setTtCopied(false);});
  };

  const handleCallShare=()=>{
    const block=formatMacroShareCard(dailyCall,{frozen:callFrozen});
    const p=navigator.clipboard?.writeText(block);
    if(!p)return;
    p.then(()=>{setCallShared(true);setTimeout(()=>setCallShared(false),2000);})
     .catch(()=>{setCallShared(false);});
  };
  // v6.2: the close read's own clipboard export — the CLOSE READ edition, never the 10am's
  // label on the evening's read (the A10 one-word-pair rule, extended to three editions).
  const [closeCopied,setCloseCopied]=useState(false);
  const handleCloseReadCopy=()=>{
    const cr=publicCloseRead?.capture_status==="CAPTURED"?publicCloseRead.close_read?.read:null;
    if(!cr)return;
    const block=formatMacroCallPaste(cr,{edition:"CLOSE READ"});
    const p=navigator.clipboard?.writeText(block);
    if(!p)return;
    p.then(()=>{setCloseCopied(true);setTimeout(()=>setCloseCopied(false),2000);})
     .catch(()=>{setCloseCopied(false);});
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
          :!dailyCall.headline?`Not enough data: only ${dailyCall.counts.usable} of ${dailyCall.counts.total} signals counted; posture withheld.`
          :simple?`MacroDash ${simpleCallLabel(dailyCall)}: ${dailyCall.counts.usable} of ${dailyCall.counts.total} signals counted.`
          :`MacroDash ${dailyCall.headline}, ${dailyCall.direction}: ${dailyCall.counts.usable} of ${dailyCall.counts.total} signals counted.`}
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
              .spy-tape-mobile{display:none!important;}
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
        /* v5.8: the parameter card is the tap target for its explainer sheet, and the sheet's
           ✕ is the way out — both get real thumb targets on a phone (Req 6.3). The card is
           already tall enough at every width; the rule is stated so a later compaction cannot
           shrink it below the floor without failing the pin. */
        .simple-card{min-height:44px;}
        @media(max-width:480px){.fs-close{min-height:44px;min-width:44px;}}
        /* v6.3: every strip tile is a sheet trigger now — the same phone thumb target the cards
           and the sheet's ✕ get (v3.42 slice 1, v5.8), measured rather than assumed. */
        @media(max-width:480px){.strip-tile{min-height:44px;}}
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
      <header className={simple?"hdr hdr-simple":"hdr"} style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"calc(8px + env(safe-area-inset-top)) 20px 8px",display:"flex",justifyContent:"space-between",alignItems:simple?"flex-start":"center",gap:8,flexWrap:simple?"nowrap":"wrap"}}>
        {/* A2 (v3.58): minWidth:0 lets the identity group shrink inside the flex row instead of
            forcing overflow; the sub-wordmark hides below 360px (it duplicates the brand).
            T9: Simple stacks the clock under the wordmark so the action row is Wordmark +
            Simple|Degen only — Terminal and Share are Degen's. */}
        <div style={{display:"flex",alignItems:simple?"flex-start":"center",gap:simple?2:14,minWidth:0,flexWrap:simple?"nowrap":"wrap",flexDirection:simple?"column":"row",flex:simple?"1 1 auto":undefined}}>
          <div className="wordmark" style={{fontFamily:T.fontDisplay,fontSize:20,fontWeight:800,color:T.amber,letterSpacing:"-0.02em"}}>MacroDash</div>
          {/* FEAT-165: friendly sub-headline */}
          {/* FINDING-1: orientation line now visible on mobile (was hide-mobile) */}
          {/* v5.9: the lowercase echo is Power's. It repeats the wordmark 4px to its right,
              which is the cheapest word on the page to cut and the first one a beginner reads
              twice. (A2 already hid it below 360px for the same reason — this extends the
              same judgment to the mode, not just the width.) */}
          {!simple&&<div className="sub-wordmark" style={{fontFamily:T.fontSans,fontSize:10,color:T.textMuted}}>macrodash</div>}
          {/* FEAT-SNAP-UX: the session · timestamp line renders ONLY from live data. The mock
              baseline's hardcoded lastRefresh next to a pulsing dot read as "the site last
              refreshed <months-old date>" — a timestamp is exactly the kind of number the
              v3.1 honesty invariant says must never look live when it isn't. */}
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:simple?"nowrap":"wrap",minWidth:0,maxWidth:"100%"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:anyLive?T.amber:T.textMuted,boxShadow:anyLive?`0 0 5px ${T.amber}`:"none"}} className="pulse-anim"/>
            <span style={{fontFamily:T.fontMono,fontSize:9,color:mode==="ERROR"?T.red:T.textSecondary,whiteSpace:simple?"nowrap":undefined,overflow:simple?"hidden":undefined,textOverflow:simple?"ellipsis":undefined}}>
              {/* 8/28 clock matrix A1: a mixed clock — session is live per request, lastRefresh is
                  the frozen snapshot-build instant. Unlabelled, "OPEN · 02:40 ET" read as the
                  CALL's time (or a broken clock). Three words bind the timestamp to the data. */}
              {anyLive?marketClockCopy
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
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:simple?"nowrap":"wrap",minWidth:0,flexShrink:simple?0:undefined}}>
          {/* v5.9 (beginner read): the provenance CHIP is Power's. In Simple the status line
              directly above already stamps the pull time and "end-of-day, not real-time", and
              every card carries its own freshness, so a second CACHED token is a third saying
              of one fact. It stays in Simple on ERROR — an outage is a red fact and the v3.25
              rule is not a density trade. */}
          {(!simple||mode==="ERROR")&&<DataModeBadge mode={mode}/>}
          {/* FEAT-GLANCE (v3.61, newcomer audit): the alert badges are operator tooling — the
              Macro Alerts section itself is !publicView (A4), and "⚡ 3 BLIND" reads as a system
              failure to a visitor who can't see the monitors it describes. Same gate.
              v3.62: these stay OUTSIDE the ⋯ OPS menu. A FIRED alert is a red fact and the v3.25
              rule holds board-wide — a collapse must never hide one. Only the always-available
              actions below move behind the disclosure. */}
          {/* v5.9: ALSO Power-only, and this is a defect fix rather than a density cut. The
              Macro Alerts section is `!publicView&&!simple`, so in Simple the badge counted
              monitors the reader could not reach and its deep link led nowhere — an orphan.
              v3.25 says a collapse must never hide a red fact; it does not require a count of
              a section that is not on the page. In Power both are unchanged. */}
          {/* v6.0 (PR #10's live fix, carried forward at its close): both counts ride ONE
              badge. The BLIND tell used to render only at activeAlerts===0, so "1 fired ·
              3 blind" printed as a confident "⚡ 1 FIRED" alone — the v3.52 false clear,
              surviving at a nonzero numerator. Red when anything fired (a trip outranks a
              blind gauge), amber when only blind, NOTHING when neither — a genuine clear
              says nothing rather than asserting one. */}
          {!simple&&!publicView&&(activeAlerts>0||alertBlind>0)&&
            <Badge label={`⚡ ${[activeAlerts>0?`${activeAlerts} FIRED`:null,alertBlind>0?`${alertBlind} BLIND`:null].filter(Boolean).join(" · ")}`}
              color={activeAlerts>0?T.red:T.amber}/>}
          {/* v3.94: the Simple|Power toggle — persistent, remembered per device. */}
          {/* v6.0.1 (owner UX review: "Simple vs power is hard to tell, ensure clarity with each
              button"). The old pressed state was a one-shade-lighter surface behind bold text —
              indistinguishable from the unpressed half at a glance on a phone. The SELECTED half
              is now FILLED in the brand amber with dark text (the same fill the ⌁ TERMINAL button
              uses for "this is the one"), each half carries a shape (○ the lean view · ◉ the full
              view) ahead of its word, and each half states in its tooltip and accessible name
              what the mode SHOWS — so the choice is legible before the label is read, and the
              consequence is legible before the tap. aria-pressed is unchanged. */}
          <div role="group" aria-label="View mode" style={{display:"flex",border:`1px solid ${T.borderAccent}`,borderRadius:4,overflow:"hidden"}}>
            {VIEW_MODES.map(({id,glyph,word,tells})=>{const on=viewMode===id;return(
              <button key={id} onClick={()=>setViewMode(id)} aria-pressed={on} className="hdr-act"
                title={`${word} view — ${tells}`} aria-label={`${word} view — ${tells}`}
                style={{fontFamily:T.fontMono,fontSize:9,padding:"5px 10px",cursor:"pointer",border:"none",
                        display:"inline-flex",alignItems:"center",gap:5,letterSpacing:"0.04em",
                        background:on?T.amber:"transparent",
                        color:on?T.bg:T.textSecondary,fontWeight:on?700:400}}>
                <span aria-hidden="true" style={{fontSize:10,lineHeight:1}}>{glyph}</span>{word}
              </button>
            );})}
          </div>
          {/* v3.98.3 (owner call: "want terminal more available"): TERMINAL is PROMOTED out of
              the ⋯ OPS menu into the bar itself. v3.62 demoted it as newcomer clutter — correct
              then, wrong now: the default route is the OPERATOR's, the terminal is where the
              work lives, and Simple|Power already gates newcomer noise far better than a menu
              did. It keeps the !publicView gate (a visitor never sees it) and gets the accent
              treatment so it reads as the primary destination, not another utility. */}
          {!simple&&!publicView&&(
            <a href="/admin.html" aria-label="Open Ticker Terminal" className="hdr-act"
              title="TT Ticker Terminal — the book, rankings and next dollar"
              style={{fontFamily:T.fontMono,fontSize:9,fontWeight:700,background:`${T.amber}1a`,border:`1px solid ${T.amber}`,color:T.amber,padding:"5px 12px",borderRadius:4,textDecoration:"none",whiteSpace:"nowrap",letterSpacing:"0.04em"}}>
              ⌁ TERMINAL
            </a>
          )}
          {/* FEAT-165: share button — stays in the bar; it is the one action a VISITOR wants. */}
          {!simple&&<button onClick={handleShare} aria-label="Copy dashboard link" className="hdr-act"
            style={{fontFamily:T.fontMono,fontSize:9,background:copied?"#1a3020":T.surfaceHigh,border:`1px solid ${copied?T.green:T.borderAccent}`,color:copied?T.green:T.textSecondary,padding:"5px 12px",borderRadius:4,cursor:"pointer",transition:"all 0.2s"}}>
            {copied?"✓ COPIED":"⤴ SHARE"}
          </button>}
          {/* v3.62 (newcomer audit, "default route still shows TT and TERMINAL"): the operator
              ACTIONS consolidate behind one ⋯ OPS disclosure — the admin.html header pattern.
              Owner call: the default route stays the operator view, so this reduces the clutter
              without moving anyone's daily surface. Native <details> — no new state, keyboard
              and screen-reader behaviour for free. */}
          {/* v5.9: the OPS menu is Power's. Its only entry is the operator clipboard export;
              in Simple the hero's own copy control covers the reader who wants to share the
              call, so the menu was a word with no job on the beginner's screen. */}
          {!simple&&!publicView&&(
            <details className="hdr-ops" style={{position:"relative"}}>
              <summary aria-label="Operator actions" className="hdr-act"
                style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.borderAccent}`,color:T.textSecondary,padding:"5px 12px",borderRadius:4,cursor:"pointer",listStyle:"none",whiteSpace:"nowrap"}}>
                ⋯ OPS
              </summary>
              <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",display:"flex",flexDirection:"column",gap:6,background:T.surface,border:`1px solid ${T.borderAccent}`,borderRadius:5,padding:8,zIndex:60,minWidth:150,boxShadow:"0 6px 18px #00000055"}}>
                {/* v4.0: the clipboard exports the same canonical call as the hero/API. */}
                <button onClick={handleTtCopy} disabled={!anyLive} aria-label="Copy MacroDash daily call" className="hdr-act"
                  title={anyLive?"Copy the canonical MacroDash daily call":"live data required"}
                  style={{fontFamily:T.fontMono,fontSize:9,background:ttCopied?"#1a3020":T.surfaceHigh,border:`1px solid ${ttCopied?T.green:T.borderAccent}`,color:ttCopied?T.green:T.textSecondary,padding:"7px 12px",borderRadius:4,cursor:anyLive?"pointer":"not-allowed",opacity:anyLive?1:0.4,textAlign:"left"}}>
                  {/* v6.2: "DAILY CALL" retired — ambiguous once two daily artifacts exist. The
                      label IS the edition the paste will carry (callEdition: 10AM CALL / LIVE READ). */}
                  {ttCopied?"✓ CALL COPIED":`⎘ ${callEdition({frozen:callFrozen})}`}
                </button>
                {publicCloseRead?.capture_status==="CAPTURED"&&<button onClick={handleCloseReadCopy} aria-label="Copy MacroDash evening update" className="hdr-act"
                  title="Copy tonight's unscored 6pm evening update — not the 10am call"
                  style={{fontFamily:T.fontMono,fontSize:9,background:closeCopied?"#1a3020":T.surfaceHigh,border:`1px solid ${closeCopied?T.green:T.borderAccent}`,color:closeCopied?T.green:T.textSecondary,padding:"7px 12px",borderRadius:4,cursor:"pointer",textAlign:"left"}}>
                  {closeCopied?"✓ EVENING UPDATE COPIED":"⎘ EVENING UPDATE"}
                </button>}
                {/* TERMINAL left this menu in v3.98.3 — it is a first-class bar button now.
                    Keeping a second copy here would be two doors to one room. */}
              </div>
            </details>
          )}
        </div>
      </header>

      {!simple&&!degenNoticeDismissed&&<div role="note" aria-label="Degen view introduction"
        style={{background:T.surfaceHigh,borderBottom:`1px solid ${T.amber}44`,padding:"7px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary,flex:"1 1 280px"}}>Degen uses trading slang and shows the full technical dashboard. Simple keeps it to the plain call and key signals.</span>
        <button onClick={()=>setViewMode("simple")} className="hdr-act"
          style={{fontFamily:T.fontMono,fontSize:9,background:T.amber,color:T.bg,border:"none",borderRadius:3,padding:"5px 9px",cursor:"pointer",fontWeight:700}}>BACK TO SIMPLE</button>
        <button onClick={dismissDegenNotice} aria-label="Dismiss Degen introduction" className="hdr-act"
          style={{fontFamily:T.fontMono,fontSize:9,background:"transparent",color:T.textMuted,border:`1px solid ${T.borderAccent}`,borderRadius:3,padding:"5px 9px",cursor:"pointer"}}>DISMISS</button>
      </div>}

      {/* v4.0: a confirmed PANIC override owns this slot; otherwise show the armed circuit. */}
      {dailyCall.override.active
        ? <PanicOverrideBanner call={dailyCall} simple={simple}/>
        : flip&&(flip.tripped||flip.armed)&&<MacroFlipBanner flip={flip}/>}

      {/* C2 (v3.60): section navigation — the page had one hidden h1 and no way to jump.
          Real <nav> landmark; each link targets the section's h2. Sticky in the header's place. */}
      {/* Safe-area (v3.61): a fixed opaque scrim keeps scrolled content from showing through
          the island strip, and the sticky nav offsets below it — padding the nav instead
          would render a permanent inset-height band even when it isn't stuck. */}
      <div aria-hidden="true" style={{position:"fixed",top:0,left:0,right:0,height:"env(safe-area-inset-top)",background:T.bg,zIndex:45}}/>
      {!simple&&<StickyNav/>}

      {/* 9.3: the overview heading is the skip-link target — tabIndex -1 makes it
          programmatically focusable for the skip jump AND the LOADING-resolve focus move. */}
      <h2 id="overview" tabIndex={-1} className="visually-hidden">Overview — posture, confidence, and what changed</h2>
      {/* FEAT-169 + R4c: Regime Verdict band — HERO, now FIRST under the header (mobile-first) */}
      {/* v3.97 SHAREABLE SIMPLE: the hero explanation SWAPS by mode, never stacks — Simple
          gets the two directional newbie sentences (prose), Power keeps the compact
          one-liner (sentence). Same buckets, one derivation (postureSummary). */}
      <RegimeBand d={d} stale={staleFactors} loading={mode==="LOADING"} liveBuild={liveBuild} srcLabel={derivedLabel}
        /* v6.2: the sentence describes the CURRENT evidence; it is suppressed only when a
           SUBORDINATE read on screen (live drift, or a captured close read) DISAGREES with the
           primary call — an agreeing close read leaves it in place. */
        sentence={(callDrift||closeReadNote?.differs)?null:(simple?simpleS:(!evidenceSet.withheld&&evidenceSet.summary?evidenceSet.summary.sentence:null))}
        plainVerdict={simple?simpleV:null} conf={regimeConf}
        factorRows={evidenceSet.factors} regimeIn={evidenceSet.regime} flipsIn={evidenceSet.flips}
        call={dailyCall} callFrozen={callFrozen} callCapturedAt={publicCallCapturedAt}
        callDrift={callDrift} closeRead={closeReadNote} readCaption={currentReadCaption} noSessionDay={marketClock.noSession}
        onCopyCall={handleCallShare} callCopied={callShared}
        copyDisabled={!anyLive&&!callFrozen}/>

      {/* FEAT-WHY (v3.62) sentence now renders INSIDE the hero (v3.94 DRIVERS-ONLY — one
          render site beside the verdict it explains). postureSummary stays computed and
          smoke-tested in evidence.js; withheld postures still render no sentence. */}

      {/* ── v3.95 (owner call on a live Simple screenshot): in Simple the whys were not
          reachable AT ALL — the whole reasoning group is Power-only, so the one question a
          newcomer asks next ("why?") had no answer on the page. ONE honestly-labelled
          expander sits directly under the hero sentence, holds the five why statements and
          nothing else, and REMEMBERS its open state per device (WHYS_KEY) so a reader who
          wants the chain does not re-open it every visit. Chips, the factor tally, the flip
          line and the full evidence matrix stay Power-only — this adds the narrative, not
          the technical layer. ── */}
      {/* v4.0 SIMPLE MODE: up to three parameter cards + the flip line, directly under the
          verdict they explain. Excluded factors never appear (a card is a claim about a
          current usable reading); fewer than three usable renders fewer cards, never
          UNAVAILABLE padding; the truncation is named on the block. */}
      {simple&&<SimpleCards cards={simpleC.cards}
        usable={simpleC.usable} shown={simpleC.shown} total={simpleC.total}
        withheld={evidenceSet.withheld}/>}

      {/* 8/28 Whys altitude: the closed line carries the flip — the fifth check IS "what
          changes it", so it is this block's honest one-line summary. MOVED from the
          SimpleCards footer, never duplicated (v3.61 one-home rule). Chip-length in place,
          verbatim one tap deep (v3.66). A WITHHELD posture advertises no flip — the label
          stays bare and the withheld sentence travels inside with the flip's slot, so the
          fact still lands without a closed row claiming a crossing that does not exist.
          Verdict words already pass through SIMPLE_VERDICTS inside simpleFlipLine (v4.0.3). */}
      {simple&&<FiveWhys fw={fw} derivedLabel={derivedLabel} mode={modeOf('spyPrice')} asOf={asOfOf('spyPrice')}
        label={WHYS_FOLD_LABEL} promise
        flipChip={evidenceSet.withheld?null:flipChipOf(simpleF)} flipLine={simpleF} coverage={regimeConf}/>}

      {/* ── v3.94 DRIVERS-ONLY: the REASONING group — 5 whys + what-changed under ONE
          toggle (2 clicks to any why, inside the owner's 2-3 budget). The label carries the
          change count while closed (v3.25: a material delta is signal, never hidden silently);
          posture-flip deltas also surface in the hero itself, which never collapsed.
          POWER-ONLY (the Explain/Dig layers). ── */}
      {!simple&&<div style={{padding:"2px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
        <CollapsedGroup chip={false} count={5+(changed&&changed.changes?changed.changes.length:0)}
          label={`the reasoning — 5 whys · what changed${changed&&changed.changes&&changed.changes.length?` (${changed.changes.length} new)`:""}`}>
          <FiveWhys fw={fw} derivedLabel={derivedLabel} mode={modeOf('spyPrice')} asOf={asOfOf('spyPrice')}/>
          <WhatChanged changed={changed}/>
        </CollapsedGroup>
      </div>}

      {/* ── SIGNAL QUALITY — extracted to src/sections/SignalQuality.jsx (task 3.2),
          presentation only; the SIGNAL_FIELDS census + regimeConf derivation stay here. ── */}
      {/* v4.0.3: the census counts TRACKED SOURCES FIELDS ("16 fresh of 17 tracked"), which is
          NOT confidence in the six-factor macro verdict — in Simple it read as a second,
          larger, contradictory confidence number. The hero's "N of 6 voters counted · dark: X"
          is the scoped one, and it stays. Power keeps the full census. */}
      {!simple&&<SignalQuality sq={sq}/>}
      {!simple&&<nav aria-label="MacroDash accountability" style={{display:"flex",gap:16,alignItems:"center",padding:"4px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`,fontFamily:T.fontMono,fontSize:9}}>
        <a href="/history" style={{color:T.amber,textDecoration:"none"}}>TRACK RECORD →</a>
        <a href="/difference" style={{color:T.textMuted,textDecoration:"none"}}>WHY MACRODASH →</a>
      </nav>}

      {/* C4 WHAT CHANGED rides inside the reasoning group above (v3.94). */}

      {/* ── C3 (v3.60): DRIVERS — the six-factor Evidence Matrix. Renders the EvidenceSet
          contract, never its own reading: value · vote · freshness · as-of · exclusion
          reason per factor. Cards wrap on phones, rows on desktop (flex-wrap). ── */}
      {!simple&&<section aria-labelledby="drivers" style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`}}>
        <h2 id="drivers" className="visually-hidden">Drivers — the six signals behind the call</h2>
        {/* v3.62 eyebrow, folded into the toggle row itself (v3.93 QUIET-2 — two rows were
            saying one thing). The count summary stays visible while closed (v3.25). */}
        {/* FEAT-GLANCE (v3.61): the six full cards collapse — the band's chip row above is
            already the icon-first six-factor view, so a second full-size rendering of the
            same six facts was the duplication the newcomer audit flagged. Red facts survive
            the collapse: the summary line above stays, exclusions stay named in Signal
            Quality, and the ⏱ chips stay on the band (the v3.25 rule). chip={false} — this
            is live evidence, not curated content. */}
        <DriversMatrix evidenceSet={evidenceSet}/>
      </section>}

      {/* v3.69 NARRATIVE-FIRST: markets/macro/ai gain real <section> extents (the drivers/
          health pattern) — previously bare h2s, so the ai anchor swallowed Conviction+Alerts. */}
      <section aria-labelledby="markets">
      <h2 id="markets" className="visually-hidden">Markets — equities, rates and cross-asset</h2>
      {/* ── MACRO STRIP — extracted to src/sections/MacroStrip.jsx (task 3.1),
          presentation only (FEAT-170 4-col mobile reflow rides the .macro-strip rules in
          the stylesheet above; v3.25: always visible while market detail collapses). ── */}
      <MacroStrip d={d} modeOf={modeOf} fomcLabel={fomcLabel} fomcDays={fomcDays}
        votingFields={VOTING_FIELDS} badge={simple?null:<SpyTapeBadge spyChangePct={d.marketPulse.spy.changePct} mode={modeOf("spyPrice")} noSessionDay={marketClock.noSession}/>}/>

      {/* ── v6.5.0 STOCK SPOTLIGHT — immediately below the macro-number strip in BOTH modes,
          so the macro verdict stays the first answer and this is the first company-level
          one. Presentation-only section; the model arrives projected from the server, the
          fetch lives above. Renders nothing unless the feed is enabled with a model. ── */}
      <StockSpotlight spotlight={spotlight} simple={simple}/>


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
      {!simple&&<MarketDetail d={d} modeOf={modeOf} asOfOf={asOfOf} demoted={demoted} spyData={spyData} goldenCross={goldenCross}/>}
      </section>

      {!simple&&<section aria-labelledby="macro">
      {/* C2 (v3.60): the macro anchor lands where the macro grid begins */}
      <h2 id="macro" className="visually-hidden">Macro — inflation, labor, credit and conditions</h2>
      <div style={{padding:"12px 20px 0"}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* FEAT-169: RegimeTile relocated to full-width RegimeBand under macro strip (was here). */}

            {/* Macro Regime grid + Top Headwinds — extracted to src/sections/
                MacroRegime.jsx + Headwinds.jsx (tasks 5.3/5.4), presentation only. */}
            <MacroRegime d={d} modeOf={modeOf} asOfOf={asOfOf} fomcDays={fomcDays} fomcSource={fomcSource}/>
            <Headwinds d={d}/>


          </div>
      </div>
      </section>}

      {!simple&&<section aria-labelledby="ai">
      {/* ── AI UNIT ECONOMICS — extracted to src/sections/AIUnitEconomics.jsx
          (task 7.1), presentation only; data + scissors in src/aiEcon.js. ── */}
      <AIUnitEconomics d={d} modeOf={modeOf} asOfOf={asOfOf}/>
      </section>}

      {/* ── v4.1.7 TERMINAL DOCK — replaces the v3.97 SharedPicks strip. Owner: the bottom row
          is a DOOR INTO TERMINAL, not a mini-watchlist, so the chips became real buttons that
          focus a symbol in TT. Operator-only; publicView renders nothing.
          ⚠ That gate is CLEANLINESS, NOT privacy, and v3.97 chose the other way for exactly
          this reason: /api/picks is still world-readable by design and the bare URL still
          serves the operator view (the dashboard has no auth), so hiding the dock makes the
          shared link clean and makes nothing private. Owner call 2026-08-21 — the reversal is
          deliberate and the endpoint is deliberately unchanged.
          The nav lives HERE, not in the section (presentation-only contract), and the section
          renders NOTHING without live-fetched data (never example conviction). ── */}
      {simple&&<TerminalDock publicView={publicView} picks={picks}
        gate={dailyCall?dailyCall.actionability:null}
        onOpenTerminal={openTerminal}/>}

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
        {!publicView&&!simple&&(<section aria-label="Operator monitors — conviction and alerts">
        <Watchlist watchlist={d.watchlist}/>

        {/* ── ALERTS STRIP — extracted to src/sections/Alerts.jsx (task 7.2);
            evaluation + state stay here, the A4 gate stays on the wrapper. ── */}
        <Alerts alerts={alerts} alertEval={alertEval}
          onToggle={id=>setAlerts(prev=>prev.map(x=>x.id===id?{...x,active:!x.active}:x))}
          onDelete={handleDeleteAlert}/>
        </section>)}

        {/* ── DATA HEALTH — extracted to src/sections/DataHealth.jsx (task 7.3);
            the whole <section> moved so the health anchor + h2 travel together. ── */}
        {!simple&&<DataHealth signalFields={SIGNAL_FIELDS} modeOf={modeOf} dataAsOf={dataAsOf}
          mode={mode} lastError={lastError} retry={retry}/>}

        {/* ── FOOTER ── v6.0.2 (owner: "that very bottom blurb can go too. Under a dropdown"):
            the four attribution lines ride ONE closed CollapsedGroup in both modes — the house
            disclosure idiom (44px toggle), chip-free because this is provenance, not curated
            content. The closed row carries the two facts that must survive a collapse: the
            version and "not financial advice". Everything else — the refresh cadence, the
            History/Difference/JSON links, the public-route omission note, and the Live/Curated/
            Retired attribution (which RECORDS the CBOE/Mag-10 retirements, never deleted — the
            v3.43/v3.51 rule) — is verbatim one tap deep. */}
        <div className="site-footer" style={{marginTop:12}}>
          <CollapsedGroup count={3} chip={false} promise={simple} label={simple?ABOUT_FOLD_LABEL:`about this page — v${__APP_VERSION__} · sources · not financial advice`}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{`MacroDash v${__APP_VERSION__} · Data refreshed daily · end-of-day sources`}</div>
              <div style={{display:"flex",gap:10,fontFamily:T.fontMono,fontSize:simple?T.fsM:8,flexWrap:"wrap",alignItems:"center"}}>
                <a href="/history" style={{color:simple?T.amber:T.textMuted}}>{simple?"Track record":"History"}</a>
                <a href="/difference" style={{color:T.textMuted}}>{simple?"Why MacroDash":"Difference"}</a>
                <a href="/readout.json" style={{color:T.textMuted}}>JSON</a>
                {simple&&<button onClick={handleShare} aria-label="Copy dashboard link"
                  style={{fontFamily:T.fontMono,fontSize:T.fsM,background:"none",border:"none",padding:0,color:copied?T.green:T.textMuted,cursor:"pointer"}}>
                  {copied?"Copied":"Share this page"}
                </button>}
              </div>
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Not financial advice · Personal use</div>
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Live: FRED · CNN · Kalshi · OpenRouter · Finnhub · multpl · Curated: GPU $/hr · hyperscaler capex · token efficiency · Retired: CBOE Put/Call (free feed dead 2019 · v3.2) · Mag 10 fundamentals + SEC S-1 (v3.43) · Mag 10 quote strip (v3.51)</div>
            </div>
          </CollapsedGroup>
        </div>
      </div>
    </div>
  );
}
