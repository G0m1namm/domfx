import { effects } from './effects';
import { localePath, type Locale } from './locale';
import type { PageMetadata } from './metadata';
import { repositoryUrl } from './site-links';

export function marketingPages(site: string, locale: Locale = 'en'): readonly PageMetadata[] {
  const homePath = localePath({ kind: 'home' }, locale);
  const galleryPath = localePath({ kind: 'effects' }, locale);
  const home = new URL(homePath, site).href;
  const gallery = new URL(galleryPath, site).href;
  const spanish = locale === 'es';
  return [
    {
      title: spanish ? 'Efectos para tu HTML' : 'Effects for your HTML',
      description: spanish
        ? 'Efectos con GPU para texto, imágenes y SVG. Explora la galería, aplica un efecto a tu HTML y anímalo con GSAP o de forma independiente.'
        : 'GPU effects for text, images and SVG. Explore the gallery, attach an effect to your HTML, and animate with GSAP or on its own.',
      path: homePath,
      type: 'website',
      structuredData: [
        { '@type': 'WebSite', name: 'domfx', url: home },
        { '@type': 'SoftwareSourceCode', name: 'domfx', codeRepository: repositoryUrl, url: home },
      ],
    },
    {
      title: spanish ? 'Efectos' : 'Effects',
      description: spanish
        ? 'Dale a tu HTML un borde expresivo. Efectos con GPU para HTML nativo con controles opcionales de GSAP.'
        : 'Give your HTML an expressive edge. GPU effects with native HTML and optional GSAP controls.',
      path: galleryPath,
      type: 'website',
      structuredData: [
        { '@type': 'CollectionPage', name: spanish ? 'Efectos' : 'Effects', url: gallery },
        {
          '@type': 'ItemList',
          itemListElement: effects.map((effect, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: effect.name,
            url: new URL(localePath({ kind: 'effect-reference', effect: effect.id }, locale), site)
              .href,
          })),
        },
      ],
    },
  ];
}
