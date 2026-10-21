import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { chromium } from 'playwright';
import { build, preview } from 'vite';

import { distribution, metricDelta } from './layout-summary.mjs';
import {
  attributionSources,
  placementCpuSamples,
  placementInvocations,
} from './placement-attribution.mjs';

const root = resolve(import.meta.dirname, '../../..');
const lab = resolve(root, 'tests/gpu');
const attribution = process.argv.includes('--attribution');
const directory = resolve(
  root,
  '.scratch/placement-measurements',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(directory, { recursive: true });
const save = (name, value) =>
  writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const result = {
  outcome: 'running',
  method: {
    inputs:
      'One/two fractional targets in bordered, scaled host and nested scroller; public attachFire, manual time 2, paused, seed 7. Controls run identical movement with no effect.',
    trials:
      'Fresh headed Chromium process per target-count/effects/phase. Stationary, nested scroll and translated/nonuniform-scale target movement, each 500 ms warmup then five ordinary 1000 ms samples. Separate diagnostic process: same warmup and one 1000 ms sample per workload.',
    ordinary:
      'No monkey-patched reads/rAF/GPU methods or effect diagnostics. CDP Performance counters bracket samples; ScriptDuration, TaskDuration and layout metrics include fixture driver, lifecycle, observer and reporting work, not exclusively placement CPU. rAF intervals are screen scheduling observations, not GPU durations.',
    diagnostic:
      'Opt-in experimental capture diagnostics plus wrapped getBoundingClientRect, getComputedStyle, request/cancelAnimationFrame and GPUQueue.submit. Fixture uses saved native rAF/rect methods. Wrapped callback elapsed time is wall-clock time around synchronous runtime rAF work, including placement, composition and visibility checks and scheduling interruptions; asynchronous continuations are excluded. It is not thread CPU time or exclusively placement cost. Read counts omit other geometry APIs. GPU submits proxy rendering submissions, not render-call counts or GPU completion. Instrumented timings are separate and carry probe overhead.',
    lifecycle:
      'After diagnostic visible samples, targets move outside their clipped scroller with a root transform. After settling, timer-based idle observes stopped offscreen work. Then disposal, settling, and disposed idle. Page remains visible; hidden-document behavior is not measured. No mocked visibility or forced GC.',
    bundle:
      'Libraries built normally. One-entry Vite production consumer uses only the committed measurement HTML/TS, default minification and bundling, with no unrelated fixture entries. JS totals sum emitted files and their individual gzip sizes; browser-module totals sum library dist JS, which leaves declared runtime dependencies external.',
    limits:
      'Controlled local micro-workload, fixed order, no randomization/thermal isolation; paired controls are context, not proof that their difference is exclusive placement cost. No native Safari/mobile/page-zoom/GPU-duration claims. Callback pending counts exclude fixture rAF and native observer delivery; they do not prove every asynchronous queue is bounded.',
    attribution:
      'Optional --attribution uses an unminified diagnostic consumer with consumer-to-library-to-source map resolution and recorded map hashes. Fresh processes separate exact measureEffectPlacement function-coverage counts (optimization disabled) from 1 ms sampling profiles without precise coverage or method wrappers. Coverage starts before navigation/compilation, resets after warmup, requires block entry ranges, and calibrates three calls to an async function with two awaits. CPU figures are source-attributed sampled execution estimates, including placement visibility/clip helpers and Floating UI, not complete/exclusive placement CPU, layout/GPU durations or ordinary production timing. Async continuations are attributed by mapped source.',
  },
  environment: {
    node: process.version,
    os: process.platform,
    osRelease: release(),
    architecture: process.arch,
    cpu: cpus()[0]?.model,
    powerMode: process.env.DOMFX_POWER_MODE ?? 'unknown',
    refreshRate: process.env.DOMFX_REFRESH_RATE ?? 'unknown',
    competingLoad: 'unknown; browser-session lock serializes repository browser work only',
  },
  launch: {
    headless: false,
    viewport: { width: 1280, height: 900 },
    dpr: 2,
    args: ['--enable-unsafe-webgpu'],
  },
  conditions: [],
  errors: [],
};
let server;

async function files(directoryPath, accept) {
  const entries = (await readdir(directoryPath, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .filter(accept)
    .sort();
  return Promise.all(
    entries.map(async (path) => {
      const bytes = await readFile(path);
      return {
        path: relative(root, path),
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
        sha256: digest(bytes),
      };
    }),
  );
}

function zeroWork(observation) {
  return (
    observation &&
    observation.callbacks === 0 &&
    observation.gpuSubmits === 0 &&
    observation.computedStyleReads === 0 &&
    Object.values(observation.rectReads).every((count) => count === 0) &&
    observation.pendingFrames === 0
  );
}

try {
  result.source = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    lockfileSha256: digest(await readFile(resolve(root, 'pnpm-lock.yaml'))),
    files: [
      ...(await files(resolve(root, 'packages/domfx/src'), () => true)),
      ...(await files(resolve(root, 'packages/core/src'), () => true)),
      ...(await Promise.all(
        [
          'tests/gpu/placement-measurement.html',
          'tests/gpu/src/placement-measurement.ts',
          'tests/gpu/scripts/measure-placement.mjs',
          'tests/gpu/scripts/placement-attribution.mjs',
        ].map(async (path) => ({ path, sha256: digest(await readFile(resolve(root, path))) })),
      )),
    ],
  };
  result.dependencies = JSON.parse(
    execFileSync('pnpm', ['list', '-r', '--depth', '0', '--json'], { cwd: root, encoding: 'utf8' }),
  );
  const compilation = spawnSync('pnpm', ['build'], { cwd: root, encoding: 'utf8' });
  await writeFile(
    resolve(directory, 'build.log'),
    `${compilation.stdout ?? ''}${compilation.stderr ?? ''}`,
  );
  if (compilation.status !== 0) {
    throw new Error(`library build failed: ${compilation.error ?? compilation.status}`);
  }
  if (attribution) {
    const mapped = spawnSync(
      'pnpm',
      ['--filter', '@domfx/browser', 'exec', 'vite', 'build', '--sourcemap'],
      { cwd: root, encoding: 'utf8' },
    );
    await writeFile(
      resolve(directory, 'sourcemap-build.log'),
      `${mapped.stdout ?? ''}${mapped.stderr ?? ''}`,
    );
    if (mapped.status !== 0) {
      throw new Error(`source-mapped browser build failed: ${mapped.error ?? mapped.status}`);
    }
    const snapshot = resolve(directory, 'browser-dist');
    await mkdir(snapshot);
    for (const name of await readdir(resolve(root, 'packages/domfx/dist'))) {
      if (name.endsWith('.js') || name.endsWith('.js.map')) {
        await copyFile(resolve(root, 'packages/domfx/dist', name), resolve(snapshot, name));
      }
    }
  }
  const dist = resolve(directory, 'dist');
  await build({
    root: lab,
    configFile: false,
    logLevel: 'silent',
    build: {
      outDir: dist,
      emptyOutDir: true,
      minify: attribution ? false : undefined,
      sourcemap: attribution,
      rollupOptions: { input: resolve(lab, 'placement-measurement.html') },
    },
  });
  result.bundles = {
    browserModules: await files(resolve(root, 'packages/domfx/dist'), (path) =>
      path.endsWith('.js'),
    ),
    consumer: await files(dist, (path) => path.endsWith('.js')),
  };
  result.bundleTotals = Object.fromEntries(
    Object.entries(result.bundles).map(([name, entries]) => [
      name,
      {
        bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
        gzipBytes: entries.reduce((sum, entry) => sum + entry.gzipBytes, 0),
      },
    ]),
  );
  result.build = {
    mode: attribution ? 'unminified attribution' : 'production',
    files: await files(dist, () => true),
  };
  const sources = attribution
    ? await attributionSources(dist, resolve(root, 'packages/domfx/dist'))
    : undefined;
  if (sources) {
    result.build.sourceMaps = sources.identities;
  }
  server = await preview({
    root: lab,
    configFile: false,
    build: { outDir: dist },
    preview: { host: '127.0.0.1', port: 0, open: false },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('missing preview address');
  }
  for (const count of [1, 2]) {
    for (const effects of attribution ? [true] : [false, true]) {
      for (const phase of attribution ? ['coverage', 'profile'] : ['ordinary', 'diagnostic']) {
        const diagnostic = phase === 'diagnostic';
        const condition = {
          count,
          effects,
          phase,
          outcome: 'running',
          workloads: [],
          errors: [],
        };
        result.conditions.push(condition);
        let browser;
        let page;
        try {
          browser = await chromium.launch({
            ...result.launch,
            executablePath: process.env.DOMFX_BROWSER_EXECUTABLE,
          });
          condition.browserVersion = browser.version();
          const context = await browser.newContext({
            viewport: result.launch.viewport,
            deviceScaleFactor: result.launch.dpr,
            reducedMotion: 'no-preference',
          });
          page = await context.newPage();
          page.on('pageerror', (error) => condition.errors.push(error.message));
          page.on('console', (message) => {
            if (message.type() === 'error') {
              condition.errors.push(message.text());
            }
          });
          let cdp;
          if (phase === 'coverage') {
            cdp = await page.context().newCDPSession(page);
            await cdp.send('Profiler.enable');
            // V8 needs detailed coverage enabled before compiling async functions.
            await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
          }
          await page.goto(`http://127.0.0.1:${address.port}/placement-measurement.html`);
          await page.bringToFront();
          await page.waitForFunction(() => window.domfxPlacementMeasurement);
          condition.preparation = await page.evaluate(
            ({ count, effects, diagnostic }) =>
              window.domfxPlacementMeasurement.prepare(count, effects, diagnostic),
            { count, effects, diagnostic },
          );
          cdp ??= await page.context().newCDPSession(page);
          await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
          if (phase === 'profile') {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
          }
          for (const workload of ['stationary', 'scroll', 'transform']) {
            const workloadResult = { workload, trials: [] };
            condition.workloads.push(workloadResult);
            workloadResult.warmup = await page.evaluate(
              (workload) => window.domfxPlacementMeasurement.sample(workload, 500),
              workload,
            );
            for (let index = 0; index < (phase === 'ordinary' ? 5 : 1); index += 1) {
              const before = await cdp.send('Performance.getMetrics');
              let coverageStarted;
              if (phase === 'coverage') {
                coverageStarted = await cdp.send('Profiler.takePreciseCoverage');
              } else if (phase === 'profile') {
                await cdp.send('Profiler.start');
              }
              const sample = await page.evaluate(
                ({ workload, durationMs }) =>
                  window.domfxPlacementMeasurement.sample(workload, durationMs),
                { workload, durationMs: phase === 'profile' ? 2000 : 1000 },
              );
              let attributed;
              if (phase === 'coverage') {
                await cdp.send('Runtime.evaluate', {
                  expression:
                    '(async () => { const calibration = async function domfxCoverageCalibration() { await Promise.resolve(); await Promise.resolve(); }; for (let index = 0; index < 3; index += 1) { await calibration(); } })()',
                  awaitPromise: true,
                });
                const coverage = await cdp.send('Profiler.takePreciseCoverage');
                const calibration = coverage.result
                  .flatMap((script) => script.functions)
                  .filter((fn) => fn.functionName === 'domfxCoverageCalibration');
                if (calibration.length !== 1 || calibration[0].ranges[0].count !== 3) {
                  throw new Error('async invocation coverage calibration failed');
                }
                const artifact = `${count}-${workload}.coverage.json`;
                await save(artifact, { ...coverage, startedAt: coverageStarted.timestamp });
                attributed = {
                  invocations: placementInvocations(coverage, sources),
                  windowDurationMs: (coverage.timestamp - coverageStarted.timestamp) * 1000,
                  calibrationCalls: 3,
                  artifact,
                };
              } else if (phase === 'profile') {
                const { profile } = await cdp.send('Profiler.stop');
                const artifact = `${count}-${workload}.cpuprofile`;
                await save(artifact, profile);
                attributed = { cpu: placementCpuSamples(profile, sources.mapFrame), artifact };
              }
              const after = await cdp.send('Performance.getMetrics');
              workloadResult.trials.push({
                ...sample,
                raf: distribution(sample.rafMs),
                metrics: metricDelta(before, after),
                attributed,
              });
            }
          }
          if (phase === 'coverage') {
            await cdp.send('Profiler.stopPreciseCoverage');
          }
          if (diagnostic) {
            condition.offscreenTransition = await page.evaluate(() =>
              window.domfxPlacementMeasurement.offscreen(),
            );
            await page.waitForTimeout(250);
            condition.offscreen = await page.evaluate(() =>
              window.domfxPlacementMeasurement.idle(1000),
            );
            condition.disposal = await page.evaluate(() =>
              window.domfxPlacementMeasurement.dispose(),
            );
            await page.waitForTimeout(250);
            condition.disposed = await page.evaluate(() =>
              window.domfxPlacementMeasurement.idle(500),
            );
          }
          await cdp.detach();
          const samples = condition.workloads.flatMap((workload) => [
            workload.warmup,
            ...workload.trials,
          ]);
          const diagnosticValid =
            !diagnostic ||
            (samples.every(
              (sample) => sample.captures === 0 && sample.observation.gpuSubmits === 0,
            ) &&
              zeroWork(condition.offscreen.observation) &&
              zeroWork(condition.disposed.observation) &&
              condition.offscreen.state.handles.every(
                (handle) => handle.lifecycle === 'suspended',
              ) &&
              condition.disposal.layers.length === 0);
          condition.outcome =
            samples.every((sample) => sample.valid) &&
            diagnosticValid &&
            condition.errors.length === 0
              ? 'complete'
              : 'failed';
        } catch (error) {
          condition.errors.push(String(error));
          condition.outcome = 'failed';
        } finally {
          try {
            if (page) {
              condition.cleanup = await page.evaluate(() =>
                window.domfxPlacementMeasurement.cleanup(),
              );
              if (condition.cleanup.layers.length) {
                condition.outcome = 'failed';
              }
            }
          } catch (error) {
            condition.errors.push(`cleanup: ${String(error)}`);
            condition.outcome = 'failed';
          }
          await browser?.close();
          await save('report.json', result);
          console.log(
            `${count} target(s), ${effects ? 'paused effect' : 'control'}, ${condition.phase}: ${condition.outcome}`,
          );
        }
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
  await save('report.json', result);
  console.log(`${result.outcome.toUpperCase()}: ${directory}`);
  process.exitCode = result.outcome === 'complete' ? 0 : 1;
}
