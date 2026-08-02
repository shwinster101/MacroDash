"""
tt.render -- section 7, UI render mapping. This is a standalone CLI tool (no
web front-end is specified anywhere in the spec beyond "python -m tt.rank
... renders section 7"), so each panel is built as a pure function returning
structured rows, plus one text formatter per panel for terminal/markdown
output. `render_report()` assembles all of it into what `python -m tt.rank`
prints.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from tt.config import MAX_CAP_PCT
from tt.derive import GateResult
from tt.holdings import Holdings
from tt.models import Card, Override
from tt.rank import (
    RankedCard,
    near_term_board,
    ranked_board_constrained,
    ranked_board_fair,
    unrankable,
)

# --- 7.5 status bar ----------------------------------------------------------

# Stricter-to-looser ordering. INSUFFICIENT is treated as unknown/blind, not
# as a point on the scale -- an unreadable regime is a blind-circuit case,
# never silently defaulted to a strictness level.
REGIME_STRICTNESS = {"PANIC": 3, "HEADWIND": 2, "NEUTRAL": 1, "TAILWIND": 0}


@dataclass(frozen=True)
class ReadoutStatus:
    """What tt.readout hands render.py. `fresh`/`missing_field`/`fetch_error`
    collapse every way the feed can be untrustworthy into ONE blind-circuit
    check, per section 7.5's fail-closed rule: a missing input trips the
    circuit, it does not get silently skipped."""

    fresh: bool
    regime: str | None  # TAILWIND|NEUTRAL|HEADWIND|PANIC|INSUFFICIENT|None
    macro_flip_evaluable: bool
    macro_flip_tripped: bool | None
    missing_field: str | None = None
    fetch_error: str | None = None


def stricter_regime(a: str | None, b: str | None) -> str | None:
    """section 7.5: 'Display the stricter of measured vs asserted state.'
    This standalone engine has no session/board-asserted regime source of
    its own (that lives in MacroDash's PIN-gated KV, not the public
    /readout.json this engine reads) -- `b` is accepted for forward
    compatibility (e.g. a future pasted asserted-regime input) and is simply
    None today, in which case the measured value passes through unchanged."""
    candidates = [r for r in (a, b) if r in REGIME_STRICTNESS]
    if not candidates:
        return a or b  # INSUFFICIENT/None -- nothing rankable, pass through as-is
    return max(candidates, key=lambda r: REGIME_STRICTNESS[r])


def status_bar(status: ReadoutStatus, asserted_regime: str | None = None) -> str:
    if status.fetch_error:
        return f"ADDS BLOCKED — CIRCUIT BLIND ({status.fetch_error})"
    if not status.fresh:
        return "ADDS BLOCKED — CIRCUIT BLIND (readout stale, >24h)"
    if status.regime is None or status.regime == "INSUFFICIENT":
        return "ADDS BLOCKED — CIRCUIT BLIND (regime unreadable)"
    if not status.macro_flip_evaluable:
        return "ADDS BLOCKED — CIRCUIT BLIND (macro_flip not evaluable)"
    if status.missing_field:
        return f"ADDS BLOCKED — CIRCUIT BLIND ({status.missing_field})"
    if status.macro_flip_tripped:
        return "ADDS FROZEN — MACRO FLIP"

    effective = stricter_regime(status.regime, asserted_regime)
    if effective in ("HEADWIND", "PANIC"):
        return f"ADDS BLOCKED — {effective}"
    return "ADDS OK"


# --- 7.3 delta ----------------------------------------------------------------


def delta_signal(rc: RankedCard, name_wt: float, expressions: int) -> str | None:
    """The spec's table gives qualitative conditions ('High fair, low
    constrained...') with no numeric threshold for high/low. RANK is a
    signed quantity (metric x a <=1.00 multiplier) -- its OWN sign is the
    natural, threshold-free reading of 'high' (expected to beat target,
    positive) vs 'low' (not, non-positive), so that is what this uses,
    rather than inventing an arbitrary cutoff the spec never gave."""
    if rc.rank_fair is None or rc.rank_constrained is None:
        return None

    fair_high = rc.rank_fair > 0
    constrained_high = rc.rank_constrained > 0
    held = name_wt > 0
    over_cap = name_wt > MAX_CAP_PCT

    if fair_high and not constrained_high and expressions > 1:
        return "RESTRUCTURE"
    if not fair_high and not constrained_high and held and over_cap:
        return "TRIM"
    if fair_high and constrained_high and not held:
        return "ADD_CANDIDATE"
    if not fair_high and constrained_high:
        return "REVIEW_FIT_INPUT"
    return None


# --- 7.1 VALUATION GAP ---------------------------------------------------------


def _hinge_tally(card: Card) -> tuple[int, int, int]:
    g = sum(1 for h in card.hinges if h.state == "green")
    a = sum(1 for h in card.hinges if h.state == "amber")
    r = sum(1 for h in card.hinges if h.state == "red")
    return g, a, r


def format_valuation_gap(board: list[tuple[int, RankedCard]], today: date) -> list[dict]:
    rows = []
    for rank, rc in board:
        g, a, r = _hinge_tally(rc.card)
        rows.append({
            "rank": rank,
            "sym": rc.symbol,
            "book_tier": rc.book_tier or "-",
            "comp_tier": rc.tier,
            "tier_mismatch": rc.tier_mismatch,
            "lens": rc.card.lens,
            "composite": rc.card.composite,
            "pct_per_yr": rc.metric if rc.annualised else None,
            "abs_return": rc.metric if not rc.annualised else None,
            "entry": rc.card.entry.state,
            "hinges": f"{g}g/{a}a/{r}r",
            "run_age_days": (today - rc.card.run_date).days,
        })
    return rows


# --- 7.2 FUNDING PRIORITY -------------------------------------------------------


@dataclass(frozen=True)
class ForcedRow:
    symbol: str
    line: str


def _forced_line(symbol: str, name_wt: float, override: Override | None, today: date) -> str | None:
    over_cap = name_wt > MAX_CAP_PCT
    if not over_cap:
        return None
    if override is None:
        pts_over = (name_wt - MAX_CAP_PCT) * 100
        return f"TRIM REQUIRED · {pts_over:.1f}pts over · to cap"
    days_left = (override.expiry_date - today).days
    if days_left < 0:
        return "OVERRIDE EXPIRED · RE-PAPER OR TRIM"
    return f"OVERRIDE ACTIVE · expires {override.expiry_date} · {days_left}d left"


def format_funding_priority(
    board: list[tuple[int, RankedCard]], holdings: Holdings, today: date
) -> dict:
    forced: list[ForcedRow] = []
    discretionary: list[dict] = []
    for rank, rc in board:
        name_wt = holdings.weight(rc.symbol)
        line = _forced_line(rc.symbol, name_wt, rc.card.override, today)
        if line is not None:
            forced.append(ForcedRow(rc.symbol, line))
        else:
            discretionary.append({"rank": rank, "sym": rc.symbol, "rank_constrained": rc.rank_constrained})
    # discretionary sorted ASCENDING by rank_constrained -- lowest expected
    # return funds first (the dollar comes from the weakest name).
    discretionary.sort(key=lambda r: r["rank_constrained"])
    return {"forced": forced, "discretionary": discretionary}


# --- 7.4 NEAR-TERM ---------------------------------------------------------------


def format_near_term(board: list[tuple[int, RankedCard]]) -> list[dict]:
    return [
        {
            "rank": rank,
            "sym": rc.symbol,
            # header MUST read "absolute return to horizon", never "%/yr" --
            # near-term metrics are section 4.6's un-annualised branch.
            "absolute_return_to_horizon": rc.metric,
            "days_to_horizon": rc.days_to_horizon,
        }
        for rank, rc in board
    ]


# --- 7.6 overrides ----------------------------------------------------------------


def override_status(override: Override, today: date) -> str:
    days_left = (override.expiry_date - today).days
    if days_left < 0:
        return "RED — EXPIRED — RE-PAPER QUEUE"
    if days_left <= 45:
        return f"AMBER — {days_left}d to expiry"
    return f"GREEN — {days_left}d to expiry"


# --- 7.7 binary panel -------------------------------------------------------------


def format_binary_panel(entries: list[RankedCard], today: date) -> list[dict]:
    rows = []
    for rc in entries:
        if rc.card is None or rc.card.next_binary is None:
            continue
        days = (rc.card.next_binary - today).days
        rows.append({
            "sym": rc.symbol,
            "date": rc.card.next_binary,
            "days": days,
            "event": "earnings" if rc.card.next_binary == rc.card.next_earnings_date else "binary",
            "bucket": rc.bucket,
        })
    rows.sort(key=lambda r: r["days"])
    return rows


# --- assembled report --------------------------------------------------------------


def render_report(
    entries: list[RankedCard],
    holdings: Holdings,
    today: date,
    status: ReadoutStatus,
    asserted_regime: str | None = None,
) -> str:
    lines: list[str] = []
    lines.append(status_bar(status, asserted_regime))
    lines.append("")

    fair = ranked_board_fair(entries)
    lines.append("=== VALUATION GAP (merit) ===")
    for row in format_valuation_gap(fair, today):
        metric = row["pct_per_yr"]
        metric_s = f"{metric*100:.1f}%/yr" if metric is not None else "n/a"
        mismatch = " [TIER_MISMATCH]" if row["tier_mismatch"] else ""
        lines.append(
            f"  #{row['rank']:<3} {row['sym']:<6} {row['book_tier']}/{row['comp_tier']}{mismatch} "
            f"{row['lens']:<3} {row['composite']:.2f} {metric_s:>10} {row['entry']:<18} "
            f"{row['hinges']:<10} {row['run_age_days']}d"
        )

    constrained = ranked_board_constrained(entries)
    funding = format_funding_priority(constrained, holdings, today)
    lines.append("")
    lines.append("=== FUNDING PRIORITY (allocation) ===")
    lines.append("  -- forced --")
    for f in funding["forced"]:
        lines.append(f"  {f.symbol:<6} {f.line}")
    lines.append("  -- discretionary (ascending, weakest first) --")
    for row in funding["discretionary"]:
        lines.append(f"  #{row['rank']:<3} {row['sym']:<6} {row['rank_constrained']*100:.2f}")

    near = near_term_board(entries)
    lines.append("")
    lines.append("=== NEAR-TERM (absolute return to horizon) ===")
    for row in format_near_term(near):
        r = row["absolute_return_to_horizon"]
        r_s = f"{r*100:.1f}%" if r is not None else "n/a"
        lines.append(f"  #{row['rank']:<3} {row['sym']:<6} {r_s:>8}  ({row['days_to_horizon']}d out)")

    binaries = format_binary_panel(entries, today)
    lines.append("")
    lines.append("=== BINARY CALENDAR ===")
    for row in binaries:
        lines.append(f"  {row['sym']:<6} {row['date']}  ({row['days']}d)  {row['event']:<10} [{row['bucket']}]")

    unrank = unrankable(entries)
    if unrank:
        lines.append("")
        lines.append(f"=== CANNOT RANK ({len(unrank)}) ===")
        for rc in unrank:
            lines.append(f"  {rc.symbol:<6} {rc.unrankable_reason}")

    return "\n".join(lines)
