# 2026-08-29 — FEAT-NEWCOMER-RULER: the MIXED sub stopped pointing at the wrong gauge, and
# every card got a ruler for its own number

**Status: SHIPPED same pass — the Outcomes section at the foot carries what actually landed,
including the three places the plan was wrong.** Copy/projection only: no vote, band, flip
edge, quorum, cron, worker or TT change.

## The bug the owner read off prod

2026-08-29 (Saturday, CLOSE, live read, 10am record correctly not loaded):

    HODL 💎 · NEUTRAL · "Cross-signals – watch VIX"
    VIX 14.43 HELPING · CAPE 42.2 HURTING · CPI 3.5% YoY HELPING · 6 of 6 voters counted

`REGIME_META.MIXED` carried a STATIC sub, and `computeRegime`'s only override (v3.61) fired
when VIX was EXCLUDED. So on every mixed tape where VIX was present the hero said *watch
VIX* — including this one, where VIX at 14.43 is a HELPING vote and the actual disagreement
was sleepy vol + cooling inflation against a rich CAPE. The line pointed a newcomer at the
one gauge that was fine, and "Cross-signals" is not decodable by the reader it was for.

Second half of the same problem: the three cards showed 14.43 / 42.2 / 3.5% with no ruler.
A number with no scale beside it cannot answer *"is that a lot?"* — which is the whole
question a newcomer brings.

## What shipped

- **`src/regime.js` — the MIXED sub is DERIVED.** `computeRegime` already counts the votes;
  it now keeps the KEYS as it counts, and when both sides are present the sub names them
  from the band table's own `plain` nouns: *"volatility and inflation help, prices do not"*.
  `valuation → "prices"` is the ONE alias, this sub only. One-sided mixes (all-bull or
  all-bear with neutrals holding the majority off) keep the v3.61 nearest-flip fallback —
  there is no disagreement to name, so the honest line is still "what would change this".
  **The VIX-excluded path is byte-unchanged.**
- **`ruler` on all six bands** — the current edges restated, living beside the rule they
  describe (the `plain`/`plainBull`/`whyItMatters`/`metric` doctrine). `CAPE_MEAN`/`CAPE_ATH`
  MOVED from `macroCall.js` into `regime.js` so the valuation ruler derives 26.1 from
  `CAPE_MEAN * 1.5` instead of minting a second literal; macroCall imports them back.
  (`regime.js` is deliberately import-free and macroCall sits downstream via evidence.js, so
  the dependency had to run this way round.)
- **`src/evidence.js`** passes `ruler` through on each card — a pass-through, never a copy.
- **`src/sections/SimpleCards.jsx`** renders it as one muted line under whyItMatters.
  Presentation-only, as required.
- Power is untouched: the moon voice, the six-factor matrix and the RISK-ON/RISK-OFF subs
  are all exactly as they were.

## Corrections — three places the plan was wrong, recorded not edited away

1. **"Hero sub ≤ ~48 chars" was the wrong unit, and 48 would have cost real copy.** Measured
   by driving the built bundle at both phone widths: the sub is 13px mono in a 335px box and
   fits ~32 chars per line INCLUDING its "NEUTRAL · " prefix, so 44 · 54 · 55 · 60-char subs
   all render as the SAME two lines, while 67 is three at 375px and 79 is three at both. A
   48-char cap would therefore have degraded ordinary 2-vs-1 tapes (55 chars, two lines) for
   no rendered benefit. `MIXED_SUB_MAX = 60` is the measured two-line boundary at the
   narrower phone, and past it the sub states the SPLIT (`3 help, 1 does not`) rather than
   naming six factors across four lines — the fully named sentence renders directly beneath
   it either way, so the names move one line down, never out of reach.
2. **The first public-render ruler pin was in the wrong scenario.** It asserted the VIX ruler
   inside the v3.94 fixture, which DELETES vix — so the factor is correctly excluded, is
   correctly not a card, and correctly has no ruler. The pin was measuring a card that must
   not exist. It now measures the 10Y ruler (that card is proven present two assertions
   below) plus the inverse — an excluded factor contributes no ruler — and the owner's three
   named cards are pinned on the MIXED tape, where they are the three that actually render.
