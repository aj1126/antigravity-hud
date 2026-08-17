# 🚀 Antigravity HUD (`antigravity-hud`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)
[![Version](https://img.shields.io/badge/Version-v2.0.0-brightgreen.svg)](CHANGELOG.md)

A high-performance, real-time, multi-line TUI statusline HUD, live telemetry monitor, and drag-and-drop layout configurator designed specifically for **Antigravity AI Agent** coding workflows.

---

## 📸 Preview

```text
📁 MyProject › Core (⎇ main * ↑1) │ 🌿 Clean │ Gemini 3.7 Flash [🧠 HIGH] │ [WORKING] │ ⏱️ 24m 15s
Ctx: ██░░░░░░░░ 22% (229k tok) (⚡ 93% Cache) │ Quota: 53% (↻ 3h 34m) │ Wk: 27% │ 🔌 15 MCP │ ⚙️ 2 tasks │ 📝 7
```

*With 4-line high-density mode or compact abbreviations in narrow split panes:*
```text
📁 Core (main*) │ 🌿 Clean │ Flash [HIGH] │ [WRK]
Ctx: [██░░] 22% ⚡93% │ 5h: 53% (3.5h) │ Wk: 27%
🔌 15 │ ⚙️ 2 │ 🤖 1 │ 📝 7 │ ⏳ 1
🛡️ Sandbox │ 🔑 API-Key │ ⏱️ 24m
```

---

## ✨ Features

- **📐 1 to 4 Configurable Lines (`lines: 1..4`)**: Scale your footer footer density from ultra-minimal single-line to a 4-tier cockpit.
- **🗜️ Per-Item & Global Text Shortening (`full`, `short`, `minimal`, `auto`)**: Keep all essential metrics visible in narrow split panes without text clipping.
- **📊 Real-Time Context & Prompt Cache Telemetry**: Visual block progress bars, token count summaries, and cache hit efficiency rates.
- **⏳ Dual Rolling Quota Reserves**: Simultaneous tracking of your 5-hour rolling rate limits with countdown reset timers (`↻ 3h 14m`) and weekly quotas.
- **⏱️ Color-Graded Session Uptime**: Dynamic elapsed time tracking with configurable color thresholds (Green $\rightarrow$ Yellow $\rightarrow$ Magenta $\rightarrow$ Red).
- **🍴 Clean-State Milestone Fork Advisory (`hud fork`)**: Context and step-aware fork recommendations strictly adhering to the **Golden Rule** (suppressed during in-flight dirty edits, active exclusively at clean milestone boundaries).
- **🎨 Drag-and-Drop Web GUI Configurator (`hud gui`)**: Zero-dependency local web configurator on `http://localhost:3847` with live simulated terminal previews.
- **🏷️ Terminal Window & Tab Title Synchronization**: Broadcasts ANSI OSC 0 escape sequences to keep your Windows Terminal tabs labeled with project and workspace names.
- **⚡ Zero External Dependencies**: Powered entirely by native Node.js core modules.

---

## 📦 Installation

### Quick 1-Click PowerShell Setup (Windows)

Clone the repository and run the automated installer:

```powershell
git clone https://github.com/aj1126/antigravity-hud.git B:\Repos\antigravity-hud
cd B:\Repos\antigravity-hud
.\install.ps1
```

The installer automatically copies `hud.js` and `hud_gui.html` to `~/.gemini/scripts/` and registers the `statusLine` command hook in your Antigravity settings.

---

## ⚙️ Configuration

Your configuration lives at `~/.gemini/hud_config.json`:

```json
{
  "lines": 2,
  "separator": "│",
  "compact_mode": "auto",
  "line1": [
    "workspace",
    "git_status",
    "model",
    "state",
    "auth",
    "sandbox",
    "session"
  ],
  "line2": [
    "context",
    "fork",
    "quota_5h",
    "quota_weekly",
    "mcp",
    "subagents",
    "tasks",
    "artifacts",
    "queue"
  ],
  "line3": [],
  "line4": [],
  "disabled": [],
  "item_styles": {
    "model": "short",
    "context": "short"
  },
  "session_uptime": {
    "show_seconds": true,
    "thresholds": [
      { "max_minutes": 15, "color": "green" },
      { "max_minutes": 45, "color": "yellow" },
      { "max_minutes": 90, "color": "magenta" },
      { "max_minutes": null, "color": "red" }
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

## ⌨️ CLI Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `hud` / `hud list` | Inspect active layout, enabled items, and styles | `hud list` |
| `hud lines <1-4>` | Set number of display lines (1 to 4) | `hud lines 3` |
| `hud compact <mode>` | Set global compact mode (`auto`, `full`, `short`, `minimal`) | `hud compact short` |
| `hud style <item> <style>` | Set style override for a specific item | `hud style context short` |
| `hud style reset` | Reset all item style overrides to auto | `hud style reset` |
| `hud gui` | Launch local Drag-and-Drop Web Configurator | `hud gui` |
| `hud uptime` | View/configure session uptime color thresholds | `hud uptime thresholds 15:green,45:yellow,max:red` |
| `hud fork` | View Fork Advisory status and thresholds | `hud fork status` |
| `hud fork snooze [min]` | Snooze fork warning badge (default 30m) | `hud fork snooze 45` |
| `hud title <name>` | Set custom session & terminal tab title | `hud title "Feature Refactor"` |
| `hud ticker <sec>` | Adjust statusline refresh interval | `hud ticker 1` |
| `hud toggle <item>` | Toggle an item ON or OFF | `hud toggle sandbox` |
| `hud edit` | Open `hud_config.json` in default text editor | `hud edit` |
| `hud reset` | Revert configuration to defaults | `hud reset` |

---

## 🧩 Supported Statusline Elements

| Item Key | Description | Full Sample | Minimal Sample |
| :--- | :--- | :--- | :--- |
| **`workspace`** | Folder, project & Git branch with ahead/behind | `📁 App (⎇ main * ↑1)` | `📁 App` |
| **`git_status`**| Working directory Clean / Dirty status | `🌿 Clean` / `⚠️ Dirty (+1)` | `🌿` / `⚠️` |
| **`model`** | Active AI model & reasoning effort | `Gemini 3.7 Flash [🧠 HIGH]` | `Flash` |
| **`state`** | Agent lifecycle status | `[WORKING]` / `[IDLE]` | `●` |
| **`session`** | Real-time session elapsed uptime | `⏱️ 1h 24m 15s` | `⏱️ 84m` |
| **`context`** | Visual progress bar, tokens & cache hit rate | `Ctx: [██░░] 22% (229k) (⚡ 93%)` | `Ctx: 22%` |
| **`fork`** | Milestone-aware fork advisory badge | `🍴 Milestone: consider /fork (65%)` | `🍴 /fork` |
| **`quota_5h`** | 5-hour rolling token reserve & countdown | `Quota: 53% (↻ 3h 34m)` | `5h: 53%` |
| **`quota_weekly`**| Weekly quota token reserve % | `Wk: 27%` | `Wk: 27%` |
| **`mcp`** | Active Model Context Protocol tools | `🔌 15 MCP` | `🔌 15` |
| **`tasks`** | Active background processes | `⚙️ 2 tasks` | `⚙️ 2` |
| **`subagents`** | Running background subagent workers | `🤖 1 subagent` | `🤖 1` |
| **`artifacts`** | Persisted brain artifact documents | `📝 7` | `📝 7` |
| **`queue`** | Pending turns & messages | `⏳ 2 queued` | `⏳ 2` |
| **`auth`** | Security authentication provider | `🔑 API-Key` / `🔑 OAuth` | `🔑` |
| **`sandbox`** | Container sandbox security status | `🛡️ Sandbox` | `🛡️` |

---

## 🔒 Security & Privacy

`antigravity-hud` is designed with a **zero-leak** privacy architecture:
- **No Telemetry Outbound**: Runs 100% locally on your machine without external analytics or network calls.
- **Dynamic Path Resolution**: Resolves all user profiles dynamically using environment variables (`$HOME`, `$env:USERPROFILE`).
- **Zero Credentials**: Never inspects, extracts, or exposes raw API keys, tokens, or private secrets.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
