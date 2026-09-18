# READ THE ROOM — the density audit (2026-09-18)

Owner, on four live screenshots (terminal ladder ×2, NEXT $ deck, public Degen Markets):

> please stop with text dense interface. Nobody wants that. Especially degen mode and terminal,
> can have the technical data and narrative without the ridiculous layers on layers of Text.
> Think of the user. Where do they even look and read? Dive into these user story principles and
> incorporate popups, dropdowns, swipes, menus, tabs, etc design first principles.

Everything below is **measured**, not read off the screenshots — probe built from the render
harness, Chromium, 390×844, synthetic fixture.

---

## 1. The user story, stated before any fix

A reader arriving at a ranked surface asks, in this order:

1. **Which name?** → symbol
2. **How much?** → the one number the list is sorted on
3. **Is it clean?** → a colour or a glyph, not a sentence
4. **Why / on what basis?** → *only if they doubt 1–3*

Question 4 is where every one of these surfaces puts its weight. The methodology is constant
across every row and every session — it is the least information-dense thing on the page and it
was rendered first, at full size, every time. **That is the inversion.**

The house cure already exists and is ruled: **v3.66 QUIET BOARD — free text is chip-length in
place, verbatim one tap deep; machine-known reds are never collapsed (v3.25).** These surfaces
were simply never swept.

---

## 2. Findings, ranked by measured cost

### F1 — the ladder modal leads with 248 words of methodology *(FIXED, v6.9.0)*

| | before | after |
|---|---|---|
| methodology above the first number | **248 words / 605px** | 0 (one tap deep) |
| modal doc height | 2,022px | **1,122px** (−45%) |
| visible words (3-row fixture) | 561 | **353** |

Three `.none` paragraphs at fs 11.5 — targets/`%`-basis, FRESH/NEEDS, ⇄ SERVER — plus the stamps
line. Folded into ONE `est-mini`; stamps and the amber score-index warning stay outside.

### F2 — every ladder row is 188px tall, and the cause is off-screen *(FIXED, v6.9.0)*

**The sharpest finding, and invisible from the screenshot alone.** All 13 cells of every row
report `h=188`. Thirteen columns in a 300px window sized BASIS/GATE/FRESH/NEEDS at 44–77px, so a
sentence wrapped to ~15 lines and set the row height; the twelve columns you can see are
`vertical-align:top`, so they painted ~150px of nothing.

- measured column widths: `# 18 · SYM 32 · TIER 39 · PRICE 55 · YE2026 51 · % 64 · YE2027 51 · % 77 · BASIS 44 · TT 50 · GATE 55 · FRESH 50 · NEEDS 45`
- **43 live rows × ~133px of dead space ≈ 6,400px of scroll spent on nothing.**
- Fix: a `min-width` floor on columns 9/11/12/13. **188 → 55px (−71%).** No markup, no text.

### F3 — the table is 631px in a 300px window with no affordance *(FIXED, v6.9.0)*

52% of the table was unreachable *and undiscoverable*. A phone-only hint now names the columns
off to the right. (Post-fix the table is 945px — wider, deliberately: the floors traded width,
which already scrolled, for height, which was dead.)

### F4 — the NEXT $ deck repeats boilerplate verbatim per row *(OPEN)*

Screenshot 3: two consecutive TODAY items each carry the identical two-line sub-text —
`asterisk, not a veto (owner ruling 2026-08-25) · denominator = account equity, options excluded
— a floor, not NAV (marks 3d old)`. That is a **rule**, not a fact about NBIS or JOBY. It belongs
stated once for the group, chip-length on the row (`⚠ 61pts over ref cap`), full text one tap deep.
`TRACKED BOOK` carries 6 lines of metadata under one number in the same block.

*Not fixed here: the probe's selector guesses for the TODAY items returned 0 nodes, so this needs
its own measurement pass before it gets a budget.*

### F5 — the public Degen Spotlight restates its own rows in prose *(OPEN)*

Screenshot 4, the clearest duplication on any surface:

```
REVENUE GROWTH   +454.0%
  quarter to 2026-06-30 vs a year earlier
OPERATING MARGIN -30.2% from -105.8% a year earlier
...
BUSINESS · Revenue grew 454.0% versus the same quarter a year earlier
           (quarter to 2026-06-30). Operating margin widened from -105.8% to -30.2%.
```

The BUSINESS sentence contains **no fact the two labelled rows above it do not already carry**.
STOCK and WATCH NEXT are the same shape. This is the v3.43 Yahoo-dupe test applied to prose: a
second rendering of the same facts is duplication, not depth.

---

## 3. The plan (ranked; one scope per pass, the house rhythm)

