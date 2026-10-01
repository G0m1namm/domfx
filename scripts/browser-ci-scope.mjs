import { execFileSync } from 'node:child_process';

const { EVENT, FULL, BASE_SHA, HEAD_SHA } = process.env;
let full = EVENT === 'schedule' || FULL === 'true';
if (!full && EVENT === 'pull_request') {
  if (!BASE_SHA || !HEAD_SHA) {
    throw new Error('Pull request scope requires both commit revisions');
  }
  full = Boolean(
    execFileSync(
      'git',
      [
        'diff',
        '--name-only',
        BASE_SHA,
        HEAD_SHA,
        '--',
        'packages',
        'apps/lab',
        'scripts',
        '.github/workflows/check.yml',
        '.github/actions',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        '.nvmrc',
      ],
      { encoding: 'utf8' },
    ).trim(),
  );
}
console.log(`full=${full}`);
