# 2026-09-11 — scheduled audit: 5 Whys data cross-check + repo-wide review

Automated/scheduled pass (no live user steering this session). Scope per the trigger prompt:
review the repo incl. ticker-terminal + harness docs; audit the 5 Whys and cross-check its data
sourcing against requirements; review the macro-dashboard problem statement/goal and key
drivers; note what materially changed; find what's missing; propose the single highest-leverage
short next move. Read-only — no code changes made. File written but **not committed**, since no
one asked for a commit on this run; the next interactive session can fold it in or discard it.

## 0. Repo state at HEAD

`d4a1cca` — v6.3.0 "EIGHT SHEETS", branch `claude/relaxed-babbage-krngnm`, working tree clean,
105 commits total. `package.json`/`package-lock.json` both read `6.3.0` (in sync — the v4.1.3
drift this file's own history complained about is fixed).

Ran the full gate after `npm install` (node_modules wasn't present) + Chromium already staged at
`/opt/pw-browsers`:

| Suite | Result |
|---|---|
| `npm test` (smoke) | **2257 passed, 1 FAILED** (see §1) |
| `npm run test:ui` (REQUIRE_BROWSER=1) | 309/309 passed |
| `npm run test:public` (REQUIRE_BROWSER=1) | 283/283 passed |
| `npm run audit:prod` | 0 vulnerabilities |

CLAUDE.md's own v6.3.0 entry claims "2258 smoke + 309 render + 283 public-render" at ship time
(2026-09-05) — render/public-render match exactly; smoke is the same total (2258) but one
assertion that was green on 09-05 is red today. That assertion is date-driven by design.

## 1. THE ONE FAILING TEST — and it is real, not flaky

```
FAIL  fomc: EXPIRY TRIPWIRE — the calendar has >90 days of runway (extend FOMC_MEETINGS if RED)
```

`src/sources.js` curates `FOMC_MEETINGS` (Fed decision dates) rather than fetching it — a
deliberate, well-reasoned call (v3.99.0: fetching depended on Kalshi, which rate-limited and
took the meeting *date* down with the odds). The table currently ends at `"2026-12-09"`. Smoke
has a tripwire that goes red once fewer than 90 days of runway remain past `now`, specifically
*because* "a comment asking for an annual update is exactly what rotted the value this
replaces" (the FOMC_MEETINGS header comment, quoting the incident that motivated the curation).

Today is 2026-09-11. 2026-12-09 is 89 days out → **the tripwire is correctly firing now.**

This is not cosmetic: `.github/workflows/test.yml` runs `npm test` as a required step on every
push to `main` and every PR, with no `continue-on-error`. **The next push or PR against this
repo will fail CI** on this exact assertion until `FOMC_MEETINGS` gains its next entries (2027
H1 at minimum, ideally through the same ~1yr lookahead the table has kept historically — it
already carries all 8 of 2026 and all 8 of 2027... wait, checked again: it stops at 2026-12-09,
i.e. it does NOT yet carry any 2027 dates, unlike `MARKET_HOLIDAYS`, which already stocks two
full years, 2026 *and* 2027).

**Why I did not just add the dates myself:** the project's own doctrine for this exact table
(stated in the header comment and echoed at `nextFomcDate()`) is "a guessed meeting date would
feed a countdown and an Engine 0 gate input, and a confidently wrong date there is worse than a
stated gap" — dates go in only "asserted, flagged for owner confirmation," the same discipline
the 2026-08-17 correction (owner fixed 2 of 8 wrong assistant-guessed dates) exists to enforce.
My training data does not carry confirmed 2027 FOMC dates I'd stand behind, so fabricating them
here would repeat the exact mistake this table's own history is a warning against. This is
squarely an "owner adds the real dates" item, not an "agent silently patches it" item.

**This is the single highest-leverage next move in the whole repo right now** — it is small
(8 lines), it is currently red, and it blocks the "all green" bar the rest of this audit found
everywhere else. See §5 for the concrete action.

## 2. The 5 Whys — data-sourcing cross-check against requirements

`src/fiveWhys.js` (`computeFiveWhys`) is the ONLY 5-Whys implementation that exists in the repo
— confirmed via `git log --all -S"Core tape"` etc. that CLAUDE.md's own v3.94–v4.0.1 changelog
entries (which describe a "Core tape:" / "Live cross-signals:" / "Risk register (curated)"
vocabulary) describe a *prior* incarnation of this file that was fully rewritten by
`d8a6003 "Repair Why This Call accountability"` — the v5.4.0 "Why This Call" evidence-integrity
repair CLAUDE.md's own changelog names at that commit. Not a discrepancy; just confirms the
current file is the post-v5.4.0 lineage (v5.4 → v5.8 → v6.1 → today), and the current five-check
structure (`WHY THIS CALL / WHAT DROVE IT / WHY IT MATTERS / CAN I TRUST IT / WHAT CHANGES IT`)
is what's actually live, matching the file's own header comment.

**Data lineage, traced end to end (dashboard.jsx:670 → fiveWhys.js):**

```
computeFiveWhys(data, regime, {
  call:          dailyCall            // md-call-v1, from macroCall.js
  factors:       evidenceSet.factors  // src/evidence.js buildEvidenceSet(), which itself
                                       // wraps computeRegime()/regimeFactors() from regime.js
  flips:         evidenceSet.flips.flips
  snapshotAsOf:  asOf                 // the day's KV snapshot timestamp
  headlineFresh: liveBuild-gated set  // A1 fix: LOADING/ERROR states never narrate mock headline
  callFrozen:    the 10am-freeze flag
})
```

Every one of the six voting factors traces to a real upstream, confirmed in
`functions/api/snapshot.js` and pinned in `test/smoke.mjs`:

| Factor | Field path | Upstream | Cadence |
|---|---|---|---|
| 10Y direction | `crossAsset.treasury10y.m1` | FRED `DGS10` (+ UST par-yield failsafe on lag) | daily |
| VIX | `marketPulse.vix.current` | FRED `VIXCLS` (+ CBOE failsafe on lag) | daily |
| Fear & Greed | `marketPulse.fearGreed.score` | CNN F&G scrape | daily |
| CPI trend | `macro.cpi.trend` | FRED `CPIAUCNS`/`CPILFENS` (official NSA, matches BLS headline) | monthly |
| Valuation (CAPE) | `macro.shillerPe` | multpl.com scrape | monthly |
| Financial conditions | `macro.nfci.current` | FRED `NFCI` | weekly |

`test/smoke.mjs:10695` pins literally: *"every active pull uses official NSA CPIAUCNS/CPILFENS,
never the SA pair"* against both `functions/api/snapshot.js` and `worker/cron.js` — this is the
exact v5.4.0 requirement (displayed 12-month CPI number must match the BLS headline release),
and it's still true and still enforced by a real assertion, not just prose.

**Exclusion/freshness discipline matches the documented requirement (v3.54 FEAT-QUORUM /
v3.62 FEAT-NEUTRAL / v4.0.3):** a factor is excluded from the vote (not silently zeroed) when
stale for its own cadence or when the field mode isn't LIVE/CACHED in a live build; the reason
is now typed (`"too old for how often it updates"` vs `"no live feed right now"`), and
`regimeFactors()` derives every row's vote from `REGIME_BAND_TABLE` — one source of truth, no
parallel copy of a threshold. `verdictFrom()` requires a strict majority of *counted* voters
(not a hardcoded fraction of 6), and a call below `REGIME_QUORUM=4` renders `INSUFFICIENT`
rather than a confident call from thin evidence. This is exactly the behavior CLAUDE.md's
FEAT-QUORUM/FEAT-FLIP/FEAT-NEUTRAL entries describe, and the live code matches those
descriptions — I did not find drift between the documented engine and the shipped one here.

**Verdict: the 5 Whys' data sourcing is sound and matches the stated requirements.** No
fabricated numbers, no stale-vs-live confusion in the paths I traced, headline context is
correctly gated behind the macro-materiality allowlist (`src/headlines.js`) and never votes.

**One soft gap, not a defect:** three inputs exist and are fully wired but deliberately never
vote — 30Y/10s30s spread, the CCC-and-lower credit tail, and the Sahm rule (`src/sahm.js`,
`CREDIT_TAIL_CALM/STRESS` in `regime.js`). Each arrived under an explicit "non-voting on
arrival, promotion is an owner call once real values are observed" ruling (v3.55, v3.88). That
ruling has never been revisited — it's a live, standing decision point, not a bug.

## 3. Problem statement, goal, key drivers — and what materially changed

**Problem statement (README.md / CLAUDE.md, unchanged across the whole project history):**
"Macro-intelligence dashboard… one responsive URL, mobile-primary, that answers *is it safe to
be in the market?* from live macro + market + sentiment data." Secondary surface: `/readout.json`
— a machine-readable order-gating feed (`tt-v1`) for the separate Ticker Terminal, described
explicitly as *a different engine, married never merged* with the public 6-factor vote.

**Key drivers (the six-factor backdrop that IS the "safe to be in the market?" verdict):**
10-Year Treasury direction, VIX, CNN Fear & Greed, CPI trend, Shiller CAPE valuation, Chicago
Fed NFCI. A strict majority of currently-usable ("counted") drivers decides RISK-ON / MIXED /
RISK-OFF; below 4-of-6 usable the page withholds a call rather than guessing.

**What has materially changed recently (v6.0 → v6.3, the last ~10 releases):** the product
tightened around one theme — *make every claim on screen provably true of the data behind it,
and put context one tap away instead of hover-only.* Concretely: v6.0 collapsed two competing
gate derivations into one (`macroGate()` now rung-for-rung on the server ladder) and made the
10am freeze retry-safe; v6.0.1–v6.0.2 did a shape-before-text/Simple-vs-Power legibility pass;
v6.1 replaced a single-feed headline with an allowlist-then-ranked multi-feed picker (still $0,
still no LLM); v6.2 added a second, explicitly *unscored* 6pm "close read" beside the frozen
10am call, with real engineering around why a second SCORED call would double-count and how the
close read stays out of `/readout.json` entirely; v6.3 (this week) gave all eight macro-strip
tiles the same tap-to-explain sheet the cards already had, closing a "hover-only, unreachable on
touch" finding that had been open since a v3.73 audit. Every one of these shipped with matching
smoke/render/public-render coverage and a negative control per claim — the discipline is
consistent release to release, not just asserted in prose.

## 4. Ticker Terminal / stock harness side (background research pass, see also the agent's
   full findings recorded in this session)

TT is a *separate* engine from the public 6-factor backdrop — a personal capital-allocation
system (owner's own holdings), not a Yahoo/SA competitor: it remembers a thesis, detects what
changed, enforces the owner's own rules, and ranks what deserves the next dollar. The three
"harness" documents (AI_INFRASTRUCTURE / PHYSICAL_AI / QUALITY_COMPOUNDER) are sector-specific
underwriting lenses a router assigns each ticker to, on the stated principle that one identical
rubric across NBIS, JOBY and TSM would manufacture a false thesis; `README.md` states they are
now "methodology references only," with the real logic living in `src/ttScoreRegistry.js`.

**Found: no doc-vs-code drift this time** — the highest-leverage item named in
`V5_SYSTEM_AUDIT_2026-08-23.md` (§4: "flip the governor so the server card governs the board")
is genuinely shipped (v5.0.0, same day as the audit) and the code (`functions/lib/tt-alloc.js`,
`admin.html`) carries matching "§14.8 ACTIVATED" comments.

**What's still open, and it's now the real bottleneck:** per the same audit, only 5 of 28
tracked names were `SCORED` at the time; the rest sit `PROVISIONAL` (capped at tier B, never
eligible) until an owner-authored falsifier set is committed per name — deliberately
non-automatable (v3.78 explicitly declined template-generated falsifiers as post-hoc
rationalization). Since then only **TSM** converted to SCORED (v5.1.1). The audit's named sprint
order — RDDT, BE, CRDO, CRWV next — has no later commit closing any of them. A named hard
deadline in that same audit ("NVDA hinge drop before 8/26") is ~16 days past due with nothing in
the changelog confirming it happened. This is owner-authored work by design; it isn't something
an agent should do on its own, but it's worth surfacing because it's the actual reason the
Ticker Terminal's "next dollar" ranking still only speaks for a small slice of the tracked book.

## 5. Highest-leverage next moves (ranked)

1. **Extend `FOMC_MEETINGS` in `src/sources.js` past 2026-12-09** with the confirmed 2027
   meeting calendar (owner to supply/confirm the dates — do not let an agent guess them, per
   this table's own documented incident history). This is the one thing standing between the
   repo and an all-green `npm run gates`, and it will fail the next CI run on `main` if left.
   Effort: minutes, once real dates are in hand.
2. **(Owner-paced, not urgent) Continue the TT falsifier sprint** — RDDT, BE, CRDO, CRWV, per
   the 2026-08-23 audit's own ranking — to grow the ELIGIBLE NEXT DOLLAR line past its current
   handful of SCORED names now that the §14.8 governor is live and actually reads the server
   card.
3. No third item rises to the same level this pass — the rest of the codebase (public
   dashboard, 5 Whys, render/public-render suites, dependency audit) is genuinely clean.

## Outcomes

- Ran the full gate (`npm install` was needed — no `node_modules` present at session start;
  Chromium already staged at `/opt/pw-browsers`, so both browser suites ran for real, not
  skipped).
- One real, currently-active regression identified and root-caused (§1); nothing else in
  smoke/render/public-render/audit:prod is red.
- 5 Whys data-sourcing cross-check: **passes** against the documented requirements (v5.4.0
  evidence-integrity contract, v3.54 quorum, v3.62 neutral-vote fix) — traced field-by-field to
  live upstreams and confirmed by existing test pins, not just by reading prose.
- No code changed. This file is new and currently **uncommitted** (see header note).
