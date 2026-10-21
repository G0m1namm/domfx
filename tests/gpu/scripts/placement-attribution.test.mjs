import assert from 'node:assert/strict';
import test from 'node:test';

import { placementCpuSamples, placementInvocations } from './placement-attribution.mjs';

test('invocation identity requires one exact function and mapped placement source', () => {
  const fn = {
    functionName: 'measureEffectPlacement',
    isBlockCoverage: true,
    ranges: [{ startOffset: 0, endOffset: 12, count: 7 }],
  };
  const coverage = { result: [{ url: 'http://localhost/assets/fixture.js', functions: [fn] }] };
  const sources = {
    scriptFor: () => ({ text: 'function f(){}', scriptSha256: 'script', sourceMapSha256: 'map' }),
    mapFrame: () => ({ source: '/packages/domfx/src/placement.ts', line: 246, column: 0 }),
  };
  assert.equal(placementInvocations(coverage, sources).count, 7);
  assert.throws(
    () =>
      placementInvocations(coverage, { ...sources, mapFrame: () => ({ source: '/unrelated.ts' }) }),
    /found 0/,
  );
  assert.throws(
    () => placementInvocations({ result: [...coverage.result, ...coverage.result] }, sources),
    /found 2/,
  );
});

test('sampling attributes inclusive stacks once and catches async source continuations', () => {
  const callFrame = (url, functionName) => ({ url, functionName, lineNumber: 0, columnNumber: 0 });
  const profile = {
    startTime: 0,
    endTime: 5000,
    nodes: [
      { id: 1, callFrame: callFrame('', '(root)'), children: [2, 4, 5] },
      { id: 2, callFrame: callFrame('/placement', 'measureEffectPlacement'), children: [3] },
      { id: 3, callFrame: callFrame('/floating', 'computePosition') },
      // The resumed async function no longer has the placement adapter as parent.
      { id: 4, callFrame: callFrame('/floating', 'computePosition') },
      { id: 5, callFrame: callFrame('', '(idle)') },
    ],
    samples: [2, 3, 4, 5],
    timeDeltas: [1000, 1000, 1500, 500],
  };
  const mapping = (frame) => {
    if (frame.url === '/placement') {
      return { source: '/packages/domfx/src/placement.ts', line: 246, column: 0 };
    }
    if (frame.url === '/floating') {
      return { source: '/node_modules/@floating-ui/core/dist/core.mjs', line: 20, column: 0 };
    }
  };
  const result = placementCpuSamples(profile, mapping);
  assert.equal(result.attributedSamples, 3);
  assert.equal(result.attributedEstimatedMs, 3.5);
  assert.equal(result.mappedLeafSamples, 3);
  assert.equal(result.unmappedLeafSamples, 1);
  assert.equal(result.sampledUs, 4000);
  assert.equal(result.leafFunctions.find((fn) => fn.functionName === 'computePosition').samples, 2);
  assert.throws(
    () => placementCpuSamples({ ...profile, timeDeltas: [1] }, mapping),
    /invalid CPU profile/,
  );
  assert.throws(
    () => placementCpuSamples({ ...profile, endTime: 3000 }, mapping),
    /invalid CPU profile/,
  );
});
