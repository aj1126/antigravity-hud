/**
 * tests/hud_docs.test.js
 * Antigravity HUD - Automated Documentation Parity & Staleness Test Matrix (Suite 7)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const candidateRepoRoots = [
  path.resolve(__dirname, '..'),
  path.join('B:', 'Repos', 'antigravity-hud')
];
const repoRoot = candidateRepoRoots.find(p => fs.existsSync(path.join(p, 'docs')) && fs.existsSync(path.join(p, 'scripts', 'generate_docs.js'))) || path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');
const readmePath = path.join(repoRoot, 'README.md');
const generateDocsScript = path.join(repoRoot, 'scripts', 'generate_docs.js');

console.log('\n\x1b[1m=== Test Suite 7: Documentation Parity, Schema & Staleness Matrix ===\x1b[0m');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.message}`);
  }
}

// 1. All 5 documentation catalog files exist
const requiredDocs = [
  'CLI_REFERENCE.md',
  'TELEMETRY_ITEMS.md',
  'CONFIGURATION_SCHEMA.md',
  'LIFECYCLE_HOOKS.md',
  'ARCHITECTURE.md'
];

runTest('DocCatalog: All 5 canonical markdown documents exist in docs/', () => {
  for (const doc of requiredDocs) {
    const docPath = path.join(docsDir, doc);
    assert(fs.existsSync(docPath), `Document must exist: ${doc}`);
    const stat = fs.statSync(docPath);
    assert(stat.size > 200, `Document must not be empty: ${doc} (${stat.size} bytes)`);
  }
});

// 2. CLI Reference covers all commands
runTest('DocCatalog: CLI_REFERENCE.md documents all core CLI subcommands', () => {
  const content = fs.readFileSync(path.join(docsDir, 'CLI_REFERENCE.md'), 'utf8');
  const expectedCmds = [
    'hud', 'hud lines', 'hud compact', 'hud style', 'hud style reset',
    'hud preset', 'hud toggle', 'hud enable', 'hud disable',
    'hud fork', 'hud uptime', 'hud title', 'hud sync-projects', 'hud ticker',
    'hud diff', 'hud backup', 'hud deploy', 'hud check', 'hud repair',
    'hud gui', 'hud edit', 'hud reset', 'hud help'
  ];
  for (const cmd of expectedCmds) {
    assert(content.includes(`### \`${cmd}\``), `CLI_REFERENCE.md must document subcommand: ${cmd}`);
  }
});

// 3. Telemetry items document covers all 16 items
runTest('DocCatalog: TELEMETRY_ITEMS.md documents all 16 metrics', () => {
  const content = fs.readFileSync(path.join(docsDir, 'TELEMETRY_ITEMS.md'), 'utf8');
  const expectedItems = [
    'workspace', 'git_status', 'model', 'state',
    'context', 'quota_5h', 'quota_weekly', 'session',
    'mcp', 'tasks', 'subagents', 'artifacts', 'queue',
    'sandbox', 'auth', 'fork'
  ];
  for (const item of expectedItems) {
    assert(content.includes(`\`${item}\``), `TELEMETRY_ITEMS.md must document item key: ${item}`);
  }
});

// 4. Lifecycle Hooks document covers all 4 hooks
runTest('DocCatalog: LIFECYCLE_HOOKS.md documents all 4 zero-quota hooks', () => {
  const content = fs.readFileSync(path.join(docsDir, 'LIFECYCLE_HOOKS.md'), 'utf8');
  const expectedHooks = [
    'on_session_start.ps1',
    'on_session_exit.ps1',
    'pre_tool_guard.js',
    'post_tool_format.js'
  ];
  for (const hook of expectedHooks) {
    assert(content.includes(hook), `LIFECYCLE_HOOKS.md must document hook: ${hook}`);
  }
});

// 5. Architecture document contains Mermaid diagrams
runTest('DocCatalog: ARCHITECTURE.md contains system Mermaid architecture diagram', () => {
  const content = fs.readFileSync(path.join(docsDir, 'ARCHITECTURE.md'), 'utf8');
  assert(content.includes('```mermaid'), 'ARCHITECTURE.md must contain Mermaid code blocks');
  assert(content.includes('HUD Engine (bin/hud.js)'), 'ARCHITECTURE.md must reference HUD Engine');
});

// 6. README.md contains synchronization markers and catalog links
runTest('ReadmeSync: README.md contains valid synchronization markers and doc catalog', () => {
  assert(fs.existsSync(readmePath), 'README.md must exist');
  const content = fs.readFileSync(readmePath, 'utf8');
  assert(content.includes('<!-- AUTO-DOC:CLI_TABLE:START -->'), 'README.md missing CLI table start marker');
  assert(content.includes('<!-- AUTO-DOC:CLI_TABLE:END -->'), 'README.md missing CLI table end marker');
  assert(content.includes('<!-- AUTO-DOC:ITEMS_TABLE:START -->'), 'README.md missing Items table start marker');
  assert(content.includes('<!-- AUTO-DOC:ITEMS_TABLE:END -->'), 'README.md missing Items table end marker');
  assert(content.includes('docs/ARCHITECTURE.md'), 'README.md missing link to Architecture doc');
  assert(content.includes('docs/CLI_REFERENCE.md'), 'README.md missing link to CLI Reference');
});

// 7. Dry-Run Staleness Check (Zero Drift)
runTest('DriftCheck: generate_docs.js --check validates 0% documentation drift', () => {
  try {
    const out = execSync(`node "${generateDocsScript}" --check`, { encoding: 'utf8' });
    assert(out.includes('100% synchronized'), 'Dry run output must report 100% synchronized');
  } catch (err) {
    assert.fail(`generate_docs.js --check failed: ${err.message}`);
  }
});

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
