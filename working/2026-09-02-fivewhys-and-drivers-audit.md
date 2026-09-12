# 2026-09-02 — 5 Whys data-source audit, key-drivers review, next-move scan

Scheduled/automated audit pass. No code changed. Scope: (1) cross-check `computeFiveWhys`'s
data sourcing against its documented requirements, (2) re-read the problem statement and key
drivers, (3) confirm what materially changed most recently, (4) spot-check the live production
site, (5) name the highest-leverage short next move.

## 1. Five Whys — structure and data-source cross-check

`src/fiveWhys.js`'s own header claims the v5.4.0 "accountability repair" structure (call
arithmetic → drivers → transmission mechanism → evidence quality → nearest load-bearing
change). Read the full file and its call site (`src/dashboard.jsx:657`) and confirmed both
match CLAUDE.md's v5.4.0 entry and every later patch layered on it:

- **WHY #1** (coverage/majority) reads `call.counts` (from `md-call-v1`, built in
  `src/macroCall.js`) — no raw mock field is narrated here (the A1 fix, v3.58/v3.98.1).
- **WHY #2/#3** (drivers/transmission) read only `evidenceSet.factors` — the SAME six-factor
  rows the hero/strip render, filtered to `!excluded`. `WHY_IT_MATTERS` covers exactly the six
  `REGIME_BAND_TABLE` voters (tenYear, vix, fearGreed, cpiHeadline, valuation, nfci) — no
  orphaned or missing key.
- **WHY #4** (evidence quality) gates the headline through `isMacroMaterial()` (a curated
  allowlist, one-way withhold — v3.51 FEAT-WHY3-MATERIAL) AND a freshness bit
  (`opts.headlineFresh`, wired from `freshSet` in dashboard.jsx, itself gated on `liveBuild`
  per the v3.58 A1 fix) before ever quoting a headline as context.
- **WHY #5** (what changes it) reads `opts.flips[0]` from `evidenceSet.flips.flips` —
  `flipConditions()` in `regime.js`, the same table the hero's flip chip renders (`FEAT-FLIP`).
- `callFrozen` (8/28 clock-matrix A13) correctly swaps the session-clock prefix for
  `10am call —` when narrating the frozen artifact, verified present in both the file and its
  dashboard.jsx call site.

