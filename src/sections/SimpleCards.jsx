// ─── SIMPLE PARAMETER CARDS (v4.0) ──────────────────────────────────────────
// The Simple-mode orientation layer: up to three plain-language parameter cards.
// (The "what would change the call" flip line moved to the Five Whys' closed label on the
// 8/28 altitude pass — one home; it lived here from v4.0 to then.)
// PRESENTATION ONLY — simpleCards is a pure projection in src/evidence.js and every
// threshold, vote and freshness rule stays upstream in regime.js. This file decides nothing.
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
import { Explainable } from "../primitives/FactSheet.jsx";

const TONE = { helping: T.green, hurting: T.red, mixed: T.amber };
const WORD = { helping: "HELPING", hurting: "HURTING", mixed: "MIXED" };
/* v6.0.1 SHAPE BEFORE TEXT (owner UX review of the public view: "colors or shapes as
   indicators before text is used"). The direction gets a GLYPH ahead of the label — the SAME
   three glyphs the hero chips and the Drivers matrix already use (voteStyle: ▲ bull · ▼ bear ·
   • neutral), so a reader who learns the shape once reads it everywhere — and the card wears
   a 3px direction bar on its left edge. The word HELPING/HURTING survives at the end of the
   row (it is what a screen reader and the pins read); it just stops being the FIRST thing a
   sighted reader has to parse. */
const GLYPH = { helping: "▲", hurting: "▼", mixed: "•" };
/* Freshness the same way: the macro strip has carried a provenance DOT since v3.62 (filled
   green = live/cached · amber = stale · hollow = mock). The card used to spell the same fact
   as the WORD "cached" in green; the dot is now the indicator and the word rides its title
   and a visually-hidden span, so nothing a screen reader heard is lost. ONE vocabulary
   across the strip and the cards — the second half of the owner's ask ("green valuation if
   live/cached"): a live or cached reading is a filled green dot, never a word. */
export const freshDot = (mode, illus) => {
  const live = !illus && (mode === "LIVE" || mode === "CACHED");
  const color = live ? T.green : mode === "STALE" ? T.amber : T.textMuted;
  return { live, color, word: illus ? "not live" : String(mode || "").toLowerCase() };
};

const SimpleCards = ({ cards, usable = 0, shown = 0, total = 0, withheld = false }) => {
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
          const tone = TONE[c.direction] || T.textMuted;
          const fresh = freshDot(c.mode, illus);
          /* v5.8: the WHOLE card is the tap target for its explainer — the owner's ask is
             "clicking on each context parameter", not hunting a small affordance on a phone.
             Explainable owns the open state and the dialog (sections stay presentation-only,
             the v3.73 boundary) and degrades to a plain div for a band with no explainer,
             because a button that opens nothing is a lie (the CUT-row rule, v3.97).
             The sheet's eyebrow restates this card's OWN reading — same value, same direction
             word, one computation — so the tile is self-contained without being a second
             opinion. */
          return (
            <Explainable key={c.key}
              explain={c.explain}
              title={c.explain ? c.explain.full : c.label}
              eyebrow={`${c.label} · ${c.currentValue}${WORD[c.direction] ? ` · ${WORD[c.direction]}` : ""}`}
              className="simple-card"
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${tone}`,
              borderRadius: 5, padding: "5px 8px", minWidth: 0, ...(illus ? ILLUS_HATCH : {}) }}>
              {/* Line 1: direction glyph · parameter · current value · direction word — the
                  shape leads, the word confirms. Line 2: freshness dot + date + ruler chip. */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <span aria-hidden="true" className="simple-card-glyph" style={{ fontFamily: T.fontMono, fontSize: T.fsM, fontWeight: 700,
                  color: tone, flexShrink: 0, lineHeight: 1 }}>{GLYPH[c.direction] || "•"}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted,
                  letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>{c.label}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textPrimary, minWidth: 0 }}>{c.currentValue}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: 8, fontWeight: 700, marginLeft: "auto",
                  color: TONE[c.direction] || T.textMuted, flexShrink: 0 }}>{WORD[c.direction] || "—"}</span>
                {/* v5.8: the affordance is STATED, not implied — a card that opens something
                    has to say so or the tap is a secret. It rides the row that already
                    exists: measured at 390×844, a separate "WHAT IS THIS? →" line cost 33px
                    across three cards and pushed the macro strip past its pinned budget,
                    which is a real cost for a second way of saying the same thing. */}
                {c.explain && <span aria-hidden="true" title="What is this?"
                  style={{ fontFamily: T.fontMono, fontSize: 9, color: T.amber, flexShrink: 0 }}>ⓘ</span>}
                {/* The glyph is decorative, so the promise is spelled out for a screen
                    reader instead — as an addition to the card's own text, never as an
                    aria-label replacing it, which would hide the reading and the direction. */}
                {c.explain && <span className="visually-hidden"> — what is this? Opens an explainer.</span>}
              </div>
              {/* v5.9 (beginner read: "too many words at first glance"). The card was FOUR
                  lines — identity, a why-it-matters sentence, freshness, and the ruler — three
                  times over, and the sentence is the one a reader can get one tap deep now
                  that the sheet exists. So the sentence moves INTO the sheet (as its lead),
                  and freshness rides the ruler's line rather than renting its own.
                  Provenance stays ON THE FACE either way — the v3.1 invariant is that a
                  number never reads as live unless it is, and that is a fact, not prose. */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 1 }}>
                {/* v6.0.1: the freshness DOT (the strip's own vocabulary) replaces the word on
                    the face; the word survives on the title and for screen readers. */}
                <span className="simple-card-fresh" title={fresh.word} aria-hidden="true"
                  style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block",
                    background: fresh.live ? fresh.color : "transparent", border: `1px solid ${fresh.color}` }}/>
                <span className="visually-hidden">{fresh.word}</span>
                {c.asOf && <span style={{ fontFamily: T.fontMono, fontSize: 8, color: fresh.live ? fresh.color : T.textMuted, flexShrink: 0 }}>{c.asOf}</span>}
                {illus && <IllustrativeChip label="ILLUSTRATIVE" />}
                {c.rulerChip && <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, lineHeight: 1.3, minWidth: 0 }}>· {c.rulerChip}</span>}
              </div>
              {/* v5.8: the affordance is stated, not implied — a card that opens something
                  should say so, or the tap is a secret. */}
            </Explainable>
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
      {/* v4.0.1 (owner copy pass): the coverage count is ONE quiet footer line inside the
          cards area — metadata, not a second message competing with the cards. The truncation
          stays STATED, never implied; only its visual weight dropped. (The flip that shared
          this line moved to the whys' closed label, 8/28.) */}
      {/* v6.0.1: the coverage count leads with the SHAPE — one dot per voter, filled for the
          ones counted, hollow amber for the dark — then the words. Same fact, read at a
          glance first and in text second. The dots are decorative for a screen reader; the
          sentence is what it hears. */}
      <div style={{ marginTop: 4, opacity: 0.7, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {total > 0 && <span aria-hidden="true" className="voter-dots" style={{ display: "inline-flex", gap: 2 }}>
          {Array.from({ length: total }, (_, i) => {
            const counted = i < usable;
            return <span key={i} style={{ width: 5, height: 5, borderRadius: "50%",
              background: counted ? T.green : "transparent", border: `1px solid ${counted ? T.green : T.amber}` }}/>;
          })}
        </span>}
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, lineHeight: 1.5 }}>
          {shown} cards from the {usable} voters counted{total > usable ? ` · ${total - usable} dark` : ""}
        </span>
      </div>
    </div>
  );
};
export default SimpleCards;
