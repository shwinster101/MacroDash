# Ticker Terminal logic redesign — 2026-08-15

Status: implemented contract for the v2 ticker-analysis path. This document records the
public data boundary, schemas, gates, migration order, and acceptance cases. The private TT
framework and real book content remain in KV and are intentionally not reproduced here.

## Product decision

The owner supplies only two licensed inputs:

1. Seeking Alpha forward annual revenue and EPS estimates, copied from the Forecast view.
2. TipRanks' published analyst price-target distribution: average, low, high, analyst count,
   rating counts, stated lookback, and target horizon.

Those inputs arrive as screenshots, are OCR'd into a draft, and must be reviewed before save.
The OCR output is never authoritative and the screenshots are never persisted.

All other inputs are measured facts sourced by the terminal when providers are available:
live quote, historical OHLC, earnings calendar, diluted shares, cash, marketable securities,
debt, and historical fundamentals. Each fact carries provider, source URL, observation time,
retrieval time, units, and status. Missing evidence remains `UNKNOWN`; it is never silently
coerced to zero or allowed to pass a gate.

TipRanks' **published average** is the street target used by the valuation-gap gate and street
ranking. The terminal must never average TipRanks low/average/high into a new number. The target
is a rolling 12-month target based on the analysts in TipRanks' stated lookback (normally the
last three months); it is not joined to a fiscal-year model rung.

Ticker eligibility is independent of the owner's current portfolio exposure. Position weight
and the existing 18% cap remain portfolio information, but they cannot veto the ticker-level
answer. The UI must not label the result “NEXT DOLLAR,” because no funding or position-sizing
decision has been made.

## Data classes and ownership

| Class | Owner | Persistence | Examples |
| --- | --- | --- | --- |
| `manualLicensed` | owner-reviewed | per-symbol KV | SA estimates, TipRanks target |
| `measuredFacts` | terminal adapters | per-symbol merge-only KV | quote, OHLC, earnings, SEC facts |
| `ownerBeliefs` | owner | existing private book/framework KV | thesis, hinges, qualitative framework |
| `derived` | code | receipt/history only | growth, gaps, technicals, gate outcomes |

Licensed inputs and measured facts must not be stored inside replace-all `deepDive`. The current
book remains readable during migration, but v2 APIs own new writes.

## Manual licensed-input schema

The current record lives at `tt:street:<SYMBOL>:v1`; immutable revisions live under
`tt:street:history:<SYMBOL>:<ISO timestamp>`.

```json
{
  "schema": "tt-street-v1",
  "symbol": "NVDA",
  "confirmedAt": "2026-08-15T17:09:00.000Z",
  "estimates": {
    "provider": "Seeking Alpha",
    "sourceUrl": "https://seekingalpha.com/…",
    "asOf": "2026-08-15",
    "currency": "USD",
    "revenueUnit": "B",
    "epsBasis": "provider-consensus",
    "periods": [
      {"periodEnd":"2027-01-31","revenueB":393.93,"eps":8.96},
      {"periodEnd":"2028-01-31","revenueB":562.14,"eps":12.80},
      {"periodEnd":"2029-01-31","revenueB":692.37,"eps":15.93},
      {"periodEnd":"2030-01-31","eps":17.50},
      {"periodEnd":"2035-01-31","revenueB":1150}
    ]
  },
  "analystTarget": {
    "provider": "TipRanks",
    "sourceUrl": "https://www.tipranks.com/…",
    "asOf": "2026-08-15",
    "currency": "USD",
    "average": 309.94,
    "low": 250,
    "high": 500,
    "analystCount": 37,
    "ratings": {"buy":36,"hold":1,"sell":0},
    "lookbackMonths": 3,
    "horizonMonths": 12,
    "referencePrice": 225.16
  }
}
```

Required fields are symbol, confirmation time, provider/as-of/currency, at least two estimate
periods containing revenue or EPS, and the published average target. `referencePrice` is only a
transcription cross-check; all live gap math uses the current sourced quote. Low/high must bracket
average when present. Rating counts must reconcile to analyst count when all counts are present.
Unknown analyst count is explicit and lowers evidence confidence; it must not look fully sourced.
The screenshot does not establish GAAP versus non-GAAP diluted EPS, so the imported series is
labelled `provider-consensus`; the terminal does not silently relabel it as diluted GAAP EPS.

