from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import card_payload
from tt.config import CARD_TTL_DAYS
from tt.holdings import Holdings
from tt.models import Card
from tt.queue import render_run_queue_md, run_queue_entries
from tt.rank import QuoteMeta, rank_all

TODAY = date(2026, 8, 2)


def qm(price=100.0):
    return QuoteMeta(live_price=price, market_open=True, age_min=5, is_latest_close=False)


def test_never_run_symbol_has_no_card_entry_at_all():
    # rank_all only iterates a cards dict, so a truly "never run" symbol has
    # no entry to bucket in the first place -- this is exercised at the
    # bucket() level (test_bucket.py's rung2a); run_queue_entries only sees
    # symbols that already have a RankedCard. This test documents that a
    # caller wanting "never run" names must union its OWN roster with what
    # rank_all returns, which run_queue_entries does not attempt to invent.
    entries = rank_all({}, TODAY, {}, Holdings(None, {}), {})
    assert run_queue_entries(entries, TODAY) == []


def test_stale_ttl_card_lands_in_queue_with_reason():
    payload = card_payload(run_date=(TODAY - timedelta(days=CARD_TTL_DAYS + 5)).isoformat())
    cards = {"XYZ": Card.model_validate(payload)}
    entries = rank_all(cards, TODAY, {"XYZ": qm()}, Holdings(None, {}), {})
    q = run_queue_entries(entries, TODAY)
    assert len(q) == 1 and q[0].symbol == "XYZ"
    assert "TTL exceeded" in q[0].reason


def test_red_hinge_card_lands_in_queue_with_reason():
    payload = card_payload(hinges=[{"id": "supply-chain", "state": "red", "test": "broke"}])
    cards = {"XYZ": Card.model_validate(payload)}
    entries = rank_all(cards, TODAY, {"XYZ": qm()}, Holdings(None, {}), {})
    q = run_queue_entries(entries, TODAY)
    assert len(q) == 1
    assert "red hinge" in q[0].reason and "supply-chain" in q[0].reason


def test_healthy_card_not_in_queue():
    cards = {"XYZ": Card.model_validate(card_payload())}
    entries = rank_all(cards, TODAY, {"XYZ": qm()}, Holdings(None, {}), {})
    assert run_queue_entries(entries, TODAY) == []


def test_queue_sorted_alphabetically():
    stale_run_date = (TODAY - timedelta(days=CARD_TTL_DAYS + 5)).isoformat()
    cards = {
        "ZZZ": Card.model_validate(card_payload(symbol="ZZZ", run_date=stale_run_date)),
        "AAA": Card.model_validate(card_payload(symbol="AAA", run_date=stale_run_date)),
    }
    entries = rank_all(cards, TODAY, {"ZZZ": qm(), "AAA": qm()}, Holdings(None, {}), {})
    q = run_queue_entries(entries, TODAY)
    assert [e.symbol for e in q] == ["AAA", "ZZZ"]


def test_render_empty_queue_says_nothing_pending():
    text = render_run_queue_md([], TODAY)
    assert "Nothing pending" in text


def test_render_nonempty_queue_lists_each_symbol_and_reason():
    from tt.queue import QueueEntry

    text = render_run_queue_md([QueueEntry("AAA", "never run")], TODAY)
    assert "AAA" in text and "never run" in text
    assert "first paste of the next chat session" in text or "chat session" in text
