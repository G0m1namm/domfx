import { useCallback, useEffect, useRef, type ReactNode } from 'react';

import { attachFire } from '@domfx/browser';

import './fire-button.css';
import { useDomfxEffect } from './use-domfx-effect';

interface FireButtonProps {
  children: ReactNode;
  onClick?: () => void;
  /** Creation-only: a change replaces the effect. */
  flameReach?: number;
  /** Writable: applied to the live effect. */
  intensity?: number;
  color?: string;
  /** Styles the host, which the effect does not observe. */
  tone?: 'calm' | 'alert';
}

export function FireButton({
  children,
  onClick,
  flameReach,
  intensity = 0.8,
  color,
  tone = 'calm',
}: FireButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLButtonElement>(null);

  const create = useCallback(
    (target: HTMLElement, host: HTMLElement) =>
      attachFire(target, { host, clock: 'auto', motion: 'respect', flameReach, seed: 314 }),
    [flameReach],
  );
  // Writable controls update the live effect without recapturing the target.
  const fire = useDomfxEffect(hostRef, targetRef, create, { intensity, color });

  // Target changes refresh automatically; a host style change needs refresh().
  const capturedTone = useRef(tone);
  useEffect(() => {
    if (!fire || capturedTone.current === tone) {
      return;
    }
    capturedTone.current = tone;
    // Rejects after disposal or when the capture fails; fire.reason has the cause.
    fire.refresh().catch(() => {});
  }, [fire, tone]);

  return (
    <div ref={hostRef} className="fire-host" data-tone={tone}>
      <button ref={targetRef} className="fire-target" type="button" onClick={onClick}>
        {children}
      </button>
    </div>
  );
}
