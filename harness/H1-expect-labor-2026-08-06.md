# H1 — PLAN · FEAT-EXPECT-LABOR (forward inflation expectation + leading labor)

> **DATED PASS ARTIFACT — 2026-08-06. NOT current state.** This records the H1 planning pass
> for this ticket. `CLAUDE.md` is canonical for what the thing is; `HARNESS.md` is canonical
> for how a change gets made. Where this file and either of those disagree, **they win** —
> this one is a snapshot and is not maintained. Measurements below are stamped at the time of
> the pass, deliberately, rather than restated as standing facts (the same cure `HANDOFF.md`
> and `AGENTS.md` already carry).

| | |
|---|---|
| **Phase** | H1 — PLAN |
| **Model** | Claude Opus 5 (the documented alternate; H1's primary is GPT-5.6 Sol) |
| **Harness** | `HARNESS.md` §P, from `b4c730c` (branch `claude/harness-model-assignment-d6xhlb`) |
| **Repo state** | **`main` @ `bf681a9` — v3.79.0** *(rev 2; rev 1 read `194514e` / v3.63 — see §R)* |
| **Origin** | Owner-directed. Candidate metrics surfaced by browsing macrotrends.net; see §9 |
| **Status** | **Awaiting approval.** Two decisions open, §10 |

**Rotation note (§0 Rule 3).** This plan was authored in the **same session** that ran H2 for
ENGINE0-CONT. That is weaker than the session isolation the prior H1 pass carried. It is
tolerable here only because H1 plans a *new, unrelated* ticket rather than judging that build —
Rule 1's conflict is auditor-vs-builder (H3/H5 over H2), which this is not. Stated rather than
assumed away. **H3 and H5 for this ticket must still be fresh sessions**, and H2 must not be
Opus 5 (see §11).

**TICKET.** Add the market's *forward* inflation expectation (FRED `T5YIFR`) and the *leading*
labor signal (FRED `ICSA`) as **non-voting** inputs that qualify the existing inflation read and
fill the regime's missing growth channel.

---

## §R. REVISION RECORD — rev 2, 2026-08-06

Rev 1 was written on the working assumption that a **fresh session would restore access** to
`api.stlouisfed.org` (§6, §9-F3, §10.2). This revision was commissioned to update the plan
"considering now you may access the St. Louis Fed API and macrotrends.net."

**That premise was tested and is false in this environment.** Rev 2 corrects it on evidence and
— more usefully — separates the question the premise was actually standing in for. The rev-1
text is superseded, not deleted silently: what it claimed and what is true are both recorded,
because a plan that quietly acquires a new belief is the defect class this repo hunts.

| # | Rev 1 said | Rev 2 says | Where |
|---|---|---|---|
| 1 | A fresh session restores FRED access | **Falsified.** Fresh container, still blocked on every path | §6 |
| 2 | *(no distinction drawn)* | **Build-time ≠ runtime access.** The feature never needed either | §6.1 |
| 3 | Access would unblock calibration | **True, and it is the only thing it unblocks** — v1 adds no threshold | §6.2 |
| 4 | macrotrends is a discovery catalog (F2) | **Unchanged, and now known access-independent** | §9-F2 |
| 5 | Blast radius names `src/dashboard.jsx` for tiles | **Stale** — FEAT-UIMOD (v3.73) moved them to `src/sections/` | §2 |
| 6 | Repo state `194514e` / v3.63 | `bf681a9` / **v3.79.0** — 16 releases on | header |
| 7 | *(WebSearch not considered)* | Available, and **must not be laundered as calibration** | §6.3 |

**Rev 3 (same day).** The owner confirmed the allowlist entries are in place and supplied a
screenshot. Re-tested: the allowlist mechanism is **proven live in this session**, and the two
data providers are **still denied**. The remaining variable is session scope, not the allowlist.
Two concrete gaps in the list itself are named in §6.0.1 — one of them matters.

Rev-1 sections **re-verified against current `main` and still true**: §3's greps (no existing
home for either metric), §4's quorum finding (`src/regime.js:107` — the comment literally reads
*"4/6 is two-thirds of the evidence base"*), and F1 (`thirtyYearSeries` declared at
`src/sources.js:42`, mapped at `:125`, **never assigned** — `_thirtySparkline` is deleted at
`functions/api/snapshot.js:574`).

---

## §0. THE INTEGRATION QUESTION

The owner's stated worry — *"a lot of unhinged data vs integration of all together to paint a
picture"* — is the organizing constraint of this ticket, not an aside. Here is the regime's
current causal map, read out of `REGIME_BAND_TABLE` (`src/regime.js`):

| Channel | Factor | Nature |
|---|---|---|
| Rates | `tenYear` (m1) | backward — realized move |
| Volatility | `vix` | contemporaneous |
| Sentiment | `fearGreed` | contemporaneous |
| Inflation | `cpiHeadline` trend | **backward** — realized, ~6wk publication lag |
| Valuation | `valuation` (CAPE) | contemporaneous, slow |
| Financial conditions | `nfci` | contemporaneous, weekly |
| **Growth / labor** | **— none —** | |

Two structural facts fall out. First, **there is no labor or growth factor at all** — six voters
and not one measures the real economy. Second, **every inflation input is backward-looking**, so
the engine can see what inflation *did* and never what the market expects it to *do*.

