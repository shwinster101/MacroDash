# Stock Spotlight: NBIS × Established Growth

Status: agreed implementation plan for public audit; no feature implementation or deployment.
Planning date: 2026-09-13. Base: v6.4.0.

## 1. Requirements

Build one educational widget in Simple and Degen answering: **“What do this business’s latest results and its stock’s current price tell me?”**

- NBIS remains the recurring growth case.
- Rotate one Mag Seven comparison weekly: **MSFT → AAPL → AMZN → GOOGL → META → NVDA → TSLA**.
- Start with Microsoft; label the comparison “Established growth.”
- Update market data after each trading day and fundamentals as companies report.
- Use deterministic assessments and authored lessons, without buy/sell ratings or a new stock score.
- Advance the pair on the first successful refresh of each new ET calendar week; all visitors see the same pair.

**Always visible for both companies, in both modes:**

- Company name and ticker.
- **Market capitalization**, with its observation date.
- **YTD total return**, with its through-date.
- **A shared YTD comparison chart inside the widget.**

These fields never disappear behind a disclosure. Missing data displays “Unavailable” with a short reason, never zero or an invented value.

## 2. Widget and learning experience

Place **Stock Spotlight** immediately below the existing macro-number strip, preserving the macro verdict as the first answer.

| Simple | Degen |
|---|---|
| Compact profiles, stacked on phones | Same profiles with expanded supporting analysis |
| Market cap and YTD return always visible | Market cap and YTD return always visible |
| Shared YTD comparison chart | Same comparison chart |
| Revenue growth, operating margin, free cash flow | Additional cash, debt, valuation, share-count, and price-trend detail |
| Two-sentence assessment per company | Calculation inputs and explanation of the assessment |
| One shared “Learning moment” | Worked example and dated sources |
| “Explore the numbers” disclosure | Analysis visible; source disclosures collapsed |

Each assessment answers:

1. **Business:** Is revenue growing, and is profitability improving?
2. **Stock:** What multiple is the market paying, and how is the price trending?
3. **Watch next:** Which reported metric or announced event could change the assessment?

Keep financial labels precise in both modes. Do not introduce competing macro-style verdict badges.

Author seven lessons tied to the rotation:

- MSFT: reported revenue versus annualized run-rate.
- AAPL: business growth versus growth per share.
- AMZN: operating cash flow versus capital spending.
- GOOGL: cash generation versus valuation.
- META: margins and reinvestment.
- NVDA: growth rates, scale, and expectations.
- TSLA: reported results versus market expectations.

Use company-specific numbers only when supporting evidence exists. Otherwise, retain the conceptual lesson and state that its worked example is unavailable.

## 3. Public data, market cap, and tracker

Reuse the Terminal’s source normalization, evidence dates, last-good handling, and applicable calculations. Build a separate public projection excluding holdings, private thesis text, scores, targets, allocation decisions, and credentials.

Add a cached **`GET /api/stock-spotlight`** response containing the selected pair, facts, assessments, lesson, citations, market caps, YTD returns, and chart series. Both modes consume this same model. Public reads never trigger provider refreshes or query private book records.

### Market capitalization

- Prefer a dated provider-reported market cap.
- If derived, use a dated stock price and compatible actual shares outstanding. Do not substitute diluted weighted-average shares used for earnings calculations.
- Preserve provider currency and units; display readable billions/trillions.
- Explain the calculation and any differing input dates in the source disclosure.
- Never substitute enterprise value for market cap.

### YTD return and comparison tracker

- Display **YTD total return**, including dividends, using a provider-documented series adjusted for splits and distributions.
- Calculate from the final trading close of the previous calendar year: `100 × (adjusted value / year-start baseline − 1)`.
- Plot both stocks as cumulative percentage returns starting at **0%**, using the same baseline date and latest common valid trading date.
- Derive the visible YTD values from the same series and endpoint as the chart so the figures agree.
- Keep the chart visible in Simple and Degen, with a labeled zero line, distinguishable lines, ticker legend, and accessible date/value inspection.
- Missing observations appear as gaps; never fabricate points or silently substitute price return for total return.
- If one series is unavailable, show the other and name the unavailable series. If neither is available, retain the tracker’s unavailable state.
- Weekly rotation replaces only the comparison series. Both lines continue to represent YTD performance, not performance since being featured.
- Reset the baseline with the calendar year. Before the first new-year trading close, state that YTD awaits the first close.

