# 2026-08-31 — v5.97.4: the two open minors, and the three-surface button audit

Owner directive, verbatim: *"Fix those two open minors updates and commit to name. Also,
don't fix, but check and audit every button in both simple power and terminal to make sure
they are high leverage."* Two halves: the FIX half shipped as v5.97.4; the AUDIT half is
findings-only by instruction — nothing below the "Button audit" line was changed.

## Half 1 — the two minors, closed (v5.97.4)

### A. `#legacyCompact` excised — the v5.97.3 dead code, pulled

v5.97.3 named it rather than removing it; this removes it. `<div id="legacyCompact" hidden>`
(holding `#stanceStrip`, `#calBlock`, `#refreshRanksLegacy`) plus `renderStance()` and
`renderCalBlock()` are GONE — permanently invisible markup that ran on every render, whose
dormancy already bit once (the REFRESH-label bug came from its dormant second caller).
Verified before cutting: every fact those surfaces carried has a LIVE home —

- stance verdict → the glance GATE tile (`renderGlance`); full prose → `renderToday()`'s
  DESK stance box (the v3.66 split, untouched)
- the v3.25 red badges → `#trimChip` / `#flagsChip` header buttons (counts visible closed)
- the compact calendar → the DESK `#dCal` drawer (same `binaryEvents()` computation)
- refresh + quote stamp → `#refreshRanks` / `#quoteChip` in the same header row

`stance()` keeps its five live consumers untouched. `macroGate()` lost its only renderer and
stays as the smoke-pinned server-mirror contract — see finding T1 below.

**Test surgery, not deletion**: every pin that measured the dead surfaces was RE-POINTED to
its successor with the reversal documented (smoke: excision + successor + chip-aggregation
pins; render: calendar → `#dCal`/`#binaryCal`, circuit fail-closed + GATE branches →
`#gateTile`, capex ⚡ → the FLAGS aggregation, slice5 asymmetry RETIRED with its subject,
dormant-refresh half → a DOM-absence pin). Negative control: restoring a fragment of the
dead markup turns exactly the two excision pins red.

**Found by the re-pinned daily-contract fixture, and it is finding T1 live**: the old
`GATE: SEND IT` strip pin passed under measured-HEADWIND because `macroGate()` ignores the
HEADWIND caution — the GATE tile (which speaks `stance()`) reads HODL on the same fixture.
The test now clears the measured verdict too; the divergence is filed below, not fixed.

### B. `ndxSpxRs` plausibility band + the INSUFFICIENT-floor ruling

