# =====================================================================
# Sync-AgyHud.ps1 - Antigravity CLI (AGY) Statusline HUD Synchronization & Self-Healing Tool
# =====================================================================

[CmdletBinding()]
param (
    [switch]$Check,
    [switch]$Repair,
    [switch]$Force,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$hudEnginePath = Join-Path $repoRoot "bin\hud.js"

if (-not (Test-Path $hudEnginePath)) {
    Write-Error "Cannot locate canonical hud.js at: $hudEnginePath"
    exit 1
}

$cliArgs = @()
if ($Repair -or $Force) {
    $cliArgs += "repair"
} else {
    $cliArgs += "check"
}

if ($Json) {
    $cliArgs += "--json"
}

$nodeArgs = @($hudEnginePath) + $cliArgs

try {
    $proc = Start-Process -FilePath "node" -ArgumentList $nodeArgs -NoNewWindow -PassThru -Wait
    exit $proc.ExitCode
} catch {
    Write-Error "Failed to execute HUD synchronization check: $_"
    exit 1
}
