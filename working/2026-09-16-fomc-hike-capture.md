# 2026-09-16 — the first rate HIKE in 3 years: what the dashboard captured

**Event (verified, not assumed).** The FOMC voted 12-0 to raise the target range 25bp to
**3-3/4 to 4 percent**, the first hike since 2023, **effective 2026-09-17** (implementation
note `monetary20260916a1.htm`). Prior range 3-1/2 to 3-3/4. Dot plot: 16 of 18 participants
see another increase. Tape: Dow -600.

**Method.** Every number below is read from the LIVE production surfaces at 19:21 ET
2026-09-16 (`/api/snapshot`, `/readout.json`, `/history.json`) — not from a fixture, not from
source inspection. Nothing was written; all reads.

---

## 1. Scorecard

| Axis | Grade | Evidence |
|---|---|---|
| **Anticipated the hike** | **Strong** | Kalshi `hike 86 / hold 12 / cut 2`, as_of 2026-09-16, LIVE |
| **Priced the transmission** | **Strong** | 10Y 5.00 (m1 +0.32 → `spiking`), 30Y 5.36, CPI `Re-accelerating` 3.7 |
| **Made the right call** | **Strong** | 10am frozen call `HODL · NEUTRAL`, 2 bull / 1 neutral / 3 bear |
| **Reported the event** | **Weak** | No surface anywhere says the Fed hiked today |
| **Reacted after 2pm** | **Partial** | 6pm close read fired on time — but rendered MUTED (`changed: false`) |
| **Machine contract (Engine 0)** | **Weak** | Publishing `TAILWIND · HIGH · FULL · missing:[]` at 19:21 off a 00:35 build |

---

## 2. What worked, with receipts

**2.1 The policy gauge called it — and this contradicts CLAUDE.md.** `rateOddsHike = 86`,
`rateOddsHold = 12`, `rateOddsCut = 2`, `rateOddsHoldAsOf = 2026-09-16`. Engine 0's
`fed_next_meeting` check voted **BEARISH** with the reason string
`"hold 12 / cut 2 / hike 86 (next meeting)"`, tier CACHED, `age_sessions 0`.

