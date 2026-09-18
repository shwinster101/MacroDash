// Presentation of the canonical EvidenceSet, never a second voting engine.
import { T } from "../design-tokens.js";
import { voteStyle } from "../regime.js";
import { voterSheet } from "../voterSheet.js";
import { driverRows } from "../driverRows.js";
import { DataModeBadge } from "../primitives/SourceBox.jsx";
import { Explainable } from "../primitives/FactSheet.jsx";

export default function DriversMatrix({ evidenceSet, drift=false }) {
  if(!evidenceSet||!Array.isArray(evidenceSet.factors))return <div aria-hidden="true"/>;
  return <div className="driver-matrix">
    <div style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textSecondary,marginBottom:8}}>
      <strong style={{fontSize:T.fsBody,color:T.textPrimary}}>Current factor evidence</strong> · {evidenceSet.state==="DEMO"?"Illustrative data — no live signals counted":evidenceSet.freshSummary}
      {evidenceSet.withheld&&" · posture withheld"}
      {drift&&<div style={{color:T.amber}}>Current signals differ from the saved 10am call above.</div>}
    </div>
    <div className="driver-columns driver-head" aria-hidden="true" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>
      <span>Signal / current reading</span><span>Model stance</span><span>Model change trigger</span><span>Data as of</span>
    </div>
    {driverRows(evidenceSet).map(f=>{
      const vs=voteStyle(f.available?f.vote:"excluded");
      return <Explainable key={f.key} explain={voterSheet(f)} title={f.explain?.full||f.label}
        eyebrow={`${f.short} · ${f.mode}${f.asOf?` · as of ${String(f.asOf).slice(0,10)}`:""}${!f.available?` · excluded — ${f.reason}`:` · ${f.reading}`}`}
        className="driver-card"
        style={{background:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${T[vs.colorKey]}`,borderRadius:4,padding:"10px 12px",marginBottom:5,minHeight:44}}>
        <div className="driver-columns">
          <div><div style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>{f.short} · {f.label} ⓘ</div>
            <div className="driver-reading" style={{fontFamily:T.fontMono,fontSize:T.fsL,color:T.textPrimary,overflowWrap:"anywhere"}}>{f.reading}</div></div>
          <div title={`${f.label}: ${vs.word}`} style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T[vs.colorKey],fontWeight:700}}>{f.stance}</div>
          <div className="driver-condition" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textSecondary}}>{f.condition}</div>
          <div><DataModeBadge mode={f.mode}/><div className="driver-date" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>{f.asOf?`as of ${String(f.asOf).slice(0,10)}`:"No dated reading"}</div>
            {!f.available&&<div className="driver-exclusion" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.amber}}>excluded — {f.reason}</div>}</div>
        </div>
      </Explainable>;
    })}
    <div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>Solo flip = one signal changing the model, with others fixed. Safety overrides still apply; no guaranteed safe entry.</div>
  </div>;
}
