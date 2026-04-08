import type {
    FullResult,
    Reporter,
    Suite,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface SnapshotSummary {
  total: number;
  passed: number;
  failed: number;
  new: number;
  skipped: number;
  failures: FailureDetail[];
  newSnapshots: string[];
}

interface FailureDetail {
  test: string;
  project: string;
  snapshot: string;
  diffPixels?: number;
  error: string;
}

/**
 * Custom reporter that produces a focused visual regression summary.
 * Separate from Playwright's built-in HTML reporter — this one highlights
 * only snapshot comparison results and generates a markdown summary
 * suitable for PR comments.
 */
export class VisualReporter implements Reporter {
  private summary: SnapshotSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    new: 0,
    skipped: 0,
    failures: [],
    newSnapshots: [],
  };

  private startTime = Date.now();
  private outputDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? './test-results';
  }

  onBegin(_config: unknown, suite: Suite): void {
    const count = suite.allTests().length;
    this.log(`\n🎨 Visual Regression Framework`);
    this.log(`   Running ${count} tests across all projects\n`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const isVisualTest = test.title.includes('@visual') ||
      test.tags.includes('@visual') ||
      test.annotations.some(a => a.type === 'visual');

    // Count all snapshot assertions, not just @visual tagged tests
    const snapshotErrors = result.errors.filter(
      (e) =>
        e.message?.includes('screenshot') ||
        e.message?.includes('snapshot') ||
        e.message?.includes('toHaveScreenshot') ||
        e.message?.includes('toMatchSnapshot')
    );

    const hasSnapshotWork = isVisualTest || snapshotErrors.length > 0;
    if (!hasSnapshotWork && result.status === 'passed') return;

    this.summary.total++;

    switch (result.status) {
      case 'passed':
        this.summary.passed++;
        break;

      case 'failed':
      case 'timedOut':
        this.summary.failed++;
        for (const error of result.errors) {
          const isNewSnapshot =
            error.message?.includes('missing') ||
            error.message?.includes('No existing snapshot');

          if (isNewSnapshot) {
            this.summary.new++;
            this.summary.newSnapshots.push(
              `${test.parent?.title ?? ''} › ${test.title} [${this.getProject(test)}]`
            );
          } else {
            this.summary.failures.push({
              test: test.title,
              project: this.getProject(test),
              snapshot: this.extractSnapshotName(error.message ?? ''),
              error: this.trimError(error.message ?? ''),
            });
          }
        }
        break;

      case 'skipped':
        this.summary.skipped++;
        break;
    }
  }

  onEnd(result: FullResult): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const { passed, failed, newSnapshots, failures, skipped } = this.summary;

    this.log('\n' + '─'.repeat(60));
    this.log('📊 Visual Regression Summary');
    this.log('─'.repeat(60));
    this.log(`  ✅ Passed:   ${passed}`);
    this.log(`  ❌ Failed:   ${failed}`);
    this.log(`  🆕 New:      ${newSnapshots.length}`);
    this.log(`  ⏭  Skipped:  ${skipped}`);
    this.log(`  ⏱  Duration: ${duration}s`);
    this.log('─'.repeat(60));

    if (failures.length > 0) {
      this.log('\n⚠️  Regression failures:');
      for (const f of failures) {
        this.log(`\n  ● ${f.test} [${f.project}]`);
        this.log(`    Snapshot: ${f.snapshot}`);
        this.log(`    ${f.error}`);
      }
    }

    if (newSnapshots.length > 0) {
      this.log('\n🆕 New snapshots (run with --update-snapshots to approve):');
      for (const s of newSnapshots) {
        this.log(`   + ${s}`);
      }
    }

    this.log('');

    // Write markdown summary for PR comments
    this.writePRComment(result.status);
    this.writeJsonSummary();
  }

  private writePRComment(status: FullResult['status']): void {
    const { passed, failed, newSnapshots, failures } = this.summary;
    const icon =
      status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚠️';

    let md = `## ${icon} Visual Regression Results\n\n`;
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| ✅ Passed | ${passed} |\n`;
    md += `| ❌ Failed | ${failed} |\n`;
    md += `| 🆕 New snapshots | ${newSnapshots.length} |\n\n`;

    if (failures.length > 0) {
      md += `### Regressions\n\n`;
      for (const f of failures) {
        md += `- **${f.test}** \`[${f.project}]\`\n`;
        md += `  - Snapshot: \`${f.snapshot}\`\n`;
        md += `  - ${f.error}\n`;
      }
      md += '\n';
    }

    if (newSnapshots.length > 0) {
      md += `### New Snapshots\n\n`;
      md += `These need approval before they become baselines:\n\n`;
      for (const s of newSnapshots) {
        md += `- \`${s}\`\n`;
      }
      md += '\n';
      md += `Run \`npm run test:update\` to approve all new snapshots.\n`;
    }

    const mdPath = path.join(this.outputDir, 'vr-summary.md');
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(mdPath, md);
  }

  private writeJsonSummary(): void {
    const jsonPath = path.join(this.outputDir, 'vr-summary.json');
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(this.summary, null, 2));
  }

  private getProject(test: TestCase): string {
    return test.parent?.project()?.name ?? 'unknown';
  }

  private extractSnapshotName(message: string): string {
    const match = message.match(/["']([^"']+\.png)["']/);
    return match?.[1] ?? 'unknown.png';
  }

  private trimError(message: string): string {
    return message.split('\n').slice(0, 3).join(' ').slice(0, 200);
  }

  private log(msg: string): void {
    process.stdout.write(msg + '\n');
  }
}

export default VisualReporter;