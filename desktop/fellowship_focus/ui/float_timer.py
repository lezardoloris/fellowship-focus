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

from fellowship_focus.config import load_config, save_config
from fellowship_focus.ui.theme import (
    ACCENT,
    BG,
    BG_ELEVATED,
    BORDER,
    FG,
    MUTED,
    font_timer,
)


class FloatTimerWindow(QWidget):
    """Frameless, always-on-top session indicator — premium capsule (time only)."""

    closed_by_user = Signal()
    dismissed_by_user = Signal()
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
        # Translucent host so the capsule radius actually clips (no square chrome).
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedHeight(40)

        self._remaining = 0
        self._label = "FOCUS"
        self._drag_pos = None
        self._dragged = False
        self._placed = False
        self._last_web_sync = 0.0
        self._session_active = False
        self._dismissed = False  # × hid the pill; session still running

        # True capsule: radius = half height. No phase word — status is the accent dot.
        self.setStyleSheet(
            f"""
            QWidget#floatRoot {{
                background: {BG};
                border: 1px solid {BORDER};
                border-radius: 20px;
            }}
            QLabel#timeLabel {{
                color: {FG};
                background: transparent;
                padding: 0 2px;
            }}
            QLabel#statusDot {{
                background: transparent;
            }}
            QPushButton#closeBtn {{
                background: {BG_ELEVATED};
                color: {MUTED};
                border: none;
                border-radius: 12px;
                font-size: 15px;
                padding: 0;
            }}
            QPushButton#closeBtn:hover {{
                color: {FG};
                background: #3a3d40;
            }}
            """
        )

        root = QWidget(self)
        root.setObjectName("floatRoot")
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(root)

        row = QHBoxLayout(root)
        row.setContentsMargins(14, 6, 8, 6)
        row.setSpacing(10)

        self._dot = QLabel("●")
        self._dot.setObjectName("statusDot")
        self._dot.setStyleSheet(f"color: {ACCENT}; font-size: 10px;")
        self._dot.setFixedWidth(12)
        self._dot.setAlignment(Qt.AlignmentFlag.AlignCenter)
        row.addWidget(self._dot)

        self._time = QLabel("00:00")
        self._time.setObjectName("timeLabel")
        self._time.setFont(font_timer(14))
        self._time.setAlignment(Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft)
        row.addWidget(self._time)

        close = QPushButton("×")
        close.setObjectName("closeBtn")
        close.setFixedSize(24, 24)
        close.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        close.setToolTip("Hide timer (session keeps running)")
        close.clicked.connect(self._on_dismiss)
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
        self._session_active = True
        self._render()
        # Local countdown keeps tray/tooltip honest even while the pill is hidden.
        if not self._tick.isActive():
            self._tick.start()
        self.remaining_changed.emit(self._remaining, self._label)
        # User dismissed the pill — keep syncing state, do not force it back on.
        if self._dismissed:
            return
        # Place ONCE per session. This used to run on every one-second sync,
        # which teleported the widget back to bottom-right the instant after
        # the user dragged it anywhere.
        if not self._placed:
            self._placed = True
            self._restore_or_default_position()
        if not self.isVisible():
            self.show()
            self._assert_topmost()
        if not self._topmost.isActive():
            self._topmost.start()

    def hide_timer(self) -> None:
        """End of session — clear state and hide (called by web / quit)."""
        self._tick.stop()
        self._topmost.stop()
        self._remaining = 0
        self._session_active = False
        self._dismissed = False
        self._placed = False  # next session re-restores the saved spot
        self.hide()
        self.remaining_changed.emit(0, "")

    def dismiss(self) -> None:
        """Hide the pill only — focus session continues in the background."""
        if not self.isVisible() and self._dismissed:
            return
        self._dismissed = True
        self._topmost.stop()
        self.hide()
        self.dismissed_by_user.emit()

    def reshow(self) -> None:
        """Bring the pill back after a user dismiss (tray / menu)."""
        if not self._session_active:
            return
        self._dismissed = False
        self.update_timer(self._remaining, self._label)

    def is_session_active(self) -> bool:
        return self._session_active

    def is_dismissed(self) -> bool:
        return self._dismissed

    def remaining(self) -> int:
        return self._remaining

    def phase_label(self) -> str:
        return self._label

    def _render(self) -> None:
        m, s = divmod(max(0, self._remaining), 60)
        self._time.setText(f"{m:02d}:{s:02d}")
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

    def _restore_or_default_position(self) -> None:
        """Saved spot if it is still on a screen, bottom-right otherwise."""
        try:
            pos = load_config().get("float_timer_pos")
            x, y = int(pos[0]), int(pos[1])
        except Exception:
            self._place_bottom_right()
            return
        self.adjustSize()
        for screen in QGuiApplication.screens():
            geo = screen.availableGeometry()
            # Enough of the pill must remain grabbable after a monitor change.
            if geo.contains(x + 20, y + 10) or geo.contains(x + self.width() - 20, y + 10):
                self.move(x, y)
                return
        self._place_bottom_right()

    def _save_position(self) -> None:
        try:
            cfg = load_config()
            cfg["float_timer_pos"] = [self.x(), self.y()]
            save_config(cfg)
        except Exception:
            pass  # a failed save must never break the drag

    def _context_menu(self, pos) -> None:
        menu = QMenu(self)
        open_a = menu.addAction("Open Fellowship Focus")
        open_a.triggered.connect(self.open_app_requested.emit)
        hide_a = menu.addAction("Hide timer")
        hide_a.triggered.connect(self._on_dismiss)
        menu.addSeparator()
        end_a = menu.addAction("End session")
        end_a.triggered.connect(self._on_end_session)
        menu.exec(self.mapToGlobal(pos))

    def _on_dismiss(self) -> None:
        """× / Hide — notification UI only; do not stop the Pomodoro session."""
        self.dismiss()

    def _on_end_session(self) -> None:
        """Explicit end from context menu — tear down float + notify web to stop."""
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
            self._dragged = True
            event.accept()
        else:
            super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:  # noqa: N802
        if self._dragged:
            self._dragged = False
            self._save_position()
        self._drag_pos = None
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.MouseButton.LeftButton:
            self.open_app_requested.emit()
            event.accept()
        else:
            super().mouseDoubleClickEvent(event)
