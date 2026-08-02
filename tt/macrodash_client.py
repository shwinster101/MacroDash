"""
tt.macrodash_client -- integrates tt-engine with MacroDash's LIVE, PIN-gated
KV-backed TT Ticker Terminal API, so `python -m tt.rank` can read the real
book tier, real measured positions, and real quotes instead of requiring a
second, hand-maintained copy in roster.json/holdings.json/quotes.json.

Endpoints used (all read-only GETs; nothing here ever writes to MacroDash):
  GET /api/tt          -- functions/api/tt.js        -> book tier per symbol
  GET /api/positions   -- functions/api/positions.js -> measured pos per symbol
  GET /api/quotes      -- functions/api/quotes.js     -> live Finnhub quotes

AUTH -- the "automation path", not a workaround:
  MacroDash's own CLAUDE.md describes the x-tt-pin header explicitly as
  "the automation path that unlocks future chat-side sync" -- this client
  IS that sync, not something bolted on sideways. The PIN is read ONLY from
  the TT_PIN environment variable: never a CLI argument (would land in
  shell history), never written to any file this repo tracks.

  DO NOT GUESS THE PIN. MacroDash's escalating lockout (tt.js: 5 fails ->
  15 min, 10 fails -> 24h) applies to every wrong x-tt-pin the same as a
  wrong login -- a bad guess here locks the owner out of their own
  terminal. If TT_PIN is unset or a call 401/403s, this client raises
  MacrodashAuthError and stops; it never retries with a different value.

UNITS -- confirmed against the real source, not assumed:
  MacroDash's pos.pct is a PERCENT in [0, 100] (functions/api/tt.js's
  validatePos bands it 0..100). tt-engine's HoldingRecord.pct is a FRACTION
  in [0, 1] (tt/holdings.py, tt/config.py's WEIGHT_DENOMINATOR). This
  module divides by 100 at the one boundary crossing -- get that wrong and
  every cap-breach check silently reads 100x off.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

DEFAULT_BASE_URL = "https://macrodash.pages.dev"
MAX_QUOTE_SYMS = 40  # mirrors quotes.js's own MAX_SYMS -- this client batches above it


class MacrodashAuthError(Exception):
    """TT_PIN missing, or MacroDash rejected it (401/403). Never retried
    automatically -- see the lockout warning in this module's docstring."""


class MacrodashClient:
    def __init__(
        self, base_url: str = DEFAULT_BASE_URL, pin: str | None = None, timeout: float = 15.0
    ):
        self.base_url = base_url.rstrip("/")
        # pin=None (the default) reads TT_PIN at call time via os.environ,
        # not at construction time, so a test can monkeypatch the env var
        # around a client built earlier in the same process.
        self._pin_override = pin
        self.timeout = timeout

    @property
    def pin(self) -> str | None:
        return self._pin_override if self._pin_override is not None else os.environ.get("TT_PIN")

    def _get(self, path: str) -> dict:
        pin = self.pin
        if not pin:
            raise MacrodashAuthError(
                "TT_PIN is not set. export TT_PIN=<your 6-digit PIN> before running anything "
                "that talks to MacroDash's live book/positions/quotes. Never pass it as a CLI "
                "argument or paste it into chat -- only the environment variable."
            )
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            headers={"accept": "application/json", "x-tt-pin": pin, "user-agent": "tt-engine/2.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise MacrodashAuthError(
                    f"MacroDash rejected the PIN ({e.code}) for {path} -- STOP, do not retry "
                    f"with a different value (escalating lockout: 5 fails=15min, 10=24h)."
                ) from e
            raise

    def get_book(self) -> dict:
        """Raw GET /api/tt: {version, asOf, book: [...], cut, board, empty, auth}."""
        return self._get("/api/tt")

    def get_positions(self) -> dict:
        """Raw GET /api/positions: {asOf, positions: {sym: pos}}."""
        return self._get("/api/positions")

    def get_quotes(self, symbols: list[str]) -> dict:
        """Raw GET /api/quotes?syms=...: {quotes, asOf, requested, missing}.
        Batches transparently above MAX_QUOTE_SYMS -- quotes.js itself caps
        a single request at 40, unrelated to this client's own choices."""
        uniq = sorted({s.upper() for s in symbols})
        if not uniq:
            return {"quotes": {}, "asOf": None, "requested": 0, "missing": []}
        merged = {"quotes": {}, "asOf": None, "requested": 0, "missing": []}
        for i in range(0, len(uniq), MAX_QUOTE_SYMS):
            batch = uniq[i : i + MAX_QUOTE_SYMS]
            resp = self._get(f"/api/quotes?syms={','.join(batch)}")
            merged["quotes"].update(resp.get("quotes") or {})
            merged["missing"].extend(resp.get("missing") or [])
            merged["requested"] += resp.get("requested") or 0
            merged["asOf"] = resp.get("asOf") or merged["asOf"]
        return merged


