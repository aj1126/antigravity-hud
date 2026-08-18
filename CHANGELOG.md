# 📜 Changelog

All notable changes to **Antigravity HUD** (`antigravity-hud`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-08-18

### 🛡️ Automated Checks, Drift Detection & Self-Healing Runtime Architecture
- **Active Version Upgrade (`~/.gemini/scripts/`)**:
  - Upgraded active runtime scripts in `~/.gemini/scripts/` (`hud.js`, `hud_gui.ps1`, `hud_gui.html`) to full v2.3.0 parity with `~/.gemini/hud/` and source repository.
- **Automated Health Check & Drift Detection (`hud check`)**:
  - Implemented SHA-256 integrity verification across runtime targets (`~/.gemini/scripts/` and `~/.gemini/hud/`).
  - Added UTF-8 BOM preamble detection (`\ufeff`) to prevent Go/Node JSON parsing errors.
  - Added configuration schema validation and statusline hook verification.
- **Self-Healing Auto-Repair Engine (`hud repair` / `hud sync` / `Sync-AgyHud.ps1`)**:
  - Atomically repairs drifted files and restores missing runtime components.
  - Automatically strips BOM preambles and safely hydrates missing schema properties without destroying user custom overrides.
  - Restores broken statusline settings hooks.
- **Master Test Suite Expansion (5/5 Matrix)**:
  - Added `tests/hud_checks_and_corrections.test.js` implementing a 10-test fault injection and auto-repair validation matrix with 100% pass rate.
  - Hardened path resolution across all test suites to dynamically support repository and flat subsystem execution layouts.
- **Installer Hardening (`install.ps1`)**:
  - Multi-target deployment ensuring dual-path synchronization across `~/.gemini/scripts/` and `~/.gemini/hud/`.
  - Added automated post-install health verification.

---

## [2.2.0] - 2026-08-18

### 🚀 Major Architectural Reorganization, Bug Fixes & Automated Testing Suite
- **Dedicated Subsystem Architecture (`~/.gemini/hud/`)**:
  - Relocated core statusline files (`hud.js`, `hud_gui.ps1`, `hud_gui.html`, `hud_config.json`) into dedicated `~/.gemini/hud/` directory.
  - Implemented multi-tier candidate resolution (`process.env.HUD_CONFIG_PATH` $\rightarrow$ `~/.gemini/hud/` $\rightarrow$ `~/.gemini/` $\rightarrow$ sibling paths).
  - Updated `settings.json` `statusLine.command` to point to dedicated path with backwards-compatible fallback.
- **Native WinForms GUI Bug Fixes & Polish (`hud_gui.ps1`)**:
  - Fixed `HashSet[string]` constructor `MethodException` on load by casting `$itemMeta.Keys` to `[string[]]`.
  - Isolated per-tab ComboBox loop closures via `$lineStyleCombos` dictionary lookup.
  - Disabled ListBox horizontal auto-scroll left-clipping and expanded action button clearances to 165px.
  - Updated window and groupbox titles to unified AGY HUD branding.
- **Comprehensive AGY HUD Branding & Alias Alignment**:
  - Standardized CLI output headers in `hud.js` to `=== Antigravity CLI (AGY) Statusline HUD ===`.
  - Registered explicit `agy-hud` and `agy-hud-gui` aliases in `profile.d/20-Aliases.ps1` alongside `hud` and `hud-gui`.
  - Updated `Show-ProfileCommands` documentation and generated comprehensive `~/.gemini/hud/README.md`.
- **Co-Located Automated Test Suite (`~/.gemini/hud/tests/`)**:
  - Created 4 dedicated automated test suites covering Node.js telemetry/CLI matrix, headless WinForms GUI, Web GUI template integrity, and `settings.json` integration with 100% pass rate.
  - Built master unified test runner `run_all_hud_tests.ps1`.

---

## [2.1.0] - 2026-08-18

### 🚀 Enhancements & Invariant Hardening
- **Autonomous Workspace Auto-Discovery (`hud sync-projects`)**:
  - Automatically scans workspace repositories across `B:\Repos\` and active working directory, registering missing workspace configurations into `~/.gemini/config/projects/`.
- **Multi-Variant `/fork` Project Alias Engine**:
  - Automatically synthesizes true PascalCase (`AntigravityHud`, `AgyHud`), camelCase, kebab-case (`antigravity-hud`, `agy-hud`), snake_case (`antigravity_hud`, `agy_hud`), shorthand trailing tokens (`hud`, `Hud`), and `agy-*` $\leftrightarrow$ `antigravity-*` abbreviation mappings.
  - Enforces leading dot sanitization (prohibiting `.name` project IDs) and UTF-8 BOM-free configuration persistence.

---

## [2.0.0] - 2026-08-17

### 🚀 Major Architectural Enhancements
- **Multi-Line Scaling (Up to 4 Lines)**:
  - Added support for 1, 2, 3, or 4 configurable statusline lines (`line1` through `line4`).
  - Added CLI command `hud lines <1-4>` to instantly adjust the vertical layout.
  - Retained full backward compatibility with legacy `two_line: true/false` configurations.
- **Granular Per-Item Text Shortening Engine**:
  - Implemented 4 formatting tiers across all 16 statusline elements: `full` (standard), `short` (abbreviated), `minimal` (icons/values only), and `auto` (terminal width adaptive).
  - Added `hud compact <auto|full|short|minimal>` for global layout compression.
  - Added `hud style <item> <style>` for per-item formatting overrides (e.g. `hud style context short`, `hud style model minimal`).
  - Added `hud style reset` to restore default styling.
- **Modern Drag-and-Drop Web GUI (`hud gui`)**:
  - Upgraded `hud_gui.html` with interactive 4-line drop columns (`Line 1`, `Line 2`, `Line 3`, `Line 4`, `Inactive Pool`).
  - Added inline style selection dropdowns on each item card.
  - Added live real-time simulated terminal preview updating instantly as cards are moved or styled.
- **Open-Source GitHub Packaging**:
  - Initialized public repository `antigravity-hud` on GitHub.
  - Added standalone NPM package metadata, 1-click PowerShell installer (`install.ps1`), and zero external runtime dependencies.
  - 100% path sanitization adhering to zero-leak privacy and security standards.

---

## [1.6.0] - 2026-08-17

### Added
- **Milestone-Aware Fork Advisory Badge (`hud fork`)**:
  - Added dynamic context ($\ge 60\%$, $\ge 75\%$, $\ge 90\%$) and step count ($\ge 300$, $\ge 500$, $\ge 800$) threshold monitoring.
  - Implemented the **Clean-State Milestone Invariant ("The Golden Rule")**: Fork badge strictly suppresses during active dirty edits (`⚠️ Dirty`) and triggers exclusively at clean commit milestones (`🌿 Clean`).
  - Added local snooze engine (`hud fork snooze [minutes]`, `hud fork unsnooze`).
- **Autonomous Project Name & `/fork` Alias Synchronizer (`hud sync-projects`)**:
  - Automatically indexes workspace directories and generates kebab-case, snake_case, PascalCase, and sub-domain project aliases in `~/.gemini/config/projects/` to prevent project resolution failures.

---

## [1.5.0] - 2026-08-17

### Added
- **Host TUI Terminal Tab & Window Title Synchronization**:
  - Broadcasts ANSI OSC 0 escape sequences (`\x1b]0;[agy] <target>\x07`) to synchronize Windows Terminal tab and window titles.
  - Added `hud title <custom title>` and `hud title reset` CLI commands with session-scoped and workspace-scoped title persistence.

---

## [1.4.0] - 2026-08-17

### Added
- **Interactive Local Web GUI Configurator (`hud gui`)**:
  - Zero-dependency local Node.js HTTP server hosting a responsive drag-and-drop statusline editor on `http://localhost:3847`.
  - Allowed visual item reordering between Line 1, Line 2, and the Disabled Pool.

