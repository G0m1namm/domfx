import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { artifactsOnDisk, assertApprovedArtifacts, parseApproval } from './release-ci.mjs';

const integrity = (text) => `sha512-${createHash('sha512').update(text).digest('base64')}`;
const libraries = ['@domfx/core', '@domfx/browser', '@domfx/gsap'];
const approval = libraries.map((name) => ({
  name,
  version: '1.0.0-beta.0',
  integrity: integrity(name),
}));

test('an approval lists each release library once with a sha512 integrity', () => {
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
        JSON.stringify([{ ...approval[0], integrity: 'sha1-abc' }, ...approval.slice(1)]),
      ),
    /sha512 integrity/,
  );
  assert.throws(() => parseApproval('{}'), /JSON array/);
});

test('packed tarballs must match the approved bytes and versions', () => {
  assert.doesNotThrow(() => assertApprovedArtifacts(approval, approval));
  const changed = approval.map((artifact, index) =>
    index === 1 ? { ...artifact, integrity: integrity('rebuilt') } : artifact,
  );
  assert.throws(
    () => assertApprovedArtifacts(changed, approval),
    /@domfx\/browser@1.0.0-beta.0: packed bytes differ/,
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

test('the publish job rechecks the bytes it downloaded', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'release-ci-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of libraries) {
    writeFileSync(
      join(directory, `${name.replace('@', '').replace('/', '-')}-1.0.0-beta.0.tgz`),
      name,
    );
  }
  assert.doesNotThrow(() =>
    assertApprovedArtifacts(artifactsOnDisk(directory, approval), approval),
  );

  writeFileSync(join(directory, 'domfx-gsap-1.0.0-beta.0.tgz'), 'tampered');
  assert.throws(
    () => assertApprovedArtifacts(artifactsOnDisk(directory, approval), approval),
    /@domfx\/gsap@1.0.0-beta.0: packed bytes differ/,
  );
});
