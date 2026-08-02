# TT ↔ TERMINAL INTEGRATION SPEC — v2.0 (IMPLEMENTATION)
## Consolidated build spec for the coder agent
## Supersedes v1.0, v1.1, v1.2, and the §9 addendum in full.

**Audience:** implementing engineer/agent. Everything needed to build is here;
no prior version is required reading.

---

# 0 · PURPOSE & OWNERSHIP CONTRACT

Two systems share one workflow. Chat (LLM, live research + broker quotes) produces
*judgment*. Terminal (this codebase) owns *math, state, and rendering*.

> **THE RULE: chat emits only irreducible judgments — categorical states and
> dated facts. Anything computable from those is terminal-owned and MUST NOT
> appear in the card.**

Conflict resolution: the terminal is the state of record. A chat card is a
proposal until validated and committed. Chat never overrides committed state;
terminal never invents a judgment.

**Terminal-owned (never in the card):** CAGR, all multipliers, tier derivation,
eligibility, bucketing, ranking, weights, live quotes, staleness.
**Chat-owned (only in the card):** composite + pillars, gate statuses + notes,
entry state, correlation cluster tag, hinges, pt_model target/horizon/basis,
dated events, thesis, sources.

---

# 1 · CONFIG CONSTANTS

```python
SCHEMA_VERSION      = "2.0"      # reject cards not matching
MAX_CAP_PCT         = 0.18       # single-position hard cap (book standing rule)
CLUSTER_SOFT_CAP    = 0.25       # correlation-cluster weight before penalty
BINARY_BLOCK_DAYS   = 10         # no adds inside this window
CARD_TTL_DAYS       = 90         # hard staleness ceiling
NEAR_TERM_DAYS      = 90         # below this, do NOT annualise
OVERRIDE_MAX_DAYS   = 183        # R6-C4: auto-expiry ≤ 2 quarters
MULT_FLOOR          = 0.15       # floor on compounded multiplier
FIT_FLOOR           = 0.50
QUOTE_MAX_AGE_MIN   = 20         # during market hours
TIMEZONE            = "America/New_York"   # ALL dates are ET calendar dates
WEIGHT_DENOMINATOR  = "tracked_book"       # ⚠ see §9 OPEN-1
```

All date fields are **ET calendar dates (`YYYY-MM-DD`)**, compared as dates, not
datetimes. `today` = current ET date.

---

# 2 · CARD SCHEMA v2.0

```jsonc
{
  "schema_version": "2.0",              // req, must == SCHEMA_VERSION
  "symbol": "TSM",                      // req, uppercase, ^[A-Z.\-]{1,10}$
  "run_date": "2026-07-29",             // req, ET date, ≤ today
  "run_type": "DEEP",                   // req, enum: DEEP|RE|SCREEN
  "lens": "AI",                         // req, enum: AI|PH|QC|VEH|SP
  "composite": 8.65,                    // req, float [0,10]  — DISPLAY + tier only
  "pillars": {"V":9,"G":9,"P":10,"M":5,"R":8},  // req, each int [0,10]
  "weights_used": "R3A",                // req, enum: STANDARD|R3A|LENS_MERIT
  "gates": {                            // req, ≥1 entry, keys G1..G4
    "G1": {"status":"PASS","hard_stop":false,"tag":null,"note":"..."},
    "G2": {"status":"FLAG","hard_stop":false,"tag":null,"note":"..."},
    "G3": {"status":"PASS","hard_stop":false,"tag":null,"note":"..."}
  },
  "entry": {                            // req
    "state": "broken_no_base",          // req, enum §4.2
    "support": 381.30,                  // opt, float|null
    "resistance": null                  // opt, float|null
  },
  "correlation_cluster": "ai_capex_foundry",   // req, enum §4.3
  "pt_model": {                         // req (absence ⇒ PENDING/no_target)
    "target": 625.0,                    // req, float > 0
    "horizon": "2028-12-31",            // req, ET date, > run_date
    "basis": "consensus FY28 EPS $28.41 × 22x exit",  // req, non-empty
    "return_type": "price_only"         // req, enum: price_only|total_return
  },
  "next_binary": null,                  // opt, ET date|null — earliest of ANY
                                        //   scheduled binary incl. earnings
  "next_earnings_date": "2026-10-15",   // opt, ET date|null
  "override": null,                     // opt, object §4.1 | null
  "hinges": [                           // opt, array
    {"id":"taiwan","state":"amber","test":"geopolitical status quo holds"}
  ],
  "thesis": "Toll-road: every NVDA competitor fabs here.",  // req, non-empty
  "flags": ["taiwan tail risk"],        // opt, array[string]
  "sources": ["TSMC Q2 2026 release"]   // opt, array[string]
}
```

