"""
tt.rank -- section 6, ranking. Computes RANK_fair and RANK_constrained for
every card that reached an eligible bucket (NEAR_TERM or RANKED per section
5), and produces the two dense-ranked boards section 7.1/7.2 render from.

"All multipliers are discounts capped at 1.00 -- a good entry improves the
odds of realising a target, it does not raise the target." RANK_fair fixes
fit_mult at 1.00 (crowding/redundancy/cap concerns removed) so the delta
between the two boards (section 7.3) IS the fit penalty, isolated.
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from tt.bucket import BucketResult, bucket
from tt.derive import (
    GateResult,
    effective_multiplier,
    entry_multiplier,
    fit_multiplier,
    return_metric,
    tier_from_composite,
    tier_mismatch,
)
from tt.holdings import Holdings
from tt.models import Card

# section 5's two ELIGIBLE buckets; NEAR_TERM ranks separately from RANKED
# and the two are never commingled into one board (spec's own words).
ELIGIBLE_BUCKETS = frozenset({"NEAR_TERM", "RANKED"})


@dataclass(frozen=True)
class QuoteMeta:
    live_price: float | None
    market_open: bool
    age_min: float | None
    is_latest_close: bool


@dataclass(frozen=True)
class RankedCard:
    symbol: str
    card: Card
    bucket: str
    reason: str | None
    gate: GateResult
    entry_mult: float
    fit_mult: float
    tier: str
    book_tier: str | None
    tier_mismatch: bool
    days_to_horizon: int | None
    annualised: bool | None
    metric: float | None
    rank_fair: float | None
    rank_constrained: float | None
    unrankable_reason: str | None  # populated when bucket is eligible but no rank could be computed


def _rank_one(
    symbol: str,
    card: Card | None,
    today: date,
    quote: QuoteMeta,
    holdings: Holdings,
    roster: dict[str, str],
    cluster_of,
) -> RankedCard:
    br: BucketResult = bucket(
        card, today,
        market_open=quote.market_open, age_min=quote.age_min, is_latest_close=quote.is_latest_close,
    )

    if card is None:
        return RankedCard(
            symbol, None, br.bucket, br.reason, None, 0.0, 0.0, "C", roster.get(symbol), False,
            None, None, None, None, None, "no card on file",
        )

    entry_mult = entry_multiplier(card.entry.state)
    fit_mult = fit_multiplier(symbol, card.correlation_cluster, holdings, cluster_of)
    tier = tier_from_composite(card.composite)
    book_tier = roster.get(symbol)
    mismatch = tier_mismatch(tier, book_tier)

    metric = None
    annualised = None
    rank_fair = None
    rank_constrained = None
    unrankable_reason = None

    if br.bucket not in ELIGIBLE_BUCKETS:
        unrankable_reason = f"bucket={br.bucket} ({br.reason or 'not eligible'})"
    elif quote.live_price is None:
        unrankable_reason = "no live price"
    else:
        rr = return_metric(card.pt_model, quote.live_price, today)
        if rr.metric is None:
            unrankable_reason = rr.flag or "no metric"
        else:
            metric = rr.metric
            annualised = rr.annualised
            gate_mult = br.gate.gate_mult if br.gate else 0.0
            eff_constrained = effective_multiplier(gate_mult, entry_mult, fit_mult)
            eff_fair = effective_multiplier(gate_mult, entry_mult, 1.00)  # fit == 1.00
            rank_constrained = metric * eff_constrained
            rank_fair = metric * eff_fair

    return RankedCard(
        symbol, card, br.bucket, br.reason, br.gate, entry_mult, fit_mult, tier, book_tier,
        mismatch, br.days_to_horizon, annualised, metric, rank_fair, rank_constrained,
        unrankable_reason,
    )


def rank_all(
    cards: dict[str, Card],
    today: date,
    quotes: dict[str, QuoteMeta],
    holdings: Holdings,
    roster: dict[str, str],
) -> list[RankedCard]:
    """One RankedCard per symbol in `cards`. Symbols with no live quote at
    all still get an entry (bucket()'s rung 6 will read as not-live and
    reason it PENDING/quote) -- section 7.0's rule is that a name failing
    section 5 renders in NEITHER ranked panel, not that it disappears from
    the roster entirely."""

    def cluster_of(sym: str) -> str | None:
        c = cards.get(sym)
        return c.correlation_cluster if c else None

    default_quote = QuoteMeta(live_price=None, market_open=False, age_min=None, is_latest_close=False)
    return [
        _rank_one(sym, card, today, quotes.get(sym, default_quote), holdings, roster, cluster_of)
        for sym, card in cards.items()
    ]


def _dense_ranks(values: list[float]) -> list[int]:
    """Textbook DENSE_RANK: ties share a rank number, the next DISTINCT
    value's rank is current+1 (no gap). `values` must already be sorted
    descending -- this function only assigns numbers, it doesn't sort."""
    ranks: list[int] = []
    rank = 0
    last: object = object()
    for v in values:
        if v != last:
            rank += 1
            last = v
        ranks.append(rank)
    return ranks


