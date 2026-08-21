# ⚙️ Configuration Schema (`hud_config.json`)

The Antigravity HUD configuration is stored in JSON format at `~/.gemini/scripts/hud_config.json` and synchronized with `~/.gemini/hud/hud_config.json`.

---

## 📋 Default Configuration Sample

```json
{
  "lines": 4,
  "two_line": true,
  "separator": "│",
  "compact_mode": "auto",
  "line1": [
    "workspace",
    "git_status",
    "model",
    "state"
  ],
  "line2": [
    "context",
    "quota_5h",
    "quota_weekly"
  ],
  "line3": [
    "mcp",
    "tasks",
    "subagents",
    "artifacts",
    "queue"
  ],
  "line4": [
    "sandbox",
    "auth",
    "session",
    "fork"
  ],
  "disabled": [],
  "item_styles": {},
  "session_uptime": {
    "show_seconds": true,
    "thresholds": [
      {
        "max_minutes": 15,
        "color": "green"
      },
      {
        "max_minutes": 45,
        "color": "yellow"
      },
      {
        "max_minutes": 90,
        "color": "magenta"
      },
      {
        "max_minutes": null,
        "color": "red"
      }
    ]
  },
  "fork_advisory": {
    "enabled": true,
    "require_clean_git": true,
    "warning_percent": 60,
    "alert_percent": 75,
    "critical_percent": 90,
    "step_warning": 300,
    "step_alert": 500,
    "step_critical": 800
  }
}
```

---

## 🔍 Schema Properties Specification

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | `"4-Line Command Center"` | Descriptive name of the active layout configuration. |
| `description` | `string` | `"High-density 4-tier statusline..."` | Summary of layout purpose and density tier. |
| `lines` | `integer (1-4)` | `4` | Total number of lines rendered in the statusline footer. |
| `two_line` | `boolean` | `true` | Backward-compatible flag (true if `lines >= 2`). |
| `separator` | `string` | `"│"` | Character delimiter placed between items (e.g. `│`, `|`, `•`, `/`). |
| `compact_mode` | `string` | `"auto"` | Global text condensation mode (`auto`, `full`, `short`, `minimal`). |
| `line1` | `array[string]` | `["workspace", "git_status", "model", "state"]` | Telemetry item keys assigned to Line 1 (Top). |
| `line2` | `array[string]` | `["context", "quota_5h", "quota_weekly"]` | Telemetry item keys assigned to Line 2. |
| `line3` | `array[string]` | `["mcp", "tasks", "subagents", "artifacts", "queue"]` | Telemetry item keys assigned to Line 3. |
| `line4` | `array[string]` | `["sandbox", "auth", "session", "fork"]` | Telemetry item keys assigned to Line 4 (Bottom). |
| `disabled` | `array[string]` | `[]` | Explicitly disabled item keys suppressed from all lines. |
| `item_styles` | `object` | `{}` | Per-item formatting overrides (e.g. `{"context": "short"}`). |
| `session_uptime` | `object` | *(see below)* | Uptime display settings and color threshold bands. |
| `fork_advisory` | `object` | *(see below)* | Milestone fork advisory triggers and thresholds. |

---

### `session_uptime` Settings

```json
"session_uptime": {
  "show_seconds": true,
  "thresholds": [
    { "max_minutes": 15, "color": "green" },
    { "max_minutes": 45, "color": "yellow" },
    { "max_minutes": 90, "color": "magenta" },
    { "max_minutes": null, "color": "red" }
  ]
}
```

---

### `fork_advisory` Settings

```json
"fork_advisory": {
  "enabled": true,
  "require_clean_git": true,
  "warning_percent": 60,
  "alert_percent": 75,
  "critical_percent": 90,
  "step_warning": 300,
  "step_alert": 500,
  "step_critical": 800
}
```

---

## 🎨 Built-in Presets Catalog

Presets are located in `presets/` and can be loaded via `hud preset load <name>`:

1. **`4line_command_center` (4 lines):** High-density command center displaying full system telemetry, security, and milestones.
2. **`3line_cockpit` (3 lines):** Balanced 3-tier layout separating workspace identity, resource quotas, and background workers.
3. **`2line_classic` (2 lines):** Balanced 2-tier layout optimized for standard terminal dimensions.
4. **`1line_compact` (1 line):** Ultra-condensed single-line statusline with minimal footprint.
