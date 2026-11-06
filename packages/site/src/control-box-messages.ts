import type { Locale } from './locale.ts';

/** Strings the box needs on both sites. API names stay literal and are not listed here. */
export interface ControlBoxMessages {
  readonly tabs: {
    readonly shape: string;
    readonly color: string;
    readonly time: string;
    readonly code: string;
  };
  readonly settings: string;
  readonly target: string;
  readonly targets: { readonly text: string; readonly svg: string; readonly image: string };
  readonly automatic: string;
  readonly external: string;
  readonly respect: string;
  readonly static: string;
  readonly staticNote: string;
  readonly seconds: string;
  readonly shuffle: string;
  readonly resetAll: string;
  readonly copyLink: string;
  readonly copyCode: string;
  readonly codeCopied: string;
  readonly linkCopied: string;
  readonly copyManually: string;
  readonly linkInAddressBar: string;
  readonly code: string;
  readonly colorMode: string;
  readonly authored: string;
  readonly single: string;
  readonly rootAndTip: string;
  readonly unset: string;
  readonly unsetLabel: (name: string) => string;
  readonly start: string;
  readonly pause: string;
  readonly resume: string;
  readonly effectsUnavailable: string;
  readonly reducedMotion: string;
}

const messages: Record<Locale, ControlBoxMessages> = {
  en: {
    tabs: { shape: 'Shape', color: 'Color', time: 'Time', code: 'Code' },
    settings: 'Preview settings',
    target: 'Target element',
    targets: { text: 'Text', svg: 'SVG', image: 'Image' },
    automatic: 'Automatic animation',
    external: 'External control',
    respect: 'Respect',
    static: 'Static',
    staticNote: 'Static shows one frame, so time does not apply.',
    seconds: 'seconds',
    shuffle: 'Shuffle',
    resetAll: 'Reset all',
    copyLink: 'Copy link',
    copyCode: 'Copy code',
    codeCopied: 'Code copied',
    linkCopied: 'Link copied',
    copyManually: 'Press ⌘/Ctrl+C',
    linkInAddressBar: 'Copy the link from the address bar',
    code: 'Attachment code',
    colorMode: 'Color mode',
    authored: 'Authored',
    single: 'Single',
    rootAndTip: 'Root and tip',
    unset: 'Unset',
    unsetLabel: (name) => `Unset ${name}`,
    start: 'Start effect',
    pause: 'Pause effect',
    resume: 'Resume effect',
    effectsUnavailable: 'Effects unavailable',
    reducedMotion: 'Reduced motion',
  },
  es: {
    tabs: { shape: 'Forma', color: 'Color', time: 'Tiempo', code: 'Código' },
    settings: 'Ajustes de la vista previa',
    target: 'Elemento objetivo',
    targets: { text: 'Texto', svg: 'SVG', image: 'Imagen' },
    automatic: 'Animación automática',
    external: 'Control externo',
    respect: 'Respetar',
    static: 'Estática',
    staticNote: 'Estática muestra un solo fotograma, así que time no se aplica.',
    seconds: 'segundos',
    shuffle: 'Aleatorio',
    resetAll: 'Restablecer todo',
    copyLink: 'Copiar enlace',
    copyCode: 'Copiar código',
    codeCopied: 'Código copiado',
    linkCopied: 'Enlace copiado',
    copyManually: 'Pulsa ⌘/Ctrl+C',
    linkInAddressBar: 'Copia el enlace de la barra de direcciones',
    code: 'Código de la vista previa',
    colorMode: 'Modo de color',
    authored: 'Original',
    single: 'Un color',
    rootAndTip: 'Base y puntas',
    unset: 'Quitar',
    unsetLabel: (name) => `Quitar ${name}`,
    start: 'Iniciar efecto',
    pause: 'Pausar efecto',
    resume: 'Reanudar efecto',
    effectsUnavailable: 'Efectos no disponibles',
    reducedMotion: 'Movimiento reducido',
  },
};

export function controlBoxMessages(locale: Locale): ControlBoxMessages {
  return messages[locale];
}
