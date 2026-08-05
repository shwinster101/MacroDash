// ─── 5 WHYS · TODAY (UI-OVERHAUL Slice 1, task 1.4) ─────────────────────────
// Extracted VERBATIM from dashboard.jsx (the v3.69 NARRATIVE-FIRST overview strip).
// PRESENTATION ONLY: computeFiveWhys, the FW_FIELDS freshness set, the A1 liveBuild
// gating and the derivedLabel derivation all stay in the orchestrator — this renders
// what it is handed. Always expanded (owner-pinned): the LOADING/ERROR anchors
// ("0/3 core inputs usable") are read from body innerText by the public-render suite,
// so this block must never collapse. The only addition is the Property-9 null guard.
//
// Props: fw           — computeFiveWhys() output ({regime, headline, whys[]})
//        derivedLabel — the state-derived footer (B2 v3.59: one derivation, both footers)
//        mode / asOf  — provenance for the SourceBox (anchored to the equity close: a
//                       market synthesis is "as of the last close"; a secondary input
//                       FRED publishes a day late must not drag the whole badge STALE)
import { T } from "../design-tokens.js";
import SectionHeader from "../primitives/SectionHeader.jsx";
import SourceBox from "../primitives/SourceBox.jsx";

const FiveWhys=({fw,derivedLabel,mode,asOf})=>{
  // Property 9 (null-safe): nothing computed yet means nothing to narrate — an empty,
  // hidden region, never a throw and never a fabricated narrative.
  if(!fw||!Array.isArray(fw.whys))return <div aria-hidden="true"/>;
  return(
    <div style={{padding:"10px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      <SectionHeader>5 Whys · Today</SectionHeader>
      <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,marginBottom:6}}>{fw.regime}</div>
      <div style={{fontFamily:T.fontSans,fontSize:12,color:T.textSecondary,lineHeight:1.6,fontStyle:"italic"}}>"{fw.headline}"</div>
      {fw.whys.map((w,i)=>(
        <div key={i} style={{borderLeft:`2px solid ${T.amber}44`,paddingLeft:8,marginTop:8}}>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.amber}}>WHY #{i+1}</div>
          <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textSecondary,lineHeight:1.5}}>{w}</div>
        </div>
      ))}
      <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:8}}>Rule-based · {derivedLabel} (no LLM)</div>
      <SourceBox api="Rule-based" endpoint="6-factor regime · stale inputs excluded" mode={mode} asOf={asOf}/>
    </div>
  );
};
export default FiveWhys;
