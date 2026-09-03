# 2026-09-03 — scheduled audit: repo review, 5 Whys data cross-check, gap review

Automated recurring audit. Scope per the trigger: review the repo (incl. `ticker-terminal/*.md`
and `harness/*.md`), audit `src/fiveWhys.js` and cross-check its data sourcing against the
documented requirements, re-state the problem/goal, note what materially changed, and name the
highest-leverage short next move.

## Problem statement / goal (unchanged)

`CLAUDE.md` / `README.md`, verbatim: MacroDash is one responsive URL, mobile-primary, that
answers **"is it safe to be in the market?"** from a live six-factor macro backdrop (10Y
direction · VIX · Fear & Greed · CPI trend · Shiller CAPE · NFCI) rendered as a human call
(MOONING/HODL/DIAMOND HANDS) and a machine call (BULLISH/NEUTRAL/BEARISH), with a separate
order-gating terminal (`/admin.html`, TT) consuming the same public evidence as one of several
permission gates. Nothing in this pass found drift from that statement — the six-factor set,
the two-vocabulary projection, and the terminal/dashboard separation ("married never merged")
are all intact in the current source.

## What materially changed (last 3 releases, all shipped + CI-green on `main`)

- **v6.0.0 "CLOSE THE LOOP"** — collapsed the dashboard's `macroGate()` back onto the server
  ladder's own primitives (fixing a real RESTRICTED→HODL misread), added freeze retry +
  heartbeat coverage for the 10am capture, and closed a Monday CPI/NFCI feed-hole class.
- **v6.0.1 / v6.0.2** — two passes of owner-driven UX review (`working/2026-09-02-public-view-ux.md`):
  shape-before-text on Simple cards, Simple↔Power toggle clarity, clock captions moved one tap
  deep, and the footer + macro-strip vote marker collapsed/recoloured. **Presentation only** —
  no vote, band, quorum, or gate moved in either release.
- Verified via GitHub Actions rather than assumed: workflow run **#143** (`test.yml`, commit
  `8f3ae55`, v6.0.2) is `completed`/`success` on `main` — so the claimed **309 render + 253
  public-render** assertions actually ran in real Chromium, not just the smoke suite this
  sandbox can execute locally. Local `npm test` at the same commit: **2183/2183 smoke green**;
  `npm run test:ui` skips cleanly (no Chromium in this sandbox — expected, additive suite).
- No open PRs, working tree clean, `claude/relaxed-babbage-6yk79g` == `main`.

## 5 Whys audit — data sourcing cross-checked against requirements

Read `src/fiveWhys.js`, its caller (`src/dashboard.jsx:590-670`), `src/macroCall.js`, and
`src/evidence.js`/`src/regime.js` (the single source of the six-factor vote). Findings:

1. **Six canonical voters, one derivation.** `computeFiveWhys` never reads raw snapshot fields
   itself — it takes `factors` from `evidenceSet.factors` (via `dailyCall`/`call.factors`),
   which `evidence.js:buildEvidenceSet` derives from `regimeFactors()` in `regime.js`, which
   votes from `REGIME_BAND_TABLE` — the *same* table the hero, macro strip, and `/readout.json`
   read. There is no second copy of a threshold or a vote anywhere in the Whys path. This
   matches the documented "one derivation, many altitudes" rule (`ptModelRows` doctrine,
   applied here to the public engine).
2. **Frozen-call correctness.** `dashboard.jsx:592-593` selects `dailyCall = callFrozen ?
   publicCall : currentCall` before it ever reaches `computeFiveWhys`, and `callFrozen` also
   flows through as `opts.callFrozen` to gate the WHY #1 session prefix ("10am call —" vs.
   pre-open/midday/post-close). This is the v5.3/v5.5 accountability contract holding: the
   Whys narrate the *scored* immutable call, not a live recomputation, when one exists for the
   day — verified against the live smoke section `[74]`-adjacent history/outcome tests, all
   passing.
3. **Freshness gating (A1, v3.58/v3.94).** `freshSet` is keyed on `liveBuild` (build intent),
   not `anyLive` (current mode) — so a LOADING/ERROR live build passes an *empty* set and every
   WHY clause degrades honestly ("0/3 core inputs usable"), while a demo build still narrates
   mock as its baseline. Confirmed this is still the live wiring, not a stale comment.
4. **Macro-materiality filter (v3.51).** `isMacroMaterial()` is a one-way allowlist gating
   WHY #3's headline clause; a non-matching headline is withheld and says so rather than being
   presented as the driver. `deent()` decodes numeric HTML entities at *both* fetch and render
   time (the v3.98.2 fix for a headline already sitting in KV pre-fix) — present and correct.
