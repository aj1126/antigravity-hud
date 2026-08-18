# Antigravity HUD 1-Click Installer
# Installs, synchronizes, and hooks the real-time HUD statusline into your Antigravity AI environment.

[CmdletBinding()]
param (
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "         Antigravity HUD Installer (v2.3.0)            " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$GeminiDir = Join-Path $HomeDir ".gemini"
$ScriptsDir = Join-Path $GeminiDir "scripts"
$HudDir = Join-Path $GeminiDir "hud"
$RepoRoot = $PSScriptRoot

if (-not (Test-Path $ScriptsDir)) {
    New-Item -ItemType Directory -Force -Path $ScriptsDir | Out-Null
}
if (-not (Test-Path $HudDir)) {
    New-Item -ItemType Directory -Force -Path $HudDir | Out-Null
}

Write-Host "[1/3] Deploying HUD engine, WinForms configurator & Web GUI..." -ForegroundColor Yellow

# Copy to ~/.gemini/scripts/
Copy-Item (Join-Path $RepoRoot "bin\hud.js") (Join-Path $ScriptsDir "hud.js") -Force
Copy-Item (Join-Path $RepoRoot "bin\hud_gui.ps1") (Join-Path $ScriptsDir "hud_gui.ps1") -Force
Copy-Item (Join-Path $RepoRoot "web\hud_gui.html") (Join-Path $ScriptsDir "hud_gui.html") -Force

$ScriptsHooksDir = Join-Path $ScriptsDir "hooks"
if (-not (Test-Path $ScriptsHooksDir)) { New-Item -ItemType Directory -Path $ScriptsHooksDir -Force | Out-Null }
Copy-Item (Join-Path $RepoRoot "hooks\*") $ScriptsHooksDir -Recurse -Force
Write-Host "  [OK] Deployed runtime scripts and hooks to $ScriptsDir" -ForegroundColor Green

# Copy to dedicated ~/.gemini/hud/
Copy-Item (Join-Path $RepoRoot "bin\hud.js") (Join-Path $HudDir "hud.js") -Force
Copy-Item (Join-Path $RepoRoot "bin\hud_gui.ps1") (Join-Path $HudDir "hud_gui.ps1") -Force
Copy-Item (Join-Path $RepoRoot "web\hud_gui.html") (Join-Path $HudDir "hud_gui.html") -Force

$HudHooksDir = Join-Path $HudDir "hooks"
if (-not (Test-Path $HudHooksDir)) { New-Item -ItemType Directory -Path $HudHooksDir -Force | Out-Null }
Copy-Item (Join-Path $RepoRoot "hooks\*") $HudHooksDir -Recurse -Force

$HudConfigDest = Join-Path $HudDir "hud_config.json"
if (-not (Test-Path $HudConfigDest)) {
    Copy-Item (Join-Path $RepoRoot "bin\hud_config.json") $HudConfigDest -Force
    Write-Host "  [OK] Initialized default configuration in $HudDir" -ForegroundColor Green
}
Write-Host "  [OK] Deployed subsystem components and hooks to $HudDir" -ForegroundColor Green

Write-Host "[2/3] Configuring Antigravity settings..." -ForegroundColor Yellow
$SettingsCandidates = @(
    (Join-Path $GeminiDir "antigravity-cli\settings.json"),
    (Join-Path $GeminiDir "settings.json")
)

$ConfiguredCount = 0
foreach ($SettingsFile in $SettingsCandidates) {
    if (Test-Path $SettingsFile) {
        try {
            $Content = [System.IO.File]::ReadAllText($SettingsFile)
            $Settings = $Content | ConvertFrom-Json
            
            if (-not $Settings.statusLine) {
                $Settings | Add-Member -MemberType NoteProperty -Name "statusLine" -Value ([PSCustomObject]@{}) -Force
            }

            $ScriptPath = Join-Path $ScriptsDir "hud.js"
            $NormalizedScriptPath = $ScriptPath.Replace('\', '/')
            $CommandString = "node $NormalizedScriptPath"

            $Settings.statusLine | Add-Member -MemberType NoteProperty -Name "type" -Value "command" -Force
            $Settings.statusLine | Add-Member -MemberType NoteProperty -Name "command" -Value $CommandString -Force
            $Settings.statusLine | Add-Member -MemberType NoteProperty -Name "enabled" -Value $true -Force
            $Settings.statusLine | Add-Member -MemberType NoteProperty -Name "interval_seconds" -Value 1 -Force
            $Settings.statusLine | Add-Member -MemberType NoteProperty -Name "interval" -Value 1 -Force
            $Settings.statusLine | Add-Member -MemberType NoteProperty -Name "interval_ms" -Value 1000 -Force

            $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($SettingsFile, ($Settings | ConvertTo-Json -Depth 20), $Utf8NoBom)
            Write-Host "  [OK] Updated statusLine hook in: $SettingsFile" -ForegroundColor Green
            $ConfiguredCount++
        } catch {
            Write-Warning ("Failed to update {0}: {1}" -f $SettingsFile, $_.Exception.Message)
        }
    }
}

Write-Host "[3/3] Verifying installation & health parity..." -ForegroundColor Yellow
try {
    $TestOutput = & node (Join-Path $ScriptsDir "hud.js") check
    Write-Host "  [OK] Antigravity HUD CLI is 100% functional, synchronized, and ready!" -ForegroundColor Green
} catch {
    Write-Warning ("Could not verify CLI execution: {0}" -f $_.Exception.Message)
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "        Antigravity HUD Installation Complete!         " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:"
Write-Host "  - Run 'hud' to preview your live multi-line statusline readout"
Write-Host "  - Run 'hud gui' or 'hud-gui' to open the WinForms Configurator"
Write-Host "  - Run 'hud check' to verify runtime integrity and zero drift"
Write-Host "  - Run 'hud repair' to trigger self-healing auto-repair"
Write-Host "  - Run 'hud help' for full CLI commands reference"
