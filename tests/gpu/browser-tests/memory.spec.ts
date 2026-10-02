import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test('pending initial and replacement budgets include every live target', async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const result = await page.evaluate(async () => {
    window.manual.effect.dispose();
    return window.manual.verifyMemory();
  });
  expect(result.bytes).toBe(0);
  expect(errors).toEqual([]);
  await testInfo.attach('memory.json', {
    body: JSON.stringify({ browser: browser.version(), ...result }),
    contentType: 'application/json',
  });
});
