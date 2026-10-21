import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  assertCleanReleaseCheckout,
  assertReleaseVisibility,
  publishableTestedReleaseArtifacts,
  publishedArtifactMatches,
  releaseSourceIdentity,
  testedReleaseArtifacts,
  validateArtifact,
} from './check-release-artifacts.mjs';

const gitEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);
for (const key of Object.keys(process.env)) {
  if (key.startsWith('GIT_')) {
    delete process.env[key];
  }
}

const source = {
  repository: 'github.com/example/domfx',
  revision: 'approved',
  tree: 'tree',
};

const manifest = {
  name: '@domfx/core',
  version: '0.0.0',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
};
const artifact = {
  name: manifest.name,
  version: manifest.version,
  files: ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'].map(
    (path) => ({ path }),
  ),
};

test('accepts compiled exports with public package metadata', () => {
  assert.deepEqual(validateArtifact(manifest, artifact), []);
});

for (const path of ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts']) {
  test(`rejects missing ${path}`, () => {
    const packed = { ...artifact, files: artifact.files.filter((file) => file.path !== path) };
    assert.notEqual(validateArtifact(manifest, packed).length, 0);
  });
}

for (const path of [
  'PROJECT_CONTEXT.md',
  'docs/plan.md',
  'src/index.ts',
  '.env',
  'dist/../secret.js',
]) {
  test(`rejects unintended file ${path}`, () => {
    const packed = { ...artifact, files: [...artifact.files, { path }] };
    assert.deepEqual(validateArtifact(manifest, packed), [`unexpected packed file: ${path}`]);
  });
}

test('rejects mismatched package identity', () => {
  assert.notEqual(validateArtifact(manifest, { ...artifact, version: '1.0.0' }).length, 0);
  assert.notEqual(validateArtifact(manifest, { ...artifact, name: 'another' }).length, 0);
});

test('requires exports and rejects paths outside dist', () => {
  assert.deepEqual(validateArtifact({ ...manifest, exports: undefined }, artifact), [
    'no declared exports',
  ]);
  assert.deepEqual(validateArtifact({ ...manifest, exports: './src/index.ts' }, artifact), [
    'missing or unsupported export: ./src/index.ts',
  ]);
});

for (const [path, name] of [
  ['packages/core', '@domfx/core'],
  ['packages/domfx', '@domfx/browser'],
  ['packages/gsap', '@domfx/gsap'],
]) {
  test(`allows explicit public access only for the approved identity at ${path}`, () => {
    assert.doesNotThrow(() =>
      assertReleaseVisibility(path, { name, private: false, publishConfig: { access: 'public' } }),
    );
    assert.throws(
      () =>
        assertReleaseVisibility(path, {
          name: '@other/pkg',
          private: false,
          publishConfig: { access: 'public' },
        }),
      /identity/,
    );
    assert.throws(
      () => assertReleaseVisibility(path, { name, private: false }),
      /publishing is locked/,
    );
  });
}
for (const path of ['.', 'tests/gpu', 'apps/web', 'packages/other']) {
  test(`keeps ${path} private even with public publishConfig`, () => {
    assert.throws(
      () =>
        assertReleaseVisibility(path, {
          name: '@domfx/other',
          private: false,
          publishConfig: { access: 'public' },
        }),
      /publishing is locked/,
    );
  });
}

test('disabled publication workflow has no hosted artifact preparation or registry action', () => {
  const workflow = readFileSync(join(process.cwd(), '.github/workflows/publish.yml'), 'utf8');
  assert.match(workflow, /if: \$\{\{ false \}\}/);
  assert.doesNotMatch(workflow, /release:rehearse|upload-artifact|npm publish/);
});

