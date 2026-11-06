import { gsap } from 'gsap';

import type { EffectHandle } from '@domfx/browser';
import { localeFromPath } from '@domfx/site/locale';
import { readMotionTokens } from '@domfx/site/motion-tokens';
import { initializePage } from '@domfx/site/page-lifetime';
import { initializePreviewZoom } from '@domfx/site/preview-zoom';
import { startTopLayerTooltips } from '@domfx/site/top-layer-tooltips';

import { docsMessages } from '../content/docs-messages';
import { addIgnitionSequence } from '../content/gsap-ignition';

const DURATION = 6;
const ACT_LABEL = /addLabel\(["'](?:ignite|surge|burnOut)["']/;
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
  const word = required<HTMLElement>('[data-gsap-word]', lab);
  const letters = Array.from(lab.querySelectorAll<HTMLElement>('[data-gsap-letter]'));
  const play = required<HTMLButtonElement>('[data-gsap-play]', lab);
  const playIcon = required<SVGUseElement>('use', play);
  const restart = required<HTMLButtonElement>('[data-gsap-restart]', lab);
  const reverse = required<HTMLButtonElement>('[data-gsap-reverse]', lab);
  const position = required<HTMLInputElement>('[data-gsap-position]', lab);
  const positionOutput = required<HTMLOutputElement>('[data-gsap-position-output]', lab);
  const timeOutput = required<HTMLOutputElement>('[data-gsap-time-output]', lab);
  const intensityOutputs = Array.from(
    lab.querySelectorAll<HTMLOutputElement>('[data-gsap-intensity-output]'),
  );
  const rootColor = required<HTMLElement>('[data-gsap-root-color]', lab);
  const codeScroll = required<HTMLElement>('.docs-gsap-code .docs-code-scroll', lab);
  const codeTitle = required<HTMLElement>('.docs-gsap-code .docs-lab-code-bar', lab);
  const acts = Array.from(lab.querySelectorAll<HTMLButtonElement>('[data-gsap-act]'));
  const actStarts = acts.map((act) => Number(act.dataset.gsapAct));
  // Each code line belongs to the act whose label last appeared above it.
  let codeAct = 0;
  const codeLines = Array.from(
    lab.querySelectorAll<HTMLElement>('.docs-gsap-code .line'),
    (line) => {
      codeAct += ACT_LABEL.test(line.textContent ?? '') ? 1 : 0;
      return { line, act: codeAct };
    },
  );
  const status = required<HTMLElement>('[data-gsap-status]', lab);
  const anchor = required<HTMLElement>('[data-box-anchor]', lab);
  const details = required<HTMLButtonElement>('[data-gsap-details]', lab);
  const detailsPanel = required<HTMLElement>('[data-box-panel]', lab);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hasGpu = Boolean('gpu' in navigator && navigator.gpu);
  const originalOpacity = host.style.opacity;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  initializePreviewZoom({
    viewport: required<HTMLElement>('[data-docs-preview]', lab),
    camera: required<HTMLElement>('[data-docs-preview-camera]', lab),
    tools: required<HTMLElement>('[data-zoom-tools]', lab),
    target: () => word,
    signal,
    reducedMotion,
  });
  const playback: Playback = {
    position: 0,
    paused: true,
    reversed: false,
    needsResume: false,
    ...savedPlayback.get(lab),
  };
  let visible = false;
  let targetVisible = false;
  let revision = 0;
  let fires: EffectHandle[] = [];
  let timeline: gsap.core.Timeline | undefined;
  let unsubscribes: (() => void)[] = [];
  // Plays once when the word first enters view; any choice by the reader cancels it.
  let autoplay = !savedPlayback.has(lab);
  let healthTimer = 0;
  let detailsMotion: Animation | undefined;
  let shownAct = 0;

  function showDetails(open: boolean) {
    details.setAttribute('aria-expanded', String(open));
    detailsMotion?.cancel();
    detailsMotion = undefined;
    detailsPanel.hidden = false;
    const tokens = readMotionTokens(detailsPanel);
    const timing = open ? tokens.enter : tokens.exit;
    if (open) {
      anchor.dataset.open = 'details';
    }
    const settle = () => {
      detailsPanel.hidden = !open;
      if (!open) {
        delete anchor.dataset.open;
      }
    };
    if (!timing.duration) {
      settle();
      return;
    }
    const edges = open ? ['0 0.5rem', '0 0'] : ['0 0', '0 0.5rem'];
    const motion = detailsPanel.animate(
      { translate: edges, opacity: open ? [0, 1] : [1, 0] },
      { ...timing, fill: 'both' },
    );
    detailsMotion = motion;
    motion.onfinish = () => {
      settle();
      motion.cancel();
      detailsMotion = undefined;
    };
  }

  function restoreOpacity() {
    host.style.opacity = originalOpacity;
  }

  // Follows the running act inside the code's own scroll area; the page never moves.
  function showCodeAct(act: number) {
    const start = codeLines.find((code) => code.act === act)?.line;
    if (!start) {
      return;
    }
    const offset = start.getBoundingClientRect().top - codeScroll.getBoundingClientRect().top;
    codeScroll.scrollTo({
      top: codeScroll.scrollTop + offset - codeTitle.offsetHeight,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
  }

  function updateValues() {
    const [first] = fires;
    if (!timeline || !first) {
      return;
    }
    playback.position = timeline.time();
    position.value = String(playback.position);
    position.style.setProperty('--fill', `${(playback.position / DURATION) * 100}%`);
    positionOutput.value = playback.position.toFixed(2);
    timeOutput.value = first.time.toFixed(2);
    rootColor.style.background = (first as EffectHandle & { rootColor?: string }).rootColor ?? '';
    fires.forEach((fire, index) => {
      const output = intensityOutputs[index];
      if (output) {
        output.value = fire.intensity.toFixed(2);
        output.parentElement?.style.setProperty('--level', String(fire.intensity));
      }
    });
    const act = actStarts.filter((start) => playback.position >= start).length - 1;
    acts.forEach((button, index) => {
      button.setAttribute('aria-current', String(index === act));
    });
    for (const code of codeLines) {
      code.line.dataset.actOn = String(code.act === act);
    }
    if (act !== shownAct) {
      shownAct = act;
      showCodeAct(act);
    }
    position.setAttribute('aria-valuetext', `${playback.position.toFixed(2)} ${messages.seconds}`);
    // Keep the original button readable at the stopped first frame.
    if (playback.position === 0 && playback.paused) {
      restoreOpacity();
    }
  }

  function publish(next: string, message: string) {
    lab.dataset.status = next;
    lab.dataset.paused = String(playback.paused);
    // Screen readers receive every status; only unavailable or suspended output shows it.
    lab.dataset.statusVisible = String(next !== 'active');
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
    for (const act of acts) {
      act.disabled = !active;
    }
    const playing = !playback.paused && active;
    let label: string = messages.play;
    if (playing) {
      label = messages.pause;
    } else if (playback.position === DURATION) {
      label = messages.replay;
    }
    play.setAttribute('aria-label', label);
    playIcon.setAttribute('href', playing ? '#ph-pause' : '#ph-play');
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
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    unsubscribes = [];
    const previousTimeline = timeline;
    timeline = undefined;
    previousTimeline?.revert();
    const previous = fires;
    fires = [];
    previous.forEach((fire) => fire.dispose());
    restoreOpacity();
  }

  function unavailable(error?: unknown) {
    const failed = fires.find((fire) => fire.lifecycle !== 'active');
    console.error('GSAP lab effect unavailable', {
      reason: failed?.reason,
      detail: failed?.reasonDetail,
      error,
    });
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

  function refreshVisibleTarget() {
    if (!targetVisible || document.hidden) {
      return;
    }
    const request = revision;
    for (const next of fires) {
      if (next.raster === 'stale') {
        void next.refresh().catch((error: unknown) => {
          // Leaving view can invalidate this refresh; only terminal failures disable playback.
          if (
            request === revision &&
            !signal.aborted &&
            (next.lifecycle === 'unavailable' || next.lifecycle === 'disposed')
          ) {
            unavailable(error);
          }
        });
      }
    }
  }

  function startOnce() {
    if (autoplay && timeline && targetVisible && !document.hidden && !reducedMotion.matches) {
      autoplay = false;
      run('forward');
    }
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
      letters.forEach((letter, index) => {
        fires.push(
          attachFire(letter, {
            host,
            clock: 'manual',
            motion: 'respect',
            time: 0,
            intensity: 0,
            flameReach: 0.7,
            rootColor: '#fff5a3',
            tipColor: '#ff1701',
            seed: 314 + index * 7,
          }),
        );
      });
      for (const fire of fires) {
        unsubscribes.push(
          fire.onDispose(() => {
            if (current()) {
              unavailable();
            }
          }),
        );
      }
      await Promise.all(fires.map((fire) => fire.ready));
      if (!current()) {
        return;
      }
      function checkEffect() {
        if (
          fires.some((fire) => fire.lifecycle === 'unavailable' || fire.lifecycle === 'disposed')
        ) {
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
        addIgnitionSequence(timeline, host, letters, fires);
        // Leave the initial word readable; later restores seek the recorded sample.
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
        startOnce();
      }
      checkEffect();
      // ready also settles for cancelled capture. Suspended handles retain setters,
      // so controls remain usable while the target is above the visible panel.
      refreshVisibleTarget();
      // The public handle has no state-change subscription. Detect failures even
      // while GSAP is paused, when onUpdate cannot report them.
      if (current()) {
        healthTimer = window.setInterval(checkEffect, 250);
      }
    } catch (error) {
      if (current()) {
        unavailable(error);
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

  details.disabled = false;
  details.addEventListener(
    'click',
    () => showDetails(details.getAttribute('aria-expanded') !== 'true'),
    { signal },
  );
  startTopLayerTooltips(lab, signal);
  play.addEventListener(
    'click',
    () => {
      autoplay = false;
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
  restart.addEventListener(
    'click',
    () => {
      autoplay = false;
      run('restart');
    },
    { signal },
  );
  reverse.addEventListener(
    'click',
    () => {
      autoplay = false;
      run('reverse');
    },
    { signal },
  );
  function seekTo(seconds: number) {
    autoplay = false;
    playback.paused = true;
    timeline?.pause().seek(seconds);
    // seek suppresses callbacks by default; read the actual setters explicitly.
    updateValues();
    publishPlayback();
  }
  position.addEventListener('input', () => seekTo(Number(position.value)), { signal });
  acts.forEach((act, index) => {
    act.addEventListener('click', () => seekTo(actStarts[index] ?? 0), { signal });
  });
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
  const targetObserver = new IntersectionObserver(
    ([entry]) => {
      targetVisible = entry.isIntersecting && entry.intersectionRatio > 0;
      // A capture cancelled while offscreen needs an explicit new revision.
      refreshVisibleTarget();
      startOnce();
    },
    { threshold: Number.EPSILON },
  );
  if (reducedMotion.matches) {
    playback.paused = true;
    playback.needsResume = true;
  }
  void attach();
  observer.observe(lab);
  targetObserver.observe(word);

  return () => {
    lifetime.abort();
    detailsMotion?.finish();
    observer.disconnect();
    targetObserver.disconnect();
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
