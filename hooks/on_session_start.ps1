# Antigravity Session Start Hook: Pre-Flight Health & Cognitive Resume Point Loader
# Executes silently on session initialization with zero cloud token overhead.

[CmdletBinding()]
param(
    [string]$WorkspaceRoot = $PWD
)

$ErrorActionPreference = 'SilentlyContinue'

$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$HudScript = Join-Path $HomeDir ".gemini\scripts\hud.js"

$Results = @{
    Timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    Workspace = $WorkspaceRoot
    HudHealthy = $false
    GitBranch = "unknown"
    GitClean = $true
    ResumePointFound = $false
    ResumePointPath = ""
}

# 1. Quick HUD Health Check
if (Test-Path $HudScript) {
    try {
        $checkOut = & node $HudScript check 2>$null
        if ($LASTEXITCODE -eq 0) {
            $Results.HudHealthy = $true
        }
    } catch {}
}

# 2. Git Status Check
try {
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    if (-not [string]::IsNullOrWhiteSpace($branch)) {
        $Results.GitBranch = $branch
        $dirty = (git status --porcelain 2>$null)
        $Results.GitClean = [string]::IsNullOrWhiteSpace($dirty)
    }
} catch {}

# 3. Locate Latest Resume Point
$resumePointCandidates = @(
    (Join-Path $WorkspaceRoot ".workspace_context\resume-points\resume-point-latest.md"),
    (Join-Path $WorkspaceRoot ".agents\plans\resume-point-latest.md"),
    (Join-Path $HomeDir ".gemini\antigravity\knowledge\DEVELOPER_LOG.md")
)

foreach ($cand in $resumePointCandidates) {
    if (Test-Path $cand) {
        $Results.ResumePointFound = $true
        $Results.ResumePointPath = $cand
        break
    }
}

# Output minimal summary for logging / terminal inspection
if ($Results.ResumePointFound) {
    Write-Output ("[PRE-FLIGHT] Workspace: {0} | Branch: {1} | Resume Point: {2}" -f (Split-Path $WorkspaceRoot -Leaf), $Results.GitBranch, (Split-Path $Results.ResumePointPath -Leaf))
} else {
    Write-Output ("[PRE-FLIGHT] Workspace: {0} | Branch: {1} | Clean: {2}" -f (Split-Path $WorkspaceRoot -Leaf), $Results.GitBranch, $Results.GitClean)
}

exit 0
