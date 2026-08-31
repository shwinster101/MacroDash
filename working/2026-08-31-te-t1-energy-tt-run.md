# TT run — TE (T1 Energy Inc.) · 2026-08-31

First-pass intake and TT run on **TE**, prompted by the 2026-08-27 Giga Arctic data-center
rezoning headline. TE is **not in the book and not in the cut list** — this is an intake, not a
re-run, so every canonical surface is legitimately absent rather than stale.

---

## 1. Canonical state — why the call is WAIT

| Surface | Reading | Source |
|---|---|---|
| Engine 0 | `TAILWIND · HIGH · FULL · OK` — 5 usable, 3 bull / 1 bear, both panic gauges CURRENT | `/readout.json`, as_of 2026-08-31 |
| Product macro gate | **SEND IT** | `/api/allocation` receipt, `macro_gate.gate = SEND_IT` |
| ELIGIBLE NEXT DOLLAR | **NBIS** (2027 tgt $570, +103.7%/yr) — *not* TE | same receipt |
| TE in `tt:book:v1` (v24.2, 50 names) | **ABSENT** | `/api/tt` |
| TE in score index (35 records) | **ABSENT** | `/api/score?book=1` |
| Receipt freshness | business_date 2026-08-27 — **prior business date**; context blockers: positions 3d old, account 3d old | same receipt |

The macro axis is permissive and is **not** what stops this name. Three canonical gates are
structurally unsatisfiable today: no book entry, no `pt_model`, no server card. Per the TT-run
response contract, `BUY` requires the canonical ELIGIBLE NEXT DOLLAR line to name the ticker; it
names NBIS. **Call = WAIT.**

## 2. Measured facts

Sourced by the assistant per the v3.85 boundary (owner supplies only forward rev/EPS + the
TipRanks published target).

| Fact | Value | Basis |
|---|---|---|
| Live price | **$4.365** @ 15:05 ET 2026-08-31 (prev close $4.79, −8.9%) | Robinhood quote |
| Shares outstanding | **294,527,067** | Robinhood fundamentals |
| Float | 247.58M | same |
| Market cap | $1.286B at live px | derived |
| Unrestricted cash | $79.1M at 6/30/26 (+$120M July convert) | Q2 2026 release |
| Cash incl. restricted | $156.4M at 6/30/26 | same |
| Debt principal | $583.4M at 6/30/26 + $120M 4.75% conv. 2031 (July) = **$703.4M** | 10-Q / 8-K |
| Net debt | **$504.3M** (unrestricted basis, pro-forma the July raise) | derived |
| Book equity | ~$194M (mktcap ÷ P/B 6.6612) | derived — *needs the real filed figure* |
| Q2-26 net sales | $250.1M · production 935 MW | Q2 release |
| Q2-26 net loss (cont. ops) | $(36.9)M | same |
| Q2-26 Adj. EBITDA | $10.7M — **including a $24.4M tariff refund** | same |
| Next earnings | 2026-11-11 (~72d out — outside the 10d binary window) | TipRanks |

> ⚠ **A stored-data trap worth naming.** TipRanks shows net debt $699.4M / EV $2.11B because it
> pairs 6/30 *cash* with post-July *debt* — double-counting the $120M raise, which is net-debt
> neutral at issuance. My $504.3M uses one date for both legs. The difference is not cosmetic:
> it decides an INDC gate (§4).

## 3. The two findings that actually matter

### 3.1 Revenue is a related-party channel, not arm's-length demand

**One customer was ~100% of net sales for the six months ended 2026-06-30, and 100% of trade
receivables.** That customer is the **Trina Group** — which is simultaneously:

