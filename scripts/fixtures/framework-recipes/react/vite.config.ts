import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The probe wraps the packed package; recipe files keep their real import.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@domfx\/browser$/,
        replacement: fileURLToPath(new URL('./src/domfx-probe.ts', import.meta.url)),
      },
    ],
  },
});