Freshness limits: 45 calendar days for estimates and 30 calendar days for analyst targets. A
future as-of date, stale record, missing source, malformed value, or currency/share-basis mismatch
is a blocking `UNKNOWN`/`FAIL`, never a normal-confidence value.

## Measured-facts schema

Facts live at `tt:facts:<SYMBOL>:v1` and update field-by-field. A failed refresh retains the
last-good value with its original observation time and changes its status to `STALE` or `ERROR`.
Payload edits and licensed-input imports cannot erase facts.

```json
{
  "schema": "tt-facts-v1",
  "symbol": "NVDA",
  "updatedAt": "2026-08-15T18:00:00.000Z",
  "fields": {
    "quote": {"value":225.16,"currency":"USD","status":"LIVE","observedAt":"…","provider":"Finnhub","sourceUrl":"…"},
    "candles": {"value":[…],"status":"LIVE","observedAt":"…","provider":"Finnhub","sourceUrl":"…"},
    "nextEarnings": {"value":"2026-08-26","status":"LIVE","observedAt":"…","provider":"Finnhub","sourceUrl":"…"},
    "dilutedSharesB": {"value":24.391,"status":"LIVE","observedAt":"2026-04-26","provider":"SEC","sourceUrl":"…"},
    "netCashB": {"value":41.865,"status":"LIVE","observedAt":"2026-04-26","provider":"SEC","sourceUrl":"…"}
  }
}
```

The first adapters are Finnhub quote/profile/earnings/calendar and premium daily candles, plus
SEC submissions/companyfacts. SEC debt normalization exposes the included components. Missing
net cash remains missing; absent and zero are different states.

## Derived metrics

The shared pure module derives, without persisting duplicate inputs:

- TipRanks average/low/high gaps from the live quote.
- Revenue/EPS period-over-period growth and CAGR from explicit period-end observations only.
- Forward P/E for every positive EPS period and the TipRanks-average implied forward P/E.
- ATR(14), pivot highs/lows, support/resistance clusters, technical trend, support quality,
  stop reference, reward/risk, and the evidence used for each result.
- A five-pillar composite with the first missing revision/sentiment pillar removed and the
  remaining available pillars renormalized. A missing pillar is displayed, not scored as zero.

No chart interpolation is allowed. A tooltip observation such as Jan 2035 revenue may be stored;
unseen years between 2029 and 2035 may not be synthesized.

## Gate receipt

Every gate returns `{status: PASS|FAIL|UNKNOWN, reason, evidence[]}`. Eligibility is true only
when every required gate is `PASS`; `UNKNOWN` fails closed.

1. **Macro actionability.** Engine 0 `HOLD`, unreadable/insufficient health, non-evaluable Macro
   Flip, or `PANIC` blocks. `RESTRICTED` is a visible WAIT; only `FULL` may gate capital.
2. **Street gap.** Fresh TipRanks published average must be at least 15% above the live quote.
3. **Evidence freshness.** Fresh confirmed SA estimates, fresh TipRanks target, and a usable live
   or explicitly cached quote are required.
4. **Composite quality.** Available pillars are renormalized; any mandatory qualitative pillar
   without cited evidence is `UNKNOWN`, not a pass.
5. **Reward/risk.** Minimum 2.0x core, 2.5x tactical, 3.0x speculative; add 0.5x in HEADWIND.
   A missing stop, target, candle history, or computed R/R is `UNKNOWN` and blocks.
6. **Binary window.** A known earnings/catalyst calendar is required. An event in 10 calendar
   days or less blocks a new entry; an empty or failed calendar is `UNKNOWN` and blocks.

An attestation receipt records `{at, engineVersion, inputVersions, inputHash, resultHash, status}`.
A “ran it” timestamp without bound inputs/results is not evidence.

The old `lastRun`, `pt_model`, prose-parsed score, manual `projection`, and portfolio weight are
not v2 eligibility gates. They remain legacy/read-only until migration is complete.

## OCR review workflow

1. Operator selects a symbol and uploads at most three PNG/JPEG/WebP screenshots, 5 MB each.
2. `/api/street/ocr` sends each image to the Pages Workers AI binding using a vision model.
3. The API returns a typed draft, per-field source-image references, and warnings. It persists
   neither the images nor the draft.
