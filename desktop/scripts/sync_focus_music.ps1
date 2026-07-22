# Sync downloaded focus music into web + desktop folders and rebuild manifest.
# Source of truth: %USERPROFILE%\.fellowship-focus\music\

$ErrorActionPreference = "Stop"
$src = Join-Path $env:USERPROFILE ".fellowship-focus\music"
$webAudio = Join-Path $PSScriptRoot "..\web\public\audio"
$desktopMusic = Join-Path $PSScriptRoot "..\desktop\assets\music"
New-Item -ItemType Directory -Force -Path $webAudio, $desktopMusic | Out-Null

$tracks = Get-ChildItem $src -Filter *.mp3 | Where-Object { $_.Length -gt 1MB }
if (-not $tracks) {
  Write-Host "No mp3 files found in $src yet."
  exit 0
}

$manifest = @()
foreach ($t in $tracks) {
  # Shorter safe filename for web URLs
  $safe = ($t.BaseName -replace '[^\w\-\[\] ]', '' -replace '\s+', ' ').Trim()
  if ($safe.Length -gt 90) { $safe = $safe.Substring(0, 90) }
  $destName = "$safe.mp3"
  Copy-Item $t.FullName (Join-Path $webAudio $destName) -Force
  Copy-Item $t.FullName (Join-Path $desktopMusic $destName) -Force
  $idMatch = [regex]::Match($t.Name, '\[([A-Za-z0-9_-]{6,})\]')
  $youtubeId = if ($idMatch.Success) { $idMatch.Groups[1].Value } else { $null }
  $manifest += [ordered]@{
    title = ($t.BaseName -replace '\s*\[[A-Za-z0-9_-]+\]\s*$', '').Trim()
    src = "/audio/$destName"
    youtubeId = $youtubeId
  }
  Write-Host "Synced $($t.Name) ($([math]::Round($t.Length/1MB,1)) MB)"
}

$manifestPath = Join-Path $webAudio "manifest.json"
($manifest | ConvertTo-Json -Depth 4) | Set-Content $manifestPath -Encoding utf8
Write-Host "Wrote $($manifest.Count) entries → $manifestPath"
