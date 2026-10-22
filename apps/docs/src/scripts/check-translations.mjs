import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

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

function translationFreshnessCheck(repositoryRoot) {
  if (!existsSync(resolve(repositoryRoot, '.git'))) {
    return undefined;
  }
  const git = (args) =>
    execFileSync('git', ['-C', repositoryRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
  const working = git(['diff', '--name-only', 'HEAD']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  const workingFiles = new Set(`${working}\n${untracked}`.split('\n').filter(Boolean));
  return (source, translation) => {
    if (workingFiles.has(source)) {
      return workingFiles.has(translation);
    }
    if (workingFiles.has(translation) || shallow) {
      return true;
    }
    const sourceCommit = git(['log', '-1', '--format=%H', '--', source]);
    const translationCommit = git(['log', '-1', '--format=%H', '--', translation]);
    if (!sourceCommit || !translationCommit) {
      return true;
    }
    try {
      git(['merge-base', '--is-ancestor', sourceCommit, translationCommit]);
      return true;
    } catch {
      return false;
    }
  };
}

export function validateDocsTranslations({ repositoryRoot = defaultRepositoryRoot } = {}) {
  const docsRoot = resolve(repositoryRoot, 'apps/docs/src/content/docs');
  const manifestPath = resolve(repositoryRoot, 'apps/docs/src/content/translation-sources.json');
  const referencePath = resolve(repositoryRoot, 'packages/site/src/effect-reference.ts');
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

  const translationIsCurrent = translationFreshnessCheck(repositoryRoot);
  if (!translationIsCurrent) {
    return;
  }
  for (const file of english) {
    const source = relative(repositoryRoot, resolve(docsRoot, file));
    const translation = relative(repositoryRoot, resolve(docsRoot, 'es', file));
    if (!translationIsCurrent(source, translation)) {
      throw new Error(`English documentation changed without a Spanish source change: ${file}`);
    }
  }
  const reference = relative(repositoryRoot, referencePath);
  const spanishReference = 'apps/docs/src/content/effect-reference-es.ts';
  if (!translationIsCurrent(reference, spanishReference)) {
    throw new Error('English effect reference changed without a Spanish source change.');
  }
}
