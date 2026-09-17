// src/alertEngine.js — the Macro Alerts EVALUATION engine (v6.5.5: extracted VERBATIM from
// dashboard.jsx, Zone 2 of the decomposition). Pure, React-free, Node-importable.
//
// What lives here: ALERT_METRICS (metric key -> live fields + reader), evalAlert (the
// BLIND / CLEAR / TRIGGERED judge — fail-closed on any non-live input), DEFAULT_ALERTS (the
// factory set; no stored `triggered` field, ever), and the md:alerts:v1 persistence overlay
// helpers. What does NOT live here, deliberately: the alert STATE, its localStorage
// persistence effect, and the per-render evaluation call — those stay in the orchestrator
// (wave-12 contract: Alerts.jsx never evaluates, and the orchestrator decides when to look).
// Moving the definitions here changes no behaviour; it lets smoke import the real functions
// instead of `new Function`-lifting them out of JSX source by literal markers.
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
// v6.6: the policy channel's reader + its freshness window live in src/fedPolicy.js (pure,
// one home, smoke-RUN); etYmd is the project's ONE clock — a second "today" derivation is
// the FIX-A defect this stack has paid for four times.
import { fedMoveBp, FED_MOVE_FRESH_D } from "./fedPolicy.js";
import { etYmd } from "./sources.js";
export const ALERT_METRICS={
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
  /* v6.6 (FOMC read-through, 2026-09-16) — the POLICY channel, which did not exist.
     Measured on the day the Fed hiked for the first time in three years: Kalshi carried the
     move at 86% LIVE in the snapshot and ALERT_METRICS had NO policy metric of any kind, so
     the most consequential macro event in three years had no alert channel at all. One
     alert fired that day and it was the long end (30Y 5.36 > 5.2) — not the Fed.
     The two odds metrics are ANTICIPATORY (they would have fired days early, which is the
     half that matters for "is this a good time to buy"); the move metric is the confirmed
     fact. NONE of them votes — the FED tile is context, and an alert is a "wake me", never
     a factor (promoting the policy path to a voter is an owner ruling, v3.43/v3.55). */
  rate_hike_odds: {fields:["rateOddsHike"], read:(d)=>({v:d.macro.fedFunds.odds.hike, u:"%"})},
  rate_cut_odds:  {fields:["rateOddsCut"],  read:(d)=>({v:d.macro.fedFunds.odds.cut,  u:"%"})},
  /* MAGNITUDE, not direction: a CUT is as wake-worthy as a hike (and the more bullish of the
     two), so ONE alert covers both and the tile's marker carries the direction one glance
     away. The read returns 0 — not null — when the range is readable and nothing moved:
     "nothing tripped" and "I cannot see whether it tripped" are different facts, and only
     the second may read BLIND (v3.52). Gating on the two BOUNDS is sufficient and correct:
     prev/effective-date inherit their bound's mode through DERIVED_OF. */
  fed_move_bp:    {fields:["fedTargetUpper","fedTargetLower"],
                   read:(d)=>({v:fedMoveBp(d.macro.fedFunds, etYmd()), u:"bp"}),
                   basisLabel:`last ${FED_MOVE_FRESH_D}d`},
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
export const DEFAULT_ALERTS=[
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
  /* v6.6 — the policy channel. 60% is the level at which the market has genuinely committed
     to a move rather than leaning: ASSERTED and boundary-tested, arriving under the 30Y-5.2
     convention (a threshold to WATCH, stated as such, never a claim about what it means).
     The HIKE leg ships ON because tightening is what the six signals transmit LAST — the
     10Y and financial conditions move well before the backdrop's vote does, which is exactly
     how 2026-09-16 played out. The CUT leg arrives OFF, the CCC/Sahm convention. The MOVE
     alert ships ON: a confirmed change in the policy rate is the one macro event that is
     never noise. */
  {id:10,label:"Fed Hike Odds > 60%",metric:"rate_hike_odds",condition:"above",value:60,unit:"%",active:true},
  {id:11,label:"Fed Cut Odds > 60%",metric:"rate_cut_odds",condition:"above",value:60,unit:"%",active:false},
  {id:12,label:"Fed Moved Rates",metric:"fed_move_bp",condition:"above",value:0,unit:"bp",active:true},
];
/* v6.0 T4 — the alerts PERSIST (owner ticket: the manage buttons must not be one-session
   toys). Stored as an OVERLAY on DEFAULT_ALERTS at md:alerts:v1 — per-id active flags plus
   deleted ids — never as the array itself: storing the array would silently drop every
   alert a later release ADDS (the v3.55 arrival problem in reverse). An unknown stored id
   is ignored; garbage or a wrong version falls back to the defaults (the md:view rule).
   Pure and module-level so smoke can import and RUN them (evalAlert precedent). */
export const ALERT_PREFS_KEY="md:alerts:v1";
export function applyAlertPrefs(defaults,prefs){
  if(!prefs||typeof prefs!=="object"||prefs.v!==1)return defaults;
  const active=prefs.active&&typeof prefs.active==="object"?prefs.active:{};
  const deleted=Array.isArray(prefs.deleted)?prefs.deleted:[];
  return defaults.filter(a=>!deleted.includes(a.id))
    .map(a=>typeof active[a.id]==="boolean"?{...a,active:active[a.id]}:a);
}
export function alertPrefsOf(defaults,current){
  const ids=new Set(current.map(a=>a.id));
  const active={};
  for(const a of current){
    const d=defaults.find(x=>x.id===a.id);
    if(d&&d.active!==a.active)active[a.id]=a.active;
  }
  return{v:1,active,deleted:defaults.filter(d=>!ids.has(d.id)).map(d=>d.id)};
}
