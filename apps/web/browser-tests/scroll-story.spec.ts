import { expect, test } from '@playwright/test';

for (const width of [360, 768, 1440]) {
  test(`scroll story preserves proportions and reverses at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => sessionStorage.setItem('domfx-playback', 'off'));
    await page.goto('/');
    await expect(page.locator('.scroll-story')).toHaveAttribute('data-story-enhanced', '');
    const hero = await page.locator('#example-image').boundingBox();
    expect(hero).not.toBeNull();
    expect(hero!.width / hero!.height).toBeCloseTo(4 / 3, 2);
    expect(hero!.y).toBeGreaterThan(900 * 0.7);
    expect(hero!.y + hero!.height).toBeGreaterThan(900);
    const visibleRings = await page.locator('.hero .ring-slot').evaluateAll(
      (rings) =>
        rings.filter((ring) => {
          const rect = ring.getBoundingClientRect();
          return rect.right > 0 && rect.left < innerWidth;
        }).length,
    );
    expect(visibleRings).toBe(width === 1440 ? 5 : 3);
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-hero-${width}.png`,
    });
    await page.getByRole('link', { name: 'Try the live elements' }).click();
    const image = await page.locator('#example-image').boundingBox();
    expect(image).not.toBeNull();
    expect(Math.abs(image!.x + image!.width / 2 - width / 2)).toBeLessThan(1);
    expect(Math.abs(image!.y + image!.height / 2 - 450)).toBeLessThan(1);
    expect(image!.width).toBeLessThanOrEqual(Math.min(481, width - 63));
    await page.getByRole('link', { name: 'SVG', exact: true }).click();
    const vector = await page.locator('#example-svg').boundingBox();
    expect(vector).not.toBeNull();
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(vector![key] - image![key])).toBeLessThan(1);
    }
    await expect(page.locator('#example-svg image')).toHaveCount(0);
    await expect(page.locator('#example-svg path')).not.toHaveCount(0);
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-vector-${width}.png`,
    });
    await page.getByRole('link', { name: 'Text', exact: true }).click();
    await expect(page.locator('#effect-heading')).toBeInViewport();
    await expect(page.locator('.vector-step')).toBeHidden();
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-text-${width}.png`,
    });
    await page.locator('#features-title').scrollIntoViewIfNeeded();
    await expect(page.locator('#features-title')).toBeInViewport();
    expect(
      await page.locator('.story-scene').evaluate((scene) => getComputedStyle(scene).position),
    ).not.toBe('fixed');
    await page
      .getByRole('navigation', { name: 'Explore', exact: true })
      .getByRole('link', { name: 'Examples', exact: true })
      .click();
    const reversed = await page.locator('#example-image').boundingBox();
    expect(reversed).not.toBeNull();
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(reversed![key] - image![key])).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.locator('.footer-return').scrollIntoViewIfNeeded();
    await expect(page.locator('.footer-return .ring-slot')).toHaveCount(5);
    const footer = await page.locator('.footer-return .ring-slot--center img').boundingBox();
    expect(footer!.width / footer!.height).toBeCloseTo(4 / 3, 2);
  });
}

test('reduced motion and short viewports use the complete unpinned document', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('.story-navigation')).toBeHidden();
  await expect(page.locator('.static-image')).toBeVisible();
  await page.getByRole('link', { name: 'View the SVG' }).click();
  await expect(page.locator('#example-svg')).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 800, height: 500 });
  await page.locator('#effect-play').click();
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('#effect-heading')).toBeVisible();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
});

test('focused art leaves room for the expanded copy on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => sessionStorage.setItem('domfx-playback', 'off'));
  await page.goto('/');
  await page.getByRole('link', { name: 'Try the live elements' }).click();
  const image = await page.locator('#example-image').boundingBox();
  const title = await page.locator('#image-title').boundingBox();
  const description = await page.locator('.image-step .stage-description').boundingBox();
  expect(image!.y).toBeGreaterThan(title!.y + title!.height + 24);
  expect(image!.y + image!.height + 12).toBeLessThan(description!.y);
  await page.setViewportSize({ width: 768, height: 680 });
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('.static-image')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect
    .poll(() => page.locator('.story-scene').evaluate((scene) => scene.clientWidth))
    .toBe(1440);
  await page.getByRole('link', { name: 'Image', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('#example-image')
        .evaluate((image) => Math.round(image.getBoundingClientRect().width)),
    )
    .toBe(480);
});

test('copy gets a reading interval then exits upward around stationary art', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('domfx-playback', 'off'));
  await page.goto('/');
  await page.getByRole('link', { name: 'Try the live elements' }).click();
  const readingY = await page.evaluate(() => scrollY);
  const title = await page.locator('#image-title').boundingBox();
  const image = await page.locator('#example-image').boundingBox();
  await page.evaluate((y) => scrollTo(0, y + innerHeight * 0.25), readingY);
  await expect(page.locator('#image-title')).toHaveCSS('opacity', '1');
  await expect
    .poll(async () => (await page.locator('#image-title').boundingBox())!.y)
    .toBeCloseTo(title!.y, 0);
  await page.evaluate((y) => scrollTo(0, y + innerHeight * 0.65), readingY);
  await expect
    .poll(async () => (await page.locator('#image-title').boundingBox())!.y)
    .toBeLessThan(title!.y - 40);
  const anchored = await page.locator('#example-image').boundingBox();
  expect(Math.abs(anchored!.y - image!.y)).toBeLessThan(1);
  await page.getByRole('link', { name: 'SVG', exact: true }).click();
  await expect(page.locator('#shape-title')).toHaveCSS('opacity', '1');
  await page.getByRole('link', { name: 'Image', exact: true }).click();
  await expect(page.locator('#image-title')).toHaveCSS('opacity', '1');
  const returned = await page.locator('#image-title').boundingBox();
  expect(Math.abs(returned!.y - title!.y)).toBeLessThan(1);
  await page.getByRole('link', { name: 'Text', exact: true }).click();
  await page.evaluate(() => scrollBy(0, innerHeight));
  await expect
    .poll(() => page.locator('.story-scene').evaluate((scene) => getComputedStyle(scene).position))
    .not.toBe('fixed');
  await expect(page.locator('.text-host')).toHaveCSS('opacity', '1');
  await expect(page.locator('#features-title')).toBeInViewport();
  const lastCopy = await page.locator('.selection-note').boundingBox();
  const nextHeading = await page.locator('#features-title').boundingBox();
  const handoffGap = nextHeading!.y - lastCopy!.y - lastCopy!.height;
  expect(handoffGap).toBeGreaterThan(64);
  expect(handoffGap).toBeLessThan(260);
});
