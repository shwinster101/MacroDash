# TT re-run — KRKNF (Kraken Robotics) · 2026-09-03

Owner asked for a TT run on KRKNF "given latest earnings transcript and recent drawdown", supplying
the Q2 2026 earnings-call transcript, SA consensus captures and a TipRanks overview.

KRKNF was **already in the book** (tier B, lens PH, rank *"#10 — UNMODELLED, prove-it"*) with **no
payload, no dots and no `lastRun` stamp** — so `runState` read NEVER RUN and `readiness()` blocked
the name. This is a re-run against new evidence, not an intake.

---

## 1. The answer: the pre-committed trigger has not fired

The stored book entry from the 7/29 handoff sets the entry condition explicitly:

> *"Watchlist — prove-it stage, entry on first post-Covelya quarter or overhang exhaustion."*

**Covelya closed 2026-07-02 — after Q2 ended.** The CFO states it directly on the call: Q2 results
include **no** Covelya contribution, and **Q3, ended 2026-09-30 and reported 2026-11-24, is the
first quarter of combined financial results.**

So the transcript the owner supplied is the **last standalone quarter**, not the first combined
one. The trigger the owner wrote down has not fired, and the thing it waits for is dated: 83 days
out at the time of this run.

That is the whole answer to "should the drawdown change anything." The drawdown is real
(−54.6% from the 52-week high, −38.0% since the 7/29 mark at ~US$5.95), but the condition the
owner pre-committed to is a *print*, not a price.

## 2. What the transcript actually says

| Fact | Value |
|---|---|
| Q2 consolidated revenue | **C$27M** (product ~C$17M, service >C$10M), +3.5% as reported |
| Q2 revenue ex a C$1.5M scope change | **~+10%**; product +11% Q2, **+25% H1**; service +6% / +9% |
| Q2 adjusted EBITDA | **C$5.0M, 18% margin** (20% and +26% growth ex the scope change) |
| Q1 2026 (for the H1 base) | revenue C$21.7M (+35%), adj EBITDA C$3.0M, cash C$108.7M at 3/31 |
| Balance sheet at 6/30 (**pre-close**) | cash **just over C$91M**, working capital C$152M, LT debt + leases **~C$40M** |
| FY2026 guidance (**reiterated**) | revenue **C$290–320M**, adj EBITDA **C$65–75M**, capex C$27–33M, >75% product |
| Order book | **C$355M** of 2026 product orders to date (Kraken + Covelya), +C$27M since the July update |
| Headcount | ~1,200 post-Covelya |
| Q3 report date | **2026-11-24** (CFO, on the call) |

### 2.1 The H2 hockey stick, measured

**H1 2026 revenue was C$49.0M** (C$21.7M + C$27.3M). Against C$290–320M:

- **H2 must deliver C$241–271M — 4.9x to 5.5x H1.**
- Adjusted EBITDA is starker: H1 was **C$8.0M** (16.3% margin); the guide implies **H2 C$57–67M,
  7.1x to 8.4x H1**, at an implied H2 margin of **~24–25% vs 16.3% achieved**.
- Even granting Covelya its guided **C$125–145M** half-year, legacy Kraken must roughly
  double-to-triple half-over-half. **FY2025 revenue was only ~C$102M** (backed out from the owner's
  own +200.93% capture), so **legacy H2-26 alone would need to rival all of 2025.**

Guidance was set at the 7/2 close and reiterated here, so it is steep rather than stale.

### 2.2 Management named the gap themselves

Asked directly what is missing in order activity to reach the **bottom end** of guidance, the CFO
pointed to a **KATFISH contract "we have to probably win."** An analyst then put it as a key
execution risk on the guide and management did not push back — "good visibility", "a couple things
we're working on to get over the line." H2 is also guided **weighted to Q4 over Q3**, concentrating
the risk into the final quarter.

### 2.3 The growth headline is consolidation, not momentum

Consensus FY2026 revenue growth of **+200.93%** is acquisition accounting — six months of Covelya.
Organic consolidated growth in Q2 was **~+10% ex the scope change** (+3.5% reported). Product
revenue +25% H1 is a genuinely respectable defence-supplier number, and it is a different order of
magnitude from the headline. Reading the headline as operating momentum is the single biggest
misread available on this name.

*(Reconciliation, not a contradiction: SA's summary header says +3.52% Y/Y as reported; the CFO
says "approximately 10%". C$27.32M + C$1.5M scope change over a ~C$26.4M prior-year quarter is
~+9.2%. Both are right on their own basis.)*

