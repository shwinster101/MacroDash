"""One test group per section-4 formula, per the build order's own
instruction ("Derived-value module (section 4) with unit tests per
formula")."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.conftest import card_payload
from tt.config import CARD_TTL_DAYS, MULT_FLOOR, NEAR_TERM_DAYS, OVERRIDE_MAX_DAYS
from tt.derive import (
    effective_multiplier,
    entry_multiplier,
    fit_multiplier,
    gate_multiplier,
    is_stale,
    override_valid,
    quote_is_live,
    return_metric,
    tier_from_composite,
    tier_mismatch,
)
from tt.holdings import Holdings, HoldingRecord
from tt.models import Card

TODAY = date(2026, 8, 2)


def make(**overrides) -> Card:
    return Card.model_validate(card_payload(**overrides))


# --- 4.1 gate_multiplier -----------------------------------------------------


def test_gate_zero_fail_zero_flag_is_full_multiplier():
    card = make(gates={"G1": {"status": "PASS", "hard_stop": False, "tag": None, "note": ""}})
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 1.00 and r.eligible is True


def test_gate_one_flag():
    card = make(gates={"G1": {"status": "FLAG", "hard_stop": False, "tag": None, "note": ""}})
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.85 and r.eligible is True


def test_gate_two_flags():
    card = make(
        gates={
            "G1": {"status": "FLAG", "hard_stop": False, "tag": None, "note": ""},
            "G2": {"status": "FLAG", "hard_stop": False, "tag": None, "note": ""},
        }
    )
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.75 and r.eligible is True


def test_gate_one_fail_no_override_not_eligible():
    card = make(gates={"G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""}})
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.60 and r.eligible is False


def test_gate_one_fail_with_valid_override_is_eligible():
    card = make(
        gates={"G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""}},
        override={
            "scope": "G1 fail",
            "size_limit_pct": 18.0,
            "review_trigger": "Q3 print",
            "expiry_date": (TODAY + timedelta(days=10)).isoformat(),
        },
    )
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.60 and r.eligible is True


def test_gate_one_fail_with_expired_override_not_eligible():
    card = make(
        gates={"G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""}},
        override={
            "scope": "G1 fail",
            "size_limit_pct": 18.0,
            "review_trigger": "Q3 print",
            "expiry_date": (TODAY - timedelta(days=1)).isoformat(),
        },
    )
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.60 and r.eligible is False


def test_gate_two_fails_forces_030_regardless_of_override():
    card = make(
        gates={
            "G1": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""},
            "G2": {"status": "FAIL", "hard_stop": False, "tag": None, "note": ""},
        },
        override={
            "scope": "won't help",
            "size_limit_pct": 18.0,
            "review_trigger": "x",
            "expiry_date": (TODAY + timedelta(days=10)).isoformat(),
        },
    )
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.30 and r.eligible is False


def test_gate_hard_stop_forces_030_even_with_single_fail():
    card = make(gates={"G1": {"status": "FAIL", "hard_stop": True, "tag": None, "note": "broken thesis"}})
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.30 and r.eligible is False


def test_gate_tagged_fail_forces_030():
    card = make(
        gates={"G1": {"status": "FAIL", "hard_stop": False, "tag": "credit_downgrade", "note": ""}}
    )
    r = gate_multiplier(card, TODAY)
    assert r.gate_mult == 0.30 and r.eligible is False


def test_override_valid_boundary_is_inclusive():
    card = make(
        override={
            "scope": "x", "size_limit_pct": 18.0, "review_trigger": "x",
            "expiry_date": TODAY.isoformat(),
        }
    )
    assert override_valid(card, TODAY) is True
    card2 = make(
        override={
            "scope": "x", "size_limit_pct": 18.0, "review_trigger": "x",
            "expiry_date": (TODAY - timedelta(days=1)).isoformat(),
        }
    )
    assert override_valid(card2, TODAY) is False


def test_override_max_days_constant_is_two_quarters():
    # R6-C4, taken directly from the spec text: "auto-expiry <= 2 quarters".
    assert OVERRIDE_MAX_DAYS == 183


# --- 4.2 entry_multiplier -----------------------------------------------------


@pytest.mark.parametrize(
    "state,expected",
    [
        ("confirmed_support", 1.00),
        ("at_support", 0.85),
        ("relative_strength", 0.75),
        ("mid_range", 0.60),
        ("extended", 0.40),
        ("broken_no_base", 0.30),
        ("failed_breakout", 0.15),
    ],
)
def test_entry_multiplier_lookup(state, expected):
    assert entry_multiplier(state) == expected


def test_entry_multiplier_unknown_state_raises():
    with pytest.raises(ValueError):
        entry_multiplier("not_a_real_state")


# --- 4.3 fit_multiplier -------------------------------------------------------


def test_fit_multiplier_unheld_uncrowded_name_is_100():
    holdings = Holdings(as_of=None, records={})
    m = fit_multiplier("XYZ", "other", holdings, cluster_of=lambda s: None)
    assert m == 1.00


def test_fit_multiplier_cap_breach_floors_near_050():
    # NBIS anchor from spec section 4.3: "(31.2% wt, cap breach) -> ~0.50".
    holdings = Holdings(as_of=None, records={"NBIS": HoldingRecord(pct=0.312, legs=1)})
    m = fit_multiplier("NBIS", "neocloud", holdings, cluster_of=lambda s: "neocloud")
    assert m == pytest.approx(0.50, abs=1e-9)  # FIT_FLOOR clamp


def test_fit_multiplier_redundancy_floor_at_four_expressions():
    # NVDA anchor from spec section 4.3: "(4 expressions) -> ~0.55". With
    # cluster_f and cap_f both at 1.00 (isolated scenario, no other cluster
    # members, well under cap), the formula's redund_f term alone determines
    # the result: max(0.60, 1-0.15*3) = 0.60 exactly. The spec's "~0.55"
    # anchor folds in additional cluster/cap context not given in the spec
    # text; this test verifies the exact, unambiguous part of the formula.
    holdings = Holdings(
        as_of=None,
        records={
            "NVDA": HoldingRecord(pct=0.05, legs=1),
            "NVDL": HoldingRecord(pct=0.02, legs=1),
            "MAGX": HoldingRecord(pct=0.02, legs=1),
            "MAGS": HoldingRecord(pct=0.02, legs=1),
        },
    )
    m = fit_multiplier("NVDA", "ai_capex_compute", holdings, cluster_of=lambda s: "ai_capex_compute" if s in {"NVDA","NVDL","MAGX","MAGS"} else None)
    assert m == pytest.approx(0.60, abs=1e-9)


def test_fit_multiplier_cluster_soft_cap_penalty():
    # Two names, each individually UNDER the 18% single-name cap (so cap_f
    # stays 1.00 and doesn't confound the result), summing to 26% in one
    # cluster (> the 25% soft cap):
    # cluster_f = clamp(1 - (0.26-0.25)*2.0, 0.60, 1.00) = clamp(0.98,...) = 0.98
    holdings = Holdings(
        as_of=None,
        records={"AAA": HoldingRecord(pct=0.13), "BBB": HoldingRecord(pct=0.13)},
    )
    m = fit_multiplier("AAA", "ai_capex_foundry", holdings, cluster_of=lambda s: "ai_capex_foundry")
    assert m == pytest.approx(0.98, abs=1e-9)


def test_fit_multiplier_stacks_cluster_and_cap_penalties():
    # The interaction case: AAA itself breaches the single-name cap AND its
    # cluster breaches the soft cap -- both factors apply multiplicatively.
    # cluster_f = clamp(1-(0.40-0.25)*2.0,0.60,1.00) = 0.70
    # cap_f     = max(0.50, 1-(0.20-0.18)/0.18)      = 0.8888...
    holdings = Holdings(
        as_of=None,
        records={"AAA": HoldingRecord(pct=0.20), "BBB": HoldingRecord(pct=0.20)},
    )
    m = fit_multiplier("AAA", "ai_capex_foundry", holdings, cluster_of=lambda s: "ai_capex_foundry")
    assert m == pytest.approx(0.70 * (1 - (0.20 - 0.18) / 0.18), abs=1e-9)


def test_fit_multiplier_never_exceeds_100_or_drops_below_floor():
    holdings = Holdings(as_of=None, records={})
    m = fit_multiplier("ZZZ", "other", holdings, cluster_of=lambda s: None)
    assert 0.50 <= m <= 1.00


# --- 4.4 tier / mismatch -------------------------------------------------------


@pytest.mark.parametrize(
    "composite,expected",
    [
        (10.0, "S"), (8.5, "S"), (8.49, "A"), (7.0, "A"),
        (6.99, "B"), (5.5, "B"), (5.49, "C"), (0.0, "C"),
    ],
)
def test_tier_boundaries(composite, expected):
    assert tier_from_composite(composite) == expected


def test_tier_mismatch_true_when_disagree():
    assert tier_mismatch("C", "S") is True  # spec's live example: JOBY book S, computed C


def test_tier_mismatch_false_when_agree():
    assert tier_mismatch("A", "A") is False


def test_tier_mismatch_false_when_no_book_tier_on_file():
    assert tier_mismatch("A", None) is False


# --- 4.5 staleness -------------------------------------------------------------


def test_stale_ttl_exceeded():
    card = make(run_date=(TODAY - timedelta(days=CARD_TTL_DAYS + 1)).isoformat())
    assert is_stale(card, TODAY) is True


def test_stale_not_yet_at_ttl():
    card = make(run_date=(TODAY - timedelta(days=CARD_TTL_DAYS - 1)).isoformat())
    assert is_stale(card, TODAY) is False


def test_stale_earnings_passed_since_run():
    card = make(
        run_date=(TODAY - timedelta(days=5)).isoformat(),
        next_earnings_date=(TODAY - timedelta(days=1)).isoformat(),
    )
    assert is_stale(card, TODAY) is True


def test_not_stale_when_earnings_already_priced_in_at_run_time():
    # run_date is AFTER next_earnings_date -- the card was written knowing
    # that print already happened, so it does not invalidate the card.
    card = make(
        run_date=(TODAY - timedelta(days=1)).isoformat(),
        next_earnings_date=(TODAY - timedelta(days=5)).isoformat(),
    )
    assert is_stale(card, TODAY) is False


def test_stale_on_red_hinge():
    card = make(hinges=[{"id": "x", "state": "red", "test": "broke"}])
    assert is_stale(card, TODAY) is True


def test_not_stale_on_amber_or_green_hinge():
    card = make(hinges=[{"id": "x", "state": "amber", "test": "watching"}])
    assert is_stale(card, TODAY) is False


# --- 4.6 return math -----------------------------------------------------------


def test_return_horizon_lapsed():
    card = make(pt_model={"target": 100.0, "horizon": TODAY.isoformat(), "basis": "x", "return_type": "price_only"})
    r = return_metric(card.pt_model, 90.0, TODAY)
    assert r.metric is None and r.bucket_hint == "PENDING" and r.flag == "horizon_lapsed"


def test_return_near_term_is_absolute_not_annualised():
    horizon = TODAY + timedelta(days=NEAR_TERM_DAYS - 1)
    card = make(pt_model={"target": 120.0, "horizon": horizon.isoformat(), "basis": "x", "return_type": "price_only"})
    r = return_metric(card.pt_model, 100.0, TODAY)
    assert r.annualised is False
    assert r.metric == pytest.approx(0.20, abs=1e-9)  # 120/100 - 1, NOT compounded
    assert r.flag == "horizon_imminent"


def test_return_long_horizon_is_cagr():
    horizon = TODAY + timedelta(days=NEAR_TERM_DAYS + 275)  # comfortably past the near-term line
    card = make(pt_model={"target": 200.0, "horizon": horizon.isoformat(), "basis": "x", "return_type": "price_only"})
    r = return_metric(card.pt_model, 100.0, TODAY)
    days = (horizon - TODAY).days
    expected = (200.0 / 100.0) ** (365.25 / days) - 1
    assert r.annualised is True
    assert r.metric == pytest.approx(expected, rel=1e-9)
    assert r.flag is None


def test_return_invalid_price_does_not_crash():
    card = make(pt_model={"target": 100.0, "horizon": (TODAY + timedelta(days=400)).isoformat(), "basis": "x", "return_type": "price_only"})
    r = return_metric(card.pt_model, 0.0, TODAY)
    assert r.metric is None and r.flag == "invalid_price"


# --- 4.7 quote freshness --------------------------------------------------------


def test_quote_live_market_open_fresh():
    assert quote_is_live(market_open=True, age_min=5, is_latest_close=False) is True


def test_quote_not_live_market_open_stale():
    assert quote_is_live(market_open=True, age_min=45, is_latest_close=False) is False


def test_quote_live_market_closed_latest_close():
    assert quote_is_live(market_open=False, age_min=None, is_latest_close=True) is True


def test_quote_not_live_market_closed_not_latest_close():
    assert quote_is_live(market_open=False, age_min=None, is_latest_close=False) is False


# --- effective multiplier (feeds section 6) ------------------------------------


def test_effective_multiplier_floors_at_mult_floor():
    m = effective_multiplier(gate_mult=0.30, entry_mult=0.15, fit_mult=0.50)
    assert m == MULT_FLOOR  # 0.30*0.15*0.50 = 0.0225, well under the 0.15 floor


def test_effective_multiplier_normal_product():
    m = effective_multiplier(gate_mult=1.00, entry_mult=0.85, fit_mult=0.90)
    assert m == pytest.approx(0.765, abs=1e-9)
