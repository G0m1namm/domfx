import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { build, type Rollup } from 'vite';

import {
  defaultEffectSettings,
  effectAttachmentOptions,
  effectSnippet,
  type EffectSettings,
} from '@domfx/site/effect-settings';
import { effects, findEffect, type Effect } from '@domfx/site/effects';

type AttachFunction = (target: Element, options: Record<string, unknown>) => FixtureHandle;
interface FixtureHandle {
  readonly ready: Promise<void>;
  readonly clock: string;
  readonly seed: number;
  readonly intensity: number;
  readonly lifecycle: string;
  readonly reason?: string;
  readonly rootColor?: string;
  dispose(): void;
}
type FixtureApi = Record<string, AttachFunction> & {
  createEffectSlot: (options: unknown) => {
    show(target: Element, effect: unknown, options: () => unknown): Promise<void>;
    readonly handle?: FixtureHandle;
    readonly status: { lifecycle: string; reason?: string };
    dispose(): void;
  };
};

declare global {
  interface Window {
    domfxApi: FixtureApi;
  }
}

/** Bundles the real packages; the site has no page that exposes their exports to a test. */
async function fixtureBundle() {
  const output = (await build({
    configFile: false,
    logLevel: 'silent',
    // Library mode leaves this for the consumer; a classic script has no `process`.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, 'effect-settings-api.fixture.ts'),
        formats: ['iife'],
        name: 'domfxApi',
        fileName: 'fixture',
      },
    },
  })) as Rollup.RollupOutput[];
  const [chunk] = output.flatMap((result) => result.output);
  if (chunk?.type !== 'chunk') {
    throw new Error('The API fixture did not build');
  }
  return chunk.code;
}

function nonDefaultSettings(effect: Effect): EffectSettings {
  const defaults = defaultEffectSettings(effect);
  return {
    ...defaults,
    intensity: 0.5,
    seed: 99,
    clock: 'manual',
    time: 2.4,
    motion: 'static',
    options: Object.fromEntries(Object.keys(defaults.options).map((name) => [name, 0])),
    color: { mode: 'single', color: '#336699' },
  };
}

const scenarios = effects.flatMap((effect) => [
  { label: 'defaults', effect, settings: defaultEffectSettings(effect) },
  { label: 'every value changed', effect, settings: nonDefaultSettings(effect) },
]);
const fire = findEffect('fire');
if (!fire) {
  throw new Error('Fire is missing from the catalog');
}
scenarios.push({
  label: 'one ramp side',
  effect: fire,
  settings: {
    ...defaultEffectSettings(fire),
    color: { mode: 'root-and-tip', tipColor: '#336699' },
  },
});
scenarios.push({
  label: 'both ramp sides',
  effect: fire,
  settings: {
    ...defaultEffectSettings(fire),
    color: { mode: 'root-and-tip', rootColor: '#112233', tipColor: '#336699' },
  },
});

let bundle: Promise<string> | undefined;

// Attachment validation precedes GPU work, so unavailable WebGPU still exercises the real API.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setContent(
    '<div id="host" style="position:relative;width:200px;height:200px"><span id="target">domfx</span></div>',
  );
  bundle ??= fixtureBundle();
  await page.addScriptTag({ content: await bundle });
});

test('the real API runs copied code and preview options for all 21 effects @routine', async ({
  page,
}) => {
  test.setTimeout(90_000);
  expect(new Set(scenarios.map(({ effect }) => effect.id)).size).toBe(21);
  const cases = scenarios.map(({ label, effect, settings }) => ({
    label: `${effect.id}: ${label}`,
    exportName: effect.exportName,
    code: effectSnippet(effect, settings, 'en'),
    options: effectAttachmentOptions(effect, settings),
  }));

  const results = await page.evaluate(async (scenarioList) => {
    const host = document.querySelector<HTMLElement>('#host');
    const target = document.querySelector('#target');
    if (!host || !target) {
      throw new Error('Fixture markup is missing');
    }
    const outcomes = [];
    for (const { label, exportName, code, options } of scenarioList) {
      const attach = window.domfxApi[exportName];
      try {
        // Runs the copied text itself, apart from its import line.
        const body = `${code.replace(/^import .*$/m, '')}\nreturn effect;`;
        const copied: FixtureHandle = new Function(exportName, 'target', 'host', body)(
          attach,
          target,
          host,
        );
        await copied.ready;
        const accepted = {
          lifecycle: copied.lifecycle,
          reason: copied.reason,
          clock: copied.clock,
          seed: copied.seed,
          intensity: copied.intensity,
        };
        copied.dispose();
        const preview = attach(target, { ...options, host });
        await preview.ready;
        preview.dispose();
        outcomes.push({ label, ...accepted });
      } catch (error) {
        outcomes.push({ label, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcomes;
  }, cases);

  expect(results).toHaveLength(cases.length);
  for (const [index, result] of results.entries()) {
    const { options } = cases[index];
    expect(result).toEqual({
      label: cases[index].label,
      lifecycle: 'unavailable',
      reason: 'no-webgpu',
      clock: options.clock,
      seed: options.seed,
      intensity: options.intensity,
    });
  }
});

test('the real API still rejects options outside the contract @routine', async ({ page }) => {
  const failures = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('#host');
    const target = document.querySelector('#target');
    if (!host || !target) {
      throw new Error('Fixture markup is missing');
    }
    return (
      [
        { flameReach: -1 },
        { seed: 1e39 },
        { color: '#336699', rootColor: '#112233' },
        { color: 'not-a-color' },
        { emberDensity: 2 },
      ] as const
    ).map((options) => {
      try {
        window.domfxApi.attachFire(target, { ...options, host }).dispose();
        return 'accepted';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
  });
  expect(failures).toEqual(Array(5).fill('invalid-fire-parameter'));
});

test('the effect slot forwards settings-derived options to the real handle @routine', async ({
  page,
}) => {
  const options = effectAttachmentOptions(fire, {
    ...defaultEffectSettings(fire),
    seed: 99,
    color: { mode: 'root-and-tip', rootColor: '#112233' },
  });
  const result = await page.evaluate(
    async ({ effect, slotOptions }) => {
      const host = document.querySelector<HTMLElement>('#host');
      const target = document.querySelector('#target');
      if (!host || !target) {
        throw new Error('Fixture markup is missing');
      }
      const slot = window.domfxApi.createEffectSlot({
        host,
        environment: { blockedReason: () => undefined, onChange: () => () => undefined },
      });
      await slot.show(target, effect, () => slotOptions);
      const observed = {
        status: slot.status,
        seed: slot.handle?.seed,
        rootColor: slot.handle?.rootColor,
      };
      slot.dispose();
      return observed;
    },
    { effect: fire, slotOptions: options },
  );
  expect(result).toEqual({
    status: { lifecycle: 'unavailable', reason: 'no-webgpu' },
    seed: 99,
    // The handle reports the API's canonical form of the color it accepted.
    rootColor: 'rgb(17, 34, 51)',
  });
});
