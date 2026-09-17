# 2026-09-17 — scheduled audit: repo review, 5 Whys data audit, next move

> Scheduled audit pass. Scope per the task: review the GitHub repo including the stock
> harness and ticker-terminal `.md` files; audit `src/fiveWhys.js`'s data sourcing against
> the documented contract; re-confirm the macro-dashboard problem statement/goal and key
> drivers; name what materially changed; name what's missing; recommend the highest-leverage
> short next move. `CLAUDE.md` is canonical; nothing here overrides it.

## What was read

`CLAUDE.md` (full changelog, already in context), `AGENTS.md`, `README.md`, `HANDOFF.md`,
`ticker-terminal/*.md` (README, TT_TICKER_TERMINAL, the redesign plan, the V5 system audit,
the value-proposition audit, the two harness docs — AI_INFRASTRUCTURE / PHYSICAL_AI /
QUALITY_COMPOUNDER), `harness/H1-tt-deck-forced-count-2026-08-03.md`, plus source:
`src/fiveWhys.js`, `src/regime.js`, `src/evidence.js`, `src/dashboard.jsx` (the
`computeFiveWhys` call site), `working/2026-09-12-five-whys-audit-and-review.md` (the prior
pass, to avoid redoing settled ground) and `working/2026-09-16-api-palette-upgrade.md` (the
most recent shipped work). Ran all four gates (`npm run gates`, effectively) fresh in this
container (`npm install` had never been run here).

## 1. Problem statement / goal — unchanged, reaffirmed

MacroDash: one responsive, mobile-primary URL answering *"is it safe to be in the market?"*
from live macro + market + sentiment data, honest about what's live vs mock vs stale, with a
machine-readable `/readout.json` order-gating feed for the separate TT Ticker Terminal. Two
engines, deliberately married-never-merged: the public **six-factor backdrop**
(`src/regime.js` — 10Y · VIX · F&G · CPI · CAPE(valuation) · NFCI, quorum 4 of 6, strict
majority of counted) and Engine 0's seven order-gating checks (`src/ttReadout.js`). Nothing
in this pass found either engine's job statement drifted from that description.

## 2. 5 Whys data audit (`src/fiveWhys.js`) — PASS, no drift found (second consecutive clean pass)

Re-traced the same chain the 2026-09-12 pass verified, since three releases have shipped
since then (v6.6.0/6.6.1/6.6.2) and none of them touch this file:

- **Single derivation confirmed again.** `dashboard.jsx`'s `computeFiveWhys` call still feeds
  `call: dailyCall`, `factors: evidenceSet.factors`, `flips: evidenceSet.flips?.flips` — the
  *same* canonical rows the hero verdict and `/readout.json`'s public projection read. WHY #2
  ("what drove it") groups only factors that actually voted (`Support:`/`Risk:`/`Neutral:`),
  never re-deriving a vote.
- **`REGIME_FACTOR_FIELDS` + the `valuation→shillerPe` alias in `src/evidence.js` (lines
  30-53) still correctly enumerate all six voters** — `tenYear, vix, fearGreed, cpiHeadline,
  nfci` plus the special-cased `shillerPe` alias for the CAPE/valuation factor. Quorum is
  `REGIME_QUORUM = 4` in `regime.js`, matching CLAUDE.md.
- **WHY #4 (headline materiality) still correctly imports `isMacroMaterial`/
  `parseTopHeadlines` from `src/headlines.js`** (the v6.1.0 RANKED HEADLINES home) rather than
  a local copy; the one-way gate (freshness-fail or non-material → withhold, never guess) is
  intact and items 2-3 are independently re-checked material.
- **The A1 freshness fix (`liveBuild`-gated `FW_FIELDS`, not `anyLive`) is still in place**
  at `dashboard.jsx:377` — a live build stuck in LOADING/ERROR still narrates an empty
  freshness set rather than treating mock content as live.
- **CPI's official-BLS YoY derivation is unchanged.**

**No code or wiring defect found in the 5 Whys pipeline.** Full gate run fresh in this
container (first `npm install` here): **2415 smoke / 309 render / 344 public-render passed,
0 failed, `audit:prod` 0 vulnerabilities** — matches the v6.6.2 changelog's claimed totals
exactly, so nothing has silently drifted between what CLAUDE.md claims and what the repo
actually runs.

### 2a. A documentation-only finding, not a code defect

