import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from 'playwright';
import { preview } from 'vite';

const root = resolve(import.meta.dirname, '../../..');
const lab = resolve(root, 'apps/lab');
const directory = resolve(
  root,
  '.scratch/browser-regression',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(directory, { recursive: true });
const result = {
  outcome: 'FAIL',
  injectedFailure: process.argv.includes('--inject-failure'),
  artifacts: [],
  errors: [],
};
let browser;
let server;
let page;
let exitCode = 1;

// Timings are diagnostic observations, never inputs to pixel/assertion comparisons.
function separateTimings(value, path = '', timings = {}) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  const checks = Array.isArray(value) ? [] : {};
  for (const [key, child] of Object.entries(value)) {
    const name = path ? `${path}.${key}` : key;
    if (key.endsWith('Ms') || key === 'warmMeasurements') {
      timings[name] = child;
    } else {
      checks[key] = separateTimings(child, name, timings);
    }
  }
  return checks;
}

try {
  result.source = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirty: Boolean(
      execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    ),
    lockfileSha256: createHash('sha256')
      .update(await readFile(resolve(root, 'pnpm-lock.yaml')))
      .digest('hex'),
  };
  result.dependencies = JSON.parse(
    execFileSync('pnpm', ['list', '-r', '--depth', '0', '--json'], { cwd: root, encoding: 'utf8' }),
  );
  result.runtime = { node: process.version, platform: process.platform, arch: process.arch };
  for (const command of ['test', 'build:demo']) {
    const run = spawnSync('pnpm', [command], { cwd: root, encoding: 'utf8' });
    await writeFile(
      resolve(directory, `${command.replace(':', '-')}.log`),
      `${run.stdout ?? ''}${run.stderr ?? ''}`,
    );
    if (run.status !== 0) {
      throw new Error(`${command} failed: ${run.error ?? run.status}`);
    }
  }
  const buildHash = createHash('sha256');
  for (const file of (await readdir(resolve(lab, 'dist'), { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .sort((a, b) => `${a.parentPath}/${a.name}`.localeCompare(`${b.parentPath}/${b.name}`))) {
    buildHash.update(file.name).update(await readFile(resolve(file.parentPath, file.name)));
  }
  result.build = { mode: 'production', sha256: buildHash.digest('hex') };
  server = await preview({ root: lab, preview: { host: '127.0.0.1', port: 0, open: false } });
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  result.launch = { headless: false, executablePath: process.env.DOMFX_BROWSER_EXECUTABLE ?? null };
  try {
    browser = await chromium.launch({
      headless: false,
      executablePath: process.env.DOMFX_BROWSER_EXECUTABLE,
      timeout: 30_000,
    });
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
      reducedMotion: 'no-preference',
    });
  } catch (error) {
    result.outcome = 'BROWSER_UNAVAILABLE';
    exitCode = 3;
    throw error;
  }
  result.browserVersion = browser.version();
  page.on('pageerror', (error) => result.errors.push(error.message));
  await page.goto(`${url}/?automation${result.injectedFailure ? '&inject-failure' : ''}`);
  await page.waitForFunction(() => window.domfxEvidence?.report.outcome, undefined, {
    timeout: 180_000,
  });
  const evidence = await page.evaluate(() => window.domfxEvidence);
  result.timings = {};
  result.checks = separateTimings(evidence.report, '', result.timings);
  for (const [name, data] of Object.entries(evidence.images)) {
    if (!/^[a-z0-9-]+$/.test(name) || !data.startsWith('data:image/png;base64,')) {
      throw new Error('invalid evidence image');
    }
    await writeFile(resolve(directory, `${name}.png`), Buffer.from(data.slice(22), 'base64'));
    result.artifacts.push(`${name}.png`);
  }
  if (evidence.report.outcome.startsWith('UNAVAILABLE:')) {
    result.outcome =
      evidence.report.outcome === 'UNAVAILABLE: no GPU' ? 'GPU_UNAVAILABLE' : 'EFFECT_UNAVAILABLE';
    exitCode = 2;
  } else if (evidence.report.outcome.startsWith('PASS:')) {
    await page.locator('#dispose').click();
    const disposal = await page.evaluate(() => window.domfxEvidence.report.disposal);
    result.checks.disposal = disposal;
    if (disposal.managedBytes !== 0 || !disposal.overlayRemoved) {
      throw new Error('disposal assertion failed');
    }
    await page.locator('#rounded').click();
    if (!(await page.locator('#interaction').textContent()).includes('1')) {
      throw new Error('original target is not interactive');
    }
    if (result.errors.length) {
      throw new Error('uncaught browser errors');
    }
    if (!result.artifacts.length) {
      throw new Error('missing PNG evidence');
    }
    result.outcome = 'PASS';
    exitCode = 0;
  }
} catch (error) {
  if (browser && !browser.isConnected()) {
    result.outcome = 'BROWSER_UNAVAILABLE';
    exitCode = 3;
  }
  result.errors.push(String(error));
} finally {
  if (page && !page.isClosed()) {
    try {
      await page.screenshot({
        path: resolve(directory, 'lab.png'),
        fullPage: true,
        timeout: 10_000,
      });
      result.artifacts.push('lab.png');
    } catch (error) {
      result.errors.push(`screenshot: ${error}`);
      if (exitCode === 0) {
        result.outcome = 'FAIL';
        exitCode = 1;
      }
    }
  }
  await browser?.close();
  if (server) {
    await new Promise((done) => server.httpServer.close(done));
  }
  await writeFile(resolve(directory, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${result.outcome}: ${directory}`);
  process.exitCode = exitCode;
}
