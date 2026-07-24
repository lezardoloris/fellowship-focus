"""Post-focus session recap card — bottom-right, never steals focus."""

from __future__ import annotations

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCursor, QFont, QGuiApplication
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.ui.theme import FG, MUTED


class SessionRecap(QWidget):
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
            QWidget#srRoot {{
                background: #16181a;
                border: 1px solid #34383c;
                border-radius: 12px;
            }}
            QLabel#srEyebrow {{ color: #c4653a; font-size: 10px; }}
            QLabel#srTitle {{ color: {FG}; font-size: 15px; }}
            QLabel#srSub {{ color: {MUTED}; font-size: 11px; }}
            QPushButton {{
                border: 1px solid #3a3d40; border-radius: 8px;
                padding: 6px 10px; font-size: 12px; font-weight: 600;
                color: {FG}; background: rgba(255,255,255,0.05);
            }}
            QPushButton:hover {{ background: rgba(255,255,255,0.12); }}
            QPushButton#srPrimary {{ background: #b8422e; border-color: #b8422e; color: #fff; }}
            QPushButton#srClose {{
                border: none; background: transparent; color: {MUTED};
                font-size: 15px; padding: 0 6px; min-width: 22px;
            }}
            """
        )

        root = QWidget(self)
        root.setObjectName("srRoot")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(root)

        box = QVBoxLayout(root)
        box.setContentsMargins(14, 10, 12, 12)
        box.setSpacing(8)

        head = QHBoxLayout()
        text_col = QVBoxLayout()
        text_col.setSpacing(2)
        self._eyebrow = QLabel("SESSION COMPLETE")
        self._eyebrow.setObjectName("srEyebrow")
        self._title = QLabel("")
        self._title.setObjectName("srTitle")
        f = QFont()
        f.setWeight(QFont.Weight.DemiBold)
        self._title.setFont(f)
        self._sub = QLabel("")
        self._sub.setObjectName("srSub")
        self._sub.setWordWrap(True)
        text_col.addWidget(self._eyebrow)
        text_col.addWidget(self._title)
        text_col.addWidget(self._sub)
        head.addLayout(text_col, 1)
        close = QPushButton("✕")
        close.setObjectName("srClose")
        close.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        close.clicked.connect(self._on_dismiss)
        head.addWidget(close, 0, Qt.AlignmentFlag.AlignTop)
        box.addLayout(head)

        goal_row = QHBoxLayout()
        goal_row.setSpacing(6)
        self._goal_label = QLabel("Finished what you wanted?")
        self._goal_label.setObjectName("srSub")
        goal_row.addWidget(self._goal_label)
        for key, label in (("goal_yes", "Yes"), ("goal_no", "Not yet")):
            b = QPushButton(label)
            b.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            b.clicked.connect(lambda _=False, k=key: self._pick(k))
            goal_row.addWidget(b)
        box.addLayout(goal_row)

        self._btn_row = QHBoxLayout()
        self._btn_row.setSpacing(6)
        box.addLayout(self._btn_row)

        self._auto = QTimer(self)
        self._auto.setSingleShot(True)
        self._auto.timeout.connect(self._on_dismiss)

    def show_recap(self, data: dict, timeout_ms: int = 0) -> None:
        mins = int(data.get("minutes") or 0)
        planned = data.get("planned_minutes")
        title = f"{mins} min" if not planned else f"{mins} / {planned} min"
        streak = data.get("streak")
        xp = data.get("xp")
        value = data.get("value_line") or "Nice work."
        bits = [value]
        if streak:
            bits.append(f"🔥 {streak}")
        if xp:
            bits.append(f"+{xp} XP")
        focusing = data.get("focusing_now")
        if focusing:
            bits.append(f"{focusing} focusing with you")
        self._title.setText(title)
        self._sub.setText(" · ".join(bits))

        while self._btn_row.count():
            item = self._btn_row.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        for key, label, primary in (
            ("break", "Break", True),
            ("extend", "+10", False),
            ("again", "Again", False),
            ("close", "Close", False),
        ):
            b = QPushButton(label)
            if primary:
                b.setObjectName("srPrimary")
            b.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            b.clicked.connect(lambda _=False, k=key: self._pick(k))
            self._btn_row.addWidget(b)

        self.adjustSize()
        self._anchor()
        self.show()
        if timeout_ms > 0:
            self._auto.start(timeout_ms)
        else:
            self._auto.stop()

    def _anchor(self) -> None:
        screen = QGuiApplication.primaryScreen()
        if not screen:
            return
        geo = screen.availableGeometry()
        self.move(geo.right() - self.width() - 16, geo.bottom() - self.height() - 16)

    def _pick(self, key: str) -> None:
        self._auto.stop()
        self.hide()
        self.chosen.emit(key)

    def _on_dismiss(self) -> None:
        self._auto.stop()
        self.hide()
        self.dismissed.emit()
