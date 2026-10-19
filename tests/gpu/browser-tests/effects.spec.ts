import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import type {} from '../src/effects.js';

declare global {
  interface Window {
    shaderProbe: { entered: boolean; destroyed: number; release?: () => void };
  }
}

for (const target of ['text', 'svg', 'image']) {
  for (const dpr of [1, 2]) {
    test(`all effects compile, switch and seek on ${target} at DPR ${dpr}`, async ({
      page,
    }, info) => {
      await page.goto('/effects.html');
      await page.waitForFunction(() => Boolean(window.renderEffects));
      const result = await page.evaluate(([target, dpr]) => window.renderEffects(target, dpr), [
        target,
        dpr,
      ] as const);
      expect(result.cleanup.managedBytes).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.samples).toHaveLength(63);
      for (let i = 0; i < result.samples.length; i += 3) {
        expect(result.samples[i].pixels === result.samples[i + 2].pixels).toBe(true);
        expect(
          Buffer.from(result.samples[i].pixels, 'base64').some(
            (value, index) => index % 4 === 3 && value > 0,
          ),
        ).toBe(true);
      }
      const directory = process.env.DOMFX_EFFECT_BASELINE;
      if (directory) {
        await mkdir(directory, { recursive: true });
        for (let i = 0; i < result.samples.length; i += 3) {
          for (const sample of result.samples.slice(i, i + 2)) {
            const path = resolve(
              directory,
              `${target}-${dpr}-${sample.effect}-${sample.time}.rgba`,
            );
            const pixels = Buffer.from(sample.pixels, 'base64');
            if (process.env.DOMFX_RECORD_BASELINE === '1') {
              await writeFile(path, pixels);
            } else {
              // Same device/browser/capture: exact output is required for these mechanical refactors.
              expect(pixels.equals(await readFile(path)), path).toBe(true);
            }
          }
        }
      }
      await info.attach('environment.json', {
        body: JSON.stringify({ ...result, samples: undefined }),
        contentType: 'application/json',
      });
    });
  }
}

test('public attachments trace target/revision stages through real presentation', async ({
  page,
}) => {
  await page.goto('/effects.html');
  await page.waitForFunction(() => Boolean(window.traceEffects));
  const result = await page.evaluate(() => window.traceEffects());
  expect(result.lifecycle).toEqual(['active', 'active']);
  const fire = result.records.filter((record) => record.effect === 'fire');
  const frost = result.records.filter((record) => record.effect === 'frost');
  expect(new Set(fire.map((record) => record.target)).size).toBe(1);
  expect(fire[0].target).not.toBe(frost[0].target);
  for (const records of [fire, frost]) {
    for (const stage of ['renderer', 'capture', 'prepare', 'presentation', 'revision']) {
      expect(records.some((record) => record.stage === stage)).toBe(true);
    }
    expect(records.some((record) => record.phase === 'commit')).toBe(true);
  }
  expect(fire.some((record) => record.revision === 2 && record.phase === 'commit')).toBe(true);
  expect(await page.locator('canvas').count()).toBe(0);
  expect(
    await page.evaluate(
      () =>
        performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith('domfx:'))
          .length,
    ),
  ).toBe(0);
});

test('a broken shader exposes its effect and generated location through unavailable handling', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      const adapter = await requestAdapter(options);
      if (!adapter) {
        return adapter;
      }
      const requestDevice = adapter.requestDevice.bind(adapter);
      adapter.requestDevice = async (descriptor) => {
        const device = await requestDevice(descriptor);
        const createShaderModule = device.createShaderModule.bind(device);
        device.createShaderModule = (descriptor) =>
          createShaderModule(
            descriptor.label === 'domfx frost'
              ? { ...descriptor, code: 'invalid WGSL' }
              : descriptor,
          );
        return device;
      };
      return adapter;
    };
  });
  await page.goto('/manual.html');
  await page.waitForFunction(() => window.manual?.effect.lifecycle === 'unavailable');
  expect(await page.evaluate(() => window.manual.effect.reason)).toBe('renderer-failed');
  expect(await page.evaluate(() => window.manual.effect.reasonDetail)).toMatch(/frost WGSL\n1:\d+/);
  await expect(page.locator('#manual-target')).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(0);
});

test('disposal during shader initialization drains and releases the late renderer once', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.shaderProbe = { entered: false, destroyed: 0 };
    const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      const adapter = await requestAdapter(options);
      if (!adapter) {
        return adapter;
      }
      const requestDevice = adapter.requestDevice.bind(adapter);
      adapter.requestDevice = async (options) => {
        const device = await requestDevice(options);
        const destroy = device.destroy.bind(device);
        device.destroy = () => {
          window.shaderProbe.destroyed++;
          destroy();
        };
        const create = device.createShaderModule.bind(device);
        device.createShaderModule = (descriptor) => {
          const module = create(descriptor);
          if (descriptor.label === 'domfx frost') {
            const info = module.getCompilationInfo.bind(module);
            module.getCompilationInfo = async () => {
              const result = await info();
              window.shaderProbe.entered = true;
              await new Promise<void>((resolve) => {
                window.shaderProbe.release = resolve;
              });
              return result;
            };
          }
          return module;
        };
        return device;
      };
      return adapter;
    };
  });
  await page.goto('/manual.html');
  await page.waitForFunction(() => window.shaderProbe.entered);
  await page.evaluate(() => {
    window.manual.effect.dispose();
    window.shaderProbe.release?.();
  });
  await page.evaluate(() => window.manual.effect.ready);
  expect(await page.evaluate(() => window.manual.effect.lifecycle)).toBe('disposed');
  expect(await page.evaluate(() => window.shaderProbe.destroyed)).toBe(1);
  await page.evaluate(() => window.manual.effect.dispose());
  expect(await page.evaluate(() => window.shaderProbe.destroyed)).toBe(1);
  expect(await page.locator('canvas').count()).toBe(0);
});
