param(
  [string]$Package = "",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$PluginId = "io.github.nessteruk.dithering"
$Uxp = Join-Path $env:APPDATA "Adobe\UXP"
$External = Join-Path $Uxp "Plugins\External"
$Registry = Join-Path $Uxp "PluginsInfo\v1\PS.json"

function Read-Registry {
  if (-not (Test-Path $Registry)) { return @() }
  $content = Get-Content -Raw -Path $Registry
  if ([string]::IsNullOrWhiteSpace($content)) { return @() }
  try {
    $data = $content | ConvertFrom-Json
  } catch {
    throw "$Registry is not valid JSON; nothing was changed."
  }
  if ($null -eq $data.plugins) { return @() }
  return @($data.plugins | Where-Object { $_.pluginId -ne $PluginId })
}

function Write-Registry($plugins) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Registry) | Out-Null
  $json = ConvertTo-Json -InputObject @{ plugins = @($plugins) } -Depth 6 -Compress
  [System.IO.File]::WriteAllText($Registry, $json, (New-Object System.Text.UTF8Encoding $false))
}

if ($Uninstall) {
  Get-ChildItem -Path $External -Directory -Filter "${PluginId}_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  Write-Registry @(Read-Registry)
  Write-Host "Dithering removed. Restart Photoshop."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Package)) {
  $Package = Get-ChildItem -Path (Get-Location) -Filter "Dithering-*.ccx" | Sort-Object Name | Select-Object -Last 1 -ExpandProperty FullName
}
if (-not $Package -or -not (Test-Path $Package)) {
  throw "Give the path of the .ccx file: .\install-manual.ps1 -Package .\Dithering-1.0.0.ccx"
}
$Package = (Resolve-Path $Package).Path

$archive = [System.IO.Compression.ZipFile]::OpenRead($Package)
try {
  $entry = $archive.GetEntry("manifest.json")
  if ($null -eq $entry) { throw "manifest.json not found in the package." }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  $manifest = $reader.ReadToEnd() | ConvertFrom-Json
  $reader.Dispose()
} finally {
  $archive.Dispose()
}
if ($manifest.id -ne $PluginId) { throw "Unexpected plugin id: $($manifest.id)" }

$folder = "${PluginId}_$($manifest.version)"
$target = Join-Path $External $folder
$plugins = @(Read-Registry)
Get-ChildItem -Path $External -Directory -Filter "${PluginId}_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Force -Path $External | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($Package, $target)

$plugins += [ordered]@{
  hostMinVersion = [string]$manifest.host.minVersion
  name = [string]$manifest.name
  path = '$localPlugins\External\' + $folder
  pluginId = [string]$manifest.id
  status = "enabled"
  type = "uxp"
  versionString = [string]$manifest.version
}
Write-Registry $plugins
Write-Host "Dithering $($manifest.version) installed in $target"
Write-Host "Restart Photoshop, then open the Plugins menu."
