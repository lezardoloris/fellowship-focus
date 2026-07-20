"""
Windows Action Center toasts — patterns from:
  winotify (WinRT), win10toast, BurntToast (scenario/sound), gitify (tray click).

Shows native toasts when possible; falls back to system tray balloon.
"""

from __future__ import annotations

import sys
from enum import Enum
from pathlib import Path

from fellowship_focus.ui.theme import ASSETS_DIR


class NotifyKind(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    FOCUS = "focus"
    BREAK = "break"
    XP = "xp"
    BLOCK = "block"


def _icon_path() -> str | None:
    for name in ("fellowship.ico", "app-icon.png", "fellowship.png", "fellowship.jpg", "focus-quest.jpg"):
        path = ASSETS_DIR / name
        if path.exists():
            return str(path.resolve())
    return None


def _duration(kind: NotifyKind) -> str:
    # BurntToast-style: important events stay longer in Action Center
    if kind in (NotifyKind.XP, NotifyKind.WARNING, NotifyKind.BLOCK):
        return "long"
    return "short"


def _winotify_audio(kind: NotifyKind):
    try:
        from winotify import audio
    except ImportError:
        return None
    mapping = {
        NotifyKind.SUCCESS: audio.Default,
        NotifyKind.XP: audio.Reminder,
        NotifyKind.FOCUS: audio.SMS,
        NotifyKind.BREAK: audio.Default,
        NotifyKind.WARNING: audio.Reminder,
        NotifyKind.BLOCK: audio.Reminder,
        NotifyKind.INFO: audio.Default,
    }
    return mapping.get(kind, audio.Default)


def _show_winotify(
    title: str,
    message: str,
    kind: NotifyKind,
    actions: list[tuple[str, str]] | None,
) -> bool:
    try:
        from winotify import Notification
    except ImportError:
        return False

    try:
        toast = Notification(
            app_id="Fellowship Focus",
            title=title,
            msg=message,
            icon=_icon_path() or "",
            duration=_duration(kind),
        )
        sound = _winotify_audio(kind)
        if sound is not None:
            try:
                toast.set_audio(sound, loop=False)
            except Exception:
                pass
        for label, launch in actions or []:
            try:
                toast.add_actions(label=label, launch=launch)
            except Exception:
                pass
        toast.show()
        return True
    except Exception:
        return False


def _show_win10toast(title: str, message: str) -> bool:
    """Fallback — jithurjacob/Windows-10-Toast-Notifications style."""
    try:
        from win10toast import ToastNotifier

        toaster = ToastNotifier()
        icon = _icon_path()
        kwargs = {"title": title, "msg": message, "duration": 5, "threaded": True}
        if icon:
            kwargs["icon_path"] = icon
        toaster.show_toast(**kwargs)
        return True
    except Exception:
        return False


def _show_tray(title: str, message: str, tray, kind: NotifyKind) -> bool:
    if tray is None:
        return False
    try:
        from PySide6.QtWidgets import QSystemTrayIcon

        icon_map = {
            NotifyKind.WARNING: QSystemTrayIcon.MessageIcon.Warning,
            NotifyKind.BLOCK: QSystemTrayIcon.MessageIcon.Critical,
            NotifyKind.SUCCESS: QSystemTrayIcon.MessageIcon.Information,
            NotifyKind.XP: QSystemTrayIcon.MessageIcon.Information,
        }
        icon = icon_map.get(kind, QSystemTrayIcon.MessageIcon.Information)
        msecs = 8000 if _duration(kind) == "long" else 4000
        tray.showMessage(title, message, icon, msecs)
        return True
    except Exception:
        try:
            tray.showMessage(title, message)
            return True
        except Exception:
            return False


def notify(
    title: str,
    message: str,
    tray=None,
    *,
    kind: NotifyKind | str = NotifyKind.INFO,
    actions: list[tuple[str, str]] | None = None,
    dashboard_url: str | None = None,
) -> None:
    """
    Show a native Windows toast when possible.

    actions: optional list of (label, launch_url_or_path)
    dashboard_url: if set, adds an "Open dashboard" action
    """
    if isinstance(kind, str):
        try:
            kind = NotifyKind(kind)
        except ValueError:
            kind = NotifyKind.INFO

    action_list = list(actions or [])
    if dashboard_url:
        action_list.append(("Open dashboard", dashboard_url))

    if sys.platform == "win32":
        if _show_winotify(title, message, kind, action_list or None):
            return
        if _show_win10toast(title, message):
            return

    _show_tray(title, message, tray, kind)


def notify_focus_started(minutes: int, tray=None, dashboard_url: str | None = None) -> None:
    notify(
        "Focus quest started",
        f"{minutes} min deep work — distractions shielded.",
        tray,
        kind=NotifyKind.FOCUS,
        dashboard_url=dashboard_url,
    )


def notify_break(message: str, tray=None) -> None:
    notify("Break time", message, tray, kind=NotifyKind.BREAK)


def notify_back_to_focus(tray=None) -> None:
    notify(
        "Back to focus",
        "Break over — distractions blocked again.",
        tray,
        kind=NotifyKind.FOCUS,
    )


def notify_xp(xp: int, tray=None, dashboard_url: str | None = None) -> None:
    notify(
        "Quest complete",
        f"+{xp} XP earned — the Fellowship advances.",
        tray,
        kind=NotifyKind.XP,
        dashboard_url=dashboard_url,
    )


def notify_blocker_penalty(penalty: int, tray=None) -> None:
    notify(
        "Blocker disabled",
        f"−{penalty} XP · guild accountability",
        tray,
        kind=NotifyKind.WARNING,
    )
