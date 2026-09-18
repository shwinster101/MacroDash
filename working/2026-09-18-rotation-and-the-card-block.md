# 2026-09-18 — the Mag 7 rotation audit, the card block vs the strip, and what shipped as v6.9.5

Owner, on two live Simple screenshots (7:17 and 7:19 ET, iPhone):

> Still shows Microsoft and it's been 3 days. Audit the rotating mag 7 interface. And does the
> learning moment rotate? It should.
>
> Finally, decide, Does the middle volatility/10 year yield/financial conditions block high
> leverage given they are below with the 8 voters? What's the best way to display? It's the same
> popup too

Three questions. Everything below was measured against the LIVE model and the real source before
anything was changed.

---

## 1. The rotation — working; the cadence was invisible

`GET /api/stock-spotlight`, read live before any edit:

```
pair: {"anchor":"NBIS","comparison":"MSFT","comparisonLabel":"Established growth",
       "weekKey":"2026-09-14","rotationIndex":0,"nextComparison":"AAPL"}
generatedAt: 2026-09-17T22:02:13.438Z
lesson key: MSFT
```

- `weekKey 2026-09-14` is the Monday of the current ET week; the audit ran Thu 2026-09-18.
- v6.5.0's `nextRotation()` advances **weekly**, on the first successful refresh of a new ET week.
- So MSFT all week was the contract working, and `rotationIndex 0` is correct for the widget's
  first week live.

**The real defect** was `StockSpotlight.jsx:373`:

```jsx
{!simple && <span …>week of {m.pair.weekKey} · next: {m.pair.nextComparison}</span>}
```

The cadence and the next name were **Degen-only**, and Simple is the default view. The model
carried both facts and no surface a default reader sees rendered either. Three days of one name
with nothing stating the cadence leaves "it is stuck" as the only available reading.

**Second-order risk found while reading**: the rotation advanced only on a run where BOTH
companies' cap and total-return series came back live, so a stretch of dark nights held the pair
and did not advance — correct doctrine, but with the cadence invisible a held week and a normal
week looked identical.

**Fragility found while reading**: `nextRotation(stored, weekKey)` returns `{index: 0, first: true}`
whenever `stored.weekKey` is missing, so a rotation record that lost its week key would pin the
index at 0 **forever**, silently.

## 2. The learning moment — rotates, on the same clock

`LESSONS` is keyed by the seven roster symbols (MSFT/AAPL/AMZN/GOOGL/META/NVDA/TSLA) and the live
model reported `lesson key: MSFT`. It changes exactly when the comparison changes — weekly then,
daily now. It cannot be decoupled cheaply: each lesson's worked example is built from that
company's own figures (`exBoth(ctx, …)` over anchor + comparison), so decoupling means either
lessons that cite no company, or authoring more than seven. **Not done** — a content commitment,
not a toggle.

## 3. The three-card block vs the eight-tile strip — keep the cards

**Decision: not duplication.** The cards are the only place the *voting* quantity appears.

| | card | strip |
|---|---|---|
| 10-year | `4.94% · +0.23pp 1-mo` → **HURTING**, red rule, ▼ | `4.94%` / `−7bps 1D` in **green**, **red** ▪ |
| VIX | `15.44` → HELPING | `15.44` / `−13.4% WoW` green, green ▪ |

The 10-year appears twice, ~200px apart, with opposite colour treatments and a red vote marker
sitting on green text. Both readings are honest alone. The green came from:

```jsx
sc: pctColor(-d.crossAsset.treasury10y.d1)   // MacroStrip.jsx:46
```

— a hand-written directional judgment, on a window the band **never reads**. The same defect class
as the v3.62 hero chips (`f.bull ? green : red`, band table ignored), and the last one left on the
public page. Three of the six voters (F&G, CPI, NFCI) already derived their sub colour from the
band via `voteKey`; VIX and 10Y did not.

**The shared popup is correct** and was not touched: v6.3.0 pins a parameter's card sheet and its
tile sheet as the same object **by identity**, which is what stops an explainer drifting between
entry points.

