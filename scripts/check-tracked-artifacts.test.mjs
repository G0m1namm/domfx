import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const checker = new URL('./check-tracked-artifacts.mjs', import.meta.url);

test('rejects tracked local artifacts, including force-added files and missing working files', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-artifacts-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: directory, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  const put = (path) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), 'fixture\n');
  };
  const check = () =>
    spawnSync(process.execPath, [checker.pathname], {
      cwd: directory,
      env,
      encoding: 'utf8',
    });
  git('init', '-q');
  writeFileSync(join(directory, '.gitignore'), '.scratch/\nengineering/design-explorations/\n');
  for (const path of [
    'apps/web/src/assets/illustrations/production.png',
    'apps/web/src/pages/docs/api.md',
    'packages/domfx/docs/guide.md',
    'apps/web/browser-tests/visual-baselines/README.md',
  ]) {
    put(path);
    git('add', path);
  }
  put('.scratch/untracked.png');
  assert.equal(check().status, 0);

  for (const path of [
    '.scratch/private notes.md',
    'docs/plan.md',
    'PROJECT_CONTEXT.md',
    '.agents/product-marketing.md',
    'engineering/design-explorations/proposal.html',
    'apps/web/browser-tests/visual-baselines/chromium/native/fire.png',
  ]) {
    put(path);
    git('add', '-f', path);
    rmSync(join(directory, path));
    const result = check();
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(path), result.stderr);
    git('rm', '--cached', '--', path);
    assert.equal(check().status, 0);
  }
});
