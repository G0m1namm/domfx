import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';
import { build, transformWithEsbuild } from 'vite';

const FIRE = '/docs/api/effects/fire/';
const surfaces = [
  { id: 'fire', path: FIRE, setting: 'flameReach', hasColor: true },
  { id: 'slime', path: '/docs/api/effects/slime/', setting: 'coatingDepth', hasColor: true },
  { id: 'frost', path: '/docs/api/effects/frost/', setting: 'mistReach', hasColor: true },
  { id: 'halftone', path: '/docs/api/effects/halftone/', setting: 'plumeReach', hasColor: true },
] as const;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('invalid-')) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function stubClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.clipboard = text;
        },
      },
    });
  });
}

const clipboard = (page: Page) => page.locator('html').getAttribute('data-clipboard');

async function openLab(page: Page, path: string, { active = true } = {}) {
  await page.goto(path);
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  if (active) {
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab.locator('canvas')).toHaveCount(1);
  }
  return lab;
}

const openTab = (lab: Locator, tab: string) => lab.locator(`[data-box-tab="${tab}"]`).click();
const radio = (lab: Locator, group: string, value: string) =>
  lab.locator(`[data-box-radio="${group}"][value="${value}"]`);
const code = (lab: Locator) => lab.locator('[data-box-code]');
const reset = (lab: Locator) => lab.locator('[data-box-reset]');
const dataUrl = (lab: Locator) =>
  lab.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
const translateY = (lab: Locator) =>
  lab
    .locator('[data-docs-lab-host]')
    .evaluate((host) => Number.parseFloat(getComputedStyle(host).translate.split(' ')[1] ?? '0'));
const animations = (locator: Locator) =>
  locator.evaluate((element) => element.getAnimations({ subtree: true }).length);
const settled = (lab: Locator) =>
  expect.poll(() => animations(lab.locator('[data-box-panel]'))).toBe(0);

