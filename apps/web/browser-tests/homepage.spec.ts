import { expect, test } from '@playwright/test';

test.describe('high-DPR decorative background', () => {
  test.use({ deviceScaleFactor: 2 });

  test('stays within the one-million-pixel budget', async ({ page }) => {
    await page.goto('/');
    await page.locator('.shader-section').scrollIntoViewIfNeeded();
    const canvas = page.locator('.shader-section canvas');
    await expect(canvas).toBeVisible();
    const pixels = await canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        throw new Error('Missing background canvas');
      }
      return element.width * element.height;
    });
    expect(pixels).toBeGreaterThan(0);
    expect(pixels).toBeLessThanOrEqual(1_000_000);
  });
});

for (const [width, height] of [
  [320, 800],
  [360, 800],
  [768, 900],
  [1440, 1000],
  [1440, 600],
  [720, 500],
]) {
  test(`editorial composition reflows at ${width}x${height}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('#hero-title')).toBeVisible();
    await expect(page.locator('.stage .sample')).toHaveCount(3);
    await expect(page.locator('#example-svg path')).not.toHaveCount(0);
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const hero = await page.locator('.home-hero').boundingBox();
    if (width > 600 && height > 760) {
      expect(hero?.y).toBe(44);
      expect(hero?.height).toBe(height - 44);
    }
    const stage = await page.locator('.stage').boundingBox();
    const controls = await page.locator('#playground').boundingBox();
    if (!stage || !controls) {
      throw new Error('Examples and their controls must be visible');
    }
    if (width > 600) {
      expect(controls.x).toBeGreaterThanOrEqual(stage.x + stage.width);
      if (height > 760) {
        expect(stage.y + stage.height).toBeGreaterThan(height - 32);
      }
    } else {
      expect(controls.y).toBeGreaterThanOrEqual(stage.y + stage.height);
    }
    await page.locator('.timeline-player').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-action="play"]')).toBeDisabled();
    await expect(page.locator('#player-seek')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('GSAP player supports seeking, playback, reverse and repetition independently of GPU', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  await page.locator('.timeline-player').scrollIntoViewIfNeeded();
  const seek = page.locator('#player-seek');
  const state = page.locator('[data-player-state]');
  await expect(page.locator('[data-action="play"]')).toBeEnabled();
  await seek.fill('2');
  await expect(state).toHaveText('Paused');
  await expect(page.locator('.player-time output')).toHaveText('2.0 / 4.0s');
  await page.locator('[data-action="reverse"]').click();
  await expect.poll(async () => Number(await seek.inputValue())).toBeLessThan(1.9);
  await page.locator('[data-action="pause"]').click();
  const paused = await seek.inputValue();
  await expect(state).toHaveText('Paused');
  await seek.press('Home');
  await expect(seek).toHaveValue('0');
  await seek.press('ArrowRight');
  await expect(seek).toHaveValue('0.01');
  expect(Number(paused)).toBeLessThan(2);
  await page.locator('.player-options [name="speed"]').selectOption('2');
  await page.locator('.player-options [name="yoyo"]').check();
  await expect(page.locator('.player-options [name="repeat"]')).toBeChecked();
  await seek.fill('3.9');
  await page.locator('[data-action="play"]').click();
  await expect.poll(async () => Number(await seek.inputValue())).toBeLessThan(3.5);
  await page.locator('[data-action="pause"]').click();
  await page.locator('.player-options [name="repeat"]').uncheck();
  await expect(page.locator('.player-options [name="yoyo"]')).not.toBeChecked();
  await seek.fill('4');
  await page.locator('[data-action="play"]').click();
  await expect.poll(async () => Number(await seek.inputValue())).toBeLessThan(1);
  await page.locator('#hero-title').scrollIntoViewIfNeeded();
  await expect(state).toHaveText('Paused');
  await page.locator('.timeline-player').scrollIntoViewIfNeeded();
  await expect(state).toHaveText('Paused');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-action="play"]')).toBeDisabled();
  await expect(page.locator('[data-action="reverse"]')).toBeDisabled();
  await expect(seek).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(state).toHaveText('Paused');
});

test('install clipboard confirms only successful writes and offers a manual fallback', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => sessionStorage.setItem('install-copied', text) },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Copy install command' }).click();
  await expect(page.locator('.copy-status')).toHaveText('Install command copied.');
  expect(await page.evaluate(() => sessionStorage.getItem('install-copied'))).toBe(
    'npm install @domfx/browser',
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Denied');
        },
      },
    }),
  );
  await page.getByRole('button', { name: 'Copy install command' }).click();
  await expect(page.locator('.copy-status')).toContainText('copy it manually');
});

test('Prism folds starts still, pauses offscreen and respects reduced motion and context loss', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.shader-section').scrollIntoViewIfNeeded();
  const button = page.locator('.shader-motion');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  const pixels = await page.locator('.shader-section canvas').evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Missing background canvas');
    }
    return canvas.width * canvas.height;
  });
  expect(pixels).toBeLessThanOrEqual(1_000_000);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.shader-section').scrollIntoViewIfNeeded();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(button).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.shader-section canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(button).toBeDisabled();
  await expect(page.locator('.shader-section canvas')).toBeHidden();
  await expect(page.locator('#features-title')).toBeVisible();
});
