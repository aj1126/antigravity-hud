# =====================================================================
# hud_gui.ps1 -- Native Lightweight Windows GUI for HUD Configuration
# =====================================================================
# v2.0: Multi-line (1-4), text condensing (compact_mode + per-item
# item_styles), non-destructive JSON persistence, fork advisory item,
# dynamic compact-mode live preview.
# =====================================================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$configCandidates = @(
    $env:HUD_CONFIG_PATH,
    (Join-Path $HOME ".gemini\scripts\hud_config.json"),
    (Join-Path $HOME ".gemini\hud\hud_config.json"),
    (Join-Path $HOME ".gemini\hud_config.json"),
    (Join-Path $PSScriptRoot "hud_config.json"),
    (Join-Path $PSScriptRoot "..\hud_config.json")
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$configPath = $configCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $configPath) {
    $configPath = Join-Path $HOME ".gemini\scripts\hud_config.json"
}

# -----------------------------------------------------------------------
# Default config (matches hud.js DEFAULT_CONFIG)
# -----------------------------------------------------------------------
$defaultConfig = @{
    lines          = 2
    two_line       = $true
    separator      = [char]0x2502  # U+2502 BOX DRAWINGS LIGHT VERTICAL
    compact_mode   = 'auto'
    line1          = [System.Collections.Generic.List[string]]::new([string[]]@('workspace', 'git_status', 'model', 'state', 'auth', 'sandbox', 'session'))
    line2          = [System.Collections.Generic.List[string]]::new([string[]]@('context', 'fork', 'quota_5h', 'quota_weekly', 'mcp', 'subagents', 'tasks', 'artifacts', 'queue'))
    line3          = [System.Collections.Generic.List[string]]::new()
    line4          = [System.Collections.Generic.List[string]]::new()
    disabled       = [System.Collections.Generic.List[string]]::new()
    item_styles    = @{}
    session_uptime = @{ show_seconds = $true }
    fork_advisory  = @{ enabled = $true; require_clean_git = $true; warning_percent = 60; alert_percent = 75; critical_percent = 90; step_warning = 300; step_alert = 500; step_critical = 800 }
}

# -----------------------------------------------------------------------
# Item metadata: key -> display label
# -----------------------------------------------------------------------
$itemMeta = [ordered]@{
    'workspace'    = 'Workspace & Git Branch'
    'git_status'   = 'Git Clean / Dirty'
    'model'        = 'Model & Reasoning Effort'
    'state'        = 'Agent Lifecycle State'
    'auth'         = 'Auth Provider Badge'
    'sandbox'      = 'Sandbox Mode Indicator'
    'session'      = 'Session Uptime Duration'
    'context'      = 'Context Window & Cache Hit'
    'fork'         = 'Fork Advisory Milestone'
    'quota_5h'     = '5-Hour Quota & Reset'
    'quota_weekly' = 'Weekly Quota Reserve'
    'mcp'          = 'Registered MCP Servers'
    'subagents'    = 'Active Subagents Count'
    'tasks'        = 'Background Tasks'
    'artifacts'    = 'Generated Artifacts Count'
    'queue'        = 'Queued Input Messages'
}

# Preview text per item per compact mode (full / short / minimal)
$previewText = @{
    'workspace'    = @{ full = 'PowerShell (branch: preview *)'; short = 'PowerShell (preview *)'; minimal = 'PS' }
    'git_status'   = @{ full = 'Git: Clean'; short = 'Clean'; minimal = 'OK' }
    'model'        = @{ full = 'Gemini 3.7 Flash [HIGH]'; short = 'Flash [HI]'; minimal = 'F-HI' }
    'state'        = @{ full = '[IDLE]'; short = 'IDLE'; minimal = 'IDL' }
    'auth'         = @{ full = 'Auth: API-Key'; short = 'API-Key'; minimal = 'KEY' }
    'sandbox'      = @{ full = 'Sandbox: ON'; short = 'SBX'; minimal = 'SB' }
    'session'      = @{ full = '24m 15s'; short = '24m'; minimal = '24m' }
    'context'      = @{ full = 'Ctx: 14% (143k) Cache: 91%'; short = '14% (91%C)'; minimal = '14%' }
    'fork'         = @{ full = 'Fork @ 60%'; short = 'Fork: 60%'; minimal = 'F60' }
    'quota_5h'     = @{ full = 'Quota: 56% (reset 2h 23m)'; short = '56% 2h23m'; minimal = '56%' }
    'quota_weekly' = @{ full = 'Weekly: 80%'; short = 'Wk: 80%'; minimal = '80%' }
    'mcp'          = @{ full = '14 MCP Servers'; short = '14 MCP'; minimal = '14M' }
    'subagents'    = @{ full = '1 subagent'; short = '1 sub'; minimal = '1S' }
    'tasks'        = @{ full = '1 task running'; short = '1 task'; minimal = '1T' }
    'artifacts'    = @{ full = '8 artifacts'; short = '8 art'; minimal = '8A' }
    'queue'        = @{ full = '1 queued'; short = '1 Q'; minimal = '1Q' }
}

