// ─── DRIVERS EVIDENCE MATRIX (C3, v3.60 — v6.5.5 decomposition, Zone 4) ────────
// Moved VERBATIM from dashboard.jsx: the six factor cards that render the EvidenceSet
// CONTRACT (evidenceSet.factors — value · vote · freshness · as-of · exclusion reason), never
// their own reading of provenance. Presentation only: the {!simple&&…} gate, the <section
// aria-labelledby="drivers"> landmark and its h2 anchor STAY at the call site (the
// Alerts/Watchlist gate-at-the-wrapper pattern) so the nav outline is one structure.
// Imports voteStyle from the pure engine (the MacroStrip/RegimeBand exception) so the card's
// vote colour resolves through the SAME map as the hero chips — the two altitudes cannot
// disagree (FEAT-NEUTRAL, v3.62). Null guard is the only addition (Property 9).
import { T } from "../design-tokens.js";
import { voteStyle } from "../regime.js";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";
import { DataModeBadge } from "../primitives/SourceBox.jsx";
import { Explainable } from "../primitives/FactSheet.jsx";

export default function DriversMatrix({ evidenceSet }) {
  if(!evidenceSet||!Array.isArray(evidenceSet.factors))return <div aria-hidden="true"/>;
  return (
    <CollapsedGroup count={evidenceSet.factors.length} chip={false}
      label={`factor evidence — used in today's posture · ${evidenceSet.freshSummary}${evidenceSet.withheld?" · posture withheld":""}`}>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {evidenceSet.factors.map(f=>{
        // FEAT-NEUTRAL (v3.62): resolves through the SAME shared map as the hero chips.
        // This card was already 4-state and correct; routing it through voteStyle is what
        // makes it structurally impossible for the two altitudes to disagree again.
        const vc=T[voteStyle(f.vote).colorKey];
        return (
          <Explainable key={f.key} explain={f.explain} title={f.explain?.full || f.label}
            eyebrow={`${f.short} · ${f.mode}${f.asOf?` · as of ${String(f.asOf).slice(0,10)}`:""}${f.excluded?` · excluded — ${f.reason}`:""}`}
            ariaLabel={`Explain ${f.label}`} className="driver-card"
            style={{flex:"1 1 240px",minWidth:0,background:T.surface,border:`1px solid ${f.excluded?T.amber+"44":T.border}`,borderRadius:5,padding:"8px 10px",opacity:f.excluded?0.85:1}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}>
              <span style={{fontFamily:T.fontMono,fontSize:T.fsL,fontWeight:700,color:T.textPrimary}}>{f.short} <span style={{fontWeight:400,color:T.textMuted}}>{f.label}</span></span>
              <span style={{fontFamily:T.fontMono,fontSize:T.fsM,fontWeight:700,color:vc,textTransform:"uppercase"}}>{f.vote}</span>
            </div>
            <div className="driver-reading" style={{fontFamily:T.fontMono,fontSize:T.fsL,color:T.textSecondary,marginTop:3,overflowWrap:"anywhere"}}>{f.display}</div>
            <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
              <DataModeBadge mode={f.mode}/>
              {f.asOf&&<span className="driver-date" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>as of {String(f.asOf).slice(0,10)}</span>}
              {f.excluded&&<span className="driver-exclusion" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.amber}}>excluded — {f.reason}</span>}
            </div>
          </Explainable>
        );})}
    </div>
    </CollapsedGroup>
  );
}