That yields the rule this ticket runs on:

> **A new metric earns a place only if it (a) fills a named missing channel, or (b) adds a
> forward/leading counterpart to a backward/lagging one. Which of the two it is dictates where
> it plugs in — and (b) must never become its own vote.**

**`ICSA` fills a missing channel (a).** Weekly, leading, the only real-economy input in the
stack. Arrives as a tile plus a WHY #2 cross-signal. Candidate for a 7th voter *later*, in its
own ticket, after calibration (§4, §6.2, §8).

**`T5YIFR` deepens an existing channel (b).** It must **not** become a seventh opinion — it makes
an opinion we already hold legible. CPI votes on the shape of realized inflation; `T5YIFR` says
whether the market believes it:

| Realized CPI | 5Y5Y expectation | Read |
|---|---|---|
| Cooling | anchored / falling | **Confirmed disinflation** — the strongest bull case |
| Cooling | rising | **The market disbelieves the cooling** — the divergence |
| Re-accelerating | anchored | Market treats it as transitory |
| Re-accelerating | rising | **Unanchoring** — the genuinely dangerous state |

**Only the disagreement is signal** — the same logic as FEAT-TT-SPREAD's `est↑ px↓` flag, where
same-direction moves are explicitly *not* the signal. This is the answer to the sprawl worry:
`T5YIFR` gets no vote, no verdict, and no sentence of its own. It **qualifies the inflation line
that already exists**. One more number must not mean one more independent opinion.

**Design consequence that makes this cheap and safe: v1 ships ZERO new economic thresholds.**
The divergence read is a comparison of two *directions*, not a level crossing, so it needs no
calibrated band; claims render level + direction + 4-week average, not a verdict. This
simultaneously sidesteps the calibration blocker (§6), respects §P.8, and structurally prevents
the sprawl.

**Rev 2 note.** That choice was made in rev 1 as a workaround for a blocked network. It survives
rev 2 **on its own merits** — §6.2 shows access would not change a single v1 line — which is the
stronger reason to keep it. A design that is correct for one reason and convenient for another
should be re-justified when the convenience disappears; this one holds.

---

## §1. DEFECT CLASS

**(e) new capability.** Per the harness, what the first four classes would look like *in this new
surface*, and what prevents each:

- **(a) A wrong number** — a decimal-shifted `T5YIFR` (`0.23` vs `2.3`) reading as anchored
  expectations. *Prevented by:* `BANDS` entries, applied before render or cache.
- **(b) A label outliving its data** — the divergence clause printing "expectations confirm the
  cooling" after the CPI trend input was dropped. *Prevented by:* the clause is gated on **both**
  inputs being live, and omitted entirely otherwise.
- **(c) A second copy of a threshold** — the "rising expectations" test living in both
  `fiveWhys.js` and the tile. *Prevented by:* one exported comparator, two consumers (§3).
- **(d) A claim on absent evidence** — the worst case here, and the one to guard hardest: **a
  missing `T5YIFR` rendering as "expectations aligned."** Silence must never read as agreement.
  *Prevented by:* the abstention design in §5.

---

## §2. BLAST RADIUS

> **⚠ Corrected in rev 2.** Rev 1's list named `src/dashboard.jsx` as the home for the two new
> tiles and for `SIGNAL_FIELDS`. **FEAT-UIMOD (v3.73) extracted the presentation layer** into
> `src/sections/` and `src/primitives/`; `dashboard.jsx` is now an orchestrator. Left uncorrected
> this was a live trap: H2's scope is *this list*, and a file outside it obliges H2 to **stop and
> report scope expansion** (`HARNESS.md` H2 constraints). H2 would have halted on its first edit.
> Verified against `main` @ `bf681a9`.

**Files touched**

1. `functions/api/snapshot.js` — 2 entries in the `series` map; `ICSA` 4-week average derivation;
   2 `BANDS` entries
2. `src/sources.js` — `SOURCES` keys; `CADENCE` (`ICSA` = weekly); `DERIVED_OF` for any derivative
3. `src/dashboard.jsx` — `MOCK_DATA` baseline paths; `FW_FIELDS` (`:490`); the `SIGNAL_FIELDS`
   array it passes to `<DataHealth signalFields=…>` (`:945`). **Orchestration only — no tile JSX**
4. **`src/sections/MarketDetail.jsx`** — the two new tiles. This is where the `nfci` (`:139`) and
   `creditSpread` (`:120`) tiles live, and NFCI is the closest structural precedent this ticket
   has: a non-price macro gauge, `CollapsedGroup`-demoted, `ILLUSTRATIVE` on mock, `SourceBox`
   with `asOf`. Follow it rather than inventing a shape
5. `src/fiveWhys.js` — WHY #1 divergence clause; WHY #2 claims cross-signal; `FIELD_LABEL`
6. `test/smoke.mjs`, `test/public-render.mjs`

**Open placement question for the approver (§10.3).** `MarketDetail.jsx` is the *collapsed*
"full market detail" group (v3.69). `MacroStrip.jsx` is the always-visible strip that carries
`cpiHeadline` (`:39`). The `T5YIFR` qualifier is *about* the CPI read, and there is a real
argument it belongs beside it in the strip rather than two collapses away. Rev 2 does **not**
decide this — it changes which file H2 may touch, so it is an approval item, not a build-time
call.