# -----------------------------------------------------------------------
# Load / parse config (non-destructive -- preserves all unknown keys)
# -----------------------------------------------------------------------
$rawJson = $null  # stores original parsed object for non-destructive save
$cfg = @{
    lines          = $defaultConfig.lines
    two_line       = $defaultConfig.two_line
    separator      = $defaultConfig.separator
    compact_mode   = $defaultConfig.compact_mode
    line1          = [System.Collections.Generic.List[string]]::new($defaultConfig.line1)
    line2          = [System.Collections.Generic.List[string]]::new($defaultConfig.line2)
    line3          = [System.Collections.Generic.List[string]]::new($defaultConfig.line3)
    line4          = [System.Collections.Generic.List[string]]::new($defaultConfig.line4)
    disabled       = [System.Collections.Generic.List[string]]::new($defaultConfig.disabled)
    item_styles    = @{}
    session_uptime = $defaultConfig.session_uptime.Clone()
    fork_advisory  = $defaultConfig.fork_advisory.Clone()
}

if (Test-Path $configPath) {
    try {
        $rawJson = Get-Content -Path $configPath -Raw -Encoding utf8 | ConvertFrom-Json
        $lineCount = if ($null -ne $rawJson.lines -and $rawJson.lines -ge 1 -and $rawJson.lines -le 4) { [int]$rawJson.lines }
                     elseif ($rawJson.two_line -eq $false) { 1 }
                     else { 2 }

        $cfg.lines        = $lineCount
        $cfg.two_line     = $lineCount -ge 2
        $cfg.separator    = if ($rawJson.separator) { [string]$rawJson.separator } else { $defaultConfig.separator }
        $cfg.compact_mode = if ($rawJson.compact_mode) { [string]$rawJson.compact_mode } else { 'auto' }

        foreach ($ln in @('line1','line2','line3','line4','disabled')) {
            $arr = $rawJson.$ln
            if ($null -ne $arr) {
                $cfg[$ln] = [System.Collections.Generic.List[string]]::new([string[]]$arr)
            }
        }

        # item_styles hashtable
        if ($null -ne $rawJson.item_styles) {
            $rawJson.item_styles.PSObject.Properties | ForEach-Object {
                $cfg.item_styles[$_.Name] = [string]$_.Value
            }
        }

        # session_uptime
        if ($null -ne $rawJson.session_uptime) {
            $cfg.session_uptime = @{
                show_seconds = if ($null -ne $rawJson.session_uptime.show_seconds) { [bool]$rawJson.session_uptime.show_seconds } else { $true }
            }
        }

        # fork_advisory
        if ($null -ne $rawJson.fork_advisory) {
            $fa = $rawJson.fork_advisory
            $cfg.fork_advisory = @{
                enabled          = if ($null -ne $fa.enabled) { [bool]$fa.enabled } else { $true }
                require_clean_git = if ($null -ne $fa.require_clean_git) { [bool]$fa.require_clean_git } else { $true }
                warning_percent  = if ($null -ne $fa.warning_percent) { [int]$fa.warning_percent } else { 60 }
                alert_percent    = if ($null -ne $fa.alert_percent) { [int]$fa.alert_percent } else { 75 }
                critical_percent = if ($null -ne $fa.critical_percent) { [int]$fa.critical_percent } else { 90 }
                step_warning     = if ($null -ne $fa.step_warning) { [int]$fa.step_warning } else { 300 }
                step_alert       = if ($null -ne $fa.step_alert) { [int]$fa.step_alert } else { 500 }
                step_critical    = if ($null -ne $fa.step_critical) { [int]$fa.step_critical } else { 800 }
            }
        }
    } catch {}
}

# -----------------------------------------------------------------------
# Resolve effective compact mode for preview
# -----------------------------------------------------------------------
function Get-EffectiveMode([string]$itemKey) {
    if ($cfg.item_styles.ContainsKey($itemKey) -and $cfg.item_styles[$itemKey] -ne 'auto') {
        return $cfg.item_styles[$itemKey]
    }
    $gm = $cfg.compact_mode
    if ($gm -in @('full','short','minimal')) { return $gm }
    return 'full'  # auto defaults to full in preview
}

