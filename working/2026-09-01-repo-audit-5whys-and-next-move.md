# 2026-09-01 — repo-wide audit: 5 Whys data sourcing, problem statement, and next-move triage

Scheduled audit pass. Scope per request: review the repo (incl. `ticker-terminal/*.md` and
`harness/*.md`), audit the dashboard's 5 Whys and cross-check its data sourcing against the
project's own stated requirements, re-state the problem/goal and key drivers, name what has
materially changed, and propose the highest-leverage short next move.

State at time of audit: `package.json` 6.0.0, HEAD `2cc2e46` ("v6.0.0 — CLOSE THE LOOP"),
working tree clean, CI (`test` workflow) green on `main` at HEAD, no open PRs.

## 1. Problem statement & goal (unchanged, restated for the record)

Per `README.md` + CLAUDE.md's header: **one responsive URL, mobile-primary, that answers "is
it safe to be in the market?"** from live macro + market + sentiment data, assembled at the
Cloudflare edge and cached in KV. Two engines, deliberately married-never-merged:

- **The public 6-factor backdrop** (`src/regime.js`) — 10Y · VIX · Fear & Greed · CPI · CAPE ·
  NFCI — the hero's call and the frozen 10am `md-call-v1`. This is the surface the 5 Whys
  explain.
- **Engine 0** (`src/ttReadout.js` + the TT underwriting stack) — seven order-gating checks
  behind `/readout.json`, the permission axis for the private ticker-terminal
  (`public/admin.html`), which is a *personal capital-allocation system* (per
  `ticker-terminal/README.md` and the `VALUE_PROPOSITION_AUDIT_2026-07-31.md` conclusion) —
  explicitly not a Yahoo/SA/Robinhood competitor. Its moat is the judgment layer (a verdict,
  the ability to abstain, provenance, non-consensus inputs), not the data layer.

## 2. 5 Whys audit — data sourcing cross-checked against requirements

**Verdict: correctly wired, no defect found.** Traced the full chain:

- `src/fiveWhys.js` — `computeFiveWhys(data, regime, opts)` implements the v5.4.0 "Why This
  Call" structure documented in CLAUDE.md (call arithmetic → drivers → transmission →
  evidence quality → nearest flip), not the older SPY/CPI/Fed-anchor structure the changelog
  describes for pre-v5.4 releases. This is current and correct — the file header and the
  `working/` note inside `src/sections/FiveWhys.jsx` both confirm the "0/3 core inputs usable"
  phrasing from earlier CLAUDE.md entries is **retired language**; a live grep confirms no
  code or test emits it anymore (already caught and corrected by the project's own 8/28
  vocabulary pass, per the comment at `FiveWhys.jsx:13-15`).
- **Factor-key consistency, verified by direct comparison**: `WHY_IT_MATTERS` in `fiveWhys.js`
  keys on `tenYear, vix, fearGreed, cpiHeadline, valuation, nfci` — this is an exact match to
  `REGIME_BAND_TABLE`'s six `key:` entries in `src/regime.js` (line-by-line diffed). No drift.
- **Data flow, verified end-to-end**: `dashboard.jsx` builds `evidenceSet` via
  `buildEvidenceSet()` (src/evidence.js) → `dailyCall = callFromEvidence(evidenceSet, …)`
  (src/macroCall.js) → `dailyCall.factors` (mapped 1:1 from `evidenceSet.factors`) is handed
  to `computeFiveWhys` as `opts.call`. One derivation, no parallel copy. `FACTOR_FIELD` in
  `evidence.js` correctly aliases the `valuation` factor key to its underlying SOURCES field
  `shillerPe` — this is the one place a naming mismatch could have crept in, and it hasn't.
- **A1 freshness gate (v3.58) intact**: `freshSet` is keyed on `liveBuild` (not `anyLive`), so
  a LOADING/ERROR live build passes an empty freshness set rather than narrating mock
  SPY/CPI/Fed as live tape — confirmed present at `dashboard.jsx:648-656`.
  `opts.headlineFresh` correctly gates WHY #4's headline clause the same way.
- **Macro-materiality filter (v3.51) intact**: `isMacroMaterial()` in `fiveWhys.js` is a
  one-way allowlist — a non-matching headline is withheld and says so, never rewritten.
  Smoke section [3] exercises both the materiality allowlist and the freshness gate.
