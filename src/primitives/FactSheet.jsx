// ─── FACT SHEET (v5.8) ──────────────────────────────────────────────────────
// The one modal idiom on the public page: a tap on a Simple parameter card opens the
// factor's explainer over the page, with an ✕ to leave.
//
// PRESENTATION ONLY. It decides nothing and knows nothing about macro — the caller hands
// it a title and children, and every word of explainer copy lives on REGIME_BAND_TABLE
// beside the rule it describes (the plain/whyItMatters/ruler doctrine). Opening a sheet is
// a render concern, exactly like CollapsedGroup's open state.
//
// WHY A MODAL AND NOT A DISCLOSURE: even at 3 bullets, inline would push the macro strip
// past the fold (the glance budget the public suite pins) and bury the answer under the
// teaching material. The v3.66 rule — chip-length in place, verbatim one tap deep — with
// the "one tap deep" being an overlay because the card row itself is what the reader scans.
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

/* v5.9.1 (owner: "I meant 3 bullets total. The tile descriptions too large") — ONE shape for
   every explainer in the product: `{full, what: [exactly 3 bullets]}`. The v5.9 draft had a
   lead sentence plus four more prose sections plus a quote; "3 bullets" meant the whole tile,
   not "3 bullets under one of several headings". This is deliberately the ONLY render path
   now — no Section headers, no quote block, no free-form sections shape. A tile with no `what`
   renders nothing (absence is not content, the v4.0 card rule), and MORE than 3 items is not
   pinned as an error here — smoke enforces exactly 3 at the data layer, which is the one home
   for that rule. */
export const ExplainerBody = ({ explain }) => {
  if (!explain || !Array.isArray(explain.what) || !explain.what.length) return null;
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontFamily: T.fontSans, fontSize: T.fsS,
      color: T.textSecondary, lineHeight: 1.5 }}>
      {explain.what.map((b, i) => <li key={i} style={{ marginBottom: 6 }}>{b}</li>)}
    </ul>
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
