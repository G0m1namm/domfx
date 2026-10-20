const button = document.querySelector<HTMLAnchorElement>('[data-back-to-top]');
const title = document.querySelector<HTMLElement>('#_top');
if (button && title) {
  button.dataset.enhanced = '';
  title.tabIndex = -1;
  let frame = 0;
  const update = () => {
    frame = 0;
    button.toggleAttribute('data-visible', scrollY > innerHeight);
  };
  addEventListener(
    'scroll',
    () => {
      frame ||= requestAnimationFrame(update);
    },
    { passive: true },
  );
  button.addEventListener('click', (event) => {
    event.preventDefault();
    scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    title.focus({ preventScroll: true });
  });
  update();
}
