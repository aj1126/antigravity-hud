# 🧠 Learning Proposal: Codification of Performance, Documentation & Quality Invariants

Based on the successful completion of the **v2.3.0** performance optimization, automated documentation engine, 8-suite test matrix, and PR #1 merge milestones, this proposal codifies 4 core architectural and operational patterns into the canonical knowledge base and global rules.

---

## 🎯 Target Locations

1. **`~/.gemini/antigravity/knowledge/runtime_drift_and_self_healing_protocol.md`** (Canonical Knowledge Layer).
2. **`B:\Repos\antigravity-hud\.agents/AGENTS.md`** (Workspace Invariants).

---

## 📋 Proposed Invariants to Codify

### 1. Section 14: Sub-10ms Stdio Render Pipeline & Direct Process Spawning Invariant
* **Direct Binary Execution:** In Windows statusline tools, never spawn child processes via intermediate command shells (`cmd.exe /c git ...` or `powershell.exe -Command git ...`). Always invoke binaries directly (`execFileSync('git', ['status', ...], { windowsHide: true })`) to eliminate 15–30ms of shell initialization overhead.
* **In-Memory Micro-Caching:** High-frequency statusline items (e.g. Git status) must use a short in-memory cache (TTL 500–750ms) to eliminate redundant subprocess calls during burst ticks.
* **$O(1)$ Memory Transcript Step Counter:** Transcript step counting must inspect `stat.mtimeMs` and `stat.size`. When unchanged, return cached count instantly without reading or string-splitting 50MB+ JSONL files. For new content, scan byte-level newline character codes (`raw.charCodeAt(i) === 10`) to prevent large array memory allocations.
* **Lazy Telemetry Resolution:** The stdio render loop must construct an `activeItemSet` from enabled lines (`line1..4`) and skip disk/subprocess resolution for disabled or omitted metrics.
* **Debounced Disk Writes:** Write cache updates (`last_quota.json`, session timestamps) must be debounced (5–30s intervals) to prevent disk write amplification on NVMe / Dev Drives.

---

### 2. Section 15: Single-Source-of-Truth (SSOT) Documentation & Staleness Gates
* **Centralized Metadata Generator:** Tooling subcommands, telemetry metrics, configuration options, and hook interfaces must be codified once in code/schema and parsed by an authoritative generator (`scripts/generate_docs.js`).
* **Automated Catalog & Readme Sync:** Generates markdown catalogs in `docs/` and synchronizes tagged `README.md` sections via non-destructive HTML comment markers (`<!-- AUTO-DOC:<SECTION>:START -->` ... `<!-- AUTO-DOC:<SECTION>:END -->`).
* **Continuous Staleness Verification:** The master test suite and CI pipeline must include a mandatory `--check` dry-run staleness gate (`npm run docs:check` / `tests/hud_docs.test.js`) guaranteeing 0% documentation drift across commits.

---

### 3. Section 16: High-DPI Windows Forms Scaling & Headless Execution Defense
* **High-DPI Awareness:** PowerShell WinForms tools (`hud_gui.ps1`) must initialize `SetHighDpiMode([System.Windows.Forms.HighDpiMode]::PerMonitorV2)` inside defensive `try/catch` blocks to ensure crisp rendering without font scaling artifacts on 4K/multi-monitor setups.
* **Headless Safety:** Catch assembly loading failures gracefully in non-interactive/headless environments without throwing unhandled exceptions.

---

### 4. Section 17: Multi-Suite Quality Gate & Performance Microbenchmarking Architecture
* **8-Suite Test Matrix Standard:** Comprehensive coverage across Node.js Engine (Suite 1), WinForms Pester (Suite 2), Web GUI Schema (Suite 3), Settings Integration (Suite 4), Drift & Self-Healing (Suite 5), Lifecycle Hooks (Suite 6), Documentation Parity (Suite 7), and Performance Benchmarks (Suite 8).
* **Warm-Up Microbenchmarks:** Always perform an unmeasured warm-up invocation before starting latency timers to eliminate V8/CLR JIT compilation spikes.
* **Windows NT Process Allocation Thresholds:** Distinguish between in-process microsecond execution (< 1ms) and full Windows NT child process allocation latency (< 250ms).

