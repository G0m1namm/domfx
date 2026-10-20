import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const children = new Set();
let stopping = false;

function stop(signal = 'SIGTERM') {
  if (!stopping) {
    // Escalate on startup failures as well as explicit shutdown signals.
    const kill = setTimeout(() => stop('SIGKILL'), 3000);
    kill.unref();
  }
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
}

function run(label, args, ready) {
  if (stopping) {
    throw new Error('development stopped');
  }
  const child = spawn('pnpm', args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  let tail = '';
  let resolveReady;
  let rejectReady;
  const readiness = new Promise((resolveReadyPromise, rejectReadyPromise) => {
    resolveReady = resolveReadyPromise;
    rejectReady = rejectReadyPromise;
  });
  function output(chunk) {
    process.stdout.write(`[${label}] ${chunk}`);
    tail = (tail + chunk).slice(-4000);
    if (ready?.test(tail)) {
      resolveReady();
    }
  }
  child.stdout.on('data', output);
  child.stderr.on('data', output);
  const closed = new Promise((resolveClosed, rejectClosed) => {
    child.on('error', (error) => {
      children.delete(child);
      rejectClosed(error);
    });
    child.on('close', (code, signal) => {
      children.delete(child);
      if (code === 0 || stopping) {
        resolveClosed();
      } else {
        rejectClosed(new Error(`${label} exited: ${code ?? signal}`));
      }
    });
  });
  // Observe unexpected exits even after the initial readiness promise resolved.
  void closed.catch((error) => {
    if (!stopping) {
      console.error(error.message);
      process.exitCode = 1;
      stop();
    }
  });
  void closed.then(() => {
    if (ready) {
      rejectReady(new Error(`${label} stopped before readiness`));
      if (!stopping) {
        console.error(`${label} stopped unexpectedly`);
        process.exitCode = 1;
        stop();
      }
    } else {
      resolveReady();
    }
  }, rejectReady);
  return { ready: readiness, closed };
}

const shutdown = () => {
  if (stopping) {
    return;
  }
  stop();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await run('build', ['build']).ready;
  const watchers = [
    run(
      'core',
      [
        '--filter',
        '@domfx/core',
        'exec',
        'tsc',
        '-p',
        'tsconfig.json',
        '--watch',
        '--preserveWatchOutput',
        '--noEmitOnError',
      ],
      /Found 0 errors/,
    ),
    run(
      'browser',
      ['--filter', '@domfx/browser', 'exec', 'vite', 'build', '--watch', '--emptyOutDir', 'false'],
      /built in \d/,
    ),
    run(
      'declarations',
      [
        '--filter',
        '@domfx/browser',
        'exec',
        'tsc',
        '-p',
        'tsconfig.json',
        '--emitDeclarationOnly',
        '--watch',
        '--preserveWatchOutput',
        '--noEmitOnError',
      ],
      /Found 0 errors/,
    ),
    run(
      'gsap',
      [
        '--filter',
        '@domfx/gsap',
        'exec',
        'tsc',
        '-p',
        'tsconfig.json',
        '--watch',
        '--preserveWatchOutput',
        '--noEmitOnError',
      ],
      /Found 0 errors/,
    ),
  ];
  await Promise.all(watchers.map((watcher) => watcher.ready));
  const server = run(
    'web',
    [
      '--filter',
      '@domfx/web',
      'dev',
      '--ignore-lock',
      ...process.argv.slice(2).filter((arg) => arg !== '--'),
    ],
    /domfx website ready/,
  );
  await server.ready;
  console.log('domfx development ready: built exports, declarations and website are watching.');
  await Promise.all([...watchers, server].map((process) => process.closed));
} catch (error) {
  if (!stopping) {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  }
}
