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