> ⚠ **STALE CLAIM IN CLAUDE.md.** The v5.10.0 entry states Kalshi "has been rate-limited
> since v3.99 … this publishes MEDIUM · RESTRICTED · PARTIAL DATA today and FULL is
> unreachable until the feed is restored." That is **no longer true** and has not been for
> some time: the live readout reads `available 7 · usable 7 · current 7 · historical 0 ·
> missing [] · confidence HIGH · actionability FULL`. The keyed transport (v3.99.1 + the
> v5.97.2 PKCS#1 parser fix) is working. This is the label-outlives-its-data defect the
> changelog keeps closing, sitting inside the changelog itself.

**2.2 The FOMC calendar was right.** `nextFomcDate = "2026-09-16"` — the date v3.99.0
entered as ASSERTED (web-sourced, proxy-blocked from the build env) and v3.99.1 had the owner
correct two of eight. Sep 16 was one of the ones that stood, and it was correct. The
client-side countdown (`dashboard.jsx:254`) recomputes from `nextFOMC` and reads `today`,
rather than trusting the snapshot's frozen `fomcDays = 1`. The v3.99.0 fix earned its keep.

**2.3 The bond market did the work the Fed tile could not.** 10Y **5.00%** (as_of 09-15),
m1 **+0.32** → `spiking` → BEARISH in BOTH engines. 30Y 5.36%, 10s30s +0.36pp, 10y-3m +0.86pp.
The 3-session burst was only +0.05pp, so `burst_fired: false` — correct: this was a
month-long repricing, not a three-day shock, and the v5.10.0 burst term reported without
firing exactly as designed.

**2.4 The ranked-headline engine did precisely what v6.1.0 built it for.**
- Pre-decision (00:35 ET snapshot): #2 *"Why a Federal Reserve rate hike could be a 'rare
  win' for your retirement money"*, #3 *"No one and done: The Fed will hike at least two
  times over the next year, according to CNBC survey"*.
- Post-decision (6pm close read): **all three ranks are the hike**, every one
  `category: "policy"` — the top weight (7) in `HEADLINE_CATEGORIES`. #1 *"Fed rate hike
  fails to calm troubled markets as Dow falls 600 points."*

**2.5 The 6pm close read fired, on time, on the post-decision tape.** Captured
`2026-09-16T22:00:44.081Z` (18:00 ET), `capture_status: CAPTURED`.
`legs_same_day: ["tenYear","thirtyYear","fearGreed","spyClose"]`, `legs_prior: ["vix","spyPrice"]`
— which is **exactly the night-1 prediction v6.2.0 wrote down**: *"expect 10Y/30Y via UST;
VIX only if CBOE's daily file carries today's row by 18:00, else honestly T-1."* It carried
`spy_close 754.05` (Finnhub last print, display-only, correctly labelled) against the
morning's 758.57, and F&G 28 → 26. **The v6.2.0 measurement instruction is now answered.**

**2.6 The call itself was right.** The backdrop degraded into the hike over three weeks:
`MOONING` (4 bull / 1 bear) on 08-26 and 08-27 → **`HODL · NEUTRAL`** today
(2 bull · 1 neutral · 3 bear: 10Y BEARISH, F&G 28 BEARISH, CAPE 40.71 BEARISH). HODL on a
day the Dow fell 600 is a good call, and the frozen record proves it was made at 10:01 ET —
four hours before the announcement.

---

## 3. What it missed

**3.1 Nothing on the page says the Fed hiked.** The FED tile reads the **pre-hike** range —
`fedTargetUpper 3.75 / fedTargetLower 3.50`, both `as_of 2026-09-15`. This is *arithmetically
correct*: DFEDTARU steps on the **effective** date, 09-17, so the tile self-corrects tomorrow.
But the whole reason v3.99.0 replaced FEDFUNDS with DFEDTARU was that the old series "cannot
move on a decision day" — and on the decision day the replacement also did not move, and
nothing marked why. The dashboard knew the meeting was today (`fomcDays → "today"`), knew the
market expected a hike at 86%, and ranked three post-decision Fed headlines — and still had no
surface that stated the outcome.

**3.2 No alert exists for a policy event.** Live alert evaluation tonight:

| id | alert | live value | state |
|---|---|---|---|
| 6 | 30Y Above 5.2% | **5.36** | **FIRED** |
| 4 | 10Y > 5% | **5.00** | CLEAR — `above` is strict, so exactly 5.00 does not fire |
| 3 | F&G Extreme Fear (<20) | 26 | clear |
| 2 | VIX Spike (>25) | 17.2 | clear |
| 1 | SPY Below 200D MA | 758.57 vs ma200 717.12 | clear |

One alert fired, and it was the long end — not the Fed. `ALERT_METRICS` has **no
`rateOddsHike`, no `fedTargetUpper`, no policy metric at all**. The 86% hike probability sat
live in the snapshot with no alert channel. Separately: the 10Y landing *exactly* on 5.00
against a strict `above` is a near-miss worth noting, not a defect.

**3.3 `/readout.json` is structurally blind to the post-FOMC session.** At 19:21 ET it
publishes:

```
verdict: TAILWIND · bullish 3 · bearish 2 · confidence HIGH · actionability FULL
current 7 · historical 0 · missing [] · every check age_sessions: 0
as_of: 2026-09-16T04:35:19.587Z   ← the 00:35 ET build
```

The day key was written at 00:35 ET with HIGH confidence → 48h TTL → it served the entire
session, and v6.2.0's close edition deliberately **never republishes the day key**
(`basis.day_key: "untouched"`). So the machine contract that gates real orders reports
TAILWIND at FULL actionability, four hours after a hike-driven -600 Dow, and **its own
freshness axis cannot see the problem** — `sessionsBehind` counts the prior close as 0
sessions behind, so morning-stale reads as `current`. That was the right trade for receipt-hash
stability; it is the wrong answer on a decision day.

**3.4 The two engines split on direction, from the same F&G number.** Public backdrop bands
`>55 bull / <30 bear` → **28 = BEARISH**. Engine 0 bands `bull 25–55 / bear <20 or >75` →
**28 = BULLISH**. Married-never-merged is doctrine and both are internally consistent, but
today it produced `HODL` on the public face and `TAILWIND` on the machine feed off one
sentiment reading. Recorded, not filed as a defect.

**3.5 The 10am leg served a cache hit rather than rebuilding.** The frozen call's factors all
read `mode: "CACHED"` with `tenYear as_of 2026-09-15`, while the 6pm close read's factors read
`mode: "LIVE"` with `tenYear as_of 2026-09-16`. The close edition has **no GET fallback**
(`cron.js:263-300`) and it succeeded, so `REFRESH_TOKEN` is configured and working — which
means the 10am leg either fell through to the GET fallback or `publishIfNoWorse` refused an
equal-quality candidate. Low consequence today (FRED had not published 09-16 at 10am either
way), but it means the scored daily record was built on a cache hit, not a rebuild. **Not
diagnosed** — would need `?debug=<DEBUG_TOKEN>` on `_diag.cronJobs`.

**3.6 The close-read line rendered MUTED.** `drift_vs_call: {changed: false, from: HODL, to:
HODL}`. Per v6.2.0 the hero line is coloured only when the read DISAGREES with the frozen
call. Both were HODL, so the one line on the page carrying post-FOMC data was styled as
agreement on the most consequential session of the quarter. Honest by the rule; understated
in effect.

---

## 4. Root cause, stated once

The dashboard is built to answer *"is it safe to be in the market?"* from **state**, and it
answered that well today. It has no concept of an **event** — a scheduled, dated, discrete
policy decision whose occurrence is itself the news. Every mechanism that touched the hike
touched it as a *level* (a yield, a probability, a headline rank); none of them recorded that
a thing happened at 2pm. That is why the anticipation was strong, the call was right, and the
page still never said the Fed hiked.

---

## 5. Ranked backlog (proposals — none built in this pass)

1. **Decision-day marker on the FED tile** (presentation only, no new fetch). Data is already
   in the snapshot: `nextFomcDate === etYmd()` plus a target-range delta vs the prior
   observation. Render the outcome and the effective date rather than a silently-unchanged
   range. Cheapest honest fix for §3.1.
2. **A policy metric in `ALERT_METRICS`** — `rateOddsHike`/`rateOddsCut` above a threshold,
   and a target-range-changed alert. Fail-closed/BLIND on a dark Kalshi leg like every other
   alert. Closes §3.2.
3. **An evening-aware freshness axis for `/readout.json`.** `expectedObsDate` and
   `failsafeDue` already exist (v6.2.0, `src/sources.js`) and already answer *"should today's
   close be published by now?"* Wiring that into the readout's tier resolution — so a leg whose
   expected same-day observation exists but was never read resolves BEHIND rather than
   CURRENT — closes §3.3 **without** adding a `close_read` sibling to the tt-v1 body or
   touching a single receipt hash. Highest-leverage structural item.
4. **Correct the Kalshi claim in CLAUDE.md** (§2.1). One paragraph, and it is currently
   telling every future session that FULL actionability is unreachable when it is not.
5. **Verify the 10am refresh leg** (§3.5) via `_diag.cronJobs` with the debug token.

---

## Outcomes — pass 1 (the read-through)

- **Read-only.** No code, band, threshold, alert, copy or contract changed. No KV write.
- Shipped: this note only, on `claude/dashboard-rate-hike-capture-btorrb`.
- **Corrections to prior belief, recorded rather than edited away:** (a) CLAUDE.md's
  "Kalshi rate-limited / FULL unreachable" claim is stale — the feed is live and Engine 0
  reads HIGH/FULL with `missing: []`; (b) the FED tile is **not** wrong tonight — the new
  range is effective 09-17, so DFEDTARU is correctly unchanged, and the gap is
  *communication*, not arithmetic. Both were my initial reading before checking the
  implementation note and the live readout, and both were wrong.
- **v6.2.0's night-1 measurement instruction is answered** (§2.5): same-day legs were
  10Y/30Y/F&G/SPY-close, VIX honestly T-1 — exactly as predicted.

---

## Outcomes — pass 2 (built: backlog items 1 and 2), v6.6.0

Owner call, same day: *build the decision-day marker and the policy alert.* Both shipped;
everything else in §5 stays filed.

**Built.**
- **`src/fedPolicy.js`** (new, pure, Node-importable): `targetStepFrom` walks FRED's own
  observations for the prior distinct bound and the effective date; `fedDecisionState`
  resolves `MOVED` (confirmed step, ≤ `FED_MOVE_FRESH_D` = 7 days) or `TODAY` (the meeting,
  plus what the market has PRICED — never an outcome); `fedMoveBp` is the alert reader.
- **Four additive snapshot fields** (`fedTarget{Upper,Lower}{Prev,ChangedAt}`), each
  `DERIVED_OF` its own bound, banded like their parents, landing on the mock baseline.
- **The FED tile's marker** — amber, never `voteStyle`, with the transition, both ranges and
  the effective date in the sheet and the tooltip.
- **Three alerts** (ids 10/11/12): hike-odds > 60% ON, cut-odds > 60% OFF, `Fed Moved Rates`
  ON reading magnitude so a cut trips the same alert.
- Gates: **2386 smoke** (+28) + 309 render + **332 public-render** (+3), five negative
  controls run, all biting. `package-lock.json`'s root version — stale since v4.1.3 filed it
  — synced.

**Corrections to pass 1, recorded rather than edited away.**
- §3.1 said the tile "had no way to say" the Fed moved and implied the fix was cosmetic. It
  was not: the data to detect a move **did not exist** in the snapshot at all. DFEDTARU's
  level alone cannot tell you it stepped — that needs the prior distinct value and the date,
  neither of which was emitted. The fix is a pipeline change, not a copy change.
- §5 item 1 proposed keying the marker on "a target-range delta vs the prior observation."
  Wrong shape: the prior *observation* is usually the same value, so the useful comparison is
  the prior **distinct** value plus the date the current one first appeared. Built that way.
- §5 item 2 proposed "a target-range-changed alert" alongside the odds alerts as if it were a
  third threshold. `evalAlert` only does `above`/`below` on a number, so it became a
  magnitude metric — which turned out better: one alert covers a cut as well as a hike.
- Pass 1 did not notice that `alertEngine.js` was pinned as importing nothing. That pin was
  reversed (with the reason at the pin) rather than worked around.

**Two test defects of my own, recorded per the house rule.**
- My first browser pin swept the whole FED sheet for an outcome word and went red against
  **correct code** — `FED_EXPLAIN` says "a surprise cut or hike", so it read the explainer's
  prose as a claim the marker had made. Scoped to the eyebrow line.
- The FED-sheet eyebrow pin I inherited was quietly **calendar-dependent** (it required the
  reading and the vote clause to be adjacent, so it passed on ordinary days and would fail
  every decision day). Re-pinned on the property, not the adjacency.

**Still open from §5, unchanged:** items 3 (the `/readout.json` evening blind spot — the
highest-leverage structural item), 4 (now done: the stale Kalshi claim is corrected in
CLAUDE.md's v6.6.0 entry) and 5 (verify the 10am refresh leg via `_diag.cronJobs`).
