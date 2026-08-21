const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
const candidatePaths = [
  path.join(__dirname, '..', 'bin', 'hud.js'),
  path.join(__dirname, '..', 'hud.js'),
  path.join(homeDir, '.gemini', 'hud', 'hud.js'),
  path.join(homeDir, '.gemini', 'scripts', 'hud.js')
];
const hudScriptPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

const fixtureCfgPath = path.join(__dirname, 'fixtures', 'sample_full_hud_config.json');

// Isolated Sandbox Directory for Checks & Corrections Tests
const sandboxRoot = path.join(os.tmpdir(), 'hud_check_repair_test_sandbox_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
const mockScriptsDir = path.join(sandboxRoot, 'scripts');
const mockHudDir = path.join(sandboxRoot, 'hud');
const mockRepoDir = path.join(sandboxRoot, 'repo');
const mockSettingsPath = path.join(sandboxRoot, 'settings.json');

fs.mkdirSync(mockScriptsDir, { recursive: true });
fs.mkdirSync(mockHudDir, { recursive: true });
fs.mkdirSync(path.join(mockRepoDir, 'bin'), { recursive: true });
fs.mkdirSync(path.join(mockRepoDir, 'web'), { recursive: true });
fs.mkdirSync(path.join(mockRepoDir, 'hooks'), { recursive: true });

// Seed initial canonical copies into sandbox
function resolveCanonical(fname, repoSubdir) {
  const candidates = [
    path.join(__dirname, '..', repoSubdir, fname),
    path.join(__dirname, '..', fname),
    path.join('B:', 'Repos', 'antigravity-hud', repoSubdir, fname),
    path.join(homeDir, '.gemini', 'hud', fname),
    path.join(homeDir, '.gemini', 'scripts', fname)
  ];
  return candidates.find(p => fs.existsSync(p));
}

const canonicalFiles = {
  'hud.js': resolveCanonical('hud.js', 'bin'),
  'hud_gui.ps1': resolveCanonical('hud_gui.ps1', 'bin'),
  'hud_gui.html': resolveCanonical('hud_gui.html', 'web'),
  'hud_config.json': fixtureCfgPath,
  'Sync-AgyHud.ps1': resolveCanonical('Sync-AgyHud.ps1', '')
};

function seedSandbox() {
  for (const [fname, src] of Object.entries(canonicalFiles)) {
    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(mockScriptsDir, fname));
      fs.copyFileSync(src, path.join(mockHudDir, fname));

      if (fname === 'hud_gui.html') {
        fs.copyFileSync(src, path.join(mockRepoDir, 'web', fname));
      } else if (fname === 'Sync-AgyHud.ps1') {
        fs.copyFileSync(src, path.join(mockRepoDir, fname));
      } else {
        fs.copyFileSync(src, path.join(mockRepoDir, 'bin', fname));
      }
    }
  }

  // Seed hooks
  const repoHooksDir = path.join(__dirname, '..', 'hooks');
  if (fs.existsSync(repoHooksDir)) {
    const hookFiles = fs.readdirSync(repoHooksDir);
    for (const hf of hookFiles) {
      const srcHook = path.join(repoHooksDir, hf);
      if (fs.statSync(srcHook).isFile()) {
        fs.mkdirSync(path.join(mockScriptsDir, 'hooks'), { recursive: true });
        fs.mkdirSync(path.join(mockHudDir, 'hooks'), { recursive: true });
        fs.mkdirSync(path.join(mockRepoDir, 'hooks'), { recursive: true });
        fs.copyFileSync(srcHook, path.join(mockScriptsDir, 'hooks', hf));
        fs.copyFileSync(srcHook, path.join(mockHudDir, 'hooks', hf));
        fs.copyFileSync(srcHook, path.join(mockRepoDir, 'hooks', hf));
      }
    }
  }

  const validSettings = {
    statusLine: {
      type: 'command',
      command: `node ${path.join(mockHudDir, 'hud.js').replace(/\\/g, '/')}`,
      enabled: true
    }
  };
  fs.writeFileSync(mockSettingsPath, JSON.stringify(validSettings, null, 2), 'utf8');
}

