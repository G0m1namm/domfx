'use client';

import { useRef, type ReactNode } from 'react';

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
  const host = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const { lifecycle } = useDomfxEffect({
    host,
    target,
    attach: attachFire,
    options: { clock: 'auto', flameReach },
    controls: { intensity, color },
    refreshOn: [tone],
  });

  return (
    <div ref={host} className="fire-host" data-tone={tone} data-effect={lifecycle}>
      <button ref={target} className="fire-target" type="button" onClick={onClick}>
        {children}
      </button>
    </div>
  );
}
