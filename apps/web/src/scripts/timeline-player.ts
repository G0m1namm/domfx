import { gsap } from 'gsap';

export function createTimelinePlayer(root: HTMLElement) {
  function required<T extends Element>(selector: string) {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing timeline player element: ${selector}`);
    }
    return element;
  }
  const note = required<HTMLElement>('.player-note');

  const controls = required<HTMLFieldSetElement>('.player-controls');
  const seek = required<HTMLInputElement>('.player-seek');
  const time = required<HTMLOutputElement>('.player-time output');
  const state = required<HTMLElement>('[data-player-state]');
  const play = required<HTMLButtonElement>('[data-action="play"]');
  const reverse = required<HTMLButtonElement>('[data-action="reverse"]');
  const speed = required<HTMLSelectElement>('[name="speed"]');
  const repeat = required<HTMLInputElement>('[name="repeat"]');
  const yoyo = required<HTMLInputElement>('[name="yoyo"]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const options = { signal: events.signal };
  let timeline: gsap.core.Timeline;

  function update() {
    const seconds = timeline.time();
    seek.value = String(seconds);
    seek.setAttribute('aria-valuetext', `${seconds.toFixed(1)} of 4 seconds`);
    time.textContent = `${seconds.toFixed(1)} / 4.0s`;
  }

  function pause() {
    timeline.pause();
    state.textContent = 'Paused';
    update();
  }

  const context = gsap.context(() => {
    const shapes = root.querySelectorAll('[data-shape]');
    gsap.set(shapes, { transformOrigin: '50% 50%' });
    timeline = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.inOut' },
      onUpdate: update,
      onComplete: () => {
        state.textContent = 'Complete';
      },
      onReverseComplete: () => {
        state.textContent = 'At start';
      },
    });
    timeline
      .addLabel('lift', 0)
      .to(shapes, { y: -36, duration: 1, stagger: 0.2 }, 'lift')
      .addLabel('turn', 1.4)
      .to(shapes, { rotation: 180, scale: 0.75, duration: 1.2 }, 'turn')
      .addLabel('settle', 2.6)
      .to(shapes, { y: 24, scale: 1, duration: 1, stagger: 0.2 }, 'settle');
  }, root);

  controls.disabled = false;
  function reduced() {
    return motion.matches || document.documentElement.hasAttribute('data-reduced-motion');
  }

  function applyMotionPreference() {
    pause();
    play.disabled = reduced();
    reverse.disabled = reduced();
    note.textContent = reduced()
      ? 'Reduced motion is on. Scrub the timeline to explore still frames.'
      : 'Press Play, or drag the playhead. Yoyo plays repeated cycles back and forth.';
  }
  applyMotionPreference();
  motion.addEventListener('change', applyMotionPreference, options);

  play.addEventListener(
    'click',
    () => {
      if (reduced()) {
        return;
      }
      if (timeline.progress() === 1) {
        timeline.totalTime(0);
      }
      timeline.play();
      state.textContent = 'Playing';
    },
    options,
  );
  required<HTMLButtonElement>('[data-action="pause"]').addEventListener('click', pause, options);
  reverse.addEventListener(
    'click',
    () => {
      if (reduced()) {
        return;
      }
      if (timeline.time() === 0) {
        timeline.seek(timeline.duration());
      }
      timeline.reverse();
      state.textContent = 'Reversing';
    },
    options,
  );
  seek.addEventListener(
    'input',
    () => {
      timeline.pause().seek(Number(seek.value));
      state.textContent = 'Paused';
      update();
    },
    options,
  );
  speed.addEventListener(
    'change',
    () => {
      timeline.timeScale(Number(speed.value));
    },
    options,
  );

  function configureRepeat() {
    const position = timeline.time();
    const paused = timeline.paused();
    timeline.pause().totalTime(position, true);
    timeline.repeat(repeat.checked ? -1 : 0).yoyo(yoyo.checked);
    timeline.paused(paused);
    update();
  }
  repeat.addEventListener(
    'change',
    () => {
      if (!repeat.checked) {
        yoyo.checked = false;
      }
      configureRepeat();
    },
    options,
  );
  yoyo.addEventListener(
    'change',
    () => {
      if (yoyo.checked) {
        repeat.checked = true;
      }
      configureRepeat();
    },
    options,
  );

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio === 0) {
        pause();
      }
    },
    { threshold: 0.01 },
  );
  observer.observe(root);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        pause();
      }
    },
    options,
  );
  const preferenceObserver = new MutationObserver(applyMotionPreference);
  preferenceObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-reduced-motion'],
  });
  return () => {
    pause();
    observer.disconnect();
    preferenceObserver.disconnect();
    events.abort();
    context.revert();
  };
}
