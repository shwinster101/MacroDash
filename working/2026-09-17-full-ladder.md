# 2026-09-17 — the full YE(n)/YE(n+1) ladder, and the terminal surface that renders it

**Owner ask:** *"pull the full ladder ye26 and ye27 targets for all calculated with gate
available and composite as a table, ranked by percent increase"* + *"can this full table be a
live pdf or pop up or tab accessible via terminal?"*

Two halves: a **live pull** (method and aggregate findings, §0–§3) and a **built surface**
(§4, shipped as v6.7.0).

> ## ⚠ THE TABLE ITSELF IS NOT IN THIS FILE, AND THAT IS THE POINT
> **This repository is PUBLIC** (verified at the time of writing: `private: false`). A ranked
> table of every book name with its price targets, composite scores and gate states *is* the
> CANONICAL_BOOK by another name — the one artifact this project has refused to commit since
> v3.4 (`SEED=[]`, `BOARD` ships empty, `POSITIONS` ships empty, the TT framework lives in KV
> at `tt:framework:v1` precisely so the thresholds are not published).
>
> So the pulled table was delivered to the owner in chat and **deliberately left out of the
> repo**. What lives here is the METHOD, the aggregate findings, and the outcomes — the things
> a later session needs and that leak nothing. The live surface built in §4 renders the same
> table from KV at runtime, which is where it belongs: **the data has one home, and it is not
> this repo.**

---

## 0. Provenance of the pull — what was read, and how

Production is reachable from this build environment (confirmed again here: `/readout.json`
200 in 1.22s). Everything was pulled live with the owner's PIN over the `x-tt-pin` header:

| Endpoint | Shape | As of |
|---|---:|---|
| `GET /api/tt` | 54 book entries | book stamped `2026-09-15`, doc v25.3 |
| `GET /api/deepdive?all=1` | 45 payloads, `missing: []` | `2026-09-16` |
| `GET /api/score?book=1` | 35 score-index entries | methodology `tt-underwriting-v2.6.0` |
| `GET /api/quotes` ×2 | 54 quotes | `2026-09-17T16:28:34Z` |
| `GET /api/allocation` | receipt | business date `2026-09-17`, `tt-alloc-v3.1.0` |

**The targets were computed by importing the repo's own chain**, never re-implemented:
`ptModelRows` / `lintPtModel` from `src/ptModel.js`, and `evalBuyRow` / `whyNot` from
`functions/lib/tt-alloc.js`. That is what makes the pull checkable: it cross-ties to the
server's own receipt, which names the eligible pick at `y=2027` with a target and `up=194.7`
at its stamped price — this pull reproduces the identical target at the fresher live price,
so the only delta is the quote tick.

**Board state at the pull:** macro gate `SEND_IT` · allocation `ALLOCATABLE` · circuit `ARMED`
(as of 2026-09-13, 4d old) · receipt horizon `2027`.

### Found while pulling, filed not fixed
**`/api/quotes` truncates past 40 symbols and reports `missing: []`.** A 54-symbol request
returned exactly 40 quotes and an EMPTY missing list, so the tail was dropped silently and the
caller is given no way to know. The *client* states its cap and names the unquoted tail
(v3.30, `loadQuotes`); the *endpoint* does not. That is the v3.65 silent-truncation shape on a
server surface — a caller that trusts `missing` will believe it has full coverage. Out of
scope for this ask; it belongs on the backlog. (The pull worked around it with a second call
for the named difference.)

---

## 1. Aggregate shape of the book at this pull

Counts only — the per-name table is the owner's, in chat.

| | Count |
|---|---:|
| Book entries | 54 |
| …with a stored thesis payload | 45 |
| …with a YE(n) **or** YE(n+1) rung, i.e. on the ladder | **42** |
| …passing every ticker gate at YE(n+1) | **5** |
| Names with no rung: no payload at all | 9 |
| Names with no rung: payload present, no `pt_model` | 3 |

The three payload-but-no-model names are the basket (its rate is the equal-weight Mag-7
average by construction, v3.84, so it has no ladder of its own), a leveraged ETF, and one
ordinary name whose model has not been built.

**Why only 5 of 42 clear.** In descending order of frequency the blockers are: **falsifier
bootstrap** (§6.4.1 — `PROVISIONAL` caps at B and is never eligible, and it splits four ways
between *unwritten*, *set incomplete*, *committed-awaiting-observations* and
*committed-this-write*), then **`no gap`** (the YE(n+1) rung is at or below the live price),
then **`evidence:` blockers** (`TT never run`, `thesis undated`, `no hinges defined`), then
**`no server card — unscored`**.

---

## 2. What the two-year table shows that the one-rung ranking structurally cannot

- **The near year and the far year disagree, often and sharply.** Several names are deeply
  negative to YE(n) and solidly positive to YE(n+1); at least one is the reverse. The glance
  ranks on ONE rung at the horizon in force, so that spread has never been visible in one
  place — which is the gap this ask identified.
- **A high % and a usable gate are close to uncorrelated.** Two of the top five names on
  percent increase carry no server card at all, and one of the book's highest composites is
  vetoed on a single missing field. Ranking on % alone would put capital behind exactly the
  names the evidence layer cannot support — which is why the gate had to be a column and not
  a footnote.
