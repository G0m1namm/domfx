import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { gsap } from 'gsap';
import sharp from 'sharp';
import { build } from 'vite';

import type { EffectHandle } from '@domfx/browser';
import * as browserEffects from '@domfx/browser';
import type { FireBinding } from '@domfx/gsap';

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
    disclosureClicks: number;
    disclosureGpu?: { vendor: string; architecture: string; device: string; description: string };
  }
}

const disclosures = {
  standalone: 'Standalone ambient attachment example',
  gsap: 'Full manual attachment and GSAP lifecycle example',
};

test('documentation is readable and navigable without JavaScript at mobile and desktop widths', async ({
  browser,
  baseURL,
}) => {
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/docs');
    await expect(page).toHaveURL(/\/docs\/introduction\/?$/);
    for (const [slug, title] of [
      ['introduction', 'Introduction'],
      ['installation', 'Installation'],
      ['standalone', 'Standalone'],
      ['gsap', 'GSAP'],
      ['upgrading', 'Upgrading'],
      ['api', 'API essentials'],
      ['support', 'Browser support'],
      ['troubleshooting', 'Troubleshooting'],
    ]) {
      await page.goto(`/docs/${slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      if (slug === 'api') {
        const documented = await page
          .getByRole('list', { name: 'Attachment functions' })
          .locator('code')
          .allTextContents();
        expect(documented.sort()).toEqual(
          Object.keys(browserEffects)
            .filter((name) => name.startsWith('attach'))
            .sort(),
        );
      }
      if (slug === 'standalone' || slug === 'gsap') {
        await expect(page.locator('[data-docs-fire-lab]')).toHaveCount(
          slug === 'standalone' ? 1 : 0,
        );
      }
      if (width <= 900) {
        await page.getByText('Browse documentation', { exact: false }).click();
      }
      await expect(
        page
          .getByRole('navigation', { name: 'Documentation', exact: true })
          .getByRole('link', { name: title, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator('canvas, #playground')).toHaveCount(0);
    }
    expect(
      requests.filter((url) =>
        /snapdom|typegpu|attachment-|browser\/dist|\/src\/scripts\//.test(url),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: `../../.scratch/web/${test.info().project.name}-docs-${width}.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test('documentation keyboard navigation reaches guides and scrolls code', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/docs/introduction');
  await page.getByText('Browse documentation', { exact: false }).focus();
  await page.keyboard.press('Enter');
  const link = page
    .getByRole('navigation', { name: 'Documentation', exact: true })
    .getByRole('link', { name: 'GSAP', exact: true });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/docs\/gsap\/?$/);
  const code = page.getByRole('region', { name: disclosures.gsap });
  await code.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => code.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('the Fire lab preserves its source content when WebGPU is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/docs/standalone');
  const lab = page.locator('[data-docs-fire-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'unavailable');
  await expect(lab.getByText('domfx', { exact: true })).toBeVisible();
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.getByRole('button', { name: 'Effects unavailable' })).toBeDisabled();
});

test('the Fire lab attaches, updates and disposes one real effect', async ({ page }) => {
  await page.goto('/docs/standalone');
  const lab = page.locator('[data-docs-fire-lab]');
  await lab.scrollIntoViewIfNeeded();
  const supportsGpu = await page.evaluate(() => 'gpu' in navigator && Boolean(navigator.gpu));
  test.skip(!supportsGpu, 'WebGPU is unavailable in this browser');
  await expect(lab).toHaveAttribute('data-status', 'active');
  const canvas = lab.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(canvas).toHaveCSS('pointer-events', 'none');
  expect(
    await lab.locator('[data-docs-fire-host]').evaluate((host) => getComputedStyle(host).overflow),
  ).toBe('visible');

  const intensity = lab.locator('[data-docs-intensity]');
  await intensity.fill('45');
  await expect(lab.locator('[data-docs-intensity-code]')).toHaveText('0.45');

  const height = lab.locator('[data-docs-height]');
  await height.fill('44');
  await height.press('Tab');
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(canvas).toHaveCount(1);

  const toggle = lab.locator('[data-docs-fire-toggle]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(lab).toHaveAttribute('data-status', 'paused');
  await toggle.click();
  await expect(lab).toHaveAttribute('data-status', 'active');

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(canvas).toHaveCount(0);
});

// Bundle the rendered code verbatim with only its caller-provided DOM and exports.
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
        load(id) {
          if (id !== '\0rendered-disclosure') {
            return;
          }
          return `const host = document.getElementById('disclosure-host');
const target = document.getElementById('disclosure-target');
${source}
export { fire${kind === 'gsap' ? ', timeline, binding, cleanup' : ''} };`;
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
      host.id = 'disclosure-host';
      host.style.cssText = 'position:relative;z-index:100;margin:128px;width:160px;';
      const target = document.createElement(heading ? 'h1' : 'button');
      target.id = 'disclosure-target';
      target.textContent = heading ? 'Your own heading' : 'Original button';
      target.style.cssText = heading
        ? 'margin:0;font:24px sans-serif;color:#C2C5DB;user-select:text'
        : 'width:160px;height:48px;background:#C2C5DB;color:#191920;';
      window.disclosureClicks = 0;
      target.addEventListener('click', () => {
        window.disclosureClicks += 1;
      });
      host.append(target);
      document.body.prepend(host);
    },
    kind === 'gsap' && path === '/docs/gsap',
  );
  await test.info().attach(`${kind}-rendered-source`, {
    body: source ?? '',
    contentType: 'text/plain',
  });
  return `/__disclosure/${entry?.fileName}`;
}

async function assertNativeTarget(page: Page, heading: boolean) {
  const target = page.locator('#disclosure-target');
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
    expect(await page.evaluate(() => window.disclosureClicks)).toBe(2);
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const links = new Set<string>();
  const resources = new Set<string>();
  const titles = new Set<string>();
  for (const path of [
    '/',
    '/effects/',
    '/docs/introduction',
    '/docs/installation',
    '/docs/standalone',
    '/docs/gsap',
    '/docs/upgrading',
    '/docs/api',
    '/docs/support',
    '/docs/troubleshooting',
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
  expect(local.has('/docs/standalone')).toBe(true);
  const repo = 'https://github.com/G0m1namm/domfx';
  expect(external.sort()).toEqual(
    [
      repo,
      'https://github.com/G0m1namm',
      'https://www.npmjs.com/package/@domfx/browser',
      `${repo}/blob/main/LICENSE`,
      `${repo}/blob/main/QUICKSTART.md`,
      `${repo}/blob/afcfd626eea273d7881048eb03b21973e10cce40/engineering/browser-support.md`,
    ].sort(),
  );
});

for (const { kind, path } of [
  { kind: 'standalone', path: '/docs/standalone' },
  { kind: 'gsap', path: '/docs/gsap' },
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
    const canvas = page.locator('#disclosure-host canvas');
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
    await assertNativeTarget(page, kind === 'gsap' && path === '/docs/gsap');
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
      await expect(page.locator('#disclosure-host canvas')).toHaveCount(0);
      await assertNativeTarget(page, kind === 'gsap' && path === '/docs/gsap');
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
    await expect(page.locator('#disclosure-host canvas')).toHaveCount(0);
    if (kind === 'gsap') {
      expect(await page.evaluate(() => window.disclosure.timeline?.isActive())).toBe(false);
    }
  });
}
