import { useEffect, useState } from "react";
import { T } from "./design-tokens.js";

const mono={fontFamily:T.fontMono};

function PageShell({ title, eyebrow, children }) {
  return <main style={{minHeight:"100vh",background:T.bg,color:T.textPrimary,fontFamily:T.fontSans,padding:"env(safe-area-inset-top) max(20px,env(safe-area-inset-right)) 48px max(20px,env(safe-area-inset-left))"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box}body{margin:0;background:${T.bg}}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid ${T.amber};outline-offset:3px}.md-page{max-width:920px;margin:0 auto}.md-flow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}@media(max-width:700px){.md-flow{grid-template-columns:1fr}.md-flow-arrow{transform:rotate(90deg)}}`}</style>
    <div className="md-page">
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",padding:"12px 0 24px",borderBottom:`1px solid ${T.border}`}}>
        <a href="/" style={{...mono,fontSize:20,fontWeight:800,color:T.amber,textDecoration:"none"}}>MacroDash</a>
        <nav aria-label="Public pages" style={{display:"flex",gap:14,flexWrap:"wrap"}}>
          <a href="/" style={{...mono,fontSize:10,color:T.textSecondary}}>Dashboard</a>
          <a href="/history" style={{...mono,fontSize:10,color:T.textSecondary}}>History</a>
          <a href="/difference" style={{...mono,fontSize:10,color:T.textSecondary}}>Difference</a>
          <a href="/readout.json" style={{...mono,fontSize:10,color:T.textSecondary}}>JSON</a>
        </nav>
      </header>
      <section style={{padding:"42px 0 22px"}}>
        <div style={{...mono,fontSize:9,letterSpacing:"0.14em",color:T.amber,textTransform:"uppercase"}}>{eyebrow}</div>
        <h1 style={{fontFamily:T.fontDisplay,fontSize:"clamp(30px,6vw,54px)",lineHeight:1.02,margin:"10px 0 0",letterSpacing:"-0.03em"}}>{title}</h1>
      </section>
      {children}
      <footer style={{marginTop:42,paddingTop:14,borderTop:`1px solid ${T.border}`,...mono,fontSize:9,color:T.textMuted}}>MacroDash · end-of-day sources · not financial advice</footer>
    </div>
  </main>;
}

const stateColor=(direction)=>direction==="BULLISH"?T.green:direction==="BEARISH"?T.red:direction==="NEUTRAL"?T.amber:T.textMuted;

export function HistoryPage() {
  const [state,setState]=useState({loading:true,error:null,rows:[],start:null});
  useEffect(()=>{
    document.title="MacroDash Regime History";
    let dead=false;
    fetch("/history.json").then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(j=>{if(!j.available)throw new Error("history unavailable");if(!dead)setState({loading:false,error:null,rows:Array.isArray(j.rows)?j.rows:[],start:j.history_start||null});})
      .catch(()=>{if(!dead)setState({loading:false,error:"History is temporarily unavailable.",rows:[],start:null});});
    return()=>{dead=true;};
  },[]);
  return <PageShell eyebrow="Accountability" title="The call, frozen daily.">
    <p style={{maxWidth:700,lineHeight:1.65,color:T.textSecondary,margin:"0 0 26px"}}>This is a live-forward record, captured once at 10:00am ET each market weekday. There is no reconstructed backfill. Withheld calls and system failures stay visible.</p>
    {state.loading&&<p style={{...mono,color:T.textMuted}}>Loading live history…</p>}
    {state.error&&<p role="alert" style={{...mono,color:T.red}}>{state.error}</p>}
    {!state.loading&&!state.error&&!state.rows.length&&<div style={{border:`1px solid ${T.borderAccent}`,borderRadius:6,padding:20,background:T.surface}}>
      <div style={{...mono,color:T.amber,fontWeight:700}}>HISTORY STARTS WITH THE NEXT 10AM ET CAPTURE</div>
      <p style={{margin:"8px 0 0",color:T.textSecondary}}>No retroactive label will be invented to make the chart look fuller.</p>
    </div>}
    {!!state.rows.length&&<ol aria-label="Daily MacroDash calls" style={{listStyle:"none",padding:0,margin:0,display:"grid",gap:10}}>
      {state.rows.map((row)=>{
        const c=row.call;
        const color=stateColor(c?.direction);
        return <li key={row.date} style={{background:T.surface,border:`1px solid ${row.capture_status==="FAILED"?T.red+"66":T.border}`,borderRadius:6,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"baseline",flexWrap:"wrap"}}>
            <time dateTime={row.date} style={{...mono,fontSize:11,color:T.textSecondary}}>{row.date}</time>
            <span style={{...mono,fontSize:9,color:T.textMuted}}>10:00 ET · immutable call</span>
          </div>
          {c?<>
            <div style={{display:"flex",gap:12,alignItems:"baseline",flexWrap:"wrap",marginTop:8}}>
              <strong style={{...mono,fontSize:22,color}}>{c.headline||"CAN'T CALL IT"} {c.emoji||"🌫️"}</strong>
              <span style={{...mono,fontSize:13,color}}>{c.direction||"DATA HOLD"}</span>
              {c.override?.active&&<span style={{...mono,fontSize:10,color:T.red,border:`1px solid ${T.red}`,padding:"2px 6px",borderRadius:3}}>PANIC OVERRIDE</span>}
            </div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:7,...mono,fontSize:10,color:T.textSecondary}}>
              <span>confidence {c.confidence}</span><span>actionability {c.actionability}</span><span>{c.counts?.usable??0}/{c.counts?.total??6} factors</span>
            </div>
            <details style={{marginTop:10}}>
              <summary style={{...mono,fontSize:10,color:T.textMuted,cursor:"pointer",minHeight:36,display:"flex",alignItems:"center"}}>Six-factor evidence</summary>
              <div style={{display:"grid",gap:5,paddingTop:5}}>{(c.factors||[]).map(f=><div key={f.key} style={{display:"grid",gridTemplateColumns:"minmax(100px,1fr) minmax(90px,auto)",gap:12,...mono,fontSize:9}}><span style={{color:T.textSecondary}}>{f.label}{f.as_of?` · ${f.as_of}`:""}</span><span style={{color:stateColor(f.state),textAlign:"right"}}>{f.state||"UNAVAILABLE"}</span></div>)}</div>
            </details>
          </>:<div style={{marginTop:8}}><strong style={{...mono,color:T.red}}>CAPTURE FAILED</strong><p style={{margin:"5px 0 0",color:T.textSecondary}}>{row.failure||"The scheduled call could not be recorded."}</p></div>}
        </li>;
      })}
    </ol>}
  </PageShell>;
}

export function DifferencePage() {
  useEffect(()=>{document.title="Why MacroDash Is Different";},[]);
  const steps=["Six factors","Evidence quality","Market posture","Explanation","Actionability"];
  return <PageShell eyebrow="Why MacroDash" title="Macro state, compressed into a posture.">
    <p style={{fontSize:20,lineHeight:1.55,maxWidth:820,margin:"0 0 28px"}}><a href="https://nowflation.com/" style={{color:T.textPrimary}}>Nowflation</a> measures the inflation state. MacroDash translates the entire macro state into risk posture.</p>
    <div className="md-flow" aria-label="MacroDash decision hierarchy" style={{margin:"28px 0"}}>{steps.map((s,i)=><div key={s} style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,minHeight:82,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:12,background:T.surface,border:`1px solid ${i===2?T.amber:T.border}`,borderRadius:5,...mono,fontSize:11,color:i===2?T.amber:T.textSecondary}}>{s}</div>{i<steps.length-1&&<span className="md-flow-arrow" aria-hidden="true" style={{color:T.textMuted}}>→</span>}</div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginTop:30}}>
      <section style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:18}}><h2 style={{...mono,fontSize:12,color:T.green,margin:"0 0 8px"}}>THE JOB</h2><p style={{margin:0,lineHeight:1.6,color:T.textSecondary}}>Answer whether the macro backdrop supports taking market risk today, and show exactly which evidence earned that answer.</p></section>
      <section style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:18}}><h2 style={{...mono,fontSize:12,color:T.amber,margin:"0 0 8px"}}>THE CONSTRAINT</h2><p style={{margin:0,lineHeight:1.6,color:T.textSecondary}}>We will not compete on indicator count. More tiles are not more judgment. Inputs that are mock, stale, or missing do not get a vote.</p></section>
      <section style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:18}}><h2 style={{...mono,fontSize:12,color:T.red,margin:"0 0 8px"}}>THE RECEIPT</h2><p style={{margin:0,lineHeight:1.6,color:T.textSecondary}}>Every 10am ET call is frozen in the <a href="/history" style={{color:T.textPrimary}}>public history</a>, including data holds and capture failures.</p></section>
    </div>
  </PageShell>;
}