- **A `FLOOR` row is a different claim from a `PREMIUM` row.** A floor asks only "what is this
  worth at a market multiple on forward earnings" and makes no forecast about the multiple.
  Seven of the 42 rank on floors, and the table labels each row's basis for that reason.

## 3. Honest limits of the pull

- **Not annualised, by design.** YE(n) and YE(n+1) are different horizons, so the two %
  columns are not comparable to each other as rates. The next-dollar ranking sorts on %/yr
  for exactly that reason; this table is deliberately the raw gap and says so on its face.
- **Self-attestation is unchanged.** Composites, tiers and thesis dates are the owner's own
  assertions; the gate reads their freshness, not their truth.
- **Prices are live quotes where available**, a stamped `ref_px` otherwise — disclosed on the
  row, never relabelled live (the v4.1 price-basis rule).

---

## 4. Outcomes — what shipped (v6.7.0, FEAT-TT-LADDER)

The answer to *"live pdf or pop up or tab"* is **all three out of one build**, because a modal
that prints is cheaper and more honest than any of them separately:

- **Pop-up** — `openLadder()` renders the table over the existing `#overlay` (openModal /
  closeModal / focus trap / ESC). **Not a fourth mode:** v5.7.0 locked NEXT $ and BOOK as the
  only persistent modes, and v4.6.0 already refused a fourth deck page for the same reason.
- **Tab / bookmark** — `#ladder` resolves to NEXT $, opens the table and replaces its own
  hash, so `parseTtRoute` / `applyRoute` never learn a state they have no case for. The
  arrival is honoured at the END of the boot chain (the v5.6.9 rule): a ladder built off an
  unread BOOK would report "nothing qualifies", a claim about data nobody has read.
- **PDF** — the browser's own print-to-PDF over the open modal, via a `@media print` sheet.
  No library, and no second renderer that could disagree with the screen. ⎘ COPY TSV is the
  spreadsheet path.

**The load-bearing change is the lift, not the table.** `rowVeto()` — the ELIGIBLE line's
per-row veto ladder — was a closure inside `renderNextDollar`, so any second surface wanting
the gate had two options: re-implement it (the drift defect paid for at v3.49's 5-vs-6
denominator and v3.39's PT audit) or show no gate at all. It is top-level now and VERBATIM;
the table and the green line cannot disagree.

**The years are computed, never literal.** The columns are the current ET year and the next,
and no year literal appears anywhere in the module — a hardcoded pair reads correctly today
and becomes a lie on 1 January (the FOMC-table / Mag-10-footer / "5-factor vote" defect).

**The gate follows the sort year.** `rowVeto`'s first rung is the gap, so evaluating it at one
year while ranking on another prints a verdict about a column the reader is not looking at.
Sorting by the near year re-evaluates the whole ladder there and the header states which year
it used. A name with no rung at the sort year is excluded and SAYS SO ("never substituted",
v4.1.3) rather than being reported as "no gap", which would claim a comparison that never ran.

### Corrections to my own work, recorded rather than quietly fixed

1. **The v5.6 word-collision guard fired on me.** The head said `GATE: SEND IT` while the
   table carried a per-row `GATE` column — one word, two verdicts on one artifact, which is
   exactly what that rule exists to stop. The head reads **MACRO GATE** now and states
   outright that the column is the ticker ladder. It also caught the TSV export, where
   `MACRO GATE: x` still *contains* `GATE: x`; the separator changed rather than the guard,
   noted at the code site so nobody "fixes" it back.
2. **The first entry link was buried in the collapsed DESK drawer.** `#buyBlock` lives inside
   `#dDesk`, so the link sat precisely where the v3.62 SHARE RANKS lesson — quoted in the
   comment beside it — says not to put it. The 390px browser assertion caught it, not a
   reading of the code. It is on the primary glance footer now, zero clicks deep.
3. **The smoke section crashed twice while being written** — once on a missing import, once on
   a fixture renamed in one place and not the other. Each killed the run with NO TOTAL, which
   reads exactly like a suite that passed (the v3.99.4 P0 shape). The section is try/catch
   guarded now, and the fixture defect is documented at the pin: a name missing BOTH years
   never reaches the sort at all, so only a one-rung name exercises the null-at-sort-year rule.
4. **The sort assertion initially demanded a CHANGED order**, which would fail on correct code
   whenever the fixture's two years happen to rank identically — the mirror of the v3.60.1
   vacuous-assert trap. It asserts monotonicity on the new key instead.

### Gates

**2472 smoke** (+29, section [87]) · **322 render** (+13, real Chromium) · **356
public-render** · `audit:prod` clean. Negative-controlled three ways — the years hardcoded
(2 red), the gate decoupled from the sort year (1 red), the veto re-implemented inside the
ladder (1 red) — each turning exactly its own pin and nothing else.

### Filed, not built

- `/api/quotes` truncates past 40 symbols and reports `missing: []` (§0).
- The ladder is read-only: it does not offer to pin the horizon or stamp anything.
- `board` sits near its 16KB cap (noted at v5.6.7); untouched here.
- No band, vote, quorum, freeze, gate threshold, provider, KV schema or receipt semantic moved.
  `ALLOC_RULE_VERSION`, `tt-v1` and the methodology version are untouched, and the public
  dashboard is byte-unchanged.