**Files deliberately NOT touched** — load-bearing, and the ticket's main defense against creep:

- **`src/regime.js`** — no vote change. `REGIME_BAND_TABLE` and `REGIME_QUORUM` untouched.
- **`src/ttReadout.js`** / `functions/readout.json.js` — the order-gating `tt-v1` contract is
  frozen (§P.8).
- **`src/evidence.js`** — `FACTOR_FIELD` / `REGIME_FACTOR_FIELDS` unchanged, because neither
  metric is a factor.
- **`src/sections/RegimeBand.jsx`**, **`SignalQuality.jsx`** *(rev 2: named explicitly)* — the
  voting surfaces. A non-voter appearing in one is the visual half of the §2 invariant below.

**Rendered surfaces affected:** the two new tiles; 5 Whys WHY #1 and WHY #2; the Signal Quality
rollup counts; the Data Health per-source grid.

**Rendered surfaces explicitly NOT affected:** the verdict band, the Drivers matrix, the factor
chip strip, `postureSummary`, `/readout.json`, the terminal's MACRO pill. **Non-voters must not
appear in voting surfaces** — that is the visual half of the same invariant.

---

## §3. DUPLICATION CHECK

Greps re-run in rev 2 against `main` @ `bf681a9`:

```
grep -rEin "breakeven|inflation expect|T5YIF|5y5y" src/ functions/
  → no matches                                    (unchanged from rev 1)

grep -rEin "jobless|initial claims|ICSA" src/ functions/
  → src/fiveWhys.js:42 — a MACRO_TERMS vocabulary word only
                                                   (unchanged from rev 1)
```

No existing home for either value.

**One duplication risk identified and deliberately NOT unified:** `admin.html` already implements
a divergence detector (FEAT-TT-SPREAD). It must **not** be shared — `admin.html` is buildless and
cannot import, and the comparison is a different domain (estimates vs price, not expectations vs
realized). Recorded here so a later reader does not "unify" two things that only rhyme.

**New shared constant required:** the direction comparator used by both the tile and WHY #1 gets
exactly one exported home. A second copy is the defect this repo keeps paying for.

---

## §4. INVARIANT IMPACT

- **§P.2 (honesty)** — a mock/stale `T5YIFR` must never produce a divergence claim. Both tiles
  take `ILLUSTRATIVE` treatment on mock, per v3.1.
- **§P.3 (fail closed)** — missing expectation data → the clause is *omitted*, never rendered as
  "aligned."
- **§P.4 (one computation)** — the direction comparator has one home (§3).
- **§P.6 (mock-first)** — both fields need `MOCK_DATA` baselines or the merge has nothing to
  overlay.
- **§P.8 (order-gating frozen)** — satisfied by construction: no voter added, no band moved,
  `tt-v1` untouched.

### ⚠ The finding this section exists to catch

If a future ticket promotes `ICSA` to a 7th regime voter, **`REGIME_QUORUM = 4` silently
weakens.** Its own comment in `src/regime.js:107` justifies 4 as *"4/6 is two-thirds of the
evidence base"* — but **4/6 is 67% while 4/7 is 57%.** That is precisely the DEC-31 defect
(3-of-5 → 3-of-6 = 50%, not a majority) replayed one level up, at the *quorum* rather than the
*majority*.

`verdictFrom` itself is safe — a strict majority of 7 still needs 4 — but the quorum is not.
**Any promotion ticket must revisit `REGIME_QUORUM` in the same change.** Recorded here because
this ticket is where the risk is *created*, even though it is not realized.

*Rev 2: re-verified verbatim in source. The comment states the two-thirds rationale explicitly,
so a promotion ticket that leaves `4` in place would leave a **comment that outlives its
arithmetic** — class (b), inside the constant that governs abstention.*

---

## §5. THE ABSTENTION

| Input state | `T5YIFR` | `ICSA` |
|---|---|---|
| Missing | No divergence clause. **Never "aligned."** Tile ILLUSTRATIVE | No labor cross-signal in WHY #2; tile ILLUSTRATIVE |
| Stale (cadence-aware) | Same as missing — a stale expectation cannot confirm a fresh CPI | Same; weekly cadence, so >12d |
| Mock (live build) | Same as missing (the v3.54 rule: mock cannot speak) | Same |
| Zero | Implausible → banded out | Implausible (claims are never 0) → banded out |
| Negative | Banded out | Banded out |
| Non-finite | Banded out | Banded out |
| **CPI live, `T5YIFR` not** | **The critical case:** WHY #1 prints the realized read only, with no confirmation language | n/a |

"Not measured" is distinguishable from "measured as agreeing" in every row. That distinction is
the whole ticket.

---

## §6. BAND PROVENANCE — and the access question

**Two plausibility bands, both ASSERTED, and that is acceptable** — these reject the *impossible*,
not the unusual, which is the standing doctrine for `BANDS`:

- `T5YIFR: [0, 10]` — historically ~2–2.5%; wide enough to catch only a decimal shift.
- `ICSA: [0, 10_000_000]` — the 2020 peak was ~6.1M.

