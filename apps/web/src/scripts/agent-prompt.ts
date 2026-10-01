// Public documentation is pinned. Flame height is still an unpublished local API change.
const sourceRevision = 'c2b12318f410375ddf995eeda944670d823319f2';
const source = `https://github.com/G0m1namm/domfx/tree/${sourceRevision}`;

export function createAgentPrompt(settings: {
  target: string;
  effect: 'none' | 'fire';
  intensity: number;
  flameHeight: number;
  time: number;
  speed: number;
  loop: boolean;
  end: number;
  paused: boolean;
}) {
  if (settings.effect === 'none') {
    return `Keep ${settings.target} as real, undecorated HTML in this project. Remove only its domfx effect, dispose its attachment and remove its owned listeners/animation work. Preserve other effects and native selection, links, focus, styles and layout. Do not install packages. Follow the project's component lifecycle and run its relevant checks.`;
  }
  const manual = settings.loop || settings.speed !== 1;
  const clockInstructions = manual
    ? `Use clock: 'manual' with exactly one caller-owned animation loop. Advance fire.time by elapsed seconds × ${settings.speed.toFixed(1)} while playing. ${settings.loop ? `Start at ${settings.time.toFixed(2)} seconds and wrap into [${settings.time.toFixed(2)}, ${settings.end.toFixed(2)}) at the end; this is a repeated time range, not a guarantee of a seamless visual loop.` : 'Continue without an end time.'} Pause retains time; Resume continues it. Stop the loop while paused, reduced motion is active or the page is hidden, reset its elapsed-time baseline on resume, and cancel it on teardown. Do not call ambient play/pause on a manual attachment.`
    : `Use its ambient clock; do not add another animation loop. ${settings.paused ? 'Call fire.pause() immediately after attachment creation.' : 'Animate continuously.'}`;
  return `Add domfx Fire to ${settings.target} in this project.

Settings: intensity ${settings.intensity.toFixed(2)}, flameHeight ${settings.flameHeight} CSS pixels, seed 314, initial time ${settings.time.toFixed(2)} seconds, playback ${settings.paused ? 'paused' : 'animate'}, speed ${settings.speed.toFixed(1)}×, ${settings.loop ? `repeat range ${settings.time.toFixed(2)}–${settings.end.toFixed(2)} seconds` : 'continuous motion'}. Respect system reduced motion.

Inspect this project's framework, package manager, component lifecycle and layout first. Keep the element as real HTML with native text selection, links and keyboard focus.

Installation source and limits:
${source}
https://github.com/G0m1namm/domfx/blob/${sourceRevision}/QUICKSTART.md
The library is experimental and unpublished. This pinned public revision documents the local tarball workflow but DOES NOT support flameHeight yet. The homepage uses a newer unpublished local change. Ask for matching core/browser tarballs or a matching source checkout supporting flameHeight. Do not silently substitute the pinned revision, omit the requested setting, invent an API, or claim an npm installation works. If matching artifacts/source are unavailable, stop and report this blocker before editing the integration.

With compatible source: record its exact revision and changes, install locked dependencies using its documented Node/pnpm versions, run pnpm build, then pack packages/core and packages/domfx with pnpm --config.ignore-scripts=true pack --pack-destination <absolute-artifacts-directory>. Read the actual package manifests and emitted filenames. With compatible tarballs: record filenames and hashes. Install @domfx/core and @domfx/browser from those local tarballs. Merge the required @domfx/core file override into existing package-manager configuration; preserve unrelated settings. Check the packed public declarations support all requested settings. No private source imports, consumer TypeGPU plugin, or GSAP dependency is needed.

Integrate only after browser mount. Await document.fonts.ready and relevant image.decode() calls. Choose a connected, positioned HTML host that contains the target as a strict descendant; leave room for output and preserve original styles/layout. Avoid unsupported rotation, skew, perspective, filters, opacity or clipping on the target/intermediate ancestors.

Use public attachFire(target, { host, clock: '${manual ? 'manual' : 'ambient'}', motion: 'respect', intensity: ${settings.intensity.toFixed(2)}, flameHeight: ${settings.flameHeight}, seed: 314, time: ${settings.time.toFixed(2)} }). ${clockInstructions} Keep intensity constant unless I explicitly request viewport-driven intensity.

Own cleanup immediately: call fire.dispose() on component unmount/page teardown, including initialization that finishes after unmount. Guard asynchronous font/image/import work against teardown before creating an attachment. Await fire.ready and inspect fire.lifecycle before claiming rendering success. Preserve original content on capture/WebGPU failure. Respect reduced motion; after reduction ends, restart only through explicit user action using the supported retry/reattachment path.

Run the project's build/type checks. Verify native selection and activation, reduced-motion and unavailable fallbacks, teardown/remount, and requested playback. Verify actual output in a WebGPU-capable browser when available; otherwise explicitly report rendering unverified. Summarize changed files, artifact/source identity, checks and unsupported settings.`;
}
