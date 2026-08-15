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

The operative result is ticker-level `ELIGIBLE` or `WAIT`, backed by a server receipt bound to
the exact street, facts, and Engine 0 versions. Every required gate must pass: macro permission,
quote and licensed-input freshness, ≥15% published-average gap, composite and cited qualitative
quality, tier-adjusted reward/risk, and an event more than 10 days away.

Portfolio weight, the 18% cap, funding, tax placement, and the legacy owner `pt_model` remain
visible context but do not change ticker eligibility. They are separate sizing/execution
decisions.

## Persistence and routes

- `tt:book:v1` — private owner book and session board (`/api/tt`).
- `tt:street:<SYMBOL>:v1` + immutable history — reviewed SA/TipRanks packet (`/api/street`).
- `tt:facts:<SYMBOL>:v1` — merge-only sourced facts (`/api/ticker-facts`).
- `tt:analysis:<SYMBOL>:v1` + immutable history — gate receipt (`/api/ticker-analysis`).
- `/api/street/ocr` — ephemeral Workers AI review draft; it has no KV persistence path.

The full schema, NVDA calibration, migration rules, and deployment bindings are in
[`TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`](./TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md).

## Historical files

[`TT_TICKER_TERMINAL.md`](./TT_TICKER_TERMINAL.md) and
[`tt_terminal.html`](./tt_terminal.html) are archived pre-implementation prompt/template
artifacts. They are not runtime or sources of truth. The three lens harnesses remain methodology
references only.

Methodology only — not investment, tax, or legal advice. Real book/framework content remains
private in KV and never belongs in this repository.
