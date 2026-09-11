# Implementation Plan: Unified HUD Layout Redesign, Telemetry Expansion & Self-Healing Sync

## Goal Description
Resolve existing documentation drift and test failures (Suite 7), expand the Antigravity HUD telemetry suite with three new high-utility items (`datetime`, `memory`, `steps`), deliver a unified layout redesign experience featuring an interactive terminal TUI designer (`hud layout`) and an enhanced Web GUI (`hud gui`) with preset management and quick-move actions, ensure non-destructive configuration schema preservation, and validate complete system health across all 8 test suites.

---

## User Review Required

> [!IMPORTANT]
> **New Telemetry Items Schema**: Three new telemetry keys will be introduced:
> - `datetime` (aliases: `time`, `date`, `clock`): Local system wall clock & date with configurable format (`12h`/`24h`, seconds toggle, date toggle).
> - `memory` (aliases: `ram`, `sys_mem`): Zero-overhead host RAM utilization (`os.freemem()` / `os.totalmem()`).
> - `steps` (aliases: `turns`, `step_count`): Real-time conversation turn/step counter extracted from session transcripts or payloads.
> 
> By default, existing active configurations (`hud_config.json`) will not be disrupted; new items will be registered in the schema and placed in the inactive/disabled pool or made available for placement on any line.