# -----------------------------------------------------------------------
# Colors
# -----------------------------------------------------------------------
$clrBg        = [System.Drawing.Color]::FromArgb(18, 20, 30)
$clrBgPanel   = [System.Drawing.Color]::FromArgb(24, 26, 38)
$clrBgCard    = [System.Drawing.Color]::FromArgb(32, 36, 54)
$clrBgInput   = [System.Drawing.Color]::FromArgb(28, 32, 46)
$clrFg        = [System.Drawing.Color]::FromArgb(220, 225, 245)
$clrMuted     = [System.Drawing.Color]::FromArgb(108, 115, 148)
$clrBlue      = [System.Drawing.Color]::FromArgb(122, 162, 247)
$clrPurple    = [System.Drawing.Color]::FromArgb(187, 154, 247)
$clrCyan      = [System.Drawing.Color]::FromArgb(125, 207, 255)
$clrGreen     = [System.Drawing.Color]::FromArgb(158, 206, 106)
$clrRed       = [System.Drawing.Color]::FromArgb(247, 118, 142)
$clrYellow    = [System.Drawing.Color]::FromArgb(224, 175, 104)
$clrBorder    = [System.Drawing.Color]::FromArgb(50, 56, 82)
$clrBtnHover  = [System.Drawing.Color]::FromArgb(45, 52, 78)

$fontUI      = New-Object System.Drawing.Font('Segoe UI', 9.5)
$fontBold    = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$fontSmall   = New-Object System.Drawing.Font('Segoe UI', 8.5)
$fontMono    = New-Object System.Drawing.Font('Consolas', 9, [System.Drawing.FontStyle]::Bold)
$fontPreview = New-Object System.Drawing.Font('Cascadia Code', 9)
try { $fontPreview = New-Object System.Drawing.Font('Cascadia Code', 9) } catch { $fontPreview = $fontMono }

# -----------------------------------------------------------------------
# Helper: create styled button
# -----------------------------------------------------------------------
function New-StyledButton([string]$text, [int]$x, [int]$y, [int]$w, [int]$h, [System.Drawing.Color]$bg, [System.Drawing.Color]$fg) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text      = $text
    $btn.Location  = New-Object System.Drawing.Point($x, $y)
    $btn.Size      = New-Object System.Drawing.Size($w, $h)
    $btn.BackColor = $bg
    $btn.ForeColor = $fg
    $btn.FlatStyle = 'Flat'
    $btn.FlatAppearance.BorderColor = $clrBorder
    $btn.FlatAppearance.BorderSize  = 1
    $btn.Font      = $fontUI
    $btn.Cursor    = [System.Windows.Forms.Cursors]::Hand
    return $btn
}

function New-StyledLabel([string]$text, [int]$x, [int]$y, [int]$w, [int]$h, [System.Drawing.Color]$fg, [System.Drawing.Font]$fnt) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text      = $text
    $lbl.Location  = New-Object System.Drawing.Point($x, $y)
    $lbl.Size      = New-Object System.Drawing.Size($w, $h)
    $lbl.ForeColor = $fg
    $lbl.Font      = $fnt
    return $lbl
}

# -----------------------------------------------------------------------
# Main Form
# -----------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text            = 'Antigravity CLI (AGY) - Statusline HUD Configurator'
$form.Size            = New-Object System.Drawing.Size(1000, 780)
$form.StartPosition   = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox     = $false
$form.BackColor       = $clrBg
$form.ForeColor       = $clrFg
$form.Font            = $fontUI

# =====================================================================
# SECTION 1: Live Preview Panel (top)
# =====================================================================
$grpPreview = New-Object System.Windows.Forms.GroupBox
$grpPreview.Text      = '  Live AGY Statusline HUD Preview  '
$grpPreview.Location  = New-Object System.Drawing.Point(15, 10)
$grpPreview.Size      = New-Object System.Drawing.Size(960, 130)
$grpPreview.ForeColor = $clrBlue
$grpPreview.BackColor = $clrBgPanel
$form.Controls.Add($grpPreview)

$previewLabels = @()
for ($pi = 0; $pi -lt 4; $pi++) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Location  = New-Object System.Drawing.Point(12, (20 + $pi * 26))
    $lbl.Size      = New-Object System.Drawing.Size(930, 24)
    $lbl.Font      = $fontPreview
    $lbl.ForeColor = switch ($pi) {
        0 { $clrCyan }
        1 { $clrPurple }
        2 { $clrGreen }
        3 { $clrYellow }
    }
    $lbl.BackColor = $clrBgPanel
    $grpPreview.Controls.Add($lbl)
    $previewLabels += $lbl
}

# =====================================================================
# SECTION 2: Global Controls Bar
# =====================================================================
$pnlControls = New-Object System.Windows.Forms.Panel
$pnlControls.Location  = New-Object System.Drawing.Point(15, 148)
$pnlControls.Size      = New-Object System.Drawing.Size(960, 44)
$pnlControls.BackColor = $clrBgPanel
$form.Controls.Add($pnlControls)

# -- Line Count label + combo
$lblLineCount = New-StyledLabel 'Lines:' 8 12 44 20 $clrBlue $fontBold
$pnlControls.Controls.Add($lblLineCount)

