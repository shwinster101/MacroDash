# 2026-09-15 — Robinhood position + account sync, and the receipt it unblocked

**Scope note, load-bearing:** this repository is PUBLIC and the invariant is unchanged —
*real position, account and book content has no home here.* Every measured figure this pass
produced (share counts, market values, cost bases, per-name weights, NAV, margin debt,
leverage) lives **only** in KV (`tt:pos:v1`) and in the chat reply to the owner. What follows
is the **procedure and the findings**, deliberately without the numbers. A working note that
reproduced them would be the leak the whole KV-only rule exists to prevent.

Runbook followed: CLAUDE.md → **THE ROBINHOOD SYNC RUNBOOK** (FEAT-TT-ALLOC, v3.100).

---

## 1. What ran

Chat-side MCP pull → merge-only `PUT /api/positions` with the `x-tt-pin` header. The server
never talked to the broker; no broker credential went near Cloudflare; **no order call of any
kind was made** (the repo pins `place_equity_order`/`place_option_order` absent, and that pin
is the contract, not a courtesy).

Tools used, in order: `get_accounts` · `get_portfolio` · `get_equity_positions` ·
`get_equity_quotes` · `get_option_positions` · `get_option_instruments` · `get_option_quotes` ·
`get_equity_tax_lots`.

Written: the position map (equity rows with lots; options-only names carrying legs alone),
three explicit removals (`{sym: null}`), and the measured `account` sibling. Server accepted
the whole body on the first attempt — the local pre-validation below is why.

---

## 2. The near-miss that matters most: the WRONG ACCOUNT was the easy answer

`get_accounts` returns several accounts. Exactly one has **`agentic_allowed: true`**, and it
is **NOT** the account the book describes — it is a small, separate account whose entire value
is a rounding error against the tradable one.

Syncing it would have succeeded silently and **corrupted every weight and cap check in the
system**, because `pct` is `mv / account.equity × 100` and the denominator would have been off
by two orders of magnitude. Every `pct` would have pinned at the validator's 100 ceiling or
been rejected out of band; the cap asterisks would have been meaningless; the funding ranking's
size tie-break would have been noise.

**What caught it:** the stored record's own `acct` MASK. The runbook requires a last-4 mask,
and the mask on the existing `tt:pos:v1.account` named a different account than the
agentic-permitted one. Comparing the mask against both portfolios before writing is the check.

> **Standing rule, now recorded rather than remembered:** `agentic_allowed` is a BROKER
> PERMISSION FLAG, not an identity claim about which account the book tracks. The sync target
> is the account whose mask the store already carries. The runbook's *"SCOPE: the ONE tradable
> account only"* is an owner ruling about WHICH account; the flag does not decide it.

Consequence of the ruling, restated so nobody "fixes" it later: a book name held only in an
unsynced account reads **"new — not held"** on the board. That means *not held in the synced
account*. It is known, accepted, and cheaper than a wrong denominator.

---

## 3. The MCP server disconnected mid-sync, and the right answer was to refuse to write

The Robinhood MCP server dropped after equity positions, option positions, equity quotes and
roughly half the option marks had been retrieved.

**A partial write was available and was refused.** The reasoning, which generalises:

- A **stale** store degrades honestly — `POS_STALE_D` turns it into a WAIT with a named
  context blocker, and the receipt says exactly how old it is.
- A **partial** store does not. It writes a fresh `at` stamp over an incomplete picture, so
  every downstream consumer reads it as complete and current. The blocker never fires.

*Stale-and-known* beats *partial-and-fresh*, every time. Same family as `optSleeve()` failing
closed when any leg lacks `mv`, and as the v5.6.4 rule that "not read is not not-there".

Mitigation applied so the decision was cheap: **everything retrieved was persisted to the
scratchpad as it arrived**, so the reconnect resumed instead of restarting. The server came
back, tools were re-loaded, and the remaining marks, all option instruments and the tax-lot
sets were pulled before anything was written.

---

## 4. Fail-closed states met, named rather than smoothed

- **A delisted name's tax lots are unavailable** (`instrument not found for symbol`). Treated
  as a real broker-data state: the position row was written with what the broker does report
  and **no `lots` array at all** — never an invented lot, never a zero-filled one. The
  validator's own comment sanctions this ("partial lot coverage is a real broker-data state
  and rejecting it would discard the lots that WERE measured").
- **Options-only names carry no `sh`/`mv`/`pct`.** `mv` is equity-only by contract; a 0 there
  would read as "not held" rather than "held in options". Absent is the honest value.
- **Short legs carry NEGATIVE `mv`.** The sign is load-bearing — a short leg is a liability
  you buy back, not funding you can draw on. Verified per leg before sending.

