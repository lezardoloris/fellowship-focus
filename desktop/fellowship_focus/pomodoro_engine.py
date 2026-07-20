from PySide6.QtCore import QObject, QTimer, Signal


class PomodoroEngine(QObject):
    tick = Signal(int, str)  # remaining_seconds, phase label
    phase_changed = Signal(str)
    session_finished = Signal(bool, int)  # completed, work_minutes

    PHASE_WORK = "work"
    PHASE_BREAK = "break"
    PHASE_LONG_BREAK = "long_break"
    PHASE_IDLE = "idle"

    def __init__(self) -> None:
        super().__init__()
        self.timer = QTimer()
        self.timer.timeout.connect(self._on_tick)
        self.phase = self.PHASE_IDLE
        self.remaining = 0
        self.work_minutes = 25
        self.break_minutes = 5
        self.long_break_minutes = 15
        self.intervals_until_long = 2
        self.completed_work_intervals = 0
        self.total_work_seconds = 0
        self._paused = False

    def configure(self, work: int, brk: int, long_brk: int, intervals: int) -> None:
        self.work_minutes = work
        self.break_minutes = brk
        self.long_break_minutes = long_brk
        self.intervals_until_long = max(1, intervals)

    def start_work(self) -> None:
        self.phase = self.PHASE_WORK
        self.remaining = self.work_minutes * 60
        self._paused = False
        self.timer.start(1000)
        self.phase_changed.emit(self.phase)
        self.tick.emit(self.remaining, self._label())

    def stop(self) -> None:
        self.timer.stop()
        work_mins = max(0, round(self.total_work_seconds / 60))
        was_work = self.phase == self.PHASE_WORK and self.remaining < self.work_minutes * 60
        completed = self.phase == self.PHASE_IDLE and self.completed_work_intervals > 0
        self.phase = self.PHASE_IDLE
        self.remaining = 0
        self.completed_work_intervals = 0
        self.total_work_seconds = 0
        self.tick.emit(0, "Ready")
        self.session_finished.emit(was_work or completed, work_mins)

    def pause_resume(self) -> bool:
        if self.phase == self.PHASE_IDLE:
            return False
        self._paused = not self._paused
        if self._paused:
            self.timer.stop()
        else:
            self.timer.start(1000)
        return self._paused

    def skip(self) -> None:
        if self.phase == self.PHASE_IDLE:
            return
        self._advance_phase()

    def _on_tick(self) -> None:
        if self.remaining <= 0:
            self._advance_phase()
            return
        self.remaining -= 1
        if self.phase == self.PHASE_WORK:
            self.total_work_seconds += 1
        self.tick.emit(self.remaining, self._label())

    def _advance_phase(self) -> None:
        if self.phase == self.PHASE_WORK:
            self.completed_work_intervals += 1
            if self.completed_work_intervals % self.intervals_until_long == 0:
                self.phase = self.PHASE_LONG_BREAK
                self.remaining = self.long_break_minutes * 60
            else:
                self.phase = self.PHASE_BREAK
                self.remaining = self.break_minutes * 60
        elif self.phase in (self.PHASE_BREAK, self.PHASE_LONG_BREAK):
            self.phase = self.PHASE_WORK
            self.remaining = self.work_minutes * 60
        else:
            return
        self.phase_changed.emit(self.phase)
        self.tick.emit(self.remaining, self._label())

    def _label(self) -> str:
        labels = {
            self.PHASE_WORK: "Focus",
            self.PHASE_BREAK: "Break",
            self.PHASE_LONG_BREAK: "Long Break",
            self.PHASE_IDLE: "Ready",
        }
        return labels.get(self.phase, "")

    @property
    def is_running(self) -> bool:
        return self.phase != self.PHASE_IDLE

    @property
    def is_work_phase(self) -> bool:
        return self.phase == self.PHASE_WORK
