import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateArtifact } from './check-release-artifacts.mjs';

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
