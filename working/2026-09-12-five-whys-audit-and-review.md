# 2026-09-12 — repo-wide review, 5 Whys data audit, and the next move

> Scheduled audit pass. Scope per the task: read every doc in the repo (including
> `harness/` and `ticker-terminal/*.md`), audit `src/fiveWhys.js`'s data sourcing against
> the documented contract, re-confirm the problem statement/goal, name what materially
> changed, name what's missing, and recommend the highest-leverage short next move.
> `CLAUDE.md` is canonical; nothing here overrides it.

## What was read

`CLAUDE.md` (full changelog, already in context), `README.md`, `AGENTS.md`,
`REQUIREMENTS_v2.6.md` (marked SHIPPED & SUPERSEDED — historical only),
`ROADMAP_v2.5_v3.0.md` (same era, superseded), `harness/H1-tt-deck-forced-count-2026-08-03.md`,
`ticker-terminal/README.md`, plus source: `src/fiveWhys.js`, `src/regime.js`,
`src/evidence.js` (call sites), `src/sources.js`, `src/headlines.js` (referenced),
`src/dashboard.jsx` (the `computeFiveWhys` call site), `functions/api/snapshot.js`
(the FRED/CNN/multpl fetch layer), and `test/smoke.mjs` (ran it — see below).

## 1. Problem statement / goal — unchanged, reaffirmed

MacroDash: one responsive, mobile-primary URL answering *"is it safe to be in the
market?"* from live macro + market + sentiment data, honest about what's live vs mock vs
stale, with a machine-readable `/readout.json` order-gating feed for the separate TT
Ticker Terminal. Two engines, deliberately married-never-merged: the public six-factor
**backdrop** (`src/regime.js`) and Engine 0's seven order-gating checks
(`src/ttReadout.js`). Nothing in this pass found either engine's job statement drifted.

## 2. 5 Whys data audit (`src/fiveWhys.js`) — PASS, no drift found

Traced every factor `computeFiveWhys` narrates back to its live upstream, end to end:

| Factor | `regime.js` read path | `sources.js` SOURCES path | Live upstream (`functions/api/snapshot.js`) |
|---|---|---|---|
| 10Y | `crossAsset.treasury10y.m1` | `tenYearM1` → `crossAsset.treasury10y.m1` | FRED `DGS10` (+ UST par-yield failsafe) |
| VIX | `marketPulse.vix.current` | `vix` → `marketPulse.vix.current` | FRED `VIXCLS` (+ CBOE failsafe) |
| Fear & Greed | `marketPulse.fearGreed.score` | `fearGreed` → same path | CNN Business F&G scrape |
| CPI | `macro.cpi.trend` (6-pt YoY trend) | `cpiTrend` → `macro.cpi.trend`, `DERIVED_OF cpiHeadline` | FRED `CPIAUCNS` (official BLS NSA, index→YoY derived in `snapshot.js`) |
| Valuation | `macro.shillerPe` | `shillerPe` → `macro.shillerPe.current` | multpl.com Shiller CAPE scrape |
| NFCI | `macro.nfci.current` | `nfci` → same path | FRED `NFCI` |

All six match `CLAUDE.md`'s documented source list verbatim (no undocumented substitution,
no stale mapping). Findings:

