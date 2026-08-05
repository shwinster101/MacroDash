// ─── TEXT ATOMS (UI-OVERHAUL wave 9) ────────────────────────────────────────
// Badge + Label, moved VERBATIM from dashboard.jsx. One home; the orchestrator and
// every section import from here. (Divider was defined beside them and rendered
// NOWHERE — deleted at extraction rather than moved: a primitive nothing renders is
// the label-outlives-its-data defect in component form.)
import { T } from "../design-tokens.js";

export const Badge=({label,color,small})=>(
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:3,padding:small?"0 4px":"1px 6px",fontSize:small?8:10,fontFamily:T.fontMono,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{label}</span>
);
export const Label=({children,color})=>(
  <div style={{fontFamily:T.fontMono,fontSize:9,color:color||T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{children}</div>
);
