# API palette upgrade — plan, verification, outcomes

**Plan authored:** 2026-09-16 · **Verified and executed:** 2026-09-17
**Branch:** `claude/api-palette-upgrade-1lcvnr` · **Cost:** $0

The plan proposed four provider moves. This note keeps the plan's substance, records what
VERIFICATION changed about it, and closes with outcomes. Where the original survey turned out
to be wrong, the correction stands beside it rather than replacing it — a survey that only ever
describes its own plan becomes a confident stale claim about the code.

---

## 0. The four moves, as planned

| # | Move | Planned key work | Planned code work |
|---|---|---|---|
| 1a | Street consensus ← Nasdaq analyst endpoints (keyless) | none | new fetcher + mapper |
| 1b | Revenue consensus ← Alpha Vantage `EARNINGS_ESTIMATES` | 1 free signup | small fetcher |
| 2 | TT candles ← Tiingo first, Nasdaq fallback | none (`TIINGO_KEY` deployed) | reorder rungs |
| 3 | `SPY` live print ← existing Finnhub batch | none | one array entry |

Planned order: 2 → 1a → 1b → 3.

---

## 1. Verification pass (2026-09-17) — what held and what did not

### 1.1 Move 2's premise: CONFIRMED, and it was worse than stated

`functions/api/ticker-facts.js` called Finnhub `stock/candle` as the first rung. That endpoint is
premium-gated on the free plan, so the rung returned
`missing("Finnhub", "premium daily candles unavailable")` on every symbol, every run, since it
shipped. The v3.98 Nasdaq scrape has been carrying the TT price ladder **alone, with nothing above
it** — not "the first rung is dead weight" but "the ladder has one rung and it is the scrape".

Nothing else in the repo consumed `candlesFact`; `TIINGO_KEY` has been deployed since v6.5.0.
**Built.** See §3.

### 1.2 ⚠ CORRECTION — Move 1a's premise is contradicted by the code

The plan's §4.3 maps the Nasdaq draft to `analystTarget.provider = "Nasdaq (Zacks consensus)"`
with a `nasdaq.com` `sourceUrl`. **A packet in that shape cannot be stored.** `validateStreetPacket`
(`functions/lib/tt-v2.js:149-156`) hard-locks both providers:

```
if (value.estimates.provider.toLowerCase() !== "seeking alpha")      errors.push(…)
if (!sourceHostMatches(value.estimates.sourceUrl, "seekingalpha.com")) errors.push(…)
if (value.analystTarget.provider.toLowerCase() !== "tipranks")        errors.push(…)
if (!sourceHostMatches(value.analystTarget.sourceUrl, "tipranks.com")) errors.push(…)
```

A Nasdaq-sourced draft fails with four errors at `PUT /api/street`. Three further findings on the
same path, none of them in the plan:

- **`lookbackMonths` is REQUIRED**, not optional (`{min:1, max:24, integer:true}`), and
  `normalizeStreetPacket` silently defaults a missing or null value to **3** — TipRanks'
  lookback convention. The plan says "Nasdaq doesn't state lookback; don't invent it" → `null`;
  `null ?? 3` is `3`, so the packet would carry an **invented claim about Nasdaq's methodology**.
  Exactly the fabricated-provenance defect v5.8 caught on the Graham/Buffett quote.
- **The provider is baked into the client too**, not only the validator: `public/admin.html:6785-6786`
  (blank-packet builder) and `:6867, :6872` (the confirm handler) hardcode both provider strings and
  the `lookbackMonths: 3` default, with 16 `TipRanks` / 5 `Seeking Alpha` label sites around them.
- `functions/lib/tt-alloc.js:174` documents the v4.2 target priority as "a REVIEWED packet's
  published TipRanks average", so the funding/eligibility layer reads the provider as doctrine.

**Consequence for scope:** Move 1a is not "a fetcher + a mapper". It is a change to an
order-gating contract (`tt-street-v1`, feeding `TT_ENGINE_VERSION = tt-gates-v2.2.0` receipts)
plus the terminal UI, and CLAUDE.md is explicit that such a change "deserves its own plan and its
own approval (§P.8)". **Not built. Re-scoped in §4.**

