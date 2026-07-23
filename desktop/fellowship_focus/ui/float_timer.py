"""Always-on-top mini focus timer — bottom-right of the screen.

Survives main-window hide/minimize. Driven by the web bridge, with an
optional local tick so the countdown keeps moving if the WebView is throttled.

Compact capsule by default; chevron expands a richer card (add time, session
actions). Music controls are wired from MainWindow via signals.
"""

from __future__ import annotations

import sys
import time

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QCursor, QGuiApplication
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
    """Frameless, always-on-top session indicator — capsule + expandable card."""

    closed_by_user = Signal()
    dismissed_by_user = Signal()
    open_app_requested = Signal()
    remaining_changed = Signal(int, str)  # remaining, label
    add_time_requested = Signal(int)  # minutes
    break_now_requested = Signal()
    snooze_requested = Signal()
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
        # Translucent host so the capsule radius actually clips (no square chrome).
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setMinimumWidth(168)

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
        self._dismissed = False  # × hid the pill; session still running
        self._music_tracks: list[str] = []
        self._music_index = -1
        self._music_playing = False
        self._music_volume = 0.5

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
            QLabel#hintLabel {{
                color: {ACCENT};
                background: transparent;
                font-size: 10px;
                letter-spacing: 1px;
            }}
            QPushButton#closeBtn, QPushButton#expandBtn {{
                background: {BG_ELEVATED};
                color: {MUTED};
                border: none;
                border-radius: 12px;
                font-size: 13px;
                padding: 0;
            }}
            QPushButton#closeBtn:hover, QPushButton#expandBtn:hover {{
                color: {FG};
                background: #3a3d40;
            }}
            QPushButton#actionBtn {{
                background: {BG_ELEVATED};
                color: {FG};
                border: 1px solid {BORDER};
                border-radius: 8px;
                padding: 6px 8px;
                font-size: 11px;
            }}
            QPushButton#actionBtn:hover {{
                border-color: {ACCENT};
            }}
            QPushButton#primaryBtn {{
                background: {ACCENT};
                color: {FG};
                border: none;
                border-radius: 8px;
                padding: 6px 8px;
                font-size: 11px;
                font-weight: 600;
            }}
            QComboBox {{
                background: {BG_ELEVATED};
                color: {FG};
                border: 1px solid {BORDER};
                border-radius: 8px;
                padding: 4px 8px;
                font-size: 11px;
            }}
            QSlider::groove:horizontal {{
                height: 4px;
                background: {BORDER};
                border-radius: 2px;
            }}
            QSlider::handle:horizontal {{
                width: 12px;
                margin: -5px 0;
                background: {ACCENT};
                border-radius: 6px;
            }}
            """
        )

        root = QWidget(self)
        root.setObjectName("floatRoot")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(root)

        self._root_layout = QVBoxLayout(root)
        self._root_layout.setContentsMargins(14, 6, 8, 6)
        self._root_layout.setSpacing(8)

        row = QHBoxLayout()
        row.setSpacing(8)

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
        row.addWidget(self._time, 1)

        self._hint = QLabel("")
        self._hint.setObjectName("hintLabel")
        self._hint.setVisible(False)
        row.addWidget(self._hint)

        self._expand_btn = QPushButton("▾")
        self._expand_btn.setObjectName("expandBtn")
        self._expand_btn.setFixedSize(24, 24)
        self._expand_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._expand_btn.setToolTip("Expand")
        self._expand_btn.clicked.connect(self._toggle_expand)
        row.addWidget(self._expand_btn)

        close = QPushButton("×")
        close.setObjectName("closeBtn")
        close.setFixedSize(24, 24)
        close.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        close.setToolTip("Hide timer (session keeps running)")
        close.clicked.connect(self._on_dismiss)
        row.addWidget(close)

        self._root_layout.addLayout(row)

        self._panel = QWidget()
        panel_layout = QVBoxLayout(self._panel)
        panel_layout.setContentsMargins(0, 2, 6, 6)
        panel_layout.setSpacing(6)

        music_row = QHBoxLayout()
        music_row.setSpacing(6)
        self._track = QComboBox()
        self._track.setMinimumWidth(120)
        self._track.currentIndexChanged.connect(self._on_track_changed)
        music_row.addWidget(self._track, 1)
        self._play_btn = QPushButton("Play")
        self._play_btn.setObjectName("actionBtn")
        self._play_btn.clicked.connect(self.music_toggle_requested.emit)
        music_row.addWidget(self._play_btn)
        panel_layout.addLayout(music_row)

        vol_row = QHBoxLayout()
        vol_lbl = QLabel("Vol")
        vol_lbl.setStyleSheet(f"color: {MUTED}; font-size: 10px;")
        vol_row.addWidget(vol_lbl)
        self._vol = QSlider(Qt.Orientation.Horizontal)
        self._vol.setRange(0, 100)
        self._vol.setValue(50)
        self._vol.valueChanged.connect(self._on_vol_changed)
        vol_row.addWidget(self._vol, 1)
        panel_layout.addLayout(vol_row)

        add_row = QHBoxLayout()
        add_row.setSpacing(6)
        for mins in (5, 10):
            btn = QPushButton(f"+{mins} min")
            btn.setObjectName("actionBtn")
            btn.clicked.connect(lambda _=False, m=mins: self.add_time_requested.emit(m))
            add_row.addWidget(btn)
        panel_layout.addLayout(add_row)

        self._action_row = QHBoxLayout()
        self._action_row.setSpacing(6)
        self._break_btn = QPushButton("Break now")
        self._break_btn.setObjectName("primaryBtn")
        self._break_btn.clicked.connect(self.break_now_requested.emit)
        self._snooze_btn = QPushButton("Remind 5m")
        self._snooze_btn.setObjectName("actionBtn")
        self._snooze_btn.clicked.connect(self.snooze_requested.emit)
        self._pause_btn = QPushButton("Pause")
        self._pause_btn.setObjectName("actionBtn")
        self._pause_btn.clicked.connect(self._on_pause_resume)
        self._action_row.addWidget(self._break_btn)
        self._action_row.addWidget(self._snooze_btn)
        self._action_row.addWidget(self._pause_btn)
        panel_layout.addLayout(self._action_row)

        self._panel.setVisible(False)
        self._root_layout.addWidget(self._panel)

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
        self._apply_height()

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
        if expanded is not None:
            self._expanded = bool(expanded)
        elif awaiting_break:
            self._expanded = True
        self._last_web_sync = time.monotonic()
        self._session_active = True
        self._render()
        # Freeze local countdown while paused / awaiting decision.
        if self._paused or self._awaiting_break:
            self._tick.stop()
        elif not self._tick.isActive():
            self._tick.start()
        self.remaining_changed.emit(self._remaining, self._label)
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
        self._play_btn.setText("Pause" if self._music_playing else "Play")
        self._vol.blockSignals(True)
        self._vol.setValue(int(self._music_volume * 100))
        self._vol.blockSignals(False)

    def hide_timer(self) -> None:
        """End of session — clear state and hide (called by web / quit)."""
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

    def _apply_height(self) -> None:
        self._panel.setVisible(self._expanded)
        self._expand_btn.setText("▴" if self._expanded else "▾")
        self._expand_btn.setToolTip("Collapse" if self._expanded else "Expand")
        root = self.findChild(QWidget, "floatRoot")
        if root is not None:
            radius = 16 if self._expanded else 20
            root.setStyleSheet(
                f"background: {BG}; border: 1px solid {BORDER}; border-radius: {radius}px;"
            )
        self.adjustSize()

    def _toggle_expand(self) -> None:
        self._expanded = not self._expanded
        self._apply_height()
        if self._placed:
            # Keep bottom edge stable-ish when expanding upward
            geo = self.geometry()
            self.adjustSize()
            delta = self.height() - geo.height()
            if delta:
                self.move(self.x(), max(8, self.y() - delta))

    def _render(self) -> None:
        m, s = divmod(max(0, self._remaining), 60)
        self._time.setText(f"{m:02d}:{s:02d}")
        if self._awaiting_break:
            self._hint.setText("REST?")
            self._hint.setVisible(True)
            self._time.setStyleSheet(f"color: {MUTED}; background: transparent; padding: 0 2px;")
            self._dot.setStyleSheet(f"color: {ACCENT}; font-size: 10px;")
            self._dot.setToolTip("Choose rest or continue")
            self._break_btn.setVisible(True)
            self._snooze_btn.setVisible(True)
            self._pause_btn.setVisible(False)
        elif self._paused:
            self._hint.setVisible(False)
            self._time.setStyleSheet(f"color: {MUTED}; background: transparent; padding: 0 2px;")
            self._dot.setStyleSheet(f"color: {MUTED}; font-size: 10px;")
            self._dot.setToolTip("Paused")
            self._break_btn.setVisible(self._label != "BREAK")
            self._snooze_btn.setVisible(False)
            self._pause_btn.setVisible(True)
            self._pause_btn.setText("Resume")
        else:
            self._hint.setVisible(False)
            self._time.setStyleSheet(f"color: {FG}; background: transparent; padding: 0 2px;")
            self._dot.setStyleSheet(
                f"color: {'#60a5fa' if self._label == 'BREAK' else ACCENT}; font-size: 10px;"
            )
            self._dot.setToolTip("")
            self._break_btn.setVisible(self._label != "BREAK")
            self._snooze_btn.setVisible(False)
            self._pause_btn.setVisible(True)
            self._pause_btn.setText("Pause")
        self._apply_height()

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
        # Web bridge usually drives the clock. If the main window is hidden and
        # JS is throttled, take over locally after ~1.4s without a sync.
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