$cmbLineCount = New-Object System.Windows.Forms.ComboBox
$cmbLineCount.Location     = New-Object System.Drawing.Point(54, 10)
$cmbLineCount.Size         = New-Object System.Drawing.Size(52, 24)
$cmbLineCount.DropDownStyle = 'DropDownList'
$cmbLineCount.BackColor    = $clrBgInput
$cmbLineCount.ForeColor    = $clrFg
[void]$cmbLineCount.Items.AddRange(@('1','2','3','4'))
$cmbLineCount.SelectedItem = [string]$cfg.lines
$pnlControls.Controls.Add($cmbLineCount)

# -- Compact Mode label + combo
$lblCompact = New-StyledLabel 'Global Text Mode:' 124 12 120 20 $clrBlue $fontBold
$pnlControls.Controls.Add($lblCompact)

$cmbCompact = New-Object System.Windows.Forms.ComboBox
$cmbCompact.Location     = New-Object System.Drawing.Point(248, 10)
$cmbCompact.Size         = New-Object System.Drawing.Size(100, 24)
$cmbCompact.DropDownStyle = 'DropDownList'
$cmbCompact.BackColor    = $clrBgInput
$cmbCompact.ForeColor    = $clrFg
[void]$cmbCompact.Items.AddRange(@('auto','full','short','minimal'))
$cmbCompact.SelectedItem = $cfg.compact_mode
if ($cmbCompact.SelectedIndex -lt 0) { $cmbCompact.SelectedIndex = 0 }
$pnlControls.Controls.Add($cmbCompact)

$lblCompactHint = New-StyledLabel '(auto = adapts to terminal width)' 354 13 230 18 $clrMuted $fontSmall
$pnlControls.Controls.Add($lblCompactHint)

# -- Separator label + combo
$lblSep = New-StyledLabel 'Separator:' 596 12 78 20 $clrBlue $fontBold
$pnlControls.Controls.Add($lblSep)

$cmbSep = New-Object System.Windows.Forms.ComboBox
$cmbSep.Location     = New-Object System.Drawing.Point(676, 10)
$cmbSep.Size         = New-Object System.Drawing.Size(80, 24)
$cmbSep.DropDownStyle = 'DropDownList'
$cmbSep.BackColor    = $clrBgInput
$cmbSep.ForeColor    = $clrFg
$separators = @([char]0x2502, '|', [char]0x2022, [char]0x00B7, '/', '::', [char]0x2014)
foreach ($s in $separators) { [void]$cmbSep.Items.Add($s) }
$cmbSep.SelectedItem = $cfg.separator
if ($cmbSep.SelectedIndex -lt 0) { $cmbSep.SelectedIndex = 0 }
$pnlControls.Controls.Add($cmbSep)

# -- Uptime seconds toggle
$chkUptimeSeconds = New-Object System.Windows.Forms.CheckBox
$chkUptimeSeconds.Text      = 'Session Uptime Seconds'
$chkUptimeSeconds.Location  = New-Object System.Drawing.Point(770, 11)
$chkUptimeSeconds.Size      = New-Object System.Drawing.Size(180, 22)
$chkUptimeSeconds.ForeColor = $clrFg
$chkUptimeSeconds.Checked   = ($cfg.session_uptime.show_seconds -ne $false)
$pnlControls.Controls.Add($chkUptimeSeconds)

# =====================================================================
# SECTION 3: TabControl for Lines 1-4 + Disabled
# =====================================================================
$tabCtrl = New-Object System.Windows.Forms.TabControl
$tabCtrl.Location  = New-Object System.Drawing.Point(15, 200)
$tabCtrl.Size      = New-Object System.Drawing.Size(640, 480)
$tabCtrl.BackColor = $clrBgCard
$tabCtrl.Font      = $fontUI
$form.Controls.Add($tabCtrl)

# Line name/color config
$lineConfigs = @(
    @{ Name = 'Line 1 (Top)';     Key = 'line1'; Color = $clrCyan   }
    @{ Name = 'Line 2';           Key = 'line2'; Color = $clrPurple }
    @{ Name = 'Line 3';           Key = 'line3'; Color = $clrGreen  }
    @{ Name = 'Line 4';           Key = 'line4'; Color = $clrYellow }
)

$lineListBoxes    = @{}
$lineTabs         = @{}
$lineStyleCombos  = @{}

