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
import { releasePlanPreflight } from './release-pr-preflight.mjs';

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
    'tests/gpu/package.json',
    'apps/web/package.json',
    'apps/docs/package.json',
    'packages/site/package.json',
    '.changeset/config.json',
  ]) {
    write(path, readFileSync(join(repo, path)));
  }
  // Versioning scenarios start unpublished, independently of the current release candidate.
  for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
    const manifest = readJson(join(root, path, 'package.json'));
    write(`${path}/package.json`, JSON.stringify({ ...manifest, version: '0.0.0', private: true }));
  }
  // Fixtures reuse installed tools; never let pnpm install into the shared node_modules link.
  write(
    'pnpm-workspace.yaml',
    'packages:\n  - packages/*\n  - apps/*\n  - tests/*\nverifyDepsBeforeRun: false\n',
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
  for (const path of ['apps/docs', 'packages/site']) {
    write(`${path}/src/change.ts`, 'export const changed = true;');
  }
  run('git', ['add', '.']);
  run(changeset, ['status', '--since', 'origin/main', '--output', join(root, 'plan.json')]);
  assert.deepEqual(readJson(join(root, 'plan.json')).releases, []);
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
  for (const app of ['@domfx/gpu-tests', '@domfx/web', '@domfx/docs', '@domfx/site']) {
    assert.ok(!plan.releases.some(({ name, type }) => name === app && type !== 'none'));
  }
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
  assert.equal(readJson(join(root, 'tests/gpu/package.json')).version, '0.0.0');
  assert.equal(readJson(join(root, 'apps/web/package.json')).version, '0.0.0');
  assert.equal(readJson(join(root, 'apps/docs/package.json')).version, '0.0.0');
  assert.equal(readJson(join(root, 'packages/site/package.json')).version, '0.0.0');
  assert.equal(readJson(join(root, 'package.json')).version, '0.0.0');
  assert.equal(run('git', ['tag']).trim(), '');
  assert.equal(run('git', ['rev-list', '--count', 'HEAD']).trim(), '1');
});

test('manual alpha release metadata passes ordinary changeset CI without another bump', (t) => {
  const { root, write } = workspace(t);
  const run = (command, args) =>
    execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, LEFTHOOK: '0' },
    });
  const changeset = join(repo, 'node_modules/.bin/changeset');
  run('git', ['init', '-b', 'main']);
  write(
    '.changeset/first-alpha.md',
    '---\n"@domfx/core": minor\n"@domfx/browser": minor\n"@domfx/gsap": minor\n---\n\nFirst experimental alpha.\n',
  );
  run('git', ['add', '.']);
  const commit = () =>
    run('git', [
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=release@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'chore(release): prepare alpha',
    ]);
  commit();
  run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  run(changeset, ['pre', 'enter', 'alpha']);
  run(changeset, ['version']);
  for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
    assert.equal(readJson(join(root, path, 'package.json')).version, '0.1.0-alpha.0');
    assert.match(readFileSync(join(root, path, 'CHANGELOG.md'), 'utf8'), /0\.1\.0-alpha\.0/);
  }
  for (const path of ['packages/domfx', 'packages/gsap']) {
    assert.equal(
      readJson(join(root, path, 'package.json')).dependencies['@domfx/core'],
      'workspace:*',
    );
  }
  // Existing Changesets convention, no generated-PR exemption or custom validator.
  write('.changeset/manual-release-metadata.md', '---\n---\n');
  run('git', ['add', '.']);
  commit();
  run(changeset, ['status', '--since', 'origin/main', '--output', join(root, 'plan.json')]);
  assert.deepEqual(
    readJson(join(root, 'plan.json')).releases.filter(({ type }) => type !== 'none'),
    [],
  );
  assert.equal(readJson(join(root, 'package.json')).private, true);
  assert.equal(readJson(join(root, 'tests/gpu/package.json')).private, true);
  assert.equal(run('git', ['tag']).trim(), '');
});

