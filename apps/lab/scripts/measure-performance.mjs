import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { relative, resolve } from 'node:path';

import { chromium } from 'playwright';
import { preview } from 'vite';

import { summarizeCondition } from './performance-gates.mjs';

const root = resolve(import.meta.dirname, '../../..');
const lab = resolve(root, 'apps/lab');
const directory = resolve(
  root,
  '.scratch/performance',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(directory, { recursive: true });
const result = {
  outcome: 'held',
  method: {
    profiles:
      'Five fresh Chromium processes with temporary profiles per condition; no reused browser or user data. Warm series in fifth profile only.',
    initialization:
      'After font/image readiness: dynamic library imports, GPU service creation and first capture-to-SDF batch. All five must be <= 2000 ms.',
    assets:
      'Font load/document.fonts.ready and image.decode measured separately, overlapping waits; local production assets, no network throttling.',
    rebuild:
      'Three warmups then 30 batches; nearest-rank P95 (29th of 30) <= 300 ms. Each batch sequentially captures/prepares targets and retains all frames until completion.',
    timing:
      'performance.now wall time; await GPU queue completion; includes capture RGBA readback, upload, JFA and output allocation; excludes SDF diagnostic readback, oracle and fire rendering.',
    fixtures:
      'one-target: 280x64 CSS-pixel headline with local font; two-targets: same headline + 96x64 transparent PNG in one shared host. Padding 32 CSS pixels, actual DPR 2; raw padded dimensions in every sample.',
    limits:
      'Profile-cold only: OS filesystem/driver caches are not cleared. Experimental renderer path, not public attachment/steady-render timing. Local device results only; unknown environment fields remain unknown.',
  },
  environment: {
    node: process.version,
    os: process.platform,
    osRelease: release(),
    architecture: process.arch,
    device: cpus()[0]?.model ?? 'unknown',
    powerMode: process.env.DOMFX_POWER_MODE ?? 'unknown',
    refreshRate: process.env.DOMFX_REFRESH_RATE ?? 'unknown',
    powerAndRefreshSource: 'operator-provided environment variables, otherwise unknown',
  },
  launch: {
    headless: false,
    executable: process.env.DOMFX_BROWSER_EXECUTABLE ?? 'Playwright Chromium',
    viewport: { width: 1280, height: 900 },
    dpr: 2,
    args: ['--enable-unsafe-webgpu'],
  },
  conditions: [1, 2].map((targets) => ({ targets, runs: [], gates: summarizeCondition([]) })),
  errors: [],
};
let server;
const save = () =>
  writeFile(resolve(directory, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
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
  const build = spawnSync('pnpm', ['build:demo'], { cwd: root, encoding: 'utf8' });
  await writeFile(resolve(directory, 'build.log'), `${build.stdout ?? ''}${build.stderr ?? ''}`);
  if (build.status !== 0) {
    throw new Error(`production build failed: ${build.error ?? build.status}`);
  }
  result.assets = [];
  const buildHash = createHash('sha256');
  const dist = resolve(lab, 'dist');
  for (const file of (await readdir(dist, { recursive: true, withFileTypes: true }))
    .filter((file) => file.isFile())
    .sort((a, b) => `${a.parentPath}/${a.name}`.localeCompare(`${b.parentPath}/${b.name}`))) {
    const path = resolve(file.parentPath, file.name);
    const bytes = await readFile(path);
    const name = relative(dist, path);
    buildHash.update(name).update(bytes);
    result.assets.push({
      path: name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  result.build = { mode: 'production', sha256: buildHash.digest('hex') };
  server = await preview({ root: lab, preview: { host: '127.0.0.1', port: 0, open: false } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('missing preview address');
  }
  const url = `http://127.0.0.1:${address.port}`;
  for (const condition of result.conditions) {
    const { targets } = condition;
    for (let profile = 1; profile <= 5; profile++) {
      const run = { profile, warm: profile === 5, errors: [] };
      condition.runs.push(run);
      let browser;
      try {
        // A new launch creates a new temporary user-data directory and process.
        browser = await chromium.launch({
          headless: false,
          args: result.launch.args,
          executablePath: process.env.DOMFX_BROWSER_EXECUTABLE,
          timeout: 30_000,
        });
        run.browserVersion = browser.version();
        const page = await browser.newPage({
          viewport: result.launch.viewport,
          deviceScaleFactor: 2,
          reducedMotion: 'no-preference',
        });
        page.on('pageerror', (error) => run.errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') {
            run.errors.push(message.text());
          }
        });
        await page.goto(`${url}/performance.html?targets=${targets}${run.warm ? '&warm' : ''}`);
        await page.bringToFront();
        await page.waitForFunction(
          () =>
            window.domfxPerformance?.outcome !== undefined &&
            window.domfxPerformance.outcome !== 'running',
          undefined,
          { timeout: 180_000 },
        );
        run.report = await page.evaluate(() => window.domfxPerformance);
        run.resources = await page.evaluate(() =>
          performance.getEntriesByType('resource').map((entry) => {
            const resource = entry;
            return {
              url: resource.name,
              durationMs: resource.duration,
              transferSize: resource.transferSize,
              encodedBodySize: resource.encodedBodySize,
            };
          }),
        );
        await page.screenshot({
          path: resolve(directory, `targets-${targets}-profile-${profile}.png`),
        });
      } catch (error) {
        run.errors.push(String(error));
      } finally {
        await browser?.close();
      }
      condition.gates = summarizeCondition(condition.runs);
      await save();
      console.log(`${targets} target(s), profile ${profile}: ${run.report?.outcome ?? 'untested'}`);
    }
  }
  if (
    result.conditions.every((condition) =>
      Object.values(condition.gates).every((gate) => gate.status === 'pass'),
    )
  ) {
    result.outcome = 'pass';
  }
} catch (error) {
  result.errors.push(String(error));
} finally {
  if (server) {
    await new Promise((done) => server.httpServer.close(done));
  }
  await save();
  console.log(`${result.outcome.toUpperCase()}: ${directory}`);
  process.exitCode = result.outcome === 'pass' ? 0 : 1;
}
