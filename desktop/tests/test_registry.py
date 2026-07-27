"""[REL-1] The guard: a layer cannot ship without its undo.

Four of the blocker's ten machine mutations once had no reliable removal. Every
one arrived the same way, as a layer added to strengthen blocking with its
removal left for later. These tests move that check off the user's machine and
into CI.
"""

from __future__ import annotations

from fellowship_focus.blocker import registry


def test_every_mutation_declares_apply_release_and_present():
    assert registry.MUTATIONS, "the registry must not be empty"
    for m in registry.MUTATIONS:
        assert callable(m.apply), f"{m.key} has no apply"
        assert callable(m.release), f"{m.key} has no release"
        assert callable(m.present), f"{m.key} has no present"
        assert m.label, f"{m.key} has no human label"
        assert m.scope in {"machine", "user", "browser"}, f"{m.key} scope {m.scope!r}"


def test_keys_are_unique():
    keys = [m.key for m in registry.MUTATIONS]
    assert len(keys) == len(set(keys))


def test_machine_scoped_layers_are_declared():
    """The hosts layer is the one that takes down native apps (WhatsApp Desktop
    resolves the same whatsapp.net the browser does), so losing its declaration
    is the most expensive mistake available here."""
    keys = {m.key for m in registry.MUTATIONS}
    assert "hosts_quic" in keys
    assert "browser_quic" in keys
    assert "proxy" in keys
    assert any(m.scope == "machine" for m in registry.MUTATIONS)


def test_release_reports_a_layer_that_will_not_clear(monkeypatch):
    """A release that returns True while present() still says yes must count as
    stuck. Reporting success over live residue is what left a machine with no
    network and nothing on screen to explain it."""
    stubborn = registry.Mutation(
        key="stubborn",
        label="Stubborn layer",
        scope="machine",
        apply=lambda ctx: True,
        release=lambda: True,  # claims success
        present=lambda: True,  # but it is still there
    )
    monkeypatch.setattr(registry, "MUTATIONS", (stubborn,))
    res = registry.release_every_mutation()
    assert res["ok"] is False
    assert res["stuck"] == ["stubborn"]
    assert res["labels"]["stubborn"] == "Stubborn layer"


def test_release_is_clean_when_nothing_is_present(monkeypatch):
    quiet = registry.Mutation(
        key="quiet",
        label="Quiet layer",
        scope="user",
        apply=lambda ctx: True,
        release=lambda: True,
        present=lambda: False,
    )
    monkeypatch.setattr(registry, "MUTATIONS", (quiet,))
    res = registry.release_every_mutation()
    assert res["ok"] is True
    assert res["stuck"] == []


def test_a_raising_release_does_not_stop_the_others(monkeypatch):
    """One layer blowing up must not strand the layers after it — that would
    turn a partial failure into a total one."""
    order: list[str] = []

    def make(key, raises, present):
        def rel():
            order.append(key)
            if raises:
                raise RuntimeError("boom")
            return True

        return registry.Mutation(
            key=key,
            label=key,
            scope="machine",
            apply=lambda ctx: True,
            release=rel,
            present=lambda: present,
        )

    monkeypatch.setattr(
        registry, "MUTATIONS", (make("first", False, False), make("second", True, False))
    )
    res = registry.release_every_mutation()
    assert order == ["second", "first"], "released in reverse order of application"
    assert res["ok"] is True


def test_anything_present_survives_a_raising_probe(monkeypatch):
    """A probe that throws must not be read as 'nothing is blocked'."""
    boom = registry.Mutation(
        key="boom",
        label="boom",
        scope="machine",
        apply=lambda ctx: True,
        release=lambda: True,
        present=lambda: (_ for _ in ()).throw(RuntimeError("no")),
    )
    live = registry.Mutation(
        key="live",
        label="live",
        scope="machine",
        apply=lambda ctx: True,
        release=lambda: True,
        present=lambda: True,
    )
    monkeypatch.setattr(registry, "MUTATIONS", (boom, live))
    assert registry.anything_present() is True
