import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertCleanReleaseCheckout,
  assertReleaseVisibility,
  releaseLibraries,
  releaseSourceIdentity,
  testedReleaseArtifacts,
} from './check-release-artifacts.mjs';

const integrityOf = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

/** Pack the release libraries in dependency order, as the local rehearsal does. */
export function packReleaseLibraries(root, destination) {
  mkdirSync(destination, { recursive: true });
  return Object.keys(releaseLibraries).map((path) => {
    const manifest = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'));
    assertReleaseVisibility(path, manifest);
    execFileSync(
      'pnpm',
      ['--config.ignore-scripts=true', 'pack', '--pack-destination', destination],
      {
        cwd: join(root, path),
        stdio: ['ignore', 'ignore', 'inherit'],
      },
    );
    const file = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
    return {
      name: manifest.name,
      version: manifest.version,
      file,
      integrity: integrityOf(readFileSync(join(destination, file))),
    };
  });
}

/** Parse the maintainer's approval: one name, version and integrity per release library. */
export function parseApproval(text) {
  const approval = JSON.parse(text);
  assert.ok(Array.isArray(approval), 'approval must be a JSON array');
  const names = approval.map(({ name }) => name).sort();
  assert.deepEqual(
    names,
    Object.values(releaseLibraries).sort(),
    'approval must list each release library once',
  );
  for (const { name, version, integrity } of approval) {
    assert.ok(typeof version === 'string' && version, `${name}: approval needs a version`);
    assert.match(
      String(integrity),
      /^sha512-[A-Za-z0-9+/]+=*$/,
      `${name}: approval needs a sha512 integrity`,
    );
  }
  return approval.map(({ name, version, integrity }) => ({ name, version, integrity }));
}

/** Stop unless every packed tarball is byte-identical to the approved one. */
export function assertApprovedArtifacts(packed, approval) {
  const errors = [];
  for (const approved of approval) {
    const artifact = packed.find(({ name }) => name === approved.name);
    if (!artifact) {
      errors.push(`${approved.name}: not packed`);
    } else if (artifact.version !== approved.version) {
      errors.push(`${approved.name}: packed ${artifact.version}, approved ${approved.version}`);
    } else if (artifact.integrity !== approved.integrity) {
      errors.push(
        `${approved.name}@${approved.version}: packed bytes differ from the approved tarball`,
      );
    }
  }
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  assert.equal(packed.length, approval.length, 'packed and approved libraries differ');
}

/** Recompute integrity from files on disk, so a later job checks the bytes it publishes. */
export function artifactsOnDisk(directory, approval) {
  return approval.map(({ name, version }) => {
    const file = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    return { name, version, file, integrity: integrityOf(readFileSync(join(directory, file))) };
  });
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
    console.log('Packed tarballs match the approved bytes.');
  } else if (command === 'approval') {
    assert.ok(first && second, 'provide tested evidence directory and approved revision');
    assertCleanReleaseCheckout();
    const tested = testedReleaseArtifacts(resolve(first), second, releaseSourceIdentity());
    const approval = JSON.stringify(
      tested.map(({ name, version, integrity }) => ({ name, version, integrity })),
    );
    console.log(`Tested tarballs: ${tested.map(({ tarball }) => basename(tarball)).join(', ')}`);
    console.log(
      `gh workflow run publish.yml --ref main -f mode=stage -f tag=beta -f commit=${second} -f approved='${approval}'`,
    );
  } else {
    throw new Error(
      'usage: release-ci.mjs pack <dir> | verify <dir> <approval> | approval <evidence> <commit>',
    );
  }
}
