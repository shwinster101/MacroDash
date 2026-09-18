// ─── DESIGN TOKENS (UI-OVERHAUL Slice 1, task 1.1) ──────────────────────────
// THE one home for every design token. Extracted VERBATIM from dashboard.jsx
// (which carried them inline since FEAT-152 behind a comment claiming a
// design-tokens.json that never existed in the repo — the label-outlives-its-
// data defect, closed by making this module the canonical source).
// Pure data, no React — Node-importable, so smoke asserts contrast RATIOS and
// key-completeness against this export directly instead of regexing source.
// Rule: token edits happen HERE and nowhere else; dashboard.jsx and every
// extracted section/primitive component import { DT, T } from this module.

/* PUBLIC TERMINAL SKIN, Slice 1 (docs/plans/public-terminal-skin.md, 2026-09-18): the token
   BRIDGE. The live Ticker Terminal (public/admin.html) already settled the Bloomberg language —
   one mono stack, phosphor green as the live/helping/selected signal, surfaces #05070a /
   #0a0f16 / #0d141d / #16202c, and a type floor of 10 / 11 / 12.5 / 14 — and the public
   dashboard never inherited it: it ran three families, gold as identity, and load-bearing
   chrome at 7–9px. This bridges the PUBLIC tokens to those values so Simple and Degen paint
   as one product. Amber stays the brand accent (wordmark + alerts) so the public page is not
   a clone of the terminal; red is deliberately NOT moved — the plan names surfaces, green,
   text and type only, and every stoplight red on the page is a verdict colour whose exact
   value the render suites read. No scanline, no glow: the review correction says Simple must
   not wear the CRT, and Degen's version waits until Slice 1 is seen. */
export const DT = {
  // Brand
  "amber":          "#f0a500",
  "amber-dim":      "#8a5f00",
  // Stoplights — green is the terminal's phosphor (helping · live dots · selected state)
  "green":          "#39ff9e",
  "green-dim":      "#1f7a55",
  "red":            "#e74c3c",
  "red-dim":        "#5c1a1a",
  "yellow":         "#f39c12",
  // Regime tints (soft — AS2-01 alarm calibration fix)
  "regime-on-bg":   "#0d2218",   // risk-on: deep green tint, NOT stoplight green
  "regime-off-bg":  "#1a0f0f",   // risk-off: deep red tint
  "regime-mix-bg":  "#1a1408",   // mixed: deep amber tint
  // DataMode states (FEAT-150)
  "live-cyan-700":  "#1c93b0",   // 4.78:1 on the LIVE badge (#0a1e24). Was #0e7490 = 3.20:1,
                                 // and was annotated as AA-compliant, which it never was.
                                 // Measured by test, not asserted by comment.
  "focus-ring":     "#4cc4e0",   // focus indicator only; needs to be seen, not read
  "stale-amber":    "#f0a500",
  "cached":         "#a1a1aa",   // FEAT-167: zinc-400, NOT gray-500 (#6b7280)
  // Sources
  "src-fmp":        "#3b82f6",
  "src-fred":       "#10b981",
  "src-anthropic":  "#f97316",
  "src-cnn":        "#ef4444",
  "src-cboe":       "#8b5cf6",
  "src-zillow":     "#14b8a6",
  "src-manual":     "#6b7280",
  // Surfaces — the terminal's (--bg / --panel / --panel2 / --line in admin.html)
  "bg":             "#05070a",
  "surface":        "#0a0f16",
  "surface-high":   "#0d141d",
  "border":         "#16202c",
  "border-accent":  "#22303e",
  // Text — the terminal's (--fg / --dim, the v3.42 AA-lifted values); smoke COMPUTES the
  // ratios against the new surfaces rather than trusting this comment.
  "text-primary":   "#c8d6cf",
  "text-secondary": "#8aa0b4",
  "text-muted":     "#71877b",
  // Type — ONE family on the public dashboard. `font-sans` and `font-display` survive as
  // NAMES because 38 call sites read them (and the T7 pins read the names as the Simple/Degen
  // split), but both resolve to the mono stack: no second font load, and a mode switch can
  // never change the typeface. The terminal's own stack leads with the platform mono so a
  // blocked webfont still renders as a terminal, not as Courier.
  "font-mono":      "'IBM Plex Mono','SFMono-Regular',ui-monospace,Menlo,Consolas,monospace",
  "font-sans":      "'IBM Plex Mono','SFMono-Regular',ui-monospace,Menlo,Consolas,monospace",
  "font-display":   "'IBM Plex Mono','SFMono-Regular',ui-monospace,Menlo,Consolas,monospace",
  /* TYPE SCALE (v3.62, newcomer audit) — dashboard.jsx had ~200 hardcoded `fontSize:` literals
     and no scale at all, while public/admin.html has had `--fs-*` since v3.42. The audit
     measured the load-bearing text — provenance, factor chips, the verdict sub-line — at
     7–9px, which is the honesty layer the whole product rests on rendered at a size a phone
     reader has to work to read. These are the sizes to reach for; the literals stay where they
     are decorative so this stays a targeted lift, not a reflow of every component (owner call). */
  /* Slice 1 lifts the FLOOR to the terminal's (--fs-xs 10 · --fs-s 11 · --fs-m 12.5 ·
     --fs-l 14). Only token consumers move here; the ~145 sub-12px literals across the
     sections are Slice 2's real-estate pass, which is why acceptance item 3 ("zero fontSize
     below 10px") is NOT claimed by this slice. */
  "fs-xs":          10,   // micro-labels: section eyebrows, DEMO/TAPE tags
  "fs-s":           11,   // secondary detail
  "fs-m":           12.5, // provenance + factor chips — the load-bearing minimum
  "fs-l":           14,   // sub-headlines
  // v5.9.2 (owner: "much larger font, it's too small for a user to read" — the explainer
  // sheet): the scale jumped 13 -> 22 with nothing between headline weight and body text,
  // so the sheet's teaching prose — the thing a beginner is there to READ — sat at fs-s
  // (10px). fs-body is the reading size for prose in a surface whose whole job is being
  // read, distinct from fs-l's sub-headline role and fs-xl's hero weight.
  "fs-body":        16,
  "fs-xl":          22,   // the verdict itself (Degen)
  "fs-xxl":         28,   // Simple Hold only — leftover chrome cannot share the row
};

export const T = {
  bg:DT["bg"], surface:DT["surface"], surfaceHigh:DT["surface-high"],
  border:DT["border"], borderAccent:DT["border-accent"],
  amber:DT["amber"], amberDim:DT["amber-dim"],
  green:DT["green"], greenDim:DT["green-dim"],
  red:DT["red"], redDim:DT["red-dim"], yellow:DT["yellow"],
  blue:"#3498db", purple:"#9b59b6",
  textPrimary:DT["text-primary"], textSecondary:DT["text-secondary"], textMuted:DT["text-muted"],
  fontMono:DT["font-mono"], fontSans:DT["font-sans"], fontDisplay:DT["font-display"],
  fsXs:DT["fs-xs"], fsS:DT["fs-s"], fsM:DT["fs-m"], fsL:DT["fs-l"], fsBody:DT["fs-body"], fsXl:DT["fs-xl"], fsXxl:DT["fs-xxl"],
};