While tracing `fiveWhys.js`'s history to confirm the "voice pass" releases (v3.97.1 / v3.98.1
/ v3.98.2 — "Elsewhere on the tape:", "Slow-burn risks we track", "Bottom line: still
RISK-ON", "The scoreboard:") were still live, none of those exact phrases exist anywhere in
this file's git history on any branch (`git log --all -S"Elsewhere on the tape" --
src/fiveWhys.js` returns nothing). The commit those entries most plausibly describe
(`3311d74`, "v4.0.1 ONE VOICE") in fact *creates* `src/fiveWhys.js` from scratch with an
entirely different, older architecture (a hardcoded "Core anchor / Other live readings /
Market headline / Headwinds / Synthesis" structure keyed on `data.marketPulse` directly)
than the file that actually ships today (the v5.4.0 canonical-factor-row architecture,
descended from `d8a6003`/`f43e0ae`/`34aafc8`). The most likely explanation is that the
"voice pass" line of commits was authored against a divergent branch state that predated the
v5.4.0 redesign and was never reconciled forward — the same "parallel branch, version
number reused, content diverges" pattern CLAUDE.md documents explicitly for a dozen other
releases (ENGINE0-CONT, FEAT-TT-SCORE, FEAT-DOCK, etc.), just never called out for this
file. **Not a functional bug** — the shipped file is internally coherent with its own header
comment and fully covered by smoke — but it means three changelog entries describe prose a
reader will never find in the code. Filed here rather than silently edited into CLAUDE.md,
per the project's own "correct, don't quietly rewrite" convention; a maintainer decision is
needed on whether to append a correcting note at those three entries.

## 3. What materially changed since the last audit (2026-09-12)

`package.json` moved `6.3.0 → 6.6.2` across five real releases, none of which touch the
public dashboard's 5-Whys/regime/evidence pipeline — all are the TT terminal's API-palette
line of work:

- **v6.6.2 — Alpha Vantage joins the street ESTIMATES side** under its own name (never a
  Seeking Alpha relabel), budgeted at 20 of 25 free daily calls, plus the browser-harness
  midnight-ET race fix.
- **v6.6.1 — Nasdaq/Zacks admitted as an analyst-target street source** under its own name,
  beside TipRanks, via a named `{provider→host}` allowlist (replacing a hardcoded TipRanks
  lock).
- **v6.6.0 — Tiingo takes the first daily-candle rung**, ahead of the Nasdaq scrape; the
  Finnhub rung it replaces was dead on the free plan since it shipped (premium-gated,
  returning `missing(...)` on every symbol, every run — the TT price ladder had been running
  on the Nasdaq scrape alone, with nothing above it, the entire time).
- **v6.5.5/v6.5.6 — the dashboard decomposition + "useful learning" Stock Spotlight work**
  (structure-only extraction of `dashboard.jsx` into `src/sections/`/`src/primitives/`, and
  making the spotlight's learning moment evidence-bound). Confirmed via `git log` that these
  are on `main` and match their changelog entries.

All five are present, consistent with `CLAUDE.md`, and cross-verified against
`working/2026-09-16-api-palette-upgrade.md`, whose own verification pass caught two real
premise errors before shipping (Move 1a's Nasdaq packet cannot pass `validateStreetPacket`'s
hardcoded TipRanks lock without a schema change — correctly re-scoped rather than forced
through; none of the three new upstream hosts are reachable from this build environment's
egress proxy — stated as an honest limit, not silently assumed). That note was itself
updated with outcomes in the same pass that executed it, matching this project's own
"update the finding file when the work lands" rule.

## 4. What's missing / gaps found

1. **`HARNESS.md` is still not on `main` — five days later, no change from the 2026-09-12
   finding.** `harness/H1-tt-deck-forced-count-2026-08-03.md` still calls it "canonical for
   how a change gets made," still cites a branch (`claude/harness-model-assignment-d6xhlb`)
   that is over a month stale and was never merged. Any harness-style pass, including this
   one, still has no live process document to check itself against — only a single dated
   snapshot that disclaims itself. This is now the **second consecutive scheduled audit**
   to name this gap with zero movement between passes.
2. **No new code defect found this pass** — all four gates are green at the exact totals
   CLAUDE.md claims, which was not true five weeks ago at the 2026-09-12 pass (the FOMC
   expiry tripwire was red on `main` for two days before that pass fixed it). The calendar
   fix from that pass holds: `FOMC_MEETINGS` now runs through `2027-12-08`, ~450 days of
   runway from today, comfortably clear of the 90-day tripwire.
3. **The fiveWhys.js changelog/code divergence** named in §2a — cosmetic, but it is exactly
   the class of defect this repo's own culture exists to catch, now found in the record
   rather than the app.
4. **Every one of the three brand-new provider integrations (Tiingo, Nasdaq analyst
   endpoints, Alpha Vantage) is still honestly unverified against a live upstream from this
   build environment** — all three hosts return `connect_rejected` at the egress proxy here,
   stated as such in both `CLAUDE.md` and the palette-upgrade working note. Not a new gap
   (the same posture has applied to Tiingo/Nasdaq/CBOE/FRED/Kalshi for many releases), but
   worth restating since it now applies to three freshly-shipped code paths at once — the
   first real keyed/live call from the Cloudflare Pages edge is still the true schema check
   for all three, and none of them has happened yet as far as this repo's own record shows.

## 5. Highest-leverage short next move

**Land `HARNESS.md` on `main`, or explicitly retire the harness process and delete the
dangling reference in `harness/H1-tt-deck-forced-count-2026-08-03.md`.** This is now a
two-strikes finding (2026-09-12, 2026-09-17) with zero cost to fix relative to its recurring
cost: every harness/audit-style session pays a few minutes rediscovering that the canonical
process doc doesn't exist, and a fresh session five days from now will pay it again. Second,
smaller, and now that a keyed/live path exists for three new providers: **get real
Cloudflare Pages edge deploys to actually exercise Tiingo/Nasdaq/Alpha Vantage once**, since
all three parsers are fixture-tested but zero-verified against a real response, and each
one's own changelog entry names "the first live call" as the true remaining risk.

## 6. Outcomes (this pass)

- **No code changed.** Nothing required a fix — this pass's job was verification, and
  everything it checked came back matching CLAUDE.md's claims exactly (four gates green at
  the exact stated totals).
- **This note is the deliverable**, per the project's own working/-note convention.
- **Correction to this survey's own premise:** none found during execution; the one
  surprising result (§2a) surfaced while tracing history to *confirm* a claim, not while
  disproving one, and is recorded as a documentation finding rather than a code fix.
