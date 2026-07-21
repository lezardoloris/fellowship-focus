# Copy shared JPG/PNG/ICO assets between desktop and web public folders.
$root = Split-Path -Parent $PSScriptRoot
$desktop = Join-Path $root "desktop\assets"
$web = Join-Path $root "web\public\assets"
$names = @(
  "hero.jpg", "journey-map.jpg", "focus-quest.jpg", "fellowship.jpg",
  "rivendell.jpg", "mount-doom.jpg", "cannot-pass.jpg",
  "app-icon.png", "shield-logo.png", "fellowship.ico"
)
New-Item -ItemType Directory -Force -Path $web | Out-Null
foreach ($name in $names) {
  $src = Join-Path $desktop $name
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $web $name) -Force
    Write-Host "web <= desktop  $name"
  }
  $srcWeb = Join-Path $web $name
  if (Test-Path $srcWeb) {
    Copy-Item $srcWeb (Join-Path $desktop $name) -Force
    Write-Host "desktop <= web  $name"
  }
}
