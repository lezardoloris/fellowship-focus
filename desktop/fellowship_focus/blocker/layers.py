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
    # [REL-6] Before the first write, never after: a crash between here and the
    # hosts file must still leave a trace that this machine owes a cleanup.
    # After the guard above, so a no-op call cannot open a journal that nothing
    # will ever close.
    journal_open(["hosts", "quic"])

    if elevate.is_admin():
        # Already elevated — just do it.
        result["hosts"] = elevate.apply_hosts(domains)
        result["quic"] = elevate.apply_quic_block()
        _applied = result["hosts"] or result["quic"]
        if _applied:
            atexit.register(clear_layers)
        blocker_log(f"layers apply (admin): {result}")
        return result

    # Not elevated. Prefer the persistent agent: it prompts for UAC ONCE, then
    # every later arm/disarm is a silent file write. This is the whole point —
    # the user should not face a yes/no every single time they toggle.
    if not elevate.agent_alive():
        elevate.start_agent_elevated()  # one UAC prompt, if the user accepts

    if elevate.agent_alive() and elevate.send_agent_command("apply", domains):
        import time

        for _ in range(24):
            if _hosts_block_present():
                result["hosts"] = True
                break
            time.sleep(0.25)
        result["quic"] = _quic_rule_present()
    else:
        # Agent unavailable (UAC declined) — one-shot fallback, no persistence.
        df = _write_domains_file(domains)
        if _frozen():
            launched = _run_frozen_elevated("apply", df)
        else:
            launched = elevate.run_elevated("apply", df)
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


# [REL-6] Written BEFORE anything is applied, deleted only after a verified
# release. atexit does not run on a kill, so the file is the only thing that
# survives to say "this machine still owes a cleanup".
_JOURNAL_PATH = Path.home() / ".fellowship-focus" / "armed.json"


def journal_open(layers: list[str]) -> None:
    try:
        import json
        import time

        _JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
        _JOURNAL_PATH.write_text(
            json.dumps({"at": time.time(), "pid": os.getpid(), "layers": layers}),
            encoding="utf-8",
        )
    except Exception:
        pass


def journal_close() -> None:
    try:
        _JOURNAL_PATH.unlink(missing_ok=True)
    except Exception:
        pass


def journal_open_from_previous_run() -> bool:
    """True if a previous run armed and never closed its journal."""
    try:
        import json

        data = json.loads(_JOURNAL_PATH.read_text(encoding="utf-8"))
        return int(data.get("pid", 0)) != os.getpid()
    except Exception:
        return False


def residue_present() -> bool:
    """Is anything still blocking at the OS level, whatever this process did?

    Deliberately reads the machine, not our own state. A hosts block written by
    a run that was killed from Task Manager outlives the process that made it,
    and it takes down NATIVE apps too — WhatsApp Desktop resolves the same
    whatsapp.net that the browser does. Trusting an in-process flag here is how
    a stale block survives forever.
    """
    if os.name != "nt":
        return False
    return _hosts_block_present() or _quic_rule_present()


def clear_layers() -> bool:
    """Remove the hosts block and the QUIC rule. Returns True once verified gone.

    Two rules learned the hard way:

    1. Never gate on `_applied`. That module global is False in every fresh
       process, so after a kill-and-relaunch the old code took no branch at all
       and still logged "layers cleared" — leaving every blocked domain dead,
       native apps included, with the log saying otherwise.
    2. Always re-read the machine afterwards. Firing a command at the elevated
       agent is not the same as the block being gone.
    """
    global _applied
    if os.name != "nt":
        return True
    if not residue_present():
        _applied = False
        journal_close()
        return True

    import time

    try:
        if elevate.is_admin():
            elevate.clear_hosts()
            elevate.clear_quic_block()
        elif elevate.agent_alive() and elevate.send_agent_command("clear"):
            pass
        else:
            # No agent (declined UAC, or it died with us). Escalate anyway:
            # residue is present, so this is worth one prompt.
            if _frozen():
                _run_frozen_elevated("clear", None)
            else:
                elevate.run_elevated("clear")
    except Exception as e:
        blocker_log(f"layers clear error: {e}")

    for _ in range(24):
        if not residue_present():
            _applied = False
            journal_close()
            blocker_log("layers cleared (verified)")
            return True
        time.sleep(0.25)

    _applied = True
    blocker_log(
        "layers clear FAILED — residue still present "
        f"(hosts={_hosts_block_present()}, quic={_quic_rule_present()})"
    )
    return False


def release_all() -> dict:
    """[REL-4] Undo every machine-level change the blocker can make, and prove it.

    One entry point, because the layers were applied from four places and
    removed from three others, which is how four of them ended up with no
    reliable undo at all.

    Returns {"ok": bool, "layers": {name: cleared_bool}, "stuck": [names]} so
    the UI can name exactly what resisted instead of showing a vague failure.
    Deliberately usable when the shield believes it is already off: that case
    is precisely the one that strands a user with no network access.
    """
    from fellowship_focus.blocker.manager import (
        force_release_blocker,
        quic_residue_present,
        restore_browser_quic,
    )

    results: dict[str, bool] = {}

    try:
        force_release_blocker()
        results["proxy"] = True
    except Exception as e:
        blocker_log(f"release_all proxy error: {e}")
        results["proxy"] = False

    results["hosts_quic"] = clear_layers()

    try:
        restore_browser_quic()
        results["browser_quic"] = not quic_residue_present()
    except Exception as e:
        blocker_log(f"release_all quic error: {e}")
        results["browser_quic"] = False

    stuck = [k for k, v in results.items() if not v]
    blocker_log(f"release_all: {results}")
    return {"ok": not stuck, "layers": results, "stuck": stuck}


def anything_blocking() -> bool:
    """Any machine-level residue at all, across every layer. Drives the repair UI."""
    if os.name != "nt":
        return False
    from fellowship_focus.blocker.manager import quic_residue_present

    try:
        return residue_present() or quic_residue_present()
    except Exception:
        return residue_present()


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
    """State of the admin-only layers (hosts file + QUIC firewall rule)."""
    return {
        "hosts": _hosts_block_present(),
        "quic": _quic_rule_present(),
        "admin": elevate.is_admin(),
    }


def shield_strength(proxy_up: bool, sysproxy_ok: bool) -> dict:
    """Full picture of the shield across all four layers, for the UI.

    proxy_up / sysproxy_ok come from the running app (the mitm engine liveness
    and whether the system-proxy registry write landed). hosts/quic are read
    live here. Returns per-layer booleans, a 0-4 count, a coarse level, and the
    list of missing layers so the UI can name exactly what's off.
    """
    st = layers_status()
    layers = {
        "proxy": bool(proxy_up),
        "system_proxy": bool(proxy_up and sysproxy_ok),
        "hosts": bool(st["hosts"]),
        "quic": bool(st["quic"]),
    }
    live = sum(1 for v in layers.values() if v)
    missing = [k for k, v in layers.items() if not v]
    if live >= 4:
        level = "full"
    elif live == 0:
        level = "off"
    elif layers["hosts"] or (layers["proxy"] and layers["system_proxy"]):
        level = "partial"
    else:
        level = "weak"
    return {
        "layers": layers,
        "live": live,
        "total": 4,
        "level": level,
        "missing": missing,
        "admin": bool(st["admin"]),
    }
