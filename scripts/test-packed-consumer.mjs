import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium } from 'playwright';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'domfx-packed-'));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const run = (cwd, command, args) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', timeout: 180_000 });

console.log(`Packed consumer and evidence: ${directory}`);
const artifacts = join(directory, 'artifacts');
mkdirSync(artifacts);
function pack(cwd) {
  const manifest = readJson(join(cwd, 'package.json'));
  run(cwd, 'pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', artifacts]);
  return join(
    artifacts,
    `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`,
  );
}
const core = pack(join(root, 'packages/core'));
const browserPackage = pack(join(root, 'packages/domfx'));
const viteVersion = readJson(join(root, 'tests/gpu/node_modules/vite/package.json')).version;
const gsapVersion = readJson(join(root, 'tests/gpu/node_modules/gsap/package.json')).version;

function consumer(name, artifact) {
  const cwd = join(directory, name);
  mkdirSync(cwd);
  cpSync(join(root, 'tests/gpu/src'), join(cwd, 'src'), { recursive: true });
  cpSync(join(root, 'tests/gpu/index.html'), join(cwd, 'index.html'));
  cpSync(join(root, 'tests/gpu/public'), join(cwd, 'public'), { recursive: true });
  // Deliberately no workspace packages, source aliases, or consumer Vite/TypeGPU config.
  writeJson(join(cwd, 'package.json'), {
    name: `domfx-packed-${name}`,
    private: true,
    type: 'module',
    dependencies: {
      '@domfx/core': `file:${core}`,
      '@domfx/browser': `file:${artifact}`,
      gsap: gsapVersion,
    },
    devDependencies: { vite: viteVersion },
  });
  writeFileSync(
    join(cwd, 'pnpm-workspace.yaml'),
    `overrides:\n  '@domfx/core': ${JSON.stringify(`file:${core}`)}\n`,
  );
  run(cwd, 'pnpm', ['install', '--ignore-scripts']);
  return cwd;
}

async function serve(cwd, production) {
  const child = spawn(
    process.execPath,
    [
      join(cwd, 'node_modules/vite/bin/vite.js'),
      ...(production ? ['preview'] : []),
      '--host',
      '127.0.0.1',
      '--port',
      '0',
    ],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  try {
    const url = await new Promise((resolveUrl, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Vite startup timeout: ${output}`)),
        30_000,
      );
      const failed = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      child.once('error', failed);
      child.once('exit', (code) => failed(new Error(`Vite exited ${code}: ${output}`)));
      const collect = (chunk) => {
        output += chunk.toString();
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) {
          clearTimeout(timeout);
          resolveUrl(match[0]);
        }
      };
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
    });
    return { child, url };
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function verify(browser, cwd, production, missingTransform) {
  const label = `${missingTransform ? 'missing-transform' : 'packed'}-${production ? 'production' : 'development'}`;
  const server = await serve(cwd, production);
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  try {
    await page.goto(server.url);
    await page.waitForFunction(
      () => {
        const text = document.getElementById('report')?.textContent;
        return text?.startsWith('{') && JSON.parse(text).outcome;
      },
      null,
      { timeout: 180_000 },
    );
    let report = JSON.parse(await page.locator('#report').innerText());
    writeJson(join(directory, `${label}.json`), report);
    if (missingTransform) {
      assert.equal(report.outcome, 'FAIL');
      assert.match(
        report.error,
        /is not marked with the 'use gpu' directive and cannot be used in a shader/,
      );
    } else {
      assert.match(report.outcome, /^PASS:/, JSON.stringify(report));
      assert.equal(report.fire.pass, true);
      assert.equal(report.fire.time1_5Hash, report.fire.seekBackHash);
      assert.notEqual(report.fire.time1_5Hash, report.fire.time2_5Hash);
      assert.deepEqual(report.gpuErrors, []);
      for (const control of ['play', 'seek', 'reverse', 'dispose']) {
        await page.locator(`#${control}`).click();
      }
      report = JSON.parse(await page.locator('#report').innerText());
      assert.deepEqual(report.disposal, {
        managedBytes: 0,
        attachmentReservedBytes: 0,
        overlayRemoved: true,
      });
      writeJson(join(directory, `${label}.json`), report);
      await page.screenshot({ path: join(directory, `${label}.png`), fullPage: true });
    }
    console.log(
      `${label}: PASS${missingTransform ? ' (missing shader metadata rejected)' : ` (${JSON.stringify(report.environment)})`}`,
    );
  } finally {
    await page.close();
    server.child.kill();
  }
}

const positive = consumer('positive', browserPackage);
run(positive, 'pnpm', ['exec', 'vite', 'build']);
// Repack a disposable copy with plain TypeScript output to simulate a missing build plugin.
// Neither the workspace build nor the positive consumer is modified.
const broken = join(directory, 'untransformed-package');
mkdirSync(broken);
run(broken, 'tar', ['-xzf', browserPackage, '--strip-components=1']);
const plain = ts.transpileModule(readFileSync(join(root, 'packages/domfx/src/gpu.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
assert.ok(!plain.includes('__TYPEGPU_META__'));
// Preserve the experimental surface used by fixtures; only the GPU module loses
// shader metadata. Missing exports/imports would test a broken bundle instead.
cpSync(join(broken, 'dist/experimental.js'), join(broken, 'dist/transformed-experimental.js'));
writeFileSync(join(broken, 'dist/gpu.js'), plain);
writeFileSync(
  join(broken, 'dist/effect-error.js'),
  ts.transpileModule(readFileSync(join(root, 'packages/domfx/src/effect-error.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText,
);
writeFileSync(
  join(broken, 'dist/experimental.js'),
  "export * from './transformed-experimental.js';\nexport { GpuExperiment, decodeFloat16 } from './gpu.js';\n",
);
const brokenManifest = readJson(join(broken, 'package.json'));
brokenManifest.version = '0.0.0-missing-transform';
writeJson(join(broken, 'package.json'), brokenManifest);
const negative = consumer('negative', pack(broken));
run(negative, 'pnpm', ['exec', 'vite', 'build']);

const browser = await chromium.launch({ headless: false });
try {
  for (const production of [false, true]) {
    await verify(browser, positive, production, false);
    await verify(browser, negative, production, true);
  }
} finally {
  await browser.close();
}
console.log(
  `All packed GPU gates passed. Reports, screenshots, tarballs and consumers retained at ${directory}`,
);
