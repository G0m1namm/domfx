export const repositoryUrl = 'https://github.com/G0m1namm/domfx';

export interface FooterLinkGroup {
  title: string;
  items: readonly (readonly [label: string, href: string])[];
}

// Shared by the homepage and documentation footers so both list the same destinations.
export const footerLinkGroups: readonly FooterLinkGroup[] = [
  {
    title: 'Build',
    items: [
      ['Your first effect', '/docs/standalone/'],
      ['GSAP integration', '/docs/gsap/'],
      ['API reference', '/docs/api/'],
    ],
  },
  {
    title: 'Explore',
    items: [
      ['All effects', '/effects/'],
      ['Documentation', '/docs/introduction/'],
      ['Browser support', '/docs/support/'],
    ],
  },
  {
    title: 'domfx',
    items: [
      ['GitHub', repositoryUrl],
      ['npm', 'https://www.npmjs.com/package/@domfx/browser'],
    ],
  },
];

export function localizedFooterLinkGroups(locale: 'en' | 'es'): readonly FooterLinkGroup[] {
  if (locale === 'en') {
    return footerLinkGroups;
  }
  return [
    {
      title: 'Crear',
      items: [
        ['Tu primer efecto', '/docs/es/standalone/'],
        ['Integración con GSAP', '/docs/es/gsap/'],
        ['Referencia de la API', '/docs/es/api/'],
      ],
    },
    {
      title: 'Explorar',
      items: [
        ['Todos los efectos', '/es/effects/'],
        ['Documentación', '/docs/es/introduction/'],
        ['Compatibilidad de navegadores', '/docs/es/support/'],
      ],
    },
    {
      title: 'domfx',
      items: [
        ['GitHub', repositoryUrl],
        ['npm', 'https://www.npmjs.com/package/@domfx/browser'],
      ],
    },
  ];
}
