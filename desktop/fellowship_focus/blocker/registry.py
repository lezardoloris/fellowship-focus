"""[REL-1] One declaration per machine-level mutation the blocker performs.

Why this exists. An audit of the arm/release paths found ten mutations applied
from four places and removed from three others. Four of them had no reliable
undo at all: the browser QUIC policy was never restored, the extension's armed
state never expired, the mitm root certificate was never removed, and the hosts
block could survive a kill with the log claiming it had been cleared. Every one
of those came from the same gesture — a layer added to strengthen blocking, its
removal left for later.

So a layer is not a function you call. It is a triple:

    apply(ctx)   put it in place
    release()    take it away
    present()    is it still there, read from the machine, not from our memory

`present()` reading the machine is the load-bearing part. An in-process flag is
False in every fresh process, which is exactly how a block written by a run that
was killed from Task Manager outlived it and stayed invisible.

Adding a mutation here without all three callables fails test_registry.py. That
is the whole point: the check lands in CI rather than on someone's machine.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Mutation:
    """One reversible change to the user's machine."""

    key: str
    label: str
    #: Who feels it if the release fails. "machine" means native apps too:
    #: the hosts layer resolves whatsapp.net for WhatsApp Desktop exactly as it
    #: does for the browser, which is why a stale block reads as a dead laptop
    #: rather than as a focus app misbehaving.
    scope: str
    apply: Callable[[dict], bool]
    release: Callable[[], bool]
    present: Callable[[], bool]


def _hosts_apply(ctx: dict) -> bool:
    from fellowship_focus.blocker.layers import apply_layers

    res = apply_layers(ctx.get("domains") or [])
    return bool(res.get("hosts") or res.get("quic"))


def _hosts_release() -> bool:
    from fellowship_focus.blocker.layers import clear_layers

    return clear_layers()


def _hosts_present() -> bool:
    from fellowship_focus.blocker.layers import residue_present

    return residue_present()


def _quic_apply(ctx: dict) -> bool:
    from fellowship_focus.blocker.manager import disable_browser_quic

    return disable_browser_quic()


def _quic_release() -> bool:
    from fellowship_focus.blocker.manager import restore_browser_quic

    return restore_browser_quic()


def _quic_present() -> bool:
    from fellowship_focus.blocker.manager import quic_residue_present

    return quic_residue_present()


def _proxy_apply(ctx: dict) -> bool:
    from fellowship_focus.blocker.manager import set_system_proxy

    return set_system_proxy(True)


def _proxy_release() -> bool:
    from fellowship_focus.blocker.manager import force_release_blocker

    force_release_blocker()
    return True


def _proxy_present() -> bool:
    """The WinINET proxy switch, read from the registry rather than remembered."""
    if os.name != "nt":
        return False
    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            0,
            winreg.KEY_READ,
        )
        try:
            value, _ = winreg.QueryValueEx(key, "ProxyEnable")
            return bool(value)
        finally:
            winreg.CloseKey(key)
    except OSError:
        return False


#: Declared in the order they are applied. release_all() walks it backwards, so
#: the proxy comes down before the layers that make traffic reach it.
MUTATIONS: tuple[Mutation, ...] = (
    Mutation(
        key="hosts_quic",
        label="Hosts file and firewall",
        scope="machine",
        apply=_hosts_apply,
        release=_hosts_release,
        present=_hosts_present,
    ),
    Mutation(
        key="browser_quic",
        label="Browser QUIC policy",
        scope="browser",
        apply=_quic_apply,
        release=_quic_release,
        present=_quic_present,
    ),
    Mutation(
        key="proxy",
        label="Proxy and engine",
        scope="user",
        apply=_proxy_apply,
        release=_proxy_release,
        present=_proxy_present,
    ),
)


def release_every_mutation() -> dict:
    """Release everything, in reverse order, and verify each one by reading back.

    Returns {"ok", "layers": {key: cleared}, "stuck": [key], "labels": {...}}.
    A mutation counts as cleared only when present() says so afterwards; a
    release that merely returned True is not evidence.
    """
    layers: dict[str, bool] = {}
    for m in reversed(MUTATIONS):
        try:
            m.release()
        except Exception:
            from fellowship_focus.blocker.manager import blocker_log

            blocker_log(f"release {m.key} raised")
        try:
            layers[m.key] = not m.present()
        except Exception:
            layers[m.key] = False
    stuck = [k for k, ok in layers.items() if not ok]
    return {
        "ok": not stuck,
        "layers": layers,
        "stuck": stuck,
        "labels": {m.key: m.label for m in MUTATIONS},
    }


def anything_present() -> bool:
    """Any mutation still live, across every declared layer."""
    for m in MUTATIONS:
        try:
            if m.present():
                return True
        except Exception:
            continue
    return False