| # | Pass | Surface | Why this order |
|---|---|---|---|
| 1 | **ladder head + row height** ✅ v6.9.0 | terminal | biggest measured win; zero test coupling |
| 2 | **Spotlight prose de-dup** | public Degen | pure deletion of duplicated facts — cheapest remaining win, and it is the *public* half the owner named |
| 3 | **NEXT $ deck: rule-once, chip-per-row** | terminal | measure first; the boilerplate is a group rule, not a row fact |
| 4 | **ladder → row list at ≤700px** | terminal | the real end state: SYM + sort-key % primary, rest per-row disclosure. 12 render assertions read `.ld-main tbody tr` at 390 — a scoped re-pin, never a drive-by |
| 5 | **the 12 `PENDING` type-floor files** | public | Watchlist + Alerts is 34 of the last 54 sub-10px leaves |

### Design rules this plan commits to (so later passes do not re-litigate)

- **A row shows the decision; the basis is one tap deep.** Never both at full size.
- **A rule stated per row is a rule stated wrong.** Group boilerplate belongs on the group.
- **Prose may not restate a labelled row.** If the row carries the number, the sentence carries
  the *interpretation* or it does not ship.
- **`est-mini`, never `drawer`** — the phone harness counts open drawers.
- **v3.25 survives every fold:** reds, provenance and anything that gates action stay outside.
- **Every fold must survive print** where the surface has a PDF path (F1 created and closed
  exactly this regression).

---

## Outcomes — v6.9.0 (commit to follow)

**Shipped:** F1, F2, F3. `public/admin.html` only.

- `ladderHead`: 3 methodology paragraphs → one `est-mini`; summary carries the three
  wrong-without claims with the cadence read from `P_INPUT_CADENCE_D`; stamps outside.
- CSS: `min-width` floors on ladder columns 9/11/12/13; `.ld-scrollhint` phone-only.
- Print: hint hidden with the other controls; fold **forced open** so the PDF keeps
  *"% is not annualised"*.

**Measured (390×844):** prose above table 605px → 0 · rows 188 → 55px · modal doc 2,022 →
1,122px · modal words 561 → 353.

**Tests:** 2534 smoke (+9, section [89]) · 340 render (+5) · 376 public-render · audit clean.

**Corrections to this note's own working, recorded rather than edited away:**

1. **`display:block!important` did not reveal the folded prose in print.** Chromium hides closed
   `<details>` content via `content-visibility` on `::details-content`, not `display`. The rule
   looked sufficient and was inert; the print pin is the only reason it was caught.
2. **The first negative control was malformed.** A `perl` substitution for `` `</div></details>`+ ``
   matched a second site, corrupted the markup and cascaded 15 unrelated render reds. It "bit",
   but it proved less than it claimed. Re-run scoped to the `ladderHead` slice: 4 smoke + 1
   render red, zero collateral. *A control that corrupts is not a control* (v6.6.2).
3. **The probe's NEXT $ selectors (`.tdy-item`, `#todayCard li`) matched nothing** — I guessed
   class names instead of reading them. F4 therefore carries no measurement and is ranked on the
   screenshot alone, which is why it is pass 3 and not pass 2.

---

## Outcomes — v6.9.1 (Slice 2: F5, the public Degen Spotlight)

**Shipped:** F5. `src/sections/StockSpotlight.jsx` only — `functions/lib/spotlight.js` byte-unchanged.

- `AssessmentFacts` replaces `FullAssessment` on the FACE: renders only the next-report date
  (typed, from `nextEarnings` — never parsed out of `watchNext`) and the price-trend suppression
  notice. Renders nothing when neither applies.
- The full BUSINESS/STOCK/WATCH-NEXT prose moves into its own `CollapsedGroup`, BELOW the
  supporting analysis (a reading of the rows must sit below the rows), separate from
  `sources & calculations` (provenance ≠ interpretation).

**Measured (Degen, 390×844):** region 2,650 → 2,393px (−257) · words 700 → 581 (−17%) ·
three-question block on the face 330px / 139 words → 0. The ~73px difference between the prose
removed and the region saved is the two `NEXT REPORT` facts plus the new fold's toggle — stated
rather than rounded away.

**Tests:** 2534 smoke (1 re-pinned) · 340 render · 379 public-render (+3) · audit clean.

**Corrections, recorded rather than edited away:**

1. **My fold label defeated my own pin.** Labelling it *"business · stock · watch next"* put those
   literal eyebrows on the closed face, so the summary read as a fourth paragraph. The label
   changed; the pin did not.
2. **The de-dup pin then failed against correct code** — Chromium's `innerText` applies
   `text-transform`, so the row labels read back UPPERCASE. The v3.69 lesson, again.
3. **The first negative control silently did not run.** A `grep -c` returned 0, broke the `&&`
   chain, and the suites re-tested the previous build while printing green. Re-run properly it
   turns 1 smoke + 4 public red with zero collateral. *A control that never executed proves
   nothing* (v5.97.2).

### New finding, from the owner, mid-pass

> Even explore the numbers on simple mode is just ridiculously long. really consider the word
> budgets and making sure that no menu just unveiled and absolute novel.

**F6 — a fold is not a dumping ground.** Slice 2 was right to move prose off the face and wrong to
assume a fold has no budget. Progressive disclosure means *every layer* is budgeted, not just the
first. Simple's `explore the numbers` currently holds, per company: DATES & DATA NOTES, THE THREE
QUESTIONS (the full prose), SUPPORTING ANALYSIS (8 rows + CALCULATION INPUTS), and then Sources —
four panels × two companies behind one tap. **Ranked next (F6 becomes pass 2; the ladder row list
moves to pass 3).**

