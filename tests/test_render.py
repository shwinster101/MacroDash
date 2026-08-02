from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.conftest import card_payload
from tt.config import MAX_CAP_PCT, NEAR_TERM_DAYS
from tt.holdings import Holdings, HoldingRecord
from tt.models import Card
from tt.rank import QuoteMeta, ranked_board_constrained, ranked_board_fair, rank_all
from tt.render import (
    ReadoutStatus,
    delta_signal,
    format_binary_panel,
    format_funding_priority,
    format_near_term,
    format_valuation_gap,
    override_status,
    render_report,
    status_bar,
    stricter_regime,
)

TODAY = date(2026, 8, 2)
FAR_HORIZON = (TODAY + timedelta(days=NEAR_TERM_DAYS + 300)).isoformat()


def card(symbol: str, target: float, **overrides) -> Card:
    payload = card_payload(
        symbol=symbol,
        pt_model={"target": target, "horizon": FAR_HORIZON, "basis": "x", "return_type": "price_only"},
    )
    payload.update(overrides)
    return Card.model_validate(payload)


def qm(price: float) -> QuoteMeta:
    return QuoteMeta(live_price=price, market_open=True, age_min=5, is_latest_close=False)


# --- 7.5 status bar ------------------------------------------------------------


def fresh_status(**overrides) -> ReadoutStatus:
    base = dict(fresh=True, regime="NEUTRAL", macro_flip_evaluable=True, macro_flip_tripped=False)
    base.update(overrides)
    return ReadoutStatus(**base)


def test_status_adds_ok_on_neutral():
    assert status_bar(fresh_status(regime="NEUTRAL")) == "ADDS OK"


def test_status_adds_ok_on_tailwind():
    assert status_bar(fresh_status(regime="TAILWIND")) == "ADDS OK"


def test_status_blocked_on_headwind():
    assert status_bar(fresh_status(regime="HEADWIND")) == "ADDS BLOCKED — HEADWIND"


def test_status_blocked_on_panic():
    assert status_bar(fresh_status(regime="PANIC")) == "ADDS BLOCKED — PANIC"


def test_status_frozen_on_tripped_flip():
    s = status_bar(fresh_status(macro_flip_tripped=True))
    assert s == "ADDS FROZEN — MACRO FLIP"


def test_status_frozen_takes_precedence_over_headwind():
    s = status_bar(fresh_status(regime="HEADWIND", macro_flip_tripped=True))
    assert s == "ADDS FROZEN — MACRO FLIP"


def test_status_blind_on_stale_readout():
    s = status_bar(fresh_status(fresh=False))
    assert "CIRCUIT BLIND" in s and "stale" in s


def test_status_blind_on_missing_field():
    s = status_bar(fresh_status(missing_field="vix"))
    assert s == "ADDS BLOCKED — CIRCUIT BLIND (vix)"


def test_status_blind_on_fetch_error():
    s = status_bar(fresh_status(fetch_error="connection refused"))
    assert "CIRCUIT BLIND" in s and "connection refused" in s


def test_status_blind_on_insufficient_regime():
    s = status_bar(fresh_status(regime="INSUFFICIENT"))
    assert "CIRCUIT BLIND" in s


def test_status_blind_on_unevaluable_flip():
    s = status_bar(fresh_status(macro_flip_evaluable=False, macro_flip_tripped=None))
    assert "CIRCUIT BLIND" in s


def test_stricter_regime_picks_worse_of_two():
    assert stricter_regime("TAILWIND", "PANIC") == "PANIC"
    assert stricter_regime("NEUTRAL", None) == "NEUTRAL"
    assert stricter_regime(None, None) is None


def test_status_uses_stricter_of_measured_and_asserted():
    s = status_bar(fresh_status(regime="TAILWIND"), asserted_regime="HEADWIND")
    assert s == "ADDS BLOCKED — HEADWIND"


# --- 7.3 delta signal ------------------------------------------------------------


def _rc(rank_fair, rank_constrained):
    entries = rank_all(
        {"AAA": card("AAA", target=150.0)}, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {}
    )
    rc = entries[0]
    return rc.__class__(**{**rc.__dict__, "rank_fair": rank_fair, "rank_constrained": rank_constrained})


def test_delta_restructure():
    assert delta_signal(_rc(0.10, -0.05), name_wt=0.0, expressions=3) == "RESTRUCTURE"


def test_delta_trim():
    assert delta_signal(_rc(-0.05, -0.10), name_wt=0.25, expressions=1) == "TRIM"


def test_delta_add_candidate():
    assert delta_signal(_rc(0.10, 0.05), name_wt=0.0, expressions=1) == "ADD_CANDIDATE"


def test_delta_review_fit_input():
    assert delta_signal(_rc(-0.10, 0.02), name_wt=0.05, expressions=1) == "REVIEW_FIT_INPUT"


def test_delta_none_when_unrankable():
    rc = _rc(None, None)
    assert delta_signal(rc, name_wt=0.0, expressions=1) is None


# --- 7.1 / 7.2 / 7.4 panels ---------------------------------------------------------


