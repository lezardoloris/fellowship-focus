"""[HUD-H5] Shared notification chrome, desktop side.

The web's `.hud-panel` is CSS (augmented-ui clip + corner ticks); Qt has no
clip-path, so the same silhouette is painted here with a QPainterPath:
top-left and bottom-right corners clipped, a hairline border, and two ember
corner ticks. Colours are the web tokens from globals.css so a desktop
notification and its web twin read as the same product.

Style only. Timing and suppression policy stay in notifications.py.
"""

from __future__ import annotations

from PySide6.QtCore import QPointF, Qt
from PySide6.QtGui import QColor, QPainter, QPainterPath, QPen
from PySide6.QtWidgets import QWidget

# Web tokens (web/src/app/globals.css): --panel, --hairline, --accent.
PANEL = "#16171a"
HAIRLINE = "#2a2d31"
ACCENT = "#b8422e"

CLIP = 12.0
TICK_LEN = 10.0
TICK_INSET = 6.0


def hud_path(w: float, h: float, clip: float = CLIP) -> QPainterPath:
    """The tl-clip + br-clip silhouette used by `.hud-panel` on the web."""
    path = QPainterPath()
    path.moveTo(clip, 0)
    path.lineTo(w, 0)
    path.lineTo(w, h - clip)
    path.lineTo(w - clip, h)
    path.lineTo(0, h)
    path.lineTo(0, clip)
    path.closeSubpath()
    return path


class HudCard(QWidget):
    """Painted card background for the notification widgets.

    Use as the root container of a frameless card. The hosting top-level
    window must set WA_TranslucentBackground so the clipped corners are
    actually see-through instead of showing the window fill.
    """

    def __init__(self, parent: QWidget | None = None, border: str = HAIRLINE) -> None:
        super().__init__(parent)
        self._border = QColor(border)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, False)

    def set_border(self, color: str) -> None:
        self._border = QColor(color)
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 - Qt override
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        w = float(self.width()) - 1.0
        h = float(self.height()) - 1.0
        path = hud_path(w, h)
        path.translate(0.5, 0.5)
        painter.fillPath(path, QColor(PANEL))
        painter.setPen(QPen(self._border, 1))
        painter.drawPath(path)

        # Corner ticks: the HUD read comes from these more than from the clip.
        tick = QColor(ACCENT)
        tick.setAlphaF(0.5)
        painter.setPen(QPen(tick, 1))
        i = TICK_INSET
        painter.drawLine(QPointF(i, i), QPointF(i + TICK_LEN, i))
        painter.drawLine(QPointF(i, i), QPointF(i, i + TICK_LEN))
        painter.drawLine(QPointF(w - i, h - i), QPointF(w - i - TICK_LEN, h - i))
        painter.drawLine(QPointF(w - i, h - i), QPointF(w - i, h - i - TICK_LEN))
        painter.end()
