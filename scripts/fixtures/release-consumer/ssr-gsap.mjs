import assert from 'node:assert/strict';

for (const name of ['window', 'document', 'navigator']) {
  delete globalThis[name];
  assert.equal(name in globalThis, false);
}
for (const name of [
  'requestAnimationFrame',
  'fetch',
  'Worker',
  'OffscreenCanvas',
  'GPU',
  'GPUDevice',
]) {
  globalThis[name] = () => {
    throw new Error(`Import-time resource: ${name}`);
  };
}
const adapter = await import('@domfx/gsap');
assert.deepEqual(Object.keys(adapter).sort(), [
  'bindEffect',
  'bindEffectAsync',
  'bindFire',
  'bindFireAsync',
]);
console.log('Packed GSAP adapter SSR import: PASS');
