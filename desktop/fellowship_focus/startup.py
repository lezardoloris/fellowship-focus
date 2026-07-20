"""Windows startup on boot — non-intrusive tray launch."""

import sys
from pathlib import Path


def _startup_command() -> str:
    exe = Path(sys.executable)
    main_py = Path(__file__).resolve().parents[2] / "main.py"
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}" --minimized'
    return f'"{exe}" "{main_py}" --minimized'


def is_startup_enabled() -> bool:
    if sys.platform != "win32":
        return False
    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_READ,
        )
        try:
            winreg.QueryValueEx(key, "FellowshipFocus")
            return True
        except FileNotFoundError:
            return False
        finally:
            winreg.CloseKey(key)
    except Exception:
        return False


def set_startup_enabled(enabled: bool) -> tuple[bool, str]:
    if sys.platform != "win32":
        return False, "Startup only supported on Windows."
    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_SET_VALUE,
        )
        if enabled:
            winreg.SetValueEx(key, "FellowshipFocus", 0, winreg.REG_SZ, _startup_command())
            winreg.CloseKey(key)
            return True, "Fellowship Focus will start with Windows (minimized to tray)."
        winreg.DeleteValue(key, "FellowshipFocus")
        winreg.CloseKey(key)
        return True, "Removed from Windows startup."
    except Exception as e:
        return False, str(e)
