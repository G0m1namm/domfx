import assert from 'node:assert/strict';
import test from 'node:test';

import { patternPadding, resolvePatternGeometry } from '../src/pattern-geometry.js';

test('pattern plume and inward band use independent target dimensions', () => {
  assert.deepEqual(
    resolvePatternGeometry('dither', { plumeReach: 0.1, bandDepth: 0.2 }, 400, 100),
    { directionalReach: 10, inwardDepth: 20 },
  );
  assert.deepEqual(
    resolvePatternGeometry('halftone', { plumeReach: 0.1, bandDepth: 0.2 }, 100, 400),
    { directionalReach: 40, inwardDepth: 20 },
  );
});

test('omitted geometry retains legacy mode and a missing partner disables that component', () => {
  assert.equal(resolvePatternGeometry('dither', {}, 100, 400), undefined);
  assert.deepEqual(resolvePatternGeometry('dither', { plumeReach: 0 }, 100, 400), {
    directionalReach: 0,
    inwardDepth: 0,
  });
  assert.deepEqual(resolvePatternGeometry('halftone', { bandDepth: 0.1 }, 100, 400), {
    directionalReach: 0,
    inwardDepth: 10,
  });
});

test('radial echoes and fringe resolve their own extent from the shorter border-box side', () => {
  assert.deepEqual(resolvePatternGeometry('contour-echoes', { echoReach: 0.2 }, 100, 400), {
    directionalReach: 20,
    inwardDepth: 0,
  });
  assert.deepEqual(resolvePatternGeometry('brush-fringe', { fringeReach: 0.3 }, 400, 100), {
    directionalReach: 30,
    inwardDepth: 0,
  });
});

test('invalid and mismatched geometry is rejected before attachment can own a target', () => {
  for (const plumeReach of [-1, NaN, Infinity]) {
    assert.throws(
      () => resolvePatternGeometry('dither', { plumeReach }, 100, 100),
      /invalid-dither-parameter/,
    );
  }
  assert.throws(
    () => resolvePatternGeometry('contour-echoes', { bandDepth: 0.1 }, 100, 100),
    /invalid-contour-echoes-parameter/,
  );
  assert.throws(
    () => resolvePatternGeometry('brush-fringe', { echoReach: 0.1 }, 100, 100),
    /invalid-brush-fringe-parameter/,
  );
  assert.throws(
    () => resolvePatternGeometry('dither', { plumeReach: 1e300 }, 400, 100),
    /capture-budget/,
  );
});

test('relative pattern padding reserves fixed mark support independently of DPR', () => {
  // 40px plume + 6px mark radius + 2px paint overflow + 2 CSS px/2 raster px guard.
  assert.equal(patternPadding({ directionalReach: 40, inwardDepth: 20 }, 1), 52);
  assert.equal(patternPadding({ directionalReach: 40, inwardDepth: 20 }, 2), 51);
  assert.equal(patternPadding({ directionalReach: 0, inwardDepth: 0 }, 1), 8);
});
