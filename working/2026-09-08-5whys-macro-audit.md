# 2026-09-08 — 5 Whys data audit + macro-dashboard materiality review

Scheduled autonomous pass. Scope per prompt: review the repo (incl. the ticker-terminal
harness docs), audit the 5 Whys and cross-check its data sourcing against requirements,
re-read the problem statement/goal, and audit what has materially changed since the last
recorded state — then name what's missing and the highest-leverage next move.

## What was reviewed

- `CLAUDE.md` (the living brief — full changelog through v6.3.0), `AGENTS.md`,
  `REQUIREMENTS_v2.6.md` (marked SHIPPED & SUPERSEDED — historical only), `ROADMAP_v2.5_v3.0.md`
  (same — v2.5/v3.0 both landed long ago).
- `ticker-terminal/*.md` — `README.md` (current contract), `TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`,
  `V5_SYSTEM_AUDIT_2026-08-23.md`, `VALUE_PROPOSITION_AUDIT_2026-07-31.md`, and the three lens
  harnesses (`AI_INFRASTRUCTURE_HARNESS_V2.md`, `PHYSICAL_AI_INVESTMENT_HARNESS.md`,
  `QUALITY_COMPOUNDER_HARNESS.md` — methodology references only, per README).
- `harness/H1-tt-deck-forced-count-2026-08-03.md` (dated working note, folded into shipped work).
- Source: `src/fiveWhys.js`, `src/macroCall.js`, `src/regime.js`, `src/evidence.js`,
  `src/sources.js`, `functions/api/snapshot.js`, `src/dashboard.jsx` (call site),
  `src/sections/FiveWhys.jsx`.
- Live checks: `npm test` (smoke), `npm run audit:prod`, git state vs `origin/main`, and
  GitHub Actions history for the last 5 pushes to `main`.

## 5 Whys — data-sourcing audit

`computeFiveWhys` (src/fiveWhys.js) is called once, from `dashboard.jsx:670`, with
`{call: dailyCall, factors: evidenceSet.factors, flips: evidenceSet.flips?.flips,
snapshotAsOf: asOf, headlineFresh, callFrozen}`. `dailyCall` is `buildMacroCall()`'s
`md-call-v1` object (`src/macroCall.js`), which itself is a thin projection of
`buildEvidenceSet()` (`src/evidence.js`) over `REGIME_BAND_TABLE` (`src/regime.js`). This
is a **single derivation reused at every altitude** (hero, 5 Whys, `/readout.json`
paste block, share card) — there is no second copy of the vote or the factor list for the
5 Whys to disagree with, which is the property CLAUDE.md's v5.4.0/v3.62/v4.0.3 entries
require.

Cross-checked each of the six canonical voters' data path end-to-end
(`sources.js` field → `functions/api/snapshot.js` fetch → `REGIME_BAND_TABLE` key):

