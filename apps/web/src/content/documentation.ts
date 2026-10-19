import { effectReference } from './effect-reference';
import { effects } from './effects';

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
    slug: 'upgrading',
    title: 'Upgrading',
    group: 'Guides',
    description: 'Update compatible packages and check migration notes.',
  },
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
    slug: 'api/effects',
    title: 'Effect index',
    group: 'Reference',
    description: 'Import names and individual API references for every effect.',
  },
  {
    slug: 'api/gsap',
    title: 'GSAP API',
    group: 'Reference',
    description: 'Native property tweens and optional lifecycle-aware snapshot bindings.',
  },
  ...effects.map((effect) => ({
    slug: `api/effects/${effect.id}`,
    title: effect.name,
    group: 'Effects',
    description: effectReference[effect.id].description,
  })),
  {
    slug: 'support',
    title: 'Browser support',
    group: 'Reference',
    description: 'Measured environments, capture limits and untested coverage.',
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    group: 'Reference',
    description: 'Read the reported reason, correct the condition, then retry explicitly.',
  },
] as const;