# --- book -> roster (book-tier axis only) -------------------------------------

# MacroDash's book tier (tt.js: TIERS = ["S","A","B","DEF","WATCH"]) is a
# DIFFERENT axis than tt-engine's roster (S/A/B/C -- a quality grade meant
# to compare against tt.derive.tier_from_composite, spec section 4.4). DEF
# ("deferred/tactical") and WATCH ("not held, watchlist") are STATUS flags,
# not quality claims, so mapping them onto a quality scale would assert a
# grade nobody gave:
#   S -> S, A -> A, B -> B   direct -- same meaning on both scales
#   DEF -> C                 closest available "deprioritized" reading
#   WATCH -> excluded        not a grade; nothing to compare tier_mismatch against
_BOOK_TIER_TO_ROSTER = {"S": "S", "A": "A", "B": "B", "DEF": "C"}


def roster_from_book(book_json: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for entry in book_json.get("book") or []:
        sym = str(entry.get("sym", "")).upper()
        tier = _BOOK_TIER_TO_ROSTER.get(entry.get("tier"))
        if sym and tier:
            out[sym] = tier
    return out


# --- positions -> holdings -------------------------------------------------------


def holdings_from_positions(positions_json: dict):
    from tt.holdings import Holdings, HoldingRecord

    records: dict[str, HoldingRecord] = {}
    for sym, pos in (positions_json.get("positions") or {}).items():
        if pos is None:
            continue
        pct_0_100 = pos.get("pct")
        if pct_0_100 is None:
            continue  # unmeasured weight -- never invented as a 0 (tt.js's own doctrine)
        legs = 1 + len(pos.get("opt") or [])  # shares (if any) + each option leg
        records[sym.upper()] = HoldingRecord(pct=float(pct_0_100) / 100.0, legs=legs)
    return Holdings(as_of=positions_json.get("asOf"), records=records)


# --- quotes -> QuoteMeta -------------------------------------------------------


def is_market_open_et(now: datetime) -> bool:
    """A DELIBERATE approximation: weekday + 9:30am-4:00pm ET, no market-
    holiday calendar. MacroDash's real calendar (src/sources.js,
    MARKET_HOLIDAYS) is JS-only and needs its own annual maintenance
    (CLAUDE.md says so directly) -- porting it here would be a second copy
    of that exact upkeep burden for a single edge case a few days a year.
    On a holiday this reads 'open' and simply demands a fresher quote than
    a holiday would actually produce: it fails toward STRICTER, not looser,
    which is the safe direction for a check that gates real orders."""
    et = now.astimezone(ZoneInfo("America/New_York"))
    if et.weekday() >= 5:
        return False
    minutes = et.hour * 60 + et.minute
    return 9 * 60 + 30 <= minutes < 16 * 60


def quotes_from_live(quotes_json: dict, now: datetime | None = None) -> dict:
    from tt.rank import QuoteMeta

    now = now or datetime.now(timezone.utc)
    market_open = is_market_open_et(now)
    out: dict[str, QuoteMeta] = {}
    for sym, q in (quotes_json.get("quotes") or {}).items():
        px = q.get("px")
        at_s = q.get("at")
        if px is None or at_s is None:
            continue
        try:
            at = datetime.fromisoformat(at_s.replace("Z", "+00:00"))
            if at.tzinfo is None:
                at = at.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        age_min = (now - at).total_seconds() / 60.0
        out[sym.upper()] = QuoteMeta(
            live_price=float(px),
            market_open=market_open,
            age_min=age_min if market_open else None,
            # quotes.js falls back to Finnhub's own last trade outside market
            # hours, which IS the latest official close in that state.
            is_latest_close=not market_open,
        )
    return out
