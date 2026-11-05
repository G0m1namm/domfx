import {
  createControlBox,
  type ControlBoxSnapshot,
  type ControlBoxStatus,
} from '@domfx/site/control-box';
import { controlBoxMessages } from '@domfx/site/control-box-messages';
import { parseEffectSettings } from '@domfx/site/effect-settings';
import { findEffect, type Effect } from '@domfx/site/effects';
import { localeFromPath } from '@domfx/site/locale';
import { initializePage } from '@domfx/site/page-lifetime';
import { initializePreviewZoom } from '@domfx/site/preview-zoom';

import { docsMessages } from '../content/docs-messages';

const restored = new WeakMap<HTMLElement, ControlBoxSnapshot>();

function initializeLabs() {
  const cleanups: (() => void)[] = [];
  for (const lab of document.querySelectorAll<HTMLElement>('[data-docs-lab]')) {
    const effect = findEffect(lab.dataset.effect);
    if (!effect) {
      throw new Error(`Unknown docs lab effect: ${lab.dataset.effect}`);
    }
    cleanups.push(initializeLab(lab, effect));
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

function initializeLab(lab: HTMLElement, effect: Effect) {
  const locale = localeFromPath(location.pathname);
  const messages = docsMessages(locale).lab;
  const stage = required<HTMLElement>('[data-docs-preview]', lab);
  const host = required<HTMLElement>('[data-docs-lab-host]', lab);
  const targets = Array.from(
    lab.querySelectorAll<HTMLElement | SVGElement>('[data-docs-lab-target]'),
  );
  const currentTarget = () =>
    targets.find((target) => !target.hasAttribute('hidden')) ?? targets[0];
  const zoomTools = required<HTMLElement>('[data-zoom-tools]', lab);
  const lifetime = new AbortController();
  const zoom = initializePreviewZoom({
    viewport: stage,
    camera: required<HTMLElement>('[data-docs-preview-camera]', stage),
    tools: zoomTools,
    target: currentTarget,
    signal: lifetime.signal,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
  });

  function statusMessage(status: ControlBoxStatus) {
    if (status.lifecycle === 'active') {
      if (status.paused) {
        return messages.paused;
      }
      return status.held ? messages.held : messages.live;
    }
    if (status.reason === 'no-webgpu') {
      return messages.noGpu;
    }
    if (status.reason === 'reduced-motion') {
      return status.reducedMotion ? messages.reducedMotion : messages.restart;
    }
    if (status.lifecycle === 'initializing') {
      return messages.preparing;
    }
    return status.lifecycle === 'suspended' ? messages.waiting : messages.unavailable;
  }

  const box = createControlBox({
    root: required<HTMLElement>('[data-control-box]', lab),
    effect,
    locale,
    messages: controlBoxMessages(locale),
    surface: {
      frame: lab,
      stage,
      host,
      zoomTools,
      target: currentTarget,
      selectTarget(kind) {
        for (const target of targets) {
          target.toggleAttribute('hidden', target.dataset.docsLabTarget !== kind);
        }
      },
    },
    initial: restored.get(lab) ?? {
      settings: parseEffectSettings(effect, new URLSearchParams(location.search)),
    },
    status: {
      element: required<HTMLElement>('[data-docs-lab-status]', lab),
      message: statusMessage,
    },
    onTargetChange: zoom.reset,
  });

  return () => {
    restored.set(lab, box.snapshot());
    lifetime.abort();
    box.dispose();
  };
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing docs lab element: ${selector}`);
  }
  return element;
}

initializePage(initializeLabs);
