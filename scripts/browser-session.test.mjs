import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';

const runner = new URL('./browser-session.mjs', import.meta.url).pathname;
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'domfx-browser-owner-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: directory, env });
  return directory;
}

function run(t, directory, source) {
  const child = spawn(process.execPath, [runner, process.execPath, '-e', source], {
    cwd: directory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const finished = once(child, 'close');
  t.after(() => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
    }
  });
  return { child, finished, output: () => output };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) {
      return;
    }
    await setTimeout(25);
  }
  assert.fail('Timed out waiting for the test process');
}

test('serializes linked worktrees, reports the owner, and releases after cancellation', async (t) => {
  const directory = fixture(t);
  const sibling = join(directory, 'linked');
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '--allow-empty',
      '-qm',
      'fixture',
    ],
    { cwd: directory, env },
  );
  execFileSync('git', ['worktree', 'add', '--detach', sibling], {
    cwd: directory,
    env,
    stdio: 'pipe',
  });
  const first = run(t, directory, "console.log('ready'); setInterval(() => {}, 1000)");
  await waitFor(() => first.output().includes('ready'));
  const lock = join(directory, '.git/domfx-browser-session/owner.json');
  assert.equal(JSON.parse(readFileSync(lock, 'utf8')).pid, first.child.pid);
  const second = run(t, sibling, "console.log('should not start')");
  assert.equal((await second.finished)[0], 1);
  assert.match(second.output(), /Browser session is owned/);
  assert.ok(second.output().includes(directory));
  assert.ok(!second.output().includes('should not start'));
  first.child.kill('SIGTERM');
  assert.equal((await first.finished)[0], 143);
  assert.equal(existsSync(lock), false);
  const third = run(t, sibling, 'process.exit(7)');
  assert.equal((await third.finished)[0], 7);
  assert.equal(existsSync(lock), false);
});

test('cancellation closes owned server descendants and leaves unrelated processes alive', async (t) => {
  const directory = fixture(t);
  const server = join(directory, 'server.cjs');
  writeFileSync(
    server,
    "require('node:http').createServer((_, r) => r.end('ok')).listen(0, '127.0.0.1', function () { console.log('port:' + this.address().port); });",
  );
  const unrelated = spawn(process.execPath, [server], { stdio: ['ignore', 'pipe', 'pipe'] });
  const unrelatedClosed = once(unrelated, 'close');
  t.after(async () => {
    unrelated.kill();
    await unrelatedClosed;
  });
  const owned = run(
    t,
    directory,
    `require('node:child_process').spawn(process.execPath, [${JSON.stringify(server)}], {stdio:'inherit'}); setInterval(() => {}, 1000);`,
  );
  await waitFor(() => /port:\d+/.test(owned.output()));
  const port = Number(owned.output().match(/port:(\d+)/)[1]);
  assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
  owned.child.kill('SIGINT');
  assert.equal((await owned.finished)[0], 130, owned.output());
  await assert.rejects(fetch(`http://127.0.0.1:${port}`));
  assert.equal(unrelated.exitCode, null);
  process.kill(unrelated.pid, 0);
});

test('an incomplete or stale lock is retained for explicit owner inspection', async (t) => {
  const directory = fixture(t);
  const lock = join(directory, '.git/domfx-browser-session');
  mkdirSync(lock);
  const result = run(t, directory, 'process.exit(0)');
  assert.equal((await result.finished)[0], 1);
  assert.match(result.output(), /Browser session is owned/);
  assert.equal(existsSync(lock), true);
});

test('cancellation escalates when the command ignores termination', async (t) => {
  const directory = fixture(t);
  const result = run(
    t,
    directory,
    "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
  );
  await waitFor(() => result.output().includes('ready'));
  result.child.kill('SIGTERM');
  assert.equal((await result.finished)[0], 143);
  assert.equal(existsSync(join(directory, '.git/domfx-browser-session')), false);
});

test('failure to start a command releases ownership', async (t) => {
  const directory = fixture(t);
  const child = spawn(process.execPath, [runner, join(directory, 'missing-command')], {
    cwd: directory,
    env,
    stdio: 'ignore',
  });
  assert.equal((await once(child, 'close'))[0], 1);
  assert.equal(existsSync(join(directory, '.git/domfx-browser-session')), false);
});

test('normal command exit cleans up a server left behind by that command', async (t) => {
  const directory = fixture(t);
  const server = join(directory, 'server.cjs');
  writeFileSync(
    server,
    "require('node:http').createServer((_, r) => r.end('ok')).listen(0, '127.0.0.1', function () { process.send(this.address().port); });",
  );
  const result = run(
    t,
    directory,
    `const child = require('node:child_process').fork(${JSON.stringify(server)}, [], {stdio:['ignore','ignore','ignore','ipc']}); child.on('message', port => { console.log('port:' + port); child.disconnect(); child.unref(); });`,
  );
  assert.equal((await result.finished)[0], 0);
  const port = Number(result.output().match(/port:(\d+)/)[1]);
  await assert.rejects(fetch(`http://127.0.0.1:${port}`));
  assert.equal(existsSync(join(directory, '.git/domfx-browser-session')), false);
});
