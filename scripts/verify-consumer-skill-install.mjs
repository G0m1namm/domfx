import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run explicitly: this downloads the pinned installer and retains a temporary consumer for inspection.
const source = fileURLToPath(new URL('..', import.meta.url));
const consumer = mkdtempSync(join(tmpdir(), 'domfx-skill-consumer-'));
const installer = 'skills@1.7.4';
writeFileSync(join(consumer, 'package.json'), '{"name":"domfx-skill-consumer","private":true}\n');
const args = [
  'dlx',
  installer,
  'add',
  source,
  '--skill',
  'domfx',
  '--agent',
  'codex',
  '--copy',
  '--yes',
];
const result = spawnSync('pnpm', args, {
  cwd: consumer,
  encoding: 'utf8',
  env: { ...process.env, DISABLE_TELEMETRY: '1' },
  timeout: 120_000,
});
writeFileSync(join(consumer, 'installer.log'), result.stdout + result.stderr);
assert.ifError(result.error);
assert.equal(result.status, 0, `Installer failed; inspect ${consumer}/installer.log`);

const installedRoot = join(consumer, '.agents/skills');
assert.deepEqual(readdirSync(installedRoot), ['domfx'], 'Only the consumer skill may be installed');
const sourceSkill = join(source, 'skills/domfx');
const installedSkill = join(installedRoot, 'domfx');
const sourceEntries = readdirSync(sourceSkill, { recursive: true }).sort();
assert.deepEqual(readdirSync(installedSkill, { recursive: true }).sort(), sourceEntries);
assert.ok(
  !lstatSync(installedSkill).isSymbolicLink(),
  '--copy must create an independent directory',
);
const files = [];
for (const path of sourceEntries) {
  const installedPath = join(installedSkill, path);
  const stat = lstatSync(installedPath);
  assert.ok(!stat.isSymbolicLink(), `${path} must not depend on the source checkout`);
  if (stat.isDirectory()) {
    continue;
  }
  const original = readFileSync(join(sourceSkill, path));
  const copied = readFileSync(installedPath);
  assert.deepEqual(copied, original, `${path} must preserve full contents`);
  files.push({
    path,
    bytes: copied.length,
    sourceSha256: createHash('sha256').update(original).digest('hex'),
    installedSha256: createHash('sha256').update(copied).digest('hex'),
  });
}
const report = { installer, command: ['pnpm', ...args], source, consumer, installedSkill, files };
writeFileSync(join(consumer, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
