# v7.0.1 voter sheets

Baseline: 2945e2b, synchronized with main; original dirty checkout left untouched.

Finding: bullet 2 contained generic rules while readings were small eyebrow text.
Outcome: one shared voterSheet projection highlights the current reading, its dated
provenance and the canonical reference in bullet 2, keeping the other two bullets.
CPI carries actual prior/start observations; rates use their voted monthly change.
Extra dependency gates prevent a missing monthly change or CPI trend from exposing
a mock fallback as a current comparison. No model rules or network paths change.

## Outcomes

Implementation commit: 0b78f781d69f100ce950629f192bb747f071b779.
Browser-required npm run gates: 2,711 smoke / 353 admin / 702 public checks; zero
production dependency vulnerabilities. All 88 focused new browser assertions pass.
Six production snapshot readings also projected correctly in a read-only predeploy check.
Production deployment follows the release push.

Corrections found during verification:
- Legacy tests asserted the old small As of / Rule footer. They now assert the dated
  current value and canonical reference inside bullet 2; duplicating the footer was rejected.
- CPI reference copy now says otherwise, preserving the existing cooling-first rule order.
- A broad version substitution touched dependency peer ranges; those incidental changes
  were removed before the final gates. Only the two root package versions changed.

Deliberately unchanged: model votes/thresholds, frozen calls, APIs, polling, main-page
layout, and the original dirty checkout.
