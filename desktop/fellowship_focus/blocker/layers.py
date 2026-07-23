"""Defense-in-depth orchestration for the blocker.

The proxy alone is bypassed by QUIC/HTTP-3 (UDP), so a site loads maybe 6/10.
These extra layers close that gap so blocking holds 10/10:

  * hosts file  — every blocked domain → 0.0.0.0. Kills QUIC, every browser,
                  and native apps. Admin.
  * QUIC firewall rule — block outbound UDP 443 so Chromium falls back to TCP
                  (into the proxy) without a browser restart. Admin.

Both need elevation, done once via a UAC prompt (see elevate.run_elevated).
If the user declines, we degrade gracefully to proxy + extension and say so.
"""

from __future__ import annotations

import atexit
import os
import tempfile
from pathlib import Path

from fellowship_focus.blocker import elevate
from fellowship_focus.blocker.manager import blocker_log

_applied = False


def _write_domains_file(domains: list[str]) -> str:
    fd, path = tempfile.mkstemp(prefix="ff-domains-", suffix=".txt")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(domains))
    return path


def _frozen() -> bool:
    import sys

    return bool(getattr(sys, "frozen", False))


def apply_layers(domains: list[str]) -> dict:
    """Apply the admin layers. Returns {'hosts': bool, 'quic': bool, 'admin': bool}.

    Best-effort: if elevation is refused or fails, returns admin=False and the
    caller keeps running on proxy + extension only.
    """
    global _applied
    result = {"hosts": False, "quic": False, "admin": elevate.is_admin()}
    if os.name != "nt" or not domains:
        return result

    if elevate.is_admin():
        result["hosts"] = elevate.apply_hosts(domains)
        result["quic"] = elevate.apply_quic_block()
    else:
        # One UAC prompt runs the elevated helper with the domain list.
        df = _write_domains_file(domains)
        if _frozen():
            launched = _run_frozen_elevated("apply", df)
        else:
            launched = elevate.run_elevated("apply", df)
        # We can't await the elevated process; verify the effect landed.
        if launched:
            import time

            for _ in range(20):
                if _hosts_block_present():
                    result["hosts"] = True
                    break
                time.sleep(0.25)
            result["quic"] = _quic_rule_present()
        try:
            Path(df).unlink(missing_ok=True)
        except Exception:
            pass

    _applied = result["hosts"] or result["quic"]
    if _applied:
        atexit.register(clear_layers)
    blocker_log(f"layers apply: {result}")
    return result


def clear_layers() -> None:
    global _applied
    if os.name != "nt":
        return
    try:
        if elevate.is_admin():
            elevate.clear_hosts()
            elevate.clear_quic_block()
        elif _applied:
            if _frozen():
                _run_frozen_elevated("clear", None)
            else:
                elevate.run_elevated("clear")
    except Exception as e:
        blocker_log(f"layers clear error: {e}")
    finally:
        _applied = False
        blocker_log("layers cleared")


def _hosts_block_present() -> bool:
    try:
        return elevate.BEGIN in elevate.HOSTS_PATH.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return False


def _quic_rule_present() -> bool:
    import subprocess

    try:
        out = subprocess.run(
            ["netsh", "advfirewall", "firewall", "show", "rule", f"name={elevate.FIREWALL_RULE}"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=elevate.CREATE_NO_WINDOW,
        )
        return elevate.FIREWALL_RULE in (out.stdout or "")
    except Exception:
        return False


def _run_frozen_elevated(action: str, domains_file: str | None) -> bool:
    """In the frozen build there's no `python -m`; the exe re-runs itself with
    a hidden flag (see main.py --elevate-blocker)."""
    import ctypes
    import sys

    try:
        args = f"--elevate-blocker {action}"
        if domains_file:
            args += f' "{domains_file}"'
        rc = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, args, None, 0)
        return int(rc) > 32
    except Exception:
        return False


def layers_status() -> dict:
    return {
        "hosts": _hosts_block_present(),
        "quic": _quic_rule_present(),
        "admin": elevate.is_admin(),
    }
