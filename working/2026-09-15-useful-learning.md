# Useful learning — deployment review and implementation

## Review baseline

Reviewed remote main v6.5.4, merge 204eda53 (PR #38), and the live site at
390 × 844 on 2026-09-15. The local original checkout was v5.7.0 and dirty;
implementation uses an isolated worktree based on remote main.

Observed: the macro call, drivers, strip and both compact profiles fit the first
screen. Learning moment revealed only a definition; its concrete example was deep
inside Explore. The financial-conditions sheet filled most of the phone despite
having only three bullets. Simple NBIS data notes attached the revenue quarter to
half-year cash flow. The bare URL contained an operator dock, while `?view=public`
omitted it. Source review also found an AAPL change lesson with only one share
observation, and a META ratio without reporting-period compatibility checks.

## Next release (v6.5.5)

- Correct metric-specific periods and reject incomplete or incompatible examples.
- Rebuild lessons on public reads, including old cached models; do not wait for refresh.
- Put concept, two dated company lines and limitation inside the existing Learning
  moment. Keep it closed by default; remove the duplicate from Explore.
- Shorten ordinary metric explainers to three bullets / 75 words, retain full names
  and date/rule metadata, and use short readable titles.
- Name Revenue growth and YTD return precisely. Share links select the public view.
- Keep the compacted first screen, typography, and data/decision rules.

## Explicitly staged following release

The approved plan separated these from the next release; they are not part of this patch:

- More company/lesson-specific Business / Stock / Watch next questions with dated
  baselines and the evidence needed to revisit them.
- Relevant macro mechanisms within expanded content, without causal attribution or
  turning the public research page into a personal BUY/HOLD/CASH gate.
- Mag 7-first mobile carousel with NBIS second, visible selectors and swipe, no
  auto-advance, preserved shared chart identities and weekly rotation. Desktop and
  Degen retain the comparison layouts.

## Human usefulness check (not replaced by automated tests)

Five beginners use Simple without coaching. Target four who can explain the macro
call, distinguish YTD stock return from revenue growth, explain the company example,
and identify its limitation. Record answers, not just clicks. In an owner walkthrough,
check whether Degen identifies the baseline, next research question and missing evidence
within one minute. This is a formative usability check, not investment-performance proof.

## Corrections to earlier assumptions

- The first conversational plan used stale v5.7.0 source and incorrectly treated
  spotlight, Degen naming and learning as new features. All existed in v6.5.4.
- A carousel is a secondary layout change: the live stacked profiles already fit.
- The current public share handler copied the bare URL; testing only `?view=public`
  did not guarantee friends would actually receive that audience.
- The AAPL example cannot be fixed by rewording a single share observation. It is
  withheld rather than pretending to measure share-count or per-share growth.

## Outcomes

Implemented the next-release scope above in v6.5.5. The explicitly staged follow-up
and human pilot remain outstanding; neither is represented as completed.

- `REQUIRE_BROWSER=1 npm run gates` passed with Node 22 and local Chrome:
  2,356 smoke, 309 terminal render, 336 public render; production audit: 0 vulnerabilities.
- Production build passed. Its existing large-chunk warning remains; no bundling work
  was added to this teaching change.
- Visually reviewed the built site at 390 × 844 with synthetic data: the compact face
  remains, Learning moment contains both examples without Explore, and the short
  financial-conditions title retains its formal name and date/rule metadata.
- Initial browser validation caught a missing rendered formal-name caption after the
  title change. Fixed it and reran all gates; the final suite passes the provenance,
  focus, mobile overflow and example-access checks.
- Also corrected singular grammar for lone plural drivers (“Rates are”, “Prices are”).
- Baseline rechecked after the user's continuation: remote main still 204eda53 / #38.
- No production writes, provider refreshes or private-book data were used for testing.
- Original dirty v5.7.0 checkout left intact; changes live in the isolated
  `codex/spotlight-learning` worktree based on v6.5.4.

Compatibility: no new endpoint or schema version; lesson limitations/example lines and
metric period bounds are additive. Old cached lessons are regenerated on read; META
examples missing period bounds are unavailable until the regular refresh. Share links
explicitly use the public audience; this is an audience choice, not an authentication
boundary.

Implementation commit: `98de09f8b573d1c1c21b125e118ae545d674bfba`. This follow-up
records the verified outcome and commit reference only; product code is unchanged.

## Screenshot follow-up

The owner requested the full word “Volatility” in the Simple hero; `FACE_NOUN.vix`
now spells it out and the existing copy assertions require the full word. Stock
Spotlight profiles remain noninteractive summaries; Learning moment and Explore
are the current controls. No company-card tap behavior was added in response to
the question about existing behavior.

Follow-up validation: all 2,356 smoke assertions pass, including the full word and
the unchanged 18-word hero budget. This is a copy-only correction to the open PR.

## Company-card follow-up (owner screenshot)

Correction to the earlier density decision: removing company size and leaving profiles
noninteractive made the beginner face too cryptic. The owner explicitly asked for
company learning on tap. Restored existing market cap data (no provider change),
spelled out Return this year, and reused the accessible three-bullet FactSheet for
each company. Business description, capitalization, return and selected fundamental
are explained with metric-specific dates and unavailable/stale handling. The card
shows a learning affordance; Degen and the shared lesson remain unchanged.

### Continuation — 2026-09-16

Reconfirmed remote main and PR #39 base at `204eda53` (v6.5.4); no baseline drift.
The first browser run caught two older assumptions that capitalization was hidden.
Updated the cross-mode check to read each profile's capitalization directly; the
year-rollover check still withholds prior-year returns but retains company size.

The resumed run also exposed a pre-existing decision-day test gap: September 16 is
a scheduled FOMC date, and the unchanged product correctly renders “FOMC decision
today.” Two assertions accepted only “Next FOMC in N days.” They now explicitly
accept today's wording only when the calculated remaining days are zero. No
calendar, countdown logic, or macro threshold changed.

Visual review at 390 × 844 with synthetic data confirmed compact three-row cards
and a readable three-bullet popup; close restores focus. Additional pure checks
covered unavailable/stale data, margin and cash-flow fallbacks, negative cash flow,
zero growth/return and each selected metric's own period.

### Company-card outcomes

Final `REQUIRE_BROWSER=1 npm run gates` passed with Node 22 and local Chrome:
2,356 smoke, 309 terminal render, 342 public render, and zero production dependency
vulnerabilities. Production build passed with the existing bundle-size warning.
This remains draft PR #39 against v6.5.4; no merge or production deployment occurred.

Company-card implementation commit: `a792bfa` (after the full-word correction `a40da23`).
