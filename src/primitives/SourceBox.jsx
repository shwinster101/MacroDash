// ─── SOURCE BOX + DATA MODE BADGE (UI-OVERHAUL Slice 1, task 1.4) ───────────
// Moved VERBATIM from dashboard.jsx — the per-tile provenance attribution (the honesty
// layer: source, endpoint, freshness badge, observation date). Extracted as a primitive
// so section components carry their own provenance without reaching into the monolith.
// FEAT-167: CACHED badge uses dashed border + zinc-400 (#a1a1aa)
import { DT, T } from "../design-tokens.js";

export const apiColors = {
  FMP:DT["src-fmp"], FRED:DT["src-fred"], Anthropic:DT["src-anthropic"],
  CNN:DT["src-cnn"], CBOE:DT["src-cboe"], Zillow:DT["src-zillow"], Manual:DT["src-manual"], "Rule-based":DT["src-manual"],
  Kalshi:DT["src-manual"], OpenRouter:"#a78bfa",
  CACHED:DT["cached"],
};
export const DataModeBadge = ({ mode }) => {
  const cfg = {
    MOCK:    { label:"MOCK",    bg:"#1a1f2e", color:T.textMuted,         border:`1px solid ${T.border}` },
    LOADING: { label:"↻ LOADING", bg:"#1a140a", color:T.amber,           border:`1px solid ${T.amber}44` },
    LIVE:    { label:"LIVE",    bg:"#0a1e24", color:DT["live-cyan-700"], border:`1px solid ${DT["live-cyan-700"]}66` },
    STALE:   { label:"⏱ STALE", bg:"#1a140a", color:T.amber,            border:`1px solid ${T.amber}44` },
    CACHED:  { label:"CACHED",  bg:"#18181b", color:DT["cached"],        border:`1px dashed ${DT["cached"]}` },  // FEAT-167
    // B1 (v3.59): a failed live fetch is ERROR, never "MOCK" — an outage must not wear the
    // demo's badge. Red, because it is the one mode that asks the user to act (Retry).
    ERROR:   { label:"⚠ ERROR", bg:"#190a0c", color:T.red,               border:`1px solid ${T.red}66` },
  }[mode] || { label:mode, bg:T.surface, color:T.textMuted, border:`1px solid ${T.border}` };
  return (
    <span style={{background:cfg.bg, color:cfg.color, border:cfg.border, borderRadius:3, padding:"1px 6px", fontSize:9, fontFamily:T.fontMono, letterSpacing:"0.04em"}}>{cfg.label}</span>
  );
};
const SourceBox = ({ api, endpoint, asOf, mode }) => (
  <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:6, flexWrap:"wrap" }}>
    {mode && <DataModeBadge mode={mode}/>}
    <span style={{ background:(apiColors[api]||T.border)+"22", color:apiColors[api]||T.textMuted, border:`1px solid ${(apiColors[api]||T.border)}44`, borderRadius:3, padding:"1px 5px", fontSize:9, fontFamily:T.fontMono, flexShrink:0 }}>{api}</span>
    <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{endpoint}</span>
    {asOf && <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, flexShrink:0 }}>{asOf}</span>}
  </div>
);
export default SourceBox;
