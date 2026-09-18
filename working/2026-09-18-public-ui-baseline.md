# Public UI baseline — Simple + Degen: type, size, real estate, density, terminal vibe

Review only. No code changed. Measured on the built bundle at `6880707` (v6.7.3) in real
Chromium, served through the public suite's own stub (`FULL_LIVE` snapshot, the synthetic
spotlight fixture, a two-name picks stub), at 390×844 and 1280×900, on `/?view=public` for
both modes plus the operator route in Degen. Probe script and raw output are session
scratch; every number below is from `measure.json` or the screenshots.

**Honest limit:** Google Fonts are blocked at this environment's proxy, so IBM Plex Mono and
DM Sans fell back to system fonts. Computed `font-size`, layout budgets and element
positions are real; glyph shapes and exact wrap points are not. The public suite has the
same limit and its pinned budgets have held in CI, so the positions are trustworthy to a
few pixels.

## 1. What the page is, in one line each

- **Simple**: answer-first. Verdict word (28px) → one 16px sentence → three parameter
  cards → a closed "Why this call" fold → the 8-tile macro strip → Stock Spotlight →
  Learning moment / Explore folds → About. 200 visible words closed, 1,186px tall on a phone.
- **Degen**: operator console. Header + sticky section nav → moon-voice hero with the
  evidence sentence, clock caption, coverage dots and two 44px buttons → three chrome rows
  (reasoning fold, Signal Quality census, accountability links) → drivers fold → strip →
  Spotlight (full assessment + chart + lesson + analysis) → market detail fold → macro
  grid → headwinds → AI unit economics → data health → footer. 1,256 words closed,
  4,776px tall on a phone; 2,224 words / 8,751px with every fold open.

## 2. Measured baseline

| Metric (phone 390×844 unless noted) | Simple | Degen |
|---|---|---|
| Visible words, folds closed | 200 | 1,256 |
| Words under 11px | 125 (63%) | 1,061 (84%) |
| Words at 8px | 57 | 336 |
| Words at 9px | 56 | 500 |
| Words at ≥13px | 51 | 109 |
| Above-fold words | 153 (86 under 11px) | 220 (161 under 11px) |
| Header (+ nav) height | 63px | 118px + 53px nav = 171px |
| Verdict region | y=63, 119px tall | y=171, 217px tall |
| First market number (strip top) | y=420 (50% of fold) | y=563 (67% of fold) |
| Stock Spotlight height | 583px (49% of page) | 2,245px (47% of page) |
| Page height closed / all open | 1,186 / 3,723 | 4,776 / 8,751 |
| Interactive targets under 44px | 2 | 5 (6 on operator route) |
| Longest prose line, desktop | 68 chars | 178 chars |
| Horizontal overflow | none (390) | none (390) |

Desktop 1280: Simple fits entirely in one 900px screen (footer at y=754). Degen's fold
holds 511 words, 442 of them under 11px. Neither mode has a max-width container, so at
1280 every card and strip stretches edge to edge with 20px gutters.

## 3. Type

**The scale exists and is only half adopted.** `design-tokens.js` defines an 8-step scale
(9 / 10 / 11 / 13 / 16 / 22 / 28) and the v3.62 note says the lift was deliberately
"targeted, not a reflow". The count across `src/`:

- ~145 hardcoded `fontSize` literals of 8, 9, 10 or 11 (65× `9`, 57× `8`)
- ~40 token references (`T.fsXs … T.fsXxl`)

Where the tokens were applied (Simple hero, Simple cards, FactSheet, spotlight rows), the
type reads well. Where they were not (every eyebrow, SourceBox, footer line, strip label,
Degen hero captions, Signal Quality, headwinds, AI cards, data health), the page runs at
8 and 9px in both modes. The strip, Spotlight and footer are shared surfaces, so Simple
inherits Degen's 8px labels below its own well-sized hero: the Simple fold is 56% sub-11px
text despite the verdict lift.

**Two families, one job each, and that is right.** Mono for data, chrome and labels; sans
for sentences. The Syne display face is used for one word (the wordmark). One leak: the
recharts axis ticks in both charts carry no `fontFamily`, so the `-30% … 90%` labels render
in Times New Roman at 8px on every chart (visible in `foldRows` as the only serif node).

**Hierarchy inside a size.** The macro strip is 8px label / 13px value / 9px sub in both
modes. The 8px label is the smallest text on the page and is also the only thing that
says what the number is. In Degen the hero sentence is 11px mono at three wrapped lines
while the 22px verdict and a 44px COPY button sit around it; the eye reads the button
before the sentence.

