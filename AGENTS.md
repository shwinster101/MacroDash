# AGENTS.md — MacroDash

> **Canonical project brief: [`CLAUDE.md`](./CLAUDE.md)** — this file mirrors it for agent
> tooling; when they disagree, **CLAUDE.md wins**. (This file previously carried a full copy
> frozen at v2.6.4 and drifted badly — v3.2 stops dual-maintaining a second brain.)

Macro-intelligence dashboard ("MacroDash"). One responsive URL, mobile-primary, that
answers *"is it safe to be in the market?"* from live macro + market + sentiment
data. Single-page React app on Cloudflare Pages, with live data assembled at the
edge by Pages Functions and cached in KV.

**Status: v3.2.0 "Cut to the Live Signal"** — live FRED (incl. HY-IG credit spreads) +
sentiment + Kalshi + RSS-headline + AI token economics (OpenRouter) + equity quotes (Finnhub) +
Shiller CAPE are flowing. Default view is **live-first**: stale and curated/illustrative content
is demoted behind per-section `CollapsedGroup` "+N stale/curated" expanders (FEAT-321/322);
Signal Quality stays always-visible. **CBOE Put/Call is fully retired** (DEC-31 — 5-factor
regime vote). Mock-first graceful degradation remains the core invariant; per-field provenance
(LIVE/CACHED/STALE/MOCK) with cadence-aware staleness on every live tile. `package.json`
`version` is the single source of truth (Vite injects `__APP_VERSION__` → footer).

## Commands

```bash
npm install
npm run dev        # Vite dev server (mock unless VITE_DATA_MODE=live in .env)
npm run build      # → dist/  (what Pages runs)
npm run preview    # serve the built dist/

node test/smoke.mjs   # 212-assertion no-network smoke test (needs Node ≥17)

# Cron Worker (separate deploy):
cd worker && npx wrangler deploy
npx wrangler secret put FRED_KEY
```

There is **no `test` script in `package.json`** — run the smoke test directly. It must stay
green when you touch `dashboard.jsx`, `sources.js`, `fiveWhys.js`, or any `SOURCES` path.

For architecture, data sources, deployment, conventions, and locked decisions: **read
`CLAUDE.md`**.
