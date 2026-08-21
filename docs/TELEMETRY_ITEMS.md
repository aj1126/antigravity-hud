# 🧩 Telemetry Metrics & Statusline Elements (16 Items)

The Antigravity HUD engine supports **16 real-time telemetry elements** across up to 4 configurable display tiers. Each element features adaptive rendering across `full`, `short`, and `minimal` text condensation modes.

---

## 📊 Summary Table

| Key | Name | Category | Full Sample | Minimal Sample |
| :--- | :--- | :--- | :--- | :--- |
| **`workspace`** | Workspace & Git Branch | Identity & Source Control | `📁 MyProject › Core (⎇ main * ↑1)` | `📁 Core` |
| **`git_status`** | Git Clean / Dirty Status | Identity & Source Control | `🌿 Clean / ⚠️ Dirty (+1 ~2)` | `🌿 / ⚠️` |
| **`model`** | Model & Reasoning Effort | Identity & Source Control | `Gemini 3.7 Flash [🧠 HIGH]` | `Flash` |
| **`state`** | Agent Lifecycle State | Identity & Source Control | `[WORKING]` | `● (colored)` |
| **`context`** | Context Window & Prompt Cache | Resource Quotas & Telemetry | `Ctx: ██░░░░░░░░ 22% (229k tok) (⚡ 93% Cache)` | `Ctx: 22%` |
| **`quota_5h`** | 5-Hour Rolling Quota Reserve | Resource Quotas & Telemetry | `Quota: 53% (↻ 3h 34m)` | `5h: 53%` |
| **`quota_weekly`** | Weekly Quota Reserve | Resource Quotas & Telemetry | `Wk: 80%` | `80%` |
| **`session`** | Session Elapsed Uptime | Resource Quotas & Telemetry | `⏱️ 1h 24m 15s` | `⏱️ 84m` |
| **`mcp`** | Registered MCP Servers | Background Workers & System | `🔌 15 MCP` | `🔌 15` |
| **`tasks`** | Running Background Tasks | Background Workers & System | `⚙️ 2 tasks` | `⚙️ 2` |
| **`subagents`** | Active Subagents | Background Workers & System | `🤖 1 subagent` | `🤖 1` |
| **`artifacts`** | Generated Artifacts Count | Background Workers & System | `📝 7 artifacts` | `📝 7` |
| **`queue`** | Queued Input Messages | Background Workers & System | `⏳ 2 queued` | `⏳ 2` |
| **`sandbox`** | Sandbox Security Mode | Security & Milestones | `🛡️ Sandbox` | `🛡️` |
| **`auth`** | Authentication Provider | Security & Milestones | `🔑 API-Key` | `🔑` |
| **`fork`** | Milestone Fork Advisory | Security & Milestones | `🍴 Milestone: consider /fork (65% • 312s)` | `🍴 /fork` |

---

## 📑 Detailed Metric Breakdown

### 📂 Identity & Source Control

#### `workspace` — Workspace & Git Branch

Active workspace folder, Antigravity project name alias, and Git branch with ahead/behind indicators (`↑1 ↓2`).

* **Payload Data Path:** `payload.workspace.current_dir, payload.cwd`
* **Full Mode Sample:** `📁 MyProject › Core (⎇ main * ↑1)`
* **Short Mode Sample:** `📁 Core (main*)`
* **Minimal Mode Sample:** `📁 Core`
* **Behavior & Styling:** Minimal omits branch; short condenses branch decoration; full displays project alias + branch tracking.

#### `git_status` — Git Clean / Dirty Status

Working directory state indicating whether uncommitted changes exist (`+staged`, `~unstaged`, `?untracked`).

* **Payload Data Path:** `Evaluated locally via `git status --porcelain``
* **Full Mode Sample:** `🌿 Clean / ⚠️ Dirty (+1 ~2)`
* **Short Mode Sample:** `Clean / ⚠️ (+3)`
* **Minimal Mode Sample:** `🌿 / ⚠️`
* **Behavior & Styling:** Green `🌿 Clean` indicates working tree is ready for commit or milestone fork.

#### `model` — Model & Reasoning Effort

Active AI model display name and reasoning effort level (`[🧠 HIGH]`, `[🧠 LOW]`).

* **Payload Data Path:** `payload.model.display_name, payload.model.effort`
* **Full Mode Sample:** `Gemini 3.7 Flash [🧠 HIGH]`
* **Short Mode Sample:** `Flash [HIGH]`
* **Minimal Mode Sample:** `Flash`
* **Behavior & Styling:** Minimal strips effort tag and simplifies name (e.g. `Flash`, `Sonnet`, `Opus`, `Pro`).

#### `state` — Agent Lifecycle State

Current agent execution state (`[WORKING]`, `[IDLE]`, `[WAITING]`, `[ERROR]`).

* **Payload Data Path:** `payload.agent_state, payload.state`
* **Full Mode Sample:** `[WORKING]`
* **Short Mode Sample:** `[WRK]`
* **Minimal Mode Sample:** `● (colored)`
* **Behavior & Styling:** Color coded: Green (`WORKING`), Cyan (`IDLE`), Yellow (`WAITING`), Red (`ERROR`).

### 📂 Resource Quotas & Telemetry

#### `context` — Context Window & Prompt Cache

Real-time context window token utilization percentage, token count summary, visual block bar, and prompt cache hit rate.

* **Payload Data Path:** `payload.context_window.used_percentage, payload.context_window.current_usage`
* **Full Mode Sample:** `Ctx: ██░░░░░░░░ 22% (229k tok) (⚡ 93% Cache)`
* **Short Mode Sample:** `Ctx: [██░░] 22% (229k) ⚡93%`
* **Minimal Mode Sample:** `Ctx: 22%`
* **Behavior & Styling:** Progress bar scales dynamically (10 chars full, 6 chars short, 4 chars minimal).

