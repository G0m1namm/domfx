import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { cpus, release, tmpdir } from 'node:os';
import { extname, relative, resolve, sep } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { chromium } from 'playwright';

import { distribution, validateHomepage, validateWindow } from './homepage-measurements.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'apps/web/dist');
const output = resolve(
  root,
  '.scratch/gallery-performance',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
const trials = Number(process.env.DOMFX_HOMEPAGE_TRIALS ?? 3);
const durationMs = Number(process.env.DOMFX_HOMEPAGE_DURATION_MS ?? 1500);
const nativeVisibilityOnly = process.argv.includes('--native-visibility');
if (!Number.isInteger(trials) || trials < 1 || !Number.isFinite(durationMs) || durationMs < 250) {
  throw new Error('Trials must be a positive integer and duration at least 250 ms');
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (name, value) =>
  writeFile(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const pause = (ms = 1000) => new Promise((done) => setTimeout(done, ms));
await mkdir(output, { recursive: true });

async function processTreeRss(browser) {
  const session = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    const pids = new Set(processInfo.map((entry) => entry.id));
    const rows = execFileSync('ps', ['-axo', 'pid=,rss='], { encoding: 'utf8' }).trim().split('\n');
    return {
      processCount: pids.size,
      rssKiB: rows.reduce((total, row) => {
        const [pid, rss] = row.trim().split(/\s+/).map(Number);
        return total + (pids.has(pid) ? rss : 0);
      }, 0),
    };
  } catch {
    return { availability: 'unavailable' };
  } finally {
    await session.detach();
  }
}

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    if (path !== dist && !path.startsWith(`${dist}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    response.writeHead(200, {
      'content-type': mime[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

const result = {
  outcome: 'running',
  source: {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    lockSha256: hash(await readFile(resolve(root, 'pnpm-lock.yaml'))),
    scripts: {},
  },
  environment: {
    node: process.version,
    os: process.platform,
    osRelease: release(),
    architecture: process.arch,
    cpu: cpus()[0]?.model ?? 'unknown',
    powerMode: process.env.DOMFX_POWER_MODE ?? 'unknown',
    refreshRate: process.env.DOMFX_REFRESH_RATE ?? 'unknown',
    realMobileHardware: false,
  },
  method: {
    collection: nativeVisibilityOnly ? 'native-tab-visibility' : 'performance',
    trials,
    durationMs,
    warmupMs: 1000,
    controls:
      'Same production homepage, reduced motion off. capability-static hides navigator.gpu in this diagnostic context. Fresh contexts compare complete effect and fallback paths, including different lazy imports/control availability. Paired static windows restart page owners with synthetic pagehide/persisted pageshow, retaining the loaded page, assets and parsed code. Neither isolates GPU cost. GitHub star requests use the same fixed fetch response in both controls; Playwright routing is not used because it disables HTTP caching.',
    server:
      'Loopback static server, uncompressed responses, one-hour cache; not a deployed network/CDN measurement. Browser cache is cold per fresh context; OS/driver caches are uncontrolled.',
    instrumentation:
      'rAF intervals, long tasks and direct canvas mutations during ordinary windows; CDP counters/heap at boundaries. CPU/allocation/GC diagnostics are separate. Canvas/status timestamps are initialization proxies, not capture or GPU timings.',
    unavailable: [
      'exact live capture counts',
      'internal resource ledgers',
      'GPU pass time',
      'actual VRAM',
      'real mobile',
      'approved website budgets',
    ],
  },
  assets: [],
  profiles: [],
  errors: [],
};
if (nativeVisibilityOnly) {
  result.method = {
    collection: 'native-tab-visibility',
    trials,
    controls:
      'Production effects path in one fresh native profile/default context. Actual viewport/DPR and OS motion preference; no focus or document visibility override.',
    server:
      'Loopback static server, uncompressed responses, one-hour cache. Cache retained between routes/cycles in one fresh browser profile. No network performance claim.',
    instrumentation:
      'Boundary DOM/CDP snapshots and trusted browser visibilitychange events during tab activation. No rAF timing windows, CPU/allocation profiles or synthetic visibility events.',
    unavailable: result.method.unavailable,
  };
}
for (const name of ['measure-homepage.mjs', 'homepage-measurements.mjs']) {
  result.source.scripts[name] = hash(await readFile(resolve(import.meta.dirname, name)));
}

async function snapshot(page, cdp) {
  const metrics = await cdp.send('Performance.getMetrics');
  const dom = await page.evaluate(() => {
    const bounds = (target) => {
      if (!target) {
        return null;
      }
      const r = target.getBoundingClientRect();
      const area =
        Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) *
        Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      return {
        xCss: r.x,
        yCss: r.y,
        widthCss: r.width,
        heightCss: r.height,
        visibleFraction: r.width * r.height ? area / (r.width * r.height) : 0,
      };
    };
    const describeHost = (host, target) => ({
      status: host?.dataset.status,
      reason: host?.dataset.reason,
      canvases: host?.querySelectorAll('canvas').length ?? 0,
      bounds: bounds(target),
    });
    const targets = [...document.querySelectorAll('[data-preview]')].map((target) => {
      return {
        effect: target.dataset.preview,
        ...bounds(target),
        ...describeHost(target.closest('[data-effect-host]')),
      };
    });
    return {
      surface: document.body.dataset.surface,
      cards: document.querySelectorAll('[data-card]').length,
      hidden: document.hidden,
      visibility: document.visibilityState,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      scrollY,
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      header: describeHost(
        document.querySelector('.header-effect-host'),
        document.querySelector('.header-effect-line'),
      ),
      closing: describeHost(
        document.querySelector('[data-closing-host]'),
        document.querySelector('[data-closing-target]'),
      ),
      pattern: document.querySelector('.header-effect-host')?.dataset.effect,
      patternTime: document.querySelector('.header-effect-host')?.dataset.time,
      targets,
      visiblePreviews: targets.filter((target) => target.visibleFraction >= 0.08),
      dialogOpen: Boolean(document.querySelector('.effect-dialog')?.open),
      dialog: {
        target: document.querySelector('[data-target][aria-pressed="true"]')?.dataset.target,
        tag: document.querySelector('[data-dialog-target]')?.tagName,
        transform: document.querySelector('.dialog-stage')?.style.transform,
        ...describeHost(
          document.querySelector('.dialog-stage'),
          document.querySelector('[data-dialog-target]'),
        ),
      },
      canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
        width: canvas.width,
        height: canvas.height,
      })),
    };
  });
  return {
    dom,
    metrics: Object.fromEntries(metrics.metrics.map(({ name, value }) => [name, value])),
  };
}

async function sample(page, cdp, label, action, duration = durationMs) {
  const before = await snapshot(page, cdp);
  if (label === 'ordinary-scroll' && before.dom.scrollY !== 0) {
    throw new Error('Scroll trials must begin at the document top');
  }
  const timingPromise = page.evaluate(
    async ({ duration, hasAction }) => {
      const frames = [];
      const longTasks = [];
      const churn = { added: 0, removed: 0 };
      let visibilityChanges = 0;
      const visibility = () => {
        visibilityChanges += 1;
        window.__measurementWindow.visibilityChanges = visibilityChanges;
      };
      document.addEventListener('visibilitychange', visibility);
      const mutations = new MutationObserver((entries) => {
        for (const entry of entries) {
          for (const [key, nodes] of [
            ['added', entry.addedNodes],
            ['removed', entry.removedNodes],
          ]) {
            for (const node of nodes) {
              if (node instanceof HTMLCanvasElement) {
                churn[key] += 1;
              }
            }
          }
        }
      });
      mutations.observe(document.body, { childList: true, subtree: true });
      let observer;
      if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
        observer = new PerformanceObserver((list) =>
          longTasks.push(...list.getEntries().map((e) => e.duration)),
        );
        observer.observe({ type: 'longtask' });
      }
      window.__measurementActionDone = !hasAction;
      const start = performance.now();
      window.__measurementWindow = {
        frames,
        longTasks,
        churn,
        visibilityChanges,
        startMs: start,
        longTaskSupported: Boolean(observer),
      };
      let prior;
      await new Promise((done) => {
        function tick(now) {
          if (prior !== undefined) {
            frames.push(now - prior);
          }
          prior = now;
          if (now - start >= duration && window.__measurementActionDone) {
            done();
          } else {
            requestAnimationFrame(tick);
          }
        }
        requestAnimationFrame(tick);
      });
      observer?.disconnect();
      mutations.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      return {
        frames,
        longTasks,
        churn,
        visibilityChanges,
        hidden: document.hidden,
        elapsedMs: performance.now() - start,
        longTaskSupported: Boolean(observer),
      };
    },
    { duration, hasAction: Boolean(action) },
  );
  let timeout;
  const [timing, observations] = await Promise.race([
    Promise.all([
      timingPromise,
      (async () => {
        try {
          return await action?.();
        } finally {
          if (action) {
            await page.evaluate(() => {
              window.__measurementActionDone = true;
            });
          }
        }
      })(),
    ]),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Timing window stalled')), duration + 30000);
    }),
  ])
    .catch(async (error) => {
      const timing = await page
        .evaluate(() => {
          const windowState = window.__measurementWindow;
          if (!windowState) {
            return null;
          }
          return {
            ...windowState,
            hidden: document.hidden,
            elapsedMs: performance.now() - windowState.startMs,
          };
        })
        .catch(() => null);
      error.measurement = { label, before, timing, outcome: 'failed' };
      throw error;
    })
    .finally(() => clearTimeout(timeout));
  const after = await snapshot(page, cdp);
  validateWindow(timing, duration, { label, before, after });
  const names = [
    'TaskDuration',
    'ScriptDuration',
    'LayoutCount',
    'LayoutDuration',
    'RecalcStyleCount',
    'RecalcStyleDuration',
    'JSEventListeners',
    'Nodes',
    'JSHeapUsedSize',
    'JSHeapTotalSize',
  ];
  return {
    label,
    before,
    after,
    timing,
    observations,
    summary: {
      rafMs: distribution(timing.frames),
      longTaskMs: distribution(timing.longTasks),
      metricDelta: Object.fromEntries(
        names.map((name) => [name, (after.metrics[name] ?? 0) - (before.metrics[name] ?? 0)]),
      ),
    },
  };
}

async function diagnostic(page, cdp, name) {
  const traceEvents = [];
  const collect = ({ value }) => traceEvents.push(...value);
  cdp.on('Tracing.dataCollected', collect);
  await cdp.send('Profiler.enable');
  await cdp.send('HeapProfiler.enable');
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
  const measured = await sample(page, cdp, 'diagnostic');
  const cpu = await cdp.send('Profiler.stop');
  const allocation = await cdp.send('HeapProfiler.stopSampling');
  const complete = new Promise((done) => cdp.once('Tracing.tracingComplete', done));
  await cdp.send('Tracing.end');
  const traceStatus = await complete;
  cdp.off('Tracing.dataCollected', collect);
  if (traceStatus.dataLossOccurred) {
    throw new Error('Diagnostic trace lost events');
  }
  await save(`${name}.trace.json`, { traceEvents });
  await save(`${name}.cpuprofile`, cpu.profile);
  await save(`${name}.heapprofile`, allocation.profile);
  return {
    measured,
    traceStatus,
    traceEventCount: traceEvents.length,
    sampledAllocationBytes: allocation.profile.samples.reduce(
      (total, entry) => total + entry.size,
      0,
    ),
    artifacts: [`${name}.trace.json`, `${name}.cpuprofile`, `${name}.heapprofile`],
  };
}

async function ready(page, control) {
  await page.waitForFunction(
    (control) => {
      const header = document.querySelector('.header-effect-host');
      if (control === 'capability-static') {
        return header?.dataset.reason === 'no-webgpu' && !document.querySelector('canvas');
      }
      if (header?.dataset.status !== 'active') {
        return false;
      }
      return [...document.querySelectorAll('[data-preview]')].every((target) => {
        const r = target.getBoundingClientRect();
        const area =
          Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) *
          Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        return (
          !r.width ||
          !r.height ||
          area / (r.width * r.height) < 0.08 ||
          target.closest('[data-effect-host]')?.dataset.status === 'active'
        );
      });
    },
    control,
    { timeout: 15000 },
  );
  await page.evaluate(() => window.__measurementObserver?.disconnect());
}

async function verifyNativeVisibility(base) {
  const profile = await mkdtemp(resolve(tmpdir(), 'domfx-native-visibility-'));
  const executable = process.env.DOMFX_BROWSER_EXECUTABLE ?? chromium.executablePath();
  const args = [
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-unsafe-webgpu',
    'about:blank',
  ];
  const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const native = {
    method:
      'Fresh headed Chromium profile, connected over loopback CDP with noDefaults:true in its default context. Tab activation uses bringToFront. No focus emulation, document visibility override or synthetic visibility event. Actual viewport/DPR and OS motion preference; no performance timing claim.',
    executable,
    args: args.filter((arg) => !arg.startsWith('--user-data-dir=')),
    stderr: '',
    preparations: [],
    records: [],
  };
  result.nativeVisibility = native;
  child.stderr.on('data', (data) => {
    native.stderr = `${native.stderr}${data}`.slice(-16000);
  });
  let launchError;
  child.on('error', (error) => {
    launchError = error;
  });
  const exited = new Promise((done) => child.once('exit', done));
  let nativeBrowser;
  let page;
  let cdp;
  let record;
  let preparation;
  try {
    let port;
    const deadline = Date.now() + 15000;
    while (!port && Date.now() < deadline) {
      if (launchError || child.exitCode !== null || child.signalCode !== null) {
        throw (
          launchError ?? new Error(`Native browser exited: ${child.signalCode ?? child.exitCode}`)
        );
      }
      port = await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')
        .then((text) => text.split('\n')[0])
        .catch(() => null);
      if (!port) {
        await pause(100);
      }
    }
    if (!port) {
      throw new Error('Native browser debug endpoint unavailable');
    }
    nativeBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
      noDefaults: true,
      timeout: 15000,
    });
    result.environment.browser = nativeBrowser.version();
    const context = nativeBrowser.contexts()[0];
    page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => result.errors.push(error.message));
    cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
    const cover = await context.newPage();
    for (const path of ['/', '/effects/']) {
      record = undefined;
      preparation = { path, outcome: 'running' };
      native.preparations.push(preparation);
      await page.bringToFront();
      await page.goto(new URL(path, base).href, { waitUntil: 'load' });
      await ready(page, 'effects');
      if (!native.adapter) {
        native.adapter = await page.evaluate(async () => {
          const adapter = await navigator.gpu.requestAdapter();
          return { vendor: adapter.info.vendor, architecture: adapter.info.architecture };
        });
      }
      await page.evaluate(() => {
        window.__nativeVisibility = [];
        document.addEventListener('visibilitychange', (event) => {
          window.__nativeVisibility.push({
            hidden: document.hidden,
            visibility: document.visibilityState,
            trusted: event.isTrusted,
            timeMs: performance.now(),
          });
        });
      });
      preparation.outcome = 'complete';
      for (let index = 0; index < trials; index++) {
        record = { path, index, outcome: 'running', events: [] };
        native.records.push(record);
        await page.evaluate(() => {
          window.__nativeVisibility.length = 0;
        });
        record.before = await snapshot(page, cdp);
        const before = record.before.dom;
        if (path === '/') {
          validateHomepage(before, 'effects');
        } else if (before.surface !== 'library' || before.cards !== 21 || before.hidden) {
          throw new Error('Expected the visible full gallery before native tab switch');
        }
        await save('report.json', result);
        await cover.bringToFront();
        await page.waitForFunction(() => document.hidden, null, { polling: 100 });
        await page.waitForFunction(() => !document.querySelector('canvas'), null, {
          polling: 100,
        });
        await pause(500);
        record.hidden = await snapshot(page, cdp);
        if (!record.hidden.dom.hidden || record.hidden.dom.canvases.length) {
          throw new Error('Native hidden page did not stay released');
        }
        await save('report.json', result);
        await page.bringToFront();
        await page.waitForFunction(() => !document.hidden, null, { polling: 100 });
        await ready(page, 'effects');
        record.returned = await snapshot(page, cdp);
        const hosts = [record.returned.dom.header, ...record.returned.dom.visiblePreviews];
        if (hosts.some((host) => host.status !== 'active' || host.canvases !== 1)) {
          throw new Error('Native return did not restore one canvas per visible host');
        }
        record.events = await page.evaluate(() => window.__nativeVisibility);
        if (
          record.events.length !== 2 ||
          record.events.some((event) => !event.trusted) ||
          !record.events[0].hidden ||
          record.events[1].hidden
        ) {
          throw new Error('Expected exactly one trusted browser hide/return event pair');
        }
        record.outcome = 'complete';
        await save('report.json', result);
        console.log(`Native tab visibility ${path} ${index + 1}/${trials}: complete`);
      }
    }
    record = undefined;
    preparation = undefined;
    if (result.errors.length) {
      throw new Error('Native visibility page reported errors');
    }
  } catch (error) {
    const failed = record ?? preparation;
    if (failed) {
      failed.outcome = 'failed';
      failed.error = String(error);
      failed.url = page.url();
      failed.failedState = await snapshot(page, cdp).catch(() => null);
    }
    if (record?.before) {
      record.events = await page.evaluate(() => window.__nativeVisibility ?? []).catch(() => []);
    }
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    const disconnect = nativeBrowser?.close().catch((error) => {
      native.disconnectError = String(error);
    });
    let exitTimeout;
    await Promise.race([
      Promise.all([exited, disconnect]),
      new Promise((done) => {
        exitTimeout = setTimeout(done, 3000);
      }),
    ]).finally(() => clearTimeout(exitTimeout));
    if (child.exitCode !== null || child.signalCode !== null || launchError) {
      await rm(profile, { recursive: true, force: true });
      native.cleanup = 'complete';
    } else {
      native.cleanup = 'incomplete';
      native.retainedProfile = profile;
    }
  }
  if (native.cleanup !== 'complete') {
    throw new Error('Native browser did not exit; temporary profile retained');
  }
}

async function navigation(page, cdp, control, navigate) {
  const start = performance.now();
  const response = await navigate();
  const loadWallMs = performance.now() - start;
  if (response?.status() !== 200) {
    throw new Error(`Navigation returned ${response?.status()}`);
  }
  const atLoad = await page.evaluate(() => ({
    navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
    scrollY,
  }));
  await page.evaluate(() => document.fonts.ready);
  await ready(page, control);
  const state = await snapshot(page, cdp);
  validateHomepage(state.dom, control);
  if (atLoad.scrollY !== 0) {
    throw new Error('Load did not start at the top of the homepage');
  }
  const resources = await page.evaluate(() => ({
    entries: performance.getEntriesByType('resource').map((e) => e.toJSON()),
    marks: window.__measurementMarks,
  }));
  return { loadWallMs, ...atLoad, ...resources, state };
}

async function interactions(page, cdp, record, control) {
  const add = async (label, action, duration) =>
    record.samples.push(await sample(page, cdp, label, action, duration));
  for (let trial = 0; trial < trials; trial++) {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await ready(page, control);
    await add('ordinary-scroll', async () => {
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 180);
        await pause(100);
      }
    });
  }
  await page.locator('[data-closing-target]').scrollIntoViewIfNeeded();
  if (control === 'effects') {
    await page.waitForFunction(
      () => document.querySelector('[data-closing-host]')?.dataset.status === 'active',
    );
  }
  record.closingState = await snapshot(page, cdp);
  for (let i = 0; i < trials; i++) {
    await add('closing-pattern-cycle', undefined, 9000);
    const cycle = record.samples.at(-1);
    if (control === 'effects' && cycle.before.dom.pattern === cycle.after.dom.pattern) {
      throw new Error('The recorded cycle did not replace its pattern');
    }
  }
  if (control === 'effects') {
    await page.locator('[data-closing-pause]').click();
    for (let i = 0; i < trials; i++) {
      await add('header-artwork-paused');
    }
    await page.locator('[data-closing-pause]').click();
  }
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await ready(page, control);
  record.offscreenReturn = await snapshot(page, cdp);
  for (let i = 0; i < trials; i++) {
    await add('preview-open-close', async () => {
      await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
      await page.locator('.effect-dialog').waitFor({ state: 'visible' });
      if (control === 'effects') {
        await page.waitForFunction(
          () => document.querySelector('.dialog-stage')?.dataset.status === 'active',
        );
      }
      await page.getByRole('button', { name: 'Close preview' }).click();
    });
  }
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  for (let i = 0; i < trials; i++) {
    await add('preview-target-replacement', async () => {
      const states = [];
      for (const name of ['SVG', 'Image', 'Text']) {
        await page.getByRole('button', { name, exact: true }).click();
        if (control === 'effects') {
          await page.waitForFunction(
            () => document.querySelector('.dialog-stage')?.dataset.status === 'active',
          );
        }
        states.push(await snapshot(page, cdp));
      }
      return states;
    });
    await add('preview-intensity', async () => {
      const input = page.locator('#effect-intensity');
      for (const value of ['30', '70', '45', '70']) {
        await input.fill(value);
        await pause(100);
      }
    });
    await add('preview-zoom-pan', async () => {
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      const zoomed = await snapshot(page, cdp);
      await page.locator('.dialog-scene').press('ArrowRight');
      await page.locator('.dialog-scene').press('ArrowDown');
      const panned = await snapshot(page, cdp);
      await page.getByRole('button', { name: 'Reset preview zoom', exact: true }).click();
      return [zoomed, panned, await snapshot(page, cdp)];
    });
  }
  if (control === 'effects') {
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    for (let i = 0; i < trials; i++) {
      await add('preview-paused');
    }
    await page.getByRole('button', { name: 'Resume animation', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Close preview' }).click();
  for (let i = 0; i < trials; i++) {
    await add('search', async () => {
      await page
        .getByRole('button', { name: 'Search effects and documentation', exact: true })
        .click();
      await page.getByRole('searchbox').fill('frost');
      await page.locator('[data-search-effect="frost"]').waitFor({ state: 'visible' });
      await page
        .locator('[data-search-group="documentation"] a')
        .first()
        .waitFor({ state: 'visible' });
      await page.getByRole('searchbox').press('Escape');
    });
  }
  record.beforeGallery = await snapshot(page, cdp);
  record.homeResourcesAfterInteractions = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.toJSON()),
  );
  await page.goto(new URL('/effects/', page.url()).href, { waitUntil: 'load' });
  await ready(page, control);
  for (let i = 0; i < trials; i++) {
    await add('gallery-filtering', async () => {
      for (const filter of ['Pattern', 'Energy', 'Material', 'All']) {
        await page.locator(`[data-filter="${filter}"]`).click();
        await pause(100);
      }
    });
  }
  record.gallery = await snapshot(page, cdp);
  record.galleryResources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.toJSON()),
  );
}

async function lifecycle(page, cdp, record, control, context) {
  const sibling = await context.newPage();
  try {
    await sibling.bringToFront();
    const observed = await page
      .waitForFunction(() => document.hidden, null, { timeout: 2000, polling: 100 })
      .then(
        () => true,
        () => false,
      );
    record.nativeHide = {
      outcome: observed ? 'observed' : 'unavailable',
      state: await snapshot(page, cdp),
    };
    if (observed && record.nativeHide.state.dom.canvases.length) {
      throw new Error('Native hidden page retained canvases');
    }
  } finally {
    await sibling.close();
    await page.bringToFront();
  }
  await ready(page, control);
  record.nativeReturn = await snapshot(page, cdp);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  record.syntheticHide = await snapshot(page, cdp);
  if (record.syntheticHide.dom.canvases.length) {
    throw new Error('Synthetic hide retained canvases');
  }
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await ready(page, control);
  record.syntheticReturn = await snapshot(page, cdp);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('canvas'));
  record.reducedMotion = await snapshot(page, cdp);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await pause(250);
  record.motionReturn = await snapshot(page, cdp);
  if (record.motionReturn.dom.canvases.length) {
    throw new Error('Motion recovery silently resumed');
  }
  if (control === 'effects') {
    await page.locator('[data-closing-pause]').click();
    await ready(page, control);
  }
  record.beforeTeardown = await snapshot(page, cdp);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  record.syntheticPagehide = await snapshot(page, cdp);
  if (record.syntheticPagehide.dom.canvases.length) {
    throw new Error('Pagehide retained canvases');
  }
  await page.goto('about:blank');
  record.teardown = { url: page.url(), canvases: await page.locator('canvas').count() };
}

async function runCondition(browser, base, profile, record) {
  const { control, index } = record;
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.dpr,
    reducedMotion: 'no-preference',
  });
  await context.addInitScript((control) => {
    const gpu = navigator.gpu;
    let enabled = control === 'effects';
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      get: () => (enabled ? gpu : undefined),
    });
    window.__measurementEffects = (value) => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      enabled = value;
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    };
    const fetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      if (input === 'https://api.github.com/repos/G0m1namm/domfx') {
        return Promise.resolve(
          new Response(JSON.stringify({ stargazers_count: 0 }), {
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return fetch(input, options);
    };
    const marks = { firstCanvasMs: null, headerActiveMs: null };
    window.__measurementMarks = marks;
    const observer = new MutationObserver((entries, observer) => {
      if (marks.firstCanvasMs === null && document.querySelector('canvas')) {
        marks.firstCanvasMs = performance.now();
      }
      if (
        marks.headerActiveMs === null &&
        document.querySelector('.header-effect-host')?.dataset.status === 'active'
      ) {
        marks.headerActiveMs = performance.now();
      }
      if (marks.firstCanvasMs !== null && marks.headerActiveMs !== null) {
        observer.disconnect();
      }
    });
    window.__measurementObserver = observer;
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-status'],
    });
  }, control);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
  page.on('pageerror', (error) => record.errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      record.console.push({ type: message.type(), text: message.text() });
    }
  });
  try {
    record.cold = await navigation(page, cdp, control, () =>
      page.goto(base, { waitUntil: 'load' }),
    );
    await save('report.json', result);
    record.adapter = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        return null;
      }
      return {
        ...adapter.info.toJSON?.(),
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
        timestampQuerySupported: adapter.features.has('timestamp-query'),
      };
    });
    record.initialProcessTree = await processTreeRss(browser);
    await pause();
    for (let i = 0; i < trials; i++) {
      record.samples.push(await sample(page, cdp, 'steady-home'));
    }
    if (control === 'effects') {
      await page.evaluate(() => window.__measurementEffects(false));
      await ready(page, 'capability-static');
      for (let i = 0; i < trials; i++) {
        record.samples.push(await sample(page, cdp, 'paired-static'));
      }
      await page.evaluate(() => window.__measurementEffects(true));
      await ready(page, 'effects');
      record.pairedReturn = await snapshot(page, cdp);
    }
    record.warm = await navigation(page, cdp, control, () => page.reload({ waitUntil: 'load' }));
    if (index === 0) {
      record.diagnostic = await diagnostic(page, cdp, `${profile.name}-${control}`);
      await save('report.json', result);
      await page.screenshot({ path: resolve(output, `${profile.name}-${control}.png`) });
      await interactions(page, cdp, record, control);
      await lifecycle(page, cdp, record, control, context);
    }
    record.finalProcessTree = await processTreeRss(browser);
    record.outcome = record.errors.length ? 'failed' : 'complete';
  } catch (error) {
    record.errors.push(error.stack ?? String(error));
    record.failedMeasurement = error.measurement ?? null;
    record.failedState = await snapshot(page, cdp).catch(() => null);
    record.outcome = 'failed';
  } finally {
    await context.close();
  }
  return record;
}

let browser;
try {
  const files = (await readdir(dist, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile())
    .sort((a, b) => `${a.parentPath}/${a.name}`.localeCompare(`${b.parentPath}/${b.name}`));
  const buildHash = createHash('sha256');
  for (const entry of files) {
    const path = resolve(entry.parentPath, entry.name);
    const name = relative(dist, path);
    const bytes = await readFile(path);
    buildHash.update(name).update(bytes);
    result.assets.push({
      path: name,
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      brotliBytes: brotliCompressSync(bytes).length,
      sha256: hash(bytes),
    });
  }
  result.build = { sha256: buildHash.digest('hex'), fileCount: files.length };
  await save('report.json', result);
  const html = await readFile(resolve(dist, 'index.html'), 'utf8');
  if (!html.includes('data-surface="marketing"')) {
    throw new Error('Build the current marketing gallery before measuring');
  }
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}/`;
  if (nativeVisibilityOnly) {
    await verifyNativeVisibility(base);
  } else {
    browser = await chromium.launch({
      headless: false,
      executablePath: process.env.DOMFX_BROWSER_EXECUTABLE,
      args: ['--enable-unsafe-webgpu', '--disable-back-forward-cache'],
    });
    result.environment.browser = browser.version();
    for (const profile of [
      { name: 'desktop-dpr1', viewport: { width: 1440, height: 900 }, dpr: 1 },
      { name: 'desktop-dpr2', viewport: { width: 1440, height: 900 }, dpr: 2 },
      { name: 'narrow-dpr2', viewport: { width: 360, height: 780 }, dpr: 2 },
    ]) {
      const record = { ...profile, conditions: [] };
      result.profiles.push(record);
      for (let index = 0; index < trials; index++) {
        // Alternate order to expose, rather than hide, serial cache/driver drift.
        const controls =
          index % 2 ? ['capability-static', 'effects'] : ['effects', 'capability-static'];
        for (const control of controls) {
          const condition = {
            control,
            index,
            outcome: 'running',
            errors: [],
            console: [],
            samples: [],
          };
          record.conditions.push(condition);
          await save('report.json', result);
          await runCondition(browser, base, profile, condition);
          await save('report.json', result);
          console.log(
            `${profile.name} ${control} ${index + 1}/${trials}: ${condition.outcome} ${condition.errors.join('; ')}`,
          );
          if (condition.outcome !== 'complete') {
            throw new Error('Collection stopped; preserve and correct the failed condition');
          }
        }
      }
    }
  }
  result.outcome = 'complete';
} catch (error) {
  result.errors.push(String(error));
  result.outcome = 'incomplete';
} finally {
  await browser?.close();
  server.close();
  await save('report.json', result);
  console.log(`Gallery measurement ${result.outcome}: ${output}`);
}
if (result.outcome !== 'complete') {
  process.exitCode = 1;
}
