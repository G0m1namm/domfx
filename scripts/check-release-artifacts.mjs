import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const releaseLibraries = {
  'packages/core': '@domfx/core',
  'packages/domfx': '@domfx/browser',
  'packages/gsap': '@domfx/gsap',
};

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function repositoryIdentity(remote) {
  const normalizedRemote = remote.replace(/^([^@/:]+)@([^:]+):/, 'ssh://$1@$2/');
  const url = new URL(normalizedRemote);
  assert.equal(url.password, '', 'source remote must not contain a password');
  assert.equal(url.search, '', 'source remote must not contain query parameters');
  assert.equal(url.hash, '', 'source remote must not contain a fragment');
  const path = url.pathname.replace(/^\/+|\.git$/g, '');
  assert.ok(path, 'source remote must identify a repository');
  return `${url.host}/${path}`;
}

/** A credential-free identity for the checked-out source that produced release evidence. */
export function releaseSourceIdentity(root = '.') {
  return {
    repository: repositoryIdentity(git(root, ['remote', 'get-url', 'origin'])),
    revision: git(root, ['rev-parse', 'HEAD']),
    tree: git(root, ['rev-parse', 'HEAD^{tree}']),
  };
}

export function assertCleanReleaseCheckout(root = '.') {
  assert.equal(git(root, ['status', '--porcelain']), '', 'approved source checkout must be clean');
}

export function assertReleaseVisibility(path, manifest) {
  const name = releaseLibraries[path];
  if (name && manifest.name !== name) {
    throw new Error(`${path}: unexpected release identity`);
  }
  if (manifest.private !== true && (!name || manifest.publishConfig?.access !== 'public')) {
    throw new Error(
      `${path}: publishing is locked; only approved libraries with public access may publish`,
    );
  }
}

const metadataFiles = new Set(['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md']);

export function validateArtifact(manifest, packed) {
  const errors = [];
  const files = new Set(packed.files.map(({ path }) => path));
  if (packed.name !== manifest.name || packed.version !== manifest.version) {
    errors.push('packed name/version differs from the workspace');
  }
  for (const required of ['package.json', 'README.md', 'LICENSE']) {
    if (!files.has(required)) {
      errors.push(`missing ${required}`);
    }
  }
  for (const file of files) {
    if (
      file.split('/').includes('..') ||
      (!metadataFiles.has(file) && !/^dist\/.+\.(js|d\.ts)$/.test(file))
    ) {
      errors.push(`unexpected packed file: ${file}`);
    }
  }
  const exportPaths = (value) =>
    typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(exportPaths);
  const exports = exportPaths(manifest.exports);
  if (exports.length === 0) {
    errors.push('no declared exports');
  }
  for (const path of exports) {
    if (!path.startsWith('./dist/') || !files.has(path.slice(2))) {
      errors.push(`missing or unsupported export: ${path}`);
    }
  }
  return errors;
}

