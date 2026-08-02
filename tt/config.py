"""
tt.config — configuration constants (TT <-> TERMINAL INTEGRATION SPEC v2.0, section 1).

PROVENANCE, READ BEFORE EDITING:

Values tagged [SPEC] come verbatim from the spec text. Values tagged
[MACRODASH] are grounded in the real ruling document that already exists in
the MacroDash repo (ticker-terminal/TT_TICKER_TERMINAL.md) -- the only actual
ruling text available when this was built. The spec's section 1 and section 9
reference four rulings by name -- R-P1, R-P3, R6-C4, R3A -- that do not exist
anywhere in the MacroDash repo (which uses its own R1-R5 / DEC-## / FEAT-##
vocabulary) and were not retrievable from the referenced Claude-Project
"stonks" folder in this build environment (no tool in this session can reach
Claude.ai Project files, and the user's Drive lookup was not completed).

Rather than invent numbers, each affected constant below is either fully
spec-explicit (needs no ruling text) or documented as an [ASSUMPTION] with the
real-world anchor it was drawn from. Replace any [ASSUMPTION] the moment the
real ruling text is available -- every one is isolated to this file.
"""

from __future__ import annotations

from typing import Final

SCHEMA_VERSION: Final[str] = "2.0"  # reject cards not matching

MAX_CAP_PCT: Final[float] = 0.18  # [SPEC] single-position hard cap (book standing rule)
CLUSTER_SOFT_CAP: Final[float] = 0.25  # [SPEC] correlation-cluster weight before penalty
BINARY_BLOCK_DAYS: Final[int] = 10  # [SPEC] no adds inside this window
CARD_TTL_DAYS: Final[int] = 90  # [SPEC] hard staleness ceiling
NEAR_TERM_DAYS: Final[int] = 90  # [SPEC] below this, do NOT annualise

# [SPEC] R6-C4: auto-expiry <= 2 quarters. This is the one referenced ruling
# whose EFFECT the spec states directly ("R6-C4: auto-expiry <= 2 quarters"),
# so it needs no external lookup -- 183 days is simply 2 quarters.
OVERRIDE_MAX_DAYS: Final[int] = 183

MULT_FLOOR: Final[float] = 0.15  # [SPEC] floor on compounded multiplier
FIT_FLOOR: Final[float] = 0.50  # [SPEC]
QUOTE_MAX_AGE_MIN: Final[int] = 20  # [SPEC] during market hours
TIMEZONE: Final[str] = "America/New_York"  # [SPEC] ALL dates are ET calendar dates

# --- OPEN-1: weight denominator -------------------------------------------
# Spec: "tracked_book (a floor, NAV unmeasured) vs NAV vs gross ... Book
# ruling R-P1 recommends % of NAV. Until resolved, all cap/fit output is
# advisory -- banner must say so."
#
# R-P1's actual text was not retrievable. MacroDash's own TT terminal
# (public/admin.html, rankWeight()) already answers this exact question, for
# the same underlying reason: NAV is not a measured quantity there either.
# CLAUDE.md, FEAT-TT-POS: "mv is equity-only ... a FLOOR, not the account."
# Same call here, and for the same reason, until real NAV telemetry exists.
WEIGHT_DENOMINATOR: Final[str] = "tracked_book"  # [ASSUMPTION -- see note above]
# Spec's own consequence of NOT resolving OPEN-1: every cap/fit-derived
# number must render as advisory, not authoritative, until R-P1 is real.
WEIGHT_DENOMINATOR_ADVISORY: Final[bool] = True

