$file = 'c:\Users\USER\.gemini\antigravity\scratch\shopgold-ai-dashboard\frontend\js\sourcing.js'
$content = [System.IO.File]::ReadAllText($file)

# Find the broken section and replace it
# The issue: lines 1629-1646 have leftover missing tab code inside promo section
$oldPattern = @"
      document.getElementById('promo-pg-next')?.addEventListener('click', () => { promoPage--; renderPromotions(); });
          if (missingSortCol === col) missingSortAsc = !missingSortAsc;
"@

# Let's use line-based approach instead
$lines = [System.IO.File]::ReadAllLines($file)
Write-Host "Total lines: $($lines.Length)"
Write-Host "Line 1628: $($lines[1627])"
Write-Host "Line 1629: $($lines[1628])"
Write-Host "Line 1630: $($lines[1629])"
Write-Host "Line 1646: $($lines[1645])"
Write-Host "Line 1647: $($lines[1646])"
Write-Host "Line 1648: $($lines[1647])"