foreach ($lc in $lineConfigs) {
    $tp = New-Object System.Windows.Forms.TabPage
    $tp.Text      = $lc.Name
    $tp.BackColor = $clrBgCard
    $tp.ForeColor = $lc.Color
    $tabCtrl.TabPages.Add($tp)
    $lineTabs[$lc.Key] = $tp

    # List box (HorizontalScrollbar = $false to prevent left clipping auto-scroll)
    $lb = New-Object System.Windows.Forms.ListBox
    $lb.Location            = New-Object System.Drawing.Point(8, 8)
    $lb.Size                = New-Object System.Drawing.Size(360, 390)
    $lb.BackColor           = $clrBgInput
    $lb.ForeColor           = $clrFg
    $lb.BorderStyle         = 'FixedSingle'
    $lb.Font                = $fontUI
    $lb.HorizontalScrollbar = $false
    $lb.Tag                 = $lc.Key
    $tp.Controls.Add($lb)
    $lineListBoxes[$lc.Key] = $lb

    # Move Up
    $btnUp = New-StyledButton 'Up' 380 8 80 30 $clrBgCard $clrFg
    $btnUp.Tag = $lc.Key
    $tp.Controls.Add($btnUp)
    $btnUp.Add_Click({
        $key = $this.Tag
        $lb2 = $lineListBoxes[$key]
        $idx = $lb2.SelectedIndex
        if ($idx -gt 0) {
            $item = $cfg[$key][$idx]
            $cfg[$key].RemoveAt($idx)
            $cfg[$key].Insert($idx - 1, $item)
            Refresh-UI
            $lineListBoxes[$key].SelectedIndex = $idx - 1
        }
    })

    # Move Down
    $btnDn = New-StyledButton 'Down' 380 46 80 30 $clrBgCard $clrFg
    $btnDn.Tag = $lc.Key
    $tp.Controls.Add($btnDn)
    $btnDn.Add_Click({
        $key = $this.Tag
        $lb2 = $lineListBoxes[$key]
        $idx = $lb2.SelectedIndex
        if ($idx -ge 0 -and $idx -lt ($cfg[$key].Count - 1)) {
            $item = $cfg[$key][$idx]
            $cfg[$key].RemoveAt($idx)
            $cfg[$key].Insert($idx + 1, $item)
            Refresh-UI
            $lineListBoxes[$key].SelectedIndex = $idx + 1
        }
    })

    # Disable
    $btnDis = New-StyledButton 'Disable' 380 90 80 30 $clrBgCard $clrRed
    $btnDis.Tag = $lc.Key
    $tp.Controls.Add($btnDis)
    $btnDis.Add_Click({
        $key = $this.Tag
        $idx = $lineListBoxes[$key].SelectedIndex
        if ($idx -ge 0) {
            $itemKey = $cfg[$key][$idx]
            $cfg[$key].RemoveAt($idx)
            if (-not $cfg.disabled.Contains($itemKey)) { $cfg.disabled.Add($itemKey) }
            Refresh-UI
        }
    })

    # Move to Line... label
    $lblMoveTo = New-StyledLabel 'Move to:' 378 134 80 18 $clrMuted $fontSmall
    $tp.Controls.Add($lblMoveTo)

    # Move-to buttons for other lines
    $moveY = 152
    foreach ($dest in $lineConfigs) {
        if ($dest.Key -eq $lc.Key) { continue }
        $destKey  = $dest.Key
        $srcKey   = $lc.Key
        $btnMove  = New-StyledButton $dest.Name 378 $moveY 100 26 $clrBgCard $dest.Color
        $btnMove.Font = $fontSmall
        $btnMove.Tag  = "$srcKey|$destKey"
        $tp.Controls.Add($btnMove)
        $btnMove.Add_Click({
            $parts = $this.Tag -split '\|'
            $sk = $parts[0]; $dk = $parts[1]
            $idx = $lineListBoxes[$sk].SelectedIndex
            if ($idx -ge 0) {
                $itemKey = $cfg[$sk][$idx]
                $cfg[$sk].RemoveAt($idx)
                $cfg[$dk].Add($itemKey)
                Refresh-UI
                $lineListBoxes[$dk].SelectedIndex = $lineListBoxes[$dk].Items.Count - 1
            }
        })
        $moveY += 30
    }

    # Item Style label + combo
    $lblStyle = New-StyledLabel 'Item Style:' 378 310 80 18 $clrBlue $fontSmall
    $tp.Controls.Add($lblStyle)

    $cmbItemStyle = New-Object System.Windows.Forms.ComboBox
    $cmbItemStyle.Location      = New-Object System.Drawing.Point(378, 330)
    $cmbItemStyle.Size          = New-Object System.Drawing.Size(100, 24)
    $cmbItemStyle.DropDownStyle = 'DropDownList'
    $cmbItemStyle.BackColor     = $clrBgInput
    $cmbItemStyle.ForeColor     = $clrFg
    $cmbItemStyle.Font          = $fontSmall
    [void]$cmbItemStyle.Items.AddRange(@('auto','full','short','minimal'))
    $cmbItemStyle.SelectedIndex = 0
    $cmbItemStyle.Tag           = $lc.Key
    $tp.Controls.Add($cmbItemStyle)
    $lineStyleCombos[$lc.Key]   = $cmbItemStyle

    $btnApplyStyle = New-StyledButton 'Apply' 378 360 80 26 $clrBgCard $clrGreen
    $btnApplyStyle.Font = $fontSmall
    $btnApplyStyle.Tag  = $lc.Key
    $tp.Controls.Add($btnApplyStyle)
    $btnApplyStyle.Add_Click({
        $key = $this.Tag
        $lb2 = $lineListBoxes[$key]
        $idx = $lb2.SelectedIndex
        if ($idx -ge 0) {
            $itemKey  = Extract-KeyFromLabel $lb2.SelectedItem
            $cmb      = $lineStyleCombos[$key]
            $styleSel = $cmb.SelectedItem
            if ($styleSel -eq 'auto') {
                $cfg.item_styles.Remove($itemKey)
            } else {
                $cfg.item_styles[$itemKey] = $styleSel
            }
            Refresh-UI
        }
    })

    # Keep cmbItemStyle reference accessible in SelectedIndexChanged via dictionary lookup
    $lb.Add_SelectedIndexChanged([System.EventHandler]{
        param($sender, $e)
        $key = $sender.Tag
        $idx = $sender.SelectedIndex
        if ($idx -ge 0) {
            $itemKey = Extract-KeyFromLabel $sender.SelectedItem
            $cmb = $lineStyleCombos[$key]
            if ($cmb) {
                $existing = if ($cfg.item_styles.ContainsKey($itemKey)) { $cfg.item_styles[$itemKey] } else { 'auto' }
                $cmb.SelectedItem = $existing
            }
        }
    })
}

