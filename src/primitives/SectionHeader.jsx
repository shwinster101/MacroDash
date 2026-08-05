// ─── SECTION HEADER (UI-OVERHAUL Slice 1, task 1.4) ─────────────────────────
// Moved VERBATIM from dashboard.jsx. The uppercase eyebrow that labels every card/strip.
import { DT, T } from "../design-tokens.js";

const SectionHeader=({children})=>(
  <div style={{fontFamily:T.fontMono,fontSize:9,color:DT["text-muted"],letterSpacing:"0.14em",textTransform:"uppercase",paddingBottom:6,marginBottom:10,borderBottom:`1px solid ${T.border}`}}>{children}</div>
);
export default SectionHeader;