---

## [1.3.0] - 2026-08-17

### Added
- **Session Duration & Color-Graded Uptime Monitor (`session`)**:
  - Real-time session elapsed time tracking formatted with optional seconds (`show_seconds: true`).
  - Color-graded thresholds: Green ($\le 15$m), Yellow ($\le 45$m), Magenta ($\le 90$m), Red ($> 90$m).
  - Added CLI commands `hud uptime`, `hud uptime seconds <on|off>`, and `hud uptime thresholds <spec>`.
- **Statusline Update Ticker Frequency Adjuster**:
  - Added `hud ticker <seconds>` to programmatically update `statusLine.interval_seconds` in `settings.json`.

---

## [1.2.0] - 2026-08-17

### Added
- **Dual Rolling Quota Reserve Tracking (`quota_5h` & `quota_weekly`)**:
  - Integrated 5-hour rolling token reserve percentage with dynamic reset countdown timer (`↻ 3h 14m`).
  - Integrated weekly rolling quota reserve percentage.
  - Added local quota caching to ensure statusline resilience during offline subagent operations.

---

## [1.1.0] - 2026-08-17

### Added
- **Dual-Line Statusline Engine (`two_line: true`)**:
  - Separated operational workspace metadata (Line 1) from resource and quota telemetry (Line 2).
- **Visual Context Window Progress Bar & Prompt Cache Rate (`context`)**:
  - Added Unicode block progress bars (`██░░░░░░░░`) indicating context saturation.
  - Added prompt cache efficiency percentage badge (`(⚡ 93% Cache)`).
- **Background Tasks, Subagents, Artifacts & Queue Counters**:
  - Added dynamic telemetry badges for active tasks (`⚙️`), subagents (`🤖`), brain artifacts (`📝`), and queued turns (`⏳`).

---

## [1.0.0] - 2026-08-17

### Initial Prototype
- Single-line statusline prototype rendering workspace folder, active Git branch, model name, agent state (`[IDLE]`/`[WORKING]`), and authentication badge (`🔑`).
- JSON configuration loader supporting custom separators and item toggling (`hud toggle`, `hud enable`, `hud disable`).
