/* ============================================================
   KEEP A SECRET — shared by every page: the fade between pages, a clean first
   paint, and no zooming
   Clicking a link to another page here fades the screen to black first, and
   every page — however it was reached, a refresh included — comes up out of
   black only once its font and images are in, so nothing flashes or pops in.
   Loaded (blocking) at the end of <head>, so the black is already in place
   before anything can paint.
   ============================================================ */
(() => {
  'use strict';

  /* No pinch- or keyboard-zoom: the pages are laid out as one fixed screen. (Browsers
     treat a trackpad pinch as ctrl + wheel, so that is caught too.) */
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/user-scalable/.test(vp.content)) vp.content += ', maximum-scale=1, user-scalable=no';
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => addEventListener(t, e => e.preventDefault()));
  addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault();
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'kas-fade';
  const OUT = reduced ? 1 : 120, IN = reduced ? 1 : 140;   // ms: fading to black, and back up out of it — the same on every page
  const EASE = 'cubic-bezier(.4, 0, .2, 1)';
  const root = document.documentElement;

  const veil = document.createElement('div');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#040405;pointer-events:none;opacity:1;';
  root.appendChild(veil);

  const fade = (to, ms) => {
    veil.style.transition = ms ? `opacity ${ms}ms ${EASE}` : 'none';
    veil.style.opacity = String(to);
  };

  /* Every load — a refresh and a first visit as much as arriving from another page —
     starts behind the black, and it only comes up once the page is really ready: the
     lettering font is in (no flash of a fallback face that then jumps), and every
     image has loaded (no artwork or colour popping in). Nothing can be seen mid-way. */
  let up = false;
  const rise = () => {
    if (up) return; up = true;
    let shown = false;
    const settle = document.querySelector('[data-pf]') ? 220 : 40;   // only the portfolio's big 3D covers need a beat to be drawn
    const lift = () => { if (!shown) { shown = true; fade(0, IN); } };
    /* a beat after the first frames are painted — heavy layers (the 3D covers) are only drawn
       a moment after their images are decoded, and that must happen behind the black */
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(lift, settle)));
    setTimeout(lift, 700);                                      // …or regardless, if frames are being held back
  };
  const fonts = () => {
    try {
      return Promise.all([document.fonts.load('800 1em "Monument Extended"'), document.fonts.load('400 1em "Monument Extended"')]);
    } catch (_) { return Promise.resolve(); }
  };
  const loaded = new Promise(res => { if (document.readyState === 'complete') res(); else addEventListener('load', res, { once: true }); });
  /* …and decoded, so no picture is still being drawn in when the black lifts */
  const decoded = loaded.then(() => Promise.all([...document.images].map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => {}))));
  Promise.all([fonts().catch(() => {}), decoded]).then(rise);
  setTimeout(rise, 1800);                  // never leave it black if something is slow
  try { sessionStorage.removeItem(KEY); } catch (_) {}

  /* the browser's back/forward cache can hand back a page that is still faded out */
  addEventListener('pageshow', ev => { if (ev.persisted) fade(0, 0); });

  /* every way of leaving a page goes through this one fade — links below, and the
     page pill, which calls window.kasGo(url) */
  function go(href) {
    try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
    fade(1, OUT);
    setTimeout(() => { location.href = href; }, OUT);
  }
  window.kasGo = go;

  document.addEventListener('click', ev => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // same page / a #anchor
    ev.preventDefault();
    go(url.href);
  });
})();
