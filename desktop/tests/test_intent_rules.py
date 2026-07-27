"""[TRK-7] Same domain, opposite intent. That is the whole test suite."""

from __future__ import annotations

import pytest

from fellowship_focus.intent_rules import (
    classify_url,
    classify_window_title,
    is_countable,
)


@pytest.mark.parametrize(
    "url,category",
    [
        # The pair that domain-level rules cannot both get right.
        ("https://x.com/messages/1234", "work"),
        ("https://x.com/home", "distraction"),
        ("https://www.instagram.com/direct/inbox/", "work"),
        ("https://www.instagram.com/reels/", "distraction"),
        ("https://www.facebook.com/messages/t/42", "work"),
        ("https://www.facebook.com/watch", "distraction"),
        ("https://www.linkedin.com/messaging/thread", "work"),
        ("https://www.linkedin.com/feed/", "distraction"),
    ],
)
def test_path_decides_not_domain(url, category):
    assert classify_url(url)[0] == category


@pytest.mark.parametrize(
    "url",
    [
        "https://ads.google.com/aw/campaigns",
        "https://business.facebook.com/adsmanager/manage",
        "https://ads.tiktok.com/i18n/dashboard",
        "https://analytics.google.com/analytics/web/",
        "https://admin.shopify.com/store/x/orders",
    ],
)
def test_ad_platforms_are_work(url):
    """A PPC consultant earns a living here. Filing it as social would be absurd."""
    assert classify_url(url)[0] == "work"


def test_messaging_is_work_even_on_a_social_domain():
    """Freelance work is sold and delivered in DMs. Calling that distraction is
    how a tracker loses the trust of the person it measures."""
    for url in (
        "https://www.messenger.com/t/42",
        "https://www.facebook.com/messages/t/42",
        "https://www.instagram.com/direct/t/9",
        "https://www.linkedin.com/messaging/",
    ):
        assert classify_url(url)[0] == "work", url


def test_ambiguous_sites_refuse_to_guess():
    """Uncertain must be an answer. These go to the categorisation queue instead
    of being filed wrongly and silently."""
    for url in (
        "https://www.youtube.com/watch?v=abc",
        "https://x.com/someone",
        "https://discord.com/channels/1/2",
        "https://web.whatsapp.com/",
    ):
        assert classify_url(url)[0] is None, url


def test_query_string_is_never_read():
    """Query strings carry session ids and tokens. The safest place to drop
    sensitive data is before it is ever held."""
    cat, label = classify_url("https://x.com/home?session=SECRET&token=abc")
    assert cat == "distraction"
    assert "SECRET" not in label


def test_background_audio_is_not_screen_time():
    """A playlist behind an editor is not attention and must not be billed as
    anything, in either direction."""
    assert is_countable(active=False, audible=True) is False
    assert is_countable(active=False, audible=False) is False
    assert is_countable(active=True, audible=True) is True


def test_subdomains_inherit_their_site():
    assert classify_url("https://m.facebook.com/watch")[0] == "distraction"


def test_unknown_site_returns_no_category():
    assert classify_url("https://some-random-client-tool.dev/x")[0] is None


def test_window_title_fallback_recognises_a_label():
    """Windows Chrome titles carry no URL, so this can only catch labels that
    appear in the page title. It is a fallback, never the primary path."""
    assert classify_window_title("Ads Manager - Google Chrome")[0] == "work"
    assert classify_window_title("")[0] is None
