# CLAUDE.md — MacroDash

Macro-intelligence dashboard ("MacroDash"). One responsive URL, mobile-primary, that
answers *"is it safe to be in the market?"* from live macro + market + sentiment
data. Single-page React app on Cloudflare Pages, with live data assembled at the
edge by Pages Functions and cached in KV.

**v3.3 "TT readout" adds a machine-readable regime API.** `/readout.json` (Pages Function
`functions/readout.json.js`, CORS-open, `tt-v1` schema) derives an external trading-terminal
readout from the same per-ET-day snapshot: six band checks → `TAILWIND|NEUTRAL|HEADWIND|PANIC|
INSUFFICIENT` + a **Macro Flip** circuit (armed VIX>22 · tripped SPY<200d AND VIX>25). The pure
mapping lives in **`src/ttReadout.js`** (`DEC-33` band table — it gates real orders, so every
boundary is smoke-tested; **first `functions/`→`src/` import** in the repo, esbuild-inlined).
A **Macro Flip banner** (`FEAT-331`) and **"Copy TT readout" button** (`FEAT-332`) surface the
same on the dashboard — both live-only, rendering nothing on mock/stale (honesty invariant holds).

**Status: v3.2.0 "Cut to the Live Signal" — live FRED (incl. HY-IG credit spreads) + sentiment +
Kalshi + RSS-headline + AI token economics + equity quotes + Shiller CAPE are flowing.** The
dashboard fetches `/api/snapshot` and overlays the mapped `SOURCES` fields (equity + rates +
inflation YoY + sentiment + FOMC odds + top market headline + **personal saving rate** +
**HY-IG credit spread** + **LLM token $/Mtok** + **QQQ/Mag-10 prices** + **Shiller CAPE**) on top
of the mock baseline. **v3.0 differentiator = "AI Unit Economics":** the curated GPU $/hr cost
side is paired with the live LLM token-price demand side (OpenRouter) — the two halves of the AI
margin-compression hinge.
**v3.1 safety invariant: no number a friend could act on may read as live unless it is.**
Mock/no-feed tiles get a diagonal-hatch **ILLUSTRATIVE** treatment, and any directional VERDICT
(BULLISH/BEARISH/BUBBLE) is **suppressed on mock/stale data** (`isIllustrative()`/`IllustrativeChip`/
`ILLUS_HATCH` in `dashboard.jsx`) — a fabricated directional call is worse than a fabricated number.
Each live tile carries per-field provenance (LIVE/CACHED/STALE/MOCK) and an observation date,
with **cadence-aware staleness** (daily/weekly/monthly) and a top-level **Signal Quality**
rollup. The regime vote + 5 Whys **exclude stale/dead inputs**. `_diag` is gated behind `?debug=1`.
**v3.2 default view = live-first (honesty-by-omission):** stale and curated/illustrative content
is **demoted behind per-section `CollapsedGroup` "+N stale/curated" expanders** (`FEAT-321/322` in
`dashboard.jsx`) instead of renting default-view space at full size — Gold (no `SOURCES` key,
permanently curated), the GPU $/hr card, headwinds, IPO strip, Mag-10, and watchlist all default
closed; Signal Quality stays always-visible as the tell. The `demoted()` helper gates on `anyLive`
so pure mock/demo mode (where everything is MOCK by design) never collapses. **CBOE Put/Call is
fully retired** (`DEC-31`: tile, 5-factor regime vote, `SOURCES`, scraper all removed — the free
feed died in 2019; the footer keeps the history note).
**`package.json` `version` is the single source of truth** — Vite injects it as
`__APP_VERSION__` and the footer renders it (the old "footer string is canonical /
package.json is stale" drift is resolved; bump `package.json` on every release).

## Tech stack

- **React 18.3.1** + **Vite 5.3.1** (`@vitejs/plugin-react`). Plain **JSX/JS, ESM**
  (`"type": "module"`). **No TypeScript.**
- **recharts 2.12.7** for charts/sparklines. `lucide-react` is in `dependencies` but
  currently **unused** (no imports) — emoji/SVG glyphs are inlined instead.
- **Styling: inline styles only.** No Tailwind, no CSS modules. Design tokens are JS
  objects `DT` (raw) and `T` (semantic alias) at the top of `dashboard.jsx`. A comment
  cites `design-tokens.json` as "canonical," but that file is **not in the repo** — the
  inline `DT` object is the de-facto source of truth. Keep token edits there.
- **Cloudflare Pages** (static SPA) + **Pages Functions** (`/api/*` at the edge) +
  a separate **Cloudflare cron Worker** (`worker/`). **KV** (`PULSE_CACHE`) for caching.
- **Node ≥17 required for tooling** (`src/sources.js` uses `structuredClone`). The
  machine default may be older — the smoke test errors on Node 14.

## File structure

```
index.html              Vite entry; mounts /src/main.jsx; PWA meta + manifest
vite.config.js          Vite + react plugin (minimal)
manifest.webmanifest    Add-to-Home-Screen
package.json            deps + dev/build/preview scripts + version (SOURCE OF TRUTH)

src/
  main.jsx              React root (StrictMode) → <App/>
  App.jsx               Thin wrapper. Computes publicView from ?view=public or
                        VITE_PUBLIC_VIEW, passes it to <Dashboard/>. Does NOT touch
                        dashboard.jsx (T2 scope rule).
  dashboard.jsx         THE UI (~1.6K lines). MOCK_DATA, design tokens, every
                        component, the rule-based regime engine, footer version.
  useMarketData.js      The ONE data-wiring point (hook). Reads VITE_DATA_MODE.
  sources.js            Pure merge module: SOURCES field map + mergeLiveOverMock()
                        + isStale/cadenceOf/parseObsDate. No React → Node-testable.
  fiveWhys.js           Pure rule-based 5-Whys generator (no React, no LLM, $0);
                        smoke-tested.
  ttReadout.js          Pure TT regime/Macro-Flip mapping (DEC-33 band table).
                        Imported by dashboard.jsx, functions/readout.json.js
                        (first functions→src import), and smoke. React-free.

functions/              Cloudflare Pages Functions (run at the edge, same origin)
  _middleware.js        Security headers; keeps /api same-origin (no CORS).
  api/snapshot.js       ACTIVE live source. Assembles FRED + FRED-SP500 + CNN F&G +
                        Kalshi + RSS + OpenRouter + Finnhub + multpl. Holds
                        env.FRED_KEY. Per-ET-day KV cache.
  api/fred.js           Legacy/fallback. Reads ONLY the cron-written KV key
                        (pulse:macro:latest); has NO key, makes NO upstream calls.
  readout.json.js       /readout.json — public tt-v1 regime readout (CORS-open).
                        Reads the day's snapshot KV (subrequest /api/snapshot on
                        miss); maps via src/ttReadout.js. No new infra/cron.

worker/                 SEPARATE Cloudflare Worker (not part of Pages)
  cron.js               Scheduled handler: pulls FRED twice daily → writes KV
                        pulse:macro:latest (+ optional POST /refresh warm).
  wrangler.toml         Worker config: PULSE_CACHE binding + cron triggers (UTC).

test/
  smoke.mjs             No-network smoke test: 116 assertions over mergeLiveOverMock
                        + SOURCES-path resolution against the real MOCK_DATA + the
                        5-Whys engine + DEC-31 guards + the TT band table (DEC-33).
```

## Data flow (how mock becomes live)

```
dashboard.jsx  →  useMarketData(MOCK_DATA, {publicView})  →  fetch /api/snapshot
                                                                     │
        mergeLiveOverMock(mock, payload)  ←──────────────  { live:{…}, cached, asOf }
                     │
   overlays ONLY mapped SOURCES paths; everything else stays mock
                     │
        badge = MOCK | LOADING | LIVE | CACHED   (shown in header + source boxes)
```

- **Mock-first / graceful degradation is the core invariant.** `MOCK_DATA` in
  `dashboard.jsx` is the always-present baseline. Live values overlay only the exact
  paths declared in `sources.js`. Any fetch/parse failure, an empty `live`, or an
  invalid value → silent fallback to mock. **The dashboard never breaks on bad data.**
- `sources.js` `SOURCES` maps each flat snapshot field → a dotted `MOCK_DATA` path +
  a `kind` (`num` | `series` | `str`) that is validated before overlay. `setPath` clones
  (never mutates) the mock.
- `displayClass` (`public` | `citation` | `licensed`) drives the public view. On
  `?view=public`, `licensed`-class fields are skipped. (Today nothing is `licensed` in
  the snapshot path, so public == full for live data; the mechanism is wired for later.)

## Data sources

### FRED (`fetchFred` in `functions/api/snapshot.js`)
St. Louis Fed API (`api.stlouisfed.org`), keyed by `env.FRED_KEY`. Pulls these series,
takes the latest non-`"."` observation, and derives 1-day deltas + sparklines:

`DGS10` (10Y) · `FEDFUNDS` · `CPIAUCSL` (CPI headline) · `CPILFESL` (CPI core) ·
`PCEPI` (PCE headline) · `PCEPILFE` (PCE core) · `UNRATE` · `CIVPART` (LFPR) ·
`PSAVERT` (personal saving rate, v3.0) · `MORTGAGE30US` · `DCOILWTICO` (WTI) · `VIXCLS` (VIX) ·
`CBBTCUSD` (BTC) · `BAMLH0A0HYM2` (HY OAS) + `BAMLC0A0CM` (IG OAS) → the derived **HY-IG credit
spread** (widening = bearish leading indicator).

(Gold has **no live source** — it's a curated `Manual` series with no `SOURCES` key, so its tile
is permanently ILLUSTRATIVE and demoted behind the Cross-Asset expander.)

The four **inflation** series (CPI/PCE × headline/core) are price *indexes*; the dashboard
wants **YoY %**, so for those `fetchFred` pulls 20 monthly points and derives
`(latest / 12-months-prior − 1) × 100` plus a 6-point YoY trend (FEAT-R10, v2.6.4).

### FRED-SP500 proxy (`fetchSpy` in `functions/api/snapshot.js`)
Equity prices come from **FRED's `SP500` index, not a stock API** — Stooq blocks
Cloudflare edge IPs, so SPY is sourced from the same proven FRED path. **`SPY ≈ SP500
/ 10`** (the ETF was designed at ~1/10 of the index). From a 220-point pull it computes
`spyPrice`, `spyChangePct`, `spyYtd` (anchored to the most recent prior-year close — the exact
Jan-anchor shipped; see `snapshot.js` ~318–328), `spyMa100`, `spyMa200`, and a 20-pt sparkline.

### Scrapers (sentiment, also in snapshot.js)
- **CNN Fear & Greed** (`fetchFearGreed`): `production.dataviz.cnn.io/.../graphdata/<YYYY-MM-DD>`.
  Needs a full desktop Chrome UA + Accept + Origin/Referer = `edition.cnn.com`, else 418.
- **CBOE Put/Call: RETIRED (DEC-31, v3.2).** The free feed died in 2019; the scraper, tile,
  SOURCES entry, and regime vote (now 5-factor) are all removed. The footer keeps the note.
- **Kalshi FOMC rate odds** (`fetchRateOdds`, FEAT-R9, v2.6.3): public market-data REST
  API (`api.elections.kalshi.com`, no auth/key). Takes the nearest open `KXFEDDECISION`
  event and aggregates its mutually-exclusive buckets (H0=hold · C25/C26=cut ·
  H25/H26=hike) by last traded price → normalized hold/cut/hike % + FOMC days-out.
- **Top market headline** (`fetchHeadline`, FEAT-NEWS, v2.9.0): the one non-FRED, non-market
  *news* source. Top item from a market RSS feed (Dow Jones/MarketWatch `mw_topstories`;
  CNBC fallback). DATE-VERIFIED: parses the item `pubDate` and only accepts a headline ≤~3
  days old, emitting its real ET date so `isStale` guards it. Feeds **WHY #3** of the 5 Whys.
  Source + date are attributed (no automated claim-fact-checking; reputable wire + date gate).
- **AI token economics — the moat** (`fetchTokenomics`, v3.0): OpenRouter's **public** models
  API (`openrouter.ai/api/v1/models`, no key — like Kalshi). Blends a frontier-model basket
  into a median **$/Mtok** (3:1 in:out), tracks the cheapest-frontier floor, and accrues a
  rolling 12-pt trend in KV (`pulse:tokentrend`). Falling $/Mtok = intelligence commoditizing
  → the demand-side mirror of the curated GPU $/hr supply squeeze. Rendered as the
  **"AI Unit Economics"** section (TokenomicsCard beside GpuPricingCard). Emits via SOURCES
  `tokenBlendedMtok`/`tokenTrend`/`tokenModelsJson` (weekly cadence). On the `withLastGood` rails.
- **Equity quotes** (`fetchEquities`, v3.0): **Finnhub** free-tier (`finnhub.io/api/v1/quote`,
  `env.FINNHUB_KEY`) for **QQQ** + the 9 public **Mag-10** tickers — the equities FRED can't
  source. Quotes (price + change%) go live; Mag-10 **fundamentals stay curated** (reviewed
  date). KEY-GATED: no key → throws → mock (invariant holds). `mag10PricesJson` is a JSON
  passthrough merged onto the `mag10` array by ticker at render. On the `withLastGood` rails.

- **Shiller CAPE** (`fetchShiller`, v3.1): scrapes multpl.com for the current Shiller PE — the
  regime's valuation vote, which used to be mock-and-always-voting. Now live (monthly
  cadence) on the `withLastGood` rails; gated by `use("valuation")` in `computeRegime` so it
  drops from the vote when STALE. On mock/stale it shows the ILLUSTRATIVE treatment (no BUBBLE).

