# PyInstaller spec — Fellowship Focus Windows build
# Run: pyinstaller --noconfirm FellowshipFocus.spec

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

block_cipher = None
root = Path(SPECPATH)

hiddenimports = [
    "psutil",
    "certifi",
    "requests",
    "urllib3",
    "charset_normalizer",
    "idna",
    "mss",
    "PIL",
    "PIL.Image",
    "PIL.ImageFilter",
    "cv2",
    "winotify",
    "winotify.audio",
    "win10toast",
    "PySide6.QtWebEngineWidgets",
    "PySide6.QtWebEngineCore",
    "PySide6.QtMultimedia",
    "fellowship_focus",
    "fellowship_focus.ui.main_window",
    "fellowship_focus.blocker.manager",
    "fellowship_focus.blocker.block",
    "fellowship_focus.blocker.block_page",
    "fellowship_focus.blocker.elevate",
    "fellowship_focus.blocker.layers",
    "fellowship_focus.ui.action_nudge",
    "fellowship_focus.ui.session_nudge",
]

datas = [
    (str(root / "assets"), "assets"),
    (str(root / "blocklist.json"), "."),
    (str(root / "fellowship_focus" / "blocker"), "fellowship_focus/blocker"),
    (str(root / "packaging" / "WINDOWS-README.txt"), "."),
    (str(root / "packaging" / "Start-Fellowship-Focus.bat"), "."),
]
binaries = []

# Bundle heavy dependency trees (esp. mitmproxy data files) PyInstaller misses.
# These must be gathered BEFORE Analysis so their TOCs get normalized with the
# rest; appending raw collect_all() tuples to a.datas afterward breaks COLLECT.
for pkg in ("mitmproxy", "certifi", "psutil", "mss", "cv2"):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden
    except Exception:
        pass

a = Analysis(
    [str(root / "main.py")],
    pathex=[str(root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="FellowshipFocus",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(root / "assets" / "fellowship.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="FellowshipFocus",
)