# -----------------------------------------------------------------------
# Disabled tab
# -----------------------------------------------------------------------
$tpDisabled = New-Object System.Windows.Forms.TabPage
$tpDisabled.Text      = 'Disabled'
$tpDisabled.BackColor = $clrBgCard
$tpDisabled.ForeColor = $clrMuted
$tabCtrl.TabPages.Add($tpDisabled)

$listDisabled = New-Object System.Windows.Forms.ListBox
$listDisabled.Location            = New-Object System.Drawing.Point(8, 8)
$listDisabled.Size                = New-Object System.Drawing.Size(360, 390)
$listDisabled.BackColor           = $clrBgInput
$listDisabled.ForeColor           = $clrMuted
$listDisabled.BorderStyle         = 'FixedSingle'
$listDisabled.HorizontalScrollbar = $false
$tpDisabled.Controls.Add($listDisabled)

$enableBtnY = 8
foreach ($lc in $lineConfigs) {
    $btnEn = New-StyledButton "Enable to $($lc.Name)" 378 $enableBtnY 165 30 $clrBgCard $lc.Color
    $btnEn.Font = $fontSmall
    $btnEn.Tag  = $lc.Key
    $tpDisabled.Controls.Add($btnEn)
    $btnEn.Add_Click({
        $destKey = $this.Tag
        $sel = $listDisabled.SelectedItem
        if ($sel) {
            $itemKey = Extract-KeyFromLabel $sel
            $cfg.disabled.Remove($itemKey)
            if (-not $cfg[$destKey].Contains($itemKey)) {
                $cfg[$destKey].Add($itemKey)
            }
            Refresh-UI
        }
    })
    $enableBtnY += 36
}

# =====================================================================
# SECTION 4: Item Style Inspector (right panel)
# =====================================================================
$grpStyles = New-Object System.Windows.Forms.GroupBox
$grpStyles.Text      = '  AGY Item Style Overrides  '
$grpStyles.Location  = New-Object System.Drawing.Point(665, 200)
$grpStyles.Size      = New-Object System.Drawing.Size(310, 480)
$grpStyles.ForeColor = $clrBlue
$grpStyles.BackColor = $clrBgPanel
$form.Controls.Add($grpStyles)

$lblStylesHint = New-StyledLabel 'Per-item overrides (overrides Global Text Mode):' 10 20 290 18 $clrMuted $fontSmall
$grpStyles.Controls.Add($lblStylesHint)

$listStyles = New-Object System.Windows.Forms.ListBox
$listStyles.Location    = New-Object System.Drawing.Point(10, 42)
$listStyles.Size        = New-Object System.Drawing.Size(288, 300)
$listStyles.BackColor   = $clrBgInput
$listStyles.ForeColor   = $clrFg
$listStyles.BorderStyle = 'FixedSingle'
$listStyles.Font        = $fontSmall
$grpStyles.Controls.Add($listStyles)

$btnClearOneStyle = New-StyledButton 'Clear Selected Override' 10 352 180 28 $clrBgCard $clrYellow
$btnClearOneStyle.Font = $fontSmall
$grpStyles.Controls.Add($btnClearOneStyle)
$btnClearOneStyle.Add_Click({
    $sel = $listStyles.SelectedItem
    if ($sel -and $sel -match '^\s*(.+?)\s*->\s*') {
        $key = $matches[1].Trim()
        $cfg.item_styles.Remove($key)
        Refresh-UI
    }
})