> **Scraper resilience (FEAT-R8, v2.6.2):** the scrapers (F&G, Kalshi, headline,
> tokenomics, equities, shiller) run
> through `withLastGood(env, key, fn)` — a success writes `pulse:lastgood:<key>` to KV
> (7-day TTL); a failure serves that last-good value (with its real date, so `isStale`
> flags it STALE) instead of reverting to mock. Mock is the fallback only when there is
> no last-good yet.

## Cloudflare deployment

### Pages (the site + `/api/*`)
- Connect repo in **Workers & Pages → Pages → Connect to Git**. Preset **Vite**,
  build `npm run build`, output **`dist`**. Every push to `main` auto-redeploys.
- **`PULSE_CACHE` KV** must be bound to the Pages project (namespace id
  `78ad3346a8fe4757a906283c4bc81a5e`).
- **`FRED_KEY` secret** set in **Pages → Settings → Variables & Secrets**. Read by
  `snapshot.js` as `env.FRED_KEY`. **Secrets live only in Functions/Worker env — never
  in `src/`** (the browser only ever talks to `/api/*`, which holds no key in `fred.js`).
- **`FINNHUB_KEY` secret** (v3.0, optional but needed for live QQQ/Mag-10 prices) set the
  same way. Read by `fetchEquities` as `env.FINNHUB_KEY`; **without it those tiles stay mock**
  (graceful degradation, nothing breaks). Free tier is enough (~10 symbols once/ET-day).
  **Post-deploy: verify Finnhub isn't edge-IP blocked** the way Stooq was — `?debug=1` →
  `_diag.equities` should read `ok:N`; if blocked, swap to Twelve Data (same shape). The
  tokenomics moat (OpenRouter) needs **no key**.
