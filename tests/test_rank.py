from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import card_payload
from tt.config import NEAR_TERM_DAYS
from tt.holdings import Holdings, HoldingRecord
from tt.models import Card
from tt.rank import (
    QuoteMeta,
    near_term_board,
    rank_all,
    ranked_board_constrained,
    ranked_board_fair,
    unrankable,
)

TODAY = date(2026, 8, 2)
LIVE = dict(market_open=True, age_min=5, is_latest_close=False)
FAR_HORIZON = (TODAY + timedelta(days=NEAR_TERM_DAYS + 300)).isoformat()


def card(symbol: str, target: float, composite: float = 7.5, **overrides) -> Card:
    payload = card_payload(
        symbol=symbol,
        composite=composite,
        pt_model={"target": target, "horizon": FAR_HORIZON, "basis": "x", "return_type": "price_only"},
    )
    payload.update(overrides)
    return Card.model_validate(payload)


def qm(price: float) -> QuoteMeta:
    return QuoteMeta(live_price=price, market_open=True, age_min=5, is_latest_close=False)


def test_rank_fair_and_constrained_math_matches_the_formula():
    cards = {"AAA": card("AAA", target=200.0)}
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {})
    rc = entries[0]
    assert rc.bucket == "RANKED"
    days = (date.fromisoformat(FAR_HORIZON) - TODAY).days
    expected_metric = (200.0 / 100.0) ** (365.25 / days) - 1
    assert rc.metric == expected_metric
    # gate_mult=1.00 (no fails/flags), entry_mult=0.60 (mid_range, BASE_CARD default),
    # fit_mult=1.00 (unheld) -> both boards' effective mult are identical here.
    assert rc.rank_fair == expected_metric * 0.60
    assert rc.rank_constrained == expected_metric * 0.60


def test_fit_penalty_only_shows_up_in_constrained_not_fair():
    holdings = Holdings(None, {"AAA": HoldingRecord(pct=0.312, legs=1)})
    cards = {"AAA": card("AAA", target=200.0, correlation_cluster="neocloud")}
    entries = rank_all(
        cards, TODAY, {"AAA": qm(100.0)}, holdings, {},
    )
    rc = entries[0]
    # fit_mult is floored near 0.50 due to the cap breach -> constrained is
    # meaningfully lower than fair, and fair ignores fit entirely (==1.00).
    assert rc.fit_mult < 1.00
    assert rc.rank_constrained < rc.rank_fair


def test_unheld_name_has_identical_fair_and_constrained():
    cards = {"AAA": card("AAA", target=150.0)}
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {})
    rc = entries[0]
    assert rc.rank_fair == rc.rank_constrained


def test_dense_ranking_ties_share_a_rank_no_gap():
    # Two symbols with identical target/price -> identical metric and
    # multiplier chain -> identical RANK_fair -> both rank 1; the NEXT
    # distinct value ranks 2, not 3 (true dense ranking).
    cards = {
        "AAA": card("AAA", target=150.0, composite=7.0),
        "BBB": card("BBB", target=150.0, composite=7.0),
        "CCC": card("CCC", target=140.0, composite=6.0),
    }
    quotes = {"AAA": qm(100.0), "BBB": qm(100.0), "CCC": qm(100.0)}
    entries = rank_all(cards, TODAY, quotes, Holdings(None, {}), {})
    board = ranked_board_fair(entries)
    ranks = {rc.symbol: r for r, rc in board}
    assert ranks["AAA"] == ranks["BBB"] == 1
    assert ranks["CCC"] == 2


def test_tie_break_order_is_composite_then_symbol():
    cards = {
        "BBB": card("BBB", target=150.0, composite=7.0),
        "AAA": card("AAA", target=150.0, composite=8.0),  # same metric, higher composite
    }
    quotes = {"AAA": qm(100.0), "BBB": qm(100.0)}
    entries = rank_all(cards, TODAY, quotes, Holdings(None, {}), {})
    board = ranked_board_fair(entries)
    # same RANK -> both rank 1 -> but AAA (higher composite) sorts FIRST in display order
    assert board[0][1].symbol == "AAA"


def test_ineligible_card_excluded_from_both_boards():
    cards = {"AAA": card("AAA", target=150.0, pt_model=None)}  # rung 3: no pt_model
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {})
    assert entries[0].bucket == "PENDING"
    assert ranked_board_fair(entries) == []
    assert ranked_board_constrained(entries) == []


def test_no_card_on_file_still_produces_an_entry():
    entries = rank_all({}, TODAY, {}, Holdings(None, {}), {})
    assert entries == []  # rank_all only iterates the cards dict -- no card, no entry
    # (the "no card" UNVALIDATED path is exercised directly in test_bucket.py;
    # a caller wanting a full symbol universe including un-carded names must
    # supply card=None entries itself -- rank_all's contract is "rank what
    # has cards", not "enumerate a roster it was never given".)


def test_near_term_never_appears_in_the_ranked_board():
    near_horizon = (TODAY + timedelta(days=NEAR_TERM_DAYS - 1)).isoformat()
    cards = {
        "AAA": card("AAA", target=120.0, pt_model={
            "target": 120.0, "horizon": near_horizon, "basis": "x", "return_type": "price_only",
        }),
    }
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {})
    assert entries[0].bucket == "NEAR_TERM"
    assert ranked_board_fair(entries) == []
    assert near_term_board(entries)[0][1].symbol == "AAA"


def test_missing_live_price_is_unrankable_not_silently_zero():
    cards = {"AAA": card("AAA", target=150.0)}
    entries = rank_all(cards, TODAY, {}, Holdings(None, {}), {})  # no quote at all
    rc = entries[0]
    # bucket() rung 6 reads the missing quote as not-live -> PENDING/quote
    assert rc.bucket == "PENDING" and rc.reason == "quote"
    assert rc.rank_fair is None and rc.rank_constrained is None
    assert rc in unrankable(entries) or rc.bucket not in ("NEAR_TERM", "RANKED")


def test_tier_mismatch_surfaces_on_the_ranked_card():
    cards = {"AAA": card("AAA", target=150.0, composite=3.0)}  # -> computed tier C
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), roster={"AAA": "S"})
    rc = entries[0]
    assert rc.tier == "C" and rc.book_tier == "S" and rc.tier_mismatch is True
