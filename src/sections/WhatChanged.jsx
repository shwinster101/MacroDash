// Device-local return-visit digest, not global market history.
import { T } from "../design-tokens.js";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";
export default function WhatChanged({changed}) {
  if(!changed)return null;
  const changes=changed.changes||[];
  return <div className="what-changed" style={{padding:"8px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`,fontFamily:T.fontMono,fontSize:T.fsM,color:T.textSecondary}}>
    <strong style={{fontSize:T.fsL,color:T.textPrimary}}>What changed</strong> · {changed.baseline?"Tracking starts today on this device":
      changes.length?`${changes.length} material change${changes.length===1?"":"s"} since your previous visit on this device`:
      `No material change since your previous visit on this device (${String(changed.since||"").slice(0,10)})`}
    {!changed.baseline&&changes.length>0&&<div style={{marginTop:4,color:changes[0].kind==="posture"?T.amber:T.textSecondary}}>{changes[0].text}</div>}
    {!changed.baseline&&changes.length>1&&<CollapsedGroup chip={false} count={changes.length-1} label="More changes since your previous visit">
      {changes.slice(1).map((c,i)=><div key={i} style={{padding:"4px 0",color:c.kind==="posture"?T.amber:T.textSecondary}}>{c.text}</div>)}
    </CollapsedGroup>}
  </div>;
}
