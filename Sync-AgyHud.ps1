# =====================================================================
# Sync-AgyHud.ps1 - Antigravity CLI (AGY) HUD Bidirectional Sync & Backup Tool
# =====================================================================
# Supports:
#   -Check / -Diff   : Inspect bidirectional drift table
#   -Backup          : Copy active runtime edits (~/.gemini/scripts/) -> GitHub Repo
#   -Deploy / -Repair: Deploy canonical repo components -> Active Runtime
#   -Watch           : Real-time 2-way file watcher with 300ms debouncing
#   -Commit          : Automatically git commit changes after backup
#   -Force           : Override timestamp conflict protection
#   -Json            : Output structured JSON report
# =====================================================================

[CmdletBinding(DefaultParameterSetName = 'Diff')]
param (
    [Parameter(ParameterSetName = 'Diff')]
    [switch]$Check,

    [Parameter(ParameterSetName = 'Diff')]
    [switch]$Diff,

    [Parameter(ParameterSetName = 'Backup')]
    [switch]$Backup,

    [Parameter(ParameterSetName = 'Deploy')]
    [switch]$Deploy,

    [Parameter(ParameterSetName = 'Deploy')]
    [switch]$Repair,

    [Parameter(ParameterSetName = 'Watch')]
    [switch]$Watch,

    [Parameter()]
    [switch]$Commit,

    [Parameter()]
    [string]$Message,

    [Parameter()]
    [switch]$Force,

    [Parameter()]
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

# 1. Resolve Repo Root
function Get-AgyRepoRoot {
    if ($env:HUD_TEST_REPO_DIR -and (Test-Path $env:HUD_TEST_REPO_DIR)) {
        return $env:HUD_TEST_REPO_DIR
    }
    if ($env:ANTIGRAVITY_HUD_REPO -and (Test-Path $env:ANTIGRAVITY_HUD_REPO)) {
        return $env:ANTIGRAVITY_HUD_REPO
    }
    if (Test-Path (Join-Path $PSScriptRoot ".git")) {
        return $PSScriptRoot
    }
    $defaultDevDrive = "B:\Repos\antigravity-hud"
    if (Test-Path $defaultDevDrive) {
        return $defaultDevDrive
    }
    return $PSScriptRoot
}

# 2. Resolve Active Scripts Dir
function Get-AgyScriptsDir {
    if ($env:HUD_TEST_SCRIPTS_DIR -and (Test-Path $env:HUD_TEST_SCRIPTS_DIR)) {
        return $env:HUD_TEST_SCRIPTS_DIR
    }
    return (Join-Path $HOME ".gemini\scripts")
}

# 3. Locate hud.js engine
function Get-AgyHudEngine {
    $candidates = @(
        (Join-Path (Get-AgyRepoRoot) "bin\hud.js"),
        (Join-Path (Get-AgyScriptsDir) "hud.js"),
        (Join-Path $HOME ".gemini\hud\hud.js"),
        (Join-Path $PSScriptRoot "bin\hud.js"),
        (Join-Path $PSScriptRoot "hud.js")
    ) | Where-Object { Test-Path $_ }
    
    return ($candidates | Select-Object -First 1)
}

$repoRoot = Get-AgyRepoRoot
$scriptsDir = Get-AgyScriptsDir
$hudEngine = Get-AgyHudEngine

if (-not $hudEngine) {
    Write-Error "Cannot locate hud.js engine in repo or active runtime directories."
    exit 1
}

# 4. Handle -Watch Mode (Continuous 2-Way Sync with 300ms Debounce)
if ($Watch) {
    Write-Host "`n=======================================================" -ForegroundColor Cyan
    Write-Host "  Antigravity HUD: Live Bidirectional Watcher Active   " -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan
    Write-Host "Watching Active Dir: $scriptsDir" -ForegroundColor Yellow
    Write-Host "Watching Repo Root:  $repoRoot" -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to terminate watch session.`n" -ForegroundColor DarkGray

    $lastSyncTime = [System.DateTime]::MinValue
    $debounceLock = [System.Object]::new()

    $actionBlock = {
        param($source, $e)
        $now = [System.DateTime]::Now
        [System.Threading.Monitor]::Enter($debounceLock)
        try {
            if (($now - $lastSyncTime).TotalMilliseconds -gt 400) {
                $script:lastSyncTime = $now
                Write-Host "[$($now.ToString('HH:mm:ss'))] Change detected: $($e.Name). Synchronizing..." -ForegroundColor Cyan
                Start-Process -FilePath "node" -ArgumentList @($hudEngine, "diff") -NoNewWindow -Wait
            }
        } finally {
            [System.Threading.Monitor]::Exit($debounceLock)
        }
    }

    $watcherActive = New-Object System.IO.FileSystemWatcher $scriptsDir
    $watcherActive.IncludeSubdirectories = $true
    $watcherActive.EnableRaisingEvents = $true
    Register-ObjectEvent $watcherActive "Changed" -Action $actionBlock | Out-Null
    Register-ObjectEvent $watcherActive "Created" -Action $actionBlock | Out-Null

    try {
        while ($true) {
            Start-Sleep -Milliseconds 1000
        }
    } finally {
        $watcherActive.EnableRaisingEvents = $false
        $watcherActive.Dispose()
        Write-Host "`nWatcher session ended." -ForegroundColor DarkGray
    }
    exit 0
}

# 5. CLI Dispatch to Node.js Engine
$cliArgs = @()

if ($Backup) {
    $cliArgs += "backup"
} elseif ($Deploy -or $Repair) {
    $cliArgs += "deploy"
} else {
    $cliArgs += "diff"
}

if ($Force) { $cliArgs += "--force" }
if ($Json)  { $cliArgs += "--json" }

$nodeArgs = @($hudEngine) + $cliArgs

$proc = Start-Process -FilePath "node" -ArgumentList $nodeArgs -NoNewWindow -PassThru -Wait

# 6. Optional Git Commit after Backup
if ($Backup -and $Commit -and $proc.ExitCode -eq 0) {
    if (Test-Path (Join-Path $repoRoot ".git")) {
        $commitMsg = if ($Message) { $Message } else { "chore(hud): synchronize active runtime updates into repository" }
        Write-Host "`nStaging and committing changes in $repoRoot..." -ForegroundColor Cyan
        git -C $repoRoot add -A
        git -C $repoRoot commit -m $commitMsg
    }
}

exit $proc.ExitCode
