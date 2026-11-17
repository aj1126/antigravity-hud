#!/usr/bin/env node
/**
 * Antigravity Pre-Tool Safety Guardrail & Quota Monitor Hook
 * Intercepts destructive commands and monitors remaining quota thresholds locally.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();

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

  // 2. Check Quota Thresholds (5h rolling and active weekly WTU / standard pool)
  const quotaFile = process.env.HUD_TEST_QUOTA_FILE || path.join(homeDir, '.gemini', 'tmp', 'last_quota.json');
  let quotaWarning = null;
  if (fs.existsSync(quotaFile)) {
    try {
      const quota = JSON.parse(fs.readFileSync(quotaFile, 'utf8'));
      const percent5h = quota.q5hPercent ?? quota.percent_remaining ?? quota.remaining_percentage;
      const percentWk = quota.qWkPercent ?? quota.qArgonWkPercent ?? quota.qFlashWkPercent;
      if (typeof percent5h === 'number' && percent5h < 15) {
        quotaWarning = `Quota Low (5h: ${percent5h}% remaining). Suggest reasoning effort adjustment (/effort low).`;
      } else if (typeof percentWk === 'number' && percentWk < 15) {
        quotaWarning = `Weekly Quota Low (Wk: ${percentWk}% remaining). Suggest reasoning effort adjustment (/effort low) or model switch.`;
      }
    } catch (_) {}
  }

  return { safe: true, warning: quotaWarning };
}

// CLI Execution
if (require.main === module) {
  const commandToEvaluate = process.argv.slice(2).join(' ');
  const res = evaluateCommand(commandToEvaluate);
  if (!res.safe) {
    console.error(`[SAFETY GUARD BLOCKED] ${res.message}`);
    process.exit(1);
  }
  if (res.warning) {
    console.warn(`[QUOTA ADVISORY] ${res.warning}`);
  }
  process.exit(0);
}

module.exports = { evaluateCommand, HIGH_RISK_PATTERNS };