**Removed vs earlier drafts (all derivable — do not accept if present; warn):**
`gate_multiplier`, `fit`/`fit.score`, `timing.blocked`, `quote`, `nds_fair`,
`nds_constrained`, `tier_computed`.

### 2.1 · Override object (R6-C4)
```jsonc
"override": {
  "scope": "G2 demand-durability FAIL",   // req
  "size_limit_pct": 18.0,                 // req, float (0,100]
  "review_trigger": "Q2 print",           // req
  "expiry_date": "2026-10-31"             // req, ET date, ≤ run_date+OVERRIDE_MAX_DAYS
}
```

---

# 3 · VALIDATION (Pydantic; reject → `inbox/`, emit field-level diff)

**Reject on:** schema_version mismatch · missing required field · wrong type ·
unknown enum value · `composite` ∉ [0,10] · any pillar ∉ [0,10] ·
`pt_model.horizon ≤ run_date` · `pt_model.target ≤ 0` · `run_date > today` ·
gate `status` ∉ {PASS,FLAG,FAIL} · gate `tag` ∉ {null, valuation_breach,
filing_integrity, credit_downgrade} · `hard_stop=true` on a non-FAIL gate ·
`return_type="total_return"` with no dividend/buyback language in `basis` ·
override present but missing any sub-field · `override.expiry_date >
run_date + OVERRIDE_MAX_DAYS` · unknown `correlation_cluster`.

**Warn (accept):** deprecated derived fields present · `sources` empty on a
DEEP run · `next_earnings_date` null.

**Collision:** same symbol same day → precedence `DEEP > RE > SCREEN`; equal type
→ last write wins. Write to `tt_cards/{SYMBOL}.json`; git commit message
`tt: {SYMBOL} {run_type} {run_date}`.

---

# 4 · DERIVED VALUES (all terminal-computed)

### 4.1 · Gate multiplier
```python
fails = [g for g in gates.values() if g.status == "FAIL"]
flags = [g for g in gates.values() if g.status == "FLAG"]

if any(g.hard_stop or g.tag for g in fails):      gate_mult, eligible = 0.30, False
elif len(fails) >= 2:                             gate_mult, eligible = 0.30, False
elif len(fails) == 1:
    if override_valid(card):                      gate_mult, eligible = 0.60, True
    else:                                         gate_mult, eligible = 0.60, False
else:
    gate_mult = {0: 1.00, 1: 0.85}.get(len(flags), 0.75)
    eligible = True

def override_valid(card):
    return card.override is not None and card.override.expiry_date >= today
```
`broken_thesis` is expressed as a gate FAIL with `hard_stop=true`.

### 4.2 · Entry multiplier (lookup)
| `entry.state` | mult |
|---|---|
| `confirmed_support` | 1.00 |
| `at_support` | 0.85 |
| `relative_strength` | 0.75 |
| `mid_range` | 0.60 |
| `extended` | 0.40 |
| `broken_no_base` | 0.30 |
| `failed_breakout` | 0.15 |

### 4.3 · Correlation clusters & fit multiplier
**Enum:** `ai_capex_compute` · `ai_capex_foundry` · `ai_capex_memory` ·
`ai_capex_optical` · `ai_capex_energy` · `ai_capex_thermal` · `neocloud` ·
`physical_ai_evtol` · `physical_ai_av` · `physical_ai_robotics` ·
`physical_ai_defense` · `physical_ai_space` · `latam_fintech` · `us_fintech` ·
`consumer_internet` · `consumer_staples` · `strategic_materials` ·
`semis_analog` · `megacap_index` · `healthcare` · `other`

