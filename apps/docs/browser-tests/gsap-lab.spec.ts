import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';

const locales = [
  {
    path: '/docs/gsap/',
    play: 'Play',
    pause: 'Pause',
    reverse: 'Reverse',
    restart: 'Restart',
    position: 'Timeline position (s)',
    unavailable: /unavailable/i,
    reducedMotion: /reduced motion/i,
  },
  {
    path: '/docs/es/gsap/',
    play: 'Reproducir',
    pause: 'Pausar',
    reverse: 'Reproducir hacia atrás',
    restart: 'Reiniciar',
    position: 'Posición en la línea de tiempo (s)',
    unavailable: /no disponibles|no están disponibles/i,
    reducedMotion: /movimiento reducido/i,
  },
] as const;

const playbackControls =
  '[data-gsap-play], [data-gsap-reverse], [data-gsap-restart], [data-gsap-position]';

async function openLab(page: Page, path = '/docs/gsap/') {
  await page.goto(path);
  const lab = page.locator('[data-docs-gsap-lab]');
  await lab.scrollIntoViewIfNeeded();
  return lab;
}

async function activeLab(page: Page, path = '/docs/gsap/') {
  const lab = await openLab(page, path);
  // A GPU run must fail, rather than silently pass or skip, if attachment fails.
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(1);
  await expect(lab.locator('[data-gsap-position]')).toBeEnabled();
  return lab;
}

async function expectSample(lab: Locator, position: number, time: number, intensity: number) {
  for (const [selector, value] of [
    ['[data-gsap-position-output]', position],
    ['[data-gsap-time-output]', time],
    ['[data-gsap-intensity-output]', intensity],
  ] as const) {
    await expect
      .poll(async () => Number.parseFloat((await lab.locator(selector).textContent()) ?? ''))
      .toBeCloseTo(value, 2);
  }
}

async function seek(lab: Locator, position: number, time: number, intensity: number) {
  await lab.locator('[data-gsap-position]').fill(String(position));
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await expectSample(lab, position, time, intensity);
}

async function expectReadableFallback(lab: Locator) {
  await expect(lab.locator('[data-gsap-target]')).toBeVisible();
  await expect(lab.locator('[data-gsap-target]')).toBeEnabled();
  await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.locator('[data-gsap-status]')).not.toBeEmpty();
  await expect(lab.locator(playbackControls)).toHaveCount(4);
  for (const control of await lab.locator(playbackControls).all()) {
    await expect(control).toBeDisabled();
  }
}

async function expectReflow(page: Page, lab: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  for (const control of await lab.locator(playbackControls).all()) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
}

