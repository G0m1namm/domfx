import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type AttachmentRecord = {
  id: string;
  time: number;
  intensity: number;
  flameHeight: number;
  lifecycle: string;
};

declare global {
  interface Window {
    showcaseRecords: AttachmentRecord[];
    releaseFonts: () => void;
    releaseImage: () => void;
    releaseAttachment: () => void;
    holdAttachment: boolean;
  }
}

// Substitute only the public package boundary for deterministic lifecycle/control
// assertions. The separate site suite verifies actual GPU capture and output.
async function recordAttachments(page: Page) {
  await page.route(
    /(?:packages\/domfx\/dist\/index\.js|@domfx_browser\.js|\/_astro\/dist\.[^/]+\.js)(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
      window.showcaseRecords = [];
      export function attachFire(target, options) {
        const layer = document.createElement('div');
        layer.dataset.testLayer = target.id;
        options.host.append(layer);
        const record = { id: target.id, ...options, lifecycle: 'active' };
        window.showcaseRecords.push(record);
        record.dispose = () => { record.lifecycle = 'disposed'; layer.remove(); };
        record.ready = window.holdAttachment
          ? new Promise(resolve => { window.releaseAttachment = resolve; })
          : Promise.resolve();
        return record;
      }
    `,
      });
    },
  );
}

async function latest(page: Page, id: string) {
  return page.evaluate(
    (targetId) =>
      window.showcaseRecords?.findLast(
        (record) => record.id === targetId && record.lifecycle !== 'disposed',
      ),
    id,
  );
}

async function positionCard(page: Page, top: number) {
  await page.locator('#scroll-target').evaluate((card, requestedTop) => {
    window.scrollTo(0, scrollY + card.getBoundingClientRect().top - requestedTop);
  }, top);
}

test('legacy and direct example routes use ordinary native navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples');
  await expect(page).toHaveURL(/\/#examples$/);
  await expect(page.locator('#playground')).toBeVisible();
  await page.goto('/#example-image');
  await expect(page.locator('#effect-settings')).toHaveText('Effect');
  await expect(page.locator('#example-image')).toBeInViewport();
  await page.getByRole('link', { name: 'View the SVG' }).click();
  await expect(page).toHaveURL(/#example-svg$/);
  await expect(page.locator('#effect-target')).toHaveCount(0);
});

test('shared controls and paused scroll intensity reach the public attachment properties', async ({
  page,
}) => {
  await recordAttachments(page);
  await page.goto('/');
  await expect.poll(() => latest(page, 'example-image')).toBeTruthy();
  await page.locator('#effect-play').click();
  await page.locator('#motion-settings').click();
  await page.locator('#motion-loop').check();
  await page.locator('#range-start').fill('0.5');
  await page.locator('#range-start').blur();
  await page.keyboard.press('Escape');
  await page.locator('#effect-settings').click();
  await page.locator('#effect-intensity').fill('80');
  await page.locator('#flame-height').fill('24');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await latest(page, 'example-image'))?.intensity).toBe(0.8);
  await expect.poll(async () => (await latest(page, 'example-image'))?.time).toBe(0.5);
  await expect.poll(async () => (await latest(page, 'example-image'))?.flameHeight).toBe(24);
  await page.evaluate(() => {
    location.hash = 'example-svg';
  });
  for (const id of ['example-svg']) {
    await expect.poll(async () => (await latest(page, id))?.intensity).toBe(0.8);
    expect((await latest(page, id))?.time).toBe(0.5);
    expect((await latest(page, id))?.flameHeight).toBe(24);
  }
  const h = await page
    .locator('#scroll-target')
    .evaluate((card) => card.getBoundingClientRect().height);
  const H = 1000;
  // Exact geometric checkpoints: fully offscreen, halfway entering, center,
  // halfway leaving, fully offscreen, then backwards to center.
  await positionCard(page, H + 4);
  await expect.poll(() => latest(page, 'scroll-target')).toBeUndefined();
  for (const [top, expected] of [
    [(3 * H - h) / 4, 0.4],
    [(H - h) / 2, 0.8],
    [(H - 3 * h) / 4, 0.4],
  ]) {
    await positionCard(page, top);
    await expect
      .poll(async () =>
        Math.abs(((await latest(page, 'scroll-target'))?.intensity ?? -1) - expected),
      )
      .toBeLessThan(0.002);
    expect((await latest(page, 'scroll-target'))?.time).toBe(0.5);
  }
  await page.locator('#effect-settings').click();
  await page.locator('#intensity-number').fill('40');
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => Math.abs(((await latest(page, 'scroll-target'))?.intensity ?? -1) - 0.2))
    .toBeLessThan(0.002);
  await positionCard(page, -h - 4);
  await expect.poll(() => latest(page, 'scroll-target')).toBeUndefined();
  await positionCard(page, (H - h) / 2);
  await expect
    .poll(async () => Math.abs(((await latest(page, 'scroll-target'))?.intensity ?? -1) - 0.4))
    .toBeLessThan(0.002);
  expect((await latest(page, 'scroll-target'))?.time).toBe(0.5);
  const captures = await page.evaluate(
    () => window.showcaseRecords.filter((record) => record.id === 'scroll-target').length,
  );
  await positionCard(page, (H - 3 * h) / 4);
  await expect
    .poll(async () => Math.abs(((await latest(page, 'scroll-target'))?.intensity ?? -1) - 0.2))
    .toBeLessThan(0.002);
  expect(
    await page.evaluate(
      () => window.showcaseRecords.filter((record) => record.id === 'scroll-target').length,
    ),
  ).toBe(captures);
});

test('delayed fonts, pending attachment replacement and teardown cannot revive layers', async ({
  page,
}) => {
  await recordAttachments(page);
  await page.addInitScript(() => {
    Object.defineProperty(document.fonts, 'ready', {
      value: new Promise<void>((resolve) => {
        window.releaseFonts = resolve;
      }),
    });
  });
  await page.goto('/');
  await expect(page.locator('#effect-status')).toContainText('Preparing');
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
  await page.locator('#effect-settings').click();
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await page.evaluate(() => window.releaseFonts());
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
  await page.evaluate(() => {
    window.holdAttachment = true;
  });
  await page.getByRole('radio', { name: 'Fire', exact: true }).check();
  await expect(page.locator('[data-test-layer="example-image"]')).toHaveCount(1);
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await page.evaluate(() => {
    window.holdAttachment = false;
    window.releaseAttachment();
  });
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Fire', exact: true }).check();
  await expect(page.locator('[data-test-layer="example-image"]')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
});

test('storage-disabled restoration retains local motion and Pause in memory', async ({ page }) => {
  await recordAttachments(page);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled');
    };
  });
  await page.goto('/');
  await expect(page.locator('[data-test-layer="example-image"]')).toHaveCount(1);
  await page.locator('#motion-settings').click();
  await page.locator('#reduce-motion').check();
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.locator('#motion-settings').click();
  await expect(page.locator('#reduce-motion')).toBeChecked();
  await page.locator('#reduce-motion').uncheck();
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
  await page.locator('#effect-play').click();
  await expect(page.locator('[data-test-layer="example-image"]')).toHaveCount(1);
  await page.locator('#effect-play').click();
  await page.locator('#effect-settings').click();
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await page.getByRole('radio', { name: 'Fire', exact: true }).check();
  await expect(page.locator('#effect-play')).toHaveText('Resume');
});

test('delayed image decoding cannot attach after None is selected', async ({ page }) => {
  await recordAttachments(page);
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    const gate = new Promise<void>((resolve) => {
      window.releaseImage = resolve;
    });
    HTMLImageElement.prototype.decode = function () {
      return this.id === 'example-image' ? gate.then(() => decode.call(this)) : decode.call(this);
    };
  });
  await page.goto('/');
  await expect(page.locator('#effect-status')).toContainText('Preparing');
  await page.evaluate(() => {
    location.hash = 'example-svg';
  });
  await expect(page.locator('[data-test-layer="example-svg"]')).toHaveCount(1);
  await expect(page.locator('[data-test-layer="example-image"]')).toHaveCount(0);
  await page.locator('#effect-settings').click();
  await page.getByRole('radio', { name: 'None', exact: true }).check();
  await page.evaluate(() => window.releaseImage());
  await expect(page.locator('[data-test-layer]')).toHaveCount(0);
});

test('motion speed and repeat range drive preview time and the copied instructions', async ({
  page,
}) => {
  await recordAttachments(page);
  await page.goto('/');
  await expect.poll(() => latest(page, 'example-image')).toBeTruthy();
  await page.locator('#motion-settings').click();
  await page.locator('#speed-number').fill('0.5');
  await page.locator('#motion-loop').check();
  await page.locator('#range-start-slider').fill('2');
  await expect(page.locator('#range-start')).toHaveValue('2');
  await page.locator('#range-start-slider').press('ArrowRight');
  await expect(page.locator('#range-start')).toHaveValue('2.05');
  await page.locator('#range-start-slider').press('ArrowLeft');
  await expect(page.locator('#range-start')).toHaveValue('2');
  await page.locator('#range-end-slider').fill('2.2');
  await expect(page.locator('#range-end')).toHaveValue('2.2');
  await expect(page.locator('#effect-play')).toHaveAttribute('aria-pressed', 'false');
  const samples = await page.evaluate(async () => {
    const values: number[] = [];
    for (let frame = 0; frame < 70; frame++) {
      await new Promise(requestAnimationFrame);
      const record = window.showcaseRecords.findLast(
        (item) => item.id === 'example-image' && item.lifecycle === 'active',
      );
      if (record) {
        values.push(record.time);
      }
    }
    return values;
  });
  expect(samples.length).toBeGreaterThan(50);
  expect(samples.every((time) => time >= 2 && time < 2.2)).toBe(true);
  expect(samples.some((time, index) => index > 0 && time < samples[index - 1])).toBe(true);
  await page.locator('#effect-play').click();
  await expect(page.locator('#effect-play')).toHaveAttribute('aria-pressed', 'true');
  const frozen = (await latest(page, 'example-image'))?.time;
  await page.locator('#view-prompt').click();
  await expect(page.locator('#prompt-content')).toContainText('speed 0.5×');
  await expect(page.locator('#prompt-content')).toContainText('repeat range 2.00–2.20 seconds');
  await expect(page.locator('#prompt-content')).toContainText("clock: 'manual'");
  expect((await latest(page, 'example-image'))?.time).toBe(frozen);
  await page.locator('#motion-settings').click();
  await page.locator('#range-end').fill('1');
  await page.locator('#range-end').blur();
  await expect(page.locator('#range-end')).toHaveValue('2.05');
  await page.locator('#range-end').fill('20');
  await page.locator('#range-end').blur();
  await expect(page.locator('#range-end-slider')).toHaveValue('20');
  await page.keyboard.press('Escape');
  await expect(page.locator('#motion-panel')).toBeHidden();
  await expect(page.locator('#motion-settings')).toBeFocused();
});
