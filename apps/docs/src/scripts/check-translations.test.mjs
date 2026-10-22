import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { validateDocsTranslations } from './check-translations.mjs';

test('English source updates require corresponding Spanish source changes', () => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'domfx-translations-'));
  const write = (file, content) => {
    const path = join(repositoryRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const git = (...args) =>
    execFileSync('git', ['-C', repositoryRoot, ...args], { stdio: 'ignore' });
  const guide = 'apps/docs/src/content/docs/introduction.md';
  const spanishGuide = 'apps/docs/src/content/docs/es/introduction.md';
  const reference = 'packages/site/src/effect-reference.ts';
  const spanishReference = 'apps/docs/src/content/effect-reference-es.ts';
  const manifest = 'apps/docs/src/content/translation-sources.json';
  const updateManifest = () => {
    const hash = (file) =>
      createHash('sha256')
        .update(readFileSync(join(repositoryRoot, file)))
        .digest('hex');
    write(
      manifest,
      JSON.stringify({ 'introduction.md': hash(guide), 'effect-reference.ts': hash(reference) }),
    );
  };
  const commit = () => {
    git('add', '.');
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--quiet',
      '-m',
      'test',
    );
  };

  try {
    git('init', '--quiet');
    write(guide, 'English guide');
    write(spanishGuide, 'Guía española');
    write(reference, 'English reference');
    write(spanishReference, 'Referencia española');
    updateManifest();
    commit();
    assert.doesNotThrow(() => validateDocsTranslations({ repositoryRoot }));

    write(guide, 'Changed English guide');
    updateManifest();
    commit();
    assert.throws(
      () => validateDocsTranslations({ repositoryRoot }),
      /English documentation changed without a Spanish source change: introduction.md/,
    );
    write(
      manifest,
      JSON.stringify(JSON.parse(readFileSync(join(repositoryRoot, manifest))), null, 2),
    );
    commit();
    assert.throws(
      () => validateDocsTranslations({ repositoryRoot }),
      /English documentation changed without a Spanish source change: introduction.md/,
    );
    write(spanishGuide, 'Guía española actualizada');
    commit();
    assert.doesNotThrow(() => validateDocsTranslations({ repositoryRoot }));

    write(guide, 'Another changed English guide');
    commit();
    updateManifest();
    commit();
    assert.throws(
      () => validateDocsTranslations({ repositoryRoot }),
      /English documentation changed without a Spanish source change: introduction.md/,
    );
    write(spanishGuide, 'Guía española actualizada de nuevo');
    commit();
    assert.doesNotThrow(() => validateDocsTranslations({ repositoryRoot }));

    write(guide, 'Uncommitted English update');
    updateManifest();
    assert.throws(
      () => validateDocsTranslations({ repositoryRoot }),
      /English documentation changed without a Spanish source change: introduction.md/,
    );
    write(spanishGuide, 'Cambio español sin confirmar');
    assert.doesNotThrow(() => validateDocsTranslations({ repositoryRoot }));
    commit();

    write(reference, 'Changed English reference');
    updateManifest();
    commit();
    assert.throws(
      () => validateDocsTranslations({ repositoryRoot }),
      /English effect reference changed without a Spanish source change/,
    );
    write(spanishReference, 'Referencia española actualizada');
    commit();
    assert.doesNotThrow(() => validateDocsTranslations({ repositoryRoot }));
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});
