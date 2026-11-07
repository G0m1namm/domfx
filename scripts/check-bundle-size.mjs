import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');

// Maintainer-approved budgets (#223): gzip size of a minified production consumer bundle,
// dependencies included. GSAP is a peer of `@domfx/gsap`, so it stays out of that bundle.
export const budgets = [
  {
    name: '@domfx/browser',
    entry: "import { attachFire } from '@domfx/browser'; console.log(attachFire);",
    gzipKiB: 190,
  },
  {
    name: '@domfx/gsap',
    entry: "import { bindEffect } from '@domfx/gsap'; console.log(bindEffect);",
    gzipKiB: 2,
  },
];

export async function gzipSize(entry) {
  const result = await build({
    stdin: { contents: entry, resolveDir: root, loader: 'js' },
    alias: {
      '@domfx/browser': join(root, 'packages/domfx/dist/index.js'),
      '@domfx/gsap': join(root, 'packages/gsap/dist/index.js'),
    },
    nodePaths: [
      join(root, 'packages/domfx/node_modules'),
      join(root, 'packages/gsap/node_modules'),
    ],
    external: ['gsap'],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  });
  return gzipSync(result.outputFiles[0].contents, { level: 9 }).length / 1024;
}

export async function checkBudgets(entries = budgets) {
  const results = [];
  for (const { name, entry, gzipKiB } of entries) {
    const size = await gzipSize(entry);
    results.push({ name, size, budget: gzipKiB, ok: size <= gzipKiB });
  }
  return results;
}

async function main() {
  let failed = false;
  for (const { name, size, budget, ok } of await checkBudgets()) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${size.toFixed(1)} KiB gzip (budget ${budget})`);
    failed ||= !ok;
  }
  if (failed) {
    console.error('Bundle size budget exceeded. Raising a budget needs maintainer approval.');
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