# --- OPEN-2: count_expressions() definition --------------------------------
# Spec gives the underlier-complex resolution directly, with worked examples,
# so this needs no external ruling text at all -- it is fully spec-explicit:
# "shares + LEAPs + leveraged wrappers + short legs (NBIS+NEBX; JOBY+JOBX
#  +LEAPs+puts; NVDA-via-NVDL/MAGX/MAGS; CRDO-via-CRDU; LITE-via-LITX)."
#
# UNDERLIER_COMPLEX maps a canonical underlier to every ticker that expresses
# exposure to the SAME name (leveraged wrappers, related share classes).
# LEAPs/puts on the underlier itself are counted separately, per POSITION LEG
# (see holdings.py), not as a second symbol -- a JOBY holder with a JOBY put
# has 2 expressions of JOBY even though only "JOBY" appears as a symbol.
UNDERLIER_COMPLEX: Final[dict[str, frozenset[str]]] = {
    "NBIS": frozenset({"NBIS", "NEBX"}),
    "JOBY": frozenset({"JOBY", "JOBX"}),
    "NVDA": frozenset({"NVDA", "NVDL", "MAGX", "MAGS"}),
    "CRDO": frozenset({"CRDO", "CRDU"}),
    "LITE": frozenset({"LITE", "LITX"}),
}

# --- weights_used profiles --------------------------------------------------
# Composite = weighted sum of the V/G/P/M/R pillars (spec section 2).
#
# STANDARD is [MACRODASH]-grounded: ticker-terminal/TT_TICKER_TERMINAL.md
# line 72-73 -- "P1 Valuation 20% - P2 Growth 25% - P3 Profitability 20% -
# P4 Momentum 20% - P5 Revisions 15%. Composite = weighted sum." -- maps
# directly onto this spec's V/G/P/M/R pillar keys (Valuation/Growth/
# Profitability/Momentum/Revisions), the only pillar weighting that exists
# anywhere in retrievable source material.
#
# R3A and LENS_MERIT are named in the spec's weights_used enum with no
# weights of their own given anywhere retrievable. They are seeded IDENTICAL
# to STANDARD -- a safe, inert default: composite math is correct today for
# every card regardless of which profile is stamped on it -- and marked
# [ASSUMPTION] so a real R3A/LENS_MERIT weighting can be dropped in later
# without touching any call site.
PILLAR_WEIGHTS: Final[dict[str, dict[str, float]]] = {
    "STANDARD": {"V": 0.20, "G": 0.25, "P": 0.20, "M": 0.20, "R": 0.15},  # [MACRODASH]
    "R3A": {"V": 0.20, "G": 0.25, "P": 0.20, "M": 0.20, "R": 0.15},  # [ASSUMPTION := STANDARD]
    "LENS_MERIT": {"V": 0.20, "G": 0.25, "P": 0.20, "M": 0.20, "R": 0.15},  # [ASSUMPTION := STANDARD]
}

# --- tier map ----------------------------------------------------------------
# [MACRODASH] ticker-terminal/TT_TICKER_TERMINAL.md line 76: "≥8.5 → S ·
# 7.0-8.4 → A · 5.5-6.9 → B (conditional...) · <5.5 → C/Avoid" -- matches
# spec section 4.4 exactly (">=8.5 -> S ; 7.0-8.49 -> A ; 5.5-6.99 -> B ;
# <5.5 -> C"). Ordered highest-first; first matching floor wins.
TIER_BOUNDARIES: Final[tuple[tuple[float, str], ...]] = (
    (8.5, "S"),
    (7.0, "A"),
    (5.5, "B"),
    (0.0, "C"),
)

# Gate tag vocabulary a FAIL may carry (section 3 validation).
GATE_TAGS: Final[frozenset[str]] = frozenset(
    {"valuation_breach", "filing_integrity", "credit_downgrade"}
)

CORRELATION_CLUSTERS: Final[frozenset[str]] = frozenset(
    {
        "ai_capex_compute",
        "ai_capex_foundry",
        "ai_capex_memory",
        "ai_capex_optical",
        "ai_capex_energy",
        "ai_capex_thermal",
        "neocloud",
        "physical_ai_evtol",
        "physical_ai_av",
        "physical_ai_robotics",
        "physical_ai_defense",
        "physical_ai_space",
        "latam_fintech",
        "us_fintech",
        "consumer_internet",
        "consumer_staples",
        "strategic_materials",
        "semis_analog",
        "megacap_index",
        "healthcare",
        "other",
    }
)
