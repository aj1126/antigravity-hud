# Antigravity HUD 1-Click Installer
# Installs and hooks the real-time HUD statusline into your Antigravity AI environment.

[CmdletBinding()]
param (
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "         Antigravity HUD Installer (v2.0.0)            " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$GeminiDir = Join-Path $HomeDir ".gemini"
$ScriptsDir = Join-Path $GeminiDir "scripts"
$RepoRoot = $PSScriptRoot

if (-not (Test-Path $ScriptsDir)) {
    New-Item -ItemType Directory -Force -Path $ScriptsDir | Out-Null
}

Write-Host "[1/3] Copying HUD engine and Web GUI scripts..." -ForegroundColor Yellow
Copy-Item (Join-Path $RepoRoot "bin\hud.js") (Join-Path $ScriptsDir "hud.js") -Force
Copy-Item (Join-Path $RepoRoot "web\hud_gui.html") (Join-Path $ScriptsDir "hud_gui.html") -Force
Write-Host "  ✔ Copied hud.js & hud_gui.html to $ScriptsDir" -ForegroundColor Green

Write-Host "[2/3] Configuring Antigravity settings..." -ForegroundColor Yellow
$SettingsCandidates = @(
    (Join-Path $GeminiDir "antigravity-cli\settings.json"),
    (Join-Path $GeminiDir "settings.json")
)

$ConfiguredCount = 0
foreach ($SettingsFile in $SettingsCandidates) {
    if (Test-Path $SettingsFile) {
        try {
            $Content = Get-Content $SettingsFile -Raw -Encoding UTF8
            $Settings = $Content | ConvertFrom-Json
            
            if (-not $Settings.statusLine) {
                $Settings | Add-Member -MemberType NoteProperty -Name "statusLine" -Value ([PSCustomObject]@{}) -Force
            }

            $ScriptPath = Join-Path $ScriptsDir "hud.js"
            $NormalizedScriptPath = $ScriptPath.Replace('\', '/')
            $CommandString = "node `"$NormalizedScriptPath`""

            $Settings.statusLine.command = $CommandString
            $Settings.statusLine.interval_seconds = 1
            $Settings.statusLine.interval = 1
            $Settings.statusLine.interval_ms = 1000

            $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($SettingsFile, ($Settings | ConvertTo-Json -Depth 20), $Utf8NoBom)
            Write-Host "  ✔ Updated statusLine hook in: $SettingsFile" -ForegroundColor Green
            $ConfiguredCount++
        } catch {
            Write-Warning "Failed to update $SettingsFile`: $_"
        }
    }
}

Write-Host "[3/3] Verifying installation..." -ForegroundColor Yellow
try {
    $TestOutput = & node (Join-Path $ScriptsDir "hud.js") list
    Write-Host "  ✔ Antigravity HUD CLI is functional and ready!" -ForegroundColor Green
} catch {
    Write-Warning "Could not verify CLI execution: $_"
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "✔ Antigravity HUD installation completed successfully! " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Quick Tips:"
Write-Host "  • Run `node ~/.gemini/scripts/hud.js gui` or `hud gui` to open the Drag-and-Drop Editor"
Write-Host "  • Run `hud lines 3` to configure a 3-line layout"
Write-Host "  • Run `hud style context short` to compress context badges"
Write-Host "  • Run `hud help` for full CLI commands reference"