## 3. Two data-integrity findings, both material

### 3.1 Currency — the modelling trap

Kraken **reports in CAD**; the primary listing is **TSXV:PNG**, and Finnhub's own profile returns
`currency: CAD` for this ticker. But the board quotes the **KRKNF OTCQB line in USD** via
`/api/quotes`.

**A CAD-denominated ladder compared against a USD live price overstates every upside by ~39%** — a
systematic error, not a rounding one. The payload is therefore **modelled in USD**, converting
consensus at **CAD/USD 0.7195** (2026-09-02 spot band 0.717489–0.722596, i.e. USD/CAD ~1.39).
Cross-checked: US$3.69 = **C$5.13**, against TSXV:PNG at C$5.57 on 2026-08-27.

Ratios are FX-invariant (P/E 30.2x FY2027 either way) — **targets are not**. Consequence recorded
in the payload: every rung carries FX risk, and a 5% CAD move shifts each rung ~5% with no change
in the business. **This is the only name in the book whose reporting currency differs from the line
the board quotes.**

### 3.2 The TipRanks balance sheet is wrong for this name

The owner's capture shows **Total Cash 488.01M**. The CFO, describing the same date, says cash was
**"just over $91 million."** That is a **5.4x overstatement**. Total Debt 39.7M *does* reconcile
with the stated ~C$40M — and both figures are **pre-close** regardless. The screenshot's EV of
1.43B is also internally inconsistent with its own market cap, cash and debt, which would imply an
EV *below* market cap, not above.

Robinhood's profile likewise still reports **433 employees** against the **~1,200** stated on the
call. Both vendors are pre-Covelya. Prefer the transcript and filings for this name.

**Post-close net debt is genuinely unmeasured**: a C$125M term loan is drawn, Covelya cash has gone
out, and the CFO offers only "minimal net debt" — audibly correcting himself from "minimal debt",
which is a meaningful distinction with C$125M drawn. No post-close balance sheet exists until
2026-11-24. **This is exactly why no EV/S premium rung was built.**

## 4. Valuation — floor only, and the two lenses disagree

Price **US$3.69** (C$5.13) · **372,095,272 shares** · market cap **US$1,373M / C$1,908M**.

| Lens | FY2027 | FY2028 |
|---|---|---|
| P/E (GAAP) | **30.2x** | **21.4x** |
| EV/Sales (net debt ~0, **unmeasured**) | **3.37x** | **2.77x** |
| EV/adj EBITDA (FY2026 guide midpoint) | **~27.3x** | — |

**Ladder, floor-only at 20x:**

| Rung | Target | vs $3.69 | Annualised |
|---|---|---|---|
| YE2026 (FY2027 EPS US$0.1223) | US$2.45 | −33.6% | −71.5%/yr *(4-month window — a short-window artefact, not a rate)* |
| **YE2027 (FY2028 EPS US$0.1727)** | **US$3.45** | **−6.5%** | **−4.9%/yr** ← board horizon |

Street PT **US$7.68** implies **44.5x FY2028 EPS** / 5.8x FY2028 sales — **street richer** by a
wide margin.

**The two lenses disagree and I left the disagreement standing.** On GAAP EPS the name looks fully
valued and the floor sits *below* spot. On sales/EBITDA it looks reasonable. The gap is not noise:
Covelya purchase accounting loads intangible amortisation into GAAP EPS for years, and management
guides on adjusted EBITDA, so the GAAP line is structurally depressed relative to the cash the
business produces. **The floor is deliberately left on the harsher lens** — switching lenses to
improve the answer is the defect, not the fix.

No premium multiple is set, for two independent reasons either of which alone withholds it:
`PH_G4_DEMONSTRABLE_ECONOMICS` has no asserted input (it is plausibly *passable* here, unlike most
PH names, since adjusted EBITDA is genuinely positive — but plausible is not asserted), and an EV/S
premium rung needs measured post-close net cash, which does not exist.

### 4.1 Thin coverage on the year that decides it

Analyst counts are **measured** from the owner's capture, not defaulted to the v3.85 floor of 5:
**6 / 6 / 2**. **FY2028 carries two analysts** — below the ≥3 threshold — and FY2028 is exactly the
year the **YE2027 rung prices**, which is the rung the board's current auto horizon (2027) selects.
The operative target for this name rests on a two-analyst estimate.

## 5. Composite

