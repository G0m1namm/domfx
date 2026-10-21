import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const testFile = join(import.meta.dirname, 'check-release-artifacts.test.mjs');
const gitEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);

function git(directory, ...args) {
  const result = spawnSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    env: gitEnv,
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `git ${args[0]} failed: ${result.stderr}`);
  return result.stdout;
}

test('release handoff fixtures ignore inherited hook Git environment', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'domfx-release-hook-canary-'));
  const canary = join(parent, 'canary');
  const gitDirectory = join(canary, '.git');
  const index = join(gitDirectory, 'index');
  t.after(() => rmSync(parent, { recursive: true, force: true }));

  const init = spawnSync('git', ['init', '-q', '--initial-branch=main', canary], {
    encoding: 'utf8',
    env: gitEnv,
  });
  assert.ifError(init.error);
  assert.equal(init.status, 0, init.stderr);
  writeFileSync(join(canary, 'canary.txt'), 'canary\n');
  git(canary, 'add', 'canary.txt');
  git(
    canary,
    '-c',
    'user.name=Canary',
    '-c',
    'user.email=canary@example.invalid',
    'commit',
    '-q',
    '-m',
    'canary',
  );

  const snapshot = () => ({
    config: readFileSync(join(gitDirectory, 'config')),
    head: readFileSync(join(gitDirectory, 'HEAD')),
    index: readFileSync(index),
    refs: git(canary, 'show-ref', '--head'),
    files: readdirSync(canary).sort(),
    canaryFile: readFileSync(join(canary, 'canary.txt')),
  });
  const before = snapshot();
  const hostileEnv = {
    ...process.env,
    GIT_DIR: gitDirectory,
    GIT_WORK_TREE: canary,
    GIT_COMMON_DIR: gitDirectory,
    GIT_INDEX_FILE: index,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'user.name',
    GIT_CONFIG_VALUE_0: 'Hook Environment Poison',
  };
  delete hostileEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-name-pattern=read-only handoff', testFile],
    { encoding: 'utf8', env: hostileEnv, timeout: 60_000 },
  );

  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /# tests 3\n/,
    'all three handoff cases must run',
  );
  assert.deepEqual(snapshot(), before, 'fixture Git operations changed the disposable parent');
});
