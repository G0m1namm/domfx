import type { Locale } from '@domfx/site/locale';

export function examplesForLocale(locale: Locale) {
  const isEs = locale === 'es';
  const gsapCode = `import { gsap } from 'gsap';
import { attachFire } from '@domfx/browser';

await document.fonts.ready;
const fire = attachFire(target, {
  host, clock: 'manual', motion: 'respect',
  time: 0, intensity: 0.8,
  flameHeight: 32, seed: 314,
});
const timeline = gsap.timeline({ paused: true });
// ${isEs ? 'Anima la opacidad del contenedor para que el objetivo y el efecto la compartan.' : 'Fade the host so the target and its effect share opacity.'}
timeline.from(host, {
  opacity: 0, duration: 0.5, immediateRender: false,
});
timeline.addLabel('ignite', 0.5);
timeline.to(fire, {
  time: 4, intensity: 0.4,
  duration: 4, ease: 'none',
}, 'ignite');
const unsubscribe = fire.onDispose(() => timeline.kill());

// ${isEs ? 'Registra la limpieza antes de que se resuelva ready.' : 'Register teardown before ready settles.'}
const cleanup = () => {
  unsubscribe();
  timeline.kill();
  fire.dispose();
};
window.addEventListener('pagehide', cleanup, { once: true });
// ${isEs ? 'Llama también a cleanup al desmontar el componente.' : 'Also call cleanup on component unmount.'}
await fire.ready;
if (fire.lifecycle === 'active') timeline.play();`;
  const standaloneCode = `import { attachFire } from '@domfx/browser';

await document.fonts.ready;
const fire = attachFire(target, {
  host, clock: 'auto', motion: 'respect',
  intensity: 0.8, flameHeight: 32, seed: 314,
});
window.addEventListener('pagehide',
  () => fire.dispose(), { once: true });
// ${isEs ? 'Libera también el efecto al desmontar el componente.' : 'Also dispose on component unmount.'}
await fire.ready;`;
  return { gsapCode, standaloneCode };
}

export const { gsapCode, standaloneCode } = examplesForLocale('en');

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