4. The terminal shows narrow editable estimate and target fields. The operator confirms them.
5. `/api/street` validates and persists only the confirmed typed record and immutable revision.
6. Facts refresh and analysis run; the terminal renders the gate receipt and provenance.

An absent `AI` binding, rejected image, OCR parse error, or low-confidence field degrades to a
clear manual-entry draft. It can never write inferred values directly.

## NVDA calibration and acceptance fixture

Screenshot observations on 2026-08-15:

- Reference price $225.16.
- TipRanks: average $309.94, low $250, high $500; 36 buy, 1 hold, 0 sell.
- SA: Jan 2027 revenue $393.93B / EPS 8.96; Jan 2028 $562.14B / 12.80;
  Jan 2029 $692.37B / 15.93; Jan 2030 EPS 17.50; Jan 2035 revenue $1.15T.

Expected deterministic results at the screenshot price:

- average gap +37.653%; low +11.032%; high +122.064%.
- revenue growth +42.700%, then +23.167%; 2027–2029 CAGR +32.574%.
- EPS growth +42.857%, +24.453%, +9.856%; 2027–2030 CAGR +25.000%.
- forward P/E 25.129x, 17.591x, 14.134x, 12.866x.
- target-average / Jan 2028 EPS = 24.214x.

The offline acceptance fixture supplies same-period SEC XBRL components that produce 24.391B
diluted shares and a conservative $41.865B net-cash construction, plus a 2026-08-26 earnings
date. Those values calibrate normalization and the date boundary; production never inherits
them. Its SEC and calendar adapters must fetch and stamp their own evidence. On 2026-08-15 the
fixture event is 11 days away, so the binary rule passes on that date and blocks beginning
2026-08-16.

The captured 2026-08-15 Engine 0 calibration is deliberately a WAIT: `actionability=HOLD`,
degraded health, `health.can_gate=false`, and Macro Flip is not evaluable. The positive 37.7%
street gap must not override this. This is the first end-to-end acceptance test; it is a dated
fixture, not a claim about the current production regime.

## Implementation sequence

1. Add shared pure schema/calculation/gate modules and NVDA acceptance tests.
2. Add authenticated `/api/street`, ephemeral `/api/street/ocr`, merge-only `/api/ticker-facts`,
   and `/api/ticker-analysis` receipt routes.
3. Add the terminal screenshot review form and read-only sourced-facts/gate receipt view.
4. Make Engine 0 actionability and every hard dependency fail closed; replace the old green
   “NEXT DOLLAR” line with ticker-level `ELIGIBLE`/`WAIT` semantics.
5. Prefer the published street average for ranking; keep owner `pt_model` as an optional private
   comparison, never an eligibility prerequisite.
6. Split street/fact revision history from the beliefs ledger, add server-side payload tests,
   and retire duplicated `projection`/`pt_consensus` writes.
7. Archive-label the legacy terminal guide and make `/admin.html`, `/readout.json`, KV ownership,
   the two manual inputs, bindings, and degradation behavior the one documented contract.

Implementation status: steps 1–5 and 7 are complete. Step 6's separate revision history and
server-side payload tests are complete; deletion of legacy `projection`/`pt_consensus` data is
intentionally deferred so existing private book payloads remain readable during migration. Those
fields are labelled legacy/optional and cannot affect v2 eligibility.

## Deployment prerequisites

- Existing Pages `PULSE_CACHE` KV and `FINNHUB_KEY` bindings.
- Finnhub plan entitlement for `/stock/candle`; lack of entitlement must render missing
  technical evidence and a blocked gate.
- Pages Workers AI binding named `AI`, with the Meta Llama 3.2 Vision license accepted once in
  the Cloudflare dashboard. No model API key is placed in browser code.
- A descriptive SEC `User-Agent` supplied as `SEC_USER_AGENT` (application/contact), so SEC
  requests comply with fair-access guidance.

## Migration safety

- New routes are additive and preserve current KV book records.
- Every v2 write is authenticated, origin-checked, size-limited, schema-validated, and no-store.
- The browser does not decide whether malformed data is acceptable; the server revalidates it.
- Legacy records may display during migration but cannot be silently promoted to v2 evidence.
- A provider outage serves last-good values with their real age and blocks when the field's
  freshness limit is exceeded.
