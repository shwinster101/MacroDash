# CRDO — Goldman Sachs Communacopia transcript (2026-09-10) → model applications

**Status: findings + proposed model changes. NO KV write was made** — this session holds no
`TT_PIN`, so `tt:dd:v1:CRDO` and `tt:score:v1:CRDO` were unreadable (both `401 pin required`,
probed). Everything below about the STORED model is recovered from the changelog (v4.3.0,
v4.5.0, v4.6.0, session log 2026-08-22) and is labelled "last known"; the owner (or a session
with the PIN) applies the changes. Source transcript: SA transcript of the 9/10 fireside
(Brennan + Fleming, Jim Schneider), 17pp.

## 0. What materially changed since the 8/22 CRDO work

| Fact | 8/22 state (last known) | Now (measured 9/12) | Source |
|---|---|---|---|
| Price | ~$230 (card minted at AI_G3P PASS, PT $328) | **$162.98** (9/11 close $162.95) | RH quote |
| Drawdown | — | −27% since 8/31 ($226.19), −20% on 9/2 alone (30.1M shares) | RH bars |
| vs MAs | above | **below all three**: 50d $223.1 · 100d $219.6 · 200d $175.9 | RH SMA |
| RSI-14 / ATR-14 | — | 33.2 / $16.38 (~10%/day) | RH |
| Q1 FY27 (8/1) | print pending (falsifier window "needs ≥3 by 9/1 — has 1") | rev **$479.0M** (+10% q/q, +115% y/y) · non-GAAP EPS **$1.20** vs $1.12 · non-GAAP GM 68% · GAAP GM 64.5% | RH financials, PR coverage |
| Q2 guide | — | **$525–535M** (+11% q/q) · non-GAAP GM 67–69% | PR coverage |
| FY27 guide | — | **>85% y/y** (≥$2.47B off $1,335M FY26) · optics **>$600M** (ZF · PIC · DSP each >$100M) · non-GAAP net margin **~50%** · opex +55% | 9/1 call coverage |
| Cash + ST inv | ~$1.44B (5/2) | **$764M** (8/1): $466.9M cash + $297.4M ST inv | 10-Q XBRL |
| Why | — | DustPhotonics closed May: **$770M cash + 0.8M shares**, contingent up to 2.8M shares + $31.6M | PR coverage |
| Diluted shares | — | **194.4M** Q1 (184.6M y/y, +5.3%); 188.0M outstanding | 10-Q XBRL / RH |
| SBC | — | **$88.0M/qtr** = 18.4% of revenue (was $35.5M y/y) | 10-Q XBRL |
| OCF | — | **$90.2M** on $236.3M non-GAAP NI = **38% conversion**; capex $7.3M | 10-Q XBRL |
| Concentration (rev) | hinge RED "87% top-4" | Customer A **43%** (50% y/y) · B **28%** (35% y/y) → top-2 **71%**; only two ≥10% customers tagged in Q1 | 10-Q XBRL |
| Concentration (AR) | — | A **57%** · B **28%** of receivables = 85% | 10-Q XBRL |
| Engine 0 (9/12 cached) | — | TAILWIND · HIGH · FULL · flip clear; Kalshi hold 20 / cut 2 / **hike 78** · 10Y m1 +0.28 spiking | /readout.json |
| Next print | 9/1 | **2026-11-30 pm** (tentative), Q2 EPS est $1.23 | RH earnings |

The tape did exactly what the belief ledger's divergence flag (v3.33) was built to catch: **estimates
up, price down**. Aggregator FY28 EPS consensus moved $8.62 → $9.63 over 90 days while the stock
lost 27% in eight sessions. The 9/2 sell-off coverage names the causes: GAAP GM 68.2% → 64.5%
(Dust amortization), opex +110% y/y, R&D +118% y/y, and concentration. None of those is a demand
fact. The transcript adds **zero evidence of a demand or share break** — so today this reads as a
sentiment/quality derate, not a thesis break. That is a claim to be FALSIFIED on 11/30, not
believed now (section 3).

