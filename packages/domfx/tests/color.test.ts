import assert from 'node:assert/strict';
import test from 'node:test';

import { parseEffectColor } from '../src/color.js';

test('parses the supported effect color grammar into canonical CSS', () => {
  assert.deepEqual(parseEffectColor(' #f0A '), {
    css: 'rgb(255, 0, 170)',
    red: 1,
    green: 0,
    blue: 170 / 255,
  });
  assert.deepEqual(parseEffectColor('#00ff7f'), {
    css: 'rgb(0, 255, 127)',
    red: 0,
    green: 1,
    blue: 127 / 255,
  });
  assert.deepEqual(parseEffectColor('RGB(12.5, 0, 255)'), {
    css: 'rgb(12.5, 0, 255)',
    red: 12.5 / 255,
    green: 0,
    blue: 1,
  });
  assert.deepEqual(parseEffectColor('rgba(1, 2, 3, 1.0)'), {
    css: 'rgb(1, 2, 3)',
    red: 1 / 255,
    green: 2 / 255,
    blue: 3 / 255,
  });
  assert.equal(parseEffectColor(undefined), undefined);
});

test('rejects unsupported and non-opaque effect colors', () => {
  for (const value of [
    null,
    1,
    '#ffff',
    'red',
    'rgb(-1, 0, 0)',
    'rgb(256, 0, 0)',
    'rgb(0, 0, NaN)',
    'rgba(0, 0, 0, 0.999)',
    'rgba(0, 0, 0, 1.1)',
  ]) {
    assert.throws(() => parseEffectColor(value), /invalid-effect-color/);
  }
});
