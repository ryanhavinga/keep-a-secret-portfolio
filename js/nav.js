/* ============================================================
   KEEP A SECRET — THE PAGE PILL (every page that has one)
   Portfolio · Player · The Vault, at the top of each of them. Choosing one
   glides the slider across, then changes page (through js/transition.js's
   fade). "The Vault" asks for its password first — CONFIG.gate. The password
   is a doorman, not a lock: see the note on CONFIG.gate in js/config.js.
   Needs js/config.js loaded before it.
   ============================================================ */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'kas-vault';            // sessionStorage: this tab has been let into the Vault
  const cfg = CONFIG.gate || {};
  const wanted = [].concat(cfg.passwordHash || []).filter(Boolean).map(h => String(h).trim().toLowerCase());

  /* ==========================================================
     THE VAULT'S PASSWORD
     ========================================================== */
  /* SHA-256 of the (trimmed, uppercased) candidate, hex-encoded — compared
     with CONFIG.gate.passwordHash, so the password itself never sits in
     config.js for anyone opening the file to read straight off. */
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  /* no password configured: nothing to ask */
  function unlocked() {
    if (!wanted.length) return true;
    try { return sessionStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  }
  /* Wire a door element (a .gate with a form and an input): a right password
     remembers this tab and calls onOpen; a wrong one is a shake and nothing
     else. Used by the prompt below and by the door on vault.html itself, so a
     link straight to the Vault is no way round it. */
  function wire(el, onOpen) {
    const form = el.querySelector('[data-gate-form]'), input = el.querySelector('[data-gate-input]');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (!wanted.includes(await sha256Hex(input.value.trim().toUpperCase()))) {
        el.classList.remove('is-wrong');
        void el.offsetWidth;                 // restart the shake
        el.classList.add('is-wrong');
        input.value = '';
        input.focus();
        return;
      }
      el.classList.remove('is-wrong');
      try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
      input.value = '';
      onOpen();
    });
    input.addEventListener('input', () => el.classList.remove('is-wrong'));
    return input;
  }
  window.kasVault = { unlocked, wire };

  /* ==========================================================
     THE PILL
     ========================================================== */
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

  /* ---- the prompt, built the first time it is wanted ---- */
  let ask = null;
  function prompt(a) {
    if (!ask) {
      const el = document.createElement('div');
      el.className = 'gate gate--ask';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'The Vault — password');
      el.innerHTML = `
        <div class="gate__inner">
          <p class="gate__mark">Keep A Secret</p>
          <p class="gate__eyebrow">The Vault</p>
          <form class="gate__form" data-gate-form>
            <input class="gate__input" data-gate-input type="password" placeholder="Password"
                   aria-label="Password" autocomplete="off" autocapitalize="characters"
                   autocorrect="off" spellcheck="false">
            <button class="gate__btn" type="submit">Enter</button>
            <button class="gate__cancel" type="button" data-gate-cancel>Back</button>
          </form>
        </div>`;
      document.body.appendChild(el);
      const input = el.querySelector('[data-gate-input]');
      const close = () => { el.classList.remove('is-shown', 'is-wrong'); input.value = ''; input.blur(); };
      ask = { el, input, close, then: null };
      wire(el, () => { close(); ask.then(); });
      el.querySelector('[data-gate-cancel]').addEventListener('click', close);
      /* a tap beside the form puts it away */
      el.addEventListener('click', ev => { if (!ev.target.closest('.gate__inner')) close(); });
      /* what is typed here is the password's, not the page's: the player's ←/→ and Space must not hear it */
      el.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') close(); });
    }
    ask.then = () => goTo(a);
    ask.el.classList.add('is-shown');
    ask.input.focus({ preventScroll: true });
  }

  seg.addEventListener('click', ev => {
    const a = ev.target.closest('.seg__btn');
    if (!a) return;
    ev.preventDefault();                 // js/transition.js's own link fade stays out of it
    if (a === here || leaving) return;
    if (a.hasAttribute('data-vault') && !unlocked()) prompt(a); else goTo(a);
  });
})();