$btnResetAllStyles = New-StyledButton 'Reset All Styles' 10 388 180 28 $clrBgCard $clrRed
$btnResetAllStyles.Font = $fontSmall
$grpStyles.Controls.Add($btnResetAllStyles)
$btnResetAllStyles.Add_Click({
    $cfg.item_styles = @{}
    Refresh-UI
})

$lblStyleNote = New-StyledLabel 'full  = rich detail | short = abbreviated | minimal = icons only' 10 425 290 30 $clrMuted $fontSmall
$lblStyleNote.AutoSize = $false
$grpStyles.Controls.Add($lblStyleNote)

# =====================================================================
# SECTION 5: Bottom Bar (Reset / Save / Cancel)
# =====================================================================
$pnlBottom = New-Object System.Windows.Forms.Panel
$pnlBottom.Location  = New-Object System.Drawing.Point(15, 690)
$pnlBottom.Size      = New-Object System.Drawing.Size(960, 44)
$pnlBottom.BackColor = $clrBgPanel
$form.Controls.Add($pnlBottom)

$btnReset = New-StyledButton 'Reset to Defaults' 0 7 140 30 $clrBgCard $clrMuted
$pnlBottom.Controls.Add($btnReset)

$btnSave = New-StyledButton 'Save & Apply' 700 5 140 34 ([System.Drawing.Color]::FromArgb(36, 130, 150)) ([System.Drawing.Color]::White)
$btnSave.Font = $fontBold
$pnlBottom.Controls.Add($btnSave)

$btnCancel = New-StyledButton 'Cancel' 848 7 110 30 $clrBgCard $clrMuted
$pnlBottom.Controls.Add($btnCancel)

# =====================================================================
# FUNCTIONS: UI Refresh & Utilities
# =====================================================================
function Extract-KeyFromLabel([string]$label) {
    if ($label -match '\(([a-z0-9_]+)\)$') { return $Matches[1] }
    return $label.Trim()
}

function Get-ItemLabel([string]$key) {
    $desc  = if ($itemMeta.Contains($key)) { $itemMeta[$key] } else { $key }
    $style = if ($cfg.item_styles.ContainsKey($key)) { " [$($cfg.item_styles[$key])]" } else { '' }
    return "$desc$style ($key)"
}

function Refresh-UI {
    # Update each line listbox
    foreach ($lc in $lineConfigs) {
        $lb2 = $lineListBoxes[$lc.Key]
        $prev = $lb2.SelectedIndex
        $lb2.BeginUpdate()
        $lb2.Items.Clear()
        foreach ($k in $cfg[$lc.Key]) {
            if (-not $cfg.disabled.Contains($k)) {
                [void]$lb2.Items.Add((Get-ItemLabel $k))
            }
        }
        $lb2.EndUpdate()
        if ($prev -ge 0 -and $prev -lt $lb2.Items.Count) { $lb2.SelectedIndex = $prev }
    }

    # Update disabled listbox: items in disabled list OR not in any line
    $listDisabled.Items.Clear()
    $allKnown    = [System.Collections.Generic.HashSet[string]]::new([string[]]$itemMeta.Keys)
    $inAnyLine   = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($lc in $lineConfigs) {
        foreach ($k in $cfg[$lc.Key]) {
            if (-not $cfg.disabled.Contains($k)) { [void]$inAnyLine.Add($k) }
        }
    }
    # Explicitly disabled items first
    foreach ($k in $cfg.disabled) {
        [void]$listDisabled.Items.Add((Get-ItemLabel $k))
    }
    # Known items not placed in any line and not explicitly disabled
    foreach ($k in $allKnown) {
        if (-not $inAnyLine.Contains($k) -and -not $cfg.disabled.Contains($k)) {
            [void]$listDisabled.Items.Add((Get-ItemLabel $k))
        }
    }

    # Update item_styles inspector panel
    $listStyles.Items.Clear()
    if ($cfg.item_styles.Count -eq 0) {
        [void]$listStyles.Items.Add('(none - all using global mode)')
    } else {
        foreach ($kvp in $cfg.item_styles.GetEnumerator()) {
            [void]$listStyles.Items.Add("$($kvp.Key)  ->  $($kvp.Value)")
        }
    }

    # Sync line count combo
    if ($cmbLineCount.SelectedItem -ne [string]$cfg.lines) {
        $cmbLineCount.SelectedItem = [string]$cfg.lines
    }

    # Update live preview
    Update-Preview
}

