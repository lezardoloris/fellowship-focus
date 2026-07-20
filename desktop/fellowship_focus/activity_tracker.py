"""Mouse movement activity — proves you're at the PC without keylogging."""

from __future__ import annotations

import sys

from PySide6.QtCore import QObject, QTimer


def _cursor_pos() -> tuple[int, int]:
    if sys.platform == "win32":
        try:
            import ctypes

            class POINT(ctypes.Structure):
                _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

            pt = POINT()
            ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
            return pt.x, pt.y
        except Exception:
            pass
    return 0, 0


class ActivityTracker(QObject):
    """Accumulates mouse travel distance (pixels) while focus session runs."""

    def __init__(self) -> None:
        super().__init__()
        self.score = 0
        self._last: tuple[int, int] | None = None
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)

    def start(self) -> None:
        self.score = 0
        self._last = _cursor_pos()
        self._timer.start(5000)

    def stop(self) -> int:
        self._timer.stop()
        self._tick()
        return self.score

    def snapshot(self) -> int:
        self._tick()
        return self.score

    def _tick(self) -> None:
        pos = _cursor_pos()
        if self._last is not None:
            dx = abs(pos[0] - self._last[0])
            dy = abs(pos[1] - self._last[1])
            self.score += dx + dy
        self._last = pos

    @property
    def is_active(self) -> bool:
        return self._timer.isActive()

    def activity_label(self) -> str:
        s = self.score
        if s >= 8000:
            return "high"
        if s >= 2000:
            return "medium"
        if s >= 300:
            return "low"
        return "idle"