async function pixelDifference(first: string, second: string) {
  const decode = (url: string) =>
    sharp(Buffer.from(url.split(',')[1], 'base64'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  const [a, b] = await Promise.all([decode(first), decode(second)]);
  expect([a.info.width, a.info.height]).toEqual([b.info.width, b.info.height]);
  let total = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    total += Math.abs(a.data[index] - b.data[index]);
  }
  return total / a.data.length;
}

for (const { id, path, setting, hasColor } of surfaces) {
  test(`${id}: the dock, panels and keyboard work, and each panel stays in the preview`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const lab = await openLab(page, path);
    const stage = lab.locator('[data-docs-preview]');
    const tabs = lab.locator('[data-box-tab]');
    await expect(tabs).toHaveText(
      hasColor ? ['Shape', 'Color', 'Time', 'Code'] : ['Shape', 'Time', 'Code'],
    );

    // Zoom comes first, with the percentage between its neighbors; Fit stays in its name.
    await stage.focus();
    await page.keyboard.press('Tab');
    await expect(lab.locator('[data-zoom-reset]')).toBeFocused();
    await expect(lab.locator('[data-zoom-reset]')).toHaveAccessibleName(/^Fit/);
    await page.keyboard.press('Tab');
    await expect(lab.locator('[data-zoom-in]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tabs.first()).toBeFocused();

    // Enter opens; Tab reaches the panel straight after the tabs; Esc closes and returns.
    await page.keyboard.press('Enter');
    await expect(lab.locator('[data-box-view="shape"]')).toBeVisible();
    await expect(tabs.first()).toHaveAttribute('aria-expanded', 'true');
    await settled(lab);
    const tabCount = await tabs.count();
    for (let step = 0; step < tabCount; step += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(
      radio(
        lab,
        'target',
        (await lab.locator('[data-box-radio="target"]:checked').getAttribute('value')) ?? '',
      ),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(lab.locator('[data-box-panel]')).toBeHidden();
    await expect(tabs.first()).toBeFocused();

    // A keyboard step leaves a stop instead of snapping back to it.
    await openTab(lab, 'shape');
    const slider = lab.locator(`[data-box-setting="${setting}"]`);
    await expect(slider).toHaveAccessibleName(new RegExp(`^${setting}`));
    const start = Number(await slider.inputValue());
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(start + 1));
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue(String(start));

    await openTab(lab, 'shape');
    await expect(lab.locator('[data-box-panel]')).toBeHidden();
    const frame = await lab.boundingBox();
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const tab of await tabs.evaluateAll((items) =>
      items.map((item) => item.getAttribute('data-box-tab')),
    )) {
      await openTab(lab, tab ?? '');
      await settled(lab);
      const panel = await lab.locator('[data-box-panel]').boundingBox();
      expect(panel?.y).toBeGreaterThanOrEqual(frame?.y ?? 0);
      expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeLessThanOrEqual(
        (frame?.x ?? 0) + (frame?.width ?? 0),
      );
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(scrollHeight);
      for (const row of await lab
        .locator(
          `[data-box-view="${tab}"] :is(input:not([type="radio"], [type="range"]), select, button):visible`,
        )
        .all()) {
        expect((await row.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(errors).toEqual([]);
  });

  test(`${id}: Reset all, seed and a settings link round trip for real`, async ({ page }) => {
    const errors = watchErrors(page);
    await stubClipboard(page);
    const lab = await openLab(page, path);
    await expect(reset(lab)).toBeDisabled();
    await openTab(lab, 'shape');

    // Seed applies on commit, not per keystroke, because it replaces the instance.
    const seed = lab.locator('[data-box-seed]');
    const before = await lab.locator('canvas').elementHandle();
    await seed.focus();
    await seed.fill('77');
    await expect(code(lab)).toContainText('seed: 314,');
    expect(await before?.evaluate((canvas) => canvas.isConnected)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(code(lab)).toContainText('seed: 77,');
    await expect.poll(() => before?.evaluate((canvas) => canvas.isConnected)).toBe(false);
    await expect(lab).toHaveAttribute('data-status', 'active');
    await lab.locator('[data-box-shuffle]').click();
    await expect(code(lab)).not.toContainText('seed: 77,');

    const slider = lab.locator(`[data-box-setting="${setting}"]`);
    await slider.fill('7');
    await lab.locator('[data-box-setting="intensity"]').fill('45');
    await seed.fill('77');
    await seed.blur();
    await openTab(lab, 'time');
    await radio(lab, 'clock', 'manual').check();
    await lab.locator('[data-box-time]').fill('2.4');
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(reset(lab)).toBeEnabled();

    // Nothing reaches the URL until Copy link.
    expect(new URL(page.url()).search).toBe('');
    const copiedCode = await code(lab).textContent();
    await lab.locator('.control-box-actions [data-box-link]').click();
    await expect(lab.locator('[data-box-toast]')).toHaveText('Link copied');
    const link = (await clipboard(page)) ?? '';
    const params = new URL(link).searchParams;
    expect(params.get('intensity')).toBe('0.45');
    expect(params.get('seed')).toBe('77');
    expect(params.get('clock')).toBe('manual');
    expect(params.get('time')).toBe('2.4');
    expect(params.get(setting)).toBe('0.07');
    expect(new URL(page.url()).search).toBe(new URL(link).search);

    // The link reopens the same preview and the same code.
    const reopened = await openLab(page, link);
    await expect(code(reopened)).toHaveText(copiedCode ?? '');
    await openTab(reopened, 'time');
    await expect(reopened.locator('[data-box-time]')).toHaveValue('2.4');
    await expect(radio(reopened, 'clock', 'manual')).toBeChecked();

    // Reset all restores every default, but leaves target and zoom alone.
    const target = await reopened
      .locator('[data-box-radio="target"]:checked')
      .getAttribute('value');
    await reopened.locator('[data-zoom-in]').click();
    await reset(reopened).click();
    await expect(reset(reopened)).toBeDisabled();
    await expect(code(reopened)).toContainText("clock: 'auto'");
    await expect(code(reopened)).toContainText('seed: 314,');
    await expect(code(reopened)).toContainText('intensity: 0.8,');
    await expect(reopened.locator('[data-box-time-row]')).toBeHidden();
    await expect(reopened.locator('[data-box-radio="target"]:checked')).toHaveValue(target ?? '');
    await expect(reopened.locator('[data-zoom-label]')).toHaveText('150%');
    expect(errors).toEqual([]);
  });

  test(`${id}: the narrow layout moves copying into the Code panel and keeps 8px gutters`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await stubClipboard(page);
    const lab = await openLab(page, path);
    await expect(lab.locator('.control-box-actions [data-box-link]')).toBeHidden();
    await expect(lab.locator('.control-box-actions [data-box-copy]')).toBeHidden();
    const frame = await lab.locator('[data-docs-preview]').boundingBox();
    const dock = await lab.locator('[data-box-dock]').boundingBox();
    expect((dock?.x ?? 0) - (frame?.x ?? 0)).toBeCloseTo(8, 0);
    expect((frame?.x ?? 0) + (frame?.width ?? 0) - (dock?.x ?? 0) - (dock?.width ?? 0)).toBeCloseTo(
      8,
      0,
    );
    expect(
      (frame?.y ?? 0) + (frame?.height ?? 0) - (dock?.y ?? 0) - (dock?.height ?? 0),
    ).toBeCloseTo(8, 0);
    expect(frame?.height).toBeCloseTo(31 * 16, 0);

    await openTab(lab, 'code');
    await settled(lab);
    const copy = lab.locator('[data-box-view="code"] [data-box-copy]');
    await copy.focus();
    await page.keyboard.press('Enter');
    await expect(lab.locator('[data-box-toast]')).toHaveText('Code copied');
    const toast = await lab.locator('[data-box-toast]').boundingBox();
    const panel = await lab.locator('[data-box-panel]').boundingBox();
    expect((toast?.y ?? 0) + (toast?.height ?? 0)).toBeLessThanOrEqual(panel?.y ?? 0);
    expect(await clipboard(page)).toContain('@domfx/browser');
    await lab.locator('[data-box-view="code"] [data-box-link]').click();
    await expect(lab.locator('[data-box-toast]')).toHaveText('Link copied');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('clock and time run the real instance, and Automatic continues from the held frame', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const lab = await openLab(page, FIRE);
  await expect(lab.locator('[data-box-pause]')).toBeEnabled();
  await openTab(lab, 'time');
  await expect(lab.locator('[data-box-time-row]')).toBeHidden();

  await radio(lab, 'clock', 'manual').check();
  await expect(lab.locator('[data-box-time-row]')).toBeVisible();
  await expect(code(lab)).toContainText("clock: 'manual',");
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('[data-box-pause]')).toBeDisabled();
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText('Holding one frame.');
  // External control holds: nothing advances without a write.
  const time = lab.locator('[data-box-time]');
  await time.fill('4');
  await expect(lab.locator('[data-effect-setting-output="time"]')).toHaveText('4.0 s');
  await expect(code(lab)).toContainText('time: 4,');
  await expect(time).toHaveAttribute('aria-valuetext', '4.0 seconds');
  const canvas = await lab.locator('canvas').elementHandle();
  await page.waitForTimeout(200);
  const held = await dataUrl(lab);
  await page.waitForTimeout(400);
  expect(await dataUrl(lab)).toBe(held);
  // Writing time repaints the same instance, without replacing it.
  await time.fill('9.3');
  await expect.poll(() => dataUrl(lab)).not.toBe(held);
  expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);

  await radio(lab, 'clock', 'auto').check();
  await expect(code(lab)).not.toContainText('time:');
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('[data-box-pause]')).toBeEnabled();
  const running = await dataUrl(lab);
  await expect.poll(() => dataUrl(lab)).not.toBe(running);

  // Pausing Automatic really stops it, and Resume starts it again.
  await lab.locator('[data-box-pause]').click();
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await page.waitForTimeout(100);
  const paused = await dataUrl(lab);
  await page.waitForTimeout(300);
  expect(await dataUrl(lab)).toBe(paused);
  await lab.locator('[data-box-pause]').click();
  await expect.poll(() => dataUrl(lab)).not.toBe(paused);
  expect(errors).toEqual([]);
});

test('Static paints one frame, disables time and explains why', async ({ page }) => {
  const lab = await openLab(page, FIRE);
  await openTab(lab, 'time');
  await radio(lab, 'clock', 'manual').check();
  await radio(lab, 'motion', 'static').check();
  await expect(code(lab)).toContainText("motion: 'static',");
  await expect(lab.locator('[data-box-static-note]')).toBeVisible();
  await expect(lab.locator('[data-box-time]')).toBeDisabled();
  await expect(lab.locator('[data-box-pause]')).toBeDisabled();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await page.waitForTimeout(200);
  const still = await dataUrl(lab);
  await page.waitForTimeout(400);
  expect(await dataUrl(lab)).toBe(still);
  await radio(lab, 'motion', 'respect').check();
  await radio(lab, 'clock', 'auto').check();
  await expect(code(lab)).not.toContainText('motion:');
  await expect(lab.locator('[data-box-static-note]')).toBeHidden();
  await expect.poll(() => dataUrl(lab)).not.toBe(still);
});

test('Fire color modes switch in place and never trigger invalid-fire-parameter', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const lab = await openLab(page, FIRE);
  await openTab(lab, 'color');
  const canvas = await lab.locator('canvas').elementHandle();
  const rows = {
    color: lab.locator('[data-box-color="color"]'),
    rootColor: lab.locator('[data-box-color="rootColor"]'),
    tipColor: lab.locator('[data-box-color="tipColor"]'),
  };
  await expect(radio(lab, 'color-mode', 'authored')).toBeChecked();
  await expect(rows.color).toBeHidden();
  await expect(rows.rootColor).toBeHidden();

  await radio(lab, 'color-mode', 'single').check();
  await expect(rows.color).toBeVisible();
  await expect(reset(lab)).toBeDisabled();
  const authored = await dataUrl(lab);
  const single = lab.locator('[data-box-color-input="color"]');
  const singleInput = await single.elementHandle();
  await single.fill('#00ff66');
  await expect(code(lab)).toContainText("color: '#00ff66',");
  await expect(lab.locator('[data-box-color-value="color"]')).toHaveText('#00ff66');
  // The native picker stays open only if its input survives an update.
  expect(await singleInput?.evaluate((input) => input.isConnected)).toBe(true);
  await expect.poll(() => dataUrl(lab)).not.toBe(authored);

  // Choosing the pair clears Single; it changes nothing until a color is picked.
  await radio(lab, 'color-mode', 'root-and-tip').check();
  await expect(rows.rootColor).toBeVisible();
  await expect(rows.tipColor).toBeVisible();
  await expect(rows.color).toBeHidden();
  await expect(code(lab)).not.toContainText('color:');
  await expect(code(lab)).not.toContainText('Color:');
  await expect(lab.locator('[data-box-color-input="rootColor"]')).toHaveValue('#fff5a3');
  await expect(lab.locator('[data-box-color-input="tipColor"]')).toHaveValue('#ff1701');
  await expect(rows.rootColor).toHaveAttribute('data-unset', 'true');
  await expect(lab.locator('[data-box-color-value="tipColor"]')).toHaveText('#ff1701');

  await lab.locator('[data-box-color-input="tipColor"]').fill('#0066ff');
  await expect(code(lab)).toContainText("tipColor: '#0066ff',");
  await expect(code(lab)).not.toContainText('rootColor');
  await lab.locator('[data-box-color-input="rootColor"]').fill('#ffffff');
  await expect(code(lab)).toContainText("rootColor: '#ffffff',");
  await lab.locator('[data-box-unset="tipColor"]').click();
  await expect(code(lab)).not.toContainText('tipColor');
  await expect(rows.tipColor).toHaveAttribute('data-unset', 'true');

  // Straight back to Single, then Authored, and through the pair again.
  await radio(lab, 'color-mode', 'single').check();
  await expect(code(lab)).not.toContainText('rootColor');
  await single.fill('#336699');
  await radio(lab, 'color-mode', 'root-and-tip').check();
  await lab.locator('[data-box-color-input="rootColor"]').fill('#112233');
  await radio(lab, 'color-mode', 'authored').check();
  await expect(code(lab)).not.toContainText('olor:');
  expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);

  // A settings link restores the mode; `color` arriving with the pair is dropped.
  const linked = await openLab(page, `${FIRE}?color=%23111111&rootColor=%23ff00ff`);
  await expect(code(linked)).toContainText("rootColor: '#ff00ff',");
  await expect(code(linked)).not.toContainText(' color:');
  await openTab(linked, 'color');
  await expect(radio(linked, 'color-mode', 'root-and-tip')).toBeChecked();
  await expect(linked.locator('[data-box-color-input="rootColor"]')).toHaveValue('#ff00ff');
  await reset(linked).click();
  await expect(radio(linked, 'color-mode', 'authored')).toBeChecked();
  await expect(linked).toHaveAttribute('data-status', 'active');
  expect(errors).toEqual([]);
});

test('other effects keep one color control and Unset updates in place', async ({ page }) => {
  const errors = watchErrors(page);
  const lab = await openLab(page, '/docs/api/effects/frost/');
  await openTab(lab, 'color');
  await expect(lab.locator('[data-box-radio="color-mode"]')).toHaveCount(0);
  await expect(lab.locator('[data-box-color="color"]')).toBeVisible();
  const unset = lab.locator('[data-box-unset="color"]');
  await expect(unset).toBeDisabled();
  await lab.locator('[data-box-color-input="color"]').fill('#ff0000');
  await expect(reset(lab)).toBeEnabled();
  await unset.click();
  await expect(lab.locator('[data-box-color-value="color"]')).toHaveText('Authored');
  await expect(reset(lab)).toBeDisabled();
  await expect(lab.locator('[data-box-color-input="color"]')).toBeFocused();

  const burned = await openLab(page, '/docs/api/effects/burned-paper/');
  await expect(burned.locator('[data-box-tab]')).toHaveText(['Shape', 'Time', 'Code']);
  expect(errors).toEqual([]);
});

test('copied code run through the real API reproduces the preview', async ({ page }) => {
  await stubClipboard(page);
  // A held frame with every kind of option set, so identical output is meaningful.
  const lab = await openLab(
    page,
    `${FIRE}?clock=manual&time=2.4&seed=99&intensity=0.6&flameReach=0.25&emberDensity=0.5&tipColor=%230066ff`,
  );
  await lab.locator('.control-box-actions [data-box-copy]').click();
  const snippet = (await clipboard(page)) ?? '';
  expect(snippet).toContain("tipColor: '#0066ff',");

  const result = await build({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    logLevel: 'error',
    plugins: [
      {
        name: 'copied-snippet',
        resolveId: (id) => (id === 'copied-snippet' ? '\0copied-snippet' : undefined),
        async load(id) {
          if (id !== '\0copied-snippet') {
            return undefined;
          }
          const source = `const host = document.querySelector('#copied-host');
const target = host.querySelector('[data-copied-target]');
${snippet}
await effect.ready;
document.documentElement.dataset.copiedLifecycle = effect.lifecycle;`;
          const { code: transformed } = await transformWithEsbuild(source, 'copied-snippet.ts', {
            loader: 'ts',
            target: 'esnext',
          });
          return transformed;
        },
      },
    ],
    build: {
      write: false,
      target: 'esnext',
      rollupOptions: { input: 'copied-snippet', preserveEntrySignatures: false },
    },
  });
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('Expected one snippet bundle');
  }
  const chunks = new Map(result.output.map((chunk) => [chunk.fileName, chunk]));
  await page.route('**/__snippet/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/__snippet/')[1];
    const chunk = chunks.get(name);
    return route.fulfill({
      contentType: 'text/javascript',
      body: chunk?.type === 'chunk' ? chunk.code : '',
    });
  });
  const entry = result.output.find((chunk) => chunk.type === 'chunk' && chunk.isEntry);

  // The same target at the same size, next to the preview.
  await lab.evaluate((element) => {
    const source = element.querySelector('[data-docs-lab-target]:not([hidden])');
    const stage = element.querySelector('[data-docs-preview]');
    if (!source || !stage) {
      throw new Error('Missing preview parts');
    }
    const { width, height } = source.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    const host = document.createElement('div');
    host.id = 'copied-host';
    host.style.cssText = `position:fixed;left:${box.left + 40}px;top:${box.top + 40}px;width:${width}px;height:${height}px;`;
    const target = source.cloneNode(true) as HTMLElement;
    target.removeAttribute('data-docs-lab-target');
    target.setAttribute('data-copied-target', '');
    host.append(target);
    document.body.append(host);
  });
  await page.evaluate(
    (url) => import(url),
    `${new URL(page.url()).origin}/__snippet/${entry?.fileName}`,
  );
  await expect(page.locator('html')).toHaveAttribute('data-copied-lifecycle', 'active');
  await expect(lab).toHaveAttribute('data-status', 'active');
  await page.waitForTimeout(300);
  const preview = await dataUrl(lab);
  const copied = await page
    .locator('#copied-host canvas')
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(await pixelDifference(preview, copied)).toBeLessThan(2);
});

