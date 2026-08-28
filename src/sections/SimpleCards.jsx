// ─── SIMPLE PARAMETER CARDS (v4.0) ──────────────────────────────────────────
// The Simple-mode orientation layer: up to three plain-language parameter cards plus the
// "what would change the call" line. PRESENTATION ONLY — simpleCards/simpleFlipLine are
// pure projections in src/evidence.js and every threshold, vote and freshness rule stays
// upstream in regime.js. This file decides nothing.
//
// Honesty rules this component enforces at render:
//   · An EXCLUDED factor never reaches here (simpleCards drops it) — a card is a claim
//     about a current usable reading, and there is none.
//   · Fewer than `max` usable factors renders FEWER CARDS, never UNAVAILABLE padding:
//     absence is not content.
//   · The truncation is NAMED ("3 cards from the 6 voters counted") — silent truncation
//     reads as full coverage (the v3.65/v3.76 rule). The 3 is a LAYOUT cap, so it is
//     labelled as cards: read as a fraction it looked like coverage and collided with the
//     hero's "N of 6 voters counted" (8/28 vocabulary matrix, row 4).
//   · Every card states its own freshness + observation date; a mock/stale reading carries
//     the standard ILLUSTRATIVE treatment (a demo build publishes by design — v3.54).
import { T } from "../design-tokens.js";
import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "../primitives/Illustrative.jsx";

const TONE = { helping: T.green, hurting: T.red, mixed: T.amber };
const WORD = { helping: "HELPING", hurting: "HURTING", mixed: "MIXED" };

const SimpleCards = ({ cards, flipLine, usable = 0, shown = 0, total = 0, withheld = false }) => {
  // Property 9 (null-safe): nothing usable means nothing to render as a current reading.
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return (
      <div role="region" aria-label="Key parameters" style={{ padding: "8px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>
          No voter is currently counted, so there is no reading to show — evidence detail is in Power mode.
        </div>
      </div>
    );
  }
  return (
    <div role="region" aria-label="Key parameters" style={{ padding: "8px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
      {/* Measured at 390×844: as tall cards these stacked into a 337px tower and pushed the
          macro strip to y=795. Compact ROWS — identity + value + direction on one line, the
          "why" on a second — carry the same four facts in ~40% of the height. The grid still
          goes multi-column on desktop, where the space exists. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 6 }}>
        {cards.map((c) => {
          const illus = isIllustrative(c.mode);
          return (
            <div key={c.key} style={{ background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 5, padding: "5px 8px", minWidth: 0, ...(illus ? ILLUS_HATCH : {}) }}>
              {/* Line 1: parameter · current value · direction — the three facts a reader
                  scans. Line 2: why it matters + freshness, at small weight. */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted,
                  letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>{c.label}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textPrimary, minWidth: 0 }}>{c.currentValue}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: 8, fontWeight: 700, marginLeft: "auto",
                  color: TONE[c.direction] || T.textMuted, flexShrink: 0 }}>{WORD[c.direction] || "—"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap", marginTop: 1 }}>
                {c.why && <span style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.textSecondary, lineHeight: 1.3 }}>{c.why}</span>}
                <span style={{ fontFamily: T.fontMono, fontSize: 8, color: illus ? T.textMuted : T.green, flexShrink: 0 }}>
                  {illus ? "not live" : c.mode.toLowerCase()}{c.asOf ? ` · ${c.asOf}` : ""}
                </span>
                {illus && <IllustrativeChip label="ILLUSTRATIVE" />}
              </div>
            </div>
          );
        })}
      </div>
      {/* v4.0.3 — under DATA HOLD the cards STAY (they are real current readings, and useful
          context), but they must not read as a verdict the page just declined to make. Naming
          the relationship is the honest middle: keep the evidence, deny the inference. NOT in
          the quiet metadata line below — a qualifier that prevents a misreading is not
          metadata. */}
      {withheld && <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.amber, marginTop: 5 }}>
        partial evidence — not used for the call
      </div>}
      {/* v4.0.1 (owner copy pass): the coverage count and the flip condition are ONE quiet
          footer line inside the cards area — metadata, not a second message competing with
          the cards. The truncation stays STATED, never implied (three of six means half the
          evidence is off this screen); only its visual weight dropped. */}
      <div style={{ marginTop: 4, opacity: 0.7 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, lineHeight: 1.5 }}>
          {shown} cards from the {usable} voters counted{total > usable ? ` · ${total - usable} dark` : ""}
          {flipLine ? ` · ⇄ ${flipLine}` : ""}
        </span>
      </div>
    </div>
  );
};
export default SimpleCards;
