# MacroDash — Session Handoff · 2026-07-18 (v3.3.0)

**Live:** https://macrodash.pages.dev · footer **v3.3.0** on next deploy · smoke **116/116**.

## What shipped this session (v3.3.0 "TT readout")

The maintainer runs a trading-terminal framework whose Engine 0 consumes a MacroDash regime
read before every order — previously a manual paste. This turns MacroDash into an API:

- **`/readout.json`** (`functions/readout.json.js`, `FEAT-330`) — CORS-open `tt-v1` JSON:
  six band checks → `TAILWIND|NEUTRAL|HEADWIND|PANIC|INSUFFICIENT`, per-check audit trail,
  Macro Flip circuit. Derived from the same per-ET-day snapshot (KV read; subrequest
  `/api/snapshot` on miss, which also warms KV) — **no new cron/infra**. At `/readout.json`
  (not `/api/*`) so `Access-Control-Allow-Origin: *` survives `_middleware`. Whitelist
  projection means `_diag` can't leak; empty/failed live → schema-stable INSUFFICIENT body.
- **`src/ttReadout.js`** (`FEAT-330`/`DEC-33`) — the pure mapping table. **It gates real
  orders**, so all 35 band boundaries are smoke-tested (81→116). **First `functions/`→`src/`
  import** in the repo — verified `wrangler pages functions build` inlines it.
- **Macro Flip banner + "Copy TT readout" button** (`FEAT-331`/`FEAT-332`, `dashboard.jsx`) —
  both live-only; render nothing / disable on mock/stale (honesty invariant).
- **Bugfix**: `worker/cron.js` 10 AM force-refresh deleted `v5` while snapshot writes `v15` —
  it had been inert. Fixed + SYNC-hazard comments in all three files that share the key literal.

**Verified:** smoke 116/116 after every commit; `npm run build` clean; `wrangler pages dev` →
`/readout.json` returns 200/JSON/ACAO:*/max-age=300, verdict INSUFFICIENT with no key, no
`_diag` leak, `?debug=1` exposes kv_key; Chromium — banner absent + TT button disabled in mock,
an intercepted TRIPPED payload renders the red banner and copies a correct PANIC/TRIPPED block.

## Verify on next session / deploy

- **The cron Worker is a SEPARATE deploy** — `cd worker && npx wrangler deploy` is required
  or the v5→v15 fix is dead code. Confirm next trading morning that the 10 AM warm actually
  busts `v15` (`?debug=1` on `/api/snapshot` after 10:01 ET).
- `curl -sI https://macrodash.pages.dev/readout.json` → `access-control-allow-origin: *` +
  `cache-control: public, max-age=300`; `curl -s .../readout.json | jq .regime.verdict` sane;
  foreign-origin `curl -H "Origin: https://example.com"` still returns the body.
- **TT framework doc note for the maintainer:** the readout is `next-meeting` Fed odds (not
  "by Dec") and QQQ/SPY RS is `basis:"1d"` only — both flagged in the JSON + paste block.
  The doc's §1.2 schema should adopt these field names; §1 "cannot be fetched programmatically"
  is now false.

---

# MacroDash — Session Handoff · 2026-07-18 (v3.2.0)

**Live:** https://macrodash.pages.dev · footer **v3.2.0** on next deploy · smoke **81/81**.
Brain: `CLAUDE.md` (reconciled this session — it had drifted at v3.1.0 wording; `AGENTS.md` is
now a thin pointer to it, no longer a dual-maintained copy).

## What shipped this session (v3.2.0 "Cut to the Live Signal")

Repo audit first (prod ↔ repo confirmed in sync at v3.1.2; docs were not — see below), then the
declutter sprint the maintainer asked for ("too much on the one page, especially the stale data"):

- **DEC-31 — CBOE Put/Call fully retired.** The free feed died in 2019; since v3.1 the field was
  stale-excluded daily while still renting a full card ("n/a — retired '19"), a strip slot, and
  every denominator. Removed end-to-end: tile, strip entry, regime vote (**6→5 factors, ≥3 = strict
  majority; live verdicts unchanged in practice**), Signal Quality (14 tracked), 5-Whys lists,
  `SOURCES`, `fetchPutCall`. Footer keeps the history note. No KV cache bump needed (merge iterates
  `Object.keys(SOURCES)`; `pulse:lastgood:putcall` ages out on TTL).
- **FEAT-321/322 — live-first default view (honesty-by-annotation → honesty-by-omission).**
  New `CollapsedGroup` expander (the ONE demotion idiom, styled after the v3.1 IPO toggle) +
  `demoted()` = `anyLive && isIllustrative(modeOf(f))`. Live signals own the default scroll;
  stale tiles and curated content (Gold — which has **no SOURCES key**, permanently Manual —
  GPU $/hr, headwinds, Mag-10, watchlist) collapse behind "+N stale/curated" toggles.
  **The `anyLive` guard is load-bearing:** pure mock/demo mode collapses nothing (mock IS the
  baseline). v3.1 safety invariant untouched — collapsing is a render concern only.
- **fix — illustrative chip no longer forces 390px horizontal scroll** (pre-existing v3.1 nit:
  nowrap chip in a ~110px DirTile pushed the page 28px wide; verified 0px in Chromium).

**Verified:** smoke 81/81 after every commit · `npm run build` clean · Chromium render at 390px +
1280px — no page errors, no x-scroll, expanders open/close, mock mode collapses nothing
provenance-dependent, footer reads v3.2.0 + retirement note.

## Doc reconciliation (the audit's top finding)

`README.md` was v1.6.1-era, `AGENTS.md` frozen at v2.6.4 (missing tokenomics/Finnhub/Shiller/
HY-IG/fiveWhys.js), and this file listed **R7 (exact Jan-1 YTD)** and **`_diag` gating** as open
P0s — both had already shipped (`snapshot.js` ~318–328 anchors YTD to the prior-year close;
`_diag` is `?debug=1`-gated). All reconciled; `REQUIREMENTS_v2.6.md` carries a SUPERSEDED banner.

## Verify on next session / deploy

- Prod (after Pages redeploys `main` with these changes): footer v3.2.0; strip = 7 entries;
  RegimeBand chips `10Y VIX F&G CPI VAL`, "N/5 bullish"; Signal Quality "of 14 tracked";
  STALE tiles migrate into the signal-tile expander; `?debug=1` `_diag` no longer lists putCall.
- Still open (deferred deliberately): remove dead `/api/fred` + legacy cron path (own PR);
  pre-push smoke hook; `CollapsedGroup` touch targets are thin (`padding:"6px 0"`, same as the
  v3.1 IPO toggle precedent) — revisit if 44px targets become a hard requirement.

---

# Previous handoff · 2026-06-07 (v2.6.4)

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
