// ─── DESIGN TOKENS (UI-OVERHAUL Slice 1, task 1.1) ──────────────────────────
// THE one home for every design token. Extracted VERBATIM from dashboard.jsx
// (which carried them inline since FEAT-152 behind a comment claiming a
// design-tokens.json that never existed in the repo — the label-outlives-its-
// data defect, closed by making this module the canonical source).
// Pure data, no React — Node-importable, so smoke asserts contrast RATIOS and
// key-completeness against this export directly instead of regexing source.
// Rule: token edits happen HERE and nowhere else; dashboard.jsx and every
// extracted section/primitive component import { DT, T } from this module.

export const DT = {
  // Brand
  "amber":          "#f0a500",
  "amber-dim":      "#8a5f00",
  // Stoplights
  "green":          "#2ecc71",
  "green-dim":      "#1a5c3a",
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
  // Surfaces
  "bg":             "#08090b",
  "surface":        "#0f1115",
  "surface-high":   "#161921",
  "border":         "#1a1f2e",
  "border-accent":  "#252d40",
  // Text
  "text-primary":   "#e8eaf0",
  "text-secondary": "#8892a4",
  "text-muted":     "#717d92",   // 4.79:1 on bg / 4.54:1 on surface (was #3d4760 = 2.15:1, below AA)
  // Type
  "font-mono":      "'IBM Plex Mono','Courier New',monospace",
  "font-sans":      "'DM Sans',system-ui,sans-serif",
  "font-display":   "'Syne',sans-serif",
  /* TYPE SCALE (v3.62, newcomer audit) — dashboard.jsx had ~200 hardcoded `fontSize:` literals
     and no scale at all, while public/admin.html has had `--fs-*` since v3.42. The audit
     measured the load-bearing text — provenance, factor chips, the verdict sub-line — at
     7–9px, which is the honesty layer the whole product rests on rendered at a size a phone
     reader has to work to read. These are the sizes to reach for; the literals stay where they
     are decorative so this stays a targeted lift, not a reflow of every component (owner call). */
  "fs-xs":          9,    // micro-labels: section eyebrows, DEMO/TAPE tags
  "fs-s":           10,   // secondary detail
  "fs-m":           11,   // provenance + factor chips — the load-bearing minimum
  "fs-l":           13,   // sub-headlines
  // v5.9.2 (owner: "much larger font, it's too small for a user to read" — the explainer
  // sheet): the scale jumped 13 -> 22 with nothing between headline weight and body text,
  // so the sheet's teaching prose — the thing a beginner is there to READ — sat at fs-s
  // (10px). fs-body is the reading size for prose in a surface whose whole job is being
  // read, distinct from fs-l's sub-headline role and fs-xl's hero weight.
  "fs-body":        16,
  "fs-xl":          22,   // the verdict itself
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
  fsXs:DT["fs-xs"], fsS:DT["fs-s"], fsM:DT["fs-m"], fsL:DT["fs-l"], fsBody:DT["fs-body"], fsXl:DT["fs-xl"],
};
