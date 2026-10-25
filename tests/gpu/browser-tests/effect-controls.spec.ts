import { expect, test } from '@playwright/test';

test('selected effect controls validate, retain state and change only their intended output', async ({
  page,
}) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const image = () => host.querySelector('canvas')!.toDataURL();
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const errors: string[] = [];
    for (const attach of [
      () => window.controlEffects.fire(target, { host, emberDensity: -0.1 }),
      () => window.controlEffects.fire(target, { host, emberDensity: 1.1 }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects.halftone(target, { host, color: null }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects.halftone(target, { host, color: 1 }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects.frost(target, { host, mistOpacity: null }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects.slime(target, { host, color: null }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects['burned-paper'](target, { host, emberGlow: null }),
    ]) {
      try {
        attach().dispose();
        errors.push('accepted');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const frost = window.controlEffects.frost(target, { host, time: 2, intensity: 0.8 });
    await frost.ready;
    const frostDefault = frost.mistOpacity;
    const frostBefore = image();
    frost.mistOpacity = 0;
    await settle();
    const frostAfter = image();
    let frostError = '';
    try {
      frost.mistOpacity = Number.NaN;
    } catch (error) {
      frostError = error instanceof Error ? error.message : String(error);
    }
    await frost.refresh();
    const frostRetained = frost.mistOpacity;
    frost.dispose();

    const frostExtreme = window.controlEffects.frost(target, {
      host,
      time: 2,
      mistOpacity: Number.MAX_VALUE,
    });
    await frostExtreme.ready;
    frostExtreme.mistOpacity = -Number.MAX_VALUE;
    const frostExtremeValue = frostExtreme.mistOpacity;
    frostExtreme.dispose();

    const slime = window.controlEffects.slime(target, { host, time: 2, intensity: 0.8 });
    await slime.ready;
    const slimeDefault = slime.color;
    const slimeBefore = image();
    slime.color = '#000000';
    await settle();
    const slimeAfter = image();
    slime.dispose();

    const slimeExtreme = window.controlEffects.slime(target, { host, time: 2 });
    await slimeExtreme.ready;
    let slimeExtremeError = '';
    try {
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      slimeExtreme.color = null;
    } catch (error) {
      slimeExtremeError = error instanceof Error ? error.message : String(error);
    }
    const slimeExtremeValue = slimeExtreme.color;
    slimeExtreme.dispose();

    const paper = window.controlEffects['burned-paper'](target, {
      host,
      time: 2,
      intensity: 0.8,
    });
    await paper.ready;
    const paperDefault = paper.emberGlow;
    const paperBefore = image();
    paper.emberGlow = 0;
    await settle();
    const paperAfter = image();
    paper.dispose();

    const paperExtreme = window.controlEffects['burned-paper'](target, {
      host,
      time: 2,
      emberGlow: Number.MAX_VALUE,
    });
    await paperExtreme.ready;
    paperExtreme.emberGlow = -Number.MAX_VALUE;
    const paperExtremeValue = paperExtreme.emberGlow;
    paperExtreme.dispose();

    const fireDefault = window.controlEffects.fire(target, { host, intensity: 0.8, seed: 314 });
    await fireDefault.ready;
    const fireDefaultImages: string[] = [];
    for (const time of [0, 0.5, 1, 1.5, 2]) {
      fireDefault.time = time;
      await settle();
      fireDefaultImages.push(image());
    }
    fireDefault.dispose();
    const fireNone = window.controlEffects.fire(target, {
      host,
      intensity: 0.8,
      seed: 314,
      emberDensity: 0,
    });
    await fireNone.ready;
    const fireNoneImages: string[] = [];
    for (const time of [0, 0.5, 1, 1.5, 2]) {
      fireNone.time = time;
      await settle();
      fireNoneImages.push(image());
    }
    fireNone.dispose();

    const halftoneDefault = window.controlEffects.halftone(target, {
      host,
      time: 2,
      intensity: 0.8,
    });
    await halftoneDefault.ready;
    const halftoneDefaultImage = image();
    halftoneDefault.color = '#00ff00';
    await settle();
    const halftoneColorImage = image();
    const defaults = {
      emberDensity: fireDefault.emberDensity,
      color: slimeDefault,
      emberGlow: paperDefault,
    };
    halftoneDefault.dispose();

    return {
      errors,
      frostDefault,
      frostChanged: frostBefore !== frostAfter,
      frostError,
      frostRetained,
      frostExtremeValue,
      slimeChanged: slimeBefore !== slimeAfter,
      slimeExtremeError,
      slimeExtremeValue,
      paperChanged: paperBefore !== paperAfter,
      paperExtremeValue,
      fireChanged: fireDefaultImages.some((value, index) => value !== fireNoneImages[index]),
      halftoneChanged: halftoneDefaultImage !== halftoneColorImage,
      defaults,
      canvases: host.querySelectorAll('canvas').length,
    };
  });
  expect(result).toEqual({
    errors: [
      'invalid-fire-parameter',
      'invalid-fire-parameter',
      'invalid-halftone-parameter',
      'invalid-halftone-parameter',
      'invalid-frost-parameter',
      'invalid-slime-parameter',
      'invalid-burned-paper-parameter',
    ],
    frostDefault: 1,
    frostChanged: true,
    frostError: 'invalid-frost-parameter',
    frostRetained: 0,
    frostExtremeValue: 0,
    slimeChanged: true,
    slimeExtremeError: 'invalid-slime-parameter',
    slimeExtremeValue: undefined,
    paperChanged: true,
    paperExtremeValue: 0,
    fireChanged: true,
    halftoneChanged: true,
    defaults: { emberDensity: 1, color: undefined, emberGlow: 1 },
    canvases: 0,
  });
});

test('public handles expose only their owned controls at runtime', async ({ page }) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const controls = ['color', 'mistOpacity', 'emberDensity', 'emberGlow'];
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const attachments = [
      {
        name: 'frost',
        key: 'mistOpacity',
        value: 0,
        attach: () => window.controlEffects.frost(target, { host, time: 2 }),
      },
      {
        name: 'fire',
        key: 'emberDensity',
        value: 0,
        attach: () => window.controlEffects.fire(target, { host, time: 2 }),
      },
      {
        name: 'halftone',
        key: 'color',
        value: '#00ff00',
        attach: () => window.controlEffects.halftone(target, { host, time: 2 }),
      },
      {
        name: 'slime',
        key: 'color',
        value: '#00ff00',
        attach: () => window.controlEffects.slime(target, { host, time: 2 }),
      },
      {
        name: 'burned-paper',
        key: 'emberGlow',
        value: 0,
        attach: () => window.controlEffects['burned-paper'](target, { host, time: 2 }),
      },
      {
        name: 'electricity',
        key: undefined,
        value: undefined,
        attach: () => window.controlEffects.electricity(target, { host, time: 2 }),
      },
    ];

    const values = [];
    for (const attachment of attachments) {
      const handle = attachment.attach();
      await handle.ready;
      let write: { accepted: boolean; value: unknown } | null = null;
      if (attachment.key !== undefined && attachment.value !== undefined) {
        const accepted = Reflect.set(handle, attachment.key, attachment.value);
        await settle();
        write = { accepted, value: Reflect.get(handle, attachment.key) };
      }
      values.push({
        name: attachment.name,
        controls: controls.filter((key) => key in handle),
        absent: controls.filter((key) => !(key in handle)),
        write,
      });
      handle.dispose();
    }
    return values;
  });

  expect(result).toEqual([
    {
      name: 'frost',
      controls: ['color', 'mistOpacity'],
      absent: ['emberDensity', 'emberGlow'],
      write: { accepted: true, value: 0 },
    },
    {
      name: 'fire',
      controls: ['color', 'emberDensity'],
      absent: ['mistOpacity', 'emberGlow'],
      write: { accepted: false, value: 1 },
    },
    {
      name: 'halftone',
      controls: ['color'],
      absent: ['mistOpacity', 'emberDensity', 'emberGlow'],
      write: { accepted: true, value: 'rgb(0, 255, 0)' },
    },
    {
      name: 'slime',
      controls: ['color'],
      absent: ['mistOpacity', 'emberDensity', 'emberGlow'],
      write: { accepted: true, value: 'rgb(0, 255, 0)' },
    },
    {
      name: 'burned-paper',
      controls: ['emberGlow'],
      absent: ['color', 'mistOpacity', 'emberDensity'],
      write: { accepted: true, value: 0 },
    },
    {
      name: 'electricity',
      controls: ['color'],
      absent: ['mistOpacity', 'emberDensity', 'emberGlow'],
      write: null,
    },
  ]);
});

test('all decorative effects recolor output without recapture or alpha-shape changes', async ({
  page,
}) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const source = target.outerHTML;
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const rgba = async () => {
      const canvas = host.querySelector('canvas')!;
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const copy = document.createElement('canvas');
      copy.width = image.width;
      copy.height = image.height;
      copy.getContext('2d')!.drawImage(image, 0, 0);
      return {
        size: [copy.width, copy.height],
        bytes: [...copy.getContext('2d')!.getImageData(0, 0, copy.width, copy.height).data],
      };
    };
    const equal = (left: readonly number[], right: readonly number[]) =>
      left.length === right.length && left.every((value, index) => value === right[index]);
    const alphaEqual = (left: readonly number[], right: readonly number[]) =>
      left.every((value, index) => index % 4 !== 3 || value === right[index]);
    type ColorHandle = {
      readonly ready: Promise<void>;
      color: string | undefined;
      dispose(): void;
    };
    type Attach = (
      target: Element,
      options: {
        host: HTMLElement;
        clock: 'manual';
        motion: 'static';
        time: number;
        seed: number;
        intensity: number;
      },
    ) => ColorHandle;
    const effects: Array<[string, Attach]> = [
      ['electricity', window.controlEffects.electricity],
      ['fire', window.controlEffects.fire],
      ['frost', window.controlEffects.frost],
      ['kinetic', window.controlEffects.kinetic],
      ['slime', window.controlEffects.slime],
      ['dither', window.controlEffects.dither],
      ['halftone', window.controlEffects.halftone],
      ['stipple', window.controlEffects.stipple],
      ['scanlines', window.controlEffects.scanlines],
      ['crosshatch', window.controlEffects.crosshatch],
      ['diamonds', window.controlEffects.diamonds],
      ['contour-echoes', window.controlEffects['contour-echoes']],
      ['engraving', window.controlEffects.engraving],
      ['woven-mesh', window.controlEffects['woven-mesh']],
      ['hexagons', window.controlEffects.hexagons],
      ['interference', window.controlEffects.interference],
      ['shards', window.controlEffects.shards],
      ['circuits', window.controlEffects.circuits],
      ['star-shimmer', window.controlEffects['star-shimmer']],
      ['brush-fringe', window.controlEffects['brush-fringe']],
    ];
    const createTexture = GPUDevice.prototype.createTexture;
    const createPipeline = GPUDevice.prototype.createRenderPipeline;
    let textures = 0;
    let pipelines = 0;
    const samples: Array<Record<string, unknown>> = [];
    try {
      for (const [name, attach] of effects) {
        const effect = attach(target, {
          host,
          clock: 'manual',
          motion: 'static',
          time: 1.5,
          seed: 314,
          intensity: 0.8,
        });
        await effect.ready;
        const authored = await rgba();
        GPUDevice.prototype.createTexture = function (...args) {
          textures += 1;
          return createTexture.apply(this, args);
        };
        GPUDevice.prototype.createRenderPipeline = function (...args) {
          pipelines += 1;
          return createPipeline.apply(this, args);
        };
        effect.color = '#000000';
        await settle();
        const black = await rgba();
        effect.color = '#ffffff';
        await settle();
        const white = await rgba();
        effect.color = undefined;
        await settle();
        const reset = await rgba();
        GPUDevice.prototype.createTexture = createTexture;
        GPUDevice.prototype.createRenderPipeline = createPipeline;
        samples.push({
          name,
          defaultColor: effect.color,
          changedBlack: !equal(authored.bytes, black.bytes),
          changedWhite: !equal(authored.bytes, white.bytes),
          alpha: alphaEqual(authored.bytes, black.bytes) && alphaEqual(authored.bytes, white.bytes),
          reset: equal(authored.bytes, reset.bytes),
          size:
            equal(authored.size, black.size) &&
            equal(authored.size, white.size) &&
            equal(authored.size, reset.size),
        });
        effect.dispose();
      }
      const paper = window.controlEffects['burned-paper'](target, {
        host,
        clock: 'manual',
        motion: 'static',
        time: 1.5,
        seed: 314,
        intensity: 0.8,
      });
      await paper.ready;
      const paperFirst = await rgba();
      const paperApi = 'color' in paper;
      paper.dispose();
      const paperAgain = window.controlEffects['burned-paper'](target, {
        host,
        clock: 'manual',
        motion: 'static',
        time: 1.5,
        seed: 314,
        intensity: 0.8,
      });
      await paperAgain.ready;
      const paperSecond = await rgba();
      paperAgain.dispose();
      return {
        samples,
        paper: { api: paperApi, exact: equal(paperFirst.bytes, paperSecond.bytes) },
        source: target.outerHTML === source,
        resources: { textures, pipelines },
        canvases: host.querySelectorAll('canvas').length,
      };
    } finally {
      GPUDevice.prototype.createTexture = createTexture;
      GPUDevice.prototype.createRenderPipeline = createPipeline;
    }
  });
  expect(result.samples).toHaveLength(20);
  for (const sample of result.samples) {
    expect(sample).toMatchObject({
      defaultColor: undefined,
      changedBlack: true,
      changedWhite: true,
      alpha: true,
      reset: true,
      size: true,
    });
  }
  expect(result.paper).toEqual({ api: false, exact: true });
  expect(result.source).toBe(true);
  expect(result.resources).toEqual({ textures: 0, pipelines: 0 });
  expect(result.canvases).toBe(0);
});

