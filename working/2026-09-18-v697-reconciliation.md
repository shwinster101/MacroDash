# v6.9.7 reconciliation

Baseline: freshly fetched `origin/main` at `ee383cb` (v6.9.5). The earlier local draft
was made on `1d89253` (v5.7.0), 104 commits behind. Its v5.8.0 label and validation
results do not describe this release. Pristine main smoke: 2,557 passed, zero failed
using Node >=20. The shell's default Node 14 is unsupported; use the current runtime.

Work is isolated on `codex/reconcile-public-v6.9.7` in the sibling reconciliation
worktree. The original checkout, including pre-existing Worker, Alerts, typography,
tests, untracked plans and output files, has not been reset, stashed, or overwritten.

| Older draft | Reconciled disposition |
| --- | --- |
| Simple posture labels, Degen rename | Already implemented in main's publicCopy and header; retain main. |
| Learn provider, glossary, bottom sheet | Do not port. Main has shared canonical three-bullet explainers and the owner-requested centered FactSheet. |
| New business spotlight, snapshot JSON, SEC/Tiingo adapter | Do not port. Main already has StockSpotlight and its public API, fundamentals, source dates and held-pair behavior. No duplicate fetch/cache path or new provider credentials. |
| Fixed seven-day rotation | Do not port. Preserve main's date-derived daily selection and weekly reshuffling, including its explicit refresh cadence. |
| Separate macro learning moment | Do not port. Preserve main's company-specific worked lesson and its rotation with the displayed pair. |
| Globally larger type / old palette | Do not port. Preserve main's one terminal skin and measured default-view budgets. |
| Always-open six-card board | Do not port. Preserve the subsequent owner-directed fold/altitude contract. |
| Current-action sentence | Do not port. Avoid another decision-like surface beside main's frozen/current/close-read hierarchy. No permission to invest is inferred from evidence quality. |
| Expanded evidence readability + direct learning | Carry forward using main's tokens and FactSheet. Labels/readings 14px; votes/dates/exclusions 12.5px; readings wrap; the canonical explainer is passed by identity. |
| Tape badge removal / old tape colors | Do not port. Preserve main's provenance-aware SpyTapeBadge and v6.9.5 different-window color correction. |
| Hatch crash fix | Already fixed by main's explicit backgroundImage assignment. |
| Old tests and relaxed 960px tape budget | Do not port. Keep main's tighter default-view tests and extend them for expanded evidence. |
| Local Worker/pre-existing changes | Preserve in original checkout; do not silently bundle unrelated work. |

Version target is v6.9.7 as requested; this does not imply a v6.9.6 release or a push.
Only the two current admin version labels change, not historical references or TT behavior.
Run `npm run gates` with a supported Node runtime and `REQUIRE_BROWSER=1` before release.

## Verification

Full `npm run gates` passed with `REQUIRE_BROWSER=1` and installed Google Chrome:
2,561 smoke, 353 terminal browser, and 425 public browser checks; production dependency
audit reports zero vulnerabilities. Production build and `git diff --check` pass.
The new browser cases exercise all six sheets at 390px and 1280px, Escape/focus return,
readable dates, wrapped readings, unchanged default collapse, and excluded-feed labels.
One initial new assertion expected lowercase while the existing sheet uppercases its
eyebrow; the assertion was corrected to ignore case and the full gate was rerun green.

At the reconciliation checkpoint, no commit, push, deployment, API configuration, or
modification of the original dirty checkout had been performed. The subsequent user
request authorizes building and deploying v6.9.7 through the existing main-branch Pages
integration; production success must be verified separately from this release record.
