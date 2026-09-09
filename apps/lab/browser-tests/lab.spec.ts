import { expect, type Page, test as base } from '@playwright/test';

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page, browser }, use, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error')
          errors.push(`console: ${message.text()} (${message.location().url})`);
      });
      await use(errors);
      await testInfo.attach('browser-errors.json', {
        body: JSON.stringify({ browser: browser.version(), errors }, null, 2),
        contentType: 'application/json',
      });
      const report = await page
        .locator('#report')
        .textContent({ timeout: 2000 })
        .catch(() => 'Lab report unavailable; inspect the trace and browser errors.');
      await testInfo.attach('lab-report.txt', { body: report ?? '', contentType: 'text/plain' });
    },
    { auto: true },
  ],
});

async function terminalReport(page: Page): Promise<unknown> {
  // Both PASS and FAIL are terminal: fail immediately on an explicit lab failure.
  await expect(page.locator('#report')).toContainText('"outcome":', { timeout: 150_000 });
  return JSON.parse(await page.locator('#report').innerText());
}

async function clockTime(page: Page): Promise<number> {
  const clock = await page.locator('#clock').innerText();
  const match = /Manual clock · ([\d.]+)s/.exec(clock);
  expect(match, clock).not.toBeNull();
  return Number(match?.[1]);
}

test('capture, GPU numerics, fire, controls and disposal', async ({
  page,
  browserErrors,
}, testInfo) => {
  await page.goto('/');
  const report = await terminalReport(page);
  expect(report).toMatchObject({
    outcome: 'PASS: capture, GPU signed distances and deterministic GPU fire',
    environment: {
      build: testInfo.project.name === 'development' ? 'Vite development' : 'Vite production',
      devicePixelRatio: 2,
      gpu: expect.any(Object),
    },
    numericalFixtures: {
      ring: { pass: true },
      islands: { pass: true },
      diagonal: { pass: true },
      semitransparent: { pass: true },
      'opaque-exterior': { pass: true },
      empty: { pass: true, reason: 'empty-mask' },
      'full-without-exterior': { pass: true, reason: 'missing-exterior' },
    },
    captures: Object.fromEntries(
      ['rounded', 'vector', 'transparent', 'card', 'guard', 'transformed', 'target'].map((id) => [
        id,
        { numerical: { pass: true }, omittedPaintPixels: 0, capturedBoundaryMaxAlpha: 0 },
      ]),
    ),
    transformCapture: { pass: true },
    fire: { pass: true, zeroIntensityTransparent: true },
    gsap: { pass: true, contextRevertPreservesSibling: true },
    gpuErrors: [],
  });
  const overlay = page.locator('#host canvas.effect');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(overlay).toHaveCSS('pointer-events', 'none');
  await expect(page.getByRole('heading', { name: 'B8O 2026' })).toBeVisible();
  await testInfo.attach('verified-lab.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => clockTime(page)).toBeGreaterThan(1.5);
  await page.getByRole('button', { name: 'Seek 1.5s' }).click();
  await expect.poll(() => clockTime(page)).toBe(1.5);
  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await expect.poll(() => clockTime(page)).toBeGreaterThan(1.5);
  const reverseStart = await clockTime(page);
  await expect.poll(() => clockTime(page)).toBeLessThan(reverseStart);
  await page.getByRole('button', { name: 'Seek 1.5s' }).click();
  await expect.poll(() => clockTime(page)).toBe(1.5);

  const rounded = page.getByRole('button', { name: 'Rounded button' });
  await rounded.click();
  await rounded.press('Enter');
  await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 2');
  await page.getByRole('button', { name: 'Dispose effect' }).click();
  await expect(overlay).toHaveCount(0);
  for (const name of ['Play', 'Seek 1.5s', 'Reverse', 'Dispose effect']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  expect(await terminalReport(page)).toMatchObject({
    disposal: { managedBytes: 0, overlayRemoved: true },
    gpuErrors: [],
  });
  await rounded.click();
  await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 3');
  expect(browserErrors).toEqual([]);
});

test('reduced motion avoids GPU allocation and preserves interaction', async ({
  page,
  browserErrors,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      get() {
        throw new Error('GPU accessed with reduced motion enabled');
      },
    });
  });
  await page.goto('/');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'UNAVAILABLE: reduced-motion before capture/GPU allocation',
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Rounded button' }).click();
  await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 1');
  expect(browserErrors).toEqual([]);
});

test('missing WebGPU is an explicit failure with usable original DOM', async ({
  page,
  browserErrors,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'FAIL',
    error: expect.stringContaining('no-webgpu'),
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Rounded button' }).click();
  await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 1');
  expect(browserErrors).toEqual([expect.stringContaining('no-webgpu')]);
});
