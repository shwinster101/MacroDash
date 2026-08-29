# 2026-08-29 — v5.8: the MIXED sub stops pointing at the wrong gauge, and every parameter
# explains itself one tap deep

**Status: SHIPPED — two owner tickets, one release.** Part A (the ruler) merged as PR #17; Part
B (the fact sheet + the whys pass) rides the v5.8.0 bump. Copy/projection only: no vote, band,
flip edge, quorum, panic, cron, worker, history or TT change. The Outcomes and Corrections
sections at the foot are the record; where the plan was wrong, the correction stands beside it
rather than replacing it.

## A — the bug the owner read off prod

2026-08-29 (Saturday, CLOSE, live read, 10am record correctly not loaded):

    HODL 💎 · NEUTRAL · "Cross-signals – watch VIX"
    VIX 14.43 HELPING · CAPE 42.2 HURTING · CPI 3.5% YoY HELPING · 6 of 6 voters counted

`REGIME_META.MIXED` carried a STATIC sub, and `computeRegime`'s only override (v3.61) fired
when VIX was EXCLUDED. So on every mixed tape where VIX was present the hero said *watch VIX* —
including this one, where VIX at 14.43 is a HELPING vote and the real disagreement was sleepy
vol + cooling inflation against a rich CAPE. It pointed a newcomer at the one gauge that was
fine, and "Cross-signals" is not decodable by the reader it was for.

Second half of the same problem: the three cards showed 14.43 / 42.2 / 3.5% with no ruler. A
number with no scale beside it cannot answer *"is that a lot?"* — the question a newcomer
actually brings.

## A — what shipped

- **The MIXED sub is DERIVED.** `computeRegime` already counts the votes; it now keeps the KEYS
  as it counts, and names the disagreement from the band table's own `plain` nouns:
  *"volatility and inflation help, prices do not"*. `valuation → "prices"` is the ONE alias,
  this sub only. One-sided mixes keep the v3.61 nearest-flip fallback. **The VIX-excluded path
  is byte-unchanged.**
- **`ruler` on all six bands**, living beside the rule they describe. `CAPE_MEAN`/`CAPE_ATH`
  moved from `macroCall.js` into `regime.js` so the valuation ruler derives 26.1 from
  `CAPE_MEAN * 1.5` instead of minting a second literal.
- **The reconciliation is what makes it a guard rather than a caption**: for each of the four
  scalar bands, `vote()` ↔ `flip` edges ↔ the ruler's own numbers must name the same two values,
  derived from the table at runtime (the SOURCES/DERIVED_OF convention). Move an edge in one
  home and the other two go red. CPI and valuation are compound (`flip:null`), so their literals
  are pinned — the same reason the rules forbid inventing a crossing for them.
  Deliberately NOT done: templating the ruler off `flip.bullEdge`, which would put a third
  expression of the edge inside a table that gates the public verdict.

## B — the fact sheet (owner's amended ask, same day)

> "Clicking on each context parameter brings a pop up tile with an x mark to exit. Tile provides
> the highest leverage 3 bullet summary of what it is (full spellings…) plus key drivers, the
> baseline average or what is considered neutral or safe level, and what it means to the macro
> environment. Before deciding the statements review investopedia and Warren Buffett quotes."

- **`src/primitives/FactSheet.jsx`** — the dialog, the explainer body, and `Explainable`, the
  trigger that owns the open state. The state lives in the PRIMITIVE because `src/sections/*`
  are pinned presentation-only (the v3.73 FEAT-UIMOD boundary) — a pin that caught this on the
  first run, and was right to.
- **`explain` on every band**: `{full, what[3], drivers, baseline, macro, quote|null}`. Same
  one-home rule as `ruler`; `simpleCards` passes it through; the section renders it and decides
  nothing. A band with no explainer degrades to a plain `<div>` — a button that opens nothing is
  a lie.
- **The full WAI-ARIA dialog contract**, driven in Chromium rather than string-pinned: labelled
  + `aria-modal`, Escape / backdrop / ✕, a trapped Tab, body-scroll lock, and **focus restored
  to the card that opened it**.
- **The affordance is a ⓘ on the row that already exists**, plus a visually-hidden sentence for
  a screen reader. The first cut used a separate "WHAT IS THIS? →" line and it measured **+33px
  across three cards**, pushing the macro strip past its budget — a real cost for a second way
  of saying the same thing. The ⓘ costs 3px.

## The research pass, and the three corrections it forced

Sourced before written. Three findings were not refinements — they were live copy being wrong:

1. **The Fed's 2% target is on PCE, not CPI** (FOMC Statement on Longer-Run Goals, 2012; PCE and
   CPI differ systematically and CPI usually runs higher). The 8/29 locked ruler ended
   *"· Fed target 2% is context, not the vote"*, which reads as a 2% CPI target — the single most
   repeated error about this series. **The clause is REMOVED**, the correct statement with the
   PCE distinction moved into the sheet, and the withdrawn claim is pinned ABSENT so it cannot
   quietly return (the v3.85 retired-instruction rule). Owner-locked copy corrected on evidence,
   recorded here rather than done quietly.
2. **VIX "above 30 = extreme fear" is market convention, not a Cboe-published threshold.** The
   sheet says exactly that, and gives the long-run average as "roughly 20" because sources
   genuinely disagree between ~19 and ~22 depending on the start date.
