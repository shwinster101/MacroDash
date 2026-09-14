# 2026-09-14 — scheduled audit: repo review, 5 Whys data audit, gate regression found and fixed

> Scheduled task. Scope: read the repo including `harness/` and `ticker-terminal/*.md`
> ("the stock harness and ticker terminal md files"), audit `src/fiveWhys.js`'s data
> sourcing against the documented contract, reconfirm the problem statement/goal, name
> what materially changed since the last pass, name what's missing, and recommend the
> highest-leverage short next move. `CLAUDE.md` is canonical; nothing here overrides it.
> No live user present — everything below was checked directly against source, the test
> suites, or the repo's own self-dated docs rather than taken on faith from a prior note.

## What was read

`CLAUDE.md` (full changelog, in context), `README.md`, `AGENTS.md`, the prior audit
(`working/2026-09-12-five-whys-audit-and-review.md`), `harness/H1-tt-deck-forced-count-
2026-08-03.md`, all nine `ticker-terminal/` files (`README.md`, the three lens harnesses —
`AI_INFRASTRUCTURE_HARNESS_V2.md`, `PHYSICAL_AI_INVESTMENT_HARNESS.md`,
`QUALITY_COMPOUNDER_HARNESS.md` — `TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`,
`V5_SYSTEM_AUDIT_2026-08-23.md`, `VALUE_PROPOSITION_AUDIT_2026-07-31.md`, and the two
archived artifacts `TT_TICKER_TERMINAL.md` / `tt_terminal.html`), plus source:
`src/fiveWhys.js`, `src/evidence.js`, `src/sources.js`, `src/publicCopy.js`, the full diffs
of the two commits shipped since the last pass (`e3bf36d` v6.3.1, `34aafc8` v6.4.0), and
`test/smoke.mjs` / `test/render.mjs` / `test/public-render.mjs` (all three run in real
Chromium this session — `node_modules` installed cleanly and Chromium was reachable, unlike
every prior pass on record, which had to skip the browser suites).

## 1. Problem statement / goal — unchanged, reconfirmed

MacroDash: one responsive, mobile-primary URL answering *"is it safe to be in the market?"*
from live macro + market + sentiment data, honest about live vs mock vs stale, with a
machine-readable `/readout.json` order-gating feed for the separate TT Ticker Terminal.
Two engines, deliberately married-never-merged: the public six-factor **backdrop**
(`src/regime.js`) and Engine 0's seven order-gating checks (`src/ttReadout.js`). `README.md`
and `AGENTS.md` both restate this identically and neither has drifted from `CLAUDE.md`.
Nothing in this pass found either engine's job statement moved.

## 2. 5 Whys data audit (`src/fiveWhys.js`) — PASS, sourcing unchanged; diff-verified this time

The 09-12 audit built the full factor→source table (10Y/VIX/F&G/CPI/CAPE/NFCI → their
`SOURCES` paths → their live FRED/CNN/multpl upstreams) and found it clean. Rather than
re-derive that table from scratch, this pass verified the thing most likely to have moved
it: **the two releases shipped since then both touch `src/fiveWhys.js` and/or
`src/evidence.js`.**

- **v6.3.1** touched only `src/sources.js` (`FOMC_MEETINGS`) and `working/` notes — no
  touch to the 5 Whys pipeline at all.
