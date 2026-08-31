# 2026-08-31 — v5.97.0: the long end becomes an Engine 0 voter

**Status: SHIPPED same pass.** Owner call, closing the gap v5.10.0 named as found-not-fixed:
*"the 30Y is at 5.22, above its own alert level, and Engine 0 does not check the long end at
all — for a long-duration book that is the exposure."*

This is the highest-risk change this file has taken: **a 7th voter in a contract that gates
real orders.** Three things had to be true before it was safe to ship, and each is a section
below.

## 1. The count trap — closed BEFORE the check landed, not after

`current >= 5` for HIGH confidence was written against SIX checks, where it means *at most one
may be dark*. Against SEVEN the identical literal means *at most TWO*. So adding a voter would
have **silently loosened the strongest claim this engine makes**, while looking like a pure
addition.

That is the DEC-31 defect verbatim — a 6th factor against a hardcoded `3` re-creating the bug
DEC-31 had just removed. And it had a second instance: the MEDIUM arm's own v4.1.6 comment is
what exposed it, because it *derives* `current >= 4` from "non-current ≤ 2 **given six
checks**". MEDIUM-vs-LOW is the line between RESTRICTED and HOLD.

Both are now derived from `checks.length`. At six checks they evaluate to the shipped literals,
so the change is inert on its own — proved two ways: the suite stayed green with no re-pinning,
and the v5.10.0 one-way sweep re-ran identically (0 / 53 / 5947).

**This is the part I would have got wrong by doing the obvious thing first.** Writing the check
and then running the suite would have shipped a loosening that no existing pin measures.

## 2. Not collinear — which is the whole reason it earns a vote

A 30Y monthly delta beside a 10Y monthly delta is **collinear**: a parallel shift casts two
votes for one fact. That is exactly the v3.83 FEAT-TT-TECHREAD defect, where `price vs 50d`,
`price vs 200d` and their alignment turned one observation into three votes and inflated the
tally the reader trusts most.

So `us30y_curve` reads what the 10Y check structurally cannot — the **shape** of the curve and
the long end's **own speed**:

| Arm | Fires on | Derived from |
|---|---|---|
| `widening` | spread's monthly change > +0.15 | `bandTenYear`'s own spiking edge (same unit, same window) |
| `burst` | 30Y 3-session move ≥ +0.15 | `TEN_BURST_PP`, the v5.10.0 term reused |
| `inverted` | 10s30s < 0 | structural — zero *is* inversion, like NFCI's mean-at-zero |

Pinned in **both** directions: a parallel shift moves the belly and leaves this check flat; a
long-end breakout while the belly is calm votes bearish and nothing else sees it.

## 3. Bearish-only — which is what makes a 7th voter safe at all

Adding a voter changes majority math. A check that **cannot vote bullish** can only move the
verdict TAILWIND → NEUTRAL → HEADWIND, so the worst case of being wrong is excess caution. That
converts "this needs its own plan and approval" into a change that is safe by construction.

Measured, not argued: **7835 comparable generated scenarios — 0 more risk-on, 1617 more
cautious, 6218 unchanged.**

It is also the honest read. A calm long end is the ordinary backdrop, not a buy signal — the
NFCI v3.43.1 asymmetry, whose finding was that a factor which always votes one way *biases* a
tally rather than informing it.

## Why there is no level arm, though the level is what prompted the ticket

This is the one place I did not build what was literally asked for, and the reason matters.

A high-but-**stable** long end is priced in; the damage is the repricing. Worse, a level arm
would vote bearish every day the 30Y sat above its line — a **permanently one-way voter, the
exact flaw v3.43.1 removed from NFCI**, and it would degrade the tally rather than sharpen it.

So the level rides the check's reason as **evidence** (v3.55's *"a stated REFERENCE level, never
a verdict"*), and the repricing votes. The number the owner is watching is visible on every
surface without being a vote — pinned with a 6.5% fixture that still reads neutral.

## What it does on the live tape: nothing

30Y 5.22 · 10s30s +0.49 · curve **flattening −0.04** over the month · 3-session +0.05 → all
three arms quiet → **NEUTRAL**.

That is the right outcome for a new voter in an order-gating contract: **inert on the tape it
shipped on, biting only on the condition it was built for.** A check tuned to make its own
prompting tape red is a fit, and it is pinned as a control that this one is not.

## Scope held

- **The PUBLIC six-factor backdrop is untouched.** `REGIME_BAND_TABLE` still has no 30Y. The
  v3.55 arrival pin **splits** rather than being deleted: its ttReadout half inverts by owner
  call, and its public half survives — and is now what keeps the two engines from quietly
  merging. The v5.9.5 sheet copy depends on that half.
