# 2026-09-10 — scheduled audit: repo review, 5 Whys cross-check, gap analysis

Automated/scheduled pass. Scope per the trigger: review the repo (incl. `ticker-terminal/*.md`
and `harness/`), audit `computeFiveWhys` and cross-check its data sources against the documented
requirements, then review the macro dashboard's problem statement/goal, what materially changed,
what's missing, and the highest-leverage next move.

## 1. Repo state at the start of this pass

- Branch `claude/relaxed-babbage-iuvq5j` was **bit-identical to `origin/main`**
  (`d4a1cca`, v6.3.0 "EIGHT SHEETS", committed 2026-09-05). No uncommitted work, no drift to
  reconcile.
- `node_modules` did not exist — `npm install` had never been run in this container (the same
  situation the v3.69 changelog entry records happening once before). Ran it this pass; it is
  what let `test:ui` / `test:public` run instead of skip.
- `npm run gates` (all four) was **RED** before any code change: `npm test` reported
  `2257 passed, 1 failed`. The one failure:
  `fomc: EXPIRY TRIPWIRE — the calendar has >90 days of runway (extend FOMC_MEETINGS if RED)`.
  This is a designed tripwire (v3.99.0), not a regression from other work — `src/sources.js`'s
  curated `FOMC_MEETINGS` table ends at `2026-12-09`, which is exactly 90 days from 2026-09-10.
  The table doing its job: it forces an update pass rather than silently serving a stale
  countdown or letting `/readout.json`'s `fed_next_meeting` go MISSING once the table runs dry.

## 2. Fix shipped this pass (v6.3.1)

- Extended `FOMC_MEETINGS` in `src/sources.js` with the eight 2027 decision-day dates, sourced
  via `WebSearch`/`WebFetch` of the Fed's own "tentative meeting schedule for 2027" press
  release (`federalreserve.gov/newsevents/pressreleases/monetary20250905a.htm`, announced
  2025-09-05). **`federalreserve.gov` and every mirror tried (tickward.com, chicagofed.org) are
  still `EGRESS_BLOCKED` from this build environment's proxy** — confirms the same 403 the
  v3.99.0/v4.1.5 entries already recorded, now also true of `WebFetch`, not just direct `fetch`.
  So this is a **web-search-derived fill, flagged ASSERTED-NOT-OWNER-CONFIRMED** at the array
  itself, in the same posture the original 2026 table shipped under (which the owner then
  corrected two of eight dates on, per the v3.99.1 entry) — never silently upgraded to
  "confirmed" just because it came from a search this time.
- `package.json` → `6.3.1`; `public/admin.html`'s two mirrored version strings moved with it
  (the smoke pin at "version: the terminal's title and brand both match package.json" checks
  this — it would have gone red on a solo `package.json` bump).
- CLAUDE.md changelog entry added, in-voice, above v6.3.0.
- Re-ran `npm run gates` after the fix: **2258 smoke + 309 render + 283 public-render passed,
  `audit:prod` clean (0 vulnerabilities)** — matches the totals v6.3.0's own entry claims,
  confirming nothing else in the tree had drifted from its documented state.

**Owner action still needed:** re-confirm the eight 2027 dates against
`federalreserve.gov/monetarypolicy/fomccalendars.htm` (or the FOMC blackout-period calendar
PDF) once that page is reachable, the same way the 2026 table got its Oct 28 / Dec 9
corrections. The tripwire will not fire again until `2027-09-10`ish (90 days before
`2027-12-08`), so there is no urgency beyond "next time someone is in this file."

## 3. `computeFiveWhys` audit — architecture vs. documented requirements

Read `src/fiveWhys.js`, `src/sections/FiveWhys.jsx`, `src/evidence.js`, `src/regime.js`, and the
call site in `src/dashboard.jsx` (~L500-680). Cross-checked against CLAUDE.md's own history for
this module — there is no separate written "requirements" spec for it; **CLAUDE.md's changelog
IS the requirements record**, and REQUIREMENTS_v2.6.md is explicitly marked
"SHIPPED & SUPERSEDED... do not implement from this document."

