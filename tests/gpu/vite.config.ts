import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        effects: resolve(import.meta.dirname, 'effects.html'),
        main: resolve(import.meta.dirname, 'index.html'),
        manual: resolve(import.meta.dirname, 'manual.html'),
        materialExtent: resolve(import.meta.dirname, 'material-extent.html'),
        placementNative: resolve(import.meta.dirname, 'placement-native.html'),
        gsap: resolve(import.meta.dirname, 'gsap.html'),
        assets: resolve(import.meta.dirname, 'assets.html'),
        accessibility: resolve(import.meta.dirname, 'accessibility.html'),
        performance: resolve(import.meta.dirname, 'performance.html'),
        steady: resolve(import.meta.dirname, 'steady.html'),
        layout: resolve(import.meta.dirname, 'layout.html'),
        placementMeasurement: resolve(import.meta.dirname, 'placement-measurement.html'),
        stress: resolve(import.meta.dirname, 'stress.html'),
      },
    },
  },
});
