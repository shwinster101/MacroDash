// ─── MACRO STRIP (UI-OVERHAUL Slice 2, task 3.1) ────────────────────────────
// Extracted VERBATIM from dashboard.jsx: the persistent ticker — always visible
// (v3.69: it IS the market summary while the chart + tiles collapse behind the
// market-detail expander; v3.25: its provenance dots and voting markers survive
// that collapse). FEAT-170: reflows to a 4-col grid on mobile via the
// .macro-strip/.macro-strip-inner rules in the orchestrator's global stylesheet.
// PRESENTATION ONLY — provenance (modeOf), the FOMC label and the voting-fields
// set are computed in the orchestrator and handed over; `badge` is a slot for
// the WenMoonBadge so the tape mood stays the orchestrator's concern.
// Wave-17 audit fix (findings 1-3): the F&G and CPI sub-line colors are DERIVED
// from REGIME_BAND_TABLE's own vote — the strip painted a NEUTRAL F&G (30-55)
// bearish red off a hand-written `>55` binary while the gauge below rendered it
// grey and the band chip rendered `•` (the FEAT-NEUTRAL defect surviving on one
// surface), and CPI asserted red/green off a `>3` level threshold that exists
// nowhere in the engine (the factor votes on trend SHAPE). One band, one home —
// the same documented exception MarketDetail's NFCI constants use. And because a
// vote-derived color IS a directional read, it is muted when the field is not
// live (the NFCI TIGHT/LOOSE precedent, v3.1). Delta colors (pctColor on day
// moves) are arithmetic facts, not verdicts, and keep their existing treatment.
import { T } from "../design-tokens.js";
import { REGIME_BAND_TABLE, voteStyle } from "../regime.js";
import { fmt, pctColor } from "../format.js";

const bandOf=(k)=>REGIME_BAND_TABLE.find((b)=>b.key===k);

