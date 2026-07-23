#!/usr/bin/env python3
"""Fellowship Focus desktop app — system-wide focus blocker."""

import sys

# The app re-launches itself with --run-proxy to run the mitmproxy engine as a
# child process. mitmproxy ships inside the bundle, so no external mitmdump.exe
# is needed. This must stay ahead of every heavy import: the proxy child has no
# use for Qt, and it must never register the atexit hook below (that would clear
# the system proxy the parent is still relying on).
if len(sys.argv) > 1 and sys.argv[1] == "--run-proxy":
    import os
    from pathlib import Path

    # Under pythonw / windowed PyInstaller, stdout/stderr are None and every
    # error vanishes — which is how the engine died invisibly and left the
    # system proxy pointing at a corpse. Log to a file instead.
    _log_dir = Path.home() / ".fellowship-focus"
    _log_dir.mkdir(parents=True, exist_ok=True)
    _log = open(_log_dir / "proxy.log", "a", buffering=1, encoding="utf-8", errors="replace")
    for _name in ("stdout", "stderr"):
        if getattr(sys, _name, None) is None:
            setattr(sys, _name, _log)
    if getattr(sys, "stdin", None) is None:
        sys.stdin = open(os.devnull, "r", encoding="utf-8")

    import datetime
    import traceback

    print(f"\n=== proxy start {datetime.datetime.now().isoformat()} ===", file=_log)
    try:
        from mitmproxy.tools.main import mitmdump

        code = mitmdump(sys.argv[2:]) or 0
        print(f"=== proxy exit code {code} ===", file=_log)
        sys.exit(code)
    except SystemExit:
        raise
    except BaseException:
        traceback.print_exc(file=_log)
        print("=== proxy CRASHED ===", file=_log)
        sys.exit(1)

# Elevated blocker layers (hosts + firewall). The frozen exe re-runs itself with
# this flag under UAC; it must stay ahead of the Qt import too.
if len(sys.argv) > 1 and sys.argv[1] == "--elevate-blocker":
    from fellowship_focus.blocker.elevate import _main as _elevate_main

    sys.exit(_elevate_main(sys.argv[2:]))

import atexit

from fellowship_focus.blocker.manager import force_release_blocker
from fellowship_focus.ui.main_window import run

atexit.register(force_release_blocker)


def _run_with_crash_log() -> None:
    """pythonw swallows tracebacks; a GUI app that dies must leave a trace."""
    try:
        run(start_minimized="--minimized" in sys.argv)
    except SystemExit:
        raise
    except BaseException:
        import datetime
        import traceback
        from pathlib import Path

        log_dir = Path.home() / ".fellowship-focus"
        log_dir.mkdir(parents=True, exist_ok=True)
        with open(log_dir / "app.log", "a", encoding="utf-8", errors="replace") as f:
            f.write(f"\n=== app crash {datetime.datetime.now().isoformat()} ===\n")
            traceback.print_exc(file=f)
        raise


if __name__ == "__main__":
    _run_with_crash_log()