## 1. What the transcript says that the 9/1 call did NOT (best effort — the 9/1 transcript hosts
are egress-blocked here; coverage of the call was used as the baseline)

1. **The back-half SHAPE is now explicit**: Fleming — "about 11% sequentially into Q2 … call it
   20% into Q3, 30% into Q4. That sets you up where $1 billion quarter is within our sights within
   early fiscal '28." The 9/1 coverage carried only ">85%" and "10%+ each quarter". Arithmetic:
   479 → 532 → 638 → 830 = **$2,479M = +85.7%**, i.e. the 20/30 shape IS the 85% guide, made
   quarterly. This is the single most useful thing in the document because it is DATED and
   FALSIFIABLE twice before FY-end (the Q3 guide on 11/30, the Q4 guide in early March).
2. **Optics production ramp quantified across FY28**: "hundreds of thousands of units per month
   by end of this fiscal year … double and then even triple by the end of fiscal year '28 … even
   go beyond that in fiscal '29." The 9/1 coverage has the FY27 rate only.
3. **ALCs (microemitter, 30 m reach, 75% smaller cable)**: demo at **OCP next month (Oct 2026)**,
   then qualification, **production FY28**. A dated key_date.
4. **FY28 product set named**: ALCs + OmniConnect (memory wall / fan-out) "take off" in FY28 —
   Brennan explicitly frames FY28 outperformance on these, not AECs.
5. **Opex leverage timing firmed**: "top line is growing about 50% faster than our OpEx … you may
   see us get back to a 2:1 ratio as we enter fiscal '28." (9/1: "move back toward".)
6. **ZeroFlap provenance and customer set**: xAI (Memphis: cluster bring-up 5 days vs 6–8 weeks,
   99.9% uptime), Oracle (>7 m links, telemetry DSP), Microsoft (5-yr-old ToR failover cable).
   Oracle and neoclouds are the diversification datapoints against the 71% top-2.
7. **Margin defence for optics is ASP + COGS, not volume**: non-commodity SKUs, "only vertically
   integrated player" (own DSP + own PIC), more make-vs-buy coming. Fleming: "maintain our margin
   profile as we proceed forward."
8. **Lumpiness pre-explained**: "each one of our customers is kind of a market in and of
   themselves … surging and then pausing." Read: expect 10%-customer swings quarter to quarter;
   a single-quarter dip at Customer A is NOT, by itself, a falsifier.
9. **Copper still >95% of DC connections** (unchanged ratio over 12 years); optical modules 60M
   units this year → 175M by 2030 (industry forecast he cites). AEC = the ≤7 m segment of that.
10. **M&A posture**: three deals so far (microLED team, CoMira, Dust); further deals must be
    "differentiated system-level"; "not bounded" by connectivity. Cash is now $764M, so the next
    deal of Dust's size is stock or debt.

## 2. Model applications, ranked by leverage

