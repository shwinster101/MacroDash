# 2026-08-31 — v5.10.0: the strip swap, and three Engine 0 statistics that were wrong for the exposure

**Status: SHIPPED same pass.** One owner directive plus three findings from an owner review of
the live board. Every claim was reproduced against the deployed `/readout.json` and
`/api/snapshot` **before** anything was touched — production turned out to be reachable from
this container, which the session summary had recorded as blocked.

## What the live tape actually said (2026-08-31, `as_of` 14:02Z)

| Field | Value |
|---|---|
| `us10y.m1_delta` | **+0.05** → `rangebound` → neutral vote |
| `tenYearD1` / `tenYearW1` | **+0.06** / **−0.01** |
| `tenYearSeries` (10 pts, oldest→newest) | 4.72 4.71 4.65 4.69 4.74 4.70 4.64 4.66 4.67 **4.73** |
| `thirtyYear` / `spread10s30s` | **5.22** (above its own 5.2 alert) / +0.49 |
| `fed_odds` | **null** — `fed_next_meeting` MISSING |
| `regime` | `TAILWIND` · **HIGH · FULL · OK** · `downgraded: null` |
| `qqq_spy_rs` | **−0.45pp, 1d basis** — and the ONLY bearish vote |

All four claims in the review confirmed. One correction below changed the fix.

## THE CORRECTION: the weekly window would have caught nothing

The review's mechanism — "a 3-session hawkish repricing … magnitude-over-30-days is the wrong
statistic" — is right about the SHAPE and the obvious remedy is wrong. Measured:

- 3-session move: **+0.09** (the largest positive 3-session move in the 10-point window)
- **1-week move: −0.01** — *flatter and marginally more dovish than the month it was meant to sharpen*

So reading `tenYearW1` instead of `tenYearM1` would have caught **nothing**. A repricing that
starts mid-week is invisible to a 5-session window for most of its life. The burst is measured
over 3 sessions for that reason, not by preference.

Second correction, less comfortable: **+0.09 is not a crisis.** Daily moves of ±0.06 appear
three times in that same 10-point window, so `tenYearD1 = +0.06` is an ordinary day. The
statistic that is genuinely elevated on this tape is the **30Y at 5.22, above its own alert
level**, with 10s30s at +0.49 — and Engine 0 does not check the long end at all. For a book
whose exposure is long-duration, that is the sharper gap, and it is not in this release.

## What shipped

### 1. LEV → NFCI on the macro strip (owner directive)

