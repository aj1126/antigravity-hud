# =====================================================================
# run_all_hud_tests.ps1 - Master Unified Test Runner for AGY HUD
# =====================================================================

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  Antigravity CLI (AGY) - Statusline HUD Master Tests" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

$testDir = $PSScriptRoot
$allPassed = $true

# 1. Node.js HUD Engine & CLI Matrix Tests
Write-Host "[1/5] Running Node.js Engine & CLI Matrix Tests..." -ForegroundColor Yellow
$res1 = node (Join-Path $testDir "hud_engine.test.js")
Write-Host $res1
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 2. WinForms Headless Pester Tests
Write-Host "[2/5] Running WinForms Headless GUI Pester Tests..." -ForegroundColor Yellow
$pesterResult = Invoke-Pester -Path (Join-Path $testDir "hud_gui.test.ps1") -PassThru -Output Minimal
if ($pesterResult.FailedCount -gt 0) { $allPassed = $false }

# 3. Web GUI Template & Schema Tests
Write-Host "[3/5] Running Web GUI Template & Schema Tests..." -ForegroundColor Yellow
$res3 = node (Join-Path $testDir "hud_web_gui.test.js")
Write-Host $res3
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 4. Settings Integration Tests
Write-Host "[4/5] Running Settings Integration Tests..." -ForegroundColor Yellow
$res4 = node (Join-Path $testDir "hud_integration.test.js")
Write-Host $res4
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 5. Automated Checks, Drift Detection & Self-Healing Matrix
Write-Host "[5/5] Running Automated Checks, Drift Detection & Self-Healing Tests..." -ForegroundColor Yellow
$res5 = node (Join-Path $testDir "hud_checks_and_corrections.test.js")
Write-Host $res5
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

Write-Host "=======================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  ✔ ALL AGY HUD TEST SUITES PASSED SUCCESSFULLY!" -ForegroundColor Green
} else {
    Write-Host "  ✖ SOME AGY HUD TESTS FAILED." -ForegroundColor Red
}
Write-Host "=======================================================`n" -ForegroundColor Cyan

if (-not $allPassed) { exit 1 }
