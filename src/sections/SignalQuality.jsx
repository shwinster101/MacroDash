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

const SignalQuality=({sq,regimeConf,regime})=>{
  if(!sq||!regimeConf||!regime)return <div aria-hidden="true"/>;
  return(
    <div role="region" aria-label="Signal quality and backdrop confidence"
      style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"5px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase"}}>Signal Quality</span>
      <span style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.green}}>● {sq.fresh} fresh{sq.fresh>0&&<span style={{color:T.textMuted}}> ({sq.live} live · {sq.cached} cached)</span>}</span>
      {sq.stale>0&&<span style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.amber}}>⏱ {sq.stale} stale</span>}
      {sq.mock>0&&<span style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>○ {sq.mock} mock</span>}
      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>of {sq.total} tracked</span>
      {/* The verdict's own confidence, not the tile census. */}
      <span style={{fontFamily:T.fontMono,fontSize:9,color:regime.insufficient?T.red:regimeConf.counted===regimeConf.total?T.green:T.amber,borderLeft:`1px solid ${T.border}`,paddingLeft:10}}>
        BACKDROP {regimeConf.counted}/{regimeConf.total} factors voting{regime.insufficient?` — POSTURE WITHHELD (needs ${regime.quorum})`:""}
      </span>
      {regimeConf.excluded.length>0&&(
        <span style={{fontFamily:T.fontMono,fontSize:8,color:T.amber}}>excluded: {regimeConf.excluded.join(" · ")}</span>
      )}
      {regimeConf.blind&&(
        <span style={{fontFamily:T.fontMono,fontSize:8,color:T.red}}>⚠ crash gauge (VIX) unavailable</span>
      )}
      {/* v3.61: the v3.1 decode legend moved into the Data Health expander — explanation,
          not evidence, and the strip's job is the one-line tell. */}
    </div>
  );
};
export default SignalQuality;
