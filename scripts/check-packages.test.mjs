import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { checkedPackages, checkPackage } from './check-packages.mjs';

const root = resolve(import.meta.dirname, '..');

function failedChecks(manifest, files = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-broken-package-'));
  try {
    mkdirSync(join(directory, 'dist'));
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(directory, path), content);
    }
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'domfx-broken-package',
        version: '0.0.0',
        type: 'module',
        files: ['dist'],
        ...manifest,
      }),
    );
    return checkPackage(directory).map(({ check }) => check);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

test('every public package passes publint and attw', () => {
  for (const packagePath of checkedPackages) {
    assert.deepEqual(checkPackage(join(root, packagePath)), [], packagePath);
  }
});

test('missing entry files fail publint and attw', () => {
  const exports = { '.': { types: './dist/missing.d.ts', import: './dist/missing.js' } };
  assert.deepEqual(failedChecks({ exports }), ['publint', 'attw']);
});

test('a package without declarations fails attw', () => {
  const failed = failedChecks(
    { exports: { '.': { import: './dist/index.js' } } },
    { 'dist/index.js': 'export const value = 1;\n' },
  );
  assert.ok(failed.includes('attw'), failed.join());
});

test('declarations in the wrong module format fail attw', () => {
  const failed = failedChecks(
    { exports: { '.': { types: './dist/index.d.cts', import: './dist/index.js' } } },
    {
      'dist/index.js': 'export const value = 1;\n',
      'dist/index.d.cts': 'export declare const value: number;\n',
    },
  );
  assert.ok(failed.includes('attw'), failed.join());
});
