"""[TRK-7] What a site is *for*, not just which site it is.

The blocker's original keyword list answers "is this facebook.com". That is the
wrong question for a freelancer. facebook.com/adsmanager is how a PPC consultant
earns a living; facebook.com/ is the feed. instagram.com/direct is a client
conversation; instagram.com/explore is not. The domain is identical, the answer
is opposite, and a domain-level rule has to be wrong about one of them.

So rules match on domain plus the first path segment, and the first match wins,
most specific first.

Three deliberate positions:

* **Background audio is not screen time.** A tab playing music while you work in
  an editor is not attention, so it is not counted at all — not as work, not as
  distraction. Only the seconds you actually spend *in* the player count, and
  those are a handful per track change. The extension knows `tab.audible` and
  whether the tab is active; the desktop knows what is in the foreground.
  Neither should ever bill you for a background playlist.

* **Messaging is work until proven otherwise.** Messenger, Instagram DMs,
  LinkedIn messaging and WhatsApp are where freelance work is actually sold and
  delivered. Filing them as distraction because they sit on a social domain is
  how a tracker loses the trust of the person it is measuring.

* **Uncertain is a first-class answer.** A rule returns `None` rather than
  guessing, and the pattern goes to the categorisation queue to be settled once
  by the person whose context it is. Half of measured time currently lands in
  "neutral"; guessing louder would not fix that.
"""

from __future__ import annotations

from urllib.parse import urlsplit

#: (domain suffix, first path segment or None, category, label)
#: `None` for the path means "any path". Ordered: specific paths first, and the
#: bare-domain fallback last for each site.
RULES: tuple[tuple[str, str | None, str, str], ...] = (
    # ── Paid media: the freelancer's actual workplace ────────────────────
    ("ads.google.com", None, "work", "Google Ads"),
    ("adwords.google.com", None, "work", "Google Ads"),
    ("business.facebook.com", None, "work", "Meta Business"),
    ("adsmanager.facebook.com", None, "work", "Meta Ads Manager"),
    ("business.instagram.com", None, "work", "Instagram Business"),
    ("ads.tiktok.com", None, "work", "TikTok Ads"),
    ("ads.linkedin.com", None, "work", "LinkedIn Ads"),
    ("ads.pinterest.com", None, "work", "Pinterest Ads"),
    ("advertising.amazon.com", None, "work", "Amazon Ads"),
    ("merchants.google.com", None, "work", "Merchant Center"),
    ("analytics.google.com", None, "work", "Analytics"),
    ("search.google.com", None, "work", "Search Console"),
    ("tagmanager.google.com", None, "work", "Tag Manager"),
    ("admin.shopify.com", None, "work", "Shopify admin"),
    ("partners.shopify.com", None, "work", "Shopify Partners"),
    # ── Social: same domain, opposite intent ─────────────────────────────
    ("x.com", "messages", "work", "X · DMs"),
    ("x.com", "compose", "work", "X · posting"),
    ("x.com", "notifications", None, "X · notifications"),
    ("x.com", "home", "distraction", "X · feed"),
    ("x.com", "explore", "distraction", "X · explore"),
    ("x.com", None, None, "X"),
    ("twitter.com", "messages", "work", "X · DMs"),
    ("twitter.com", "home", "distraction", "X · feed"),
    ("twitter.com", None, None, "X"),
    ("instagram.com", "direct", "work", "Instagram · DMs"),
    ("instagram.com", "explore", "distraction", "Instagram · explore"),
    ("instagram.com", "reels", "distraction", "Instagram · reels"),
    ("instagram.com", None, None, "Instagram"),
    ("facebook.com", "adsmanager", "work", "Meta Ads Manager"),
    ("facebook.com", "business", "work", "Meta Business"),
    ("facebook.com", "messages", "work", "Messenger"),
    ("facebook.com", "marketplace", "personal", "Marketplace"),
    ("facebook.com", "watch", "distraction", "Facebook · watch"),
    ("facebook.com", "reel", "distraction", "Facebook · reels"),
    ("facebook.com", None, None, "Facebook"),
    ("messenger.com", None, "work", "Messenger"),
    ("linkedin.com", "messaging", "work", "LinkedIn · messages"),
    ("linkedin.com", "sales", "work", "Sales Navigator"),
    ("linkedin.com", "feed", "distraction", "LinkedIn · feed"),
    ("linkedin.com", None, None, "LinkedIn"),
    ("reddit.com", "r", None, "Reddit · subreddit"),
    ("reddit.com", None, "distraction", "Reddit"),
    ("tiktok.com", None, "distraction", "TikTok"),
    # ── Video: length and section decide, not the domain ─────────────────
    ("youtube.com", "watch", None, "YouTube · video"),
    ("youtube.com", "shorts", "distraction", "YouTube · shorts"),
    ("youtube.com", "feed", "distraction", "YouTube · feed"),
    ("youtube.com", None, None, "YouTube"),
    ("netflix.com", None, "distraction", "Netflix"),
    ("twitch.tv", None, "distraction", "Twitch"),
    # ── Audio: only ever counted when it is the foreground ───────────────
    ("open.spotify.com", None, "neutral", "Spotify"),
    ("music.youtube.com", None, "neutral", "YouTube Music"),
    ("soundcloud.com", None, "neutral", "SoundCloud"),
    # ── Tools ────────────────────────────────────────────────────────────
    ("github.com", None, "work", "GitHub"),
    ("gitlab.com", None, "work", "GitLab"),
    ("docs.google.com", None, "work", "Google Docs"),
    ("sheets.google.com", None, "work", "Google Sheets"),
    ("drive.google.com", None, "work", "Drive"),
    ("calendar.google.com", None, "work", "Calendar"),
    ("mail.google.com", None, "work", "Gmail"),
    ("notion.so", None, "work", "Notion"),
    ("figma.com", None, "work", "Figma"),
    ("slack.com", None, "work", "Slack"),
    ("meet.google.com", None, "work", "Meet"),
    ("zoom.us", None, "work", "Zoom"),
    ("app.hubspot.com", None, "work", "HubSpot"),
    ("stripe.com", None, "work", "Stripe"),
    ("chatgpt.com", None, "work", "ChatGPT"),
    ("claude.ai", None, "work", "Claude"),
    ("stackoverflow.com", None, "work", "Stack Overflow"),
    ("discord.com", None, None, "Discord"),
    ("web.whatsapp.com", None, None, "WhatsApp Web"),
)