- the seller of the assets (Trina's 5 GW US module plant, closed Dec 2025),
- a **~10% equity holder** (30.65M shares after a May 2026 sale; was 17.4% / 45.9M at close),
- the technology licensor, taking **commissions and royalties** ($8.5M in Q1-26 alone).

Vendor sells you the plant → licenses you the tech → takes a royalty → buys ~100% of the output →
and owns a tenth of your equity. That is the **`AI_G2_CIRCULARITY` shape in its purest form**, and
it evaluates hard:

```
supplier_equity_pct        ≈ 10.4   (≥5  ✓)
supplier_is_primary_vendor = true       (✓)
top_customer_backlog_pct   ≈ 100   (>70 ✓)   →  loop && conc>70  →  FAIL
```

The Clearway 641 MW contract is the genuine diversification signal and is the thing to track.

### 3.2 The buildout is not funded, and the company says so

- G2_Austin Phase 1 capex guidance raised **$425M → $510M** (20% contingency, Texas
  data-center-driven labour/materials inflation).
- **Remaining spend ~$200–250M.**
- Pro-forma unrestricted cash ~$199M *before* Q3 opex burn and debt service.
- The $120M convert is explicitly **"a bridge to a comprehensive financing solution"** — not the
  solution. Management: financing "has taken longer than expected."
- First G2_Austin cells already slipped to **Q1 2027**.

`AI_G1_BUILDOUT`: `capex_funded_12mo = false` → **FAIL**. There is no committed undrawn facility,
so the SP-route runway gate would read the same way.

## 4. Routing — and why it is not AI infra

The market is trading TE as an AI-datacenter name (+9% on rezoning). The AI_INFRA harness's own
guardrail forbids scoring it there: *"if the company is not actually an AI-buildout company,
refuse to score it on this harness and name the correct lens."* 100% of revenue is solar modules.
There is no data center — there is a rezoning permit and a grid allocation.

| Lens | Verdict |
|---|---|
| `AI` (AI_INFRA/NEOCLOUD) | **Reject.** Zero DC revenue/customer/funding. Would also FAIL G1+G2 anyway. |
| `AIP` (AI_INFRA/PLATFORM) | **Reject — and it is a trap.** `AI_G3P` would compute PEG = 9.92 / 705.86 = **0.014 → PASS**. That "705.86% growth" is off a **$0.05** base: a zero-crossing artifact, exactly the sign/scale defect the v4.7 QC_G3 patch and the v3.47 `LENS_MAX_PE` rule exist to stop. A PASS here would be arithmetic, not evidence. |
| `IND` (QUALITY_COMPOUNDER/INDUSTRIAL_CYCLICAL) | **Recommended.** A policy-dependent, capital-intensive commodity manufacturer with a cresting-credit terminal year. |
| `SP` (SPECULATIVE) | Defensible alternative given the funding gap; `SP_G2_RUNWAY` is a BROKEN_THESIS effect. |

**The lens is owner judgement, never the lint's** (v3.47/v4.5) — recommending `IND`, not asserting it.

### Gate read under `IND`

| Gate | Reading |
|---|---|
| `INDC_G1_THROUGH_CYCLE` | **UNKNOWN** — no `pt_model`, so no documented normalized basis. Blocks. |
| `INDC_G2_BACKLOG` | **UNKNOWN** — 3 GW of G1 contracted for 2026 and "indicative demand >100% of 2027-28 capacity", but *indicative* is not contracted and no backlog YoY is measured. |
| `INDC_G3_SURVIVABILITY` | **UNKNOWN — and it straddles the line.** ND/EQ = **2.60x** on my basis (PASS), **3.61x** on the TipRanks basis (FAIL, `de>3 && core_loss_making`). Core *is* loss-making: the only positive EBITDA quarter is negative (≈ −$13.7M) ex the one-time $24.4M tariff refund. Fail closed → UNKNOWN. |
| `INDC_G4_VALUATION_NORM` | **UNKNOWN** (premium prerequisite) → **premium withheld → floor basis only.** |
| `GLOBAL_*` (6) | Un-affirmed → UNKNOWN → blocks. Owner must assert each explicitly. |

## 5. Valuation — floor basis only

EV $1.790B (net debt $504.3M). **EV/Sales: 1.77x FY26 · 1.31x FY27 · 0.98x FY28.**
**P/E: 87.3x FY27 · 9.92x FY28 · 6.82x FY29.**

The earnings lens is unusable before FY2028 (FY27 EPS $0.05 → n/m, "no P/E before profit").

| Rung | Floor | Upside | Annualised |
|---|---|---|---|
| YE2027 @ 10x FY2028 EPS $0.44 | **$4.40** | +0.8% | **+0.6%/yr** |
| YE2027 @ 12x | $5.28 | +21.0% | +15.3%/yr |
| YE2028 @ 10x FY2029 EPS $0.64 | **$6.40** | +46.6% | **+17.8%/yr** |
| YE2028 @ 12x | $7.68 | +76.0% | +27.4%/yr |

Two things discipline the multiple downward, so 10x is the honest floor and 12x is already generous:

1. **Consensus FY2030 EPS *falls* 8.66%** ($0.64 → $0.58). The street is itself modelling the
   45X credit step-down. A declining terminal year does not earn a premium terminal multiple —
   this is the `INDC_G1` doctrine ("a cresting cycle earns a LOWER terminal multiple") arriving
   in the estimates themselves.
2. **Dilution is unmodelled.** Raising the remaining $250M as equity at $4.365 is **57.3M shares,
   +19.5%**. Rebased, FY2028 EPS $0.44 → $0.368, and the YE2027 10x rung → **$3.68**. Whether
   consensus already embeds this is unknown and is a required capture (§7).

**Belief vs street.** Street published target **$9.80** (+124.5%) implies **22.3x FY2028 EPS** or
**1.86x EV/FY2028 sales**. Against the $4.40 floor the spread is **−123.7% of live price →
STREET RICHER**, by the widest margin of any name I have looked at in this book. The street is
underwriting a re-rating *and* on-time G2 execution *and* credit persistence.

## 6. The data center, valued honestly

What was actually announced: a municipal committee rezoned **161,000 sq ft** of the campus;
T1 holds a **50 MW** grid allocation and a queue position for **396 MW**; a 50 MW facility "could
be operational" in 2027 (N-0 power, needing UPS and step-down transformers); the 926K sq ft
building is large enough; 50-year site lease.

What was *not* announced: a customer, a partner, a capex budget, or financing. T1 says it is
"pursuing multiple pathways to monetize" and is "in conversations with various parties."

A fitted-out 50 MW DC runs roughly $400–700M of capex. **T1 cannot fund its own solar cell fab**,
so it will not build this — the realistic outcome is a **shell/power-rights sale or a JV**, worth
plausibly $100–300M of enterprise value ≈ **$0.34–$1.02/share** before tax and fees. Real, but an
option on a stranded asset, not a re-rating of the company.

**This must not enter the PT ladder** — that is the FEAT-TT-SUBS rule (v3.82): a `subsidiaries`
/SOTP line renders separately and is never auto-wired into `pt_model.net_cash_B`.

> **Unmeasured and material:** Giga Arctic's **carrying value**. FREYR sank well over $500M into
> it. If it is carried near cost and monetizes at $100–300M, the transaction books an
> **impairment**, not a gain. I could not source the carrying amount (sec.gov and every IR/wire
> domain are egress-blocked from this environment). Named, not guessed.

**Highest-leverage insight:** the market is pricing the headline; the equity is decided by the
G2_Austin financing. A $250M raise at $4.365 is ~19.5% dilution — larger than the entire
plausible value of the data-center option. **The option is worth less than the dilution needed to
survive to exercise it.**

## 7. Intake checklist — what a scoreable TE needs

**Owner captures (SA), the only two rows on your list:**
- `REV_VAL` / `EPS_VAL` — ✅ **supplied** (rev FY26-28, EPS FY26-30). Analyst counts default to
  the `INTAKE_COUNT_FLOOR = 5` floor.

**Owner-authored (`own` class — not a screenshot):**
- **Lens ruling** — `IND` vs `SP`.
- **Tier.**
- **≥3 pre-committed falsifiers.** Time-critical: pre-commitment must be on file *before* the
  qualifying observation (§6.4.1), and the next print is **2026-11-11**. Registering after that
  print is post-hoc by definition. Note a first write lands `PRECOMMITTED_PENDING` by
  construction (`commitFingerprint`, v3.77), so P4 nulls and the card is **PROVISIONAL, capped at
  B, and structurally never eligible** until a second write.
- The six `GLOBAL_*` assertions.

**Assistant-sourced (`ext`), still open:**
- Giga Arctic carrying value / any held-for-sale classification.
- Filed book equity and the exact debt schedule by instrument (settles `INDC_G3`).
- Backlog YoY (settles `INDC_G2`).
- Whether consensus EPS embeds the G2 financing dilution.

## Outcomes

- **No code changed.** No repo surface is wrong; TE simply has no record. This note is the
  deliverable.
- **Nothing written to KV.** Registering a book entry requires a lens and tier ruling (owner
  judgement), and authoring falsifiers myself would defeat the control they exist to be.
- **Corrections to my own first pass, recorded rather than edited away:**
  1. I initially computed net debt at **$624.3M** by adding the July convert to debt while
     leaving cash at the 6/30 figure — the same double-count TipRanks makes. A financing raise is
     net-debt neutral at issuance. Corrected to **$504.3M**, which flips `INDC_G3` from FAIL to
     a straddle.
  2. I first reached for the AI_INFRA harness on the strength of the headline. The harness's own
     guardrail refuses it, and the `AI_G3P` PEG of 0.014 would have manufactured a PASS from a
     zero-crossing. Re-routed to `IND`.
- **Robinhood `get_financials` returns FREYR-era rows only** (2021-2023, all `revenue: null`) —
  it has not picked up the post-rename entity. Do not trust that endpoint for TE.
