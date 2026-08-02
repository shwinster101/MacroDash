"""
tt.ingest -- section 8's pipeline: inbox/ -> validate -> tt_cards/{SYMBOL}.json
(git-committed) or back to inbox/ with a diff to re-emit.

Collision rule (section 3): "same symbol same day -> precedence DEEP > RE >
SCREEN; equal type -> last write wins." This only matters WITHIN one ingest
pass that sees more than one candidate for the same (symbol, run_date) --
tt_cards/{SYMBOL}.json holds exactly one file per symbol regardless of date
(the file is always the latest ingested card; the full history lives in git
commit log, one commit per accepted card -- that's the point of committing
per-card rather than batching writes).

Run as: `python -m tt.ingest` (processes inbox/*.json) or
        `python -m tt.ingest --paste` (reads one card from stdin).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from tt.models import Card
from tt.validate import ValidationResult, format_diff, parse_and_validate

CARD_DIR = Path("tt_cards")
INBOX_DIR = Path("inbox")

RUN_TYPE_PRECEDENCE = {"DEEP": 3, "RE": 2, "SCREEN": 1}


@dataclass
class IngestOutcome:
    accepted: list[str] = field(default_factory=list)
    superseded: list[str] = field(default_factory=list)
    rejected: list[tuple[str, ValidationResult]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.rejected


def _write_card(card: Card, card_dir: Path) -> Path:
    card_dir.mkdir(parents=True, exist_ok=True)
    path = card_dir / f"{card.symbol}.json"
    # by_alias/exclude_none=False so a re-read of this file round-trips
    # identically -- an omitted optional field stays explicit as null
    # rather than silently vanishing from the on-disk record.
    path.write_text(card.model_dump_json(indent=2, exclude_none=False) + "\n")
    return path


def commit_message(card: Card) -> str:
    return f"tt: {card.symbol} {card.run_type} {card.run_date.isoformat()}"


def git_commit(repo_dir: Path, path: Path, message: str) -> bool:
    """Returns True if a commit was actually made. Ingesting a byte-identical
    card a second time (re-running the same paste) must not create an empty
    commit -- `git diff --cached --quiet` is how that's detected."""
    subprocess.run(["git", "add", str(path)], cwd=repo_dir, check=True)
    diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo_dir)
    if diff.returncode == 0:
        subprocess.run(["git", "reset", "-q", str(path)], cwd=repo_dir, check=True)
        return False
    subprocess.run(["git", "commit", "-q", "-m", message], cwd=repo_dir, check=True)
    return True


def ingest_payload(
    payload: dict, today: date | None = None, card_dir: Path = CARD_DIR
) -> tuple[bool, ValidationResult, Card | None]:
    """The single-card path (`--paste`). No collision resolution -- there is
    only ever one candidate. Unconditionally overwrites tt_cards/{SYMBOL}.json
    on success, exactly like every other ingest path (git history is the
    ledger, not the file's own prior contents)."""
    card, result = parse_and_validate(payload, today=today)
    if card is None:
        return False, result, None
    _write_card(card, card_dir)
    return True, result, card


def _collision_sort_key(card: Card, write_order: int) -> tuple[int, int]:
    return (RUN_TYPE_PRECEDENCE[card.run_type], write_order)


def ingest_batch(
    inbox_dir: Path = INBOX_DIR,
    card_dir: Path = CARD_DIR,
    today: date | None = None,
    repo_dir: Path | None = None,
) -> IngestOutcome:
    """Processes every *.json in inbox_dir. Rejected files are left exactly
    where they were (spec 8.4: "leave in inbox/, print field-level diff for
    chat re-emit") -- only successfully-parsed files (winners AND collision
    losers) are consumed, since a collision loser was still a VALID card,
    just outranked; leaving it in inbox/ would make the next run re-litigate
    a settled tiebreak forever."""
    files = sorted(inbox_dir.glob("*.json"), key=lambda p: p.stat().st_mtime)
    outcome = IngestOutcome()

    parsed: list[tuple[Path, Card]] = []
    for f in files:
        try:
            payload = json.loads(f.read_text())
        except json.JSONDecodeError as e:
            outcome.rejected.append((f.name, ValidationResult(ok=False, errors=[f"invalid JSON: {e}"])))
            continue
        card, result = parse_and_validate(payload, today=today)
        if card is None:
            outcome.rejected.append((f.name, result))
            continue
        parsed.append((f, card))

    groups: dict[tuple[str, date], list[tuple[int, Path, Card]]] = defaultdict(list)
    for write_order, (f, card) in enumerate(parsed):
        groups[(card.symbol, card.run_date)].append((write_order, f, card))

    for candidates in groups.values():
        candidates.sort(key=lambda t: _collision_sort_key(t[2], t[0]), reverse=True)
        _, winner_file, winner_card = candidates[0]

        path = _write_card(winner_card, card_dir)
        msg = commit_message(winner_card)
        if repo_dir is not None:
            git_commit(repo_dir, path, msg)
        outcome.accepted.append(f"{winner_card.symbol} {winner_card.run_type} {winner_card.run_date}")
        winner_file.unlink(missing_ok=True)

        for _, f, c in candidates[1:]:
            outcome.superseded.append(
                f"{c.symbol} {c.run_type} {c.run_date} (superseded by {winner_card.run_type})"
            )
            f.unlink(missing_ok=True)

    return outcome


def _print_outcome(outcome: IngestOutcome) -> None:
    for a in outcome.accepted:
        print(f"ACCEPTED  {a}")
    for s in outcome.superseded:
        print(f"SUPERSEDED  {s}")
    for name, result in outcome.rejected:
        payload_stub = {"symbol": name}
        print(format_diff(payload_stub, result))
        print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m tt.ingest")
    parser.add_argument("--paste", action="store_true", help="read one card as JSON from stdin")
    parser.add_argument("--inbox", default=str(INBOX_DIR))
    parser.add_argument("--cards", default=str(CARD_DIR))
    parser.add_argument("--repo", default=None, help="git repo root to commit into (default: no commit)")
    args = parser.parse_args(argv)

    repo_dir = Path(args.repo) if args.repo else None

    if args.paste:
        payload = json.load(sys.stdin)
        ok, result, card = ingest_payload(payload, card_dir=Path(args.cards))
        if not ok:
            print(format_diff(payload, result))
            return 1
        path = Path(args.cards) / f"{card.symbol}.json"
        if repo_dir is not None:
            git_commit(repo_dir, path, commit_message(card))
        print(f"ACCEPTED  {card.symbol} {card.run_type} {card.run_date}")
        for w in result.warnings:
            print(f"  warn    {w}")
        return 0

    outcome = ingest_batch(Path(args.inbox), Path(args.cards), repo_dir=repo_dir)
    _print_outcome(outcome)
    return 0 if outcome.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