#: Categories a rule may return. `None` means "ask, do not guess".
CATEGORIES = ("work", "distraction", "personal", "neutral")


def _host_and_segment(url: str) -> tuple[str, str]:
    """(host without www, first path segment) — never the query string.

    Query strings carry session ids and tokens, so they are dropped here rather
    than anywhere downstream: the safest place to lose sensitive data is before
    it is ever held.
    """
    try:
        parts = urlsplit(url if "//" in url else f"//{url}")
    except ValueError:
        return ("", "")
    host = (parts.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    seg = ""
    path = parts.path or ""
    for chunk in path.split("/"):
        if chunk:
            seg = chunk.lower()
            break
    return (host, seg)


def classify_url(url: str) -> tuple[str | None, str]:
    """(category, label) for a URL. Category is None when the rules will not guess.

    Matching is most-specific-first: a path rule beats the bare-domain rule for
    the same site, which is the entire point of the table.
    """
    host, seg = _host_and_segment(url)
    if not host:
        return (None, "")
    fallback: tuple[str | None, str] | None = None
    for domain, path, category, label in RULES:
        if not (host == domain or host.endswith("." + domain)):
            continue
        if path is None:
            if fallback is None:
                fallback = (category, label)
            continue
        if seg == path:
            return (category, label)
    return fallback if fallback is not None else (None, "")


def is_countable(active: bool, audible: bool) -> bool:
    """Whether a tab's seconds count as screen time at all.

    Answers the background-audio question directly: a playlist running behind an
    editor is not attention and must not be billed as anything. Only the active
    tab counts, audible or not.
    """
    return bool(active)


#: Page-title fragments → (category, label), for the desktop fallback only.
#: Deliberately a separate table rather than fuzzy-matching the rule labels:
#: the label "Meta Ads Manager" never appears in a page title that reads
#: "Ads Manager", and guessing by substring would match far too much.
TITLE_HINTS: tuple[tuple[str, str, str], ...] = (
    ("ads manager", "work", "Meta Ads Manager"),
    ("gestionnaire de publicités", "work", "Meta Ads Manager"),
    ("google ads", "work", "Google Ads"),
    ("merchant center", "work", "Merchant Center"),
    ("search console", "work", "Search Console"),
    ("analytics", "work", "Analytics"),
    ("messenger", "work", "Messenger"),
    ("shopify", "work", "Shopify admin"),
    ("google docs", "work", "Google Docs"),
    ("google sheets", "work", "Google Sheets"),
    ("figma", "work", "Figma"),
    ("notion", "work", "Notion"),
    ("github", "work", "GitHub"),
)


def classify_window_title(title: str) -> tuple[str | None, str]:
    """Best-effort classification from a desktop window title.

    Windows gives Chrome titles as "<page title> - Google Chrome", with no URL
    and no domain, so this can only recognise fragments that happen to appear in
    the page title. It is the fallback for when the extension is not installed;
    the extension's URL is always better and should win when both are available.
    """
    hay = (title or "").lower()
    if not hay:
        return (None, "")
    for fragment, category, label in TITLE_HINTS:
        if fragment in hay:
            return (category, label)
    return (None, "")
