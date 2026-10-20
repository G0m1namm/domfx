import { expect, test } from '@playwright/test';

// Real browser/GPU checks of the production gallery's attachment ownership.
test('visibility recovery replaces invalidated captures and preserves preview pause', async ({
  page,
}) => {
  let releaseFonts!: () => void;
  const fontsReady = new Promise<void>((resolve) => {
    releaseFonts = resolve;
  });
  await page.route('**/fonts/*.woff2', async (route) => {
    await fontsReady;
    await route.continue();
  });
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: value ? 'hidden' : 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-search-open]')).toBeVisible();
    await setHidden(true);
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('canvas')).toHaveCount(0);
    await setHidden(false);
    await expect(page.locator('.header-effect-host')).toHaveAttribute('data-status', 'active');
    await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
    await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
    await page.getByRole('button', { name: 'Pause animation' }).click();
    let pausedFrame = await page.locator('.dialog-stage').screenshot();
    // Let the compositor settle before comparing the retained paused frame.
    await expect
      .poll(async () => {
        const next = await page.locator('.dialog-stage').screenshot();
        const unchanged = pausedFrame.equals(next);
        pausedFrame = next;
        return unchanged;
      })
      .toBe(true);
    await setHidden(true);
    await expect(page.locator('canvas')).toHaveCount(0);
    await setHidden(false);
    await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
    await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
    await expect
      .poll(async () => pausedFrame.equals(await page.locator('.dialog-stage').screenshot()))
      .toBe(true);
  } finally {
    releaseFonts();
  }
});

test('marketing controls work after an actual back/forward-cache restore', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.addEventListener('pageshow', (event) => {
      document.documentElement.dataset.testPersisted = String(event.persisted);
    });
  });
  await page.goto('/');
  await expect(page.locator('.header-effect-host')).toHaveAttribute(
    'data-reason',
    'reduced-motion',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-closing-pause]')).toBeEnabled();
  await page.goto('/effects/');
  await page.goBack({ waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-test-persisted', 'true');
  await expect(page.locator('.header-effect-host')).toHaveAttribute(
    'data-reason',
    'reduced-motion',
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('[data-closing-pause]').click();
  await expect(page.locator('.header-effect-host')).toHaveAttribute('data-status', 'active');
  await page.getByRole('button', { name: 'Search effects and documentation', exact: true }).click();
  await expect(page.locator('#site-search')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
});

test('header and closing artwork share timing with a stronger closing effect', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const header = page.locator('.header-effect-host');
  const closing = page.locator('#closing-content');
  await expect(header).toHaveAttribute('data-status', 'active');
  await page.locator('[data-closing-target]').scrollIntoViewIfNeeded();
  await expect(closing.locator('[data-closing-host]')).toHaveAttribute('data-status', 'active');
  const snapshot = () =>
    page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.header-effect-host')!;
      const closing = document.querySelector<HTMLElement>('#closing-content')!;
      return {
        header: [header.dataset.effect, header.dataset.time, header.dataset.intensity],
        closing: [closing.dataset.effect, closing.dataset.time, closing.dataset.intensity],
      };
    });
  let state = await snapshot();
  expect(state.closing.slice(0, 2)).toEqual(state.header.slice(0, 2));
  expect(Number(state.closing[2])).toBeGreaterThanOrEqual(Number(state.header[2]));
  await expect.poll(async () => Number((await snapshot()).closing[2])).toBe(1);
  state = await snapshot();
  expect(Number(state.header[2])).toBeLessThan(1);
  const first = state.header[0];
  await expect.poll(async () => (await snapshot()).header[0], { timeout: 16000 }).not.toBe(first);
  await page.locator('[data-closing-pause]').click();
  await expect(page.locator('[data-closing-pause]')).toHaveAttribute('aria-pressed', 'true');
  state = await snapshot();
  await page.locator('#hero-title').scrollIntoViewIfNeeded();
  await expect(closing.locator('canvas')).toHaveCount(0);
  await page.locator('[data-closing-target]').scrollIntoViewIfNeeded();
  await expect(closing.locator('canvas')).toHaveCount(1);
  expect(await snapshot()).toEqual(state);
  await page.locator('[data-closing-pause]').click();
  await expect(page.locator('[data-closing-pause]')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await snapshot()).header[1]).not.toBe(state.header[1]);
  state = await snapshot();
  expect(state.closing.slice(0, 2)).toEqual(state.header.slice(0, 2));
  expect(Number(state.closing[2])).toBeGreaterThanOrEqual(Number(state.header[2]));
  expect(errors).toEqual([]);
});

test('reduced motion removes output and requires explicit resume after recovery', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.header-effect-host canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-closing-pause]')).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-closing-pause]')).toBeEnabled();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('[data-closing-pause]').click();
  await expect(page.locator('.header-effect-host canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeEnabled();
  for (const hidden of [true, false]) {
    await page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: value ? 'hidden' : 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  }
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume animation' }).click();
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
});

for (const dpr of [1, 2]) {
  test(`preview zoom retains one layer and disposes on close at DPR ${dpr}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, deviceScaleFactor: dpr });
    try {
      const page = await context.newPage();
      await page.goto('/effects/');
      await page.getByRole('button', { name: 'Try Dither', exact: true }).click();
      await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
      for (const name of ['SVG', 'Image', 'Text']) {
        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
        await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
      }
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await expect(page.locator('[data-zoom-label]')).toHaveText('150%');
      await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
      await page.getByRole('button', { name: 'Close preview' }).click();
      await expect(page.locator('.dialog-stage canvas')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Try Dither', exact: true })).toBeFocused();
    } finally {
      await context.close();
    }
  });
}
