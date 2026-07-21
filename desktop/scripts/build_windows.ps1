# Build Fellowship Focus Windows .exe — run on Windows with Python 3.11+
# Output: desktop/dist/FellowshipFocus/FellowshipFocus.exe

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

python scripts/download_fonts.py
python scripts/build_icon.py
python scripts/generate_placeholders.py

pip install -r requirements.txt pyinstaller>=6.0

pyinstaller --noconfirm FellowshipFocus.spec

# ── Smoke test — fail loudly if the bundle can't actually block ──
$exe = Join-Path $root "dist\FellowshipFocus\FellowshipFocus.exe"
if (-not (Test-Path $exe)) {
    throw "Smoke test FAILED: $exe not found."
}

Write-Host "`nSmoke test 1/2: embedded mitmproxy engine reachable..."
& $exe --run-proxy --version
if ($LASTEXITCODE -ne 0) {
    throw "Smoke test FAILED: 'FellowshipFocus.exe --run-proxy --version' exited $LASTEXITCODE (mitmproxy not embedded correctly)."
}

Write-Host "Smoke test 2/2: block.py bundled at the path the app resolves..."
$blockCandidates = @(
    (Join-Path $root "dist\FellowshipFocus\_internal\fellowship_focus\blocker\block.py"),
    (Join-Path $root "dist\FellowshipFocus\fellowship_focus\blocker\block.py")
)
if (-not ($blockCandidates | Where-Object { Test-Path $_ })) {
    throw "Smoke test FAILED: block.py not found in dist. Checked:`n  $($blockCandidates -join "`n  ")"
}

Write-Host "`nSmoke tests passed."
Write-Host "Done: dist/FellowshipFocus/FellowshipFocus.exe"
Write-Host "Zip dist/FellowshipFocus/ for GitHub Releases."
