> **STATUS: SHIPPED & SUPERSEDED** — everything here landed by v2.6.4 (2026-06).
> Historical record; do not implement from this document. Current brief: `CLAUDE.md`.

# MacroDash — v2.6 Requirements · "Polish & Trust"

Next release after v2.5. Sits **between v2.5 (cleanup)** and **v3.0 (mobile-first UI rebuild)**.
Authored 2026-06-05. Companion to `ROADMAP_v2.5_v3.0.md`; conventions per `CLAUDE.md`.

## Positioning & theme

v2.6 = **incremental UI enhancements + keep live data healthy and honest**, on the *existing*
architecture. It does **not** begin the v3.0 rebuild. It builds directly on what v2.5 shipped
(honest per-tile provenance + rule-based 5 Whys, live at **macrodash.pages.dev**, footer **v2.5.0**).

## Goals

1. Raise **trust & glanceability** of the current dashboard — no structural rewrite.
2. **Maintain & harden live data** (FRED + CNN/CBOE) through to v3.0 — accurate, observable, honestly degrading.

## Non-goals (explicitly v3.0, not v2.6)

- Splitting `dashboard.jsx` (~900 lines) into components — stays one file until v3.0.
- Full mobile-first 375px redesign / `design-tokens.json` extraction.
- Paid data sources — **FRED-only $0 stance holds**; FMP stays a reserved seam.
- CPI YoY overlay (roadmap defers to v3.0); Zone E personal finance (deferred).
- Real push/email alert *delivery* (bigger; revisit post-v3.0).

## Requirements

### A · UI enhancements

**R1 · Valuation-aware regime (P0).** Add a 6th factor — Shiller-PE percentile — to
`computeRegime`/`regimeFactors`/`RegimeBand` so the "is it safe?" verdict stops ignoring record
valuations (gap found in v2.5 analysis: RISK-ON can flash at ~97% of the dot-com CAPE peak). The
5-Whys positioning line reflects it.
*Accept:* vote shows N/6 incl. valuation; RegimeBand chip present; smoke asserts the factor.

**R2 · `asOf` freshness on live tiles (P0).** Thread the snapshot `asOf` into `SourceBox` on
LIVE/CACHED tiles → "as of HH:MM ET". (`SourceBox` already accepts `asOf`; `useMarketData` already
exposes it — just unused.)
*Accept:* live tiles render asOf; mock tiles don't.

**R3 · Honest staleness — STALE badge (P1).** `DataModeBadge` already defines a STALE state that's
never used. When a previously-live source falls back to last-good cache, show **STALE** (amber),
not silent MOCK.
*Accept:* a degraded source renders STALE; provenance distinguishes stale-live from mock-by-design.

**R4 · Mobile glanceability pass (P1).** Tune the *existing* layout for 390–414px (macro strip,
regime band, 5-Whys, KPI tiles): no horizontal scroll, tap targets ≥44px, above-fold contract
intact. Incremental only — not the v3.0 rebuild.
*Accept:* no x-scroll at 390px; mobile a11y ≥ current.

**R5 · Chart & sparkline tooltips (P2).** Date/value tooltips on the SPY chart + VIX/Put-Call
sparklines; consistent `fmt` number formatting.

**R6 · Friend-view "10-second story" copy (P2).** Tighten the RegimeBand headline so a non-investor
reads the verdict at a glance — low-risk copy precursor to the v3.0 friend view.

### B · Live-data maintenance