test('Fire half density is deterministic and visibly distinct from full density', async ({
  page,
}) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const output = async () => {
      const canvas = host.querySelector('canvas')!;
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const copy = document.createElement('canvas');
      copy.width = image.width;
      copy.height = image.height;
      copy.getContext('2d')!.drawImage(image, 0, 0);
      return [...copy.getContext('2d')!.getImageData(0, 0, copy.width, copy.height).data];
    };
    const equal = (left: readonly number[], right: readonly number[]) =>
      left.length === right.length && left.every((value, index) => value === right[index]);
    const different = (left: readonly number[], right: readonly number[]) =>
      left.reduce((total, value, index) => total + Number(value !== right[index]), 0);
    const make = (kind: 'text' | 'svg' | 'image', width: number, height: number) => {
      const target = document.createElement(kind === 'image' ? 'img' : 'div');
      target.style.cssText = `display:block;width:${width}px;height:${height}px;background:transparent`;
      if (kind === 'text') {
        target.textContent = 'Fi';
        target.setAttribute('style', `${target.style.cssText};color:white;font:64px/1 sans-serif`);
      } else if (kind === 'svg') {
        target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path fill="white" fill-rule="evenodd" d="M8 8h${width - 16}v${height - 16}H8zM${Math.floor(width / 3)} ${Math.floor(height / 3)}h${Math.floor(width / 3)}v${Math.floor(height / 3)}H${Math.floor(width / 3)}z"/></svg>`;
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const pen = canvas.getContext('2d')!;
        pen.fillStyle = 'white';
        pen.fillRect(8, 8, width - 16, height - 16);
        pen.clearRect(
          Math.floor(width / 3),
          Math.floor(height / 3),
          Math.floor(width / 3),
          Math.floor(height / 3),
        );
        (target as HTMLImageElement).src = canvas.toDataURL();
      }
      host.replaceChildren(target);
      return target;
    };
    const samples: Array<{ kind: string; size: number; repeat: boolean; changed: number }> = [];
    for (const kind of ['text', 'svg', 'image'] as const) {
      for (const size of [96, 240]) {
        for (const [time, seed] of [
          [0.7, 314],
          [1.4, 271],
        ] as const) {
          const target = make(kind, size, Math.round((size * 2) / 3));
          const render = async (emberDensity: number) => {
            const effect = window.controlEffects.fire(target, {
              host,
              clock: 'manual',
              motion: 'static',
              time,
              seed,
              intensity: 1,
              emberDensity,
            });
            await effect.ready;
            await settle();
            const pixels = await output();
            effect.dispose();
            return pixels;
          };
          const half = await render(0.5);
          const full = await render(1);
          const halfRepeat = await render(0.5);
          samples.push({
            kind,
            size,
            repeat: equal(half, halfRepeat),
            changed: different(half, full),
          });
        }
      }
    }
    return { samples, canvases: host.querySelectorAll('canvas').length };
  });
  expect(result.samples).toHaveLength(12);
  expect(result.samples.every((sample) => sample.repeat)).toBe(true);
  for (const kind of ['text', 'svg', 'image']) {
    for (const size of [96, 240]) {
      expect(
        result.samples.some(
          (sample) => sample.kind === kind && sample.size === size && sample.changed > 0,
        ),
      ).toBe(true);
    }
  }
  expect(result.canvases).toBe(0);
});

test('writable controls coalesce through the existing frame scheduler', async ({ page }) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const effect = window.controlEffects.frost(target, { host, time: 2, intensity: 0.8 });
    await effect.ready;
    let requests = 0;
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      requests += 1;
      return request(callback);
    };
    effect.mistOpacity = 0.25;
    effect.mistOpacity = 0.5;
    effect.mistOpacity = 0.75;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    window.requestAnimationFrame = request;
    const value = effect.mistOpacity;
    effect.dispose();
    return { requests, value, canvases: host.querySelectorAll('canvas').length };
  });
  expect(result.value).toBe(0.75);
  expect(result.requests).toBeLessThanOrEqual(2);
  expect(result.canvases).toBe(0);
});

test('native GSAP drives public writable handles and restores their rendered state', async ({
  page,
}) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const source = document.querySelector<HTMLElement>('#target')!;
    const { gsap } = window.controlEffects;
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const pixelMass = async (canvas: HTMLCanvasElement) => {
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const copy = document.createElement('canvas');
      copy.width = image.width;
      copy.height = image.height;
      const context = copy.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
      let alpha = 0;
      let luminance = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        alpha += pixels[index + 3];
        luminance +=
          pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
      }
      return { alpha, luminance };
    };
    const makeTarget = () => {
      const host = document.createElement('div');
      host.style.cssText = 'position:relative;width:240px;height:160px';
      const target = source.cloneNode(true) as HTMLElement;
      target.removeAttribute('id');
      host.append(target);
      document.body.append(host);
      return { host, target };
    };
    const frostTarget = makeTarget();
    const slimeTarget = makeTarget();
    const paperTarget = makeTarget();
    const frost = window.controlEffects.frost(frostTarget.target, {
      host: frostTarget.host,
      clock: 'manual',
      time: 2,
      intensity: 0.8,
      seed: 314,
      coatingDepth: 0.05,
      mistReach: 0.1,
    });
    const slime = window.controlEffects.slime(slimeTarget.target, {
      host: slimeTarget.host,
      clock: 'manual',
      time: 2,
      intensity: 0.8,
      seed: 314,
      coatingDepth: 0.05,
      dripReach: 0.1,
    });
    const paper = window.controlEffects['burned-paper'](paperTarget.target, {
      host: paperTarget.host,
      clock: 'manual',
      time: 2,
      intensity: 0.8,
      seed: 314,
      scorchDepth: 0.05,
      ashReach: 0.1,
    });
    try {
      await Promise.all([frost.ready, slime.ready, paper.ready]);
      const initial = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      slime.color = '#77aa44';
      let textures = 0;
      let pipelines = 0;
      const createTexture = GPUDevice.prototype.createTexture;
      const createRenderPipeline = GPUDevice.prototype.createRenderPipeline;
      GPUDevice.prototype.createTexture = function (...args) {
        textures += 1;
        return createTexture.apply(this, args);
      };
      GPUDevice.prototype.createRenderPipeline = function (...args) {
        pipelines += 1;
        return createRenderPipeline.apply(this, args);
      };
      const timeline = gsap.timeline({ paused: true });
      timeline.to(frost, { mistOpacity: 0, duration: 1, ease: 'power1.inOut' }, 0);
      timeline.fromTo(
        slime,
        { color: '#000000' },
        { color: '#77aa44', duration: 1, ease: 'none' },
        1,
      );
      timeline.fromTo(paper, { emberGlow: 0 }, { emberGlow: 1, duration: 1, ease: 'none' }, 2);
      timeline.seek(0.5, true);
      const frostMidpoint = frost.mistOpacity;
      timeline.seek(1.5, true);
      const slimeMidpoint = slime.color;
      timeline.seek(2.5, true);
      const paperMidpoint = paper.emberGlow;
      timeline.reverse();
      timeline.pause();
      timeline.seek(2.25, true);
      const paperReverse = paper.emberGlow;
      timeline.seek(0.5, true);
      timeline.killTweensOf(frost, 'mistOpacity');
      timeline.seek(1, true);
      const frostKilled = frost.mistOpacity;
      timeline.kill();
      frost.mistOpacity = 0.8;
      slime.color = '#77aa44';
      paper.emberGlow = 0.6;
      await settle();
      const preContext = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      let scoped: ReturnType<typeof gsap.timeline> | undefined;
      const context = gsap.context(() => {
        scoped = gsap
          .timeline({ paused: true })
          .to(frost, { mistOpacity: 0.1, duration: 1, ease: 'none' }, 0)
          .fromTo(slime, { color: '#000000' }, { color: '#112233', duration: 1, ease: 'none' }, 0)
          .to(paper, { emberGlow: 0.1, duration: 1, ease: 'none' }, 0);
      });
      scoped!.seek(0.5, true);
      const scopedValues = [frost.mistOpacity, slime.color, paper.emberGlow];
      context.revert();
      await settle();
      const rendered = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      const restored = [frost.mistOpacity, slime.color, paper.emberGlow];
      frost.mistOpacity = 1;
      slime.color = undefined;
      paper.emberGlow = 1;
      await settle();
      const defaultRestored = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      GPUDevice.prototype.createTexture = createTexture;
      GPUDevice.prototype.createRenderPipeline = createRenderPipeline;
      return {
        defaults: [frost.mistOpacity, slime.color, paper.emberGlow],
        frostMidpoint,
        slimeMidpoint,
        paperMidpoint,
        paperReverse,
        frostKilled,
        scopedValues,
        restored,
        initial,
        preContext,
        rendered,
        defaultRestored,
        resources: { textures, pipelines },
      };
    } finally {
      frost.dispose();
      slime.dispose();
      paper.dispose();
      frostTarget.host.remove();
      slimeTarget.host.remove();
      paperTarget.host.remove();
    }
  });
  expect(result.frostMidpoint).toBeCloseTo(0.5, 6);
  expect(result.slimeMidpoint).toMatch(/^rgb\(/);
  expect(result.paperMidpoint).toBeCloseTo(0.5, 6);
  expect(result.paperReverse).toBeCloseTo(0.25, 6);
  expect(result.frostKilled).toBeCloseTo(0.5, 6);
  expect(result.scopedValues).toEqual([0.45, expect.stringMatching(/^rgb\(/), 0.35]);
  expect(result.restored).toEqual([0.8, expect.stringMatching(/^rgb\(/), 0.6]);
  expect(result.defaults).toEqual([1, undefined, 1]);
  expect(result.resources).toEqual({ textures: 0, pipelines: 0 });
  expect(result.rendered).toEqual(result.preContext);
  for (const [before, after] of result.initial.map(
    (value, index) => [value, result.rendered[index]] as const,
  )) {
    expect(before.alpha).toBeGreaterThan(0);
    expect(after.alpha).toBeGreaterThan(0);
    expect(before.luminance).not.toBe(after.luminance);
  }
  expect(result.defaultRestored).toEqual(result.initial);
});
