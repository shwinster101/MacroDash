# 2026-09-02 — "2x per day?" → the 6pm CLOSE READ, and the ranked headline layer

Owner question, verbatim: *"Should we increase to 2x per day? Second at 430 et? Plan the
integration alongside searching for the real highest leverage headlines."* Asked after a heavy
news day (Broadcom's $350B guide, the Nscale IPO numbers, JPM's 5% 10Y line, subprime auto
delinquencies at a record, MSFT's Azure disclosure…) with the curiosity of how much the system
had actually noted. The plan lives at the session's plan file; this note carries the
exploration facts, the owner rulings and — as each half lands — the outcomes.

## What the exploration established (three explorers, line-cited)

**A 4:30 ET build would not see the close.** FRED holds yesterday's SPY/10Y/30Y/VIX until
overnight, and "yesterday" counts as **0 sessions behind** (`src/sources.js:442-456`), so both
same-day failsafes stay switched OFF by their own trigger predicate (`snapshot.js:289-290`);
`pairCboeVix` refuses a same-day quote as an intraday proxy; SPY has no second source at all
(Finnhub quotes QQQ + nine mega-caps, not SPY). Only Fear & Greed would be new. Four of the six
voters would be byte-identical to the 10am freeze.

**A second SCORED call collides structurally.** The history key is a bare ET date,
first-write-wins (`cron.js:263`); `refresh.js:101-106` hands any later cron the MORNING's frozen
call (a naive re-freeze would notarize the 10am call under an evening key); the outcome anchor
would score a close the call already saw; `/history` keys rows by date; the single heartbeat
key would be clobbered.

**The headline input was thinner than its doctrine.** Two feeds, FIRST `<item>` only, plain
`fetch` with no retry and no `recordStatus` — the 9/2 blank left ZERO diagnostics — a flat
87-term-by-comment (actually 78) substring allowlist, one render slot. Feed URLs, timeouts and
the last-good key were never pinned, so the transport was free to move.

**Designer facts that shaped the build.** The summer close cron `"0 22 * * MON-FRI"` is
byte-identical to SETUP.md's documented WINTER legacy string (a partial November edit would
route the legacy fire into the close arm — smoke must pin five DISTINCT strings);
`mergeFresherLeg` DELETES every key in its list before copying, so a Finnhub SPY quote merged
into the day key would blind the crash circuit (the SPY close leg is display-only, never
merged); `refresh.js` never plumbs `reason` into `buildSnapshot`.

## Owner rulings (9/2, via AskUserQuestion)

1. The second run is a labeled, subordinate, **UNSCORED CLOSE READ** — the 10am stays THE call.
2. It runs at **6:00pm ET** (most same-day legs have landed; after-hours prints are in the feeds).
3. Headlines: **rule-based, $0, no LLM** — allowlist first, then a weighted category score to
   ORDER, instrumented fetch, ranked top-3, in WHY #3 and in the close read.