**Line length.** Simple prose caps at 36em (68ch measured), inside the 45–75ch reading
range. Degen's Spotlight assessment paragraphs run 178ch on desktop, roughly 2.4× the
comfortable line; on a phone the same paragraphs are 10px sans.

## 4. Real estate

- **Simple spends its first screen correctly.** Verdict at 63px, cards at 182, the first
  market number at 420: the answer, the reasons and the evidence all land in one phone
  screen with the strip fully visible. This is the v5.9 / v6.5.4 budget and it holds.
- **Degen spends 67% of the first screen before a number.** Header wraps to two rows on a
  phone (wordmark + status, then LIVE / toggle / SHARE), the nav adds 53px, the hero is
  217px, then three single-purpose chrome rows (reasoning fold, Signal Quality, track
  record links) cost 100px before the drivers fold. The v3.93 pin (first data ≤700px)
  passes at 563px, but the ratio is the pre-v3.42-terminal shape: chrome first, tape second.
- **Stock Spotlight is the largest thing on both pages.** 583px in Simple (bigger than
  hero + cards + whys + strip combined at 468px) and 2,245px in Degen, where the two full
  assessments, the analysis panels and the calculation-input lists sit open by default. The
  page is titled "is it safe to be in the market?"; the widget answering "what about this
  one stock?" owns half the scroll in both modes.
- **Desktop is a phone layout stretched.** No max-width. Simple's three cards become
  400px-wide boxes holding four words each; the verdict sits at the far left with the copy
  icon floating mid-band; the strip's eight tiles occupy 45% of the row and the right half
  is empty. Degen at 1280 packs 511 words into the fold, most of them 8–9px, so the
  desktop is dense in text and sparse in structure at the same time.

## 5. Density and disclosure

- **Simple's disclosure model is coherent.** Four closed folds (Why this call · Learning
  moment · Explore the numbers · About), each a 2–4 word promise at 13px, and the whole
  page is 200 words closed. Opening everything triples the height and takes it to 1,386
  words, which is the correct place for that material.
- **Degen has no density floor.** The v3.66 rule ("chip-length in place, verbatim one tap
  deep") was applied to the terminal and to Simple; Degen's Spotlight, headwinds, AI cards
  and macro grid still render prose at full size by default. Closed, it carries 6× Simple's
  words; opened, 1.6× more.
- **Three renderings of one coverage fact survive in Degen's first screen**: the six dots
  + "6 of 6 signals counted" in the hero, "9 fresh (9 live · 0 cached) ○ 7 mock of 16
  tracked" in Signal Quality, and "6 of 6 signals counted" again on the drivers fold label.
  Each is documented as a different scope (voters vs tracked fields), and each is 8–11px.

## 6. Terminal vibe

What earns it: near-black surfaces, one amber brand accent, green/red only as verdicts,
mono numerals with uppercase letter-spaced eyebrows, the ▪ voter markers and provenance
dots, the 4×2 strip grid, and the moon-voice / GATE vocabulary. The Degen hero and strip
read as a console.

What dilutes it:

- **Eyebrows are 8px, which is below what a terminal actually uses.** Bloomberg and TT
  style labels are small but never below ~10–11px on a phone; 8px reads as fine print, not
  as chrome.
- **Prose paragraphs inside the console.** The Spotlight assessment and the headwinds
  register are sentence blocks in sans; a terminal shows those one tap deep or in a fixed
  column, not as body copy between tile rows.
- **The chart axes leak a serif font.**
- **Simple is a clean product page, not a terminal, and should not try to be one.** Its
  28px mono verdict is the one terminal signal it keeps and it is the right one.

## 7. Tap targets and a11y (measured)

- Simple phone: 22 controls, 2 under 44px (the skip link, and the Hold ⓘ button at 31px
  tall, which the 28px word carries).
- Degen phone: the two accountability links (TRACK RECORD → / WHY MACRODASH →) are 10px
  tall; the INSPECT CHART VALUES summary is 9px tall; the AI nav link is 36px wide.
- Contrast is measured in smoke (muted 4.79:1). At 8px that ratio is still hard to read
  on a phone; WCAG size guidance is a separate axis the tokens do not yet pin.

## 8. First-principles read

1. **One question per screen.** Simple answers it. Degen answers it, then asks four more
   (spotlight, AI economics, headwinds, data health) at equal weight.
2. **Size encodes importance.** True at the hero in both modes; false everywhere below the
   strip, where the label (8px) is smaller than the provenance chip beside it (9px).
3. **Progressive disclosure should hold at every altitude.** Simple: yes. Degen: only for
   the reasoning, drivers, market detail and sources folds; the Spotlight and curated
   sections are open by default.
4. **The width should be used or bounded.** Neither mode does either at 1280.
5. **Shared components inherit the weakest mode's type.** Strip, Spotlight, footer and
   SourceBox carry Degen's 8px into Simple.

## 9. Ranked findings (baseline, not a plan)

1. Type scale adoption stopped at the hero: ~145 sub-12px literals vs ~40 token uses;
   both modes are majority sub-11px text.
2. Stock Spotlight owns ~half the scroll in both modes and is open-by-default in Degen.
3. Degen's phone first screen is 67% chrome before the first number (header wrap + nav +
   217px hero + three chrome rows).