### 1.3 ⚠ CORRECTION — none of the three new doors is reachable from this build environment

The plan records the Nasdaq analyst endpoints as "Verified NVDA, NBIS". That verification did not
happen here and could not be reproduced here:

| Host | Result |
|---|---|
| `api.nasdaq.com` | `connect_rejected` — egress proxy denied CONNECT |
| `api.tiingo.com` | `connect_rejected` |
| `www.alphavantage.co` | `connect_rejected` |

Same posture as `federalreserve.gov` / `cboe` / `treasury` / `fred` (v3.71, v4.1.5, v5.1.0). So:

- **The Alpha Vantage key could not be curl-tested.** §2.3 of the plan is still owed, by the owner
  or by the first live call.
- **The Nasdaq analyst response shapes are unverified.** Building a mapper against them here would
  be writing a parser for a schema nobody in this environment has seen.
- Move 2 shipped anyway because its ladder has a **fallback underneath it** and its row shape is
  already parsed in-repo by `tiingoSeries` (the spotlight's total-return series reads the adjusted
  columns of the very same rows). The first Pages-edge call is still the true schema check.

### 1.4 Move 3 — owner ruling: LEAVE IT ALONE

The plan treats a live SPY print as a missing feature. It is not missing; it is **quarantined on
purpose**. v6.2 already built `fetchSpyClose` (`functions/api/snapshot.js:1618`) and deliberately:

1. scopes it to the **close edition only** — it never reaches the day key;
2. keeps it **out of `SOURCES`** and out of every merge, because `mergeFresherLeg` replaces a leg
   **whole** and would blind the Macro Flip crash circuit;
3. labels it **"last print", not "close"**, because whether `c` after 16:00 is the regular
   session's last trade or an extended-hours print is UNVERIFIED;
4. **refuses** a print whose trade date ≠ `expectedObsDate(now)` rather than relabelling it.

The palette plan addressed none of those four. **Owner ruling 2026-09-17: leave it alone** — the
readout stays a close-of-day artifact. Recorded here so it is not re-proposed as a gap.

---

## 2. Key handling (Alpha Vantage)

- A free key was obtained out-of-band and **pasted into the session transcript**. It is NOT in the
  repo, NOT in Cloudflare, and NOT in any commit — verified: `ALPHAVANTAGE_KEY` appears nowhere in
  tracked files.
- Because it has been through a chat transcript, treat it as **low-trust**: it is a free,
  rate-limited, read-only market-data key with no account access, so the blast radius is someone
  else spending 25 requests/day. Rotating it at `alphavantage.co/support/#api-key` costs one form
  and no code change — the whole point of the drawer.
- Storage, when Move 1b is built:
  `npx wrangler@4 pages secret put ALPHAVANTAGE_KEY --project-name macrodash`

---

## 3. Outcomes — what shipped (v6.6.0)

**Move 2 only.** `functions/api/ticker-facts.js`:

- `tiingoCandlesFact(raw, retrievedAt, refPx)` — pure, exported for smoke.
- `tiingoDaily(sym, env, now, fetchImpl)` — key-gated raw fetch, rides the parallel batch so the
  parse still waits on the same-refresh quote.
- Ladder is **Tiingo → Nasdaq**. The dead `candlesFact` and the `stock/candle` call are **deleted**
  (v3.73: dead code is a rot vector) and pinned absent.
- **Unadjusted OHLC is the load-bearing choice** — the ladder prices the tape a stop is actually
  placed on; reading `adjClose` from the same row would silently move every stored support level.
  Pinned BY VALUE against a 4-for-1-split fixture, not by the absence of a field name.
- Validation is the Nasdaq mapper's (positive OHLC + high/low ordering); a bad row is dropped, and
  when that opens a hole `candleSeriesFault` rejects the merge instead of storing it LIVE.

**Docs:** the retired requirement that the Finnhub plan "entitle daily `/stock/candle` history" is
removed and **pinned ABSENT** (v3.85 rule); the `TIINGO_KEY` env-matrix row now names the candle
ladder as well as the spotlight tracker.

