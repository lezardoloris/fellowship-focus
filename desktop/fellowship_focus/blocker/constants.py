APPLICATION_NAME = "FellowshipFocus"

MITMDUMP_SHUTDOWN_URL = "http://shutdown.fellowshipfocus.internal/"
MITMDUMP_CHECK_URL = "http://check.fellowshipfocus.internal/"
# Extension → desktop: add a site to the system blocklist while the proxy is up.
MITMDUMP_ADD_SITE_URL = "http://add.fellowshipfocus.internal/"

# Social / video / news / games (+ cousins). Sync with extension/history.js
# DOPAMINE_SITES for soft "Back to work?" prompts during an armed shield.
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
        "hulu.com",
        "max.com",
        "crunchyroll.com",
        "lemonde.fr",
        "threads.net",
        "aliexpress.com",
        "roblox.com",
        "steampowered.com",
        "epicgames.com",
    }
)

# Adult / porn — "Back to work?" prompts. Sync with extension/history.js + package constants.
ADULT_SITES = frozenset(
    {
        "pornhub.com",
        "xvideos.com",
        "xhamster.com",
        "xnxx.com",
        "redtube.com",
        "youporn.com",
        "tube8.com",
        "spankbang.com",
        "onlyfans.com",
        "chaturbate.com",
        "stripchat.com",
        "livejasmin.com",
        "bongacams.com",
        "porntube.com",
        "porn.com",
        "xhamster.desi",
        "xhopen.com",
        "nhentai.net",
        "rule34.xxx",
        "gelbooru.com",
        "hanime.tv",
        "brazzers.com",
        "realitykings.com",
        "eporner.com",
        "hqporner.com",
        "tnaflix.com",
        "beeg.com",
        "pornmd.com",
    }
)

ADULT_SEARCH_TERMS = frozenset(
    {
        "porn",
        "porno",
        "xxx",
        "nsfw",
        "hentai",
        "pornhub",
        "xvideos",
        "xhamster",
        "xnxx",
        "onlyfans",
        "chaturbate",
        "redtube",
        "youporn",
        "rule34",
        "brazzers",
        "spankbang",
        "nhentai",
    }
)

ADULT_REDDIT_SUBS = frozenset(
    {
        "porn",
        "nsfw",
        "gonewild",
        "nsfw_gif",
        "realgirls",
        "porninfifteenseconds",
        "rule34",
        "hentai",
        "adultgif",
    }
)

DOMAIN_ALIASES = {
    "youtube.com": ["youtu.be", "youtube-nocookie.com", "m.youtube.com", "music.youtube.com"],
    "twitter.com": ["x.com", "t.co"],
    "x.com": ["twitter.com", "t.co"],
    "facebook.com": ["fb.com", "fb.watch"],
    "instagram.com": ["ig.me"],
    "reddit.com": ["redd.it"],
    "tiktok.com": ["vm.tiktok.com"],
}

BLOCK_HTML_MESSAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Blocked</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:radial-gradient(ellipse,#1a2418,#0c0f0a);color:#e8e4d9;font-family:Georgia,serif;text-align:center;padding:2rem}
h1{color:#c9a227}p{color:#888;max-width:420px;line-height:1.6}
</style></head><body>
<h1>You cannot pass.</h1>
<p>This site is blocked during your focus quest. The Fellowship is counting on you.</p>
</body></html>"""
