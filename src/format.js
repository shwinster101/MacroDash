// ─── SHARED FORMAT HELPERS (UI-OVERHAUL Slice 1, task 1.3; pctColor joined in 3.1) ──
// Moved VERBATIM from dashboard.jsx so extracted section components and the
// orchestrator share ONE copy (the second-copy drift doctrine). Pure, no React.
import { T } from "./design-tokens.js";

export const pctColor=(v,inv=false)=>(inv?v<0:v>0)?T.green:v===0?T.textSecondary:T.red;
export const fmt = {
  pct:(v,d=1)=>`${v>=0?"+":""}${v.toFixed(d)}%`,
  bps:(v)=>`${v>=0?"+":""}${(v*100).toFixed(0)}bps`,
  price:(v)=>v>=1000?`$${(v/1000).toFixed(1)}K`:`$${v.toFixed(2)}`,
  // FEAT-FLIP: a bare number at the precision its own band is expressed in (10Y/NFCI 2dp,
  // F&G 0dp) — a distance printed at the wrong precision reads as false confidence.
  num:(v,d=2)=>Number(v).toFixed(d),
};