**Finding: the module matches its documented contract precisely, and the versions describing a
different ("trader voice") copy style for this exact file are chronologically EARLIER, not
later** — worth recording because CLAUDE.md's changelog is not in strict chronological order top
to bottom (dashboard-line and ticker-terminal-line releases share one `package.json` version
space and collided repeatedly, which the file's own entries document at length). Reading order
that resolves the apparent contradiction: v3.92→v4.0.1's "one voice"/"trader voice" copy passes
were applied to the OLD memo-style 5 Whys (labels like "Live cross-signals:", "Headline
driver:", "Risk register (curated…)", "Net:") — **v5.4.0 "Why This Call" then REPLACED that
architecture outright** ("the former 5 Whys was an unclear mixture of canonical voters,
context-only gauges, one RSS item, and a curated risk register; it did not form a causal
chain"), and v5.4.0 is chronologically **after** the voice-pass block despite its lower-looking
version number, per the parallel-branch version collisions the file documents throughout (see
the "Reconciliation note" inside the v5.6.0 entry). No further voice pass has touched
`fiveWhys.js` since v5.4.0 — the current generic "Support: … Risk: … Neutral: …" phrasing is the
v5.4.0 design, not a regression from the trader-voice passes.

Checked against the v5.4.0 contract point by point, all confirmed live in code:
- **Five checks, exact order**: call arithmetic (`whys[0]`) → actual drivers (`whys[1]`,
  Support/Risk/Neutral from `usableFactors`) → transmission mechanism (`whys[2]`, via
  `WHY_IT_MATTERS`) → evidence quality/provenance (`whys[3]`, confidence + exclusions +
  headline-as-context) → nearest load-bearing change (`whys[4]`, `flipConditions`-derived).
  Labels: `["WHY THIS CALL","WHAT DROVE IT","WHY IT MATTERS","CAN I TRUST IT","WHAT CHANGES
  IT"]` — matches.
- **Six canonical voters, one source of truth**: `WHY_IT_MATTERS` keys
  (`tenYear, vix, fearGreed, cpiHeadline, valuation, nfci`) match `REGIME_BAND_TABLE`'s six
  entries in `src/regime.js` and `evidence.js`'s `FACTOR_FIELD` map exactly (10Y · VIX · F&G ·
  CPI · CAPE(`valuation`→`shillerPe`) · NFCI). `evidenceSet.factors` (built once in
  `dashboard.jsx`, never re-derived by the whys module) is the ONE row source — `computeFiveWhys`
  takes `opts.factors`/`opts.call.factors`, never calls `regimeFactors` itself.
- **Headlines never vote, and materiality is enforced**: `isMacroMaterial`/`parseTopHeadlines`
  import from `src/headlines.js` (v6.1.0's ranked-headline table), not a duplicated allowlist.
  `whys[3]`'s `context` branch is fully gated: `headlineFresh` (from `FW_FIELDS=["marketHeadline"]`
  freshness, keyed on `liveBuild` per the A1 fix — see below) AND `isMacroMaterial(hd.text)`
  before a headline is ever named as "Tracked context"; otherwise it says the item failed the
  relevance filter or that no macro headline passed the gates at all. The 2nd/3rd ranked items
  (`also`) are RE-CHECKED material independently rather than trusted from the stored KV array.
- **The A1 fix (v3.58) is live and correctly wired**: `freshSet` is built from `liveBuild`
  (build intent), not `anyLive`/`mode` — a LOADING/ERROR live build passes an EMPTY set so every
  freshness-gated clause withholds, while a genuine MOCK/demo build passes `null` ("narrate
  everything," matching the demoted()/anyLive doctrine). This is the exact fix the v3.58/v3.98.4
  entries describe and it has not regressed.
- **Frozen-call awareness (v5.3/v5.5)**: `opts.callFrozen` drives the `sessionPrefix` vs
  `"10am call —"` prefix, matching the 8/28 "the prefix is the narration's clock" fix — a
  frozen 10am call is never narrated with the reader's current session ("Post-close —") stamped
  on it.
- **CPI/Fed series match the v5.4.0/v3.99.0 corrections**: `functions/api/snapshot.js` pulls
  `CPIAUCNS`/`CPILFENS` (official BLS NSA series) for the CPI factor voted on, and
  `DFEDTARU`/`DFEDTARL` (Fed's own daily target-range bounds) lead the Fed strip ahead of the
  lagging monthly `FEDFUNDS` average — both exactly as documented, with the mislabel v3.99.0
  fixed still fixed.
- **Structural safety**: `FiveWhys.jsx` is presentation-only (imports no computation/hook/
  storage — the section-extraction contract from v3.73/v5.4 holds), degrades to an empty hidden
  div when `fw` is absent (Property 9), and the regime-state line stays outside the v3.92
  collapse per the v3.25 rule (a red/amber fact must survive a collapse).

**No defects found in this module.** It is the one part of this pass that needed no code
change — smoke section coverage (multiple `[4x]`-era sections reconciling `regimeFactors`,
`FACTOR_FIELD`, and the A1/A13 fixes) already pins every behavior described above; nothing here
contradicts CLAUDE.md's account of it.

## 4. Macro dashboard — problem statement, goal, key drivers

**Problem statement / goal** (README.md + CLAUDE.md's opening line, unchanged since early
versions): *"is it safe to be in the market?"* — one responsive, mobile-primary URL that
answers that from live macro + market + sentiment data, honestly degrading (never fabricating a
live number or a directional call from mock/stale data), at $0 marginal data cost.

**Key drivers (the six-factor public backdrop, `REGIME_BAND_TABLE` in `src/regime.js`)**,
unchanged in membership since NFCI joined as the 6th voter (v3.43): 10Y direction (`DGS10`,
UST-par-yield failsafe since v4.1.5) · VIX level (`VIXCLS`, CBOE delayed-quote failsafe since
v5.1.0) · CNN Fear & Greed · CPI trend (`CPIAUCNS`/`CPILFENS`, corrected v5.4.0) · Shiller CAPE
valuation (`multpl.com` scrape) · Chicago Fed NFCI financial conditions (asymmetric bands,
v3.43.1). Strict-majority vote, quorum ≥4/6 live else `INSUFFICIENT`→`DATA HOLD` (v3.54/
ENGINE0-CONT), asymmetric TAILWIND-withhold when the crash gauges (VIX, F&G) aren't both
current (v3.40/v4.1.6). **Non-voting context that has accreted around those six since**: the
30Y/10s30s spread, the CCC junk-credit tail, the Sahm rule (v3.88 "recession rails" — all
explicitly non-voting, asserted-band, arrival-gated the same way NFCI itself was before it was
promoted), plus AI Unit Economics (GPU $/hr · token $/Mtok · token volume · hyperscaler capex)
as a fully curated, never-voting third pane.

## 5. What has materially changed (recent dashboard-line history, oldest→newest of the recent
run)

The chronologically-recent dashboard-line arc (v5.7.0 → v6.3.0) is **almost entirely
UI/UX and accountability-layer work, not engine change**:
- v5.8–v5.9.x: per-parameter explainer sheets, "First Glance" density pass, newcomer rulers.
- v5.97.x: dead-markup excision, a mislabeled refresh button, Kalshi PKCS#1 key acceptance,
  the 30Y becomes an Engine 0 voter (TT-side, not the public 6-factor vote).
- v6.0.0 "CLOSE THE LOOP": one `macroGate()` derivation, a retriable 10am freeze, the
  Monday CPI/NFCI feed-hole fix, footer/voter-marker cleanup.
- v6.0.2/v6.1.0: footer under a dropdown, ranked ($0, no-LLM) headlines replacing "first item
  of one feed."
- v6.2.0 "THE CLOSE READ": an unscored 6pm ET second read, its own record family, five Worker
  crons.
- v6.3.0 "EIGHT SHEETS": every macro-strip tile (not just cards) opens its own explainer.
- v6.3.1 (this pass): the FOMC calendar tripwire fix above — the first purely-maintenance
  release in this run, and a demonstration that the tripwire pattern (v3.99.0) works exactly as
  designed.

**Net effect on the 5 Whys / 6-factor engine specifically: none of the above changed its
architecture, its inputs, or its band table.** The engine has been stable since v5.4.0 (Why
This Call) + v3.43.1 (NFCI asymmetric bands); everything after has been presentation, the close
read, headline ranking, and TT-terminal (ticker terminal) work on a separate, much larger
parallel track sharing the same version-number space.

## 6. What's missing / open items (ranked)

1. **[Fixed this pass]** `FOMC_MEETINGS` expiry tripwire — see §2.
2. **Owner-only, unverifiable from here:** confirm the eight 2027 FOMC dates just added against
   `federalreserve.gov` directly once it's reachable to the owner (it is not reachable from this
   build environment's proxy for either `fetch` or `WebFetch`).
3. **Operational, unverifiable from here:** v6.2.0's own text calls out two "measure, don't
   assume, on night 1" checks (whether `legs_same_day` behaves as expected for 10Y/30Y/VIX, and
   whether the Finnhub SPY close-read leg reflects extended-hours trades and needs dropping) —
   this pass has no access to live KV/production to check either. Five days have passed since
   ship (2026-09-05→09-10); worth a live spot-check if not already done.
4. **Cosmetic backlog, low priority, explicitly filed-not-built** (from the v6.0.0 entry): five
   surviving span-onclick `openCard` sites in TT DESK strips (keyboard-unreachable), the
   `hzDeckChip` inline auto/nearest control measuring ~27×10px at 390px (below the 44px thumb
   target the rest of the product holds to), footer link sizes. None of these touch the public
   macro dashboard.
5. **DST watch, not yet due:** the Worker's five cron strings are hardcoded for EDT (summer);
   CLAUDE.md flags they must shift +1h in both `wrangler.toml` and `cron.js` for standard time.
   US DST ends 2026-11-01 — about 7 weeks out from this pass, not urgent today but the next
   scheduled audit in that window should check it.
6. **Environment hygiene:** this container had never run `npm install` before this pass (ran it
   here) — worth keeping in mind for any future session that skips straight to `npm test` and
   assumes the browser suites ran when they may have silently skipped.

## 7. Highest-leverage next move

**Already executed as the highest-leverage move available to an unattended pass**: un-red the
gate (§2), since a red `npm run gates` is the one condition this project's own doctrine treats
as never acceptable to leave standing, and the fix was small, mechanical, well-precedented
(identical pattern to v3.99.0/v3.99.1), and fully test-covered before and after.

**Next highest-leverage move for a human/owner pass**: spend five minutes confirming the eight
2027 FOMC dates against the Fed's own calendar page (item 2 above) — cheap, bounded, and closes
the one piece of this fix that a proxy-blocked assistant cannot self-certify. Everything else
found in this pass (items 3-6) is either already-filed cosmetic backlog or a date-triggered
watch item with real weeks of runway — neither is worth interrupting the owner for right now.
