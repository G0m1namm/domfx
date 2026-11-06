import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function openPreview(page: Page, path: string) {
  await page.goto(path);
  const lab = page.locator('[data-docs-lab], [data-docs-gsap-lab]').first();
  await lab.locator('[data-docs-preview]').scrollIntoViewIfNeeded();
  await expect(lab.locator('[data-zoom-tools]')).toBeVisible();
  return lab;
}

async function cameraScale(lab: Locator) {
  return lab.locator('[data-docs-preview-camera]').evaluate((camera) => {
    return new DOMMatrix(getComputedStyle(camera).transform).a;
  });
}

test('zoomed Fire stays solid up to the sharp text edge', async ({ page }) => {
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  await lab.locator('[data-box-tab="shape"]').click();
  await lab.locator('[data-box-radio="target"][value="text"]').check();
  await expect(lab).toHaveAttribute('data-status', 'active');
  const viewport = lab.locator('[data-docs-preview]');
  await viewport.focus();
  for (let press = 0; press < 4; press++) {
    await viewport.press('+');
  }
  await expect(lab.locator('[data-zoom-label]')).toHaveText('300%');
  await expect.poll(() => cameraScale(lab)).toBeCloseTo(3);
  await lab.locator('[data-box-pause]').click();
  await page.addStyleTag({
    content: '[data-docs-lab] .zoom-chip, [data-docs-lab] .control-box { visibility: hidden; }',
  });
  await page.waitForTimeout(300);
  // Every Fire color has full red, so red over a red-free stage reads the flame's opacity.
  await viewport.evaluate((stage) => stage.style.setProperty('background', '#00ff00', 'important'));
  const flames = (await viewport.screenshot()).toString('base64');
  await lab.locator('canvas').evaluate((canvas) => {
    canvas.style.opacity = '0';
  });
  const text = (await viewport.screenshot()).toString('base64');
  const [top, underside] = await page.evaluate(
    async ([flames, text]) => {
      const read = async (data: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const [fire, glyphs] = await Promise.all([read(flames), read(text)]);
      const red = (frame: ImageData, x: number, y: number) =>
        frame.data[(y * frame.width + x) * 4] ?? 0;
      const isGlyph = (x: number, y: number) => red(glyphs, x, y) > 200;
      // Mean opacity of the first clear pixel beyond each flat edge facing `dy`.
      const edgeOpacity = (dy: number) => {
        let sum = 0;
        let count = 0;
        for (let y = 4; y < fire.height - 4; y++) {
          for (let x = 3; x < fire.width - 3; x++) {
            const flat = [-3, 0, 3].every((dx) => isGlyph(x + dx, y) && !isGlyph(x + dx, y + dy));
            if (flat && !isGlyph(x, y + dy * 2) && !isGlyph(x, y + dy * 3)) {
              sum += red(fire, x, y + dy * 2) / 255;
              count++;
            }
          }
        }
        return count ? sum / count : 0;
      };
      return [edgeOpacity(-1), edgeOpacity(1)];
    },
    [flames, text],
  );
  // Flames rise from top edges, so they must meet the text; undersides stay quiet.
  expect(top).toBeGreaterThan(0.4);
  expect(underside).toBeLessThan(0.2);
});

test('zoomed Electricity stays solid up to the sharp text edge on every side', async ({ page }) => {
  const lab = await openPreview(page, '/docs/api/effects/electricity/');
  await lab.locator('[data-box-tab="shape"]').click();
  await lab.locator('[data-box-radio="target"][value="text"]').check();
  await expect(lab).toHaveAttribute('data-status', 'active');
  const viewport = lab.locator('[data-docs-preview]');
  await viewport.focus();
  for (let press = 0; press < 4; press++) {
    await viewport.press('+');
  }
  await expect.poll(() => cameraScale(lab)).toBeCloseTo(3);
  await lab.locator('[data-box-pause]').click();
  await page.addStyleTag({
    content: '[data-docs-lab] .zoom-chip, [data-docs-lab] .control-box { visibility: hidden; }',
  });
  await page.waitForTimeout(300);
  const shot = async (background: string) => {
    await viewport.evaluate(
      (stage, color) => stage.style.setProperty('background', color, 'important'),
      background,
    );
    return (await viewport.screenshot()).toString('base64');
  };
  // The same pixel over white and black gives the arc's opacity, whatever its color.
  const white = await shot('#fff');
  const black = await shot('#000');
  await lab.locator('canvas').evaluate((canvas) => {
    canvas.style.opacity = '0';
  });
  const text = await shot('#000');
  const opacity = await page.evaluate(
    async ([white, black, text]) => {
      const read = async (data: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const [overWhite, overBlack, glyphs] = await Promise.all([
        read(white),
        read(black),
        read(text),
      ]);
      const green = (frame: ImageData, x: number, y: number) =>
        frame.data[(y * frame.width + x) * 4 + 1] ?? 0;
      const isGlyph = (x: number, y: number) => green(glyphs, x, y) > 128;
      return [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].map(([dx = 0, dy = 0]) => {
        let sum = 0;
        let count = 0;
        for (let y = 6; y < overWhite.height - 6; y++) {
          for (let x = 6; x < overWhite.width - 6; x++) {
            if (
              isGlyph(x, y) &&
              !isGlyph(x + dx, y + dy) &&
              !isGlyph(x + dx * 2, y + dy * 2) &&
              !isGlyph(x + dx * 3, y + dy * 3)
            ) {
              const [nearX, nearY] = [x + dx * 2, y + dy * 2];
              sum += 1 - (green(overWhite, nearX, nearY) - green(overBlack, nearX, nearY)) / 255;
              count++;
            }
          }
        }
        return count ? sum / count : 0;
      });
    },
    [white, black, text],
  );
  expect(Math.min(...opacity)).toBeGreaterThan(0.35);
});

for (const locale of ['en', 'es']) {
  const prefix = locale === 'es' ? '/docs/es' : '/docs';
  test(`${locale} preview zoom keeps text, SVG and image attached to their effect`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const lab = await openPreview(page, `${prefix}/api/effects/fire/`);
    await lab.locator('[data-box-tab="shape"]').click();
    for (const subject of ['text', 'svg', 'image']) {
      await lab.locator(`[data-box-radio="target"][value="${subject}"]`).check();
      const viewport = lab.locator('[data-docs-preview]');
      await viewport.scrollIntoViewIfNeeded();
      await expect(viewport).toHaveCSS('overflow', 'hidden');
      await expect(lab).toHaveAttribute('data-status', 'active');
      await expect(lab.locator('canvas')).toHaveCount(1);
      const canvas = await lab.locator('canvas').elementHandle();
      const code = await lab.locator('[data-box-code]').textContent();
      const original = await lab.locator(`[data-docs-lab-target="${subject}"]`).boundingBox();
      await viewport.hover({ position: { x: 20, y: 20 } });
      await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
      await expect(viewport).toHaveCSS('overflow', 'hidden');
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
      await lab.locator('[data-zoom-in]').hover();
      await expect.poll(() => cameraScale(lab)).toBeCloseTo(1);
      await expect(viewport).toHaveCSS('overflow', 'hidden');
      await viewport.focus();
      await viewport.press('+');
      await viewport.press('+');
      await viewport.press('+');
      await viewport.press('+');
      await expect(lab.locator('[data-zoom-label]')).toHaveText('300%');
      await expect(lab.locator('[data-zoom-in]')).toBeDisabled();
      await viewport.press('ArrowRight');
      await viewport.press('ArrowDown');
      await expect(lab.locator('[data-pan-controls]')).toBeVisible();
      await lab.locator('[data-pan="left"]').click();
      await expect(lab.locator('[data-box-code]')).toHaveText(code ?? '');
      expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
      await lab.locator('[data-zoom-reset]').click();
      await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
      await expect.poll(() => cameraScale(lab)).toBeCloseTo(1);
      await expect(viewport).toHaveCSS('overflow', 'hidden');
    }
    expect(errors).toEqual([]);
  });

  test(`${locale} GSAP timeline and preview zoom work independently`, async ({ page }) => {
    const lab = await openPreview(page, `${prefix}/gsap/`);
    await expect(lab).toHaveAttribute('data-status', 'active');
    await lab.locator('[data-zoom-in]').click();
    await lab.locator('[data-zoom-in]').click();
    await expect(lab.locator('[data-zoom-label]')).toHaveText('200%');
    await lab.locator('[data-gsap-position]').fill('1.5');
    await expect(lab.locator('[data-gsap-time-output]')).toHaveText('1.50');
    await expect(lab.locator('canvas')).toHaveCount(5);
    await expect(lab).toHaveAttribute('data-paused', 'true');
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await expect(lab.locator('[data-zoom-tools]')).toBeHidden();
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
    await lab.locator('[data-zoom-in]').click();
    await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
    await expect(lab.locator('canvas')).toHaveCount(5);
  });
}

test('reduced motion disables hover zoom but preserves manual inspection without WebGPU', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  await lab.locator('[data-docs-preview]').hover();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
  await lab.locator('[data-zoom-in]').click();
  await expect.poll(() => cameraScale(lab)).toBe(1.5);
  await expect(lab.locator('[data-docs-preview-camera]')).toHaveCSS('transition-duration', '0s');
  await expect(lab.locator('canvas')).toHaveCount(0);
  await lab.locator('[data-zoom-reset]').click();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
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
  await lab.locator('[data-box-tab="shape"]').click();
  for (const subject of ['text', 'svg', 'image']) {
    const canvas = await lab.locator('canvas').elementHandle();
    await lab.locator(`[data-box-radio="target"][value="${subject}"]`).check();
    await lab.locator('[data-docs-lab-host]').scrollIntoViewIfNeeded();
    if (canvas) {
      await expect.poll(() => canvas.evaluate((element) => element.isConnected)).toBe(false);
    }
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab.locator('canvas')).toHaveCount(1);
    await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
    await lab.locator('[data-zoom-in]').click();
    await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
  }
  const canvas = await lab.locator('canvas').elementHandle();
  const reach = lab.locator('[data-box-setting="flameReach"]');
  await reach.scrollIntoViewIfNeeded();
  await reach.fill('27');
  await lab.locator('[data-docs-lab-host]').scrollIntoViewIfNeeded();
  await expect.poll(() => canvas?.evaluate((element) => element.isConnected)).toBe(false);
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('[data-box-code]')).toContainText('flameReach: 0.27');
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
      await lab.locator('[data-zoom-in]').tap();
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
    for (const button of await lab.locator('[data-zoom-tools] button:visible').all()) {
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

test('crossing the preview to reach zoom leaves the camera and the value alone', async ({
  page,
}) => {
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  const stage = await lab.locator('[data-docs-preview]').boundingBox();
  const plus = await lab.locator('[data-zoom-in]').boundingBox();
  if (!stage || !plus) {
    throw new Error('Preview geometry is missing');
  }
  await lab.locator('[data-docs-preview-camera]').evaluate((camera) => {
    const seen = new Set<number>();
    const sample = () => {
      seen.add(new DOMMatrix(getComputedStyle(camera).transform).a);
      requestAnimationFrame(sample);
    };
    sample();
    Object.assign(window, { cameraScales: seen });
  });
  await page.mouse.move(stage.x + 40, stage.y + stage.height - 40);
  await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2, { steps: 8 });
  expect(
    await page.evaluate(() => [...(window as never as { cameraScales: Set<number> }).cameraScales]),
  ).toEqual([1]);
  await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');

  await page.mouse.down();
  await page.mouse.up();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
  await expect.poll(() => cameraScale(lab)).toBeCloseTo(1.5);
});

