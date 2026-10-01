import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

// Git hooks export repository-local variables; fixtures must discover their own repositories.
for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' })
  .trim()
  .split('\n')) {
  delete process.env[name];
}

const script = new URL('./browser-ci-scope.mjs', import.meta.url);
function scope(environment, cwd) {
  return spawnSync(process.execPath, [script.pathname], {
    cwd,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
  });
}
for (const [event, full, expected] of [
  ['push', '', false],
  ['schedule', '', true],
  ['workflow_dispatch', 'true', true],
  ['workflow_dispatch', 'false', false],
]) {
  test(`${event} with full=${full} selects the expected suite`, () => {
    const result = scope({ EVENT: event, FULL: full });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), `full=${expected}`);
  });
}
for (const [file, expected] of [
  ['README.md', false],
  ['apps/web/src/pages/index.astro', false],
  ['packages/core/src/index.ts', true],
  ['apps/lab/browser-tests/manual.spec.ts', true],
  ['pnpm-lock.yaml', true],
  ['.github/actions/setup/action.yml', true],
]) {
  test(`pull request touching ${file} selects full=${expected}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'domfx-ci-scope-'));
    const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
    try {
      git('init', '--quiet');
      git('config', 'user.name', 'Fixture');
      git('config', 'user.email', 'fixture@example.invalid');
      writeFileSync(join(directory, 'initial.txt'), 'initial');
      git('add', '.');
      git('commit', '--quiet', '-m', 'initial');
      const base = git('rev-parse', 'HEAD').trim();
      mkdirSync(dirname(join(directory, file)), { recursive: true });
      writeFileSync(join(directory, file), 'changed');
      git('add', '.');
      git('commit', '--quiet', '-m', 'changed');
      const head = git('rev-parse', 'HEAD').trim();
      const result = scope(
        { EVENT: 'pull_request', FULL: '', BASE_SHA: base, HEAD_SHA: head },
        directory,
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), `full=${expected}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
test('missing pull request revisions fail instead of silently reducing coverage', () => {
  const result = scope({ EVENT: 'pull_request', FULL: '', BASE_SHA: '', HEAD_SHA: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires both commit revisions/);
});
