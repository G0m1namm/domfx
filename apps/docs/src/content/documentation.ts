import { effectReference } from '@domfx/site/effect-reference';
import { effectCategories, effects } from '@domfx/site/effects';

// Array order defines sidebar order and previous/next pagination.
export const documentationGroups = [
  'Getting started',
  'Guides',
  'Effects',
  'Reference',
  'Help',
] as const;

export const effectsByCategory = effectCategories.map((category) => ({
  category,
  effects: effects.filter((effect) => effect.category === category),
}));

export const documentation = [
  {
    slug: 'introduction',
    title: 'Introduction',
    group: 'Getting started',
    description: 'GPU effects for real HTML. Keep your content, add an edge.',
  },
  {
    slug: 'installation',
    title: 'Installation',
    group: 'Getting started',
    description: 'Start with local artifacts from a verified release rehearsal.',
  },
  {
    slug: 'standalone',
    title: 'Standalone',
    group: 'Guides',
    description: 'Attach an effect, control its animation and tune a live Fire example.',
  },
  {
    slug: 'gsap',
    title: 'GSAP',
    group: 'Guides',
    description: 'Control effect time and intensity with a timeline you own.',
  },
  {
    slug: 'api/effects',
    title: 'All effects',
    group: 'Effects',
    description: `Browse all ${effects.length} effects by category, with live previews on each reference.`,
  },
  ...effectsByCategory.flatMap(({ effects: categoryEffects }) =>
    categoryEffects.map((effect) => ({
      slug: `api/effects/${effect.id}`,
      title: effect.name,
      group: 'Effects' as const,
      description: effectReference[effect.id].description,
    })),
  ),
  {
    slug: 'api',
    title: 'API reference',
    group: 'Reference',
    description: 'Options, properties and methods shared by every effect.',
  },
  {
    slug: 'api/shared',
    title: 'Shared options and controls',
    group: 'Reference',
    description: 'Creation options and writable controls available on every effect.',
  },
  {
    slug: 'api/effect-handle',
    title: 'Effect instance',
    group: 'Reference',
    description: 'Read effect state, update the captured image and release resources.',
  },
  {
    slug: 'api/gsap',
    title: 'GSAP API',
    group: 'Reference',
    description: 'Native property tweens and optional lifecycle-aware snapshot bindings.',
  },
  {
    slug: 'upgrading',
    title: 'Upgrading',
    group: 'Help',
    description: 'Update compatible packages and check migration notes.',
  },
  {
    slug: 'support',
    title: 'Browser support',
    group: 'Help',
    description: 'Measured environments, capture limits and untested coverage.',
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    group: 'Help',
    description: 'Read the reported reason, correct the condition, then retry explicitly.',
  },
] as const satisfies readonly {
  slug: string;
  title: string;
  group: (typeof documentationGroups)[number];
  description: string;
}[];

export type DocumentationPage = (typeof documentation)[number];
