/* ============================================================
   KEEP A SECRET — the lagging cursor

   Shared by every page (index.html and contact.html both load it), so
   the pointer behaves identically across the site rather than the portal
   having a custom one and the contact page falling back to the system
   arrow.

   It also owns the single requestAnimationFrame loop for the whole page:
   anything else that wants to run per-frame work (the grain and the
   cursor halo, in js/app.js) registers through onFrame() rather than
   starting a loop of its own. One loop means one place where a long
   frame can come from, which is the whole reason the cursor is smooth.
   ============================================================ */
window.Cursor = (() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine    = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const el  = document.querySelector('[data-cursor]');
  const dot = el && el.querySelector('.cursor__dot');

  /* the real pointer, and the dot chasing it a beat behind */
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const soft   = { x: target.x, y: target.y };

  let live = false, lastT = 0;
  const frameFns = [], liveFns = [];

  /* How hard the dot is pulled toward the pointer each 60Hz frame. The
     lag is the whole character of it — high enough to feel attached,
     low enough to trail. */
  const EASE = .28;
  const STEP = 1000 / 60;

  /* Frame-rate independent, which a plain lerp(a, b, .28) is not: that
     applies .28 once per *frame*, so the dot moves twice as fast on a
     120Hz display as on a 60Hz one, and lurches after any frame that
     ran long. Re-deriving the factor from how much time actually passed
     makes the motion identical everywhere and immune to a dropped
     frame — the two things that read as "the cursor is janky". */
  const smooth = (from, to, dt) => from + (to - from) * (1 - Math.pow(1 - EASE, dt / STEP));

  function frame(t) {
    /* Clamped: coming back to a backgrounded tab hands over a dt of
       several seconds, which would otherwise resolve to a factor of ~1
       and teleport the dot instead of easing it. */
    const dt = lastT ? Math.min(t - lastT, 64) : STEP;
    lastT = t;

    soft.x = smooth(soft.x, target.x, dt);
    soft.y = smooth(soft.y, target.y, dt);

    if (dot) dot.style.transform = `translate3d(${soft.x}px, ${soft.y}px, 0) translate(-50%, -50%)`;

    for (let n = 0; n < frameFns.length; n++) frameFns[n](target, dt, t);
    requestAnimationFrame(frame);
  }

  function setLive(v) {
    if (live === v) return;
    live = v;
    if (el) el.style.opacity = v ? '1' : '0';
    for (let n = 0; n < liveFns.length; n++) liveFns[n](v);
  }

  function init() {
    if (reduced) return;                 // no dot, no loop, system cursor left alone

    if (!fine || !el) {
      /* touch, or a page without the markup — drop the element and leave
         the system cursor be, but keep the loop running: the grain and
         anything else registered through onFrame() still want frames. */
      el?.remove();
    } else {
      /* Only now does the system cursor go away. Doing this from CSS
         alone meant a page that failed to run this script (blocked,
         errored, old browser) was left with no pointer at all — the
         class is the page's proof that a replacement is actually
         running. See html.has-cursor in css/styles.css. */
      document.documentElement.classList.add('has-cursor');

      addEventListener('pointerdown', () => document.body.classList.add('is-pressed'));
      addEventListener('pointerup',   () => document.body.classList.remove('is-pressed'));

      /* what counts as "there is something here to click" */
      document.addEventListener('pointerover', e => {
        const hot = e.target.closest?.('button, a, .scrub, .volume__track, .block:not(.is-active)');
        document.body.classList.toggle('is-pointing', !!hot);
      });

      /* Gone the moment the pointer leaves the page or the window loses
         focus, rather than left stranded wherever it last was. Both
         listeners exist because neither is reliable alone: `pointerleave`
         on `document` can miss a fast exit right at a viewport edge (the
         common case — flicking the mouse up toward the browser's own tabs
         or window controls), silently leaving the dot parked in whatever
         corner it was heading for. `pointerout` with a null `relatedTarget`
         is the browser's own "there is nothing after this, the pointer left
         the page" signal and catches exactly that gap. */
      document.addEventListener('pointerleave', () => setLive(false));
      document.documentElement.addEventListener('pointerout', e => {
        if (!e.relatedTarget) setLive(false);
      });
      addEventListener('blur', () => setLive(false));
    }

    addEventListener('pointermove', e => {
      /* Snapped rather than eased on the way back in: after being
         hidden the pointer is usually nowhere near where the dot was
         parked, and easing from there drags a visible streak across the
         page before it catches up. */
      if (!live) { soft.x = e.clientX; soft.y = e.clientY; }
      target.x = e.clientX; target.y = e.clientY;
      setLive(true);
    }, { passive: true });

    requestAnimationFrame(frame);
  }

  init();

  return {
    /* per-frame work for everyone else, on this one loop.
       fn(target, dt, time) */
    onFrame(fn) { frameFns.push(fn); },
    /* fires when the cursor appears or disappears */
    onLive(fn) { liveFns.push(fn); },
    /* Re-arms the "wait for a real move before showing" gate. Without
       it, the mouse movement it takes to click the gate's own Enter
       button already counts as live — so the instant the room appears
       the dot is already sitting wherever that click landed, which is
       usually right on the artwork. */
    hideUntilMove() { setLive(false); },
    enabled: !reduced && fine
  };
})();
