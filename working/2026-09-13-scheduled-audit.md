# 2026-09-13 — scheduled audit: repo review, 5 Whys data audit, problem-statement re-confirm

> Scheduled audit pass. Scope per the task: read the repo (including `harness/` and
> `ticker-terminal/*.md`), audit `src/fiveWhys.js`'s data sourcing against the documented
> contract, re-confirm the macro dashboard's problem statement/goal and key drivers, name
> what materially changed, name what's missing, and recommend the highest-leverage short
> next move. `CLAUDE.md` is canonical; nothing here overrides it.

## What was read / verified this pass

`CLAUDE.md` (full changelog, in context), `README.md`, `ticker-terminal/README.md`,
`harness/H1-tt-deck-forced-count-2026-08-03.md` (referenced, not re-read in full — no new
content since the 2026-09-06/09-12 passes already summarized it), plus source read directly:
`src/fiveWhys.js` (full file), `src/regime.js` (FACTOR_FIELD), `src/sources.js` (SOURCES map,
FOMC_MEETINGS table), `functions/api/snapshot.js` (grep for live upstream series/fetches).
Also: `git fetch origin main` + diff, `npm install`, all four gates run live
(`npm run gates` under `REQUIRE_BROWSER=1`), `mcp__github__list_branches`, and a live fetch
of the deployed `https://macrodash.pages.dev/readout.json`.

## 1. Problem statement / goal — unchanged, reaffirmed

MacroDash: one responsive, mobile-primary URL answering *"is it safe to be in the market?"*
from live macro + market + sentiment data, honest about live vs mock vs stale, with a
machine-readable `/readout.json` order-gating feed for the separate TT Ticker Terminal. Two
engines, deliberately married-never-merged: the public six-factor **backdrop**
(`src/regime.js`, 10Y · VIX · F&G · CPI · CAPE · NFCI) and Engine 0's seven order-gating
checks (`src/ttReadout.js`). No drift found in either engine's job statement.

## 2. 5 Whys data audit (`src/fiveWhys.js`) — PASS, no drift, independently re-verified

Read the file in full (not just grepped) and traced every factor end to end:

| Factor | `regime.js` factor key | `sources.js` SOURCES path | Live upstream (`snapshot.js`) |
|---|---|---|---|
| 10Y | `tenYearM1` → `crossAsset.treasury10y.m1` | public | FRED `DGS10` (+ UST par-yield failsafe) |
| VIX | `vix` → `marketPulse.vix.current` | citation | FRED `VIXCLS` (+ CBOE failsafe) |
| Fear & Greed | `fearGreed` → `marketPulse.fearGreed.score` | citation | CNN Business F&G scrape |
| CPI | `cpiTrend` → `macro.cpi.trend` | public | FRED `CPIAUCNS` (official BLS NSA → YoY) |
| Valuation | `shillerPe` → `macro.shillerPe.current` | public | multpl.com Shiller CAPE scrape |
| NFCI | `nfci` → `macro.nfci.current` | public | FRED `NFCI` |

All six match `CLAUDE.md`'s documented source list verbatim. Structural checks:

- **Single derivation, no re-vote.** `computeFiveWhys` reads `opts.call.factors` /
  `opts.factors` — the same canonical rows the hero, the Drivers matrix and
  `/readout.json`'s public projection consume. It never recomputes a vote or exclusion.