for (const locale of locales) {
  test(`@smoke ${locale.path} GSAP lesson is readable without JavaScript`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      for (const width of [320, 360, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const lab = await openLab(page, locale.path);
        await expectReadableFallback(lab);
        await expect(lab.locator('[data-gsap-play]')).toHaveAccessibleName(locale.play);
        await expect(lab.locator('[data-gsap-position]')).toHaveAccessibleName(locale.position);
        await expectSample(lab, 0, 0, 0.8);
        await expectReflow(page, lab);
      }
      const code = (await page.locator('pre').allTextContents()).join('\n');
      expect(code).toMatch(/clock:\s*'manual'/);
      expect(code).toMatch(/seed:\s*314/);
      expect(code).toMatch(/flameHeight:\s*32/);
    } finally {
      await context.close();
    }
  });

  test(`@smoke ${locale.path} GSAP lesson without WebGPU keeps native interaction and reflows`, async ({
    page,
  }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    const lab = await openLab(page, locale.path);
    await expect(lab).toHaveAttribute('data-status', 'unavailable');
    await expectReadableFallback(lab);
    await expect(lab.locator('[data-gsap-status]')).toContainText(locale.unavailable);
    await lab.locator('[data-gsap-target]').click();
    await lab.locator('[data-gsap-target]').press('Enter');
    await expect(lab.locator('[data-gsap-clicks]')).toHaveText('2');
    for (const fontSize of ['100%', '200%']) {
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = value;
      }, fontSize);
      for (const width of [320, 360, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expectReflow(page, lab);
      }
    }
  });

  test(`@smoke ${locale.path} GSAP lesson respects reduced motion before setup`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const lab = await openLab(page, locale.path);
    await expect(lab.locator('[data-gsap-status]')).toContainText(locale.reducedMotion);
    await expectReadableFallback(lab);
    await expectSample(lab, 0, 0, 0.8);
  });

  test(`${locale.path} GSAP playback labels match forward, pause, reverse and restart`, async ({
    page,
  }) => {
    const lab = await activeLab(page, locale.path);
    const play = lab.locator('[data-gsap-play]');
    const position = lab.locator('[data-gsap-position]');
    await expect(lab).toHaveAttribute('data-paused', 'true');
    await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
    await expectSample(lab, 0, 0, 0.8);
    await expect(play).toHaveAccessibleName(locale.play);
    await expect(lab.locator('[data-gsap-reverse]')).toHaveAccessibleName(locale.reverse);
    await expect(lab.locator('[data-gsap-restart]')).toHaveAccessibleName(locale.restart);

    await seek(lab, 1.5, 1, 0.7);
    await play.click();
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect(play).toHaveAccessibleName(locale.pause);
    await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(1.5);
    await play.click();
    await expect(lab).toHaveAttribute('data-paused', 'true');
    await expect(play).toHaveAccessibleName(locale.play);
    const pausedPosition = await position.inputValue();
    // Sample a real interval: a paused label alone does not establish stopped playback.
    await page.waitForTimeout(150);
    await expect(position).toHaveValue(pausedPosition);

    await seek(lab, 2.5, 2, 0.6);
    await lab.locator('[data-gsap-reverse]').click();
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect(play).toHaveAccessibleName(locale.pause);
    await expect.poll(async () => Number(await position.inputValue())).toBeLessThan(2.5);
    await seek(lab, 1.5, 1, 0.7);
    await page.waitForTimeout(150);
    await expectSample(lab, 1.5, 1, 0.7);

    await seek(lab, 4.5, 4, 0.4);
    await lab.locator('[data-gsap-restart]').click();
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect(play).toHaveAccessibleName(locale.pause);
    await expect.poll(async () => Number(await position.inputValue())).toBeLessThan(1.5);
    await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0.1);
    await play.click();
  });
}

test('@smoke GSAP keeps controls disabled when WebGPU exists but no adapter is available', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      value: { requestAdapter: async () => null },
    });
  });
  const lab = await openLab(page);
  await expect(lab).toHaveAttribute('data-status', 'unavailable');
  await expectReadableFallback(lab);
  await lab.locator('[data-gsap-target]').click();
  await expect(lab.locator('[data-gsap-clicks]')).toHaveText('1');
});

test('GSAP scrubbing exposes the exact fade and linear effect checkpoints in either direction', async ({
  page,
}) => {
  const lab = await activeLab(page);
  await seek(lab, 0.25, 0, 0.8);
  const opacity = Number(
    await lab.locator('[data-gsap-host]').evaluate((host) => getComputedStyle(host).opacity),
  );
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);
  for (const [position, time, intensity] of [
    [0.5, 0, 0.8],
    [1.5, 1, 0.7],
    [2.5, 2, 0.6],
    [4.5, 4, 0.4],
    [2.5, 2, 0.6],
    [1.5, 1, 0.7],
  ]) {
    await seek(lab, position, time, intensity);
    await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
  }
  const canvas = lab.locator('canvas');
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(canvas).toHaveCSS('pointer-events', 'none');
  await lab.locator('[data-gsap-target]').click();
  await lab.locator('[data-gsap-target]').press('Enter');
  await expect(lab.locator('[data-gsap-clicks]')).toHaveText('2');
});

test('GSAP range supports keyboard seeking without taking keys from the native target', async ({
  page,
}) => {
  const lab = await activeLab(page);
  const position = lab.locator('[data-gsap-position]');
  await expect(position).toHaveAccessibleName('Timeline position (s)');
  await expect(position).toHaveAttribute('aria-describedby', /\S+/);
  await position.focus();
  await position.press('End');
  await expect(position).toBeFocused();
  await expectSample(lab, 4.5, 4, 0.4);
  await position.press('Home');
  await expectSample(lab, 0, 0, 0.8);
  await position.press('ArrowRight');
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0);
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await position.press('ArrowLeft');
  await expectSample(lab, 0, 0, 0.8);
  await position.press('End');
  await lab.locator('[data-gsap-target]').focus();
  await page.keyboard.press('Space');
  await expect(lab.locator('[data-gsap-clicks]')).toHaveText('1');
  await expectSample(lab, 4.5, 4, 0.4);
  await expect(lab).toHaveAttribute('data-paused', 'true');
});