- `_middleware.js` adds hardening headers (`nosniff`, `x-frame-options: DENY`,
  `permissions-policy`, etc.) and keeps `/api` same-origin (no `Access-Control-Allow-Origin`).

### Cron Worker (`worker/`, deployed separately)
- `cd worker && npx wrangler deploy`; `npx wrangler secret put FRED_KEY`.
- Binds the **same `PULSE_CACHE` KV namespace** (so its writes are visible to Pages).
- Two weekday crons (UTC, anchored to **PDT** — see the DST note in `wrangler.toml`;
  shift +1h for PST twice a year). Writes `pulse:macro:latest` with a 26h TTL.
- **This is the older "stage-1" path.** The dashboard has flipped to `/api/snapshot`;
  `/api/fred` + the cron Worker remain deployed as a fallback/safety net.

### The `VITE_DATA_MODE=live` flip
`useMarketData.js` reads `import.meta.env.VITE_DATA_MODE` (Vite **build-time** env):
- **`mock` (default)** — no network at all; the dashboard renders pure `MOCK_DATA`.
- **`live`** — fetch `/api/snapshot` on mount and overlay.

**`.env.production` now commits `VITE_DATA_MODE=live` as the build default** (v2.8.1), so
production builds (incl. Cloudflare Pages) fetch live without any dashboard setting. An
explicit `VITE_DATA_MODE` var in the Pages build env still **overrides** the file (Vite
precedence), so set it to `mock` there to force demo. Either way it's baked at build time,
not read at runtime. Mock remains the always-present runtime fallback (graceful degradation).
(`VITE_PUBLIC_VIEW=true` is the analogous build flag for forcing the public view.)

