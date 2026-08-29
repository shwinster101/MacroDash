# 2026-08-28 — NFCILEVERAGE disposition: the leverage gauge the board doesn't isolate

**Status: SURVEY + owner thesis — no code changed by this pass.** Disposition of the
"can we already fetch FRED NFCILEVERAGE?" question, plus the motivation the owner stated
after it. When implementation lands, append an Outcomes section per the per-pass protocol.

## The owner's thesis (motivation, verbatim in substance)

Leverage was a key driver of the two defining crashes — **1929** (margin debt: brokers'
loans peaked near 10% of market cap, and the unwind WAS the cascade) and **2008**
(financial-system leverage: broker-dealers at 30:1+, household mortgage leverage, the
shadow-banking chain) — **and MacroDash is not tracking it as its own signal.**

Precision on "not tracking it": NFCI (a voter since v3.43) blends 105 measures, and
leverage measures are AMONG them — so leverage is not absent, it is **diluted into a
composite where its early-warning signal can be averaged away by calm money-market and
credit readings.** The Chicago Fed publishes three subindexes (risk · credit ·
**leverage**), and its own research singles out the leverage subindex as the one that
tends to LEAD — it builds ahead of crises while the composite still reads loose. That is
exactly the 1929/2008 shape: the composite looked fine until the unwind, the leverage
build was visible for years. Isolating the subindex is therefore not indicator-count
inflation (the v5.3 constraint) — it passes the v3.43 moat test the same way NFCI itself
did: retail sites show nothing like it, and this board's value is judging it, dating it,
and abstaining when stale.

## Disposition (as surveyed, chat pass earlier today)

**Can we already fetch it?** **NO.** `NFCILEVERAGE` appears nowhere in the repo. The FRED
series map in `functions/api/snapshot.js` (~490–512, inside `fetchFred`) carries 21 series
incl. `nfci: "NFCI"`; the worker's legacy `SERIES` map (`worker/cron.js:40`) lacks it too.
Every rail it would ride already exists: the batched fetch, per-field last-good
(ENGINE0-CONT §7.1), automatic `AsOf` emission, the `BANDS` gate.

**Would it be dropped before the Five Whys?** It never gets there **by construction**: the
v5.4 chain is generated from `evidenceSet.factors` — the six `REGIME_BAND_TABLE` voters
and nothing else — and smoke pins it ("check 2 contains only canonical factors",
`!/WTI|BTC|HY-IG/`). WTI, BTC, HY-IG and creditTail are all fetched today and none enters
the whys. A context-only NFCILEVERAGE is excluded the same way, no drop logic needed.

## Smallest add (context only — NO 7th voter, NO band verdict)

1. **`functions/api/snapshot.js`** — one `series` entry `nfciLeverage: "NFCILEVERAGE"`
   (same z-score construction as NFCI: mean 0, SD 1, positive = tighter) + one `BANDS`
   entry `[-5, 5]` (the NFCI band verbatim). The generic 5-wide batching absorbs a 22nd
   series with no phase change — but the `(21 now …)` comment at ~:479 must move with the
   count (label-outlives-its-data; no smoke pin on the count, only the comment).
2. **`src/sources.js`** — one `SOURCES` entry (`macro.nfci.leverage`, kind `num`,
   `public`) + `nfciLeverage: "weekly"` in the cadence table. Own `AsOf` from fetchFred so
   NO `DERIVED_OF` row; deliberately NOT in `DAILY` (the idx[5]/idx[21] weeks-vs-days trap
   the existing smoke pin guards for NFCI).
3. **`dashboard.jsx`** — one mock baseline under `macro.nfci` + one sub-line ON the
   existing NFCI tile stating the fact (`leverage subindex −0.31`) — the
   10s30s-on-the-10Y-tile precedent: a stated number, no TIGHT/LOOSE word, hatched and
   suppressed on mock. Storing with no render would mint an orphan on day one (the
   `share_note` lesson, v5.6.9).
4. **Explicitly untouched:** `REGIME_BAND_TABLE`, `evidence.js`, `fiveWhys.js`,
   `/readout.json`, `SIGNAL_FIELDS` (the tokenVolDay precedent), the worker.
5. Skip `nfciLeverageW1` in the smallest cut — a derived delta needs its own `DERIVED_OF`
   row and moves the reconciliation pin; the level alone is the context.

**The upgrade path, if it earns a vote later:** the NFCI arrival rule (v3.43) is the
precedent — arrive non-voting, observe real values, band from first principles in the
index's own unit (an SD-based threshold, the NFCI_LOOSE pattern), then an explicit owner
call to join `computeRegime`. Never silently.

## Existing "leverage" strings in `src/` (vocabulary is unclaimed)

| File | String | Sense |
|---|---|---|
| `src/ttScoreRegistry.js:356-360` | `leveraged daily-reset product…` gate + `leveraged_daily_reset` input | VEH-route TT gate — different sense, no collision |
| `src/dashboard.jsx:124` | AMZN watchlist thesis "retail operating leverage" | curated mock content |
| `src/evidence.js:4` | "highest-leverage improvement" | doc comment |

The financial-conditions sense of "leverage" is unclaimed in `src/`. The TT board's
leverage CIRCUIT (`board.circuit`, the 2.07x reading) lives in `admin.html`/KV — a
dashboard tile sub-line labelled "leverage subindex" shares no screen with it.

## Process note

The original disposition was delivered chat-only, violating the working-notes convention
this branch itself added pins for on 8/28 ("findings live on the BRANCH, not in the
chat"). The owner caught it ("was the disposition written to the branch?"). This file is
the correction — written the same day, with the miss recorded rather than papered over.
