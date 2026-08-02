"""_load_live_sources -- the glue between tt.macrodash_client and the CLI.
Mocked HTTP throughout, same rule as test_macrodash_client.py: never a real
call to the live PIN-gated endpoint."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from tt.models import Card
from tt.rank import _load_live_sources
from tests.conftest import card_payload


def _fake_response(body: dict):
    cm = MagicMock()
    cm.read.return_value = json.dumps(body).encode("utf-8")
    cm.__enter__.return_value = cm
    cm.__exit__.return_value = False
    return cm


def test_load_live_sources_merges_book_positions_and_quotes(monkeypatch):
    monkeypatch.setenv("TT_PIN", "123456")
    cards = {"AAA": Card.model_validate(card_payload(symbol="AAA"))}

    responses = [
        _fake_response({"book": [{"sym": "AAA", "tier": "S"}], "cut": []}),
        _fake_response({"asOf": "2026-08-02", "positions": {"AAA": {"pct": 12.0, "at": "x", "src": "sync"}}}),
        _fake_response({"quotes": {"AAA": {"px": 50.0, "at": datetime.now(timezone.utc).isoformat()}},
                        "asOf": "y", "requested": 1, "missing": []}),
    ]
    with patch("urllib.request.urlopen", side_effect=responses):
        roster, holdings, quotes, note = _load_live_sources(cards, "https://macrodash.pages.dev")

    assert roster == {"AAA": "S"}
    assert holdings.weight("AAA") == pytest.approx(0.12)
    assert quotes["AAA"].live_price == 50.0
    assert "LIVE from MacroDash" in note
    assert "1 book-tier symbols" in note


def test_load_live_sources_propagates_auth_error(monkeypatch):
    monkeypatch.setenv("TT_PIN", "")  # falsy -- triggers the "not set" path inside the client
    cards = {}
    from tt.macrodash_client import MacrodashAuthError

    with pytest.raises(MacrodashAuthError):
        _load_live_sources(cards, "https://macrodash.pages.dev")
