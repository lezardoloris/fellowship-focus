"""Manual end-to-end check of the admin blocking layers (hosts + QUIC firewall).

Run it yourself, accept the ONE UAC prompt:
    python desktop\\scripts\\test_layers.py

It applies the layers, verifies the hosts block and firewall rule landed,
confirms a blocked domain no longer resolves to the real server, then cleans
everything up. Leaves the machine exactly as it found it.
"""

import socket
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fellowship_focus.blocker import elevate, layers  # noqa: E402

DOMAINS = ["twitter.com", "youtube.com", "reddit.com"]


def resolves_real(domain: str) -> bool:
    """True if the domain still resolves to a non-loopback address."""
    try:
        ip = socket.gethostbyname(domain)
        return not (ip.startswith("0.") or ip.startswith("127."))
    except Exception:
        return False


def main() -> int:
    print(f"admin: {elevate.is_admin()}")
    if not elevate.is_admin():
        print("Re-launching elevated (accept the UAC prompt)…")
        ok = layers._run_frozen_elevated  # noqa: F841  (dev uses run_elevated)
        # In dev just relaunch this exact script elevated.
        import ctypes

        rc = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, f'"{__file__}"', None, 1
        )
        print("relaunch rc:", rc, "(a new elevated window runs the real test)")
        return 0

    print("\n=== applying layers ===")
    print("apply_hosts:", elevate.apply_hosts(DOMAINS))
    print("apply_quic :", elevate.apply_quic_block())

    time.sleep(1)
    # Windows caches DNS; flush so the hosts entries take effect now.
    subprocess.run(["ipconfig", "/flushdns"], capture_output=True)

    print("\n=== verifying ===")
    hosts = elevate.HOSTS_PATH.read_text(encoding="utf-8", errors="replace")
    print("hosts block present:", elevate.BEGIN in hosts)
    rule = subprocess.run(
        ["netsh", "advfirewall", "firewall", "show", "rule", "name=FellowshipFocusQUIC"],
        capture_output=True,
        text=True,
    )
    print("firewall rule present:", "FellowshipFocusQUIC" in (rule.stdout or ""))
    for d in DOMAINS:
        print(f"  {d:14} reaches real server: {resolves_real(d)}  (want False)")

    input("\nCheck a browser now if you like, then press Enter to clean up… ")

    print("\n=== cleaning up ===")
    print("clear_hosts:", elevate.clear_hosts())
    print("clear_quic :", elevate.clear_quic_block())
    subprocess.run(["ipconfig", "/flushdns"], capture_output=True)
    print("done — machine restored.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
