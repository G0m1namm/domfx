import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const ignoredPaths = [
  '.env',
  '.env.local',
  '.env.production',
  'apps/web/.env.test.local',
  'packages/domfx/.env.local',
  '.claude/settings.local.json',
  'docs/guide.md',
  'PROJECT_CONTEXT.md',
  'lefthook-local.yml',
  '.scratch/notes.txt',
  'node_modules/example/index.js',
  'packages/core/dist/index.js',
  'dist-demo/index.html',
  '.pnpm-store/v3/files',
  'engineering/design-explorations/layout-explorations.fig',
  '.agents/product-marketing.md',
  'apps/web/browser-tests/visual-baselines/chromium/native/fire.png',
];

const trackablePaths = [
  '.env.example',
  '.env.local.example',
  '.env.production.template',
  'apps/web/.env.local.example',
  'packages/domfx/docs/guide.md',
  'apps/web/src/pages/docs/api.md',
  'scripts/fixtures/packed-contracts/semantics.ts',
  'apps/web/public/fonts/GeneralSans-LICENSE.txt',
  'packages/domfx/src/index.ts',
];

test('repository ignore policy applies in an isolated Git working tree', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'domfx-gitignore-'));
  const repo = join(parent, 'repo');
  const canaryGitDir = join(parent, 'canary.git');
  const canaryIndex = join(parent, 'canary.index');
  const emptyConfig = join(parent, 'empty.gitconfig');
  const emptyTemplate = join(parent, 'empty-template');

  t.after(() => rmSync(parent, { recursive: true, force: true }));
  mkdirSync(repo);
  mkdirSync(emptyTemplate);
  writeFileSync(emptyConfig, '');

  const hostileEnv = {
    ...process.env,
    GIT_DIR: canaryGitDir,
    GIT_WORK_TREE: parent,
    GIT_INDEX_FILE: canaryIndex,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.repositoryformatversion',
    GIT_CONFIG_VALUE_0: '99',
  };
  const gitEnv = Object.fromEntries(
    Object.entries(hostileEnv).filter(([key]) => !key.startsWith('GIT_')),
  );
  gitEnv.GIT_CONFIG_GLOBAL = emptyConfig;
  gitEnv.GIT_CONFIG_SYSTEM = emptyConfig;

  const git = (...args) => {
    const result = spawnSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      env: gitEnv,
      timeout: 10_000,
    });
    assert.ifError(result.error);
    return result;
  };
  const expectGit = (...args) => {
    const result = git(...args);
    assert.equal(result.status, 0, `git ${args[0]} failed: ${result.stderr}`);
    return result.stdout;
  };
  const putFile = (path) => {
    const fullPath = join(repo, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, 'fixture\n');
  };
  const isIgnored = (path) => {
    const result = git('-c', 'core.excludesFile=', 'check-ignore', '--no-index', path);
    assert.ok(
      result.status === 0 || result.status === 1,
      `git check-ignore failed for ${path}: ${result.stderr}`,
    );
    return result.status === 0;
  };

  expectGit('init', '-q', `--template=${emptyTemplate}`);
  writeFileSync(join(repo, '.gitignore'), readFileSync(join(root, '.gitignore')));

  for (const path of ignoredPaths) {
    assert.equal(isIgnored(path), true, `expected ${path} to be ignored`);
  }
  for (const path of trackablePaths) {
    assert.equal(isIgnored(path), false, `expected ${path} to be trackable`);
  }

  const ignoredFile = 'apps/web/browser-tests/visual-baselines/chromium/native/fire.png';
  const trackableFile = 'apps/web/public/fonts/GeneralSans-LICENSE.txt';
  putFile(ignoredFile);
  putFile(trackableFile);

  const status = expectGit('-c', 'core.excludesFile=', 'status', '--porcelain', '-uall');
  assert.match(status, /\?\? apps\/web\/public\/fonts\/GeneralSans-LICENSE\.txt\n/);
  assert.doesNotMatch(status, /visual-baselines/);

  expectGit('add', trackableFile);
  expectGit('add', '-f', ignoredFile);
  const tracked = expectGit('ls-files', '--', ignoredFile, trackableFile).trim().split('\n');
  assert.deepEqual(tracked, [ignoredFile, trackableFile]);
  assert.equal(isIgnored(ignoredFile), true, 'tracked baseline still matches the ignore rule');

  assert.equal(existsSync(canaryGitDir), false, 'Git must not initialize the canary repository');
  assert.equal(existsSync(canaryIndex), false, 'Git must not write the canary index');
});
