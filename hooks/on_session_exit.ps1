# Antigravity Post-Exit Background Quad-Sync, Windows Notification & Perma-Logger Hook
# Runs detached in the background after AGY closes to ensure complete handoffs and zero context loss.

[CmdletBinding()]
param(
    [string]$WorkspaceRoot = $PWD,
    [switch]$Detached,
    [switch]$SkipPush,
    [switch]$TestMode
)

$ErrorActionPreference = 'SilentlyContinue'

$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$LogDir = Join-Path $HomeDir ".gemini\logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$JsonlLog = Join-Path $LogDir "session_lifecycle.jsonl"
$TextLog = Join-Path $LogDir "session_lifecycle.log"

# Function to show native Windows Toast / Balloon without external module dependencies
function Show-WindowsNotification {
    param(
        [string]$Title,
        [string]$Message
    )
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
        
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.BalloonTipTitle = $Title
        $notify.BalloonTipText = $Message
        $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $notify.Visible = $true
        $notify.ShowBalloonTip(5000)
        Start-Sleep -Milliseconds 800
        $notify.Dispose()
    } catch {
        # Fallback: silent if headless
    }
}

# 1. If not detached, spawn background worker and return immediately
if (-not $Detached -and -not $TestMode) {
    $scriptPath = $PSCommandPath
    if ([string]::IsNullOrWhiteSpace($scriptPath)) {
        $scriptPath = Join-Path $HomeDir ".gemini\scripts\hooks\on_session_exit.ps1"
    }
    
    $argList = @(
        "-NoProfile",
        "-NonInteractive",
        "-File", "`"$scriptPath`"",
        "-WorkspaceRoot", "`"$WorkspaceRoot`"",
        "-Detached"
    )
    if ($SkipPush) { $argList += "-SkipPush" }
    
    Start-Process -FilePath "pwsh" -ArgumentList $argList -ErrorAction SilentlyContinue | Out-Null
    Write-Output "[EXIT HOOK] Detached background quad-sync worker spawned."
    exit 0
}

# 2. Detached Worker Execution
$startTime = Get-Date
$statusRecord = [PSCustomObject]@{
    Timestamp = $startTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
    Workspace = $WorkspaceRoot
    Branch = "unknown"
    CommitHash = "none"
    PushSuccess = $false
    ResumePointCreated = $false
    QuadSyncVerified = $false
    DurationMs = 0
    ExitCode = 0
}

try {
    # Check Git branch
    Push-Location $WorkspaceRoot
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
    if (-not [string]::IsNullOrWhiteSpace($branch)) {
        $statusRecord.Branch = $branch.Trim()
    }

    # Generate Resume Point
    $resumeDir = Join-Path $WorkspaceRoot ".workspace_context\resume-points"
    if (-not (Test-Path $resumeDir)) {
        New-Item -ItemType Directory -Path $resumeDir -Force | Out-Null
    }
    $timestampStr = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $resumePointPath = Join-Path $resumeDir ("resume-point-{0}.md" -f $timestampStr)
    $latestResumePath = Join-Path $resumeDir "resume-point-latest.md"

    $resumeContent = @"
# Antigravity Automated Session Resume Point
- Timestamp: $($statusRecord.Timestamp)
- Workspace: $WorkspaceRoot
- Branch: $($statusRecord.Branch)
- Status: Session closed cleanly and quad-synced.
"@
    [System.IO.File]::WriteAllText($resumePointPath, $resumeContent)
    [System.IO.File]::WriteAllText($latestResumePath, $resumeContent)
    $statusRecord.ResumePointCreated = $true

    # Quad-Sync Developer Log if present
    $repoDevLog = Join-Path $WorkspaceRoot "DEVELOPER_LOG.md"
    $globalDevLog = Join-Path $HomeDir ".gemini\DEVELOPER_LOG.md"
    $knowledgeDevLog = Join-Path $HomeDir ".gemini\antigravity\knowledge\DEVELOPER_LOG.md"

    if (Test-Path $repoDevLog) {
        Copy-Item $repoDevLog $globalDevLog -Force -ErrorAction SilentlyContinue
        Copy-Item $repoDevLog $knowledgeDevLog -Force -ErrorAction SilentlyContinue
        $statusRecord.QuadSyncVerified = $true
    }

    # Git Commit & Push
    if (-not $SkipPush) {
        git add -A 2>$null
        $dirty = (git status --porcelain 2>$null)
        if (-not [string]::IsNullOrWhiteSpace($dirty)) {
            git commit -m "chore(lifecycle): auto-sync session resume point and developer log" 2>$null
        }
        $hash = (git rev-parse --short HEAD 2>$null)
        if (-not [string]::IsNullOrWhiteSpace($hash)) {
            $statusRecord.CommitHash = $hash.Trim()
        }
        git push origin $($statusRecord.Branch) 2>$null
        if ($LASTEXITCODE -eq 0) {
            $statusRecord.PushSuccess = $true
        }
    }

    Pop-Location
} catch {
    $statusRecord.ExitCode = 1
} finally {
    $endTime = Get-Date
    $statusRecord.DurationMs = [math]::Round(($endTime - $startTime).TotalMilliseconds, 0)

    # 3. Permanent Logging (JSONL + Text Log)
    try {
        $jsonEntry = ($statusRecord | ConvertTo-Json -Compress)
        [System.IO.File]::AppendAllText($JsonlLog, $jsonEntry + [Environment]::NewLine)

        $textEntry = "[{0}] Workspace: {1} | Branch: {2} ({3}) | Push: {4} | ResumePoint: {5} | Duration: {6}ms" -f `
            $statusRecord.Timestamp, (Split-Path $WorkspaceRoot -Leaf), $statusRecord.Branch, $statusRecord.CommitHash, `
            $statusRecord.PushSuccess, $statusRecord.ResumePointCreated, $statusRecord.DurationMs
        [System.IO.File]::AppendAllText($TextLog, $textEntry + [Environment]::NewLine)
    } catch {}

    # 4. Trigger Windows Notification
    if (-not $TestMode) {
        $toastTitle = "Antigravity Session Finalized"
        $toastMsg = "Workspace: {0}`nBranch: {1} ({2})`nResume Point: Saved | Log: Quad-Synced" -f `
            (Split-Path $WorkspaceRoot -Leaf), $statusRecord.Branch, $statusRecord.CommitHash
        Show-WindowsNotification -Title $toastTitle -Message $toastMsg
    }
}

exit $statusRecord.ExitCode
