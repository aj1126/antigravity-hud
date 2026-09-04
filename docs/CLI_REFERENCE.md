# ⌨️ Antigravity HUD CLI Command Reference

Comprehensive manual for the **Antigravity CLI (AGY) HUD System** command-line interface.

All subcommands are accessible via `hud <command>`, `agy-hud <command>`, or `node bin/hud.js <command>`.

---

## 📑 Table of Contents

- [Layout & Density](#layout-density)
- [Items & Ordering](#items-ordering)
- [Milestones & Identity](#milestones-identity)
- [Runtime Sync & Self-Healing](#runtime-sync-self-healing)
- [Configurator & Utilities](#configurator-utilities)

---

## Layout & Density

### `hud`

* **Description:** Inspect active multi-line layout configuration, enabled items, line slots, and active item styles.
* **Aliases:** `hud list`, `hud --list`
* **Example:** `hud`
* **Notes:** Default statusline readout when invoked without arguments or piped from Antigravity stdio.

### `hud lines`

* **Description:** Set total number of active statusline display lines (1 to 4).
* **Arguments:** `<1-4>`
* **Aliases:** `hud-lines`, `hud lines <1-4>`
* **Example:** `hud lines 4`
* **Notes:** Automatically updates `lines` and adjusts `two_line` flag in configuration.

### `hud compact`

* **Description:** Set global text condensation mode across all statusline elements.
* **Arguments:** `<auto|full|short|minimal>`
* **Aliases:** `hud-compact`, `hud compact <mode>`
* **Example:** `hud compact short`
* **Notes:** `auto` adapts dynamically based on terminal width (<70 cols: minimal, <105 cols: short, >=105 cols: full).

### `hud style`

* **Description:** Set per-item style override (takes precedence over global text mode).
* **Arguments:** `<item> <auto|full|short|minimal>`
* **Aliases:** `hud-style`, `hud style <item> <style>`
* **Example:** `hud style context short`
* **Notes:** Use `hud style reset` to clear all individual item style overrides.

### `hud style reset`

* **Description:** Clear all per-item formatting overrides and revert to global condensation mode.
* **Aliases:** `hud style-reset`
* **Example:** `hud style reset`
* **Notes:** Resets the `item_styles` object in `hud_config.json`.

### `hud preset`

* **Description:** Manage and apply pre-configured statusline layout presets.
* **Arguments:** `<list|load <name>|save <name>>`
* **Aliases:** `hud preset list`, `hud preset load`, `hud preset save`
* **Example:** `hud preset load 4line_command_center`
* **Notes:** Ships with `4line_command_center`, `3line_cockpit`, `2line_classic`, and `1line_compact`.


## Items & Ordering

### `hud toggle`

* **Description:** Toggle an item between enabled and disabled status.
* **Arguments:** `<item>`
* **Aliases:** `hud-toggle`, `hud toggle <item>`
* **Example:** `hud toggle sandbox`
* **Notes:** Disabling moves the item into the `disabled` array without losing line ordering.

### `hud enable`

* **Description:** Enable a disabled item and optionally place it on a specific line slot.
* **Arguments:** `<item> [line1|line2|line3|line4]`
* **Aliases:** `hud-enable`, `hud enable <item> [line1-4]`
* **Example:** `hud enable auth line4`
* **Notes:** If line slot is omitted, places item on its default canonical line.

### `hud disable`

* **Description:** Disable an item and remove it from active statusline output.
* **Arguments:** `<item>`
* **Aliases:** `hud-disable`, `hud disable <item>`
* **Example:** `hud disable queue`
* **Notes:** Reversible at any time with `hud enable <item>`.


## Milestones & Identity

### `hud fork`

* **Description:** View or configure Milestone Fork Advisory badge, thresholds, and snooze state.
* **Arguments:** `[snooze [min]|unsnooze|thresholds <spec>|enable|disable]`
* **Aliases:** `hud-fork`, `hud fork status`
* **Example:** `hud fork snooze 30`
* **Notes:** Adheres to the Golden Rule: only triggers at clean milestone boundaries (`🌿 Clean` git tree).

### `hud uptime`

* **Description:** Configure session elapsed uptime formatting and color thresholds.
* **Arguments:** `[show-seconds [on|off]|thresholds <spec>]`
* **Aliases:** `hud-uptime`, `hud uptime thresholds`
* **Example:** `hud uptime show-seconds on`
* **Notes:** Color progression: Green (<=15m) -> Yellow (<=45m) -> Magenta (<=90m) -> Red (>90m).

### `hud title`

* **Description:** Set a custom workspace title or reset back to default folder/project identity.
* **Arguments:** `<name|reset>`
* **Aliases:** `hud-title`, `hud title <name|reset>`
* **Example:** `hud title "Feature Refactor"`
* **Notes:** Broadcasts ANSI OSC 0 escape sequences to update Windows Terminal tabs and statusline.

### `hud sync-projects`

* **Description:** Scan Antigravity project definitions and synchronize PascalCase/kebab-case/snake_case aliases for `/fork`.
* **Arguments:** `[--force]`
* **Aliases:** `hud-sync-projects`
* **Example:** `hud sync-projects`
* **Notes:** Enforces invariant: project names and files must never have leading dots.

### `hud ticker`

* **Description:** Update Antigravity `settings.json` statusLine polling interval.
* **Arguments:** `<seconds>`
* **Aliases:** `hud-ticker`, `hud ticker <sec>`
* **Example:** `hud ticker 1`
* **Notes:** Updates `interval`, `interval_seconds`, and `interval_ms` simultaneously.


## Runtime Sync & Self-Healing

### `hud diff`

* **Description:** Compare cryptographic SHA-256 parity between active runtime files and repository.
* **Arguments:** `[--json]`
* **Aliases:** `hud-diff`, `Sync-AgyHud -Diff`
* **Example:** `hud diff`
* **Notes:** Scans `~/.gemini/scripts/` against repository workspace files.

### `hud backup`

* **Description:** Safely copy active runtime edits back into the repository workspace.
* **Arguments:** `[--force]`
* **Aliases:** `hud-backup`, `Sync-AgyHud -Backup`
* **Example:** `hud backup`
* **Notes:** Includes conflict protection: will not overwrite newer repository files without `--force`.

### `hud deploy`

* **Description:** Deploy canonical repository components to active runtime directories (`~/.gemini/scripts/`, `~/.gemini/hud/`).
* **Arguments:** `[--force]`
* **Aliases:** `hud-deploy`, `Sync-AgyHud -Deploy`
* **Example:** `hud deploy`
* **Notes:** Synchronizes `hud.js`, `hud_gui.ps1`, `hud_gui.html`, `Sync-AgyHud.ps1`, presets, and hooks.

### `hud check`

* **Description:** Perform complete health, drift detection, BOM preamble, and settings wiring check.
* **Arguments:** `[--json]`
* **Aliases:** `hud-check`, `hud status`
* **Example:** `hud check`
* **Notes:** Reports 100% HEALTHY when all SHA-256 hashes match and settings hooks are correctly wired.

### `hud repair`

* **Description:** Trigger self-healing auto-repair: strips BOM preambles, restores missing files, and hydratres missing schema keys.
* **Arguments:** `[--force]`
* **Aliases:** `hud-repair`, `hud fix`
* **Example:** `hud repair`
* **Notes:** Preserves user customizations while restoring damaged runtime components.


## Configurator & Utilities

### `hud gui`

* **Description:** Launch native Windows Forms interactive statusline layout configurator.
* **Aliases:** `hud-gui`, `hud config`
* **Example:** `hud gui`
* **Notes:** Zero-dependency desktop GUI with live multi-line preview, item reordering, and dual-sync saving.

### `hud edit`

* **Description:** Open `hud_config.json` in default system text editor (VS Code, Notepad).
* **Aliases:** `hud-edit`
* **Example:** `hud edit`
* **Notes:** Opens the active configuration path resolved from `HUD_CONFIG_PATH` or `~/.gemini/scripts/`.

### `hud reset`

* **Description:** Reset statusline configuration back to factory default 4-Line Command Center layout.
* **Aliases:** `hud-reset`
* **Example:** `hud reset`
* **Notes:** Overwrites `hud_config.json` with canonical default settings.

### `hud credits`

* **Description:** View current Model AI Credits balance or set a new credit amount locally (zero-quota overhead).
* **Arguments:** `[amount|clear]`
* **Aliases:** `hud-credits`, `hud credit`
* **Example:** `hud credits 2348`
* **Notes:** Caches balance indefinitely in `~/.gemini/tmp/last_credits.json` with zero API quota overhead, automatically activating vibrant amber `[0Q Active]` alert styling on Line 2 when 5h quota hits 0%.

### `hud help`

* **Description:** Print complete formatted CLI command manual with colored examples.
* **Aliases:** `hud --help`, `hud -h`
* **Example:** `hud help`
* **Notes:** Displays all available subcommands, argument syntax, and usage notes.

---

## 🛠️ Global Flags & Environment Variables

| Variable / Flag | Description | Default |
| :--- | :--- | :--- |
| `HUD_CONFIG_PATH` | Explicit override path to `hud_config.json` | `~/.gemini/scripts/hud_config.json` |
| `HUD_TEST_MODE` | Isolates test runs to prevent mutating runtime cache | `undefined` |
| `--json` | Outputs structured JSON instead of ANSI terminal formatting | `false` |
| `--force` | Overrides conflict protection during sync operations | `false` |
