# tt-engine

Card ingest, validation, and ranking engine for the TT ↔ TERMINAL workflow —
implements **TT ↔ TERMINAL INTEGRATION SPEC v2.0** (chat produces judgment,
this engine owns math/state/rendering; see `SPEC.md` for the full text).

**Private, by design.** This repo exists specifically so real per-symbol
thesis/composite/target data (`tt_cards/*.json`) can be git-committed — the
opposite of MacroDash's own repo, which is public and must never hold that
kind of data. Keep this repo private.

## Why a separate repo, in Python

MacroDash (this project's sibling) is 100% JS/Cloudflare, and its one
enforced invariant is that real book/thesis/position data must **never**
enter that repo — it lives only in Cloudflare KV, behind a PIN, checked by
an automated smoke test. The v2.0 spec's core mechanic (git-committed
per-symbol cards, full audit trail via commit history) is the *opposite*
design on purpose, and needs a repo where that's the point, not a violation.
There is no Python anywhere in MacroDash and no reason to bolt one on.

## Provenance note: R-P1 / R-P3 / R6-C4 / R3A

The spec references four rulings by name that don't exist in MacroDash
(which uses its own R1–R5 / DEC-## / FEAT-## vocabulary) and weren't
retrievable from the referenced source in this build environment. Every
config constant affected by that is documented in `tt/config.py` with
exactly one of two tags:

- **`[SPEC]`** — the spec gives the value or rule directly; no ruling text
  needed (e.g. `OVERRIDE_MAX_DAYS = 183`, R6-C4's own stated effect).
- **`[MACRODASH]`** — grounded in the real ruling document that already
  exists in the MacroDash repo (`ticker-terminal/TT_TICKER_TERMINAL.md`'s
  R1–R5 and 5-pillar composite weights), the only actual ruling text
  available.
- **`[ASSUMPTION]`** — where neither applies (R3A's actual weights, R-P1's
  NAV-vs-tracked-book call), a documented, defensible default is used
  instead of a fabricated number, isolated to `tt/config.py` so replacing it
  later touches one file.

## Layout

```
tt/
  config.py     section 1 — constants (see provenance note above)
  models.py     section 2 — the Card schema (Pydantic v2), structural typing only
  validate.py   section 3 — date-relative/cross-field rules, reject/warn, diff formatting
  derive.py     section 4 — ALL terminal-computed values (gate/entry/fit mult, tier,
                staleness, return math, quote freshness) — chat must never emit any of this
  holdings.py   measured position data (gitignored; holdings.example.json is the template)
  roster.py     owner-asserted book-tier roster (gitignored; roster.example.json)
  quotes.py     manual quote fallback per OPEN-4 (gitignored; quotes.example.json)
  bucket.py     section 5 — eligibility + the 9-rung precedence, one function
  rank.py       section 6 — RANK_fair / RANK_constrained, dense-ranked boards; also the
                `python -m tt.rank` CLI entry point
  ingest.py     section 8 — inbox/ -> validate -> tt_cards/*.json (git-committed) or back
                to inbox/ with a diff; also the `python -m tt.ingest` CLI entry point
  render.py     section 7 — every panel (valuation gap, funding priority, delta signal,
                near-term, status bar, overrides, binary calendar) as pure functions
  readout.py    fetches MacroDash's public /readout.json for the section 7.5 status bar
  macrodash_client.py   fetches MacroDash's PIN-gated /api/tt (book), /api/positions
                (measured holdings) and /api/quotes (live prices) — real KV data,
                replacing/supplementing the local .json files where it's available
  queue.py      section 8.6 — run_queue.md emitter

tests/          184 tests: one group per formula (derive), one per precedence
                rung (bucket), end-to-end fixture-file tests (test_end_to_end.py),
                mocked-HTTP tests for the MacroDash client (never a real network
                call against the live PIN-gated endpoint — see below)
tests/fixtures/ SYNTHETIC cards only (ZZZQ is not a real ticker) — same invariant
                MacroDash holds for its own test fixtures

tt_cards/       real cards land here via ingest, one file per symbol, git-committed
inbox/          pasted-but-unvalidated JSON; gitignored, working state only
holdings.json, roster.json, quotes.json   LOCAL fallback data; gitignored —
                .example.json versions show the shape. Only used for symbols the
                live MacroDash sync (below) doesn't cover, once TT_PIN is set.
```

## Commands

```bash
pip install -e ".[dev]"
pytest                              # 184 tests

python -m tt.ingest                 # process inbox/*.json
python -m tt.ingest --paste         # read one card from stdin
echo '{...card json...}' | python -m tt.ingest --paste

python -m tt.rank                   # recompute + render section 7, write run_queue.md
python -m tt.rank --no-network      # skip ALL network calls (readout + live sync)
python -m tt.rank --no-live         # skip only the book/positions/quotes sync
```

## Live MacroDash integration (KV + secrets)

`python -m tt.rank` pulls real data straight from MacroDash's KV store instead
of requiring you to hand-maintain a second copy in `roster.json`/
`holdings.json`/`quotes.json`:

| Local fallback | Live source (when `TT_PIN` is set) |
|---|---|
| `roster.json` (book tier) | `GET /api/tt` — the real book, tier per symbol |
| `holdings.json` (measured positions) | `GET /api/positions` — the real `tt:pos:v1` |
| `quotes.json` (manual quotes) | `GET /api/quotes` — live Finnhub quotes MacroDash already fetches |

This is exactly the integration path MacroDash's own `CLAUDE.md` describes:
the `x-tt-pin` header is called out there as *"the automation path that
unlocks future chat-side sync"* — `tt/macrodash_client.py` is that sync, not
a workaround.

**Setup — once:**
```bash
export TT_PIN=<your 6-digit TT_PIN>   # NEVER as a CLI flag, NEVER pasted into chat
```
That's it. `python -m tt.rank` auto-detects `TT_PIN` and pulls live automatically;
without it, behavior is unchanged (local files only, exactly as before this
feature existed). `--no-live` forces local-only even with `TT_PIN` set.

**Unit conversion, the one place this is easy to get quietly wrong:**
MacroDash's `pos.pct` is a **percent** (`0..100`, confirmed against
`functions/api/tt.js`'s `validatePos`). tt-engine's `HoldingRecord.pct` is a
**fraction** (`0..1`, `tt/config.py`'s `WEIGHT_DENOMINATOR`). `macrodash_client.py`
divides by 100 at that one boundary — `tests/test_macrodash_client.py` pins
this exactly against the spec's own NBIS anchor (31.2% → 0.312).

**Never guess the PIN.** MacroDash's PIN auth has an escalating lockout (5
wrong attempts → 15 min, 10 → 24h) — the same wall a real login attacker
would hit. `macrodash_client.py` raises immediately on a 401/403 and never
retries with a different value; a network failure (MacroDash briefly down)
degrades gracefully to local files with a warning instead of crashing the
run. Every test in `test_macrodash_client.py` mocks the HTTP layer — none of
them, or anything else in this test suite, ever sends a real request to the
live endpoint.

**Book-tier mapping:** MacroDash's book tier is `S/A/B/DEF/WATCH` (roster
membership + status), a different axis from tt-engine's `S/A/B/C` quality
grade (spec section 4.4, compared against the composite-derived tier via
`tier_mismatch()`). `S/A/B` map straight across; `DEF` (deferred/tactical)
maps to `C` as the closest "deprioritized" reading; `WATCH` (not held) is
excluded entirely rather than assigned a quality grade nobody gave it.

## What's NOT built (deliberately deferred, matching the spec's own scope)

- **Real card backfill (build order step 6, "~40 session cards"):** not
  attempted here — that's real trading thesis data only the owner can
  supply, paste-ingested one card at a time same as any future card.
- **OPEN-5 (dividend display column):** spec marks this deferred; not built.
- **The market-open/closed check for live quotes** (`macrodash_client.is_market_open_et`)
  is a deliberate weekday+hours approximation, not MacroDash's real
  market-holiday calendar (`src/sources.js`, JS-only) — porting that
  calendar here would duplicate its own annual-maintenance burden for a few
  days a year. It fails toward stricter (a holiday reads as "open" and
  demands a fresher quote than a holiday would produce), never looser.
