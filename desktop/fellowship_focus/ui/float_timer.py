"""Always-on-top mini focus timer — bottom-right of the screen.

Survives main-window hide/minimize. Driven by the web bridge, with an
optional local tick so the countdown keeps moving if the WebView is throttled.
"""

from __future__ import annotations

import sys
import time

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCursor, QFont, QGuiApplication
from PySide6.QtWidgets import QHBoxLayout, QLabel, QMenu, QPushButton, QWidget

from fellowship_focus.ui.theme import ACCENT, BG, FG, MUTED


class FloatTimerWindow(QWidget):
    """Frameless, always-on-top session indicator."""

    closed_by_user = Signal()
    open_app_requested = Signal()
    remaining_changed = Signal(int, str)  # remaining, label

    def __init__(self, parent=None) -> None:
        flags = (
            Qt.WindowType.Tool
            | Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.WindowDoesNotAcceptFocus
        )
        super().__init__(parent, flags)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)
        self.setFixedHeight(38)
        self.setMinimumWidth(168)

        self._remaining = 0
        self._label = "FOCUS"
        self._drag_pos = None
        self._last_web_sync = 0.0

        self.setStyleSheet(
            f"""
            QWidget#floatRoot {{
                background: {BG};
                border: 1px solid #3a3d40;
                border-radius: 10px;
            }}
            QLabel#timeLabel {{
                color: {FG};
                font-weight: 700;
                font-size: 14px;
            }}
            QLabel#phaseLabel {{
                color: {MUTED};
                font-size: 10px;
                letter-spacing: 1px;
            }}
            QPushButton#closeBtn {{
                background: transparent;
                color: {MUTED};
                border: none;
                font-size: 16px;
                padding: 0 8px;
            }}
            QPushButton#closeBtn:hover {{
                color: {FG};
                background: #2e3134;
                border-radius: 4px;
            }}
            """
        )

        root = QWidget(self)
        root.setObjectName("floatRoot")
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(root)

        row = QHBoxLayout(root)
        row.setContentsMargins(10, 4, 4, 4)
        row.setSpacing(8)

        self._dot = QLabel("●")
        self._dot.setStyleSheet(f"color: {ACCENT}; font-size: 10px;")
        row.addWidget(self._dot)

        self._time = QLabel("00:00")
        self._time.setObjectName("timeLabel")
        font = QFont("Consolas", 13)
        font.setBold(True)
        self._time.setFont(font)
        row.addWidget(self._time)

        self._phase = QLabel("FOCUS")
        self._phase.setObjectName("phaseLabel")
        row.addWidget(self._phase)

        row.addStretch(1)

        close = QPushButton("×")
        close.setObjectName("closeBtn")
        close.setFixedSize(28, 28)
        close.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        close.setToolTip("End session")
        close.clicked.connect(self._on_close)
        row.addWidget(close)

        # Local tick — keeps counting while the main window is hidden.
        self._tick = QTimer(self)
        self._tick.setInterval(1000)
        self._tick.timeout.connect(self._on_tick)

        # Re-assert topmost (Windows can bury Tool windows under fullscreen apps).
        self._topmost = QTimer(self)
        self._topmost.setInterval(2500)
        self._topmost.timeout.connect(self._assert_topmost)

        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._context_menu)

    def update_timer(self, remaining: int, label: str = "FOCUS") -> None:
        self._remaining = max(0, int(remaining))
        self._label = (label or "FOCUS").upper()[:8]
        self._last_web_sync = time.monotonic()
        self._render()
        self._place_bottom_right()
        if not self.isVisible():
            self.show()
            self._assert_topmost()
        if not self._tick.isActive():
            self._tick.start()
        if not self._topmost.isActive():
            self._topmost.start()
        self.remaining_changed.emit(self._remaining, self._label)

    def hide_timer(self) -> None:
        self._tick.stop()
        self._topmost.stop()
        self._remaining = 0
        self.hide()
        self.remaining_changed.emit(0, "")

    def is_session_active(self) -> bool:
        return self.isVisible() and self._tick.isActive()

    def remaining(self) -> int:
        return self._remaining

    def phase_label(self) -> str:
        return self._label

    def _render(self) -> None:
        m, s = divmod(max(0, self._remaining), 60)
        self._time.setText(f"{m:02d}:{s:02d}")
        self._phase.setText(self._label)
        self._dot.setStyleSheet(
            f"color: {'#60a5fa' if self._label == 'BREAK' else ACCENT}; font-size: 10px;"
        )
        self.adjustSize()

    def _on_tick(self) -> None:
        # Web bridge usually drives the clock. If the main window is hidden and
        # JS is throttled, take over locally after ~1.4s without a sync.
        if time.monotonic() - self._last_web_sync < 1.4:
            return
        if self._remaining > 0:
            self._remaining -= 1
            self._render()
            self.remaining_changed.emit(self._remaining, self._label)

    def _assert_topmost(self) -> None:
        if not self.isVisible():
            return
        self.raise_()
        if sys.platform == "win32":
            try:
                import ctypes

                hwnd = int(self.winId())
                HWND_TOPMOST = -1
                SWP_NOMOVE = 0x0002
                SWP_NOSIZE = 0x0001
                SWP_NOACTIVATE = 0x0010
                SWP_SHOWWINDOW = 0x0040
                ctypes.windll.user32.SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                )
            except Exception:
                pass

    def _place_bottom_right(self) -> None:
        screen = self.screen()
        if screen is None:
            screen = QGuiApplication.primaryScreen()
        if screen is None:
            return
        geo = screen.availableGeometry()
        self.adjustSize()
        x = geo.right() - self.width() - 16
        y = geo.bottom() - self.height() - 16
        self.move(x, y)

    def _context_menu(self, pos) -> None:
        menu = QMenu(self)
        open_a = menu.addAction("Open Fellowship Focus")
        open_a.triggered.connect(self.open_app_requested.emit)
        menu.addSeparator()
        end_a = menu.addAction("End session")
        end_a.triggered.connect(self._on_close)
        menu.exec(self.mapToGlobal(pos))

    def _on_close(self) -> None:
        self.hide_timer()
        self.closed_by_user.emit()

    def mousePressEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()
        elif event.button() == Qt.MouseButton.RightButton:
            self._context_menu(event.pos())
            event.accept()
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:  # noqa: N802
        if self._drag_pos is not None and event.buttons() & Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()
        else:
            super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:  # noqa: N802
        self._drag_pos = None
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.MouseButton.LeftButton:
            self.open_app_requested.emit()
            event.accept()
        else:
            super().mouseDoubleClickEvent(event)
