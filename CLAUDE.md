# CLAUDE.md — MacroDash

Macro-intelligence dashboard ("MacroDash"). One responsive URL, mobile-primary, that
answers *"is it safe to be in the market?"* from live macro + market + sentiment
data. Single-page React app on Cloudflare Pages, with live data assembled at the
edge by Pages Functions and cached in KV.

**v5.8.0 "NEWCOMER RULER + FACT SHEET" — the hero stops pointing at the wrong gauge, and every
parameter explains itself one tap deep.** Two owner tickets, one release, copy/projection only:
no vote, band, flip edge, quorum, panic, cron, worker, history or TT change.
**(1) The MIXED sub is DERIVED, not canned.** Owner's read of prod on 2026-08-29 — `HODL ·
NEUTRAL · "Cross-signals — watch VIX"` with **VIX at 14.43, a HELPING vote**. `REGIME_META.MIXED`
carried a STATIC sub and `computeRegime`'s only override (v3.61) fired when VIX was *excluded*,
so every mixed tape carrying a live VIX told a newcomer to watch the one gauge that was fine.
`computeRegime` already counts the votes; it now keeps the KEYS as it counts and names the
disagreement from the band table's own `plain` nouns — *"volatility and inflation help, prices
do not"* (`valuation → "prices"` is the ONE alias, this sub only). One-sided mixes keep the
v3.61 nearest-flip fallback — there is no disagreement to name — and the VIX-excluded path is
byte-unchanged. **`MIXED_SUB_MAX = 60` is a MEASURED two-line height**, not a round number:
driving the real bundle at 375px and 390px, 44/54/55/60-char subs all render two lines and 67
renders three, so a wider split states the count (`3 help, 1 does not`) instead of naming six
factors across four lines. The ticket's "~48" measured as the *same* two lines and would have
degraded ordinary 2-vs-1 tapes for nothing.
**(2) `ruler` on every band** — the current edges restated, one muted line on the Simple card,
living beside the rule they describe (the `plain`/`whyItMatters`/`metric` doctrine).
`CAPE_MEAN`/`CAPE_ATH` MOVE from `macroCall.js` into `regime.js` so the valuation ruler derives
26.1 from `CAPE_MEAN * 1.5` rather than minting a second literal. The guard is what makes it a
ruler and not a caption: smoke reconciles **`vote()` ↔ `flip` edges ↔ the ruler's own numbers**
for the four scalar bands, derived from the table at runtime (the SOURCES/DERIVED_OF
convention) — move an edge in one home and the other two go red. CPI and valuation are compound
votes with `flip:null`, so their literals are pinned instead, which is the same reason the
rules forbid inventing a crossing for them.
**(3) THE FACT SHEET (owner: "clicking each context parameter brings a pop-up tile").** Tapping
a card opens `src/primitives/FactSheet.jsx` — full spelled-out name, a 3-bullet *what it is*,
*what moves it*, *normal / neutral level*, *why it matters to the macro picture*, and a
verified quote where one exists. The WAI-ARIA dialog contract in full: labelled + `aria-modal`,
Escape, backdrop and ✕, a trapped Tab, and **focus RESTORED to the card that opened it**. The
open state and the dialog live in the PRIMITIVE — `src/sections/*` stay presentation-only (the
v3.73 boundary, pinned) — and a band with no explainer degrades to a plain `<div>`, because a
button that opens nothing is a lie. The affordance is a ⓘ on the row that already exists plus a
visually-hidden sentence: measured, a separate "WHAT IS THIS? →" line cost 33px across three
cards and broke the glance budget, for a second way of saying the same thing.
**Three research corrections, each of which was live copy.** The explainer copy was sourced
before it was written, and it found: **the Fed's 2% target is on PCE, not CPI** (FOMC Statement
on Longer-Run Goals, 2012) — the 8/29 locked ruler's tail *"Fed target 2% is context"* read as
a 2% CPI target and is REMOVED, with the correct statement and the PCE distinction moved into
the sheet and the withdrawn claim pinned ABSENT (the v3.85 retired-instruction rule); **VIX's
30 line is market convention, not a Cboe-published threshold**, and the sheet says so; and
**"price is what you pay, value is what you get" is Graham's**, quoted by Buffett — shipping it
as Buffett's would be a fabricated provenance, the same defect class as a fabricated number, so
the attribution is pinned. Quotes render ONLY with an attribution; bands with no verified quote
(10Y's "gravity" line has a contested venue and wording) carry `null`, not a paraphrase.
**(4) The 5 Whys sound like macro** (owner): WHY #3's transmission clauses now name the CHANNEL
each factor runs through — discount rate and duration, the 30-day price of protection, the
policy path, the earnings cushion, the credit channel — still clause-length, because three long
ones would turn the most explanatory why into a wall.
Budgets re-pinned WITH their measurements and reasons (the v3.45/v3.95/v4.1.3 rule, never
quietly loosened): the glance budget 780 → **820** at 390×844 (measured 747 → 794 → **788**
after compacting the ruler line, then **791** with the ⓘ; 820 keeps SPY inside the 844px first
screen while leaving headroom for the CI font variance that turned v4.1.3 red), and the
assertion now reports its own measurement.
Tests: **2081 smoke + 306 render + 221 public-render**, `audit:prod` clean, real Chromium under
`REQUIRE_BROWSER=1`. The sheet is DRIVEN, not string-pinned: tap → labelled dialog → four
sections → Escape returns focus to the card → ✕ → backdrop, with no page errors. Negative
controls: a moved vote edge with a stale ruler (4 red), a removed ruler (3 red), the derived
clause disabled (4 red), a misattributed quote (1 red), a removed explainer (4 red), a dropped
focus restore (1 browser red). Two of those controls found a defect in the PINS themselves —
predicates that CRASHED the run instead of failing it, printing no total (the v3.99.4 P0 shape);
both are guarded now, because a suite that dies mid-run reads as a suite that never ran.

**v5.7.2 — the NEXT $ glance stops shouting in small type (owner, on the live 8/27 board:
"come on this is too much text. I think trim is too small? And the tickers are small too?").**
Three fixes, all density/typography, no logic moved.
**The TODAY wall.** `renderToday` rendered `a.sub` unbounded, and `sub` is owner/board free
text — the 8/27 FOMC item alone put ~15 lines of Jackson Hole research above the four items
below it, so the LIST stopped being a list. The v3.66 QUIET BOARD rule finally reaches TODAY:
the note truncates at `TDY_SUB_CAP=140` in place with the full text VERBATIM one tap deep,
while the HEADLINE — which carries the decision and its severity colour — is never truncated
(v3.25 holds while closed). 140 is chosen so the ordinary cap/answer notes (90-140 chars,
e.g. the "asterisk, not a veto · denominator = account equity" line) still read whole and
only the wall collapses. The headline also gains its own size (`--fs-m`, 600) so it reads
above its note rather than level with it. **Reading the note is not a navigation:** a TODAY
row carrying a `go()` would have navigated on a tap meant for the expander, so the handler
ignores clicks inside the `<details>`.
**The TRIM chip was chrome-sized.** `TRIM · N cap` names the positions standing over the
reference cap and sat at `--fs-xs` — the same weight as `DESK ▾` and the quote stamp. It now
reads a step larger, bolder, full-amber border, with a ≥34px thumb target: the v3.25 rule
applied to SIZE, not just presence.
**The ticker was the smallest thing in its own row.** `.glance-row .sym` inherited the row's
size (11px on a phone) with only `font-weight:800` to distinguish it, so the identity you
scan for read no louder than the reason text beside it — `--fs-m`, and `--fs-l` at ≤700px.
Tests: 2030 smoke + **306 render** (+6: the truncation driven with a deliberately long
fixture label — the old short one never exercised the path — the headline-never-truncated
and ordinary-note-whole controls, a REAL tap on the expander proving it does not navigate,
and BOTH sizes MEASURED at 390px via getComputedStyle rather than asserted from CSS text)
+ 192 public-render. Negative-controlled three ways: removing the click guard, and reverting
each size change, each turn exactly their own pins red. One assertion was caught vacuous
while being written (it pinned a regex against a string the test itself supplied) and
rewritten to drive the real behaviour — the v3.60.1 self-matching trap, again.

**v5.7.1 — the arrival race fixed, and the card becomes readable (owner screenshots,
2026-08-27: "Joby is empty somehow? Come on? Nbis is so wordy and difficult to read").**
Two defects, one mine and one structural, plus the card redesign the second one demanded.
**(1) THE ARRIVAL RACE — a v5.6.9 bug, mine.** Tapping JOBY on the dock opened its card
reading "no thesis payload yet" while the DD store held its full thesis. `honourArrival()`
ran inside `loadBook()`'s success path — BEFORE `loadDeepDiveIndex()` in `secondaryLoads()` —
so it judged an UNREAD store and misread every store-held payload as absent (the v5.6.4
"not read is not not-there" class, reintroduced one release after it was named). The render
suite missed it because its payload-name fixture (#aaa) embeds the payload IN the book, the
pre-migration shape — populated the instant loadBook returns, which production is not.
Fixed: honourArrival runs at the END of `bootLoads()`, after the index has landed, and
resolves AFFIRMATIVELY (`ddOf(x)` → open the thesis tab · book name without payload → card +
honest toast · unknown sym → named) — the old `TAB===sym` early-return was never evidence
the tab opened, since renderTabs legitimately resets TAB to BOARD while the index is empty.
An empty book consumes the arrival (nothing to focus; the import modal must not be stacked
over). The race is now A TEST: the payload arrival case moved to **#jjj, the store-only
fixture name**, which goes red under any arrival that fires before the index lands.
**(1b) `readiness()` stops lying during boot.** Its "no thesis payload" blocker never
consulted `DD_PENDING`/`DD_FAILED` — the JOBY screenshot's BLOCKED row was a claim about a
store nobody had read. Three honest states now (still loading / did not load / genuinely
none), ALL still blockers — fail closed on unread evidence; only the CLAIM changed. The
ranking-table sibling gains the missing `DD_PENDING` arm too. Found while wiring: the [51]
smoke lift needed `DD_PENDING` passed BY VALUE — the v3.47 free-variable lesson, 4th time.
**(2) THE READABLE CARD** (owner spec: *"simple thesis one or two sentence, price target
ladder, and gates color coded are the primary — deep dive and additional can be behind a
window"*, for the everyday investor and the new one alike). The card now leads with the
ANSWER: **executive summary first** — `ddExec(x,dd)`, the SAME builder the deep-dive tab
renders, one computation at two altitudes, so the card can never quote a thesis or target
the tab disagrees with; an absent payload states its three honest states, never a guess.
**Gates became colored chips**: ✓ green / ✗ red / ? amber per gate with the id as the label,
every non-PASS chip VISIBLE while collapsed (v3.25 — the chip IS the red fact), the
full-sentence reasons VERBATIM one tap deep with the not-passing count on the summary
(v3.66), the stale-receipt warning staying on the face because it gates action. The NBIS
wall (~8 sentence rows before tier) is one chip row. **Every editor moved behind ONE
✎ EDIT window** (owner call via AskUserQuestion: all edits collapsed; TIER reads in the
card header) — markup verbatim, ids and save wiring untouched, MEASURED inside too; the
v5.7.0 Stamp tile's attestation path opens the window before focusing `fLastRun` (a focus
into a closed `<details>` scrolls nowhere — caught by the existing altitude test).
Tests: **2030 smoke** (+6 card/gates pins, +3 arrival/honesty pins re-pinned on the new
contract, 2 boot-chain literals re-pinned) + **300 render** (+7 card assertions driven
live incl. the closed-state chip proofs via innerText, +2 the #jjj race-as-a-test) + 192
public-render. Negative-controlled three ways: the racy call site restored turns exactly
the two #jjj assertions red; the readiness branch collapsed turns its pin red; the reasons
inlined back onto the face turns the three chip assertions red.

**v5.7.0 "TT Altitude" makes the terminal a glance product before it becomes a desk.**
`/admin.html` now defaults to a three-object NEXT $ surface: the existing capital gate with
an informal alias plus its exact canonical verdict, one selected next-dollar candidate, and
that name's run-attestation state. The Stamp tile opens and focuses the existing `LAST TT RUN`
control but never stamps or saves by itself. The comparable top-five rank is one line per name
with detail on selection; full methodology, receipts, model notes, calendar, and diagnostics
remain in DESK and still read the same computations. NEXT $ and BOOK are the only persistent
modes, cap state is an amber `TRIM · N cap` chip linking to a standalone FUND route, and MAG 7
is a BOOK cluster rather than a competing capital-allocation page. Additive hash routes
(`#next`, `#fund`, `#book`, `#book/mag7`, `#book/<symbol>`) support back/forward navigation
while legacy `#symbol` deep links remain valid. No API, KV schema, ranking, gate, receipt, or
attestation semantics changed; the public macro dashboard remains frozen.

**v5.5.0 "Accountability + Daily Friction" scores the call instead of adding more data.**
The scheduled Worker now maintains a separate `md-spy-outcome-v1` companion for every
successfully frozen public call. The first official FRED `SP500` close on or after the 10am ET
call is day zero; 1d/5d/20d are subsequent trading closes, and max drawdown runs through the
fixed 20-session window (explicitly “so far” until complete). Outcome companions can mature,
but the original `md-history-record-v1` call remains byte-immutable. `/history.json` joins the
two records and `/history` renders pending or realized outcomes without invented zeros. After
capture, `/api/snapshot`, `/readout.json`, the public hero, and clipboard share all use that
same frozen call; later evidence may be named as drift but cannot rewrite the call being
scored. A hero-adjacent **Copy posture** control emits a compact five-line text card with the
public track-record link. The legacy TT `regime` remains current and unchanged during its
compatibility window; no homepage tile, factor, series-count expansion, or TT redesign landed.

**v5.4.0 "Why This Call" is the evidence-integrity repair.** The former 5 Whys was an
unclear mixture of canonical voters, context-only gauges, one RSS item, and a curated risk
register; it did not form a causal chain. The replacement is five explicit checks generated
from the canonical `md-call-v1` factor rows: call arithmetic → actual drivers → transmission
mechanism → evidence quality/provenance → nearest load-bearing change. Headlines are named as
context only and never described as the cause of the call. CPI now uses the official BLS
not-seasonally-adjusted FRED series (`CPIAUCNS` / `CPILFENS`) so the displayed 12-month number
matches the BLS headline release; the Fed strip leads with the daily target range rather than
the lagging monthly FEDFUNDS average. Snapshot cache schema `v16` forces the corrected series
through every consumer. The 10am Worker refresh returns its complete candidate readout and the
history capture freezes that exact call, avoiding an eventually-consistent KV reread. Production
still requires the same high-entropy `REFRESH_TOKEN` on both Pages and the Worker; the gates pin
that requirement so the legacy `REFRESH_SECRET` can no longer masquerade as active refresh auth.

**v5.3.0 "One Call" is the product-identity and accountability release.** MacroDash has one
canonical public daily call derived from the existing public six-factor backdrop engine
(10Y direction · VIX · Fear & Greed · CPI trend · Shiller CAPE · NFCI). Its primary human
vocabulary is **MOONING 🚀 / HODL 💎 / DIAMOND HANDS 🙌**; its secondary machine direction is
**BULLISH / NEUTRAL / BEARISH**. `src/macroCall.js` is the pure projection shared by the hero,
5 Whys, daily-call clipboard, and `/readout.json`'s additive `call` block (`md-call-v1`). The
old `tt-v1` `regime` block remains unchanged for existing operator order-gating during the
compatibility window; a stable contract is never silently repurposed. Public product identity
consumes the new call. Macro Flip/PANIC is a separate safety
override: panic forces the effective call bearish, and a blind circuit asymmetrically
withholds a bullish call. `/history.json` + `/history` expose one immutable live-forward call
captured by the existing 10am ET weekday cron (failures and data holds remain visible; there
is no invented backfill). `/difference` states the product job and hierarchy in one page:
six factors → evidence quality → market posture → explanation → actionability. **Product
constraint: do not add homepage indicators or tiles merely to compete on indicator count.**

**v3.3 "TT readout" adds a machine-readable regime API.** `/readout.json` (Pages Function
`functions/readout.json.js`, CORS-open, `tt-v1` schema) derives an external trading-terminal
readout from the same per-ET-day snapshot: six band checks → `TAILWIND|NEUTRAL|HEADWIND|PANIC`
(**ENGINE0-CONT, v3.63: the literal `INSUFFICIENT` is no longer PUBLISHED as a verdict** — a
<3-usable day reads `NEUTRAL` on the direction axis and says so on the evidence axis,
`confidence`/`actionability`/`status`; `raw_verdict` keeps the honest record) + a **Macro Flip**
circuit (armed VIX>22 · tripped SPY<200d AND VIX>25). The pure
mapping lives in **`src/ttReadout.js`** (`DEC-33` band table — it gates real orders, so every
boundary is smoke-tested; **first `functions/`→`src/` import** in the repo, esbuild-inlined).
A **Macro Flip banner** (`FEAT-331`) and **"Copy TT readout" button** (`FEAT-332`) surface the
same on the dashboard — both live-only, rendering nothing on mock/stale (honesty invariant holds).

**Status: the current version is whatever `package.json` says — this header deliberately no
longer restates it.** It read "v3.2.0" for ~58 point releases while the changelog below ran
current (2026-08-02 audit §5): a summary line that has to be hand-bumped on every release is
a rot vector, and the release notes further down are the living record. **Live FRED (incl.
HY-IG credit spreads) + sentiment + Kalshi + RSS-headline + AI token economics + equity
quotes + Shiller CAPE are flowing.** The
dashboard fetches `/api/snapshot` and overlays the mapped `SOURCES` fields (equity + rates +
inflation YoY + sentiment + FOMC odds + top market headline + **personal saving rate** +
**HY-IG credit spread** + **LLM token $/Mtok** + **QQQ/Mag-10 prices** + **Shiller CAPE**) on top
of the mock baseline. **v3.0 differentiator = "AI Unit Economics":** the curated GPU $/hr cost
side is paired with the live LLM token price (P) and token volume (Q, both OpenRouter; P×Q
is the demand read, v3.89) — the two halves of the AI
margin-compression hinge.
**v3.1 safety invariant: no number a friend could act on may read as live unless it is.**
Mock/no-feed tiles get a diagonal-hatch **ILLUSTRATIVE** treatment, and any directional VERDICT
(BULLISH/BEARISH/BUBBLE) is **suppressed on mock/stale data** (`isIllustrative()`/`IllustrativeChip`/
`ILLUS_HATCH` in `dashboard.jsx`) — a fabricated directional call is worse than a fabricated number.
Each live tile carries per-field provenance (LIVE/CACHED/STALE/MOCK) and an observation date,
with **cadence-aware staleness** (daily/weekly/monthly) and a top-level **Signal Quality**
rollup. The regime vote + 5 Whys **exclude stale/dead inputs**. `_diag` is gated behind `?debug=1`.
**v3.2 default view = live-first (honesty-by-omission):** stale and curated/illustrative content
is **demoted behind per-section `CollapsedGroup` "+N stale/curated" expanders** (`FEAT-321/322` in
`dashboard.jsx`) instead of renting default-view space at full size — Gold (no `SOURCES` key,
permanently curated), the GPU $/hr card, headwinds, IPO strip, Mag-10, and watchlist all default
closed; Signal Quality stays always-visible as the tell. The `demoted()` helper gates on `anyLive`
so pure mock/demo mode (where everything is MOCK by design) never collapses. **CBOE Put/Call is
fully retired** (`DEC-31`: tile, 5-factor regime vote, `SOURCES`, scraper all removed — the free
feed died in 2019; the footer keeps the history note).
**`package.json` `version` is the single source of truth** — Vite injects it as
`__APP_VERSION__` and the footer renders it (the old "footer string is canonical /
package.json is stale" drift is resolved; bump `package.json` on every release).

**v3.8 "FEAT-SNAP-SAFE" adds the missing half of the honesty invariant: PLAUSIBILITY.**
v3.1 enforced *liveness* and *provenance* but never asked whether a number could be **true** —
a decimal-shifted upstream value passed every check, rendered with a green LIVE badge and cast
a regime vote. `BANDS`/`applyBands()` in `snapshot.js` now drop out-of-band values *before*
render or cache (wide bands: reject the impossible, not the unusual — **negative WTI is
explicitly allowed**, it really happened 2020-04-20). Dropped keys are named in `_diag.bandDropped`.
**The write-through gate is now a named-field quorum**, not a key count: `QUORUM_FIELDS`
(the regime's voters) with `QUORUM_MIN=4`. The old `fredCount >= 6` counted *output keys*, and
`tenYear` alone emits exactly six — so **1 of 15 FRED series could lock a gutted snapshot in for
the whole ET day**. Below quorum the payload is still served (mock-first holds) but cached only
for `SETTLING_TTL`, so the next visit retries instead of inheriting the bad day.
**`session` is recomputed on cached reads** — it describes the *current* session, so it was the
one field that must never be frozen; a 01:49 ET cold fetch had the header reading `PRE` through
the close while the 5-Whys used a client-side `etSession()` and disagreed on the same page.
Also: `pct()` returns NaN on a zero/negative base (sign inversion), a blank CNN F&G score no
longer parses to `0` → "Extreme Fear" → a phantom bear vote, and the cron worker gained an
**8am ET pre-open warm** (`SNAPSHOT_PREWARM_CRON`, no-op if already cached) so no human pays the
cold fetch and concurrent first-visitors can't stampede FRED/Finnhub rate limits.

## Tech stack

- **React 18.3.1** + **Vite 5.3.1** (`@vitejs/plugin-react`). Plain **JSX/JS, ESM**
  (`"type": "module"`). **No TypeScript.**
- **recharts 2.12.7** for charts/sparklines. `lucide-react` is in `dependencies` but
  currently **unused** (no imports) — emoji/SVG glyphs are inlined instead.
- **Styling: inline styles only.** No Tailwind, no CSS modules. Design tokens are JS
  objects `DT` (raw) and `T` (semantic alias) at the top of `dashboard.jsx`. A comment
  cites `design-tokens.json` as "canonical," but that file is **not in the repo** — the
  inline `DT` object is the de-facto source of truth. Keep token edits there.
- **Cloudflare Pages** (static SPA) + **Pages Functions** (`/api/*` at the edge) +
  a separate **Cloudflare cron Worker** (`worker/`). **KV** (`PULSE_CACHE`) for caching.
- **Node ≥20 required for tooling** (`package.json` engines — the ONE baseline; `.nvmrc`
  pins 22, CI runs 20). The smoke suite needs the global WebCrypto (`crypto.subtle`,
  Node 19+) for the Kalshi signer test, which is what retired the old "≥17" claim —
  four surfaces used to advertise four different floors (2026-08-17 ambiguity review).

## File structure

```
index.html              Vite entry; mounts /src/main.jsx; PWA meta + manifest
vite.config.js          Vite + react plugin (minimal)
manifest.webmanifest    Add-to-Home-Screen
package.json            deps + dev/build/preview scripts + version (SOURCE OF TRUTH)

(A consolidated REGIME LOGIC REFERENCE — both engines' bands, the veto order, the
 ranking method and every constant — deliberately does NOT live here. It leaked no
 book content, but one file describing the whole decision architecture is more
 useful to an adversary than the same facts spread across source comments. Same
 reasoning as the KV-only TT framework doc. It lives as a chat artifact; smoke [33]
 asserts no REGIME_LOGIC_REFERENCE file exists in the repo under any name.)

src/
  main.jsx              React root (StrictMode) → <App/>
  App.jsx               Thin wrapper. Computes publicView from ?view=public or
                        VITE_PUBLIC_VIEW, passes it to <Dashboard/>. Does NOT touch
                        dashboard.jsx (T2 scope rule).
  dashboard.jsx         THE UI (~1.6K lines). MOCK_DATA, design tokens, every
                        component, the rule-based regime engine, footer version.
  useMarketData.js      The ONE data-wiring point (hook). Reads VITE_DATA_MODE.
  sources.js            Pure merge module: SOURCES field map + mergeLiveOverMock()
                        + isStale/cadenceOf/parseObsDate + MARKET_HOLIDAYS/
                        isMarketHoliday (the ONE US-market calendar — ⚠️ update
                        annually; feeds isStale, marketSession, etSession,
                        looksBehind). No React → Node-testable.
  fiveWhys.js           Pure rule-based 5-Whys generator (no React, no LLM, $0);
                        smoke-tested.
  regime.js             THE public regime engine (C1, v3.60): NFCI bands, REGIME_BAND_TABLE,
                        verdictFrom, computeRegime, flipConditions, regimeFactors,
                        REGIME_QUORUM — extracted verbatim from dashboard.jsx; pure,
                        Node-importable (smoke imports it directly, no more source-lifts).
                        Returns tintKey/colorKey; the UI resolves colors.
  evidence.js           The EvidenceSet contract (C1, v3.60): fieldMode + factorExclusions
                        (ONE home for modeOf and the mock-cannot-vote rule) +
                        buildEvidenceSet → {state LOADING|LIVE|CACHED|DEGRADED|INSUFFICIENT|
                        ERROR|DEMO, factors[], flips, quorum…}. New components render THIS,
                        never their own reading of provenance.
  whatChanged.js        Return-visit digest (C4, v3.60): summarizeEvidence (only quorate
                        live sets may become the baseline) + compareEvidence (posture flips,
                        confidence moves, factor drop-outs/recoveries; "baseline set" ≠
                        "no change"). localStorage key md:lastvalid:v1.
  ttReadout.js          Pure TT regime/Macro-Flip mapping (DEC-33 band table).
                        Imported by dashboard.jsx, functions/readout.json.js
                        (first functions→src import), and smoke. React-free.

functions/              Cloudflare Pages Functions (run at the edge, same origin)
  _middleware.js        Security headers; keeps /api same-origin (no CORS).
  api/snapshot.js       ACTIVE live source. Assembles FRED + FRED-SP500 + CNN F&G +
                        Kalshi + RSS + OpenRouter + Finnhub + multpl. Holds
                        env.FRED_KEY. Per-ET-day KV cache. Imports src/sources.js
                        (market calendar) — second functions/→src/ import, same
                        esbuild-inline path readout.json.js proved.
  api/fred.js           Legacy/fallback. Reads ONLY the cron-written KV key
                        (pulse:macro:latest); has NO key, makes NO upstream calls.
  api/deepdive.js       Thesis payloads, ONE KEY PER SYMBOL (tt:dd:v1:<SYM>) + a small
                        board index (tt:dd:index:v1). PIN-gated like /api/tt. The book
                        document no longer carries deepDive at all (v3.75).
  readout.json.js       /readout.json — public tt-v1 regime readout (CORS-open).
                        Reads the day's snapshot KV (subrequest /api/snapshot on
                        miss); maps via src/ttReadout.js. No new infra/cron.
  lib/tt-v2.js          Shared pure licensed-input schema, metrics, composite, gate
                        receipt and attestation logic used by Functions + smoke.
  lib/tt-technicals.js  Deterministic OHLC/ATR/pivot/support/stop/R-R derivation.
  lib/tt-facts.js       SEC normalization + merge-only last-good fact semantics.
  api/street.js         Reviewed SA/TipRanks records + immutable revision history.
  api/street/ocr.js     Ephemeral Workers AI screenshot-to-review-draft route.
  api/ticker-facts.js   Finnhub/SEC per-symbol measured-facts refresh/store.
  api/ticker-analysis.js Server-side gate run + immutable attested receipt history.

worker/                 SEPARATE Cloudflare Worker (not part of Pages)
  cron.js               Scheduled handler: pulls FRED twice daily → writes KV
                        pulse:macro:latest (+ optional POST /refresh warm).
  wrangler.toml         Worker config: PULSE_CACHE binding + cron triggers (UTC).

test/
  smoke.mjs             No-network smoke test: 566 assertions over mergeLiveOverMock
                        + SOURCES-path resolution against the real MOCK_DATA + the
                        5-Whys engine + DEC-31 guards + the TT band table (DEC-33)
                        + the market-holiday calendar (sessions + staleness).
  render.mjs            Browser render test for public/admin.html (`npm run test:ui`).
                        admin.html is buildless, so smoke can only pin STRINGS; this
                        serves the real file with a stubbed API and drives it in
                        Chromium at 390px + 1200px. SYNTHETIC fixture only (same
                        invariant as SEED/BOARD). SKIPS cleanly (exit 0) with no
                        browser, so `npm test` on a bare machine is unaffected.
```

## Data flow (how mock becomes live)

```
dashboard.jsx  →  useMarketData(MOCK_DATA, {publicView})  →  fetch /api/snapshot
                                                                     │
        mergeLiveOverMock(mock, payload)  ←──────────────  { live:{…}, cached, asOf }
                     │
   overlays ONLY mapped SOURCES paths; everything else stays mock
                     │
        badge = MOCK | LOADING | LIVE | CACHED | ERROR   (shown in header + source boxes)
```

- **Mock-first / graceful degradation is the core invariant.** `MOCK_DATA` in
  `dashboard.jsx` is the always-present baseline. Live values overlay only the exact
  paths declared in `sources.js`. A whole-fetch failure on a live build → mode **`ERROR`**
  (v3.59 B1): mock content still renders underneath, everything stays ILLUSTRATIVE, and the
  header states the outage with a ↻ RETRY — visible, deliberately NOT silent (this line said
  "silent fallback" for ~40 releases after B1 made it visible; 2026-08-17 review). A bad
  *individual* value is still dropped silently to its mock baseline (bands/kind checks).
  **The dashboard never breaks on bad data.**
- `sources.js` `SOURCES` maps each flat snapshot field → a dotted `MOCK_DATA` path +
  a `kind` (`num` | `series` | `str`) that is validated before overlay. `setPath` clones
  (never mutates) the mock.
- `displayClass` (`public` | `citation` | `licensed`) drives the public view. On
  `?view=public`, `licensed`-class fields are skipped. (Today nothing is `licensed` in
  the snapshot path, so public == full for live data; the mechanism is wired for later.)

## Data sources

### FRED (`fetchFred` in `functions/api/snapshot.js`)
St. Louis Fed API (`api.stlouisfed.org`), keyed by `env.FRED_KEY`. Pulls these series,
takes the latest non-`"."` observation, and derives 1-day deltas + sparklines:

`DGS10` (10Y) · `FEDFUNDS` · `CPIAUCNS` (official headline CPI NSA) · `CPILFENS` (official core CPI NSA) ·
`PCEPI` (PCE headline) · `PCEPILFE` (PCE core) · `UNRATE` · `CIVPART` (LFPR) ·
`PSAVERT` (personal saving rate, v3.0) · `MORTGAGE30US` · `DCOILWTICO` (WTI) · `VIXCLS` (VIX) ·
`CBBTCUSD` (BTC) · `BAMLH0A0HYM2` (HY OAS) + `BAMLC0A0CM` (IG OAS) → the derived **HY-IG credit
spread** (widening = bearish leading indicator).

(Gold has **no live source** — it's a curated `Manual` series with no `SOURCES` key, so its tile
is permanently ILLUSTRATIVE and demoted behind the Cross-Asset expander.)

The four **inflation** series (CPI/PCE × headline/core) are price *indexes*; the dashboard
wants **YoY %**, so for those `fetchFred` pulls 20 monthly points and derives
`(latest / 12-months-prior − 1) × 100` plus a 6-point YoY trend (FEAT-R10, v2.6.4).

### FRED-SP500 proxy (`fetchSpy` in `functions/api/snapshot.js`)
Equity prices come from **FRED's `SP500` index, not a stock API** — Stooq blocks
Cloudflare edge IPs, so SPY is sourced from the same proven FRED path. **`SPY ≈ SP500
/ 10`** (the ETF was designed at ~1/10 of the index). From a 220-point pull it computes
`spyPrice`, `spyChangePct`, `spyYtd` (anchored to the most recent prior-year close — the exact
Jan-anchor shipped; see `snapshot.js` ~318–328), `spyMa100`, `spyMa200`, and a 20-pt sparkline.

### Scrapers (sentiment, also in snapshot.js)
- **CNN Fear & Greed** (`fetchFearGreed`): `production.dataviz.cnn.io/.../graphdata/<YYYY-MM-DD>`.
  Needs a full desktop Chrome UA + Accept + Origin/Referer = `edition.cnn.com`, else 418.
- **CBOE Put/Call: RETIRED (DEC-31, v3.2).** The free feed died in 2019; the scraper, tile,
  SOURCES entry, and regime vote (now 5-factor) are all removed. The footer keeps the note.
- **Kalshi FOMC rate odds** (`fetchRateOdds`, FEAT-R9, v2.6.3): public market-data REST
  API (`api.elections.kalshi.com`, no auth/key). Takes the nearest open `KXFEDDECISION`
  event and aggregates its mutually-exclusive buckets (H0=hold · C25/C26=cut ·
  H25/H26=hike) by last traded price → normalized hold/cut/hike % + FOMC days-out.
- **Top market headline** (`fetchHeadline`, FEAT-NEWS, v2.9.0): the one non-FRED, non-market
  *news* source. Top item from a market RSS feed (Dow Jones/MarketWatch `mw_topstories`;
  CNBC fallback). DATE-VERIFIED: parses the item `pubDate` and only accepts a headline ≤~3
  days old, emitting its real ET date so `isStale` guards it. Feeds **WHY #3** of the 5 Whys.
  Source + date are attributed (no automated claim-fact-checking; reputable wire + date gate).
- **AI token economics — the moat** (`fetchTokenomics`, v3.0): OpenRouter's **public** models
  API (`openrouter.ai/api/v1/models`, no key — like Kalshi). Blends a frontier-model basket
  into a median **$/Mtok** (3:1 in:out), tracks the cheapest-frontier floor, and accrues a
  rolling 12-pt trend in KV (`pulse:tokentrend`). Falling $/Mtok = intelligence commoditizing
  → the P leg beside the curated GPU $/hr supply squeeze (token VOLUME is the Q leg since
  v3.89; P×Q is the demand read). Rendered as the
  **"AI Unit Economics"** section (TokenomicsCard beside GpuPricingCard). Emits via SOURCES
  `tokenBlendedMtok`/`tokenTrend`/`tokenModelsJson` (weekly cadence). On the `withLastGood` rails.
- **Equity quotes** (`fetchEquities`, v3.0): **Finnhub** free-tier (`finnhub.io/api/v1/quote`,
  `env.FINNHUB_KEY`) for **QQQ** + the 9 public **Mag-10** tickers — the equities FRED can't
  source. Quotes (price + change%) go live; Mag-10 **fundamentals stay curated** (reviewed
  date). KEY-GATED: no key → throws → mock (invariant holds). `mag10PricesJson` is a JSON
  passthrough merged onto the `mag10` array by ticker at render. On the `withLastGood` rails.

- **Shiller CAPE** (`fetchShiller`, v3.1): scrapes multpl.com for the current Shiller PE — the
  regime's valuation vote, which used to be mock-and-always-voting. Now live (monthly
  cadence) on the `withLastGood` rails; gated by `use("valuation")` in `computeRegime` so it
  drops from the vote when STALE. On mock/stale it shows the ILLUSTRATIVE treatment (no BUBBLE).

> **Scraper resilience (FEAT-R8, v2.6.2):** the scrapers (F&G, Kalshi, headline,
> tokenomics, equities, shiller) run
> through `withLastGood(env, key, fn)` — a success writes `pulse:lastgood:<key>` to KV
> (7-day TTL); a failure serves that last-good value (with its real date, so `isStale`
> flags it STALE) instead of reverting to mock. Mock is the fallback only when there is
> no last-good yet.

## TT Ticker Terminal admin portal (FEAT-TT, v3.4.0)

- **`public/admin.html`** — Vite `public/` passthrough serves the TT tier-board GUI verbatim at
  `/admin.html`. It is the empty template wired to **`/api/tt`** (`functions/api/tt.js`): GET loads
  the book, every mutation (add / card save / remove→CUT / import) optimistically updates then PUTs.
  KV key **`tt:book:v1`** (no TTL) in `PULSE_CACHE` holds `{version, asOf, book, cut}` — plus an
  optional **`board`** (FEAT-TT-SESSION, v3.28) for state no single ticker owns.
- **FEAT-TT-V2 — the operative ticker answer consumes two reviewed licensed inputs.** The owner
  supplies Seeking Alpha forward annual revenue/EPS and TipRanks' published rolling-12-month
  average/low/high target (plus visible analyst/rating counts) through a narrow screenshot/OCR
  review form. OCR is draft-only and has no persistence binding. `/api/street` server-validates
  the confirmed packet and stores it outside the replace-all book; `/api/ticker-facts` separately
  stores merge-only Finnhub/SEC facts; `/api/ticker-analysis` produces an immutable receipt bound
  to exact street/facts/`/readout.json` versions and hashes. The browser renders this receipt — it
  does not decide eligibility. TipRanks' **published average** is consumed directly and is never
  recomputed from low/average/high. `ELIGIBLE` is ticker-level and position-independent; exposure,
  the 18% cap, funding, taxes, and legacy owner `pt_model` are separate sizing/execution context.
  Any required `UNKNOWN`, absent/non-FULL Engine 0 actionability, blind Macro Flip, stale
  session-aware quote/input, <15% gap, failed composite/cited qualitative rubric, or insufficient
  R/R yields `WAIT`; the binary calendar is report-only on both decision surfaces.
  Current contract: `ticker-terminal/README.md`; full schemas/calibration/migration:
  `ticker-terminal/TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`.
- **Auth = config-gated (FEAT-TT-PIN, v3.9.0).** With **`env.TT_PIN` set (exactly 6 digits;
  `npx wrangler pages secret put TT_PIN`)** the terminal runs **PIN mode**: `POST /api/tt {pin}`
  mints a 30-day KV device session (`tt:session:<token>`, HttpOnly/Secure/SameSite=Strict cookie),
  and an **`x-tt-pin` header** authenticates GET/PUT directly (the automation path that unlocks
  future chat-side sync). The PIN is NOT the wall — the wall is the **escalating KV lockout**
  (`tt:auth:lock`: 5 fails → 15 min, 10 → 24 h; pure `lockoutState`/`recordFailure`, smoke-tested)
  plus fail-closed config (malformed TT_PIN → 503, never a silent fallback) and an Origin check on
  POST/PUT (CSRF). Login reports `failed_attempts_since_last_login` — the owner-visible guessing
  tell. **`TT_PIN` unset = legacy Cloudflare Access mode, unchanged** (Zero Trust apps on
  `/admin*` + `/api/tt*`; `tt.js` verifies the `Cf-Access-Jwt-Assertion` JWT against
  `env.ACCESS_TEAM_DOMAIN` certs + `env.ACCESS_AUD`; missing → 503, fail closed) — so the deploy
  is inert until the operator flips the secret, then deletes the Access app at leisure.
  `env.ACCESS_DEV_BYPASS="1"` skips both modes for local `wrangler pages dev` only.
  **v3.10 adds the phone-only setup path:** with no `TT_PIN` secret, the 🔐 PIN button in the
  terminal SETS the PIN through `POST /api/tt {new_pin}` — the claim is authorized by the
  operator's *current Cloudflare Access session* (fail closed: no valid JWT → no claim), stored
  as a salted SHA-256 record in KV (`tt:auth:pin`, `hashPin()` smoke-tested; hygiene not a wall —
  the lockout is the wall), read at request time so **no wrangler, no dashboard, no redeploy**.
  Rotation requires the *current PIN* (a stolen device session can't change the lock); env
  `TT_PIN` always wins over the KV record and disables terminal-side changes (409). While the
  Access app still exists, a valid Access JWT is accepted in PIN mode too (transitional — no
  double login; inert once the app is deleted). Recovery if the PIN is lost after Access is
  gone: `wrangler kv key delete tt:auth:pin` (laptop) restores Access mode.
- **v3.11 "Close the Loop":** the header REGIME pill is **live** — the terminal fetches
  `/readout.json` (non-blocking, 10s timeout) and renders the verdict; INSUFFICIENT and
  fetch-failure render amber "don't gate on this" / "unavailable" (never a defaulted color),
  and a **HEADWIND/PANIC standing modifier** (entry +1 notch · R/R +0.5× / S-tier-only) appears
  on the NEXT DOLLAR line. **"✓ RAN IT — stamp today"** on the card makes run-attestation a
  two-tap loop (deliberately card-only: a board-level stamp could mis-tap-attest a run that
  never happened) — and run stamps now use the **ET date** (the old `toISOString()` UTC stamp
  rolled evening runs to tomorrow → runState read them as future = NEVER RUN). Toolbar demotes
  the four backup/recovery buttons behind **⛭ BACKUP**; the header shows the honest auth line
  ("PIN · Nd" from the session record's server-side `exp`, or "Cloudflare Access").
- **Invariant: the real CANONICAL_BOOK never enters the repo or bundle.** `SEED=[]` stays empty;
  seeding/restore is paste-import in the UI (EXPORT JSON from the Artifacts copy → IMPORT JSON).
- **FEAT-TT-RUN (v3.5.0) applies the dashboard's honesty rule to the book.** Per-entry `lastRun`
  (ISO date of the last harness pass) drives `runState()` — fresh ≤30d · stale >30d · head >90d ·
  **never** (missing *or future-dated*). `ageDays()` **fails closed**: unlike `src/sources.js
  isStale` (which returns `false` on a missing date), an absent `lastRun` reads as NEVER RUN, so an
  unreviewed name can never look reviewed. Chips carry `::before` markers (`::after` is `.fp`'s),
  and a **BOOK COVERAGE** strip mirrors Signal Quality. `lastRun` is *self-attested* — that's the
  known weakness; failing closed is the mitigation.
- **`validateBook()` deliberately passes through unknown per-entry keys** (`fp`, `rank`, `lastRun`)
  — load-bearing, not an oversight, and now covered by smoke section [6] (first behavioral test of
  `functions/` in the repo; `validateBook` is exported solely for it).
- **`persist()` never re-GETs on save failure** — the old catch overwrote `BOOK` from the server and
  silently destroyed the user's edit. It now sets `DIRTY`, shows `#saveBanner` (RETRY / EXPORT /
  explicit discard) and guards `beforeunload`. Client-side pre-flight mirrors the server cap
  (`MAX_BODY`, raised 64KB→200KB in the v3.34 follow-up — see FEAT-TT-POSSTORE below).
- **FEAT-TT-SAFE (v3.6.0) closes the lost-update hole.** The book is a **whole-book replace**,
  so two devices editing concurrently silently clobbered each other. `PUT` now requires
  **`If-Match: <version>`**; a mismatch returns **409 with the server's copy**, and the client
  shows both sides (KEEP MINE / TAKE SERVER'S / EXPORT MINE FIRST). `"*"` or an absent header is
  the documented override (curl recovery). `conflictCheck()` is pure + smoke-tested.
- **Restore points:** the **first** write of each ET day copies the outgoing book to
  `tt:book:snap:<ET-date>` (30d TTL) — first-write-wins so a later mistake can't overwrite the
  good copy it needs. Readable via `GET /api/tt?snapshots=1` (list) and `?snapshot=<date>`, with
  a **⏱ RESTORE POINTS** UI that previews into memory *without* writing (SAVE is a second step).
- Also fixed in v3.6.0: the KV `.put()` is wrapped (an unguarded throw returned an HTML error
  page, which the client misreported as an **auth** failure); `validateBook` rejects **duplicate
  syms** (dupes rendered twice but `find()` resolved only the first → unreachable ghosts) and
  malformed `lastRun`; `importSave` validates **before** overwriting `BOOK`; `exportJSON` reports
  the real version (it hardcoded `"1.1"`, mislabeling every backup); `getKeys` refetches once on a
  `kid` miss (Access key rotation inside the 6h cache window otherwise 403s everything).
- **FEAT-TT-ND (v3.7.0) surfaces the next dollar** at the top of the board — the question the
  whole TT framework exists to answer, previously buried in the last tier. Ranks are free text
  (`"#1 infra"`, `"#1 cross-bucket"`, `"#3"`, `"—"`), and the real book carries **two `#1`s scoped
  to different buckets**, so the queue is **not a total order**: `renderNextDollar()` shows *every*
  entry tied at the lowest rank as a **co-lead** with its scope text, rather than inventing a
  precedence the maintainer never set. Decision-adjacent, so it inherits the honesty rule —
  a lead whose `lastRun` is stale/never shows `⏱ Nd — re-run first` / `○ no TT run on record`.
  Unranked watchlist and empty watchlist each get their own explicit copy (never a blank).
- **FEAT-TT-DD (v3.12) — deep-dive tabs.** A book entry carrying a `deepDive` payload gets a tab
  beside BOARD (hash-routed, e.g. `#nbis`): thesis header + updated-age chip (self-attested; >30d
  → re-review amber; missing date fails closed), PT ladder, **hinges** as tracked fields
  (green/amber/red/unknown + note + asOf), key dates (**past dates render "passed — re-confirm"**),
  position/overlay, linked-exposure line (e.g. the NVDA-9.3%-stake shared-sleeve cap), status
  flags, standing rules. The payload rides `validateBook`'s unknown-key passthrough (server never
  learns the schema; smoke pins the passthrough) with a client-side contract validator
  (`thesis_version` + `updated` required, 8KB/payload cap, all rendered strings HTML-escaped).
  Entry path is the 📊 DEEP DIVE editor on the card (paste JSON) — **thesis/position payloads live
  only in KV, never the repo** (same invariant as the book itself); EXPORT CANONICAL_BOOK.md
  appends `### DEEP_DIVE: <SYM>` sections so re-seeding never loses thesis state.
  **v3.13 makes the renderer corpus-native:** the deep-dive JSON files parse AS-IS (`as_of`
  aliases `updated`; key_dates accept `event`; hinges accept `{id, role}`; pt_ladder values may
  be labeled objects), and rich sections render purpose-built — **four-gate board** (status +
  de-risked bar + evidence), **dilution sequencing grid computed from the pre-committed rule**
  (pts ≈ 100 × $B ÷ price; zones ≤15 green / ≤30 amber / >30 red), kill-combination monitor,
  leading indicators, cert probabilities, utilization underwriting, fleet-vs-burn engine
  (locked inputs + anchors, static — thesis STATE, not a calculator), tape (stamped "NOT
  live"), watchlist unlocks/hedges/open items. **Unknown payload keys fall back to a generic
  k/v render — what's stored is never invisible.**
- **FEAT-TT-PTM (v3.17) — the PT ladder is computed, never typed.** `pt_consensus` static rows
  are superseded by **`pt_model`**: the payload carries the MODEL (per-year EV/S multiple
  schedule · share-count schedule · optional `net_cash_B` · `pe_floor_multiple`), and
  revenue/EPS **default to the sibling `consensus` block** — one source of estimate truth.
  `ddPtModelSec` computes `premium = (mult × FY+1 rev + net cash) ÷ shares` and
  `floor = pe × FY+1 EPS` (rendered `n/m` where EPS ≤ 0 — no P/E before profit); schedules
  accept a number or a sparse per-year map (`schedAt`, nearest key ≤ y); past year-end rows
  auto-drop. A consensus revision is now a **one-field edit that moves every row in lockstep**,
  and the formula line shows what each PT assumes. Reproduces the approved v3.16 ladders:
  floors exactly, premiums within ≤0.7% hand-rounding.
- **FEAT-TT-DOT (v3.17) — the dots inventory.** Capture and synthesis are different jobs.
  A **⊕ DOT** box on each deep-dive tab captures a POINTER (≤280-char line + optional URL,
  never article bodies — the book's PUT cap is the wall), ET-date-stamped, state `new`. Dots
  live on the **book entry** (`e.dots`, validateBook passthrough) so replacing a deepDive
  payload can never wipe the inventory; keep-last-30 prune ages out reviewed/promoted first
  and **never silently drops a `new` dot**. States change only at **triage** (the chat sweep):
  a dot is *material iff it changes (a) a hinge/gate state, (b) a consensus input, or (c) a
  kill-combination condition* — material → `promoted` (with `into` naming the field; with
  FEAT-TT-PTM a consensus change auto-flows to every PT row), else `reviewed` and kept:
  clustering immaterial dots around one hinge is itself signal. Coverage strip shows
  `⊕ N new dots`; capture never touches the thesis — that's the self-attestation rule.
- **FEAT-TT-3Q (v3.14) — the 3 questions.** Every book entry can carry a `projection` (same
  passthrough rails): **(1)** revenue in 3 years — the validator DEMANDS a specific `$B` number;
  **(2)** margins `expanding|holding|compressing` + a required *why*; **(3)** the multiple that
  fits then (+ optional 3-yr per-share number). **Future price = per-share × multiple is
  computed, never typed**, and the 🔥 FLYWHEEL badge lights only when all three engines are
  demonstrably on (rev CAGR ≥10% from `rev_now_B` · margins expanding · `multiple.value` >
  `multiple_now`) — missing inputs render `?` and withhold the badge. Entry path: the
  📐 PROJECTION block on the card (validate-before-mutate, all-three-or-nothing). Coverage
  strip shows `📐 N/M projected`; deep-dive tabs render the answers + math line; EXPORT
  appends a `## PROJECTIONS` table. Import validates projections before overwriting.
- **FEAT-TT-FRAMEWORK (v3.26) — the TT methodology lives in KV, NOT here.** The owner's full
  framework (routing → kill-gates → 5-pillar composite → tier map → technical gate →
  constraints → next dollar → options expression, plus standing rulings R1–R5) is stored at
  KV key **`tt:framework:v1`** via `functions/api/framework.js`, PIN-gated on **both** read
  and write, with a `:prev` rollback copy kept for 30 days. **This repository is PUBLIC** —
  committing that document would publish every gate, threshold, R/R floor, position cap and
  tax route permanently. Same invariant as CANONICAL_BOOK; smoke asserts the file is absent
  from the repo. Key doctrine worth knowing while working here: *fundamentals decide WHAT
  deserves capital, support/resistance decide WHEN, the regime decides HOW STRICT both must
  be; the composite is a permission slip, never a buy button; engine disagreement = WAIT.*
  **`/readout.json` IS Engine 0** — the framework doc still says MacroDash "cannot be fetched
  programmatically, the user pastes it", which v3.3 superseded.
- **FEAT-TT-BINCAL (v3.26) — the binary calendar.** Scheduled binaries (earnings) lived inside
  individual `key_dates` arrays, surfacing only when that tab was opened; a no-new-adds rule is
  worthless if the binary is discovered after sizing. A board strip aggregates every *future*
  key date across the book, sorted by days-out, flagging anything inside `BINARY_WINDOW_D=10`.
  Deliberately **reports, never enforces** — the board does not block orders.
- **FEAT-TT-SESSION (v3.28) — the session layer.** A TT session produces conclusions no single
  ticker owns, and the book had nowhere to put them: the board could show a green NEXT DOLLAR
  while the portfolio was in deleverage-only mode and the top two picks were the same bet twice.
  An optional **`board` object in the same KV document** (`functions/api/tt.js` `validateBoard`,
  16KB cap, `as_of` REQUIRED) now carries six sections, each rendered as its own strip that
  **renders nothing when absent** — no session loaded looks exactly like v3.27, never like empty
  placeholders. **`circuit`** (leverage; renders *above* the next dollar because it gates every
  add, and a `tripped` circuit **vetoes the FEAT-TT-AGREE green line outright** — no per-name
  score clears it) · **`clusters`** ("cluster = one position": flags when two co-leads or two
  computed-upside top ranks sit in the same cluster) · **`funding`** (the deleverage-first trim
  order + `do_not_trim`, with per-row blockers; the question NEXT DOLLAR never answered — where
  the dollar comes *from*) · **`decisions`** (aging in public: >7d amber, >14d red, **undated is
  the worst chip, never the freshest**) · **`binaries`** (non-ticker prints — a supplier's
  earnings that sets the tone for names you hold — merged into the same dated queue, and only
  clickable when a tab actually exists) · **`regime`** (the session's *asserted* read).
  **Two regime engines, married never merged** (`REG_RANK`): MacroDash **measures** one from live
  data, the session **asserts** one; the **stricter governs** the standing modifier and any
  disagreement prints both readings with provenance — averaging them would delete the information.
  Everything here is self-attested, so every strip carries `sessChip()` (the circuit dates its
  asserted state and its `measured_at` measurement **separately** — a fresh assertion must not
  launder a stale number). Entry path is the **◧ SESSION** modal: the top box edits the board,
  the bottom box applies a **handoff patch as a MERGE, never a replace** (`applyHandoff` — a
  session covers only the names it touched, so importing one as a book would delete every name it
  didn't mention; validates whole-patch-before-apply, requires tier+lens to add a name, never
  removes anything, and previews on the unsaved rails until an explicit SAVE). An **absent**
  `board` on PUT is **carried forward, not deleted** (curl/older clients must not eat session
  state). Same invariant as the book: `BOARD` ships empty, content lives only in KV.
- **FEAT-TT-TODAY (v3.29) — the daily loop owns the default view.** v3.28 left the board at
  **nine strips of standing state, full size, every load** — six phone screens before the book.
  But a book in daily monitoring changes maybe one day in five: the signal is the DELTA and the
  DEMAND, not the state. The default view is now **one screen** answering the daily loop in
  order: **STANCE** (may capital move at all — `stance()`: the circuit first because it is a
  portfolio fact no macro verdict un-trips, then the stricter of measured/asserted regime;
  no regime at all reads UNKNOWN, never a defaulted green) · **TODAY** (`todayActions()`,
  ordered by **irreversibility** — tonight's print outranks any add; a deleverage action names
  the *blocker* rather than the trim when one exists; the add candidate is withheld entirely
  whenever anything above it vetoes, and it is the same `AGREE_PICK` the upside widget computed,
  never a second opinion) · **WHAT CHANGED** (`diffSince()` — price moves ≥`MOVE_PCT`, tier/rank
  changes, new red hinges, run stamps, decisions, names entering the no-new-adds window).
  Everything else moved into **one-tap `details.drawer`s whose summaries still carry their
  signal** (the v3.25 hinge rule: a collapse is only honest if a red thing stays visible while
  closed) — nothing was deleted, and the reference sidebar collapsed the same way.
  **The delta baseline is the user's**: it moves only on an explicit *mark seen* (or resets past
  `SEEN_MAX_D=7`), a first visit says "baseline set" rather than "nothing changed", and price
  deltas compare **live to live** — diffing a stamped `ref_px` against the day's first quote
  would report an 11% "move" when nothing moved. `/api/quotes` is now asked for the **whole
  book** (≤40, 2-min KV cache) so every chip carries its day move; a name with no quote shows
  **no number at all**, never a 0 that reads as flat. Header pill relabelled **MACRO** — it is
  MacroDash's *measured* read and looked like it contradicted the stance.
- **FEAT-TT-POS (v3.30) — measured facts, the first non-asserted class in the book.** Every other
  field is *asserted* (a human typed it, `lastRun`/`as_of` ages it). v3.29 made that visible and
  therefore intolerable: `stance()` suspends **all** adds off a hand-typed `circuit.state`, and
  with no position sizes anywhere the **18% cap was prose** and *"cluster = one position"* was a
  rule the software could not evaluate. An entry-level **`pos`** block
  (`{sh, mv, pct, cb, upl_pct, opt[], at, src}`) is written by a broker sync and never by hand.
  It sits beside `dots`, **not inside `deepDive`** — the payload editor replaces that wholesale,
  so facts stored there would die to a thesis paste. `validatePos()` (exported, smoke-tested) is
  **plausibility-banded** in the `BANDS`/`applyBands` spirit: a decimal-shifted weight is rejected
  before it can clear *or* trip a cap, while a **short position (`sh < 0`) is explicitly allowed**.
  What the facts buy: weight on every chip (absent = **no number**, never a 0 that reads as
  not-held) · `capChecks()` for single names **and summed clusters** — an unmeasured member is
  named and the total called a **FLOOR** · `reconcile()` for held-but-untracked ("exposure no
  thesis covers") and tracked-but-not-held · TODAY stops for breaches (a held breach outranks
  anything discretionary) · a deleverage action carrying real share count/value with its blocker
  **verified against actual option legs** · and `board.account` where **`formula` is REQUIRED**,
  so the leverage figure that vetoes every add is checkable by the person it stops. Everything
  inherits `pos.at`: `posChip()` marks stale/undated, and cap checks computed off an old mark
  say so. Also v3.30: `governingRegime()` is now the **single** derivation of "stricter of
  measured vs asserted" (`stance()` and `regimeModifier()` had a copy each), and `loadQuotes()`
  **states its 40-symbol cap** and names the unquoted tail instead of truncating silently.
- **FEAT-TT-DDFOCUS (v3.31) — the deep-dive tab answers four questions first.** The tab was
  emitting ~20 sections at full size: the pre-v3.29 board, one level down. A reader arrives at a
  name with the same four questions every time, so `ddAnswerBlock()` answers them above the
  corpus — **what it's worth** (`ddWorth()` reuses `ptModelRows()`, so the cell can never quote a
  target the ladder below it disagrees with; no model says *"no model"* rather than showing a
  number) · **what changes my mind** (hinge tally, reds named) · **when** (next future key date) ·
  **what I own** (the v3.30 `pos`; unmeasured reads *"not synced, which is not the same as not
  held"*). The corpus groups into `ddDrawer()`s — VALUATION · THESIS & GATES · KEY DATES ·
  CAPITAL & EXPOSURE · TRACKING & MODEL · DOTS · OTHER — each summary carrying its own signal
  (failing gate count, kill-combo presence, next date, new-dot count). **An empty drawer never
  renders**, unknown payload keys are **named in the summary** (stored is never invisible), and
  `DD_OPEN` preserves open state so a quote landing can't collapse what you just opened.
- **FEAT-TT-RENDER (v3.31) — `test/render.mjs` (`npm run test:ui`).** `admin.html` is buildless,
  so smoke can only pin load-bearing STRINGS; that catches deletions but not a strip that renders
  empty, a drawer that hides a red thing, a dead click, or a template literal that throws. This
  serves the real file with a stubbed `/api/tt` + `/readout.json` + `/api/quotes` and drives it in
  Chromium at **390px and 1200px** (103 assertions). It has already caught bugs the source guards
  could not. **The fixture is SYNTHETIC** — no real ticker, position or session content enters
  this repo, same invariant as `SEED`/`BOARD`. It **skips cleanly (exit 0)** when playwright-core
  or a browser is missing, so it is additive and never breaks `npm test` on a bare machine.
- **FEAT-TT-LEDGER (v3.32) — the belief ledger: the one thing the terminal never had, memory.**
  Robinhood/Seeking Alpha/Yahoo all show what the MARKET thinks; this terminal's moat is what
  YOU think — tiers, projections, PT models, hinges — but every one of those fields overwrote in
  place. It could never answer *"was I right?"*, never show what you believed when NBIS was $51,
  never catch the CRDO pattern (estimates up, price down = sentiment derate, not thesis break)
  except by a human noticing it by hand. **`diffForLedger()`** (`functions/api/tt.js`, pure,
  exported for smoke) diffs every PUT's book against the one stored and logs **beliefs only** —
  the user's explicit call, no trade/position logging: `add`/`remove`/`tier`/`rank`/`run`/
  `thesis`/`hinge`/`pt`/`proj`/`comp`/`est`/`cut`. It does **not** log `pos`, `ref_px`, `dots`, or
  note text — facts and scratch, not conviction. Hinges are matched by **identity**
  (`label||key||id`, the same rule `validateDeepDive` already uses), never array position, so a
  reordered payload can't misattribute a state flip. The composite score is recovered from free
  text via the **same** `parseCompositeScore` logic the v3.31.1 audit fixed client-side (decimal
  preferred over a bare integer — "R3-A: 9.0" reads 9.0, never 3). Each entry is stamped
  `{t, v, kind, sym, field, from, to}` **server-side** — never self-attested — and appended
  **fire-and-forget** after the book write succeeds (`appendLedger`, KV keys `tt:ledger:<sym>`
  capped at 500 entries + `tt:ledger:index`); a ledger fault must never fail the write the user is
  waiting on. `px` is stamped from the `tt:quote:<sym>` cache `functions/api/quotes.js` already
  warms — no new upstream calls. **`functions/api/ledger.js`** is the READ-ONLY path (PIN-gated,
  same as `/api/tt` — belief history is as private as the book): the index, one sym's entries
  (`?sym=`), the whole book's recent entries in one list+N (`?recent=1&days=`, so the client never
  does an N+1 round trip), and a one-time idempotent backfill (`?seed=1`) that walks the existing
  30-day `tt:book:snap:*` recovery snapshots and diffs them chronologically — historical `px` is
  honest best-effort (a nearby-dated `ref_px` or `null`, never fabricated). Client-side: a
  per-name **HISTORY** drawer on the deep-dive tab (lazy-fetched on tab open, timeline with
  since-move `%` against the live quote) and a board-level **SCORECARD** drawer (tier/rank/comp
  changes ranked by |since-move|, `"NBIS S→A on 7/28 @ $170 → now +12%"`) — both empty states say
  the ledger started counting from deploy rather than reading as "nothing ever changed."
- **FEAT-TT-SPREAD (v3.33) — belief vs street, the CRDO pattern automated.** Two builds on the
  ledger and the existing PT math, entirely client-side (no new data). **The spread cell**: the
  WORTH cell's sub-line now inverts `ptModelRows()`'s own formula at the live/stamped price —
  `impliedMultiple()` solves the EV/S or P/E row backwards for the multiple the market is
  *actually* paying, so it can never disagree with the ladder above it (one row, one computation,
  both directions). Renders as `market pays 12.57× FY+1 vs you 8× · credits 157% of your 2028
  case` — a floor-only row has no premium multiple to invert against, so the spread renders
  nothing there rather than guessing. **Street vs mine**: where `pt_consensus.rows[year]` exists
  for the *same* horizon year the WORTH cell targets, its non-bear/floor/severe columns (the same
  dim rule `ddPtConsensusSec` already applies) are averaged into `street ~$485 vs mine $509` —
  renders only when that year's row actually exists in the payload. **The divergence flag**: from
  the ledger's `est` entries, if a name's latest consensus revision moved a value **up** while
  price has since moved **down** ≥`MOVE_PCT` (or the reverse), a `⚠ est↑ px↓` chip lights on the
  book chip and the upside-rank pick — same-direction moves are explicitly *not* the signal
  (that's just the market agreeing); only the split is. This is the CRDO read from the 7/28
  handoff, machine-detected across the whole book instead of caught by hand on one name.
- **FEAT-TT-POSSTORE (v3.34) — `pos` gets its own KV document.** Three separate broker-sync
  passes hit the SAME wall: `pos` (FEAT-TT-POS, v3.30) rode inside the 64KB book document
  alongside tiers, theses, PT models, hinges, projections and dots for 30+ names, so writing
  position data for the names still missing it meant trimming unrelated fields just to fit —
  the same squeeze, repeatedly, on a document that keeps growing for reasons that have nothing
  to do with positions. **`functions/api/positions.js`** (KV key `tt:pos:v1`, `{asOf, positions:
  {sym: pos}}`) gives it the same treatment the belief ledger already proved for this exact
  shape of problem. PIN-gated like `/api/tt`. **PUT is merge-only** (`{updates: {sym: pos|null}}`)
  — a sync that only touched 6 names must never be able to blank the other 25; `{sym: null}` is
  the explicit removal path for a fully-exited name. Each update is still validated by the same
  `validatePos` (exported from `tt.js`, unchanged) — the bands didn't move, only the storage did.
  A one-time idempotent **`GET /api/positions?migrate=1`** pulls any `pos` still embedded in the
  book (pre-v3.34 syncs) into the new store, snapshots the book first (same first-write-of-the-
  day restore point `tt.js`'s own PUT keeps), then strips `pos` from those entries and re-saves
  the book to reclaim the bytes that motivated the split; a no-op once nothing embedded remains.
  `validateBook` no longer inspects `pos` at all — a stray `pos` key on an old cached client now
  rides the ordinary unknown-key passthrough instead of being validated in place. Client-side,
  `posOf(x)` — the single choke point every consumer (caps, clusters, reconcile, TODAY, the
  circuit) already went through — now reads a `POSITIONS` map fetched once at boot instead of
  `x.pos`, so the store move is invisible to every renderer except that one line. Same invariant
  as the book and the ledger: real position data has no home in this repo, and `POSITIONS`
  ships empty.
- **v3.35 "The Analyst Desk" — the UI renders what the terminal already knew.** A UI-revamp
  sprint against one finding: the terminal stored everything SA/Yahoo can't have (measured
  positions with option legs, per-year underwriting multiples, belief history) and rendered a
  fraction of it. Four features, all inside `admin.html`:
  **FEAT-TT-ESTRUN** (centerpiece) — the v3.15 consensus table and v3.17 computed PT ladder
  were two renderings of the same year axis; they merge into ONE per-year table
  (`estRunTable`/`ddEstRunSec`: FY · rev · Δrev% · EPS · ΔEPS% · n · PT rev-lens · PT floor ·
  upside-vs-live), targets **joined from `ptModelRows` by forward year, never recomputed**
  (the FEAT-TT-SPREAD rule), EPS YoY reading `n/m` on a sign-flip, thin-coverage dimming and
  negative-EPS red surviving the merge. It renders **above the fold** on the deep dive with
  the TIER in its label (the math under the tier claim), and gets a board expression inside
  NEXT DOLLAR & UPSIDE: one `details.est-mini` row per modelled name (nearest target ·
  annualised upside · tier), sorted by upside, expanding to the same table — open-state in
  `EST_OPEN` because three async paths re-fire `render()` and an unpersisted `<details>`
  snaps shut mid-read. `est-mini` is deliberately NOT `drawer` (the phone harness counts open
  drawers).
  **FEAT-TT-ROLLUP** — `bookRollup()`/`renderRollup()`: the tracked book summed (total MV,
  unrealized P/L **only where both mv and cb are measured**, stale/undated counts, top
  weights, per-tier MV split) in a strip under the TODAY card, labeled *"tracked book only —
  NOT NAV; a floor, not the account"* (get_portfolio is still unmeasured and reconcile()
  names real untracked holdings). Nothing measured → renders nothing, never $0.
  **FEAT-TT-OWNDEBT** — of the pos schema the UI rendered only `at/sh/mv/pct`; now the own
  cell carries cost basis, colored `±% unrl`, src and leg count; an options-only position
  (LITE/GRAB/CELH/TEM/NU) reads `"N legs · options only — no shares"` instead of unheld;
  `ddOptSec` renders the legs as a real table (side · C/P · n · strike-when-captured · exp ·
  DTE, `OPT_NEAR_D=60` amber); chips carry measured `±upl%` and an `◇opt` marker; and a
  book-wide expiry ladder lives in the EXPOSURE drawer whose summary counts near legs while
  closed. Expiries deliberately never feed `binaryEvents()` — your own clock is not a market
  binary.
  **Fixpack** — the 3-questions block rendered twice per tab (inline copy removed); `LIVE_AT`
  (the quote batch's own timestamp) finally renders in the coverage strip; every `dd-pt`
  table sits in a `.tblx` overflow container **plus `.layout>*{min-width:0}`** (the grid item
  otherwise inherits a wide table's min-content width and blows the page out before the
  container can scroll — found by the harness at 390px); the chip tooltip's measured facts
  became a read-only MEASURED row on the card (tap-reachable); `test/render.mjs` fixture
  dates are now **computed relative to today** (a fixture stamped "today" at write time
  silently rotted at the first midnight — two asserts died exactly that way).
- **FEAT-TT-RANKFAIR (v3.36) — the ranking audit: weight becomes a ranking input.** An audit of
  the next-dollar logic found the board carrying **two rankings that contradicted each other**:
  the manual `rank` queue (human-asserted trigger state) said one thing, while `renderUpsideRank`
  sorted purely on annualised upside and said another — with nothing reconciling them. Three
  structural flaws, all fixed here. **(1) Weight was absent entirely.** The ranking answered
  *"what is cheapest"* while being asked *"where does the next dollar go"* — a name at 31% of the
  book could top the list and be unable to take another dollar. `rankWeight()` now marks every
  pick (`**` at/over `CAP_PCT`, `*` ≥10%, `◇` options-only) and **a name at/over the cap is vetoed
  from `AGREE_PICK` outright**, with the reason named — the board can no longer propose an add
  into a full position. Denominator is tracked-book MV, **never NAV** (unmeasured), so every
  weight is a floor; `mv` is equity-only, so an options-only position gets its own marker rather
  than a misleading 0%. **(2) A stamped `ref_px` was the entry ticket** — a name with a full model
  and a *live* quote was excluded outright because nobody had hand-stamped it. The gate is now a
  usable price, live preferred. **(3) The coverage gap was silent**: queue names carrying a manual
  rank but no `pt_model` can never appear in the computed list, so the names under active
  consideration were exactly the ones the math had nothing to say about — they are now NAMED
  under the ranking. Still open by design: the sort key remains a single variable (upside), with
  quality/hinges/trigger state rendered as tags — reconciling the two rankings into one score is
  its own piece of scope.
- **v3.37 — TSM modelled, NBIS's debt gap closed, and the ranking says HELD vs NOT.**
  The v3.36 audit exposed that the queue's top names carried **no `pt_model` at all**, so the
  computed ranking could say nothing about the very names under consideration. **TSM is now
  modelled** on the EARNINGS lens (`pe_premium_multiple`, the same rule that put UBER there):
  a sales multiple prices the wrong thing for a 49.9%-net-margin compounder. Inputs are
  measured where measurable — **5,186.48M ADS** (Robinhood) and **~$63B NET CASH** (NT$2.02T
  net-debt-negative, Q1-26 @ 32.08) — while the multiple schedule (24x→19x, decaying from TSM's
  own 29.6x trailing) is flagged in the payload as **the one asserted input, assistant-set,
  owner to confirm**. Independent sanity check, not a fit: the 2027 rung computes **$625.02**
  against Barclays' published **$625** PT. The consensus block records the FactSet cross-check
  (NT$129.97/163.26 per common share ≈ $20.26/$25.44 per ADS — **6-10% BELOW** the owner EPS
  used), so the model is explicitly on the optimistic side of the street. **NBIS's `pt_model`
  basis literally read *"net debt NOT deducted — unavailable"*** — now closed: **+$0.87B net
  cash** ($9,298.2M cash less $8,432.0M non-current debt, 2026-03-31), with a `capital` block
  noting the balance sheet is a funding RUNWAY not a fortress, and that converts + prefunded
  warrants are why `share_count_M` ramps 310M→340M against 251.65M outstanding today.
  **Ranking honesty:** an unheld name used to render a BLANK weight, indistinguishable from
  "held but unmeasured" — `rankWeight()` now carries `held`, and the pick renders **"new — not
  held"** vs **"held · size unmeasured"**. BE was deliberately left floor-only (the owner's
  7/27 decision) — that is why an ~8.6-scored name ranks -48%, and it is surfaced as a decision
  rather than silently overridden.
- **v3.38 "Four Drivers" — FOCUS2 + SELLRANK + REFRESH.** Owner's brief, from a live
  screenshot: the board had re-accreted to six phone screens of prose; the primary view
  shall be the KEY DRIVERS only, everything else a click away. **FEAT-TT-FOCUS2**: the
  primary view is now a thin **stance strip** (stance pill + aggregated red badges — over-cap
  count, binaries-in-window, what-changed count — each opening the right drawer; the v3.25
  closed-never-hides-red rule applied board-wide) followed by exactly four blocks: **NEXT
  DOLLAR — BUY** (compact top-5 from the SAME `UPSIDE_ROWS` renderUpsideRank sorted — one
  computation, two altitudes), **NEXT DOLLAR — SELL**, **BINARY CALENDAR** (top 6 from the
  same `binaryEvents()`), and the tier list. Every pre-v3.38 strip lives on, unchanged,
  inside ONE collapsed **DESK** drawer (`openDesk(inner)` deep-links into it).
  **FEAT-TT-SELLRANK — the NEW list: where the next dollar comes FROM.** `sellRank()`
  computes it from measured positions: **forced tier first** (any name at/over `CAP_PCT`,
  with the computed `≈ $ to cap` — a breach is a rule already broken, not a choice; cap
  decision prefers broker-measured `p.pct`, falling back to the tracked-book floor), then
  **discretionary by LOWEST annualised model upside** (the dollar comes from the position
  with the least expected return). `do_not_trim` is flagged never hidden (a cap/do-not-trim
  collision is named as a contradiction to resolve); unmodelled held names and options-only
  positions are listed separately (RANKFAIR honesty: legs are not shares); the session's
  asserted `funding.order` first-trim is confronted with the computed first — married,
  never merged. Tax honesty: ±unrl% is measured, tax lots are not. A tripped circuit
  reframes SELL as the active list and the BUY block carries the veto.
  **FEAT-TT-REFRESH**: the ⟳ RANKS button re-fetches quotes + positions + regime and
  re-renders both ranks on demand, disabled while in flight, with the quote stamp beside it
  and the server's 2-minute quote-cache window stated rather than implied away.
- **v3.34 follow-up: `MAX_BODY` raised 64KB → 200KB.** The pos-store split reclaimed real
  headroom (~950 bytes across 6 names) but the live book was already large enough that it
  only bought back ~400 bytes net — the very next addition (a real NVDA book entry, its own
  `consensus` + `pt_model`) blew through the cap again within the same session. The 64KB
  figure was always an arbitrary app-level safety cap in `tt.js`/`positions.js`, never a KV or
  Cloudflare platform limit (KV values go up to 25MB), so raising it is a one-line unblock —
  `MAX_BODY` in `functions/api/tt.js` and its mirror in `admin.html`'s client pre-flight, kept
  in sync as always. **This is a stopgap, not the fix**: splitting `deepDive` payloads out of
  the book into their own KV document (same pattern `pos` and the ledger already proved) is
  the permanent answer and remains deliberately deferred — a bigger, separate piece of scope.
  *(CLOSED in v3.75, FEAT-TT-DDSTORE — see the entry below.)*
- **FEAT-TT-PTLINT (v3.39) — guards for the chain the whole terminal hangs on.** An audit of the
  price-target chain confirmed what it was supposed to: `ptModelRows()` really is the single
  computation every decision surface reads (est-run table · `ddWorth` · `renderUpsideRank`→
  `UPSIDE_ROWS`→`AGREE_PICK` · `renderBuyBlock` · `sellRank` · `renderEstRunBoard` ·
  `impliedMultiple`), and both lenses tie out dimensionally. The moat is real and is where we
  thought. What the audit also found is that **`validateDeepDive` had never once inspected
  `pt_model` or `consensus`** — the highest-leverage input in the system was the only one with no
  validator, which is how NVDA's schedule came to be keyed at the ESTIMATE years instead of the
  YEAR-END PRICED: `schedAt()` looks backward only, found no key ≤ the first row, returned `null`,
  and the rung **silently fell through to the floor** — $135 (−29%) rendered with full confidence
  where the model meant $227 (+16%), every rung a year late. Two days of hand-audits became five
  guards. **`lintPtModel(dd)`** emits `MISKEY` (error) · `LENS` (a profitable name on the sales
  lens — the TSM/UBER rule, *warned* never auto-switched, since the lens is owner judgement) ·
  `LENSOFF` (the mirror trap: a P/E premium that cannot engage for want of positive EPS) ·
  `ORPHAN` (a key `schedAt` would never select — computed against the *selected* set, because a
  key below the row range may legitimately be the backward match every row resolves to; keys
  *beyond* the estimate series are deliberately not flagged, that being the reason the auto
  horizon stops where it does) · `NOFLOOR` (suppressed when the payload carries `basis`/`note`,
  which is the deliberately-UNRANKED case, not a defect). **`MISKEY` is the one HARD gate**, wired
  into the save path — measured across the live book at **zero instances**, so no existing payload
  can be rejected on re-save, and a genuinely-late premium declares itself with `floor_only_before`
  instead of being indistinguishable from a typo. Lints render at **both altitudes** (the name's
  tab and the whole-book ranking), because a defect nobody opens is invisible.
  **The horizon is now COMPUTED, not asserted (D1).** `HZ_DEFAULT="2028"` became wrong the moment
  three models were built whose estimates end FY2028 (last rung YE2027): pinning 2028 dropped TSM,
  LITE and GOOGL out of the ranking entirely, disclosed only as a footnote count. Measured: 2028
  ranked 12/15, `nearest` ranked 15/15 but off a ~5-month rung that annualises small gaps into
  nonsense (−73%/yr, −83%/yr, −99%/yr rows; JOBY flipping +48%/yr→−8%/yr), **2027 ranked 15/15
  coherently**. `autoHorizon()` picks the deepest year-end EVERY modelled name reaches — 2027
  today, self-advancing when those three carry FY2029, so the staleness cannot recur — and the
  chip **states the pick and its rule** (an auto horizon that looked deliberate is how 2028
  survived). `HZ_AUTO` is a distinct sentinel: `""` already means the owner chose `nearest`.
  **One `pickRow()` for all three surfaces (D2).** They each chose differently — the rank honoured
  the horizon, `sellRank` always took the nearest and then silently swapped a RAW % in for a rate
  (`if(ann===null)ann=up`), `renderEstRunBoard` took `rows[0]` — so BUY and SELL could rank the
  same name off different years with the sort key quietly changing units. `pickRow` also settles
  the **Q4 cliff**: under `ANN_MIN_Y` it ROLLS to the next rung and says so, rather than letting a
  raw gap into an annualised order (from ~Oct 1 a +8%-in-2-months rung ≈ +58%/yr would have sorted
  *below* a +40%/yr name). Both residual cases are disclosed, never absorbed, and a modelled name
  lacking only a *rate* is no longer mislabelled "no model".
  **Red hinges surface, never veto (D3)** — the board reports, it does not enforce (the
  FEAT-TT-BINCAL doctrine): `why()` is untouched, but the AGREE line and the compact BUY row now
  **name** the red hinges, so a pick can no longer light green with its entry trigger broken and
  say nothing where the decision is read. **Derived estimates are marked (`consensus.derived`,
  optional, `{year:["rev","eps"]})`** reusing the existing `.derived` class — and because a rung
  computed off a derived estimate is itself derived, **the marker propagates to the target**,
  otherwise the honest flag would stop exactly where the money decision starts (TSM's FY27-29
  revenue is company guidance, LITE's FY28 EPS an extrapolation, GOOGL's FY27/28 both — all
  previously admitted in prose only, rendering identically to a 25-analyst row).
  **Option legs get per-leg provenance and a real bug fix (D4).** `ddOptSec` claimed "from broker
  sync" for every leg while several were hand-entered from screenshots — two of them originally
  typed with the wrong call/put side, a *risk-direction* error (a short put ADDS exposure where a
  short call covers it), which is exactly the class of mistake a false provenance claim hides. `src`
  is optional and enum-checked in `validatePos`, absent reads **"provenance unrecorded"**, never
  as sync. And the trim-blocker cover filter (`admin.html:1204`) **ignored `o.exp` entirely** — an
  already-expired short call still counted as cover in the one place the board says a trim is
  blocked, while `renderOptLadder` flagged the same leg "expired?" two drawers away; expired and
  undated legs are now excluded and counted separately, with strikes named.
  Tests: **556 smoke** (the section includes the **first behavioral tests of `admin.html`'s pure
  logic** — the PT functions are lifted out by name and executed, with the Q4 cliff proved against
  a **stubbed clock** since no July date can put a year-end inside 3 months) + **103 render**.
- **FEAT-DASH-DERIV (v3.40) — the macro dashboard audit: a guard that only covered half its fields.**
  The TT terminal was audited first; turning the same lens on the **macro dashboard** found the identical
  shape of defect one layer down, and this one is live in **Engine 0** — the `/readout.json` an external
  terminal and the board's MACRO pill gate real decisions on. `isStale()` **fails OPEN on a missing date**
  (`sources.js:236` — correct for a dated field, there is nothing to judge), but `snapshot.js` emits
  **`vixWeekChg`, `tenYearM1/D1/W1`, `spyChangePct`, `spyMa100/200`, `spyYtd`, `qqqChangePct`, `spxPrevClose`
  with NO `AsOf` sibling of their own** — so every one of them sailed straight past the gate that had just
  suppressed *its own parent*. **Measured on the live 2026-07-30 body:** `vix` (dated 07-28) was correctly
  withheld as stale — while `vixWeekChg` published 6.8 and **`tenYearM1` cast a BEARISH vote** in the very
  regime the project promises "excludes stale/dead inputs", and `qqq_spy_rs` cast another while *displaying a
  borrowed `as_of` it never gated on*. Two of the four "available" votes were derived from data whose level the
  same function had refused to print. **`DERIVED_OF`** now maps each derivative to the parent whose date
  governs it, `fresh()` gates on that date, and a block reports the date it actually gated on.
  **The Macro Flip circuit was silently BLIND.** `armed: null` / `tripped: null` read identically to a genuine
  "not armed" — the crash detector could be unable to see while a confident verdict sat beside it. It now
  carries **`evaluable` + a `reason` naming the missing input**.
  **And fixing the first two exposed the real danger:** with the stale votes correctly removed, the verdict went
  **NEUTRAL → TAILWIND** — *more risk-on for knowing less*, because `available >= 3` is a COUNT and counts are
  not safety. With VIX gone the PANIC override cannot fire and the flip circuit is blind, so a risk-ON call was
  being asserted by exactly the inputs that cannot see a crash. A TAILWIND is now **withheld while the risk
  gauge is blind**, recorded in `regime.raw_verdict` + `regime.downgraded` (never silent). The rule is
  deliberately **ASYMMETRIC** — HEADWIND and PANIC pass through untouched, since a bearish read off the
  remaining inputs is still safe to act on; only the risk-on direction needs the gauge.
  Tests: **566 smoke** (+10: parent-staleness inheritance, no over-correction, blind-circuit declaration, and
  the one-way downgrade) + **103 render**.
- **NVDA lens resolved from first principles (v3.40).** A multiple is a compressed DCF, so the right metric is
  the **lowest income-statement line already structurally representative** — everything below it must be
  *assumed*, and an assumption buried in a multiple is unfalsifiable. Consensus implied NET MARGIN is
  **55.5 / 55.8 / 56.4 / 53.2%** across FY27-30: flat, not ramping, so earnings ARE the cash-flow proxy (NVDA is
  *more* profitable than TSM at 49.9%, the name this same rule already put on the earnings lens). Converted
  14/12/10/9 EV/S → **25.2/21.5/17.7/16.9 P/E, preserving economics exactly** (every rung within 0.1%), so the
  ranking did not move — what moved is that the assumption is now legible and falsifiable against a quarterly
  print. Two things the conversion revealed: `net_cash_B` was **absent (treated as 0)** and understated every
  EV/S rung — the earnings lens is equity-level, so that missing input leaves the model entirely; and at $197.01
  the market pays 21.9× FY2027 while the **near rung assumes 25.2×, a re-rating UP** — the opposite side of the
  market from TSM's deliberately-conservative schedule, invisible while the lenses differed. At the auto horizon
  (YE2027) the model assumes 21.5× vs 21.9× paid, i.e. essentially no re-rating: **NVDA's rank is carried by EPS
  growth (+43% FY27→28), not multiple expansion.** The live book is now **lint-clean — zero warnings**.
- **FEAT-DERIV-OWN (v3.41) — v3.40's fix reached one of the three surfaces it needed to.** An
  audit of that commit found `DERIVED_OF` living *inside* `buildTtReadout`, so only `/readout.json`
  gained the parent-inheritance fix. **The "Copy TT readout" paste block still voted off stale
  derivatives**: `handleTtCopy` (`dashboard.jsx`) projects tiles through `modeOf()`, which reads
  `dataAsOf[k]` — and `mergeLiveOverMock` only ever populated that from the field's OWN `AsOf`,
  never a derived field's parent. Worse, when the parent WAS stale, the projection skipped it
  *and its date together*, so a derivative reaching `buildTtReadout` from that surface carried no
  date at all and voted anyway — on the exact human-facing block whose own comment says it exists
  so a stale field "prints n/a rather than a fabricated number in an order-gating block."
  **`DERIVED_OF` now lives in `src/sources.js`** (the module that already owns `isStale`/
  `cadenceOf`/`parseObsDate`, and that every consumer already imports from), with a new
  **`govAsOf(live, key)`** helper `mergeLiveOverMock` calls when stamping `dataAsOf` — one table,
  shared by the merge, the dashboard's `modeOf`, and `buildTtReadout` (which now imports and
  re-exports it, so `test/smoke.mjs`'s existing import keeps working unchanged). The table also
  **grew from 6 entries to all ~30 undated derivatives** `SOURCES` declares, reconciled against
  `SOURCES` itself in smoke rather than pinned as a hardcoded list — the v3.40 assertion ("maps
  every undated derivative") was true only by coincidence, since it checked six hardcoded keys
  against nothing. **Audit found one live instance the v3.40 map missed while widening it**:
  `rateOddsCut`/`rateOddsHike`/`fomcDays`/`nextFomcDate` rode with NO date at all — only
  `rateOddsHold` gets a Kalshi `AsOf` — so `fed_next_meeting` (keyed on `cut`/`hike`) could vote
  off a stale Kalshi pull undetected. Fixed the same way, for free, in the same table.
  **The v3.40 honesty states were machine-visible only.** `evaluable`/`reason` on `macro_flip`
  and `downgraded` on `regime` existed in the `tt-v1` JSON, but the pill (`admin.html`) rendered
  a BLIND circuit identically to a healthy "not armed" (no suffix at all), and `formatTtPaste`
  never printed `reason` or the withhold — the two human-facing surfaces said nothing where the
  machine surface said everything. Both now render it: the pill appends `· flip BLIND` (forced
  amber, `warn` class, never the green `ok` a plain verdict gets) and `· TAILWIND withheld`;
  `formatTtPaste` prints a `⚠` line under REGIME and a `BLIND — missing: <input>` MACRO FLIP line
  instead of bare `n/a`. **The TAILWIND withhold also widened from VIX-only to BOTH panic
  inputs** — PANIC needs `vix` AND `fear_greed` live, so a dead CNN F&G scraper blinds the exact
  same override VIX blinds, and the v3.40 rule only caught half of it; `downgraded` now names
  whichever gauge (or both) is missing. The one-way asymmetry is unchanged: HEADWIND/PANIC still
  pass through untouched.
  **End-to-end check**: reconstructed today's (2026-07-30) actual market shape through the real
  `mergeLiveOverMock → buildTtReadout → formatTtPaste` pipeline — a broad bounce (SPY +1.35%, QQQ
  +2.1% leading, the NBIS-style growth-name pattern) landing on a VIX print still dated two
  sessions behind. Confirmed: the stale VIX and its `vixWeekChg` derivative are both withheld,
  the fresh 10Y still votes (no over-correction), the raw count says TAILWIND, and the actual
  verdict is NEUTRAL with the withhold and the blind circuit both stated in the paste block — not
  a synthetic fixture, the literal shape the audit traced live.
  Tests: **579 smoke** (+13: merge-level inheritance for tiles/paste, the SOURCES reconciliation,
  the widened safety asymmetry, paste-block rendering) + **107 render** (+4: the pill's blind and
  withheld states, run live in Chromium — the v3.40 asserts for these existed only on paper since
  no browser was available when that commit shipped).
- **FEAT-TT-READABLE (v3.42) — "READABLE DESK" slice 1: the first phone screen becomes the answer.**
  A requirements-first UI audit (owner's screenshot, the stance strip circled) found the terminal's
  *logic* hardened across v3.29–v3.41 while its *presentation* accreted: the ONE answer the board
  exists to give ("may capital move?") rendered as **five wrapped lines of uppercase prose** — the
  long free-text `asserted` regime inlined mid-sentence at the same weight/size/color as the verdict
  — followed by a **five-row tab grid** (19 payload tabs, flex-wrapped) that pushed the four drivers
  below the fold. Slice 1 restructures exactly that screen. **The stance bar**: `stance()` keeps its
  decision logic and pinned prose byte-identical but now also returns `{verdict, quals[]}` —
  `renderStance()` renders the verdict as a **large token** (`.vbadge`, `--fs-l`) + small qualifier
  **chips** (`.qual`; the long asserted text TRUNCATES on the chip and stays verbatim in the drawer)
  + the red badges, with the full prose one tap deep in `details.why` (NOT `class="drawer"` — the
  phone harness counts open drawers; the est-mini precedent). The v3.25 rule holds: every red fact
  is a token/chip/badge visible while closed. Chip copy is chip-length by design (`circuit TRIPPED`)
  — measured at 390px, the bar packs to **3 rows / 119px** vs ~171px of wrap soup; the render suite
  now pins `<140px`. **Found while wiring: the caution-color bug** — `renderStance`'s map keyed
  `warn`, a `k` that `stance()` never returns, so every caution stance (HEADWIND, armed circuit)
  had been rendering **slate, the color of "unknown"**, on the line that gates adds. **The tab
  strip** is one horizontally scrollable row (`nowrap` + `overflow-x:auto` + `flex-shrink:0`,
  active tab `scrollIntoView({block:"nearest"})` so a render can never yank the page). **Design
  tokens** (additive): `--fs-*` type scale + `--sp-*` spacing scale + `--focus`; `--dim` lifted
  `#5f7469→#71877b` (old value measured ≈3.9:1 on `--bg` — below WCAG AA — while carrying
  load-bearing 9–10.5px text; new ≈5.2:1); `:focus-visible` ring; `prefers-reduced-motion` kills
  the header sweep + blinking cursor; stance badges became real `<button>`s (focusable,
  Enter-activatable, same look); ≥40px tap targets on badges/tabs at ≤480px; `.u-*` color
  utilities + `button.linklike` for later slices. Slices 2–4 (driver-row grid + skeletons,
  book/deep-dive keyboard model, modal focus traps + confirm-steps) are specced in the same
  audit and deliberately deferred.
  Tests: 590 smoke (+11: structured verdicts, chip truncation, why-not-drawer, the caution
  fix, single-row tabs, tokens, contrast lift, reduced-motion, tap targets) + 113 render (+6:
  verdict token, closed-drawer prose, red-facts-while-closed, buttons keyboard-reachable, the
  390px height budget `<140px`, single-row tab strip).
  **Slice 2 (same release) — the four-driver rows.** Each BUY/SELL/CALENDAR row is now a
  two-line GRID inside a real `<button>` (focusable; Enter opens the card — render-tested with
  an actual keypress): line 1 = identity left + the PRIMARY datum right-aligned at `--fs-l`
  (BUY → %/yr; a forced trim → its weight, the rule already broken; a calendar event → its
  countdown), line 2 = detail + warning chips at `--fs-xs`/dim. The old row interleaved 6–9
  datums in one 10-11.5px flex-wrap line with the decision number lost mid-row. Every phrase is
  verbatim from v3.41 (the render regexes pin them); a calendar event with no book entry stays
  a `<div>` — a button that does nothing is a lie. **Skeleton rows (first-paint only):**
  `QUOTES_PENDING`/`POS_PENDING` are true until the FIRST quotes/positions load settles —
  while pending, an empty BUY rank or unmeasured SELL queue renders `.skel-row` placeholders
  instead of an empty state ("not loaded yet" and "nothing there" are different facts), and
  both loaders settle in a `finally` so a dead feed resolves the skeletons into the honest
  empty state rather than stranding them (the board also now re-renders on quote FAILURE, not
  just success). Shimmer is gated behind `prefers-reduced-motion`. The flags never reset to
  true — skeletons are a first-paint device, not a refresh spinner (⟳ RANKS has its own).
  Span-onclick pseudo-links in the driver blocks became `button.linklike`. Driver rows get the
  44px min-height at ≤480px.
  Tests: 596 smoke (+6 slice-2: grid buttons, promoted primary, div-when-not-actionable,
  pending-flag lifecycle, reduced-motion shimmer gate, linklike conversions; 1 pin updated for
  the loadQuotes `finally`) + 116 render (+3: focusable rows with promoted primary, a real
  keyboard Enter opening the card, skeletons present while pending and gone after).
  **Slice 3 (same release) — book chips and the tab strip.** Tier chips become real
  `<button type=button>`s (Enter/Space activation for free; the CUT row deliberately stays
  `<div>` — those chips have no click handler, and a button doing nothing is a lie). The tab
  strip becomes a real ARIA tablist: `role="tablist"` + `role="tab"` + `aria-selected` +
  **roving tabindex** (only the active tab sits in the natural Tab order — the WAI-ARIA APG
  pattern), with Arrow/Home/End moving AND selecting, matching native tablist behavior;
  `switchTab()`'s own logic is untouched. Drawer/schema summary type migrated onto `--fs-s`
  (no visible change — the token equals the literal). `table.dd-pt th` gets `position:sticky`
  at ≤700px so a phone-scrolled row keeps its column labels (desktop unaffected). Chips get
  the 40px thumb target at ≤480px.
  Tests: 603 smoke (+7) + 122 render (+6, incl. a real keyboard arrow-key tab switch
  and Enter-to-open-card on a chip, both driven in Chromium).
  **Slice 4 (same release) — modals and recovery.** `#overlay` is ONE element reused by all 9
  open sites (card, add, session, import, restore, pin-setup); each `classList.add("on")` call
  became `openModal()`, and `closeCard()` is now a thin wrapper (`CURRENT=null;closeModal();`)
  — one choke point instead of nine, and every existing `onclick="closeCard()"` keeps working
  unchanged. `openModal()` remembers `document.activeElement` and moves focus into the card on
  open; `closeModal()` restores it — a card opened from a chip returns focus to that chip, not
  the page underneath. A `Tab`/`Shift+Tab` listener scoped to `#overlay` traps focus at the
  card's boundary (WAI-ARIA APG dialog pattern), wired once, not duplicated per modal.
  **`#pinGate` is deliberately NOT part of this pair** — same invariant as always ("so ESC/
  closeCard can never dismiss it"); its own show/hide is untouched. The save banner's two
  destructive links (`KEEP MINE` → `overwriteServer`, `discard & reload server copy` →
  `discardLocal`) now require a **second click** within a 4s window — first click arms the
  link ("confirm — really …?"), a second executes, letting it expire reverts the label
  silently; `RETRY`/`EXPORT` stay single-click since they're non-destructive. One
  `confirmLink()`/`confirmClick()` implementation, reused by both banner builders — not
  duplicated. The toast gains `role="status" aria-live="polite" aria-atomic="true"`, so a
  save/refresh confirmation is announced without requiring focus; no change to `toast()`
  itself, `textContent` updates inside a live region announce automatically.
  Tests: 611 smoke (+8) + 130 render (+8: real Tab/Shift+Tab trap, Escape-returns-focus
  to the invoking chip, an actual two-click confirm sequence and its 4s expiry, and the live
  region's ARIA attributes — all driven in Chromium against the synthetic fixture).
  **Slice 5 (same release) — "only the highest-leverage things survive the first glance."**
  Owner feedback on a live screenshot, and the measurement settled it: at 390×844 the BUY block
  — the first actual ANSWER — began at **y=587 of 844, so 70% of the first screen was chrome**,
  and **the header alone was 209px of it, larger than the stance bar and tab strip combined**.
  Slices 1–2 had optimized the two bands that were circled while the biggest consumer went
  untouched (it was item 3 of the approved spec's IA section and was simply never built).
  **The header is now ONE row** — `TT` · the MACRO pill · `⋯ MENU`; version, BOOK/AUTH stamps,
  the DASH link and the *entire* action toolbar moved inside the `#headInfo` disclosure, since
  every one of them is status or an occasional action and the command bar already covers the
  frequent path. **Banners stay OUTSIDE it** — an expired session or an unsaved edit must never
  require opening a menu to discover. The `MACRO:` label survives the compaction because v3.29
  added it so the pill can't be misread as the stance (honesty invariant, not decoration), and
  the pill drops the **year** only when it IS the current year — a year-stale macro read still
  prints in full. **The stance became ASYMMETRIC**, which is the heart of the feedback: `ADDS OK`
  is the permissive default, the lowest-leverage sentence on the board, and now renders as a
  small pill and nothing else — no token, no qualifier chips, no why drawer. A RESTRICTIVE
  stance (tripped · PANIC · HEADWIND · UNKNOWN) keeps the full treatment. Nothing is lost:
  `renderToday()` already renders `txt` AND `why` verbatim inside DESK, one tap away. The **red
  badges render in BOTH states** — the v3.25 rule that a collapse never hides a red fact.
  **Measured after: header 209→59, toolbar 64→0, stance 148→54, BUY 587→269 — 70%→32%.**
  Tests: **619 smoke** (+8) + **138 render** (+8, incl. both stance states driven live and a
  pinned above-the-fold budget for each, so chrome creeping back fails the build).
- **FEAT-NFCI (v3.43) — financial conditions, and the "what is high-leverage vs Yahoo" question.**
  Asked whether to add **TLT**; the answer is no, and the reasoning is the reusable part. TLT is
  not new information — it is a ~17-duration wrapper on long-end Treasury yields, i.e. a
  monotonic inverse transform of the `tenYear` this page already carries with d1/w1/m1 deltas, a
  sparkline and a banded trend that votes. It would add an ETF's expense drag and distribution
  adjustments on top of a rate already displayed cleanly. The page had already made this exact
  call once — `dashboard.jsx` still carries the comment *"SPY P/E (mock, Yahoo-dupe) cut"*.
  **The sorting rule:** Yahoo/SA/TipRanks win on *data* (quotes, charts, estimates, analyst PTs,
  per-ticker depth) and will always win there. What they structurally do NOT do is (1) render a
  single **verdict**, (2) **abstain** — none of them has ever said "this number is three days
  stale, I am not counting it", which is this project's whole provenance/STALE/ILLUSTRATIVE/
  INSUFFICIENT layer, (3) expose a **machine feed** (`/readout.json` → the TT terminal), (4)
  carry **non-consensus inputs** (Kalshi FOMC odds; the GPU $/hr × token $/Mtok AI unit-economics
  pair, which exists on no retail site), or (5) state **why** (the 5 Whys). *The moat is the
  judgment layer, not the data layer* — so an addition earns its place only by feeding it.
  **NFCI is the one that does.** The Chicago Fed's National Financial Conditions Index is 105
  measures of money-market, debt/equity and banking activity standardized so that **ZERO is the
  historical average by construction** — positive = tighter than average, negative = looser. It
  is a weekly single number that restates this dashboard's own thesis question ("is it safe to be
  in the market?"), and it is effectively absent from retail finance sites. Wired through the
  existing `fetchFred` path (16 series now = **one additional batch of 5**, which is why the
  phase batching must not be collapsed), with `nfciW1` derived from the prior observation —
  genuinely a week on a weekly series — plus `nfciSeries`. **Deliberately NOT in the `DAILY`
  set**: the `idx[5]`/`idx[21]` offsets would mean 5 and 21 *weeks*, exactly the bug that gating
  exists to prevent. Band `[-5, 5]` (record high ≈ +3.3 in 2008) rejects the impossible without
  rejecting the unusual. Cadence `weekly`; the derivatives inherit it through the v3.41
  `DERIVED_OF` parent fallback in `cadenceOf` rather than needing their own entries. The tile
  sits beside HY–IG because both are risk-**transmission** gauges: credit prices the risk, NFCI
  measures how tight the plumbing carrying it has become. It states `0 = avg` on its face — a
  bare z-score is unreadable without its reference point — and **TIGHT/LOOSE is suppressed on
  mock/stale** exactly like the CAPE BUBBLE verdict, since it is a directional call.
  **Two honest limits.** (a) The ±0.10 deadband around zero is **asserted, not fitted** — this
  build environment's network policy blocks `fred.stlouisfed.org` (403 on CONNECT), so it could
  not be calibrated against real history; it exists only so a weekly series doesn't flap its
  label on a 0.01 wiggle across the mean, and every boundary is smoke-tested so changing it is
  one edit plus one test. (b) **It does not vote yet** — neither `computeRegime` nor the six
  `tt-v1` checks changed. Adding a 7th voter alters the aggregate math for an external consumer
  that gates real orders, and doing that off an uncalibrated band would be precisely the failure
  DEC-33 exists to prevent. Deliberate follow-up, once real values have been observed.
  Tests: 631 smoke (+12) + 138 render, plus a browser check across live / stale / mock.
  **NFCI now VOTES in the dashboard regime (owner call, same release).** It joins `computeRegime`
  as a 6th factor on the same ±0.10 band the tile renders, appears in `regimeFactors` so the
  displayed "X/Y bullish" matches the vote cast, and drops out when STALE like every other
  factor (`REGIME_FACTOR_FIELDS`). **`/readout.json` is deliberately untouched** — the TT
  terminal's order-gating math did not move. This forced a threshold fix: DEC-31 set "≥3 of 5 =
  strict majority" *explicitly because 3 of 6 is 50%, not a majority*, so a 6th factor against a
  hardcoded `3` would have silently re-created the exact bug DEC-31 removed. The rule is now
  computed from the factors that actually voted — `bullVotes > counted/2` — which is **identical
  to the old constant at 5 live voters** (needs 3), correct at 6 (needs 4), and finally correct
  at 3 (needs 2, where the constant had demanded unanimity). Honest consequence: with all six
  live a verdict is harder to trigger, so MIXED becomes more common. That is what a voter costs.
  **Curated cuts (owner-approved).** The audit measured 24 live-backed blocks vs 12 fully-curated
  ones, and found most curated content was *already* collapsed by FEAT-322 — so the gain here is
  honesty and maintenance, not screen space. Cut, applying the rule already in this file's
  history (*"SPY P/E (mock, Yahoo-dupe) cut"*): **gold** (6 curated leaves, no live source ever,
  permanently ILLUSTRATIVE, better on Yahoo — FRED's LBMA series is discontinued so a live
  wire-up was not a cheap alternative) · the **IPO countdown** (component, data and state) · the
  **SpaceX S-1 panel** and the private Mag-10 entry · and **Mag-10's curated fundamentals**
  (mkt cap, P/E, revenue, margins, FCF, capex) — the live Finnhub price + day move survive,
  which is the half this stack actually sources. **Kept deliberately: GPU $/hr** (half the AI
  unit-economics pair; the live token $/Mtok is the other half, and the pair exists on no retail
  site), the **headwinds register** and the **watchlist** — those are *what the owner thinks*,
  which is precisely what Yahoo/SA/TipRanks structurally cannot host. Peoria kept on owner call.
  A cut has to take its **attribution** with it: the Mag-10 header still read "Ranked by market
  cap · fundamentals curated (reviewed Q1 2026)" after the data was gone — caught in a browser
  check, and now smoke-pinned, because a surviving label that describes deleted data is the page
  lying about what it is showing. Result: `dashboard.jsx` 1761→1522 lines, bundle 614.9→601.4 kB.
  Tests: 643 smoke (+7) + 138 render, plus browser checks that every collapsible group can be
  expanded without revealing cut content.
  **NFCI bands re-derived from first principles (v3.43.1).** The shipped ±0.10 deadband was the
  one number in v3.43 that was *asserted*, and re-deriving it surfaced a defect bigger than the
  threshold. NFCI is a **z-score by construction** (mean 0, SD 1 over 1971–), so its native unit
  is **standard deviations** — a decimal deadband has no meaning in that unit. Worse, post-GFC
  the index sits persistently *below* zero, so a symmetric band around the mean would have voted
  **bullish nearly every week**: a factor that always votes the same way does not inform a
  majority tally, it silently **biases** it. The bands are now **asymmetric**, each threshold
  carrying a reason — **`NFCI_TIGHT = 0`** (the *definitional* mean; crossing it is the event)
  and **`NFCI_LOOSE = -0.5`** (half a standard deviation below the mean, stated in the index's
  own unit). Asymmetry is the same doctrine as the v3.40 TAILWIND withhold: tight conditions
  *cause* drawdowns, while merely-looser-than-average is the ordinary backdrop, not a buy signal.
  Both constants live in **one shared table** driving the tile, the regime vote and the factor
  breakdown, so a label can never disagree with the vote it cast. The mock baseline (-0.42) now
  lands in the NEUTRAL zone on purpose — the demo shows a factor that **abstains** in ordinary
  conditions. Remaining judgment call, stated rather than hidden: the ½-SD loose threshold is a
  defensible round number in the right unit, not a fitted one — FRED is still unreachable from
  this build environment. Tests: **647 smoke** (+4, incl. exact boundary behavior at -0.5 and 0)
  + 138 render, plus a live browser check of all three band states.
- **FEAT-TT-OPTMV (v3.44) — options positions join the one sell ranking.** Owner's call: *"doesn't
  matter if they're options or shares — all holdings and tier-list tickers I really have
  considered in the rankings."* Correct on the substance, and the audit found the exclusion was
  **not doctrine but a missing measurement**: option legs carried `{k, side, n, strike?, exp?,
  src?}` and **no market value anywhere in the schema**, while position-level `mv` is equity-only
  — so the SELL list, whose whole job is "where does the next dollar come from", literally had
  nothing to rank a sleeve on and exiled it to a footnote. (The BUY side never excluded them:
  `renderUpsideRank` doesn't inspect position at all, so an options-only name with a model and a
  price already ranked; only a cap breach vetoes a pick.)
  **`pos.opt[].mv` is the fix** — a per-leg **SIGNED** market value from the broker sync, sitting
  beside the per-leg `src` provenance v3.39 added. **The sign is load-bearing**: a long leg is an
  asset you can sell (`mv > 0`), a **short leg is a liability you must buy back** (`mv < 0`), so
  it is a USE of cash, not a source — summing unsigned would report a short sleeve as available
  funding, exactly backwards. `validatePos` rejects a sign contradiction outright (long with
  negative mv, short with positive). **`mv` stays equity-only** so every existing cap check and
  the tracked-book rollup keep their current meaning.
  **`optSleeve()` fails closed**: a sleeve is measured only when EVERY leg carries `mv`, because
  a partial sum understates the position and would read as a smaller holding than it is — the
  same rule `pos.at` and `lastRun` already follow. Unsynced reads *"N of M leg(s) have no synced
  value"*, never as zero.
  **One list, two honest bases.** Share rows keep the original rule (lowest expected return funds
  first); options rows rank on **realisable dollars** and say so, because a levered, decaying leg
  does not inherit the underlying's %/yr — borrowing that rate would be the exact units error
  D2 removed when `sellRank` silently substituted a raw % for a rate. An options row **qualifies
  on dollars alone** (requiring a model would have re-created the very exclusion this removes)
  and **bypasses the CAP tier**, since `CAP_PCT` is measured against equity `mv`/broker `pct`, a
  denominator a sleeve's value is not comparable to. What remains named below the list is only
  what genuinely cannot be ranked — an unsynced sleeve, or a net-short one reported as an
  obligation with the cost to close.
  Tests: **653 smoke** (+6) + 138 render (1 fixture leg gains `mv` so the options row ranks
  in-list). Until a broker sync populates `opt[].mv`, those names read "value not synced" — the
  honest state, not a guess: an option's mark cannot be approximated from strike and expiry.
- **FEAT-TT-CAPEX (v3.45) — the hyperscaler capex tape, and the conservation lint.** Owner's
  thesis: hyperscaler capex is the most-scrutinized number the book didn't track — "once they
  announce a reduction, Mag-7 rises and AI infrastructure collapses." The audit found the book
  prices the *consequences* of capex everywhere (NVDA revenue rows, TSM wafer starts, BE's DC
  power) while **the pool itself lived nowhere in the system** — the v3.40 defect class again:
  an assumption buried in a number is unfalsifiable. Four pieces:
  **(1) `board.capex`** — the tape. Per-spender rows `{co, fy_guide_B, dir: up|hold|down, at}`,
  validated in `validateBoard` (band 0–2000 $B, dated or rejected), curated at each print — the
  binary calendar already tracks those dates as non-ticker prints; no $0 live source for
  guidance exists. **The tripwire is the thesis instrumented**: ≥2 guiding `down` → red banner +
  a chip-length **⚡ stance-strip badge** (v3.25: visible while everything is closed) — and it
  fires in BOTH directions (≥2 `up` = re-acceleration), because the tape reports, never bets.
  **(2) Typed per-name `capex_exposure`** (deepDive passthrough, registered in `DD_HANDLED`,
  purpose-built section in the CAPITAL drawer): `direct` (NVDA — draws the pool) · `fab` (TSM —
  inside a direct name's COGS) · `power` (BE/GEV — rides the buildout broadly) · `neocloud`
  (NBIS — two-sided). The typing is the sharpened version of the thesis: the tape's turn won't
  say "AI infra: sell", it says who takes it first and who might be HELPED.
  **(3) The conservation lint** — the genuinely novel piece: Σ over `direct` names of
  (FY+1 revenue estimate × `pct_of_rev`) = the capex-funded revenue the book collectively
  implies, vs the tape's aggregate. **Implied > guided pool = the book's own estimates are
  internally inconsistent**, and the lint names the names. `fab` is EXCLUDED from the sum
  (counting TSM and NVDA double-counts the same dollar). **`neocloud` exclusion is an owner
  ruling (v3.45)**: NBIS is grouped in AI infra for the tripwire, but its revenue draws AI
  rental demand, not the tracked spenders' pool — and a pool cut can push overflow demand TO
  it — so its **own `capex/rev` ratio** is the tracked metric instead (`own_capex_B`; the
  fixture's 1× is the spender profile: revenue is capacity-built, not pool-drawn). Unmeasured
  direct names are named and the sum called a FLOOR; untyped exposure is flagged, never guessed.
  **(4) The dashboard's third leg**: `HYPERSCALER_CAPEX` + `HyperscalerCapexCard` complete AI
  Unit Economics — **cost (GPU $/hr) ↔ price (token $/Mtok) ↔ funding (capex $B)** — curated +
  reviewed-dated, ILLUS_HATCH + IllustrativeChip, behind its own CollapsedGroup, and it NEVER
  votes (curated directional reads are the v3.1 invariant's exact target). Figures are
  placeholders to review at each print; headwind #1's $705B counts ALL AI capex, the tape
  tracks the four the market prices.
  Tests: **666 smoke** (+13, incl. the lifted tripwire/conservation math run behaviorally and a
  validateBoard malformation sweep) + **144 render** (+6: turning banner, breach math ($22B vs
  $18B = 122%), typed exclusions with reasons, closed-summary signal, stance badge, deep-dive
  exposure — all against a synthetic HYPA/HYPB/HYPC tape).
- **FEAT-TOKW (v3.46) — tokens/watt: the CONVERSION leg, and the window that must never be
  annualised.** Owner's call: *"token per watt is a key indicator too, especially for NBIS."*
  Correct, and the first-principles reason is not the one usually given — power is not the
  dominant COST (a ~1kW accelerator costing ~$40k burns ~$1.5k of electricity over three years;
  depreciation dominates energy ~25:1). It is the binding **CONSTRAINT**: MW allocations are the
  input that cannot be bought on demand, so tokens/watt is a **capacity-productivity** metric —
  how much sellable output a fixed, hard-to-expand power envelope yields.
  **The identity: `revenue per MW ∝ (tokens per watt) × ($ per token)`**, and in growth terms the
  two rates COMPOSE. Only the RATIO is honestly sourceable: published tokens/W swings 10-50× on
  model size, batch depth, quantization and GPU-only-vs-PUE, and $/Mtok is *retail* API pricing
  carrying the model provider's margin, not a neocloud's wholesale realization. Both scale factors
  cancel in the ratio — so `TOKEN_EFFICIENCY` stores a **relative index** (H100 = 1.00) and the
  card is forbidden by construction from ever printing a $/MW figure (smoke-pinned in both
  directions: no interpolated and no literal `$…/MW`).
  **The defect this build turned up in its own first draft: annualising the price window.** The
  rolling `tokenTrend` is ~12 weekly points at most, and raising a 12-week move to the 52/11 power
  turned a −25% drift into **−98.8%/yr** — arithmetically correct, economically absurd, and
  precisely the units error DEC-D2 removed from `sellRank`. So the window is **never annualised**:
  the durable multi-year efficiency CAGR is projected DOWN onto the price window's own span
  (`effWin = (1+effCagr)^(weeks/52) − 1`), both legs are reported over that same observed span, and
  the span is stated on the card. Below `minWeeks = 8` the band is **withheld entirely** — *"window
  too short to read"* and *"flat"* are different facts. The deadband (`deadbandPct = 5`, a window
  figure not a rate) is measurement noise, not an economic line.
  **The card** sits between the price and funding legs (`cost ↔ price ↔ conversion ↔ funding`),
  ILLUSTRATIVE + hatched + behind its own `CollapsedGroup` (half its input is curated), its verdict
  suppressed on mock/stale via `isIllustrative` like the CAPE BUBBLE and NFCI TIGHT/LOOSE reads,
  and it **never votes** — a directional call off a curated index is the exact v3.1 target.
  **The TT side** is `deepDive.tokens_per_watt`, registered in `DD_HANDLED` and rendered by
  `ddTokWSec` **beside** `utilization_underwriting`, never inside it: utilization underwriting only
  ever addressed the *second* factor of `MW × utilization × tokens/W × $/token`, so two operators
  at identical utilization earn different revenue per MW on different chip generations — the
  productivity term a utilization model structurally cannot see. The gen index is carried **by the
  payload** (each row states its own `idx`, frontier = the max present), deliberately NOT copied
  from `src/`: `admin.html` is buildless and cannot import, and a hand-copied constant drifting out
  of sync would be worse than owner-entered numbers that are visibly self-attested. Fails closed
  like every measured field here — a mix not summing to ~100% is NAMED and the fleet index called a
  **FLOOR**, a missing mix reads *"unmeasured, which is not the same as average"* rather than an
  implied 1.00, an undated block is flagged, and an absent MW pair says the capacity leg is
  unmeasured instead of assuming no growth.
  Tests: **679 smoke** (+13, the scissors math lifted and RUN — a string pin cannot prove a number,
  and the whole feature is a claim about one) + **146 render** (+2: the neocloud decomposition
  computed live — fleet 3.10× vs frontier 4.50× = 69%, capacity 3.00×, productive ≈ 2.07× — and the
  partial-mix FLOOR/undated fail-closed path, both against a synthetic fixture).
- **v3.47 — the LENS lint learns magnitude (found while modelling RKLB).** Building RKLB's
  `pt_model` fired `LENS` ("modelled on ev_s_multiple while FY2027 EPS is 0.05 (>0) —
  earnings-lens candidate"), and the warning was **substantively wrong**: at $63.85 that EPS is a
  **1,277× forward P/E**, i.e. a company *crossing* zero, not an earnings line the
  lowest-structurally-representative-line rule (the v3.40 NVDA derivation) would ever select.
  The lint tested `e > 0`, which is not the same claim as "the name earns". It is now
  magnitude-aware: above **`LENS_MAX_PE = 100`** on `dd.ref_px.px` the earnings line is treated as
  a crossing artifact and the sales lens is correct. Deliberately permissive — NVDA ~22×, TSM ~24×
  and UBER ~18× all sit far under it, so a genuinely-expensive profitable name still warns — and
  with **no price there is nothing to judge against, so behavior is unchanged (still warns)**,
  failing TOWARD the warning rather than swallowing it. Doctrine is untouched: `LENS` is still
  warn-only and the lens is still owner judgement, never the lint's.
  Tests: **682 smoke** (+3, incl. a profitable-name control that must still warn and the
  no-price fallback; `LENS_MAX_PE` is now lifted BY VALUE into the smoke harness — it was a free
  variable that the existing fixtures happened to short-circuit past).
- **v3.49 "TRUSTWORTHY ELIGIBLE" — the value-proposition audit's critical trust failures, fixed.**
  `ticker-terminal/VALUE_PROPOSITION_AUDIT_2026-07-31.md` (owner-commissioned) confirmed the niche
  — *a personal capital-allocation system that remembers your thesis, detects what changed,
  enforces your rules, and tells you what deserves the next dollar* — and found the green action
  layer ahead of its trust controls. Five fixes, smallest coherent set:
  **FIX-A (Critical #1, the two regime surfaces disagreed)** — `isStale()`'s "today" was the
  RUNTIME-LOCAL date (`setHours(0,0,0,0)`): on Cloudflare's UTC edge it advanced at 8pm ET,
  counted the just-closed session as MISSED, and aged normal prior-close data — `/readout.json`
  read INSUFFICIENT (1 input, flip blind) while the same payload in an ET browser read MIXED.
  `etYmd()` in `src/sources.js` now derives today as the **ET calendar date of `now`** in every
  runtime; one clock fixes all three consumers at once (buildTtReadout, the dashboard's `modeOf`,
  the paste projection — they all call `isStale`). The rollover is regression-tested at Thu-9pm-ET/
  Fri-01:00-UTC instants, which genuinely exercise the bug in any UTC runtime (CI, the edge).
  **FIX-B (Critical #2, a green pick despite missing mandatory gates)** — the board emitted
  "both stories agree: TSM" while stance was UNKNOWN, Macro Flip was blind and TSM had NEVER RUN.
  The agree block now **hard-WAITs on a missing gate, each veto named**: unknown stance, a
  suspended (PANIC) stance, an unreadable regime feed or absent/blind/tripped Macro Flip (fail
  CLOSED — an unreadable crash circuit vetoes rather than defaulting to clear), and a non-fresh
  TT run per name (never/aged, ≤30d required — "5 fresh runs against 31 never" must not light a
  green line). **Red hinges stay surfaced-not-vetoed** — D3 (v3.39) is a locked doctrine and the
  audit's cited framework rules concern live data and regime, not hinges; the hinge is still
  named in red on the pick itself.
  **FIX-C (product ambiguities)** — labels now say what each list IS: the math ranking is
  **"VALUATION GAP — math only"**, the green line is **"ELIGIBLE NEXT DOLLAR — all gates
  passed"** (BETA-first-by-math vs TSM-first-eligible were different concepts blended by one
  "NEXT DOLLAR — BUY" banner), and the sell list is **"FUNDING PRIORITY"** (it was never a sell
  recommendation — a positive-upside name can appear purely because another has more).
  **FIX-D (Critical #3, the risk denominator)** — no surface claims "% of NAV" any more: cap
  breaches state **"% of acct equity"** and the TODAY stop names the denominator outright
  ("account equity, options excluded — a floor, not NAV"). The direction of a breach is real;
  the exact figure was never authoritative and now says so.
  **FIX-E (regime denominators disagreed)** — the header said "3/6 bullish" while the 5 Whys
  said "3/5 live factors": `fiveWhys.js` re-derived the denominator from its own hardcoded
  **pre-NFCI five-factor list**. `computeRegime` now returns `counted`/`totalFactors` and every
  surface consumes them (one derivation, the `governingRegime` rule); the fallback list names
  all six voters. Also found: the RegimeBand chip strip had a hardcoded 5-label array, so the
  6th (NFCI) chip rendered literally "undefined" — labels now ride the factor entries (`short`).
  **Resolved by process, not code:** Critical #4 (production not reproducible) was an unpushed
  local checkout; `origin/main` now carries v3.48/v3.49. **Deferred, feature-scale (audit
  capability gaps 1–7):** outcome calibration/benchmarking, portfolio factor-correlation risk,
  option Greeks/assignment exposure, tax-aware funding, clickable evidence citations,
  operational alerts, broker-sync automation — each its own scope, owner to prioritize.
  Tests: **696 smoke** (+14: the ET-rollover regression incl. an end-to-end readout assert,
  the eligibility gates, the relabels, the no-NAV-claim sweep, the shared denominator) +
  **148 render** (+5: a live PANIC-asserted board hard-WAITs with the gate named and leaves no
  AGREE_PICK; the cap-veto scenario now clears the asserted regime too, or it would pass for
  the wrong reason — plus the acct-equity pins).
- **FEAT-TT-READY (v3.50) — one decision-readiness statement per name.** The audit's "too many
  freshness clocks": a ticker page could carry **eight** independent dates — live quote · manual
  `ref_px` mark · `lastRun` · model/lint state · hinge observations · `pos.at` · per-leg option
  provenance · thesis `updated` — each honest alone, none of them answering *can I act on this
  name right now?* Eight truthful clocks that never sum is how a NEVER-RUN name with an undated
  thesis still read as maintained. **`readiness(x)`** consolidates them, and invents no new clock:
  every part reads the SAME helper the individual chip already reads (`runState` · `ddDate`/
  `ageDays` · `ptModelRows`/`lintPtModel` · `LIVE_PX`/`ref_px` · `posOf`/`posAge` · `hingeTally`),
  so a part can never disagree with the chip it summarizes — the `ptModelRows` rule, one
  computation at many altitudes. Severity follows the audit's *"gate the interface by evidence
  coverage"*: **BLOCKED** = evidence needed to act is missing or expired (no current model, a
  MIS-KEYED schedule — the v3.39 rung that silently floors is missing evidence, not a warning —
  no current TT run, no defined hinges, no usable price, a blocking decision scoped to this
  name) · **CAUTION** = evidence aging or partial · **READY** = every clock current. Two
  deliberate NON-blockers: a **red hinge** is surfaced never vetoed (D3, v3.39), and an **absent
  position** cautions rather than blocks — an unheld new name legitimately has none, and blocking
  it would gate exactly the names the next dollar is FOR. Blocking decisions scope by **explicit
  `decision.sym` only**; inferring which decision blocks which ticker from prose would be a guess,
  and a guessed blocker is worse than none (unscoped ones stay board-level, where TODAY already
  surfaces them). Rendered on **both** per-ticker decision surfaces — above the four answers on
  the deep-dive tab, and leading the card (the only surface a WATCH name with no tab ever gets) —
  with the verdict as a token and every blocker/caution as a visible chip (v3.25: a summary is
  only honest if the red things survive it), OK clocks included so "current" is *stated*, not
  inferred from silence. **FIX-B now vetoes on `readiness().blockers`** rather than re-deriving
  the run check, so the green line and the name's own readiness bar cannot disagree; cautions
  never veto (aging evidence is the owner's to weigh, missing evidence is not). Found while
  wiring: one surviving `% NAV` claim on the card, missed by the FIX-D sweep.
  Tests: **718 smoke** (+22, `readiness()` lifted and RUN against the real PT helpers — a string
  pin cannot prove a severity rule, and this one gates the green line) + **153 render** (+5: the
  bar leads both surfaces, every clock stated, and AAA's red hinge named on the bar while absent
  from the blocker list).
- **v3.51 "the page tells the truth about itself" — the PUBLIC-side audit.** A second audit found
  the public dashboard's positioning defensible (*"MacroDash tells you whether the market backdrop
  supports taking risk — and abstains when the evidence is stale"*) and its moat correctly placed
  in the **judgment layer, not the data layer**. Its Critical #1 (the two freshness realities) and
  the NFCI chip/denominator defects were **already fixed by v3.49** — it audited a pre-fix
  checkout. What survived, all of it the same shape: not a wrong NUMBER, a wrong CLAIM about
  the page itself. **The engines are named** — this six-factor vote is the **MACRO BACKDROP**,
  distinct from `/readout.json`'s six ORDER-GATING checks (both legitimate; unnamed, a reader
  reasonably assumes one verdict disagreeing with itself). **"5-factor vote" → 6** in three
  user-facing strings (NFCI has voted since v3.43), now pinned against `REGIME_FACTOR_FIELDS` so
  a 7th voter fails the build. **Confidence, the audit's first-screen item**: Signal Quality
  counted TILES and never said whether the VERDICT was trustworthy — the strip now reports
  `BACKDROP N/6 factors voting`, **names** the excluded ones ("N of 6 usable" without saying
  which is half a fact) and calls out a blind **crash gauge (VIX)** by name, all off
  `computeRegime`'s own `counted`/`totalFactors` so it cannot drift from the vote. **SPY is
  labelled the FRED SP500/10 proxy it has always been** (the tooltip claimed "S&P 500 ETF").
  **CAPE credits `multpl.com`** — "Manual" beside a LIVE badge made the provenance vocabulary
  self-contradictory (`api` is the fetch path, `mode` is freshness, and multpl IS the live
  scrape). **The alert toggles state their real limit at the weight of the control** rather than
  in 8px muted text — an ON/OFF beside "notifications not wired" is the honesty invariant
  violated by an *affordance* instead of a number.
  **FEAT-WHY3-MATERIAL — freshness is not relevance.** WHY #3 gated the top RSS item on
  freshness alone, then labelled whatever returned "Headline driver": the audit caught a
  **Fidelity death-certificate administrative story** presented as the driver of a macro regime
  — fresh, dated, correctly attributed, explaining nothing. A confidently-irrelevant *why* is
  worse than no why, exactly as a fabricated number is worse than a missing one.
  `isMacroMaterial()` is a curated **allowlist of macro-transmission vocabulary** (policy ·
  inflation · growth/labor · rates/credit · volatility · energy · systemic shocks *and their
  resolution* — a ceasefire moves the tape like its onset). Deliberately **ONE-WAY**: a
  non-matching headline is WITHHELD and the slot says *why* it was withheld — "today's top story
  is not macro-material" is a different fact from "no headline arrived", and only the first stops
  an administrative story reading as the market's driver. Never rewritten, never scored.
  **Owner calls, honoured:** the **moon voice stays PRIMARY** (`wen moon?`/MOONING/HODL —
  personality kept, and pinned so a later refactor can't quietly drop it), and of the audit's
  demote list only the **Mag 10 quote strip** is cut — v3.43 took its curated fundamentals on the
  Yahoo-dupe test and the surviving quote strip failed the *same* test. Component, mock array,
  state, CSS and merge all removed; `mag10PricesJson` stays **mapped** because the same Finnhub
  pull feeds QQQ. The cut took its attribution with it — and found that the **footer had been
  crediting "Mag 10 fundamentals · SEC S-1" for two releases after v3.43 deleted both**, the
  precise defect v3.43's own note warns about. Watchlist, headwinds, Peoria and the alert
  toggles are KEPT per owner call. **Deferred (feature-scale):** "what would change the verdict"
  — the exact thresholds that flip the posture — is the audit's remaining first-screen item and
  its own scope.
  Tests: **735 smoke** (+14) + **153 render**, plus a **14-check Chromium pass on the built
  page** (every collapsed group expanded to prove nothing cut reappears, and that the footer
  still RECORDS the retirement — history kept, like the CBOE note).
- **FEAT-ALERT-EVAL (v3.52) — the alerts evaluate, or say they cannot.** A cross-suite audit
  called the Macro Alerts section *"interface theater"* for toggles beside "notifications not
  wired". The defect was one layer earlier and worse than the finding: **`triggered` was a
  hardcoded `false` that nothing ever wrote**, while the header claimed *"Triggers evaluate live
  data"* — so the red dot was unreachable, `activeAlerts` was permanently 0, and the section
  asserted "nothing has tripped" from code that **had never looked**. That is a directional claim
  on absent evidence: the exact v3.1 invariant this project exists to enforce, violated by an
  *affordance*. (v3.51 had fixed only the DELIVERY half of that sentence and left the evaluation
  half standing — which is why this is a follow-up, not a new feature.)
  Evaluation is now real and rides the same rails as everything else: `evalAlert()` judges a
  threshold **only** from LIVE/CACHED, non-stale inputs, and a mock/stale input yields **BLIND**
  — deliberately distinct from CLEAR, because *"this has not tripped"* and *"I cannot see whether
  it tripped"* are different facts and only the second is true when the feed is dead (the v3.40
  TAILWIND-withhold asymmetry, the v3.50 fail-closed rule). The header reports `N BLIND`
  separately, since "0 FIRED" with dead inputs is a false clear. The **SPY/200-DMA cross is judged
  against today's live moving average**, not the `692.4` hardcoded when the alert was authored —
  a constant that silently drifts as the market moves is the same stale-mark defect `PX_STALE_D`
  exists to catch. No stored `triggered` field survives; trigger state is computed every render.
  **A11Y (same audit):** the public page had **zero landmarks and zero live regions** — the regime
  verdict is the page's entire output and a screen reader was never told it changed. Added
  `role="main"`, and `aria-live="polite"` on the verdict band and the confidence strip only —
  politely, and not on every tile: a reader should hear *"the verdict's evidence base changed"*,
  not each number ticking.
  Tests: **748 smoke** (+13; `evalAlert` and the real `ALERT_METRICS` table lifted from source,
  since Node cannot import JSX — trip/clear/blind/stale/no-metric/non-finite all executed) +
  153 render + an 18-check Chromium pass.
- **FEAT-FLIP (v3.53) — "what would change the verdict", and ONE band table.** The public
  audit's fourth first-screen answer (Posture ✓ · Confidence ✓ v3.51 · Why ✓ · *what changes the
  call* ✗) and the public-side counterpart to the terminal's `readiness()`: that one answers
  *"is the evidence there to act"*, this answers *"what would move the answer"*.
  **The structural half matters more than the feature.** The six bands were inline literals
  inside `computeRegime`, so any flip surface needed a SECOND copy of every threshold — the
  drift defect this project keeps paying for (the v3.49 5-vs-6 denominator, the v3.51 stale
  factor-count label, the v3.39 PT audit). They now live in **`REGIME_BAND_TABLE`**, where
  `vote()` is the ONLY expression of a band: `computeRegime` VOTES from it and `flipConditions`
  measures DISTANCE to the same edges, so a flip claim can never contradict the verdict it
  describes. `verdictFrom()` (the strict-majority rule) is extracted for the same reason — the
  simulation runs the *identical* test, not a restatement. The refactor is behaviour-neutral and
  every boundary is now EXECUTED rather than string-pinned (the DEC-33 convention), including
  the two asymmetries that make a second copy dangerous: **F&G is the one INVERTED factor**
  (bullish ABOVE its edge) and **NFCI is the one INCLUSIVE bull edge** (`<=`, so it reads "at or
  below").
  **Load-bearing, not decorative:** the naive version prints six distances. `flipConditions`
  simulates each crossing through `verdictFrom` and keeps only those that actually change the
  label — then sorts nearest-first. **Only ADJACENT transitions are offered**: from the bull band
  you can reach neutral, not bear. Quoting "VIX above 25 would flip this" while VIX sits at 17 is
  true arithmetic and a misleading next step.
  **The three abstention rules, each with precedent here.** (1) A **stale** factor is not voting,
  so its threshold is not load-bearing — it is listed as excluded, never as a distance (the same
  gate as the vote). (2) A factor whose vote is not a single scalar crossing **abstains with the
  reason named** — CPI votes on the SHAPE of its trend, CAPE on a two-condition OR; inventing a
  crossing for a compound rule would be a fabricated number in a decision surface. (3) **"No
  single flip changes this" is a real answer**, stated plainly in both the band and the panel,
  never padded with the nearest distance to look responsive (the `readiness()` BLOCKED / one-way
  `isMacroMaterial` withhold rule). Abstentions and exclusions RENDER — hiding them would read as
  "these four are all there is".
  **Deliberately NOT wired into `/readout.json`** — same reasoning as NFCI on arrival: that
  contract gates real orders and a new field there is its own decision.
  Found by the browser check while verifying: a **`whiteSpace:"nowrap"` subtitle in the v3.46 AI
  unit-economics header blew the page to 488px at 390px wide** — pre-existing, now wrapping.
  Tests: **771 smoke** (+23: every band boundary executed, the majority rule at 3/5/6 voters,
  all three abstention rules, adjacency, inclusivity copy, sort order, and the render pins) +
  153 render + a **14-check Chromium pass at 390px and 1200px**, panel open and closed.
- **FEAT-QUORUM (v3.54) — "mock must never vote": the 11.4.5 audit's CRITICAL.** The audit
  found the one defect that mattered most and that **passed every existing test**: `staleFactors`
  excluded only `STALE`, so a **MOCK factor still voted**. During `LOADING` — and after any
  failed fetch — every field is MOCK, so the page computed a confident posture *entirely from
  `MOCK_DATA`* while Signal Quality truthfully reported `0 live / 15 mock` two rows above it.
  The tiles have suppressed directional calls on mock since v3.1 (`isIllustrative`); the
  **headline verdict never did**, which is the one place it matters most.
  Three linked fixes. **(1) MOCK is unusable in a live build**: `unusable()` drops anything not
  LIVE/CACHED, gated on `liveBuild` so a pure demo build is untouched — mock IS the demo's
  baseline by design (the `demoted()`/`anyLive` rule). That gate cannot come from `mode`, because
  **`mode:"MOCK"` is ambiguous** between "demo build" and "live build whose fetch failed", and
  only the second must withhold; `useMarketData` now exposes the build's **intent** (`liveBuild`).
  **(2) A quorum**: `REGIME_QUORUM = 4` of 6 → below it the label is **INSUFFICIENT**, not a thin
  verdict, with `raw` recording what the majority would have said (never silent, same contract as
  the v3.40 TAILWIND downgrade). The dashboard had **no abstention rule at all** while the tt-v1
  readout has refused to publish below 3 available checks since v3.3 — the two engines disagreed
  about when to stay silent and the *human-facing* one was the permissive side. Four is
  deliberately stricter than the readout's three: that consumer knows what INSUFFICIENT means,
  a public reader does not. **(3) LOADING is not a verdict state** — the posture is withheld
  outright, the flip line is suppressed (nothing to flip), and the moon voice gets its own
  honest fourth state (`CAN'T CALL IT`) rather than defaulting to HODL, which would render a
  real hold call made from no evidence.
  **WHY #1 freshness-gated (audit High).** WHY #2 carefully gated its cross-signals while WHY #1
  asserted SPY/CPI/Fed **unconditionally** — a mock CPI could be narrated as "today's core tape"
  inside the verdict's own explanation. Each is now gated independently, unavailable clauses are
  OMITTED rather than filled from mock, and a thin anchor states itself (`N/3 core inputs
  usable`). Found while wiring: `FW_FIELDS` didn't contain the three core fields, so gating them
  without adding them would have dropped inputs that were perfectly fresh.
  **`test/public-render.mjs` (`npm run test:public`) — the structural fix.** The audit's sharpest
  point was that this defect passed everything, and it was right: smoke covers pure functions and
  source strings, `test/render.mjs` covers `admin.html`, and **nothing ever drove the public React
  page through its data states**. The new suite serves the built bundle with a stubbed
  `/api/snapshot` and asserts the contract across **loading · live · degraded · error**, plus
  320/390/1280px reflow and the landmarks — 28 assertions. Skips cleanly without Chromium, same
  additive convention as `test:ui`.
  **A11Y (audit High).** `text-muted` `#3d4760` measured **2.15:1** on `--bg` while carrying 7–10px
  PROVENANCE text — the honesty layer the whole product rests on — now `#717d92` (4.79:1 / 4.54:1
  on surface). `live-cyan-700` was annotated AA-compliant and measured **3.20:1** on its own badge:
  a token *asserting* a compliance it never had, the same defect class as a label describing
  deleted data; now `#1c93b0` (4.78:1). **Contrast is now COMPUTED in smoke**, not claimed in a
  comment. Added a `:focus-visible` ring (focused controls had **no** indicator) and the page's
  first-ever heading — it contained no `h1`–`h6` at all, so a screen reader had no outline;
  visually hidden, since the branded header is the visible identity.
  **HTTP semantics (audit Medium).** `?seed=1` and `?migrate=1` **mutated state on GET**, so a
  prefetch, link preview, uptime monitor or replayed URL could trigger a write. Both are now
  POST-only behind the same Origin/CSRF guard every other mutation uses, idempotency unchanged,
  with the GET path returning 405 naming the correct verb. The old pin literally read *"read-only
  by design — no PUT/POST handler exists"* and **passed while the GET route wrote** — it measured
  the verb, not the safety; it now measures the safety.
  **Could NOT reproduce** the audit's *"320px: 19px horizontal overflow"*: measured 320px on the
  real fetch-failure path, every collapsed group expanded, `scrollWidth === 320`. The overflowing
  node it describes is almost certainly the 317px `whiteSpace:"nowrap"` subtitle **v3.53 fixed**
  hours earlier — consistent with auditing the deployed bundle before Pages redeployed.
  Tests: **802 smoke** (+31) + **153 render** + **28 public-render** (new).
- **FEAT-TT-CAPABILITY (v3.55) — the demand side of the capex tripwire, built as a FALSIFIER.**
  FEAT-TT-CAPEX (v3.45) instruments the **supply** of AI capital and fires when ≥2 spenders guide
  down. But the *reason* they would guide down is capability/ROI disappointment, and that leading
  indicator was instrumented nowhere: the book watched the announcement, not the thing that
  causes it. `board.capability` closes it — and the design choice that matters is that it is a
  **falsifier, not a confirmation**. A field reading *"capability: healthy"*, maintained by the
  person holding the AI-infra book, is self-attestation at its most dangerous — the *"sophisticated
  rationalization engine"* the value-proposition audit warned about. So **`threshold_months` is
  REQUIRED by `validateBoard`**: the level at which you would change your mind must be
  pre-committed and stored *before* a reading can be filed against it. A threshold chosen after
  seeing the observation is exactly the rationalization this block exists to prevent, and the
  validator is the only thing that can enforce the ordering. `prior_months` is required too (the
  v3.29 rule that the signal is the DELTA), as are `metric`, `source` and `as_of`.
  **Nothing extrapolates** — smoke asserts there is no `Math.pow`/`**`/`Math.exp` anywhere in
  `capabilityState()`. A doubling time is a rate, and projecting "capability in 2030" from it is
  the v3.46 window-annualising error with a longer fuse (a 12-week move raised to 52/11 read
  −98.8%/yr: arithmetically correct, economically absurd). It reports what was measured and how
  it MOVED. The tripwire is **bidirectional** like the capex tape — a materially faster doubling
  is information too, and suppressing it would make the block a one-way confirmation of the bear
  case. Bands reject the impossible, not the unusual: a **very long doubling time is a genuine
  STALL**, which is the signal, so it must not be banded away as a typo. Fails closed — absent or
  malformed reads as unknown, never as healthy.
  Rendered in the SAME panel as the capex tape (supply and demand are two halves of one thesis)
  and the drawer summary carries the demand state so a red thing survives the collapse. **Supply
  and demand share ONE stance badge** (`⚡ AI both legs`): they open the same drawer, two chips
  would be redundant, and — measured — a second chip cost a wrap row and blew the v3.42 390px
  stance budget from 119px to 165px. That guard did its job; the fix was design, not truncation.
  **Honest limit, stated rather than hidden:** this is the weakest-sourced input the book carries.
  Task-horizon doubling is one research group's curve fit through a modest number of noisy points
  across model generations — an observed trend, not a law like the compute scaling curves — and it
  updates in months, not days. Survivable for a curated, non-voting block whose whole job is to
  name a falsifier; it would **not** be survivable for anything that gates an order.
  Tests: **+19 smoke** (validator rejections incl. the missing-threshold case, bands both ways,
  and `capabilityState` lifted and RUN — a tripwire is a claim about numbers) + **+2 render**
  (a tripped falsifier driven live against a synthetic fixture).
- **FEAT-30Y (v3.55) — the long end, and why this is not the TLT rejection replayed.** v3.43
  refused TLT because it is a ~17-duration monotonic transform of the `tenYear` this page already
  carries — no new information, plus an ETF's expense drag. **DGS30 is not derivable from DGS10**:
  the **10s30s spread** is the term-premium / fiscal-risk gauge, and *"the long end breaks out
  while the front end holds"* is a different transmission channel from a parallel shift. It passes
  the v3.43 test the same way NFCI did — Yahoo shows you the 30Y level; what it does not do is
  judge it, abstain when stale, or pair it with the curve shape.
  Wired through the existing `fetchFred` path (17 series = **one more batch of 5**, which is
  exactly why the phase batching must not be collapsed), emitting `thirtyYear` + D1/W1/M1 +
  sparkline, and the derived **`spread10s30s`** stamped from `thirtyYearAsOf` (the `creditSpread`
  pattern) with the temp sparklines deleted rather than leaked. `thirtyYear` joins **DAILY** —
  unlike NFCI, DGS30 genuinely is daily, so `idx[5]`/`idx[21]` really are ~1wk/~1mo. Deltas are
  **absolute pp**, never `pct()`, matching the 10Y (rates move in points, not percent).
  Bands `[0,20]` on the yield (the 1981 long-bond peak was ~15.2%) and **`[-10,10]` on the
  spread — an INVERTED curve is the signal, not a parse fault** (the negative-WTI rule).
  The tile sits beside the 10Y because the pair IS the point, states the 10s30s on its face
  (naming `INVERTED` when negative), and carries **5.00% as a stated REFERENCE level, never a
  verdict** — a directional call off a level would be the v3.1 invariant violated. Two alerts ride
  FEAT-ALERT-EVAL: **30Y above 5.2%** (active) and **10s30s inverts** (off by default), both
  live-gated, and the spread alert needs BOTH legs live or it reads **BLIND** rather than clear.
  **It does NOT vote on arrival** — same rule NFCI arrived under: `REGIME_BAND_TABLE` and the
  tt-v1 readout are untouched, because adding a voter changes the majority math for a contract
  that gates real orders, and the bands would be asserted rather than calibrated (FRED is
  unreachable from this build environment). Owner call once real values have been observed.
  Tests: **+17 smoke** + a **15-check Chromium pass** across live and mock-fallback at 390px,
  confirming the tile is ILLUSTRATIVE on mock and that the 5.2% alert trips at 5.24.
- **FEAT-TT-RANKEXPORT (v3.56) — the populated rankings, off the phone.** The rankings document
  cannot live in the public repo (book content is KV-only), so the terminal produces it where the
  data actually is: **📊 RANKINGS → SHARE** builds it client-side from memory and hands a real
  `File` to `navigator.share()`, which on iOS opens the native sheet — Save to Files, Notes,
  Messages, AirDrop.
  **The load-bearing property is REUSE.** `buildRankingsMd()` reads `UPSIDE_ROWS`, `AGREE_PICK`,
  `sellRank()`, `readiness()`, `ttInfo()` and `rankWeight()` — it never calls `ptModelRows` or
  `pickRow` itself. An export that re-derived its own ranking could disagree with the screen it
  was exported from, which is the exact drift defect doctrine #1 exists to stop (smoke asserts
  the recompute functions are absent from the section).
  Contents, in the order the daily loop asks for them: **STANCE** first (whether capital may move
  outranks any ranking) · a **master table** carrying composite, %/yr, weight, readiness, flags
  and **four category ranks per name** (overall upside · composite · within tier · within lens) ·
  **per-tier and per-lens leaderboards** · **ELIGIBLE NEXT DOLLAR** with *why each other name is
  not* · **FUNDING PRIORITY** carrying its own "not a sell recommendation" disclaimer · names it
  could **NOT** rank (silent truncation reads as full coverage) · model lints · and a
  **provenance footer** stating the floor denominator, the self-attestation limit, and that the
  file is private book content.
  **Ranks are DENSE** — two names tied on upside share rank 1 and the next is 3, because tied
  scores are not first and second; a name with no rate is *excluded* from that ranking rather
  than sorted last as if it were 0.
  **The iOS gesture rule is respected:** the document is built **synchronously** before any
  `await`, because Safari requires `navigator.share()` to be reached from the user gesture.
  Fallback chain: file share → text share → clipboard → download. `text/plain` (not
  `text/markdown`) with a `.md` filename, since iOS share targets accept it far more reliably.
  **A cancelled sheet is an `AbortError` and is never reported as a failure.**
  Found by the browser check: the stance line printed its verdict twice (`st.txt` already leads
  with it) — now one line, with the qualifier chips as bullets.
  Tests: **863 smoke** (+17, incl. `rankCategories` lifted and RUN — dense ties, excluded
  no-rate rows, per-category scoping) + **169 render** (+13: the real document built from the
  fixture and asserted for NaN/undefined leakage, plus the share chain driven with a stubbed
  `navigator.share` confirming a real `File` of the right name and type reaches the sheet, and
  that cancelling neither throws nor toasts a failure).
- **v3.57 — end-to-end pass: five findings, one of them a white-screen.** The terminal driven
  through empty / minimal / partial / adversarial books at 390px and 1200px, every API failure
  mode (500, malformed JSON, wrong shapes, all-fail), and the pure functions fuzzed with hostile
  inputs. Everything degraded gracefully except one path, and the bugs found were the kind no
  render test catches because the fixture is always well-formed.
  **(1) A malformed stored book white-screened the terminal.** `applyServer`'s `data.book||[]`
  catches null/undefined but a truthy non-array (`book:{}` — a bad import, a hand-edited KV doc,
  a partial write) sailed through and `BOOK.filter` threw, killing the whole board.
  `validateBook` guards the PUT path; **GET trusts whatever KV holds**, so the client has to
  fail closed too. It now degrades to EMPTY — which has an honest rendered state — and **says the
  stored doc is malformed, warning against saving over it before exporting a backup**, rather
  than silently pretending the book is fine.
  **(2) `rankCategories` ranked a NaN rate** (introduced in v3.56): `!==null && !==undefined`
  does not exclude NaN, so an unrankable name received a rank. Now `Number.isFinite`, which also
  catches Infinity — the same rule as "unmeasured must never read as 0": unrankable means
  EXCLUDED.
  **(3) A string-typed payload accused the wrong field.** Quoted numbers (`"100"` not `100` —
  what hand-edited JSON produces constantly) compute no rungs, and `NOFLOOR` then reported the
  inputs as *missing* when they were present, sending you after the wrong defect. A new **`TYPES`
  error** names the actual offending paths and the fix (`"100" is not 100`), and is careful not
  to flag a genuinely non-numeric string like a `note`.
  **(4) A comment still claimed the Kalshi odds were unwired** ("live Kalshi wiring TODO") —
  live since v2.6.3. The same label-outliving-its-data defect as the Mag-10 footer.
  **(5) Three files carried two body caps with no stated reason.** `positions.js` is 64KB while
  the book is 200KB; that is deliberate (the store holds only `{sym: pos}` records, and a merge
  PUT far larger is a malformed sync) but read as an oversight. Now documented.
  Also confirmed working and left alone: `fl:"n/m"` on negative EPS is intentional (v3.17, no P/E
  before profit) and is correctly filtered out of the candidate set by `pickRow`'s numeric test.
  Tests: **878 smoke** (+15, incl. `applyServer` lifted and RUN against malformed shapes — and
  a test-isolation bug caught while writing them, where a shared closure leaked toasts between
  fixtures) + 169 render + 28 public-render.
- **v3.58 "the hotfix" — the public UX re-audit's five fix-now items.** The owner-commissioned
  re-audit (of v3.55; reconciled against v3.57 before planning) returned **HOLD for hotfix, do
  not roll back**: the v3.54 quorum fix is confirmed sound, but the page still contradicted its
  own honesty contract in one place and broke its narrowest width. Five fixes:
  **A1 — the 5 Whys narrated MOCK under a withheld verdict.** `freshSet` keyed on `anyLive`, so
  a live build in its LOADING or fetch-error state passed `fresh:null` — computeFiveWhys's
  "demo mode, narrate everything" — and the page's most explanatory section asserted mock
  SPY/CPI/Fed as today's core tape while the verdict said CAN'T CALL IT. Keyed on **`liveBuild`**
  (the v3.54 intent disambiguation, completing it): loading/error now passes an EMPTY set, every
  clause freshness-gates out, and the anchor states itself (`0/3 core inputs usable`). The
  HEADLINE's SPY clause is gated the same way — it embedded the mock day-move unconditionally.
  Demo builds still pass `null`: mock IS that baseline (the `demoted()`/`anyLive` doctrine).
  **A2 — the 320px contract.** The sticky header measured 327px on the deployed page. The
  identity group gets `minWidth:0`, the action group wraps, and the duplicate lowercase
  wordmark hides below 360px — the brand name is already the element beside it.
  **A3 — the browser suite tells the truth about itself.** `public-render.mjs` navigated to `/`
  only, so its "public" results actually described the OPERATOR header (with the TERMINAL
  link). Routes are now explicit and BOTH are driven (4 widths × 2 routes), and all browser
  suites honor **`REQUIRE_BROWSER=1`**: a missing Chromium becomes a hard failure instead of a
  clean skip — a silently-skipped gate reads as a passed one. Bare machines keep the skip.
  **A4 — the public/private boundary is enforced, not commented (owner decision).** The
  shareable `?view=public` route now gates MY CONVICTION and Macro Alerts behind `!publicView`
  (the TERMINAL-link pattern; the Zone-E gate finally has something to hide). The default view
  keeps both — the v3.51 "keep" call stands for the operator's own page. The public footer
  NAMES the omission, because a cut takes its attribution with it.
  **A5 — the three npm advisories are classified, not mysterious.** Measured:
  `npm audit --omit=dev` = **0 vulnerabilities**; all three (esbuild moderate, postcss high,
  vite high) are dev-scope build toolchain, no production exposure. `npm run audit:prod` pins
  the command; `npm audit fix` took the in-semver toolchain patches (nanoid, postcss).
  Tests: **890 smoke** (+12, incl. the headline gate run behaviorally in all three freshness
  modes) + 169 render + **50 public-render** (+22: both routes × 4 widths, the A4 route-pair
  boundary proof, and the A1 no-mock-narration assertions in LOADING and ERROR — the audit's
  exact exit condition) + REQUIRE_BROWSER verified to exit 1 against an empty browsers path.
- **v3.59 "the follow-ups" — the re-audit's medium findings, closed.** Five pieces:
  **B1 — ERROR is a mode, not a costume.** A failed live fetch collapsed to `mode:"MOCK"` —
  indistinguishable from an intentional demo build, with no way to tell whether to wait, retry,
  or shrug. `useMarketData` now sets **`ERROR`** (mock content still renders underneath,
  everything stays ILLUSTRATIVE — graceful degradation holds), exposes `lastError` and a
  **`retry()`** that resets to LOADING and re-arms the full fetch machinery. The header states
  the outage ("live service unavailable — numbers below are illustrative") with a ↻ RETRY
  button; `MOCK` now means exactly one thing: a demo build. This completes the `liveBuild`
  disambiguation v3.54 started. The public suite drives the whole cycle: fail → ERROR badge →
  flip the stub → Retry → posture appears.
  **B2 — fresh is not live.** Signal Quality's "13 live" counted LIVE+CACHED under one word, so
  a cached observation read as newly fetched. The rollup is now **`N fresh (L live · C cached)`**,
  and the two static "derived from live data" footers became **state-derived** (live · cached
  snapshot · unavailable · demo) from ONE derivation shared by both — a static string asserting
  liveness across error states was the same class of lie as the alerts affordance.
  **B3 — operational data needs a token.** `?debug=1` exposed `_diag` to anyone; it now requires
  the **`DEBUG_TOKEN`** secret (`?debug=<token>`, fail closed both ways — no secret configured
  means no `_diag` for anyone). And the public routes gain a **report-only CSP** (observe before
  enforcing); `/admin.html` is deliberately exempt — its buildless inline script would need
  `'unsafe-inline'` script-src, which defeats the point, and its CSP is the deferred
  admin-extraction scope.
  **B4 — a11y past the tokens.** Header actions get real 44px thumb targets at phone width;
  sparklines are marked decorative and the SPY chart gains a visually-hidden **text equivalent**
  (trend vs both moving averages — the decision content); and the two block-sized `aria-live`
  regions narrowed to **one concise status sentence** ("Backdrop MIXED: 4 of 6 factors usable")
  — a reader should hear that the call changed, not entire blocks re-read.
  **B5 — AGENTS.md stops being a rot vector.** Its two incarnations both froze and drifted
  (the re-audit caught it still claiming a long-outgrown suite size and a missing test script).
  Now a thin pointer with **no volatile facts at all** — no versions, no counts — and smoke
  enforces that shape, so the third incarnation cannot rot the same way.
  Tests: **904 smoke** (+14) + 169 render + **56 public-render** (+6: the fail→retry→recover
  cycle driven live, and the narrowed live-region contract).
- **v3.60 "the P0 slice" — Overview shell, Evidence Matrix, What Changed (the committed
  sprint).** The re-audit's recommended vertical slice, built behind the existing data with no
  new fetches. **C1 — the extraction the last two audits both named as highest-leverage:** the
  regime engine moved verbatim to **`src/regime.js`** (pure, Node-importable — smoke now
  IMPORTS it instead of lifting source text, which is stronger and immune to formatting
  drift; the one change is `tintKey`/`colorKey` out, colors resolved by the UI). On top of it,
  **`src/evidence.js`** builds the **EvidenceSet**: ONE typed contract — state (the re-audit's
  interface table, 1:1: LOADING · LIVE · CACHED · DEGRADED · INSUFFICIENT · ERROR · DEMO),
  per-factor rows (value · vote from the band table itself · freshness · as-of · exclusion
  reason), flips, quorum — that components render instead of each interpreting provenance.
  The dashboard's own `modeOf` and `staleFactors` ARE now the shared `fieldMode`/
  `factorExclusions` (no local copy to drift). **C2:** a real `<header>` landmark, a Sections
  `<nav>` (now the sticky element — the header scrolls away instead of renting 60px of every
  phone viewport), and a six-anchor `h2` outline (overview · drivers · markets · macro · ai ·
  health) where the nav and the outline are the SAME structure. **C3:** the **Drivers matrix**
  — six factor cards rendering the contract, an excluded factor NAMED with its reason on the
  card ("4 of 6 usable" without which is half a fact). **C4:** **What Changed** — the baseline
  is only ever a quorate, non-withheld, live-build snapshot (`summarizeEvidence` returns null
  otherwise, so mock/thin evidence can never seed a diff); first visit says **"baseline set"**
  (a different fact from "no change"); an identical return visit says **"no material change
  since <date>"** explicitly; posture flips, confidence moves, factor drop-outs AND recoveries
  are each named. Persist happens AFTER compare — the baseline advances exactly when a
  comparison was rendered. A garbled/wrong-version stored baseline fails toward "baseline
  set", never toward diffing a shape we don't understand. Plus a **Data Health** section
  (per-source mode · cadence · as-of, ERROR + Retry surfaced there too).
  **C5 — the repo's first CI** (`.github/workflows/test.yml`): smoke + BOTH browser suites
  under `REQUIRE_BROWSER=1` (a missing browser FAILS in CI; bare machines keep the local
  skip) + `audit:prod`. `PLAYWRIGHT_BROWSERS_PATH` is pinned because `findChromium()` does
  not search playwright's default CI cache — found before it could fail a run.
  Tests: **926 smoke** (+22: every contract state EXECUTED via real imports, the digest rules
  incl. garbled-baseline and recovery cases, and the five engine pins migrated from source-
  lifts to behavior) + 169 render + **67 public-render** (+11: nav/outline/landmark, the
  matrix with a named exclusion driven live, and the baseline-set → no-material-change cycle
  across a real reload).
- **v3.60.1 — the gate that failed on a browser that was there (2026-08-02 scheduled audit).**
  The repo's first CI run, shipped hours earlier in v3.60, went **red on `main`** — and the
  failure was the inverse of the one it was built to catch. `findChromium()` (a copy in
  `test/render.mjs` and `test/public-render.mjs`) hardcoded playwright's **pre-Chrome-for-
  Testing** directory layout. playwright-core 1.62 ships CfT builds, whose own
  `EXECUTABLE_PATHS` table reads `"linux-x64": ["chrome-linux64", "chrome"]` — so on
  `ubuntu-latest` the browser downloaded **successfully** (`chromium-1234`) and was then
  reported **absent**. Under `REQUIRE_BROWSER=1` that is a hard failure, so both browser
  suites AND `audit:prod` never ran: the gate A3 (v3.58) added specifically so *"a
  silently-skipped gate reads as a passed one"* failed loud on a **present** browser instead,
  and every commit since landed unverified.
  **The fix is not a wider guess.** The audit proposed adding the one x64 path; measured
  against playwright's real table, the same hardcoded list was **also wrong for both macOS
  layouts** (CfT renamed `Chromium.app` → the `Google Chrome for Testing.app` bundle, split
  by arch), so a maintainer running `npm run test:ui` on an Apple-silicon machine got a
  false SKIP — the *original* defect, silent. Root cause is the hardcoded copy itself, so
  `chromium.executablePath()` — playwright's **own registry**, the source of truth for the
  layout — is now consulted first and will survive the next rename. It COMPUTES a path for
  the build pinned in `node_modules` rather than verifying one, so the result is
  existence-checked, and the directory scan remains as the fallback for a browser installed
  by a *different* playwright build (the pinned-image case, which is exactly what this
  environment has). Both contracts are preserved and re-verified: an explicitly set
  `PLAYWRIGHT_BROWSERS_PATH` still means "look nowhere else", `REQUIRE_BROWSER=1` with no
  browser still exits 1, and a bare machine still skips cleanly at exit 0.
  **Verified by reproduction, not inspection**: the CI layout was rebuilt locally
  (`chromium-1234/chrome-linux64/chrome`) and the pre-fix code fails on it with CI's
  *identical* error string while the fixed code passes 169 — the bug reproduced and closed,
  rather than a diff assumed to work.
  **Doc drift (audit §5), fixed by deletion rather than by bumping.** `README.md` asserted a
  version ~52 point releases stale, an assertion count off by hundreds, and *"there is no
  `test` script"* — which had been false for many releases and actively misdirected
  contributors; CLAUDE.md's own **status header was frozen ~58 releases back** and carried
  the same false `test`-script claim. That is the "label outliving its data" defect this
  changelog keeps fixing *inside* the app (the Mag-10 footer, the "5-factor vote" strings,
  the Kalshi TODO), so it gets the cure v3.59's B5 already proved on `AGENTS.md`: **state
  where the truth lives, don't copy it.** No version, no counts, no feature list outside
  their one home. `HANDOFF.md` is relabelled a dated **ARCHIVE** — hand-syncing a second
  copy of the changelog is what rotted it — and future sessions append rather than edit.
  Guards, because a doc rule nothing enforces is the rot vector again: smoke **[39]** pins
  the browser-path contract (both CfT and pre-CfT layouts, the registry call, the
  existence-check, and both skip/fail contracts) and **reconciles the list against
  playwright-core's live `EXECUTABLE_PATHS`**, so a newly-added platform is caught rather
  than merely string-pinned; smoke **[40]** pins the doc shape. Both were negative-controlled
  — and the reconciliation caught itself passing **vacuously** on the first pass, matching
  the directory name inside its own explanatory comment, so it is now scoped to the
  `CHROMIUM_RELS` array (the same vacuous-assert defect v3.54 found in the "read-only by
  design" pin that passed while the route wrote).
  Not changed: the audit's §3 note that `computeFiveWhys`'s `opts.stale` is unreachable in
  production is **correct and already documented at the call site** as a mock/demo fallback —
  it is latent, not a defect, and removing a working fallback to satisfy an audit note would
  be the riskier edit.
  Tests: **948 smoke** (+22) + 169 render + 67 public-render + `audit:prod` clean — the full
  CI gate, run locally under `REQUIRE_BROWSER=1` for the first time since it was written.
- **FEAT-GLANCE (v3.61) — "First Glance": safe-area, and the density cut on BOTH surfaces.**
  Owner screenshot (iPhone, deployed v3.60): the wordmark rendered UNDER the Dynamic Island,
  and the first screen was word-dense for a new retail reader. Two root causes, one lesson.
  **Safe-area:** `index.html` has shipped `viewport-fit=cover` + `black-translucent` since v1 —
  the page is *deliberately* drawn behind the iOS status bar — but `env(safe-area-inset-*)`
  appeared **nowhere in the repo**, and the comment at `index.html:5` claimed safe-area handling
  that was never implemented (the label-outlives-its-data defect class again). The header now
  pads `calc(8px + env(safe-area-inset-top))`, the sticky Sections nav offsets below a fixed
  opaque **scrim** over the island strip (padding the nav instead would render a permanent
  inset-height band when it isn't stuck), and the root pads the landscape edges. `admin.html`
  had zero handling either and renders fullscreen inside the installed PWA shell: it gains
  `viewport-fit=cover`, `.wrap` top/bottom insets, a `.toast` that clears the home-indicator
  strip, and overlay padding on both edges. `env()` resolves to 0 everywhere else — Chromium
  can't simulate insets, so the proof is smoke pins + the owner's on-device check.
  **Density (dashboard):** the two largest always-expanded blocks were both v3.60 diagnostics —
  the six-card **Drivers matrix** and the 15-row **Data Health grid**. Both collapse behind the
  FEAT-321 `CollapsedGroup` (`chip={false}` — live evidence, not curated) with their `<section>`/
  h2 wrappers and summary lines outside, so nav anchors resolve and the v3.25 rule holds: the
  matrix's exclusions stay named in Signal Quality and as ⏱ chips on the band, and Data Health's
  ERROR/Retry row stays outside the collapse — an outage must not need a click to discover. The
  first-principles call: **the band's chip row IS the icon-first six-factor view**, so a second
  full-size rendering of the same six facts was duplication (the newcomer audit's point), not
  depth. The Signal Quality decode legend moved into the Data Health expander (explanation, not
  evidence); the 30Y tile note keeps its FACT (spread + INVERTED) and moves the 2007-reference
  prose to a tooltip. Owner calls, recorded: the Macro Regime grid stays visible (numbers are
  indicators, not prose), **full 5 Whys stays**, and **the WSB lingo/vibe stays wherever
  language is in play** (HODL primary, bull/bear vocabulary — personal tool, not commercial; the
  newcomer audit's relabel layer was declined).
  **Newcomer-audit structural fixes (vibe untouched):** (1) **the verdict sub can no longer name
  an excluded factor** — MIXED read "Cross-signals — watch VIX" while VIX sat two rows below
  marked stale-excluded, the hero explanation resting on evidence the model says it cannot use;
  `computeRegime` now re-derives the watch from the **nearest load-bearing flip** (`watchKey` on
  `REGIME_META`, one derivation — `flipConditions` already computes exactly that), falling back
  to "N of 6 inputs usable" when no single crossing flips it. (2) **The neutral vote is stated**
  — "2/4 bullish · 2 votes bull / 1 bear" left a vote unaccounted; now `N bull · N neutral · N
  bear — N of 6 usable`. (3) **Operator tooling off the public route** (the A4 pattern): the
  `⎘ TT` copy button and the `⚡ N FIRED/BLIND` alert badges gate on `!publicView` — BLIND reads
  as a system failure to a visitor who can't see the monitors it counts. (4) **What Changed
  names its device scope** — "baseline set — tracking starts today on this device" / "no
  material change since your previous visit on this device" — the localStorage limitation
  stated, not implied away.
  **Density (terminal, FEAT-TT-GLANCE):** post-v3.42 the remaining full-size prose concentrated
  in the SELL block. The ranking-basis sentences (repeated on EVERY row) are stated ONCE in a
  closed **`details.est-mini`** expander — "how this list is ranked" — together with the two
  unbounded "cannot rank" name lists, the options-only tail and the tax-lots disclaimer; rows
  keep chip-length basis tags (`%/yr` / `$ realisable`) so the mixed ordering still can't be
  mistaken for one key. The **unranked COUNT rides the closed summary** (silent truncation reads
  as full coverage) and the **session-vs-computed disagreement stays visible** as a chip-length
  line (`⚖ session: X first · computed: Y`) — it is signal, married-never-merged; the doctrine
  prose lives inside. est-mini, deliberately NEVER `drawer` — the phone harness counts open
  drawers (the est-run precedent). Red facts untouched: ⛔ TRIM rows, the cap-contradiction
  warning, do-not-trim flags. The BUY block's sentences are decision-critical vetoes and did not
  move. The board h2 became chip-length (`THE BOOK`); the coaching line moved to the HOW THIS
  BOARD WORKS aside.
  Tests: **967 smoke** (+19 over v3.60.1: safe-area literals on all three surfaces, the collapse structure,
  the excluded-aware sub RUN behaviorally through the real regime.js import on three fixtures,
  the neutral-vote line, the public gates, the est-mini/never-drawer pin) + **173 render** (+4:
  closed-SELL chip tags with the sentences absent, the visible unranked count, the disagreement
  chip, expander-class proof — then everything verbatim one tap deep) + **74 public-render**
  (+7: collapsed-by-default proofs for matrix and Data Health with red facts visible while
  closed, the legend's new home, the device-scope copy on both visits, and the TT/BLIND gate on
  the route pair).
- **FEAT-NEUTRAL + FEAT-WHY (v3.62) — the newcomer audit: a neutral factor was rendering as
  BEARISH, and the verdict was defensible but not legible.** A UX audit found the HODL call
  correct and the interface making the reader reconstruct it. Its central code claim was real,
  and worse than stated. **`regimeFactors()` predated `REGIME_BAND_TABLE` and was never
  migrated**, so every row carried a hand-written boolean `bull` that duplicated the table's
  BULL edge (`<-0.10`, `<18`, `>55`, `<=NFCI_LOOSE`) and **carried no BEAR edge at all** — the
  exact second-copy-of-a-threshold defect `regime.js`'s own header comment warns against.
  `RegimeBand`'s only input was those rows, so its chip branched `f.bull ? green ▲ : red ▼`
  with **red as the fallthrough**: F&G at 42 (a genuine `neutral`) rendered identically to CAPE
  at 40.91 (a genuine `bear`). Two things made it worse than cosmetic — **the component
  contradicted itself** (v3.61 had just changed the line directly above to print
  `N bull · N neutral · N bear`, so the hero *stated* "1 neutral" while painting it red), and
  **the same factor rendered correctly 500px lower** in the C3 Drivers matrix, which already
  read the true 4-state `evidenceSet.factors[].vote`. One page, two answers. A non-finite
  reading votes neutral by construction, so a `NaN` was rendering as a confident bearish chip.
  **Nothing tested it**: `regimeFactors` was imported into smoke as `regimeFactorRows` and
  never called — the v3.54 lesson ("the defect that passed every existing test") again.
  **Fixed at the root, not the render**: `regimeFactors()` now derives `vote` from
  `REGIME_BAND_TABLE` itself, `evidence.js` consumes that vote instead of re-deriving it (one
  call site for a threshold, not two), and a shared **`voteStyle()`** map is the ONE
  vote→appearance expression — the hero chips, the hero drawer and the Drivers matrix all
  resolve through it, so the two altitudes cannot drift apart again (the `ptModelRows`
  doctrine). `f.bull` is gone. EXCLUDED still wins over the band vote: a factor the model
  refuses to count must never also report a lean.
  **FEAT-WHY — the conclusion in words.** `postureSummary()` (pure, in `evidence.js`) renders
  *"Inflation and financial conditions support risk; valuation adds risk; sentiment is
  neutral; VIX and the 10-year yield are unavailable."* plus SUPPORTS / NEUTRAL / ADDS RISK /
  UNAVAILABLE buckets, under the existing hero. It is a **projection of the same factor rows**,
  so it cannot contradict the chips or the tally, and each factor's noun phrase (`plain`) lives
  on its band beside the rule it describes — no parallel copy-table to rot. Withheld postures
  render nothing (there is no "why" for a call that was not made). EXCLUDED is reported as
  UNAVAILABLE, never folded into NEUTRAL — "not counted" and "counted, no lean" are different
  facts, which is the whole lesson of this release.
  **Also:** the flip line states its assumption (*"if other signals stay put"* — `flipConditions`
  simulates exactly ONE crossing, so without it the line read as a forecast) · the SPY-derived
  mood badge and the six-factor hero **emit the same three words** from the shared
  `WEN_MOON_STATES` via unrelated inputs and could disagree on one screen, so the badge now
  names its scope (`TAPE`) — vibe untouched, ambiguity removed · strip items carry a **▪ marker
  when they actually vote**, derived from `FACTOR_FIELD`'s values rather than
  `REGIME_FACTOR_FIELDS` (which holds only the five whose field key equals their factor key —
  CAPE rides a separate alias, so the obvious array would have silently un-marked it) · a
  per-section "context only" label was rejected as FALSE, since the macro strip carries both
  kinds · the Drivers eyebrow reads **"Used in today's posture"** · the Sections nav gains an
  active state + `aria-current` (the six `h2`s are visually-hidden, so a jump landed with no
  orientation cue) · operator actions (TT readout, TERMINAL) consolidate behind a **⋯ OPS**
  disclosure while the **FIRED/BLIND badges stay outside it** (v3.25: a collapse never hides a
  red fact) · and a **type scale** (`fs-xs`…`fs-xl`) lands in `DT` with a targeted lift of the
  load-bearing text — provenance, factor chips, the verdict sub-line — which the audit measured
  at 7–9px, the honesty layer rendered at a size a phone reader has to work to read.
  **Owner calls, recorded (the audit's relabel layer stays DECLINED, as in v3.61):** HODL stays
  primary, DIAMOND HANDS stays, the fresh/cached/stale vocabulary stays, the full 5 Whys stays
  expanded, and the default route stays the operator view.
  Tests: **978 smoke** (+11, incl. `regimeFactors` executed for the first time — neutral zones,
  the NaN case, excluded-beats-vote, and that both altitudes resolve through the one map;
  negative-controlled by re-collapsing neutral into bear and by reverting the chip render) +
  **173 render** + **82 public-render** (+9: a neutral-fixture driven live asserting the F&G
  chip carries `•` and NOT `▼`, that a real bear still shows `▼`, that the printed tally and
  the count of neutral chips are the SAME number — derived on both sides, never hardcoded —
  and that the OPS menu actually opens to reveal TERMINAL rather than merely existing in DOM).
- **FEAT-TT-DECK (v3.62) — the terminal becomes a two-answer mobile decision surface.**
  `NEXT $ IN` and `FUND / TRIM` are labelled, keyboard-reachable tab panels on phones with
  horizontal scroll snap as an optional swipe shortcut; desktop keeps the stacked layout. Each
  phone panel owns one real 390×844 focus viewport and scrolls its own overflow, so the hidden
  funding list cannot lengthen the page. This deliberately does **not** call the second view
  “HOLD”: the engine computes funding/trim priority, not a hold recommendation, and changing
  the label would overstate the logic. Forced cap trims remain visible; the first five
  discretionary funding sources render by default and the ranked tail is counted in a closed
  expander. The existing rankings export was complete but effectively undiscoverable under
  `MENU → MANAGE`; `⇧ SHARE RANKS` is now a first-row action and preserves its iOS File/share,
  clipboard and download fallbacks. Its Markdown artifact still carries stance, master and
  category rankings, funding priority, unranked names, methodology, provenance and caveats.
  The render harness now actually opens its claimed **390×844** phone viewport (it previously
  used 390×2200, making any `svh` assertion false by construction). Combined v3.62 head:
  **985 smoke** (+7 from this feature) + **178 render** (+5 net from this feature, including
  the real swipe path, visible export action, panel height, capped funding queue, two-screen
  budget and zero mobile overflow).
- **v3.70 — the caps raised for the composite's new evidence fields (owner call: "+30KB per
  name").** The 2026-08-04 composite widening (weights → V30/G25/P20/M10/R15; P3 → Profitability
  & Balance Sheet; per-name `balance_sheet`/`sotp`/`moat` evidence records; half-point pillar
  granularity — all of it KV/framework content, none of it repo code) left the LIVE book 2.6KB
  from the 200KB `MAX_BODY` wall the same day it shipped, and the SOTP sweep that followed had
  to be trimmed mid-write to fit. `DD_MAX` 15KB → **45KB** and `MAX_BODY` 200KB → **300KB**
  (both owner-set — the number moved 300→500→300 over the course of the same day before
  settling; server + the admin.html pre-flight mirror in sync as always, and `positions.js`
  deliberately stays 64KB — its comment now names the raised book cap so the documented
  contrast survives). Both remain arbitrary app-level runaway-write stops, not KV limits (KV
  values go to 25MB). **The BOOK cap still binds first and by a wide margin** — 38 entries at
  45KB would be ~1.7MB, ~5.8x the book cap — so the per-name raise is headroom for a handful of
  rich names, NOT for all of them, and the deepDive KV split remains the real fix, still
  deferred *(CLOSED in v3.75, FEAT-TT-DDSTORE)*. Smoke pins moved with the values (the payload-cap pin, the binds-first arithmetic
  pin, the cap-mirror pin, the positions-contrast pin).
- **v3.69 "NARRATIVE FIRST" — the public dashboard reorder, and the session the browser suites
  finally ran.** Owner verdict on live screenshots: the macro board was "very overwhelming and
  wordy" with the 5 Whys — the page's narrative — rendering LAST in Zone B, ~5 phone screens down.
  Root cause was structural: the FEAT-161 60/40 command-center grid stacked Zone A (chart + 4 tile
  rows) entirely before Zone B on mobile, so the words always lost the race to the numbers.
  Owner-chosen scope: reorder + condense, one page, six anchors. **(1) The 5 Whys moved to the
  overview region directly under the hero** (verdict → posture sentence → the whys), content and
  data flow byte-identical — and it must never collapse: the LOADING/ERROR anchors ("0/3 core
  inputs usable") are read from body text by the public suite. **(2) The macro strip IS the market
  summary** — always visible with its provenance dots and voting markers — and the chart + 10
  tiles behind it moved into ONE `CollapsedGroup` ("full market detail — chart & tiles"); the
  Session Δ bar stays outside (conditional signal, v3.25). **(3) The 60/40 grid is GONE** — every
  region is now a sequential full-width stack, so DOM order IS reading order at every width.
  **(4) markets/macro/ai became real `<section>` extents** (the drivers/health pattern; bare h2s
  meant the ai anchor silently swallowed Conviction+Alerts, which now sit in their own labeled
  section). **(5)** Dead never-rendered components deleted (`LaunchCostCard`/`EvtolCertCard`,
  ~75 lines); the stale command-grid media rule went with them.
  **The verification milestone:** `npm install` had never been run in this environment, so every
  browser-suite "run" since v3.62 was a clean SKIP. Installing deps let all three suites actually
  execute — and they caught THREE stale pins from those browser-unverified releases (the v3.66
  methodology text moved into an est-mini that innerText cannot read closed; the v3.67 deck-height
  budget replacing the old >500px floor) plus a case bug in this release's own new pin (Chromium
  innerText APPLIES text-transform:uppercase, so /full market detail/ needed /i). Each re-pinned
  on the CURRENT contract with the reason documented.
  Tests: **1016 smoke + 184 render + 86 public-render — all three suites green in a real browser.**
- **v3.68 — the PT horizon is stated where the %/yr is read.** The horizon governs every rate on
  both deck panels, but its picker lived two taps deep in DESK — the owner had to be told where
  "auto" was. **`hzDeckChip()`** (one builder, three call sites: the BUY label and both FUNDING
  PRIORITY branches) states the year in force and whether it is **auto or pinned** at the altitude
  the numbers are read, and deep-links to the existing full picker (`openDesk('dNext')`). One
  builder so the two decks can never disagree about the year their %/yr shares.
- **v3.67 — the deck height becomes a budget, not a floor.** The v3.62 deck gave each phone
  panel a fixed `max(520px, 100svh−220px)` viewport so the hidden FUND/TRIM panel could never
  lengthen the page — correct doctrine, wrong implementation detail: the SAME fixed height held
  a ~620px frame open under a ~300px BUY list, renting a blank half-screen on the primary view
  (owner screenshot). **`sizeDecisionDeck()`** now measures the ACTIVE panel's content
  (`lastElementChild.offsetTop+offsetHeight`, page made `position:relative`) and sets the deck
  to `min(need, budget)` — the hidden panel still cannot lengthen the page because it is never
  measured, and a panel taller than the budget still scrolls its own overflow exactly as
  before. Re-measures on every tab switch (hooked at the end of `setDecisionTab`, which swipe
  sync and the resize listener already route through) and on async content landing (debounced
  MutationObserver on the deck subtree — quotes, positions and regime each re-fire their
  renderer). The CSS fixed height **survives as the no-JS fallback**, so a script failure
  degrades to v3.62 behaviour, never a broken layout; desktop (>700px) clears the inline
  override. The 700px-breakpoint smoke pin moved 5→6 homes — `sizeDecisionDeck` must mirror
  the deck media query or the override would apply to the stacked desktop layout. NOT verified
  in a live browser (no Chromium in this environment): the render harness pins panel height
  and the two-screen budget, and this change only ever makes the deck SHORTER, but the
  measured heights themselves await the next harness run.
- **v3.66 "QUIET BOARD" — free text is chip-length in place, verbatim one tap deep.** Owner
  verdict on five live screenshots: *"ridiculous — all text that isn't directly highest leverage
  needs to be hidden under an expander."* The audit agreed: six render sites were inlining
  UNBOUNDED free-text fields at full size on decision surfaces. The first-principles rule this
  release applies everywhere: **a decision surface shows the decision; free text is chip-length in
  place and verbatim one tap deep; machine-known reds are never collapsed** (v3.25). The six:
  **(1)** the DESK stance box bolded the whole parenthetical (which embeds the 40+-word asserted
  regime) — split at render into head + `details.est-mini` "why"; `stance()` itself is untouched,
  its prose is pinned. **(2)** the engines-disagree line inlined the full asserted string — now
  truncated at 40ch on the line (the v3.42 chip-truncation precedent) with the verbatim assert +
  provenance in an est-mini; the DECISION (which engine governs) stays fully visible. **(3)** queue
  pick chips rendered the whole rank tail (`rankScope` strips only the "#N") — 32ch cap; runState
  red flags NOT truncated. **(4)** est-run board summaries carried the full `rank` string — the
  v3.64 defect at the board altitude; tier stays, rank prose moved into the body above the table.
  **(5)** the computed-upside footer was one ~90-word paragraph — split: visible = ranked count,
  the v3.65 dropped-names warning, price basis; one tap deep = methodology, definitions, weights
  note, and the per-name `pt_model.note` caveat walls (count on the summary). **(6)** WHAT CHANGED
  rendered all items expanded — sev=stop rows stay visible, the rest group behind a counted
  est-mini. All est-mini, never `drawer` (the phone harness counts open drawers). Five stale
  string-pins re-pinned on behaviour; +5 new pins. **Known, deliberately untouched:** the large
  blank region below the BUY deck panel (screenshot 4) is the v3.62 fixed-height deck viewport —
  diagnosing it needs the live render harness (no Chromium in this environment), and blind CSS
  changes to a snap-scroll container the render suite pins would be the riskier edit.
- **v3.65 — a pinned horizon must NAME what it drops.** Owner screenshot: the board ranked 6 of 36
  with the horizon pinned at 2030, and TSM (model ends YE2028) and NVDA (YE2029) were **absent from
  the next-dollar list entirely** — the two names just re-run that day. The exclusion WAS disclosed,
  but only as a bare count (*"2 of them dropped for having no 2030 rung"*), which reads as a rounding
  note. Stated as **"TSM, NVDA"** it is the moment you notice your freshest work has vanished from the
  queue. This is the **v3.36 coverage-gap precedent applied to the other exclusion path**: that fix
  named the no-`pt_model` names while the no-rung-at-this-year names stayed a count. The line now names
  them and, when the horizon is pinned rather than auto, points at `auto` as the fix — suppressed when
  already auto, since telling someone to pick the option they have picked is noise.
  Note the horizon itself is **device-local** (`localStorage` `tt:hz`), not book state, so it cannot be
  set server-side — which is precisely why the disclosure has to carry its own remedy.
  Also re-pinned the v3.39 smoke assert that string-matched the literal `cands.length-rows.length`
  expression: naming the dropped names is a strict improvement and failed it, so the pin now measures
  the BEHAVIOUR (count still derived from the candidate/row gap, drop still disclosed) rather than one
  spelling of the arithmetic.
- **v3.64 — the ESTIMATE RUN label stops being a wall.** Owner screenshot, TSM tab: seven lines of
  uppercase prose sat ABOVE the table they labelled, so the reader met the footnote before the number.
  Cause: the `.lbl` glued `TIER` + the **whole** `rank` string + the **whole** `consensus.source`
  string onto one line — fine when both are short, a wall on a name carrying real prose in each (TSM's
  rank is a 40-word trigger note; its estimate source a 45-word provenance note). **Only the TIER
  stays** — it is the point of the line, the estimate run being the math under the tier claim — and
  both notes move one tap down into a `details.est-mini`. **est-mini, never `drawer`**: the phone
  harness counts open drawers (the FEAT-TT-ESTRUN precedent). On the v3.25 red-stays-visible rule:
  `rank` and `source` are FREE TEXT and are not a machine-known red channel — the reds the system
  actually knows (red hinges, readiness blockers, cap breaches) all render OUTSIDE this collapse, with
  the readiness bar and WHAT CHANGES MY MIND sitting directly above it, so closing it hides no red.
  Also trimmed the `key_dates.event` strings on TSM/NVDA: the WHEN cell renders them VERBATIM and in
  full, so an event string has to be a decision line, not a footnote — CONFIRMED-vs-forecast, the
  guided bar and the no-new-adds window date kept; context moved to a sibling note field.
- **v3.63 — `DD_MAX` 8KB -> 15KB.** The per-payload cap was rejecting COMPLETE theses, not runaway
  ones: a fully-populated payload (consensus to FY2035 + `pt_model` + five-pillar composite + gates +
  hinges + `key_dates` + `capital` + `open_items`) lands at 8-12KB. Measured while filling NVDA's
  payload — it came in at 8,175 bytes and had to be trimmed four times to fit, losing evidence prose
  each round; meanwhile NBIS (8,978) and BETA (12,329) **already exceeded the cap** and only survived
  because `validateDeepDive` runs on the editor path, not on load. A cap that the two richest existing
  payloads violate is not enforcing anything. Client-side only (`admin.html`) — no server mirror; the
  smoke pin moved with it. **The comment was also stale**: it claimed "keeps the whole book far under
  the 64KB PUT limit" when v3.34 raised `MAX_BODY` to 200KB, the same label-outliving-its-data defect
  this changelog keeps fixing. It now states the real constraint — **the BOOK cap binds first**, since
  36 entries at 15KB is 540KB against a 200KB body, so this buys headroom for a few rich names and not
  for all of them. Splitting `deepDive` into its own KV document (the pattern `pos` and the ledger both
  proved) remains the actual fix and stays deliberately deferred *(CLOSED in v3.75, FEAT-TT-DDSTORE)*.
- **ENGINE0-CONT (v3.71) — source continuity: Engine 0 stops confusing "I cannot see" with
  "nothing is there".** *Relabelled from v3.63 at merge (2026-08-04): this shipped in parallel on a
  separate branch and independently claimed v3.63, colliding with the DD_MAX entry immediately
  above (also genuinely v3.63, three commits earlier in that session). `package.json`'s version is
  the single source of truth and now reads 3.70.0 from the TT-terminal line of work, so this entry
  takes the next true sequence number rather than either branch's guess. Content below is verbatim
  from the original commit — only the heading number changed.* The reproduction case was a live
  2026-08-03 body: SPY and F&G current,
  VIX missing, RS missing, 10Y a session behind, Kalshi dead — two usable checks, so the readout
  published `INSUFFICIENT` and every downstream surface treated the whole day as a dead end. But
  a 10Y print from last Thursday is not *nothing*; it is the last official observation, and the
  system had **exactly two states** for it (fresh, or gone) where the honest answer needs three.
  Five pieces, all on the existing rails:
  **(1) EVIDENCE TIERS.** Every Engine 0 input now resolves to an EvidencePoint before it reaches
  a band — `CURRENT` · `CACHED` (same observation from the day's KV, full vote, never relabelled
  "live") · `HISTORICAL` (stale but inside a named carry window) · `MISSING`. `PROXY` exists in
  the vocabulary and **nothing emits it**: a substitute must never pass through the original
  metric's bands, so shipping the word without the behavior is deliberate.
  **The carry is CONSERVATIVE and asymmetric**, the same doctrine as the v3.40 TAILWIND withhold:
  a historical vote passes the SAME band, then stale **bullish → neutral** (stale bullishness is
  not evidence of safety) while stale **bearish survives, flagged** — with the observation date
  and the session count carried in the reason string, never as a bare number. Windows are in
  COMPLETED MARKET SESSIONS, and the counter is `sessionsBehind()` **extracted out of `isStale`**
  so the carry policy and the staleness gate can never disagree about what a session is (§P.4 —
  a second copy of that weekend/holiday walk is precisely the drift this repo keeps paying for).
  VIX gets the shortest window (2) because the crash gauge decays fastest; 10Y the longest (5)
  because a monthly delta tolerates a publisher lag. Fed odds carry 5 **and only while the
  referenced FOMC event is still open** — odds from a decided meeting must never roll into the
  next one.
  **(2) THE TWO-AXIS CONTRACT.** A verdict was being asked to answer two different questions —
  *which way* and *may I act* — and `INSUFFICIENT` was the tell: it is not a direction at all, it
  is a statement about the evidence, wedged into the direction field. `confidence` (HIGH/MEDIUM/
  LOW), `actionability` (FULL/RESTRICTED/HOLD) and `status` (OK/PARTIAL DATA/DATA DEGRADED) now
  carry the evidence axis, and a <3-usable day publishes the deterministic wait posture
  `NEUTRAL · LOW · HOLD · DATA DEGRADED` — **a claim about the system's evidence, never a claim
  the tape is neutral.** `raw_verdict` keeps what the counts alone said, so the change is never
  silent. **PANIC now requires both gauges CURRENT**: a carried print may keep a bearish caution
  but must never fire — or clear — the most safety-critical override. The Macro Flip circuit is
  the same rule: it evaluates only CURRENT/CACHED inputs, and a carried VIX narrates
  `ARMED_FROM_LAST_CLOSE` / `UNCONFIRMED_FROM_LAST_CLOSE` — pointedly **not** "not armed",
  because absence of confirmation is not a clear.
  **(3) CONTINUITY AT THE SOURCE.** Per-FIELD last-good (`pulse:source:lastgood:*`, 30d) so one
  failed FRED batch stops erasing unrelated history; records keep their REAL observation dates,
  so a served fallback classifies HISTORICAL downstream and is never dressed as fresh. A
  **same-date-paired NASDAQ100/SP500** RS check replaces the order-gating dependency on Finnhub's
  QQQ quote — both legs' latest AND prior dates must match or **no RS is emitted**, because a
  cross-day delta dressed as a 1-day read is a fabricated number. An official **UST par-yield
  fallback** for the 10Y (the upstream FRED's DGS10 republishes, so the level is equivalent by
  construction; only the attribution changes) fires only when the DGS10 leg failed. A **Kalshi
  transport ladder** tries `external-api.kalshi.com` then the deployed-working elections base —
  **the base that served is recorded in `_diag.sources`, never implied**, because the doc claim
  could not be network-verified from this build environment. And the FRED pull now runs its two
  criticals (VIX, DGS10) FIRST at concurrency 2, so a slow or rate-limited FRED degrades the
  dashboard-only tail rather than the order-gating head.
  **(4) THE PUBLISH GATE.** `publishIfNoWorse()` — a candidate is compared against the stored
  snapshot on a lexicographic quality tuple built FROM the readout (one computation, the same
  counts the readout renders) and **refused if it is worse**, so a partial rebuild can never
  overwrite a good morning warm. The asOf tiebreak means an equal-quality newer candidate wins
  but is explicitly **not** called an improvement. This retires the cron's old
  delete-then-sleep-then-refetch, which was destroy-and-hope against an eventually-consistent
  store: `POST /api/snapshot/refresh` (auth: the terminal's PIN session, or `x-refresh-token`
  for the cron — no secret configured means no token path for anyone) builds without deleting
  anything and **returns the complete readout in the response body**, so no caller ever rereads
  KV hoping the write is globally visible yet. TTL now rides confidence (48h HIGH · 15min MEDIUM ·
  5min LOW), deliberately NOT actionability — a tripped circuit on perfect data is HOLD but
  perfect evidence, and a 5-minute TTL there would hammer FRED all day during exactly the tape
  that makes rate limits matter.
  **(5) THE HUMAN SURFACES.** The paste block gains an `EVIDENCE` line (never a bare verdict
  again); the terminal's pill renders `HOLD`/`RESTRICTED`/`DATA DEGRADED` and can never colour
  green on a non-FULL actionability; `⟳ RANKS` became `⟳ DATA+RANKS` and now actually rebuilds
  (the old button only re-GET the same per-day KV value — a pseudo-refresh), with an honest
  failure ladder: 429 says cooling down, an older deploy degrades to the read-only reload,
  stated rather than silent. On the public dashboard the withheld posture renders **`DATA HOLD`**
  through one shared `WITHHELD_LABEL` — the engine keeps its internal `INSUFFICIENT` sentinel
  (`regime.js` is untouched; presentation only), because the word reads to a non-operator as a
  system dead end rather than the wait state it is.
  **What was deliberately NOT changed.** No band moved. `computeRegime` and `REGIME_BAND_TABLE`
  are untouched — the dashboard's six-factor backdrop is a different engine from the six tt-v1
  order-gating checks, and this ticket had no mandate over the public vote. The carry windows are
  **data-availability policy, not economic thresholds**, and they are asserted rather than
  calibrated (FRED is unreachable from this build environment) — which is why every boundary is
  smoke-tested at the exact session and one beyond, with literal dates rather than dates computed
  from `CARRY_SESSIONS`, so a policy edit goes red until someone reviews it.
  **Honest limits, and one of them is load-bearing.** The H5 audit of this diff found that
  collapsing `INSUFFICIENT` into `NEUTRAL` **removed a veto** it did not replace: the terminal's
  `governingRegime()` reads only `regime.verdict`, and `REG_RANK` has no `INSUFFICIENT` key, so
  the old value fell through to an unranked read → `STANCE UNKNOWN` → the FIX-B (v3.49) hard-WAIT.
  `NEUTRAL` **is** ranked, so a two-check day can now reach `ADDS OK` and, when the flip happens
  to be evaluable, light `ELIGIBLE NEXT DOLLAR — all gates passed` — while the same payload says
  `HOLD · LOW · DATA DEGRADED` on the pill directly above it. The evidence axis is published and
  rendered; **the gate simply does not read it yet**. That is a one-field fix (`actionability !==
  "FULL"` in the `gateFail` ladder) and it is filed as the next ticket rather than bundled here,
  because a change to the order-gating eligibility rule deserves its own plan and its own
  approval (§P.8) — but it is named here, at full weight, because a limit discovered and left
  unstated is the defect this file exists to prevent. Two smaller ones from the same audit, also
  filed not bundled: the ARM threshold `22` now has a second executable home in the carried-VIX
  narration, and `fetchEquities` records its group status `ok:true` one line before it throws on
  zero quotes *(the fetchEquities one CLOSED in v3.99.3 — see that entry)*.
  Tests: **1037 smoke** + **191 render** + **84 public-render**, plus five negative controls run
  for this entry — disabling `conservativeVote`, `degradedFallback`, the publish gate and the RS
  date-pairing each turns the suite red, and moving VIX's carry window from 2 to 3 sessions turns
  exactly one boundary red. The sixth found a **vacuous assert**: *"matrix B: all-historical
  bullish inputs → never TAILWIND"* stays GREEN with `conservativeVote` fully disabled, because
  the v3.40 blind-gauge downgrade suppresses TAILWIND independently whenever VIX is not CURRENT —
  which that fixture guarantees. The transform IS covered (two other assertions go red), but the
  pin that reads as matrix-B coverage proves a pre-existing rule. Filed for H3 rather than
  quietly rewritten under the audit.
- **Harness reconciliation (same release).** `npm run gates` now exists — all four suites in
  order, failing on the first red. It is not a convenience: a hand-chained
  `npm test | grep FAIL && git commit` exits 0 when grep *finds* the failure, which is how a red
  commit once got through. README, AGENTS.md and the Commands block above all point at the runner
  rather than restating the four commands as a sequence someone has to chain correctly.
  **`package.json`/`admin.html` were never actually bumped to v3.71** when this entry's heading
  claimed the number at merge time — the same label-outliving-its-data defect this changelog
  keeps fixing elsewhere, caught while closing the gap immediately below. Completed here rather
  than skipped, so no version number in this file is ever a phantom.
- **v3.71.0 follow-up (same day) — the deferred ENGINE0-CONT limit, closed.** ENGINE0-CONT's own
  "honest limits" section named this exactly and filed it as the next ticket rather than bundling
  it: `readout.json` publishes a two-axis contract (`verdict` = which way, `actionability` = may
  this gate capital), and the terminal's pill renders both correctly — but `admin.html`'s
  `gateFail` ladder (the veto chain guarding **ELIGIBLE NEXT DOLLAR**) read only
  `governingRegime()`, which reads only `regime.verdict`. `INSUFFICIENT` collapsing into
  `NEUTRAL` removed a veto `REG_RANK` never replaced: `NEUTRAL` **is** ranked, so a <3-usable or
  degraded day (`NEUTRAL · LOW · HOLD · DATA DEGRADED`) could rank ADDS OK and light the green
  line while the pill one row above it read HOLD. A new rung — `reg.actionability &&
  reg.actionability!=="FULL"` — vetoes before the Macro Flip checks, naming the actionability
  state and `status` in the WAIT reason; a `FULL`/absent actionability (legacy or cached tt-v1
  bodies) is unchanged, and the existing veto order (stance → feed → flip) is untouched. Smoke
  slices the live ternary text out of `admin.html` and RUNS it against fixture regime payloads
  (FULL+clear, HOLD+DEGRADED, RESTRICTED, absent, tripped-at-FULL, unreadable-feed) rather than
  string-pinning it — the project's own recurring lesson (v3.40, v3.54: state computed and
  rendered but not read at the gate) is exactly the shape a string pin cannot catch.
  Tests: **1067 smoke** (+6) + 192 render + 88 public-render.
- **FEAT-TOKVOL (v3.89.0) — token VOLUME: the Q beside the P, and the demand read that was
  mislabelled for two years.** *Relabelled from v3.85.0 at merge (2026-08-15): the parallel
  terminal line on `main` claimed v3.83–v3.87 (TECHREAD/MAG7/SOURCING/DOTHOME/CAPEX-OCF) —
  the documented collision pattern; this entry takes the next true sequence number, content
  otherwise as committed (test counts are the branch's pre-merge totals; the smoke sections
  renumbered [58]→[60] at merge).* The $/Mtok trend has been called "the demand side" since v3.0 —
  but price alone is ambiguous: falling $/Mtok is bullish commoditization ONLY if volume rises
  faster than price falls (revenue ∝ P×Q). **`fetchTokenVolume`** pulls OpenRouter's datasets
  API (`datasets/rankings/daily` — the daily token totals behind its public rankings, top-50
  models + the aggregated "other" row). Unlike `/models` it is **KEYED**, so the fetch is
  **KEY-GATED like Finnhub** (`env.OPENROUTER_KEY`; without it → throw → last-good → mock,
  the invariant holds — **set the secret to go live**: any free OpenRouter key, one call/day
  against a 500/day limit). Fail-closed parser (two documented shapes accepted, anything else
  throws; several days in a response are never summed into one "day" — only the latest date
  counts); KV accrual copies `pulse:tokentrend` verbatim under **`pulse:tokenvoltrend`**
  (per-ET-day dedup, cap 12, faults swallowed); the Phase-3 destructure and its
  critical-scope `skipped()` arm moved together. **`tokenDemand(trendPx, trendVol)`**
  (`src/aiEcon.js`, pure, smoke-RUN) composes the two legs in **WINDOW terms, never
  annualised** (the v3.46 rule) over the SAME newest-aligned span — the shorter series bounds
  the window, since composing two spans is the units error in time instead of rate — and
  withholds below `minWeeks`. The card renders TOKENS/DAY with its **own SourceBox**
  (a volume figure under the price feed's badge would be borrowed provenance) and the P×Q
  line **suppressed when EITHER leg is illustrative**; the mock volume trend is deliberately
  below `minWeeks`, so the demo cannot fake a demand verdict. The **wording fix** travels
  with the feature (the label-outlives-data class): the price leg is no longer called "the
  demand side" in snapshot.js, the card, the mock comment, or this file — P is the price
  leg, P×Q is the demand read, and smoke pins the old phrase's absence. **Honest limit:**
  the datasets response shape could not be verified from this environment (no key yet) —
  the parser fails closed and `withLastGood` degrades honestly on any drift, but the first
  keyed call is the real schema check. `tokenVolDay` stays OUT of `SIGNAL_FIELDS`
  (key-gated, the qqqPrice precedent) and votes nowhere.
  Tests: **1397 smoke** (+13: the key gate, the accrual copy, the fail-closed parser pins,
  `tokenDemand` executed — the −25%×+40%→+5.0% window composition, the shorter-series bound,
  the withheld short read — partition 72, the both-legs illustrative suppression, the
  wording sweep) + 228 render + 114 public-render + `audit:prod` clean.
- **v3.88.0 "the recession rails" — CCC junk tail · Sahm rule · 10y–3m, all NON-VOTING on
  arrival.** *Relabelled from v3.84.0 at merge (2026-08-15), same collision note as the
  FEAT-TOKVOL entry above; smoke section renumbered [57]→[59].* Three live FRED signals from the 2026-08-15 gap analysis, all passing the v3.43
  moat test (Yahoo shows the level; it does not judge it, abstain when stale, or pair it with
  the transmission story), all arriving under the NFCI/30Y rule: no `REGIME_BAND_TABLE`,
  `evidence.js` or `ttReadout.js` change — a new voter moves the majority math for a contract
  that gates real orders, and two of these carry asserted bands (smoke-pinned absent from all
  three files). **(1) `creditTail` (`BAMLH0A3HYC`, ICE BofA CCC & Lower OAS)** — the junk
  TAIL: AI-infra debt (the CRWV-class neocloud complex) is rated single-B/CCC and the tail
  widens FIRST while broad HY looks calm — the funding-pipe stress gauge for exactly the
  buildout this book is long. Own tile beside HY–IG (NOT a sub-line — it needs its own
  provenance, its own `demoted()` key, its own illustrative gate; borrowed provenance is the
  label-outlives-data class). CALM/NEUTRAL/STRESSED off `CREDIT_TAIL_CALM=7`/
  `CREDIT_TAIL_STRESS=12` in `regime.js` (one Node-importable home; **ASSERTED, not
  calibrated** — FRED unreachable from this build env, the NFCI precedent, every boundary
  executed in smoke), verdict suppressed on mock/stale. **(2) `sahm`** — computed from the
  SAME UNRATE pull inside the fetch closure (only 10 of 26 points escape it via `spark`, the
  rule needs 15 — the tuple gained an 8th `extra` slot), math in new pure **`src/sahm.js`**
  (`SAHM_TRIGGER=0.5` is Sahm's own printed definition, a CITATION not a fit; `sahmFrom`
  fails closed below 15 points — cannot-compute must never read as 0.00 = maximally clear).
  Cell in the labor row, `>=` comparison ("0.50 or more"), TRIGGERED/CLEAR-with-distance
  suppressed on mock/stale; can differ ±0.01 from FRED's SAHMREALTIME (rounding/vintage —
  stated, not hidden). **(3) `spread10y3m`** — DGS3MO joins the series map (19 series = one
  extra 2-wide tail batch; the VIX/DGS10 critical head untouched) and the classic recession
  lead derives from LEGS, not FRED's precomputed T10Y3M, so a stale leg BLINDS the spread
  instead of a precomputed number wearing a fresh date. Stated as a fact on the 10Y tile
  (`10y–3m +0.37pp` / `— INVERTED`); no "inverted N months" memory (asserted, not measured).
  Two alerts (CCC >12pp · 10y–3m inverts), both OFF by default, the 10y–3m on the two-leg
  blind rule. Mock values all abstain by construction (tail 9.4 neutral · sahm 0.13 CLEAR ·
  spread +0.37 positive-normal). Found by the suite: five labor cells no longer fit one
  320px row — the row wraps now (an overflowing row is a suite red since v3.54).
  Tests: **1384 smoke** (+21: bands executed both ways incl. inversion, `sahmFrom` run at
  flat/shock/14-point boundaries, the trigger at 0.49/0.50, CCC boundaries at −ε/edge/+ε,
  the two-leg alert blind naming its dead leg, merge end-to-end with own-date inheritance,
  the non-voting absence sweep, the mock-abstain proof) + 228 render + **114 public-render**
  (+3: the CCC tile's judged state driven live, the 10y–3m fact line, the Sahm CLEAR badge
  with distance) + `audit:prod` clean.
- **FEAT-CAPEX-OCF (v3.83.0) — funding quality: the capex tape learns whether the buildout is
  self-funded.** The tape's `dir` tripwire fires on the ANNOUNCEMENT (a guide cut) — a lagging
- **FEAT-CAPEX-OCF (v3.87.0) — funding quality: the capex tape learns whether the buildout is
  self-funded.** *Relabelled from v3.83.0 at merge (2026-08-15): FEAT-TT-SOURCING and
  FEAT-TT-DOTHOME shipped in parallel on `main` and claimed v3.85/v3.86 — the same collision
  ENGINE0-CONT, FEAT-TT-SCORE and FEAT-TT-PROVISIONAL each documented; this entry takes the
  next true sequence number, content otherwise as committed (test counts are the branch's
  pre-merge totals).* The tape's `dir` tripwire fires on the ANNOUNCEMENT (a guide cut) — a lagging  event. The leading question, from the 2026-08-15 buildout-vs-maintenance analysis, is whether
  the spenders can keep paying from operations: **guide > trailing-4Q OCF means the gap is
  debt, and debt-funded capex is what gets cut at the first ROI disappointment** (Amazon
  already guides FCF-negative). Optional per-row **`ocf_B`** on `board.capex`
  (`validateBoard` band **(0, 500]** — the field exists solely to feed capex/OCF, which is
  meaningless at OCF ≤ 0, so a genuinely negative-OCF spender is represented honestly by
  OMISSION; upper 500 stops a decimal shift, largest real ~$175B). `capexState()` derives
  per-row ratios and **`debtFunded`: > 1.0 (STRICT — exactly self-funded does not count) on
  ≥2 MEASURED spenders**; an unmeasured row never counts toward the tell and is NAMED (the
  RANKFAIR rule). Surfaces: amber ⚠ DEBT-FUNDED BUILDOUT banner + per-row `capex/OCF N.NN`
  chips in the tape panel, an amber `⚠ debt-funded N/M` chip on the CLOSED drawer summary
  (v3.25), and the curated dashboard card mirrors the ratio inline off new sourced `ocfB`
  values (trailing-4Q OCF at the Q2-26 prints: AMZN 148.5 · GOOGL 174.4 · META 124 ·
  MSFT 169.7 — the v3.80.1 SOURCED-EXTERNALLY class). **Deliberately NOT a stance badge**
  (owner call): the strip is red-only facts under a pinned 390px budget; amber lives one tap
  deep, and the two stance-badge string pins stay byte-identical. Measured against the live
  tape: **all four spenders guide past OCF** (AMZN 1.48 · GOOGL 1.15 · META 1.11 · MSFT 1.52),
  so the tell fires immediately — the honest read of a buildout the market already prices as
  FCF-negative. Also in this release: **v3.82.1 shipped with `admin.html`'s two version
  strings unbumped** (package.json moved after the gate run — the exact drift smoke [14]
  exists to catch, and it caught it on the next run); healed here with all three homes moved
  together. Same session, KV-side (no code): **`price_action` levels stamped for 36 of 37
  payload names** from broker-measured daily bars (SMA-50/100/200 closes + 63-day swing
  lo/hi, split-adjusted, owner `entry` blocks preserved on NBIS/JOBY; SPCX skipped and named —
  44 bars cannot compute a level), settling the CRWV 200d the v3.82 web sources disagreed on
  (broker: 92.94). Tests: **1363 smoke** (+6 behavioral: the strict 1.00 boundary, the
  two-spender fire, unmeasured-never-counts, validator bands, both-surface render pins, the
  no-stance-badge guard) + **228 render** (+3: banner/ratios/unmeasured-naming and the amber
  drawer chip driven live at 390px) + 111 public-render + `audit:prod` clean.
- **FEAT-TT-DOTHOME (v3.86) — an invariant a human has to police is not an invariant.** FEAT-TT-DOT
  (v3.17) deliberately put `dots` on the BOOK ENTRY (`e.dots`) so that *"replacing a deepDive payload
  can never wipe the inventory."* FEAT-TT-DDSTORE (v3.75) then made `/api/deepdive` the one path that
  replaces a payload **wholesale** — and nothing anywhere enforced where dots may live. **Measured
  2026-08-13: ACHR, NU, SOFI and SYM each carried a dot inside the payload, and for ACHR/NU/SOFI it
  was their ONLY dot** — the 8/04 "first gates+composite pass" record, one editor save away from
  silent loss, and invisible to the terminal's dots UI (which reads `e.dots`) the entire time. A
  triage pass caught it by hand, which is the tell: the rule existed only as prose.
  The PUT now **HARD-REJECTS** a payload carrying `dots`, naming the book entry as their home. Reject,
  not silent strip — at that moment the caller holds the only copy, so quietly dropping the key would
  destroy exactly what the guard protects. The live store was repaired *before* the guard shipped
  (dots moved to the entry first, payloads stripped second — the crash-safe order v3.75's own
  migration used), so **no existing payload can be rejected on re-save**, the same bar `MISKEY` was
  held to in v3.39. An **empty** `dots` array is rejected too: the key is the defect, not its length.
  Tests: **1389 smoke** (+4) + 229 render + 111 public-render.
- **Session log 2026-08-13 — five falsifier windows, and what the prints actually said.** Five
  pre-committed falsifier drafts were server-stamped 8/04-8/05 and never ratified; by 8/13 their
  qualifying observations had **closed** (RKLB & TSM 8/10, LITE 8/11, BETA & NBIS 8/12), with only
  NVDA's still open (8/26). The stamps predate the observations, so `commitFingerprint` (v3.77) will
  still honour them — **promoting them unchanged remains valid; editing a condition now re-opens the
  commitment and is post-hoc by definition**, since the outcomes are known. That asymmetry is the
  whole point of §6.4.1 and is recorded here because the human decision precedes the server check.
  Outcomes captured as dots on each name: **NBIS** revenue $582M +454%, ARR $3.0B (+56% QoQ), FY guide
  reaffirmed — with **capex $20-25B against $3.0-3.4B revenue (6-8x)**, making it explicitly a funding
  thesis and the archetypal neocloud the **NVDA $500B consortium** exists to fund (two ends of one
  trade — the cluster rule with real numbers). **LITE** beat and guided Q1-FY27 to $1.23-1.28B /
  $4.05-4.35 EPS, which annualises at or above the stored FY2027 $16.67 **before** further ramp — the
  model's estimates now look conservative and should be re-derived. **BETA** beat revenue and RAISED
  FY guidance to $42-50M, but missed EPS and guided Q3 revenue *down* sequentially; reiterated adj
  EBITDA loss $400-445M **plus** capex $150-200M = ~$550-645M/yr against $1.51B net cash = **~2.3-2.7
  years, not the ~3.1 the payload's G2 records** off the net-loss run-rate alone. **TSM**'s 8/10 was
  the July monthly (+44.7% YoY, accelerating vs +37.0% YTD; capex raised to $60-64B), not earnings.
  **RKLB** beat revenue, missed EPS, backlog +137%, and fell on Neutron timing — the tape punished the
  schedule, not the quarter.
- **FEAT-TT-SOURCING (v3.85.0) — who sources what, encoded rather than remembered.** Owner
  standing rule, verbatim: *"All I provide are the forward revenue and EPS conjectures. And by
  default, they will all be at least five analysts or more. So no need for the analyst count
  either. All other information you need, please source from Yahoo Finance or another online
  source."* This is the v3.80.1 DEBT precedent applied to the whole intake surface, and the
  trigger was concrete: NOW's and CRM's `QC_G2_UNIT_ECONOMICS` gates both stalled on operating
  margins the checklist was asking the OWNER for and the assistant could simply fetch — four
  web searches closed both. A rule nobody encodes is a rule the next pass asks about again.
  **`intakeChecklist()` now has four row classes, not two.** `REV_N`/`EPS_N` — the two
  analyst-count CAPTURE rows v3.80 added, emitted together precisely so the owner could never
  discover the second after closing the first — are **retired**, replaced by a single `ext`
  **`COUNTS`** row. Counts stopped being missing data: `INTAKE_COUNT_FLOOR = 5` is a standing
  default the assistant stamps. It is stored as a **FLOOR, not a guess at the true count** —
  the weakest claim the rule guarantees — and the floor is chosen because ≥5 clears the P2
  duration rule (≥3) and thin-coverage dimming (≤2) for every year, which is the only place
  the number can change a ranking. The row survives rather than being deleted because the
  field must still be WRITTEN for `supportedDuration` to read it; a gap that stops being
  visible is the stored-but-invisible failure this checklist exists to forbid. `cntOk` now
  accepts **both stored shapes** — the pre-v3.85 per-series `{revenue:{yr:n}, eps:{yr:n}}` and
  the flat per-year `{yr:5}` the floor writes — because ~40 payloads carry the old shape and
  rewriting them to satisfy a checklist would be churn, not evidence.
  **`MARGINS`, `RUNWAY` and `PE` join `DEBT` in the `ext` class**, and a new **`own`** class
  splits `MODEL`/`FALS` out of CAPTURE: a list headed "CAPTURE" containing *"write a falsifier
  set"* sends the owner hunting a screen that does not exist — v3.80 half-fixed that with prose
  inside the row, this fixes it with the group. The owner's capture list is now **exactly two
  rows, `REV_VAL` and `EPS_VAL`**, and that is asserted directly rather than implied: with every
  input stripped, every row landing in the CAPTURE group must be one of those two. The
  exclusion chain is the load-bearing detail — `byShot` is what remains after `ext`, `own` and
  `api` are removed, so a row added later is CAPTURE only by omission of every other class,
  which fails in the safe direction (an over-classified row costs a fetch; an under-classified
  one costs the owner a round trip). The retired "SCROLL RIGHT to '# of Analysts'" instruction
  is pinned **ABSENT** rather than merely deleted — a withdrawn instruction quietly reappearing
  is the label-outlives-its-data defect this changelog keeps fixing.
  Found on the first run: `test/smoke.mjs` lifted the table from `const INTAKE_SRC=`, but the
  `COUNTS` row interpolates `INTAKE_COUNT_FLOOR`, so the lift left the constant undefined — the
  slice now starts at the constant. The v3.47 `LENS_MAX_PE` lesson (a free variable the existing
  fixtures happened to short-circuit past) one file over.
  Tests: **1405 smoke** (+9 net over v3.84: the single `ext` COUNTS row with the retired capture
  rows pinned absent, the floor stated, both count shapes accepted, `MARGINS`/`RUNWAY`/`PE`
  proven `ext`, `MODEL`/`FALS` proven `own`, the four-group render, and the direct
  CAPTURE-is-only-REV_VAL/EPS_VAL sweep) + **231 render** + **111 public-render** +
  `audit:prod` clean.
- **FEAT-TT-MAG7 (v3.84.0) — the mega-cap sleeve: a third deck panel, and MAGS as the basket.**
  Owner call after a two-day data sprint that put REAL consensus means and finalized multiples
  on all seven mega-caps: "add a small widget ranking them in next dollar separate swipe tab
  after next dollar out. As a whole, MAGS / the average of the mag 7 can be ranked in next
  dollar." Two pieces, one honesty rule.
  **The deck generalizes.** The v3.62 decision deck was hardcoded binary at SIX separate sites
  (`i>0?1:0` ternaries, `active?"decisionFund":"decisionBuy"` lookups, a clamp of literal 1) —
  a third panel meant either six copy-paste branches or ONE page list every site derives from.
  **`DECK_PAGES`** is that list; tab ids are `PAGE_ID+"Tab"` by construction, `decisionKey`
  moves RELATIVELY (Arrow keys step, Home/End jump), and the smoke pin that used to bless the
  binary ternary now blesses the derivation. The **MAG 7 panel** renders the seven from the
  SAME `UPSIDE_ROWS` the main ranking computed — one computation, third altitude; smoke pins
  that `renderMagBlock` contains no `ptModelRows`/`pickRow` call — with each name's overall
  rank stated, unranked members NAMED with the reason, and an honest empty state.
  **MAGS carries the basket into NEXT $ IN.** The Roundhill ETF actually owns the seven, so it
  gets the basket's honest model-by-proxy: the EQUAL-WEIGHT MEAN of the members' own ranked
  rates at the horizon in force, computed from the rows above the sort — never a second
  derivation. Guards, each smoke-run against a lifted copy of the injection block: **>=4 of 7
  members required** (an average of two is not the basket — no row below threshold), missing
  members NAMED on the caveat, `ann===null` members excluded (never counted as zero), MAGS
  must actually be in the book, and — the load-bearing one — **no special-case anywhere in the
  eligibility ladder**: the basket row rides the ordinary gates, and since `readiness(MAGS)`
  has no model/run/hinges, it can RANK but can never take the ELIGIBLE line. A derived rate
  may inform the queue; it may not light the green light. All three row templates branch on
  `r.basket` so a null target can never print.
  **The data sprint it ships on (same release, KV-only):** all seven mega-caps now carry real
  SA consensus means (verified against stated YoY to <0.15pp per name) and FINALIZED multiples
  (owner delegation 2026-08-13), each with its logic prose at `pt_model.multiple_ruling` —
  incl. TSLA's horizon-decay schedule (120x→50x: the robotaxi ramp is IN consensus EPS, so the
  multiple must decay as the option converts or it double-counts), AMZN's trough-normalized
  YE2026 (28x on the capex-trough year — the INDC_G4 mirror), and AAPL's above-market-but-
  still-rich read. The GOOGL FY2026 EPS quarantine was REVERSED same-day on owner evidence
  (quarterly history reconciles $20.58 via H1 actuals — one-time equity marks, not a capture
  error) and the correction is recorded, not silently fixed. Midpoint-interpolation calibration
  measured on four names: AMZN's -12% EPS miss was the outlier; META reversed the direction;
  MSFT/AAPL under 1-3% — no universal correction factor exists, per-name means remain required.
  Tests: **1397 smoke** (+12: the injection block lifted and RUN — the >=4 gate both ways, the
  null-member exclusion, missing-members-named, no-MAGS-no-row, the no-special-case sweep of
  gateFail/why(), the one-computation pin, the DECK_PAGES derivation with the binary ternaries
  pinned ABSENT, and the null-target branch count) + **231 render** (+4 net: three labelled
  tabs, End-key reaching the live MAG panel, the honest empty state driven at 390px, and the
  slice5 fold budget moved 450→470 WITH the reason — the v3.45 legitimate-content precedent).
- **FEAT-TT-TECHREAD (v3.83.0) — the WHEN leg gets a BANDED VERDICT, and the collinearity audit
  that reshaped it.** v3.82 shipped WHEN as a single measured distance (price vs a committed
  entry). The owner asked for the rest of the picture — "indicators patterns charts lines and
  levels along with price action… knowing the bullish and bearish logic like on macro dash" —
  and that last clause is the actual specification: the macro board's strength is not six
  factors, it is that `REGIME_BAND_TABLE` is ONE table where `vote()` is the only expression of
  a band, so the verdict and the flip distances can never contradict each other. **`src/techRead.js`**
  is that architecture applied to price — pure, React-free, Node-importable, mirroring
  `verdictFrom`/`computeRegime`/`flipConditions` one-for-one (`techVerdictFrom` ·
  `computeTechRead` · `techFlips`), so a reader who understands one understands the other.
  **The owner's two directives CONFLICTED and are reconciled by structure, not by picking.**
  v3.82's brief said indicators are lagging and WHEN should be price-action; this one asks for
  indicators too. Every factor therefore carries a `kind` (price_action | indicator | pattern),
  the tally is reported **SPLIT by kind**, and — load-bearing — a **BULLISH verdict is
  DOWNGRADED to MIXED when price action does not confirm**, `raw`/`downgraded` keeping the
  record. BEARISH passes through untouched: a bull call carried by lagging inputs is the one
  that gets you long at the top; a caution assembled from them is still safe. That is the v3.40
  TAILWIND-withhold asymmetry pointed at price.
  **THE AUDIT FINDING, and it was a defect in this release's own first draft.** The table
  shipped `price vs 50d`, `price vs 200d` and `50d/200d alignment` as three separate voters —
  and they are **COLLINEAR**, all functions of the same `{px, ma50, ma200}`. A price above both
  averages cast **three bull votes for one fact**, and the split tally printed `price action
  4▲/0▼ of 4` on what was really one observation plus the range. A tally exists to measure how
  much *independent* evidence agrees; triple-counting inflates precisely the number the reader
  trusts. The three comparisons are now **COMPONENTS of one alignment score (−3…+3)** voting
  once at 2-of-3 — the same call, without the fake corroboration. **The quorum moved 4→3 WITH
  it** rather than being held at a number the table can no longer support: levels alone measure
  exactly two independent things, so a levels-only stamp now honestly reads **UNREAD** until
  momentum or a pattern lands. And the consequence worth naming: price action can now supply at
  most 2 of 5 votes and **can never be a vote majority** — so *"price action is primary"* is
  encoded as **the withhold, not vote weight**. A veto is a stronger form of primacy than a
  heavier vote, because it cannot be outvoted.
  **MISSING IS EXCLUDED, NEVER NEUTRAL** — the one deliberate divergence from
  `REGIME_BAND_TABLE` (where a non-finite value votes neutral by construction). A technical
  read is built incrementally, so an unstamped RSI voting "neutral" would dilute a real tally
  toward MIXED and make an unfinished stamp look like a considered non-lean. Unmeasured factors
  are dropped and NAMED; an out-of-enum pattern is an unrecognised assertion, not a lean
  (the gate-normalizer rule: no label can manufacture a vote). Stale levels withhold the whole
  read — an 8-day-old 200-day average is not a fact about today's tape.
  **RSI is deliberately TWO-SIDED** (bull 55–80, bear below 45 OR at/above 80): encoding only
  ">70 overbought" fights every uptrend the ranking exists to find, encoding only ">55 bull"
  calls a blow-off top a buy. Being compound, it ABSTAINS from `techFlips` with the reason
  named — the CPI/CAPE precedent — as does the categorical pattern factor.
  **⚠ MARRIED, NEVER MERGED, and now enforced three ways.** The verdict may not enter the
  ranking sort, `gateFail`, `why()`, or `sellRank` — smoke pins each surface by slicing the
  real source region and asserting no reference. WHAT (the valuation gap, measured) and WHEN
  (this) render as two lines, never one blended score. `techOf()` is the ONE resolution point,
  so the eligible-line chip and the deep-dive band table cannot disagree.
  admin.html is buildless and carries a copy; the tripwire is **behavioural identity** (both
  implementations run over a 7-case fixture matrix and must return identical verdicts) rather
  than the ptModel byte-identity check — a table of arrow functions is brittle to whitespace
  but its VOTES are exactly what must not drift.
  Tests: **1385 smoke** (+24: every band boundary executed, the collapse pinned in both
  directions, the veto proven un-outvotable against a unanimous 3-0 indicator tally, quorum,
  staleness, flip adjacency and abstention, the four married-never-merged guards, and the
  cross-implementation matrix) + **229 render** (+4: BULLISH with the split tally driven live,
  WHAT and WHEN as separate lines, the read flipping BEARISH on inverted levels, and the pick
  staying ELIGIBLE under a bearish tape — the never-veto proof). Negative-controlled twice:
  disabling the withhold turns 3 red, loosening the trend band turns 2 red. Float note recorded
  at the test site: `pct(102,100)` is 2.0000000000000018, so component reads are pinned clear of
  the edges and the edges themselves are pinned on `vote()` against literals.- **FEAT-TT-ENTRY (v3.82.0) — the WHEN leg: price action on the eligible line.** The framework
  doctrine has three legs — fundamentals decide WHAT, support/resistance decide WHEN, the regime
  decides HOW STRICT — and an audit of the marriage found only two instrumented. WHEN lived
  solely as prose in the free-text `rank` field ("#1 on pullback to X"), a trigger the owner
  asserted in a sentence nothing measured; the green **ELIGIBLE NEXT DOLLAR — all gates passed**
  line checked stance, flip, run freshness and the cap — WHAT + HOW STRICT — and silently
  delegated WHEN back to the owner at the moment of the order. This closes it with the
  **falsifier discipline pointed at price**: a payload block `price_action` carrying
  (a) **assistant-stamped reference levels** (50/100/200-day MAs, 3-month swings — computed from
  the broker historicals API at each TT run, never owner-typed; the owner's input burden stays
  exactly key-metrics + fwd rev/EPS, by explicit owner constraint) and (b) an **optional
  owner-committed `entry`** `{level, kind: pullback|breakout, set_at}` — a level written down
  BEFORE the tape gets there, an edit re-stamping `set_at` (the re-commit rule).
  **PRICE ACTION ONLY, deliberately** — no oscillators, no RSI: the macro board's indicators are
  lagging by construction (owner's observation) and this leg exists to be the opposite. Distance
  is live-price-vs-level, nothing else. **REPORT, NEVER VETO** (the BINCAL doctrine, smoke-pinned
  both ways): `paChip` renders ON the eligible line at BOTH altitudes (DESK + primary BUY block,
  one builder, zero drift) so WHAT and WHEN print together — married, never merged — but neither
  `gateFail` nor `why()` may reference it. Fail-closed everywhere: an undated block is stale, a
  >7-day stamp is stale (`PA_STALE_D=7` — a pre-print pullback level is arguably invalid the
  morning after a print), no live quote falls back to `ref_px`, neither at all renders no
  distance, and an absent block renders NOTHING — never a guess. `price_action` joins the
  dd-index whitelist (the eligible line is board altitude — omitting it would silently blank the
  chip for store-only names, the lazy-loading trap that put hinges in the index); `subsidiaries`
  deliberately does NOT (tab-only).
  **FEAT-TT-SUBS (same release) — subsidiaries/SOTP as a typed section.** Stake value lived in
  prose and composite adjustments (NBIS's ~13%-of-cap stakes, ACHR's Wisk/SkyGrid); a typed
  `subsidiaries` block `{as_of, rows:[{name, kind, pct, mark_B, basis}]}` now renders its own
  table in CAPITAL & EXPOSURE: marks sum only where numeric, **unmarked rows are NAMED and the
  total called a FLOOR** (the capChecks rule), an "assertion" basis is flagged amber, and the
  section states outright that it is **NOT wired into the PT ladder** — moving a marked total
  into `pt_model.net_cash_B` moves every rung and is an owner call per name.
  Ratified with no code change (the smallest-change answer): valuation-primary = forward P/E
  with consensus-forward growth, profitability/margins weighed within — already encoded as the
  earnings-lens rule + consensus-driven rungs + the composite's P3 pillar.
  Not shipped this release: real level stamps for CRWV/NBIS — the historicals API needs the
  next session's tool approval, and the two web sources consulted DISAGREED on the 200d
  (96.66 vs 93.2), which fails the measured-fact bar; stamping contradictory second-hand
  numbers would be the exact defect the block exists to prevent.
  Tests: **1356 smoke** (+11: `paRead` lifted and RUN — both kinds' hit/miss with the mirror
  comparator proven distinct, signed distance, the three fail-closed paths, the never-veto pin
  on both gate sites, the one-builder-two-altitudes pin, the index whitelist run through the
  real `ddIndexEntry`, and the subsidiaries floor/assertion/never-auto-wired pins) + **225
  render** (+3: the eligible line driven green WITH the distance chip live in Chromium, the
  same chip on the primary BUY block, and the price moved to the committed level flipping it to
  AT ENTRY). Negative-controlled: collapsing the pullback/breakout comparator turns the mirror
  pin red.
- **v3.81.0 — the horizon picker becomes a control, not a caption.** Owner screenshot
  (2026-08-11): the live board was ranking on **nearest**, reporting **MU +1970.1%/yr** and
  **SNDK +1035.2%/yr**. Both figures are arithmetically correct — YE2026 is ~0.39 years out, so
  a +225% gain compounds to ~1977%/yr — and economically meaningless, which is the exact units
  trap `ANN_MIN_Y` and the auto horizon already exist to prevent. The interesting part is *why
  the book sat there*: v3.72 added inline `auto`/`nearest` to the deck CHIP, but the **full
  picker** at the ranking itself was still the original 9.5px `<span>` with **1px padding** — it
  RENDERED the choice and offered no usable affordance to change it. A control that can be read
  and not tapped is the v3.52 "interface theater" finding in the other direction: not a claim
  the code never evaluated, but an evaluation the human can never reach.
  **Three fixes.** (1) Real `<button>`s with `aria-pressed`, a filled + 2px-border selected
  state, and **40px thumb targets at ≤480px** — the defect was reachability, not visibility, so
  the render suite measures the box at 390px rather than pinning a string. (2) **Colour-coded by
  KIND**, from ONE `HZ_KIND` map that drives both the colour and the tooltip so a swatch can
  never disagree with the mode it paints: **auto = green** (computed, the recommended default),
  **nearest = amber** (a legitimate choice that annualises whatever rung is closest), **a pinned
  year = slate** (deliberate, and silently drops names lacking that rung). (3) A **computed**
  distortion warning — when nearest actually produces rates ≥200%/yr it names the count, explains
  the division that caused it, and puts *switch to auto* one tap away. Computed from the rows on
  screen, never asserted: an ordinary nearest ranking is not nagged, `null` rates cannot trip it,
  the threshold is two-sided (a −400%/yr rung is the same trap as +400), and on auto or a pinned
  year it cannot fire at all — it is a claim about NEAREST specifically.
  Pinning a **specific** year still routes through the picker rather than gaining a shortcut: the
  two safe modes get the direct path, the lossy one keeps a slightly more deliberate one.
  Tests: **1345 smoke** (+11: the button/aria contract, the one-map colour rule, the fill-not-
  shift selected state, the tap-target media query, and the warning predicate **lifted and RUN**
  against fixture rows — a string pin cannot prove a threshold) + **222 render** (+6: the three
  kinds' computed colours read live, a **real click** moving the horizon and the pressed state
  with it, the one-tap return to auto, and the 390px thumb target measured). Negative-controlled
  three ways — moving the threshold to 2000, collapsing the slate kind into green, and shrinking
  the tap target each turn the suites red.
- **v3.80.1 — the intake checklist gains a third source class: SOURCED EXTERNALLY.** Owner
  directive from the CRWV pass (2026-08-10): debt maturity schedules are not on Seeking Alpha,
  so they are **never an owner capture — the assistant sources them externally** (SEC filings,
  IR releases, ratings notes) **for every new ticker**. Encoded, not remembered: a `DEBT` row
  (net debt + maturity schedule) fires for any name with no `net_cash_B`/`net_debt_B` on file
  — either sign satisfies it, since NBIS stores cash and CRWV stores debt — and carries an
  `ext` tag that renders it under its own **SOURCED EXTERNALLY — the assistant fetches these,
  not you** group, structurally unable to land on the screenshot list. The two "fully fed"
  fixtures went red the moment the row landed (they had no balance sheet), which is the
  requirement working; they now carry one. Tests: **1334 smoke** (+3).
- **FEAT-TT-INTAKE (v3.80) — the data-intake checklist, and an evening time-bomb in the suite.**
  Filling HOOD's payload took **four screenshot round-trips** on 2026-08-07, and not one of them
  was a storage failure: each gap surfaced only AFTER the previous one closed. Round 1 revenue
  + EPS + TTM growth → asked for analyst counts; round 2 P/E table → still none; round 3 EPS
  counts → but not revenue counts; round 4 revenue counts → P2 finally scored 7.73. Twice a
  *"Growth Rates (TTM)"* capture was sent reasonably expecting it to fill P3, which it
  **structurally cannot** — P3 wants margin LEVELS, that screen carries growth RATES — and
  nothing said so up front. Serial discovery, not bad data.
  **`intakeChecklist(x)`** computes the COMPLETE missing set in one pass, derived from the same
  pillar contracts `src/ttScore.js` enforces, and names the exact source screen per gap. It is
  the `readiness()` pattern pointed at intake rather than at decisions: readiness answers *"can
  I act on this name"*, this answers *"what must still be fetched before the engine can score
  it"*. It stores nothing and asserts nothing — **every row is derived from what IS present**,
  and a fully-fed payload renders a DONE state rather than an empty box.
  Three properties that carry the weight. **(1)** Values and analyst counts are DIFFERENT
  captures on the same SA screen, so both count rows are emitted TOGETHER — the four-trip
  defect, closed. **(2)** The count rows name the **SCROLL** (`SCROLL RIGHT to '# of Analysts'`),
  because that column was cropped three times for being off-screen right on mobile. **(3)** A
  prose placeholder — several live payloads carry `analyst_counts: "NOT CAPTURED — cropped"` —
  **never reads as data**; only an object of years satisfies the requirement. Mode routing is
  real too: a PREPROFIT name (negative near EPS) is asked for RUNWAY and never for an operating
  margin that does not exist. Rows fetchable by API (`get_financials`, `get_equity_quotes`)
  are tagged and kept OFF the capture list, and the P4 gap is explicitly labelled **NOT a
  screenshot** — it is owner-authored thesis work, and sending someone hunting a screen that
  does not exist is its own defect.
  **Found while running the gate: one assert was red on `main`, and it fails only in the
  evening.** The v3.78 merge's composed-lifecycle test stamps its qualifying observation with
  `new Date().toISOString().slice(0,10)` — a **UTC** date — while `scoreP4` validates freshness
  against the **ET** date. From ~8pm ET the two diverge, the observation reads as FUTURE-dated,
  and the engine correctly rejects it as `observation INVALID`. The engine was right; the
  fixture was wrong, and the test passed by daylight and went red every night. This is the
  identical defect **v3.11** fixed for run stamps (*"the old `toISOString()` UTC stamp rolled
  evening runs to tomorrow → runState read them as future = NEVER RUN"*) and the **v3.35**
  fixpack fixed for render fixtures — third recurrence, now in a test written at the v3.78
  merge. Fixed to the ET idiom and **verified inside the failure window** (23:35 ET / 03:35
  UTC), which is the only time the proof means anything.
  Tests: **1325 smoke** (+15 intake: the complete-set contract, both count rows together, the
  prose-placeholder rejection, half-captured counts, PREPROFIT/PROFITABLE mode routing, API
  tagging, the not-a-screenshot label, the ≥3-hinge floor, read-only purity, and the scroll
  hint; +1 fixed) + 216 render + 111 public-render + `audit:prod` clean.
- **FEAT-TT-CROSSOVER (v3.79) — YEARS_TO_CROSSOVER: the pre-profit second series that can
  actually exist (methodology → `tt-underwriting-v2.5.0`).** Running JOBY through v2.5's P2
  hit a wall the whole pre-profit class shares: PREPROFIT demanded a GROSS_PROFIT or EBITDA
  CAGR, and **no such consensus line exists** — SA prints NM on EBITDA/EBIT/net income/EPS/FCF
  growth for these names because a growth rate between two negative numbers is undefined
  (owner screenshot, confirmed via SA's own assistant: only rev+EPS estimates, revision
  counts, and HISTORICAL gross profit are published). So the rule read "declare a pre-profit
  path, now show me a profit trend" — self-contradictory, and it collapsed decision-grade
  information into one undifferentiated blocker. **Measured against the live book: 6 of 30
  payloads are pre-profit (ACHR·BETA·JOBY·NBIS·RKLB·TEM — NBIS is the core position), every
  one carrying only `revenue_B`+`eps`, and their consensus EPS crossovers span 2027→2031** —
  RKLB is 1 year from modeled profit, JOBY is 5, and the engine returned the identical blocker
  for both. "5 years from profit" is information; "I cannot see" is absence — the v3.1 lesson
  one layer down. **The fix:** `preprofit_second_series: "YEARS_TO_CROSSOVER"` — distance from
  the scoring ET year to the first consensus-positive EPS year, scored on the step table
  `CROSSOVER_SCORE` (≤1y→9 · 2y→7.5 · 3y→6 · 4y→4 · 5y→2.5 · 6+→1). Anti-gaming by
  construction: the crossover year is whatever the street models, never owner-picked, and the
  eps series rides the same consensus rows the payload already stores. **Honest limits,
  stated:** the step table is ASSERTED, not calibrated (the NFCI-deadband class, every
  boundary smoke-tested so changing it is one edit plus one red test); the ceiling is 9 never
  10 (a still-pre-profit name never maxes the growth-quality leg); and the deliberate overlap
  with P3's `path_to_profit` enum (~7.5% of composite here vs ~3.75% there) is documented at
  the code site, priced-in not hidden. Fail-closed edges: a series that never crosses is a
  NAMED blocker ("no modeled path to profit" ≠ a low score), <2 rows blocks, thin coverage at
  the crossover year warns (the 3-analyst dimming rule), a past crossover warns to re-check
  the PREPROFIT declaration. The other two second-series paths are byte-identical.
  Tests: **1310 smoke** (+6: the JOBY-shaped 6.75 composite run behaviorally, every step
  boundary, both blockers, both warnings) + 216 render + 111 public-render + `audit:prod`
  clean. Stored v2.4.0 records read LEGACY_UNVERIFIED until re-scored (§4.3, designed).
- **FEAT-TT-PROVISIONAL (v3.78) — the falsifier-bootstrap feedback, integrated at the
  high-leverage set only (owner call).** *Relabelled from v3.77 at merge (2026-08-06): the
  pre-commitment fix below shipped in parallel on `main` and independently claimed v3.77,
  landing first and owning the number — the same collision ENGINE0-CONT and FEAT-TT-SCORE
  each documented once; this entry takes the next true sequence number, content otherwise
  as committed. The two v3.77s COMPOSE, which is why the merge is a union not a pick:
  the pre-commitment fingerprint makes a first-write P4 = 10 impossible (the JOBY dry run's
  own number, correctly distrusted), and PROVISIONAL makes the honest first-write state —
  PRECOMMITTED_PENDING, now reached by construction — still produce a capped, never-eligible
  output. One fix removes the false score; the other keeps the owner's "always an output"
  rule through the wait. The methodology version lands at v2.4.0 (this entry's bump), which
  v3.77's declared-version gate now enforces engine-side as well. The reconciliation took
  main's `readDeepDive()` over this branch's inline dd-store read (one server-side resolution
  point beats two), flipped v3.77's version-gate test literals to the merged v2.4.0 engine,
  and added ONE test neither parent could hold — the composed lifecycle driven through the
  real endpoint: a backdated first write lands PROVISIONAL + PRECOMMITTED_PENDING, the second
  write with the same conditions on file reaches SCORED, and the ledger carries the status
  transition. Merged head: **1304 smoke** + 216 render + 111 public-render + `audit:prod`
  clean.*
  Two owner-commissioned analyses of the UNSCORABLE
  symptom landed the same root cause: P4 (falsifier health) demands ≥3 pre-committed
  falsifiers with post-definition observations — owner-authored thesis content no data feed
  can supply — and one null pillar nulls the whole card, so every freshly-added name reads
  UNSCORABLE regardless of how complete P1–P3 are. Integrated, from their recommendations:
  **(1) PROVISIONAL bootstrap scoring** (the analyses' Option A; methodology bump →
  `tt-underwriting-v2.4.0`, §4.3). When P1–P3 are all numeric and P4 is blocked **solely** on
  falsifier bootstrap (`p4.blockers.every === "AWAITING_FALSIFIERS"` — a malformed hinge or a
  stale observation is an input DEFECT and stays UNSCORABLE so it gets fixed, never averaged
  past), `buildScorecard` publishes `card.provisional` beside a **null blend**: the P1–P3
  mean, tier **hard-capped at B** (uncapped tier recorded, never worn), `pending` naming the
  bootstrap state. `raw_score`/`raw_tier` stay null — the four-pillar doctrine holds for the
  composite; this is the owner's "the TT always gives an output" rule at the diagnostic
  level, one step past v3.74.1's head fix. Eligibility is **structurally** blocked
  (`evalEligibility` requires `status === "SCORED"` — no new rule to forget), actionability
  stays BLOCKED, and the shadow panel renders it amber-never-green with the cap and the
  ineligibility in the same breath. The score index carries `provisional_score`/`_tier` so
  a bootstrap name can rank on the board summary; the ledger's score diff now logs **status
  transitions** (provisional→scored is a belief event, the analyses' constraint 6).
  **(2) Found while integrating, and bigger than the feature: `/api/score` was still scoring
  P1 blind on every migrated name.** It read `entry.deepDive` from the book — but
  FEAT-TT-DDSTORE (v3.75) moved payloads to `tt:dd:v1:<SYM>` and strips them from entries,
  so a migrated name's complete PT model sat one key away while P1 reported "no computable
  model row". The handler now reads the store first, embedded payload as the pre-migration
  fallback (the client's own `ddOf()` order, server-side) — the OTHER half of "how is a
  fully-documented name unscorable". **Declined, with reasons:** the 30-day provisional
  auto-expiry (a server-stamped record must never self-mutate on read; the card is already
  BLOCKED and labeled, so a second clock changes no decision) · min-1 falsifier (one hinge
  is confirmation, not triangulation — the analyses' own assessment) · template-stamped
  starter falsifiers (a pre-committed condition generated from a route profile is not
  pre-committed — the exact §6.4.1 rationalization risk) · re-validating scorecards in
  `tt.js`'s book PUT (the analysis itself concludes the server-authoritative `/api/score`
  split is correct as built). Version literals updated everywhere they live (client PUT
  body, fixtures); stored v2.3.0 records read LEGACY_UNVERIFIED until re-scored — the
  designed §4.3 consequence, safe in shadow mode where legacy governs.
  Tests: **1284 smoke** (+9: the provisional path, the B-cap, the never-eligible proof, both
  UNSCORABLE controls run through the real `buildScorecard`, the dd-store read driven
  through the endpoint against a migrated fixture, the endpoint-level provisional with index
  + ledger asserts, the amber-never-green client pin) + **216 render** + **111
  public-render** + `audit:prod` clean — all four gates run, browser suites in real Chromium.
- **v3.77 — the two defects the owner's JOBY payload exposed, and a regression v3.75 caused.**
  Running the 2026-08-05 JOBY `underwriting_inputs` through the engine returned **P4 = 10/10**
  off five falsifiers all graded GREEN against a print observed the same day. That number was
  not trustworthy, and finding out why turned up three separate faults.
  **(1) Pre-commitment was self-attested.** §6.4.1's entire content is that a falsifier set
  must be on file BEFORE the observation it is graded against — it is the control that stops
  the book becoming the *"sophisticated rationalization engine"* FEAT-TT-CAPABILITY warned
  about. The engine tested it by comparing `h.defined_at` against
  `h.qualifying_observation.observed_at` — **two client-supplied fields arriving in the same
  request**. A set authored today and stamped yesterday scored the maximum; the
  `defined_at_post_hoc` flag is not a control either, since the client that would misdate is
  the client that would omit the flag. The server holds the prior record, so it can answer the
  question properly, and now does: **`commitFingerprint()`** covers conditions, importance and
  the kill flag, `score.js` builds the map from the STORED record, and a hinge scores only if
  those exact conditions were already on file. It is a **fingerprint, not just a date** — so
  *editing* a red condition re-opens the commitment and says so, because moving the goalposts
  after the fact is the same defect as backdating them. The first write is now
  `PRECOMMITTED_PENDING` **by construction rather than by good manners**, which is what §6.4.1
  always described. A call with no server context (the pure/offline path) keeps the old
  comparison, so the exported engine is never made stricter than its caller can satisfy.
  **(2) The declared methodology version was erased by the field that should reveal it.** The
  card stamps `METHODOLOGY_VERSION` — the version that did the computing — over whatever the
  inputs declared, so this v2.4.0 payload scored under a v2.3.0 engine and the record then read
  v2.3.0. `functions/api/score.js` does 409 on the mismatch, but the engine is exported and
  reusable and must not depend on one caller to fail closed: it now records
  `declared_methodology_version` and blocks on a declared-and-different version. An ABSENT
  version still computes (that is the offline call, not a mismatch).
  **(3) FEAT-TT-DDSTORE broke two server consumers — my regression, shipped the day before.**
  v3.75's own entry claimed the storage move was *"invisible to every renderer"*. True for the
  client, where `ddOf()` is the choke point; **the server was never swept.** `score.js` read
  `entry.deepDive` off the book, so after the migration **P1 lost every valuation input**
  (pt_model, consensus, ref_px) and reported "no floor" for the wrong reason entirely. Worse,
  `diffForLedger` diffed `prev.deepDive` against `next.deepDive` inside the **book** PUT — and
  payload writes no longer pass through `/api/tt` at all, so the belief ledger's
  `thesis`/`hinge`/`pt`/`comp`/`est` kinds **went silent**: the terminal's memory, which is the
  one thing it has that a quote screen does not. **`readDeepDive()`** is now the server-side
  counterpart to `ddOf()` (store first, then a still-embedded payload for a pre-migration
  book), and **`diffDeepDive()`** is extracted so the two write paths that can change a payload
  share ONE implementation — the book path (pre-migration books can still carry one) and the
  payload store, which appends fire-and-forget after its write succeeds, exactly as `tt.js`
  does. `ledger.js`'s snapshot walk is the documented exception: it reads historical book
  snapshots, so it degrades honestly to `null` rather than fabricating a price.
  **Why the existing tests missed all three:** section [48]'s score fixtures embed `deepDive`
  in the book, so they passed identically before and after the migration. The new coverage runs
  against the **post-migration book shape**, which is the only shape that can catch it.
  Tests: **1294 smoke** (+19: [52] the server consumers — store-first resolution, the P1
  regression, ledger entries on a payload PUT, ledger-fault isolation, and a comment-stripped
  sweep proving no server file reads `entry.deepDive` in code; [53] pre-commitment — backdating
  refused, the bootstrap completing once conditions are on file, edits re-opening it, the kill
  flag inside the fingerprint, and the version gate both ways) + 216 render + 111 public-render.
  Negative-controlled: reverting the `score.js` read turns two red, disabling the ledger append
  turns one red.
- **FEAT-TT-ALLREVIEWED (v3.76) — every TT review reaches the next dollar, asterisked.**
  Owner's rule, stated twice now and only half-honoured the first time: *"the TT should ALWAYS
  give a score or output for next dollar hierarchy at the least"*, then *"every TT review must
  factor into the next dollar even if with an asterisk."* v3.74.1 fixed the panel HEAD (it led
  with a blocker count instead of an output). This fixes the LIST. A reviewed name the math
  could say nothing about left the next-dollar surface **entirely** and survived only as a
  SENTENCE — a count in a footer, a comma list inside a collapsed methodology expander. That
  is the v3.65 lesson one step further: naming the dropped names beat counting them, but a
  name mentioned in prose beside a column of ranked rows still reads as excluded — and the
  names most often in that state are exactly the ones just reviewed, because **a fresh TT run
  routinely precedes the model** (BA, CAT, GEV, CRDO all landed there this week).
  The ranking now has **TWO BASES, married never merged** (the measured/asserted doctrine):
  the rows above rank on **%/yr, the measured gap**; the tail ranks on the **TT composite, the
  asserted judgment**, marked `*`. A tail row **never borrows a rate it does not have** — that
  would be exactly the units error DEC-D2 removed from `sellRank` — and carries no `ann`/
  `upside` field at all, so a rate cannot leak into a sort or a render even by accident.
  **The reason is the specific missing input, with its fix**: `no thesis payload stored` →
  *add a deep-dive payload* · `no pt_model target` → *add a pt_model* · `no usable price` →
  *stamp a ref_px or wait for a quote* · `no year-end <hz> rung` → *extend the estimates, or
  set the horizon to auto*. A generic "unrankable" names a state; this names the next action.
  **"Reviewed" is deliberately broad** — a run stamp, a stored thesis, OR a composite — because
  any one of them means a human looked at the name, which is the thing the owner asked never to
  lose. A name with none of the three is **not** in the tail and gets its own **NOT REVIEWED**
  section in the export: *"never looked at"* and *"reviewed but unpriceable"* are different
  facts, and only the second belongs in a next-dollar hierarchy. A reviewed name with no
  composite yet sorts LAST but is still present, reading *"reviewed, no score yet"* — the state
  a fresh run is usually in, and a `0` there would have read as a judgment.
  **`UNRANKED_ROWS` is one computation at three altitudes** (the `ptModelRows` rule): the
  compact BUY block on the primary view, the DESK ranking, and the rankings export — which
  re-ranks its old flat "NOT RANKED" bin into the same composite order rather than re-deriving
  anything. **Red hinges and never-run flags ride the tail row**, so a name demoted to the
  second basis does not lose its reds on the way down (v3.25). And the empty-ranking branch now
  **emits the tail instead of an apology** — the owner's rule is that this surface always
  produces an ordered output.
  **Found while verifying against the live book, and fixed in the same release:** the two names
  topping the real ranking (SNDK, MU) each carry a `pt_model.note` that says *distrust this
  number* — SNDK's names Bernstein's protected $214 as "the DEFENSIBLE anchor… model the
  protected number, not the consensus one", MU's says the floor "applies a market multiple to
  PEAK memory EPS, exactly what this book's BE note forbids". That caveat was stored, was
  computed into the row as `r.caveat`, and rendered **only in the DESK list** — so the primary
  view showed both at #1 and #2 with nothing. Same defect class as D3 and v3.25: a
  machine-known warning *about the number being shown*, present one level down and absent where
  the decision is read. Now a chip-length `⚠ model note` on the row with the text in its title,
  verbatim one tap deep (v3.66).
  Tests: **1276 smoke/render** (+13 smoke: the classifier lifted and RUN — the full reason taxonomy, the
  composite ordering, no-rate-leakage, red-hinge carry, and that an unreviewed name stays out)
  + **216 render** (+11: the tail driven live at 390px on both altitudes, the export's two
  sections, the caveat chip, and total coverage — every book name lands in exactly one place).
  Negative-controlled twice: disabling the primary-view tail turns three assertions red, and
  removing the caveat chip turns one red.
- **FEAT-TT-DDSTORE (v3.75) — the deferral comes due: `deepDive` gets its own KV document.**
  Third time at the same wall, and the changelog called it every time. `pos` was split out in
  v3.34 and the belief ledger in v3.32, each because a growing thing was riding inside one
  fixed-size PUT. `deepDive` is by far the largest and fastest-growing such thing — consensus
  tables, `pt_model` schedules, hinges, gates, projections, capex/tokens blocks and
  pre-committed falsifier drafts, per name — and `DD_MAX` went 8KB → 15KB (v3.63) → 45KB
  (v3.70) with `MAX_BODY` 64KB → 200KB (v3.34) → 300KB (v3.70) chasing it. v3.70's own note
  said plainly that raising the cap "is a stopgap, not the fix" and that this split "is the
  permanent answer and remains deliberately deferred." On 2026-08-05 the book reached
  **306,425 of 307,200 bytes — 99.7%** — and a routine two-name TT pass (CRDO/LITE) had to be
  rewritten tighter to land, leaving 775 bytes of headroom. That is the deferral coming due.
  **Storage is ONE KEY PER SYMBOL** (`tt:dd:v1:<SYM>`), unlike positions' single map — a
  deliberate difference, because the shapes differ: position records are tiny and the terminal
  needs all of them at boot to compute caps and clusters, so one document beats a fan-out;
  thesis payloads are up to `DD_MAX` each and only ONE is ever rendered at a time, so
  per-symbol keys mean a tab open reads ~10KB instead of ~300KB and **one name's growth can
  never squeeze another's**. A PUT is per-symbol and whole-payload-for-that-symbol, which is a
  strictly stronger guarantee than the whole-book replace it replaces.
  **`tt:dd:index:v1` is the board's working set**, and it is a **WHITELIST, not a blacklist**:
  a payload block added later must not silently start bloating the document the whole board
  loads. Which fields belong in it was settled EMPIRICALLY rather than by reading — the render
  fixture's JJJ was moved to store-only with **every pre-existing JJJ assertion left
  unchanged**, so a field the board reads but the index omits fails the suite. That caught
  `capex_exposure` (the FEAT-TT-CAPEX conservation lint sums it across the book) and
  `pt_consensus` (FEAT-TT-SPREAD's street-vs-mine). **Hinges ride as the same trimmed ARRAY,
  never a precomputed tally**: every board surface that counts reds — readiness, the chip
  strip, the BUY-row naming — reads `dd.hinges` directly, so a tally field would have made all
  of them silently report ZERO reds for any name whose tab was never opened. A red fact
  disappearing behind lazy loading is the v3.25 rule broken by a storage decision.
  **`ddOf(x)` is the client choke point** — full payload, then board index, then a
  still-embedded payload — so the move is invisible to every renderer, the same property
  `posOf()` gave the position split, and a pre-migration book keeps working throughout.
  **The dangerous path is the editor**, and it fails closed: seeding from an index and pressing
  SAVE would write the board summary back over the full thesis, so `openDeepDive` force-loads
  and **REFUSES to open** rather than open on a partial. `saveFloorMultiple` edits a COPY for
  the same reason. `ddPersist()` is the ONE write path and REVERTS the local edit on failure
  (the v3.6 rule that a failed save must never leave the screen showing the edit as landed);
  removal PUTs `null` (positions' `{sym:null}` precedent) and reverts likewise.
  **`persist()` is the ONE drain point** — import, session handoff and any pre-migration entry
  all reach the server through it, so the book can never re-inflate with payloads after the
  migration; the drain writes the payload BEFORE stripping the entry, so a store failure
  leaves it embedded and still saved rather than dropped.
  **Export integrity needed its own route.** Payloads load lazily, so an export built from what
  the client happens to hold would silently omit every name never opened this session — a
  backup that looks complete and is not is worse than none. `GET ?all=1` pulls the full set,
  both exports re-embed it into a single self-contained restore artifact, and a failed fetch
  **ABORTS the export** rather than writing it partial. A sym the index claims but whose
  payload key is gone is NAMED, never quietly absent.
  **The migration** (`POST ?migrate=1`, idempotent, POST-only per the v3.54 GET-must-not-mutate
  rule) writes payloads FIRST, snapshots the book, then strips and re-saves — so a failure at
  any step leaves a recoverable state and the retry is a no-op. An oversize payload is **named
  and left embedded**, never silently skipped.
  Found while wiring, and it was mine: `renderDeepDive` calls the loader on every render, so
  keying the "already tried" guard on `DD_FULL` (which a no-payload answer never populates)
  was an unbounded fetch loop, and an unconditional re-render on landing **collapsed every
  `<details>` the reader had just opened** — the same async-landing defect `EST_OPEN`/`DD_OPEN`
  exist to prevent. Caught by the render suite, fixed with `DD_TRIED` + a re-render only when
  a payload actually arrived.
  Tests: **1261 smoke** (+37: the handler RUN against a fake KV — index whitelist and hinge
  visibility, per-symbol isolation, the null removal path, oversize fail-closed, `?all=1`
  including the named-missing case, and the migration's crash-safe ordering, idempotency,
  snapshot and oversize naming; plus `ddOf`/`ddIsPartial` lifted and executed for the fallback
  order) + **206 render** (+7, incl. the store-only name ranking and its red hinge counted with
  no tab ever opened) + 111 public-render. Two negative controls run: collapsing hinges back to
  a tally and reordering the migration's writes each turn the suite red.
- **v3.72.0 — the horizon picker stops being a deep-link to itself.** Owner hit the exact
  failure v3.68's chip existed to prevent: the board was pinned to YE2030, silently dropping
  35 of 41 names from the next-dollar ranking, and clearing it meant leaving the compact
  BUY/FUND deck panel to hunt through DESK for the full picker — the chip only ever
  deep-linked, it never let you act. `hzDeckChip()` (one builder, all 3 call sites, unchanged)
  now puts **auto** and **nearest** — the two safe, computed modes, and the actual fix for a
  stale pin — one tap away, calling `setHorizon()` directly so both deck panels re-render in
  place with no navigation. Pinning a **specific** year is deliberately left one tap deeper
  (still opens the full picker in DESK): the dangerous action keeps a slightly more
  deliberate path than the two recommended ones. The horizon itself is still device-local
  (`localStorage tt:hz`, v3.65) and still defaults to auto with nothing stored — this closes
  the gap between "the default is already auto" and "clearing a stale pin takes one tap, not
  a hunt."
  Tests: **1068 smoke** (+1, net — a 1-assertion string pin split into 2 behavioral checks
  covering the inline auto/nearest buttons and the still-deep-linked specific-year path) +
  192 render (verified live in Chromium, no regression).
- **FEAT-UIMOD (v3.73.0) — the UI overhaul: the public dashboard's monolith becomes a module
  tree, behavior-identical and behaviorally proven.** The owner-approved spec (requirements/
  design/tasks, 5 vertical slices) executed wave-by-wave on one branch. `dashboard.jsx`
  2106→~950 lines, now an ORCHESTRATOR (hook call, derived state, the A4 gate, the global
  stylesheet, composition); everything it renders lives in **`src/sections/`** (RegimeBand ·
  FiveWhys · MacroStrip · SignalQuality · WhatChanged · MarketDetail · MacroRegime · Headwinds ·
  AIUnitEconomics · Alerts · DataHealth · Watchlist · StickyNav) and **`src/primitives/`**
  (SourceBox+DataModeBadge · SectionHeader · CollapsedGroup · Illustrative · atoms(Badge/Label) ·
  DirTile · FGGauge), with new pure modules **`src/design-tokens.js`** (DT/T — the ONE token
  home; the "design-tokens.json canonical" comment named a file that never existed),
  **`src/format.js`** and **`src/aiEcon.js`** (curated AI data + tokenScissors, now IMPORTED
  and RUN by smoke instead of source-lifted). Every move is VERBATIM — sections are
  presentation-only (smoke-enforced: no computation/hook/storage imports; the documented
  exceptions import the pure engine so a threshold is never re-declared) and every extraction
  repointed its pins in the same commit (the spec's own R1 risk, lived every wave; negatives
  sweep `uiSrc`, the concatenation of all UI surfaces). Deleted, not moved: `Divider`,
  `LAUNCH_COST`, `EVTOL_CERT`, `.hide-mobile` — all rendered/consumed NOWHERE (dead code is a
  rot vector), each negatively pinned. New capability landed with the extraction: skip-nav
  link + focus-to-verdict on the first LOADING→settled transition (Req 8.9, proven live);
  StickyNav with IntersectionObserver active tracking (supersedes the v3.62 hash-only state —
  a click still wins instantly) + a ≤320px hamburger; the ≤320px header ≤56px budget; 44px
  tap-target gap-fill (nav links, CollapsedGroup, headwind rows — which became real buttons);
  **confirmed-not-optimistic copy claims** (Req 7.9: a denied clipboard write no longer
  flashes ✓ COPIED over an empty clipboard — worst on the order-gating TT block); and the
  **wave-17 audit fix**: the strip's F&G/CPI colors and the VIX tile now branch on
  `REGIME_BAND_TABLE`'s own vote (a neutral F&G painted bearish red off a hand-written `>55`
  while the gauge showed grey and the chip `•` — one page, three answers; CPI asserted a
  `>3` level the engine never uses), muted when the field is not live. Docs:
  `docs/design-system.md` + `docs/RISKS.md` in the B5 maps-not-mirrors shape, smoke-enforced.
  Audit findings left OPEN as owner calls: Watchlist's custom toggle vs the one disclosure
  idiom; hover-only strip explanations unreachable on touch.
  Tests: **1137 smoke** (sections [45]–[55] hold the extraction contracts) + **192 render** +
  **111 public-render** (new behavioral proofs: the 375px/600px verdict contract, the A4
  boundary, skip-link/focus/hamburger driven live, clipboard-failure revert + success control,
  and the strip-vs-chip agreement fixture) — all green under `npm run gates`.
- **FEAT-TT-SCORE (v3.74.0) — the TT Underwriting Score engine ships, SHADOW mode.**
  *Relabelled from v3.73.0 at merge (2026-08-05): FEAT-UIMOD shipped in parallel on a separate
  branch and landed on main first, owning the number — the same collision ENGINE0-CONT already
  documented once; this entry takes the next true sequence number, content otherwise verbatim.*
  Implements the owner-approved `tt-underwriting-v2.3.0` methodology (private spec,
  KV/artifact-only — the document itself never enters this repo) in the §14 order: storage split
  first, UI after server, legacy governing until activation. Five commits:
  **(1) `src/ptModel.js`** — the PT chain (schedAt/ptModelRows/ptRowYears/lintPtModel/
  yrsToYearEnd/annualise/pickRow + LENS_MAX_PE/ANN_MIN_Y) extracted verbatim so the server can
  run the SAME math the terminal renders. admin.html (buildless) keeps byte-identical copies;
  **smoke [49] lifts them and asserts identity against the module exports**, so the two copies
  cannot drift silently — the tripwire readout.json.js's header named as the inlining fallback,
  now real. Only signature change: an optional trailing clock argument (identical in both
  copies), which finally lets the v3.39 Q4-cliff proof drive the REAL pickRow at a December
  instant instead of stubbing yrsToYearEnd.
  **(2) `src/ttScore.js` + `src/ttScoreRegistry.js`** — the pure engine: piecewise + every
  anchor table; ET freshness/atomic validation (numeric strings named, future dates INVALID);
  the §8.1 legacy-gate normalization (`tt-gate-normalization-v1`: PASS-with-note→PASS,
  NO_EVIDENCE/NOT_STARTED/DEMANDING-BUT-CREDIBLE/FLAG→UNKNOWN, unrecognized→UNKNOWN fail-closed,
  **no label can manufacture FAIL**); four pillar calculators — P1 owner valuation
  (premium ONLY on prerequisite-gate PASS, else floor, else **NO_FLOOR_PREPROFIT** with the
  contingent premium kept as CONTEXT ONLY, never a score; 4-day price boundary; hard lints
  unscorable), P2 trajectory (declared PREPROFIT second series GROSS_PROFIT|EBITDA with fixed
  basis — the scorer never picks opportunistically; **consensus years need analyst_count≥3 to
  extend duration**, the book's own ≤2-analyst dimming rule made load-bearing), P3 economic
  quality (both modes, every enum sourced-and-rationaled, missing is never 5), P4 falsifier
  health (§6.4.1 bootstrap: LEGACY_POST_HOC never scores, one PRECOMMITTED_PENDING hinge nulls
  the pillar, kill:true+RED = broken thesis); order-independent gate precedence (BROKEN_THESIS >
  BLOCK_ADD > strictest TIER_CAP, UNKNOWN blocks); typed CLUSTER_CONSTRAINT evaluation (sizing
  is WHETHER — deliberately not a fourth gate effect); eligibility (CAUTION caps at
  YAY_ON_TRIGGER; binary days 0–10 inclusive); risk-first outcome memory (improvements never
  net away a worsening); canonical key-sorted SHA-256 input hashing. The registry maps all six
  lenses (`tt-route-v1`; IND = QUALITY_COMPOUNDER/INDUSTRIAL_CYCLICAL — the profile that encodes
  the book's own "a cresting cycle earns a LOWER terminal multiple" doctrine as a gate; unknown
  lens → UNMAPPED, never inferred) and every Appendix C gate as a typed pure function with exact
  boundaries. **The engine reproduces the 2026-08-05 NBIS dry run exactly** (P1 9.03 PREMIUM at
  +51.75%/yr with the 2028-bridge gate passing on the stored real inputs, UNSCORABLE overall on
  AWAITING_FALSIFIERS).
  **(3) `functions/api/score.js`** — PIN-gated (authorize imported from tt.js; crossOrigin
  mirrored, the positions.js precedent). GET `?sym`/`?book=1`/`?decisions=1`; PUT `?sym` with
  **If-Match:<input_hash>** two-device safety (409 SCORE_VERSION_MISMATCH returns the normalized
  server record — no floating-point acceptance loophole); POST `?decision=1` verifies every
  named scorecard hash before persisting a server-stamped ELIGIBLE_SET_CHANGED event. Dedicated
  KV keys (`tt:score:v1:<SYM>` · snap 450d TTL · compact index · paginated decision journal) at
  explicit 64KB/16KB caps failing closed with key+bytes+limit. Route derived from the stored
  book lens — a client-supplied route is ignored; client-supplied scorecards are ignored
  entirely. Compact belief diffs ride the existing per-sym ledger fire-and-forget. **Zero bytes
  added to the book document, proven by test** — the same isolation FEAT-TT-POSSTORE (v3.34)
  established for `pos`, applied before the squeeze this time instead of after.
  **(4) The shadow SCORE panel** (`ddScoreBar`, deep-dive tab, §15 order: under DECISION
  READINESS) — renders the server result verbatim, named states never placeholder scores, raw
  legacy gate labels kept for audit, the stored composite relabelled **LEGACY / UNVERIFIED
  (governs the board until activation)** in one home, and a complete shadow score that disagrees
  rendering **"WAIT — methods disagree"** — married, never merged. `promoteFalsifiers()` lifts
  the book-staged pre-committed drafts (NBIS/JOBY, server-stamped 2026-08-04 BEFORE their
  qualifying observations) into score records as PRECOMMITTED_PENDING.
  **(5) Deliberately NOT in this release:** the existing `gateFail`/AGREE_PICK eligibility
  ladder is untouched (legacy governs, §14.7); the remaining ~40 names' falsifier bootstrap and
  the 10 genuine shadow runs are operational owner work; the 30/90/365-day outcome evaluation
  jobs wait until decision events exist to evaluate. Deployed caps (DD_MAX 45KB / MAX_BODY
  300KB) are recorded in every scorecard as implementation metadata and three-way pinned in
  smoke against tt.js and admin.html — the spec's own §4.1 rule that book limits are deployment
  facts, not methodology constants.
  Tests: **1153 smoke** (+75 net: [45] engine, [46] pillars, [47] registry/normalization at
  −ε/boundary/+ε, [48] endpoint via fake KV + real authorize incl. the §4.5 max-shape fixture
  proven <64KB, [49] byte-identity tripwire; 4 pins re-pinned on invariants) + **198 render**
  (+6, the shadow panel driven live in Chromium) + 88 public-render (untouched — the public
  dashboard has no scoring surface).
- **v3.74.1 — the bootstrap head leads with the output, never the blocker count (owner call:
  "the TT should ALWAYS give a score or output").** The shadow panel's unscored head read
  `UNSCORABLE · 13 blockers`, burying what the engine DOES know — the owner read it as the tool
  refusing to answer, and at the presentation level they were right. The refusal was only ever
  about the blended pillar SCORE (§14.7 forbids partial subtotals); every computable diagnostic
  may print, and now does: `scoreP1` stamps the contingent premium with its own `%/yr` and
  target year even when the prerequisite gate withholds the pillar, and the head renders
  `$382 2027 · +45.8%/yr contingent — prereq gate UNKNOWN · bootstrap 0/4 pillars` instead of a
  bare blocker count. Nothing about the abstention DOCTRINE moved: the blended score, tier and
  rank still require all four pillars; binaries still gate only the ELIGIBLE line and never the
  VALUATION GAP ranking (§11.1 — the ranking always renders, which is the owner's actual
  "always an output" contract, and it was never suspended). Tests: 1223 smoke (+2) + 199
  render (+1).
- **v5.6.9 — both ends of the dock loop, closed.** FEAT-DOCK opened a door; this finishes the
  frame at each end.
  **MACRO — `share_note` retired.** It was the one field the v5.6.8 entry named as an orphan:
  authored for the v3.97 public share strip, and the dock that replaced that strip carries the
  bare symbol by design, so nothing consumed it. Measured before removing it — **0 of the 9
  live S-tier entries carried one**, so no owner-authored text was destroyed. A `share_note`
  still stored on an entry is simply not published, which also narrows what the one PIN-free
  route here can emit (the safe direction for a public endpoint). The v3.97 assertion that
  pinned the note's *publication* is **reversed on its ABSENCE** rather than deleted — a
  retired field quietly reappearing in a public projection is the label-outlives-its-data
  defect with an exposure consequence.
  **TERMINAL — arrival focus.** The dock's promise is *"tap SYM, work it"*, and it was only
  half-true: `renderTabs` resets `TAB` to BOARD when the hash names a symbol with no stored
  payload. Safe (no broken tab) and **silent** — the name you tapped just vanished. `ARRIVED`
  now remembers what the hash asked for, and after the book lands `honourArrival()` resolves
  the three real cases: a payload opens its tab (**unchanged** — and it deliberately does NOT
  stack a card over the thesis the reader asked for), a book name with no payload opens its
  **CARD** — which v3.50 already calls *"the only surface a WATCH name with no tab ever gets"*
  — and a symbol absent from the book **says so** instead of dumping you on the board with no
  explanation. Fires ONCE per load (a later manual tab switch cannot re-trigger it), runs after
  the book is in memory so it survives the PIN gate (the v5.6.4 boot chain re-runs `loadBook`
  on login), and is silent when nothing arrived — a plain `/admin.html` visit is untouched.
  Tests: **2029 smoke** (+4: the retirement proven on a payload that CARRIES a note, the
  unwidened whitelist, fire-once/after-book wiring, and the never-stack + name-the-unknown
  rules; 2 v3.97 pins reversed with the reason recorded) + **290 render** (+6: all three
  arrival shapes driven live with a real hash — the harness `open()` gained an optional hash
  argument — plus the plain-visit control) + 192 public-render. Negative-controlled: unwiring
  `honourArrival` turns exactly the three arrival assertions red and leaves the payload-tab
  and plain-visit controls green.
- **FEAT-DOCK (v5.6.8) — the bottom strip becomes a DOOR INTO TERMINAL, not a mini-watchlist.**
  *Relabelled from v4.1.7 at merge (2026-08-21): main advanced 34 commits to v5.6.7 while this
  was in flight — the documented collision pattern, third time this session. `package.json` is
  the single source of truth. The merge also took main's canonical `dailyCall` path over this
  branch's `buildTtReadout` memo (see the gate note below).* Owner: *"the top TERMINAL is a mode switch, the bottom S-tier is a name list with no job —
  you want one surface that is both: these names live in Terminal, tap to work them."* Correct
  diagnosis: v3.97's `SharedPicks` chips were deliberately `<div>`s because they opened nothing
  (the CUT-row rule — a button that does nothing is a lie), which made the strip decoration on
  a page whose every other element earns its pixels. `TerminalDock` gives them a job, so they
  become real `<button>`s — **the v3.97 div rule reverses because the premise did**, and both
  states are still pinned so neither can regress silently.
  **The chip is a door and its label IS the symbol** — no quotes, no P&L, no scores (owner:
  *"that turns the dock into a second dashboard"*). Navigation reuses TT's EXISTING route and
  invents no router: `admin.html` reads `TAB` straight off `location.hash` at load, so a chip
  goes to `/admin.html#<sym>`. A symbol with no stored payload is safe by construction —
  `renderTabs` already falls back to BOARD when the hash names a sym with no dd entry — so a
  chip can never strand the reader on a broken tab.
  **The gate token is the moon voice, and it fails closed.** Owner call: `FULL → SEND IT ·
  RESTRICTED → EASY · HOLD → HANDS OFF`, matching the HODL/MOONING register. The SOURCE is
  **`dailyCall.actionability`** — the canonical md-call-v1 object main's v5.x line introduced,
  which the hero and the paste block already read and which respects the 10am freeze. (This
  branch originally derived it from its own `buildTtReadout` memo; main's object supersedes
  that and is strictly better — one call, one actionability, no second derivation.) The
  authoritative token rides the `title` so the machine value stays reachable. An **absent or unrecognised
  actionability renders `NO READ`, never a permissive default**: a gate that guesses green is
  the one defect this whole layer exists to prevent, and it is smoke-pinned by value.
  **⚠ The publicView gate is CLEANLINESS, NOT privacy, and that is stated rather than implied.**
  v3.97 deliberately rendered the strip on BOTH routes, reasoning that *"hiding it on
  ?view=public while the JSON is world-readable would be theater."* That reasoning still
  stands: `/api/picks` is unchanged and still public, and the dashboard has no auth — anyone
  visiting the bare URL gets the operator view. So the reversal buys a clean shared link and
  buys nothing else. Owner call 2026-08-21, taken with the limit named at the call site, in the
  section header and here — the endpoint was left alone on purpose.
  **One call, two consumers.** The gate reads the SAME `dailyCall` the hero renders and the
  clipboard formats, so the gate a chip sits under can never disagree with the call the page is
  making (the `ptModelRows` rule). No second derivation exists.
  `SharedPicks.jsx` is **deleted, not orphaned** (dead code is a rot vector — the v3.73 rule),
  and its absence is pinned. `share_note` is now unrendered: the note existed for the public
  share audience the dock no longer serves, so it stays in the endpoint's projection but has no
  consumer — named here rather than left as a silent orphan.
  **Deliberately NOT built (owner's own ordering):** next-dollar-vs-full-book as two rows, and
  retiring the header `⌁ TERMINAL` button — *"leave header TERMINAL alone until the dock is
  used for a week."*
  Tests: **1774 smoke** (+9: presentation-only, both render-nothing rules, buttons-with-a-job,
  the no-price sweep over the chip template, the fail-closed gate pinned BY VALUE, the shared
  readout, the reused hash route, and the deleted component) + 264 render + **176 public-render**
  (+5 net: the public route proven to render no dock/names/gate while the call still publishes,
  the operator dock with its gate token, a 40px thumb target, the chip label proven to be the
  bare symbol, and a REAL click asserted to land on `admin.html#aaa`). Negative-controlled both
  reversals: dropping the publicView gate turns the public assertion red, and defaulting the
  gate permissive turns the fail-closed pin red.
- **v5.6.7 — synthesized theses are MARKED, never mistaken for the owner's (owner call
  2026-08-27: *"auto synthesize theses and re-assert the circuit"*).** v5.6.6 measured that 34
  of 39 payloads carried no thesis line; the owner asked for them to be generated. A generated
  line is useful and is NOT an owner assertion, so `thesis_src`/`thesis_at` carry that
  provenance and `ddExec` renders a synthesized line with an amber **"synthesized <date> —
  owner to confirm"** chip instead of the neutral field name. Absent the marker a stored
  `thesis` still reads as owner-authored, which is what it has always meant.
  **KV-side (no repo content): 37 theses written, every clause traceable to a stored field.**
  The first draft of the synthesizer led with the payload's own prose and the preview killed
  it: for most names `pt_model.multiple_ruling` is PROCESS METADATA (*"FINALIZED per owner
  delegation"*, *"ASSISTANT-SET — OWNER TO CONFIRM"*), which as a thesis lead reads as *"the
  thesis is: we finalized the multiple."* The shipped shape leads with what is actually known
  — tier + lens + the model's own basis and its rationale — then gates (N/M PASS), then the
  live risk from red/amber hinge labels, and only then owner prose where it is genuinely
  thesis-shaped (`verdict.read`, labelled *"Latest read"*). Nothing invents business
  narrative. Two shapes found while writing and handled fail-closed: `gates` is an OBJECT on
  some payloads (BA) rather than an array, and ACHR's `0/4 PASS` is real (its statuses are
  UNEVIDENCED/FLAG/PARTIAL), not a parse artifact.
  **The circuit re-assert, and a FIX-A error I committed and the guard caught.** Re-asserted
  ARMED on today's post-NVDA pull — NAV $277,496 · gross $573,410 · debt $295,914 (106.6% of
  NAV) · BP $889 → **2.07x**, deteriorated from the 8/18 assertion (2.00x, 99.7%, BP $11,071
  on 8/26) — on the owner's standing 8/18 ruling that TRIPPED requires a margin call or
  forced liquidation. The first write stamped `2026-08-28` from the UTC-side date while the
  server's ET clock read 8/27, so `circuitState` returned **"dated in the future — cannot be
  judged" → UNRESOLVED**: the exact FIX-A trap the sync runbook warns about, committed by the
  assistant and caught by the fail-closed guard rather than by a human. Restamped from the
  server's own `business_date_et`; the gate moved **TOUCH GRASS → SEND IT** with NBIS eligible
  at +103.7%/yr. Also measured: `board` sits at **16,036 of its 16,384-byte cap** with
  `decisions` alone 9,019 bytes — the same growing-thing-inside-a-fixed-cap pattern already
  split three times (pos v3.34, ledger v3.32, deepDive v3.75), named here, not fixed.
  Tests: **2019 smoke** (+1: the synthesized-vs-owner provenance RUN — the marker sets
  `synth`, the amber owner-to-confirm chip renders, and an owner-authored line does not get
  it) + 284 render + 187 public-render.
- **v5.6.6 — the search bar routes to ANALYSIS, and the deep dive opens with an EXECUTIVE
  SUMMARY (owner call 2026-08-26: *"it should enter deep dive with executive summary of
  thesis, short term and long term price target then deeper dive"*).** The `TT:>` bar was a
  router into the two EDIT surfaces — Enter on an in-book name opened its card (tier/lens/
  note), not the analysis tab — so the fastest keystroke landed on the rarest act. Enter now
  opens the **deep dive**; the card stays one tap away via the tab's existing OPEN TT CARD
  button, so no path was removed, and the HELP copy moved WITH the behaviour (an instruction
  outliving its data is the defect this file keeps closing).
  **`ddExec()` leads the tab**, directly under the readiness gate: the thesis in words, then
  **SHORT TERM** (the earliest year-end the model prices) and **LONG TERM** (the deepest
  rung, with its annualised rate). Both come from the SAME `ptModelRows()` the board ranks
  on — the ptModelRows rule — so the summary can never quote a number the ladder below it
  disagrees with, and each states its own year rather than inventing a 12-month target to
  fill a slot. A single-rung model prints ONE cell (`Target (single rung)`): one rung is one
  fact, and printing it twice as a near and a far target would manufacture a second data
  point out of the same number. No model says so and carries the payload's own note.
  **The thesis is never invented.** Measured across the live book first: only **2 of 39**
  payloads carry a `thesis` string, 3 carry `verdict.read` (an object), and NBIS carries
  `valuation_note` — so `ddThesisLine()` resolves those three shapes by priority, NAMES which
  field it came from and its date, and when none exists says *"no thesis line stored — the
  gates, hinges and ladder below are what this book actually asserts"* with the field that
  would fill it. Inferring a thesis from the tier or the lens would be exactly the
  fabrication this renderer forbids everywhere else — and the absence is itself information:
  34 of 39 names have no thesis line.
  Found while testing: the `n/m` branch in the target cell is **unreachable** — the numeric
  row filter (inherited from `ddWorth`) drops a rung whose only value is that sentinel — so
  the pin asserts the EXCLUSION that actually holds rather than dressing a defensive guard as
  reachable behaviour (the vacuous-assert rule). Also re-pinned: the deep-dive ordering pin
  measured a fixed 400-character window between `readyBar` and `ddAnswerBlock` and tipped
  over on the first legitimate insertion — it now asserts the ORDER itself, which is what
  "readiness leads" actually means.
  Tests: **2018 smoke** (+7: `ddExec`/`ddThesisLine` lifted and RUN — near/far from one row
  set, the single-rung case, no-model, floor labelling, the n/m exclusion, all three thesis
  shapes by priority and the named absence; plus the search route and the HELP-copy sweep) +
  **284 render** (+4: the exec summary driven live above the four answers, the named absence,
  and a REAL search keystroke proving Enter lands on the deep dive with no card modal open).
  Negative-controlled twice — reverting the search route and unwiring `ddExec` each turn
  exactly their own pin.
- **v5.6.5 — the disclosures go one tap deep, and the v3.25 rule moves altitude rather than
  bending (owner call 2026-08-26: *"hide all the bla bla text under an expandable header
  stating disclaimer … same in fund/trim … same for circuit-unresolved and the binaries info
  under the TOUCH GRASS gate"*).** Two surfaces, both measured before and after.
  **The receipt chip**: `allocChip()` was emitting the state plus five wrapped lines — the
  not-a-cash-claim qualifier, the receipt age, the measured account, and the four-part basis
  line — on BOTH decision surfaces (it is one builder, so the BUY block and FUND/TRIM shared
  the wall). Those are **constants of the state, not facts about today's decision**: they now
  ride `allocDisclose()`, one `details.est-mini` labelled *"what this claims — basis, account,
  disclaimers"*. What stays on the face is the STATE and only the ⚠ that gate action — a
  non-live price basis and a receipt that is not today's — with the warn COUNT on the closed
  summary.
  **The stance strip**: under a restrictive gate it was five wrapped rows (gate · verdict ·
  circuit qualifier · four red badges · controls) for a board whose whole message is the two
  tokens on row one. The qualifiers and badges move into ONE counted expander.
  **The v3.25 rule is not weakened — it is applied at the altitude that fits each state.** On
  a PERMISSIVE board the badges are the only warning present, so they stay on the face,
  untouched. On a RESTRICTIVE board the verdict token already states the restriction, so the
  reds collapse behind a summary carrying **their count and their colour** (red if any badge
  or qualifier is red, amber otherwise): a collapse may hide a red fact's DETAIL, never that
  one exists. Every badge keeps its drawer deep-link, and the render suite proves both halves
  — the count while closed, every badge verbatim one tap deep.
  **Measured: the restrictive top row 178px → 86px**, so the budget RAISED at v5.6.0 comes
  back down with the win — re-pinned 185 → **120** with the measurement, because a budget that
  no longer binds is not a guard. Found while re-pinning: the summary is uppercased by CSS, so
  `innerText` reads "⚠ 4 FLAGS" (the v3.69 text-transform lesson, third recurrence) — the pins
  are case-insensitive, and the `details.why div` locator is scoped to the prose div now that
  the expander nests a chip row above it.
  Tests: **2011 smoke** + **280 render** (+2 net: the closed-state signal and the one-tap
  verbatim reveal at both altitudes, plus the alloc face proven CLEAN of the disclaimers).
- **v5.6.4 — the boot chain becomes RESUMABLE, and a failed read stops claiming the store is
  empty (owner screenshot, 2026-08-26 10:24 ET).** The board rendered 50 book names every one
  of which read *"no thesis payload stored · TT —"*, with no next-dollar target, no scores and
  no server receipt. Measured before touching anything: the server was **healthy** — book 50,
  dd index **39 entries**, score index **35**, allocation receipt ALLOCATABLE. So the data was
  there and the browser could not see it.
  **The mechanism:** the boot chain was `loadBook().then(()=>{loadQuotes();loadPositions();
  loadAllocation();loadDeepDiveIndex();loadTickerV2();loadScoreIndex();})` — a fan-out — while
  the PIN gate resumes only `PIN_CB`, which `loadBook` sets to **itself**. On a session
  expiry every secondary load fires BEFORE a session exists, 401s, is swallowed by its own
  catch, and is **never retried**: entering the PIN reloads the book and nothing else, so the
  board sits permanently half-loaded until a manual refresh. The chain is now ONE named list
  (`bootLoads` = `loadBook` then `secondaryLoads`), both gate paths point at it, and a
  successful login **always** re-runs `secondaryLoads()` whatever the interrupted action was —
  so a mid-edit login (`PIN_CB=persist`) can no longer resume the edit onto an empty board.
  **The honesty half, which is the worse defect:** *"no thesis payload stored"* is a claim
  about the STORE, made by code that never read the store — the v3.54 class ("not counted" vs
  "counted, no lean"), one layer over. A failed index now sets `DD_FAILED` and the row reads
  **"payload index did not load — not read, not empty"** with *"⟲ RELOAD — the store was never
  read"* as the fix; a null score index reads **"score index did not load — not read, not
  unscored"** rather than *"no server card — unscored"*. Two false negatives that would have
  sent the owner re-entering data that was already there.
  Found while fixing: the two smoke pins guarding this chain pinned the **literal `.then()`
  spelling** — the exact shape that caused the defect — so they would have passed through any
  correct rewrite and failed on it; both are re-pinned on the behaviour. Two source lifts
  needed `DD_FAILED` passed BY VALUE (the v3.47 `LENS_MAX_PE` lesson, third recurrence).
  Tests: **2011 smoke** (+4) + 278 render, negative-controlled twice — reverting the gate to
  `loadBook` and letting a failed index claim "not stored" each turn exactly their own pin.
- **v5.6.3 — the gate vocabulary reaches the docs, and is RECONCILED so it cannot fork
  (owner review 2026-08-26).** The review's one code-adjacent finding, verified before
  fixing: `ticker-terminal/README.md:37` still read *"only explicit `FULL` passes"* — the
  Engine 0 machine vocabulary presented as the only vocabulary, three releases after the
  product UI moved to SEND IT / HODL / TOUCH GRASS, and no doc outside this file named the
  product words at all. That is the label-outliving-its-data defect at the doc altitude, and
  the two vocabularies forking is exactly what the `GATE:` scoping rule exists to prevent one
  layer up. Both docs now state BOTH: the README names the product gate, the alias mapping
  (SEND IT = `FULL` · HODL = `RESTRICTED` · TOUCH GRASS = `HOLD` + every unreadable state) and
  keeps its fail-closed sentence intact; CLAUDE.md gains **standing lock lines** in the
  locked-decisions section (the sprint doc's §11 ask) rather than leaving the rule only in a
  changelog entry that scrolls away.
  **The cure is the pin, not the prose** (v3.59 B5, v3.60.1 §5: a doc rule nothing enforces is
  the rot vector). The gate set is derived **BEHAVIORALLY** — `macroGateFrom` run over the
  same matrix the mirror pins use — and reconciled against both docs, so adding, renaming or
  dropping a gate state fails the build instead of silently forking the docs again; the
  machine-alias framing is pinned, and the **withdrawn claim is pinned ABSENT** (a retired
  instruction quietly reappearing is the v3.85 precedent). Tests: **2007 smoke** (+3),
  negative-controlled — restoring the old README sentence turns exactly those three red.
- **v5.6.2 — the quote cross-check: the third candle rung (owner call).** The v5.6.1 tells
  are structural — a gap or a jump INSIDE the series — and are blind to the one case where
  EVERY window returns the wrong instrument: internally consistent, contiguous, no jump.
  The outside reference is the **same-refresh live quote** (fetched in the same pass, same
  symbol, currency-gated): `candleSeriesFault(rows, refPx)` rejects a merge whose tail
  close sits **>3x** from it — the SAME constant as the adjacent tell, one doctrine, chosen
  over the 40% first floated because a real print gap runs 30-50% and must PASS; a 3x
  quote-vs-tail split happens only between two instruments. No quote = the rung is SKIPPED,
  never guessed. Wired at both ingestion builders (refPx from the refresh's own LIVE quote)
  and at the outcome reader (a fresh batch read for the pick syms). Tests: **2004 smoke**
  (+5: the all-windows-junk rejection at ingestion AND at read, the exact 3x boundary both
  directions, the no-quote skip, the wiring pin), negative-controlled — removing the rung
  turns exactly its 3 pins red.
- **v5.6.1 — the candle-continuity guard: the outcome layer's first live catch, closed the
  night it was found.** Minutes after v5.6.0 deployed, the very first stamped outcome
  anchored NBIS at **$7.62 — on a $277 stock.** Two defects compounded: the outcome reader
  dropped the `:v1` suffix ticker-facts keys have always carried (and the smoke fixture
  used the same wrong key — a fixture agreeing with the bug; both fixed, the fixture now
  pins the real shape), and once the right key was read, the STORED series itself was
  corrupt: the v3.98 Nasdaq multi-window merge had flattened a failed middle window into a
  **6-month interior hole** with the tail window carrying **another instrument's prints**
  ($104.88 → $7.78 across adjacent rows), stored as LIVE. Census across the whole facts
  store: 36 clean, NBIS the only contamination; the 8/24 PA stamps were verified sane
  (levels consistent with the real tape), so the tape axis was never poisoned — the blast
  radius was one stored series and the outcome anchor it fed. **`candleSeriesFault()`**
  (`functions/lib/tt-facts.js`) is the BANDS doctrine pointed at candles — two structural
  tells, either one damning for a daily series claiming to be one instrument: an interior
  calendar gap wider than any holiday run (>14d — the windows must TILE), or an
  adjacent-close jump (>3x) no split-adjusted series produces. Enforced at BOTH ingestion
  builders (Finnhub + Nasdaq → MISSING with the fault NAMED) **and again at the outcome
  reader**, because merge-only last-good semantics can keep an already-stored corrupt
  series alive as STALE — defense in depth, each layer naming what it refused. Tests:
  **1999 smoke** (+3: both guard tells executed on the exact live corruption shape, the
  read-side rejection through the real endpoint; 2 fixtures re-pinned to the tiling
  contract with reasons) + 278 render + 187 public-render.
- **v5.6.0 "THE DAILY CONTRACT" — the sprint doc's four-question surface, mapped onto the
  machinery that already existed (owner sprint doc `TT_DOUBLE_DOWN_BUILD.md`, 2026-08-26;
  plan reviewed, corrected and approved same day).** The doc's diagnosis was right — the
  pieces existed, the daily contract didn't force them into one surface — and its central
  moat claim sharpened into the build's spine: the CLOSED LOOP (pre-committed belief →
  stamped decision → measured outcome) is the one structure Robinhood/TipRanks/SA cannot
  copy, and this release closes leg 3. Five pieces:
  **(1) The product macro gate — SEND IT | HODL | TOUCH GRASS.** `macroGateFrom()` is ONE
  projection of `allocGateLadder`'s own RESULT (the verdictFrom rule), so the word can never
  disagree with the veto it names: SEND_IT = the ladder read clean; HODL = the one
  looking-session state (actionability RESTRICTED — readable, ranking fully usable, still
  vetoed: **fail-closed doctrine untouched, owner ruling**); TOUCH_GRASS = everything else
  (HOLD, unreadable feed/flip, tripped/unresolved circuit). The doc's own alias table was
  corrected against the real contract (there is no "blocked" state; RESTRICTED existed and
  was the missing middle). The client mirror (`macroGate()`, buildless-copy convention) is
  proven against the server over one fixture matrix, and the strip leads with the token in
  BOTH stance branches — full-weight on a permissive board (where ADDS-OK + HODL is exactly
  the combination that must be unmissable), compact on a restrictive one (where the vbadge
  already says it — the v3.61 duplication rule). **The `GATE:` prefix is load-bearing**: the
  public call's middle is ALSO the word HODL (md-call-v1), and one word carrying two verdicts
  on one screen is the v3.51/v3.62 defect. The tt-v1 machine contract is untouched and
  smoke-pinned free of the product vocabulary. The stance-budget pin moved 140→185 WITH the
  measurement (178px: the gate is the contract's first line and earns one packing row).
  **(2) The receipt extension (tt-alloc-v3.1.0, additive).** The sprint's proposed
  `tt-rank-receipt-v1` duplicated ~80% of the existing allocation receipt and was REJECTED
  for the extend-don't-twin path (owner ruling): `tt-alloc-receipt` gains `macro_gate`, the
  bound public `call` (only when `effective_date` is genuinely the receipt's business date —
  never yesterday's headline on today's receipt), per-row belief/street `spread` for the
  decision set, and the `overtake` flip line.
  **(3) Belief-vs-street, formula FROZEN:** `(belief − street) / live price × 100`, sign
  buckets You richer / Street richer / Aligned on an asserted ±10 deadband
  (`SPREAD_ALIGNED_PCT`, the NFCI convention, boundaries executed). The belief leg is the
  row's OWN ladder target (never recomputed); the street leg follows the v4.2 target
  priority — a REVIEWED packet's published average outranks a stored assistant-sourced
  `consensus.street_target`, both LABELED, neither = null-honest ("street unreviewed"),
  since the street store is measured EMPTY at ship. `spreadLine()` is one builder at two
  altitudes (DESK eligible box + compact BUY banner). **The flip line** — "#2 overtakes #1
  at $X" — inverts the ranking's own annualise from the leader row's (up, ann) pair
  (yrs = ln(1+up)/ln(1+ann), no second year-end clock; §P.4), proven by the identity that
  two identical rows cross exactly at the current price.
  **(4) The ATTEST layer — the stamp, and outcomes that only score commitment.**
  `POST /api/allocation?attest=1` marks TODAY's receipt as the owner's stamped ranked set:
  first-write-wins per ET day, a second attest 409s toward the standing stamp (immutable),
  a prior-business-date receipt refuses with the date named. Receipts still persist on
  every reeval, but **only attested days join the stamped history that outcomes score** —
  a passive ⟳ never accrues a score it was never committed to, and there is NO auto-stamp
  anywhere. `GET ?stamped=1` computes outcomes AT READ (GET stays safe, v3.54 — no cron, no
  write-on-read): day 0 = first official close ON OR AFTER the stamp date (the shipped v5.5
  public pattern, `maxDrawdownPct` IMPORTED from publicHistory — one implementation),
  1d/5d/20d + drawdown-so-far from the facts store's candles, a missing history a NAMED
  reason. `allocation_changed` is DERIVED from the intent journal (an intent that day = the
  list moved real allocation) with an explicit `?outcome=1` owner override + note. Client:
  a two-step ⭑ STAMP link (the v3.42 destructive-link rule) under the BUY block with three
  honest states (link / stamped ✓ / withheld-with-date), and a lazy stamped-history
  est-mini at the block tail. This closes the outcome-evaluation deferral v3.74 filed
  ("wait until decision events exist") — they exist now.
  **(5) Found while building, both caught by the new tests:** the intent-date derivation
  truncated ISO instants at their first colon (an intent key's timestamp contains colons),
  so `allocation_changed` derived no date at all — fixed to last-colon parsing; and the
  smoke [44] gateFail lift was hijacked twice, first by `macroGate()` reusing its anchor
  spelling and then by my own comment NAMING the anchor spelling (the v3.60.1
  self-matching trap, recorded verbatim in the site comment).
  **Reconciliation note (Step 0):** v5.3.0/v5.5.0 shipped from parallel sessions with no
  changelog entries — recorded here so no phantom versions are inferred: v5.3.0 "One Call +
  public accountability" (md-call-v1 in `src/macroCall.js`, the `/history` + `/difference`
  public pages, `functions/history.json.js`, the 10:00 ET `captureDailyCall` cron);
  d8a6003 repaired Why-This-Call accountability; v5.5.0 added the public outcome layer
  (`src/publicHistory.js`: frozen-call vs outcome keys, day-0 anchor, SPY 1d/5d/20d +
  drawdown) — the exact pattern this release's TT outcomes mirror.
  **Deliberately NOT in this release (owner rulings):** reverse DCF (cut — the doc's own
  "if it can't stay thin" rule); any change to `tt-v1`, the band tables, or canonical
  winner selection; street entering next-dollar ordering; new public surfaces.
  Tests: **1996 smoke** (+28: the gate matrix EXECUTED against the real ladder with the
  client mirror run over the same fixtures, SEND_IT-iff-clean, the frozen formula + exact
  deadband edges, street-leg priority, the day-0 anchor + named-reason paths, the
  drawdown-import pin, receipt fields end-to-end incl. the call-date binding and the
  overtake identity, the full attest lifecycle through the real endpoint, and the
  scoping/two-step/one-builder/tt-v1-clean client pins) + **278 render** (+7: both gate
  states driven live, the spread at both altitudes with the labeled sourced leg, the
  street-unreviewed statement, the flip line, and the stamp's three states) + 187
  public-render + `audit:prod` clean. Negative-controlled four ways — collapsing HODL,
  widening the deadband, inverting the street priority, and removing the attest 409 —
  each turning exactly its own pins.
- **v5.2.0 "CAP-ASTERISK" — the cap demotes to an asterisk, and the funding queue ranks on
  MERIT (owner ruling 2026-08-25, verbatim: *"I'm not adhering to the allocation cap. Can we
  just keep it as an asterisk and rank sells by pure technicals, pt, and scores"*).** Two
  documented owner REVERSALS, recorded the way v3.92/v4.0.0 recorded theirs, plus one scope
  revision — none of them silent:
  **(1) RANKFAIR v3.36's buy-side cap veto is REVERSED.** `whyNot()` (server) and `why(r)`
  (client) drop the cap rung entirely; an at/over-cap name can take ELIGIBLE NEXT DOLLAR.
  The asterisk survives exactly where the veto used to fire: the eligible row carries
  `over the 18% REFERENCE cap (asterisk, not a veto — owner ruling 2026-08-25)` as a caution
  (server receipt) and an amber chip ON the green line itself (client) — chosen with eyes
  open, never silently. TODAY cap items downgrade sev stop→warn with the same
  "reference cap (informational)" copy; the sub names the asterisk and keeps the honest
  denominator line.
  **(2) SELLRANK v3.38's forced cap tier is REVERSED.** The five owner-locked funding tiers
  collapse to TWO: tier 1 (owner-marked forced exits · the cut list · server-stamped
  BROKEN_THESIS — decisions already made, not rankings) still ranks first; everything else
  is ONE merit pool, lexicographic in the owner's stated axis order — **tape (techRead
  label, BEARISH first; MIXED/UNREAD/no-read all middle, since an unmeasured tape is never
  a judgment in either direction) → lowest %/yr → lowest TT card score**, size the final
  tie-break. Axes stay lexicographic, never blended into a unit (DEC-D2). Over-cap, cluster
  and session-order stop being tiers and become FLAGS on the row — the over-cap row keeps
  the forced row's exact trimPts/`≈ $N to cap` arithmetic as an informational chip, so
  nothing the old tier said is lost, it just stops enforcing. No-rate share rows and
  measured options rows now rank IN the list (`no %/yr` / dollars-basis primaries — exiling
  them re-created the v3.44 exclusion one bucket over); the ⛔ TRIM render block and the
  cap-contradiction line died with the tier they described (dead code is a rot vector,
  v3.73). The closed FUND/TRIM tab count becomes `N ⚠cap` — still red, still v3.25-visible,
  still never auto-opens.
  **(3) The v3.83 married-never-merged scope is REVISED for one surface.** `sellRank`
  (client) and `fundingRanking` (server, via a `techBySym` computed in `evaluateAllocation`
  so the pure module stays pure) now READ the techRead verdict — through `techOf()`/the real
  `computeTechRead`, the one resolution point, so a funding row and the name's own band
  table can never disagree. The ban survives everywhere it still applies: the BUY sort,
  `gateFail` and `why()` remain pinned clean. The old "sellRank never reads it" smoke pin is
  formally reversed with the ruling documented at the pin.
  `ALLOC_RULE_VERSION` → **tt-alloc-v3.0.0** (receipt semantics changed on both sides — a
  cached v2.x receipt must not be reinterpreted under the merit rule; the v4.1.4 precedent,
  fourth application), and the receipt carries a `basis` string stating the merit order so
  the persisted record explains its own sort.
  **Found while building: a vacuous pin and a self-inflicted regression.** The old
  "forced trims rank before every discretionary" pin went vacuous the moment `forced.sort`
  was deleted (indexOf −1 < anything — the v3.60.1 trap) and was rewritten as explicit
  absence assertions; and a `git checkout` used to revert a negative control DISCARDED the
  uncommitted server edits mid-build — reconstructed from the session's own captured reads,
  re-verified green, and the remaining controls re-run against backup copies instead.
  Tests: **1948 smoke** (+10 net: the whyNot-null-at-18-and-17.9 flip, the asterisk-caution
  proof, the two-tier collapse, the over-cap FLAG, the server merit sort RUN against a
  four-name fixture — BEARISH first despite the best %/yr, score breaking the tie, BULLISH
  last despite the worst return — the client sort's identical fixture, and the reversed
  tech/sellRank pin) + **271 render** (10 re-pinned: TODAY warn copy, the merit sell rows
  with the informational chip, computed-first now BBB by merit, the capped scenario flipped
  to prove the pick STANDS with the asterisk chip on the green line, `N ⚠cap`, and the
  5-visible/11-ranked tail). Negative-controlled three ways — restoring the cap veto (2 red),
  dropping the tape axis server-side (1 red) and client-side (1 red) — each turning exactly
  its own pins.
- **v5.1.1 — the card's own actionability, finally READ at the gate.** Found live minutes
  after the v5.1.0 deploy cleared Engine 0: TSM re-scored **SCORED 9.0/S** and immediately took
  the ELIGIBLE NEXT DOLLAR line at +31.7%/yr — while its own card read
  **`actionability: BLOCKED`** on `BLOCKED_PENDING_INPUT:AI_G2_CIRCULARITY`. §7's
  `actionabilityRollup` computed that state, §11.2 `evalEligibility` has always refused
  anything but FULL/CAUTION, and the deep-dive panel rendered it — but the ladder that
  actually gates capital never asked. Verified by grep before the fix: **zero** reads of card
  actionability in either `whyNot()` (server) or `why(r)` (client), and `cardInfo()` did not
  even carry the field; the only `actionability` references were Engine 0's *regime* axis.
  **This is the v3.71-follow-up defect shape, one layer over** — state computed, published,
  rendered, and not read where it gates capital — and it bit on the highest-consequence
  surface in the book. The gate it hid mattered specifically: **AI_G2 is the CIRCULARITY
  gate** (vendor equity stake, customer concentration), the live thesis risk in an AI-infra
  book, unevaluated on the name being proposed for the next dollar.
  `updateIndex` now carries **`actionability`** + **`blocked_on`** (the gate ids parsed out of
  the `BLOCKED_PENDING_INPUT:` blockers — "BLOCKED" without the gate is a state, not an
  action), and both ladders gain a rung **ahead of the quality rung**, because an unreadable
  gate is not a quality verdict. **CAUTION passes** and is surfaced as a row caution — aging
  evidence is the owner's to weigh, missing evidence is not (the `readiness()` rule). An
  **ABSENT** field passes: a pre-v5.1.1 index entry simply predates it, and failing closed
  there would veto the whole book over a value nobody had written yet — an outage dressed as
  a safety rule (the v5.0.1 `p4` precedent; re-scoring populates it).
  `ALLOC_RULE_VERSION` → **`tt-alloc-v2.1.0`**: a v2.0.0 receipt could name a name eligible
  whose card read BLOCKED, so a cached one must not be reinterpreted under this rule (the
  v4.1.4 precedent, third application).
  **Stated consequence, predicted before shipping and confirmed after:** TSM, LITE, SNDK and
  JOBY all carry `BLOCKED_PENDING_INPUT`, so the green line goes dark until those gates get
  their inputs. That is the methodology's own answer (`gatePrecedence`: "UNKNOWN blocks") — the
  ladder had simply been overriding it.
  Tests: **1946 smoke** (+8: the truth table RUN through the real evaluator — BLOCKED vetoes
  and names the gate, BLOCKED-with-no-gate still vetoes, FULL passes as the control, CAUTION
  passes AND surfaces, ABSENT passes, rung ordering asserted by source position, the admin
  mirror on both cardInfo paths, and the version bump; 1 pre-existing pin re-pinned with the
  reason) + 271 render + 171 public-render + `audit:prod` clean. Negative-controlled: removing
  the rung turns exactly its two behavioural pins red.
- **FEAT-VIX-FAILSAFE (v5.1.0) — the crash gauge gets the second source the 10Y already had.**
  Diagnosed live: at 2026-08-24 01:05 ET every Engine 0 check was CURRENT except VIX, which
  sat on Thursday 08-20 (16.01) with no Friday 08-21 observation — a ~57-hour gap on a DAILY
  series. A forced `POST /api/snapshot/refresh` refetched upstream and still got 08-20, so it
  was not transient. `ttReadout.js:398` holds **HOLD** on `!isCur(vix)` and the v3.40 rule
  withholds TAILWIND whenever the panic override cannot fire, so **the entire order-gating
  engine was halted by one lagging series** — and `available/usable` were 5/5 with `raw_verdict:
  TAILWIND` underneath. Measured precisely: `fed_next_meeting` (Kalshi, dark) is NOT critical,
  so it never blocked FULL; VIX was the **sole** binding constraint, one input from
  `current` 4→5 → HIGH → FULL.
  **The asymmetry this closes.** v4.1.5 gave the 10Y an official-upstream failsafe for exactly
  this per-series publication lag — its own comment records the mirror-image incident (DGS10
  two sessions behind while VIXCLS had already published). The fix was built on one side only,
  and the side left bare was the **crash gauge**: the one input whose absence stops everything
  had a single point of failure while a less safety-critical series had a backup.
  **The ladder (owner-specified):** CBOE **delayed-quote JSON** for the level (~1KB, keyless)
  + CBOE **daily history CSV** for the as-of and the derived series, fetched CONCURRENTLY —
  one round trip, and only on a day the leg is already dead or ≥1 session behind (a healthy
  day costs nothing). CBOE *publishes* VIX and FRED's VIXCLS is its republication, so the
  level is equivalent by construction — the same UST↔DGS10 relationship, never a proxy.
  **Two honesty guards, both negative-controlled.** (1) **`pairCboeVix` pairs the two rungs
  only when they describe the SAME session** — pairing a level from session N with a date from
  session N-1 is a fabricated observation, so on a date mismatch the DAILY FILE WINS OUTRIGHT
  (a true close beats a fresher intraday print; the bands, sparkline and WoW window are all
  close-calibrated). This is the `pairRs` rule, one metric over. (2) **A same-day delayed quote
  with no daily file behind it is REFUSED** — mid-session it is an INTRADAY print, i.e. a
  PROXY, and ENGINE0-CONT's vocabulary exists precisely so nothing silently emits one through
  the original metric's bands. Both guards were reverted in test: each turns exactly its own
  pin red.
  **Attribution is never IMPLIED** (the owner's rule, and the 10Y's own gap): every rung names
  itself — `CBOE delayed + CBOE daily` · `CBOE daily` · `CBOE delayed` · **`FRED VIXCLS`**, the
  last added so a FRED-served leg is labelled rather than left to be inferred from silence.
  **`mergeFresherLeg` is EXTRACTED, not copied**: "newer wins, a TIE keeps the incumbent, the
  leg is replaced WHOLE" is one rule, and both failsafes now call it. Whole-leg replacement is
  load-bearing — a mixed leg would pair a fallback's level with the incumbent's deltas and
  sparkline, a series dated by neither source. The band `[1,150]` still applies to a fallback
  value (the failsafe is not a bypass), and FRED keeps its REAL observation date, so a carried
  value still classifies HISTORICAL honestly rather than being dressed as CURRENT.
  **Honest limit, same posture as v3.71/v4.1.5:** `cdn.cboe.com` is 403 from this build
  environment's proxy (as are `home.treasury.gov` and `fred.stlouisfed.org`), so the endpoints
  could not be exercised here. Both parsers are fail-closed and fixture-tested, the pairing and
  merge are pure and EXECUTED, and the first real call from the Pages edge is the true schema
  check. `live.vixSource` is readable on `/api/snapshot` without a debug token, so the deployed
  answer to *"does CBOE answer from the worker, or is it Stooq-class blocked?"* is one GET.
  Deliberately NOT built pending that answer: the Finnhub `^VIX` and Yahoo v8 rungs — building
  two more upstreams before knowing whether the first one answers would be speculative.
  Tests: **1938 smoke** (+30: both parsers incl. header/date-form variants and every
  fail-closed path, the WoW window proven to be fetchFred's own and not the 1-day, the
  pairing truth table, the intraday refusal, whole-leg replacement, recency both directions,
  the closed attribution set, band enforcement, and wiring pinned in both directions) + 271
  render + 171 public-render + `audit:prod` clean. Four negative controls run: neutering the
  merge (4 red), reverting the trigger to failure-only (1 red), and removing each pairing
  guard (1 red apiece).
- **v5.0.2 — the chrome above NEXT $ IN, measured and trimmed.** Owner feedback on a live
  phone screenshot ("reduce empty space where able"). Measured first rather than guessed
  (the project's own convention): a Playwright probe against the real `admin.html`, served
  through the render harness's own stub server, at 390×844. Five stacked container margins
  — `header` → `.cmd` → `.panel`'s top padding → `#tabBar` → `.stance-strip` → `.decision-tabs`
  — compounded to push `#decisionDeck` (the NEXT $ IN / FUND-TRIM content) down to y=448
  before a single number rendered. None of it was protecting a touch target: every
  deliberate 40px/42px/44px `min-height` (stance badges, tab-strip tabs, decision-tabs
  buttons, driver rows) lives inside the buttons themselves and was untouched. Trimmed the
  five container margins/paddings by 2px each (`header` 10→8 · `.cmd` 12→8 · `.panel`
  vertical padding 12→10 · `#tabBar` 10→8 · `.stance-strip` padding 6→5 + margin 8→6 ·
  `.decision-tabs` padding 3→2 + margin 8→6) — **measured after: `#decisionDeck` at
  y=428, −20px**, with the whole page 22px shorter. Verified by reproduction, not
  inspection: the same probe re-run post-edit confirms the exact arithmetic (each trim's
  effect on the next element's `top` matches its declared change, accounting for adjacent-
  sibling margin collapse where it applies). Content-only, no version-gated contract moved
  — `npm run gates` unchanged at 1908 smoke + 271 render + 171 public-render, audit clean.
- **v5.0.1 — the PROVISIONAL veto names WHICH half of §6.4.1 is missing.** An owner-passed
  review of the B-cap found the v5.0.0 veto string over-claiming, and a read-only census of
  all 33 live score records proved it: `falsifiers pending — score capped at B until they're
  committed` was FALSE for TSM (6 server-stamped hinges, committed 8/05 — what's missing is
  observations, not commitment) and CELH (6 committed, 1 observed). "Unwritten" and
  "committed, awaiting observations" are different owner actions — write vs wait — and one
  string covered both with the wrong verb. **The census also settled the review's engine
  proposal**: it suggested min-3-observed scoring in `scoreP4` (pending extras as warnings
  instead of one unobserved hinge nulling the pillar, `ttScore.js:527-529`) *if* any name had
  ≥3 observed hinges hostaged by pending extras — measured: **that bucket is EMPTY** (21 of 23
  PROVISIONAL names have <3 hinges written, TSM/CELH have <3 observed), so the engine change
  is deliberately NOT built; it becomes an owner methodology call if a filing pass ever makes
  the bucket real. Two review claims corrected in the same pass: its "the live line still
  reads the asserted composite" was written against the pre-v5.0.0 head (both `why(r)` and
  `whyNot` read cards since yesterday's activation), and the cure IS two server writes
  (`commitFingerprint` holds the first write PRECOMMITTED_PENDING; the composed-lifecycle
  test is the proof) — stated now rather than implied away. The fix: `updateIndex` gains an
  additive **`p4: {kind, hinges, observed}`** summary (scoreP4's own observed predicate, the
  card's own bootstrap kind), `cardInfo` carries it at both altitudes, and both veto mirrors
  split four ways — `falsifiers unwritten` · `N/3 written — set incomplete` (the CRDO shape) ·
  `committed, N/M observed — awaiting qualifying observations` (the TSM shape) · `committed
  this write — a later write scores them (§6.4.1)` — every branch still a veto, PROVISIONAL
  still never eligible. A pre-v5.0.1 index entry (no `p4`) reads the neutral `falsifiers
  pending`, claiming neither half. No `ALLOC_RULE_VERSION` bump: eligibility semantics are
  unchanged, only the reason text gained precision (the FIX-C relabel precedent, not the
  v4.1.4 one). Tests: **+7 smoke** (the four-way truth table run through the real evaluator,
  the every-branch-vetoes sweep, the retired clause pinned ABSENT from both mirrors
  comment-stripped, the index p4 on both endpoint fixtures incl. the composed lifecycle's
  committed counts, the admin mirror pin).
- **v5.0.0 "THE CARD GOVERNS" — §14.8 activation, one freshness doctrine, the KV fix, and the
  FINANCIALS mode.** The V5 system audit's ranked scope, built as one release under three owner
  rulings (2026-08-23): **flip SCORED-only** · **stay on the KV free tier and fix the cause** ·
  **include the FINANCIALS P3 mode**. Five workstreams:
  **W0 — the quote cache stops burning the KV budget.** The 1000-deletes/day free-tier cap blew
  mid-session because `/api/quotes` wrote ONE KEY PER SYMBOL (120s TTL) and the terminal quotes
  the whole book on every load — ~40 writes + ~40 expirations per cold refresh, ~25 refreshes =
  the cap (whether Cloudflare bills TTL expiry as deletes is a platform semantic the repo cannot
  settle; this was the only 1000/day-magnitude path either way, and it pressed the write cap
  identically). **`functions/lib/quote-cache.js`** is the one home now: a single merge-on-write
  batch key (`tt:quote:batch:v1`) collapses a cold refresh to **1 write + 1 expiry** — and the
  stated 2-minute freshness contract DID NOT MOVE, it lives on each entry's own `at` stamp
  (`freshEntry`, fail-closed), because merge-on-write refreshes the key and key presence would
  otherwise prove nothing. Both other readers moved with the shape (`tt.js`'s ledger px stamp —
  now ONE batch read per append — and `allocation.js`'s liveQuotes); smoke [72] runs the op
  counts behaviorally (cold=1 put · warm=0 · merge preserves untouched symbols · a 10-minute-old
  entry in a fresh key is a MISS).
  **W1 — §14.8 ACTIVATED: the server card governs the board (SCORED-only).** The shadow period
  ends. The eligible line's quality rung, the ranking chips, the tail sort and `rankCategories`
  all read SERVER CARDS via **`cardInfo()`** (one resolution point — a loaded per-sym record
  wins over the boot-time index); the board loads `GET /api/score?book=1` at boot — **the
  endpoint that existed unused since v3.73**. Only a card with `status SCORED`, minted under
  the CURRENT methodology, may light the line; PROVISIONAL ranks B-capped and is vetoed
  *"falsifiers pending — score capped at B until they're committed"*; no card reads *"no server
  card — unscored"*. The **methodology-relabel hole is closed at BOTH altitudes**: the per-sym
  GET always relabelled a stale-methodology card LEGACY_UNVERIFIED but the `book=1` index path
  never could — index entries now carry `methodology_version` (additive, `updateIndex`) and a
  mismatch can rank but never light the line. **"WAIT — methods disagree" is retired** — the
  wait existed because two live methods shared one board; disagreement is HISTORY now, stated
  beside the legacy composite inside the collapsed details ("history, not a wait"), and the
  legacy label reads *superseded at §14.8 activation*. **Server side, the activation switch is
  the smoke pin itself**: [68]'s "no `tt:score` reference in alloc code" bar is deliberately
  REPLACED by its inverse — `allocation.js` reads the score index and hands it to the pure lib
  as data (purity intact, pinned), `evalBuyRow`/`whyNot` mirror the client's card ladder
  rung-for-rung, and — per the old bar's own "until activation" text — **BROKEN_THESIS
  (kill-flagged falsifier RED, server-stamped `broken_thesis` on the index) now forces funding
  tier 1**, owner-marked reasons keeping precedence. This also silently fixed a real
  divergence: the server used to compare an UNPARSED free-text composite (a string score like
  "R3-A: 9.0" passed `s < 5.5` by accident); a card score is numeric by construction.
  `ALLOC_RULE_VERSION` → **tt-alloc-v2.0.0** (receipt semantics changed on both sides — cached
  v1.x receipts must not be reinterpreted, the v4.1.4 rule). **Deploy-day honesty:** every
  stored card is v2.5.0-declared and the engine now reads v2.6.0 (W4), so the line reads the
  re-score veto until tonight's re-scores land — strict §4.3, stated not smoothed.
  **W2 — one freshness doctrine.** (a) **PA cadence**: the flat `PA_STALE_D=7` took the whole
  WHEN leg dark at once (measured: 36/36 stamps at exactly 8d, 200-day averages included).
  **`PA_CADENCE {entry:7 · indicators:7 · swings:14 · mas:30}`** (asserted, every boundary
  executed at ±1d) — `paRead` judges per PATH, `computeTechRead` excludes per FACTOR with the
  window NAMED in `missing` (a stale entry no longer takes the slow MAs dark with it; an
  8-day-old stamp now reads trend+range live and degrades to UNREAD-with-reasons on quorum);
  undated still fails closed to the full withhold in both homes, and the [57] cross-
  implementation matrix gained five cadence fixtures. (b) **P3 inputs finally age**: the
  machinery (`freshnessOf`, `actionabilityRollup`'s `pillarFresh` param) existed since §5.3
  and reached only P4 hinges — the SELF_FUNDING entry named this as future scope; closed.
  Quarterly cadence (`P_INPUT_CADENCE_D=120`): AGING = one missed quarter → CAUTION, STALE =
  two → BLOCKED, **the SCORE never moves** (deleting a measurement for being old would
  recreate "unmeasured reads as zero") and every aged field is NAMED in warnings. Measured
  against the live book first: every stored P3 input is ≤~90d old, so nothing re-verdicts at
  deploy. (c) **TARGET_STALE** (`ttDrift`): the card freezes P1's target at `computed_at`
  while the board ranks live — 30/30 agreement on 2026-08-23 was a freshness COINCIDENCE, not
  a guard. The stated rule is now enforced: *the receipt governs eligibility at its stamped
  basis, the live ladder governs ranking*, and a >5% gap warns naming BOTH numbers
  (basis-aware — a FLOOR card compares against `fl`, never the premium beside it).
  **W3 — two more drift lints, both defects caught BY HAND this week.** **RUNWAY_SPLIT**: the
  same runway fact lives in P3 and PH_G2, and an intra-session split (ACHR, 21.9 vs 24) was
  caught only by a human re-reading the card — now mechanical, mode-aware (a PROFITABLE-mode
  P3 has no runway field, the SYM shape; `SELF_FUNDING` beside a numeric burn is flagged as a
  CONTRADICTION). **LABEL_DRIFT**: GEV's `basis` read "Floor only … No premium multiple
  asserted" beside the premium the v4.2 seed had added — the label-outlives-its-data defect
  INSIDE stored data; fires on the lie ("no premium multiple" / unscoped "floor only" beside a
  stored premium), silent when `floor_only_before` legitimately scopes the phrase. All three
  new lints ride `lintDrift`'s new optional `ctx` (absent = v4.3 behavior exactly), join the
  [49] byte-identity tripwire and the ICON map, and stay `sev:"warn"` — the family contract.
  COMPOSITE_STALE's message is corrected too: the legacy composite no longer gates anything
  ("historical since §14.8"), a claim that would otherwise have rotted in the lint that
  exists to catch rotted claims.
  **W4 — FINANCIALS P3 mode** (`tt-underwriting-v2.6.0`): the shape SOFI/NU/HOOD never had —
  a lender has no operating-income line and its operating cash flow is structurally
  meaningless (deposit flows and originations ride inside it), so PROFITABLE_STANDARD could
  never describe one. Five components, weights asserted for owner ratification:
  `efficiency_ratio_pct` (.25, INVERTED anchor — cost over revenue), `efficiency_direction_pp`
  (.15, inverted), `capital_efficiency` ROE/ROTCE (.20, metric named), **`capital_adequacy`**
  (.25 — headroom above the NAMED regime minimum; a bare ratio with no stated requirement
  REFUSES to score: SOFI reports CET1, NU Basel-local, HOOD broker-dealer net capital), and
  **`credit_quality_trend`** (.15, enum with source+rationale — the thing that actually kills
  lenders and that no numeric field can see). Input aging reaches the new mode from birth.
  Data fill is the post-reset KV work.
  Tests: **1901 smoke** (+34 net: [72] quote batch · the [68] activation truth table with the
  §14.8 pin inverted · [51]/[58] re-rigged onto cards · cadence identity + boundaries ·
  P3 aging · the three lint batteries · FINANCIALS boundaries) + **271 render** (eligible-line
  fixtures re-primed through the extended `/api/score` stub — the board's quality gate now
  clears via a SCORED index entry, never an injected legacy composite; the governs-panel
  re-pins) + 171 public-render + `audit:prod` clean. **Negative-controlled four ways**:
  disabling the SCORED-only rung, widening a cadence window, removing a lint emission, and
  unwiring `pillarFresh` from the rollup each turn their pins red (1/3/2/1).
- **Session log 2026-08-23 (post-v4.99) — the V5 system audit.** Owner-directed: an end-to-end,
  first-principles audit of runway months, PT rungs, next dollar and technicals against the
  purpose (*a retail investor with a watchlist wanting the scores, the next dollars and the
  thesis*). Lives at **`ticker-terminal/V5_SYSTEM_AUDIT_2026-08-23.md`** — findings measured
  against live KV, not read from docs. Headlines: the **WHEN leg is dark book-wide** (36/36
  level stamps at exactly 8d against the flat 7d window — one broker session stamped them all,
  nothing refreshes them); the **§14.8 flip precondition is now met** (NBIS SCORED 9.17/S, the
  G3 calibration blocker resolved by v4.5–v4.8) while the eligible line still reads legacy
  free-text composites over 28 shadow cards; PT-rung integrity measured clean (30/30
  basis-aware) but held by freshness coincidence, not a guard; and the three freshness gaps
  (P3 inputs never age · frozen card targets · flat PA window) are one finding — cadence-aware
  staleness owed to every store, the dashboard's own doctrine. Proposed v5.0 scope ranked in
  §4: governor flip first, falsifier sprint parallel (owner), freshness unification + drift
  lints (`RUNWAY_SPLIT`, `LABEL_DRIFT`, `TARGET_STALE`) as the guards, NVDA hinge drop before
  8/26 as the one hard deadline.
- **v4.99.0 — pre-v5 consolidation: the branch lands on `main`, and the two engine patches
  finally BIND.** Owner call, verbatim: *"Consolidate and push our work to main as v4.99."*
  Content is v4.8.0 (the QC_G3 absolute ceiling, `tt-route-v4`) + v4.9.0 (the `SELF_FUNDING`
  runway sentinel) fast-forwarded onto a `main` that already carried v4.7.0 — no code change
  in this release beyond the version literals. **The version JUMP 4.9 -> 4.99 is deliberate
  and owner-directed**, recorded here so no phantom v4.10-v4.98 is ever inferred (the same
  discipline as the parallel-branch collision notes: `package.json` is the single source of
  truth, and a number nothing explains is a number someone will later "fix").
  **What deploying this changes, concretely:** the deployed `/api/score` engine moves
  `tt-route-v3` -> `tt-route-v4`, so (1) the QC premium prerequisite gains its absolute P/E
  ceiling — measured to re-verdict ZERO stored cards — and (2) `PH_G2_RUNWAY` and P3 accept
  the `SELF_FUNDING` sentinel, so SYM's stored card (which already carries the sentinel,
  written ahead of the deploy) flips its gate UNKNOWN -> PASS on its next re-score. Until
  this push, both patches were repo-only and the production endpoint was still enforcing v3
  — verified live before consolidating, not assumed.
  Tests: the full `npm run gates` (1854 smoke + 271 render + 171 public-render +
  `audit:prod` clean) re-run at the consolidation head before pushing — local green is not
  CI green (the v4.1.3 lesson), so CI on `main` is the arbiter after push.
- **v4.9.0 — `runway_months` resolved: the field asked one question and could only answer it for
  one kind of company.** Two names put the defect on both ends in the same session. **CRWV**
  printed **2.89 months** — arithmetically exact, and reading as imminent failure for a business
  whose operating cash flow is POSITIVE and whose entire deficit is capex drawn against $104B of
  contracted backlog. **SYM** could not produce a number at all: it GENERATES cash, so the burn
  denominator has the wrong sign, the input was left unset, and the pillar BLOCKED — meaning the
  strongest funding position on the book scored **worse than a name with 60 months of runway**.
  **First principles: the field exists to answer "can this company fund itself to the thesis?"
  and `cash / burn` is not that question — it is one IMPLEMENTATION of it**, correct for exactly
  one of the three regimes the live book contains: an equity-funded burn-down (JOBY/ACHR/BETA/
  TEM), a debt-funded operator (CRWV), a cash generator (SYM).
  **Only one of the three needs code, and that is the point of the fix.** A debt-funded operator
  needs no shape change: its author may include committed undrawn facilities in the numerator and
  state the formula, exactly as every other derived figure here is authored — what CRWV is missing
  is the facilities FIGURE, recorded on that card rather than papered over with a field change.
  A cash generator, by contrast, has **no honest number to write**, which is why it is the only
  case the engine itself must learn.
  **`SELF_FUNDING`** is that sentinel — an explicit value scoring the anchor **maximum**, because
  unbounded runway is the best attainable state and the 48-month anchor top is its honest ceiling.
  Same doctrine as `NO_FLOOR_PREPROFIT` and the "unmeasured is never zero" rule pointed at the
  opposite end: *"cannot be expressed as a number"* and *"bad"* are different facts, and the field
  had been collapsing them. `readRunway()` keeps the **full atomic envelope** — `as_of`,
  `source.kind` and the no-`OWNER_ASSERTED` rule all enforced exactly as for a number, so the
  sentinel is not a provenance bypass — and **any other string still returns the ordinary numeric
  errors**, so `"self_funding"`, `"SELFFUNDING"` or `"24"` can never reach the anchor. `PH_G2_RUNWAY`
  accepts it as a PASS on exact match for the same reason: a cash generator could previously only
  read UNKNOWN there, scoring identically to no information at all.
  **Backward compatible by construction** — a numeric value takes the identical path and produces
  the identical score, asserted directly rather than assumed. No stored card used the sentinel
  before this release, so nothing re-verdicts.
  **Honest limit, stated not hidden:** nothing in P3 ages, so a SELF_FUNDING claim does not go
  stale — and a cash generator can start burning. That is a real hole, but it is the SAME hole a
  stale runway NUMBER already has (both overstate in the same direction as they age), so this adds
  none. Aging P3 inputs generally is its own scope.
  Tests: **1854 smoke** (+6: the anchor maximum proven to beat every finite value, the
  pillar-computes-instead-of-blocking proof against the exact inversion, envelope enforcement on
  all three legs, the typo sweep, exact-match on the gate, and a backward-compatibility assert)
  + 271 render + 171 public-render + `audit:prod` clean. Negative-controlled: disabling the
  sentinel in either home turns exactly those 4 pins red.
- **v4.8.0 — the QC_G3 absolute ceiling: PEG cannot backstop a pathological multiple.** The
  v4.7.0 patch fixed this gate's SIGNS and left it without the backstop its sibling
  `AI_G3P_EARNINGS_BRIDGE` has carried since v4.5 — `pe > 45 -> FAIL`, there precisely so a
  pathological multiple fails regardless of the growth story. PEG is **scale-free by
  construction**, which is exactly why it cannot do that job: an arbitrarily large numerator
  over an arbitrarily large denominator clears it. Surfaced while staging **SPCX** (see the
  session log below — SpaceX common stock, mis-lensed VEH): `pe_fy1` **152.19** over **421.1%**
  growth is PEG **0.36**, which PASSED the QC premium prerequisite at 152x forward earnings.
  **Why 45 and not ~55.** AI_G3P reads `pe_fy2`; this gate reads `pe_fy1`, structurally higher
  for a growing name (`pe_fy1 = pe_fy2 x (1+g)`), so the dimensional equivalent of the sibling's
  45 is roughly 50-55 here. 45 is **deliberately tighter**, and the reason is substantive rather
  than an artefact of which fiscal year each gate reads: **the routes differ in kind.**
  AI_INFRA/PLATFORM is the hypergrowth-platform route where a rich multiple is the norm;
  QUALITY_COMPOUNDER is the route for durable compounders, where a >45x FY+1 multiple is the
  exception its own premise argues against.
  **Measured across every live QC/STANDARD card BEFORE shipping — zero re-verdict** at 45, 60
  or 75: the highest PASSING forward P/E is RDDT at 23.47x, and both FAILs (AAPL 32.53,
  TSLA 166.45) already failed on PEG. No stored card can be rejected on re-save — the same bar
  `MISKEY` and the AI_G3P patch were each held to. TSLA's FAIL now arrives via the ceiling
  rather than via PEG; the verdict is identical either way.
  **Ordering is load-bearing** and mirrors AI_G3P: the ceiling fires BEFORE the PEG PASS test,
  or a low PEG at 152x returns PASS first and the backstop is dead code. 45 is exclusive
  (`> 45`), matching the sibling. ASSERTED, not calibrated, like every boundary here.
  `ROUTE_MAP_VERSION` -> **`tt-route-v4`** per §4.3: a boundary ADDITION changes what a verdict
  of a given version MEANS (a v3 PASS could sit at 152x; a v4 PASS cannot). Recorded on cards,
  never 409'd, so v1/v2/v3 cards stay readable and self-identify.
  Found while pinning: the existing 2.5-PEG-edge assertion probed at `pe_fy1` 50/50.2, which
  now FAILS on the ceiling before PEG is ever formed — it would have measured the ceiling while
  claiming to measure PEG (the vacuous-assert trap, cf. v3.60.1). Re-pinned under 45 so each
  boundary tests only itself.
  Tests: **1848 smoke** (+5: the SPCX negative control, the ordering proof, exclusivity at
  45/45.01/44.99, cross-gate parity, and the measured no-re-verdict sweep; 1 re-pinned with the
  reason) + 271 render + 171 public-render + `audit:prod` clean. Negative-controlled: removing
  the ceiling turns exactly those 4 pins red.
- **v4.7.0 — the QC_G3 sign-cancellation patch: a premium prerequisite that passed a company
  with no earnings.** Found by a pre-flight calibration check before scoring any
  QUALITY_COMPOUNDER name — the G3 ruling's own doctrine (rule the gate BEFORE the book, or you
  mint dated wrong cards) applied to the next route in line. `QC_G3_VALUATION_PREREQ` was
  **RATIO-ONLY**: it accepted a precomputed `peg_fy1` and never saw P/E or growth, so it was
  structurally blind to the signs that produced the ratio. **Measured live on the book: TEM,
  FY+1 EPS −$0.08 → forward P/E −908.6 on −962.5% growth → PEG +0.94 → PASS.** Two negatives
  divided to a healthy-looking positive and the gate stamped "premium earned" on a pre-profit
  name. Two further holes the same shape admitted: `pe +20 / g −10 → −2.0` PASSED (−2 ≤ 1.5),
  and `pe −12 / g +20 → −0.6` PASSED. **A `peg <= 0` guard catches none of the first case** —
  the one that was live — which is why the INPUT SHAPE had to change rather than a guard being
  bolted on. The gate now takes `pe_fy1` and `eps_growth_fy1_fy2_pct` separately and forms the
  ratio inside, the `AI_G3P` shape. Deliberately **not** a PREPROFIT QC profile: TEM stays
  QC/STANDARD and the gate simply refuses to grade a ratio it cannot form.
  **`UNKNOWN` on non-positive P/E, `FAIL` on non-positive growth** — the asymmetry is the point.
  FAIL here is `TIER_CAP: A`, a verdict about CHEAPNESS; "no P/E before profit" is a
  cannot-measure, and UNKNOWN already yields the floor-basis P1 that honestly represents it.
  Non-growth, by contrast, genuinely is "not growing into the multiple" — the same call
  AI_G3P's growth floor makes. The 1.5 / 2.5 boundaries did not move and remain ASSERTED.
  **Free to change, verified before touching it:** `peg_fy1` appeared in **zero** stored
  payloads and both QC score records (CELH, HOOD) carried this gate's input block **ABSENT** —
  no card depended on the old shape, so there was nothing to migrate and no stored ratio to
  reinterpret. `ROUTE_MAP_VERSION` → **`tt-route-v3`** per §4.3 (an input change is a version
  bump, never an in-place edit); recorded on cards, never 409'd, so v1/v2 cards stay readable.
  The live QC spread is unchanged by the patch where it was already honest — NU 0.44 · GRAB
  0.70 · SOFI 0.79 · RDDT 0.84 · AMZN 0.87 PASS, AAPL 2.64 · CAT 2.76 · HOOD 2.92 · TSLA 3.82
  FAIL — so this removed a defect without re-verdicting a single healthy name.
  Tests: **1843 smoke** (+6: TEM pinned as the named negative control the way ALAB is for
  AI_G3P, both other sign holes, the UNKNOWN/FAIL asymmetry, every boundary at −ε/edge/+ε, the
  retired `peg_fy1` input proven absent, and the measured-book spread) + 271 render + 171
  public-render + `audit:prod` clean. Negative-controlled: restoring the ratio-only shape turns
  exactly 4 pins red, the TEM control among them.
- **v4.6.0 "THE RANKING BRIDGE" — the truncation footer stops deep-linking and starts acting,
  and the three mis-graded cards are corrected.** Two pieces, one session.
  **(1) The G3 ruling's payoff, banked.** With the lens work landed (`AI`→`AIP` on all twelve
  earnings-lens AI names, `MU`→`IND` — see below), LITE/CRDO/MRVL were re-scored under
  `AI_G3P_EARNINGS_BRIDGE`. All three PASS it, and the correction is exactly what the ruling
  predicted: **LITE 5.50/B → 7.03/A**, `basis_used` FLOOR → **PREMIUM**, target **$495 → $1,089**
  (its own street-calibrated ladder), P1 0 → 6.11. CRDO P1 0.78 → 7.37 ($164 → $328) and MRVL
  0 → 3.80 ($93.75 → $250); both stay UNSCORABLE but now for the RIGHT reasons (falsifier
  bootstrap + an unsourced `capital_efficiency`), not a revenue multiple. `cap_source:
  AI_G3_2028_BRIDGE` appears on none of them. Found while doing it: a bare re-PUT would have
  scored UNKNOWN — the stored `route_gates` carried the NEOCLOUD gate's inputs and the PLATFORM
  gate's fields did not exist yet, which is abstention *for want of fields, not evidence*. The
  new inputs are computed with formulas stated; the old `AI_G3` block is **retained and labelled
  RETAINED FOR AUDIT, NOT EVALUATED** rather than deleted, so the card records what the
  superseded gate measured. **MU → IND, not AIP** (owner call, taken against the mechanical
  rule): its own basis reads *"THE TROUGH IS THE ANCHOR, NOT FY+1"* with `floor_only_before
  2028`, and G3P's PEG assumes smooth FY+1→FY+2 growth — wrong across a cyclical trough.
  `INDC_G4_VALUATION_NORM` asks the right question instead (premium on a documented normalized
  basis), and its own registry comment already named MU as its motivating case.
  **(2) The bridge itself.** `renderBuyBlock`'s footer read *"full math, horizons & caveats ↗ ·
  15 ranked of 50"* — it ADMITTED the truncation and then sent you to DESK, the v3.72 defect
  (a control that reports a fact instead of acting on it) applied to the primary view. The
  remainder now opens **in panel**: a closed `details.est-mini` whose summary carries
  `+N more ranked · *M more reviewed`, expanding to the rest of `UPSIDE_ROWS` followed by the
  rest of `UNRANKED_ROWS`. **est-mini, never `drawer`** (the phone harness counts open drawers —
  the FEAT-TT-ESTRUN precedent). The eligible line + top-5 stay the default glance, so the
  CLOSED state is the next-dollar focus; the count on the summary keeps silent truncation from
  reading as full coverage (v3.65/v3.76); `caveats, lints & horizon pin ↗` survives as a DESK
  link because **methodology belongs there and names do not**. Both row templates were inline
  duplicates and are now **defined once** (`rankedRow`/`tailRow`) and reused at both altitudes —
  the `ptModelRows` rule applied to markup, so rank 6 in the expander is the same row shape and
  the same sort as rank 5 above it, never a restarted list. **Deliberately NOT a fourth deck
  page**: MAG 7 earned a page by being a different QUESTION (the seven + MAGS); this is the same
  question uncut, and a BOOK/ALL tab would compete with the default view and re-create the
  six-phone-screens regression v3.38 spent a release killing — `DECK_PAGES` is pinned untouched.
  **`rankCategories()` finally paints**: it has computed per-axis dense ranks for SHARE RANKS
  since v3.56 and never rendered on screen; each row now carries chip-length `TIER #n · LENS #n ·
  TT #n`, suppressed where an axis has one member ("#1 of 1" is noise, not a rank). That is the
  complete-ranking read without forty rows.
  Found by the new render assertion, and it was the ASSERTION that was wrong: the first cut
  pinned `scrollWidth <= 390` in a block that runs at the **1200px** desktop viewport, so it
  measured nothing and failed on a correct page. Re-pinned on the real invariant
  (`scrollWidth <= window.innerWidth`), which holds at whatever width is active.
  Tests: **1837 smoke** (+7: one-template-per-basis, est-mini-never-drawer, the no-second-
  derivation sweep, the count-on-summary rule, the retired deep-link, DECK_PAGES still 3, and
  the rankCategories reuse) + **271 render** (+7: the expander driven live — closed-state
  absence then one-tap presence, and a runtime 7-row injection proving the expander continues
  the same order at #6/#7 rather than restarting) + 171 public-render + `audit:prod` clean.
- **v4.5.0 "THE G3 RULING" — AI_INFRA splits NEOCLOUD / PLATFORM, and the profile trap that
  would have silently undone it.** Owner call after the 8/22 engine run surfaced the finding:
  *scoring the earnings names under the current gate would mint dated, wrong cards — worse
  than leaving them dark.* Verified before touching anything, and the engine names itself as
  the capper: `AI_G3_2028_BRIDGE` is the AI_INFRA premium prerequisite and it is a REVENUE
  bridge (EV / FY+2 revenue, PASS ≤4.0x). Correct for a neocloud with no earnings to bridge
  to — **NBIS passes at 3.22x and is the calibration set** — and structurally wrong for a
  profitable platform whose own `pt_model` lens is P/E. Measured across the live book: TSM
  7.6x · LITE 7.3x · MRVL 12.3x · NVDA ~15.7x all FAIL, `premium_prerequisite_state:"FAIL"`
  → `basis_used:"FLOOR"` → `cap_source: AI_G3_2028_BRIDGE` on three of four. **LITE's card
  said it in its own words** — *"premium exists but prerequisite gate is FAIL — floor
  scored"*, target **$495** (the 15x floor) against its own street-calibrated ladder's
  $1,089, P1 = 0, composite 5.50/B. That card was minted hours earlier in this session and
  is a mis-grade; recorded rather than quietly re-scored.
  **The fix is a profile split, the pattern `QUALITY_COMPOUNDER` STANDARD / INDUSTRIAL_CYCLICAL
  already proved** — and the reason it is not a one-line addition is a trap invisible from the
  gate list: **`gatesFor` treats `profile: null` as "applies to EVERY profile of this route"**,
  so adding a PLATFORM profile while leaving AI_G3 at `null` would have given PLATFORM names
  **two premium prerequisites**, one of them the gate just ruled inapplicable. AI_G3 therefore
  takes an EXPLICIT `"NEOCLOUD"` profile and the `AI` lens maps to it, which keeps NBIS's gate
  set byte-identical; `AI_G1`/`AI_G2` stay `null` deliberately (funding and circularity are
  asked of both kinds). `ROUTE_MAP_VERSION` → **`tt-route-v2`** per §4.3 — recorded on cards,
  never 409'd, so stored v1 cards stay readable and self-identify.
  **`AI_G3P_EARNINGS_BRIDGE`** asks the SAME question of the structurally representative line:
  PASS at **PEG ≤1.0 AND growth ≥20% AND ≥3 analysts**, FAIL past **45x**, under **10% growth**,
  or **PEG >2.0**, else the honest middle. **PEG rather than an absolute P/E** because an
  absolute band cannot span this profile: measured FY+2 P/Es run 5.8x (SNDK) to 37.9x (MRVL)
  and any single line lands mid-cluster on three names at once — PEG is scale-free and encodes
  the actual claim, that growth is what you bridge *with*; the absolute ceiling survives as the
  FAIL backstop and the growth floor keeps PEG off a near-zero denominator. **Boundaries are
  ASSERTED, not calibrated** (the NFCI/CROSSOVER_SCORE convention) and every one is executed in
  smoke. It still has teeth: **ALAB is the one name it holds at UNKNOWN** (35.3x for 26.4%
  growth, PEG 1.33 — expensive for its own growth), while TSM 0.49 · NVDA 0.39 · BE 0.45 ·
  LITE 0.50 · CRDO 0.52 · MRVL 0.70 · SNDK 0.11 all clear.
  **The reconciliation pin found a pre-existing defect on its first run.** Asserting that every
  registry lens is expressible in `admin.html`'s `LENS_NAME` whitelist went red on **`IND`** —
  the INDUSTRIAL_CYCLICAL profile the registry has defined since v3.74 has **never been
  assignable from the terminal**, and **BA already carries `lens:"IND"` in the live book** (the
  server only length-checks, so it was accepted, while the client would reject any edit
  touching it and rendered its chip with no colour). Both `AIP` and `IND` are now assignable
  and rendered. A route the terminal cannot express is a ruling only half-landed.
  **Deliberately NOT done, per the owner's ordering:** no name was re-scored and the governor
  was not flipped. The four stale cards (LITE · TSM · CRDO · MRVL) are **inert until the flip**
  — legacy composites govern today — and the lens reassignment they need is derived but
  unapplied: all 8 earnings-lens AI names (NVDA · TSM · LITE · MRVL · CRDO · ALAB · SNDK · BE)
  qualify by the mechanical rule *`pt_model` carries `pe_premium_multiple`*, owner to confirm.
  Board decision records the ruling and that list (v22.7); two decisions describing the evening
  of 7/29 were pruned to fit, their outcomes already held in `board.binaries`.
  Tests: **1830 smoke** (+14: the split, the `profile:null` trap asserted in BOTH directions,
  exactly-one-prerequisite-per-profile, every AI_G3P boundary at −ε/edge/+ε, the no-P/E-before-
  profit path, the live-book sweep, the ALAB discrimination, NBIS's unchanged calibration point,
  and the lens-expressibility reconciliation) + 264 render + 171 public-render + `audit:prod`
  clean. Negative-controlled: reverting AI_G3 to `profile: null` turns exactly the two trap pins
  red and nothing else.
- **Session log 2026-08-22 — the canonical engine runs on the live book (owner-directed;
  KV/operator work through the existing `/api/score`, no code change).** The owner's ordering
  ruling, verbatim in spirit: *flipping §14.8 first would blank the green line and create no
  sample* — so run the engine on the names that already spend, THEN point the governor at the
  cards. Executed: **12 score records now exist (was 5), five SCORED** — NBIS 8.96/S ·
  **SNDK 7.94/A** · JOBY 6.82/B · **RKLB 6.26/B, the first FULL-actionability card** ·
  **LITE 5.50/B, exactly on the B boundary** with its pre-committed entry-discipline hinge
  RED (live $866.71 vs its own $680 zone top) and FY26 FCF ~zero priced in — the shadow
  saying what the legacy 7.4 could not. All falsifier grades are mechanical reads of the
  pre-committed bands against print facts, sourced per hinge (SNDK's fy2027_guide graded
  GREEN **by the letter** — $44-46 Q1 guide annualizes $180 mid vs the $177 bar — while the
  tape read the same guide as a miss; recorded, not blended). **TSM lands PROVISIONAL
  honestly**: P4 is all-or-nothing and `n2_ramp`/`working_capital` have no post-8/05
  qualifying observation until the October print — sourcing confirmed no interim company
  statement exists. **NVDA registered pre-8/26** (the time-critical §6.4.1 act) but its draft
  carries **9 hinges against the P4 8-cap** — owner to DROP one before the print (removal ≠
  edit, the other 8 keep their commitment; merging two = a NEW commitment = post-hoc for this
  cycle). **CRDO and MRVL registered inside their windows** (9/1 and 8/27 prints; CRDO needs
  ≥3 falsifiers by 9/1 — it has 1; MRVL's five-day ratification margin is flagged on the
  card). **THE SHADOW FINDING THAT GATES THE FLIP: `AI_G3_2028_BRIDGE` (EV/FY+2-rev, PASS
  ≤4.0x / FAIL >6.0x) is neocloud-calibrated — NBIS passed at 3.22x — and structurally FAILS
  every profitable AI name** (TSM 7.6x · LITE 7.3x · MRVL 12.3x · NVDA ~15.7x), withholding
  the premium prerequisite so P1 scores floor-basis on exactly the names whose lens is
  earnings. A governor flip before ruling on this would demote the profitable half of the AI
  book for a gate-calibration reason, not an underwriting one. Board decisions updated
  (v22.6); every card carries `_owner_todo` naming its ratifications and gaps; remaining
  sourcing gaps are one field each (CRDO/MRVL/LITE-alt `capital_efficiency` bases). ALAB and
  BE registration deliberately deferred — no draft exists and their windows are not imminent.
- **v4.4.0 — `DD_MAX` 45KB → 100KB (owner call: "raise server cap to 100,000"), and the
  stale claim the raise uncovered.** Expressed in the store's KB idiom (`100*1024`) and
  rounded UP from the owner's literal 100,000 so nothing the owner sized for is rejected.
  The trigger was v4.3's live blocker: **NBIS frozen at 47,635 bytes against 46,080 — the
  book's #1 name unable to save its own re-scored composite**, including a net-negative
  edit. Three homes moved together, as always: `functions/api/deepdive.js` `MAX_BODY`,
  `admin.html` `DD_MAX` (client pre-flight), `score.js` `DEPLOYED_CAPS.dd_max` (§4.1
  implementation metadata) — the three-way smoke pin re-pinned on the new value.
  **What the raise uncovered:** the admin comment beside `DD_MAX` still claimed *"the
  binding constraint is the BOOK … 38 entries at 45KB would be 1.7MB, ~5.8x the book cap"*
  and that splitting deepDive out *"remains the real fix"* — but FEAT-TT-DDSTORE (v3.75)
  DID that split a year of releases ago, payloads live in per-symbol keys, and the book cap
  has not bound them since. The smoke pin was pinning the RETIRED arithmetic in place — a
  label-outlives-its-data defect enforced by the very suite that exists to catch it. Both
  re-written: the comment states the DDSTORE reality (each name has the whole cap to
  itself; an app-level runaway-write stop, not a KV limit), and the pin now asserts the
  stale claim's ABSENCE. Found while re-pinning: the first draft of that negative pin
  matched the retired phrase QUOTED in its own explanatory comment — the v3.60.1 vacuous/
  self-matching trap, resolved by paraphrasing the quotation. The oversize fixtures moved
  with the cap (a 60KB blob no longer exceeds it; 120KB does). **NBIS unfrozen on deploy:**
  the 7.30 re-score (7.45 → 7.30: P 4.5→4.0 on the 8/19 $4.5B convert offering joining the
  stack with terms pending + the financing hinge green→amber 8/20; M 9→8.5 on the −12.98%
  offering day breaking the beat-and-new-highs read; V/G/R unchanged) saved against the
  raised cap — closing the v4.3.1 COMPOSITE_STALE finding on the book's #1 name. Both
  tiers are A either side of the move; no gate flipped. The board's blocking decision is
  rewritten RESOLVED (its "from 7.10" was wrong — the stored composite parsed 7.45; the
  re-score moves DOWN).
  Tests: **1816 smoke** (5 cap pins re-pinned with the reason, 2 fixtures moved) + 264
  render + 171 public-render + `audit:prod` clean.
- **FEAT-TT-DRIFT (v4.3.0) — the asserted layer falling behind the measured layer.** Owner
  directive after a hinge sweep: build the staleness detector rather than a daily sourcing
  agent. The reason it wins is that **hinges drive almost nothing mechanical** — verified
  against source: `src/ttScore.js` never reads `dd.hinges` (P4 reads
  `underwriting_inputs.falsifiers`), and in `readiness()` only ZERO hinges BLOCKS while
  unknown and red are CAUTIONS. All seven hinges resolved by hand that day moved zero
  rankings. What DOES have mechanical consequence is the **composite**, which is a hard
  eligibility gate (the eligible line needs `composite >= B`) — and 7 of 17 composites
  carried hinge evidence NEWER than the score itself. **`src/ttDrift.js`** (pure,
  Node-importable, byte-identical `admin.html` mirror pinned by the [49] tripwire) detects
  three instances of one pattern with **zero network calls**, every input already in the
  payload: `HINGE_STALE` (an UNKNOWN hinge dated before its own payload's newest CAPTURE may
  already be answered by it — META's hinge asked for a screenshot for NINE DAYS after the
  screenshot arrived and the pt_model was built from it), `COMPOSITE_STALE` (evidence moved
  after the score, or plain age past `COMPOSITE_MAX_D=14`), and `THIN_COVERAGE` (a consensus
  year carried by `<THIN_MIN=3` analysts that a rung actually prices — the owner's standing
  rule, made checkable). **Scoping is what makes THIN_COVERAGE signal instead of noise**: 23
  unscoped hits on the live book versus 4 scoped to years a rung reaches — MU's 1-analyst
  2033 is irrelevant at a 2027 horizon, ALAB's 2-analyst FY2029 mattered because a rung
  priced it and retiring it moved that multiple 40x→44x. **TWO GUARDS, both required, and
  CRM produced the same false positive twice**: `captureDates()` reads a whitelist of capture
  fields ONLY (a `key_date` had scanned as a capture and reported a hinge 170d stale), AND
  within them accepts only dates ≤ today (CRM's fiscal-period end `2027-01-31` then scanned
  as a capture *inside* a whitelisted field — the whitelist alone did not fix it). Every
  finding is `sev:"warn"` and gates nothing: MISKEY earns a hard gate by being a DEFECT,
  being out of date is not one. Applied the same day: the `<3` exclusion on NVDA and HOOD
  (stored under `consensus.thin_coverage_excluded`, never deleted), and six of seven drifted
  composites re-scored — three MOVED with a specific pillar reason (GEV 6.78→7.13 as a
  street-calibrated ladder now exists where V was scored on none; CRDO 7.45→7.23 on
  concentration resolving RED at 87% top-4; NBIS →7.30 on the financing hinge going
  green→amber) and four CONFIRMED unchanged with the evidence stamped, because inventing a
  0.05 move on offsetting evidence is false precision. **Two live blockers found and NOT
  worked around:** MU's `<3` exclusion would delete its ONLY premium rung (the 8/13
  trough-anchor puts the premium at y=2028, priced by a 2-analyst FY2029 — two owner rulings
  in direct conflict), and **NBIS's stored payload is 47,635 bytes against the 46,080
  `DD_MAX`, so it is FROZEN — no edit of any kind can be saved**, including a net-negative
  one, on the book's #1 name.
  **v4.3.1 (same day) — the whole-book sweep, and a false positive in the detector itself.**
  The lint shipped and was then aimed only at the seven names already found BY HAND, which is
  backwards; pointing it at all 39 stored payloads immediately found a defect in it. It
  reported NVDA and HOOD as still thin AFTER their 2-analyst FY2030 EPS had been excluded and
  their deepest rung correctly removed — because `driftSec` scoped `thinCoverage` to
  **`ptRowYears()`, the CANDIDATE list, instead of the rows `ptModelRows()` actually EMITS**.
  `ptRowYears` unions the revenue and eps year keys, and FY2030 REVENUE legitimately stayed
  (5 and 3 analysts), so it kept proposing a y=2029 row the earnings lens never emits. **A
  lint reporting resolved work as outstanding is the asserted-vs-measured defect this module
  exists to catch, committed by the module itself** — the fourth false positive in this one
  feature (CRM twice on capture dates, then this), and the rule that survives all four is
  *read the OUTCOME, never the proposal*. Scoped correctly, THIN_COVERAGE goes 4 findings → 1
  (MU's genuine conflict alone), which also CONFIRMS the NVDA/HOOD exclusions landed.
  **What the corrected sweep actually found is bigger than staleness: 11 of 39 payloads carry
  a composite whose basis has NO DATE** (ACHR · BA · CAT · NU · NVDA · RDDT · SOFI · SPCX ·
  SYM · TEM · TSM), so the one asserted number with a mechanical consequence — the composite
  gates the eligible line at `>=B` — **can never be aged at all on 28% of the book, and the
  drift detector is permanently blind to them.** That is a provenance hole, not a stale
  number, and it outranks the three genuinely-aged composites (BETA 18d · GRAB 19d · CELH
  16d) it was built to find. Also surfaced: 4 of 5 HINGE_STALE hits are hinges with **no
  `asOf` at all** sitting behind fresh captures (CRDO · TEM×2 · UBER) — NVDA's is the one
  genuinely dated-behind case (China DC revenue, 8/03 against an 8/19 capture).
  Tests: **1816 smoke** (+4 over v4.3.0: the regression driven through the REAL `ptRowYears`
  and `ptModelRows` — a hand-built year list could not prove the two disagree — with a
  control that fires when scoped to candidates, so a revert goes red, plus the call-site pin)
  + 264 render + 171 public-render + `audit:prod` clean.
- **FEAT-TT-SUGGEST (v4.2.0) — the street invert: suggest-don't-save multiple seeding.**
  The 2026-08-21 gap sweep found EIGHT names (UBER · SOFI · GEV · CELH · RDDT · HOOD · TEM ·
  SPCX) one field from ranking: payload, price and floor all present, no premium multiple —
  so they never reach the next-dollar queue. Owner design, built as specified: *"stop treating
  'missing multiple' as 'missing thesis' — treat it as missing INVERT."* **`suggestMultiple()`**
  (`src/ptModel.js` + byte-identical `admin.html` mirror, the [49] tripwire extended) solves
  the SAME two row formulas `impliedMultiple()` (v3.33) already inverts at the live price —
  but at the STREET TARGET: P/E = target ÷ FY+1 EPS, EV/S = (target×sh − nc) ÷ FY+1 revenue.
  The lens is picked by the existing rules, never a new one: earnings lens when FY+1 EPS > 0
  (TSM/UBER), UNLESS the live price puts it past `LENS_MAX_PE` (the RKLB crossing rule —
  measured live on TEM, whose FY2028 EPS $0.69 at $72 is a ~105x crossing artifact, so the
  sales lens is correct and the function says so). **UNKNOWN names every missing input**
  (target · share_count_M · net_cash_B · revenue) rather than guessing — the missing-invert
  framing means the remedy is named, not implied. **The function never writes.** Until the
  owner confirms, the rendered figure is DERIVED-STREET, diagnostic only, and the floor-only
  ranking stays the honest one — smoke pins `renderUpsideRank` clean of any reference.
  **Confirm is ONE explicit tap** (`confirmLink`, the two-step pattern) on the deep-dive tab
  beside the intake checklist: it recomputes at click time (a stale render must never be what
  gets written — the v3.6 rule), edits a COPY (v3.75), seeds the single-year schedule key plus
  **`floor_only_before`** (the MU trough-anchor mechanics — a later-year key without it fires
  MISKEY, and smoke proves the applied seed lint-clean with a no-fob negative control that
  fires it), stamps a dated, sourced `multiple_ruling` line that names the **UNRATIFIED flat
  carry** (`schedAt` carries a single key forward, so deeper rungs are explicitly marked
  unratified rather than reading as considered), and runs the MISKEY/TYPES hard-lint gate
  before `ddPersist`. Target priority is deliberate and pinned: a REVIEWED street record
  (owner-confirmed TipRanks published average) outranks a stored assistant-sourced
  `consensus.street_target {pt, source, as_of}`; with neither, the section names the gap.
  Group-3 names (MU-class deliberate `floor_only_before`) are respected, never nagged.
  Tests: **1785 smoke** (+17: both inverts vs hand math, the crossing pick, every UNKNOWN
  path, fob present/absent by seed year, the seed-then-lint behavioral pair, purity, ranking
  isolation, the confirm handler's recompute/copy/gate wiring, target priority) + 264 render +
  171 public-render + `audit:prod` clean — `npm run gates`, all four suites in real Chromium
  after merging main's v4.1.1–v4.1.6 (whose ageDays ET fix cured 11 render reds this branch
  inherited by running inside the midnight-to-8am-ET window that bug occupied).
- **v4.1.6 — the Engine 0 adversarial sweep, and the confidence inversion it found.** Owner:
  *"make sure it's almost always firing correctly … I don't want an incorrect or misfiring
  engine zero because it plays a role in all of our price targets and allocations."* The ~50
  hand-written `buildTtReadout` cases test SPECIFIC POINTS, and points cannot support "almost
  always" — the v3.40 defect (verdict went NEUTRAL → TAILWIND when stale votes were REMOVED:
  *"more risk-on for knowing less"*) passed every point test that existed at the time. So this
  adds a **seeded property sweep** — 1500 generated scenarios through the real engine, values
  placed ON and AROUND every band edge, dates at real calendar offsets (weekends matter to
  `sessionsBehind`), asserting invariants that must hold for EVERY input: the published verdict
  vocabulary is closed (never the internal `INSUFFICIENT`), six checks always, TAILWIND requires
  both panic gauges usable, PANIC requires both CURRENT, FULL implies HIGH + a live circuit,
  `<3 available` implies HOLD, a blind gauge forces HOLD, a MISSING gauge forces LOW, stale
  bullish never stays bullish, and the engine is deterministic. Plus a **hostile-input** battery
  (nulls, quoted numbers, junk and future dates, a zero divisor) proving it never throws — the
  readout is CORS-open and an external terminal gates orders on it, so a 500 is worse than an
  abstention. **`Math.random` is banned here**: the seed is printed in the assertion message so
  any failure reproduces.
  **THE FINDING — a real inversion in the CONFIDENCE axis.** MEDIUM required `current >= 3 &&
  !criticalMissing && historical <= 2`, and that historical cap inverted: a HISTORICAL input is
  a real observation one session old, strictly MORE information than a MISSING one, yet
  DELETING it moved the count out of `historical` and could UPGRADE the grade. Minimal case
  from the sweep: `current 3 / historical 3 / missing 0` graded **LOW → HOLD**, and removing a
  single input (`current 3 / historical 2 / missing 1`) graded **MEDIUM → RESTRICTED**. So **a
  feed that died completely scored better than one that merely published late** — the v3.40
  defect class, one axis over, and it had been live since ENGINE0-CONT. Since
  `current + historical + missing === 6`, the honest cap on non-current evidence
  (`historical + missing <= 2`) IS **`current >= 4`**; stated that way it cannot invert, because
  an input moving from historical to missing leaves `current` untouched.
  **Measured one-way before shipping** — across 4000 generated scenarios the new rule made
  **0 more permissive**, 43 more restrictive, 3957 unchanged. It only ever tightens, which is
  why a change to order-gating math ships here rather than waiting: the safe direction is the
  only direction it moves. Today's live readout is unaffected (`current 5` → HIGH → FULL).
  **The sweep was then negative-controlled against ITSELF, and failed.** Disabling the
  blind-gauge HOLD rule and the `criticalMissing` rule each left every assertion GREEN — two
  safety mechanisms could be deleted without the suite noticing. P11/P12 were added for exactly
  those, and all three controls now bite (restoring the inverted cap turns monotonicity red;
  each disabled guard turns the sweep red). A property suite that cannot fail on a removed
  guard is measuring the wrong thing.
  **Recency-on-conflict (owner directive), audited:** the only surface where two sources supply
  one Engine 0 field is FRED vs UST, handled by v4.1.5's `preferFresherRates`. `withLastGood`/
  `applyFieldLastGood` fill ONLY when a field is absent and never overwrite a fresher value, so
  that path honours the rule by construction — verified, not assumed.
  Tests: **1768 smoke** (+3 sections) + 264 render + 171 public-render.
- **v4.1.5 — the rate failsafe learns the failure mode it actually meets: a publication LAG.**
  Owner asked for a backup source for the 10Y/30Y with better recency. The answer was not a
  new vendor: ENGINE0-CONT (v3.71) already wired the **U.S. Treasury Daily Par Yield Curve** —
  the official upstream FRED's DGS10 *republishes* (H.15), so it is fresher-or-equal by
  construction and the numbers are equivalent; only the attribution changes. It had two gaps,
  both found by measuring the live feed rather than reading the code.
  **(1) The trigger was FAILURE-ONLY.** `if (fred.status !== "fulfilled" || tenYear === undefined)`
  fires when the DGS10 leg *dies*. Measured live 2026-08-21: the DGS10/DGS30 legs **succeeded**
  and returned an **08-19** observation two sessions old, while `VIXCLS` had already published
  08-20 — a per-series publication lag on FRED's side, not a fetch failure. So the fallback
  never fired, the 10Y went dark on the dashboard (`MACRO: HODL`, 4 of 6 voters), and Engine 0
  sat at **RESTRICTED** with the 10Y carried as HISTORICAL — one check short of the `current >= 5`
  that yields HIGH confidence and FULL actionability. The trigger now also fires when
  `sessionsBehind(fredTenAsOf) >= 1`, reusing the ONE session counter `isStale` already reads
  (the ENGINE0-CONT §P.4 rule — a second copy of that weekend/holiday walk is the drift this
  repo keeps paying for). One extra request, on exactly the days it can help.
  **(2) The 30Y had no failsafe at all** — and it is the leg carrying the 5.2% alert. The same
  CSV row has always contained the `30 Yr` column; `parseTreasuryCsv` simply never read it. It
  now emits the 30Y leg with its own deltas, series and attribution. The `30 Yr` column is
  **OPTIONAL** while `10 Yr` stays REQUIRED: a CSV that lost the column still yields a usable
  10Y rather than nulling the whole parse — fail closed on the FIELD, not on the feed.
  **The merge is by RECENCY, per leg — never by source precedence.** The old code spread
  `treasury.value` over `fred.value` unconditionally, which was only safe because it fired
  solely on a dead leg. Now that a lag also triggers it, UST can itself be the staler feed, so
  **`preferFresherRates()`** takes the newer observation per leg and a **TIE keeps FRED** (a tie
  is not an improvement, and attribution should not churn). The fallback can never make the
  page staler than it already was. **And the spread is DROPPED when the two legs land on
  different dates** — a 10s30s computed across two sessions is a fabricated number, the exact
  defect `pairRs` exists to prevent; when both legs come from one UST row it is same-date by
  construction.
  **Honest limit, unchanged from v3.71:** `home.treasury.gov` is 403 at this build
  environment's proxy, so the endpoint itself still cannot be exercised from here. The parser
  is fail-closed and fixture-tested, the merge is pure and executed, and the first real call is
  the true schema check — the same posture the original fallback shipped under.
  Tests: **1765 smoke** (+10: the 30Y leg with a same-date spread, the optional-column fail-
  closed path, and `preferFresherRates` RUN across fresher-UST / fresher-FRED / tie /
  mixed-date-drop / inert-passthrough) + 264 render + 171 public-render. Negative-controlled in
  BOTH halves: restoring the failure-only trigger turns the trigger pin red, and restoring the
  blind treasury spread turns the WIRING pin red — the second pin exists because the merge
  tests pass whether or not the merge is actually wired (the v3.40/v3.54 shape: computed,
  tested, and then overridden at the call site).
- **v4.1.4 — the shared horizon is never substituted (the deferred half of A3).**
  *Relabelled from v4.1.3 at merge (2026-08-20): the CI-gate fix immediately below landed on
  `main` first and owns that number — the second collision in this session's line of work,
  same ritual as v4.1.2. `package.json` is the single source of truth.* The v4.0.3
  audit's allocation findings split three ways: A1 and A2 landed independently on `main` as
  the v4.1.0 PERMISSION CONTRACT sprint, A4 was a deliberate §14.8 bar the audit mistook for
  a bug, and **A3 turned out to rest on a premise that does not hold** — the premium
  prerequisite the canonical rule needs is a REGISTRY gate whose state lives only in
  `tt:score:v1:<SYM>`, the store this module is barred from reading, while the payload's own
  `dd.gates` is the unrelated free-text four-gate framework (`admin.html` validates it as
  *"each gate needs a name"*, a string). Two different structures, one word. The premium half
  is therefore deferred to §14.8 activation and named rather than half-built; this ships the
  half that needs no new data.
  **The defect.** `pickRow` refuses a missing pinned year BY CONTRACT — *"pinned year absent →
  excluded and counted, never substituted"* (`ptModel.js`) — and both other consumers honour
  it: `scoreP1` blocks with *"no row at the shared horizon — never substituted"*, and the
  terminal's own `renderUpsideRank` excludes the name and counts it (stated verbatim in the
  `ddWorth` audit note). `tt-alloc.js` alone wrote `pickRow(rows, horizon) || pickRow(rows,
  "")`, silently serving the name's nearest row instead. Because `autoHorizonOf` takes the
  MINIMUM of each name's maximum year, a name with a **gappy estimate series** genuinely
  falls outside the shared horizon — and was then ranked on a DIFFERENT year from every row
  it was sorted against. That is the DEC-D2 units error (a rate that is not comparable to the
  rates beside it), and it made the server receipt disagree with the client ranking for the
  same name, with only one of them saying why.
  **The fix is the exclusion, and then the NAMING.** Removing the fallback alone would have
  left `whyNot` reporting **"no gap"** — its first rule fires on a null `up` — which claims
  the comparison ran and found no upside. It never ran. So `no_rung_at_horizon` rides the row,
  `whyNot` reports it AHEAD of the no-gap rule, the receipt carries
  **`unranked_at_horizon: [syms]`** (the v3.65 rule: a silent truncation reads as full
  coverage, so name them, never merely count), and the funding tier-5 reason stops calling
  these names **"unmodelled"** — they are modelled, just not at this year, and the two states
  stay distinguishable. `ALLOC_RULE_VERSION` moves 1.0.0 → **1.1.0**: receipt semantics
  changed, so a cached v1.0.0 receipt must not be reinterpreted under the new rule (the
  `tt-gates-v2.2.0` precedent). No client change — `admin.html`'s ranking already excluded
  and named on its side; this makes the server agree with it.
  Tests: **1756 smoke** (+9, RUN against the real module — a string pin cannot prove a sort
  key: the exclusion, the proof it is a HORIZON decision and not an unmodelled name (the same
  payload still computes on its own nearest rung, which is exactly what the fallback served),
  the no-over-correction control, the `whyNot` wording, the end-to-end receipt naming, the
  never-eligible guarantee, both funding wordings, and the version bump) + 264 render + 171
  public-render. Negative-controlled: restoring the fallback turns exactly the four
  behavioural assertions red and leaves the five contract/control ones green.
- **v4.1.3 — the CI gate had been red on `main` for five consecutive runs, on a layout nobody
  regressed.** Owner surfaced a failing run (#65, `6a1ad9b`). Local `npm run gates` was fully
  green at that exact commit — 1747 smoke · 264 render · 171 public-render · audit clean — so
  the failure was environment-specific and had to be read from the CI log rather than
  reproduced. One assertion: `v4.0: the parameter cards — the answer — begin within 400px at
  390×844`. It measures the top of `[aria-label="Key parameters"]` in pixels, i.e. the height
  of WRAPPED TEXT above it, and CI's runner resolves a different font stack than a dev
  container, so the same DOM wraps to a different height. **Local measured 395 against a 400px
  budget — 5px of margin**, which cannot survive that difference.
  Two things had compounded, and only one is environmental: **v4.0.0 recorded 356 at ship and
  it measures 395 today**, so +39px of REAL drift accreted across v4.0.1 (copy pass), v4.0.3
  (typed metrics) and v4.1.x — legitimate primary content, but drift that had eaten the
  headroom before CI's fonts finished the job. Re-pinned **400 → 480 with the measurement and
  the reason recorded at the pin** (the v3.45/v3.95 rule — never a budget quietly loosened):
  480 still catches CHROME creeping back, which is the 100px+ effect this guard exists for
  (the pre-v4.0 board had its first answer at y=587), while tolerating ~4 wrapped lines of
  font-metric variance, and the cards still begin inside the top 57% of the 844px fold.
  **The assertion now reports its own measurement** — it was the only budget pin in the suite
  that did not, so a failure required attaching a probe to learn the number, which is why a
  five-run outage read as a mystery instead of a diagnosis.
  **Process failure worth recording, not just the bug:** v4.1.1 was pushed with "all four
  gates green" — true LOCALLY, and its CI run failed too. Local green is not CI green, and
  this file's own v3.60.1 entry says a silently-skipped gate reads as a passed one; an
  unchecked one reads the same way. Also noted while here and deliberately NOT fixed in this
  commit: `package-lock.json` still carries `version: 4.0.3` against a `package.json` that has
  moved to 4.1.x. `npm ci` does not fail on a root-version mismatch (verified with
  `--dry-run`), so it is hygiene rather than the outage — but it is drift of exactly the kind
  this changelog keeps closing, and it belongs in the next release that touches deps.
  Tests: 1747 smoke + 264 render + **171 public-render** + audit:prod clean.
- **v4.1.2 — the label-to-metric contract: the 10Y card shows the yield it names.**
  *Relabelled from v4.0.4 at merge (2026-08-20): this shipped on a branch cut from the v4.0.3
  head while the terminal line of work landed v4.1.0/v4.1.1 on `main` — the documented
  collision pattern (ENGINE0-CONT, FEAT-TT-SCORE, FEAT-TT-PROVISIONAL, FEAT-TOKW).
  `package.json` is the single source of truth, so this entry takes the next true sequence
  number rather than the branch's guess; content is otherwise as committed, with the test
  line restated at the MERGED totals (main alone measures 1741/264/170).* A Codex
  read-through of the shipped Simple view graded metric semantics the weakest dimension and
  named the cause exactly: the card is LABELLED *"the 10-year yield"* and displayed
  `-0.12pp 1-mo change` — the voted quantity, not the yield. Not an arithmetic bug; a
  **contract** bug, and the mirror image of the tension v4.0.3 recorded when it made CPI and
  CAPE show the LEVEL a reader means by the name (the vote there being compound). Here the
  vote IS a single scalar, so the level and the voted delta are different numbers and the
  label promised the one the card withheld.
  A band's `metric` may now declare an optional **`context`** reading that LEADS the card,
  with the voted quantity following: `4.68% · -0.12pp 1-mo`. **The vote did not move** —
  `metric.read` is still byte-for-byte what `vote()` consumes, pinned by an assertion that
  runs both and requires identity, so this is a DISPLAY change and nothing else. Two honesty
  rules, each executed rather than pinned as a string: **context fails closed on its own**
  (a non-finite level is OMITTED, never printed as a zero — the card degrades to the delta
  alone rather than inventing a yield), and **an unreadable VOTED value still yields no text
  at all** (a level must never stand alone on a card whose direction chip comes from a
  quantity nobody could read). The delta is **SIGNED** now that it sits beside a level:
  `+0.22pp` cannot be misread as a fall the way a bare `0.22pp` could. `context` is opt-in —
  the five bands without one render byte-identically, asserted directly.
  Tests: **1747 smoke** (+6 over main's 1741: the composed text with `value`/`context` proven separately, the
  vote-identity pin, the sign, both fail-closed paths, and the opt-in control) + 264 render +
  **171 public-render** (+1: the 10Y card driven live at 390px — level and signed delta both
  present, level FIRST). Negative-controlled twice: dropping the composition turns 2 red,
  dropping the sign turns 2 red.
- **v4.1.1 — `ageDays`: the ET clock finally reaches the terminal (FIX-A, fourth recurrence).**
  `npm run test:ui` was failing **11 assertions** — FEAT-TT-ENTRY (3), FEAT-TT-TECHREAD (4),
  RANKFAIR's cap veto, the FEAT-TT-ALLOC confirm affordance, slice-5's permissive-stance pill,
  and ENGINE0-CONT's "HOLD is a hard WAIT". Every one of them resolved to a single line.
  **The defect:** `ageDays()` anchored the stamp at NOON UTC and differenced it against the raw
  wall clock — `Math.floor((Date.now() - Date.parse(iso+"T12:00:00Z"))/86400000)` — which mixes
  a CALENDAR DATE with an INSTANT. A date stamped "today in ET" therefore sat in the future
  from 00:00 ET until 12:00 UTC, so `ageDays` returned **−1 for the first eight hours of every
  ET day**. Every consumer that (correctly) treats a future date as invalid then fired:
  `circuitStateCli` returned *"circuit CLEAR is dated in the future — cannot be judged"*,
  `stance()` went **ADDS SUSPENDED — circuit state unresolved**, and the eligible line the
  entry/techread/cap tests assert against never lit. The retired comment claimed noon UTC
  *"dodges timezone edge cases"*; it dodged the DST ones and manufactured this one.
  **This is NOT test-only.** `ageDays` is the terminal's single time-judge — `runState`,
  `paRead`, `posAge`, `ddAgeChip` and the circuit all read it — so an operator stamping a
  circuit or a `lastRun` before 8am ET had it rejected as future-dated, in production. The
  fix compares **ET calendar date to ET calendar date**, both anchored at `00:00Z`, leaving no
  wall-clock term; it mirrors `functions/lib/tt-alloc.js` `ageDaysEt` and `src/ttScore.js`
  `ageDaysET`, whose own comment already named this as *"the etYmd clock every other
  time-judge in this stack uses — FIX-A"*. admin.html was the one that never got it. The
  strict `YYYY-MM-DD` guard is deliberately UNCHANGED — callers holding a datetime already
  slice it themselves (`circuitStateCli`, `posAge`), and loosening it here would silently
  start accepting inputs those sites reject on purpose.
  **Fourth recurrence of one defect class**, and the changelog has the receipts: v3.11 (UTC
  `toISOString()` run stamps rolled evening runs to tomorrow → NEVER RUN), the v3.35 fixpack
  (render fixture dates rotting at the first midnight), v3.80 (a composed-lifecycle test
  stamping UTC against an ET validator — *"passed by daylight and went red every night"*).
  So smoke **[69]** pins the contract **across the hours** rather than at whatever time CI
  happens to run: a today-stamp reads 0 at 00:30 / 07:59 / 12:00 / 23:59 ET, yesterday reads
  exactly 1 at all four, a real future date still reads negative (the fail-closed signal
  survives), malformed still reads null, and a **negative control** runs the retired
  noon-UTC formula at 00:30 ET and asserts it returns −1 — so a revert fails the section
  instead of passing quietly. Verified by reproduction: the whole suite was re-run **at 02:20
  ET, inside the failure window**, which per v3.80's own rule is the only time the proof means
  anything.
  **Reported diagnosis, corrected.** The finding arrived as *"7 call sites in test/render.mjs
  bypass the circuit with the pre-v4.1.0 `state="clear"` shortcut, which no longer works now
  that circuits require a dated `as_of` ≤7 days"*, with a recommended test-only fix of
  stamping `as_of` beside those overrides. The failure list was exactly right and the process
  gap was real, but the cause was not: the fixture **already** carries `as_of: TODAY_ET`, and
  the 7 sites mutate only `.state`, so the date was never missing — it was *future*. Probing
  `circuitStateCli` against the real fixture returned `{st:"clear", age:0}` under an ET-vs-ET
  clock, which is what ruled the stated cause out. The proposed fix would have re-stamped the
  same future-dated value and left all 11 red, in the same 8-hour window that hid it.
  Also folded in: **the two NVDA earnings-evidence commits (`cad008e`, `0911550`) shipped with
  no changelog entry** — `admin.html` gained an earnings-evidence surface on the NVDA payload
  and smoke gained 64 lines of cover for it, with the bull-case P/E later re-pinned to 30x.
  Recorded here rather than left as a gap, since an undocumented feature is the same rot
  vector this file keeps closing.
  Tests: **1741 smoke** (+7) + **264 render** (11 restored, 0 failing) + **170 public-render**
  + `audit:prod` clean — all four gates green, run inside the failure window.
- **v4.1.0 "PERMISSION CONTRACT" — the ambiguity-hardening sprint: what a green state may
  claim, and what a confirmation binds to.** Basis: the owner-uploaded v4.0.3 audit
  (validated live 2026-08-18 — every claim reproduced: `board.circuit: null` under "presumed
  tripped" prose, `ALLOCATABLE — TSM` beside measured cash **−$286,817**, a 21:07-ET-yesterday
  receipt reading "today", `live_px:false` rendered nowhere, TAILWIND over a bearish 10Y with
  Kalshi missing) plus **four defects the audit missed, found in validation**: an ARMED
  circuit invisible to the server; WAIT/NONE receipts confirmable; no confirm idempotency;
  a "-1d old" receipt age. Seven steps, one release, per owner call.
  **(1) FEAT-TT-CIRCUIT — the structured circuit is canonical; absence fails closed.**
  `circuitState()` (server) / `circuitStateCli()` (buildless mirror, smoke-pinned): absent,
  malformed, undated, future-dated, or a `clear`/`armed` older than `CIRCUIT_STALE_D=7` all
  resolve **UNRESOLVED → ADDS SUSPENDED** — session prose is explanation, never permission;
  `tripped` NEVER expires (the v3.40 asymmetry). The server ladder learns **armed** as a
  caution on the eligible row (client/server permission divergence, closed); `renderCircuit`
  stops hiding on absence; deploy state is SUSPENDED by design until the owner writes the
  first structured circuit in ◧ SESSION (locked owner decision).
  **(2) Label truth + the measured account.** `ALLOCATABLE` renders **ALLOCATION CONTEXT
  READY** with a machine `meaning: context_complete_not_cash_or_sizing_approval`; the receipt
  states `not a cash-availability or sizing claim`; `loadPositions()` stops discarding
  `account`, so equity · cash · BP · debt render beside the state (the audit read ALLOCATABLE
  beside −$287k cash the page never showed); confirm is **RECORD FUNDING INTENT — no order**.
  **(3) ET receipt identity.** The receipt carries `at_et` + `business_date_et` (the `etYmd`
  clock — the UTC date-slice defect class, third recurrence); client age is hours-based from
  the full instant with the negative-age guard; `allocBasisLine()` renders the freshness of
  every input the receipt bound (`ALLOC.inputs` was read nowhere).
  **(4) Price basis disclosed.** `eligible.px/px_at/price_basis` leave the evaluator (the
  price itself never did); `live price` / `stamped price` / `stamped price — undated` /
  `no usable price` render on the row, the chip and the confirm affordance — `live_px:false`
  always produces a visible qualifier.
  **(5) The server receipt governs confirmation.** A funding disagreement names the canonical
  (`SERVER RECEIPT GOVERNS CONFIRMATION`) with client/session readings labelled diagnostic
  shadows — married-never-merged, now with the actionable one named; `allocConfirmWithheld()`
  withdraws the confirm affordance on a prior-business-date/undated receipt or a stop/unknown
  local stance. The render fixture's tripped-circuit and asserted-PANIC boards each previously
  let a green confirm link render — both now asserted as withholds.
  **(6) Confirmation binds to the candidate and the current world (the trust core).**
  `handleConfirm`: FUND requires the receipt's own `eligible.sym` on an ALLOCATABLE receipt
  (a WAIT/NONE receipt was confirmable); TRIM requires a funding-ranking row, options sleeves
  only behind an explicit `options_sleeve:true` (legs are not shares, v3.44); second confirm →
  **409 ALREADY_CONFIRMED** unless `supersede:true` (intents immutable — a supersede appends a
  NEW record naming what it supersedes); basis drift NAMES the changed input; and a FUND
  **re-fetches the readout at confirm time** — `readout_as_of` is a day key, so the whole
  macro axis was frozen intraday — binding day, actionability, macro-flip and the full body
  hash (`inputs.readout_hash`, deliberately NOT in basis_hash: the quote-tick rule's shape),
  plus re-resolving the circuit from the clock (a stale-clear ages into unresolved with no
  book edit). TRIM is exempt from the readout re-bind: the funding ranking never reads the
  readout, and a deleverage intent must not be blocked by the stress that makes it urgent.
  Fail closed: an unreachable readout at confirm vetoes; a legacy receipt without
  `readout_hash` 409s toward recompute. A quote tick still moves `input_hash` only.
  **(7) WHY MACRO — the evidence finally read.** The readout has published
  `regime.checks/bullish/bearish/confidence` since ENGINE0-CONT and the terminal read NONE of
  it: the pill said TAILWIND while its bearish 10Y vote and missing Kalshi lived in a hover
  title a phone cannot reach. The pill is now a real `<button>` toggling a zero-height-closed
  evidence panel: `EVIDENCE: N bullish · N bearish · N missing — CONFIDENCE · ACTIONABILITY`,
  per-check rows (vote glyph · reason · as-of; the 10Y row carries its LEVEL beside the
  delta-trend vote), the missing-input warning, and a stated `presentation only` footer —
  no new voter, no threshold change; an older body without evidence detail SAYS so rather
  than rendering zeros. Pill text unchanged (the terminal date and the pinned fold budgets
  both survive).
  Tests: **1728 smoke** (+53 over the v4.0.3 baseline, incl. the confirm battery driven
  endpoint-level against the fake KV and the circuit boundary at the exact ET session) +
  **264 render** (+9, incl. the withheld-confirm-link proofs and WHY MACRO driven live in
  Chromium) + 170 public-render + `audit:prod` clean — `npm run gates`.
- **v4.0.3 "TYPED SIMPLE" — the audit's five Simple-mode fixes plus the preventive
  canonicalization.** An owner-commissioned audit of v4.0.2; every claim was reproduced
  against the live code before anything was touched, and all six were real.
  **(1) The card metric was PARSED, not typed — and for two factors the number was never
  there.** `metricOf()` split the Power matrix's display copy, which works for VIX/F&G/CAPE/NFCI
  but **10Y's display is `"Falling ↓ (bullish)"` and CPI's is `"Cooling (bullish)"`** — no
  measurement in the string at all. A newcomer asking *"what is the current metric?"* got a
  JUDGMENT. A display string is the wrong integrity boundary: each band now declares a typed
  **`metric:{read,unit,dec,note}`** beside the rule it measures, `readMetric()` projects it off
  the SAME data object the vote reads, and the cards show `-0.12pp 1-mo change` · `14.63` ·
  `65 of 100` · `3.5% YoY` · `38.2 CAPE` · `-0.62 SD vs avg`. FAIL-CLOSED: a missing
  descriptor, a throwing read or a non-finite value yields `{value:null,text:null}` and the
  card renders an explicit dash — never a zero, never a fabricated level. Where the vote is
  compound (CPI's trend shape, CAPE's two-condition OR) the metric is the LEVEL a reader means
  by that name, stated at the band rather than inferred. **`metricOf` is retired**, pinned
  absent so the parsing boundary cannot return.
  **(2) The sentence made an absolute claim on partial evidence.** *"…and nothing we track is
  working against the market right now"* is a statement about ALL SIX factors; with one
  excluded the evidence cannot support it. It now reads **"no currently usable factor"**
  whenever anything is excluded, and keeps the plain wording at full coverage — the qualifier
  is earned, not always-on. The same fix reaches the no-lean branch. This is the v3.62
  "not counted" vs "counted, no lean" distinction, carried into prose.
  **(3) Cards under DATA HOLD now say what they are.** They stay (they are real current
  readings, and useful context) but carry **"partial evidence — not used for the call"** —
  keep the evidence, deny the inference. Deliberately NOT in the quiet metadata line: a
  qualifier that prevents a misreading is not metadata.
  **(4) The flip line spoke the engine's vocabulary.** It rendered *"would move this to
  RISK-OFF"* — a label Simple shows nowhere else, so the reader got a second name for the
  verdict in front of them. Mapped through the SAME `SIMPLE_VERDICTS` table `simpleVerdict`
  uses → **"MACRO: BEARISH"**; an unmapped label passes through unchanged rather than being
  guessed at.
  **(5) The tracked-signal census left Simple.** `SignalQuality` counts SOURCES FIELDS
  ("16 fresh of 17 tracked") — that is NOT confidence in the six-factor verdict, and beside
  the hero's scoped "N of 6 voters counted" it read as a second, larger, contradictory
  number. Power keeps the full census.
  **(6, preventive) `RegimeBand` stopped re-deriving the verdict.** It called `computeRegime()`
  and `flipConditions()` itself, so the hero ran a SECOND derivation beside
  `buildEvidenceSet`'s. It agreed today, but the two take their exclusions from different
  arguments and would drift at exactly the boundaries that matter — freshness, loading, error.
  v3.98.3 already canonicalized the factor ROWS after the hero and the Drivers matrix printed
  different exclusion reasons for one factor; this finishes the job (`regimeIn`/`flipsIn`,
  with the local calls surviving only as the Property-9 extraction fallback).
  Verified by a Chromium read-through at 390px across live / degraded / DATA HOLD: every card
  shows a real number, the qualifier appears only when earned, and the census is gone.
  Tests: **1675 smoke** (+7 net: the typed metric run end-to-end incl. the two factors whose
  display string carries no number, display-vs-metric disagreement proving the parse is gone,
  the fail-closed dash, both sentence qualifier branches with the full-coverage control, the
  withheld card label, the Power-only census, `metricOf` pinned absent, and every band
  required to declare a metric) + 255 render + **170 public-render** (+1: the census proven
  absent from Simple while the scoped voters line stays).
- **v4.0.2 "THE LOOP" — the terminal header closes the circle the dashboard opened.** Owner
  spec, built as written with one measured fix. v3.98.3 gave the dashboard a first-class amber
  ⌁ TERMINAL button; the way BACK was still a `← DASH` footnote inside the terminal's ⋯ MENU
  disclosure — the only exit buried one click deep, on the surface an operator bounces off
  most. Three changes, all presentation: **(1) ← MACRO is permanent** in the header bar beside
  SHARE RANKS, styled in the dashboard's amber treatment so the two headers read as one loop
  (MacroDash → ⌁ TERMINAL · TT → ← MACRO), and the old footnote is REMOVED — one door to one
  room, both directions, pinned by a zero-count on `#headInfo a[href="/"]`. **(2) The two
  toolbars get intentional altitudes**: a quiet `DAILY OPS` label over ADD TICKER · STREET
  INPUTS · SESSION · RELOAD, and the MANAGE toggle becomes a dashed, lower-case
  **⛭ admin & backup** — every capability survives (PIN · AI RUBRIC · exports · restore),
  they just stop competing at one priority. **(3) ⋯ MENU → ⋯ OPS**, the dashboard header's
  word for the same disclosure; the one surviving "⋯ MENU" is the v3.62 comment's historical
  note, pinned as exactly-one so a control can never say it again.
  **The measured fix:** adding ← MACRO squeezed the bar and the MACRO-pill span **wrapped
  internally** ("MACRO:" over the pill), growing the bar 22→41px and blowing the slice-5 fold
  budget (BUY at y=489 vs <470). The v3.99 SourceBox lesson, applied here: `min-width:0` +
  nowrap + ellipsis on the span, so a long verdict TRUNCATES instead of wrapping — measured
  back to 23px with the longest pill text, budget restored with no re-pin.
  Tests: **1666 smoke** (+2 net: the permanent-back/one-door pin, the OPS vocabulary with the
  exactly-once historical MENU, the two-altitude toolbar pin; two MACRO-label pins re-pinned
  on the truncation contract) + **255 render** (+2: ← MACRO visible with zero clicks and
  linking home with the footnote proven absent, and the one-line bar driven at 390px with a
  long verdict) + 169 public-render + `audit:prod` clean.
- **v4.0.1 "ONE VOICE" — the owner copy pass: the prose catches up to the cards.** Owner
  verdict on the live v4.0.0 Simple view: keep the factor cards and HELPING/HURTING labels
  ("the best prose on the screen"), and bring everything else to their standard — clear,
  direct, lightly explanatory, one voice. Three moves:
  **(1) The sentence NAMES the factors — v4.0.0's "never list the factors" ruling is
  REVERSED** (the owner's own target text: *"Volatility and sentiment are supportive, but
  valuation remains stretched"*). `simpleSentence` now speaks band vocabulary — plain NOUNS
  for the supportive list, each factor's own `plainBear` verb phrase for the risk side, all
  from `REGIME_BAND_TABLE` (no third copy-table): *"Volatility and sentiment are supportive,
  but stocks are priced for perfection."* A single supportive factor speaks its `plainBull`
  PHRASE ("inflation is cooling") — "<noun> are supportive" cannot be made number-safe for
  one item ("financial conditions is supportive"). The reversal is documented at the pin
  (the v3.92 precedent), and the smoke pin now asserts the OPPOSITE of what it asserted in
  v4.0.0 — deliberately, with the ruling named.
  **(2) The 5 Whys drop the trader slang** — a partial rollback of the v3.98.1 voice pass,
  on the owner's read-aloud test ("if it sounds like a different person wrote it, simplify"):
  "sitting pretty above its 200-day" → "above its 200-day average" · "Elsewhere on the
  tape:" → "Other live readings:" · "is noise, not macro-material — it doesn't drive the
  call" → "is not macro-material, so it doesn't move the call" · "The structural stuff is
  still building" → "More than one is building — worth watching" · "so don't get cute" →
  "so confidence is lower". Every honesty literal survives byte-identical: "N/3 core inputs
  usable", the named exclusions, "dark — not counted" (the v3.98.3 one-vocabulary rule —
  "dark" stays because the hero, strip and cards all share it), "not macro-material",
  "data-driven, not news-driven", the reduced-signal caveat, and the A1 `SPY $<px> (<pct>)`
  shape guards.
  **(3) The cards footer is ONE quiet line** — the "showing 3 of 6 usable" count and the ⇄
  flip condition merge into a single subdued line inside the cards area (opacity .7),
  metadata rather than a second message. The truncation stays STATED, never implied — only
  its visual weight dropped.
  Verified by the owner's own test: the full Simple output (sentence + all five whys)
  printed and read aloud — one voice. Tests: **1663 smoke** (+0 net: the sentence pins
  re-pinned on the named-factor copy with a new single-factor phrase check and the
  reversal documented; the why1 pin moved to the plain copy) + 253 render + **169
  public-render** (the Glance/verdict/withheld sentence pins re-pinned; the withheld
  absence check now sweeps the new copy's connective forms) + `audit:prod` clean.
- **v4.0.0 "SIMPLE MODE" — the scoped verdict, three parameter cards, and one sentence
  (owner plan `simplemodefinalplan.md`, reviewed then built).** Simple becomes an ORIENTATION
  LAYER answering one question — *is the macro backdrop bullish, HODL or bearish, and which
  current metrics explain that call* — by PROJECTING the EvidenceSet the engine already built.
  No threshold, vote, quorum or freshness rule moved; `computeRegime`, `REGIME_BAND_TABLE`,
  `fiveWhys`, `ttReadout` and every TT surface are untouched, and Power is unchanged.
  **The verdict is SCOPED**: `MACRO: BULLISH|HODL|BEARISH|DATA HOLD`. `MACRO:` names which
  engine is speaking (this six-factor BACKDROP, not `/readout.json`'s order-gating checks, and
  not a position stance) — it is what keeps HODL readable as *"the evidence has no edge"*
  rather than as advice to hold, so it is load-bearing, not decoration. The vocabulary is
  CLOSED (four labels, smoke-proven) and an unknown engine label **fails closed to DATA HOLD**.
  **DEMO is deliberately NOT DATA HOLD**: a demo build publishes by design (mock IS its
  baseline — the `demoted()`/`anyLive` doctrine) and the ILLUSTRATIVE treatment is what marks
  it; conflating the two would break the demo build on purpose.
  **Three parameter cards** carry plain-language name · current metric · direction · why it
  matters · freshness+date. Four honesty rules, each executed in smoke rather than pinned as a
  string: an **EXCLUDED factor is never a card** (a card is a claim about a current usable
  reading, and "not counted" is not a direction — the v3.62 lesson, so `DIRECTION_OF` has
  three keys for four votes); **fewer usable → fewer cards, never `UNAVAILABLE` padding**,
  because absence is not content; the **truncation is NAMED** (`showing 3 of 6 usable · 2 not
  counted`) since silent truncation reads as full coverage (v3.65/v3.76); and `whyItMatters`
  is **new per-band copy in `REGIME_BAND_TABLE`**, beside the rule it explains — one home per
  band, never a card lookup table that could drift.
  **Three defects the Chromium read-through caught that the suites could not.** (1) On a
  RISK-ON day with three supports, "supports first, then risks" filled every slot with HELPING
  cards while the sentence above said *"…but real risks are still in play"* — a stated risk the
  cards hid. The last slot is now **RESERVED for the opposing side** whenever one exists (the
  v3.25 rule that a collapse never hides a red fact, applied to a summary). (2) Cards showed
  the Power matrix's judged string — `14.63 — Low (bullish)` — repeating the direction chip and
  putting band jargon in a newcomer surface; `metricOf()` **projects the measurement out** and
  never invents one (no separator, no parenthetical → the string returns whole). (3) The
  eyebrow still asked **"wen moon?"** above a `MACRO: BULLISH` line, and `RISK-ON` rendered
  beside it — two vocabularies and two verdicts for one call; Simple now reads
  "Macro Backdrop · the call" and shows exactly one verdict (acceptance test 1).
  **Scoped reversal, recorded:** the moon voice (`MOONING/HODL/DIAMOND HANDS`) leaves the
  SIMPLE hero only — Power keeps it, and so does the strip's `TAPE` badge in both modes. That
  reverses the v3.51/v3.61/v3.62 "moon voice stays primary" ruling for one surface, on owner
  call, the way v3.92 recorded the always-expanded-whys reversal. The relabel is **PROP-GATED**
  (`plainVerdict`, passed only in Simple), so Power cannot change by accident.
  **The v3.97 prose is replaced by the cards** — same per-factor detail, with the actual
  numbers attached. `postureSummary().prose` and the `plainBull`/`plainBear` phrases are
  RETAINED and still tested but no longer rendered; that is stated at the pin rather than left
  as an orphan, so a later surface can pick them back up.
  **The glance budget is re-pinned 540 → 780 WITH the measurement** (the v3.45/v3.95 precedent,
  never a budget quietly loosened): the cards are legitimate PRIMARY content, and at 390×844
  the macro strip moved 536 → 747 — still inside the first screen. Measured 817 first; the
  cards were compacted from tall cards to rows before re-pinning, which is the order those two
  steps belong in. A **second, better pin** rides beside it: the cards — *the answer* — must
  begin within **400px** (measured 356). A budget that watched only the raw strip would let the
  answer drift downward while still passing.
  Merged over the parallel v3.100.0 allocation line (both changelog entries and both smoke
  sections kept; my section renumbered [66]→[67]). Head totals **1662 smoke · 253 render ·
  169 public-render**.
  Tests: **+23 smoke** ( the closed verdict vocabulary and its fail-closed path, card
  selection RUN for all three postures incl. the counter-evidence reservation and its no-op,
  `metricOf`, the excluded-never-a-card and no-padding rules, all four sentence branches, the
  flip line's three states, and four boundary sweeps proving the projections import no
  threshold) + **+17 public-render** (all four verdicts driven live, a dead
  feed proven absent from the cards, the truncation line, Power proven to keep the moon voice
  and get no cards, and both re-measured budgets).
- **FEAT-TT-ALLOC (v3.100.0) "THE ALLOCATION RECEIPT" — the server-authoritative allocation
  layer, and the Robinhood sync contract that feeds it.** The 2026-08-17 allocation review's
  architecture, ratified and verified: do NOT replace TT — add a separate, recommendation-only
  layer answering *"if this is the best eligible buy, what should fund it, and what could
  invalidate that?"* Verification found ~half the review already built (`sellRank`, fail-closed
  `posOf`/`optSleeve`, hashing, the decision journal) and three real gaps, all closed here:
  the ELIGIBLE ladder was CLIENT-ONLY (no server record ever bound "this was the eligible buy"
  to its evidence), the positions store had no snapshot version / account / tax lots, and a
  confirmed "fund X from Y" had no immutable record.
  **The store** (`tt:pos:v1` → `{asOf, snap, account, positions}`): `snap` is a server digits
  stamp per PUT (receipts bind to it); `account` is the MEASURED record (`validateAccount` —
  equity required, NO formula: `board.account` stays the ASSERTED leverage record, married
  never merged) riding the PUT as a SIBLING with the board-carry rule (absent=carry,
  null=clear); `pos.lots[]` makes ST/LT a DERIVED fact (>365d at evaluation, never stored);
  `POS_STALE_D` moves to ONE exported home with the client literal mirror-pinned.
  **The evaluator** (`functions/lib/tt-alloc.js`, pure + smoke-RUN; `/api/allocation`
  transport): replicates the client's circuit veto + 8-rung gateFail ladder rung-for-rung
  (every unreadable input a NAMED veto), evaluates every book name from the dd INDEX
  (pt_model/consensus/ref_px/hinges/composite — the v3.75 whitelist paying off: no per-tab
  reads), and keeps TWO STATES DISTINCT: `BUY_ELIGIBLE` (position-independent — a missing
  position NEVER blocks underwriting) vs `ALLOCATABLE` (context: positions/account freshness,
  cap room broker-pct-preferred with the tracked floor NAMED, cluster headroom). Context
  failures are named `context_blockers` and degrade — WAIT, never a wrong answer, never an
  inferred zero (missing lots ≠ zero tax; an unsynced option leg ≠ no exposure). The funding
  ranking is FIVE OWNER-LOCKED TIERS with a governing reason per row: **(1) owner-marked
  forced exit ONLY** — `decision.forced_exit:true` (validated, literal true, sym-scoped) or
  cut-list membership; **the shadow score engine's BROKEN_THESIS is BARRED until §14.8
  activation** (the module receives no score data at all — the bar holds by construction,
  comment-stripped-swept in smoke) → (2) over-cap (broker-measured pct, floor named) →
  (3) cluster violation → (4) session funding order → (5) lowest annualised upside via the
  SAME `src/ptModel.js` `pickRow`. `do_not_trim` flagged never hidden; FIX-C's "FUNDING
  PRIORITY — not a sell recommendation" rides every receipt verbatim.
  **Receipts + confirm:** history key FIRST, pointer second (the ticker-analysis order,
  negative-controlled); THREE hashes with the distinction documented — `input_hash` (audit,
  incl. quote stamps) vs `basis_hash` (book version · positions snap · index asOf · readout
  day · rule version — what confirm checks, because a 2-minute quote tick must not 409 a
  confirmation) vs `result_hash`. `POST ?confirm=1` re-derives the basis from current KV →
  409 `STALE_ALLOCATION` on any drift → immutable intent record (450d, server-stamped).
  **INTENT ONLY: no broker order call exists anywhere in this repo** — smoke pins
  `place_equity_order`/`place_option_order` absent from the terminal and every function.
  **The terminal** renders the receipt BESIDE its own read, married never merged for this
  release: one `allocChip()` at both altitudes (BUY + FUNDING blocks — smoke pins exactly
  two call sites), a THIRD funding-disagreement line (server vs client vs session), two-step
  CONFIRM FUND (the v3.42 destructive-link rule) that withdraws on WAIT, a stated chip when
  no receipt exists (older deploy = stated, never blank), and `loadAllocation`/`allocReeval`
  on the boot/refresh chains. Client `sellRank`/`gateFail`/`why()` are UNTOUCHED. Found and
  closed while wiring: `validateSession` had every board section EXCEPT `account` — a
  malformed asserted-leverage record rode the client's unknown-key passthrough while the
  server rejected the same edit.
  **The Robinhood runbook** replaces the old deferred note (see THE ROBINHOOD SYNC RUNBOOK
  below): chat-side MCP pulls → merge-only PUT with the PIN header; the server never talks
  to the broker; `pct` computed chat-side as mv/equity×100 with the formula stated; a missed
  sync degrades to WAIT via the shared `POS_STALE_D`.
  Tests: **1639 smoke** (+35: the gate ladder rung-for-rung, the review's acceptance tests
  1-10 EXECUTED, the §14.8 comment-stripped sweep, mirror pins, the fake-KV endpoint with a
  put-order log, basis-vs-input proof, both 409 paths; negative-controlled twice — a
  shadow-store reference in the forced tier and a swapped history/pointer write order each
  turn exactly their pin red) + **253 render** (+5: the chip at both altitudes, confirm
  intent-only, the disagreement line, WAIT withdrawing the affordance, the honest no-receipt
  state — all driven live in Chromium) + 152 public-render + `audit:prod` clean.
- **v3.99.4 "THE RUNTIME CONTRACT" — the codex ambiguity review's verified findings, closed.**
  An external review of fba2a1c found no wrong number anywhere — every finding was a CONTRACT
  stated in several places that a human had to keep in sync, and every single one had already
  drifted. Each was verified against source before any fix (all real; one worse than stated).
  **P0 — the gate crashed on line endings.** Smoke's [58] lift locates its block with an
  LF-sensitive `indexOf("MAG_BASKET=null;\n  {")`; a CRLF checkout (Windows autocrlf) made it
  return −1 — REPRODUCED here by CRLF-converting admin.html: two FAILs then a TypeError that
  killed the suite MID-RUN, no total printed (worse than the review's "two failed assertions").
  Fixed twice over: `.gitattributes` (`* text=auto eol=lf`) makes LF a repository invariant
  that overrides autocrlf, and every smoke source lift now reads through `readSrc()` (CRLF→LF
  normalize), proven by re-running the CRLF checkout: 1590 green where it crashed.
  **P1 — the setup guide configured the WRONG refresh secret.** `worker/SETUP.md` instructed
  `REFRESH_SECRET` (the LEGACY `/refresh` guard) where the active 10am force-refresh needs
  `REFRESH_TOKEN` on BOTH deploys — an operator could follow every step successfully and leave
  the active path dead, with the manual endpoint returning `ok:true` beside
  `active_refresh: "skipped (no REFRESH_TOKEN)"` (the `ok` describes the legacy write only).
  And the cron story was worse than a naming slip: the TOML carries FOUR triggers, SETUP.md
  said THREE (its DST block, followed in November, would have DELETED the 8am prewarm), and
  this file's own deployment section still said TWO — while `scheduled()` dispatches by exact
  string match with a legacy-FRED fallthrough, so a TOML edit without the matching `cron.js`
  constant is a silently misrouted job, not a visible failure. All four surfaces now state the
  same four-trigger contract, both credentials' distinct roles are documented at every home,
  and an **environment matrix** (which deploy owns which secret, what degrades without it)
  lands in the deployment section.
  **P1 — `?debug=1` was open on the one CORS-open endpoint.** `/readout.json` served `kv_key`/
  `kv_hit`/`snapshot _diag` (source statuses, latencies, upstream hosts) to any origin that
  knew the parameter, while `/api/snapshot` required `DEBUG_TOKEN` and the docs claimed the
  policy was universal (B3, v3.59). It now rides the identical fail-closed rule — no secret
  configured means no diagnostics for anyone — and a debug response is `no-store` (diagnostics
  must not sit in the 5-minute shared cache). Operator note: the deployed readout needs
  `?debug=<token>` from now on.
  **P2s — four Node floors and a stale silence claim.** engines `>=18` / `.nvmrc` 22 / docs
  "≥17" / CI 20 all coexisted — and the smoke suite needs global WebCrypto (Node 19+, the
  v3.99.1 Kalshi signer test), so the advertised floor couldn't even run the gate. One
  baseline now: engines `>=20`, every doc updated. And three surfaces (`.env.production`,
  `docs/design-system.md`, this file's data-flow section) still said a failed live fetch
  "silently reverts to mock" — ~40 releases after v3.59 B1 made it a visible ERROR + RETRY;
  the implementation was safer than its documentation, which is still a lie about the page.
  **The structural fix is smoke [67], not the edits:** cache-key version reconciled across
  its four consumers (snapshot/refresh/readout/cron — a lone bump is a split-brain cache) ·
  TOML crons ↔ `cron.js` dispatch constants BOTH directions, with exactly the two documented
  legacy pulls allowed through the fallthrough · SETUP.md's four-trigger and REFRESH_TOKEN
  claims pinned against the implementation · the debug rule pinned on both endpoints · the
  Node floors reconciled numerically · the stale-silence claims pinned ABSENT. (The review
  proposed a codegen'd `config/runtime-contract.js`; this repo's idiom is reconciliation-in-
  smoke — the SOURCES/DERIVED_OF and playwright EXECUTABLE_PATHS convention — and the Worker
  cannot import across deploys anyway.) Negative-controlled: a lone v16 bump in readout turns
  1 red; a constant-only cron edit turns 2 red.
  **Deferred as owner calls, named not buried:** making CI BLOCK the Pages deploy (a
  Cloudflare Pages setting, not repo code — the workflow's own comment already records the
  current non-blocking policy as deliberate; recommended: block, since smoke guards
  order-gating contracts) · a dedicated `/public` route with route-specific OG/manifest
  metadata (collides with v3.97's owner model where Simple-at-root IS the share page) ·
  splitting this file's changelog into a dated archive (its append-only history is the
  documented living record; a split is real scope, not a cleanup).
  Tests: **1604 smoke** (+14: the [67] contract section, run behaviorally with the two
  negative controls above) + 248 render + 152 public-render + `audit:prod` clean.
- **v3.99.3 — the ENGINE0-CONT filed limit on `fetchEquities`, closed.** *Relabelled from
  v3.99.2 at merge (2026-08-17): the STONKS UNFURL entry below shipped in parallel on `main`
  and independently claimed v3.99.2, landing first and owning the number — the documented
  collision pattern (ENGINE0-CONT, FEAT-TT-SCORE, FEAT-TT-PROVISIONAL); this entry takes the
  next true sequence number, content otherwise as committed.* v3.71's "honest
  limits" section named this at full weight rather than bundling it: `fetchEquities` recorded
  its group status `ok:true` one line before throwing on zero quotes, so `_diag.sources` read
  `finnhub quotes ok:true` on a build whose equities fetch produced nothing — "healthy"
  asserted by the same function about to report an empty result. The record is now EARNED:
  at least one quote → `ok:true` with the real counts; zero quotes → the failure is RECORDED
  (`succeeded:0`, `error_class no_observation`, the failed symbols named) *before* the throw,
  so "all failed" and "never ran" stay different facts and neither reads as ok. The
  `withLastGood` → mock ladder is unchanged. `fetchEquities` is exported solely for smoke
  (the `validateBook` precedent), because the defect is an ORDERING between a record and a
  throw — a string pin cannot prove one; the suite stubs `fetch` (still no-network) and RUNS
  both the all-fail path and a healthy control. Negative-controlled: restoring the old
  ordering turns exactly the 3 new all-fail assertions red.
  Tests: **1588 smoke** (+4) + 248 render + 152 public-render + `audit:prod` clean — all four
  gates run via `npm run gates`, browser suites in real Chromium.
- **v3.99.2 "STONKS UNFURL" — shared links identify themselves as MacroDash, not
  Cloudflare Pages.** The public document, Open Graph and Twitter titles now share the exact
  `MacroDash - Stonks` string, while an explicit favicon / Apple touch icon supplies the
  branded `M` that Messages previously replaced with the generic Pages `P`. The manifest
  references the same assets, and smoke pins the title and icon contract so later metadata
  cleanup cannot silently regress the unfurl. Tests: **1586 smoke** (+2) + 248 render +
  152 public-render + `audit:prod` clean.
- **v3.99.1 — owner-corrected FOMC dates, the odds stop lying, and the Kalshi key path.**
  Owner confirmed the calendar and **corrected two of my asserted dates** (Nov 4 → **Oct 28**,
  Dec 16 → **Dec 9**); Sep 16 — the date driving the live countdown — was right. Both
  corrections are pinned BY VALUE in smoke, with the wrong ones pinned ABSENT, so a silent
  regression to my guesses fails the build. This is the asserted-until-confirmed rule paying
  for itself: 2 of 8 entered dates were wrong, which is exactly why the table is flagged
  rather than trusted.
  **The mock odds are gone.** With Kalshi rate-limited the tile still rendered
  `Hold 84% · Cut 13% · Hike 3%` from `MOCK_DATA` — and unlike every other mock number on the
  page, those are not LEVELS a reader can sanity-check against the world; they are
  PROBABILITIES about a future decision that nobody can check and that read as the market's
  actual view. The one number on that tile least verifiable was the one most likely to be
  believed. It now reads **"odds unavailable — Kalshi feed not live · the date above stands on
  its own"**, with the numbers structurally on the usable side of the gate (smoke proves the
  branch is unreachable on mock/stale). The v3.1 invariant applied to a percentage.
  **The authenticated Kalshi transport (owner priority).** The 429 is a *shared anonymous
  bucket* on Cloudflare edge IPs, so a key is the only fix that addresses the cause — a second
  base never could. `kalshiHeaders()` signs `timestampMs + METHOD + path` with **RSA-PSS
  (SHA-256, salt 32)** per Kalshi's scheme and sets `KALSHI-ACCESS-KEY/SIGNATURE/TIMESTAMP`.
  **KEY-GATED like Finnhub**: with `KALSHI_KEY_ID` + `KALSHI_PRIVATE_KEY` unset it returns
  null and the anonymous headers run exactly as before, so the deploy is **inert until the
  owner sets the secrets** and nothing can regress by shipping it. The auth MODE rides in
  provenance (`auth: keyed|anonymous`) because *"still anonymous"* and *"keyed and STILL
  limited"* are different diagnoses and implying either would be a guess.
  **⚠ The signing path has never made a live call** — kalshi.com is 403 from this build
  environment — so it is verified the only way it can be: smoke **generates a real RSA key,
  runs the signer, and cryptographically VERIFIES the signature** over the exact
  timestamp+method+path message, plus both fail-closed paths. A signature is a claim about
  crypto; a string pin cannot prove one. Setup: `npx wrangler pages secret put KALSHI_KEY_ID`
  and `KALSHI_PRIVATE_KEY` (the PKCS#8 PEM Kalshi issues).
  **Two defects the tests caught while building this.** (1) The key was memoized at module
  scope, so in a Worker isolate a **rotated secret would keep signing with the retired key**
  — and the cache masked a bad key behind an earlier good one (my own round-trip test returned
  the cached key for a garbage PEM instead of failing closed). Memoization removed; importKey
  runs twice a day. (2) The countdown compared the ET-resolved meeting date against
  **browser-LOCAL midnight**, so in any non-ET runtime the two clocks disagreed and the
  countdown could be a day out — the exact FIX-A defect (v3.49) that put `etYmd()` in
  sources.js. Caught by a new browser assertion that derives the expected number from the
  calendar rather than hardcoding it, so it survives the calendar rolling forward.
  Tests: **1584 smoke** (+9) + 248 render + **152 public-render** (+2: the countdown matched
  to the day against the active entry, and the mock odds proven ABSENT).
- **v3.99.0 — the Fed label defect, and taking the FOMC date off Kalshi's critical path.**
  Owner question ("is the fed rate and CPI the latest?") turned into two findings and a real
  diagnosis. **CPI is fine** — 3.5% headline / 2.8% core observed `2026-07-01` is the July
  print, the latest published. **The Fed number was mislabelled.** The tile led with FEDFUNDS
  under the heading "Fed Funds Rate", which every reader takes for the policy rate — but
  FEDFUNDS is the monthly AVERAGE of the EFFECTIVE rate: period-stamped at month start,
  published in the first week of the following month, and structurally incapable of moving on
  a decision day. The morning after a cut it would still print last month's average, correctly
  badged LIVE. **`DFEDTARU`/`DFEDTARL`** — the Fed's own DAILY target-range bounds, which step
  the moment the FOMC acts — are now the headline where live, with the effective average kept
  and LABELLED (*"effective 3.63% · FEDFUNDS monthly avg, lags a decision"*); a dead range feed
  falls back to the effective rate and SAYS the range is not live. They are deliberately
  daily-cadence and NOT `DERIVED_OF: fedFunds`: inheriting the monthly series' staleness would
  defeat the entire point.
  **The Kalshi "outage" is a rate limit, and it was costing three things.** `?debug=1` on the
  deployed readout: `rateOdds: "Error: HTTP 429"`, **429 on BOTH transport bases** — so the
  ENGINE0-CONT ladder cannot help (both names front the same limiter, and unauthenticated
  calls from shared Cloudflare edge IPs share a bucket — the Stooq lesson again). The damage
  was disproportionate: the meeting DATE and `fed_next_meeting` (a `/readout.json` health
  input, contributing to `can_gate:false`) rode on the same fetch as the odds, and with Kalshi
  dark the strip fell back to **`MOCK_DATA.nextFOMC`, hardcoded `2026-06-17`, expired two
  months earlier** — rendering `FOMC —`. Three failures from one upstream, two of which had no
  business depending on it.
  **`FOMC_MEETINGS` + `nextFomcDate()` in `src/sources.js`** fix that structurally: the Fed
  publishes the schedule a year ahead and it does not change intraday, so **curating it beats
  fetching it** — a scrape would add a network dependency, a parser and a rate limit to a value
  that changes eight times a year. Same shape as `MARKET_HOLIDAYS`. A live Kalshi strike date
  still WINS (it is the market's own reference for the odds beside it, so the two can never
  describe different meetings) and the tile NAMES which answered — *"published Fed calendar"*
  vs *"market strike date"*. Past the end of the table it returns **null**, never an
  extrapolated date: a guessed meeting would feed both a countdown and an Engine 0 gate.
  **On the requested backups, honestly:** Nasdaq, CNBC and Bloomberg publish no free FOMC
  probability data (CME FedWatch is the canonical source and is a licensed JS app), so **there
  is no drop-in backup for the ODDS** — what this release does instead is make everything
  except the odds independent of Kalshi, so the 429 now costs one number rather than the date,
  the countdown and a gate input. The Fed's own channels serve the two pieces that matter: the
  published calendar (curated) and the target range (FRED, already on rails reporting `ok:75`).
  Neither could be network-verified from this build environment — federalreserve.gov,
  nasdaq, cnbc, bloomberg, FRED and Kalshi are all 403 at the proxy here — so the calendar
  dates are **ASSERTED and flagged for owner confirmation**, and carry an **EXPIRY TRIPWIRE**:
  smoke goes RED once under 90 days of runway remain, because a comment asking for an annual
  update is exactly what rotted the value this replaces.
  Also found by the 320px contract while wiring it: `SourceBox` had `nowrap` + ellipsis but no
  min-width floor, so a longer endpoint string took its content width and pushed the page to
  357px instead of truncating — the ellipsis could never engage. Fixed generally.
  Tests: **1575 smoke** (+12: the calendar's shape/ordering/null-past-the-end, `nextFomcDate`
  executed across the decision-day boundary, the expiry tripwire, the market-wins-then-calendar
  fallthrough, both tile states, the daily-vs-monthly cadence split, and the SourceBox floor) +
  248 render + **150 public-render** (+6: the target range driven live at 1280px, the effective
  average labelled, the countdown rendering with Kalshi entirely absent, the strip's dash gone,
  and the dead-range fallback).
- **v3.98.4 — the Power read-through: three more surfaces that asserted a state they never
  checked.** v3.98.3 covered the hero and Drivers; this drove **Markets · Macro · AI · Data
  Health** in Chromium across three data states (full-live, degraded with a stale 10Y and a
  dead VIX/credit/token/CAPE feed, and a total 500-outage) and read the rendered text. Three
  findings, all the same defect class — *a hardcoded claim whose own code never looked*.
  **(1) The token-price card printed a DIRECTIONAL read off mock.** `▼ 25% over window` was
  gated on `drop !== null` alone and never on provenance, so a dead OpenRouter feed still
  published a falling-price claim — measured at **`▼ 35% over window` in a total outage,
  computed entirely from `MOCK_DATA`**. The scissors card immediately below it, in the SAME
  file off the SAME data, correctly rendered *"verdict suppressed — price leg not live"*: one
  section, two answers, and the permissive one was the v3.1 invariant's exact target. It now
  reads **"trend withheld — price leg not live"**; the value itself still renders (mock
  content is the baseline, hatched and badged) — only the directional read is withheld.
  **(2) The macro strip told a dark factor it was voting.** The `▪` marker and its tooltip
  ("Counts toward today's posture") came from `VOTING_FIELDS` — the STATIC six-voter set — so
  a factor whose feed was dead still wore the marker while the hero two rows down listed it as
  excluded. The marker now means what it says: `votes = isVoter && live`, and a voter that is
  dark today reads **"A voter, but dark today — not counted."** rather than the opposite.
  (The provenance dot and the muted vote-colour were already correct — the *marker* was the
  lie.) **(3) The CPI source box carried a LIVE badge with no observation date** — the one
  box in the macro grid that omitted `asOf`, on the tile whose entire subject is the inflation
  TREND. Now dated, and smoke pins that EVERY box in that grid passes one, so the next tile
  cannot ship undated.
  **Checked and NOT changed** (recorded so the next read-through does not re-litigate them):
  the FOMC countdown is computed from `nextFOMC` rather than trusting a stored day count (a
  fixture disagreement, not a defect); `Kalshi · live` is `modeOf(...)`, not a hardcoded
  claim; the S&P index line rides the same `fetchSpy` pull as SPY so the two cannot diverge in
  production; and every curated AI card was already correctly hatched, badged and verdict-
  suppressed on mock.
  Tests: **1563 smoke** (+7: the withheld branch proven UNREACHABLE on mock by structure, the
  marker's new meaning, the tooltip's three states, and the grid-wide asOf sweep) + 248 render
  + **144 public-render** (+5: the dead-feed card driven live with `% over window` proven
  ABSENT, the dark voter losing ▪ while a live voter keeps it — both read off the real
  tooltips — and the CPI date).
- **v3.98.3 — the Power-side audit: one exclusion reason, one vocabulary, TERMINAL promoted.**
  Driving the Power view in Chromium against a degraded fixture (stale 10Y, dead VIX feed)
  found six things; the first is a real defect. **(1) `regimeFactors` hardcoded the cause.**
  Every excluded factor's display was built as `` `${val} · STALE — excluded` `` regardless of
  WHY it was excluded, because the function receives only a Set of keys — so a factor dropped
  for a DEAD feed (mode MOCK) read as merely old and wore the ⏱ stale clock, while the C3
  Drivers matrix, which does see the real mode, said "not live in a live build" 300px below.
  One page, two reasons for one factor. `regimeFactors(d, stale, reasons)` now takes an
  optional Map key→{kind, asOf} and the two cases print DIFFERENTLY on purpose: a stale
  factor keeps its number and is DATED ("18.4 — Elevated · too old to count (as of
  2026-08-13)"), a dead-feed factor **drops its value entirely** ("no live reading — not
  counted") — **(2)** because that number is the mock baseline, and a fabricated value wearing
  a judgment word ("Elevated") inside an evidence panel is the v3.1 invariant's exact target.
  Absent map = generic "not counted", never an invented cause. **The hero stopped re-deriving
  its rows**: it called `regimeFactors(d,stale)` itself, which structurally cannot know the
  cause, so the orchestrator now hands it `evidenceSet.factors` (`factorRows`) — one
  derivation, two altitudes, the local call kept only as the extraction fallback.
  **(3+4+5) One line, one scope word, one vocabulary.** The hero read "4/6 factors voting ·
  excluded: 10Y · VIX" directly under a sentence calling those two "dark", while the verdict
  sub ALSO said "4 of 6 inputs usable" — three renderings of one fact and two words for one
  state. It is now **"4 of 6 voters counted · dark: 10Y · VIX"**, and the sub's duplicate is
  dropped where the line below already states it (presentation only — `regime.sub` is
  untouched for the paste block and the 5 Whys, which have no such line). **"VOTERS" resolves
  the other ambiguity**: WHY #2 lists dark CROSS-SIGNALS (WTI and HY-IG among them), a
  deliberately wider set than the six that vote, and nothing said so. The flip panel's
  "Excluded from the vote (stale)" loses its unearned diagnosis for the same reason as (1).
  **(6)** the matrix reasons join the voice rules: "stale for its cadence" → *"too old for how
  often it updates"*, "not live in a live build" → *"no live feed right now"*.
  **FEAT-TERMINAL-BAR (owner call: "want terminal more available given all our hard work"):**
  the ⌁ TERMINAL link is **promoted out of the ⋯ OPS disclosure into the toolbar itself**,
  with the amber accent treatment so it reads as the primary destination rather than another
  utility. v3.62 demoted it as newcomer clutter — correct then, wrong now: the default route
  is the operator's, and Simple|Power gates newcomer noise far better than a menu did. It
  keeps its own `!publicView` gate (a visitor never sees it) and is **removed from the menu**
  — one door to one room, pinned by an exactly-once check on the href. The TT readout copy
  stays in OPS.
  Tests: **1556 smoke** (+9: both exclusion causes RUN through the real engine and proven to
  render differently, the dead-feed value-drop, the no-map generic, the end-to-end chain
  through `buildEvidenceSet`, the flip-panel and sub fixes, the promoted-once TERMINAL) +
  248 render + **139 public-render** (+1, four re-pinned: the scoped voters line, the card's
  real reason, TERMINAL visible with ZERO clicks and absent from the menu, and its accent).
- **v3.98.2 — the tightening pass: every why is 1–2 sentences, WHY #5 carries the weight,
  and Power talks retail too.** Owner review of the live v3.98.1 whys: keep the layout and
  expander, cut the parentheticals and asides, prefer "sentiment is greedy" over "the crowd
  is greedy", make WHY #5 the strongest line, and sweep the Power surfaces into the same
  voice. Applied: WHY #1 drops the 200-day level parenthetical and lands on "Trend intact."
  · WHY #2 drops the "(mock/stale)" aside (WHY #5 already says *excluded as stale/dead* —
  saying it twice was the heaviness) while the dark inputs stay NAMED · WHY #3's noise
  branch loses its channel enumeration · WHY #4 tightens to "Slow-burn risks (hand-curated,
  <date>)" · WHY #5 is unchanged in copy and now renders at FULL WEIGHT (primary color,
  600, solid border) while the evidence whys stay secondary — emphasis, never reordering.
  Measured against the live shape: 92–159 chars per why, down from ~300 at the longest.
  **Power's compact sentence joins the voice**: factors "lean bullish/bearish" and unusable
  ones are "dark" (was "support risk / adds risk / unavailable") — same buckets, same
  derivation, sharper words; the F&G verb pair becomes *sentiment is greedy/fearful*.
  **Found in the owner's screenshot and fixed at both ends: `Fed&#x2019;s` rendered raw** —
  the RSS decoder handled named + decimal entities but not HEX numerics. snapshot.js now
  decodes both numeric forms at fetch, and `deent()` in fiveWhys.js decodes at render too,
  because the day's stored KV snapshot still carries the pre-fix text — a stored artifact
  must not print raw entities for up to 48h after the fix ships.
  Tests: 1547 smoke + 248 render + 138 public-render (six pins re-pinned on the tightened
  copy and the lean-bullish sentence), audit:prod clean.
- **v3.98.1 — the 5 Whys get the trader voice (owner voice rules, standing).** The owner set
  voice rules for ALL MacroDash copy: *a sharp, slightly irreverent trader who still respects
  the data — short sentences, light slang, natural flow over labeled sections, and NEVER
  invented conviction when factors are excluded.* This applies them to `computeFiveWhys`,
  tone-only — every gate, count and exclusion literal survives byte-identical where it is
  load-bearing. The banned memo labels are gone: WHY #1 is **labelless** ("SPY $778.58
  (−0.2%), sitting pretty above its 200-day…"), "Live cross-signals:" → **"Elsewhere on the
  tape:"** with exclusions read as *"VIX, 10Y are dark (mock/stale) — not counted"*,
  "Headline driver:" → **"Top story:"** / *"noise, not macro-material… Today is data-driven,
  not news-driven"*, "Risk register (curated…)" → **"Slow-burn risks we track
  (hand-curated, reviewed …)"**, "Net:" → **"Bottom line: still RISK-ON… 2 excluded as
  stale/dead — a reduced-signal read, so don't get cute."** Honesty invariants untouched and
  re-proven: "N/3 core inputs usable" literals kept (three suites pin them), exclusions still
  NAMED, the materiality withhold still says *not macro-material*, full-signal/reduced-signal
  still split. Six smoke pins re-pinned on the new copy; the two A1 mock-narration guards
  moved from the deleted "The scoreboard:" label to the narrated SHAPE (`SPY $<px> (<pct>)`) —
  a label-based guard would have passed vacuously forever (the v3.54 lesson, second time this
  release cycle). Tests: 1544 smoke + 248 render + 138 public-render, totals unchanged.
- **v3.98.0 "TT OHLC CONTINUITY" — Nasdaq is the permanent automatic daily-candle
  fallback.** Finnhub remains primary; when its daily-candle product is unavailable, the
  measured-facts refresh requests three bounded, non-overlapping Nasdaq history windows,
  normalizes currency-formatted OHLCV, sorts and de-duplicates boundary dates, and persists
  the actual provider/as-of beside the rows. The 201-valid-session requirement, ATR/pivot
  support, stop, R/R floor, freshness checks, and last-good merge policy are unchanged — a
  fallback repairs availability, never relaxes evidence. Partial Nasdaq window success is
  usable only if the downstream 201-session gate is still met; empty/bad responses stay
  MISSING. Yahoo was rejected as the fallback after both chart hosts returned HTTP 429, and
  Google Finance has no supported server OHLC API. Technical evidence now says `sourced daily
  candles`; the facts record, not a hard-coded sentence, owns provider attribution.
  Tests: **1547 smoke** (+3: Nasdaq parsing/chunk de-duplication/provider attribution, empty
  fail-closed behavior, and provider-neutral technical evidence); existing TT gates unchanged.
- **v3.97.1 — the prose learns to talk like retail (owner call on the live Simple
  screenshot: "flowing easily", "core tape" and "working against it" read vague or
  low-leverage).** Copy-only, same derivation, every string still living in its one home:
  the prose leads become the vocabulary retail actually thinks in — **"The bull case right
  now: …" / "The bear case: …"** (empty buckets read "No clear bull/bear case on the board
  right now") — and the band-table verb phrases sharpen: *the crowd is greedy/fearful* (F&G's
  own labels) · *volatility is asleep/spiking* · *long-term rates are falling/climbing* ·
  *credit is cheap and easy / tightening up* · *valuations are sane / **stocks are priced for
  perfection*** (inflation cooling/running hot kept). WHY #1's "Core tape:" → **"The
  scoreboard:"** in both its branches. The two A1 mock-narration pins moved to the new label
  — after a rename `!/Core tape: SPY \$/` passes **vacuously** and guards nothing (the v3.54
  vacuous-assert lesson), which is exactly how a renamed label would have let mock numbers
  narrate again undetected. Tests: 1544 smoke + 248 render + 138 public-render re-pinned on
  the new copy, totals unchanged.
- **v3.97.0 "SHAREABLE SIMPLE" — newbie bull/bear prose + the live S-tier picks strip
  (owner call: Simple is the share-with-friends page; Power is the operator view).** Two
  builds and a latent-crash fix. **(1) The Simple hero speaks in DIRECTIONAL verb phrases.**
  The newbie audit of the first draft caught its own defect: a bare noun list misleads —
  "working for the market: inflation" reads as inflation-is-good when the factor is bullish
  because inflation is COOLING. Each `REGIME_BAND_TABLE` entry now carries a
  **`plainBull`/`plainBear`** pair beside its `plain` noun (one home per band, no parallel
  copy-table), and `postureSummary` returns `prose` — *"Working for the market right now:
  inflation is cooling and money is flowing easily. Working against it: valuations are
  stretched."* — from the SAME buckets as the sentence (one derivation; an empty bucket
  states itself, both empty → null, withheld renders nothing). **The hero SWAPS by mode,
  never stacks**: prose in Simple, the compact one-liner in Power. The v3.96-defended 540px
  glance budget HELD without loosening — the prose block runs tighter (lineHeight 1.35) than
  the sentence it replaces, measured 536px at 390×844. **(2) `/api/picks` — the ONE
  deliberately-public book projection.** Verified first: no endpoint leaked book content
  before this (all PIN-gated), so the exposure is an explicit owner opt-in, bounded by a
  WHITELIST projection (the readout.json pattern): S-tier entries only, `{sym, tier}` plus
  an optional owner-authored **`share_note`** (trimmed, truncated at 140 — never silently
  dropped), book array order (never re-sorted by a metric the endpoint refuses to publish —
  sorting by upside would leak the ranking), `{picks:[]}` on any fault, 5-min public cache
  so anonymous traffic can't hammer KV. **`SharedPicks`** renders it at the bottom of Simple
  with the not-advice line and the book's asOf: live-fetched data ONLY — a failed fetch, an
  empty list, or a demo build renders NOTHING (mock conviction is the v3.1 invariant's exact
  target), chips are divs never buttons (a dead button is a lie), and the strip shows on
  BOTH routes — hiding it on `?view=public` while the JSON is world-readable would be
  theater (the A4 gate on the operator Watchlist is untouched). The fetch lives in the
  orchestrator (sections stay presentation-only). **(3) Watchlist crash fixed**:
  `Watchlist.jsx` read `d.watchlist` after the wave-9 extraction renamed the prop — a
  ReferenceError on expand, latent only because the panel defaults closed. **Deferred,
  named:** the moon vocabulary in front of newbie friends (locked ruling, but it predates
  this audience — owner call, cheapest fix is a Simple-only gloss line); a terminal card
  input for `share_note`; A-tier joining the strip; retiring the curated example Watchlist.
  Tests: **1544 smoke** (+17: the verb-phrase pairs, `postureSummary.prose` EXECUTED through
  both/one/empty/unknown-key buckets, the swap pin, `projectPicks` + the handler RUN against
  a fake KV — whitelist leak sweep over a maximally-rich entry, sym validation, note
  truncation, KV-fault degradation, the cache header, the stated no-auth exception — and the
  section's presentation-only/render-nothing/no-button/call-site pins; negative-controlled:
  leaking `rank` into the projection and dropping a verb phrase each turn the suite red) +
  248 render + **138 public-render** (+8: the directional prose live with the compact
  sentence proven absent in Simple and returning in Power, the no-feed strip absence, and
  the picks scenario on the `?view=public` route — syms + note + asOf + no buttons + the
  strip measured BELOW the key numbers).
- **v3.96.0 — TT receipt integrity follow-up + response contract.** Closed-market pricing now
  binds to the exact most recent completed-session candle instead of carrying an arbitrary quote
  for a fixed number of hours; the 15-minute rule remains intraday. The changed quote/advisory
  meaning advances receipts to `tt-analysis-v2` / `tt-gates-v2.2.0`, so cached v2.1 results fail
  closed instead of being reinterpreted. Reviewed-packet retraction is
  an authenticated, version-matched `DELETE` that leaves typed street and dependent-analysis
  tombstones plus immutable history. Estimate divergence reads the attested receipt revision
  context before the legacy belief ledger. Workers AI receives only a separately stored,
  explicitly approved, bounded `aiRubric`; the full private framework is never parsed as an
  implicit approval. `NETCASH` is year-aware, and the board/export names the retired
  implicit-zero target/rank beside the measured-only result. Every TT-run response must end with
  a surface-labeled composite, a basis/horizon/source-labeled PT, and an explicit `BUY`, `WAIT`,
  or `SELL` call; missing values print `UNAVAILABLE`, and diagnostic/canonical surfaces are never
  blended. `BUY` still requires the canonical ELIGIBLE NEXT DOLLAR line; `SELL` still requires an
  explicit forced-exit, kill, or over-cap trim rule.
  The inherited v3.95 Simple-view whys row is tightened by 1px per vertical edge so the locked
  540px glance budget holds in the current real-Chrome harness; the ceiling is not loosened.
- **v3.95.0 — the whys come back to Simple, behind ONE remembered expander (owner call on
  a live Simple screenshot).** v3.94 put the reasoning group behind `!simple`, which made the
  Simple view clean and left it unable to answer the one question a newcomer asks next: the
  five why statements were **not reachable at all** without switching to Power. The fix is one
  expander directly under the hero sentence, labelled for what the reader wants (**"why this
  posture — 5 whys"**) rather than for the method, holding the chain and nothing else — chips,
  the factor tally, the flip line and the evidence matrix stay Power-only, so this adds the
  NARRATIVE layer without the technical one. **The open state is remembered per device**:
  `CollapsedGroup` gains an optional **`persistKey`** (`md:exp:whys:v1`, shared by both call
  sites — the same block at two altitudes, one preference), so a reader who wants the chain
  does not re-open it every visit. Persistence is deliberately **OPT-IN**: every other group
  demotes stale or curated content, and a remembered "open" there would quietly undo FEAT-321.
  A storage fault or an unrecognized stored value falls back to the caller's stated
  `defaultOpen`, never to a guessed one. **The glance budget is re-pinned 520→540 WITH the
  reason** (the v3.45 legitimate-content precedent, not a budget quietly loosened): the
  expander is one toggle row and measured **+10px, 520→530** at 390×844 — chrome creeping back
  still fails the build. The main sentence is unchanged: it is `postureSummary`'s honest
  one-liner and already fits one scannable line; shortening it further would cost a named
  factor, which is the trade this project does not make.
  Tests: **1521 smoke** (+4: persistKey opt-in, `readOpen` EXECUTED through the storage-fault
  and unknown-value paths, the Simple call site, and a sweep proving the technical layer stayed
  Power-only) + 247 render + **130 public-render** (+4: the expander present-and-closed on a
  first visit with no `WHY #1` in the body, one tap opening the full chain, the technical layer
  proven NOT to come with it, and the open state surviving a real reload).
- **v3.94.0 "SIMPLE/POWER" — three-layer progressive disclosure, Simple by default (owner
  directive: "audit the key drivers and only show those — everything else 2-3 clicks
  away").** The overview adopts the glance → explain → dig model. **Layer 1 (SIMPLE, the
  default)**: the verdict + the plain-English sentence (moved INTO the hero — one render
  site beside the verdict it explains; the standalone WHY block is gone) + ONE confidence
  status line (`N/M factors voting · excluded names · ⚠ crash-gauge warning` — moved from
  Signal Quality so the hero and the strip can never disagree) + the Signal Quality census
  one-liner + the macro strip's key numbers. Nothing else renders — not collapsed, absent.
  **Layer 2 (one explicit tap)**: the hero's ℹ evidence panel now holds the tally, the
  factor chips and the flip sentence (formerly first-screen); the REASONING group holds the
  5-why chain + WHAT CHANGED under one honest label carrying the change count. **Layer 3**:
  the existing expanders (factor evidence, full market detail, per-source health). The
  **Simple | Power toggle** lives in the top bar (real buttons, aria-pressed, 44px targets),
  persisted per device (`md:view:v1`); an unknown stored value falls back to SIMPLE — the
  safe default is the readable one. **Red facts ignore the mode** (v3.25): the ERROR banner,
  FIRED/BLIND badges and the hero's crash-gauge warning render in both, proven live (the
  Simple scenario runs with VIX missing and asserts the warning). Power = the full
  analytical view, byte-for-byte content-complete: nothing was deleted, only layered.
  In Simple the key numbers begin ≤520px at 390×844 (pinned); the Power budget pins from
  v3.93 hold (re-targeted to the reasoning row). The legacy suite scenarios seed the
  persisted Power preference (they assert the full view — a returning power user's device);
  a new scenario proves the Simple default, the Layer-2/3 DOM absence, the toggle, and
  persistence across reload. StickyNav is Power-only (its anchors point at hidden sections
  in Simple — a nav to nowhere is a lie).
  Tests: 1517 smoke (10 pins re-pinned on the layer moves — confidence to the hero, the
  ℹ-panel flip/chips, the census-only strip, the A4+Simple gate, the toggle's thumb
  targets) + 247 render + **126 public-render** (+8: the Simple scenario incl. the glance
  budget and red-facts-in-Simple; every whys/chips/flip assertion re-pathed through its
  layer) + `audit:prod` clean.
- **v3.93.0 "QUIET-2" — the second pass, screenshot-MEASURED (the v3.42 stance-budget
  method).** v3.92 collapsed the why chain; the owner's next screenshot (LIVE · MOONING)
  showed where the remaining fat was, and a headless 390×844 measurement of the built bundle
  named it exactly: **first market data began at 782px of 844** — the entire first screen was
  verdict prose — with WHY-THIS-POSTURE costing 154px, the *collapsed* whys still costing
  100px (three rows of chrome for a closed block), and the drivers eyebrow 77px. The common
  defect: **three blocks each restating the "N of M usable" fact the hero already states.**
  Three cuts, all measured before/after: **(1)** the whys block is ONE toggle row — the
  section header and the regime line left the closed view (the line is a byte-for-byte
  duplicate of the hero verdict 100px above, so v3.25 is satisfied by the hero; it rides
  INSIDE the collapse as the chain's own anchor). 100→44px. **(2)** the posture-summary
  bucket grid is **CUT outright** (the v3.43 Yahoo-dupe rule): it restated the sentence
  above it and the hero chips above that — the same facts a third time — and the first
  attempt (a toggle) measured within 3px of the grid it hid, proving a menu was not the fix;
  the sentence carries the whole claim, `postureSummary`'s groups stay computed and
  smoke-tested in evidence.js, and the per-factor detail lives in the Drivers expander
  (public-render proves the relocation, not just the absence). 154→107px. **(3)** the
  drivers eyebrow folded into its own toggle row — two rows were saying one thing; the count
  summary stays visible while closed. 77→48px. **Net: first data 782→663px** (ERROR state
  671→606), and the budget is PINNED — first market data ≤700px at 390×844 and the closed
  whys ≤60px tall, measured live in Chromium, so chrome creeping back fails the build.
  Also in the owner's screenshot: "takes a while but it decides mooning eventually" — that
  is the designed degraded-day behavior (LOW/MEDIUM-confidence snapshots carry 5–15min TTLs,
  so an evening visit can pay a full rebuild; the 8am ET pre-warm covers mornings), and the
  4/6 MOONING read (10Y·VIX excluded) is the Saturday publisher lag, not a defect.
  Tests: 1517 smoke (3 pins re-pinned on the new structure) + 247 render + **118
  public-render** (+3: the two budget pins and the relocation proof) + `audit:prod` clean.
- **v3.92.0 "QUIET OVERVIEW" — the 5-why chain goes one tap deep (owner call, REVERSING
  v3.61/v3.62's "full 5 Whys stays expanded").** A live phone screenshot of the DATA-HOLD
  state: the overview rendered ~2 screens of prose — five full why-paragraphs plus the hero's
  two-line explainer — for a page whose entire message was "nothing is callable". Owner
  verdict: *"too wordy, much of this can be hidden with menus."* The same collapse discipline
  v3.42/v3.66/v3.69 applied elsewhere, now on the overview: **the why CHAIN (headline, five
  whys, rule-based footer, SourceBox) collapses behind the house `CollapsedGroup`**
  (chip-free — live evidence, not curated), while **the regime state line stays OUTSIDE the
  collapse** — it is this block's one red/amber fact, so v3.25 holds: DATA HOLD is visible
  while closed. The hero's withheld explainer shrinks to one line, keeping the pinned
  "mock baseline is NOT voting" honesty literal. The v3.69 always-expanded smoke pin is
  formally REVERSED (the reversal note lives at the pin), and the public-render suite now
  proves BOTH states: closed by default with the regime state visible and WHY #1 absent,
  then open-then-read for the LOADING/ERROR anchors ("0/3 core inputs usable") — the anchors
  themselves are unchanged, they just sit one tap deep. Screenshot triage note: the ERROR
  banner in the same screenshot was a transient deploy-window fetch failure (the API measured
  healthy at 200/0.66s immediately after) — B1's RETRY is the designed recovery, no defect.
  Tests: 1517 smoke (1 pin reversed with the ruling documented) + 247 render + **115
  public-render** (+1: the closed-state proof) + `audit:prod` clean.
- **v3.91.0 "the integrity fixes" — the v3.90 audit's ten findings, closed.** The owner-
  commissioned ambiguity audit of FEAT-TT-V2 found ten; every one now has a ruling, most have
  code, all have tests (`TT_ENGINE_VERSION` → `tt-gates-v2.1.0`, since two changes alter what
  a receipt of a given version means). **(1) Strict Engine 0 parity** — v3.90's stance()
  already vetoes on absent actionability; now PROVEN in the same breath as the street path
  (absent → macro UNKNOWN → WAIT), so the two surfaces can no longer diverge on a cached
  legacy readout. **(2) Session-aware quotes** — the 15-minute rule is an intraday claim;
  applied around the clock it made street eligibility perpetually WAIT after 16:16 ET.
  `quoteGate` reads the SAME readout's `session` the macro gate consumes (one clock): OPEN →
  strict 15min; closed → the last-close print passes inside a 72h carry window with the
  session NAMED; unknown session stays strict (fail closed, never assume closed). **(3)
  Report-only binaries** — the BINCAL doctrine (v3.26, "reports, never enforces") now holds
  on BOTH surfaces: the binary gate still evaluates but sits OUTSIDE the eligibility set as
  `receipt.binary`; ≤10d yields a named warning, never WAIT — the v3.90 doctrine inversion
  (one fact enforced on one surface, reported on the other) is gone. One v3.90 pin flipped
  DELIBERATELY with it: a stale calendar now warns instead of blocking. **(4) Tombstones** —
  merge-only + immutable history had no retraction path for a wrongly-CONFIRMED packet:
  `POST /api/street?void=1` appends an audited `tt-street-tombstone-v1` (reason REQUIRED —
  an unexplained void is an unexplained number; version must match or 409 with the server's
  copy) and removes the current record so every gate honestly reads WAIT until re-confirm.
  Nothing is ever deleted from history. **(5) Street-based divergence** — estimate intake now
  moves through street packets, which never emit ledger `est` entries, so the CRDO flag was
  going progressively blind. The server stamps `lastEstRevision {at, dir, px}` on the current
  record (direction from the revision's own eps/revenue changes — mixed is NOT a direction;
  px from the same tt:quote cache the ledger stamps from); `computeDivergence` reads it
  FIRST, ledger fallback for legacy names. Found by the suite on first run: the stamp itself
  tripped the identical-re-submit diff — `lastEstRevision` is derived metadata and joins
  `storedAt`/`version` in the revision-comparison strip. **(6) NOCASH** — the net-cash
  migration audit: v3.90 retired the implicit `net_cash_B=0`, silently dropping premium rungs
  to floor-only, indistinguishable from a deliberate floor. `lintPtModel` names it at both
  altitudes (explicit 0 stays quiet — it is an honest value), edited identically in both
  byte-identity-pinned homes. **(7) No street-side composite ordering** — the street list is
  pinned to order by the LICENSED gap, never its diagnostic composite (the v3.36
  two-rankings lesson). **(8) Widened boundary pin** — the isolation guard now covers
  `UPSIDE_ROWS`, `AGREE_PICK` AND `LAST_RANK` across the WHOLE street path, not 2200 chars
  of one function. **(9) Rubric redaction** — v3.90 sliced the first 12KB of the ENTIRE
  private framework into the Workers AI prompt (gates, thresholds, R/R floors, tax routes);
  `rubricSection()` now extracts ONLY the marked "## Qualitative Rubric" section, and an
  unmarked framework yields UNKNOWN with the fix named — the full document is never the
  fallback. **(10)** resolved by (1)+(8): the ownership table's "may veto readiness" wording
  is retired — the surfaces are fully decoupled, influence in neither direction.
  Contract addendum in `ticker-terminal/TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`.
  Tests: **1517 smoke** (+11 behavioral: parity, the session/carry boundaries at 20min/10h/
  80h, report-only proven as warning-not-blocker at the 10d edge, tombstone lifecycle against
  a fake KV with real auth, estRevisionDir up/down/mixed/none, street-first divergence with
  ledger fallback, NOCASH three ways, rubric extraction incl. the full-doc-slice absence pin;
  3 v3.90 pins re-pinned on the new contract) + **247 render** + 114 public-render +
  `audit:prod` clean.
- **FEAT-TT-V2 (v3.90.0) — reviewed street inputs → sourced facts → attested street-eligibility
  receipts.** The old
  ranking could not work from the intended inputs: `ptModelRows()` required owner multiples,
  shares and sometimes net cash; TipRanks-shaped `pt_consensus` was display-only and would
  arithmetic-average low/average/high into a fabricated fourth target. The operative path now
  has three ownership classes and KV stores: reviewed SA/TipRanks packets (`tt:street:*`),
  merge-only Finnhub/SEC facts (`tt:facts:*`), and server gate receipts (`tt:analysis:*`). The
  screenshot route accepts at most three bounded image files, sends them to Workers AI in-memory,
  returns a review draft, and cannot persist; only explicit CONFIRM calls the validated street
  route. Immutable street and receipt histories retain every revision instead of the belief
  ledger's lossy three-change cap.
  The shared pure engine consumes TipRanks' **published 12-month average**, derives explicit-period
  revenue/EPS growth and forward P/E without chart interpolation, renormalizes missing composite
  pillars rather than scoring them zero, and derives ATR/pivots/support/stop/R-R from sufficient
  sourced daily candles. Every gate emits PASS/FAIL/UNKNOWN with reason/evidence; eligibility is
  all-PASS only. Engine 0 HOLD/blind health, a quote older than 15 minutes, unknown quote currency,
  stale licensed inputs, missing citations/technicals/calendar, sub-floor R/R, or an event ≤10d
  fails closed. RESTRICTED remains a visible, named veto: only FULL may gate capital. Receipts
  bind street confirmation, facts update, Engine 0 as-of/actionability/verdict/flip, input hash,
  result hash and engine version; changing any input invalidates the displayed result.
  This is an additive evidence and eligibility surface: the canonical `/api/score` underwriting
  score and the portfolio-aware **NEXT DOLLAR** framework remain authoritative and are never
  overwritten by the receipt's diagnostic composite. Position weight and the 18% cap cannot veto
  a street receipt; they remain visibly separate portfolio constraints. Legacy
  `pt_model`, `projection`, and `pt_consensus` stay readable during migration but are labelled
  optional/comparison-only. Missing net cash no longer equals zero in legacy EV/S math, partial
  year-map overrides merge rather than erase sibling estimates, and an explicit legacy average is
  read directly instead of re-averaging aggregates. The exact NVDA screenshot packet calibrates
  the offline acceptance math, including the HOLD override and 10-day event boundary; synthetic
  desktop/phone tests cover OCR-before-confirm, independent persistence, receipts, published-target
  comparison, position independence and HOLD invalidation. The dated implementation contract is
  `ticker-terminal/TICKER_TERMINAL_LOGIC_REDESIGN_PLAN_2026-08-15.md`.
- **THE ROBINHOOD SYNC RUNBOOK (FEAT-TT-ALLOC, v3.100 — supersedes the old "Deferred:
  stored fundamentals + Robinhood sync" note; the x-tt-pin path it anticipated is exactly
  how this works).** The sync is CHAT-SIDE: a TT session holding the Robinhood MCP tools
  pulls measured facts and PUTs them merge-only to `/api/positions` with the `x-tt-pin`
  header. The server never talks to the broker; the broker credential never enters
  Cloudflare. A missed sync does NOTHING — `POS_STALE_D` (exported by `positions.js`, the
  one home) degrades allocation to WAIT, never to wrong answers.
  **Tool → field mapping:**
  · `get_portfolio` / `get_accounts` → the `account` sibling `{equity, cash, buying_power?,
    debt?, at, src}` (validateAccount; `acct` is a MASK, last-4 at most, hard-capped 16ch)
  · `get_equity_positions` → `pos.{sh, mv, cb, upl_pct, at, src}`; **`pct` is computed
    chat-side as `mv / account.equity × 100`** (the formula stated here so the number is
    checkable — the board's asserted `account.formula` rule, applied to the sync)
  · `get_equity_tax_lots` → `pos.lots[] {acquired, sh, cb}` — ST/LT is DERIVED at
    evaluation (>365d), never stored, never advice
  · `get_option_positions` (+ `get_option_quotes` for marks) → `pos.opt[] {k, side, n, exp,
    mv (SIGNED — short legs negative), src:"sync"}`; Greeks only if the quotes API actually
    returns them — verified at sync time, never approximated
  · a fully exited name → `{sym: null}` (the explicit removal path).
  **STAMP IN ET, NEVER `toISOString()` (2026-08-24 sync, caught BEFORE it fired — the
  FIX-A defect class, fifth recurrence: v3.11 run stamps, v3.35 render fixtures, v3.80 a
  test's own fixture, v4.1.1 `ageDays` itself).** Every `at`/`asOf` this sync writes is
  judged by ET-calendar time-judges (`ageDaysEt`, `POS_STALE_D`, `validateAccount`). A
  sync run after ~8pm ET that stamps `new Date().toISOString()` writes TOMORROW's date —
  the whole payload reads future-dated and fails closed, the freshest data in the store
  rejected as invalid. Stamp the ET calendar timestamp (e.g.
  `toLocaleDateString("en-CA",{timeZone:"America/New_York"})` + ET wall time, no `Z`).
  **SCOPE: the ONE tradable account only (owner ruling, 2026-08-24 sync).** Positions held
  in other accounts (e.g. SOFI, SPCX in the Long-term account) are DELIBERATELY outside the
  store — one store, one `pct` denominator; mixing accounts would corrupt every cap check.
  Consequence, so nobody "fixes" it: a book name held only in an unsynced account reads
  **"new — not held"** on the board, which here means *not held in the synced account* —
  known, accepted, and cheaper than a wrong denominator.
  **DO NOT STORE:** full account numbers, order history, open orders, watchlists, or
  anything from the broker's recommendation surfaces — the store holds POSITION FACTS only.
  **The allocation layer this feeds:** `/api/allocation` (PIN-gated) re-derives the
  eligibility ladder and the 5-tier funding ranking server-side and persists hash-bound
  receipts; owner confirmation persists INTENT only. No broker order call exists anywhere
  in this repo — smoke pins the absence of `place_equity_order`/`place_option_order` from
  the terminal and every function.

## Cloudflare deployment

### Pages (the site + `/api/*`)
- Connect repo in **Workers & Pages → Pages → Connect to Git**. Preset **Vite**,
  build `npm run build`, output **`dist`**. Every push to `main` auto-redeploys.
- **`PULSE_CACHE` KV** must be bound to the Pages project (namespace id
  `78ad3346a8fe4757a906283c4bc81a5e`).
- **`FRED_KEY` secret** set in **Pages → Settings → Variables & Secrets**. Read by
  `snapshot.js` as `env.FRED_KEY`. **Secrets live only in Functions/Worker env — never
  in `src/`** (the browser only ever talks to `/api/*`, which holds no key in `fred.js`).
- **`FINNHUB_KEY` secret** (v3.0, optional but needed for live QQQ/Mag-10 prices) set the
  same way. Read by `fetchEquities` as `env.FINNHUB_KEY`; **without it those tiles stay mock**
  (graceful degradation, nothing breaks). Free tier is enough (~10 symbols once/ET-day).
  **Post-deploy: verify Finnhub isn't edge-IP blocked** the way Stooq was — `?debug=1` →
  `_diag.equities` should read `ok:N`; if blocked, swap to Twelve Data (same shape). The
  tokenomics moat (OpenRouter) needs **no key**.
- **TT v2 provider requirements:** bind Pages Workers AI as **`AI`** for screenshot vision and
  the explicitly approved redacted qualitative rubric (never the full private framework); set
  **`SEC_USER_AGENT`** to a descriptive application +
  contact string for `data.sec.gov`; retain `FINNHUB_KEY` for quotes/profile/calendar/news. The
  selected Finnhub plan must entitle daily `/stock/candle` history. Missing AI, SEC identity, or
  candle entitlement is an honest degraded state: manual street entry remains available, but any
  dependent qualitative/technical gate is `UNKNOWN` and the ticker stays `WAIT`.
- `_middleware.js` adds hardening headers (`nosniff`, `x-frame-options: DENY`,
  `permissions-policy`, etc.) and keeps `/api` same-origin (no `Access-Control-Allow-Origin`).

### Cron Worker (`worker/`, deployed separately)
- `cd worker && npx wrangler deploy`; secrets per `worker/SETUP.md` §3.
- Binds the **same `PULSE_CACHE` KV namespace** (so its writes are visible to Pages).
- **Four** weekday crons (UTC — see the DST note in `wrangler.toml`; shift +1h for standard
  time twice a year, **in TOML and cron.js together** — dispatch is exact-string): two
  *legacy* FRED pulls (write `pulse:macro:latest`, 26h TTL), the **8am ET pre-open warm**
  (no secret), and the **10am ET force-refresh** (`REFRESH_TOKEN`, set on BOTH the Worker
  and Pages — without it the job degrades to a GET, a cache hit after the warm).
  (This line said "Two weekday crons" for ~30 releases after the snapshot jobs landed —
  the 2026-08-17 ambiguity review caught it; smoke now reconciles TOML ↔ cron.js.)
- **The legacy pair is the older "stage-1" path.** The dashboard has flipped to
  `/api/snapshot`; `/api/fred` + those two crons remain deployed as a fallback/safety net.

### Environment matrix (which deploy owns which secret)
| Variable | Deploy | Required? | Feature | Absent ⇒ |
|---|---|---|---|---|
| `FRED_KEY` | Pages + Worker | for live macro | FRED snapshot + legacy crons | macro tiles mock |
| `FINNHUB_KEY` | Pages | optional | QQQ quotes + TT quotes/facts | equities mock |
| `OPENROUTER_KEY` | Pages | optional | token VOLUME (Q leg, v3.89) | volume mock; price leg unaffected |
| `KALSHI_KEY_ID` + `KALSHI_PRIVATE_KEY` | Pages | optional | keyed Kalshi transport (v3.99.1) | anonymous transport (shared 429 bucket) |
| `REFRESH_TOKEN` | Pages + Worker (same value) | for 10am force-refresh | `POST /api/snapshot/refresh` | GET fallback = cache hit, no refresh |
| `REFRESH_SECRET` | Worker | legacy only | Worker's own `POST /refresh` | endpoint 403s |
| `DEBUG_TOKEN` | Pages | optional | `?debug=<token>` diagnostics on `/api/snapshot` **and** `/readout.json` | diagnostics off for everyone (fail closed) |
| `TT_PIN` (or `ACCESS_TEAM_DOMAIN`+`ACCESS_AUD`) | Pages | for the terminal | `/api/tt` + every PIN-gated route | 503 fail closed / Access mode |
| `SEC_USER_AGENT` | Pages | for TT facts | `data.sec.gov` fetches | SEC facts UNKNOWN → WAIT |
| `AI` (Workers AI binding) | Pages | for TT OCR | screenshot→draft + rubric | OCR route degraded, gates UNKNOWN |

### The `VITE_DATA_MODE=live` flip
`useMarketData.js` reads `import.meta.env.VITE_DATA_MODE` (Vite **build-time** env):
- **`mock` (default)** — no network at all; the dashboard renders pure `MOCK_DATA`.
- **`live`** — fetch `/api/snapshot` on mount and overlay.

**`.env.production` now commits `VITE_DATA_MODE=live` as the build default** (v2.8.1), so
production builds (incl. Cloudflare Pages) fetch live without any dashboard setting. An
explicit `VITE_DATA_MODE` var in the Pages build env still **overrides** the file (Vite
precedence), so set it to `mock` there to force demo. Either way it's baked at build time,
not read at runtime. Mock remains the always-present runtime fallback (graceful degradation).
(`VITE_PUBLIC_VIEW=true` is the analogous build flag for forcing the public view.)

### Per-day cache pattern (`snapshot.js`)
- Cache key is **`pulse:snapshot:v16:<ET-date>`** (`<ET-date>` = today in America/New_York,
  `YYYY-MM-DD`). Bump the `v15` prefix to invalidate a poisoned day.
- **First load each ET morning** misses → fetches fresh (FRED's prior close has settled
  overnight) → write-through. **Every load the rest of the day** hits KV → instant,
  badge = `CACHED`. *Your morning visit is the refresh trigger* — the snapshot path needs
  no cron.
- **Write-through is now a QUALITY compare, not a boolean** (ENGINE0-CONT, v3.63):
  `publishIfNoWorse()` builds the candidate's own readout and refuses to replace a stored
  snapshot that scores better on the lexicographic `readoutQuality` tuple — so a partial
  rebuild can never overwrite a good morning warm. The old named-field `quorum()` survives
  and still drives `_diag.healthy`/`settled`, and `settled:false` still forces the short TTL.
- **TTL rides CONFIDENCE, not a flat 48h**: `chooseTtl()` → `CACHE_TTL` 48h only at HIGH
  confidence on a settled close, `TTL_MEDIUM` 15min, `TTL_LOW` 5min. Consequence worth
  knowing: on a degraded day the day's key expires every 5–15 minutes and the next visit
  pays a full rebuild, so *"your morning visit is the refresh trigger"* holds only while the
  evidence is HIGH. Deliberate — a degraded day is exactly the one that should retry.
- Fetches run in **phases** (FRED batched — the two Engine 0 criticals VIX/DGS10 FIRST at
  concurrency 2, the rest ≤5 — then SPY + NASDAQ100 + scrapers) to stay under Cloudflare's
  ~6-connection cap; saturating it makes queued calls time out. Don't collapse these back
  into one big `Promise.all`, and don't un-prioritize the critical head.

## Commands

```bash
npm install
npm run dev        # Vite dev server (mock unless VITE_DATA_MODE=live in .env)
npm run build      # → dist/  (what Pages runs)
npm run preview    # serve the built dist/

npm test              # no-network smoke suite (needs Node ≥20)
npm run test:ui       # browser render test for admin.html (skips if no Chromium)
npm run test:public   # build + browser STATE test for the public dashboard (skips likewise)
npm run audit:prod    # production-scope dependency audit
npm run gates         # all four in order, failing on the first red (never hand-chain them)

# Cron Worker (separate deploy):
cd worker && npx wrangler deploy
npx wrangler secret put FRED_KEY
```

`npm test` runs the smoke suite. It loads the real `MOCK_DATA` out of `dashboard.jsx` to
catch `sources.js` ↔ dashboard drift, so it must stay green when you touch either file or
any `SOURCES` path. (This paragraph read "there is **no** `test` script" for many releases
after one was added — 2026-08-02 audit §5, the same defect class as the stale status header.
Assertion counts are deliberately not quoted here; the suite prints its own total.)

**CI** (`.github/workflows/test.yml`) runs all four on every push and pull request with
`REQUIRE_BROWSER=1`, so a missing browser fails the run rather than skipping the gate.

## Conventions worth knowing

- **Ticket tags in comments** (`FEAT-NNN`, `AS2-NN`, `DEC-NN`, `DECISION-N`) trace each
  change back to a spec item. Match the style when adding features.
- **One wiring point**: all live-data plumbing goes through `useMarketData` + `sources.js`.
  Add a live field by mapping it in `SOURCES` and emitting it from `snapshot.js` — don't
  reach into `dashboard.jsx` to fetch.
- **`App.jsx` must not modify `dashboard.jsx`** (T2 scope rule). The `publicView` Zone-E
  gate is wired but currently has nothing to hide (no private section in this build).
- Keep the inline `DT` design tokens as the styling source of truth; reuse `T.*` aliases.

---

<!-- The sections above are derived from the code. The notes below capture decisions
     and conventions that are NOT visible in the source — fill in / correct as needed. -->

## Project conventions & locked decisions

### Working rhythm (per-pass protocol)

- **Before every pass**, review what has materially changed since the last response.
- **Findings live on the BRANCH, not in the chat.** Any survey, audit, matrix or read-through
  that a later pass would want gets a dated file in **`working/`** (`working/<YYYY-MM-DD>-<slug>.md`)
  and is committed. Chat scrollback is not a record: it is unsearchable from a fresh session,
  it does not survive a context summary, and it cannot be diffed against the code it describes.
- **The finding file is UPDATED WHEN THE WORK LANDS, in the same pass** — never left as the
  pre-implementation snapshot. Append an **Outcomes** section carrying the commit SHAs, the
  gate totals, what shipped, what was deliberately left, and — load-bearing — **every place
  the original survey turned out to be WRONG, recorded as a correction rather than silently
  edited away.** A survey that only ever describes the plan becomes a confident, stale claim
  about the code: the exact label-outlives-its-data defect this changelog keeps closing, filed
  one level up. Keep the original text and let the correction stand beside it.
- **`working/` is notes, never a product surface.** Nothing in `src/`, `public/` or
  `functions/` may import it, and it must never be the home of a fact the code needs.
- **After every TT run**, end with one compact line per requested ticker in this shape:
  **`SYM — Composite: <score>/10 (<surface>) · PT: $<value> (<basis>, <horizon>, <source>) ·
  Call: BUY|WAIT|SELL — <governing reason>`**. A missing score or target prints `UNAVAILABLE`
  plus the missing gate; it is never omitted or backfilled. Canonical `/api/score` composites
  and owner-model PTs are labeled separately from street diagnostic composites and TipRanks'
  published 12-month average—never blend the two or choose the more favorable result. `BUY`
  requires the canonical **ELIGIBLE NEXT DOLLAR** line to name that ticker; `SELL` requires an
  explicit canonical forced-exit, kill, or over-cap trim rule. Diagnostic `ELIGIBLE`, target
  upside, or a funding-priority row alone is not a buy/sell call. Every other state, disagreement,
  missing gate, or unavailable governing surface is `WAIT`.
### TT macro gate — the product vocabulary (locked, v5.6)

- **SEND IT · HODL · TOUCH GRASS** is the product gate; **`FULL` · `RESTRICTED` · `HOLD` are the
  Engine 0 machine aliases** and never appear as product words. ONE derivation
  (`macroGateFrom`, a projection of the eligibility ladder's own RESULT), so the word can never
  disagree with the veto it names.
- **SEND IT is the only state that clears a macro-dependent add.** HODL is a visible,
  still-vetoed looking session (`RESTRICTED`); the fail-closed doctrine is unchanged, and
  every unreadable state resolves to TOUCH GRASS.
- The **`GATE:` prefix is load-bearing** — the public call's middle is ALSO the word HODL
  (`md-call-v1`), and one word carrying two verdicts on one screen is the v3.51/v3.62 defect.
- **Rank receipts EXTEND `tt-alloc-receipt`; they are never twinned.** Outcomes score
  **attested days only** — there is no auto-stamp anywhere.

- **End every pass with**, in this order:
  - **Completed** — what got done this pass (**max 2 bullets**).
  - **Highest-leverage question** the maintainer can answer (1 bullet).
  - **Highest-leverage next move** (1 bullet).

_(More locked decisions — `ROADMAP_v2.5_v3.0.md` Section A — to be folded in during roadmap Phase 0.)_
