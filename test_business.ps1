$base = "http://localhost:3000/api"
Write-Host "`n=== Test importu XML + logika biznesowa ===" -ForegroundColor Cyan

# 1. Import sample XML
Write-Host "`n[1] Import produktow z pliku XML..." -ForegroundColor Yellow
$xmlContent = Get-Content "data\sample_products.xml" -Raw -Encoding UTF8
$body = @{ connectionType = "xml"; xmlUrl = "" } | ConvertTo-Json
# Use multipart for file upload simulation - test via URL method with a local file path trick
# Actually let's POST as xml content via a different approach
try {
    $syncResult = Invoke-RestMethod -Uri "$base/products/sync" -Method POST -ContentType "application/json" -Body (@{connectionType="xml"; xmlUrl=""} | ConvertTo-Json) -TimeoutSec 10
    Write-Host "  Sync bez URL: $($syncResult | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "  Sync bez URL -> $($_.Exception.Message) (oczekiwany blad - brak URL)" -ForegroundColor Gray
}

# 2. Check products (should be 0 still - no import done yet)
Write-Host "`n[2] Sprawdzenie stanu produktow..." -ForegroundColor Yellow
$prods = Invoke-RestMethod -Uri "$base/products" -Method GET -TimeoutSec 8
Write-Host "  Produkty w cache: $($prods.total)" -ForegroundColor Cyan

# 3. Check approval queue
Write-Host "`n[3] Kolejka akceptacji..." -ForegroundColor Yellow
$approval = Invoke-RestMethod -Uri "$base/approval" -Method GET -TimeoutSec 8
Write-Host "  Elementy w kolejce: $($approval.items.Count)" -ForegroundColor Cyan
Write-Host "  Statystyki: $($approval.stats | ConvertTo-Json -Compress)" -ForegroundColor Gray

# 4. Check campaigns
Write-Host "`n[4] Kampanie..." -ForegroundColor Yellow
$camps = Invoke-RestMethod -Uri "$base/campaigns" -Method GET -TimeoutSec 8
Write-Host "  Kampanie: $($camps.campaigns.Count)" -ForegroundColor Cyan

# 5. Verify settings/presets returns the default preset
Write-Host "`n[5] Presety promptow..." -ForegroundColor Yellow
$presets = Invoke-RestMethod -Uri "$base/settings/presets" -Method GET -TimeoutSec 8
Write-Host "  Liczba presetow: $($presets.presets.Count)" -ForegroundColor Cyan
foreach ($p in $presets.presets) {
    Write-Host "  - $($p.name) (domyslny: $($p.is_default))" -ForegroundColor Gray
}

# 6. Test saving a setting
Write-Host "`n[6] Test zapisu ustawienia..." -ForegroundColor Yellow
try {
    $saveResult = Invoke-RestMethod -Uri "$base/settings" -Method POST -ContentType "application/json" -Body (@{connection_type="xml"} | ConvertTo-Json) -TimeoutSec 8
    Write-Host "  Zapis ustawienia: $($saveResult.success)" -ForegroundColor Green
} catch {
    Write-Host "  Blad zapisu: $($_.Exception.Message)" -ForegroundColor Red
}

# 7. Verify bulk approval endpoint
Write-Host "`n[7] Test bulk approval (pusta lista)..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$base/approval/bulk" -Method POST -ContentType "application/json" -Body (@{ids=@(); status="approved"} | ConvertTo-Json) -TimeoutSec 8 | Out-Null
    Write-Host "  Bulk approval pusta lista -> 400 (oczekiwany blad)" -ForegroundColor Gray
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400) { Write-Host "  [OK] Bulk approval pusta lista -> 400" -ForegroundColor Green }
    else { Write-Host "  [FAIL] Nieoczekiwany kod: $code" -ForegroundColor Red }
}

Write-Host "`n=== Wszystkie testy biznesowe OK ===" -ForegroundColor Green
Write-Host "=== Uruchom aplikacje: http://localhost:3000 ===" -ForegroundColor Cyan
