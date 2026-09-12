import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runVerification, snapshotWorktree } from './agent-harness.mjs';

// Git hooks export repository-local variables; fixtures must discover their own repositories.
for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' })
  .trim()
  .split('\n')) {
  delete process.env[name];
}

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'domfx-harness-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  writeFileSync(join(root, '.gitignore'), '.scratch/\n');
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
  git('add', '.');
  git(
    '-c',
    'user.name=Harness Test',
    '-c',
    'user.email=harness@example.test',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'test: fixture',
  );
  return { root, git };
}

function browserEvidence() {
  return {
    errors: [],
    stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [
      {
        specs: [
          {
            tests: ['development', 'production'].map((projectName) => ({
              projectName,
              expectedStatus: 'passed',
              results: [{ status: 'passed' }],
            })),
          },
        ],
      },
    ],
  };
}

function pass(command, environment) {
  if (command === 'test:browser:built') {
    mkdirSync(environment.DOMFX_BROWSER_OUTPUT_DIR, { recursive: true });
    writeFileSync(
      join(environment.DOMFX_BROWSER_OUTPUT_DIR, 'report.json'),
      JSON.stringify(browserEvidence()),
    );
  }
  return { status: 0 };
}

test('verification records sequential checks for the unchanged source tree', (t) => {
  const { root } = fixture(t);
  const calls = [];
  const { report, reportPath } = runVerification(root, (command, environment) => {
    calls.push(command);
    return pass(command, environment);
  });
  assert.deepEqual(calls, ['check', 'build:demo', 'test:browser:built']);
  assert.equal(report.status, 'passed');
  assert.equal(report.sourceBefore.digest, report.sourceAfter.digest);
  assert.equal(report.browserVerification, 'passed');
  assert.equal(report.designReview, 'not-run');
  assert.deepEqual(JSON.parse(readFileSync(reportPath, 'utf8')), report);
});

for (const [label, result] of [
  ['nonzero exit', { status: 2 }],
  ['signal', { status: null, signal: 'SIGTERM' }],
  ['missing command', { status: null, error: new Error('spawn ENOENT') }],
]) {
  test(`verification fails on ${label} and skips remaining checks`, (t) => {
    const { root } = fixture(t);
    let calls = 0;
    const { report, reportPath } = runVerification(root, () => {
      calls += 1;
      return result;
    });
    assert.equal(calls, 1);
    assert.equal(report.status, 'failed');
    assert.deepEqual(
      report.checks.map((check) => check.status),
      ['failed', 'skipped', 'skipped'],
    );
    assert.equal(JSON.parse(readFileSync(reportPath, 'utf8')).status, 'failed');
  });
}

test('a failed demo build cannot produce a passing report', (t) => {
  const { root } = fixture(t);
  const { report } = runVerification(root, (command) => ({ status: command === 'check' ? 0 : 1 }));
  assert.equal(report.status, 'failed');
  assert.deepEqual(
    report.checks.map((check) => check.status),
    ['passed', 'failed', 'skipped'],
  );
});

test('source changes during verification invalidate successful commands', (t) => {
  const { root } = fixture(t);
  const { report } = runVerification(root, () => {
    writeFileSync(join(root, 'source.ts'), 'export const value = 2;\n');
    return { status: 0 };
  });
  assert.equal(report.status, 'failed');
  assert.match(report.error, /changed during verification/);
});

test('verification stops before a later command can hide a source change', (t) => {
  const { root } = fixture(t);
  const source = join(root, 'source.ts');
  const original = readFileSync(source, 'utf8');
  const calls = [];
  const { report } = runVerification(root, (command) => {
    calls.push(command);
    writeFileSync(source, command === 'check' ? 'export const value = 2;\n' : original);
    return { status: 0 };
  });
  assert.equal(report.status, 'failed');
  assert.deepEqual(calls, ['check']);
  assert.equal(report.checks[1].status, 'skipped');
  assert.match(report.error, /changed during verification/);
});

test('a thrown command error leaves a failed report and skips remaining checks', (t) => {
  const { root } = fixture(t);
  const { report, reportPath } = runVerification(root, () => {
    throw new Error('Command launcher failed');
  });
  assert.equal(report.status, 'failed');
  assert.equal(report.error, 'Command launcher failed');
  assert.deepEqual(
    report.checks.map((check) => check.status),
    ['failed', 'skipped', 'skipped'],
  );
  assert.deepEqual(JSON.parse(readFileSync(reportPath, 'utf8')), report);
});

test('snapshots include untracked edits and deletions, excluding ignored reports', (t) => {
  const { root } = fixture(t);
  const initial = snapshotWorktree(root).digest;
  mkdirSync(join(root, '.scratch'));
  writeFileSync(join(root, '.scratch/report.json'), '{}');
  assert.equal(snapshotWorktree(root).digest, initial);
  writeFileSync(join(root, 'new file.ts'), 'export const value = 1;');
  const added = snapshotWorktree(root).digest;
  assert.notEqual(added, initial);
  writeFileSync(join(root, 'new file.ts'), 'export const value = 2;');
  assert.notEqual(snapshotWorktree(root).digest, added);
  unlinkSync(join(root, 'new file.ts'));
  unlinkSync(join(root, 'source.ts'));
  assert.notEqual(snapshotWorktree(root).digest, initial);
});

test('each run gets a separate report', (t) => {
  const { root } = fixture(t);
  const first = runVerification(root, pass);
  const second = runVerification(root, () => ({ status: 1 }));
  assert.notEqual(first.reportPath, second.reportPath);
  assert.equal(JSON.parse(readFileSync(first.reportPath, 'utf8')).status, 'passed');
  assert.equal(second.report.status, 'failed');
});