function releaseEvidence(t, sourceIdentity = source, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-tested-artifact-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'artifacts'));
  mkdirSync(join(directory, 'package'));
  const artifacts = ['core', 'browser', 'gsap'].map((name) => {
    const manifest = {
      name: `@domfx/${name}`,
      version: options.version ?? '0.1.0-alpha.0',
      ...(options.private ? { private: true } : { publishConfig: { access: 'public' } }),
      ...(name === 'core'
        ? {}
        : { dependencies: { '@domfx/core': options.version ?? '0.1.0-alpha.0' } }),
    };
    writeFileSync(join(directory, 'package/package.json'), JSON.stringify(manifest));
    const tarball = join(directory, 'artifacts', `${name}.tgz`);
    execFileSync('tar', ['-czf', tarball, 'package'], { cwd: directory });
    return {
      tarball,
      manifest,
      sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`,
    };
  });
  const report = {
    outcome: 'PASS',
    revision: sourceIdentity.revision,
    source: sourceIdentity,
    dirty: '',
    finishedAt: new Date().toISOString(),
    artifacts,
    consumers: ['standalone', 'gsap'].map((kind) => ({
      kind,
      outcome: 'PASS',
      result: { outcome: 'PASS' },
      recipe: { outcome: 'PASS' },
      errors: [],
      environment: { gpu: [{}] },
    })),
  };
  const save = () => writeFileSync(join(directory, 'report.json'), JSON.stringify(report));
  save();
  return { directory, report, save };
}

function cleanCheckout(t) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-release-checkout-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'tracked.txt'), 'tracked\n');
  const git = (args) => execFileSync('git', args, { cwd: directory, env: gitEnv });
  git(['init', '--initial-branch=main']);
  git(['config', 'user.email', 'release@example.com']);
  git(['config', 'user.name', 'Release test']);
  git(['add', 'tracked.txt']);
  git(['commit', '--quiet', '-m', 'test release checkout']);
  git(['remote', 'add', 'origin', 'https://github.com/example/domfx.git']);
  return directory;
}

test('transports the three tested alpha tarballs without repacking', (t) => {
  const { directory } = releaseEvidence(t);
  const artifacts = testedReleaseArtifacts(directory, 'approved', source);
  assert.deepEqual(
    artifacts.map(({ name }) => name),
    ['@domfx/core', '@domfx/browser', '@domfx/gsap'],
  );
  const artifact = artifacts[0];
  const metadata = {
    version: artifact.version,
    dist: { integrity: artifact.integrity },
    'dist-tags': { alpha: artifact.version },
  };
  assert.doesNotThrow(() => publishedArtifactMatches(artifact, metadata));
  assert.throws(
    () => publishedArtifactMatches(artifact, { ...metadata, dist: { integrity: 'different' } }),
    /bytes differ/,
  );
  assert.throws(
    () => publishedArtifactMatches(artifact, { ...metadata, 'dist-tags': { alpha: 'another' } }),
    /alpha tag/,
  );
});

test('read-only handoff rejects source-mismatched evidence without a registry action', (t) => {
  const { directory } = releaseEvidence(t);
  const checkout = cleanCheckout(t);
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'check-release-artifacts.mjs'), '--handoff', directory, 'approved'],
    { cwd: checkout, encoding: 'utf8', env: gitEnv },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source identity differs/);
});

test('read-only handoff accepts matching private non-alpha evidence without a registry action', (t) => {
  const checkout = cleanCheckout(t);
  const sourceIdentity = releaseSourceIdentity(checkout);
  const { directory } = releaseEvidence(t, sourceIdentity, { private: true, version: '0.0.1' });
  const result = spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, 'check-release-artifacts.mjs'),
      '--handoff',
      directory,
      sourceIdentity.revision,
    ],
    { cwd: checkout, encoding: 'utf8', env: gitEnv },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /npm/);
});

test('read-only handoff requires the receiving checkout to be clean', (t) => {
  const checkout = cleanCheckout(t);
  const sourceIdentity = releaseSourceIdentity(checkout);
  const { directory } = releaseEvidence(t, sourceIdentity);
  writeFileSync(join(checkout, 'untracked.txt'), 'not clean\n');
  assert.throws(() => assertCleanReleaseCheckout(checkout), /checkout must be clean/);
  const result = spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, 'check-release-artifacts.mjs'),
      '--handoff',
      directory,
      sourceIdentity.revision,
    ],
    { cwd: checkout, encoding: 'utf8', env: gitEnv },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checkout must be clean/);
});

test('technical handoff defers private alpha policy to publication', (t) => {
  const { directory } = releaseEvidence(t, source, { private: true, version: '0.0.1' });
  assert.doesNotThrow(() => testedReleaseArtifacts(directory, 'approved', source));
  assert.throws(
    () => publishableTestedReleaseArtifacts(directory, 'approved', source),
    /approve public library metadata/,
  );
});

for (const failure of [
  'revision',
  'dirty',
  'failed',
  'expired',
  'missing-gpu',
  'missing-consumer',
  'private',
  'changed-bytes',
  'missing-tarball',
  'source',
  'changed-integrity',
]) {
  test(`stops publication with ${failure} evidence`, (t) => {
    const { directory, report, save } = releaseEvidence(t);
    if (failure === 'revision') {
      report.revision = 'other';
    }
    if (failure === 'dirty') {
      report.dirty = ' M package.json';
    }
    if (failure === 'failed') {
      report.outcome = 'FAIL';
    }
    if (failure === 'expired') {
      report.finishedAt = '2000-01-01T00:00:00Z';
    }
    if (failure === 'missing-gpu') {
      report.consumers[0].environment.gpu = [];
    }
    if (failure === 'missing-consumer') {
      report.consumers.pop();
    }
    if (failure === 'private') {
      report.artifacts[0].manifest.private = true;
    }
    if (failure === 'changed-bytes') {
      writeFileSync(report.artifacts[0].tarball, 'changed');
    }
    if (failure === 'missing-tarball') {
      rmSync(report.artifacts[0].tarball);
    }
    if (failure === 'source') {
      report.source = { ...source, tree: 'other-tree' };
    }
    if (failure === 'changed-integrity') {
      report.artifacts[0].integrity = 'sha512-different';
    }
    save();
    assert.throws(() => publishableTestedReleaseArtifacts(directory, 'approved', source));
  });
}
