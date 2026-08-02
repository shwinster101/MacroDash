"""
tt.validate -- section 3 validation: everything Pydantic structural typing
(tt.models) can't express declaratively, plus the reject/warn split and the
field-level diff the ingest pipeline (tt.ingest) shows the chat for re-emit.

Two passes, always in this order:
  1. tt.models.Card.model_validate(payload)  -- structural (raises on reject)
  2. tt.validate.semantic_check(card)        -- date-relative / cross-field
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from tt.config import OVERRIDE_MAX_DAYS, TIMEZONE
from tt.models import Card

# section 2, "Removed vs earlier drafts (all derivable -- do not accept if
# present; warn)". `fit`/`timing` are the nested-object cases (fit.score,
# timing.blocked); presence of the PARENT key is enough to warn -- a card
# with an empty {} under `fit` is still emitting a field this schema forbids
# chat from owning.
DEPRECATED_FIELDS = frozenset(
    {"gate_multiplier", "fit", "timing", "quote", "nds_fair", "nds_constrained", "tier_computed"}
)

DIVIDEND_LANGUAGE_RE = re.compile(
    r"\b(dividend|buyback|distribution|repurchase|payout)\b", re.IGNORECASE
)


def today_et(now: datetime | None = None) -> date:
    """The ET CALENDAR date -- not the UTC date, not a naive local date.
    Mirrors MacroDash's etYmd() (src/sources.js), built for the identical
    reason: a UTC-based "today" ages a just-closed session by a full day on
    any runtime west of Greenwich, which is every runtime this CLI runs on."""
    dt = now or datetime.now(tz=ZoneInfo(TIMEZONE))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(TIMEZONE))
    return dt.astimezone(ZoneInfo(TIMEZONE)).date()


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.ok


def semantic_check(card: Card, today: date | None = None) -> ValidationResult:
    """Pass 2: date-relative and cross-field rules Pydantic alone can't
    express (it has no notion of "today", and cross-field checks that don't
    need it already live in Card's model_validator)."""
    today = today or today_et()
    errors: list[str] = []
    warnings: list[str] = []

    if card.run_date > today:
        errors.append(f"run_date {card.run_date} is in the future (today={today})")

    if card.pt_model is not None and card.pt_model.horizon <= card.run_date:
        errors.append(
            f"pt_model.horizon {card.pt_model.horizon} must be after "
            f"run_date {card.run_date}"
        )

    if card.override is not None:
        limit = card.run_date + timedelta(days=OVERRIDE_MAX_DAYS)
        if card.override.expiry_date > limit:
            errors.append(
                f"override.expiry_date {card.override.expiry_date} exceeds "
                f"run_date + {OVERRIDE_MAX_DAYS}d ({limit}) -- R6-C4"
            )

    if card.pt_model is not None and card.pt_model.return_type == "total_return":
        if not DIVIDEND_LANGUAGE_RE.search(card.pt_model.basis):
            errors.append(
                "pt_model.return_type=total_return but basis names no "
                "dividend/buyback/distribution -- state what the target embeds"
            )

    if card.run_type == "DEEP" and not card.sources:
        warnings.append("sources is empty on a DEEP run")
    if card.next_earnings_date is None:
        warnings.append("next_earnings_date is null")

    extra = getattr(card, "model_extra", None) or {}
    present_deprecated = sorted(DEPRECATED_FIELDS & extra.keys())
    if present_deprecated:
        warnings.append(
            "deprecated derived field(s) present (terminal-owned, ignored): "
            + ", ".join(present_deprecated)
        )

    return ValidationResult(ok=not errors, errors=errors, warnings=warnings)


def parse_and_validate(payload: dict, today: date | None = None) -> tuple[Card | None, ValidationResult]:
    """The one entry point tt.ingest calls. Returns (card_or_None, result).
    A structural failure (pydantic) and a semantic failure both come back as
    the same ValidationResult shape, so the caller has one code path."""
    try:
        card = Card.model_validate(payload)
    except ValidationError as e:
        errors = [
            f"{'.'.join(str(p) for p in err['loc']) or '(root)'}: {err['msg']}"
            for err in e.errors()
        ]
        return None, ValidationResult(ok=False, errors=errors)

    result = semantic_check(card, today=today)
    return (card if result.ok else None), result


def format_diff(payload: dict, result: ValidationResult) -> str:
    """Human-readable rejection report -- what tt.ingest prints for the chat
    to read and re-emit a corrected card (spec section 8.4)."""
    sym = payload.get("symbol", "?")
    run_type = payload.get("run_type", "?")
    run_date = payload.get("run_date", "?")
    lines = [f"REJECTED: {sym} {run_type} {run_date}", ""]
    for e in result.errors:
        lines.append(f"  ERROR   {e}")
    for w in result.warnings:
        lines.append(f"  warn    {w}")
    if not result.errors:
        lines.append("  (no structural/semantic errors -- see warnings above)")
    return "\n".join(lines)
