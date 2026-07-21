import base64
import importlib.util
import json
import os
import shutil
import ssl
import subprocess
import sys
import urllib.request
from pathlib import Path

import certifi
import psutil

from fellowship_focus.constants import MITMDUMP_CHECK_URL, MITMDUMP_SHUTDOWN_URL, MITMDUMP_PORT, PROXY_PORT

CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

KONCENTRO_MITMDUMP = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Koncentro" / "mitmdump.exe"

# Flag the app passes to itself to run the embedded mitmproxy engine (see main.py).
RUN_PROXY_FLAG = "--run-proxy"

# PIDs of proxy children we spawned. The proxy now runs as this app's own exe
# (FellowshipFocus.exe --run-proxy) or python.exe, NOT as mitmdump.exe, so we
# cannot kill it by process name without also killing the GUI. Track it instead.
_SPAWNED_PIDS: set[int] = set()


def find_mitmdump() -> str | None:
    """Locate an external mitmdump.exe. Legacy fallback only — the engine is bundled."""
    if KONCENTRO_MITMDUMP.exists():
        return str(KONCENTRO_MITMDUMP)
    path = shutil.which("mitmdump")
    if path:
        return path
    if os.name == "nt":
        return shutil.which("mitmdump.exe")
    return None


def _mitmproxy_available() -> bool:
    try:
        return importlib.util.find_spec("mitmproxy") is not None
    except Exception:
        return False


def proxy_engine_available() -> bool:
    """True when the app can run a proxy — embedded mitmproxy or an external binary."""
    return _proxy_launch_prefix() is not None


def _proxy_launch_prefix() -> list[str] | None:
    """Command prefix that starts the mitmproxy engine.

    Prefers the embedded mitmproxy (the app re-launches itself with --run-proxy),
    so no external mitmdump.exe or Koncentro install is required. Falls back to an
    external binary only if the Python package somehow isn't importable.
    """
    if getattr(sys, "frozen", False):
        return [sys.executable, RUN_PROXY_FLAG]
    if _mitmproxy_available():
        main_py = Path(__file__).resolve().parents[2] / "main.py"
        return [sys.executable, str(main_py), RUN_PROXY_FLAG]
    external = find_mitmdump()
    return [external] if external else None


def _resolve_block_script() -> Path:
    """Path to block.py, resolved for both dev and PyInstaller-frozen layouts.

    Under PyInstaller the module lives in the PYZ, so Path(__file__).parent is not
    a real directory. The spec copies fellowship_focus/blocker as data, so resolve
    from sys._MEIPASS when frozen.
    """
    candidates = []
    if getattr(sys, "frozen", False):
        candidates.append(Path(sys._MEIPASS) / "fellowship_focus" / "blocker" / "block.py")
    candidates.append(Path(__file__).parent / "block.py")
    for path in candidates:
        if path.exists():
            return path
    return Path(__file__).parent / "block.py"


def kill_mitmdump() -> None:
    self_pid = os.getpid()

    for pid in list(_SPAWNED_PIDS):
        try:
            psutil.Process(pid).kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        _SPAWNED_PIDS.discard(pid)

    legacy_names = {"mitmdump.exe", "mitmdump"}
    for proc in psutil.process_iter(["name", "cmdline", "pid"]):
        try:
            if proc.info["pid"] == self_pid:
                continue
            name = proc.info.get("name") or ""
            cmdline = proc.info.get("cmdline") or []
            if name in legacy_names or RUN_PROXY_FLAG in cmdline:
                proc.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass


def shutdown_mitmdump_gracefully() -> bool:
    try:
        proxy_url = f"http://127.0.0.1:{PROXY_PORT}"
        proxy_handler = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url})
        context = ssl.create_default_context(cafile=certifi.where())
        https_handler = urllib.request.HTTPSHandler(context=context)
        opener = urllib.request.build_opener(proxy_handler, https_handler)
        with opener.open(MITMDUMP_SHUTDOWN_URL, timeout=5):
            return True
    except Exception:
        kill_mitmdump()
        return False


def start_mitmdump(
    addresses: list[str],
    api_url: str = "",
    member_token: str = "",
    path_rules: list | None = None,
    redirects: dict | None = None,
    dashboard_url: str = "",
) -> subprocess.Popen | None:
    prefix = _proxy_launch_prefix()
    if not prefix:
        return None

    block_script = _resolve_block_script()
    joined = ",".join(addresses)
    rules_b64 = base64.b64encode(json.dumps(path_rules or []).encode()).decode("ascii")
    redirects_b64 = base64.b64encode(json.dumps(redirects or {}).encode()).decode("ascii")

    args = [
        *prefix,
        "--listen-host",
        "127.0.0.1",
        "-p",
        str(MITMDUMP_PORT),
        "--showhost",
        "-s",
        str(block_script),
        "--set",
        f"addresses_str={joined}",
        "--set",
        f"path_rules_b64={rules_b64}",
        "--set",
        f"redirects_b64={redirects_b64}",
        "--set",
        "block_type=blocklist",
        "--set",
        f"api_url={api_url}",
        "--set",
        f"member_token={member_token}",
        "--set",
        f"dashboard_url={dashboard_url}",
    ]

    if os.name == "nt":
        proc = subprocess.Popen(args, creationflags=CREATE_NO_WINDOW)
    else:
        proc = subprocess.Popen(args)
    _SPAWNED_PIDS.add(proc.pid)
    return proc


def set_system_proxy(enable: bool) -> None:
    from uniproxy import Uniproxy

    proxy = Uniproxy("127.0.0.1", PROXY_PORT)
    if enable:
        proxy.join()
    else:
        proxy.delete_proxy()


def force_release_blocker() -> None:
    """Stop mitmdump and clear the system proxy. Safe to call repeatedly."""
    try:
        shutdown_mitmdump_gracefully()
    except Exception:
        pass
    kill_mitmdump()
    try:
        set_system_proxy(False)
    except Exception:
        pass


def is_mitmdump_running() -> bool:
    try:
        proxy_url = f"http://127.0.0.1:{PROXY_PORT}"
        proxy_handler = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url})
        context = ssl.create_default_context(cafile=certifi.where())
        https_handler = urllib.request.HTTPSHandler(context=context)
        opener = urllib.request.build_opener(proxy_handler, https_handler)
        with opener.open(MITMDUMP_CHECK_URL, timeout=3):
            return True
    except Exception:
        return False
