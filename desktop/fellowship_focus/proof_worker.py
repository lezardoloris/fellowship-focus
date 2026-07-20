"""Background proof uploads during Pomodoro work phases."""

from __future__ import annotations

from typing import Callable

from PySide6.QtCore import QObject, QTimer, Signal

from fellowship_focus.api_client import FellowshipApi
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
        self._timer.timeout.connect(self._tick)
        self._webcam_done = False

    def start(self, session_id: str) -> None:
        cfg = self._get_config()
        mode = cfg.get("proof_mode", "signal")
        if mode == "off":
            return
        self._session_id = session_id
        self._webcam_done = False
        interval_ms = int(cfg.get("proof_interval_min", 10)) * 60_000
        self._timer.start(max(interval_ms, 60_000))
        self._tick()

    def stop(self) -> None:
        self._timer.stop()
        self._session_id = None
        self._webcam_done = False

    def _tick(self) -> None:
        if not self._session_id:
            return
        cfg = self._get_config()
        api_url = cfg.get("api_url", "")
        token = cfg.get("member_token", "")
        if not api_url or not token:
            return

        mode = cfg.get("proof_mode", "signal")
        api = FellowshipApi(api_url, token)
        app = active_window_title()
        activity_score = 0
        activity_label = ""
        if self._get_activity:
            tracker = self._get_activity()
            activity_score = tracker.snapshot()
            activity_label = tracker.activity_label()
            if activity_label != "idle":
                app = f"{app} · mouse:{activity_label}"

        if mode == "signal":
            ok = api.upload_proof(
                self._session_id, "signal", "signal", app, None, activity_score
            )
        else:
            img = capture_screen_jpeg(mode)
            ok = api.upload_proof(
                self._session_id, "screen", mode, app, img, activity_score
            )

        if ok:
            self.proof_sent.emit(app)
        else:
            self.proof_failed.emit("proof upload failed")

        if cfg.get("proof_webcam") and not self._webcam_done:
            cam = capture_webcam_jpeg()
            if cam:
                api.upload_proof(self._session_id, "webcam", "blur", "presence", cam)
            self._webcam_done = True