---

## 🔍 Exact Diffs for `~/.gemini/antigravity/knowledge/runtime_drift_and_self_healing_protocol.md`

```markdown
### 14. Sub-10ms Stdio Render Pipeline & Direct Process Spawning Invariant
* **Direct Binary Execution**: In Windows statusline tools, never spawn child processes via intermediate command shells (`cmd.exe /c git ...`). Always invoke binaries directly (`execFileSync('git', ['status', ...], { windowsHide: true })`) to eliminate 15–30ms of shell initialization overhead.
* **In-Memory Micro-Caching**: High-frequency statusline items (e.g. Git status) use a short in-memory cache (TTL 500–750ms) to eliminate redundant subprocess calls during burst ticks.
* **$O(1)$ Memory Transcript Step Counter**: Transcript step counting inspects `stat.mtimeMs` and `stat.size`. When unchanged, returns cached count instantly without reading or string-splitting 50MB+ JSONL files. For new content, scans byte-level newline character codes (`raw.charCodeAt(i) === 10`) to prevent large array memory allocations.
* **Lazy Telemetry Resolution**: The stdio render loop constructs an `activeItemSet` from enabled lines (`line1..4`) and skips disk/subprocess resolution for disabled or omitted metrics.
* **Debounced Disk Writes**: Write cache updates (`last_quota.json`, session timestamps) are debounced (5–30s intervals) to prevent disk write amplification on NVMe / Dev Drives.

---

### 15. Single-Source-of-Truth (SSOT) Documentation & Staleness Gates
* **Centralized Metadata Generator**: Tooling subcommands, telemetry metrics, configuration options, and hook interfaces are codified once in code/schema and parsed by an authoritative generator (`scripts/generate_docs.js`).
* **Automated Catalog & Readme Sync**: Generates markdown catalogs in `docs/` and synchronizes tagged `README.md` sections via non-destructive HTML comment markers (`<!-- AUTO-DOC:<SECTION>:START -->` ... `<!-- AUTO-DOC:<SECTION>:END -->`).
* **Continuous Staleness Verification**: The master test suite and CI pipeline include a mandatory `--check` dry-run staleness gate (`npm run docs:check` / `tests/hud_docs.test.js`) guaranteeing 0% documentation drift across commits.

---

### 16. High-DPI Windows Forms Scaling & Headless Execution Defense
* **High-DPI Awareness**: PowerShell WinForms tools (`hud_gui.ps1`) initialize `SetHighDpiMode([System.Windows.Forms.HighDpiMode]::PerMonitorV2)` inside defensive `try/catch` blocks to ensure crisp rendering without font scaling artifacts on 4K/multi-monitor setups.
* **Headless Safety**: Catches assembly loading failures gracefully in non-interactive/headless environments without throwing unhandled exceptions.

---

### 17. Multi-Suite Quality Gate & Performance Microbenchmarking Architecture
* **8-Suite Test Matrix Standard**: Comprehensive coverage across Node.js Engine (Suite 1), WinForms Pester (Suite 2), Web GUI Schema (Suite 3), Settings Integration (Suite 4), Drift & Self-Healing (Suite 5), Lifecycle Hooks (Suite 6), Documentation Parity (Suite 7), and Performance Benchmarks (Suite 8).
* **Warm-Up Microbenchmarks**: Always perform an unmeasured warm-up invocation before starting latency timers to eliminate V8/CLR JIT compilation spikes.
* **Windows NT Process Allocation Thresholds**: Distinguish between in-process microsecond execution (< 1ms) and full Windows NT child process allocation latency (< 250ms).
```
