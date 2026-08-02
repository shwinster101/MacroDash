"""
tt.quotes -- OPEN-4 (broker MCP access): "If available, section 4.7
self-satisfies; if not, quote sync stays manual and section 5 will reject
nearly everything."

No live broker connection is wired into this standalone CLI (see the note
in tt.holdings for why a Claude Code session's Robinhood MCP tools can't be
called from a plain `python -m tt.rank` invocation). This is the spec's own
documented fallback: a hand-maintained quotes.json, refreshed by the owner
before each `python -m tt.rank` run. quotes.example.json shows the shape.
"""

from __future__ import annotations

import json
from pathlib import Path

from tt.rank import QuoteMeta


def load_quotes(path: str | Path) -> dict[str, QuoteMeta]:
    p = Path(path)
    if not p.exists():
        return {}
    data = json.loads(p.read_text())
    out: dict[str, QuoteMeta] = {}
    for sym, q in data.items():
        if sym.startswith("_"):
            continue  # "_readme"-style self-documentation key, not a symbol
        out[sym.upper()] = QuoteMeta(
            live_price=q.get("price"),
            market_open=bool(q.get("market_open", False)),
            age_min=q.get("age_min"),
            is_latest_close=bool(q.get("is_latest_close", False)),
        )
    return out
