// ─── FACT SHEET (v5.8) ──────────────────────────────────────────────────────
// The one modal idiom on the public page: a tap on a Simple parameter card opens the
// factor's explainer over the page, with an ✕ to leave.
//
// PRESENTATION ONLY. It decides nothing and knows nothing about macro — the caller hands
// it a title and children, and every word of explainer copy lives on REGIME_BAND_TABLE
// beside the rule it describes (the plain/whyItMatters/ruler doctrine). Opening a sheet is
// a render concern, exactly like CollapsedGroup's open state.
//
// WHY A MODAL AND NOT A DISCLOSURE: the six explainers are ~10 lines each. Inline, they
// would push the macro strip past the fold (the glance budget the public suite pins) and
// bury the answer under the teaching material. The v3.66 rule — chip-length in place,
// verbatim one tap deep — with the "one tap deep" being an overlay because the card row
// itself is the thing the reader is scanning.
//
// A11Y, the WAI-ARIA APG dialog pattern (the same contract admin.html's overlay got in
// v3.42 slice 4, ported to React):
//   · role="dialog" + aria-modal + aria-labelledby, so a screen reader announces what it is
//   · focus moves INTO the sheet on open and is RESTORED to the invoking card on close —
//     a reader who closes must land back where they were, not at the top of the page
//   · Tab / Shift+Tab are trapped at the sheet's boundary
//   · Escape closes; so does the backdrop; the ✕ is a real button with an aria-label
//   · body scroll is locked while open, or the page scrolls behind the sheet on iOS
//
// The OPEN STATE lives here, not in the calling section: `src/sections/*` are pinned
// presentation-only (no hooks, no storage, no computation — the v3.73 FEAT-UIMOD boundary),
// and a modal's open flag is exactly the kind of render state CollapsedGroup already keeps
// inside a primitive. `Explainable` is the trigger; `FactSheet` is the dialog it opens.
import { useEffect, useRef, useState } from "react";
import { T } from "../design-tokens.js";

const FOCUSABLE = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

const FactSheet = ({ title, eyebrow, onClose, children }) => {
  const boxRef = useRef(null);
  const restoreRef = useRef(null);
  useEffect(() => {
    restoreRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const box = boxRef.current;
    const closeBtn = box && box.querySelector("[data-fs-close]");
    if (closeBtn) closeBtn.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !box) return;
      const items = [...box.querySelectorAll(FOCUSABLE)].filter((n) => !n.disabled);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const back = restoreRef.current;
      if (back && typeof back.focus === "function") { try { back.focus(); } catch (_e) {} }
    };
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90,
      background: "rgba(4,8,14,0.78)", display: "flex", alignItems: "flex-end",
      justifyContent: "center", padding: "16px 10px calc(10px + env(safe-area-inset-bottom))" }}>
      {/* Stop the backdrop handler at the sheet: a click inside must never dismiss it. */}
      <div ref={boxRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        aria-labelledby="factsheet-title" className="factsheet"
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
          width: "100%", maxWidth: 520, maxHeight: "82vh", overflowY: "auto",
          padding: "12px 14px 16px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted,
              letterSpacing: "0.12em", textTransform: "uppercase" }}>{eyebrow}</div>}
            <h3 id="factsheet-title" style={{ margin: "2px 0 0", fontFamily: T.fontMono,
              fontSize: T.fsM, fontWeight: 700, color: T.textPrimary, letterSpacing: "0.02em" }}>{title}</h3>
          </div>
          <button data-fs-close onClick={onClose} aria-label={`Close ${title}`} className="fs-close"
            style={{ marginLeft: "auto", flexShrink: 0, background: "none", cursor: "pointer",
              border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSecondary,
              fontFamily: T.fontMono, fontSize: T.fsM, lineHeight: 1, padding: "6px 9px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

/* The explainer BODY. Generic over the shape it is handed — it renders what is there and
   nothing else: a section with no stored copy does not render a heading over an empty box
   (absence is not content, the v4.0 card rule), and the quote renders only when it carries an
   attribution, because an unattributed aphorism in an evidence surface is a fabricated
   citation exactly as a made-up number is a fabricated fact. */
const Section = ({ label, children }) => (
  <div style={{ marginTop: 10 }}>
    <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted,
      letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.textSecondary, lineHeight: 1.45 }}>{children}</div>
  </div>
);

export const ExplainerBody = ({ explain }) => {
  if (!explain) return null;
  const q = explain.quote;
  return (
    <div>
      {/* v5.9: an optional lead line — the one-sentence "why should I care about this at
          all" the card used to carry on its face. It moved in here when the beginner read
          found the cards were four lines of prose each. */}
      {explain.lead && <div style={{ fontFamily: T.fontSans, fontSize: T.fsS,
        color: T.textSecondary, lineHeight: 1.45, marginTop: 6 }}>{explain.lead}</div>}
      {/* v5.9: a sheet may carry free-form SECTIONS instead of the factor shape — the verdict
          explainer answers "what does HODL mean" and "what is bullish", which are not
          "what moves it" and "normal level". Same renderer, so both kinds of sheet look and
          behave identically and there is one dialog in the product, not two. */}
      {Array.isArray(explain.sections) && explain.sections.map((s, i) => (
        <Section key={i} label={s.label}>
          {Array.isArray(s.bullets)
            ? <ul style={{ margin: 0, paddingLeft: 16 }}>
                {s.bullets.map((b, j) => <li key={j} style={{ marginBottom: 3 }}>{b}</li>)}
              </ul>
            : s.text}
        </Section>
      ))}
      {Array.isArray(explain.what) && explain.what.length > 0 && (
        <Section label="what it is">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {explain.what.map((b, i) => <li key={i} style={{ marginBottom: 3 }}>{b}</li>)}
          </ul>
        </Section>
      )}
      {explain.drivers && <Section label="what moves it">{explain.drivers}</Section>}
      {/* v5.9: the full sentence-form ruler, which used to sit on the card face and wrapped
          to three lines there for two of the six bands. The card keeps the chip. */}
      {explain.bands && <Section label="how MacroDash reads it">{explain.bands}</Section>}
      {explain.baseline && <Section label="normal / neutral level">{explain.baseline}</Section>}
      {explain.macro && <Section label="why it matters to the macro picture">{explain.macro}</Section>}
      {q && q.text && q.who && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.textSecondary,
            fontStyle: "italic", lineHeight: 1.45 }}>“{q.text}”</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, marginTop: 3 }}>
            — {q.who}{q.where ? `, ${q.where}` : ""}
          </div>
        </div>
      )}
    </div>
  );
};

/* The trigger. With no explainer stored it renders a plain <div> — a button that opens
   nothing is a lie (the CUT-row rule, v3.97) — so a band that has not been written up yet
   degrades to exactly the card that shipped before this. */
export const Explainable = ({ explain, title, eyebrow, className, style, children }) => {
  const [open, setOpen] = useState(false);
  if (!explain) return <div className={className} style={style}>{children}</div>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className={className} style={{ ...style, cursor: "pointer", textAlign: "left",
          font: "inherit", color: "inherit", width: "100%", display: "block" }}>
        {children}
      </button>
      {open && (
        <FactSheet title={title} eyebrow={eyebrow} onClose={() => setOpen(false)}>
          <ExplainerBody explain={explain} />
        </FactSheet>
      )}
    </>
  );
};

export default FactSheet;
