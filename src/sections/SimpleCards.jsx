// Six current signals, meaning first. Votes and availability are projected upstream.
import { T } from "../design-tokens.js";
import { Explainable } from "../primitives/FactSheet.jsx";
import { cardFace } from "../simpleFace.js";
import { voterSheet } from "../voterSheet.js";

const TONE = { helping: T.green, hurting: T.red, mixed: T.amber };
export const freshDot = (mode, illus) => {
  const live = !illus && (mode === "LIVE" || mode === "CACHED");
  const color = live ? T.green : mode === "STALE" ? T.amber : T.textMuted;
  return { live, color, word: illus ? "not live" : String(mode || "").toLowerCase() };
};
export default function SimpleCards({ cards = [], usable = 0, total = 0, withheld = false, drift = false }) {
  return <div role="region" aria-label="Key parameters" style={{ padding: "6px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
    <h2 style={{ fontFamily: T.fontMono, fontSize: T.fsL, fontWeight:700, lineHeight:"18px", color:T.textPrimary, margin:"0 0 2px" }}>Current signals</h2>
    <div className="simple-signals-grid">
      {cards.map(c => {
        const face = cardFace(c);
        const tone = c.available ? TONE[face.tone] || T.textMuted : T.textMuted;
        return <Explainable key={c.key} explain={voterSheet(c)} title={c.explain?.full || c.label}
          eyebrow={c.available ? `${c.label} · ${face.value} · ${c.summary}` : `${c.label} · ${c.loading ? "loading" : "unavailable — not counted"}`}
          className="simple-card" ariaLabel={`${c.summary}.${!c.available && !c.loading ? " Not counted." : ""} Opens an explainer.`}
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${tone}`, borderRadius: 5, padding: "6px 10px", minWidth: 0, lineHeight: 1.25 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span aria-hidden="true" className="simple-card-glyph" style={{ fontFamily: T.fontMono, fontSize: T.fsL, color: tone, flexShrink: 0 }}>■</span>
            <span className="simple-card-summary" data-signal-key={c.key} style={{ fontFamily: T.fontMono, fontSize: T.fsL, color: T.textPrimary, fontWeight: 600, minWidth: 0 }}>{c.summary}</span>
          </div>
          {!c.available && !c.loading && <div style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textMuted, marginLeft: 20 }}>Not counted</div>}
          {c.explain && <span className="visually-hidden"> — what is this? Opens an explainer.</span>}
          <span className="visually-hidden">{c.available ? c.mode.toLowerCase() : "not live"}</span>
        </Explainable>;
      })}
    </div>
    {usable < total && <div style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textMuted, marginTop: 5 }}>{usable} of {total} signals available</div>}
    {withheld && <div style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.amber, marginTop: 5 }}>Partial data — outlook withheld</div>}
    {drift && <div className="simple-signal-drift" style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.amber, marginTop: 5 }}>Current signals differ from the saved daily call</div>}
  </div>;
}
