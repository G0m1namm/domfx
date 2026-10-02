import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'domfx-contracts-'));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const run = (cwd, command, args) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', timeout: 180_000 });

console.log(`Packed contract consumer: ${directory}`);
const artifacts = join(directory, 'artifacts');
mkdirSync(artifacts);
const dependencies = {};
for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
  const cwd = join(root, path);
  const manifest = readJson(join(cwd, 'package.json'));
  run(cwd, 'pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', artifacts]);
  dependencies[manifest.name] =
    `file:${join(artifacts, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`)}`;
}
const consumer = join(directory, 'consumer');
cpSync(join(root, 'scripts/fixtures/packed-contracts'), consumer, { recursive: true });
const { '@domfx/gsap': gsapPackage, ...standaloneDependencies } = dependencies;
writeJson(join(consumer, 'package.json'), {
  name: 'domfx-packed-contracts',
  private: true,
  type: 'module',
  dependencies: standaloneDependencies,
  devDependencies: {
    typescript: readJson(join(root, 'node_modules/typescript/package.json')).version,
  },
});
writeFileSync(
  join(consumer, 'pnpm-workspace.yaml'),
  `overrides:\n  '@domfx/core': ${JSON.stringify(dependencies['@domfx/core'])}\nautoInstallPeers: false\n`,
);
run(consumer, 'pnpm', ['install', '--ignore-scripts']);
for (const name of Object.keys(standaloneDependencies)) {
  const installed = realpathSync(join(consumer, 'node_modules', name));
  assert.ok(installed.startsWith(realpathSync(directory)));
  const manifest = readJson(join(installed, 'package.json'));
  assert.deepEqual(
    Object.keys(manifest.exports).sort(),
    name === '@domfx/core' ? ['.'] : ['.', './experimental'],
  );
  if (name === '@domfx/core') {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.deepEqual(Object.keys(manifest[section] ?? {}), [], `core ${section}`);
    }
  }
}
for (const entry of ['@domfx/core', '@domfx/browser', '@domfx/browser/experimental']) {
  for (const mode of ['absent', 'guarded']) {
    run(consumer, process.execPath, ['imports.mjs', entry, mode]);
  }
}
run(consumer, process.execPath, ['types.mjs']);
// Preserve the standalone checks above before installing the optional animation adapter.
run(consumer, 'pnpm', [
  'add',
  '--ignore-scripts',
  gsapPackage,
  `gsap@${readJson(join(root, 'tests/gpu/node_modules/gsap/package.json')).version}`,
]);
for (const module of ['NodeNext', 'ESNext']) {
  run(consumer, 'pnpm', [
    'exec',
    'tsc',
    '--strict',
    '--noEmit',
    '--skipLibCheck',
    'false',
    '--target',
    'ES2022',
    '--module',
    module,
    '--moduleResolution',
    module === 'NodeNext' ? 'NodeNext' : 'Bundler',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    'semantics.ts',
  ]);
  console.log(`Public type acceptance/rejection: strict ${module}: PASS`);
}
console.log('Packed SSR, declarations and export/dependency boundaries: PASS');
