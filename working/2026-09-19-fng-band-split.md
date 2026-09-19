# The F&G band split — disclose now, decide later (v7.0.3)

**Status: DECISION DEFERRED, SPLIT DISCLOSED AND PINNED.** This slice adds an asterisk to the
public F&G sheet and reconciles both band tables in smoke. It deliberately does **not** unify
them. Unifying is a model change and is written up below as an owner ruling that has not been
made.

---

## 1. What materially changed since v7.0.1

Nothing in the model. v7.0.1 made the voter explainer's bullet 2 a *dated current-vs-reference*
line built from the canonical band ruler (`src/voterSheet.js`). That is what surfaced this: the
sheet now states a reference band out loud, on the default view, for all six voters — so a
reference that is **not the only band the product applies to that number** became a visible
claim rather than an internal detail.

## 2. The two tables, measured

| | Backdrop (`REGIME_BAND_TABLE.fearGreed`, `src/regime.js`) | Terminal gate (`bandFearGreed`, `src/ttReadout.js`) |
|---|---|---|
| bull | `> 55` | `25 … 55` (inclusive both ends) |
| bear | `< 30` | `< 20` **or** `> 75` |
| neutral | `30 … 55` | `20 … 24` and `56 … 75` |
| shape | **monotone** — more greed is more bullish, without limit | **contrarian band** — greed is bullish up to a point, then bearish |

Swept over all 101 integer readings 0–100:

```
DISAGREEMENT RANGES (backdrop vs terminal gate)
  20–24   backdrop=bear     terminal=neutral
  25–29   backdrop=bear     terminal=bull      <- sign inversion
  30–55   backdrop=neutral  terminal=bull
  56–75   backdrop=bull     terminal=neutral
  76–100  backdrop=bull     terminal=bear      <- sign inversion
81 of 101 readings disagree. The two tables agree only on 0–19.
```

Two of those ranges are **sign inversions**, not shading: at 25–29 the public page says this
factor hurts while the order-gating engine counts it as bullish, and at 76–100 the public page
says it helps while the order-gating engine counts it as bearish. The live mock fixture
(`fearGreed: 62`) sits inside a disagreement range today — backdrop bull, terminal neutral.

## 3. ⚠ Correction to my own first sweep, recorded rather than edited away

My first pass reported **three** divergent factors and claimed the 10Y disagreed on 121 of 121
sampled readings. That was an artefact of my own normalisation, not a finding:

- **VIX** — `bandVix` uses `< 18` bull / `> 25` bear. Identical to the backdrop. **0 of 111
  sampled readings disagree.**
- **10Y** — `bandTenYear` uses `< −0.10` / `> +0.15`, the **same edges** as the backdrop. It
  returns a *trend* vocabulary (`falling` / `rangebound` / `spiking`) that is mapped to a vote
  downstream, and I had compared that vocabulary against bull/bear/neutral as if the strings
  were comparable. **0 real divergence.**

This matters to the decision, and it is why the correction is kept: the two-engine architecture
does **not** inherently produce different numbers. Of the three inputs both engines read, two
are edge-identical and one is not. **F&G is the sole outlier**, which makes "two jobs" a claim
about one factor rather than a property of the design.

## 4. Other consumers of the terminal band, so a unify is scoped honestly

- `CRITICAL_CHECKS` includes `fear_greed` — a missing F&G forces HOLD and blinds PANIC.
- The **PANIC override** fires on `vix > 25 AND fearGreed < 20`. It reads the terminal's `20`
  line, not the backdrop's `30`. Unifying on the backdrop's numbers would move the panic edge.
- `/readout.json` publishes the check verbatim: `F&G 62 (bull 25–55 · bear <20 / >75)`, and an
  external terminal gates real orders on it.

## 5. An internal tension worth stating, since it decides nothing but frames the choice

The backdrop sheet's bullet 3 already reads: *"neither extreme establishes that a reversal is
due."* The terminal gate's `> 75 → bearish` rule is, in substance, a mild reversal claim on the
greed side. Both are defensible; they are not the same theory of sentiment. Whichever way the
ruling goes, one of these two sentences will need to move.

## 6. The ruling that has not been made

### Option A — keep two jobs
The backdrop answers *"is the macro backdrop supportive of taking risk?"* The terminal gate
answers *"may capital move into a position right now?"* Those are different questions, and
sentiment is exactly the input where they can legitimately diverge: rising greed is a
supportive backdrop **and** a worse entry. On this reading the split is correct and the only
defect was that it was undisclosed.

**Cost:** the public page and the terminal can print opposite directions for one number, ~200px
apart on the operator's own route. That is the v6.0.2 defect class ("one page, two answers"),
which this repo has spent releases removing everywhere else.

### Option B — one number, one vote
Two tables for one input is the drift defect this changelog keeps paying for (v3.49's 5-vs-6
denominator, v3.53's threshold extraction, v3.83's collinearity split). A reader cannot hold
two bands for one gauge, and the product's own doctrine is one home per threshold.

**Cost:** unifying is not a copy edit. Adopting the backdrop's band into Engine 0 changes the
majority math of a contract that gates real orders and moves the PANIC edge from 20 to 30 —
the exact reason NFCI (v3.43) and the 30Y (v3.55) both arrived as **non-voters**. Adopting the
terminal's band into the backdrop flips the public verdict on any tape above 75 and re-bands
30–55 from neutral to bullish, which would move the published daily call.

