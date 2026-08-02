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

**Status: the current version is whatever `package.json` says — this header deliberately no
longer restates it.** It read "v3.2.0" for ~58 point releases while the changelog below ran
current (2026-08-02 audit §5): a summary line that has to be hand-bumped on every release is
a rot vector, and the release notes further down are the living record. **Live FRED (incl.
HY-IG credit spreads) + sentiment + Kalshi + RSS-headline + AI token economics + equity
quotes + Shiller CAPE are flowing.** The
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

(A consolidated REGIME LOGIC REFERENCE — both engines' bands, the veto order, the
 ranking method and every constant — deliberately does NOT live here. It leaked no
 book content, but one file describing the whole decision architecture is more
 useful to an adversary than the same facts spread across source comments. Same
 reasoning as the KV-only TT framework doc. It lives as a chat artifact; smoke [33]
 asserts no REGIME_LOGIC_REFERENCE file exists in the repo under any name.)

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
  regime.js             THE public regime engine (C1, v3.60): NFCI bands, REGIME_BAND_TABLE,
                        verdictFrom, computeRegime, flipConditions, regimeFactors,
                        REGIME_QUORUM — extracted verbatim from dashboard.jsx; pure,
                        Node-importable (smoke imports it directly, no more source-lifts).
                        Returns tintKey/colorKey; the UI resolves colors.
  evidence.js           The EvidenceSet contract (C1, v3.60): fieldMode + factorExclusions
                        (ONE home for modeOf and the mock-cannot-vote rule) +
                        buildEvidenceSet → {state LOADING|LIVE|CACHED|DEGRADED|INSUFFICIENT|
                        ERROR|DEMO, factors[], flips, quorum…}. New components render THIS,
                        never their own reading of provenance.
  whatChanged.js        Return-visit digest (C4, v3.60): summarizeEvidence (only quorate
                        live sets may become the baseline) + compareEvidence (posture flips,
                        confidence moves, factor drop-outs/recoveries; "baseline set" ≠
                        "no change"). localStorage key md:lastvalid:v1.
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
  Tests: 643 smoke (+7) + 138 render, plus browser checks that every collapsible group can be
  expanded without revealing cut content.
  **NFCI bands re-derived from first principles (v3.43.1).** The shipped ±0.10 deadband was the
  one number in v3.43 that was *asserted*, and re-deriving it surfaced a defect bigger than the
  threshold. NFCI is a **z-score by construction** (mean 0, SD 1 over 1971–), so its native unit
  is **standard deviations** — a decimal deadband has no meaning in that unit. Worse, post-GFC
  the index sits persistently *below* zero, so a symmetric band around the mean would have voted
  **bullish nearly every week**: a factor that always votes the same way does not inform a
  majority tally, it silently **biases** it. The bands are now **asymmetric**, each threshold
  carrying a reason — **`NFCI_TIGHT = 0`** (the *definitional* mean; crossing it is the event)
  and **`NFCI_LOOSE = -0.5`** (half a standard deviation below the mean, stated in the index's
  own unit). Asymmetry is the same doctrine as the v3.40 TAILWIND withhold: tight conditions
  *cause* drawdowns, while merely-looser-than-average is the ordinary backdrop, not a buy signal.
  Both constants live in **one shared table** driving the tile, the regime vote and the factor
  breakdown, so a label can never disagree with the vote it cast. The mock baseline (-0.42) now
  lands in the NEUTRAL zone on purpose — the demo shows a factor that **abstains** in ordinary
  conditions. Remaining judgment call, stated rather than hidden: the ½-SD loose threshold is a
  defensible round number in the right unit, not a fitted one — FRED is still unreachable from
  this build environment. Tests: **647 smoke** (+4, incl. exact boundary behavior at -0.5 and 0)
  + 138 render, plus a live browser check of all three band states.
- **FEAT-TT-OPTMV (v3.44) — options positions join the one sell ranking.** Owner's call: *"doesn't
  matter if they're options or shares — all holdings and tier-list tickers I really have
  considered in the rankings."* Correct on the substance, and the audit found the exclusion was
  **not doctrine but a missing measurement**: option legs carried `{k, side, n, strike?, exp?,
  src?}` and **no market value anywhere in the schema**, while position-level `mv` is equity-only
  — so the SELL list, whose whole job is "where does the next dollar come from", literally had
  nothing to rank a sleeve on and exiled it to a footnote. (The BUY side never excluded them:
  `renderUpsideRank` doesn't inspect position at all, so an options-only name with a model and a
  price already ranked; only a cap breach vetoes a pick.)
  **`pos.opt[].mv` is the fix** — a per-leg **SIGNED** market value from the broker sync, sitting
  beside the per-leg `src` provenance v3.39 added. **The sign is load-bearing**: a long leg is an
  asset you can sell (`mv > 0`), a **short leg is a liability you must buy back** (`mv < 0`), so
  it is a USE of cash, not a source — summing unsigned would report a short sleeve as available
  funding, exactly backwards. `validatePos` rejects a sign contradiction outright (long with
  negative mv, short with positive). **`mv` stays equity-only** so every existing cap check and
  the tracked-book rollup keep their current meaning.
  **`optSleeve()` fails closed**: a sleeve is measured only when EVERY leg carries `mv`, because
  a partial sum understates the position and would read as a smaller holding than it is — the
  same rule `pos.at` and `lastRun` already follow. Unsynced reads *"N of M leg(s) have no synced
  value"*, never as zero.
  **One list, two honest bases.** Share rows keep the original rule (lowest expected return funds
  first); options rows rank on **realisable dollars** and say so, because a levered, decaying leg
  does not inherit the underlying's %/yr — borrowing that rate would be the exact units error
  D2 removed when `sellRank` silently substituted a raw % for a rate. An options row **qualifies
  on dollars alone** (requiring a model would have re-created the very exclusion this removes)
  and **bypasses the CAP tier**, since `CAP_PCT` is measured against equity `mv`/broker `pct`, a
  denominator a sleeve's value is not comparable to. What remains named below the list is only
  what genuinely cannot be ranked — an unsynced sleeve, or a net-short one reported as an
  obligation with the cost to close.
  Tests: **653 smoke** (+6) + 138 render (1 fixture leg gains `mv` so the options row ranks
  in-list). Until a broker sync populates `opt[].mv`, those names read "value not synced" — the
  honest state, not a guess: an option's mark cannot be approximated from strike and expiry.
