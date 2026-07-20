import os
import subprocess
import sys
from pathlib import Path

CHECK_CERT_PS = r'Get-ChildItem -Path "Cert:\CurrentUser\Root" | Where-Object { $_.Subject -like "*mitmproxy*" }'


def cert_file_path() -> Path:
    return Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.cer"


def is_cert_installed() -> bool:
    if sys.platform != "win32":
        return cert_file_path().exists()
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", CHECK_CERT_PS],
            capture_output=True,
            text=True,
            timeout=15,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


def is_cert_generated() -> bool:
    return cert_file_path().exists()


def install_cert_windows() -> tuple[bool, str]:
    path = cert_file_path()
    if not path.exists():
        return False, "Certificate not generated yet. Start blocking once to generate it."

    if is_cert_installed():
        return True, "Certificate already installed."

    cmd = f'Import-Certificate -FilePath "{path}" -CertStoreLocation Cert:\\CurrentUser\\Root'
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        if result.returncode == 0:
            return True, "Certificate installed successfully."
        return False, result.stderr or "Installation failed."
    except Exception as e:
        return False, str(e)


def uninstall_cert_windows() -> tuple[bool, str]:
    cmd = r"""
    $storePath = "Cert:\CurrentUser\Root"
    Get-ChildItem -Path $storePath | Where-Object { $_.Subject -like "*mitmproxy*" } | Remove-Item
    """
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True,
            timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        return True, "Certificate removed."
    except Exception as e:
        return False, str(e)
