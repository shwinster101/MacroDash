"""One test per numbered rung in section 5's precedence table -- the build
order's explicit instruction. Each test is constructed so ONLY the rung
under test can fire; that's what proves the precedence order, not just the
individual conditions."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import card_payload
from tt.bucket import bucket
from tt.config import BINARY_BLOCK_DAYS, CARD_TTL_DAYS, NEAR_TERM_DAYS
from tt.models import Card

TODAY = date(2026, 8, 2)
FUTURE_HORIZON = (TODAY + timedelta(days=NEAR_TERM_DAYS + 200)).isoformat()

# Every test starts from a card that would otherwise land in RANKED, then
# perturbs exactly the one thing the rung under test cares about.
LIVE = dict(market_open=True, age_min=5, is_latest_close=False)


def make(**overrides) -> Card:
    payload = card_payload(pt_model={
        "target": 150.0, "horizon": FUTURE_HORIZON, "basis": "x", "return_type": "price_only",
    })
    payload.update(overrides)
    return Card.model_validate(payload)


def test_rung1_hard_stop_fail():
    card = make(gates={"G1": {"status": "FAIL", "hard_stop": True, "tag": None, "note": "broken"}})
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "PENDING" and r.reason == "gate" and r.eligible is False


def test_rung1_two_fails():
    card = make(
        gates={
            "G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""},
            "G2": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""},
        }
    )
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "PENDING" and r.reason == "gate"


def test_rung2a_no_card_on_file():
    r = bucket(None, TODAY, **LIVE)
    assert r.bucket == "UNVALIDATED" and r.eligible is False


def test_rung2b_stale_ttl():
    card = make(run_date=(TODAY - timedelta(days=CARD_TTL_DAYS + 1)).isoformat())
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "UNVALIDATED"


def test_rung2b_stale_red_hinge():
    card = make(hinges=[{"id": "x", "state": "red", "test": "broke"}])
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "UNVALIDATED"


def test_rung3_no_pt_model():
    card = make(pt_model=None)
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "PENDING" and r.reason == "no_target" and r.eligible is False


def test_rung3_eligible_is_false_even_when_gate_is_eligible():
    # Regression: eligible must be hardcoded False here, never gate.eligible --
    # the global eligible formula requires pt_model is not None as its own AND
    # condition, so a clean (PASS-only) gate must not leak eligible=True through
    # a card that has no price target at all.
    card = make(
        pt_model=None,
        gates={"G1": {"status": "PASS", "hard_stop": False, "tag": None, "note": ""}},
    )
    from tt.derive import gate_multiplier

    gate = gate_multiplier(card, TODAY)
    assert gate.eligible is True  # precondition: the gate alone would say eligible
    r = bucket(card, TODAY, **LIVE)
    assert r.eligible is False


def test_rung4_horizon_lapsed():
    card = make(pt_model={"target": 100, "horizon": TODAY.isoformat(), "basis": "x", "return_type": "price_only"})
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "PENDING" and r.reason == "horizon" and r.eligible is False


def test_rung5_one_fail_no_override():
    card = make(gates={"G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""}})
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "PENDING" and r.reason == "no_override" and r.eligible is False


def test_rung5_is_bypassed_by_a_valid_override():
    card = make(
        gates={"G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""}},
        override={
            "scope": "G1", "size_limit_pct": 18.0, "review_trigger": "x",
            "expiry_date": (TODAY + timedelta(days=10)).isoformat(),
        },
    )
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "RANKED"  # falls through to rung 9, not stopped at rung 5


def test_rung6_stale_quote():
    card = make()
    r = bucket(card, TODAY, market_open=False, age_min=None, is_latest_close=False)
    assert r.bucket == "PENDING" and r.reason == "quote" and r.eligible is False


def test_rung7_binary_window():
    card = make(next_binary=(TODAY + timedelta(days=BINARY_BLOCK_DAYS)).isoformat())
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "BINARY" and r.eligible is False


def test_rung7_binary_window_boundary_is_inclusive():
    # exactly BINARY_BLOCK_DAYS out still blocks -- the eligible formula's
    # own boundary is "> BINARY_BLOCK_DAYS", so ==BINARY_BLOCK_DAYS blocks.
    card = make(next_binary=(TODAY + timedelta(days=BINARY_BLOCK_DAYS)).isoformat())
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "BINARY"


def test_rung7_binary_just_outside_window_does_not_block():
    card = make(next_binary=(TODAY + timedelta(days=BINARY_BLOCK_DAYS + 1)).isoformat())
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "RANKED"


def test_rung8_near_term():
    card = make(pt_model={
        "target": 120.0,
        "horizon": (TODAY + timedelta(days=NEAR_TERM_DAYS - 1)).isoformat(),
        "basis": "x", "return_type": "price_only",
    })
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "NEAR_TERM" and r.eligible is True


def test_rung9_ranked():
    card = make()  # FUTURE_HORIZON is well past NEAR_TERM_DAYS
    r = bucket(card, TODAY, **LIVE)
    assert r.bucket == "RANKED" and r.eligible is True


def test_eligible_flag_is_true_only_for_near_term_and_ranked():
    # Per-rung tests above already prove PENDING/BINARY/UNVALIDATED all
    # carry eligible=False; this just pins the positive case alongside one
    # negative case as a single documented invariant.
    assert bucket(make(), TODAY, **LIVE).eligible is True
    assert bucket(None, TODAY, **LIVE).eligible is False
