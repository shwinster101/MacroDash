"""Every test here MOCKS the HTTP layer. This client's whole point is that
a wrong PIN triggers MacroDash's real account lockout (tt.js: 5 fails =
15min, 10 = 24h) -- a test suite is exactly the kind of place a bad PIN
would get sent accidentally on every CI run, so no test in this file is
allowed to reach the real network."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

import pytest

from tt.holdings import HoldingRecord
from tt.macrodash_client import (
    MacrodashAuthError,
    MacrodashClient,
    holdings_from_positions,
    is_market_open_et,
    quotes_from_live,
    roster_from_book,
)


def _fake_response(body: dict):
    cm = MagicMock()
    cm.read.return_value = json.dumps(body).encode("utf-8")
    cm.__enter__.return_value = cm
    cm.__exit__.return_value = False
    return cm


# --- auth / transport ----------------------------------------------------------


def test_no_pin_raises_before_any_network_call():
    client = MacrodashClient(pin=None)
    with patch("tt.macrodash_client.os.environ", {}):
        with pytest.raises(MacrodashAuthError, match="TT_PIN is not set"):
            client.get_book()


def test_pin_sent_as_header(monkeypatch):
    client = MacrodashClient(pin="123456")
    with patch("urllib.request.urlopen", return_value=_fake_response({"book": []})) as mock_open:
        client.get_book()
        req = mock_open.call_args[0][0]
        assert req.headers.get("X-tt-pin") == "123456" or req.get_header("X-tt-pin") == "123456"


def test_pin_read_from_env_var_by_default(monkeypatch):
    monkeypatch.setenv("TT_PIN", "654321")
    client = MacrodashClient()  # no override -- must read the env var
    with patch("urllib.request.urlopen", return_value=_fake_response({"book": []})) as mock_open:
        client.get_book()
        req = mock_open.call_args[0][0]
        assert req.get_header("X-tt-pin") == "654321"


def test_401_raises_macrodash_auth_error_and_says_stop():
    client = MacrodashClient(pin="000000")
    err = HTTPError("url", 401, "unauthorized", {}, BytesIO(b""))
    with patch("urllib.request.urlopen", side_effect=err):
        with pytest.raises(MacrodashAuthError, match="do not retry"):
            client.get_book()


def test_403_also_raises_macrodash_auth_error():
    client = MacrodashClient(pin="000000")
    err = HTTPError("url", 403, "forbidden", {}, BytesIO(b""))
    with patch("urllib.request.urlopen", side_effect=err):
        with pytest.raises(MacrodashAuthError):
            client.get_positions()


def test_other_http_errors_are_not_swallowed():
    client = MacrodashClient(pin="123456")
    err = HTTPError("url", 500, "server error", {}, BytesIO(b""))
    with patch("urllib.request.urlopen", side_effect=err):
        with pytest.raises(HTTPError):
            client.get_book()


def test_get_book_returns_parsed_json():
    client = MacrodashClient(pin="123456")
    body = {"version": "1.4", "asOf": "2026-08-02", "book": [{"sym": "AAA", "tier": "S"}], "cut": []}
    with patch("urllib.request.urlopen", return_value=_fake_response(body)):
        assert client.get_book() == body


def test_get_quotes_empty_list_makes_no_http_call():
    client = MacrodashClient(pin="123456")
    with patch("urllib.request.urlopen") as mock_open:
        result = client.get_quotes([])
        mock_open.assert_not_called()
        assert result == {"quotes": {}, "asOf": None, "requested": 0, "missing": []}


def test_get_quotes_batches_above_max_syms():
    client = MacrodashClient(pin="123456")
    symbols = [f"SYM{i}" for i in range(75)]  # > MAX_QUOTE_SYMS (40)
    responses = [
        _fake_response({"quotes": {"SYM0": {"px": 1.0, "at": "2026-08-02T12:00:00Z"}},
                         "asOf": "a", "requested": 40, "missing": []}),
        _fake_response({"quotes": {"SYM74": {"px": 2.0, "at": "2026-08-02T12:00:00Z"}},
                         "asOf": "b", "requested": 35, "missing": ["X"]}),
    ]
    with patch("urllib.request.urlopen", side_effect=responses) as mock_open:
        result = client.get_quotes(symbols)
        assert mock_open.call_count == 2
        assert set(result["quotes"].keys()) == {"SYM0", "SYM74"}
        assert result["requested"] == 75
        assert result["missing"] == ["X"]


# --- roster_from_book ---------------------------------------------------------


def test_roster_direct_tiers_map_through():
    book = {"book": [{"sym": "aaa", "tier": "S"}, {"sym": "bbb", "tier": "A"}, {"sym": "ccc", "tier": "B"}]}
    assert roster_from_book(book) == {"AAA": "S", "BBB": "A", "CCC": "B"}


def test_roster_def_maps_to_c():
    book = {"book": [{"sym": "DDD", "tier": "DEF"}]}
    assert roster_from_book(book) == {"DDD": "C"}


def test_roster_watch_is_excluded_not_a_grade():
    book = {"book": [{"sym": "WWW", "tier": "WATCH"}]}
    assert roster_from_book(book) == {}


def test_roster_empty_book():
    assert roster_from_book({"book": []}) == {}
    assert roster_from_book({}) == {}


# --- holdings_from_positions ---------------------------------------------------


def test_holdings_pct_converted_from_percent_to_fraction():
    # THE unit-conversion test: MacroDash's 31.2 (a percent) must become
    # tt-engine's 0.312 (a fraction) -- exactly the NBIS anchor from the
    # spec's own section 4.3 worked example.
    positions = {"asOf": "2026-08-02", "positions": {"NBIS": {"pct": 31.2, "at": "x", "src": "sync"}}}
    holdings = holdings_from_positions(positions)
    assert holdings.weight("NBIS") == pytest.approx(0.312)


def test_holdings_legs_is_one_plus_option_count():
    positions = {"positions": {
        "AAA": {"pct": 5.0, "at": "x", "src": "sync", "opt": [{"k": "call", "side": "long", "n": 1}]},
    }}
    holdings = holdings_from_positions(positions)
    assert holdings._records["AAA"] == HoldingRecord(pct=0.05, legs=2)  # 1 share leg + 1 option leg


def test_holdings_no_options_is_one_leg():
    positions = {"positions": {"AAA": {"pct": 5.0, "at": "x", "src": "sync"}}}
    holdings = holdings_from_positions(positions)
    assert holdings._records["AAA"].legs == 1


def test_holdings_none_position_is_skipped():
    positions = {"positions": {"EXITED": None, "AAA": {"pct": 5.0, "at": "x", "src": "sync"}}}
    holdings = holdings_from_positions(positions)
    assert "EXITED" not in holdings._records and "AAA" in holdings._records


def test_holdings_missing_pct_is_skipped_not_zero():
    # tt.js's own doctrine: "unmeasured weight -- never invented as a 0."
    positions = {"positions": {"AAA": {"at": "x", "src": "sync"}}}  # no pct at all
    holdings = holdings_from_positions(positions)
    assert "AAA" not in holdings._records
    assert holdings.weight("AAA") == 0.0  # weight() itself still degrades to 0 for an unheld read


# --- market hours / quotes_from_live -------------------------------------------


def test_market_open_during_trading_hours():
    # Wednesday 2026-08-05, 10:00 ET
    now = datetime(2026, 8, 5, 14, 0, tzinfo=timezone.utc)  # 10:00 ET (UTC-4 in August)
    assert is_market_open_et(now) is True


def test_market_closed_on_weekend():
    # Saturday
    now = datetime(2026, 8, 8, 18, 0, tzinfo=timezone.utc)
    assert is_market_open_et(now) is False


def test_market_closed_before_open():
    now = datetime(2026, 8, 5, 13, 0, tzinfo=timezone.utc)  # 9:00 ET
    assert is_market_open_et(now) is False


def test_market_closed_at_exactly_4pm_et():
    now = datetime(2026, 8, 5, 20, 0, tzinfo=timezone.utc)  # 16:00 ET exactly
    assert is_market_open_et(now) is False


def test_quotes_from_live_market_open_computes_age():
    now = datetime(2026, 8, 5, 14, 0, tzinfo=timezone.utc)  # 10:00 ET, market open
    at = now - timedelta(minutes=7)
    quotes_json = {"quotes": {"AAA": {"px": 123.45, "chg": 1.2, "at": at.isoformat().replace("+00:00", "Z")}}}
    result = quotes_from_live(quotes_json, now=now)
    assert result["AAA"].live_price == 123.45
    assert result["AAA"].market_open is True
    assert result["AAA"].age_min == pytest.approx(7.0, abs=0.01)
    assert result["AAA"].is_latest_close is False


def test_quotes_from_live_market_closed_reads_as_latest_close():
    now = datetime(2026, 8, 8, 18, 0, tzinfo=timezone.utc)  # Saturday, market closed
    quotes_json = {"quotes": {"AAA": {"px": 100.0, "at": now.isoformat().replace("+00:00", "Z")}}}
    result = quotes_from_live(quotes_json, now=now)
    assert result["AAA"].market_open is False
    assert result["AAA"].is_latest_close is True
    assert result["AAA"].age_min is None  # freshness isn't judged by age when market's closed


def test_quotes_from_live_skips_entries_missing_px_or_at():
    quotes_json = {"quotes": {"AAA": {"chg": 1.0}, "BBB": {"px": 1.0, "at": "2026-08-02T12:00:00Z"}}}
    result = quotes_from_live(quotes_json, now=datetime(2026, 8, 5, 14, 0, tzinfo=timezone.utc))
    assert "AAA" not in result and "BBB" in result