3. **My own reconciliation pin CRASHED instead of failing.** The missing-ruler negative
   control made it call `.includes` on `undefined`, which killed the run mid-suite and
   printed no total — the v3.99.4 P0 shape, reproduced by my own test. Guarded to return
   false; the control now turns three assertions red and still prints a total.

## Verb agreement, caught by the fixtures on the first run

The flat `do not` printed *"volatility do not"*. A single mass noun takes helps/does not; a
multi-noun list, and the plural-agreeing nouns (`prices`, `financial conditions`), take
help/do not. Pinned with its own fixture.

## Tests

**2067 smoke · 306 render · 207 public-render · `audit:prod` clean**, all four via
`npm run gates` in real Chromium under `REQUIRE_BROWSER=1`.

The pin worth naming is the reconciliation, because it turns the ruler from a caption into a
guard: for each of the four scalar bands, `vote()` ↔ `flip` edges ↔ the ruler's own numbers
must all name the same two values, derived from the table at runtime rather than restated in
the test (the SOURCES/DERIVED_OF convention). Move an edge in `vote()` alone and the
vote↔flip half goes red; move it in `flip` alone and the ruler half does; move it in both and
the locked-copy pin does. CPI and valuation are compound votes with `flip:null` — their
locked literals are pinned instead, which is the same reason the ticket forbids inventing a
crossing for them.

Deliberately NOT done: templating the ruler off `flip.bullEdge`. That would have put a third
expression of the edge inside a table that gates the public verdict, and locked decision 1
keeps `vote()` byte-untouched. The reconciliation pin buys the same guarantee from outside.

## Negative controls (all restored green after)

| Control | Result |
|---|---|
| VIX vote edge 18 → 17, flip + ruler left at 18 | 4 red, incl. the reconciliation |
| One band's `ruler` removed | 3 red (locked copies · card projection · reconciliation) |
| Derived clause disabled (`if(false)`) | 4 red — the whole derived-sub battery |

## Budget re-pin, with the measurement

`v4.0 glance budget` 780 → **820** at 390×844 (v3.45/v3.95/v4.1.3 precedent, never quietly
loosened). Measured 747 → 794 with the first cut, **788** after compacting the ruler line
(marginTop 2→1, lineHeight 1.4→1.3) — the compaction came first, the re-pin second. Two of
the six rulers legitimately wrap to a second line at phone width, so the remainder is real
content. 820 keeps SPY inside the 844px first screen (the hard ceiling this guard defends)
while leaving ~32px for the CI font-metric variance that turned v4.1.3 red on a layout nobody
had regressed. The assertion now reports its own measurement.

## Acceptance — 375px, the owner's exact prod tape, real built bundle

    MACRO BACKDROP · LIVE READ
    HODL 💎
    NEUTRAL · volatility and inflation help, prices do not
    Volatility and inflation are supportive, but stocks are priced for perfection.
    6 of 6 voters counted

    VOLATILITY 14.43 HELPING  · help below 18 · mid 18–25 · hurt above 25
    VALUATION  42.2 CAPE HURTING · help: CAPE below 26.1 (1.5× long-run mean 17.4) ·
                                   hurt: CAPE above 30 or >90% of ATH 44.19
    INFLATION  3.5% YoY HELPING  · help: latest YoY cooler than prior print · hurt: series
                                   up >0.5 pt from start · Fed target 2% is context, not the vote

No "watch VIX", no "Cross-signals", no engine words in the sub, 6 of 6 voters (no new voter),
no horizontal overflow at 375, SPY at 789 inside the 812 first screen, no page errors. The
newcomer test passes off the card alone: 42.2 against a stated help-below-26.1 / hurt-above-30
ruler says *expensive* without anyone being told.
