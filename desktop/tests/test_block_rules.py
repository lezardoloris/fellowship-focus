"""Tests for the pure block-decision logic — no proxy, no network, no Qt.

Run: pytest desktop/tests
"""

import importlib.util
import sys
from pathlib import Path

import pytest

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from fellowship_focus.constants import HARD_HOSTS_OPTIONAL, effective_block_lists


def _load_block_module():
    """Load blocker/block.py by path (it's a mitmproxy script, not a package module)."""
    block_path = DESKTOP / "fellowship_focus" / "blocker" / "block.py"
    spec = importlib.util.spec_from_file_location("ff_block_under_test", block_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


block = _load_block_module()


# ── Domain matching ─────────────────────────────────────────

def test_strip_www():
    assert block._strip_www("www.reddit.com") == "reddit.com"
    assert block._strip_www("reddit.com") == "reddit.com"


def test_domain_exact_and_subdomain():
    assert block._domain_matches("reddit.com", "reddit.com")
    assert block._domain_matches("old.reddit.com", "reddit.com")
    assert block._domain_matches("reddit.com", "www.reddit.com")


def test_domain_no_false_positive():
    # notreddit.com must NOT match reddit.com
    assert not block._domain_matches("notreddit.com", "reddit.com")
    # a look-alike suffix must NOT match
    assert not block._domain_matches("reddit.com.evil.com", "reddit.com")
    assert not block._domain_matches("example.com", "reddit.com")


# ── Path matching (soft mode: Shorts/Reels) ─────────────────

YT_RULES = [
    {"host": "youtube.com", "paths": ["/shorts", "/feed/trending"]},
    {"host": "m.youtube.com", "paths": ["/shorts"]},
]


def test_youtube_watch_is_allowed_in_soft():
    assert block._path_matches("/watch", YT_RULES, "youtube.com") is None


def test_youtube_shorts_is_blocked():
    assert block._path_matches("/shorts", YT_RULES, "youtube.com") == "/shorts"
    assert block._path_matches("/shorts/abc123", YT_RULES, "youtube.com") == "/shorts"


def test_mobile_youtube_shorts_is_blocked():
    assert block._path_matches("/shorts", YT_RULES, "m.youtube.com") == "/shorts"


def test_shorts_prefix_does_not_overflow():
    # /shortsomething must NOT be treated as /shorts
    assert block._path_matches("/shortsomething", YT_RULES, "youtube.com") is None


def test_shorts_with_query_is_blocked():
    assert block._path_matches("/shorts?feature=x", YT_RULES, "youtube.com") == "/shorts"


def test_path_rule_ignored_for_other_hosts():
    assert block._path_matches("/shorts", YT_RULES, "vimeo.com") is None


# ── Category routing ────────────────────────────────────────

@pytest.mark.parametrize(
    "site,expected",
    [
        ("pornhub.com", "nsfw"),
        ("onlyfans.com", "nsfw"),
        ("twitter.com", "social"),
        ("x.com", "social"),
        ("reddit.com", "social"),
        ("instagram.com", "social"),
        ("news.ycombinator.com", "default"),
        ("example.com", "default"),
    ],
)
def test_category_for(site, expected):
    assert block._category_for(site) == expected


# ── Soft / hard mode toggle ─────────────────────────────────

def test_soft_mode_keeps_explicit_optional_hosts():
    """Feeds-only must not strip YouTube if the user put it on the list."""
    if not HARD_HOSTS_OPTIONAL:
        pytest.skip("no hard_hosts_optional configured")
    host = HARD_HOSTS_OPTIONAL[0]
    config = {"blocked_sites": ["reddit.com", host], "blocker_mode": "soft"}
    sites, _ = effective_block_lists(config)
    assert host in sites or any(host.endswith(s) or s.endswith(host) for s in sites)
    # Alias expansion may canonicalize — youtube.com stays when listed.
    from fellowship_focus.constants import canonical_host, expand_domains

    expanded = set()
    for s in sites:
        expanded.add(canonical_host(s))
    assert canonical_host(host) in expanded
    assert "reddit.com" in sites


def test_soft_mode_does_not_auto_add_optional_hosts():
    if not HARD_HOSTS_OPTIONAL:
        pytest.skip("no hard_hosts_optional configured")
    host = HARD_HOSTS_OPTIONAL[0]
    config = {"blocked_sites": ["reddit.com"], "blocker_mode": "soft"}
    sites, _ = effective_block_lists(config)
    from fellowship_focus.constants import canonical_host

    assert canonical_host(host) not in {canonical_host(s) for s in sites}
    assert "reddit.com" in sites


def test_hard_mode_adds_optional_hard_hosts():
    if not HARD_HOSTS_OPTIONAL:
        pytest.skip("no hard_hosts_optional configured")
    host = HARD_HOSTS_OPTIONAL[0]
    config = {"blocked_sites": ["reddit.com"], "blocker_mode": "hard"}
    sites, _ = effective_block_lists(config)
    from fellowship_focus.constants import canonical_host

    assert canonical_host(host) in {canonical_host(s) for s in sites}


def test_hard_mode_no_duplicate():
    if not HARD_HOSTS_OPTIONAL:
        pytest.skip("no hard_hosts_optional configured")
    host = HARD_HOSTS_OPTIONAL[0]
    config = {"blocked_sites": ["reddit.com", host, host], "blocker_mode": "hard"}
    sites, _ = effective_block_lists(config)
    from collections import Counter

    # Each expanded form appears once (aliases are separate hosts by design).
    assert max(Counter(sites).values()) == 1
    from fellowship_focus.constants import canonical_host

    assert canonical_host(host) in {canonical_host(s) for s in sites}
