# 2026-09-16 — scheduled audit: repo review, 5 Whys data audit, next move

> Scheduled task. Scope: read the repo (incl. `ticker-terminal/*.md`), audit
> `src/fiveWhys.js`'s data sourcing against the documented contract, re-confirm the
> problem statement/goal and key drivers, name what materially changed, name what's
> missing, and recommend the highest-leverage short next move. `CLAUDE.md` is canonical.
> Builds on `working/2026-09-12-five-whys-audit-and-review.md` and
> `working/2026-09-14-simple-face-tap-fold.md` — this pass re-verifies rather than
> re-deriving where nothing has moved.

## What was read

`CLAUDE.md` (full changelog, already in context — current through v6.5.4), the two most
recent prior audit files in `working/`, `AGENTS.md`, `README.md`, all seven
`ticker-terminal/*.md` files, `docs/plans/stock-spotlight-activation.md`, `docs/RISKS.md`,
plus source: `src/fiveWhys.js`, `src/regime.js`, `src/sources.js` (`FOMC_MEETINGS`,
`nextFomcDate`), `src/dashboard.jsx` (the `computeFiveWhys` call site),
`src/sections/MacroRegime.jsx`. Ran all four gates (`npm run gates`) after `npm install`
(no `node_modules` existed at session start — the recurring pattern this repo's own
changelog names, e.g. v3.69's "the session the browser suites finally ran").

## 1. Problem statement / goal — unchanged, reaffirmed

MacroDash: one responsive, mobile-primary URL answering *"is it safe to be in the
market?"* from live macro + market + sentiment data, honest about what's live vs mock vs
stale, with a machine-readable `/readout.json` order-gating feed for the separate TT
Ticker Terminal. Two engines, married-never-merged: the public six-factor **backdrop**
(`src/regime.js`) and Engine 0's seven order-gating checks (`src/ttReadout.js`). Nothing
in this pass found either job statement drifted.

## 2. Key drivers — the six factors, confirmed unchanged and correctly wired

`REGIME_BAND_TABLE` (`src/regime.js`) still holds exactly six keys, in the same order:
`tenYear`, `vix`, `fearGreed`, `cpiHeadline`, `valuation`, `nfci` — verified by importing
the module directly and reading `.map(f=>f.key)`, not by reading source text.

## 3. 5 Whys data audit (`src/fiveWhys.js`) — PASS, no drift found

Re-traced the full chain end to end (same method as the 09-12 pass):

| Factor | `regime.js` read path | `sources.js` SOURCES path | Live upstream |
|---|---|---|---|
| 10Y | `crossAsset.treasury10y.m1` | `tenYearM1` | FRED `DGS10` (+ UST par-yield failsafe) |
| VIX | `marketPulse.vix.current` | `vix` | FRED `VIXCLS` (+ CBOE failsafe) |
| Fear & Greed | `marketPulse.fearGreed.score` | `fearGreed` | CNN Business F&G scrape |
| CPI | `macro.cpi.trend` | `cpiTrend`, `DERIVED_OF cpiHeadline` | FRED `CPIAUCNS` (official BLS NSA) |
| Valuation | `macro.shillerPe` | `shillerPe` | multpl.com Shiller CAPE scrape |
| NFCI | `macro.nfci.current` | `nfci` | FRED `NFCI` |

All six match `CLAUDE.md`'s documented source list verbatim. Confirmed intact:

- **One derivation, no drift risk.** `dashboard.jsx:671` calls `computeFiveWhys` with
  `call:dailyCall, factors:evidenceSet.factors, flips:evidenceSet.flips?.flips` — the
  *same* canonical rows the hero, the Drivers matrix and `/readout.json`'s public
  projection read. `fiveWhys.js` does not re-derive votes or exclusions.
- **Headline materiality (WHY #4) still imports from `src/headlines.js`** (`isMacroMaterial`,
  `parseTopHeadlines`, re-exported not duplicated) — the v6.1.0 RANKED HEADLINES table is
  the one home, and the one-way allowlist gate (withhold, never guess or score) is intact.
- **The A1 freshness fix is intact.** `FW_FIELDS=["marketHeadline"]` gates on `liveBuild`
  (not `anyLive`), so a live build stuck in LOADING/ERROR narrates an empty freshness set
  rather than quietly treating mock content as live.
- **`publicCopy.js` integration (v6.4/v6.5 lines) is clean.** The `plain`/Simple branch
  routes every label through `simpleCallLabel`/`SIMPLE_WITHHELD_LABEL` from
  `publicCopy.js` rather than a second vocabulary table — one mapping, not a fork.
- **v3.98.2's numeric-entity decode survives at render** (`deent()`), so a KV-cached
  headline written before that fix still can't print a raw `&#x2019;` today.

**No code or wiring defect found in the 5 Whys pipeline itself** — same conclusion as
09-12, re-verified against the current `main` head (v6.5.4) rather than assumed carried
forward.

## 4. What materially changed since the 09-12 / 09-14 passes

Local branch, local `main`, and `origin/main` were all bit-identical at `204eda5`
(v6.5.4) before this pass. Confirmed shipped and consistent with `CLAUDE.md`:

- **v6.5.0–v6.5.4 "STOCK SPOTLIGHT"** — the NBIS × rotating-Mag-Seven educational widget,
  behind `SPOTLIGHT_ENABLED` (ships OFF), plus the v6.5.1 Simple-flash-card density fix,
  the v6.5.2 half-year FCF merge fix, and v6.5.3/v6.5.4's FACE/TAP/FOLD Simple-altitude
  sprint (presentation-only — no vote, band, or data-source change; verified this pass
  by re-tracing the 5 Whys chain above, which none of that work touches).
- **The `working/2026-09-14-simple-face-tap-fold.md` plan shipped as described** — its
  Outcomes table matches what's actually in `src/simpleFace.js` and the render pins.
- **Housekeeping resolved since 09-12:** the ~30 stale remote branches flagged then are
  gone — `git branch -r` now lists exactly `main` and this session's branch. `HARNESS.md`
  is still absent from `main` (unchanged gap, see below).

## 5. What's missing / gaps found

1. **LIVE FINDING, fixed this pass — a test-only boundary gap, not a production defect.**
   `npm run gates` came back smoke 2347/0 and render 309/0 clean, but
   **public-render read 329 passed, 2 failed**. Root cause: today, 2026-09-16, is itself
   an entry in `FOMC_MEETINGS`, so `nextFomcDate()` correctly returns today and
   `MacroRegime.jsx`'s own `fomcDays===0` branch renders `"FOMC decision today"` — a
   third state the v3.99/v3.99.1 assertions never modeled (they only checked
   `"Next FOMC in N days"` vs `"awaiting schedule"`). The production code was correct;
   the test asserted a narrower contract than the component actually implements. Same
   class of defect this repo's changelog names repeatedly (FIX-A's ageDays boundary,
   the FOMC expiry tripwire, the v3.35 fixpack's relative-date fixtures) — a real
   calendar day the test suite had never been run on. **Fixed**: both assertions in
   `test/public-render.mjs` now derive the expected text the same three ways (null / 0 /
   N) the component branches, so they hold on the meeting day itself. Verified: smoke
   already carried the correct unit-level contract for the day-0 case
   (`test/smoke.mjs:8541`, "nextFomcDate returns the next meeting AT or after today") —
   only the browser-level UI assertion was under-specified. All four gates now read
   **2347 smoke + 309 render + 331 public-render + audit:prod clean**, matching
   `CLAUDE.md`'s own claimed v6.5.4 totals exactly. Committed as `fd6bd1d` and pushed to
   `claude/relaxed-babbage-j3366c`.
2. **`HARNESS.md` — still absent from `main`, unchanged since 09-12.** The one surviving
   artifact in `harness/` (`H1-tt-deck-forced-count-2026-08-03.md`) is a single dated
   snapshot capped at v3.62.1-era work, over 100 releases behind current `main`, and it
   says of itself that it is not maintained. Any harness-style review still has no live
   process document to check itself against.
3. **Stock Spotlight (v6.5.0) is shipped but deliberately inert pending two owner
   actions**, per `docs/plans/stock-spotlight-activation.md`: (a) approval to publicly
   display market caps/prices/derived total returns, and (b) two Cloudflare secrets
   (`TIINGO_KEY` + `SPOTLIGHT_ENABLED=1`) that are not yet set. This is not a code gap —
   the flag-off default and the activation doc are exactly the documented design — but it
   is the one shipped, tested, dark feature currently waiting purely on an owner decision
   rather than on more engineering.
4. **`REQUIREMENTS_v2.6.md` / `ROADMAP_v2.5_v3.0.md`** were not re-read this pass (already
   confirmed superseded/historical on 09-12, and self-label correctly); no change expected
   or found in a 4-day window.

## 6. Outcomes (this pass)

- **Fixed:** the two public-render boundary-gap assertions above (`test/public-render.mjs`),
  committed `fd6bd1d`, pushed to `origin/claude/relaxed-babbage-j3366c`. No PR opened
  (not requested).
- **Verified, not assumed:** ran `npm install` (no `node_modules` present at session
  start) then the full `npm run gates` end to end in real Chromium — all four gates
  green at the exact totals `CLAUDE.md` claims for v6.5.4.
- **Correction to this survey's own premise:** none — the 5 Whys pipeline audit came back
  clean again; the live finding this run turned up was in the test harness's calendar
  coverage, not the subsystem the task asked to audit.

## 7. Highest-leverage next move

**Nothing code-blocking remains — the highest-leverage move is an owner decision, not an
engineering task.** With the gate suite now genuinely green end to end and the 5 Whys
data chain re-confirmed clean, the single item with the most latent value sitting idle is
**Stock Spotlight activation**: it is fully built, tested (33 dedicated public-render
assertions, all passing), and disabled purely on two owner actions (data-rights approval
+ two secrets) documented step-by-step in `docs/plans/stock-spotlight-activation.md`.
Turning it on requires zero further code. Second, smaller: **land `HARNESS.md` on `main`**
(or explicitly retire the harness process) so the next harness-style pass has a real
document to check itself against instead of a 100-release-stale snapshot that disclaims
itself.
