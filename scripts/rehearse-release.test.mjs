import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// The rehearsal drives a real browser and GPU, so only its registry contract is checked here.
test('registry verification accepts hosted recompression only through the contents check', () => {
  const source = readFileSync(join(import.meta.dirname, 'rehearse-release.mjs'), 'utf8');
  assert.match(source, /await registryArtifactMatches\(artifact, metadata\)/);
  assert.doesNotMatch(source, /publishedArtifactMatches/, 'no exact-bytes-only registry check');
});
