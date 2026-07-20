"""Embedded web dashboard — Heritage dark, no raw JSON visible."""

from __future__ import annotations

import json

from PySide6.QtGui import QFont
from PySide6.QtCore import QTimer, QUrl
from PySide6.QtWidgets import QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.ui.theme import ACCENT, BG, BG_SURFACE, BORDER, FG, MUTED, font_sans

try:
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineProfile

    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


class WebDashboardPage(QWidget):
    def __init__(self, get_config, on_open_external, on_config_updated) -> None:
        super().__init__()
        self._get_config = get_config
        self._on_open_external = on_open_external
        self._on_config_updated = on_config_updated
        self._injected = False
        self._auth_pending: tuple[str, str, str, str] | None = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # ── Connect bar (only when not linked) ─────────────────
        self._setup = QWidget()
        self._setup.setObjectName("webSetupBar")
        setup_layout = QHBoxLayout(self._setup)
        setup_layout.setContentsMargins(20, 14, 20, 14)
        setup_layout.setSpacing(12)

        left = QVBoxLayout()
        self._title = QLabel("Connect Fellowship")
        self._title.setFont(font_sans(14, QFont.Weight.DemiBold))
        self._title.setStyleSheet(f"color: {FG};")
        self._hint = QLabel("Paste invite link or “Copy for desktop app” from the web dashboard")
        self._hint.setFont(font_sans(11))
        self._hint.setStyleSheet(f"color: {MUTED};")
        left.addWidget(self._title)
        left.addWidget(self._hint)
        setup_layout.addLayout(left, 1)

        self._invite_input = QLineEdit()
        self._invite_input.setPlaceholderText("https://fellowship-focus-production.up.railway.app/f/your-code")
        self._invite_input.setEchoMode(QLineEdit.EchoMode.Password)
        self._invite_input.returnPressed.connect(self._connect_from_input)
        setup_layout.addWidget(self._invite_input, 3)

        self._connect_btn = QPushButton("Connect")
        self._connect_btn.setObjectName("primaryBtn")
        self._connect_btn.clicked.connect(self._connect_from_input)
        setup_layout.addWidget(self._connect_btn)

        self._status = QLabel("")
        self._status.setFont(font_sans(10))
        self._status.setStyleSheet(f"color: {MUTED}; padding-left: 8px;")
        setup_layout.addWidget(self._status)

        layout.addWidget(self._setup)

        # ── Connected bar (compact, no secrets) ────────────────
        self._connected_bar = QWidget()
        self._connected_bar.setObjectName("webConnectedBar")
        connected_layout = QHBoxLayout(self._connected_bar)
        connected_layout.setContentsMargins(20, 10, 20, 10)
        connected_layout.setSpacing(12)

        self._connected_label = QLabel("Connected")
        self._connected_label.setFont(font_sans(13, QFont.Weight.DemiBold))
        self._connected_label.setStyleSheet(f"color: {FG};")
        connected_layout.addWidget(self._connected_label)
        connected_layout.addStretch()

        self._open_btn = QPushButton("Open in browser")
        self._open_btn.setObjectName("ghostBtn")
        self._open_btn.clicked.connect(self._on_open_external)
        connected_layout.addWidget(self._open_btn)

        self._refresh_btn = QPushButton("Refresh")
        self._refresh_btn.setObjectName("ghostBtn")
        self._refresh_btn.clicked.connect(self.reload_dashboard)
        connected_layout.addWidget(self._refresh_btn)

        self._connected_bar.setVisible(False)
        layout.addWidget(self._connected_bar)

        if not HAS_WEBENGINE:
            fallback = QLabel(
                "Install PySide6-WebEngine for the full dashboard:\n"
                "pip install PySide6-Addons\n\n"
                "Then restart — same UI as the web app."
            )
            fallback.setWordWrap(True)
            fallback.setFont(font_sans(13))
            fallback.setStyleSheet(f"color: {MUTED}; padding: 40px;")
            layout.addWidget(fallback)
            self._view = None
            return

        self._view = QWebEngineView()
        profile = QWebEngineProfile.defaultProfile()
        profile.setHttpUserAgent(profile.httpUserAgent() + " FellowshipFocusDesktop/1.3.2")
        self._view.loadFinished.connect(self._on_load_finished)
        layout.addWidget(self._view, 1)

        self._pull_timer = QTimer(self)
        self._pull_timer.timeout.connect(self._pull_credentials_from_web)

    def reload_dashboard(self) -> None:
        cfg = self._get_config()
        code = cfg.get("fellowship_code", "").strip()
        token = cfg.get("member_token", "").strip()
        name = cfg.get("member_name", "").strip()
        api = cfg.get("api_url", "https://fellowship-focus-production.up.railway.app").rstrip("/")

        if code:
            self._invite_input.clear()
            label = name if name else code
            self._connected_label.setText(f"Connected · {label}")
            self._setup.setVisible(False)
            self._connected_bar.setVisible(True)
            self._status.setText("")
        else:
            self._setup.setVisible(True)
            self._connected_bar.setVisible(False)
            self._status.setText("Not connected")

        if not self._view:
            return

        if code:
            self._injected = False
            url = f"{api}/f/{code}"
            if token:
                self._load_dashboard_with_auth(url, code, token, name)
            elif self._view.url().toString().rstrip("/") != url:
                self._view.setUrl(QUrl(url))
            else:
                self._on_load_finished(True)
            if not self._pull_timer.isActive():
                self._pull_timer.start(4000)
        else:
            self._pull_timer.stop()
            self._view.setHtml(self._empty_html())

    def _empty_html(self) -> str:
        return f"""<html><head><style>
        body{{background:{BG};color:{MUTED};font-family:system-ui,sans-serif;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}
        .card{{max-width:420px;text-align:center;padding:40px;border:1px solid {BORDER};
        border-radius:10px;background:{BG_SURFACE}}}
        h1{{color:{FG};font-size:14px;font-weight:600;letter-spacing:.08em}}
        p{{line-height:1.6;font-size:14px}}
        .accent{{color:{ACCENT};font-weight:600}}
        </style></head><body><div class="card">
        <h1>Fellowship Focus</h1>
        <p>Paste your invite link above, or use <span class="accent">Copy for desktop app</span> from the web dashboard.</p>
        </div></body></html>"""

    def _load_dashboard_with_auth(self, url: str, code: str, token: str, name: str) -> None:
        """Inject localStorage before navigation so the web app recognizes the member."""
        self._auth_pending = (url, code, token, name)
        self._view.setUrl(QUrl("about:blank"))

    def _connect_from_input(self) -> None:
        raw = self._invite_input.text()
        parsed = parse_invite_or_sync(raw)
        if not parsed:
            self._status.setStyleSheet("color: #c45c26;")
            self._status.setText("Invalid link or sync payload")
            return
        cfg = self._get_config()
        if apply_parsed_config(cfg, parsed):
            self._on_config_updated(cfg)
        self._invite_input.clear()
        self._status.setStyleSheet(f"color: {MUTED};")
        self.reload_dashboard()

    def _on_load_finished(self, ok: bool) -> None:
        if not ok or not self._view:
            return

        if self._auth_pending and self._view.url().toString() in ("about:blank", ""):
            url, code, token, name = self._auth_pending
            self._auth_pending = None
            payload = json.dumps({"token": token, "name": name})
            key = f"ff-member-{code}"
            js = f"localStorage.setItem({json.dumps(key)}, {json.dumps(payload)});"
            self._view.page().runJavaScript(js, lambda _: self._view.setUrl(QUrl(url)))
            return

        self._pull_credentials_from_web()
        self._push_credentials_to_web()

    def _pull_credentials_from_web(self) -> None:
        if not self._view:
            return
        cfg = self._get_config()
        code = cfg.get("fellowship_code", "").strip()
        if not code:
            return
        js = f"localStorage.getItem('ff-member-{code}')"
        self._view.page().runJavaScript(js, self._handle_stored_credentials)

    def _handle_stored_credentials(self, result) -> None:
        if not result or result in ("null", "undefined"):
            return
        try:
            parsed = json.loads(result)
        except (TypeError, json.JSONDecodeError):
            return
        token = str(parsed.get("token", "")).strip()
        name = str(parsed.get("name", "")).strip()
        if not token:
            return
        cfg = self._get_config()
        updates: dict[str, str] = {}
        if token != cfg.get("member_token", ""):
            updates["member_token"] = token
        if name and name != cfg.get("member_name", ""):
            updates["member_name"] = name
        if updates:
            cfg.update(updates)
            self._on_config_updated(cfg)

    def _push_credentials_to_web(self) -> None:
        if not self._view or self._injected:
            return
        cfg = self._get_config()
        code = cfg.get("fellowship_code", "").strip()
        token = cfg.get("member_token", "").strip()
        name = cfg.get("member_name", "").strip()
        if not code or not token:
            return
        self._injected = True
        payload = json.dumps({"token": token, "name": name})
        js = f"""
        (function() {{
          const key = 'ff-member-{code}';
          const data = {json.dumps(payload)};
          if (localStorage.getItem(key) !== data) {{
            localStorage.setItem(key, data);
            if (!sessionStorage.getItem('ff-desktop-reloaded')) {{
              sessionStorage.setItem('ff-desktop-reloaded', '1');
              location.reload();
            }}
          }}
        }})();
        """
        self._view.page().runJavaScript(js)
