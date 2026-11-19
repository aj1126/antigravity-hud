const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync, spawnSync } = require('child_process');

const { formatFile, stripBom } = require('../hooks/post_tool_format.js');
const guardMod = require('../hooks/pre_tool_guard.js');
const { evaluateCommand } = guardMod;
const preToolGuardPath = path.join(__dirname, '..', 'hooks', 'pre_tool_guard.js');

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
runTest('PreToolGuard: evaluates quota threshold without crashing and emits LOW_QUOTA_WARNING when weekly quota < 15%', () => {
  const evalRes = evaluateCommand('git commit -m "test"');
  assert.strictEqual(evalRes.safe, true);

  const testQuotaFile = path.join(sandboxDir, 'test_low_quota.json');
  fs.writeFileSync(testQuotaFile, JSON.stringify({
    q5hPercent: 85,
    qWkPercent: 12,
    qArgonWkPercent: 12,
    qFlashWkPercent: 100,
    updatedAt: Date.now()
  }), 'utf8');
  const prevEnv = process.env.HUD_TEST_QUOTA_FILE;
  process.env.HUD_TEST_QUOTA_FILE = testQuotaFile;
  try {
    const lowWkRes = evaluateCommand('git status');
    assert.strictEqual(lowWkRes.safe, true);
    assert(lowWkRes.warning && lowWkRes.warning.includes('Weekly Quota Low (Wk: 12% remaining)'), `Expected Weekly Quota Low message, got: ${lowWkRes.warning}`);
    assert(lowWkRes.warning.includes('Wk(A)') && lowWkRes.warning.includes('Wk(G)'), `Expected Wk(A) and Wk(G) guidance, got: ${lowWkRes.warning}`);
  } finally {
    if (prevEnv === undefined) delete process.env.HUD_TEST_QUOTA_FILE;
    else process.env.HUD_TEST_QUOTA_FILE = prevEnv;
  }
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

// 8. Pre-Tool Guard: Blocks claude3 CLI invocation
runTest('PreToolGuard: blocks claude3 CLI invocation', () => {
  const res1 = evaluateCommand('claude3');
  assert.strictEqual(res1.safe, false, 'Must block bare claude3');
  assert.strictEqual(res1.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res2 = evaluateCommand('cd B:\\Repos; claude3 --version');
  assert.strictEqual(res2.safe, false, 'Must block chained claude3 --version');
  assert.strictEqual(res2.risk, 'CROSS_AGENT_CLI_BLOCKED');
});

// 9. Pre-Tool Guard: Blocks claude2 CLI invocation
runTest('PreToolGuard: blocks claude2 CLI invocation', () => {
  const res1 = evaluateCommand('claude2');
  assert.strictEqual(res1.safe, false, 'Must block bare claude2');
  assert.strictEqual(res1.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res2 = evaluateCommand('cmd /c claude2 --version');
  assert.strictEqual(res2.safe, false, 'Must block cmd /c claude2 --version');
  assert.strictEqual(res2.risk, 'CROSS_AGENT_CLI_BLOCKED');
});

// 10. Pre-Tool Guard: Blocks claude.exe and full-path claude.exe invocations
runTest('PreToolGuard: blocks claude.exe and full-path claude.exe invocations', () => {
  const res1 = evaluateCommand('claude.exe');
  assert.strictEqual(res1.safe, false, 'Must block bare claude.exe');
  assert.strictEqual(res1.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res2 = evaluateCommand('& "$HOME\\.local\\bin\\claude.exe"');
  assert.strictEqual(res2.safe, false, 'Must block PowerShell call operator full-path claude.exe');
  assert.strictEqual(res2.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res3 = evaluateCommand('Start-Process claude.exe');
  assert.strictEqual(res3.safe, false, 'Must block Start-Process claude.exe');
  assert.strictEqual(res3.risk, 'CROSS_AGENT_CLI_BLOCKED');
});

// 11. Pre-Tool Guard: Blocks claude plugin list --json (direct and CLI exit 1)
runTest('PreToolGuard: blocks claude plugin list --json (direct and CLI exit 1)', () => {
  const res1 = evaluateCommand('claude plugin list --json');
  assert.strictEqual(res1.safe, false, 'Must block claude plugin list --json');
  assert.strictEqual(res1.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const cliRes = spawnSync('node', [preToolGuardPath, 'claude plugin list --json'], { encoding: 'utf8' });
  assert.strictEqual(cliRes.status, 1, `Expected CLI exit 1 for claude plugin list --json, got ${cliRes.status}`);
});

// 12. Pre-Tool Guard: Allows read-only Get-Content ~/.claude/settings.json and non-executing .claude references
runTest('PreToolGuard: allows read-only Get-Content ~/.claude/settings.json and non-executing .claude references', () => {
  const safe1 = evaluateCommand('Get-Content ~/.claude/settings.json');
  assert.strictEqual(safe1.safe, true, 'Must allow Get-Content ~/.claude/settings.json');

  const safe2 = evaluateCommand('Get-Content C:\\Users\\ajjuk\\.claude\\settings.json');
  assert.strictEqual(safe2.safe, true, 'Must allow Get-Content absolute .claude\\settings.json');

  const safe3 = evaluateCommand('rg "claude" B:\\Repos\\antigravity-hud');
  assert.strictEqual(safe3.safe, true, 'Must allow rg searching for claude literal');

  const safe4 = evaluateCommand('git checkout -b feat/neon-orchestrator-wkg-and-claude-guard');
  assert.strictEqual(safe4.safe, true, 'Must allow git branch containing -claude-');

  const cliRes = spawnSync('node', [preToolGuardPath, 'Get-Content ~/.claude/settings.json'], { encoding: 'utf8' });
  assert.strictEqual(cliRes.status, 0, `Expected CLI exit 0 for Get-Content ~/.claude/settings.json, got ${cliRes.status}`);
});

// 13. Pre-Tool Guard: Blocks npx @anthropic-ai/claude-code invocations
runTest('PreToolGuard: blocks npx @anthropic-ai/claude-code invocations', () => {
  const res1 = evaluateCommand('npx @anthropic-ai/claude-code --version');
  assert.strictEqual(res1.safe, false, 'Must block npx @anthropic-ai/claude-code');
  assert.strictEqual(res1.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res2 = evaluateCommand('npx -y @anthropic-ai/claude-code@latest -p "hello"');
  assert.strictEqual(res2.safe, false, 'Must block npx -y @anthropic-ai/claude-code@latest');
  assert.strictEqual(res2.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const neg = evaluateCommand('git commit -m "block npx @anthropic-ai/claude-code"');
  assert.strictEqual(neg.safe, true, 'Must allow git commit message mentioning npx @anthropic-ai/claude-code');
});

// 14. Pre-Tool Guard: Blocks node .../@anthropic-ai/claude-code/cli.js invocations
runTest('PreToolGuard: blocks node .../@anthropic-ai/claude-code/cli.js invocations', () => {
  const res1 = evaluateCommand('node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js --version');
  assert.strictEqual(res1.safe, false, 'Must block POSIX node .../@anthropic-ai/claude-code/cli.js');
  assert.strictEqual(res1.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res2 = evaluateCommand('node C:\\Users\\ajjuk\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js -p x');
  assert.strictEqual(res2.safe, false, 'Must block Windows node ...\\@anthropic-ai\\claude-code\\cli.js');
  assert.strictEqual(res2.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const res3 = evaluateCommand('& "C:\\Program Files\\nodejs\\node.exe" "./node_modules/@anthropic-ai/claude-code/cli.js"');
  assert.strictEqual(res3.safe, false, 'Must block PowerShell call operator node.exe .../cli.js');
  assert.strictEqual(res3.risk, 'CROSS_AGENT_CLI_BLOCKED');

  const neg = evaluateCommand('node B:\\Repos\\antigravity-hud\\bin\\hud.js --list');
  assert.strictEqual(neg.safe, true, 'Must allow normal node invocations');
});

// 15. Pre-Tool Guard (stdin hook): Denies claude3 -p x and npx @anthropic-ai/claude-code via JSON decision
runTest('PreToolGuard (stdin hook): denies claude3 -p x and npx @anthropic-ai/claude-code via JSON decision', () => {
  const res1 = spawnSync('node', [preToolGuardPath], {
    input: JSON.stringify({ toolCall: { args: { command: 'claude3 -p x' } } }),
    encoding: 'utf8'
  });
  assert.strictEqual(res1.status, 0, `Stdin hook must exit 0 on deny JSON, got ${res1.status}`);
  const parsed1 = JSON.parse((res1.stdout || '').trim());
  assert.strictEqual(parsed1.decision, 'deny', `Expected deny decision, got: ${res1.stdout}`);

  const res2 = spawnSync('node', [preToolGuardPath], {
    input: JSON.stringify({ toolCall: { args: { command: 'npx @anthropic-ai/claude-code -p x' } } }),
    encoding: 'utf8'
  });
  assert.strictEqual(res2.status, 0);
  const parsed2 = JSON.parse((res2.stdout || '').trim());
  assert.strictEqual(parsed2.decision, 'deny', `Expected deny decision for npx claude-code, got: ${res2.stdout}`);
});

// 16. Pre-Tool Guard (stdin hook): Denies git reset --hard HEAD~3 via JSON decision
runTest('PreToolGuard (stdin hook): denies git reset --hard HEAD~3 via JSON decision', () => {
  const res = spawnSync('node', [preToolGuardPath], {
    input: JSON.stringify({ toolCall: { args: { command: 'git reset --hard HEAD~3' } } }),
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0, `Stdin hook must exit 0 on deny JSON, got ${res.status}`);
  const parsed = JSON.parse((res.stdout || '').trim());
  assert.strictEqual(parsed.decision, 'deny', `Expected deny decision, got: ${res.stdout}`);
  assert(parsed.reason && parsed.reason.includes('git reset --hard HEAD~3'), `Expected reason referencing command, got: ${parsed.reason}`);
});

// 17. Pre-Tool Guard (stdin hook): Allows Get-Content ~/.claude/settings.json via JSON decision
runTest('PreToolGuard (stdin hook): allows Get-Content ~/.claude/settings.json via JSON decision', () => {
  const res = spawnSync('node', [preToolGuardPath], {
    input: JSON.stringify({ toolCall: { args: { command: 'Get-Content ~/.claude/settings.json' } } }),
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  const parsed = JSON.parse((res.stdout || '').trim());
  assert.strictEqual(parsed.decision, 'allow', `Expected allow decision, got: ${res.stdout}`);
});

// 18. Pre-Tool Guard (stdin hook & direct): evaluateTargetPath denies direct writes to ~/.gemini/config/rules and allows normal files
runTest('PreToolGuard (stdin hook & direct): evaluateTargetPath denies direct writes to ~/.gemini/config/rules and allows normal files', () => {
  assert.strictEqual(typeof guardMod.evaluateTargetPath, 'function', 'evaluateTargetPath must be exported');

  const prevRatify = process.env.AGY_RATIFY_ACTIVE;
  delete process.env.AGY_RATIFY_ACTIVE;
  try {
    const blockedRules = guardMod.evaluateTargetPath('~/.gemini/config/rules/winforms-gui-hud.md');
    assert.strictEqual(blockedRules.safe, false, 'Must block direct write to ~/.gemini/config/rules');

    const blockedGeminiMd = guardMod.evaluateTargetPath('~/.gemini/GEMINI.md');
    assert.strictEqual(blockedGeminiMd.safe, false, 'Must block direct write to ~/.gemini/GEMINI.md');

    const allowedNormal = guardMod.evaluateTargetPath(path.join(sandboxDir, 'normal.txt'));
    assert.strictEqual(allowedNormal.safe, true, 'Must allow writes to normal scratch files');
  } finally {
    if (prevRatify === undefined) delete process.env.AGY_RATIFY_ACTIVE;
    else process.env.AGY_RATIFY_ACTIVE = prevRatify;
  }

  const cleanEnv = { ...process.env };
  delete cleanEnv.AGY_RATIFY_ACTIVE;
  const stdinRes = spawnSync('node', [preToolGuardPath], {
    input: JSON.stringify({ toolCall: { args: { path: '~/.gemini/config/rules/winforms-gui-hud.md' } } }),
    env: cleanEnv,
    encoding: 'utf8'
  });
  assert.strictEqual(stdinRes.status, 0);
  const parsed = JSON.parse((stdinRes.stdout || '').trim());
  assert.strictEqual(parsed.decision, 'deny', `Expected deny decision on protected path write, got: ${stdinRes.stdout}`);
  assert(parsed.reason && parsed.reason.includes('Blocked direct write to live Antigravity configuration'), `Expected protected path message, got: ${parsed.reason}`);
});

// Clean up sandbox
try {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
} catch (_) {}

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
