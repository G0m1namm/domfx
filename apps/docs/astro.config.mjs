import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { siteConfig } from '@domfx/site/config';
import { sitePublicDir } from '@domfx/site/public-path';

import { docsMessages } from './src/content/docs-messages';
import { effectsByCategory } from './src/content/documentation';
import { docsDiscovery } from './src/integrations/discovery.mjs';
import { validateDocsTranslations } from './src/scripts/check-translations.mjs';

const { site } = siteConfig(process.env);
validateDocsTranslations();

export default defineConfig({
  site,
  base: '/docs',
  trailingSlash: 'always',
  output: 'static',
  publicDir: sitePublicDir,
  devToolbar: { enabled: false },
  redirects: { '/': '/docs/introduction/', '/es/': '/docs/es/introduction/' },
  integrations: [
    starlight({
      title: 'domfx docs',
      defaultLocale: 'root',
      locales: { root: { label: 'English', lang: 'en' }, es: { label: 'Español', lang: 'es' } },
      disable404Route: true,
      editLink: { baseUrl: 'https://github.com/G0m1namm/domfx/edit/main/apps/docs/' },
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      components: {
        Header: './src/components/Header.astro',
        PageFrame: './src/components/PageFrame.astro',
        PageTitle: './src/components/PageTitle.astro',
        Sidebar: './src/components/Sidebar.astro',
        MobileMenuToggle: './src/components/MobileMenuToggle.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
        Footer: './src/components/Footer.astro',
      },
      customCss: [
        '@domfx/site/styles/shared.css',
        '@domfx/site/styles/brand.css',
        './src/styles/docs-components.css',
        './src/styles/starlight.css',
      ],
      sidebar: [
        {
          label: 'Getting started',
          translations: { es: 'Primeros pasos' },
          items: [
            { label: 'Introduction', translations: { es: 'Introducción' }, slug: 'introduction' },
            { label: 'Installation', translations: { es: 'Instalación' }, slug: 'installation' },
          ],
        },
        {
          label: 'Guides',
          translations: { es: 'Guías' },
          items: [
            { label: 'Standalone', translations: { es: 'Uso independiente' }, slug: 'standalone' },
            { label: 'GSAP', slug: 'gsap' },
          ],
        },
        {
          label: 'Effects',
          translations: { es: 'Efectos' },
          items: [
            {
              label: 'All effects',
              translations: { es: 'Todos los efectos' },
              slug: 'api/effects',
            },
            ...effectsByCategory.map(({ category, effects }) => ({
              label: category,
              translations: { es: docsMessages('es').categories[category] },
              badge: { text: String(effects.length), class: 'docs-nav-count' },
              collapsed: true,
              items: effects.map((effect) => ({
                label: effect.name,
                link: `/api/effects/${effect.id}/`,
              })),
            })),
          ],
        },
        {
          label: 'Reference',
          translations: { es: 'Referencia' },
          items: [
            { label: 'API reference', translations: { es: 'Referencia de la API' }, slug: 'api' },
            {
              label: 'Shared options and controls',
              translations: { es: 'Opciones y controles compartidos' },
              slug: 'api/shared',
            },
            {
              label: 'Effect instance',
              translations: { es: 'Instancia de efecto' },
              slug: 'api/effect-handle',
            },
            { label: 'GSAP API', slug: 'api/gsap' },
          ],
        },
        {
          label: 'Help',
          translations: { es: 'Ayuda' },
          items: [
            { label: 'Upgrading', translations: { es: 'Actualización' }, slug: 'upgrading' },
            {
              label: 'Browser support',
              translations: { es: 'Compatibilidad del navegador' },
              slug: 'support',
            },
            {
              label: 'Troubleshooting',
              translations: { es: 'Solución de problemas' },
              slug: 'troubleshooting',
            },
          ],
        },
      ],
    }),
    docsDiscovery(),
  ],
  vite: {
    server: { ws: { path: '/docs/__vite_hmr' } },
    optimizeDeps: { exclude: ['@domfx/browser', '@domfx/core', '@domfx/gsap'] },
  },
});
