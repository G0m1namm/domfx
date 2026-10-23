import type { Locale } from '@domfx/site/locale';

export function examplesForLocale(locale: Locale) {
  const isEs = locale === 'es';
  const elements = `const host = document.querySelector('#host');
const target = document.querySelector('#target');
const clicks = document.querySelector('#clicks');
if (!(host instanceof HTMLElement) || !target || !clicks) {
  throw new Error('${isEs ? 'Falta el contenedor, el objetivo o el contador' : 'Missing host, target or click counter'}');
}

let count = 0;
const onClick = () => { clicks.textContent = String(++count); };
target.addEventListener('click', onClick);`;
  const standaloneCode = `import { attachFire } from '@domfx/browser';

${elements}

let disposed = false;
let fire: ReturnType<typeof attachFire> | undefined;

function cleanup() {
  disposed = true;
  window.removeEventListener('pagehide', cleanup);
  target?.removeEventListener('click', onClick);
  fire?.dispose();
}

// ${isEs ? 'Registra también cleanup al desmontar el componente, antes de llamar a setup.' : 'Also register cleanup on component unmount, before calling setup.'}
window.addEventListener('pagehide', cleanup, { once: true });

const setup = async () => {
  await document.fonts.ready;
  if (disposed) { return; }

  fire = attachFire(target, {
    host, clock: 'auto', motion: 'respect',
    intensity: 0.8, flameHeight: 32, seed: 314,
  });
  await fire.ready;
  if (!disposed && fire.lifecycle !== 'active') {
    console.info(fire.reason);
  }
};

void setup();`;
  const gsapCode = `import { gsap } from 'gsap';
import { attachFire } from '@domfx/browser';

${elements}

let disposed = false;
let fire: ReturnType<typeof attachFire> | undefined;
const timeline = gsap.timeline({ paused: true });
let unsubscribe: (() => void) | undefined;

function cleanup() {
  disposed = true;
  window.removeEventListener('pagehide', cleanup);
  target?.removeEventListener('click', onClick);
  unsubscribe?.();
  timeline.revert();
  fire?.dispose();
}

// ${isEs ? 'Registra también cleanup al desmontar el componente, antes de llamar a setup.' : 'Also register cleanup on component unmount, before calling setup.'}
window.addEventListener('pagehide', cleanup, { once: true });

const setup = async () => {
  await document.fonts.ready;
  if (disposed) { return; }

  fire = attachFire(target, {
    host, clock: 'manual', motion: 'respect',
    time: 0, intensity: 0.8, flameHeight: 32, seed: 314,
  });
  unsubscribe = fire.onDispose(() => timeline.revert());
  // ${isEs ? 'El objetivo y el efecto comparten la opacidad del contenedor.' : 'The target and effect share the container opacity.'}
  timeline.from(host, { opacity: 0, duration: 0.5, immediateRender: false });
  timeline.addLabel('ignite', 0.5);
  timeline.to(fire, {
    time: 4, intensity: 0.4, duration: 4, ease: 'none',
  }, 'ignite');

  await fire.ready;
  if (disposed) { return; }
  if (fire.lifecycle !== 'active') {
    console.info(fire.reason);
    return;
  }

  timeline.play();
};

void setup();`;
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
