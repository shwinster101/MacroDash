# v7.0.3 integration and deployment

Owner identified claude/fng-asterisk-bands-32wvyu as the completed caption/reconciliation
patch, with no band movement. Existing authorization includes merge and deployment.

## Baseline and reconciliation

- Production/main: b3a19b3 (v7.0.2). Local branch also includes release note 937683a.
- Incoming: 7a56ece, independently based on 489c22c (v7.0.1).
- Preserve all v7.0.2 source and tests. Resolve version labels to 7.0.3; concatenate
  both appended test blocks and retain both release notes, newest first.
- Correct incoming claim that 7.0.2 did not exist: it was deployed before this merge.
- Runtime diff adds the F&G caption and optional gateAsterisk field only. No voting
  function, threshold, engine, API, or saved-call logic changes.

## v7.0.4 blocker (updated evidence)

Remote working/v7.0.4-spotlight-lock advanced from 1b639e3 to 4c8ea13. Contrary to the
new commit's UI-completion title, it replaces the entire 969-line src/dashboard.jsx with
PLACEHOLDER and still contains no StockSpotlight.jsx UI change. Do not merge this ref.
Requested corrected branch/commit from owner. Original dirty checkout remains untouched.

## Verification and outcomes

Combined browser-required npm run gates passed: 2754 smoke / 353 admin / 759 public;
production dependency audit found zero vulnerabilities. No test budgets weakened.
Both appended suites run, including frozen-action parity and all F&G disclosure paths.
Merge commit 49df6cdbeda25c9bd7d321152aa0797295b40790 was pushed to main.
Cloudflare deployment e8a3a8a6-5d9a-4038-b0fa-c8e83d679acf completed successfully.
Production serves index-Dl8hmpxJ.js, SHA-256 identical to the verified local 7.0.3 build.
Live browser checks at 390px: F&G caption present after Model reference in both modes;
hero strings remain identical; no horizontal overflow or runtime errors. Screenshot
reviewed: /tmp/macrodash-703-production-fng.png. GitHub CI run 35411969796 was still
running at this checkpoint; local combined gates are complete. This follow-up note is
local documentation, not a second production deployment.