#### `quota_5h` — 5-Hour Rolling Quota Reserve

Active 5-hour rolling token reserve percentage and countdown reset timer (`↻ 3h 14m`). Automatically selects 3P or Gemini bucket.

* **Payload Data Path:** `payload.quota, payload.quotas, ~/.gemini/tmp/last_quota.json`
* **Full Mode Sample:** `Quota: 53% (↻ 3h 34m)`
* **Short Mode Sample:** `5h: 53% (3.5h)`
* **Minimal Mode Sample:** `5h: 53%`
* **Behavior & Styling:** Color graded: Green (>=50%), Yellow (20-49%), Red (<20%). Caches locally for offline resilience.

#### `quota_weekly` — Weekly Quota Reserve

Weekly secondary quota reserve percentage across Gemini or 3P providers.

* **Payload Data Path:** `payload.quota["gemini-weekly"], payload.quota["3p-weekly"]`
* **Full Mode Sample:** `Wk: 80%`
* **Short Mode Sample:** `Wk: 80%`
* **Minimal Mode Sample:** `80%`
* **Behavior & Styling:** Suppressed when provider does not expose a weekly quota limit.

#### `session` — Session Elapsed Uptime

Color-graded elapsed time since session start with optional seconds display and configurable threshold bands.

* **Payload Data Path:** `payload.session_duration_seconds, payload.started_at, ~/.gemini/tmp/sessions/`
* **Full Mode Sample:** `⏱️ 1h 24m 15s`
* **Short Mode Sample:** `⏱️ 1h 24m`
* **Minimal Mode Sample:** `⏱️ 84m`
* **Behavior & Styling:** Color transitions: Green (<=15m) -> Yellow (<=45m) -> Magenta (<=90m) -> Red (>90m).

### 📂 Background Workers & System

#### `mcp` — Registered MCP Servers

Count of connected Model Context Protocol (MCP) tool servers.

* **Payload Data Path:** `payload.mcp_servers, ~/.gemini/config/mcp_config.json`
* **Full Mode Sample:** `🔌 15 MCP`
* **Short Mode Sample:** `🔌 15`
* **Minimal Mode Sample:** `🔌 15`
* **Behavior & Styling:** Hidden automatically when MCP server count is 0.

#### `tasks` — Running Background Tasks

Count of active, uncompleted background subshell tasks.

* **Payload Data Path:** `payload.background_tasks, payload.running_tasks_count`
* **Full Mode Sample:** `⚙️ 2 tasks`
* **Short Mode Sample:** `⚙️ 2`
* **Minimal Mode Sample:** `⚙️ 2`
* **Behavior & Styling:** Hidden automatically when task count is 0.

#### `subagents` — Active Subagents

Count of running background subagents and specialized workers.

* **Payload Data Path:** `payload.subagents, payload.running_subagents_count`
* **Full Mode Sample:** `🤖 1 subagent`
* **Short Mode Sample:** `🤖 1`
* **Minimal Mode Sample:** `🤖 1`
* **Behavior & Styling:** Hidden automatically when subagent count is 0.

#### `artifacts` — Generated Artifacts Count

Number of brain markdown artifact documents created in the active session.

* **Payload Data Path:** `payload.artifact_count, payload.artifacts`
* **Full Mode Sample:** `📝 7 artifacts`
* **Short Mode Sample:** `📝 7`
* **Minimal Mode Sample:** `📝 7`
* **Behavior & Styling:** Hidden automatically when artifact count is 0.

#### `queue` — Queued Input Messages

Count of pending user-queued prompt turns waiting for execution.

* **Payload Data Path:** `payload.queued_messages_count, payload.pending_input_count`
* **Full Mode Sample:** `⏳ 2 queued`
* **Short Mode Sample:** `⏳ 2`
* **Minimal Mode Sample:** `⏳ 2`
* **Behavior & Styling:** Hidden automatically when queue count is 0.

### 📂 Security & Milestones

#### `sandbox` — Sandbox Security Mode

Container / command execution sandbox protection indicator.

* **Payload Data Path:** `payload.sandbox.enabled, payload.sandbox_enabled`
* **Full Mode Sample:** `🛡️ Sandbox`
* **Short Mode Sample:** `🛡️ Sandboxed`
* **Minimal Mode Sample:** `🛡️`
* **Behavior & Styling:** Hidden when sandbox mode is disabled.

#### `auth` — Authentication Provider

Active authentication provider badge (`API-Key`, `OAuth`, `Vertex`).

* **Payload Data Path:** `payload.auth_type, ~/.gemini/antigravity-cli/settings.json`
* **Full Mode Sample:** `🔑 API-Key`
* **Short Mode Sample:** `🔑 Key`
* **Minimal Mode Sample:** `🔑`
* **Behavior & Styling:** Displays authentication method without exposing sensitive token secrets.

#### `fork` — Milestone Fork Advisory

Context and step-aware recommendation badge advising when to run `/fork <project>` at clean milestone boundaries.

* **Payload Data Path:** `payload.context_window, transcript.jsonl line count, git.dirty`
* **Full Mode Sample:** `🍴 Milestone: consider /fork (65% • 312s)`
* **Short Mode Sample:** `🍴 /fork (65%)`
* **Minimal Mode Sample:** `🍴 /fork`
* **Behavior & Styling:** Enforces Golden Rule: suppressed during dirty edits, triggers at clean milestone boundaries.

