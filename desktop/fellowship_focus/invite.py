"""Parse fellowship invite links or desktop sync JSON from the web dashboard."""

from __future__ import annotations

import json
import re
from typing import Any

INVITE_RE = re.compile(r"^(https?://[^/\s]+)/f/([^/?#\s]+)", re.IGNORECASE)


def parse_invite_or_sync(text: str) -> dict[str, str] | None:
    """Return partial config keys: api_url, fellowship_code, member_token, member_name."""
    raw = text.strip()
    if not raw:
        return None

    if raw.startswith("{"):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None
        code = str(data.get("code") or data.get("fellowship_code") or "").strip()
        token = str(data.get("token") or data.get("member_token") or "").strip()
        if not code:
            return None
        out: dict[str, str] = {"fellowship_code": code}
        api = str(data.get("apiUrl") or data.get("api_url") or "").strip()
        if api:
            out["api_url"] = api.rstrip("/")
        if token:
            out["member_token"] = token
        name = str(data.get("name") or data.get("member_name") or "").strip()
        if name:
            out["member_name"] = name
        return out

    match = INVITE_RE.search(raw)
    if match:
        return {
            "api_url": match.group(1).rstrip("/"),
            "fellowship_code": match.group(2),
        }

    if "://" not in raw and "/" not in raw:
        return {"fellowship_code": raw}

    return None


def apply_parsed_config(config: dict[str, Any], parsed: dict[str, str]) -> bool:
    """Merge parsed values into config. Returns True if anything changed."""
    changed = False
    for key, value in parsed.items():
        if value and config.get(key) != value:
            config[key] = value
            changed = True
    return changed
