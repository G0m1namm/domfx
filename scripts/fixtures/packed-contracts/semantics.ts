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
  type BurnedPaperEffectHandle,
  type FireEffectHandle,
  type FrostEffectHandle,
  type HalftoneEffectHandle,
  type SlimeEffectHandle,
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

const frostControls: FrostEffectHandle = attachFrost(target, { host, mistOpacity: 0.25 });
frostControls.mistOpacity = 2;
const fireControls: FireEffectHandle = attachFire(target, { host, emberDensity: 0.25 });
const halftoneControls: HalftoneEffectHandle = attachHalftone(target, { host, dotSpacing: 6 });
const slimeControls: SlimeEffectHandle = attachSlime(target, { host, gloss: 0.25 });
slimeControls.gloss = 2;
const burnedControls: BurnedPaperEffectHandle = attachBurnedPaper(target, {
  host,
  emberGlow: 0.25,
});
burnedControls.emberGlow = -1;
// @ts-expect-error Ember density is creation-only.
fireControls.emberDensity = 0.5;
// @ts-expect-error Dot spacing is creation-only.
halftoneControls.dotSpacing = 6;
// @ts-expect-error Frost-only mist opacity is not a Fire option.
attachFire(target, { host, mistOpacity: 0.5 });
// @ts-expect-error Ember density is a number, not percentage text.
attachFire(target, { host, emberDensity: '50%' });
// @ts-expect-error Dot spacing belongs to Halftone.
attachStipple(target, { host, dotSpacing: 6 });
// @ts-expect-error Halftone spacing is a numeric local CSS-pixel value.
attachHalftone(target, { host, dotSpacing: '6px' });
// @ts-expect-error Slime gloss is a numeric mix, not a CSS string.
attachSlime(target, { host, gloss: '50%' });
// @ts-expect-error Ember glow belongs to Burned paper.
attachFrost(target, { host, emberGlow: 0.5 });
frostControls.dispose();
fireControls.dispose();
halftoneControls.dispose();
slimeControls.dispose();
burnedControls.dispose();

const relativeElectricity = attachElectricity(target, { host, contourSpread: 0.1 });
const relativeKinetic = attachKinetic(target, { host, fragmentTravel: 0.2 });
// @ts-expect-error Contour spread is creation-only.
relativeElectricity.contourSpread = 0.2;
// @ts-expect-error Fragment travel is creation-only.
relativeKinetic.fragmentTravel = 0.3;
// @ts-expect-error Only Electricity accepts contour spread.
attachKinetic(target, { host, contourSpread: 0.1 });
// @ts-expect-error Only Kinetic bloom accepts fragment travel.
attachElectricity(target, { host, fragmentTravel: 0.1 });
// @ts-expect-error Ratios use finite numbers, not CSS strings.
attachElectricity(target, { host, contourSpread: '10%' });
// @ts-expect-error Ratios use finite numbers, not CSS strings.
attachKinetic(target, { host, fragmentTravel: '10%' });

const relativeFire = attachFire(target, { host, flameReach: 0.1 });
const relativeFrost = attachFrost(target, { host, coatingDepth: 0.1, mistReach: 0.2 });
attachFrost(target, { host, mistReach: 0 }).dispose();
// @ts-expect-error Material geometry is creation-only.
relativeFrost.coatingDepth = 0.2;
// @ts-expect-error Mist reach is a numeric height fraction.
attachFrost(target, { host, mistReach: '20%' });
// @ts-expect-error Drip reach belongs to Slime.
attachFrost(target, { host, dripReach: 0.2 });
relativeFrost.dispose();
const relativeSlime = attachSlime(target, { host, coatingDepth: 0.05, dripReach: 0.2 });
attachSlime(target, { host, dripDensity: 0.9 }).dispose();
// @ts-expect-error Drip density is a numeric fraction, not percentage text.
attachSlime(target, { host, dripDensity: '90%' });
// @ts-expect-error Only Slime supports drip density.
attachFrost(target, { host, dripDensity: 0.9 });
// @ts-expect-error Drip density is creation-only, not a writable instance control.
relativeSlime.dripDensity = 0.9;
attachSlime(target, { host, dripReach: 0 }).dispose();
// @ts-expect-error Relative drip travel belongs only to Slime.
attachBurnedPaper(target, { host, dripReach: 0.2 });
// @ts-expect-error Relative mist travel belongs only to Frost.
attachSlime(target, { host, mistReach: 0.2 });
// @ts-expect-error Material geometry is creation-only.
relativeSlime.dripReach = 0.3;
relativeSlime.dispose();
const relativePaper = attachBurnedPaper(target, { host, scorchDepth: 0.15, ashReach: 0.15 });
attachBurnedPaper(target, { host, ashReach: 0 }).dispose();
// @ts-expect-error Scorch depth is a numeric shorter-side fraction.
attachBurnedPaper(target, { host, scorchDepth: '15%' });
// @ts-expect-error Coating depth belongs to Frost and Slime.
attachBurnedPaper(target, { host, coatingDepth: 0.1 });
// @ts-expect-error Ash reach belongs only to Burned paper.
attachFrost(target, { host, ashReach: 0.2 });
// @ts-expect-error Material geometry is creation-only.
relativePaper.ashReach = 0.3;
relativePaper.dispose();
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

// Relative pattern extents are creation-only and effect-owned.
for (const attach of [
  attachDither,
  attachHalftone,
  attachStipple,
  attachScanlines,
  attachCrosshatch,
  attachDiamonds,
  attachEngraving,
  attachWovenMesh,
  attachHexagons,
  attachInterference,
  attachShards,
  attachCircuits,
  attachStarShimmer,
]) {
  const relative = attach(target, { host, plumeReach: 0.1, bandDepth: 0.05 });
  relative.dispose();
  // @ts-expect-error Pattern geometry has no writable extent control.
  relative.plumeReach = 0.2;
  // @ts-expect-error Radial echoes use their own options family.
  attach(target, { host, echoReach: 0.1 });
}
attachContourEchoes(target, { host, echoReach: 0.15 }).dispose();
attachBrushFringe(target, { host, fringeReach: 0.1 }).dispose();
// @ts-expect-error Contour echoes have radial reach instead of a rising plume.
attachContourEchoes(target, { host, plumeReach: 0.1 });
// @ts-expect-error Brush fringe does not expose an inward band.
attachBrushFringe(target, { host, bandDepth: 0.1 });
// @ts-expect-error Extent fractions are numeric rather than CSS strings.
attachDither(target, { host, plumeReach: '10%' });
const radialPattern = { host, echoReach: 0.1 };
// @ts-expect-error A radial options variable cannot configure a shared-flow pattern.
attachHalftone(target, radialPattern);
const flowingPattern = { host, plumeReach: 0.1 };
// @ts-expect-error A flowing options variable cannot configure a radial pattern.
attachContourEchoes(target, flowingPattern);
