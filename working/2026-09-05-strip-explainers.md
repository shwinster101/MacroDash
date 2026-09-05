# 2026-09-05 — eight sheets: the macro-strip tiles open their explainers (v6.3.0)

Owner, on the live VIX sheet (Simple view, iPhone, v6.2.0): *"Can we work on publishing the
descriptor popups for the 8 parameters as well like the example shown for VIX here."*

## What was true before the pass

- The Simple **cards** (three of the six band factors on any given tape) opened the v5.8
  `FactSheet` via `Explainable`; the copy lives on `REGIME_BAND_TABLE` (`explain: {full, what[3]}`).
- The **macro strip** (SPY* · QQQ · VIX · F&G · 10Y · FED · CPI · NFCI) opened nothing. Each tile
  carried a `title` tooltip and `cursor:help` — the v3.73 audit's open finding *"hover-only
  strip explanations unreachable on touch"*.
- Five strip fields ARE band keys (`vix` · `fearGreed` · `tenYear` · `cpiHeadline` · `nfci`), so
  their copy already existed; SPY*, QQQ and FED had no explainer anywhere.
- The FED tile flips its field between `fedTargetUpper` (range live) and `fedFunds` (dark).

## Design rulings (mine, under the repo's doctrines)

1. **One resolver, no copies.** `src/stripExplain.js` → `stripExplainFor(field)`: band factor
   first (the band's OWN object — identity pinned), then `CONTEXT_EXPLAIN[field]`, then null.
   A copy of a band explainer on the strip would be the second-copy-of-a-threshold defect
   applied to prose.
2. **Context copy in one table, keyed by strip field**, not on the band table (there is no band
   to sit beside). FED's two keys alias one frozen object.
3. **Beat 2 of a context sheet must state "the six-factor vote does not read it" and call
   itself context** — pinned, because a context tile wearing a voter's sheet shape would imply
   a vote. The pin caught the QQQ draft (had the first clause, not the word "context").
4. **The tile's whole face is the button** (the v5.8 card rule), nested INSIDE the existing tile
   div so the div keeps its title/classes/layout and the `.macro-strip-inner > div` selectors
   the browser suite uses stay valid; the sub-line gained `.strip-sub` and the three
   `lastElementChild` reads were re-pointed with the reason.
5. Eyebrow vocabulary is the strip's, not the card's: `votes BULL` / `dark today` / `context
   only` — the same three states the tooltip already carries.

## Outcomes

- Files: `src/stripExplain.js` (new), `src/sections/MacroStrip.jsx`, `src/dashboard.jsx` (the
  44px `.strip-tile` phone rule), `test/smoke.mjs` [79] (+18), `test/public-render.mjs` (+14, three
  re-pins), version 6.3.0 ×5, CLAUDE.md block.
- Gates: 2258 smoke · 309 render · 283 public-render · audit clean.
- Measured at 390×844 (Simple): cards 337 · strip 607 (v6.0.2: 337 / 602). The +5px is the
  button box; both inside the pinned 420 / 660.
- Negative controls: A (band object copied → identity pin), C (ⓘ dropped → affordance pin),
  D (44px rule removed → thumb-target pin). Each turned exactly one pin.
- **Corrections to my own first draft, recorded:** the QQQ bullet lacked the word "context"
  (caught by the new pin, not by me); the 6.0.2 strip budget note said 602 and this pass
  measures 607 — the difference is the new button, stated in the block rather than absorbed.
- Deliberately NOT done: no change to the card sheets or to any band copy; no sheet for the
  MarketDetail tiles behind the expander (a later ask — they carry the same `title` tooltips and
  would take the same resolver); no relabel of the ⓘ glyph size at 8px on the strip (it matches
  the label size; the tile itself is the target, so the glyph is a hint, not the button).
