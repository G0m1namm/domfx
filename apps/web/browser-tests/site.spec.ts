import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import sharp from 'sharp';

// Fractional GPU compositing may vary by one color level at isolated pixels.
// Real animation changes exceed this strict two-level tolerance.
async function pixelDifference(first: Buffer, second: Buffer) {
  const [left, right] = await Promise.all(
    [first, second].map((buffer) => sharp(buffer).raw().toBuffer({ resolveWithObject: true })),
  );
  expect(left.info).toEqual(right.info);
  let maximum = 0;
  for (let index = 0; index < left.data.length; index += 1) {
    maximum = Math.max(maximum, Math.abs(left.data[index] - right.data[index]));
  }
  return maximum;
}

async function openEffect(page: Page) {
  if ((await page.locator('#effect-settings').getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#effect-settings').click();
  }
}

async function setNone(page: Page) {
  await openEffect(page);
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await page.keyboard.press('Escape');
}

async function center(page: Page, id: string, top?: number) {
  if (['example-image', 'example-svg', 'effect-heading'].includes(id)) {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, id);
    return;
  }
  await page.locator(`#${id}`).evaluate((element, requestedTop) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, scrollY + rect.top - (requestedTop ?? (innerHeight - rect.height) / 2));
  }, top);
}

test('static homepage is complete without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Effects that followyour HTML.');
  await expect(page.locator('#playground')).toBeHidden();
  await expect(page.locator('#toolbar-instruction')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Try the live elements' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy installation command' })).toHaveCount(0);
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'View source' }),
  ).toBeVisible();
  await expect(
    page.locator('.hero').getByRole('link', { name: 'Read the quickstart', exact: false }),
  ).toHaveAttribute('href', /\/docs\/installation\/?$/);
  await page.getByRole('link', { name: 'View the SVG' }).click();
  await expect(page).toHaveURL(/#example-svg$/);
  await expect(page.locator('#scroll-target')).toHaveAttribute('href', /\/docs\/installation\/?$/);
  await expect(page.locator('#features-title')).toHaveText('Put Fire onyour timeline.');
  await expect(page.locator('.package-name')).toHaveText('@domfx/gsap');
  await page.getByText('See the complete GSAP setup', { exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Full manual attachment and GSAP lifecycle example' }),
  ).toContainText('bindFire');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

for (const width of [360, 439, 440, 768, 1440]) {
  test(`toolbar and attached panels fit ${width}px without moving content`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#toolbar-instruction')).toBeVisible();
    await expect(page.locator('#effect-settings')).toHaveText('Effect');
    await expect(page.locator('#effect-play')).toHaveAccessibleName('Resume');
    if (width >= 440) {
      await expect(page.locator('#playback-label')).toBeVisible();
    } else {
      await expect(page.locator('#playback-label')).toBeHidden();
    }
    const dock = await page.locator('.collapsed-bar').boundingBox();
    expect(dock?.width).toBeLessThanOrEqual(560);
    const heading = await page.locator('#hero-title').boundingBox();
    const padding = await page
      .locator('body')
      .evaluate((body) => getComputedStyle(body).paddingBottom);
    for (const [trigger, panel] of [
      ['effect-settings', 'effect-panel'],
      ['motion-settings', 'motion-panel'],
      ['view-prompt', 'prompt-panel'],
    ]) {
      await page.locator(`#${trigger}`).click();
      await expect(page.locator(`#${trigger}`)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.dock-panel:visible')).toHaveCount(1);
      const box = await page.locator(`#${panel}`).boundingBox();
      const bar = await page.locator('.collapsed-bar').boundingBox();
      expect(bar?.width).toBe(dock?.width);
      expect(
        box &&
          bar &&
          box.x >= 0 &&
          box.x + box.width <= width &&
          box.y >= 0 &&
          Math.abs(box.y + box.height - bar.y) <= 2,
      ).toBe(true);
      if (panel === 'motion-panel') {
        await page.screenshot({
          path: `../../.scratch/web/${test.info().project.name}-reference-motion-${width}.png`,
        });
      }
      expect(await page.locator('#hero-title').boundingBox()).toEqual(heading);
      expect(
        await page.locator('body').evaluate((body) => getComputedStyle(body).paddingBottom),
      ).toBe(padding);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await expect(page.locator('#prompt-panel pre')).toHaveCSS('height', '144px');
    expect(
      await page
        .locator('#prompt-panel pre')
        .evaluate((input) => input.scrollHeight > input.clientHeight),
    ).toBe(true);
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-toolbar-${width}.png`,
    });
    await page.locator('#prompt-panel').evaluate((panel) => panel.scrollTo(0, panel.scrollHeight));
    await expect(page.locator('#prompt-panel').getByRole('link')).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.locator('#view-prompt')).toBeFocused();
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-${width}.png`,
      fullPage: true,
    });
  });
}

test('panels toggle, replace, focus controls and dismiss without trapping page interaction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openEffect(page);
  await expect(page.getByRole('radio', { name: 'None', exact: true })).toBeFocused();
  await expect(page.locator('#effect-settings')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#effect-settings')).toHaveCSS('color', 'rgb(232, 234, 243)');
  await page.locator('#effect-settings').click();
  await expect(page.locator('.dock-panel:visible')).toHaveCount(0);
  await page.locator('#motion-settings').click();
  await expect(page.locator('#speed-number')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#motion-settings')).toBeFocused();
  await page.locator('#view-prompt').click();
  await expect(page.locator('#prompt-target')).toBeFocused();
  await expect(page.locator('#prompt-content')).toContainText('attachFire');
  await expect(page.locator('#prompt-content')).toContainText('fire.dispose()');
  await page
    .locator('.hero')
    .getByRole('link', { name: 'Read the quickstart', exact: false })
    .focus();
  await page.locator('.hero').click({ position: { x: 8, y: 120 } });
  await expect(page.locator('#prompt-panel')).toBeHidden();
  await expect(page.locator('#view-prompt')).not.toBeFocused();
});

test('numeric fields and sliders synchronize and None shows an undecorated prompt', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openEffect(page);
  await page.locator('#intensity-number').fill('30');
  await expect(page.locator('#effect-intensity')).toHaveValue('30');
  await page.locator('#effect-intensity').fill('55');
  await expect(page.locator('#intensity-number')).toHaveValue('55');
  await page.locator('#height-number').fill('24');
  await expect(page.locator('#flame-height')).toHaveValue('24');
  await page.locator('#height-number').fill('100');
  await page.locator('#height-number').blur();
  await expect(page.locator('#height-number')).toHaveValue('64');
  await page.locator('#motion-settings').click();
  await page.locator('#speed-number').fill('0.5');
  await expect(page.locator('#motion-speed')).toHaveValue('0.5');
  await page.locator('#motion-loop').check();
  await page.locator('#range-start').fill('0.5');
  await page.locator('#range-start').blur();
  await page.locator('#range-end').fill('2');
  await page.locator('#range-end').blur();
  await page.locator('#view-prompt').click();
  await expect(page.locator('#prompt-content')).toContainText('initial time 0.50 seconds');
  await expect(page.locator('#prompt-content')).toContainText('speed 0.5×');
  await expect(page.locator('#prompt-content')).toContainText('repeat range 0.50–2.00 seconds');
  await expect(page.locator('#prompt-content')).toContainText("clock: 'manual'");
  await expect(page.locator('#prompt-content')).toContainText('intensity 0.55');
  await expect(page.locator('#prompt-content')).toContainText('flameHeight: 64');
  await setNone(page);
  await page.locator('#view-prompt').click();
  await expect(page.locator('#prompt-content')).toContainText('Do not install packages');
  await expect(page.locator('#effect-target, #match-theme, dialog')).toHaveCount(0);
});

test('None and no GPU preserve native anchors and avoid the GPU package', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('domfx-playback', 'off'));
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#effect-settings')).toHaveText('Effect');
  await expect(page.locator('#effect-settings')).toHaveAccessibleName('Effect: None');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Examples', exact: true })
    .click();
  await expect(page).toHaveURL(/#examples$/);
  await page.reload();
  await expect(page.locator('#effect-settings')).toHaveText('Effect');
  await expect(page.locator('#effect-settings')).toHaveAccessibleName('Effect: None');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(
    requests.filter((url) =>
      /snapdom|typegpu|attachment-|browser\/dist|\/_astro\/dist\./.test(url),
    ),
  ).toEqual([]);
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  await openEffect(page);
  await page.getByRole('radio', { name: 'Fire', exact: true }).check();
  await expect(page.locator('#effect-status')).toContainText('WebGPU is unavailable');
  await expect(page.locator('#effect-play')).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Try the live elements' }).click();
  await page.getByRole('link', { name: 'View the SVG' }).click();
  await expect(page).toHaveURL(/#example-svg$/);
});

test('system and local reduced motion suppress output and require explicit Resume', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#effect-status')).toContainText('Reduced motion');
  expect(
    requests.filter((url) =>
      /snapdom|typegpu|attachment-|browser\/dist|\/_astro\/dist\./.test(url),
    ),
  ).toEqual([]);
  await page.locator('#motion-settings').click();
  await expect(page.locator('#system-motion')).toContainText('System reduced motion is on');
  await page.locator('#reduce-motion').check();
  await page.locator('#reduce-motion').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', '');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('#effect-play')).toHaveText('Resume');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('#effect-play').click();
  await expect(page.locator('.hero canvas')).toHaveCount(5);
  await page.locator('#reduce-motion').check();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(
    await page
      .locator('#effect-play')
      .evaluate((button) => getComputedStyle(button).transitionDuration),
  ).toBe('0s');
  await page.reload();
  await page.locator('#motion-settings').click();
  await expect(page.locator('#reduce-motion')).toBeChecked();
  await page.locator('#reduce-motion').uncheck();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('#effect-status')).toContainText('Resume');
  await openEffect(page);
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await page.getByRole('radio', { name: 'Fire', exact: true }).check();
  await expect(page.locator('canvas')).toHaveCount(0);
});

