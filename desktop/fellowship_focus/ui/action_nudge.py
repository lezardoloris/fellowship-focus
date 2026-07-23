"""Discreet bottom-right action prompt with up to three buttons.

Same spirit as SessionNudge: frameless, always-on-top, never steals focus,
anchored bottom-right so it shows even when the main window is hidden. Used for
productivity moments — end of focus (Break / +10 min / Stop), end of break
(Resume) — where a quick choice keeps momentum without opening the app.
"""

from __future__ import annotations

import sys

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCursor, QFont, QGuiApplication
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.ui.theme import FG, MUTED


class ActionNudge(QWidget):
    """Frameless card: a title, a subtitle, and 1-3 action buttons.

    Emit `chosen(key)` with the button's key, or `dismissed` on timeout / ✕.
    """

    chosen = Signal(str)
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

        self.setStyleSheet(
            f"""
            QWidget#anRoot {{
                background: #16181a;
                border: 1px solid #34383c;
                border-radius: 12px;
            }}
            QLabel#anTitle {{ color: {FG}; font-size: 13px; }}
            QLabel#anSub {{ color: {MUTED}; font-size: 10px; }}
            QPushButton {{
                border: 1px solid #3a3d40; border-radius: 8px;
                padding: 6px 12px; font-size: 12px; font-weight: 600;
                color: {FG}; background: rgba(255,255,255,0.05);
            }}
            QPushButton:hover {{ background: rgba(255,255,255,0.12); }}
            QPushButton#anPrimary {{ background: #b8422e; border-color: #b8422e; color: #fff; }}
            QPushButton#anPrimary:hover {{ background: #c46551; }}
            QPushButton#anClose {{
                border: none; background: transparent; color: {MUTED};
                font-size: 15px; padding: 0 6px; min-width: 22px;
            }}
            QPushButton#anClose:hover {{ color: {FG}; }}
            """
        )

        root = QWidget(self)
        root.setObjectName("anRoot")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(root)

        box = QVBoxLayout(root)
        box.setContentsMargins(14, 10, 12, 12)
        box.setSpacing(8)

        head = QHBoxLayout()
        head.setSpacing(8)
        text_col = QVBoxLayout()
        text_col.setSpacing(1)
        self._title = QLabel("")
        self._title.setObjectName("anTitle")
        f = QFont()
        f.setWeight(QFont.Weight.DemiBold)
        self._title.setFont(f)
        self._sub = QLabel("")
        self._sub.setObjectName("anSub")
        text_col.addWidget(self._title)
        text_col.addWidget(self._sub)
        head.addLayout(text_col, 1)

        close = QPushButton("✕")
        close.setObjectName("anClose")
        close.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        close.clicked.connect(self._on_dismiss)
        head.addWidget(close, 0, Qt.AlignmentFlag.AlignTop)
        box.addLayout(head)

        self._btn_row = QHBoxLayout()
        self._btn_row.setSpacing(6)
        box.addLayout(self._btn_row)

        self._auto = QTimer(self)
        self._auto.setSingleShot(True)
        self._auto.timeout.connect(self._on_dismiss)

    def show_actions(
        self,
        title: str,
        subtitle: str,
        actions: list[tuple[str, str, bool]],
        timeout_ms: int = 15000,
    ) -> None:
        """actions: list of (key, label, is_primary)."""
        self._title.setText(title)
        self._sub.setText(subtitle)
        # Clear old buttons.
        while self._btn_row.count():
            item = self._btn_row.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        for key, label, primary in actions:
            b = QPushButton(label)
            if primary:
                b.setObjectName("anPrimary")
            b.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            b.clicked.connect(lambda _=False, k=key: self._on_choose(k))
            self._btn_row.addWidget(b)

        self.setFixedWidth(320)
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

                ctypes.windll.user32.SetWindowPos(
                    int(self.winId()), -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0040
                )
            except Exception:
                pass

    def _place_bottom_right(self) -> None:
        screen = self.screen() or QGuiApplication.primaryScreen()
        if not screen:
            return
        geo = screen.availableGeometry()
        self.adjustSize()
        # Sit above the float timer / session nudge zone.
        self.move(geo.right() - self.width() - 16, geo.bottom() - self.height() - 110)

    def _on_choose(self, key: str) -> None:
        self._auto.stop()
        self.hide()
        self.chosen.emit(key)

    def _on_dismiss(self) -> None:
        self._auto.stop()
        self.hide()
        self.dismissed.emit()
