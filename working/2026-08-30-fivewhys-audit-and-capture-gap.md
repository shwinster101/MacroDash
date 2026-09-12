# 2026-08-30 — scheduled audit: 5 Whys data cross-check + the capture pipeline is still down

Scheduled review, not a feature branch. Read-only except for this file. No code changed.

## Scope requested

Review the repo (incl. `ticker-terminal/*.md`), audit the 5 Whys and cross-check its data
sourcing against requirements, review the problem statement/goal/key drivers, audit what
materially changed, and name the highest-leverage next move.

## 1. `src/fiveWhys.js` — data-sourcing audit (code + LIVE production cross-check)

Read `computeFiveWhys` end-to-end against its five stated jobs (call arithmetic → drivers →
transmission → evidence quality → nearest flip, per the v5.4.0 "Why This Call" contract) and
against the v3.51/v5.8/v4.0.1 requirements layered on since: the macro-materiality allowlist,
per-band `WHY_IT_MATTERS` channel language, `liveBuild`-gated freshness, and the `callFrozen`
clock rule (8/28 clock matrix, item A13).

**Wiring (`dashboard.jsx:626-632`) matches the contract:**
- `call: dailyCall` — the same `md-call-v1` object the hero/paste/share builders consume (one
  derivation, per `evidence.js`/`macroCall.js`).
- `factors: evidenceSet.factors` — used only as a fallback when `call.factors` is absent.
- `headlineFresh: freshSet===null || freshSet.has("marketHeadline")` — `freshSet` is `null`
  only in demo builds (mock is deliberately the baseline there) and otherwise gated on
  `liveBuild`, matching the A1 fix (a loading/error live build must not narrate mock as today's
  tape).
- `callFrozen` is passed straight from the server-set flag, driving the `10am call —` vs
  session-based prefix per A13.

**Key parity confirmed.** `WHY_IT_MATTERS` keys (`tenYear`, `vix`, `fearGreed`, `cpiHeadline`,
`valuation`, `nfci`) match `REGIME_BAND_TABLE`'s six `key`s in `regime.js` exactly — no drift
between the engine's factor keys and the prose's channel-mapping table.

**Live cross-check of the one-way materiality filter (v3.51).** Pulled the production
snapshot (`GET /api/snapshot`, 2026-08-30 ~02:05 ET refresh):

```
marketHeadline = "Am I too old for Roth conversions? I'm 84 and my wife is 77. We have $8 million saved."
marketHeadlineAsOf = 2026-08-29
```

Ran `isMacroMaterial()` against that exact string: **`false`** — correctly withheld as a
personal-finance column, not a macro driver. This is a real, live instance of exactly the
failure class v3.51 was built to prevent (a fresh, correctly-dated, irrelevant headline), and
the filter handled it correctly. No defect found in the 5 Whys module itself.

**Also checked and clean:** `_diag` is absent from `/api/snapshot?debug=1` in production with
no token supplied — the B3 fail-closed contract (no `DEBUG_TOKEN` configured ⇒ no diagnostics
for anyone) is holding.

**Conclusion: the 5 Whys module and its data sourcing are correct against the stated
requirements.** No code change needed here.

## 2. Ticker-terminal / stock harness files

Reviewed `ticker-terminal/README.md` (current contract: owner input boundary, decision
boundary, SEND IT/HODL/TOUCH GRASS gate vocabulary, TT-run response contract, persistence
routes) against `src/ttScore.js`/`functions/api/score.js` as described in `CLAUDE.md`'s
changelog — consistent; §14.8 activation (v5.0.0) and the v5.6.x allocation/gate work are
reflected accurately. The three lens harnesses (`AI_INFRASTRUCTURE_HARNESS_V2.md`,
`PHYSICAL_AI_INVESTMENT_HARNESS.md`, `QUALITY_COMPOUNDER_HARNESS.md`) are stable methodology
references (~180-200 lines each, unchanged in shape) and map onto `ttScoreRegistry.js`'s
route profiles as documented. `V5_SYSTEM_AUDIT_2026-08-23.md`'s findings are recorded in
`CLAUDE.md` as resolved by v5.0.0. Nothing stale found in this set.

## 3. Problem statement / goal / key drivers — unchanged

