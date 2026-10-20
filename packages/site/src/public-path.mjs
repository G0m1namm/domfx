import { fileURLToPath } from 'node:url';

// Both Astro apps serve these fonts, licenses and brand assets at the same root URLs.
export const sitePublicDir = fileURLToPath(new URL('../public/', import.meta.url));
