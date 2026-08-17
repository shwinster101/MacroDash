# MacroDash Design System — where the truth lives

This document is a **map, not a mirror** (the AGENTS.md/B5 rule: a doc that copies
values rots; a doc that points at their one home cannot). No token values, counts,
or line numbers are restated here — follow the pointers.

## Tokens

- **`src/design-tokens.js`** is the ONE home for every design token: brand and
  stoplight colors, regime tints, data-mode colors, surfaces, text tiers, the
  focus ring, font families, and the `fs-*` type scale. `DT` is the raw table,
  `T` the semantic alias layer (every `T` value derives from `DT` — never a
  second literal).
- Contrast for load-bearing text is **computed in `test/smoke.mjs`**, not asserted
  in comments. Token completeness (every `DT["…"]`/`T.*` lookup in any UI surface
  resolves) is likewise computed there, against the live source.
- `public/admin.html` is buildless and carries its own `--fs-*`/`--sp-*` CSS
  variables by design; it deliberately does not import this module.

## Primitives — `src/primitives/`

One component (or one tight family) per file; each file states its own contract
in its header comment. Current inventory: `atoms.jsx` (Badge, Label),
`SourceBox.jsx` (SourceBox + DataModeBadge + apiColors — the provenance layer),
`SectionHeader.jsx`, `Illustrative.jsx` (ILLUS_HATCH + IllustrativeChip +
isIllustrative — the v3.1 honesty treatment), `CollapsedGroup.jsx` (the ONE
disclosure idiom), `DirTile.jsx` (with its private stoplight helpers),
`FGGauge.jsx`.

## Sections — `src/sections/`

Feature components, **presentation only**: every one renders what the
orchestrator computes and none imports `useMarketData` or a computation module
(enforced by smoke; the narrow exceptions — RegimeBand reading the pure
`regime.js` engine, MarketDetail importing the NFCI band constants, and
AIUnitEconomics importing `aiEcon.js` — exist so a threshold is never
re-declared).

## Computation — pure modules

`regime.js` · `evidence.js` · `fiveWhys.js` · `whatChanged.js` · `sources.js` ·
`ttReadout.js` · `aiEcon.js` · `format.js`. All Node-importable; smoke imports
and RUNS them rather than string-pinning (the v3.60 convention).

## Data flow (producer → consumer)

```
useMarketData → mergeLiveOverMock(MOCK_DATA, payload) → provenance/dataAsOf
  → modeOf/fieldMode → staleFactors → computeRegime → buildEvidenceSet
  → { RegimeBand · postureSummary · Drivers matrix · SignalQuality }
  → computeFiveWhys → FiveWhys
  → flipConditions → RegimeBand
  → summarizeEvidence → compareEvidence → WhatChanged
```

Strictly unidirectional; sections receive props from `src/dashboard.jsx` (the
orchestrator) and never fetch. The orchestrator owns: the hook call, all
derived state (census, freshness sets, alert evaluation, delta bars), the
public/private A4 gate, and the global stylesheet (media rules, skip link,
tap-target and safe-area rules).

## Patterns

- **Mock-first / graceful degradation** — a failed live fetch sets mode ERROR
  (v3.59 B1): MOCK_DATA renders underneath as ILLUSTRATIVE with a visible outage
  line + RETRY — never silently, never dressed as live. Individual bad values
  drop to their mock baseline. The page never breaks on bad data.
- **The honesty invariant (v3.1)** — no number may read as live unless it is;
  directional verdicts are suppressed on mock/stale; false success claims on
  affordances are the same defect (the wave-16 clipboard rule).
- **v3.25** — a collapse never hides a red fact; red facts render outside the
  CollapsedGroup, not inside with a force-open flag.
- **One home per threshold/copy** — a value renders and votes from the same
  table; a second copy is a drift defect.
- **Null-safety (Property 9)** — every section renders a safe empty state on
  missing props, never a throw.

## Enforcement

`test/smoke.mjs` sections [45]–[53] hold the extraction contracts; the browser
suites (`npm run test:ui`, `npm run test:public`) drive the real states. Run
`npm run gates` — never hand-chain the suites.
