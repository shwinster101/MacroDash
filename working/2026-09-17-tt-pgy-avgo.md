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
