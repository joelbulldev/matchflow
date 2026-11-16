# Fail if client bundles / SPA source contain banned platform strings or admin-ajax business usage.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$paths = @(
  (Join-Path $root 'resources\app\src'),
  (Join-Path $root 'assets\build')
)
$patterns = @('admin-ajax\.php', 'wp-admin', 'WordPress', 'woocommerce')
$failed = $false
foreach ($path in $paths) {
  if (!(Test-Path $path)) { continue }
  foreach ($pattern in $patterns) {
    $hits = Get-ChildItem -Path $path -Recurse -File -Include *.js,*.tsx,*.ts,*.css | Select-String -Pattern $pattern -SimpleMatch:$false
    if ($hits) {
      Write-Host "STEALTH FAIL: $pattern"
      $hits | Select-Object -First 20 | ForEach-Object { Write-Host $_.Path ':' $_.LineNumber ':' $_.Line.Trim() }
      $failed = $true
    }
  }
}
if ($failed) { exit 1 }
Write-Host 'Stealth grep passed.'
