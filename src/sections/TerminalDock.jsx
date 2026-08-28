// ─── TERMINAL DOCK (v4.1.7) ─────────────────────────────────────────────────
// Replaces the v3.97 SharedPicks strip at the bottom of Simple. Owner's framing:
// "the top TERMINAL is a mode switch, the bottom S-tier is a name list with no job —
//  you want one surface that is both: these names live in Terminal, tap to work them."
// So the chips stop being a mini-watchlist and become DOORS.
//
// PRESENTATION ONLY: the fetch and the navigation live in the orchestrator (the section
// contract). This file computes nothing and reads no provenance.
//
// TWO HONESTY RULES CARRIED OVER, both load-bearing:
//  1. Live data only. A failed fetch, an empty list, or a mock/demo build (the orchestrator
//     never fetches there) renders NOTHING — example conviction on a page read as "my book"
//     is the v3.1 fabricated-directional-call invariant applied to names.
//  2. Chips were <div>s in v3.97 precisely because they opened nothing, and a button that
//     does nothing is a lie (the CUT-row rule). They are <button>s NOW because they finally
//     have a job: focus that symbol in TT.
//
// NO QUOTES, NO P&L, NO SCORES on a chip (owner: "that turns the dock into a second
// dashboard"). The chip is a door, and its whole label is the symbol.
//
// ⚠ publicView is a CLEANLINESS gate, NOT privacy. The dashboard has no auth — anyone
// visiting the bare URL gets the operator view — and /api/picks stays world-readable by
// design (v3.97). Hiding the dock makes the shared link clean; it does not make the book
// private, and nothing here should be read as though it did. Owner call, 2026-08-21.
import { T } from "../design-tokens.js";

/* GATE TOKEN — owner call: the moon voice, matching HODL/MOONING/DIAMOND HANDS.
   The SOURCE is Engine 0's published `actionability`, the only gate this page can honestly
   compute (the TT stance needs PIN-gated book state the dashboard cannot see). The
   authoritative token rides the title/aria so the machine value stays reachable and a
   reader can never be left guessing what "SEND IT" was derived from.
   UNKNOWN FAILS CLOSED: an absent or unrecognised actionability renders NO READ, never a
   permissive default — a gate that guesses green is the one defect this whole layer exists
   to prevent. */
export const GATE_VOICE = {
  FULL:       { word: "SEND IT",   color: T.green },
  RESTRICTED: { word: "EASY",      color: T.amber },
  HOLD:       { word: "HANDS OFF", color: T.red },
};
export const gateToken = (actionability) =>
  GATE_VOICE[actionability] || { word: "NO READ", color: T.textMuted };

const TerminalDock = ({ publicView, picks, gate, onOpenTerminal }) => {
  // Public: the call is the product. No chips, no gate, no fake terminal.
  if (publicView) return null;
  if (!picks || !Array.isArray(picks.picks) || picks.picks.length === 0) return null;
  const g = gateToken(gate);
  return (
    <div role="region" aria-label="Terminal dock"
      style={{ padding: "10px 20px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.amber, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Terminal
        </span>
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted }}>tap a name to work it in TT</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 5 }}
          title={`Engine 0 actionability: ${gate || "unavailable"}`}>
          <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, letterSpacing: "0.12em" }}>GATE</span>
          <span style={{ fontFamily: T.fontMono, fontSize: T.fsS, fontWeight: 700, color: g.color }}>{g.word}</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {picks.picks.map((p) => (
          <button key={p.sym} type="button" onClick={() => onOpenTerminal(p.sym)}
            aria-label={`Open ${p.sym} in Ticker Terminal`}
            style={{ border: `1px solid ${T.amber}55`, borderRadius: 4, padding: "6px 10px",
              background: `${T.amber}0d`, cursor: "pointer", minHeight: 40,
              fontFamily: T.fontMono, fontSize: T.fsM, fontWeight: 700, color: T.textPrimary }}>
            {p.sym}
          </button>
        ))}
      </div>
      {picks.asOf && (
        <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, marginTop: 5 }}>
          book as of {picks.asOf} · personal conviction, not investment advice
        </div>
      )}
    </div>
  );
};
export default TerminalDock;