### Fundamentals and assessment

Collect reported revenue, comparable prior-year revenue, operating income, operating cash flow, capital expenditure, cash, debt, and share-count evidence.

- Derive revenue growth, operating margin, and free cash flow from compatible reporting periods.
- Define free cash flow as operating cash flow less capital expenditure.
- Use market-cap/TTM revenue for the common valuation comparison; add trailing P/E where earnings are positive.
- Distinguish quarterly results, TTM results, company guidance, and annualized run-rate.
- Describe measured changes without inventing “cheap,” “safe,” or quality-score thresholds.
- Reuse moving-average calculations independently of Terminal targets, stops, and trade eligibility.

The planning inspection found old stored profiles, missing SEC configuration, and extraction limited to 10-Q/10-K. Include Nebius’s 20-F and relevant 6-K reporting. Use explicit issuer-report mappings where structured filing data is insufficient.

### Refresh and degradation

Use the existing evening scheduled invocation for an independent spotlight refresh. Refresh the active pair and prepare the next comparison company.

- A spotlight failure cannot interrupt the macro evening update.
- Recalculate freshness when serving stored data; do not trust an old `LIVE` flag.
- Retain last-good observations with their dates and visibly mark stale market data.
- Suppress current price assessments when expected session data is missing.
- Label fundamentals “latest reported” with their fiscal periods.
- Keep the scheduled company visible when coverage is incomplete.

## 4. Sprint

Estimated **9–12 engineering days**, excluding external data approval.

| Step | Deliverable | Acceptance evidence |
|---|---|---|
| **1 — Data foundation, 2–3 days** | Repair filing coverage; verify public market-data rights, market cap, and adjusted total-return history | Reconciled NBIS/MSFT fixtures and coverage checks for all comparison companies |
| **2 — Public service and tracker calculations, 2–3 days** | Public projection, market cap, YTD series, weekly selection, cache, and refresh | Correct calculations and honest partial-data responses |
| **3 — Widget and lessons, 3–4 days** | Simple/Degen profiles, always-visible cap/return fields, comparison chart, and seven lessons | Phone/desktop previews with complete, stale, and unavailable data |
| **4 — Audit and release preparation, 2 days** | Full gates, visual inspection, source review, operational documentation, and audit PR | Reviewable branch with screenshots and verification results |

Implement from current remote `main` in an isolated branch, preserving unrelated local changes.

## 5. Verification and launch

- Confirm both modes show identical market caps, YTD values, chart endpoints, and assessments.
- Test dividends, splits, year boundaries, holidays, missing baseline data, missing sessions, and weekly comparison changes.
- Test market-cap units, currency, stale share counts, and rejection of weighted-average diluted shares as outstanding shares.
- Test fiscal-period alignment, restatements, negative earnings, missing debt, and NBIS run-rate versus reported revenue.
- Verify mobile chart interaction, keyboard accessibility, and no overflow at 320px, 390px, and desktop widths.
- Preserve existing macro first-screen layout budgets.
- Prove public responses exclude private Terminal fields and credentials.
- Run the full browser-required gate suite and inspect rendered screenshots before merge review.

Build behind a disabled feature flag and publish an audit branch and PR. **Production activation requires approved public-display coverage for market caps, prices, and derived total returns**, plus a verified refresh path. No subscription purchase is assumed. Track refresh failures, observation dates, and missing required fields through existing operational diagnostics.

### Planning references

- [Nebius annual report on Form 20-F](https://www.sec.gov/Archives/edgar/data/1513845/000110465926052948/nbis-20251231x20f.htm) — foreign-issuer reporting support.
- [Finnhub terms of service](https://finnhub.io/terms-of-service) — public redistribution includes derived results; verify appropriate permission before activation.
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — scheduled refresh implementation reference.
