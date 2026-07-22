"""Always-on-top mini focus timer — bottom-right of the screen.

Compact bar (time + label + close) so you always know when a focus session
is running, even while working in other apps. Driven by the embedded web
app via the QWebChannel bridge.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QCursor
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QWidget

from fellowship_focus.ui.theme import ACCENT, BG, FG, MUTED


class FloatTimerWindow(QWidget):
    """Frameless, always-on-top session indicator."""

    closed_by_user = Signal()

    def __init__(self, parent=None) -> None:
        # Tool | Frameless | StayOnTop — no taskbar entry, floats over everything
        flags = (
            Qt.WindowType.Tool
            | Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
        )
        super().__init__(parent, flags)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)
        self.setFixedHeight(36)
        self.setMinimumWidth(160)

        self.setStyleSheet(
            f"""
            QWidget#floatRoot {{
                background: {BG};
                border: 1px solid #3a3d40;
                border-radius: 8px;
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

        self._drag_pos = None

    def update_timer(self, remaining: int, label: str = "FOCUS") -> None:
        m, s = divmod(max(0, int(remaining)), 60)
        self._time.setText(f"{m:02d}:{s:02d}")
        self._phase.setText((label or "FOCUS").upper()[:8])
        self.adjustSize()
        self._place_bottom_right()
        if not self.isVisible():
            self.show()

    def hide_timer(self) -> None:
        self.hide()

    def _place_bottom_right(self) -> None:
        screen = self.screen()
        if screen is None:
            from PySide6.QtGui import QGuiApplication

            screen = QGuiApplication.primaryScreen()
        if screen is None:
            return
        geo = screen.availableGeometry()
        self.adjustSize()
        x = geo.right() - self.width() - 16
        y = geo.bottom() - self.height() - 16
        self.move(x, y)

    def _on_close(self) -> None:
        self.hide()
        self.closed_by_user.emit()

    def mousePressEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
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
