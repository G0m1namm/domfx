import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { relative, resolve } from 'node:path';

import { chromium } from 'playwright';
import { preview } from 'vite';

import { distribution, metricDelta, traceActivity } from './layout-summary.mjs';

const root = resolve(import.meta.dirname, '../../..');
const lab = resolve(root, 'tests/gpu');
const directory = resolve(
  root,
  '.scratch/layout-performance',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(directory, { recursive: true });
const saveJson = (name, value) =>
  writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`);
const result = {
  outcome: 'running',
  method: {
    trials:
      'For each count 1/10/50, serial no-effect then ambient effect in fresh visible Chromium processes; 1 s warmup, five 2 s ordinary trials, one separate 2 s instrumented trial. Static geometry, all targets visible.',
    clock:
      'Public per-attachment ambient rAF clock, time 0 on attachment, continuous through warmup/trials; seed 7, intensity 1. No global clock or reset per trial.',
    preparation:
      'Serial public handle.ready wall durations; early targets animate during later initialization. One serial refresh per target after steady trials with all handles paused. Neither series is a cold/SDF-only gate.',
    instrumentation:
      'Ordinary trials retain rAF intervals and read lifecycle getters each frame. Separate diagnostic trial adds CDP Performance timeTicks, timeline/V8 GC trace, 1 ms CPU sampling and 32768-byte heap sampling including collected objects. No forced GC. CDP boundaries include trial setup/teardown and transport overhead.',
    gpuTiming:
      'Unavailable: public attachments do not request timestamp queries. CPU task/layout time and rAF intervals are not GPU durations; #31 remains separate.',
    memory:
      'Sampled JS allocation estimates and before/after heap gauges, not exact allocation counts or GPU memory. Trace GC events are exposed main-thread slices, not total all-thread GC cost.',
    budget:
      'Unchanged runtime admission: 1M pixels/capture, 48 MB target steady, 88 MB target transient, 144 MB aggregate. Expected 176x160 rasters at DPR 2; admission/lifecycle failures retained without reducing requested count.',
  },
  environment: {
    node: process.version,
    os: process.platform,
    osRelease: release(),
    architecture: process.arch,
    device: cpus()[0]?.model ?? 'unknown',
    powerMode: process.env.DOMFX_POWER_MODE ?? 'unknown',
    refreshRate: process.env.DOMFX_REFRESH_RATE ?? 'unknown',
    displayAndPowerSource:
      'operator-provided environment variables, otherwise unknown; competing load/thermal state unknown',
  },
  launch: {
    headless: false,
    viewport: { width: 1280, height: 900 },
    dpr: 2,
    args: ['--enable-unsafe-webgpu'],
    executable: process.env.DOMFX_BROWSER_EXECUTABLE ?? 'Playwright Chromium',
  },
  conditions: [],
  errors: [],
};
let server;
try {
  result.source = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    lockfileSha256: createHash('sha256')
      .update(await readFile(resolve(root, 'pnpm-lock.yaml')))
      .digest('hex'),
  };
  result.dependencies = JSON.parse(
    execFileSync('pnpm', ['list', '-r', '--depth', '0', '--json'], { cwd: root, encoding: 'utf8' }),
  );
  const build = spawnSync('pnpm', ['build:gpu'], { cwd: root, encoding: 'utf8' });
  await writeFile(resolve(directory, 'build.log'), `${build.stdout ?? ''}${build.stderr ?? ''}`);
  if (build.status !== 0) {
    throw new Error(`production build failed: ${build.error ?? build.status}`);
  }
  const dist = resolve(lab, 'dist');
  result.assets = [];
  const hash = createHash('sha256');
  for (const file of (await readdir(dist, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .sort((a, b) => `${a.parentPath}/${a.name}`.localeCompare(`${b.parentPath}/${b.name}`))) {
    const path = resolve(file.parentPath, file.name);
    const bytes = await readFile(path);
    const name = relative(dist, path);
    hash.update(name).update(bytes);
    result.assets.push({
      path: name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  result.build = { mode: 'production', sha256: hash.digest('hex') };
  // Preserve the exact minified code for profile URL/line/column attribution.
  await cp(dist, resolve(directory, 'dist'), { recursive: true });
  server = await preview({ root: lab, preview: { host: '127.0.0.1', port: 0, open: false } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('missing preview address');
  }
  for (const count of [1, 10, 50]) {
    for (const effects of [false, true]) {
      const name = `${count}-${effects ? 'ambient' : 'baseline'}`;
      const condition = { name, count, effects, outcome: 'running', trials: [], errors: [] };
      result.conditions.push(condition);
      let browser;
      let page;
      try {
        browser = await chromium.launch({
          headless: false,
          args: result.launch.args,
          executablePath: process.env.DOMFX_BROWSER_EXECUTABLE,
        });
        condition.browserVersion = browser.version();
        page = await browser.newPage({
          viewport: result.launch.viewport,
          deviceScaleFactor: 2,
          reducedMotion: 'no-preference',
        });
        page.on('pageerror', (error) => condition.errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') {
            condition.errors.push(message.text());
          }
        });
        await page.goto(
          `http://127.0.0.1:${address.port}/layout.html?count=${count}&effects=${effects}`,
        );
        await page.bringToFront();
        await page.waitForFunction(() => window.domfxLayout);
        condition.preparation = await page.evaluate(() => window.domfxLayout.prepare());
        if (
          condition.preparation.state.unavailable.length ||
          condition.preparation.state.active !== (effects ? count : 0)
        ) {
          condition.outcome = 'unavailable';
          continue;
        }
        condition.warmup = await page.evaluate(() => window.domfxLayout.sample(1000));
        for (let trial = 0; trial < 5; trial++) {
          const raw = await page.evaluate(() => window.domfxLayout.sample(2000));
          condition.trials.push({ ...raw, raf: distribution(raw.rafMs) });
        }
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
        await cdp.send('HeapProfiler.enable');
        const traceEvents = [];
        cdp.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value));
        await cdp.send('Tracing.start', {
          categories: 'devtools.timeline,blink.user_timing,v8,disabled-by-default-v8.gc',
          transferMode: 'ReportEvents',
        });
        await cdp.send('HeapProfiler.startSampling', {
          samplingInterval: 32768,
          includeObjectsCollectedByMajorGC: true,
          includeObjectsCollectedByMinorGC: true,
        });
        await cdp.send('Profiler.start');
        const before = await cdp.send('Performance.getMetrics');
        const raw = await page.evaluate(() => window.domfxLayout.sample(2000, true));
        const after = await cdp.send('Performance.getMetrics');
        const cpu = await cdp.send('Profiler.stop');
        const allocation = await cdp.send('HeapProfiler.stopSampling');
        const traceDone = new Promise((done) => cdp.once('Tracing.tracingComplete', done));
        await cdp.send('Tracing.end');
        const traceStatus = await traceDone;
        await saveJson(`${name}.trace.json`, { traceEvents });
        await saveJson(`${name}.cpuprofile`, cpu.profile);
        await saveJson(`${name}.heapprofile`, allocation.profile);
        condition.diagnostic = {
          ...raw,
          raf: distribution(raw.rafMs),
          metrics: { before, after, delta: metricDelta(before, after) },
          trace: traceActivity(traceEvents),
          traceStatus,
          sampledAllocationBytes: allocation.profile.samples.reduce(
            (sum, sample) => sum + sample.size,
            0,
          ),
          artifacts: [`${name}.trace.json`, `${name}.cpuprofile`, `${name}.heapprofile`],
        };
        await cdp.detach();
        await page.screenshot({ path: resolve(directory, `${name}.png`) });
        condition.refresh = await page.evaluate(() => window.domfxLayout.refresh());
        condition.outcome =
          condition.warmup.valid &&
          condition.trials.every((trial) => trial.valid) &&
          raw.valid &&
          !traceStatus.dataLossOccurred &&
          !condition.errors.length
            ? 'complete'
            : 'failed';
      } catch (error) {
        condition.errors.push(String(error));
        condition.outcome = 'failed';
      } finally {
        try {
          if (page) {
            condition.cleanup = await page.evaluate(() => window.domfxLayout.cleanup());
            if (!condition.cleanup.disposed || condition.cleanup.layers !== 0) {
              condition.outcome = 'failed';
            }
          }
        } catch (error) {
          condition.errors.push(`cleanup: ${String(error)}`);
          condition.outcome = 'failed';
        }
        await browser?.close();
        await saveJson('report.json', result);
        console.log(`${name}: ${condition.outcome}`);
      }
    }
  }
  result.outcome = result.conditions.every((condition) => condition.outcome === 'complete')
    ? 'complete'
    : 'incomplete';
} catch (error) {
  result.errors.push(String(error));
  result.outcome = 'failed';
} finally {
  if (server) {
    await new Promise((done) => server.httpServer.close(done));
  }
  await saveJson('report.json', result);
  console.log(`${result.outcome.toUpperCase()}: ${directory}`);
  process.exitCode = result.outcome === 'complete' ? 0 : 1;
}
