// ─── COLLAPSED GROUP (UI-OVERHAUL wave 8, task 5.1) ─────────────────────────
// Moved VERBATIM from dashboard.jsx. FEAT-321 (v3.2 "cut to the live signal"): the
// ONE idiom for demoting stale/curated content out of the default view. Visual style
// copied from the v3.1 IPO cut-to-edge toggle; self-contained open state (nothing
// external reads it). Collapsing is a RENDER concern only: the data stays complete
// in MOCK_DATA.
// Deliberate deviation from the spec's proposed interface: no `forceOpen` prop and
// no mode-based default — this repo's v3.25 rule is STRONGER: a red/actionable fact
// is never placed inside a collapse at all (it stays outside, visible while closed),
// and open-by-mode is the CALLER's decision via demoted()/defaultOpen. Adding a
// second mechanism would blur the one rule every surface already follows.
import { useState } from "react";
import { T } from "../design-tokens.js";
import { IllustrativeChip } from "./Illustrative.jsx";

const CollapsedGroup = ({ count, label, chip = true, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"6px 0",
                 background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
        <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted,
                       letterSpacing:"0.12em", textTransform:"uppercase" }}>
          {open ? "▾ hide" : `▸ +${count}`} {label}
        </span>
        {chip && <IllustrativeChip label="ILLUSTRATIVE" />}
      </button>
      {open && children}
    </div>
  );
};
export default CollapsedGroup;