### 2.1 (HIGHEST) Commit the falsifier set NOW — before 11/30
The card is bound PROVISIONAL (B-cap, never eligible) until ≥3 pre-committed falsifiers carry
qualifying observations. On 8/22 CRDO had **1 written against a ≥3 floor and a 9/1 window**; that
window is CLOSED. Anything written now is post-hoc for the 9/1 print and pre-committed for
**11/30**. `commitFingerprint` enforces the ordering server-side — the first write is
PRECOMMITTED_PENDING by construction, the 11/30 observation scores it. Draft conditions (all
derived from the transcript's own numbers, none owner-picked):

| id | condition (GREEN / AMBER / RED) | qualifying observation | kill |
|---|---|---|---|
| `seq_shape_q3` | Q3 FY27 revenue GUIDE (given 11/30) ≥ **+18%** q/q on Q2 actual → GREEN · +12–18% AMBER · **<+12% RED** (85% FY guide arithmetically broken) | 11/30 print | yes |
| `gm_hold` | non-GAAP GM ≥ **67%** Q2 actual and Q3 guide midpoint ≥ 66% → GREEN · 65–67 AMBER · **<65% RED** (optics-commodity thesis wins) | 11/30 print | no |
| `optics_600` | Q2 optics revenue run-rate consistent with >$600M FY (≥ ~$110M in Q2 or management reiterates each-leg >$100M) → GREEN · reiterated without numbers AMBER · **guide cut RED** | 11/30 print | yes |
| `opex_leverage` | non-GAAP opex growth q/q < revenue growth q/q in Q2 → GREEN · equal AMBER · **opex growing faster RED** | 11/30 print | no |
| `cash_conversion` | OCF ÷ non-GAAP NI ≥ **60%** in Q2 (Q1: 38%) → GREEN · 40–60 AMBER · **<40% two quarters running RED** (AR 57% in one customer) | 11/30 print (10-Q) | no |
| `alc_ocp` | ALC demo shown at OCP (Oct 2026) with a named customer or spec sheet → GREEN · shown, no customer AMBER · **not shown / slipped RED** | OCP, Oct 2026 | no |
| `conc_top2` | top-2 revenue share ≤ **71%** (Q1 level) → GREEN · 71–80 AMBER · **>80% RED** (re-concentrating) | 11/30 10-Q | no |

Seven fits the 8-cap. Kill flags only on the two that break the FY27 guide arithmetically.

### 2.2 Update `underwriting_inputs` / capital block (measured, no judgement)
- `net_cash_B`: **0.76** (was ~1.44; Dust $770M cash). Earnings lens — the rung math does not
  read it, but P3 balance-sheet evidence, the NOCASH lint and `capital` prose do. Record the
  contingent: up to 2.8M shares + $31.6M.
- `share_count_M` schedule: diluted **194.4** now; FY27 exit ~197–198 (SBC ~$350M/yr at ~$165 ≈
  2M shares/yr gross + Dust earn-out) → FY28 ~200–202. A flat schedule understates dilution.
- `concentration` hinge: re-stamp with Q1 measured (A 43 · B 28 · top-2 71%; AR A 57 · B 28).
  Keep AMBER, not RED: the y/y direction is DOWN (85% → 71% top-2), and the transcript names
  Oracle + neoclouds on ZeroFlap. RED only if `conc_top2` fires.
- `key_dates`: **2026-10 OCP (ALC demo)** · **2026-11-30 Q2 print** · early-Mar-2027 Q3 print (Q4
  guide = the 30% claim) · FY28 Q1 (Aug 2027) = the $1B quarter claim.
- Quality note for P3: SBC is **37% of non-GAAP NI** (88/236). The "~50% non-GAAP net margin" is
  pre-SBC; GAAP net margin was 27.0% in Q1. State it; do not re-score the pillar on it (the
  pillar's enums are what they are), but it belongs in the evidence line.

### 2.3 Estimates — the OWNER's capture (standing rule: fwd rev/EPS come from SA screenshots)
Guidance-DERIVED reference points, formulas stated, for the owner to check the SA capture against:
- FY27 revenue ≈ **$2.48B** (479·[1 + 1.11 + 1.11·1.20 + 1.11·1.20·1.30]); non-GAAP NI at 50% ≈
  $1.24B; ÷ ~196M diluted → **EPS ≈ $6.3**. At $163 that is **~26x FY27**.
- FY28: if Q1 FY28 = $1.0B and +10%/qtr → $4.6B; a conservative $4.0B at 48% NM ÷ 200M →
  **EPS ≈ $9.6** — which is exactly the aggregator FY28 consensus ($9.63), so the street is
  already pricing the $1B-quarter claim with a flat back half. At $163 that is **~17x FY28**.
- The aggregator FY27 revenue figure found ($2.154B) is STALE (pre-guide) — do not store it.
- Peer read the transcript invites: the market pays 17x FY28 for a company guiding +85% with
  50% net margins. AI_G3P (PEG ≤1.0, growth ≥20%, ≥3 analysts) should PASS by a wide margin on
  any reasonable capture; the v4.6 PASS at 0.52 PEG will get EASIER, not harder.

### 2.4 The PT model
Last known (8/22): AIP lens, `pe_premium_multiple`, premium **$328** (P1 7.37) at ~$230. The
transcript raises no reason to cut the multiple schedule — the ramp got MORE specific and the
margin defence got MORE specific. It gives two reasons to widen the RANGE of outcomes: (a) the
back half is 60% of FY27 revenue and is guided, not booked; (b) 71% top-2 with AR 57% in one
payer. **Do not touch the multiple on a transcript**; let the 11/30 falsifiers move it. What DOES
need to change mechanically: the share-count ramp (2.2) and any rung that reads FY27 EPS from a
pre-guide capture.

### 2.5 WHEN leg (`price_action`) — the tape is bearish and the levels are known
- px **162.98** · 50d 223.10 · 100d 219.64 · 200d **175.89** · RSI 33 · ATR 16.4.
- 63-day swing: hi **$308.67** (6/22) · lo **$160.44** (9/11, the post-print base; 9/2 low $161.95).
- `computeTechRead` will read **BEARISH** (below all three MAs; alignment −3) — and by design
  that is REPORT, never veto.
- Entry candidates for the owner to COMMIT (kind matters, set_at stamps the commitment):
  `pullback` at **$160** (the 9/2–9/11 base; a close below it re-opens the $86–$120 spring
  range), or `breakout` on a **reclaim of the 200d (~$176)**. Committing both is fine; the
  stamp is what makes the WHEN leg measurable instead of narrated.

## 3. What NOT to do (with the reason)
- **Do not re-score the composite off this transcript.** A conference fireside is management
  narrative; the engine's inputs are prints and 10-Qs. The 11/30 print is the qualifying
  observation for everything above.
- **Do not lower the tier on the drawdown.** The book's own ledger rule: est↑ px↓ is the pattern
  to WATCH, not to act on; acting on it is what the divergence flag was built to stop.
- **Do not read the $1B-quarter claim into FY28 rungs as a fact.** It is "within our sights" —
  store it as management guidance with the date, weight it in the falsifier set, not the ladder.

## 4. TT line (protocol) — as of 2026-09-12, store unreadable from this session
**CRDO — Composite: UNAVAILABLE (server card unreadable — no TT_PIN in session; last known
legacy 7.23 on 8/20, card P1 7.37 / UNSCORABLE→PROVISIONAL-bound on 8/22) · PT: UNAVAILABLE
(last known owner-model premium $328 @ AIP lens, 8/22 — pre-print, pre-27% drawdown, share
count and net cash now stale) · Call: WAIT — canonical ELIGIBLE NEXT DOLLAR line cannot be
read; independently, the falsifier set is <3 committed and the 9/1 window is closed, so the
card cannot be SCORED before 11/30 under §6.4.1.**

## Outcomes (same day — the owner supplied the PIN mid-pass; the store was then READ)

**The survey above was WRONG about the stored state, and the corrections stand beside it:**
- **Falsifiers: three graded at the 9/1 print, not one written.** A 2026-08-24 owner-directed
  sprint committed `revenue_guide_q1fy27` and `gross_margin_q1fy27` beside the 8/18
  `customer_concentration_q1fy27`; a 9/4 session graded them GREEN · GREEN · AMBER. §2.1's
  "1 of 3 written, window closed" was the 8/22 state, three sessions stale.
- **The card is SCORED 8.32 / A, actionability FULL** (`tt-underwriting-v2.6.0`, 9/4): P1 7.44
  PREMIUM (target **$328**, YE2027, +30.5%/yr at the stale $230.57 price basis), P2 8.85, P3
  8.66, P4 8.33. Not PROVISIONAL. AI_G3P PASS (25.3x FY-Apr2028 EPS $9.12 on +48% growth).
  Composite 7.6 (V8.5 G9 P7 M3.5 R7, 9/4), not 7.23.
- **The G2 concentration gate is owner-overridden (8/18) and the hinge is AMBER** off the call's
  33/28/13/10 disclosure (top-3 74%, top-4 84%).
- **Stored consensus already covers what §2.3 asked the owner to capture**: FY-Apr 2027–2031
  revenue 2.46/3.69/4.80/5.79 and EPS 6.15/9.12/11.29/12.58/14.72 (SA, 7/27, refreshed 8/18);
  street target mean $288.50 (12 post-print rows, 9/2). The 9/1 guide reproduces FY27 EPS
  bottom-up ($6.18 vs $6.15) — the hinge note already says so.
- **The H2-ramp gap §2.1 fills IS already named on the card**: hinge "H2 optical ramp /
  inventory conversion" is UNKNOWN with `next_observation: Q2-FY2027 print` and the explicit
  line "needs an owner-authored pre-committed falsifier before the Q2 print." So the seven
  drafts stand, re-scoped: they are the 11/30 commitment the card itself asks for.

**What the read ADDED that the transcript could not:**
- **A concentration DISCREPANCY.** The 10-Q XBRL tags Customer A at **43%** of Q1 revenue
  (`ConcentrationRiskPercentage1`, SalesRevenueNet, 2026-05-03→08-01) and Customer B at 28%;
  the stored hinge and falsifier grade record the call relay as **33%** / 28% / 13% / 10%. If
  the filing's 43% is right, top-3 = 84% and the falsifier's RED clause (">80%") is MET, not
  AMBER — a grade may be wrong. Only two ≥10% customers are tagged in the quarter, which also
  disagrees with "four" on the call. Needs the primary transcript or the 10-Q text (both
  egress-blocked here) before anyone re-grades. Filed as the highest-priority check.
- **Stale measured inputs on the card:** `capital.cash_B 1.44 / net_cash_B 1.4` predates the
  Dust close (cash + ST investments $764M at 8/1); `AI_G1_BUILDOUT` note "$1.4B cash";
  `price_action` stamped 8/24 (all three MAs are now ABOVE price, the stored ma50 241.5 is 18
  points off); P1 price basis 8/23 $230.57 vs $163 live — TARGET_STALE will fire.
- **The canonical call today is WAIT, and CRDO is not the reason.** `/api/allocation`
  (tt-alloc-v3.1.0, 9/12): state WAIT, macro gate **TOUCH_GRASS on the circuit rung** —
  "circuit ARMED asserted 16d ago (limit 7d)" — plus context blockers "positions snapshot 19d
  old" and "account record 19d old". `eligible: null`. Re-assert the circuit in ◧ SESSION and
  re-sync positions; then the ladder can evaluate CRDO at all.

**Corrected TT line (2026-09-12):**
**CRDO — Composite: 8.32/10 A (canonical `/api/score` card, SCORED, FULL; legacy asserted 7.6) ·
PT: $328 (owner model, premium 36x FY-Apr2028 EPS $9.12, YE2027 rung; street 12-mo mean $288.50,
labelled separately) · Call: WAIT — the allocation ladder vetoes on an unresolved circuit
(ARMED, 16d stale) before it reaches any name; secondary, the concentration grade needs the
43%-vs-33% discrepancy resolved.**

**Trade-off the owner decides, stated not assumed:** registering the seven 11/30 falsifiers on
the SCORE record makes them PRECOMMITTED_PENDING, and one pending required hinge nulls P4 —
the card would read PROVISIONAL (B-cap, never eligible) from the write until the 11/30
observation. That is §6.4.1 working as designed and it is what the 8/24 sprint accepted for
the 9/1 print. This pass therefore writes the drafts to the PAYLOAD (`falsifiers_v2_draft`,
which the engine does not read) plus the measured capital/price facts, and leaves the score
record's registration to the owner.

- Store writes this pass: see the "Store write" section appended below once landed.
- Still to record once the 9/1 transcript is readable: which of §1 items 1, 2, 5 were in fact
  said on the call, and the 43%/33% resolution.
