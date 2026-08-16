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
import SourceBox from "../primitives/SourceBox.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

//        label        — the toggle's copy. v3.95 (owner call on a live Simple screenshot):
//                       in Simple this block IS the whole explanation, so it is labelled for
//                       what a reader is looking for ("why this posture") rather than for the
//                       method ("5 whys · today"); Power keeps the method label, where the
//                       group above it already says "the reasoning".
//        persistKey   — remember the open state per device, so a reader who wants the chain
//                       does not re-open it every visit (WHYS_KEY below; both call sites
//                       share ONE key — the same block, two altitudes, one preference).
export const WHYS_KEY="md:exp:whys:v1";

const FiveWhys=({fw,derivedLabel,mode,asOf,label="5 whys · today — narrative & provenance",persistKey=WHYS_KEY})=>{
  // Property 9 (null-safe): nothing computed yet means nothing to narrate — an empty,
  // hidden region, never a throw and never a fabricated narrative.
  if(!fw||!Array.isArray(fw.whys))return <div aria-hidden="true"/>;
  return(
    <div style={{padding:"9px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      {/* v3.93 QUIET-2 (screenshot-measured: three rows of chrome cost 100px at 390px for a
          collapsed block): ONE toggle row. The section header and the regime line are gone
          from the closed view — the regime state is a byte-for-byte duplicate of the hero
          verdict 100px above, so v3.25 is satisfied by the hero itself; the line rides
          INSIDE the collapse so the chain still opens with its own anchor. */}
      <CollapsedGroup count={5} label={label} chip={false} persistKey={persistKey}>
        <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,marginBottom:2}}>{fw.regime}</div>
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
