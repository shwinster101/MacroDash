# 2026-08-30 — v5.9.1: "I meant 3 bullets total"

**Status: SHIPPED same pass.**

## The feedback

> Dude I meant 3 bullets total. The tile descriptions too large

On the live v5.9.0 explainer sheet. Direct hit — the sheet had ballooned past what was asked
for.

## What was actually shipped in v5.9.0 (the bug)

Each tile was: a lead sentence, then "what it is" (3 bullets), then "what moves it" (a
paragraph), then "normal / neutral level" (a paragraph, often 2-4 sentences), then "why it
matters to the macro picture" (a paragraph), then — where one existed — a Buffett/Graham quote
with its own attribution line. Four-plus sections, not 3 bullets. The original ticket's wording
("3 bullet summary of what it is... plus key drivers, the baseline... and what it means") is
ambiguous on a literal read, but the owner's correction resolves the ambiguity definitively:
3 bullets, full stop, per tile.

## The fix

One contract, everywhere: `{full, what: [exactly 3 bullets]}`. Applied to:

- All six band explainers (10Y, VIX, F&G, CPI, valuation, NFCI) in `src/regime.js`.
- `VERDICT_EXPLAIN` — previously a different shape entirely (`lead` + `sections[]` with its
  own bullets-or-text branching). Now the identical `{full, what:[3]}` contract, which also
  let `ExplainerBody` in `FactSheet.jsx` collapse to ONE render path instead of two.

Nothing here is new research — every fact from the three-days-ago sourcing pass survives,
folded into a bullet instead of living in its own paragraph:

| Old section | New home |
|---|---|
| "what it is" (3 bullets) | bullet 1 (tightened) |
| "what moves it" | folded into bullet 1 or 2 |
| "normal / neutral level" | bullet 2 |
| "why it matters to the macro picture" | bullet 3 |
| Buffett/Graham quote | **cut** |

## The one real content loss, named rather than silently dropped

The quote block is gone, not shrunk. A citation plus its attribution line doesn't fit inside
"3 bullets total", and the quotes were never in the original ticket — they were something I
added on top. Given explicit direction to shrink, cutting the addition is the correct call, not
a hedge. If the owner wants the Graham/Buffett corrections back, the cheapest re-add is a single
compact 4th line under the bullets (not a full quote block), which is a small, clearly-scoped
follow-up rather than something to guess into this pass.

## Corrections

1. My first cut of the "one render path" structural pin used a bare-word negative regex
   (`!/Section|drivers|baseline|macro|.../`) against the WHOLE source file including comments —
   it failed immediately because the file's own doctrine comments legitimately use the words
   "macro", "sections", "quote" in prose (e.g. "knows nothing about macro"). Re-scoped to strip
   comments first and match property-access patterns (`explain.drivers`, not the bare word) —
   the same comment-stripped-sweep convention this codebase already uses elsewhere.
2. The VIX bullet's first draft said "by convention" where the pin (reasonably) expected
   "market convention" — a wording mismatch, not a logic bug. Tightened the bullet text rather
   than loosening the pin.
3. One negative control (injecting an arbitrary extra text block) passed clean, which does NOT
   mean the pin is broken — it means an arbitrary injection isn't the regression this pin
   exists to catch. The REALISTIC regression — restoring a reference to the retired
   `explain.drivers` field — was tested separately and correctly turned the pin red. Recorded
   so the first result doesn't read as a false "all clear."

## Tests

**2091 smoke · 306 render · 225 public-render · `audit:prod` clean**, real Chromium under
`REQUIRE_BROWSER=1`.

| Negative control | Result |
|---|---|
| A 4th bullet added to a band explainer | 1 red |
| A reference to the retired `explain.drivers` field restored | 1 red (structural pin) |

## Measured

The valuation sheet: was a scrolling multi-section block with a quote footer; now **235px**,
three bullets, `✕` and done. Verdict sheet measured the same — 235px for four calls, both
machine words, and the not-advice line, all in 3 bullets.

## Still open

- `band.ruler` (the full sentence-form ruler from FEAT-NEWCOMER-RULER) and `band.whyItMatters`
  are now genuinely unrendered — nothing in the product shows them any more. Left in place as
  source data rather than deleted, since they carry locked copy from an earlier ticket and the
  vote/flip reconciliation pins still exercise `ruler`. If nothing ever re-surfaces them, that's
  a legitimate future cleanup, not something to guess at now.
- The compact quote re-add, if wanted (see above).

## Outcomes

Landed as **v5.9.1**, PR #20, squash-merged to `main` as `d806158`.

- Gate at merge: **2091 smoke · 306 render · 225 public-render**, `audit:prod` clean, real
  Chromium under `REQUIRE_BROWSER=1`.
- Shipped as written: `ExplainerBody` collapsed to a single render path, `{full, what:[3]}`
  became the one contract for every band and for `VERDICT_EXPLAIN`, the quote block was cut.
- **Correction to the "Still open" item above, recorded rather than edited away.** It predicted
  `band.ruler` would go permanently unrendered. Half wrong: `rulerChip()` — derived from the
  same `flip` edges — renders on the Simple card face (`SimpleCards.jsx:94`), so the ruler DATA
  is load-bearing and the vote↔flip↔chip reconciliation still has teeth. What is genuinely
  unrendered is narrower: `evidence.js` projects the full sentence-form `ruler` and
  `whyItMatters` onto the card object (lines 321/325) and **no section reads either**. Two
  orphaned projections, not an orphaned rule.