### Per-day cache pattern (`snapshot.js`)
- Cache key is **`pulse:snapshot:v5:<ET-date>`** (`<ET-date>` = today in America/New_York,
  `YYYY-MM-DD`). Bump the `v5` prefix to invalidate a poisoned day.
- **First load each ET morning** misses → fetches fresh (FRED's prior close has settled
  overnight) → write-through. **Every load the rest of the day** hits KV → instant,
  badge = `CACHED`. *Your morning visit is the refresh trigger* — the snapshot path needs
  no cron.
- **Write-through only when healthy**: requires `spy` fulfilled AND ≥6 FRED fields. A
  degraded pull is returned but **never cached**, so a bad morning can't lock in for the day.
- `CACHE_TTL` is 48h (cleanup only); the per-day **key** is what drives freshness.
- Fetches run in **phases** (FRED batched ≤5, then SPY + 2 scrapers) to stay under
  Cloudflare's ~6-connection cap — saturating it makes queued calls time out. Don't
  collapse these back into one big `Promise.all`.

## Commands

```bash
npm install
npm run dev        # Vite dev server (mock unless VITE_DATA_MODE=live in .env)
npm run build      # → dist/  (what Pages runs)
npm run preview    # serve the built dist/

node test/smoke.mjs   # 116-assertion no-network smoke test (needs Node ≥17)

# Cron Worker (separate deploy):
cd worker && npx wrangler deploy
npx wrangler secret put FRED_KEY
```

