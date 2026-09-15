# Simple text placement sprint — FACE / TAP / FOLD

**Date:** 2026-09-14  
**Scope:** Simple mode only. No call logic, no new data sources, no new primitive.  
**Why:** Simple already has `Explainable` / `FactSheet` tap-sheets and `CollapsedGroup` folds. Density is leftover **face copy**, not missing widgets.

## Locked decisions

1. Four buckets only. Every string is Face, Tap (popup), Fold (dropdown), or Kill.
2. Red / actionable facts never fold. Existing `CollapsedGroup` rule stays.
3. Whole-card tap stays. Do not add extra “What is this?” rows.
4. Simple face max: call word + ≤18-word reason + 3 cards (glyph, name, value, HELPING/HURTING) + strip numbers. No thresholds, no multiples, no lesson, no clock essay.
5. One home per fact. If it is in the sheet, it is not on the face.
6. Degen / Terminal stay dense.

## Files

- `src/publicCopy.js` (or new `src/simpleFace.js`)
- `src/sections/SimpleCards.jsx`
- `src/sections/RegimeBand.jsx`
- `src/sections/StockSpotlight.jsx`
- `src/sections/FiveWhys.jsx`
- `src/sections/MacroStrip.jsx`
- `src/stripExplain.js`
- `test/public-render.mjs`

## Placement matrix (current → Simple)

| Text now on face | Bucket | Why |
|---|---|---|
| **Hold** | Face | The only decision word |
| Thesis (“Vol supportive, rates climbing…”) | Face, rewrite to ≤18 words | So-what, not lecture |
| `MACRO BACKDROP · 10AM CALL · FROZEN` | Fold into Hold ⓘ | Operator clock |
| Evening update / unscored | Fold into Hold ⓘ | Same |
| `6 of 6 signals counted` | Fold into Why this call | Metadata |
| Card glyph + label + value + HELPING/HURTING | Face | The three lights |
| Card ⓘ | Face, keep | Affordance |
| `2026-09-11` + `help <18 · hurt >25` | Tap sheet | Thresholds are how we score, not what I do |
| `3 cards from the 6 signals counted` | Fold / Kill on Simple | Duplicates the hero count |
| `▸ +5 WHY THIS CALL` | Fold, keep closed | Already correct |
| Track record / Why MacroDash | Fold | About-page, not the call |
| Strip prices (SPY/QQQ/VIX/…) | Face, numbers only | Context tape |
| Strip ⓘ copy, proxy notes, FOMC 2d | Tap | Already wired in `stripExplain.js` |
| Spotlight 5-metric stack | Face: YTD + 1 quality stat only | Not both paragraphs |
| “market pays 45.0×… 530.4×…” | Tap / Fold “Explore the numbers” | Valuation lecture |
| LEARNING MOMENT body | Fold, closed | Teaching ≠ deciding |
| Chart | Face, title only: “NBIS vs MSFT YTD” | Visual |
| Chart axis essay / inspect values | Fold | Power user |
| Disclaimers | Fold in About | Legal, not L0 |

## Interaction rules

### Tap / popup (`Explainable`)

Use for the definition of **one object**: this card, this ticker, this Hold word.

Sheet recipe, always 3 beats:

1. What the number is
2. Why it helps / hurts *today*
3. Rule + as-of + source

No essays. No second thesis. Same object the tile already shows.

### Dropdown (`CollapsedGroup`)

Use for a list or a lesson: five checks, learning moment, explore-the-numbers, about/sources.

Closed label must be a promise, not a dump.

- Good: `▸ Why this call`
- Bad: `▸ +5 WHY THIS CALL · 5 CHECKS — ⇄ NO SINGLE METRIC WOULD CHANGE THE CALL…`

### Hidden on Simple, live on Degen

Ruler chips, SD units, edition tokens, “unscored,” coverage dots, 45×/530×, run-rate paragraph.

## Tickets

### T0 — Inventory (2h)

