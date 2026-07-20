APPLICATION_NAME = "FellowshipFocus"

MITMDUMP_SHUTDOWN_URL = "http://shutdown.fellowshipfocus.internal/"
MITMDUMP_CHECK_URL = "http://check.fellowshipfocus.internal/"

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
