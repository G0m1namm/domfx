import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

const transforms = [
  'transform:rotate(15deg)',
  'transform:skewX(12deg)',
  'transform:perspective(500px) rotateY(20deg)',
  'perspective:500px',
  'transform:scale(0)',
  'transform:scale(-1,1)',
  'rotate:15deg',
  'scale:0',
  'scale:1 -1',
  'translate:0px 0px 10px',
  'zoom:1.2',
];
const compositions = [
  'opacity:0.5',
  'opacity:0',
  'filter:blur(2px)',
  'backdrop-filter:blur(2px)',
  'mix-blend-mode:multiply',
];
const clips = [
  'clip-path:circle(40%)',
  'mask-image:linear-gradient(black,transparent)',
  'clip:rect(0px,60px,50px,0px)',
  'contain:paint',
  'content-visibility:auto',
];

for (const phase of ['initial', 'live'] as const) {
  test(`${phase} unsupported composition reports no effect and preserves original DOM`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const results = await page.evaluate(
      async ({ phase, transforms, compositions, clips }) => {
        window.manual.effect.dispose();
        const cases = [
          ...transforms.flatMap((css) =>
            ['target', 'ancestor', 'host', 'outer'].map((at) => ({
              css,
              at,
              reason: 'unsupported-placement',
            })),
          ),
          ...compositions.flatMap((css) =>
            ['target', 'ancestor'].map((at) => ({ css, at, reason: 'unsupported-composition' })),
          ),
          ...clips.map((css) => ({ css, at: 'ancestor', reason: 'unsupported-placement' })),
        ];
        const results = [];
        for (const entry of cases) {
          const outer = document.createElement('div');
          const host = document.createElement('div');
          host.style.cssText = 'position:relative;width:150px;height:100px';
          const ancestor = document.createElement('div');
          ancestor.style.position = 'relative';
          const target = document.createElement('button');
          target.textContent = 'Original button';
          target.style.cssText = 'width:80px;height:50px;background:blue;border:1px solid black';
          ancestor.append(target);
          host.append(ancestor);
          outer.append(host);
          document.body.append(outer);
          const node =
            entry.at === 'target'
              ? target
              : entry.at === 'ancestor'
                ? ancestor
                : entry.at === 'host'
                  ? host
                  : outer;
          if (phase === 'initial') {
            node.style.cssText += `;${entry.css}`;
          }
          let originalStyle = target.getAttribute('style');
          let clicks = 0;
          target.onclick = () => {
            clicks += 1;
          };
          const effect = window.manual.attach(target, { host });
          await effect.ready;
          const started = effect.lifecycle;
          if (phase === 'live') {
            node.style.cssText += `;${entry.css}`;
            originalStyle = target.getAttribute('style');
            for (let i = 0; i < 3; i += 1) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            }
          }
          target.focus();
          target.click();
          results.push({
            ...entry,
            started,
            lifecycle: effect.lifecycle,
            actualReason: effect.reason,
            detail: effect.reasonDetail,
            canvases: host.querySelectorAll('canvas').length,
            usable:
              target.isConnected &&
              document.activeElement === target &&
              clicks === 1 &&
              target.getAttribute('style') === originalStyle,
          });
          effect.dispose();
          outer.remove();
        }
        return results;
      },
      { phase, transforms, compositions, clips },
    );
    await testInfo.attach('composition-matrix.json', {
      body: JSON.stringify(results),
      contentType: 'application/json',
    });
    for (const result of results) {
      expect(result, `${result.at}: ${result.css}`).toMatchObject({
        started: phase === 'initial' ? 'unavailable' : 'active',
        lifecycle: 'unavailable',
        actualReason: result.reason,
        detail: result.reason,
        canvases: 0,
        usable: true,
      });
    }
    expect(errors).toEqual([]);
  });
}

