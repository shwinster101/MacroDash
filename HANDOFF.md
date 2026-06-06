# MacroDash — Session Handoff · 2026-06-06

**Live:** https://macrodash.pages.dev · footer **v2.5.4** · smoke **41/41** · cron worker **deployed**.
Brain: `CLAUDE.md`. Plans: `ROADMAP_v2.5_v3.0.md`, `REQUIREMENTS_v2.6.md`. Worker deploy: `worker/SETUP.md`.

---

## What materially changed this session

Took the build from **v2.0.2** (renamed-but-rough) through a chain of shipped increments — all on `main`.

### Data honesty (the centerpiece)
- **Per-tile provenance.** `sources.js` `mergeLiveOverMock` emits a `{field → LIVE|CACHED|MOCK}` map,
  threaded via `useMarketData` to **13 tile badges** that now show *real* status (was hardcoded `MOCK`
  under a LIVE header). Source labels corrected (SPY/VIX/WTI/BTC: `FMP`/`CBOE` → **FRED**; Gold/Mag10 →
  `Manual`). Killed the false **"Anthropic API live"** and **"Triggers fire on live data"** claims.
- **Rule-based 5 Whys.** New `src/fiveWhys.js` (pure, **$0**, no LLM/cron/secret) —
  `computeFiveWhys(data, regime)` builds a session-aware 5-point narrative from the live snapshot.
  Replaced the static mock; all 5 render.
- **Live SPX.** `fetchSpy` now emits the raw S&P 500 index (`spxIndex`) from the SP500 data it already
  pulls (**zero extra fetch**); shown under SPY. SPX was the last free zero-cost field.

### UI / personality
- **Mobile-novice pass** (per the T4-SMOKE audit): un-hid the tagline + regime "why" chips on mobile,
  added "end-of-day, not real-time", jargon tooltips. 375px re-smoke **PASS**.
- **"Wen moon?"** — regime band reframed from "is it safe?" → "wen moon?"; verdict shows
  **MOONING / HODL / DIAMOND HANDS** mapped from RISK-ON / MIXED / RISK-OFF (RISK-ON kept as subtitle).
- **Moon Meter + IPO Countdown** — committed the operator's WIP as a baseline, then cleaned up: IPO strip
  horizontal-scrolls on mobile (was 3 stacked cards) + honest `MOCK · curated · speculative` tag; moon
  badge hidden on mobile.

### Correctness (dev-agent review — all fixed in v2.5.4)
- Merge clones the mock **once** per merge (was once *per field*).
- Undo toasts **stack** (was single-overwrite → a rapid second delete lost the first's undo).
- IPO countdown interval **stops at expiry** (was ticking forever post-launch).
- Mag-10 public list **actually sorts by market cap** (the "SORTED BY MKT CAP" label was unenforced).

### Infra & hygiene
- Version single-source (footer reads `package.json`); Node pinned (`.nvmrc` 22 + `engines`).
- **Security:** untracked `worker/.wrangler/cache/wrangler-account.json` — it exposed the Cloudflare
  account id + email on the public repo.
- **10am-ET force-refresh cron** (`worker/cron.js`): each weekday it busts the per-ET-day snapshot cache
  key, waits ~3s for KV to propagate, then re-fetches — pulling FRED's freshest. **Deployed**
  (`macrodash-cron`, 3 crons live).

### Key finding
**FRED's `SP500` series lags the tape by ~1 trading day.** With the per-day "first-load-wins" cache, an
early-morning first load can lock in a pre-FRED-update value for the whole day — which is exactly why
June 5's down close wasn't showing on June 6 morning. The force-refresh cron is the structural fix.

Smoke grew **28 → 41** assertions.

---

## Architecture (full detail in CLAUDE.md)
- **One wiring point:** `useMarketData` + `sources.js`. Add a live field by mapping it in `SOURCES` and
  emitting it from `functions/api/snapshot.js`.
- **Live path:** `dashboard.jsx` → `useMarketData` (`VITE_DATA_MODE=live`) → `/api/snapshot`
  (FRED + FRED-SP500 + CNN F&G + CBOE P/C) → `mergeLiveOverMock` overlays mock. Per-ET-day KV cache.
- **Mock-first:** any fetch/parse failure → silent fallback to `MOCK_DATA`. Never breaks.
- **$0 / FRED-only** stance; rule-based (no LLM) where possible.

---

## Pending / known state
- **v2.5 cleanup tail** (not done): remove dead `/api/fred` + legacy worker FRED crons (#2), gate `_diag`
  behind `?debug=1` (#3), fold roadmap §A into CLAUDE.md (#8), pre-push smoke hook (#9).
- **Moon/IPO maintenance (R11):** move inline `IPO_TARGETS` / `WEN_MOON_*` constants to config; **SpaceX
  countdown hits June 12** — validate the `isTrading` flip; respect `prefers-reduced-motion`.
- Legacy `/api/fred` + the worker's FRED→`pulse:macro:latest` path still deployed but **dead** (the
  dashboard reads `/api/snapshot`). The new 10am force-refresh shares the same worker.

---

## Highest-leverage enhancements (recommended next, ranked)
1. **Per-tile freshness + STALE badge** (v2.6 R2/R3) — thread the snapshot/series `asOf` into each
   `SourceBox` ("as of Jun 4") and light up the unused **STALE** badge when data trails the trading day.
   Directly fixes the "is this current?" gap FRED's lag creates. *Lowest effort, highest immediate value.*
2. **Valuation-aware regime** (v2.6 R1) — the "wen moon? → MOONING" hero has **no valuation factor**; it
   can flash MOONING at ~97% of the dot-com CAPE peak (Shiller 42.8, already in `macro.shillerPe`). Add a
   6th Shiller-PE-percentile factor. *Highest product-honesty value.*
3. **CPI YoY live** — the last free field (`CPIAUCSL`/`CPILFESL` already fetched), but deliberately
   deferred to v3.0; enabling it overrides that locked decision + needs YoY derivation.
4. **Real alert delivery** — alerts are decorative today; wire Cloudflare email / web-push on live
   thresholds (VIX spike, 10Y > 5%, F&G extreme).
5. **v3.0 (bigger):** mobile-first redesign + split `dashboard.jsx` (~1100 lines) into components;
   extract `design-tokens.json`. Start with a claude.ai design thread per the roadmap.

---

## Deploy / verify
- **Site:** push to `main` → Cloudflare Pages auto-deploys. Build `npm run build` (Node ≥18);
  smoke `source ~/.nvm/nvm.sh && nvm use 22 && node test/smoke.mjs`.
- **Worker:** deploys **separately** — `cd worker && npx wrangler deploy` (see `worker/SETUP.md`).
  Crons live: `30 12` / `0 21` (legacy FRED, PDT) + `0 14` (10am ET force-refresh).
  **DST:** in November flip `0 14`→`0 15` (and the legacy crons +1h) for standard time.
- **Manual data refresh** (force fresh now):
  `npx wrangler kv key delete --remote --namespace-id 78ad3346a8fe4757a906283c4bc81a5e "pulse:snapshot:v5:<ET-date>"`
  then load the dash (or curl `/api/snapshot`).
