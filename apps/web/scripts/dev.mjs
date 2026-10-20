import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { dev } from 'astro';

// Keep each Astro app in its own process: content stores are process-wide.
if (process.argv[2] === '--docs-child') {
  const server = await dev({
    root: new URL('../../docs/', import.meta.url),
    server: { host: '127.0.0.1', port: 0 },
  });
  process.send({ port: server.address.port });
  let stopping = false;
  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    await server.stop();
    process.disconnect();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.on('disconnect', stop);
} else {
  const children = new Set();
  let stopping = false;
  const stop = () => {
    if (stopping) {
      return;
    }
    stopping = true;
    for (const child of children) {
      child.kill('SIGTERM');
    }
    const deadline = setTimeout(() => {
      for (const child of children) {
        child.kill('SIGKILL');
      }
    }, 3000);
    deadline.unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  function own(child) {
    children.add(child);
    child.on('error', (error) => {
      console.error(error);
      process.exitCode = 1;
      stop();
    });
    child.on('exit', (code) => {
      children.delete(child);
      if (!stopping) {
        process.exitCode = code || 1;
        stop();
      }
    });
    return child;
  }
  const docs = own(fork(fileURLToPath(import.meta.url), ['--docs-child'], { stdio: 'inherit' }));
  docs.once('message', ({ port }) => {
    if (stopping) {
      return;
    }
    const cli = fileURLToPath(
      new URL('./bin/astro.mjs', import.meta.resolve('astro/package.json')),
    );
    const web = own(
      spawn(
        process.execPath,
        [
          cli,
          'dev',
          '--ignore-lock',
          '--host',
          '127.0.0.1',
          ...process.argv.slice(2).filter((argument) => argument !== '--ignore-lock'),
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, DOMFX_DOCS_DEV_URL: `http://127.0.0.1:${port}` },
        },
      ),
    );
    let output = '';
    const show = (chunk) => {
      process.stdout.write(chunk);
      output = (output + chunk).slice(-4000);
      if (/Local\s+http/.test(output)) {
        console.log('domfx website ready');
        output = '';
      }
    };
    web.stdout.on('data', show);
    web.stderr.on('data', show);
  });
}