test('GSAP manual Fire renders different samples and reproduces a sample after backward seek', async ({
  page,
  browser,
}) => {
  const lab = await activeLab(page);
  const canvas = lab.locator('canvas');
  const pixels = async () =>
    sharp(await canvas.screenshot())
      .raw()
      .toBuffer();
  await seek(lab, 1.5, 1, 0.7);
  let first = await pixels();
  // Establish a settled paused frame before using it as the within-run reference.
  await expect
    .poll(async () => {
      const next = await pixels();
      const settled = first.equals(next);
      first = next;
      return settled;
    })
    .toBe(true);
  await seek(lab, 2.5, 2, 0.6);
  await expect
    .poll(async () => {
      const next = await pixels();
      expect(next.length).toBe(first.length);
      return next.some((value, index) => Math.abs(value - first[index]) > 2);
    })
    .toBe(true);
  await seek(lab, 1.5, 1, 0.7);
  await expect
    .poll(async () => {
      const next = await pixels();
      return (
        next.length === first.length &&
        next.every((value, index) => Math.abs(value - first[index]) <= 2)
      );
    })
    .toBe(true);
  await test
    .info()
    .attach('gsap-fire-sample', { body: await canvas.screenshot(), contentType: 'image/png' });
  await test.info().attach('gsap-environment', {
    body: JSON.stringify({
      browser: browser.version(),
      backend: test.info().config.metadata.gpuBackend,
      ...(await page.evaluate(() => ({
        dpr: devicePixelRatio,
        viewport: [innerWidth, innerHeight],
        userAgent: navigator.userAgent,
      }))),
    }),
    contentType: 'application/json',
  });
});

test('GSAP releases offscreen and on pagehide, then restores one paused sample without duplicate listeners', async ({
  page,
}) => {
  const lab = await activeLab(page);
  await seek(lab, 1.5, 1, 0.7);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(lab).not.toBeInViewport();
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(1);
  await expectSample(lab, 1.5, 1, 0.7);
  await expect(lab).toHaveAttribute('data-paused', 'true');

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await expect(lab.locator('canvas')).toHaveCount(0);
    await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab.locator('canvas')).toHaveCount(1);
    await expectSample(lab, 1.5, 1, 0.7);
    await expect(lab).toHaveAttribute('data-paused', 'true');
  }
  await lab.locator('[data-gsap-target]').click();
  await expect(lab.locator('[data-gsap-clicks]')).toHaveText('1');
  await lab.locator('[data-gsap-play]').click();
  await expect(lab).toHaveAttribute('data-paused', 'false');
  await expect
    .poll(async () => Number(await lab.locator('[data-gsap-position]').inputValue()))
    .toBeGreaterThan(1.5);
});

test('GSAP reduced-motion recovery waits for an explicit playback action', async ({ page }) => {
  const lab = await activeLab(page);
  await seek(lab, 1.5, 1, 0.7);
  await lab.locator('[data-gsap-play]').click();
  await expect(lab).toHaveAttribute('data-paused', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectReadableFallback(lab);
  await expect(lab.locator('[data-gsap-status]')).toContainText(/reduced motion/i);
  const position = await lab.locator('[data-gsap-position]').inputValue();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(lab.locator('[data-gsap-play]')).toBeEnabled();
  await page.waitForTimeout(150);
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.locator('[data-gsap-position]')).toHaveValue(position);
  await lab.locator('[data-gsap-play]').click();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(1);
});

test('GSAP delayed font readiness cannot resurrect a hidden page and can mount after restoration', async ({
  page,
}) => {
  let releaseFonts = () => {};
  const fontsReady = new Promise<void>((resolve) => {
    releaseFonts = resolve;
  });
  await page.route('**/fonts/*.woff2', async (route) => {
    await fontsReady;
    await route.continue();
  });
  try {
    await page.goto('/docs/gsap/', { waitUntil: 'domcontentloaded' });
    const lab = page.locator('[data-docs-gsap-lab]');
    await lab.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
    await expect(lab.locator('canvas')).toHaveCount(0);
    await expect(lab.locator('[data-gsap-play]')).toBeDisabled();
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await expect(lab.locator('canvas')).toHaveCount(0);
    await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab.locator('canvas')).toHaveCount(1);
    await expect(lab).toHaveAttribute('data-paused', 'true');
    await seek(lab, 1.5, 1, 0.7);
  } finally {
    releaseFonts();
  }
});