for (const stage of ['renderer', 'capture', 'prepare'] as const) {
  for (const css of ['transform:rotate(15deg)', 'opacity:0.5', 'clip-path:circle(40%)']) {
    test(`unsupported ${css} during initial ${stage} cannot be revived by late work`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/manual.html');
      const result = await page.evaluate(
        async ({ stage, css }) => {
          await window.manual.effect.ready;
          window.manual.effect.dispose();
          const fixture = window.manual.createMotionFixture('respect', stage);
          const ancestor = document.createElement('div');
          fixture.host.append(ancestor);
          ancestor.append(fixture.target);
          await fixture.entered;
          ancestor.style.cssText = css;
          for (let i = 0; i < 3; i += 1) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
          const rejected = fixture.snapshot();
          // Restoring support before the late result must not revive this handle.
          ancestor.style.cssText = '';
          fixture.release();
          await fixture.effect.ready;
          const settled = fixture.snapshot();
          const replacement = window.manual.attach(fixture.target, { host: fixture.host });
          await replacement.ready;
          fixture.effect.dispose();
          const replacementActive =
            replacement.lifecycle === 'active' &&
            fixture.host.querySelectorAll('canvas').length === 1;
          replacement.dispose();
          fixture.dispose();
          return { rejected, settled, replacementActive };
        },
        { stage, css },
      );
      const reason = css.startsWith('opacity')
        ? 'unsupported-composition'
        : 'unsupported-placement';
      expect(result.rejected).toMatchObject({
        lifecycle: 'unavailable',
        raster: 'stale',
        reason,
        canvases: 0,
        times: [],
      });
      expect(result.settled).toMatchObject({
        lifecycle: 'unavailable',
        reason,
        canvases: 0,
        managedBytes: 0,
        reservedBytes: 0,
        serviceDestroys: 1,
        times: [],
      });
      expect(result.settled.releases).toBe(result.settled.captures);
      expect(result.settled.destroys).toBe(result.settled.preparations);
      expect(result.replacementActive).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test('rejected overlay preserves real pointer and keyboard interaction', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  await page.locator('#manual-target').evaluate((target) => {
    target.style.filter = 'blur(1px)';
  });
  await expect
    .poll(() => page.evaluate(() => window.manual.effect.reason))
    .toBe('unsupported-composition');
  await expect(page.locator('#manual-host > canvas')).toHaveCount(0);
  await page.locator('#manual-target').click();
  await page.locator('#manual-target').press('Enter');
  await expect(page.locator('#clicks')).toHaveText('Target clicks: 2');
});

test('unsupported composition during refresh rejects before late preparation settles', async ({
  page,
}) => {
  await page.goto('/manual.html');
  const result = await page.evaluate(async () => {
    await window.manual.effect.ready;
    window.manual.effect.dispose();
    const fixture = window.manual.createMotionFixture('respect');
    await fixture.effect.ready;
    fixture.effect.pause();
    const renders = fixture.stats.times.length;
    fixture.block('prepare');
    let rejection: string | undefined;
    const refresh = fixture.effect.refresh().catch((error: Error) => {
      rejection = error.message;
    });
    await fixture.entered;
    fixture.target.style.filter = 'blur(1px)';
    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const rejected = { ...fixture.snapshot(), rejection };
    fixture.target.style.filter = '';
    fixture.release();
    await refresh;
    // Refresh rejects immediately; the non-cancellable adapter drains separately.
    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const settled = fixture.snapshot();
    fixture.dispose();
    return { rejected, settled, renders };
  });
  expect(result.rejected).toMatchObject({
    lifecycle: 'unavailable',
    reason: 'unsupported-composition',
    rejection: 'unsupported-composition',
    canvases: 0,
    previousWidth: 0,
  });
  expect(result.settled).toMatchObject({
    lifecycle: 'unavailable',
    reason: 'unsupported-composition',
    managedBytes: 0,
    reservedBytes: 0,
    serviceDestroys: 1,
    captures: 2,
    releases: 2,
    preparations: 2,
    destroys: 2,
  });
  expect(result.settled.times).toHaveLength(result.renders);
});

test('shared host group effects and captured target clips remain outside bypass checks', async ({
  page,
}) => {
  await page.goto('/manual.html');
  const result = await page.evaluate(async () => {
    await window.manual.effect.ready;
    window.manual.effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host')!;
    const target = document.querySelector<HTMLElement>('#manual-target')!;
    host.style.opacity = '0.8';
    host.style.filter = 'blur(1px)';
    target.style.clipPath = 'inset(1px round 8px)';
    const effect = window.manual.attach(target, { host });
    await effect.ready;
    const result = {
      lifecycle: effect.lifecycle,
      canvases: host.querySelectorAll('canvas').length,
    };
    effect.dispose();
    return result;
  });
  expect(result).toEqual({ lifecycle: 'active', canvases: 1 });
});
