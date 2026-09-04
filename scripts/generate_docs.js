#!/usr/bin/env node
/**
 * scripts/generate_docs.js
 * Antigravity CLI (AGY) HUD - Automated Documentation & Reference Generator
 *
 * Deterministically generates comprehensive markdown documentation and synchronizes
 * README tables from a single source of truth (SSOT).
 *
 * Usage:
 *   node scripts/generate_docs.js          # Generate and write docs to docs/ and README.md
 *   node scripts/generate_docs.js --check  # Verify docs are 100% synchronized (dry-run for CI)
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');
const readmePath = path.join(repoRoot, 'README.md');

// =====================================================================
// 1. SINGLE SOURCE OF TRUTH (SSOT) METADATA REGISTRIES
// =====================================================================

const CLI_COMMANDS = [
  // Layout & Density
  {
    cmd: 'hud',
    category: 'Layout & Density',
    aliases: ['hud list', 'hud --list'],
    args: '',
    description: 'Inspect active multi-line layout configuration, enabled items, line slots, and active item styles.',
    example: 'hud',
    notes: 'Default statusline readout when invoked without arguments or piped from Antigravity stdio.'
  },
  {
    cmd: 'hud lines',
    category: 'Layout & Density',
    aliases: ['hud-lines', 'hud lines <1-4>'],
    args: '<1-4>',
    description: 'Set total number of active statusline display lines (1 to 4).',
    example: 'hud lines 4',
    notes: 'Automatically updates `lines` and adjusts `two_line` flag in configuration.'
  },
  {
    cmd: 'hud compact',
    category: 'Layout & Density',
    aliases: ['hud-compact', 'hud compact <mode>'],
    args: '<auto|full|short|minimal>',
    description: 'Set global text condensation mode across all statusline elements.',
    example: 'hud compact short',
    notes: '`auto` adapts dynamically based on terminal width (<70 cols: minimal, <105 cols: short, >=105 cols: full).'
  },
  {
    cmd: 'hud style',
    category: 'Layout & Density',
    aliases: ['hud-style', 'hud style <item> <style>'],
    args: '<item> <auto|full|short|minimal>',
    description: 'Set per-item style override (takes precedence over global text mode).',
    example: 'hud style context short',
    notes: 'Use `hud style reset` to clear all individual item style overrides.'
  },
  {
    cmd: 'hud style reset',
    category: 'Layout & Density',
    aliases: ['hud style-reset'],
    args: '',
    description: 'Clear all per-item formatting overrides and revert to global condensation mode.',
    example: 'hud style reset',
    notes: 'Resets the `item_styles` object in `hud_config.json`.'
  },
  {
    cmd: 'hud preset',
    category: 'Layout & Density',
    aliases: ['hud preset list', 'hud preset load', 'hud preset save'],
    args: '<list|load <name>|save <name>>',
    description: 'Manage and apply pre-configured statusline layout presets.',
    example: 'hud preset load 4line_command_center',
    notes: 'Ships with `4line_command_center`, `3line_cockpit`, `2line_classic`, and `1line_compact`.'
  },

  // Item Toggles & Reordering
  {
    cmd: 'hud toggle',
    category: 'Items & Ordering',
    aliases: ['hud-toggle', 'hud toggle <item>'],
    args: '<item>',
    description: 'Toggle an item between enabled and disabled status.',
    example: 'hud toggle sandbox',
    notes: 'Disabling moves the item into the `disabled` array without losing line ordering.'
  },
  {
    cmd: 'hud enable',
    category: 'Items & Ordering',
    aliases: ['hud-enable', 'hud enable <item> [line1-4]'],
    args: '<item> [line1|line2|line3|line4]',
    description: 'Enable a disabled item and optionally place it on a specific line slot.',
    example: 'hud enable auth line4',
    notes: 'If line slot is omitted, places item on its default canonical line.'
  },
  {
    cmd: 'hud disable',
    category: 'Items & Ordering',
    aliases: ['hud-disable', 'hud disable <item>'],
    args: '<item>',
    description: 'Disable an item and remove it from active statusline output.',
    example: 'hud disable queue',
    notes: 'Reversible at any time with `hud enable <item>`.'
  },

  // Milestones, Session & Identity
  {
    cmd: 'hud fork',
    category: 'Milestones & Identity',
    aliases: ['hud-fork', 'hud fork status'],
    args: '[snooze [min]|unsnooze|thresholds <spec>|enable|disable]',
    description: 'View or configure Milestone Fork Advisory badge, thresholds, and snooze state.',
    example: 'hud fork snooze 30',
    notes: 'Adheres to the Golden Rule: only triggers at clean milestone boundaries (`🌿 Clean` git tree).'
  },
  {
    cmd: 'hud uptime',
    category: 'Milestones & Identity',
    aliases: ['hud-uptime', 'hud uptime thresholds'],
    args: '[show-seconds [on|off]|thresholds <spec>]',
    description: 'Configure session elapsed uptime formatting and color thresholds.',
    example: 'hud uptime show-seconds on',
    notes: 'Color progression: Green (<=15m) -> Yellow (<=45m) -> Magenta (<=90m) -> Red (>90m).'
  },
  {
    cmd: 'hud title',
    category: 'Milestones & Identity',
    aliases: ['hud-title', 'hud title <name|reset>'],
    args: '<name|reset>',
    description: 'Set a custom workspace title or reset back to default folder/project identity.',
    example: 'hud title "Feature Refactor"',
    notes: 'Broadcasts ANSI OSC 0 escape sequences to update Windows Terminal tabs and statusline.'
  },
  {
    cmd: 'hud sync-projects',
    category: 'Milestones & Identity',
    aliases: ['hud-sync-projects'],
    args: '[--force]',
    description: 'Scan Antigravity project definitions and synchronize PascalCase/kebab-case/snake_case aliases for `/fork`.',
    example: 'hud sync-projects',
    notes: 'Enforces invariant: project names and files must never have leading dots.'
  },
  {
    cmd: 'hud ticker',
    category: 'Milestones & Identity',
    aliases: ['hud-ticker', 'hud ticker <sec>'],
    args: '<seconds>',
    description: 'Update Antigravity `settings.json` statusLine polling interval.',
    example: 'hud ticker 1',
    notes: 'Updates `interval`, `interval_seconds`, and `interval_ms` simultaneously.'
  },

  // Runtime Sync & Self-Healing
  {
    cmd: 'hud diff',
    category: 'Runtime Sync & Self-Healing',
    aliases: ['hud-diff', 'Sync-AgyHud -Diff'],
    args: '[--json]',
    description: 'Compare cryptographic SHA-256 parity between active runtime files and repository.',
    example: 'hud diff',
    notes: 'Scans `~/.gemini/scripts/` against repository workspace files.'
  },
  {
    cmd: 'hud backup',
    category: 'Runtime Sync & Self-Healing',
    aliases: ['hud-backup', 'Sync-AgyHud -Backup'],
    args: '[--force]',
    description: 'Safely copy active runtime edits back into the repository workspace.',
    example: 'hud backup',
    notes: 'Includes conflict protection: will not overwrite newer repository files without `--force`.'
  },
  {
    cmd: 'hud deploy',
    category: 'Runtime Sync & Self-Healing',
    aliases: ['hud-deploy', 'Sync-AgyHud -Deploy'],
    args: '[--force]',
    description: 'Deploy canonical repository components to active runtime directories (`~/.gemini/scripts/`, `~/.gemini/hud/`).',
    example: 'hud deploy',
    notes: 'Synchronizes `hud.js`, `hud_gui.ps1`, `hud_gui.html`, `Sync-AgyHud.ps1`, presets, and hooks.'
  },
  {
    cmd: 'hud check',
    category: 'Runtime Sync & Self-Healing',
    aliases: ['hud-check', 'hud status'],
    args: '[--json]',
    description: 'Perform complete health, drift detection, BOM preamble, and settings wiring check.',
    example: 'hud check',
    notes: 'Reports 100% HEALTHY when all SHA-256 hashes match and settings hooks are correctly wired.'
  },
  {
    cmd: 'hud repair',
    category: 'Runtime Sync & Self-Healing',
    aliases: ['hud-repair', 'hud fix'],
    args: '[--force]',
    description: 'Trigger self-healing auto-repair: strips BOM preambles, restores missing files, and hydratres missing schema keys.',
    example: 'hud repair',
    notes: 'Preserves user customizations while restoring damaged runtime components.'
  },

  // GUI & Editor Utilities
  {
    cmd: 'hud gui',
    category: 'Configurator & Utilities',
    aliases: ['hud-gui', 'hud config'],
    args: '',
    description: 'Launch native Windows Forms interactive statusline layout configurator.',
    example: 'hud gui',
    notes: 'Zero-dependency desktop GUI with live multi-line preview, item reordering, and dual-sync saving.'
  },
  {
    cmd: 'hud edit',
    category: 'Configurator & Utilities',
    aliases: ['hud-edit'],
    args: '',
    description: 'Open `hud_config.json` in default system text editor (VS Code, Notepad).',
    example: 'hud edit',
    notes: 'Opens the active configuration path resolved from `HUD_CONFIG_PATH` or `~/.gemini/scripts/`.'
  },
  {
    cmd: 'hud reset',
    category: 'Configurator & Utilities',
    aliases: ['hud-reset'],
    args: '',
    description: 'Reset statusline configuration back to factory default 4-Line Command Center layout.',
    example: 'hud reset',
    notes: 'Overwrites `hud_config.json` with canonical default settings.'
  },
  {
    cmd: 'hud credits',
    category: 'Configurator & Utilities',
    aliases: ['hud-credits', 'hud credit'],
    args: '[amount|clear]',
    description: 'View current Model AI Credits balance or set a new credit amount locally (zero-quota overhead).',
    example: 'hud credits 2348',
    notes: 'Caches balance indefinitely in `~/.gemini/tmp/last_credits.json` with zero API quota overhead, automatically activating vibrant amber `[0Q Active]` alert styling on Line 2 when 5h quota hits 0%.'
  },
  {
    cmd: 'hud help',
    category: 'Configurator & Utilities',
    aliases: ['hud --help', 'hud -h'],
    args: '',
    description: 'Print complete formatted CLI command manual with colored examples.',
    example: 'hud help',
    notes: 'Displays all available subcommands, argument syntax, and usage notes.'
  }
];

const TELEMETRY_ITEMS = [
  {
    key: 'workspace',
    category: 'Identity & Source Control',
    name: 'Workspace & Git Branch',
    description: 'Active workspace folder, Antigravity project name alias, and Git branch with ahead/behind indicators (`↑1 ↓2`).',
    payloadPath: 'payload.workspace.current_dir, payload.cwd',
    fullSample: '📁 MyProject › Core (⎇ main * ↑1)',
    shortSample: '📁 Core (main*)',
    minimalSample: '📁 Core',
    stylingNotes: 'Minimal omits branch; short condenses branch decoration; full displays project alias + branch tracking.'
  },
  {
    key: 'git_status',
    category: 'Identity & Source Control',
    name: 'Git Clean / Dirty Status',
    description: 'Working directory state indicating whether uncommitted changes exist (`+staged`, `~unstaged`, `?untracked`).',
    payloadPath: 'Evaluated locally via `git status --porcelain`',
    fullSample: '🌿 Clean / ⚠️ Dirty (+1 ~2)',
    shortSample: 'Clean / ⚠️ (+3)',
    minimalSample: '🌿 / ⚠️',
    stylingNotes: 'Green `🌿 Clean` indicates working tree is ready for commit or milestone fork.'
  },
  {
    key: 'model',
    category: 'Identity & Source Control',
    name: 'Model & Reasoning Effort',
    description: 'Active AI model display name and reasoning effort level (`[🧠 HIGH]`, `[🧠 LOW]`).',
    payloadPath: 'payload.model.display_name, payload.model.effort',
    fullSample: 'Gemini 3.7 Flash [🧠 HIGH]',
    shortSample: 'Flash [HIGH]',
    minimalSample: 'Flash',
    stylingNotes: 'Minimal strips effort tag and simplifies name (e.g. `Flash`, `Sonnet`, `Opus`, `Pro`).'
  },
  {
    key: 'state',
    category: 'Identity & Source Control',
    name: 'Agent Lifecycle State',
    description: 'Current agent execution state (`[WORKING]`, `[IDLE]`, `[WAITING]`, `[ERROR]`).',
    payloadPath: 'payload.agent_state, payload.state',
    fullSample: '[WORKING]',
    shortSample: '[WRK]',
    minimalSample: '● (colored)',
    stylingNotes: 'Color coded: Green (`WORKING`), Cyan (`IDLE`), Yellow (`WAITING`), Red (`ERROR`).'
  },
  {
    key: 'context',
    category: 'Resource Quotas & Telemetry',
    name: 'Context Window & Prompt Cache',
    description: 'Real-time context window token utilization percentage, token count summary, visual block bar, and prompt cache hit rate.',
    payloadPath: 'payload.context_window.used_percentage, payload.context_window.current_usage',
    fullSample: 'Ctx: ██░░░░░░░░ 22% (229k tok) (⚡ 93% Cache)',
    shortSample: 'Ctx: [██░░] 22% (229k) ⚡93%',
    minimalSample: 'Ctx: 22%',
    stylingNotes: 'Progress bar scales dynamically (10 chars full, 6 chars short, 4 chars minimal).'
  },
  {
    key: 'quota_5h',
    category: 'Resource Quotas & Telemetry',
    name: '5-Hour Rolling Quota Reserve',
    description: 'Active 5-hour rolling token reserve percentage and countdown reset timer (`↻ 3h 14m`). Automatically selects 3P or Gemini bucket.',
    payloadPath: 'payload.quota, payload.quotas, ~/.gemini/tmp/last_quota.json',
    fullSample: 'Quota: 53% (↻ 3h 34m)',
    shortSample: '5h: 53% (3.5h)',
    minimalSample: '5h: 53%',
    stylingNotes: 'Color graded: Green (>=50%), Yellow (20-49%), Red (<20%). Caches locally for offline resilience.'
  },
  {
    key: 'quota_weekly',
    category: 'Resource Quotas & Telemetry',
    name: 'Weekly Quota Reserve',
    description: 'Weekly secondary quota reserve percentage across Gemini or 3P providers.',
    payloadPath: 'payload.quota["gemini-weekly"], payload.quota["3p-weekly"]',
    fullSample: 'Wk: 80%',
    shortSample: 'Wk: 80%',
    minimalSample: '80%',
    stylingNotes: 'Suppressed when provider does not expose a weekly quota limit.'
  },
  {
    key: 'session',
    category: 'Resource Quotas & Telemetry',
    name: 'Session Elapsed Uptime',
    description: 'Color-graded elapsed time since session start with optional seconds display and configurable threshold bands.',
    payloadPath: 'payload.session_duration_seconds, payload.started_at, ~/.gemini/tmp/sessions/',
    fullSample: '⏱️ 1h 24m 15s',
    shortSample: '⏱️ 1h 24m',
    minimalSample: '⏱️ 84m',
    stylingNotes: 'Color transitions: Green (<=15m) -> Yellow (<=45m) -> Magenta (<=90m) -> Red (>90m).'
  },
  {
    key: 'mcp',
    category: 'Background Workers & System',
    name: 'Registered MCP Servers',
    description: 'Count of connected Model Context Protocol (MCP) tool servers.',
    payloadPath: 'payload.mcp_servers, ~/.gemini/config/mcp_config.json',
    fullSample: '🔌 15 MCP',
    shortSample: '🔌 15',
    minimalSample: '🔌 15',
    stylingNotes: 'Hidden automatically when MCP server count is 0.'
  },
  {
    key: 'tasks',
    category: 'Background Workers & System',
    name: 'Running Background Tasks',
    description: 'Count of active, uncompleted background subshell tasks.',
    payloadPath: 'payload.background_tasks, payload.running_tasks_count',
    fullSample: '⚙️ 2 tasks',
    shortSample: '⚙️ 2',
    minimalSample: '⚙️ 2',
    stylingNotes: 'Hidden automatically when task count is 0.'
  },
  {
    key: 'subagents',
    category: 'Background Workers & System',
    name: 'Active Subagents',
    description: 'Count of running background subagents and specialized workers.',
    payloadPath: 'payload.subagents, payload.running_subagents_count',
    fullSample: '🤖 1 subagent',
    shortSample: '🤖 1',
    minimalSample: '🤖 1',
    stylingNotes: 'Hidden automatically when subagent count is 0.'
  },
  {
    key: 'artifacts',
    category: 'Background Workers & System',
    name: 'Generated Artifacts Count',
    description: 'Number of brain markdown artifact documents created in the active session.',
    payloadPath: 'payload.artifact_count, payload.artifacts',
    fullSample: '📝 7 artifacts',
    shortSample: '📝 7',
    minimalSample: '📝 7',
    stylingNotes: 'Hidden automatically when artifact count is 0.'
  },
  {
    key: 'queue',
    category: 'Background Workers & System',
    name: 'Queued Input Messages',
    description: 'Count of pending user-queued prompt turns waiting for execution.',
    payloadPath: 'payload.queued_messages_count, payload.pending_input_count',
    fullSample: '⏳ 2 queued',
    shortSample: '⏳ 2',
    minimalSample: '⏳ 2',
    stylingNotes: 'Hidden automatically when queue count is 0.'
  },
  {
    key: 'sandbox',
    category: 'Security & Milestones',
    name: 'Sandbox Security Mode',
    description: 'Container / command execution sandbox protection indicator.',
    payloadPath: 'payload.sandbox.enabled, payload.sandbox_enabled',
    fullSample: '🛡️ Sandbox',
    shortSample: '🛡️ Sandboxed',
    minimalSample: '🛡️',
    stylingNotes: 'Hidden when sandbox mode is disabled.'
  },
  {
    key: 'auth',
    category: 'Security & Milestones',
    name: 'Authentication Provider',
    description: 'Active authentication provider badge (`API-Key`, `OAuth`, `Vertex`).',
    payloadPath: 'payload.auth_type, ~/.gemini/antigravity-cli/settings.json',
    fullSample: '🔑 API-Key',
    shortSample: '🔑 Key',
    minimalSample: '🔑',
    stylingNotes: 'Displays authentication method without exposing sensitive token secrets.'
  },
  {
    key: 'fork',
    category: 'Security & Milestones',
    name: 'Milestone Fork Advisory',
    description: 'Context and step-aware recommendation badge advising when to run `/fork <project>` at clean milestone boundaries.',
    payloadPath: 'payload.context_window, transcript.jsonl line count, git.dirty',
    fullSample: '🍴 Milestone: consider /fork (65% • 312s)',
    shortSample: '🍴 /fork (65%)',
    minimalSample: '🍴 /fork',
    stylingNotes: 'Enforces Golden Rule: suppressed during dirty edits, triggers at clean milestone boundaries.'
  }
];

const LIFECYCLE_HOOKS = [
  {
    name: 'on_session_start.ps1',
    path: 'hooks/on_session_start.ps1',
    trigger: 'Executed on Antigravity session initialization',
    purpose: 'Performs pre-flight health validation, checks git status, and locates cognitive resume points (`.workspace_context/resume-points/`).',
    args: '-WorkspaceRoot <path>',
    exitCodes: '0 (Success / Non-blocking)'
  },
  {
    name: 'on_session_exit.ps1',
    path: 'hooks/on_session_exit.ps1',
    trigger: 'Executed on Antigravity session exit or console closure',
    purpose: 'Spawns a detached background worker to generate session resume points, quad-syncs developer logs, auto-commits git changes, delivers Windows 11 Toast notifications, and writes permanent JSONL logs.',
    args: '-WorkspaceRoot <path> [-Detached] [-SkipPush] [-TestMode]',
    exitCodes: '0 (Success / Detached)'
  },
  {
    name: 'pre_tool_guard.js',
    path: 'hooks/pre_tool_guard.js',
    trigger: 'Executed prior to subshell tool execution',
    purpose: 'Zero-quota local AST and regex guardrail that blocks destructive shell commands (`git reset --hard`, `git push --force`, `rm -rf`) and warns on quota exhaustion (< 15%).',
    args: '<command-string>',
    exitCodes: '0 (Safe), 1 (Blocked destructive command)'
  },
  {
    name: 'post_tool_format.js',
    path: 'hooks/post_tool_format.js',
    trigger: 'Executed after file creation or modification tools',
    purpose: 'Automatically strips harmful UTF-8 BOM preambles and applies local Prettier formatting with zero LLM token cost.',
    args: '<target-file-path>',
    exitCodes: '0 (Success), 1 (Format failure)'
  }
];

// =====================================================================
// 2. DOCUMENTATION GENERATORS
// =====================================================================

function generateCliReference() {
  const categories = [...new Set(CLI_COMMANDS.map(c => c.category))];
  
  let md = `# ⌨️ Antigravity HUD CLI Command Reference

Comprehensive manual for the **Antigravity CLI (AGY) HUD System** command-line interface.

All subcommands are accessible via \`hud <command>\`, \`agy-hud <command>\`, or \`node bin/hud.js <command>\`.

---

## 📑 Table of Contents

${categories.map(cat => `- [${cat}](#${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`).join('\n')}

---
`;

  categories.forEach(cat => {
    md += `\n## ${cat}\n\n`;
    const cmds = CLI_COMMANDS.filter(c => c.category === cat);
    
    cmds.forEach(c => {
      md += `### \`${c.cmd}\`\n\n`;
      md += `* **Description:** ${c.description}\n`;
      if (c.args) md += `* **Arguments:** \`${c.args}\`\n`;
      if (c.aliases && c.aliases.length > 0) md += `* **Aliases:** ${c.aliases.map(a => `\`${a}\``).join(', ')}\n`;
      md += `* **Example:** \`${c.example}\`\n`;
      if (c.notes) md += `* **Notes:** ${c.notes}\n`;
      md += `\n`;
    });
  });

  md += `---

## 🛠️ Global Flags & Environment Variables

| Variable / Flag | Description | Default |
| :--- | :--- | :--- |
| \`HUD_CONFIG_PATH\` | Explicit override path to \`hud_config.json\` | \`~/.gemini/scripts/hud_config.json\` |
| \`HUD_TEST_MODE\` | Isolates test runs to prevent mutating runtime cache | \`undefined\` |
| \`--json\` | Outputs structured JSON instead of ANSI terminal formatting | \`false\` |
| \`--force\` | Overrides conflict protection during sync operations | \`false\` |
`;

  return md;
}

function generateTelemetryItemsDoc() {
  const categories = [...new Set(TELEMETRY_ITEMS.map(i => i.category))];

  let md = `# 🧩 Telemetry Metrics & Statusline Elements (16 Items)

The Antigravity HUD engine supports **16 real-time telemetry elements** across up to 4 configurable display tiers. Each element features adaptive rendering across \`full\`, \`short\`, and \`minimal\` text condensation modes.

---

## 📊 Summary Table

| Key | Name | Category | Full Sample | Minimal Sample |
| :--- | :--- | :--- | :--- | :--- |
${TELEMETRY_ITEMS.map(i => `| **\`${i.key}\`** | ${i.name} | ${i.category} | \`${i.fullSample}\` | \`${i.minimalSample}\` |`).join('\n')}

---

## 📑 Detailed Metric Breakdown

`;

  categories.forEach(cat => {
    md += `### 📂 ${cat}\n\n`;
    const items = TELEMETRY_ITEMS.filter(i => i.category === cat);

    items.forEach(item => {
      md += `#### \`${item.key}\` — ${item.name}\n\n`;
      md += `${item.description}\n\n`;
      md += `* **Payload Data Path:** \`${item.payloadPath}\`\n`;
      md += `* **Full Mode Sample:** \`${item.fullSample}\`\n`;
      md += `* **Short Mode Sample:** \`${item.shortSample}\`\n`;
      md += `* **Minimal Mode Sample:** \`${item.minimalSample}\`\n`;
      md += `* **Behavior & Styling:** ${item.stylingNotes}\n\n`;
    });
  });

  return md;
}

function generateConfigSchemaDoc() {
  const cfgSamplePath = path.join(repoRoot, 'bin', 'hud_config.json');
  let cfgSample = '{}';
  if (fs.existsSync(cfgSamplePath)) {
    cfgSample = fs.readFileSync(cfgSamplePath, 'utf8');
  }

  let md = `# ⚙️ Configuration Schema (\`hud_config.json\`)

The Antigravity HUD configuration is stored in JSON format at \`~/.gemini/scripts/hud_config.json\` and synchronized with \`~/.gemini/hud/hud_config.json\`.

---

## 📋 Default Configuration Sample

\`\`\`json
${cfgSample}
\`\`\`

---

## 🔍 Schema Properties Specification

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| \`name\` | \`string\` | \`"4-Line Command Center"\` | Descriptive name of the active layout configuration. |
| \`description\` | \`string\` | \`"High-density 4-tier statusline..."\` | Summary of layout purpose and density tier. |
| \`lines\` | \`integer (1-4)\` | \`4\` | Total number of lines rendered in the statusline footer. |
| \`two_line\` | \`boolean\` | \`true\` | Backward-compatible flag (true if \`lines >= 2\`). |
| \`separator\` | \`string\` | \`"│"\` | Character delimiter placed between items (e.g. \`│\`, \`\|\`, \`•\`, \`/\`). |
| \`compact_mode\` | \`string\` | \`"auto"\` | Global text condensation mode (\`auto\`, \`full\`, \`short\`, \`minimal\`). |
| \`line1\` | \`array[string]\` | \`["workspace", "git_status", "model", "state"]\` | Telemetry item keys assigned to Line 1 (Top). |
| \`line2\` | \`array[string]\` | \`["context", "quota_5h", "quota_weekly"]\` | Telemetry item keys assigned to Line 2. |
| \`line3\` | \`array[string]\` | \`["mcp", "tasks", "subagents", "artifacts", "queue"]\` | Telemetry item keys assigned to Line 3. |
| \`line4\` | \`array[string]\` | \`["sandbox", "auth", "session", "fork"]\` | Telemetry item keys assigned to Line 4 (Bottom). |
| \`disabled\` | \`array[string]\` | \`[]\` | Explicitly disabled item keys suppressed from all lines. |
| \`item_styles\` | \`object\` | \`{}\` | Per-item formatting overrides (e.g. \`{"context": "short"}\`). |
| \`session_uptime\` | \`object\` | *(see below)* | Uptime display settings and color threshold bands. |
| \`fork_advisory\` | \`object\` | *(see below)* | Milestone fork advisory triggers and thresholds. |

---

### \`session_uptime\` Settings

\`\`\`json
"session_uptime": {
  "show_seconds": true,
  "thresholds": [
    { "max_minutes": 15, "color": "green" },
    { "max_minutes": 45, "color": "yellow" },
    { "max_minutes": 90, "color": "magenta" },
    { "max_minutes": null, "color": "red" }
  ]
}
\`\`\`

---

### \`fork_advisory\` Settings

\`\`\`json
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
\`\`\`

---

## 🎨 Built-in Presets Catalog

Presets are located in \`presets/\` and can be loaded via \`hud preset load <name>\`:

1. **\`4line_command_center\` (4 lines):** High-density command center displaying full system telemetry, security, and milestones.
2. **\`3line_cockpit\` (3 lines):** Balanced 3-tier layout separating workspace identity, resource quotas, and background workers.
3. **\`2line_classic\` (2 lines):** Balanced 2-tier layout optimized for standard terminal dimensions.
4. **\`1line_compact\` (1 line):** Ultra-condensed single-line statusline with minimal footprint.
`;

  return md;
}

function generateLifecycleHooksDoc() {
  let md = `# 🛡️ Zero-Quota Antigravity Lifecycle Hooks Suite

The Antigravity HUD System includes a local, zero-cloud-token lifecycle hooks suite deployed to \`~/.gemini/scripts/hooks/\`.

---

## 📋 Hooks Inventory & Execution Lifecycle

| Hook Script | Trigger Event | Purpose | Exit Code |
| :--- | :--- | :--- | :--- |
${LIFECYCLE_HOOKS.map(h => `| **\`${h.name}\`** | ${h.trigger} | ${h.purpose} | \`${h.exitCodes}\` |`).join('\n')}

---

## 🔍 Detailed Hook Specifications

### 1. \`hooks/on_session_start.ps1\`
* **Execution Trigger:** Session launch.
* **Operations:**
  - Evaluates local HUD health via \`node hud.js check\`.
  - Determines Git branch and clean/dirty state without cloud calls.
  - Scans for latest cognitive resume point in \`.workspace_context/resume-points/resume-point-latest.md\`.
  - Prints clean one-line pre-flight banner to console.

### 2. \`hooks/on_session_exit.ps1\`
* **Execution Trigger:** Session exit, console closure, or \`/exit\` command.
* **Operations:**
  - Spawns detached background worker process via \`pwsh -Detached\`.
  - Generates timestamped resume point (\`resume-point-YYYYMMDD_HHMMSS.md\` and \`resume-point-latest.md\`).
  - Quad-syncs \`DEVELOPER_LOG.md\` across repository and global knowledge mirrors.
  - Commits and pushes changes to remote.
  - Delivers native Windows 11 toast notification with commit SHA.
  - Appends permanent execution log to \`~/.gemini/logs/session_lifecycle.jsonl\`.

### 3. \`hooks/pre_tool_guard.js\`
* **Execution Trigger:** Pre-tool invocation.
* **Operations:**
  - Blocks high-risk destructive commands (\`git reset --hard\`, \`git push --force\`, \`rm -rf\`, \`drop database\`).
  - Evaluates remaining 5-hour rolling quota from \`~/.gemini/tmp/last_quota.json\`.
  - Emits advisory warning when quota drops below 15% (\`Quota Low: Suggest /effort low\`).

### 4. \`hooks/post_tool_format.js\`
* **Execution Trigger:** Post-tool file write or modification.
* **Operations:**
  - Detects and strips harmful UTF-8 BOM preambles (\`0xEF, 0xBB, 0xBF\`).
  - Executes local non-interactive Prettier formatting on supported files (\`.js\`, \`.ts\`, \`.json\`, \`.md\`, \`.html\`, \`.css\`).
  - Zero token cost / 100% offline.
`;

  return md;
}

function generateArchitectureDoc() {
  let md = `# 🏗️ Antigravity HUD System Architecture

A high-performance, real-time TUI statusline HUD, live telemetry monitor, bidirectional runtime synchronizer, and zero-quota lifecycle suite for Antigravity AI Agent sessions.

---

## 🏛️ System Component Architecture

\`\`\`mermaid
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
\`\`\`

---

## ⚡ Data Flow & Sub-Millisecond Rendering

1. **Stdio Ingestion:** Antigravity periodically pipes session telemetry JSON to \`bin/hud.js\` via \`process.stdin\`.
2. **Local Telemetry Extraction:**
   - Evaluates token counts, cache read percentages, and 5-hour/weekly quotas.
   - Inspects transcript step count locally from disk (\`transcript.jsonl\`).
   - Evaluates Git clean/dirty state via fast local subshell.
3. **Layout & Style Resolution:**
   - Inspects terminal column width and per-item style overrides (\`item_styles\`).
   - Renders 1 to 4 configurable lines delimited by custom separators (\`│\`).
4. **ANSI Emission & Tab Synchronization:**
   - Broadcasts ANSI OSC 0 escape sequences (\`\\x1b]0;[agy] <workspace>\\x07\`) to dynamically label Windows Terminal tabs.
   - Emits formatted multi-line statusline to \`process.stdout\` in **< 15 milliseconds**.
`;

  return md;
}

// =====================================================================
// 3. README SYNC ENGINE
// =====================================================================

function generateReadmeCliTable() {
  let md = `| Command | Description | Example |\n| :--- | :--- | :--- |\n`;
  CLI_COMMANDS.forEach(c => {
    md += `| \`${c.cmd}\` | ${c.description} | \`${c.example}\` |\n`;
  });
  return md;
}

function generateReadmeItemsTable() {
  let md = `| Item Key | Description | Full Sample | Minimal Sample |\n| :--- | :--- | :--- | :--- |\n`;
  TELEMETRY_ITEMS.forEach(i => {
    md += `| **\`${i.key}\`** | ${i.name} — ${i.description.split('.')[0]} | \`${i.fullSample}\` | \`${i.minimalSample}\` |\n`;
  });
  return md;
}

function updateReadmeContent(currentReadme) {
  let updated = currentReadme;

  // Sync CLI Table
  const cliStart = '<!-- AUTO-DOC:CLI_TABLE:START -->';
  const cliEnd = '<!-- AUTO-DOC:CLI_TABLE:END -->';
  const cliTable = `\n${generateReadmeCliTable()}\n`;

  if (updated.includes(cliStart) && updated.includes(cliEnd)) {
    const regex = new RegExp(`${cliStart}[\\s\\S]*?${cliEnd}`);
    updated = updated.replace(regex, `${cliStart}${cliTable}${cliEnd}`);
  }

  // Sync Items Table
  const itemsStart = '<!-- AUTO-DOC:ITEMS_TABLE:START -->';
  const itemsEnd = '<!-- AUTO-DOC:ITEMS_TABLE:END -->';
  const itemsTable = `\n${generateReadmeItemsTable()}\n`;

  if (updated.includes(itemsStart) && updated.includes(itemsEnd)) {
    const regex = new RegExp(`${itemsStart}[\\s\\S]*?${itemsEnd}`);
    updated = updated.replace(regex, `${itemsStart}${itemsTable}${itemsEnd}`);
  }

  return updated;
}

// =====================================================================
// 4. EXECUTION & DRIFT DETECTION (--check)
// =====================================================================

function main() {
  const isCheckMode = process.argv.includes('--check');

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const generatedFiles = {
    [path.join(docsDir, 'CLI_REFERENCE.md')]: generateCliReference(),
    [path.join(docsDir, 'TELEMETRY_ITEMS.md')]: generateTelemetryItemsDoc(),
    [path.join(docsDir, 'CONFIGURATION_SCHEMA.md')]: generateConfigSchemaDoc(),
    [path.join(docsDir, 'LIFECYCLE_HOOKS.md')]: generateLifecycleHooksDoc(),
    [path.join(docsDir, 'ARCHITECTURE.md')]: generateArchitectureDoc()
  };

  let readmeDrift = false;
  let currentReadme = '';
  let updatedReadme = '';
  if (fs.existsSync(readmePath)) {
    currentReadme = fs.readFileSync(readmePath, 'utf8');
    updatedReadme = updateReadmeContent(currentReadme);
    if (currentReadme !== updatedReadme) {
      readmeDrift = true;
    }
  }

  let driftDetected = false;
  const driftList = [];

  for (const [filePath, content] of Object.entries(generatedFiles)) {
    const relName = path.relative(repoRoot, filePath);
    if (!fs.existsSync(filePath)) {
      driftDetected = true;
      driftList.push(`Missing file: ${relName}`);
    } else {
      const existing = fs.readFileSync(filePath, 'utf8');
      if (existing.replace(/\r\n/g, '\n') !== content.replace(/\r\n/g, '\n')) {
        driftDetected = true;
        driftList.push(`Stale content: ${relName}`);
      }
    }
  }

  if (readmeDrift) {
    driftDetected = true;
    driftList.push(`Stale table sections in README.md`);
  }

  if (isCheckMode) {
    if (driftDetected) {
      console.error('\x1b[31m[FAIL] Documentation drift detected:\x1b[0m');
      driftList.forEach(d => console.error(`  • ${d}`));
      console.error('\nRun \x1b[33mnpm run docs\x1b[0m to regenerate documentation catalog.');
      process.exit(1);
    } else {
      console.log('\x1b[32m✔ Documentation catalog is 100% synchronized and up-to-date.\x1b[0m');
      process.exit(0);
    }
  }

  // Write mode: Generate and write all files
  console.log('\n=== Generating Antigravity HUD Documentation Catalog ===\n');
  for (const [filePath, content] of Object.entries(generatedFiles)) {
    const relName = path.relative(repoRoot, filePath);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  \x1b[32m✔\x1b[0m Generated: ${relName}`);
  }

  if (updatedReadme && currentReadme !== updatedReadme) {
    fs.writeFileSync(readmePath, updatedReadme, 'utf8');
    console.log(`  \x1b[32m✔\x1b[0m Synchronized tables in README.md`);
  } else if (updatedReadme) {
    console.log(`  \x1b[90m•\x1b[0m README.md tables already in sync`);
  }

  console.log('\n\x1b[32m[OK] Automated documentation generation completed successfully!\x1b[0m\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  CLI_COMMANDS,
  TELEMETRY_ITEMS,
  LIFECYCLE_HOOKS,
  generateCliReference,
  generateTelemetryItemsDoc,
  generateConfigSchemaDoc,
  generateLifecycleHooksDoc,
  generateArchitectureDoc,
  updateReadmeContent
};
