// ─── DIRECTION TILE (v1.3 stoplight — UI-OVERHAUL wave 9) ───────────────────
// Moved VERBATIM from dashboard.jsx with its three private helpers (stoplightColor,
// verdictFromTones, arrow) — DirTile is their only consumer, so they travel with it.
// v3.1: the verdict + delta colors are suppressed on mock/stale (isIllustrative);
// a fabricated directional call is worse than a fabricated number.
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { DT, T } from "../design-tokens.js";
import { Badge, Label } from "./atoms.jsx";
import SourceBox, { DataModeBadge } from "./SourceBox.jsx";
import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "./Illustrative.jsx";

const arrow=(v)=>v>0?"▲":v<0?"▼":"→";
// Stoplight color for direction tiles
function stoplightColor(val, band, invert=false) {
  if(Math.abs(val) <= band) return "yellow";
  const up = val > band;
  return (invert ? !up : up) ? T.green : T.red;
}
function verdictFromTones(tones) {
  const g=tones.filter(t=>t===T.green).length;
  const r=tones.filter(t=>t===T.red).length;
  if(g>=2) return { label:"BULLISH", color:T.green };
  if(r>=2) return { label:"BEARISH", color:T.red };
  return { label:"NEUTRAL", color:T.yellow };
}

const DirTile=({label,value,d1,w1,m1,band,invert=false,spark,source,sourceEp,mode="MOCK",asOf,note,noteTitle})=>{
  const illus=isIllustrative(mode); // v3.1: suppress the verdict + delta colors on mock/stale data
  const tc=t=>illus?T.textMuted:t==="yellow"?T.yellow:t===T.green?T.green:T.red;
  const t1=stoplightColor(d1,band,invert), t2=stoplightColor(w1,band,invert), t3=stoplightColor(m1,band,invert);
  const verdict=verdictFromTones([t1,t2,t3]);
  return(
    <div style={{background:illus?T.surface:verdict.label==="BULLISH"?DT["regime-on-bg"]:verdict.label==="BEARISH"?DT["regime-off-bg"]:T.surface,backgroundImage:illus?ILLUS_HATCH:undefined,border:`1px solid ${illus?T.border:verdict.label==="BULLISH"?T.green+"44":verdict.label==="BEARISH"?T.red+"44":T.border}`,borderRadius:5,padding:"10px 12px",flex:"1 1 110px",minWidth:110,opacity:illus?0.92:1}}>
      <Label>{label}</Label>
      <div style={{fontFamily:T.fontMono,fontSize:16,color:illus?T.textSecondary:T.textPrimary,fontWeight:700,marginBottom:4}}>{value}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,marginBottom:5}}>
        {[["1D",d1,t1],["1W",w1,t2],["1M",m1,t3]].map(([p,v,t])=>(
          <div key={p}><div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>{p}</div>
          <div style={{fontFamily:T.fontMono,fontSize:10,color:tc(t)}}>{arrow(v)} {Math.abs(v).toFixed(Math.abs(v)<1?1:2)}</div></div>
        ))}
      </div>
      {/* FEAT-30Y: an optional factual sub-line (e.g. the 10s30s spread + a reference level).
          Rendered muted on mock/stale like every other number on an illustrative tile — it is
          a FACT about the same data, so it inherits the same provenance treatment. */}
      {/* v3.61 (FEAT-GLANCE): the note carries the FACT (it can read INVERTED — a red fact
          that must survive the default view); explanatory reference prose rides noteTitle
          as a tooltip instead of a rendered line. */}
      {note&&<div title={noteTitle||undefined} style={{fontFamily:T.fontMono,fontSize:8,color:illus?T.textMuted:T.textSecondary,marginBottom:5,lineHeight:1.35}}>{note}</div>}
      {/* Verdict only on live data; mock/stale shows an honest chip instead of a fabricated call */}
      {/* Short chip label — a ~110px tile can't fit "· not live"; hatch + SourceBox carry it */}
      {illus?(mode==="STALE"?<DataModeBadge mode="STALE"/>:<IllustrativeChip label="ILLUSTRATIVE"/>):<Badge label={verdict.label} color={verdict.color} small/>}
      {spark&&<div aria-hidden="true" style={{height:20,marginTop:5}}><ResponsiveContainer width="100%" height="100%"><LineChart data={spark.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={illus?T.textMuted:T.amber} dot={false} strokeWidth={1}/></LineChart></ResponsiveContainer></div>}
      {source&&<SourceBox api={source} endpoint={sourceEp||""} mode={mode} asOf={asOf}/>}
    </div>
  );
};
export default DirTile;
