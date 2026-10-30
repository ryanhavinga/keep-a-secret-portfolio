/* ============================================================
   KEEP A SECRET — THE VAULT (vault.html)
   The password · the door and its opening sequence · the wall of boxes
   Content lives in js/config.js, under CONFIG.vault.
   ============================================================ */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SOUND_ENABLED = true;   // the lock, the bolts, the door — false for a silent opening

  const V = CONFIG.vault || {};
  const OPENED_KEY = 'kas-vault-opened';
  const html = document.documentElement;
  const intro = $('[data-intro]');

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = s => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  /* ==========================================================
     THE ROOM — one safe-deposit box per song
     ========================================================== */
  const STATUS_LABEL = { 'available': 'Available', 'on hold': 'On hold', 'cut': 'Cut' };
  const PLAY_ICONS =
    '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 20 12 7 19.5Z"/></svg>' +
    '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4.5" width="4.5" height="15" rx="1.2"/><rect x="14" y="4.5" width="4.5" height="15" rx="1.2"/></svg>';

  function fillRoom() {
    if (V.eyebrow) $('[data-vault-eyebrow]').textContent = V.eyebrow;
    if (V.heading) $('[data-vault-heading]').textContent = V.heading;
    $('[data-vault-intro]').textContent = V.intro || '';

    const list = $('[data-boxes]');
    const tracks = V.tracks || [];
    const contact = V.contact || CONFIG.bio?.contact;

    tracks.forEach((t, i) => {
      const status = STATUS_LABEL[t.status] ? t.status : 'available';
      const meta = [t.genre, t.bpm && `${t.bpm} BPM`, t.key].filter(Boolean).join(' · ');
      const mail = contact && status !== 'cut'
        ? `mailto:${contact}?subject=${encodeURIComponent(`Demo request: ${t.title}`)}&body=${encodeURIComponent(`Hi,\n\nI'd like to request the demo of "${t.title}".\n\n`)}`
        : null;

      const li = document.createElement('li');
      li.className = 'box';
      li.dataset.status = status;
      li.style.setProperty('--i', i);
      li.innerHTML = `
        <div class="box__plate">
          <span class="box__no">N&ordm; ${String(i + 1).padStart(3, '0')}</span>
          <span class="box__status">${STATUS_LABEL[status]}</span>
        </div>
        <h2 class="box__title">${esc(t.title)}</h2>
        <p class="box__meta">${esc(meta)}</p>
        ${t.note ? `<p class="box__meta">${esc(t.note)}</p>` : ''}
        <div class="box__player">
          <button class="box__play" type="button" aria-label="Play ${esc(t.title)}">${PLAY_ICONS}</button>
          <div class="box__scrub" role="slider" tabindex="0" aria-label="Seek"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="box__track"><div class="box__fill"></div></div>
          </div>
          <span class="box__time">${time(t.duration)}</span>
        </div>
        ${mail ? `<a class="box__request" href="${esc(mail)}">Request this song</a>` : ''}`;
      list.appendChild(li);
      Player.add(li, t);
    });

    /* the locked ones after the real songs — a wall with more behind it */
    const sealed = Math.max(0, V.sealed | 0);
    for (let s = 0; s < sealed; s++) {
      const n = tracks.length + s;
      const li = document.createElement('li');
      li.className = 'box box--sealed';
      li.style.setProperty('--i', n);
      li.setAttribute('aria-label', 'Sealed');
      li.innerHTML = `
        <div class="box__plate">
          <span class="box__no">N&ordm; ${String(n + 1).padStart(3, '0')}</span>
          <span class="box__status">Sealed</span>
        </div>
        <div class="box__keyhole" aria-hidden="true"></div>`;
      list.appendChild(li);
    }
  }

  /* ==========================================================
     PLAYER — one <audio>, shared by every box
     ========================================================== */
  const Player = (() => {
    const audio = $('[data-audio]');
    const entries = [];
    let current = null;
    let dragging = false;

    /* the same level the portfolio's fader left off at — or its own 40%
       first-visit default — so walking between the two pages doesn't jump
       in loudness. (iOS ignores this; volume is hardware-only there.) */
    let vol = .4;
    try {
      const sv = parseFloat(localStorage.getItem('kas-volume'));
      if (isFinite(sv)) vol = Math.min(1, Math.max(0, sv));
    } catch (_) {}
    audio.volume = vol;

    const dur = e => (e === current && isFinite(audio.duration) && audio.duration) || e.track.duration || 0;

    function paint(e) {
      const d = dur(e);
      const t = e === current ? audio.currentTime : 0;
      const pct = d ? Math.min(100, (t / d) * 100) : 0;
      e.fill.style.width = `${pct}%`;
      e.scrub.setAttribute('aria-valuenow', Math.round(pct));
      e.timeEl.textContent = e === current && (t > 0 || !audio.paused) ? time(t) : time(d);
    }

    function setPlaying(e, on) {
      e.box.classList.toggle('is-playing', on);
      e.btn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${e.track.title}`);
    }

    function select(e) {
      if (current === e) return;
      if (current) { setPlaying(current, false); const prev = current; current = null; paint(prev); }
      current = e;
      audio.src = e.track.audio;
    }

    function toggle(e) {
      if (current !== e) select(e);
      if (audio.paused) audio.play().catch(() => setPlaying(e, false));
      else audio.pause();
    }

    function seekFromEvent(e, ev) {
      const r = e.scrub.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      if (current !== e) {
        select(e);
        audio.play().catch(() => setPlaying(e, false));
      }
      const apply = () => { audio.currentTime = ratio * (audio.duration || e.track.duration || 0); paint(e); };
      if (isFinite(audio.duration) && audio.duration) apply();
      else audio.addEventListener('loadedmetadata', apply, { once: true });
    }

    audio.addEventListener('play', () => current && setPlaying(current, true));
    audio.addEventListener('pause', () => current && setPlaying(current, false));
    audio.addEventListener('timeupdate', () => current && !dragging && paint(current));
    audio.addEventListener('loadedmetadata', () => current && paint(current));
    audio.addEventListener('ended', () => {
      if (!current) return;
      audio.currentTime = 0;
      setPlaying(current, false);
      paint(current);
    });

    /* space plays/pauses whatever box is loaded — the same key the
       portfolio's player answers to */
    document.addEventListener('keydown', ev => {
      if (ev.code !== 'Space' || !current || ev.target.closest('a, button, input')) return;
      if (!document.body.classList.contains('is-inside')) return;
      ev.preventDefault();
      toggle(current);
    });

    return {
      add(box, track) {
        const e = {
          box, track,
          btn: $('.box__play', box),
          scrub: $('.box__scrub', box),
          fill: $('.box__fill', box),
          timeEl: $('.box__time', box)
        };
        entries.push(e);
        e.btn.addEventListener('click', () => toggle(e));

        e.scrub.addEventListener('pointerdown', ev => {
          dragging = true;
          e.scrub.setPointerCapture(ev.pointerId);
          seekFromEvent(e, ev);
        });
        e.scrub.addEventListener('pointermove', ev => {
          if (dragging && e.scrub.hasPointerCapture(ev.pointerId)) seekFromEvent(e, ev);
        });
        const release = () => { dragging = false; };
        e.scrub.addEventListener('pointerup', release);
        e.scrub.addEventListener('pointercancel', release);
        e.scrub.addEventListener('keydown', ev => {
          if (current !== e || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
          ev.preventDefault();
          audio.currentTime = Math.max(0, audio.currentTime + (ev.key === 'ArrowRight' ? 5 : -5));
          paint(e);
        });
      }
    };
  })();

  /* ==========================================================
     SOUND — the lock, synthesised (no files to ship or license)
     ========================================================== */
  const Sound = (() => {
    let ctx = null, noise = null;

    function start() {
      if (!SOUND_ENABLED) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) {
        try { ctx = new AC(); } catch (_) { return null; }
        noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let n = 0; n < d.length; n++) d[n] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function noiseSrc(at, dur) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.start(at, Math.random() * 1.5, dur);
      return src;
    }
    function env(at, peak, attack, decay) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + attack);
      g.gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
      return g;
    }
    const when = ms => ctx.currentTime + ms / 1000;

    return {
      start,
      /* one detent of the dial or the wheel: a dry, bright tick */
      tick(ms, { freq = 3400, gain = .16 } = {}) {
        if (!ctx) return;
        const at = when(ms);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = freq * (.9 + Math.random() * .2); bp.Q.value = 3;
        noiseSrc(at, .05).connect(bp).connect(env(at, gain, .001, .03)).connect(ctx.destination);
      },
      /* the bolts landing home: a low thump, a dull knock, a short ring */
      clunk(ms) {
        if (!ctx) return;
        const at = when(ms);
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, at);
        o.frequency.exponentialRampToValueAtTime(42, at + .25);
        o.connect(env(at, .55, .004, .4)).connect(ctx.destination);
        o.start(at); o.stop(at + .5);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 700;
        noiseSrc(at, .2).connect(lp).connect(env(at, .4, .002, .14)).connect(ctx.destination);

        [530, 1290, 2140].forEach((f, i) => {
          const r = ctx.createOscillator();
          r.type = 'sine'; r.frequency.value = f;
          r.connect(env(at, .035 / (i + 1), .002, .7)).connect(ctx.destination);
          r.start(at); r.stop(at + .8);
        });
      },
      /* air moving as the seal breaks */
      hiss(ms) {
        if (!ctx) return;
        const at = when(ms);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 2400;
        noiseSrc(at, .9).connect(hp).connect(env(at, .07, .05, .8)).connect(ctx.destination);
      },
      /* the weight of the door on its hinges */
      rumble(ms, dur) {
        if (!ctx) return;
        const at = when(ms), d = dur / 1000;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 160;
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, at);
        g.gain.exponentialRampToValueAtTime(.5, at + d * .35);
        g.gain.exponentialRampToValueAtTime(.0001, at + d);
        noiseSrc(at, d).connect(lp).connect(g).connect(ctx.destination);

        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(46, at);
        o.frequency.linearRampToValueAtTime(38, at + d);
        const og = ctx.createGain();
        og.gain.setValueAtTime(.0001, at);
        og.gain.exponentialRampToValueAtTime(.18, at + d * .4);
        og.gain.exponentialRampToValueAtTime(.0001, at + d);
        o.connect(og).connect(ctx.destination);
        o.start(at); o.stop(at + d);
      },
      /* stepping through into the light — filtered noise sweeping up and away again */
      woosh(ms) {
        if (!ctx) return;
        const at = when(ms), dur = 2.4;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass'; band.Q.value = .9;
        band.frequency.setValueAtTime(150, at);
        band.frequency.exponentialRampToValueAtTime(1700, at + dur * .44);
        band.frequency.exponentialRampToValueAtTime(105, at + dur);
        const tame = ctx.createBiquadFilter();
        tame.type = 'lowpass'; tame.frequency.value = 5000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, at);
        g.gain.exponentialRampToValueAtTime(.32, at + dur * .4);
        g.gain.exponentialRampToValueAtTime(.0001, at + dur);
        noiseSrc(at, dur).connect(band).connect(tame).connect(g).connect(ctx.destination);
      }
    };
  })();

  /* ==========================================================
     THE DOOR
     ========================================================== */

  let GL = null;   // the 3D door — see js/vault3d.src.js

  const Door = (() => {
    /* The opening, in milliseconds from the click. js/vault3d.src.js moves
       the picture off this same table and the sounds below fire from it,
       so changing a time here moves all of them together. */
    const T = {
      dial: [0, 560, 1080],
      turn: 1380, turnDur: 1500,
      unbolt: 2950, boltDur: 420,
      crack: 3550,
      swing: 4150, swingDur: 2500,
      enter: 5850,
      inside: 7450
    };
    const DIAL_STOPS = [250, 70, 165];
    const WHEEL_EASE = [.55, 0, .25, 1];   // the wheel's easing in vault3d.src.js

    /* when each detent of the wheel passes, following its own easing
       curve — so the ratchet slows down exactly as the wheel does */
    function easedTimes(count, dur, [x1, y1, x2, y2]) {
      const bez = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
      const out = [];
      let k = 1;
      for (let t = 0; t <= 1.0001 && k <= count; t += .002) {
        if (bez(t, y1, y2) >= k / count) { out.push(bez(t, x1, x2) * dur); k++; }
      }
      return out;
    }

    let opening = false;
    function open() {
      if (opening) return;
      opening = true;
      intro.classList.add('is-working');

      const at = (ms, fn) => setTimeout(fn, ms);
      Sound.start();
      GL.start();

      /* the combination — three turns of the dial, a click per notch */
      let last = 0;
      T.dial.forEach((ms, i) => at(ms, () => {
        const notches = Math.round(Math.abs(DIAL_STOPS[i] - last) / 22);
        last = DIAL_STOPS[i];
        easedTimes(notches, 500, [.45, 0, .3, 1]).forEach(t => Sound.tick(t, { freq: 4200, gain: .1 }));
      }));

      /* the wheel */
      at(T.turn, () => easedTimes(18, T.turnDur, WHEEL_EASE).forEach(t => Sound.tick(t, { freq: 2600, gain: .2 })));

      /* the bolts draw back */
      at(T.unbolt, () => Sound.clunk(T.boltDur - 60));

      /* the seal breaks, then the door swings */
      at(T.crack, () => Sound.hiss(0));
      at(T.swing, () => Sound.rumble(0, T.swingDur + 300));

      /* and in */
      at(T.enter, () => { intro.classList.add('is-entering'); Sound.woosh(0); });
      at(T.inside, goInside);
    }

    return {
      init() {
        /* no WebGL, or the visitor asked for less motion: there is no
           door to open, so go straight in rather than show anything else */
        if (reduced || !window.KasVault3D?.supported()) return goInside();
        try {
          GL = window.KasVault3D.init($('[data-gl]'), T, open);
          window.__vault = GL;   // console handle: __vault.debug, __vault.seek(ms)
        } catch (err) {
          console.warn('Vault 3D unavailable, going straight in', err);
          GL = null;
          return goInside();
        }
        $('[data-open]').addEventListener('click', open);
        intro.classList.add('is-ready');
      }
    };
  })();

  function goInside() {
    document.body.classList.add('is-inside');
    html.classList.remove('is-sealed');
    try { sessionStorage.setItem(OPENED_KEY, '1'); } catch (_) {}
    setTimeout(() => { GL?.dispose(); GL = null; intro?.remove(); }, 1400);   // past .vault-intro's own 1.2s fade
  }

  /* ==========================================================
     THE GATE — the Vault's password (CONFIG.gate; wired by js/nav.js)
     Almost everyone has already typed it at the page pill, and walks
     straight in. This door is for a link that goes directly to this page.
     ========================================================== */
  function gate() {
    const el = $('[data-gate]');
    if (!el) return;
    if (window.kasVault.unlocked()) return el.remove();
    const input = window.kasVault.wire(el, () => {
      el.classList.add('is-open');
      setTimeout(() => el.remove(), 3600);   // past .gate's own 3.4s fade
    });
    input.focus();
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  fillRoom();

  let opened = false;
  try { opened = sessionStorage.getItem(OPENED_KEY) === '1'; } catch (_) {}

  if (opened) {
    /* already been through the door this session — straight into the room */
    intro?.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-inside')));
    gate();
  } else {
    html.classList.add('is-sealed');
    Door.init();
    gate();
  }
})();
