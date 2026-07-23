APPLICATION_NAME = "FellowshipFocus"

MITMDUMP_SHUTDOWN_URL = "http://shutdown.fellowshipfocus.internal/"
MITMDUMP_CHECK_URL = "http://check.fellowshipfocus.internal/"
# Extension → desktop: add a site to the system blocklist while the proxy is up.
MITMDUMP_ADD_SITE_URL = "http://add.fellowshipfocus.internal/"

# Social / video / news (+ history distractors). Kept in sync with
# extension/history.js DOPAMINE_SITES for "Block this site?" prompts.
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
        "lemonde.fr",
        "threads.net",
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
