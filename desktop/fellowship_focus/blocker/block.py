"""Block URLs — domain + path rules (Curbox-style Shorts/Reels)."""

import base64
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from mitmproxy import ctx, http

from block_page import build_block_html
from constants import (
    ADULT_REDDIT_SUBS,
    ADULT_SEARCH_TERMS,
    ADULT_SITES,
    DOMAIN_ALIASES,
    DOPAMINE_SITES,
    MITMDUMP_CHECK_URL,
    MITMDUMP_SHUTDOWN_URL,
)

_FF_DIR = Path.home() / ".fellowship-focus"
_PENDING_ADDS = _FF_DIR / "pending_block_adds.json"
_DOPAMINE_PROMPT = _FF_DIR / "dopamine_prompt.json"


def load(loader) -> None:
    loader.add_option("addresses_str", str, "", "Comma-separated full-block domains.")
    loader.add_option("path_rules_b64", str, "", "Base64 JSON path rules.")
    loader.add_option("redirects_b64", str, "", "Base64 JSON redirects.")
    loader.add_option("block_type", str, "blocklist", "Allowlist or blocklist.")
    loader.add_option(
        "allowlist_str",
        str,
        "github.com,githubusercontent.com",
        "Comma-separated domains that never block (even if on the blocklist).",
    )
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
    nsfw = (
        "pornhub",
        "xvideos",
        "xhamster",
        "xnxx",
        "redtube",
        "onlyfans",
        "chaturbate",
        "youporn",
        "spankbang",
        "nhentai",
        "rule34",
    )
    social = ("twitter", "x.com", "reddit", "instagram", "facebook", "tiktok", "threads")
    s = site.lower()
    if any(n in s for n in nsfw) or s.endswith(".xxx"):
        return "nsfw"
    if any(n in s for n in social):
        return "social"
    return "default"


def _normalize_site(raw: str) -> str:
    s = (raw or "").strip().lower()
    if "://" in s:
        s = s.split("://", 1)[1]
    if s.startswith("www."):
        s = s[4:]
    return s.split("/", 1)[0].strip()[:120]


def _match_dopamine(host: str) -> str | None:
    h = _strip_www((host or "").lower())
    if not h:
        return None
    for d in DOPAMINE_SITES:
        if h == d or h.endswith("." + d):
            return d
    for base, aliases in DOMAIN_ALIASES.items():
        if base not in DOPAMINE_SITES:
            continue
        for a in aliases:
            if h == a or h.endswith("." + a):
                return base
    return None


def _match_adult_domain(host: str) -> str | None:
    h = _strip_www((host or "").lower())
    if not h:
        return None
    if h == "xxx" or h.endswith(".xxx"):
        return h if h.endswith(".xxx") else "xxx"
    for d in ADULT_SITES:
        if h == d or h.endswith("." + d):
            return d
    return None


def _is_google_host(host: str) -> bool:
    h = _strip_www((host or "").lower())
    return h == "google.com" or h.startswith("google.") or ".google." in h


def _adult_search_hit(url: str, host: str, path: str, query: str) -> str | None:
    """Return snooze key for adult search SERPs, else None."""
    h = _strip_www((host or "").lower())
    path_l = (path or "/").lower()
    qs = urllib.parse.parse_qs(query or "", keep_blank_values=False)
    q = ""
    if _is_google_host(h) and (path_l == "/search" or path_l.startswith("/search")):
        q = (qs.get("q") or [""])[0]
    elif (h == "bing.com" or h.endswith(".bing.com")) and path_l.startswith("/search"):
        q = (qs.get("q") or [""])[0]
    elif h == "duckduckgo.com":
        q = (qs.get("q") or [""])[0]
    else:
        return None
    tokens = [t for t in re.split(r"[^a-z0-9]+", (q or "").lower()) if t]
    if not any(t in ADULT_SEARCH_TERMS for t in tokens):
        return None
    if _is_google_host(h):
        return "google-search"
    parts = h.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else h


def _adult_reddit_hit(host: str, path: str) -> bool:
    h = _strip_www((host or "").lower())
    if h != "reddit.com" and not h.endswith(".reddit.com") and h != "redd.it":
        return False
    m = re.match(r"^/r/([a-z0-9_]+)", (path or "").lower())
    return bool(m and m.group(1) in ADULT_REDDIT_SUBS)