seedSandbox();

const testEnv = {
  ...process.env,
  HUD_TEST_MODE: '1',
  HUD_TEST_SCRIPTS_DIR: mockScriptsDir,
  HUD_TEST_HUD_DIR: mockHudDir,
  HUD_TEST_SETTINGS_PATH: mockSettingsPath,
  HUD_TEST_REPO_DIR: mockRepoDir
};

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

console.log('\n\x1b[1m=== Test Suite 5: Automated Checks, Drift Detection & Self-Healing Matrix ===\x1b[0m');

// 1. TC-CHK-01: Nominal State Health Check
runTest('TC-CHK-01: Nominal sandbox state evaluates to 100% HEALTHY with 0 drift', () => {
  seedSandbox();
  const res = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `Expected exit 0, got ${res.status}`);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.healthy, true);
  assert.strictEqual(report.status, 'healthy');
  assert.strictEqual(report.mismatches.length, 0);
  assert.strictEqual(report.missing.length, 0);
  assert.strictEqual(report.bomViolations.length, 0);
  assert.strictEqual(report.hookStatus.valid, true);
});

// 2. TC-CHK-02: SHA-256 Checksum Drift Detection
runTest('TC-CHK-02: Check engine accurately detects SHA-256 single-byte drift', () => {
  seedSandbox();
  const driftedTarget = path.join(mockScriptsDir, 'hud.js');
  fs.appendFileSync(driftedTarget, '\n// ARTIFICIAL_DRIFT_BYTE');

  const res = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, 'Expected exit 1 on drift');
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.healthy, false);
  const mismatch = report.mismatches.find(m => m.target === 'scripts' && m.file === 'hud.js');
  assert(mismatch, 'Expected hud.js mismatch in scripts target');
  assert.notStrictEqual(mismatch.currentHash, mismatch.expectedHash);
});

// 3. TC-CHK-03: Missing File Detection
runTest('TC-CHK-03: Check engine accurately detects missing runtime components', () => {
  seedSandbox();
  const targetGui = path.join(mockHudDir, 'hud_gui.ps1');
  fs.unlinkSync(targetGui);

  const res = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 1);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.healthy, false);
  const missing = report.missing.find(m => m.target === 'hud' && m.file === 'hud_gui.ps1');
  assert(missing, 'Expected missing hud_gui.ps1 in hud target');
});

// 4. TC-CHK-04: UTF-8 BOM Detection
runTest('TC-CHK-04: Check engine accurately detects corrupt UTF-8 BOM preamble', () => {
  seedSandbox();
  const cfgPath = path.join(mockHudDir, 'hud_config.json');
  const original = fs.readFileSync(cfgPath, 'utf8');
  // Write UTF-8 BOM preamble \ufeff
  fs.writeFileSync(cfgPath, '\ufeff' + original, 'utf8');

  const res = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 1);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.healthy, false);
  const bom = report.bomViolations.find(b => b.target === 'hud' && b.file === 'hud_config.json');
  assert(bom, 'Expected BOM violation on hud_config.json');
});

// 5. TC-CHK-05: Incomplete Schema Property Detection
runTest('TC-CHK-05: Check engine detects missing configuration properties', () => {
  seedSandbox();
  const cfgPath = path.join(mockHudDir, 'hud_config.json');
  fs.writeFileSync(cfgPath, JSON.stringify({ lines: 2 }, null, 2), 'utf8');

  const res = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 1);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.healthy, false);
  assert(report.schemaIssues.length > 0);
});

// 6. TC-CHK-06: Broken Statusline Hook Detection
runTest('TC-CHK-06: Check engine detects invalid/missing statusline command hook', () => {
  seedSandbox();
  fs.writeFileSync(mockSettingsPath, JSON.stringify({ statusLine: { command: 'node /nonexistent/script.js', enabled: true } }, null, 2), 'utf8');

  const res = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 1);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.healthy, false);
  assert.strictEqual(report.hookStatus.valid, false);
});

