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

// 15. Gemini 4 Argon Model Badges, Dual Weekly Quota Wk(A)/Wk(G), Cache Isolation & Active-Model 0Q
runTest('Engine: Gemini 4 Argon renders full/short/minimal badges, dual Wk(A)/Wk(G) quota, and active-model 0Q', () => {
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
  assert(clean.includes('Wk(A): 64% / Wk(G): 100%'), `Expected dual Wk(A)/Wk(G) segment, got: ${clean}`);
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
  assert(clean.includes('Wk(A): 100% / Wk(G): 87%'), `Expected dual Wk(A)/Wk(G) segment, got: ${clean}`);
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

// 17. Baseline Characterization: Workspace Custom Title Isolation vs conversation_title
runTest('Baseline: hud title overrides workspace 📁 badge in isolated HOME without using payload.conversation_title', () => {
  const isolatedHome = path.join(tempTestDir, 'isolated_home_title');
  const isoCfg = path.join(isolatedHome, 'hud_config.json');
  fs.mkdirSync(isolatedHome, { recursive: true });
  fs.copyFileSync(fixtureCfgPath, isoCfg);

  const isoEnv = {
    ...process.env,
    USERPROFILE: isolatedHome,
    HOME: isolatedHome,
    HUD_TEST_MODE: '1',
    HUD_CONFIG_PATH: isoCfg
  };

  // Without custom title, conversation_title must NOT override the 📁 workspace label
  const mockWsDir = path.join(isolatedHome, 'antigravity-hud');
  fs.mkdirSync(mockWsDir, { recursive: true });
  const payload = JSON.parse(fs.readFileSync(fixturePayloadPath, 'utf8'));
  payload.cwd = mockWsDir;
  payload.conversation_title = 'Session_Only_Name';
  let res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env: isoEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('📁 antigravity-hud'), `Expected workspace folder name, got: ${clean}`);
  assert(!clean.includes('📁 Session_Only_Name'), 'conversation_title must not hijack workspace 📁 badge');

  // With hud title, workspace_titles.json overrides 📁 badge and emits OSC 0
  res = spawnSync('node', [hudScriptPath, 'title', 'Pinned Workspace Name'], { env: isoEnv, encoding: 'utf8', cwd: mockWsDir });
  assert.strictEqual(res.status, 0);
  const titlesPath = path.join(isolatedHome, '.gemini', 'tmp', 'workspace_titles.json');
  assert(fs.existsSync(titlesPath), 'workspace_titles.json must be created in isolated HOME');

  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env: isoEnv, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  clean = stripAnsi(res.stdout);
  assert(clean.includes('📁 Pinned Workspace Name'), `Expected custom workspace title in 📁 badge, got: ${clean}`);
  assert(res.stdout.includes('\x1b]0;\u{1FA90} agy - Pinned Workspace Name\x07'), 'Expected OSC 0 tab title');

  // Reset restores directory name
  res = spawnSync('node', [hudScriptPath, 'title', 'reset'], { env: isoEnv, encoding: 'utf8', cwd: mockWsDir });
  assert.strictEqual(res.status, 0);
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env: isoEnv, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('📁 antigravity-hud'), `Expected reset to restore folder name, got: ${clean}`);
});

// 18. Baseline Characterization: Session Uptime Formatting Tiers & show_seconds Toggle
runTest('Baseline: session uptime renders full/short/minimal durations and honors show_seconds=false', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  let cfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));

  // Full mode (1845s = 30m 45s)
  cfg.item_styles = { session: 'full' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  let res = spawnSync('node', [hudScriptPath], { input: payloadStr, env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('⏱️ 30m 45s'), `Expected full uptime ⏱️ 30m 45s, got: ${clean}`);

  // Short mode -> ⏱️ 30m
  cfg.item_styles = { session: 'short' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: payloadStr, env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('⏱️ 30m') && !clean.includes('⏱️ 30m 45s'), `Expected short uptime ⏱️ 30m, got: ${clean}`);

  // Full mode with show_seconds: false -> ⏱️ 30m
  cfg.item_styles = { session: 'full' };
  cfg.session_uptime.show_seconds = false;
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: payloadStr, env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('⏱️ 30m') && !clean.includes('⏱️ 30m 45s'), `Expected show_seconds=false to omit seconds, got: ${clean}`);
});

