# API palette upgrade — keys, doors, and switches

**Date:** 2026-09-16 · **Scope:** the four provider moves from the palette review · **Cost:** $0
**Status:** PLAN — nothing here is built yet. Owner rulings needed are marked ⚖️.

> **TL;DR** — Of the four moves, **three need zero key work** (the doors are keyless or the
> tag is already in the drawer). **One optional free key** (Alpha Vantage) unlocks revenue
> consensus. Everything else is code.

---

## 0. The mental model (read this first)

Think of every data vendor as a **building with a door**, and every API key as a **name tag**.

| Concept | Plain-English meaning | In this repo |
|---|---|---|
| **Door** | The URL you fetch | `https://api.tiingo.com/…`, `https://api.nasdaq.com/…` |
| **Name tag (key)** | A string the vendor checks at the door and uses to count your visits | `FINNHUB_KEY`, `TIINGO_KEY` |
| **Keyless door** | No tag needed — you just have to *look like a browser* (headers) | Nasdaq, Kalshi, OpenRouter models, CNN F&G |
| **The drawer** | Where Cloudflare keeps your tags, encrypted, outside git | Pages project **secrets** (`macrodash`) |
| **Second drawer** | The cron Worker has its *own* drawer | Worker **secrets** (`macrodash-cron`) |
| **Handing over the tag** | Your code asks `env.NAME`; Cloudflare supplies it at runtime | `env.TIINGO_KEY` in a Pages Function |
| **Budget** | How many visits the free tag allows | Tiingo 50/hr · Alpha Vantage 25/day · Finnhub 60/min |

**Switching a source is always the same three questions:**

1. Does the new door need a tag?
2. Is that tag already in the drawer?
3. Point the code at the new door, with a fallback to the old one.

**Rule that never changes:** a tag lives in the drawer or in the gitignored `.dev.vars` — never in a
source file, never in a commit, never in a URL you paste into chat.

---

## 1. Scorecard — what each move actually needs

Verified 2026-09-16 with `npx wrangler@4 pages secret list --project-name macrodash` (names only):

| # | Move | Door needs a tag? | Tag already in drawer? | Key work | Code work |
|---|---|---|---|---|---|
| 1a | Street consensus ← Nasdaq analyst endpoints | **No** (keyless + headers) | n/a | **none** | new fetcher + mapper |
| 1b | Revenue consensus ← Alpha Vantage `EARNINGS_ESTIMATES` | Yes | ❌ not yet | **1 free signup** | small fetcher |
| 2 | TT candles ← Tiingo first, Nasdaq fallback | Yes | ✅ `TIINGO_KEY` | **none** | reorder rungs, delete dead Finnhub call |
| 3 | `SPY` live print ← existing Finnhub batch | Yes | ✅ `FINNHUB_KEY` | **none** | one array entry + one field |
| 4 | FRED / UST / CBOE / Kalshi / OpenRouter / SEC | — | — | **none** | **don't touch** |

**Order of work:** 2 → 1a → 1b → 3. (2 and 1a are pure code and remove the most manual/dead
path; 1b needs the one signup; 3 waits on a ruling.)

---

## 2. The one new key — Alpha Vantage (move 1b)

Only needed for **revenue** consensus. Skip this whole section if EPS + price targets are enough for now.

### 2.1 Find
- Sign-up page: <https://www.alphavantage.co/support/#api-key>
- Docs for the endpoint: <https://www.alphavantage.co/documentation/> → *Fundamental Data → Earnings Estimates* (listed as "Trending", **not** "Premium" → free tier).

### 2.2 Obtain
1. Fill first name, last name, email, organization ("personal" is fine).
2. Click **GET FREE API KEY**.
3. The key appears on screen and is emailed. It is one ~16-character string. No card, no trial clock.
4. Free budget: **25 requests per day**, resets at midnight UTC. There is no per-minute burst on the free tier worth planning around; the day cap is the only wall.

### 2.3 Test it *before* storing it (from your Mac)

```bash
curl -s "https://www.alphavantage.co/query?function=EARNINGS_ESTIMATES&symbol=NVDA&apikey=PASTE_KEY_HERE" | head -c 600
```