**A live regression found while answering this**: `SimpleCards` is passed `usable`, `shown`,
`total` and rendered **none of them**. v4.0 made naming the truncation a contract; v4.0.1 folded
the count into one line beside the flip; when v6.x moved the flip out to the whys label the count
went with it. The call-site comment still claimed "the truncation is named on the block", and the
public-render pin **titled** "truncation … stay" asserts only absences. Visible on the owner's own
screenshot: the hero named four factors (2 helping, 2 hurting) above three cards showing 2 helping
and 1 hurting, with nothing saying the block was a subset.

---

## Outcomes — shipped as v6.9.5

| | before | after |
|---|---|---|
| pair cadence | weekly, index-advanced, stored | **daily**, derived from the ET date, reshuffled weekly |
| cadence visible in Simple | no | **yes**, both modes |
| held pair distinguishable | no | **yes** — `forDate` on the model |
| cards truncation stated | no (dead since ~v6.0) | **yes**, checked against the rendered cards |
| hand-written directional colours on voting tiles | 2 (VIX, 10Y) | **0** |
| `pctColor` call sites in the strip | 4 | **2** (SPY*, QQQ — context tiles only) |

**Design of the new rotation.** One seeded permutation of the roster per ET week
(`weekOrder(weekKey)`, FNV-1a → mulberry32 → Fisher-Yates), consumed one name per day
(`comparisonForDate(ymd)`, Monday = index 0). Seven names over seven days ⇒ every name holds
exactly one slot per week and Monday is a different name each week. Verified over 52 weeks: all
seven names take a Monday.

Sample, week of 2026-09-14 → `GOOGL AMZN AAPL TSLA NVDA MSFT META`; week of 2026-09-21 →
`TSLA AAPL AMZN MSFT META GOOGL NVDA`.

**Nothing is incremented**, which is the durable part: the pick is a pure function of the date, so
it cannot drift, cannot be pinned by a bad write, and needs no repair. The stored rotation record
is an audit trail. `nextRotation` and `comparisonAt` are deleted and pinned absent.

### Stated consequences, not hidden
- The spotlight leg rides the **weekday** crons, so the two slots landing on Sat/Sun are never
  refreshed and the weekend shows Friday's pick. Which two names varies weekly, so no name is
  systematically starved — but 2 of 7 slots per week are held rather than shown.
- The pick lands at the **6pm ET** refresh, not midnight, so a morning reader sees yesterday's
  pick. Attaching a spotlight leg to the existing 8am ET pre-open cron would move it to the
  morning. **Not done** — a Worker change needing its own `wrangler deploy`.
- A dark day is now **skipped**, not retried. Under the weekly scheme the name was re-attempted
  all week because the index had not moved. Better behaviour, pinned so it did not change in
  silence.

### Corrections to my own work, recorded rather than edited away
1. **Two pins matched their own explanations.** The source comment beside the shuffle says
   "`Math.random` is banned here", and the comment recording the strip fix quotes
   `sc:pctColor(-d1)` as the defect it removed — so raw sweeps matched the prose and counted 3
   where the code has 2. The v3.60.1 self-matching trap, twice in one release. Both sweeps strip
   comments now.
2. **A worse one, because it was silent.** A brace-bounded `[^}]*` regex over a strip tile stops
   at the first `}` of the `${…}` template the tile interpolates, so three "this tile carries no
   `sc`" checks passed **vacuously**. Tiles are read as a LINE now.
3. **A blanket `sed` on `admin.html` rewrote 11 historical version references** in comments while
   bumping the two version homes. Caught by grep before commit and reverted; the bump is
   line-targeted.

### Test work — the durable half
The old `[81]` endpoint pins asserted a memorized `"MSFT"`, which was only stable because the
rotation started at a fixed index. With the pick derived from the date those assertions would have
been testing a *name* rather than the *wiring*. The stub is symbol-agnostic now (every roster
symbol gets a CIK and facts) and the pins assert against `comparisonForDate(today)`. The name
ORDER is deliberately no longer pinned — the roster is a SET, and pinning a sequence would
re-assert the thing this release removed.

`cadenceLine` is **lifted and RUN** rather than string-pinned: the claim is about which words
appear on which day, and a regex over source cannot prove that.

### Deliberately not done
- The 8am ET spotlight cron leg (Worker change, own deploy).
- Decoupling the lesson from the pair (content commitment).
- The 12 `PENDING` type-floor files (Watchlist + Alerts hold 34 of the last 54 sub-10px leaves).
