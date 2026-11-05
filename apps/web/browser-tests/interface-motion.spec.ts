import { expect, test, type Locator, type Page } from '@playwright/test';

// Interface motion is independent of GPU output, so keep these checks deterministic.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

const runningAnimations = (locator: Locator) =>
  locator.evaluate(
    (element) =>
      element.getAnimations({ subtree: true }).filter((item) => item.playState === 'running')
        .length,
  );
const translate = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).translate);
const settled = (locator: Locator) =>
  expect.poll(() => runningAnimations(locator), { timeout: 2000 }).toBe(0);
const height = (locator: Locator) =>
  locator.evaluate((element) => element.getBoundingClientRect().height);

async function openSearch(page: Page) {
  await page.locator('[data-search-open]').click();
  return page.locator('#site-search');
}

test('dialogs and search spring in, then rest at translate none', async ({ page }) => {
  await page.goto('/effects/');
  const card = page.locator('[data-card]').first();
  await card.click();
  const preview = page.locator('.effect-dialog');
  expect(await runningAnimations(preview)).toBeGreaterThan(0);
  await settled(preview);
  expect(await translate(preview)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(card).toBeFocused();

  const search = await openSearch(page);
  expect(await runningAnimations(search)).toBeGreaterThan(0);
  await settled(search);
  expect(await translate(search)).toBe('none');
  await expect(search.locator('[data-global-search]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  await expect(page.locator('[data-search-open]')).toBeFocused();
});

test('a closing dialog plays its exit, then leaves the top layer', async ({ page }) => {
  await page.goto('/effects/');
  const search = await openSearch(page);
  await settled(search);
  await page.keyboard.press('Escape');
  await expect(search).not.toHaveAttribute('open');
  expect(await runningAnimations(search)).toBeGreaterThan(0);
  await expect(search).toBeHidden();
});

for (const width of [1440, 360]) {
  test(`search keeps one height through every state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/effects/');
    const trigger = page.locator('[data-search-open]');
    await expect(trigger).toBeVisible();
    const search = await openSearch(page);
    await settled(search);
    const input = search.locator('[data-global-search]');
    const hint = search.locator('.site-search-hint');
    const browsing = await height(search);
    const bottom = async () => (await hint.boundingBox())!.y;
    const hintBottom = await bottom();

    await input.fill('a');
    // The development server has no docs index, so either settled status is valid.
    await expect(search.locator('.site-search-status')).toContainText(/result|unavailable/);
    expect(await height(search)).toBe(browsing);
    expect(await bottom()).toBe(hintBottom);
    const results = search.locator('.site-search-results');
    expect(await results.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');

    await input.fill('zzzz-no-match');
    const empty = search.locator('.site-search-empty');
    await expect(empty).toBeVisible();
    expect(await height(search)).toBe(browsing);
    expect(await bottom()).toBe(hintBottom);
    const status = await search.locator('.site-search-status').boundingBox();
    const message = await empty.boundingBox();
    expect(message!.y - (status!.y + status!.height)).toBeLessThan(32);
    // Height never animates: nothing but the settled surface is running here.
    expect(await runningAnimations(search)).toBe(0);
  });
}

test('tab selection glides and the new panel fades over the old one', async ({ page }) => {
  await page.goto('/');
  const tabs = page.locator('.audience-tabs');
  const glider = tabs.locator('.selection-glider');
  await expect(glider).toBeVisible();
  const before = await glider.boundingBox();
  await tabs.locator('[data-audience="agents"]').click();
  const humans = page.locator('#humans-panel');
  const agents = page.locator('#agents-panel');
  expect(await runningAnimations(glider)).toBeGreaterThan(0);
  expect(await runningAnimations(agents)).toBeGreaterThan(0);
  await expect(humans).toBeHidden();
  await settled(glider);
  const after = await glider.boundingBox();
  const selected = await tabs.locator('[data-audience="agents"]').boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x);
  expect(after!.x).toBeCloseTo(selected!.x, 0);
  await expect(agents).toBeVisible();
  await expect(agents).toHaveCSS('opacity', '1');
  await expect(tabs.locator('[data-audience="agents"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.locator('[data-audience="humans"]')).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.locator('[data-audience="humans"]')).toBeFocused();
});

test('buttons and tabs press to 95%', async ({ page }) => {
  await page.goto('/effects/');
  const filter = page.locator('[data-filter="All"]');
  await filter.hover();
  await page.mouse.down();
  await expect(filter).toHaveCSS('scale', '0.95');
  await page.mouse.up();
  await expect(filter).toHaveCSS('scale', 'none');
});

test('the language menu springs open and rests at translate none', async ({ page }) => {
  await page.goto('/');
  const switcher = page.locator('.language-switcher');
  await switcher.locator('summary').click();
  const menu = switcher.locator('.language-links');
  await expect(menu).toBeVisible();
  await settled(menu);
  expect(await translate(menu)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(switcher).not.toHaveAttribute('open');
  await expect(switcher.locator('summary')).toBeFocused();
});

test('the phone menu drops from the top and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const button = page.locator('.nav-menu-button');
  await button.click();
  const menu = page.locator('#site-menu');
  expect(await runningAnimations(menu)).toBeGreaterThan(0);
  await settled(menu);
  expect(await translate(menu)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
});

test('reduced motion applies every surface change immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/effects/');
  await page.locator('[data-card]').first().click();
  const preview = page.locator('.effect-dialog');
  expect(await runningAnimations(preview)).toBe(0);
  expect(await translate(preview)).toBe('none');
  await expect(preview).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden({ timeout: 100 });

  const search = await openSearch(page);
  expect(await runningAnimations(search)).toBe(0);
  await expect(search).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden({ timeout: 100 });

  const filter = page.locator('[data-filter]').nth(1);
  await filter.hover();
  await page.mouse.down();
  await expect(filter).toHaveCSS('scale', '1');
  await page.mouse.up();
  await expect(page.locator('.filters .selection-glider')).toHaveCSS('transition-duration', '0s');
  await page.goto('/');
  await page.locator('[data-audience="agents"]').click();
  await expect(page.locator('#humans-panel')).toBeHidden({ timeout: 100 });
  await expect(page.locator('#agents-panel')).toHaveCSS('opacity', '1', { timeout: 100 });
});
