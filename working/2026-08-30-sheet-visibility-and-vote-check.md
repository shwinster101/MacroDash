# 2026-08-30 — v5.9.2: sheet visibility/font, and a vote-count check that found no bug

**Status: SHIPPED same pass.**

## The feedback

> Can you make the pop up more visible in the middle of the screen and also the much larger
> font? It's too small for a user to read. Also, can you recount what the voters are actually
> showing? Because we are getting a [F&G] and NFCI, but they don't seem to be counting.

Two asks, one real fix and one verification.

## Fix 1 — centered, larger

The sheet (`src/primitives/FactSheet.jsx`) used `alignItems:"flex-end"` — a phone-bottom-sheet
convention, correct for a long scrolling document, wrong for a short 3-bullet tile. In the
owner's screenshot it read as a strip glued to the bottom edge, half-obscuring the panel behind
it, rather than the focal point it was meant to be. Changed to `alignItems:"center"`. Measured:
the dialog's own vertical center now lands within 10px of the viewport's center, both for a
card sheet and the verdict sheet.

Font: the type scale (`design-tokens.js`) jumped 13px (`fs-l`) straight to 22px (`fs-xl`) with
nothing between headline and body text — the teaching prose sat at `fs-s`, 10px. Added
**`fs-body` = 16px** as a real token (the reading size for prose surfaces), not a one-off
literal in the component. Title now renders at `fs-xl` (22px, same weight as the verdict
itself), bullets at `fs-body` (16px, up from 10px), bullet text color bumped from
`textSecondary` to `textPrimary` for contrast at the larger size.

## Fix 2 (verification only) — the vote count is correct

Traced the exact math against the owner's own screenshot rather than guessing:

| Factor | Value | Band | Vote |
|---|---|---|---|
| F&G | 54 | bull `>55` / bear `<30` | **neutral** (54 is neither) |
| NFCI | −0.57 | bull `≤−0.5` / bear `>0` | **bullish** (−0.57 ≤ −0.5) |

Both match the screenshot exactly ("54 — Neutral", "−0.57 SD ... bullish"), and the tally line
in the same screenshot reads "3 bull · 2 neutral · 1 bear — 6 of 6 voters counted" — which is
VIX+CPI+NFCI bull, 10Y+F&G neutral, VAL bear. All six counted, none excluded.

`VOTE_STYLE` confirms the glyph meanings: `•` = neutral (a real, counted vote with no lean),
`⏱` (amber) = excluded (genuinely not counted). The screenshot shows no `⏱` anywhere — nothing
was excluded that day. The confusion was almost certainly the `•` glyph itself: at the same
tiny chip size the owner was already complaining about elsewhere, a dot plausibly reads as
"nothing/not counted" rather than "counted, neutral" — especially since dots mean something
different (provenance/liveness) on the macro strip a few inches away on the same page.

**No code change made here.** This is a verification result, not a defect. If the `•` glyph's
ambiguity is worth fixing on its own, that's a separate, small, clearly-scoped follow-up
(e.g., spelling "NEUTRAL" instead of a dot in the chip row) — not bundled into this pass, since
nothing was actually broken.

## Tests

**2093 smoke · 306 render · 227 public-render · `audit:prod` clean**, real Chromium under
`REQUIRE_BROWSER=1`.

| Negative control | Result |
|---|---|
| Reverted `alignItems` to `flex-end` | 1 red (smoke) + 1 red (browser, measured position) |
| Reverted title font token to the old `fs-m` | 1 red (smoke) + 1 red (browser, measured px) |

## Measured

Valuation sheet: dialog vertical center 422px vs viewport center 422px (390×844). Title
`getComputedStyle` font-size: 22px. Bullet font-size: 16px. Screenshot attached to the PR.

## Outcomes

Landed as **v5.9.2**, PR #21, squash-merged to `main` as `f71e2b3`.

- Gate at merge: **2093 smoke · 306 render · 227 public-render**, `audit:prod` clean, real
  Chromium.
- Both fixes shipped as measured; `fs-body` = 16px is a real `design-tokens.js` entry, not a
  literal in the component.
- The vote-count half produced **no code change**, which is itself the outcome: the count was
  correct. The `•` legibility question it raised was deliberately not bundled and is still open.
