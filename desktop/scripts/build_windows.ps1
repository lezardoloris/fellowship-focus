# Build Fellowship Focus Windows .exe — run on Windows with Python 3.11+
# Output: desktop/dist/FellowshipFocus/FellowshipFocus.exe

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

python scripts/download_fonts.py
python scripts/generate_placeholders.py

pip install -r requirements.txt pyinstaller>=6.0

pyinstaller --noconfirm --windowed --name FellowshipFocus `
  --icon "assets/fellowship.ico" `
  --add-data "assets;assets" `
  --add-data "blocklist.json;." `
  --add-data "fellowship_focus;fellowship_focus" `
  --hidden-import PySide6.QtWebEngineWidgets `
  --collect-all mitmproxy `
  main.py

Write-Host "`nDone: dist/FellowshipFocus/FellowshipFocus.exe"
Write-Host "Upload dist/FellowshipFocus as zip to GitHub Releases for web download."
