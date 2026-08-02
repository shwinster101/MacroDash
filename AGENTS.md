# AGENTS.md — MacroDash

> **Canonical project brief: [`CLAUDE.md`](./CLAUDE.md).** Read it first — it carries the
> full architecture, every release note, the honesty invariants, and the locked decisions.
> When this file and CLAUDE.md disagree, **CLAUDE.md wins.**
>
> This file is deliberately a THIN POINTER with no version numbers, feature lists or
> assertion counts. Its two previous incarnations both rotted the same way: a full copy of
> the brief, then a "mirror" — each still asserting a long-outgrown suite size and a missing
> test script many releases after both stopped being true (caught by the public UX re-audit).
> Volatile facts live in exactly one place now.

Macro-intelligence dashboard: one responsive URL answering *"is it safe to be in the
market?"* from live macro + market + sentiment data, plus the TT Ticker Terminal operator
portal at `/admin.html`. React SPA on Cloudflare Pages; live data assembled at the edge by
Pages Functions and cached in KV.

## Commands

```bash
npm install
npm run dev           # Vite dev server (mock unless VITE_DATA_MODE=live in .env)
npm run build         # → dist/ (what Pages deploys)

npm test              # no-network smoke suite (pure functions + source guards; Node ≥17)
npm run test:ui       # browser suite for /admin.html   (skips cleanly without Chromium)
npm run test:public   # build + browser STATE suite for the public dashboard (likewise)
npm run audit:prod    # production-scope dependency audit

# Cron Worker (separate deploy):
cd worker && npx wrangler deploy
```

Set `REQUIRE_BROWSER=1` to make the browser suites **fail** instead of skip when Chromium
is missing (CI posture).

## Non-negotiables (details and rationale in CLAUDE.md)

- **Mock-first graceful degradation** — the dashboard never breaks on bad data, and no
  number may read as live unless it is. Directional verdicts are suppressed on mock/stale.
- **One wiring point** — live fields flow through `src/sources.js` + `useMarketData.js`.
- **`package.json` `version` is the single source of truth.**
- **Real book/position/thesis/framework content never enters this public repository.**
- Every band or threshold that gates a decision changes only with a matching test change.
