"""Embedded web dashboard — exact parity with localhost:3000 / Railway."""

from __future__ import annotations

import json

from PySide6.QtCore import QTimer, QUrl
from PySide6.QtWidgets import QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.ui.theme import font_display, font_sans

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

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._setup = QWidget()
        self._setup.setObjectName("webSetupBar")
        setup_layout = QVBoxLayout(self._setup)
        setup_layout.setContentsMargins(16, 12, 16, 12)

        self._title = QLabel("Connect your Fellowship")
        self._title.setFont(font_display(14, bold=True))
        self._title.setStyleSheet("color: #d4af37;")
        setup_layout.addWidget(self._title)

        self._hint = QLabel(
            "Paste your invite link from the browser (e.g. http://localhost:3000/f/greer-…)\n"
            "or use “Copy for desktop app” on the web dashboard."
        )
        self._hint.setWordWrap(True)
        self._hint.setFont(font_sans(11))
        self._hint.setStyleSheet("color: #888; margin-bottom: 6px;")
        setup_layout.addWidget(self._hint)

        row = QHBoxLayout()
        self._invite_input = QLineEdit()
        self._invite_input.setPlaceholderText("http://localhost:3000/f/your-fellowship-code")
        self._invite_input.returnPressed.connect(self._connect_from_input)
        row.addWidget(self._invite_input, 1)

        self._connect_btn = QPushButton("Connect")
        self._connect_btn.setObjectName("goldBtn")
        self._connect_btn.clicked.connect(self._connect_from_input)
        row.addWidget(self._connect_btn)

        self._open_btn = QPushButton("Open in browser")
        self._open_btn.clicked.connect(self._on_open_external)
        row.addWidget(self._open_btn)
        setup_layout.addLayout(row)

        self._status = QLabel("")
        self._status.setFont(font_sans(11))
        self._status.setStyleSheet("color: #6a8f6a; padding-top: 4px;")
        setup_layout.addWidget(self._status)
        layout.addWidget(self._setup)

        if not HAS_WEBENGINE:
            fallback = QLabel(
                "Install PySide6-WebEngine for the full dashboard:\n"
                "pip install PySide6-Addons\n\n"
                "Then restart the app — same UI as localhost:3000."
            )
            fallback.setWordWrap(True)
            fallback.setFont(font_sans(13))
            fallback.setStyleSheet("color: #888; padding: 24px;")
            layout.addWidget(fallback)
            self._view = None
            return

        self._view = QWebEngineView()
        profile = QWebEngineProfile.defaultProfile()
        profile.setHttpUserAgent(profile.httpUserAgent() + " FellowshipFocusDesktop/1.1")
        self._view.loadFinished.connect(self._on_load_finished)
        layout.addWidget(self._view, 1)

        self._pull_timer = QTimer(self)
        self._pull_timer.timeout.connect(self._pull_credentials_from_web)

    def reload_dashboard(self) -> None:
        cfg = self._get_config()
        code = cfg.get("fellowship_code", "").strip()
        api = cfg.get("api_url", "http://localhost:3000").rstrip("/")

        if code:
            invite = f"{api}/f/{code}"
            self._invite_input.setText(invite)
            self._status.setText(f"Connected · {code}")
            self._set_setup_compact(True)
        else:
            self._status.setText("Not connected — paste your invite link above.")
            self._set_setup_compact(False)

        if not self._view:
            return

        if code:
            self._injected = False
            url = f"{api}/f/{code}"
            if self._view.url().toString().rstrip("/") != url:
                self._view.setUrl(QUrl(url))
            else:
                self._on_load_finished(True)
            if not self._pull_timer.isActive():
                self._pull_timer.start(4000)
        else:
            self._pull_timer.stop()
            self._view.setHtml(
                """<html><body style="background:#060806;color:#666;font-family:Georgia;
                padding:60px;text-align:center">
                <p>Paste your invite link above to load the same dashboard as in your browser.</p>
                </body></html>"""
            )

    def _set_setup_compact(self, compact: bool) -> None:
        self._title.setVisible(not compact)
        self._hint.setVisible(not compact)
        self._connect_btn.setVisible(not compact)
        self._open_btn.setVisible(not compact)
        self._invite_input.setReadOnly(compact)

    def _connect_from_input(self) -> None:
        parsed = parse_invite_or_sync(self._invite_input.text())
        if not parsed:
            self._status.setStyleSheet("color: #c45c26; padding-top: 4px;")
            self._status.setText("Invalid link. Use http://localhost:3000/f/your-code or desktop sync JSON.")
            return
        cfg = self._get_config()
        if apply_parsed_config(cfg, parsed):
            self._on_config_updated(cfg)
        self._status.setStyleSheet("color: #6a8f6a; padding-top: 4px;")
        self.reload_dashboard()

    def _on_load_finished(self, ok: bool) -> None:
        if not ok or not self._view:
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
            self._status.setText(f"Synced · {cfg.get('member_name') or name} · {cfg.get('fellowship_code', '')}")

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