Walk Simple at 390px. Paste every visible string into a table with bucket + owner file. Fail the sprint if a new face string appears without a row.

### T1 — `simpleFace.js` registry (half day)

Presentation-only. No votes, no thresholds.

- `holdReason(call)` → ≤18 words
- `cardFace(card)` → `{ glyph, label, value, tone }` only
- `sheetLead(card)` → the sentence that used to sit on the card
- `spotlightFace(pair)` → YTD + one stat
- `lessonTitle` / `lessonBody` for the fold

### T2 — Hold block (half day) · `RegimeBand.jsx`

Face:

- **Hold**
- “Vol and credit are fine. Rates and rich prices are the drag.”
- ⓘ opens edition / frozen / evening / 6-of-6

Kill the eyebrow `10AM CALL · FROZEN` on Simple.

### T3 — Cards (half day) · `SimpleCards.jsx`

Delete line 2 on Simple (date + ruler). Those fields already belong in `c.explain`.
Keep coverage dots only inside the Why-this-call fold, not under the cards.

### T4 — Spotlight + lesson (half day) · `StockSpotlight.jsx`

Each company: name, YTD, one stat.
Paragraph + multiples → existing `▸ Explore the numbers`.
Learning Moment → `CollapsedGroup` defaultClosed; persistKey allowed.

### T5 — Closed-label pass · `FiveWhys.jsx` + other folds

Rewrite every `▸ +N ALLCAPS ESSAY` to a 2–4 word promise.

### T6 — Tests · `test/public-render.mjs`

Simple at 390px:

- Face must **not** match `/help </`, `/hurt >/`, `/run-rate/`, `/trailing revenue/`, `/FROZEN/`, `/unscored/`
- Face must show Hold + HELPING or HURTING
- Tap card → sheet has as-of + ruler
- Learning Moment starts collapsed
- Degen still shows the dense strings

## Simple face spec (ship this)

```
[Hold]
Vol and credit are fine. Rates and rich prices are the drag.

▲ Volatility    15.84    HELPING
▼ 10-year       4.96%    HURTING
▲ Conditions   -0.56     HELPING

▸ Why this call
SPY  QQQ  VIX  F&G  10Y  FED  CPI  NFCI

NBIS  +154%     MSFT  +5%
▸ Compare the pair
▸ What “run-rate” means
```

That is the entire first screen.

## Acceptance

Review on a 390px screenshot only. If you need to scroll past the three cards to get the call, the face failed.

## Outcomes (2026-09-15)

| Ticket | Result |
|---|---|
| T0 Inventory | Walked Simple at 390px against the placement matrix. No new face string without a row. |
| T1 `simpleFace.js` | Registry shipped. `holdReason` ≤18 words. `cardFace` / `sheetLead` / `spotlightFace` / `lessonTitle` / `chartTitle`. Degen does not import it. |
| T2 Hold block | Shipped earlier on this branch (`33074eb`). Clock / FROZEN / 6-of-6 live in Hold ⓘ. Crash-gauge stays on the face. |
| T3 Cards | Shipped earlier on this branch. Date + ruler in the sheet; coverage dots in Why-this-call. |
| T4 Spotlight + lesson | Simple face = name + YTD + one quality stat. Cap / multiples / summary / lesson body → Explore / Learning moment (defaultClosed, persistKey allowed). Chart title `NBIS vs MSFT YTD`. |
| T5 Closed-label pass | `▸ Why this call` / `About this page` / `Explore the numbers` / `Learning moment`. Flip chip left the closed Why-this-call row; `flipLine` still inside. Degen keeps `▸ +N LABEL`. |
| T6 Tests | Simple at 390px: no `/help </`, `/hurt >/`, `/run-rate/`, `/trailing revenue/`, `/FROZEN/`, `/unscored/` on the face. Hold + HELPING/HURTING. Tap card → as-of + ruler. Learning moment starts collapsed. Degen still dense. |