- **Smoke result**: `npm test` → **2168 passed, 0 failed** — exact match to the count CLAUDE.md
  claims for v6.0.0 (`Tests: 2168 smoke + 309 render + 234 public-render`). Render/public-render
  suites skip cleanly in this environment (no Chromium installed — `npm install` was not run
  here), so those two counts are unverified this pass, but nothing about the 5 Whys path
  depends on browser-only behavior beyond what `FiveWhys.jsx` documents as presentation-only.

No gaps found between the 5 Whys' data sourcing and what CLAUDE.md documents as the current
contract. The one thing worth flagging is not a defect but a fragility: **`WHY_IT_MATTERS` is
a hand-maintained parallel table** keyed by the same six strings `REGIME_BAND_TABLE` uses — it
has no reconciliation pin (unlike `DERIVED_OF`/`SOURCES`, which are smoke-reconciled against
each other elsewhere in this codebase). A 7th voter arriving in `REGIME_BAND_TABLE` without a
matching `WHY_IT_MATTERS` entry would silently drop that factor's mechanism sentence from WHY
#3 rather than failing a build. Today this can't happen (`REGIME_BAND_TABLE` is pinned at six
non-voting-Engine-0 entries per the NFCI/30Y "does not vote on arrival" doctrine), but it is the
one place in this specific file where the "one home, no second copy" rule this project polices
everywhere else is enforced by convention rather than by a test.

## 3. Key drivers (what actually moves the two engines)

- **Public backdrop**: 10Y direction, VIX level, Fear & Greed, CPI trend, Shiller CAPE,
  NFCI — strict-majority vote, quorum-gated (`REGIME_QUORUM`), mock never votes in a live
  build, and TAILWIND/BULLISH requires both panic gauges (VIX + F&G) to be current.
- **Engine 0 / TT order-gating**: seven checks (10Y, VIX, F&G, CPI, RS, Kalshi fed-odds, 30Y
  curve) → confidence/actionability/status two-axis contract, plus the Macro Flip circuit.
- **TT underwriting (ticker-level)**: the four-pillar composite (P1 valuation via `ptModel.js`
  lens routing · P2 trajectory · P3 economic quality, now incl. the v5.0.0 FINANCIALS mode ·
  P4 falsifier health with pre-commitment enforcement) — routed through
  `src/ttScoreRegistry.js`'s lens map, which the background review confirmed is a near-literal
  implementation of the three `ticker-terminal/*_HARNESS*.md` prompt rubrics (AI infra,
  physical AI, quality compounder), each `Gn` gate id traceable to the harness's own step
  numbering.
- **The allocation/dock layer** (v3.100/v5.6.x): server-authoritative eligibility ladder,
  hash-bound receipts, the `SEND IT / HODL / TOUCH GRASS` product gate — now confirmed
  (`macroGate()` in `public/admin.html:4441`) to be rung-for-rung on the same primitives the
  server ladder uses, matching the v6.0.0 T1 fix description exactly.

## 4. What has materially changed (v6.0.0, verified against code — not just changelog prose)

All three tickets were spot-checked directly in source, not merely trusted from CLAUDE.md:

- **T1 — one GATE.** `macroGate()` (`public/admin.html:4441`) derives from
  `circuitStateCli → governingRegime → actionability → macroFlip`, never from the collapsed
  `stance().k`. Confirmed present and matches the documented "RESTRICTED → HODL,
  measured-HEADWIND+FULL → SEND IT" behavior.
- **T2 — the freeze can miss once and recover.** `putWithRetry` (`worker/cron.js:195`, 3
  attempts) is wired into the 10am freeze write path; confirmed present.
- **T3 — the Monday feed hole.** `FIELD_LG_GROUPS` (`functions/api/snapshot.js:1185`) carries
  four separate groups — `cpi`, `cpi_core`, `nfci`, `nfci_lev` — so a dead FRED tail batch no
  longer drops a live critical alongside a dead sibling. Confirmed present.
- **T4 — release cut / persisted alerts + BLIND badge fix.** Not independently re-verified in
  this pass (lower risk surface, well-covered by the 890+ dedicated smoke assertions already
  cited in CLAUDE.md); flagged here only as unverified-this-pass, not doubted.

Repo hygiene: CI green on `main` at HEAD (`test` workflow, run `33470835745`), no open PRs, no
uncommitted changes, package.json version matches CLAUDE.md's top changelog entry exactly. No
undocumented drift between what shipped and what CLAUDE.md claims shipped.

## 5. Ticker-terminal / harness docs — findings (via background review, spot-checked)

