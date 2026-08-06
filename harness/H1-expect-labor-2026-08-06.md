# H1 — PLAN · FEAT-EXPECT-LABOR (forward inflation expectation + leading labor)

> **DATED PASS ARTIFACT — 2026-08-06. NOT current state.** This records one H1 planning pass
> as it stood on that date. `CLAUDE.md` is canonical for what the thing is; `HARNESS.md` is
> canonical for how a change gets made. Where this file and either of those disagree, **they
> win** — this one is a snapshot and is not maintained. Measurements below are stamped at the
> time of the pass, deliberately, rather than restated as standing facts (the same cure
> `HANDOFF.md` and `AGENTS.md` already carry).

| | |
|---|---|
| **Phase** | H1 — PLAN |
| **Model** | Claude Opus 5 (the documented alternate; H1's primary is GPT-5.6 Sol) |
| **Harness** | `HARNESS.md` §P, from `b4c730c` (branch `claude/harness-model-assignment-d6xhlb`) |
| **Repo state** | `main` @ `194514e` — v3.63.0, ENGINE0-CONT close-out |
| **Origin** | Owner-directed. Candidate metrics surfaced by browsing macrotrends.net; see §9 |
| **Status** | **Awaiting approval.** Two decisions open, §10 |

**Rotation note (§0 Rule 3).** This plan was authored in the **same session** that ran H2 for
ENGINE0-CONT. That is weaker than the session isolation the prior H1 pass carried. It is
tolerable here only because H1 plans a *new, unrelated* ticket rather than judging that build —
Rule 1's conflict is auditor-vs-builder (H3/H5 over H2), which this is not. Stated rather than
assumed away. **H3 and H5 for this ticket must still be fresh sessions**, and H2 must not be
Opus 5 (see §11).

**TICKET.** Add the market's *forward* inflation expectation (FRED `T5YIFR`) and the *leading*
labor signal (FRED `ICSA`) as **non-voting** inputs that qualify the existing inflation read and
fill the regime's missing growth channel.

---

## §0. THE INTEGRATION QUESTION

The owner's stated worry — *"a lot of unhinged data vs integration of all together to paint a
picture"* — is the organizing constraint of this ticket, not an aside. Here is the regime's
current causal map, read out of `REGIME_BAND_TABLE` (`src/regime.js`):

| Channel | Factor | Nature |
|---|---|---|
| Rates | `tenYear` (m1) | backward — realized move |
| Volatility | `vix` | contemporaneous |
| Sentiment | `fearGreed` | contemporaneous |
| Inflation | `cpiHeadline` trend | **backward** — realized, ~6wk publication lag |
| Valuation | `valuation` (CAPE) | contemporaneous, slow |
| Financial conditions | `nfci` | contemporaneous, weekly |
| **Growth / labor** | **— none —** | |

Two structural facts fall out. First, **there is no labor or growth factor at all** — six voters
and not one measures the real economy. Second, **every inflation input is backward-looking**, so
the engine can see what inflation *did* and never what the market expects it to *do*.

That yields the rule this ticket runs on:

> **A new metric earns a place only if it (a) fills a named missing channel, or (b) adds a
> forward/leading counterpart to a backward/lagging one. Which of the two it is dictates where
> it plugs in — and (b) must never become its own vote.**

**`ICSA` fills a missing channel (a).** Weekly, leading, the only real-economy input in the
stack. Arrives as a tile plus a WHY #2 cross-signal. Candidate for a 7th voter *later*, in its
own ticket, after calibration (§4, §8).

**`T5YIFR` deepens an existing channel (b).** It must **not** become a seventh opinion — it makes
an opinion we already hold legible. CPI votes on the shape of realized inflation; `T5YIFR` says
whether the market believes it:

| Realized CPI | 5Y5Y expectation | Read |
|---|---|---|
| Cooling | anchored / falling | **Confirmed disinflation** — the strongest bull case |
| Cooling | rising | **The market disbelieves the cooling** — the divergence |
| Re-accelerating | anchored | Market treats it as transitory |
| Re-accelerating | rising | **Unanchoring** — the genuinely dangerous state |

**Only the disagreement is signal** — the same logic as FEAT-TT-SPREAD's `est↑ px↓` flag, where
same-direction moves are explicitly *not* the signal. This is the answer to the sprawl worry:
`T5YIFR` gets no vote, no verdict, and no sentence of its own. It **qualifies the inflation line
that already exists**. One more number must not mean one more independent opinion.

**Design consequence that makes this cheap and safe: v1 ships ZERO new economic thresholds.**
The divergence read is a comparison of two *directions*, not a level crossing, so it needs no
calibrated band; claims render level + direction + 4-week average, not a verdict. This
simultaneously sidesteps the FRED-calibration blocker (§6), respects §P.8, and structurally
prevents the sprawl.

---

## §1. DEFECT CLASS

**(e) new capability.** Per the harness, what the first four classes would look like *in this new
surface*, and what prevents each:

- **(a) A wrong number** — a decimal-shifted `T5YIFR` (`0.23` vs `2.3`) reading as anchored
  expectations. *Prevented by:* `BANDS` entries, applied before render or cache.
- **(b) A label outliving its data** — the divergence clause printing "expectations confirm the
  cooling" after the CPI trend input was dropped. *Prevented by:* the clause is gated on **both**
  inputs being live, and omitted entirely otherwise.
- **(c) A second copy of a threshold** — the "rising expectations" test living in both
  `fiveWhys.js` and the tile. *Prevented by:* one exported comparator, two consumers (§3).
- **(d) A claim on absent evidence** — the worst case here, and the one to guard hardest: **a
  missing `T5YIFR` rendering as "expectations aligned."** Silence must never read as agreement.
  *Prevented by:* the abstention design in §5.

---

## §2. BLAST RADIUS

**Files touched**

1. `functions/api/snapshot.js` — 2 entries in the `series` map; `ICSA` 4-week average derivation;
   2 `BANDS` entries
2. `src/sources.js` — `SOURCES` keys; `CADENCE` (`ICSA` = weekly); `DERIVED_OF` for any derivative
3. `src/dashboard.jsx` — `MOCK_DATA` baseline paths; 2 tiles; `FW_FIELDS`; `SIGNAL_FIELDS` (15 → 17)
4. `src/fiveWhys.js` — WHY #1 divergence clause; WHY #2 claims cross-signal; `FIELD_LABEL`
5. `test/smoke.mjs`, `test/public-render.mjs`

**Files deliberately NOT touched** — load-bearing, and the ticket's main defense against creep:

- **`src/regime.js`** — no vote change. `REGIME_BAND_TABLE` and `REGIME_QUORUM` untouched.
- **`src/ttReadout.js`** / `functions/readout.json.js` — the order-gating `tt-v1` contract is
  frozen (§P.8).
- **`src/evidence.js`** — `FACTOR_FIELD` / `REGIME_FACTOR_FIELDS` unchanged, because neither
  metric is a factor.

**Rendered surfaces affected:** the two new tiles; 5 Whys WHY #1 and WHY #2; the Signal Quality
rollup counts; the Data Health per-source grid.

**Rendered surfaces explicitly NOT affected:** the verdict band, the Drivers matrix, the factor
chip strip, `postureSummary`, `/readout.json`, the terminal's MACRO pill. **Non-voters must not
appear in voting surfaces** — that is the visual half of the same invariant.

---

## §3. DUPLICATION CHECK

Greps run at the time of this pass:

```
grep -rin "breakeven|inflation expect|T5YIF|5y5y" src/ functions/
  → no matches

grep -rin "jobless|initial claims|ICSA" src/ functions/
  → only a MACRO_TERMS vocabulary word (fiveWhys.js:42) and one unrelated comment
```

No existing home for either value.

**One duplication risk identified and deliberately NOT unified:** `admin.html` already implements
a divergence detector (FEAT-TT-SPREAD, 8 occurrences). It must **not** be shared — `admin.html`
is buildless and cannot import, and the comparison is a different domain (estimates vs price, not
expectations vs realized). Recorded here so a later reader does not "unify" two things that only
rhyme.

**New shared constant required:** the direction comparator used by both the tile and WHY #1 gets
exactly one exported home. A second copy is the defect this repo keeps paying for.

---

## §4. INVARIANT IMPACT

- **§P.2 (honesty)** — a mock/stale `T5YIFR` must never produce a divergence claim. Both tiles
  take `ILLUSTRATIVE` treatment on mock, per v3.1.
- **§P.3 (fail closed)** — missing expectation data → the clause is *omitted*, never rendered as
  "aligned."
- **§P.4 (one computation)** — the direction comparator has one home (§3).
- **§P.6 (mock-first)** — both fields need `MOCK_DATA` baselines or the merge has nothing to
  overlay.
- **§P.8 (order-gating frozen)** — satisfied by construction: no voter added, no band moved,
  `tt-v1` untouched.

### ⚠ The finding this section exists to catch

If a future ticket promotes `ICSA` to a 7th regime voter, **`REGIME_QUORUM = 4` silently
weakens.** Its own comment in `src/regime.js` justifies 4 as *"two-thirds of the evidence base"* —
but **4/6 is 67% while 4/7 is 57%.** That is precisely the DEC-31 defect (3-of-5 → 3-of-6 = 50%,
not a majority) replayed one level up, at the *quorum* rather than the *majority*.

`verdictFrom` itself is safe — a strict majority of 7 still needs 4 — but the quorum is not.
**Any promotion ticket must revisit `REGIME_QUORUM` in the same change.** Recorded here because
this ticket is where the risk is *created*, even though it is not realized.

---

## §5. THE ABSTENTION

| Input state | `T5YIFR` | `ICSA` |
|---|---|---|
| Missing | No divergence clause. **Never "aligned."** Tile ILLUSTRATIVE | No labor cross-signal in WHY #2; tile ILLUSTRATIVE |
| Stale (cadence-aware) | Same as missing — a stale expectation cannot confirm a fresh CPI | Same; weekly cadence, so >12d |
| Mock (live build) | Same as missing (the v3.54 rule: mock cannot speak) | Same |
| Zero | Implausible → banded out | Implausible (claims are never 0) → banded out |
| Negative | Banded out | Banded out |
| Non-finite | Banded out | Banded out |
| **CPI live, `T5YIFR` not** | **The critical case:** WHY #1 prints the realized read only, with no confirmation language | n/a |

"Not measured" is distinguishable from "measured as agreeing" in every row. That distinction is
the whole ticket.

---

## §6. BAND PROVENANCE

**Two plausibility bands, both ASSERTED, and that is acceptable** — these reject the *impossible*,
not the unusual, which is the standing doctrine for `BANDS`:

- `T5YIFR: [0, 10]` — historically ~2–2.5%; wide enough to catch only a decimal shift.
- `ICSA: [0, 10_000_000]` — the 2020 peak was ~6.1M.

**No economic thresholds are added.** This is the deliberate choice from §0: the divergence read
is a *direction comparison*, and claims render *level + direction*, so nothing here needs a
calibrated band.

**Measured this pass (2026-08-06):** `api.stlouisfed.org` returns `CONNECT 403` from the build
container even after the owner added it to the environment allowlist — network policy binds at
container start, so a **fresh session is required** before any calibration is possible. That is
exactly why v1 asserts no economic threshold: an asserted band may not gate a decision surface,
and this ticket therefore does not create one.

---

## §7. TEST PLAN (as claims)

1. If `T5YIFR` is absent from the payload, then the WHY #1 divergence clause is absent — **and no
   "aligned"/"confirms" language appears anywhere.**
2. If `T5YIFR` is present but its `AsOf` is stale, then the clause is absent (same assertion as 1,
   different cause).
3. If `cpiHeadline` is stale and `T5YIFR` is fresh, then no divergence clause — a comparison needs
   both sides.
4. If the CPI trend is cooling and `T5YIFR` is rising, then the divergence sentence renders and
   names *both* directions.
5. If both move the same way, then the confirmation sentence renders — and is worded differently
   from the divergence one.
6. If `ICSA` is fresh, then WHY #2 includes a claims cross-signal; if stale/mock, it appears in
   that clause's `Excluded (mock/stale)` list.
7. If a decimal-shifted `T5YIFR` (e.g. `23.5`) arrives, then `applyBands` drops it and
   `_diag.bandDropped` names it.
8. If either field is added, then `REGIME_BAND_TABLE.length` is **still 6** and `computeRegime`'s
   `counted`/`totalFactors` are unchanged — a pin that fails loudly if someone later makes these
   voters without doing §4's quorum work.
9. If `SOURCES` gains a derivative with no `AsOf`, then the existing `DERIVED_OF` reconciliation
   fails the build until it is mapped.
10. Public-render: on a degraded fixture with no expectation data, the page shows no
    inflation-confirmation language.

**Claim that cannot be phrased testably, stated rather than invented:** whether the divergence is
*economically predictive*. That needs outcome calibration — a deferred capability (the
value-proposition audit's gap #1), not an assertion.

---

## §8. DELIBERATELY DEFERRED

- **Promoting `ICSA` to a 7th regime voter** — needs calibrated bands *and* the `REGIME_QUORUM`
  fix from §4. Its own ticket, its own approval.
- **Adding either field to `/readout.json`** — order-gating contract; the same rule NFCI and the
  30Y arrived under.
- **`CCSA`, `INDPRO`, `TCU`, `DHHNGSP` (Henry Hub), Brent–WTI spread** — defensible additions, but
  five more tiles regresses the v3.61 density work. Two now; revisit once these prove their keep.
- **Everything in macrotrends' Precious Metals, Global Metrics, Market Indexes and Interest Rates
  sections** — duplicative of FRED series we already pull, wrong cadence (annual country
  indicators cannot inform a daily posture), or previously cut on the Yahoo-dupe test.
- **The 30Y sparkline defect** (§9) — a real bug, but unrelated; single-purpose tickets debug
  faster.

---

## §9. FINDINGS CARRIED IN (from the discovery sweep that produced this ticket)

Recorded here so they are not lost, and are **not** bundled into this ticket.

**F1 — `thirtyYearSeries` is mapped, dated, and never emitted.** `SOURCES` declares it
(`sources.js:42`) and `DERIVED_OF` maps it to the live `thirtyYear` parent (`:125`), but
`functions/api/snapshot.js` emits it **zero times** — `_thirtySparkline` is computed, consumed
only for the 10s30s spread series, then deleted (`:515, 568–575`). The 30Y tile therefore renders
`MOCK_DATA`'s hardcoded array under `mode={modeOf('thirtyYear')}`, which reads **LIVE**. A
fabricated trendline inside a LIVE-badged tile — the v3.1 invariant, breached. The 10Y sibling
emits its series correctly (`:538`), so this is a one-sided asymmetry from FEAT-30Y (v3.55).
Severity: the 30Y does not vote, so no order is gated on it; but the sparkline *is* the shape a
reader uses to judge "is the long end breaking out," which is FEAT-30Y's stated purpose. Fix is
one line. **Its own ticket.**

**F2 — macrotrends.net is a chart layer over FRED, not a source.** Six sections reviewed
(Interest Rates, Energy, Global Metrics, Economy, Precious Metals, Market Indexes). Every macro
series traces to FRED/H.15; several LIBOR charts are dead series still displayed (the CBOE
Put/Call failure mode, DEC-31). Its genuine value to this project was as a **discovery catalog** —
it surfaced the two metrics this ticket adds. There is no version of "integrate macrotrends" that
beats adding a line to the `series` map.

**F3 — environment network policy blocks the data providers.** `api.stlouisfed.org`,
`home.treasury.gov` and `www.macrotrends.net` all return `CONNECT 403`; `registry.npmjs.org` and
`api.github.com` return 200. Allowlist edits bind at container start, so a **fresh session** is
required. This is the standing blocker behind the uncalibrated NFCI and 30Y bands.

---

## §10. OPEN DECISIONS (owner)

1. **The `T5YIFR`-as-qualifier design is the load-bearing call.** If it should eventually be a 7th
   voter instead, say so now — that makes calibration mandatory and drags in the §4 quorum fix.
2. **FRED remains unreachable from the current container**, so H2 can implement against fixtures
   but cannot verify against real values. A fresh session fixes that and also unblocks the
   NFCI/30Y calibrations already waiting.

---

## §11. RUNNING THE HARNESS FROM HERE

> **`HARNESS.md` is canonical for the phase prompts and the rotation table. Do not copy them —
> including §P — into a ticket, a prompt, or this file.** One home, referenced from many
> altitudes: the same rule the codebase applies to thresholds and to `ptModelRows`. This section
> gives only the *operational* steps that are specific to this ticket.

### Where the harness actually lives

**`HARNESS.md` is not on `main`.** It lives at `b4c730c` on branch
`claude/harness-model-assignment-d6xhlb`. Read it with:

```bash
git fetch origin claude/harness-model-assignment-d6xhlb
git show b4c730c:HARNESS.md
```

This is a live inconsistency worth fixing: the document that governs how changes are made is not
in the branch changes are made from. Flagged, not fixed here.

### Invoking H1 (already done — this file is its output)

- **Model:** GPT-5.6 Sol primary · Claude Opus 5 alternate. *(This pass used the alternate.)*
- Open the prompt with the literal line `Apply HARNESS.md §P.` and paste the H1 prompt body from
  `HARNESS.md` verbatim, substituting the one-sentence `TICKET:` line.
- H1 **stops at an approval gate.** It does not proceed to implementation.

### Invoking H2 (the next step for this ticket)

- **Model:** Claude Sonnet 5 primary · GPT-5.6 Luna alternate. **Must not be Claude Opus 5** — it
  authored this plan (§0 Rule 1 / the rotation note above).
- Open with `Apply HARNESS.md §P.` then the H2 prompt body, naming this file as the approved plan:

  ```
  Apply HARNESS.md §P.

  Implement the APPROVED PLAN for FEAT-EXPECT-LABOR
  (harness/H1-expect-labor-2026-08-06.md), and nothing else.
  ```

- H2's own constraints (from the prompt, not restated here): show the intended diff and wait for
  go-ahead; scope is **this plan's §2 file list** — a file outside it is scope expansion and H2
  must stop and say so rather than edit it; tag new blocks with the ticket ID in the surrounding
  file's comment style; stop and report rather than silently redesigning if the plan turns out to
  be wrong.
- H2 finishes by running the gates and pasting **real output** — never describing a suite as
  passing without it — and by stating every plan item it did *not* implement.

### The gates

```bash
npm run gates     # smoke · test:ui · test:public · audit:prod, failing on the first red
```

Use the runner, never a hand-chained sequence (§0 Rule 4: `npm test | grep FAIL && git commit`
exits 0 when grep *finds* a failure, which let a red commit through on this harness's first run).
For the browser suites, `REQUIRE_BROWSER=1` turns a missing Chromium into a failure rather than a
silent skip.

### After H2

- **H3 (test design) and H5 (audit) each want a fresh session**, and both must differ from H2 —
  H3 writes the negative controls, H5 audits the finished diff. Neither may be the model that
  built it.
- **H4** runs only if a gate is red for a reason H3 did not intend.
- **H6** (UI structure) and **H7** (newcomer read) are conditional; this ticket adds two tiles and
  two narrative clauses, so H6's trigger (a change to layout, hierarchy or the *count* of rendered
  elements) plausibly fires and H7's does too (the public page changes for a non-operator). **A
  skipped conditional phase is stated, never silent** (§P.9).
- **H8** (release) bumps `package.json` **and** the mirrored version in the buildless
  `public/admin.html` `<title>` and brand line — smoke pins that they match, so a half-bump fails
  the gate.
