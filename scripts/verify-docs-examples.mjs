// Prepare registry consumers; run --browser <directory> under pnpm browser:run.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { examplesForLocale } from '../apps/docs/src/content/examples.ts';
import { publishedVersions } from '../packages/site/src/published-versions.ts';

const browserMode = process.argv[2] === '--browser';
const directory = browserMode
  ? resolve(process.argv[3])
  : mkdtempSync(join(tmpdir(), 'domfx-docs-consumers-'));
const reportPath = join(directory, 'report.json');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = browserMode
  ? readJson(reportPath)
  : {
      startedAt: new Date().toISOString(),
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      consumers: [],
    };
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

function run(cwd, name, args) {
  try {
    const output = execFileSync('pnpm', args, {
      cwd,
      encoding: 'utf8',
      timeout: 180_000,
      stdio: 'pipe',
    });
    writeFileSync(join(cwd, `${name}.log`), output);
  } catch (error) {
    writeFileSync(join(cwd, `${name}.log`), `${error.stdout}\n${error.stderr}`);
    throw new Error(`${name} failed: ${cwd}/${name}.log`, { cause: error });
  }
}

async function verifyBrowser(consumer, browser) {
  const cwd = consumer.directory;
  const { preview } = await import(
    pathToFileURL(join(cwd, 'node_modules/vite/dist/node/index.js')).href
  );
  const server = await preview({
    root: cwd,
    configFile: false,
    preview: { host: '127.0.0.1', port: 0 },
  });
  const page = await browser.newPage({
    viewport: { width: 1000, height: 700 },
    reducedMotion: 'no-preference',
  });
  const errors = [];
  const step = (name) => {
    consumer.step = name;
    save();
    console.log(`${consumer.locale}/${consumer.kind}: ${name}`);
  };
  const deadline = setTimeout(() => {
    void page.close();
  }, 120_000);
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}`;
    step('load');
    await page.goto(url);
    await page.waitForFunction(() => !!globalThis.docsExample?.fire);
    const initial = await page.evaluate(async () => {
      const { fire } = globalThis.docsExample;
      await fire.ready;
      return { lifecycle: fire.lifecycle, reason: fire.reason, detail: fire.reasonDetail };
    });
    consumer.environment = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter();
      return {
        userAgent: navigator.userAgent,
        dpr: devicePixelRatio,
        viewport: [innerWidth, innerHeight],
        adapter: adapter
          ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture }
          : null,
      };
    });
    consumer.initial = initial;
    save();
    assert.equal(initial.lifecycle, 'active', JSON.stringify(initial));
    step('interaction');
    await page.locator('#target').click();
    assert.equal(await page.locator('#clicks').textContent(), '1');
    if (consumer.kind === 'gsap') {
      const controls = await page.evaluate(() => {
        const { fire, timeline } = globalThis.docsExample;
        timeline.pause().seek(2.5, true);
        const forward = [fire.time, fire.intensity];
        timeline.seek(1.5, true);
        return { forward, backward: [fire.time, fire.intensity] };
      });
      assert.deepEqual(controls.forward, [2, 0.6]);
      assert.deepEqual(controls.backward, [1, 0.7]);
      await page.evaluate(() => {
        globalThis.docsExample.timeline.reverse();
      });
      await page.waitForFunction(() => globalThis.docsExample.fire.time < 0.9);
      await page.evaluate(() => {
        globalThis.docsExample.timeline.pause().seek(2.5);
      });
    } else {
      await page.waitForFunction(() => globalThis.docsExample.fire.time > 0.1);
      await page.evaluate(() => globalThis.docsExample.fire.pause());
    }
    const canvas = page.locator('#host canvas');
    await canvas.waitFor({ state: 'visible' });
    const visible = await page.locator('#host').screenshot({ path: join(cwd, 'effect.png') });
    const original = await page.locator('#host').screenshot({
      path: join(cwd, 'original.png'),
      style: '#host canvas { visibility: hidden !important; }',
    });
    assert.notDeepEqual(visible, original, 'effect changes visible pixels');
    await page.evaluate(() => {
      globalThis.docsExample.cleanup();
      globalThis.docsExample.cleanup();
    });
    assert.equal(await canvas.count(), 0);
    assert.equal(await page.locator('#host').evaluate((element) => element.style.opacity), '');
    await page.locator('#target').click();
    assert.equal(
      await page.locator('#clicks').textContent(),
      '1',
      'cleanup removes owned listener',
    );

    step('pending fonts');
    // Hold the real font boundary pending, then leave before attachment starts.
    await page.addInitScript(() => {
      globalThis.docsFontsReady = document.fonts.ready;
      Object.defineProperty(document.fonts, 'ready', {
        configurable: true,
        value: new Promise((resolveFonts) => {
          globalThis.releaseDocsFonts = resolveFonts;
        }),
      });
    });
    await page.goto(url);
    await page.waitForFunction(() => !!globalThis.docsExample);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.evaluate(async () => {
      await globalThis.docsFontsReady;
      globalThis.releaseDocsFonts();
    });
    assert.equal(
      await page.evaluate(() => globalThis.docsExample.fire === undefined),
      true,
      'no late attachment',
    );
    assert.equal(await canvas.count(), 0);

    step('pending attachment');
    // Fresh mount, then dispose while the attachment is still preparing.
    await page.goto(url);
    await page.waitForFunction(() => !!globalThis.docsExample);
    await page.evaluate(async () => {
      await globalThis.docsFontsReady;
      globalThis.releaseDocsFonts();
      await Promise.resolve();
      const fire = globalThis.docsExample.fire;
      if (!fire) {
        throw new Error('Expected attachment before cleanup');
      }
      globalThis.docsExample.cleanup();
      await fire.ready;
      if (fire.lifecycle !== 'disposed') {
        throw new Error('Pending attachment survived cleanup');
      }
    });
    assert.equal(await canvas.count(), 0);

    step('remount');
    await page.goto(url);
    await page.waitForFunction(() => !!globalThis.docsExample);
    await page.evaluate(async () => {
      await globalThis.docsFontsReady;
      globalThis.releaseDocsFonts();
    });
    await page.waitForFunction(() => globalThis.docsExample.fire?.lifecycle === 'active');
    await page.evaluate(() => globalThis.docsExample.cleanup());
    assert.equal(await canvas.count(), 0);

    step('fallbacks');
    for (const fallback of ['reduced-motion', 'no-webgpu']) {
      const fallbackPage = await browser.newPage({
        reducedMotion: fallback === 'reduced-motion' ? 'reduce' : 'no-preference',
      });
      try {
        if (fallback === 'no-webgpu') {
          await fallbackPage.addInitScript(() =>
            Object.defineProperty(navigator, 'gpu', { value: undefined }),
          );
        }
        await fallbackPage.goto(url);
        await fallbackPage.waitForFunction(() => !!globalThis.docsExample?.fire);
        const state = await fallbackPage.evaluate(async () => {
          const { fire } = globalThis.docsExample;
          await fire.ready;
          return { lifecycle: fire.lifecycle, reason: fire.reason };
        });
        assert.notEqual(state.lifecycle, 'active');
        assert.equal(state.reason, fallback);
        await fallbackPage.locator('#target').click();
        assert.equal(await fallbackPage.locator('#clicks').textContent(), '1');
        assert.equal(
          await fallbackPage
            .locator('#host')
            .evaluate((element) => getComputedStyle(element).opacity),
          '1',
        );
        await fallbackPage.evaluate(() => globalThis.docsExample.cleanup());
        consumer[fallback] = state;
      } finally {
        await fallbackPage.close();
      }
    }
    assert.deepEqual(errors, []);
    consumer.browser = browser.version();
    consumer.browserChecks =
      'PASS: rendered pixels, original click, automatic time or seek/reverse, cleanup, pending fonts, fresh mount/pending setup, both fallbacks';
  } finally {
    clearTimeout(deadline);
    await page.close();
    await new Promise((done) => server.httpServer.close(done));
  }
}

try {
  if (!browserMode) {
    for (const locale of ['en', 'es']) {
      const installation = readFileSync(
        new URL(
          `../apps/docs/src/content/docs/${locale === 'es' ? 'es/' : ''}installation.md`,
          import.meta.url,
        ),
        'utf8',
      )
        .replaceAll('%DOMFX_CORE_VERSION%', publishedVersions['@domfx/core'])
        .replaceAll('%DOMFX_BROWSER_VERSION%', publishedVersions['@domfx/browser']);
      const block = (language) =>
        installation.match(new RegExp('```' + language + '\\n([\\s\\S]*?)```'))[1];
      for (const kind of ['standalone', 'gsap']) {
        const cwd = join(directory, `${locale}-${kind}`);
        mkdirSync(cwd);
        const manifest = JSON.parse(block('json'));
        if (kind === 'gsap') {
          manifest.dependencies.gsap = '3.15.0';
        }
        writeFileSync(join(cwd, 'package.json'), JSON.stringify(manifest, null, 2));
        writeFileSync(join(cwd, 'pnpm-workspace.yaml'), block('yaml'));
        writeFileSync(join(cwd, 'index.html'), block('html'));
        const source = examplesForLocale(locale)[`${kind}Code`];
        writeFileSync(
          join(cwd, 'main.ts'),
          `${source}\n(globalThis as typeof globalThis & { docsExample: unknown }).docsExample = { get fire() { return fire; }, cleanup${kind === 'gsap' ? ', timeline' : ''} };\n`,
        );
        run(cwd, 'install', ['install', '--ignore-scripts']);
        const installed = {};
        for (const [name, version] of Object.entries(manifest.dependencies)) {
          const installedPath = realpathSync(join(cwd, 'node_modules', name));
          assert.ok(
            installedPath.startsWith(realpathSync(cwd) + '/'),
            'dependency must belong to the isolated consumer',
          );
          installed[name] = readJson(join(installedPath, 'package.json')).version;
          assert.equal(installed[name], version);
        }
        for (const mode of ['NodeNext', 'Bundler']) {
          run(cwd, `types-${mode}`, [
            'exec',
            'tsc',
            '--strict',
            '--noEmit',
            '--skipLibCheck',
            'false',
            '--target',
            'ES2022',
            '--module',
            mode === 'Bundler' ? 'ESNext' : 'NodeNext',
            '--moduleResolution',
            mode,
            '--lib',
            'ES2022,DOM,DOM.Iterable',
            'main.ts',
          ]);
        }
        run(cwd, 'build', ['build']);
        report.consumers.push({
          locale,
          kind,
          directory: cwd,
          installed,
          sourceSha256: hash(source),
          lockfileSha256: hash(readFileSync(join(cwd, 'pnpm-lock.yaml'))),
          preparation: 'PASS',
        });
        save();
      }
    }
  } else {
    assert.equal(report.consumers.length, 4);
    for (const consumer of report.consumers) {
      assert.equal(
        consumer.sourceSha256,
        hash(examplesForLocale(consumer.locale)[`${consumer.kind}Code`]),
        'prepare again after editing an example',
      );
    }
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: ['--enable-unsafe-webgpu'],
    });
    try {
      for (const consumer of report.consumers) {
        await verifyBrowser(consumer, browser);
        save();
      }
    } finally {
      await browser.close();
    }
  }
  delete report.error;
  report.outcome = browserMode ? 'PASS' : 'PREPARED';
} catch (error) {
  report.outcome = 'FAIL';
  report.error = String(error);
  throw error;
} finally {
  save();
  console.log(reportPath);
}
