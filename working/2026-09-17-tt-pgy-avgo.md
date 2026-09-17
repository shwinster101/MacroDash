# TT run — PGY + AVGO, from the terminal baseline · 2026-09-17

Owner request: *"TT PGY and AVGO from terminal baseline."* Read-only run against the live
PIN-gated terminal (`macrodash.pages.dev`), no KV write. Both names are already in the book —
this is a re-run against the canonical surfaces, not an intake.

---

## 1. Terminal baseline (read first, so the two names are judged against it)

| Surface | Reading | Source |
|---|---|---|
| Engine 0 | **TAILWIND · HIGH · FULL · OK** — 7 checks, 7 CURRENT, 3 bull / 1 bear, both panic gauges current | `/readout.json`, as_of 2026-09-17T06:03Z |
| Macro Flip | **CLEAR**, evaluable | same |
| Public call | HODL · NEUTRAL · HIGH · FULL (2 bull / 1 neutral / 3 bear of 6) | `call` block |
| Product macro gate | **SEND IT** | `/api/allocation` receipt, `macro_gate.gate = SEND_IT` |
| Receipt | **ALLOCATABLE**, `tt-alloc-v3.1.0`, `business_date_et` **2026-09-17** (today), no context blockers | same |
| **ELIGIBLE NEXT DOLLAR** | **NBIS** — 2027 tgt $617, +194.7% raw, **+131.4%/yr** at $209.37 live | same |
| Horizon in force | **2027** · `unranked_at_horizon: []` | same |
| Circuit | **ARMED**, as_of 2026-09-13, age 4d (inside the 7d window) → caution, not a veto | `board.circuit` |
| Book | v25.3, asOf 2026-09-15, 54 names + 8 cut | `/api/tt` |
| Score index | 38 records | `/api/score?book=1` |
| DD index | 45 payloads, asOf 2026-09-16 | `/api/deepdive?index=1` |
| Positions | snap 2026-09-15, 21 held symbols | `/api/positions` |

**Neither PGY nor AVGO is held** in the synced account (••••5290). So no forced-exit, kill-flag
or over-cap trim rule can reach either name, and `SELL` is structurally unavailable for both.
`BUY` requires the canonical ELIGIBLE NEXT DOLLAR line to name the ticker; it names NBIS.
**Both calls are WAIT before either name's own evidence is read** — the sections below establish
*how far* each is from changing that, which is the decision-relevant part.

---

## 2. PGY — a complete card with exactly one blocker, and the blocker has a date

**Book:** `tier WATCH · lens QC`. The stored note (2026-09-15) still reads *"BLOCKING GAP … No
pt_model until the basis and net debt are settled"* — **that note is stale**: the pt_model landed
2026-09-15 and the card scored P1 at 9.14 on 2026-09-16.

### 2.1 The server card

`/api/score?sym=PGY` — `tt-underwriting-v2.6.0` (current engine, so no re-score veto), computed
2026-09-16T23:16Z, route **QUALITY_COMPOUNDER / STANDARD**.

| Pillar | Score | Note |
|---|---|---|
| owner_valuation (P1) | **9.14** | basis **PREMIUM**, prerequisite **PASS**, target **$37.80 @ 2027**, +57.18%/yr at its $21.46 basis |
| trajectory (P2) | 6.52 | — |
| economic_quality (P3) | 8.94 | filled 2026-09-16 from the Q2-26 10-Q |
| falsifier_health (P4) | **null** | `AWAITING_FALSIFIERS` |

- **All nine gates PASS** — `QC_G1_ROUTE_FIT`, `QC_G2_UNIT_ECONOMICS`, `QC_G3_VALUATION_PREREQ`
  (the premium prerequisite) and all six `GLOBAL_*`.
- Status **PROVISIONAL**, provisional score **8.2**, tier **B — hard-capped**, `tier_uncapped: A`.
- Actionability **BLOCKED**; `blocked_on: []` (the blockers are the bootstrap pair, not
  `BLOCKED_PENDING_INPUT:` gate ids).

### 2.2 The root cause, and why it is a date rather than a defect

The five falsifiers were committed **2026-09-15T18:05Z** and carry **zero qualifying
observations**:

