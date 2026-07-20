# PyInstaller spec — Fellowship Focus Windows build
# Run: pyinstaller --noconfirm FellowshipFocus.spec

import sys
from pathlib import Path

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
    "fellowship_focus",
    "fellowship_focus.ui.main_window",
    "fellowship_focus.blocker.manager",
    "fellowship_focus.blocker.block",
    "fellowship_focus.blocker.block_page",
]

datas = [
    (str(root / "assets"), "assets"),
    (str(root / "blocklist.json"), "."),
    (str(root / "fellowship_focus" / "blocker"), "fellowship_focus/blocker"),
    (str(root / "packaging" / "WINDOWS-README.txt"), "."),
    (str(root / "packaging" / "Start-Fellowship-Focus.bat"), "."),
]

a = Analysis(
    [str(root / "main.py")],
    pathex=[str(root)],
    binaries=[],
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

# Bundle heavy dependency trees PyInstaller often misses.
for pkg in ("mitmproxy", "certifi", "psutil", "mss", "cv2"):
    try:
        tmp = collect_all(pkg)
        a.datas += tmp[0]
        a.binaries += tmp[1]
        a.hiddenimports += tmp[2]
    except Exception:
        pass

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
