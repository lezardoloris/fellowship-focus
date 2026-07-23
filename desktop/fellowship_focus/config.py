import json
from pathlib import Path

from fellowship_focus.constants import (
    DEFAULT_BLOCKED_SITES,
    DEFAULT_PATH_RULES,
    DEFAULT_REDIRECTS,
    HARD_HOSTS_OPTIONAL,
    canonical_host,
)

CONFIG_DIR = Path.home() / ".fellowship-focus"
CONFIG_FILE = CONFIG_DIR / "config.json"


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return default_config()
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        merged = {**default_config(), **data}
        # Merge new default sites into saved config (don't remove user additions),
        # folding variant hosts to their canonical apex (fb.com -> facebook.com)
        # so the list, the web categories and the matcher share one vocabulary.
        sites: list[str] = []
        seen: set[str] = set()
        for site in list(merged.get("blocked_sites", [])) + list(DEFAULT_BLOCKED_SITES):
            host = canonical_host(site)
            if host and host not in seen:
                seen.add(host)
                sites.append(host)
        merged["blocked_sites"] = sites
        merged["member_name"] = _repair_member_name(merged)
        return merged
    except Exception:
        return default_config()


def _repair_member_name(config: dict) -> str:
    """Heal configs where an invite link or sync JSON was pasted into the name field."""
    name = str(config.get("member_name") or "").strip()
    if not name:
        return ""
    if name.startswith("{"):
        try:
            payload = json.loads(name)
        except json.JSONDecodeError:
            return ""
        if isinstance(payload, dict):
            # Recover the real values that were buried in the pasted blob.
            for src, dest in (("apiUrl", "api_url"), ("code", "fellowship_code"), ("token", "member_token")):
                value = str(payload.get(src) or "").strip()
                if value and not str(config.get(dest) or "").strip():
                    config[dest] = value.rstrip("/") if dest == "api_url" else value
            return str(payload.get("name") or "").strip()[:40]
        return ""
    if "://" in name:
        return ""
    return name[:40]


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def default_config() -> dict:
    return {
        "api_url": "https://fellowship-focus-production.up.railway.app",
        "member_token": "",
        "member_name": "",
        "fellowship_code": "",
        "blocked_sites": DEFAULT_BLOCKED_SITES.copy(),
        "session_minutes": 25,
        "work_duration": 45,
        "break_duration": 10,
        "long_break_duration": 15,
        "work_intervals": 2,
        "enable_website_blocker": True,
        "blocker_mode": "hard",
        "allowed_sites": [
            "github.com",
            "githubusercontent.com",
            "docs.google.com",
            "stackoverflow.com",
            "notion.so",
            "up.railway.app",
        ],
        "blocked_path_rules": DEFAULT_PATH_RULES.copy(),
        "block_redirects": DEFAULT_REDIRECTS.copy(),
        "pause_blocker_minutes": 0,
        "minimize_to_tray": True,
        "cert_setup_done": False,
        "startup_on_boot": False,
        "start_minimized": True,
        "okr_weekly_focus_hours": 20,
        "okr_habit_rate": 80,
        "okr_focus_score": 70,
        "okr_freelance_revenue_eur": 3000,
        "okr_revenue_current_eur": 0,
        "auto_update": True,
        "proof_mode": "signal",
        "proof_interval_min": 10,
        "proof_webcam": False,
        # Enables Soundscape controls; does NOT auto-play on timer start.
        "focus_music_enabled": True,
        "focus_music_volume": 0.5,
        "focus_music_track": "",
        "screen_time_enabled": True,
        "usage_categories": {},
    }
