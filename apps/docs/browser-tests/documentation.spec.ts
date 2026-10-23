import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { gsap } from 'gsap';
import sharp from 'sharp';
import { build, transformWithEsbuild } from 'vite';

import type { EffectHandle } from '@domfx/browser';
import * as browserEffects from '@domfx/browser';
import type { FireBinding } from '@domfx/gsap';
import { effects } from '@domfx/site/effects';

type TestGpu = {
  requestAdapter(options?: unknown): Promise<{
    info: {
      vendor: string;
      architecture: string;
      device: string;
      description: string;
    };
  } | null>;
};

declare global {
  interface Window {
    disclosure: {
      fire: EffectHandle;
      timeline?: ReturnType<typeof gsap.timeline>;
      binding?: FireBinding;
      cleanup?: () => void;
    };
    disclosureReady: Promise<void>;
    releaseDisclosureGpu?: () => void;
    disclosureGpu?: { vendor: string; architecture: string; device: string; description: string };
  }
}

const disclosures = {
  standalone: 'Standalone automatic animation example',
  gsap: 'Full manual attachment and GSAP lifecycle example',
};

test('@smoke documentation is readable and navigable without JavaScript at mobile and desktop widths', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/docs/');
    await expect(page).toHaveURL(/\/docs\/introduction\/$/);
    for (const [slug, title] of [
      ['introduction', 'Introduction'],
      ['installation', 'Installation'],
      ['standalone', 'Standalone'],
      ['gsap', 'GSAP'],
      ['upgrading', 'Upgrading'],
      ['api', 'API reference'],
      ['support', 'Browser support'],
      ['troubleshooting', 'Troubleshooting'],
    ]) {
      await page.goto(`/docs/${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      if (slug === 'api') {
        const documented = await page
          .getByRole('table', { name: 'Attachment functions', exact: true })
          .locator('code')
          .allTextContents();
        expect(documented.sort()).toEqual(
          Object.keys(browserEffects)
            .filter((name) => name.startsWith('attach'))
            .sort(),
        );
      }
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(
        page.getByRole('banner').getByRole('link', { name: 'domfx home', exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator('canvas')).toHaveCount(0);
      if (width < 800) {
        await page.getByRole('button', { name: 'Docs', exact: true }).click();
      }
      await expect(page.locator('a[aria-current="page"]', { hasText: title })).toHaveCount(1);
    }
    await context.close();
  }
});

test('@smoke the native mobile docs drawer supports keyboard focus without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 360, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/docs/introduction/');
  const button = page.getByRole('button', { name: 'Docs', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  const navigation = page.getByRole('navigation', { name: 'Documentation', exact: true });
  await expect(navigation.getByRole('link', { name: 'Introduction', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation.getByRole('link', { name: 'Introduction', exact: true })).toBeHidden();
  await expect(button).toBeFocused();
  await context.close();
});

test('@smoke the mobile docs drawer keeps footer and back-to-top links outside its focus scope', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/docs/troubleshooting/');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const backToTop = page.getByRole('link', {
    name: 'Back to top',
    exact: true,
    includeHidden: true,
  });
  const footerHome = page.getByRole('contentinfo', { includeHidden: true }).getByRole('link', {
    name: 'domfx',
    exact: true,
    includeHidden: true,
  });
  await expect(backToTop).toBeVisible();
  const button = page.getByRole('button', { name: 'Docs', exact: true });
  await button.click();
  await expect(page.getByRole('link', { name: 'Troubleshooting', exact: true })).toBeVisible();
  await footerHome.focus();
  await expect(footerHome).not.toBeFocused();
  await backToTop.focus();
  await expect(backToTop).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Troubleshooting', exact: true })).toBeHidden();
  await expect
    .poll(async () => {
      await footerHome.focus();
      return footerHome.evaluate((link) => link === document.activeElement);
    })
    .toBe(true);
  await backToTop.focus();
  await expect(backToTop).toBeFocused();
});

test('@smoke all catalog references retain their public options and usable source content without JavaScript', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    for (const effect of effects) {
      await page.goto(`/docs/api/effects/${effect.id}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(effect.name);
      await expect(
        page.getByRole('region', { name: `${effect.name} usage`, exact: true }),
      ).toContainText(`import { ${effect.exportName} } from '@domfx/browser'`);
      await expect(
        page.getByRole('table', { name: 'Shared creation options', exact: true }),
      ).toContainText("'manual' | 'auto' | 'ambient'");
      await expect(
        page.getByRole('table', { name: 'Writable effect controls', exact: true }),
      ).toContainText('intensity');
      const lab = page.locator('[data-docs-lab]');
      await expect(lab.locator('[data-docs-lab-target]:visible')).toHaveCount(1);
      await expect(lab.getByRole('slider', { name: `${effect.name} intensity` })).toBeDisabled();
      await expect(page.locator('canvas')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await context.close();
  }
});

test('@smoke keyboard users can scroll code and API tables, and follow page sections', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/docs/gsap/');
  const code = page.getByRole('region', { name: disclosures.gsap });
  await code.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => code.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.goto('/docs/api/shared/');
  const options = page.getByRole('region', { name: 'Shared creation options', exact: true });
  await options.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => options.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/docs/standalone/');
  await page
    .getByRole('navigation', { name: 'On this page', exact: true })
    .getByRole('link', { name: 'Refresh and cleanup' })
    .click();
  await expect(page).toHaveURL(/#refresh-and-cleanup$/);
});

test('@smoke docs retain edit, issue, pagination and shared footer actions', async ({ page }) => {
  await page.goto('/docs/api/effects/frost/');
  const feedback = page.getByRole('navigation', { name: 'Page feedback' });
  await expect(feedback.getByRole('link', { name: 'Edit page' })).toHaveAttribute(
    'href',
    'https://github.com/G0m1namm/domfx/edit/main/apps/docs/src/pages/api/effects/%5Beffect%5D.astro',
  );
  const issue = new URL(
    (await feedback.getByRole('link', { name: 'Report an issue' }).getAttribute('href')) ?? '',
  );
  expect(issue.searchParams.get('title')).toBe('Docs: Frost');
  expect(issue.searchParams.get('body')).toContain('Page: /docs/api/effects/frost/');
  for (const [group, link] of [
    ['Build', 'API reference'],
    ['Explore', 'All effects'],
    ['domfx', 'npm'],
  ] as const) {
    await expect(
      page
        .getByRole('contentinfo')
        .getByRole('navigation', { name: `Footer ${group}` })
        .getByRole('link', { name: link }),
    ).toBeVisible();
  }
});

test('@smoke docs search uses Pagefind from the shared header and opens an effect reference', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/docs/installation/');
  const trigger = page.getByRole('button', {
    name: 'Search effects and documentation',
    exact: true,
  });
  await expect(trigger).toHaveAttribute('title', 'Search effects and docs (⌘K / Ctrl+K)');
  expect(await trigger.evaluate((element) => element.getBoundingClientRect().width)).toBe(44);
  await trigger.click();
  const search = page.getByRole('dialog', { name: 'Search effects and documentation' });
  const input = search.getByRole('textbox');
  await expect(input).toBeVisible();
  await input.fill('frost');
  const frost = search.getByRole('link', { name: 'Frost', exact: true }).first();
  await expect(frost).toHaveAttribute('href', '/docs/api/effects/frost/');
  await frost.click();
  await expect(page).toHaveURL(/\/docs\/api\/effects\/frost\/$/);
  // URL navigation can finish before Starlight registers the new page's shortcut.
  await expect(trigger).toBeEnabled();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(
    page.getByRole('dialog', { name: 'Search effects and documentation' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Search effects and documentation', exact: true }),
  ).toBeFocused();
});

test('@smoke component API sections appear in the page table of contents', async ({ page }) => {
  await page.goto('/docs/api/effect-handle/');
  const toc = page.getByRole('navigation', { name: 'On this page', exact: true });
  await toc.getByRole('link', { name: 'Methods', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Methods', exact: true })).toBeInViewport();
  await expect(page.getByRole('table', { name: 'Effect methods', exact: true })).toBeVisible();
});

test('@smoke back to top appears after scrolling and returns focus to the title', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/docs/troubleshooting/');
  const button = page.getByRole('link', { name: 'Back to top', exact: true });
  await expect(button).toBeHidden();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

const labPages = [
  { path: '/docs/standalone/', effect: 'Fire', text: true },
  { path: '/docs/api/effects/frost/', effect: 'Frost', text: false },
] as const;

for (const { path, effect, text } of labPages) {
  test(`@smoke ${path} preview preserves its source content when WebGPU is unavailable`, async ({
    page,
  }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.goto(path);
    const lab = page.locator('[data-docs-lab]');
    await lab.scrollIntoViewIfNeeded();
    await expect(lab).toHaveAttribute('data-status', 'unavailable');
    if (text) {
      await expect(lab.getByText('domfx', { exact: true })).toBeVisible();
    }
    await expect(lab.locator('[data-docs-lab-target]:visible')).toHaveCount(1);
    await expect(lab.locator('canvas')).toHaveCount(0);
    await expect(lab.getByRole('button', { name: 'Effects unavailable' })).toBeDisabled();
    await expect(lab.getByRole('slider', { name: `${effect} intensity` })).toBeDisabled();
  });

  test(`${path} preview attaches, updates and disposes one real effect`, async ({ page }) => {
    await page.goto(path);
    const lab = page.locator('[data-docs-lab]');
    await lab.scrollIntoViewIfNeeded();
    const supportsGpu = await page.evaluate(() => 'gpu' in navigator && Boolean(navigator.gpu));
    test.skip(!supportsGpu, 'WebGPU is unavailable in this browser');
    await expect(lab).toHaveAttribute('data-status', 'active');
    const canvas = lab.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas).toHaveCSS('pointer-events', 'none');
    expect(
      await lab.locator('[data-docs-lab-host]').evaluate((host) => getComputedStyle(host).overflow),
    ).toBe('visible');

    const intensity = lab.locator('[data-docs-lab-intensity]');
    await intensity.fill('45');
    await expect(lab.locator('[data-docs-lab-intensity-code]')).toHaveText('0.45');
    await expect(lab.locator('[data-docs-lab-intensity-output]')).toHaveText('45%');

    if (effect === 'Fire') {
      const height = lab.locator('[data-docs-lab-height]');
      await height.fill('44');
      await height.press('Tab');
      await expect(lab.locator('[data-docs-lab-height-code]')).toHaveText('44');
      await expect(lab).toHaveAttribute('data-status', 'active');
      await expect(canvas).toHaveCount(1);
    }

    for (const subject of ['SVG', 'Image', 'Text']) {
      await lab.getByRole('radio', { name: subject, exact: true }).check();
      await expect(lab).toHaveAttribute('data-status', 'active');
      await expect(lab.locator('[data-docs-lab-target]:visible')).toHaveCount(1);
      await expect(canvas).toHaveCount(1);
    }

    const toggle = lab.locator('[data-docs-lab-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAccessibleName('Resume effect');
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab).toHaveAttribute('data-paused', 'true');
    await toggle.click();
    await expect(lab).toHaveAttribute('data-status', 'active');
    await expect(lab).toHaveAttribute('data-paused', 'false');

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(canvas).toHaveCount(0);
  });
}

test('the docs lab restarts after pagehide and persisted pageshow', async ({ page }) => {
  await page.goto('/docs/standalone/');
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  });
  await expect(lab.locator('canvas')).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(lab.locator('canvas')).toHaveCount(1);
  const intensity = lab.locator('[data-docs-lab-intensity]');
  await intensity.fill('45');
  await expect(lab.locator('[data-docs-lab-intensity-code]')).toHaveText('0.45');
});

test('the docs lab preserves pause and requires Start after reduced-motion recovery', async ({
  page,
}) => {
  await page.goto('/docs/standalone/');
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await lab.getByRole('button', { name: 'Pause effect', exact: true }).click();
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await expect(lab.locator('canvas')).toHaveCount(0);
  await setHidden(false);
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await expect(lab.getByRole('button', { name: 'Resume effect', exact: true })).toBeVisible();
  await expect(lab.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(lab.locator('canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await setHidden(true);
  await setHidden(false);
  await expect(lab).toHaveAttribute('data-status', 'unavailable');
  await expect(lab).toHaveAttribute('data-reason', 'reduced-motion');
  await expect(lab.locator('canvas')).toHaveCount(0);
  await lab.getByRole('button', { name: 'Start effect', exact: true }).click();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(1);
});

test('the docs lab works after an actual back/forward-cache restore', async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener('pageshow', (event) => {
      document.documentElement.dataset.testPersisted = String(event.persisted);
    });
  });
  await page.goto('/docs/standalone/');
  await page.locator('[data-docs-lab]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-docs-lab]')).toHaveAttribute('data-status', 'active');
  await page.goto('/docs/installation/');
  await page.goBack({ waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-test-persisted', 'true');
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await lab.locator('[data-docs-lab-intensity]').fill('45');
  await expect(lab.locator('[data-docs-lab-intensity-code]')).toHaveText('0.45');
  await expect(lab.locator('canvas')).toHaveCount(1);
});

// Compile the rendered TypeScript verbatim, appending only readiness waits and exports.
// No copied example, package alias, capture mock or renderer transform is involved.
async function loadDisclosure(page: Page, kind: keyof typeof disclosures, path: string) {
  await page.addInitScript(() => sessionStorage.setItem('domfx-playback', 'off'));
  await page.goto(path);
  const source = await page
    .getByRole('region', { name: disclosures[kind], includeHidden: true })
    .locator('code')
    .textContent();
  expect(source).toBeTruthy();
  const result = await build({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    logLevel: 'error',
    plugins: [
      {
        name: 'rendered-disclosure',
        resolveId(id) {
          if (id === 'rendered-disclosure') {
            return '\0rendered-disclosure';
          }
        },
        async load(id) {
          if (id !== '\0rendered-disclosure') {
            return;
          }
          const transformed = await transformWithEsbuild(
            `${source}
await document.fonts.ready;
if (!fire) { throw new Error('The rendered example did not create an effect'); }
await fire.ready;
export { fire, cleanup${kind === 'gsap' ? ', timeline' : ''} };`,
            'rendered-disclosure.ts',
            { loader: 'ts', target: 'esnext' },
          );
          return transformed.code;
        },
      },
    ],
    build: {
      write: false,
      target: 'esnext',
      rollupOptions: { input: 'rendered-disclosure', preserveEntrySignatures: 'strict' },
    },
  });
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('Expected one disclosure bundle');
  }
  const entry = result.output.find((chunk) => chunk.type === 'chunk' && chunk.isEntry);
  expect(entry).toBeTruthy();
  await page.route('**/__disclosure/**', async (route) => {
    const name = new URL(route.request().url()).pathname.slice('/__disclosure/'.length);
    const chunk = result.output.find((output) => output.fileName === name);
    if (!chunk) {
      throw new Error(`Missing disclosure asset: ${name}`);
    }
    await route.fulfill({
      contentType: 'application/javascript',
      body: chunk.type === 'chunk' ? chunk.code : Buffer.from(chunk.source),
    });
  });
  await page.evaluate(
    (heading) => {
      const gpu = (navigator as Navigator & { gpu?: TestGpu }).gpu;
      if (gpu) {
        const requestAdapter = gpu.requestAdapter.bind(gpu);
        gpu.requestAdapter = async (options) => {
          const adapter = await requestAdapter(options);
          if (adapter) {
            window.disclosureGpu = {
              vendor: adapter.info.vendor,
              architecture: adapter.info.architecture,
              device: adapter.info.device,
              description: adapter.info.description,
            };
          }
          return adapter;
        };
      }
      const host = document.createElement('div');
      host.id = 'host';
      host.style.cssText = 'position:relative;z-index:100;margin:128px;width:160px;';
      const target = document.createElement(heading ? 'h1' : 'button');
      target.id = 'target';
      target.textContent = heading ? 'Your own heading' : 'Original button';
      target.style.cssText = heading
        ? 'margin:0;font:24px sans-serif;color:#C2C5DB;user-select:text'
        : 'width:160px;height:48px;background:#C2C5DB;color:#191920;';
      const clicks = document.createElement('output');
      clicks.id = 'clicks';
      clicks.textContent = '0';
      host.append(target);
      document.body.prepend(host, clicks);
    },
    kind === 'gsap' && path === '/docs/gsap/',
  );
  await test.info().attach(`${kind}-rendered-source`, {
    body: source ?? '',
    contentType: 'text/plain',
  });
  return `/__disclosure/${entry?.fileName}`;
}

async function assertNativeTarget(page: Page, heading: boolean) {
  const target = page.locator('#target');
  if (heading) {
    const text = await target.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getClientRects()[0];
      return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(text.left + 1, text.y);
    await page.mouse.down();
    await page.mouse.move(text.right - 1, text.y, { steps: 10 });
    await page.mouse.up();
    expect(await page.evaluate(() => getSelection()?.toString().length)).toBeGreaterThan(0);
    expect(await target.evaluate((element) => element.tagName)).toBe('H1');
  } else {
    await target.click();
    await target.press('Enter');
    await expect(page.locator('#clicks')).toHaveText('2');
  }
}

async function startDisclosure(page: Page, url: string) {
  await page.evaluate((moduleUrl) => {
    window.disclosureReady = import(moduleUrl).then((module) => {
      window.disclosure = module;
    });
    // Retain import failures for the assertion without an unhandled rejection.
    void window.disclosureReady.catch(() => {});
  }, url);
}

test('every website link resolves to a native route, anchor or documented repository resource', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const links = new Set<string>();
  const resources = new Set<string>();
  const titles = new Set<string>();
  for (const path of [
    '/',
    '/effects/',
    '/docs/introduction/',
    '/docs/installation/',
    '/docs/standalone/',
    '/docs/gsap/',
    '/docs/upgrading/',
    '/docs/api/',
    '/docs/api/shared/',
    '/docs/api/effect-handle/',
    '/docs/api/effects/',
    '/docs/api/gsap/',
    ...effects.map((effect) => `/docs/api/effects/${effect.id}/`),
    '/docs/support/',
    '/docs/troubleshooting/',
  ]) {
    await page.goto(path);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(title.trim(), `${path} title`).toBeTruthy();
    expect(titles.has(title), `${path} title is unique`).toBe(false);
    expect(description?.trim(), `${path} description`).toBeTruthy();
    titles.add(title);
    for (const href of await page
      .locator('a[href]')
      .evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href))) {
      links.add(href);
    }
    for (const resource of await page
      .locator('[src], [srcset], link[href], meta[property="og:image"][content]')
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const urls = [
            element.getAttribute('src'),
            element.getAttribute('href'),
            element.getAttribute('content'),
            element
              .getAttribute('srcset')
              ?.split(',')
              .map((candidate) => candidate.trim().split(/\s+/, 1)[0]),
          ];
          return urls.flat().filter((url): url is string => Boolean(url));
        }),
      )) {
      resources.add(new URL(resource, page.url()).href);
    }
  }
  const origin = new URL(page.url()).origin;
  const external: string[] = [];
  const local = new Map<string, Set<string>>();
  for (const href of links) {
    const url = new URL(href);
    if (url.origin !== origin) {
      external.push(href);
      continue;
    }
    const fragments = local.get(url.pathname) ?? new Set<string>();
    if (url.hash) {
      fragments.add(decodeURIComponent(url.hash.slice(1)));
    }
    local.set(url.pathname, fragments);
  }
  for (const [path, fragments] of local) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    if (fragments.size) {
      await page.goto(path);
      for (const fragment of fragments) {
        expect(await page.locator(`[id="${fragment}"]`).count(), `${path}#${fragment}`).toBe(1);
      }
    }
  }
  for (const resource of resources) {
    const url = new URL(resource);
    if (url.origin !== origin) {
      continue;
    }
    const response = await request.get(url.href);
    expect(response.ok(), `built resource ${url.pathname}`).toBe(true);
    if (url.pathname.endsWith('.css')) {
      const css = await response.text();
      for (const [, , reference] of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
        const asset = new URL(reference.trim(), url);
        if (asset.origin === origin) {
          resources.add(asset.href);
        }
      }
    }
  }
  expect(local.has('/docs/standalone/')).toBe(true);
  const repo = 'https://github.com/G0m1namm/domfx';
  const edits = external.filter((href) => href.startsWith(`${repo}/edit/main/`));
  const issues = external.filter((href) => href.startsWith(`${repo}/issues/new?`));
  expect(edits.length).toBeGreaterThan(0);
  for (const href of edits) {
    const source = decodeURI(href.slice(`${repo}/edit/main/`.length));
    expect(existsSync(new URL(`../../../${source}`, import.meta.url)), href).toBe(true);
  }
  for (const href of issues) {
    const query = new URL(href).searchParams;
    expect(query.get('title'), href).toMatch(/^Docs: \S/);
    expect(query.get('body'), href).toMatch(/^Page: \/docs\/\S/);
  }
  expect(external.filter((href) => !edits.includes(href) && !issues.includes(href)).sort()).toEqual(
    [
      repo,
      'https://github.com/G0m1namm',
      'https://www.npmjs.com/package/@domfx/browser',
      `${repo}/blob/main/LICENSE`,
      `${repo}/blob/main/SECURITY.md`,
      `${repo}/issues`,
      `${repo}/blob/afcfd626eea273d7881048eb03b21973e10cce40/engineering/browser-support.md`,
    ].sort(),
  );
});

