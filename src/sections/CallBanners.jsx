// ─── CALL BANNERS — MacroFlipBanner + PanicOverrideBanner (v6.5.5 decomposition, Zone 3) ──
// Moved VERBATIM from dashboard.jsx. Presentation only: the orchestrator decides WHICH banner
// renders (panic first, then an armed/tripped flip, else nothing — the call site keeps that
// ladder) and hands over the computed flip state / the canonical daily call. Neither banner
// reads data, storage or a hook; both render nothing meaningful on a null input by construction
// of the call site, and each carries its own null guard as the Property-9 rule asks.
import { DT, T } from "../design-tokens.js";
import { simpleCallLabel } from "../publicCopy.js";

// ─── FEAT-331 · MACRO FLIP BANNER (the TT circuit, surfaced on the page) ──────
// The maintainer's most consequential circuit lived only in the TT docs. Now it renders
// from live data: TRIPPED (SPY < 200d AND VIX > 25) = de-risk; ARMED (VIX > 22) = pre-stage.
// Rendered ONLY when flip is non-null (live+fresh inputs) AND armed/tripped — never rents
// space at rest, and never fabricates a circuit state on mock/stale data.
export function MacroFlipBanner({flip}){
  if(!flip||!flip.inputs)return null;
  const tripped=flip.tripped===true;
  const {vix,spy_price,spy_ma200}=flip.inputs;
  const bg=tripped?DT["regime-off-bg"]:DT["regime-mix-bg"];
  const fg=tripped?T.red:T.amber;
  return(
    <div style={{background:bg,borderBottom:`1px solid ${fg}55`,padding:"7px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontFamily:T.fontMono,fontSize:11,fontWeight:700,color:fg,letterSpacing:"0.04em"}}>
        {tripped?"⛔ MACRO FLIP TRIPPED":"⚠ MACRO FLIP ARMED"}
      </span>
      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>
        {tripped
          ? `SPY $${spy_price} below 200-DMA $${spy_ma200} · VIX ${vix} > 25 — de-risk protocol`
          : `VIX ${vix} > 22 · trips if SPY < 200-DMA${spy_ma200!=null?` ($${spy_ma200})`:""} with VIX > 25 — pre-stage GTC buy-to-close`}
      </span>
    </div>
  );
}

export function PanicOverrideBanner({call,simple=false}){
  if(!call)return null;
  return(
  <div style={{background:DT["regime-off-bg"],borderBottom:`1px solid ${T.red}55`,padding:"7px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
    <span style={{fontFamily:T.fontMono,fontSize:11,fontWeight:700,color:T.red,letterSpacing:"0.04em"}}>
      ⛔ PANIC OVERRIDE · {simple?simpleCallLabel(call):<>{call.headline} {call.emoji} / {call.direction}</>}
    </span>
    <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>
      Crash circuit confirmed — new risk adds are suspended until the stress signal clears.
    </span>
  </div>
  );
}
