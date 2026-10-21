import { expect, test } from '@playwright/test';

test('composed docs load their assets and interactive lab independently of marketing', async ({
  page,
  baseURL,
}, testInfo) => {
  const errors: string[] = [];
  const failedAssets: string[] = [];
  const connectedSockets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      response.status() >= 400 &&
      new URL(response.url()).origin === new URL(baseURL ?? '').origin
    ) {
      failedAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload === 'string' && JSON.parse(payload).type === 'connected') {
        connectedSockets.push(new URL(socket.url()).pathname);
      }
    });
  });

  const response = await page.request.get('/', { headers: { Referer: 'null' } });
  expect(response.ok()).toBe(true);
  await page.goto('/docs/api/effects/frost/');
  await page.waitForLoadState('networkidle');
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
  if (testInfo.project.name === 'development') {
    expect(connectedSockets).toContain('/docs/__vite_hmr');
  }
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await lab.getByRole('button', { name: 'Pause effect', exact: true }).click();
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await lab.getByRole('radio', { name: 'SVG', exact: true }).check();
  await expect(lab.locator('svg[data-docs-lab-target]')).toBeVisible();
  await expect(lab.locator('canvas')).toHaveCount(1);

  await page.getByRole('link', { name: 'domfx home', exact: true }).click();
  await expect(page.locator('#hero-title')).toBeVisible();
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close preview' }).click();
  await page.getByRole('link', { name: 'Docs', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Introduction');
  await page.waitForLoadState('networkidle');
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
});
