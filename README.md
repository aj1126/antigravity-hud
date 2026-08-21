# 🚀 Antigravity HUD (`antigravity-hud`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)
[![Version](https://img.shields.io/badge/Version-v2.3.0-brightgreen.svg)](CHANGELOG.md)

A high-performance, real-time, multi-line TUI statusline HUD, live telemetry monitor, drag-and-drop layout configurator, bidirectional repository synchronizer, and zero-quota lifecycle guard designed specifically for **Antigravity AI Agent** coding workflows.

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

## ✨ Core Features

- **📐 1 to 4 Configurable Lines (`lines: 1..4`)**: Scale your footer density from ultra-minimal single-line to a 4-tier cockpit.
- **🗜️ Per-Item & Global Text Shortening (`full`, `short`, `minimal`, `auto`)**: Keep all essential metrics visible in narrow split panes without text clipping.
- **📊 Real-Time Context & Prompt Cache Telemetry**: Visual block progress bars, token count summaries, and cache hit efficiency rates.
- **⏳ Dual Rolling Quota Reserves**: Simultaneous tracking of your 5-hour rolling rate limits with countdown reset timers (`↻ 3h 14m`) and weekly quotas.
- **⏱️ Color-Graded Session Uptime**: Dynamic elapsed time tracking with configurable color thresholds (Green $\rightarrow$ Yellow $\rightarrow$ Magenta $\rightarrow$ Red).
- **🍴 Clean-State Milestone Fork Advisory (`hud fork`)**: Context and step-aware fork recommendations strictly adhering to the **Golden Rule** (suppressed during in-flight dirty edits, active exclusively at clean milestone boundaries).
- **🎨 Native Windows Forms & Web GUI Configurators (`hud gui`)**: Zero-dependency lightweight configurator with live simulated previews and dual-sync saving.
- **🔄 Bidirectional Repository Sync & Backup (`hud backup` / `Sync-AgyHud.ps1 -Backup`)**: Work natively in your active environment (`~/.gemini/scripts/`) and seamlessly backup/deploy changes to your GitHub repo (`B:\Repos\antigravity-hud/`).
- **🛡️ Zero-Quota Lifecycle Hooks Suite**: Prettier formatting, BOM auto-stripping, pre-flight sanity checks, destructive command blocking, and detached post-exit logging with native Windows 11 Toast notifications.
- **🩺 Self-Healing Runtime Integrity & Drift Detection (`hud check` / `hud repair`)**: Automated SHA-256 code file parity checks, BOM stripping, and non-destructive schema hydration.
- **🏷️ Terminal Window & Tab Title Synchronization**: Broadcasts ANSI OSC 0 escape sequences to keep your Windows Terminal tabs labeled with project and workspace names.
- **⚡ Zero External Dependencies**: Powered entirely by native Node.js and PowerShell core modules.

---

## 📦 Installation & Deployment

### Quick 1-Click PowerShell Setup (Windows)

Clone the repository and run the automated installer:

```powershell
git clone https://github.com/aj1126/antigravity-hud.git B:\Repos\antigravity-hud
cd B:\Repos\antigravity-hud
.\install.ps1
```

The installer automatically:
1. Deploys runtime scripts (`hud.js`, `hud_gui.ps1`, `hud_gui.html`, `Sync-AgyHud.ps1`) to `~/.gemini/scripts/`.
2. Deploys the zero-quota lifecycle hooks suite to `~/.gemini/scripts/hooks/`.
3. Registers the clean unquoted `statusLine` hook in your Antigravity `settings.json`.

---

## 🔄 Bidirectional Synchronization & Repository Backup

Work with complete local autonomy in your active runtime directory (`~/.gemini/scripts/`), while keeping your GitHub repository (`B:\Repos\antigravity-hud/`) 100% in sync:

```powershell
# 1. Compare differences between active runtime and GitHub repo
hud diff
# or in PowerShell:
Sync-AgyHud -Diff

# 2. Backup active runtime modifications back to the GitHub repo
hud backup
# or in PowerShell with automatic git commit:
Sync-AgyHud -Backup -Commit -Message "feat: add new custom hud widget"

# 3. Deploy updates from repo to active runtime targets
hud deploy
# or in PowerShell:
Sync-AgyHud -Deploy

# 4. Continuous Live 2-Way Watcher (during rapid refactoring)
Sync-AgyHud -Watch
```

---

## 🛡️ Zero-Quota Lifecycle Hooks Suite

Antigravity HUD includes 4 local, zero-token lifecycle hooks deployed in `~/.gemini/scripts/hooks/`:

1. **`post_tool_format.js`**: Automatically formats edited files via local Prettier / ast-grep and strips harmful UTF-8 BOM preambles with 0 LLM token cost.
2. **`on_session_start.ps1`**: Silent pre-flight sanity check and `.workspace_context/resume-points/` auto-discovery.
3. **`pre_tool_guard.js`**: Intercepts destructive git commands (`git reset --hard`, `git push --force`, `rm -rf`) and monitors rolling quota exhaustion (< 15%).
4. **`on_session_exit.ps1`**: Detached background quad-sync worker that creates session resume points, quad-syncs devlogs, triggers git commits, and delivers native Windows 11 Toast notifications after console closure.

---

## ⌨️ CLI Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `hud` / `hud list` | Inspect active layout, enabled items, and styles | `hud list` |
| `hud diff` | View side-by-side Active vs Repo synchronization status | `hud diff` |
| `hud backup` | Backup active runtime files -> GitHub repository | `hud backup` |
| `hud deploy` | Deploy repository updates -> active runtime directories | `hud deploy` |
| `hud check` | Inspect SHA-256 cryptographic parity and runtime drift | `hud check` |
| `hud repair` | Trigger automated self-healing and schema hydration | `hud repair` |
| `hud lines <1-4>` | Set number of display lines (1 to 4) | `hud lines 3` |
| `hud compact <mode>` | Set global compact mode (`auto`, `full`, `short`, `minimal`) | `hud compact short` |
| `hud style <item> <style>` | Set style override for a specific item | `hud style context short` |
| `hud style reset` | Reset all item style overrides to auto | `hud style reset` |
| `hud gui` | Launch native WinForms & Web Layout Configurator | `hud gui` |
| `hud uptime` | View/configure session uptime color thresholds | `hud uptime thresholds 15:green,45:yellow,max:red` |
| `hud fork` | View Fork Advisory status and thresholds | `hud fork status` |
| `hud fork snooze [min]` | Snooze fork warning badge (default 30m) | `hud fork snooze 45` |
| `hud title <name>` | Set custom session & terminal tab title | `hud title "Feature Refactor"` |
| `hud ticker <sec>` | Adjust statusline refresh interval | `hud ticker 1` |
| `hud toggle <item>` | Toggle an item ON or OFF | `hud toggle sandbox` |
| `hud edit` | Open `hud_config.json` in default text editor | `hud edit` |
| `hud reset` | Revert configuration to defaults | `hud reset` |

---

## 🧩 Supported Statusline Elements (16 Telemetry Metrics)

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
- **No Outbound Telemetry**: Runs 100% locally on your machine without external analytics or network calls.
- **Dynamic Path Resolution**: Resolves all user profiles dynamically using environment variables (`$HOME`, `$env:USERPROFILE`).
- **Zero Credentials**: Never inspects, extracts, or exposes raw API keys, tokens, or private secrets.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
