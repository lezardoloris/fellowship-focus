#!/usr/bin/env python3
"""Fellowship Focus desktop app — Koncentro-style system-wide blocker."""

import sys

# The app re-launches itself with --run-proxy to run the mitmproxy engine as a
# child process. mitmproxy ships inside the bundle, so no external mitmdump.exe
# is needed. This must stay ahead of every heavy import: the proxy child has no
# use for Qt, and it must never register the atexit hook below (that would clear
# the system proxy the parent is still relying on).
if len(sys.argv) > 1 and sys.argv[1] == "--run-proxy":
    import os

    # A windowed PyInstaller build (console=False) has sys.stdout/stderr/stdin
    # set to None. mitmproxy's termlog addon calls sys.stdout.isatty() and dies
    # with "NoneType has no attribute 'isatty'", so give it real null streams.
    # This only bites in the frozen app; from source these are already real.
    for _name, _mode in (("stdout", "w"), ("stderr", "w"), ("stdin", "r")):
        if getattr(sys, _name, None) is None:
            setattr(sys, _name, open(os.devnull, _mode, encoding="utf-8"))

    from mitmproxy.tools.main import mitmdump

    sys.exit(mitmdump(sys.argv[2:]) or 0)

import atexit

from fellowship_focus.blocker.manager import force_release_blocker
from fellowship_focus.ui.main_window import run

atexit.register(force_release_blocker)

if __name__ == "__main__":
    run(start_minimized="--minimized" in sys.argv)
