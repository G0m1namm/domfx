import type { Page } from '@playwright/test';

declare global {
  interface Window {
    resolutionProbe: { changes: number; queries: MediaQueryList[] };
  }
}

export async function installResolutionProbe(page: Page) {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.resolutionProbe = { changes: 0, queries: [] };
    window.matchMedia = (query) => {
      const result = matchMedia(query);
      if (query.includes('resolution:')) {
        window.resolutionProbe.queries.push(result);
        result.addEventListener('change', () => window.resolutionProbe.changes++);
      }
      return result;
    };
  });
}

export function resolutionEvidence(page: Page) {
  return page.evaluate(() => ({
    changes: window.resolutionProbe.changes,
    dpr: devicePixelRatio,
    queries: window.resolutionProbe.queries.map((query) => ({
      media: query.media,
      matches: query.matches,
    })),
  }));
}