- **`ndxSpxRs: [-25, 25]`** in `BANDS` — the v5.10.0 found-not-fixed item ("the 1-day
  `ndxSpxRs` has never had a plausibility band"), closed. Rejects a decimal shift or a
  mispaired pct; passes a crash-day divergence. Pinned; negative control (removing the band)
  turns exactly its pin red.
- **The `available < 3` floor is RULED an absolute, not re-derived** as the check count
  grows (3-of-6 → 3-of-7). It encodes "one or two readings never publish a direction" — an
  absolute-observations claim, unlike the confidence FRACTIONS (which are derived from
  `checks.length`, the v5.97.0 count-trap closure). The stated consequence is now EXECUTED
  in smoke: at exactly 3 available the direction publishes, but `current` cannot reach
  `checks.length - 2`, so the evidence axis reads LOW · HOLD · DATA DEGRADED — the thin
  floor can never gate an order alone. Negative control (floor to 4) turns the new pin red.

### Outcomes

- Gates at the v5.97.4 head: **2149 smoke · 307 render · 229 public-render**, `audit:prod`
  clean, real Chromium. Render 310 → 307 is net retirements-with-successors, each documented
  at the pin.
- Three negative controls run, each turning exactly its own pins (2 / 1 / 1+1-sibling).
- Corrections to the plan as surveyed: (1) the 2-available withhold was ALREADY pinned
  (smoke line ~797), so only the 3-available side needed a pin; (2) two admin tombstone
  comments containing a literal `working/` path tripped the notes-never-a-product-surface
  pin — reworded, the pin was right; (3) the daily-contract render fixture needed its
  MEASURED verdict cleared, which is how finding T1 got its live proof.

---

## Half 2 — the button audit (CHECK ONLY — nothing here was changed)

Method: a Chromium probe against the real built bundle (stubbed APIs, live-dated fixture)
enumerating every `<button>`, `[onclick]`, `[role=button]`, link and `details>summary` on
Simple (390px), Power (390/1200px) and the Terminal (390/1200px), with visibility, geometry
and accessible names; cross-checked against source. **Zero page errors on all five runs.**
Counts: Simple 19 controls (19 visible) · Power 54 (47) · Terminal 59 (32; the rest live
inside closed disclosures, correctly).

### TERMINAL

**T1 — HEADLINE: the glance GATE tile is a SECOND derivation of the locked product
vocabulary.** `renderGlance` derives its word from `stance().k`
(`go→SEND IT · caution→HODL · else TOUCH GRASS`) while `macroGate()` — the v5.6.0
smoke-pinned mirror of the server ladder, and the locked v5.6.3 mapping
(SEND IT = FULL · HODL = RESTRICTED · TOUCH GRASS = HOLD/unreadable) — is rendered NOWHERE
since the excision. Proven divergence (live, in the render fixture): measured HEADWIND +
FULL actionability + clean flip → ladder says SEND IT, tile says HODL. The divergence is
one-way (the alias can only be MORE cautious — `k==="go"` implies the ladder is clean), so
it is safe-direction, but the tile's HODL does not mean RESTRICTED, which is exactly the
word-carrying-two-verdicts defect the `GATE:` scoping rule exists to prevent. **Owner
call**: either point the tile at `macroGate()` (one derivation, the locked mapping) or
ratify the stance-alias as the tile's meaning and rename its key.

**T2 — DESK ranking rows are span-onclick, keyboard-unreachable.** `renderUpsideRank`'s
rows are `span.pick onclick="openCard(...)"` (admin ~4060), and four more span-onclick
`openCard` sites survive in DESK strips (trim-blocker legs ~1356, unmodelled names ~1388,
cluster members ~1441, decisions "open" ~1892). The v3.42 slice-2/3 conversion ("span-onclick
pseudo-links became linklike buttons") reached the driver rows, glance rows and chips — not
these. A row a keyboard cannot reach is the same class of defect, one altitude down.

**T3 — the hzDeckChip quick-switch is a ~10px tap target at 390px.** The inline
`auto`/`nearest` buttons (v3.72 — added precisely so clearing a stale pin is ONE tap) are
`button.linklike` with no thumb-target rule: measured 27×10 / 48×10 at phone width. The full
`.hzb` picker got 40px targets at ≤480px in v3.81 because "the defect was reachability, not
visibility" — the sibling control v3.72 added for the same reason never got the same rule.

**T4 — high leverage confirmed** (no action): ⟳ REFRESH now has exactly one caller and its
own label; `TRIM · ?` is the honest unknown-positions state; the disabled STAMP tile
instructs ("select a ranked name") instead of dead-clicking; `#dCal`'s dead-click guard only
wires `switchTab` when a tab exists; empty-state drawer summaries state their kind; ← MACRO
is permanent (one door, both directions); the OPS disclosure hides no red facts.

### POWER

**P1 — the Macro Alerts section is 20 of 47 visible buttons (43%) managing state that
evaporates.** Ten ON/OFF toggles + ten ✕ deletes, all 44×44 with proper per-alert aria
labels (checked), delete with an undo toast (good pattern) — but `alerts` is
`useState(DEFAULT_ALERTS)`: every toggle and delete resets on reload. Nearly half the
surface's buttons operate non-persisted state, which caps their leverage at one session.
Either persist (localStorage, the md:view/md:exp precedent) or demote the manage controls
behind an edit affordance; as-is they are the lowest-leverage button concentration on any
surface.

**P2 — two adjacent ⎘ copy buttons** (`⎘ DAILY CALL` vs `⎘ COPY LIVE READ`) share a glyph;
both are labeled and do different jobs (frozen 10am call vs live read), so this is a note,
not a defect.

**P3 — high leverage confirmed**: every CollapsedGroup toggle carries its count and kind
("+16 PER-SOURCE DETAIL", "◫ ILLUSTRATIVE" on curated groups); the section nav duplicates
only for the ≤320px hamburger (hidden set, by design); ⌁ TERMINAL is first-class and
publicView-gated.

### SIMPLE

**S1 — high leverage throughout, and that is the finding.** 19 controls, each earning its
place on the newcomer surface: mode toggle, SHARE, the verdict-as-explainer button, three
factor cards opening fact sheets, the whys expander with its count, dock chips with real
aria ("Open AAA in Ticker Terminal"), skip-nav. No dead, duplicated or mislabeled control
found.

**S2 — minor targets**: the icon-only ⎘ copy is 27px wide (44 tall — half a thumb target;
aria + title present, the v5.9.0 icon-only call); the footer links (History · Difference ·
JSON · TRACK RECORD → · WHY MACRODASH →) render at 9–10px height. Low-frequency controls,
noted for completeness.

### Ranking, if the owner takes any of these

T1 (vocabulary integrity on the one word everybody sees) > P1 (43% of Power's buttons,
one-session state) > T2 (keyboard reachability at the DESK altitude) > T3 (one tap target)
> S2/P2 (notes).
