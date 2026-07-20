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


def find_mitmdump() -> str | None:
    if KONCENTRO_MITMDUMP.exists():
        return str(KONCENTRO_MITMDUMP)
    path = shutil.which("mitmdump")
    if path:
        return path
    if os.name == "nt":
        return shutil.which("mitmdump.exe")
    return None


def kill_mitmdump() -> None:
    names = ["mitmdump.exe", "mitmdump"] if os.name == "nt" else ["mitmdump"]
    for proc in psutil.process_iter(["name"]):
        try:
            if proc.info["name"] in names:
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
) -> subprocess.Popen | None:
    mitmdump = find_mitmdump()
    if not mitmdump:
        return None

    block_script = Path(__file__).parent / "block.py"
    joined = ",".join(addresses)

    args = [
        mitmdump,
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
        "block_type=blocklist",
        "--set",
        f"api_url={api_url}",
        "--set",
        f"member_token={member_token}",
    ]

    if os.name == "nt":
        return subprocess.Popen(args, creationflags=CREATE_NO_WINDOW)
    return subprocess.Popen(args)


def set_system_proxy(enable: bool) -> None:
    from uniproxy import Uniproxy

    proxy = Uniproxy("127.0.0.1", PROXY_PORT)
    if enable:
        proxy.join()
    else:
        proxy.delete_proxy()


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
