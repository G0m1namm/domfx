import { gsap } from 'gsap';

import type { EffectHandle } from '@domfx/browser';
import { localeFromPath } from '@domfx/site/locale';
import { initializePage } from '@domfx/site/page-lifetime';

import { docsMessages } from '../content/docs-messages';
import { addGsapSequence } from '../content/gsap-sequence';

const DURATION = 4.5;
interface Playback {
  position: number;
  paused: boolean;
  reversed: boolean;
  needsResume: boolean;
}
const savedPlayback = new WeakMap<HTMLElement, Playback>();

function initializeLab(lab: HTMLElement) {
  const messages = docsMessages(localeFromPath(location.pathname)).gsapLab;
  const host = required<HTMLElement>('[data-gsap-host]', lab);
  const target = required<HTMLButtonElement>('[data-gsap-target]', lab);
  const clicks = required<HTMLElement>('[data-gsap-clicks]', lab);
  const play = required<HTMLButtonElement>('[data-gsap-play]', lab);
  const restart = required<HTMLButtonElement>('[data-gsap-restart]', lab);
  const reverse = required<HTMLButtonElement>('[data-gsap-reverse]', lab);
  const position = required<HTMLInputElement>('[data-gsap-position]', lab);
  const positionOutput = required<HTMLOutputElement>('[data-gsap-position-output]', lab);
  const timeOutput = required<HTMLOutputElement>('[data-gsap-time-output]', lab);
  const intensityOutput = required<HTMLOutputElement>('[data-gsap-intensity-output]', lab);
  const status = required<HTMLElement>('[data-gsap-status]', lab);
  const segment = required<HTMLElement>('[data-gsap-segment]', lab);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hasGpu = Boolean('gpu' in navigator && navigator.gpu);
  const originalOpacity = host.style.opacity;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const playback: Playback = {
    position: 0,
    paused: true,
    reversed: false,
    needsResume: false,
    ...savedPlayback.get(lab),
  };
  let visible = false;
  let revision = 0;
  let fire: EffectHandle | undefined;
  let timeline: gsap.core.Timeline | undefined;
  let unsubscribe: (() => void) | undefined;
  let healthTimer = 0;

  function restoreOpacity() {
    host.style.opacity = originalOpacity;
  }

  function updateValues() {
    if (!timeline || !fire) {
      return;
    }
    playback.position = timeline.time();
    position.value = String(playback.position);
    position.style.setProperty('--fill', `${(playback.position / DURATION) * 100}%`);
    positionOutput.value = playback.position.toFixed(2);
    timeOutput.value = fire.time.toFixed(2);
    intensityOutput.value = fire.intensity.toFixed(2);
    position.setAttribute('aria-valuetext', `${playback.position.toFixed(2)} ${messages.seconds}`);
    segment.textContent =
      playback.position < 0.5 ? messages.fadeExplanation : messages.effectExplanation;
    // Keep the original button readable at the stopped first frame.
    if (playback.position === 0 && playback.paused) {
      restoreOpacity();
    }
  }

  function publish(next: string, message: string) {
    lab.dataset.status = next;
    lab.dataset.paused = String(playback.paused);
    if (status.textContent !== message) {
      status.textContent = message;
    }
    const active = next === 'active';
    const canStart =
      playback.needsResume && hasGpu && !reducedMotion.matches && visible && !document.hidden;
    play.disabled = !active && !canStart;
    restart.disabled = !active;
    reverse.disabled = !active;
    position.disabled = !active;
    if (!playback.paused && active) {
      play.textContent = messages.pause;
    } else if (playback.position === DURATION) {
      play.textContent = messages.replay;
    } else {
      play.textContent = messages.play;
    }
  }

  function publishPlayback() {
    let message: string = messages.paused;
    if (!playback.paused) {
      message = playback.reversed ? messages.reversing : messages.playing;
    } else if (playback.position === DURATION) {
      message = messages.complete;
    }
    publish('active', message);
  }

  function release() {
    revision += 1;
    if (timeline) {
      playback.position = timeline.time();
      timeline.pause();
    }
    window.clearInterval(healthTimer);
    unsubscribe?.();
    unsubscribe = undefined;
    const previousTimeline = timeline;
    timeline = undefined;
    previousTimeline?.revert();
    const previous = fire;
    fire = undefined;
    previous?.dispose();
    restoreOpacity();
  }

  function unavailable() {
    release();
    playback.paused = true;
    publish('unavailable', messages.unavailable);
  }

  function finish() {
    playback.paused = true;
    timeline?.pause();
    updateValues();
    publishPlayback();
  }

  async function attach() {
    release();
    if (!hasGpu) {
      publish('unavailable', messages.noGpu);
      return;
    }
    if (reducedMotion.matches || playback.needsResume) {
      publish(
        'unavailable',
        reducedMotion.matches ? messages.reducedMotion : messages.resumeRequired,
      );
      return;
    }
    if (!visible || document.hidden || signal.aborted) {
      publish('suspended', messages.waiting);
      return;
    }
    const request = revision;
    const current = () => request === revision && !signal.aborted;
    publish('initializing', messages.preparing);
    try {
      const [{ attachFire }] = await Promise.all([import('@domfx/browser'), document.fonts.ready]);
      if (!current()) {
        return;
      }
      const next = attachFire(target, {
        host,
        clock: 'manual',
        motion: 'respect',
        time: 0,
        intensity: 0.8,
        flameHeight: 32,
        seed: 314,
      });
      fire = next;
      unsubscribe = next.onDispose(() => {
        if (current()) {
          unavailable();
        }
      });
      await next.ready;
      if (!current()) {
        return;
      }
      function checkEffect() {
        // Scrolling from the stage to its controls can hide only the target.
        // Native visibility suspension retains writes until the target re-enters.
        if (next.lifecycle === 'suspended' && next.reason === 'target-not-visible') {
          if (!timeline) {
            publish('suspended', messages.waiting);
          }
          return;
        }
        if (next.lifecycle !== 'active') {
          unavailable();
          return;
        }
        if (timeline) {
          return;
        }
        timeline = gsap.timeline({
          paused: true,
          onUpdate: updateValues,
          onComplete: finish,
          onReverseComplete: finish,
        });
        addGsapSequence(timeline, host, next);
        // Leave the initial target readable; later restores seek the recorded sample.
        if (playback.position > 0) {
          timeline.seek(playback.position);
        }
        updateValues();
        if (!playback.paused) {
          if (playback.reversed) {
            timeline.reverse();
          } else {
            timeline.play();
          }
        }
        publishPlayback();
      }
      checkEffect();
      // The public handle has no state-change subscription. Detect failures even
      // while GSAP is paused, when onUpdate cannot report them.
      if (current()) {
        healthTimer = window.setInterval(checkEffect, 250);
      }
    } catch {
      if (current()) {
        unavailable();
      }
    }
  }

  function run(direction: 'forward' | 'reverse' | 'restart') {
    if (!timeline) {
      playback.needsResume = false;
      playback.paused = false;
      playback.reversed = false;
      void attach();
      return;
    }
    playback.paused = false;
    playback.reversed = direction === 'reverse';
    if (direction === 'restart' || (direction === 'forward' && timeline.time() === DURATION)) {
      timeline.restart();
    } else if (direction === 'reverse') {
      timeline.reverse(timeline.time() === 0 ? DURATION : undefined);
    } else {
      timeline.play();
    }
    updateValues();
    publishPlayback();
  }

  target.addEventListener(
    'click',
    () => {
      clicks.textContent = String(Number(clicks.textContent) + 1);
    },
    { signal },
  );
  play.addEventListener(
    'click',
    () => {
      if (timeline && !playback.paused) {
        playback.paused = true;
        timeline.pause();
        updateValues();
        publishPlayback();
      } else {
        run('forward');
      }
    },
    { signal },
  );
  restart.addEventListener('click', () => run('restart'), { signal });
  reverse.addEventListener('click', () => run('reverse'), { signal });
  position.addEventListener(
    'input',
    () => {
      playback.paused = true;
      timeline?.pause().seek(Number(position.value));
      // seek suppresses callbacks by default; read the actual setters explicitly.
      updateValues();
      publishPlayback();
    },
    { signal },
  );
  reducedMotion.addEventListener(
    'change',
    () => {
      playback.needsResume = true;
      playback.paused = true;
      void attach();
    },
    { signal },
  );
  document.addEventListener('visibilitychange', () => void attach(), { signal });

  const observer = new IntersectionObserver(
    ([entry]) => {
      const nextVisible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (visible !== nextVisible) {
        visible = nextVisible;
        void attach();
      }
    },
    { threshold: Number.EPSILON },
  );
  if (reducedMotion.matches) {
    playback.paused = true;
    playback.needsResume = true;
  }
  void attach();
  observer.observe(lab);

  return () => {
    lifetime.abort();
    observer.disconnect();
    release();
    savedPlayback.set(lab, { ...playback });
    publish('suspended', messages.waiting);
  };
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing GSAP lab element: ${selector}`);
  }
  return element;
}

initializePage(() => {
  const cleanups = Array.from(
    document.querySelectorAll<HTMLElement>('[data-docs-gsap-lab]'),
    initializeLab,
  );
  return () => cleanups.forEach((cleanup) => cleanup());
});
