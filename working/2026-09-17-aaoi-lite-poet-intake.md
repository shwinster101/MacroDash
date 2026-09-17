# 2026-09-17 — TT intake: AAOI vs LITE vs POET (what the owner still has to capture)

Owner ask: *"TT AAOI vs LITE vs POET what info needed? Look online to source info before request."*

Rule applied (FEAT-TT-SOURCING, v3.85): the owner captures ONLY the forward revenue + EPS
consensus VALUES (SA screens `REV_VAL` / `EPS_VAL`). Analyst counts stamp at the ≥5 floor.
Everything else — price, margins, runway, debt schedule, P/E cross-check — is the assistant's
to source (`ext` rows) or the owner's THESIS work (`own` rows: `pt_model`, falsifiers).
Everything below is sourced; the capture list at the bottom is what is left.

**Not verified here:** the live KV book (PIN-gated). LITE has a stored payload since v3.39/v3.46
(SA FY2027 $16.67 EPS on file as of the 2026-08-13 session log) and may already clear most rows;
AAOI and POET are assumed NOT in the book. Run `intakeChecklist()` on the terminal to confirm.

## 1. Sourced — API (Robinhood tools, 2026-09-17 ~11:10 ET)

| | AAOI | LITE | POET |
|---|---|---|---|
| Last trade | $97.43 | $907.84 | $7.565 |
| Prior close (09-16) | $96.74 | $919.40 | $7.40 |
| Market cap | $8.27B | $81.8B | $1.31B |
| Shares out | 84.9M | 90.1M | 173.1M |
| 52w range | 18.50 – 233.67 | 144.52 – 1,085.68 | 3.87 – 20.81 |
| Trailing P/E | −124 (loss) | −11.2 (GAAP loss, see note) | −12.7 (loss) |
| P/B | 4.9 | 17.5 | 1.5 |
| Next print | 2026-11-05 pm (tentative) | Q1 FY27 ~early Nov (not in tool) | 2026-11-12 pm (tentative) |

Reported financials (Robinhood `get_financials`; POET returned **null** — sourced from the 6-K below):

- **AAOI** — Q2-26 rev $191.9M (+86% YoY, 5th straight record), GP $53.2M (27.7%), GAAP NI −$22.8M
  (−11.9%); Q1-26 $151.1M; FY2025 $455.7M / NI −$38.2M. Non-GAAP EPS $0.06 vs $0.01 est.
