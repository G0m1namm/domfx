import assert from 'node:assert/strict';
import { test } from 'node:test';

import { codeTokens } from '../src/code-tokens.ts';

const source = `import { attachFire } from '@domfx/browser';

const effect = attachFire(target, {
  host,
  intensity: 0.8,
  on: true,
  tipColor: '#ff1701',
});

// On unmount: effect.dispose();`;

test('tokens keep the copied source intact', () => {
  assert.equal(
    codeTokens(source)
      .map(({ text }) => text)
      .join(''),
    source,
  );
});

test('tokens classify the parts of a generated snippet', () => {
  const kindOf = (text) => codeTokens(source).find((token) => token.text === text)?.kind;
  assert.equal(kindOf('import'), 'keyword');
  assert.equal(kindOf('{ attachFire }'), 'plain');
  assert.equal(kindOf('effect'), 'function');
  assert.equal(kindOf('attachFire'), 'function');
  assert.equal(kindOf('intensity'), 'keyword');
  assert.equal(kindOf('0.8'), 'number');
  assert.equal(kindOf('true'), 'literal');
  assert.equal(kindOf('#ff1701'), 'string');
  assert.equal(kindOf('// On unmount: effect.dispose();'), 'comment');
});
