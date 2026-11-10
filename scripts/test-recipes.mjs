// Build the documented React and Vue recipes against packed packages, then check
// mount, prop updates, unmount and remount in real Chrome. Run with pnpm test:recipes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { recipeConsumers } from './recipes.mjs';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'domfx-recipes-'));
const reportPath = join(directory, 'report.json');
const report = { startedAt: new Date().toISOString(), node: process.version, runs: [] };
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

function run(cwd, name, command, args, logs = cwd) {
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: 180_000,
      stdio: 'pipe',
    });
    writeFileSync(join(logs, `${name}.log`), output);
  } catch (error) {
    writeFileSync(join(logs, `${name}.log`), `${error.stdout}\n${error.stderr}`);
    throw new Error(`${name} failed: ${logs}/${name}.log`, { cause: error });
  }
}

const artifacts = join(directory, 'artifacts');
mkdirSync(artifacts);
function pack(cwd) {
  const { name, version } = readJson(join(cwd, 'package.json'));
  run(
    cwd,
    `pack-${version}-${name.replace('@domfx/', '')}`,
    'pnpm',
    ['--config.ignore-scripts=true', 'pack', '--pack-destination', artifacts],
    artifacts,
  );
  return join(artifacts, `${name.replace('@', '').replace('/', '-')}-${version}.tgz`);
}
const core = pack(join(root, 'packages/core'));
const browserPackage = pack(join(root, 'packages/domfx'));

function prepare(consumer) {
  const cwd = join(directory, consumer.framework);
  mkdirSync(cwd);
  cpSync(consumer.recipe, join(cwd, 'src'), { recursive: true });
  cpSync(consumer.harness, join(cwd, 'src'), {
    recursive: true,
    filter: (source) => !source.endsWith('vite.config.ts'),
  });
  cpSync(join(consumer.harness, 'vite.config.ts'), join(cwd, 'vite.config.ts'));
  writeFileSync(
    join(cwd, 'index.html'),
    `<!doctype html>\n<html lang="en">\n  <head><link rel="icon" href="data:," /></head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/${consumer.entry}"></script>\n  </body>\n</html>\n`,
  );
  writeJson(join(cwd, 'package.json'), {
    name: `domfx-recipe-${consumer.framework}`,
    private: true,
    type: 'module',
    dependencies: {
      '@domfx/browser': `file:${browserPackage}`,
      ...consumer.dependencies,
    },
    devDependencies: consumer.devDependencies,
  });
  writeFileSync(
    join(cwd, 'pnpm-workspace.yaml'),
    `overrides:\n  '@domfx/core': ${JSON.stringify(`file:${core}`)}\n`,
  );
  writeJson(join(cwd, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      jsx: 'react-jsx',
      skipLibCheck: false,
      isolatedModules: true,
    },
    include: ['src'],
  });
  run(cwd, 'install', 'pnpm', ['install', '--ignore-scripts']);
  run(cwd, 'types', 'pnpm', ['exec', consumer.typecheck, '--noEmit', '-p', 'tsconfig.json']);
  run(cwd, 'build', 'pnpm', ['exec', 'vite', 'build']);
  return cwd;
}

async function serve(cwd, mode) {
  const vite = await import(pathToFileURL(join(cwd, 'node_modules/vite/dist/node/index.js')).href);
  const options = { root: cwd, logLevel: 'error' };
  if (mode === 'production') {
    const server = await vite.preview({ ...options, preview: { host: '127.0.0.1', port: 0 } });
    return { url: server.resolvedUrls.local[0], close: () => server.close() };
  }
  const server = await vite.createServer({ ...options, server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

const frames = (page, count = 3) =>
  page.evaluate(
    (total) =>
      new Promise((done) => {
        let left = total;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    count,
  );

async function verify(browser, cwd, framework, mode) {
  const label = `${framework}-${mode}`;
  const server = await serve(cwd, mode);
  const page = await browser.newPage({
    viewport: { width: 800, height: 500 },
    reducedMotion: 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  const canvas = page.locator('.fire-host canvas');
  const marked = () => canvas.evaluate((element) => element.dataset.recipeMark === 'first');
  try {
    await page.goto(server.url);
    await canvas.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    assert.equal(await canvas.count(), 1, 'one effect after mount, including StrictMode');
    const effect = await page
      .locator('.fire-host')
      .screenshot({ path: join(directory, `${label}.png`) });
    const original = await page.locator('.fire-host').screenshot({
      style: '.fire-host canvas { visibility: hidden !important; }',
    });
    assert.notDeepEqual(effect, original, 'effect changes visible pixels');
    await page.locator('.fire-target').click();
    assert.equal(await page.locator('#clicks').textContent(), '1', 'target keeps interaction');

    await canvas.evaluate((element) => {
      element.dataset.recipeMark = 'first';
    });
    for (const control of ['intensity', 'color', 'tone']) {
      await page.locator(`#${control}`).click();
      await frames(page);
      assert.equal(await canvas.count(), 1, `${control} keeps one effect`);
      assert.equal(await marked(), true, `${control} updates the live effect`);
    }

    await page.locator('#reach').click();
    await page.waitForFunction(() => {
      const canvases = document.querySelectorAll('.fire-host canvas');
      return canvases.length === 1 && !canvases[0].dataset.recipeMark;
    });

    await page.locator('#toggle').click();
    await frames(page);
    assert.equal(await page.locator('.fire-host').count(), 0);
    assert.equal(await canvas.count(), 0, 'unmount disposes the effect');
    await page.locator('#toggle').click();
    await canvas.waitFor({ state: 'visible' });
    assert.equal(await canvas.count(), 1, 'remount attaches a fresh effect');

    // Unmount while fonts are pending: no late attachment.
    await page.addInitScript(() => {
      const fonts = document.fonts.ready;
      Object.defineProperty(document.fonts, 'ready', {
        configurable: true,
        value: new Promise((release) => {
          globalThis.releaseRecipeFonts = () => fonts.then(release);
        }),
      });
    });
    await page.goto(server.url);
    await page.locator('.fire-target').waitFor();
    await page.locator('#toggle').click();
    await page.evaluate(() => globalThis.releaseRecipeFonts());
    await frames(page, 10);
    assert.equal(await canvas.count(), 0, 'no effect after unmount during setup');

    assert.deepEqual(errors, []);
    report.runs.push({ framework, mode, outcome: 'PASS', browser: browser.version() });
    console.log(`${label}: PASS`);
  } finally {
    await page.close();
    await server.close();
  }
}

try {
  const prepared = recipeConsumers(root).map((consumer) => ({
    ...consumer,
    cwd: prepare(consumer),
  }));
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--enable-unsafe-webgpu'],
  });
  try {
    for (const { cwd, framework } of prepared) {
      for (const mode of ['development', 'production']) {
        await verify(browser, cwd, framework, mode);
        save();
      }
    }
  } finally {
    await browser.close();
  }
  report.outcome = 'PASS';
} catch (error) {
  report.outcome = 'FAIL';
  report.error = String(error);
  throw error;
} finally {
  save();
  console.log(reportPath);
}
