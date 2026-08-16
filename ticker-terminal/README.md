# TT Ticker Terminal — current contract

The live operator terminal is [`public/admin.html`](../public/admin.html), served at
`/admin.html`. Its macro permission comes from `/readout.json`; its private book, reviewed
licensed inputs, sourced facts, and gate receipts live in separate `PULSE_CACHE` KV records.

## Owner input boundary

For each ticker, the owner supplies only:

1. Seeking Alpha forward annual revenue and EPS observations.
2. TipRanks' published 12-month analyst target: average, low, high, and the visible analyst /
   rating counts.

The terminal accepts up to three screenshots, creates an OCR **draft**, and requires explicit
review and confirmation. Images and OCR drafts are not persisted. The TipRanks published average
is consumed directly; low/average/high are never averaged into a fourth target.

Quotes, daily OHLC, the earnings calendar, company profile, SEC filings, diluted shares, and
balance-sheet components are fetched by server adapters. Missing or stale facts remain named
`UNKNOWN`/`STALE`; absent net cash is never treated as zero.

## Decision boundary

The diagnostic result is ticker-level `ELIGIBLE` or `WAIT`, backed by a server receipt bound to
the exact street, facts, and Engine 0 versions. Every required gate must pass: macro permission,
session-aware quote and licensed-input freshness, ≥15% published-average gap, composite and cited
qualitative quality, and tier-adjusted reward/risk. Binary timing is a report-only advisory.

Portfolio weight, the 18% cap, funding, tax placement, and the legacy owner `pt_model` remain
visible context but do not change ticker eligibility. They are separate sizing/execution
decisions.

The separation is bidirectional: street receipts cannot enter canonical `readiness()`, mutate or
reorder the canonical valuation rows, or select the canonical Next Dollar pick. The street panel
keeps book order and selects no winner. Missing Engine 0 actionability fails closed everywhere;
only explicit `FULL` passes. Intraday quotes use a 15-minute limit, while closed sessions use the
most recent completed-session close until the next open.

## TT-run response contract

Every human-facing TT run ends with one compact line per requested ticker:

`SYM — Composite: <score>/10 (<surface>) · PT: $<value> (<basis>, <horizon>, <source>) · Call: BUY|WAIT|SELL — <governing reason>`

A missing score or target is printed as `UNAVAILABLE` with the missing gate; it is never omitted
or backfilled. Canonical `/api/score` composites and owner-model PTs are labeled separately from
street diagnostic composites and TipRanks' published 12-month average. The two surfaces are
never blended, and the more favorable result is never selected opportunistically.

`BUY` requires the canonical **ELIGIBLE NEXT DOLLAR** line to name the ticker. `SELL` requires an
explicit canonical forced-exit, kill, or over-cap trim rule. A diagnostic `ELIGIBLE`, attractive
target upside, or funding-priority row alone cannot create a buy/sell call. Every disagreement,
missing gate, or unavailable governing surface is `WAIT`.

## Persistence and routes

- `tt:book:v1` — private owner book and session board (`/api/tt`).
- `tt:street:<SYMBOL>:v1` + immutable history — reviewed SA/TipRanks packet (`/api/street`).
- `tt:facts:<SYMBOL>:v1` — merge-only sourced facts (`/api/ticker-facts`).
- `tt:analysis:<SYMBOL>:v1` + immutable history — gate receipt (`/api/ticker-analysis`).
- `/api/street/ocr` — ephemeral Workers AI review draft; it has no KV persistence path.

A mistaken confirmation is voided with an audited, version-matched tombstone, never deleted.
The qualitative Workers AI call receives only an explicitly approved redacted `aiRubric`; the
full private framework is never assembled into the prompt.

The full schema, NVDA calibration, migration rules, and deployment bindings are in
[`TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`](./TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md).

## Historical files

[`TT_TICKER_TERMINAL.md`](./TT_TICKER_TERMINAL.md) and
[`tt_terminal.html`](./tt_terminal.html) are archived pre-implementation prompt/template
artifacts. They are not runtime or sources of truth. The three lens harnesses remain methodology
references only.

Methodology only — not investment, tax, or legal advice. Real book/framework content remains
private in KV and never belongs in this repository.
