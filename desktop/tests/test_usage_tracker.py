"""Tests for screen-time categorization, focus score and persistence."""

import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from fellowship_focus.usage_tracker import (
    _empty_day,
    _friendly_label,
    categorize,
    focus_score,
)


def test_categorize_distraction_beats_work():
    # A YouTube tab in a work browser must count as distraction.
    assert categorize("chrome.exe", "YouTube - Home") == "distraction"
    assert categorize("msedge.exe", "reddit: the front page") == "distraction"


def test_categorize_work():
    assert categorize("Cursor.exe", "main.py - Cursor") == "work"
    assert categorize("WINWORD.EXE", "Report.docx - Word") == "work"


def test_categorize_personal_and_neutral():
    assert categorize("WhatsApp.exe", "WhatsApp") == "personal"
    assert categorize("Unknown.exe", "Something Else") == "neutral"


def test_categorize_user_overrides():
    overrides = {"work": ["myinternaltool"]}
    assert categorize("myinternaltool.exe", "Dashboard", overrides) == "work"


def test_focus_score():
    assert focus_score({"categories": {"work": 3600, "distraction": 1800}}) == 67
    assert focus_score({"categories": {"work": 100, "distraction": 0}}) == 100
    assert focus_score({"categories": {"work": 0, "distraction": 0}}) == 0


def test_friendly_label_strips_exe():
    assert _friendly_label("chrome.exe", "Anything") == "chrome"
    assert _friendly_label("", "Fallback Title") == "Fallback Title"


def test_empty_day_shape():
    day = _empty_day()
    assert set(day["categories"]) == {"work", "distraction", "personal", "neutral"}
    assert day["apps"] == {}