for (const dpr of [1, 2]) {
  test(`grouped GPU output shares playback and keeps native content at DPR ${dpr}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      deviceScaleFactor: dpr,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.hero canvas')).toHaveCount(5);
    await openEffect(page);
    await page.locator('#flame-height').fill('64');
    await page.keyboard.press('Escape');
    await expect(page.locator('.hero canvas')).toHaveCount(5);
    await expect(page.locator('#effect-status')).toBeHidden();

    await page.locator('#effect-play').click();
    const bounds = await page.locator('#hero-title').boundingBox();
    if (!bounds) {
      throw new Error('Hero is missing');
    }
    await page.mouse.move(bounds.x + 5, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + 30, { steps: 12 });
    await page.mouse.up();
    expect(await page.evaluate(() => getSelection()?.toString())).toContain('Effects');
    // Capture the complete centered ring. Screenshotting a cropped hero canvas
    // scrolls it into view and would itself change the scroll choreography.
    await center(page, 'example-image');
    const ring = page.locator('.ring-slot--center canvas');
    await expect(ring).toHaveCount(1);
    await expect(page.locator('#effect-status')).toBeHidden();
    // Wait for the first presentation, then compare rendered pixels rather than
    // PNG bytes so isolated compositor rounding is not mistaken for animation.
    await expect
      .poll(async () => {
        const paused = await ring.screenshot();
        return pixelDifference(paused, await ring.screenshot());
      })
      .toBeLessThanOrEqual(2);
    await center(page, 'example-svg', 100);
    await expect(page.locator('.vector-host canvas')).toHaveCount(1);
    await expect(page.locator('.hero canvas')).toHaveCount(0);
    const pair = page.locator('.vector-host canvas');
    for (const canvas of await pair.all()) {
      await expect(canvas).toHaveAttribute('aria-hidden', 'true');
      await expect(canvas).toHaveCSS('pointer-events', 'none');
      const frozen = await canvas.screenshot();
      expect(await pixelDifference(frozen, await canvas.screenshot())).toBeLessThanOrEqual(2);
    }
    await page.locator('#effect-play').click();
    for (const canvas of await pair.all()) {
      const moving = await canvas.screenshot();
      await expect
        .poll(async () => pixelDifference(moving, await canvas.screenshot()))
        .toBeGreaterThan(2);
    }
    await page.locator('#motion-settings').click();
    await page.locator('#effect-play').click();
    await expect(page.locator('#effect-play')).toHaveText('Resume');
    await page.keyboard.press('Escape');
    await openEffect(page);
    await page.locator('#effect-intensity').fill('30');
    await page.locator('#flame-height').fill('64');
    await page.keyboard.press('Escape');
    await expect(pair).toHaveCount(1);
    await expect(page.locator('#start canvas')).toHaveCount(0);
    await expect(page.locator('#effect-status')).toBeHidden();
    await expect(page.locator('#effect-play')).toHaveText('Resume');
    await expect(page.locator('.collapsed-bar')).not.toContainText('visible target');
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-grouped-dpr${dpr}.png`,
    });
    await center(page, 'effect-heading');
    await expect(page.locator('.text-host canvas')).toHaveCount(1);
    const textBounds = await page.locator('#effect-heading').boundingBox();
    expect(textBounds).not.toBeNull();
    await page.mouse.move(textBounds!.x + 2, textBounds!.y + 35);
    await page.mouse.down();
    await page.mouse.move(textBounds!.x + textBounds!.width - 2, textBounds!.y + 35, { steps: 12 });
    await page.mouse.up();
    expect(await page.evaluate(() => getSelection()?.toString())).toContain('Keep the HTML');
    await page.locator('#effect-play').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.hero canvas')).toHaveCount(5);
    // Actual grouped responsiveness evidence, separate from correctness gates.
    const evidence = await page.evaluate(async () => {
      const gpu = (
        navigator as Navigator & {
          gpu?: {
            requestAdapter(): Promise<{
              info: { vendor: string; architecture: string; device: string; description: string };
            } | null>;
          };
        }
      ).gpu;
      const adapter = await gpu?.requestAdapter();
      const intervals: number[] = [];
      await new Promise<void>((resolve) => {
        let previous = performance.now();
        const measure = (now: number) => {
          intervals.push(now - previous);
          previous = now;
          if (intervals.length < 60) {
            requestAnimationFrame(measure);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(measure);
      });
      return {
        userAgent: navigator.userAgent,
        dpr: devicePixelRatio,
        visibleTargets: [...document.querySelectorAll('[data-effect-host]')]
          .filter((host) => host.querySelector('canvas'))
          .map((host) => host.querySelector('[data-effect-target]')?.id),
        gpu: adapter
          ? {
              vendor: adapter.info.vendor,
              architecture: adapter.info.architecture,
              device: adapter.info.device,
              description: adapter.info.description,
            }
          : null,
        intervals,
      };
    });
    await test.info().attach(`grouped-gpu-dpr${dpr}`, {
      body: JSON.stringify(evidence),
      contentType: 'application/json',
    });
    await page.locator('#effect-play').click();
    await center(page, 'example-svg');
    await expect(pair).toHaveCount(1);
    await setNone(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    await openEffect(page);
    await page.getByRole('radio', { name: 'Fire', exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(pair).toHaveCount(1);
    await expect(page.locator('#effect-play')).toHaveText('Resume');
    await center(page, 'scroll-target');
    await expect(page.locator('#start canvas')).toHaveCount(1);
    await expect(page.locator('#scroll-target')).toHaveAttribute(
      'href',
      /\/docs\/installation\/?$/,
    );
    await page.locator('#scroll-target').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/docs\/installation\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Installation');
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('rapid replacement, partial image failure and teardown retain working previews', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return this.id === 'example-image'
        ? Promise.reject(new Error('Injected image decode failure'))
        : original.call(this);
    };
  });
  await page.goto('/');
  await expect(page.locator('.hero canvas')).toHaveCount(4);
  await expect(page.locator('#effect-status')).toContainText('Some effects are unavailable');
  await expect(page.locator('#example-image')).toBeVisible();
  await center(page, 'example-svg', 100);
  await expect(page.locator('.vector-host canvas')).toHaveCount(1);
  await expect(page.locator('#effect-status')).toBeHidden();
  await page.locator('#effect-play').click();
  await openEffect(page);
  for (const value of [20, 48, 32]) {
    await page.locator('#flame-height').fill(String(value));
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.vector-host canvas')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.locator('.vector-host canvas')).toHaveCount(1);
  await expect(page.locator('#effect-play')).toHaveText('Resume');
  await setNone(page);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('hidden page, offscreen return and navigation preserve Pause', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero canvas')).toHaveCount(5);
  await page.locator('#effect-play').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.hero canvas')).toHaveCount(5);
  await expect(page.locator('#effect-play')).toHaveText('Resume');
  await page.goto('/examples');
  await expect(page).toHaveURL(/\/#examples$/);
  await expect(page.locator('#effect-play')).toHaveText('Resume');
  await page.reload();
  await expect(page.locator('#effect-play')).toHaveText('Resume');
});

test('high DPR capture budgets retain a usable static hero and controls', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    deviceScaleFactor: 8,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#effect-status')).toContainText('Some effects are unavailable');
  await expect(page.locator('.hero canvas')).toHaveCount(0);
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(
    page.locator('.hero').getByRole('link', { name: 'Read the quickstart', exact: false }),
  ).toBeVisible();
  await page.locator('#effect-settings').click();
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await expect(page.locator('#effect-status')).toBeHidden();
  await context.close();
});

test('Prompt copies the displayed snapshot, handles failure and stays independent of GPU', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem('copied-prompt', text);
        },
      },
    });
  });
  await page.goto('/');
  await page.locator('#view-prompt').click();
  await page.locator('#prompt-target').fill('#project-title');
  const draft = await page.locator('#prompt-content').textContent();
  expect(draft).toContain('#project-title');
  expect(draft).toContain('experimental and unpublished');
  expect(draft).toContain('supporting flameHeight');
  expect(draft).toContain('/docs/installation');
  expect(draft).not.toContain('c2b12318');
  expect(draft?.length).toBeLessThan(3500);
  expect(draft).toContain("clock: 'ambient'");
  await page.locator('#copy-prompt').click();
  await expect(page.locator('#copy-prompt')).toHaveText('Copied');
  expect(await page.evaluate(() => sessionStorage.getItem('copied-prompt'))).toBe(draft);
  await page.locator('#prompt-target').fill('the footer logo');
  await expect(page.locator('#copy-prompt')).toHaveText('Copy prompt');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Denied');
        },
      },
      configurable: true,
    }),
  );
  await page.locator('#copy-prompt').click();
  await expect(page.locator('#prompt-feedback')).toContainText('copy it manually');
  await setNone(page);
  await page.locator('#view-prompt').click();
  await expect(page.locator('#prompt-content')).toContainText('Do not install packages');
  await expect(page.locator('#prompt-content')).not.toContainText('pack --pack-destination');
  expect(
    requests.filter((url) =>
      /snapdom|typegpu|attachment-|browser\/dist|\/_astro\/dist\./.test(url),
    ),
  ).toEqual([]);
});

test('Prompt retains authored motion settings while the shared clock advances', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.hero canvas')).toHaveCount(5);
  await page.locator('#view-prompt').click();
  const draft = await page.locator('#prompt-content').textContent();
  await page.locator('#motion-settings').click();
  await expect(page.locator('#motion-speed')).toHaveValue('1');
  await page.locator('#view-prompt').click();
  const reopened = await page.locator('#prompt-content').textContent();
  expect(reopened).toBe(draft);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const next = () => (++frames === 20 ? resolve() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      }),
  );
  await expect(page.locator('#prompt-content')).toHaveText(reopened ?? '');
});
