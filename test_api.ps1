$base = "http://localhost:3000/api"
$endpoints = @(
    @{M="GET";  P="/health"},
    @{M="GET";  P="/settings/status"},
    @{M="GET";  P="/settings"},
    @{M="GET";  P="/settings/presets"},
    @{M="GET";  P="/settings/logs"},
    @{M="GET";  P="/products"},
    @{M="GET";  P="/approval"},
    @{M="GET";  P="/campaigns"}
)
Write-Host "`n=== ShopGold API Test ===" -ForegroundColor Cyan
foreach ($ep in $endpoints) {
    try {
        $r = Invoke-RestMethod -Uri "$base$($ep.P)" -Method $ep.M -TimeoutSec 8
        Write-Host "[OK]   $($ep.M) $($ep.P)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($ep.M) $($ep.P) -> $($_.Exception.Message)" -ForegroundColor Red
    }
}
# Test batch/estimate 400
try {
    Invoke-RestMethod -Uri "$base/products/batch/estimate" -Method POST -ContentType "application/json" -Body '{"productIds":[]}' -TimeoutSec 5 | Out-Null
    Write-Host "[WARN] POST /products/batch/estimate empty -> should be 400" -ForegroundColor Yellow
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400) { Write-Host "[OK]   POST /products/batch/estimate empty -> 400 (expected)" -ForegroundColor Green }
    else { Write-Host "[FAIL] POST /products/batch/estimate -> $code" -ForegroundColor Red }
}
Write-Host "`n=== Done ===" -ForegroundColor Cyan
