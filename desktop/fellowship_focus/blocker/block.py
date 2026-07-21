"""Block URLs — domain + path rules (Curbox-style Shorts/Reels)."""

import base64
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from mitmproxy import ctx, http

from block_page import build_block_html
from constants import MITMDUMP_CHECK_URL, MITMDUMP_SHUTDOWN_URL


def load(loader) -> None:
    loader.add_option("addresses_str", str, "", "Comma-separated full-block domains.")
    loader.add_option("path_rules_b64", str, "", "Base64 JSON path rules.")
    loader.add_option("redirects_b64", str, "", "Base64 JSON redirects.")
    loader.add_option("block_type", str, "blocklist", "Allowlist or blocklist.")
    loader.add_option("api_url", str, "", "Fellowship API URL for block logging.")
    loader.add_option("member_token", str, "", "Member token for block logging.")
    loader.add_option("dashboard_url", str, "", "Guild dashboard URL for the block page CTA.")


def _decode_json(b64: str, default):
    if not b64:
        return default
    try:
        return json.loads(base64.b64decode(b64.encode("ascii")).decode("utf-8"))
    except Exception:
        return default


def _log_block_and_get_meta(site: str) -> dict:
    api_url = ctx.options.api_url.strip()
    token = ctx.options.member_token.strip()
    default = {
        "penalty": 10,
        "weekly_net": 0,
        "rank": 0,
        "total_members": 0,
        "fellowship_tax": 3,
        "member_name": "",
    }
    if not api_url or not token:
        return default
    try:
        data = json.dumps({"token": token, "site": site}).encode()
        req = urllib.request.Request(
            f"{api_url.rstrip('/')}/api/blocks",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            return {**default, **json.loads(resp.read().decode())}
    except Exception:
        return default


def _strip_www(domain: str) -> str:
    return domain[4:] if domain.startswith("www.") else domain


def _domain_matches(domain: str, blocked: str) -> bool:
    blocked = _strip_www(blocked)
    return domain == blocked or domain.endswith("." + blocked)


def _path_matches(path: str, rules: list, domain: str) -> str | None:
    path_l = (path or "/").lower()
    for rule in rules:
        host = _strip_www(str(rule.get("host", "")).lower())
        if not host or not _domain_matches(domain, host):
            continue
        for p in rule.get("paths") or []:
            prefix = str(p).lower()
            if not prefix.startswith("/"):
                prefix = "/" + prefix
            if path_l == prefix or path_l.startswith(prefix + "/") or path_l.startswith(prefix + "?"):
                return prefix
    return None


def _category_for(site: str) -> str:
    nsfw = ("pornhub", "xvideos", "xnxx", "redtube", "onlyfans", "chaturbate")
    social = ("twitter", "x.com", "reddit", "instagram", "facebook", "tiktok", "threads")
    s = site.lower()
    if any(n in s for n in nsfw):
        return "nsfw"
    if any(n in s for n in social):
        return "social"
    return "default"


def request(flow) -> None:
    if flow.request.pretty_url == MITMDUMP_SHUTDOWN_URL:
        flow.response = http.Response.make(200, b"Shutting down mitmproxy...\n", {"Content-Type": "text/plain"})
        ctx.master.shutdown()
        return

    if flow.request.pretty_url == MITMDUMP_CHECK_URL:
        flow.response = http.Response.make(200, b"Mitmdump is running.\n", {"Content-Type": "text/plain"})
        return

    addresses = {_strip_www(a.strip()) for a in ctx.options.addresses_str.split(",") if a.strip()}
    path_rules = _decode_json(ctx.options.path_rules_b64, [])
    redirects = _decode_json(ctx.options.redirects_b64, {})

    parsed = urllib.parse.urlparse(flow.request.pretty_url)
    url_domain = _strip_www(parsed.netloc.lower())
    path = parsed.path or "/"

    full_hit = any(_domain_matches(url_domain, a) for a in addresses)
    path_hit = _path_matches(path, path_rules, url_domain) if path_rules else None

    should_block = False
    reason = ""
    if full_hit:
        should_block = True
        reason = "domain"
    elif path_hit:
        should_block = True
        reason = f"path:{path_hit}"

    if ctx.options.block_type == "allowlist":
        should_block = not full_hit and not path_hit

    if should_block:
        display = url_domain if reason == "domain" else f"{url_domain}{path_hit}"
        meta = _log_block_and_get_meta(display)
        cat = _category_for(url_domain)
        alts = redirects.get(cat) or redirects.get("default") or []
        html = build_block_html(
            site=display,
            penalty=meta.get("penalty", 10),
            member_name=meta.get("member_name", ""),
            weekly_net=meta.get("weekly_net", 0),
            rank=meta.get("rank", 0),
            total_members=meta.get("total_members", 0),
            fellowship_tax=meta.get("fellowship_tax", 3),
            alternatives=alts,
            reason=reason,
            dashboard_url=ctx.options.dashboard_url.strip(),
        )
        flow.response = http.Response.make(200, html.encode("utf-8"), {"Content-Type": "text/html; charset=utf-8"})