def test_valuation_gap_shape_and_tier_mismatch_flag():
    cards = {"AAA": card("AAA", target=200.0, composite=3.0)}
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), roster={"AAA": "S"})
    rows = format_valuation_gap(ranked_board_fair(entries), TODAY)
    assert rows[0]["sym"] == "AAA"
    assert rows[0]["comp_tier"] == "C"
    assert rows[0]["tier_mismatch"] is True
    assert rows[0]["pct_per_yr"] is not None  # long horizon -> annualised


def test_funding_priority_forced_trim_when_over_cap_no_override():
    cards = {"AAA": card("AAA", target=200.0)}
    holdings = Holdings(None, {"AAA": HoldingRecord(pct=0.25, legs=1)})
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, holdings, {})
    result = format_funding_priority(ranked_board_constrained(entries), holdings, TODAY)
    assert len(result["forced"]) == 1 and "TRIM REQUIRED" in result["forced"][0].line
    assert result["discretionary"] == []


def test_funding_priority_override_active_suppresses_trim():
    cards = {"AAA": card(
        "AAA", target=200.0,
        override={"scope": "x", "size_limit_pct": 18.0, "review_trigger": "x",
                  "expiry_date": (TODAY + timedelta(days=10)).isoformat()},
    )}
    holdings = Holdings(None, {"AAA": HoldingRecord(pct=0.25, legs=1)})
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, holdings, {})
    result = format_funding_priority(ranked_board_constrained(entries), holdings, TODAY)
    assert "OVERRIDE ACTIVE" in result["forced"][0].line


def test_funding_priority_override_expired_flags_repaper():
    cards = {"AAA": card(
        "AAA", target=200.0,
        override={"scope": "x", "size_limit_pct": 18.0, "review_trigger": "x",
                  "expiry_date": (TODAY - timedelta(days=1)).isoformat()},
    )}
    holdings = Holdings(None, {"AAA": HoldingRecord(pct=0.25, legs=1)})
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, holdings, {})
    result = format_funding_priority(ranked_board_constrained(entries), holdings, TODAY)
    assert "OVERRIDE EXPIRED" in result["forced"][0].line
    assert "RE-PAPER OR TRIM" in result["forced"][0].line


def test_funding_priority_discretionary_ascending_weakest_first():
    cards = {
        "AAA": card("AAA", target=110.0, composite=6.0),
        "BBB": card("BBB", target=300.0, composite=9.0),
    }
    holdings = Holdings(None, {})
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0), "BBB": qm(100.0)}, holdings, {})
    result = format_funding_priority(ranked_board_constrained(entries), holdings, TODAY)
    syms = [r["sym"] for r in result["discretionary"]]
    assert syms[0] == "AAA"  # weaker expected return funds FIRST (comes from the weakest)


def test_near_term_label_is_absolute_not_annualised():
    near_horizon = (TODAY + timedelta(days=NEAR_TERM_DAYS - 1)).isoformat()
    cards = {"AAA": card("AAA", target=120.0, pt_model={
        "target": 120.0, "horizon": near_horizon, "basis": "x", "return_type": "price_only",
    })}
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {})
    from tt.rank import near_term_board
    rows = format_near_term(near_term_board(entries))
    assert rows[0]["absolute_return_to_horizon"] == pytest.approx(0.20)  # 120/100-1, not compounded


# --- 7.6 overrides -----------------------------------------------------------------


def test_override_status_boundaries():
    from tt.models import Override

    green = Override(scope="x", size_limit_pct=18.0, review_trigger="x",
                      expiry_date=TODAY + timedelta(days=46))
    amber = Override(scope="x", size_limit_pct=18.0, review_trigger="x",
                      expiry_date=TODAY + timedelta(days=45))
    red = Override(scope="x", size_limit_pct=18.0, review_trigger="x",
                    expiry_date=TODAY - timedelta(days=1))
    assert override_status(green, TODAY).startswith("GREEN")
    assert override_status(amber, TODAY).startswith("AMBER")
    assert override_status(red, TODAY).startswith("RED")


# --- 7.7 binary panel ---------------------------------------------------------------


def test_binary_panel_sorted_by_days_and_every_member_frozen_out_of_ranked_boards():
    cards = {
        "AAA": card("AAA", target=150.0, next_binary=(TODAY + timedelta(days=5)).isoformat()),
        "BBB": card("BBB", target=150.0, next_binary=(TODAY + timedelta(days=2)).isoformat()),
    }
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0), "BBB": qm(100.0)}, Holdings(None, {}), {})
    panel = format_binary_panel(entries, TODAY)
    assert [r["sym"] for r in panel] == ["BBB", "AAA"]
    assert all(rc.bucket == "BINARY" for rc in entries)
    assert ranked_board_fair(entries) == [] and ranked_board_constrained(entries) == []


# --- assembled report ---------------------------------------------------------------


def test_render_report_runs_end_to_end_without_crashing():
    cards = {"AAA": card("AAA", target=200.0)}
    entries = rank_all(cards, TODAY, {"AAA": qm(100.0)}, Holdings(None, {}), {})
    text = render_report(entries, Holdings(None, {}), TODAY, fresh_status())
    assert "VALUATION GAP" in text and "FUNDING PRIORITY" in text and "AAA" in text
