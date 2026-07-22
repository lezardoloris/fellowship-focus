"""Discreet bottom-right prompt: 'Start a focus session?'

Appears when the user has been actively working for a while with no session
running and the main window hidden — so time at the keyboard actually gets
tracked. Two glyphs: green to start, red to dismiss. Deliberately tiny,
frameless, never steals focus.
"""

from __future__ import annotations

import sys

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCursor, QFont
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.ui.theme import FG, MUTED


class SessionNudge(QWidget):
    """Frameless always-on-top 'start a session?' card."""

    accepted = Signal()
    dismissed = Signal()

    def __init__(self, parent=None) -> None:
        flags = (
            Qt.WindowType.Tool
            | Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.WindowDoesNotAcceptFocus
        )
        super().__init__(parent, flags)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
        self.setFixedHeight(56)

        self.setStyleSheet(
            f"""
            QWidget#nudgeRoot {{
                background: #16181a;
                border: 1px solid #34383c;
                border-radius: 12px;
            }}
            QLabel#nudgeText {{ color: {FG}; font-size: 13px; }}
            QLabel#nudgeSub {{ color: {MUTED}; font-size: 10px; }}
            QPushButton#accept, QPushButton#decline {{
                border: none; border-radius: 8px;
                font-size: 15px; font-weight: 700;
                min-width: 34px; max-width: 34px; min-height: 34px; max-height: 34px;
            }}
            QPushButton#accept {{ background: rgba(45,106,79,0.22); color: #4ade80; }}
            QPushButton#accept:hover {{ background: rgba(45,106,79,0.40); }}
            QPushButton#decline {{ background: rgba(155,34,38,0.18); color: #f87171; }}
            QPushButton#decline:hover {{ background: rgba(155,34,38,0.34); }}
            """
        )

        root = QWidget(self)
        root.setObjectName("nudgeRoot")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(root)

        row = QHBoxLayout(root)
        row.setContentsMargins(14, 8, 10, 8)
        row.setSpacing(12)

        text_col = QVBoxLayout()
        text_col.setSpacing(1)
        title = QLabel("Start a focus session?")
        title.setObjectName("nudgeText")
        f = QFont()
        f.setWeight(QFont.Weight.DemiBold)
        title.setFont(f)
        sub = QLabel("Track this deep-work stretch")
        sub.setObjectName("nudgeSub")
        text_col.addWidget(title)
        text_col.addWidget(sub)
        row.addLayout(text_col, 1)

        decline = QPushButton("✕")  # ✕
        decline.setObjectName("decline")
        decline.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        decline.setToolTip("Not now")
        decline.clicked.connect(self._on_decline)
        row.addWidget(decline)

        accept = QPushButton("✓")  # ✓
        accept.setObjectName("accept")
        accept.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        accept.setToolTip("Start focus")
        accept.clicked.connect(self._on_accept)
        row.addWidget(accept)

        # Self-dismiss if ignored — a nudge that lingers becomes nagging.
        self._auto = QTimer(self)
        self._auto.setSingleShot(True)
        self._auto.timeout.connect(self._on_decline)

    def show_nudge(self, timeout_ms: int = 15000) -> None:
        self.adjustSize()
        self._place_bottom_right()
        self.show()
        self._raise()
        self._auto.start(timeout_ms)

    def _raise(self) -> None:
        self.raise_()
        if sys.platform == "win32":
            try:
                import ctypes

                hwnd = int(self.winId())
                ctypes.windll.user32.SetWindowPos(
                    hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0040
                )
            except Exception:
                pass

    def _place_bottom_right(self) -> None:
        from PySide6.QtGui import QGuiApplication

        screen = self.screen() or QGuiApplication.primaryScreen()
        if not screen:
            return
        geo = screen.availableGeometry()
        self.setFixedWidth(300)
        self.adjustSize()
        # Sit just above where the float timer lives, so both can coexist.
        self.move(geo.right() - self.width() - 16, geo.bottom() - self.height() - 64)

    def _on_accept(self) -> None:
        self._auto.stop()
        self.hide()
        self.accepted.emit()

    def _on_decline(self) -> None:
        self._auto.stop()
        self.hide()
        self.dismissed.emit()
