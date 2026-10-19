import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { cpus, release } from 'node:os';
import { extname, relative, resolve, sep } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'apps/web/dist');

// This runner preserves the #86 editorial baseline, not the current gallery.
const homepageSource = await readFile(resolve(root, 'apps/web/src/pages/index.astro'), 'utf8');
if (!homepageSource.includes('HomeHero')) {
  throw new Error(
    'This historical runner requires the editorial homepage. Reproduce at revision ' +
      '47caf659358eabb97959d7655cc6715313910a25; see engineering/homepage-performance.md. ' +
      'It does not measure the current marketing gallery.',
  );
}

const output = resolve(
  root,
  '.scratch/homepage-performance',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
const trials = Number(process.env.DOMFX_HOMEPAGE_TRIALS ?? 3);
const durationMs = Number(process.env.DOMFX_HOMEPAGE_DURATION_MS ?? 1500);
const warmOnly = process.env.DOMFX_HOMEPAGE_WARM_ONLY === '1';
if (!Number.isInteger(trials) || trials < 1 || !Number.isFinite(durationMs) || durationMs < 250) {
  throw new Error('Trials must be a positive integer and duration at least 250 ms');
}
await mkdir(output, { recursive: true });

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (name, value) =>
  writeFile(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
  return { n: sorted.length, p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1) ?? null };
};
async function processTreeRss(browser) {
  try {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    await session.detach();
    const pids = new Set(processInfo.map((entry) => entry.id));
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number));
    return {
      processCount: pids.size,
      rssKiB: rows.filter(([pid]) => pids.has(pid)).reduce((total, [, , rss]) => total + rss, 0),
    };
  } catch {
    return null;
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
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = resolve(
      dist,
      `.${decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname)}`,
    );
    if (!path.startsWith(`${dist}${sep}`)) {
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
    measurementScriptSha256: hash(
      await readFile(resolve(import.meta.dirname, 'measure-homepage.mjs')),
    ),
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
    trials,
    durationMs,
    warmupMs: 1000,
    conditions: `${warmOnly ? 'Warm-reload-only supplement. ' : ''}Serial fresh contexts; Fire and None use the same production page/assets with player and background still. Every built asset is fetched and consumed in both controls before steady warmup, so steady samples begin with equal browser-cache asset sets. The first Fire context also switches to None on the same loaded page for three paired windows. Player and background comparisons use Fire None. Each condition starts with cleared session storage and no reduced motion. Three viewport/DPR profiles.`,
    warmOnly,
    instrumentation:
      'rAF and PerformanceObserver long tasks during ordinary windows; CDP Performance counters and JS heap gauges at window boundaries. No forced GC. No GPU timestamps. Managed GPU reservations are not public; canvas pixel counts are reported only as proxy dimensions.',
  },
  captureAdapter: {
    availability: 'unavailable',
    reason:
      'The public homepage does not expose a live capture ledger, and its production bundle tree-shakes the unused captureElement export. The runner does not load a separate diagnostic module because that would not be a production homepage path.',
  },
  assets: [],
  profiles: [],
  errors: [],
};

async function snapshot(page, cdp) {
  const metrics = await cdp.send('Performance.getMetrics');
  const dom = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('[data-effect-target]')];
    const visible = targets.filter((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    });
    const canvases = [...document.querySelectorAll('[data-effect-host] canvas')];
    return {
      visibility: document.visibilityState,
      hidden: document.hidden,
      reducedMotion: document.documentElement.hasAttribute('data-reduced-motion'),
      effect: document.querySelector('#hero-effect')?.value,
      pauseLabel: document.querySelector('#effect-play')?.getAttribute('aria-label'),
      authoredTargets: targets.map((target) => ({
        id: target.id,
        width: target.getBoundingClientRect().width,
        height: target.getBoundingClientRect().height,
        hostCanvasCount:
          target.closest('[data-effect-host]')?.querySelectorAll('canvas').length ?? 0,
      })),
      visibleTargets: visible.map((target) => target.id),
      effectCanvases: canvases.map((canvas) => ({ width: canvas.width, height: canvas.height })),
      backgroundCanvas: document.querySelector('.shader-section canvas')?.width ?? 0,
      backgroundPlaying: document.querySelector('.shader-motion')?.getAttribute('aria-pressed'),
      playerState: document.querySelector('[data-player-state]')?.textContent,
    };
  });
  return {
    dom,
    metrics: Object.fromEntries(metrics.metrics.map(({ name, value }) => [name, value])),
  };
}