**No economic thresholds are added.** This is the deliberate choice from §0: the divergence read
is a *direction comparison*, and claims render *level + direction*, so nothing here needs a
calibrated band.

### §6.0 — the premise, tested

Rev 1 recorded a `CONNECT 403` and hypothesised that **network policy binds at container start,
so a fresh session would fix it**. Rev 2 tested that hypothesis directly. It is **false.**

Measured 2026-08-06, in a container **1 minute old** (`/proc/uptime` 72s — genuinely fresh, the
exact condition rev 1 asked for):

| Path | Host | Result |
|---|---|---|
| `curl` via container proxy | `api.stlouisfed.org` | `CONNECT tunnel failed, 403` |
| `curl` via container proxy | `fred.stlouisfed.org` | `CONNECT tunnel failed, 403` |
| `curl` via container proxy | `www.macrotrends.net` · `macrotrends.net` | `CONNECT tunnel failed, 403` |
| `curl` via container proxy | `home.treasury.gov` | `CONNECT tunnel failed, 403` |
| `curl` via container proxy | `api.github.com` *(control)* | **`200`** |
| `WebFetch` (server-side, not the container proxy) | `fred.stlouisfed.org/graph/fredgraph.csv` | `403` |
| `WebFetch` | `www.macrotrends.net` | `403` |

`$HTTPS_PROXY/__agentproxy/status` logs both denials as
`connect_rejected — gateway answered 403 to CONNECT (policy denial or upstream failure)`.

**Corrected root cause:** the block is the **environment's network policy**, which is a property
of the *environment configuration*, not of session lifetime. A new session inherits the same
policy. The fix is an environment-level allowlist change (and then a new session to pick it up) —
**starting a fresh session alone will not do it, and rev 1 said it would.** Two independent
transports failing identically is the tell that this is policy, not transport.

The keyless `fredgraph.csv` endpoint was tried specifically because it needs no `FRED_KEY`; it is
blocked too, so **this is not a credential problem** and provisioning a key would not help.

### §6.0.1 — rev 3: the allowlist is configured, live, and still not enough

The owner confirmed the egress allowlist (claude.ai → Settings → Capabilities → *Additional
allowed domains*) carries: `api.stlouisfed.org` · `macrotrends.net` · `macrodash.pages.dev` ·
`pialax.pages.dev`.

Re-tested in the same session, container age 149s:

| Host | On the allowlist? | Result |
|---|---|---|
| `macrodash.pages.dev` | **yes** | **200** |
| `api.stlouisfed.org` | **yes** | `CONNECT 403` |
| `macrotrends.net` | **yes** | `CONNECT 403` |
| `fred.stlouisfed.org` | no | `CONNECT 403` |
| `www.macrotrends.net` | no *(bare entry does not cover it)* | `CONNECT 403` |

**The first row is the finding.** A user-added domain resolving to `200` proves the allowlist
mechanism reaches this session — so the earlier hypothesis that the whole list was being ignored
is itself now falsified. Two entries on that same list are nonetheless denied.

`/root/.ccr/README.md` classifies this exactly: *"403/407 — the destination host is not allowed by
your organization's egress policy **for this session**. Do not retry or route around it — report
the blocked host."* Both halves are load-bearing. **"for this session"** points at policy
resolution at session creation rather than at edit time; **"do not route around it"** is why no
mirror, proxy or scrape workaround was attempted, and why none should be. This plan records a
blocked host and stops.

**Snapshot-timing hypothesis: raised, then FALSIFIED by the owner in the same pass.** The
proposed mechanism was that the two `.pages.dev` entries predated session creation while the two
providers were added after it, so a policy snapshot would serve the former and miss the latter.
**The owner confirms all four entries were added BEFORE this session started.** That removes the
only benign explanation: same list, same age, same session — two entries served, two denied.

**What that leaves.** The denial is applied by something with **precedence over the user
allowlist** — an org- or gateway-level policy that classifies these hosts independently of the
per-account list. This session cannot see that layer, so the mechanism is not further diagnosable
from inside, and per the README the correct action is to **report it**, not to keep probing. A
fresh session is still worth one cheap re-run of the §6.0 host table (it costs nothing and rules
out a stale process), but it is **no longer the expected fix** and should not be planned around.

*(Third hypothesis, noted and NOT relied on: `*.pages.dev` may be reachable by default rather
than because it is on the list, in which case the list may not be functioning at all and row 1
proves less than it appears. Distinguishing that needs visibility this session does not have —
recorded so a later reader does not treat "the allowlist works" as established fact.)*

**Rev 3b — the positive control, run on the owner's instruction.** The full calibration prompt
(§12 shape) was executed from this session against all four keyless `fredgraph.csv` URLs
(`NFCI`, `ICSA`, `T5YIFR`, `DGS10,DGS30`) using the server-side fetch path rather than the
container proxy. **All four returned 403.** The control run immediately after — the same tool,
same session, against `macrodash.pages.dev` — **succeeded and returned the live page title.**

