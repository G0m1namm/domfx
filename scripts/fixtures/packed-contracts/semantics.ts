import { gsap } from 'gsap';

import {
  attachFire,
  attachElectricity,
  attachFrost,
  attachKinetic,
  attachSlime,
  attachBurnedPaper,
  attachDither,
  attachHalftone,
  attachStipple,
  attachScanlines,
  attachCrosshatch,
  attachDiamonds,
  attachContourEchoes,
  attachEngraving,
  attachWovenMesh,
  attachHexagons,
  attachInterference,
  attachShards,
  attachCircuits,
  attachStarShimmer,
  attachBrushFringe,
  type AttachmentOptions,
} from '@domfx/browser';
import {
  bindEffect,
  bindEffectAsync,
  bindFire,
  bindFireAsync,
  type EffectBindingOptions,
  type EffectBinding,
  type AsyncEffectBinding,
} from '@domfx/gsap';

// Compile only: these examples are never executed or exported by a package.
declare const target: Element;
declare const host: HTMLElement;
declare const svgHost: SVGSVGElement;

const relativeFire = attachFire(target, { host, flameReach: 0.1 });
// @ts-expect-error Geometry is fixed when the instance is created.
relativeFire.flameReach = 0.2;
// @ts-expect-error Legacy artistic scale and relative reach are mutually exclusive.
attachFire(target, { host, flameReach: 0.1, flameHeight: 24 });
// @ts-expect-error Reach is a numeric target-height fraction.
attachFire(target, { host, flameReach: '10%' });
// @ts-expect-error Relative Fire reach is not an Electricity option.
attachElectricity(target, { host, flameReach: 0.1 });

const effect = attachFire(target, {
  host,
  clock: 'manual',
  seed: 314,
  time: 1.5,
  intensity: 0.8,
  flameHeight: 48,
});
const automatic = attachFrost(target, { host, clock: 'auto' });
automatic.pause();
automatic.resume();
automatic.dispose();
const ambient = attachFire(target, { host, clock: 'ambient' });
effect.time = -1;
effect.intensity = 0.5;
ambient.pause();
ambient.resume();
const unsubscribe = effect.onDispose(() => ambient.dispose());
unsubscribe();

const timeline = gsap.timeline({ paused: true });
const options = { time: 5.5, intensity: 0.25, duration: 4 };
const borrowed = bindFire(effect, timeline, options);
const owned = bindFire(effect, timeline, { ...options, disposeEffect: true, position: 0 });
const pending = bindFireAsync(Promise.resolve(effect), timeline, {
  ...options,
  disposeEffect: true,
});
const genericOptions: EffectBindingOptions = options;
const generic: EffectBinding = bindEffect(effect, timeline, genericOptions);
const genericPending: AsyncEffectBinding = bindEffectAsync(Promise.resolve(effect), timeline, {
  ...options,
  disposeEffect: true,
});
generic.dispose();
genericPending.dispose();
timeline.to(effect, { time: 4, intensity: 0.4, duration: 4, ease: 'none' });
const refreshed = effect.refresh();

// Exact equality also catches widened promise payloads and permissive escape types.
type Equal<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type PromiseContracts = [
  Expect<Equal<typeof effect.ready, Promise<void>>>,
  Expect<Equal<typeof refreshed, Promise<void>>>,
  Expect<Equal<typeof pending.ready, Promise<void>>>,
];

// @ts-expect-error The attachment seed is read-only after creation.
effect.seed = 42;
// @ts-expect-error Flame height is a numeric attachment option in CSS pixels.
attachFire(target, { host, flameHeight: 'large' });
// @ts-expect-error Clock options accept manual, auto or the legacy ambient spelling.
attachFire(target, { host, clock: 'automatic' });
// @ts-expect-error An SVG element cannot serve as the required HTML effect host.
attachFire(target, { host: svgHost });
// @ts-expect-error Async binding requires explicit attachment ownership.
bindFireAsync(Promise.resolve(effect), timeline, options);
// @ts-expect-error Async binding cannot borrow a pending attachment.
bindFireAsync(Promise.resolve(effect), timeline, { ...options, disposeEffect: false });

borrowed.dispose();
owned.dispose();
pending.dispose();
timeline.kill();
effect.dispose();
ambient.dispose();

const shared: AttachmentOptions = { host, seed: 314, intensity: 0.7, clock: 'manual' };
attachElectricity(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachElectricity(target, { host, flameHeight: 48 });
attachFrost(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachFrost(target, { host, flameHeight: 48 });
attachKinetic(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachKinetic(target, { host, flameHeight: 48 });
attachSlime(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachSlime(target, { host, flameHeight: 48 });
attachBurnedPaper(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachBurnedPaper(target, { host, flameHeight: 48 });
attachDither(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachDither(target, { host, flameHeight: 48 });
attachHalftone(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachHalftone(target, { host, flameHeight: 48 });
attachStipple(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachStipple(target, { host, flameHeight: 48 });
attachScanlines(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachScanlines(target, { host, flameHeight: 48 });
attachCrosshatch(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachCrosshatch(target, { host, flameHeight: 48 });
attachDiamonds(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachDiamonds(target, { host, flameHeight: 48 });
attachContourEchoes(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachContourEchoes(target, { host, flameHeight: 48 });
attachEngraving(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachEngraving(target, { host, flameHeight: 48 });
attachWovenMesh(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachWovenMesh(target, { host, flameHeight: 48 });
attachHexagons(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachHexagons(target, { host, flameHeight: 48 });
attachInterference(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachInterference(target, { host, flameHeight: 48 });
attachShards(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachShards(target, { host, flameHeight: 48 });
attachCircuits(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachCircuits(target, { host, flameHeight: 48 });
attachStarShimmer(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachStarShimmer(target, { host, flameHeight: 48 });
attachBrushFringe(target, shared).dispose();
// @ts-expect-error Only Fire accepts a flame-height option.
attachBrushFringe(target, { host, flameHeight: 48 });