def _board(entries: list[RankedCard], bucket_name: str, rank_attr: str) -> list[tuple[int, RankedCard]]:
    """Sort: RANK desc -> composite desc -> symbol asc; dense ranking on the
    RANK value alone (composite/symbol only break display order within a
    tie, per the spec's stated sort key). A None rank value is EXCLUDED --
    unrankable, never sorted-in as if it were 0 (spec section 7.0's rule,
    generalised from "eligibility is symmetric" to "an unrankable name isn't
    silently a worst-case rank either")."""
    rankable = [rc for rc in entries if rc.bucket == bucket_name and getattr(rc, rank_attr) is not None]
    rankable.sort(key=lambda rc: (-getattr(rc, rank_attr), -rc.card.composite, rc.symbol))
    ranks = _dense_ranks([getattr(rc, rank_attr) for rc in rankable])
    return list(zip(ranks, rankable))


def ranked_board_fair(entries: list[RankedCard]) -> list[tuple[int, RankedCard]]:
    """section 7.1 VALUATION GAP -- merit only, RANK_fair, RANKED bucket."""
    return _board(entries, "RANKED", "rank_fair")


def ranked_board_constrained(entries: list[RankedCard]) -> list[tuple[int, RankedCard]]:
    """section 7.2 FUNDING PRIORITY -- allocation-aware, RANK_constrained,
    RANKED bucket (same eligible set as ranked_board_fair)."""
    return _board(entries, "RANKED", "rank_constrained")


def near_term_board(entries: list[RankedCard]) -> list[tuple[int, RankedCard]]:
    """section 7.4 -- NEAR_TERM ranks separately, never commingled with
    RANKED. Sorted by rank_fair for consistency with the merit board;
    section 7.4's header must read the metric as an ABSOLUTE return, not a
    rate (render.py's job, not this function's)."""
    return _board(entries, "NEAR_TERM", "rank_fair")


def unrankable(entries: list[RankedCard]) -> list[RankedCard]:
    """Every eligible-bucket entry that still couldn't produce a rank
    (missing price, some other gap). Reported, never silently dropped --
    'silent truncation reads as full coverage.'"""
    return [
        rc for rc in entries
        if rc.bucket in ELIGIBLE_BUCKETS and rc.rank_fair is None and rc.rank_constrained is None
    ]


# --- CLI: `python -m tt.rank` -------------------------------------------------
# section 8.5: "python -m tt.rank recomputes all derived values against live
# quotes + live weights and renders section 7."


def _load_cards(card_dir: Path) -> dict[str, Card]:
    cards: dict[str, Card] = {}
    for f in sorted(card_dir.glob("*.json")):
        payload = json.loads(f.read_text())
        cards[payload["symbol"]] = Card.model_validate(payload)
    return cards


def _load_live_sources(cards: dict[str, Card], macrodash_url: str):
    """Pulls roster (book tier) + holdings (measured positions) + quotes
    from MacroDash's live PIN-gated API, per tt.macrodash_client. Returns
    (roster, holdings, quotes, note) -- `note` is a one-line summary printed
    by main() so a reader can tell at a glance real synced data was used,
    never silently. Raises MacrodashAuthError if TT_PIN is unset or wrong --
    the caller decides whether that's fatal or a fall-through to local files."""
    from tt.holdings import Holdings
    from tt.macrodash_client import (
        MacrodashClient,
        holdings_from_positions,
        quotes_from_live,
        roster_from_book,
    )

    client = MacrodashClient(base_url=macrodash_url)
    book = client.get_book()
    roster = roster_from_book(book)
    positions = client.get_positions()
    holdings = holdings_from_positions(positions)
    quotes_json = client.get_quotes(list(cards.keys()))
    quotes = quotes_from_live(quotes_json)
    note = (
        f"LIVE from MacroDash ({macrodash_url}): {len(roster)} book-tier symbols, "
        f"{len(holdings.all_weights())} measured positions (asOf {holdings.as_of}), "
        f"{len(quotes)} live quotes ({len(quotes_json.get('missing') or [])} missing)"
    )
    return roster, holdings, quotes, note