There is **no `test` script in `package.json`** — run the smoke test directly. It loads
the real `MOCK_DATA` out of `dashboard.jsx` to catch `sources.js` ↔ dashboard drift, so
it must stay green when you touch either file or any `SOURCES` path.

## Conventions worth knowing

- **Ticket tags in comments** (`FEAT-NNN`, `AS2-NN`, `DEC-NN`, `DECISION-N`) trace each
  change back to a spec item. Match the style when adding features.
- **One wiring point**: all live-data plumbing goes through `useMarketData` + `sources.js`.
  Add a live field by mapping it in `SOURCES` and emitting it from `snapshot.js` — don't
  reach into `dashboard.jsx` to fetch.
- **`App.jsx` must not modify `dashboard.jsx`** (T2 scope rule). The `publicView` Zone-E
  gate is wired but currently has nothing to hide (no private section in this build).
- Keep the inline `DT` design tokens as the styling source of truth; reuse `T.*` aliases.

---

<!-- The sections above are derived from the code. The notes below capture decisions
     and conventions that are NOT visible in the source — fill in / correct as needed. -->

## Project conventions & locked decisions

### Working rhythm (per-pass protocol)

- **Before every pass**, review what has materially changed since the last response.
- **End every pass with**, in this order:
  - **Completed** — what got done this pass (**max 2 bullets**).
  - **Highest-leverage question** the maintainer can answer (1 bullet).
  - **Highest-leverage next move** (1 bullet).

_(More locked decisions — `ROADMAP_v2.5_v3.0.md` Section A — to be folded in during roadmap Phase 0.)_
