"""
tt.holdings -- the measured-position data layer section 4.3 (fit_mult) and
section 7.2 (funding priority) both read from.

This is real broker data (or, until OPEN-4 resolves, hand-maintained) --
never committed (see .gitignore). holdings.example.json shows the shape.

OPEN-4 (broker MCP access): this standalone CLI has no live broker
connection built in. A running Claude Code session in THIS environment does
have Robinhood MCP tools available, but those only exist inside a chat
session's tool-calling context -- a plain `python -m tt.rank` invocation
run later, on its own, cannot call them. Until a real sync exists, holdings
stay hand-maintained here, exactly as the spec's own fallback states:
"if not, quote sync stays manual and section 5 will reject nearly everything"
(quotes; positions are the same story).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from tt.config import UNDERLIER_COMPLEX


@dataclass(frozen=True)
class HoldingRecord:
    pct: float  # fraction of tracked-book MV (WEIGHT_DENOMINATOR), NOT a percent 0-100
    legs: int = 1  # distinct concurrent expressions of THIS symbol (shares+LEAPs+puts...)


class Holdings:
    def __init__(self, as_of: str | None, records: dict[str, HoldingRecord]):
        self.as_of = as_of
        self._records = records

    @classmethod
    def load(cls, path: str | Path) -> "Holdings":
        p = Path(path)
        if not p.exists():
            # No live sync configured yet -- an empty book, not an error.
            # Every fit_mult call degrades to its "unheld" branch (1.00).
            return cls(as_of=None, records={})
        data = json.loads(p.read_text())
        # Missing "pct" is SKIPPED, never defaulted to 0.0 -- matching
        # macrodash_client.holdings_from_positions()'s "unmeasured weight --
        # never invented as a 0" doctrine (tt.js's own rule). A hand-edited
        # holdings.json that omits pct for a real position must not silently
        # read as a real, measured 0% and mask a cap breach.
        records = {}
        for sym, v in data.get("holdings", {}).items():
            if v.get("pct") is None:
                continue
            records[sym.upper()] = HoldingRecord(pct=float(v["pct"]), legs=int(v.get("legs", 1)))
        return cls(as_of=data.get("as_of"), records=records)

    def weight(self, symbol: str) -> float:
        rec = self._records.get(symbol.upper())
        return rec.pct if rec else 0.0

    def all_weights(self) -> dict[str, float]:
        return {sym: rec.pct for sym, rec in self._records.items()}

    def is_held(self, symbol: str) -> bool:
        return self.weight(symbol) > 0

    def complex_members(self, symbol: str) -> frozenset[str]:
        """Every ticker that expresses exposure to the same underlier as
        `symbol`, per section 9 OPEN-2's worked examples. A symbol not in
        any known complex is its own singleton complex."""
        symbol = symbol.upper()
        for underlier, members in UNDERLIER_COMPLEX.items():
            if symbol in members:
                return members
        return frozenset({symbol})

    def expressions(self, symbol: str) -> int:
        """count_expressions() (section 9 OPEN-2): the number of distinct
        ways the SAME underlier complex is currently expressed -- every held
        member of the complex counts once, plus any extra concurrent legs
        recorded on that member (shares+LEAPs+puts on one ticker).

        Matches the spec's own anchor: NVDA complex = {NVDA, NVDL, MAGX,
        MAGS}; all four held at legs=1 each -> 4 expressions -> fit_mult
        ~0.55, exactly the worked example in section 4.3."""
        total = 0
        for member in self.complex_members(symbol):
            rec = self._records.get(member)
            if rec is not None and rec.pct > 0:
                total += rec.legs
        return total