def main(argv: list[str] | None = None) -> int:
    # Deferred imports: tt.render imports RankedCard/board functions FROM
    # this module, so importing tt.render at module scope here would be a
    # circular import. Delaying to call-time (main() only runs once, as the
    # CLI entry point) breaks the cycle without restructuring either module.
    from tt.holdings import Holdings
    from tt.macrodash_client import MacrodashAuthError
    from tt.queue import run_queue_entries, write_run_queue
    from tt.readout import DEFAULT_URL as DEFAULT_READOUT_URL, fetch_status
    from tt.render import render_report
    from tt.roster import load_roster
    from tt.quotes import load_quotes
    from tt.validate import today_et

    parser = argparse.ArgumentParser(prog="python -m tt.rank")
    parser.add_argument("--cards", default="tt_cards")
    parser.add_argument("--holdings", default="holdings.json")
    parser.add_argument("--roster", default="roster.json")
    parser.add_argument("--quotes", default="quotes.json")
    parser.add_argument("--readout-url", default=None, help="override the /readout.json URL")
    parser.add_argument("--macrodash-url", default=DEFAULT_READOUT_URL.rsplit("/readout.json", 1)[0],
                         help="MacroDash base URL for the live book/positions/quotes sync")
    parser.add_argument("--run-queue", default="run_queue.md")
    parser.add_argument("--no-network", action="store_true", help="skip ALL network calls (readout + live sync)")
    parser.add_argument("--no-live", action="store_true",
                         help="skip the book/positions/quotes sync even if TT_PIN is set (local files only)")
    args = parser.parse_args(argv)

    today = today_et()
    cards = _load_cards(Path(args.cards))

    # Local files are ALWAYS the baseline (OPEN-4's stated fallback, and
    # what every existing test in this repo exercises) -- the live sync
    # only SUPPLEMENTS or overrides them, per-source, never replaces the
    # whole config wholesale, so a symbol only tt-engine knows about (not
    # yet in the real book) still gets whatever local data exists for it.
    holdings = Holdings.load(args.holdings)
    roster = load_roster(args.roster)
    quotes = load_quotes(args.quotes)

    if not args.no_network and not args.no_live and os.environ.get("TT_PIN"):
        try:
            live_roster, live_holdings, live_quotes, note = _load_live_sources(cards, args.macrodash_url)
            print(note)
            roster = {**roster, **live_roster}
            quotes = {**quotes, **live_quotes}
            # Holdings has no natural "merge" (it's a whole measured snapshot,
            # not a per-symbol map with independent provenance like roster/
            # quotes) -- live REPLACES local outright when it's available,
            # exactly like MacroDash's own tt:pos:v1 is the one measured
            # source of truth once it exists.
            holdings = live_holdings
        except MacrodashAuthError as e:
            print(f"WARNING: live MacroDash sync skipped -- {e}")
        except (urllib.error.URLError, OSError, json.JSONDecodeError, TimeoutError) as e:
            # A network blip or MacroDash being briefly down must NOT crash
            # the whole ranking run -- graceful degradation to local files
            # is this codebase's (and MacroDash's own) core invariant, not
            # an afterthought. Only genuine auth rejections (above) carry
            # the sharper "do not retry" warning; this is just "try later."
            print(f"WARNING: live MacroDash sync failed ({e}) -- using local files for this run")
    elif not args.no_network and not args.no_live:
        print("NOTE: TT_PIN not set -- using local holdings.json/roster.json/quotes.json only. "
              "export TT_PIN=<pin> to pull the real book/positions/quotes from MacroDash.")

    if args.no_network:
        from tt.render import ReadoutStatus

        status = ReadoutStatus(fresh=False, regime=None, macro_flip_evaluable=False,
                                macro_flip_tripped=None, fetch_error="--no-network")
    else:
        kwargs = {"url": args.readout_url} if args.readout_url else {}
        status = fetch_status(**kwargs)

    entries = rank_all(cards, today, quotes, holdings, roster)
    print(render_report(entries, holdings, today, status))

    queue = run_queue_entries(entries, today)
    write_run_queue(args.run_queue, queue, today)
    print(f"\n({len(queue)} name(s) written to {args.run_queue})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
