"""Embedded web dashboard — Heritage dark, no raw JSON visible."""

from __future__ import annotations

import json

from PySide6.QtGui import QFont
from PySide6.QtCore import QIODevice, QFile, QObject, QTimer, QUrl, Slot
from PySide6.QtWidgets import QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget

from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.ui.theme import ACCENT, BG, BG_SURFACE, BORDER, FG, MUTED, font_sans

try:
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineScript

    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False

try:
    from PySide6.QtWebChannel import QWebChannel

    HAS_WEBCHANNEL = True
except ImportError:
    HAS_WEBCHANNEL = False


# Sets up window.ffdesktop from the Qt WebChannel transport and announces it.
# Retries briefly because qt.webChannelTransport can appear a tick after the
# document is created.
_BRIDGE_INIT_JS = """
(function() {
  if (window.__ffBridgeInit) return;
  window.__ffBridgeInit = true;
  var tries = 0;
  function connect() {
    tries += 1;
    if (typeof QWebChannel === 'undefined' || !window.qt || !qt.webChannelTransport) {
      if (tries < 50) { setTimeout(connect, 100); }
      return;
    }
    try {
      new QWebChannel(qt.webChannelTransport, function(channel) {
        window.ffdesktop = channel.objects.ffdesktop;
        window.dispatchEvent(new Event('ffdesktop-ready'));
      });
    } catch (e) { /* not running inside the desktop app */ }
  }
  connect();
})();
"""


class DesktopBridge(QObject):
    """Exposed to the embedded web app so its Block tab drives the real blocker."""

    def __init__(self, api: dict) -> None:
        super().__init__()
        self._api = api or {}

    def _fallback(self) -> dict:
        return {"shieldOn": False, "active": False, "certReady": False, "sites": []}

    def _call(self, key: str, *args) -> str:
        fn = self._api.get(key)
        try:
            result = fn(*args) if fn else self._fallback()
        except Exception:
            result = self._fallback()
        return json.dumps(result)

    @Slot(result=str)
    def state(self) -> str:
        return self._call("state")

    @Slot(bool, result=str)
    def setShield(self, on: bool) -> str:
        return self._call("set_shield", bool(on))

    @Slot(str, result=str)
    def addSites(self, sites_json: str) -> str:
        try:
            sites = json.loads(sites_json)
        except (TypeError, json.JSONDecodeError):
            sites = []
        if not isinstance(sites, list):
            sites = []
        return self._call("add_sites", [str(s) for s in sites])

    @Slot(str, result=str)
    def removeSite(self, site: str) -> str:
        return self._call("remove_site", str(site))

    @Slot(result=str)
    def weeklyStats(self) -> str:
        return self._call("weekly_stats")

    @Slot(str, result=str)
    def setOkr(self, patch_json: str) -> str:
        try:
            patch = json.loads(patch_json)
        except (TypeError, json.JSONDecodeError):
            patch = {}
        if not isinstance(patch, dict):
            patch = {}
        return self._call("set_okr", patch)

    @Slot(str, result=str)
    def showFloatTimer(self, payload_json: str) -> str:
        try:
            payload = json.loads(payload_json)
        except (TypeError, json.JSONDecodeError):
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        return self._call("show_float_timer", payload)

    @Slot(result=str)
    def hideFloatTimer(self) -> str:
        return self._call("hide_float_timer")

    @Slot(result=str)
    def musicState(self) -> str:
        return self._call("music_state")

    @Slot(str, result=str)
    def musicCmd(self, payload_json: str) -> str:
        try:
            payload = json.loads(payload_json)
        except (TypeError, json.JSONDecodeError):
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        return self._call("music_cmd", payload)