test('the zoom chip, subject lift and heights match the contract without recapture', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const lab = await openLab(page, FIRE);
  const stage = await lab.locator('[data-docs-preview]').boundingBox();
  expect(stage?.height).toBeCloseTo(34 * 16, 0);

  // Pan arrows exist only while zoomed.
  const pan = lab.locator('[data-pan-controls]');
  await expect(pan).toBeHidden();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
  await lab.locator('[data-zoom-in]').click();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
  await expect(pan).toBeVisible();
  await lab.locator('[data-zoom-reset]').click();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('100%');
  await expect(pan).toBeHidden();
  await expect(lab.locator('.zoom-chip-help')).toHaveCSS('clip-path', /inset/);

  // The subject lifts above the dock and further for a panel; the effect is not replaced.
  const canvas = await lab.locator('canvas').elementHandle();
  const resting = await translateY(lab);
  expect(resting).toBeLessThan(0);
  await openTab(lab, 'shape');
  await settled(lab);
  await expect.poll(() => translateY(lab)).toBeLessThan(resting);
  await expect
    .poll(() => lab.locator('[data-docs-lab-host]').evaluate((host) => host.getAnimations().length))
    .toBe(0);
  const raised = await lab.locator('[data-docs-lab-target]:not([hidden])').boundingBox();
  const panel = await lab.locator('[data-box-panel]').boundingBox();
  expect((raised?.y ?? 0) + (raised?.height ?? 0)).toBeLessThanOrEqual(panel?.y ?? 0);
  await openTab(lab, 'shape');
  await expect(lab.locator('[data-box-panel]')).toBeHidden();
  await expect.poll(() => translateY(lab)).toBeCloseTo(resting);
  expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
  await expect(lab).toHaveAttribute('data-status', 'active');

  // Panels: Color is 27rem wide, the rest match the toolbar. Sliders carry no markers.
  await openTab(lab, 'color');
  await settled(lab);
  const dock = await lab.locator('[data-box-dock]').boundingBox();
  expect((await lab.locator('[data-box-panel]').boundingBox())?.width).toBeCloseTo(27 * 16, 0);
  await openTab(lab, 'time');
  await settled(lab);
  expect((await lab.locator('[data-box-panel]').boundingBox())?.width).toBeCloseTo(
    dock?.width ?? 0,
    0,
  );
  await expect(lab.locator('input[list], datalist')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('pointer drags snap to stops with no visible marks', async ({ page }) => {
  const lab = await openLab(page, FIRE);
  await openTab(lab, 'shape');
  await settled(lab);
  const slider = lab.locator('[data-box-setting="flameReach"]');
  const box = await slider.boundingBox();
  if (!box) {
    throw new Error('Missing slider');
  }
  const y = box.y + box.height / 2;
  const x = (value: number) => box.x + 7 + ((box.width - 14) * value) / 30;
  await page.mouse.move(x(10), y);
  await page.mouse.down();
  await page.mouse.move(x(15), y, { steps: 3 });
  await expect(slider).toHaveValue('15');
  await page.mouse.move(x(19), y, { steps: 3 });
  await expect(slider).toHaveValue('20');
  await page.mouse.move(x(29.2), y, { steps: 3 });
  await expect(slider).toHaveValue('30');
  await page.mouse.up();
  await expect(code(lab)).toContainText('flameReach: 0.3,');
});

test('tooltips use the top layer and Esc dismisses them before the panel', async ({ page }) => {
  const lab = await openLab(page, FIRE);
  await openTab(lab, 'time');
  const tooltip = lab.locator('.control-box-tooltip');
  await lab.locator('[data-box-pause]').hover();
  await expect(tooltip).toHaveText('Pause effect');
  await expect(tooltip).toHaveJSProperty('popover', 'manual');
  expect(await tooltip.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();

  await lab.locator('[data-box-tab="code"]').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await lab.locator('[data-zoom-in]').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(lab.locator('[data-zoom-reset]')).toBeFocused();
  await expect(tooltip).toHaveText(/^Fit/);
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(lab.locator('[data-box-panel]')).toBeVisible();
});

test('status is visual only when unavailable or suspended, but always announced', async ({
  page,
}) => {
  const status = (lab: Locator) => lab.locator('.docs-lab-status');
  const lab = await openLab(page, FIRE);
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText('Live');
  await expect(status(lab)).toHaveAttribute('aria-live', 'polite');
  expect((await status(lab).boundingBox())?.width).toBeLessThanOrEqual(1);
  await lab.getByRole('button', { name: 'Pause effect', exact: true }).click();
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText('Paused');
  expect((await status(lab).boundingBox())?.width).toBeLessThanOrEqual(1);

  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  const without = await openLab(page, FIRE, { active: false });
  await expect(without).toHaveAttribute('data-status', 'unavailable');
  await expect(status(without)).toContainText('Effects are unavailable');
  expect((await status(without).boundingBox())?.width).toBeGreaterThan(40);
});

test('without WebGPU the page, code and copying still work', async ({ page }) => {
  const errors = watchErrors(page);
  await stubClipboard(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  const lab = await openLab(page, `${FIRE}?seed=9`, { active: false });
  await expect(lab).toHaveAttribute('data-status', 'unavailable');
  await expect(lab.locator('[data-docs-lab-target]:visible')).toHaveCount(1);
  await expect(lab.locator('[data-box-pause]')).toHaveAccessibleName('Effects unavailable');
  await expect(lab.locator('[data-box-pause]')).toBeDisabled();
  await openTab(lab, 'shape');
  await expect(lab.locator('[data-box-setting="intensity"]')).toBeDisabled();
  await openTab(lab, 'code');
  await expect(code(lab)).toContainText('seed: 9,');
  await lab.locator('.control-box-actions [data-box-copy]').click();
  expect(await clipboard(page)).toContain('seed: 9,');
  await lab.locator('[data-zoom-in]').click();
  await expect(lab.locator('[data-zoom-label]')).toHaveText('150%');
  expect(errors).toEqual([]);
});

test('reduced motion keeps Respect still, applies changes at once and allows Static', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const lab = await openLab(page, FIRE, { active: false });
  await expect(lab).toHaveAttribute('data-reason', 'reduced-motion');
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.locator('.docs-lab-status')).toContainText(
    'Reduced motion keeps this preview still',
  );
  await expect(lab.locator('[data-box-pause]')).toBeDisabled();

  await openTab(lab, 'time');
  await expect(lab.locator('[data-box-panel]')).toBeVisible();
  expect(await animations(lab.locator('[data-box-panel]'))).toBe(0);
  await expect(radio(lab, 'clock', 'manual')).toBeDisabled();

  // Static never animates, so the API paints it even here.
  await radio(lab, 'motion', 'static').check();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(1);
  await expect(radio(lab, 'clock', 'manual')).toBeEnabled();
  await radio(lab, 'motion', 'respect').check();
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab).toHaveAttribute('data-reason', 'reduced-motion');

  // A settings link can still ask for animation, but reduced motion wins.
  const linked = await openLab(page, `${FIRE}?clock=manual&time=2`, { active: false });
  await expect(linked).toHaveAttribute('data-reason', 'reduced-motion');
  await expect(code(linked)).toContainText('time: 2,');
  expect(errors).toEqual([]);
});

test('bad settings links fall back quietly', async ({ page }) => {
  const errors = watchErrors(page);
  const lab = await openLab(
    page,
    `${FIRE}?intensity=9&seed=abc&clock=later&time=2&motion=x&flameReach=-1&color=nope`,
  );
  await expect(code(lab)).toContainText('intensity: 0.8,');
  await expect(code(lab)).toContainText('seed: 314,');
  await expect(code(lab)).toContainText("clock: 'auto',");
  await expect(code(lab)).toContainText('flameReach: 0.2,');
  await expect(code(lab)).not.toContainText('time:');
  await expect(reset(lab)).toBeDisabled();
  expect(errors).toEqual([]);
});

test('settings survive a back/forward-cache restore', async ({ page }) => {
  const lab = await openLab(page, FIRE);
  await openTab(lab, 'shape');
  await lab.locator('[data-box-setting="intensity"]').fill('45');
  await lab.locator('[data-box-tab="shape"]').click();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  await expect(lab.locator('canvas')).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(lab.locator('canvas')).toHaveCount(1);
  await expect(code(lab)).toContainText('intensity: 0.45,');
  await expect(lab.locator('[data-box-tab="shape"]')).toHaveAttribute('aria-expanded', 'false');
  await openTab(lab, 'shape');
  await expect(lab.locator('[data-box-setting="intensity"]')).toHaveValue('45');
});

test('Spanish uses the glossary terms and API names stay literal', async ({ page }) => {
  await stubClipboard(page);
  const lab = await openLab(page, '/docs/es/api/effects/fire/');
  await expect(lab.locator('[data-box-tab]')).toHaveText(['Forma', 'Color', 'Tiempo', 'Código']);
  await lab.getByRole('button', { name: 'Forma', exact: true }).click();
  await expect(lab.locator('[data-box-view="shape"]')).toContainText('Elemento objetivo');
  await expect(lab.locator('[data-box-view="shape"]')).toContainText('intensity');
  await expect(lab.getByRole('radio', { name: 'Imagen', exact: true })).toBeChecked();
  await expect(lab.locator('[data-box-shuffle]')).toHaveText('Aleatorio');
  await lab.getByRole('button', { name: 'Color', exact: true }).click();
  await expect(lab.getByRole('radio', { name: 'Base y puntas', exact: true })).toBeVisible();
  await lab.getByRole('radio', { name: 'Un color', exact: true }).check();
  await expect(lab.locator('[data-box-unset="color"]')).toHaveText('Quitar');
  await expect(lab.locator('[data-box-unset="color"]')).toHaveAccessibleName('Quitar color');
  await lab.getByRole('button', { name: 'Tiempo', exact: true }).click();
  await lab.getByRole('radio', { name: 'Estática', exact: true }).check();
  await expect(lab.locator('[data-box-static-note]')).toContainText('un solo fotograma');
  await lab.getByRole('button', { name: 'Código', exact: true }).click();
  await expect(code(lab)).toContainText('// Al desmontar: effect.dispose();');
  await expect(code(lab)).toContainText("motion: 'static',");
  await lab.getByRole('button', { name: 'Copiar enlace', exact: true }).click();
  await expect(lab.locator('[data-box-toast]')).toHaveText('Enlace copiado');
  expect(new URL((await clipboard(page)) ?? '').pathname).toBe('/docs/es/api/effects/fire/');
  await expect(lab.getByRole('button', { name: 'Restablecer todo', exact: true })).toBeEnabled();
});

for (const path of ['/docs/standalone/', '/docs/es/standalone/']) {
  test(`${path} ships the box on its Fire preview`, async ({ page }) => {
    const lab = await openLab(page, path);
    await expect(lab.locator('[data-control-box]')).toHaveCount(1);
    await expect(lab.locator('[data-docs-preview]')).toBeVisible();
    await expect(lab.locator('[data-box-radio="target"]:checked')).toHaveValue('text');
  });
}

test('the GSAP lesson keeps its own controls', async ({ page }) => {
  await page.goto('/docs/gsap/');
  const lab = page.locator('[data-docs-gsap-lab]');
  await expect(lab.locator('[data-control-box]')).toHaveCount(0);
  await expect(lab.locator('.docs-preview-toolbar')).toBeAttached();
  await expect(lab.locator('[data-gsap-play]')).toBeAttached();
});

test('the label reads Target element, never Subject', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto(FIRE);
  const lab = page.locator('[data-docs-lab]');
  await expect(lab.locator('[data-box-view="shape"]')).toContainText('Target element');
  expect(await lab.textContent()).not.toContain('Subject');
  await context.close();
});
