import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = fileURLToPath(new URL('../content/docs/', import.meta.url));
const manifestPath = fileURLToPath(new URL('../content/translation-sources.json', import.meta.url));
const referencePath = fileURLToPath(
  new URL('../../../../packages/site/src/effect-reference.ts', import.meta.url),
);

function guideFiles(directory, root = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return guideFiles(path, root);
    }
    return /\.mdx?$/.test(entry.name) ? [relative(root, path)] : [];
  });
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function validateDocsTranslations() {
  const english = guideFiles(docsRoot)
    .filter((file) => !file.startsWith('es/'))
    .sort();
  const spanish = guideFiles(resolve(docsRoot, 'es')).sort();
  if (english.join('\n') !== spanish.join('\n')) {
    throw new Error('Spanish documentation pages must match the English guide inventory.');
  }

  const expected = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const sources = Object.fromEntries(
    english.map((file) => [file, sha256(resolve(docsRoot, file))]),
  );
  sources['effect-reference.ts'] = sha256(referencePath);
  if (
    Object.keys(sources).length !== Object.keys(expected).length ||
    Object.entries(sources).some(([name, hash]) => expected[name] !== hash)
  ) {
    throw new Error(
      'English documentation or effect reference copy changed. Update its Spanish translation and translation-sources.json.',
    );
  }
}
