// ─── SIGNAL QUALITY + BACKDROP CONFIDENCE (UI-OVERHAUL Slice 2, task 3.2) ───
// Extracted VERBATIM from dashboard.jsx: the at-a-glance data-trust strip (live vs
// stale vs mock) plus the VERDICT's own confidence — how many factors actually voted,
// with excluded ones NAMED and the crash gauge (VIX) called out when blind.
// PRESENTATION ONLY: the SIGNAL_FIELDS census (sq) and the regimeConf derivation
// (from the EvidenceSet, FIX-E) stay in the orchestrator. Prop names match the
// orchestrator's locals so the markup is byte-identical.
// A11Y: this is a LANDMARK, not a live region — the one polite status sentence lives
// in the orchestrator (B4 v3.59: a reader should hear "the evidence base changed",
// not blocks re-read). The only addition is the Property-9 null guard.
import { T } from "../design-tokens.js";

/* v3.94 DRIVERS-ONLY: the strip is the CENSUS one-liner only. The verdict-confidence
   segments (BACKDROP N/M voting · excluded names · the red crash-gauge warning) moved into
   the hero's status line — they are facts about the VERDICT and now sit beside it, so this
   strip and the hero can never disagree about them (one render site). The withheld state
   keeps its own red POSTURE WITHHELD copy in the hero (v3.25: red facts stay visible). */
const SignalQuality=({sq})=>{
  if(!sq)return <div aria-hidden="true"/>;
  return(
    <div role="region" aria-label="Signal quality"
      style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"5px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase"}}>Signal Quality</span>
      <span style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.green}}>● {sq.fresh} fresh{sq.fresh>0&&<span style={{color:T.textMuted}}> ({sq.live} live · {sq.cached} cached)</span>}</span>
      {sq.stale>0&&<span style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.amber}}>⏱ {sq.stale} stale</span>}
      {sq.mock>0&&<span style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>○ {sq.mock} mock</span>}
      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>of {sq.total} tracked</span>
      {/* v3.61: the v3.1 decode legend lives in the Data Health expander — explanation,
          not evidence, and the strip's job is the one-line tell. */}
    </div>
  );
};
export default SignalQuality;
