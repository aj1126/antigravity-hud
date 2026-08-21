const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
const primaryConfigPath = path.join(homeDir, '.gemini', 'hud_config.json');
const fallbackConfigPath = path.join(__dirname, '..', 'hud_config.json');

const DEFAULT_CONFIG = {
  lines: 2,
  two_line: true,
  separator: '│',
  compact_mode: 'auto',
  line1: ['workspace', 'git_status', 'model', 'state', 'auth', 'sandbox', 'session'],
  line2: ['context', 'fork', 'quota_5h', 'quota_weekly', 'mcp', 'subagents', 'tasks', 'artifacts', 'queue'],
  line3: [],
  line4: [],
  disabled: [],
  item_styles: {},
  session_uptime: {
    show_seconds: true,
    thresholds: [
      { max_minutes: 15, color: 'green' },
      { max_minutes: 45, color: 'yellow' },
      { max_minutes: 90, color: 'magenta' },
      { max_minutes: null, color: 'red' }
    ]
  },
  fork_advisory: {
    enabled: true,
    require_clean_git: true,
    warning_percent: 60,
    alert_percent: 75,
    critical_percent: 90,
    step_warning: 300,
    step_alert: 500,
    step_critical: 800
  }
};

const COLOR_MAP = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  muted: '\x1b[90m',
  white: '\x1b[37m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  purple: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function getUptimeColor(seconds, thresholds) {
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    return COLOR_MAP.gray;
  }
  const mins = seconds / 60;
  for (const t of thresholds) {
    if (t.max_minutes === null || t.max_minutes === undefined || mins <= t.max_minutes) {
      const col = (t.color || 'gray').toLowerCase();
      return COLOR_MAP[col] || COLOR_MAP.gray;
    }
  }
  return COLOR_MAP.gray;
}

function getConfigPath() {
  if (process.env.HUD_CONFIG_PATH && fs.existsSync(process.env.HUD_CONFIG_PATH)) {
    return process.env.HUD_CONFIG_PATH;
  }
  const scriptsPath = path.join(homeDir, '.gemini', 'scripts', 'hud_config.json');
  const dedicatedPath = path.join(homeDir, '.gemini', 'hud', 'hud_config.json');
  const legacyRootPath = path.join(homeDir, '.gemini', 'hud_config.json');
  const siblingPath = path.join(__dirname, 'hud_config.json');
  const parentPath = path.join(__dirname, '..', 'hud_config.json');

  if (fs.existsSync(scriptsPath)) return scriptsPath;
  if (fs.existsSync(dedicatedPath)) return dedicatedPath;
  if (fs.existsSync(legacyRootPath)) return legacyRootPath;
  if (fs.existsSync(siblingPath)) return siblingPath;
  if (fs.existsSync(parentPath)) return parentPath;
  return scriptsPath;
}