- **LITE** — FQ4-26 (Jun-27) rev $1,006.3M (+109% YoY), GP $477.3M (47.4% GAAP), **GAAP NI −$7.16B**
  (a non-cash item — the tool's −711% net margin is NOT operating; non-GAAP EPS was $3.23 vs $2.97 est).
  FY2026 rev $3.014B (+83%). FQ3-26 $808.4M / NI +$144.2M; FQ2-26 $665.5M.
- **POET** — Q2-26 rev **$569,925** (+13% QoQ, +112% YoY, 6th sequential increase); NI −$11.3M
  (−$0.07/sh, in line); operating cash flow −$12.2M for the quarter.

## 2. Sourced — web (`ext` rows: RUNWAY · DEBT · MARGINS · PE)

### AAOI
- **Guidance**: Q3-26 rev $255–290M (est ~$278M), non-GAAP EPS $0.11–0.26 (est $0.28 — EPS guide
  BELOW street); FY2026 rev ~$1.1B. Q3 midpoint = +130% YoY.
- **Cash**: $508.8M cash+investments at 6/30; ATM raised ~$538.8M (capacity expansion).
- **DEBT (10-Q 6/30/26)**: $124.9M principal 2.75% convertible senior notes **due 2030**
  (conv. price ≈ $43.31 → deep ITM at $97, 23.0884 sh/$1k ≈ 2.88M shares); non-current LTD $1.7M.
  The old 5.25% 2026 notes were exchanged Dec-2024 (≈$76.7M → $125M of 2030s + 1.49M shares).
  → **Net cash ≈ +$380M** ($508.8M − $129.1M carrying) BEFORE the ATM proceeds; likely > +$900M
  post-ATM — confirm the post-ATM figure on the Q3 10-Q (the ATM straddles quarter-end).
- **MARGINS**: GAAP GM 27.7% (Q2); GAAP op margin negative; non-GAAP net margin ~2.9% (5.5/191.9).
  Op-margin LEVEL for P3 needs the non-GAAP op-income line from the 8-K — not in the tool feed.
- **PE cross-check**: street 2026 EPS ~$0.88 / rev ~$1.03B (5 analysts); 2027 rev ~$1.66B.
  PTs are wildly dispersed — $94.66 avg (WallStreetZen) / $151.3 (S&P, 6 analysts) / $172.75
  (TradingView). At $97: ~110× 2026E, so the sales lens (`ev_s_multiple`) is correct until a
  2027 EPS lands (the RKLB crossing rule, `LENS_MAX_PE`).
- **Regime**: PREPROFIT-crossing (Q2 first non-GAAP profit). Runway irrelevant — net cash, OCF turning.

### LITE
- **Guidance**: Q1 FY27 rev $1.225–1.275B (+130% YoY mid), non-GAAP op margin 39.5–40.5%,
  **non-GAAP EPS $4.05–4.35**. Annualised: $4.20×4 = $16.80 vs the stored FY2027 $16.67 → the
  stored estimate is already stale-conservative (flagged 2026-08-13; still true).
- **Cash**: $2.74B cash+ST investments (down $0.43B QoQ, driven by converts converting).
- **DEBT (FY26 10-K)**: converts carrying **$3,182.5M** across 2026 / 2028 / 2029 / 2032 series —
  $172.2M of 0.50% 2028s left after the June-2026 exchange ($650.4M swapped for stock); $1.265B
  0.375% 2032s (issued 2025-09-08, matures 2032-03-15); the 2026 and 2029 series balances need
  the 10-K debt note read directly. → **Net debt ≈ −$0.44B** ($2.74B − $3.18B) at face; most
  series are deep ITM at $908 so economic net debt is near zero but DILUTION is the real term.
- **MARGINS**: non-GAAP GM >50% (Q4), non-GAAP op margin ~40% guided. PROFITABLE mode.
- **PE cross-check**: consensus PT ~$1,140–1,148 (24 analysts, S&P), +24% vs $919. At $908 ≈
  54× annualised Q1-FY27 EPS. Earnings lens (`pe_premium_multiple`) — already the book's lens.
- **Book status**: v3.39 model, `AIP` lens post-v4.6 ruling, `AI_G3P` PASS, card 7.03/A as of
  8/2026; entry-discipline hinge was RED at $866 vs its $680 zone top — now $908, still RED.

### POET
- **Guidance**: none numeric for FY2026. Optical-engine production ramp "on schedule for H2-2026";
  substantial qualification units shipping through the rest of 2026; **Lumilens $50M initial PO**
  (EOI optical engines) inside a JDA that "could scale to $500M+ over five years" — engineering
  samples late-2026, production ramp aligned to hyperscaler deployments in **2027**.
- **Cash**: **$796.3M** cash + ST investments at 6/30 (after a $400M May raise priced above market).
- **DEBT**: none material disclosed; net cash ≈ +$796M. Burn ~$12M/qtr OCF → runway is not a
  constraint (**~65 quarters** at the current burn; the ramp will raise it — RUNWAY row = SELF-
  FUNDING is WRONG here, it is cash-funded burn: store `runway_months` as a large number with the
  formula, not the sentinel).
- **MARGINS**: not meaningful at $0.57M revenue. PREPROFIT mode; second series must be
  `YEARS_TO_CROSSOVER` (v3.79) — consensus shows +$15M profit in 2027, so crossover year = 2027
  on the current street. Thin: **2 analysts** cover it (Simply Wall St); one Buy at $17.50
  (TipRanks); other aggregators $7.80 avg / $13.0 avg. **⚠ Analyst count is BELOW the ≥5 floor** —
  the owner rule cannot be stamped blindly; stamp the real count (2) and expect P2 thin-coverage
  dimming / duration blockers.
- **Revenue estimates (web, unverified)**: ~$10M 2026 → ~$82–100M 2027. At $1.31B cap that is
  ~13–16× 2027E sales on a company printing $0.57M/qtr — the whole value is the Lumilens/EOI ramp.

## 3. What the owner still has to CAPTURE (the `REV_VAL` / `EPS_VAL` rows only)

Per FEAT-TT-SOURCING the owner's screenshot list is exactly two rows per name — the SA
**Consensus Revenue Estimates** and **Consensus EPS Estimates** value columns:

1. **AAOI** — FY2026 · FY2027 · FY2028 revenue ($B) and EPS. Fiscal = calendar.
2. **POET** — FY2026 · FY2027 · FY2028 revenue and EPS (EPS will be negative until ~2027; that
   is the crossover input, capture it anyway). Fiscal = calendar.
3. **LITE** — only a REFRESH: FY2027 · FY2028 · FY2029 (fiscal year ends late June). The stored
   FY2027 EPS $16.67 predates the Q1-FY27 guide that annualises above it.

Nothing else is owed by the owner for intake. `COUNTS` stamps at the floor for AAOI (5 covering)
and LITE (24); **POET gets its real count of 2** — the floor would fabricate coverage.

## 4. Owner THESIS work (`own` rows) — needed before a card can SCORE

- `pt_model` for AAOI and POET (LITE has one): lens + multiple schedule + share count + net cash.
  Suggested starting points, NOT rulings: AAOI sales-lens (`ev_s_multiple`, 84.9M → ~88M diluted
  incl. the 2030 converts, net cash post-ATM); POET sales-lens on FY2028 (173M sh, +$0.8B cash).
  `suggestMultiple()` can invert a street PT once the estimates are stored (v4.2).
- Falsifier sets (3–8 pre-committed hinges) for AAOI and POET. Candidates from the sourcing:
  AAOI — Q3 rev ≥ $255M floor / non-GAAP EPS ≥ $0.11 / FY26 $1.1B reaffirmed / GM ≥ 27%.
  POET — Lumilens engineering samples delivered by 12/31/2026 / first production-unit revenue
  quarter ≥ $5M / Q4-26 revenue ≥ $1M / burn ≤ $15M/qtr.
- Lens assignment for the two new names (`admin.html` card): both AI-optical; neither is a
  neocloud, so `AIP` (PLATFORM) for AAOI if it is scored on the AI route, but the `AI_G3P`
  prerequisite needs a positive FY+1 EPS and ≥3 analysts — AAOI clears both on the 2026 street,
  POET clears neither (2 analysts, negative EPS) → POET on the AI route will read UNKNOWN on
  the premium prerequisite by construction; the `IND`/`QC` routes fit it worse.

## 5. Binary calendar (report-only)

- AAOI Q3-26: 2026-11-05 pm (tentative). Outside the 10-day window today.
- POET Q3-26: 2026-11-12 pm (tentative). Outside.
- LITE Q1-FY27: early Nov (not returned by the tool; check IR). Outside.
- POET said "further updates anticipated in September" on the ramp — a non-dated soft binary.

## 6. Sources

- AAOI Q2-26 8-K / results: sec.gov Archives 0001158114/000168316826006055; globenewswire 2026-08-06;
  10-Q 6/30/26: sec.gov 000143774926026278; Dec-2024 exchange: investors.ao-inc.com.
  Estimates: simplywall.st / stockanalysis.com / wallstreetzen / tradingview.
- LITE FQ4-26 results: investor.lumentum.com; FY26 10-K: sec.gov 0001633978/000162828026057358;
  2032 notes 8-K 2025-09-08; 2028-note exchange: stocktitan. PTs: stockanalysis / public.com.
- POET Q2-26 6-K: sec.gov 0001437424/000117184326005485; Lumilens JDA/PO 6-K 000117184326003487;
  tipranks / simplywall.st / insidermonkey for the raise, burn and analyst count.
- Quotes, fundamentals, financials, earnings dates: Robinhood MCP tools, 2026-09-17.

## Outcomes

_To append when the packets are confirmed and the cards run._

## Outcomes — 2026-09-17, second pass (owner captures landed)

**Captured by the owner (SA screenshots, 09:18–09:19 ET):**

| | AAOI (Dec FY) | LITE (Jun FY) |
|---|---|---|
| Revenue | 2026 $1.04B · 2027 $2.66B · 2028 $3.96B | FY27 $6.32B (23) · FY28 $9.61B (21) · FY29 $13.70B (8) |
| EPS (normalized) | 2026 $0.68 · 2027 $4.60 · **2028 $8.91 — 1 analyst (owner note)** | FY27 $21.67 (25) · **FY28 $39.70 — 1 analyst** (= the High) · FY29 $47.44 (7) |

POET: no street capture. Owner attached the SA thesis (Zourmpanos, 2026-08-20, STRONG BUY at $8.27):
Lumilens $50M PO → $500M/5yr framework, Lumilens funded ($700M at $5.51B) and shipping to a
hyperscaler; author's frame ≈ $100M/yr Lumilens rev × 10–15× + $796M cash ≈ $2B equity. Risks the
article and its thread carry: Marvell cancelled every PO in Apr-2026 after the CFO's confidentiality
breach; Jones v. POET class action (PFIC certification + the interview); Wolfpack short report;
CFO retiring; Zacks' (company-paid) $450M 2029 revenue is unofficial. Latest status (Sep-2026): no
new print — CIOE exhibit 9/9–9/11, "production ramp on schedule for H2-2026", 1M units/month
capacity target by end-2027, ~50 hires, $50M H2 capex; the promised September update has not
landed as of 9/17.

**Corrections to the first pass:** the LITE stored FY2027 EPS ($16.67) is superseded by the
capture ($21.67) — consensus already assumes a ramp ABOVE the Q1-FY27 guide run-rate ($16.2–17.4
annualised), so the "stale-conservative" read in §2 inverts: the street is now ahead of guidance.
POET's 2027 street revenue (~$90M, 2 analysts) is kept as consensus; 2028 is thesis-derived and
marked `derived`, never presented as street.

**Thin-coverage rule applied (≥3 analysts, the standing rule):** AAOI FY2028 EPS and LITE FY2028
EPS are stored under `consensus.thin_coverage_excluded`, never deleted, and no rung prices them.
Consequence: AAOI has ONE rung (YE2026), LITE has YE2026 and YE2028 (no YE2027), POET has YE2026
and YE2027. The auto horizon (deepest year every name reaches) is therefore **YE2026**, 0.29 years
out — inside `ANN_MIN_Y` today but rolling on Oct 1 — so every annualised rate below is the
short-rung distortion the v3.81 warning exists for. Read the RAW upside, not the %/yr.

**Draft payloads** (paste-ready, `working/payloads/2026-09-17-<SYM>-deepdive-draft.json`; every
multiple is ASSISTANT-SET and says so in `multiple_ruling`; all hinges are `unknown` drafts, not
pre-committed until the owner writes them through the terminal):

| Rung | AAOI @ $97.43 | LITE @ $907.84 | POET @ $7.565 |
|---|---|---|---|
| YE2026 | P/E 30× FY27 $4.60 → **$138 (+41.6%)** · floor 15× $69 | P/E 32× FY27 $21.67 → **$693 (−23.7%)** · floor $325 | EV/S 15× FY27 $0.09B, 175M sh, +$0.75B → **$12.0 (+58.6%)** · no floor |
| YE2027 | no rung (FY28 EPS excluded) | no rung (FY28 EPS excluded) | EV/S 12× FY28 $0.20B (derived), 190M sh → **$16.05 (+112%)** |
| YE2028 | — | P/E 22× FY29 $47.44 → **$1,044 (+15.0%, 6.3%/yr)** · floor $712 | — |
| Street invert | $151 PT ⇒ 32.9× FY27 | $1,140 PT ⇒ 52.6× FY27 | $17.50 (1 analyst) ⇒ 25.7× FY27 sales |
| Lints | none | none | none (LENS would fire if FY27 EPS were positive; it is −0.05) |

**Reads, stated plainly.**
- AAOI is the only name with a positive gap on ≥5-analyst numbers: +42% on 30× FY27. The whole
  gap is the FY27 EPS ($4.60) surviving — Q3 guided EPS BELOW the street, and the 2028 number
  is one analyst's. AI-route `AI_G3P` would read PEG 0.05 (21× FY26 EPS over +577% growth) → PASS,
  but that PEG is a crossing artifact, not evidence.
- LITE at $908 is priced past its own FY27 rung at any multiple under ~42×; only the FY29 rung at
  22× clears the price, for +15% over 2.3 years. The street's $1,140 needs 52× FY27. Deep-ITM
  converts make dilution, not debt, the term. Book status: entry-discipline hinge still RED.
- POET's +59% / +112% is ENTIRELY the thesis' revenue assumption; the 2026 rung has 2 analysts,
  the 2027 rung has zero. A P4 falsifier set cannot score before 2027 observations exist, so it
  is PROVISIONAL-at-best (B cap, never eligible) by construction.

**Nothing written to KV** — payloads are drafts on the branch; the owner pastes them through the
📊 DEEP DIVE editor (validate-before-mutate) or I do once the PIN path is available in-session.

**TT run lines (canonical surfaces: no `/api/score` card exists for any of the three; no
allocation receipt names them):**
- `AAOI — Composite: UNAVAILABLE (no server card; falsifiers unwritten) · PT: $138 (P/E 30× FY27, YE2026, ASSISTANT-SET owner-model draft) · Call: WAIT — no ELIGIBLE NEXT DOLLAR line; card unscored`
- `LITE — Composite: UNAVAILABLE (stored 7.03/A card is v2.5-era, re-score owed) · PT: $693 (P/E 32× FY27, YE2026, owner-model carried) / $1,044 (22× FY29, YE2028) · Call: WAIT — price above the near rung; entry hinge RED`
- `POET — Composite: UNAVAILABLE (no server card; 2 analysts, no P4) · PT: $12.0 (EV/S 15× FY27, YE2026, ASSISTANT-SET from the attached thesis) · Call: WAIT — thesis-derived revenue, no street, no card`
