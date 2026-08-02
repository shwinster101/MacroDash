"""
tt.derive -- section 4, ALL TERMINAL-COMPUTED VALUES.

Ownership contract (spec section 0): everything in this file is exactly the
set of things chat must never emit -- CAGR, multipliers, tier, eligibility,
weights, staleness. Every function here is pure (data in, data out); the
only "current time" dependency is an explicit `today: date` parameter, never
an internal clock read, so every formula is independently testable frozen
at any instant.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable

from tt.config import (
    CARD_TTL_DAYS,
    CLUSTER_SOFT_CAP,
    FIT_FLOOR,
    MAX_CAP_PCT,
    MULT_FLOOR,
    NEAR_TERM_DAYS,
    PILLAR_WEIGHTS,
    QUOTE_MAX_AGE_MIN,
    TIER_BOUNDARIES,
)
from tt.holdings import Holdings
from tt.models import Card, PtModel


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


# --- 4.1 gate multiplier ----------------------------------------------------


@dataclass(frozen=True)
class GateResult:
    gate_mult: float
    eligible: bool
    reason: str  # human-readable, for §7 render / debugging


def override_valid(card: Card, today: date) -> bool:
    """section 4.1 helper. An override with no expiry_date in the future is
    not a live override -- it is exactly as inert as no override at all."""
    return card.override is not None and card.override.expiry_date >= today


def gate_multiplier(card: Card, today: date) -> GateResult:
    fails = [g for g in card.gates.values() if g.status == "FAIL"]
    flags = [g for g in card.gates.values() if g.status == "FLAG"]

    if any(g.hard_stop or g.tag for g in fails):
        return GateResult(0.30, False, "hard_stop or tagged FAIL present")
    if len(fails) >= 2:
        return GateResult(0.30, False, f"{len(fails)} gate FAILs (>=2)")
    if len(fails) == 1:
        if override_valid(card, today):
            return GateResult(0.60, True, "1 FAIL, valid override")
        return GateResult(0.60, False, "1 FAIL, no valid override")

    gate_mult = {0: 1.00, 1: 0.85}.get(len(flags), 0.75)
    return GateResult(gate_mult, True, f"{len(flags)} FLAG(s), 0 FAIL")


# --- 4.2 entry multiplier ----------------------------------------------------

ENTRY_MULTIPLIER: dict[str, float] = {
    "confirmed_support": 1.00,
    "at_support": 0.85,
    "relative_strength": 0.75,
    "mid_range": 0.60,
    "extended": 0.40,
    "broken_no_base": 0.30,
    "failed_breakout": 0.15,
}


def entry_multiplier(state: str) -> float:
    try:
        return ENTRY_MULTIPLIER[state]
    except KeyError as e:
        raise ValueError(f"unknown entry.state {state!r}") from e


# --- 4.3 correlation clusters & fit multiplier ------------------------------


def fit_multiplier(
    symbol: str,
    cluster: str,
    holdings: Holdings,
    cluster_of: Callable[[str], str | None],
) -> float:
    """`cluster_of(other_symbol)` resolves another HELD symbol's own
    correlation_cluster (read from ITS card, not from holdings.json -- cluster
    is a chat judgment that lives on the card, holdings.json only knows
    weights). A held symbol with no card on file / no cluster known
    contributes nothing to cluster_wt rather than crashing the rank."""
    cluster_wt = sum(
        w for sym, w in holdings.all_weights().items() if cluster_of(sym) == cluster
    )
    name_wt = holdings.weight(symbol)
    expressions = holdings.expressions(symbol)

    cluster_f = (
        1.00
        if cluster_wt <= CLUSTER_SOFT_CAP
        else clamp(1 - (cluster_wt - CLUSTER_SOFT_CAP) * 2.0, 0.60, 1.00)
    )
    redund_f = 1.00 if expressions <= 1 else max(0.60, 1 - 0.15 * (expressions - 1))
    cap_f = (
        1.00
        if name_wt <= MAX_CAP_PCT
        else max(0.50, 1 - (name_wt - MAX_CAP_PCT) / MAX_CAP_PCT)
    )

    return clamp(cluster_f * redund_f * cap_f, FIT_FLOOR, 1.00)


# --- 4.4 tier (derived from composite -- NEVER chat-emitted) ----------------


def tier_from_composite(composite: float) -> str:
    for floor, tier in TIER_BOUNDARIES:
        if composite >= floor:
            return tier
    return TIER_BOUNDARIES[-1][1]  # unreachable (last floor is 0.0) but explicit


def weighted_composite(pillars_dict: dict[str, int], weights_used: str) -> float:
    """An alternative to trusting the chat-supplied `composite` field
    verbatim: recompute it from pillars + the named weight profile. Exposed
    so callers/tests can cross-check a card's stated composite against the
    weights it claims to use; tt.rank uses the STATED composite (display),
    per spec section 2 ("composite ... DISPLAY + tier only")."""
    weights = PILLAR_WEIGHTS[weights_used]
    return sum(pillars_dict[k] * weights[k] for k in weights)


def tier_mismatch(computed_tier: str, book_tier: str | None) -> bool:
    """spec 4.4: 'when the two disagree, render both and surface a
    TIER_MISMATCH badge.' No book_tier on file is not a mismatch -- there is
    nothing to disagree WITH (spec's own live example, JOBY, has a book
    tier; an un-rostered name simply has none yet)."""
    return book_tier is not None and book_tier != computed_tier


# --- 4.5 staleness -----------------------------------------------------------


def is_stale(card: Card, today: date) -> bool:
    """Red hinges force a RE-RUN rather than adjusting the math -- this
    deliberately avoids a second parallel scoring system alongside gates
    (spec's own stated reasoning, preserved verbatim here as the docstring
    for why a red hinge appears in a staleness check at all)."""
    if today > card.run_date + timedelta(days=CARD_TTL_DAYS):
        return True
    if (
        card.next_earnings_date is not None
        and card.next_earnings_date < today
        and card.run_date < card.next_earnings_date
    ):
        return True
    if any(h.state == "red" for h in card.hinges):
        return True
    return False


# --- 4.6 return math ----------------------------------------------------------


@dataclass(frozen=True)
class ReturnResult:
    metric: float | None  # CAGR (fraction) if annualised, absolute return if near-term
    annualised: bool
    bucket_hint: str | None  # "PENDING" when horizon has lapsed
    flag: str | None  # horizon_lapsed | horizon_imminent | invalid_price | None
    days: int


def return_metric(pt_model: PtModel, live_price: float, today: date) -> ReturnResult:
    """Always uses the LIVE price, never a stamped mark -- so ranking
    refreshes as prices move without re-running cards (spec's own emphasis,
    preserved). `return_type` does not change this math; it only declares
    whether the chat's target already embeds distributions (see
    tt.validate's total_return/basis cross-check, which is where that
    distinction is actually enforced)."""
    days = (pt_model.horizon - today).days

    if live_price <= 0:
        return ReturnResult(None, False, None, "invalid_price", days)

    if days <= 0:
        return ReturnResult(None, False, "PENDING", "horizon_lapsed", days)

    if days <= NEAR_TERM_DAYS:
        metric = pt_model.target / live_price - 1  # ABSOLUTE, not annualised
        return ReturnResult(metric, False, None, "horizon_imminent", days)

    metric = (pt_model.target / live_price) ** (365.25 / days) - 1  # CAGR
    return ReturnResult(metric, True, None, None, days)


# --- 4.7 quote freshness ------------------------------------------------------


def quote_is_live(market_open: bool, age_min: float | None, is_latest_close: bool) -> bool:
    if market_open:
        return age_min is not None and age_min <= QUOTE_MAX_AGE_MIN
    return is_latest_close


# --- effective multiplier (feeds section 6 ranking directly) ----------------


def effective_multiplier(gate_mult: float, entry_mult: float, fit_mult: float) -> float:
    """section 6: 'All multipliers are discounts capped at 1.00 -- a good
    entry improves the odds of realising a target, it does not raise the
    target.' The MULT_FLOOR clamp lives here so both RANK_fair and
    RANK_constrained (tt.rank) apply it identically rather than each
    re-deriving the floor."""
    return max(MULT_FLOOR, gate_mult * entry_mult * fit_mult)
