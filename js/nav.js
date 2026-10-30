/* ============================================================
   KEEP A SECRET — THE PAGE PILL (every page that has one)
   Portfolio · Demos, at the top of each of them. Choosing one glides the
   slider across, then changes page (through js/transition.js's fade).
   ============================================================ */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seg = document.querySelector('[data-seg]');
  if (!seg) return;
  const thumb = seg.querySelector('.seg__thumb');
  const links = [...seg.querySelectorAll('.seg__btn')];
  const here = links.find(a => a.getAttribute('aria-current') === 'page');
  const GLIDE = reduced ? 0 : 300;       // ms the slider gets before the page fades out

  const place = a => {
    thumb.style.setProperty('--tx', `${a.offsetLeft}px`);
    thumb.style.setProperty('--tw', `${a.offsetWidth}px`);
  };
  /* measure once the lettering is in (the widths depend on the font) */
  const measure = () => {
    if (!here) return;
    thumb.style.transition = 'none';
    place(here);
    void thumb.offsetWidth;
    thumb.style.transition = '';
    seg.classList.add('is-ready');
  };
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener('resize', measure);

  let leaving = false;
  const current = a => links.forEach(l => l === a ? l.setAttribute('aria-current', 'page') : l.removeAttribute('aria-current'));
  function goTo(a) {
    leaving = true;
    current(a);
    place(a);
    setTimeout(() => { if (window.kasGo) window.kasGo(a.href); else location.href = a.href; }, GLIDE);
  }
  /* coming Back to this page from the browser's cache: the slider is where it was left, under the page we went to */
  addEventListener('pageshow', ev => {
    if (!ev.persisted) return;
    leaving = false;
    current(here);
    measure();
  });

  seg.addEventListener('click', ev => {
    const a = ev.target.closest('.seg__btn');
    if (!a) return;
    ev.preventDefault();                 // js/transition.js's own link fade stays out of it
    if (a === here || leaving) return;
    goTo(a);
  });
})();