**R7 · Exact Jan-1 YTD anchor (P0)** *(absorbs v2.5 #5).* `fetchSpy` in `snapshot.js` anchors YTD
to oldest-in-window (approximate). Anchor to the true first trading day of the calendar year.
*Accept:* `spyYtd` matches a hand-checked Jan-close calc; diag/smoke guard.

**R8 · Scraper resilience + honest degrade (P0)** *(absorbs v2.5 #7).* CNN F&G (was 418) + CBOE P/C
(was 404): on failure, serve last-good from KV and mark **STALE** (R3) — never silently mock.
Decide & document the manual-fallback contract.
*Accept:* a forced scraper 4xx degrades to STALE last-good; dashboard stays honest; documented.

**R9 · Gated data-health surface (P1)** *(implements v2.5 #3's "gate behind `?debug=1`" option).*
Keep `snapshot._diag` but gate it behind `?debug=1`; add a tiny header health dot (green = all
sources live, amber = ≥1 stale/mock). Keeps live data observable through v3.0.
*Accept:* `_diag` absent unless `?debug=1`; health dot reflects provenance.

**R10 · Modest FRED-only coverage (P2, optional).** Evaluate sourcing QQQ (FRED `NASDAQ100`) and any
clean FRED series to shrink the mock surface — only if the proxy is honest; otherwise keep MOCK.
No new providers.
*Accept:* any new live field flows through `SOURCES` + provenance.

## Carry-over from v2.5 (fold in opportunistically; non-blocking)

- **#2** remove dead `/api/fred` + cron Worker — coordinated (also disable the Cloudflare cron
  trigger + decide `PULSE_CACHE` fate); do as a standalone PR when convenient.
- **#8** fold roadmap §A "locked decisions" into `CLAUDE.md`.
- **#9** pre-push smoke hook (Node-22-aware).
- (**#3** superseded by R9; **#5 / #7** absorbed as R7 / R8.)

## Exit criteria

- All **P0** (R1, R2, R7, R8) shipped + deployed to macrodash.pages.dev.
- Every tile still honest (provenance / asOf / STALE correct); live data flowing.
- Smoke green (≈45+ assertions incl. new R1/R7 coverage); `npm run build` clean.
- `package.json` bumped to **2.6.0** (footer follows automatically); `CLAUDE.md` updated.

## How v2.6 gets built (per CLAUDE.md habits)

- Branch **`v2.6-ui`** off `main`; one logical change per commit; **smoke-gate** before each commit;
  merge once the P0s land (roadmap "wrap" style). Built in **Claude Code** (v2.6 is incremental).
- v3.0 still begins with a **claude.ai T4 design thread** before any code.

## Paste-ready kickoff

> Read `REQUIREMENTS_v2.6.md` + `CLAUDE.md`. Create branch `v2.6-ui`. Plan **R1** (valuation-aware
> regime) as a numbered task list — don't write code yet. Flag anything risky. I'll approve first.

---

## Update — 2026-06-05 (post-v2.5.1 re-smoke)

**Shipped in v2.5.1 (live on macrodash.pages.dev):**
- **Mobile-novice pass** (T4-SMOKE audit FINDING-1/2/3/4): tagline un-hidden on mobile · regime
  "why" factor chips now always-visible (`10Y▲ VIX▼ F&G▲ CPI▼ P/C▲`) · "end-of-day, not real-time"
  note · plain-language `title` tooltips on all 8 strip metrics.
- **Two hand-added features** are now first-class: **WEN MOON METER** (SPY mood badge, desktop-only)
  and the **IPO COUNTDOWN** (SpaceX/Anthropic/OpenAI) — tagged honest (`MOCK · curated · speculative`),
  IPO strip horizontal-scrolls on mobile (no longer 3 stacked cards).
- **375px re-smoke: PASS** — a no-context friend gets *what is this* + *is it safe* on the first
  screen, no taps. Residual nit: the header tagline wraps to ~4 lines at 375px (tall header).

**New / refined requirements:**

**R4 (mobile glanceability) — UPDATED.** The P0 novice fixes shipped in v2.5.1. Remainder for v2.6:
- **R4a** — tighten the mobile header: tagline on its own clean line (kill the 4-line wrap), reclaim
  height so the regime hero sits higher on first paint.
- **R4b** (audit UI-05) — a tiny "▲ improving ▼ worsening" key on the macro strip.
- **R4c** (audit UI-06, *operator decision*) — regime band before the macro strip on mobile
  (hero-first). Still your call.

**R11 · Moon Meter + IPO Countdown maintenance (P1, NEW).** Shipped hand-coded with inline constants:
- **R11a** — move `IPO_TARGETS` (dates/valuations) + `WEN_MOON_*` thresholds out of `dashboard.jsx`
  into `MOCK_DATA`/a config block, consistent with the data conventions and easy to update.
- **R11b** — **time-sensitive**: the SpaceX IPO date is **2026-06-12** (days out); validate the
  post-launch `isTrading` flip and keep the "speculative" framing honest as dates firm up.
- **R11c** — respect `prefers-reduced-motion` for the 1s ticking countdown + glow animations.

**Versioning:** v2.5.1 already carried features (moon/IPO), so the next planned release stays
**2.6.0**. P0s unchanged (R1 valuation-regime, R2 asOf, R7 exact-YTD, R8 scraper resilience).
