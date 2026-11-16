# Build a clean WordPress plugin ZIP for MATCHFLOW (excludes node_modules, .git, tests tooling).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zip = Join-Path $dist 'matchflow.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

$staging = Join-Path $dist 'matchflow'
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

if (Test-Path (Join-Path $root 'composer.json')) {
  & (Join-Path $root 'scripts/install-php-deps.ps1')
  Push-Location $root
  $composer = Get-Command composer -ErrorAction SilentlyContinue
  if ($composer) {
    & composer dump-autoload -o --no-dev 2>$null
  } elseif (Test-Path (Join-Path $root 'composer.phar')) {
    & php (Join-Path $root 'composer.phar') dump-autoload -o --no-dev 2>$null
  }
  Pop-Location
}

$include = @(
  'matchflow.php', 'uninstall.php', 'readme.txt', 'README.md', 'LICENSE',
  'composer.json', 'composer.lock', 'includes', 'templates', 'assets', 'docs', 'vendor'
)
foreach ($item in $include) {
  $src = Join-Path $root $item
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $staging (Split-Path $item -Leaf)) -Recurse -Force
  }
}

$buildRoot = Join-Path $root 'assets/build'
$deliveryRoot = Join-Path $staging 'assets/delivery'
if (Test-Path $buildRoot) {
  New-Item -ItemType Directory -Force -Path $deliveryRoot | Out-Null
  $manifest = Join-Path $buildRoot '.vite/manifest.json'
  if (-not (Test-Path $manifest)) { $manifest = Join-Path $buildRoot 'manifest.json' }
  if (Test-Path $manifest) {
    $mf = Get-Content $manifest -Raw | ConvertFrom-Json
    $entry = $mf.'src/main.tsx'
    if (-not $entry) {
      $entry = $mf.PSObject.Properties | ForEach-Object { $_.Value } | Where-Object { $_.isEntry -eq $true } | Select-Object -First 1
    }
    if ($entry -and $entry.file) {
      $jsRel = ($entry.file -replace '^/', '')
      Copy-Item (Join-Path $buildRoot $jsRel) (Join-Path $deliveryRoot 'app.js') -Force
      if ($entry.css) {
        $cssRel = ($entry.css[0] -replace '^/', '')
        Copy-Item (Join-Path $buildRoot $cssRel) (Join-Path $deliveryRoot 'app.css') -Force
      }
    }
  }
  $chunkDir = Join-Path $buildRoot 'assets'
  if (Test-Path $chunkDir) {
    Copy-Item $chunkDir (Join-Path $deliveryRoot 'assets') -Recurse -Force
  }
}

Compress-Archive -Path $staging -DestinationPath $zip -Force
Write-Host "Created $zip"
