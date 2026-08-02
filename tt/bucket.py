"""
tt.bucket -- section 5, eligibility & bucketing. "Implement as one tested
function, one unit test per rung" -- the spec's own instruction, followed
literally: `bucket()` below is that one function, and tests/test_bucket.py
has one test (or a tight cluster) per numbered rung.

Deliberately does NOT need a live price: every rung 1-9 can be decided from
the card's own fields, staleness, gate/override state, and quote FRESHNESS
metadata (market_open/age_min/is_latest_close) -- never the price value
itself. The price only matters once a card is in NEAR_TERM/RANKED and
tt.rank needs an actual return number (tt.derive.return_metric)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from tt.config import BINARY_BLOCK_DAYS, NEAR_TERM_DAYS
from tt.derive import GateResult, gate_multiplier, is_stale, quote_is_live
from tt.models import Card

Bucket = str  # "UNVALIDATED" | "PENDING" | "BINARY" | "NEAR_TERM" | "RANKED"


@dataclass(frozen=True)
class BucketResult:
    bucket: Bucket
    reason: str | None  # "gate" | "no_target" | "horizon" | "no_override" | "quote" | None
    eligible: bool  # section 5's boolean -- True only for NEAR_TERM / RANKED
    gate: GateResult | None
    days_to_horizon: int | None
    quote_live: bool | None


def bucket(
    card: Card | None,
    today: date,
    *,
    market_open: bool,
    age_min: float | None,
    is_latest_close: bool,
) -> BucketResult:
    # rung 2 (part 1): no card on file at all.
    if card is None:
        return BucketResult("UNVALIDATED", None, False, None, None, None)

    gate = gate_multiplier(card, today)

    # rung 1: hard_stop FAIL / >=2 FAIL / broken_thesis (broken_thesis IS a
    # hard_stop FAIL per section 4.1 -- no separate check needed).
    if gate.gate_mult == 0.30:
        return BucketResult("PENDING", "gate", False, gate, None, None)

    # rung 2 (part 2): stale (TTL, lapsed earnings, or a red hinge).
    if is_stale(card, today):
        return BucketResult("UNVALIDATED", None, False, gate, None, None)

    # rung 3: no pt_model at all.
    if card.pt_model is None:
        return BucketResult("PENDING", "no_target", gate.eligible, gate, None, None)

    days_to_horizon = (card.pt_model.horizon - today).days

    # rung 4: horizon already lapsed.
    if days_to_horizon <= 0:
        return BucketResult("PENDING", "horizon", False, gate, days_to_horizon, None)

    # rung 5: exactly one ordinary FAIL, no valid override (gate_mult==0.60
    # covers BOTH the valid-override and no-override cases; eligible
    # disambiguates them -- rung 1 already took the tagged/hard_stop/>=2
    # FAIL branches, so reaching here with gate_mult==0.60 and
    # eligible==False can only be "1 FAIL, no valid override").
    if gate.gate_mult == 0.60 and not gate.eligible:
        return BucketResult("PENDING", "no_override", False, gate, days_to_horizon, None)

    # rung 6: quote not live.
    live = quote_is_live(market_open, age_min, is_latest_close)
    if not live:
        return BucketResult("PENDING", "quote", False, gate, days_to_horizon, live)

    # rung 7: a binary event sits inside the no-adds window -- frozen out of
    # BOTH ranked boards regardless of how attractive the math looks.
    if card.next_binary is not None and (card.next_binary - today).days <= BINARY_BLOCK_DAYS:
        return BucketResult("BINARY", None, False, gate, days_to_horizon, live)

    # rung 8 / 9: the two ELIGIBLE buckets.
    if days_to_horizon <= NEAR_TERM_DAYS:
        return BucketResult("NEAR_TERM", None, True, gate, days_to_horizon, live)
    return BucketResult("RANKED", None, True, gate, days_to_horizon, live)
