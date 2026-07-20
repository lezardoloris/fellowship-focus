"""Periodic focus proofs — Upwork-style, privacy-first."""

from __future__ import annotations

import base64
import io
import sys
from typing import Literal

ProofMode = Literal["off", "signal", "blur", "full"]


def active_window_title() -> str:
    if sys.platform != "win32":
        return "Focus session"
    try:
        import ctypes

        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        length = user32.GetWindowTextLengthW(hwnd) + 1
        buf = ctypes.create_unicode_buffer(length)
        user32.GetWindowTextW(hwnd, buf, length)
        title = buf.value.strip()
        if " - " in title:
            return title.rsplit(" - ", 1)[-1][:120]
        return title[:120] or "Windows"
    except Exception:
        return "Windows"


def capture_screen_jpeg(mode: ProofMode, blur_radius: int = 10) -> str | None:
    if mode in ("off", "signal"):
        return None
    try:
        import mss
        from PIL import Image, ImageFilter

        with mss.mss() as sct:
            monitor = sct.monitors[1]
            shot = sct.grab(monitor)
            img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

        max_w = 640 if mode == "full" else 320
        ratio = max_w / img.width
        img = img.resize((max_w, max(1, int(img.height * ratio))))
        if mode == "blur":
            img = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=55 if mode == "blur" else 70)
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return None


def capture_webcam_jpeg() -> str | None:
    try:
        import cv2
        from PIL import Image, ImageFilter

        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap.isOpened():
            return None
        ok, frame = cap.read()
        cap.release()
        if not ok:
            return None

        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(frame)
        img = img.resize((160, 120))
        img = img.filter(ImageFilter.GaussianBlur(radius=12))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=50)
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return None
