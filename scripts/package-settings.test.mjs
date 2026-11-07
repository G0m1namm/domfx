import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const publicPackages = readdirSync(join(root, 'packages'))
  .map((directory) => readJson(`packages/${directory}/package.json`))
  .filter((manifest) => !manifest.private);

test('every public package joins the one fixed version group', () => {
  const { fixed } = readJson('.changeset/config.json');
  assert.equal(fixed.length, 1);
  assert.deepEqual(fixed[0].toSorted(), publicPackages.map(({ name }) => name).toSorted());
});

test('every public package has the same version', () => {
  assert.equal(new Set(publicPackages.map(({ version }) => version)).size, 1);
});

test('no public package runs code that consumers need on import', () => {
  for (const { name, sideEffects } of publicPackages) {
    assert.equal(sideEffects, false, name);
  }
});
