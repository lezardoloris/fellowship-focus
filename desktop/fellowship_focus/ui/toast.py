"""Bottom-right toast notifications — non-intrusive push-ups."""

from PySide6.QtGui import QFont
from PySide6.QtCore import QEasingCurve, QPropertyAnimation, Qt, QTimer
from PySide6.QtWidgets import QFrame, QGraphicsOpacityEffect, QLabel, QVBoxLayout, QWidget

from fellowship_focus.ui.theme import ACCENT, BG_ELEVATED, EMBER, GREEN, font_sans


class Toast(QFrame):
  def __init__(self, parent: QWidget, title: str, message: str, kind: str = "info") -> None:
    super().__init__(parent)
    self.setObjectName("toast")
    border = ACCENT
    if kind == "success":
      border = GREEN
    elif kind == "warning":
      border = EMBER
    elif kind == "danger":
      border = "#9b2226"

    self.setStyleSheet(f"""
      QFrame#toast {{
        background: {BG_ELEVATED};
        border: 1px solid {border};
        border-left: 4px solid {border};
        border-radius: 14px;
        min-width: 300px;
        max-width: 380px;
      }}
    """)

    layout = QVBoxLayout(self)
    layout.setContentsMargins(14, 12, 14, 12)
    layout.setSpacing(4)

    title_lbl = QLabel(title)
    title_lbl.setObjectName("toastTitle")
    title_lbl.setFont(font_sans(13, QFont.Weight.DemiBold))
    title_lbl.setStyleSheet(f"color: {border}; border: none; background: transparent;")
    layout.addWidget(title_lbl)

    msg_lbl = QLabel(message)
    msg_lbl.setWordWrap(True)
    msg_lbl.setFont(font_sans(12))
    msg_lbl.setStyleSheet("color: #ccc; border: none;")
    layout.addWidget(msg_lbl)

    self._effect = QGraphicsOpacityEffect(self)
    self.setGraphicsEffect(self._effect)
    self._effect.setOpacity(0.0)

  def show_animated(self, duration_ms: int = 4000) -> None:
    self.show()
    self.raise_()

    fade_in = QPropertyAnimation(self._effect, b"opacity")
    fade_in.setDuration(280)
    fade_in.setStartValue(0.0)
    fade_in.setEndValue(1.0)
    fade_in.setEasingCurve(QEasingCurve.Type.OutCubic)
    fade_in.start()
    self._fade_in = fade_in

    QTimer.singleShot(duration_ms, self._dismiss)

  def _dismiss(self) -> None:
    fade_out = QPropertyAnimation(self._effect, b"opacity")
    fade_out.setDuration(320)
    fade_out.setStartValue(1.0)
    fade_out.setEndValue(0.0)
    fade_out.setEasingCurve(QEasingCurve.Type.InCubic)
    fade_out.finished.connect(self.deleteLater)
    fade_out.start()
    self._fade_out = fade_out


class ToastManager:
  def __init__(self, parent: QWidget) -> None:
    self._parent = parent
    self._toasts: list[Toast] = []

  def show(self, title: str, message: str, kind: str = "info", duration_ms: int = 2200) -> None:
    toast = Toast(self._parent, title, message, kind)
    margin = 20
    offset = sum(t.height() + 10 for t in self._toasts if t.isVisible())
    toast.adjustSize()
    # Anchor to the screen's bottom-right so toasts show even when the main
    # window is hidden — same corner as the float timer and the nudge.
    from PySide6.QtGui import QGuiApplication

    screen = self._parent.screen() if self._parent else None
    geo = (screen or QGuiApplication.primaryScreen()).availableGeometry()
    x = geo.right() - toast.width() - margin
    y = geo.bottom() - toast.height() - margin - offset
    toast.setParent(None)  # top-level so it can sit at screen edge
    from PySide6.QtCore import Qt as _Qt

    toast.setWindowFlags(
        _Qt.WindowType.Tool
        | _Qt.WindowType.FramelessWindowHint
        | _Qt.WindowType.WindowStaysOnTopHint
        | _Qt.WindowType.WindowDoesNotAcceptFocus
    )
    toast.setAttribute(_Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
    toast.move(max(margin, x), max(margin, y))
    self._toasts.append(toast)
    toast.destroyed.connect(lambda: self._toasts.remove(toast) if toast in self._toasts else None)
    toast.show_animated(duration_ms)

  def reposition(self) -> None:
    from PySide6.QtGui import QGuiApplication

    margin = 20
    screen = self._parent.screen() if self._parent else None
    geo = (screen or QGuiApplication.primaryScreen()).availableGeometry()
    y = geo.bottom() - margin
    for toast in reversed([t for t in self._toasts if t.isVisible()]):
      toast.adjustSize()
      y -= toast.height()
      x = geo.right() - toast.width() - margin
      toast.move(max(margin, x), y)
      y -= 10
