import { expect, test } from '@playwright/test';

test('native verification fixture exercises public placement and cleans up', async ({ page }) => {
  await page.goto('/placement-native.html');
  await page.getByRole('button', { name: 'Run placement checks' }).click();
  await expect(page.locator('#status')).toHaveText('passed');
  const result = JSON.parse((await page.locator('#report').textContent()) ?? '{}');
  expect(result).toMatchObject({ outcome: 'passed', errors: [], cleanup: true });
  expect(result.samples.map((sample: { step: string }) => sample.step)).toEqual([
    'initial',
    'nested-scroll',
    'paused-transform',
    'refresh',
    'reattach',
  ]);
  await expect(page.locator('#fixture canvas')).toHaveCount(0);
});
