# Ticker Terminal Value Proposition Audit

**Audit date:** 2026-07-31 ET

**Live product audited:** MacroDash / Ticker Terminal v3.48.0

**Repository state audited:** local `main` v3.8.0; `origin/main` v3.7.0

## Executive conclusion

Ticker Terminal has a real and differentiated value proposition, but it is not "a better Yahoo Finance."

It is best understood as a **personal investment decision operating system**:

> Your broker knows what you own. Research sites know what analysts think. Ticker Terminal should know why you own it, what would invalidate it, and where the next dollar should go—or come from.

Yahoo Finance is primarily an information terminal. Seeking Alpha is a research and ratings network. Robinhood is an account and execution system. Ticker Terminal's opportunity is to sit above all three as the personalized belief, risk-policy, and capital-allocation layer.

That niche is valuable. The present implementation, however, is not yet reliable enough to serve as an order gate.

## Competitive position

| Job | Best product today | Assessment |
|---|---|---|
| Quotes, news, historical financials, screeners | Yahoo Finance | Yahoo offers portfolio risk/concentration views, research, screeners, and decades of downloadable financial data. |
| Broad stock ratings and research | Seeking Alpha | Its daily Quant system covers roughly 5,600 stocks using 100+ metrics, alongside analyst articles, transcripts, broker-linked portfolios, alerts, and screeners. |
| Accurate account state and execution | Robinhood | Robinhood owns the authoritative positions, orders, tax lots, buying power, real-time market data, charts, options chains, and execution. |
| "What moved and why?" | Robinhood Cortex / Yahoo / Seeking Alpha | Cortex combines holdings, news, events, macro data, analyst ratings, and technical indicators into personalized summaries. |
| "What do I believe, what breaks the thesis, and what should receive the next dollar?" | Ticker Terminal | This is the genuinely differentiated function. The incumbents do not deeply represent the owner's thesis, falsification conditions, custom risk rules, and opportunity cost across the existing book. |

Ticker Terminal should complement these services, not duplicate them.

### Official competitor references