```python
cluster_wt  = sum(w for n,w in holdings if cluster_of(n) == card.cluster)
name_wt     = holdings.get(symbol, 0.0)
expressions = count_expressions(symbol)   # shares, LEAPs, wrappers, short legs
                                          # of the SAME underlier complex

cluster_f = 1.00 if cluster_wt <= CLUSTER_SOFT_CAP else \
            clamp(1 - (cluster_wt - CLUSTER_SOFT_CAP) * 2.0, 0.60, 1.00)
redund_f  = 1.00 if expressions <= 1 else max(0.60, 1 - 0.15*(expressions-1))
cap_f     = 1.00 if name_wt <= MAX_CAP_PCT else \
            max(0.50, 1 - (name_wt - MAX_CAP_PCT)/MAX_CAP_PCT)

fit_mult = clamp(cluster_f * redund_f * cap_f, FIT_FLOOR, 1.00)
```
*Sanity anchors: NBIS (31.2% wt, cap breach) → ≈0.50 · NVDA (4 expressions) →
≈0.55 · an unheld name in an uncrowded cluster → 1.00.*
**v2.1 upgrade path:** replace tag-based clustering with measured rolling
correlation. Tags ship now.

### 4.4 · Tier (derived from composite — NOT chat-emitted)
`≥8.5 → S` · `7.0–8.49 → A` · `5.5–6.99 → B` · `<5.5 → C`.
Book tier (roster membership) is stored separately; when the two disagree,
render both and surface a `TIER_MISMATCH` badge. *(Current live example: JOBY —
book S, computed C.)*

### 4.5 · Staleness
```python
stale = (today > run_date + CARD_TTL_DAYS)
     or (next_earnings_date and next_earnings_date < today
                            and run_date < next_earnings_date)
     or any(h.state == "red" for h in hinges)      # a broken thesis condition
                                                   # invalidates the card
```
**Red hinges force a re-run rather than adjusting the math** — this deliberately
avoids a second parallel scoring system alongside gates.

### 4.6 · Return math
```python
days = (pt_model.horizon - today).days
if days <= 0:                     bucket_hint, flag = "PENDING", "horizon_lapsed"
elif days <= NEAR_TERM_DAYS:      metric = target/live_price - 1        # ABSOLUTE
                                  flag = "horizon_imminent"
else:                             metric = (target/live_price)**(365.25/days) - 1  # CAGR
```
Always uses the **live** price, never a stamped mark — so ranking refreshes as
prices move without re-running cards. `return_type` does not change the math; it
declares whether the chat's target already embeds distributions.

### 4.7 · Quote freshness
`live = (market_open and age ≤ QUOTE_MAX_AGE_MIN) or (market_closed and quote is
the latest official close)`. Not live → `eligible = False`, reason `stale_quote`.

---

# 5 · ELIGIBILITY & BUCKETING

```python
eligible = (not stale
        and not horizon_lapsed
        and gate_eligible                      # §4.1
        and pt_model is not None
        and quote_live
        and (next_binary is None or (next_binary - today).days > BINARY_BLOCK_DAYS))
```

### Render precedence — exactly one bucket, top-down, first match wins
```
1. hard_stop FAIL / ≥2 FAIL / broken_thesis        → PENDING (reason: gate)
2. no card on file  OR  stale                      → UNVALIDATED
3. pt_model missing                                → PENDING (reason: no_target)
4. horizon_lapsed                                  → PENDING (reason: horizon)
5. 1 ordinary FAIL without valid override          → PENDING (reason: no_override)
6. stale_quote                                     → PENDING (reason: quote)
7. next_binary within BINARY_BLOCK_DAYS             → BINARY (frozen)
8. 0 < days ≤ NEAR_TERM_DAYS                        → NEAR_TERM
9. else                                            → RANKED
```
Implement as **one tested function**, one unit test per rung.

