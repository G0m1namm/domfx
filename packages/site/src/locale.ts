import { effects } from './effects.ts';

export type Locale = 'en' | 'es';

type SiteMessages = Record<
  | 'home'
  | 'effects'
  | 'docs'
  | 'main'
  | 'site'
  | 'language'
  | 'menu'
  | 'openMenu'
  | 'closeMenu'
  | 'homeLabel',
  string
>;

export const siteMessages = {
  en: {
    home: 'Home',
    effects: 'Effects',
    docs: 'Docs',
    main: 'Main',
    site: 'Site',
    language: 'Language',
    menu: 'Menu',
    openMenu: 'Open site menu',
    closeMenu: 'Close site menu',
    homeLabel: 'domfx home',
  },
  es: {
    home: 'Inicio',
    effects: 'Efectos',
    docs: 'Documentación',
    main: 'Principal',
    site: 'Sitio',
    language: 'Idioma',
    menu: 'Menú',
    openMenu: 'Abrir menú del sitio',
    closeMenu: 'Cerrar menú del sitio',
    homeLabel: 'Inicio de domfx',
  },
} as const satisfies Record<Locale, SiteMessages>;

export type PageIdentity =
  | { kind: 'home' }
  | { kind: 'effects' }
  | { kind: 'docs'; slug: (typeof docsSlugs)[number] }
  | { kind: 'effect-reference'; effect: string };

export const docsSlugs = [
  'introduction',
  'installation',
  'standalone',
  'gsap',
  'api',
  'api/effects',
  'api/shared',
  'api/effect-handle',
  'api/gsap',
  'upgrading',
  'support',
  'troubleshooting',
] as const;

const docsAnchors: Record<(typeof docsSlugs)[number], readonly string[]> = {
  introduction: [
    'start-with-your-element',
    'start-with-gsap',
    'control-animation',
    'choose-an-effect',
    'keep-the-original-usable',
  ],
  installation: [
    'build-verified-artifacts',
    'create-your-preview-app',
    'provide-the-target-and-host',
    'add-the-optional-gsap-binding',
  ],
  standalone: [
    'attach-fire',
    'use-another-effect',
    'control-time-and-intensity',
    'refresh-and-cleanup',
    'unavailable-output',
  ],
  gsap: [
    'provide-your-elements',
    'build-your-sequence',
    'seek-and-play',
    'own-the-lifetime',
    'gsap-context-cleanup',
    'optional-lifecycle-helpers',
    'unavailable-output-and-retry',
  ],
  api: [
    'usage',
    'creation-options',
    'effect-specific-options',
    'writable-controls',
    'read-only-state',
    'methods',
    'available-effects',
    'gsap',
    'packages',
  ],
  'api/effects': ['energy', 'material', 'pattern'],
  'api/shared': ['creation-options', 'writable-controls', 'control-animation', 'reduced-motion'],
  'api/effect-handle': ['read-only-state', 'methods', 'understand-the-reported-state'],
  'api/gsap': ['native-property-tweens', 'optional-snapshot-bindings'],
  upgrading: [
    'upgrade-compatible-packages',
    'check-migration-notes',
    'animation-and-binding-names',
  ],
  support: [
    'measured-environments',
    'untested-coverage',
    'capture-and-composition-limits',
    'when-an-effect-is-unavailable',
    'source-and-feedback-access',
  ],
  troubleshooting: [
    'missing-or-suppressed-output',
    'misplaced-or-rejected-output',
    'failed-or-stale-capture',
    'installation-or-shader-errors',
    'trace-an-attachment',
    'recover-explicitly',
  ],
};

const effectIds = new Set(effects.map((effect) => effect.id));
const homeEffectIds = new Set(effects.slice(0, 5).map((effect) => effect.id));
const docsPaths = new Set<string>(docsSlugs);

export function pageIdentity(pathname: string): PageIdentity | undefined {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path === '/es') {
    return { kind: 'home' };
  }
  if (path === '/effects' || path === '/es/effects') {
    return { kind: 'effects' };
  }
  const docsPath = path.replace(/^\/docs\/(?:es\/)?/, '');
  if (docsPath === path) {
    return undefined;
  }
  if (docsPaths.has(docsPath)) {
    return { kind: 'docs', slug: docsPath as (typeof docsSlugs)[number] };
  }
  const effect = docsPath.match(/^api\/effects\/([a-z0-9-]+)$/)?.[1];
  if (effect && effectIds.has(effect)) {
    return { kind: 'effect-reference', effect };
  }
  return undefined;
}

export function localeFromPath(pathname: string): Locale {
  return pathname === '/es' || pathname.startsWith('/es/') || pathname.startsWith('/docs/es/')
    ? 'es'
    : 'en';
}

export function localePath(page: PageIdentity, locale: Locale): string {
  const marketingPrefix = locale === 'es' ? '/es' : '';
  const docsPrefix = locale === 'es' ? '/docs/es' : '/docs';
  switch (page.kind) {
    case 'home':
      return `${marketingPrefix}/`;
    case 'effects':
      return `${marketingPrefix}/effects/`;
    case 'docs':
      return `${docsPrefix}/${page.slug}/`;
    case 'effect-reference':
      return `${docsPrefix}/api/effects/${page.effect}/`;
  }
}

function hasEquivalentAnchor(page: PageIdentity, anchor: string): boolean {
  switch (page.kind) {
    case 'home':
      return (
        [
          'top',
          'main',
          'hero-title',
          'humans-tab',
          'agents-tab',
          'humans-panel',
          'agents-panel',
          'examples',
          'collection',
          'supporting-content',
          'closing-content',
          'closing-title',
        ].includes(anchor) || homeEffectIds.has(anchor)
      );
    case 'effects':
      return (
        ['top', 'main', 'examples', 'collection', 'closing-content', 'closing-title'].includes(
          anchor,
        ) || effectIds.has(anchor)
      );
    case 'docs':
      return anchor === '_top' || docsAnchors[page.slug].includes(anchor);
    case 'effect-reference':
      return [
        '_top',
        'usage',
        'effect-options',
        'shared-options',
        'controls',
        'limits',
        'related',
      ].includes(anchor);
  }
}

export function languageHref(currentUrl: string | URL, locale: Locale): string | undefined {
  const url = new URL(currentUrl);
  const page = pageIdentity(url.pathname);
  if (!page) {
    return undefined;
  }
  let anchor = url.hash.slice(1);
  try {
    anchor = decodeURIComponent(anchor);
  } catch {
    anchor = '';
  }
  const hash = anchor && hasEquivalentAnchor(page, anchor) ? url.hash : '';
  return `${localePath(page, locale)}${url.search}${hash}`;
}
