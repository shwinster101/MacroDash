# Public wording and brevity audit — PR #46

## Baseline and scope

Main is live v6.6.2 at 9a4aa6c. PR #46 starts this pass at 2e5c2b5;
its existing GitHub test and Pages preview checks were green. Owner authorized
an audit, necessary updates, and merge to main. The original workspace's
unrelated edits remain untouched. Release stays v6.6.3 while the PR is unmerged.

Reviewed public call wording and meaning popups, both five-Why projections,
all six signal and three context popups, stock card labels/chart, company and
valuation popups, seven rotating lessons, supporting analysis/data notes,
source/freshness copy and About disclosure. This is the public Simple/Degen
reading flow; the separate private Terminal workflow is not being rewritten.

## Decisions and changes

- Preserve PR #42's 15-word hero and 25-word Why limits. They explain the
  majority rule more usefully than the former fine/drag language.
- Simple Why #3 used “it doesn't” even when the hurting clause came first.
  Give each side a self-contained stock-market implication and retain the
  limitation: neither proves what moved markets today. Degen's channel,
  threshold, clock and actionability detail remains useful and unchanged.
- Simple's chart still said YTD. It now spells out “return this year.”
  The stock popup defines the return's actual prior-year-close baseline,
  gains/losses, and reinvested dividends. The visible card stays compact.
- Define market capitalization as the value of all shares beside the formula.
  Keep the lower-share-price warning and evidence-dependent P/E explanation.
- Both call popups now distinguish a safety-limited Hold from mixed evidence.
  Remove the Degen popup's unsupported historical-success implication.
  State the useful boundary: macro alone does not establish a stock entry;
  company valuation, cash needs and risk limits still matter.
- Retain the educational boundary, dated evidence, unavailable states and
  limitations; brevity must not erase qualifications that change meaning.
- Company-popup sources now follow the selected fallback fundamental: operating
  income/revenue for margin, operating cash flow/capital expenditure for FCF.
- Keep the existing macro definitions, Degen valuation calculations, seven
  reported-number lessons and folded technical detail. They each answer a
  distinct question; a mechanical rewrite would add churn without comprehension.

## Measured budgets and validation

Unchanged hero ceiling 15; Why ceiling 25 per answer in both modes. Signal/context
popups: 57–69 words, three bullets. Updated Degen call popup: 63 words. Company
popup sweep over eight names/ten evidence states: max 82 Simple / 68 Degen,
within 90/110 ceilings (provenance separate). The added Simple words define
return and company size; they are intentional teaching, not filler.

Smoke: 2446 passed. Existing assertions updated for the new plain-language chart
and causal wording; call-popup assertion explicitly covers the safety limit.
Full browser-required gates and remote checks are recorded below before merge.
