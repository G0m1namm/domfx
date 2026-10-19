export const gsapCode = `import { gsap } from 'gsap';
import { attachFire } from '@domfx/browser';
import { bindFire } from '@domfx/gsap';

await document.fonts.ready;
const fire = attachFire(target, {
  host, clock: 'manual', motion: 'respect',
  time: 0, intensity: 0.8,
  flameHeight: 32, seed: 314,
});
const timeline = gsap.timeline({ paused: true });
// Fade the host so the target and its effect share opacity.
timeline.from(host, {
  opacity: 0, duration: 0.5, immediateRender: false,
});
timeline.addLabel('ignite', 0.5);
const binding = bindFire(fire, timeline, {
  time: 4, intensity: 0.4,
  duration: 4, position: 'ignite',
});

// Register teardown before ready settles.
const cleanup = () => {
  binding.dispose();
  timeline.kill();
  fire.dispose();
};
window.addEventListener('pagehide', cleanup, { once: true });
// Also call cleanup on component unmount.
await fire.ready;
if (fire.lifecycle === 'active') timeline.play();`;
export const standaloneCode = `import { attachFire } from '@domfx/browser';

await document.fonts.ready;
const fire = attachFire(target, {
  host, clock: 'ambient', motion: 'respect',
  intensity: 0.8, flameHeight: 32, seed: 314,
});
window.addEventListener('pagehide',
  () => fire.dispose(), { once: true });
// Also dispose on component unmount.
await fire.ready;`;
export const codeTheme = {
  name: 'domfx',
  type: 'dark' as const,
  colors: { 'editor.background': '#101117', 'editor.foreground': '#F4F5FB' },
  tokenColors: [
    { scope: ['comment'], settings: { foreground: '#AEB1C1' } },
    { scope: ['keyword', 'storage', 'entity.name.function'], settings: { foreground: '#D7DAEE' } },
    { scope: ['string'], settings: { foreground: '#E6DC6A' } },
    { scope: ['constant.numeric'], settings: { foreground: '#9ED9AD' } },
  ],
};
