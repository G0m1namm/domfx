import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function openPreview(page: Page, path: string) {
  await page.goto(path);
  const lab = page.locator('[data-docs-lab], [data-docs-gsap-lab]').first();
  await lab.locator('[data-docs-preview]').scrollIntoViewIfNeeded();
  await expect(lab.locator('[data-docs-preview-tools]')).toBeVisible();
  return lab;
}

async function cameraScale(lab: Locator) {
  return lab.locator('[data-docs-preview-camera]').evaluate((camera) => {
    return new DOMMatrix(getComputedStyle(camera).transform).a;
  });
}

for (const locale of ['en', 'es']) {
  const prefix = locale === 'es' ? '/docs/es' : '/docs';
  test(`${locale} preview zoom keeps text, SVG and image attached to their effect`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const lab = await openPreview(page, `${prefix}/api/effects/fire/`);
    for (const subject of ['text', 'svg', 'image']) {
      await lab.locator(`[data-docs-lab-subject][value="${subject}"]`).check();
      const viewport = lab.locator('[data-docs-preview]');
      await viewport.scrollIntoViewIfNeeded();
      await expect(lab).toHaveAttribute('data-status', 'active');
      await expect(lab.locator('canvas')).toHaveCount(1);
      const canvas = await lab.locator('canvas').elementHandle();
      const code = await lab.locator('[data-docs-lab-code]').textContent();
      const original = await lab.locator(`[data-docs-lab-target="${subject}"]`).boundingBox();
      await viewport.hover({ position: { x: 20, y: 20 } });
      await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('200%');
      await expect.poll(() => cameraScale(lab)).toBeCloseTo(2);
      await page.waitForTimeout(400);
      expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
      await expect(lab).toHaveAttribute('data-status', 'active');
      const zoomed = await lab.locator(`[data-docs-lab-target="${subject}"]`).boundingBox();
      expect(zoomed?.width).toBeCloseTo((original?.width ?? 0) * 2, 0);
      const frame = await lab
        .locator('canvas')
        .evaluate((element: HTMLCanvasElement) => element.toDataURL());
      await expect
        .poll(() =>
          lab.locator('canvas').evaluate((element: HTMLCanvasElement) => element.toDataURL()),
        )
        .not.toBe(frame);
      await lab.locator('[data-docs-zoom-in]').hover();
      await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('100%');
      await viewport.focus();
      await viewport.press('+');
      await viewport.press('+');
      await viewport.press('+');
      await viewport.press('+');
      await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('300%');
      await expect(lab.locator('[data-docs-zoom-in]')).toBeDisabled();
      await viewport.press('ArrowRight');
      await viewport.press('ArrowDown');
      await expect(lab.locator('[data-docs-pan-controls]')).toBeVisible();
      await lab.locator('[data-docs-pan="left"]').click();
      await expect(lab.locator('[data-docs-lab-code]')).toHaveText(code ?? '');
      expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
      await lab.locator('[data-docs-zoom-reset]').click();
      await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('100%');
      await expect.poll(() => cameraScale(lab)).toBeCloseTo(1);
    }
    expect(errors).toEqual([]);
  });

  test(`${locale} GSAP native button, timeline and preview zoom work independently`, async ({
    page,
  }) => {
    const lab = await openPreview(page, `${prefix}/gsap/`);
    await expect(lab).toHaveAttribute('data-status', 'active');
    await lab.locator('[data-docs-zoom-in]').click();
    await lab.locator('[data-docs-zoom-in]').click();
    await lab.locator('[data-gsap-target]').click();
    await lab.locator('[data-gsap-target]').press('Enter');
    await expect(lab.locator('[data-gsap-clicks]')).toHaveText('2');
    await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('200%');
    await lab.locator('[data-gsap-position]').fill('1.5');
    await expect(lab.locator('[data-gsap-time-output]')).toHaveText('1.00');
    await expect(lab.locator('canvas')).toHaveCount(1);
    await expect(lab).toHaveAttribute('data-paused', 'true');
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await expect(lab.locator('[data-docs-preview-tools]')).toBeHidden();
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('100%');
    await lab.locator('[data-docs-zoom-in]').click();
    await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('150%');
    await expect(lab.locator('canvas')).toHaveCount(1);
  });
}

test('reduced motion disables hover zoom but preserves manual inspection without WebGPU', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  await lab.locator('[data-docs-preview]').hover();
  await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('100%');
  await lab.locator('[data-docs-zoom-in]').click();
  await expect.poll(() => cameraScale(lab)).toBe(1.5);
  await expect(lab.locator('[data-docs-preview-camera]')).toHaveCSS('transition-duration', '0s');
  await expect(lab.locator('canvas')).toHaveCount(0);
  await lab.locator('[data-docs-zoom-reset]').click();
  await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('100%');
});

test('narrow previews recover after target changes below the fold and reset zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await lab.locator('[data-docs-lab-host]').scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  for (const subject of ['text', 'svg', 'image']) {
    const canvas = await lab.locator('canvas').elementHandle();
    await lab.locator(`[data-docs-lab-subject][value="${subject}"]`).check();
    await lab.locator('[data-docs-lab-host]').scrollIntoViewIfNeeded();
    if (canvas) {
      await expect.poll(() => canvas.evaluate((element) => element.isConnected)).toBe(false);
    }
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab.locator('canvas')).toHaveCount(1);
    await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('100%');
    await lab.locator('[data-docs-zoom-in]').click();
    await expect(lab.locator('[data-docs-zoom-label]')).toHaveText('150%');
  }
  const canvas = await lab.locator('canvas').elementHandle();
  const reach = lab.locator('[data-docs-lab-extent="flameReach"]');
  await reach.scrollIntoViewIfNeeded();
  await reach.fill('27');
  await lab.locator('[data-docs-lab-host]').scrollIntoViewIfNeeded();
  await expect.poll(() => canvas?.evaluate((element) => element.isConnected)).toBe(false);
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('[data-docs-lab-code]')).toContainText('flameReach: 0.27');
});

test('touch zoom supports dragging and Spanish controls reflow at enlarged text sizes', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    const lab = await openPreview(page, '/docs/es/api/effects/fire/');
    await expect(lab).toHaveAttribute('data-status', 'active');
    for (let step = 0; step < 4; step += 1) {
      await lab.locator('[data-docs-zoom-in]').tap();
    }
    const viewport = lab.locator('[data-docs-preview]');
    await viewport.scrollIntoViewIfNeeded();
    const bounds = await viewport.boundingBox();
    const x = (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2;
    const y = (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2;
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 40, y: y + 40 }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(() =>
        lab
          .locator('[data-docs-preview-camera]')
          .evaluate((camera) => new DOMMatrix(getComputedStyle(camera).transform).e),
      )
      .toBeGreaterThan(0);
    await session.detach();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    for (const button of await lab.locator('[data-docs-preview-tools] button:visible').all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    }
  } finally {
    await context.close();
  }
});
