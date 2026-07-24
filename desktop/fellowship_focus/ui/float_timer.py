"""Always-on-top focus timer — bottom-right of the screen.

Survives main-window hide/minimize. Driven by the web bridge, with an optional
local tick so the countdown keeps moving if the WebView is throttled.

A premium capsule by default; a chevron expands a bigger card (add time, break,
pause, music). The expanded panel only opens/closes on an explicit user action
— the per-second time sync never touches it, so it no longer flickers shut.
"""

from __future__ import annotations

import sys
import time

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCursor, QFont, QGuiApplication
from PySide6.QtWidgets import (
    QComboBox,
    QHBoxLayout,
    QLabel,
    QMenu,
    QPushButton,
    QSlider,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.config import load_config, save_config
from fellowship_focus.ui.theme import ACCENT, FG, MUTED, font_timer

# Local palette — deeper, more premium than the shared chrome.
CARD_BG = "#17191c"
CARD_BORDER = "#2c3034"
BTN_BG = "#232629"
BTN_BG_HOVER = "#2e3236"
BREAK_BLUE = "#5b9bd5"


class FloatTimerWindow(QWidget):
    """Frameless, always-on-top session indicator — capsule + expandable card."""

    closed_by_user = Signal()
    dismissed_by_user = Signal()
    open_app_requested = Signal()
    remaining_changed = Signal(int, str)  # remaining, label
    add_time_requested = Signal(int)  # minutes
    break_now_requested = Signal()
    snooze_requested = Signal()
    restart_requested = Signal()
    pause_requested = Signal()
    resume_requested = Signal()
    music_toggle_requested = Signal()
    music_select_requested = Signal(int)
    music_volume_requested = Signal(float)

    def __init__(self, parent=None) -> None:
        flags = (
            Qt.WindowType.Tool
            | Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.WindowDoesNotAcceptFocus
        )
        super().__init__(parent, flags)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)

        self._remaining = 0
        self._label = "FOCUS"
        self._paused = False
        self._awaiting_break = False
        self._expanded = False
        self._drag_pos = None
        self._dragged = False
        self._placed = False
        self._last_web_sync = 0.0
        self._session_active = False
        self._dismissed = False
        self._music_tracks: list[str] = []
        self._music_index = -1
        self._music_playing = False
        self._music_volume = 0.5

        self.setStyleSheet(self._qss())

        root = QWidget(self)
        root.setObjectName("floatRoot")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(12, 12, 12, 12)  # room for the drop shadow
        outer.addWidget(root)

        col = QVBoxLayout(root)
        col.setContentsMargins(18, 12, 12, 14)
        col.setSpacing(12)

        # ── Header row: dot · time · phase · expand · close ──
        head = QHBoxLayout()
        head.setSpacing(12)

        self._dot = QLabel("●")
        self._dot.setObjectName("statusDot")
        self._dot.setFixedWidth(14)
        self._dot.setAlignment(Qt.AlignmentFlag.AlignCenter)
        head.addWidget(self._dot)

        self._time = QLabel("00:00")
        self._time.setObjectName("timeLabel")
        self._time.setFont(font_timer(30))
        head.addWidget(self._time)
        head.addStretch(1)

        # Kept for state (REST?/PAUSED logic) but no longer shown — the dot
        # colour already tells focus vs break, and the label read as clutter.
        self._phase = QLabel("FOCUS")
        self._phase.setObjectName("phaseLabel")
        self._phase.setVisible(False)

        self._expand_btn = QPushButton("⌄")
        self._expand_btn.setObjectName("iconBtn")
        self._expand_btn.setFixedSize(34, 34)
        self._expand_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._expand_btn.setToolTip("More")
        self._expand_btn.clicked.connect(self._toggle_expand)
        head.addWidget(self._expand_btn)

        close = QPushButton("✕")
        close.setObjectName("iconBtn")
        close.setFixedSize(34, 34)
        close.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        close.setToolTip("Hide (session keeps running)")
        close.clicked.connect(self._on_dismiss)
        head.addWidget(close)

        col.addLayout(head)

        # ── Expandable panel ──
        self._panel = QWidget()
        pcol = QVBoxLayout(self._panel)
        pcol.setContentsMargins(0, 0, 0, 0)
        pcol.setSpacing(10)

        # add-time row — compact chips (+5 / +10) plus a Restart for when you
        # stepped away and the running session no longer means anything.
        add_row = QHBoxLayout()
        add_row.setSpacing(8)
        for mins in (5, 10):
            b = QPushButton(f"+{mins}")
            b.setObjectName("timeChip")
            b.setMinimumHeight(34)
            b.setFixedWidth(52)
            b.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            b.setToolTip(f"Add {mins} minutes")
            b.clicked.connect(lambda _=False, m=mins: self.add_time_requested.emit(m))
            add_row.addWidget(b)
        self._restart_btn = QPushButton("↻  Restart")
        self._restart_btn.setObjectName("chunkBtn")
        self._restart_btn.setMinimumHeight(34)
        self._restart_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._restart_btn.setToolTip("Went AFK? Start this session over from the top")
        self._restart_btn.clicked.connect(self.restart_requested.emit)
        add_row.addWidget(self._restart_btn, 1)
        pcol.addLayout(add_row)

        # break / pause row
        act_row = QHBoxLayout()
        act_row.setSpacing(10)
        self._break_btn = QPushButton("Break")
        self._break_btn.setObjectName("primaryBtn")
        self._break_btn.setMinimumHeight(40)
        self._break_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._break_btn.clicked.connect(self.break_now_requested.emit)
        self._snooze_btn = QPushButton("Remind 5m")
        self._snooze_btn.setObjectName("chunkBtn")
        self._snooze_btn.setMinimumHeight(40)
        self._snooze_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._snooze_btn.clicked.connect(self.snooze_requested.emit)
        self._pause_btn = QPushButton("⏸")
        self._pause_btn.setObjectName("glyphBtn")
        self._pause_btn.setMinimumHeight(40)
        self._pause_btn.setFixedWidth(46)
        self._pause_btn.setToolTip("Pause")
        self._pause_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._pause_btn.clicked.connect(self._on_pause_resume)
        act_row.addWidget(self._break_btn)
        act_row.addWidget(self._snooze_btn)
        act_row.addWidget(self._pause_btn)
        pcol.addLayout(act_row)

        # music row
        music_row = QHBoxLayout()
        music_row.setSpacing(10)
        self._track = QComboBox()
        self._track.setMinimumHeight(38)
        self._track.currentIndexChanged.connect(self._on_track_changed)
        music_row.addWidget(self._track, 1)
        self._play_btn = QPushButton("▶")
        self._play_btn.setObjectName("glyphBtn")
        self._play_btn.setMinimumHeight(38)
        self._play_btn.setFixedWidth(46)
        self._play_btn.setToolTip("Play")
        self._play_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._play_btn.clicked.connect(self.music_toggle_requested.emit)
        music_row.addWidget(self._play_btn)
        pcol.addLayout(music_row)

        vol_row = QHBoxLayout()
        vol_row.setSpacing(10)
        vlbl = QLabel("Vol")
        vlbl.setObjectName("volLabel")
        vol_row.addWidget(vlbl)
        self._vol = QSlider(Qt.Orientation.Horizontal)
        self._vol.setRange(0, 100)
        self._vol.setValue(50)
        self._vol.valueChanged.connect(self._on_vol_changed)
        vol_row.addWidget(self._vol, 1)
        pcol.addLayout(vol_row)

        self._panel.setVisible(False)
        col.addWidget(self._panel)

        self._tick = QTimer(self)
        self._tick.setInterval(1000)
        self._tick.timeout.connect(self._on_tick)

        self._topmost = QTimer(self)
        self._topmost.setInterval(2500)
        self._topmost.timeout.connect(self._assert_topmost)

        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._context_menu)

        # Media/transport glyphs (▶ ⏸ ↻ ⌃ ⌄ ✕) live in the Unicode symbol
        # block — pin a font that carries them so they never fall back to tofu.
        if sys.platform == "win32":
            glyph_font = QFont("Segoe UI Symbol")
            for b in (
                self._expand_btn,
                close,
                self._pause_btn,
                self._play_btn,
                self._restart_btn,
            ):
                b.setFont(glyph_font)

        self._render()

    # ── Styling ──────────────────────────────────────────────

    def _qss(self) -> str:
        return f"""
        QWidget#floatRoot {{
            background: {CARD_BG};
            border: 1px solid {CARD_BORDER};
            border-radius: 18px;
        }}
        QLabel#timeLabel {{ color: {FG}; background: transparent; }}
        QLabel#statusDot {{ background: transparent; font-size: 13px; }}
        QLabel#phaseLabel {{
            color: {MUTED}; background: transparent;
            font-size: 11px; font-weight: 600; letter-spacing: 2px;
        }}
        QLabel#volLabel {{ color: {MUTED}; background: transparent; font-size: 11px; }}
        QPushButton#iconBtn {{
            background: {BTN_BG}; color: {MUTED};
            border: none; border-radius: 17px; font-size: 15px;
        }}
        QPushButton#iconBtn:hover {{ background: {BTN_BG_HOVER}; color: {FG}; }}
        QPushButton#chunkBtn {{
            background: {BTN_BG}; color: {FG};
            border: 1px solid {CARD_BORDER}; border-radius: 11px;
            font-size: 13px; font-weight: 600; padding: 0 10px;
        }}
        QPushButton#chunkBtn:hover {{ background: {BTN_BG_HOVER}; border-color: {ACCENT}; }}
        QPushButton#timeChip {{
            background: {BTN_BG}; color: {MUTED};
            border: 1px solid {CARD_BORDER}; border-radius: 10px;
            font-size: 13px; font-weight: 700;
        }}
        QPushButton#timeChip:hover {{ background: {BTN_BG_HOVER}; color: {FG}; border-color: {ACCENT}; }}
        QPushButton#glyphBtn {{
            background: {BTN_BG}; color: {FG};
            border: 1px solid {CARD_BORDER}; border-radius: 11px;
            font-size: 15px; font-weight: 400;
        }}
        QPushButton#glyphBtn:hover {{ background: {BTN_BG_HOVER}; border-color: {ACCENT}; }}
        QPushButton#primaryBtn {{
            background: {ACCENT}; color: #fff;
            border: none; border-radius: 11px;
            font-size: 13px; font-weight: 700; padding: 0 10px;
        }}
        QPushButton#primaryBtn:hover {{ background: #c46551; }}
        QComboBox {{
            background: {BTN_BG}; color: {FG};
            border: 1px solid {CARD_BORDER}; border-radius: 11px;
            padding: 4px 12px; font-size: 12px;
        }}
        QComboBox::drop-down {{ border: none; width: 22px; }}
        QComboBox QAbstractItemView {{
            background: {CARD_BG}; color: {FG};
            selection-background-color: {ACCENT};
        }}
        QSlider::groove:horizontal {{ height: 5px; background: {CARD_BORDER}; border-radius: 3px; }}
        QSlider::sub-page:horizontal {{ background: {ACCENT}; border-radius: 3px; }}
        QSlider::handle:horizontal {{
            width: 16px; height: 16px; margin: -6px 0;
            background: #fff; border-radius: 8px;
        }}
        """

    # ── Public API (called from MainWindow / web bridge) ─────

    def update_timer(
        self,
        remaining: int,
        label: str = "FOCUS",
        paused: bool = False,
        awaiting_break: bool = False,
        expanded: bool | None = None,
    ) -> None:
        self._remaining = max(0, int(remaining))
        self._label = (label or "FOCUS").upper()[:8]
        self._paused = bool(paused)
        self._awaiting_break = bool(awaiting_break)
        # Only an explicit request or a break decision changes the panel — never
        # the per-second sync, which is what used to snap it shut.
        if expanded is not None and expanded != self._expanded:
            self._expanded = bool(expanded)
            self._apply_expanded()
        elif awaiting_break and not self._expanded:
            self._expanded = True
            self._apply_expanded()
        self._last_web_sync = time.monotonic()
        self._session_active = True
        self._render()
        if self._paused or self._awaiting_break:
            self._tick.stop()
        elif not self._tick.isActive():
            self._tick.start()
        self.remaining_changed.emit(self._remaining, self._label)
        # REST? must surface even if the user dismissed the float mid-session.
        if self._dismissed and awaiting_break:
            self._dismissed = False
        if self._dismissed:
            return
        if not self._placed:
            self._placed = True
            self._restore_or_default_position()
        if not self.isVisible():
            self.show()
            self._assert_topmost()
        if not self._topmost.isActive():
            self._topmost.start()

    def set_music_state(
        self,
        tracks: list[str] | None = None,
        index: int = -1,
        playing: bool = False,
        volume: float = 0.5,
    ) -> None:
        self._music_tracks = list(tracks or [])
        self._music_index = int(index)
        self._music_playing = bool(playing)
        self._music_volume = max(0.0, min(1.0, float(volume)))
        self._track.blockSignals(True)
        self._track.clear()
        if not self._music_tracks:
            self._track.addItem("Add tracks in the app")
            self._track.setEnabled(False)
        else:
            self._track.setEnabled(True)
            for t in self._music_tracks:
                self._track.addItem(t)
            if 0 <= self._music_index < len(self._music_tracks):
                self._track.setCurrentIndex(self._music_index)
        self._track.blockSignals(False)
        self._play_btn.setText("⏸" if self._music_playing else "▶")
        self._play_btn.setToolTip("Pause" if self._music_playing else "Play")
        self._vol.blockSignals(True)
        self._vol.setValue(int(self._music_volume * 100))
        self._vol.blockSignals(False)

    def hide_timer(self) -> None:
        self._tick.stop()
        self._topmost.stop()
        self._remaining = 0
        self._paused = False
        self._awaiting_break = False
        self._expanded = False
        self._session_active = False
        self._dismissed = False
        self._placed = False
        self._panel.setVisible(False)
        self.hide()
        self.remaining_changed.emit(0, "")

    def dismiss(self) -> None:
        if not self.isVisible() and self._dismissed:
            return
        self._dismissed = True
        self._topmost.stop()
        self.hide()
        self.dismissed_by_user.emit()

    def reshow(self) -> None:
        if not self._session_active:
            return
        self._dismissed = False
        self.update_timer(
            self._remaining,
            self._label,
            paused=self._paused,
            awaiting_break=self._awaiting_break,
            expanded=self._expanded,
        )

    def is_session_active(self) -> bool:
        return self._session_active

    def is_dismissed(self) -> bool:
        return self._dismissed

    def is_paused(self) -> bool:
        return self._paused

    def remaining(self) -> int:
        return self._remaining

    def phase_label(self) -> str:
        return self._label

    # ── Rendering & layout ───────────────────────────────────

    def _render(self) -> None:
        m, s = divmod(max(0, self._remaining), 60)
        self._time.setText(f"{m:02d}:{s:02d}")

        is_break = self._label == "BREAK"
        if self._awaiting_break:
            self._phase.setText("REST?")
            dot = ACCENT
            time_color = MUTED
            self._break_btn.setVisible(True)
            self._snooze_btn.setVisible(True)
            self._pause_btn.setVisible(False)
        elif self._paused:
            self._phase.setText("PAUSED")
            dot = MUTED
            time_color = MUTED
            self._break_btn.setVisible(not is_break)
            self._snooze_btn.setVisible(False)
            self._pause_btn.setVisible(True)
            self._pause_btn.setText("▶")
            self._pause_btn.setToolTip("Resume")
        else:
            self._phase.setText("BREAK" if is_break else "FOCUS")
            dot = BREAK_BLUE if is_break else ACCENT
            time_color = FG
            self._break_btn.setVisible(not is_break)
            self._snooze_btn.setVisible(False)
            self._pause_btn.setVisible(True)
            self._pause_btn.setText("⏸")
            self._pause_btn.setToolTip("Pause")

        self._dot.setStyleSheet(f"color: {dot}; background: transparent; font-size: 13px;")
        self._time.setStyleSheet(f"color: {time_color}; background: transparent;")

    def _apply_expanded(self) -> None:
        self._panel.setVisible(self._expanded)
        self._expand_btn.setText("⌃" if self._expanded else "⌄")
        self._expand_btn.setToolTip("Less" if self._expanded else "More")
        # A frameless translucent Tool window won't auto-shrink on adjustSize,
        # so pin it to the content's exact hint each toggle. setFixedSize is
        # deterministic in both directions; dragging still works (it moves).
        before_h = self.height()
        # A SHOWN top-level window's sizeHint() echoes its current size, not the
        # content — so compute from the inner card's hint plus the outer margins.
        # That is deterministic in both directions.
        self.setMinimumSize(0, 0)
        self.setMaximumSize(16777215, 16777215)
        self._panel.updateGeometry()
        root = self.findChild(QWidget, "floatRoot")
        m = self.layout().contentsMargins()
        (root or self).layout().activate()
        rh = root.sizeHint() if root else self.sizeHint()
        w = rh.width() + m.left() + m.right()
        h = rh.height() + m.top() + m.bottom()
        self.setFixedSize(w, h)
        if self._placed:
            delta = h - before_h
            if delta:
                self.move(self.x(), max(8, self.y() - delta))

    def _toggle_expand(self) -> None:
        self._expanded = not self._expanded
        self._apply_expanded()

    def _on_pause_resume(self) -> None:
        if self._paused:
            self.resume_requested.emit()
        else:
            self.pause_requested.emit()

    def _on_track_changed(self, index: int) -> None:
        if not self._music_tracks or index < 0:
            return
        self.music_select_requested.emit(index)

    def _on_vol_changed(self, value: int) -> None:
        self.music_volume_requested.emit(value / 100.0)

    def _on_tick(self) -> None:
        if self._paused or self._awaiting_break:
            return
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

                ctypes.windll.user32.SetWindowPos(
                    int(self.winId()), -1, 0, 0, 0, 0, 0x0002 | 0x0001 | 0x0010 | 0x0040
                )
            except Exception:
                pass

    # ── Position ─────────────────────────────────────────────

    def _place_bottom_right(self) -> None:
        screen = self.screen() or QGuiApplication.primaryScreen()
        if screen is None:
            return
        geo = screen.availableGeometry()
        self.adjustSize()
        self.move(geo.right() - self.width() - 16, geo.bottom() - self.height() - 16)

    def _restore_or_default_position(self) -> None:
        try:
            pos = load_config().get("float_timer_pos")
            x, y = int(pos[0]), int(pos[1])
        except Exception:
            self._place_bottom_right()
            return
        self.adjustSize()
        for screen in QGuiApplication.screens():
            geo = screen.availableGeometry()
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
            pass

    # ── Menu & mouse ─────────────────────────────────────────

    def _context_menu(self, pos) -> None:
        menu = QMenu(self)
        menu.addAction("Open Fellowship Focus").triggered.connect(self.open_app_requested.emit)
        menu.addAction("Hide timer").triggered.connect(self._on_dismiss)
        menu.addSeparator()
        menu.addAction("End session").triggered.connect(self._on_end_session)
        menu.exec(self.mapToGlobal(pos))

    def _on_dismiss(self) -> None:
        self.dismiss()

    def _on_end_session(self) -> None:
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