**Underlying data-source requirement check** (CLAUDE.md v5.4.0: *"CPI now uses the official BLS
not-seasonally-adjusted FRED series (CPIAUCNS / CPILFENS)"*): confirmed live in
`functions/api/snapshot.js:507-508` (`cpiHeadline: "CPIAUCNS"`, `cpiCore: "CPILFENS"`), and
smoke section `[73]` pins `every active pull uses official NSA CPIAUCNS/CPILFENS, never the SA
pair` — **PASS**.

**Full gate run**: `npm test` → **2168 passed, 0 failed**, matching CLAUDE.md's own claimed
total for the v6.0.0 head exactly. No drift between the documented state and the actual
tree. The presentation-boundary pin (smoke ~line 6069-6078) also confirmed: `FiveWhys.jsx`
re-imports `computeFiveWhys` rather than re-implementing any of its logic — no second
derivation to drift.

**Verdict: the 5 Whys' data sourcing is correct and matches its documented requirements.**
Nothing in this file needs a fix.

## 2. Problem statement, goal, key drivers (re-read, not changed)

From `CLAUDE.md`'s standing header: *one responsive URL, mobile-primary, answering "is it safe
to be in the market?" from live macro + market + sentiment data.* Two engines, married never
merged:

- **Public 6-factor backdrop** (`src/regime.js` / `src/macroCall.js`) — 10Y · VIX · F&G · CPI ·
  CAPE · NFCI — the hero's call and the frozen 10am `md-call-v1`.
- **Engine 0** (`src/ttReadout.js`, `/readout.json`) — 7 order-gating checks (as of v5.97.0's
  FEAT-30Y-CHECK: spy_vs_200d, vix, fear_greed, qqq_spy_rs, us10y_trend, fed_next_meeting,
  us30y_curve) — the TT terminal's permission axis.

Neither engine's bands, quorum rule, or vote count changed in this pass. `REQUIREMENTS_v2.6.md`
and `ROADMAP_v2.5_v3.0.md` are both explicitly marked SHIPPED & SUPERSEDED — CLAUDE.md is the
sole current brief, confirmed by reading both in full.

## 3. What materially changed most recently

**v6.0.0 "CLOSE THE LOOP"** (`2cc2e46`, 2026-09-01) is the tip of `main` and this branch. Four
tickets, all confirmed present in source (not just claimed in prose):

- **T1** — `macroGate()` rebuilt on the server ladder's own primitives; `stance().k` alias
  pinned ABSENT. *(not independently re-verified line-by-line this pass; smoke covers it and
  passed.)*
- **T2** — `putWithRetry` under the 10am freeze + `pulse:cron:lastwarm` on every run —
  confirmed in `worker/cron.js` diff and smoke `[73]` T2 sections, all green.
- **T3** — CPI/NFCI per-field last-good, split into 4 groups (`cpi`, `cpi_core`, `nfci`,
  `nfci_lev`) so a live voter never blocks a dead sibling's restore. Confirmed present at
  `functions/api/snapshot.js:1185-1219` (`FIELD_LG_GROUPS`, `applyFieldLastGood`), called at
  line 351 in the main build path (applies under both `all` and `critical` scope, since
  `fetchFred` is not scope-gated). See §4 for a live observation on this.
- **T4** — alert persistence overlay (`md:alerts:v1`) + the two-count BLIND/FIRED badge. Not
  independently re-verified visually this pass (no live browser available here); smoke covers
  it and passed.

No commits landed after `2cc2e46`; this session made none either.

## 4. Live production spot-check (macrodash.pages.dev)

Fetched directly (curl, not the summarizing WebFetch tool, for the JSON checks):

- **`/readout.json` (now):** `TAILWIND · HIGH · FULL · OK`, **7 of 7 checks CURRENT**,
  including `fed_next_meeting` (Kalshi-sourced) reading a real value with a reason string —
  **Kalshi is live in production right now.** This resolves a blocker repeated across many
  releases (v3.99 → v5.10.0 → v5.97.1/.2 → the 8/31 working files all said "FULL is
  unreachable until KALSHI_KEY_ID/KALSHI_PRIVATE_KEY are set"). Worth noting as good news, not
  an action item — the owner evidently set the secrets since the last audit pass.
- **`/api/snapshot` (now):** `cpiHeadline: 3.5` (asOf `2026-07-01`), `nfci: -0.566` (asOf
  `2026-08-21`) — both present and live/cached, `cached:true`.
- **`/history.json` (raw):** the **2026-09-01 frozen call** (Labor Day) reads `MEDIUM · 
  RESTRICTED · PARTIAL DATA`, with `cpiHeadline` factor `mode:"MOCK", as_of:null,
  reason:"no live feed right now"` — i.e. the T3 last-good restore did **not** fire for CPI on
  its very first live day. `nfci` on the same record was fine (`LIVE`, `-0.57`, `as_of
  2026-08-21`), consistent with T3's own design (separate per-field groups, so a dead sibling
  doesn't block a live one).

  **This is very likely a one-time cold start, not a live defect.** `FIELD_LG_GROUPS`'s
  `cpi`/`cpi_core`/`nfci_lev` keys are new in this exact commit (the pre-v6.0.0 version only
  covered the four Engine-0 criticals). The restore path only ever serves a PRIOR successful
  write under the new KV key (`applyFieldLastGood`'s "success path" comment: *"persist the
  group... for the next outage"*). If the very first `cpiHeadline` fetch after deploy (on
  Labor Day, a low-traffic day) failed before any successful write had seeded `LG_PREFIX+"cpi"`,
  the fallback correctly had nothing to serve and fell to bare MOCK — which is exactly what
  the code does today, on purpose, for a genuinely-empty cache. The net is now warm (today's
  `/api/snapshot` shows a good, cached CPI value), so the real test is the **next** time CPI's
  live fetch fails — that is the first case that will tell us whether T3 actually closes the
  hole it was built for. Flagging as a watch item, not a bug: nothing here contradicts the
  code or the smoke coverage, and re-deriving MOCK-with-no-fallback on a cold cache is the
  documented, tested behavior, not a gap in it.

## 5. What's missing / highest-leverage short next move

Everything structural is healthy: 2168/2168 smoke green, five whys sourced correctly, both
engines married-never-merged as designed, production reads FULL/HIGH with Kalshi live. The
`ticker-terminal/` and `harness/` docs were read; `ticker-terminal/README.md`'s current
contract matches what CLAUDE.md's changelog describes (SEND IT/HODL/TOUCH GRASS gate, the
owner input boundary, the TT-run response contract). `harness/H1-tt-deck-forced-count-*.md` is
a single dated, explicitly-non-current planning artifact from 2026-08-03 referencing a
`HARNESS.md` that does not exist anywhere in this repo — an orphaned one-off experiment (no
H2–H5 ever landed), worth a five-minute cleanup someday but not high leverage.

**Recommended next move: finish the span→button conversion the project has already scoped
and repeatedly deferred.** v3.42 (FEAT-TT-READABLE) established the pattern — replace
`<span onclick="openCard(...)">`-style pseudo-links with real `<button type=button>` elements
for keyboard/a11y reachability — and applied it to most of `public/admin.html`. v5.97.4's own
audit named *"five surviving span-onclick `openCard` sites in DESK strips — keyboard-
unreachable — the v3.42 conversion never reached that altitude"* and filed it rather than
fixing it; v6.0.0's release notes list it again under "Out of v6, by owner ruling... filed, not
built." A fresh grep today (`grep -n "onclick=\"openCard" public/admin.html`) finds **9
surviving `<span>`-based sites** (lines ~1356, 1388, 1441×2, 1892, 5141, 5382, 5488, 5666,
6235) against the ones already converted to real `<button class="fdr-row">` elements (lines
5735, 6129, 6220) — so the surface has grown since it was last measured, not shrunk.

This is a good candidate specifically because: it is small (≈9 sites, one established
pattern), low-risk (pure markup/JS conversion, no logic/threshold/vote change — the exact
"presentation only" category this project ships safely and often), has direct precedent to
copy from in the same file, and has been named twice across two releases without being picked
up. A short implementation pass would: convert each surviving span to `<button type=button
class="linklike">` (or `pick`/`sym`'s existing classes restyled as buttons, matching the
v3.42/v5735 pattern), keep the `onclick`/`title` content unchanged, add the 40px/44px tap
targets already established for this pattern, and extend `test/render.mjs` with a real
keyboard-Enter proof for at least one of the newly-converted sites (mirroring the existing
"a real keypress opens the card" pins from v3.42 slice 2/3). Estimated size: one focused
session, comparable to the slice-sized passes this project already does routinely.

## Completed

- Cross-checked `computeFiveWhys`'s structure and data sourcing against CLAUDE.md's v5.4.0
  requirements and every later patch; ran the full smoke suite (2168/0) to confirm no drift.
- Verified v6.0.0's four tickets against source and spot-checked the live production site
  (`/readout.json`, `/api/snapshot`, `/history.json`), surfacing one benign cold-start
  observation on the new T3 CPI last-good path and confirming Kalshi is now live in prod.

## Highest-leverage question

Was `cd worker && npx wrangler deploy` run for the v6.0.0 Worker changes (`cron.js`), or did
only the Pages side auto-deploy? (Cloudflare Pages auto-deploys on push; the cron Worker does
not — CLAUDE.md documents this as a separate manual step.) The 10am captures for both 8/31 and
9/1 landed on schedule and match expected T2 heartbeat shape, which suggests it did — but this
is the one thing this audit could not verify from outside Cloudflare's dashboard.

## Highest-leverage next move

Convert the 9 surviving `<span onclick="openCard(...)">` sites in `public/admin.html` to real
keyboard-reachable buttons, per the plan in §5 — small, precedented, twice-filed, never built.