test('resting on the preview magnifies at Fit without changing the chosen zoom', async ({
  page,
}) => {
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  const viewport = lab.locator('[data-docs-preview]');
  await viewport.hover({ position: { x: 40, y: 40 } });
  await expect.poll(() => cameraScale(lab)).toBeCloseTo(2);
  await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
  await expect(lab.locator('[data-zoom-out]')).toBeDisabled();
  await expect(lab.locator('[data-pan-controls]')).toBeHidden();

  await lab.locator('[data-zoom-in]').hover();
  await expect.poll(() => cameraScale(lab)).toBeCloseTo(1);
  await lab.locator('[data-zoom-in]').click();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
  await viewport.hover({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(500);
  await expect.poll(() => cameraScale(lab)).toBeCloseTo(1.5);
  await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
});

test('the zoom chip keeps its height while the pan arrows appear', async ({ page }) => {
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  await lab.locator('[data-zoom-tools]').evaluate((chip) => {
    const heights = new Set<number>();
    const sample = () => {
      heights.add(Math.round(chip.getBoundingClientRect().height));
      requestAnimationFrame(sample);
    };
    sample();
    Object.assign(window, { chipHeights: heights });
  });
  const before = await lab.locator('[data-zoom-in]').boundingBox();
  await lab.locator('[data-zoom-in]').click();
  await expect(lab.locator('[data-pan-controls]')).toBeVisible();
  await page.waitForTimeout(600);
  const heights = await page.evaluate(() => [
    ...(window as never as { chipHeights: Set<number> }).chipHeights,
  ]);
  expect(heights).toHaveLength(1);
  expect(await lab.locator('[data-zoom-in]').boundingBox()).toEqual(before);
});

test('the zoom limit looks blocked next to its available counterpart', async ({ page }) => {
  const lab = await openPreview(page, '/docs/api/effects/fire/');
  const look = (selector: string) =>
    lab.locator(selector).evaluate((button) => {
      const style = getComputedStyle(button);
      const channels =
        style.color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? [];
      return { cursor: style.cursor, light: channels.reduce((sum, value) => sum + value, 0) / 3 };
    });
  const blocked = await look('[data-zoom-out]');
  const available = await look('[data-zoom-in]');
  expect(blocked.cursor).toBe('not-allowed');
  expect(blocked.light).toBeLessThan(available.light * 0.55);
});

for (const width of [1440, 390]) {
  test(`the GSAP zoom chip keeps its buttons and the page still at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/gsap/');
    const lab = page.locator('[data-docs-gsap-lab]').first();
    const tools = lab.locator('[data-zoom-tools]');
    await tools.scrollIntoViewIfNeeded();
    await expect(tools).toBeVisible();
    const plus = lab.locator('[data-zoom-in]');
    const place = () =>
      plus.evaluate((element) => ({
        offset: element.getBoundingClientRect().left,
        page: document.documentElement.scrollHeight,
      }));
    const before = await place();
    await plus.click();
    await expect(lab.locator('[data-pan-controls]')).toBeVisible();
    await page.waitForTimeout(600);
    expect(await place()).toEqual(before);
  });
}