**Rule this adds to §3, and it is now executable, not prose:** *no disclosure may open onto more
than N words without a second level.* The budget is PINNED in the browser, the way the type floor
and the stance-strip height already are, so a fold that grows into a novel fails the build.

---

## Outcomes — v6.9.2 (Slice 3: F6, the fold budget)

**Measured every fold in Simple at 390×844 before touching anything** (click, wait, measure the
delta, close):

| fold | words unveiled | px added |
|---|---|---|
| Why this call | 146 | 410 |
| Learning moment | 69 | 283 |
| **Explore the numbers** | **785** | **2,233** |
| About this page | 70 | 106 |

**Shipped.** `Explore the numbers` level 1 = the two supporting-analysis panels (the numbers its
label promises). Level 2 = three NAMED folds: `dates & data notes`, `the three questions, in
full`, `sources & calculations`. Nothing deleted.

**Measured after: 785 → 294 words unveiled (−63%).**

**The durable half is the budget, not the restructure:** the public suite pins *no disclosure
unveils more than 320 words at its first level*, measured as the DELTA around the click and
reporting its own number. 785 words had accreted behind one tap without moving a single
assertion — the v3.54 defect class pointed at disclosure.

**Correction to my own probe, recorded:** the first fold-budget probe clicked and measured
synchronously and reported **0 words unveiled for every fold** — React had not re-rendered. A
probe that reports zero everywhere is a probe lying, not a page that is empty; re-run with real
awaits it produced the table above.

**Negative control:** flattening the three second-level folds back into level 1 turns the
named-second-tap pin and the budget pin red, with the budget **reporting exactly 785** — the
pre-fix number, which is what proves the pin measures the defect rather than a proxy.
*Honest limit: the control flattened the Simple fold and left one Degen label standing, so it was
partial; the 785 reading is the evidence it bit, not the label count.*

### §3 rule added, now executable

> **No disclosure may unveil more than ~320 words at its first level.** Past that it needs a
> second level whose entries are NAMED, so opening one is a choice rather than a scroll.

Pinned in the browser, like the type floor and the stance-strip height. Remaining surfaces to
sweep against it: the terminal's DESK drawer, the NEXT $ deck's TODAY block (F4), and Degen's own
`explore` equivalents.

---

## Outcomes — v6.9.3 (Slice 4: the ladder ROW LIST)

**The framing correction that made this cheap.** v6.9.0 fixed a row HEIGHT. The defect was a
SHAPE: at 390 the table is 945px in a 300px window, so a 55px row is a 55px row you have to swipe
twice to judge. A row height can never fix that.

**Shipped.** At ≤700px the same table DOM renders as one card per name. The only markup change is
a `data-l` attribute per cell, so cell order, cell count and cell text are identical — which is
why all twelve existing `.ld-main tbody tr` assertions (all at 1280) needed no change at all.

| | table @390 (v6.9.0) | row list @390 (v6.9.3) |
|---|---|---|
| horizontal scroll | 945px in a 300px window | **none — 300px, fits** |
| per row | 55px, ~half off-screen | **133px, complete** |
| top five | ~275px, swipe each to judge | ~665px, each complete |
| sort controls | header row | **sort strip** (5, 40px targets) |
| basis layer | off-screen right | off the card, one tap via SYM |

**Two defects in my own first cut, both caught by pre-existing pins:**

1. `.tblx{overflow-x:visible}` set globally — `.tblx` is SHARED, so it broke the deep-dive tab's
   wide tables at 390. The v3.35 overflow pin caught it. Scoped to `.ld-card` now.
2. Hiding `thead` outright took **all five sort controls off the phone** — the v3.81 defect in its
   worst form: not untappable, absent. The header is the sort strip now.

**The v6.9.0 swipe hint is DELETED** — the gesture it described no longer exists, so it was an
affordance for nothing at every width. Pinned absent (v3.73).

**Tests:** 2536 smoke (+2) · 343 render (+3) · 384 public-render · audit clean.
**Negative control:** removing the row-list media block turns exactly 2 smoke + 2 render red.

---

## Plan status after this session

| # | Pass | Status |
|---|---|---|
| 1 | ladder head + row height | ✅ v6.9.0 |
| 2 | Spotlight prose de-dup (public Degen) | ✅ v6.9.1 |
| 3 | fold budget (Simple explore) + the executable rule | ✅ v6.9.2 |
| 4 | ladder → row list at ≤700px | ✅ v6.9.3 |
| 5 | **NEXT $ deck: rule-once, chip-per-row (F4)** | OPEN — still unmeasured |
| 6 | **sweep every other fold against the 320-word budget** | OPEN — DESK drawer, Degen explore, TODAY |
| 7 | the 12 `PENDING` type-floor files | OPEN |

The 320-word budget currently guards ONE fold. Pass 6 is what turns it from a fix into a floor.
