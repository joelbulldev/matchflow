# Copy Vite build into stable plugin paths for web-root publishing (app.js / app.css + chunks).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'assets\build'
$delivery = Join-Path $root 'assets\delivery'
$manifestPath = Join-Path $build '.vite\manifest.json'
if (-not (Test-Path $manifestPath)) {
    $manifestPath = Join-Path $build 'manifest.json'
}
if (-not (Test-Path $manifestPath)) {
    Write-Error "Vite manifest not found under assets/build. Run npm run build first."
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$entry = $manifest.'src/main.tsx'
if (-not $entry) { $entry = $manifest.'index.html' }
if (-not $entry) {
    foreach ($p in $manifest.PSObject.Properties) {
        $v = $p.Value
        if ($v.isEntry) { $entry = $v; break }
    }
}
if (-not $entry -or -not $entry.file) {
    Write-Error "Could not resolve Vite entry in manifest."
}

if (Test-Path $delivery) { Remove-Item $delivery -Recurse -Force }
New-Item -ItemType Directory -Force -Path $delivery | Out-Null

$jsSrc = Join-Path $build ($entry.file -replace '/', '\')
$cssFile = $null
if ($entry.css -and $entry.css.Count -gt 0) {
    $cssFile = [string]$entry.css[0]
}
if (-not (Test-Path $jsSrc)) { Write-Error "Missing bundle: $jsSrc" }

Copy-Item $jsSrc (Join-Path $delivery 'app.js') -Force
if ($cssFile) {
    $cssSrc = Join-Path $build ($cssFile -replace '/', '\')
    if (Test-Path $cssSrc) {
        Copy-Item $cssSrc (Join-Path $delivery 'app.css') -Force
    }
}

$assetsDir = Join-Path $build 'assets'
if (Test-Path $assetsDir) {
    Copy-Item $assetsDir (Join-Path $delivery 'assets') -Recurse -Force
}

$chunksDir = Join-Path $delivery 'assets'
if (-not (Test-Path $chunksDir)) {
    New-Item -ItemType Directory -Force -Path $chunksDir | Out-Null
}
$jsBase = Split-Path $entry.file -Leaf
Copy-Item $jsSrc (Join-Path $chunksDir $jsBase) -Force -ErrorAction SilentlyContinue
if ($cssFile) {
    $cssBase = Split-Path $cssFile -Leaf
    $cssSrc = Join-Path $build ($cssFile -replace '/', '\')
    if (Test-Path $cssSrc) {
        Copy-Item $cssSrc (Join-Path $chunksDir $cssBase) -Force
    }
}

Write-Host "Synced delivery aliases to $delivery (app.js, app.css, assets/)"
