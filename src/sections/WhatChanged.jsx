// ─── WHAT CHANGED (UI-OVERHAUL Slice 2, task 3.3) ───────────────────────────
// Extracted VERBATIM from dashboard.jsx: the C4 (v3.60) return-visit digest.
// PRESENTATION ONLY: summarizeEvidence/compareEvidence and the localStorage
// persist-AFTER-compare sequencing stay in the orchestrator — this renders the
// comparison it is handed. A null digest renders NOTHING (no baseline could be
// established: mock/thin evidence never seeds a diff), which doubles as the
// Property-9 guard — absent is a real state here, not an error.
// v3.61 (newcomer audit): the baseline is BROWSER-LOCAL (localStorage), not an
// account — the copy states the device scope rather than implying a server history.
import { T } from "../design-tokens.js";

const WhatChanged=({changed})=>{
  if(!changed)return null;
  return(
    <div style={{padding:"6px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"baseline",flexWrap:"wrap"}}>
      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase"}}>What changed</span>
      {changed.baseline
        ?<span style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>baseline set — tracking starts today on this device</span>
        :changed.changes.length
          ?changed.changes.slice(0,4).map((c,i)=>(
            <span key={i} style={{fontFamily:T.fontMono,fontSize:9,color:c.kind==="posture"?T.amber:T.textSecondary}}>{c.text}</span>))
          :<span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>no material change since your previous visit on this device ({String(changed.since||"").slice(0,10)})</span>}
    </div>
  );
};
export default WhatChanged;
