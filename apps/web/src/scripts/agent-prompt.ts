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

Setup: read /docs/installation and /docs/standalone on the domfx site. Install @domfx/browser with this project's package manager and use its public exports. Keep the selected flameHeight and other settings. No GSAP or consumer TypeGPU plugin is needed.

After browser mount, await fonts and relevant image decoding. Guard async work against unmount. Choose a connected, positioned host containing the target; preserve styles/layout and leave output space. Avoid unsupported rotation, skew, perspective, filters, target opacity and ancestor clipping.

Use public attachFire(target, { host, clock: '${manual ? 'manual' : 'ambient'}', motion: 'respect', intensity: ${settings.intensity.toFixed(2)}, flameHeight: ${settings.flameHeight}, seed: 314, time: ${settings.time.toFixed(2)} }). ${clockInstructions} Keep intensity constant unless I explicitly request viewport-driven intensity.

Own cleanup immediately: call fire.dispose() on component unmount/page teardown, including initialization that finishes after unmount. Guard asynchronous font/image/import work against teardown before creating an attachment. Await fire.ready and inspect fire.lifecycle before claiming rendering success. Preserve original content on capture/WebGPU failure. Respect reduced motion; after reduction ends, restart only through explicit user action using the supported retry/reattachment path.

Run build/type checks; verify selection, native activation, playback, reduced-motion/unavailable fallbacks and teardown/remount. Check real output in a WebGPU browser; report rendering unverified if unavailable. Summarize edits and checks.`;
}
