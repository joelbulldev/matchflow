# Install PHP dependencies (dompdf) into vendor/ for the plugin zip.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

$php = Get-Command php -ErrorAction SilentlyContinue
if (-not $php) {
  Write-Warning 'PHP CLI not found. On the server, run: cd wp-content/plugins/matchflow && composer install --no-dev'
  Pop-Location
  exit 0
}

$composerPhar = Join-Path $root 'composer.phar'
if (-not (Test-Path $composerPhar)) {
  Invoke-WebRequest -Uri 'https://getcomposer.org/download/latest-stable/composer.phar' -OutFile $composerPhar
}
& php $composerPhar install --no-dev --optimize-autoloader
Pop-Location
Write-Host 'PHP vendor/ ready for dompdf.'