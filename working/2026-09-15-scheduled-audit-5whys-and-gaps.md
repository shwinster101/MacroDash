# 2026-09-15 — scheduled audit: repo review, 5 Whys data audit, gap review

> Scheduled audit pass. Scope per the task: review all files (including `ticker-terminal/*.md`
> and `harness/`), audit `src/fiveWhys.js`'s data sourcing against the documented contract,
> re-confirm the problem statement/goal and key drivers, name what materially changed since the
> last pass (`working/2026-09-12-five-whys-audit-and-review.md`, baseline `e3bf36d`, v6.3.1),
> name what's missing, and recommend the highest-leverage short next move. `CLAUDE.md` is
> canonical; nothing here overrides it.

## 1. Problem statement / goal — unchanged, reaffirmed

MacroDash: one responsive, mobile-primary URL answering *"is it safe to be in the market?"*
from live macro + market + sentiment data, honest about live vs mock vs stale, with a
machine-readable `/readout.json` feed for the separate TT Ticker Terminal. Two engines,
married-never-merged: the public six-factor **backdrop** (`src/regime.js`) and Engine 0's
seven order-gating checks (`src/ttReadout.js`). Nothing in this pass found either job
statement drifted; v6.4.0–v6.5.2 are copy/feature additions, not scope changes.

## 2. 5 Whys data audit (`src/fiveWhys.js`) — PASS, no drift found

Re-traced all six factors end to end against `regime.js` → `sources.js` `SOURCES` →
`functions/api/snapshot.js` (unchanged from the 09-12 table — 10Y/FRED `DGS10`+UST failsafe,
VIX/FRED `VIXCLS`+CBOE failsafe, F&G/CNN scrape, CPI/FRED `CPIAUCNS` official NSA→YoY,
valuation/multpl.com Shiller CAPE scrape, NFCI/FRED `NFCI`). All six still match `CLAUDE.md`'s
documented source list verbatim; `computeFiveWhys` still takes `factors` from the *same*
canonical `evidenceSet.factors`/`dailyCall.factors` rows the hero, Drivers matrix and
`/readout.json` all read — no re-derivation, no drift risk.

**What changed since 09-12 (diffed `e3bf36d..HEAD -- src/fiveWhys.js`):** exactly the v6.4.0
"ONE CALL, TWO VOICES" copy retrofit — `plain`/Simple-mode vocabulary (`helping`/`hurting`/
`mixed`/`signals` in place of `bullish`/`bearish`/`neutral`/`voters`), routed through the new
`src/publicCopy.js` (`simpleCallLabel`, `SIMPLE_WITHHELD_LABEL`). Confirmed **presentation-only**:
the `factors`/`call`/`flips` inputs, the materiality gate (`isMacroMaterial`/`parseTopHeadlines`,
still imported from `src/headlines.js`, not duplicated), the A1 `liveBuild`-gated freshness rule,
and the CPI YoY derivation are byte-identical to what 09-12 audited. `src/evidence.js` and
`src/macroCall.js` picked up the same copy pass (`SIMPLE_VERDICTS` values relabeled, "voters" →
"signals" in the paste/share-card builders) — same conclusion, no data-sourcing change.
**No code or wiring defect found in the 5 Whys pipeline.**

## 3. What materially changed since the last audit (confirmed against `git log`)

Local checkout and `origin/main` both sit at `7ec0657` (v6.5.2), working tree clean. Four real
releases landed since `e3bf36d` (v6.3.1, the 09-12 baseline):

- **v6.4.0 "ONE CALL, TWO VOICES"** — the copy retrofit above: Simple gets plain Bullish/Hold/
  Bearish vocabulary, Degen keeps the moon voice; `src/publicCopy.js` is the new presentation
  boundary. No engine change.
- **v6.5.0 "STOCK SPOTLIGHT"** — a new educational widget (NBIS beside a weekly-rotating Mag
  Seven name), a genuinely new subsystem: `functions/lib/spotlight.js` (787 lines, pure core —
  rotation, YTD tracker, SEC period normalization, metrics, seven lessons), three new endpoints
  (`GET /api/stock-spotlight`, `POST /api/stock-spotlight/refresh`, `PUT
  /api/stock-spotlight/issuer`), a new 6pm-cron leg, and `src/sections/StockSpotlight.jsx`.
  **Shipped switched OFF** — `spotlightEnabled(env)` requires the literal string `"1"` on
  `SPOTLIGHT_ENABLED`; verified in source (`functions/api/stock-spotlight.js:25`), matching the
  changelog's "the flag is the switch, not a default."
