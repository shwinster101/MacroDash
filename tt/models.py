"""
tt.models -- the TT Card schema v2.0 (spec section 2), as Pydantic v2 models.

Scope discipline: this module does PURE STRUCTURAL validation only -- types,
enums, numeric ranges that don't depend on "today" or another field. Anything
that needs `today` (run_date <= today), needs comparing two fields
(pt_model.horizon > run_date), or is a soft heuristic (return_type vs basis
text) lives in tt.validate, which runs AFTER a card parses here. That split
keeps this file a straightforward, static description of the wire format --
see tt.validate for the reject/warn/collision rules spelled out in section 3.

THE OWNERSHIP CONTRACT (spec section 0) is enforced by simple absence: this
schema has no field for gate_multiplier, fit/fit.score, timing.blocked,
quote, nds_fair, nds_constrained, or tier_computed. All of those are
terminal-derived (tt.derive) and must never be chat-emitted. `extra="allow"`
at the top level means a card CARRYING one of those fields still parses
(spec section 3: "Warn (accept): deprecated derived fields present") --
tt.validate.check_deprecated_fields() is what turns that into a warning.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from tt.config import CORRELATION_CLUSTERS, GATE_TAGS, SCHEMA_VERSION

SYMBOL_RE = re.compile(r"^[A-Z.\-]{1,10}$")
GATE_KEY_RE = re.compile(r"^G[1-4]$")

RunType = Literal["DEEP", "RE", "SCREEN"]
Lens = Literal["AI", "PH", "QC", "VEH", "SP"]
WeightsUsed = Literal["STANDARD", "R3A", "LENS_MERIT"]
GateStatus = Literal["PASS", "FLAG", "FAIL"]
GateTag = Optional[Literal["valuation_breach", "filing_integrity", "credit_downgrade"]]
ReturnType = Literal["price_only", "total_return"]

# section 4.2 -- the entry-state lookup table's key set IS the enum.
EntryState = Literal[
    "confirmed_support",
    "at_support",
    "relative_strength",
    "mid_range",
    "extended",
    "broken_no_base",
    "failed_breakout",
]

# [MACRODASH]-grounded: admin.html's validateDeepDive uses green/amber/red/unknown
# for hinge state; the spec's hinges example ("state":"amber") is consistent with it
# and defines no enum of its own, so this is reused rather than invented.
HingeState = Literal["green", "amber", "red", "unknown"]


class Gate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: GateStatus
    hard_stop: bool = False
    tag: GateTag = None
    note: str = ""


class Pillars(BaseModel):
    model_config = ConfigDict(extra="forbid")

    V: int = Field(ge=0, le=10)
    G: int = Field(ge=0, le=10)
    P: int = Field(ge=0, le=10)
    M: int = Field(ge=0, le=10)
    R: int = Field(ge=0, le=10)


class Entry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: EntryState
    support: Optional[float] = None
    resistance: Optional[float] = None


class PtModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: float = Field(gt=0)
    horizon: date
    basis: str = Field(min_length=1)
    return_type: ReturnType


class Override(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: str = Field(min_length=1)
    size_limit_pct: float = Field(gt=0, le=100)
    review_trigger: str = Field(min_length=1)
    expiry_date: date


class Hinge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    state: HingeState
    test: str = ""


class Card(BaseModel):
    """The wire schema. Parse with Card.model_validate(payload); a raised
    pydantic.ValidationError from this alone covers most of section 3's
    REJECT list (missing field, wrong type, unknown enum, out-of-range
    numeric, hard_stop-on-non-FAIL). Anything date-relative or cross-field
    still needs tt.validate.semantic_check() afterwards."""

    model_config = ConfigDict(extra="allow")  # deprecated fields WARN, not reject (section 3)

    schema_version: str
    symbol: str
    run_date: date
    run_type: RunType
    lens: Lens
    composite: float = Field(ge=0, le=10)
    pillars: Pillars
    weights_used: WeightsUsed
    gates: dict[str, Gate] = Field(min_length=1)
    entry: Entry
    correlation_cluster: str
    pt_model: Optional[PtModel] = None
    next_binary: Optional[date] = None
    next_earnings_date: Optional[date] = None
    override: Optional[Override] = None
    hinges: list[Hinge] = Field(default_factory=list)
    thesis: str = Field(min_length=1)
    flags: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)

    @field_validator("schema_version")
    @classmethod
    def _schema_version_matches(cls, v: str) -> str:
        if v != SCHEMA_VERSION:
            raise ValueError(f"schema_version {v!r} != {SCHEMA_VERSION!r}")
        return v

    @field_validator("symbol")
    @classmethod
    def _symbol_shape(cls, v: str) -> str:
        if not SYMBOL_RE.match(v):
            raise ValueError(f"bad symbol {v!r} (want ^[A-Z.\\-]{{1,10}}$)")
        return v

    @field_validator("correlation_cluster")
    @classmethod
    def _cluster_known(cls, v: str) -> str:
        if v not in CORRELATION_CLUSTERS:
            raise ValueError(f"unknown correlation_cluster {v!r}")
        return v

    @field_validator("gates")
    @classmethod
    def _gate_keys(cls, v: dict[str, Gate]) -> dict[str, Gate]:
        for k in v:
            if not GATE_KEY_RE.match(k):
                raise ValueError(f"bad gate key {k!r} (want G1..G4)")
        return v

    @model_validator(mode="after")
    def _hard_stop_only_on_fail(self) -> "Card":
        for key, g in self.gates.items():
            if g.hard_stop and g.status != "FAIL":
                raise ValueError(f"gate {key}: hard_stop=true on a non-FAIL gate ({g.status})")
            if g.tag is not None and g.tag not in GATE_TAGS:
                # Unreachable given the Literal type, but keeps the invariant
                # explicit and self-documenting if GateTag's Literal ever drifts.
                raise ValueError(f"gate {key}: tag {g.tag!r} not in {sorted(GATE_TAGS)}")
        return self
