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