Core positioning (`CLAUDE.md` header) is unchanged: one responsive URL answering "is it safe
to be in the market?" from six live factors (10Y, VIX, F&G, CPI, CAPE, NFCI), with the stated
moat being the **judgment layer** (a verdict, abstention when stale, a machine feed, non-
consensus inputs, a stated "why") rather than the data layer (v3.43's Yahoo-dupe test). That
test is still the bar new features are held to (FEAT-TOKVOL, FEAT-NFCI, FEAT-30Y all cite it).

## 4. What has materially changed recently (v5.6 → v5.9, this week)

- **v5.6.x**: the TT product gate vocabulary locked (SEND IT/HODL/TOUCH GRASS), the
  server-authoritative allocation receipt (FEAT-TT-ALLOC), the belief-vs-street spread, the
  attested daily-stamp outcome layer, candle-continuity guards (two live data-corruption
  catches, v5.6.1/v5.6.2), the boot-chain resumability fix (v5.6.4), disclosure collapsing
  (v5.6.5), search→deep-dive routing (v5.6.6), synthesized-thesis marking (v5.6.7).
- **v5.7–v5.8**: `NFCILEVERAGE` context tile, the newcomer ruler (per-band `ruler` +
  `FactSheet.jsx`), the MIXED-sub derivation fix.
- **v5.9.0 "FIRST GLANCE"** (current HEAD): Simple-mode density pass — macro strip moved
  791px→610px, cards 409px→332px, visible words above the fold 290→208, both fold budgets
  tightened with the measurement. The verdict became a tappable explainer sheet
  (`VERDICT_EXPLAIN` in `regime.js`), cards shed two of four lines, the hero dropped its
  duplicate tally, and operator chrome (wordmark, provenance chip, ⋯ OPS, alert badges) left
  the Simple view. Power is byte-unchanged.
- **Two internal audits on 2026-08-28** (`working/2026-08-28-*.md`) drove a vocabulary
  cleanup (fraction/count consistency across Simple + the 5 Whys) and a clock-honesty pass
  (the unfrozen face no longer borrows "THE CALL"'s identity). Both are fully shipped and
  pinned.

## 5. What's missing / open — and the one that matters right now

Minor, already-acknowledged opens (owner-deferred, low urgency): the header stamp is still
~10 words ("CLOSE · data pulled … · end-of-day, not real-time"), "today's 10am record not
loaded" is honest-but-jargony to a first-time reader, and the TERMINAL button/dock still ride
in Simple. None of these are regressions; they're named follow-ups in `working/2026-08-29-
first-glance.md`.

**The one that matters: the 10am ET daily-call capture pipeline is confirmed down in
production right now**, and this is the flagship accountability feature the product's public
positioning depends on (v5.3.0/v5.5.0 — "one immutable live-forward call," the `/history`
track record).

Live evidence pulled this session:
- `GET /history.json` → 3 rows only: **2026-08-25, 08-26, 08-27, all CAPTURED. No row for
  2026-08-28 (a Friday/trading day), 08-29, or 08-30.**
- `GET /api/snapshot` → `publicCallFrozen: false`, `publicCallCapturedAt: null`,
  `publicCall: null` — as of this session (Sunday 2026-08-30), there is still no captured call
  since Thursday 8/27.

This exact gap was already root-caused on 2026-08-28 (`working/2026-08-28-10am-freeze.md`):
Cloudflare's dashboard interpreted the Worker's `1-5` day-of-week field as Sunday–Thursday
instead of Mon–Fri, so the Friday 10am ET job never fired (confirmed independently via the
Cron Events log — zero events of any kind on 8/28, versus four successful fires on 8/27). The
fix — spelling every trigger `MON-FRI` instead of numeric `1-5` — is **already committed**
(`66922e7`, an ancestor of this branch's current HEAD) and is present in
`worker/wrangler.toml` right now:

```
"0 12 * * MON-FRI"   # 8:00 AM ET pre-open warm
"0 14 * * MON-FRI"   # 10:00 AM ET force-refresh / daily-call capture
```

**But the Worker is a separate deploy from Pages** (`cd worker && npx wrangler deploy`) — a
git merge does not push it. This sandbox has no Cloudflare credentials (`wrangler whoami`
confirms "You are not authenticated"), so it cannot verify whether that deploy has actually
happened, and production's continued silence (no 8/28 row, and it's now 8/30 with nothing
since 8/27) is consistent with either "not deployed yet" or "deployed, but no weekday has
occurred yet to prove it" — Saturday/Sunday correctly produce no rows either way. **Monday
2026-08-31's 10am ET run is the actual test**, and nothing in this repo can assert Cloudflare
trigger state from the outside (the 2026-08-28 note filed this exact verification step as
"still outstanding" and it appears not to have been closed).

## Highest-leverage next move

1. **Confirm the Worker deploy landed** — run `cd worker && npx wrangler deploy` (idempotent
   if already deployed) and check the Cloudflare dashboard's Triggers panel: each cron's
   *Next run* must read a **Monday**, not "Sun, 30 Aug" (the tell for the old misread).
2. **Verify Monday's capture directly** — after ~10:05 AM ET on 2026-08-31, `GET
   https://macrodash.pages.dev/history.json` and confirm a `2026-08-31` row with
   `capture_status: "CAPTURED"`. If it's still missing, the next read is
   `pulse:refresh:attempts` in KV (named in the 8/28 note as the more informative, currently-
   unread log) rather than re-guessing at the cron syntax again.
3. No repo code change is indicated — the fix is already merged; this is purely an
   infra-verification gap, and it is the single highest-leverage thing to close because every
   day it stays open is a silent hole in the public track record the whole product's honesty
   claim rests on.
