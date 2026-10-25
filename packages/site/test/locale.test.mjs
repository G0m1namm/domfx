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

test('Spanish documentation headings map to equivalent English sections', () => {
  assert.equal(
    languageHref('https://domfx.dev/docs/es/gsap/#anima-el-color', 'en'),
    '/docs/gsap/#animate-color',
  );
  assert.equal(
    languageHref('https://domfx.dev/docs/es/api/effects/?from=toc#energ%C3%ADa', 'en'),
    '/docs/api/effects/?from=toc#energy',
  );
  assert.equal(
    languageHref('https://domfx.dev/docs/es/introduction/#comienza-con-tu-elemento', 'en'),
    '/docs/introduction/#start-with-your-element',
  );
  assert.equal(
    languageHref('https://domfx.dev/docs/introduction/#start-with-your-element', 'es'),
    '/docs/es/introduction/#start-with-your-element',
  );
});

test('language links preserve explicit docs anchors shared by both languages', () => {
  for (const [slug, anchors] of Object.entries({
    api: [
      'create-an-attachment',
      'attachment-options',
      'fire-only-options',
      'control-playback',
      'read-state',
      'refresh-retry-and-dispose',
      'bind-gsap',
      'package-boundaries',
    ],
    standalone: ['control-time'],
    gsap: ['context-cleanup', 'optional-bindings', 'unavailable-and-retry'],
    'api/shared': ['attachment-options', 'control-playback', 'animation-control'],
    'api/effect-handle': ['read-state', 'refresh-retry-and-dispose', 'independent-state'],
    'api/gsap': ['native-tweens', 'snapshot-bindings'],
  })) {
    for (const anchor of anchors) {
      for (const [source, target] of [
        ['en', 'es'],
        ['es', 'en'],
      ]) {
        const prefix = source === 'es' ? '/docs/es' : '/docs';
        const targetPrefix = target === 'es' ? '/docs/es' : '/docs';
        assert.equal(
          languageHref(`https://domfx.dev${prefix}/${slug}/#${anchor}`, target),
          `${targetPrefix}/${slug}/#${anchor}`,
          `${source} → ${target}: ${slug}#${anchor}`,
        );
      }
    }
  }
});
