# Smoke-test MATCHFLOW REST after deploy (demo login + analytics + one AR chain).
# Usage: .\scripts\smoke-deploy.ps1 -BaseUrl https://matchflow.deepwhale.fun
param(
    [string]$BaseUrl = $env:MATCHFLOW_SMOKE_URL
)

if (-not $BaseUrl) {
    $BaseUrl = 'https://matchflow.deepwhale.fun'
}

$BaseUrl = $BaseUrl.TrimEnd('/')
$api = "$BaseUrl/api/v1"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-Matchflow {
    param([string]$Method, [string]$Path, [object]$Body)
    $uri = "$api$Path"
    $params = @{
        Uri             = $uri
        Method          = $Method
        WebSession      = $session
        UseBasicParsing = $true
        Headers         = @{ Accept = 'application/json' }
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Compress)
        $params.ContentType = 'application/json'
    }
  return Invoke-WebRequest @params
}

Write-Host "MATCHFLOW smoke: $BaseUrl"

try {
    $demo = Invoke-Matchflow -Method POST -Path '/auth/demo'
    $demoJson = $demo.Content | ConvertFrom-Json
    if (-not $demoJson.success) { throw "Demo login failed: $($demo.Content)" }
    Write-Host "OK demo login user=$($demoJson.data.user.email)"
}
catch {
    Write-Error "Demo login: $_"
    exit 1
}

$modules = @(
    @{ m = 'receivables'; c = 'default' },
    @{ m = 'receivables'; c = 'links' },
    @{ m = 'payables'; c = 'default' },
    @{ m = 'procurement'; c = 'grn' },
    @{ m = 'approvals'; c = 'default' },
    @{ m = 'payments'; c = 'default' },
    @{ m = 'reconciliation'; c = 'default' },
    @{ m = 'reconciliation'; c = 'unmatched' },
    @{ m = 'reports'; c = 'default' },
    @{ m = 'reports'; c = 'collections' },
    @{ m = 'reports'; c = 'exceptions' },
    @{ m = 'reports'; c = 'receivables-aging' },
    @{ m = 'finance-ai'; c = 'default' }
)

$fail = 0
foreach ($row in $modules) {
    $path = "/dashboard/analytics/$($row.m)?context=$([uri]::EscapeDataString($row.c))"
    try {
        $r = Invoke-Matchflow -Method GET -Path $path
        $j = $r.Content | ConvertFrom-Json
        if (-not $j.success) {
            Write-Warning "FAIL $path — $($r.Content)"
            $fail++
            continue
        }
        $metricCount = @($j.data.metrics).Count
        $chartCount = @($j.data.charts).Count
        Write-Host "OK analytics/$($row.m) context=$($row.c) metrics=$metricCount charts=$chartCount"
    }
    catch {
        Write-Warning "FAIL $path — $_"
        $fail++
    }
}

try {
    $boot = Invoke-Matchflow -Method GET -Path '/bootstrap'
    $b = ($boot.Content | ConvertFrom-Json).data
    $orgId = $b.currentOrganizationId
    Write-Host "OK bootstrap org=$orgId"
    $inv = Invoke-Matchflow -Method GET -Path "/receivables/invoices?limit=5"
    $invJ = ($inv.Content | ConvertFrom-Json).data
    $items = if ($invJ.items) { $invJ.items } elseif ($invJ.rows) { $invJ.rows } else { $invJ }
    $first = $items | Select-Object -First 1
    if ($first -and $first.id) {
        $id = $first.id
        $detail = Invoke-Matchflow -Method GET -Path "/receivables/invoices/$id"
        Write-Host "OK invoice detail #$id status=$($first.status)"
        if ($first.public_payment_token) {
            Write-Host "  checkout token present (public /pay flow available)"
        }
    }
    else {
        Write-Host "WARN no invoices in demo org (seed may be empty)"
    }
}
catch {
    Write-Warning "AR chain check: $_"
    $fail++
}

if ($fail -gt 0) {
    Write-Error "$fail smoke check(s) failed"
    exit 1
}

Write-Host "Smoke complete — all analytics endpoints responded."
