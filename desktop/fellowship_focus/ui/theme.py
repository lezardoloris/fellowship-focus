"""Premium theme — matches web dashboard (Cinzel + DM Sans, glass, gold)."""

from pathlib import Path

from PySide6.QtGui import QFont, QFontDatabase

ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"

# Web parity colors
BG = "#060806"
FG = "#f0ebe0"
GOLD = "#d4af37"
GOLD_LIGHT = "#f0d878"
GOLD_DIM = "#8a7020"
GLASS = "rgba(12, 18, 12, 0.85)"
GLASS_BORDER = "rgba(212, 175, 55, 0.18)"
EMBER = "#c45c26"
GREEN = "#2d6a4f"
RED = "#9b2226"

_font_display = "Georgia"
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
        "DMSans-Regular.ttf": "sans",
        "DMSans-Medium.ttf": "sans_medium",
        "DMSans-Bold.ttf": "sans_bold",
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


def font_display(size: int = 14, bold: bool = False) -> QFont:
    load_fonts()
    f = QFont(_font_display, size)
    f.setBold(bold)
    return f


def font_sans(size: int = 13, weight: int = QFont.Weight.Normal) -> QFont:
    load_fonts()
    f = QFont(_font_sans, size)
    f.setWeight(weight)
    return f


def font_timer(size: int = 56) -> QFont:
    load_fonts()
    f = QFont(_font_display, size)
    f.setBold(True)
    f.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, 2)
    return f


def app_stylesheet() -> str:
    return f"""
QMainWindow {{ background: {BG}; color: {FG}; }}
QWidget#contentArea {{ background: {BG}; color: {FG}; }}
QWidget#sidebarPanel {{
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #0f150f, stop:1 {BG});
    border-right: 1px solid {GLASS_BORDER};
}}
QWidget#glassCard {{
    background: rgba(12, 18, 12, 0.72);
    border: 1px solid {GLASS_BORDER};
    border-radius: 14px;
}}
QWidget#kpiCard {{
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(212, 175, 55, 0.12);
    border-radius: 12px;
}}
QLabel#goldTitle {{
    color: {GOLD};
    font-size: 22px;
    font-weight: bold;
}}
QLabel#kpiValue {{
    color: {GOLD_LIGHT};
    font-size: 28px;
    font-weight: bold;
}}
QLabel#kpiLabel {{
    color: #888;
    font-size: 11px;
    letter-spacing: 1px;
}}
QLabel#phaseLabel {{
    color: #888;
    font-size: 12px;
    letter-spacing: 3px;
}}
QLabel#brandTitle {{
    color: {GOLD};
    font-size: 10px;
    letter-spacing: 4px;
}}
QPushButton {{
    background: rgba(42, 53, 40, 0.9);
    border: 1px solid {GLASS_BORDER};
    color: {FG};
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 13px;
}}
QPushButton:hover {{
    background: #2a3528;
    border-color: {GOLD};
}}
QPushButton#goldBtn {{
    background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 {GOLD}, stop:0.5 {GOLD_DIM}, stop:1 {GOLD});
    color: #0a0a08;
    font-weight: bold;
    border: none;
    padding: 11px 20px;
    border-radius: 10px;
}}
QPushButton#dangerBtn {{
    background: #3d1f1f;
    border-color: #a44;
    color: #e8a0a0;
}}
QLineEdit, QSpinBox, QTextEdit, QComboBox {{
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid {GLASS_BORDER};
    border-radius: 10px;
    padding: 9px 12px;
    color: {FG};
}}
QLineEdit:focus, QSpinBox:focus, QTextEdit:focus {{
    border-color: {GOLD};
}}
QListWidget {{
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
}}
QListWidget#navList::item {{
    padding: 13px 18px;
    color: #aaa;
    border-left: 3px solid transparent;
    border-radius: 0;
}}
QListWidget#navList::item:selected {{
    background: rgba(212, 175, 55, 0.08);
    color: {GOLD};
    border-left: 3px solid {GOLD};
}}
QListWidget#taskList {{
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(212, 175, 55, 0.12);
    border-radius: 12px;
}}
QListWidget#taskList::item {{
    padding: 10px 14px;
    border-radius: 8px;
}}
QListWidget#taskList::item:selected {{
    background: rgba(212, 175, 55, 0.12);
    color: {GOLD};
}}
QProgressBar {{
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 4px;
    height: 8px;
    text-align: center;
    color: transparent;
}}
QProgressBar::chunk {{
    background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 {GOLD_DIM}, stop:0.5 {GOLD}, stop:1 {GOLD_LIGHT});
    border-radius: 4px;
}}
QCheckBox {{ color: #ccc; spacing: 8px; }}
QCheckBox::indicator {{
    width: 18px; height: 18px;
    border-radius: 4px;
    border: 1px solid {GLASS_BORDER};
    background: rgba(0,0,0,0.3);
}}
QCheckBox::indicator:checked {{
    background: {GOLD};
    border-color: {GOLD};
}}
"""
