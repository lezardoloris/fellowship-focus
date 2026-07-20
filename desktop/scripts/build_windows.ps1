# Build Fellowship Focus Windows .exe — run on Windows with Python 3.11+
# Output: desktop/dist/FellowshipFocus/FellowshipFocus.exe

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

python scripts/download_fonts.py
python scripts/generate_placeholders.py

pip install -r requirements.txt pyinstaller>=6.0

pyinstaller --noconfirm FellowshipFocus.spec

Write-Host "`nDone: dist/FellowshipFocus/FellowshipFocus.exe"
Write-Host "Zip dist/FellowshipFocus/ for GitHub Releases."
