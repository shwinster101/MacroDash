// ─── STICKY SECTION NAV (UI-OVERHAUL wave 15, task 9.2) ─────────────────────
// Extracted from dashboard.jsx (was SectionNav). Two upgrades, both spec items:
// (1) ACTIVE TRACKING BY VIEWPORT (Req 3.7): an IntersectionObserver marks the
//     section actually on screen while the user scrolls. This SUPERSEDES the v3.62
//     hash-only tracking — that comment argued a scroll-spy "would disagree with
//     the URL", and the resolution here is that a CLICK still wins instantly (the
//     hash sets the active id synchronously) while scrolling updates it between
//     clicks; the observer needs no arbitrary pixel threshold because it marks the
//     LAST section heading to cross the top band of the viewport.
// (2) HAMBURGER AT ≤320px (Req 6.4): the row collapses into a native <details>
//     disclosure — CSS-switched (.nav-row/.nav-burger in the orchestrator's
//     stylesheet), no JS media queries, keyboard/AT behavior for free.
// Nav links get 44px tap targets at ≤480px via the same stylesheet.
import { useState, useEffect } from "react";
import { T } from "../design-tokens.js";

export const SECTIONS=[["overview","Overview"],["drivers","Drivers"],["markets","Markets"],["macro","Macro"],["ai","AI"],["health","Data Health"]];

const StickyNav=()=>{
  const [active,setActive]=useState(typeof window!=="undefined"?window.location.hash.slice(1):"");
  useEffect(()=>{
    const onHash=()=>setActive(window.location.hash.slice(1));
    window.addEventListener("hashchange",onHash);
    // Viewport tracking: observe each section anchor; the one whose top most recently
    // entered the upper quarter of the viewport is "where the reader is".
    let io=null;
    if(typeof IntersectionObserver!=="undefined"){
      io=new IntersectionObserver((entries)=>{
        for(const e of entries){
          if(e.isIntersecting)setActive(e.target.id);
        }
      },{rootMargin:"0px 0px -75% 0px"});
      SECTIONS.forEach(([id])=>{const el=document.getElementById(id);if(el)io.observe(el);});
    }
    return()=>{window.removeEventListener("hashchange",onHash);if(io)io.disconnect();};
  },[]);
  const links=SECTIONS.map(([id,label])=>{
    const on=active===id;
    return(
      <a key={id} href={`#${id}`} aria-current={on?"location":undefined} className="nav-link"
        style={{fontFamily:T.fontMono,fontSize:T.fsS,letterSpacing:"0.08em",color:on?T.textPrimary:T.textSecondary,textDecoration:"none",padding:"6px 10px",borderRadius:3,whiteSpace:"nowrap",
          background:on?T.surfaceHigh:"transparent",border:`1px solid ${on?T.borderAccent:"transparent"}`,display:"inline-flex",alignItems:"center"}}>{label}</a>
    );});
  return(
    <nav aria-label="Sections" style={{background:T.surface,borderBottom:`1px solid ${T.border}`,position:"sticky",top:"env(safe-area-inset-top)",zIndex:40}}>
      {/* Row form (>320px) */}
      <div className="nav-row" style={{display:"flex",gap:2,overflowX:"auto",padding:"4px 16px"}}>{links}</div>
      {/* Hamburger form (≤320px, Req 6.4) — native disclosure, CSS-switched, no JS needed */}
      <details className="nav-burger" style={{display:"none",padding:"4px 16px"}}>
        <summary aria-label="Sections menu" style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textSecondary,cursor:"pointer",listStyle:"none",padding:"6px 4px",minHeight:32,display:"flex",alignItems:"center",gap:6}}>☰ SECTIONS</summary>
        <div style={{display:"flex",flexDirection:"column",gap:2,paddingBottom:6}}>{links}</div>
      </details>
    </nav>
  );
};
export default StickyNav;
