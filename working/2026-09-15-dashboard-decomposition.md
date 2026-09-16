# dashboard.jsx decomposition — verified baseline + Phase 0–4 (2026-09-15)

Owner supplied a "Line-by-Line Decomposition & Cleanup Map" and asked for the baseline to be
VERIFIED and the extraction planned "without removing the core drivers and functionality".
Two read-only passes (file anatomy; every smoke/render pin that reads `dashboard.jsx` as
source text) found the map directionally right and wrong on the details that decide risk.

## Baseline corrections (map vs. `204eda5`, v6.5.4)

| Map claim | Verified fact |
|---|---|
| 1,232 lines / 92KB | 1,296 lines / 95,026 bytes |
| MOCK_DATA 64–162 | `const MOCK_DATA = {` 60–154, NOT exported; sole consumer is the `useMarketData` call |
| Alert engine 361–434, "depends on sources.js" | 331–419; `evalAlert` depends only on `ALERT_METRICS` + the injected `modeOf`. No sources.js import |
| `useCountdown` feeds an IPO strip | DEAD — no IPO strip exists (1 occurrence repo-wide). Also dead: `peColor`/`marginColor`/`yoyColor`, the entire recharts import, `SectionHeader`, `Label`, `ILLUS_HATCH`, `IllustrativeChip`, `isStale`, `cadenceOf`, `NFCI_TIGHT/LOOSE`, `REGIME_BAND_TABLE`, `REGIME_QUORUM`, `verdictFrom/computeRegime/flipConditions/regimeFactors`, `SourceBox` default (comments only) |
| Header 871–1040 | `<header` 881–1024 |
| Drivers matrix 1196–1230 | 1128–1162 |
| `<style>` 801–870 | 816–870, a template literal over `T.*`/`DT["focus-ring"]` — a `.css` file would be a SECOND COPY of token values |
| Zones 1/2/3/6 "Risk: None" | each is pinned by smoke AGAINST `dashSrc` specifically: MOCK_DATA is brace-count-sliced + `eval` (smoke 113–116 — a moved marker CRASHES the suite mid-run, no total printed); `evalAlert`/`ALERT_METRICS`/prefs are `new Function` source-lifts (3933–3939, 3995–3998) and pin 6253 asserts the definitions live in dashboard.jsx; `SpyTapeBadge`'s internal `TODAY SPY` string is pinned against dashSrc (11396); the drivers matrix's `const vc=T[voteStyle(f.vote).colorKey]` / `evidenceSet.factors.map(f=>` / the "used in today's posture" label are pinned against dashSrc (4739–4740, 4778–4781, 5156) |
| docs/RISKS.md | A4 explicitly says MOCK_DATA stays in dashboard.jsx and "moving it is its own decision" — owner decided 2026-09-15: MOVE IT, smoke imports it |

Smoke facts that govern every move: `uiSrc` (smoke line 112) concatenates dashboard + 18
UI files — every NEW file must be appended or the `uiSrc` negatives go vacuous (docs/RISKS.md
R1). Presentation-only is enforced per-wave by regex arrays (6100, 6125, 6209, 6248, 10840)
over comment-stripped source; Property-9 empty-state guard + Property-10 bounds (sections
≤300 lines, primitives ≤100) apply only to files named in those arrays. `render.mjs` and
`public-render.mjs` never read dashboard source — extraction is invisible to them while the
rendered DOM is byte-identical.

## Owner decisions (2026-09-15)
- MOCK_DATA moves to `src/mockData.js`; smoke imports it (the C1 regime.js form). A4 rewritten.
- Dead code is DELETED with absence pins (v3.73 rule), not relocated.
- Scope: Phase 0 (dead code) + Phases 1–4. Phases 5–7 FILED (below), not built.

## Phases
0. dead code out · 1. `src/mockData.js` · 2. `src/alertEngine.js` · 3. `UndoToast.jsx`,
`SpyTapeBadge.jsx` (primitives), `CallBanners.jsx` (section) · 4. `sections/DriversMatrix.jsx`
(the `{!simple&&<section aria-labelledby="drivers">` wrapper + h2 STAY at the call site — the
Alerts/Watchlist gate-at-the-wrapper pattern) · 5. version + records.

