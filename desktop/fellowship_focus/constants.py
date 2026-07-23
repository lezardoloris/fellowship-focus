import json
import sys
from pathlib import Path

APPLICATION_NAME = "Fellowship Focus"

MITMDUMP_SHUTDOWN_URL = "http://shutdown.fellowshipfocus.internal/"
MITMDUMP_CHECK_URL = "http://check.fellowshipfocus.internal/"
MITMDUMP_ADD_SITE_URL = "http://add.fellowshipfocus.internal/"


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

# Sites that live on more than one apex domain. Blocking any one form must block
# them all — otherwise blocking twitter.com leaves x.com wide open, which is
# exactly how "the blocker doesn't work" happened. Kept in sync with the Chrome
# extension's DOMAIN_ALIASES (extension/background.js).
DOMAIN_ALIASES = {
    "youtube.com": ["youtu.be", "youtube-nocookie.com", "m.youtube.com", "music.youtube.com"],
    "twitter.com": ["x.com", "t.co"],
    "x.com": ["twitter.com", "t.co"],
    "facebook.com": ["fb.com", "fb.watch"],
    "instagram.com": ["ig.me"],
    "reddit.com": ["redd.it"],
    "tiktok.com": ["vm.tiktok.com"],
}

# Social / video / news (+ history distractors). Kept in sync with
# extension/history.js DOPAMINE_SITES for "Block this site?" prompts.
DOPAMINE_SITES = frozenset(
    {
        "youtube.com",
        "x.com",
        "twitter.com",
        "reddit.com",
        "instagram.com",
        "tiktok.com",
        "facebook.com",
        "netflix.com",
        "twitch.tv",
        "linkedin.com",
        "news.google.com",
        "cnn.com",
        "bbc.com",
        "amazon.com",
        "ebay.com",
        "pinterest.com",
        "discord.com",
        "web.whatsapp.com",
        "primevideo.com",
        "disneyplus.com",
        "lemonde.fr",
        "threads.net",
    }
)

# Legacy / variant forms folded to a single canonical host so the block list,
# the web categories and the matcher all speak one vocabulary.
CANONICAL_HOST = {
    "fb.com": "facebook.com",
    "m.facebook.com": "facebook.com",
    "old.reddit.com": "reddit.com",
    "m.youtube.com": "youtube.com",
    "music.youtube.com": "youtube.com",
    "youtu.be": "youtube.com",
    "mobile.twitter.com": "twitter.com",
}


def _norm_host(site: str) -> str:
    return (
        str(site or "")
        .strip()
        .lower()
        .replace("https://", "")
        .replace("http://", "")
        .removeprefix("www.")
        .split("/")[0]
        .strip()
    )


def canonical_host(site: str) -> str:
    """Fold a known variant to its canonical apex (fb.com -> facebook.com)."""
    h = _norm_host(site)
    return CANONICAL_HOST.get(h, h)


def expand_domains(site: str) -> list[str]:
    """A site plus every apex that must die with it (twitter.com -> +x.com,t.co)."""
    base = canonical_host(site)
    if not base:
        return []
    out = [base]
    for alias in DOMAIN_ALIASES.get(base, []):
        if alias not in out:
            out.append(alias)
    return out


def effective_block_lists(config: dict) -> tuple[list[str], list]:
    """Resolve the (domains, path_rules) to block for the given config.

    Soft mode (Feeds only): do **not** auto-add YouTube/Instagram/LinkedIn.
    Whatever the user put on the list is still blocked as a whole domain —
    otherwise adding Video → youtube.com looked blocked in the UI but watch
    pages kept working (only /shorts was enforced).

    Hard mode (Whole sites): auto-add those optional hosts on top of the list.

    Path rules (Shorts/Reels) always stay active as a belt-and-suspenders layer.
    Every site is alias-expanded, so blocking one form blocks them all.
    """
    raw = list(config.get("blocked_sites", DEFAULT_BLOCKED_SITES))
    path_rules = list(config.get("blocked_path_rules", DEFAULT_PATH_RULES))
    mode = config.get("blocker_mode", "soft")

    if mode == "hard":
        for host in HARD_HOSTS_OPTIONAL:
            if canonical_host(host) not in {canonical_host(s) for s in raw}:
                raw.append(host)

    sites: list[str] = []
    seen: set[str] = set()
    for site in raw:
        for domain in expand_domains(site):
            if domain not in seen:
                seen.add(domain)
                sites.append(domain)
    return sites, path_rules
