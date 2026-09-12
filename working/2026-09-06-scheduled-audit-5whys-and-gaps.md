# 2026-09-06 — Scheduled audit: 5 Whys data-sourcing cross-check, problem-statement review, gap scan

Automated/scheduled review. Scope as requested: (1) read the repo incl. `harness/` and
`ticker-terminal/*.md`, (2) audit the dashboard's 5 Whys and cross-check its data sourcing
against the project's own requirements/doctrine, (3) review the problem statement/goal and
what has materially changed, (4) surface what's missing and the highest-leverage next move.

## 0. Repo health check (run before anything else)

At HEAD (`d4a1cca`, v6.3.0, branch `claude/relaxed-babbage-s5bxkh` == `main`):

- `npm test` → **2258 passed, 0 failed** (matches CLAUDE.md's stated v6.3.0 count exactly)
- `REQUIRE_BROWSER=1 npm run test:ui` → **309 passed, 0 failed** (matches)
- `REQUIRE_BROWSER=1 npm run test:public` → **283 passed, 0 failed** (matches)
- `npm run audit:prod` → **0 vulnerabilities**

All four gates green, real Chromium, and every count matches the changelog's own claim for
this exact version. The repo is internally consistent — code, tests and the changelog agree.

## 1. 5 Whys audit — data sourcing vs. requirements

Read `src/fiveWhys.js`, `src/sections/FiveWhys.jsx`, `src/macroCall.js`, `src/regime.js`,
`src/sources.js`, `src/evidence.js` and the dashboard wiring (`src/dashboard.jsx:650-701`).

**Structure matches the v5.4.0 "Why This Call" doctrine exactly** — five checks, generated
from the canonical `md-call-v1` factor rows, not a curated mixture:
1. Call arithmetic (bull/neutral/bear counts, majority rule, coverage N of 6)
2. Actual drivers (only canonical factors that voted — `usableFactors`, excluded ones named)
3. Transmission mechanism (`WHY_IT_MATTERS`, one clause per directional factor)
4. Evidence quality/provenance (confidence, snapshot timestamp, exclusions, headline-as-context)
5. Nearest load-bearing threshold + actionability

**The six factors are the correct six**, verified by direct comparison:
`WHY_IT_MATTERS` keys (`tenYear, vix, fearGreed, cpiHeadline, valuation, nfci`) are
byte-identical to `REGIME_BAND_TABLE`'s six `key`s in `src/regime.js`. No drift between the
public six-factor backdrop and what the 5 Whys narrates — this is exactly the "one
derivation, not a parallel copy-table" rule the project holds itself to elsewhere.

**Every one of the six factors has a real live source** in `src/sources.js`'s `SOURCES` map
(`tenYear`→FRED DGS10, `vix`→FRED VIXCLS, `fearGreed`→CNN F&G scrape, `cpiHeadline`→FRED
CPIAUCNS, `shillerPe`(the `valuation` band's field)→multpl.com scrape, `nfci`→FRED NFCI),
each with `DERIVED_OF` and cadence entries reconciled in smoke. No mock/curated field is
wired into a voting factor.

**Freshness gating is correct and matches the A1 (v3.58) fix**: `FW_FIELDS=["marketHeadline"]`
is the only field the 5 Whys gates for itself — the six factor rows already carry their own
mode/date/exclusion from `evidenceSet.factors`, so there's no second freshness check to drift
from the first. `freshSet` is keyed on `liveBuild` (not `anyLive`), which is the fix that
stops a LOADING/ERROR live build from narrating mock SPY/CPI/Fed as "today's tape" — verified
in code, matches the documented behavior.

**The materiality allowlist (WHY #3 headline gate) is correctly wired**: `isMacroMaterial`
is imported from `src/headlines.js` (the v6.1.0 single-table home), applied ONE-WAY (a
non-matching headline withholds, never rewrites or scores), and the ranked top-3 items are
each independently re-checked material before rendering — a stored KV artifact from before
the ranker can't sneak a non-macro title into the slot.

**No defect found.** This is a clean bill of health: the 5 Whys narrates exactly the six
canonical voters, from exactly the sources the project's own architecture doc says they
should come from, gated by exactly the freshness/materiality rules the changelog says were
fixed (A1/v3.58, v3.51, v6.1.0), and it is covered by the full smoke/render/public-render
suite that passed cleanly above. If there's a place to spend audit attention next, it is not
here — the dashboard's core "5 Whys" honesty layer is the most heavily tested, most
frequently defect-hunted surface in the whole project, and it shows.

## 2. Problem statement & goal — unchanged

Per `README.md` / `CLAUDE.md` header: *"one responsive URL, mobile-primary, that answers
'is it safe to be in the market?' from live macro + market + sentiment data."* Confirmed
still the stated mission; nothing in the last ~15 releases (v5.8 → v6.3) touched the goal —
all of it is presentation, trust-layer and explainability work in service of the same
six-factor backdrop that has been the answer engine since v3.43 (NFCI arrival) / v5.10.0.

## 3. What has materially changed (recent arc, v5.8 → v6.3.0)

The last stretch is a coherent through-line: **make the one answer legible to someone with
zero context, without moving the engine underneath it.**

- v5.8–v5.9: Fact Sheets (tap any parameter → plain-English explainer), "First Glance"
  density cuts, verdict self-explanation for newcomers.
- v5.10.0–v5.97.x: Engine 0 hardening (rate-path fail-open closed, RS thin-evidence
  withhold, 10Y burst term, 30Y as a 7th *non-voting* Engine 0 check), Kalshi key auth
  (PKCS#1/PKCS#8), dead-markup excision, REFRESH button relabel bug.
- v6.0.0 "CLOSE THE LOOP": **one** `macroGate()` derivation (killed the collapsed
  `stance().k` alias that could never say HODL/RESTRICTED correctly), freeze-retry
  resilience, the Monday CPI/NFCI feed-hole fix (per-field last-good), Power alerts
  persistence.
- v6.0.1–v6.0.2: public-view UX pass — shape-before-text, a legible Simple/Power toggle,
  footer collapsed behind one dropdown, strip voter markers wear their actual vote color.
- v6.1.0 "RANKED HEADLINES": the news slot stops reading the first item of one feed and
  ranks across four wires by a curated macro-weight table, fully instrumented.
- v6.2.0 "THE CLOSE READ": a second, explicitly unscored 6pm ET read beside the frozen
  10am call — closes the "should we run twice a day" question with a real answer (no,
  same-day data isn't available at 4:30, but 6pm has a genuine second look).
- v6.3.0 "EIGHT SHEETS": every macro-strip tile (not just the cards) now opens its own
  explainer — the last "hover-only, unreachable on touch" defect from the v3.73 audit,
  closed.

Net effect: the six-factor engine and its data sources are **unchanged** since v3.43/v5.10.0;
everything since has been (a) closing gaps in what the engine can see (30Y, NFCI, credit
tail, Sahm rule — all non-voting or carefully majority-corrected) and (b) making the existing
answer reachable and explainable at every altitude (strip → card → sheet) for a reader with
no background.

## 4. What's missing / open — reconciled against later closures

A background sub-agent read all of `ticker-terminal/*.md` and `harness/*.md` cold (without
the changelog) and flagged everything those documents call open. Cross-referencing that list
against what CLAUDE.md's later entries actually closed:

**Already closed since the audit docs were written** (no action needed):
`V5_SYSTEM_AUDIT`'s governor-flip item (closed v5.0.0 "THE CARD GOVERNS"), the three named
drift lints RUNWAY_SPLIT/TARGET_STALE/LABEL_DRIFT (built v5.0.0 W3), the freshness-doctrine
unification (v5.0.0 W2), `VALUE_PROPOSITION_AUDIT`'s Critical #1 (ET/UTC rollover — closed
v3.49 FIX-A `etYmd`), Critical #2 (green pick despite missing gates — closed v3.49 FIX-B,
hardened again v5.1.1/v5.1.0), the "notifications not wired" alert-theater finding (closed
v3.52 FEAT-ALERT-EVAL), and the outcome-calibration gap (closed v5.6.0's ATTEST/outcomes
layer + v3.100 FEAT-TT-ALLOC receipts).

**Verified still open, directly in current code** (checked against live `public/admin.html`,
not just doc text):

1. **10 keyboard-unreachable `<span onclick="openCard(...)">` sites** remain in
   `public/admin.html` (lines incl. 1356, 1388, 1441, 1892, 4060, 5141, 5382, 5488, 5666,
   6235). The project's own v5.97.4 audit named this ("five surviving span-onclick openCard
   sites... keyboard-unreachable") and filed it as "not fixed" — the count has since grown to
   10 as new features (MAGS, cluster members, the sell-block pick chips) reused the same
   unconverted pattern instead of the `button.linklike`/`Explainable` convention the rest of
   the terminal uses. This is the exact defect class (v3.42 "the tap target is the parameter,
   not an affordance to hunt") the project has fixed everywhere else.
2. **`hzDeckChip()`'s inline `auto`/`nearest` quick-picker buttons have no tap-target floor**
   — `button.linklike` (their only class) carries `padding:0` and no `@media(max-width:480px)`
   rule sizes it, unlike every other interactive row in the terminal (`.tabs .tab` 40px,
   `.fdr-row` 44px, `.chip` 40px, the full picker's `.hzb` 40px). Also filed "not built" at
   v5.97.4/v6.0.0, still true today.

**Stated as intentionally open (owner-declined or deferred, not a defect):** DST automation
for the Worker's cron strings (still a twice-yearly manual TOML edit — the v6.2.0 entry
itself flags that the summer and winter strings are byte-identical to a *different* trigger's
documented string, a real confusion risk if the manual edit is ever skipped or fat-fingered);
new regime factors / LEV as a voter / more explainer prose (owner ruled out of scope for v6).

**Cannot verify from this repo** (KV-only content, not committed): whether the FINANCIALS P3
mode (SOFI/NU/HOOD, engine built in v5.0.0 W4) has had its actual data filled in "post-reset,"
whether the NVDA falsifier hinge count was dropped from 9 to 8 before its 8/26 print per the
owner's own todo, and how many of the 23 PROVISIONAL-capped score records have since been
promoted. These are terminal-operator tasks, not code — worth a manual check in `/admin.html`
if the maintainer wants ground truth, but outside what a repo audit can confirm.

**Real, still-open capability gaps** (named in `VALUE_PROPOSITION_AUDIT`, not contradicted by
any later closure I could find): no tax-lot-aware funding logic beyond the ST/LT date split
added in v3.100 (`pos.lots[]` — "tax lots are not [measured]" per v3.38's own honesty note),
no option Greeks/current-value on screenshot-entered legs, no portfolio-level
correlation/cluster-risk model beyond the single `board.clusters` flag.

## 5. Highest-leverage short next move

Given the macro dashboard itself has **no open defect** (the 5 Whys, its actual data sourcing,
and the whole engine are clean and fully tested) and the TT terminal's structurally important
gaps (governor flip, gate hardening, alert wiring, outcome scoring) are already closed, the
remaining leverage is concentrated in a small, well-scoped, low-risk fix that the project has
already diagnosed and filed twice without acting on it:

**Fix the two verified keyboard-reachability gaps in `public/admin.html`** (item 4.1–4.2
above): convert the 10 `<span onclick="openCard(...)">` sites to real `<button class="pick">`
(or reuse the existing `.linklike`/`button` conversions already used at the other ~15
`openCard` call sites in the same file) and give `hzDeckChip()`'s quick-picker buttons the
same `@media(max-width:480px){min-height:40px}` treatment `.hzb` already gets.

Why this over the deeper capability gaps (tax-aware funding, Greeks, correlation risk): those
are each their own multi-day scope with real design decisions (the project's own convention:
"a change to order-gating eligibility... deserves its own plan and its own approval"). The
a11y fix is mechanical, touches presentation only, has zero risk to any order-gating or
scoring contract, is fully covered by the existing `test/render.mjs` Chromium harness (which
already proves keyboard-Enter activation on the converted sites elsewhere in the same file),
and closes a debt item the project's own audits have now named twice (v5.97.4, then re-noted
at v6.0.0) without landing a fix — exactly the kind of "filed, not built" item that rots if a
third audit just re-files it a third time.

**Implementation sketch** (small enough to do in one pass, one commit):
1. Replace each `<span ... onclick="openCard(...)">` with `<button type="button" class="pick"
   onclick="openCard(...)">` (or the plain unstyled `.linklike` button where the span carried
   no `.pick` styling), preserving existing inline styles/titles.
2. Add `.linklike[data-hz]{...}` or extend the existing `@media(max-width:480px)` block to
   include the `hzDeckChip()` buttons at a 40px min-height (matching `.hzb`).
3. Re-run `REQUIRE_BROWSER=1 npm run test:ui` and add 2 new assertions (one per site class)
   proving keyboard-Enter reaches `openCard`/`setHorizon` on the converted elements — the same
   pattern already used for the v3.42 conversions in this file.
4. One commit, `npm run gates` clean, update CLAUDE.md's changelog per house convention.

This is scoped small on purpose: it is the one item in this audit that is (a) verified still
present in code today, (b) already flagged twice by the project's own process, (c) fully
testable with the existing harness, and (d) zero-risk to the order-gating/scoring contracts
the project is most careful never to touch casually.
