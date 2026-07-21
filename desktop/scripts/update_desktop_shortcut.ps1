# Create or refresh the Fellowship Focus desktop shortcut with the current app icon.
param(
    [string]$ShortcutName = "Focus Fellowship.lnk"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assets = Join-Path $root "assets"
$icon = Join-Path $assets "fellowship.ico"
if (-not (Test-Path $icon)) {
    python (Join-Path $root "scripts\build_icon.py")
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop $ShortcutName
$mainPy = Join-Path $root "main.py"

$sh = New-Object -ComObject WScript.Shell
if (Test-Path $shortcutPath) {
    $lnk = $sh.CreateShortcut($shortcutPath)
} else {
    $lnk = $sh.CreateShortcut($shortcutPath)
    $pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
    if (-not $pythonw) {
        $pythonw = (Get-Command python.exe).Source -replace "python.exe$", "pythonw.exe"
    }
    $lnk.TargetPath = $pythonw
    $lnk.Arguments = "main.py"
    $lnk.WorkingDirectory = $root
    $lnk.Description = "Fellowship Focus - focus timer and site blocker"
}

$lnk.IconLocation = "$icon,0"
$lnk.Save()
Write-Host "Desktop shortcut updated: $shortcutPath"
Write-Host "Icon: $icon"
