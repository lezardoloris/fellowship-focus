"""Proof uploads during Pomodoro work phases — capture/encode/POST off GUI thread."""

from __future__ import annotations

from typing import Callable

from PySide6.QtCore import QObject, QTimer, Signal

from fellowship_focus.api_client import FellowshipApi
from fellowship_focus.async_jobs import run_in_thread
from fellowship_focus.proof_capture import active_window_title, capture_screen_jpeg, capture_webcam_jpeg


class ProofWorker(QObject):
    proof_sent = Signal(str)
    proof_failed = Signal(str)

    def __init__(self, get_config, get_activity: Callable | None = None) -> None:
        super().__init__()
        self._get_config = get_config
        self._get_activity = get_activity
        self._session_id: str | None = None
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._schedule_tick)
        self._webcam_done = False
        self._busy = False

    def start(self, session_id: str) -> None:
        cfg = self._get_config()
        mode = cfg.get("proof_mode", "signal")
        if mode == "off":
            return
        self._session_id = session_id
        self._webcam_done = False
        interval_ms = int(cfg.get("proof_interval_min", 10)) * 60_000
        self._timer.start(max(interval_ms, 60_000))
        # First proof after a short delay — never block the Start click path.
        QTimer.singleShot(1500, self._schedule_tick)

    def stop(self) -> None:
        self._timer.stop()
        self._session_id = None
        self._webcam_done = False
        self._busy = False

    def _schedule_tick(self) -> None:
        if not self._session_id or self._busy:
            return
        cfg = self._get_config()
        api_url = cfg.get("api_url", "")
        token = cfg.get("member_token", "")
        if not api_url or not token:
            return

        mode = cfg.get("proof_mode", "signal")
        session_id = self._session_id
        want_webcam = bool(cfg.get("proof_webcam")) and not self._webcam_done

        activity_score = 0
        app = active_window_title()
        if self._get_activity:
            tracker = self._get_activity()
            activity_score = tracker.snapshot()
            activity_label = tracker.activity_label()
            if activity_label != "idle":
                app = f"{app} · mouse:{activity_label}"

        self._busy = True

        def work() -> tuple[bool, str, bool]:
            api = FellowshipApi(api_url, token)
            ok = False
            if mode == "signal":
                ok = api.upload_proof(session_id, "signal", "signal", app, None, activity_score)
            else:
                img = capture_screen_jpeg(mode)
                ok = api.upload_proof(session_id, "screen", mode, app, img, activity_score)
            cam_ok = False
            if want_webcam:
                cam = capture_webcam_jpeg()
                if cam:
                    cam_ok = api.upload_proof(session_id, "webcam", "blur", "presence", cam)
            return ok, app, cam_ok or want_webcam

        def on_ok(result: object) -> None:
            self._busy = False
            if not self._session_id:
                return
            ok, app_name, webcam_attempted = result  # type: ignore[misc]
            if webcam_attempted:
                self._webcam_done = True
            if ok:
                self.proof_sent.emit(str(app_name))
            else:
                self.proof_failed.emit("proof upload failed")

        def on_err(_msg: str) -> None:
            self._busy = False
            if self._session_id:
                self.proof_failed.emit("proof upload failed")

        run_in_thread(work, on_success=on_ok, on_error=on_err, parent=self)
