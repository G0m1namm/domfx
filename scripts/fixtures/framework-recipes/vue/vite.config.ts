import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// The probe wraps the packed package; recipe files keep their real import.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /^@domfx\/browser$/,
        replacement: fileURLToPath(new URL('./src/domfx-probe.ts', import.meta.url)),
      },
    ],
  },
});
