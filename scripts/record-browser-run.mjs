// Records a browser run in installed Chrome: environment, source revision, suite results.
// Usage: node scripts/record-browser-run.mjs [--skip-build]
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import os from 'node:os';
import { join, resolve } from 'node:path';

import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const windows = process.platform === 'win32';
const pnpm = windows ? 'pnpm.cmd' : 'pnpm';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(root, '.scratch', 'browser-run', stamp);
mkdirSync(out, { recursive: true });

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) {
  throw new Error('Commit or discard local changes first; the record names one revision.');
}

// Suite servers need these ports; a server already on one stalls Playwright.
const ports = [4173, 4174, 4322, 4323, 4347];
for (const port of ports) {
  await new Promise((resolveFree, reject) => {
    const server = createServer()
      .once('error', () => reject(new Error(`Port ${port} is in use; stop its server first.`)))
      .listen(port, '127.0.0.1', () => server.close(resolveFree));
  });
}

function run(args, env = {}) {
  console.log(`\n> pnpm ${args.join(' ')}`);
  // On macOS and Linux the session lock keeps other browser runs out; Windows has none.
  const [command, commandArgs] = windows
    ? [pnpm, args]
    : ['node', ['scripts/browser-session.mjs', pnpm, ...args]];
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: windows,
  });
  return result.status ?? 1;
}

if (!process.argv.includes('--skip-build')) {
  for (const step of [['build'], ['build:gpu:built'], ['build:web:built']]) {
    if (spawnSync(pnpm, step, { cwd: root, stdio: 'inherit', shell: windows }).status !== 0) {
      throw new Error(`pnpm ${step.join(' ')} failed`);
    }
  }
}

async function probeBrowser() {
  // WebGPU needs a secure context, so the probe loads a page from 127.0.0.1.
  const server = createHttpServer((_, response) =>
    response.end('<!doctype html><title>probe</title>'),
  );
  await new Promise((listening) => server.listen(0, '127.0.0.1', listening));
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const adapter = await page.evaluate(async () => {
      const found = await navigator.gpu?.requestAdapter();
      if (!found) {
        return null;
      }
      const { vendor, architecture, device, description } = found.info;
      return { vendor, architecture, device, description };
    });
    return { chrome: browser.version(), adapter };
  } finally {
    await browser.close();
    server.close();
  }
}

const suites = [
  { name: 'website', filter: '@domfx/web', outputVar: 'DOMFX_WEB_OUTPUT_DIR' },
  { name: 'docs', filter: '@domfx/docs', outputVar: 'DOMFX_DOCS_OUTPUT_DIR' },
  { name: 'rendering', filter: '@domfx/gpu-tests', outputVar: 'DOMFX_BROWSER_OUTPUT_DIR' },
];

const results = [];
for (const suite of suites) {
  const dir = join(out, suite.name);
  const status = run(['--filter', suite.filter, 'exec', 'playwright', 'test'], {
    DOMFX_BROWSER_CHANNEL: 'chrome',
    [suite.outputVar]: dir,
  });
  let stats;
  try {
    stats = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')).stats;
  } catch {
    stats = undefined;
  }
  results.push({ suite: suite.name, status, stats });
}

const record = {
  recordedAt: new Date().toISOString(),
  revision: git('rev-parse', 'HEAD'),
  lockfileSha256: createHash('sha256')
    .update(readFileSync(join(root, 'pnpm-lock.yaml')))
    .digest('hex'),
  os: { platform: process.platform, release: os.release(), version: os.version(), arch: os.arch() },
  cpu: os.cpus()[0]?.model,
  memoryGiB: Math.round(os.totalmem() / 2 ** 30),
  node: process.version,
  ...(await probeBrowser()),
  results,
};
writeFileSync(join(out, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);

console.log('\nSuite results:');
for (const { suite, status, stats } of results) {
  const counts = stats
    ? `${stats.expected} passed, ${stats.unexpected} failed, ${stats.skipped} skipped, ${stats.flaky} flaky`
    : 'no report';
  console.log(`  ${suite}: ${status === 0 ? 'PASS' : 'FAIL'} (${counts})`);
}
console.log(`\nRecord: ${join(out, 'record.json')}`);
console.log('Next: the Dock pass in engineering/browser-verification.md#dock-pass.');
process.exitCode = results.every(({ status }) => status === 0) ? 0 : 1;
