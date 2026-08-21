# 🛡️ Zero-Quota Antigravity Lifecycle Hooks Suite

The Antigravity HUD System includes a local, zero-cloud-token lifecycle hooks suite deployed to `~/.gemini/scripts/hooks/`.

---

## 📋 Hooks Inventory & Execution Lifecycle

| Hook Script | Trigger Event | Purpose | Exit Code |
| :--- | :--- | :--- | :--- |
| **`on_session_start.ps1`** | Executed on Antigravity session initialization | Performs pre-flight health validation, checks git status, and locates cognitive resume points (`.workspace_context/resume-points/`). | `0 (Success / Non-blocking)` |
| **`on_session_exit.ps1`** | Executed on Antigravity session exit or console closure | Spawns a detached background worker to generate session resume points, quad-syncs developer logs, auto-commits git changes, delivers Windows 11 Toast notifications, and writes permanent JSONL logs. | `0 (Success / Detached)` |
| **`pre_tool_guard.js`** | Executed prior to subshell tool execution | Zero-quota local AST and regex guardrail that blocks destructive shell commands (`git reset --hard`, `git push --force`, `rm -rf`) and warns on quota exhaustion (< 15%). | `0 (Safe), 1 (Blocked destructive command)` |
| **`post_tool_format.js`** | Executed after file creation or modification tools | Automatically strips harmful UTF-8 BOM preambles and applies local Prettier formatting with zero LLM token cost. | `0 (Success), 1 (Format failure)` |

---

## 🔍 Detailed Hook Specifications

### 1. `hooks/on_session_start.ps1`
* **Execution Trigger:** Session launch.
* **Operations:**
  - Evaluates local HUD health via `node hud.js check`.
  - Determines Git branch and clean/dirty state without cloud calls.
  - Scans for latest cognitive resume point in `.workspace_context/resume-points/resume-point-latest.md`.
  - Prints clean one-line pre-flight banner to console.

### 2. `hooks/on_session_exit.ps1`
* **Execution Trigger:** Session exit, console closure, or `/exit` command.
* **Operations:**
  - Spawns detached background worker process via `pwsh -Detached`.
  - Generates timestamped resume point (`resume-point-YYYYMMDD_HHMMSS.md` and `resume-point-latest.md`).
  - Quad-syncs `DEVELOPER_LOG.md` across repository and global knowledge mirrors.
  - Commits and pushes changes to remote.
  - Delivers native Windows 11 toast notification with commit SHA.
  - Appends permanent execution log to `~/.gemini/logs/session_lifecycle.jsonl`.

### 3. `hooks/pre_tool_guard.js`
* **Execution Trigger:** Pre-tool invocation.
* **Operations:**
  - Blocks high-risk destructive commands (`git reset --hard`, `git push --force`, `rm -rf`, `drop database`).
  - Evaluates remaining 5-hour rolling quota from `~/.gemini/tmp/last_quota.json`.
  - Emits advisory warning when quota drops below 15% (`Quota Low: Suggest /effort low`).

### 4. `hooks/post_tool_format.js`
* **Execution Trigger:** Post-tool file write or modification.
* **Operations:**
  - Detects and strips harmful UTF-8 BOM preambles (`0xEF, 0xBB, 0xBF`).
  - Executes local non-interactive Prettier formatting on supported files (`.js`, `.ts`, `.json`, `.md`, `.html`, `.css`).
  - Zero token cost / 100% offline.
