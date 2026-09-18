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
  // v6.8.5: fs-xs, the token floor for a chip — this renders INSIDE the CollapsedGroup
  // toggle, so lifting the toggle's label and leaving its chip at 8px would have left the
  // one control half-done while reading as finished. The ellipsis contract above is what
  // absorbs the extra width; the 320px overflow pins are what prove it.
  <span style={{ fontFamily:T.fontMono, fontSize:T.fsXs, letterSpacing:"0.06em", color:T.amber, background:T.amber+"18", border:`1px solid ${T.amber}55`, borderRadius:3, padding:"1px 6px", whiteSpace:"nowrap", flexShrink:0, display:"inline-block", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", boxSizing:"border-box" }}>◫ {label}</span>
);
// True when a tile's data carries no live signal and must not render a verdict.
export const isIllustrative = (mode) => mode === "MOCK" || mode === "STALE";