function Update-Preview {
    $sep      = " $($cfg.separator) "
    $lineKeys = @('line1','line2','line3','line4')
    $numLines = [int]$cmbLineCount.SelectedItem

    for ($i = 0; $i -lt 4; $i++) {
        $lbl = $previewLabels[$i]
        if ($i -ge $numLines) {
            $lbl.Text    = ''
            $lbl.Visible = $false
            continue
        }
        $lbl.Visible = $true
        $parts = [System.Collections.Generic.List[string]]::new()
        foreach ($k in $cfg[$lineKeys[$i]]) {
            if ($cfg.disabled.Contains($k)) { continue }
            $mode = Get-EffectiveMode $k
            if ($previewText.ContainsKey($k) -and $previewText[$k].ContainsKey($mode)) {
                [void]$parts.Add($previewText[$k][$mode])
            } elseif ($previewText.ContainsKey($k)) {
                [void]$parts.Add($previewText[$k]['full'])
            }
        }
        $lbl.Text = if ($parts.Count -gt 0) { $parts -join $sep } else { "(Line $($i+1) empty)" }
    }
}

# =====================================================================
# GLOBAL CONTROL EVENTS
# =====================================================================
$cmbLineCount.Add_SelectedIndexChanged({
    if ($cmbLineCount.SelectedItem) {
        $cfg.lines   = [int]$cmbLineCount.SelectedItem
        $cfg.two_line = $cfg.lines -ge 2
        Update-Preview
    }
})

$cmbCompact.Add_SelectedIndexChanged({
    if ($cmbCompact.SelectedItem) {
        $cfg.compact_mode = $cmbCompact.SelectedItem
        Update-Preview
    }
})

$cmbSep.Add_SelectedIndexChanged({
    if ($cmbSep.SelectedItem) {
        $cfg.separator = $cmbSep.SelectedItem
        Update-Preview
    }
})

# =====================================================================
# RESET / SAVE / CANCEL
# =====================================================================
$btnReset.Add_Click({
    $result = [System.Windows.Forms.MessageBox]::Show(
        'Reset all HUD configuration back to defaults?',
        'Reset to Defaults',
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
        $cfg.lines        = 2
        $cfg.two_line     = $true
        $cfg.separator    = [char]0x2502
        $cfg.compact_mode = 'auto'
        $cfg.line1        = [System.Collections.Generic.List[string]]::new([string[]]@('workspace','git_status','model','state','auth','sandbox','session'))
        $cfg.line2        = [System.Collections.Generic.List[string]]::new([string[]]@('context','fork','quota_5h','quota_weekly','mcp','subagents','tasks','artifacts','queue'))
        $cfg.line3        = [System.Collections.Generic.List[string]]::new()
        $cfg.line4        = [System.Collections.Generic.List[string]]::new()
        $cfg.disabled     = [System.Collections.Generic.List[string]]::new()
        $cfg.item_styles  = @{}
        $cfg.session_uptime.show_seconds = $true
        $chkUptimeSeconds.Checked = $true
        $cmbLineCount.SelectedItem = '2'
        $cmbCompact.SelectedItem   = 'auto'
        $cmbSep.SelectedItem       = [char]0x2502
        Refresh-UI
    }
})

$btnSave.Add_Click({
    $cfg.session_uptime.show_seconds = $chkUptimeSeconds.Checked

    # Build the save object, merging mutations over the original raw JSON
    $saveData = [ordered]@{
        lines          = $cfg.lines
        two_line       = $cfg.two_line
        separator      = [string]$cfg.separator
        compact_mode   = $cfg.compact_mode
        line1          = @($cfg.line1)
        line2          = @($cfg.line2)
        line3          = @($cfg.line3)
        line4          = @($cfg.line4)
        disabled       = @($cfg.disabled)
        item_styles    = $cfg.item_styles
        session_uptime = $cfg.session_uptime
        fork_advisory  = $cfg.fork_advisory
    }

    # Carry over any extra top-level keys from original JSON that we don't manage
    if ($null -ne $rawJson) {
        $rawJson.PSObject.Properties | ForEach-Object {
            if (-not $saveData.Contains($_.Name)) {
                $saveData[$_.Name] = $_.Value
            }
        }
    }

    $json      = $saveData | ConvertTo-Json -Depth 6
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($configPath, $json, $utf8NoBom)

    # Dual-sync to ~/.gemini/hud/hud_config.json if present
    $hudMirror = Join-Path $HOME ".gemini\hud\hud_config.json"
    if ($configPath -ne $hudMirror -and (Test-Path (Split-Path $hudMirror -Parent))) {
        try {
            [System.IO.File]::WriteAllText($hudMirror, $json, $utf8NoBom)
        } catch {}
    }

    [System.Windows.Forms.MessageBox]::Show(
        "HUD configuration saved to:`n$configPath",
        'Saved',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
    $form.Close()
})

$btnCancel.Add_Click({ $form.Close() })

# =====================================================================
# INIT
# =====================================================================
Refresh-UI
[void]$form.ShowDialog()