- **Materiality gate (WHY #4) is correctly wired to v6.1.0's `src/headlines.js`.**
  `isMacroMaterial`/`parseTopHeadlines` are imported and re-exported, not duplicated; the
  one-way allowlist (fail → withhold, never guess) is intact and items 2-3 are independently
  re-checked material.
- **A1 freshness gate intact.** Headline freshness (`opts.headlineFresh`) and the confidence/
  exclusion narration are driven off the passed-in canonical `call`/`factors`, so a
  LOADING/ERROR live build cannot narrate mock content as current — no regression found.
- **Entity-decode survives at render (`deent`)**, per the v3.98.2 fix — still present,
  unchanged, guards a same-day stored KV artifact that may carry a pre-fix raw entity.
- **One correction to a prior pass's mental model, recorded rather than silently fixed
  elsewhere:** earlier working notes in this same `working/` directory (e.g. the "trader
  voice" / "Elsewhere on the tape" / "Bottom line" copy described under a `CLAUDE.md`
  changelog entry labelled v3.98.1) do **not** correspond to any commit that ever touched
  `src/fiveWhys.js` — confirmed via `git log --oneline -- src/fiveWhys.js` (6 commits total,
  none matching that copy) and a repo-wide grep for those exact strings (zero hits). That
  changelog entry's version number collides with this repo's well-documented parallel-branch
  numbering problem (explicit collision notes exist for `v3.7x`–`v5.6x` throughout
  `CLAUDE.md`); the copy it describes was superseded by, or never reached, what shipped as
  the canonical v5.4.0 "Why This Call" rewrite that IS in this file today. Not a live defect
  — just a note for the next pass so nobody goes looking for "Elsewhere on the tape" in this
  file again.

**No code or wiring defect found in the 5 Whys pipeline.**

## 3. What materially changed since the 2026-09-12 pass

**Nothing, on `main`.** Local checkout, `origin/main`, and this session's checkout are all
identical at `e3bf36d` (`package.json` 6.3.1) — the FOMC-table fix from the 09-12 pass has
already landed and merged (PR #32, "v6.3.1 — FOMC calendar extended past the tripwire").
`git diff origin/main --stat` is empty; working tree clean.

## 4. Gate status — full green, independently re-run (not skipped)

Unlike the 09-06 through 09-12 passes (which could only run `npm test`, no
`node_modules`/Chromium in-container), this session had Chromium pre-installed
(`/opt/pw-browsers`). Ran `npm install` then `REQUIRE_BROWSER=1 npm run gates` end to end:

- `npm test` (smoke): **2258 passed, 0 failed**
- `npm run test:ui` (admin.html, real Chromium): **309 passed, 0 failed**
- `npm run test:public` (public dashboard, real Chromium): **283 passed, 0 failed**
- `npm run audit:prod`: **0 vulnerabilities**

All four numbers match `CLAUDE.md`'s own claimed v6.3.1 totals exactly. CI is genuinely
green today, not just "smoke happens to pass."

## 5. FOMC expiry tripwire — healthy today

`FOMC_MEETINGS` now runs `2026-01-28` … `2027-12-08` (extended in v6.3.1). From today
(2026-09-13) that's well over a year of runway — nowhere near the 90-day guard. The 2026
rows are owner-confirmed (2026-08-17); **the eight 2027 rows are still flagged
ASSERTED-NOT-OWNER-CONFIRMED** in-source (sourced via web search against the Fed's
2025-09-05 press release, since `federalreserve.gov` is blocked from this build
environment's proxy — same standing limitation as FRED/UST/CBOE/Kalshi). Not urgent (the
countdown doesn't reach a 2027 date until after 2026-12-09), but worth a real owner
cross-check before then.

## 6. Live production check (new this pass — not done in the last several audits)

Fetched the deployed `https://macrodash.pages.dev/readout.json` directly. Production is
reachable and **fully live today**: verdict TAILWIND (public label HODL/NEUTRAL), HIGH
confidence, FULL actionability, Macro Flip CLEAR (not armed, not tripped). All six factors
report live values with no stale/mock sources flagged — including Fed odds from Kalshi
(Hike 78% / Hold 20% / Cut 2% for the 2026-09-16 meeting, which matches
`FOMC_MEETINGS`'s next entry exactly) and VIX/10Y/F&G/CAPE/NFCI all current. This is
evidence the owner-side Cloudflare secrets (`FRED_KEY`, `FINNHUB_KEY`, and the Kalshi
transport) are configured and working in production — previously an open question in this
file's own "Environment matrix," never confirmed live by a prior scheduled pass.

## 7. What's missing / open gaps (unchanged from prior passes — still unresolved)

1. **`HARNESS.md` still absent from `main`.** `harness/H1-tt-deck-forced-count-2026-08-03.md`
   calls it canonical, sourced from branch `claude/harness-model-assignment-d6xhlb`
   (stale since 2026-08-02, ~v3.62.1-era, never merged). This is now the **fourth or fifth**
   consecutive scheduled pass (09-06, 09-08, 09-10, 09-11, 09-12, now 09-13) to name this gap
   without it being resolved — it costs real review time each time and nobody has decided
   whether to merge/rewrite it or formally retire the concept the way `AGENTS.md` was thinned
   (v3.60.1 B5: "state where the truth lives, don't copy it").
2. **39 branches on the remote** (confirmed via the GitHub API this pass, not just a local
   `git branch -r` sample): `main`, this session's branch, and 37 `claude/*`/misc branches.
   Sampled in a prior pass — no unique unmerged work found in the ones checked. Pure clutter,
   costs review time on every pass that has to distinguish "live work" from "abandoned
   session branch."
3. **Eight 2027 FOMC dates unconfirmed** (see §5) — low urgency, filed.
4. **Not this pass's finding, but stated for continuity:** `REQUIREMENTS_v2.6.md` and
   `ROADMAP_v2.5_v3.0.md` remain correctly self-marked superseded/historical.

## 8. Outcomes (this pass)

- **No code changes made** — nothing broken, nothing to fix. All four gates green,
  data-sourcing audit clean, production live and healthy.
- **New verification added beyond prior passes:** ran the full browser-based gate suite
  (render + public-render) instead of skipping it, and did a live production
  `/readout.json` check. Both came back clean.
- **Correction to a prior pass's finding:** none to `CLAUDE.md` itself; one clarifying note
  added above (§2) about a changelog entry (v3.98.1's "trader voice" 5-Whys copy) that
  doesn't correspond to any commit in `src/fiveWhys.js`'s history — recorded so a future
  pass doesn't spend time hunting for text that was never shipped to this file.

## 9. Highest-leverage next move

**Land a decision on `HARNESS.md` — merge a rewritten version or formally retire the
concept.** It's the one recurring, named gap that a human decision (not another audit pass)
actually closes, and it's been re-discovered on **six consecutive scheduled passes** now
with no change in status. Everything else checked out clean this pass: gates are green,
the 5 Whys are correctly sourced, and production is live and healthy — there is no
build-breaking or data-integrity issue to chase today.

**Highest-leverage question for the maintainer:** do you want `HARNESS.md` merged (rewritten
against current `main`, not the 2026-08-02 branch snapshot) or explicitly retired, and
should someone spend 10 minutes deleting the ~37 stale `claude/*` branches so future audits
stop paying the triage cost on every pass?
