# 🏗️ Antigravity HUD System Architecture

A high-performance, real-time TUI statusline HUD, live telemetry monitor, bidirectional runtime synchronizer, and zero-quota lifecycle suite for Antigravity AI Agent sessions.

---

## 🏛️ System Component Architecture

```mermaid
flowchart TD
    subgraph Host["Antigravity Host Runtime"]
        AGY["Antigravity Process (agy.exe)"]
        STDIN["JSON Telemetry Stdio Stream"]
        SETT["settings.json (statusLine Hook)"]
    end

    subgraph HUD["HUD Engine (bin/hud.js)"]
        PARSER["Payload Parser & Context Analyzer"]
        RENDER["Multi-Line Render Pipeline (1-4 Lines)"]
        STYLE["Adaptive Width & Style Resolver"]
        OSC["ANSI OSC 0 Tab Title Broadcaster"]
    end

    subgraph SyncEngine["Bidirectional Sync & Backup (Sync-AgyHud.ps1)"]
        DIFF["SHA-256 Parity & Drift Detector"]
        BACKUP["Runtime -> GitHub Repo Backup"]
        DEPLOY["Repo -> Active Runtime Deploy"]
        WATCH["Live 2-Way Watcher (400ms Debounce)"]
    end

    subgraph Hooks["Zero-Quota Lifecycle Suite"]
        START["on_session_start.ps1"]
        EXIT["on_session_exit.ps1"]
        PRE["pre_tool_guard.js"]
        POST["post_tool_format.js"]
    end

    AGY -->|Pipes stdin| STDIN
    STDIN --> PARSER
    PARSER --> STYLE
    STYLE --> RENDER
    RENDER -->|Writes stdout| AGY
    RENDER -->|Emits OSC 0| OSC
    SETT -.->|Invokes| HUD

    SyncEngine <-->|Dual Sync| HUD
    Hooks <-->|Lifecycle Guard| Host
```

---

## ⚡ Data Flow & Sub-Millisecond Rendering

1. **Stdio Ingestion:** Antigravity periodically pipes session telemetry JSON to `bin/hud.js` via `process.stdin`.
2. **Local Telemetry Extraction:**
   - Evaluates token counts, cache read percentages, and 5-hour/weekly quotas.
   - Inspects transcript step count locally from disk (`transcript.jsonl`).
   - Evaluates Git clean/dirty state via fast local subshell.
3. **Layout & Style Resolution:**
   - Inspects terminal column width and per-item style overrides (`item_styles`).
   - Renders 1 to 4 configurable lines delimited by custom separators (`│`).
4. **ANSI Emission & Tab Synchronization:**
   - Broadcasts ANSI OSC 0 escape sequences (`\x1b]0;[agy] <workspace>\x07`) to dynamically label Windows Terminal tabs.
   - Emits formatted multi-line statusline to `process.stdout` in **< 15 milliseconds**.