// 7. TC-COR-01: Auto-Repair Checksum & Missing File Restoration
runTest('TC-COR-01: Auto-repair restores drifted and deleted files to exact SHA-256 parity', () => {
  seedSandbox();
  // Corrupt a file and delete another
  fs.writeFileSync(path.join(mockScriptsDir, 'hud.js'), 'DRIFT_CONTENT');
  fs.unlinkSync(path.join(mockHudDir, 'hud_gui.html'));

  const repairRes = spawnSync('node', [hudScriptPath, 'repair', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(repairRes.status, 0);
  const repairReport = JSON.parse(repairRes.stdout);
  assert(repairReport.repaired.length >= 2, 'Expected multiple repairs recorded');

  // Verify health check passes 100% after repair
  const checkRes = spawnSync('node', [hudScriptPath, 'check', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(checkRes.status, 0);
  const checkReport = JSON.parse(checkRes.stdout);
  assert.strictEqual(checkReport.healthy, true);
  assert.strictEqual(checkReport.mismatches.length, 0);
  assert.strictEqual(checkReport.missing.length, 0);
});

// 8. TC-COR-02: Auto-Repair BOM Stripping
runTest('TC-COR-02: Auto-repair strips UTF-8 BOM preamble and restores clean encoding', () => {
  seedSandbox();
  const cfgPath = path.join(mockHudDir, 'hud_config.json');
  const original = fs.readFileSync(cfgPath, 'utf8');
  fs.writeFileSync(cfgPath, '\ufeff' + original, 'utf8');

  const repairRes = spawnSync('node', [hudScriptPath, 'repair', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(repairRes.status, 0);

  const buf = Buffer.alloc(3);
  const fd = fs.openSync(cfgPath, 'r');
  fs.readSync(fd, buf, 0, 3, 0);
  fs.closeSync(fd);
  const isBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  assert.strictEqual(isBom, false, 'BOM preamble must be removed');
});

// 9. TC-COR-03: Non-Destructive Config Deep-Merge
runTest('TC-COR-03: Auto-repair preserves user overrides while hydrating missing schema keys', () => {
  seedSandbox();
  const cfgPath = path.join(mockHudDir, 'hud_config.json');
  const userCustom = {
    lines: 3,
    compact_mode: 'minimal',
    item_styles: { context: 'minimal' }
  };
  fs.writeFileSync(cfgPath, JSON.stringify(userCustom, null, 2), 'utf8');

  const repairRes = spawnSync('node', [hudScriptPath, 'repair', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(repairRes.status, 0);

  const repairedCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  assert.strictEqual(repairedCfg.lines, 3, 'User lines override must be preserved');
  assert.strictEqual(repairedCfg.compact_mode, 'minimal', 'User compact_mode must be preserved');
  assert.strictEqual(repairedCfg.item_styles.context, 'minimal', 'User item_styles override must be preserved');
  assert(repairedCfg.session_uptime, 'session_uptime schema must be hydrated');
  assert(repairedCfg.fork_advisory, 'fork_advisory schema must be hydrated');
  assert(Array.isArray(repairedCfg.line1), 'line1 schema must be hydrated');
});

// 10. TC-COR-04: Statusline Hook Auto-Repair
runTest('TC-COR-04: Auto-repair fixes broken statusline settings hook', () => {
  seedSandbox();
  fs.writeFileSync(mockSettingsPath, JSON.stringify({ statusLine: { command: 'corrupted', enabled: false } }, null, 2), 'utf8');

  const repairRes = spawnSync('node', [hudScriptPath, 'repair', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(repairRes.status, 0);

  const repairedSettings = JSON.parse(fs.readFileSync(mockSettingsPath, 'utf8'));
  assert.strictEqual(repairedSettings.statusLine.enabled, true);
  assert(repairedSettings.statusLine.command.includes('hud.js'));
});

// 11. TC-DIF-01: hud diff reports identical when sandbox active matches repo
runTest('TC-DIF-01: hud diff reports identical when sandbox active matches repo', () => {
  seedSandbox();
  const diffRes = spawnSync('node', [hudScriptPath, 'diff', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(diffRes.status, 0);
  const parsed = JSON.parse(diffRes.stdout);
  assert.strictEqual(parsed.inSync, true);
  assert(parsed.items.length > 0);
});

// 12. TC-DIF-02: hud diff accurately detects modified active files
runTest('TC-DIF-02: hud diff accurately detects modified active files', () => {
  seedSandbox();
  const activeScript = path.join(mockScriptsDir, 'hud.js');
  fs.appendFileSync(activeScript, '\n// Modified in active runtime\n');

  const diffRes = spawnSync('node', [hudScriptPath, 'diff', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(diffRes.status, 1);
  const parsed = JSON.parse(diffRes.stdout);
  assert.strictEqual(parsed.inSync, false);
  const hudItem = parsed.items.find(i => i.relActive === 'hud.js');
  assert(hudItem);
  assert.strictEqual(hudItem.status, 'ACTIVE_NEWER');
});

// 13. TC-BCK-01: hud backup synchronizes active runtime edits back into repo
runTest('TC-BCK-01: hud backup synchronizes active runtime edits back into repo', () => {
  seedSandbox();
  const activeScript = path.join(mockScriptsDir, 'hud.js');
  fs.appendFileSync(activeScript, '\n// Backup Test Marker\n');

  const backupRes = spawnSync('node', [hudScriptPath, 'backup', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(backupRes.status, 0);
  const parsed = JSON.parse(backupRes.stdout);
  assert.strictEqual(parsed.success, true);
  assert(parsed.backedUp.some(b => b.file.includes('hud.js')));

  const repoScript = path.join(mockRepoDir, 'bin', 'hud.js');
  const repoContent = fs.readFileSync(repoScript, 'utf8');
  assert(repoContent.includes('Backup Test Marker'), 'Repo file must contain backed up changes');
});

// 14. TC-BCK-02: hud backup conflict protection prevents overwriting newer repo files without --force
runTest('TC-BCK-02: hud backup conflict protection prevents overwriting newer repo files without --force', () => {
  seedSandbox();
  const activeScript = path.join(mockScriptsDir, 'hud.js');
  const repoScript = path.join(mockRepoDir, 'bin', 'hud.js');

  // Set active file mtime to 1 hour ago
  const pastTime = new Date(Date.now() - 3600000);
  fs.appendFileSync(activeScript, '\n// Active Older Change\n');
  fs.utimesSync(activeScript, pastTime, pastTime);

  // Set repo file mtime to now
  fs.appendFileSync(repoScript, '\n// Repo Newer Change\n');
  const now = new Date();
  fs.utimesSync(repoScript, now, now);

  const backupRes = spawnSync('node', [hudScriptPath, 'backup', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(backupRes.status, 1);
  const parsed = JSON.parse(backupRes.stdout);
  assert.strictEqual(parsed.success, false);
  assert(parsed.conflicts.length > 0, 'Conflict must be reported');

  // Overwrite with --force
  const forceRes = spawnSync('node', [hudScriptPath, 'backup', '--json', '--force'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(forceRes.status, 0);
});

// 15. TC-DEP-01: hud deploy synchronizes repo files to active runtime directories
runTest('TC-DEP-01: hud deploy synchronizes repo files to active runtime directories', () => {
  seedSandbox();
  const repoHtml = path.join(mockRepoDir, 'web', 'hud_gui.html');
  fs.appendFileSync(repoHtml, '\n<!-- Deployed from Repo -->\n');

  const deployRes = spawnSync('node', [hudScriptPath, 'deploy', '--json'], { env: testEnv, encoding: 'utf8' });
  assert.strictEqual(deployRes.status, 0);
  const parsed = JSON.parse(deployRes.stdout);
  assert.strictEqual(parsed.success, true);

  const activeHtml = path.join(mockScriptsDir, 'hud_gui.html');
  const activeContent = fs.readFileSync(activeHtml, 'utf8');
  assert(activeContent.includes('Deployed from Repo'), 'Active runtime must receive deployed updates');
});

// Teardown Sandbox
try {
  fs.rmSync(sandboxRoot, { recursive: true, force: true });
} catch (_) {}

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