### What this slice does instead
**Neither.** It discloses the split where the reference is stated, and pins both tables so the
split cannot be closed — in either direction — without a red test forcing the ruling into the
open. A silent unify is the one outcome that must be impossible, because both directions move
a number that is already gating something.

### What would decide it
Owner ruling, not measurement — both bands are **asserted, not calibrated** (FRED and CNN are
unreachable from this build environment; the NFCI precedent applies). The question to answer is
the one in §6's headings: *does sentiment do one job or two in this product?* If one, the
follow-up release picks a band, states which consumer's semantics moved, and re-bands the loser
with a version bump on whichever contract changed (`tt-gates-*` for Engine 0, a public call
note for the backdrop).

## 7. What shipped in v7.0.3

- **Copy.** `FG_GATE_ASTERISK` in `src/regime.js` — one home, beside the band it qualifies —
  reaches both render paths of the F&G sheet: the static `explain.what[1]` that the macro-strip
  tile renders, and the composed bullet 2 that `voterSheet()` builds for the Simple cards and
  the Drivers matrix, where it lands immediately after `Model reference: <ruler>.`
- **⚠ Correction to my own first cut, recorded rather than edited away.** I wrote the strip path
  as "Simple behind the fold, Degen directly" and the browser pin timed out against a correct
  page. Since v6.9.9 **both** modes lead with `SimpleMarketTape`, and the eight-tile strip
  (`variant="context"`) renders **only** inside Simple's *Explore market data* fold. So Degen has
  no F&G strip sheet at all and reaches the caption solely through its driver card. The browser
  pin is scoped to Simple for that reason — a conditional click would have passed vacuously in
  Degen, which is the v3.60.1 trap.
- **No band moved.** `REGIME_BAND_TABLE`, `bandFearGreed`, every vote, quorum, flip edge and
  the PANIC override are byte-unchanged.
- **Pins.** Both tables reconciled behaviourally in smoke, the disagreement asserted as a
  measured fact, and the asterisk's numbers checked against edges **derived from
  `bandFearGreed` itself** rather than retyped.

## 8. Why the pin lives in the test and not in the runtime

The obvious "one home" move is to have `regime.js` import `bandFearGreed` and interpolate its
edges into the sheet. Rejected: `src/regime.js` currently imports **nothing**, and the two
engines are deliberately married-never-merged. Making the public backdrop import the
order-gating band function to render a caption would couple them for a presentation reason —
and the coupling would then be load-bearing the first time someone edited either.

The reconciliation therefore lives in `test/smoke.mjs`, which already imports both. This is the
repo's established idiom for exactly this shape: the SOURCES ↔ DERIVED_OF reconciliation, the
playwright `EXECUTABLE_PATHS` reconciliation, and the v5.8 ruler ↔ `vote()` ↔ `flip`
reconciliation all pin two homes against each other from the suite rather than fusing them.

## 9. Outcomes

**Landed as v7.0.3.** Gates: **2,730 smoke** (+19) · **353 admin-browser** · **710
public-browser** (+8) · `audit:prod` clean, all browser suites driven in real Chromium under
`REQUIRE_BROWSER=1`.

- The asterisk is scoped to **F&G only**. VIX and the 10Y are edge-identical (§3), so an
  asterisk on those would claim a split that does not exist. `gateAsterisk` is an optional band
  field and only F&G carries one; a pin asserts that, so adding one later is a deliberate act —
  and the VIX/10Y identity is itself pinned, so a future edit that *made* them diverge asks the
  caption question for that factor instead of missing it.
- The 75-word ceiling on `explain.what` still binds and was re-measured at **68**, not loosened.
- **Negative-controlled six ways**, each turning exactly its own pins: unify terminal→backdrop
  (`measured 0`), unify backdrop→terminal (`measured 0`), terminal bull range moved to 25–60
  with the caption untouched (`measured 76` — the caption-rot case), the asterisk dropped from
  the `voterSheet` path (2 smoke + 2 browser red, strip path correctly green), and VIX made to
  diverge. The disagreement pin reports its own measurement in every case, so a future failure
  is a diagnosis rather than a mystery.

### Two of my own errors, recorded rather than edited away

1. **The three-factor sweep was wrong** — §3. Caught before anything was written, but it would
   have shipped a changelog claiming the split is a property of having two engines, which is the
   opposite of what the measurement says.
2. **The first cut named this file's path inside a `src/regime.js` comment**, tripping the
   pre-existing *"`working/` is NOTES — no product surface may import it"* sweep. `src/` has
   never referenced this tree. The path came out of the source; the sweep was **not** taught to
   strip comments, because a pin does not get loosened to fit the change that broke it. CLAUDE.md
   carries the path, as it does for every other working note.

### Found, NOT fixed — pre-existing, out of this slice's scope

`voterSheet()`'s withheld branch renders a **double period**: *"Current reading unavailable — not
counted in this comparison.. MOCK · …"*. The unavailable string already ends in a full stop and
the template adds another. Shipped in v7.0.1, unrelated to the band split, visible on the public
page whenever a voter's feed is dark. Named here rather than fixed drive-by in a branch about
something else.
