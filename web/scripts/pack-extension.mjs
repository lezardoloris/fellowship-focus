/**
 * Zip the extension into an upload-ready package for the Chrome Web Store.
 *
 * Stages a clean copy (runtime files only — no store kit, no private key, no
 * markdown, no OS cruft), preserving the directory layout (icons/, rules.json…),
 * then zips it. Output: extension/store/fellowship-focus-<version>.zip
 *
 * Usage (from anywhere): node web/scripts/pack-extension.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(here, "../../extension");
const storeDir = path.join(extDir, "store");

const manifest = JSON.parse(readFileSync(path.join(extDir, "manifest.json"), "utf8"));
const version = manifest.version || "0.0.0";

if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true });
const out = path.join(storeDir, `fellowship-focus-${version}.zip`);
if (existsSync(out)) rmSync(out);

const q = (p) => p.replace(/'/g, "''");
const ps = `
$ErrorActionPreference = 'Stop'
$src   = '${q(extDir)}'
$out   = '${q(out)}'
$stage = Join-Path $env:TEMP ('ff-ext-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  Copy-Item -Path (Join-Path $src '*') -Destination $stage -Recurse -Force
  # Strip everything that must not ship.
  Remove-Item -Recurse -Force (Join-Path $stage 'store') -ErrorAction SilentlyContinue
  # Remove the dev-only 'key' field — the Web Store assigns the published id.
  $mf = Join-Path $stage 'manifest.json'
  $j = Get-Content $mf -Raw | ConvertFrom-Json
  $j.PSObject.Properties.Remove('key')
  ($j | ConvertTo-Json -Depth 20) | Set-Content $mf -Encoding utf8
  Get-ChildItem -Path $stage -Recurse -File |
    Where-Object { $_.Extension -in '.md','.pem' -or $_.Name -eq '.DS_Store' } |
    Remove-Item -Force -ErrorAction SilentlyContinue
  if (Test-Path $out) { Remove-Item $out -Force }
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -Force
} finally {
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}
`;

execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
console.log(`\nPacked: ${out}`);
console.log("Upload at https://chrome.google.com/webstore/devconsole");
