"""Heritage UI building blocks — cards, nav, focus ring."""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt, Signal, QPropertyAnimation, QEasingCurve, Property
from PySide6.QtGui import QColor, QFont, QPainter, QPen, QPixmap, QBrush
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

from fellowship_focus.ui.theme import (
    ACCENT,
    ACCENT_HOVER,
    BG,
    BG_ELEVATED,
    BG_SURFACE,
    BORDER,
    FG,
    MUTED,
    SUCCESS,
    font_display,
    font_sans,
    font_timer,
    ASSETS_DIR,
)


class GlassCard(QFrame):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("glassCard")


class ToggleSwitch(QWidget):
    """iOS-style pill toggle — Heritage terracotta when on."""

    toggled = Signal(bool)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFixedSize(52, 30)
        self._on = False
        self._thumb = 0.0
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setToolTip("Enable or disable the shield")

        self._anim = QPropertyAnimation(self, b"thumbPosition", self)
        self._anim.setDuration(180)
        self._anim.setEasingCurve(QEasingCurve.Type.OutCubic)

    def getThumbPosition(self) -> float:
        return self._thumb

    def setThumbPosition(self, value: float) -> None:
        self._thumb = value
        self.update()

    thumbPosition = Property(float, getThumbPosition, setThumbPosition)

    def isChecked(self) -> bool:
        return self._on

    def setChecked(self, on: bool, *, animate: bool = True) -> None:
        on = bool(on)
        if on == self._on and (on == (self._thumb > 0.5)):
            return
        self._on = on
        target = 1.0 if on else 0.0
        if animate:
            self._anim.stop()
            self._anim.setStartValue(self._thumb)
            self._anim.setEndValue(target)
            self._anim.start()
        else:
            self._thumb = target
            self.update()

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.setChecked(not self._on)
            self.toggled.emit(self._on)
        super().mousePressEvent(event)

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()
        pad = 3
        track_h = h - pad * 2
        track_w = w - pad * 2
        radius = track_h / 2

        off_color = QColor(BG_ELEVATED)
        on_color = QColor(ACCENT)
        t = self._thumb
        track = QColor(
            int(off_color.red() + (on_color.red() - off_color.red()) * t),
            int(off_color.green() + (on_color.green() - off_color.green()) * t),
            int(off_color.blue() + (on_color.blue() - off_color.blue()) * t),
        )
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QBrush(track))
        p.drawRoundedRect(pad, pad, track_w, track_h, radius, radius)

        thumb_d = track_h - 4
        thumb_x = pad + 2 + t * (track_w - thumb_d - 4)
        p.setBrush(QColor("#ffffff"))
        p.drawEllipse(int(thumb_x), pad + 2, int(thumb_d), int(thumb_d))
        p.end()


