# 2026-08-28 — Simple mode + expanded Five Whys: fraction/count vocabulary matrix

**Status: SHIPPED — see "Outcomes" at the foot of this file, which is the current record.**
The matrix below is the ORIGINAL survey, kept verbatim as the pre-implementation snapshot so
the corrections it earned stay legible as corrections. Where the survey and the Outcomes
section disagree, the Outcomes section is right.

Every string on public Simple mode and the one-tap-deep expanded Five Whys that contains a
fraction or the words "usable" / "voters" / "counted" / "bullish vote", checked against the
hero confidence line as the reader's anchor point.

## Reference point

The hero confidence line — **`{counted} of {total} voters counted`** (`src/sections/RegimeBand.jsx:143`),
e.g. "6 of 6 voters counted" — is the anchor a phone reader forms first. Its numerator is
**voters counted** (coverage, not a bullish tally). Every row below is judged against that.

## Zero-tap (visible on load, Simple)

| # | Location | Exact string (template → example) | What the number actually counts | Same-as-hero to a phone reader? |
|---|---|---|---|---|
| 1 | `RegimeBand.jsx:143` (hero conf line) | `{counted} of {total} voters counted` → "5 of 6 voters counted" | voters counted | — (anchor) |
| 2 | `RegimeBand.jsx:124-125` (DATA HOLD only) | `only {counted} of {totalFactors} factors usable — {quorum} required` → "only 2 of 6 factors usable — 4 required" | voters counted + quorum threshold | Yes — same fact as #1, different vocabulary ("factors usable" vs "voters counted") side by side |
| 3 | `RegimeBand.jsx:120` rendering `regime.js:217` (DATA HOLD only) | `Cross-signals — {counted} of {N} inputs usable` | voters counted (third scope word: "inputs") | Yes — on DATA HOLD this renders beside #1 and #2: one number, three vocabularies, on one band |
| 4 | `SimpleCards.jsx:79` (cards footer) | `showing {shown} of {usable} usable · {total−usable} not counted` → "showing 3 of 5 usable · 1 not counted" | `shown` = cards rendered (UI cap of 3); `usable` = voters counted; the tail = excluded voters | Yes, and this is the worst one — "3 of 5" reads as a coverage fraction directly under a hero saying "5 of 6"; neither numerator nor denominator matches, and the 3 is a layout constant, not evidence |
| 5 | `SimpleCards.jsx:28` (empty state) | `No current usable readings to show — see the evidence detail in Power mode.` | no number | No — but "usable" with no scope word, on the same screen as #1 |
| 6 | `evidence.js:354-360` via hero sentence | `…and no currently usable factor is working against the market right now.` / `No currently usable factor has a clear lean right now.` | no number | No |
| 7 | `evidence.js:366` via cards footer flip slot | `Call withheld until the required evidence is current and usable.` | no number | No |
| 8 | `RegimeBand.jsx:124` (loading) | `no factors voting yet` | voters (zero) | No |
| 9 | `RegimeBand.jsx:152` (withheld note, live build) | `…the mock baseline is NOT voting.` | no number | No |
| 10 | `MacroStrip.jsx:67-71` (hover `title` only) | `Counts toward today's posture.` / `A voter, but dark today — not counted.` / `Context only — does not vote.` | voter membership per tile | No — but unreachable on touch (open v3.73 audit finding); the ▪ marker carries no explanation on a phone |

## One tap deep — expanded Five Whys (`fiveWhys.js`)