- **Single derivation, no drift risk.** `computeFiveWhys` takes `factors` from
  `evidenceSet.factors` / `dailyCall.factors` — the *same* canonical rows the hero verdict,
  the Drivers matrix and `/readout.json`'s public projection all read. It does not
  re-derive votes or exclusions itself, so it structurally cannot disagree with the verdict
  it explains (the project's own "one computation, many altitudes" rule, confirmed intact).
- **Headline materiality (WHY #4) is correctly wired to v6.1.0.** `isMacroMaterial` /
  `parseTopHeadlines` are imported from `src/headlines.js` (the allowlist's current home
  since the RANKED HEADLINES release) and re-exported, not duplicated. The one-way gate
  (freshness-fail or non-material → withhold, never guess) is intact, and items 2-3 are
  re-checked material independently of rank-1, per the documented rule.
- **The A1 freshness fix is intact.** `FW_FIELDS=["marketHeadline"]` is gated on
  `liveBuild` (not `anyLive`), so a live build stuck in LOADING/ERROR narrates an empty
  freshness set rather than quietly treating mock content as live — this was the exact
  defect the v3.58 audit found and it has not regressed.
- **CPI's YoY derivation is correct at the source.** `snapshot.js` converts the raw
  `CPIAUCNS` index to YoY% (`(latest/12mo-prior − 1)×100`) and builds a 6-point trend
  before it ever reaches `regime.js`'s trend-shape vote — matches the v5.4.0 "official BLS
  series" fix, not the old CPIAUCSL/CPILFESL derived-SA path.

**No code or wiring defect found in the 5 Whys pipeline itself.**

## 3. What materially changed recently (confirmed against `git log origin/main`)

Local checkout and `origin/main` are identical at `d4a1cca` (`package.json` 6.3.0),
working tree clean. Last five real releases, all present and consistent with `CLAUDE.md`:

- **v6.3.0 EIGHT SHEETS** — every macro-strip tile (not just the 6 voters) now opens an
  explainer sheet; band tiles reuse the band's own explainer object by identity, the 3
  context tiles (SPY*/QQQ/FED) get a new `CONTEXT_EXPLAIN` table via `src/stripExplain.js`.
- **v6.2.0 THE CLOSE READ** — an unscored 6pm ET second read beside the frozen 10am call.
- **v6.1.0 RANKED HEADLINES** — `src/headlines.js`, allowlist-then-rank, $0/no LLM (this is
  what the 5 Whys' WHY #4 now depends on).
- **v6.0.2 / v6.0.0** — public-view UX pass (footer under a dropdown, strip vote-colour
  fix) and the macroGate/6pm-close/Monday-feed-hole release.

All four match their changelog entries; nothing found "documented but not shipped" in this
range.

## 4. What's missing / gaps found

1. **LIVE FINDING — the FOMC calendar's expiry tripwire was firing.** `npm test` (the
   no-network smoke gate) came back **2257 passed, 1 FAILED**:
   `fomc: EXPIRY TRIPWIRE — the calendar has >90 days of runway (extend FOMC_MEETINGS if RED)`.
   `FOMC_MEETINGS` in `src/sources.js` ended at `2026-12-09`; today (2026-09-12) that's ~88
   days of runway, under the 90-day guard the v3.99.0 release built specifically to prevent
   this table rotting silently again. This is the CI gate (`npm run gates`) failing on
   `main` **right now** for anyone who runs it — not cosmetic, since `fed_next_meeting`
   feeds an `/readout.json` Engine-0 health input as well as the dashboard's FOMC
   countdown. The 90-day threshold was crossed only ~2 days ago (Dec 9 − 90d = Sep 10), so
   this is a fresh regression, not a long-standing miss.
   **Fixed in this pass** (see Outcomes below) — flagged asserted-until-confirmed, per the
   file's own established convention, since `federalreserve.gov` is blocked from this
   build environment's egress proxy (the same standing limitation already documented for
   FRED/UST/CBOE/Kalshi) and the dates could only be cross-checked via web search, not
   fetched from the primary source.
2. **`HARNESS.md` — referenced as canonical, absent from `main`.** `harness/H1-tt-deck-forced-count-2026-08-03.md`
   calls `HARNESS.md` "canonical for how a change gets made," sourced from commit `b4c730c`
   on branch `claude/harness-model-assignment-d6xhlb`. That branch was last touched
   2026-08-02 and caps out at v3.62.1-era work — over a month behind `main`'s current
   v6.3.0, and the file never landed on `main` at all. Any harness-style pass (including
   this one) currently has no live process document to check itself against; the one
   surviving artifact in `harness/` is a single dated snapshot that says so of itself
   ("NOT current state... this one is a snapshot and is not maintained").
3. **~30 stale remote branches**, mostly pre-v6.0.0 forks already fully superseded by
   `main` (sampled 7; each capped at v6.0.2 or earlier with zero unique commits ahead of
   `main`). Pure clutter, no missing work found inside them — but they cost real time to
   distinguish from live work during a review like this one, and a fresh session doing the
   same audit will pay that cost again.
4. **`REQUIREMENTS_v2.6.md` / `ROADMAP_v2.5_v3.0.md`** are both explicitly marked
   superseded/historical and correctly say so at the top — not a gap, just confirmed
   during this pass so no future session mistakes them for live requirements.

## 5. Outcomes (this pass)

- **Fixed:** extended `FOMC_MEETINGS` in `src/sources.js` with the eight 2027 FOMC
  decision dates (`2027-01-27` … `2027-12-08`), sourced via web search against the Fed's
  2025-09-05 "tentative meeting schedule for 2027" release and cross-checked against two
  independent secondary calendars — **not** fetched from `federalreserve.gov` directly
  (blocked here). Marked in-source as asserted-until-owner-confirmed, matching the exact
  convention the 2026 row already uses (which had 2 of 8 dates wrong on first entry).
  `npm test` now reports **2258 passed, 0 failed** — matches `CLAUDE.md`'s own claimed
  v6.3.0 smoke total exactly.
- **Not run:** `npm run test:ui` / `npm run test:public` (skip cleanly, no
  `node_modules`/Chromium installed in this session's container — expected, additive,
  does not gate `npm test`). `npm run audit:prod` not run for the same reason.
- **Correction to this survey's own premise:** none found — the 5 Whys audit came back
  clean on the first pass; the interesting finding this run turned up was the smoke gate
  itself, not the subsystem it was pointed at.

## 6. Highest-leverage next move

**Get the FOMC-table fix owner-confirmed and merged to `main` promptly.** The CI gate on
`main` has been red since ~2026-09-10 (2 days) and every push in that window would have
failed `npm run gates`. The fix here is minimal, additive, and restores the exact smoke
total the changelog already claims — but it rests on dates this environment could not
verify against the primary source, so it should not be trusted at the same weight as an
owner-confirmed row. Second, smaller: **land `HARNESS.md` on `main`** (or explicitly
retire the harness process altogether) so a future harness-style pass — like this one —
has a real document to check itself against instead of a month-stale branch and a single
dated snapshot that disclaims itself.
