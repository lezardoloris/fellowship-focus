"""Heritage dark theme — Public Sans UI, Cinzel logo only (Open Design tokens)."""

from pathlib import Path

from PySide6.QtGui import QFont, QFontDatabase

ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"

APP_ICON_CANDIDATES = (
    "fellowship.ico",
    "app-icon.png",
    "shield-logo.png",
    "fellowship.jpg",
)


def resolve_app_icon_path() -> Path | None:
    for name in APP_ICON_CANDIDATES:
        path = ASSETS_DIR / name
        if path.exists():
            return path
    return None

# Heritage semantic tokens (system/tokens.dark.json)
BG = "#1a1c1e"
BG_SURFACE = "#242628"
BG_ELEVATED = "#2e3134"
FG = "#f4f4f5"
MUTED = "#9ca3af"
BORDER = "#3a3d40"
ACCENT = "#b8422e"
ACCENT_HOVER = "#c46551"
ACCENT_ACTIVE = "#912a1d"
SUCCESS = "#2d6a4f"
WARNING = "#ca8a04"
EMBER = "#c45c26"
RED = "#9b2226"

# Back-compat aliases used by a few modules
GOLD = ACCENT
GOLD_LIGHT = ACCENT_HOVER
GOLD_DIM = ACCENT_ACTIVE
GREEN = SUCCESS
GLASS = BG_SURFACE
GLASS_BORDER = BORDER

_font_display = "Cinzel"
_font_sans = "Segoe UI"
_fonts_loaded = False


def load_fonts() -> None:
    global _fonts_loaded, _font_display, _font_sans
    if _fonts_loaded:
        return
    _fonts_loaded = True
    mapping = {
        "Cinzel-Regular.ttf": "display",
        "Cinzel-Bold.ttf": "display_bold",
        "DMSans-Variable.ttf": "sans",
        "PublicSans-Variable.ttf": "sans",
    }
    loaded: dict[str, str] = {}
    for fname, role in mapping.items():
        path = FONTS_DIR / fname
        if path.exists():
            fid = QFontDatabase.addApplicationFont(str(path))
            if fid >= 0:
                families = QFontDatabase.applicationFontFamilies(fid)
                if families:
                    loaded[role] = families[0]
    if "display" in loaded:
        _font_display = loaded["display"]
    if "sans" in loaded:
        _font_sans = loaded["sans"]


def font_display(size: int = 11, bold: bool = False) -> QFont:
    """Cinzel — logo wordmark only."""
    load_fonts()
    f = QFont(_font_display, size)
    f.setBold(bold)
    f.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, 2)
    return f


def font_sans(size: int = 14, weight: int = QFont.Weight.Normal) -> QFont:
    """Public Sans / DM Sans / Segoe UI for all UI."""
    load_fonts()
    f = QFont(_font_sans, size)
    f.setWeight(weight)
    return f


def font_timer(size: int = 48) -> QFont:
    load_fonts()
    f = QFont(_font_sans, size)
    f.setWeight(QFont.Weight.DemiBold)
    return f


