# V5 SYSTEM AUDIT — 2026-08-23

End-to-end, first-principles audit of four subsystems — **runway months, PT rungs, next
dollar, technicals** — aligned back to fundamental requirements, for the purpose the owner
stated verbatim: *a retail investor with these names in a watchlist, wanting to know the
scores and next dollars and the thesis.*

Method: every claim below marked **[measured]** was measured against the live KV stores and
the deployed endpoints on 2026-08-23, not read from documentation. Where the finding is a
design judgment it is marked **[judgment]**. Thresholds and band tables are referenced by
their one home in source, never restated here (the REGIME_LOGIC_REFERENCE rule).

---

## §0 — The purpose, restated as the three questions

A retail investor opens the terminal with a watchlist. Every visit asks the same three
questions, in this order:

1. **THE SCORES** — which of my names are underwritten, how strongly, and how much should I
   trust each number?
2. **THE NEXT DOLLAR** — if I add money today, where does it go, and what gates that?
3. **THE THESIS** — per name: what is it worth, what would change my mind, when is the next
   event, and what do I own?

Everything the system does is in service of those three. A subsystem is correct exactly to
the degree it makes one of those answers truer or more legible, and every finding below is
traced to one of them.

## §1 — Fundamental requirements (derived, not asserted)

- **FR1 · Coverage** — every watchlist name produces a score *or a named reason why not*.
  Silence is never an answer (the owner's standing "the TT always gives an output" rule).
- **FR2 · One governing number** — exactly one score governs each name. Diagnostics may
  coexist but must be visibly subordinate. Two numbers at equal weight is zero numbers.
- **FR3 · Comparable units** — a ranking sorts on one unit per basis, bases labeled, and a
  number never leaks across bases (the DEC-D2 units doctrine).
- **FR4 · Honesty** — provenance, freshness and basis on every figure; unmeasured is never
  zero; stale is never fresh; the system reports, it never fabricates.
- **FR5 · Reachability** — each of the three answers is at most one tap from the default
  view, in one vocabulary that does not contradict itself across surfaces.
- **FR6 · Timeliness** — every input that ages carries a freshness rule matched to how fast
  that input actually changes (the dashboard's cadence doctrine, owed to every store).

---

## §2A — Runway months

**First principles.** The field exists to answer one question: *can this company fund itself
to the thesis?* `cash ÷ burn` is one IMPLEMENTATION of that question, correct for exactly
one funding regime.

**Measured state.**
- The live book contains all three regimes: equity-funded burn-downs (JOBY, ACHR, BETA,
  TEM), a debt-funded operator (CRWV), and a cash generator (SYM). **[measured]**
- v4.9.0 (`SELF_FUNDING` sentinel, deployed with v4.99) resolves the generator end: SYM's
  card carries the sentinel and its `PH_G2` flips UNKNOWN→PASS on next re-score. The
  burn-down end was always correct. The debt-funded end is doctrine, not code: the author
  may put committed facilities in the numerator with the formula stated. **[measured]**
- Cross-card sweep: zero numeric splits between P3's `runway_months` and `PH_G2`'s copy
  today — but an intra-session split (ACHR, 21.9 vs 24) occurred and was caught **by
  hand**, not by a lint. **[measured]**

**Findings.**
- **A1 (FR4/FR6): the same fact lives twice with no reconciliation.** P3 and PH_G2 each
  store a runway reading. The ACHR split proves divergence happens in ordinary work; only a
  human noticed. → v5: a `RUNWAY_SPLIT` drift lint (mode-aware — a PROFITABLE-mode P3
  legitimately has no runway field, as SYM shows).
- **A2 (FR6): P3 inputs never age.** `COMPOSITE_STALE` ages the composite, but a runway
  number — the fastest-aging P3 input, moving ~3 months per quarter — is never itself
  stale. The v4.9.0 entry names this; it remains open. Same hole for `SELF_FUNDING` (a
  generator can start burning). → v5: freshness rules on P3 inputs, cadence-matched.
- **A3 (data, not code): CRWV's committed-facilities figure** is the one number that turns
  a 2.89-month literal runway into a funded statement. Recorded on its card; still unsourced.
- **A4 (FR5): the retail sentence is missing.** The tab renders `runway_quality: 7` in
  components; the investor's question is "24 months of cash at the current burn." The
  sentence exists in the rationale string — it should lead. **[judgment]**

## §2B — PT rungs

**First principles.** The ladder answers "what is it worth" — and its architecture rule is
that **one computation serves every altitude** (`ptModelRows` → card, board, export), so no
surface can quote a target another surface disagrees with.

**Measured state.**
- All 30 cards scored 2026-08-23 reproduce their targets exactly from a fresh
  `ptModelRows` run, basis-aware, at live quotes (30/30 px-used == live-px). **[measured]**
- But that agreement is a **coincidence of freshness, not a guarantee**: the card freezes
  P1's target at `computed_at`, while the board ranks on the live rung. Price and consensus
  move; nothing watches the gap. **[measured mechanism, judgment on risk]**
- Two label-outlives-data defects were found INSIDE payload data this week: GEV's `basis`
  string claimed "floor only" while a premium multiple sat in the same object; CRWV's
  net-debt basis note contradicted the schedule beside it. Both caught by hand. **[measured]**

**Findings.**
- **B1 (FR2/FR6): frozen card target vs live ladder needs a stated rule and a tripwire.**
  Proposed rule (matching the alloc-receipt doctrine): *the receipt governs eligibility at
  its stamped basis; the live ladder governs ranking; a divergence beyond a threshold gets
  a `TARGET_STALE` drift chip naming both numbers.* → v5: extend the drift-lint family.
- **B2 (FR4): `LABEL_DRIFT` lint.** The GEV case is mechanically detectable: `basis`/`note`
  containing "floor only"/"no premium" while `pe_premium_multiple` exists. Cheap, and it
  catches the exact defect class this changelog keeps paying for — now proven to occur
  inside stored data, not just UI copy. → v5.
- **B3 (FR4, minor): several names carry GROSS cash recorded as `net_cash_B` upper bounds**
  (TSLA, CELH, GEV, TEM, SYM — each flagged on its basis note). Harmless on floor-only and
  earnings lenses where net cash doesn't compute; load-bearing the day an EV/S premium is
  added. A lint for the combination (gross-basis note + EV/S lens) closes the trap.

## §2C — Next dollar

**First principles.** One ranked list, one eligibility ladder, every exclusion named. The
scores the investor "wants to know" must be the scores the list actually uses.

**Measured state.**
- 33 score records; **28 carry a number** (5 SCORED, 23 PROVISIONAL); the 5 without are
  each a named reason (HOOD financials-mode gap; NVDA 8/26 print + 9-vs-8 hinge cap; SPCX
  lens ruling pending; ACHR/BETA `NO_FLOOR_PREPROFIT` by design). FR1 holds. **[measured]**
- **The eligible line still reads the LEGACY free-text composite** — `parseCompositeScore`
  over book-entry text — while the 28 server cards sit in shadow. FR2 is currently met by
  labeling ("LEGACY / UNVERIFIED governs"), not by resolution. **[measured]**
- **The §14.8 flip precondition is now met**: the owner's ordering ruling was *"flip the
  governor only after the current pick is SCORED"* — NBIS is SCORED 9.17/S with its
  falsifier set live. The gate-calibration blocker that ruling cited (G3 mis-capping the
  profitable AI names) was resolved by v4.5–v4.8. **[measured]**
- Post-flip reality check: 23 of 28 numbers are PROVISIONAL (B-capped, never eligible), so
  the ELIGIBLE line can only ever name the 5 SCORED names until falsifier sets land.
  **[measured]**

**Findings.**
- **C1 (FR2, the centerpiece): the governor flip is ready and is the single change that
  closes the purpose gap.** Wiring: the eligibility ladder reads card `status`/`score`;
  the composite tail sorts on card scores instead of parsed free text; "WAIT — methods
  disagree" retires; the legacy composite relabels as history. Owner approval required —
  it is THE ruling, not a code call. → **v5.0 centerpiece.**
- **C2 (FR1, owner work): the falsifier bootstrap is the bottleneck**, and it is 100%
  owner-authored by design (template falsifiers were explicitly declined in v3.78 —
  pre-commitment cannot be generated). Every PROVISIONAL name needs ≥3 pre-committed
  hinges. Ranked by what the flip would unlock: TSM 8.67 · RDDT 8.45 · BE 8.42 · CRDO
  8.29 · CRWV 7.71 — five falsifier sets convert the top of the ladder. → v5's parallel
  owner track.
- **C3 (FR3): units are coherent** post-v3.49/v4.6 labeling (%/yr rank · composite tail ·
  $-realisable options · basket mean with its guards). No change needed. **[measured]**

## §2D — Technicals

**First principles.** The WHEN leg exists because fundamentals decide WHAT and levels decide
WHEN — and it must *report, never veto* (locked doctrine, pinned in both directions).

**Measured state.**
- **The entire WHEN leg is dark today: 36 of 36 stamped names read exactly 8 days old
  against `PA_STALE_D = 7`.** Every level stamp — including the two owner-committed entries
  (NBIS, JOBY) — went stale simultaneously yesterday, because all were stamped in one
  broker session and nothing refreshes them. 3 names have no stamp at all. **[measured]**
- `techRead`'s banded verdict withholds on stale levels by design, so the technical verdict
  is withheld book-wide right now too. Honest — and unhelpful. **[measured]**

**Findings.**
- **D1 (FR6, the structural one): one flat staleness window for inputs that age at very
  different rates.** A 200-day moving average barely moves in 7 days; a 63-day swing level
  ages moderately; a pre-print pullback entry can be invalid the next morning (the reason
  the 7-day figure was chosen). The flat window is the pre-cadence design the public
  dashboard already outgrew (`cadenceOf`). → v5: per-input-kind staleness (MA / swing /
  entry), so a stale entry no longer takes the slow-moving MAs dark with it.
- **D2 (operational): stamps have no refresh cadence.** They are broker-MCP work at TT
  runs, by owner constraint — fine, but then the cadence must be a stated commitment
  (e.g. re-stamp at every sync, which the Robinhood runbook already structures) or the
  staleness windows must reflect reality. Either answer is honest; the current state
  (all-or-nothing dark) is the worst of both.
- **D3: married-never-merged holds.** The verdict touches no gate, no sort, no veto —
  smoke-pinned at every surface. No change. **[measured]**

---

## §3 — Cross-cutting findings

- **X1 (FR2/FR5): two scores on every tab is the largest single clarity debt.** Every name
  currently renders a legacy composite AND a shadow card, with disagreement states. Correct
  during shadow mode; the endgame is one governing number (C1) — everything else in this
  audit is smaller than that.
- **X2 (FR6): freshness doctrine is uneven across stores.** The dashboard has cadence-aware
  staleness; the book has `runState`/`PX_STALE_D`/`PA_STALE_D` (flat); the score store ages
  the composite but not its inputs. One doctrine — *every dated input declares its cadence;
  staleness is derived* — applied to all three stores, is the v5 theme underneath A2, B1
  and D1. They are one finding wearing three coats.
- **X3 (FR1): the 11 no-payload names** (RGTI · QQQI · DAC · VRT · ASML · DXYZ · TER ·
  KRKNF · MCHP · AUR · AVGO) still need owner MODEL + capture work before any engine can
  say anything. Named, out of assistant scope.
- **X4 (FR1, methodology): the financials mode gap** (SOFI · NU · HOOD) — P3 has no shape
  for a lender/broker (no operating line; FCF structurally meaningless; capital adequacy
  unrepresented). Sketched 2026-08-23: efficiency ratio + its direction + ROE/ROTCE +
  capital adequacy (regime-named) + credit-quality trend. A methodology version bump;
  owner call.

## §4 — Proposed v5.0 scope, ranked

| # | Item | Kind | Unlocks |
|---|------|------|---------|
| 1 | **§14.8 governor flip** — eligible line + tail sort read the server cards; legacy → history | owner ruling + wiring | FR2; the purpose itself |
| 2 | **Falsifier sprint** (TSM, RDDT, BE, CRDO, CRWV first) | owner-authored | un-caps 23 PROVISIONAL names |
| 3 | **Freshness unification** — cadence-aware staleness for PA inputs, P3 inputs, and `TARGET_STALE` (frozen card target vs live rung) | code | FR6 across all stores |
| 4 | **Drift lints** — `RUNWAY_SPLIT` (mode-aware), `LABEL_DRIFT` (GEV class) | code | FR4 |
| 5 | **Data closures** — PA re-stamp at next broker sync; CRWV facilities figure; SYM re-score post-deploy; SPCX lens ruling; **NVDA hinge drop before 8/26** | data/owner | named cards |
| 6 | **Retail legibility pass** — one plain sentence per pillar leading the tab (runway in months, target with basis, WHEN in words) | code | FR5 |
| 7 | **FINANCIALS P3 mode** | methodology bump | FR1 for SOFI/NU/HOOD |

Items 1–2 are the purpose; 3–4 are the guards that keep it true; 5 is hygiene with one hard
deadline (NVDA, 8/26); 6–7 widen the audience the system can serve.

## §5 — What was NOT found

For completeness, the negative results: PT-rung integrity held everywhere it was measured
(30/30 basis-aware); no runway split exists in stored data today; units do not leak across
ranking bases; report-never-veto holds at every pinned surface; and FR1 coverage is
complete — every name either has a number or a named reason. The system's architecture is
sound. What v5 owes it is **one governing score, one freshness doctrine, and the lints
that keep both true without a human noticing by hand.**
