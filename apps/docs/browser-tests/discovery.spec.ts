import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

import { effects } from '@domfx/site/effects';

const run = promisify(execFile);
const checker = fileURLToPath(new URL('../../../scripts/check-docs-contract.mjs', import.meta.url));

test('docs publish complete discovery output @smoke', async ({ baseURL }) => {
  if (!baseURL) {
    throw new Error('The docs production test requires a composed preview URL.');
  }
  const { stdout } = await run(process.execPath, [checker, baseURL]);
  expect(stdout).toContain('Docs discovery contract passed');
});

test('discovery includes every catalog effect reference @smoke', async ({ request }) => {
  const response = await request.get('/llms.txt');
  expect(response.ok()).toBe(true);
  const index = await response.text();
  for (const effect of effects) {
    expect(index).toContain(`/docs/api/effects/${effect.id}/)`);
  }
});
