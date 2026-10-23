import type { CaptureContext } from '@zumer/snapdom';

import { captureImageResources, imageFreshUntil } from './capture-images.js';

export type CaptureErrorCode =
  | 'asset-timeout'
  | 'image-load-failed'
  | 'asset-fetch-failed'
  | 'font-load-failed'
  | 'font-embed-failed'
  | 'unsupported-asset'
  | 'capture-decode-failed'
  | 'capture-readback-failed';

/** Capture failed without substituting missing required paint. */
export class CaptureError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    readonly asset: string,
    cause?: unknown,
  ) {
    super(`${code}: ${asset}${cause instanceof Error ? `: ${cause.message}` : ''}`, { cause });
    this.name = 'CaptureError';
  }
}

// A stalled resource must not hold an attachment's reservation indefinitely.
async function waitForAsset<T>(promise: Promise<T>, asset: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CaptureError('asset-timeout', asset)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function familyName(value: string) {
  return value.replace(/^["']|["']$/g, '').toLowerCase();
}

// Weak keys tie embedded data to the browser's loaded font lifetime, not captures.
// Changing a CSS font's src creates a new FontFace; other descriptor edits change cssText.
const embeddedFonts = new WeakMap<FontFace, { declaration: string; css: string }>();

function matchesFontFace(style: CSSStyleDeclaration, face: FontFace) {
  return (
    familyName(style.getPropertyValue('font-family')) === familyName(face.family) &&
    (style.getPropertyValue('font-weight') || 'normal').replace('normal', '400') ===
      face.weight.replace('normal', '400') &&
    (style.getPropertyValue('font-style') || 'normal') === face.style &&
    (style.getPropertyValue('font-stretch') || 'normal').replace('100%', 'normal') ===
      face.stretch.replace('100%', 'normal') &&
    (style.getPropertyValue('unicode-range') || 'U+0-10FFFF') === face.unicodeRange
  );
}

/** Fresh paint per capture, with validated font data and HTTP-fresh image reuse. */
export async function prepareCaptureAssets(target: Element) {
  const document = target.ownerDocument;
  const view = document.defaultView!;
  const images = new Map<Node, string>();
  const backgrounds = new Map<Node, string>();
  const resources = new Map<string, string>();
  const reusableImages = captureImageResources(document);
  const fonts = new Set<FontFace>();
  const hidden = new Set<Element>();
  let hasUnresolvedText = false;

  async function imageData(url: string): Promise<string> {
    const cached = resources.get(url) ?? reusableImages.get(url);
    if (cached) {
      return cached;
    }
    let blob: Blob;
    let expires = 0;
    const revision = reusableImages.revision;
    const started = Date.now();
    try {
      const response = await view.fetch(url, {
        mode: 'cors',
        credentials: 'same-origin',
        signal: view.AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      expires = imageFreshUntil(response, started);
      blob = await response.blob();
    } catch (cause) {
      throw new CaptureError('asset-fetch-failed', url, cause);
    }
    // SVG documents can themselves omit external images/fonts when decoded as an
    // image. Their dependency graph is outside this bounded raster asset contract.
    if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) {
      throw new CaptureError('unsupported-asset', `${url} (${blob.type || 'unknown MIME'})`);
    }
    const reader = new view.FileReader();
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new CaptureError('asset-fetch-failed', url, reader.error));
      reader.readAsDataURL(blob);
    });
    const image = document.createElement('img');
    try {
      image.src = data;
      await waitForAsset(image.decode(), url);
    } catch (cause) {
      if (cause instanceof CaptureError) {
        throw cause;
      }
      throw new CaptureError('image-load-failed', url, cause);
    } finally {
      image.src = '';
    }
    resources.set(url, data);
    reusableImages.put(url, data, expires, revision);
    return data;
  }

  async function loadFonts(style: CSSStyleDeclaration, text: string) {
    if (!text.trim()) {
      return;
    }
    const stretch = {
      '50%': 'ultra-condensed',
      '62.5%': 'extra-condensed',
      '75%': 'condensed',
      '87.5%': 'semi-condensed',
      '100%': 'normal',
      '112.5%': 'semi-expanded',
      '125%': 'expanded',
      '150%': 'extra-expanded',
      '200%': 'ultra-expanded',
    }[style.fontStretch];
    if (!stretch) {
      throw new CaptureError('unsupported-asset', `font stretch ${style.fontStretch}`);
    }
    const font = `${style.fontStyle} ${style.fontWeight} ${stretch} ${style.fontSize} ${style.fontFamily}`;
    try {
      for (const face of await waitForAsset(document.fonts.load(font, text), style.fontFamily)) {
        fonts.add(face);
      }
    } catch (cause) {
      if (cause instanceof CaptureError) {
        throw cause;
      }
      throw new CaptureError('font-load-failed', style.fontFamily, cause);
    }
  }

  for (const element of [target, ...target.querySelectorAll('*')]) {
    const style = view.getComputedStyle(element);
    // SnapDOM 2.24.15 temporarily edits these source styles while cloning.
    // Reject before it can trigger an endless observer/capture feedback cycle.
    if (
      style.contentVisibility === 'auto' ||
      (element === target &&
        style.outlineStyle !== 'none' &&
        Number.parseFloat(style.outlineWidth) > 0 &&
        (style.borderStyle === 'none' || Number.parseFloat(style.borderWidth) === 0))
    ) {
      throw new CaptureError('unsupported-asset', 'capture source style mutation');
    }
    if (style.display === 'none' || (element.parentElement && hidden.has(element.parentElement))) {
      hidden.add(element);
      continue;
    }
    // Native controls and list markers can paint text without a text node.
    if (element.matches('input, textarea, select') || style.display === 'list-item') {
      hasUnresolvedText = true;
    }
    if (
      element.matches('iframe, object, embed, video, image, use, feImage, input[type="image"]') ||
      element.shadowRoot
    ) {
      throw new CaptureError('unsupported-asset', element.localName);
    }
    if (element instanceof view.HTMLCanvasElement) {
      try {
        element.toDataURL();
      } catch (cause) {
        throw new CaptureError('capture-readback-failed', 'canvas', cause);
      }
    }
    for (const pseudo of [null, '::before', '::after']) {
      const paint = pseudo ? view.getComputedStyle(element, pseudo) : style;
      if (pseudo && (paint.content === 'none' || paint.content === 'normal')) {
        continue;
      }
      // Reject other URL-bearing paint instead of letting the adapter omit it.
      for (const property of paint) {
        const value = paint.getPropertyValue(property);
        if (
          (/url\(/i.test(value) || /image-set\(/i.test(value)) &&
          property !== 'cursor' &&
          !property.startsWith('--') &&
          (pseudo || property !== 'background-image')
        ) {
          throw new CaptureError('unsupported-asset', `${pseudo ?? element.localName} ${property}`);
        }
      }
      if (!pseudo && style.backgroundImage !== 'none') {
        const background = style.backgroundImage;
        if (/image-set\(/i.test(background)) {
          throw new CaptureError('unsupported-asset', 'background image-set');
        }
        let embedded = background;
        const urls = /url\("([^"\\]+)"\)/g;
        if (/url\(/i.test(background.replace(urls, ''))) {
          throw new CaptureError('unsupported-asset', 'background URL syntax');
        }
        for (const match of background.matchAll(urls)) {
          const url = match[1];
          if (url) {
            embedded = embedded.replace(match[0], `url("${await imageData(url)}")`);
          }
        }
        backgrounds.set(element, embedded);
      }
      // CSSOM leaves counters, quotes and mixed content unresolved. Keep fresh
      // discovery when their rendered glyphs cannot be passed to FontFaceSet.load.
      if (pseudo && !/^"(?:[^"\\]|\\.)*"$/s.test(paint.content)) {
        hasUnresolvedText = true;
        continue;
      }
      const text = pseudo
        ? paint.content.slice(1, -1)
        : [...element.childNodes]
            .filter((node) => node.nodeType === 3)
            .map((node) => node.textContent)
            .join('') +
          (element instanceof view.HTMLInputElement || element instanceof view.HTMLTextAreaElement
            ? element.value
            : '');
      await loadFonts(paint, text);
    }
    if (element instanceof view.HTMLImageElement) {
      try {
        await waitForAsset(element.decode(), element.currentSrc || element.src);
        if (!element.naturalWidth || !element.naturalHeight) {
          throw new Error('empty-image');
        }
      } catch (cause) {
        if (cause instanceof CaptureError) {
          throw cause;
        }
        throw new CaptureError('image-load-failed', element.currentSrc || element.src, cause);
      }
      reusableImages.track(element);
      images.set(element, await imageData(element.currentSrc || element.src));
    }
  }

  if (fonts.size) {
    await waitForAsset(document.fonts.ready, 'document fonts');
  }

  // Cache only unambiguous, readable top-level declarations. Imported, nested and
  // cross-origin declarations keep SnapDOM's discovery/validation path.
  const declarations = new Map<FontFace, string>();
  const reusableCSS: string[] = [];
  if (fonts.size && !hasUnresolvedText) {
    let complete = true;
    const rules: CSSFontFaceRule[] = [];
    function collectRules(cssRules: CSSRuleList, topLevel: boolean) {
      for (const rule of cssRules) {
        if (rule instanceof view.CSSFontFaceRule) {
          if (topLevel) {
            rules.push(rule);
          } else {
            complete = false;
          }
        } else if (rule instanceof view.CSSImportRule) {
          complete = false;
        } else if (rule instanceof view.CSSGroupingRule) {
          collectRules(rule.cssRules, false);
        }
      }
    }
    for (const sheet of document.styleSheets) {
      try {
        collectRules(sheet.cssRules, true);
      } catch {
        complete = false;
      }
    }
    for (const face of fonts) {
      const matches = rules.filter((rule) => matchesFontFace(rule.style, face));
      if (!complete || matches.length !== 1) {
        continue;
      }
      const declaration = matches[0]!.cssText;
      declarations.set(face, declaration);
      const cached = embeddedFonts.get(face);
      if (cached?.declaration === declaration) {
        reusableCSS.push(cached.css);
      }
    }
  }
  const reuseFonts = fonts.size > 0 && reusableCSS.length === fonts.size;

  function embedImages({ nodeMap, styleCache }: CaptureContext) {
    for (const [clone, original] of nodeMap ?? []) {
      if (!(clone instanceof view.Element)) {
        continue;
      }
      const background = backgrounds.get(original);
      if (background && (clone instanceof view.HTMLElement || clone instanceof view.SVGElement)) {
        clone.style.setProperty('background-image', background, 'important');
        // SnapDOM 2.24.15 embeds backgrounds from its source-style cache after
        // afterClone. Replace only that capture's style entry to avoid a second fetch.
        if (styleCache instanceof view.WeakMap) {
          const sourceStyle: unknown = styleCache.get(original);
          if (sourceStyle instanceof view.CSSStyleDeclaration) {
            const embeddedStyle = document.createElement('span').style;
            for (const property of sourceStyle) {
              embeddedStyle.setProperty(property, sourceStyle.getPropertyValue(property));
            }
            embeddedStyle.setProperty('background-image', background);
            styleCache.set(original, embeddedStyle);
          }
        }
      }
      const data = images.get(original);
      if (data) {
        clone.setAttribute('src', data);
        clone.removeAttribute('srcset');
        clone.removeAttribute('sizes');
      }
    }
  }

  return {
    embedFonts: (fonts.size > 0 || hasUnresolvedText) && !reuseFonts,
    embedImages,
    async beforeRender(context: CaptureContext) {
      for (const [clone, original] of context.nodeMap ?? []) {
        const background = backgrounds.get(original);
        if (background && (clone instanceof view.HTMLElement || clone instanceof view.SVGElement)) {
          clone.style.setProperty('background-image', background, 'important');
        }
      }
      if (!fonts.size) {
        return;
      }
      if (reuseFonts) {
        context.fontsCSS = reusableCSS.join('\n');
        return;
      }
      const sheet = new view.CSSStyleSheet();
      sheet.replaceSync(context.fontsCSS ?? '');
      const embedded = [...sheet.cssRules].filter(
        (rule): rule is CSSFontFaceRule => rule instanceof view.CSSFontFaceRule,
      );
      for (const face of fonts) {
        const matches = embedded.filter(({ style }) => matchesFontFace(style, face));
        const rule = matches[0];
        const source = rule?.style.getPropertyValue('src') ?? '';
        const urls = [...source.matchAll(/url\("([^"]*)"\)/g)];
        if (
          !urls.length ||
          urls.some((match) => !match[1]?.startsWith('data:')) ||
          /local\(/i.test(source)
        ) {
          throw new CaptureError('font-embed-failed', face.family);
        }
        try {
          await waitForAsset(new view.FontFace(face.family, source).load(), face.family);
          const declaration = declarations.get(face);
          if (declaration && rule && matches.length === 1) {
            embeddedFonts.set(face, { declaration, css: rule.cssText });
          }
        } catch (cause) {
          throw new CaptureError('font-embed-failed', face.family, cause);
        }
      }
    },
  };
}
