"""[TRK-1] The event log: keep what the daily rollup threw away.

The rollup stores `chrome: 45360` and nothing else, so the largest bucket on a
real machine (45% of tracked time over 7 days) mixes client work and
doomscrolling into one number. The window title that separates them was already
being read for categorisation, twelve times a minute, and discarded.
"""

from __future__ import annotations

import json

from fellowship_focus import usage_tracker as ut


def _tracker(tmp_path, titles=True):
    ut.USAGE_DIR = tmp_path
    t = ut.UsageTracker(lambda: {"screen_time_titles": titles})
    t._day = "2026-07-27"
    return t


def test_same_window_extends_one_span(tmp_path):
    t = _tracker(tmp_path)
    t._record_event("Cursor", "layers.py", "work", 5)
    t._record_event("Cursor", "layers.py", "work", 5)
    assert t._event["sec"] == 10


def test_a_new_window_starts_a_new_span(tmp_path):
    t = _tracker(tmp_path)
    t._record_event("Cursor", "layers.py", "work", 20)
    t._record_event("chrome", "Google Ads", "neutral", 20)
    t._flush_event(t._event)
    rows = [
        json.loads(line)
        for line in (tmp_path / "2026-07-27.events.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
    ]
    assert [r["app"] for r in rows] == ["Cursor", "chrome"]
    assert rows[0]["title"] == "layers.py"


def test_short_spans_are_dropped(tmp_path):
    """Alt-tabbing through five windows is one decision, not five pieces of work."""
    t = _tracker(tmp_path)
    t._flush_event({"at": 1, "app": "x", "title": "y", "cat": "neutral", "sec": 5})
    assert not (tmp_path / "2026-07-27.events.jsonl").exists()


def test_titles_can_be_switched_off_without_losing_timing(tmp_path):
    """Titles name clients and documents. Turning them off must not turn the
    measurement off with them."""
    t = _tracker(tmp_path, titles=False)
    t._record_event("chrome", "Confidential client file", "neutral", 20)
    assert t._event["title"] == ""
    assert t._event["sec"] == 20


def test_internal_field_never_reaches_disk(tmp_path):
    t = _tracker(tmp_path)
    t._record_event("Cursor", "layers.py", "work", 20)
    t._flush_event(t._event)
    row = json.loads(
        (tmp_path / "2026-07-27.events.jsonl").read_text(encoding="utf-8").strip()
    )
    assert "raw" not in row
    assert row["at"] > 0
