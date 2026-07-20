import json
from pathlib import Path

from fellowship_focus.constants import DEFAULT_BLOCKED_SITES

CONFIG_DIR = Path.home() / ".fellowship-focus"
CONFIG_FILE = CONFIG_DIR / "config.json"


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return default_config()
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        merged = {**default_config(), **data}
        # Merge new default sites into saved config (don't remove user additions)
        sites = list(merged.get("blocked_sites", []))
        for site in DEFAULT_BLOCKED_SITES:
            if site not in sites:
                sites.append(site)
        merged["blocked_sites"] = sites
        return merged
    except Exception:
        return default_config()


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def default_config() -> dict:
    return {
        "api_url": "http://localhost:3000",
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
        "minimize_to_tray": True,
        "cert_setup_done": False,
        "startup_on_boot": False,
        "start_minimized": True,
        "okr_weekly_focus_hours": 20,
        "okr_habit_rate": 80,
        "okr_freelance_revenue_eur": 3000,
        "okr_revenue_current_eur": 0,
        "auto_update": True,
        "proof_mode": "signal",
        "proof_interval_min": 10,
        "proof_webcam": False,
    }
