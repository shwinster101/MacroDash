"""
tt.queue -- section 8.6: "run_queue.md emitter lists UNVALIDATED + stale +
red-hinge names -> first paste of the next chat session (inverts ad-hoc
ticker picking)."

Because bucket.py's rung 2 already folds ALL THREE of those conditions (no
card on file, TTL/earnings staleness, a red hinge) into the single
UNVALIDATED bucket, this module's real job is just: enumerate UNVALIDATED
entries, and say WHY each one is there -- "never run" and "was run, now
stale" are different asks for the next chat session, so the queue names the
reason rather than presenting one flat list.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from tt.config import CARD_TTL_DAYS
from tt.rank import RankedCard


@dataclass(frozen=True)
class QueueEntry:
    symbol: str
    reason: str


def _stale_reason(card, today: date) -> str:
    """card is a tt.models.Card, guaranteed non-None and is_stale()==True by
    the caller. Names WHICH of section 4.5's three conditions fired --
    multiple may apply, all are reported."""
    reasons = []
    if today > card.run_date + timedelta(days=CARD_TTL_DAYS):
        age = (today - card.run_date).days
        reasons.append(f"TTL exceeded ({age}d since run, cap {CARD_TTL_DAYS}d)")
    if (
        card.next_earnings_date is not None
        and card.next_earnings_date < today
        and card.run_date < card.next_earnings_date
    ):
        reasons.append(f"earnings printed {card.next_earnings_date} since last run")
    red = [h.id for h in card.hinges if h.state == "red"]
    if red:
        reasons.append(f"red hinge(s): {', '.join(red)}")
    return "; ".join(reasons) if reasons else "stale"


def run_queue_entries(entries: list[RankedCard], today: date) -> list[QueueEntry]:
    out: list[QueueEntry] = []
    for rc in entries:
        if rc.bucket != "UNVALIDATED":
            continue
        if rc.card is None:
            out.append(QueueEntry(rc.symbol, "never run"))
        else:
            out.append(QueueEntry(rc.symbol, _stale_reason(rc.card, today)))
    out.sort(key=lambda e: e.symbol)
    return out


def render_run_queue_md(entries: list[QueueEntry], today: date) -> str:
    lines = [f"# TT run queue — as of {today.isoformat()}", ""]
    if not entries:
        lines.append("Nothing pending — every tracked name has a current card.")
        return "\n".join(lines) + "\n"
    lines.append(
        "Paste this list first in the next chat session (spec section 8.6 — "
        "inverts ad-hoc ticker picking; the queue decides what gets worked next, "
        "not whichever name comes to mind)."
    )
    lines.append("")
    for e in entries:
        lines.append(f"- **{e.symbol}** — {e.reason}")
    return "\n".join(lines) + "\n"


def write_run_queue(path: str | Path, entries: list[QueueEntry], today: date) -> None:
    Path(path).write_text(render_run_queue_md(entries, today))
