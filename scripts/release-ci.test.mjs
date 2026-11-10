import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { contentsOf } from './check-release-artifacts.mjs';
import { artifactsOnDisk, assertApprovedArtifacts, parseApproval } from './release-ci.mjs';

const libraries = ['@domfx/core', '@domfx/browser', '@domfx/gsap'];
const version = '1.0.0-beta.0';
const file = (name) => `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
// Same tar stream, different gzip output: what macOS and Linux runners produce.
const tested = (name) => gzipSync(`tar stream of ${name}`, { level: 9 });
const rebuilt = (name) => gzipSync(`tar stream of ${name}`, { level: 1 });
const approval = libraries.map((name) => ({ name, version, contents: contentsOf(tested(name)) }));

function artifactDirectory(t, bytes) {
  const directory = mkdtempSync(join(tmpdir(), 'release-ci-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of libraries) {
    writeFileSync(join(directory, file(name)), bytes(name));
  }
  return directory;
}

test('an approval lists each release library once with a sha512 contents hash', () => {
  assert.deepEqual(parseApproval(JSON.stringify(approval)), approval);
  assert.throws(() => parseApproval(JSON.stringify(approval.slice(1))), /each release library/);
  assert.throws(
    () =>
      parseApproval(JSON.stringify([...approval.slice(1), { ...approval[0], name: '@domfx/lab' }])),
    /each release library/,
  );
  assert.throws(
    () =>
      parseApproval(
        JSON.stringify([{ ...approval[0], contents: 'sha1-abc' }, ...approval.slice(1)]),
      ),
    /sha512 contents hash/,
  );
  assert.throws(() => parseApproval('{}'), /JSON array/);
});

test('a rebuild with different compression but identical contents is approved', (t) => {
  assert.notDeepEqual(tested(libraries[0]), rebuilt(libraries[0]), 'gzip bytes differ');
  const packed = artifactsOnDisk(artifactDirectory(t, rebuilt), approval);
  assert.doesNotThrow(() => assertApprovedArtifacts(packed, approval));
  assert.deepEqual(
    packed.map(({ tag }) => tag),
    ['beta', 'beta', 'beta'],
    'the tag comes from the version',
  );
});

test('changed contents, versions or missing libraries are refused', (t) => {
  const changed = artifactsOnDisk(
    artifactDirectory(t, (name) =>
      name === '@domfx/gsap' ? gzipSync('tampered', { level: 9 }) : tested(name),
    ),
    approval,
  );
  assert.throws(
    () => assertApprovedArtifacts(changed, approval),
    /@domfx\/gsap@1.0.0-beta.0: packed contents differ/,
  );
  const bumped = approval.map((artifact) => ({ ...artifact, version: '1.0.0-beta.1' }));
  assert.throws(
    () => assertApprovedArtifacts(bumped, approval),
    /packed 1.0.0-beta.1, approved 1.0.0-beta.0/,
  );
  assert.throws(
    () => assertApprovedArtifacts(approval.slice(1), approval),
    /@domfx\/core: not packed/,
  );
});