- [Yahoo Finance subscription plans and portfolio tools](https://finance.yahoo.com/about/plans/)
- [Yahoo Finance portfolio overview](https://help.yahoo.com/kb/yahoo-finance-plus/overview-portfolio-yahoo-finance-sln36784.html)
- [Seeking Alpha Quant Ratings methodology](https://help.seekingalpha.com/premium/quant-ratings-and-factor-grades-faq)
- [Seeking Alpha Premium features](https://help.seekingalpha.com/premium/seeking-alpha-premium-feature-list)
- [Seeking Alpha portfolio tracker](https://help.seekingalpha.com/what-are-the-key-features-of-seeking-alphas-portfolio-tracker)
- [Robinhood Legend](https://robinhood.com/us/en/legend/)
- [Robinhood Cortex methodology](https://robinhood.com/us/en/support/articles/cortex-digests-methodology/)

## Where Ticker Terminal excels

### 1. It stores a falsifiable thesis, not merely a rating

The NBIS page is a good example. It records dated hinges such as:

- RPO and deferred revenue.
- GPU pricing assumptions.
- Partner-disclosure unknowns.
- Debt spreads.
- Free-cash-flow quality.
- Customer concentration.

Each can be green, amber, or unknown, with an observation date. That is more useful than a generic "Strong Buy" because it says what evidence would change the decision.

Seeking Alpha can tell the user how NBIS ranks against sector peers. Ticker Terminal can remember that the owner's thesis depends on backlog conversion, concentration, financing terms, and GPU economics. That is a different and more personalized job.

### 2. It connects research to portfolio opportunity cost

The buy side ranks annualized upside, then checks:

- Position headroom.
- TT quality.
- R/R floor.
- Binary-event window.
- Portfolio circuit.
- Thesis hinges.

The sell side asks where new capital should come from, prioritizing cap breaches and then lower expected returns. That "next dollar in / next dollar out" pairing is the strongest conceptual feature on the website.

Yahoo Finance and Seeking Alpha mostly help answer "is this security attractive?" Robinhood helps execute. Ticker Terminal tries to answer the harder portfolio question: "Is it more attractive than what I already own, after constraints?"

### 3. It preserves decision history

Ticker Terminal tracks:

- Open decisions and how long they have remained unanswered.
- Thesis, model, score, tier, and rank changes.
- The price since a belief change.
- What changed since the last acknowledged baseline.
- Upcoming binaries and pre-commitments.

This turns investing from a sequence of disconnected opinions into a reviewable process. The unresolved-decision strip is especially valuable because it prevents important questions from disappearing into old chats or notes.

### 4. It uses specialized business lenses

AI infrastructure, Physical AI, Quality Compounders, vehicles, and speculative names are not forced through the same rubric. The framework has explicit refusal and kill-gate logic. That is a sound improvement over applying identical value/growth/momentum ratios to NBIS, JOBY, TSM, and a leveraged ETF.

The intended sequence in [`TT_TICKER_TERMINAL.md`](./TT_TICKER_TERMINAL.md) is well designed:

1. Regime.
2. Routing.
3. Kill gates.
4. Composite.
5. Technicals.
6. Portfolio constraints.
7. Next-dollar verdict.
8. Expression.

### 5. It acknowledges missing information

The product frequently labels data as manual, stale, `[FP]`, unknown, thinly covered, or unmeasured. That honesty doctrine is valuable. The system often knows where it is weak, which is more than many finance products do.

## Current coverage and readiness

At audit time, the board contained 36 names, but:

- Only 21 were modeled and priced.
- Only 5 had fresh TT runs; 31 showed "never run."
- Only 2 of 36 had the complete three-question projection.
- Six marks were stale.
- Fourteen decisions were open; nine were blocking.
- Only 17 positions had measured account exposure.
- Several option-heavy positions had no synchronized option value.
- The tracked book was explicitly not total NAV.

The interface therefore looks like a complete investment system, while the underlying evidence coverage is still partial.

## Critical trust failures

### 1. The two macro surfaces disagree

The public dashboard reported `MIXED`, with a usable 3-of-5 regime. The Terminal's `/readout.json` reported `INSUFFICIENT`, with only one available input and Macro Flip blind.

The likely cause is the ET/UTC rollover in [`src/sources.js`](../src/sources.js): the server can advance to the next UTC date while it is still the prior market date in New York, incorrectly aging normal prior-close data. The readout applies that freshness gate in [`src/ttReadout.js`](../src/ttReadout.js).

A decision system cannot have two different answers to "what regime are we in?"

### 2. It emits a green pick despite missing mandatory gates

The board reported "both stories agree: TSM," even though:

- Stance was `UNKNOWN`.
- Macro Flip was blind.
- TSM showed `NEVER RUN`.
- TSM carried a red entry hinge.

This conflicts with the written rules in [`TT_TICKER_TERMINAL.md`](./TT_TICKER_TERMINAL.md): live data is mandatory, engine disagreement means WAIT, and regime must be checked daily before an order.

### 3. The risk denominator is incomplete

NBIS was shown at 31.2% and roughly $58,000 over the 18% cap, but that percentage was based on tracked-book equity value, not total NAV, and excluded some option exposure.

The direction is probably correct: NBIS is concentrated. The exact percentage and trim amount are not authoritative. A "hard cap" cannot be hard when the denominator is explicitly a floor.

### 4. Production is not reproducible from the repository

Production identified itself as `v3.48.0`; this checkout was `v3.8.0`, and `origin/main` was `v3.7.0`. Until the deployed source is reconciled, the most important allocation logic cannot be code-reviewed, regression-tested, or safely redeployed from this repository.

## Product ambiguities

### "NEXT DOLLAR — BUY" is not the buy recommendation

BETA appeared first because it had the highest mathematical upside. TSM was the first name the combined gate considered eligible. Those are different concepts, but the presentation blended them.

Recommended labels:

- `VALUATION GAP RANKING — math only`
- `ELIGIBLE NEXT DOLLAR — all gates passed`

### "NEXT DOLLAR — SELL" sounds more actionable than it is

This is really a funding-priority ranking if capital must be raised. A company with positive modeled upside can still appear because another name has more upside.

Recommended label: `FUNDING PRIORITY`, with explicit states for:

- Mandatory trim.
- Candidate funding source.
- Hold—do not sell.
- Unable to evaluate.

### Tier meaning is unclear

An `S` can mean quality, conviction, current attractiveness, or manually assigned status. Those should be separate fields:

- Business quality.
- Thesis confidence.
- Current entry attractiveness.
- Portfolio sizing eligibility.

An excellent company at a poor price should not need to become a lower-quality company.

### Too many freshness clocks

A ticker page can contain:

- Live quote time.
- Manual reference-price date.
- Last TT run.
- Model-pull date.
- Hinge observation dates.
- Position-sync date.
- Option-screenshot date.
- Thesis-update date.

Each ticker needs one consolidated readiness statement, for example:

> Decision readiness: BLOCKED — TT never run; position current; model 6d old; one hinge unknown.

### "Live," "cached," and "measured" are overloaded

The macro page reported 13 "live" fields while the overall payload was cached and end-of-day. The board separately reported position coverage and quote coverage using "measured." These terms need formal definitions visible in the interface.

### Regime denominators disagree

The public page showed `3/6 bullish`; the 5 Whys section said `3/5 live factors`. One may include a neutral or unavailable factor, but the user should not have to infer the denominator.

## Major capability gaps

### 1. No outcome calibration

The scorecard records belief changes, but not whether recommendations created value versus the rejected alternative. Track every eligible next-dollar decision, rejected alternative, price, horizon, and subsequent return. Otherwise the system can become a sophisticated rationalization engine.

### 2. No portfolio-level factor or correlation risk

The portfolio is heavily exposed to related AI infrastructure and speculative-growth drivers. Static ticker caps do not capture correlated cluster risk. Add sector/theme exposure, beta, drawdown correlation, and scenario shocks.

### 3. Options exposure is incomplete

Screenshot-entered contracts without current value, delta, Greeks, or assignment exposure cannot support true weight-aware allocation.

### 4. No tax-aware funding logic

Without tax lots, holding periods, realized gains, and wash-sale context, "where the dollar comes from" is incomplete.

### 5. Evidence is not sufficiently auditable

Hinges contain useful claims and dates but often lack clickable primary-source citations. Every material claim should retain source URL, retrieval time, quoted datum, and whether it was verified, derived, or owner-asserted.

### 6. Alerts are not operational

Macro alert toggles explicitly said notifications were not wired. A decision operating system needs notifications for hinge breaks, stale models, binaries, cap breaches, and unresolved blockers—not another set of passive toggles.

### 7. Manual maintenance remains too heavy

Broker positions, option legs, estimates, events, and thesis hinges age on different schedules. Read-only broker sync and automated event/estimate ingestion would produce more value than adding another chart or screener.

## Recommended product strategy

Do not try to beat Yahoo Finance on data, Seeking Alpha on research breadth, or Robinhood on execution. Treat them as upstream systems.

Priorities:

1. **Make "eligible" trustworthy.** Use one regime engine, require a fresh TT run, require an evaluable circuit, use an authoritative exposure denominator, and hard-`WAIT` on missing gates.
2. **Gate the interface by evidence coverage.** Do not show a green recommendation unless the name has a current model, current TT run, defined thesis hinges, current position state, and no unresolved blocking decision.
3. **Prove the system adds value.** Benchmark every recommendation and rejected alternative over its stated horizon.
4. **Automate inputs while preserving judgment.** Sync positions, lots, options, earnings, and estimates, while keeping the owner's thesis, hinges, and risk rules as the distinctive layer.

The strongest positioning is not "all your market data in one terminal." It is:

> **A personal capital-allocation system that remembers your thesis, detects what changed, enforces your rules, and tells you what deserves the next dollar.**

That proposition is defensible. The current website demonstrates the idea convincingly, but its green action layer is ahead of its data completeness and trust controls.
