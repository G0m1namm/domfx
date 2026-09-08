import { boundaries } from './workspace-boundaries.mjs';
import { existsSync, readFileSync } from 'node:fs';

const manifests = Object.fromEntries(Object.keys(boundaries)
  .filter(path => existsSync(`${path}/package.json`))
  .map(path => [path, JSON.parse(readFileSync(`${path}/package.json`, 'utf8'))]));

function declaredTargets(workspace, targets) {
  const manifest = manifests[workspace] ?? {};
  const names = Object.assign({}, ...['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .map(section => manifest[section]));
  return targets.filter(target => Object.hasOwn(names, manifests[target]?.name ?? ''));
}

export default {
  forbidden: [
    ...Object.entries(boundaries).map(([workspace, dependencies]) => ({
      name: `boundary:${workspace}`,
      severity: 'error',
      from: { path: `^${workspace}/` },
      to: {
        path: '^(packages|apps)/',
        pathNot: `^(${[workspace, ...declaredTargets(workspace, dependencies)].join('|')})/`,
      },
    })),
    {
      name: 'use-workspace-exports',
      severity: 'error',
      from: { path: '^((?:packages|apps)/[^/]+)/' },
      to: {
        path: '^(packages|apps)/',
        pathNot: '^$1/',
        dependencyTypes: ['local', 'localmodule'],
      },
    },
    {
      name: 'core-is-independent',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: { pathNot: '^packages/core/src/' },
    },
    {
      name: 'no-undeclared-dependencies',
      severity: 'error',
      from: {},
      // pnpm workspace links are classified as undetermined; the rules above
      // validate their resolved destinations against each consumer's manifest.
      to: {
        dependencyTypes: ['npm-no-pkg', 'npm-unknown', 'unknown', 'undetermined'],
        pathNot: '^(packages|apps)/[^/]+/(?!node_modules/)',
      },
    },
    {
      name: 'no-runtime-dev-dependencies',
      severity: 'error',
      from: { path: '^(packages|apps)/[^/]+/src/' },
      to: { dependencyTypes: ['npm-dev'], preCompilationOnly: false },
    },
    { name: 'no-unresolved-imports', severity: 'error', from: {}, to: { couldNotResolve: true } },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: '(^|/)node_modules/|/dist/' },
    exclude: { path: '(^|/)\\.test-dist/' },
    tsPreCompilationDeps: 'specify',
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