5. **Transmission channels (WHY #3, v5.8).** `WHY_IT_MATTERS` has an entry for all six factor
   keys (`tenYear, vix, fearGreed, cpiHeadline, valuation, nfci`) — none silently missing, so no
   directional factor can render with no explanation.
6. **Nearest flip (WHY #5, FEAT-FLIP v3.53).** Reads `opts.flips[0]` verbatim from
   `flipConditions()` — no re-derivation, no invented threshold; compound-vote factors (CPI
   trend shape, CAPE two-condition OR) correctly abstain rather than fabricate a crossing.

**Conclusion: no defect found in the 5 Whys data path.** Every data-sourcing rule the
changelog documents for this module (v3.51 materiality, v3.58/v3.94 freshness, v3.98.1/v3.98.2
voice + entity decode, v5.3/v5.5 frozen-call narration) is live in the current source and
covered by passing smoke assertions. This is a clean audit, not a gap list — recorded here so
the next pass doesn't have to re-derive it.

## What's missing — compiled from the repo's own filed-not-built record

Nothing new found this pass; the gap list is the union of what earlier owner-directed audits
already named and explicitly deferred, still true against current source:

| Item | Filed at | Verified still open | Severity |
|---|---|---|---|
| 10 `<span onclick="openCard(...)">` pseudo-links in `admin.html` (DESK rows, cluster members, sell/pick chips) are keyboard-unreachable — a real click target with no keyboard path | v5.97.4 audit ("five surviving span-onclick `openCard` sites"), filed again v6.0.0 | **Yes** — grep confirms 10 sites at HEAD, e.g. `admin.html:1356,1388,1441,4060,5141,5382,5488,5666,6235,1892` | Medium (a11y correctness; same defect class the v3.42 `button.linklike` conversion already fixed everywhere else in the same file) |
| `hzDeckChip()`'s inline `auto`/`nearest` quick-picks render as 9.5px text with no tap-target sizing (no `min-height`, no ≥40px rule) | v5.97.4 audit ("hzDeckChip inline auto/nearest measuring 27×10px at 390px") | **Yes** — `admin.html:6083-6090`, still plain `.linklike` buttons with no size override, unlike every other touch surface in the file (40px @ ≤480px is the house rule since v3.42) | Medium (mobile usability regression relative to the rest of the terminal) |
| Footer link tap sizes | v5.97.4 audit, filed | Not re-checked this pass (lower priority than the two above) | Low |
| Power hero states the disagreement twice (NEUTRAL line duplicates the sentence beneath it) | v5.9/v6.0.1, **locked owner ruling** — deliberately left alone | N/A — not a gap, an owner decision | — |
| Simple "why this call" chip wraps to 2 lines at 390px when the flip-condition text is long | v6.0.1 audit, filed as a copy call | Cosmetic only | Low |
| FED tile's `avg` label is jargon explained only on hover | v6.0.2 audit, filed | Cosmetic only | Low |
| DST cron shift is a **manual** twice-yearly edit (`worker/wrangler.toml` UTC crons vs. ET) | CLAUDE.md file-structure note, "⚠️ update annually"-style risk; named out-of-scope for v6 by owner ruling | Standing operational risk, not a code gap | Medium (silent-miss risk twice a year, zero automated guard) |
| Ticker-terminal capability gaps: outcome calibration/benchmarking, portfolio factor-correlation risk, option Greeks/assignment exposure, tax-aware funding, clickable evidence citations, operational alerts, broker-sync automation | `VALUE_PROPOSITION_AUDIT_2026-07-31.md` / `V5_SYSTEM_AUDIT_2026-08-23.md`, explicitly deferred, feature-scale | Still open; correctly scoped as "owner to prioritize," not a bug | Feature-scale, out of "short move" range |

## Highest-leverage short next move

**Convert the 10 `<span onclick="openCard(...)">` pseudo-links in `public/admin.html` to real
`<button class="linklike">` elements**, matching the conversion the file already did for every
other actionable inline control (`v3.42 Slice 2`: *"Span-onclick pseudo-links in the driver
blocks became `button.linklike`"*). This is the single most concrete, still-open, low-risk
correctness gap the repo's own audits have already scoped and priced (found in the v5.97.4
audit, re-filed unchanged through v6.0.0-v6.0.2) — everything else on the table is either an
owner-locked decision, a cosmetic wrap, or feature-scale.

**Why this over the tap-target fix:** both are real and small, but the keyboard-reachability
gap is a correctness defect (some users structurally cannot activate these controls at all),
while the tap-target sizing is a usability regression (harder to hit, but still clickable) —
higher severity for comparable effort. Do both in the same pass if time allows; they touch the
same file and the same `linklike` idiom.

**Implementation plan (not yet built — this pass is audit-only):**
1. At each of the 10 sites, replace `<span ... onclick="openCard('SYM')">SYM</span>` with
   `<button type="button" class="linklike" onclick="openCard('SYM')">SYM</button>`, preserving
   existing inline `style`/`title` attributes and the `find(sym)`-gated conditional rendering
   (unfound syms must keep rendering as inert text, per the "a button that does nothing is a
   lie" doctrine already enforced elsewhere in this file).
2. Confirm `.linklike` CSS renders inline (no block-level layout shift) at each site — the class
   already exists and is used elsewhere, so this should be a no-op visually; verify at 390px and
   1200px per the existing render-harness convention.
3. Extend `hzDeckChip()`'s `quick()` buttons with the house 40px-at-≤480px tap-target rule
   (a media-query bump, matching how `.pick`/`.chip` sizing is handled elsewhere) if bundled in.
4. Add render-suite coverage: a real keyboard `Tab` + `Enter` reaching one of the converted
   sites and opening the card (the existing precedent — v3.42 Slice 3 already does this for the
   tab strip and chips), so the fix is proven rather than asserted.
5. Bump `package.json` version, update `CLAUDE.md` with a dated entry naming the fix and the
   before/after grep count (10 → 0), run `npm run gates` (all four suites), and only then
   commit — per the repo's own release discipline (every entry in `CLAUDE.md` records what
   was measured, not what was intended).

Estimated size: small (single file, mechanical per-site edit + one CSS rule + a handful of new
render assertions) — a good fit for "highest-leverage short next move."

## Notes on this pass

- No code was changed. This is an audit + plan, matching the task's own instruction not to
  implement without review, and the project's "findings live on the branch" convention
  (`CLAUDE.md`, per-pass protocol).
- `npm run test:ui` / `npm run test:public` skip cleanly in this sandbox (no Chromium
  installed here) — cross-checked against CI run #143 on `main` instead, which is green.
