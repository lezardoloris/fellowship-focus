"""Elevated blocker helper — the admin-only layers (hosts file + QUIC firewall).

Run in two ways:
  * As a subprocess elevated via UAC (ShellExecute "runas") — see run_elevated().
  * Directly: `python -m fellowship_focus.blocker.elevate apply <domains-file>`
    / `... clear`. The subcommands are what the elevated process executes.

hosts and the Windows firewall both require admin, so this module is the single
place that touches them. Everything is idempotent and self-cleaning: a delimited
block is added/removed as a whole, never half-written.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

HOSTS_PATH = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "drivers" / "etc" / "hosts"
BEGIN = "# >>> Fellowship Focus (auto) — do not edit"
END = "# <<< Fellowship Focus"
FIREWALL_RULE = "FellowshipFocusQUIC"

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

# Persistent-agent IPC. The elevated agent (started by ONE UAC prompt) watches
# this file for commands, so later arm/disarm toggles never prompt again.
AGENT_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "FellowshipFocus"
AGENT_CMD = AGENT_DIR / "agent-cmd.json"
AGENT_ACK = AGENT_DIR / "agent-ack.json"
AGENT_HEARTBEAT = AGENT_DIR / "agent-alive"


# ── hosts file ───────────────────────────────────────────

def _read_hosts() -> str:
    try:
        return HOSTS_PATH.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def _strip_block(text: str) -> str:
    """Remove any existing Fellowship block (between BEGIN/END), keep the rest."""
    out, skipping = [], False
    for line in text.splitlines():
        if line.strip() == BEGIN:
            skipping = True
            continue
        if line.strip() == END:
            skipping = False
            continue
        if not skipping:
            out.append(line)
    cleaned = "\n".join(out).rstrip("\n")
    return cleaned + "\n" if cleaned else ""


def apply_hosts(domains: list[str]) -> bool:
    """Point every domain (and www.) at 0.0.0.0. Replaces any prior block."""
    base = _strip_block(_read_hosts())
    lines = [BEGIN]
    seen = set()
    for d in domains:
        d = d.strip().lower()
        if not d or d in seen:
            continue
        seen.add(d)
        lines.append(f"0.0.0.0 {d}")
        lines.append(f"0.0.0.0 www.{d}")
    lines.append(END)
    block = "\n".join(lines) + "\n"
    try:
        HOSTS_PATH.write_text(base + block, encoding="utf-8")
        return True
    except Exception:
        return False


def clear_hosts() -> bool:
    try:
        HOSTS_PATH.write_text(_strip_block(_read_hosts()), encoding="utf-8")
        return True
    except Exception:
        return False


# ── QUIC firewall rule ───────────────────────────────────

def apply_quic_block() -> bool:
    """Block outbound UDP 443 so Chromium falls back to TCP (into the proxy)."""
    _run_netsh(["advfirewall", "firewall", "delete", "rule", f"name={FIREWALL_RULE}"])
    r = _run_netsh([
        "advfirewall", "firewall", "add", "rule",
        f"name={FIREWALL_RULE}", "dir=out", "action=block",
        "protocol=UDP", "remoteport=443", "enable=yes",
    ])
    return r == 0


def clear_quic_block() -> bool:
    _run_netsh(["advfirewall", "firewall", "delete", "rule", f"name={FIREWALL_RULE}"])
    return True


def _run_netsh(args: list[str]) -> int:
    try:
        return subprocess.run(
            ["netsh", *args],
            capture_output=True,
            timeout=15,
            creationflags=CREATE_NO_WINDOW,
        ).returncode
    except Exception:
        return 1


# ── elevation entry point ────────────────────────────────

def is_admin() -> bool:
    if os.name != "nt":
        return os.geteuid() == 0  # type: ignore[attr-defined]
    try:
        import ctypes

        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def run_elevated(action: str, domains_file: str | None = None, timeout: int = 120) -> bool:
    """Trigger one UAC prompt and run this module elevated. Returns success.

    action: 'apply' (needs domains_file) or 'clear'.
    """
    if os.name != "nt":
        return False
    try:
        import ctypes

        args = f'-m fellowship_focus.blocker.elevate {action}'
        if domains_file:
            args += f' "{domains_file}"'
        # ShellExecuteW with "runas" raises the UAC dialog. SW_HIDE = 0.
        rc = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, args, str(_pkg_root()), 0
        )
        # ShellExecuteW returns > 32 on success (process launched). We can't
        # easily await it, so callers verify the effect (hosts/rule present).
        return int(rc) > 32
    except Exception:
        return False


def _pkg_root() -> Path:
    # Directory that contains the fellowship_focus package (so -m resolves).
    return Path(__file__).resolve().parents[2]


# ── Persistent elevated agent ────────────────────────────
#
# The old model raised a UAC prompt on EVERY arm and EVERY disarm — exhausting.
# Instead we elevate ONCE to launch a long-lived admin agent that watches a
# command file. After that, turning the shield on/off is a plain file write with
# no prompt at all. The agent exits (and cleans up) when the app closes.

def agent_alive(max_age: float = 8.0) -> bool:
    """True if an elevated agent has touched its heartbeat recently."""
    try:
        return (time.time() - AGENT_HEARTBEAT.stat().st_mtime) < max_age
    except Exception:
        return False


def send_agent_command(action: str, domains: list[str] | None = None) -> bool:
    """Queue a command for the running elevated agent. No UAC. False if no agent."""
    if not agent_alive():
        return False
    try:
        AGENT_DIR.mkdir(parents=True, exist_ok=True)
        payload = {"seq": time.time(), "action": action, "domains": domains or []}
        AGENT_CMD.write_text(json.dumps(payload), encoding="utf-8")
        return True
    except Exception:
        return False


def start_agent_elevated() -> bool:
    """One UAC prompt: launch the persistent elevated agent. Returns launched."""
    if os.name != "nt":
        return False
    if agent_alive():
        return True
    try:
        import ctypes

        AGENT_DIR.mkdir(parents=True, exist_ok=True)
        # Frozen exe has no `python -m`; it re-runs itself with a hidden flag
        # that main.py routes back into elevate._main (see --elevate-blocker).
        if getattr(sys, "frozen", False):
            args = f"--elevate-blocker agent {os.getpid()}"
            cwd = None
        else:
            args = f"-m fellowship_focus.blocker.elevate agent {os.getpid()}"
            cwd = str(_pkg_root())
        rc = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, args, cwd, 0
        )
        if int(rc) <= 32:
            return False
        # Wait briefly for the agent to come up (it writes the heartbeat first).
        for _ in range(40):
            if agent_alive():
                return True
            time.sleep(0.1)
        return agent_alive()
    except Exception:
        return False


def _parent_alive(pid: int) -> bool:
    if pid <= 0:
        return True
    try:
        import ctypes

        PROCESS_QUERY_LIMITED = 0x1000
        h = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED, False, pid)
        if not h:
            return False
        code = ctypes.c_ulong()
        ok = ctypes.windll.kernel32.GetExitCodeProcess(h, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(h)
        return bool(ok) and code.value == 259  # STILL_ACTIVE
    except Exception:
        return True


def _run_agent(parent_pid: int) -> int:
    """Elevated loop: apply/clear on command, die with the parent, self-clean."""
    AGENT_DIR.mkdir(parents=True, exist_ok=True)
    last_seq = 0.0
    try:
        AGENT_HEARTBEAT.write_text(str(time.time()), encoding="utf-8")
    except Exception:
        pass
    try:
        while True:
            try:
                AGENT_HEARTBEAT.write_text(str(time.time()), encoding="utf-8")
            except Exception:
                pass
            if not _parent_alive(parent_pid):
                break
            try:
                if AGENT_CMD.exists():
                    cmd = json.loads(AGENT_CMD.read_text(encoding="utf-8"))
                    if float(cmd.get("seq", 0)) > last_seq:
                        last_seq = float(cmd.get("seq", 0))
                        action = cmd.get("action")
                        if action == "apply":
                            apply_hosts(list(cmd.get("domains") or []))
                            apply_quic_block()
                        elif action == "clear":
                            clear_hosts()
                            clear_quic_block()
                        elif action == "quit":
                            break
                        try:
                            AGENT_ACK.write_text(
                                json.dumps({"seq": last_seq, "action": action}),
                                encoding="utf-8",
                            )
                        except Exception:
                            pass
            except Exception:
                pass
            time.sleep(0.4)
    finally:
        # Never leave the machine filtered after the agent stops.
        clear_hosts()
        clear_quic_block()
        for p in (AGENT_HEARTBEAT, AGENT_CMD, AGENT_ACK):
            try:
                p.unlink()
            except Exception:
                pass
    return 0


def _main(argv: list[str]) -> int:
    if not argv:
        return 2
    action = argv[0]
    if action == "agent":
        parent_pid = int(argv[1]) if len(argv) > 1 and argv[1].isdigit() else 0
        return _run_agent(parent_pid)
    if action == "clear":
        clear_hosts()
        clear_quic_block()
        return 0
    if action == "apply":
        domains: list[str] = []
        if len(argv) > 1 and Path(argv[1]).exists():
            domains = [
                ln.strip()
                for ln in Path(argv[1]).read_text(encoding="utf-8").splitlines()
                if ln.strip()
            ]
        ok_h = apply_hosts(domains)
        ok_q = apply_quic_block()
        return 0 if (ok_h or ok_q) else 1
    return 2


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