- **Appended at index 6**, so every consumer and pin indexing `checks[0..5]` is untouched.
- **Same-date safety inherited, not re-derived**: the curve change is
  `thirtyYearM1 − tenYearM1`, and after v4.1.5's per-leg recency merge the legs can come from
  different sources — so the arm gates on `spread10s30s` being present, which snapshot.js
  already drops on a date mismatch.

## Tests

**2136 smoke · 306 render · 229 public-render**, `audit:prod` clean, real Chromium.

| Negative control | Result |
|---|---|
| Add a level arm | 3 red |
| Loosen the widening edge to 0.02 (a fit that fires on the live tape) | 2 red |
| Collapse to the collinear design (vote on the 30Y m1) | 4 red |
| Introduce a bullish arm | 1 red |
| Remove the same-date gate on the curve change | 1 red |

**A pin failed against correct code and the pin was wrong**, recorded rather than quietly fixed:
a fixture named for the live tape set only the 30Y leg and left `mkLive`'s default 10Y in place,
so it computed −0.02 while claiming to reproduce a tape that read −0.04. **Second fixture this
session to silently not reproduce what its name claimed** (the first passed `undefined` into a
defaulted parameter). Both were caught by the pin failing, not by review — the pattern worth
naming is that a fixture built by *overriding some fields of a shared default* will quietly
inherit the rest, and a derived quantity spanning two of those fields is where it shows.

## Still open

- **Kalshi.** Unchanged from v5.10.0: FULL stays unreachable until `KALSHI_KEY_ID` /
  `KALSHI_PRIVATE_KEY` are set. The 7th check does not change that — `ratePathBlind` still
  withholds HIGH, so today reads MEDIUM · RESTRICTED · PARTIAL DATA.
- **`ndxSpxRs` still has no plausibility band** (carried from v5.10.0).
- **The INSUFFICIENT floor stays absolute at 3** while the check count moved to 7. It is a claim
  about how many real observations a published direction needs, and 3 observations is still 3 —
  but it is now 3-of-7 rather than 3-of-6, and the evidence axis (not this floor) is what
  actually gates capital. Named rather than changed.

---

# Addendum — v5.97.1: the unset SEC identity (owner report, same day)

> SEC_USER_AGENT is unset on the Pages deployment … without it /api/ticker-facts returns
> MISSING for netCashB/dilutedSharesB/secFilings on every name — that's why TE's net debt and
> book equity are derived rather than filed-source.

**The report is accurate**, verified against the code path: `secBundle` short-circuits on
`!env.SEC_USER_AGENT` and returns all three fields as MISSING. The CLAUDE.md env matrix entry
is also accurate.

**The config fix is an owner action** — this build environment holds no Cloudflare credentials,
and the available Cloudflare MCP tools cover D1/KV/R2/Workers, not Pages env vars:

```
npx wrangler pages secret put SEC_USER_AGENT
# value: a descriptive application + contact string, e.g. "MacroDash TT <owner-email>"
```

The contact string is not decoration: SEC's fair-access policy requires it, and a generic or
absent UA is what gets an IP throttled or blocked by `data.sec.gov`.

## The code defect the report exposed — ours, and fixed here

`secBundle` was already honest at the FIELD level. It stores two genuinely different causes as
two different strings:

| Cause | Stored reason |
|---|---|
| The system could never look | `SEC_USER_AGENT is not configured` |
| It looked; the company had nothing | `no recent 10-Q/10-K filing returned` |

`qualitativeRubric` read `fields.secFilings.value`, saw `null`, **discarded the stored reason**,
and emitted one company-shaped sentence: *"no primary filing citation is available."* That
sentence flows into the receipt's blockers via
`gate("qualitative", "UNKNOWN", qualitative?.reason)` — so the blocker sent the operator after
the **ticker** (does it file? is the CIK mapping wrong?) when the cause was an unset deployment
secret. Which is exactly the hand-diagnosis the report describes having to do.

This is the v5.6.4 / v3.52 / ENGINE0-CONT rule — *"I could not look" and "there was nothing to
find" are different facts* — broken in the one place in this path with **zero coverage**.

Blast radius checked and bounded: no gate reads `netCashB`/`dilutedSharesB` directly (they only
populate the AI prompt's `evidence.measured`, and the early return fires before the prompt is
built), so the misattribution was confined to the filings → qualitative gate.

## The finding that outranks the fix

