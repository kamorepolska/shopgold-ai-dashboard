$base = "http://localhost:3000/api"
Write-Host "`n=== Test importu XML (upload pliku) ===" -ForegroundColor Cyan

# Upload sample XML via multipart form
$xmlPath = Resolve-Path "data\sample_products.xml"
Write-Host "  Plik: $xmlPath" -ForegroundColor Gray

$boundary = [System.Guid]::NewGuid().ToString()
$xmlBytes = [System.IO.File]::ReadAllBytes($xmlPath)
$xmlText  = [System.Text.Encoding]::UTF8.GetString($xmlBytes)

$body  = "--$boundary`r`n"
$body += "Content-Disposition: form-data; name=`"connectionType`"`r`n`r`nxml`r`n"
$body += "--$boundary`r`n"
$body += "Content-Disposition: form-data; name=`"file`"; filename=`"sample_products.xml`"`r`n"
$body += "Content-Type: application/xml`r`n`r`n"
$body += $xmlText + "`r`n"
$body += "--$boundary--"

$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

try {
    $result = Invoke-RestMethod -Uri "$base/products/sync" -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $bodyBytes -TimeoutSec 15
    Write-Host "  [OK] Import: $($result.imported) produktow, pominieto: $($result.skipped)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check products count
$prods = Invoke-RestMethod -Uri "$base/products" -Method GET -TimeoutSec 8
Write-Host "  Produkty w cache: $($prods.total)" -ForegroundColor Cyan

# Test batch/estimate with real product IDs
if ($prods.products.Count -gt 0) {
    $ids = $prods.products[0..2] | ForEach-Object { $_.id }
    Write-Host "`n  Test batch/estimate dla $($ids.Count) produktow..." -ForegroundColor Yellow
    $estimateBody = @{ productIds = $ids } | ConvertTo-Json
    try {
        $est = Invoke-RestMethod -Uri "$base/products/batch/estimate" -Method POST -ContentType "application/json" -Body $estimateBody -TimeoutSec 8
        Write-Host "  [OK] Szacowanie: ~`$$($est.estimatedCostUSD) USD, $($est.totalTokens) tokenow" -ForegroundColor Green
        Write-Host "  Provider: $($est.provider), Model: $($est.model)" -ForegroundColor Gray
    } catch {
        Write-Host "  [FAIL] batch/estimate: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Test single product standardize lookup (no AI key needed for structure)
    Write-Host "`n  Test pobierania pojedynczego produktu..." -ForegroundColor Yellow
    $pid = $prods.products[0].id
    try {
        $p = Invoke-RestMethod -Uri "$base/products/$pid" -Method GET -TimeoutSec 8
        Write-Host "  [OK] Produkt: $($p.name) | Cena: $($p.price) zl" -ForegroundColor Green
        Write-Host "  Kategoria: $($p.category)" -ForegroundColor Gray
        $attrCount = ($p.attributes | Get-Member -MemberType NoteProperty).Count
        Write-Host "  Atrybuty: $attrCount" -ForegroundColor Gray
    } catch {
        Write-Host "  [FAIL] $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Import i logika produktow - OK ===" -ForegroundColor Green
