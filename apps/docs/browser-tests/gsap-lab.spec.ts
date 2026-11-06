import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';

const locales = [
  {
    path: '/docs/gsap/',
    play: 'Play',
    replay: 'Replay',
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
    replay: 'Volver a reproducir',
    pause: 'Pausar',
    reverse: 'Reproducir hacia atrás',
    restart: 'Reiniciar',
    position: 'Posición en la línea de tiempo (s)',
    unavailable: /WebGPU no está disponible/i,
    reducedMotion: /movimiento reducido/i,
  },
] as const;

const playbackControls =
  '[data-gsap-play], [data-gsap-reverse], [data-gsap-restart], [data-gsap-position], [data-gsap-act]';

async function openLab(page: Page, path = '/docs/gsap/') {
  await page.goto(path);
  const lab = page.locator('[data-docs-gsap-lab]');
  await lab.locator('[data-docs-preview]').scrollIntoViewIfNeeded();
  return lab;
}

async function activeLab(page: Page, path = '/docs/gsap/') {
  const lab = await openLab(page, path);
  // A GPU run must fail, rather than silently pass or skip, if attachment fails.
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(5);
  await expect(lab.locator('[data-gsap-position]')).toBeEnabled();
  return lab;
}

async function intensities(lab: Locator) {
  const values = await lab.locator('[data-gsap-intensity-output]').allTextContents();
  return values.map(Number);
}

async function expectSample(lab: Locator, position: number, intensity?: number) {
  for (const selector of ['[data-gsap-position-output]', '[data-gsap-time-output]']) {
    await expect
      .poll(async () => Number.parseFloat((await lab.locator(selector).textContent()) ?? ''))
      .toBeCloseTo(position, 2);
  }
  if (intensity !== undefined) {
    await expect
      .poll(async () =>
        (await intensities(lab)).every((value) => Math.abs(value - intensity) < 0.01),
      )
      .toBe(true);
  }
}

async function seek(lab: Locator, position: number, intensity?: number) {
  await lab.locator('[data-gsap-position]').fill(String(position));
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await expectSample(lab, position, intensity);
}

async function expectReadableFallback(lab: Locator) {
  await expect(lab.locator('[data-gsap-word]')).toBeVisible();
  await expect(lab.locator('[data-gsap-word]')).toContainText('domfx');
  await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
  await expect(lab.locator('[data-gsap-letter]').first()).toHaveCSS('transform', 'none');
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.locator('[data-gsap-status]')).not.toBeEmpty();
  await expect(lab.locator(playbackControls)).toHaveCount(8);
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
    // Allow floating-point noise around the 44px design floor.
    expect(bounds?.height).toBeGreaterThanOrEqual(44 - 0.001);
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
        await expectSample(lab, 0, 0);
        await expectReflow(page, lab);
      }
      const code = await page.locator('.docs-gsap-code').textContent();
      expect(code).toContain('addLabel');
      expect(code).toContain('stagger');
      const guide = (await page.locator('pre').allTextContents()).join('\n');
      expect(guide).toMatch(/clock:\s*'manual'/);
    } finally {
      await context.close();
    }
  });

  test(`@smoke ${locale.path} GSAP lesson without WebGPU keeps the text and reflows`, async ({
    page,
  }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    const lab = await openLab(page, locale.path);
    await expect(lab).toHaveAttribute('data-status', 'unavailable');
    await expectReadableFallback(lab);
    await expect(lab.locator('[data-gsap-status]')).toContainText(locale.unavailable);
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
    await expectSample(lab, 0, 0);
  });

  test(`${locale.path} GSAP plays once in view, then controls match their state`, async ({
    page,
  }) => {
    const lab = await activeLab(page, locale.path);
    const play = lab.locator('[data-gsap-play]');
    const position = lab.locator('[data-gsap-position]');
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect(play).toHaveAccessibleName(locale.pause);
    await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0.1);
    await expect(lab.locator('[data-gsap-reverse]')).toHaveAccessibleName(locale.reverse);
    await expect(lab.locator('[data-gsap-restart]')).toHaveAccessibleName(locale.restart);

    await seek(lab, 1.5);
    await expect(play).toHaveAccessibleName(locale.play);
    await play.click();
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect(play).toHaveAccessibleName(locale.pause);
    await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(1.5);
    await play.click();
    await expect(lab).toHaveAttribute('data-paused', 'true');
    const pausedPosition = await position.inputValue();
    // Sample a real interval: a paused label alone does not establish stopped playback.
    await page.waitForTimeout(150);
    await expect(position).toHaveValue(pausedPosition);

    await seek(lab, 2.5);
    await lab.locator('[data-gsap-reverse]').click();
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect.poll(async () => Number(await position.inputValue())).toBeLessThan(2.5);
    await seek(lab, 1.5);

    await seek(lab, 6);
    await expect(play).toHaveAccessibleName(locale.replay);
    await lab.locator('[data-gsap-restart]').click();
    await expect(lab).toHaveAttribute('data-paused', 'false');
    await expect(play).toHaveAccessibleName(locale.pause);
    await expect.poll(async () => Number(await position.inputValue())).toBeLessThan(1.5);
    await play.click();
  });

  test(`${locale.path} GSAP controls survive enlarged text with the word offscreen`, async ({
    page,
  }) => {
    const lab = await activeLab(page, locale.path);
    await seek(lab, 1.5);
    await page.setViewportSize({ width: 320, height: 500 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await lab.locator('[data-gsap-position]').scrollIntoViewIfNeeded();
    await expect(lab.locator('[data-gsap-word]')).not.toBeInViewport();
    await seek(lab, 2.5);
    await expectReflow(page, lab);
    await lab.locator('[data-gsap-word]').scrollIntoViewIfNeeded();
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab.locator('canvas').first()).toBeVisible();
    await expectSample(lab, 2.5);
  });
}

