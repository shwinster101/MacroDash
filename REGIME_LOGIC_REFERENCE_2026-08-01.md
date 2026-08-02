# Regime Logic Reference — MacroDash + TT Ticker Terminal

**Stamped:** 2026-08-01 ET (2026-08-02 UTC — the distinction is load-bearing; see §5.2)
**Covers:** `origin/main` @ v3.55.0
**Status:** descriptive reference, generated from source. Where this file and the code disagree, **the code is right and this file is stale.**

---

## 0. Scope — and what this file deliberately does NOT contain

This documents the **implemented regime logic that already lives in the public repository**: band tables, aggregation rules, abstention rules, the provenance layer, and how the terminal consumes them.

It does **not** contain the owner's TT framework — routing, kill-gates, the 5-pillar composite, R/R floors, position-cap doctrine, tax routes, standing rulings R1–R5, or any book content. That document lives **only** in KV (`tt:framework:v1`, PIN-gated on read and write) because **this repository is public**. `test/smoke.mjs` asserts it is absent from the repo. Nothing here should be treated as a substitute for it.

Numbers below were verified against source at the stamp date.

---

## 1. Two engines, married never merged

There are **two** regime verdicts. They are structurally different, both legitimate, and they answer different questions. Before v3.51 they were unnamed, which meant a reader could reasonably assume one verdict was contradicting itself.

| | **Macro Backdrop** | **Order-Gating Regime** |
|---|---|---|
| Surface | Public dashboard (`RegimeBand`) | `/readout.json` (`tt-v1` schema) |
| Question | *Is the market backdrop supportive of taking risk?* | *May a specific order be placed right now?* |
| Engine | `computeRegime()` in `src/dashboard.jsx` | `buildTtReadout()` in `src/ttReadout.js` |
| Factors | 10Y · VIX · F&G · CPI · CAPE · NFCI | SPY/200d · VIX · F&G · QQQ-RS · 10Y · Fed odds |
| Verdicts | `RISK-ON` · `MIXED` · `RISK-OFF` · `INSUFFICIENT` | `TAILWIND` · `NEUTRAL` · `HEADWIND` · `PANIC` · `INSUFFICIENT` |
| Consumer | A human reader | The TT terminal, and any external system |

They **overlap on three inputs** (VIX, F&G, 10Y) and diverge on the rest. They are never averaged. Where both are available to the terminal, the **stricter governs** (§6.1).

---

## 2. Engine A — Macro Backdrop (public dashboard)

### 2.1 The band table

Since v3.53 the six bands live in **one table**, `REGIME_BAND_TABLE`, where `vote()` is the *only* expression of a band. `computeRegime` votes from it; `flipConditions` measures distance to the same edges. A second copy of a threshold that gates a public verdict is a future bug with a date on it.

| Factor | Key | Reads | Bullish | Bearish | Neutral |
|---|---|---|---|---|---|
| 10Y Direction | `tenYear` | 1-month Δ (pp) | `< −0.10` | `> +0.15` | between |
| VIX Level | `vix` | level | `< 18` | `> 25` | 18–25 |
| Fear & Greed | `fearGreed` | score | `> 55` | `< 30` | 30–55 |
| CPI Trend | `cpiHeadline` | trend series | latest < prior | rise `> 0.5` from series start | else |
| Valuation | `valuation` | Shiller CAPE | `< mean × 1.5` | `> 30` **or** `> 90%` of ATH | else |
| Fin Conditions | `nfci` | NFCI (SD) | `≤ −0.5` | `> 0` | between |

**Two asymmetries** that make a duplicate table dangerous, both boundary-tested:
- **F&G is the one INVERTED factor** — bullish *above* its edge, not below.
- **NFCI is the one INCLUSIVE bull edge** (`≤`), so it renders "at or below".

NFCI's bands are **deliberately asymmetric**: `0` is the *definitional* mean of a standardized index (crossing it is the event), `−0.5` is half a standard deviation below. A symmetric band would have voted bullish nearly every week post-GFC — a factor that always votes one way does not inform a tally, it biases it.

