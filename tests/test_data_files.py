"""The committed .example.json templates must actually load through the real
loaders -- a broken example file is a broken first-run experience, and this
would have silently regressed once (an earlier draft's "_readme" key inside
roster.json's flat symbol->tier structure crashed load_roster)."""

from __future__ import annotations

from pathlib import Path

from tt.holdings import Holdings
from tt.quotes import load_quotes
from tt.roster import load_roster

ROOT = Path(__file__).resolve().parent.parent


def test_holdings_example_loads():
    h = Holdings.load(ROOT / "holdings.example.json")
    assert h.weight("EXAMPLE") == 0.05


def test_roster_example_loads():
    r = load_roster(ROOT / "roster.example.json")
    assert r == {"EXAMPLE": "S"}


def test_quotes_example_loads():
    q = load_quotes(ROOT / "quotes.example.json")
    assert q["EXAMPLE"].live_price == 100.0


def test_underscore_prefixed_keys_are_skipped_everywhere(tmp_path):
    import json

    roster_path = tmp_path / "roster.json"
    roster_path.write_text(json.dumps({"_note": "not a symbol", "AAA": "A"}))
    assert load_roster(roster_path) == {"AAA": "A"}

    quotes_path = tmp_path / "quotes.json"
    quotes_path.write_text(json.dumps({"_note": "not a symbol", "AAA": {"price": 1.0}}))
    q = load_quotes(quotes_path)
    assert list(q.keys()) == ["AAA"]
