# 2026-09-18 — scheduled audit: repo review, 5 Whys cross-check, gap analysis

Automated/scheduled pass. Same trigger and scope as the 2026-09-10 audit
(`working/2026-09-10-scheduled-audit.md`): review the repo (incl. `ticker-terminal/*.md`), audit
`computeFiveWhys` and cross-check its data sources against the documented requirements, then
review the macro dashboard's problem statement/goal, what materially changed since the last such
pass, what's missing, and the highest-leverage next move.

## 1. Repo state at the start of this pass

- Branch `claude/relaxed-babbage-tiobwu` was bit-identical to `origin/main` (`7cfb1ef`, v6.8.6
  "PUBLIC TERMINAL SKIN"), clean working tree.
- `node_modules` and the Chromium browser both needed installing in this container (same
  situation the v3.69 and 2026-09-10 entries record happening before) — done this pass, which
  is what let all three test suites run for real instead of skipping.
- **`npm run gates` was GREEN before any change**: 2525 smoke + 335 render + 376 public-render +
  `audit:prod` clean (0 vulnerabilities) — matching v6.8.6's own changelog claim exactly, so
  nothing in the tree had drifted from its documented state. This is the opposite starting
  condition from 2026-09-10, where the FOMC tripwire was red; this pass is maintenance, not a
  fire drill.

## 2. `computeFiveWhys` audit — architecture vs. documented requirements, read fresh

The prior audit (2026-09-10) concluded the module matched v5.4.0's "Why This Call" contract and
found no defect. Rather than take that on faith, this pass re-read `src/fiveWhys.js`,
`src/sections/FiveWhys.jsx`, `src/regime.js`, `src/evidence.js` and the call site in
`src/dashboard.jsx` directly — and the module has in fact **moved** since that note was written,
so re-reading was the right call.