### 2.2 The majority rule

```js
export function verdictFrom(bullVotes, bearVotes, counted) {
  const bull = counted > 0 && bullVotes > counted / 2;   // STRICT majority of live voters
  const bear = counted > 0 && bearVotes > counted / 2;
  if (bull && !bear) return "RISK-ON";
  if (bear && !bull) return "RISK-OFF";
  return "MIXED";
}
```

Computed from `counted`, never a constant. DEC-31 originally set "≥3 of 5" *explicitly because 3 of 6 is 50%, not a majority*; a hardcoded `3` would have silently recreated that bug when NFCI became the sixth voter. The rule is identical to the old constant at 5 voters (needs 3), correct at 6 (needs 4), and correct at 3 (needs 2, where the constant had demanded unanimity).

**Honest consequence:** with all six live, a directional verdict is *harder* to trigger than with five. `MIXED` becomes more common. That is what adding a voter costs.

### 2.3 Abstention — quorum and the loading state

- **`REGIME_QUORUM = 4` of 6.** Below it the label is **`INSUFFICIENT`**, not a thin verdict. `regime.raw` records what the majority *would* have said — never silent about the withhold.
- **A MOCK factor cannot vote in a live build.** Only `LIVE`/`CACHED` count; gated on `liveBuild` so a pure demo build is untouched (mock *is* the demo's baseline). This gate cannot read `mode`, because `mode:"MOCK"` is ambiguous between "demo build" and "live build whose fetch failed" — only the second must withhold.
- **`LOADING` is not a verdict state.** The posture is withheld outright, the flip line is suppressed, and the moon voice reads `CAN'T CALL IT` rather than defaulting to a directional state.

Four is deliberately **stricter** than the readout's three (§3.2): that consumer knows what `INSUFFICIENT` means, a public reader does not.

### 2.4 Flip conditions — "what would change the verdict"

`flipConditions()` simulates each band crossing through the **same** `verdictFrom` and keeps only crossings that actually change the label, sorted nearest-first.

Three abstention rules:
1. A **stale/excluded** factor is not voting, so its threshold is not load-bearing — listed as excluded, never as a distance.
2. A factor whose vote is **not a single scalar crossing** abstains *with the reason named* (CPI votes on trend shape; CAPE on a two-condition OR).
3. **"No single flip changes this"** is a real answer, stated plainly, never padded with the nearest distance.

Only **adjacent** transitions are offered: from the bull band you can reach neutral, not bear. Quoting "VIX above 25 would flip this" while VIX sits at 17 is true arithmetic and a misleading next step.

Deliberately **not** wired into `/readout.json` — that contract gates real orders.

---

## 3. Engine B — Order-Gating Regime (`/readout.json`, `tt-v1`)

⚠ **This table gates real capital.** Every boundary is smoke-tested (DEC-33). Change a band only with a matching test change.

### 3.1 The six checks

| Check | Bullish | Bearish | Neutral |
|---|---|---|---|
| `spy_vs_200d` | `> +3%` | `< −3%` | ±3% |
| `vix` | `< 18` | `> 25` | 18–25 |
| `fear_greed` | 25–55 | `< 20` or `> 75` | 20–25, 55–75 |
| `qqq_spy_rs` | Δ `> +0.3pp` (leading) | Δ `< −0.3pp` (breaking down) | ±0.3pp (inline) |
| `us10y_trend` | m1 `< −0.10` (falling) | m1 `> +0.15` (spiking) | between |
| `fed_next_meeting` | cut `> 50` | hike `> 50` | else |

`checks` is **always length 6**, in stable order, for audit. A missing input renders `unavailable` — never fabricated.

### 3.2 Aggregation, and two safety overrides

```
available < 3                → INSUFFICIENT   (a 1–2-input verdict must never gate an order)
bullish > bearish            → TAILWIND
bearish > bullish            → HEADWIND
tie                          → NEUTRAL
```

**PANIC override** — `vix > 25` **AND** `fear_greed < 20`. Both inputs must be live. Overrides everything, including `INSUFFICIENT`, because it is the most safety-critical state.

**TAILWIND withhold** — a `TAILWIND` is **not printable while the risk gauge is blind**. PANIC needs *both* VIX and F&G live, so either missing means the override cannot fire, and a risk-on call would be asserted by exactly the inputs that cannot see a crash. Downgraded to `NEUTRAL`, with `regime.raw_verdict` and `regime.downgraded` naming which gauge is missing.

The rule is **deliberately asymmetric**: `HEADWIND` and `PANIC` pass through untouched. A bearish read off the remaining inputs is still safe to act on; only the risk-ON direction needs the gauge.

*Measured 2026-07-30: with stale derivative votes correctly removed, the body went NEUTRAL → TAILWIND on 3 checks with VIX missing — **more risk-on for knowing less**. That is the failure this rule prevents.*

### 3.3 The Macro Flip circuit

| State | Condition |
|---|---|
| `armed` | VIX `> 22` |
| `tripped` | SPY `< 200-day SMA` **AND** VIX `> 25` |

Any missing input → the circuit is **`evaluable: false`** with a `reason` naming what is missing. A blind circuit previously rendered identically to a healthy "not armed" — the crash detector could be unable to see while a confident verdict sat beside it. Both human surfaces now render it: the terminal pill appends `· flip BLIND` (forced amber), and the paste block prints `BLIND — missing: <input>`.

---

## 4. Aggregate inputs

Both engines rest on `/api/snapshot`, assembled at the edge and cached per ET day.

**FRED (17 series):** `DGS10` · `DGS30` · `FEDFUNDS` · `CPIAUCSL` · `CPILFESL` · `PCEPI` · `PCEPILFE` · `UNRATE` · `CIVPART` · `PSAVERT` · `MORTGAGE30US` · `DCOILWTICO` · `VIXCLS` · `CBBTCUSD` · `BAMLH0A0HYM2` · `BAMLC0A0CM` · `NFCI`

Derived server-side: **HY−IG credit spread** and the **10s30s term spread** (v3.55). Fetches run in **phases, batched ≤5**, to stay under Cloudflare's ~6-connection cap — do not collapse them into one `Promise.all`.

**Non-FRED:** FRED `SP500`/10 as the SPY proxy (Stooq blocks edge IPs) · CNN Fear & Greed · Kalshi `KXFEDDECISION` · market RSS headline · OpenRouter token prices · Finnhub quotes · multpl.com Shiller CAPE.

**Curated, never live, never voting:** GPU $/hr · hyperscaler capex tape · tokens/watt index · headwinds register.

---

## 5. The provenance layer both engines rest on

### 5.1 Modes

| Mode | Meaning |
|---|---|
| `LIVE` | Fetched this request |
| `CACHED` | Today's KV snapshot |
| `STALE` | Live-sourced but its observation date is behind its cadence |
| `MOCK` | The always-present fallback baseline |
| `BLIND` | *Cannot evaluate* — distinct from "clear" (alerts, flip circuit) |

`BLIND` vs clear is the load-bearing distinction: *"this has not tripped"* and *"I cannot see whether it tripped"* are different facts, and only the second is true when a feed is dead.

### 5.2 Staleness — and the one clock

`isStale(date, now, cadence)`:
- **daily** — weekday- and holiday-aware; any *completed prior trading session* missing = stale
- **weekly** — stale past ~12 days
- **monthly** — stale past ~70 days (FRED prints are period-dated with a publication lag)

**"Today" is the ET calendar date of `now`, in every runtime** (`etYmd()`). This was v3.49's FIX-A: the old local-midnight truncation advanced "today" at 8pm ET on the UTC edge, counted the just-closed session as missed, and aged normal prior-close data — so `/readout.json` read `INSUFFICIENT` while the same payload in an ET browser read `MIXED`. **A decision system cannot have two freshness realities.** One clock now fixes all three consumers (readout, dashboard `modeOf`, paste projection).

### 5.3 Derived fields inherit their parent's date

`snapshot.js` emits ~30 values with no `AsOf` sibling of their own (`vixWeekChg`, `tenYearM1`, `spyChangePct`, …). `DERIVED_OF` in `src/sources.js` maps each to the parent whose date governs it; `govAsOf()` is the single choke point used by the merge, the dashboard, and the readout. Without it a derivative sails past the gate that just suppressed its own parent — measured live, `tenYearM1` cast a bearish vote off data whose level had been withheld as stale.

The table is **reconciled against `SOURCES` in smoke**, not hardcoded, so a new undated derivative fails the build.

### 5.4 Plausibility bands, and write-through quorum

`BANDS`/`applyBands()` drop out-of-band values *before* render or cache. Bands **reject the impossible, not the unusual** — negative WTI is explicitly allowed (it really happened 2020-04-20), an inverted 10s30s is the signal not a parse fault, and a very long capability doubling time is a genuine stall.

Cache write-through requires a **named-field quorum**: `QUORUM_FIELDS` (the regime's voters) with `QUORUM_MIN = 4`. Below quorum the payload is still served (mock-first holds) but cached only for `SETTLING_TTL`, so the next visit retries instead of inheriting a bad day.

### 5.5 The honesty invariants

1. **Mock-first / graceful degradation.** Any failure falls back to mock. The dashboard never breaks on bad data.
2. **No number a friend could act on may read as live unless it is.** Mock/stale tiles get the ILLUSTRATIVE hatch.
3. **A directional verdict is suppressed on mock/stale data.** A fabricated directional call is worse than a fabricated number.
4. **A cut takes its attribution with it.** A surviving label describing deleted data is the page lying about itself.
5. **Fail closed.** Absent evidence reads as unknown, never as healthy.

---

## 6. How the terminal consumes both

### 6.1 `governingRegime()` — the stricter governs

`REG_RANK = {TAILWIND:0, NEUTRAL:1, HEADWIND:2, PANIC:3}`. MacroDash **measures** a regime; a TT session **asserts** one. The stricter of the two governs the standing modifier, and any disagreement prints **both** readings with provenance. Averaging them would delete exactly the information the disagreement carries.

### 6.2 `stance()` — may capital move at all

Evaluated in order: **circuit first** (a portfolio fact no macro verdict un-trips) → then the governing regime. No regime at all reads `UNKNOWN`, never a defaulted green.

| Stance | Trigger |
|---|---|
| `NO NEW POSITIONS` | leverage circuit tripped |
| `ADDS SUSPENDED` | PANIC |
| `ADDS GATED` | HEADWIND (entry +1 notch · R/R +0.5×) |
| `ADDS OK` | otherwise (armed circuit → caution) |
| `UNKNOWN` | no measured or asserted regime |

### 6.3 `readiness()` — is the evidence there to act on *this name*

Consolidates eight clocks into one verdict, reading the **same helper each individual chip reads** so a part can never disagree with what it summarizes.

| Severity | Meaning |
|---|---|
| `BLOCKED` | evidence missing or expired — no current model, a MIS-KEYED schedule, no current TT run, no defined hinges, no usable price, a blocking decision scoped to this name |
| `CAUTION` | evidence aging or partial |
| `READY` | every clock current |

Two deliberate **non**-blockers: a **red hinge** is surfaced never vetoed (D3), and an **absent position** cautions rather than blocks — an unheld new name legitimately has none, and blocking it would gate exactly the names the next dollar is for.

### 6.4 Eligibility — the green line

`ELIGIBLE NEXT DOLLAR` hard-WAITs on any missing gate, each veto named: unknown or suspended stance · an unreadable regime feed · an absent/blind/tripped Macro Flip (**fail closed** — an unreadable crash circuit vetoes rather than defaulting to clear) · and `readiness().blockers` per name. Cautions never veto.

Three lists, deliberately distinct concepts that one banner used to blend:

| List | What it is |
|---|---|
| `VALUATION GAP — math only` | ranked by annualised upside; no sizing, caps or thesis weighed |
| `ELIGIBLE NEXT DOLLAR` | all gates passed |
| `FUNDING PRIORITY` | where a dollar comes *from*; **not** a sell recommendation |

### 6.5 Tripwires — the AI thesis, both legs

| Leg | Block | Fires when |
|---|---|---|
| **Supply** | `board.capex` | ≥2 tracked spenders guiding **down** (and ≥2 **up** = re-acceleration) |
| **Demand** | `board.capability` | observed doubling time crosses the **pre-committed** `threshold_months`, either direction |

`threshold_months` is **required by the validator**: the level at which you would change your mind must be stored *before* a reading is filed against it. A threshold chosen after seeing the observation is a confirmation device, and the validator is the only thing that can enforce the ordering. Neither leg extrapolates; neither votes.

---

## 7. Locked doctrines

Rules that constrain future changes. Each was paid for.

1. **One computation, many altitudes.** `ptModelRows` · `REGIME_BAND_TABLE` · `governingRegime` · `readiness`. Never a second copy of a threshold that gates a decision.
2. **The board reports, it does not enforce** (D3, FEAT-TT-BINCAL). Red hinges and binary windows are surfaced, never auto-vetoed.
3. **Never annualise a short window.** A 12-week move raised to the 52/11 power read −98.8%/yr — arithmetically correct, economically absurd. Report over the observed span and state the span.
4. **A new series does not vote on arrival.** NFCI and DGS30 both arrived non-voting: a new voter changes the majority math for a contract that gates real orders, and uncalibrated bands are worse than none.
5. **Withhold asymmetrically.** Suppress the *permissive* direction when a gauge is blind; let the cautious one through.
6. **Measure, don't assert.** Contrast is computed in tests, not claimed in a comment — a token once carried "WCAG AA verified" while measuring 3.20:1.
7. **A collapse is only honest if a red thing stays visible while closed.**
8. **Real book, position, thesis and framework content never enters this repository.**

---

## 8. Constants appendix

| Constant | Value | Governs |
|---|---|---|
| `REGIME_QUORUM` | 4 of 6 | public posture withheld below this |
| `NFCI_TIGHT` / `NFCI_LOOSE` | `0` / `−0.5` | NFCI bands (SD) |
| `QUORUM_MIN` | 4 | snapshot cache write-through |
| `SETTLING_TTL` | 1h | below-quorum cache lock |
| `CAP_PCT` | 18% | single-name / cluster cap (% of account equity — **a floor, not NAV**) |
| `BINARY_WINDOW_D` | 10d | no-new-adds window before a binary |
| `POS_STALE_D` | 2d | position mark staleness |
| `PX_STALE_D` | 4d | stamped price staleness |
| `MOVE_PCT` | 5% | day move worth surfacing |
| `SEEN_MAX_D` | 7d | delta baseline reset |
| `READY_THESIS_D` | 30d | thesis re-review |
| runState | ≤30d fresh · >30d stale · >90d head · missing/future = **never** | TT run age |
| `ANN_MIN_Y` | 0.25y | below this a rung rolls forward rather than annualising |
| `LENS_MAX_PE` | 100× | above this an EPS line is a crossing artifact, not earnings |
| `OPT_NEAR_D` | 60d | option leg is a decision, not a holding |
| `CAPABILITY_MOVE_PCT` | 15% | capability delta noise band |
| `MAX_BODY` | 200KB | book PUT cap (app-level, not a KV limit) |

---

## 9. Change protocol

- **Band changes** in either engine require a matching boundary test. DEC-33 exists because a silent drift here misclassifies live capital.
- **Adding a voter** changes the majority math for every consumer. Arrive non-voting; enable on an explicit owner call once real values have been observed.
- **`/readout.json` is a contract.** External systems gate orders on it. New fields are their own decision.
- **Test suites:** `node test/smoke.mjs` (851) · `npm run test:ui` (156, admin.html) · `npm run test:public` (28, public state machine). The last two skip cleanly without Chromium.
- **`package.json` `version` is the single source of truth**, injected as `__APP_VERSION__`.

---

*Generated from source at v3.55.0. If a number here disagrees with the code, the code wins — and this file needs a new stamp.*
