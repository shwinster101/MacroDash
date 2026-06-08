# MacroDash — Session Handoff · 2026-06-07

**Live:** https://macrodash.pages.dev · footer **v2.6.4** · smoke **51/51** · cron worker **deployed**.
Brain: `CLAUDE.md`. Plans: `ROADMAP_v2.5_v3.0.md`, `REQUIREMENTS_v2.6.md`. Worker deploy: `worker/SETUP.md`.
Version source of truth: **`package.json`** (Vite injects `__APP_VERSION__` → footer). Bump it every release.

---

## State at session start (v2.5.4)

Per the previous handoff (2026-06-06): renamed PULSE→MacroDash, per-tile provenance landed, rule-based
5 Whys, live SPX, mobile-novice pass, the 10am cron flipped to force-refresh. **Open pain:** live tiles
showed *no data date*, so FRED's normal ~1-session SP500 lag (June 5's down close not appearing until
Monday) **looked like a bug**; the regime verdict had **no valuation term** (could scream "MOONING" at a
near-record CAPE); CPI/PCE were mock; rate-odds didn't exist; scrapers reverted silently to mock on failure.

---

## What materially changed this session  (v2.6.0 → v2.6.4, all on `main`)

### Data honesty & freshness (the throughline)
- **Per-tile freshness + STALE badge** (R2/R3, `00335ac`). `snapshot.js` emits a `<field>AsOf` observation
  date per live field; `sources.js` threads a `dataAsOf` map + an `isStale(dateStr)` helper; each tile shows
  "as of <date>" and flips to **STALE** when the feed trails the last completed trading session.
- **`isStale` bug fixed** (`f640f93`, user-caught). Original threshold (`>1 weekday`) never fired for the exact
  case that started this — *Thursday data viewed on Sunday*. Rewritten to count completed weekday sessions
  **strictly between** the data date and today (today excluded). Thu→Sun = STALE ✓, Mon→Tue = fresh ✓.

### Valuation-aware regime (R1, `b4410b1`)
- Added a **6th factor** to the hero vote: Shiller CAPE. Bearish when extreme (`>30` or `>90% of ATH`),
  bullish when reasonable. `RegimeBand` now reads "/6 bullish" with a `VAL` chip. The verdict can no longer
  flash risk-on blind to a ~97%-of-dot-com-peak valuation.

### Three live data sources added (this conversation's main arc)
- **R8 — scraper resilience** (`ff5aabd`, v2.6.2). `withLastGood(env, key, fn)` wraps the scrapers: a success
  writes `pulse:lastgood:<key>` to KV (7-day TTL); a failure serves that **last-good value with its real date**
  (so `isStale` trips STALE) instead of reverting to mock. Mock is the fallback only with no history yet.
- **R9 — live Kalshi FOMC odds** (`45baaa6`, v2.6.3). `fetchRateOdds` hits Kalshi's **public** market-data API
  (no auth/key), takes the nearest open `KXFEDDECISION` event, aggregates its mutually-exclusive buckets
  (H0=hold · C25/C26=cut · H25/H26=hike) by last traded price → normalized **Hold/Cut/Hike %** + live FOMC
  days-out. Verified live: Jun-17 meeting = Hold 99 / Cut 3 / Hike 2. Runs on the R8 rails. The Fed-tile tag
  now reflects real provenance (`Kalshi · live/cached/stale/mock`).
- **R10 — live CPI + PCE YoY** (`aa484b3`, v2.6.4). Ended the CPI-deferred carve-out. `fetchFred` adds
  `PCEPI`/`PCEPILFE`, pulls 20 monthly points for the four inflation series, derives YoY =
  `(latest / 12-months-prior − 1) × 100` + a 6-point YoY trend. Makes the inflation group **and** the regime's
  CPI-trend factor live.

### UI / mobile (the latest audit)
- **Hero-first mobile layout** (`8d7e2e0`, v2.6.1). `RegimeBand` moved **above** the macro strip — the
  "wen moon? → MOONING" verdict now lands first under the header, zero scroll. Screenshot-verified at 375px.
- **Inflation group** — CPI + PCE shown together, **leading with Core PCE** (the Fed's actual target).
- **Legibility fix** (`c166de5`). Cross-asset DirTiles (WTI/Gold/BTC) moved off saturated green/red to soft
  regime tints + subtle border, so prices read clearly.

---

## Where the project is headed

### Immediate (remaining v2.6 P0s)
1. **R7 — exact Jan-1 YTD anchor** in `fetchSpy`. Today YTD uses the oldest-in-window point, so it drifts.
   The last data-honesty gap.
2. **Gate `_diag`** behind `?debug=1`. The lone security-hygiene finding from the audit — `/api/snapshot`
   currently exposes the diagnostics block to the public response.

### v2.5 tail (carry-over hygiene)
- Remove dead `/api/fred` + the legacy cron path (the dashboard is fully on `/api/snapshot`).
- Fold ROADMAP §A locked decisions into CLAUDE.md.
- Pre-push smoke hook (so `node test/smoke.mjs` can't be skipped before a push).
- R11: moon/IPO maintenance — inline constants → config; the SpaceX countdown target (Jun 12) is near.

### v3.0 (the larger overhaul — see ROADMAP)
- UI overhaul; extract the inline `computeRegime`/`regimeFactors` out of `dashboard.jsx` into `src/regime.js`
  so the regime engine becomes **unit-testable** (today it's untested because it lives inline).
- The "$0 / FRED-only" stance holds; Kalshi (also free, no key) is the one sanctioned non-FRED live source.

---

## Verify on next session  (can't be tested from a dev machine)

- **Kalshi from Cloudflare edge IPs.** Kalshi works from a laptop, but Stooq taught us CF edge IPs can be
  blocked. After a Pages redeploy, confirm the Fed tile reads `Kalshi · live` and inflation shows live YoY.
  If Kalshi blocks the edge, it degrades gracefully to `Kalshi · mock` (no breakage) — but the odds won't be live.
- **FRED-YoY on prod.** No local FRED key, so CPI/PCE YoY was verified by logic + smoke only; eyeball the
  inflation group on prod for sane numbers (CPI head ~3–4%, Core PCE ~2.5–3%).

---

## Lessons learned

- **"Looks like a bug" is usually a missing-honesty signal, not a data bug.** The June-5 SP500 lag was
  correct FRED behavior; the real defect was the dashboard not *stating* the data's age. The fix was a badge
  (STALE), not a data change. Surface freshness before debugging "stale" numbers.
- **Build resilience as shared rails, then mount features on them.** Doing R8 *before* R9 meant the new Kalshi
  source inherited last-good→STALE degradation for free, instead of bolting it on. Sequence the foundation first.
- **Re-derive `isStale`-type logic from the calendar, not from a threshold guess.** The off-by-one ("> 1
  weekday") survived until a user hit the Thursday-viewed-Sunday case. Enumerate the boundary days explicitly.
- **A long FRED `limit` is free; over-fetch when a derivation needs history.** YoY needs 13+ monthly points;
  bumping the inflation pull to 20 is a trivial payload and removes the fragility of just-enough fetches.
- **Honest tags beat hiding mock data.** Shipping Kalshi/PCE as visible `· mock` first, then flipping the tag
  to `· live` when the source landed, kept the UI truthful at every step and made the wiring incremental.
- **Verify against the live API from the dev box before shipping a scraper** (Kalshi event/bucket shape,
  aggregation sum) — but remember the edge environment can still differ (IP blocks); the graceful-degradation
  invariant is what makes that residual risk safe.
</content>
</invoke>
