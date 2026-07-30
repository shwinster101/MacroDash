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

**v3.8 "FEAT-SNAP-SAFE" adds the missing half of the honesty invariant: PLAUSIBILITY.**
v3.1 enforced *liveness* and *provenance* but never asked whether a number could be **true** —
a decimal-shifted upstream value passed every check, rendered with a green LIVE badge and cast
a regime vote. `BANDS`/`applyBands()` in `snapshot.js` now drop out-of-band values *before*
render or cache (wide bands: reject the impossible, not the unusual — **negative WTI is
explicitly allowed**, it really happened 2020-04-20). Dropped keys are named in `_diag.bandDropped`.
**The write-through gate is now a named-field quorum**, not a key count: `QUORUM_FIELDS`
(the regime's voters) with `QUORUM_MIN=4`. The old `fredCount >= 6` counted *output keys*, and
`tenYear` alone emits exactly six — so **1 of 15 FRED series could lock a gutted snapshot in for
the whole ET day**. Below quorum the payload is still served (mock-first holds) but cached only
for `SETTLING_TTL`, so the next visit retries instead of inheriting the bad day.
**`session` is recomputed on cached reads** — it describes the *current* session, so it was the
one field that must never be frozen; a 01:49 ET cold fetch had the header reading `PRE` through
the close while the 5-Whys used a client-side `etSession()` and disagreed on the same page.
Also: `pct()` returns NaN on a zero/negative base (sign inversion), a blank CNN F&G score no
longer parses to `0` → "Extreme Fear" → a phantom bear vote, and the cron worker gained an
**8am ET pre-open warm** (`SNAPSHOT_PREWARM_CRON`, no-op if already cached) so no human pays the
cold fetch and concurrent first-visitors can't stampede FRED/Finnhub rate limits.

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
                        + isStale/cadenceOf/parseObsDate + MARKET_HOLIDAYS/
                        isMarketHoliday (the ONE US-market calendar — ⚠️ update
                        annually; feeds isStale, marketSession, etSession,
                        looksBehind). No React → Node-testable.
  fiveWhys.js           Pure rule-based 5-Whys generator (no React, no LLM, $0);
                        smoke-tested.
  ttReadout.js          Pure TT regime/Macro-Flip mapping (DEC-33 band table).
                        Imported by dashboard.jsx, functions/readout.json.js
                        (first functions→src import), and smoke. React-free.

functions/              Cloudflare Pages Functions (run at the edge, same origin)
  _middleware.js        Security headers; keeps /api same-origin (no CORS).
  api/snapshot.js       ACTIVE live source. Assembles FRED + FRED-SP500 + CNN F&G +
                        Kalshi + RSS + OpenRouter + Finnhub + multpl. Holds
                        env.FRED_KEY. Per-ET-day KV cache. Imports src/sources.js
                        (market calendar) — second functions/→src/ import, same
                        esbuild-inline path readout.json.js proved.
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
  smoke.mjs             No-network smoke test: 566 assertions over mergeLiveOverMock
                        + SOURCES-path resolution against the real MOCK_DATA + the
                        5-Whys engine + DEC-31 guards + the TT band table (DEC-33)
                        + the market-holiday calendar (sessions + staleness).
  render.mjs            Browser render test for public/admin.html (`npm run test:ui`).
                        admin.html is buildless, so smoke can only pin STRINGS; this
                        serves the real file with a stubbed API and drives it in
                        Chromium at 390px + 1200px. SYNTHETIC fixture only (same
                        invariant as SEED/BOARD). SKIPS cleanly (exit 0) with no
                        browser, so `npm test` on a bare machine is unaffected.
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

## TT Ticker Terminal admin portal (FEAT-TT, v3.4.0)

- **`public/admin.html`** — Vite `public/` passthrough serves the TT tier-board GUI verbatim at
  `/admin.html`. It is the empty template wired to **`/api/tt`** (`functions/api/tt.js`): GET loads
  the book, every mutation (add / card save / remove→CUT / import) optimistically updates then PUTs.
  KV key **`tt:book:v1`** (no TTL) in `PULSE_CACHE` holds `{version, asOf, book, cut}` — plus an
  optional **`board`** (FEAT-TT-SESSION, v3.28) for state no single ticker owns.
- **Auth = config-gated (FEAT-TT-PIN, v3.9.0).** With **`env.TT_PIN` set (exactly 6 digits;
  `npx wrangler pages secret put TT_PIN`)** the terminal runs **PIN mode**: `POST /api/tt {pin}`
  mints a 30-day KV device session (`tt:session:<token>`, HttpOnly/Secure/SameSite=Strict cookie),
  and an **`x-tt-pin` header** authenticates GET/PUT directly (the automation path that unlocks
  future chat-side sync). The PIN is NOT the wall — the wall is the **escalating KV lockout**
  (`tt:auth:lock`: 5 fails → 15 min, 10 → 24 h; pure `lockoutState`/`recordFailure`, smoke-tested)
  plus fail-closed config (malformed TT_PIN → 503, never a silent fallback) and an Origin check on
  POST/PUT (CSRF). Login reports `failed_attempts_since_last_login` — the owner-visible guessing
  tell. **`TT_PIN` unset = legacy Cloudflare Access mode, unchanged** (Zero Trust apps on
  `/admin*` + `/api/tt*`; `tt.js` verifies the `Cf-Access-Jwt-Assertion` JWT against
  `env.ACCESS_TEAM_DOMAIN` certs + `env.ACCESS_AUD`; missing → 503, fail closed) — so the deploy
  is inert until the operator flips the secret, then deletes the Access app at leisure.
  `env.ACCESS_DEV_BYPASS="1"` skips both modes for local `wrangler pages dev` only.
  **v3.10 adds the phone-only setup path:** with no `TT_PIN` secret, the 🔐 PIN button in the
  terminal SETS the PIN through `POST /api/tt {new_pin}` — the claim is authorized by the
  operator's *current Cloudflare Access session* (fail closed: no valid JWT → no claim), stored
  as a salted SHA-256 record in KV (`tt:auth:pin`, `hashPin()` smoke-tested; hygiene not a wall —
  the lockout is the wall), read at request time so **no wrangler, no dashboard, no redeploy**.
  Rotation requires the *current PIN* (a stolen device session can't change the lock); env
  `TT_PIN` always wins over the KV record and disables terminal-side changes (409). While the
  Access app still exists, a valid Access JWT is accepted in PIN mode too (transitional — no
  double login; inert once the app is deleted). Recovery if the PIN is lost after Access is
  gone: `wrangler kv key delete tt:auth:pin` (laptop) restores Access mode.
- **v3.11 "Close the Loop":** the header REGIME pill is **live** — the terminal fetches
  `/readout.json` (non-blocking, 10s timeout) and renders the verdict; INSUFFICIENT and
  fetch-failure render amber "don't gate on this" / "unavailable" (never a defaulted color),
  and a **HEADWIND/PANIC standing modifier** (entry +1 notch · R/R +0.5× / S-tier-only) appears
  on the NEXT DOLLAR line. **"✓ RAN IT — stamp today"** on the card makes run-attestation a
  two-tap loop (deliberately card-only: a board-level stamp could mis-tap-attest a run that
  never happened) — and run stamps now use the **ET date** (the old `toISOString()` UTC stamp
  rolled evening runs to tomorrow → runState read them as future = NEVER RUN). Toolbar demotes
  the four backup/recovery buttons behind **⛭ BACKUP**; the header shows the honest auth line
  ("PIN · Nd" from the session record's server-side `exp`, or "Cloudflare Access").
- **Invariant: the real CANONICAL_BOOK never enters the repo or bundle.** `SEED=[]` stays empty;
  seeding/restore is paste-import in the UI (EXPORT JSON from the Artifacts copy → IMPORT JSON).
- **FEAT-TT-RUN (v3.5.0) applies the dashboard's honesty rule to the book.** Per-entry `lastRun`
  (ISO date of the last harness pass) drives `runState()` — fresh ≤30d · stale >30d · head >90d ·
  **never** (missing *or future-dated*). `ageDays()` **fails closed**: unlike `src/sources.js
  isStale` (which returns `false` on a missing date), an absent `lastRun` reads as NEVER RUN, so an
  unreviewed name can never look reviewed. Chips carry `::before` markers (`::after` is `.fp`'s),
  and a **BOOK COVERAGE** strip mirrors Signal Quality. `lastRun` is *self-attested* — that's the
  known weakness; failing closed is the mitigation.
- **`validateBook()` deliberately passes through unknown per-entry keys** (`fp`, `rank`, `lastRun`)
  — load-bearing, not an oversight, and now covered by smoke section [6] (first behavioral test of
  `functions/` in the repo; `validateBook` is exported solely for it).
- **`persist()` never re-GETs on save failure** — the old catch overwrote `BOOK` from the server and
  silently destroyed the user's edit. It now sets `DIRTY`, shows `#saveBanner` (RETRY / EXPORT /
  explicit discard) and guards `beforeunload`. Client-side pre-flight mirrors the server cap
  (`MAX_BODY`, raised 64KB→200KB in the v3.34 follow-up — see FEAT-TT-POSSTORE below).
- **FEAT-TT-SAFE (v3.6.0) closes the lost-update hole.** The book is a **whole-book replace**,
  so two devices editing concurrently silently clobbered each other. `PUT` now requires
  **`If-Match: <version>`**; a mismatch returns **409 with the server's copy**, and the client
  shows both sides (KEEP MINE / TAKE SERVER'S / EXPORT MINE FIRST). `"*"` or an absent header is
  the documented override (curl recovery). `conflictCheck()` is pure + smoke-tested.
- **Restore points:** the **first** write of each ET day copies the outgoing book to
  `tt:book:snap:<ET-date>` (30d TTL) — first-write-wins so a later mistake can't overwrite the
  good copy it needs. Readable via `GET /api/tt?snapshots=1` (list) and `?snapshot=<date>`, with
  a **⏱ RESTORE POINTS** UI that previews into memory *without* writing (SAVE is a second step).
- Also fixed in v3.6.0: the KV `.put()` is wrapped (an unguarded throw returned an HTML error
  page, which the client misreported as an **auth** failure); `validateBook` rejects **duplicate
  syms** (dupes rendered twice but `find()` resolved only the first → unreachable ghosts) and
  malformed `lastRun`; `importSave` validates **before** overwriting `BOOK`; `exportJSON` reports
  the real version (it hardcoded `"1.1"`, mislabeling every backup); `getKeys` refetches once on a
  `kid` miss (Access key rotation inside the 6h cache window otherwise 403s everything).
- **FEAT-TT-ND (v3.7.0) surfaces the next dollar** at the top of the board — the question the
  whole TT framework exists to answer, previously buried in the last tier. Ranks are free text
  (`"#1 infra"`, `"#1 cross-bucket"`, `"#3"`, `"—"`), and the real book carries **two `#1`s scoped
  to different buckets**, so the queue is **not a total order**: `renderNextDollar()` shows *every*
  entry tied at the lowest rank as a **co-lead** with its scope text, rather than inventing a
  precedence the maintainer never set. Decision-adjacent, so it inherits the honesty rule —
  a lead whose `lastRun` is stale/never shows `⏱ Nd — re-run first` / `○ no TT run on record`.
  Unranked watchlist and empty watchlist each get their own explicit copy (never a blank).
- **FEAT-TT-DD (v3.12) — deep-dive tabs.** A book entry carrying a `deepDive` payload gets a tab
  beside BOARD (hash-routed, e.g. `#nbis`): thesis header + updated-age chip (self-attested; >30d
  → re-review amber; missing date fails closed), PT ladder, **hinges** as tracked fields
  (green/amber/red/unknown + note + asOf), key dates (**past dates render "passed — re-confirm"**),
  position/overlay, linked-exposure line (e.g. the NVDA-9.3%-stake shared-sleeve cap), status
  flags, standing rules. The payload rides `validateBook`'s unknown-key passthrough (server never
  learns the schema; smoke pins the passthrough) with a client-side contract validator
  (`thesis_version` + `updated` required, 8KB/payload cap, all rendered strings HTML-escaped).
  Entry path is the 📊 DEEP DIVE editor on the card (paste JSON) — **thesis/position payloads live
  only in KV, never the repo** (same invariant as the book itself); EXPORT CANONICAL_BOOK.md
  appends `### DEEP_DIVE: <SYM>` sections so re-seeding never loses thesis state.
  **v3.13 makes the renderer corpus-native:** the deep-dive JSON files parse AS-IS (`as_of`
  aliases `updated`; key_dates accept `event`; hinges accept `{id, role}`; pt_ladder values may
  be labeled objects), and rich sections render purpose-built — **four-gate board** (status +
  de-risked bar + evidence), **dilution sequencing grid computed from the pre-committed rule**
  (pts ≈ 100 × $B ÷ price; zones ≤15 green / ≤30 amber / >30 red), kill-combination monitor,
  leading indicators, cert probabilities, utilization underwriting, fleet-vs-burn engine
  (locked inputs + anchors, static — thesis STATE, not a calculator), tape (stamped "NOT
  live"), watchlist unlocks/hedges/open items. **Unknown payload keys fall back to a generic
  k/v render — what's stored is never invisible.**
- **FEAT-TT-PTM (v3.17) — the PT ladder is computed, never typed.** `pt_consensus` static rows
  are superseded by **`pt_model`**: the payload carries the MODEL (per-year EV/S multiple
  schedule · share-count schedule · optional `net_cash_B` · `pe_floor_multiple`), and
  revenue/EPS **default to the sibling `consensus` block** — one source of estimate truth.
  `ddPtModelSec` computes `premium = (mult × FY+1 rev + net cash) ÷ shares` and
  `floor = pe × FY+1 EPS` (rendered `n/m` where EPS ≤ 0 — no P/E before profit); schedules
  accept a number or a sparse per-year map (`schedAt`, nearest key ≤ y); past year-end rows
  auto-drop. A consensus revision is now a **one-field edit that moves every row in lockstep**,
  and the formula line shows what each PT assumes. Reproduces the approved v3.16 ladders:
  floors exactly, premiums within ≤0.7% hand-rounding.
- **FEAT-TT-DOT (v3.17) — the dots inventory.** Capture and synthesis are different jobs.
  A **⊕ DOT** box on each deep-dive tab captures a POINTER (≤280-char line + optional URL,
  never article bodies — the book's PUT cap is the wall), ET-date-stamped, state `new`. Dots
  live on the **book entry** (`e.dots`, validateBook passthrough) so replacing a deepDive
  payload can never wipe the inventory; keep-last-30 prune ages out reviewed/promoted first
  and **never silently drops a `new` dot**. States change only at **triage** (the chat sweep):
  a dot is *material iff it changes (a) a hinge/gate state, (b) a consensus input, or (c) a
  kill-combination condition* — material → `promoted` (with `into` naming the field; with
  FEAT-TT-PTM a consensus change auto-flows to every PT row), else `reviewed` and kept:
  clustering immaterial dots around one hinge is itself signal. Coverage strip shows
  `⊕ N new dots`; capture never touches the thesis — that's the self-attestation rule.
- **FEAT-TT-3Q (v3.14) — the 3 questions.** Every book entry can carry a `projection` (same
  passthrough rails): **(1)** revenue in 3 years — the validator DEMANDS a specific `$B` number;
  **(2)** margins `expanding|holding|compressing` + a required *why*; **(3)** the multiple that
  fits then (+ optional 3-yr per-share number). **Future price = per-share × multiple is
  computed, never typed**, and the 🔥 FLYWHEEL badge lights only when all three engines are
  demonstrably on (rev CAGR ≥10% from `rev_now_B` · margins expanding · `multiple.value` >
  `multiple_now`) — missing inputs render `?` and withhold the badge. Entry path: the
  📐 PROJECTION block on the card (validate-before-mutate, all-three-or-nothing). Coverage
  strip shows `📐 N/M projected`; deep-dive tabs render the answers + math line; EXPORT
  appends a `## PROJECTIONS` table. Import validates projections before overwriting.
- **FEAT-TT-FRAMEWORK (v3.26) — the TT methodology lives in KV, NOT here.** The owner's full
  framework (routing → kill-gates → 5-pillar composite → tier map → technical gate →
  constraints → next dollar → options expression, plus standing rulings R1–R5) is stored at
  KV key **`tt:framework:v1`** via `functions/api/framework.js`, PIN-gated on **both** read
  and write, with a `:prev` rollback copy kept for 30 days. **This repository is PUBLIC** —
  committing that document would publish every gate, threshold, R/R floor, position cap and
  tax route permanently. Same invariant as CANONICAL_BOOK; smoke asserts the file is absent
  from the repo. Key doctrine worth knowing while working here: *fundamentals decide WHAT
  deserves capital, support/resistance decide WHEN, the regime decides HOW STRICT both must
  be; the composite is a permission slip, never a buy button; engine disagreement = WAIT.*
  **`/readout.json` IS Engine 0** — the framework doc still says MacroDash "cannot be fetched
  programmatically, the user pastes it", which v3.3 superseded.
- **FEAT-TT-BINCAL (v3.26) — the binary calendar.** Scheduled binaries (earnings) lived inside
  individual `key_dates` arrays, surfacing only when that tab was opened; a no-new-adds rule is
  worthless if the binary is discovered after sizing. A board strip aggregates every *future*
  key date across the book, sorted by days-out, flagging anything inside `BINARY_WINDOW_D=10`.
  Deliberately **reports, never enforces** — the board does not block orders.
- **FEAT-TT-SESSION (v3.28) — the session layer.** A TT session produces conclusions no single
  ticker owns, and the book had nowhere to put them: the board could show a green NEXT DOLLAR
  while the portfolio was in deleverage-only mode and the top two picks were the same bet twice.
  An optional **`board` object in the same KV document** (`functions/api/tt.js` `validateBoard`,
  16KB cap, `as_of` REQUIRED) now carries six sections, each rendered as its own strip that
  **renders nothing when absent** — no session loaded looks exactly like v3.27, never like empty
  placeholders. **`circuit`** (leverage; renders *above* the next dollar because it gates every
  add, and a `tripped` circuit **vetoes the FEAT-TT-AGREE green line outright** — no per-name
  score clears it) · **`clusters`** ("cluster = one position": flags when two co-leads or two
  computed-upside top ranks sit in the same cluster) · **`funding`** (the deleverage-first trim
  order + `do_not_trim`, with per-row blockers; the question NEXT DOLLAR never answered — where
  the dollar comes *from*) · **`decisions`** (aging in public: >7d amber, >14d red, **undated is
  the worst chip, never the freshest**) · **`binaries`** (non-ticker prints — a supplier's
  earnings that sets the tone for names you hold — merged into the same dated queue, and only
  clickable when a tab actually exists) · **`regime`** (the session's *asserted* read).
  **Two regime engines, married never merged** (`REG_RANK`): MacroDash **measures** one from live
  data, the session **asserts** one; the **stricter governs** the standing modifier and any
  disagreement prints both readings with provenance — averaging them would delete the information.
  Everything here is self-attested, so every strip carries `sessChip()` (the circuit dates its
  asserted state and its `measured_at` measurement **separately** — a fresh assertion must not
  launder a stale number). Entry path is the **◧ SESSION** modal: the top box edits the board,
  the bottom box applies a **handoff patch as a MERGE, never a replace** (`applyHandoff` — a
  session covers only the names it touched, so importing one as a book would delete every name it
  didn't mention; validates whole-patch-before-apply, requires tier+lens to add a name, never
  removes anything, and previews on the unsaved rails until an explicit SAVE). An **absent**
  `board` on PUT is **carried forward, not deleted** (curl/older clients must not eat session
  state). Same invariant as the book: `BOARD` ships empty, content lives only in KV.
- **FEAT-TT-TODAY (v3.29) — the daily loop owns the default view.** v3.28 left the board at
  **nine strips of standing state, full size, every load** — six phone screens before the book.
  But a book in daily monitoring changes maybe one day in five: the signal is the DELTA and the
  DEMAND, not the state. The default view is now **one screen** answering the daily loop in
  order: **STANCE** (may capital move at all — `stance()`: the circuit first because it is a
  portfolio fact no macro verdict un-trips, then the stricter of measured/asserted regime;
  no regime at all reads UNKNOWN, never a defaulted green) · **TODAY** (`todayActions()`,
  ordered by **irreversibility** — tonight's print outranks any add; a deleverage action names
  the *blocker* rather than the trim when one exists; the add candidate is withheld entirely
  whenever anything above it vetoes, and it is the same `AGREE_PICK` the upside widget computed,
  never a second opinion) · **WHAT CHANGED** (`diffSince()` — price moves ≥`MOVE_PCT`, tier/rank
  changes, new red hinges, run stamps, decisions, names entering the no-new-adds window).
  Everything else moved into **one-tap `details.drawer`s whose summaries still carry their
  signal** (the v3.25 hinge rule: a collapse is only honest if a red thing stays visible while
  closed) — nothing was deleted, and the reference sidebar collapsed the same way.
  **The delta baseline is the user's**: it moves only on an explicit *mark seen* (or resets past
  `SEEN_MAX_D=7`), a first visit says "baseline set" rather than "nothing changed", and price
  deltas compare **live to live** — diffing a stamped `ref_px` against the day's first quote
  would report an 11% "move" when nothing moved. `/api/quotes` is now asked for the **whole
  book** (≤40, 2-min KV cache) so every chip carries its day move; a name with no quote shows
  **no number at all**, never a 0 that reads as flat. Header pill relabelled **MACRO** — it is
  MacroDash's *measured* read and looked like it contradicted the stance.
- **FEAT-TT-POS (v3.30) — measured facts, the first non-asserted class in the book.** Every other
  field is *asserted* (a human typed it, `lastRun`/`as_of` ages it). v3.29 made that visible and
  therefore intolerable: `stance()` suspends **all** adds off a hand-typed `circuit.state`, and
  with no position sizes anywhere the **18% cap was prose** and *"cluster = one position"* was a
  rule the software could not evaluate. An entry-level **`pos`** block
  (`{sh, mv, pct, cb, upl_pct, opt[], at, src}`) is written by a broker sync and never by hand.
  It sits beside `dots`, **not inside `deepDive`** — the payload editor replaces that wholesale,
  so facts stored there would die to a thesis paste. `validatePos()` (exported, smoke-tested) is
  **plausibility-banded** in the `BANDS`/`applyBands` spirit: a decimal-shifted weight is rejected
  before it can clear *or* trip a cap, while a **short position (`sh < 0`) is explicitly allowed**.
  What the facts buy: weight on every chip (absent = **no number**, never a 0 that reads as
  not-held) · `capChecks()` for single names **and summed clusters** — an unmeasured member is
  named and the total called a **FLOOR** · `reconcile()` for held-but-untracked ("exposure no
  thesis covers") and tracked-but-not-held · TODAY stops for breaches (a held breach outranks
  anything discretionary) · a deleverage action carrying real share count/value with its blocker
  **verified against actual option legs** · and `board.account` where **`formula` is REQUIRED**,
  so the leverage figure that vetoes every add is checkable by the person it stops. Everything
  inherits `pos.at`: `posChip()` marks stale/undated, and cap checks computed off an old mark
  say so. Also v3.30: `governingRegime()` is now the **single** derivation of "stricter of
  measured vs asserted" (`stance()` and `regimeModifier()` had a copy each), and `loadQuotes()`
  **states its 40-symbol cap** and names the unquoted tail instead of truncating silently.
- **FEAT-TT-DDFOCUS (v3.31) — the deep-dive tab answers four questions first.** The tab was
  emitting ~20 sections at full size: the pre-v3.29 board, one level down. A reader arrives at a
  name with the same four questions every time, so `ddAnswerBlock()` answers them above the
  corpus — **what it's worth** (`ddWorth()` reuses `ptModelRows()`, so the cell can never quote a
  target the ladder below it disagrees with; no model says *"no model"* rather than showing a
  number) · **what changes my mind** (hinge tally, reds named) · **when** (next future key date) ·
  **what I own** (the v3.30 `pos`; unmeasured reads *"not synced, which is not the same as not
  held"*). The corpus groups into `ddDrawer()`s — VALUATION · THESIS & GATES · KEY DATES ·
  CAPITAL & EXPOSURE · TRACKING & MODEL · DOTS · OTHER — each summary carrying its own signal
  (failing gate count, kill-combo presence, next date, new-dot count). **An empty drawer never
  renders**, unknown payload keys are **named in the summary** (stored is never invisible), and
  `DD_OPEN` preserves open state so a quote landing can't collapse what you just opened.
- **FEAT-TT-RENDER (v3.31) — `test/render.mjs` (`npm run test:ui`).** `admin.html` is buildless,
  so smoke can only pin load-bearing STRINGS; that catches deletions but not a strip that renders
  empty, a drawer that hides a red thing, a dead click, or a template literal that throws. This
  serves the real file with a stubbed `/api/tt` + `/readout.json` + `/api/quotes` and drives it in
  Chromium at **390px and 1200px** (103 assertions). It has already caught bugs the source guards
  could not. **The fixture is SYNTHETIC** — no real ticker, position or session content enters
  this repo, same invariant as `SEED`/`BOARD`. It **skips cleanly (exit 0)** when playwright-core
  or a browser is missing, so it is additive and never breaks `npm test` on a bare machine.
- **FEAT-TT-LEDGER (v3.32) — the belief ledger: the one thing the terminal never had, memory.**
  Robinhood/Seeking Alpha/Yahoo all show what the MARKET thinks; this terminal's moat is what
  YOU think — tiers, projections, PT models, hinges — but every one of those fields overwrote in
  place. It could never answer *"was I right?"*, never show what you believed when NBIS was $51,
  never catch the CRDO pattern (estimates up, price down = sentiment derate, not thesis break)
  except by a human noticing it by hand. **`diffForLedger()`** (`functions/api/tt.js`, pure,
  exported for smoke) diffs every PUT's book against the one stored and logs **beliefs only** —
  the user's explicit call, no trade/position logging: `add`/`remove`/`tier`/`rank`/`run`/
  `thesis`/`hinge`/`pt`/`proj`/`comp`/`est`/`cut`. It does **not** log `pos`, `ref_px`, `dots`, or
  note text — facts and scratch, not conviction. Hinges are matched by **identity**
  (`label||key||id`, the same rule `validateDeepDive` already uses), never array position, so a
  reordered payload can't misattribute a state flip. The composite score is recovered from free
  text via the **same** `parseCompositeScore` logic the v3.31.1 audit fixed client-side (decimal
  preferred over a bare integer — "R3-A: 9.0" reads 9.0, never 3). Each entry is stamped
  `{t, v, kind, sym, field, from, to}` **server-side** — never self-attested — and appended
  **fire-and-forget** after the book write succeeds (`appendLedger`, KV keys `tt:ledger:<sym>`
  capped at 500 entries + `tt:ledger:index`); a ledger fault must never fail the write the user is
  waiting on. `px` is stamped from the `tt:quote:<sym>` cache `functions/api/quotes.js` already
  warms — no new upstream calls. **`functions/api/ledger.js`** is the READ-ONLY path (PIN-gated,
  same as `/api/tt` — belief history is as private as the book): the index, one sym's entries
  (`?sym=`), the whole book's recent entries in one list+N (`?recent=1&days=`, so the client never
  does an N+1 round trip), and a one-time idempotent backfill (`?seed=1`) that walks the existing
  30-day `tt:book:snap:*` recovery snapshots and diffs them chronologically — historical `px` is
  honest best-effort (a nearby-dated `ref_px` or `null`, never fabricated). Client-side: a
  per-name **HISTORY** drawer on the deep-dive tab (lazy-fetched on tab open, timeline with
  since-move `%` against the live quote) and a board-level **SCORECARD** drawer (tier/rank/comp
  changes ranked by |since-move|, `"NBIS S→A on 7/28 @ $170 → now +12%"`) — both empty states say
  the ledger started counting from deploy rather than reading as "nothing ever changed."
- **FEAT-TT-SPREAD (v3.33) — belief vs street, the CRDO pattern automated.** Two builds on the
  ledger and the existing PT math, entirely client-side (no new data). **The spread cell**: the
  WORTH cell's sub-line now inverts `ptModelRows()`'s own formula at the live/stamped price —
  `impliedMultiple()` solves the EV/S or P/E row backwards for the multiple the market is
  *actually* paying, so it can never disagree with the ladder above it (one row, one computation,
  both directions). Renders as `market pays 12.57× FY+1 vs you 8× · credits 157% of your 2028
  case` — a floor-only row has no premium multiple to invert against, so the spread renders
  nothing there rather than guessing. **Street vs mine**: where `pt_consensus.rows[year]` exists
  for the *same* horizon year the WORTH cell targets, its non-bear/floor/severe columns (the same
  dim rule `ddPtConsensusSec` already applies) are averaged into `street ~$485 vs mine $509` —
  renders only when that year's row actually exists in the payload. **The divergence flag**: from
  the ledger's `est` entries, if a name's latest consensus revision moved a value **up** while
  price has since moved **down** ≥`MOVE_PCT` (or the reverse), a `⚠ est↑ px↓` chip lights on the
  book chip and the upside-rank pick — same-direction moves are explicitly *not* the signal
  (that's just the market agreeing); only the split is. This is the CRDO read from the 7/28
  handoff, machine-detected across the whole book instead of caught by hand on one name.
- **FEAT-TT-POSSTORE (v3.34) — `pos` gets its own KV document.** Three separate broker-sync
  passes hit the SAME wall: `pos` (FEAT-TT-POS, v3.30) rode inside the 64KB book document
  alongside tiers, theses, PT models, hinges, projections and dots for 30+ names, so writing
  position data for the names still missing it meant trimming unrelated fields just to fit —
  the same squeeze, repeatedly, on a document that keeps growing for reasons that have nothing
  to do with positions. **`functions/api/positions.js`** (KV key `tt:pos:v1`, `{asOf, positions:
  {sym: pos}}`) gives it the same treatment the belief ledger already proved for this exact
  shape of problem. PIN-gated like `/api/tt`. **PUT is merge-only** (`{updates: {sym: pos|null}}`)
  — a sync that only touched 6 names must never be able to blank the other 25; `{sym: null}` is
  the explicit removal path for a fully-exited name. Each update is still validated by the same
  `validatePos` (exported from `tt.js`, unchanged) — the bands didn't move, only the storage did.
  A one-time idempotent **`GET /api/positions?migrate=1`** pulls any `pos` still embedded in the
  book (pre-v3.34 syncs) into the new store, snapshots the book first (same first-write-of-the-
  day restore point `tt.js`'s own PUT keeps), then strips `pos` from those entries and re-saves
  the book to reclaim the bytes that motivated the split; a no-op once nothing embedded remains.
  `validateBook` no longer inspects `pos` at all — a stray `pos` key on an old cached client now
  rides the ordinary unknown-key passthrough instead of being validated in place. Client-side,
  `posOf(x)` — the single choke point every consumer (caps, clusters, reconcile, TODAY, the
  circuit) already went through — now reads a `POSITIONS` map fetched once at boot instead of
  `x.pos`, so the store move is invisible to every renderer except that one line. Same invariant
  as the book and the ledger: real position data has no home in this repo, and `POSITIONS`
  ships empty.
- **v3.35 "The Analyst Desk" — the UI renders what the terminal already knew.** A UI-revamp
  sprint against one finding: the terminal stored everything SA/Yahoo can't have (measured
  positions with option legs, per-year underwriting multiples, belief history) and rendered a
  fraction of it. Four features, all inside `admin.html`:
  **FEAT-TT-ESTRUN** (centerpiece) — the v3.15 consensus table and v3.17 computed PT ladder
  were two renderings of the same year axis; they merge into ONE per-year table
  (`estRunTable`/`ddEstRunSec`: FY · rev · Δrev% · EPS · ΔEPS% · n · PT rev-lens · PT floor ·
  upside-vs-live), targets **joined from `ptModelRows` by forward year, never recomputed**
  (the FEAT-TT-SPREAD rule), EPS YoY reading `n/m` on a sign-flip, thin-coverage dimming and
  negative-EPS red surviving the merge. It renders **above the fold** on the deep dive with
  the TIER in its label (the math under the tier claim), and gets a board expression inside
  NEXT DOLLAR & UPSIDE: one `details.est-mini` row per modelled name (nearest target ·
  annualised upside · tier), sorted by upside, expanding to the same table — open-state in
  `EST_OPEN` because three async paths re-fire `render()` and an unpersisted `<details>`
  snaps shut mid-read. `est-mini` is deliberately NOT `drawer` (the phone harness counts open
  drawers).
  **FEAT-TT-ROLLUP** — `bookRollup()`/`renderRollup()`: the tracked book summed (total MV,
  unrealized P/L **only where both mv and cb are measured**, stale/undated counts, top
  weights, per-tier MV split) in a strip under the TODAY card, labeled *"tracked book only —
  NOT NAV; a floor, not the account"* (get_portfolio is still unmeasured and reconcile()
  names real untracked holdings). Nothing measured → renders nothing, never $0.
  **FEAT-TT-OWNDEBT** — of the pos schema the UI rendered only `at/sh/mv/pct`; now the own
  cell carries cost basis, colored `±% unrl`, src and leg count; an options-only position
  (LITE/GRAB/CELH/TEM/NU) reads `"N legs · options only — no shares"` instead of unheld;
  `ddOptSec` renders the legs as a real table (side · C/P · n · strike-when-captured · exp ·
  DTE, `OPT_NEAR_D=60` amber); chips carry measured `±upl%` and an `◇opt` marker; and a
  book-wide expiry ladder lives in the EXPOSURE drawer whose summary counts near legs while
  closed. Expiries deliberately never feed `binaryEvents()` — your own clock is not a market
  binary.
  **Fixpack** — the 3-questions block rendered twice per tab (inline copy removed); `LIVE_AT`
  (the quote batch's own timestamp) finally renders in the coverage strip; every `dd-pt`
  table sits in a `.tblx` overflow container **plus `.layout>*{min-width:0}`** (the grid item
  otherwise inherits a wide table's min-content width and blows the page out before the
  container can scroll — found by the harness at 390px); the chip tooltip's measured facts
  became a read-only MEASURED row on the card (tap-reachable); `test/render.mjs` fixture
  dates are now **computed relative to today** (a fixture stamped "today" at write time
  silently rotted at the first midnight — two asserts died exactly that way).
- **FEAT-TT-RANKFAIR (v3.36) — the ranking audit: weight becomes a ranking input.** An audit of
  the next-dollar logic found the board carrying **two rankings that contradicted each other**:
  the manual `rank` queue (human-asserted trigger state) said one thing, while `renderUpsideRank`
  sorted purely on annualised upside and said another — with nothing reconciling them. Three
  structural flaws, all fixed here. **(1) Weight was absent entirely.** The ranking answered
  *"what is cheapest"* while being asked *"where does the next dollar go"* — a name at 31% of the
  book could top the list and be unable to take another dollar. `rankWeight()` now marks every
  pick (`**` at/over `CAP_PCT`, `*` ≥10%, `◇` options-only) and **a name at/over the cap is vetoed
  from `AGREE_PICK` outright**, with the reason named — the board can no longer propose an add
  into a full position. Denominator is tracked-book MV, **never NAV** (unmeasured), so every
  weight is a floor; `mv` is equity-only, so an options-only position gets its own marker rather
  than a misleading 0%. **(2) A stamped `ref_px` was the entry ticket** — a name with a full model
  and a *live* quote was excluded outright because nobody had hand-stamped it. The gate is now a
  usable price, live preferred. **(3) The coverage gap was silent**: queue names carrying a manual
  rank but no `pt_model` can never appear in the computed list, so the names under active
  consideration were exactly the ones the math had nothing to say about — they are now NAMED
  under the ranking. Still open by design: the sort key remains a single variable (upside), with
  quality/hinges/trigger state rendered as tags — reconciling the two rankings into one score is
  its own piece of scope.
- **v3.37 — TSM modelled, NBIS's debt gap closed, and the ranking says HELD vs NOT.**
  The v3.36 audit exposed that the queue's top names carried **no `pt_model` at all**, so the
  computed ranking could say nothing about the very names under consideration. **TSM is now
  modelled** on the EARNINGS lens (`pe_premium_multiple`, the same rule that put UBER there):
  a sales multiple prices the wrong thing for a 49.9%-net-margin compounder. Inputs are
  measured where measurable — **5,186.48M ADS** (Robinhood) and **~$63B NET CASH** (NT$2.02T
  net-debt-negative, Q1-26 @ 32.08) — while the multiple schedule (24x→19x, decaying from TSM's
  own 29.6x trailing) is flagged in the payload as **the one asserted input, assistant-set,
  owner to confirm**. Independent sanity check, not a fit: the 2027 rung computes **$625.02**
  against Barclays' published **$625** PT. The consensus block records the FactSet cross-check
  (NT$129.97/163.26 per common share ≈ $20.26/$25.44 per ADS — **6-10% BELOW** the owner EPS
  used), so the model is explicitly on the optimistic side of the street. **NBIS's `pt_model`
  basis literally read *"net debt NOT deducted — unavailable"*** — now closed: **+$0.87B net
  cash** ($9,298.2M cash less $8,432.0M non-current debt, 2026-03-31), with a `capital` block
  noting the balance sheet is a funding RUNWAY not a fortress, and that converts + prefunded
  warrants are why `share_count_M` ramps 310M→340M against 251.65M outstanding today.
  **Ranking honesty:** an unheld name used to render a BLANK weight, indistinguishable from
  "held but unmeasured" — `rankWeight()` now carries `held`, and the pick renders **"new — not
  held"** vs **"held · size unmeasured"**. BE was deliberately left floor-only (the owner's
  7/27 decision) — that is why an ~8.6-scored name ranks -48%, and it is surfaced as a decision
  rather than silently overridden.
- **v3.38 "Four Drivers" — FOCUS2 + SELLRANK + REFRESH.** Owner's brief, from a live
  screenshot: the board had re-accreted to six phone screens of prose; the primary view
  shall be the KEY DRIVERS only, everything else a click away. **FEAT-TT-FOCUS2**: the
  primary view is now a thin **stance strip** (stance pill + aggregated red badges — over-cap
  count, binaries-in-window, what-changed count — each opening the right drawer; the v3.25
  closed-never-hides-red rule applied board-wide) followed by exactly four blocks: **NEXT
  DOLLAR — BUY** (compact top-5 from the SAME `UPSIDE_ROWS` renderUpsideRank sorted — one
  computation, two altitudes), **NEXT DOLLAR — SELL**, **BINARY CALENDAR** (top 6 from the
  same `binaryEvents()`), and the tier list. Every pre-v3.38 strip lives on, unchanged,
  inside ONE collapsed **DESK** drawer (`openDesk(inner)` deep-links into it).
  **FEAT-TT-SELLRANK — the NEW list: where the next dollar comes FROM.** `sellRank()`
  computes it from measured positions: **forced tier first** (any name at/over `CAP_PCT`,
  with the computed `≈ $ to cap` — a breach is a rule already broken, not a choice; cap
  decision prefers broker-measured `p.pct`, falling back to the tracked-book floor), then
  **discretionary by LOWEST annualised model upside** (the dollar comes from the position
  with the least expected return). `do_not_trim` is flagged never hidden (a cap/do-not-trim
  collision is named as a contradiction to resolve); unmodelled held names and options-only
  positions are listed separately (RANKFAIR honesty: legs are not shares); the session's
  asserted `funding.order` first-trim is confronted with the computed first — married,
  never merged. Tax honesty: ±unrl% is measured, tax lots are not. A tripped circuit
  reframes SELL as the active list and the BUY block carries the veto.
  **FEAT-TT-REFRESH**: the ⟳ RANKS button re-fetches quotes + positions + regime and
  re-renders both ranks on demand, disabled while in flight, with the quote stamp beside it
  and the server's 2-minute quote-cache window stated rather than implied away.
- **v3.34 follow-up: `MAX_BODY` raised 64KB → 200KB.** The pos-store split reclaimed real
  headroom (~950 bytes across 6 names) but the live book was already large enough that it
  only bought back ~400 bytes net — the very next addition (a real NVDA book entry, its own
  `consensus` + `pt_model`) blew through the cap again within the same session. The 64KB
  figure was always an arbitrary app-level safety cap in `tt.js`/`positions.js`, never a KV or
  Cloudflare platform limit (KV values go up to 25MB), so raising it is a one-line unblock —
  `MAX_BODY` in `functions/api/tt.js` and its mirror in `admin.html`'s client pre-flight, kept
  in sync as always. **This is a stopgap, not the fix**: splitting `deepDive` payloads out of
  the book into their own KV document (same pattern `pos` and the ledger already proved) is
  the permanent answer and remains deliberately deferred — a bigger, separate piece of scope.
- **FEAT-TT-PTLINT (v3.39) — guards for the chain the whole terminal hangs on.** An audit of the
  price-target chain confirmed what it was supposed to: `ptModelRows()` really is the single
  computation every decision surface reads (est-run table · `ddWorth` · `renderUpsideRank`→
  `UPSIDE_ROWS`→`AGREE_PICK` · `renderBuyBlock` · `sellRank` · `renderEstRunBoard` ·
  `impliedMultiple`), and both lenses tie out dimensionally. The moat is real and is where we
  thought. What the audit also found is that **`validateDeepDive` had never once inspected
  `pt_model` or `consensus`** — the highest-leverage input in the system was the only one with no
  validator, which is how NVDA's schedule came to be keyed at the ESTIMATE years instead of the
  YEAR-END PRICED: `schedAt()` looks backward only, found no key ≤ the first row, returned `null`,
  and the rung **silently fell through to the floor** — $135 (−29%) rendered with full confidence
  where the model meant $227 (+16%), every rung a year late. Two days of hand-audits became five
  guards. **`lintPtModel(dd)`** emits `MISKEY` (error) · `LENS` (a profitable name on the sales
  lens — the TSM/UBER rule, *warned* never auto-switched, since the lens is owner judgement) ·
  `LENSOFF` (the mirror trap: a P/E premium that cannot engage for want of positive EPS) ·
  `ORPHAN` (a key `schedAt` would never select — computed against the *selected* set, because a
  key below the row range may legitimately be the backward match every row resolves to; keys
  *beyond* the estimate series are deliberately not flagged, that being the reason the auto
  horizon stops where it does) · `NOFLOOR` (suppressed when the payload carries `basis`/`note`,
  which is the deliberately-UNRANKED case, not a defect). **`MISKEY` is the one HARD gate**, wired
  into the save path — measured across the live book at **zero instances**, so no existing payload
  can be rejected on re-save, and a genuinely-late premium declares itself with `floor_only_before`
  instead of being indistinguishable from a typo. Lints render at **both altitudes** (the name's
  tab and the whole-book ranking), because a defect nobody opens is invisible.
  **The horizon is now COMPUTED, not asserted (D1).** `HZ_DEFAULT="2028"` became wrong the moment
  three models were built whose estimates end FY2028 (last rung YE2027): pinning 2028 dropped TSM,
  LITE and GOOGL out of the ranking entirely, disclosed only as a footnote count. Measured: 2028
  ranked 12/15, `nearest` ranked 15/15 but off a ~5-month rung that annualises small gaps into
  nonsense (−73%/yr, −83%/yr, −99%/yr rows; JOBY flipping +48%/yr→−8%/yr), **2027 ranked 15/15
  coherently**. `autoHorizon()` picks the deepest year-end EVERY modelled name reaches — 2027
  today, self-advancing when those three carry FY2029, so the staleness cannot recur — and the
  chip **states the pick and its rule** (an auto horizon that looked deliberate is how 2028
  survived). `HZ_AUTO` is a distinct sentinel: `""` already means the owner chose `nearest`.
  **One `pickRow()` for all three surfaces (D2).** They each chose differently — the rank honoured
  the horizon, `sellRank` always took the nearest and then silently swapped a RAW % in for a rate
  (`if(ann===null)ann=up`), `renderEstRunBoard` took `rows[0]` — so BUY and SELL could rank the
  same name off different years with the sort key quietly changing units. `pickRow` also settles
  the **Q4 cliff**: under `ANN_MIN_Y` it ROLLS to the next rung and says so, rather than letting a
  raw gap into an annualised order (from ~Oct 1 a +8%-in-2-months rung ≈ +58%/yr would have sorted
  *below* a +40%/yr name). Both residual cases are disclosed, never absorbed, and a modelled name
  lacking only a *rate* is no longer mislabelled "no model".
  **Red hinges surface, never veto (D3)** — the board reports, it does not enforce (the
  FEAT-TT-BINCAL doctrine): `why()` is untouched, but the AGREE line and the compact BUY row now
  **name** the red hinges, so a pick can no longer light green with its entry trigger broken and
  say nothing where the decision is read. **Derived estimates are marked (`consensus.derived`,
  optional, `{year:["rev","eps"]})`** reusing the existing `.derived` class — and because a rung
  computed off a derived estimate is itself derived, **the marker propagates to the target**,
  otherwise the honest flag would stop exactly where the money decision starts (TSM's FY27-29
  revenue is company guidance, LITE's FY28 EPS an extrapolation, GOOGL's FY27/28 both — all
  previously admitted in prose only, rendering identically to a 25-analyst row).
  **Option legs get per-leg provenance and a real bug fix (D4).** `ddOptSec` claimed "from broker
  sync" for every leg while several were hand-entered from screenshots — two of them originally
  typed with the wrong call/put side, a *risk-direction* error (a short put ADDS exposure where a
  short call covers it), which is exactly the class of mistake a false provenance claim hides. `src`
  is optional and enum-checked in `validatePos`, absent reads **"provenance unrecorded"**, never
  as sync. And the trim-blocker cover filter (`admin.html:1204`) **ignored `o.exp` entirely** — an
  already-expired short call still counted as cover in the one place the board says a trim is
  blocked, while `renderOptLadder` flagged the same leg "expired?" two drawers away; expired and
  undated legs are now excluded and counted separately, with strikes named.
  Tests: **556 smoke** (the section includes the **first behavioral tests of `admin.html`'s pure
  logic** — the PT functions are lifted out by name and executed, with the Q4 cliff proved against
  a **stubbed clock** since no July date can put a year-end inside 3 months) + **103 render**.
- **FEAT-DASH-DERIV (v3.40) — the macro dashboard audit: a guard that only covered half its fields.**
  The TT terminal was audited first; turning the same lens on the **macro dashboard** found the identical
  shape of defect one layer down, and this one is live in **Engine 0** — the `/readout.json` an external
  terminal and the board's MACRO pill gate real decisions on. `isStale()` **fails OPEN on a missing date**
  (`sources.js:236` — correct for a dated field, there is nothing to judge), but `snapshot.js` emits
  **`vixWeekChg`, `tenYearM1/D1/W1`, `spyChangePct`, `spyMa100/200`, `spyYtd`, `qqqChangePct`, `spxPrevClose`
  with NO `AsOf` sibling of their own** — so every one of them sailed straight past the gate that had just
  suppressed *its own parent*. **Measured on the live 2026-07-30 body:** `vix` (dated 07-28) was correctly
  withheld as stale — while `vixWeekChg` published 6.8 and **`tenYearM1` cast a BEARISH vote** in the very
  regime the project promises "excludes stale/dead inputs", and `qqq_spy_rs` cast another while *displaying a
  borrowed `as_of` it never gated on*. Two of the four "available" votes were derived from data whose level the
  same function had refused to print. **`DERIVED_OF`** now maps each derivative to the parent whose date
  governs it, `fresh()` gates on that date, and a block reports the date it actually gated on.
  **The Macro Flip circuit was silently BLIND.** `armed: null` / `tripped: null` read identically to a genuine
  "not armed" — the crash detector could be unable to see while a confident verdict sat beside it. It now
  carries **`evaluable` + a `reason` naming the missing input**.
  **And fixing the first two exposed the real danger:** with the stale votes correctly removed, the verdict went
  **NEUTRAL → TAILWIND** — *more risk-on for knowing less*, because `available >= 3` is a COUNT and counts are
  not safety. With VIX gone the PANIC override cannot fire and the flip circuit is blind, so a risk-ON call was
  being asserted by exactly the inputs that cannot see a crash. A TAILWIND is now **withheld while the risk
  gauge is blind**, recorded in `regime.raw_verdict` + `regime.downgraded` (never silent). The rule is
  deliberately **ASYMMETRIC** — HEADWIND and PANIC pass through untouched, since a bearish read off the
  remaining inputs is still safe to act on; only the risk-on direction needs the gauge.
  Tests: **566 smoke** (+10: parent-staleness inheritance, no over-correction, blind-circuit declaration, and
  the one-way downgrade) + **103 render**.
- **NVDA lens resolved from first principles (v3.40).** A multiple is a compressed DCF, so the right metric is
  the **lowest income-statement line already structurally representative** — everything below it must be
  *assumed*, and an assumption buried in a multiple is unfalsifiable. Consensus implied NET MARGIN is
  **55.5 / 55.8 / 56.4 / 53.2%** across FY27-30: flat, not ramping, so earnings ARE the cash-flow proxy (NVDA is
  *more* profitable than TSM at 49.9%, the name this same rule already put on the earnings lens). Converted
  14/12/10/9 EV/S → **25.2/21.5/17.7/16.9 P/E, preserving economics exactly** (every rung within 0.1%), so the
  ranking did not move — what moved is that the assumption is now legible and falsifiable against a quarterly
  print. Two things the conversion revealed: `net_cash_B` was **absent (treated as 0)** and understated every
  EV/S rung — the earnings lens is equity-level, so that missing input leaves the model entirely; and at $197.01
  the market pays 21.9× FY2027 while the **near rung assumes 25.2×, a re-rating UP** — the opposite side of the
  market from TSM's deliberately-conservative schedule, invisible while the lenses differed. At the auto horizon
  (YE2027) the model assumes 21.5× vs 21.9× paid, i.e. essentially no re-rating: **NVDA's rank is carried by EPS
  growth (+43% FY27→28), not multiple expansion.** The live book is now **lint-clean — zero warnings**.
- **FEAT-DERIV-OWN (v3.41) — v3.40's fix reached one of the three surfaces it needed to.** An
  audit of that commit found `DERIVED_OF` living *inside* `buildTtReadout`, so only `/readout.json`
  gained the parent-inheritance fix. **The "Copy TT readout" paste block still voted off stale
  derivatives**: `handleTtCopy` (`dashboard.jsx`) projects tiles through `modeOf()`, which reads
  `dataAsOf[k]` — and `mergeLiveOverMock` only ever populated that from the field's OWN `AsOf`,
  never a derived field's parent. Worse, when the parent WAS stale, the projection skipped it
  *and its date together*, so a derivative reaching `buildTtReadout` from that surface carried no
  date at all and voted anyway — on the exact human-facing block whose own comment says it exists
  so a stale field "prints n/a rather than a fabricated number in an order-gating block."
  **`DERIVED_OF` now lives in `src/sources.js`** (the module that already owns `isStale`/
  `cadenceOf`/`parseObsDate`, and that every consumer already imports from), with a new
  **`govAsOf(live, key)`** helper `mergeLiveOverMock` calls when stamping `dataAsOf` — one table,
  shared by the merge, the dashboard's `modeOf`, and `buildTtReadout` (which now imports and
  re-exports it, so `test/smoke.mjs`'s existing import keeps working unchanged). The table also
  **grew from 6 entries to all ~30 undated derivatives** `SOURCES` declares, reconciled against
  `SOURCES` itself in smoke rather than pinned as a hardcoded list — the v3.40 assertion ("maps
  every undated derivative") was true only by coincidence, since it checked six hardcoded keys
  against nothing. **Audit found one live instance the v3.40 map missed while widening it**:
  `rateOddsCut`/`rateOddsHike`/`fomcDays`/`nextFomcDate` rode with NO date at all — only
  `rateOddsHold` gets a Kalshi `AsOf` — so `fed_next_meeting` (keyed on `cut`/`hike`) could vote
  off a stale Kalshi pull undetected. Fixed the same way, for free, in the same table.
  **The v3.40 honesty states were machine-visible only.** `evaluable`/`reason` on `macro_flip`
  and `downgraded` on `regime` existed in the `tt-v1` JSON, but the pill (`admin.html`) rendered
  a BLIND circuit identically to a healthy "not armed" (no suffix at all), and `formatTtPaste`
  never printed `reason` or the withhold — the two human-facing surfaces said nothing where the
  machine surface said everything. Both now render it: the pill appends `· flip BLIND` (forced
  amber, `warn` class, never the green `ok` a plain verdict gets) and `· TAILWIND withheld`;
  `formatTtPaste` prints a `⚠` line under REGIME and a `BLIND — missing: <input>` MACRO FLIP line
  instead of bare `n/a`. **The TAILWIND withhold also widened from VIX-only to BOTH panic
  inputs** — PANIC needs `vix` AND `fear_greed` live, so a dead CNN F&G scraper blinds the exact
  same override VIX blinds, and the v3.40 rule only caught half of it; `downgraded` now names
  whichever gauge (or both) is missing. The one-way asymmetry is unchanged: HEADWIND/PANIC still
  pass through untouched.
  **End-to-end check**: reconstructed today's (2026-07-30) actual market shape through the real
  `mergeLiveOverMock → buildTtReadout → formatTtPaste` pipeline — a broad bounce (SPY +1.35%, QQQ
  +2.1% leading, the NBIS-style growth-name pattern) landing on a VIX print still dated two
  sessions behind. Confirmed: the stale VIX and its `vixWeekChg` derivative are both withheld,
  the fresh 10Y still votes (no over-correction), the raw count says TAILWIND, and the actual
  verdict is NEUTRAL with the withhold and the blind circuit both stated in the paste block — not
  a synthetic fixture, the literal shape the audit traced live.
  Tests: **579 smoke** (+13: merge-level inheritance for tiles/paste, the SOURCES reconciliation,
  the widened safety asymmetry, paste-block rendering) + **107 render** (+4: the pill's blind and
  withheld states, run live in Chromium — the v3.40 asserts for these existed only on paper since
  no browser was available when that commit shipped).
- **FEAT-TT-READABLE (v3.42) — "READABLE DESK" slice 1: the first phone screen becomes the answer.**
  A requirements-first UI audit (owner's screenshot, the stance strip circled) found the terminal's
  *logic* hardened across v3.29–v3.41 while its *presentation* accreted: the ONE answer the board
  exists to give ("may capital move?") rendered as **five wrapped lines of uppercase prose** — the
  long free-text `asserted` regime inlined mid-sentence at the same weight/size/color as the verdict
  — followed by a **five-row tab grid** (19 payload tabs, flex-wrapped) that pushed the four drivers
  below the fold. Slice 1 restructures exactly that screen. **The stance bar**: `stance()` keeps its
  decision logic and pinned prose byte-identical but now also returns `{verdict, quals[]}` —
  `renderStance()` renders the verdict as a **large token** (`.vbadge`, `--fs-l`) + small qualifier
  **chips** (`.qual`; the long asserted text TRUNCATES on the chip and stays verbatim in the drawer)
  + the red badges, with the full prose one tap deep in `details.why` (NOT `class="drawer"` — the
  phone harness counts open drawers; the est-mini precedent). The v3.25 rule holds: every red fact
  is a token/chip/badge visible while closed. Chip copy is chip-length by design (`circuit TRIPPED`)
  — measured at 390px, the bar packs to **3 rows / 119px** vs ~171px of wrap soup; the render suite
  now pins `<140px`. **Found while wiring: the caution-color bug** — `renderStance`'s map keyed
  `warn`, a `k` that `stance()` never returns, so every caution stance (HEADWIND, armed circuit)
  had been rendering **slate, the color of "unknown"**, on the line that gates adds. **The tab
  strip** is one horizontally scrollable row (`nowrap` + `overflow-x:auto` + `flex-shrink:0`,
  active tab `scrollIntoView({block:"nearest"})` so a render can never yank the page). **Design
  tokens** (additive): `--fs-*` type scale + `--sp-*` spacing scale + `--focus`; `--dim` lifted
  `#5f7469→#71877b` (old value measured ≈3.9:1 on `--bg` — below WCAG AA — while carrying
  load-bearing 9–10.5px text; new ≈5.2:1); `:focus-visible` ring; `prefers-reduced-motion` kills
  the header sweep + blinking cursor; stance badges became real `<button>`s (focusable,
  Enter-activatable, same look); ≥40px tap targets on badges/tabs at ≤480px; `.u-*` color
  utilities + `button.linklike` for later slices. Slices 2–4 (driver-row grid + skeletons,
  book/deep-dive keyboard model, modal focus traps + confirm-steps) are specced in the same
  audit and deliberately deferred.
  Tests: 590 smoke (+11: structured verdicts, chip truncation, why-not-drawer, the caution
  fix, single-row tabs, tokens, contrast lift, reduced-motion, tap targets) + 113 render (+6:
  verdict token, closed-drawer prose, red-facts-while-closed, buttons keyboard-reachable, the
  390px height budget `<140px`, single-row tab strip).
  **Slice 2 (same release) — the four-driver rows.** Each BUY/SELL/CALENDAR row is now a
  two-line GRID inside a real `<button>` (focusable; Enter opens the card — render-tested with
  an actual keypress): line 1 = identity left + the PRIMARY datum right-aligned at `--fs-l`
  (BUY → %/yr; a forced trim → its weight, the rule already broken; a calendar event → its
  countdown), line 2 = detail + warning chips at `--fs-xs`/dim. The old row interleaved 6–9
  datums in one 10-11.5px flex-wrap line with the decision number lost mid-row. Every phrase is
  verbatim from v3.41 (the render regexes pin them); a calendar event with no book entry stays
  a `<div>` — a button that does nothing is a lie. **Skeleton rows (first-paint only):**
  `QUOTES_PENDING`/`POS_PENDING` are true until the FIRST quotes/positions load settles —
  while pending, an empty BUY rank or unmeasured SELL queue renders `.skel-row` placeholders
  instead of an empty state ("not loaded yet" and "nothing there" are different facts), and
  both loaders settle in a `finally` so a dead feed resolves the skeletons into the honest
  empty state rather than stranding them (the board also now re-renders on quote FAILURE, not
  just success). Shimmer is gated behind `prefers-reduced-motion`. The flags never reset to
  true — skeletons are a first-paint device, not a refresh spinner (⟳ RANKS has its own).
  Span-onclick pseudo-links in the driver blocks became `button.linklike`. Driver rows get the
  44px min-height at ≤480px.
  Tests: 596 smoke (+6 slice-2: grid buttons, promoted primary, div-when-not-actionable,
  pending-flag lifecycle, reduced-motion shimmer gate, linklike conversions; 1 pin updated for
  the loadQuotes `finally`) + 116 render (+3: focusable rows with promoted primary, a real
  keyboard Enter opening the card, skeletons present while pending and gone after).
  **Slice 3 (same release) — book chips and the tab strip.** Tier chips become real
  `<button type=button>`s (Enter/Space activation for free; the CUT row deliberately stays
  `<div>` — those chips have no click handler, and a button doing nothing is a lie). The tab
  strip becomes a real ARIA tablist: `role="tablist"` + `role="tab"` + `aria-selected` +
  **roving tabindex** (only the active tab sits in the natural Tab order — the WAI-ARIA APG
  pattern), with Arrow/Home/End moving AND selecting, matching native tablist behavior;
  `switchTab()`'s own logic is untouched. Drawer/schema summary type migrated onto `--fs-s`
  (no visible change — the token equals the literal). `table.dd-pt th` gets `position:sticky`
  at ≤700px so a phone-scrolled row keeps its column labels (desktop unaffected). Chips get
  the 40px thumb target at ≤480px.
  Tests: 603 smoke (+7) + 122 render (+6, incl. a real keyboard arrow-key tab switch
  and Enter-to-open-card on a chip, both driven in Chromium).
  **Slice 4 (same release) — modals and recovery.** `#overlay` is ONE element reused by all 9
  open sites (card, add, session, import, restore, pin-setup); each `classList.add("on")` call
  became `openModal()`, and `closeCard()` is now a thin wrapper (`CURRENT=null;closeModal();`)
  — one choke point instead of nine, and every existing `onclick="closeCard()"` keeps working
  unchanged. `openModal()` remembers `document.activeElement` and moves focus into the card on
  open; `closeModal()` restores it — a card opened from a chip returns focus to that chip, not
  the page underneath. A `Tab`/`Shift+Tab` listener scoped to `#overlay` traps focus at the
  card's boundary (WAI-ARIA APG dialog pattern), wired once, not duplicated per modal.
  **`#pinGate` is deliberately NOT part of this pair** — same invariant as always ("so ESC/
  closeCard can never dismiss it"); its own show/hide is untouched. The save banner's two
  destructive links (`KEEP MINE` → `overwriteServer`, `discard & reload server copy` →
  `discardLocal`) now require a **second click** within a 4s window — first click arms the
  link ("confirm — really …?"), a second executes, letting it expire reverts the label
  silently; `RETRY`/`EXPORT` stay single-click since they're non-destructive. One
  `confirmLink()`/`confirmClick()` implementation, reused by both banner builders — not
  duplicated. The toast gains `role="status" aria-live="polite" aria-atomic="true"`, so a
  save/refresh confirmation is announced without requiring focus; no change to `toast()`
  itself, `textContent` updates inside a live region announce automatically.
  Tests: 611 smoke (+8) + 130 render (+8: real Tab/Shift+Tab trap, Escape-returns-focus
  to the invoking chip, an actual two-click confirm sequence and its 4s expiry, and the live
  region's ARIA attributes — all driven in Chromium against the synthetic fixture).
  **Slice 5 (same release) — "only the highest-leverage things survive the first glance."**
  Owner feedback on a live screenshot, and the measurement settled it: at 390×844 the BUY block
  — the first actual ANSWER — began at **y=587 of 844, so 70% of the first screen was chrome**,
  and **the header alone was 209px of it, larger than the stance bar and tab strip combined**.
  Slices 1–2 had optimized the two bands that were circled while the biggest consumer went
  untouched (it was item 3 of the approved spec's IA section and was simply never built).
  **The header is now ONE row** — `TT` · the MACRO pill · `⋯ MENU`; version, BOOK/AUTH stamps,
  the DASH link and the *entire* action toolbar moved inside the `#headInfo` disclosure, since
  every one of them is status or an occasional action and the command bar already covers the
  frequent path. **Banners stay OUTSIDE it** — an expired session or an unsaved edit must never
  require opening a menu to discover. The `MACRO:` label survives the compaction because v3.29
  added it so the pill can't be misread as the stance (honesty invariant, not decoration), and
  the pill drops the **year** only when it IS the current year — a year-stale macro read still
  prints in full. **The stance became ASYMMETRIC**, which is the heart of the feedback: `ADDS OK`
  is the permissive default, the lowest-leverage sentence on the board, and now renders as a
  small pill and nothing else — no token, no qualifier chips, no why drawer. A RESTRICTIVE
  stance (tripped · PANIC · HEADWIND · UNKNOWN) keeps the full treatment. Nothing is lost:
  `renderToday()` already renders `txt` AND `why` verbatim inside DESK, one tap away. The **red
  badges render in BOTH states** — the v3.25 rule that a collapse never hides a red fact.
  **Measured after: header 209→59, toolbar 64→0, stance 148→54, BUY 587→269 — 70%→32%.**
  Tests: **619 smoke** (+8) + **138 render** (+8, incl. both stance states driven live and a
  pinned above-the-fold budget for each, so chrome creeping back fails the build).
- **FEAT-NFCI (v3.43) — financial conditions, and the "what is high-leverage vs Yahoo" question.**
  Asked whether to add **TLT**; the answer is no, and the reasoning is the reusable part. TLT is
  not new information — it is a ~17-duration wrapper on long-end Treasury yields, i.e. a
  monotonic inverse transform of the `tenYear` this page already carries with d1/w1/m1 deltas, a
  sparkline and a banded trend that votes. It would add an ETF's expense drag and distribution
  adjustments on top of a rate already displayed cleanly. The page had already made this exact
  call once — `dashboard.jsx` still carries the comment *"SPY P/E (mock, Yahoo-dupe) cut"*.
  **The sorting rule:** Yahoo/SA/TipRanks win on *data* (quotes, charts, estimates, analyst PTs,
  per-ticker depth) and will always win there. What they structurally do NOT do is (1) render a
  single **verdict**, (2) **abstain** — none of them has ever said "this number is three days
  stale, I am not counting it", which is this project's whole provenance/STALE/ILLUSTRATIVE/
  INSUFFICIENT layer, (3) expose a **machine feed** (`/readout.json` → the TT terminal), (4)
  carry **non-consensus inputs** (Kalshi FOMC odds; the GPU $/hr × token $/Mtok AI unit-economics
  pair, which exists on no retail site), or (5) state **why** (the 5 Whys). *The moat is the
  judgment layer, not the data layer* — so an addition earns its place only by feeding it.
  **NFCI is the one that does.** The Chicago Fed's National Financial Conditions Index is 105
  measures of money-market, debt/equity and banking activity standardized so that **ZERO is the
  historical average by construction** — positive = tighter than average, negative = looser. It
  is a weekly single number that restates this dashboard's own thesis question ("is it safe to be
  in the market?"), and it is effectively absent from retail finance sites. Wired through the
  existing `fetchFred` path (16 series now = **one additional batch of 5**, which is why the
  phase batching must not be collapsed), with `nfciW1` derived from the prior observation —
  genuinely a week on a weekly series — plus `nfciSeries`. **Deliberately NOT in the `DAILY`
  set**: the `idx[5]`/`idx[21]` offsets would mean 5 and 21 *weeks*, exactly the bug that gating
  exists to prevent. Band `[-5, 5]` (record high ≈ +3.3 in 2008) rejects the impossible without
  rejecting the unusual. Cadence `weekly`; the derivatives inherit it through the v3.41
  `DERIVED_OF` parent fallback in `cadenceOf` rather than needing their own entries. The tile
  sits beside HY–IG because both are risk-**transmission** gauges: credit prices the risk, NFCI
  measures how tight the plumbing carrying it has become. It states `0 = avg` on its face — a
  bare z-score is unreadable without its reference point — and **TIGHT/LOOSE is suppressed on
  mock/stale** exactly like the CAPE BUBBLE verdict, since it is a directional call.
  **Two honest limits.** (a) The ±0.10 deadband around zero is **asserted, not fitted** — this
  build environment's network policy blocks `fred.stlouisfed.org` (403 on CONNECT), so it could
  not be calibrated against real history; it exists only so a weekly series doesn't flap its
  label on a 0.01 wiggle across the mean, and every boundary is smoke-tested so changing it is
  one edit plus one test. (b) **It does not vote yet** — neither `computeRegime` nor the six
  `tt-v1` checks changed. Adding a 7th voter alters the aggregate math for an external consumer
  that gates real orders, and doing that off an uncalibrated band would be precisely the failure
  DEC-33 exists to prevent. Deliberate follow-up, once real values have been observed.
  Tests: 631 smoke (+12) + 138 render, plus a browser check across live / stale / mock.
  **NFCI now VOTES in the dashboard regime (owner call, same release).** It joins `computeRegime`
  as a 6th factor on the same ±0.10 band the tile renders, appears in `regimeFactors` so the
  displayed "X/Y bullish" matches the vote cast, and drops out when STALE like every other
  factor (`REGIME_FACTOR_FIELDS`). **`/readout.json` is deliberately untouched** — the TT
  terminal's order-gating math did not move. This forced a threshold fix: DEC-31 set "≥3 of 5 =
  strict majority" *explicitly because 3 of 6 is 50%, not a majority*, so a 6th factor against a
  hardcoded `3` would have silently re-created the exact bug DEC-31 removed. The rule is now
  computed from the factors that actually voted — `bullVotes > counted/2` — which is **identical
  to the old constant at 5 live voters** (needs 3), correct at 6 (needs 4), and finally correct
  at 3 (needs 2, where the constant had demanded unanimity). Honest consequence: with all six
  live a verdict is harder to trigger, so MIXED becomes more common. That is what a voter costs.
  **Curated cuts (owner-approved).** The audit measured 24 live-backed blocks vs 12 fully-curated
  ones, and found most curated content was *already* collapsed by FEAT-322 — so the gain here is
  honesty and maintenance, not screen space. Cut, applying the rule already in this file's
  history (*"SPY P/E (mock, Yahoo-dupe) cut"*): **gold** (6 curated leaves, no live source ever,
  permanently ILLUSTRATIVE, better on Yahoo — FRED's LBMA series is discontinued so a live
  wire-up was not a cheap alternative) · the **IPO countdown** (component, data and state) · the
  **SpaceX S-1 panel** and the private Mag-10 entry · and **Mag-10's curated fundamentals**
  (mkt cap, P/E, revenue, margins, FCF, capex) — the live Finnhub price + day move survive,
  which is the half this stack actually sources. **Kept deliberately: GPU $/hr** (half the AI
  unit-economics pair; the live token $/Mtok is the other half, and the pair exists on no retail
  site), the **headwinds register** and the **watchlist** — those are *what the owner thinks*,
  which is precisely what Yahoo/SA/TipRanks structurally cannot host. Peoria kept on owner call.
  A cut has to take its **attribution** with it: the Mag-10 header still read "Ranked by market
  cap · fundamentals curated (reviewed Q1 2026)" after the data was gone — caught in a browser
  check, and now smoke-pinned, because a surviving label that describes deleted data is the page
  lying about what it is showing. Result: `dashboard.jsx` 1761→1522 lines, bundle 614.9→601.4 kB.
  Tests: **643 smoke** (+7) + 138 render, plus browser checks that every collapsible group can be
  expanded without revealing cut content.
- **Deferred:** stored fundamentals + Robinhood sync — now unblocked by the `x-tt-pin` header
  (v3.9): a chat-side daily review can PUT `status_flags`/`ref_px` into the deepDive payloads and
  stamp `lastRun`. When built, store the *triage* shape (`{at, px}` → "% moved since your last TT
  run"), not a reference block a live harness pass re-fetches anyway.

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
- Cache key is **`pulse:snapshot:v15:<ET-date>`** (`<ET-date>` = today in America/New_York,
  `YYYY-MM-DD`). Bump the `v15` prefix to invalidate a poisoned day.
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

node test/smoke.mjs   # 643-assertion no-network smoke test (needs Node ≥17)
npm run test:ui       # browser render test for admin.html (skips if no Chromium)

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
