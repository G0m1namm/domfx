import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const pnpmExec = ['--dir', root, 'exec'];

export const checkedPackages = ['packages/core', 'packages/domfx', 'packages/gsap'];

function run(args, cwd = root) {
  const { status, stdout, stderr } = spawnSync('pnpm', args, { cwd, encoding: 'utf8' });
  return { ok: status === 0, output: `${stdout}${stderr}` };
}

// Returns the failed checks. The packages are ESM only, so `attw` skips CommonJS and node10.
export function checkPackage(directory) {
  const failures = [];
  const publint = run([...pnpmExec, 'publint', '--strict', directory]);
  if (!publint.ok) {
    failures.push({ check: 'publint', output: publint.output });
  }

  const destination = mkdtempSync(join(tmpdir(), 'domfx-package-check-'));
  try {
    const pack = run(
      ['--config.ignore-scripts=true', 'pack', '--pack-destination', destination],
      directory,
    );
    if (!pack.ok) {
      return [...failures, { check: 'pack', output: pack.output }];
    }
    const [tarball] = readdirSync(destination);
    const attw = run([
      ...pnpmExec,
      'attw',
      join(destination, tarball),
      '--profile',
      'esm-only',
      '--format',
      'ascii',
    ]);
    // `attw` exits 0 for a package without declarations, but every package here must have them.
    if (!attw.ok || attw.output.includes('does not contain types')) {
      failures.push({ check: 'attw', output: attw.output });
    }
  } finally {
    rmSync(destination, { force: true, recursive: true });
  }
  return failures;
}

function main() {
  let failed = false;
  for (const packagePath of checkedPackages) {
    for (const { check, output } of checkPackage(join(root, packagePath))) {
      failed = true;
      console.error(`${check} failed: ${packagePath}\n${output}`);
    }
  }
  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('publint and attw passed.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