---

# 6 · RANKING

```python
effective_mult = max(MULT_FLOOR, gate_mult * entry_mult * fit_mult)

RANK_constrained = metric * effective_mult
RANK_fair        = metric * max(MULT_FLOOR, gate_mult * entry_mult)   # fit ≡ 1.00
```
All multipliers are **discounts capped at 1.00** — a good entry improves the odds
of realising a target, it does not raise the target.

**Sort:** RANK desc → composite desc → symbol asc. Dense ranking (ties share a
rank). NEAR_TERM ranks separately and is never commingled with RANKED.

---

# 7 · UI RENDER MAPPING

**§7.0 GLOBAL — eligibility is symmetric.** A name failing §5 renders in
**neither** ranked panel — not badged-and-ranked. A −99%/yr model on a never-run
name is exactly as unreliable as a +68%/yr one; selling and buying on unvetted
data are the same error. *(Live example: the six current top funding-source slots
— SPCX, RKLB, ACHR, SYM, SOFI, GOOGL — are all `never run`.)*

**§7.1 VALUATION GAP (merit).** RANKED bucket, `RANK_fair`, desc. Columns:
`Sym · BookTier/CompTier · Lens · Composite · %/yr · Entry · Hinges(g/a/r) ·
Run age`.

**§7.2 FUNDING PRIORITY (allocation).** Same eligible set, `RANK_constrained`.
Two sub-sections:
- **Forced:** `name_wt > MAX_CAP_PCT ∧ no valid override` → `TRIM REQUIRED · {n}pts
  over · ≈${x} to cap`. With valid override → `OVERRIDE ACTIVE · expires {date}
  · {d}d left` (no trim signal). Expired → `OVERRIDE EXPIRED · RE-PAPER OR TRIM`
  (an audit action, not a silent sell).
- **Discretionary:** eligible names ascending by `RANK_constrained`.

**§7.3 DELTA (the reason two boards exist).** `delta = rank_fair − rank_constrained`.
| Condition | Signal |
|---|---|
| High fair, low constrained, multiple expressions | **RESTRUCTURE** |
| Low on both, held > cap | **TRIM** |
| High on both, not held | **ADD CANDIDATE** |
| Low fair, high constrained | **REVIEW FIT INPUT** |

**§7.4 NEAR-TERM.** Header must read **"absolute return to horizon"**, never "%/yr".

**§7.5 STATUS BAR — fail-closed (R6-C2: missing input ⇒ TRIPPED, not skipped).**
```
ADDS OK   ⇔ readout fresh (≤24h) ∧ all required fields present
            ∧ regime ∈ {TAILWIND, NEUTRAL} ∧ ¬macro_flip.tripped
ADDS BLOCKED — CIRCUIT BLIND ({field})   ⇔ any required field missing/stale
ADDS BLOCKED — {REGIME}                  ⇔ regime ∈ {HEADWIND, PANIC}
ADDS FROZEN — MACRO FLIP                 ⇔ macro_flip.tripped
```
Display the **stricter** of measured vs asserted state and name the blind input.

**§7.6 OVERRIDES.** Green >45d to expiry · amber ≤45d · red expired. Expired →
**RE-PAPER QUEUE**, distinct from trim signals.

**§7.7 BINARY PANEL.** Expandable, not a bare count: `Sym · date · days · event ·
current bucket`. Every member is timing-frozen out of §7.1/§7.2 by definition.

---

# 8 · INGEST PIPELINE

1. Chat emits JSON → `inbox/`, or `python -m tt.ingest --paste`.
2. Pydantic validate (§3).
3. Pass → write `tt_cards/{SYMBOL}.json`, git commit.
4. Fail → leave in `inbox/`, print field-level diff for chat re-emit.
5. `python -m tt.rank` recomputes all derived values against live quotes + live
   weights and renders §7.
