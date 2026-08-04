# MacroDash

Macro-intelligence dashboard: one responsive URL (mobile-primary) that answers
*"is it safe to be in the market?"* from live macro + market + sentiment data —
FRED, CNN Fear & Greed, Kalshi FOMC odds, a market RSS headline, OpenRouter LLM
token prices, Finnhub equity quotes, and the Shiller CAPE. React + Vite SPA on
Cloudflare Pages, with live data assembled at the edge by Pages Functions and
cached in KV. **The version lives in `package.json`** — Vite injects it and the footer
renders it. This file deliberately does not restate it (see the note at the bottom).

**Live:** https://macrodash.pages.dev · friend view: `/?view=public`
**Machine endpoint:** [`/readout.json`](https://macrodash.pages.dev/readout.json) — the TT
regime readout (`tt-v1` schema, CORS-open, 5-min cache): six band checks →
TAILWIND/NEUTRAL/HEADWIND/PANIC + the Macro Flip circuit, derived from the same daily snapshot.

## Quickstart

```bash
npm install
npm run dev           # mock data by default (no network)
npm run build         # → dist/  (what Cloudflare Pages runs)
npm run preview       # serve the built dist/

npm test              # no-network smoke suite (pure functions + source guards; Node ≥17)
npm run test:ui       # browser suite for /admin.html    (skips cleanly without Chromium)
npm run test:public   # build + browser STATE suite for the public dashboard (likewise)
npm run audit:prod    # production-scope dependency audit
npm run gates         # ALL FOUR in order, failing on the first red — never hand-chain them
```

Run them with `npm run gates` — a hand-chained `npm test | grep FAIL && …` exits 0 when
grep FINDS the failure, so a red run can slip through. CI (`.github/workflows/test.yml`) runs the
same four on every push and pull request, with `REQUIRE_BROWSER=1` so a missing browser
fails the run instead of silently skipping the gate.

## Where everything is documented

- **`CLAUDE.md`** — the project brain: architecture, data sources, Cloudflare
  deployment (Pages + KV + secrets + cron Worker), conventions, locked decisions.
  **Canonical — when any other file disagrees with it, it wins.**
- **`HANDOFF.md`** — a point-in-time session record, not a current-state document.
- **`worker/SETUP.md`** — deploying the separate cron Worker.

> **No volatile facts in this file.** No version, no assertion counts, no feature list —
> those belong in `package.json` and `CLAUDE.md` respectively. The 2026-08-02 audit found
> this README asserting a version ~52 point releases stale, an assertion count off by
> hundreds, and a `test` script that had existed for releases as absent. That is the same
> "a label outliving its data" defect this project fixes *inside* the app, so it gets the
> same treatment `AGENTS.md` already got: state where the truth lives, don't copy it.
