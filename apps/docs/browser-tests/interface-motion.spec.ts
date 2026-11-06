import { expect, test, type Locator } from '@playwright/test';

const runningAnimations = (locator: Locator) =>
  locator.evaluate(
    (element) =>
      element.getAnimations({ subtree: true }).filter((item) => item.playState === 'running')
        .length,
  );
const settled = (locator: Locator) =>
  expect.poll(() => runningAnimations(locator), { timeout: 2000 }).toBe(0);
const height = (locator: Locator) =>
  locator.evaluate((element) => element.getBoundingClientRect().height);
const translate = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).translate);

for (const width of [1440, 360]) {
  test(`docs search keeps one height and scrolls results inside at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/installation/');
    const trigger = page.locator('button[data-open-modal]');
    await trigger.click();
    const search = page.locator('site-search dialog');
    await settled(search);
    expect(await translate(search)).toBe('none');
    const input = search.getByRole('textbox');
    await expect(input).toBeVisible();
    const idle = await height(search);
    const inputTop = (await input.boundingBox())!.y;

    await input.fill('effect');
    await expect(search.locator('.pagefind-ui__result').first()).toBeVisible();
    expect(await height(search)).toBe(idle);
    const drawer = search.locator('.pagefind-ui__drawer');
    await drawer.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(await drawer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect((await input.boundingBox())!.y).toBe(inputTop);

    await input.fill('zzzzqqqq');
    const message = search.locator('.pagefind-ui__message');
    await expect(message).toContainText(/zzzzqqqq/);
    expect(await height(search)).toBe(idle);
    const box = (await input.boundingBox())!;
    expect((await message.boundingBox())!.y - (box.y + box.height)).toBeLessThan(48);

    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test('the docs drawer slides from the side and rests at translate none', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/docs/installation/');
  await page.locator('.docs-menu-toggle').click();
  const drawer = page.locator('#starlight__sidebar');
  expect(await runningAnimations(drawer)).toBeGreaterThan(0);
  await settled(drawer);
  expect(await translate(drawer)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page.locator('.docs-menu-toggle')).toBeFocused();
});

test('the desktop sidebar stays visible and does not animate', async ({ page }) => {
  await page.goto('/docs/installation/');
  const sidebar = page.locator('#starlight__sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCSS('opacity', '1');
  expect(await translate(sidebar)).toBe('none');
});

test('docs shares the marketing tokens', async ({ page }) => {
  await page.goto('/docs/installation/');
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ['enter-duration', 'exit-duration', 'swap-out-duration', 'swap-in-duration'].map(
      (name) => style.getPropertyValue(`--motion-${name}`).trim(),
    );
  });
  // The production build minifies 450ms to .45s.
  expect(tokens.map((value) => Number.parseFloat(value))).toEqual([0.45, 0.22, 0.13, 0.22]);
});

test('the shared select picker springs open with its chevron', async ({ page }) => {
  await page.goto('/docs/api/effects/fire/');
  await page.locator('[data-box-tab="shape"]').click();
  const select = page.locator('.select-control-input').first();
  const customizable = await select.evaluate(() => CSS.supports('appearance', 'base-select'));
  await select.click();
  const icon = select.locator('+ .select-control-icon');
  if (customizable) {
    await expect.poll(() => select.evaluate((element) => element.matches(':open'))).toBe(true);
    await expect(icon).toHaveCSS('rotate', '180deg');
    const picker = () =>
      select.evaluate((element) => getComputedStyle(element, '::picker(select)').translate);
    await expect.poll(picker).toBe('none');
    await page.keyboard.press('Escape');
    await expect(icon).toHaveCSS('rotate', 'none');
  }
  await expect(select).toBeFocused();
});

test('reduced motion applies docs surfaces immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/docs/installation/');
  await page.locator('button[data-open-modal]').click();
  const search = page.locator('site-search dialog');
  expect(await runningAnimations(search)).toBe(0);
  await expect(search).toHaveCSS('opacity', '1');
  expect(await translate(search)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden({ timeout: 100 });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('.docs-menu-toggle').click();
  const drawer = page.locator('#starlight__sidebar');
  expect(await runningAnimations(drawer)).toBe(0);
  await expect(drawer).toHaveCSS('opacity', '1');
});