4. No max-width container; desktop is a stretched phone.
5. Chart axis ticks render in Times New Roman (missing `fontFamily` on recharts `tick`).
6. Five sub-44px targets in Degen on a phone, two of them 10px-tall links.

## Outcomes

Review pass first (commit `45f8c91`, nothing shipped). Then, same day, the owner brought PR #49
(`docs/plans/public-terminal-skin.md`) and asked for **Slice 1 only: tokens + header**. Shipped
as **v6.8.0** on this branch; the CLAUDE.md entry carries the full record.

**What Slice 1 changed, against the numbers above (same probe, same fixture, 390×844):**

| Metric | Baseline | After Slice 1 |
|---|---|---|
| Header height, Simple / Degen | 63 / 118 | **59 / 59** |
| Degen verdict top | 171 | **104** |
| Degen first market number | 563 | **510** |
| Simple cards top / strip top | 182 / 420 | 178 / 418 |
| Words under 11px, Simple | 125 of 200 | 115 of 200 |
| Words under 11px, Degen | 1,061 of 1,256 | 881 of 1,257 |
| Font families on the public page | 3 | 1 |

**Corrections to the survey, recorded rather than edited away:**
- §3 called the recharts serif leak "one leak" to fix; it was NOT touched in Slice 1 (the
  plan's "nothing else"). It stands as a Slice 2 item.
- §9 finding 1 ("type scale adoption stopped at the hero") is only half addressed: the
  token FLOOR moved (fs-xs 10 · fs-s 11 · fs-m 12.5 · fs-l 14), the ~145 literals did not.
  The Degen sub-11px share fell from 84% to 70% on token consumers alone.
- The plan's "nav as a single 36px strip" was implemented as ~45px: the 44px thumb-target
  rule (v3.62) is a repo invariant and beats a number in a plan; the strip lost its own
  padding, which is the part that mattered.
- The header "one row" needed a phone-width detail the plan did not anticipate: on the
  OPERATOR route TERMINAL + toggle + MORE overflowed 375/390 by ~44px, so the two words
  collapse to their glyphs (⌁ · ⋯) inside 44px targets at ≤480px.

- The plan's "same header height ±8px" holds on the PUBLIC route in both modes (59/59). On
  the OPERATOR route a FIRED/BLIND badge is allowed to wrap the header to a second row rather
  than truncate the wordmark to "Ma…" at 375px; the public contract is untouched.

Gates at ship: 2519 smoke · 335 render · 367 public-render · audit:prod clean.
The probe remains a scratch script; the acceptance items it measured are now pinned in
`test/public-render.mjs` (Slice 1 section), so the header heights cannot drift back.

### Slice 2 item 1 — the macro strip lift (v6.8.1, same day)

Owner: "build the macro strip lift". One file (`src/sections/MacroStrip.jsx`): label 8 → `fs-s`
11, value 13 → `fs-l` 14, sub-line and ▪ marker 9/8 → `fs-xs` 10, the per-tile ⓘ deleted (the
tile is the button since v6.3; the sr-only promise stays). Grid and 44px rule untouched.

| Metric (390×844, same probe) | After Slice 1 | After the strip lift |
|---|---|---|
| Strip region height, both modes | 111 | **122** (+11) |
| Spotlight top, Simple / Degen | 529 / 621 | 540 / 632 |
| Cards top / first strip number (the v6.3 pin) | — / — | 218 / 466 (budgets 420 / 660) |
| Words under 11px, Simple | 115 of 200 | **99 of 192** |
| Words under 11px, Degen | 881 of 1,257 | **865 of 1,249** |
| Smallest visible leaf in the strip | 8px | **10px** |

**Corrections, recorded:** §3's "8px label / 13px value / 9px sub" is closed for the strip only;
the same 8/9px literals still stand in SourceBox, eyebrows, footer, Spotlight and the Degen hero
captions (Slice 2's remaining items). The word totals fell by exactly eight in both modes — the
eight ⓘ glyphs the census had been counting as words, which slightly overstated the baseline's
sub-11px share on every surface that wore one.

Gates at ship: 2520 smoke · 335 render · 368 public-render · audit:prod clean.

### Slice 2 item 2 — the Simple cards adopt the strip anatomy (v6.8.2, same day)

Owner: "Simple cards should adopt it." `src/sections/SimpleCards.jsx` only: eyebrow mono fs-s
(was sans-alias fs-m), vote word mono fs-xs in tone colour (was fs-m), glyph fs-l and the 3px
rule unchanged, the 9px ⓘ deleted, the 8/9px footer and empty-state lines to fs-xs. The value
keeps fs-body 16 (the cards outrank the strip; size encodes importance).

| Metric (390×844) | After strip lift | After cards |
|---|---|---|
| Cards region height | 177 | 177 |
| Strip top / spotlight top | 418 / 540 | 418 / 540 |
| Words under 11px, Simple | 99 of 192 | 99 of 189 |
| Smallest visible leaf in the cards region | 9px (the ⓘ) | 10px |
| Desktop cards region | 78 | 73 |

**Correction:** §3 said the Simple cards were already "where the tokens were applied". They
were, at the value; the label and the HELPING word were sans-alias fs-m and the ⓘ was a 9px
literal, so the file still carried three non-strip sizes. Closed now; the first screen of Simple
(hero, cards, strip) carries no literal under 10px. Spotlight and the folds still do.

Gates at ship: 2521 smoke · 335 render · 369 public-render · audit:prod clean.

### Slice 2 item 3 — the Spotlight takes the Simple card's chrome (v6.8.3, same day)

Owner: "the Spotlight chrome pass, same method, one commit." Plan line 83 scopes it to chrome:
same panel as a Simple card, face unchanged, the paragraph wall stays inside its existing fold,
no rounded consumer-card look. `src/sections/StockSpotlight.jsx` only — no model, calculation,
fold membership or mode split moved.

- One `PANEL` (radius 5 · 8px/10px) replaces the radius-6 / 10px-12px container at all five
  sites; the retired literals are pinned absent.
- The 3px left rule is **derived**: it is that company's own chart-line stroke, so the rule is
  the legend. The chart frame belongs to both companies and therefore wears no rule.
- Row label → mono fs-s tracked (was fs-xs); identity → mono (name fs-l 700, ticker fs-s amber).
  Prose (blurb, assessment, lesson, long "Unavailable —" reason) keeps the sans alias on purpose.
- Eleven 8px literals gone, **including the recharts axis ticks and the zero-line label** — the
  scale the two lines are read against. Zero numeric `fontSize` left in the file.
- The ⓘ is **kept**, reversing nothing: on the strip tile and the Simple card the whole element
  was the trigger, so the glyph was a second affordance; here only the label is the trigger, so
  it is the first one. Pinned against both files that must not carry one.

| Metric (390×844) | After cards (v6.8.2) | After Spotlight (v6.8.3) |
|---|---|---|
| Spotlight top / height, Simple | 540 / 626 | 540 / **626** |
| Spotlight height, Degen | 2,560 | 2,650 (+90) |
| Spotlight height, Simple @1280 | 436 | 436 |
| Words under 11px, Simple | 99 of 189 | **78 of 189** |
| Simple 8px bucket | 36 words | **0** |
| Degen 8px bucket | 315 words | 236 words |
| Smallest visible leaf in the region, Simple | 8px | **10px** |
| Cards / strip budget print | 218 / 466 | 218 / 466 |

The Simple region cost **nothing**: the padding the panel gives back paid for the type floor
exactly. Degen pays 90px, which is the honest price of the same lift over ~170 leaves.

**Not claimed, pinned instead:** two sub-10px leaves survive in the Degen region and both are the
shared `CollapsedGroup` toggle — a primitive every fold uses, so lifting it is its own pass; the
browser pin asserts every remaining one is that toggle, so a new 8px literal inside the Spotlight
fails there. The recharts tick `fontFamily` leak is untouched: the ticks render mono by
inheritance, not declaration, and the site comment says so.

**Left open, deliberately:** whether Degen's Spotlight should be closed by default. 2,650px open,
directly under the strip, is a real cost — but it is a disclosure ruling, not chrome, and the
question was asked and not answered.

Gates at ship: 2523 smoke · 335 render · 372 public-render · audit:prod clean.