That control matters because it eliminates the last non-policy explanation: the fetch tool is
functional, the network path is functional, and the denial is **specific to these hosts**. Every
diagnosable cause is now excluded from inside the session — not transport (two transports),
not credentials (the keyless endpoint), not session timing (entries predate the session), not
tool fault (this control). What remains is a policy layer this session cannot inspect, which is
the definition of the README's report-it condition. **No further probing is warranted; the next
action is support, not another attempt.**

**Two gaps in the list, one of which matters:**

1. **`fred.stlouisfed.org` is absent, and it is the host calibration actually wants.**
   `api.stlouisfed.org` requires a `FRED_KEY`; `fred.stlouisfed.org/graph/fredgraph.csv` is
   **keyless** and returns a full CSV series in one request — which is precisely the shape §12
   needs (a distribution, not a level). Recommend **`*.stlouisfed.org`** to cover both hosts in
   one entry; the field's own placeholder (`example.com or *.example…`) confirms wildcards.
2. **`www.macrotrends.net` is not covered by the bare `macrotrends.net` entry** — they are
   different hosts. Fixable with `*.macrotrends.net`, but **low value: F2 concluded macrotrends
   is not a source we want** (§9-F2), and that conclusion is access-independent. Recorded for
   completeness, not recommended.

**What the owner cannot fix from here, and neither can I.** The allowlist is a claude.ai account
setting with no API or tool surface exposed to this session — there is no tool call that edits
it. The owner's instruction to "make the environmental allowlist change" is therefore already
discharged on their side; the remaining action is a fresh session (and, worth doing in the same
edit, adding `*.stlouisfed.org`).

### §6.1 — build-time access ≠ runtime access

The distinction rev 1 never drew, and the one that matters most:

| | Where FRED is fetched | Blocked? | What it affects |
|---|---|---|---|
| **Runtime** | Cloudflare edge — `functions/api/snapshot.js`, `env.FRED_KEY` | **No.** Never was | Whether the feature *works* |
| **Build-time** | This container, during development | **Yes** | Whether a threshold can be *calibrated* |

**The feature ships regardless of this blocker.** `T5YIFR` and `ICSA` are two entries in the
`series` map that `fetchFred` pulls at the edge, exactly like the 16 series already flowing. H2
implements and tests against fixtures — which is what the four suites do anyway, since they are
explicitly **no-network** — and production fetches real values on first deploy.

What is lost to the block is narrower than rev 1 implied: **the ability to look at a real
distribution before asserting a number about it.** That is a development affordance, not a
runtime dependency. Rev 1's framing ("H2 can implement against fixtures but cannot verify against
real values") was correct but under-scoped — it read as a project-wide blocker when it is a
calibration-only one.

### §6.2 — what access would actually change

The honest answer to *"revise this considering you may access FRED"*: **for v1, nothing.** The
line-level diff is identical either way. Access changes the **deferred** items only.

| Item | Needs FRED access? | Why |
|---|---|---|
| `T5YIFR` / `ICSA` series-map entries | **No** | Fetched at the edge |
| The two `BANDS` entries | **No** | Plausibility, not calibration — they reject `23.5`, not an unusual reading |
| The divergence comparator | **No** | Compares two directions; no level, no boundary |
| Both tiles, both 5-Whys clauses | **No** | Render level + direction |
| **`ICSA` → 7th regime voter** | **YES** | Needs a real band *and* the §4 quorum fix |
| **NFCI ½-SD loose threshold** (v3.43.1) | **YES** | Shipped asserted; CLAUDE.md says so |
| **30Y / 10s30s bands** (v3.55) | **YES** | Shipped asserted; same reason |
| **`T5YIFR` "unanchoring" level** | **YES** | Would be a *level* claim — deliberately not in v1 |

So access is worth having, and it is worth asking the owner for — but it unblocks a **queue of
already-deferred calibration work**, not this ticket. That queue is now three items deep and is
the strongest argument for fixing the environment policy: it is the standing blocker behind every
asserted band in the codebase, and each one is a number the product cannot currently defend.

### §6.3 — the one capability that IS new, and its limit

`WebSearch` is available in this session (it was not exercised in rev 1) and returns snippets:
e.g. `T5YIFR ≈ 2.12%` at 2026-04-09, `≈ 2.15%` for 2026-02 monthly.

**This is a sanity anchor, not calibration, and must not be used as one.** It confirms
`BANDS.T5YIFR = [0, 10]` comfortably contains reality — which is all a plausibility band needs,
and is a genuine (small) gain. It cannot do more, for three reasons, each of which independently
disqualifies it:

1. **Second-hand.** A snippet is not the series; nothing verifies the transcription.
2. **No distribution.** Two point values cannot produce a percentile, a standard deviation, or a
   deadband. Every deferred item in §6.2 needs a distribution, not a level.
3. **Undated relative to today.** The freshest figure found is ~4 months stale.

Using it to set an economic threshold would produce a band that *looks* calibrated and is
asserted — strictly worse than an honestly-labelled assertion, and the exact defect
`HARNESS.md` H1 item 6 exists to prevent. **Recorded as a temptation, refused.**

---

## §7. TEST PLAN (as claims)

1. If `T5YIFR` is absent from the payload, then the WHY #1 divergence clause is absent — **and no
   "aligned"/"confirms" language appears anywhere.**