**What changed since 2026-09-10** (both already merged onto `main`, neither material to the
engine): v6.6.1 "ONE ENGINE, TWO ALTITUDES" (owner: *"the whys were intentionally higher level
for simple mode... same for degen"*) split the single `simpleWhys`-flavored generator into two
explicit functions, `simpleWhys(x)` and `degenWhys(x, data, opts)`, sharing ONE computed row set
(`x = {label, direction, withheld, bull, bear, neutral, active, total, required, supports,
risks, balances, excluded, confidence, call}`) built once in `computeFiveWhys` — so Simple and
Degen answer the same five questions from the same numbers at two different reading altitudes,
never two derivations. Then 99ea2fe (2026-09-17, "Audit public copy for beginner clarity and
decision relevance") tightened WHY #3's transmission-phrase wording (`"— one reason the backdrop
supports risk"` → `"— can support stocks"`, and similarly for the risk side) — copy only, no
architecture or data-source change; verified against `working/2026-09-17-public-copy-audit.md`
and the diff itself (8 lines changed in `src/fiveWhys.js`, wording only).

**Cross-checked against the documented six-factor contract, all confirmed live in code today:**
- `CHANNEL` in `fiveWhys.js` (`tenYear, vix, fearGreed, cpiHeadline, valuation, nfci`) matches
  `REGIME_BAND_TABLE`'s six `key:` entries in `src/regime.js` **exactly** — grepped both files
  directly this pass rather than trusting the prior note's transcription.
- `dashboard.jsx` still hands `computeFiveWhys` the canonical, once-built rows:
  `factors: evidenceSet.factors, flips: evidenceSet.flips?.flips, call: dailyCall` — the same
  `evidenceSet` the hero, the Drivers matrix and the strip render. One derivation, confirmed at
  the call site.
- `isMacroMaterial` is still `import`ed from `src/headlines.js` (re-exported for backward
  compatibility), never a second allowlist — the materiality gate stays one-way: a non-matching
  headline is withheld and says so, never scored or rewritten.
- The A1 fix (freshness keyed on build **intent** `liveBuild`, not `mode`) is unchanged: a
  LOADING/ERROR live build narrates nothing from mock; a genuine demo build narrates everything.
- CPI/Fed series are still the v5.4.0/v3.99.0 corrections: `functions/api/snapshot.js` pulls
  `CPIAUCNS`/`CPILFENS` (official BLS NSA) for the CPI vote, `DFEDTARU`/`DFEDTARL` (daily target
  range) lead the Fed strip ahead of the lagging `FEDFUNDS` monthly average.
- `FiveWhys.jsx` stays presentation-only (imports no computation/hook/storage), degrades to a
  hidden empty div on a missing `fw` prop (Property 9), and the regime-state line stays outside
  the v3.92 collapse (a red/amber fact must survive a collapse, per v3.25).

**No defect found in the module's logic, data sources, or wiring.** One thing WAS found and
fixed — see §4 — but it was presentation typography (a leftover 8-9px literal), not a
data-source or requirements defect.

## 3. Macro dashboard — problem statement, goal, key drivers (unchanged)

**Problem statement / goal**, unchanged since early versions: *"is it safe to be in the
market?"* — one responsive, mobile-primary URL answering that from live macro + market +
sentiment data, honestly degrading (never fabricating a live number or a directional call from
mock/stale data), at $0 marginal data cost.

**Key drivers (the six-factor public backdrop, `REGIME_BAND_TABLE`)**, unchanged in membership
since NFCI joined as the 6th voter (v3.43): 10Y direction · VIX level · CNN Fear & Greed · CPI
trend · Shiller CAPE valuation · Chicago Fed NFCI. Strict-majority vote, quorum ≥4/6 live else
`INSUFFICIENT`→`DATA HOLD`, asymmetric TAILWIND-withhold when the crash gauges aren't both
current. Non-voting context accreted around those six (30Y/10s30s spread, CCC junk tail, Sahm
rule, AI Unit Economics) is likewise unchanged since the last pass.

## 4. What has materially changed since 2026-09-10 (v6.3.1 → v6.8.6)

The entire arc since the last audit is the **"PUBLIC TERMINAL SKIN"** redesign (v6.4.0 →
v6.8.6, plus v6.5.x–v6.7.x TT-terminal/spotlight work on the same shared version-number space)
— again almost entirely presentation, not engine change:
- v6.4.0: "ONE CALL, TWO VOICES" — Simple gets plain BULLISH/HOLD/BEARISH, Degen keeps the moon
  vocabulary; one market clock.
- v6.5.0–v6.5.6: Stock Spotlight widget (NBIS + rotating Mag-7 name), progressively densified
  down to a "flash card" for Simple.
- v6.6.0–v6.6.4: API palette upgrades (Tiingo, Nasdaq/Zacks, Alpha Vantage) feeding the
  **ticker-terminal**, not the public 6-factor engine; company-value explainer popups.
- v6.7.0–v6.7.3: FEAT-TT-LADDER — the full two-year ranked/gated/printable ticker ladder, then
  its server-receipt reconciliation (v6.7.2's retraction is a good example of this project's own
  rigor: a claimed defect was re-investigated and found not to exist, and the retraction is
  recorded rather than quietly dropped).
- v6.8.0–v6.8.6: the token bridge + one-row header, then a slice-by-slice type-floor lift across
  the macro strip, Simple cards, the Spotlight, the Degen hero, the fold toggle, and finally a
  **source-level test** (the PENDING sweep) so the whole pass can't silently regress.

**Net effect on the 5 Whys / 6-factor engine specifically: still none.** The engine has been
architecturally stable since v5.4.0 + v3.43.1 (NFCI); every release in this window is
presentation, the TT terminal, or the type-floor campaign.

## 5. What's missing / open items (ranked)

1. **[Fixed this pass, v6.8.7]** `src/sections/FiveWhys.jsx` was 1 of the 12 files still on the
   v6.8.6 type-floor `PENDING` list (5 sub-10px literals: the regime eyebrow at 9px, four
   WHY-label/caption lines at 8px). Lifted to the established anatomy — tracked uppercase labels
   → `fs-s` (11), sub-line captions → `fs-xs` (10), matching exactly how MacroStrip/RegimeBand/
   SimpleCards were lifted in v6.8.1–v6.8.4 — and removed from `PENDING`. This is directly the
   file this pass's own 5-Whys audit was reading, so fixing it in the same pass kept the two
   halves of the task (audit + implementation) pointed at the same surface. Verified: all four
   gates green before and after, same assertion counts (2525/335/376), no content/copy/logic
   changed — `git diff --stat` touches only `fontSize:` values.
2. **Highest-leverage next move, ranked #1: continue the type-floor sweep.** 11 files remain on
   `PENDING` — `dashboard.jsx`, `AIUnitEconomics.jsx`, `Alerts.jsx`, `CallBanners.jsx`,
   `DataHealth.jsx`, `DriversMatrix.jsx`, `Headwinds.jsx`, `SignalQuality.jsx`,
   `TerminalDock.jsx`, `Watchlist.jsx`, `WhatChanged.jsx`. Per v6.8.5's own count, the bulk of
   the remaining sub-10px leaves live in Watchlist + Alerts (34) and Signal Quality (8), so
   those two are the next highest-yield files if a future pass wants to keep closing acceptance
   item 3 ("zero fontSize below 10px", still explicitly NOT claimed for Degen as a whole). This
   is bounded, mechanical, fully covered by the existing source-level sweep test plus three
   browser suites, and carries near-zero risk of touching logic — the same shape of work this
   pass just proved out on `FiveWhys.jsx`.
3. **Owner-only, unverifiable from here (carried forward unchanged from 2026-09-10):** the eight
   2027 FOMC dates in `FOMC_MEETINGS` are still flagged ASSERTED-NOT-OWNER-CONFIRMED.
   `federalreserve.gov` is still unreachable from this build environment's proxy (not re-tested
   this pass since nothing changed to suggest it would now succeed, and the tripwire has ample
   runway — last date `2027-12-08`, ~15 months out — so there is no urgency). Recommend a human
   spend five minutes confirming against the Fed's own calendar page next time someone is in
   this file for another reason.
4. **Cosmetic backlog, explicitly filed-not-built, unchanged since 2026-09-10:** five span-onclick
   `openCard` sites in TT DESK strips (keyboard-unreachable), the `hzDeckChip` inline control's
   thumb-target size. Neither touches the public macro dashboard.
5. **DST watch, now closer:** the Worker's five cron strings are hardcoded for EDT and must
   shift +1h in both `wrangler.toml` and `cron.js` for standard time. US DST ends 2026-11-01 —
   about 6.5 weeks from this pass. Not due yet; the next scheduled audit inside that window
   should check it explicitly, since a missed shift silently mistimes the 8am pre-warm, the 10am
   force-refresh and the 6pm close read by an hour.
6. **The recharts axis `fontFamily` leak and the max-width container** — both named as
   "deliberately NOT done" across many releases (v6.8.0 onward) and never picked up. Low
   priority; recorded here only so a future pass doesn't have to re-discover they're still open.

## 6. Highest-leverage next move

**Already executed as the highest-leverage move available to an unattended pass with a
currently-green gate**: closed one item (`FiveWhys.jsx`) on the project's own self-documented,
test-enforced backlog (the type-floor `PENDING` list), chosen specifically because it is the
same file this pass's 5-Whys audit was already reading line-by-line, so no extra context cost
was paid to find and verify it. Fully gate-proven before commit.

**Next highest-leverage move for a follow-up pass (human or scheduled)**: continue the
type-floor sweep on `Watchlist.jsx` + `Alerts.jsx` (34 of the ~54 remaining sub-floor leaves per
v6.8.5's own count) — same mechanical pattern, same test coverage, bounded risk. Behind that,
the owner-only FOMC 2027 date confirmation (item 3) is the one open item nobody but the owner
can close from here.

## Outcomes

- `src/sections/FiveWhys.jsx`: 4 sub-floor `fontSize` literals (9px eyebrow, 8px×3
  labels/captions) lifted to `T.fsS`/`T.fsXs` tokens.
- `test/smoke.mjs`: `FiveWhys.jsx` removed from the v6.8.6 type-floor `PENDING` list (12 → 11),
  per that test's own "a cleaned file must be deleted from PENDING" rule.
- `package.json` / `package-lock.json` / `public/admin.html`: version bumped `6.8.6` → `6.8.7`
  in all three homes together (the smoke pin that reconciles them).
- `CLAUDE.md`: v6.8.7 changelog entry added above v6.8.6, in voice.
- Verified: `npm run gates` — **2525 smoke + 335 render + 376 public-render + `audit:prod`
  clean** — both before this pass's one change and after, with the two new/changed assertions
  (the type-floor sweep's dirty-file check and its PENDING-hygiene check) explicitly confirmed
  PASS by name, not just by aggregate count.
- No defect found in `computeFiveWhys`, its data sources, or its wiring to `evidenceSet`/
  `regime.js`/`headlines.js`. No engine, threshold, vote, or requirement changed.