test('local PR preflight requires an explicit base and matches Changesets release policy', (t) => {
  const { root, write } = workspace(t);
  const run = (command, args) =>
    execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, LEFTHOOK: '0' },
    });
  run('git', ['init', '-b', 'main']);
  write('.changeset/no-release.md', '---\n---\n');
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
  run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  write('apps/docs/src/change.ts', 'export const changed = true;');
  run('git', ['add', 'apps/docs/src/change.ts']);

  assert.throws(() => releasePlanPreflight(root, undefined, { artifactCheck: () => {} }), /base/);
  assert.doesNotThrow(() => releasePlanPreflight(root, 'origin/main', { artifactCheck: () => {} }));
});

test('local PR preflight blocks changed packed contents omitted from the release plan', (t) => {
  const { root, write } = workspace(t);
  const run = (command, args) =>
    execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, LEFTHOOK: '0' },
    });
  run('git', ['init', '-b', 'main']);
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
  run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  write('packages/core/README.md', 'Changed packed documentation.');
  write(
    '.changeset/browser-only.md',
    '---\n"@domfx/browser": patch\n---\n\nBrowser-only consumer change.\n',
  );
  run('git', ['add', '.']);

  assert.throws(
    () => releasePlanPreflight(root, 'origin/main', { artifactCheck: () => {} }),
    /@domfx\/core.*README\.md/,
  );

  write(
    '.changeset/core.md',
    '---\n"@domfx/core": patch\n---\n\nCore documentation is part of the immutable package.\n',
  );
  run('git', ['add', '.changeset/core.md']);
  assert.doesNotThrow(() => releasePlanPreflight(root, 'origin/main', { artifactCheck: () => {} }));
});

test('local PR preflight accepts consumed alpha metadata but rejects unplanned package changes', (t) => {
  const { root, write } = workspace(t);
  const manifestPath = 'packages/core/package.json';
  const manifest = { ...readJson(join(root, manifestPath)), version: '0.1.0-alpha.1' };
  write(manifestPath, JSON.stringify(manifest));
  write('packages/core/CHANGELOG.md', '# @domfx/core\n\n## 0.1.0-alpha.1\n');
  write('.changeset/release-metadata.md', '---\n---\n');
  const run = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, LEFTHOOK: '0' },
    });
  run(['init', '-b', 'main']);
  run(['add', '.']);
  run([
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
  run(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  write('.changeset/next-metadata.md', '---\n---\n');
  write(manifestPath, JSON.stringify({ ...manifest, version: '0.1.0-alpha.2' }));
  write(
    'packages/core/CHANGELOG.md',
    '# @domfx/core\n\n## 0.1.0-alpha.2\n\n### Patch Changes\n\n- Update packaged guides.\n\n## 0.1.0-alpha.1\n',
  );
  run(['add', '.']);
  const preflight = () => releasePlanPreflight(root, 'origin/main', { artifactCheck: () => {} });
  assert.doesNotThrow(preflight);

  write('packages/core/src/change.ts', 'export const changed = true;');
  run(['add', '.']);
  assert.throws(preflight, /@domfx\/core.*src\/change\.ts/);
  run(['rm', '-f', 'packages/core/src/change.ts']);

  write(
    manifestPath,
    JSON.stringify({ ...manifest, version: '0.1.0-alpha.2', description: 'Changed contract' }),
  );
  assert.throws(preflight, /@domfx\/core/);
  write(manifestPath, JSON.stringify({ ...manifest, version: '0.1.0-alpha.0' }));
  assert.throws(preflight, /@domfx\/core/);
  write(manifestPath, JSON.stringify({ ...manifest, version: '0.1.0-alpha.2' }));
  write('packages/core/CHANGELOG.md', '# @domfx/core\n\n## 0.1.0-alpha.1\n');
  assert.throws(preflight, /@domfx\/core/);
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
  'tests/gpu/package.json',
  'apps/web/package.json',
  'apps/docs/package.json',
  'packages/site/package.json',
]) {
  test(`artifact check blocks publication enablement in ${path}`, (t) => {
    const { root, write } = workspace(t);
    const manifest = readJson(join(root, path));
    write(path, JSON.stringify({ ...manifest, private: false, publishConfig: undefined }));
    assert.throws(() => checkReleaseArtifacts(root), /publishing is locked/);
  });
}
