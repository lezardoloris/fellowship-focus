"""Fellowship soundscapes — a local ambient music player for focus sessions.

Plays looping ambient tracks (e.g. Suno-generated LOTR/DUNE-style soundscapes)
from the user's music folder. Deliberately local/offline: the website blocker
routes traffic through a system proxy, so streaming YouTube in-app would fight
the shield. The same tracks power the long-form focus videos on YouTube.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from PySide6.QtCore import Qt, QUrl
from PySide6.QtWidgets import (
    QComboBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSlider,
    QVBoxLayout,
)

from fellowship_focus.ui.components import GlassCard, PageHeader, ToggleSwitch
from fellowship_focus.ui.theme import ASSETS_DIR, MUTED

try:
    from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer

    MULTIMEDIA_OK = True
except Exception:  # pragma: no cover - platform without the multimedia plugin
    MULTIMEDIA_OK = False

AUDIO_EXTS = {".mp3", ".ogg", ".oga", ".wav", ".m4a", ".flac", ".opus", ".aac"}
USER_MUSIC_DIR = Path.home() / ".fellowship-focus" / "music"
_YT_IN_NAME = re.compile(r"\[([A-Za-z0-9_-]{6,})\]|^focus-([A-Za-z0-9_-]{6,})$", re.I)

# Short labels keyed by YouTube id (kept in sync with web/src/lib/focusMusic.ts).
FOCUS_TITLES: dict[str, str] = {
    "OWz7HiR6H-0": "CEO Penthouse",
    "hpAD6SGi3j8": "Hyperfocus Café",
    "TIqsKXQHvFI": "When the Stakes Are High",
    "WMdhPtS5vio": "Force",
    "R75oWuI4te4": "Spice Meditation",
    "UDTmUzu05BE": "Deep Work Mix",
    "4WIMyqBG9gs": "Dwarf Mountain Journey",
    "7VAUDImpqGQ": "Trap Beats for Work",
    "MYW0TgV67RE": "Serious Grind",
    "EN0A5derVo0": "Lock In",
    "5_4KRUx2iKY": "Peak Performance",
    "eo1gKGt6h9M": "Hyper Focus Mode",
    "ahawPLh4epk": "CEO Zero Distraction",
    "GaTy0vRmT9E": "Brain Performance",
    "p2_zDvtPQ-g": "Super Focus Alpha",
    "am1VJP0RnmQ": "Flow State Chillstep",
    "T2QZpy07j4s": "Deep Future Garage",
    "UpPmnnJcy6A": "Dreamlight 30m",
    "-sZqtdT-GVw": "Chill Deep Focus",
    "mdJU5ogrPMY": "Classical Study",
}


def _bundled_music_dir() -> Path:
    return ASSETS_DIR / "music"


def _youtube_id(stem: str) -> str | None:
    m = _YT_IN_NAME.search(stem)
    if not m:
        return None
    return m.group(1) or m.group(2)


def display_title(path: Path) -> str:
    yt = _youtube_id(path.stem)
    if yt and yt in FOCUS_TITLES:
        return FOCUS_TITLES[yt]
    stem = path.stem
    if stem.lower().startswith("focus-"):
        return stem[6:]
    cut = re.sub(r"\s*[[（(][A-Za-z0-9_-]{6,}[)）\]]\s*$", "", stem)
    cut = re.sub(r"\s*[|｜~•·].*$", "", cut).strip()
    return cut or stem


def discover_tracks() -> list[Path]:
    """Tracks from the user's music folder first, then bundled — deduped by YouTube id / name."""
    by_key: dict[str, Path] = {}
    for folder in (USER_MUSIC_DIR, _bundled_music_dir()):
        try:
            if not folder.exists():
                continue
            for path in sorted(folder.iterdir()):
                if path.suffix.lower() not in AUDIO_EXTS:
                    continue
                yt = _youtube_id(path.stem)
                key = f"yt:{yt}" if yt else f"name:{path.name.lower()}"
                existing = by_key.get(key)
                # Prefer clean focus-{id}.mp3 names; otherwise keep first (user folder).
                if existing is None:
                    by_key[key] = path
                elif path.name.lower().startswith("focus-") and not existing.name.lower().startswith("focus-"):
                    by_key[key] = path
        except Exception:
            continue
    return sorted(by_key.values(), key=lambda p: display_title(p).lower())


