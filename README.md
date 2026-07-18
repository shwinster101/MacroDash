# MacroDash

Macro-intelligence dashboard: one responsive URL (mobile-primary) that answers
*"is it safe to be in the market?"* from live macro + market + sentiment data —
FRED, CNN Fear & Greed, Kalshi FOMC odds, a market RSS headline, OpenRouter LLM
token prices, Finnhub equity quotes, and the Shiller CAPE. React + Vite SPA on
Cloudflare Pages, with live data assembled at the edge by Pages Functions and
cached in KV. **Current version: 3.2.0 "Cut to the Live Signal"** (the footer
renders `package.json`'s version — the single source of truth).

**Live:** https://macrodash.pages.dev · friend view: `/?view=public`

## Quickstart

```bash
npm install
npm run dev           # mock data by default (no network)
npm run build         # → dist/  (what Cloudflare Pages runs)
npm run preview       # serve the built dist/

node test/smoke.mjs   # 81-assertion no-network smoke test (Node ≥17)
```

There is no `test` script — run the smoke test directly, and keep it green before
every commit.

## Where everything is documented

- **`CLAUDE.md`** — the project brain: architecture, data sources, Cloudflare
  deployment (Pages + KV + secrets + cron Worker), conventions, locked decisions.
- **`HANDOFF.md`** — latest session state and what to verify next.
- **`worker/SETUP.md`** — deploying the separate cron Worker.