async function sample(page, cdp, label) {
  const before = await snapshot(page, cdp);
  const timing = await page.evaluate(
    async ({ duration, action }) => {
      const frames = [];
      const longTasks = [];
      const churn = { added: 0, removed: 0 };
      const changes = new MutationObserver((entries) => {
        for (const entry of entries) {
          churn.added += [...entry.addedNodes].filter(
            (node) => node instanceof HTMLCanvasElement,
          ).length;
          churn.removed += [...entry.removedNodes].filter(
            (node) => node instanceof HTMLCanvasElement,
          ).length;
        }
      });
      document
        .querySelectorAll('[data-effect-host]')
        .forEach((host) => changes.observe(host, { childList: true }));
      let observer;
      if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
        observer = new PerformanceObserver((list) =>
          longTasks.push(...list.getEntries().map((entry) => entry.duration)),
        );
        observer.observe({ type: 'longtask', buffered: false });
      }
      const start = performance.now();
      let prior;
      let lastChange = start;
      let setting = false;
      await new Promise((done) => {
        function tick(now) {
          if (action === 'scroll') {
            window.scrollBy(0, 30);
          }
          if (action === 'rapid-settings' && now - lastChange >= 250) {
            setting = !setting;
            const intensity = document.querySelector('#effect-intensity');
            const height = document.querySelector('#flame-height');
            intensity.value = setting ? '30' : '70';
            height.value = setting ? '24' : '32';
            intensity.dispatchEvent(new Event('input', { bubbles: true }));
            height.dispatchEvent(new Event('input', { bubbles: true }));
            lastChange = now;
          }
          if (prior !== undefined) {
            frames.push(now - prior);
          }
          prior = now;
          if (now - start < duration) {
            requestAnimationFrame(tick);
          } else {
            done();
          }
        }
        requestAnimationFrame(tick);
      });
      observer?.disconnect();
      changes.disconnect();
      return {
        frames,
        longTasks,
        churn,
        longTaskSupported: Boolean(observer),
        elapsedMs: performance.now() - start,
      };
    },
    { duration: durationMs, action: label },
  );
  const after = await snapshot(page, cdp);
  const deltaNames = [
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
    summary: {
      rafMs: distribution(timing.frames),
      longTaskMs: distribution(timing.longTasks),
      metricDelta: Object.fromEntries(
        deltaNames.map((name) => [name, (after.metrics[name] ?? 0) - (before.metrics[name] ?? 0)]),
      ),
    },
  };
}

async function wait(page, ms = 1000) {
  await page.waitForTimeout(ms);
}

async function diagnostic(page, cdp, name) {
  const traceEvents = [];
  cdp.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value));
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
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