class WebDashboardPage(QWidget):
    def __init__(self, get_config, on_open_external, on_config_updated, blocker_api=None) -> None:
        super().__init__()
        self._get_config = get_config
        self._on_open_external = on_open_external
        self._on_config_updated = on_config_updated
        self._blocker_api = blocker_api
        self._injected = False
        self._bridge = None
        self._channel = None
        self._qwebchannel_js = ""
        self._bridge_ready = False
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
        self._title = QLabel("Guild (optional)")
        self._title.setFont(font_sans(14, QFont.Weight.DemiBold))
        self._title.setStyleSheet(f"color: {FG};")
        self._hint = QLabel("You can block sites & focus right now. Paste an invite link to join a guild.")
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
        self._setup.setVisible(False)  # immersive: guild connect lives in the web UI

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
        from PySide6.QtGui import QColor

        # Match the cinematic scene edge — no solid black panel behind the page
        self._view.page().setBackgroundColor(QColor("#0c0e10"))
        self.setStyleSheet("background: #0c0e10;")
        profile = QWebEngineProfile.defaultProfile()
        profile.setHttpUserAgent(profile.httpUserAgent() + " FellowshipFocusDesktop/1.3.2")
        self._view.loadFinished.connect(self._on_load_finished)
        layout.addWidget(self._view, 1)

        self._setup_bridge()

        self._pull_timer = QTimer(self)
        self._pull_timer.timeout.connect(self._pull_credentials_from_web)

    def resizeEvent(self, event) -> None:  # noqa: N802
        super().resizeEvent(event)
        self._apply_zoom()

    def _apply_zoom(self) -> None:
        """Scale the whole web UI with the window, like a responsive app.

        The web layout was built for a wide immersive window; in a small
        window the cards stayed full-size and overflowed. Zooming the view
        proportionally to its width keeps everything readable and in-frame at
        any size — the real fix for 'les encarts doivent être proportionnels'.
        """
        if not self._view:
            return
        w = self._view.width()
        if w <= 0:
            return
        # Scale the UI with the window in BOTH directions: shrink so a small
        # window doesn't clip, and grow so a large window fills with bigger
        # text instead of a sea of empty background. 1.0 at ~1150px, floor
        # 0.62, ceiling 1.7.
        zoom = max(0.62, min(1.7, w / 1150))
        try:
            if abs(self._view.zoomFactor() - zoom) > 0.01:
                self._view.setZoomFactor(zoom)
        except Exception:
            pass

    def _setup_bridge(self) -> None:
        """Register the desktop blocker bridge over Qt WebChannel.

        The bridge init runs at DocumentCreation via a persistent QWebEngineScript
        so ``window.ffdesktop`` exists before the web app's React code mounts — no
        race with the page's own readiness check.
        """
        if not (HAS_WEBCHANNEL and self._view and self._blocker_api):
            return
        try:
            self._channel = QWebChannel(self._view.page())
            self._bridge = DesktopBridge(self._blocker_api)
            self._channel.registerObject("ffdesktop", self._bridge)
            self._view.page().setWebChannel(self._channel)
            self._qwebchannel_js = self._load_qwebchannel_js()
            if self._qwebchannel_js:
                script = QWebEngineScript()
                script.setName("ffdesktop-bridge")
                script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentCreation)
                script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
                script.setRunsOnSubFrames(False)
                script.setSourceCode(self._qwebchannel_js + _BRIDGE_INIT_JS)
                self._view.page().scripts().insert(script)
        except Exception:
            self._bridge = None

    @staticmethod
    def _load_qwebchannel_js() -> str:
        f = QFile(":/qtwebchannel/qwebchannel.js")
        if not f.open(QIODevice.ReadOnly):
            return ""
        try:
            return bytes(f.readAll()).decode("utf-8", "replace")
        finally:
            f.close()

    def _inject_bridge(self) -> None:
        """Fallback injection on load-finished (the DocumentCreation script is
        primary). Idempotent thanks to the window.__ffBridgeInit guard."""
        if not (self._view and self._bridge and self._qwebchannel_js):
            return
        self._view.page().runJavaScript(self._qwebchannel_js + _BRIDGE_INIT_JS)

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
            self._status.setText("")
        else:
            self._status.setText("Not connected")
        # Immersive: no Qt chrome — guild connect is inside the web app
        self._setup.setVisible(False)
        self._connected_bar.setVisible(False)

        if not self._view:
            return

        base = f"{api}/app"
        if code:
            self._injected = False
            url = f"{base}?code={code}"
            if token:
                self._load_dashboard_with_auth(url, code, token, name)
            elif self._view.url().toString().rstrip("/") != url:
                self._view.setUrl(QUrl(url))
            else:
                self._on_load_finished(True)
            if not self._pull_timer.isActive():
                self._pull_timer.start(4000)
        else:
            # Solo mode — the app is fully usable without a guild
            # (block sites + focus timer + player). A guild is optional.
            self._pull_timer.stop()
            current = self._view.url().toString().rstrip("/")
            if current != base and not current.startswith(base + "?"):
                self._view.setUrl(QUrl(base))

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

        self._inject_bridge()
        self._apply_zoom()
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
