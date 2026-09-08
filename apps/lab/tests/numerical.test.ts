import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeFloat16 } from '@domfx/browser/experimental';
import { classifyAlpha } from '@domfx/core';

import { exactDistanceField, signedDistanceOracle } from '../src/diagnostics/distance-oracle.js';

test('full-field oracle preserves an inner hole and disconnected island', () => {
  const width = 7,
    height = 6;
  const mask = Uint8Array.from([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const actual = exactDistanceField(mask, width, height);
  const expected = signedDistanceOracle(mask, width, height);
  for (let i = 0; i < mask.length; i += 1)
    assert.ok(Math.abs(actual[i] - expected[i]) < 1e-5, `pixel ${i}`);
});

test('separable Float64 oracle matches exhaustive pixel-center distances', () => {
  let seed = 12345;
  for (const [width, height] of [
    [1, 1],
    [1, 7],
    [11, 1],
    [9, 7],
    [17, 13],
  ]) {
    for (let trial = 0; trial < 8; trial++) {
      const mask = Uint8Array.from({ length: width * height }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % 7 < trial ? 1 : 0;
      });
      const actual = exactDistanceField(mask, width, height),
        expected = signedDistanceOracle(mask, width, height);
      for (let i = 0; i < mask.length; i++) {
        if (!Number.isFinite(expected[i])) assert.equal(actual[i], expected[i]);
        else assert.ok(Math.abs(actual[i] - expected[i]) < 1e-12);
      }
    }
  }
});

test('alpha classification preserves the 127/128 threshold including empty masks', () => {
  const pixels = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 127, 255, 0, 0, 128, 255, 0, 0, 255]);
  assert.deepEqual(classifyAlpha({ width: 4, height: 1, pixels }), Uint8Array.from([0, 0, 1, 1]));
  assert.deepEqual(exactDistanceField(new Uint8Array(4), 2, 2), new Float64Array(4).fill(Infinity));
  assert.deepEqual(
    exactDistanceField(new Uint8Array(4).fill(1), 2, 2),
    new Float64Array(4).fill(-Infinity),
  );
});

test('GPU half-float readback handles signs, fractions, subnormals and sentinels', () => {
  for (const [bits, expected] of [
    [0, 0],
    [0x3c00, 1],
    [0xc000, -2],
    [0x3800, 0.5],
    [1, 2 ** -24],
    [0x7c00, Infinity],
    [0xfc00, -Infinity],
  ]) {
    assert.equal(decodeFloat16(bits), expected);
  }
  assert.ok(Number.isNaN(decodeFloat16(0x7e00)));
});
