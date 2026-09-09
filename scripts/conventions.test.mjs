import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function run(binary, args, options = {}) {
  const result = spawnSync(join(root, 'node_modules', '.bin', binary), args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
    ...options,
  });
  assert.ifError(result.error);
  return { ...result, output: result.stdout + result.stderr };
}

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-conventions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of ['.oxfmtrc.json', '.oxlintrc.json']) {
    cpSync(join(root, file), join(directory, file));
  }
  const put = (path, content) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  return { directory, put };
}

test('format check rejects drift without rewriting files; explicit formatting fixes it', (t) => {
  const f = fixture(t);
  const source = 'export const value={name:"domfx"}\n';
  f.put('source.ts', source);
  const check = () => run('oxfmt', ['--check', 'source.ts'], { cwd: f.directory });
  assert.notEqual(check().status, 0);
  assert.equal(readFileSync(join(f.directory, 'source.ts'), 'utf8'), source);
  const fix = run('oxfmt', ['--write', 'source.ts'], { cwd: f.directory });
  assert.equal(fix.status, 0, fix.output);
  assert.equal(check().status, 0);
  assert.equal(
    readFileSync(join(f.directory, 'source.ts'), 'utf8'),
    "export const value = { name: 'domfx' };\n",
  );
});

test('imports follow dependency groups without reordering side-effect imports', () => {
  const source = [
    "import './z.css';",
    "import './a.css';",
    "import { local } from './local.js';",
    "import { core } from '@domfx/core';",
    "import { external } from 'external';",
    "import { join } from 'node:path';",
    'export { local, core, external, join };',
  ].join('\n');
  const formatted = run('oxfmt', ['--stdin-filepath', 'example.ts'], { input: source });
  assert.equal(formatted.status, 0, formatted.output);
  const positions = [
    "'./z.css'",
    "'./a.css'",
    "'node:path'",
    "'external'",
    "'@domfx/core'",
    "'./local.js'",
  ].map((value) => formatted.stdout.indexOf(value));
  assert.ok(
    positions.every(
      (position, index) => position >= 0 && (index === 0 || position > positions[index - 1]),
    ),
    formatted.output,
  );
  const again = run('oxfmt', ['--stdin-filepath', 'example.ts'], { input: formatted.stdout });
  assert.equal(again.stdout, formatted.stdout);
});

for (const [name, source, rule] of [
  ['unused bindings', 'const unused = 1;', 'no-unused-vars'],
  ['loose equality', 'export const same = (a, b) => a == b;', 'eqeqeq'],
  ['var declarations', 'export var value = 1;', 'no-var'],
  ['debugger statements', 'debugger;', 'no-debugger'],
  ['explicit any', 'export const identity = (value: any) => value;', 'no-explicit-any'],
  [
    'ignored type errors',
    '// @ts-ignore: bypass a mismatch\nexport const value = 1;',
    'ban-ts-comment',
  ],
  ['disabled type checking', '// @ts-nocheck\nexport const value = 1;', 'ban-ts-comment'],
  ['unexplained expected errors', '// @ts-expect-error\nexport const value = 1;', 'ban-ts-comment'],
  [
    'type-only imports',
    "import { Value } from './types.js'; export type Result = Value;",
    'consistent-type-imports',
  ],
]) {
  test(`lint rejects ${name}`, (t) => {
    const f = fixture(t);
    f.put('source.ts', source);
    const result = run('oxlint', ['--deny-warnings', 'source.ts'], { cwd: f.directory });
    assert.notEqual(result.status, 0, result.output);
    assert.ok(result.output.includes(rule), result.output);
    assert.equal(readFileSync(join(f.directory, 'source.ts'), 'utf8'), source);
  });
}

test('lint accepts clean typed code', (t) => {
  const f = fixture(t);
  f.put('source.ts', 'export const same = (a: number, b: number): boolean => a === b;\n');
  const result = run('oxlint', ['--deny-warnings', '.'], { cwd: f.directory });
  assert.equal(result.status, 0, result.output);
});

test('lint allows a documented negative type test', (t) => {
  const f = fixture(t);
  f.put(
    'source.ts',
    '// @ts-expect-error: numbers are not valid string inputs\nexport const value: string = 1;\n',
  );
  const result = run('oxlint', ['--deny-warnings', 'source.ts'], { cwd: f.directory });
  assert.equal(result.status, 0, result.output);
});

test('both tools exclude local docs, vendored skills and generated output without gitignore', (t) => {
  const f = fixture(t);
  for (const path of [
    'docs',
    '.scratch',
    '.agents/skills/example',
    'dist-demo',
    'packages/core/dist',
    'apps/lab/.test-dist',
  ]) {
    f.put(`${path}/bad.ts`, 'var unused={bad:"format"}');
  }
  f.put('source.ts', 'export const value = 1;\n');
  for (const [binary, args] of [
    ['oxlint', ['--deny-warnings', '.']],
    ['oxfmt', ['--check', '.']],
  ]) {
    const result = run(binary, args, { cwd: f.directory });
    assert.equal(result.status, 0, result.output);
  }
});
