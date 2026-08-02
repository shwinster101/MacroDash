"""
tt.roster -- book-tier ROSTER MEMBERSHIP, kept separate from the computed
composite-derived tier (spec section 4.4): "Book tier (roster membership) is
stored separately; when the two disagree, render both and surface a
TIER_MISMATCH badge." The card schema itself carries no book_tier field --
this is deliberately owner-asserted state, not something chat emits per
card, so it lives in its own small file rather than being smuggled into the
card (which would violate the ownership contract in spec section 0).

Uses the same S/A/B/C vocabulary as the computed tier (tt.config.
TIER_BOUNDARIES) so the two are directly comparable -- see
tt.derive.tier_mismatch().
"""

from __future__ import annotations

import json
from pathlib import Path

BOOK_TIERS = frozenset({"S", "A", "B", "C"})


def load_roster(path: str | Path) -> dict[str, str]:
    p = Path(path)
    if not p.exists():
        return {}
    data = json.loads(p.read_text())
    out: dict[str, str] = {}
    for sym, tier in data.items():
        if sym.startswith("_"):
            continue  # "_readme"-style self-documentation key, not a symbol
        sym_u, tier_u = sym.upper(), str(tier).upper()
        if tier_u not in BOOK_TIERS:
            raise ValueError(f"roster: bad book tier {tier!r} for {sym!r} (want {sorted(BOOK_TIERS)})")
        out[sym_u] = tier_u
    return out
