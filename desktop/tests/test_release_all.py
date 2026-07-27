"""[REL-1..REL-7] The release contract: arming may fail, releasing may not.

Every case here is one that actually stranded a machine, or would have.
"""
from __future__ import annotations

import json
import os

from fellowship_focus.blocker import layers


def _stub(monkeypatch, *, hosts=False, quic=False, admin=False, agent=False):
    monkeypatch.setattr(layers, "_hosts_block_present", lambda: hosts)
    monkeypatch.setattr(layers, "_quic_rule_present", lambda: quic)
    monkeypatch.setattr(layers.elevate, "is_admin", lambda: admin)
    monkeypatch.setattr(layers.elevate, "agent_alive", lambda: agent)


def test_clear_is_a_noop_when_nothing_is_blocked(monkeypatch, tmp_path):
    """No residue must never cost the user a UAC prompt."""
    monkeypatch.setattr(layers, "_JOURNAL_PATH", tmp_path / "armed.json")
    _stub(monkeypatch)
    prompted = []
    monkeypatch.setattr(layers.elevate, "run_elevated", lambda *a: prompted.append(1))
    assert layers.clear_layers() is True
    assert not prompted


def test_fresh_process_still_clears_residue(monkeypatch, tmp_path):
    """The bug: `_applied` is False in every new process, so a block left by a
    run killed from Task Manager took no branch at all and was reported cleared.
    Native apps stayed dead because the hosts layer is machine-wide."""
    monkeypatch.setattr(layers, "_JOURNAL_PATH", tmp_path / "armed.json")
    state = {"hosts": True}
    monkeypatch.setattr(layers, "_hosts_block_present", lambda: state["hosts"])
    monkeypatch.setattr(layers, "_quic_rule_present", lambda: False)
    monkeypatch.setattr(layers.elevate, "is_admin", lambda: False)
    monkeypatch.setattr(layers.elevate, "agent_alive", lambda: False)
    layers._applied = False  # fresh process, exactly as after a relaunch

    def elevate_and_clear(*a, **k):
        state["hosts"] = False
        return True

    monkeypatch.setattr(layers.elevate, "run_elevated", elevate_and_clear)
    monkeypatch.setattr(layers, "_run_frozen_elevated", elevate_and_clear)
    assert layers.clear_layers() is True


def test_failed_clear_reports_failure(monkeypatch, tmp_path):
    """Reporting success while residue remains is what left a machine offline
    with nothing on screen to explain it."""
    monkeypatch.setattr(layers, "_JOURNAL_PATH", tmp_path / "armed.json")
    _stub(monkeypatch, hosts=True)
    monkeypatch.setattr(layers.elevate, "run_elevated", lambda *a: True)
    monkeypatch.setattr(layers, "_run_frozen_elevated", lambda *a: True)
    monkeypatch.setattr(layers.time if hasattr(layers, "time") else os, "name", os.name)
    import time as _t

    monkeypatch.setattr(_t, "sleep", lambda s: None)
    assert layers.clear_layers() is False


def test_journal_survives_the_process_that_wrote_it(monkeypatch, tmp_path):
    """atexit does not run on a kill, so the journal is the only thing left to
    say this machine owes a cleanup."""
    path = tmp_path / "armed.json"
    monkeypatch.setattr(layers, "_JOURNAL_PATH", path)
    layers.journal_open(["hosts", "quic"])
    assert not layers.journal_open_from_previous_run()  # same pid
    data = json.loads(path.read_text(encoding="utf-8"))
    data["pid"] = os.getpid() + 99999
    path.write_text(json.dumps(data), encoding="utf-8")
    assert layers.journal_open_from_previous_run()
    layers.journal_close()
    assert not layers.journal_open_from_previous_run()


def test_apply_with_no_domains_opens_no_journal(monkeypatch, tmp_path):
    """A journal nothing will ever close is a cleanup that never ends."""
    path = tmp_path / "armed.json"
    monkeypatch.setattr(layers, "_JOURNAL_PATH", path)
    layers.apply_layers([])
    assert not path.exists()