- **v6.5.1 / v6.5.2** — two live-data fixes to the spotlight's SEC-period math (short names
  winning over legal names, a 6-K foreign-issuer period-derivation fix, then a half-year-only
  cash-flow-line merge fix) found while filing NBIS's own issuer record. Presentation/engine
  correctness only, same subsystem.

All four match their `CLAUDE.md` entries; nothing found "documented but not shipped."

## 4. Gate status — fully green, matches documented totals exactly

`node_modules` was absent in this session's container (as in every prior pass); ran
`npm install` (104 packages, no errors) so all four gates could run for real instead of
skipping.

- `npm test` (smoke): **2331 passed, 0 failed**
- `npm run test:ui` (render, real Chromium): **309 passed, 0 failed**
- `npm run test:public` (public-render, real Chromium): **316 passed, 0 failed**
- `npm run audit:prod`: **0 vulnerabilities**

All three totals match `CLAUDE.md`'s own v6.5.2 changelog entry ("Tests: 2331 smoke ... + 309
render + 316 public-render") **exactly** — no drift between the documented and measured state,
unlike the 09-12 pass which caught the FOMC-table CI gate red.

**FOMC calendar tripwire: healthy.** `FOMC_MEETINGS` in `src/sources.js` now runs through
`2027-12-08` (the 09-12 pass's fix), giving well over 90 days of runway from today
(2026-09-15) — no repeat of the 09-10 regression.

## 5. What's missing / gaps found

1. **`HARNESS.md` still does not exist anywhere in this repo, and its source branch is now
   gone.** Third consecutive pass to find this (09-01 through 09-12 all flagged it).
   `harness/H1-tt-deck-forced-count-2026-08-03.md` still calls `HARNESS.md` "canonical for how
   a change gets made," citing branch `claude/harness-model-assignment-d6xhlb` — that branch no
   longer exists on `origin` (checked `git branch -r`; not present). So the one process
   document a harness-style pass is supposed to check itself against is not merely unmerged, it
   is now **unreachable from this repository entirely** — only the one self-disclaiming dated
   snapshot in `harness/` survives. Not urgent (nothing depends on it functioning), but stale
   enough that it should either be rebuilt on `main` or the reference to it should be retired.
2. **Stock Spotlight (v6.5.x) is fully built, tested, documented, and sitting on two owner
   decisions before it can go live** — not a code gap, a decision gap:
   (a) approval for public display of market caps/prices/derived total returns (owner call per
   the plan's §5), (b) the `TIINGO_KEY` + `SPOTLIGHT_ENABLED` Cloudflare Pages secrets, neither
   set yet (per `docs/plans/stock-spotlight-activation.md`, confirmed against the flag's
   `"1"`-only check in source). This is new since 09-12 — the feature didn't exist yet then.
3. **~49 remote branches**, most of them long-stale forks (sampled `tt-engine`, 98 commits
   behind `main`, last touched 2026-08-02; `v3.0-trust-tokenomics`, 98 behind, last touched
   2026-06-16) alongside two that are near-current but already fully merged content
   (`feat/stock-spotlight`, `fix/spotlight-half-observed` — both superseded by `main`,
   confirmed via `git rev-list`). Pure clutter; costs review time each pass, no missing work
   found inside any of them.
4. **The 2026-09-12 CRDO note (`working/2026-09-12-crdo-goldman-transcript.md`) flagged a live
   operational staleness in the TT terminal that is outside this session's reach**: `/api/allocation`
   reads WAIT because the board circuit was "ARMED asserted 16d ago (limit 7d)" and the
   positions/account records were 19 days old — needs an owner re-assert in ◧ SESSION and a
   Robinhood position resync (this session has no broker credentials). Not re-verified live
   here (would require the PIN-gated terminal and KV state this environment cannot reach); named
   so it isn't lost, not re-diagnosed.

## 6. Highest-leverage next move

**Decide on Stock Spotlight activation.** It is the one item on this list that is 100% code-
complete, gate-verified (2331/309/316 all green, including the full v6.5 spotlight section),
and blocked on nothing but two owner actions with no engineering work behind them: confirm the
public-display data-rights call, then set `TIINGO_KEY` + `SPOTLIGHT_ENABLED` on Cloudflare
Pages. Everything else on this list (`HARNESS.md`, stale branches, the CRDO circuit re-sync) is
either low-cost cleanup or requires access this session doesn't have — this is the one where a
single owner decision converts finished, tested work into something live.