| id | importance | kill | observed |
|---|---|---|---|
| take_rate | 3 | — | none |
| volume_recovery | 3 | — | none |
| gaap_guidance_delivery | 3 | — | none |
| margin_inflection_holds | 2 | — | none |
| finance_leadership_controls | 3 | **yes** | none |

§6.4.1 requires the observation to post-date the commitment. The last print was the 2026-07-30
Q2-26 release — *before* the commitment — so **no existing evidence can qualify**. The earliest
observation is the **Q3-26 print on 2026-11-17** (61 days out, and the payload's only
`key_dates` binary).

This was deliberate, and the card says so in its own `_owner_todo`:

> *"FALSIFIERS PRE-COMMITTED 2026-09-15, BEFORE the Q3-26 print on 2026-11-17 — deliberately
> done while the card is already blocked on P3, so the §6.4.1 clock starts at zero cost. On a
> SCORED name the same act would null P4 and drop the card."*

So **PGY cannot reach SCORED before 2026-11-17 at any price**, and PROVISIONAL is never eligible
by construction (`evalEligibility` requires `status === "SCORED"`). The wait is dated, not
open-ended — which is the useful thing to know, and the opposite of a name that is merely stuck.

One self-reported weakness worth carrying forward: `falsifier_defect_2026_09_16` records that
`finance_leadership_controls`' green condition ("a permanent CFO is named and in seat") was
**already true at commitment**, so it will grade GREEN trivially. Named, not edited — editing
re-opens the commitment (§6.4.1). Its RED arm (restatement / material weakness) is still live.
Effectively P4 rests on four informative falsifiers, not five.

### 2.3 Live ladder, at today's price

Stored `pt_model` (owner ruling 2026-09-15, superseding the assistant-set 17x/16x):
premium **20x FY2027 → 18x FY2028**, floor **12x**, share count 92.4M, net cash $0.383B.

| Rung | Target | vs live $20.565 | Annualised |
|---|---|---|---|
| YE2027 premium (18 × $2.10) | **$37.80** | +83.8% | **+60.4%/yr** |
| YE2027 floor (12 × $2.10) | $25.20 | +22.5% | +17.1%/yr |
| YE2026 premium (20 × $1.85) | $37.00 | +79.9% | *670%/yr — Q4-cliff artifact, see §4* |

Live is **better** than the card's stamped +57.18%/yr because PGY fell to $20.565 (−5.0% today,
prior close $21.64) against the card's $21.46 basis. Forward P/E at live: **12.31x** FY2026 GAAP
$1.67 · **11.12x** FY2027 $1.85.

**Estimate caveat that rides every rung:** FY2027/28 GAAP EPS are **DERIVED** (the non-GAAP
series' own YoY growth applied to the sourced FY2026 GAAP base), and the derived marker
propagates to the target. Only FY2026 is sourced.

### 2.4 Tape (assistant-measured — NOT stored, so the canonical WHEN leg is UNREAD)

No `price_action` block exists on the payload, so `computeTechRead` reads **UNREAD** and the
eligible line would carry no distance chip. Measured today for context only:

- $20.565 vs 50d **$20.01** (+2.8%) and 200d **$17.26** (+19.2%); 50d > 200d. RSI(14) **53.0**.
- Alignment +3 of 3 → would read **bullish** if it were stamped.

---

## 3. AVGO — the math ranks it first and the evidence ranks it last

**Book:** `tier WATCH · lens AI · rank "— no re-arm; VRT still broken"`, note from the 7/29
handoff.

### 3.1 There is no server card

`/api/score?sym=AVGO` returns **`record: null`**, and AVGO is **absent from the 38-record score
index**. So the canonical composite is **UNAVAILABLE** — not low, not stale: never computed.
The payload's `composite.score 6.8` is the **legacy free-text** surface (built 2026-09-15,
V8.0·G8.5·P7.0·M4.0·R7.0 → 7.18, held down to 6.8 for stated estimate risk) and is diagnostic
only; under §14.8 the server card governs, and there is none to govern with.

Building one is real work, and it would not unlock a buy: the payload has no
`underwriting_inputs`, and its three hinges (`custom_silicon_share` unknown,
`leverage_and_dividend` amber, `consensus_ramp_integrity` unknown) were **pre-committed
2026-09-15 with nothing graded** — so P4 would land `AWAITING_FALSIFIERS` and the best
attainable state is **PROVISIONAL**, which is never eligible. Next print: **2026-12-10**.

