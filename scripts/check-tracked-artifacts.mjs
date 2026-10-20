import { execFileSync } from 'node:child_process';

const localDirectories = [
  '.scratch/',
  'docs/',
  'engineering/design-explorations/',
  'apps/web/browser-tests/visual-baselines/',
];
const localFiles = ['PROJECT_CONTEXT.md', '.agents/product-marketing.md'];
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const forbidden = tracked.filter(
  (path) =>
    path !== 'apps/web/browser-tests/visual-baselines/README.md' &&
    (localFiles.includes(path) || localDirectories.some((directory) => path.startsWith(directory))),
);

if (forbidden.length) {
  console.error('Local artifacts are tracked. Remove them from the index; keep local copies:');
  for (const path of forbidden) {
    console.error(`  ${JSON.stringify(path)}`);
  }
  process.exitCode = 1;
} else {
  console.log('Tracked artifact policy passed.');
}
