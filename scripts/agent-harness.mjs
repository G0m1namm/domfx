import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boundaries } from '../workspace-boundaries.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export function snapshotWorktree(directory) {
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  const head = git('rev-parse', 'HEAD').trim();
  const files = new Set(
    git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean),
  );
  const hash = createHash('sha256').update(head);
  for (const file of [...files].sort()) {
    const path = join(directory, file);
    try {
      const stat = lstatSync(path);
      const contents = stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path);
      const digest = createHash('sha256').update(contents).digest('hex');
      hash.update(JSON.stringify([file, stat.mode, digest]));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      hash.update(JSON.stringify([file, null]));
    }
  }
  return { head, digest: hash.digest('hex') };
}

function validateBrowserReport(path) {
  const evidence = JSON.parse(readFileSync(path, 'utf8'));
  const testsIn = (suite) => [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests),
    ...(suite.suites ?? []).flatMap(testsIn),
  ];
  const tests = evidence.suites.flatMap(testsIn);
  if (
    evidence.errors.length !== 0 ||
    evidence.stats.expected !== tests.length ||
    evidence.stats.unexpected !== 0 ||
    evidence.stats.flaky !== 0 ||
    evidence.stats.skipped !== 0 ||
    !['development', 'production'].every((name) =>
      tests.some((test) => test.projectName === name),
    ) ||
    !tests.every(
      (test) =>
        test.expectedStatus === 'passed' &&
        test.results.length === 1 &&
        test.results[0].status === 'passed',
    )
  ) {
    throw new Error(
      'Browser evidence must contain passing development and production tests, with no skips, expected failures, retries, or errors.',
    );
  }
}

export function runVerification(directory, run) {
  const reports = join(directory, '.scratch', 'agent');
  mkdirSync(reports, { recursive: true });
  const reportPath = join(mkdtempSync(join(reports, 'run-')), 'verification.json');
  const report = {
    status: 'running',
    startedAt: new Date().toISOString(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    browserVerification: 'not-run',
    browserReport: join(dirname(reportPath), 'browser', 'report.json'),
    designReview: 'not-run',
    checks: ['check', 'build:demo', 'test:browser:built'].map((command) => ({
      command,
      status: 'skipped',
    })),
  };
  const save = () => writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  save();
  try {
    report.sourceBefore = snapshotWorktree(directory);
    for (const check of report.checks) {
      check.status = 'running';
      if (check.command === 'test:browser:built') {
        report.browserVerification = 'running';
      }
      save();
      const start = Date.now();
      const result = run(check.command, {
        DOMFX_BROWSER_OUTPUT_DIR: dirname(report.browserReport),
      });
      check.durationMs = Date.now() - start;
      check.exitCode = result.status ?? null;
      check.signal = result.signal ?? null;
      if (result.error) {
        check.error = result.error.message;
      }
      if (
        check.command === 'test:browser:built' &&
        result.status === 0 &&
        !result.error &&
        !result.signal
      ) {
        validateBrowserReport(report.browserReport);
      }
      check.status = result.status === 0 && !result.error && !result.signal ? 'passed' : 'failed';
      if (check.command === 'test:browser:built') {
        report.browserVerification = check.status;
      }
      report.sourceAfter = snapshotWorktree(directory);
      if (report.sourceBefore.digest !== report.sourceAfter.digest) {
        report.error = `Source changed during verification after ${check.command}. Run again after edits finish.`;
      }
      save();
      if (check.status === 'failed' || report.error) {
        break;
      }
    }
    report.status =
      !report.error && report.checks.every((check) => check.status === 'passed')
        ? 'passed'
        : 'failed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    if (report.browserVerification === 'running') {
      report.browserVerification = 'failed';
    }
    for (const check of report.checks) {
      if (check.status === 'running') {
        check.status = 'failed';
      }
    }
  }
  report.finishedAt = new Date().toISOString();
  save();
  return { report, reportPath };
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !['brief', 'verify'].includes(command)) {
    console.error('Usage: pnpm agent:brief | pnpm agent:verify');
    process.exitCode = 1;
  } else if (command === 'brief') {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    console.log(
      `# Repository context\n\nRuntime: Node ${readFileSync(join(root, '.nvmrc'), 'utf8').trim()}; ${manifest.packageManager}.`,
    );
    console.log('\nRead AGENTS.md, CONTRIBUTING.md, CONTEXT.md, and HARNESS.md.\n');
    for (const [workspace, dependencies] of Object.entries(boundaries)) {
      console.log(`- ${workspace} may depend on: ${dependencies.join(', ') || 'no workspace'}.`);
    }
    console.log('\nBoundary entries permit planned workspaces; they do not create them.\n');
    console.log(readFileSync(join(root, 'engineering', 'task-brief.md'), 'utf8'));
  } else {
    // Reuse pnpm's current launcher, including on systems where pnpm is a command shim.
    const launcher = process.env.npm_execpath;
    const { report, reportPath } = runVerification(root, (script, environment) => {
      console.log(`\nRunning pnpm ${script}`);
      return spawnSync(
        launcher ? process.execPath : 'pnpm',
        launcher ? [launcher, script] : [script],
        {
          cwd: root,
          stdio: 'inherit',
          env: { ...process.env, ...environment },
        },
      );
    });
    console.log(`\nAutomated verification: ${report.status}. Report: ${reportPath}`);
    console.log(
      `Browser/GPU verification: ${report.browserVerification}. Evidence: ${report.browserReport}`,
    );
    console.log('Design review and broader browser/device coverage remain separate.');
    if (report.error) {
      console.error(report.error);
    }
    process.exitCode = report.status === 'passed' ? 0 : 1;
  }
}
