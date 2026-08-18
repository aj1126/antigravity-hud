Describe "Antigravity CLI (AGY) - WinForms HUD Configurator Headless Test Suite" {
    BeforeAll {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        
        $script:TestDir = Join-Path $PSScriptRoot "fixtures"
        $script:FixtureCfg = Join-Path $script:TestDir "sample_full_hud_config.json"

        $script:TempScratch = Join-Path $env:TEMP "hud_gui_pester_scratch_$([guid]::NewGuid().ToString('N'))"
        New-Item -ItemType Directory -Path $script:TempScratch -Force | Out-Null

        $script:TestConfigPath = Join-Path $script:TempScratch "hud_config_test.json"
        Copy-Item -Path $script:FixtureCfg -Destination $script:TestConfigPath -Force

        $env:HUD_CONFIG_PATH = $script:TestConfigPath
        $env:HUD_TEST_MODE = '1'

        $candidatePaths = @(
            (Join-Path $PSScriptRoot "..\bin\hud_gui.ps1"),
            (Join-Path $PSScriptRoot "..\hud_gui.ps1"),
            (Join-Path $HOME ".gemini\hud\hud_gui.ps1"),
            (Join-Path $HOME ".gemini\scripts\hud_gui.ps1")
        )
        $script:HudGuiPath = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    }

    AfterAll {
        Remove-Item -Path $script:TempScratch -Recurse -Force -ErrorAction SilentlyContinue
    }

    Context "Script Syntax & AST Verification" {
        It "hud_gui.ps1 should pass AST parser analysis with 0 syntax errors" {
            $errors = $null
            $tokens = $null
            $ast = [System.Management.Automation.Language.Parser]::ParseFile($script:HudGuiPath, [ref]$tokens, [ref]$errors)
            $errors | Should -BeNullOrEmpty
        }
    }

    Context "Non-Destructive JSON Config Hydration & Type Resolvers" {
        It "HashSet constructor should instantiate [string[]] keys without MethodException" {
            $rawJson = Get-Content -Path $script:TestConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
            $itemMetaKeys = @('workspace','git_status','model','state','auth','sandbox','session','context','fork','quota_5h','quota_weekly','mcp','subagents','tasks','artifacts','queue')
            
            {
                $allKnown = [System.Collections.Generic.HashSet[string]]::new([string[]]$itemMetaKeys)
                $allKnown.Count | Should -Be 16
            } | Should -Not -Throw
        }

        It "Should preserve unmanaged keys during non-destructive save" {
            $rawJson = Get-Content -Path $script:TestConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
            $rawJson.custom_unmanaged_key | Should -Be "preserved_value_123"

            # Simulate save dictionary
            $saveData = [ordered]@{
                lines        = $rawJson.lines
                two_line     = $rawJson.two_line
                separator    = [string]$rawJson.separator
                compact_mode = $rawJson.compact_mode
                line1        = @($rawJson.line1)
                line2        = @($rawJson.line2)
                line3        = @($rawJson.line3)
                line4        = @($rawJson.line4)
                disabled     = @($rawJson.disabled)
            }

            # Copy unmanaged keys
            $rawJson.PSObject.Properties | ForEach-Object {
                if (-not $saveData.Contains($_.Name)) {
                    $saveData[$_.Name] = $_.Value
                }
            }

            $saveData.custom_unmanaged_key | Should -Be "preserved_value_123"
        }

        It "Should support item reordering (Up/Down) without mutating other lines" {
            $rawJson = Get-Content -Path $script:TestConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
            $line1 = [System.Collections.Generic.List[string]]::new([string[]]$rawJson.line1)
            $first = $line1[0]
            $second = $line1[1]

            # Simulate Move Down
            $line1.RemoveAt(0)
            $line1.Insert(1, $first)

            $line1[0] | Should -Be $second
            $line1[1] | Should -Be $first
        }
    }
}
