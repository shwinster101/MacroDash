// ─── DATA HEALTH (UI-OVERHAUL wave 12, task 7.3) ────────────────────────────
// Extracted VERBATIM from dashboard.jsx: is the product current, degraded, or
// recovering? Per-source mode · cadence · as-of behind one expander; the ERROR +
// Retry row stays OUTSIDE the collapse (v3.25: an outage must not need a click to
// discover). PRESENTATION ONLY — the census fields, modeOf and retry() are the
// orchestrator's; cadenceOf comes straight from sources.js (pure, one home).
import { T } from "../design-tokens.js";
import { cadenceOf } from "../sources.js";
import SectionHeader from "../primitives/SectionHeader.jsx";
import { DataModeBadge } from "../primitives/SourceBox.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

const DataHealth=({signalFields,modeOf,dataAsOf,mode,lastError,retry})=>{
  if(!Array.isArray(signalFields)||typeof modeOf!=="function")return <div aria-hidden="true"/>;
  const SIGNAL_FIELDS=signalFields;
  return(
        <section aria-labelledby="health" style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"12px 16px"}}>
          <h2 id="health" className="visually-hidden">Data health — per-source freshness and recovery</h2>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <SectionHeader>Data Health</SectionHeader>
            {mode==="ERROR"&&<div style={{fontFamily:T.fontMono,fontSize:9,color:T.red,display:"flex",gap:8,alignItems:"center"}}>
              live fetch failed{lastError?`: ${String(lastError).slice(0,60)}`:""}
              <button onClick={retry} style={{fontFamily:T.fontMono,fontSize:9,background:T.surfaceHigh,border:`1px solid ${T.red}66`,color:T.red,padding:"2px 8px",borderRadius:3,cursor:"pointer"}}>↻ RETRY</button>
            </div>}
          </div>
          {/* FEAT-GLANCE (v3.61): the 15-row per-source grid is diagnostic depth, one tap
              away. The section header + the ERROR/Retry row stay outside the collapse —
              an outage is a red fact and must not need a click to discover. */}
          <CollapsedGroup count={SIGNAL_FIELDS.length} label="per-source detail" chip={false}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:6}}>
            {SIGNAL_FIELDS.map(k=>(
              <div key={k} style={{display:"flex",gap:6,alignItems:"center",fontFamily:T.fontMono,fontSize:9,color:T.textSecondary,padding:"4px 6px",background:T.bg,borderRadius:3,flexWrap:"wrap"}}>
                <span style={{minWidth:88,color:T.textPrimary}}>{k}</span>
                <DataModeBadge mode={modeOf(k)}/>
                <span style={{fontSize:8,color:T.textMuted}}>{cadenceOf(k)}</span>
                {dataAsOf?.[k]&&<span style={{fontSize:8,color:T.textMuted}}>{String(dataAsOf[k]).slice(0,10)}</span>}
              </div>
            ))}
          </div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:6}}>
            cadence is each source's normal release rhythm — a monthly print weeks old can still be the freshest available
          </div>
          {/* The chip legend lives with the diagnostics it decodes (moved from the always-visible
              Signal Quality strip, v3.61 — explanation, not evidence). */}
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:4}}>legend: ● live · ⏱ stale · <span style={{color:T.amber}}>◫ illustrative = curated, not live</span></div>
          </CollapsedGroup>
        </section>
  );
};
export default DataHealth;
