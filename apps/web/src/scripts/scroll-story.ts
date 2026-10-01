import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Owns only the page choreography. The showcase controller owns all Fire handles. */
export function createScrollStory(invalidate: () => void, beforeLayoutChange: () => void) {
  function required(selector: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`Missing scroll story element: ${selector}`);
    }
    return element;
  }
  const story = required('.scroll-story');
  const scene = required('.story-scene');
  const center = required('.scroll-story .ring-slot--center');
  const vectorHost = required('.vector-host');
  const navigation = scene.querySelector<HTMLElement>('.story-navigation');
  const events = new AbortController();
  const roomForStory = matchMedia(
    '(min-height: 800px), (min-width: 1100px) and (min-height: 680px)',
  );
  let context: gsap.Context | undefined;
  let timeline: gsap.core.Timeline | undefined;
  let disabled = true;
  let ready = false;
  const destinations: Record<string, string> = {
    '#examples': 'image',
    '#example-image': 'image',
    '#example-svg': 'vector',
    '#effect-heading': 'text',
  };

  function jumpToHash() {
    const label = destinations[location.hash];
    const trigger = timeline?.scrollTrigger;
    if (label && trigger) {
      window.scrollTo({ top: trigger.labelToScroll(label), behavior: 'instant' });
      ScrollTrigger.update();
      trigger.getTween()?.progress(1);
    }
  }

  function setup() {
    if (disabled || !ready || context || !roomForStory.matches || events.signal.aborted) {
      return;
    }
    beforeLayoutChange();
    story.dataset.storyEnhanced = '';
    if (navigation) {
      navigation.hidden = false;
    }
    const scale = () => vectorHost.getBoundingClientRect().width / center.offsetWidth;
    context = gsap.context(() => {
      const imageCopy = scene.querySelector('.image-step');
      const vector = scene.querySelector('.vector-step');
      const text = scene.querySelector('.text-step');
      const textParts = scene.querySelectorAll('.text-step > *');
      const sides = scene.querySelectorAll('.ring-slot:not(.ring-slot--center)');
      gsap.set([imageCopy, vector, text, navigation], { autoAlpha: 0 });
      gsap.set(vectorHost, { autoAlpha: 0 });
      gsap.set(textParts, { autoAlpha: 0, y: 48 });
      timeline = gsap.timeline({
        defaults: { ease: 'none', force3D: false },
        onUpdate: invalidate,
        scrollTrigger: {
          trigger: story,
          pin: scene,
          start: 'top top',
          // Keep the opening's 0.6 viewport per timeline unit; extend only the chapters.
          end: () => `+=${scene.clientHeight * 5.4}`,
          scrub: 0.25,
          invalidateOnRefresh: true,
          onRefreshInit: beforeLayoutChange,
          onRefresh: invalidate,
        },
      });
      timeline
        .to('.hero-copy', { autoAlpha: 0, y: -64, duration: 0.65 }, 0)
        .to(sides, { autoAlpha: 0, y: 120, duration: 0.85 }, 0)
        .fromTo(
          center,
          { xPercent: -50, x: 0, y: 0, scale: 1 },
          {
            y: () =>
              scene.clientHeight / 2 - center.offsetTop - (center.offsetHeight * scale()) / 2,
            scale,
            duration: 1.2,
          },
          0,
        )
        .to(navigation, { autoAlpha: 1, duration: 0.3 }, 0.85)
        .addLabel('image', 2.15)
        .to(center, { autoAlpha: 0, duration: 0.4, ease: 'sine.inOut' }, 3.45)
        .set(vector, { autoAlpha: 1 }, 3.45)
        .to(vectorHost, { autoAlpha: 1, duration: 0.4, ease: 'sine.inOut' }, 3.45)
        .addLabel('vector', 4.95)
        .to(vectorHost, { autoAlpha: 0, duration: 0.4, ease: 'sine.inOut' }, 6.4)
        .set(text, { autoAlpha: 1 }, 6.85)
        .to(
          textParts,
          { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.13, ease: 'power2.out' },
          6.85,
        )
        .addLabel('text', 8.15)
        .to(navigation, { autoAlpha: 0, duration: 0.2 }, 8.8);

      // Copy has its own entrance, reading interval and upward exit. The art stays anchored.
      for (const [selector, entry, exit] of [
        ['.image-step', 0.85, 2.85],
        ['.vector-step', 3.75, 5.7],
      ] as const) {
        const heading = required(`${selector} .stage-title`);
        const lines = heading.querySelectorAll('.reveal-line > span');
        const description = required(`${selector} .stage-description`);
        const paragraphs = description.children;
        const travel = () => (scene.clientWidth >= 1100 ? scene.clientHeight * 0.35 : 48);
        gsap.set(lines, { yPercent: 110 });
        gsap.set(paragraphs, { autoAlpha: 0, y: 16 });
        timeline
          .set(selector, { autoAlpha: 1 }, entry)
          .fromTo(heading, { y: travel }, { y: 0, duration: 0.8, ease: 'power2.out' }, entry)
          .to(lines, { yPercent: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out' }, entry)
          .fromTo(
            description,
            { y: travel },
            { y: 0, duration: 0.8, ease: 'power2.out' },
            entry + 0.25,
          )
          .to(
            paragraphs,
            { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.12, ease: 'power1.out' },
            entry + 0.3,
          )
          .to(heading, { y: () => -travel(), duration: 0.8, ease: 'power1.in' }, exit)
          .to(heading, { autoAlpha: 0, duration: 0.35 }, exit + 0.4)
          .to(description, { y: () => -travel(), duration: 0.8, ease: 'power1.in' }, exit + 0.2)
          .to(paragraphs, { autoAlpha: 0, duration: 0.3, stagger: 0.06 }, exit + 0.55)
          .set(selector, { autoAlpha: 0 }, exit + 1.15);
      }
    }, scene);
    jumpToHash();
    invalidate();
  }

  function reset() {
    beforeLayoutChange();
    context?.revert();
    context = undefined;
    timeline = undefined;
    delete story.dataset.storyEnhanced;
    if (navigation) {
      navigation.hidden = true;
    }
    invalidate();
  }

  document.addEventListener(
    'click',
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (
        !link ||
        !timeline ||
        link.origin !== location.origin ||
        link.pathname !== location.pathname ||
        !destinations[link.hash]
      ) {
        return;
      }
      event.preventDefault();
      history.pushState(null, '', link.hash);
      jumpToHash();
      const target = scene.querySelector<HTMLElement>(
        destinations[link.hash] === 'vector'
          ? '.vector-step'
          : destinations[link.hash] === 'text'
            ? '.text-step'
            : '.image-step',
      );
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    },
    { signal: events.signal },
  );
  window.addEventListener('hashchange', jumpToHash, { signal: events.signal });
  window.addEventListener('popstate', jumpToHash, { signal: events.signal });
  roomForStory.addEventListener(
    'change',
    () => {
      reset();
      setup();
    },
    { signal: events.signal },
  );
  void document.fonts.ready.then(() => {
    if (!events.signal.aborted) {
      ready = true;
      setup();
    }
  });

  return {
    setReduced(value: boolean) {
      if (disabled === value) {
        return;
      }
      disabled = value;
      if (disabled) {
        reset();
      } else {
        setup();
      }
    },
    dispose() {
      events.abort();
      reset();
    },
  };
}
