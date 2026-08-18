const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
const settingsPath = path.join(homeDir, '.gemini', 'settings.json');

console.log('\n\x1b[1m=== Test Suite 4: Settings Integration & Command Wiring ===\x1b[0m');

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

// 1. Settings.json exists and contains statusLine object
runTest('Settings: settings.json statusLine object exists and is enabled', () => {
  assert(fs.existsSync(settingsPath), 'settings.json must exist');
  const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert(parsed.statusLine, 'statusLine config must exist');
  assert.strictEqual(parsed.statusLine.enabled, true, 'statusLine must be enabled');
});

// 2. Command points to valid active hud.js without quotes
runTest('Settings: statusLine.command points to valid active hud.js without quotes', () => {
  const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const cmd = parsed.statusLine.command;
  assert(
    cmd.includes('.gemini/scripts/hud.js') || 
    cmd.includes('.gemini\\scripts\\hud.js') || 
    cmd.includes('.gemini/hud/hud.js') || 
    cmd.includes('.gemini\\hud\\hud.js'), 
    `Command must reference valid active hud.js, got: ${cmd}`
  );
  assert(!cmd.includes('\"') && !cmd.includes('"'), `Command must not contain literal quote characters, got: ${cmd}`);
});

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
