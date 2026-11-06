/** One motion rule from motion.css. A zero duration means reduced motion: apply immediately. */
export interface MotionTiming {
  readonly duration: number;
  readonly easing: string;
}

export interface MotionTokens {
  readonly enter: MotionTiming;
  readonly exit: MotionTiming;
  readonly swapOut: number;
  readonly swapIn: number;
}

/** Script animations read the tokens at use, so they follow reduced-motion changes. */
export function readMotionTokens(element: Element): MotionTokens {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const token = (name: string) => style?.getPropertyValue(name).trim() ?? '';
  const duration = (name: string) => Number.parseFloat(token(name)) || 0;
  return {
    enter: {
      duration: duration('--motion-enter-duration'),
      easing: token('--motion-enter-easing') || 'ease-out',
    },
    exit: {
      duration: duration('--motion-exit-duration'),
      easing: token('--motion-exit-easing') || 'ease-in',
    },
    swapOut: duration('--motion-swap-out-duration'),
    swapIn: duration('--motion-swap-in-duration'),
  };
}
