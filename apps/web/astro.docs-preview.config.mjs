import { defineConfig } from 'astro/config';

import web from './astro.config.mjs';

export default defineConfig({ ...web, outDir: '../../.scratch/docs-preview' });
