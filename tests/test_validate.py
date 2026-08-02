"""section 3: reject / warn / the field-level diff. Structural rejects go
through tt.models (a raw pydantic.ValidationError, caught by
parse_and_validate); semantic rejects go through tt.validate.semantic_check.
Both surface through parse_and_validate as the SAME ValidationResult shape --
that's the contract this file is really testing."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import card_payload
from tt.config import OVERRIDE_MAX_DAYS
from tt.validate import format_diff, parse_and_validate

TODAY = date(2026, 8, 2)


def test_valid_card_parses_clean():
    card, result = parse_and_validate(card_payload(), today=TODAY)
    assert card is not None and result.ok and not result.errors


def test_reject_schema_version_mismatch():
    card, result = parse_and_validate(card_payload(schema_version="1.9"), today=TODAY)
    assert card is None and not result.ok
    assert any("schema_version" in e for e in result.errors)


def test_reject_missing_required_field():
    payload = card_payload()
    del payload["thesis"]
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_composite_out_of_range():
    card, result = parse_and_validate(card_payload(composite=11.0), today=TODAY)
    assert card is None and not result.ok


def test_reject_pillar_out_of_range():
    payload = card_payload()
    payload["pillars"]["V"] = 11
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_unknown_correlation_cluster():
    card, result = parse_and_validate(card_payload(correlation_cluster="not_a_cluster"), today=TODAY)
    assert card is None and not result.ok


def test_reject_unknown_gate_status():
    payload = card_payload()
    payload["gates"]["G1"]["status"] = "MAYBE"
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_hard_stop_on_non_fail_gate():
    payload = card_payload()
    payload["gates"]["G1"] = {"status": "PASS", "hard_stop": True, "tag": None, "note": ""}
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_pt_model_horizon_before_run_date():
    payload = card_payload()
    payload["pt_model"]["horizon"] = "2020-01-01"
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_pt_model_target_not_positive():
    payload = card_payload()
    payload["pt_model"]["target"] = 0
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_run_date_in_future():
    card, result = parse_and_validate(
        card_payload(run_date=(TODAY + timedelta(days=1)).isoformat()), today=TODAY
    )
    assert card is None and not result.ok


def test_reject_override_expiry_past_max_days():
    payload = card_payload(
        override={
            "scope": "x", "size_limit_pct": 18.0, "review_trigger": "x",
            "expiry_date": (date.fromisoformat(card_payload()["run_date"]) + timedelta(days=OVERRIDE_MAX_DAYS + 1)).isoformat(),
        }
    )
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok
    assert any("R6-C4" in e for e in result.errors)


def test_reject_override_missing_subfield():
    payload = card_payload(override={"scope": "x", "size_limit_pct": 18.0})  # missing review_trigger, expiry_date
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_reject_total_return_without_dividend_language():
    payload = card_payload()
    payload["pt_model"]["return_type"] = "total_return"
    payload["pt_model"]["basis"] = "price target only, nothing about distributions"
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is None and not result.ok


def test_accept_total_return_with_dividend_language():
    payload = card_payload()
    payload["pt_model"]["return_type"] = "total_return"
    payload["pt_model"]["basis"] = "price target plus dividend reinvestment through horizon"
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is not None and result.ok


def test_warn_empty_sources_on_deep_run():
    card, result = parse_and_validate(card_payload(run_type="DEEP", sources=[]), today=TODAY)
    assert card is not None
    assert any("sources" in w for w in result.warnings)


def test_warn_deprecated_derived_field_present_but_still_accepted():
    payload = card_payload()
    payload["gate_multiplier"] = 0.85  # terminal-owned; chat should never send this
    card, result = parse_and_validate(payload, today=TODAY)
    assert card is not None and result.ok
    assert any("gate_multiplier" in w for w in result.warnings)


def test_format_diff_is_human_readable():
    _, result = parse_and_validate(card_payload(composite=99), today=TODAY)
    text = format_diff(card_payload(composite=99), result)
    assert "REJECTED" in text and "XYZ" in text