3. **"Price is what you pay; value is what you get" is Benjamin Graham's**, quoted by Buffett in
   the 2008 Berkshire letter. Shipping it as Buffett's would be a fabricated provenance — the
   same defect class as a fabricated number — so the attribution is pinned by value.

Also acted on: CAPE presents BOTH baselines (the 1881 mean ~17.4 and the post-1990 median ~25)
and names the choice as a live argument, rather than picking the flattering one; NFCI states
zero-by-construction AND why our band is asymmetric; and the 10Y sheet refuses to invent a
"normal" level. **The 10Y carries no Buffett quote**: the famous "interest rates are to asset
prices what gravity is to the apple" has a contested venue and unstable wording across sources,
so the sheet uses the better-sourced 2023 remark instead, and bands with no verified quote carry
`null` rather than a paraphrase.

⚠️ **Sourcing limit, stated:** investopedia.com blocks this environment's crawler and direct
fetches are egress-blocked here, so every figure above came through search results rather than
an opened primary document. The copy is written to be true at the level it claims (conventions
named as conventions, disagreements named as disagreements). The three highest-value
verifications for a human with a browser: CNN's own Fear & Greed page for the exact band edges,
Cboe's VIX page for whether any official threshold exists, and the Berkshire letters for the two
contested quotes.

## Corrections — where the plan was wrong, kept rather than edited away

1. **"Hero sub ≤ ~48 chars" was the wrong unit, and 48 would have cost real copy.** Measured at
   both phone widths: the sub is 13px mono in a 335px box, ~32 chars per line INCLUDING the
   "NEUTRAL · " prefix, so 44 · 54 · 55 · 60-char subs all render as the SAME two lines, while
   67 is three at 375px. `MIXED_SUB_MAX = 60` is that measured boundary; past it the sub states
   the split (`3 help, 1 does not`) rather than naming six factors across four lines.
2. **The first public-render ruler pin was in the wrong scenario** — it asserted the VIX ruler
   inside the v3.94 fixture, which DELETES vix, so it was measuring a card that must not exist.
   It now measures the 10Y ruler plus the inverse (an excluded factor contributes no ruler), and
   the owner's three named cards are pinned on the MIXED tape where they actually render.
3. **My own pins CRASHED instead of failing — twice.** The missing-ruler control made the
   reconciliation call `.includes` on `undefined`; the missing-explainer control did the same to
   the explainer pins. Both killed the run mid-suite and printed no total — the v3.99.4 P0 shape,
   reproduced by my own tests. Both are guarded now. A suite that dies mid-run reads exactly like
   a suite that never ran.
4. **The first missing-explainer control was too blunt** and sliced out the band's `read`/`metric`
   with the explainer, so the crash it produced was mine, not the guard's. Recorded because the
   lesson is the same one this repo keeps relearning: a negative control that changes more than
   one thing proves nothing about either.

## Tests

**2081 smoke · 306 render · 221 public-render · `audit:prod` clean** — `npm run gates`, real
Chromium under `REQUIRE_BROWSER=1`.

| Negative control | Result |
|---|---|
| VIX vote edge 18 → 17, flip + ruler left stale | 4 red, incl. the reconciliation |
| One band's `ruler` removed | 3 red |
| Derived MIXED clause disabled | 4 red — the whole battery |
| Graham line reattributed to Buffett | 1 red |
| One band's `explain` removed | 4 red (after the crash guard) |
| Focus restore dropped from the sheet | 1 browser red |

## Budgets, re-pinned WITH measurements (the v3.45/v3.95/v4.1.3 rule)

`v4.0 glance budget` 780 → **820** at 390×844. Measured 747 → 794 with the first ruler cut,
**788** after compacting the ruler line (marginTop 2→1, lineHeight 1.4→1.3), **791** with the ⓘ.
820 keeps SPY inside the 844px first screen — the ceiling this guard actually defends — while
leaving ~30px for the CI font-metric variance that turned v4.1.3 red on a layout nobody had
regressed. The assertion now reports its own measurement, so a failure is a diagnosis.

## Acceptance — 375px, the owner's exact prod tape, real built bundle

    MACRO BACKDROP · LIVE READ
    HODL 💎
    NEUTRAL · volatility and inflation help, prices do not
    6 of 6 voters counted

    VALUATION 42.2 CAPE HURTING ⓘ
      help: CAPE below 26.1 (1.5× long-run mean 17.4) · hurt: CAPE above 30 or >90% of ATH 44.19

    → tap → "Cyclically Adjusted Price-to-Earnings ratio (Shiller CAPE)"
       WHAT IT IS · WHAT MOVES IT · NORMAL / NEUTRAL LEVEL · WHY IT MATTERS TO THE MACRO PICTURE
       "Price is what you pay; value is what you get."
       — Benjamin Graham, quoted by Warren Buffett, Berkshire Hathaway shareholder letter, 2008

No "watch VIX", no "Cross-signals", no engine words in the sub, 6 of 6 voters, no overflow at
375 with the sheet open, SPY inside the first screen, no page errors.

## Open, for the owner

- The owner asked "maybe instead of full descriptions right in the primary view?" — the full
  locked rulers were KEPT on the card and the sheet was added beside them, because the ruler is
  what answers "is that a lot?" without a tap and the acceptance test depends on it. If the card
  should slim to a short chip (`help <18 · hurt >25`) with the full ruler moving into the sheet,
  that is a small follow-up: the scalar chips derive from `flip`, and only CPI and valuation
  would need an authored short form.
- The three source verifications named above are worth ten minutes with a browser.