## 5. ET stamping — the FIX-A class, guarded not rediscovered

Every `at` written this pass is an **ET wall-clock stamp**, never `toISOString()`. The runbook
records this as the fifth recurrence of one defect class (v3.11 run stamps → v3.35 render
fixtures → v3.80 a test's own fixture → v4.1.1 `ageDays` itself). A UTC stamp written after
~20:00 ET dates the payload tomorrow, and every ET-calendar time-judge then rejects the
freshest data in the store as future-dated.

## 6. Local pre-validation before the PUT

The body was validated **locally against a transcription of `validatePos`/`validateAccount`**
(bands, the ISO shapes, the option-leg sign rule, the lot contract, the 16-char `acct` cap)
before a single byte went over the wire. It came back clean and the server agreed.

Worth keeping as a habit for merge-only writes specifically: a merge PUT that is rejected
mid-way leaves the operator guessing which half landed, and the cheapest way to never find out
is to not send an invalid body.

---

## 7. Outcome: the receipt

`GET /api/allocation` returns the **stored** receipt and does not re-evaluate — so immediately
after the sync it still read the pre-sync snapshot, with both staleness blockers standing. That
is correct behaviour and not a bug (GET must stay safe, v3.54: no write-on-read), but it is a
foot-gun for exactly this workflow, where "re-read the receipt" naturally means "tell me what
it says NOW". **A bare `POST /api/allocation` is the re-evaluation** — the same path the
terminal's ⟳ DATA+RANKS drives.

After re-evaluation:

- Both context blockers — the positions snapshot and the account record, each long past
  `POS_STALE_D` — **cleared**.
- State moved **`BUY_ELIGIBLE` → `ALLOCATABLE`** (context complete; per the receipt's own
  `meaning`, still *not* a cash-availability or sizing approval).
- The macro gate reads **SEND IT**; the frozen public 10am call is unchanged beside it (two
  engines, married never merged).
- Cap asterisks moved, in both directions, because the denominator went from a tracked-book
  FLOOR to measured account equity. The v5.2.0 ruling holds: they are flags, never vetoes.
- Tax lots became a DERIVED ST/LT split at evaluation time, as designed — never stored, never
  advice.

---

## 8. Findings filed, NOT fixed this pass

1. **`board.account` is a stale "cannot measure" claim.** The ASSERTED leverage record still
   carries a `formula` string saying the portfolio call was *denied* by the broker MCP — a
   claim stamped in late July and now weeks old, while the measurement has plainly been
   available (this sync made it twice). That is the label-outlives-its-data defect this
   changelog keeps closing, sitting **inside stored data** rather than in code. Its
   `untracked` list is stale for the same reason: at least one entry describes an equity
   position that no longer exists in that form.
   *Not fixed here on purpose:* `board.account` is the OWNER's asserted record (that is
   precisely why `formula` is required of it), and the measured facts have their own correct
   home in `tt:pos:v1.account`. Rewriting an asserted record from an assistant pull would
   collapse the married-never-merged distinction the two records exist to keep.
2. **The circuit's measured basis has moved against the standing assertion.** The asserted
   circuit was re-stamped two days ago at a stated leverage figure; today's measured pull is
   **worse on both metrics** (gross leverage and debt as a share of NAV), with NAV down again.
   The STATE is an owner call under the standing 2026-08-18 ruling (TRIPPED requires a margin
   call or forced liquidation), so the state was **not** changed. The figures are in the chat
   reply and in KV; the owner's re-assert window is the 7-day one the record itself names,
   after which `circuitState()` reverts it to UNRESOLVED and suspends adds.
3. **Open from 9/12, still unresolved:** the CRDO customer-concentration discrepancy (the
   10-Q XBRL tag vs the figure the stored hinge records from the call relay). If the filed
   figure is the right one, a pre-committed falsifier's RED clause was met rather than its
   AMBER clause. Filed, not re-graded — re-grading on a second-hand number is exactly what
   §6.4.1 exists to prevent. Needs the primary filing text, which this build environment's
   proxy blocks.

---

## Outcomes

- Sync written and accepted; receipt re-evaluated; both staleness blockers cleared and the
  state advanced to ALLOCATABLE. No intent was confirmed and no order was placed.
- Corrections to earlier assumptions this pass, kept beside the original rather than edited
  away: (a) I expected `GET /api/allocation` to re-evaluate — it does not, it serves the
  stored receipt, and the POST is the re-eval; (b) I expected `agentic_allowed` to identify
  the book's account — it identifies a different one, and the stored mask is the only reliable
  discriminator.