test('GSAP does not start until the word enters view, and a reader choice cancels it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto('/docs/gsap/');
  const lab = page.locator('[data-docs-gsap-lab]');
  await lab.locator('.docs-gsap-code').scrollIntoViewIfNeeded();
  await expect(lab.locator('[data-gsap-word]')).not.toBeInViewport();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await page.waitForTimeout(300);
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await seek(lab, 1.5);
  await lab.locator('[data-gsap-word]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await expectSample(lab, 1.5);
});

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
});

test('GSAP staggers letters, shifts color and ends at exact checkpoints in either direction', async ({
  page,
}) => {
  const lab = await activeLab(page);
  await seek(lab, 0.5, 0);
  // Ignite travels across the word: each letter is ahead of the next.
  await seek(lab, 1.6);
  const ignite = await intensities(lab);
  expect(ignite[0]).toBeGreaterThan(ignite[1] ?? 1);
  expect(ignite[1]).toBeGreaterThan(ignite[2] ?? 1);
  expect(ignite[4]).toBe(0);
  await seek(lab, 2.3, 1);
  const color = lab.locator('[data-gsap-root-color]');
  await expect(color).toHaveCSS('background-color', 'rgb(255, 245, 163)');
  await seek(lab, 4, 1);
  await expect(color).toHaveCSS('background-color', 'rgb(153, 221, 255)');
  // Burn out runs from the last letter back to the first.
  await seek(lab, 4.5);
  const burning = await intensities(lab);
  expect(burning[4]).toBeLessThan(burning[0] ?? 0);
  await seek(lab, 6, 0.08);
  await seek(lab, 2.3, 1);
  await expect(color).toHaveCSS('background-color', 'rgb(255, 245, 163)');
  await seek(lab, 0.5, 0);
  await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
  const canvas = lab.locator('canvas').first();
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(canvas).toHaveCSS('pointer-events', 'none');
});

test('GSAP act buttons seek their act and light its code', async ({ page }) => {
  const lab = await activeLab(page);
  const acts = lab.locator('[data-gsap-act]');
  await acts.nth(2).click();
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await expectSample(lab, 2.4);
  await expect(acts.nth(2)).toHaveAttribute('aria-current', 'true');
  const lit = lab.locator('.docs-gsap-code .line[data-act-on="true"]');
  await expect(lit.first()).toContainText('surge');
  await expect(lab.locator('.docs-gsap-code')).toContainText('burnOut');
  await acts.nth(3).click();
  await expectSample(lab, 4.2);
  await expect(lit.first()).toContainText('burnOut');
  await acts.nth(0).click();
  await expectSample(lab, 0);
  await expect(acts.nth(0)).toHaveAttribute('aria-current', 'true');
});

