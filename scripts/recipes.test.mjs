import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { recipeConsumers } from './recipes.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const pages = ['frameworks.mdx', 'es/frameworks.mdx'].map((page) =>
  readFileSync(join(root, 'apps/docs/src/content/docs', page), 'utf8'),
);

test('both Frameworks pages render every tested recipe file', () => {
  for (const { framework, recipe } of recipeConsumers(root)) {
    for (const file of readdirSync(recipe)) {
      for (const page of pages) {
        assert.ok(page.includes(`/recipes/${framework}/${file}?raw'`), `${framework}/${file}`);
      }
    }
  }
});

test('both Frameworks pages state the tested versions', () => {
  for (const { dependencies, devDependencies } of recipeConsumers(root)) {
    const versions = [
      dependencies.react ?? dependencies.vue,
      devDependencies.vite,
      devDependencies.typescript,
    ];
    for (const page of pages) {
      for (const version of versions) {
        assert.ok(page.includes(version), `missing ${version}`);
      }
    }
  }
});
