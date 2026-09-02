# 2026-09-02 — public-view UX review (owner screenshots, Simple + Power, 9/1 tape)

Owner asks, verbatim in spirit:
1. "Colors or shapes as indicators before text is used. For example, green valuation if live/cached."
2. "Simple vs power is hard to tell, ensure clarity with each button."
3. "Immutable public call can be forgone too right. Look through examples like this or keep some
   text under windows so it is aesthetically simpler for simple users, and accessible for power
   users."

## Read-through of the two screenshots (390px, live 9/1 tape: HODL · NEUTRAL · CPI dark)

| # | Surface | Finding | Severity | Disposition |
|---|---|---|---|---|
| 1 | Simple cards | Direction is a WORD first (`HELPING` green, right edge). Freshness is a WORD (`cached`, green). Nothing on the card's left edge tells direction before the label is read. | high (owner ask 1) | **built** — glyph `▲▼•` + 3px bar lead the row; freshness is the strip's provenance dot |
| 2 | Header toggle | Pressed half = `surfaceHigh` (#161921) on `surface` (#0f1115) + bold. One shade apart. Unpressed text `textMuted`. | high (owner ask 2) | **built** — pressed half filled brand amber, dark text; `○ Simple` / `◉ Power`; tooltip + aria-label state what each mode shows |
| 3 | Simple hero | `immutable public call · captured 10:00 ET · 2026-09-01` at 8px directly under an eyebrow that already says `10AM FROZEN CALL`. Same for the A6 `live read — …` counterpart under a `LIVE READ` eyebrow. | med (owner ask 3) | **built** — both captions Power-face-only; Simple gets them inside the ℹ window |
| 4 | Simple hero | `5 of 6 voters counted · dark: CPI` is text-only; the one amber fact on the face has no shape. | med | **built** — one dot per voter (filled green / hollow amber) ahead of the sentence, hero + cards footer |
| 5 | Simple hero | Two icon-only 44px buttons (`⎘`, `ℹ`) render 9px/11px glyphs — the ⎘ is near-invisible in the screenshot. | low | **built** — fsL glyphs in Simple |
| 6 | Power hero | `NEUTRAL · volatility and financial conditions help, prices do not` sits directly over `Volatility and financial conditions lean bullish; valuation leans bearish; …` — same fact twice. | low | **filed** — v5.9 kept both in Power by owner ruling; not touched |
| 7 | Simple whys label | `+5 WHY THIS CALL · 5 CHECKS — ⇄ THE 10Y MONTHLY CHANGE BELOW -0.10 PPT…` wraps to two lines at 390px. | low | **filed** — the chip is a pinned prefix of the verbatim flip; shortening is a copy call |
| 8 | Dock | `GATE EASY` is text-first; chips have no state colour. | low | **filed** — the dock deliberately carries no per-name state (v5.6.8 owner ruling) |
| 9 | Header | `· end-of-day, not real-time` survives in Simple. | none | kept — it is the novice-expectations line (FINDING-4), text is its honest form |

Method: the shipped bundle was driven in Chromium at 390×844 through the public-render
harness's stubbed `/api/snapshot` with a frozen HODL call and the 9/1 values; before/after
screenshots are in the session scratchpad (not committed — the assertions are the record).

## Outcomes — v6.0.1 (built same session)

- Shipped: items 1–5 above. `src/sections/SimpleCards.jsx` (GLYPH map reconciled against
  `voteStyle`, `freshDot`, voter dots on the footer), `src/sections/RegimeBand.jsx` (voter dots,
  `windowCaption`, captions Power-face-only, fsL glyphs; module trimmed back under the 300-line
  Property-10 bound after the first cut landed at 313), `src/dashboard.jsx` (`VIEW_MODES` table,
  amber-filled pressed half, tooltips + accessible names).
- Measured at 390×844 with the window closed: cards begin at **337** (budget 420), strip at
  **602** (budget 660), `scrollWidth` 390. No budget re-pinned.
- Tests: smoke **[75]** (10 pins, source-shape) + public-render **[v6.0.1]** block (14 pins,
  driven: glyph-first row, coloured bar, green dot with the word visible-hidden only, 6/5/1 voter
  dots on both altitudes, the amber fill following the choice, the caption off the Simple face and
  inside the window with the date, on the Power face without a tap, glyph sizes, budgets).
  The 8/28 A6 public pin RE-PINNED to the window altitude (Simple) — claim unchanged, one pin
  became two (absent closed · present open). Gates at the head: **2178 smoke · 309 render ·
  249 public-render · audit clean** (from 2168 · 309 · 234).
- **Two of my own pins were wrong on first run, recorded rather than quietly fixed:** (a) the
  budget pin measured with the ℹ window OPEN (617/882) because the close-click came after the
  measurement — reordered; (b) the freshness pin demanded the title `cached` on a harness that
  serves `cached:false` (mode LIVE), and then used `\b` against an a11y span that abuts the date
  (`live2026-09-02`) — both halves loosened to what the rule actually claims (live OR cached,
  substring). (c) `innerText` of an inline-flex button carries a newline between glyph and word,
  so the Power-fill pin normalises whitespace.
- RegimeBand landed at 313 lines against the 300-line Property-10 bound; the added comments were
  compressed twice (306 → 298) — the pin counts `split("\n")`, so a 300-line file with a trailing
  newline reads 301.
- **Correction to the plan as first written:** the first fixture for "one dark voter" set
  `cpiHeadlineAsOf` 70 days back and expected STALE; the probe printed `6 of 6` — the monthly
  cadence tolerates that gap. The fixture now DELETES the CPI fields (the dead-feed shape the
  suite already uses for VIX), which is what actually produces the dark voter.
- Deliberately not built: items 6–8 (filed), and no change to the strip, dock or footer text.

## Pass 2 (same day) — "the bottom blurb under a dropdown", and the per-block indicator audit

Owner: *"That very bottom blurb can go too. Under a dropdown. Next, review each data parameter
block and what's key if needing a word or just an icon or color indicator."*

Rule applied, in this order: **colour/shape first; a word only where the shape is ambiguous or
the fact IS a word (a date, a label the source publishes, a unit); prose only one tap deep.**

| Block | Elements today | What is KEY | Indicator ruling | Change |
|---|---|---|---|---|
| Header status | ● dot · `CLOSE` · `data pulled <stamp>` · `end-of-day, not real-time` | session + freshness | dot (colour) + the session WORD (a state name); the stamp is a fact | none |
| Simple\|Power | `○ Simple` / `◉ Power` | which one is live | filled amber = colour; shape per mode; tooltip = word | done v6.0.1 |
| Hero verdict | `HODL 💎` · `NEUTRAL` · sentence · voter dots + count · ⎘ ℹ | the call | word+emoji+tint (the call IS a word); machine word secondary (v5.3 lock) | none |
| Card (×3) | `▲` bar · label · value · `HELPING` · ⓘ · ● date · ruler chip | direction of the VOTE | shape+bar+colour lead. **The word stays**: `▲` beside VOLATILITY reads as "vol is up" — the shape encodes the vote, not the metric's direction, so HELPING/HURTING is the disambiguator, not decoration | none (v6.0.1) |
| Cards footer | dots · `3 cards from the 6 voters counted` | coverage | dots first; sentence is the a11y form | done v6.0.1 |
| Whys label | `+5 WHY THIS CALL · 5 CHECKS — ⇄ <flip chip>` | that a why exists; the nearest flip | word — a flip is a sentence; chip is a pinned prefix of the verbatim line | none; wraps 2 lines at 390px (filed) |
| Strip SPY/QQQ | value · `±%` | the day move | colour on the delta (arithmetic fact) | none |
| Strip VIX / 10Y | value · `-5.9% WoW` / `+2bps 1D` · ▪ | the VOTE (a monthly-change band) — which the tile never showed; the sub is a different window | **▪ now wears the vote colour** (green/red/neutral) via the one voteStyle map; the sub keeps its delta colour (a fact, not a verdict) | **built** |
| Strip F&G | `45` · `Fear` · ▪ | sentiment zone | the WORD is CNN's own zone label and the only thing that makes 45 readable — keep; sub colour = vote (v3.73) and the ▪ now matches it | ▪ colour |
| Strip FED | `3.63% avg` · `FOMC 15d` | the next meeting | a date is a word — keep; `avg` is jargon explained only on hover (filed) | none |
| Strip CPI | `3.8%` · `Core 2.8%` · ▪ | trend direction | colour on the sub (vote); the second number is context | ▪ colour |
| Strip NFCI | `-0.57` · `0 = avg` · ▪ | tight/loose vs the mean | colour = vote; `0 = avg` is the RULER a z-score needs (v3.43 ruling) — keep | ▪ colour |
| Dock | `GATE EASY` · symbol chips · asOf line | the gate; the names | gate = word+colour (the product vocabulary); chips = the symbol IS the word (owner ruling v5.6.8) | none |
| Footer | 4 lines of attribution + links | version · not-advice | the two facts ride the closed row; everything else one tap deep | **built** |

Not changed on purpose: the F&G word, the NFCI ruler, the FOMC date, the HELPING word (see the
card row above — a shape that means "vote up" on a metric that went down needs its word).

### Outcomes — pass 2, v6.0.2 (built same session)

- Shipped: the footer under one closed `CollapsedGroup` (`.site-footer`, both modes; version +
  not-advice on the closed row); the strip's `▪` marker coloured by `bandOf → vote → voteStyle`
  with the vote word on both tooltips. `MacroStrip.jsx`, `dashboard.jsx`.
- Re-pinned WITH reasons: the A4 public footer pin (open the group first; the closed row must
  carry version + not-advice), and the v3.98.4 tooltip pin (the counting branch now names the
  vote — three distinct states still hold).
- Measured at 390×844 Simple, window closed: cards **337**, strip **602** — identical to pass 1.
- Gates: **2183 smoke · 309 render · 253 public-render · audit clean** (+5 smoke [76], +4 public).