test('GSAP code scrolls inside its capped box under a pinned title, following the act', async ({
  page,
}) => {
  const lab = await activeLab(page);
  const box = lab.locator('.docs-gsap-code .docs-code-scroll');
  const title = lab.locator('.docs-gsap-code .docs-lab-code-bar');
  const sizes = await box.evaluate((element) => ({
    height: element.clientHeight,
    content: element.scrollHeight,
    limit: Number.parseFloat(getComputedStyle(element).maxBlockSize),
  }));
  await expect(box).toHaveCSS('border-radius', '0px');
  expect(sizes.height).toBeLessThanOrEqual(sizes.limit);
  expect(sizes.content).toBeGreaterThan(sizes.height);
  const pinned = async () => {
    const [titleBox, codeBox] = await Promise.all([title.boundingBox(), box.boundingBox()]);
    return (titleBox?.y ?? 0) - (codeBox?.y ?? 0);
  };
  const before = await pinned();
  expect(before).toBeGreaterThanOrEqual(0);
  expect(await title.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');

  const pageTop = await page.evaluate(() => scrollY);
  await lab.locator('[data-gsap-act]').nth(3).click();
  await expect.poll(() => box.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  // The running act's first line sits just below the title, inside the box.
  await expect
    .poll(async () => {
      const line = await lab
        .locator('.docs-gsap-code .line[data-act-on="true"]')
        .first()
        .boundingBox();
      const [titleBox, codeBox] = await Promise.all([title.boundingBox(), box.boundingBox()]);
      return (
        (line?.y ?? 0) >= (titleBox?.y ?? 0) + (titleBox?.height ?? 0) - 2 &&
        (line?.y ?? 0) < (codeBox?.y ?? 0) + (codeBox?.height ?? 0)
      );
    })
    .toBe(true);
  expect(await pinned()).toBe(before);
  expect(await page.evaluate(() => scrollY)).toBe(pageTop);
});

test('GSAP range supports keyboard seeking', async ({ page }) => {
  const lab = await activeLab(page);
  const position = lab.locator('[data-gsap-position]');
  await expect(position).toHaveAccessibleName('Timeline position (s)');
  await expect(position).toHaveAttribute('aria-describedby', /\S+/);
  await position.focus();
  await position.press('End');
  await expect(position).toBeFocused();
  await expectSample(lab, 6, 0.08);
  await position.press('Home');
  await expectSample(lab, 0, 0);
  await position.press('ArrowRight');
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0);
  await expect(lab).toHaveAttribute('data-paused', 'true');
});

test('GSAP manual Fire renders different samples and reproduces a sample after backward seek', async ({
  page,
  browser,
}) => {
  const lab = await activeLab(page);
  const canvas = lab.locator('canvas').first();
  const pixels = async () =>
    sharp(await canvas.screenshot())
      .raw()
      .toBuffer();
  await seek(lab, 2.5, 1);
  let first = await pixels();
  // Composited screenshots can vary by one channel level even without new GPU output.
  // Use the same tolerance as backward-seek reproduction to establish the paused reference.
  await expect
    .poll(async () => {
      const next = await pixels();
      const settled =
        next.length === first.length &&
        next.every((value, index) => Math.abs(value - first[index]) <= 2);
      first = next;
      return settled;
    })
    .toBe(true);
  await seek(lab, 4, 1);
  await expect
    .poll(async () => {
      const next = await pixels();
      expect(next.length).toBe(first.length);
      return next.some((value, index) => Math.abs(value - first[index]) > 2);
    })
    .toBe(true);
  await seek(lab, 2.5, 1);
  await expect
    .poll(async () => {
      const next = await pixels();
      return (
        next.length === first.length &&
        next.every((value, index) => Math.abs(value - first[index]) <= 2)
      );
    })
    .toBe(true);
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
  await seek(lab, 2.5, 1);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(lab).not.toBeInViewport();
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.locator('[data-gsap-host]')).toHaveCSS('opacity', '1');
  await lab.locator('[data-docs-preview]').scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(5);
  await expectSample(lab, 2.5, 1);
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
    await expect(lab.locator('canvas')).toHaveCount(5);
    await expectSample(lab, 2.5, 1);
    await expect(lab).toHaveAttribute('data-paused', 'true');
  }
  await lab.locator('[data-gsap-play]').click();
  await expect(lab).toHaveAttribute('data-paused', 'false');
  await expect
    .poll(async () => Number(await lab.locator('[data-gsap-position]').inputValue()))
    .toBeGreaterThan(2.5);
});

test('GSAP reduced-motion recovery waits for an explicit playback action', async ({ page }) => {
  const lab = await activeLab(page);
  await seek(lab, 1.5);
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
  await expect(lab.locator('canvas')).toHaveCount(5);
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
    await lab.locator('[data-docs-preview]').scrollIntoViewIfNeeded();
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
    await expect(lab.locator('canvas')).toHaveCount(5);
    await seek(lab, 1.5);
  } finally {
    releaseFonts();
  }
});
