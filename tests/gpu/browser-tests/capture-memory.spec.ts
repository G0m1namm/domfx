import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

for (const kind of ['font', 'image'] as const) {
  test(`released ${kind} captures do not retain detached image fallback trees`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Native DOM counters require Chromium CDP');
    await page.goto('/assets.html');
    await page.evaluate((kind) => {
      const file = kind === 'font' ? 'block.ttf' : 'split.png';
      window.assets.setup(kind, `/asset-fixtures/${file}`);
    }, kind);
    const session = await page.context().newCDPSession(page);
    const nodes: number[] = [];
    try {
      for (let batch = 0; batch < 3; batch += 1) {
        await page.evaluate(async () => {
          for (let capture = 0; capture < 40; capture += 1) {
            const result = await window.assets.capture();
            if (result.code !== 'ready' || !result.released) {
              throw new Error(`capture did not release: ${JSON.stringify(result)}`);
            }
          }
        });
        await session.send('HeapProfiler.collectGarbage');
        nodes.push((await session.send('Memory.getDOMCounters')).nodes);
      }
      // The old src removal retained an image and its five fallback nodes each time.
      // Allow a small settling margin, but reject growth proportional to captures.
      expect(nodes[2]! - nodes[0]!, JSON.stringify(nodes)).toBeLessThan(24);
    } finally {
      await session.detach();
    }
  });
}