async function runCondition(browser, base, assetPaths, profile, kind, index) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.dpr,
    reducedMotion: 'no-preference',
  });
  const preferenceJson = JSON.stringify({
    effect: kind,
    paused: false,
    reduced: false,
    needsResume: false,
  });
  await context.addInitScript({
    content: `if (location.protocol === 'http:') {
      sessionStorage.setItem('domfx-showcase', ${JSON.stringify(preferenceJson)});
      window.__domfxFirstCanvasAt = null;
      window.__domfxCanvasEvents = [];
      const observer = new MutationObserver((entries) => {
        for (const entry of entries) {
          for (const node of entry.addedNodes) {
            if (node instanceof HTMLCanvasElement && node.closest('[data-effect-host]')) {
              const at = performance.now();
              window.__domfxFirstCanvasAt ??= at;
              window.__domfxCanvasEvents.push({
                at,
                target: node.closest('[data-effect-host]')?.querySelector('[data-effect-target]')?.id,
              });
            }
          }
        }
      });
      window.__domfxCanvasObserver = observer;
      observer.observe(document, { childList: true, subtree: true });
    }`,
  });
  const page = await context.newPage();
  const errors = [];
  const consoleMessages = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
  const condition = { kind, index, errors, consoleMessages, samples: [], outcome: 'running' };
  const missingVisibleCanvas = (state) =>
    state.dom.authoredTargets.filter(
      (target) => state.dom.visibleTargets.includes(target.id) && target.hostCanvasCount === 0,
    );
  const measureWarmLoads = async () => {
    condition.warmLoads = [];
    for (let trial = 0; trial < trials; trial++) {
      await page.evaluate(() => {
        history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
      });
      await wait(page, 100);
      const beforeScrollY = await page.evaluate(() => window.scrollY);
      const warmStart = performance.now();
      await page.reload({ waitUntil: 'load' });
      const wallMs = performance.now() - warmStart;
      const atLoadScrollY = await page.evaluate(() => window.scrollY);
      const navigation = await page.evaluate(() =>
        performance.getEntriesByType('navigation')[0]?.toJSON(),
      );
      if (kind === 'fire') {
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('[data-effect-host]')]
              .filter((host) => {
                const bounds = host.getBoundingClientRect();
                return bounds.bottom > 0 && bounds.top < innerHeight;
              })
              .every((host) => host.querySelector('canvas')),
          null,
          { timeout: 12000 },
        );
      }
      await wait(page);
      const state = await snapshot(page, cdp);
      condition.warmLoads.push({
        wallMs,
        navigation,
        beforeScrollY,
        atLoadScrollY,
        firstCanvasNavigationMs: await page.evaluate(() => window.__domfxFirstCanvasAt),
        state,
      });
      const missing = missingVisibleCanvas(state);
      if (
        beforeScrollY !== 0 ||
        atLoadScrollY !== 0 ||
        state.dom.visibleTargets.length !== 3 ||
        state.dom.effect !== kind ||
        state.dom.reducedMotion ||
        state.dom.pauseLabel !== 'Pause' ||
        (kind === 'fire' && missing.length) ||
        (kind === 'none' && state.dom.effectCanvases.length)
      ) {
        errors.push(`Warm reload ${trial + 1} did not restore the requested visible hero state`);
      }
    }
  };
  try {
    const start = performance.now();
    const response = await page.goto(base, { waitUntil: 'load' });
    condition.loadWallMs = performance.now() - start;
    condition.httpStatus = response?.status();
    condition.navigation = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return n?.toJSON();
    });
    condition.resources = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => ({
        name: new URL(entry.name).pathname,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      })),
    );
    condition.firstCanvasAlreadyAtLoad = await page.evaluate(
      () => window.__domfxFirstCanvasAt !== null,
    );
    const captureStart = performance.now();
    if (kind === 'fire') {
      await page
        .waitForFunction(
          () => document.querySelectorAll('[data-effect-host] canvas').length > 0,
          null,
          { timeout: 12000 },
        )
        .catch((error) => errors.push(`First canvas wait: ${String(error)}`));
    }
    condition.postLoadFirstCanvasWaitMs = kind === 'fire' ? performance.now() - captureStart : null;
    condition.firstCanvasNavigationMs = await page.evaluate(() => window.__domfxFirstCanvasAt);
    condition.assetWarmup = await page.evaluate(async (paths) => {
      const responses = await Promise.all(
        paths.map(async (path) => {
          const response = await fetch(`/${encodeURI(path)}`, { cache: 'force-cache' });
          await response.arrayBuffer();
          return { path, status: response.status };
        }),
      );
      return {
        count: responses.length,
        failures: responses.filter((response) => response.status !== 200),
      };
    }, assetPaths);
    if (condition.assetWarmup.failures.length) {
      errors.push(`Asset warmup failures: ${JSON.stringify(condition.assetWarmup.failures)}`);
    }
    await wait(page, 1500);
    condition.initial = await snapshot(page, cdp);
    condition.initialCanvasInsertions = await page.evaluate(() => {
      window.__domfxCanvasObserver.disconnect();
      return window.__domfxCanvasEvents;
    });
    if (kind === 'fire') {
      const missing = missingVisibleCanvas(condition.initial);
      if (missing.length) {
        errors.push(
          `Visible Fire targets without canvas: ${missing.map((target) => target.id).join(', ')}`,
        );
      }
    } else if (condition.initial.dom.effectCanvases.length) {
      errors.push('None baseline has effect canvases');
    }
    condition.resourcesAfterInitialization = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => ({
        name: new URL(entry.name).pathname,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      })),
    );
    condition.adapter = await page.evaluate(async () => {
      if (!navigator.gpu) {
        return null;
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return null;
      }
      return {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
        timestampQuerySupported: adapter.features.has('timestamp-query'),
      };
    });
    condition.initialProcessTree = await processTreeRss(browser);
    if (warmOnly) {
      await measureWarmLoads();
      if (
        consoleMessages.some((message) => /domfx showcase (failed|unavailable)/.test(message.text))
      ) {
        errors.push('Homepage attachment logged a failure');
      }
      condition.outcome = errors.length ? 'failed' : 'complete';
      return condition;
    }
    if (index === 0) {
      await page.screenshot({ path: resolve(output, `${profile.name}-${kind}.png`) });
    }
    if (kind === 'fire' && condition.initial.dom.effectCanvases.length === 0) {
      errors.push('No effect canvas after initialization');
    }
    await wait(page);
    for (let trial = 0; trial < trials; trial++) {
      condition.samples.push(await sample(page, cdp, 'steady'));
    }
    if (index === 0) {
      if (kind === 'fire') {
        await page.locator('#hero-effect').selectOption('none');
        await wait(page);
        condition.pairedNone = [];
        for (let trial = 0; trial < trials; trial++) {
          condition.pairedNone.push(await sample(page, cdp, 'paired-none'));
        }
        await page.locator('#hero-effect').selectOption('fire');
        await wait(page, 1500);
        condition.pairedFireReturn = await snapshot(page, cdp);
        const missing = missingVisibleCanvas(condition.pairedFireReturn);
        if (missing.length) {
          errors.push(`Fire did not reattach on: ${missing.map((target) => target.id).join(', ')}`);
        }
      }
      condition.diagnostic = await diagnostic(page, cdp, `${profile.name}-${kind}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      condition.samples.push(await sample(page, cdp, 'scroll'));
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(page);
      condition.samples.push(await sample(page, cdp, 'rapid-settings'));
      await wait(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await wait(page);
      condition.offscreen = await snapshot(page, cdp);
      if (
        kind === 'fire' &&
        condition.offscreen.dom.authoredTargets.some(
          (target) => target.id !== 'scroll-target' && target.hostCanvasCount > 0,
        )
      ) {
        errors.push('A hero effect canvas remained while the hero was offscreen');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(page);
      condition.offscreenReturn = await snapshot(page, cdp);
      if (kind === 'fire' && missingVisibleCanvas(condition.offscreenReturn).length) {
        errors.push('A visible Fire target did not reattach after offscreen return');
      }
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await wait(page, 500);
      condition.hiddenSynthetic = await snapshot(page, cdp);
      if (
        !condition.hiddenSynthetic.dom.hidden ||
        condition.hiddenSynthetic.dom.effectCanvases.length !== 0
      ) {
        errors.push('Synthetic hidden state did not release effect canvases');
      }
      await page.evaluate(() => {
        Reflect.deleteProperty(document, 'hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await wait(page);
      condition.hiddenReturn = await snapshot(page, cdp);
      if (kind === 'fire' && missingVisibleCanvas(condition.hiddenReturn).length) {
        errors.push('A visible Fire target did not reattach after synthetic hidden return');
      }
      const coveringTab = await context.newPage();
      await coveringTab.bringToFront();
      await wait(page, 500);
      condition.hiddenNative = await snapshot(page, cdp);
      condition.nativeTabVisibility = condition.hiddenNative.dom.hidden
        ? 'observed'
        : 'unavailable';
      if (
        condition.nativeTabVisibility === 'observed' &&
        condition.hiddenNative.dom.effectCanvases.length !== 0
      ) {
        errors.push('Native hidden tab did not release effect canvases');
      }
      await coveringTab.close();
      await page.bringToFront();
      await wait(page);
      condition.hiddenNativeReturn = await snapshot(page, cdp);
      if (
        condition.hiddenNativeReturn.dom.hidden ||
        (condition.nativeTabVisibility === 'observed' &&
          kind === 'fire' &&
          missingVisibleCanvas(condition.hiddenNativeReturn).length)
      ) {
        errors.push('Native tab return did not restore the requested visible state');
      }
      if (await page.locator('#effect-play').isEnabled()) {
        await page.locator('#effect-play').click();
      }
      condition.pause = await snapshot(page, cdp);
      condition.samples.push(await sample(page, cdp, 'pause'));
      await page.evaluate(() => {
        const input = document.querySelector('#reduce-motion');
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      condition.reducedMotion = await snapshot(page, cdp);
      condition.samples.push(await sample(page, cdp, 'reduced-motion'));
      await page.evaluate(() => {
        const input = document.querySelector('#reduce-motion');
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      condition.reducedMotionReturn = await snapshot(page, cdp);
      await page.locator('#hero-effect').selectOption('none');
      await wait(page);
      condition.componentEffectBaseline = await snapshot(page, cdp);
      if (
        condition.componentEffectBaseline.dom.effect !== 'none' ||
        condition.componentEffectBaseline.dom.effectCanvases.length !== 0
      ) {
        errors.push('Component comparison did not begin with None and zero effect canvases');
      }
      const background = page.locator('.shader-section');
      await background.scrollIntoViewIfNeeded();
      await wait(page);
      condition.backgroundStillState = await snapshot(page, cdp);
      if (condition.backgroundStillState.dom.backgroundPlaying !== 'false') {
        errors.push('Background still baseline was not paused');
      }
      condition.backgroundStill = [];
      for (let trial = 0; trial < trials; trial++) {
        condition.backgroundStill.push(await sample(page, cdp, 'background-still'));
      }
      const backgroundButton = page.locator('.shader-motion');
      if (await backgroundButton.isVisible()) {
        await backgroundButton.click();
        condition.backgroundPlayingState = await snapshot(page, cdp);
        if (condition.backgroundPlayingState.dom.backgroundPlaying !== 'true') {
          errors.push('Background animation did not start');
        }
        condition.backgroundPlaying = [];
        for (let trial = 0; trial < trials; trial++) {
          condition.backgroundPlaying.push(await sample(page, cdp, 'background-playing'));
        }
        await backgroundButton.click();
      } else {
        errors.push('Background animation control unavailable');
      }
      const player = page.locator('.timeline-player');
      await player.scrollIntoViewIfNeeded();
      await page.locator('.player-controls').waitFor({ state: 'visible' });
      await wait(page);
      condition.playerStillState = await snapshot(page, cdp);
      if (condition.playerStillState.dom.playerState !== 'Paused') {
        errors.push('Player still baseline was not paused');
      }
      condition.playerStill = [];
      for (let trial = 0; trial < trials; trial++) {
        condition.playerStill.push(await sample(page, cdp, 'player-still'));
      }
      await page.locator('.timeline-player [name="repeat"]').check();
      await page.locator('.timeline-player [data-action="play"]').click();
      condition.playerPlayingState = await snapshot(page, cdp);
      if (condition.playerPlayingState.dom.playerState !== 'Playing') {
        errors.push('Player did not start playing');
      }
      condition.playerPlaying = [];
      for (let trial = 0; trial < trials; trial++) {
        condition.playerPlaying.push(await sample(page, cdp, 'player-playing'));
      }
      await page.locator('.timeline-player [data-action="pause"]').click();
      await measureWarmLoads();
      condition.beforeTeardown = {
        state: await snapshot(page, cdp),
        processTree: await processTreeRss(browser),
      };
      await page.goto('about:blank');
      await wait(page, 500);
      condition.teardown = {
        page: page.url(),
        canvasCount: await page.evaluate(() => document.querySelectorAll('canvas').length),
        processTree: await processTreeRss(browser),
      };
    }
    if (
      consoleMessages.some((message) => /domfx showcase (failed|unavailable)/.test(message.text))
    ) {
      errors.push('Homepage attachment logged a failure');
    }
    condition.outcome = errors.length ? 'failed' : 'complete';
  } catch (error) {
    errors.push(String(error));
    condition.outcome = 'failed';
  } finally {
    await context.close();
  }
  return condition;
}

let browser;
try {
  const files = (await readdir(dist, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
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
  const assetPaths = result.assets.map((asset) => asset.path);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/`;
  browser = await chromium.launch({
    headless: false,
    executablePath: process.env.DOMFX_BROWSER_EXECUTABLE,
    args: ['--enable-unsafe-webgpu'],
  });
  result.environment.browser = browser.version();
  for (const profile of [
    { name: 'desktop-dpr1', viewport: { width: 1440, height: 900 }, dpr: 1 },
    { name: 'desktop-dpr2', viewport: { width: 1440, height: 900 }, dpr: 2 },
    { name: 'narrow-dpr2', viewport: { width: 360, height: 780 }, dpr: 2 },
  ]) {
    const record = { ...profile, conditions: [] };
    result.profiles.push(record);
    for (const kind of ['none', 'fire']) {
      for (let index = 0; index < (warmOnly ? 1 : trials); index++) {
        const condition = await runCondition(browser, base, assetPaths, profile, kind, index);
        record.conditions.push(condition);
        await save('report.json', result);
        console.log(`${profile.name} ${kind} ${index + 1}/${trials}: ${condition.outcome}`);
      }
    }
  }
  result.outcome = result.profiles.every((profile) =>
    profile.conditions.every((condition) => condition.outcome === 'complete'),
  )
    ? 'complete'
    : 'incomplete';
} catch (error) {
  result.errors.push(String(error));
  result.outcome = 'incomplete';
} finally {
  await browser?.close();
  server.close();
  await save('report.json', result);
  console.log(`Homepage measurement ${result.outcome}: ${output}`);
}
if (result.outcome !== 'complete') {
  process.exitCode = 1;
}
