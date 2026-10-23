import { expect, test } from '@playwright/test';

test('zoomed previews offer single-pointer pan controls without dragging', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/effects/');
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  const pan = page.getByRole('group', { name: 'Pan preview', exact: true });
  await expect(pan).toBeHidden();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const stage = page.locator('.dialog-stage');
  const original = await stage.getAttribute('style');
  const left = pan.getByRole('button', { name: 'Pan left', exact: true });
  await left.click();
  await expect(stage).not.toHaveAttribute('style', original ?? '');
  const offset = await stage.getAttribute('style');
  await pan.getByRole('button', { name: 'Pan right', exact: true }).press('Enter');
  await expect(stage).not.toHaveAttribute('style', offset ?? '');
  await page.getByRole('button', { name: 'Fit: reset preview zoom', exact: true }).click();
  await expect(pan).toBeHidden();
  await expect(page.locator('[data-zoom-label]')).toHaveText('100%');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Try Frost', exact: true })).toBeFocused();
});

test('selected filters and preview subjects have a contrasting state boundary', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/effects/');
  const selected = page.locator('.filters [aria-pressed="true"]');
  const contrast = (colors: string[]) => {
    const luminance = colors.map((color) => {
      const rgb =
        color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? [];
      return rgb.reduce((sum, value, index) => {
        const channel = value / 255;
        const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        return sum + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
    });
    return (Math.max(...luminance) + 0.05) / (Math.min(...luminance) + 0.05);
  };
  const colors = async (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.borderColor, style.backgroundColor];
    });
  await expect(selected).toBeVisible();
  expect(contrast(await colors('.filters [aria-pressed="true"]'))).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  expect(contrast(await colors('.target-options [aria-pressed="true"]'))).toBeGreaterThanOrEqual(3);
  await page.goto('/docs/api/effects/frost/');
  expect(contrast(await colors('.docs-lab-segments input:checked + span'))).toBeGreaterThanOrEqual(
    3,
  );
});

for (const route of ['/', '/effects/']) {
  test(`${route} preview closes only for a pointer gesture that starts and ends outside`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    const trigger = page.getByRole('button', { name: 'Try Frost', exact: true });
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Frost', exact: true });
    await dialog.getByRole('button', { name: 'Image', exact: true }).click();
    await expect(dialog).toBeVisible();
    const scene = await dialog.locator('.dialog-scene').boundingBox();
    expect(scene).not.toBeNull();
    const inside = { x: (scene?.x ?? 0) + 20, y: (scene?.y ?? 0) + 20 };
    await page.mouse.move(inside.x, inside.y);
    await page.mouse.down();
    await page.mouse.move(5, 5);
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    await page.mouse.down();
    await page.mouse.move(inside.x, inside.y);
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test('accessible names retain visible command, Fit, playback and star labels', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://api.github.com/repos/G0m1namm/domfx', (route) =>
    route.fulfill({ json: { stargazers_count: 78 } }),
  );
  await page.goto('/');
  await expect(page.locator('.site-nav [data-repo-stars]')).toHaveAccessibleName(/Stars.*78/);
  await expect(page.locator('#humans-panel [data-copy]')).toHaveAccessibleName(
    /pnpm add -E @domfx\/browser@/,
  );
  await expect(page.locator('.story-install')).toHaveAccessibleName(/pnpm add -E @domfx\/browser@/);
  await page.getByRole('tab', { name: 'For agents' }).click();
  await expect(page.locator('#agents-panel [data-copy]')).toHaveAccessibleName(
    /pnpm dlx skills add G0m1namm\/domfx --skill domfx/,
  );
  await expect(page.locator('[data-closing-pause]')).toHaveAccessibleName(/Reduced motion/i);
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  await expect(page.locator('[data-zoom-reset]')).toHaveAccessibleName(/Fit/);
});

test('page pause survives card recreation while the preview keeps its own playback', async ({
  page,
}) => {
  await page.goto('/');
  const card = page.locator('[data-card][data-id="fire"] .card-art');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('canvas')).toHaveCount(1);
  const moving = await card.screenshot();
  await expect.poll(async () => moving.equals(await card.screenshot())).toBe(false);
  await page.locator('[data-closing-pause]').click();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('canvas')).toHaveCount(1);
  await page.waitForTimeout(200);
  const paused = await card.screenshot();
  await page.waitForTimeout(300);
  expect(paused.equals(await card.screenshot())).toBe(true);
  await page.getByRole('button', { name: 'Try Fire', exact: true }).press('Enter');
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(1);
  const preview = await page.locator('.dialog-stage').screenshot();
  await expect
    .poll(async () => preview.equals(await page.locator('.dialog-stage').screenshot()))
    .toBe(false);
  await page.keyboard.press('Escape');
  await page.locator('[data-closing-pause]').click();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('canvas')).toHaveCount(1);
  const resumed = await card.screenshot();
  await expect.poll(async () => resumed.equals(await card.screenshot())).toBe(false);
});