The new smoke section was appended **after `process.exit()`** at the end of `smoke.mjs` and
**ran zero assertions while reporting green**. The only tell was the total being identical
before and after (2136 → 2136).

A suite that silently skips a section reads exactly like a suite that passed it — the v3.58 A3
lesson ("a silently-skipped gate reads as a passed one") one altitude down, inside the file
rather than at the runner. Worth remembering that appending to `smoke.mjs` is unsafe by
default; the section has to land above the summary.

## Tests

**2142 smoke · 306 render · 229 public-render**, `audit:prod` clean.

| Negative control | Result |
|---|---|
| Restore the swallow (drop the carried reason) | 2 red |

Pinned: both causes RUN through the real function, the two proven to read differently, an absent
field record naming no cause, the original clause surviving in every branch, the two causes
proven DIFFERENT at source (carrying an ambiguous reason faithfully would propagate ambiguity,
not fact), and the env matrix still naming the variable.

## Still open after this

- **The secret itself.** Until it is set, the three fields stay MISSING — the fix makes the
  cause legible, it does not supply the data. Filed-source net debt and book equity remain
  derived until then.

---

# Addendum 2 — v5.97.2: Kalshi issues PKCS#1, and our parser refused it

The owner sent a real Kalshi-issued private key to finish the v3.99.1 setup, asking for the
conversion steps because "Kalshi doesn't have anything but the thing I sent".

**That question had a better answer than the one asked for.** The key is **PKCS#1**
(`-----BEGIN RSA PRIVATE KEY-----`). WebCrypto has no `"pkcs1"` import format, so the shipped
parser threw, `kalshiHeaders` caught it, and the build fell through to the ANONYMOUS path —
silently. No error, `fed_odds` still null, nothing to diagnose from.

So the setup documentation asserted PKCS#8 while the provider issues PKCS#1: **the one
documented step was wrong about its one input**, and being wrong about it cost a silent failure
rather than a message. That is the same defect shape as the SEC blocker one release earlier —
a claim about the world standing where a claim about our own configuration belonged.

Asking the owner to run `openssl` on a phone would have been solving our bug with their labour.

## The fix

PKCS#8 is PKCS#1 in a wrapper, so no dependency is needed:

```
SEQUENCE { INTEGER 0, AlgorithmIdentifier(rsaEncryption), OCTET STRING <pkcs1 body> }
```

Verified **byte-identical** to `openssl pkcs8 -topk8 -nocrypt` on the real key, and in smoke
against a WebCrypto-exported PKCS#8.

Accepted now: PKCS#1 with header, PKCS#8 with header, and a **headerless paste of either** —
the fallback is structural (try pkcs8, then wrap), not a trust of the header text. Widening the
accepted input did **not** widen the fail-closed guarantee: a malformed key still fails both
paths and returns null to the anonymous fallback, pinned.

## Two of my own test defects, both recorded rather than quietly fixed

**1. A crash, not a failure.** The lifted signer module is loaded with `new Function`, so adding
`export` to the new helper made the whole section throw `SyntaxError` — no total printed, the
v3.99.4 P0 shape. The keyword bought nothing (nothing imports it) and was dropped.

**2. A negative control that did not bite.** The first control disabled only the `looksPkcs1`
branch — and the suite stayed green, because the *structural fallback* still caught the PKCS#1
key. The implementation was more robust than the control's model of it.

That is a subtler trap than a vacuous assertion: the control ran, the code was correct, and the
green result still meant nothing about the pin. Re-run against the TRUE PKCS#8-only original it
turns exactly its own pin red. **A control has to disable the behaviour, not one of the paths
that implements it** — which is only knowable by reading the implementation rather than the
diff.

## Security note

The key arrived in a chat transcript, so it should be treated as compromised and rotated —
independent of this fix. Converted copies and the derived public key were wiped from the
container; the original upload is outside my control. Rotation is cheap here because the key
was never installed anywhere.

## Still open

- **The secrets themselves.** `KALSHI_KEY_ID` was never supplied (only the private key), so
  even with credentials the pair was incomplete. Both still need setting, and the Cloudflare
  dashboard does it from a phone — no laptop required.
- **End-to-end acceptance by Kalshi remains unproven.** The signature is now verified
  cryptographically against a real issued key, but this container cannot reach either Kalshi
  base (`000` on both), so whether their endpoint *accepts* it is still first-call knowledge.
  `?debug=<token>` records `auth: keyed|anonymous`, which separates "the key didn't load" from
  "Kalshi rejected it".

## Tests

**2147 smoke · 306 render · 229 public-render**, `audit:prod` clean.
