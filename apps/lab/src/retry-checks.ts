import { attachFire } from '@domfx/browser';
import { memoryFor } from '@domfx/browser/experimental';

import { createMotionFixture } from './motion-fixture.js';

/** Real capture/GPU retries with controlled admission pressure. */
export async function verifyRetryConditions() {
  const checks: string[] = [];
  function check(condition: boolean, name: string) {
    if (!condition) {
      throw new Error(`retry: ${name}`);
    }
    checks.push(name);
  }
  const memory = memoryFor(document);
  const baseline = memory.bytes;
  const f = createMotionFixture('respect');
  const { effect, target, host } = f;
  effect.pause();
  let disposals = 0;
  effect.onDispose(() => {
    disposals += 1;
  });
  const reservations: ReturnType<typeof memory.reserve>[] = [];
  function fillBudget() {
    for (let i = 0; i < 3; i += 1) {
      reservations.push(
        memory.reserve(
          {},
          {
            managedBytes: 47_990_000,
            captureBytes: 0,
            outputBytes: 0,
          },
        ),
      );
    }
  }
  function releaseBudget() {
    for (const reservation of reservations.splice(0)) {
      reservation.release();
    }
  }
  async function recover() {
    await effect.retry();
    check(effect.lifecycle === 'active' && effect.raster === 'fresh', 'explicit retry recovers');
    check(host.querySelectorAll('canvas').length === 1, 'one fresh canvas');
  }
  try {
    await effect.ready;
    const original = host.querySelector('canvas');
    target.style.opacity = '0.5';
    await effect.retry();
    check(effect.reason === 'unsupported-composition', 'composition is rechecked');
    check(
      original?.width === 0 && !host.querySelector('canvas'),
      'old canvas is removed and zeroed',
    );
    target.style.opacity = '';
    host.style.position = 'static';
    await effect.retry();
    check(effect.reason === 'unsupported-placement', 'host is rechecked');
    host.style.position = 'absolute';
    await recover();
    check(host.querySelector('canvas') !== original, 'retry creates fresh output');
    check(host.querySelector('canvas')?.style.left !== '', 'fresh canvas receives placement');

    const video = document.createElement('video');
    target.append(video);
    await effect.retry();
    check(effect.reason === 'capture-failed', 'assets are rechecked');
    video.remove();
    await recover();

    target.style.width = '3000px';
    await effect.retry();
    check(effect.reason === 'capture-budget', 'capture budget is rechecked');
    target.style.width = '24px';
    fillBudget();
    await effect.retry();
    check(effect.reason === 'aggregate-budget', 'aggregate budget is rechecked');
    releaseBudget();
    await recover();

    // Recheck admission after waiting for an older preparation to drain.
    f.block('prepare');
    const refresh = effect.refresh().catch((error: Error) => error.message);
    await f.entered;
    const pending = effect.retry();
    reservations.push(
      memory.reserve(
        {},
        {
          managedBytes: 48_000_000,
          captureBytes: 0,
          outputBytes: 0,
        },
      ),
    );
    reservations.push(
      memory.reserve(
        {},
        {
          managedBytes: 48_000_000,
          captureBytes: 0,
          outputBytes: 0,
        },
      ),
    );
    // The old small frame fits; the larger retry must fail after teardown.
    reservations.push(
      memory.reserve(
        {},
        {
          managedBytes: 46_500_000,
          captureBytes: 0,
          outputBytes: 0,
        },
      ),
    );
    target.style.width = '50px';
    f.release();
    await pending;
    check((await refresh) === 'refresh-invalidated', 'retry invalidates pending refresh');
    check(effect.reason === 'aggregate-budget', 'budget changes during teardown are rechecked');
    releaseBudget();
    await recover();

    target.style.transform = 'translateY(2000px)';
    await effect.retry();
    check(
      effect.lifecycle === 'suspended' && effect.raster === 'stale',
      'hidden retry cannot commit',
    );
    target.style.transform = '';
    await recover();

    target.style.opacity = '0.5';
    await effect.retry();
    target.style.opacity = '';
    const replacement = attachFire(target, { host });
    try {
      await replacement.ready;
      const canvas = host.querySelector('canvas');
      await effect.retry();
      check(
        effect.reason === 'effect-target-owned',
        'old handle cannot steal replacement ownership',
      );
      check(
        replacement.lifecycle === 'active' && host.querySelector('canvas') === canvas,
        'replacement survives old retry',
      );
    } finally {
      replacement.dispose();
    }
    await recover();
    target.style.opacity = '0.5';
    await effect.retry();
    check(disposals === 0, 'retry preserves disposal subscriptions');
    target.remove();
    host.append(target);
    const rejected = await effect.retry().catch((error: Error) => error.message);
    check(rejected === 'effect-disposed', 'removal of an unavailable target stays terminal');
  } finally {
    releaseBudget();
    f.dispose();
  }
  check(disposals === 1, 'disposal subscription runs once');
  check(memory.bytes === baseline, 'all retry reservations released');
  check(f.stats.services === f.stats.serviceDestroys, 'all retry services released');
  check(f.stats.releases === f.stats.captures - 1, 'successful capture frames released once');
  check(f.stats.destroys === f.stats.preparations, 'prepared frames released once');
  return checks;
}
