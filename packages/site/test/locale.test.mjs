import assert from 'node:assert/strict';
import { test } from 'node:test';

import { languageHref, localePath, pageIdentity } from '../src/locale.ts';

test('known marketing and docs pages map to equivalent locale routes', () => {
  assert.deepEqual(pageIdentity('/effects/'), { kind: 'effects' });
  assert.deepEqual(pageIdentity('/docs/es/api/effects/fire/'), {
    kind: 'effect-reference',
    effect: 'fire',
  });
  assert.equal(localePath({ kind: 'home' }, 'es'), '/es/');
  assert.equal(localePath({ kind: 'docs', slug: 'installation' }, 'en'), '/docs/installation/');
  assert.equal(
    localePath({ kind: 'effect-reference', effect: 'fire' }, 'es'),
    '/docs/es/api/effects/fire/',
  );
  assert.equal(pageIdentity('/es/not-a-page/'), undefined);
  assert.equal(pageIdentity('/docs/es/api/effects/not-an-effect/'), undefined);
});

test('language links keep query and known anchors, dropping unknown anchors', () => {
  assert.equal(
    languageHref('https://domfx.dev/docs/api/effects/fire/?mode=static#controls', 'es'),
    '/docs/es/api/effects/fire/?mode=static#controls',
  );
  assert.equal(
    languageHref('https://domfx.dev/es/effects/?category=Energy#fire', 'en'),
    '/effects/?category=Energy#fire',
  );
  assert.equal(
    languageHref('https://domfx.dev/es/effects/?category=Energy#missing', 'en'),
    '/effects/?category=Energy',
  );
  assert.equal(languageHref('https://domfx.dev/effects/#%66ire', 'es'), '/es/effects/#%66ire');
  assert.equal(languageHref('https://domfx.dev/effects/#%ZZ', 'es'), '/es/effects/');
  assert.equal(languageHref('https://domfx.dev/#crosshatch', 'es'), '/es/');
  assert.equal(languageHref('https://domfx.dev/not-a-page/', 'es'), undefined);
});
