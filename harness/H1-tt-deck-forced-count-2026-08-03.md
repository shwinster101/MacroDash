# H1 — PLAN · FEAT-TT-DECK forced-trim count + real negative controls

> **DATED PASS ARTIFACT — 2026-08-03. NOT current state.** This records one H1 planning pass
> as it stood on that date. `CLAUDE.md` is canonical for what the thing is; `HARNESS.md` is
> canonical for how a change gets made. Where this file and either of those disagree, **they
> win** — this one is a snapshot and is not maintained. Measurements below are stamped at the
> time of the pass, deliberately, rather than restated as standing facts (the same cure
> `HANDOFF.md` and `AGENTS.md` already carry).

| | |
|---|---|
| **Phase** | H1 — PLAN |
| **Model** | Claude Opus 5 (the documented alternate; H1's primary is GPT-5.6 Sol) |
| **Harness** | `HARNESS.md` §P, from `b4c730c` (branch `claude/harness-model-assignment-d6xhlb`, PR #10 — not yet merged to `main`) |
| **Under review** | `970d8fd` — `feat(tt): add mobile decision deck and share rankings` |
| **Upstream phase** | H5 audit (fresh session) — negative controls completed, findings carried in below |
| **Status** | **Approved.** One decision left open, §5. |

**Rotation note (§0 Rule 3).** H2 built `970d8fd`, H5 audited it, and this plan is by the same
model family. Rotation here is **session isolation only** — this session began with no memory
of the build. Stated, not assumed away. Rule 1 without this note is documentation, not a
control.

**TICKET.** Keep `NEXT $ IN` as the stable phone default; derive a red forced-trim count from
the existing `sellRank().forced` result and render it on the `FUND / TRIM` tab without changing
cap math, ranking order, selection, or auto-opening behavior. Replace the direct-call swipe
assertion with an actual scroll-synchronization assertion, and behaviorally prove exactly five
discretionary funding rows remain outside the tail expander.

**Scope.** `public/admin.html`, `test/render.mjs`, `test/smoke.mjs`.

---

## Owner calls carried into this plan

Recorded verbatim, because the plan's assertions exist to pin them:

1. **A red count on the tab — do NOT auto-open `FUND / TRIM`.**
   - Default: `NEXT $ IN`
   - Forced state: `FUND / TRIM · 1 FORCED`
   - Loading: `FUND / TRIM · …`
   - Loaded with zero forced trims: plain `FUND / TRIM`
2. The duplicated `700px` cleanup is **deferred** unless H1 proves it necessary for this ticket.
   *(It does not — see §3.)*

## H5 findings this plan consumes

The H5 auditor ran the negative controls the ticket was missing:

- **Removed swipe synchronization** — the existing `swipe` assertion stayed green; a real-scroll
  control failed. **Confirmed vacuous.**
- **Broke panel height** — the viewport-height assertion failed. **Confirmed effective.**
- **Changed five visible rows to six** — the browser assertion stayed green, the smoke guard
  failed. **Browser assertion vacuous**; the layered smoke coverage caught the literal change.

---

## 1. DEFECT CLASS

**Primarily (d) — a claim made on absent evidence**, with the test half being H0 class
**C (vacuous assert)**.

The precise framing: **the deck introduced a v3.25 violation.** Before `970d8fd`, `#buyBlock`
and `#sellBlock` were both vertically present on the phone, so a `⛔ TRIM` row — *a rule already
broken* — was always reachable by scrolling. The deck turned the second answer into a **hidden
panel** (`inert`, off-screen), and the standing repo rule is that *a collapse is only honest if
every RED fact stays visible while closed.* An unadorned `FUND / TRIM` tab on the default view
now silently asserts "nothing here needs you," which the board never checked from that surface.
This ticket restores the red fact to the closed state — the same fix as the DESK drawer's stance
badges, applied to the deck.

Not (c): `CAP_PCT` is not being copied. Not (e): no new capability — the count already exists
inside `sellRank()`; it was simply never rendered where the collapse hid it.

---

## 2. BLAST RADIUS

**Files:** `public/admin.html`, `test/render.mjs`, `test/smoke.mjs` — exactly the ticket's scope.
No `src/`, no `functions/`, no `/readout.json`.

### Rendered surfaces that read `sellRank()` or the forced set

| Surface | Reads | Changes? |
|---|---|---|
| `#sellBlock` FUNDING PRIORITY rows (`renderSellBlock`, :3841) | `sellRank()` in full | **No** — row markup, ordering and copy untouched |
| `#decisionFundTab` label (:454) | *new* — the forced count | **Yes**, the whole ticket |
| `#stanceStrip` `⚠ N over cap` badge (`renderStance`, :4016) | `capChecks()` — **a different function** | **No** — but see the divergence below |
| TODAY card stops (`stance()`, :1432) | `capChecks()` | No |
| `renderFunding()` / DESK funding strip | `BOARD.funding` | No |
| `buildRankingsMd()` `### Forced` section (:4642) | `sellRank()` | No |
| `renderUpsideRank` / `AGREE_PICK` cap veto (:3484) | `rankWeight()` | No |
| Desktop ≥700px | tabs are `display:none`; both blocks stack | Count renders but is not shown — correct, the rows themselves are visible there |

**Call sites that must keep the label in sync:** `render()` :1713 and `setHorizon()` :2985 are
the only two callers of `renderSellBlock()`; `refreshRanks()` reaches it through `render()`.

### ⚠ The finding that matters most in this section

**`sellRank().forced.length` and the stance strip's `⚠ N over cap` are different numbers on the
same screen, and they can legitimately disagree.** Four divergences, all real:

1. **`capChecks()` uses `pct > CAP_PCT` (strict); `sellRank()` uses `w >= CAP_PCT` (inclusive).**
   A position at exactly 18.0% is **FORCED but not a breach**.
2. **`capChecks()` counts clusters** (`kind:"cluster"`); `sellRank().forced` is single names only.
3. **`capChecks()` requires a broker `pct`**; `sellRank()` falls back to the tracked-book floor
   `mv/tot`. A name with no synced `pct` but a large tracked share is forced and invisible to the
   badge.
4. **`sellRank()` returns `null` when `bookRollup().mv <= 0`** — so the count can be *unknown*
   while `capChecks()` still reports breaches.

Not proposing to merge them: they answer different questions (portfolio cap policy vs. this
panel's trim queue), and collapsing them would delete information — the married-never-merged
rule. But H2 must (a) not present the tab count as the cap-breach count, and (b) leave a source
comment naming the four divergences, or the next reader will "fix" one into the other. The word
**FORCED** already differs from **over cap**, which is why the owner's copy is safe as specified.

---

## 3. DUPLICATION CHECK

**No new number, band, rate or string.** Greps run:

```
grep -n "700px\|max-width: *700" public/admin.html
  → 172, 231, 308(comment), 311 (CSS) · 3813 (JS matchMedia)   [5 homes, pre-existing]
grep -n "CAP_PCT" public/admin.html
  → 1273 (const) + 17 reads, all routed through the one constant
grep -n "capChecks()\|sellRank()" public/admin.html
  → capChecks: 1420, 4008, +2 · sellRank: 3843 (renderSellBlock), 4640 (export)
grep -n "FUNDING_VISIBLE" public/admin.html
  → 3900 (const), 3901, 3902, 3903, 3905   [one home, correctly reused]
```

Three consequences:

- **The count must come from the `s` that `renderSellBlock` already computes** — not a second
  `sellRank()` call. `sellRank()` runs `ptModelRows()`, `optSleeve()` and `runState()` per book
  entry; calling it twice per render is both a §P.4 violation and real work. The repo's own
  precedent is `UPSIDE_ROWS` (:3371) — one computation stashed at module level, read by the
  compact surface.
- **`FUNDING_VISIBLE=5` already has exactly one home.** The new render-suite assertion must read
  the rendered DOM, never restate `5` as a second literal that could drift.
- **The deferred `700px` duplication is confirmed deferrable.** The label is
  viewport-independent — CSS already hides `.decision-tabs` above 700px, so the renderer needs no
  `matchMedia` read. **This ticket adds no sixth home, and §7 adds a guard (S5) that pins that.**
  The deferral holds; H1 did not prove it necessary.

---

## 4. INVARIANT IMPACT

| Invariant | Touched | What keeps it true |
|---|---|---|
| **§P.2** no false clear | **Yes, centrally** | A plain `FUND / TRIM` must mean *checked, zero forced* — never *did not look*. Requires the fourth state in §5. |
| **§P.3** fail closed | **Yes** | Unmeasured and loading each get their own rendered state; neither may fall through to the plain (clear-reading) label. |
| **§P.4** one computation | **Yes** | Single `sellRank()` pass in `renderSellBlock`, stashed; the renderer performs no `CAP_PCT` comparison of its own. Guarded by S2. |
| **§P.5** attribution | Minor | Smoke `[42]`'s `>FUND / TRIM</button>` pin describes markup this change replaces — it must move in the same commit, not be left describing the old shape. |
| **§P.8** order-gating frozen | **No** | `CAP_PCT`, `sellRank`'s partitioning, `pickRow`, `ptModelRows`, `AGREE_PICK` and `/readout.json` are all untouched. This ticket renders an existing number and changes nothing that gates an order. |
| **§P.9** say what you didn't do | Yes | The `700px` deferral and the four `capChecks` divergences are stated, not silently absorbed. |
| **v3.25** red survives a collapse | **Yes — this is the point** | The forced count is the red fact surviving the deck's hidden panel. |

---

## 5. THE ABSTENTION

`renderSellBlock` owns the one `sellRank()` pass and writes a module-level count; the tab
renderer reads it. Stale-value discipline follows the `AGREE_PICK=null` precedent at :3292 —
**reset before compute, so an early return can never leave yesterday's count on the tab.**

| Input state | `sellRank()` | Rendered label | Rationale |
|---|---|---|---|
| `POS_PENDING` (positions in flight) | `null` (tot=0) | `FUND / TRIM · …` | Owner call. "Not loaded" ≠ "nothing there" (the v3.42 slice-2 skeleton rule). |
| Loaded, `forced.length > 0` | rows | `FUND / TRIM · N FORCED`, count in `var(--red)` | Owner call. |
| Loaded, `forced.length === 0` | rows | `FUND / TRIM` (plain) | Owner call — an honest checked-clear. |
| **Loaded, no measured positions** (`tot <= 0` → `sellRank()` null) | `null` | **see below** | Not covered by the owner's three states. |
| `#sellBlock` / tab element absent | n/a | count reset to `null`, renderer no-ops | Never a stale number. |
| Non-finite | n/a | n/a | `forced.length` is an integer ≥ 0 by construction. |

### The open case

When the broker sync has landed nothing (`bookRollup().mv <= 0`), `sellRank()` returns `null` and
the board *cannot see* whether anything is over cap — yet `capChecks()` can still be reporting
`⚠ 2 over cap` in the stance strip one row above, because it needs only `pct`. Falling through to
the plain label in that state renders **a clear the board never checked**, which is precisely
§P.2/§P.3 and has direct precedent against it (`evalAlert`'s BLIND vs CLEAR,
`macro_flip.evaluable`, `pos` "unmeasured is not zero").

**Recommendation: a fourth state, `FUND / TRIM · ?` in amber**, meaning *not measured*.
Chip-length, distinct from `…` (loading) and from plain (checked-clear), one branch.

**Mitigation if three states are preferred:** `renderSellBlock` hides the panel entirely in this
case, so the tab points at a blank panel — a weak tell, one tap away, that does not survive the
collapse.

> **DECISION STATUS: OPEN.** The plan was approved without this being called either way. H2
> proceeds under the plan's recommendation (**the fourth state**) unless the maintainer says
> otherwise before it renders. Recorded here rather than resolved silently, because it changes
> what a person reads on the default view.

**Not changing:** the tab does not get `aria-live`. Its accessible name updates naturally from
its text content, and the v3.59 B4 lesson was to *narrow* live regions, not add them — a tab
relabeling on data arrival is not announcement-worthy.

---

## 6. BAND PROVENANCE

**Not applicable — this ticket adds no threshold.** `CAP_PCT = 18` is unchanged, keeps its single
home at :1273, and the count is a cardinality of an already-computed set, not a new boundary.
`FUNDING_VISIBLE = 5` is pre-existing and unmoved. No asserted band, therefore no
order-gating-surface concern.

---

## 7. TEST PLAN — as claims

Format: *if `<source change>`, then `<assertion>` fails.* H3 owns the final wording and must run
every negative control for real.

### The two vacuity repairs (the ticket's stated purpose)

Both H5 findings were confirmed independently during this pass, and **the second is worse than
reported**:

> **`ok("...the visible funding queue is capped while lower-priority rows are counted",
> fundRows <= 6 && details.est-mini count >= 1)` is vacuous in *both* of its conjuncts.**
> Traced against the fixture: `POSITIONS` has 5 entries; AAA (21.4%) → `forced`, CCC and FFF have
> no `deepDive` → `unmod`, leaving **`disc.length === 2`** (BBB on return basis, EEE on dollars).
> So `s.disc.length > 5` is **never true** and the funding tail expander **never renders in this
> fixture at all**. `fundRows` is 1 forced + 2 disc = 3, which satisfies `<= 6` at any
> `FUNDING_VISIBLE`. And the surviving `details.est-mini` the assertion finds is the
> **unconditional "how this list is ranked" methodology expander** (:3922) — a different element
> entirely. The assertion has never once observed the thing it names.

| # | Claim | Named failing edit |
|---|---|---|
| **R1** | Setting `deck.scrollLeft = deck.clientWidth` (a real scroll, not a call) flips `#decisionFundTab[aria-selected]` to `true` and makes `#decisionBuy` `inert`. | Delete `onscroll="syncDecisionDeck()"` from `#decisionDeck` (:459) → red. *(H5 already demonstrated this direction.)* **Replaces** the `page.evaluate(() => decisionGo(1))` assertion. |
| **R2** | A real `.click()` on `#decisionFundTab` selects it and advances `deck.scrollLeft`. | Remove `onclick="decisionGo(1)"` (:456) → red. **New** — R1 must not silently drop coverage of the button path, which the design calls the durable control. |
| **R3** | With ≥6 discretionary rows present, `#sellBlock` has **exactly 5** direct-child `.fdr-row`s that are not forced rows, and the remainder sit inside the tail `<details>`. | `FUNDING_VISIBLE=5` → `6` → red. |
| **R4** | On the standing fixture (AAA at 21.4%), `#decisionFundTab` text matches `FUND / TRIM · 1 FORCED` and the count carries `var(--red)`. | Remove the count from the label template → red. |
| **R5** | With every position under cap, the label is exactly `FUND / TRIM` — no suffix. | Render the count unconditionally → red. |
| **R6** | With `POS_PENDING = true`, the label is `FUND / TRIM · …`. | Delete the pending branch → red (falls through to plain/unmeasured). |
| **R7** | **In the forced state, `#decisionBuyTab` is still `aria-selected="true"` and `#decisionFund` is still `inert`.** | Add `if(SELL_FORCED_N) decisionGo(1)` → red. *This is the assertion that pins the "do not auto-open" call; without it, nothing stops a later change from adding it.* |
| **S1** | The second view's label is still `FUND / TRIM` and the source contains no `HOLD` recommendation. | Rename the button → red. **Rewrites the existing `[42]` pin**, which matches `>FUND / TRIM</button>` and will no longer match once the count span exists. Per §F this is normal, not a regression. |
| **S2** | The tab renderer derives the count and does not recompute it: its body contains `SELL_FORCED_N` and contains neither `CAP_PCT` nor `capChecks(`. | Reimplement as `BOOK.filter(x => posOf(x).pct >= CAP_PCT).length` inside the renderer → red. |
| **S3** | The count is reset to `null` **before** `sellRank()` is called in `renderSellBlock`. | Delete the reset line → red. |
| **S4** | `sellRank(` appears exactly twice in `admin.html` (`renderSellBlock` + `buildRankingsMd`) — the tab adds no third pass. | Add `const s2 = sellRank()` in the renderer → red. |
| **S5** | The `700px` literal count in `admin.html` is unchanged at 5 homes. | Add a `matchMedia("(max-width: 700px)")` read to the tab renderer → red. **This guard is what makes the deferral safe.** |

### How R3/R5/R6 get their data — and why the global fixture must NOT change

Extending the shared `BOOK`/`POSITIONS` fixture to reach 6 discretionary rows would ripple into
`5/7 measured` coverage (:380), tier counts, `bookRollup` MV, cluster sums, the BUY top-5, the
binary calendar and the rankings export — a large, unrelated diff.

**Use the existing in-page mutate/restore precedent at `test/render.mjs:539`** (the skeleton
assertion), which already does exactly this: reassign `POSITIONS`/`POS_PENDING`, call `render()`,
measure, restore, re-render — all inside one `page.evaluate`. Both globals are `let` (:608, :626).
For R3, clone the BBB-shaped entry (its `dd()` helper stamps a `ref_px`, so `ann` is computable
and the row lands in `disc`) under six synthetic syms with small `pct` values.

**Run these on a dedicated `open(390, 844)` page** rather than the shared `phone` page. v3.57
already lost time to a shared closure leaking state between fixtures; a separate page makes
leakage structurally impossible rather than dependent on the restore executing.

### Untestable / stated rather than asserted (§P.9)

- **A genuine iOS touch swipe is not exercised.** R1 drives `scrollLeft`, which is what the
  `onscroll` handler sees — but momentum scrolling, `scroll-snap-stop` and rubber-banding are not
  reproduced in headless Chromium. Real-device behavior remains owner-verified, as with the v3.61
  safe-area insets.
- **Operational, and load-bearing for this ticket:** at the time of this pass `npm run test:ui`
  printed `SKIPPED — playwright-core is not installed` in this environment. Chromium is present at
  `/opt/pw-browsers`, so `npm install` is all that is needed — but **H2/H3 must run the browser
  suites under `REQUIRE_BROWSER=1`**. A ticket whose entire purpose is removing vacuous assertions
  cannot be validated by a suite that skipped; that is v3.58's A3 lesson in its purest form.

---

## 8. DELIBERATELY DEFERRED

- **The `700px` duplication (CSS ×4 + `matchMedia` ×1).** Real §P.4 debt, but this ticket needs no
  viewport read — **deferral confirmed, and guard S5 prevents it from growing.** It wants its own
  ticket (a `data-compact` attribute set by one `matchMedia` listener, or a CSS custom property),
  because it touches `.dd-answer` and the sticky `dd-pt th` rules too.
- **Reconciling `capChecks()` with `sellRank().forced`.** Four documented divergences (§2).
  Genuinely two different questions; merging them would delete information. Worth a ticket to
  decide whether the `>` / `>=` split is intentional — it likely is not — but changing it moves cap
  math, which §P.8 freezes.
- **Adding a stable hook to the tail `<details>`.** R3 distinguishes tail rows structurally
  (inside `<details>` vs. direct child), so no source change is needed. A `class="fdr-tail"` would
  be cleaner; not worth widening the diff.
- **A forced-trim count on the BUY tab, or a `NEXT $ IN` badge.** Symmetry is tempting; there is no
  red fact hidden behind the BUY panel that the stance strip does not already carry.
- **`aria-live` on the tab.** §5.
- **Desktop rendering of the count.** Both blocks are stacked and visible ≥700px; a badge there
  would be a second copy of a fact already on screen.

---

## Next phase

**H2 — BUILD** (Claude Sonnet 5 · alternate GPT-5.6 Luna), against this plan's file list only,
followed by **H3 — TEST DESIGN** in a fresh session for the negative controls. H6 does not
trigger: the tab's element count and hierarchy do not change, only one label's content. H7 does
not trigger: `/admin.html` is operator-only and has no newcomer.