def _match_adult(url: str, host: str, path: str, query: str) -> tuple[str, str] | None:
    """Return (domain_key, kind) for adult nudge, or None."""
    apex = _match_adult_domain(host)
    if apex:
        return apex, "site"
    search_key = _adult_search_hit(url, host, path, query)
    if search_key:
        return search_key, "search"
    if _adult_reddit_hit(host, path):
        return "reddit.com", "reddit"
    return None


def _queue_pending_add(site: str) -> None:
    clean = _normalize_site(site)
    if not clean:
        return
    try:
        _FF_DIR.mkdir(parents=True, exist_ok=True)
        data: list = []
        if _PENDING_ADDS.exists():
            try:
                raw = json.loads(_PENDING_ADDS.read_text(encoding="utf-8") or "[]")
                if isinstance(raw, list):
                    data = [str(x) for x in raw]
            except Exception:
                data = []
        if clean not in data:
            data.append(clean)
        _PENDING_ADDS.write_text(json.dumps(data), encoding="utf-8")
    except Exception:
        pass


def _queue_dopamine_prompt(domain: str, *, kind: str = "dopamine") -> None:
    """Ask the Qt UI to offer a block/nudge prompt — non-blocking side channel."""
    try:
        now = time.time()
        if _DOPAMINE_PROMPT.exists():
            try:
                old = json.loads(_DOPAMINE_PROMPT.read_text(encoding="utf-8") or "{}")
                if old.get("domain") == domain and now - float(old.get("at") or 0) < 60:
                    return
            except Exception:
                pass
        _FF_DIR.mkdir(parents=True, exist_ok=True)
        _DOPAMINE_PROMPT.write_text(
            json.dumps({"domain": domain, "at": now, "kind": kind}),
            encoding="utf-8",
        )
    except Exception:
        pass


def _is_document_navigation(flow) -> bool:
    """Only top-level HTML navigations — skip images/XHR/subresources."""
    dest = (flow.request.headers.get("Sec-Fetch-Dest") or "").lower()
    if dest and dest != "document":
        return False
    accept = (flow.request.headers.get("Accept") or "").lower()
    if accept and "text/html" not in accept and "*/*" not in accept:
        return False
    return True


def request(flow) -> None:
    if flow.request.pretty_url == MITMDUMP_SHUTDOWN_URL:
        flow.response = http.Response.make(200, b"Shutting down mitmproxy...\n", {"Content-Type": "text/plain"})
        ctx.master.shutdown()
        return

    if flow.request.pretty_url == MITMDUMP_CHECK_URL:
        flow.response = http.Response.make(200, b"Mitmdump is running.\n", {"Content-Type": "text/plain"})
        return

    # Extension (or anything) can queue a blocklist add while the proxy is up.
    parsed_ctrl = urllib.parse.urlparse(flow.request.pretty_url)
    if parsed_ctrl.hostname == "add.fellowshipfocus.internal":
        qs = urllib.parse.parse_qs(parsed_ctrl.query)
        site = (qs.get("site") or [""])[0]
        _queue_pending_add(site)
        flow.response = http.Response.make(
            200,
            b'{"ok":true}\n',
            {"Content-Type": "application/json"},
        )
        return

    addresses = {_strip_www(a.strip()) for a in ctx.options.addresses_str.split(",") if a.strip()}
    allow = {_strip_www(a.strip()) for a in (ctx.options.allowlist_str or "").split(",") if a.strip()}
    path_rules = _decode_json(ctx.options.path_rules_b64, [])
    redirects = _decode_json(ctx.options.redirects_b64, {})

    parsed = urllib.parse.urlparse(flow.request.pretty_url)
    url_domain = _strip_www(parsed.netloc.lower())
    path = parsed.path or "/"

    # Hard skip for productive allowlisted hosts (github, docs, …).
    if any(_domain_matches(url_domain, a) for a in allow):
        return

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
        return

    # Unblocked adult / dopamine navigation during an armed shield → queue prompt.
    if _is_document_navigation(flow):
        adult = _match_adult(flow.request.pretty_url, url_domain, path, parsed.query)
        if adult:
            domain, _kind = adult
            _queue_dopamine_prompt(domain, kind="adult")
            return
        tip = _match_dopamine(url_domain)
        if tip and not any(_domain_matches(url_domain, a) for a in addresses):
            _queue_dopamine_prompt(tip, kind="dopamine")