| # | Location | Exact string (template → example) | What the number actually counts | Same-as-hero to a phone reader? |
|---|---|---|---|---|
| 11 | `fiveWhys.js:122` (headline) | `{label} · {direction}; {bull}/{active} usable factors bullish.` → "HODL · NEUTRAL; 3/5 usable factors bullish." | numerator = bullish voters, denominator = voters counted | Yes — the sharpest trap. Same N/M shape and the word "usable", but the numerator switched meaning: hero "5 of 6" = coverage, this "3/5" = bullish tally |
| 12 | `fiveWhys.js:126-127` (WHY #1, degraded) | `…{bull} bullish, {neutral} neutral, and {bear} bearish votes from {active}/{total} usable factors.` → "…from 5/6 usable factors" | coverage (matches hero) | Mostly — same fact as #1, but slash form differs from the hero's "N of M", and sits right after #11's opposite-meaning slash |
| 13 | `fiveWhys.js:128` (WHY #1) | `A directional call requires a strict majority: {required} of {active}.` → "…3 of 5." | a rule threshold (⌊counted/2⌋+1), not a tally | Yes — third "N of M" in two sentences; pattern-matches the tallies around it |
| 14 | `fiveWhys.js:128` (WHY #1, zero-usable arm) | `There is not enough usable evidence to publish a direction.` | no number | No |
| 15 | `fiveWhys.js:138` (WHY #2 fallback) | `No canonical factor is usable, so no driver is being claimed.` | no number | No |

## One tap deep — hero ℹ panel (reachable in Simple)

| # | Location | Exact string | What the number actually counts | Same-as-hero? |
|---|---|---|---|---|
| 16 | `RegimeBand.jsx:188` (tally under chips) | `{bull} bull · {neutral} neutral · {bear} bear — {counted} of {total} usable` → "3 bull · 1 neutral · 1 bear — 5 of 6 usable" | tally + coverage | Mostly — explicit, but "usable" where the line 40px above said "voters counted" |
| 17 | `RegimeBand.jsx:213-214` (no-flip line) | `…at {bull} bull / {bear} bear of {counted} voting, it would take two factors moving together.` | vote tally over counted | Moderate — "3 bull / 1 bear" uses the slash as a separator two lines under fractions that use it as division |

## Structural finding

Three distinct quantities share one visual shape:

- **coverage** (voters counted of 6) — hero, #2, #3, #12, #16
- **bullish tally** (bull votes of counted) — #11, #13's neighborhood, #17
- **cards rendered** (min(3, counted)) — #4

…across four scope nouns (voters / factors / inputs / readings) and two fraction forms
(`N of M`, `N/M`). v3.98.3 declared "voters counted" the canonical form and fixed exactly one
surface; the DATA HOLD branch, the cards footer, and the whys never got it.

## Proposed replacements (copy only — no band, engine, or count-derivation change)

Rules: coverage always reads "N of 6 voters counted"; a bullish tally always reads "N of the
M counted lean bullish" (never `N/M`); a slash never appears; every number that isn't a voter
count names what it is.

| # | Replacement |
|---|---|
| 2 | `only {counted} of {total} voters counted — {quorum} needed to call it` |
| 3 | Don't edit `regime.js` — extend the existing conf-strip in `RegimeBand.jsx:120` to the insufficient branch too (presentation-side, same regex; the paste block and 5 Whys keep the full sub, as v3.98.3 already established) |
| 4 | `{shown} cards from the {usable} voters counted{total>usable ? " · {total−usable} dark" : ""}` — "3 cards from the 5 voters counted · 1 dark". The 3 is now labelled as cards, and "dark" matches the hero's own word for exclusions |
| 5 | `No voter is currently counted, so there is no reading to show — evidence detail is in Power mode.` |
| 11 | `{label} · {direction}; {bull} of the {active} counted voters lean bullish.` |
| 12 | `…{bull} bullish, {neutral} neutral, and {bear} bearish — {active} of {total} voters counted.` (full-coverage arm: `— all {total} voters counted.`) |
| 13 | `A directional call needs a strict majority of the counted voters — at least {required} here.` |
| 16 | `{bull} bull · {neutral} neutral · {bear} bear — {counted} of {total} voters counted` |
| 17 | `…with {bull} bull and {bear} bear among the {counted} counted, it would take two factors moving together.` |
| 10 | (optional, separate scope — the touch-reachability problem is an open owner call from v3.73; copy itself is already correct) |

Rows 5–9, 14–15 need no change beyond optionally swapping "usable" → "counted" for
vocabulary consistency where it costs nothing (#5 shown above; #6/#7 read fine either way
since they qualify a claim rather than report a count).

## Test blast radius (before implementing)

#11/#12 are pinned by smoke and all three browser suites (the "0/3 core inputs usable"-style
anchors and the A1 shape guards), and #4/#2 are pinned in public-render — every replacement
above means re-pinning those on the new copy, per the house rule that pins move with the
behavior they describe, never the other way around.

---

# Outcomes — 2026-08-28

Two commits on `claude/macrodash-type-scale-leftovers-a2u29u`, copy-only throughout: no band,
quorum, engine, count-derivation, TT or type-scale change, and `regime.js` untouched.

- **`ebe804d`** — rows 2, 3, 4, 5, 11, 12, 13, 16, 17.
- **`7148d08`** — the delta: the Drivers expander label and the clipboard payloads.

Gates at each commit: 2033/2034 smoke + 306 render + 193 public-render, real Chromium under
`REQUIRE_BROWSER=1`, `audit:prod` clean. Every change negative-controlled; the controls and
the counts they turn red are recorded in the commit messages.

## Canonical forms now in force on the public surface

| Quantity | Form |
|---|---|
| coverage | `{N} of {total} voters counted` |
| bullish tally | `{bull} of the {counted} counted voters lean bullish` |
| Simple card cap | `{shown} cards from the {usable} voters counted` — labelled as CARDS |
| exclusions | `· {N} dark` |

No slash fraction, and "usable" never sits on a fraction.

## Corrections this pass earned — the survey was wrong three times

1. **Row 3's rationale does not hold.** The survey claimed `Cross-signals — N of M inputs
   usable` renders on DATA HOLD beside rows 1 and 2. It cannot: `computeRegime` guards that
   rewrite behind `!insufficient`, so the withheld branch never produces it. The shared
   `subText` strip shipped anyway as defensive symmetry, and is a **no-op today**. The string
   still reaches a reader in one real case — `conf` absent, which happens only under
   extraction-reuse — and that was left alone deliberately: the tail is the only coverage
   information on screen when there is no voters line.
2. **"0/3 core inputs usable" does not exist.** The survey inherited it from a stale comment
   at `FiveWhys.jsx:12`. No code emits it and no pin anchors it — the v5.3 One Call rewrite of
   WHY #1 retired the phrase. The real LOADING/ERROR anchor is `not enough usable evidence to
   publish a direction` (row 14, untouched). Comment corrected.
3. **The "clipboard paste block" was mislabeled.** `dashboard.jsx`'s
   `…: 5 of 6 factors usable.` is the **aria-live status region**, not a clipboard payload.
   The real clipboard is two builders in `macroCall.js` — `formatMacroCallPaste` and
   `formatMacroShareCard` — both carrying the slash form, neither originally flagged. All
   three were fixed: the aria-live region is the screen-reader rendering of the hero's own
   claim, so leaving it would have made the announcement disagree with the line it announces.

## Pins

17 moved onto the new copy (11 smoke, 6 public-render), 3 added for tails that had no guard
(rows 11 and 17, and the two-clipboard-payloads agreement).

Two pin defects surfaced while moving them, both worth remembering:

- The row-3 pin is **comment-stripped**. `bandSrc` still carries a superseded copy of the old
  inline expression inside a block comment, so raw-text matching would have passed vacuously
  with the live strip deleted — the v3.60.1 self-matching trap.
- The added clipboard pin initially referenced `share` above its declaration. That is a TDZ
  `ReferenceError` which killed the suite mid-run rather than passing quietly — loud, but it
  is the shape that would pass quietly if the reference were inside a lazy branch.

## Still outside the canonical form — deliberately

| Site | String | Why it stands |
|---|---|---|
| `whatChanged.js:39` | `Evidence base 4 → 5 of 6 factors usable` | Out of the scopes given; public-facing, one-line fix available |
| `regime.js:217` | `Cross-signals — N of M inputs usable` | Owner ruled `regime.js` off-limits; reaches a reader only when `conf` is absent |
| Row 14 | `not enough usable evidence to publish a direction` | Owner ruled it untouched; it is the LOADING/ERROR anchor three suites read |
