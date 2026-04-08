#!/usr/bin/env node
/**
 * Snapshot approval workflow.
 *
 * Usage:
 *   node scripts/approve-snapshots.js              # interactive review
 *   node scripts/approve-snapshots.js --all        # approve all pending
 *   node scripts/approve-snapshots.js --filter nav # approve matching 'nav'
 *
 * This script:
 * 1. Finds new/pending snapshots in `snapshots-pending/`
 * 2. Shows a diff (if imagemagick is available) or lists them
 * 3. Moves approved snapshots to `snapshots/` (the baseline directory)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const PENDING_DIR = path.resolve('./snapshots-pending');
const BASELINE_DIR = path.resolve('./snapshots');
const DIFF_DIR = path.resolve('./test-results/diffs');

const args = process.argv.slice(2);
const approveAll = args.includes('--all');
const filterArg = args.find((a) => a.startsWith('--filter='))?.split('=')[1];

// ─── Find pending snapshots ───────────────────────────────────────────────────

function findPendingSnapshots() {
  if (!fs.existsSync(PENDING_DIR)) {
    console.log('No pending snapshots directory found.');
    return [];
  }

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.png')) {
        const relative = path.relative(PENDING_DIR, full);
        if (!filterArg || relative.includes(filterArg)) {
          files.push({ full, relative });
        }
      }
    }
  }

  walk(PENDING_DIR);
  return files;
}

// ─── Check for diff ───────────────────────────────────────────────────────────

function findDiff(relative) {
  const diffName = relative.replace('.png', '-diff.png');
  const diffPath = path.join(DIFF_DIR, diffName);
  return fs.existsSync(diffPath) ? diffPath : null;
}

// ─── Approve a snapshot ───────────────────────────────────────────────────────

function approve(pending) {
  const dest = path.join(BASELINE_DIR, pending.relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(pending.full, dest);
  fs.unlinkSync(pending.full);
  console.log(`  ✅ Approved: ${pending.relative}`);
}

// ─── Reject (delete pending without promoting) ────────────────────────────────

function reject(pending) {
  fs.unlinkSync(pending.full);
  console.log(`  🗑  Rejected: ${pending.relative}`);
}

// ─── Interactive mode ─────────────────────────────────────────────────────────

async function interactiveReview(snapshots) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log(`\nFound ${snapshots.length} pending snapshots.\n`);

  for (const snap of snapshots) {
    const diff = findDiff(snap.relative);

    console.log(`\n📸 ${snap.relative}`);
    console.log(`   Pending: ${snap.full}`);
    if (diff) {
      console.log(`   Diff:    ${diff}`);
    }

    // Try to open diff in default viewer (best-effort)
    if (diff) {
      try {
        const opener = process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
          ? 'start'
          : 'xdg-open';
        execSync(`${opener} "${diff}"`, { stdio: 'ignore' });
      } catch {
        // Viewer not available — that's fine
      }
    }

    const answer = await ask('  [a]pprove / [r]eject / [s]kip? ');

    switch (answer.toLowerCase()) {
      case 'a':
      case 'approve':
        approve(snap);
        break;
      case 'r':
      case 'reject':
        reject(snap);
        break;
      default:
        console.log('  ⏭  Skipped');
    }
  }

  rl.close();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const snapshots = findPendingSnapshots();

  if (snapshots.length === 0) {
    console.log('✨ No pending snapshots to review.');
    process.exit(0);
  }

  if (approveAll) {
    console.log(`Approving all ${snapshots.length} pending snapshots...\n`);
    for (const snap of snapshots) {
      approve(snap);
    }
    console.log('\nDone.');
  } else {
    await interactiveReview(snapshots);
  }

  // Clean up empty directories in pending
  function cleanEmpty(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) cleanEmpty(path.join(dir, entry.name));
    }
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }

  cleanEmpty(PENDING_DIR);
  console.log('\n✨ Review complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});