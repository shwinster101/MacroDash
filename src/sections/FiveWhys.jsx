// ─── 5 WHYS · TODAY (UI-OVERHAUL Slice 1, task 1.4) ─────────────────────────
// Extracted VERBATIM from dashboard.jsx (the v3.69 NARRATIVE-FIRST overview strip).
// PRESENTATION ONLY: computeFiveWhys, the FW_FIELDS freshness set, the A1 liveBuild
// gating and the derivedLabel derivation all stay in the orchestrator — this renders
// what it is handed.
// v3.92 QUIET OVERVIEW (owner call, REVERSING the v3.61/v3.62 "full 5 Whys stays
// expanded" ruling on a live phone screenshot): the five-paragraph chain collapses
// behind the house CollapsedGroup. The v3.25 rule holds — the regime state line (the
// one red/amber fact this block carries) stays OUTSIDE the collapse, visible while
// closed; the chain, headline and provenance are verbatim one tap deep. The
// public-render suite opens the expander before reading the LOADING/ERROR anchors
// ("0/3 core inputs usable") and pins the closed summary separately.
//
// Props: fw           — computeFiveWhys() output ({regime, headline, whys[]})
//        derivedLabel — the state-derived footer (B2 v3.59: one derivation, both footers)
//        mode / asOf  — provenance for the SourceBox (anchored to the equity close: a
//                       market synthesis is "as of the last close"; a secondary input
//                       FRED publishes a day late must not drag the whole badge STALE)
import { T } from "../design-tokens.js";
import SectionHeader from "../primitives/SectionHeader.jsx";
import SourceBox from "../primitives/SourceBox.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

const FiveWhys=({fw,derivedLabel,mode,asOf})=>{
  // Property 9 (null-safe): nothing computed yet means nothing to narrate — an empty,
  // hidden region, never a throw and never a fabricated narrative.
  if(!fw||!Array.isArray(fw.whys))return <div aria-hidden="true"/>;
  return(
    <div style={{padding:"10px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      <SectionHeader>5 Whys · Today</SectionHeader>
      {/* The signal stays visible while closed (v3.25): the regime state is this block's
          one decision-relevant fact, so it lives OUTSIDE the collapse. */}
      <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,marginBottom:2}}>{fw.regime}</div>
      <CollapsedGroup count={5} label="the why chain — narrative & provenance" chip={false}>
        <div style={{fontFamily:T.fontSans,fontSize:12,color:T.textSecondary,lineHeight:1.6,fontStyle:"italic"}}>"{fw.headline}"</div>
        {fw.whys.map((w,i)=>(
          <div key={i} style={{borderLeft:`2px solid ${T.amber}44`,paddingLeft:8,marginTop:8}}>
            <div style={{fontFamily:T.fontMono,fontSize:8,color:T.amber}}>WHY #{i+1}</div>
            <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textSecondary,lineHeight:1.5}}>{w}</div>
          </div>
        ))}
        <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:8}}>Rule-based · {derivedLabel} (no LLM)</div>
        <SourceBox api="Rule-based" endpoint="6-factor regime · stale inputs excluded" mode={mode} asOf={asOf}/>
      </CollapsedGroup>
    </div>
  );
};
export default FiveWhys;
