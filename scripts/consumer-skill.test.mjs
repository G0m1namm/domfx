import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skill = join(root, 'skills/domfx');
const read = (path) => readFileSync(path, 'utf8');

test('consumer distribution has one discoverable standard skill', () => {
  const entries = readdirSync(join(root, 'skills'), { recursive: true }).filter((path) =>
    path.endsWith('SKILL.md'),
  );
  assert.deepEqual(entries, ['domfx/SKILL.md']);
  const frontmatter = read(join(skill, 'SKILL.md')).match(/^---\n([\s\S]+?)\n---\n/);
  assert.ok(frontmatter, 'YAML frontmatter is required');
  const fields = Object.fromEntries(
    frontmatter[1].split('\n').map((line) => {
      const separator = line.indexOf(': ');
      assert.ok(separator > 0, 'Metadata uses plain YAML string fields');
      return [line.slice(0, separator), line.slice(separator + 2)];
    }),
  );
  assert.equal(fields.name, 'domfx');
  assert.match(fields.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(fields.name.length <= 64);
  assert.ok(fields.description?.trim().length > 0 && fields.description.length <= 1024);
  for (const key of Object.keys(fields)) {
    assert.ok(['name', 'description', 'license'].includes(key), `Unexpected field: ${key}`);
  }
});

test('every bundled resource is reachable and links stay portable', () => {
  const pending = [join(skill, 'SKILL.md')];
  const reached = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (reached.has(path)) {
      continue;
    }
    reached.add(path);
    for (const [, href] of read(path).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (href.startsWith('https://')) {
        const url = new URL(href);
        assert.equal(url.origin, 'https://domfx.dev');
        assert.ok(url.pathname.startsWith('/docs/'));
        const route = url.pathname.replace(/^\/docs\//, '').replace(/\/$/, '');
        const source = join(root, 'apps/docs/src/content/docs', route);
        assert.ok(
          ['.md', '.mdx', '/index.md', '/index.mdx'].some((ext) => existsSync(source + ext)),
          `Missing public guide: ${href}`,
        );
        continue;
      }
      const target = resolve(dirname(path), href);
      assert.ok(relative(skill, target) && !relative(skill, target).startsWith('..'), href);
      assert.ok(existsSync(target), `Missing bundled resource: ${href}`);
      pending.push(target);
    }
  }
  const files = readdirSync(skill, { recursive: true }).filter((path) => path.endsWith('.md'));
  assert.deepEqual([...reached].sort(), files.map((path) => join(skill, path)).sort());
});

test('EN/ES installation and Quickstart select the same skill as the site clipboard', () => {
  const marketing = read(join(root, 'apps/web/src/layouts/Marketing.astro'));
  const command = marketing.match(/data-copy="(pnpm dlx skills add [^"]+)"/)?.[1];
  assert.ok(command);
  const args = command.split(' ');
  assert.equal(args[args.indexOf('--skill') + 1], 'domfx');
  assert.ok(!args.includes('--all') && !args.includes('--global'));
  for (const file of [
    'QUICKSTART.md',
    'apps/docs/src/content/docs/installation.md',
    'apps/docs/src/content/docs/es/installation.md',
  ]) {
    assert.ok(read(join(root, file)).includes(command), `${file} must match the copied command`);
  }
});
