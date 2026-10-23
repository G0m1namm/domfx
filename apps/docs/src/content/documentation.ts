import { effectReference } from '@domfx/site/effect-reference';
import { effectCategories, effects } from '@domfx/site/effects';
import type { docsSlugs, Locale } from '@domfx/site/locale';

import { effectReferenceEs } from './effect-reference-es';

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
    description: 'Install the experimental alpha from npm.',
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

const authoredSpanish = {
  introduction: {
    title: 'Introducción',
    description:
      'Efectos con GPU para tu HTML. Conserva tu contenido y añade efectos a sus bordes.',
  },
  installation: {
    title: 'Instalación',
    description: 'Instala la versión alfa experimental desde npm.',
  },
  standalone: {
    title: 'Uso independiente',
    description: 'Aplica un efecto, controla su animación y ajusta un ejemplo interactivo de Fire.',
  },
  gsap: {
    title: 'GSAP',
    description: 'Controla el tiempo y la intensidad del efecto con una línea de tiempo propia.',
  },
  'api/effects': {
    title: 'Todos los efectos',
    description: `Explora los ${effects.length} efectos por categoría, con vistas previas interactivas en cada referencia.`,
  },
  api: {
    title: 'Referencia de la API',
    description: 'Opciones, propiedades y métodos compartidos por todos los efectos.',
  },
  'api/shared': {
    title: 'Opciones y controles compartidos',
    description: 'Opciones de creación y controles modificables disponibles en todos los efectos.',
  },
  'api/effect-handle': {
    title: 'Instancia de efecto',
    description: 'Consulta el estado del efecto, actualiza la captura y libera recursos.',
  },
  'api/gsap': {
    title: 'API de GSAP',
    description:
      'Anima propiedades con GSAP o usa enlaces opcionales que conservan los valores iniciales y gestionan el ciclo de vida.',
  },
  upgrading: {
    title: 'Actualización',
    description: 'Actualiza paquetes compatibles y revisa las notas de migración.',
  },
  support: {
    title: 'Compatibilidad con navegadores',
    description: 'Entornos verificados, límites de captura y casos sin probar.',
  },
  troubleshooting: {
    title: 'Solución de problemas',
    description:
      'Lee el motivo informado, corrige la condición y vuelve a intentarlo explícitamente.',
  },
} as const satisfies Record<(typeof docsSlugs)[number], { title: string; description: string }>;

export function documentationForLocale(locale: Locale) {
  if (locale === 'en') {
    return documentation;
  }
  return documentation.map((page) => {
    if (page.slug.startsWith('api/effects/') && page.slug !== 'api/effects') {
      const id = page.slug.slice('api/effects/'.length) as keyof typeof effectReferenceEs;
      return { ...page, description: effectReferenceEs[id].description };
    }
    const translated = authoredSpanish[page.slug as keyof typeof authoredSpanish];
    return { ...page, ...translated };
  });
}
