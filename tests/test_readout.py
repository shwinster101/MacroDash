from __future__ import annotations

from datetime import datetime, timedelta, timezone

from tt.readout import fetch_status, to_status

NOW = datetime(2026, 8, 2, 12, 0, tzinfo=timezone.utc)


def body(**overrides) -> dict:
    base = {
        "schema": "tt-v1",
        "as_of": "2026-08-01",
        "generated_at": (NOW - timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
        "cached": True,
        "regime": {"verdict": "NEUTRAL", "available": 6, "bullish": 2, "bearish": 1,
                   "raw_verdict": "NEUTRAL", "downgraded": None},
        "macro_flip": {"armed": False, "tripped": False, "evaluable": True, "reason": None},
    }
    base.update(overrides)
    return base


def test_to_status_fresh_and_ok():
    s = to_status(body(), NOW)
    assert s.fresh is True and s.regime == "NEUTRAL" and s.macro_flip_tripped is False


def test_to_status_stale_when_generated_at_over_24h_old():
    s = to_status(body(generated_at=(NOW - timedelta(hours=25)).isoformat().replace("+00:00", "Z")), NOW)
    assert s.fresh is False


def test_to_status_missing_generated_at_reads_not_fresh():
    b = body()
    del b["generated_at"]
    s = to_status(b, NOW)
    assert s.fresh is False


def test_to_status_blind_circuit_reason_passed_through():
    s = to_status(
        body(macro_flip={"armed": None, "tripped": None, "evaluable": False,
                          "reason": "circuit BLIND — missing or stale: vix, spy_price"}),
        NOW,
    )
    assert s.macro_flip_evaluable is False
    assert "vix" in s.missing_field


def test_to_status_tripped_flip():
    s = to_status(body(macro_flip={"armed": True, "tripped": True, "evaluable": True, "reason": None}), NOW)
    assert s.macro_flip_tripped is True


def test_to_status_insufficient_regime():
    s = to_status(body(regime={"verdict": "INSUFFICIENT", "available": 2, "bullish": 1, "bearish": 0,
                                "raw_verdict": "NEUTRAL", "downgraded": None}), NOW)
    assert s.regime == "INSUFFICIENT"


def test_fetch_status_network_failure_is_reported_not_raised():
    # Port 1 is reserved/unroutable -- a fast, reliable connection failure
    # without depending on external network access from the test sandbox.
    s = fetch_status(url="http://127.0.0.1:1/readout.json", timeout=1.0)
    assert s.fetch_error is not None
    assert s.regime is None and s.fresh is False
