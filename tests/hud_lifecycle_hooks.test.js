const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync } = require('child_process');

const { formatFile, stripBom } = require('../hooks/post_tool_format.js');
const { evaluateCommand } = require('../hooks/pre_tool_guard.js');

console.log('\n\x1b[1m=== Test Suite 6: Antigravity Lifecycle Hooks & Perma-Logging Matrix ===\x1b[0m');

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

const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-hooks-test-'));

// 1. Post-Tool Hook: BOM Stripping
runTest('PostTool: stripBom correctly strips UTF-8 BOM preamble', () => {
  const bomFile = path.join(sandboxDir, 'test_bom.json');
  const bomBuffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"hello":"world"}')]);
  fs.writeFileSync(bomFile, bomBuffer);
  
  assert.strictEqual(stripBom(bomFile), true, 'Must return true when BOM is stripped');
  const resultBuf = fs.readFileSync(bomFile);
  assert.strictEqual(resultBuf[0], 0x7b, 'Byte 0 must now be { (0x7B)');
});

// 2. Post-Tool Hook: Formatting JSON/JS
runTest('PostTool: formatFile handles JSON file cleanly without error', () => {
  const jsonFile = path.join(sandboxDir, 'unformatted.json');
  fs.writeFileSync(jsonFile, '{"a":1,"b":   2}');
  const res = formatFile(jsonFile);
  assert.strictEqual(res.success, true);
});

// 3. Pre-Tool Guard: Destructive Command Detection
runTest('PreToolGuard: accurately blocks destructive git commands', () => {
  const blocked1 = evaluateCommand('git reset --hard HEAD~1');
  assert.strictEqual(blocked1.safe, false, 'Must block git reset --hard');
  assert.strictEqual(blocked1.risk, 'HIGH_RISK_DESTRUCTIVE');

  const blocked2 = evaluateCommand('git push origin main --force');
  assert.strictEqual(blocked2.safe, false, 'Must block git push --force');

  const blocked3 = evaluateCommand('rm -rf /');
  assert.strictEqual(blocked3.safe, false, 'Must block rm -rf /');
});

// 4. Pre-Tool Guard: Allows Safe Commands
runTest('PreToolGuard: allows standard non-destructive development commands', () => {
  const safe1 = evaluateCommand('git status');
  assert.strictEqual(safe1.safe, true);

  const safe2 = evaluateCommand('npm test');
  assert.strictEqual(safe2.safe, true);

  const safe3 = evaluateCommand('pwsh -File ./build.ps1');
  assert.strictEqual(safe3.safe, true);
});

// 5. Pre-Tool Guard: Quota Monitor Advisory
runTest('PreToolGuard: evaluates quota threshold without crashing', () => {
  const evalRes = evaluateCommand('git commit -m "test"');
  assert.strictEqual(evalRes.safe, true);
});

// 6. Session Start Hook: Execution
runTest('SessionStart: on_session_start.ps1 executes cleanly and outputs pre-flight summary', () => {
  const startHook = path.join(__dirname, '..', 'hooks', 'on_session_start.ps1');
  const output = execSync(`pwsh -NoProfile -File "${startHook}" -WorkspaceRoot "${sandboxDir}"`, { encoding: 'utf8' });
  assert(output.includes('[PRE-FLIGHT]'), `Output must contain [PRE-FLIGHT], got: ${output}`);
});

// 7. Session Exit Hook: Execution, Resume Point & Perma-Logging
runTest('SessionExit: on_session_exit.ps1 creates resume point and writes lifecycle log', () => {
  const exitHook = path.join(__dirname, '..', 'hooks', 'on_session_exit.ps1');
  const dummyDevLog = path.join(sandboxDir, 'DEVELOPER_LOG.md');
  fs.writeFileSync(dummyDevLog, '# Dummy Developer Log');

  execSync(`pwsh -NoProfile -File "${exitHook}" -WorkspaceRoot "${sandboxDir}" -SkipPush -TestMode`, { encoding: 'utf8' });

  const latestResume = path.join(sandboxDir, '.workspace_context', 'resume-points', 'resume-point-latest.md');
  assert(fs.existsSync(latestResume), 'resume-point-latest.md must exist');

  const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const jsonlLog = path.join(homeDir, '.gemini', 'logs', 'session_lifecycle.jsonl');
  assert(fs.existsSync(jsonlLog), 'session_lifecycle.jsonl must exist');
});

// Clean up sandbox
try {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
} catch (_) {}

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
