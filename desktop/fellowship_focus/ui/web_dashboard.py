"""Embedded web dashboard — exact parity with localhost:3000 / Railway."""

from PySide6.QtCore import QUrl
from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget

from fellowship_focus.ui.theme import font_sans

try:
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineProfile

    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


class WebDashboardPage(QWidget):
    def __init__(self, get_config, on_open_external) -> None:
        super().__init__()
        self._get_config = get_config
        self._on_open_external = on_open_external
        self._injected = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        if not HAS_WEBENGINE:
            fallback = QLabel(
                "Install PySide6-WebEngine for the full dashboard:\n"
                "pip install PySide6-WebEngine\n\n"
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
        layout.addWidget(self._view)

    def reload_dashboard(self) -> None:
        if not self._view:
            return
        cfg = self._get_config()
        api = cfg.get("api_url", "http://localhost:3000").rstrip("/")
        code = cfg.get("fellowship_code", "").strip()
        if code:
            self._injected = False
            self._view.setUrl(QUrl(f"{api}/f/{code}"))
        else:
            self._view.setHtml(
                """<html><body style="background:#060806;color:#d4af37;font-family:Georgia;
                padding:40px;text-align:center">
                <h2>Fellowship Focus</h2>
                <p style="color:#888">Set your Fellowship code in Guild Settings,<br>
                then return here for the full web dashboard.</p></body></html>"""
            )

    def _on_load_finished(self, ok: bool) -> None:
        if not ok or not self._view or self._injected:
            return
        cfg = self._get_config()
        code = cfg.get("fellowship_code", "").strip()
        token = cfg.get("member_token", "").strip()
        name = cfg.get("member_name", "").strip().replace("'", "\\'")
        if not code or not token:
            return
        self._injected = True
        js = f"""
        (function() {{
          const key = 'ff-member-{code}';
          const data = JSON.stringify({{ token: '{token}', name: '{name}' }});
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
