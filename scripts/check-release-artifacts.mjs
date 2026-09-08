import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const metadataFiles = new Set(['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md']);

export function validateArtifact(manifest, packed) {
  const errors = [];
  const files = new Set(packed.files.map(({ path }) => path));
  if (packed.name !== manifest.name || packed.version !== manifest.version)
    errors.push('packed name/version differs from the workspace');
  for (const required of ['package.json', 'README.md', 'LICENSE']) {
    if (!files.has(required)) errors.push(`missing ${required}`);
  }
  for (const file of files) {
    if (
      file.split('/').includes('..') ||
      (!metadataFiles.has(file) && !/^dist\/.+\.(js|d\.ts)$/.test(file))
    )
      errors.push(`unexpected packed file: ${file}`);
  }
  const exportPaths = (value) =>
    typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(exportPaths);
  const exports = exportPaths(manifest.exports);
  if (exports.length === 0) errors.push('no declared exports');
  for (const path of exports) {
    if (!path.startsWith('./dist/') || !files.has(path.slice(2)))
      errors.push(`missing or unsupported export: ${path}`);
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
  for (const path of ['.', ...libraries, ...directories('apps')]) {
    if (manifestAt(path).private !== true)
      throw new Error(`${path}: publishing is locked; keep private: true until release approval`);
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
    if (errors.length) throw new Error(`${manifest.name}: ${errors.join('; ')}`);
    console.log(`${manifest.name}: ${packed.files.length} expected files; all exports present`);
  }
  console.log(
    'Local package inspection passed. Nothing packed or published; consumer/GPU gates remain.',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  checkReleaseArtifacts();
}
