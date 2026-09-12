import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkWorkspaces } from './check-workspaces.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binary = (name) => join(root, 'node_modules', '.bin', name);
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-boundaries-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (path, content) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  const manifests = {
    'packages/core': { name: '@domfx/core' },
    'packages/domfx': { name: '@domfx/browser', dependencies: { '@domfx/core': 'workspace:*' } },
    'apps/lab': { name: '@domfx/lab', dependencies: { '@domfx/browser': 'workspace:*' } },
    'apps/web': { name: '@domfx/web', dependencies: { '@domfx/browser': 'workspace:*' } },
  };
  const manifest = (path, change = {}) =>
    put(
      `${path}/package.json`,
      JSON.stringify({
        type: 'module',
        exports: { '.': './dist/index.js' },
        ...manifests[path],
        ...change,
      }),
    );
  for (const path of Object.keys(manifests)) {
    manifest(path);
    put(`${path}/src/index.ts`, 'export const value = 1;\n');
    put(`${path}/dist/index.js`, 'export const value = 1;\n');
    mkdirSync(join(directory, path, 'node_modules/@domfx'), { recursive: true });
    for (const [target, { name }] of Object.entries(manifests)) {
      symlinkSync(join(directory, target), join(directory, path, 'node_modules', name), 'dir');
    }
  }
  for (const file of [
    'dependency-cruiser.config.mjs',
    'workspace-boundaries.mjs',
    'tsconfig.base.json',
  ]) {
    cpSync(join(root, file), join(directory, file));
  }
  const cruise = () => {
    const result = spawnSync(
      binary('depcruise'),
      ['--config', 'dependency-cruiser.config.mjs', 'packages', 'apps'],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 20_000,
      },
    );
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { directory, put, manifest, cruise };
}

test('Conventional Commits accept valid scopes and reject invalid messages/scopes', () => {
  for (const [message, valid] of [
    ['feat(core): add controls', true],
    ['docs: clarify setup', true],
    ['fix(web)!: change example API', true],
    ['updates', false],
    ['feat(unknown): add controls', false],
  ]) {
    const result = spawnSync(binary('commitlint'), [], {
      cwd: root,
      input: message,
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(result.status === 0, valid, `${message}\n${result.stdout}${result.stderr}`);
  }
});

test('declared package exports are allowed', (t) => {
  const f = fixture(t);
  f.put('apps/lab/src/index.ts', "export { value } from '@domfx/browser';\n");
  f.put('packages/domfx/src/index.ts', "export { value } from '@domfx/core';\n");
  assert.deepEqual(checkWorkspaces(f.directory), []);
  const result = f.cruise();
  assert.equal(result.status, 0, result.output);
});

for (const [name, path, source, expected] of [
  [
    'library-to-app',
    'packages/domfx/src/index.ts',
    "import '../../../apps/lab/src/index.js';",
    'boundary:packages/domfx',
  ],
  ['app-to-app', 'apps/web/src/index.ts', "import '../../lab/src/index.js';", 'boundary:apps/web'],
  [
    'cross-workspace source import',
    'apps/lab/src/index.ts',
    "import '../../../packages/domfx/src/index.js';",
    'use-workspace-exports',
  ],
  [
    'cross-workspace dist import',
    'apps/lab/src/index.ts',
    "import '../../../packages/domfx/dist/index.js';",
    'use-workspace-exports',
  ],
  [
    'core Node dependency',
    'packages/core/src/index.ts',
    "import 'node:fs';",
    'core-is-independent',
  ],
  [
    'type-only boundary bypass',
    'apps/web/src/index.ts',
    "import type { value } from '../../lab/src/index.js';",
    'boundary:apps/web',
  ],
  [
    'dynamic boundary bypass',
    'packages/domfx/src/index.ts',
    "void import('../../../apps/lab/src/index.js');",
    'boundary:packages/domfx',
  ],
]) {
  test(`rejects ${name}`, (t) => {
    const f = fixture(t);
    f.put(path, source);
    const result = f.cruise();
    assert.notEqual(result.status, 0, result.output);
    assert.ok(result.output.includes(expected), result.output);
  });
}

test('rejects forbidden manifest edges, non-workspace versions and undeclared imports', (t) => {
  const f = fixture(t);
  f.manifest('packages/core', { dependencies: { '@domfx/lab': 'workspace:*' } });
  assert.ok(checkWorkspaces(f.directory).some((error) => error.includes('boundary map')));
  f.manifest('packages/core');
  f.manifest('packages/domfx', { dependencies: { '@domfx/core': '*' } });
  assert.ok(checkWorkspaces(f.directory).some((error) => error.includes('workspace:')));
  f.manifest('packages/domfx', { dependencies: {} });
  f.put('packages/domfx/src/index.ts', "import '@domfx/core';\n");
  const result = f.cruise();
  assert.notEqual(result.status, 0, result.output);
  assert.ok(result.output.includes('boundary:packages/domfx'), result.output);
});

for (const declared of [false, true]) {
  test(`rejects ${declared ? 'dev-only' : 'undeclared'} external runtime imports`, (t) => {
    const f = fixture(t);
    if (declared) {
      f.manifest('apps/lab', { devDependencies: { 'tool-only': '1.0.0' } });
    }
    f.put(
      'apps/lab/node_modules/tool-only/package.json',
      JSON.stringify({ name: 'tool-only', main: 'index.js' }),
    );
    f.put('apps/lab/node_modules/tool-only/index.js', 'module.exports = 1;');
    f.put('apps/lab/src/index.ts', "import 'tool-only';\n");
    const result = f.cruise();
    assert.notEqual(result.status, 0, result.output);
    assert.ok(
      result.output.includes(
        declared ? 'no-runtime-dev-dependencies' : 'no-undeclared-dependencies',
      ),
      result.output,
    );
  });
}
