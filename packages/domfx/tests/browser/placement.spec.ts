import { expect, test } from '@playwright/test';

import type {} from './placement-fixture.js';

test('actual Floating UI adapter preserves live physical landmarks', async ({ page }, testInfo) => {
  await page.goto('/');
  const results = await page.evaluate(() => window.placementFixture.geometry());
  await testInfo.attach('geometry', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  for (const result of results) {
    expect(result.physicalError, result.label).toBeLessThanOrEqual(1);
    expect(result.clippingErrors, `${result.label}: native overflow clip`).toBe(0);
  }
});

for (const scenario of [
  'initial',
  'refresh',
  'replacement',
  'obsolete-error',
  'active-suspend',
  'active-retry',
  'active-loss',
] as const) {
  test(`delayed coordinates preserve ${scenario} lifecycle`, async ({ page }, testInfo) => {
    await page.goto('/');
    const result = await page.evaluate(
      (value) => window.placementFixture.lifecycle(value),
      scenario,
    );
    await testInfo.attach('lifecycle', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    expect(result.pending).toEqual({
      ready: false,
      presentations: 0,
      coordinateCalls: 1,
      hiddenWhilePending: true,
      measuredWhileDisplayed: true,
    });
    expect(result.maximumInFlight).toBeLessThanOrEqual(
      scenario === 'replacement' || scenario === 'obsolete-error' ? 2 : 1,
    );
    expect(result.ready).toBe(true);
    expect(result.presentations).toBe(
      scenario === 'active-retry' || scenario === 'active-loss' ? 2 : 1,
    );
    expect(result.errors).toEqual([]);
    expect(result.memory).toBe(0);
    expect(result.destroyed).toBe(result.preparations);
    expect(result.coordinatesAfterDispose).toBe(0);
    if ('replacementActive' in result) {
      expect(result.replacementActive).toBe(true);
      expect(result.replacementRetained).toBe(true);
      expect(result.layers).toBe(1);
      expect(result.rendererReleases).toBe(2);
    } else {
      expect(result.physicalError).toBeLessThanOrEqual(1);
      expect(result.resized).toEqual({ captures: 1, renders: 1, presentations: 1 });
      if (result.activePhase) {
        expect(result.activePhase).toEqual({
          callsWhilePending: 1,
          hiddenAfterCompletion: true,
          callsWhileSuspended: 0,
        });
      }
      expect(result.captures).toBe(result.before.captures);
      expect(result.renders).toBe(result.before.renders);
      expect(result.presentations).toBe(result.before.presentations);
      expect(result.time).toBe(result.before.time);
    }
  });
}
