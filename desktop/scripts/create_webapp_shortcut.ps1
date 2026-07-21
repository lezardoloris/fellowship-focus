# Create a Desktop icon that opens the Fellowship Focus WEB APP (/app) in its own
# app-style window (Chrome/Edge --app=), using the golden ring icon.
#
# It auto-fills your guild code + api_url from ~/.fellowship-focus/config.json
# when available, so the icon opens you straight into the connected app.
param(
    [string]$ShortcutName = "Fellowship Focus (Web).lnk",
    [string]$Url = "",
    [string]$Code = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assets = Join-Path $root "assets"
$icon = Join-Path $assets "fellowship.ico"
if (-not (Test-Path $icon)) {
    python (Join-Path $root "scripts\build_icon.py")
}

# ── Resolve the URL (config → params → prod default) ────────────────
$apiUrl = "https://fellowship-focus-production.up.railway.app"
$cfgPath = Join-Path $env:USERPROFILE ".fellowship-focus\config.json"
if (Test-Path $cfgPath) {
    try {
        $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
        if ($cfg.api_url) { $apiUrl = ([string]$cfg.api_url).TrimEnd('/') }
        if (-not $Code -and $cfg.fellowship_code) { $Code = [string]$cfg.fellowship_code }
    } catch {
        Write-Host "Could not read config ($cfgPath); using defaults."
    }
}

if (-not $Url) {
    $Url = "${apiUrl}/app"
    if ($Code) { $Url = "${Url}?code=${Code}" }
}

# ── Find a Chromium browser for app-window mode ─────────────────────
function Find-Browser {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    return $null
}

$browser = Find-Browser
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop $ShortcutName

$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($shortcutPath)

if ($browser) {
    $lnk.TargetPath = $browser
    $lnk.Arguments = "--app=$Url"
    $lnk.Description = "Fellowship Focus - web app (block, player, guild)"
} else {
    # No Chromium browser: open the URL in the default browser instead.
    $lnk.TargetPath = $Url
    $lnk.Description = "Fellowship Focus - web app"
}
$lnk.IconLocation = "$icon,0"
$lnk.WorkingDirectory = $assets
$lnk.Save()

Write-Host "Web app shortcut created: $shortcutPath"
Write-Host "Opens: $Url"
Write-Host "Icon:  $icon"
if (-not $browser) {
    Write-Host "(Chrome/Edge not found - it will open in your default browser, without app-window mode.)"
}
