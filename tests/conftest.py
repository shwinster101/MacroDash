"""Shared SYNTHETIC test fixtures. No real ticker's real thesis, target, or
score belongs here -- same invariant MacroDash's own test suite holds for
its SEED/BOARD fixtures (test/render.mjs, this repo's sibling project).
XYZ is not a real, tradeable symbol; use it (or ABC/QRS) for anything that
doesn't need a specific existing-symbol name."""

from __future__ import annotations

from copy import deepcopy
from datetime import date
from typing import Any

import pytest

BASE_CARD: dict[str, Any] = {
    "schema_version": "2.0",
    "symbol": "XYZ",
    "run_date": "2026-07-29",
    "run_type": "DEEP",
    "lens": "AI",
    "composite": 7.50,
    "pillars": {"V": 7, "G": 8, "P": 7, "M": 7, "R": 8},
    "weights_used": "STANDARD",
    "gates": {
        "G1": {"status": "PASS", "hard_stop": False, "tag": None, "note": "ok"},
    },
    "entry": {"state": "mid_range", "support": None, "resistance": None},
    "correlation_cluster": "other",
    "pt_model": {
        "target": 100.0,
        "horizon": "2028-12-31",
        "basis": "synthetic fixture, not a real target",
        "return_type": "price_only",
    },
    "next_binary": None,
    "next_earnings_date": None,
    "override": None,
    "hinges": [],
    "thesis": "synthetic fixture thesis -- not investment analysis of a real security",
    "flags": [],
    "sources": [],
}

TODAY = date(2026, 8, 2)


def card_payload(**overrides: Any) -> dict[str, Any]:
    """Deep-copy BASE_CARD and apply shallow top-level overrides -- enough
    for every test in this suite, which only ever varies one or two
    top-level fields at a time."""
    payload = deepcopy(BASE_CARD)
    payload.update(overrides)
    return payload


@pytest.fixture
def today() -> date:
    return TODAY
