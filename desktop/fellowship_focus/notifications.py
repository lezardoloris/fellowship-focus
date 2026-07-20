"""Windows Action Center toasts — focus phase alerts."""

from __future__ import annotations

import sys


def notify(title: str, message: str, tray=None) -> None:
    if sys.platform == "win32":
        try:
            from winotify import Notification

            toast = Notification(
                app_id="Fellowship Focus",
                title=title,
                msg=message,
                duration="short",
            )
            toast.show()
            return
        except Exception:
            pass
    if tray is not None:
        try:
            tray.showMessage(title, message)
        except Exception:
            pass
