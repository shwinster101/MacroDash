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

// v3.95: optional `persistKey` remembers the open state per device (localStorage).
// Deliberately OPT-IN — the default stays session-local, because most groups demote
// stale/curated content and a remembered "open" there would quietly undo FEAT-321.
// It exists for the one group a reader chooses to live with open (the whys chain).
// A storage fault or an unrecognized stored value falls back to `defaultOpen`: the
// safe direction is the caller's stated default, never a guessed one.
const readOpen = (key, fallback) => {
  if (!key) return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : fallback;
  } catch (_e) { return fallback; }
};

const CollapsedGroup = ({ count, label, chip = true, defaultOpen = false, persistKey = null, children }) => {
  const [open, setOpen] = useState(() => readOpen(persistKey, defaultOpen));
  const toggle = () => setOpen(o => {
    const next = !o;
    if (persistKey) { try { localStorage.setItem(persistKey, next ? "1" : "0"); } catch (_e) {} }
    return next;
  });
  return (
    <div>
      {/* .cg-toggle: 44px min tap target at ≤480px (wave 15, Req 6.3 — rule lives in the
          orchestrator's stylesheet beside the other media rules). */}
      <button onClick={toggle} aria-expanded={open} className="cg-toggle"
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