| You see | Meaning | Do |
|---|---|---|
| `"revenue_estimate_average": "…"` | ✅ key works, endpoint is free-tier | continue |
| `"Information": "… 25 requests per day …"` | you already burned today's budget (demo key or earlier tests) | wait until 00:00 UTC |
| `"Error Message"` | typo in key or symbol | re-check the paste |

### 2.4 Put it in the drawer (Pages)

Same command shape the repo already uses for `TT_PIN`, `KALSHI_KEY_ID`, `TIINGO_KEY`:

```bash
cd ~/Documents/Claude/Projects/MACRO/MacroDash && npx wrangler@4 pages secret put ALPHAVANTAGE_KEY --project-name macrodash
```

- Paste the key when prompted (nothing echoes — that's normal).
- **Name it exactly `ALPHAVANTAGE_KEY`** so code reads `env.ALPHAVANTAGE_KEY`.

### 2.5 Verify it landed

```bash
cd ~/Documents/Claude/Projects/MACRO/MacroDash && npx wrangler@4 pages secret list --project-name macrodash
```

You should see `ALPHAVANTAGE_KEY: Value Encrypted` in the list. Values are never printed.

### 2.6 Second drawer — only if the sweep runs in the cron Worker ⚖️

If the weekly street sweep is a leg on `macrodash-cron` (instead of a PIN-gated Pages Function you
trigger), the Worker needs its own copy — same pattern `REFRESH_TOKEN` follows in
`worker/SETUP.md` §"both places":

```bash
cd ~/Documents/Claude/Projects/MACRO/MacroDash/worker && npx wrangler@4 secret put ALPHAVANTAGE_KEY
```

### 2.7 Preview deploys
`pages secret put` writes the **production** drawer. Preview deployments have a separate set. If you
test street on a preview URL, add the same secret under *Preview* in the dashboard:
Cloudflare → Pages → `macrodash` → Settings → Environment variables.

### 2.8 Local dev
- `npm run dev` is mock-only and needs **no** keys.
- For `wrangler pages dev`, create `.dev.vars` (already in `.gitignore`) with one line:
  `ALPHAVANTAGE_KEY=…`

### 2.9 Rotation / leak
Request a new key (new email if needed), run `secret put` again with the new value. **Code does not
change** — that is the whole point of the drawer.

---

## 3. Move 2 — Tiingo becomes the primary candle rung (zero keys)

### 3.1 Why
`functions/api/ticker-facts.js` calls Finnhub `stock/candle` first. That endpoint is **premium-gated**
on the free plan, so the rung *always* returns `missing("Finnhub", "premium daily candles unavailable")`
and falls through to the `api.nasdaq.com` scrape. The first rung is dead weight; the scrape is
carrying production alone.

### 3.2 The door
```
GET https://api.tiingo.com/tiingo/daily/{SYM}/prices?startDate=YYYY-MM-DD&token={TIINGO_KEY}
```
Returns an array of daily rows:

| Tiingo field | Use for | Note |
|---|---|---|
| `date` | `date` (slice to `YYYY-MM-DD`) | ISO with time suffix |
| `open` `high` `low` `close` `volume` | the candle | **unadjusted** — what TT's price ladder wants |
| `adjOpen` … `adjClose` `adjVolume` | total-return series | already used by Spotlight |
| `splitFactor` `divCash` | continuity checks | already parsed in `tiingoSeries` |

### 3.3 The switch (in `ticker-facts.js`)
1. Add a `tiingoCandles(sym, env, retrievedAt, refPx)` that builds rows from `open/high/low/close/volume`
   and runs them through the **existing** `candleSeriesFault(rows, refPx)` guard (same fail-closed rule
   the Nasdaq rung uses — no new trust surface).
2. New rung order: **Tiingo → Nasdaq**. Delete the Finnhub `stock/candle` call and its
   `candlesFact` mapper (keep `nasdaqCandlesFact`).
3. Provider string on success: `"Tiingo (daily OHLCV, unadjusted)"`, `sourceUrl: "https://www.tiingo.com/"`.
4. If `!env.TIINGO_KEY` → skip straight to Nasdaq (key-gated, graceful — same invariant as
   `fetchEquities`).

### 3.4 Budget
Free tier: **50 requests/hour · 1,000/day · 500 unique symbols/month.** A ~40-name book fits in one
hourly sweep; the batch quote cache (`tt:quote:batch:v1`) already means candles aren't refetched on
every terminal load. If the book ever passes ~45 names, split the sweep across two hours.

### 3.5 Acceptance
- `/api/ticker-facts?symbol=NVDA` (PIN) → `candles.provider` starts with `Tiingo`, `status: "LIVE"`.
- Temporarily set a bad `TIINGO_KEY` on preview → `candles.provider` is `Nasdaq` (fallback proven).
- Smoke: a fixture-tested `tiingoCandlesFact` covering empty array, non-finite row, continuity fault.

---

## 4. Move 1a — Street consensus from Nasdaq (zero keys)

### 4.1 Why
Today the street record (`analystTarget` + `estimates`) is produced by **screenshot OCR**
(`functions/api/street/ocr.js` → Workers AI vision → DRAFT → manual confirm). Nasdaq serves the same
fields as JSON, keyless, on a host `ticker-facts.js` already fetches for candles.

### 4.2 The doors (all `GET`, same headers as `nasdaqCandles`)

```
User-Agent: Mozilla/5.0 (compatible; MacroDash/1.0)
Accept: application/json, text/plain, */*
Origin: https://www.nasdaq.com
Referer: https://www.nasdaq.com/
```

| Door | What it returns | Verified |
|---|---|---|
| `/api/analyst/{SYM}/targetprice` | `consensusOverview{priceTarget, lowPriceTarget, highPriceTarget, buy, hold, sell}` + `historicalConsensus[]` (12 monthly points) | NVDA, NBIS |
| `/api/analyst/{SYM}/ratings` | `meanRatingType`, `ratingsSummary` ("Based on N analysts…"), `brokerNames[]` | NVDA |
| `/api/analyst/{SYM}/earnings-forecast` | `quarterlyForecast.rows[]` (5) + `yearlyForecast.rows[]` (4): `fiscalEnd, consensusEPSForecast, highEPSForecast, lowEPSForecast, noOfEstimates, up, down` | NVDA |
| `/api/analyst/{SYM}/estimate-momentum` | consensus 1-week / 1-month ago vs current | NVDA |
| `/api/company/{SYM}/earnings-surprise` | last 4 quarters actual vs consensus EPS | NVDA |

### 4.3 Field mapping → the existing street DRAFT shape (`blankOcrDraft()`)

| Street field (today, from OCR) | New source | Transform |
|---|---|---|
| `analystTarget.average` | targetprice `consensusOverview.priceTarget` | as-is (never average low/high) |
| `analystTarget.low` / `.high` | `lowPriceTarget` / `highPriceTarget` | as-is |
| `analystTarget.ratings.buy/hold/sell` | `consensusOverview.buy/hold/sell` | as-is |
| `analystTarget.analystCount` | ratings `ratingsSummary` → parse the integer before "analysts" | regex `(\d+)\s+analysts` |
| `analystTarget.provider` / `sourceUrl` | `"Nasdaq (Zacks consensus)"` / `https://www.nasdaq.com/market-activity/stocks/{sym}/analyst-research` | constant |
| `analystTarget.lookbackMonths` / `horizonMonths` | `null` / `12` | Nasdaq doesn't state lookback; don't invent it |
| `analystTarget.referencePrice` | the same `quote` fact already in `ticker-facts` | reuse |
| `estimates.periods[].periodEnd` | earnings-forecast `fiscalEnd` ("Oct 2026") | month-name → last day of that month, `YYYY-MM-DD` |
| `estimates.periods[].eps` | `consensusEPSForecast` | as-is |
| `estimates.periods[].revenueB` | **not on Nasdaq** → Alpha Vantage (move 1b) or leave `null` | see §5 |
| `estimates.epsBasis` | `"provider-consensus"` | unchanged |

**What the OCR contract already guarantees and this must keep:**
- Output is a **DRAFT**. It is never written to KV by the fetcher; it goes through the same confirm
  path the OCR draft uses today.
- `provenance[field] = { provider, sourceUrl, retrievedAt }` per field, exactly as `ocr.js` stamps
  image provenance — so a Nasdaq-sourced number is never mistaken for a TipRanks/SA one.
- OCR stays as the **manual override** for anything Nasdaq lacks (SA revenue, TipRanks lookback).

### 4.4 Where it runs ⚖️
Two options — pick one before building:

| Option | Trigger | Key drawers touched | Pros / cons |
|---|---|---|---|
| **A. PIN-gated Pages Function** `POST /api/street/draft?symbol=X` | you, from the terminal UI | Pages only | matches the OCR flow; one door per name, on demand |
| **B. Weekly leg on `macrodash-cron`** | cron, whole book | Pages **and** Worker | hands-free; needs the budget logic in the Worker |

Recommendation: **A first** (smallest change, same contract as OCR), B later once the mapper is trusted.

### 4.5 Failure modes
- Nasdaq returns 403 / bot challenge → `missing("Nasdaq", …)` → last-good (`withLastGood` rails) →
  OCR override. Exactly how candles degrade today.
- `consensusOverview` all zeros (thin coverage) → treat as `null`, not `0`.
- `fiscalEnd` unparseable → drop that period, warn — never guess a date.

### 4.6 Acceptance
- NVDA draft equals the last confirmed OCR record within tolerance (PT ±2%, counts ±2) → the mapper is
  trustworthy.
- NBIS draft populates (foreign filer, no XBRL quarters) → proves the door works where SEC can't.
- Provenance on every field names `Nasdaq`, never `TipRanks`/`Seeking Alpha`.

---

## 5. Move 1b — Revenue consensus from Alpha Vantage (the one key)

### 5.1 The door
```
GET https://www.alphavantage.co/query?function=EARNINGS_ESTIMATES&symbol={SYM}&apikey={ALPHAVANTAGE_KEY}
```
Returns `estimates[]`, one row per period, both horizons:

| AV field | Street field | Note |
|---|---|---|
| `date` (`YYYY-MM-DD`) | `periods[].periodEnd` | already ISO — join key with Nasdaq's converted `fiscalEnd` |
| `horizon` (`fiscal quarter` / `fiscal year`) | — | filter to the horizons the deep-dive uses |
| `revenue_estimate_average` (raw USD) | `periods[].revenueB` | **divide by 1e9** (`revenueUnit: "B"`) |
| `revenue_estimate_high/low/analyst_count` | provenance detail | keep in `_raw`, don't surface |
| `eps_estimate_average` | cross-check vs Nasdaq EPS | if they differ >5%, flag; don't silently pick one |

### 5.2 Budget = the only design constraint
**25 calls/day, hard cap.** So:
- Never call AV on a terminal page load.
- One call per symbol per **week** (~40-name book ≈ 6 calls/day when spread).
- Cache the response 7 days in KV (`tt:av:estimates:{SYM}:v1`, one key, `withLastGood`).
- Count calls in a daily KV counter (`tt:av:budget:{YYYY-MM-DD}`); stop at 20, keep 5 for manual pulls.
- The `"Information"` cap message is **not** an error to retry — parse it, mark the day exhausted.

### 5.3 Acceptance
- NVDA: `periods[]` carry both `eps` (Nasdaq) and `revenueB` (AV) for the same `periodEnd`.
- Budget counter never exceeds 20 on any UTC day in a week of cron logs.

---

## 6. Move 3 — `SPY` joins the Finnhub quote batch ⚖️ (zero keys)

### 6.1 Why
`spy.price` in `/readout.json` and the QQQ/SPX RS pair come from FRED `SP500`, which lags the tape
~1 trading day. QQQ and the Mag-10 are live via Finnhub. Two freshness clocks in one readout.

### 6.2 The switch (`functions/api/snapshot.js` → `fetchEquities`)
1. `const symbols = ["QQQ", "SPY", ...MAG10];` (11 → 12 quotes; same 60/min free budget).
2. Emit **new** fields — `spyLivePrice`, `spyLiveChangePct`, `spyLivePriceAsOf` — do **not** overwrite
   `spyPrice`/`spxIndex`, which feed the 200-dma / YTD history from FRED.
3. Register the new keys in `src/sources.js` with daily cadence.
4. `readout.json` chooses: live print for `spy.price` when fresh, FRED for `sma200`/`pct_vs_200d`.

### 6.3 The ruling needed
The dashboard's freshness doctrine is **close-read** ("the card governs", first-load-per-ET-day). A
live SPY print in the readout may be *deliberately* out of scope. Decide before building: is the
readout a close-of-day artifact (leave as is) or a "now" artifact (add SPY)?

---

## 7. Move 4 — leave alone

FRED (21 series), UST par curve, CBOE VIX, Kalshi FOMC odds, OpenRouter `$/Mtok`, SEC XBRL, CNN
F&G, multpl CAPE. Each is either the primary source or the only free one, and each passes the v3.43
sorting rule (Yahoo shows the level; these judge it, abstain when stale, and say why).

---

## 8. Paid options — for the record

| Vendor | Cheapest paid | ≤ $10? | Verdict |
|---|---|---|---|
| Finnhub | ~$50/mo | ✗ | free tier already covers what's used |
| Tiingo Power | ~$30/mo | ✗ | free tier fits the book |
| Alpha Vantage | ~$50/mo | ✗ | 25/day is enough at weekly cadence |
| Polygon / Massive | ~$29/mo | ✗ | — |
| FMP | ~$22/mo | ✗ | — |
| Twelve Data / EODHD | ~$20–29/mo | ✗ | — |
| Marketstack | $9.99/mo | ✓ price | ✗ value — EOD only, no estimates |
| **Cloudflare Workers Paid** | **$5/mo** | ✓ | **only material ≤$10 spend**: KV writes 1k/day → 1M/mo, deletes same, reads 100k/day → 10M/mo. Conflicts with the 2026-08-23 ruling "stay on KV free tier and fix the cause" — revisit only on a second cap incident. |

---

## 9. One-page checklist

```
[ ] Move 2 — Tiingo candles
    [ ] tiingoCandles() + fixture test in ticker-facts.js
    [ ] rung order Tiingo → Nasdaq; Finnhub candle call deleted
    [ ] preview: bad key → Nasdaq fallback proven
[ ] Move 1a — Nasdaq street draft
    [ ] ⚖️ ruling: Pages Function (A) or cron leg (B)
    [ ] fetcher + mapper → blankOcrDraft() shape, per-field provenance
    [ ] NVDA draft ≈ last OCR record; NBIS populates
[ ] Move 1b — Alpha Vantage revenue (optional)
    [ ] key obtained + curl test passed
    [ ] `wrangler pages secret put ALPHAVANTAGE_KEY --project-name macrodash`
    [ ] (B only) `cd worker && wrangler secret put ALPHAVANTAGE_KEY`
    [ ] `pages secret list` shows it
    [ ] weekly cache + daily budget counter (stop at 20)
[ ] Move 3 — SPY live print
    [ ] ⚖️ ruling: close-read artifact or now-artifact?
    [ ] if yes: symbols += "SPY"; new spyLive* fields; sources.js; readout picks
[ ] Docs
    [ ] CLAUDE.md data-sources section: candle rung order, street provider, AV budget rule
    [ ] worker/SETUP.md: ALPHAVANTAGE_KEY row (if B)
```

---

## 10. Glossary

- **Rung** — one provider in a fallback ladder. First rung that answers cleanly wins.
- **Fail-closed** — if a guard (`candleSeriesFault`) can't prove the data is sane, the rung returns
  `missing`, not a guess.
- **`withLastGood`** — on failure, serve the last successful value *with its real date* so the UI
  can badge it STALE instead of reverting to mock.
- **DRAFT** — a record a human must confirm before it becomes the stored street record.
- **Provenance** — per-field `{provider, sourceUrl, retrievedAt}` so a number always carries where it
  came from.
- **Drawer** — Cloudflare secrets. Pages and the cron Worker each have one.
