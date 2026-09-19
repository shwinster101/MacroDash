# v7.0.2 face honesty

Baseline: 489c22c (v7.0.1), clean release worktree; original dirty checkout untouched.

Requested slice: one current six-vote tally, counted-stale suffix, frozen 10am action,
and exact terminal-engine distinction, identical between Simple and Degen.

Finding/correction: production CPI observation 2026-08-01 is 48 days old at 2026-09-18.
The existing monthly rule is >70 days, so this is not a stale counted voter. Ordinary
current stale voters are excluded before counting; the suffix is defensive, never a
reason to weaken exclusions or switch CPI to a daily freshness rule.

No published frozen call yields 10am action unavailable. Tally reads current
evidence; action reads the immutable call direction, not the live drift or TT engine.

Verification: complete. Scope does not include publishing/deploying this slice.

## Outcomes

Implementation stays presentation-only: one pure projection and one shared component.
Published frozen direction owns the action; current six-factor evidence owns the tally.
Missing published capture reads “10am action unavailable.” No additional API requests.

Corrections during verification:
- The initial frozen browser fixture omitted override/actionability, which the existing
  call consumer requires. Corrected the fixture, not the production call contract.
- Existing assertions expected the retired mode-specific hero sentence. Replaced those
  assertions with the requested shared tally and exact cross-mode strings.
- Initially expected the old phone budgets to hold. The new mandatory face lines put
  the frozen/missing-signal first market tile at 743px and the section-start fixture at
  663px. Explicitly allowed 24px of new primary content: tile 720→744, section 660→684.
  Card position, 44px targets, 16px tally, readable line spacing, and overflow limits stay.
- Shortened the missing-capture fallback; did not shorten the three requested actions.
- A broad test-budget edit briefly touched the 720 moving-average fixture value. Diff
  review caught and restored it before the final regression run; no model input changes.

Focused browser checks passed 49/49 across 320/390/1280px and all three frozen directions;
screenshots reviewed at phone widths in both modes. Final browser-required npm run gates
passed: 2,735 smoke, 353 admin-browser, 751 public-browser; production audit: 0 vulnerabilities.
Final source diff passes git diff --check. Implementation commit: 1b80850
(feat: v7.0.2 shared honest hero tally and frozen action), based on 489c22c.
No publishing or deployment in this slice; production remains the prior release.
