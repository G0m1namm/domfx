import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const dialogOf = (page: Page) => page.locator('.effect-dialog');
const statusVisible = (dialog: Locator) =>
  dialog.locator('.dialog-status').evaluate((element) => element.getBoundingClientRect().width > 1);

async function openTab(dialog: Locator, tab: string) {
  await dialog.locator(`[data-box-tab="${tab}"]`).click();
  const view = dialog.locator(`[data-box-view="${tab}"]`);
  await expect(view).toBeVisible();
  return view;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function frameChanges(stage: Locator) {
  const first = await stage.screenshot();
  await stage.page().waitForTimeout(500);
  return !first.equals(await stage.screenshot());
}

const coverage = [
  { id: 'fire', name: 'Fire', creation: 'flameReach', writable: undefined },
  { id: 'slime', name: 'Slime', creation: 'dripReach', writable: undefined },
  { id: 'frost', name: 'Frost', creation: 'coatingDepth', writable: 'mistOpacity' },
  { id: 'halftone', name: 'Halftone', creation: 'plumeReach', writable: undefined },
] as const;

for (const { id, name, creation, writable } of coverage) {
  test(`${name}: the keyboard reaches and changes the box, and focus returns`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/effects/');
    const card = page.locator(`[data-card][data-id="${id}"]`);
    await card.press('Enter');
    const dialog = page.getByRole('dialog', { name, exact: true });
    const stage = dialog.locator('.dialog-stage');
    await expect(stage).toHaveAttribute('data-status', 'active');

    // The header holds the title and docs link; a healthy preview shows no status.
    await expect(dialog.locator('.dialog-heading h2')).toHaveText(name);
    await expect(dialog.getByRole('link', { name: 'Read the effect reference' })).toHaveAttribute(
      'href',
      `/docs/api/effects/${id}/`,
    );
    await expect(dialog.locator('[data-preview-status]')).toContainText('Live preview');
    expect(await statusVisible(dialog)).toBe(false);

    // Close, docs link, preview, then the zoom chip's enabled controls and the tabs.
    await expect(dialog.locator('[data-close]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('link', { name: 'Read the effect reference' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.locator('.dialog-scene')).toBeFocused();
    await page.keyboard.press('+');
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('150%');
    await page.keyboard.press('0');
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('100%');
    await page.keyboard.press('Tab');
    await expect(dialog.locator('[data-zoom-reset]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.locator('[data-zoom-in]')).toBeFocused();
    await page.keyboard.press('Tab');
    const shape = dialog.locator('[data-box-tab="shape"]');
    await expect(shape).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(shape).toHaveAttribute('aria-expanded', 'true');

    // A writable setting keeps the instance; a creation option replaces it.
    const canvas = await stage.locator('canvas').elementHandle();
    const intensity = dialog.locator('[data-box-setting="intensity"]');
    await intensity.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(intensity).toHaveValue('79');
    await expect(dialog.locator('[data-box-code]')).toContainText('intensity: 0.79,');
    expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
    if (writable) {
      await dialog.locator(`[data-box-setting="${writable}"]`).fill('40');
      await expect(dialog.locator('[data-box-code]')).toContainText(`${writable}: 0.4,`);
      expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
    }
    const creationInput = dialog.locator(`[data-box-setting="${creation}"]`);
    await creationInput.focus();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => canvas?.evaluate((element) => element.isConnected), { timeout: 10_000 })
      .toBe(false);
    await expect(stage).toHaveAttribute('data-status', 'active');
    await expect(stage.locator('canvas')).toHaveCount(1);

    // Esc closes the panel first and returns to its tab, then closes the dialog.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(shape).toBeFocused();
    await expect(shape).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
    await expect(page.locator('.effect-dialog canvas')).toHaveCount(0);
    await expect(page.locator('.effect-dialog [data-control-box]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const width of [320, 360]) {
    test(`${name}: panels fit without moving the page at ${width}px`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize({ width, height: 740 });
      await page.goto(`/es/effects/?effect=${id}`);
      const dialog = dialogOf(page);
      await expect(dialog.locator('.dialog-stage')).toHaveAttribute('data-status', 'active');
      const scroll = await page.evaluate(() => scrollY);
      const expected = await dialog.locator('.dialog-frame').boundingBox();
      expect(Math.round(expected?.height ?? 0)).toBeLessThanOrEqual(496);

      const tabs = [
        ['shape', 'Forma'],
        ['color', 'Color'],
        ['time', 'Tiempo'],
        ['code', 'Código'],
      ] as const;
      for (const [tab] of tabs) {
        await openTab(dialog, tab);
        await page.waitForTimeout(500);
        const layout = await dialog.evaluate((element) => {
          const scene = element.querySelector<HTMLElement>('.dialog-scene')!;
          const panel = element.querySelector<HTMLElement>('[data-box-panel]')!;
          const dock = element
            .querySelector<HTMLElement>('[data-box-dock]')!
            .getBoundingClientRect();
          const sceneBox = scene.getBoundingClientRect();
          return {
            pageFits: document.documentElement.scrollWidth <= innerWidth,
            dialogFits: element.scrollWidth <= element.clientWidth,
            panelInScene: panel.getBoundingClientRect().top >= sceneBox.top,
            dockGutter: Math.round(sceneBox.right - dock.right),
            targets: Array.from(
              element.querySelectorAll<HTMLElement>(
                '[data-box-tab], [data-box-pause], [data-box-reset], [data-close], .control-box-view:not([hidden]) :is(select, button:not(.control-box-primary))',
              ),
            )
              .filter((item) => item.getClientRects().length > 0)
              .map((item) => item.getBoundingClientRect().height),
          };
        });
        expect(layout).toMatchObject({
          pageFits: true,
          dialogFits: true,
          panelInScene: true,
          dockGutter: 8,
        });
        expect(Math.min(...layout.targets)).toBeGreaterThanOrEqual(44);
        expect((await dialog.locator('.dialog-frame').boundingBox())?.height).toBeCloseTo(
          expected?.height ?? 0,
          1,
        );
        expect(await page.evaluate(() => scrollY)).toBe(scroll);
      }
      // Copy link and Copy code live in the Code panel here, not on the dock.
      const code = dialog.locator('[data-box-view="code"]');
      await expect(code.locator('[data-box-link]')).toBeVisible();
      await expect(code.locator('[data-box-copy]')).toBeVisible();
      await expect(dialog.locator('.control-box-wide-actions')).toBeHidden();
      expect(errors).toEqual([]);
    });
  }
}

test('narrow Code panel scrolls the long import line with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/effects/?effect=fire');
  const dialog = dialogOf(page);
  await openTab(dialog, 'code');
  const source = dialog.locator('.control-box-code');
  const clipped = await source.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(clipped).toBe(true);
  await source.focus();
  await expect(source).toBeFocused();
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await expect
    .poll(() =>
      source.evaluate(
        (element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
      ),
    )
    .toBe(true);
});

test('previews start from the shared defaults at time 0 and run the selected options', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try Fire', exact: true }).click();
  const dialog = dialogOf(page);
  const code = dialog.locator('[data-box-code]');
  await expect(code).toContainText("clock: 'auto',");
  await expect(code).toContainText('intensity: 0.8,');
  await expect(code).toContainText('seed: 314,');
  await expect(code).not.toContainText('time:');
  await expect(code).not.toContainText('ambient');
  await expect(dialog.locator('[data-box-reset]')).toBeDisabled();
  // Home's decorative artwork keeps its own authored values.
  await expect(page.locator('.header-effect-host')).not.toHaveAttribute('data-time', '0.000');
});

test('External control holds its frame, because no private loop drives the preview', async ({
  page,
}) => {
  await page.goto('/effects/?effect=frost&clock=manual&time=3');
  const dialog = dialogOf(page);
  const stage = dialog.locator('.dialog-stage');
  await expect(stage).toHaveAttribute('data-status', 'active');
  await expect(stage.locator('canvas')).toHaveCount(1);
  await expect(dialog.locator('[data-preview-status]')).toHaveText('Holding one frame.');
  await expect(dialog.locator('[data-box-pause]')).toBeDisabled();
  await page.waitForTimeout(300);
  await expect.poll(() => frameChanges(stage).then((changed) => !changed)).toBe(true);

  // The slider seeks; returning to Automatic resumes the clock from there.
  const time = await openTab(dialog, 'time');
  await time.locator('[data-box-time]').fill('7');
  await expect(dialog.locator('[data-box-code]')).toContainText('time: 7,');
  await time.locator('[data-box-radio="clock"][value="auto"]').check();
  await expect(dialog.locator('[data-box-code]')).not.toContainText('time:');
  await expect(stage).toHaveAttribute('data-status', 'active');
  await expect(stage.locator('canvas')).toHaveCount(1);
  await expect.poll(() => frameChanges(stage)).toBe(true);
});

test.describe('settings links', () => {
  test('a link opens the named dialog with its settings on both pages', async ({ page }) => {
    const errors = collectErrors(page);
    const search =
      'effect=fire&intensity=0.5&seed=7&flameReach=0.3&rootColor=%23ff0000&tipColor=%230000ff';
    for (const route of ['/', '/effects/', '/es/', '/es/effects/']) {
      await page.goto(`${route}?${search}`);
      const dialog = page.getByRole('dialog', { name: 'Fire', exact: true });
      await expect(dialog).toBeVisible();
      const code = dialog.locator('[data-box-code]');
      for (const line of [
        'intensity: 0.5,',
        'seed: 7,',
        'flameReach: 0.3,',
        "rootColor: '#ff0000',",
        "tipColor: '#0000ff',",
      ]) {
        await expect(code).toContainText(line);
      }
      await expect(dialog.locator('[data-box-reset]')).toBeEnabled();
      await expect(dialog.locator('.dialog-stage')).toHaveAttribute('data-status', 'active');
    }
    expect(errors).toEqual([]);
  });

  test('an effect missing from Home still opens, and closing returns to a usable control', async ({
    page,
  }) => {
    await page.goto('/?effect=halftone');
    const dialog = page.getByRole('dialog', { name: 'Halftone', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-close]').click();
    await expect(page.locator('[data-search-open]')).toBeFocused();
  });

  for (const search of [
    'effect=nope',
    'effect=',
    'effect=__proto__',
    'effect=constructor&seed=1',
    'intensity=0.5',
  ]) {
    test(`?${search} opens nothing`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/effects/?${search}`);
      await expect(page.locator('[data-card]').first()).toBeVisible();
      await expect(dialogOf(page)).toBeHidden();
      expect(new URL(page.url()).search).toBe(`?${search}`);
      expect(errors).toEqual([]);
    });
  }

  test('bad input falls back quietly and never throws', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(
      '/effects/?effect=frost&intensity=abc&seed=1e999&time=zzz&clock=sideways&motion=%3Cb%3E&color=red&coatingDepth=9',
    );
    const dialog = page.getByRole('dialog', { name: 'Frost', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.dialog-stage')).toHaveAttribute('data-status', 'active');
    const code = dialog.locator('[data-box-code]');
    await expect(code).toContainText('intensity: 0.8,');
    await expect(code).toContainText('seed: 314,');
    await expect(code).toContainText("clock: 'auto',");
    await expect(code).not.toContainText('color:');
    await expect(dialog.locator('[data-box-reset]')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('a link keeps audience, and closing removes only the dialog params', async ({ page }) => {
    await page.goto('/?audience=agents&effect=slime&intensity=0.5&utm_source=post');
    const dialog = page.getByRole('dialog', { name: 'Slime', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#agents-panel')).not.toHaveAttribute('hidden');
    await expect(page.locator('#humans-panel')).toHaveAttribute('hidden');
    await dialog.locator('[data-close]').click();
    await expect(dialog).toBeHidden();
    expect(new URL(page.url()).search).toBe('?audience=agents&utm_source=post');
    await expect(page.locator('[data-card][data-id="slime"]')).toBeFocused();
    await page.reload();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('tab', { name: 'For agents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('only Copy link writes the URL, and its link reproduces the settings', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => sessionStorage.setItem('copied', text) },
      }),
    );
    await page.goto('/?audience=agents');
    await page.locator('[data-card][data-id="frost"]').click();
    const dialog = page.getByRole('dialog', { name: 'Frost', exact: true });
    const shape = await openTab(dialog, 'shape');
    await shape.locator('[data-box-setting="intensity"]').fill('55');
    expect(new URL(page.url()).search).toBe('?audience=agents');

    await dialog.getByRole('button', { name: 'Copy link', exact: true }).first().click();
    await expect(dialog.locator('[data-box-toast]')).toHaveText('Link copied');
    const copied = await page.evaluate(() => sessionStorage.getItem('copied'));
    expect(new URL(page.url()).search).toBe('?audience=agents&effect=frost&intensity=0.55');
    expect(copied).toBe(page.url());

    await page.goto(copied ?? '');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-box-code]')).toContainText('intensity: 0.55,');
    await expect(page.getByRole('tab', { name: 'For agents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await dialog.locator('[data-close]').click();
    await expect.poll(() => new URL(page.url()).search).toBe('?audience=agents');
  });

  test('back/forward cache restore reopens a link, and a closed dialog stays closed', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() =>
      window.addEventListener('pageshow', (event) => {
        document.documentElement.dataset.testPersisted = String(event.persisted);
      }),
    );
    await page.goto('/effects/?effect=fire&intensity=0.5');
    const dialog = page.getByRole('dialog', { name: 'Fire', exact: true });
    await expect(dialog.locator('.dialog-stage canvas')).toHaveCount(1);
    await page.goto('/');
    await page.goBack({ waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-test-persisted', 'true');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-box-code]')).toContainText('intensity: 0.5,');
    await expect(dialog.locator('[data-control-box]')).toHaveCount(1);
    await expect(dialog.locator('.dialog-stage canvas')).toHaveCount(1);

    await dialog.locator('[data-close]').click();
    await expect(dialog).toBeHidden();
    await page.goto('/');
    await page.goBack({ waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-test-persisted', 'true');
    await expect(page.locator('[data-card]').first()).toBeVisible();
    await expect(dialog).toBeHidden();
    await page.locator('[data-card][data-id="fire"]').click();
    await expect(dialog.locator('[data-box-code]')).toContainText('intensity: 0.8,');
    expect(errors).toEqual([]);
  });

  test('reduced motion still applies to a link, unless it asks for Static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/effects/?effect=fire&intensity=0.5');
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.dialog-stage canvas')).toHaveCount(0);
    await expect(dialog.locator('[data-preview-status]')).toHaveText(
      'Animation paused for reduced motion.',
    );
    expect(await statusVisible(dialog)).toBe(true);
    await expect(dialog.locator('[data-box-pause]')).toBeDisabled();

    await page.goto('/effects/?effect=fire&motion=static');
    await expect(dialog.locator('.dialog-stage canvas')).toHaveCount(1);
    expect(await statusVisible(dialog)).toBe(false);
  });
});

test('without WebGPU the status shows, the source stays and code stays copyable', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/es/effects/?effect=slime');
  const dialog = dialogOf(page);
  await expect(dialog.locator('[data-preview-status]')).toContainText('WebGPU no está disponible');
  expect(await statusVisible(dialog)).toBe(true);
  await expect(dialog.locator('[data-dialog-target]')).toBeVisible();
  await expect(dialog.locator('canvas')).toHaveCount(0);
  await expect(dialog.locator('[data-box-pause]')).toBeDisabled();
  const code = await openTab(dialog, 'code');
  await expect(code.locator('[data-box-code]')).toContainText('attachSlime');
});

test('tooltips rise above the open panel and Esc dismisses only the tooltip', async ({ page }) => {
  await page.goto('/effects/?effect=frost');
  const dialog = dialogOf(page);
  await openTab(dialog, 'shape');
  await dialog.locator('[data-box-link][data-tip]').hover();
  const tip = dialog.locator('.control-box-tooltip');
  await expect(tip).toHaveText('Copy link');
  await expect(tip).toHaveJSProperty('popover', 'manual');
  expect(await tip.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-box-tab="shape"]')).toHaveAttribute('aria-expanded', 'true');
});

for (const width of [1440, 360]) {
  test(`pan arrows never move zoom out from under the pointer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/effects/?effect=frost');
    const dialog = dialogOf(page);
    const box = await dialog.locator('[data-zoom-in]').boundingBox();
    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    for (const expected of ['150%', '200%', '250%', '300%']) {
      await page.mouse.click(x, y);
      await expect(dialog.locator('[data-zoom-label]')).toHaveText(expected);
      await expect(dialog.locator('[data-pan-controls]')).toBeVisible();
      await page.waitForTimeout(500);
    }
  });
}

test('reopening within the exit keeps one box, one layer and the right effect', async ({
  page,
}) => {
  await page.goto('/effects/');
  const dialog = dialogOf(page);
  await page.locator('[data-card][data-id="frost"]').click();
  await expect(dialog.locator('.dialog-stage canvas')).toHaveCount(1);
  await page.evaluate(() => {
    document.querySelector<HTMLDialogElement>('.effect-dialog')?.close();
    document.querySelector<HTMLElement>('[data-card][data-id="fire"]')?.click();
  });
  await expect(page.getByRole('dialog', { name: 'Fire', exact: true })).toBeVisible();
  await expect(dialog.locator('[data-control-box]')).toHaveCount(1);
  await expect(dialog.locator('.dialog-stage')).toHaveAttribute('data-status', 'active');
  await expect(dialog.locator('.dialog-stage canvas')).toHaveCount(1);
  await expect(dialog.locator('[data-control-box]')).toHaveAttribute('data-effect', 'fire');
});
