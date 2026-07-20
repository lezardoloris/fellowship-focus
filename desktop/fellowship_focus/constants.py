import json
from pathlib import Path

APPLICATION_NAME = "Fellowship Focus"

MITMDUMP_SHUTDOWN_URL = "http://shutdown.fellowshipfocus.internal/"
MITMDUMP_CHECK_URL = "http://check.fellowshipfocus.internal/"

_BLOCKLIST_PATH = Path(__file__).resolve().parents[2] / "blocklist.json"
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
