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

import { validateArtifact } from './check-release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'domfx-release-'));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = {
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
  for (const path of ['packages/core', 'packages/domfx', 'packages/gsap']) {
    const manifest = readJson(join(root, path, 'package.json'));
    assert.equal(manifest.private, true, 'rehearsal must keep publishing disabled');
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
    const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n');
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
      assert.doesNotMatch(file.path, /(?:^|[/.])(?:__tests__|fixtures?|tests?|spec|env)(?:[/.]|$)/);
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
    const installedDependencies = { ...dependencies };
    if (kind === 'standalone') {
      delete installedDependencies['@domfx/gsap'];
      cpSync(join(root, 'scripts/fixtures/packed-contracts'), join(cwd, 'contracts'), {
        recursive: true,
      });
    } else {
      installedDependencies.gsap = version('apps/lab/node_modules/gsap');
    }
    writeJson(join(cwd, 'package.json'), {
      name: `domfx-release-${kind}`,
      private: true,
      type: 'module',
      dependencies: installedDependencies,
      devDependencies: {
        typescript: version('node_modules/typescript'),
        vite: version('apps/lab/node_modules/vite'),
      },
    });
    // Published workspace ranges resolve to these exact tarballs until registry publication exists.
    writeFileSync(
      join(cwd, 'pnpm-workspace.yaml'),
      `autoInstallPeers: false\nstrictPeerDependencies: true\noverrides:\n  '@domfx/core': ${JSON.stringify(dependencies['@domfx/core'])}\n`,
    );
    run(cwd, 'pnpm', ['install', '--ignore-scripts']);
    const installedPaths = {};
    for (const name of Object.keys(installedDependencies)) {
      installedPaths[name] = realpathSync(join(cwd, 'node_modules', name));
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
      ]);
    }
    run(cwd, 'pnpm', ['exec', 'vite', 'build']);
    const consumer = {
      kind,
      directory: cwd,
      installedPaths,
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
        args: ['--enable-unsafe-webgpu'],
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
      consumer.outcome = 'PASS';
      console.log(
        `${kind}: production public API, SSR and strict types PASS (${JSON.stringify(consumer.environment.gpu)})`,
      );
    } catch (error) {
      consumer.outcome = 'FAIL';
      consumer.error = String(error);
      if (page && !page.isClosed()) {
        try {
          consumer.pageReport = await page.locator('#report').textContent();
          await page.screenshot({ path: join(cwd, 'failure.png') });
        } catch (evidenceError) {
          consumer.errors.push(`Failure evidence unavailable: ${evidenceError}`);
        }
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
