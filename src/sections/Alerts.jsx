// ─── MACRO ALERTS (UI-OVERHAUL wave 12, task 7.2) ───────────────────────────
// Extracted VERBATIM from dashboard.jsx: the alerts strip + its AlertRow. The
// EVALUATION (evalAlert, ALERT_METRICS, DEFAULT_ALERTS, alert state) stays in the
// orchestrator — FEAT-ALERT-EVAL is computation, and BLIND-vs-CLEAR is its contract.
// The !publicView boundary also stays at the call site (A4): monitors are the
// operator's, and the gate lives in ONE place. Null guard is the only addition.
import { T } from "../design-tokens.js";
import SectionHeader from "../primitives/SectionHeader.jsx";

// Alert row
const AlertRow=({alert,ev,onToggle,onDelete})=>{
  // BLIND is amber, never the green that would read as "checked and clear".
  const color=!alert.active?T.textMuted:ev.state==="triggered"?T.red:ev.state==="blind"?T.amber:T.green;
  const badge=ev.state==="triggered"?"TRIPPED":ev.state==="blind"?"BLIND":"clear";
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:T.surface,borderRadius:4,border:`1px solid ${ev.state==="triggered"&&alert.active?T.red:T.border}`}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,boxShadow:alert.active?`0 0 5px ${color}`:"none"}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textPrimary}}>{alert.label}
          {alert.active&&<span style={{fontFamily:T.fontMono,fontSize:8,color,marginLeft:6,letterSpacing:"0.08em"}}>{badge}</span>}
        </div>
        <div style={{fontFamily:T.fontMono,fontSize:9,color:ev.state==="blind"?T.amber:T.textMuted}}>
          {ev.state==="blind"?ev.why:ev.detail||`${alert.condition} ${alert.value}${alert.unit}`}
        </div>
      </div>
      <button onClick={()=>onToggle(alert.id)} aria-label={`Toggle alert ${alert.label}`}
        style={{fontFamily:T.fontMono,fontSize:9,background:"none",border:`1px solid ${T.border}`,color:T.textSecondary,padding:"6px 10px",minWidth:44,minHeight:44,borderRadius:3,cursor:"pointer"}}>
        {alert.active?"ON":"OFF"}
      </button>
      <button onClick={()=>onDelete(alert.id)} aria-label={`Delete alert ${alert.label}`}
        style={{fontFamily:T.fontMono,fontSize:9,background:"none",border:`1px solid ${T.redDim}`,color:T.red,padding:"6px 8px",minWidth:44,minHeight:44,borderRadius:3,cursor:"pointer"}}>✕</button>
    </div>
  );
};

const Alerts=({alerts,alertEval,onToggle,onDelete})=>{
  if(!Array.isArray(alerts)||!alertEval)return <div aria-hidden="true"/>;
  /* A4 (v3.58): PRIVATE on the shareable route — page-local toggles imply user state a
     visitor does not have; monitors are the operator's, not the share view's. */
  return(
        <div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <SectionHeader>Macro Alerts</SectionHeader>
            {/* Public audit: an ON/OFF toggle beside 8px muted "notifications not wired" reads as
                a working alert system. The toggles are real (they gate the triggered dot on this
                page) but nothing is DELIVERED, so the limit is stated at the same weight as the
                control — the honesty invariant applied to an affordance instead of a number. */}
            <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,border:`1px solid ${T.amber}44`,borderRadius:3,padding:"2px 7px"}}>
              ⚠ Evaluated live on THIS page only — no push, email or SMS is sent
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:6}}>
            {alerts.map(a=><AlertRow key={a.id} alert={a} ev={alertEval[a.id]} onToggle={onToggle} onDelete={onDelete}/>)}
          </div>
        </div>
  );
};
export default Alerts;