for (const { kind, path } of [
  { kind: 'standalone', path: '/docs/standalone/' },
  { kind: 'gsap', path: '/docs/gsap/' },
] as const) {
  test(`${path} ${kind} rendered disclosure runs on real GPU output and cleans up`, async ({
    page,
    browser,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = await loadDisclosure(page, kind, path);
    await startDisclosure(page, url);
    await page.evaluate(() => window.disclosureReady);
    if (kind === 'gsap') {
      await expect
        .poll(() => page.evaluate(() => window.disclosure.timeline?.time()))
        .toBeGreaterThan(0.1);
    }
    await expect.poll(() => page.evaluate(() => window.disclosure.fire.lifecycle)).toBe('active');
    const canvas = page.locator('#host canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas).toHaveCSS('pointer-events', 'none');
    if (kind === 'gsap') {
      await page.evaluate(() => {
        window.disclosure.timeline?.pause().seek(2.5);
      });
      expect(await page.evaluate(() => window.disclosure.fire.time)).toBeCloseTo(2);
      expect(await page.evaluate(() => window.disclosure.fire.intensity)).toBeCloseTo(0.6);
      await page.evaluate(() => {
        window.disclosure.timeline?.seek(1.5);
      });
      expect(await page.evaluate(() => window.disclosure.fire.time)).toBeCloseTo(1);
      expect(await page.evaluate(() => window.disclosure.fire.intensity)).toBeCloseTo(0.7);
      await page.evaluate(() => {
        window.disclosure.timeline?.reverse();
      });
      await expect.poll(() => page.evaluate(() => window.disclosure.fire.time)).toBeLessThan(0.9);
      await page.evaluate(() => {
        window.disclosure.timeline?.pause().seek(1.5);
      });
    } else {
      const time = await page.evaluate(() => window.disclosure.fire.time);
      await expect
        .poll(() => page.evaluate(() => window.disclosure.fire.time))
        .toBeGreaterThan(time);
      await page.evaluate(() => window.disclosure.fire.pause());
    }
    const intensity = await page.evaluate(() => window.disclosure.fire.intensity);
    await page.evaluate(() => {
      window.disclosure.fire.intensity = 0;
    });
    const baseline = await sharp(await canvas.screenshot())
      .raw()
      .toBuffer();
    await page.evaluate((value) => {
      window.disclosure.fire.intensity = value;
    }, intensity);
    await expect
      .poll(async () => {
        const pixels = await sharp(await canvas.screenshot())
          .raw()
          .toBuffer();
        return pixels.some((value, index) => Math.abs(value - baseline[index]) > 2);
      })
      .toBe(true);
    await assertNativeTarget(page, kind === 'gsap' && path === '/docs/gsap/');
    await test.info().attach(`${kind}-environment`, {
      contentType: 'application/json',
      body: JSON.stringify({
        browser: browser.version(),
        ...(await page.evaluate(() => ({
          userAgent: navigator.userAgent,
          dpr: devicePixelRatio,
          viewport: { width: innerWidth, height: innerHeight },
          lifecycle: window.disclosure.fire.lifecycle,
          clock: window.disclosure.fire.clock,
          gpu: window.disclosureGpu,
        }))),
      }),
    });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(canvas).toHaveCount(0);
    expect(await page.evaluate(() => window.disclosure.fire.lifecycle)).toBe('disposed');
    if (kind === 'gsap') {
      expect(await page.evaluate(() => window.disclosure.timeline?.isActive())).toBe(false);
      await page.evaluate(() => window.disclosure.cleanup?.());
    }
    expect(errors).toEqual([]);
  });

  for (const unavailable of ['reduced-motion', 'no-webgpu'] as const) {
    test(`${path} ${kind} rendered disclosure preserves interaction with ${unavailable}`, async ({
      page,
    }) => {
      if (unavailable === 'reduced-motion') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
      } else {
        await page.addInitScript(() =>
          Object.defineProperty(navigator, 'gpu', { value: undefined }),
        );
      }
      const url = await loadDisclosure(page, kind, path);
      await startDisclosure(page, url);
      await page.evaluate(() => window.disclosureReady);
      expect(await page.evaluate(() => window.disclosure.fire.reason)).toBe(unavailable);
      await expect(page.locator('#host canvas')).toHaveCount(0);
      await assertNativeTarget(page, kind === 'gsap' && path === '/docs/gsap/');
      if (kind === 'gsap') {
        expect(await page.evaluate(() => window.disclosure.timeline?.paused())).toBe(true);
      }
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
      expect(await page.evaluate(() => window.disclosure.fire.lifecycle)).toBe('disposed');
    });
  }

  test(`${path} ${kind} rendered disclosure tears down before GPU readiness`, async ({ page }) => {
    const url = await loadDisclosure(page, kind, path);
    await page.evaluate(() => {
      const gpu = (navigator as Navigator & { gpu: TestGpu }).gpu;
      const requestAdapter = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (options) => {
        await new Promise<void>((resolve) => {
          window.releaseDisclosureGpu = resolve;
        });
        return requestAdapter(options);
      };
    });
    await startDisclosure(page, url);
    await expect.poll(() => page.evaluate(() => Boolean(window.releaseDisclosureGpu))).toBe(true);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      window.releaseDisclosureGpu?.();
    });
    await page.evaluate(() => window.disclosureReady);
    expect(await page.evaluate(() => window.disclosure.fire.lifecycle)).toBe('disposed');
    await expect(page.locator('#host canvas')).toHaveCount(0);
    if (kind === 'gsap') {
      expect(await page.evaluate(() => window.disclosure.timeline?.isActive())).toBe(false);
    }
  });
}
