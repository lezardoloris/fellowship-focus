"""Screen-time tracking — foreground app usage, categories, idle-aware.

Polls the active window every few seconds (all day, not just during focus),
attributes elapsed time to the foreground app and a category, skips time while
you're idle, and persists a per-day breakdown to ~/.fellowship-focus/usage/.
"""

from __future__ import annotations

import json
import sys
import time
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

# Precomputed once — categorize() must not rebuild this every tick.
_BASE_KEYWORDS: dict[str, tuple[str, ...]] = {
    cat: tuple(words) for cat, words in DEFAULT_CATEGORY_KEYWORDS.items()
}

# Shared last sample so nudge / other callers can reuse without a second psutil hit.
_last_sample: dict = {
    "proc": "",
    "title": "",
    "idle": 0.0,
    "monotonic": 0.0,
}

if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class _LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

    _user32 = ctypes.windll.user32
    _kernel32 = ctypes.windll.kernel32
else:
    _LASTINPUTINFO = None  # type: ignore[misc, assignment]
    _user32 = None
    _kernel32 = None


def _lower(text: str) -> str:
    return (text or "").lower()


def last_foreground_sample(max_age_s: float = 6.0) -> tuple[str, str] | None:
    """Return cached (proc, title) if fresher than ``max_age_s``, else None."""
    age = time.monotonic() - float(_last_sample.get("monotonic") or 0)
    if age > max_age_s:
        return None
    return (str(_last_sample.get("proc") or ""), str(_last_sample.get("title") or ""))


def last_idle_sample(max_age_s: float = 6.0) -> float | None:
    age = time.monotonic() - float(_last_sample.get("monotonic") or 0)
    if age > max_age_s:
        return None
    return float(_last_sample.get("idle") or 0.0)


def foreground_app() -> tuple[str, str]:
    """Return (process_name, window_title) of the foreground window."""
    if sys.platform != "win32" or _user32 is None:
        return ("unknown", "")
    try:
        hwnd = _user32.GetForegroundWindow()
        if not hwnd:
            return ("", "")

        length = _user32.GetWindowTextLengthW(hwnd) + 1
        buf = ctypes.create_unicode_buffer(length)
        _user32.GetWindowTextW(hwnd, buf, length)
        title = buf.value.strip()

        pid = wintypes.DWORD()
        _user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
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
    if sys.platform != "win32" or _LASTINPUTINFO is None or _user32 is None:
        return 0.0
    try:
        info = _LASTINPUTINFO()
        info.cbSize = ctypes.sizeof(info)
        if not _user32.GetLastInputInfo(ctypes.byref(info)):
            return 0.0
        millis = _kernel32.GetTickCount() - info.dwTime
        return max(0.0, millis / 1000.0)
    except Exception:
        return 0.0


def _friendly_label(proc: str, title: str) -> str:
    """A display name for the app breakdown."""
    name = proc[:-4] if proc.lower().endswith(".exe") else proc
    return (name or title or "unknown").strip()[:40] or "unknown"


