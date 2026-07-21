"""Dev harness — run the blocker proxy without the Qt GUI.

Iterate on blocklist.json / rules fast:
    python scripts/dev_proxy.py            # use your saved config
    python scripts/dev_proxy.py --hard     # force lockdown mode
    python scripts/dev_proxy.py --no-proxy # start engine but don't touch system proxy

Ctrl-C stops the engine and restores the system proxy.
"""

import argparse
import sys
import time
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from fellowship_focus.blocker.manager import (  # noqa: E402
    force_release_blocker,
    is_mitmdump_running,
    proxy_engine_available,
    set_system_proxy,
    start_mitmdump,
)
from fellowship_focus.config import load_config  # noqa: E402
from fellowship_focus.constants import DEFAULT_REDIRECTS, PROXY_PORT, effective_block_lists  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Fellowship Focus blocker proxy without Qt.")
    parser.add_argument("--hard", action="store_true", help="Force hard (lockdown) mode.")
    parser.add_argument("--soft", action="store_true", help="Force soft (path-only) mode.")
    parser.add_argument("--no-proxy", action="store_true", help="Don't set the Windows system proxy.")
    args = parser.parse_args()

    if not proxy_engine_available():
        print("ERROR: no proxy engine available (embedded mitmproxy not importable).", file=sys.stderr)
        return 1

    config = load_config()
    if args.hard:
        config["blocker_mode"] = "hard"
    elif args.soft:
        config["blocker_mode"] = "soft"

    sites, path_rules = effective_block_lists(config)
    redirects = config.get("block_redirects", DEFAULT_REDIRECTS)

    print(f"Mode: {config.get('blocker_mode', 'soft')}")
    print(f"Full-block domains ({len(sites)}): {', '.join(sites) or '(none)'}")
    print(f"Path rules: {path_rules}")

    proc = start_mitmdump(
        sites,
        config.get("api_url", ""),
        config.get("member_token", ""),
        path_rules=path_rules,
        redirects=redirects,
        dashboard_url="",
    )
    if not proc:
        print("ERROR: proxy failed to start.", file=sys.stderr)
        return 1

    if not args.no_proxy:
        set_system_proxy(True)
        print("System proxy set to 127.0.0.1:%d" % PROXY_PORT)

    for _ in range(20):
        if is_mitmdump_running():
            break
        time.sleep(0.25)
    print("Proxy running." if is_mitmdump_running() else "WARNING: proxy not answering yet.")
    print(f"Listening on 127.0.0.1:{PROXY_PORT}. Press Ctrl-C to stop.")

    try:
        while proc.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping…")
    finally:
        force_release_blocker()
        print("Engine stopped, system proxy restored.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
