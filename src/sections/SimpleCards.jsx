// ─── SIMPLE PARAMETER CARDS (v4.0) ──────────────────────────────────────────
// The Simple-mode orientation layer: up to three plain-language parameter cards.
// (The "what would change the call" flip line moved to the Five Whys' closed label on the
//  8/28 altitude pass — one home; it lived here from v4.0 to then.)
// PRESENTATION ONLY — simpleCards is a pure projection in src/evidence.js and every
// threshold, vote and freshness rule stays upstream in regime.js. This file decides nothing.
//
// Honesty rules this component enforces at render:
//   · An EXCLUDED factor never reaches here (simpleCards drops it) — a card is a claim
//     about a current usable reading, and there is none.
//   · Fewer than `max` usable factors renders FEWER CARDS, never UNAVAILABLE padding:
//     absence is not content.
//   · T3: date + ruler left the face for the card sheet (they already belong in c.explain).
//     Coverage dots left the cards footer for the Why-this-call fold. Glyph + name + value
//     + HELPING/HURTING stay. Provenance for a screen reader stays visually-hidden.
import { T } from "../design-tokens.js";
import { ILLUS_HATCH, isIllustrative } from "../primitives/Illustrative.jsx";
import { Explainable } from "../primitives/FactSheet.jsx";
import { cardFace, sheetLead } from "../simpleFace.js";

const TONE = { helping: T.green, hurting: T.red, mixed: T.amber };
const WORD = { helping: "HELPING", hurting: "HURTING", mixed: "MIXED" };
export const freshDot = (mode, illus) => {
  const live = !illus && (mode === "LIVE" || mode === "CACHED");
  const color = live ? T.green : mode === "STALE" ? T.amber : T.textMuted;
  return { live, color, word: illus ? "not live" : String(mode || "").toLowerCase() };
};

const sheetOf = (c) => {
  if (!c.explain || !Array.isArray(c.explain.what)) return c.explain;
  const illus = isIllustrative(c.mode);
  const lead = sheetLead(c);
  const beat2 = lead && c.explain.what[1] !== lead ? `${c.explain.what[1]} ${lead}` : c.explain.what[1];
  const tail = [c.explain.what[2], c.asOf && `As of ${c.asOf}.`, c.rulerChip && `Rule: ${c.rulerChip}.`, illus && "This reading is illustrative, not live."]
    .filter(Boolean).join(" ");
  return { full: c.explain.full, what: [c.explain.what[0], beat2, tail] };
};

const SimpleCards = ({ cards, usable = 0, shown = 0, total = 0, withheld = false }) => {
  // Property 9 (null-safe): nothing usable means nothing to render as a current reading.
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return (
      <div role="region" aria-label="Key parameters" style={{ padding: "8px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>
          No signal is currently counted, so there is no reading to show — evidence detail is in Degen mode.
        </div>
      </div>
    );
  }
  return (
    <div role="region" aria-label="Key parameters" style={{ padding: "8px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 6 }}>
        {cards.map((c) => {
          const illus = isIllustrative(c.mode);
          const face = cardFace(c);
          const tone = TONE[face.tone] || T.textMuted;
          const fresh = freshDot(c.mode, illus);
          return (
            <Explainable key={c.key}
              explain={sheetOf(c)}
              title={c.explain ? c.explain.full : face.label}
              eyebrow={`${face.label} · ${face.value}${WORD[face.tone] ? ` · ${WORD[face.tone]}` : ""}`}
              className="simple-card"
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${tone}`,
              borderRadius: 5, padding: "8px 10px", minWidth: 0, backgroundImage: illus ? ILLUS_HATCH : undefined }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span aria-hidden="true" className="simple-card-glyph" style={{ fontFamily: T.fontMono, fontSize: T.fsL, fontWeight: 700,
                  color: tone, flexShrink: 0, lineHeight: 1 }}>{face.glyph}</span>
                <span style={{ fontFamily: T.fontSans, fontSize: T.fsM, color: T.textMuted,
                  letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>{face.label}</span>
                <span style={{ fontFamily: T.fontSans, fontSize: T.fsBody, fontWeight: 600, color: T.textPrimary, minWidth: 0 }}>{face.value}</span>
                <span style={{ fontFamily: T.fontSans, fontSize: T.fsM, fontWeight: 700, marginLeft: "auto",
                  color: TONE[face.tone] || T.textMuted, flexShrink: 0 }}>{WORD[face.tone] || "—"}</span>
                {c.explain && <span aria-hidden="true" title="What is this?"
                  style={{ fontFamily: T.fontMono, fontSize: 9, color: T.amber, flexShrink: 0 }}>ⓘ</span>}
                {c.explain && <span className="visually-hidden"> — what is this? Opens an explainer.</span>}
                <span className="visually-hidden">{fresh.word}</span>
              </div>
            </Explainable>
          );
        })}
      </div>
      {withheld && <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.amber, marginTop: 5 }}>
        partial evidence — not used for the call
      </div>}
    </div>
  );
};
export default SimpleCards;
