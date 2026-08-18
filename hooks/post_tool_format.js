#!/usr/bin/env node
/**
 * Antigravity Zero-Quota Post-Tool Auto-Formatting & BOM Stripping Hook
 * Automatically formats modified files locally via Prettier/ast-grep and strips BOM preambles.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function stripBom(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      fs.writeFileSync(filePath, buf.slice(3));
      return true;
    }
  } catch (_) {}
  return false;
}

function formatFile(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return { success: false, reason: 'File does not exist' };

  // 1. Strip UTF-8 BOM if present
  const bomStripped = stripBom(targetPath);

  const ext = path.extname(targetPath).toLowerCase();
  const formatExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.jsonc', '.css', '.scss', '.html', '.md', '.yaml', '.yml'];

  if (formatExts.includes(ext)) {
    try {
      // Run local prettier non-interactively
      execSync(`npx prettier --write "${targetPath}"`, {
        stdio: 'ignore',
        timeout: 5000,
        windowsHide: true
      });
      return { success: true, formatted: true, bomStripped };
    } catch (_) {
      // Fallback: file is still validly saved even if prettier is not globally configured
      return { success: true, formatted: false, bomStripped };
    }
  }

  return { success: true, formatted: false, bomStripped };
}

// CLI Execution
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    process.exit(0);
  }
  const res = formatFile(filePath);
  process.exit(res.success ? 0 : 1);
}

module.exports = { formatFile, stripBom };
