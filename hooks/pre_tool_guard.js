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

  // 2. Check Quota Thresholds
  const quotaFile = path.join(homeDir, '.gemini', 'tmp', 'last_quota.json');
  let quotaWarning = null;
  if (fs.existsSync(quotaFile)) {
    try {
      const quota = JSON.parse(fs.readFileSync(quotaFile, 'utf8'));
      const percentLeft = quota.percent_remaining ?? quota.remaining_percentage;
      if (typeof percentLeft === 'number' && percentLeft < 15) {
        quotaWarning = `Quota Low (${percentLeft}% remaining). Suggest reasoning effort adjustment (/effort low).`;
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
