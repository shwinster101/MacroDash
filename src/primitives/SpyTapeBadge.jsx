// ─── SPY TAPE BADGE (v6.4 "TODAY SPY" — v6.5.5 decomposition, Zone 3) ─────────
// Moved VERBATIM from dashboard.jsx. Presentation only: receives the session move, the
// field's provenance mode and the no-session flag as props; renders nothing on MOCK or
// when no direction can be read (never FLAT from an unavailable observation).
import { T } from "../design-tokens.js";
import { spyMoveDirection } from "../publicCopy.js";

// Degen-only SPY session move. It keeps the old ±0.5% arithmetic but no longer borrows
// the macro call's moon vocabulary; an unavailable observation renders nothing, never FLAT.
export default function SpyTapeBadge({ spyChangePct, mode, noSessionDay = false }) {
  // A stale observation is still the last completed session's tape, so name it LAST rather
  // than hiding it on weekends. MOCK remains suppressed: illustrative data is not a tape.
  if (mode !== "LIVE" && mode !== "CACHED" && mode !== "STALE") return null;
  const direction = spyMoveDirection(spyChangePct);
  if (!direction) return null;
  const lastSession = noSessionDay || mode === "STALE";
  const color = direction === "UP" ? T.green : direction === "DOWN" ? T.red : T.amber;
  return (
    <div
      title={`${lastSession ? "Last session's" : "Today's"} SPY move — market tape only, not the macro backdrop call.`}
      style={{
        display:"flex", alignItems:"center", gap:6, flexShrink:0,
        background: color + "18",
        border: `1px solid ${color}55`,
        borderRadius: 20,
        padding: "4px 12px",
        boxShadow: `0 0 8px ${color}33`,
        cursor: "default",
        userSelect: "none",
        transition: "all 0.2s",
      }}>
      <div style={{ fontFamily:T.fontMono, fontSize:7, color:T.textMuted, letterSpacing:"0.1em", whiteSpace:"nowrap" }}>{lastSession?"LAST SPY":"TODAY SPY"}</div>
      <div style={{ fontFamily:T.fontMono, fontSize:10, fontWeight:700, color, whiteSpace:"nowrap", letterSpacing:"0.04em" }}>
        {direction}
      </div>
    </div>
  );
}