**Tests:** 2369 → **2378 smoke** (+9) · **309 render** · **344 public-render** · `audit:prod` clean
(0 vulnerabilities) — all four gates run via `npm run gates`, browser suites in real Chromium.
Negative-controlled twice — reading `adjClose` turns the unadjusted pin red, deleting the
Nasdaq rung turns exactly the two ladder pins red.

### 3.1 A control that did not bite, recorded rather than quietly fixed

The first attempt at the ladder control used a `perl` pattern written with `{ try {` on one line
against a file that breaks them. It matched nothing, the suite printed green, and for a moment
that read as "the pin is vacuous". The CONTROL was wrong, not the pin. Rewritten against the real
line, it turns exactly two pins red. This is the v5.97.2 lesson in the other direction: a control
that passes because your model of the code was wrong proves nothing either way — check that the
control APPLIED before you read its result.

### 3.2 The lockfile drift, closed

`npm test` went red on "both package-lock version homes match package.json" — the drift v4.1.3
filed as hygiene ("it belongs in the next release that touches deps"). Both homes moved with the
bump. The pin did its job.

---

## 4. Re-scoped, not built

### Move 1a — Nasdaq street consensus

> **OWNER RULING (recorded on PR #43): option A — widen the provider allowlist truthfully.**
> Nasdaq/Zacks becomes an accepted street source under its own name; it is never labelled
> TipRanks. **Built in v6.6.1** — named `{provider → host}` allowlist, provider-aware
> lookback, PIN `/api/street/nasdaq-draft` (never writes KV), fail-closed mapper,
> Terminal confirm derives provider from the source URL. Mapper is fixture-tested;
> `api.nasdaq.com` is 403 from the build environment, so the first Pages-edge call is
> the true schema check (same honesty limit as v6.6.0 Tiingo).

The options as they stood when the ruling was taken:

- **A. Widen the provider allowlist.** Replace the two hardcoded provider/host checks with a named
  `{provider → host}` allowlist admitting Nasdaq/Zacks; make `lookbackMonths` provider-aware so
  TipRanks' 3 is never applied to a provider that does not publish one. Additive for stored
  packets (every existing packet stays valid and means what it meant), but it changes what
  `tt-street-v1` may contain and touches `admin.html`'s builder, confirm handler and ~16 labels.
- **B. Draft-only.** Fetch and map, render in the STREET INPUTS form, but require the owner to
  supply a confirmable provider. Cheap, and a draft that can never be confirmed is a dead button.
- **C. Drop it.** The OCR path works; the win is convenience, not capability.

Recommendation: **A**, as its own pass, with the Nasdaq schemas verified from a network that can
reach them first. Do not build the mapper before the shapes are seen. — **Ruled A, as above.**

**What A actually costs, so the next pass does not rediscover it:** a named `{provider → host}`
allowlist in `validateStreetPacket`, a provider-aware `lookbackMonths` (TipRanks' 3 must never be
defaulted onto a source that publishes no lookback), plus `admin.html`'s blank-packet builder
(`:6785-6786`), its confirm handler (`:6867, :6872`) and ~16 label sites. Additive for stored
packets — every existing one stays valid and means what it meant — so no schema version bump,
but it IS an order-gating contract and gets its own pass and its own negative controls.

### Move 1b — Alpha Vantage revenue
Deliberately deferred **because it has no consumer until 1a lands** — `revenueB` is a street-packet
field. Building a second unverified upstream ahead of the first is the speculative-building trap
v5.1.0 named. Design survives as planned: weekly per-symbol KV cache, daily budget counter capped
at 20 of 25, and the `"Information"` cap message parsed as *exhausted*, never retried.

---

## 5. Checklist state

```
[x] Move 2 — Tiingo candles (built, tested, negative-controlled, docs re-pinned)
[x] Move 1a — Nasdaq street draft   RULED A; built v6.6.1 (allowlist + PIN draft, never KV)
[ ] Move 1b — Alpha Vantage revenue    depends on 1a; key obtained, untested
[x] Move 3 — SPY live print         RULED: leave alone; collision recorded
[x] Docs — CLAUDE.md candle ladder, TIINGO_KEY matrix row, retired claim pinned absent
```
