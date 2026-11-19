#!/usr/bin/env node
/**
 * Antigravity Pre-Tool Safety Guardrail & Quota Monitor Hook
 * Intercepts destructive commands, cross-agent Claude CLI invocations,
 * guards live configuration files, and monitors remaining quota thresholds locally.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
const geminiRoot = path.join(homeDir, '.gemini');

const HIGH_RISK_PATTERNS = [
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d\b/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+push\s+.*-f\b/i,
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+/i,
  /\brmdir\s+\/s\s+\/q\s+/i,
  /\bRemove-Item\s+.*-Recurse\s+.*-Force\s+['"]?[A-Z]:\\?['"]?$/i,
  /\bdrop\s+database\b/i
];

// Cross-agent CLI dispatch guard (mutual manual-only policy)
const CROSS_AGENT_CLI_PATTERNS = [
  /(?:^|[;&|(\r\n])\s*(?:(?:&\s*|\.\s*)?(?:"(?:[^"\r\n]*[\\/])?|'(?:[^'\r\n]*[\\/])?|(?:[^\s'"&|;()]*[\\/])?))claude(?:[23])?(?:\.(?:exe|cmd|bat|ps1))?['"]?(?=$|[\s;&|)\r\n])/i,
  /\bStart-Process\b[^\r\n;|&]*?(?:(?:['"\s\\/]|^)claude(?:[23])?(?:\.(?:exe|cmd|bat|ps1))?|@anthropic-ai[\\/]claude-code(?:[\\/]cli\.(?:js|mjs|cjs))?)(?=$|[\s'"&|;\r\n])/i,
  /\b(?:cmd(?:\.exe)?\s+\/[ck]|(?:pwsh|powershell)(?:\.exe)?\s+[^\r\n;|&]*?-(?:c|Command)|(?:Invoke-Expression|iex))\s+['"]?\s*(?:&\s*|\.\s*)?(?:"(?:[^"\r\n]*[\\/])?|'(?:[^'\r\n]*[\\/])?|(?:[^\s'"&|;()]*[\\/])?)claude(?:[23])?(?:\.(?:exe|cmd|bat|ps1))?['"]?(?=$|[\s'"&|;\r\n])/i,
  /(?:^|[;&|(\r\n])\s*(?:(?:&\s*|\.\s*)?(?:cmd(?:\.exe)?\s+\/[ck]\s+['"]?\s*|(?:pwsh|powershell)(?:\.exe)?\s+[^\r\n;|&]*?-(?:c|Command)\s+['"]?\s*)?)?npx(?:\.(?:cmd|exe|ps1))?(?=\s)[^\r\n;|&]*?@anthropic-ai[\\/]claude-code(?:@[^\s'"&|;)]+)?(?=$|[\s'"&|;)\r\n])/i,
  /(?:^|[;&|(\r\n])\s*(?:(?:&\s*|\.\s*)?(?:cmd(?:\.exe)?\s+\/[ck]\s+['"]?\s*|(?:pwsh|powershell)(?:\.exe)?\s+[^\r\n;|&]*?-(?:c|Command)\s+['"]?\s*)?)?(?:"(?:[^"\r\n]*[\\/])?|'(?:[^'\r\n]*[\\/])?|(?:[^\s'"&|;()]*[\\/])?)node(?:\.exe)?['"]?(?=\s)[^\r\n;|&]*?@anthropic-ai[\\/]claude-code[\\/]cli\.(?:js|mjs|cjs)['"]?(?=$|[\s'"&|;)\r\n])/i
];

function evaluateCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') {
    return { safe: true, warning: null };
  }

  // 1. Check for Destructive Commands
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(cmd)) {
      return {
        safe: false,
        risk: 'HIGH_RISK_DESTRUCTIVE',
        matched: pattern.toString(),
        message: `Blocked potentially destructive command: "${cmd}"`
      };
    }
  }

  // 1b. Block cross-agent Claude CLI invocations (mutual manual-only dispatch policy)
  for (const pattern of CROSS_AGENT_CLI_PATTERNS) {
    if (pattern.test(cmd)) {
      return {
        safe: false,
        risk: 'CROSS_AGENT_CLI_BLOCKED',
        matched: pattern.toString(),
        message: `Blocked cross-agent Claude CLI invocation (manual-only policy): "${cmd}"`
      };
    }
  }

  // 2. Check Quota Thresholds (5h rolling and active weekly WTU / standard pool)
  const quotaFile = process.env.HUD_TEST_QUOTA_FILE || path.join(geminiRoot, 'tmp', 'last_quota.json');
  let quotaWarning = null;
  if (fs.existsSync(quotaFile)) {
    try {
      const quota = JSON.parse(fs.readFileSync(quotaFile, 'utf8'));
      const percent5h = quota.q5hPercent ?? quota.percent_remaining ?? quota.remaining_percentage;
      const percentWk = quota.qWkPercent ?? quota.qArgonWkPercent ?? quota.qGeminiWkPercent ?? quota.qFlashWkPercent;
      if (typeof percent5h === 'number' && percent5h < 15) {
        quotaWarning = `Quota Low (5h: ${percent5h}% remaining). Suggest reasoning effort adjustment (/effort low).`;
      } else if (typeof percentWk === 'number' && percentWk < 15) {
        quotaWarning = `Weekly Quota Low (Wk: ${percentWk}% remaining). Suggest reasoning effort adjustment (/effort low) or switching between Wk(A) and Wk(G) models.`;
      }
    } catch (_) {}
  }

  return { safe: true, warning: quotaWarning };
}

function expandTilde(p) {
  if (!p || typeof p !== 'string') return p;
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(homeDir, p.slice(1));
  }
  return p;
}

function evaluateTargetPath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return { safe: true };

  // Allow bypass during formal ratification protocols
  if (process.env.AGY_RATIFY_ACTIVE === '1') {
    return { safe: true };
  }

  const normalized = path.resolve(expandTilde(targetPath)).toLowerCase();
  const protectedPaths = [
    path.join(geminiRoot, 'config', 'rules').toLowerCase(),
    path.join(geminiRoot, 'antigravity-cli', 'mcp_config.json').toLowerCase(),
    path.join(geminiRoot, 'antigravity', 'mcp_config.json').toLowerCase(),
    path.join(geminiRoot, 'antigravity-ide', 'mcp_config.json').toLowerCase(),
    path.join(geminiRoot, 'config', 'mcp_config.json').toLowerCase(),
    path.join(geminiRoot, 'mcp_config.json').toLowerCase(),
    path.join(geminiRoot, 'GEMINI.md').toLowerCase()
  ];

  for (const p of protectedPaths) {
    if (normalized === p || normalized.startsWith(p + path.sep)) {
      return {
        safe: false,
        message: `Blocked direct write to live Antigravity configuration: "${targetPath}". Follow formal Learning Proposal ratification protocol (LP-vNN / agy-ratify).`
      };
    }
  }

  return { safe: true };
}

// Support stdin JSON and CLI execution
if (require.main === module) {
  const argvCommand = process.argv.slice(2).join(' ').trim();

  if (argvCommand) {
    const res = evaluateCommand(argvCommand);
    if (!res.safe) {
      console.error(`[SAFETY GUARD BLOCKED] ${res.message}`);
      process.exit(1);
    }
    if (res.warning) {
      console.warn(`[QUOTA ADVISORY] ${res.warning}`);
    }
    process.exit(0);
  }

  // Read stdin if piped
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { raw += d; });
  process.stdin.on('end', () => {
    if (!raw.trim()) process.exit(0);
    try {
      const data = JSON.parse(raw);
      const ti = data.toolCall?.args || data.tool_input || data.input || data;
      const cmd = ti?.command || ti?.CommandLine || ti?.cmd;
      const filesToCheck = ti ? [
        ti.path, ti.Path, ti.file_path,
        ti.destination, ti.dest, ti.target,
        ti.source, ti.src
      ].filter(f => f && typeof f === 'string') : [];

      if (cmd) {
        const cmdRes = evaluateCommand(cmd);
        if (!cmdRes.safe) {
          console.error(`[SAFETY GUARD BLOCKED] ${cmdRes.message}`);
          console.log(JSON.stringify({ decision: 'deny', reason: cmdRes.message }));
          process.exit(0);
        }
        if (cmdRes.warning) console.warn(`[QUOTA ADVISORY] ${cmdRes.warning}`);
      }

      for (const targetFile of filesToCheck) {
        const pathRes = evaluateTargetPath(targetFile);
        if (!pathRes.safe) {
          console.error(`[SAFETY GUARD BLOCKED] ${pathRes.message}`);
          console.log(JSON.stringify({ decision: 'deny', reason: pathRes.message }));
          process.exit(0);
        }
      }

      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    } catch (_) {
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0); // Fail-open on unparsable stream
    }
  });
}

module.exports = { evaluateCommand, evaluateTargetPath, HIGH_RISK_PATTERNS, CROSS_AGENT_CLI_PATTERNS };