6. `run_queue.md` emitter lists UNVALIDATED + stale + red-hinge names →
   **first paste of the next chat session** (inverts ad-hoc ticker picking).

---

# 9 · OPEN ITEMS — CONFIG DECISIONS REQUIRED BEFORE PRODUCTION

- **OPEN-1 · Weight denominator.** `tracked_book` (a floor, NAV unmeasured) vs
  NAV vs gross. Changes every `fit_mult` and every cap breach. Book ruling R-P1
  recommends % of NAV. **Until resolved, all cap/fit output is advisory — banner
  must say so.**
- **OPEN-2 · `count_expressions()` definition.** Must resolve the underlier
  complex: shares + LEAPs + leveraged wrappers + short legs (NBIS+NEBX;
  JOBY+JOBX+LEAPs+puts; NVDA-via-NVDL/MAGX/MAGS; CRDO-via-CRDU; LITE-via-LITX).
  Book ruling R-P3 covers this.
- **OPEN-3 · `pt_model` authority.** Does the terminal derive targets internally
  today? If so, add `target_source: chat|terminal` and define precedence.
- **OPEN-4 · Broker MCP access from terminal.** If available, §4.7 self-satisfies;
  if not, quote sync stays manual and §5 will reject nearly everything.
- **OPEN-5 · Dividend display column.** Deferred; not required to ship.

---

# 10 · BUILD ORDER

1. Config + Pydantic models + validator (§1–3).
2. Ingest command + collision rule (§8.1–8.4).
3. Derived-value module (§4) with unit tests per formula.
4. Bucketing function (§5) — one test per precedence rung.
5. Ranking (§6) + FAIR/CONSTRAINED boards.
6. **Backfill ~40 session cards** — coverage 16% → ~80%.
7. UI §7.0 + §7.5 first (only changes that alter current behaviour), then
   §7.1–7.4, then §7.6–7.7.
8. MacroDash `/readout.json` Worker.
9. `run_queue.md` emitter.

*Tooling spec. Not investment, tax, or legal advice. Private — keep out of
public repos.*

---

## Implementation notes (this build, tt-engine)

- **R-P1 / R-P3 / R6-C4 / R3A**: not retrievable from the referenced source in
  this build environment. See README.md's provenance note and `tt/config.py`'s
  `[SPEC]`/`[MACRODASH]`/`[ASSUMPTION]` tags for exactly what each affected
  constant is grounded in.
- **Step 6 (backfill ~40 session cards)**: not attempted — real trading thesis
  data belongs only to the owner; `tests/fixtures/` carries synthetic
  (`ZZZQ`) cards instead, proving the pipeline works end to end without
  fabricating real analysis.
- **Step 8**: implemented as a read-only consumer (`tt/readout.py`) of
  MacroDash's existing public `/readout.json` — no MacroDash-side changes,
  no new Worker; the endpoint was already public, CORS-open, and
  unauthenticated, exactly as the spec's phrasing implies.
- **OPEN-4 (broker MCP access)**: meaningfully addressed, though not exactly
  as originally framed. No broker-MCP connection is wired into this
  standalone CLI (a Claude session's own Robinhood MCP tools can't be
  called from a plain `python -m tt.rank` invocation). Instead,
  `tt/macrodash_client.py` reads MacroDash's own already-live data —
  `GET /api/tt` (real book tier), `GET /api/positions` (real measured
  `tt:pos:v1`), `GET /api/quotes` (MacroDash's existing Finnhub-backed
  quotes) — over the `x-tt-pin` header path MacroDash's own CLAUDE.md names
  as "the automation path that unlocks future chat-side sync." Section 4.7
  ("if available, self-satisfies") is now true whenever `TT_PIN` is set;
  the hand-maintained `quotes.json`/`holdings.json`/`roster.json` remain the
  fallback OPEN-4 itself describes, used automatically when it isn't. See
  README.md's "Live MacroDash integration" section for the unit-conversion
  detail (`pos.pct` is 0–100 on MacroDash's side, a 0–1 fraction here) and
  the lockout-safety design (never guesses the PIN, never retries a 401/403).
