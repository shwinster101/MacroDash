# 2026-08-31 — FEAT-SIMPLE-SHEET-PLAIN v2 (v5.9.5): place the number, keep the name

**Status: SHIPPED same pass.** Copy-only in `src/regime.js` (`explain.what` for `vix`,
`valuation`, `tenYear`) plus pins. No vote, flip, ruler, MIXED-sub, cron or other sheet moved.

## The correction

> Are you sure that's the highest leverage language? Better, but we can do better. Full actual
> name is high leverage as title.

The v5.9.1 bullets described what each gauge is *made of*: "the options market's estimate",
"the discount rate under every future dollar of earnings", "not a survey of opinion". That
teaches the instrument. A beginner holding the phone still cannot say whether **14.43 is high
or low** — which is the only question they actually have.

## What changed

Three sheets, one beat order: **what the metric is → where a reading sits (history AND our
vote) → what usually happens when it moves.**

Titles are **untouched**, per the owner's ruling that the full official name is itself the
high-leverage element at the top. Plain language belongs in the body; the identity stays formal.

## The two-ruler rule

The ticket's sharpest constraint, and the one most likely to be eroded by a later "tighten this
up" pass: history/convention and the MacroDash vote may share a bullet **only if both are
named**.

> The teens are calm. About 20 is a long-run typical day. 30 is a scare.
> MacroDash: below 18 helps, above 25 hurts.

Collapsing 20/30 into 18/25 would read as if our band were the world's convention. It is not:
~20 is the long-run average and 30 is the market's fear line; 18/25 are *our* vote edges. Both
survive, and a negative control that collapses them turns the pin red.

CAPE follows the same shape — old average (`CAPE_MEAN`) and 1999 peak (`CAPE_ATH`) as the
history rulers, then our own "above 30, or above 90% of that peak". Both numbers interpolated,
never retyped, with its own pin and its own control.

## The 10Y bullet earns its place by answering one question

The owner's third acceptance case was *"they can say why +0.05 is MIXED, not a crisis."* That
only works if the sheet says outright that the level is not what votes:

> There is no single right level. Lately it has lived between about 1.5% and 5%. MacroDash does
> not vote on the level. It votes on the one-month change: help below −0.10 points, hurt above
> +0.15.

Driven live, the eyebrow reads `THE 10-YEAR YIELD · 4.73% · +0.05PP 1-MO · MIXED` directly
above that body. The reader can trace it.

## Pins

- Titles pinned by exact string for all three keys
- `what.length === 3` (pre-existing contract pin, unchanged)
- VIX `what[1]` contains 18, 25, 20 **and** 30 — the two-ruler guard
- CAPE `what[1]` contains `CAPE_MEAN` and `CAPE_ATH` by value, **and** the source is pinned to
  the template form (`${CAPE_ATH}`) so retyping fails even if the digits happen to match
- 10Y `what[1]` contains "does not vote on the level", "0.10", "0.15"
- Ban list pinned ABSENT from the three `what[]` arrays — **scoped to bodies only**, because
  the CAPE title legitimately contains "Cyclically"

## Negative controls

| Control | Result |
|---|---|
| Collapse VIX's 20/30 into 18/25 | 1 red (two-ruler pin) |
| Retype CAPE's numbers as literals instead of interpolating | 1 red (interpolation pin) |
| Reintroduce one banned stem ("discount rate") in the 10Y body | 1 red (ban sweep) |

One control was **invalid on the first attempt** and is recorded rather than quietly redone:
the retype substitution replaced a backtick-opened template with a double quote and left the
closing backtick, so the suite crashed on a syntax error instead of failing a pin. A control
that breaks the file proves nothing about the pin. Redone properly, it turned exactly the
intended assertion red.

## Acceptance — driven, all three cases

| Case | Result |
|---|---|
| VIX: can a non-trader say whether 14 is high or low? | "The teens are calm" — yes |
| CAPE: can they say 42 is expensive? | 17.4 average vs 44.19 peak, both shown — yes |
| 10Y: can they say why +0.05 is MIXED? | level-doesn't-vote + both change edges — yes |

The 10Y sheet needed its own fixture: on the 8/31 tape 10Y votes neutral and sorts 5th, so the
3-card cap doesn't surface it. Driven on a tape where it does reach a card, rather than claimed
from the module alone.

## Version

5.9.2 → **5.9.5**, owner-set. The v1 copy pass this corrects never landed on `main`, so 5.9.3
and 5.9.4 do not exist. Recorded as a deliberate jump (the v4.99 precedent) so a later reader
does not hunt for phantom releases.

## Outcomes

Landed as **v5.9.5**, PR #22, squash-merged to `main` as `67b7712`.

- Gate at merge: **2097 smoke · 306 render · 227 public-render**, `audit:prod` clean, real
  Chromium under `REQUIRE_BROWSER=1`. CI green on `main` — both the `test` job and the
  Cloudflare Pages check. Local green is not CI green (the v4.1.3 lesson), so the run is the
  arbiter, not this container.
- Copy-only in `src/regime.js`. No vote, flip, ruler, MIXED-sub, cron or other sheet moved, and
  the three titles are byte-identical to what shipped in v5.8.
- Nothing in the ticket was left undone.

### The scoping limit, named so it is not mistaken for coverage

The ban sweep is scoped to the three rewritten keys, so it says nothing about the other three
explainers — `fearGreed`, `cpiHeadline`, `nfci` — which still carry v5.9.1 bodies written in the
instrument-teaching voice this pass retired. That is not a hypothetical: **`cpiHeadline`'s third
bullet contains a banned stem verbatim** ("lifting the discount rate on every future dollar"),
and it passes only because the sweep does not look there. `nfci`'s "It measures the plumbing,
not the price" and `fearGreed`'s "positioning read, not a cause" are the same register.

Two honest readings, both available:

- The three rewritten sheets are the ones a newcomer opens first (VIX · CAPE · 10Y), so the
  pass targeted where it pays. Half the product now speaks in one voice and half in another.
- Widening the sweep to all six today would fail the build on copy nobody has ruled on. The
  ban list is scoped to bodies the owner has approved in the new voice; extending it is a copy
  decision, not a test decision.

Owner call. If the answer is "make all six match", it is one more copy pass of the same shape
and the sweep widens with it.
