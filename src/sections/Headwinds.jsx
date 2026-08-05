// ─── TOP HEADWINDS (UI-OVERHAUL wave 9, task 5.4) ───────────────────────────
// Extracted VERBATIM from dashboard.jsx. The per-row expand state moved INSIDE the
// component (nothing external ever read it — the CollapsedGroup self-contained-state
// precedent). The only other addition is the Property-9 null guard.
import { useState } from "react";
import { T } from "../design-tokens.js";
import { Badge } from "../primitives/atoms.jsx";
import SectionHeader from "../primitives/SectionHeader.jsx";
import { ILLUS_HATCH, IllustrativeChip } from "../primitives/Illustrative.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

const Headwinds=({d})=>{
  const [expandedHW,setExpandedHW]=useState(null);
  if(!d||!Array.isArray(d.headwinds))return <div aria-hidden="true"/>;
  /* Top headwinds — curated thesis register, honestly dated. FEAT-322: the list
     collapses to 0 visible (the largest curated block must not own the default
     scroll); WHY #4 still reads d.headwinds regardless of render state, so the
     5-Whys narrative loses nothing. One disclosure idiom only — the old "+N more"
     sub-toggle is gone; open shows all. */
  return(
            <div style={{background:T.surface,backgroundImage:ILLUS_HATCH,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                <SectionHeader>Top Headwinds</SectionHeader>
                <IllustrativeChip label={`ILLUSTRATIVE · reviewed ${d.headwindsAsOf}`}/>
              </div>
              <CollapsedGroup count={d.headwinds.length} label="curated headwinds" chip={false}>
                {d.headwinds.map(hw=>{
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
              </CollapsedGroup>
            </div>
  );
};
export default Headwinds;
