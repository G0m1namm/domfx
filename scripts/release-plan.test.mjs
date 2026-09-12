import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkReleaseArtifacts } from './check-release-artifacts.mjs';

// Git hooks export repository-local variables; fixtures must discover their own repositories.
for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' })
  .trim()
  .split('\n')) {
  delete process.env[name];
}

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), 'domfx-release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  for (const path of [
    'package.json',
    'packages/core/package.json',
    'packages/domfx/package.json',
    'packages/gsap/package.json',
    'apps/lab/package.json',
    '.changeset/config.json',
  ]) {
    write(path, readFileSync(join(repo, path)));
  }
  // Fixtures reuse installed tools; never let pnpm install into the shared node_modules link.
  write(
    'pnpm-workspace.yaml',
    'packages:\n  - packages/*\n  - apps/*\nverifyDepsBeforeRun: false\n',
  );
  write('.gitignore', 'node_modules\n');
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  for (const path of ['packages/domfx', 'packages/gsap']) {
    mkdirSync(join(root, path, 'node_modules/@domfx'), { recursive: true });
    symlinkSync(join(root, 'packages/core'), join(root, path, 'node_modules/@domfx/core'), 'dir');
  }
  return { root, write };
}

test('Changesets checks detached PRs and rehearses private library versions without tags', (t) => {
  const { root, write } = workspace(t);
  const run = (command, args) =>
    execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, LEFTHOOK: '0' },
    });
  run('git', ['init', '-b', 'main']);
  write('.changeset/old-tooling.md', '---\n---\n');
  run('git', ['add', '.']);
  run('git', [
    '-c',
    'user.name=Release Test',
    '-c',
    'user.email=release@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'test: fixture',
  ]);
  // PR checkouts have origin/main but no local main branch.
  run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  run('git', ['checkout', '--detach']);
  run('git', ['branch', '-D', 'main']);
  const changeset = join(repo, 'node_modules/.bin/changeset');
  write('packages/core/src/change.ts', 'export const changed = true;');
  run('git', ['add', 'packages/core/src/change.ts']);
  assert.throws(
    () => run(changeset, ['status', '--since', 'origin/main']),
    (error) => /no changesets were found/.test(error.stdout),
  );
  write(
    '.changeset/core-fix.md',
    '---\n"@domfx/core": patch\n---\n\nFix a consumer-facing contract.\n',
  );
  run('git', ['add', '.changeset/core-fix.md']);
  run(changeset, ['status', '--since', 'origin/main', '--output', join(root, 'plan.json')]);
  const plan = readJson(join(root, 'plan.json'));
  assert.deepEqual(
    plan.releases
      .filter(({ type }) => type !== 'none')
      .map(({ name, newVersion }) => [name, newVersion])
      .sort(),
    [
      ['@domfx/browser', '0.0.1'],
      ['@domfx/core', '0.0.1'],
      ['@domfx/gsap', '0.0.1'],
    ],
  );
  assert.equal(plan.releases.find(({ name }) => name === '@domfx/lab')?.type, 'none');
  try {
    run(changeset, ['version']);
  } catch (error) {
    throw new Error(`${error.stdout}\n${error.stderr}`, { cause: error });
  }
  for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
    const manifest = readJson(join(root, path, 'package.json'));
    assert.equal(manifest.version, '0.0.1');
    assert.equal(manifest.private, true);
    assert.match(readFileSync(join(root, path, 'CHANGELOG.md'), 'utf8'), /0\.0\.1/);
  }
  assert.equal(readJson(join(root, 'apps/lab/package.json')).version, '0.0.0');
  assert.equal(readJson(join(root, 'package.json')).version, '0.0.0');
  assert.equal(run('git', ['tag']).trim(), '');
  assert.equal(run('git', ['rev-list', '--count', 'HEAD']).trim(), '1');
});

test('artifact inspection skips lifecycle scripts and creates no tarballs', (t) => {
  const { root, write } = workspace(t);
  write('LICENSE', 'Fixture license');
  for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
    const manifest = readJson(join(root, path, 'package.json'));
    manifest.scripts = {
      prepack: 'node -e "process.exit(99)"',
      prepare: 'node -e "process.exit(99)"',
      postpack: 'node -e "process.exit(99)"',
    };
    write(`${path}/package.json`, JSON.stringify(manifest));
    write(`${path}/README.md`, 'Fixture package');
    for (const entry of Object.values(manifest.exports)) {
      for (const target of Object.values(entry)) {
        write(`${path}/${target}`, 'export {};');
      }
    }
  }
  checkReleaseArtifacts(root);
  assert.equal(
    readdirSync(root, { recursive: true }).some((path) => path.endsWith('.tgz')),
    false,
  );
});

for (const path of [
  'package.json',
  'packages/core/package.json',
  'packages/domfx/package.json',
  'packages/gsap/package.json',
  'apps/lab/package.json',
]) {
  test(`artifact check blocks publication enablement in ${path}`, (t) => {
    const { root, write } = workspace(t);
    const manifest = readJson(join(root, path));
    write(path, JSON.stringify({ ...manifest, private: false }));
    assert.throws(() => checkReleaseArtifacts(root), /publishing is locked/);
  });
}
