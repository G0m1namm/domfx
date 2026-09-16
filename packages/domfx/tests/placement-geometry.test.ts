import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateEffectPlacement, type PlacementGeometry } from '../src/placement-geometry.js';

const geometry: PlacementGeometry = {
  target: { viewportOrigin: { x: 0, y: 0 }, scaleToViewport: { x: 1, y: 1 } },
  host: {
    viewportOrigin: { x: 0, y: 0 },
    scaleToViewport: { x: 1, y: 1 },
    clientOriginCss: { x: 0, y: 0 },
    scrollCss: { x: 0, y: 0 },
  },
  clipViewport: { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity },
  capture: { width: 100, height: 60, pixelToTargetLocal: { a: 1, d: 1, e: 0, f: 0 } },
};

const cases: {
  name: string;
  input: Partial<PlacementGeometry>;
  expected: { left: number; top: number; width: number; height: number; clipPath: string };
}[] = [
  {
    name: 'identity with no bypassed clip',
    input: {},
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'none' },
  },
  {
    name: 'fractional viewport offsets remain fractional in host CSS coordinates',
    input: {
      target: { ...geometry.target, viewportOrigin: { x: 100.625, y: 50.875 } },
      host: { ...geometry.host, viewportOrigin: { x: 10.25, y: 20.125 } },
    },
    expected: { left: 90.375, top: 30.75, width: 100, height: 60, clipPath: 'none' },
  },
  {
    name: 'fractional host borders move the containing-block origin',
    input: { host: { ...geometry.host, clientOriginCss: { x: 3.25, y: 4.5 } } },
    expected: { left: -3.25, top: -4.5, width: 100, height: 60, clipPath: 'none' },
  },
  {
    name: 'measured host origin retains a left scrollbar gutter',
    input: { host: { ...geometry.host, clientOriginCss: { x: 18.25, y: 4.5 } } },
    expected: { left: -18.25, top: -4.5, width: 100, height: 60, clipPath: 'none' },
  },
  {
    name: 'host scrolling is expressed in host-local CSS pixels',
    input: { host: { ...geometry.host, scrollCss: { x: 17.5, y: 21.25 } } },
    expected: { left: 17.5, top: 21.25, width: 100, height: 60, clipPath: 'none' },
  },
  {
    name: 'independent target and host scales divide per axis',
    input: {
      target: { ...geometry.target, scaleToViewport: { x: 3, y: 1.5 } },
      host: { ...geometry.host, scaleToViewport: { x: 2, y: 0.5 } },
    },
    expected: { left: 0, top: 0, width: 150, height: 180, clipPath: 'none' },
  },
  {
    name: 'raster scale and asymmetric capture padding use target-local CSS pixels',
    input: {
      capture: { width: 240, height: 160, pixelToTargetLocal: { a: 0.5, d: 0.25, e: -8, f: -12 } },
    },
    expected: { left: -8, top: -12, width: 120, height: 40, clipPath: 'none' },
  },
  {
    name: 'rounded raster dimensions use their mapping instead of assuming an integer DPR',
    input: {
      capture: {
        width: 201,
        height: 121,
        pixelToTargetLocal: { a: 100.25 / 201, d: 60.125 / 121, e: -12.5, f: -6.25 },
      },
    },
    expected: { left: -12.5, top: -6.25, width: 100.25, height: 60.125, clipPath: 'none' },
  },
  {
    name: 'a larger clip does not expand the raster',
    input: { clipViewport: { left: -10, top: -20, right: 110, bottom: 80 } },
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'none' },
  },
  {
    name: 'fractional clipping preserves CSS inset edge order',
    input: { clipViewport: { left: 10.25, top: 5.5, right: 79.75, bottom: 44.25 } },
    expected: {
      left: 0,
      top: 0,
      width: 100,
      height: 60,
      clipPath: 'inset(5.5px 20.25px 15.75px 10.25px)',
    },
  },
  {
    name: 'one-axis clipping leaves the other axis unbounded',
    input: { clipViewport: { left: 10, top: -Infinity, right: 80, bottom: Infinity } },
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'inset(0px 20px 0px 10px)' },
  },
  {
    name: 'a clip beyond the bottom-right clamps insets to the raster size',
    input: { clipViewport: { left: 110, top: 70, right: 150, bottom: 90 } },
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'inset(60px 0px 0px 100px)' },
  },
  {
    name: 'a clip beyond the top-left clamps the opposite insets',
    input: { clipViewport: { left: -50, top: -40, right: -10, bottom: -5 } },
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'inset(0px 100px 60px 0px)' },
  },
  {
    name: 'disjoint ancestor intersection keeps the raster fully clipped',
    input: { clipViewport: { left: 80, top: 45, right: 20, bottom: 15 } },
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'inset(45px 80px 45px 80px)' },
  },
  {
    name: 'zero-area edge adjacency stays fully clipped',
    input: { clipViewport: { left: 100, top: 0, right: 150, bottom: 60 } },
    expected: { left: 0, top: 0, width: 100, height: 60, clipPath: 'inset(0px 0px 0px 100px)' },
  },
  {
    name: 'scales, viewport offsets, borders, scrolling, padding and clipping compose',
    input: {
      target: { viewportOrigin: { x: 250.5, y: 140.25 }, scaleToViewport: { x: 3, y: 1.5 } },
      host: {
        viewportOrigin: { x: 50.25, y: 20.125 },
        scaleToViewport: { x: 2, y: 0.5 },
        clientOriginCss: { x: 3.25, y: 4.5 },
        scrollCss: { x: 17.5, y: 21.25 },
      },
      capture: { width: 240, height: 160, pixelToTargetLocal: { a: 0.5, d: 0.25, e: -8, f: -12 } },
      // The padded raster spans (226.5, 122.25) to (586.5, 182.25) in the viewport.
      // This clip removes 20/40 viewport pixels on X and 5/10 on Y.
      clipViewport: { left: 246.5, top: 127.25, right: 546.5, bottom: 172.25 },
    },
    expected: {
      left: 102.375,
      top: 221,
      width: 180,
      height: 120,
      clipPath: 'inset(10px 20px 20px 10px)',
    },
  },
];

for (const { name, input, expected } of cases) {
  test(name, () => {
    assert.deepEqual(calculateEffectPlacement({ ...geometry, ...input }), expected);
  });
}
