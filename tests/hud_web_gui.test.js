const fs = require('fs');
const path = require('path');
const assert = require('assert');

const homeDir = process.env.USERPROFILE || process.env.HOME || require('os').homedir();
const candidatePaths = [
  path.join(__dirname, '..', 'web', 'hud_gui.html'),
  path.join(__dirname, '..', 'hud_gui.html'),
  path.join(homeDir, '.gemini', 'hud', 'hud_gui.html'),
  path.join(homeDir, '.gemini', 'scripts', 'hud_gui.html')
];
const htmlPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];
const fixtureCfgPath = path.join(__dirname, 'fixtures', 'sample_full_hud_config.json');

console.log('\n\x1b[1m=== Test Suite 3: Web GUI Template & Schema Integrity ===\x1b[0m');

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

// 1. File existence & basic structure
runTest('Template: hud_gui.html exists and contains valid HTML5 doctype', () => {
  assert(fs.existsSync(htmlPath), 'hud_gui.html must exist');
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert(content.includes('<!DOCTYPE html>'), 'Must have HTML5 DOCTYPE');
  assert(content.includes('Antigravity'), 'Must reference Antigravity branding');
});

// 2. All 16 telemetry items present in DOM or JS registry
runTest('Schema: All 16 telemetry items registered in web template', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');
  const items = [
    'workspace', 'git_status', 'model', 'state', 'auth', 'sandbox', 'session',
    'context', 'fork', 'quota_5h', 'quota_weekly', 'mcp', 'subagents', 'tasks',
    'artifacts', 'queue'
  ];
  for (const item of items) {
    assert(content.includes(item), `Item "${item}" must be present in HTML/JS definition`);
  }
});

// 3. Multi-line slots present
runTest('Layout: All 4 line slots represented in drag-and-drop builder', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert(content.includes('line1'), 'Line 1 zone present');
  assert(content.includes('line2'), 'Line 2 zone present');
  assert(content.includes('line3'), 'Line 3 zone present');
  assert(content.includes('line4'), 'Line 4 zone present');
  assert(content.includes('disabled'), 'Disabled pool present');
});

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
