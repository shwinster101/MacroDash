# UI-Overhaul Risks & Assumptions

Each entry: id · risk/assumption · affected surface · mitigation/verification.
Status lives in git history, not here (a hand-updated status column is a rot
vector). Append new entries at extraction time; never delete — mark superseded
in place.

## Risks

- **R1 · Test pins grep source text.** Extracting a component moves the markup
  its pins match, silently breaking or (worse) vacuously passing them.
  *Affects:* `test/smoke.mjs`. *Mitigation:* every extraction repoints pins to
  the new module's source in the same commit, and negatives sweep `uiSrc` (the
  concatenation of all UI surfaces) so an absence claim cannot pass by moving
  the offender out of the searched file.

- **R2 · Style extraction can change the cascade.** Inline styles have no
  specificity conflicts; introducing classes does. *Affects:* every extracted
  component. *Mitigation:* markup moves verbatim (inline styles intact); the
  few shared classes (`.nav-link`, `.cg-toggle`, `.hw-row`, `.skip-link`,
  `.macro-strip*`) exist only for media rules the browser suites measure at
  real widths.

- **R3 · Verbatim splices can duplicate or orphan code.** A wrong anchor once
  duplicated a 300-line region (caught by the build, wave 9). *Mitigation:*
  build + full gates after every splice; offset-scoped anchors.

- **R4 · Browser-dependent tests can silently skip.** A skipped gate reads as a
  passed one. *Mitigation:* the `REQUIRE_BROWSER=1` convention (CI fails hard;
  bare machines skip loudly), and deps must actually be installed — the v3.69
  lesson.

- **R5 · Shared vocabulary now crosses module boundaries.** `WITHHELD_LABEL`/
  `WEN_MOON_STATES` live in RegimeBand.jsx and are imported by the
  orchestrator; moving them again without following every import re-creates
  the two-copies defect. *Mitigation:* smoke pins one-home-per-symbol.

## Assumptions

- **A1 ·** No external CSS framework or component library; React + inline
  styles + one global stylesheet.
- **A2 ·** `recharts` remains the only charting dependency.
- **A3 ·** All data fetching stays behind `useMarketData` + `/api/snapshot`;
  extraction never touches the network layer.
- **A4 ·** `MOCK_DATA` stays in `dashboard.jsx` — smoke deliberately reads it
  from there to catch `sources.js` ↔ dashboard drift; moving it is its own
  decision, not an extraction side-effect.
- **A5 ·** `public/admin.html` is a separate, buildless surface; nothing in
  `src/` may assume it can import from it or vice versa.
