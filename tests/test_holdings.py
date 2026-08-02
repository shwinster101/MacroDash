"""tt.holdings.Holdings.load() -- the local-file fallback for measured
position weight. Section 4.3 (fit_mult) and section 7.2 (funding priority)
both read from this, so a missing weight silently reading as a real,
measured 0% would understate exposure exactly where a cap check needs to
catch it."""

from __future__ import annotations

import json
from pathlib import Path

from tt.holdings import Holdings


def _write(tmp_path: Path, data: dict) -> Path:
    p = tmp_path / "holdings.json"
    p.write_text(json.dumps(data))
    return p


def test_load_missing_file_is_empty_book(tmp_path):
    h = Holdings.load(tmp_path / "does_not_exist.json")
    assert h.weight("AAA") == 0.0
    assert h.is_held("AAA") is False


def test_load_reads_pct_and_legs(tmp_path):
    p = _write(tmp_path, {"as_of": "2026-08-02", "holdings": {"aaa": {"pct": 0.12, "legs": 2}}})
    h = Holdings.load(p)
    assert h.weight("AAA") == 0.12
    assert h._records["AAA"].legs == 2


def test_load_missing_pct_is_skipped_not_defaulted_to_zero(tmp_path):
    # Regression: an entry present in the file but missing "pct" (e.g. a
    # hand-edited holdings.json where the maintainer forgot the field) must
    # not silently become a real, measured 0.0 -- that would read as "held,
    # confirmed zero weight" rather than "not measured", exactly the
    # distinction macrodash_client.holdings_from_positions() already
    # enforces on the live-sync path ("unmeasured weight -- never invented
    # as a 0").
    p = _write(tmp_path, {"holdings": {"AAA": {"legs": 1}}})
    h = Holdings.load(p)
    assert "AAA" not in h._records
    assert h.weight("AAA") == 0.0  # weight() itself still degrades to 0 for an unheld read
    assert h.is_held("AAA") is False


def test_load_pct_null_is_also_skipped(tmp_path):
    p = _write(tmp_path, {"holdings": {"AAA": {"pct": None}}})
    h = Holdings.load(p)
    assert "AAA" not in h._records


def test_load_mixed_measured_and_unmeasured(tmp_path):
    p = _write(tmp_path, {"holdings": {"AAA": {"pct": 0.1}, "BBB": {"legs": 1}}})
    h = Holdings.load(p)
    assert "AAA" in h._records and "BBB" not in h._records
    assert h.all_weights() == {"AAA": 0.1}
