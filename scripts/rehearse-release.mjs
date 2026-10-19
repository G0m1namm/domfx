import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import {
  assertReleaseVisibility,
  publishedArtifactMatches,
  registryMetadata,
  testedReleaseArtifacts,
  validateArtifact,
} from './check-release-artifacts.mjs';
import { captureFailureEvidence } from './release-failure-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const registry = process.argv[2] === '--registry';
// These same strings are rendered verbatim by Astro and tested by the website suite.
const { gsapCode, standaloneCode } = await import(
  pathToFileURL(join(root, 'apps/web/src/content/examples.ts')).href
);
const directory = process.env.DOMFX_RELEASE_OUTPUT_DIR
  ? resolve(process.env.DOMFX_RELEASE_OUTPUT_DIR)
  : mkdtempSync(join(tmpdir(), 'domfx-release-'));
mkdirSync(directory, { recursive: true });
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = {
  mode: registry ? 'registry' : 'local-tarballs',
  outcome: 'RUNNING',
  startedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  lockfileSha256: hash(readFileSync(join(root, 'pnpm-lock.yaml'))),
  artifacts: [],
  consumers: [],
};
const save = () => writeJson(join(directory, 'report.json'), report);
let commandNumber = 0;
function run(cwd, command, args) {
  const log = join(directory, `command-${++commandNumber}.log`);
  console.log(`${command} ${args.join(' ')} (${cwd})`);
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: 180_000,
      stdio: 'pipe',
    });
    writeFileSync(log, output);
  } catch (error) {
    writeFileSync(log, `${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    throw new Error(`Command failed; see ${log}`, { cause: error });
  }
}
const version = (path) => readJson(join(root, path, 'package.json')).version;
const artifacts = join(directory, 'artifacts');
mkdirSync(artifacts);
console.log(`Release rehearsal consumers, tarballs and evidence: ${directory}`);
save();

try {
  const dependencies = {};
  if (registry) {
    assert.ok(
      process.argv[3] && process.argv[4],
      'provide tested publication evidence and approved revision',
    );
    assert.equal(
      report.revision,
      process.argv[4],
      'registry recipe checkout must match the released revision',
    );
    report.registry = [];
    for (const artifact of testedReleaseArtifacts(resolve(process.argv[3]), process.argv[4])) {
      const metadata = registryMetadata(`${artifact.name}@${artifact.version}`);
      assert.ok(metadata, 'published package missing');
      publishedArtifactMatches(artifact, metadata);
      dependencies[artifact.name] = artifact.version;
      report.registry.push({
        name: artifact.name,
        version: artifact.version,
        dist: metadata.dist,
        tags: metadata['dist-tags'],
      });
    }
  } else {
    for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
      const manifest = readJson(join(root, path, 'package.json'));
      assertReleaseVisibility(path, manifest);
      run(join(root, path), 'pnpm', [
        '--config.ignore-scripts=true',
        'pack',
        '--pack-destination',
        artifacts,
      ]);
      const tarball = join(
        artifacts,
        `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`,
      );
      const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
        .trim()
        .split('\n');
      assert.ok(
        entries.every((entry) => entry.startsWith('package/') && !entry.split('/').includes('..')),
      );
      const files = entries
        .filter((entry) => !entry.endsWith('/'))
        .map((entry) => ({ path: entry.slice(8) }));
      const packedManifest = JSON.parse(
        execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }),
      );
      assert.deepEqual(validateArtifact(manifest, { ...packedManifest, files }), []);
      let shaderMetadata = false;
      for (const file of files) {
        assert.doesNotMatch(
          file.path,
          /(?:^|[/.])(?:__tests__|fixtures?|tests?|spec|env)(?:[/.]|$)/,
        );
        const contents = execFileSync('tar', ['-xOf', tarball, `package/${file.path}`], {
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
        });
        assert.ok(
          !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|npm_)[A-Za-z0-9]{30,}\b/.test(
            contents,
          ),
          `credential signature in ${file.path}`,
        );
        shaderMetadata ||= file.path.endsWith('.js') && contents.includes('__TYPEGPU_META__');
      }
      if (manifest.name === '@domfx/browser') {
        assert.ok(shaderMetadata, 'packed browser requires transformed shader metadata');
      }
      if (manifest.name === '@domfx/gsap') {
        assert.deepEqual(packedManifest.peerDependencies, { gsap: '^3.15.0' });
        assert.equal(packedManifest.dependencies.gsap, undefined);
        assert.notEqual(packedManifest.peerDependenciesMeta?.gsap?.optional, true);
      }
      dependencies[manifest.name] = `file:${tarball}`;
      report.artifacts.push({
        tarball,
        sha256: hash(readFileSync(tarball)),
        manifest: packedManifest,
        files,
      });
      save();
    }
  }

  for (const kind of ['standalone', 'gsap']) {
    const cwd = join(directory, kind);
    mkdirSync(cwd);
    for (const file of [
      'index.html',
      'lifecycle.ts',
      ...(kind === 'gsap' ? ['ssr-gsap.mjs'] : []),
    ]) {
      cpSync(join(root, 'scripts/fixtures/release-consumer', file), join(cwd, file));
    }
    cpSync(join(root, `scripts/fixtures/release-consumer/${kind}.ts`), join(cwd, 'main.ts'));
    cpSync(join(root, `examples/quickstart/${kind}.ts`), join(cwd, 'quickstart.ts'));
    writeFileSync(
      join(cwd, 'recipe.html'),
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>Own heading recipe</title><link rel="icon" href="data:,"><style>body{margin:128px;background:#14151B;color:white;font:24px sans-serif}#recipe-host{position:relative;padding:60px;width:280px}h1{font:24px sans-serif;user-select:text}</style><div id="recipe-host"><h1 id="recipe-target">Your own heading</h1></div><script type="module" src="/recipe.ts"></script></html>`,
    );
    writeFileSync(
      join(cwd, 'recipe.ts'),
      `const host = document.querySelector('#recipe-host');
const target = document.querySelector('#recipe-target');
if (!(host instanceof HTMLElement) || !target) throw new Error('fixture DOM');
${kind === 'gsap' ? gsapCode : standaloneCode}
Object.assign(window, { recipe: { fire${kind === 'gsap' ? ', timeline, binding, cleanup' : ''} } });`,
    );
    writeFileSync(
      join(cwd, 'vite.config.mjs'),
      "export default { build: { rollupOptions: { input: { lifecycle: 'index.html', recipe: 'recipe.html' } } } };\n",
    );
    const installedDependencies = { ...dependencies };
    if (kind === 'standalone') {
      delete installedDependencies['@domfx/gsap'];
      cpSync(join(root, 'scripts/fixtures/packed-contracts'), join(cwd, 'contracts'), {
        recursive: true,
      });
    } else {
      installedDependencies.gsap = version('tests/gpu/node_modules/gsap');
    }
    writeJson(join(cwd, 'package.json'), {
      name: `domfx-release-${kind}`,
      private: true,
      type: 'module',
      dependencies: installedDependencies,
      devDependencies: {
        typescript: version('node_modules/typescript'),
        vite: version('tests/gpu/node_modules/vite'),
      },
    });
    // Published workspace ranges resolve to these exact tarballs until registry publication exists.
    writeFileSync(
      join(cwd, 'pnpm-workspace.yaml'),
      `autoInstallPeers: false\nstrictPeerDependencies: true\n${registry ? '' : `overrides:\n  '@domfx/core': ${JSON.stringify(dependencies['@domfx/core'])}\n`}`,
    );
    run(cwd, 'pnpm', ['install', '--ignore-scripts']);
    const installedPaths = {};
    const installedVersions = {};
    const consumerLockfileSha256 = hash(readFileSync(join(cwd, 'pnpm-lock.yaml')));
    for (const name of Object.keys(installedDependencies)) {
      installedPaths[name] = realpathSync(join(cwd, 'node_modules', name));
      installedVersions[name] = readJson(join(installedPaths[name], 'package.json')).version;
      if (registry) {
        assert.equal(
          installedVersions[name],
          installedDependencies[name],
          `registry resolved version for ${name}`,
        );
      }
      assert.ok(
        installedPaths[name].startsWith(`${realpathSync(cwd)}/`),
        `workspace link: ${name}`,
      );
    }
    if (kind === 'standalone') {
      assert.ok(
        !readdirSync(join(cwd, 'node_modules/.pnpm')).some((name) => /(?:^|\+)gsap[@+]/.test(name)),
        'standalone must not install GSAP',
      );
      for (const entry of ['@domfx/core', '@domfx/browser', '@domfx/browser/experimental']) {
        for (const mode of ['absent', 'guarded']) {
          run(cwd, process.execPath, ['contracts/imports.mjs', entry, mode]);
        }
      }
      run(cwd, process.execPath, ['contracts/types.mjs']);
    } else {
      run(cwd, process.execPath, ['ssr-gsap.mjs']);
    }
    for (const module of ['NodeNext', 'ESNext']) {
      run(cwd, 'pnpm', [
        'exec',
        'tsc',
        '--strict',
        '--noEmit',
        '--skipLibCheck',
        'false',
        '--target',
        'ES2022',
        '--module',
        module,
        '--moduleResolution',
        module === 'NodeNext' ? 'NodeNext' : 'Bundler',
        '--lib',
        'ES2022,DOM,DOM.Iterable',
        'main.ts',
        'recipe.ts',
      ]);
    }
    run(cwd, 'pnpm', ['exec', 'vite', 'build']);
    const consumer = {
      kind,
      directory: cwd,
      installedPaths,
      installedVersions,
      consumerLockfileSha256,
      outcome: 'RUNNING',
      errors: [],
      assets: {},
    };
    for (const asset of readdirSync(join(cwd, 'dist/assets'))) {
      consumer.assets[asset] = hash(readFileSync(join(cwd, 'dist/assets', asset)));
    }
    report.consumers.push(consumer);
    save();
    // Use the consumer's installed Vite, with no repository config, aliases or transforms.
    const { preview } = await import(
      pathToFileURL(join(cwd, 'node_modules/vite/dist/node/index.js')).href
    );
    const server = await preview({
      root: cwd,
      configFile: false,
      preview: { host: '127.0.0.1', port: 0 },
    });
    let browser;
    let page;
    try {
      browser = await chromium.launch({
        channel: 'chromium',
        headless: false,
        ...(process.env.DOMFX_BROWSER_EXECUTABLE
          ? { executablePath: process.env.DOMFX_BROWSER_EXECUTABLE }
          : {}),
        args: [
          '--enable-unsafe-webgpu',
          ...(process.env.DOMFX_GPU_BACKEND === 'swiftshader'
            ? process.platform === 'linux'
              ? [
                  '--enable-features=Vulkan',
                  '--use-angle=vulkan',
                  '--use-vulkan=swiftshader',
                  '--use-webgpu-adapter=swiftshader',
                  '--disable-vulkan-surface',
                ]
              : ['--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
            : []),
        ],
      });
      consumer.browser = browser.version();
      page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
      });
      page.on('pageerror', (error) => {
        consumer.errors.push(String(error));
        console.error(error);
        save();
      });
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consumer.errors.push(message.text());
        }
      });
      await page.addInitScript(() => {
        globalThis.releaseGpu = [];
        if (typeof GPUAdapter !== 'undefined') {
          const requestDevice = GPUAdapter.prototype.requestDevice;
          GPUAdapter.prototype.requestDevice = async function (...args) {
            const device = await Reflect.apply(requestDevice, this, args);
            globalThis.releaseGpu.push({
              vendor: this.info.vendor,
              architecture: this.info.architecture,
              device: this.info.device,
              description: this.info.description,
            });
            device.addEventListener('uncapturederror', (event) =>
              console.error(event.error.message),
            );
            return device;
          };
        }
      });
      const address = server.httpServer.address();
      assert.ok(address && typeof address !== 'string');
      await page.goto(`http://127.0.0.1:${address.port}`);
      await page.waitForFunction(
        () => document.querySelector('#report')?.textContent?.startsWith('{'),
        null,
        { timeout: 180_000 },
      );
      consumer.result = JSON.parse(await page.locator('#report').innerText());
      consumer.environment = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        gpu: globalThis.releaseGpu,
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        visibility: document.visibilityState,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      }));
      for (const [label, pixels] of Object.entries(consumer.result.pixels)) {
        writeFileSync(join(cwd, `${label}.png`), Buffer.from(pixels.png.split(',')[1], 'base64'));
        delete pixels.png;
      }
      await page.screenshot({ path: join(cwd, 'page.png'), fullPage: true });
      assert.equal(consumer.result.outcome, 'PASS', JSON.stringify(consumer.result));
      assert.ok(consumer.environment.gpu.length > 0, 'actual GPU device evidence required');
      assert.deepEqual(consumer.errors, []);
      await page.goto(`http://127.0.0.1:${address.port}/recipe.html`);
      await page.waitForFunction(() => window.recipe?.fire.lifecycle === 'active');
      const recipeCanvas = page.locator('#recipe-host canvas');
      assert.equal(await recipeCanvas.count(), 1);
      if (kind === 'gsap') {
        const controls = await page.evaluate(() => {
          const { fire, timeline } = window.recipe;
          timeline.pause().seek(2.5);
          const forward = { time: fire.time, intensity: fire.intensity };
          timeline.seek(1.5);
          return { forward, backward: { time: fire.time, intensity: fire.intensity } };
        });
        assert.equal(controls.forward.time, 2);
        assert.ok(Math.abs(controls.forward.intensity - 0.6) < 1e-6);
        assert.equal(controls.backward.time, 1);
        await page.evaluate(() => {
          window.recipe.timeline.reverse();
        });
        await page.waitForFunction(() => window.recipe.fire.time < 0.9);
        await page.evaluate(() => {
          window.recipe.timeline.pause().seek(1.5);
        });
      } else {
        await page.evaluate(() => window.recipe.fire.pause());
      }
      await page.evaluate(() => {
        window.recipe.fire.intensity = 0;
      });
      const baseline = await recipeCanvas.screenshot();
      await page.evaluate(() => {
        window.recipe.fire.intensity = 0.8;
      });
      assert.notDeepEqual(
        await recipeCanvas.screenshot(),
        baseline,
        'heading recipe GPU output must change pixels',
      );
      // Native mouse selection on the real heading; a synthetic Selection is no proof.
      const rect = await page.locator('#recipe-target').evaluate((element) => {
        window.releaseSelectionEvents = [];
        for (const type of [
          'pointermove',
          'pointerdown',
          'pointerup',
          'mousemove',
          'mousedown',
          'mouseup',
          'selectionchange',
        ]) {
          document.addEventListener(
            type,
            (event) => {
              window.releaseSelectionEvents.push({
                type,
                target: event.target?.id ?? event.target?.nodeName,
                ...(event instanceof MouseEvent
                  ? { x: event.clientX, y: event.clientY, buttons: event.buttons }
                  : {}),
              });
            },
            { capture: true },
          );
        }
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getClientRects()[0];
        return {
          left: rect.left,
          right: rect.right,
          y: rect.top + rect.height / 2,
          bounds: rect.toJSON(),
        };
      });
      const start = { x: rect.left + 1, y: rect.y };
      const end = { x: rect.right - 1, y: rect.y };
      const beforeSelection = await page.evaluate(
        ({ start, end, textBounds }) => ({
          start,
          end,
          textBounds,
          startHit: document.elementFromPoint(start.x, start.y)?.id,
          endHit: document.elementFromPoint(end.x, end.y)?.id,
          targetBounds: document.querySelector('#recipe-target').getBoundingClientRect().toJSON(),
          activeElement: document.activeElement?.id,
          documentHasFocus: document.hasFocus(),
          userSelect: getComputedStyle(document.querySelector('#recipe-target')).userSelect,
        }),
        { start, end, textBounds: rect.bounds },
      );
      await page.mouse.move(rect.left + 1, rect.y);
      await page.mouse.down();
      await page.mouse.move(rect.right - 1, rect.y, { steps: 10 });
      await page.mouse.up();
      const afterSelection = await page.evaluate(
        ({ start, end }) => ({
          selectedText: getSelection()?.toString() ?? '',
          anchorOffset: getSelection()?.anchorOffset ?? null,
          focusOffset: getSelection()?.focusOffset ?? null,
          selectionCollapsed: getSelection()?.isCollapsed ?? null,
          targetBounds: document.querySelector('#recipe-target').getBoundingClientRect().toJSON(),
          activeElement: document.activeElement?.id,
          documentHasFocus: document.hasFocus(),
          startHit: document.elementFromPoint(start.x, start.y)?.id,
          endHit: document.elementFromPoint(end.x, end.y)?.id,
          events: window.releaseSelectionEvents,
        }),
        { start, end },
      );
      consumer.nativeSelection = { before: beforeSelection, after: afterSelection };
      assert.ok(afterSelection.selectedText.length > 0, 'native mouse selection');
      await recipeCanvas.screenshot({ path: join(cwd, 'heading-recipe.png') });
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
      assert.equal(await recipeCanvas.count(), 0);
      assert.equal(await page.evaluate(() => window.recipe.fire.lifecycle), 'disposed');
      consumer.recipe = {
        outcome: 'PASS',
        target: 'own selectable heading',
        sourceSha256: hash(Buffer.from(kind === 'gsap' ? gsapCode : standaloneCode)),
        checks: [
          'active GPU attachment',
          'GPU pixel change',
          'native mouse selection',
          ...(kind === 'gsap' ? ['own timeline', 'forward/backward seek', 'reverse playback'] : []),
          'pagehide cleanup',
        ],
      };
      assert.deepEqual(consumer.errors, []);
      consumer.outcome = 'PASS';
      console.log(
        `${kind}: production public API, SSR and strict types PASS (${JSON.stringify(consumer.environment.gpu)})`,
      );
    } catch (error) {
      consumer.outcome = 'FAIL';
      consumer.error = String(error);
      if (page && !page.isClosed()) {
        await captureFailureEvidence(page, consumer, join(cwd, 'failure.png'));
      }
      throw error;
    } finally {
      await browser?.close();
      await new Promise((resolveClose, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolveClose())),
      );
      save();
    }
  }
  report.outcome = 'PASS';
} catch (error) {
  report.outcome = 'FAIL';
  report.error = String(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  save();
  console.log(`Release rehearsal ${report.outcome}: ${join(directory, 'report.json')}`);
}
