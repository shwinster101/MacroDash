# Company size and earnings — follow-on to PR #42

## Baseline and contract

Branch starts at merged main `72cc918` (v6.5.6, #39 including its review fixes).
PR #42 is open at `ab0ac1f` and currently conflicts with main; it predates #39.
The planned next number is v6.6.2, after #42's v6.6.1. This work does not change
#42's hero/Why word budgets or its source branch. Keep Volatility in full.

Owner chose profitability inside the popup, not on the Simple face. Keep the
three existing card figures. Popup limits: three bullets, 90 Simple / 110 Degen
words maximum, excluding date/input provenance and source labels. These are
ceilings, not targets. No truncation, no generic investment call.

## Implementation

`src/spotlightExplain.js` is a pure presentation module over the same public
model in both modes. Simple teaches business, company size (shares × share
price), and earnings. Definitions of the shown fundamental and return survive.
Business descriptions cover NBIS and all seven rotating names. Positive net
income does not conceal a separately dated operating loss.

Degen's Market cap, Trailing P/E, and Cap ÷ TTM revenue labels open individual
FactSheets with calculation, interpretation, and limitation. Hypothetical
share-count arithmetic is explicitly labelled. The UI never fabricates current
price × shares operands from mismatched market/share dates. Figures, sources,
and their respective dates are explicit; source links use HTTP(S) only.

Model adds `valuation.ttmNetIncomePeriod` and a `net earnings` source citation.
Zero and negative earnings have distinct reasons. Profit/loss teaching requires
both an earnings value and its OWN period; old cached models do not borrow
revenue dates or force a provider refresh. Normal refresh populates the new
metadata. Degen's P/E row withholds the number if its reporting period is absent.
No provider, computation threshold, private content, or forecast was added.

## Validation and corrections

Initial smoke: 2,380 pass. An eight-company × ten-state sweep measured maximum
70 words Simple / 68 Degen (limits 90/110). Tests cover positive, negative, zero,
missing/undated earnings; absent cap; stale inputs; positive net profit with an
operating loss; margin/cash-flow fallback; source provenance; old-cache behavior.
Browser checks cover company teaching, each valuation trigger, source links,
keyboard opening, Escape and focus restoration, plus the existing phone layout.

Final gate results and integration findings are recorded below when complete.

## Live baseline correction

The owner identified live v6.6.2 while this branch was being checked. Merged
`origin/main` at `9a4aa6c` (#43–45) into this branch; relabelled this work v6.6.3
to avoid a silent collision. Kept both new provider tests and company tests,
plus main's midnight harness guard. No public call text changed versus main.
PR #42 remains separate at `e5b24da`; its hero/Why copy is not pulled into this PR.
An earlier temporary combination with #42 passed smoke but is not the published
branch. Concurrent browser runs collided on their fixed port; final gates run
sequentially on this branch. Corrected a browser assertion that wrongly expected
a missing market-cap date to be marked stale; missing and stale are now checked
separately. Visual review prompted full price-to-earnings wording in Simple and
a company heading on each Degen metric dialog.

## Owner correction: retain the higher-leverage PR #42 copy

The owner clarified that the original #42 wording should survive where stronger.
Carried its copy-only `ab0ac1f` change forward: 15-word hero, 25-word Simple/Degen
Why answers, matching semantic and budget tests. Preserved the merged full
Volatility name and the new company explanation module. No FOMC policy event,
alert or provider change from #42 is included. This supersedes the earlier
“no public call text changed” scope statement; call outcomes remain unchanged.
The explicit tradeoff from #42 survives: Degen quotes a shortened rank-1 news
headline; ranks 2–3 remain in data but no longer appear in the Why answer.

Before that scope addition, all four gates passed: smoke 2426, terminal 309,
public 356, production audit 0 vulnerabilities. Popup sweep maximum is 68/68
words after final terminology edits (correcting the initial 70/68 record).
Final gates are rerun with the carried-forward copy below.
