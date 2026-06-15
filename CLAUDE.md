# CLAUDE.md — MacroDash

Macro-intelligence dashboard ("MacroDash"). One responsive URL, mobile-primary, that
answers *"is it safe to be in the market?"* from live macro + market + sentiment
data. Single-page React app on Cloudflare Pages, with live data assembled at the
edge by Pages Functions and cached in KV.

**Status: v2.9.1 — live FRED + sentiment + Kalshi + RSS-headline data is flowing.** The
dashboard fetches `/api/snapshot` and overlays the mapped `SOURCES` fields (equity + rates +
inflation YoY + sentiment + FOMC odds + top market headline) on top of the mock baseline.
Each live tile carries per-field provenance (LIVE/CACHED/STALE/MOCK) and an observation date,
with **cadence-aware staleness** (daily/weekly/monthly) and a top-level **Signal Quality**
rollup. The regime vote + 5 Whys **exclude stale/dead inputs** (e.g. the retired 2019 CBOE
Put/Call, whose tile now renders `n/a` rather than the relic). `_diag` is gated behind `?debug=1`.
**`package.json` `version` is now the single source of truth** — Vite injects it as
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
package.json            deps + dev/build/preview scripts (version field is STALE)

src/
  main.jsx              React root (StrictMode) → <App/>
  App.jsx               Thin wrapper. Computes publicView from ?view=public or
                        VITE_PUBLIC_VIEW, passes it to <Dashboard/>. Does NOT touch
                        dashboard.jsx (T2 scope rule).
  dashboard.jsx         THE UI (~880 lines). MOCK_DATA, design tokens, every
                        component, the rule-based regime engine, footer version.
  useMarketData.js      The ONE data-wiring point (hook). Reads VITE_DATA_MODE.
  sources.js            Pure merge module: SOURCES field map + mergeLiveOverMock().
                        No React → unit-testable in Node.

functions/              Cloudflare Pages Functions (run at the edge, same origin)
  _middleware.js        Security headers; keeps /api same-origin (no CORS).
  api/snapshot.js       ACTIVE live source (v2.0.2). Assembles FRED + FRED-SP500 +
                        CNN F&G + CBOE P/C. Holds env.FRED_KEY. Per-ET-day KV cache.
  api/fred.js           Legacy/fallback. Reads ONLY the cron-written KV key
                        (pulse:macro:latest); has NO key, makes NO upstream calls.

worker/                 SEPARATE Cloudflare Worker (not part of Pages)
  cron.js               Scheduled handler: pulls FRED twice daily → writes KV
                        pulse:macro:latest (+ optional POST /refresh warm).
  wrangler.toml         Worker config: PULSE_CACHE binding + cron triggers (UTC).

test/
  smoke.mjs             No-network smoke test: 28 assertions over mergeLiveOverMock
                        + SOURCES-path resolution against the real MOCK_DATA.
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
`MORTGAGE30US` · `DCOILWTICO` (WTI) · `VIXCLS` (VIX) · `CBBTCUSD` (BTC).

The four **inflation** series (CPI/PCE × headline/core) are price *indexes*; the dashboard
wants **YoY %**, so for those `fetchFred` pulls 20 monthly points and derives
`(latest / 12-months-prior − 1) × 100` plus a 6-point YoY trend (FEAT-R10, v2.6.4).

### FRED-SP500 proxy (`fetchSpy` in `functions/api/snapshot.js`)
Equity prices come from **FRED's `SP500` index, not a stock API** — Stooq blocks
Cloudflare edge IPs, so SPY is sourced from the same proven FRED path. **`SPY ≈ SP500
/ 10`** (the ETF was designed at ~1/10 of the index). From a 220-point pull it computes
`spyPrice`, `spyChangePct`, `spyYtd` (oldest-in-window anchor — exact Jan-1 is a v2.1
TODO), `spyMa100`, `spyMa200`, and a 20-pt sparkline.

### Scrapers (sentiment, also in snapshot.js)
- **CNN Fear & Greed** (`fetchFearGreed`): `production.dataviz.cnn.io/.../graphdata/<YYYY-MM-DD>`.
  Needs a full desktop Chrome UA + Accept + Origin/Referer = `edition.cnn.com`, else 418.
- **CBOE Put/Call** (`fetchPutCall`): static daily CSV at `cdn.cboe.com/.../equitypc.csv`
  (the old JSON endpoint 404s). Takes the last row with a P/C ratio in 0.1–5.
- **Kalshi FOMC rate odds** (`fetchRateOdds`, FEAT-R9, v2.6.3): public market-data REST
  API (`api.elections.kalshi.com`, no auth/key). Takes the nearest open `KXFEDDECISION`
  event and aggregates its mutually-exclusive buckets (H0=hold · C25/C26=cut ·
  H25/H26=hike) by last traded price → normalized hold/cut/hike % + FOMC days-out.
- **Top market headline** (`fetchHeadline`, FEAT-NEWS, v2.9.0): the one non-FRED, non-market
  *news* source. Top item from a market RSS feed (Dow Jones/MarketWatch `mw_topstories`;
  CNBC fallback). DATE-VERIFIED: parses the item `pubDate` and only accepts a headline ≤~3
  days old, emitting its real ET date so `isStale` guards it. Feeds **WHY #3** of the 5 Whys.
  Source + date are attributed (no automated claim-fact-checking; reputable wire + date gate).

> **Scraper resilience (FEAT-R8, v2.6.2):** the three scrapers (F&G, P/C, Kalshi) run
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

node test/smoke.mjs   # 28-assertion no-network smoke test (needs Node ≥17)

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