4. The close read renders in **both modes** as ONE labeled line in the existing drift slot (the
   slot's designed successor — no new Simple element; the freeze is not bent).
5. **`/readout.json` is untouched** — no `close_read` sibling, so the tt-v1 body and the receipt
   hash never change at 18:00 (no new 409 cliff; a later ruling if wanted).

Sequencing: **PR1 v6.1.0** headlines (ships value with no cron change) → **PR2 v6.2.0** the
close read (server + cron + record + rendering + editions, one bumped release — Pages
auto-deploys every merge, so an unbumped intermediate merge would deploy code the footer
cannot identify).

## Outcomes — PR1 v6.1.0 "RANKED HEADLINES"

- `src/headlines.js`: `HEADLINE_CATEGORIES` (the v3.51 terms VERBATIM as data; asserted
  weights 7/6/5/4/3/2/1/1 in the owner's order), `MACRO_TERMS` DERIVED, `isMacroMaterial`
  moved (re-exported from `fiveWhys.js`), `categoryOf` (MAX), `rankHeadlines` (drop → date
  gate → allowlist FIRST → score → sort → dedupe → slice; score never emitted),
  `parseTopHeadlines` (re-gated read-back).
- `snapshot.js`: `fetchHeadlines` — four feeds, every item, two at a time via `fetchRetry`,
  per-feed + one group `recordStatus`; `marketHeadlinesJson` emitted beside the unchanged
  rank-1 fields. `sources.js`/`dashboard.jsx`: the new key mapped, DERIVED, mocked.
- WHY #3: rank-1 verbatim, then "also …" for 2-3 under the same gate, each re-checked.
- **Gates:** 2204 smoke (+21 over v6.0.2, section [77] — main shipped v6.0.1/v6.0.2 from a
  parallel session while this was in flight, so the tree was rebased onto `8f3ae55` before
  commit; both sides had claimed smoke [75], mine renumbered) · 309 render · 253 public-render ·
  audit clean. Four negative
  controls, each turning exactly its own family (gate removed → the allowlist-first family;
  weights overlapped → the two order pins; bare fetch → the wiring pin; hand-copied list → the
  one-table pair).
- **Correction to the survey:** the allowlist has **78** terms, not the 87 the explorer counted
  — pinned by the literal list, not the count.
- **Unverified until deploy:** the two added feeds (WSJ Markets, CNBC Economy) are reachable
  from a browser but not from this sandbox's proxy; `_diag.sources` `rss/*` rows are the check,
  and a 403 at the edge means drop the feed, never work around it.

## Outcomes — PR2 v6.2.0 "THE CLOSE READ"

- **Built as planned, with these deltas from the plan text:** smoke section is **[78]** (not
  [76] — v6.0.1/v6.0.2 took [75]/[76] on main, PR1 took [77]); the SPY leg is labelled
  **"last print (display-only)"** rather than "close", because whether Finnhub's `c` after
  16:00 is the regular-session last trade is unverified from this sandbox — the weaker true
  label until night 1 measures it; `closeReadLine` returns a `label` + `frozen`/`differs` and
  the hero composes the sentence; `_diag.cronJobs` reads the three per-job heartbeat keys.
- **Files:** `src/sources.js` (`CLOSE_PUBLISHED_ET` · `isSessionDay` · `etClock` ·
  `expectedObsDate`), `src/closeRead.js` (new), `src/publicHistory.js` (the close-read key
  family + `validCloseRead`), `src/macroCall.js` (`CALL_EDITIONS` · `callEdition` · both
  formatters take `{edition}`), `functions/api/snapshot.js` (`failsafeDue` · `buildSnapshot`
  edition/now · `fetchSpyClose` · `publicCallMeta` · `cronDiag`/`CRON_JOBS` · `BANDS.spyClose`),
  `functions/api/snapshot/refresh.js` (the close branch, `appendAttempt`),
  `functions/history.json.js` (join + orphans), `worker/cron.js` (`SNAPSHOT_CLOSE_CRON` ·
  per-job `recordWarm` · `refreshSnapshot({edition,job})` · `captureCloseRead` · the arm),
  `worker/wrangler.toml` + `worker/SETUP.md` (five, the collision), `src/useMarketData.js`,
  `src/dashboard.jsx`, `src/sections/RegimeBand.jsx` (298 lines — two comment blocks trimmed
  to stay under the 300 bound), `src/PublicPages.jsx`.
- **Gates:** 2240 smoke (+36) · 309 render · 269 public-render (+16) · audit clean. Eight
  negative controls, each turning only its own family (recorded in the release block).
- **Unverified until the Worker deploys (owner action, `cd worker && npx wrangler deploy`):**
  which legs actually read same-day at 18:00 (`legs_same_day` on the first record), whether
  CBOE's daily file carries today's row by 18:00, and the Finnhub SPY print vs the next
  morning's FRED proxy. Pages alone ships the surfaces and the endpoint; the cron is the
  Worker's, and until it deploys the hero simply keeps rendering the v5.5 drift line.
- **Correction to the survey:** none of the exploration facts turned out wrong; one design
  detail did — the plan had `closeReadLine → {headline, emoji, direction, differs}` and the
  hero composing from those; the shipped builder also carries `label`, `frozen` and
  `legs_same_day` so the /history line and the hero read the same object.