- **v6.4.0** changed 36 lines of `src/fiveWhys.js` and 27 of `src/evidence.js`. Read both
  diffs in full (not summarized from the changelog): every change is a **vocabulary
  projection** — a new `plain` flag that maps `BULLISH/BEARISH/NEUTRAL` → `HELPING/
  HURTING/MIXED`, `"voters counted"` → `"signals counted"`, `"dark"` → `"unavailable"`, and
  routes the Simple-mode label through the new `simpleCallLabel()`/`SIMPLE_WITHHELD_LABEL`
  from `src/publicCopy.js`. **Nothing touches which factors are read, how they're voted,
  the quorum, freshness gating, or the `factors`/`regime` inputs themselves** — confirming
  `CLAUDE.md`'s own claim that v6.4.0 is "a copy and progressive-disclosure release, not an
  engine change." Spot-checked the six `SOURCES` paths directly against current
  `src/sources.js` (not from memory of the prior table) — all six match verbatim:

  | Factor | SOURCES field → path | Live upstream |
  |---|---|---|
  | 10Y | `tenYearM1` → `crossAsset.treasury10y.m1` | FRED `DGS10` |
  | VIX | `vix` → `marketPulse.vix.current` | FRED `VIXCLS` |
  | Fear & Greed | `fearGreed` → `marketPulse.fearGreed.score` | CNN F&G scrape |
  | CPI | `cpiTrend` → `macro.cpi.trend` | FRED `CPIAUCNS` |
  | Valuation | `shillerPe` → `macro.shillerPe.current` | multpl.com Shiller CAPE |
  | NFCI | `nfci` → `macro.nfci.current` | FRED `NFCI` |

  `computeFiveWhys` still takes `factors` from `evidenceSet.factors`/`dailyCall.factors` —
  the same canonical rows the hero verdict and the Drivers matrix read — so it structurally
  cannot disagree with the call it explains. The headline-materiality gate (WHY #4) still
  imports `isMacroMaterial`/`parseTopHeadlines` from `src/headlines.js` rather than
  duplicating them, and the A1 freshness gate (`FW_FIELDS` on `liveBuild`, not `anyLive`)
  is untouched.

**No code or wiring defect found in the 5 Whys pipeline itself.**

## 3. What materially changed since 2026-09-12

Local checkout, `origin/main`, and `HEAD` are identical at `34aafc8` (`package.json`
6.4.0) — zero ahead/behind, clean working tree before this pass's edit. Two releases
landed:

- **v6.3.1** (2026-09-12, same day as the last audit) — the FOMC calendar fix from that
  audit was merged as-is; working notes consolidated. `FOMC_MEETINGS`'s last entry is now
  `2027-12-08`, **450 days of runway** from today — the v3.99.0 expiry tripwire (>90 days
  required) is healthy with a wide margin.
- **v6.4.0** (2026-09-13) "ONE CALL, TWO VOICES" — the public Simple view now speaks plain
  Bullish/Hold/Bearish (and "Not enough data"), the moon-slang/BULLISH-NEUTRAL-BEARISH
  vocabulary moves to Degen mode only; the header states one market clock
  (before/open/closed + observation date) instead of stacking CLOSE/pull-time/cache
  language; "CLOSE READ" becomes "evening update" in reader-facing copy; the operator
  footer aside is gone from the public route. Confirmed by full diff read (not just the
  changelog's own claim) that **no band, vote, threshold, source, freeze rule, stored
  record, or Worker path moved** — this really is presentation-only, as claimed.

**Also changed, not in the changelog because it isn't code:** the ~30 stale remote
branches the 2026-09-12 audit flagged as clutter are gone — `git branch -r` now shows
only `origin/main` and this session's own working branch. That finding is resolved.

## 4. What's missing / gaps found

1. **LIVE FINDING, FIXED THIS PASS — a real gate regression shipped in v6.4.0 and has been
   red on `main` for ~1 day.** This session was able to `npm install` and reach Chromium
   (every prior audit on record had to skip the browser suites entirely — worth noting as
   a capability change in this environment), so for the first time this recurring audit
   could actually run `npm run gates` end to end. `npm run test:public` came back
   **287 passed, 1 failed**: `v6.4 clock: the unfrozen counterpart caption renders one tap
   deep`. Traced to source: `src/publicCopy.js`'s `liveReadCaption()` (a **new file**
   shipped in the v6.4.0 commit) renders `"Live market read · today's 10am call is
   scheduled"` / `"...is unavailable"`, but `test/public-render.mjs`'s regex — also edited
   in the *same* commit — still expected the pre-implementation planning-note phrasing,
   `"Live market read · today's official call (freezes at 10:00 ET|is unavailable)"`
   (traced to `working/2026-08-28-clock-whys-altitude-matrix.md`'s draft wording, carried
   forward into the regex instead of being updated to the final shipped copy).
   `test/smoke.mjs`'s own pin for the same function (`/10am call is scheduled/`) already
   matches the shipped source correctly — only `public-render.mjs`'s regex had drifted,
   which is why `npm test` alone (the suite every session without Chromium can run) never
   caught it, and why the PR's own claimed "288 public-render" total was never actually
   true after merge. This is the exact "one home is right, one home rotted" defect class
   `CLAUDE.md`'s changelog has caught and fixed many times before (FOMC dates, the Mag-10
   footer, the "5-factor" strings, etc.) — same shape, this time inside the test suite
   itself rather than the product copy.
   **Fixed:** re-pinned `test/public-render.mjs`'s regex to the shipped wording, with the
   reasoning recorded inline at the pin (why the source, not the test, is the correct
   side). `npm run gates` is now clean end to end: **2268 smoke + 309 render + 288
   public-render + `audit:prod` 0 vulnerabilities** — matching `CLAUDE.md`'s own claimed
   v6.4.0 totals exactly.
