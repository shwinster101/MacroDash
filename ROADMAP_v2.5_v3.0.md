# MacroDash — Roadmap v2.5 + v3.0 & Claude Code Harness

For a first-time Claude Code user. Drop this in the repo root; reference it in sessions.

---

## A. ANSWERS TO THE GAPS (paste into CLAUDE.md "locked decisions")

These resolve what Claude Code flagged. Confirm or adjust, then have Claude Code
fold them into CLAUDE.md.

**Version**
- The footer string is canonical for display, but `package.json` is the single
  source of truth. FIX: render the footer FROM `package.json` version so they can
  never drift again. Bump `package.json` to match on every release.

**Cron Worker + /api/fred**
- Dead path now that `/api/snapshot` is live. REMOVE it in v2.5. New work never
  touches it. Dead code = risk.

**design-tokens.json**
- Aspirational — referenced but not in the repo. The `DT` object in dashboard.jsx
  is the de facto source today. In v3.0, extract `DT` → `design-tokens.json` as the
  real single source. Until then, update the comment to say "DT object is canonical."

**FMP / paid data**
- FRED-only is a DELIBERATE $0 stance, not temporary. FMP is a future option ONLY
  if intraday is ever needed (not planned). Keep `src-fmp` token + `stripPrivate`
  hook as reserved seams; document them as "reserved, not active."

**Zone E (personal finance)**
- Deferred. Policy: friend view (`?view=public`) = macro only; private view =
  macro + personal finance when Zone E returns. Decide in v3.0 whether it comes back.

**Freshness contract**
- Reality: first-load-per-ET-day (FRED is end-of-day). The footer "twice daily at
  open and close" is now INACCURATE. FIX in v2.5: change footer to
  "Market data refreshed daily · end-of-day sources."

**v2.1 deferred items**
- Exact-Jan-1 YTD anchor → pull into v2.5 (it's a correctness bug).
- CPI YoY overlay → v3.0 (it's a visual feature).

**Process (lock in CLAUDE.md)**
- Branch: feature branches off main, merge after smoke passes. Main auto-deploys
  via Cloudflare.
- Commits: short conventional style (`feat:`, `fix:`, `chore:`).
- Smoke test gates every push (add a pre-push hook in v2.5).
- Sole deployer: you. Live at macrodash.pages.dev.

---

## B. v2.5 — STRUCTURE & UPDATE-FLOW CLEANUP

Goal: make the codebase honest, lean, and safe to build on. No new features.

1. Version single-source: footer reads from package.json; bump to 2.5.0.
2. Remove dead cron Worker + /api/fred path.
3. Remove `_diag` from snapshot.js (debug leftover) OR gate it behind `?debug=1`.
4. Fix freshness contract string in footer (daily / EOD).
5. Fix exact-Jan-1 YTD anchor in snapshot.js (correctness).
6. Wire SourceBox badges to the real live mode (kill the hardcoded `mode="MOCK"`
   on every widget — header badge is honest, widgets are not).
7. Scrapers decision: F&G (418) + CBOE (404) — either fix the endpoints or formally
   make them MANUAL with honest source badges. Don't leave them silently failing.
8. Fold section A decisions into CLAUDE.md.
9. Add smoke-test pre-push git hook so a failing test blocks a push.

Exit criteria: footer version = package.json, no dead code, all badges honest,
smoke 34/34, CLAUDE.md complete.

---

## C. v3.0 — UI OVERHAUL

Goal: the dashboard people *want* to open twice a day. Mobile-first, glanceable.

Process — design BEFORE code:
1. Design direction (do this in the claude.ai project as a T4 thread): mood,
   hierarchy, what the friend sees in 10 seconds, what the operator drills into.
2. Extract design-tokens.json as the single design source (Claude Code).
3. Break dashboard.jsx (~900 lines, one file) into components — this is the
   structural prerequisite that makes a UI overhaul tractable.
4. Mobile-first rebuild at 375px (primary surface), then scale up.
5. Friend-view readability pass (≤10s glance on ?view=public).
6. Optional: Zone E return, CPI YoY overlay, richer charts.

Requirements to lock with T4 first (don't start coding UI until these are set):
- Information hierarchy: what's above the fold on mobile vs desktop.
- Component inventory: which widgets stay, merge, or go.
- Design tokens: color, type scale, spacing, motion.
- The "10-second story" the dashboard tells on open.

---

## D. CLAUDE CODE HARNESS (first-time-user habits)

The five habits that keep Claude Code productive instead of sprawling:

1. PLAN BEFORE CODE. Say "plan this, don't write code yet." Review the plan,
   then say "go." (Press Shift+Tab to toggle Plan Mode.) This is your steering wheel.
2. ONE VERSION PER BRANCH. `git checkout -b v2.5-cleanup`. Never mix cleanup and UI.
3. SMOKE GATES EVERYTHING. "Run the smoke test before committing."
4. SMALL, REVERSIBLE COMMITS. Easy to undo when something breaks.
5. CLAUDE.md IS THE BRAIN. "Update CLAUDE.md to reflect this change" after big work.

Rule of thumb: if a change touches more than ~3 files or you're unsure, ask for a
plan first. If it's a one-line fix, just let it run.

---

## E. PASTE-READY PROMPTS

**Phase 0 — finish CLAUDE.md (do now):**
> Here are the locked decisions for this project: [paste Section A]. Fold these into
> CLAUDE.md under "Project conventions & locked decisions." Then show me the diff.

**Phase 1 — kick off v2.5 cleanup:**
> Create a branch v2.5-cleanup. Read CLAUDE.md and Section B of ROADMAP. Then PLAN
> the v2.5 cleanup as a numbered task list mapped to those 9 items — don't write code
> yet. Flag anything risky or ambiguous. I'll approve before you start.

**Phase 1 — execute one item at a time:**
> Do item 1 (version single-source). Make the change, run the smoke test, show me the
> diff. Don't commit until I say so.

**Phase 1 — wrap:**
> All v2.5 items done and smoke passing. Bump package.json to 2.5.0, update the SRS
> §18 history, update CLAUDE.md, commit with a conventional message, and merge
> v2.5-cleanup into main.

**Phase 2 — v3.0 (start in claude.ai T4, not Claude Code):**
> T4 design thread: define v3.0 UI direction for MacroDash per Section C. Mobile-first
> 375px primary, friend ≤10s glance. Output: information hierarchy, component
> inventory, design tokens, the 10-second story. Then I'll hand the spec to Claude Code.
