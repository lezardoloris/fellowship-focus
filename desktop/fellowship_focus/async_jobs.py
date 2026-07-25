"""Off-GUI-thread I/O helpers for Fellowship Focus desktop.

Network / disk work must never block the Qt GUI thread. Call ``run_in_thread``
with a callable; results are delivered on the GUI thread via Qt signals.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from PySide6.QtCore import QObject, Signal

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ff-io")


class _Job(QObject):
    finished = Signal(object)
    failed = Signal(str)


def run_in_thread(
    fn: Callable[[], Any],
    *,
    on_success: Callable[[Any], None] | None = None,
    on_error: Callable[[str], None] | None = None,
    parent: QObject | None = None,
) -> _Job:
    """Run ``fn`` in the shared pool; invoke callbacks on the GUI thread."""
    job = _Job(parent)

    if on_success is not None:
        job.finished.connect(on_success)
    if on_error is not None:
        job.failed.connect(on_error)

    def work() -> None:
        try:
            result = fn()
        except Exception as exc:  # noqa: BLE001 — surface to UI
            job.failed.emit(str(exc) or type(exc).__name__)
            return
        job.finished.emit(result)

    _executor.submit(work)
    return job


def shutdown_workers(wait: bool = False) -> None:
    _executor.shutdown(wait=wait, cancel_futures=True)