## Filed, not built (backlog)
- **`useDashboardDerived`** (map Zone 5): re-points ~15 exact-line regexes — smoke 4732–4734,
  6105–6106, 6131–6133, 8382–8385, 8564–8567, 11165, 4567–4569, 4627–4630, plus the
  `indexOf` ordering pins at 2611/6133. Boundary rule if built: computes-data → hook;
  handles-interaction → component. `refreshData` (603–613) is a handler and stays.
- **`DashboardHeader.jsx`** (map Zone 4): ~30 pins — 4048–4053 (`hdr-act` count of 8),
  4585–4589, 4735–4736, 4915–4946 (the OPS slice), 8491–8494, 10083–10088, 10816–10823
  (VIEW_MODES), 11911–11920. Approach A (flat props) as the map recommends.
- **The `<style>` block** (map Phase 5): NOT as `dashboard.css` — the block interpolates
  tokens. If moved, as `src/globalCss.js` exporting `globalCss(T,DT)`; re-points 4236–4240,
  6145, 6288–6296, 10044–10045, 11335, and the `!/[^-]:focus\{/` sweep at 4238.
- `useClipboard` consolidation of the four `*Copied` states: the handlers are regex-pinned
  with `\s*\n\s*` between statements (6311–6320); no functional gain, filed as optional.

## Outcomes
(appended as each phase lands)

## Outcomes (2026-09-16)

Shipped on `claude/dashboard-decomposition-cleanup-5tc56z`, one commit per phase, `npm run
gates` green in real Chromium after Phase 0 and after Phase 4 (smoke after every phase):

| Phase | Commit | dashboard.jsx | New file(s) | Smoke |
|---|---|---|---|---|
| baseline | 204eda5 | 1,296 | — | 2347 |
| 0 dead code | 6ae43a0 | 1,268 | — | 2351 |
| 1 MOCK_DATA | db61de5 | 1,175 | `src/mockData.js` | 2352 |
| 2 alert engine | 5bd315f | 1,090 | `src/alertEngine.js` | 2352 |
| 3 components | bcbe2a9 | 1,003 | `primitives/UndoToast.jsx`, `primitives/SpyTapeBadge.jsx`, `sections/CallBanners.jsx` | 2356 |
| 4 drivers | 172a6f9 | 979 | `sections/DriversMatrix.jsx` | 2358 |

Render 309 and public-render 331 unchanged throughout — the rendered DOM is byte-identical.

**Negative controls (all after Phase 4, each turning exactly one pin red):** a banned
`f.vote==="bull"?T.green` ternary injected into DriversMatrix.jsx → the "BOTH altitudes resolve
through the ONE voteStyle map" sweep (proves the new file is really in `uiSrc`); `evalAlert`
re-declared in dashboard.jsx → the re-pinned wave-12 one-home pin; a `useState` reference
inside alertEngine.js → the same pin's purity half.

**Where the original survey was WRONG, kept beside the plan rather than edited away:**
- The plan said smoke's `_lift` helper (line ~3948) "is dead since v3.60" and could be deleted
  or left. Left — it is dashSrc-bound but harmless; not this pass's scope.
- The plan's Phase 3 expected `MacroFlipBanner`/`PanicOverrideBanner` to need NO Property-9
  guard ("verify each body"). Neither had one — the call-site ladder guaranteed non-null
  inputs. Guards were ADDED (`if(!flip||!flip.inputs)return null;` / `if(!call)return null;`),
  the one non-verbatim addition in Phase 3, and pinned.
- The plan's Phase 4 sketch first wrote "export DriversMatrix({ evidenceSet, simple })" then
  corrected itself in the same line to keep the gate at the call site. Shipped as corrected:
  the component takes `evidenceSet` only.
- The map's "Risk: None" for Zone 3 was wrong in one more place than the pre-plan survey
  listed: the `useCallback` import had to leave with the hook (it had no other consumer), and
  the every-import-is-used sweep added in Phase 0 is what would have caught it if it had been
  left behind.
- Smoke section numbering: the plan reserved `[82]`; `[82]`/`[83]` already existed (v6.5.3/4).
  Shipped as `[84]`.
- The pre-Phase-1 "keep: GPU $/hr, headwinds and the watchlist are untouched" pin was already
  HALF-VACUOUS on the baseline — `dashSrc.includes("GPU_PRICING")` matched only a comment
  (the constant moved to aiEcon.js in wave 12). Re-pinned to the real homes.

**Deliberately not done this pass (owner scope ruling):** Phases 5–7 — see "Filed, not built".
The v6.5.5 CLAUDE.md header entry, RISKS.md A4 and design-system.md carry the record.
