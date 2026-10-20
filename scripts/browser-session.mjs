import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [command, ...args] = process.argv.slice(2);

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error.code === 'EPERM' && process.platform === 'darwin') {
      // macOS can report EPERM as an exiting group disappears. Confirm it is gone.
      const groups = execFileSync('ps', ['-axo', 'pgid='], { encoding: 'utf8' });
      if (!groups.split(/\s+/).includes(String(pid))) {
        return false;
      }
    }
    if (error.code !== 'ESRCH') {
      throw error;
    }
    return false;
  }
}

async function run() {
  if (!command || process.platform === 'win32') {
    throw new Error('Usage (macOS/Linux): node scripts/browser-session.mjs <command> [args...]');
  }
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  }).trim();
  const lock = join(common, 'domfx-browser-session');
  const record = join(lock, 'owner.json');
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    let owner = 'Owner record is incomplete; inspect the lock before removing it.';
    try {
      const info = JSON.parse(readFileSync(record, 'utf8'));
      owner = `PID ${info.pid}, worktree ${info.worktree}, started ${info.startedAt}`;
    } catch {
      // A competing owner may still be writing its record.
    }
    throw new Error(`Browser session is owned: ${owner}\nOwner record: ${record}`);
  }

  let child;
  let interrupted;
  let killTimer;
  const stop = (signal) => {
    interrupted ??= signal;
    if (child?.pid) {
      signalGroup(child.pid, signal);
      killTimer ??= setTimeout(() => signalGroup(child.pid, 'SIGKILL'), 3000);
      killTimer.unref();
    }
  };
  const interrupt = () => stop('SIGINT');
  const terminate = () => stop('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    const owner = {
      pid: process.pid,
      worktree: process.cwd(),
      command: [command, ...args],
      startedAt: new Date().toISOString(),
    };
    writeFileSync(record, `${JSON.stringify(owner, null, 2)}\n`);
    child = spawn(command, args, { detached: true, stdio: 'inherit' });
    const finished = once(child, 'close');
    if (child.pid) {
      writeFileSync(record, `${JSON.stringify({ ...owner, processGroup: child.pid }, null, 2)}\n`);
    }
    const [code, signal] = await finished;
    const outcome = interrupted ?? signal;
    return outcome === 'SIGINT' ? 130 : outcome === 'SIGTERM' ? 143 : (code ?? 1);
  } finally {
    clearTimeout(killTimer);
    if (child?.pid && signalGroup(child.pid, 'SIGTERM')) {
      // Clean descendants even when their command leader has already exited.
      for (let attempt = 0; attempt < 60 && signalGroup(child.pid, 0); attempt++) {
        await delay(50);
      }
      signalGroup(child.pid, 'SIGKILL');
    }
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    rmSync(lock, { recursive: true });
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
