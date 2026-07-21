#!/usr/bin/env python3
"""Fellowship Focus desktop app — Koncentro-style system-wide blocker."""

import sys

# The app re-launches itself with --run-proxy to run the mitmproxy engine as a
# child process. mitmproxy ships inside the bundle, so no external mitmdump.exe
# is needed. This must stay ahead of every heavy import: the proxy child has no
# use for Qt, and it must never register the atexit hook below (that would clear
# the system proxy the parent is still relying on).
if len(sys.argv) > 1 and sys.argv[1] == "--run-proxy":
    from mitmproxy.tools.main import mitmdump

    sys.exit(mitmdump(sys.argv[2:]) or 0)

import atexit

from fellowship_focus.blocker.manager import force_release_blocker
from fellowship_focus.ui.main_window import run

atexit.register(force_release_blocker)

if __name__ == "__main__":
    run(start_minimized="--minimized" in sys.argv)
