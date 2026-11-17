# Design Specification: Separate `session_name` and `session_id` HUD Footer Items

- **Feature Branch:** `feat/session-name-and-id-items`
- **Status:** Implementing (Document- & Test-Driven)
- **Performance Budget:** `< 0.1 ms` per render (zero additional I/O or subprocess spawns; pure in-memory payload projection to preserve the `< 250 ms` `BM-01` latency SLA).

---

## 1. Problem & Motivation

Previously, setting a custom title via `hud title <name>` updated `workspace_titles.json` and overwrote the `📁` workspace directory badge, while Antigravity's live session title (`payload.conversation_title`) and UUID (`payload.session_id` / `payload.conversation_id`) had no dedicated footer items. Meanwhile, the existing `session` key renders elapsed session duration (`⏱️ 1h 24m`).

Users need:
1. **`workspace` (`📁`)** strictly reserved for directory / project / workspace custom title (`ResearchLab`).
2. **`session_name`** as its own toggleable/placeable footer item displaying the active session's name (`payload.conversation_title`).
3. **`session_id`** as its own toggleable/placeable footer item displaying the active session's UUID (`payload.session_id || payload.conversation_id`).

---

## 2. Item Contracts

### A. `session_name` (`🏷️ Session Name`)
- **Source Priority:** `payload.conversation_title || payload.session_title || payload.title` (trimmed string).
- **Empty State:** Returns `''` (automatically omitted by `renderLine()` when untitled).
- **Formatting Tiers (`resolveItemStyle('session_name', cfg, width)`):**
  - `full`: `🏷️ <title>` (truncated at 48 chars with `…` if longer) — ANSI bright magenta (`\x1b[95m`)
  - `short`: `🏷️ <title>` (truncated at 24 chars with `…` if longer) — ANSI bright magenta (`\x1b[95m`)
  - `minimal`: `<title>` (truncated at 14 chars with `…` if longer) — ANSI bright magenta (`\x1b[95m`)

### B. `session_id` (`🆔 Session ID`)
- **Source Priority:** `payload.session_id || payload.conversation_id || payload.thread_id` (trimmed string).
- **Empty State:** Returns `''` (automatically omitted by `renderLine()` if absent).
- **Formatting Tiers (`resolveItemStyle('session_id', cfg, width)`):**
  - `full`: `🆔 <rawId>` (full UUID/ID, e.g. `🆔 c4389f31-ea6b-4188-92ac-49962cf376ef`) — ANSI muted gray (`\x1b[90m`)
  - `short`: `🆔 <shortId>` (first 8 chars, e.g. `🆔 c4389f31`) — ANSI muted gray (`\x1b[90m`)
  - `minimal`: `<shortId>` (first 8 chars without icon, e.g. `c4389f31`) — ANSI muted gray (`\x1b[90m`)

---

## 3. Synchronization & Surface Parity

Both `session_name` and `session_id` must be registered identically across:
1. **Engine (`bin/hud.js`)**: `DEFAULT_CONFIG`, `getSessionNameSegment()`, `getSessionIdSegment()`, `itemMap`, and `hud help`.
2. **Configs & Presets (`bin/hud_config.json`, `presets/4line_command_center.json`)**: Included on `line4` (`["sandbox", "auth", "session_name", "session_id"]`) so Line 1 remains focused on workspace/model/state/tasks.
3. **Web Configurator (`web/hud_gui.html`)**: `ITEM_METADATA`, `.term-session-name`/`.term-session-id` CSS, and `getSampleItemText()`.
4. **WinForms Configurator (`bin/hud_gui.ps1`)**: `$itemMeta` and `$previewText`.
5. **SSOT Docs (`scripts/generate_docs.js`)**: `TELEMETRY_ITEMS`, regenerated `docs/TELEMETRY_ITEMS.md`, `docs/CONFIGURATION_SCHEMA.md`, and `README.md`.
