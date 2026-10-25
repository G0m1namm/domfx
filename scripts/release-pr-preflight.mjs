import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkReleaseArtifacts, releaseLibraries } from './check-release-artifacts.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function releasePlan(root, base) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-release-plan-'));
  const output = join(directory, 'plan.json');
  try {
    execFileSync('pnpm', ['exec', 'changeset', 'status', '--since', base, '--output', output], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      stdio: 'pipe',
    });
    return JSON.parse(readFileSync(output, 'utf8'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function changedPublishablePackages(root, base) {
  const changed = git(root, ['diff', '--name-only', base, '--']);
  const packages = new Map(Object.values(releaseLibraries).map((name) => [name, []]));
  for (const path of changed.split('\n').filter(Boolean)) {
    if (path === 'LICENSE') {
      for (const files of packages.values()) {
        files.push(path);
      }
      continue;
    }
    for (const [directory, name] of Object.entries(releaseLibraries)) {
      if (!path.startsWith(`${directory}/`)) {
        continue;
      }
      const relative = path.slice(directory.length + 1);
      if (
        relative.startsWith('tests/') ||
        relative.includes('.test.') ||
        relative.startsWith('playwright.')
      ) {
        continue;
      }
      packages.get(name).push(path);
    }
  }
  return packages;
}

/** Read-only PR release preflight matching CI's base-relative Changesets policy. */
export function releasePlanPreflight(root = '.', base, options = {}) {
  assert.ok(base, 'provide an explicit PR base, for example origin/main');
  const plan = releasePlan(root, base);
  const releases = new Set(
    plan.releases.filter(({ type }) => type !== 'none').map(({ name }) => name),
  );
  const changedPackages = changedPublishablePackages(root, base);
  const omitted = [...changedPackages]
    .filter(([name, files]) => files.length > 0 && !releases.has(name))
    .map(([name, files]) => `${name}: ${files.join(', ')}`);
  assert.equal(
    omitted.length,
    0,
    `release plan omits changed publishable inputs:\n${omitted.join('\n')}`,
  );
  (options.artifactCheck ?? checkReleaseArtifacts)(root);
  return plan;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  assert.equal(process.argv[2], '--base', 'usage: release-pr-preflight.mjs --base <base-ref>');
  assert.ok(process.argv[3], 'usage: release-pr-preflight.mjs --base <base-ref>');
  const plan = releasePlanPreflight('.', process.argv[3]);
  console.log(
    `Release PR preflight passed for ${process.argv[3]}; ${plan.releases.filter(({ type }) => type !== 'none').length} planned package releases.`,
  );
}
