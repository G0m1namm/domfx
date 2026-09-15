import { expect, type Page, test, type TestInfo } from '@playwright/test';

import type {} from '../src/accessibility.js';

async function checkInput(page: Page, testInfo: TestInfo, phase: string) {
  await expect(page.getByRole('button', { name: 'Activate original', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Original link', exact: true })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Original input', exact: true })).toHaveCount(1);
  await expect(page.locator('#activate')).toHaveAccessibleDescription(
    'This button keeps its original handlers.',
  );
  const specimen = page.locator('#specimen');
  const accessible = await specimen.ariaSnapshot();
  const targetMarkup = await page.locator('#target').evaluate((element) => {
    const copy = element.cloneNode(true);
    if (!(copy instanceof HTMLElement)) {
      throw new Error('missing-target-copy');
    }
    // SnapDOM can leave empty inline-style attributes on form controls.
    // Compare all content/semantics and nonempty styles without that paint-neutral detail.
    for (const node of [copy, ...copy.querySelectorAll('[style]')]) {
      if (node.getAttribute('style') === '') {
        node.removeAttribute('style');
      }
    }
    return copy.outerHTML;
  });
  const before = await page.evaluate(() => window.accessibilityFixture.snapshot());
  expect(before).toMatchObject({
    originalTarget: true,
    originalButton: true,
    originalHandler: true,
  });

  await page.locator('#before').focus();
  const forward: string[] = [];
  for (const id of ['activate', 'link', 'editor', 'after']) {
    await page.keyboard.press('Tab');
    await expect(page.locator(`#${id}`)).toBeFocused();
    forward.push(await page.evaluate(() => document.activeElement?.id ?? ''));
  }
  const backward: string[] = [];
  for (const id of ['editor', 'link', 'activate', 'before']) {
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(`#${id}`)).toBeFocused();
    backward.push(await page.evaluate(() => document.activeElement?.id ?? ''));
  }
  await page.keyboard.press('Tab');
  const focus = await page.locator('#activate').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      outline: style.outline,
      offset: style.outlineOffset,
    };
  });
  expect(focus.visible).toBe(true);
  await testInfo.attach(`${phase}-focus.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  // Native keyboard input and an unforced pointer click must reach both caller handlers.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.locator('#activate').click();
  const after = await page.evaluate(() => window.accessibilityFixture.snapshot());
  const activations = {
    property: after.counts.property - before.counts.property,
    listener: after.counts.listener - before.counts.listener,
  };
  expect(activations).toEqual({ property: 3, listener: 3 });

  await page.evaluate(() => history.replaceState(null, '', location.pathname));
  await page.locator('#link').click();
  await expect(page).toHaveURL(/#destination$/);
  await page.evaluate(() => history.replaceState(null, '', location.pathname));
  await page.locator('#link').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#destination$/);

  await page.locator('#editor').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Typed text');
  await expect(page.locator('#editor')).toHaveValue('Typed text');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ArrowLeft');
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Shift+ArrowRight');
  }
  const inputSelection = await page
    .locator('#editor')
    .evaluate((element: HTMLInputElement) =>
      element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0),
    );
  expect(inputSelection).toBe('Typed');
  // Restore the input so later phases compare the same original content.
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Editable text');

  if (before.lifecycle === 'active') {
    // Editing changes captured paint. Test selection after replacement output is visible.
    await checkLayers(page, 1);
  }
  await page.locator('#selectable').scrollIntoViewIfNeeded();
  const bounds = await page.locator('#selectable').boundingBox();
  if (!bounds) {
    throw new Error('missing-selection-bounds');
  }
  await page.mouse.move(bounds.x + 1, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 1, bounds.y + bounds.height / 2, { steps: 20 });
  await page.mouse.up();
  const selection = await page.evaluate(() => {
    const selected = getSelection();
    const text = document.querySelector('#selectable');
    return {
      text: selected?.toString(),
      originalAnchor: !!selected?.anchorNode && !!text?.contains(selected.anchorNode),
      originalFocus: !!selected?.focusNode && !!text?.contains(selected.focusNode),
    };
  });
  expect(selection).toEqual({
    text: 'Select this original text.',
    originalAnchor: true,
    originalFocus: true,
  });
  await testInfo.attach(`${phase}-selection.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.evaluate(() => getSelection()?.removeAllRanges());

  const result = {
    accessible,
    targetMarkup,
    forward,
    backward,
    focus,
    activations,
    inputSelection,
    selection,
  };
  await testInfo.attach(`${phase}-input.json`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  return result;
}

async function checkLayers(page: Page, count: number) {
  const layers = page.locator('#host > canvas');
  await expect(layers).toHaveCount(count);
  await expect(page.locator('#target canvas')).toHaveCount(0);
  for (const layer of await layers.all()) {
    await expect(layer).toBeVisible();
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveCSS('pointer-events', 'none');
    expect(
      await layer.evaluate((canvas: HTMLCanvasElement) => ({
        tabIndex: canvas.tabIndex,
        text: canvas.textContent,
        role: canvas.getAttribute('role'),
      })),
    ).toEqual({ tabIndex: -1, text: '', role: null });
  }
}

for (const transition of [
  'borrowed-context',
  'owned-context',
  'reduced-motion',
  'dispose',
  'unavailable',
] as const) {
  test(`input and accessibility match the no-effect baseline through ${transition}`, async ({
    page,
    browser,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    if (transition === 'unavailable') {
      await page.addInitScript(() =>
        Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }),
      );
    }
    await page.goto('/accessibility.html');
    await expect(page.locator('#state')).toHaveText('No effect');
    await checkLayers(page, 0);
    const baseline = await checkInput(page, testInfo, 'baseline');
    await page.locator('#activate').focus();
    await page.evaluate(() => window.accessibilityFixture.attach());
    await expect(page.locator('#activate')).toBeFocused();
    const initial = transition === 'unavailable' ? 'unavailable' : 'active';
    expect(await page.evaluate(() => window.accessibilityFixture.snapshot().lifecycle)).toBe(
      initial,
    );
    await checkLayers(page, initial === 'active' ? 1 : 0);
    expect(await checkInput(page, testInfo, initial)).toEqual(baseline);

    await page.locator('#activate').focus();
    if (transition === 'reduced-motion') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    } else if (transition === 'borrowed-context' || transition === 'owned-context') {
      await page.evaluate(
        (owned) => window.accessibilityFixture.revert(owned),
        transition === 'owned-context',
      );
    } else if (transition === 'dispose') {
      await page.evaluate(() => window.accessibilityFixture.dispose());
    }
    const expected =
      transition === 'borrowed-context'
        ? 'active'
        : transition === 'reduced-motion'
          ? 'suspended'
          : transition === 'unavailable'
            ? 'unavailable'
            : 'disposed';
    await expect
      .poll(() => page.evaluate(() => window.accessibilityFixture.snapshot().lifecycle))
      .toBe(expected);
    await expect(page.locator('#state')).toContainText(`${expected}:`);
    await expect(page.locator('#activate')).toBeFocused();
    await checkLayers(page, expected === 'active' ? 1 : 0);
    expect(await checkInput(page, testInfo, transition)).toEqual(baseline);
    const environment = await page.evaluate(async () => {
      const adapter = (await navigator.gpu?.requestAdapter())?.info;
      return {
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        visibility: document.visibilityState,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        adapter: adapter
          ? {
              vendor: adapter.vendor,
              architecture: adapter.architecture,
              device: adapter.device,
              description: adapter.description,
            }
          : null,
        state: window.accessibilityFixture.snapshot(),
      };
    });
    await testInfo.attach('accessibility-environment.json', {
      body: JSON.stringify(
        {
          browser: browser.version(),
          project: testInfo.project.name,
          transition,
          environment,
          assistiveTechnology:
            'Not tested by automation; see engineering/accessibility-verification.md.',
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    await page.evaluate(() => window.accessibilityFixture.dispose());
    await page.evaluate(() => window.accessibilityFixture.revert(true));
    await checkLayers(page, 0);
    expect(errors).toEqual([]);
  });
}