class ShieldToggle(GlassCard):
    """
    Primary blocker control — setting + live arm/disarm during focus.
    Signals:
      setting_changed(bool) — enable_website_blocker preference
      arm_requested() — turn shield on now (focus session)
      disarm_requested() — turn shield off now (may trigger guild penalty)
    """

    setting_changed = Signal(bool)
    arm_requested = Signal()
    disarm_requested = Signal()

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("shieldToggleCard")
        self._in_focus = False
        self._active = False
        self._enabled = True

        logo_path = ASSETS_DIR / "shield-logo.png"
        if not logo_path.exists():
            logo_path = ASSETS_DIR / "app-icon.png"
        self._logo = QLabel()
        self._logo.setFixedSize(52, 52)
        if logo_path.exists():
            pix = QPixmap(str(logo_path))
            self._logo.setPixmap(
                pix.scaled(52, 52, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
            )
        self._logo.setStyleSheet(f"border-radius: 10px; border: 1px solid {BORDER};")

        self._title = QLabel("Fellowship Shield")
        self._title.setFont(font_sans(16, QFont.Weight.DemiBold))
        self._title.setStyleSheet(f"color: {FG};")
        self._status = QLabel("Standby")
        self._status.setFont(font_sans(12, QFont.Weight.DemiBold))
        self._hint = QLabel("Arms automatically when you start a focus session")
        self._hint.setWordWrap(True)
        self._hint.setFont(font_sans(11))
        self._hint.setStyleSheet(f"color: {MUTED};")

        self._switch = ToggleSwitch()
        self._switch.toggled.connect(self._on_switch_toggled)
        self._switch_label = QLabel("OFF")
        self._switch_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._switch_label.setFont(font_sans(10, QFont.Weight.DemiBold))
        self._switch_label.setStyleSheet(f"color: {MUTED}; letter-spacing: 1px;")

        outer = QVBoxLayout(self)
        outer.setContentsMargins(20, 18, 20, 18)
        outer.setSpacing(12)

        row = QHBoxLayout()
        row.setSpacing(16)
        row.addWidget(self._logo)

        text_col = QVBoxLayout()
        text_col.setSpacing(4)
        text_col.addWidget(self._title)
        text_col.addWidget(self._status)
        text_col.addWidget(self._hint)
        row.addLayout(text_col, 1)

        switch_col = QVBoxLayout()
        switch_col.setAlignment(Qt.AlignmentFlag.AlignCenter)
        switch_col.addWidget(self._switch, alignment=Qt.AlignmentFlag.AlignCenter)
        switch_col.addWidget(self._switch_label)
        row.addLayout(switch_col)
        outer.addLayout(row)

        self._quick_off = QPushButton("Turn off shield")
        self._quick_off.setObjectName("dangerBtn")
        self._quick_off.setVisible(False)
        self._quick_off.clicked.connect(self.disarm_requested.emit)
        outer.addWidget(self._quick_off)

    def _on_switch_toggled(self, on: bool) -> None:
        if self._in_focus:
            if on and not self._active:
                self.arm_requested.emit()
            elif not on and self._active:
                self.disarm_requested.emit()
            else:
                self._sync_switch_visual()
            return
        self.setting_changed.emit(on)

    def _sync_switch_visual(self) -> None:
        show_on = self._active if self._in_focus else self._enabled
        self._switch.blockSignals(True)
        self._switch.setChecked(show_on, animate=False)
        self._switch.blockSignals(False)
        self._switch_label.setText("ON" if show_on else "OFF")
        self._switch_label.setStyleSheet(
            f"color: {ACCENT}; letter-spacing: 1px;" if show_on else f"color: {MUTED}; letter-spacing: 1px;"
        )

    def sync_state(self, *, enabled: bool, active: bool, in_focus: bool) -> None:
        self._enabled = enabled
        self._active = active
        self._in_focus = in_focus
        self._sync_switch_visual()

        if in_focus and active:
            self._status.setText("● Shield active")
            self._status.setStyleSheet(f"color: {SUCCESS};")
            self._hint.setText("Twitter, YouTube Shorts, TikTok and your blocklist are filtered.")
            self._quick_off.setVisible(True)
            self.setStyleSheet(f"#shieldToggleCard {{ border-color: rgba(45, 106, 79, 0.55); }}")
        elif in_focus and enabled and not active:
            self._status.setText("Shield paused")
            self._status.setStyleSheet(f"color: {ACCENT_HOVER};")
            self._hint.setText("Tap the switch to re-arm — or use a timed pause below.")
            self._quick_off.setVisible(False)
            self.setStyleSheet("")
        elif enabled:
            self._status.setText("Armed for focus")
            self._status.setStyleSheet(f"color: {ACCENT};")
            self._hint.setText("Starts blocking when you launch a focus session from the Focus tab.")
            self._quick_off.setVisible(False)
            self.setStyleSheet("")
        else:
            self._status.setText("Shield off")
            self._status.setStyleSheet(f"color: {MUTED};")
            self._hint.setText("Distractions won't be blocked — guild bypass rules won't apply.")
            self._quick_off.setVisible(False)
            self.setStyleSheet(f"#shieldToggleCard {{ border-color: {BORDER}; opacity: 0.92; }}")


class HeroBanner(QWidget):
    """Image hero strip — Heritage dark with generated artwork."""

    def __init__(
        self,
        image_name: str,
        title: str,
        subtitle: str = "",
        height: int = 132,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setFixedHeight(height)
        self.setObjectName("heroBanner")

        candidates = [
            ASSETS_DIR / image_name,
            ASSETS_DIR / "focus-quest.jpg",
            ASSETS_DIR / "hero.jpg",
        ]
        pix = QPixmap()
        for path in candidates:
            if path.exists():
                pix = QPixmap(str(path))
                if not pix.isNull():
                    break

        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 0, 20, 0)
        layout.setSpacing(16)

        if not pix.isNull():
            thumb = QLabel()
            thumb.setFixedSize(72, 72)
            thumb.setPixmap(
                pix.scaled(72, 72, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)
            )
            thumb.setStyleSheet(f"border-radius: 8px; border: 1px solid {BORDER};")
            layout.addWidget(thumb)

        text_col = QVBoxLayout()
        text_col.setSpacing(2)
        t = QLabel(title)
        t.setFont(font_sans(18, QFont.Weight.DemiBold))
        t.setStyleSheet("color: #f4f4f5;")
        text_col.addWidget(t)
        if subtitle:
            s = QLabel(subtitle)
            s.setWordWrap(True)
            s.setFont(font_sans(11))
            s.setStyleSheet("color: #9ca3af;")
            text_col.addWidget(s)
        layout.addLayout(text_col, 1)


class BlockerIdentityPanel(GlassCard):
    """Branded shield identity for the website blocker."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(16)

        logo_path = ASSETS_DIR / "shield-logo.png"
        if not logo_path.exists():
            logo_path = ASSETS_DIR / "app-icon.png"
        if logo_path.exists():
            logo = QLabel()
            logo.setFixedSize(64, 64)
            pix = QPixmap(str(logo_path))
            logo.setPixmap(pix.scaled(64, 64, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
            layout.addWidget(logo)

        col = QVBoxLayout()
        col.setSpacing(4)
        title = QLabel("FELLOWSHIP SHIELD")
        title.setFont(font_display(13, bold=True))
        title.setStyleSheet("color: #f4f4f5; letter-spacing: 2px;")
        sub = QLabel("System-wide blocker · Shorts, Reels, distractions")
        sub.setFont(font_sans(11))
        sub.setObjectName("mutedLabel")
        sub.setWordWrap(True)
        badge = QLabel("You cannot pass.")
        badge.setFont(font_sans(11, QFont.Weight.DemiBold))
        badge.setStyleSheet(f"color: {ACCENT};")
        col.addWidget(title)
        col.addWidget(sub)
        col.addWidget(badge)
        layout.addLayout(col, 1)

        preview_path = ASSETS_DIR / "cannot-pass.jpg"
        if preview_path.exists():
            preview = QLabel()
            preview.setFixedSize(120, 72)
            pix = QPixmap(str(preview_path))
            preview.setPixmap(
                pix.scaled(120, 72, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)
            )
            preview.setStyleSheet(f"border-radius: 6px; border: 1px solid {BORDER};")
            layout.addWidget(preview)


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