2. If `T5YIFR` is present but its `AsOf` is stale, then the clause is absent (same assertion as 1,
   different cause).
3. If `cpiHeadline` is stale and `T5YIFR` is fresh, then no divergence clause — a comparison needs
   both sides.
4. If the CPI trend is cooling and `T5YIFR` is rising, then the divergence sentence renders and
   names *both* directions.
5. If both move the same way, then the confirmation sentence renders — and is worded differently
   from the divergence one.
6. If `ICSA` is fresh, then WHY #2 includes a claims cross-signal; if stale/mock, it appears in
   that clause's `Excluded (mock/stale)` list.
7. If a decimal-shifted `T5YIFR` (e.g. `23.5`) arrives, then `applyBands` drops it and
   `_diag.bandDropped` names it.
8. If either field is added, then `REGIME_BAND_TABLE.length` is **still 6** and `computeRegime`'s
   `counted`/`totalFactors` are unchanged — a pin that fails loudly if someone later makes these
   voters without doing §4's quorum work.
9. If `SOURCES` gains a derivative with no `AsOf`, then the existing `DERIVED_OF` reconciliation
   fails the build until it is mapped.
10. Public-render: on a degraded fixture with no expectation data, the page shows no
    inflation-confirmation language.
11. *(rev 2)* If either new field appears in a **voting** surface — the factor chip strip, the
    Drivers matrix, or `postureSummary` — then a pin fails. §2's "not affected" list is currently
    prose; this makes the non-voter invariant executable, which is the difference between a stated
    boundary and an enforced one.