test('brief works outside the checkout and unknown commands fail without running checks', () => {
  const script = fileURLToPath(new URL('./agent-harness.mjs', import.meta.url));
  const brief = spawnSync(process.execPath, [script, 'brief'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(brief.status, 0, brief.stderr);
  assert.match(brief.stdout, /packages\/core/);
  assert.match(brief.stdout, /Acceptance/);
  const invalid = spawnSync(process.execPath, [script, 'unknown'], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Usage/);
});

test('CLI invoked through a symlink still runs instead of silently succeeding', (t) => {
  const { root } = fixture(t);
  const alias = join(root, 'harness.mjs');
  symlinkSync(new URL('./agent-harness.mjs', import.meta.url), alias);
  const result = spawnSync(process.execPath, [alias, 'brief'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Repository context/);
});

test('the harness can be imported from Node stdin without running the CLI', () => {
  const url = new URL('./agent-harness.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    cwd: tmpdir(),
    encoding: 'utf8',
    input: `const { snapshotWorktree } = await import(${JSON.stringify(url)}); console.log(typeof snapshotWorktree);`,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'function');
});

for (const failure of ['', 'check', 'build:demo', 'test:browser:built', 'signal']) {
  test(`CLI verification persists real process outcomes: ${failure || 'success'}`, (t) => {
    const { root } = fixture(t);
    mkdirSync(join(root, 'scripts'));
    copyFileSync(
      new URL('./agent-harness.mjs', import.meta.url),
      join(root, 'scripts', 'agent-harness.mjs'),
    );
    copyFileSync(
      new URL('../workspace-boundaries.mjs', import.meta.url),
      join(root, 'workspace-boundaries.mjs'),
    );
    // Exercise the real launcher and report I/O without running checks in this checkout.
    const launcher = join(root, 'test launcher.mjs');
    writeFileSync(
      launcher,
      `import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const command = process.argv[2];
const run = readdirSync('.scratch/agent')[0];
const report = JSON.parse(readFileSync('.scratch/agent/' + run + '/verification.json', 'utf8'));
appendFileSync('.scratch/calls.jsonl', JSON.stringify({
  command, cwd: process.cwd(), status: report.status,
  checkStatus: report.checks.find((check) => check.command === command).status,
}) + '\\n');
if (process.env.DOMFX_TEST_FAIL_COMMAND === 'signal') process.kill(process.pid, 'SIGTERM');
if (command === 'test:browser:built') {
  mkdirSync(process.env.DOMFX_BROWSER_OUTPUT_DIR, { recursive: true });
  writeFileSync(process.env.DOMFX_BROWSER_OUTPUT_DIR + '/report.json', ${JSON.stringify(JSON.stringify(browserEvidence()))});
}
process.exitCode = command === process.env.DOMFX_TEST_FAIL_COMMAND ? 2 : 0;
`,
    );
    const result = spawnSync(
      process.execPath,
      [join(root, 'scripts', 'agent-harness.mjs'), 'verify'],
      {
        cwd: tmpdir(),
        encoding: 'utf8',
        timeout: 10_000,
        env: { ...process.env, npm_execpath: launcher, DOMFX_TEST_FAIL_COMMAND: failure },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, failure ? 1 : 0, result.stderr);
    const calls = readFileSync(join(root, '.scratch', 'calls.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      calls.map((call) => call.command),
      ['check', 'signal'].includes(failure)
        ? ['check']
        : failure === 'build:demo'
          ? ['check', 'build:demo']
          : ['check', 'build:demo', 'test:browser:built'],
    );
    for (const call of calls) {
      assert.equal(call.cwd, root);
      assert.equal(call.status, 'running');
      assert.equal(call.checkStatus, 'running');
    }
    const reports = join(root, '.scratch', 'agent');
    const report = JSON.parse(
      readFileSync(join(reports, readdirSync(reports)[0], 'verification.json'), 'utf8'),
    );
    assert.equal(report.status, failure ? 'failed' : 'passed');
    assert.equal(
      report.browserVerification,
      failure === 'test:browser:built' ? 'failed' : failure ? 'not-run' : 'passed',
    );
    if (failure === 'signal') {
      assert.equal(report.checks[0].signal, 'SIGTERM');
    }
    if (['check', 'build:demo', 'test:browser:built'].includes(failure)) {
      assert.equal(report.checks.find((check) => check.command === failure).exitCode, 2);
    }
  });
}

for (const scenario of [
  'missing',
  'skipped',
  'empty',
  'failed',
  'expected-failure',
  'missing-project',
]) {
  test(`a successful browser command cannot pass with ${scenario} evidence`, (t) => {
    const { root } = fixture(t);
    const { report } = runVerification(root, (command, environment) => {
      if (command === 'test:browser:built' && scenario !== 'missing') {
        pass(command, environment);
        const evidence = browserEvidence();
        if (scenario === 'skipped') {
          evidence.stats.skipped = 1;
        }
        if (scenario === 'empty') {
          evidence.suites = [];
        }
        if (scenario === 'failed') {
          evidence.errors = [{ message: 'Browser setup failed' }];
        }
        if (scenario === 'expected-failure') {
          evidence.suites[0].specs[0].tests[0].expectedStatus = 'failed';
          evidence.suites[0].specs[0].tests[0].results[0].status = 'failed';
        }
        if (scenario === 'missing-project') {
          evidence.suites[0].specs[0].tests.pop();
          evidence.stats.expected = 1;
        }
        writeFileSync(
          join(environment.DOMFX_BROWSER_OUTPUT_DIR, 'report.json'),
          JSON.stringify(evidence),
        );
      }
      return { status: 0 };
    });
    assert.equal(report.status, 'failed');
    assert.equal(report.browserVerification, 'failed');
    assert.equal(report.checks[2].status, 'failed');
  });
}