The 8th slot held `nfciLeverage` since 8/29 — a field that votes nowhere — while **NFCI, which
has voted in the six-factor backdrop since v3.43, had zero glance presence**. The strip's job is
to be the market summary; it was showing the non-voter and hiding the voter. NFCI gains the ▪
marker and the vote-derived sub colour BY CONSTRUCTION (`nfci` is in `FACTOR_FIELD`'s values),
and the sub-line stays `0 = avg` — a bare z-score is unreadable without its reference point
(v3.43), and TIGHT/LOOSE is a directional word whose TEXT must be suppressed off a dead feed.

**Not a deletion**: LEV keeps its home on the NFCI tile in MarketDetail. Pinned by a driven
assertion, not assumed.

### 2. The rate-path fail-open, closed

`fed_next_meeting` was dark and it cost **nothing** — HIGH · FULL · OK. Of the six checks it is
the only one that measures the POLICY PATH; the five survivors are structurally blind to
hawkish repricing (SPY is trend, VIX/F&G are vol and sentiment, RS is one session, the 10Y
smooths a burst away). The engine was grading that blindness HIGH.

The shape is the file's own: HIGH already NAMES gauges rather than counting
(`currentPanicGauges === 2`). The rate-path gauge joins that named set. With six checks,
`current >= 5` plus three named-current gauges still tolerates one of {spy, rs, 10y} lagging.

**One-way**, proved twice: structurally (a conjunct on the HIGH arm; the MEDIUM/LOW arms are
byte-identical on unchanged inputs) and by measurement — **6000 seeded scenarios: 0 more
permissive, 53 more restrictive, 5947 unchanged**.

**STATED CONSEQUENCE.** Kalshi has been rate-limited since v3.99, so this publishes
**MEDIUM · RESTRICTED · PARTIAL DATA** on today's tape and **FULL stays unreachable until the
feed is restored**. The keyed transport built in v3.99.1 is inert until `KALSHI_KEY_ID` and
`KALSHI_PRIVATE_KEY` are set. That is the point — the absence now costs something visible —
but it is a real operational change and the owner should know it is a two-secret unblock.

### 3. The 10Y burst term

`bandTenYear` is untouched, and the published `trend` still reports the month verbatim — the
statistic did not change meaning. A separate burst term measures the 3-session move off
`tenYearSeries` (no new fetch) and can move the check toward BEARISH.

**The threshold is derived, not fitted:** it is the SAME +0.15 the month-band already calls
`spiking`, so the claim is "a month's worth of hawkish move arrived inside three sessions" —
speed, using the band's own definition of size. It is reconciled against `bandTenYear`
behaviourally in smoke, so moving one moves both.

**Deliberately not tuned to its own motivating case:** today's +0.09 does **not** fire it, and
that is pinned as a control. A threshold chosen to make the tape that prompted it fire is a fit.
The burst is still REPORTED when it doesn't fire (`· 3-session +0.09pp`), so a reader can see
the month and the burst disagree in scale.

**Asymmetric** (v3.40 doctrine): a dovish burst does nothing. Thin evidence may add caution; it
must never manufacture a risk-on read.

### 4. RS — the 1-day vote, and the quarter that was never measured

**(a)** One session against a ±0.3pp deadband is noise, and on this tape it was the readout's
only dissent. `rsVote` applies the file's own `conservativeVote` asymmetry to THIN evidence
instead of stale evidence: **a 1d print may not vote bullish; a bearish 1d survives, flagged.**
The measured state is unchanged and still published — `leading` still reads `leading`; only the
vote is withheld, and the check's reason says so. One-way: removing a bull vote can only move
the verdict away from risk-on, and `available` is untouched.

**(b)** The NASDAQ100 pull was **8 observations deep** — enough for a latest/prior pair and
nothing else — so the quarter-long ratio genuinely was not measured. Deepened to 70; both legs
carry a 63-sessions-back point; `pairRs` computes `rs63` under the SAME same-date discipline
(both back-dates must match) and the quarter is OPTIONAL, so a short series still yields the 1d
pair rather than nulling the RS block.

**It does not vote.** Same rule NFCI (v3.43) and the 30Y (v3.55) arrived under: a new voter
changes majority math for a contract that gates real orders, and any band would be asserted
rather than calibrated (FRED is 403 from this build environment — probed, still true).
Promoting it is an owner call once real values have been observed.

## Schema

`tt-v1` is **unchanged and correct**: every new field is additive (`confidence_withheld`,
`us10y.burst_*`, `qqq_spy_rs.decay_*`), and `functions/readout.json.js` re-maps through
`buildTtReadout` on every request from the cached snapshot — verified — so deployed code always
governs the semantics and there is no cached-body-with-stale-semantics window. This follows
ENGINE0-CONT and v4.1.6, which both changed grade semantics inside `tt-v1`.

## Deliberately NOT changed

- `REGIME_BAND_TABLE` / `computeRegime` — the public six-factor backdrop is a different engine,
  and the review's findings are all about Engine 0's words (`rangebound`, HIGH confidence). The
  v5.9.5 sheet copy describing the public 10Y vote stays accurate.
- `bandTenYear`, `bandRs` — the band functions keep their contracts; both fixes are separate
  terms layered on top, so the public mirror of those bands cannot drift.
- No band was added to the 1-day `ndxSpxRs`, which has **never had one** — a real gap on an
  order-gating field, found while adding the `ndxSpxRs63` band, and named rather than silently
  widened into this change.

## Tests

**2123 smoke · 306 render · 229 public-render**, `audit:prod` clean, real Chromium under
`REQUIRE_BROWSER=1`.

| Negative control | Result |
|---|---|
| Revert the strip to LEV | 3 red |
| Remove the rate-path conjunct from HIGH | 2 red |
| Disable the burst's vote wiring | 2 red |
| Tune the burst threshold to 0.08 so the live tape WOULD fire (the fit) | 3 red |
| Remove the burst's asymmetry (dovish also fires) | 1 red |
| Remove the RS 1d bull withhold | 3 red |
| Remove the RS63 back-date pairing guard | 1 red |
| Let the decay vote | 1 red |

**One pin failed against correct code and the pin was wrong**, recorded rather than quietly
fixed: `burstLive(0.2, undefined)` was meant to test a MISSING `tenYearM1`, but `m1` is a
DEFAULTED parameter, so passing `undefined` restored `0.03` and the fixture silently stopped
testing anything. The engine was right; the fixture overrides the field explicitly now.

**A control also exposed a weak pin.** Disabling the burst's vote wiring turned only 1 red,
because the boundary pin asserted `burst_fired` (a flag) rather than the check's vote. Flag and
vote are different claims; the boundary pin now asserts the vote, and the same control turns 2.

## Still open

- **The long end is not an Engine 0 check.** The 30Y is at 5.22, above its own alert level, with
  10s30s at +0.49, and nothing in the order-gating readout looks at it — for a long-duration
  book that is the exposure. Not in this release; it is a new voter, which is its own ruling.
- **Kalshi.** Two secrets restore FULL actionability. Until then the board reads RESTRICTED, by
  design as of this release.
- **`ndxSpxRs` has no plausibility band.** One line, but on an order-gating field, so it is
  named here rather than bundled.
- **Promoting `decay_63d` to a voter** once real values have been observed — owner call, and it
  needs a calibrated band, which this environment cannot produce.
