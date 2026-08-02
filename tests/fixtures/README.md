# Fixtures

Every card here is **SYNTHETIC** — same invariant MacroDash (this project's
sibling repo) holds for its own SEED/BOARD test fixtures. `ZZZQ` is not a
real, tradeable ticker. Nothing in this directory is investment analysis;
it exists only to exercise the pipeline end-to-end.

- `zzzq_ranked.json` — a healthy card that lands in the RANKED bucket.
- `zzzq_near_term.json` — same shape, horizon inside `NEAR_TERM_DAYS`.
- `zzzq_override.json` — one gate FAIL, carried by a live override.
