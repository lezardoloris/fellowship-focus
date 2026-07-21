import json
import sys
from pathlib import Path

APPLICATION_NAME = "Fellowship Focus"

MITMDUMP_SHUTDOWN_URL = "http://shutdown.fellowshipfocus.internal/"
MITMDUMP_CHECK_URL = "http://check.fellowshipfocus.internal/"


def _resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parents[2]


_BLOCKLIST_PATH = _resource_root() / "blocklist.json"
_DESKTOP_BLOCKLIST = Path(__file__).resolve().parents[1].parent / "blocklist.json"

_FALLBACK_BLOCKED_SITES = [
    "twitter.com",
    "x.com",
    "reddit.com",
    "tiktok.com",
    "facebook.com",
    "pornhub.com",
    "netflix.com",
]

_FALLBACK_PATH_RULES = [
    {"host": "youtube.com", "paths": ["/shorts", "/feed/trending"]},
    {"host": "m.youtube.com", "paths": ["/shorts"]},
    {"host": "instagram.com", "paths": ["/reels", "/explore", "/stories"]},
]

_FALLBACK_REDIRECTS = {
    "default": [
        {"label": "Back to work", "url": "https://notion.so"},
        {"label": "Deep work timer", "url": "https://pomofocus.io"},
    ],
    "nsfw": [
        {"label": "Breathing", "url": "https://www.calm.com/breathe"},
        {"label": "TED", "url": "https://www.ted.com"},
    ],
    "social": [
        {"label": "Write instead", "url": "https://docs.google.com"},
        {"label": "Ship something", "url": "https://github.com"},
    ],
}


def _load_blocklist_data() -> dict:
    for path in (_BLOCKLIST_PATH, _DESKTOP_BLOCKLIST):
        try:
            if path.exists():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
    return {}


_DATA = _load_blocklist_data()

DEFAULT_BLOCKED_SITES = list(_DATA.get("sites") or _FALLBACK_BLOCKED_SITES)
DEFAULT_PATH_RULES = list(_DATA.get("path_rules") or _FALLBACK_PATH_RULES)
DEFAULT_REDIRECTS = dict(_DATA.get("redirects") or _FALLBACK_REDIRECTS)
HARD_HOSTS_OPTIONAL = list(_DATA.get("hard_hosts_optional") or [])

PROXY_PORT = 8080
MITMDUMP_PORT = 8080


def effective_block_lists(config: dict) -> tuple[list[str], list]:
    """Resolve the (domains, path_rules) to block for the given config.

    Soft mode (Deep Work): distraction hosts like YouTube/Instagram are filtered
    only by path (Shorts/Reels), so they drop out of the full-domain list.
    Hard mode (Lockdown): those hosts get blocked entirely.
    """
    sites = list(config.get("blocked_sites", DEFAULT_BLOCKED_SITES))
    path_rules = list(config.get("blocked_path_rules", DEFAULT_PATH_RULES))
    mode = config.get("blocker_mode", "soft")
    if mode == "hard":
        for host in HARD_HOSTS_OPTIONAL:
            if host not in sites:
                sites.append(host)
    else:
        soft_hosts = set(HARD_HOSTS_OPTIONAL)
        sites = [s for s in sites if s not in soft_hosts]
    return sites, path_rules
