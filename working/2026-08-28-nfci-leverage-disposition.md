# 2026-08-28 — NFCILEVERAGE disposition: the leverage gauge the board doesn't isolate

**Status: SHIPPED — see Outcomes at the foot; the survey above is the pre-implementation record.** Disposition of the
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

---

# Outcomes — 2026-08-28 (implemented same day, plus one extra render home)

Shipped per the smallest-add plan, with the owner's addition of a second render home: the
open Five Whys footer. Gates: **2053 smoke + 306 render + 198 public-render**, real
Chromium under `REQUIRE_BROWSER=1`, `audit:prod` clean.

## What shipped

- `functions/api/snapshot.js` — `nfciLeverage: "NFCILEVERAGE"` in the series map, BANDS
  `[-5, 5]` (NFCI's verbatim), the `(21 now …)` batch comment moved to 22 with the count.
  Generic emission only: `nfciLeverage` + `nfciLeverageAsOf`, no derived keys.
- `src/sources.js` — `macro.nfci.leverage` (num, public, own AsOf) + weekly cadence. It
  joined the smoke partition's `PRIMARY_ASOF_FIELDS` (74 → 75 keys) — its own FRED pull,
  never derived from parent nfci: a fresher parent must not launder a stale subindex.
- `dashboard.jsx` — mock `leverage: -0.31` under `macro.nfci`; ONE `levCtx` derivation
  (value · asOf · live, where live = LIVE/CACHED and finite) passed to BOTH FiveWhys call
  sites — sections stay presentation-only.
- **Render home 1** — NFCI tile sub-line `leverage subindex −0.55`: number only, no
  TIGHT/LOOSE word, suppressed on mock/stale like the tile's own verdict.
- **Render home 2** — open-whys footer: `Leverage subindex −0.55 as of {date} · context,
  not a vote` when live; `Leverage subindex not loaded` on mock/stale/error/loading. NOT a
  sixth check, NOT in `evidenceSet.factors` — the factor-only smoke pin stayed green
  untouched, which is the structural proof the chain never absorbed it.
- **Untouched, verified by pin:** `REGIME_BAND_TABLE`, `computeRegime`/`evidence.js`,
  `/readout.json` (`ttReadout.js` swept), `SIGNAL_FIELDS`, `DAILY`, the worker.

## Corrections / catches this pass earned

1. **The working-notes guard caught its own author on day two.** The snapshot.js comment
   cited this note's `working/` path; the "no product surface may reference working/" pin
   (added 8/28) went red. The pin is right — the citation became a date tag. First real
   catch for that guard.
2. Two smoke draft errors caught by the run, not review: `sourcesSrc` never existed
   (sources.js is IMPORTED in smoke, so the pin now runs against the real `SOURCES` /
   `cadenceOf` / `DERIVED_OF` objects — stronger than a source-text regex), and
   `evidenceSrc` sat in TDZ below the new section (direct `readSrc`).
3. Two pre-existing call-site pins re-anchored for the `leverage={levCtx}` prop (claims
   unchanged).

## Negative controls (restored green after)

- Footer gate removed (`leverage.live&&` dropped) → 2 red, one of them the BROWSER-driven
  loading-scenario pin — i.e. the mock −0.31 literally rendered as a live-looking number,
  which is the exact defect the gate exists to stop.
- Series entry removed → the wiring pin red.

## Still open

- The upgrade path (a vote) stays owner-gated per the NFCI precedent: observe real values
  first, band in the index's own unit, explicit call. Nothing here moved the majority math.
- First live fetch is the real schema check — FRED is 403 from this build environment, so
  NFCILEVERAGE's first observation lands on deploy, on the existing per-field last-good
  rails either way.

---

# Outcomes — 2026-08-29 (owner relocation: strip in, whys footer out)

Owner, on the live Simple screen: *"I feel like it would go perfectly next to CPI below F&G
— is that the idea?"* It was **not** — and the owner's placement is better than mine. The
8/28 build put leverage in a Power-mode collapse and a one-tap-deep whys footer, so on the
Simple screen a **leading crash indicator was invisible**. That cannot do the job it was
added for.

**The relocation:** the whys footer is RETIRED; a `LEV` tile joins the macro strip. Two
homes remain, at two genuine altitudes — **strip = glance**, **NFCI tile sub-line =
detail** (the only place the parent/subindex relation is legible). Gates: **2056 smoke +
306 render + 200 public-render**, real Chromium under `REQUIRE_BROWSER=1`, audit clean.

## Why the strip is structurally right (not just more visible)

The strip was **already built to carry non-voting context tiles.** SPY*, QQQ and FED are
context-only today: `votingFields` is derived from `FACTOR_FIELD`'s values, so a field that
is not a factor gets **no ▪ marker** and the tooltip *"Context only — does not vote"*
**by construction** (v3.62/v3.98.4). `nfciLeverage` is not a factor, so the honest label
required no special case — and a smoke pin now asserts that derivation rather than the
label text, so the day someone makes it a voter the marker follows automatically.

It also fills the strip's ragged 8th slot: the phone grid is `repeat(4,1fr)` with 7 tiles,
so row 2 col 4 was empty — the tile costs zero vertical space.

## The one convention difference, stated

The strip's honesty mechanism is the **provenance dot + "(mock)" tooltip**, applied
uniformly to all 8 tiles — it does NOT blank a value on mock the way the NFCI tile sub-line
and the retired footer did. Following the strip's own convention was chosen over inventing
a per-tile exception: a single tile rendering "—" inside a 4-col grid of numbers reads as
broken, and an inconsistent honesty rule *within one component* is worse than a uniform one.
The tile does render `—` for a genuinely non-finite value (pinned), which is the different
case: absent data, not stale data.

## Negative controls (restored green after)

- LEV tile removed from the strip → 4 red (2 smoke, 2 browser-driven).
- Whys footer re-added → the retired-footer pin red.

## Acceptance (real built bundle, Chromium — the branch preview host is egress-blocked here)

LEV on the strip with `-0.55` and `0 = avg` · no ▪ marker · tooltip *"Context only — does
not vote"* · **no** leverage claim anywhere in the whys, live or loading · mock path marks
itself `(mock)` in the tooltip · Power NFCI sub-line still `leverage subindex -0.55` with no
verdict word · hero **6 of 6 voters counted** in both modes, never 7 of 7.
