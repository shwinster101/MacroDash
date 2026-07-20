# MacroDash

Macro-intelligence dashboard: one responsive URL (mobile-primary) that answers
*"is it safe to be in the market?"* from live macro + market + sentiment data —
FRED, CNN Fear & Greed, Kalshi FOMC odds, a market RSS headline, OpenRouter LLM
token prices, Finnhub equity quotes, and the Shiller CAPE. React + Vite SPA on
Cloudflare Pages, with live data assembled at the edge by Pages Functions and
cached in KV. **Current version: 3.8.0 "FEAT-SNAP-SAFE"** (the footer
renders `package.json`'s version — the single source of truth).

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

node test/smoke.mjs   # 181-assertion no-network smoke test (Node ≥17)
```

There is no `test` script — run the smoke test directly, and keep it green before
every commit.

## Where everything is documented

- **`CLAUDE.md`** — the project brain: architecture, data sources, Cloudflare
  deployment (Pages + KV + secrets + cron Worker), conventions, locked decisions.
- **`HANDOFF.md`** — latest session state and what to verify next.
- **`worker/SETUP.md`** — deploying the separate cron Worker.
