# 2026-08-29 — v5.9 FIRST GLANCE: the beginner read

**Status: SHIPPED same pass.** Simple-only; Power is byte-unchanged and pinned that way. No
vote, band, flip edge, quorum, cron, worker or TT contract moved.

## The feedback

A first-time reader with no market background, on the live v5.8 page:

> there's way too much going on, too many words at first glance … maybe we keep headline
> prominent on first view; voters a swipe or scroll away, the context parameters below that.
> Remember new folks likely have no context on hodl mooning or diamond hands so explaining
> bullish vs bearish on click is useful. Each word needs to be high leverage.

**The requested ORDER was already the order** — hero, then the voter cards, then the macro
strip. What was wrong was the density: the first screen carried two wordmarks, six controls, an
eyebrow, a verdict in three vocabularies, a sentence, a clock caveat, a coverage count, two
buttons, and three cards of four lines each. So this pass is compression, not re-ordering, and
that distinction is worth keeping: the layout was right and the word count was not.

## Measured, before → after (375px AND 390px, real built bundle)

| | before | after |
|---|---|---|
| macro strip begins | 791 | **610** |
| cards begin | 409 | **332** |
| visible words above the fold | 290 | **208** |

Both fold budgets tightened WITH the measurement (820 → 660, 480 → 420). A density pass that
leaves its own guards where they were has not defended anything.

## What shipped

1. **The verdict explains itself.** The one word everybody sees was, to this reader,
   decoration. It is now a button opening the v5.8 sheet: the four calls in plain words mapped
   to BULLISH/NEUTRAL/BEARISH, what those three machine words mean, and *what this is not* — a
   backdrop read, not a view on any one stock, and not advice. `VERDICT_EXPLAIN` lives in
   `regime.js` beside the engine whose states it describes (and that keeps `RegimeBand` under
   its 300-line Property-10 bound, which the first cut had broken).
2. **The card sheds its prose.** Four lines → two. The why-it-matters sentence moves into the
   sheet as its lead, the full sentence-form ruler follows as *"how MacroDash reads it"*, and
   the face keeps a chip: `help <18 · hurt >25`. The chip is **derived from the band's own flip
   edges** for the four scalar bands — never a third copy of a threshold — and the two compound
   bands carry an authored short form. **Freshness stays on the face**: the v3.1 provenance
   invariant is a fact, not prose.
3. **The hero drops its duplicate.** In Simple the tally sub (`NEUTRAL · 3 help, 1 does not`)
   sat directly above the sentence that says the same thing in words. Only one of the two is
   usable by a newcomer. Power keeps both, so v5.8's derived sub is untouched where it is read.
4. **Operator chrome leaves Simple** — the duplicate wordmark, the provenance chip, the ⋯ OPS
   menu, the alert badges. The provenance chip still renders on ERROR.

## The one judgment call worth arguing with

**The alert badge.** Removing a red-fact badge looks like a v3.25 reversal, and it is not: the
Macro Alerts section is already `!publicView&&!simple`, so in Simple the badge counted monitors
the reader could not reach and its deep link led nowhere. The rule is that a collapse never
hides a red fact; it does not require a count of a section that is not on the page. If the owner
wants alerts visible in Simple, the honest fix is to render the SECTION there, not the count.

## Corrections and catches

1. **A silent `str.replace` with no assert** left `rulerChip` imported nowhere while it was
   already called — the page went blank and the measurement probe crashed on a null `header`.
   Every scripted edit in this pass carries an assert now; the one that did not is the one that
   broke.
2. **My own new browser pin had a vacuous half.** `!/FIRED|BLIND/` on a fixture where no alert
   fires proves nothing — the negative control (restoring the Simple badge) left the browser
   suite green and only smoke went red. The assertion now states that limit, and a **Power
   contrast pin** was added so the shed-chrome claim cannot pass by never rendering. Third catch
   of this class this week (v3.60.1's trap).
3. **The first cut of the verdict explainer broke the 300-line bound** on `RegimeBand`. Moving
   the copy to `regime.js` was the fix and is also the better home — a raise-the-bound would
   have hidden a structural fact behind a number.

## Tests

**2091 smoke · 306 render · 227 public-render · `audit:prod` clean**, real Chromium under
`REQUIRE_BROWSER=1`. The verdict sheet is driven: tap → four calls → both machine words → the
not-advice section → Escape returns focus to the verdict.

| Negative control | Result |
|---|---|
| A chip hardcoded instead of derived from `flip` | 1 red |
| The Simple alert badge restored | 2 red (smoke); browser green — see catch 2 |

## Still open for the owner

- **"CLOSE · data pulled … · end-of-day, not real-time"** is still ~10 words of header, and
  "CLOSE" is jargon to this reader. It is pinned copy (8/28 A1 binds the stamp to the DATA), so
  changing it is a deliberate re-pin rather than a tidy-up — worth doing if the next read still
  trips on it.
- **"live read — today's 10am record not loaded"** is honest and, to a beginner, meaningless.
  Same call: it exists so an unfrozen recomputation cannot wear the official call's identity by
  silence. A shorter phrasing that keeps the claim would be a good next cut.
- The **TERMINAL button and the ticker dock** stay in Simple. They are the owner's own doors and
  the beginner will not tap them, but they are two more operator words on the page.