| Factor (WHY #2/#3 key) | `SOURCES` field | Upstream | Matches CLAUDE.md? |
|---|---|---|---|
| 10-year yield | `tenYearM1` (derived from `tenYear`) | FRED `DGS10` | ✅ |
| VIX | `vix` | FRED `VIXCLS` (+ CBOE failsafe, v5.1.0) | ✅ |
| Fear & Greed | `fearGreed` | CNN F&G scrape (`fetchFearGreed`) | ✅ |
| CPI trend | `cpiHeadline` + `cpiTrend` | FRED `CPIAUCNS` (NSA headline) | ✅ |
| Valuation (CAPE) | `shillerPe` | multpl.com scrape (`fetchShiller`) | ✅ |
| NFCI | `nfci` | FRED `NFCI` | ✅ |

All six resolve exactly as documented in CLAUDE.md's "Data sources" section and the
v3.43/v5.97.1/v6.0.0 entries (CPI+NFCI per-field last-good, v5.1.0's VIX failsafe). No
factor is silently reading from a different field than the one the vote table uses.

Honesty contract, spot-checked against the code (not just the comments):
- **Mock never votes**: `evidenceFromLive` only marks a field LIVE/CACHED when every value
  its band needs is finite (`requirements` object) — a field failing that check simply has
  no provenance entry, so `buildEvidenceSet` excludes it. Confirmed structurally, matches
  the FEAT-QUORUM (v3.54) "mock must never vote" invariant.
- **Headlines are context-only**: WHY #4's `context` clause is gated by
  `isMacroMaterial(hd.text)` (imported from `src/headlines.js`, the v6.1.0 ranked-headline
  table) and `headlineFresh`; it never enters `factors`/`counts`, so it structurally cannot
  cast a vote. Matches the v3.51/v6.1.0 doctrine.
- **Exclusions are named, never silently dropped**: WHY #4 lists `excluded.map(f => f.label
  || f.key)`, sourced from the same `factors` array the hero renders — one list, two
  renderings, cannot drift (the v3.62 lesson this file's history is built around).
- **A1 freshness gate (v3.58/v3.98.1)**: `dashboard.jsx:669` gates `headlineFresh` on
  `liveBuild`, not `anyLive` — confirmed the fix for the "mock narrates as today's tape
  under a withheld verdict" defect is still in place (the comment at that line documents
  exactly the failure mode CLAUDE.md's A1 entry describes, and the code matches it).

**Finding: no defect.** The 5 Whys' data gathering is wired correctly per the documented
requirements — every voter reads the field the regime engine votes on, no mock leakage,
headlines can't vote, exclusions are honest. `npm test` (2258 assertions, section [79]
included) passes clean, matching CLAUDE.md's stated v6.3.0 total exactly — no drift between
the committed code and the documented contract.

## Problem statement & goal — unchanged, still coherent

Per `CLAUDE.md` line 1: *"Macro-intelligence dashboard... answers 'is it safe to be in the
market?' from live macro + market + sentiment data."* The six-factor backdrop
(10Y · VIX · F&G · CPI · CAPE · NFCI) is the mechanism; the TT Ticker Terminal
(`/admin.html`) is a separate, PIN-gated operator layer that consumes the same macro
permission (`/readout.json`) but answers a different question ("where does the next
dollar go"). `ticker-terminal/README.md` states this boundary cleanly and it matches the
code: the six-factor **public backdrop** (`regime.js`) and Engine 0's **order-gating
checks** (`ttReadout.js`) remain two engines, married never merged, exactly as documented.
No scope drift found.

## What materially changed (since the last recorded state)

`origin/main` and the working branch are at the same commit (`d4a1cca`, v6.3.0) — no
unmerged work, no divergence. Four releases have landed since the last plausible prior
review point (v6.0.0):

1. **v6.0.2** — public-view UX pass (Simple/Power clarity, footer under one collapsed
   group, strip vote-marker color).
2. **v6.1.0** — ranked headlines (`src/headlines.js`): the allowlist-then-rank engine
   feeding WHY #4/#5's headline context, replacing "first item of one feed."
3. **v6.2.0** — THE CLOSE READ: an unscored 6pm ET read (`src/closeRead.js`), a 5th Worker
   cron, `/history.json` join — deliberately outside `/readout.json` and outside the scored
   10am call.
4. **v6.3.0** — EIGHT SHEETS: every macro-strip tile (including the 5 Whys' six voters)
   now opens a 3-bullet explainer sheet on tap, closing the v3.73 "hover-only explanations
   unreachable on touch" finding.

All four are merged into `main`, all four commits carry successful `test` workflow runs
**except one** (below).

## Gaps / what's missing

1. **CI dependency-audit gate is flaky against a retiring npm endpoint (unaddressed).**
   The `test` workflow run for the v6.2.0 merge (`f31dee5`, run #147, 2026-09-04) is
   **red on `main`** — smoke (2240), the admin-terminal browser suite, and the
   public-dashboard browser suite (269) all passed; only the final `npm run audit:prod`
   step failed:
   ```
   npm notice This endpoint is being retired. Use the bulk advisory endpoint instead.
   npm warn audit 400 Bad Request - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick
   { statusCode: 400, error: 'Bad Request', message: 'Invalid package tree, run npm install to rebuild your package-lock.json' }
   ```
   The very next merge (v6.3.0, run #149, 2026-09-05) shows the identical `npm audit
   --omit=dev` command completing in <1 second with no findings — so this is not a real
   vulnerability and not a lockfile problem; it's npm's legacy "quick audit" endpoint
   intermittently rejecting requests as it's phased out in favor of the bulk advisory
   endpoint. This is exactly the class of "CI gate red for a reason that has nothing to do
   with the code" this project's own doctrine (v3.60.1: *"a gate that failed on a browser
   that was there"*) treats as a root-cause-and-fix, not a shrug — and it currently sits
   uninvestigated in the Actions history. Left as-is, it will keep intermittently blocking
   `npm run gates` locally and the CI gate on every future PR for a reason the audit
   convention exists to name and fix.
2. **Worker deploy for the 5th cron is an owner action, and its completion is unverifiable
   from this repo.** `worker/wrangler.toml` correctly carries all 5 cron triggers including
   the v6.2.0 close-read cron (`"0 22 * * MON-FRI"`), but CLAUDE.md's v6.2.0 entry states
   the trigger only fires after `cd worker && npx wrangler deploy` — a manual, out-of-repo
   step. Nothing in the repo can confirm whether that deploy has happened; if not, the 6pm
   close read is silently inert (the code path is correct, but never invoked on schedule).
3. **Ticker-terminal V5 audit (2026-08-23) item #6, "Retail legibility pass," does not
   appear to have shipped.** CLAUDE.md's changelog shows items #1 (§14.8 governor flip,
   v5.0.0), #3–4 (freshness unification + drift lints, v5.0.0/v4.3.0), and #7 (FINANCIALS
   P3 mode, v5.0.0) all landed; no entry names "one plain sentence per pillar" shipping.
   Low urgency (it's an operator-terminal legibility item, not a correctness gap) but
   worth confirming it wasn't dropped rather than deferred.
4. **NVDA falsifier hinge-count owner deadline has passed with no confirming entry.** The
   2026-08-22 session log records NVDA registered pre-8/26 with **9 hinges against the
   P4 8-cap**, "owner to DROP one before the print" — today is 2026-09-08, well past that
   date, and no later CLAUDE.md entry records the resolution. This lives in production KV
   (not this repo), so it can't be verified here either way; flagged so it isn't silently
   assumed resolved.
5. **Ticker-terminal §4 X3 (11 no-payload names)** — RGTI, QQQI, DAC, VRT, ASML, DXYZ, TER,
   KRKNF, MCHP, AUR, AVGO still need owner model/capture work before any score-engine
   surface can say anything about them. Named in the audit as explicitly out of assistant
   scope; still open per the same reasoning.

No code defects were found in the dashboard or the 5 Whys engine itself — the gaps above
are process/infrastructure and a small number of unconfirmed owner-action items, not
regressions.

## Highest-leverage next move

**Fix the `audit:prod` CI step so it stops depending on npm's retiring quick-audit
endpoint.** It is the one finding here that is (a) concretely reproducible from this
repo's own CI history, (b) certain to recur and get worse as npm finishes deprecating the
endpoint (today it's an intermittent 400; it may become a hard failure), and (c) cheap to
fix relative to everything else on this list — a config/tooling change, not a design
decision. Concretely: switch `npm audit --omit=dev` to the bulk advisory endpoint npm's
own deprecation notice points at (newer `npm audit` versions do this automatically; the
CI runner may need an `npm install -g npm@latest` step, or pin an audit tool that uses the
bulk endpoint), and add one retry so a genuine transient registry hiccup doesn't fail the
whole gate. This directly protects the thing CLAUDE.md's own v3.60.1 entry says matters
most: *"a gate that failed on a browser that was there"* — here, a gate failing on a
dependency tree that was fine — left unfixed erodes exactly the CI discipline this project
has spent a dozen releases building.

Second-highest-leverage, if the above is quick: confirm the two outstanding owner actions
(Worker `wrangler deploy` for the 5th cron; the NVDA hinge-count drop) in production,
since both are silent-failure modes by design (a missed Worker deploy or an over-cap
falsifier set produces no error anywhere in this repo — only an absent 6pm read or a
frozen NVDA score card in the live terminal).
