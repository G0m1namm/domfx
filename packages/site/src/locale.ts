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
    'install-the-alpha',
    'create-your-preview-app',
    'provide-the-target-and-host',
    'add-the-optional-gsap-binding',
    'set-up-your-coding-agent',
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

// Starlight derives translated heading IDs from Spanish text. Each entry matches
// the equivalent English section above; English IDs also remain as source aliases.
const spanishDocsAnchors: Record<(typeof docsSlugs)[number], readonly string[]> = {
  introduction: [
    'comienza-con-tu-elemento',
    'comienza-con-gsap',
    'controla-la-animación',
    'elige-un-efecto',
    'mantén-utilizable-el-contenido-original',
  ],
  installation: [
    'genera-artefactos-verificados',
    'instala-la-versión-alfa',
    'crea-tu-aplicación-de-prueba',
    'proporciona-el-objetivo-y-el-contenedor',
    'añade-el-enlace-opcional-de-gsap',
    'configura-tu-agente-de-programación',
  ],
  standalone: [
    'aplica-fire',
    'usa-otro-efecto',
    'controla-el-tiempo-y-la-intensidad',
    'actualiza-la-captura-y-libera-recursos',
    'salida-no-disponible',
  ],
  gsap: [
    'proporciona-tus-elementos',
    'construye-tu-secuencia',
    'avanza-y-reproduce',
    'gestiona-el-ciclo-de-vida',
    'limpieza-del-contexto-gsap',
    'funciones-opcionales-de-ciclo-de-vida',
    'salida-no-disponible-y-reintento',
  ],
  api: [
    'uso',
    'opciones-de-creación',
    'opciones-específicas-del-efecto',
    'controles-modificables',
    'estado-de-solo-lectura',
    'métodos',
    'efectos-disponibles',
    'gsap',
    'paquetes',
  ],
  'api/effects': ['energía', 'material', 'patrón'],
  'api/shared': [
    'opciones-de-creación',
    'controles-modificables',
    'controla-la-animación',
    'movimiento-reducido',
  ],
  'api/effect-handle': ['estado-de-solo-lectura', 'métodos', 'comprende-el-estado-informado'],
  'api/gsap': [
    'animaciones-nativas-de-propiedades',
    'enlaces-opcionales-con-valores-iniciales-fijos',
  ],
  upgrading: [
    'actualiza-paquetes-compatibles',
    'revisa-las-notas-de-migración',
    'nombres-de-animación-y-enlaces',
  ],
  support: [
    'entornos-medidos',
    'cobertura-sin-probar',
    'límites-de-captura-y-composición',
    'cuando-un-efecto-no-está-disponible',
    'acceso-al-código-y-comentarios',
  ],
  troubleshooting: [
    'salida-ausente-o-suprimida',
    'salida-mal-colocada-o-rechazada',
    'captura-fallida-u-obsoleta',
    'errores-de-instalación-o-shaders',
    'registra-un-efecto',
    'recupera-el-efecto-explícitamente',
  ],
};

// Explicit source IDs are present in both languages alongside translated headings.
const sharedDocsAnchors: Partial<Record<(typeof docsSlugs)[number], readonly string[]>> = {
  standalone: ['control-time'],
  gsap: ['context-cleanup', 'optional-bindings', 'unavailable-and-retry'],
  api: [
    'create-an-attachment',
    'attachment-options',
    'fire-only-options',
    'control-playback',
    'read-state',
    'refresh-retry-and-dispose',
    'bind-gsap',
    'package-boundaries',
  ],
  'api/shared': ['attachment-options', 'control-playback', 'animation-control'],
  'api/effect-handle': ['read-state', 'refresh-retry-and-dispose', 'independent-state'],
  'api/gsap': ['native-tweens', 'snapshot-bindings'],
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

function equivalentAnchor(
  page: PageIdentity,
  anchor: string,
  sourceLocale: Locale,
  targetLocale: Locale,
): string | undefined {
  switch (page.kind) {
    case 'home':
      return [
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
        ? anchor
        : undefined;
    case 'effects':
      return ['top', 'main', 'examples', 'collection', 'closing-content', 'closing-title'].includes(
        anchor,
      ) || effectIds.has(anchor)
        ? anchor
        : undefined;
    case 'docs':
      if (
        anchor === '_top' ||
        docsAnchors[page.slug].includes(anchor) ||
        sharedDocsAnchors[page.slug]?.includes(anchor)
      ) {
        return anchor;
      }
      if (sourceLocale === 'es') {
        const index = spanishDocsAnchors[page.slug].indexOf(anchor);
        if (index >= 0) {
          return targetLocale === 'en' ? docsAnchors[page.slug][index] : anchor;
        }
      }
      return undefined;
    case 'effect-reference':
      return [
        '_top',
        'usage',
        'effect-options',
        'shared-options',
        'controls',
        'limits',
        'related',
      ].includes(anchor)
        ? anchor
        : undefined;
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
  const equivalent = equivalentAnchor(page, anchor, localeFromPath(url.pathname), locale);
  let hash = '';
  if (equivalent) {
    hash = equivalent === anchor ? url.hash : `#${equivalent}`;
  }
  return `${localePath(page, locale)}${url.search}${hash}`;
}