- **Not stale**: `VALUE_PROPOSITION_AUDIT_2026-07-31.md` and `V5_SYSTEM_AUDIT_2026-08-23.md`
  both read as accurate **history** — their findings map 1:1 to fixes CLAUDE.md records as
  already shipped (v3.49 FIX-A/B/C, v5.0.0 W1–W4). They are origin documents, not live
  contradictions.
- **Correctly archived**: `TT_TICKER_TERMINAL.md` and `tt_terminal.html` self-label ARCHIVE and
  point to `README.md` + the redesign plan as current. `HANDOFF.md` is banner-marked
  non-current. `AGENTS.md` is a clean thin pointer with no volatile facts — the project's own
  anti-rot convention is holding.
- **One real implementation gap named in the plan's own text**: the redesign plan's
  "Implementation status" section marks step 6 (deleting legacy `projection`/`pt_consensus`
  fields) as deliberately deferred, no date given, to keep old private book payloads readable
  during migration.

## 6. What's missing — deferred items named plainly (owner-scoped, not assistant scope)

From `V5_SYSTEM_AUDIT_2026-08-23.md` §3–4 and `VALUE_PROPOSITION_AUDIT_2026-07-31.md`'s gap
list, still open as of this pass:

1. **Falsifier sprint incomplete** — 23/28 PROVISIONAL-status names still need owner-authored,
   pre-committed hinges before they can reach a real (non-capped) TT score.
2. **11 no-payload names** need owner model/capture work (RGTI, QQQI, DAC, VRT, ASML, DXYZ,
   TER, KRKNF, MCHP, AUR, AVGO) — explicitly out of assistant scope per the audit.
3. **CRWV committed-facilities figure unsourced**; **SPCX lens ruling pending**; **NVDA
   hinge-count over the P4 8-cap**, needs one dropped before its 8/26-class print window (this
   date has since passed — worth an owner check on whether it was resolved).
4. **Value-prop audit gaps #1–7**, still open per that doc: no outcome calibration/
   benchmarking against realized results, no portfolio factor-correlation risk, incomplete
   options Greeks/assignment exposure, no tax-aware funding, citations aren't clickable, and
   broker sync is still a manual chat-driven MCP pull rather than automated (the v5.6.x
   Robinhood runbook narrows this but doesn't close it).
5. **Legacy `projection`/`pt_consensus` fields** — deferred deletion, by design, no date.
6. **v6.0.0's own explicit deferrals** (owner ruling, named in the release note itself): new
   macro factors, LEV as a voter, backfilling the 8/28 gap, more explainer prose, DST
   automation, and three filed-not-built findings from the button audit (span-onclick DESK
   rows, `hzDeckChip` tap targets, footer link sizes).
7. **This pass's own finding**: `WHY_IT_MATTERS` in `fiveWhys.js` has no reconciliation guard
   against `REGIME_BAND_TABLE` (see §2) — low-risk today, but it's the one un-pinned parallel
   table in an otherwise heavily-cross-pinned codebase.

## 7. Highest-leverage short next move

Given the codebase's own stated priorities (v6.0.0's release note: "owner sprint, four tickets
in order, nothing else entered the bump") and what's actually open, the single highest-leverage
*short* move is **not new dashboard code** — the public engine and its 5 Whys are in good shape
and don't need attention this pass. It's clearing the falsifier backlog that is currently
capping real TT scores:

> **Resolve the NVDA P4 hinge-count-over-cap** (item 3 above) if it hasn't already been handled
> since its print window closed, then work down the 23-name PROVISIONAL backlog (item 1) —
> starting with whichever names are closest to a real capital decision. This is the one item
> that is (a) purely owner-authored content the assistant cannot supply on its own, (b)
> currently *capping* real scores across roughly half the book at a B-ceiling regardless of
> underlying quality, and (c) already fully instrumented — `src/ttScoreRegistry.js` and the
> pre-commitment guard in `functions/api/score.js` will score a name correctly the moment its
> falsifiers land. No code work is required; it is a content-completion pass, and it is the
> single highest-leverage thing blocking the TT board from reflecting its own engine's real
> output.

If a code-side next move is wanted instead, the cheapest one is pinning `WHY_IT_MATTERS`
against `REGIME_BAND_TABLE` in smoke (§2/§6.7) — a small, low-risk addition that closes the one
un-guarded parallel table this pass found, consistent with the project's own reconciliation
convention (`SOURCES`/`DERIVED_OF`, the playwright `EXECUTABLE_PATHS` reconciliation, etc.).

---
*No code changed in this pass — audit only, per the scheduled task's scope.*
