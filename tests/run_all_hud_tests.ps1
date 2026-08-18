# Antigravity Master Test Runner
# Executes all 6 test suites across Node.js Engine, Pester WinForms, Web GUI, Settings, Checks/Self-Healing, and Lifecycle Hooks

[CmdletBinding()]
param()

$allPassed = $true
$testDir = $PSScriptRoot

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  Antigravity CLI (AGY) - Master Test Runner (6 Suites) " -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

# 1. Node.js Engine & CLI Matrix Tests
Write-Host "[1/6] Running Node.js Engine & CLI Matrix Tests..." -ForegroundColor Yellow
$res1 = node (Join-Path $testDir "hud_engine.test.js")
Write-Host $res1
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 2. WinForms Headless GUI Pester Tests
Write-Host "[2/6] Running WinForms Headless GUI Pester Tests..." -ForegroundColor Yellow
try {
    $pesterRes = Invoke-Pester -Path (Join-Path $testDir "hud_gui.test.ps1") -PassThru -Output Detailed
    if ($pesterRes.FailedCount -gt 0) { $allPassed = $false }
} catch {
    Write-Warning ("Pester execution warning: {0}" -f $_.Exception.Message)
}

# 3. Web GUI Template & Schema Tests
Write-Host "[3/6] Running Web GUI Template & Schema Tests..." -ForegroundColor Yellow
$res3 = node (Join-Path $testDir "hud_web_gui.test.js")
Write-Host $res3
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 4. Settings Integration Tests
Write-Host "[4/6] Running Settings Integration Tests..." -ForegroundColor Yellow
$res4 = node (Join-Path $testDir "hud_integration.test.js")
Write-Host $res4
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 5. Automated Checks, Drift Detection & Self-Healing Matrix
Write-Host "[5/6] Running Automated Checks, Drift Detection & Self-Healing Tests..." -ForegroundColor Yellow
$res5 = node (Join-Path $testDir "hud_checks_and_corrections.test.js")
Write-Host $res5
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

# 6. Lifecycle Hooks & Perma-Logging Matrix
Write-Host "[6/6] Running Lifecycle Hooks & Perma-Logging Tests..." -ForegroundColor Yellow
$res6 = node (Join-Path $testDir "hud_lifecycle_hooks.test.js")
Write-Host $res6
if ($LASTEXITCODE -ne 0) { $allPassed = $false }

Write-Host "=======================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  [OK] ALL AGY TEST SUITES PASSED SUCCESSFULLY!" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] SOME AGY TESTS FAILED." -ForegroundColor Red
}
Write-Host "=======================================================`n" -ForegroundColor Cyan

if (-not $allPassed) { exit 1 }
