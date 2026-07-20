"""Block URLs according to rules — Fellowship Focus."""

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
    loader.add_option("addresses_str", str, "", "Concatenated addresses.")
    loader.add_option("block_type", str, "blocklist", "Allowlist or blocklist.")
    loader.add_option("api_url", str, "", "Fellowship API URL for block logging.")
    loader.add_option("member_token", str, "", "Member token for block logging.")


def _log_block_and_get_meta(site: str) -> dict:
    api_url = ctx.options.api_url.strip()
    token = ctx.options.member_token.strip()
    default = {"penalty": 10, "weekly_net": 0, "rank": 0, "total_members": 0, "fellowship_tax": 3, "member_name": ""}
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


def request(flow) -> None:
    if flow.request.pretty_url == MITMDUMP_SHUTDOWN_URL:
        flow.response = http.Response.make(200, b"Shutting down mitmproxy...\n", {"Content-Type": "text/plain"})
        ctx.master.shutdown()
        return

    if flow.request.pretty_url == MITMDUMP_CHECK_URL:
        flow.response = http.Response.make(200, b"Mitmdump is running.\n", {"Content-Type": "text/plain"})
        return

    def strip_www(domain: str) -> str:
        return domain[4:] if domain.startswith("www.") else domain

    addresses = {strip_www(a.strip()) for a in ctx.options.addresses_str.split(",") if a.strip()}
    parsed = urllib.parse.urlparse(flow.request.pretty_url)
    url_domain = strip_www(parsed.netloc)
    has_match = url_domain in addresses

    if (ctx.options.block_type == "allowlist" and not has_match) or (
        ctx.options.block_type == "blocklist" and has_match
    ):
        meta = _log_block_and_get_meta(url_domain)
        html = build_block_html(
            site=url_domain,
            penalty=meta.get("penalty", 10),
            member_name=meta.get("member_name", ""),
            weekly_net=meta.get("weekly_net", 0),
            rank=meta.get("rank", 0),
            total_members=meta.get("total_members", 0),
            fellowship_tax=meta.get("fellowship_tax", 3),
        )
        flow.response = http.Response.make(200, html.encode("utf-8"), {"Content-Type": "text/html; charset=utf-8"})