> [!NOTE]
> **Non-Destructive Schema Preservation (Rule 17)**:
> `saveConfig` in [hud.js](file:///B:/Repos/antigravity-hud/bin/hud.js) will be hardened to preserve unmanaged top-level JSON keys during saves, mirroring the logic already codified in [hud_gui.ps1](file:///B:/Repos/antigravity-hud/bin/hud_gui.ps1).

---

## Architecture & Workflow Overview

```mermaid
flowchart TD
    subgraph ConfigLayers [Configuration Sources & Sync Targets]
        ActiveScripts["~/.gemini/scripts/hud_config.json (Active)"]
        ActiveHud["~/.gemini/hud/hud_config.json (Mirror)"]
        RepoConfig["bin/hud_config.json (Workspace SSOT)"]
    end

    subgraph RedesignInterfaces [Layout Redesign Interfaces]
        TUI["Terminal TUI Designer (hud layout / hud design)"]
        WebGUI["Web GUI Configurator (hud gui / web)"]
        WinGUI["WinForms Desktop GUI (hud_gui.ps1)"]
        CLICmds["Discrete CLI (hud move, hud swap, hud preset)"]
    end

    subgraph TelemetryEngine [HUD Rendering Pipeline (bin/hud.js)]
        Items["19 Telemetry Items + 3 New: datetime, memory, steps"]
        Styles["Compact Modes: full | short | minimal | auto"]
        SafeSave["Non-Destructive Schema Preservation"]
    end

    subgraph VerificationGates [Automated Quality Gates]
        Suite1["Suite 1: Node.js Engine & CLI Matrix"]
        Suite2["Suite 2: WinForms GUI Pester"]
        Suite3["Suite 3: Web GUI Schema"]
        Suite5["Suite 5: Checks & Self-Healing"]
        Suite7["Suite 7: 0% Documentation Drift"]
        Suite8["Suite 8: Benchmarks & Latency (<250ms)"]
    end

    RedesignInterfaces --> SafeSave
    SafeSave --> ConfigLayers
    ConfigLayers --> TelemetryEngine
    TelemetryEngine --> VerificationGates
```

---

## Proposed Changes

Grouped by component and layer:

### Component 1: Core HUD Engine & CLI

#### [MODIFY] [bin/hud.js](file:///B:/Repos/antigravity-hud/bin/hud.js)

1. **Non-Destructive Schema Preservation in `saveConfig(cfg)`**:
   - Merge unmanaged top-level keys from existing JSON file before serializing, preventing configuration data loss.
   - Symmetrically synchronize saved layouts across `~/.gemini/scripts/hud_config.json`, `~/.gemini/hud/hud_config.json`, and repository `bin/hud_config.json` when running in repository root.

2. **Telemetry Segment Implementations**:
   - `getDatetimeSegment(cfg, style)`:
     - Reads `cfg.datetime` settings: `{ format: '24h' | '12h', show_date: boolean, show_seconds: boolean }`.
     - `full`: `📅 2026-09-10 🕒 22:24` (or with seconds if enabled).
     - `short`: `🕒 22:24` (or `10:24 PM`).
     - `minimal`: `22:24`.
   - `getMemorySegment(style)`:
     - Uses `os.totalmem()` and `os.freemem()` (zero I/O, `<0.05ms` latency).
     - Graded color: Green (<75%), Yellow (75-89%), Red (>=90%).
     - `full`: `💾 RAM: 9.4G/15.9G (59%)`.
     - `short`: `💾 9.4G/16G`.
     - `minimal`: `💾 59%`.
   - `getStepsSegment(payload, style)`:
     - Leverages cached step counts or payload properties.
     - `full`: `🎯 Step 42`.
     - `short`: `🎯 #42`.
     - `minimal`: `42`.

3. **Item Map & Aliases Registration**:
   - Register `datetime`, `time`, `date`, `clock`.
   - Register `memory`, `ram`, `sys_mem`.
   - Register `steps`, `turns`, `step_count`.
   - Ensure `activeItemSet` gates evaluations so unused items have zero CPU impact.

4. **Interactive Terminal TUI Layout Designer (`hud layout` / `hud design`)**:
   - Guard against non-interactive environments (Rule 14).
   - Display colored live multi-line preview.
   - Interactive options:
     - Move item to line / index
     - Swap two items
     - Toggle item (enable/disable)
     - Adjust total lines (1 to 4)
     - Adjust compact mode
     - Change separator
     - Load preset / Save as preset
     - Apply & Save

5. **Discrete CLI Commands**:
   - `hud move <item> <line1-4> [index]`
   - `hud swap <item1> <item2>`
   - `hud preset save <name>`
   - `hud preset delete <name>`

6. **Web GUI HTTP Server Enhancements**:
   - Add `/api/presets` endpoint: returns available presets list.
   - Add `/api/presets/load` endpoint: loads a preset by name.
   - Add `/api/presets/save` endpoint: saves current layout as a custom preset.

---

### Component 2: Web GUI Configurator

#### [MODIFY] [web/hud_gui.html](file:///B:/Repos/antigravity-hud/web/hud_gui.html)

1. **Register New Items in `ITEM_METADATA`**:
   - `datetime`: `{ label: '🕒 Date & Time', desc: 'System clock, date & time' }`
   - `memory`: `{ label: '💾 RAM / Memory', desc: 'System RAM utilization' }`
   - `steps`: `{ label: '🎯 Steps & Turns', desc: 'Active conversation turn/step counter' }`

2. **Live Preview Rendering**:
   - Implement `getSampleItemText(key)` cases for `datetime`, `memory`, `steps` across `full`, `short`, and `minimal` styles.

3. **Card Quick-Action Controls**:
   - Add quick line reassignment buttons (`[L1]`, `[L2]`, `[L3]`, `[L4]`, `[✕ Disable]`) directly on cards so users can move items with a single click without dragging.
   - Add `[↑]` and `[↓]` reordering buttons for instant line reorganization.

4. **Preset Manager Toolbar**:
   - Preset dropdown selector to switch between `4line_command_center`, `3line_cockpit`, `2line_classic`, `1line_compact`, and custom presets.
   - "Save as Preset..." action button with modal dialog prompt.

5. **Filter & Search Bar**:
   - Search input to filter items across active lines and disabled pool in real time.

---

### Component 3: Native WinForms Desktop GUI

#### [MODIFY] [bin/hud_gui.ps1](file:///B:/Repos/antigravity-hud/bin/hud_gui.ps1)

1. **Register New Items**:
   - Add `datetime`, `memory`, `steps` to `$itemMeta` display dictionary.
   - Add preview formatting to `$previewText` across `full`, `short`, and `minimal` modes.

2. **Non-Destructive Schema Parity**:
   - Verify unmanaged key retention covers new item configurations.

---

### Component 4: Documentation SSOT & Drift Resolution

#### [MODIFY] [scripts/generate_docs.js](file:///B:/Repos/antigravity-hud/scripts/generate_docs.js)

1. **Update `CLI_COMMANDS` SSOT Registry**:
   - Add `hud layout` / `hud design`
   - Add `hud move`
   - Add `hud swap`
   - Add `hud preset delete`

2. **Update `TELEMETRY_ITEMS` SSOT Registry**:
   - Register previously missing items: `credits`, `plan_tier`, `local_ai`.
   - Register new items: `datetime`, `memory`, `steps`.

3. **Regenerate Documentation Catalog**:
   - Run `node scripts/generate_docs.js` to update [docs/CONFIGURATION_SCHEMA.md](file:///B:/Repos/antigravity-hud/docs/CONFIGURATION_SCHEMA.md), [docs/TELEMETRY_ITEMS.md](file:///B:/Repos/antigravity-hud/docs/TELEMETRY_ITEMS.md), [docs/CLI_REFERENCE.md](file:///B:/Repos/antigravity-hud/docs/CLI_REFERENCE.md), and [README.md](file:///B:/Repos/antigravity-hud/README.md).
   - Ensure `node scripts/generate_docs.js --check` passes with 0% drift.

---

### Component 5: Test Fixtures & Regression Suites

#### [MODIFY] [tests/fixtures/sample_full_hud_config.json](file:///B:/Repos/antigravity-hud/tests/fixtures/sample_full_hud_config.json)
- Update test fixture with new items and verify unmanaged key preservation.

#### [MODIFY] [tests/hud_engine.test.js](file:///B:/Repos/antigravity-hud/tests/hud_engine.test.js)
- Add tests for `datetime`, `memory`, `steps` rendering.
- Add tests for `hud move`, `hud swap`, `hud preset save`.

#### [MODIFY] [tests/hud_gui.test.ps1](file:///B:/Repos/antigravity-hud/tests/hud_gui.test.ps1)
- Update `$itemMetaKeys` count assertion to match all registered items (21 items).

#### [MODIFY] [tests/hud_web_gui.test.js](file:///B:/Repos/antigravity-hud/tests/hud_web_gui.test.js)
- Update item presence assertions to cover all items including `datetime`, `memory`, `steps`.

---

## Verification Plan

### Automated Tests
Execute the complete Antigravity test runner covering all 8 test suites:
```powershell
pwsh -NoProfile -File tests/run_all_hud_tests.ps1
```
Gate requirements:
- **Suite 1**: Node.js HUD Engine & CLI Subcommands Matrix (all tests passing)
- **Suite 2**: WinForms Headless GUI Pester Tests (AST & non-destructive save passing)
- **Suite 3**: Web GUI Template & Schema Integrity (all items registered)
- **Suite 4**: Settings Integration & Command Wiring (passing)
- **Suite 5**: Automated Checks, Drift Detection & Self-Healing Matrix (passing)
- **Suite 6**: Lifecycle Hooks & Perma-Logging (passing)
- **Suite 7**: Documentation Parity & 0% Drift Check (`generate_docs.js --check` 100% clean)
- **Suite 8**: Performance Benchmarks (<250ms average render latency)

### Manual Verification
1. **Interactive TUI**:
   - Run `node bin/hud.js layout` in terminal, move an item between lines, preview the change, and save.
2. **Web GUI**:
   - Run `node bin/hud.js gui`, verify new items appear in the cards list, test quick-move buttons, and test preset loading/saving.
3. **Telemetry Readout**:
   - Pipe a mock payload to `node bin/hud.js` and verify `datetime`, `memory`, and `steps` render cleanly without clipping or ANSI corruption.
