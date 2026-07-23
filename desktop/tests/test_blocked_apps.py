"""Tests for distraction app process blocking."""

from fellowship_focus.blocker.apps import DEFAULT_BLOCKED_APPS, _norm_proc


def test_norm_strips_exe():
    assert _norm_proc("WhatsApp.Root.exe") == "whatsapp.root"
    assert _norm_proc("WhatsApp") == "whatsapp"


def test_default_includes_store_whatsapp():
    norms = {_norm_proc(n) for n in DEFAULT_BLOCKED_APPS}
    assert "whatsapp.root" in norms
    assert "whatsapp" in norms
