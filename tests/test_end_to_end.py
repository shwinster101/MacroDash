"""Ingests the three SYNTHETIC fixture files (tests/fixtures/) through the
REAL file-based pipeline -- ingest -> tt_cards/*.json -> load -> rank ->
render -- proving the whole system works together on disk, not just on
in-memory payloads built by conftest.card_payload()."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from tt.holdings import Holdings, HoldingRecord
from tt.ingest import ingest_batch
from tt.models import Card
from tt.queue import run_queue_entries
from tt.rank import QuoteMeta, near_term_board, rank_all, ranked_board_fair
from tt.render import ReadoutStatus, render_report

FIXTURES = Path(__file__).resolve().parent / "fixtures"
TODAY = date(2026, 8, 2)


def _stage_inbox(tmp_path: Path) -> Path:
    """Fixture files are named zzzq_*.json, distinct from the collision the
    spec means by "same symbol" -- all three share symbol ZZZQ, so staging
    all three at once deliberately exercises the DEEP>RE>SCREEN precedence
    (zzzq_ranked.json is DEEP, zzzq_near_term.json is RE, zzzq_override.json
    is also DEEP with a later mtime -- see test below for which wins)."""
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    for f in FIXTURES.glob("zzzq_*.json"):
        (inbox / f.name).write_text(f.read_text())
    return inbox


def test_single_fixture_ingests_and_ranks_end_to_end(tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    payload = json.loads((FIXTURES / "zzzq_ranked.json").read_text())
    (inbox / "a.json").write_text(json.dumps(payload))
    cards_dir = tmp_path / "tt_cards"

    outcome = ingest_batch(inbox, cards_dir, today=TODAY)
    assert outcome.ok and len(outcome.accepted) == 1

    written = json.loads((cards_dir / "ZZZQ.json").read_text())
    card = Card.model_validate(written)
    assert card.symbol == "ZZZQ"

    entries = rank_all(
        {"ZZZQ": card}, TODAY,
        {"ZZZQ": QuoteMeta(live_price=100.0, market_open=True, age_min=5, is_latest_close=False)},
        Holdings(None, {}), {},
    )
    rc = entries[0]
    assert rc.bucket == "RANKED"
    assert rc.rank_fair is not None and rc.rank_fair > 0  # target 180 > price 100

    board = ranked_board_fair(entries)
    assert board[0][1].symbol == "ZZZQ"

    status = ReadoutStatus(fresh=True, regime="NEUTRAL", macro_flip_evaluable=True, macro_flip_tripped=False)
    report = render_report(entries, Holdings(None, {}), TODAY, status)
    assert "ZZZQ" in report and "VALUATION GAP" in report


def test_near_term_fixture_lands_in_near_term_not_ranked(tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    payload = json.loads((FIXTURES / "zzzq_near_term.json").read_text())
    (inbox / "a.json").write_text(json.dumps(payload))
    cards_dir = tmp_path / "tt_cards"
    ingest_batch(inbox, cards_dir, today=TODAY)

    card = Card.model_validate(json.loads((cards_dir / "ZZZQ.json").read_text()))
    entries = rank_all(
        {"ZZZQ": card}, TODAY,
        {"ZZZQ": QuoteMeta(live_price=100.0, market_open=True, age_min=5, is_latest_close=False)},
        Holdings(None, {}), {},
    )
    assert entries[0].bucket == "NEAR_TERM"
    assert ranked_board_fair(entries) == []
    assert near_term_board(entries)[0][1].symbol == "ZZZQ"
    assert entries[0].annualised is False  # absolute return, per section 4.6's near-term branch


def test_override_fixture_is_eligible_only_because_override_is_live(tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    payload = json.loads((FIXTURES / "zzzq_override.json").read_text())
    (inbox / "a.json").write_text(json.dumps(payload))
    cards_dir = tmp_path / "tt_cards"
    ingest_batch(inbox, cards_dir, today=TODAY)

    card = Card.model_validate(json.loads((cards_dir / "ZZZQ.json").read_text()))
    assert card.override is not None and card.override.expiry_date == date(2026, 10, 31)

    entries = rank_all(
        {"ZZZQ": card}, TODAY,
        {"ZZZQ": QuoteMeta(live_price=100.0, market_open=True, age_min=5, is_latest_close=False)},
        Holdings(None, {}), {},
    )
    rc = entries[0]
    assert rc.bucket == "RANKED"  # would be PENDING/no_override without the live override
    assert rc.gate.gate_mult == 0.60 and rc.gate.eligible is True


def test_all_three_fixtures_collide_on_symbol_and_deep_precedence_wins(tmp_path):
    # zzzq_ranked.json and zzzq_override.json are both DEEP, same run_date;
    # zzzq_near_term.json is RE. DEEP beats RE outright; between the two
    # DEEPs, last-write-wins on mtime -- this test only asserts the WINNING
    # card is one of the two DEEP cards, never the RE one, which is the part
    # the collision rule actually guarantees deterministically.
    inbox = _stage_inbox(tmp_path)
    cards_dir = tmp_path / "tt_cards"
    outcome = ingest_batch(inbox, cards_dir, today=TODAY)

    assert len(outcome.accepted) == 1
    assert "DEEP" in outcome.accepted[0]
    assert len(outcome.superseded) == 2
    assert all("RE" in s or "DEEP" in s for s in outcome.superseded)
    # exactly one RE among the superseded, the rest DEEP-vs-DEEP
    assert sum("RE " in s for s in outcome.superseded) == 1


def test_run_queue_is_empty_for_a_freshly_ingested_healthy_card(tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    payload = json.loads((FIXTURES / "zzzq_ranked.json").read_text())
    (inbox / "a.json").write_text(json.dumps(payload))
    cards_dir = tmp_path / "tt_cards"
    ingest_batch(inbox, cards_dir, today=TODAY)

    card = Card.model_validate(json.loads((cards_dir / "ZZZQ.json").read_text()))
    entries = rank_all(
        {"ZZZQ": card}, TODAY,
        {"ZZZQ": QuoteMeta(live_price=100.0, market_open=True, age_min=5, is_latest_close=False)},
        Holdings(None, {}), {},
    )
    assert run_queue_entries(entries, TODAY) == []
