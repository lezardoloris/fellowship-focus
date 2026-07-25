"""
Windows Action Center toasts — patterns from:
  winotify (WinRT), win10toast, BurntToast (scenario/sound), gitify (tray click).

Shows native toasts when possible; falls back to system tray balloon.
"""

from __future__ import annotations

import sys
from enum import Enum
from pathlib import Path

from fellowship_focus.ui.theme import resolve_app_icon_path


class NotifyKind(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    FOCUS = "focus"
    BREAK = "break"
    XP = "xp"
    BLOCK = "block"


def _icon_path() -> str | None:
    icon = resolve_app_icon_path()
    return str(icon.resolve()) if icon else None


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


def _in_quiet_hours(cfg: dict) -> bool:
    """True inside the user's quiet window (supports windows crossing midnight)."""
    start = str(cfg.get("quiet_hours_start") or "").strip()
    end = str(cfg.get("quiet_hours_end") or "").strip()
    if not start or not end:
        return False
    try:
        from datetime import datetime

        now = datetime.now().strftime("%H:%M")
        if start == end:
            return False
        if start < end:  # e.g. 09:00 → 18:00
            return start <= now < end
        return now >= start or now < end  # e.g. 22:00 → 07:00
    except Exception:
        return False


# Set once at startup so every notify() call inherits the user's policy
# without threading config through ~15 call sites.
_policy_config: dict | None = None


def set_policy_config(cfg: dict | None) -> None:
    """Register the live app config used to enforce mute / quiet hours."""
    global _policy_config
    _policy_config = cfg


def notifications_suppressed(cfg: dict, kind: NotifyKind) -> bool:
    """Central notification policy.

    One place decides whether a notification may fire, instead of every call
    site inventing its own guard — which is how the same event ended up firing
    from three surfaces with three different wordings.

    BLOCK is *critical* and always shows: quiet hours mean "don't nag me", not
    "let me doomscroll through a session I started myself". Everything else
    (focus/break/XP/records/warnings) respects the global mute and quiet hours.
    """
    if kind is NotifyKind.BLOCK:
        return False
    try:
        import time as _t

        if float(cfg.get("notifications_muted_until") or 0) > _t.time():
            return True
    except Exception:
        pass
    return _in_quiet_hours(cfg)


def notify(
    title: str,
    message: str,
    tray=None,
    *,
    kind: NotifyKind | str = NotifyKind.INFO,
    actions: list[tuple[str, str]] | None = None,
    dashboard_url: str | None = None,
    config: dict | None = None,
) -> None:
    """
    Show a native Windows toast when possible.

    actions: optional list of (label, launch_url_or_path)
    dashboard_url: if set, adds an "Open dashboard" action
    config: app config — enforces global mute / quiet hours when provided.
    """
    if isinstance(kind, str):
        try:
            kind = NotifyKind(kind)
        except ValueError:
            kind = NotifyKind.INFO

    policy = config if config is not None else _policy_config
    if policy is not None and notifications_suppressed(policy, kind):
        return

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


def notify_record(title: str, message: str, tray=None) -> None:
    notify(title, message, tray, kind=NotifyKind.XP)


def notify_streak_danger(streak: int, tray=None) -> None:
    notify(
        "Streak in danger",
        f"Keep your {streak}-day streak — a short focus block still counts.",
        tray,
        kind=NotifyKind.WARNING,
    )
