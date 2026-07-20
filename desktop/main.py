#!/usr/bin/env python3
"""Fellowship Focus desktop app — Koncentro-style system-wide blocker."""

import sys

from fellowship_focus.ui.main_window import run

if __name__ == "__main__":
    run(start_minimized="--minimized" in sys.argv)
