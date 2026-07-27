"""[FLW-1] The break must not start the next block for you.

The old engine went break -> work and kept the clock running. Walk away for
lunch during a break and you came back to "23 minutes of focus" you never did,
which is worse than no measurement: it silently inflates the day and the score
built on it.
"""

from __future__ import annotations

import pytest

from fellowship_focus.pomodoro_engine import PomodoroEngine


@pytest.fixture(scope="session")
def qapp():
    """QTimer needs an application object; one per test session is enough."""
    from PySide6.QtWidgets import QApplication

    app = QApplication.instance() or QApplication([])
    return app


@pytest.fixture
def engine(qapp):
    e = PomodoroEngine()
    e.configure(work=50, brk=10, long_brk=15, intervals=99)
    return e


def _finish_phase(e):
    """Run the phase down to its boundary without waiting for real seconds."""
    e.remaining = 0
    e._on_tick()


def test_break_does_not_start_the_next_block(engine):
    engine.start_work()
    _finish_phase(engine)  # work -> break
    assert engine.phase == PomodoroEngine.PHASE_BREAK
    _finish_phase(engine)  # break -> work, but held
    assert engine.phase == PomodoroEngine.PHASE_WORK
    assert engine.awaiting_resume_now is True
    assert not engine.timer.isActive(), "the clock must not be running"


def test_the_held_block_is_full_length_when_resumed(engine):
    engine.start_work()
    _finish_phase(engine)
    _finish_phase(engine)
    assert engine.remaining == 50 * 60
    engine.resume_after_break()
    assert engine.awaiting_resume_now is False
    assert engine.timer.isActive()


def test_time_does_not_accrue_while_waiting(engine):
    """The whole point: no minutes are credited to a block nobody started."""
    engine.start_work()
    _finish_phase(engine)
    _finish_phase(engine)
    before = engine.total_work_seconds
    for _ in range(5):
        engine._on_tick()
    assert engine.total_work_seconds == before


def test_pause_cannot_start_a_waiting_block(engine):
    """Pause/resume must not become a second way to start something the user
    never agreed to start."""
    engine.start_work()
    _finish_phase(engine)
    _finish_phase(engine)
    assert engine.pause_resume() is False
    assert not engine.timer.isActive()


def test_stop_clears_the_waiting_state(engine):
    engine.start_work()
    _finish_phase(engine)
    _finish_phase(engine)
    engine.stop()
    assert engine.awaiting_resume_now is False
    assert engine.phase == PomodoroEngine.PHASE_IDLE


def test_resume_is_a_noop_when_nothing_is_waiting(engine):
    engine.resume_after_break()
    assert not engine.timer.isActive()


def test_auto_start_is_still_available_for_those_who_want_it(engine):
    """Opt-in, not the default. Someone who deliberately chains blocks should
    not be forced to click every time."""
    engine.auto_start_next = True
    engine.start_work()
    _finish_phase(engine)
    _finish_phase(engine)
    assert engine.awaiting_resume_now is False
    assert engine.timer.isActive()
