import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const [entry, mode] = process.argv.slice(2);
const coreDirectory = new URL('.', import.meta.resolve('@domfx/core')).href;
for (const name of ['gsap', '@domfx/gsap']) {
  assert.throws(() => import.meta.resolve(name), { code: 'ERR_MODULE_NOT_FOUND' });
}
const violations = [];
function forbidden(label) {
  violations.push(label);
  throw new Error(`Import-time resource or dependency: ${label}`);
}

for (const name of ['window', 'document', 'navigator']) {
  delete globalThis[name];
  assert.equal(name in globalThis, false);
  if (mode === 'guarded') {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: new Proxy({}, { get: (_target, key) => forbidden(`${name}.${String(key)}`) }),
    });
  }
}
for (const name of [
  'requestAnimationFrame',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'fetch',
  'Worker',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'OffscreenCanvas',
  'Image',
  'AudioContext',
  'GPU',
  'GPUDevice',
]) {
  globalThis[name] = function () {
    forbidden(name);
  };
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL !== import.meta.url &&
      entry === '@domfx/core' &&
      !specifier.startsWith('./') &&
      !specifier.startsWith('../')
    ) {
      forbidden(`core dependency ${specifier}`);
    }
    if (/(^|[/@])gsap(?:[/@]|$)/.test(specifier)) {
      forbidden(`GSAP ${specifier}`);
    }
    const resolved = nextResolve(specifier, context);
    if (
      entry === '@domfx/core' &&
      context.parentURL !== import.meta.url &&
      !resolved.url.startsWith(coreDirectory)
    ) {
      forbidden(`core dependency ${resolved.url}`);
    }
    if (/(^|[/@])gsap(?:[/@]|$)/.test(resolved.url)) {
      forbidden(`GSAP ${resolved.url}`);
    }
    return resolved;
  },
});
const exports = await import(entry);
if (entry === '@domfx/core') {
  assert.deepEqual(Object.keys(exports).sort(), ['classifyAlpha']);
} else if (entry === '@domfx/browser') {
  assert.deepEqual(Object.keys(exports).sort(), ['CaptureError', 'attachFire', 'captureElement']);
} else {
  assert.deepEqual(Object.keys(exports).sort(), [
    'AllocationLedger',
    'GpuExperiment',
    'attachFireWithAdapters',
    'decodeFloat16',
    'estimateFrameMemory',
    'memoryFor',
  ]);
}
for (const path of [
  '@domfx/core/dist/index.js',
  '@domfx/browser/dist/gpu.js',
  '@domfx/browser/src/gpu.ts',
]) {
  assert.throws(() => import.meta.resolve(path), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
assert.deepEqual(violations, []);
console.log(`${entry}: ${mode} browser globals, no resource allocation or forbidden imports: PASS`);