2. **`HARNESS.md` still absent from `main` — unresolved, third consecutive audit to find
   this.** `harness/H1-tt-deck-forced-count-2026-08-03.md` calls it "canonical for how a
   change gets made," sourced from a branch that was last touched 2026-08-02 and never
   merged. Reconfirmed today: `git ls-tree -r origin/main` still has no `HARNESS.md`
   anywhere in the tree. No live process document exists for a harness-style pass (like
   this one) to check itself against.
3. **The three `ticker-terminal/` lens harnesses and the two archived TT artifacts are
   correctly self-scoped — not a gap.** `ticker-terminal/README.md` explicitly states the
   three lens harnesses (`AI_INFRASTRUCTURE_HARNESS_V2.md`, `PHYSICAL_AI_INVESTMENT_
   HARNESS.md`, `QUALITY_COMPOUNDER_HARNESS.md`) are "methodology references only" and
   that `TT_TICKER_TERMINAL.md`/`tt_terminal.html` are "archived pre-implementation
   prompt/template artifacts... not runtime or sources of truth." Read all five; none
   mislabels itself as current-state or live contract, matching what they actually are.
   `TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md` correctly states "Status:
   implemented contract" and `V5_SYSTEM_AUDIT_2026-08-23.md` / `VALUE_PROPOSITION_
   AUDIT_2026-07-31.md` both carry their own dates and read as point-in-time audits,
   consistent with how `CLAUDE.md`'s changelog treats them (substantially closed out by
   v5.0.0–v5.1.1 and v3.49–v3.50 respectively). No drift found here.

## 5. Outcomes (this pass)

- **Fixed and verified:** `test/public-render.mjs`'s stale `liveReadCaption` regex
  (finding #1 above), with the reasoning documented at the pin.
- **Ran all four gates for real** (uniquely among the audits on record — `node_modules`
  and Chromium were both reachable this session): `npm test` → 2268/0 · `REQUIRE_BROWSER=1
  npm run test:ui` → 309/0 · `REQUIRE_BROWSER=1 npm run test:public` → 288/0 (after the
  fix; 287/1 before it) · `npm run audit:prod` → 0 vulnerabilities.
- **Not changed:** nothing else. No band, threshold, vote, or source moved; the fix is
  test-file-only.
- **Correction to a prior pass's premise:** the 2026-09-12 note's "Not run" section
  assumed the browser suites would keep skipping in this kind of environment going
  forward — that assumption held for every session before this one, but not this one.
  Worth a future session checking rather than assuming the skip, since it is exactly the
  kind of assumption that would have hidden this regression indefinitely (`npm test`
  alone was, and remains, green even with the public-render regex broken).

## 6. Highest-leverage next move

**Get this pass's fix merged to `main` promptly — the public-render gate has been silently
red there since the v6.4.0 merge (~1 day), and `npm test` alone (the fast, no-Chromium gate
most sessions default to) cannot see it.** The fix is minimal, test-file-only, and restores
the exact total the changelog already claims; it does not touch product copy or behavior.
Second, smaller and unchanged from the last two passes: **land `HARNESS.md` on `main`** (or
explicitly retire the harness process) so the next harness-style audit has a real document
to check itself against instead of a month-and-a-half-stale branch and a single dated
snapshot that disclaims itself.
