"""[TRK-8] A tracker that interrupts gets uninstalled. These are the limits."""

from __future__ import annotations

import time

import pytest

from fellowship_focus import categorise_queue as q


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.setattr(q, "STATE_DIR", tmp_path)
    monkeypatch.setattr(q, "RULES_PATH", tmp_path / "category-rules.json")
    monkeypatch.setattr(q, "ASKED_PATH", tmp_path / "category-asked.json")


def _span(app, sec, cat="neutral", title="x"):
    return {"app": app, "title": title, "cat": cat, "sec": sec}


def test_asks_about_the_costliest_unknown_first():
    spans = [_span("cheap", 700), _span("expensive", 5000), _span("mid", 2000)]
    got = [x["pattern"] for x in q.build_questions(spans)]
    assert got == ["expensive", "mid", "cheap"]


def test_never_more_than_three_questions():
    spans = [_span(f"app{i}", 3000) for i in range(10)]
    assert len(q.build_questions(spans)) == 3


def test_cheap_patterns_are_not_worth_a_question():
    """Spending someone's patience on a four-minute unknown is how the feature
    gets switched off."""
    assert q.build_questions([_span("tiny", 240)]) == []


def test_already_categorised_time_is_never_asked_about():
    spans = [_span("Cursor", 5000, cat="work"), _span("unknown", 5000)]
    assert [x["pattern"] for x in q.build_questions(spans)] == ["unknown"]


def test_an_answer_stops_the_question_coming_back():
    """A question that returns is a bug, not a reminder."""
    spans = [_span("whispering", 5000)]
    assert q.build_questions(spans)
    q.answer("whispering", "work", client="Acme")
    assert q.build_questions(spans) == []


def test_skipping_silences_it_for_a_week_then_it_returns():
    spans = [_span("maybe", 5000)]
    q.skip("maybe")
    assert q.build_questions(spans) == []
    later = time.time() + (q.COOLDOWN_DAYS + 1) * 86400
    assert q.build_questions(spans, now=later)


def test_answers_recategorise_on_read_without_rewriting_history():
    """The log stays a record of what happened; only the interpretation moves."""
    spans = [_span("whispering", 600), _span("Cursor", 600, cat="work")]
    q.answer("whispering", "work", client="Acme")
    out = q.apply_rules(spans)
    assert out[0]["cat"] == "work"
    assert out[0]["client"] == "Acme"
    assert spans[0]["cat"] == "neutral", "the input rows must not be mutated"


def test_an_answer_never_overrides_a_known_category():
    spans = [_span("Cursor", 600, cat="distraction")]
    q.answer("Cursor", "work")
    assert q.apply_rules(spans)[0]["cat"] == "distraction"


def test_coverage_is_the_number_this_epic_moves():
    spans = [_span("a", 500, cat="work"), _span("b", 500)]
    assert q.coverage(spans) == pytest.approx(0.5)
    q.answer("b", "work")
    assert q.coverage(q.apply_rules(spans)) == pytest.approx(1.0)


def test_coverage_of_nothing_is_not_a_failure():
    assert q.coverage([]) == 1.0
