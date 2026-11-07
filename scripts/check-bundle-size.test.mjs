import assert from 'node:assert/strict';
import test from 'node:test';

import { budgets, checkBudgets } from './check-bundle-size.mjs';

test('the built packages fit their bundle size budgets', async () => {
  for (const { name, size, budget, ok } of await checkBudgets()) {
    assert.ok(ok, `${name}: ${size.toFixed(1)} KiB gzip exceeds ${budget} KiB`);
  }
});

test('a bundle over its budget fails', async () => {
  const tight = budgets.map((budget) => ({ ...budget, gzipKiB: 0.1 }));
  const results = await checkBudgets(tight);
  assert.deepEqual(
    results.map(({ ok }) => ok),
    [false, false],
  );
});

test('the browser bundle includes its dependencies and leaves out GSAP', async () => {
  const [browser, gsap] = await checkBudgets();
  // TypeGPU and SnapDOM alone are well over 100 KiB gzip; domfx code alone is not.
  assert.ok(browser.size > 100, `${browser.size}`);
  assert.ok(gsap.size < 2, `${gsap.size}`);
});
