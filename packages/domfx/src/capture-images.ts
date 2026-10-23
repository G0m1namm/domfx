type EmbeddedImage = { data: string; expires: number };
type ImageResources = {
  entries: Map<string, EmbeddedImage>;
  sources: WeakMap<HTMLImageElement, string>;
  bytes: number;
  revision: number;
};

// Document ownership avoids sharing credentials or data between browsing contexts.
const documents = new WeakMap<Document, ImageResources>();
const maxBytes = 16 * 1024 * 1024;
const maxEntries = 32;

export function captureImageResources(document: Document) {
  let resources = documents.get(document);
  if (!resources) {
    resources = { entries: new Map(), sources: new WeakMap(), bytes: 0, revision: 0 };
    documents.set(document, resources);
  }
  const state = resources;

  function remove(url: string) {
    const entry = state.entries.get(url);
    if (entry) {
      state.bytes -= (url.length + entry.data.length) * 2;
      state.entries.delete(url);
    }
  }

  return {
    get revision() {
      return state.revision;
    },
    track(image: HTMLImageElement) {
      const url = image.currentSrc || image.src;
      const source = JSON.stringify([
        url,
        image.src,
        image.srcset,
        image.sizes,
        image.crossOrigin,
        image.referrerPolicy,
      ]);
      const previous = state.sources.get(image);
      if (previous === undefined) {
        // The source owns its listeners; weak keys never retain source elements.
        const invalidate = () => {
          remove(url);
          remove(image.currentSrc || image.src);
          state.revision += 1;
        };
        image.addEventListener('load', invalidate);
        image.addEventListener('error', invalidate);
      }
      if (previous !== source) {
        remove(url);
        state.revision += 1;
      }
      state.sources.set(image, source);
    },
    get(url: string) {
      for (const [key, entry] of state.entries) {
        if (entry.expires <= Date.now()) {
          remove(key);
        }
      }
      const entry = state.entries.get(url);
      if (entry) {
        state.entries.delete(url);
        state.entries.set(url, entry);
      }
      return entry?.data;
    },
    put(url: string, data: string, expires: number, revision: number) {
      const bytes = (url.length + data.length) * 2;
      if (expires <= Date.now() || bytes > maxBytes || revision !== state.revision) {
        return;
      }
      remove(url);
      while (state.entries.size >= maxEntries || state.bytes + bytes > maxBytes) {
        const oldest = state.entries.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        remove(oldest);
      }
      state.entries.set(url, { data, expires });
      state.bytes += bytes;
    },
  };
}

/** Reuse only explicit, unambiguous freshness; default fetch handles all other cases. */
export function imageFreshUntil(response: Response, started: number) {
  // Cross-origin headers may hide Age/Date/Vary, so their freshness is not provable.
  if (response.type === 'cors' || response.redirected || response.headers.has('vary')) {
    return 0;
  }
  const control = response.headers.get('cache-control') ?? '';
  if (/(?:^|,)\s*(?:no-cache|no-store)\b/i.test(control)) {
    return 0;
  }
  const ages = [...control.matchAll(/(?:^|,)\s*max-age=(\d+)\s*(?=,|$)/gi)];
  if (
    ages.length !== 1 ||
    control.split(',').filter((part) => /^\s*max-age\s*=/i.test(part)).length !== 1
  ) {
    return 0;
  }
  const lifetime = Number(ages[0]![1]) * 1000;
  if (!Number.isFinite(lifetime)) {
    return 0;
  }
  const date = Date.parse(response.headers.get('date') ?? '');
  const age = Number(response.headers.get('age') ?? 0) * 1000;
  if (!Number.isFinite(age) || age < 0) {
    return 0;
  }
  const apparentAge = Number.isFinite(date) ? Math.max(0, Date.now() - date) : 0;
  return started + lifetime - Math.max(age, apparentAge);
}
