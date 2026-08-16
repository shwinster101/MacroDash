// ─── SHARED S-TIER PICKS (v3.97 SHAREABLE SIMPLE) ───────────────────────────
// The bottom strip of the Simple view: the owner's live S-tier names, fetched from the
// deliberately-public /api/picks whitelist projection (tickers + tier + optional
// owner-authored share_note — never PTs, positions, theses, ranks, composites).
// PRESENTATION ONLY: the fetch lives in the orchestrator (the section contract).
//
// HONESTY RULE — renders ONLY live-fetched data. A fetch failure, an empty list, or a
// mock/demo build (the orchestrator never fetches there) all render NOTHING: example or
// mock picks must never appear on a page a friend reads as "my picks" — the v3.1
// fabricated-directional-call invariant applied to conviction.
//
// Chips are <div>s, NOT buttons — they open nothing, and a button that does nothing is a
// lie (the CUT-row rule). The strip carries its own not-advice line and the book's asOf.
import { T } from "../design-tokens.js";

const SharedPicks=({picks})=>{
  if(!picks||!Array.isArray(picks.picks)||picks.picks.length===0)return null;
  return(
    <div role="region" aria-label="My S-tier picks"
      style={{padding:"10px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:T.fontMono,fontSize:8,color:T.amber,letterSpacing:"0.12em",textTransform:"uppercase"}}>My S-Tier</span>
        <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>highest-conviction names · personal conviction, not investment advice</span>
        {picks.asOf&&<span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>as of {picks.asOf}</span>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
        {picks.picks.map((p)=>(
          <div key={p.sym} style={{border:`1px solid ${T.amber}55`,borderRadius:4,padding:"4px 8px",background:`${T.amber}0d`}}>
            <span style={{fontFamily:T.fontMono,fontSize:T.fsM,fontWeight:700,color:T.textPrimary}}>{p.sym}</span>
            {p.note&&<span style={{fontFamily:T.fontSans,fontSize:T.fsS,color:T.textSecondary,marginLeft:6}}>{p.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
export default SharedPicks;
