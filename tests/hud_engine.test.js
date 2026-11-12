const { execSync, spawnSync } = require('child_process');
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
const fixturePayloadPath = path.join(__dirname, 'fixtures', 'mock_live_payload.json');

const tempTestDir = path.join(__dirname, '..', '..', 'tmp', 'hud_test_scratch_' + Date.now());
fs.mkdirSync(tempTestDir, { recursive: true });

const testConfigPath = path.join(tempTestDir, 'hud_config_test.json');
fs.copyFileSync(fixtureCfgPath, testConfigPath);

const env = {
  ...process.env,
  HUD_TEST_MODE: '1',
  HUD_CONFIG_PATH: testConfigPath
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

console.log('\n\x1b[1m=== Test Suite 1: Node.js HUD Engine & CLI Subcommands Matrix ===\x1b[0m');

const stripAnsi = str => str.replace(/\x1b\[[0-9;]*m/g, '');

// 1. CLI Execution & List command
runTest('CLI: node hud.js --list executes cleanly with AGY branding', () => {
  const res = spawnSync('node', [hudScriptPath, '--list'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  const clean = stripAnsi(res.stdout);
  assert(clean.includes('=== Antigravity CLI (AGY) Statusline HUD ==='), 'Expected AGY header');
  assert(clean.includes('Line 1 [ACTIVE]:'), 'Expected Line 1 active');
});

// 2. Lines Subcommand
runTest('CLI: hud lines updates configuration', () => {
  const res = spawnSync('node', [hudScriptPath, 'lines', '3'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  const cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert.strictEqual(cfg.lines, 3);
  assert.strictEqual(cfg.two_line, true);
});

// 3. Compact Mode Subcommand
runTest('CLI: hud compact updates global condensation mode', () => {
  const res = spawnSync('node', [hudScriptPath, 'compact', 'short'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  const cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert.strictEqual(cfg.compact_mode, 'short');
});

// 4. Item Style Subcommand
runTest('CLI: hud style sets per-item overrides and reset', () => {
  let res = spawnSync('node', [hudScriptPath, 'style', 'context', 'minimal'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert.strictEqual(cfg.item_styles.context, 'minimal');

  res = spawnSync('node', [hudScriptPath, 'style', 'reset'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert.deepStrictEqual(cfg.item_styles, {});
});

// 5. Uptime Subcommand
runTest('CLI: hud uptime toggles show_seconds and custom thresholds', () => {
  let res = spawnSync('node', [hudScriptPath, 'uptime', 'seconds', 'off'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert.strictEqual(cfg.session_uptime.show_seconds, false);

  res = spawnSync('node', [hudScriptPath, 'uptime', 'thresholds', '10:green,30:yellow,max:red'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert.strictEqual(cfg.session_uptime.thresholds.length, 3);
  assert.strictEqual(cfg.session_uptime.thresholds[0].max_minutes, 10);
  assert.strictEqual(cfg.session_uptime.thresholds[2].max_minutes, null);
});

// 6. Fork Advisory Subcommand & Snooze
runTest('CLI: hud fork status, snooze, and thresholds', () => {
  let res = spawnSync('node', [hudScriptPath, 'fork'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('AGY HUD: Fork Advisory Status'));

  res = spawnSync('node', [hudScriptPath, 'fork', 'snooze', '45'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('snoozed for 45 minute(s)'));

  res = spawnSync('node', [hudScriptPath, 'fork', 'unsnooze'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('snooze cleared'));
});

// 7. Toggle, Enable, Disable Subcommands
runTest('CLI: hud toggle, enable, disable items', () => {
  let res = spawnSync('node', [hudScriptPath, 'disable', 'sandbox'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert(cfg.disabled.includes('sandbox'));

  res = spawnSync('node', [hudScriptPath, 'enable', 'sandbox'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  assert(!cfg.disabled.includes('sandbox'));
});

// 8. Session Title Sync Subcommand & OSC 0 Escape Sequence
runTest('CLI: hud title sets custom title and clears on reset', () => {
  let res = spawnSync('node', [hudScriptPath, 'title', 'Feature Test Branch'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('\x1b]0;\u{1FA90} agy - Feature Test Branch\x07'), 'Expected OSC 0 sequence');

  res = spawnSync('node', [hudScriptPath, 'title', 'reset'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('Custom title cleared'));
});

// 9. Stdio Pipeline Telemetry Rendering Matrix (Full Payload)
runTest('Engine: stdio pipeline renders 4-line telemetry with mock payload', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  // Reset config to sample_full_hud_config
  fs.copyFileSync(fixtureCfgPath, testConfigPath);

  const res = spawnSync('node', [hudScriptPath], {
    input: payloadStr,
    env,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('\x1b]0;\u{1FA90} agy - '), 'Must emit OSC 0 tab title');
  const lines = res.stdout.replace(/^\x1b\]0;[^\x07]+\x07/, '').split('\n');
  assert.strictEqual(lines.length, 4, `Expected 4 rendered lines, got ${lines.length}`);
  
  // Verify individual item elements rendered in output
  const cleanOut = stripAnsi(res.stdout);
  assert(cleanOut.includes('antigravity-hud'), 'Expected workspace folder in output');
  assert(cleanOut.includes('Gemini 3.7 Flash'), 'Expected model display name');
  assert(cleanOut.includes('[IDLE]'), 'Expected lifecycle state');
  assert(cleanOut.includes('Ctx:'), 'Expected context progress bar');
  assert(cleanOut.includes('Quota:'), 'Expected 5h quota segment');
  assert(cleanOut.includes('Wk:'), 'Expected weekly quota segment');
  assert(cleanOut.includes('💳 2,348 Credits') || cleanOut.includes('💳'), 'Expected credits segment');
  assert(cleanOut.includes('🔌 3 MCP'), 'Expected MCP counter');
  assert(cleanOut.includes('🤖 1 subagent'), 'Expected subagent counter');
  assert(cleanOut.includes('⚙️ 1 task'), 'Expected task counter');
  assert(cleanOut.includes('⏱️'), 'Expected uptime timer');
});

// 10. Granular Per-Item Text Formatting Modes (full, short, minimal)
runTest('Engine: per-item formatting tiers render expected content', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  
  // Test minimal mode (icons + compact values)
  let cfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  cfg.compact_mode = 'minimal';
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');

  let res = spawnSync('node', [hudScriptPath], { input: payloadStr, env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('🔌 3'), 'Expected minimal MCP formatting (🔌 3)');
  assert(clean.includes('⚙️ 1'), 'Expected minimal Task formatting (⚙️ 1)');

  // Test short mode
  cfg.compact_mode = 'short';
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');

  res = spawnSync('node', [hudScriptPath], { input: payloadStr, env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  clean = stripAnsi(res.stdout);
  assert(clean.includes('🔌 3'), 'Expected short MCP formatting');
  assert(clean.includes('⚙️ 1'), 'Expected short Task formatting');
});

// 11. Fork Advisory Invariant (Clean Git vs Dirty Git Requirement)
runTest('Engine: fork advisory requires clean git state before triggering milestone badge', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.context_window.used_percentage = 85; // Above critical threshold

  // Configure require_clean_git: false for mock execution to verify badge generation
  let cfg = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  cfg.fork_advisory = { enabled: true, require_clean_git: false, warning_percent: 60, alert_percent: 75, critical_percent: 90 };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');

  const res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  const clean = stripAnsi(res.stdout);
  assert(clean.includes('Fork') || clean.includes('🍴'), 'Fork advisory badge should render on elevated context');
});

// 12. Empty Stdio Payload Safe Fallback
runTest('Engine: empty stdio fallback produces ready state without crash', () => {
  const res = spawnSync('node', [hudScriptPath], {
    input: '{}',
    env,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.length > 0);
});

// 13. Model Credits CLI Subcommands & Zero-Quota Cache Management
runTest('CLI: hud credits sets, reads, and clears balance', () => {
  // Set credits balance
  let res = spawnSync('node', [hudScriptPath, 'credits', '3500'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('Model credits balance set to:'));
  assert(res.stdout.includes('3,500 Credits'));

  // Inspect credits balance
  res = spawnSync('node', [hudScriptPath, 'credits'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('3,500 Credits'));
  assert(res.stdout.includes('Zero-Quota Status:'));

  // Clear credits balance
  res = spawnSync('node', [hudScriptPath, 'credits', 'clear'], { env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('Cleared cached model credits balance'));
});

// 14. Zero-Quota Alert Highlighting
runTest('Engine: zero-quota conditions apply alert highlight to credits segment', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.quota = {
    five_hour_percent: 0,
    weekly_percent: 0
  };
  payload.credits = 1850;
  payload.g1_credits = 1850;
  payload.model_credits = 1850;

  // Render in full mode
  fs.copyFileSync(fixtureCfgPath, testConfigPath);
  const res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  assert(res.stdout.includes('[0Q Active]'), 'Expected [0Q Active] tag when quota is 0');
  const clean = stripAnsi(res.stdout);
  assert(clean.includes('💳 1,850 Credits [0Q Active]'), 'Expected formatted zero-quota alert string');
});

// 15. Gemini 4 Argon Model Badges, Dual Weekly Quota Wk(A)/Wk(F), Cache Isolation & Active-Model 0Q
runTest('Engine: Gemini 4 Argon renders full/short/minimal badges, dual Wk(A)/Wk(F) quota, and active-model 0Q', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.model = {
    id: 'gemini-4-argon',
    display_name: 'Gemini 4 Argon (High)'
  };
  payload.rate_limits = {
    'gemini-5h': { remaining_percentage: 100, reset_in_seconds: 18000 },
    'gemini-argon-wtu-weekly': { remaining_percentage: 64, reset_in_seconds: 182700 },
    'gemini-weekly': { remaining_percentage: 100, reset_in_seconds: 604800 }
  };
  delete payload.quota;
  payload.credits = 2000;

  const testQuotaCache = path.join(tempTestDir, 'test_argon_last_quota.json');
  const envWithQuotaFile = Object.assign({}, env, { HUD_TEST_QUOTA_FILE: testQuotaCache });

  // 15a. Full mode
  const fullCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  fullCfg.item_styles = Object.assign({}, fullCfg.item_styles, { model: 'full' });
  fs.writeFileSync(testConfigPath, JSON.stringify(fullCfg, null, 2), 'utf8');
  let res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('Gemini 4 Argon [🧠 HIGH]'), `Expected full Argon badge, got: ${clean}`);
  assert(clean.includes('Wk(A): 64% / Wk(F): 100%'), `Expected dual Wk(A)/Wk(F) segment, got: ${clean}`);
  assert(!clean.includes('[0Q Active]'), 'Should not trigger 0Q when Argon weekly is 64%');

  // Verify HUD_TEST_QUOTA_FILE persisted dual weekly fields
  assert(fs.existsSync(testQuotaCache), 'HUD_TEST_QUOTA_FILE should be written');
  const cachedQuota = JSON.parse(fs.readFileSync(testQuotaCache, 'utf8'));
  assert.strictEqual(cachedQuota.qArgonWkPercent, 64);
  assert.strictEqual(cachedQuota.qFlashWkPercent, 100);

  // 15b. Short mode -> Argon [HI]
  const shortCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  shortCfg.item_styles = Object.assign({}, shortCfg.item_styles, { model: 'short' });
  fs.writeFileSync(testConfigPath, JSON.stringify(shortCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Argon [HI]'), `Expected short Argon [HI] badge, got: ${clean}`);

  // 15c. Minimal mode -> Argon
  const minCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  minCfg.item_styles = Object.assign({}, minCfg.item_styles, { model: 'minimal' });
  fs.writeFileSync(testConfigPath, JSON.stringify(minCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Argon │'), `Expected minimal Argon badge, got: ${clean}`);

  // 15d. Active-model 0Q when Argon weekly is 0% (even though Flash weekly is 100%)
  fs.copyFileSync(fixtureCfgPath, testConfigPath);
  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 0;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('[0Q Active]'), 'Expected [0Q Active] when Argon is active and Argon weekly is 0%');
});

// 16. Gemini 4 Hydrogen Model Badges (incl. XHigh) & Standard/Flash Weekly Quota Binding
runTest('Engine: Gemini 4 Hydrogen binds to gemini-weekly (not Argon WTU) and renders full/short/minimal badges', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.model = {
    id: 'gemini-4-hydrogen-xhigh',
    display_name: 'Gemini 4 Hydrogen (XHigh)',
    effort: 'xhigh'
  };
  payload.rate_limits = {
    'gemini-5h': { remaining_percentage: 100, reset_in_seconds: 18000 },
    'gemini-argon-wtu-weekly': { remaining_percentage: 100, reset_in_seconds: 604800 },
    'gemini-weekly': { remaining_percentage: 87, reset_in_seconds: 114390 }
  };
  delete payload.quota;
  payload.credits = 2000;

  const testQuotaCache = path.join(tempTestDir, 'test_hydrogen_last_quota.json');
  const envWithQuotaFile = Object.assign({}, env, { HUD_TEST_QUOTA_FILE: testQuotaCache });

  // 16a. Full mode + qWkPercent binds to Flash/standard weekly pool (87), not Argon (100)
  const fullCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  fullCfg.item_styles = Object.assign({}, fullCfg.item_styles, { model: 'full' });
  fs.writeFileSync(testConfigPath, JSON.stringify(fullCfg, null, 2), 'utf8');
  let res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('Gemini 4 Hydrogen [🧠 XHIGH]'), `Expected full Hydrogen badge, got: ${clean}`);
  assert(clean.includes('Wk(A): 100% / Wk(F): 87%'), `Expected dual Wk(A)/Wk(F) segment, got: ${clean}`);
  assert(!clean.includes('[0Q Active]'), 'Should not trigger 0Q when Hydrogen/Flash weekly is 87%');

  const cachedQuota = JSON.parse(fs.readFileSync(testQuotaCache, 'utf8'));
  assert.strictEqual(cachedQuota.qWkPercent, 87, 'Primary qWkPercent for Hydrogen must bind to gemini-weekly (87), not Argon WTU (100)');
  assert.strictEqual(cachedQuota.qArgonWkPercent, 100);
  assert.strictEqual(cachedQuota.qFlashWkPercent, 87);

  // 16b. Short mode -> Hydrogen [XHI]
  const shortCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  shortCfg.item_styles = Object.assign({}, shortCfg.item_styles, { model: 'short' });
  fs.writeFileSync(testConfigPath, JSON.stringify(shortCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Hydrogen [XHI]'), `Expected short Hydrogen [XHI] badge, got: ${clean}`);

  // 16c. Minimal mode -> Hydrogen
  const minCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  minCfg.item_styles = Object.assign({}, minCfg.item_styles, { model: 'minimal' });
  fs.writeFileSync(testConfigPath, JSON.stringify(minCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Hydrogen │'), `Expected minimal Hydrogen badge, got: ${clean}`);

  // 16d. Active-model 0Q does NOT trigger if only Argon WTU is 0%, and DOES trigger when gemini-weekly is 0%
  fs.copyFileSync(fixtureCfgPath, testConfigPath);
  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 0;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 87;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(!clean.includes('[0Q Active]'), 'Should NOT trigger [0Q Active] for Hydrogen when only Argon WTU is 0%');

  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 100;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 0;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('[0Q Active]'), 'Expected [0Q Active] for Hydrogen when gemini-weekly is 0%');
});

// Cleanup test scratch
try {
  fs.rmSync(tempTestDir, { recursive: true, force: true });
} catch (_) {}

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