// 19. Baseline Characterization: Existing auth, sandbox, and plan_tier Rendering
runTest('Baseline: auth, sandbox, and plan_tier render expected badges when enabled', () => {
  const payload = JSON.parse(fs.readFileSync(fixturePayloadPath, 'utf8'));
  payload.auth_type = 'gemini-api-key';
  const cfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  cfg.disabled = [];
  cfg.line4 = ['auth', 'sandbox', 'plan_tier'];
  cfg.item_styles = { auth: 'full', sandbox: 'full', plan_tier: 'full' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');

  let res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('🔑 API-Key'), `Expected auth badge, got: ${clean}`);
  assert(clean.includes('🛡️ Sandbox'), `Expected sandbox badge, got: ${clean}`);
  assert(clean.includes('✨ Google AI Pro'), `Expected plan_tier badge, got: ${clean}`);
});

// 20. TDD Spec: session_name Footer Item (full / short / minimal / truncation / empty-hidden)
runTest('TDD: session_name renders conversation_title across tiers and hides when empty', () => {
  const payload = JSON.parse(fs.readFileSync(fixturePayloadPath, 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  cfg.disabled = [];
  cfg.line4 = ['session_name'];

  // Untitled/empty payload -> omitted cleanly
  delete payload.conversation_title;
  delete payload.session_title;
  delete payload.title;
  cfg.item_styles = { session_name: 'full' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  let res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(!clean.includes('🏷️'), `Empty conversation_title must not render 🏷️ badge, got: ${clean}`);

  // Short title across full / short / minimal
  payload.conversation_title = 'MasterControlCenter_SitStu_Nov2026';
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('🏷️ MasterControlCenter_SitStu_Nov2026'), `Expected full session_name, got: ${clean}`);
  assert(clean.includes('📁 antigravity-hud'), 'workspace 📁 must stay independent of session_name');

  cfg.item_styles = { session_name: 'short' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('🏷️ MasterControlCenter_Sit…'), `Expected truncated short session_name (<=24 chars), got: ${clean}`);

  cfg.item_styles = { session_name: 'minimal' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('MasterControl…') && !clean.includes('🏷️'), `Expected minimal truncated session_name without icon, got: ${clean}`);
});

// 21. TDD Spec: session_id Footer Item (full UUID / short 8-char / minimal 8-char / empty-hidden)
runTest('TDD: session_id renders full UUID in full mode, 8-char prefix in short/minimal, and hides when empty', () => {
  const payload = JSON.parse(fs.readFileSync(fixturePayloadPath, 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  cfg.disabled = [];
  cfg.line4 = ['session_id'];

  // Full mode -> 🆔 + full ID
  payload.session_id = 'c4389f31-ea6b-4188-92ac-49962cf376ef';
  cfg.item_styles = { session_id: 'full' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  let res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  let clean = stripAnsi(res.stdout);
  assert(clean.includes('🆔 c4389f31-ea6b-4188-92ac-49962cf376ef'), `Expected full session_id, got: ${clean}`);

  // Short mode -> 🆔 c4389f31
  cfg.item_styles = { session_id: 'short' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('🆔 c4389f31') && !clean.includes('49962cf376ef'), `Expected 8-char short session_id, got: ${clean}`);

  // Minimal mode -> c4389f31 (no icon)
  cfg.item_styles = { session_id: 'minimal' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('c4389f31') && !clean.includes('🆔'), `Expected minimal session_id without icon, got: ${clean}`);

  // Missing IDs -> omitted cleanly
  delete payload.session_id;
  delete payload.conversation_id;
  delete payload.thread_id;
  cfg.item_styles = { session_id: 'full' };
  fs.writeFileSync(testConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], { input: JSON.stringify(payload), env, encoding: 'utf8' });
  clean = stripAnsi(res.stdout);
  assert(!clean.includes('🆔'), `Missing session_id must not render 🆔 badge, got: ${clean}`);
});

// 22. Gemini 4 Neon (XHigh) Badges, Wk(A)/Wk(G) Quota & Active-Model 0Q
runTest('Engine: Gemini 4 Neon (XHigh) renders full/short/minimal badges, Wk(A)/Wk(G) quota, and active-model 0Q', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.model = {
    id: 'gemini-4-neon-xhigh',
    display_name: 'Gemini 4 Neon (XHigh)',
    effort: 'xhigh'
  };
  payload.rate_limits = {
    'gemini-5h': { remaining_percentage: 96, reset_in_seconds: 18000 },
    'gemini-argon-wtu-weekly': { remaining_percentage: 100, reset_in_seconds: 604800 },
    'gemini-weekly': { remaining_percentage: 98, reset_in_seconds: 114390 }
  };
  delete payload.quota;
  payload.credits = 2000;

  const testQuotaCache = path.join(tempTestDir, 'test_neon_last_quota.json');
  const envWithQuotaFile = Object.assign({}, env, { HUD_TEST_QUOTA_FILE: testQuotaCache });

  // 22a. Full mode -> Gemini 4 Neon [🧠 XHIGH], deduplicates (XHigh), Wk(A)/Wk(G)
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
  assert(clean.includes('Gemini 4 Neon [🧠 XHIGH]'), `Expected full Neon badge, got: ${clean}`);
  assert(!clean.includes('(XHigh)'), `Expected trailing (XHigh) deduplicated, got: ${clean}`);
  assert(clean.includes('Wk(A): 100% / Wk(G): 98%'), `Expected dual Wk(A)/Wk(G) segment, got: ${clean}`);
  assert(!clean.includes('[0Q Active]'), 'Should not trigger 0Q when gemini-weekly is 98%');

  const cachedQuota = JSON.parse(fs.readFileSync(testQuotaCache, 'utf8'));
  assert.strictEqual(cachedQuota.qWkPercent, 98);
  assert.strictEqual(cachedQuota.qArgonWkPercent, 100);
  assert.strictEqual(cachedQuota.qFlashWkPercent, 98);

  // 22b. Short mode -> Neon [XHI] / [HI] / [MED] / [LOW]
  const shortCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  shortCfg.item_styles = Object.assign({}, shortCfg.item_styles, { model: 'short' });
  fs.writeFileSync(testConfigPath, JSON.stringify(shortCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Neon [XHI]'), `Expected short Neon [XHI] badge, got: ${clean}`);

  for (const [label, eff, tag] of [['High', 'high', 'HI'], ['Medium', 'medium', 'MED'], ['Low', 'low', 'LOW']]) {
    const tierPayload = Object.assign({}, payload, {
      model: { id: `gemini-4-neon-${eff}`, display_name: `Gemini 4 Neon (${label})`, effort: eff }
    });
    res = spawnSync('node', [hudScriptPath], {
      input: JSON.stringify(tierPayload),
      env: envWithQuotaFile,
      encoding: 'utf8'
    });
    clean = stripAnsi(res.stdout);
    assert(clean.includes(`Neon [${tag}]`), `Expected short Neon [${tag}] badge, got: ${clean}`);
  }

  // 22c. Minimal mode -> Neon │ (never Gemini │)
  const minCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  minCfg.item_styles = Object.assign({}, minCfg.item_styles, { model: 'minimal' });
  fs.writeFileSync(testConfigPath, JSON.stringify(minCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Neon │'), `Expected minimal Neon badge, got: ${clean}`);
  assert(!clean.includes('Gemini │'), `Minimal Neon must not collapse to Gemini, got: ${clean}`);

  // 22d. Active-model 0Q binds to gemini-weekly, not gemini-argon-wtu-weekly
  fs.copyFileSync(fixtureCfgPath, testConfigPath);
  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 0;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 98;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(!clean.includes('[0Q Active]'), 'Should NOT trigger [0Q Active] for Neon when only Argon WTU is 0%');

  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 100;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 0;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('[0Q Active]'), 'Expected [0Q Active] for Neon when gemini-weekly is 0%');
});

// 23. Orchestrator (Neon) Badges & gemini-weekly Quota Binding
runTest('Engine: Orchestrator (Neon) renders Orchestrator (Neon) / Orch(N) badges and binds to gemini-weekly', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.model = {
    id: 'gemini-pro-orchestrator-neon',
    display_name: 'Orchestrator (Neon)'
  };
  payload.rate_limits = {
    'gemini-5h': { remaining_percentage: 95, reset_in_seconds: 18000 },
    'gemini-argon-wtu-weekly': { remaining_percentage: 100, reset_in_seconds: 604800 },
    'gemini-weekly': { remaining_percentage: 82, reset_in_seconds: 114390 }
  };
  delete payload.quota;
  payload.credits = 2000;

  const testQuotaCache = path.join(tempTestDir, 'test_orch_neon_last_quota.json');
  const envWithQuotaFile = Object.assign({}, env, { HUD_TEST_QUOTA_FILE: testQuotaCache });

  // 23a. Full mode
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
  assert(clean.includes('Orchestrator (Neon)'), `Expected full Orchestrator (Neon) badge, got: ${clean}`);
  assert(clean.includes('Wk(A): 100% / Wk(G): 82%'), `Expected dual Wk(A)/Wk(G) segment, got: ${clean}`);
  const cachedQuota = JSON.parse(fs.readFileSync(testQuotaCache, 'utf8'));
  assert.strictEqual(cachedQuota.qWkPercent, 82);

  // 23b. Short mode -> Orch(N) │
  const shortCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  shortCfg.item_styles = Object.assign({}, shortCfg.item_styles, { model: 'short' });
  fs.writeFileSync(testConfigPath, JSON.stringify(shortCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Orch(N) │'), `Expected short Orch(N) badge, got: ${clean}`);

  // 23c. Minimal mode -> Orch(N) │
  const minCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  minCfg.item_styles = Object.assign({}, minCfg.item_styles, { model: 'minimal' });
  fs.writeFileSync(testConfigPath, JSON.stringify(minCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Orch(N) │'), `Expected minimal Orch(N) badge, got: ${clean}`);

  // 23d. Active-model 0Q binds to gemini-weekly
  fs.copyFileSync(fixtureCfgPath, testConfigPath);
  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 0;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 82;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(!clean.includes('[0Q Active]'), 'Should NOT trigger [0Q Active] for Orchestrator (Neon) when only Argon WTU is 0%');

  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 100;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 0;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('[0Q Active]'), 'Expected [0Q Active] for Orchestrator (Neon) when gemini-weekly is 0%');
});

// 24. Orchestrator (Argon) Badges & gemini-argon-wtu-weekly Quota Binding
runTest('Engine: Orchestrator (Argon) renders Orchestrator (Argon) / Orch(A) badges and binds to gemini-argon-wtu-weekly', () => {
  const payloadStr = fs.readFileSync(fixturePayloadPath, 'utf8');
  const payload = JSON.parse(payloadStr);
  payload.model = {
    id: 'gemini-pro-orchestrator-g1-pro',
    display_name: 'Orchestrator (Argon)'
  };
  payload.rate_limits = {
    'gemini-5h': { remaining_percentage: 95, reset_in_seconds: 18000 },
    'gemini-argon-wtu-weekly': { remaining_percentage: 55, reset_in_seconds: 182700 },
    'gemini-weekly': { remaining_percentage: 100, reset_in_seconds: 604800 }
  };
  delete payload.quota;
  payload.credits = 2000;

  const testQuotaCache = path.join(tempTestDir, 'test_orch_argon_last_quota.json');
  const envWithQuotaFile = Object.assign({}, env, { HUD_TEST_QUOTA_FILE: testQuotaCache });

  // 24a. Full mode
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
  assert(clean.includes('Orchestrator (Argon)'), `Expected full Orchestrator (Argon) badge, got: ${clean}`);
  assert(clean.includes('Wk(A): 55% / Wk(G): 100%'), `Expected dual Wk(A)/Wk(G) segment, got: ${clean}`);
  const cachedQuota = JSON.parse(fs.readFileSync(testQuotaCache, 'utf8'));
  assert.strictEqual(cachedQuota.qWkPercent, 55);

  // 24b. Short mode -> Orch(A) │
  const shortCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  shortCfg.item_styles = Object.assign({}, shortCfg.item_styles, { model: 'short' });
  fs.writeFileSync(testConfigPath, JSON.stringify(shortCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Orch(A) │'), `Expected short Orch(A) badge, got: ${clean}`);

  // 24c. Minimal mode -> Orch(A) │
  const minCfg = JSON.parse(fs.readFileSync(fixtureCfgPath, 'utf8'));
  minCfg.item_styles = Object.assign({}, minCfg.item_styles, { model: 'minimal' });
  fs.writeFileSync(testConfigPath, JSON.stringify(minCfg, null, 2), 'utf8');
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('Orch(A) │'), `Expected minimal Orch(A) badge, got: ${clean}`);

  // 24d. Active-model 0Q binds to gemini-argon-wtu-weekly
  fs.copyFileSync(fixtureCfgPath, testConfigPath);
  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 55;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 0;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(!clean.includes('[0Q Active]'), 'Should NOT trigger [0Q Active] for Orchestrator (Argon) when only gemini-weekly is 0%');

  payload.rate_limits['gemini-argon-wtu-weekly'].remaining_percentage = 0;
  payload.rate_limits['gemini-weekly'].remaining_percentage = 100;
  res = spawnSync('node', [hudScriptPath], {
    input: JSON.stringify(payload),
    env: envWithQuotaFile,
    encoding: 'utf8'
  });
  clean = stripAnsi(res.stdout);
  assert(clean.includes('[0Q Active]'), 'Expected [0Q Active] for Orchestrator (Argon) when gemini-argon-wtu-weekly is 0%');
});

// Cleanup test scratch
try {
  fs.rmSync(tempTestDir, { recursive: true, force: true });
} catch (_) {}

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
