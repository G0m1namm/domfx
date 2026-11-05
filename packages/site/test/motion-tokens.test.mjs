import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../../../', import.meta.url).pathname;
const motion = readFileSync(join(root, 'packages/site/src/styles/motion.css'), 'utf8');

function cssFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return cssFiles(path);
    }
    return /\.(css|astro)$/.test(name) ? [path] : [];
  });
}

test('the spring settles on 1 and overshoots by about 2%', () => {
  const stops = /--motion-enter-easing: linear\(([^)]+)\)/.exec(motion)[1].split(',').map(Number);
  assert.equal(stops[0], 0);
  assert.equal(stops.at(-1), 1);
  const peak = Math.max(...stops);
  assert.ok(peak > 1.015 && peak < 1.025, `peak ${peak}`);
});

test('the approved timings have one source and no per-site copies', () => {
  assert.match(motion, /--motion-enter-duration: 450ms/);
  assert.match(motion, /--motion-exit-duration: 220ms/);
  assert.match(motion, /--motion-exit-easing: cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  assert.match(motion, /--motion-swap-out-duration: 130ms/);
  assert.match(motion, /--motion-swap-in-duration: 220ms/);
  assert.match(motion, /--motion-press-scale: 0\.95/);
  for (const directory of ['apps/web/src', 'apps/docs/src', 'packages/site/src']) {
    for (const file of cssFiles(join(root, directory))) {
      if (!file.endsWith('styles/motion.css')) {
        const source = readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /cubic-bezier\(0\.32, 0\.72|linear\(0,/, file);
      }
    }
  }
});

test('reduced motion zeroes every duration and the press scale', () => {
  const reduced = /prefers-reduced-motion: reduce\) \{\s*:root \{([^}]+)\}/.exec(motion)[1];
  for (const token of ['enter', 'exit', 'swap-out', 'swap-in', 'press']) {
    assert.match(reduced, new RegExp(`--motion-${token}-duration: 0ms`));
  }
  assert.match(reduced, /--motion-press-scale: 1/);
});
