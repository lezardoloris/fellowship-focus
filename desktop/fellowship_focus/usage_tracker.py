"""Screen-time tracking — foreground app usage, categories, idle-aware.

Polls the active window every few seconds (all day, not just during focus),
attributes elapsed time to the foreground app and a category, skips time while
you're idle, and persists a per-day breakdown to ~/.fellowship-focus/usage/.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from PySide6.QtCore import QObject, QTimer, Signal

USAGE_DIR = Path.home() / ".fellowship-focus" / "usage"
POLL_SECONDS = 5
IDLE_THRESHOLD_SECONDS = 60
SAVE_EVERY_SECONDS = 30

CATEGORIES = ("work", "distraction", "personal", "neutral")

# Keyword → category. Matched against the process name AND the window title
# (lowercased). Distraction wins over work when both match (a YouTube tab in a
# work browser should count against you). User overrides merge on top via config.
DEFAULT_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "distraction": [
        "youtube", "netflix", "twitch", "tiktok", "instagram", "facebook",
        "reddit", "twitter", "x.com", " x ", "9gag", "primevideo", "disney",
        "hulu", "crunchyroll", "steam", "epic games", "riot", "league of legends",
        "discord",
    ],
    "work": [
        "code", "cursor", "visual studio", "pycharm", "intellij", "webstorm",
        "terminal", "powershell", "cmd.exe", "windows terminal", "iterm",
        "excel", "word", "powerpoint", "outlook", "notion", "obsidian", "figma",
        "photoshop", "illustrator", "blender", "docs.google", "sheets.google",
        "github", "gitlab", "jira", "linear", "stack overflow", "localhost",
        "postman", "dbeaver", "teams", "zoom", "slack",
    ],
    "personal": [
        "whatsapp", "telegram", "signal", "spotify", "maps", "gmail", "mail",
        "calendar", "photos", "settings",
    ],
}


def _lower(text: str) -> str:
    return (text or "").lower()


def foreground_app() -> tuple[str, str]:
    """Return (process_name, window_title) of the foreground window."""
    if sys.platform != "win32":
        return ("unknown", "")
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return ("", "")

        length = user32.GetWindowTextLengthW(hwnd) + 1
        buf = ctypes.create_unicode_buffer(length)
        user32.GetWindowTextW(hwnd, buf, length)
        title = buf.value.strip()

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        proc_name = _process_name(pid.value)
        return (proc_name, title)
    except Exception:
        return ("", "")


def _process_name(pid: int) -> str:
    if not pid:
        return ""
    try:
        import psutil

        return psutil.Process(pid).name()
    except Exception:
        return ""


def idle_seconds() -> float:
    """Seconds since the last keyboard/mouse input (Windows)."""
    if sys.platform != "win32":
        return 0.0
    try:
        import ctypes

        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

        info = LASTINPUTINFO()
        info.cbSize = ctypes.sizeof(info)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
            return 0.0
        millis = ctypes.windll.kernel32.GetTickCount() - info.dwTime
        return max(0.0, millis / 1000.0)
    except Exception:
        return 0.0


def _friendly_label(proc: str, title: str) -> str:
    """A display name for the app breakdown."""
    name = proc[:-4] if proc.lower().endswith(".exe") else proc
    return (name or title or "unknown").strip()[:40] or "unknown"


def categorize(proc: str, title: str, overrides: dict | None = None) -> str:
    hay = f"{_lower(proc)} {_lower(title)}"
    keywords = {cat: list(words) for cat, words in DEFAULT_CATEGORY_KEYWORDS.items()}
    if overrides:
        for cat, words in overrides.items():
            if cat in keywords and isinstance(words, list):
                keywords[cat].extend(str(w).lower() for w in words)
    # Distraction takes precedence, then work, then personal.
    for cat in ("distraction", "work", "personal"):
        if any(kw and kw in hay for kw in keywords.get(cat, [])):
            return cat
    return "neutral"


def usage_path(day: str | None = None) -> Path:
    day = day or date.today().isoformat()
    return USAGE_DIR / f"{day}.json"


def load_day(day: str | None = None) -> dict:
    path = usage_path(day)
    if not path.exists():
        return _empty_day()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        for cat in CATEGORIES:
            data.setdefault("categories", {}).setdefault(cat, 0)
        data.setdefault("apps", {})
        return data
    except Exception:
        return _empty_day()


def _empty_day() -> dict:
    return {"apps": {}, "categories": {c: 0 for c in CATEGORIES}}


def focus_score(day_data: dict) -> int:
    """Pulse-style 0–100: Focus=100, Work=75, Neutral=50, Personal=25, Distraction=0."""
    cats = day_data.get("categories", {})
    focus = int(day_data.get("focus_seconds", 0) or cats.get("focus", 0) or 0)
    work = int(cats.get("work", 0) or 0)
    neutral = int(cats.get("neutral", 0) or 0)
    personal = int(cats.get("personal", 0) or 0)
    distraction = int(cats.get("distraction", 0) or 0)
    total = focus + work + neutral + personal + distraction
    if total <= 0:
        return 0
    weighted = (
        focus * 100
        + work * 75
        + neutral * 50
        + personal * 25
        + distraction * 0
    )
    return round(weighted / total)


class UsageTracker(QObject):
    """Background poller accumulating foreground-app seconds into today's file."""

    updated = Signal()

    def __init__(self, config_getter=None) -> None:
        super().__init__()
        self._config_getter = config_getter
        self._day = date.today().isoformat()
        self._data = load_day(self._day)
        self._since_save = 0
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)

    def start(self) -> None:
        if not self._timer.isActive():
            self._timer.start(POLL_SECONDS * 1000)

    def stop(self) -> None:
        self._timer.stop()
        self._save()

    def today(self) -> dict:
        return self._data

    def _overrides(self) -> dict | None:
        if not self._config_getter:
            return None
        try:
            return (self._config_getter() or {}).get("usage_categories")
        except Exception:
            return None

    def _enabled(self) -> bool:
        if not self._config_getter:
            return True
        try:
            return bool((self._config_getter() or {}).get("screen_time_enabled", True))
        except Exception:
            return True

    def _tick(self) -> None:
        # Roll over to a new day if needed.
        today = date.today().isoformat()
        if today != self._day:
            self._save()
            self._day = today
            self._data = load_day(today)

        if not self._enabled():
            return
        if idle_seconds() >= IDLE_THRESHOLD_SECONDS:
            return

        proc, title = foreground_app()
        if not proc and not title:
            return
        label = _friendly_label(proc, title)
        category = categorize(proc, title, self._overrides())

        self._data["apps"][label] = self._data["apps"].get(label, 0) + POLL_SECONDS
        self._data["categories"][category] = self._data["categories"].get(category, 0) + POLL_SECONDS

        self._since_save += POLL_SECONDS
        if self._since_save >= SAVE_EVERY_SECONDS:
            self._save()
        self.updated.emit()

    def _save(self) -> None:
        self._since_save = 0
        try:
            USAGE_DIR.mkdir(parents=True, exist_ok=True)
            usage_path(self._day).write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        except Exception:
            pass