- **FEAT-TT-CAPEX (v3.45) — the hyperscaler capex tape, and the conservation lint.** Owner's
  thesis: hyperscaler capex is the most-scrutinized number the book didn't track — "once they
  announce a reduction, Mag-7 rises and AI infrastructure collapses." The audit found the book
  prices the *consequences* of capex everywhere (NVDA revenue rows, TSM wafer starts, BE's DC
  power) while **the pool itself lived nowhere in the system** — the v3.40 defect class again:
  an assumption buried in a number is unfalsifiable. Four pieces:
  **(1) `board.capex`** — the tape. Per-spender rows `{co, fy_guide_B, dir: up|hold|down, at}`,
  validated in `validateBoard` (band 0–2000 $B, dated or rejected), curated at each print — the
  binary calendar already tracks those dates as non-ticker prints; no $0 live source for
  guidance exists. **The tripwire is the thesis instrumented**: ≥2 guiding `down` → red banner +
  a chip-length **⚡ stance-strip badge** (v3.25: visible while everything is closed) — and it
  fires in BOTH directions (≥2 `up` = re-acceleration), because the tape reports, never bets.
  **(2) Typed per-name `capex_exposure`** (deepDive passthrough, registered in `DD_HANDLED`,
  purpose-built section in the CAPITAL drawer): `direct` (NVDA — draws the pool) · `fab` (TSM —
  inside a direct name's COGS) · `power` (BE/GEV — rides the buildout broadly) · `neocloud`
  (NBIS — two-sided). The typing is the sharpened version of the thesis: the tape's turn won't
  say "AI infra: sell", it says who takes it first and who might be HELPED.
  **(3) The conservation lint** — the genuinely novel piece: Σ over `direct` names of
  (FY+1 revenue estimate × `pct_of_rev`) = the capex-funded revenue the book collectively
  implies, vs the tape's aggregate. **Implied > guided pool = the book's own estimates are
  internally inconsistent**, and the lint names the names. `fab` is EXCLUDED from the sum
  (counting TSM and NVDA double-counts the same dollar). **`neocloud` exclusion is an owner
  ruling (v3.45)**: NBIS is grouped in AI infra for the tripwire, but its revenue draws AI
  rental demand, not the tracked spenders' pool — and a pool cut can push overflow demand TO
  it — so its **own `capex/rev` ratio** is the tracked metric instead (`own_capex_B`; the
  fixture's 1× is the spender profile: revenue is capacity-built, not pool-drawn). Unmeasured
  direct names are named and the sum called a FLOOR; untyped exposure is flagged, never guessed.
  **(4) The dashboard's third leg**: `HYPERSCALER_CAPEX` + `HyperscalerCapexCard` complete AI
  Unit Economics — **cost (GPU $/hr) ↔ price (token $/Mtok) ↔ funding (capex $B)** — curated +
  reviewed-dated, ILLUS_HATCH + IllustrativeChip, behind its own CollapsedGroup, and it NEVER
  votes (curated directional reads are the v3.1 invariant's exact target). Figures are
  placeholders to review at each print; headwind #1's $705B counts ALL AI capex, the tape
  tracks the four the market prices.
  Tests: **666 smoke** (+13, incl. the lifted tripwire/conservation math run behaviorally and a
  validateBoard malformation sweep) + **144 render** (+6: turning banner, breach math ($22B vs
  $18B = 122%), typed exclusions with reasons, closed-summary signal, stance badge, deep-dive
  exposure — all against a synthetic HYPA/HYPB/HYPC tape).
- **FEAT-TOKW (v3.46) — tokens/watt: the CONVERSION leg, and the window that must never be
  annualised.** Owner's call: *"token per watt is a key indicator too, especially for NBIS."*
  Correct, and the first-principles reason is not the one usually given — power is not the
  dominant COST (a ~1kW accelerator costing ~$40k burns ~$1.5k of electricity over three years;
  depreciation dominates energy ~25:1). It is the binding **CONSTRAINT**: MW allocations are the
  input that cannot be bought on demand, so tokens/watt is a **capacity-productivity** metric —
  how much sellable output a fixed, hard-to-expand power envelope yields.
  **The identity: `revenue per MW ∝ (tokens per watt) × ($ per token)`**, and in growth terms the
  two rates COMPOSE. Only the RATIO is honestly sourceable: published tokens/W swings 10-50× on
  model size, batch depth, quantization and GPU-only-vs-PUE, and $/Mtok is *retail* API pricing
  carrying the model provider's margin, not a neocloud's wholesale realization. Both scale factors
  cancel in the ratio — so `TOKEN_EFFICIENCY` stores a **relative index** (H100 = 1.00) and the
  card is forbidden by construction from ever printing a $/MW figure (smoke-pinned in both
  directions: no interpolated and no literal `$…/MW`).
  **The defect this build turned up in its own first draft: annualising the price window.** The
  rolling `tokenTrend` is ~12 weekly points at most, and raising a 12-week move to the 52/11 power
  turned a −25% drift into **−98.8%/yr** — arithmetically correct, economically absurd, and
  precisely the units error DEC-D2 removed from `sellRank`. So the window is **never annualised**:
  the durable multi-year efficiency CAGR is projected DOWN onto the price window's own span
  (`effWin = (1+effCagr)^(weeks/52) − 1`), both legs are reported over that same observed span, and
  the span is stated on the card. Below `minWeeks = 8` the band is **withheld entirely** — *"window
  too short to read"* and *"flat"* are different facts. The deadband (`deadbandPct = 5`, a window
  figure not a rate) is measurement noise, not an economic line.
  **The card** sits between the price and funding legs (`cost ↔ price ↔ conversion ↔ funding`),
  ILLUSTRATIVE + hatched + behind its own `CollapsedGroup` (half its input is curated), its verdict
  suppressed on mock/stale via `isIllustrative` like the CAPE BUBBLE and NFCI TIGHT/LOOSE reads,
  and it **never votes** — a directional call off a curated index is the exact v3.1 target.
  **The TT side** is `deepDive.tokens_per_watt`, registered in `DD_HANDLED` and rendered by
  `ddTokWSec` **beside** `utilization_underwriting`, never inside it: utilization underwriting only
  ever addressed the *second* factor of `MW × utilization × tokens/W × $/token`, so two operators
  at identical utilization earn different revenue per MW on different chip generations — the
  productivity term a utilization model structurally cannot see. The gen index is carried **by the
  payload** (each row states its own `idx`, frontier = the max present), deliberately NOT copied
  from `src/`: `admin.html` is buildless and cannot import, and a hand-copied constant drifting out
  of sync would be worse than owner-entered numbers that are visibly self-attested. Fails closed
  like every measured field here — a mix not summing to ~100% is NAMED and the fleet index called a
  **FLOOR**, a missing mix reads *"unmeasured, which is not the same as average"* rather than an
  implied 1.00, an undated block is flagged, and an absent MW pair says the capacity leg is
  unmeasured instead of assuming no growth.
  Tests: **679 smoke** (+13, the scissors math lifted and RUN — a string pin cannot prove a number,
  and the whole feature is a claim about one) + **146 render** (+2: the neocloud decomposition
  computed live — fleet 3.10× vs frontier 4.50× = 69%, capacity 3.00×, productive ≈ 2.07× — and the
  partial-mix FLOOR/undated fail-closed path, both against a synthetic fixture).
- **v3.47 — the LENS lint learns magnitude (found while modelling RKLB).** Building RKLB's
  `pt_model` fired `LENS` ("modelled on ev_s_multiple while FY2027 EPS is 0.05 (>0) —
  earnings-lens candidate"), and the warning was **substantively wrong**: at $63.85 that EPS is a
  **1,277× forward P/E**, i.e. a company *crossing* zero, not an earnings line the
  lowest-structurally-representative-line rule (the v3.40 NVDA derivation) would ever select.
  The lint tested `e > 0`, which is not the same claim as "the name earns". It is now
  magnitude-aware: above **`LENS_MAX_PE = 100`** on `dd.ref_px.px` the earnings line is treated as
  a crossing artifact and the sales lens is correct. Deliberately permissive — NVDA ~22×, TSM ~24×
  and UBER ~18× all sit far under it, so a genuinely-expensive profitable name still warns — and
  with **no price there is nothing to judge against, so behavior is unchanged (still warns)**,
  failing TOWARD the warning rather than swallowing it. Doctrine is untouched: `LENS` is still
  warn-only and the lens is still owner judgement, never the lint's.
  Tests: **682 smoke** (+3, incl. a profitable-name control that must still warn and the
  no-price fallback; `LENS_MAX_PE` is now lifted BY VALUE into the smoke harness — it was a free
  variable that the existing fixtures happened to short-circuit past).
- **v3.49 "TRUSTWORTHY ELIGIBLE" — the value-proposition audit's critical trust failures, fixed.**
  `ticker-terminal/VALUE_PROPOSITION_AUDIT_2026-07-31.md` (owner-commissioned) confirmed the niche
  — *a personal capital-allocation system that remembers your thesis, detects what changed,
  enforces your rules, and tells you what deserves the next dollar* — and found the green action
  layer ahead of its trust controls. Five fixes, smallest coherent set:
  **FIX-A (Critical #1, the two regime surfaces disagreed)** — `isStale()`'s "today" was the
  RUNTIME-LOCAL date (`setHours(0,0,0,0)`): on Cloudflare's UTC edge it advanced at 8pm ET,
  counted the just-closed session as MISSED, and aged normal prior-close data — `/readout.json`
  read INSUFFICIENT (1 input, flip blind) while the same payload in an ET browser read MIXED.
  `etYmd()` in `src/sources.js` now derives today as the **ET calendar date of `now`** in every
  runtime; one clock fixes all three consumers at once (buildTtReadout, the dashboard's `modeOf`,
  the paste projection — they all call `isStale`). The rollover is regression-tested at Thu-9pm-ET/
  Fri-01:00-UTC instants, which genuinely exercise the bug in any UTC runtime (CI, the edge).
  **FIX-B (Critical #2, a green pick despite missing mandatory gates)** — the board emitted
  "both stories agree: TSM" while stance was UNKNOWN, Macro Flip was blind and TSM had NEVER RUN.
  The agree block now **hard-WAITs on a missing gate, each veto named**: unknown stance, a
  suspended (PANIC) stance, an unreadable regime feed or absent/blind/tripped Macro Flip (fail
  CLOSED — an unreadable crash circuit vetoes rather than defaulting to clear), and a non-fresh
  TT run per name (never/aged, ≤30d required — "5 fresh runs against 31 never" must not light a
  green line). **Red hinges stay surfaced-not-vetoed** — D3 (v3.39) is a locked doctrine and the
  audit's cited framework rules concern live data and regime, not hinges; the hinge is still
  named in red on the pick itself.
  **FIX-C (product ambiguities)** — labels now say what each list IS: the math ranking is
  **"VALUATION GAP — math only"**, the green line is **"ELIGIBLE NEXT DOLLAR — all gates
  passed"** (BETA-first-by-math vs TSM-first-eligible were different concepts blended by one
  "NEXT DOLLAR — BUY" banner), and the sell list is **"FUNDING PRIORITY"** (it was never a sell
  recommendation — a positive-upside name can appear purely because another has more).
  **FIX-D (Critical #3, the risk denominator)** — no surface claims "% of NAV" any more: cap
  breaches state **"% of acct equity"** and the TODAY stop names the denominator outright
  ("account equity, options excluded — a floor, not NAV"). The direction of a breach is real;
  the exact figure was never authoritative and now says so.
  **FIX-E (regime denominators disagreed)** — the header said "3/6 bullish" while the 5 Whys
  said "3/5 live factors": `fiveWhys.js` re-derived the denominator from its own hardcoded
  **pre-NFCI five-factor list**. `computeRegime` now returns `counted`/`totalFactors` and every
  surface consumes them (one derivation, the `governingRegime` rule); the fallback list names
  all six voters. Also found: the RegimeBand chip strip had a hardcoded 5-label array, so the
  6th (NFCI) chip rendered literally "undefined" — labels now ride the factor entries (`short`).
  **Resolved by process, not code:** Critical #4 (production not reproducible) was an unpushed
  local checkout; `origin/main` now carries v3.48/v3.49. **Deferred, feature-scale (audit
  capability gaps 1–7):** outcome calibration/benchmarking, portfolio factor-correlation risk,
  option Greeks/assignment exposure, tax-aware funding, clickable evidence citations,
  operational alerts, broker-sync automation — each its own scope, owner to prioritize.
  Tests: **696 smoke** (+14: the ET-rollover regression incl. an end-to-end readout assert,
  the eligibility gates, the relabels, the no-NAV-claim sweep, the shared denominator) +
  **148 render** (+5: a live PANIC-asserted board hard-WAITs with the gate named and leaves no
  AGREE_PICK; the cap-veto scenario now clears the asserted regime too, or it would pass for
  the wrong reason — plus the acct-equity pins).
- **FEAT-TT-READY (v3.50) — one decision-readiness statement per name.** The audit's "too many
  freshness clocks": a ticker page could carry **eight** independent dates — live quote · manual
  `ref_px` mark · `lastRun` · model/lint state · hinge observations · `pos.at` · per-leg option
  provenance · thesis `updated` — each honest alone, none of them answering *can I act on this
  name right now?* Eight truthful clocks that never sum is how a NEVER-RUN name with an undated
  thesis still read as maintained. **`readiness(x)`** consolidates them, and invents no new clock:
  every part reads the SAME helper the individual chip already reads (`runState` · `ddDate`/
  `ageDays` · `ptModelRows`/`lintPtModel` · `LIVE_PX`/`ref_px` · `posOf`/`posAge` · `hingeTally`),
  so a part can never disagree with the chip it summarizes — the `ptModelRows` rule, one
  computation at many altitudes. Severity follows the audit's *"gate the interface by evidence
  coverage"*: **BLOCKED** = evidence needed to act is missing or expired (no current model, a
  MIS-KEYED schedule — the v3.39 rung that silently floors is missing evidence, not a warning —
  no current TT run, no defined hinges, no usable price, a blocking decision scoped to this
  name) · **CAUTION** = evidence aging or partial · **READY** = every clock current. Two
  deliberate NON-blockers: a **red hinge** is surfaced never vetoed (D3, v3.39), and an **absent
  position** cautions rather than blocks — an unheld new name legitimately has none, and blocking
  it would gate exactly the names the next dollar is FOR. Blocking decisions scope by **explicit
  `decision.sym` only**; inferring which decision blocks which ticker from prose would be a guess,
  and a guessed blocker is worse than none (unscoped ones stay board-level, where TODAY already
  surfaces them). Rendered on **both** per-ticker decision surfaces — above the four answers on
  the deep-dive tab, and leading the card (the only surface a WATCH name with no tab ever gets) —
  with the verdict as a token and every blocker/caution as a visible chip (v3.25: a summary is
  only honest if the red things survive it), OK clocks included so "current" is *stated*, not
  inferred from silence. **FIX-B now vetoes on `readiness().blockers`** rather than re-deriving
  the run check, so the green line and the name's own readiness bar cannot disagree; cautions
  never veto (aging evidence is the owner's to weigh, missing evidence is not). Found while
  wiring: one surviving `% NAV` claim on the card, missed by the FIX-D sweep.
  Tests: **718 smoke** (+22, `readiness()` lifted and RUN against the real PT helpers — a string
  pin cannot prove a severity rule, and this one gates the green line) + **153 render** (+5: the
  bar leads both surfaces, every clock stated, and AAA's red hinge named on the bar while absent
  from the blocker list).
- **v3.51 "the page tells the truth about itself" — the PUBLIC-side audit.** A second audit found
  the public dashboard's positioning defensible (*"MacroDash tells you whether the market backdrop
  supports taking risk — and abstains when the evidence is stale"*) and its moat correctly placed
  in the **judgment layer, not the data layer**. Its Critical #1 (the two freshness realities) and
  the NFCI chip/denominator defects were **already fixed by v3.49** — it audited a pre-fix
  checkout. What survived, all of it the same shape: not a wrong NUMBER, a wrong CLAIM about
  the page itself. **The engines are named** — this six-factor vote is the **MACRO BACKDROP**,
  distinct from `/readout.json`'s six ORDER-GATING checks (both legitimate; unnamed, a reader
  reasonably assumes one verdict disagreeing with itself). **"5-factor vote" → 6** in three
  user-facing strings (NFCI has voted since v3.43), now pinned against `REGIME_FACTOR_FIELDS` so
  a 7th voter fails the build. **Confidence, the audit's first-screen item**: Signal Quality
  counted TILES and never said whether the VERDICT was trustworthy — the strip now reports
  `BACKDROP N/6 factors voting`, **names** the excluded ones ("N of 6 usable" without saying
  which is half a fact) and calls out a blind **crash gauge (VIX)** by name, all off
  `computeRegime`'s own `counted`/`totalFactors` so it cannot drift from the vote. **SPY is
  labelled the FRED SP500/10 proxy it has always been** (the tooltip claimed "S&P 500 ETF").
  **CAPE credits `multpl.com`** — "Manual" beside a LIVE badge made the provenance vocabulary
  self-contradictory (`api` is the fetch path, `mode` is freshness, and multpl IS the live
  scrape). **The alert toggles state their real limit at the weight of the control** rather than
  in 8px muted text — an ON/OFF beside "notifications not wired" is the honesty invariant
  violated by an *affordance* instead of a number.
  **FEAT-WHY3-MATERIAL — freshness is not relevance.** WHY #3 gated the top RSS item on
  freshness alone, then labelled whatever returned "Headline driver": the audit caught a
  **Fidelity death-certificate administrative story** presented as the driver of a macro regime
  — fresh, dated, correctly attributed, explaining nothing. A confidently-irrelevant *why* is
  worse than no why, exactly as a fabricated number is worse than a missing one.
  `isMacroMaterial()` is a curated **allowlist of macro-transmission vocabulary** (policy ·
  inflation · growth/labor · rates/credit · volatility · energy · systemic shocks *and their
  resolution* — a ceasefire moves the tape like its onset). Deliberately **ONE-WAY**: a
  non-matching headline is WITHHELD and the slot says *why* it was withheld — "today's top story
  is not macro-material" is a different fact from "no headline arrived", and only the first stops
  an administrative story reading as the market's driver. Never rewritten, never scored.
  **Owner calls, honoured:** the **moon voice stays PRIMARY** (`wen moon?`/MOONING/HODL —
  personality kept, and pinned so a later refactor can't quietly drop it), and of the audit's
  demote list only the **Mag 10 quote strip** is cut — v3.43 took its curated fundamentals on the
  Yahoo-dupe test and the surviving quote strip failed the *same* test. Component, mock array,
  state, CSS and merge all removed; `mag10PricesJson` stays **mapped** because the same Finnhub
  pull feeds QQQ. The cut took its attribution with it — and found that the **footer had been
  crediting "Mag 10 fundamentals · SEC S-1" for two releases after v3.43 deleted both**, the
  precise defect v3.43's own note warns about. Watchlist, headwinds, Peoria and the alert
  toggles are KEPT per owner call. **Deferred (feature-scale):** "what would change the verdict"
  — the exact thresholds that flip the posture — is the audit's remaining first-screen item and
  its own scope.
  Tests: **735 smoke** (+14) + **153 render**, plus a **14-check Chromium pass on the built
  page** (every collapsed group expanded to prove nothing cut reappears, and that the footer
  still RECORDS the retirement — history kept, like the CBOE note).
- **FEAT-ALERT-EVAL (v3.52) — the alerts evaluate, or say they cannot.** A cross-suite audit
  called the Macro Alerts section *"interface theater"* for toggles beside "notifications not
  wired". The defect was one layer earlier and worse than the finding: **`triggered` was a
  hardcoded `false` that nothing ever wrote**, while the header claimed *"Triggers evaluate live
  data"* — so the red dot was unreachable, `activeAlerts` was permanently 0, and the section
  asserted "nothing has tripped" from code that **had never looked**. That is a directional claim
  on absent evidence: the exact v3.1 invariant this project exists to enforce, violated by an
  *affordance*. (v3.51 had fixed only the DELIVERY half of that sentence and left the evaluation
  half standing — which is why this is a follow-up, not a new feature.)
  Evaluation is now real and rides the same rails as everything else: `evalAlert()` judges a
  threshold **only** from LIVE/CACHED, non-stale inputs, and a mock/stale input yields **BLIND**
  — deliberately distinct from CLEAR, because *"this has not tripped"* and *"I cannot see whether
  it tripped"* are different facts and only the second is true when the feed is dead (the v3.40
  TAILWIND-withhold asymmetry, the v3.50 fail-closed rule). The header reports `N BLIND`
  separately, since "0 FIRED" with dead inputs is a false clear. The **SPY/200-DMA cross is judged
  against today's live moving average**, not the `692.4` hardcoded when the alert was authored —
  a constant that silently drifts as the market moves is the same stale-mark defect `PX_STALE_D`
  exists to catch. No stored `triggered` field survives; trigger state is computed every render.
  **A11Y (same audit):** the public page had **zero landmarks and zero live regions** — the regime
  verdict is the page's entire output and a screen reader was never told it changed. Added
  `role="main"`, and `aria-live="polite"` on the verdict band and the confidence strip only —
  politely, and not on every tile: a reader should hear *"the verdict's evidence base changed"*,
  not each number ticking.
  Tests: **748 smoke** (+13; `evalAlert` and the real `ALERT_METRICS` table lifted from source,
  since Node cannot import JSX — trip/clear/blind/stale/no-metric/non-finite all executed) +
  153 render + an 18-check Chromium pass.
- **FEAT-FLIP (v3.53) — "what would change the verdict", and ONE band table.** The public
  audit's fourth first-screen answer (Posture ✓ · Confidence ✓ v3.51 · Why ✓ · *what changes the
  call* ✗) and the public-side counterpart to the terminal's `readiness()`: that one answers
  *"is the evidence there to act"*, this answers *"what would move the answer"*.
  **The structural half matters more than the feature.** The six bands were inline literals
  inside `computeRegime`, so any flip surface needed a SECOND copy of every threshold — the
  drift defect this project keeps paying for (the v3.49 5-vs-6 denominator, the v3.51 stale
  factor-count label, the v3.39 PT audit). They now live in **`REGIME_BAND_TABLE`**, where
  `vote()` is the ONLY expression of a band: `computeRegime` VOTES from it and `flipConditions`
  measures DISTANCE to the same edges, so a flip claim can never contradict the verdict it
  describes. `verdictFrom()` (the strict-majority rule) is extracted for the same reason — the
  simulation runs the *identical* test, not a restatement. The refactor is behaviour-neutral and
  every boundary is now EXECUTED rather than string-pinned (the DEC-33 convention), including
  the two asymmetries that make a second copy dangerous: **F&G is the one INVERTED factor**
  (bullish ABOVE its edge) and **NFCI is the one INCLUSIVE bull edge** (`<=`, so it reads "at or
  below").
  **Load-bearing, not decorative:** the naive version prints six distances. `flipConditions`
  simulates each crossing through `verdictFrom` and keeps only those that actually change the
  label — then sorts nearest-first. **Only ADJACENT transitions are offered**: from the bull band
  you can reach neutral, not bear. Quoting "VIX above 25 would flip this" while VIX sits at 17 is
  true arithmetic and a misleading next step.
  **The three abstention rules, each with precedent here.** (1) A **stale** factor is not voting,
  so its threshold is not load-bearing — it is listed as excluded, never as a distance (the same
  gate as the vote). (2) A factor whose vote is not a single scalar crossing **abstains with the
  reason named** — CPI votes on the SHAPE of its trend, CAPE on a two-condition OR; inventing a
  crossing for a compound rule would be a fabricated number in a decision surface. (3) **"No
  single flip changes this" is a real answer**, stated plainly in both the band and the panel,
  never padded with the nearest distance to look responsive (the `readiness()` BLOCKED / one-way
  `isMacroMaterial` withhold rule). Abstentions and exclusions RENDER — hiding them would read as
  "these four are all there is".
  **Deliberately NOT wired into `/readout.json`** — same reasoning as NFCI on arrival: that
  contract gates real orders and a new field there is its own decision.
  Found by the browser check while verifying: a **`whiteSpace:"nowrap"` subtitle in the v3.46 AI
  unit-economics header blew the page to 488px at 390px wide** — pre-existing, now wrapping.
  Tests: **771 smoke** (+23: every band boundary executed, the majority rule at 3/5/6 voters,
  all three abstention rules, adjacency, inclusivity copy, sort order, and the render pins) +
  153 render + a **14-check Chromium pass at 390px and 1200px**, panel open and closed.
- **FEAT-QUORUM (v3.54) — "mock must never vote": the 11.4.5 audit's CRITICAL.** The audit
  found the one defect that mattered most and that **passed every existing test**: `staleFactors`
  excluded only `STALE`, so a **MOCK factor still voted**. During `LOADING` — and after any
  failed fetch — every field is MOCK, so the page computed a confident posture *entirely from
  `MOCK_DATA`* while Signal Quality truthfully reported `0 live / 15 mock` two rows above it.
  The tiles have suppressed directional calls on mock since v3.1 (`isIllustrative`); the
  **headline verdict never did**, which is the one place it matters most.
  Three linked fixes. **(1) MOCK is unusable in a live build**: `unusable()` drops anything not
  LIVE/CACHED, gated on `liveBuild` so a pure demo build is untouched — mock IS the demo's
  baseline by design (the `demoted()`/`anyLive` rule). That gate cannot come from `mode`, because
  **`mode:"MOCK"` is ambiguous** between "demo build" and "live build whose fetch failed", and
  only the second must withhold; `useMarketData` now exposes the build's **intent** (`liveBuild`).
  **(2) A quorum**: `REGIME_QUORUM = 4` of 6 → below it the label is **INSUFFICIENT**, not a thin
  verdict, with `raw` recording what the majority would have said (never silent, same contract as
  the v3.40 TAILWIND downgrade). The dashboard had **no abstention rule at all** while the tt-v1
  readout has refused to publish below 3 available checks since v3.3 — the two engines disagreed
  about when to stay silent and the *human-facing* one was the permissive side. Four is
  deliberately stricter than the readout's three: that consumer knows what INSUFFICIENT means,
  a public reader does not. **(3) LOADING is not a verdict state** — the posture is withheld
  outright, the flip line is suppressed (nothing to flip), and the moon voice gets its own
  honest fourth state (`CAN'T CALL IT`) rather than defaulting to HODL, which would render a
  real hold call made from no evidence.
  **WHY #1 freshness-gated (audit High).** WHY #2 carefully gated its cross-signals while WHY #1
  asserted SPY/CPI/Fed **unconditionally** — a mock CPI could be narrated as "today's core tape"
  inside the verdict's own explanation. Each is now gated independently, unavailable clauses are
  OMITTED rather than filled from mock, and a thin anchor states itself (`N/3 core inputs
  usable`). Found while wiring: `FW_FIELDS` didn't contain the three core fields, so gating them
  without adding them would have dropped inputs that were perfectly fresh.
  **`test/public-render.mjs` (`npm run test:public`) — the structural fix.** The audit's sharpest
  point was that this defect passed everything, and it was right: smoke covers pure functions and
  source strings, `test/render.mjs` covers `admin.html`, and **nothing ever drove the public React
  page through its data states**. The new suite serves the built bundle with a stubbed
  `/api/snapshot` and asserts the contract across **loading · live · degraded · error**, plus
  320/390/1280px reflow and the landmarks — 28 assertions. Skips cleanly without Chromium, same
  additive convention as `test:ui`.
  **A11Y (audit High).** `text-muted` `#3d4760` measured **2.15:1** on `--bg` while carrying 7–10px
  PROVENANCE text — the honesty layer the whole product rests on — now `#717d92` (4.79:1 / 4.54:1
  on surface). `live-cyan-700` was annotated AA-compliant and measured **3.20:1** on its own badge:
  a token *asserting* a compliance it never had, the same defect class as a label describing
  deleted data; now `#1c93b0` (4.78:1). **Contrast is now COMPUTED in smoke**, not claimed in a
  comment. Added a `:focus-visible` ring (focused controls had **no** indicator) and the page's
  first-ever heading — it contained no `h1`–`h6` at all, so a screen reader had no outline;
  visually hidden, since the branded header is the visible identity.
  **HTTP semantics (audit Medium).** `?seed=1` and `?migrate=1` **mutated state on GET**, so a
  prefetch, link preview, uptime monitor or replayed URL could trigger a write. Both are now
  POST-only behind the same Origin/CSRF guard every other mutation uses, idempotency unchanged,
  with the GET path returning 405 naming the correct verb. The old pin literally read *"read-only
  by design — no PUT/POST handler exists"* and **passed while the GET route wrote** — it measured
  the verb, not the safety; it now measures the safety.
  **Could NOT reproduce** the audit's *"320px: 19px horizontal overflow"*: measured 320px on the
  real fetch-failure path, every collapsed group expanded, `scrollWidth === 320`. The overflowing
  node it describes is almost certainly the 317px `whiteSpace:"nowrap"` subtitle **v3.53 fixed**
  hours earlier — consistent with auditing the deployed bundle before Pages redeployed.
  Tests: **802 smoke** (+31) + **153 render** + **28 public-render** (new).
- **FEAT-TT-CAPABILITY (v3.55) — the demand side of the capex tripwire, built as a FALSIFIER.**
  FEAT-TT-CAPEX (v3.45) instruments the **supply** of AI capital and fires when ≥2 spenders guide
  down. But the *reason* they would guide down is capability/ROI disappointment, and that leading
  indicator was instrumented nowhere: the book watched the announcement, not the thing that
  causes it. `board.capability` closes it — and the design choice that matters is that it is a
  **falsifier, not a confirmation**. A field reading *"capability: healthy"*, maintained by the
  person holding the AI-infra book, is self-attestation at its most dangerous — the *"sophisticated
  rationalization engine"* the value-proposition audit warned about. So **`threshold_months` is
  REQUIRED by `validateBoard`**: the level at which you would change your mind must be
  pre-committed and stored *before* a reading can be filed against it. A threshold chosen after
  seeing the observation is exactly the rationalization this block exists to prevent, and the
  validator is the only thing that can enforce the ordering. `prior_months` is required too (the
  v3.29 rule that the signal is the DELTA), as are `metric`, `source` and `as_of`.
  **Nothing extrapolates** — smoke asserts there is no `Math.pow`/`**`/`Math.exp` anywhere in
  `capabilityState()`. A doubling time is a rate, and projecting "capability in 2030" from it is
  the v3.46 window-annualising error with a longer fuse (a 12-week move raised to 52/11 read
  −98.8%/yr: arithmetically correct, economically absurd). It reports what was measured and how
  it MOVED. The tripwire is **bidirectional** like the capex tape — a materially faster doubling
  is information too, and suppressing it would make the block a one-way confirmation of the bear
  case. Bands reject the impossible, not the unusual: a **very long doubling time is a genuine
  STALL**, which is the signal, so it must not be banded away as a typo. Fails closed — absent or
  malformed reads as unknown, never as healthy.
  Rendered in the SAME panel as the capex tape (supply and demand are two halves of one thesis)
  and the drawer summary carries the demand state so a red thing survives the collapse. **Supply
  and demand share ONE stance badge** (`⚡ AI both legs`): they open the same drawer, two chips
  would be redundant, and — measured — a second chip cost a wrap row and blew the v3.42 390px
  stance budget from 119px to 165px. That guard did its job; the fix was design, not truncation.
  **Honest limit, stated rather than hidden:** this is the weakest-sourced input the book carries.
  Task-horizon doubling is one research group's curve fit through a modest number of noisy points
  across model generations — an observed trend, not a law like the compute scaling curves — and it
  updates in months, not days. Survivable for a curated, non-voting block whose whole job is to
  name a falsifier; it would **not** be survivable for anything that gates an order.
  Tests: **+19 smoke** (validator rejections incl. the missing-threshold case, bands both ways,
  and `capabilityState` lifted and RUN — a tripwire is a claim about numbers) + **+2 render**
  (a tripped falsifier driven live against a synthetic fixture).
- **FEAT-30Y (v3.55) — the long end, and why this is not the TLT rejection replayed.** v3.43
  refused TLT because it is a ~17-duration monotonic transform of the `tenYear` this page already
  carries — no new information, plus an ETF's expense drag. **DGS30 is not derivable from DGS10**:
  the **10s30s spread** is the term-premium / fiscal-risk gauge, and *"the long end breaks out
  while the front end holds"* is a different transmission channel from a parallel shift. It passes
  the v3.43 test the same way NFCI did — Yahoo shows you the 30Y level; what it does not do is
  judge it, abstain when stale, or pair it with the curve shape.
  Wired through the existing `fetchFred` path (17 series = **one more batch of 5**, which is
  exactly why the phase batching must not be collapsed), emitting `thirtyYear` + D1/W1/M1 +
  sparkline, and the derived **`spread10s30s`** stamped from `thirtyYearAsOf` (the `creditSpread`
  pattern) with the temp sparklines deleted rather than leaked. `thirtyYear` joins **DAILY** —
  unlike NFCI, DGS30 genuinely is daily, so `idx[5]`/`idx[21]` really are ~1wk/~1mo. Deltas are
  **absolute pp**, never `pct()`, matching the 10Y (rates move in points, not percent).
  Bands `[0,20]` on the yield (the 1981 long-bond peak was ~15.2%) and **`[-10,10]` on the
  spread — an INVERTED curve is the signal, not a parse fault** (the negative-WTI rule).
  The tile sits beside the 10Y because the pair IS the point, states the 10s30s on its face
  (naming `INVERTED` when negative), and carries **5.00% as a stated REFERENCE level, never a
  verdict** — a directional call off a level would be the v3.1 invariant violated. Two alerts ride
  FEAT-ALERT-EVAL: **30Y above 5.2%** (active) and **10s30s inverts** (off by default), both
  live-gated, and the spread alert needs BOTH legs live or it reads **BLIND** rather than clear.
  **It does NOT vote on arrival** — same rule NFCI arrived under: `REGIME_BAND_TABLE` and the
  tt-v1 readout are untouched, because adding a voter changes the majority math for a contract
  that gates real orders, and the bands would be asserted rather than calibrated (FRED is
  unreachable from this build environment). Owner call once real values have been observed.
  Tests: **+17 smoke** + a **15-check Chromium pass** across live and mock-fallback at 390px,
  confirming the tile is ILLUSTRATIVE on mock and that the 5.2% alert trips at 5.24.
- **FEAT-TT-RANKEXPORT (v3.56) — the populated rankings, off the phone.** The rankings document
  cannot live in the public repo (book content is KV-only), so the terminal produces it where the
  data actually is: **📊 RANKINGS → SHARE** builds it client-side from memory and hands a real
  `File` to `navigator.share()`, which on iOS opens the native sheet — Save to Files, Notes,
  Messages, AirDrop.
  **The load-bearing property is REUSE.** `buildRankingsMd()` reads `UPSIDE_ROWS`, `AGREE_PICK`,
  `sellRank()`, `readiness()`, `ttInfo()` and `rankWeight()` — it never calls `ptModelRows` or
  `pickRow` itself. An export that re-derived its own ranking could disagree with the screen it
  was exported from, which is the exact drift defect doctrine #1 exists to stop (smoke asserts
  the recompute functions are absent from the section).
  Contents, in the order the daily loop asks for them: **STANCE** first (whether capital may move
  outranks any ranking) · a **master table** carrying composite, %/yr, weight, readiness, flags
  and **four category ranks per name** (overall upside · composite · within tier · within lens) ·
  **per-tier and per-lens leaderboards** · **ELIGIBLE NEXT DOLLAR** with *why each other name is
  not* · **FUNDING PRIORITY** carrying its own "not a sell recommendation" disclaimer · names it
  could **NOT** rank (silent truncation reads as full coverage) · model lints · and a
  **provenance footer** stating the floor denominator, the self-attestation limit, and that the
  file is private book content.
  **Ranks are DENSE** — two names tied on upside share rank 1 and the next is 3, because tied
  scores are not first and second; a name with no rate is *excluded* from that ranking rather
  than sorted last as if it were 0.
  **The iOS gesture rule is respected:** the document is built **synchronously** before any
  `await`, because Safari requires `navigator.share()` to be reached from the user gesture.
  Fallback chain: file share → text share → clipboard → download. `text/plain` (not
  `text/markdown`) with a `.md` filename, since iOS share targets accept it far more reliably.
  **A cancelled sheet is an `AbortError` and is never reported as a failure.**
  Found by the browser check: the stance line printed its verdict twice (`st.txt` already leads
  with it) — now one line, with the qualifier chips as bullets.
  Tests: **863 smoke** (+17, incl. `rankCategories` lifted and RUN — dense ties, excluded
  no-rate rows, per-category scoping) + **169 render** (+13: the real document built from the
  fixture and asserted for NaN/undefined leakage, plus the share chain driven with a stubbed
  `navigator.share` confirming a real `File` of the right name and type reaches the sheet, and
  that cancelling neither throws nor toasts a failure).
- **v3.57 — end-to-end pass: five findings, one of them a white-screen.** The terminal driven
  through empty / minimal / partial / adversarial books at 390px and 1200px, every API failure
  mode (500, malformed JSON, wrong shapes, all-fail), and the pure functions fuzzed with hostile
  inputs. Everything degraded gracefully except one path, and the bugs found were the kind no
  render test catches because the fixture is always well-formed.
  **(1) A malformed stored book white-screened the terminal.** `applyServer`'s `data.book||[]`
  catches null/undefined but a truthy non-array (`book:{}` — a bad import, a hand-edited KV doc,
  a partial write) sailed through and `BOOK.filter` threw, killing the whole board.
  `validateBook` guards the PUT path; **GET trusts whatever KV holds**, so the client has to
  fail closed too. It now degrades to EMPTY — which has an honest rendered state — and **says the
  stored doc is malformed, warning against saving over it before exporting a backup**, rather
  than silently pretending the book is fine.
  **(2) `rankCategories` ranked a NaN rate** (introduced in v3.56): `!==null && !==undefined`
  does not exclude NaN, so an unrankable name received a rank. Now `Number.isFinite`, which also
  catches Infinity — the same rule as "unmeasured must never read as 0": unrankable means
  EXCLUDED.
  **(3) A string-typed payload accused the wrong field.** Quoted numbers (`"100"` not `100` —
  what hand-edited JSON produces constantly) compute no rungs, and `NOFLOOR` then reported the
  inputs as *missing* when they were present, sending you after the wrong defect. A new **`TYPES`
  error** names the actual offending paths and the fix (`"100" is not 100`), and is careful not
  to flag a genuinely non-numeric string like a `note`.
  **(4) A comment still claimed the Kalshi odds were unwired** ("live Kalshi wiring TODO") —
  live since v2.6.3. The same label-outliving-its-data defect as the Mag-10 footer.
  **(5) Three files carried two body caps with no stated reason.** `positions.js` is 64KB while
  the book is 200KB; that is deliberate (the store holds only `{sym: pos}` records, and a merge
  PUT far larger is a malformed sync) but read as an oversight. Now documented.
  Also confirmed working and left alone: `fl:"n/m"` on negative EPS is intentional (v3.17, no P/E
  before profit) and is correctly filtered out of the candidate set by `pickRow`'s numeric test.
  Tests: **878 smoke** (+15, incl. `applyServer` lifted and RUN against malformed shapes — and
  a test-isolation bug caught while writing them, where a shared closure leaked toasts between
  fixtures) + 169 render + 28 public-render.
- **v3.58 "the hotfix" — the public UX re-audit's five fix-now items.** The owner-commissioned
  re-audit (of v3.55; reconciled against v3.57 before planning) returned **HOLD for hotfix, do
  not roll back**: the v3.54 quorum fix is confirmed sound, but the page still contradicted its
  own honesty contract in one place and broke its narrowest width. Five fixes:
  **A1 — the 5 Whys narrated MOCK under a withheld verdict.** `freshSet` keyed on `anyLive`, so
  a live build in its LOADING or fetch-error state passed `fresh:null` — computeFiveWhys's
  "demo mode, narrate everything" — and the page's most explanatory section asserted mock
  SPY/CPI/Fed as today's core tape while the verdict said CAN'T CALL IT. Keyed on **`liveBuild`**
  (the v3.54 intent disambiguation, completing it): loading/error now passes an EMPTY set, every
  clause freshness-gates out, and the anchor states itself (`0/3 core inputs usable`). The
  HEADLINE's SPY clause is gated the same way — it embedded the mock day-move unconditionally.
  Demo builds still pass `null`: mock IS that baseline (the `demoted()`/`anyLive` doctrine).
  **A2 — the 320px contract.** The sticky header measured 327px on the deployed page. The
  identity group gets `minWidth:0`, the action group wraps, and the duplicate lowercase
  wordmark hides below 360px — the brand name is already the element beside it.
  **A3 — the browser suite tells the truth about itself.** `public-render.mjs` navigated to `/`
  only, so its "public" results actually described the OPERATOR header (with the TERMINAL
  link). Routes are now explicit and BOTH are driven (4 widths × 2 routes), and all browser
  suites honor **`REQUIRE_BROWSER=1`**: a missing Chromium becomes a hard failure instead of a
  clean skip — a silently-skipped gate reads as a passed one. Bare machines keep the skip.
  **A4 — the public/private boundary is enforced, not commented (owner decision).** The
  shareable `?view=public` route now gates MY CONVICTION and Macro Alerts behind `!publicView`
  (the TERMINAL-link pattern; the Zone-E gate finally has something to hide). The default view
  keeps both — the v3.51 "keep" call stands for the operator's own page. The public footer
  NAMES the omission, because a cut takes its attribution with it.
  **A5 — the three npm advisories are classified, not mysterious.** Measured:
  `npm audit --omit=dev` = **0 vulnerabilities**; all three (esbuild moderate, postcss high,
  vite high) are dev-scope build toolchain, no production exposure. `npm run audit:prod` pins
  the command; `npm audit fix` took the in-semver toolchain patches (nanoid, postcss).
  Tests: **890 smoke** (+12, incl. the headline gate run behaviorally in all three freshness
  modes) + 169 render + **50 public-render** (+22: both routes × 4 widths, the A4 route-pair
  boundary proof, and the A1 no-mock-narration assertions in LOADING and ERROR — the audit's
  exact exit condition) + REQUIRE_BROWSER verified to exit 1 against an empty browsers path.
- **v3.59 "the follow-ups" — the re-audit's medium findings, closed.** Five pieces:
  **B1 — ERROR is a mode, not a costume.** A failed live fetch collapsed to `mode:"MOCK"` —
  indistinguishable from an intentional demo build, with no way to tell whether to wait, retry,
  or shrug. `useMarketData` now sets **`ERROR`** (mock content still renders underneath,
  everything stays ILLUSTRATIVE — graceful degradation holds), exposes `lastError` and a
  **`retry()`** that resets to LOADING and re-arms the full fetch machinery. The header states
  the outage ("live service unavailable — numbers below are illustrative") with a ↻ RETRY
  button; `MOCK` now means exactly one thing: a demo build. This completes the `liveBuild`
  disambiguation v3.54 started. The public suite drives the whole cycle: fail → ERROR badge →
  flip the stub → Retry → posture appears.
  **B2 — fresh is not live.** Signal Quality's "13 live" counted LIVE+CACHED under one word, so
  a cached observation read as newly fetched. The rollup is now **`N fresh (L live · C cached)`**,
  and the two static "derived from live data" footers became **state-derived** (live · cached
  snapshot · unavailable · demo) from ONE derivation shared by both — a static string asserting
  liveness across error states was the same class of lie as the alerts affordance.
  **B3 — operational data needs a token.** `?debug=1` exposed `_diag` to anyone; it now requires
  the **`DEBUG_TOKEN`** secret (`?debug=<token>`, fail closed both ways — no secret configured
  means no `_diag` for anyone). And the public routes gain a **report-only CSP** (observe before
  enforcing); `/admin.html` is deliberately exempt — its buildless inline script would need
  `'unsafe-inline'` script-src, which defeats the point, and its CSP is the deferred
  admin-extraction scope.
  **B4 — a11y past the tokens.** Header actions get real 44px thumb targets at phone width;
  sparklines are marked decorative and the SPY chart gains a visually-hidden **text equivalent**
  (trend vs both moving averages — the decision content); and the two block-sized `aria-live`
  regions narrowed to **one concise status sentence** ("Backdrop MIXED: 4 of 6 factors usable")
  — a reader should hear that the call changed, not entire blocks re-read.
  **B5 — AGENTS.md stops being a rot vector.** Its two incarnations both froze and drifted
  (the re-audit caught it still claiming a long-outgrown suite size and a missing test script).
  Now a thin pointer with **no volatile facts at all** — no versions, no counts — and smoke
  enforces that shape, so the third incarnation cannot rot the same way.
  Tests: **904 smoke** (+14) + 169 render + **56 public-render** (+6: the fail→retry→recover
  cycle driven live, and the narrowed live-region contract).
- **v3.60 "the P0 slice" — Overview shell, Evidence Matrix, What Changed (the committed
  sprint).** The re-audit's recommended vertical slice, built behind the existing data with no
  new fetches. **C1 — the extraction the last two audits both named as highest-leverage:** the
  regime engine moved verbatim to **`src/regime.js`** (pure, Node-importable — smoke now
  IMPORTS it instead of lifting source text, which is stronger and immune to formatting
  drift; the one change is `tintKey`/`colorKey` out, colors resolved by the UI). On top of it,
  **`src/evidence.js`** builds the **EvidenceSet**: ONE typed contract — state (the re-audit's
  interface table, 1:1: LOADING · LIVE · CACHED · DEGRADED · INSUFFICIENT · ERROR · DEMO),
  per-factor rows (value · vote from the band table itself · freshness · as-of · exclusion
  reason), flips, quorum — that components render instead of each interpreting provenance.
  The dashboard's own `modeOf` and `staleFactors` ARE now the shared `fieldMode`/
  `factorExclusions` (no local copy to drift). **C2:** a real `<header>` landmark, a Sections
  `<nav>` (now the sticky element — the header scrolls away instead of renting 60px of every
  phone viewport), and a six-anchor `h2` outline (overview · drivers · markets · macro · ai ·
  health) where the nav and the outline are the SAME structure. **C3:** the **Drivers matrix**
  — six factor cards rendering the contract, an excluded factor NAMED with its reason on the
  card ("4 of 6 usable" without which is half a fact). **C4:** **What Changed** — the baseline
  is only ever a quorate, non-withheld, live-build snapshot (`summarizeEvidence` returns null
  otherwise, so mock/thin evidence can never seed a diff); first visit says **"baseline set"**
  (a different fact from "no change"); an identical return visit says **"no material change
  since <date>"** explicitly; posture flips, confidence moves, factor drop-outs AND recoveries
  are each named. Persist happens AFTER compare — the baseline advances exactly when a
  comparison was rendered. A garbled/wrong-version stored baseline fails toward "baseline
  set", never toward diffing a shape we don't understand. Plus a **Data Health** section
  (per-source mode · cadence · as-of, ERROR + Retry surfaced there too).
  **C5 — the repo's first CI** (`.github/workflows/test.yml`): smoke + BOTH browser suites
  under `REQUIRE_BROWSER=1` (a missing browser FAILS in CI; bare machines keep the local
  skip) + `audit:prod`. `PLAYWRIGHT_BROWSERS_PATH` is pinned because `findChromium()` does
  not search playwright's default CI cache — found before it could fail a run.
  Tests: **926 smoke** (+22: every contract state EXECUTED via real imports, the digest rules
  incl. garbled-baseline and recovery cases, and the five engine pins migrated from source-
  lifts to behavior) + 169 render + **67 public-render** (+11: nav/outline/landmark, the
  matrix with a named exclusion driven live, and the baseline-set → no-material-change cycle
  across a real reload).
- **v3.60.1 — the gate that failed on a browser that was there (2026-08-02 scheduled audit).**
  The repo's first CI run, shipped hours earlier in v3.60, went **red on `main`** — and the
  failure was the inverse of the one it was built to catch. `findChromium()` (a copy in
  `test/render.mjs` and `test/public-render.mjs`) hardcoded playwright's **pre-Chrome-for-
  Testing** directory layout. playwright-core 1.62 ships CfT builds, whose own
  `EXECUTABLE_PATHS` table reads `"linux-x64": ["chrome-linux64", "chrome"]` — so on
  `ubuntu-latest` the browser downloaded **successfully** (`chromium-1234`) and was then
  reported **absent**. Under `REQUIRE_BROWSER=1` that is a hard failure, so both browser
  suites AND `audit:prod` never ran: the gate A3 (v3.58) added specifically so *"a
  silently-skipped gate reads as a passed one"* failed loud on a **present** browser instead,
  and every commit since landed unverified.
  **The fix is not a wider guess.** The audit proposed adding the one x64 path; measured
  against playwright's real table, the same hardcoded list was **also wrong for both macOS
  layouts** (CfT renamed `Chromium.app` → the `Google Chrome for Testing.app` bundle, split
  by arch), so a maintainer running `npm run test:ui` on an Apple-silicon machine got a
  false SKIP — the *original* defect, silent. Root cause is the hardcoded copy itself, so
  `chromium.executablePath()` — playwright's **own registry**, the source of truth for the
  layout — is now consulted first and will survive the next rename. It COMPUTES a path for
  the build pinned in `node_modules` rather than verifying one, so the result is
  existence-checked, and the directory scan remains as the fallback for a browser installed
  by a *different* playwright build (the pinned-image case, which is exactly what this
  environment has). Both contracts are preserved and re-verified: an explicitly set
  `PLAYWRIGHT_BROWSERS_PATH` still means "look nowhere else", `REQUIRE_BROWSER=1` with no
  browser still exits 1, and a bare machine still skips cleanly at exit 0.
  **Verified by reproduction, not inspection**: the CI layout was rebuilt locally
  (`chromium-1234/chrome-linux64/chrome`) and the pre-fix code fails on it with CI's
  *identical* error string while the fixed code passes 169 — the bug reproduced and closed,
  rather than a diff assumed to work.
  **Doc drift (audit §5), fixed by deletion rather than by bumping.** `README.md` asserted a
  version ~52 point releases stale, an assertion count off by hundreds, and *"there is no
  `test` script"* — which had been false for many releases and actively misdirected
  contributors; CLAUDE.md's own **status header was frozen ~58 releases back** and carried
  the same false `test`-script claim. That is the "label outliving its data" defect this
  changelog keeps fixing *inside* the app (the Mag-10 footer, the "5-factor vote" strings,
  the Kalshi TODO), so it gets the cure v3.59's B5 already proved on `AGENTS.md`: **state
  where the truth lives, don't copy it.** No version, no counts, no feature list outside
  their one home. `HANDOFF.md` is relabelled a dated **ARCHIVE** — hand-syncing a second
  copy of the changelog is what rotted it — and future sessions append rather than edit.
  Guards, because a doc rule nothing enforces is the rot vector again: smoke **[39]** pins
  the browser-path contract (both CfT and pre-CfT layouts, the registry call, the
  existence-check, and both skip/fail contracts) and **reconciles the list against
  playwright-core's live `EXECUTABLE_PATHS`**, so a newly-added platform is caught rather
  than merely string-pinned; smoke **[40]** pins the doc shape. Both were negative-controlled
  — and the reconciliation caught itself passing **vacuously** on the first pass, matching
  the directory name inside its own explanatory comment, so it is now scoped to the
  `CHROMIUM_RELS` array (the same vacuous-assert defect v3.54 found in the "read-only by
  design" pin that passed while the route wrote).
  Not changed: the audit's §3 note that `computeFiveWhys`'s `opts.stale` is unreachable in
  production is **correct and already documented at the call site** as a mock/demo fallback —
  it is latent, not a defect, and removing a working fallback to satisfy an audit note would
  be the riskier edit.
  Tests: **948 smoke** (+22) + 169 render + 67 public-render + `audit:prod` clean — the full
  CI gate, run locally under `REQUIRE_BROWSER=1` for the first time since it was written.
- **FEAT-GLANCE (v3.61) — "First Glance": safe-area, and the density cut on BOTH surfaces.**
  Owner screenshot (iPhone, deployed v3.60): the wordmark rendered UNDER the Dynamic Island,
  and the first screen was word-dense for a new retail reader. Two root causes, one lesson.
  **Safe-area:** `index.html` has shipped `viewport-fit=cover` + `black-translucent` since v1 —
  the page is *deliberately* drawn behind the iOS status bar — but `env(safe-area-inset-*)`
  appeared **nowhere in the repo**, and the comment at `index.html:5` claimed safe-area handling
  that was never implemented (the label-outlives-its-data defect class again). The header now
  pads `calc(8px + env(safe-area-inset-top))`, the sticky Sections nav offsets below a fixed
  opaque **scrim** over the island strip (padding the nav instead would render a permanent
  inset-height band when it isn't stuck), and the root pads the landscape edges. `admin.html`
  had zero handling either and renders fullscreen inside the installed PWA shell: it gains
  `viewport-fit=cover`, `.wrap` top/bottom insets, a `.toast` that clears the home-indicator
  strip, and overlay padding on both edges. `env()` resolves to 0 everywhere else — Chromium
  can't simulate insets, so the proof is smoke pins + the owner's on-device check.
  **Density (dashboard):** the two largest always-expanded blocks were both v3.60 diagnostics —
  the six-card **Drivers matrix** and the 15-row **Data Health grid**. Both collapse behind the
  FEAT-321 `CollapsedGroup` (`chip={false}` — live evidence, not curated) with their `<section>`/
  h2 wrappers and summary lines outside, so nav anchors resolve and the v3.25 rule holds: the
  matrix's exclusions stay named in Signal Quality and as ⏱ chips on the band, and Data Health's
  ERROR/Retry row stays outside the collapse — an outage must not need a click to discover. The
  first-principles call: **the band's chip row IS the icon-first six-factor view**, so a second
  full-size rendering of the same six facts was duplication (the newcomer audit's point), not
  depth. The Signal Quality decode legend moved into the Data Health expander (explanation, not
  evidence); the 30Y tile note keeps its FACT (spread + INVERTED) and moves the 2007-reference
  prose to a tooltip. Owner calls, recorded: the Macro Regime grid stays visible (numbers are
  indicators, not prose), **full 5 Whys stays**, and **the WSB lingo/vibe stays wherever
  language is in play** (HODL primary, bull/bear vocabulary — personal tool, not commercial; the
  newcomer audit's relabel layer was declined).
  **Newcomer-audit structural fixes (vibe untouched):** (1) **the verdict sub can no longer name
  an excluded factor** — MIXED read "Cross-signals — watch VIX" while VIX sat two rows below
  marked stale-excluded, the hero explanation resting on evidence the model says it cannot use;
  `computeRegime` now re-derives the watch from the **nearest load-bearing flip** (`watchKey` on
  `REGIME_META`, one derivation — `flipConditions` already computes exactly that), falling back
  to "N of 6 inputs usable" when no single crossing flips it. (2) **The neutral vote is stated**
  — "2/4 bullish · 2 votes bull / 1 bear" left a vote unaccounted; now `N bull · N neutral · N
  bear — N of 6 usable`. (3) **Operator tooling off the public route** (the A4 pattern): the
  `⎘ TT` copy button and the `⚡ N FIRED/BLIND` alert badges gate on `!publicView` — BLIND reads
  as a system failure to a visitor who can't see the monitors it counts. (4) **What Changed
  names its device scope** — "baseline set — tracking starts today on this device" / "no
  material change since your previous visit on this device" — the localStorage limitation
  stated, not implied away.
  **Density (terminal, FEAT-TT-GLANCE):** post-v3.42 the remaining full-size prose concentrated
  in the SELL block. The ranking-basis sentences (repeated on EVERY row) are stated ONCE in a
  closed **`details.est-mini`** expander — "how this list is ranked" — together with the two
  unbounded "cannot rank" name lists, the options-only tail and the tax-lots disclaimer; rows
  keep chip-length basis tags (`%/yr` / `$ realisable`) so the mixed ordering still can't be
  mistaken for one key. The **unranked COUNT rides the closed summary** (silent truncation reads
  as full coverage) and the **session-vs-computed disagreement stays visible** as a chip-length
  line (`⚖ session: X first · computed: Y`) — it is signal, married-never-merged; the doctrine
  prose lives inside. est-mini, deliberately NEVER `drawer` — the phone harness counts open
  drawers (the est-run precedent). Red facts untouched: ⛔ TRIM rows, the cap-contradiction
  warning, do-not-trim flags. The BUY block's sentences are decision-critical vetoes and did not
  move. The board h2 became chip-length (`THE BOOK`); the coaching line moved to the HOW THIS
  BOARD WORKS aside.
  Tests: **967 smoke** (+19 over v3.60.1: safe-area literals on all three surfaces, the collapse structure,
  the excluded-aware sub RUN behaviorally through the real regime.js import on three fixtures,
  the neutral-vote line, the public gates, the est-mini/never-drawer pin) + **173 render** (+4:
  closed-SELL chip tags with the sentences absent, the visible unranked count, the disagreement
  chip, expander-class proof — then everything verbatim one tap deep) + **74 public-render**
  (+7: collapsed-by-default proofs for matrix and Data Health with red facts visible while
  closed, the legend's new home, the device-scope copy on both visits, and the TT/BLIND gate on
  the route pair).
- **FEAT-NEUTRAL + FEAT-WHY (v3.62) — the newcomer audit: a neutral factor was rendering as
  BEARISH, and the verdict was defensible but not legible.** A UX audit found the HODL call
  correct and the interface making the reader reconstruct it. Its central code claim was real,
  and worse than stated. **`regimeFactors()` predated `REGIME_BAND_TABLE` and was never
  migrated**, so every row carried a hand-written boolean `bull` that duplicated the table's
  BULL edge (`<-0.10`, `<18`, `>55`, `<=NFCI_LOOSE`) and **carried no BEAR edge at all** — the
  exact second-copy-of-a-threshold defect `regime.js`'s own header comment warns against.
  `RegimeBand`'s only input was those rows, so its chip branched `f.bull ? green ▲ : red ▼`
  with **red as the fallthrough**: F&G at 42 (a genuine `neutral`) rendered identically to CAPE
  at 40.91 (a genuine `bear`). Two things made it worse than cosmetic — **the component
  contradicted itself** (v3.61 had just changed the line directly above to print
  `N bull · N neutral · N bear`, so the hero *stated* "1 neutral" while painting it red), and
  **the same factor rendered correctly 500px lower** in the C3 Drivers matrix, which already
  read the true 4-state `evidenceSet.factors[].vote`. One page, two answers. A non-finite
  reading votes neutral by construction, so a `NaN` was rendering as a confident bearish chip.
  **Nothing tested it**: `regimeFactors` was imported into smoke as `regimeFactorRows` and
  never called — the v3.54 lesson ("the defect that passed every existing test") again.
  **Fixed at the root, not the render**: `regimeFactors()` now derives `vote` from
  `REGIME_BAND_TABLE` itself, `evidence.js` consumes that vote instead of re-deriving it (one
  call site for a threshold, not two), and a shared **`voteStyle()`** map is the ONE
  vote→appearance expression — the hero chips, the hero drawer and the Drivers matrix all
  resolve through it, so the two altitudes cannot drift apart again (the `ptModelRows`
  doctrine). `f.bull` is gone. EXCLUDED still wins over the band vote: a factor the model
  refuses to count must never also report a lean.
  **FEAT-WHY — the conclusion in words.** `postureSummary()` (pure, in `evidence.js`) renders
  *"Inflation and financial conditions support risk; valuation adds risk; sentiment is
  neutral; VIX and the 10-year yield are unavailable."* plus SUPPORTS / NEUTRAL / ADDS RISK /
  UNAVAILABLE buckets, under the existing hero. It is a **projection of the same factor rows**,
  so it cannot contradict the chips or the tally, and each factor's noun phrase (`plain`) lives
  on its band beside the rule it describes — no parallel copy-table to rot. Withheld postures
  render nothing (there is no "why" for a call that was not made). EXCLUDED is reported as
  UNAVAILABLE, never folded into NEUTRAL — "not counted" and "counted, no lean" are different
  facts, which is the whole lesson of this release.
  **Also:** the flip line states its assumption (*"if other signals stay put"* — `flipConditions`
  simulates exactly ONE crossing, so without it the line read as a forecast) · the SPY-derived
  mood badge and the six-factor hero **emit the same three words** from the shared
  `WEN_MOON_STATES` via unrelated inputs and could disagree on one screen, so the badge now
  names its scope (`TAPE`) — vibe untouched, ambiguity removed · strip items carry a **▪ marker
  when they actually vote**, derived from `FACTOR_FIELD`'s values rather than
  `REGIME_FACTOR_FIELDS` (which holds only the five whose field key equals their factor key —
  CAPE rides a separate alias, so the obvious array would have silently un-marked it) · a
  per-section "context only" label was rejected as FALSE, since the macro strip carries both
  kinds · the Drivers eyebrow reads **"Used in today's posture"** · the Sections nav gains an
  active state + `aria-current` (the six `h2`s are visually-hidden, so a jump landed with no
  orientation cue) · operator actions (TT readout, TERMINAL) consolidate behind a **⋯ OPS**
  disclosure while the **FIRED/BLIND badges stay outside it** (v3.25: a collapse never hides a
  red fact) · and a **type scale** (`fs-xs`…`fs-xl`) lands in `DT` with a targeted lift of the
  load-bearing text — provenance, factor chips, the verdict sub-line — which the audit measured
  at 7–9px, the honesty layer rendered at a size a phone reader has to work to read.
  **Owner calls, recorded (the audit's relabel layer stays DECLINED, as in v3.61):** HODL stays
  primary, DIAMOND HANDS stays, the fresh/cached/stale vocabulary stays, the full 5 Whys stays
  expanded, and the default route stays the operator view.
  Tests: **978 smoke** (+11, incl. `regimeFactors` executed for the first time — neutral zones,
  the NaN case, excluded-beats-vote, and that both altitudes resolve through the one map;
  negative-controlled by re-collapsing neutral into bear and by reverting the chip render) +
  **173 render** + **82 public-render** (+9: a neutral-fixture driven live asserting the F&G
  chip carries `•` and NOT `▼`, that a real bear still shows `▼`, that the printed tally and
  the count of neutral chips are the SAME number — derived on both sides, never hardcoded —
  and that the OPS menu actually opens to reveal TERMINAL rather than merely existing in DOM).
- **FEAT-TT-DECK (v3.62) — the terminal becomes a two-answer mobile decision surface.**
  `NEXT $ IN` and `FUND / TRIM` are labelled, keyboard-reachable tab panels on phones with
  horizontal scroll snap as an optional swipe shortcut; desktop keeps the stacked layout. Each
  phone panel owns one real 390×844 focus viewport and scrolls its own overflow, so the hidden
  funding list cannot lengthen the page. This deliberately does **not** call the second view
  “HOLD”: the engine computes funding/trim priority, not a hold recommendation, and changing
  the label would overstate the logic. Forced cap trims remain visible; the first five
  discretionary funding sources render by default and the ranked tail is counted in a closed
  expander. The existing rankings export was complete but effectively undiscoverable under
  `MENU → MANAGE`; `⇧ SHARE RANKS` is now a first-row action and preserves its iOS File/share,
  clipboard and download fallbacks. Its Markdown artifact still carries stance, master and
  category rankings, funding priority, unranked names, methodology, provenance and caveats.
  The render harness now actually opens its claimed **390×844** phone viewport (it previously
  used 390×2200, making any `svh` assertion false by construction). Combined v3.62 head:
  **985 smoke** (+7 from this feature) + **178 render** (+5 net from this feature, including
  the real swipe path, visible export action, panel height, capped funding queue, two-screen
  budget and zero mobile overflow).
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

npm test              # no-network smoke suite (needs Node ≥17)
npm run test:ui       # browser render test for admin.html (skips if no Chromium)
npm run test:public   # build + browser STATE test for the public dashboard (skips likewise)
npm run audit:prod    # production-scope dependency audit

# Cron Worker (separate deploy):
cd worker && npx wrangler deploy
npx wrangler secret put FRED_KEY
```

`npm test` runs the smoke suite. It loads the real `MOCK_DATA` out of `dashboard.jsx` to
catch `sources.js` ↔ dashboard drift, so it must stay green when you touch either file or
any `SOURCES` path. (This paragraph read "there is **no** `test` script" for many releases
after one was added — 2026-08-02 audit §5, the same defect class as the stale status header.
Assertion counts are deliberately not quoted here; the suite prints its own total.)

**CI** (`.github/workflows/test.yml`) runs all four on every push and pull request with
`REQUIRE_BROWSER=1`, so a missing browser fails the run rather than skipping the gate.

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
