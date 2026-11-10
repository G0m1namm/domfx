import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertCleanReleaseCheckout,
  assertReleaseVisibility,
  contentsOf,
  releaseLibraries,
  releaseSourceIdentity,
  releaseTag,
  testedReleaseArtifacts,
} from './check-release-artifacts.mjs';

const tarballName = (name, version) => `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;

function describe(name, version, bytes) {
  return {
    name,
    version,
    tag: releaseTag(version),
    file: tarballName(name, version),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    contents: contentsOf(bytes),
  };
}

/** Pack the release libraries in dependency order, as the local rehearsal does. */
export function packReleaseLibraries(root, destination) {
  mkdirSync(destination, { recursive: true });
  return Object.keys(releaseLibraries).map((path) => {
    const manifest = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'));
    assertReleaseVisibility(path, manifest);
    execFileSync(
      'pnpm',
      ['--config.ignore-scripts=true', 'pack', '--pack-destination', destination],
      { cwd: join(root, path), stdio: ['ignore', 'ignore', 'inherit'] },
    );
    const bytes = readFileSync(join(destination, tarballName(manifest.name, manifest.version)));
    return describe(manifest.name, manifest.version, bytes);
  });
}

/** Parse the maintainer's approval: one name, version and contents hash per release library. */
export function parseApproval(text) {
  const approval = JSON.parse(text);
  assert.ok(Array.isArray(approval), 'approval must be a JSON array');
  assert.deepEqual(
    approval.map(({ name }) => name).sort(),
    Object.values(releaseLibraries).sort(),
    'approval must list each release library once',
  );
  for (const { name, version, contents } of approval) {
    assert.ok(typeof version === 'string' && version, `${name}: approval needs a version`);
    assert.match(
      String(contents),
      /^sha512-[A-Za-z0-9+/]+=*$/,
      `${name}: approval needs a sha512 contents hash`,
    );
  }
  return approval.map(({ name, version, contents }) => ({ name, version, contents }));
}

/**
 * Stop unless every packed tarball holds exactly the approved contents. Gzip output
 * differs between platforms, so the uncompressed tar stream is compared.
 */
export function assertApprovedArtifacts(packed, approval) {
  const errors = [];
  for (const approved of approval) {
    const artifact = packed.find(({ name }) => name === approved.name);
    if (!artifact) {
      errors.push(`${approved.name}: not packed`);
    } else if (artifact.version !== approved.version) {
      errors.push(`${approved.name}: packed ${artifact.version}, approved ${approved.version}`);
    } else if (artifact.contents !== approved.contents) {
      errors.push(
        `${approved.name}@${approved.version}: packed contents differ from the approved tarball`,
      );
    }
  }
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  assert.equal(packed.length, approval.length, 'packed and approved libraries differ');
}

/** Describe the files on disk, so a later job checks the bytes it stages. */
export function artifactsOnDisk(directory, approval) {
  return approval.map(({ name, version }) =>
    describe(name, version, readFileSync(join(directory, tarballName(name, version)))),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [command, first, second] = process.argv.slice(2);
  if (command === 'pack') {
    assert.ok(first, 'provide a destination directory');
    const packed = packReleaseLibraries('.', resolve(first));
    writeFileSync(join(first, 'packed.json'), JSON.stringify(packed, null, 2) + '\n');
    console.log(JSON.stringify(packed, null, 2));
  } else if (command === 'verify') {
    assert.ok(first && second, 'provide the artifact directory and approval JSON');
    const approval = parseApproval(second);
    assertApprovedArtifacts(artifactsOnDisk(resolve(first), approval), approval);
    console.log('Packed tarballs hold the approved contents.');
  } else if (command === 'approval') {
    assert.ok(first && second, 'provide tested evidence directory and approved revision');
    assertCleanReleaseCheckout();
    const tested = testedReleaseArtifacts(resolve(first), second, releaseSourceIdentity());
    const approval = JSON.stringify(
      tested.map(({ name, version, contents }) => ({ name, version, contents })),
    );
    console.log(`Tested tarballs: ${tested.map(({ tarball }) => basename(tarball)).join(', ')}`);
    console.log(
      `gh workflow run publish.yml --ref main -f mode=stage -f commit=${second} -f approved='${approval}'`,
    );
  } else {
    throw new Error(
      'usage: release-ci.mjs pack <dir> | verify <dir> <approval> | approval <evidence> <commit>',
    );
  }
}