def app_stylesheet() -> str:
    return f"""
QMainWindow, QDialog {{
    background: {BG};
    color: {FG};
}}
QWidget#contentArea, QWidget#pageContent {{
    background: {BG};
    color: {FG};
}}
QScrollArea#pageScroll {{
    background: transparent;
    border: none;
}}
QScrollBar:vertical {{
    background: transparent;
    width: 8px;
    margin: 4px 2px;
}}
QScrollBar::handle:vertical {{
    background: {BORDER};
    border-radius: 4px;
    min-height: 32px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}
QWidget#sidebarPanel {{
    background: {BG};
    border-right: 1px solid {BORDER};
}}
QWidget#brandWrap {{
    border-bottom: 1px solid {BORDER};
}}
QLabel#brandTitle {{
    color: {MUTED};
    letter-spacing: 3px;
}}
QLabel#brandSub {{
    color: {MUTED};
    letter-spacing: 3px;
}}
QLabel#sidebarStatus {{
    color: {MUTED};
    padding-top: 8px;
}}
QPushButton#navItem {{
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 0;
    color: {MUTED};
    text-align: left;
    padding: 12px 16px;
}}
QPushButton#navItem:hover {{
    background: {BG_ELEVATED};
    color: {FG};
}}
QPushButton#navItem:checked {{
    background: {BG_ELEVATED};
    color: {FG};
    border-left: 2px solid {ACCENT};
}}
QWidget#topBar {{
    background: {BG};
    border-bottom: 1px solid {BORDER};
}}
QLabel#topBarTitle {{
    color: {FG};
}}
QWidget#glassCard {{
    background: {BG_SURFACE};
    border: 1px solid {BORDER};
    border-radius: 10px;
}}
QWidget#kpiCard {{
    background: {BG_SURFACE};
    border: 1px solid {BORDER};
    border-radius: 10px;
}}
QLabel#pageTitle {{
    color: {FG};
}}
QLabel#kpiValue {{
    color: {FG};
}}
QLabel#kpiLabel {{
    color: {MUTED};
    letter-spacing: 1px;
}}
QLabel#mutedLabel {{
    color: {MUTED};
    font-size: 12px;
}}
QLabel#phaseLabel {{
    color: {MUTED};
    letter-spacing: 2px;
}}
QLabel#statusPill_active {{
    background: rgba(45, 106, 79, 0.25);
    color: #8fd4a8;
    border: 1px solid rgba(45, 106, 79, 0.45);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
}}
QLabel#statusPill_warn {{
    background: rgba(202, 138, 4, 0.15);
    color: #e8c35e;
    border: 1px solid rgba(202, 138, 4, 0.35);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 11px;
}}
QLabel#statusPill_neutral {{
    background: {BG_ELEVATED};
    color: {MUTED};
    border: 1px solid {BORDER};
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 11px;
}}
QWidget#webSetupBar, QWidget#webConnectedBar {{
    background: {BG_SURFACE};
    border-bottom: 1px solid {BORDER};
}}
QWidget#heroBanner {{
    background: {BG_SURFACE};
    border-bottom: 1px solid {BORDER};
}}
QWidget#shieldHeroCard {{
    background: {BG_SURFACE};
    border: 1px solid {BORDER};
    border-radius: 10px;
}}
QPushButton#presetChip {{
    background: {BG_ELEVATED};
    border: 1px solid {BORDER};
    border-radius: 999px;
    padding: 8px 20px;
    color: {MUTED};
    font-size: 13px;
    font-weight: 600;
}}
QPushButton#presetChip:hover {{
    border-color: {MUTED};
    color: {FG};
}}
QPushButton#presetChip:checked {{
    background: rgba(184, 66, 46, 0.18);
    border-color: {ACCENT};
    color: {FG};
}}
QPushButton#linkBtn {{
    background: transparent;
    border: none;
    color: {ACCENT_HOVER};
    padding: 2px 8px;
    font-size: 12px;
    text-decoration: underline;
}}
QPushButton#linkBtn:hover {{
    color: {FG};
}}
QPushButton {{
    background: {BG_ELEVATED};
    border: 1px solid {BORDER};
    color: {FG};
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
}}
QPushButton:hover {{
    background: {BG_SURFACE};
    border-color: {MUTED};
}}
QPushButton:pressed {{
    background: {BG};
}}
QPushButton#primaryBtn, QPushButton#goldBtn {{
    background: {ACCENT};
    color: #ffffff;
    font-weight: 600;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    min-width: 120px;
    max-width: 280px;
}}
QPushButton#primaryBtn:hover, QPushButton#goldBtn:hover {{
    background: {ACCENT_HOVER};
}}
QPushButton#primaryBtn:pressed, QPushButton#goldBtn:pressed {{
    background: {ACCENT_ACTIVE};
}}
QPushButton#ghostBtn {{
    background: transparent;
    border: 1px solid {BORDER};
    color: {FG};
}}
QPushButton#ghostBtn:hover {{
    background: {BG_ELEVATED};
    border-color: {MUTED};
}}
QPushButton#dangerBtn {{
    background: rgba(61, 31, 31, 0.85);
    border: 1px solid rgba(164, 68, 68, 0.5);
    color: #e8a0a0;
}}
QPushButton#iconBtn {{
    min-width: 40px;
    max-width: 40px;
    min-height: 40px;
    max-height: 40px;
    padding: 0;
    border-radius: 6px;
}}
QLineEdit, QSpinBox, QTextEdit, QComboBox {{
    background: {BG_ELEVATED};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 10px 14px;
    color: {FG};
    selection-background-color: rgba(184, 66, 46, 0.35);
}}
QLineEdit:focus, QSpinBox:focus, QTextEdit:focus, QComboBox:focus {{
    border-color: {ACCENT};
}}
QComboBox::drop-down {{
    border: none;
    width: 24px;
}}
QComboBox QAbstractItemView {{
    background: {BG_ELEVATED};
    border: 1px solid {BORDER};
    selection-background-color: rgba(184, 66, 46, 0.2);
    color: {FG};
}}
QListWidget {{
    background: transparent;
    border: none;
    outline: none;
}}
QListWidget#taskList {{
    background: {BG_ELEVATED};
    border: 1px solid {BORDER};
    border-radius: 10px;
    padding: 6px;
}}
QListWidget#taskList::item {{
    padding: 12px 14px;
    border-radius: 6px;
    margin: 2px 4px;
}}
QListWidget#taskList::item:hover {{
    background: {BG_SURFACE};
}}
QListWidget#taskList::item:selected {{
    background: rgba(184, 66, 46, 0.15);
    color: {FG};
}}
QProgressBar {{
    background: {BG_ELEVATED};
    border: none;
    border-radius: 2px;
    height: 4px;
    text-align: center;
    color: transparent;
}}
QProgressBar::chunk {{
    background: {ACCENT};
    border-radius: 2px;
}}
QCheckBox {{
    color: {FG};
    spacing: 10px;
}}
QCheckBox::indicator {{
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid {BORDER};
    background: {BG_ELEVATED};
}}
QCheckBox::indicator:checked {{
    background: {ACCENT};
    border-color: {ACCENT};
}}
QLabel#formSection {{
    color: {MUTED};
    font-size: 10px;
    letter-spacing: 2px;
    padding-top: 8px;
}}
QFormLayout QLabel {{
    color: {MUTED};
    font-size: 12px;
}}
"""