class FocusMusicPlayer(GlassCard):
    """Compact player card: enable toggle, track picker, transport, volume."""

    def __init__(self, config: dict, save_config_cb, parent=None) -> None:
        super().__init__(parent)
        self._config = config
        self._save = save_config_cb
        self._tracks: list[Path] = []
        self._index = 0
        self._suspended_for_break = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(12)

        header_row = QHBoxLayout()
        header_row.addWidget(PageHeader("Soundscape", "Ambient focus music"), 1)
        self.enable_toggle = ToggleSwitch()
        self.enable_toggle.setToolTip("Play ambient music during focus sessions")
        self.enable_toggle.setChecked(bool(config.get("focus_music_enabled", True)), animate=False)
        self.enable_toggle.toggled.connect(self._on_enable_toggled)
        header_row.addWidget(self.enable_toggle, 0, Qt.AlignmentFlag.AlignTop)
        layout.addLayout(header_row)

        self.track_combo = QComboBox()
        self.track_combo.currentIndexChanged.connect(self._on_track_selected)
        layout.addWidget(self.track_combo)

        transport = QHBoxLayout()
        self.prev_btn = QPushButton("\u23ee")
        self.play_btn = QPushButton("\u25b6")
        self.next_btn = QPushButton("\u23ed")
        for b in (self.prev_btn, self.play_btn, self.next_btn):
            b.setObjectName("ghostBtn")
            b.setFixedWidth(52)
        self.play_btn.setObjectName("primaryBtn")
        self.prev_btn.clicked.connect(self.previous)
        self.play_btn.clicked.connect(self.toggle_play)
        self.next_btn.clicked.connect(self.next)
        transport.addWidget(self.prev_btn)
        transport.addWidget(self.play_btn, 1)
        transport.addWidget(self.next_btn)
        layout.addLayout(transport)

        vol_row = QHBoxLayout()
        vol_row.addWidget(QLabel("Vol"))
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(int(float(config.get("focus_music_volume", 0.5)) * 100))
        self.volume_slider.valueChanged.connect(self._on_volume_changed)
        vol_row.addWidget(self.volume_slider, 1)
        layout.addLayout(vol_row)

        self.status_label = QLabel("")
        self.status_label.setObjectName("mutedLabel")
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)

        folder_row = QHBoxLayout()
        self.add_btn = QPushButton("Add tracks")
        self.add_btn.setObjectName("ghostBtn")
        self.add_btn.clicked.connect(self.open_music_folder)
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.setObjectName("ghostBtn")
        self.refresh_btn.clicked.connect(self.reload_tracks)
        folder_row.addWidget(self.add_btn)
        folder_row.addWidget(self.refresh_btn)
        layout.addLayout(folder_row)

        self._player = None
        self._audio = None
        if MULTIMEDIA_OK:
            self._audio = QAudioOutput()
            self._audio.setVolume(float(config.get("focus_music_volume", 0.5)))
            self._player = QMediaPlayer()
            self._player.setAudioOutput(self._audio)
            self._player.mediaStatusChanged.connect(self._on_media_status)

        self.reload_tracks()
        self._apply_enabled_ui()

    # ── Track management ────────────────────────────────────

    def reload_tracks(self) -> None:
        current = self._tracks[self._index].name if self._tracks and 0 <= self._index < len(self._tracks) else None
        self._tracks = discover_tracks()
        self.track_combo.blockSignals(True)
        self.track_combo.clear()
        for path in self._tracks:
            self.track_combo.addItem(display_title(path), path.name)
        self.track_combo.blockSignals(False)
        if self._tracks:
            saved = self._config.get("focus_music_track", "")
            idx = next((i for i, p in enumerate(self._tracks) if p.name in (current, saved)), 0)
            self._index = idx
            self.track_combo.setCurrentIndex(idx)
            self.status_label.setText("")
        else:
            self._index = 0
            self.status_label.setText(
                "No tracks yet. Click Add tracks and drop your ambient .mp3 files "
                "(e.g. from Suno) into the folder, then Refresh."
            )
        has = bool(self._tracks) and MULTIMEDIA_OK
        for b in (self.play_btn, self.prev_btn, self.next_btn):
            b.setEnabled(has)

    def open_music_folder(self) -> None:
        try:
            USER_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
            if sys.platform == "win32":
                os.startfile(str(USER_MUSIC_DIR))  # noqa: S606
            elif sys.platform == "darwin":
                os.system(f'open "{USER_MUSIC_DIR}"')
            else:
                os.system(f'xdg-open "{USER_MUSIC_DIR}"')
        except Exception:
            self.status_label.setText(f"Music folder: {USER_MUSIC_DIR}")

    # ── Playback ────────────────────────────────────────────

    def _load_current(self) -> bool:
        if not (self._player and self._tracks and 0 <= self._index < len(self._tracks)):
            return False
        path = self._tracks[self._index]
        self._player.setSource(QUrl.fromLocalFile(str(path)))
        self._config["focus_music_track"] = path.name
        self._save(self._config)
        return True

    def play(self) -> None:
        if not (self._player and self._tracks):
            return
        if self._player.source().isEmpty():
            if not self._load_current():
                return
        self._player.play()
        self.play_btn.setText("\u2016")

    def pause(self) -> None:
        if self._player:
            self._player.pause()
        self.play_btn.setText("\u25b6")

    def stop(self) -> None:
        if self._player:
            self._player.stop()
        self.play_btn.setText("\u25b6")

    def toggle_play(self) -> None:
        if not self._player:
            return
        if self._player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.pause()
        else:
            self.play()

    def next(self) -> None:
        if not self._tracks:
            return
        self._index = (self._index + 1) % len(self._tracks)
        self.track_combo.setCurrentIndex(self._index)
        self._load_current()
        self.play()

    def previous(self) -> None:
        if not self._tracks:
            return
        self._index = (self._index - 1) % len(self._tracks)
        self.track_combo.setCurrentIndex(self._index)
        self._load_current()
        self.play()

    # ── Web-bridge API (drives this native player from the embedded web UI) ──

    def is_playing(self) -> bool:
        return bool(
            self._player
            and self._player.playbackState() == QMediaPlayer.PlaybackState.PlayingState
        )

    def bridge_state(self) -> dict:
        return {
            "available": bool(MULTIMEDIA_OK),
            "tracks": [display_title(p) for p in self._tracks],
            "index": self._index if self._tracks else -1,
            "playing": self.is_playing(),
            "volume": float(self._audio.volume()) if self._audio else 0.5,
        }

    def bridge_cmd(self, payload: dict) -> dict:
        cmd = str(payload.get("cmd", ""))
        if cmd == "toggle":
            self.toggle_play()
        elif cmd == "play":
            self.play()
        elif cmd == "pause":
            self.pause()
        elif cmd == "next":
            self.next()
        elif cmd == "prev":
            self.previous()
        elif cmd == "select":
            try:
                i = int(payload.get("value", -1))
            except (TypeError, ValueError):
                i = -1
            if self._tracks and 0 <= i < len(self._tracks):
                self._index = i
                self.track_combo.setCurrentIndex(i)
                self._load_current()
                self.play()
        elif cmd == "volume":
            try:
                v = max(0.0, min(1.0, float(payload.get("value", 0.5))))
            except (TypeError, ValueError):
                v = 0.5
            self.volume_slider.setValue(int(v * 100))
        return self.bridge_state()

    # ── Session hooks (called by the Pomodoro engine) ───────

    def on_focus_start(self) -> None:
        self._suspended_for_break = False
        if self._enabled() and self._tracks:
            self.play()

    def on_break(self) -> None:
        if self._player and self._player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self._suspended_for_break = True
            self.pause()

    def on_pause(self) -> None:
        self.on_break()

    def on_resume(self) -> None:
        if self._suspended_for_break and self._enabled():
            self._suspended_for_break = False
            self.play()

    def on_session_end(self) -> None:
        self._suspended_for_break = False
        self.stop()

    # ── Internal ────────────────────────────────────────────

    def _enabled(self) -> bool:
        return bool(self._config.get("focus_music_enabled", True))

    def _apply_enabled_ui(self) -> None:
        on = self._enabled()
        has_audio = MULTIMEDIA_OK and bool(self._tracks)
        self.track_combo.setEnabled(on)
        self.volume_slider.setEnabled(on)
        for w in (self.play_btn, self.prev_btn, self.next_btn):
            w.setEnabled(on and has_audio)
        if not MULTIMEDIA_OK:
            self.status_label.setText("Audio playback unavailable on this system.")

    def _on_enable_toggled(self, on: bool) -> None:
        self._config["focus_music_enabled"] = bool(on)
        self._save(self._config)
        self._apply_enabled_ui()
        if not on:
            self.stop()

    def _on_track_selected(self, index: int) -> None:
        if 0 <= index < len(self._tracks):
            was_playing = bool(
                self._player and self._player.playbackState() == QMediaPlayer.PlaybackState.PlayingState
            )
            self._index = index
            self._load_current()
            if was_playing:
                self.play()

    def _on_volume_changed(self, value: int) -> None:
        vol = max(0.0, min(1.0, value / 100.0))
        if self._audio:
            self._audio.setVolume(vol)
        self._config["focus_music_volume"] = vol
        self._save(self._config)

    def _on_media_status(self, status) -> None:
        if not MULTIMEDIA_OK:
            return
        if status == QMediaPlayer.MediaStatus.EndOfMedia and self._tracks:
            # Loop the playlist so a focus session never falls silent.
            self.next()
