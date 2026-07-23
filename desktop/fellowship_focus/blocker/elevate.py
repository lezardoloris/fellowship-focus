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

import os
import subprocess
import sys
from pathlib import Path

HOSTS_PATH = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "drivers" / "etc" / "hosts"
BEGIN = "# >>> Fellowship Focus (auto) — do not edit"
END = "# <<< Fellowship Focus"
FIREWALL_RULE = "FellowshipFocusQUIC"

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


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


def _main(argv: list[str]) -> int:
    if not argv:
        return 2
    action = argv[0]
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
