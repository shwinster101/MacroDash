"""
tt.readout -- fetches MacroDash's public /readout.json and turns it into the
tt.render.ReadoutStatus section 7.5's status bar consumes.

The exact response shape below was read directly from MacroDash's own
source (functions/readout.json.js + src/ttReadout.js's buildTtReadout()),
not guessed from the spec text -- the spec references this endpoint only
by name ("MacroDash /readout.json Worker"), so getting the real field names
right required reading the producing side:

{
  "schema": "tt-v1", "as_of": "YYYY-MM-DD"|null, "generated_at": "<ISO8601>",
  "cached": bool,
  "spy": {...}, "vix": {...}, "fear_greed": {...}, "qqq_spy_rs": {...},
  "us10y": {...}, "fed_odds": {...},
  "regime": {
    "verdict": "TAILWIND"|"NEUTRAL"|"HEADWIND"|"PANIC"|"INSUFFICIENT",
    "checks": [...], "available": int, "bullish": int, "bearish": int,
    "panic_inputs": {...}, "raw_verdict": str,
    "downgraded": null | "TAILWIND withheld -- ..."
  },
  "macro_flip": {
    "armed": bool|null, "tripped": bool|null, "evaluable": bool,
    "reason": null | "circuit BLIND -- missing or stale: vix, spy_price",
    "inputs": {...}
  },
  "attribution": [...]
}

No auth: the endpoint is CORS-open and unauthenticated (confirmed from its
own header comment -- "WHY THE PATH: ... this endpoint needs [wildcard
CORS]"), so a plain HTTPS GET from this standalone CLI is exactly how
MacroDash's own maintainer comment (CLAUDE.md: "/readout.json IS Engine 0")
already anticipates it being consumed.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from tt.render import ReadoutStatus

DEFAULT_URL = "https://macrodash.pages.dev/readout.json"
FRESHNESS_WINDOW = timedelta(hours=24)  # section 7.5: "readout fresh (<=24h)"


def to_status(body: dict, now: datetime) -> ReadoutStatus:
    """Pure -- no network. Split out from fetch_status so the conversion
    logic is testable against a fixture body without hitting the network."""
    generated_at = body.get("generated_at")
    fresh = False
    if generated_at:
        try:
            gen = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            if gen.tzinfo is None:
                gen = gen.replace(tzinfo=timezone.utc)
            now_utc = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
            fresh = (now_utc.astimezone(timezone.utc) - gen.astimezone(timezone.utc)) <= FRESHNESS_WINDOW
        except ValueError:
            fresh = False

    regime = (body.get("regime") or {}).get("verdict")
    flip = body.get("macro_flip") or {}
    evaluable = bool(flip.get("evaluable", False))
    tripped = flip.get("tripped")
    # Reuse the readout's own human-readable reason verbatim -- it already
    # names the missing input(s) ("circuit BLIND -- missing or stale: vix");
    # re-deriving that list here would be a second copy of logic that only
    # buildTtReadout (MacroDash's own code) should own.
    missing = None if evaluable else flip.get("reason")

    return ReadoutStatus(
        fresh=fresh,
        regime=regime,
        macro_flip_evaluable=evaluable,
        macro_flip_tripped=tripped,
        missing_field=missing,
        fetch_error=None,
    )


def fetch_status(
    url: str = DEFAULT_URL, timeout: float = 10.0, now: datetime | None = None
) -> ReadoutStatus:
    """Any network or parse failure becomes fetch_error, never a raised
    exception -- section 7.5 is fail-closed by design (a status bar that can
    crash the CLI on a network blip is worse than one that reports blind)."""
    now = now or datetime.now(timezone.utc)
    try:
        # Explicit User-Agent: several CDNs/proxies (Cloudflare included, and
        # confirmed against this endpoint) 403 the default "Python-urllib/x.y"
        # string outright. A real UA is not optional here, not cosmetic.
        req = urllib.request.Request(
            url, headers={"accept": "application/json", "user-agent": "tt-engine/2.0"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        return ReadoutStatus(
            fresh=False, regime=None, macro_flip_evaluable=False,
            macro_flip_tripped=None, fetch_error=str(e),
        )
    return to_status(body, now)