**Claim that cannot be phrased testably, stated rather than invented:** whether the divergence is
*economically predictive*. That needs outcome calibration — a deferred capability (the
value-proposition audit's gap #1), not an assertion.

**Rev-2 note for H3:** claims 1–3 and 10 are the ones most likely to pass vacuously, because
"absent language" assertions go green when the *renderer* never ran. H3's negative control for
each must confirm the clause renders in the positive case first, or the pin proves nothing.

---

## §8. DELIBERATELY DEFERRED

*(rev 2: annotated with whether FRED access is the blocker — see §6.2)*

- **Promoting `ICSA` to a 7th regime voter** — needs calibrated bands *and* the `REGIME_QUORUM`
  fix from §4. Its own ticket, its own approval. **Blocked on access.**
- **A `T5YIFR` level threshold** ("unanchoring" above X) — would be the first economic band this
  surface carries. **Blocked on access.** *(rev 2: named explicitly. Rev 1 implied it by omission,
  and an unnamed deferral is indistinguishable from an oversight.)*
- **Re-deriving the asserted NFCI (v3.43.1) and 30Y (v3.55) bands** — not this ticket, but the
  same unblock covers all three. **Blocked on access.** *(rev 2: added — the §6.2 queue.)*
- **Adding either field to `/readout.json`** — order-gating contract; the same rule NFCI and the
  30Y arrived under. **Not access-blocked; it is a §P.8 approval question.**
- **`CCSA`, `INDPRO`, `TCU`, `DHHNGSP` (Henry Hub), Brent–WTI spread** — defensible additions, but
  five more tiles regresses the v3.61 density work. Two now; revisit once these prove their keep.
- **Everything in macrotrends' Precious Metals, Global Metrics, Market Indexes and Interest Rates
  sections** — duplicative of FRED series we already pull, wrong cadence (annual country
  indicators cannot inform a daily posture), or previously cut on the Yahoo-dupe test.
- **The 30Y sparkline defect** (§9-F1) — a real bug, confirmed still live in rev 2, but unrelated;
  single-purpose tickets debug faster.

---

## §9. FINDINGS CARRIED IN

Recorded here so they are not lost, and are **not** bundled into this ticket.

**F1 — `thirtyYearSeries` is mapped, dated, and never emitted.** `SOURCES` declares it
(`sources.js:42`) and `DERIVED_OF` maps it to the live `thirtyYear` parent (`:125`), but
`functions/api/snapshot.js` emits it **zero times** — `_thirtySparkline` is computed (`:515`),
consumed only for the 10s30s spread series (`:568–571`), then deleted (`:574`). The 30Y tile
therefore renders `MOCK_DATA`'s hardcoded array under `mode={modeOf('thirtyYear')}`, which reads
**LIVE**. A fabricated trendline inside a LIVE-badged tile — the v3.1 invariant, breached. The 10Y
sibling emits its series correctly, so this is a one-sided asymmetry from FEAT-30Y (v3.55).
Severity: the 30Y does not vote, so no order is gated on it; but the sparkline *is* the shape a
reader uses to judge "is the long end breaking out," which is FEAT-30Y's stated purpose. Fix is
one line. **Its own ticket.** *(rev 2: re-verified at the cited lines on `bf681a9` — still live,
16 releases later. It is class (a) + class (e) and nothing else on the page mitigates it.)*

**F2 — macrotrends.net is a chart layer over FRED, not a source.** Six sections reviewed
(Interest Rates, Energy, Global Metrics, Economy, Precious Metals, Market Indexes). Every macro
series traces to FRED/H.15; several LIBOR charts are dead series still displayed (the CBOE
Put/Call failure mode, DEC-31). Its genuine value to this project was as a **discovery catalog** —
it surfaced the two metrics this ticket adds. There is no version of "integrate macrotrends" that
beats adding a line to the `series` map.

> **Rev 2 — this conclusion is access-independent, which is the point.** The revision brief named
> macrotrends alongside FRED as newly-available. Even had it been reachable, **nothing in this
> plan would change**: F2 is a *sourcing* judgment (the data is FRED's, one hop upstream, without
> the dead-series risk), not an availability one. Scraping a chart layer to obtain a series we
> already pull by API would add a failure mode and a stale-series hazard for zero new information
> — the same test that cut the Mag-10 quote strip (v3.51) and refused TLT (v3.43). Access does
> not convert a rejected source into an accepted one. Recorded so a future pass does not re-open
> it on the assumption that "we can reach it now" was the objection.

**F3 — environment network policy blocks the data providers.**
*(rev 2: rewritten — rev 1's stated remedy was wrong.)*

`api.stlouisfed.org`, `fred.stlouisfed.org`, `home.treasury.gov` and `www.macrotrends.net` all
return `CONNECT 403`; `api.github.com` and `registry.npmjs.org` return 200. **Rev 1 concluded a
fresh session would clear it. Tested in a 1-minute-old container: it does not** (§6.0). The
policy is an environment property, so the remedy is an **environment-configuration change**,
after which a new session picks it up. Two independent transports (container proxy and
server-side `WebFetch`) fail identically, and the keyless endpoint fails too — so it is neither
transport nor credentials.

**Rev 3:** the owner has since confirmed `api.stlouisfed.org` and `macrotrends.net` ARE on the
egress allowlist, and a sibling entry (`macrodash.pages.dev`) returns **200** — so the allowlist
is live in this session while those two entries are still denied (§6.0.1). The remedy narrows to
**a fresh session** (policy is resolved per-session), plus adding **`*.stlouisfed.org`** so the
keyless `fredgraph.csv` host is covered. Per the proxy README this is a *report-it* condition, not
a route-around-it one; no workaround was attempted.

This is the standing blocker behind **three** asserted-band items now, not one: the uncalibrated
NFCI deadband (v3.43.1), the 30Y/10s30s bands (v3.55), and any future `ICSA` promotion (§4). That
accumulation — not this ticket — is the argument for fixing it.

---

## §10. OPEN DECISIONS (owner)

1. **The `T5YIFR`-as-qualifier design is the load-bearing call.** If it should eventually be a 7th
   voter instead, say so now — that makes calibration mandatory, drags in the §4 quorum fix, and
   is **blocked until §10.2 is resolved**.
2. **FRED is unreachable from the build container, and a fresh session does not fix it** (§6.0,
   §6.3 — corrected in rev 2). This does **not** block this ticket: the feature fetches at the
   Cloudflare edge and the suites are no-network by design (§6.1). It blocks the *calibration
   queue* (§6.2): the deferred `ICSA` promotion plus the already-shipped asserted NFCI and 30Y
   bands. **Ask:** is fixing the environment allowlist worth doing now, as its own small task, to
   unblock all three at once? If yes, §12's protocol is how the resulting numbers get earned.
   **ANSWERED (rev 3): yes — owner authorised it and the allowlist entries are in place.** The
   remaining steps are not this session's to take: add **`*.stlouisfed.org`** (the keyless
   `fredgraph.csv` host is currently uncovered — §6.0.1), then **start a fresh session**, whose
   first act is to re-run the §6.0 host table and record the result here. Until that table comes
   back green, every §6.2 calibration item stays deferred and every band stays `ASSERTED`.
3. **NEW (rev 2) — tile placement.** Do the two tiles go in `MarketDetail.jsx` (collapsed, beside
   NFCI — the closest structural precedent) or does `T5YIFR` belong in the always-visible
   `MacroStrip.jsx` beside the `cpiHeadline` it qualifies? This determines H2's permitted file
   list, so it is an approval item (§2).

---

## §11. RUNNING THE HARNESS FROM HERE

> **`HARNESS.md` is canonical for the phase prompts and the rotation table. Do not copy them —
> including §P — into a ticket, a prompt, or this file.** One home, referenced from many
> altitudes: the same rule the codebase applies to thresholds and to `ptModelRows`. This section
> gives only the *operational* steps that are specific to this ticket.

### Where the harness actually lives

**`HARNESS.md` is not on `main`.** It lives at `b4c730c` on branch
`claude/harness-model-assignment-d6xhlb`. Read it with:

```bash
git fetch origin claude/harness-model-assignment-d6xhlb
git show b4c730c:HARNESS.md
```

This is a live inconsistency worth fixing: the document that governs how changes are made is not
in the branch changes are made from. Flagged, not fixed here. *(rev 2: re-confirmed — still not
on `main` at `bf681a9`. It has now survived two passes as a known defect, which is how a flagged
inconsistency becomes a permanent one.)*

### Invoking H2 (the next step for this ticket)

- **Model:** Claude Sonnet 5 primary · GPT-5.6 Luna alternate. **Must not be Claude Opus 5** — it
  authored this plan (§0 Rule 1 / the rotation note above).
- Open with `Apply HARNESS.md §P.` then the H2 prompt body, naming this file as the approved plan:

  ```
  Apply HARNESS.md §P.

  Implement the APPROVED PLAN for FEAT-EXPECT-LABOR
  (harness/H1-expect-labor-2026-08-06.md), and nothing else.
  ```

- H2's own constraints (from the prompt, not restated here): show the intended diff and wait for
  go-ahead; scope is **this plan's §2 file list** — a file outside it is scope expansion and H2
  must stop and say so rather than edit it; tag new blocks with the ticket ID in the surrounding
  file's comment style; stop and report rather than silently redesigning if the plan turns out to
  be wrong.
- H2 finishes by running the gates and pasting **real output** — never describing a suite as
  passing without it — and by stating every plan item it did *not* implement.
- **Rev 2 — H2 must be told the network is blocked**, or it will read a `CONNECT 403` as an
  environment fault and burn a pass diagnosing it. The suites are no-network by design; a blocked
  FRED is the expected condition, not a failure.

### The gates

```bash
npm run gates     # smoke · test:ui · test:public · audit:prod, failing on the first red
```

Use the runner, never a hand-chained sequence (§0 Rule 4: `npm test | grep FAIL && git commit`
exits 0 when grep *finds* a failure, which let a red commit through on this harness's first run).
For the browser suites, `REQUIRE_BROWSER=1` turns a missing Chromium into a failure rather than a
silent skip.

### After H2

- **H3 (test design) and H5 (audit) each want a fresh session**, and both must differ from H2 —
  H3 writes the negative controls, H5 audits the finished diff. Neither may be the model that
  built it.
- **H4** runs only if a gate is red for a reason H3 did not intend.
- **H6** (UI structure) and **H7** (newcomer read) are conditional; this ticket adds two tiles and
  two narrative clauses, so H6's trigger (a change to layout, hierarchy or the *count* of rendered
  elements) plausibly fires and H7's does too (the public page changes for a non-operator). **A
  skipped conditional phase is stated, never silent** (§P.9).
- **H8** (release) bumps `package.json` **and** the mirrored version in the buildless
  `public/admin.html` `<title>` and brand line — smoke pins that they match, so a half-bump fails
  the gate.

---

## §12. PROPOSED HARNESS ENHANCEMENT — H1c CALIBRATION

*(rev 2. Not part of this ticket. Offered because the revision brief exposed a real gap: the
harness **requires** a band to be labelled CALIBRATED or ASSERTED — H1 item 6 — but defines no
procedure for earning the first label, so in practice every band ships ASSERTED and the
distinction has never once been exercised. Three shipped bands are in that state. This is
admissible under `HARNESS.md` §E, which requires all five fields.)*

**Trigger — CONDITIONAL.** Runs only when a ticket proposes an **economic threshold** (a level
whose crossing changes a rendered claim) *and* a data path to the series exists. A plausibility
band under `BANDS` does **not** trigger it: those reject the impossible and are asserted by
design. If the trigger fires and no data path exists, the phase still runs — to emit the
`ASSERTED` label and the §P.8 restriction — and stops there.

| Field | Declaration |
|---|---|
| **MODEL** | Claude Opus 5 · alternate GPT-5.6 Sol. *Why this tier:* the failure mode is a number that looks defensible and is not reproducible — distributional reasoning with no gate behind it (§0 Rule 2 forces the tier up). |
| **ROTATION** | Must differ from **H3**: the calibration output becomes an input to H3's boundary assertions, and a model asserting its own boundary then writing the test that confirms it is Rule 1 inside one number. May share a model with H1 — both are planning-family, neither judges a build. |
| **GATE** | **The recorded series is the gate.** A boundary is `CALIBRATED` only if a third party can recompute the stated percentile from the recorded window and get the same number. Unreproducible → `ASSERTED`. There is no suite that catches a wrong band, which is exactly why the evidence must travel with it. |
| **OUTPUT CONTRACT** | Per boundary: series id · **the host that actually answered** · observation window (start, end) · N · the rule the boundary expresses (percentile, definitional mean, ½σ, …) · the value · the literal tag `CALIBRATED` or `ASSERTED`. All of it goes into the source comment beside the constant, not only into the pass notes. |
| **STOP CONDITION** | Stop and emit `ASSERTED` — never improvise a number — when: the data path is unavailable; N is below the declared minimum; the boundary lands inside measurement noise; or the series has been redefined within the window. An `ASSERTED` band **may not gate an order-gating surface** (§P.8). |

Three rules the repo's own history dictates:

- **Record the host that served**, not the host intended — the ENGINE0-CONT rule (`_diag.sources`
  records the Kalshi base that answered, never implies it). A band calibrated off a mirror is a
  different claim than one off FRED.
- **A search snippet is not a series** (§6.3). Second-hand point values may sanity-check a
  plausibility band and may never calibrate a threshold.
- **State the unit.** The NFCI re-derivation (v3.43.1) found the original deadband meaningless
  because a z-score's native unit is standard deviations, not decimals. The boundary rule must
  name its unit, or it cannot be checked.

**First three candidates, ready the moment §10.2 resolves:** the NFCI ½-SD loose threshold
(v3.43.1), the 30Y / 10s30s bands (v3.55), and any `ICSA` promotion (§4). All three currently
ship asserted; all three are decision surfaces.