def categorize(proc: str, title: str, overrides: dict | None = None) -> str:
    hay = f"{_lower(proc)} {_lower(title)}"
    if overrides:
        keywords: dict[str, list[str] | tuple[str, ...]] = {
            cat: list(words) for cat, words in _BASE_KEYWORDS.items()
        }
        for cat, words in overrides.items():
            if cat in keywords and isinstance(words, list):
                keywords[cat] = list(keywords[cat]) + [str(w).lower() for w in words]
    else:
        keywords = _BASE_KEYWORDS  # type: ignore[assignment]
    # Distraction takes precedence, then work, then personal.
    for cat in ("distraction", "work", "personal"):
        if any(kw and kw in hay for kw in keywords.get(cat, ())):
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
        self._dirty = False
        self._overrides_cache: dict | None = None
        self._overrides_key: object = None
        # [TRK-1] The span currently open; flushed when the foreground changes.
        self._event: dict | None = None
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._last_tick_mono = time.monotonic()

    def start(self) -> None:
        if not self._timer.isActive():
            self._last_tick_mono = time.monotonic()
            self._timer.start(POLL_SECONDS * 1000)

    def stop(self) -> None:
        self._timer.stop()
        if self._event is not None:
            self._flush_event(self._event)
            self._event = None
        self._save()

    def today(self) -> dict:
        return self._data

    def _overrides(self) -> dict | None:
        if not self._config_getter:
            return None
        try:
            raw = (self._config_getter() or {}).get("usage_categories")
        except Exception:
            return None
        key = id(raw) if raw is not None else None
        if key != self._overrides_key:
            self._overrides_key = key
            self._overrides_cache = raw if isinstance(raw, dict) else None
        return self._overrides_cache

    def _enabled(self) -> bool:
        if not self._config_getter:
            return True
        try:
            return bool((self._config_getter() or {}).get("screen_time_enabled", True))
        except Exception:
            return True

    def _tick(self) -> None:
        now = time.monotonic()
        elapsed = max(1, min(30, int(round(now - self._last_tick_mono))))
        self._last_tick_mono = now

        # Roll over to a new day if needed.
        today = date.today().isoformat()
        if today != self._day:
            # Close the open span against the day it belongs to, before the
            # filename changes underneath it.
            if self._event is not None:
                self._flush_event(self._event)
                self._event = None
            self._save()
            self._day = today
            self._data = load_day(today)

        if not self._enabled():
            return

        idle = idle_seconds()
        proc, title = foreground_app()
        _last_sample["proc"] = proc
        _last_sample["title"] = title
        _last_sample["idle"] = idle
        _last_sample["monotonic"] = now

        if idle >= IDLE_THRESHOLD_SECONDS:
            return
        if not proc and not title:
            return
        label = _friendly_label(proc, title)
        category = categorize(proc, title, self._overrides())

        self._data["apps"][label] = self._data["apps"].get(label, 0) + elapsed
        self._data["categories"][category] = self._data["categories"].get(category, 0) + elapsed
        self._dirty = True
        self._record_event(label, title, category, elapsed)

        self._since_save += elapsed
        if self._since_save >= SAVE_EVERY_SECONDS:
            self._save()

    def _record_event(self, label: str, title: str, category: str, elapsed: int) -> None:
        """[TRK-1] Append one span per *change* of what you are looking at.

        The daily rollup this file has always written is a dead end for the
        money view. It keeps `chrome: 45360` and nothing else, so the single
        biggest bucket on this machine (12.6h over 7 days, 45% of all tracked
        time) is opaque: the client work and the doomscrolling are the same
        number. The window title that would separate them was already being
        read for categorisation, twelve times a minute, and thrown away.

        A span is only written when the foreground changes, so a working day
        costs a few hundred lines rather than 17k samples. That is what makes
        per-client attribution, context-switch counts and time-of-day analysis
        possible at all.

        Local file, never uploaded. Titles can name clients and documents, so
        `screen_time_titles` (default on) turns the title field off without
        stopping the timing.
        """
        keep_titles = True
        try:
            if self._config_getter:
                keep_titles = bool((self._config_getter() or {}).get("screen_time_titles", True))
        except Exception:
            pass

        prev = self._event
        same = prev is not None and prev["app"] == label and prev.get("raw") == title
        if same:
            prev["sec"] += elapsed
            return
        if prev is not None:
            self._flush_event(prev)
        self._event = {
            "at": int(time.time()) - elapsed,
            "app": label,
            "title": (title[:180] if keep_titles else ""),
            "cat": category,
            "sec": elapsed,
            "raw": title,
        }

    def _flush_event(self, ev: dict) -> None:
        """Write one finished span. Spans under 10s are dropped: alt-tabbing
        through five windows should not read as five pieces of work."""
        if ev.get("sec", 0) < 10:
            return
        try:
            USAGE_DIR.mkdir(parents=True, exist_ok=True)
            path = USAGE_DIR / f"{self._day}.events.jsonl"
            row = {k: v for k, v in ev.items() if k != "raw"}
            with path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def _save(self) -> None:
        self._since_save = 0
        if not self._dirty:
            return
        self._dirty = False
        try:
            USAGE_DIR.mkdir(parents=True, exist_ok=True)
            path = usage_path(self._day)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self._data), encoding="utf-8")
            tmp.replace(path)
        except Exception:
            self._dirty = True
