import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { validateBuiltSite, validatePreviewSite } from './check-site-contract.mjs';

const root = new URL('..', import.meta.url);
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const base = `http://127.0.0.1:${listener.address().port}`;
listener.close();
await once(listener, 'close');
const cleanEnvironment = { ...process.env };
for (const name of [
  'DOMFX_SITE_URL',
  'DOMFX_SITE_PRODUCTION',
  'DOMFX_INDEXING',
  'DOMFX_SITE_PREVIEW',
]) {
  delete cleanEnvironment[name];
}

async function run(args, env, expectedFailure) {
  const child = spawn('pnpm', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      output = (output + chunk).slice(-12000);
      process.stdout.write(chunk);
    });
  }
  const [code] = await once(child, 'close');
  if (expectedFailure) {
    assert(
      code !== 0 && expectedFailure.test(output),
      'production build must fail without an origin',
    );
  } else {
    assert.equal(code, 0, `pnpm ${args.join(' ')} failed`);
  }
}

async function preview(site, indexable, env) {
  const child = spawn(
    process.execPath,
    [
      'node_modules/astro/bin/astro.mjs',
      'preview',
      '--ignore-lock',
      '--host',
      '127.0.0.1',
      '--port',
      new URL(base).port,
    ],
    {
      cwd: new URL('../apps/web', import.meta.url),
      env,
      stdio: 'inherit',
    },
  );
  const closed = once(child, 'close');
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert(child.exitCode === null, 'preview stopped before readiness');
      try {
        ready = (await fetch(base)).ok;
      } catch {
        // The preview server has not bound its port yet.
      }
      if (ready) {
        break;
      }
      await delay(100);
    }
    assert(ready, 'preview did not become ready');
    const result = await validatePreviewSite({ base, site, indexable });
    console.log(
      `HTTP discovery passed: ${result.pages} pages; indexing ${indexable ? 'on' : 'off'}.`,
    );
  } finally {
    child.kill('SIGTERM');
    await closed;
  }
}

await run(
  ['--filter', '@domfx/web', 'build'],
  { ...cleanEnvironment, DOMFX_SITE_PRODUCTION: 'true' },
  /DOMFX_SITE_URL/,
);

for (const [label, variables, site, indexable] of [
  [
    'indexing on',
    {
      DOMFX_SITE_URL: 'https://example.com',
      DOMFX_SITE_PRODUCTION: 'true',
      DOMFX_INDEXING: 'true',
    },
    'https://example.com',
    true,
  ],
  [
    'preview override',
    { DOMFX_SITE_URL: 'https://example.com', DOMFX_INDEXING: 'true', DOMFX_SITE_PREVIEW: 'true' },
    'https://example.com',
    false,
  ],
  ['default off', {}, 'http://127.0.0.1:4321', false],
]) {
  const env = { ...cleanEnvironment, ...variables };
  await run(['build:web:built'], env);
  await validateBuiltSite({
    output: fileURLToPath(new URL('../apps/web/dist', import.meta.url)),
    site,
    indexable,
  });
  await preview(site, indexable, env);
  console.log(`Discovery mode passed: ${label}.`);
}
