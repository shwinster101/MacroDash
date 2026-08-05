// ─── ILLUSTRATIVE TREATMENT (v3.1 friends-cockpit safety) ───────────────────
// Moved VERBATIM from dashboard.jsx (UI-OVERHAUL wave 8, task 5.1 — CollapsedGroup's
// chip dependency travels with it). A friend skimming must never mistake a
// no-feed/mock tile for live data. Curated tiles get a diagonal-hatch wash + an
// unmistakable "ILLUSTRATIVE · not live" chip, and any directional VERDICT
// (BULLISH/BEARISH/BUBBLE) is SUPPRESSED on mock/stale data — a fabricated
// directional call is worse than a fabricated number.
import { T } from "../design-tokens.js";

export const ILLUS_HATCH = "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.025) 5px, rgba(255,255,255,0.025) 10px)";
export const IllustrativeChip = ({ label = "ILLUSTRATIVE · not live" }) => (
  // FEAT-322: inline-block + maxWidth/ellipsis so a chip inside a narrow tile truncates
  // gracefully instead of forcing horizontal page scroll at 390px (v3.1 clipped raw).
  <span style={{ fontFamily:T.fontMono, fontSize:8, letterSpacing:"0.06em", color:T.amber, background:T.amber+"18", border:`1px solid ${T.amber}55`, borderRadius:3, padding:"1px 6px", whiteSpace:"nowrap", flexShrink:0, display:"inline-block", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", boxSizing:"border-box" }}>◫ {label}</span>
);
// True when a tile's data carries no live signal and must not render a verdict.
export const isIllustrative = (mode) => mode === "MOCK" || mode === "STALE";
