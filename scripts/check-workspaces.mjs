import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boundaries } from '../workspace-boundaries.mjs';

export function checkWorkspaces(root = '.') {
  const workspaces = ['packages', 'apps'].flatMap((parent) =>
    readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const path = `${parent}/${entry.name}`;
        return {
          path,
          manifest: JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')),
        };
      }),
  );
  const errors = [];
  const byName = new Map(workspaces.map((workspace) => [workspace.manifest.name, workspace.path]));
  for (const { path, manifest } of workspaces) {
    if (!Object.hasOwn(boundaries, path)) {
      errors.push(`${path}: declare the workspace boundary before adding it`);
      continue;
    }
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        const target = byName.get(name);
        if (target && (!boundaries[path].includes(target) || version !== 'workspace:*')) {
          errors.push(`${path}: ${name} must follow the boundary map and use workspace:`);
        }
        if (!target && version.startsWith('workspace:')) {
          errors.push(`${path}: missing workspace ${name}`);
        }
        if (section !== 'devDependencies' && path === 'packages/core') {
          errors.push(`${path}: core must have no runtime dependencies`);
        }
        if (section !== 'devDependencies' && path === 'packages/domfx' && name === 'gsap') {
          errors.push(`${path}: GSAP belongs in the optional adapter, not the browser package`);
        }
      }
    }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const errors = checkWorkspaces();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Workspace manifests respect dependency boundaries.');
  }
}
