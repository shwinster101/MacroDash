// ─── MY CONVICTION · WATCHLIST (UI-OVERHAUL wave 12, task 7.4) ──────────────
// Extracted VERBATIM from dashboard.jsx: the S/A conviction tiers — names + tiers
// only, no prices. A4: PRIVATE on the shareable route; the !publicView gate stays
// at the call site (one boundary, one place). The open/closed state moved INSIDE
// (nothing external read it — the CollapsedGroup precedent). Null guard added.
import { useState } from "react";
import { T } from "../design-tokens.js";
import SourceBox from "../primitives/SourceBox.jsx";

const Watchlist=({watchlist})=>{
  const [watchlistOpen,setWatchlistOpen]=useState(false); // FEAT-322: default closed — curated content doesn't own the default view
  if(!Array.isArray(watchlist))return <div aria-hidden="true"/>;
  return(
<div style={{marginTop:16,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
          <button onClick={()=>setWatchlistOpen(o=>!o)} aria-expanded={watchlistOpen}
            style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"none",border:"none",cursor:"pointer",borderBottom:watchlistOpen?`1px solid ${T.border}`:"none"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontFamily:T.fontMono,fontSize:10,color:T.amber,letterSpacing:"0.1em"}}>MY CONVICTION</span>
              <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Personal watchlist · tiered by conviction · no prices</span>
            </div>
            <span style={{fontFamily:T.fontMono,fontSize:10,color:T.textMuted}}>{watchlistOpen?"▲":"▼"}</span>
          </button>
          {watchlistOpen&&(
            <div style={{padding:"12px 16px 16px"}}>
              {[
                {tier:"S", accent:T.amber, blurb:"Highest conviction · core holdings"},
                {tier:"A", accent:T.blue,  blurb:"High conviction · sized below S"},
              ].map(({tier,accent,blurb})=>{
                // v3.97 fix: read the PROP — `d` was never in scope after the wave-9
                // extraction, so expanding this panel threw a ReferenceError (latent only
                // because it defaults closed and is Power+operator-only).
                const picks=(watchlist||[]).filter(w=>w.tier===tier);
                if(!picks.length) return null;
                return(
                  <div key={tier} style={{marginBottom:14}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                      <span style={{fontFamily:T.fontMono,fontSize:13,fontWeight:700,color:accent,border:`1px solid ${accent}66`,borderRadius:3,padding:"1px 8px",background:accent+"18"}}>{tier}</span>
                      <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.08em"}}>{blurb.toUpperCase()}</span>
                      <div style={{height:1,flex:1,background:T.border}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                      {picks.map(w=>(
                        <div key={w.ticker} style={{background:T.surfaceHigh,border:`1px solid ${accent}33`,borderLeft:`3px solid ${accent}`,borderRadius:5,padding:"9px 11px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:6}}>
                            <span style={{fontFamily:T.fontMono,fontSize:13,fontWeight:700,color:T.textPrimary}}>{w.ticker}</span>
                            <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,textAlign:"right"}}>{w.name}</span>
                          </div>
                          {w.thesis&&<div style={{fontFamily:T.fontSans,fontSize:10,color:T.textSecondary,lineHeight:1.4,marginTop:5}}>{w.thesis}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <SourceBox api="Manual" endpoint="personal watchlist · names + tiers only" mode="MOCK"/>
            </div>
          )}
        </div>
  );
};
export default Watchlist;