**5.35 (V5.5 · G6.5 · P6.5 · M2.5 · R3.5)** on V30/G25/P20/M10/R15 → **C band**, against a stored
owner tier of **B**. Assistant-scored, owner to ratify. The gap between 5.35/C and the stored B is
the "prove-it" state expressed numerically, and Q3 is what resolves it.

P at 6.5 is the strongest pillar and is what genuinely distinguishes KRKNF from every other PH-lens
name here — it earns money at the EBITDA line today.

## 6. What landed in KV

| Write | Result |
|---|---|
| `POST /api/ticker-facts {symbol:"KRKNF"}` | profile LIVE (**currency CAD**), sharesOutstanding 371.41M, nextEarnings 2026-11-23. **candles MISSING** — "daily historical response was empty"; the Nasdaq adapter does not cover this OTCQB line. SEC fields MISSING (`SEC_USER_AGENT` still unset). |
| `PUT /api/deepdive?sym=KRKNF` | payload written, 16,467 B of 100 KB, **`lintPtModel` clean** — proven locally against the real `src/ptModel.js` before the write. |
| `PUT /api/tt` `If-Match: 24.5` | book **24.5 → 24.6**; `lastRun` stamped 2026-09-02 (was absent), rank rewritten, **5 dots** added (was 0). `board` carried forward. |
| `POST /api/allocation` | receipt refreshed, business date **2026-09-03**, read book 24.6. |

**Canonical position after the run:** gate **SEND IT**, ELIGIBLE NEXT DOLLAR still names **NBIS**
(YE2027 $570, +106.1%/yr). KRKNF now ranks — `unranked_at_horizon` is empty, so it has a rung at
the 2027 horizon — at **−4.9%/yr**, near the bottom. It carries no server score card, so the
quality rung vetoes it independently.

**`price_action` is stored as explicitly UNAVAILABLE** (`levels: null`) with the reason named,
rather than omitted or guessed — the WHEN leg reads UNREAD. A real read needs a CAD-line candle
source.

## 7. Open

**Owner-only:**
- **≥3 pre-committed falsifiers — the most time-boxed window in the book.** The qualifying
  observation is dated **2026-11-24**. Anything written after that print is post-hoc by definition
  (§6.4.1), and a first write lands `PRECOMMITTED_PENDING`, so it needs a second write to score.
- **Lens ruling.** PH is inherited and maps awkwardly: `PH_G1_CERTIFICATION` was built for aircraft
  type certification, and this is a profitable subsea defence supplier. QC or IND may fit better.
  Note the v4.9 `SELF_FUNDING` sentinel is now available to `PH_G2_RUNWAY` for an EBITDA-positive
  name like this. Flagged, not changed — the lens is the owner's ruling.
- **Premium multiple ruling**, if `PH_G4` is to be asserted.

**Assistant-open:** post-close net debt (arrives 2026-11-24), an FY2027 EBITDA consensus, and a
CAD-line candle source for the WHEN leg.

## Outcomes

- **No repo code changed.** The KV writes in §6 plus this note are the deliverable.
- **Falsifiers were not authored**, on the same reasoning as the TE run: §6.4.1 pre-commitment is a
  control against post-hoc rationalisation and an assistant writing the owner's falsifiers defeats
  it. The tier (B) and lens (PH) were left exactly as the owner set them; the disagreement with my
  5.35/C composite is recorded rather than resolved unilaterally.
- **Corrections and judgement calls, recorded rather than edited away:**
  1. I initially reached for a CAD-denominated model because the transcript and consensus are both
     CAD. Checking what the board actually quotes (the USD OTCQB line) showed that would have
     inflated every upside by ~39%. Converted to USD and documented the FX basis and its risk.
  2. I treated KRKNF's short-window YE2026 rung **differently from TE's** and the distinction is
     deliberate: TE's YE2026 rung was a near-zero-EPS *crossing artifact* producing a meaningless
     $0.50 target, so it was dropped; KRKNF's is a **real target on a real estimate** that merely
     sits four months out, so it is kept with the annualised rate flagged as a short-window
     artefact. Different defects, different treatment.
  3. `nextEarnings` disagrees three ways — transcript 2026-11-24, facts adapter 2026-11-23,
     TipRanks 11.30.26. The transcript is primary and is what the payload stores; the others are
     recorded beside it.
  4. `ref_px` is stamped 2026-09-02 while the receipt's business date is 2026-09-03 — one session
     old at write time, stated in the basis string. The board compares against its own live quote
     regardless.