const MacroStrip=({d,modeOf,fomcLabel,fomcDays,votingFields,badge})=>{
  if(!d||typeof modeOf!=="function")return <div aria-hidden="true"/>;
  const vf=votingFields||new Set();
  const fedLo=d.macro.fedFunds.targetLower, fedHi=d.macro.fedFunds.targetUpper;
  const fedTargetLive=Number.isFinite(fedLo)&&Number.isFinite(fedHi)&&["LIVE","CACHED"].includes(modeOf("fedTargetUpper"));
  return(
    <div style={{background:T.surfaceHigh,borderBottom:`1px solid ${T.border}`,padding:"6px 20px",overflowX:"auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}} className="macro-strip">
      <div style={{display:"flex",gap:20,minWidth:"max-content",flex:1}} className="macro-strip-inner">
        {[
          {l:"SPY*", f:"spyPrice", v:`$${d.marketPulse.spy.price}`,      s:fmt.pct(d.marketPulse.spy.changePct), sc:pctColor(d.marketPulse.spy.changePct), t:"S&P 500 ÷ 10 (FRED SP500 proxy, NOT an SPY ETF quote — Stooq blocks the edge). Tracks the ETF closely; not identical."},
          {l:"QQQ",  f:"qqqPrice", v:`$${d.marketPulse.qqq.price}`,      s:fmt.pct(d.marketPulse.qqq.changePct), sc:pctColor(d.marketPulse.qqq.changePct), t:"Nasdaq-100 ETF — big tech"},
          {l:"VIX",  f:"vix", v:`${d.marketPulse.vix.current}`,     s:fmt.pct(d.marketPulse.vix.weekChg)+" WoW", sc:pctColor(d.marketPulse.vix.weekChg,true), t:"Volatility index — the market's fear gauge (lower = calmer)"},
          {l:"F&G",  f:"fearGreed", v:`${d.marketPulse.fearGreed.score}`, s:d.marketPulse.fearGreed.label, voteKey:"fearGreed", t:"Fear & Greed — market sentiment, 0 = fear, 100 = greed"},
          {l:"10Y",  f:"tenYear", v:`${d.crossAsset.treasury10y.current}%`, s:fmt.bps(d.crossAsset.treasury10y.d1)+" 1D", sc:pctColor(-d.crossAsset.treasury10y.d1), t:"10-year Treasury yield — the benchmark interest rate"},
          {l:"FED",  f:fedTargetLive?"fedTargetUpper":"fedFunds",
           v:fedTargetLive?`${fedLo.toFixed(2)}–${fedHi.toFixed(2)}%`:`${d.macro.fedFunds.rate}% avg`,
           s:`FOMC ${fomcLabel}`, sc:fomcDays===0?T.amber:T.textMuted,
           t:fedTargetLive?"Federal Reserve target range — current policy setting":"FEDFUNDS monthly effective average — lags a policy decision"},
          {l:"CPI",  f:"cpiHeadline", v:`${d.macro.cpi.headline}%`,         s:`Core ${d.macro.cpi.core}%`, voteKey:"cpiHeadline", t:"Consumer Price Index — inflation, year-over-year"},
          /* OWNER SWAP (8/31), reversing the FEAT-NFCILEV tile that held this slot since 8/29:
             the 8th slot goes to the NFCI COMPOSITE, not its leverage subindex.
             The reason is the voter/glance mismatch the 6-vs-8 study named: NFCI has VOTED in
             the six-factor backdrop since v3.43, and it was the one voter with ZERO glance
             presence — while the slot beside it was rented to a context-only field that votes
             nowhere. A strip whose job is "the market summary" was showing the non-voter and
             hiding the voter.
             It VOTES, so — unlike the tile it replaces — the ▪ marker and the "Counts toward
             today's posture" tooltip now render BY CONSTRUCTION (`nfci` is in FACTOR_FIELD's
             values, hence in VOTING_FIELDS), and `voteKey` gives the sub-line the band table's
             own vote colour, muted when the field is not live (v3.1).
             The sub-line stays the reference point, never the TIGHT/LOOSE word: a bare z-score
             is unreadable without it (v3.43), and the word is a directional call whose text —
             not just its colour — must be suppressed off a dead feed.
             NOTHING IS DELETED: `nfciLeverage` keeps its home on the NFCI tile in MarketDetail
             (the leverage-subindex line), so this is a promotion of the voter to glance and a
             demotion of the context field to the tile it already had, not a cut. */
          {l:"NFCI", f:"nfci",
           v:Number.isFinite(d.macro.nfci.current)?`${d.macro.nfci.current>0?"+":""}${d.macro.nfci.current.toFixed(2)}`:"—",
           s:"0 = avg", voteKey:"nfci",
           t:"Chicago Fed National Financial Conditions Index — how easily money and credit are flowing through the financial system, from 105 measures. Standardized so 0 = the 1971– average; positive is tighter than average, negative is looser."},
        ].map(({l,f,v,s,sc,voteKey,t})=>{
          const m=modeOf(f); const live=m==="LIVE"||m==="CACHED";
          // Vote-derived sub-line color: the band table is the ONE expression of the
          // threshold, voteStyle the ONE vote->appearance map. Not live -> muted (a
          // directional read off mock/stale is what the v3.1 invariant forbids).
          if(voteKey){const b=bandOf(voteKey);sc=b&&live?T[voteStyle(b.vote(b.read(d))).colorKey]:T.textMuted;}
          const dot=live?T.green:m==="STALE"?T.amber:T.textMuted; // provenance dot: live/stale/mock
          /* v3.62 (newcomer audit): "voting indicators and context indicators are mixed".
             A blanket per-SECTION label would be false here — this one strip carries both
             (VIX/F&G/10Y/CPI vote, SPY/QQQ/FED do not) — so the marker goes on the ITEM.
             Derived from FACTOR_FIELD's VALUES, not REGIME_FACTOR_FIELDS: that array holds
             only the five whose field key equals their factor key, with CAPE riding a
             separate `shillerPe`→`valuation` alias line in factorExclusions. Using it here
             would silently un-mark a CAPE tile the day one is added to a strip. */
          /* v3.98.4 (Power read-through): `vf` is the STATIC six-voter set, so a factor
             whose feed was dead still wore ▪ and its tooltip still read "Counts toward
             today's posture" — a marker asserting a state it cannot see, the same defect
             class the hero's hardcoded exclusion reason was. A voter that is dark today is
             NOT counted, and now says so instead of claiming the opposite. */
          const isVoter=vf.has(f); const votes=isVoter&&live;
          return(
          <div key={l} title={`${t}\n(${m.toLowerCase()})${votes?"\nCounts toward today's posture."
            :isVoter?"\nA voter, but dark today — not counted.":"\nContext only — does not vote."}`} style={{flexShrink:0,minWidth:68,cursor:"help"}}>
            <div style={{display:"flex",alignItems:"center",gap:3}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:live?dot:"transparent",border:`1px solid ${dot}`,flexShrink:0}}/>
              <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{l}</span>
              {votes&&<span aria-hidden="true" title="counts toward today's posture" style={{fontFamily:T.fontMono,fontSize:7,color:T.amber,letterSpacing:"0.05em"}}>▪</span>}
            </div>
            <div style={{fontFamily:T.fontMono,fontSize:13,color:T.textPrimary,fontWeight:700,lineHeight:1.1}}>{v}</div>
            <div style={{fontFamily:T.fontMono,fontSize:9,color:sc}}>{s}</div>
          </div>
          );
        })}
      </div>
      {/* WEN MOON METER — mood badge based on SPY daily change. Hidden ≤640px by the
          .wen-moon-mobile rule (which IS in use — the old comment called it "unused", a
          label-outliving-its-data defect caught by the wave-17 audit). */}
      {badge&&<div className="wen-moon-mobile">{badge}</div>}
    </div>
  );
};
export default MacroStrip;
