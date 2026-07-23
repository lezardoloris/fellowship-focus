"""Optional distraction-app process blocking (DISABLED by default).

Killing WhatsApp.Root.exe while the shield looked "off" was unacceptable —
so this module is inert unless explicitly enabled later via config.
Domain blocking (web.whatsapp.com / whatsapp.net) still applies only when
the shield is armed.
"""

from __future__ import annotations

# Kept for tests / future opt-in UI. Do NOT call from the arm/watchdog path
# unless config.block_desktop_apps is True AND blocker_active is True.
DEFAULT_BLOCKED_APPS: tuple[str, ...] = (
    "WhatsApp",
    "WhatsApp.Root",
    "WhatsAppDesktop",
)


def _norm_proc(name: str) -> str:
    n = (name or "").strip().lower()
    if n.endswith(".exe"):
        n = n[:-4]
    return n


def kill_blocked_apps(
    names: tuple[str, ...] | list[str] | None = None,
    *,
    enabled: bool = False,
) -> list[str]:
    """Terminate matching processes. No-op unless enabled=True (opt-in)."""
    if not enabled:
        return []
    try:
        import psutil
    except ImportError:
        return []

    from fellowship_focus.blocker.manager import blocker_log

    targets = {_norm_proc(n) for n in (names or DEFAULT_BLOCKED_APPS) if n}
    if not targets:
        return []

    killed: list[str] = []
    for proc in psutil.process_iter(["name", "pid"]):
        try:
            pname = _norm_proc(proc.info.get("name") or "")
            if pname not in targets:
                continue
            proc.kill()
            killed.append(proc.info.get("name") or pname)
            blocker_log(f"app blocked: killed {proc.info.get('name')} pid={proc.info.get('pid')}")
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
        except Exception as e:
            blocker_log(f"app block failed: {e}")
    return sorted(set(killed))