export function checkReleaseArtifacts(root = '.') {
  const manifestAt = (path) => JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'));
  const directories = (parent) =>
    readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`);
  const libraries = directories('packages');
  for (const path of ['.', ...libraries, ...directories('apps'), ...directories('tests')]) {
    assertReleaseVisibility(path, manifestAt(path));
  }
  for (const path of libraries) {
    const manifest = manifestAt(path);
    const packed = JSON.parse(
      execFileSync('pnpm', ['--config.ignore-scripts=true', 'pack', '--dry-run', '--json'], {
        cwd: join(root, path),
        encoding: 'utf8',
        timeout: 20_000,
      }),
    );
    const errors = validateArtifact(manifest, packed);
    if (errors.length) {
      throw new Error(`${manifest.name}: ${errors.join('; ')}`);
    }
    console.log(`${manifest.name}: ${packed.files.length} expected files; all exports present`);
  }
  console.log(
    'Local package inspection passed. Nothing packed or published; consumer/GPU gates remain.',
  );
}

/** Validate transported technical evidence. This does not approve publication metadata. */
export function testedReleaseArtifacts(directory, revision, source, now = Date.now()) {
  const report = JSON.parse(readFileSync(join(directory, 'report.json'), 'utf8'));
  assert.equal(report.outcome, 'PASS', 'release rehearsal must pass');
  assert.equal(report.revision, revision, 'release evidence must match the approved commit');
  assert.deepEqual(report.source, source, 'release evidence source identity differs');
  assert.equal(report.source.revision, report.revision, 'release evidence source revision differs');
  assert.equal(report.dirty, '', 'release evidence requires a clean checkout');
  const age = now - Date.parse(report.finishedAt);
  assert.ok(age >= 0 && age <= 7 * 24 * 60 * 60 * 1000, 'release evidence expired or missing');
  assert.deepEqual(report.consumers.map(({ kind }) => kind).sort(), ['gsap', 'standalone']);
  for (const consumer of report.consumers) {
    assert.equal(consumer.outcome, 'PASS');
    assert.equal(consumer.result.outcome, 'PASS');
    assert.equal(consumer.recipe?.outcome, 'PASS', 'own heading recipe evidence required');
    assert.ok(consumer.environment.gpu.length > 0, 'GPU evidence required');
    assert.deepEqual(consumer.errors, []);
  }
  assert.deepEqual(
    report.artifacts.map(({ manifest }) => manifest.name),
    Object.values(releaseLibraries),
  );
  return report.artifacts.map((artifact) => {
    const { manifest } = artifact;
    const tarball = join(directory, 'artifacts', basename(artifact.tarball));
    const bytes = readFileSync(tarball);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      artifact.sha256,
      'tested tarball hash changed',
    );
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    assert.equal(artifact.integrity, integrity, 'tested tarball integrity changed');
    const packed = JSON.parse(
      execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }),
    );
    assert.deepEqual(packed, manifest, 'evidence manifest differs from tested bytes');
    return {
      tarball,
      name: manifest.name,
      version: manifest.version,
      integrity,
    };
  });
}

/** Add publication policy only at the registry boundary, after technical evidence passes. */
export function publishableTestedReleaseArtifacts(directory, revision, source, now = Date.now()) {
  const artifacts = testedReleaseArtifacts(directory, revision, source, now);
  const report = JSON.parse(readFileSync(join(directory, 'report.json'), 'utf8'));
  for (const artifact of report.artifacts) {
    const { manifest } = artifact;
    assert.notEqual(manifest.private, true, 'approve public library metadata before packing');
    assert.equal(manifest.publishConfig?.access, 'public');
    assert.match(
      manifest.version,
      /^0\.\d+\.\d+-alpha\.\d+$/,
      'only experimental alpha publication',
    );
    if (manifest.name !== '@domfx/core') {
      assert.equal(
        manifest.dependencies?.['@domfx/core'],
        report.artifacts[0].manifest.version,
        'packed core dependency must match tested version',
      );
    }
  }
  return artifacts;
}

export function registryMetadata(spec) {
  try {
    return JSON.parse(
      execFileSync('npm', ['view', spec, '--json', '--registry=https://registry.npmjs.org'], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30_000,
      }),
    );
  } catch (error) {
    // Only an explicit registry E404 means absent. Network/auth errors must stop.
    const response = JSON.parse(String(error.stdout || '{}'));
    if (response.error?.code === 'E404') {
      return undefined;
    }
    throw error;
  }
}

export function publishedArtifactMatches(artifact, metadata) {
  assert.equal(metadata.version, artifact.version, 'registry version mismatch');
  assert.equal(metadata.dist?.integrity, artifact.integrity, 'immutable registry bytes differ');
  assert.equal(
    metadata['dist-tags']?.alpha,
    artifact.version,
    'inspect alpha tag before resuming a partial release',
  );
}

function publishTestedRelease(directory, revision) {
  assertCleanReleaseCheckout();
  const artifacts = publishableTestedReleaseArtifacts(directory, revision, releaseSourceIdentity());
  for (const artifact of artifacts) {
    const spec = `${artifact.name}@${artifact.version}`;
    const existing = registryMetadata(spec);
    if (existing) {
      publishedArtifactMatches(artifact, existing);
      console.log(`${spec}: identical published bytes and alpha tag; retained`);
      continue;
    }
    execFileSync(
      'npm',
      [
        'publish',
        artifact.tarball,
        '--access=public',
        '--tag=alpha',
        '--ignore-scripts',
        '--registry=https://registry.npmjs.org',
      ],
      { stdio: 'inherit', timeout: 120_000 },
    );
    publishedArtifactMatches(artifact, registryMetadata(spec));
    console.log(`${spec}: registry bytes and alpha tag verified`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv[2] === '--handoff') {
    assert.ok(
      process.argv[3] && process.argv[4],
      'provide tested evidence directory and approved revision',
    );
    assertCleanReleaseCheckout();
    console.log(
      JSON.stringify(
        testedReleaseArtifacts(resolve(process.argv[3]), process.argv[4], releaseSourceIdentity()),
        null,
        2,
      ),
    );
  } else if (process.argv[2] === '--publish') {
    assert.ok(
      process.argv[3] && process.argv[4],
      'provide tested evidence directory and approved revision',
    );
    publishTestedRelease(resolve(process.argv[3]), process.argv[4]);
  } else {
    checkReleaseArtifacts();
  }
}