function loadConfig() {
  const cfgPath = getConfigPath();
  try {
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const parsedLine2 = Array.isArray(parsed.line2) ? parsed.line2 : DEFAULT_CONFIG.line2;
      if (!parsedLine2.includes('fork') && !parsed.disabled?.includes('fork')) {
        const ctxIdx = parsedLine2.indexOf('context');
        if (ctxIdx >= 0) {
          parsedLine2.splice(ctxIdx + 1, 0, 'fork');
        } else {
          parsedLine2.push('fork');
        }
      }

      let lineCount = parsed.lines;
      if (typeof lineCount !== 'number' || lineCount < 1 || lineCount > 4) {
        lineCount = parsed.two_line === false ? 1 : 2;
      }

      return {
        lines: lineCount,
        two_line: lineCount >= 2,
        separator: parsed.separator || '│',
        compact_mode: parsed.compact_mode || 'auto',
        line1: Array.isArray(parsed.line1) ? parsed.line1 : DEFAULT_CONFIG.line1,
        line2: parsedLine2,
        line3: Array.isArray(parsed.line3) ? parsed.line3 : [],
        line4: Array.isArray(parsed.line4) ? parsed.line4 : [],
        disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [],
        item_styles: typeof parsed.item_styles === 'object' && parsed.item_styles !== null ? parsed.item_styles : {},
        session_uptime: {
          show_seconds: typeof parsed.session_uptime?.show_seconds === 'boolean' ? parsed.session_uptime.show_seconds : DEFAULT_CONFIG.session_uptime.show_seconds,
          thresholds: Array.isArray(parsed.session_uptime?.thresholds) && parsed.session_uptime.thresholds.length > 0 ? parsed.session_uptime.thresholds : DEFAULT_CONFIG.session_uptime.thresholds
        },
        fork_advisory: {
          enabled: parsed.fork_advisory?.enabled !== false,
          require_clean_git: parsed.fork_advisory?.require_clean_git !== false,
          warning_percent: parsed.fork_advisory?.warning_percent ?? 60,
          alert_percent: parsed.fork_advisory?.alert_percent ?? 75,
          critical_percent: parsed.fork_advisory?.critical_percent ?? 90,
          step_warning: parsed.fork_advisory?.step_warning ?? 300,
          step_alert: parsed.fork_advisory?.step_alert ?? 500,
          step_critical: parsed.fork_advisory?.step_critical ?? 800
        }
      };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  let target = getConfigPath();
  if (!target || !fs.existsSync(target)) {
    target = path.join(homeDir, '.gemini', 'scripts', 'hud_config.json');
  }
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, JSON.stringify(cfg, null, 2), 'utf8');

  // Dual-sync to ~/.gemini/hud/hud_config.json if directory exists
  const hudMirror = path.join(homeDir, '.gemini', 'hud', 'hud_config.json');
  if (target !== hudMirror && fs.existsSync(path.dirname(hudMirror))) {
    try {
      fs.writeFileSync(hudMirror, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (_) {}
  }
}

function resolveItemStyle(itemKey, cfg, terminalWidth) {
  const explicit = cfg.item_styles?.[itemKey];
  if (explicit && explicit !== 'auto') {
    return explicit;
  }
  const globalMode = cfg.compact_mode || 'auto';
  if (globalMode === 'full' || globalMode === 'short' || globalMode === 'minimal') {
    return globalMode;
  }
  if (terminalWidth < 70) return 'minimal';
  if (terminalWidth < 105) return 'short';
  return 'full';
}

function getCustomTitle(payload, cwd = process.cwd()) {
  const sessId = payload.session_id || payload.conversation_id || payload.thread_id;
  if (sessId) {
    try {
      const cleanId = String(sessId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const stampFile = path.join(homeDir, '.gemini', 'tmp', 'sessions', `${cleanId}.json`);
      if (fs.existsSync(stampFile)) {
        const data = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
        if (data.customTitle) return data.customTitle;
      }
    } catch (_) {}
  }

  try {
    const titlesFile = path.join(homeDir, '.gemini', 'tmp', 'workspace_titles.json');
    if (fs.existsSync(titlesFile)) {
      const mapping = JSON.parse(fs.readFileSync(titlesFile, 'utf8'));
      const norm = path.resolve(cwd).toLowerCase();
      if (mapping[norm]) return mapping[norm];
    }
  } catch (_) {}

  return null;
}

function setCustomTitle(title, cwd = process.cwd(), sessId = null) {
  if (!title || !title.trim()) return;
  const cleanTitle = title.trim();

  try {
    const titlesFile = path.join(homeDir, '.gemini', 'tmp', 'workspace_titles.json');
    const tDir = path.dirname(titlesFile);
    if (!fs.existsSync(tDir)) fs.mkdirSync(tDir, { recursive: true });
    let mapping = {};
    if (fs.existsSync(titlesFile)) {
      try { mapping = JSON.parse(fs.readFileSync(titlesFile, 'utf8')); } catch (_) {}
    }
    mapping[path.resolve(cwd).toLowerCase()] = cleanTitle;
    fs.writeFileSync(titlesFile, JSON.stringify(mapping, null, 2), 'utf8');
  } catch (_) {}

  if (sessId) {
    try {
      const cleanId = String(sessId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const stampFile = path.join(homeDir, '.gemini', 'tmp', 'sessions', `${cleanId}.json`);
      let data = {};
      if (fs.existsSync(stampFile)) {
        try { data = JSON.parse(fs.readFileSync(stampFile, 'utf8')); } catch (_) {}
      }
      data.customTitle = cleanTitle;
      fs.writeFileSync(stampFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }
}

function clearCustomTitle(cwd = process.cwd(), sessId = null) {
  try {
    const titlesFile = path.join(homeDir, '.gemini', 'tmp', 'workspace_titles.json');
    if (fs.existsSync(titlesFile)) {
      let mapping = {};
      try { mapping = JSON.parse(fs.readFileSync(titlesFile, 'utf8')); } catch (_) {}
      delete mapping[path.resolve(cwd).toLowerCase()];
      fs.writeFileSync(titlesFile, JSON.stringify(mapping, null, 2), 'utf8');
    }
  } catch (_) {}

  if (sessId) {
    try {
      const cleanId = String(sessId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const stampFile = path.join(homeDir, '.gemini', 'tmp', 'sessions', `${cleanId}.json`);
      if (fs.existsSync(stampFile)) {
        let data = {};
        try { data = JSON.parse(fs.readFileSync(stampFile, 'utf8')); } catch (_) {}
        delete data.customTitle;
        fs.writeFileSync(stampFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (_) {}
  }
}

function getFileSha256(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (_) {
    return null;
  }
}

function hasUtf8Bom(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const buf = Buffer.alloc(3);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, 3, 0);
    fs.closeSync(fd);
    return bytesRead === 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  } catch (_) {
    return false;
  }
}

function stripBomFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
  } catch (_) {}
  return false;
}

function getCanonicalFileMap() {
  const repoRoot = path.join(__dirname, '..');
  const candidateHudJs = [
    path.join(repoRoot, 'bin', 'hud.js'),
    path.join(__dirname, 'hud.js'),
    path.join(homeDir, '.gemini', 'hud', 'hud.js'),
    path.join(homeDir, '.gemini', 'scripts', 'hud.js'),
    __filename
  ].find(p => fs.existsSync(p));

  const candidateHudGui = [
    path.join(repoRoot, 'bin', 'hud_gui.ps1'),
    path.join(__dirname, 'hud_gui.ps1'),
    path.join(homeDir, '.gemini', 'hud', 'hud_gui.ps1'),
    path.join(homeDir, '.gemini', 'scripts', 'hud_gui.ps1')
  ].find(p => fs.existsSync(p));

  const candidateHudHtml = [
    path.join(repoRoot, 'web', 'hud_gui.html'),
    path.join(__dirname, 'hud_gui.html'),
    path.join(homeDir, '.gemini', 'hud', 'hud_gui.html'),
    path.join(homeDir, '.gemini', 'scripts', 'hud_gui.html')
  ].find(p => fs.existsSync(p));

  const candidateHudConfig = [
    path.join(repoRoot, 'bin', 'hud_config.json'),
    path.join(__dirname, 'hud_config.json'),
    path.join(homeDir, '.gemini', 'hud', 'hud_config.json'),
    path.join(homeDir, '.gemini', 'hud_config.json')
  ].find(p => fs.existsSync(p));

  return {
    'hud.js': candidateHudJs,
    'hud_gui.ps1': candidateHudGui,
    'hud_gui.html': candidateHudHtml,
    'hud_config.json': candidateHudConfig
  };
}

function performHealthCheck(repair = false) {
  const canonicalMap = getCanonicalFileMap();
  const scriptsDir = process.env.HUD_TEST_SCRIPTS_DIR || path.join(homeDir, '.gemini', 'scripts');
  const hudDir = process.env.HUD_TEST_HUD_DIR || path.join(homeDir, '.gemini', 'hud');
  const settingsPath = process.env.HUD_TEST_SETTINGS_PATH || path.join(homeDir, '.gemini', 'settings.json');

  const targets = [
    { name: 'scripts', dir: scriptsDir, files: ['hud.js', 'hud_gui.ps1', 'hud_gui.html', 'hud_config.json'] },
    { name: 'hud', dir: hudDir, files: ['hud.js', 'hud_gui.ps1', 'hud_gui.html', 'hud_config.json'] }
  ];

  const report = {
    healthy: true,
    status: 'healthy',
    checkedAt: new Date().toISOString(),
    canonical: {},
    targets: {},
    mismatches: [],
    missing: [],
    bomViolations: [],
    schemaIssues: [],
    hookStatus: { valid: true, details: '' },
    repaired: []
  };

  // 1. Canonical source check
  for (const [fname, fpath] of Object.entries(canonicalMap)) {
    const hash = getFileSha256(fpath);
    report.canonical[fname] = { path: fpath, hash, exists: !!hash };
  }

  // 2. Check target directories
  for (const t of targets) {
    report.targets[t.name] = { dir: t.dir, files: {} };
    for (const fname of t.files) {
      const targetPath = path.join(t.dir, fname);
      const exists = fs.existsSync(targetPath);
      const hash = getFileSha256(targetPath);
      const isBom = hasUtf8Bom(targetPath);
      const canHash = report.canonical[fname]?.hash;

      report.targets[t.name].files[fname] = { path: targetPath, exists, hash, hasBom: isBom };

      if (!exists) {
        report.missing.push({ target: t.name, file: fname, path: targetPath });
        report.healthy = false;
      } else if (fname !== 'hud_config.json' && canHash && hash !== canHash) {
        report.mismatches.push({ target: t.name, file: fname, path: targetPath, currentHash: hash, expectedHash: canHash });
        report.healthy = false;
      }

      if (isBom) {
        report.bomViolations.push({ target: t.name, file: fname, path: targetPath });
        report.healthy = false;
      }
    }
  }

  // 3. Check JSON schema completeness
  const cfgCandidatePaths = [
    path.join(scriptsDir, 'hud_config.json'),
    path.join(hudDir, 'hud_config.json'),
    path.join(homeDir, '.gemini', 'hud_config.json')
  ];
  for (const cp of cfgCandidatePaths) {
    if (fs.existsSync(cp)) {
      try {
        const raw = fs.readFileSync(cp, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.lines === undefined || !Array.isArray(parsed.line1) || !Array.isArray(parsed.line2)) {
          report.schemaIssues.push({ path: cp, issue: 'Incomplete line structure' });
          report.healthy = false;
        }
        if (!parsed.session_uptime || !parsed.fork_advisory) {
          report.schemaIssues.push({ path: cp, issue: 'Missing session_uptime or fork_advisory configuration' });
          report.healthy = false;
        }
      } catch (err) {
        report.schemaIssues.push({ path: cp, issue: `JSON parse error: ${err.message}` });
        report.healthy = false;
      }
    }
  }

  // 4. Check settings.json hook wiring
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const st = JSON.parse(raw);
      if (!st.statusLine || st.statusLine.enabled !== true) {
        report.hookStatus = { valid: false, details: 'statusLine is missing or disabled' };
        report.healthy = false;
      } else {
        const cmd = String(st.statusLine.command || '');
        const targetMatch = cmd.match(/node\s+["']?([^"']+)["']?/i);
        const scriptTarget = targetMatch ? targetMatch[1].trim() : null;
        if (!scriptTarget || !fs.existsSync(scriptTarget)) {
          report.hookStatus = { valid: false, details: `Target script not found: ${cmd}` };
          report.healthy = false;
        } else {
          report.hookStatus = { valid: true, details: `Hook active: ${cmd}` };
        }
      }
    } catch (err) {
      report.hookStatus = { valid: false, details: `Settings error: ${err.message}` };
      report.healthy = false;
    }
  } else if (!process.env.HUD_TEST_MODE) {
    report.hookStatus = { valid: false, details: 'settings.json not found' };
    report.healthy = false;
  }

  // 5. Execute Auto-Repair if requested
  if (repair) {
    for (const t of targets) {
      if (!fs.existsSync(t.dir)) fs.mkdirSync(t.dir, { recursive: true });
      for (const fname of t.files) {
        const srcPath = canonicalMap[fname];
        const destPath = path.join(t.dir, fname);
        if (srcPath && fs.existsSync(srcPath)) {
          const srcHash = getFileSha256(srcPath);
          const destHash = getFileSha256(destPath);
          const needsSync = fname === 'hud_config.json' ? !fs.existsSync(destPath) : (srcHash !== destHash || !fs.existsSync(destPath));
          if (needsSync) {
            fs.copyFileSync(srcPath, destPath);
            report.repaired.push(`Synchronized ${fname} -> ${destPath}`);
          }
        }
        if (hasUtf8Bom(destPath)) {
          stripBomFromFile(destPath);
          report.repaired.push(`Stripped BOM preamble from ${destPath}`);
        }
      }
    }

    // Auto-hydrate hud_config.json across targets
    const cfgPathsToHydrate = [
      path.join(scriptsDir, 'hud_config.json'),
      path.join(hudDir, 'hud_config.json')
    ];
    const seedCfg = canonicalMap['hud_config.json'];

    for (const activeCfgPath of cfgPathsToHydrate) {
      if (!fs.existsSync(activeCfgPath) && seedCfg && fs.existsSync(seedCfg)) {
        fs.copyFileSync(seedCfg, activeCfgPath);
        report.repaired.push(`Initialized default configuration at ${activeCfgPath}`);
      } else if (fs.existsSync(activeCfgPath)) {
        try {
          const raw = fs.readFileSync(activeCfgPath, 'utf8');
          const parsed = JSON.parse(raw);
          const hydrated = {
            lines: typeof parsed.lines === 'number' ? parsed.lines : DEFAULT_CONFIG.lines,
            two_line: typeof parsed.two_line === 'boolean' ? parsed.two_line : DEFAULT_CONFIG.two_line,
            separator: parsed.separator || DEFAULT_CONFIG.separator,
            compact_mode: parsed.compact_mode || DEFAULT_CONFIG.compact_mode,
            line1: Array.isArray(parsed.line1) ? parsed.line1 : DEFAULT_CONFIG.line1,
            line2: Array.isArray(parsed.line2) ? parsed.line2 : DEFAULT_CONFIG.line2,
            line3: Array.isArray(parsed.line3) ? parsed.line3 : DEFAULT_CONFIG.line3,
            line4: Array.isArray(parsed.line4) ? parsed.line4 : DEFAULT_CONFIG.line4,
            disabled: Array.isArray(parsed.disabled) ? parsed.disabled : DEFAULT_CONFIG.disabled,
            item_styles: typeof parsed.item_styles === 'object' && parsed.item_styles !== null ? parsed.item_styles : {},
            session_uptime: { ...DEFAULT_CONFIG.session_uptime, ...(parsed.session_uptime || {}) },
            fork_advisory: { ...DEFAULT_CONFIG.fork_advisory, ...(parsed.fork_advisory || {}) }
          };
          fs.writeFileSync(activeCfgPath, JSON.stringify(hydrated, null, 2), 'utf8');
          report.repaired.push(`Hydrated configuration schema in ${activeCfgPath}`);
        } catch (_) {}
      }
    }

    // Auto-repair settings.json hook
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const st = JSON.parse(raw);
        if (!st.statusLine) st.statusLine = {};
        const bestTarget = (fs.existsSync(path.join(scriptsDir, 'hud.js')) ? path.join(scriptsDir, 'hud.js') : path.join(hudDir, 'hud.js')).replace(/\\/g, '/');
        st.statusLine.command = `node ${bestTarget}`;
        st.statusLine.enabled = true;
        st.statusLine.type = 'command';
        fs.writeFileSync(settingsPath, JSON.stringify(st, null, 2), 'utf8');
        report.repaired.push(`Updated statusLine hook in ${settingsPath}`);
      } catch (_) {}
    }

    report.status = 'repaired';
    report.healthy = true;
  } else {
    report.status = report.healthy ? 'healthy' : 'drifted';
  }

  return report;
}

// -------------------------------------------------------------
// CLI Subcommands (e.g. hud lines, hud compact, hud style, etc.)
// -------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length > 0) {
  const rawCmd = args[0].toLowerCase();
  const cmd = rawCmd.replace(/^--?/, '');
  const cfg = loadConfig();

  if (cmd === 'check' || cmd === 'health' || cmd === 'doctor' || cmd === 'status-check') {
    const isJson = args.includes('--json') || args.includes('-j');
    const doRepair = args.includes('--repair') || args.includes('-r') || args.includes('--fix');
    const report = performHealthCheck(doRepair);

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.healthy ? 0 : 1);
    }

    console.log('\x1b[1m\x1b[36m=== Antigravity CLI (AGY) HUD Health & Drift Check ===\x1b[0m\n');
    console.log(`Checked At: \x1b[90m${report.checkedAt}\x1b[0m`);
    console.log(`Status:     ${report.healthy ? '\x1b[32m✔ 100% HEALTHY (Zero Drift)\x1b[0m' : '\x1b[31m✖ DRIFT OR ISSUES DETECTED\x1b[0m'}\n`);

    console.log('\x1b[1mTarget Directories:\x1b[0m');
    for (const [tName, tInfo] of Object.entries(report.targets)) {
      console.log(`  • \x1b[33m${tName}\x1b[0m (${tInfo.dir}):`);
      for (const [fname, finfo] of Object.entries(tInfo.files)) {
        let icon = finfo.exists ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖ (missing)\x1b[0m';
        if (finfo.exists && report.mismatches.some(m => m.target === tName && m.file === fname)) {
          icon = '\x1b[33m⚠️ (hash mismatch)\x1b[0m';
        }
        if (finfo.hasBom) {
          icon += ' \x1b[31m[BOM PREAMBLE]\x1b[0m';
        }
        console.log(`    - ${fname.padEnd(16)}: ${icon}`);
      }
    }

    console.log('\n\x1b[1mStatusline Hook Wiring:\x1b[0m');
    console.log(`  ${report.hookStatus.valid ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m'} ${report.hookStatus.details}`);

    if (report.schemaIssues.length > 0) {
      console.log('\n\x1b[1m\x1b[31mSchema Issues:\x1b[0m');
      report.schemaIssues.forEach(s => console.log(`  • ${s.path}: ${s.issue}`));
    }

    if (report.repaired.length > 0) {
      console.log('\n\x1b[1m\x1b[32mAuto-Repairs Executed:\x1b[0m');
      report.repaired.forEach(r => console.log(`  ✔ ${r}`));
    } else if (!report.healthy) {
      console.log('\n\x1b[90mTip: Run `hud repair` or `hud check --repair` to automatically fix detected drift.\x1b[0m');
    }

    process.exit(report.healthy ? 0 : 1);
  }

  if (cmd === 'repair' || cmd === 'sync' || cmd === 'self-heal' || cmd === 'fix') {
    const isJson = args.includes('--json') || args.includes('-j');
    const report = performHealthCheck(true);

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    }

    console.log('\x1b[1m\x1b[36m=== Antigravity CLI (AGY) HUD Auto-Repair & Sync ===\x1b[0m\n');
    if (report.repaired.length === 0) {
      console.log('\x1b[32m✔ All components are already in perfect sync (Zero drift detected).\x1b[0m');
    } else {
      console.log(`\x1b[32m✔ Successfully applied ${report.repaired.length} repair(s):\x1b[0m`);
      report.repaired.forEach(r => console.log(`  ✔ ${r}`));
    }
    console.log(`\nFinal Health: ${report.healthy ? '\x1b[32m✔ 100% HEALTHY\x1b[0m' : '\x1b[31m✖ Unresolved issues remain\x1b[0m'}`);
    process.exit(report.healthy ? 0 : 1);
  }

  if (cmd === 'list' || cmd === 'l' || cmd === 'ls') {
    console.log('\x1b[1m\x1b[36m=== Antigravity CLI (AGY) Statusline HUD ===\x1b[0m');
    console.log(`Config File: \x1b[33m${getConfigPath()}\x1b[0m`);
    console.log(`Lines: \x1b[32m${cfg.lines}\x1b[0m, Separator: "${cfg.separator}", Compact Mode: \x1b[36m${cfg.compact_mode}\x1b[0m\n`);
    
    for (let l = 1; l <= 4; l++) {
      const key = `line${l}`;
      const items = cfg[key] || [];
      const activeStatus = l <= cfg.lines ? '\x1b[32m[ACTIVE]\x1b[0m' : '\x1b[90m[INACTIVE]\x1b[0m';
      console.log(`\x1b[1mLine ${l} ${activeStatus}:\x1b[0m`);
      if (items.length === 0) {
        console.log('  \x1b[90m(empty)\x1b[0m');
      } else {
        items.forEach((k, i) => {
          const status = cfg.disabled.includes(k) ? '\x1b[31m[DISABLED]\x1b[0m' : '\x1b[32m[ENABLED]\x1b[0m';
          const style = cfg.item_styles?.[k] ? `\x1b[35m[style:${cfg.item_styles[k]}]\x1b[0m` : '';
          console.log(`  ${i + 1}. ${k.padEnd(16)} ${status} ${style}`);
        });
      }
      console.log('');
    }

    if (cfg.disabled.length > 0) {
      console.log(`\x1b[1mGlobally Disabled:\x1b[0m \x1b[31m${cfg.disabled.join(', ')}\x1b[0m`);
    }

    const upCfg = cfg.session_uptime || DEFAULT_CONFIG.session_uptime;
    console.log('\n\x1b[1mSession Uptime Settings:\x1b[0m');
    console.log(`  Show Seconds: ${upCfg.show_seconds !== false ? '\x1b[32mON\x1b[0m (e.g. 24m 15s)' : '\x1b[33mOFF\x1b[0m (e.g. 24m)'}`);
    console.log('  Thresholds:   ' + (upCfg.thresholds || []).map(t => {
      const limit = t.max_minutes === null ? 'max' : `${t.max_minutes}m`;
      const col = COLOR_MAP[t.color?.toLowerCase()] || COLOR_MAP.gray;
      return `${limit}:${col}${t.color || 'gray'}\x1b[0m`;
    }).join(' • '));

    console.log('\n\x1b[90mTip: Run `hud help` for usage examples or `hud edit` / `hud gui` to customize.\x1b[0m');
    process.exit(0);
  }

  if (cmd === 'lines' || cmd === 'line-count') {
    const val = parseInt(args[1], 10);
    if (isNaN(val) || val < 1 || val > 4) {
      console.log(`Current Line Count: \x1b[32m${cfg.lines}\x1b[0m. Usage: hud lines <1|2|3|4>`);
      process.exit(0);
    }
    cfg.lines = val;
    cfg.two_line = val >= 2;
    saveConfig(cfg);
    console.log(`\x1b[32m✔ Statusline layout set to ${val} line(s).\x1b[0m`);
    process.exit(0);
  }

  if (cmd === 'compact' || cmd === 'mode') {
    const val = args[1]?.toLowerCase();
    if (!val || !['auto', 'full', 'short', 'minimal'].includes(val)) {
      console.log(`Current Compact Mode: \x1b[32m${cfg.compact_mode || 'auto'}\x1b[0m. Usage: hud compact <auto|full|short|minimal>`);
      process.exit(0);
    }
    cfg.compact_mode = val;
    saveConfig(cfg);
    console.log(`\x1b[32m✔ Global compact mode set to: ${val}\x1b[0m`);
    process.exit(0);
  }

  if (cmd === 'style') {
    const item = args[1]?.toLowerCase();
    const style = args[2]?.toLowerCase();
    if (!item) {
      console.log('\x1b[1m\x1b[36m=== AGY HUD: Item Formatting Styles ===\x1b[0m\n');
      console.log('Current Overrides:');
      const styles = cfg.item_styles || {};
      if (Object.keys(styles).length === 0) {
        console.log('  \x1b[90mNone (all items using global/auto mode)\x1b[0m');
      } else {
        for (const [k, s] of Object.entries(styles)) {
          console.log(`  • ${k.padEnd(16)} -> \x1b[32m${s}\x1b[0m`);
        }
      }
      console.log('\n\x1b[90mUsage:\x1b[0m');
      console.log('  hud style <item> <full|short|minimal|auto>   Set style for specific item');
      console.log('  hud style reset                              Reset all item style overrides');
      process.exit(0);
    }

    if (item === 'reset' || item === 'clear') {
      cfg.item_styles = {};
      saveConfig(cfg);
      console.log('\x1b[32m✔ All item style overrides reset to auto.\x1b[0m');
      process.exit(0);
    }

    if (!style || !['full', 'short', 'minimal', 'auto'].includes(style)) {
      console.error(`Invalid style "${style}". Choose from: full, short, minimal, auto`);
      process.exit(1);
    }

    if (!cfg.item_styles) cfg.item_styles = {};
    if (style === 'auto') {
      delete cfg.item_styles[item];
      console.log(`\x1b[32m✔ Item "${item}" style set to auto.\x1b[0m`);
    } else {
      cfg.item_styles[item] = style;
      console.log(`\x1b[32m✔ Item "${item}" style set to "${style}".\x1b[0m`);
    }
    saveConfig(cfg);
    process.exit(0);
  }

  if (cmd === 'uptime' || cmd === 'session') {
    const sub = args[1]?.toLowerCase();
    const upCfg = cfg.session_uptime || DEFAULT_CONFIG.session_uptime;

    if (!sub) {
      console.log('\x1b[1m\x1b[36m=== AGY HUD: Session Uptime Configuration ===\x1b[0m\n');
      const secStatus = upCfg.show_seconds !== false ? '\x1b[32mON\x1b[0m (shows seconds after minute: 24m 15s)' : '\x1b[33mOFF\x1b[0m (minutes only: 24m)';
      console.log(`  Show Seconds: ${secStatus}`);
      console.log('\n\x1b[1mColor Thresholds:\x1b[0m');
      (upCfg.thresholds || []).forEach((t, i) => {
        const limit = (t.max_minutes === null || t.max_minutes === undefined) ? 'Above previous' : `≤ ${t.max_minutes}m`;
        const colCode = COLOR_MAP[t.color?.toLowerCase()] || COLOR_MAP.gray;
        console.log(`  ${i + 1}. ${limit.padEnd(16)} -> ${colCode}${t.color || 'gray'}\x1b[0m (${colCode}⏱️ sample\x1b[0m)`);
      });
      console.log('\n\x1b[90mUsage:\x1b[0m');
      console.log('  hud uptime seconds <on|off>              Toggle seconds display once minutes are accrued');
      console.log('  hud uptime thresholds <spec>             Set custom thresholds (e.g. 15:green,45:yellow,90:magenta,max:red)');
      console.log('  hud uptime reset                         Reset session uptime settings to defaults');
      console.log('  hud ticker <seconds>                     Adjust statusline refresh interval in settings.json');
      process.exit(0);
    }

    if (sub === 'seconds' || sub === 'sec') {
      const val = args[2]?.toLowerCase();
      if (val === 'on' || val === 'true' || val === '1' || val === 'yes') {
        cfg.session_uptime.show_seconds = true;
        saveConfig(cfg);
        console.log('\x1b[32m✔ Session uptime seconds enabled\x1b[0m (e.g. 24m 15s)');
      } else if (val === 'off' || val === 'false' || val === '0' || val === 'no') {
        cfg.session_uptime.show_seconds = false;
        saveConfig(cfg);
        console.log('\x1b[33m✔ Session uptime seconds disabled\x1b[0m (e.g. 24m)');
      } else {
        console.log(`Show Seconds currently: ${upCfg.show_seconds ? 'ON' : 'OFF'}. Use 'hud uptime seconds <on|off>' to change.`);
      }
      process.exit(0);
    }

    if (sub === 'threshold' || sub === 'thresholds') {
      const spec = args.slice(2).join(' ').trim();
      if (!spec) {
        console.error('Usage: hud uptime thresholds <min1:col1,min2:col2,...>');
        console.error('Example: hud uptime thresholds 15:green,45:yellow,90:magenta,max:red');
        process.exit(1);
      }
      const parts = spec.split(/[,;\s]+/);
      const newThresholds = [];
      for (const part of parts) {
        if (!part) continue;
        const [minStr, colorStr] = part.split(':');
        if (!colorStr) {
          console.error(`Invalid segment: "${part}". Format must be <minutes>:<color> (e.g. 15:green)`);
          process.exit(1);
        }
        const max_minutes = (minStr.toLowerCase() === 'max' || minStr.toLowerCase() === 'null' || minStr === '*') ? null : parseFloat(minStr);
        if (max_minutes !== null && isNaN(max_minutes)) {
          console.error(`Invalid minutes limit: "${minStr}"`);
          process.exit(1);
        }
        newThresholds.push({ max_minutes, color: colorStr.toLowerCase() });
      }
      if (newThresholds.length > 0) {
        cfg.session_uptime.thresholds = newThresholds;
        saveConfig(cfg);
        console.log('\x1b[32m✔ Session uptime thresholds updated successfully!\x1b[0m');
      }
      process.exit(0);
    }

    if (sub === 'reset') {
      cfg.session_uptime = JSON.parse(JSON.stringify(DEFAULT_CONFIG.session_uptime));
      saveConfig(cfg);
      console.log('\x1b[32m✔ Session uptime settings reset to defaults.\x1b[0m');
      process.exit(0);
    }
  }

  if (cmd === 'fork' || cmd === 'fork-advisory' || cmd === 'forks') {
    const sub = args[1]?.toLowerCase();
    const fCfg = cfg.fork_advisory || DEFAULT_CONFIG.fork_advisory;

    let convId = null;
    let livePayload = {};
    const payloadPath = path.join(homeDir, '.gemini', 'tmp', 'last_live_payload.json');
    if (fs.existsSync(payloadPath)) {
      try {
        livePayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
        convId = livePayload.conversation_id || livePayload.session_id;
      } catch (_) {}
    }

    if (!sub || sub === 'status' || sub === 'info') {
      const snooze = getForkSnooze(convId);
      const steps = getTranscriptStepCount(livePayload);
      const ctx = livePayload.context_window || {};
      let ctxPercent = ctx.used_percentage ?? livePayload.context_percentage ?? 0;
      if (ctxPercent > 0 && ctxPercent <= 1 && (ctx.total_input_tokens ?? 0) > 1000) {
        ctxPercent = Math.round(ctxPercent * 100);
      } else {
        ctxPercent = Math.round(ctxPercent);
      }

      console.log('\x1b[1m\x1b[36m=== AGY HUD: Fork Advisory Status ===\x1b[0m\n');
      console.log(`  Advisory Enabled:     ${fCfg.enabled !== false ? '\x1b[32mON\x1b[0m' : '\x1b[31mOFF\x1b[0m'}`);
      console.log(`  Current Session ID:   \x1b[90m${convId || 'Unknown'}\x1b[0m`);
      console.log(`  Current Context:      \x1b[33m${ctxPercent}%\x1b[0m`);
      console.log(`  Current Steps:        \x1b[36m${steps}\x1b[0m`);
      if (snooze.snoozed) {
        console.log(`  Snooze Status:        \x1b[33mSnoozed (${snooze.remainingMinutes}m remaining)\x1b[0m`);
      } else {
        console.log(`  Snooze Status:        \x1b[32mActive (No Snooze)\x1b[0m`);
      }
      console.log('\n\x1b[1mThresholds:\x1b[0m');
      console.log(`  • Advisory (Yellow):  ≥ ${fCfg.warning_percent}% ctx OR ≥ ${fCfg.step_warning} steps`);
      console.log(`  • Alert (Magenta):    ≥ ${fCfg.alert_percent}% ctx OR ≥ ${fCfg.step_alert} steps`);
      console.log(`  • Critical (Red):     ≥ ${fCfg.critical_percent}% ctx OR ≥ ${fCfg.step_critical} steps`);
      console.log('\n\x1b[90mUsage:\x1b[0m');
      console.log('  hud fork snooze [min]           Snooze fork badge (default: 30 minutes)');
      console.log('  hud fork unsnooze               Clear snooze and re-enable badge immediately');
      console.log('  hud fork enable | disable       Toggle fork advisory badge in statusline');
      console.log('  hud fork thresholds <spec>      Set custom thresholds (e.g. 60,75,90 or 60:75:90)');
      process.exit(0);
    }

    if (sub === 'snooze') {
      const min = parseInt(args[2], 10) || 30;
      setForkSnooze(convId, min);
      console.log(`\x1b[32m✔ Fork advisory snoozed for ${min} minute(s) for session ${convId || 'active'}.\x1b[0m`);
      process.exit(0);
    }

    if (sub === 'unsnooze' || sub === 'clear' || sub === 'reset-snooze') {
      clearForkSnooze();
      console.log('\x1b[32m✔ Fork advisory snooze cleared. Badge re-enabled.\x1b[0m');
      process.exit(0);
    }

    if (sub === 'enable' || sub === 'on') {
      cfg.fork_advisory.enabled = true;
      saveConfig(cfg);
      console.log('\x1b[32m✔ Fork advisory enabled.\x1b[0m');
      process.exit(0);
    }

    if (sub === 'disable' || sub === 'off') {
      cfg.fork_advisory.enabled = false;
      saveConfig(cfg);
      console.log('\x1b[33m✔ Fork advisory disabled.\x1b[0m');
      process.exit(0);
    }

    if (sub === 'threshold' || sub === 'thresholds') {
      const spec = args.slice(2).join(' ').trim();
      const nums = spec.split(/[,:\s]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
      if (nums.length >= 3) {
        cfg.fork_advisory.warning_percent = nums[0];
        cfg.fork_advisory.alert_percent = nums[1];
        cfg.fork_advisory.critical_percent = nums[2];
        saveConfig(cfg);
        console.log(`\x1b[32m✔ Fork context thresholds updated: ${nums[0]}% / ${nums[1]}% / ${nums[2]}%\x1b[0m`);
      } else {
        console.error('Usage: hud fork thresholds <warnPct,alertPct,critPct> (e.g. 60,75,90)');
        process.exit(1);
      }
      process.exit(0);
    }
  }

  if (cmd === 'ticker' || cmd === 'interval' || cmd === 'refresh') {
    const secInput = args[1];
    const settingsPaths = [
      path.join(homeDir, '.gemini', 'settings.json'),
      path.join(homeDir, '.gemini', 'antigravity-cli', 'settings.json')
    ];

    if (!secInput) {
      console.log('\x1b[1m\x1b[36m=== AGY HUD: Statusline Ticker / Refresh Interval ===\x1b[0m\n');
      let currentSec = 'Default (Event-Driven)';
      for (const sp of settingsPaths) {
        if (fs.existsSync(sp)) {
          try {
            const st = JSON.parse(fs.readFileSync(sp, 'utf8'));
            if (st.statusLine?.interval_seconds) currentSec = `${st.statusLine.interval_seconds}s`;
            else if (st.statusLine?.interval) currentSec = `${st.statusLine.interval}s`;
            else if (st.statusLine?.interval_ms) currentSec = `${st.statusLine.interval_ms}ms`;
          } catch (_) {}
        }
      }
      console.log(`Current Ticker Interval: \x1b[32m${currentSec}\x1b[0m`);
      console.log('\n\x1b[90mUsage:\x1b[0m');
      console.log('  hud ticker <seconds>      Set statusline refresh interval (e.g. `hud ticker 1` for 1s, `hud ticker 5` for 5s)');
      process.exit(0);
    }

    const intervalSec = parseFloat(secInput);
    if (isNaN(intervalSec) || intervalSec < 0.2) {
      console.error('Please specify a valid interval in seconds (e.g. 1, 2, 5).');
      process.exit(1);
    }

    let updatedCount = 0;
    for (const sp of settingsPaths) {
      if (fs.existsSync(sp)) {
        try {
          const st = JSON.parse(fs.readFileSync(sp, 'utf8'));
          if (!st.statusLine) st.statusLine = {};
          st.statusLine.interval_seconds = intervalSec;
          st.statusLine.interval = intervalSec;
          st.statusLine.interval_ms = Math.round(intervalSec * 1000);
          fs.writeFileSync(sp, JSON.stringify(st, null, 2), 'utf8');
          updatedCount++;
        } catch (_) {}
      }
    }
    console.log(`\x1b[32m✔ Statusline update ticker set to ${intervalSec}s across ${updatedCount} settings file(s).\x1b[0m`);
    process.exit(0);
  }

  if (cmd === 'toggle' || cmd === 't') {
    const item = args[1]?.toLowerCase();
    if (!item) {
      console.error('Usage: hud toggle <item-key> (e.g. hud toggle sandbox)');
      process.exit(1);
    }
    const idx = cfg.disabled.indexOf(item);
    if (idx >= 0) {
      cfg.disabled.splice(idx, 1);
      console.log(`\x1b[32m✔ Enabled HUD item:\x1b[0m ${item}`);
    } else {
      cfg.disabled.push(item);
      console.log(`\x1b[31m✖ Disabled HUD item:\x1b[0m ${item}`);
    }
    saveConfig(cfg);
    process.exit(0);
  }

  if (cmd === 'enable' || cmd === 'on') {
    const item = args[1]?.toLowerCase();
    if (!item) {
      console.error('Usage: hud enable <item-key>');
      process.exit(1);
    }
    const idx = cfg.disabled.indexOf(item);
    if (idx >= 0) cfg.disabled.splice(idx, 1);
    saveConfig(cfg);
    console.log(`\x1b[32m✔ Enabled HUD item:\x1b[0m ${item}`);
    process.exit(0);
  }

  if (cmd === 'disable' || cmd === 'off') {
    const item = args[1]?.toLowerCase();
    if (!item) {
      console.error('Usage: hud disable <item-key>');
      process.exit(1);
    }
    if (!cfg.disabled.includes(item)) cfg.disabled.push(item);
    saveConfig(cfg);
    console.log(`\x1b[31m✖ Disabled HUD item:\x1b[0m ${item}`);
    process.exit(0);
  }

  if (cmd === 'gui' || cmd === 'ui' || cmd === 'web') {
    const http = require('http');
    const guiHtmlCandidates = [
      path.join(__dirname, 'hud_gui.html'),
      path.join(__dirname, '..', 'web', 'hud_gui.html'),
      path.join(homeDir, '.gemini', 'scripts', 'hud_gui.html')
    ];
    let guiHtmlPath = guiHtmlCandidates.find(p => fs.existsSync(p));
    if (!guiHtmlPath) {
      console.error('GUI template not found.');
      process.exit(1);
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      
      if (req.method === 'GET' && url.pathname === '/') {
        const html = fs.readFileSync(guiHtmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(loadConfig()));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const newCfg = JSON.parse(body);
            saveConfig(newCfg);
            console.log('\x1b[32m✔ Configuration saved via GUI.\x1b[0m');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    const PORT = 3847;
    server.listen(PORT, '127.0.0.1', () => {
      const url = `http://localhost:${PORT}`;
      console.log('\x1b[1m\x1b[36m=======================================================\x1b[0m');
      console.log('\x1b[1m\x1b[36m      Antigravity CLI (AGY) Statusline HUD Config      \x1b[0m');
      console.log('\x1b[1m\x1b[36m=======================================================\x1b[0m\n');
      console.log(`Web GUI running at: \x1b[32m${url}\x1b[0m`);
      console.log('Press \x1b[33mCtrl+C\x1b[0m in this terminal to exit.\n');
      try {
        const { exec } = require('child_process');
        exec(`start "" "${url}"`);
      } catch (_) {}
    });
    return;
  }

  if (cmd === 'edit' || cmd === 'e') {
    const cfgFile = getConfigPath();
    console.log(`Opening configuration in editor: ${cfgFile}`);
    try {
      execFileSync('cmd.exe', ['/c', 'start', '', cfgFile], { windowsHide: true });
    } catch (_) {
      console.log(`Config path: ${cfgFile}`);
    }
    process.exit(0);
  }

  if (cmd === 'reset') {
    saveConfig(DEFAULT_CONFIG);
    console.log('\x1b[32m✔ HUD configuration reset to default layout.\x1b[0m');
    process.exit(0);
  }

  if (cmd === 'path' || cmd === 'p') {
    console.log(getConfigPath());
    process.exit(0);
  }

  if (cmd === 'title' || cmd === 'set-title') {
    const rawSub = args.slice(1).join(' ').trim();
    const cleanSub = rawSub.replace(/^["']|["']$/g, '').trim();
    const cwd = process.cwd();

    if (!cleanSub) {
      const curTitle = getCustomTitle({}, cwd);
      const wsName = path.basename(cwd) || cwd;
      const projName = getProjectName(cwd, {});
      let defTarget = wsName;
      if (projName && projName.toLowerCase() !== wsName.toLowerCase()) defTarget = `${projName} › ${wsName}`;
      else if (projName) defTarget = projName;

      console.log('\x1b[1m\x1b[36m=== AGY HUD: Session & Tab Title ===\x1b[0m\n');
      console.log(`  Current CWD:          \x1b[90m${cwd}\x1b[0m`);
      console.log(`  Custom Title:         ${curTitle ? `\x1b[32m${curTitle}\x1b[0m` : '\x1b[33m[NONE] (using default)\x1b[0m'}`);
      console.log(`  Resolved Display:     \x1b[34m📁 ${curTitle || defTarget}\x1b[0m`);
      console.log(`  Terminal Tab Title:   \x1b[35m[agy] ${curTitle || defTarget}\x1b[0m\n`);
      console.log('\x1b[90mUsage:\x1b[0m');
      console.log('  hud title <custom title>         Set custom title for current workspace/session');
      console.log('  hud title reset                  Clear custom title and revert to default folder name');
      console.log('  title <custom title>             Quick PowerShell alias (e.g. title "Refactoring Auth")');
      process.exit(0);
    }

    if (cleanSub.toLowerCase() === 'reset' || cleanSub.toLowerCase() === 'clear' || cleanSub.toLowerCase() === '--reset' || cleanSub.toLowerCase() === '-r') {
      clearCustomTitle(cwd);
      console.log('\x1b[32m✔ Custom title cleared. Reverted to default workspace name.\x1b[0m');
      const wsName = path.basename(cwd) || cwd;
      const projName = getProjectName(cwd, {});
      let defTarget = wsName;
      if (projName && projName.toLowerCase() !== wsName.toLowerCase()) defTarget = `${projName} › ${wsName}`;
      else if (projName) defTarget = projName;
      process.stdout.write(`\x1b]0;[agy] ${defTarget}\x07`);
      process.exit(0);
    }

    setCustomTitle(cleanSub, cwd);
    console.log(`\x1b[32m✔ Session & tab title set to:\x1b[0m \x1b[1m\x1b[36m${cleanSub}\x1b[0m`);
    process.stdout.write(`\x1b]0;[agy] ${cleanSub}\x07`);
    process.exit(0);
  }

  if (cmd === 'sync-projects' || cmd === 'syncprojects' || cmd === 'autocorrect') {
    const count = syncProjectAliases(true);
    console.log(`\x1b[32m✔ Synchronized project name autocorrect aliases (${count} new aliases created).\x1b[0m`);
    process.exit(0);
  }

  if (cmd === 'help' || cmd === 'h' || cmd === '?' || cmd === '/?') {
    console.log('\x1b[1m\x1b[36m=======================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m        Antigravity CLI (AGY) Statusline HUD Help      \x1b[0m');
    console.log('\x1b[1m\x1b[36m=======================================================\x1b[0m\n');
    console.log('\x1b[1mCommands:\x1b[0m');
    console.log('  \x1b[33mhud\x1b[0m                           View active layout and items status');
    console.log('  \x1b[33mhud check [--repair]\x1b[0m          Verify integrity & SHA-256 parity across runtimes');
    console.log('  \x1b[33mhud repair / hud sync\x1b[0m         Self-healing auto-repair and runtime synchronization');
    console.log('  \x1b[33mhud lines <1-4>\x1b[0m               Configure number of display lines (1 to 4)');
    console.log('  \x1b[33mhud compact <mode>\x1b[0m            Set global compact mode (auto, full, short, minimal)');
    console.log('  \x1b[33mhud style <item> <style>\x1b[0m      Set item format style (full, short, minimal, auto)');
    console.log('  \x1b[33mhud style reset\x1b[0m               Reset all per-item styles to auto');
    console.log('  \x1b[33mhud title <name>\x1b[0m              Set custom session and tab title (/title)');
    console.log('  \x1b[33mhud title reset\x1b[0m               Reset session and tab title to default');
    console.log('  \x1b[33mhud gui\x1b[0m                       Launch interactive Drag-and-Drop Web GUI');
    console.log('  \x1b[33mhud uptime\x1b[0m                    View and configure Session Uptime thresholds & seconds');
    console.log('  \x1b[33mhud ticker <sec>\x1b[0m              Set CLI statusline refresh interval in settings.json');
    console.log('  \x1b[33mhud fork\x1b[0m                      View / configure Fork Advisory thresholds & snooze');
    console.log('  \x1b[33mhud fork snooze [min]\x1b[0m         Snooze fork warning badge (default 30m)');
    console.log('  \x1b[33mhud sync-projects\x1b[0m             Autocorrect and sync project aliases for /fork');
    console.log('  \x1b[33mhud help\x1b[0m                      Show this quick reference guide');
    console.log('  \x1b[33mhud edit\x1b[0m                      Open hud_config.json in default editor');
    console.log('  \x1b[33mhud toggle <item>\x1b[0m             Toggle an item ON or OFF');
    console.log('  \x1b[33mhud enable <item>\x1b[0m             Explicitly enable an item');
    console.log('  \x1b[33mhud disable <item>\x1b[0m            Explicitly disable an item');
    console.log('  \x1b[33mhud reset\x1b[0m                     Reset HUD configuration to defaults');
    console.log('  \x1b[33mhud path\x1b[0m                      Print path to hud_config.json\n');
    console.log('\x1b[1mAvailable Item Keys:\x1b[0m');
    console.log('  • \x1b[32mworkspace\x1b[0m     📁 Project folder & git branch (⎇ preview *)');
    console.log('  • \x1b[32mgit_status\x1b[0m    🌿 Git Working Directory (Clean / Dirty +1 ~2 ?3)');
    console.log('  • \x1b[32mmodel\x1b[0m         Active AI model name & [🧠 HIGH] effort');
    console.log('  • \x1b[32mstate\x1b[0m         Agent lifecycle status [IDLE] / [WORKING]');
    console.log('  • \x1b[32mauth\x1b[0m          🔑 Authentication provider badge (API-Key/OAuth)');
    console.log('  • \x1b[32msandbox\x1b[0m       🛡️ Sandbox mode status');
    console.log('  • \x1b[32msession\x1b[0m       ⏱️ Live session duration & uptime');
    console.log('  • \x1b[32mcontext\x1b[0m       Ctx: progress bar, % used & prompt cache rate');
    console.log('  • \x1b[32mfork\x1b[0m          🍴 Milestone & step fork advisory badge (snoozeable)');
    console.log('  • \x1b[32mquota_5h\x1b[0m      Quota: 5-hour reserve % & reset countdown');
    console.log('  • \x1b[32mquota_weekly\x1b[0m  Wk: weekly quota reserve %');
    console.log('  • \x1b[32mmcp\x1b[0m           🔌 Active MCP server count');
    console.log('  • \x1b[32msubagents\x1b[0m     🤖 Live subagent counters');
    console.log('  • \x1b[32mtasks\x1b[0m         ⚙️ Running background tasks');
    console.log('  • \x1b[32martifacts\x1b[0m     📝 Generated artifacts count');
    console.log('  • \x1b[32mqueue\x1b[0m         ⏳ Queued user inputs\n');
    console.log('\x1b[1mConfiguration File:\x1b[0m');
    console.log(`  \x1b[33m${getConfigPath()}\x1b[0m`);
    process.exit(0);
  }
}

// -------------------------------------------------------------
// Standard Statusline Engine (stdio JSON pipeline)
// -------------------------------------------------------------
let input = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

function getGitDetails(startDir) {
  let branch = null;
  let dirty = false;
  let ahead = 0;
  let behind = 0;
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  try {
    let curr = path.resolve(startDir);
    let gitDir = null;

    while (curr) {
      const candidate = path.join(curr, '.git');
      if (fs.existsSync(candidate)) {
        gitDir = candidate;
        break;
      }
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }

    if (gitDir) {
      if (fs.statSync(gitDir).isFile()) {
        const content = fs.readFileSync(gitDir, 'utf8').trim();
        const m = content.match(/gitdir:\s*(.+)/);
        if (m) gitDir = path.resolve(path.dirname(gitDir), m[1]);
      }

      const headFile = path.join(gitDir, 'HEAD');
      if (fs.existsSync(headFile)) {
        const headContent = fs.readFileSync(headFile, 'utf8').trim();
        if (headContent.startsWith('ref: refs/heads/')) {
          branch = headContent.replace('ref: refs/heads/', '');
        } else {
          branch = headContent.slice(0, 7);
        }
      }

      try {
        const porcelain = execFileSync('cmd.exe', ['/c', 'git status --porcelain=v1 -unormal 2>nul'], {
          cwd: startDir,
          windowsHide: true,
          encoding: 'utf8'
        });
        if (porcelain && porcelain.trim()) {
          dirty = true;
          const lines = porcelain.trim().split(/\r?\n/);
          for (const l of lines) {
            const x = l[0];
            const y = l[1];
            if (x === '?' && y === '?') untracked++;
            else {
              if (x && x !== ' ' && x !== '?') staged++;
              if (y && y !== ' ') unstaged++;
            }
          }
        }
      } catch (_) {}

      try {
        if (branch) {
          const ab = execFileSync('cmd.exe', ['/c', `git rev-list --left-right --count HEAD...@{upstream} 2>nul`], {
            cwd: startDir,
            windowsHide: true,
            encoding: 'utf8'
          }).trim();
          if (ab) {
            const [a, b] = ab.split(/\s+/).map(n => parseInt(n, 10));
            if (!isNaN(a)) ahead = a;
            if (!isNaN(b)) behind = b;
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  return { branch, dirty, ahead, behind, staged, unstaged, untracked };
}

function getProjectName(cwd, payload) {
  if (payload.project_name) return payload.project_name;
  if (payload.workspace?.project_name) return payload.workspace.project_name;

  const projFile = path.join(homeDir, '.gemini', 'projects.json');
  if (fs.existsSync(projFile)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(projFile, 'utf8'));
      const normalizedCwd = path.resolve(cwd).toLowerCase();
      let bestMatch = null;
      let longestPrefix = 0;

      for (const [pPath, pName] of Object.entries(mapping)) {
        const normPath = path.resolve(pPath).toLowerCase();
        if (normalizedCwd === normPath) {
          return pName;
        }
        if (normalizedCwd.startsWith(normPath + path.sep) || normalizedCwd.startsWith(normPath + '/')) {
          if (normPath.length > longestPrefix) {
            longestPrefix = normPath.length;
            bestMatch = pName;
          }
        }
      }
      if (bestMatch) return bestMatch;
    } catch (_) {}
  }

  let cur = path.resolve(cwd);
  while (cur) {
    const pkg = path.join(cur, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const data = JSON.parse(fs.readFileSync(pkg, 'utf8'));
        if (data.name) return data.name;
      } catch (_) {}
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  return '';
}

function getForkSnooze(convId) {
  try {
    const snoozeFile = path.join(homeDir, '.gemini', 'tmp', 'fork_snooze.json');
    if (fs.existsSync(snoozeFile)) {
      const data = JSON.parse(fs.readFileSync(snoozeFile, 'utf8'));
      if ((!convId || data.conversation_id === convId || !data.conversation_id) && data.expires > Date.now()) {
        return { snoozed: true, remainingMinutes: Math.max(1, Math.round((data.expires - Date.now()) / 60000)), data };
      }
    }
  } catch (_) {}
  return { snoozed: false };
}

function setForkSnooze(convId, minutes = 30) {
  const snoozeFile = path.join(homeDir, '.gemini', 'tmp', 'fork_snooze.json');
  const sDir = path.dirname(snoozeFile);
  if (!fs.existsSync(sDir)) fs.mkdirSync(sDir, { recursive: true });
  const record = {
    conversation_id: convId || null,
    created: Date.now(),
    expires: Date.now() + (minutes * 60 * 1000)
  };
  fs.writeFileSync(snoozeFile, JSON.stringify(record, null, 2), 'utf8');
  return record;
}

function clearForkSnooze() {
  try {
    const snoozeFile = path.join(homeDir, '.gemini', 'tmp', 'fork_snooze.json');
    if (fs.existsSync(snoozeFile)) fs.unlinkSync(snoozeFile);
  } catch (_) {}
}

function getTranscriptStepCount(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (typeof payload.step_count === 'number' && payload.step_count > 0) {
    return payload.step_count;
  }
  let tPath = payload.transcript_path;
  const cid = payload.conversation_id || payload.session_id;
  const candidates = [];
  if (tPath) {
    candidates.push(tPath);
    if (tPath.includes('antigravity\\') || tPath.includes('antigravity/')) {
      candidates.push(tPath.replace(/[/\\]antigravity[/\\]/i, path.sep + 'antigravity-cli' + path.sep));
    }
  }
  if (cid) {
    candidates.push(path.join(homeDir, '.gemini', 'antigravity-cli', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl'));
    candidates.push(path.join(homeDir, '.gemini', 'antigravity', 'brain', cid, '.system_generated', 'logs', 'transcript.jsonl'));
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try {
        const raw = fs.readFileSync(c, 'utf8');
        const count = raw.split(/\r?\n/).filter(Boolean).length;
        if (count > 0) return count;
      } catch (_) {}
    }
  }
  return 0;
}

function getForkAdvisory(payload, ctxPercent, cfg, git = {}, style = 'full') {
  const fCfg = cfg.fork_advisory || DEFAULT_CONFIG.fork_advisory;
  if (fCfg.enabled === false) return '';

  if (fCfg.require_clean_git !== false && git && git.dirty) {
    return '';
  }

  const convId = payload.conversation_id || payload.session_id;
  if (convId) {
    const snooze = getForkSnooze(convId);
    if (snooze.snoozed) return '';
  }

  const steps = getTranscriptStepCount(payload);
  const warnPct = fCfg.warning_percent ?? 60;
  const alertPct = fCfg.alert_percent ?? 75;
  const critPct = fCfg.critical_percent ?? 90;

  const warnSteps = fCfg.step_warning ?? 300;
  const alertSteps = fCfg.step_alert ?? 500;
  const critSteps = fCfg.step_critical ?? 800;

  const isCrit = (ctxPercent >= critPct) || (steps >= critSteps && steps > 0);
  const isAlert = (ctxPercent >= alertPct) || (steps >= alertSteps && steps > 0);
  const isWarn = (ctxPercent >= warnPct) || (steps >= warnSteps && steps > 0);

  const stepInfo = steps > 0 ? ` • ${steps}s` : '';

  if (style === 'minimal') {
    if (isCrit) return '\x1b[1m\x1b[31m🍴 /fork\x1b[0m';
    if (isAlert) return '\x1b[35m🍴 /fork\x1b[0m';
    if (isWarn) return '\x1b[33m🍴 /fork\x1b[0m';
    return '';
  }

  if (style === 'short') {
    if (isCrit) return `\x1b[1m\x1b[31m🍴 /fork now (${ctxPercent}%)\x1b[0m`;
    if (isAlert) return `\x1b[35m🍴 /fork (${ctxPercent}%)\x1b[0m`;
    if (isWarn) return `\x1b[33m🍴 /fork (${ctxPercent}%)\x1b[0m`;
    return '';
  }

  if (isCrit) {
    return `\x1b[1m\x1b[31m🍴 Milestone: /fork now (${ctxPercent}%${stepInfo})\x1b[0m`;
  }
  if (isAlert) {
    return `\x1b[35m🍴 Milestone: /fork ready (${ctxPercent}%${stepInfo})\x1b[0m`;
  }
  if (isWarn) {
    return `\x1b[33m🍴 Milestone: consider /fork (${ctxPercent}%${stepInfo})\x1b[0m`;
  }
  return '';
}

function syncProjectAliases(force = false) {
  const projectsDir = path.join(homeDir, '.gemini', 'config', 'projects');
  if (!fs.existsSync(projectsDir)) return 0;

  const stampFile = path.join(homeDir, '.gemini', 'tmp', 'last_project_sync.json');
  if (!force) {
    try {
      if (fs.existsSync(stampFile)) {
        const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
        if (Date.now() - stamp.timestamp < 60000) return 0;
      }
    } catch (_) {}
  }

  let createdCount = 0;
  try {
    const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const fullPath = path.join(projectsDir, f);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || !data.name) continue;

      const variants = new Set();
      variants.add(data.name);
      variants.add(data.name.replace(/[^a-zA-Z0-9_]/g, ''));
      variants.add(data.name.toLowerCase());
      variants.add(data.name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
      variants.add(data.name.replace(/[\s_]+/g, '-').toLowerCase());
      variants.add(data.name.replace(/[\s-]+/g, '_'));

      if (data.name.includes('.')) {
        const parts = data.name.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          variants.add(lastPart);
          variants.add(lastPart.toLowerCase());
        }
      }

      if (data.projectResources?.resources?.[0]?.folderUri) {
        const folderUri = data.projectResources.resources[0].folderUri;
        const cleanUri = folderUri.replace(/^file:\/\/\/?/, '');
        const folderName = path.basename(decodeURIComponent(cleanUri));
        if (folderName) {
          variants.add(folderName);
          variants.add(folderName.replace(/[^a-zA-Z0-9_]/g, ''));
          if (folderName.includes('.')) {
            const sub = folderName.split('.').pop();
            if (sub) {
              variants.add(sub);
              variants.add(sub.toLowerCase());
            }
          }
        }
      }

      for (const variant of variants) {
        if (!variant || !variant.trim()) continue;
        const cleanVariant = variant.replace(/^\.+/, '').trim();
        if (!cleanVariant) continue;
        const targetPath = path.join(projectsDir, `${cleanVariant}.json`);
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, raw, 'utf8');
          createdCount++;
        }
      }
    }

    const sDir = path.dirname(stampFile);
    if (!fs.existsSync(sDir)) fs.mkdirSync(sDir, { recursive: true });
    fs.writeFileSync(stampFile, JSON.stringify({ timestamp: Date.now() }), 'utf8');
  } catch (_) {}
  return createdCount;
}

function renderProgressBar(percentage, length = 10) {
  const p = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round((p / 100) * length);
  const emptyCount = length - filledCount;

  let color = '\x1b[36m';
  if (p >= 80) color = '\x1b[31m';
  else if (p >= 50) color = '\x1b[33m';

  const filledBar = '█'.repeat(filledCount);
  const emptyBar = '░'.repeat(emptyCount);
  return `${color}${filledBar}${emptyBar}\x1b[0m`;
}

function getAuthBadge(payload, style = 'full') {
  let authType = payload.auth_type || payload.security?.auth_type;
  if (!authType) {
    try {
      const settingsPath = path.join(homeDir, '.gemini', 'antigravity-cli', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        authType = settings.security?.auth?.selectedType;
      }
    } catch (_) {}
  }
  if (style === 'minimal') {
    return authType ? '🔑' : '';
  }
  if (style === 'short') {
    if (authType === 'gemini-api-key') return '🔑 Key';
    if (authType === 'oauth' || authType === 'google-oauth') return '🔑 OAuth';
    if (authType === 'vertex') return '☁️ Vertex';
    return authType ? `🔑 ${authType.slice(0, 5)}` : '';
  }
  if (authType === 'gemini-api-key') return '🔑 API-Key';
  if (authType === 'oauth' || authType === 'google-oauth') return '🔑 OAuth';
  if (authType === 'vertex') return '☁️ Vertex';
  if (authType) return `🔑 ${authType}`;
  return '';
}

function formatTimer(seconds, style = 'full') {
  if (!seconds || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (style === 'minimal') {
    return hours > 0 ? `${(seconds / 3600).toFixed(1)}h` : `${mins}m`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDuration(seconds, showSeconds = true, style = 'full') {
  if (!seconds || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (style === 'minimal') {
    const totalMins = Math.round(seconds / 60);
    return `${totalMins}m`;
  }

  if (style === 'short') {
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  if (hours > 0) {
    if (showSeconds && secs > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${hours}h ${mins}m`;
  }
  if (mins > 0) {
    if (!showSeconds || secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function getQuotaSegments(payload, style5h = 'full', styleWk = 'full') {
  const modelStr = (typeof payload.model === 'string' ? payload.model : payload.model?.display_name || payload.model?.id || '').toLowerCase();
  const is3p = modelStr.includes('claude') || modelStr.includes('gpt') || modelStr.includes('3p') || modelStr.includes('openai') || modelStr.includes('sonnet') || modelStr.includes('opus');

  const quotaMap = payload.quota || payload.quotas || payload.rate_limits || payload.limits || {};

  let q5hBucket = null;
  let qWkBucket = null;

  if (is3p) {
    q5hBucket = quotaMap['3p-5h'] || quotaMap['3p_5h'] || quotaMap['claude-5h'] || quotaMap['gpt-5h'];
    qWkBucket = quotaMap['3p-weekly'] || quotaMap['3p_weekly'] || quotaMap['claude-weekly'] || quotaMap['gpt-weekly'];
  } else {
    q5hBucket = quotaMap['gemini-5h'] || quotaMap['gemini_5h'] || quotaMap['5h'] || quotaMap['rolling_5h'] || quotaMap['primary'];
    qWkBucket = quotaMap['gemini-weekly'] || quotaMap['gemini_weekly'] || quotaMap['weekly'] || quotaMap['secondary'];
  }

  if (!q5hBucket) {
    q5hBucket = quotaMap['gemini-5h'] || quotaMap['3p-5h'] || quotaMap['5h'] || quotaMap['primary'] || Object.values(quotaMap)[0];
  }
  if (!qWkBucket) {
    qWkBucket = quotaMap['gemini-weekly'] || quotaMap['3p-weekly'] || quotaMap['weekly'] || quotaMap['secondary'] || Object.values(quotaMap)[1];
  }

  function extractPercent(bucket) {
    if (bucket == null) return null;
    if (typeof bucket === 'number') return bucket <= 1 && bucket > 0 ? bucket * 100 : bucket;
    if (typeof bucket.remaining_fraction === 'number') return bucket.remaining_fraction * 100;
    if (typeof bucket.remaining_percentage === 'number') return bucket.remaining_percentage;
    if (typeof bucket.fraction === 'number') return bucket.fraction * 100;
    if (typeof bucket.percentage === 'number') return bucket.percentage <= 1 && bucket.percentage > 0 ? bucket.percentage * 100 : bucket.percentage;
    if (typeof bucket.percent === 'number') return bucket.percent <= 1 && bucket.percent > 0 ? bucket.percent * 100 : bucket.percent;
    if (typeof bucket.used_percentage === 'number') {
      const u = bucket.used_percentage <= 1 && bucket.used_percentage > 0 ? bucket.used_percentage * 100 : bucket.used_percentage;
      return 100 - u;
    }
    if (bucket.used != null && bucket.limit) {
      return Math.max(0, ((bucket.limit - bucket.used) / bucket.limit) * 100);
    }
    return null;
  }

  function extractReset(bucket) {
    if (!bucket || typeof bucket !== 'object') return null;
    if (typeof bucket.reset_in_seconds === 'number') return bucket.reset_in_seconds;
    if (typeof bucket.reset_seconds === 'number') return bucket.reset_seconds;
    if (typeof bucket.reset_time === 'string') {
      const diff = Math.floor((new Date(bucket.reset_time).getTime() - Date.now()) / 1000);
      return diff > 0 ? diff : null;
    }
    return null;
  }

  let q5hPercent = extractPercent(q5hBucket);
  let q5hReset = extractReset(q5hBucket);
  let qWkPercent = extractPercent(qWkBucket);
  let qWkReset = extractReset(qWkBucket);

  const isTestMode = Boolean(process.env.HUD_TEST_MODE || payload.is_test);
  const quotaCacheFile = path.join(homeDir, '.gemini', 'tmp', 'last_quota.json');
  if (!isTestMode && (q5hPercent !== null || qWkPercent !== null)) {
    try {
      const qDir = path.dirname(quotaCacheFile);
      if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });
      fs.writeFileSync(quotaCacheFile, JSON.stringify({
        q5hPercent: q5hPercent !== null ? Math.round(q5hPercent) : null,
        q5hReset,
        qWkPercent: qWkPercent !== null ? Math.round(qWkPercent) : null,
        qWkReset,
        updatedAt: Date.now()
      }), 'utf8');
    } catch (_) {}
  } else if (!isTestMode && fs.existsSync(quotaCacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(quotaCacheFile, 'utf8'));
      if (Date.now() - cached.updatedAt < 24 * 3600 * 1000) {
        if (q5hPercent === null) q5hPercent = cached.q5hPercent;
        if (q5hReset === null && cached.q5hReset) {
          const elapsed = Math.floor((Date.now() - cached.updatedAt) / 1000);
          q5hReset = Math.max(0, cached.q5hReset - elapsed);
        }
        if (qWkPercent === null) qWkPercent = cached.qWkPercent;
      }
    } catch (_) {}
  }

  let quota5hSegment = '';
  if (q5hPercent !== null) {
    const val = Math.round(q5hPercent);
    let col = '\x1b[32m';
    if (val < 20) col = '\x1b[31m';
    else if (val < 50) col = '\x1b[33m';

    const countdown = q5hReset && q5hReset > 0 ? ` (↻ ${formatTimer(q5hReset, style5h)})` : '';
    if (style5h === 'minimal') {
      quota5hSegment = `5h: ${col}${val}%\x1b[0m`;
    } else if (style5h === 'short') {
      quota5hSegment = `5h: ${col}${val}%\x1b[0m${countdown}`;
    } else {
      quota5hSegment = `Quota: ${col}${val}%\x1b[0m${countdown}`;
    }
  }

  let quotaWkSegment = '';
  if (qWkPercent !== null) {
    const val = Math.round(qWkPercent);
    let col = '\x1b[32m';
    if (val < 20) col = '\x1b[31m';
    else if (val < 50) col = '\x1b[33m';

    quotaWkSegment = `Wk: ${col}${val}%\x1b[0m`;
  }

  return { quota5hSegment, quotaWkSegment };
}

function getSessionUptime(payload) {
  if (typeof payload.session_duration_seconds === 'number' && payload.session_duration_seconds > 0) {
    return payload.session_duration_seconds;
  }
  if (typeof payload.session_time === 'number' && payload.session_time > 0) {
    return payload.session_time;
  }
  if (typeof payload.uptime === 'number' && payload.uptime > 0) {
    return payload.uptime;
  }
  if (payload.started_at) {
    const start = new Date(payload.started_at).getTime();
    if (!isNaN(start)) {
      return Math.max(0, Math.floor((Date.now() - start) / 1000));
    }
  }
  if (payload.session_start_timestamp) {
    const start = typeof payload.session_start_timestamp === 'number' ? payload.session_start_timestamp : new Date(payload.session_start_timestamp).getTime();
    if (!isNaN(start)) {
      const now = Date.now();
      const diff = start > 1e12 ? (now - start) / 1000 : (now / 1000 - start);
      return Math.max(0, Math.floor(diff));
    }
  }
  const sessId = payload.session_id || payload.conversation_id || payload.thread_id || (payload.workspace?.current_dir ? path.basename(payload.workspace.current_dir) : null);
  if (sessId) {
    try {
      const stampDir = path.join(homeDir, '.gemini', 'tmp', 'sessions');
      if (!fs.existsSync(stampDir)) fs.mkdirSync(stampDir, { recursive: true });
      const cleanId = String(sessId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const stampFile = path.join(stampDir, `${cleanId}.json`);
      if (fs.existsSync(stampFile)) {
        const data = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
        if (data.startTime && (Date.now() - data.lastSeen < 24 * 3600 * 1000)) {
          data.lastSeen = Date.now();
          fs.writeFileSync(stampFile, JSON.stringify(data), 'utf8');
          return Math.max(0, Math.floor((Date.now() - data.startTime) / 1000));
        }
      }
      const newRecord = { startTime: Date.now(), lastSeen: Date.now() };
      fs.writeFileSync(stampFile, JSON.stringify(newRecord), 'utf8');
    } catch (_) {}
  }
  return 0;
}

process.stdin.on('end', () => {
  try {
    if (!input.trim()) {
      process.stdout.write('Gemini │ [IDLE]');
      process.exit(0);
    }
    try {
      fs.writeFileSync(path.join(homeDir, '.gemini', 'tmp', 'last_live_payload.json'), input, 'utf8');
      syncProjectAliases(false);
    } catch (_) {}
    const payload = JSON.parse(input);
    const width = payload.terminal_width || 120;
    const cfg = loadConfig();
    const sep = `\x1b[90m${cfg.separator}\x1b[0m`;

    // 1. Workspace, Project & Git
    const stWs = resolveItemStyle('workspace', cfg, width);
    const cwd = payload.workspace?.current_dir || payload.cwd || process.cwd();
    const wsName = path.basename(cwd) || cwd;
    const projName = getProjectName(cwd, payload);
    const git = getGitDetails(cwd);

    let gitInfo = '';
    if (git.branch) {
      let flags = '';
      if (git.dirty) flags += ' \x1b[33m*\x1b[0m';
      if (stWs === 'full') {
        if (git.ahead > 0) flags += ` \x1b[32m↑${git.ahead}\x1b[0m`;
        if (git.behind > 0) flags += ` \x1b[31m↓${git.behind}\x1b[0m`;
      }
      gitInfo = stWs === 'minimal' ? '' : ` (\x1b[35m⎇ ${git.branch}\x1b[0m${flags})`;
    }

    const customTitle = getCustomTitle(payload, cwd);
    let displayTarget = customTitle || wsName;
    if (!customTitle) {
      if (stWs === 'full' && projName && projName.toLowerCase() !== wsName.toLowerCase()) {
        displayTarget = `${projName} › ${wsName}`;
      } else if (projName) {
        displayTarget = projName;
      }
    }
    const wsSegment = `\x1b[1m\x1b[34m📁 ${displayTarget}\x1b[0m${gitInfo}`;

    // 2. Model & Effort
    const stMdl = resolveItemStyle('model', cfg, width);
    let modelName = 'Gemini';
    if (typeof payload.model === 'string') {
      modelName = payload.model;
    } else if (payload.model && typeof payload.model === 'object') {
      modelName = payload.model.display_name || payload.model.id || 'Gemini';
    }
    if (stMdl === 'minimal') {
      if (modelName.toLowerCase().includes('flash')) modelName = 'Flash';
      else if (modelName.toLowerCase().includes('sonnet')) modelName = 'Sonnet';
      else if (modelName.toLowerCase().includes('opus')) modelName = 'Opus';
      else if (modelName.toLowerCase().includes('pro')) modelName = 'Pro';
      else modelName = modelName.split(' ')[0];
    } else if (stMdl === 'short') {
      modelName = modelName.replace(/\(.*?\)/g, '').trim();
    }
    const effort = (stMdl === 'full' && payload.model?.effort) ? ` \x1b[90m[🧠 ${payload.model.effort.toUpperCase()}]\x1b[0m` : '';
    const modelSegment = `\x1b[1m\x1b[36m${modelName}\x1b[0m${effort}`;

    // 3. Agent State
    const stState = resolveItemStyle('state', cfg, width);
    const rawState = (payload.agent_state || payload.state || 'idle').toUpperCase();
    let stateColor = '\x1b[36m';
    if (rawState.includes('WORK')) stateColor = '\x1b[32m';
    else if (rawState.includes('WAIT')) stateColor = '\x1b[33m';
    else if (rawState.includes('ERR')) stateColor = '\x1b[31m';

    let stateSegment = `${stateColor}\x1b[1m[${rawState}]\x1b[0m`;
    if (stState === 'minimal') {
      stateSegment = `${stateColor}●\x1b[0m`;
    } else if (stState === 'short') {
      const shortCode = rawState.includes('WORK') ? 'WRK' : (rawState.includes('WAIT') ? 'WAIT' : (rawState.includes('IDLE') ? 'IDL' : rawState.slice(0, 4)));
      stateSegment = `${stateColor}[${shortCode}]\x1b[0m`;
    }

    // 4. Context Window & Cache Efficiency
    const stCtx = resolveItemStyle('context', cfg, width);
    const ctx = payload.context_window || {};
    const totalTokens = ctx.total_input_tokens ?? payload.total_input_tokens ?? 0;
    let ctxPercent = ctx.used_percentage ?? payload.context_percentage ?? 0;
    if (ctxPercent > 0 && ctxPercent <= 1 && totalTokens > 1000) {
      ctxPercent = Math.round(ctxPercent * 100);
    } else {
      ctxPercent = Math.round(ctxPercent);
    }

    const currentUsage = ctx.current_usage || payload.current_usage || {};
    const cacheRead = currentUsage.cache_read_input_tokens ?? payload.cache_read_input_tokens ?? 0;
    let cachePercent = 0;
    if (totalTokens > 0 && cacheRead > 0) {
      cachePercent = Math.round((cacheRead / totalTokens) * 100);
    }

    const progressBar = renderProgressBar(ctxPercent, stCtx === 'minimal' ? 4 : (stCtx === 'short' ? 6 : 10));
    let tokenDisplay = '';
    if (totalTokens > 0) {
      tokenDisplay = totalTokens >= 1000 ? `${Math.round(totalTokens / 1000)}k` : `${totalTokens}`;
      if (stCtx === 'full') tokenDisplay = `${totalTokens.toLocaleString()} tok`;
    }
    const cacheDisplay = cachePercent > 0 ? `\x1b[32m(⚡ ${cachePercent}%)\x1b[0m` : '';

    let ctxSegment = `Ctx: ${progressBar} \x1b[1m${ctxPercent}%\x1b[0m`;
    if (stCtx === 'minimal') {
      ctxSegment = `Ctx: \x1b[1m${ctxPercent}%\x1b[0m`;
    } else if (stCtx === 'short') {
      if (tokenDisplay) ctxSegment += ` (${tokenDisplay})`;
      if (cacheDisplay) ctxSegment += ` ${cacheDisplay}`;
    } else {
      if (tokenDisplay) ctxSegment += ` (${tokenDisplay})`;
      if (cacheDisplay) ctxSegment += ` ${cacheDisplay}`;
    }

    // 5. Dual Quotas (5-Hour Rolling & Weekly)
    const stQ5h = resolveItemStyle('quota_5h', cfg, width);
    const stQwk = resolveItemStyle('quota_weekly', cfg, width);
    const { quota5hSegment, quotaWkSegment } = getQuotaSegments(payload, stQ5h, stQwk);

    // 6. MCP Servers
    const stMcp = resolveItemStyle('mcp', cfg, width);
    let mcpCount = 0;
    if (Array.isArray(payload.mcp_servers)) mcpCount = payload.mcp_servers.length;
    else if (typeof payload.mcp_server_count === 'number') mcpCount = payload.mcp_server_count;
    else if (typeof payload.mcp_servers_count === 'number') mcpCount = payload.mcp_servers_count;
    else if (typeof payload.mcp_count === 'number') mcpCount = payload.mcp_count;

    if (mcpCount === 0) {
      const mcpCfgPath = path.join(homeDir, '.gemini', 'config', 'mcp_config.json');
      if (fs.existsSync(mcpCfgPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(mcpCfgPath, 'utf8'));
          if (cfg.mcpServers) mcpCount = Object.keys(cfg.mcpServers).length;
        } catch (_) {}
      }
    }
    const mcpLabel = stMcp === 'full' ? ` ${mcpCount} MCP` : ` ${mcpCount}`;
    const mcpSegment = mcpCount > 0 ? `\x1b[36m🔌${mcpLabel}\x1b[0m` : '';

    // 7. Background Tasks & Subagents
    const stTasks = resolveItemStyle('tasks', cfg, width);
    let taskCount = 0;
    if (typeof payload.running_tasks_count === 'number') taskCount = payload.running_tasks_count;
    else if (typeof payload.background_task_count === 'number') taskCount = payload.background_task_count;
    else if (Array.isArray(payload.background_tasks)) {
      taskCount = payload.background_tasks.filter(t => {
        if (!t) return false;
        if (typeof t === 'string') return true;
        const st = (t.state || t.status || '').toLowerCase();
        return st === 'running' || st === 'active' || st === 'in_progress' || st === 'waiting_for_input';
      }).length;
    } else if (Array.isArray(payload.tasks)) {
      taskCount = payload.tasks.filter(t => {
        if (!t) return false;
        if (typeof t === 'string') return true;
        const st = (t.state || t.status || '').toLowerCase();
        return st === 'running' || st === 'active' || st === 'in_progress' || st === 'waiting_for_input';
      }).length;
    } else if (payload.tasks && typeof payload.tasks.running === 'number') {
      taskCount = payload.tasks.running;
    }
    const taskLabel = stTasks === 'full' ? ` ${taskCount} task${taskCount > 1 ? 's' : ''}` : ` ${taskCount}`;
    const taskSegment = taskCount > 0 ? `\x1b[33m⚙️${taskLabel}\x1b[0m` : '';

    const stSub = resolveItemStyle('subagents', cfg, width);
    let subagentCount = 0;
    if (typeof payload.running_subagents_count === 'number') subagentCount = payload.running_subagents_count;
    else if (typeof payload.active_subagents_count === 'number') subagentCount = payload.active_subagents_count;
    else if (Array.isArray(payload.subagents)) {
      subagentCount = payload.subagents.filter(s => {
        if (!s) return false;
        if (typeof s === 'string') return true;
        const st = (s.state || s.status || '').toLowerCase();
        return st === 'running' || st === 'waiting_for_input' || st === 'waiting_for_dependents' || st === 'in_progress';
      }).length;
    } else if (payload.subagents && typeof payload.subagents.active === 'number') {
      subagentCount = payload.subagents.active;
    } else if (typeof payload.subagent_count === 'number') {
      subagentCount = payload.subagent_count;
    }
    const subLabel = stSub === 'full' ? ` ${subagentCount} subagent${subagentCount > 1 ? 's' : ''}` : ` ${subagentCount}`;
    const subagentSegment = subagentCount > 0 ? `\x1b[36m🤖${subLabel}\x1b[0m` : '';

    // 8. Artifacts & Queued Messages
    const artCount = payload.artifact_count ?? (Array.isArray(payload.artifacts) ? payload.artifacts.length : 0);
    const artifacts = artCount > 0 ? `\x1b[33m📝 ${artCount}\x1b[0m` : '';

    let queueCount = 0;
    if (typeof payload.pending_input_count === 'number') queueCount = payload.pending_input_count;
    else if (typeof payload.queued_messages_count === 'number') queueCount = payload.queued_messages_count;
    else if (typeof payload.queued_inputs_count === 'number') queueCount = payload.queued_inputs_count;
    else if (typeof payload.queue_count === 'number') queueCount = payload.queue_count;
    else if (typeof payload.queue_length === 'number') queueCount = payload.queue_length;
    else if (Array.isArray(payload.queued_messages)) queueCount = payload.queued_messages.length;
    else if (Array.isArray(payload.queued_inputs)) queueCount = payload.queued_inputs.length;
    else if (Array.isArray(payload.pending_inputs)) queueCount = payload.pending_inputs.length;
    else if (Array.isArray(payload.pending_messages)) queueCount = payload.pending_messages.length;
    else if (Array.isArray(payload.message_queue)) queueCount = payload.message_queue.length;

    const queued = queueCount > 0 ? `\x1b[36m⏳ ${queueCount}\x1b[0m` : '';

    // 9. Session Runtime
    const stSess = resolveItemStyle('session', cfg, width);
    const sessionSec = getSessionUptime(payload);
    let sessionSegment = '';
    if (sessionSec > 0) {
      const uptimeCfg = cfg.session_uptime || DEFAULT_CONFIG.session_uptime;
      const showSec = uptimeCfg.show_seconds !== false;
      const col = getUptimeColor(sessionSec, uptimeCfg.thresholds);
      sessionSegment = `${col}⏱️ ${formatDuration(sessionSec, showSec, stSess)}\x1b[0m`;
    }

    // 10. Auth & Sandbox Badges
    const stAuth = resolveItemStyle('auth', cfg, width);
    const authBadge = getAuthBadge(payload, stAuth);
    const authSegment = authBadge ? `\x1b[90m${authBadge}\x1b[0m` : '';

    const stSand = resolveItemStyle('sandbox', cfg, width);
    let sandboxLabel = '🛡️ Sandbox';
    if (stSand === 'minimal') sandboxLabel = '🛡️';
    else if (stSand === 'short') sandboxLabel = '🛡️ Sandboxed';
    const sandboxSegment = (payload.sandbox?.enabled || payload.sandbox_enabled) ? `\x1b[32m${sandboxLabel}\x1b[0m` : '';

    // 11. Git Working Directory Clean / Dirty Status
    const stGit = resolveItemStyle('git_status', cfg, width);
    let gitStatusSegment = '';
    if (git.branch) {
      if (!git.dirty) {
        gitStatusSegment = stGit === 'minimal' ? '\x1b[32m🌿\x1b[0m' : '\x1b[32m🌿 Clean\x1b[0m';
      } else {
        let details = [];
        if (git.staged > 0) details.push(`+${git.staged}`);
        if (git.unstaged > 0) details.push(`~${git.unstaged}`);
        if (git.untracked > 0) details.push(`?${git.untracked}`);
        const detailStr = details.length > 0 ? ` \x1b[90m(${details.join(' ')})\x1b[0m` : '';
        if (stGit === 'minimal') {
          gitStatusSegment = '\x1b[33m⚠️\x1b[0m';
        } else if (stGit === 'short') {
          gitStatusSegment = `\x1b[33m⚠️\x1b[0m${detailStr}`;
        } else {
          gitStatusSegment = `\x1b[33m⚠️ Dirty\x1b[0m${detailStr}`;
        }
      }
    }

    // 12. Fork Advisory Badge
    const stFork = resolveItemStyle('fork', cfg, width);
    const forkSegment = getForkAdvisory(payload, ctxPercent, cfg, git, stFork);

    // Item Map
    const itemMap = {
      workspace: wsSegment,
      git_status: gitStatusSegment,
      model: modelSegment,
      state: stateSegment,
      auth: authSegment,
      sandbox: sandboxSegment,
      session: sessionSegment,
      context: ctxSegment,
      fork: forkSegment,
      fork_advisory: forkSegment,
      quota: [quota5hSegment, quotaWkSegment].filter(Boolean).join(' '),
      quota_5h: quota5hSegment,
      quota_weekly: quotaWkSegment,
      mcp: mcpSegment,
      tasks: taskSegment,
      subagents: subagentSegment,
      artifacts: artifacts,
      queue: queued
    };

    const disabledSet = new Set(cfg.disabled || []);

    function renderLine(keys) {
      return (keys || [])
        .filter(k => !disabledSet.has(k))
        .map(k => itemMap[k])
        .filter(Boolean)
        .join(` ${sep} `);
    }

    const numLines = Math.max(1, Math.min(4, cfg.lines || 2));
    const linesList = [cfg.line1, cfg.line2, cfg.line3, cfg.line4].slice(0, numLines);
    const renderedLines = linesList.map(keys => renderLine(keys)).filter(Boolean);
    const output = renderedLines.join('\n');

    // Emit OSC 0 escape sequence to synchronize terminal tab / window title
    process.stdout.write(`\x1b]0;[agy] ${displayTarget}\x07`);
    process.stdout.write(output);
  } catch (err) {
    process.stdout.write('Gemini │ [READY]');
    process.exit(0);
  }
});