### 3.2 Live ladder

Stored `pt_model`: premium **27x FY2027 → 24x FY2028**, floor **18x**, 5,027M shares.
Net debt $35.44B deliberately not deducted (earnings lens is equity-level).

| Rung | Target | vs live $347.28 | Annualised |
|---|---|---|---|
| YE2027 premium (24 × $30.56) | **$733.44** | +111.2% | **+78.7%/yr** |
| YE2027 floor (18 × $30.56) | $550.08 | +58.4% | +42.9%/yr |
| YE2026 premium (27 × $19.38) | $523.26 | +50.7% | *316%/yr — Q4-cliff artifact, see §4* |

Forward P/E at live: **29.78x** FY2026 $11.66 · **17.92x** FY2027 $19.38. PEG 0.42 on FY2026.

**The multiples are ASSISTANT-SET and unconfirmed** (`multiple_ruling`: *"ASSISTANT-SET
2026-09-15 — OWNER TO CONFIRM"*, street-calibrated off the TipRanks $519.21 target). PGY's
schedule, by contrast, carries an explicit owner ruling. Two ladders, two very different
provenances, and only one of them has been signed off.

**Corroboration, stated by the payload itself:** FY2026 ties out two independent ways on
TipRanks (FWD P/E 29.54 → EPS $11.515 vs $11.66; PEG 0.43 → 68.7% growth vs +70.93%).
**Nothing corroborates FY2027–28**, which is where the entire $733 rung lives.

### 3.3 Tape — the 7/29 "trigger broken" note is confirmed, 50 days later

- $347.28 vs 50d **$381.45** (−9.0%) and 200d **$369.52** (−6.0%) — **below both**.
- 50d still > 200d, so alignment is −1 of 3 → would read **BEARISH**. RSI(14) **32.4**.
- 31.3% below the 52-week high ($495.00, 2026-06-03); 52-week low $289.96.

The stored rank note said *re-arm post-VRT-print or on reclaim only*. There has been no reclaim:
price is under both averages. The note is stale in its *reasoning* (the payload flags two street
raises and an initiation in the last two weeks) but **correct in its conclusion**.

---

## 4. Cross-findings

**(a) The math and the evidence disagree, and they disagree cleanly.** AVGO ranks first on the
ladder (+78.7%/yr vs PGY's +60.4%/yr) while being last on every evidence axis: no card,
unconfirmed multiples, uncorroborated FY2027–28 estimates, and a tape below both averages. PGY is
the mirror image: full card, owner-ruled multiples, all nine gates PASS, bullish tape, and a
single dated blocker. This is exactly the WHAT-vs-WHEN split the framework keeps married and
never merged — worth stating because a ranking sorted on `%/yr` alone would put the weaker name
on top.

**(b) The Q4 cliff is ~2 weeks from biting, and today it does not.** `ANN_MIN_Y = 0.25`; YE2026
is **0.288y** out, so `pickRow` does **not** roll and a `nearest` horizon would publish
**+670%/yr (PGY)** and **+316%/yr (AVGO)**. The horizon in force is **2027**, so nothing on the
live board is distorted, and the v3.81 distortion warning (≥200%/yr) would catch it anyway. From
**2026-10-02** YE2026 drops under 0.25y and rolls on its own. Checked, working as designed — no
change proposed.

**(c) The stale PGY book note.** The `tt:book:v1` entry still says *"No pt_model until the basis
and net debt are settled"*. The pt_model exists and the card scores P1 PREMIUM off it. A note
describing a gap that has closed is the label-outlives-its-data defect, in stored data — the same
class `LABEL_DRIFT` was built for in v5.0. One-field fix, owner's to make.

**(d) The circuit re-assert expires 2026-09-20 — three days out.** This is the highest-leverage
thing the baseline read surfaced, and it has nothing to do with either ticker. `board.circuit` is
ARMED as of **2026-09-13** against `CIRCUIT_STALE_D = 7`. If it lapses it resolves **UNRESOLVED →
ADDS SUSPENDED**, the SEND IT gate goes dark, and *NBIS stops being eligible too*.

A live pull today shows the account has **improved** since the 9/13 assertion:

| | 2026-09-13 (asserted) | 2026-09-17 (live pull) | Δ |
|---|---|---|---|
| NAV | $225,698 | **$228,860.74** | +1.4% |
| Gross | $503,857 | $486,782.53 | −3.4% |
| Debt | $278,159 | $257,921.80 | −7.3% |
| Buying power | $4,663 | **$25,102.71** | +438% |
| Gross leverage | 2.23x | **2.13x** | −0.10x |
| Debt as % of NAV | 123.2% | **112.7%** | −10.5pp |

First improvement after two consecutive deteriorations (2.07x → 2.23x → 2.13x). **The numbers are
assistant-computed from a live `get_portfolio` pull; the STATE is the owner's call** — nothing was
written. Stored `positions` are 2 days old (snap 2026-09-15, account equity $211,604.34) and
`board.account` is from **2026-07-28** with a formula recording that `get_portfolio` was denied at
the time — it is no longer denied, so that record can be repaired whenever a sync runs.

---

## 5. TT-run response lines

```
PGY  — Composite: 8.2/10 PROVISIONAL, tier B-capped (uncapped A) (/api/score card,
       tt-underwriting-v2.6.0, computed 2026-09-16; legacy free-text 7.0 is diagnostic only)
     · PT: $37.80 (PREMIUM, 18x FY2028 GAAP EPS $2.10, YE2027, owner-ruled pt_model 2026-09-15
       — FY2028 EPS is DERIVED)
     · Call: WAIT — the card is PROVISIONAL on P4 AWAITING_FALSIFIERS (5 committed
       2026-09-15T18:05Z, 0 observed; earliest qualifying observation is the Q3-26 print
       2026-11-17), so it is never eligible by construction, and ELIGIBLE NEXT DOLLAR names NBIS.

AVGO — Composite: UNAVAILABLE — no server card exists (/api/score?sym=AVGO returns record:null;
       absent from the 38-record score index). Missing gate: the card itself — no
       underwriting_inputs are authored. Legacy free-text 6.8 is diagnostic only and does not
       substitute.
     · PT: $733.44 (PREMIUM, 24x FY2028 EPS $30.56, YE2027, pt_model ASSISTANT-SET 2026-09-15,
       OWNER TO CONFIRM; FY2027-28 EPS uncorroborated). Floor rung 18x = $550.08.
     · Call: WAIT — no canonical composite, ELIGIBLE NEXT DOLLAR names NBIS, the owner trigger
       has been broken since 7/28 with no re-arm, and the tape confirms it: $347.28 sits below
       both the 50d $381.45 and the 200d $369.52, RSI 32.4.
```

---

## 6. What was deliberately NOT done

- **No KV write of any kind.** No score PUT, no book edit, no circuit re-assert, no position
  sync. The owner asked for a run against the baseline, and every candidate write here
  (circuit state, tier call, multiple ruling) is an owner judgement by standing rule.
- **No `underwriting_inputs` authored for AVGO.** Gate assertions and falsifier conditions are
  owner-judgement content; fabricating them to manufacture a card would be the exact
  rationalization risk §6.4.1 exists to prevent — and it would still only reach PROVISIONAL.
- **The `finance_leadership_controls` falsifier was not edited.** Editing re-opens the
  commitment and is post-hoc by definition (§6.4.1). Recorded as low-information instead.
- **No `price_action` stamp for either name.** Levels are stamped by the broker-historicals
  sync at a TT run, not hand-entered; the measured levels in §2.4/§3.3 are context in this note
  and are not stored.

---

## 7. Addendum — "is this reflected in the terminal ladder export?" (same day)

Owner follow-up asked whether the findings above appear in the latest exported terminal ladder.
No such PDF was reachable from this session (not attached, not in the repo, not in Drive — searched
`mimeType = 'application/pdf'` plus title/fullText on ladder/rankings/terminal/TT/PGY/AVGO). The
question is still answerable without it, because `buildRankingsMd()` (`public/admin.html:7358`) has
a fixed column set and most of §2–§4 has nowhere to land in it.

**Master-table columns:** `# · Sym · Tier · Lens · Composite · %/yr · Weight · Rank: upside ·
Rank: comp · Rank: in tier · Rank: in lens · Readiness · Flags`.
**Flag vocabulary:** red hinges · NEVER RUN / run Nd · options-only · rolled · R/R fails ·
binary Nd (only within `BINARY_WINDOW_D = 10`) · stamped px.

| Finding | In the ladder? |
|---|---|
| PGY composite 8.2 / B, AVGO composite absent | **Yes** — Composite column (AVGO prints `—`) |
| PGY +60.4%/yr, AVGO +78.7%/yr | **Yes** — %/yr column, recomputed live at export time |
| Both unheld | **Yes** — Weight prints `not held` |
| **PGY's blocker date (2026-11-17)** | **No.** No column carries it, and `binary Nd` only fires inside 10 days — at 61 days out **no flag renders at all** |
| **AVGO has no server card vs. a stale one** | **No.** Composite `—` cannot distinguish *never computed* from *stale* |
| **The tape** (AVGO below 50d and 200d, RSI 32.4) | **No.** `price_action` is unstamped on both, so the WHEN leg is UNREAD and contributes no column and no flag |
| **AVGO's multiples are assistant-set, PGY's owner-ruled** | **No — and this is the sharpest gap.** There is no provenance column, so $733.44 and $37.80 print with identical authority |
| Circuit expiry 2026-09-20 | **Partly** — STANCE prints the circuit state via `st.quals`, never its expiry date |

**The literal answer is no, in a stronger sense than the table shows: nothing from this run is
recorded in the terminal at all.** It was read-only by design, so there is no write for an export
to pick up. Concretely, any ladder generated today prints both names as:

```
| ## | PGY  | WATCH | QC | 8.2 | +60.4% | not held | … | BLOCKED | NEVER RUN |
| ## | AVGO | WATCH | AI | —   | +78.7% | not held | … | BLOCKED | NEVER RUN |
```

Neither book entry carries `lastRun` (`PGY: sym,tier,lens,fp,note` · `AVGO: sym,tier,lens,rank,note`),
so `runState` returns `never`, `readiness()` returns **BLOCKED**, and the Flags column prints
**NEVER RUN** for both — regardless of how complete the card underneath is. PGY's 8.2 with nine
gates PASS and a NEVER RUN flag beside it is the ladder telling the truth about attestation, not
about evidence.

**Dating test for whatever PDF is in hand:** PGY's card was computed **2026-09-16T23:16Z**. An
export stamped before that shows PGY with **no composite at all**; one stamped after shows 8.2/B.
That single cell dates the document.

### New finding, and it outranks the rest: the eligible line expires 2026-09-19

`runState` is `fresh` at `d <= 30`, `stale` at `d > 30`. **NBIS — the only name on the ELIGIBLE
NEXT DOLLAR line — carries `lastRun: 2026-08-19`**, which is 29 days old today and **31 days old on
2026-09-19**. At that point FIX-B (v3.49) vetoes it: a non-fresh TT run per name is a hard WAIT, so
the board's single eligible name goes dark.

That lands **one day before** the circuit re-assert expiry already filed at §4(d). Two independent
clocks take the board to no-eligible-name across the same weekend:

| Date | Clock | Consequence if it lapses |
|---|---|---|
| **2026-09-19** | NBIS `lastRun` > 30d | ELIGIBLE NEXT DOLLAR goes dark — no name qualifies |
| **2026-09-20** | Circuit `as_of` > `CIRCUIT_STALE_D` 7 | Circuit → UNRESOLVED → ADDS SUSPENDED board-wide |

Both are one-field owner acts (a run stamp; a circuit re-assert). Neither is a code change, and
neither was written here.

---

## 8. Outcome — lastRun stamped on NBIS, PGY, AVGO (write executed)

Owner instruction: *"Stamp last run on NBIS PGY avgo."* Executed as a real write against
production KV — the first write this session made.

**Mechanics:** refetched `/api/tt` fresh (still v25.3, no drift since §1), patched only the three
entries' `lastRun` to today's ET date (`en-CA` / America/New_York, the FIX-A rule — never
`toISOString()`), left every other field on all 54 book entries + 8 cut entries byte-identical,
sent the whole-book PUT with `If-Match: 25.3` (the documented optimistic-concurrency contract).

**Result:** `200`, version **25.3 → 25.4** (the standard +0.1 whole-book-replace bump), `asOf`
advanced to 2026-09-17. Read-back verified: all 54 names + 8 cut entries present, `board` carried
forward intact (all 9 keys: `as_of, account, regime, decisions, binaries, capex, circuit, funding,
clusters` — untouched, since `board` was omitted from the PUT body and the server's documented
absent-means-carry-forward rule applied). NBIS/PGY/AVGO all now read `lastRun: 2026-09-17`, age
0d, `runState: fresh`.

This clears the **2026-09-19 NBIS eligibility clock** filed in §7 — the only name on the ELIGIBLE
NEXT DOLLAR line was 29 days into its 30-day freshness window; it now has a full 30-day runway
again. PGY and AVGO move from **NEVER RUN** to **fresh** on the ladder's Flags column, which
answers §7's finding directly: the ladder's Flags cell for both names now reads the harness
attestation truthfully, matching the actual analytical pass done in §2–§3.

**The circuit re-assert (2026-09-20 expiry, §4d) is unchanged** — a `lastRun` stamp on three
tickers does not touch `board.circuit`, which still needs its own owner act.

## 9. Addendum — "the full ladder popup in terminal," not the markdown export

Clarifying follow-up: the owner meant the terminal's own popup/tab view, not `buildRankingsMd()`.
There is no single element literally named "ladder popup" in the code; two surfaces are the
candidates, and they disagree on what they show:

| Surface | Opened by | Renders | Reads |
|---|---|---|---|
| **CARD** (`openCard`, `#overlay` modal) | tapping a chip | `ddExec`/`ddWorth` — the near/far PT targets computed **live** from the stored `pt_model`; a separate **TICKER GATES** panel (`v2CardHtml`) — the SA/TipRanks street-eligibility receipt, a different engine entirely (ELIGIBLE/WAIT off `analystTarget`, not the composite score) | `dd.pt_model` directly + `/api/street`, `/api/ticker-facts`, `/api/ticker-analysis` |
| **DEEP-DIVE TAB** (`#SYM` hash route) | tapping the same name, or Enter in search | the full multi-rung `ddPtModelSec`/`estRunTable`, **plus** the shadow **SCORE panel** (`ddScoreBar`) — composite, tier, PROVISIONAL/SCORED status, P4 blocker | `dd.pt_model` + `cardInfo(sym)`, which lazy-fetches `/api/score?sym=<SYM>` fresh the moment the tab opens |

**The PT ladder numbers ($37.80 @ 2027 for PGY, $733.44 @ 2027 for AVGO) are already correct on
both surfaces** — they compute live from the stored payload, the same arithmetic done by hand in
§2.3/§3.2, and nothing in this session touched `pt_model` on either name.

**The composite/PROVISIONAL/gate findings from §2.1/§3.1 (PGY 8.2 PROVISIONAL/B, AVGO no server
card) live ONLY in the deep-dive tab's shadow SCORE panel, not the card popup.** That panel calls
`loadScoreSym(sym)` on tab open, which fetches `/api/score?sym=` fresh every time — it is not
served from a boot-time cache, so it is not stale relative to anything reported here.

**One real caching seam, stated so it isn't mistaken for a discrepancy:** the board-level ranking
rows (BUY list, FUND list) read `cardInfo()` too, but for a name whose tab was never opened they
fall back to `SCORE_INDEX`, loaded once at `bootLoads()`. A browser tab left open since before
PGY's card was computed (2026-09-16T23:16Z) would show a stale ranking row for PGY until the page
is reloaded — reloading re-fetches `SCORE_INDEX` fresh, and opening either name's tab directly
bypasses this entirely. The `lastRun` stamp in §8 has the same property: an already-open terminal
tab needs a reload to show the new stamp, since `BOOK` is also loaded once at boot.

---

## 10. Correction and audit — FEAT-TT-LADDER is real, verified, and unmerged

My prior turn was wrong to stop at "no v6.7.3 exists" — that was true of `origin/main` and the
live deploy, but I hadn't checked every remote branch. `git ls-remote --heads origin` surfaces
**`claude/terminal-pin-309310-ladder-qrn0n8`**, cut from the same merge-base as `main`
(`70f7a3d`), carrying four real commits: **v6.7.0 FEAT-TT-LADDER, v6.7.1 (quarterly freshness),
v6.7.2 (a retracted finding, corrected), v6.7.3 (server-receipt comparison)**. The branch name
embeds the same PIN the owner gave me two turns ago — almost certainly a prior session working
the same request this session's naming convention echoes.

### Verification performed (not taken on faith)

- `git diff --stat origin/main <branch>`: 9 files, `public/admin.html` +676/-lines,
  `test/smoke.mjs` +512, `test/render.mjs` +238, plus `working/2026-09-17-full-ladder.md`.
- Read the actual code: `openLadder()`, `ladderHead()`, `ladderTable()`, `rowVeto()` (lifted
  from a closure — the load-bearing structural change), `ladderServerMacroCell`/
  `allocServerVerdict`/`allocReceiptAgeD` (the v6.7.3 server-comparison layer). Confirmed the
  literal strings the owner quoted: `▦ FULL LADDER` (two call sites — the ranking footer and
  DAILY OPS) and the modal title `` `FULL LADDER — YE${d.Y1} / YE${d.Y2}` ``.
- **Ran the actual test suites in a throwaway `git worktree`** (this environment has Chromium
  at `/opt/pw-browsers`, unlike the authoring session, which recorded uncertainty about browser
  availability): `npm test` → **2505 passed, 0 failed**; `REQUIRE_BROWSER=1 npm run test:ui` →
  **335 passed, 0 failed**; `REQUIRE_BROWSER=1 npm run test:public` → **356 passed, 0 failed**;
  `npm run audit:prod` → 0 vulnerabilities; `npm run build` → succeeds. Every number in the
  changelog's own claim matches an independent run, not just the branch's self-report.
- Read `working/2026-09-17-full-ladder.md` on that branch: the feature answers a literal owner
  ask (*"pull the full ladder ye26 and ye27 targets for all... ranked by percent increase"* +
  *"can this... be a live pdf or pop up or tab accessible via terminal?"*), and the pull's own
  aggregate findings are recorded there (42 of 54 names carry a rung, only 5 clear every gate,
  18 of 54 read NEVER on the freshness clock).

### Utility audit

**High leverage, for a specific and verifiable reason — it is the union of three patterns
already proven in this codebase, applied to a genuine gap.** No surface before this put every
name's near-year AND far-year target side by side; comparing them meant opening up to 45 tabs
by hand, which is exactly what the owner had to ask for as a one-off chat pull before this
existed. The build is not a bolt-on report — it **re-derives nothing**: targets from
`ptModelRows`, the gate from `rowVeto` (newly promoted from a private closure to a top-level,
independently testable function — a strict improvement for any future third consumer of that
same veto), the composite from `cardInfo` (the real server card, never the legacy free text),
board state from `macroGate`. That is the specific property that keeps a second surface from
silently drifting from the canonical answer — the exact defect class this file has paid for
repeatedly (v3.36, v3.39, v3.49's 5-vs-6 denominator). The v6.7.1→v6.7.2 sequence is a good
sign, not a bad one: a finding was published, found to be an artifact of the test's own
harness, and retracted with the true cause recorded rather than silently corrected.

**Named weaknesses, so this isn't a rubber stamp:**
- **It is one PR away from a version collision.** `main` is still at v6.6.4; this branch claims
  v6.7.0–v6.7.3 uncontested today, but this repo's own history shows six-plus prior instances
  of two branches claiming the same number when left unmerged (ENGINE0-CONT, FEAT-TT-SCORE,
  FEAT-TOKW, FEAT-TT-PROVISIONAL, FEAT-TT-SOURCING/DOTHOME). The single highest-leverage action
  is merging it before another session starts a fresh v6.7.x.
- **A real, unfixed endpoint bug was found and correctly left out of scope**: `GET /api/quotes`
  silently truncates past 40 symbols and reports an empty `missing[]` — the book already holds
  54 names, so this will eventually bite a different caller. Filed in the working note as
  backlog, not fixed here; worth its own ticket regardless of whether this branch merges.
- **The freshness pull is itself a finding worth acting on independent of the UI**: every due
  date lands in one **2026-12-01 → 2027-01-11** window — "one run per quarter" as currently
  stamped is a single ~40-name December pile-up, not a staggered cadence.
- **Bounded audience by design**: this is a PIN-gated personal decision surface, not a public
  product feature — "high leverage" here means owner-workflow time saved and cross-name drift
  avoided, not broader MacroDash reach. That is the correct scope for this module and is stated
  as such in the branch's own release notes (no band/vote/gate/receipt-schema moved).

**Nothing on this branch was touched** — no push, no merge, no PR opened. The worktree used to
run its tests was created and removed in this session's scratch area only.
