from __future__ import annotations

import json
import subprocess
from datetime import date, timedelta
from pathlib import Path

from tests.conftest import card_payload
from tt.ingest import (
    commit_message,
    git_commit,
    ingest_batch,
    ingest_payload,
    main as ingest_main,
)
from tt.models import Card

TODAY = date(2026, 8, 2)


def init_repo(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True)
    return tmp_path


def test_ingest_payload_writes_card(tmp_path):
    cards = tmp_path / "tt_cards"
    ok, result, card = ingest_payload(card_payload(), today=TODAY, card_dir=cards)
    assert ok and result.ok
    written = json.loads((cards / "XYZ.json").read_text())
    assert written["symbol"] == "XYZ"


def test_ingest_payload_rejects_invalid_and_writes_nothing(tmp_path):
    cards = tmp_path / "tt_cards"
    ok, result, card = ingest_payload(card_payload(composite=99), today=TODAY, card_dir=cards)
    assert not ok and card is None
    assert not cards.exists() or not any(cards.iterdir())


def test_ingest_payload_overwrites_existing_card_for_same_symbol(tmp_path):
    cards = tmp_path / "tt_cards"
    ingest_payload(card_payload(run_type="SCREEN"), today=TODAY, card_dir=cards)
    ingest_payload(
        card_payload(run_type="DEEP", run_date=(TODAY - timedelta(days=1)).isoformat()),
        today=TODAY, card_dir=cards,
    )
    written = json.loads((cards / "XYZ.json").read_text())
    assert written["run_type"] == "DEEP"  # the file always holds the LATEST ingest, not a merge


def test_commit_message_format():
    card = Card.model_validate(card_payload())
    assert commit_message(card) == "tt: XYZ DEEP 2026-07-29"


def test_git_commit_creates_a_real_commit(tmp_path):
    repo = init_repo(tmp_path)
    f = repo / "hello.txt"
    f.write_text("hi\n")
    made = git_commit(repo, f, "tt: TEST DEEP 2026-08-02")
    assert made is True
    log = subprocess.run(["git", "log", "--oneline"], cwd=repo, capture_output=True, text=True, check=True)
    assert "tt: TEST DEEP 2026-08-02" in log.stdout


def test_git_commit_is_a_noop_on_identical_content(tmp_path):
    repo = init_repo(tmp_path)
    f = repo / "hello.txt"
    f.write_text("hi\n")
    git_commit(repo, f, "first")
    made_again = git_commit(repo, f, "second, should not happen")
    assert made_again is False
    log = subprocess.run(["git", "log", "--oneline"], cwd=repo, capture_output=True, text=True, check=True)
    assert log.stdout.count("\n") == 1  # exactly one commit total


def test_git_commit_handles_dash_leading_filename(tmp_path):
    # Regression: a bare "-AB.json" (no directory prefix, which happens when
    # --cards is "." and the symbol itself starts with "-" -- models.py's
    # symbol regex permits that) must not be parsed as a git flag. Without
    # "--" separating the pathspec, `git add -AB.json` fails with "unknown
    # switch `B'".
    repo = init_repo(tmp_path)
    f = repo / "-AB.json"
    f.write_text('{"x": 1}\n')
    made = git_commit(repo, f, "tt: -AB DEEP 2026-08-02")
    assert made is True
    log = subprocess.run(["git", "log", "--oneline"], cwd=repo, capture_output=True, text=True, check=True)
    assert "tt: -AB DEEP 2026-08-02" in log.stdout


def _write_inbox(inbox: Path, name: str, payload: dict) -> Path:
    inbox.mkdir(parents=True, exist_ok=True)
    p = inbox / name
    p.write_text(json.dumps(payload))
    return p


def test_batch_collision_deep_beats_screen_same_symbol_same_day(tmp_path):
    inbox = tmp_path / "inbox"
    cards = tmp_path / "tt_cards"
    _write_inbox(inbox, "a_screen.json", card_payload(run_type="SCREEN"))
    _write_inbox(inbox, "b_deep.json", card_payload(run_type="DEEP"))

    outcome = ingest_batch(inbox, cards, today=TODAY)
    assert len(outcome.accepted) == 1
    assert "DEEP" in outcome.accepted[0]
    assert len(outcome.superseded) == 1 and "SCREEN" in outcome.superseded[0]
    written = json.loads((cards / "XYZ.json").read_text())
    assert written["run_type"] == "DEEP"
    assert not any(inbox.iterdir())  # both valid files consumed


def test_batch_collision_equal_type_last_write_wins(tmp_path):
    import os
    import time

    inbox = tmp_path / "inbox"
    cards = tmp_path / "tt_cards"
    p1 = _write_inbox(inbox, "a.json", card_payload(run_type="DEEP", thesis="first"))
    time.sleep(0.01)
    p2 = _write_inbox(inbox, "b.json", card_payload(run_type="DEEP", thesis="second, written later"))
    # ensure mtimes are ordered even on filesystems with coarse resolution
    now = time.time()
    os.utime(p1, (now - 1, now - 1))
    os.utime(p2, (now, now))

    outcome = ingest_batch(inbox, cards, today=TODAY)
    written = json.loads((cards / "XYZ.json").read_text())
    assert written["thesis"] == "second, written later"


def test_batch_rejected_files_stay_in_inbox(tmp_path):
    inbox = tmp_path / "inbox"
    cards = tmp_path / "tt_cards"
    _write_inbox(inbox, "bad.json", card_payload(composite=99))
    _write_inbox(inbox, "good.json", card_payload(symbol="ABC"))

    outcome = ingest_batch(inbox, cards, today=TODAY)
    assert len(outcome.accepted) == 1
    assert len(outcome.rejected) == 1
    remaining = list(inbox.iterdir())
    assert len(remaining) == 1 and remaining[0].name == "bad.json"


def test_batch_writes_are_git_committed_when_repo_given(tmp_path):
    repo = init_repo(tmp_path)
    inbox = repo / "inbox"
    cards = repo / "tt_cards"
    _write_inbox(inbox, "a.json", card_payload())

    ingest_batch(inbox, cards, today=TODAY, repo_dir=repo)
    log = subprocess.run(["git", "log", "--oneline"], cwd=repo, capture_output=True, text=True, check=True)
    assert "tt: XYZ DEEP 2026-07-29" in log.stdout


def test_cli_paste_mode(tmp_path, monkeypatch, capsys):
    cards = tmp_path / "tt_cards"
    payload = card_payload()
    monkeypatch.setattr("sys.stdin", __import__("io").StringIO(json.dumps(payload)))
    rc = ingest_main(["--paste", "--cards", str(cards)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "ACCEPTED" in out
    assert (cards / "XYZ.json").exists()
