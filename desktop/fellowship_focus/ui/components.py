"""Heritage UI building blocks — cards, nav, focus ring."""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPen
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.ui.theme import ACCENT, ACCENT_HOVER, BG, BORDER, font_display, font_sans, font_timer


class GlassCard(QFrame):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("glassCard")


class MutedLabel(QLabel):
    def __init__(self, text: str = "", parent: QWidget | None = None) -> None:
        super().__init__(text, parent)
        self.setObjectName("mutedLabel")


class PageHeader(QWidget):
    def __init__(self, title: str, subtitle: str = "", parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 8)
        layout.setSpacing(4)
        t = QLabel(title)
        t.setObjectName("pageTitle")
        t.setFont(font_sans(16, QFont.Weight.DemiBold))
        layout.addWidget(t)
        if subtitle:
            s = MutedLabel(subtitle)
            s.setWordWrap(True)
            layout.addWidget(s)


class StatusPill(QLabel):
    def __init__(self, text: str, kind: str = "neutral", parent: QWidget | None = None) -> None:
        super().__init__(text, parent)
        self.setObjectName(f"statusPill_{kind}")


class PageScaffold(QScrollArea):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWidgetResizable(True)
        self.setFrameShape(QFrame.Shape.NoFrame)
        self.setObjectName("pageScroll")
        self._content = QWidget()
        self._content.setObjectName("pageContent")
        self._layout = QVBoxLayout(self._content)
        self._layout.setContentsMargins(24, 24, 24, 24)
        self._layout.setSpacing(16)
        self.setWidget(self._content)

    def add(self, widget: QWidget) -> None:
        self._layout.addWidget(widget)

    def add_stretch(self) -> None:
        self._layout.addStretch()


class KpiCard(GlassCard):
    def __init__(self, label: str, value: str = "—", hint: str = "", parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("kpiCard")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(6)
        self._label = QLabel(label.upper())
        self._label.setObjectName("kpiLabel")
        self._label.setFont(font_sans(11, QFont.Weight.DemiBold))
        self._value = QLabel(value)
        self._value.setObjectName("kpiValue")
        self._value.setFont(font_sans(28, QFont.Weight.DemiBold))
        self._hint = QLabel(hint)
        self._hint.setObjectName("mutedLabel")
        self._hint.setFont(font_sans(11))
        layout.addWidget(self._label)
        layout.addWidget(self._value)
        if hint:
            layout.addWidget(self._hint)

    def set_value(self, value: str, hint: str = "") -> None:
        self._value.setText(value)
        if hint:
            self._hint.setText(hint)


class FocusRing(QWidget):
    """Circular focus timer with terracotta progress arc."""

    clicked = Signal()

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setMinimumSize(280, 280)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self._progress = 1.0
        self._time_text = "45:00"
        self._phase = "Ready"
        self._active = False

    def set_state(self, time_text: str, phase: str, progress: float, active: bool) -> None:
        self._time_text = time_text
        self._phase = phase
        self._progress = max(0.0, min(1.0, progress))
        self._active = active
        self.update()

    def paintEvent(self, event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        size = min(self.width(), self.height())
        cx, cy = self.width() // 2, self.height() // 2
        radius = size // 2 - 24

        painter.setPen(QPen(QColor(BORDER), 10, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
        painter.drawEllipse(cx - radius, cy - radius, radius * 2, radius * 2)

        if self._progress > 0:
            arc_color = QColor(ACCENT_HOVER if self._active else ACCENT)
            pen = QPen(arc_color, 10, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap)
            painter.setPen(pen)
            span = int(360 * 16 * self._progress)
            painter.drawArc(cx - radius, cy - radius, radius * 2, radius * 2, 90 * 16, -span)

        painter.setPen(QColor("#f4f4f5"))
        timer_font = font_timer(max(44, size // 6))
        painter.setFont(timer_font)
        painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, self._time_text)

        phase_font = font_sans(11, QFont.Weight.DemiBold)
        painter.setFont(phase_font)
        painter.setPen(QColor("#9ca3af"))
        phase_rect = self.rect().adjusted(0, size // 5, 0, 0)
        painter.drawText(phase_rect, Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop, self._phase.upper())


class NavSidebar(QWidget):
    changed = Signal(int)

    NAV = [
        ("Fellowship", "Guild dashboard"),
        ("Overview", "KPIs & ladder"),
        ("Tasks", "Quest list"),
        ("Focus", "Pomodoro timer"),
        ("Blocker", "Site shield"),
        ("Settings", "Connect & OKRs"),
    ]

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("sidebarPanel")
        self.setFixedWidth(200)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 16)
        layout.setSpacing(0)

        brand_wrap = QWidget()
        brand_wrap.setObjectName("brandWrap")
        bl = QVBoxLayout(brand_wrap)
        bl.setContentsMargins(16, 24, 16, 20)
        bl.setSpacing(2)
        title = QLabel("FELLOWSHIP")
        title.setObjectName("brandTitle")
        title.setFont(font_display(11, bold=True))
        sub = QLabel("FOCUS")
        sub.setObjectName("brandSub")
        sub.setFont(font_display(11, bold=True))
        bl.addWidget(title)
        bl.addWidget(sub)
        layout.addWidget(brand_wrap)

        self._buttons: list[QPushButton] = []
        nav_wrap = QWidget()
        nav_layout = QVBoxLayout(nav_wrap)
        nav_layout.setContentsMargins(8, 0, 8, 0)
        nav_layout.setSpacing(2)
        for i, (label, hint) in enumerate(self.NAV):
            btn = QPushButton(label)
            btn.setObjectName("navItem")
            btn.setCheckable(True)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setToolTip(hint)
            btn.setFont(font_sans(14, QFont.Weight.Medium))
            btn.clicked.connect(lambda checked, idx=i: self.set_current(idx))
            nav_layout.addWidget(btn)
            self._buttons.append(btn)
        layout.addWidget(nav_wrap)
        layout.addStretch()

        self._status = QLabel("")
        self._status.setObjectName("sidebarStatus")
        self._status.setWordWrap(True)
        self._status.setFont(font_sans(10))
        self._status.setContentsMargins(16, 0, 16, 0)
        layout.addWidget(self._status)
        self.set_current(0)

    def set_current(self, index: int) -> None:
        for i, btn in enumerate(self._buttons):
            btn.setChecked(i == index)
        self.changed.emit(index)

    def set_status(self, text: str) -> None:
        self._status.setText(text)

    def current_index(self) -> int:
        for i, btn in enumerate(self._buttons):
            if btn.isChecked():
                return i
        return 0
