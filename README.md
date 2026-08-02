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
  queue.py      section 8.6 — run_queue.md emitter

tests/          157 tests: one group per formula (derive), one per precedence
                rung (bucket), end-to-end fixture-file tests (test_end_to_end.py)
tests/fixtures/ SYNTHETIC cards only (ZZZQ is not a real ticker) — same invariant
                MacroDash holds for its own test fixtures

tt_cards/       real cards land here via ingest, one file per symbol, git-committed
inbox/          pasted-but-unvalidated JSON; gitignored, working state only
holdings.json, roster.json, quotes.json   real data; gitignored — .example.json
                versions show the shape
```

## Commands

```bash
pip install -e ".[dev]"
pytest                              # 157 tests

python -m tt.ingest                 # process inbox/*.json
python -m tt.ingest --paste         # read one card from stdin
echo '{...card json...}' | python -m tt.ingest --paste

python -m tt.rank                   # recompute + render section 7, write run_queue.md
python -m tt.rank --no-network      # skip the /readout.json fetch (offline/testing)
```

## What's NOT built (deliberately deferred, matching the spec's own scope)

- **OPEN-4 (broker MCP access):** no live broker connection. Quotes and
  positions are hand-maintained JSON (`quotes.json`, `holdings.json`) until
  a real sync exists — the spec's own stated fallback.
- **Real card backfill (build order step 6, "~40 session cards"):** not
  attempted here — that's real trading thesis data only the owner can
  supply, paste-ingested one card at a time same as any future card.
- **OPEN-5 (dividend display column):** spec marks this deferred; not built.
