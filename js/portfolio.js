/* ============================================================
   KEEP A SECRET — PORTFOLIO (index.html — the landing page)
   The shelf · a cover pulled out into full view
   Content lives in js/config.js, under CONFIG.portfolio.
   ============================================================ */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;
  const PF = CONFIG.portfolio || {};
  const tracks = PF.tracks || [];
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = s => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  /* ==========================================================
     COLOUR — a tint per cover, for the shelf edge and its glow
     ========================================================== */
  function hexToHsl(hex) {
    const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16);
    return rgbToHsl(n >> 16 & 255, n >> 8 & 255, n & 255);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  /* the artwork's own colour: a vote across hue buckets, weighted towards
     what's saturated and neither black nor white — so a dark photo with one
     purple jacket gives purple, not grey */
  function dominant(img) {
    try {
      const N = 32, c = document.createElement('canvas');
      c.width = c.height = N;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const buckets = new Array(24).fill(0);
      for (let i = 0; i < d.length; i += 4) {
        const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        const w = s * s * (1 - Math.abs(l - .5) * 1.6);
        if (w > 0) buckets[Math.floor(h / 15) % 24] += w;
      }
      const best = buckets.indexOf(Math.max(...buckets));
      if (buckets[best] < .5) return null;
      return best * 15 + 7.5;
    } catch (_) { return null; }     // a tainted canvas (file://) — the configured colour is used instead
  }
  /* The spine colour comes from each track's own `color` in CONFIG, the same on every
     device. (Sampling the artwork instead only works when the page is served over http(s):
     opened from a file the canvas is blocked and the configured colours are used, so the live
     site came out more vivid than a local copy. Set this to true to sample the artwork again.) */
  const SAMPLE_ARTWORK = false;
  function tintOf(t, img) {
    const [fh, fs] = hexToHsl(t.color || '#444455');
    const h = SAMPLE_ARTWORK && img ? dominant(img) : null;
    const hue = h ?? fh;
    const yellowish = hue > 30 && hue < 75;
    return { h: Math.round(hue), s: clamp(Math.round((h == null ? fs : .72) * 100), 45, 82), l: yellowish ? 44 : 38 };
  }
  function paintTint(el, tint) {
    el.style.setProperty('--h', tint.h);
    el.style.setProperty('--s', tint.s);
    el.style.setProperty('--l', tint.l);
  }

  /* ==========================================================
     THE SHELF
     ========================================================== */
  const shelf = $('[data-shelf]');
  const pfEl = $('[data-pf]');
  const floor = $('[data-floor]');
  /* One cover per track, and the set runs round again from the start until
     the row holds CONFIG.portfolio.fill covers. The extras are the same
     releases, so a click on any copy opens that release; only the first run
     (rep 0) is exposed to screen readers and the keyboard. */
  const TOTAL = Math.max(tracks.length, Math.floor(PF.fill || tracks.length));
  const items = [];
  for (let i = 0; i < TOTAL; i++) {
    const t = tracks[i % tracks.length], ti = i % tracks.length, rep = Math.floor(i / tracks.length);
    const n = i;
    const li = document.createElement('li');
    li.className = 'cd';
    if (rep > 0) li.setAttribute('aria-hidden', 'true');
    li.innerHTML = `
      <div class="cd__btn" role="button" tabindex="${rep ? -1 : 0}" aria-label="Open ${esc(t.title)} by ${esc(t.artist)}">
        <div class="cd__bob">
          <img class="cd__face" src="${esc(t.artwork)}" alt="${rep ? '' : esc(t.title) + ' — artwork'}" decoding="async">
          <div class="cd__shade"></div>
          <div class="cd__edge"><span class="cd__play" data-play aria-hidden="true"><svg class="i-play" viewBox="0 0 24 24"><path d="M7 4.5 20 12 7 19.5Z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><rect x="5" y="4.5" width="5" height="15" rx="1.2"/><rect x="14" y="4.5" width="5" height="15" rx="1.2"/></svg></span><span class="cd__label"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></span><span class="cd__info" data-info aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2"/><circle class="dot" cx="12" cy="7.9" r=".6"/></svg></span></div>
        </div>
      </div>`;
    shelf.appendChild(li);
    /* its half of the ground: a pool of the cover's own colour and its spine's reflection,
       laid out like the cover itself (same place along the row, same turn) */
    const fl = document.createElement('div');
    fl.className = 'fl';
    fl.innerHTML = `<div class="fl__glow"></div><div class="fl__edge"></div>`;
    floor.appendChild(fl);
    /* pos: its place along the row */
    const it = { li, fl, t, n, ti, rep, pos: n, k: 0, side: 'r', btn: $('.cd__btn', li), face: $('.cd__face', li), tint: tintOf(t, null) };
    paintTint(li, it.tint); paintTint(fl, it.tint);
    /* swap the configured colour for the real one as soon as the artwork has loaded */
    const real = () => { it.tint = tintOf(t, it.face); paintTint(li, it.tint); paintTint(fl, it.tint); };
    if (it.face.complete && it.face.naturalWidth) real(); else it.face.addEventListener('load', real, { once: true });
    /* Playing comes first. A click on a cover plays its track (the bar comes up); on the one that is already
       playing it opens the credits instead. The symbols on the spine are the explicit ways: play / pause at
       the top, the credits ("i") at the bottom. */
    it.btn.addEventListener('click', ev => {
      if (ev.target.closest('[data-info]')) { Focus.open(n); return; }
      if (ev.target.closest('[data-play]')) { NP.playTrack(it.ti); return; }
      if (NP.has(it.ti) && !NP.isPlaying(it.ti)) NP.playTrack(it.ti); else Focus.open(n);
    });
    it.btn.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); it.btn.click(); } });
    items.push(it);
  }
  if (PF.heading) $('[data-pf-heading]').textContent = PF.heading;

  /* the two small icons bottom left: shown only when CONFIG has a link for them */
  [['[data-instagram]', CONFIG.instagram && CONFIG.instagram.url], ['[data-spotify-playlist]', CONFIG.spotify && CONFIG.spotify.url]]
    .forEach(([sel, url]) => { const a = $(sel); if (a && url) { a.href = url; a.hidden = false; } });

  /* Lay the covers out along the row, centred: each gets its signed distance
     from the middle (k), which side of it that puts it on (the left ones face
     right, the right ones face left), and the row sizes itself from how many
     there are (--n → --w, --p in css/portfolio.css). */
  function layout() {
    const cnt = items.length;
    pfEl.style.setProperty('--n', Math.max(1, cnt));
    pfEl.toggleAttribute('data-odd', cnt % 2 === 1);
    items.forEach(it => {
      it.k = it.pos - (cnt - 1) / 2;
      it.side = it.k < 0 ? 'l' : 'r';
      it.li.classList.toggle('cd--l', it.side === 'l');
      it.li.classList.toggle('cd--r', it.side === 'r');
      it.li.classList.toggle('is-rim', cnt >= 3 && (it.pos === 0 || it.pos === cnt - 1));   // the outermost two are softened
      it.fl.classList.toggle('cd--l', it.side === 'l');
      it.fl.classList.toggle('cd--r', it.side === 'r');
      it.fl.classList.toggle('is-rim', it.li.classList.contains('is-rim'));
      it.fl.style.setProperty('--k', it.k);
      it.li.style.setProperty('--k', it.k);
      it.li.style.zIndex = String(20 - Math.round(Math.abs(it.k) * 2));   // nearer the middle is drawn on top
    });
  }
  layout();
  /* the first layout places the covers, it doesn't fly them in from where they were created */
  items.forEach(it => { it.li.classList.add('no-tr'); it.fl.classList.add('no-tr'); });
  const settle = () => items.forEach(it => { it.li.classList.remove('no-tr'); it.fl.classList.remove('no-tr'); });
  requestAnimationFrame(() => requestAnimationFrame(settle));
  setTimeout(settle, 150);

  /* ----------------------------------------------------------
     Hovering: the cover under the pointer lifts to the full height, the one
     on either side of it rises to the same, lower height, and the next one
     out on each side just a touch — an arch of five, nothing beyond. Every cover follows its target
     with the same critically damped spring, so a sweep along the row
     rolls through as one smooth wave. Mouse and trackpad only.
     ---------------------------------------------------------- */
  const hoverable = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (hoverable && !reduced) {
    const mags = items.map(() => 0);          // each cover's lift, 0..1
    const vels = items.map(() => 0);
    let hover = null, running = false, last = 0;
    /* the viewpoint drifts with the pointer, so the whole row seems to turn a little towards it */
    let tpx = 0, tpy = 0, pxv = 0, pyv = 0;
    const REACH = [1, .36, .1];               // lift by distance from the pointer: the one under it, the pair beside it, the pair beyond — an arch of five
    /* The wave. Every cover follows its target with a spring that is a hair
       under critically damped, so it swings a touch past its height and settles
       back — alive, not mechanical. Letting go is slower than lifting, so the
       covers the pointer has left trail off behind it. A fast sweep lifts the
       row a little less than a slow one. */
    const UP = 20, DOWN = 14.5, ZETA = .8;    // spring stiffness going up and coming down, and its damping
    const HASTE = .22;                        // how much a fast sweep lowers the peak (0 = not at all)
    let pSpeed = 0, spd = 0;                  // the pointer's speed along the row (px/ms), and a smoothed 0..1 of it

    const frame = now => {
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      const off = html.classList.contains('is-focused');
      const hp = hover && !off ? hover.pos : -1;
      pSpeed *= Math.exp(-7 * dt);
      spd += (Math.min(1, pSpeed / 2.2) - spd) * (1 - Math.exp(-8 * dt));
      const gain = 1 - HASTE * spd;
      const steps = Math.max(1, Math.ceil(dt / .004)), h = dt / steps;
      let busy = spd > .01 || pSpeed > .01;
      items.forEach((it, n) => {
        const dist = hp < 0 ? 9 : Math.abs(it.pos - hp);
        const target = (REACH[dist] || 0) * gain;
        const w0 = target < mags[n] - .0005 ? DOWN : UP;
        let x = mags[n], v = vels[n];
        for (let i = 0; i < steps; i++) {
          v += (w0 * w0 * (target - x) - 2 * ZETA * w0 * v) * h;
          x += v * h;
        }
        mags[n] = x; vels[n] = v;
        if (Math.abs(x - target) > .001 || Math.abs(v) > .01) busy = true;
        else { mags[n] = target; vels[n] = 0; }
        const lift = Math.max(0, mags[n]);
        const m = lift.toFixed(4);
        it.li.style.setProperty('--mag', m); it.fl.style.setProperty('--mag', m);
      });

      pxv += (tpx - pxv) * (1 - Math.exp(-5 * dt));
      pyv += (tpy - pyv) * (1 - Math.exp(-5 * dt));
      if (Math.abs(tpx - pxv) > .002 || Math.abs(tpy - pyv) > .002) busy = true; else { pxv = tpx; pyv = tpy; }
      for (const el of [shelf, floor]) { el.style.setProperty('--px', pxv.toFixed(4)); el.style.setProperty('--py', pyv.toFixed(4)); }

      if (busy) requestAnimationFrame(frame); else running = false;
    };
    const wake = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };

    /* Any part of a cover — its artwork or its spine — lifts it, and the
       gaps between covers belong to the nearest one, so sliding along the row
       hands the lift from one cover to the next without ever letting go — and
       out in the empty space beside a short row (an artist's page) the outermost
       cover simply keeps the lift. Only leaving the row's height lowers them
       (after a short grace). */
    let letGo = 0;
    function nearest(ev) {
      const row = shelf.getBoundingClientRect();
      if (ev.clientY < row.top - 100 || ev.clientY > row.bottom) return null;
      let best = null, bd = Infinity;                        // however far out: the outermost cover keeps the lift
      for (const x of items) {
        const a = x.face.getBoundingClientRect(), b = $('.cd__edge', x.li).getBoundingClientRect();
        const l = Math.min(a.left, b.left), r = Math.max(a.right, b.right);
        const d = ev.clientX < l ? l - ev.clientX : ev.clientX > r ? ev.clientX - r : 0;
        if (d < bd || (d === bd && best && Math.abs(ev.clientX - (l + r) / 2) < Math.abs(ev.clientX - best.c))) { bd = d; best = x; best.c = (l + r) / 2; }
      }
      return best;
    }
    /* Nothing reacts to the pointer until it has really moved on this page. After you click
       a link on another page the pointer is still sitting where you clicked, and the browser
       reports it again once this page appears — that must not set the wave (or the viewpoint)
       off; only an actual movement of a few pixels from there does. */
    let armed = false, ax = null, ay = 0;
    addEventListener('pointermove', ev => {
      if (armed || ev.pointerType === 'touch') return;
      if (ax === null) { ax = ev.clientX; ay = ev.clientY; return; }
      if (Math.abs(ev.clientX - ax) + Math.abs(ev.clientY - ay) > 12) armed = true;
    }, { capture: true, passive: true });
    addEventListener('pointerdown', () => { armed = true; }, { capture: true, passive: true });

    let px0 = 0, pt0 = 0;
    shelf.addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch' || !armed) return;
      if (pt0) pSpeed = Math.abs(ev.clientX - px0) / Math.max(1, ev.timeStamp - pt0);
      px0 = ev.clientX; pt0 = ev.timeStamp;
      const li = ev.target.closest && ev.target.closest('.cd');
      const it = (li && items.find(x => x.li === li)) || nearest(ev);
      if (it) {
        clearTimeout(letGo); letGo = 0;
        if (it !== hover) { hover = it; wake(); }
      } else if (hover && !letGo) {
        letGo = setTimeout(() => { hover = null; letGo = 0; wake(); }, 140);
      }
    });
    addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch' || !armed) return;
      tpx = clamp(ev.clientX / innerWidth * 2 - 1, -1, 1); tpy = clamp(ev.clientY / innerHeight * 2 - 1, -1, 1); wake();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { tpx = tpy = 0; wake(); });
    shelf.addEventListener('pointerleave', () => { clearTimeout(letGo); letGo = 0; if (hover) { hover = null; wake(); } });
    addEventListener('blur', () => { if (hover) { hover = null; wake(); } });
  }

  /* ==========================================================
     NOW PLAYING — the glass bar at the foot of the shelf
     Plays the tracks in CONFIG.portfolio that have audio, in shelf order, one
     after the next. Nothing starts by itself: it waits, on the first track,
     for play. Opening a cover's credits has a Play button for that track.
     ========================================================== */
  const NP = (() => {
    const el = $('[data-np]'), audio = $('[data-np-audio]');
    const queue = tracks.map((t, ti) => ({ t, ti })).filter(q => q.t.audio);
    const idle = { has: () => false, playTrack() {}, isPlaying: () => false, current: () => -1, live: () => false, onOpen: null };
    if (!el || !audio || !queue.length) { if (el) el.hidden = true; return idle; }

    const ui = {
      art: $('[data-np-art]', el), title: $('[data-np-title]', el), artist: $('[data-np-artist]', el),
      play: $('[data-np-play]', el), prev: $('[data-np-prev]', el), next: $('[data-np-next]', el),
      who: $('[data-np-open]', el), scrub: $('[data-np-scrub]', el), fill: $('[data-np-fill]', el),
      mid: $('[data-np-mid]', el), tscrub: $('[data-np-tscrub]', el), tfill: $('[data-np-tfill]', el),
      elapsed: $('[data-np-elapsed]', el), total: $('[data-np-total]', el)
    };
    let i = 0, loaded = -1, dragging = false;
    const api = { onOpen: null };

    /* the fader level the player left off at, so the loudness doesn't jump */
    let vol = .4;
    try { const sv = parseFloat(localStorage.getItem('kas-volume')); if (isFinite(sv)) vol = clamp(sv, 0, 1); } catch (_) {}
    audio.volume = vol;

    /* the speaker at the right end opens a vertical fader; same stored level as the player's */
    const volEl = $('.np__vol', el), volBtn = $('[data-np-vol]', el), vtrack = $('[data-np-vtrack]', el), vfill = $('[data-np-vfill]', el);
    function setVol(v, save) {
      vol = clamp(v, 0, 1);
      audio.volume = vol;
      vfill.style.height = `${vol * 100}%`;
      vtrack.setAttribute('aria-valuenow', Math.round(vol * 100));
      el.classList.toggle('is-muted', vol === 0);
      if (save) { try { localStorage.setItem('kas-volume', String(vol)); } catch (_) {} }
    }
    setVol(vol, false);
    const setOpen = on => { volEl.classList.toggle('is-open', on); volBtn.setAttribute('aria-expanded', String(on)); };
    volBtn.addEventListener('click', () => setOpen(!volEl.classList.contains('is-open')));
    document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.np__vol')) setOpen(false); });
    const fromY = ev => { const r = vtrack.getBoundingClientRect(); setVol(1 - (ev.clientY - r.top) / r.height, true); };
    let vdrag = false;
    vtrack.addEventListener('pointerdown', ev => { vdrag = true; try { vtrack.setPointerCapture(ev.pointerId); } catch (_) {} fromY(ev); });
    vtrack.addEventListener('pointermove', ev => { if (vdrag) fromY(ev); });
    vtrack.addEventListener('pointerup', () => { vdrag = false; });
    vtrack.addEventListener('pointercancel', () => { vdrag = false; });
    vtrack.addEventListener('keydown', ev => {
      const d = { ArrowUp: .05, ArrowRight: .05, ArrowDown: -.05, ArrowLeft: -.05 }[ev.key];
      if (d === undefined) { if (ev.key === 'Escape') { setOpen(false); volBtn.focus(); } return; }
      ev.preventDefault(); ev.stopPropagation(); setVol(vol + d, true);
    });

    const len = () => (isFinite(audio.duration) && audio.duration) || queue[i].t.duration || 0;
    const changed = () => document.dispatchEvent(new CustomEvent('np:change'));
    function paint() {
      const d = len(), t = loaded === i ? audio.currentTime || 0 : 0;
      const pct = d ? Math.min(100, t / d * 100) : 0;
      ui.fill.style.width = ui.tfill.style.width = `${pct}%`;
      ui.scrub.setAttribute('aria-valuenow', Math.round(pct));
      ui.elapsed.textContent = time(t); ui.total.textContent = time(d);
    }
    function show() {
      const { t } = queue[i];
      ui.art.src = t.artwork; ui.art.alt = `${t.title} — artwork`;
      ui.title.textContent = t.title; ui.artist.textContent = t.artist;
      ui.who.setAttribute('aria-label', `Show credits for ${t.title}`);
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: [{ src: t.artwork }] });
      }
      paint(); changed();
    }
    /* Seeking needs a source the browser can jump around in. A host that serves
       the file with byte ranges (Cloudflare does) is; a plain dev server isn't, and
       there the playhead snaps back. So when a jump is asked for beyond what is
       seekable, the track is fetched once into memory and the element moves onto
       that copy, keeping the playhead and the play state. */
    const copies = new Map();
    const canJump = t => { try { return audio.seekable.length > 0 && audio.seekable.end(audio.seekable.length - 1) >= t - .5; } catch (_) { return false; } };
    function jump(t) {
      t = clamp(t, 0, len());
      if (loaded < 0 || canJump(t)) { audio.currentTime = t; paint(); return; }
      const n = loaded;
      const apply = url => {
        if (loaded !== n) return;
        const was = !audio.paused;
        if (audio.src !== url) {
          audio.src = url;
          audio.addEventListener('loadedmetadata', () => { audio.currentTime = t; paint(); if (was) audio.play().catch(() => {}); }, { once: true });
        } else { audio.currentTime = t; paint(); }
      };
      if (copies.has(n)) return apply(copies.get(n));
      fetch(queue[n].t.audio).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); copies.set(n, u); apply(u); }).catch(() => { audio.currentTime = t; });
    }

    function load(n, go) {
      i = (n + queue.length) % queue.length;
      show();
      if (loaded !== i) { audio.src = copies.get(i) || queue[i].t.audio; loaded = i; paint(); }
      if (go) audio.play().catch(() => {});
    }
    function toggle() {
      if (loaded !== i) load(i, true);
      else if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    }
    const prev = () => { if (loaded === i && audio.currentTime > 3) { audio.currentTime = 0; paint(); } else load(i - 1, !audio.paused); };
    const next = () => load(i + 1, !audio.paused);

    /* The bar steps down out of the way as soon as the mouse is below the covers — anywhere under them, not
       only under the bar itself — and comes back up when the mouse is on the covers again. Straight above the
       bar, on the way down to it, it stays put. */
    let tucked = false;
    const sync = () => {
      el.classList.toggle('is-tucked', tucked);
    };
    document.addEventListener('pointermove', ev => {
      if (ev.pointerType !== 'mouse' || tucked) return;
      if (ev.clientY < shelf.getBoundingClientRect().bottom) return;     // still on the covers' rows
      /* where the bar rests, not where it happens to be mid-slide */
      const rest = { l: (innerWidth - el.offsetWidth) / 2, b: innerHeight - (parseFloat(getComputedStyle(el).bottom) || 0) };
      const overBar = ev.clientX >= rest.l && ev.clientX <= rest.l + el.offsetWidth && ev.clientY <= rest.b;
      if (!overBar) { tucked = true; sync(); }
    }, { passive: true });
    shelf.addEventListener('pointerover', ev => {
      if (ev.pointerType === 'mouse' && tucked && ev.target.closest && ev.target.closest('.cd')) { tucked = false; sync(); }
    });
    document.addEventListener('np:change', sync);

    ui.play.addEventListener('click', toggle);
    ui.prev.addEventListener('click', prev);
    ui.next.addEventListener('click', next);
    ui.who.addEventListener('click', () => api.onOpen && api.onOpen(queue[i].ti));
    audio.addEventListener('play',  () => { el.classList.add('is-live', 'is-playing');    ui.play.setAttribute('aria-label', 'Pause'); changed(); });
    audio.addEventListener('pause', () => { el.classList.remove('is-playing'); ui.play.setAttribute('aria-label', 'Play');  changed(); });
    audio.addEventListener('timeupdate', () => !dragging && paint());
    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('ended', () => load(i + 1, true));   // on to the next, round to the first at the end
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('previoustrack', prev);
        navigator.mediaSession.setActionHandler('nexttrack', next);
      } catch (_) {}
    }

    /* the timeline — the hairline, and the thick one that replaces it while hovered: tap or drag along either */
    const seek = (zone, ev) => {
      const r = zone.getBoundingClientRect();
      const ratio = clamp((ev.clientX - r.left) / r.width, 0, 1);
      if (loaded !== i) load(i, true);
      const go = () => jump(ratio * len());
      if (isFinite(audio.duration) && audio.duration) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
    };
    [ui.scrub, ui.tscrub].forEach(zone => {
      /* as on the player page: held from the press, and "scrubbing" (the fill follows the finger exactly)
         a beat later, so the first jump still eases */
      let hold = 0;
      zone.addEventListener('pointerdown', ev => { dragging = true; zone.classList.add('is-held'); hold = setTimeout(() => dragging && zone.classList.add('is-scrubbing'), 90); try { zone.setPointerCapture(ev.pointerId); } catch (_) {} seek(zone, ev); });
      zone.addEventListener('pointermove', ev => { if (dragging && zone.hasPointerCapture(ev.pointerId)) seek(zone, ev); });
      const release = () => { dragging = false; clearTimeout(hold); zone.classList.remove('is-held', 'is-scrubbing'); if (!ui.mid.matches(':hover')) leaveTime(); };
      zone.addEventListener('pointerup', release);
      zone.addEventListener('pointercancel', release);
    });

    /* Half a second on the hairline brings up the times and the thick timeline; leaving the
       middle sends them away again after a beat — each at the same slow pace (css/portfolio.css). */
    let enter = 0, leave = 0;
    const leaveTime = () => { clearTimeout(leave); leave = setTimeout(() => { if (!dragging) el.classList.remove('is-time'); }, 250); };
    ui.scrub.addEventListener('pointerenter', ev => {
      if (ev.pointerType !== 'mouse') return;
      clearTimeout(enter); clearTimeout(leave);
      enter = setTimeout(() => el.classList.add('is-time'), 500);
    });
    ui.scrub.addEventListener('pointerleave', () => clearTimeout(enter));
    ui.mid.addEventListener('pointerenter', () => clearTimeout(leave));
    ui.mid.addEventListener('pointerleave', () => { clearTimeout(enter); if (el.classList.contains('is-time')) leaveTime(); });
    ui.scrub.addEventListener('keydown', ev => {
      if (loaded !== i || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      ev.preventDefault(); ev.stopPropagation();
      jump(audio.currentTime + (ev.key === 'ArrowRight' ? 5 : -5));
    });
    /* space plays or pauses, unless something that takes space itself has the focus or a cover is pulled out */
    document.addEventListener('keydown', ev => {
      if (ev.code !== 'Space' || html.classList.contains('is-focused') || ev.target.closest('a, button, input, [role=slider], [role=button]')) return;
      ev.preventDefault(); toggle();
    });

    load(0, false);
    return Object.assign(api, {
      has: ti => queue.some(q => q.ti === ti),
      current: () => queue[i].ti,
      live: () => el.classList.contains('is-live'),
      isPlaying: ti => !audio.paused && queue[i].ti === ti,
      /* play this track, or pause it if it is the one already playing */
      playTrack(ti) {
        const n = queue.findIndex(q => q.ti === ti);
        if (n < 0) return;
        if (n === i && loaded === i) toggle(); else load(n, true);
      }
    });
  })();

  /* the covers whose track the bar can play get the play symbol; once something has been played, the one the
     bar is on keeps its symbol up (pause bars while it plays) */
  items.forEach(it => it.li.classList.toggle('has-audio', NP.has(it.ti)));
  const markNow = () => items.forEach(it => {
    it.li.classList.toggle('is-now', NP.live() && NP.current() === it.ti);   // marked only once something has been played
    it.li.classList.toggle('is-playing', NP.isPlaying(it.ti));
  });
  document.addEventListener('np:change', markNow);
  markNow();

  /* ==========================================================
     THE FOCUS VIEW — a cover pulled out of the shelf
     ========================================================== */
  const Focus = (() => {
    const el = $('[data-focus]');
    const card = $('[data-card]'), cardImg = $('[data-card-img]');
    const audio = $('[data-audio]');
    /* listening is in the bar at the foot of the page; this view is the credits. CONFIG.portfolio.listen = true brings a play button and timeline of its own back here. */
    const LISTEN = PF.listen === true;
    const q = s => $(s, el);
    const ui = {
      info: q('[data-info]'), credits: q('[data-credits]'), creditLine: q('[data-credit-line]'),
      spotify: q('[data-spotify]'), apple: q('[data-apple]'),
      title: q('[data-title]'), artist: q('[data-artist]'),
      year: q('[data-year]'), note: q('[data-note]'), links: q('[data-links]'),
      player: q('[data-player]'), play: q('[data-play]'), scrub: q('[data-scrub]'),
      fill: q('[data-fill]'), time: q('[data-time]')
    };
    let cur = -1, anim = null, fadeAnim = null, busy = false, dragging = false;
    const DUR = reduced ? 1 : 760;

    /* the fader level the player left off at, so the loudness doesn't jump */
    let vol = .4;
    try {
      const sv = parseFloat(localStorage.getItem('kas-volume'));
      if (isFinite(sv)) vol = clamp(sv, 0, 1);
    } catch (_) {}
    audio.volume = vol;

    /* where a cover sits on screen right now, as a pose the big card can
       start from (or return to) */
    function pose(n) {
      const f = items[n].face.getBoundingClientRect();
      /* left covers face right, right covers face left: the big card starts
         turned the same way, standing on edge */
      return { cx: f.left + f.width / 2, cy: f.top + f.height / 2, h: f.height, ry: (items[n].side === 'l' ? 1 : -1) * 80 };
    }
    function frames(n) {
      const to = card.getBoundingClientRect();           // untransformed: its place in the layout
      const from = pose(n);
      const dx = from.cx - (to.left + to.width / 2);
      const dy = from.cy - (to.top + to.height / 2);
      const s0 = clamp(from.h / to.height, .15, 1);
      const tf = (x, y, ry, s, z = 0) => `translate(${x}px, ${y}px) translateZ(${z}px) rotateY(${ry}deg) scale(${s})`;
      /* One continuous move: out of the row, round toward you, up to face
         you. No easing between the keyframes — the whole path shares the one
         curve set on the animation, so it never pauses or changes pace
         partway. The middle keyframe is only a point the path passes
         through (a little forward of the row, half turned). */
      return [
        { transform: tf(dx, dy, from.ry, s0) },
        { transform: tf(dx * .45, dy * .45, from.ry * .5, s0 + (1 - s0) * .5, 70), offset: .5 },
        { transform: tf(0, 0, 0, 1) }
      ];
    }

    function fillInfo(n) {
      const it = items[n], t = it.t;
      ui.title.textContent = t.title;
      ui.artist.textContent = t.artist;
      ui.year.textContent = t.year || ''; ui.year.hidden = !t.year;
      ui.note.textContent = t.note || '';  ui.note.hidden = !t.note;
      ui.links.innerHTML = (t.links || []).map(l =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`).join('');
      /* credits for every track — its own when CONFIG gives them, otherwise the two we always know (and the one-line credit below is then redundant) */
      const cr = t.credits || (PF.creditsByArtist || {})[t.artist] || [
        { heading: 'Production & Engineering', people: [{ name: (CONFIG.brand && CONFIG.brand.logo) || 'Keep A Secret', role: 'Producer' }] }
      ];
      ui.credits.hidden = !cr.length;
      ui.credits.innerHTML = cr.map(sec => `<h3>${esc(sec.heading)}</h3>` + sec.people.map(p =>
        `<p class="focus__who">${esc(p.name)}<span>${esc(p.role)}</span></p>`).join('')).join('');
      ui.creditLine.hidden = !!cr.length;
      ui.info.scrollTop = 0;
      const find = encodeURIComponent(`${t.title} ${t.artist}`);
      ui.spotify.href = t.spotify || `https://open.spotify.com/search/${find}`;
      ui.apple.href = t.apple || `https://music.apple.com/search?term=${find}`;
      cardImg.src = t.artwork;
      cardImg.alt = `${t.title} — artwork`;
      el.style.setProperty('--h', it.tint.h);
      el.style.setProperty('--s', it.tint.s);
      ui.player.hidden = !(LISTEN && t.audio);
      stopAudio();
      if (LISTEN && t.audio) { audio.src = t.audio; paint(); }
    }

    const EASE_OPEN = 'cubic-bezier(.22, .78, .22, 1)';   // fast out of the row, settling softly into place
    const FADE = 150;                                      // ms: the big card fading in over the cover it replaces

    function open(n) {
      if (busy || cur !== -1) return;
      busy = true; cur = n;
      fillInfo(n);

      /* Everything is set up while the overlay is still invisible, so that
         the first frame anyone sees already has the card at its starting
         place over the cover it came from — no frame at the end position,
         no waiting on a requestAnimationFrame. */
      el.style.visibility = 'hidden';
      el.hidden = false;
      html.classList.add('is-focused');
      const f = frames(n);                                 // measures (forces layout) while hidden
      anim = card.animate(f, { duration: DUR, easing: EASE_OPEN, fill: 'both' });
      const fade = fadeAnim = card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 1 : FADE, easing: 'ease-out', fill: 'both' });
      items[n].li.classList.add('is-out');
      el.style.visibility = '';
      void el.offsetWidth;                                 // so the veil and the info transition in rather than appearing
      el.classList.add('is-open');
      anim.onfinish = () => { anim.cancel(); fade.cancel(); anim = fadeAnim = null; busy = false; };
    }

    /* Closing is a short, quiet fade: the panel, the cover and the veil ease out
       together (the cover just settling back a hair) over the shelf, whose cover is
       already back in its slot underneath. No flight back into the row. */
    let closing = false;
    function close() {
      if (cur === -1 || closing) return;
      closing = true; busy = true;
      stopAudio();
      anim?.cancel(); fadeAnim?.cancel(); anim = fadeAnim = null;
      const n = cur, dur = reduced ? 1 : 260;
      el.classList.add('is-closing');
      el.classList.remove('is-open');
      items[n].li.classList.remove('is-out');
      const out = card.animate([
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'scale(.985)' }
      ], { duration: dur, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' });
      setTimeout(() => {
        out.cancel();
        el.hidden = true;
        el.classList.remove('is-closing');
        html.classList.remove('is-focused');
        cur = -1; busy = false; closing = false;
      }, dur);
    }

    /* previous / next while a cover is out: the shelf slot swaps over and
       the new cover comes in from the side */
    function step(dir) {
      if (busy || cur === -1) return;
      /* on to the next release; of its copies on show, the one nearest to
         where we are, so closing lands on a slot close by */
      const uniq = items.filter(x => x.rep === 0);
      const here = items[cur];
      const nextTi = uniq[(uniq.findIndex(x => x.ti === here.ti) + dir + uniq.length) % uniq.length].ti;
      const n = items.filter(x => x.ti === nextTi).sort((a, b) => Math.abs(a.pos - here.pos) - Math.abs(b.pos - here.pos))[0].n;
      busy = true;
      items[cur].li.classList.remove('is-out');
      items[n].li.classList.add('is-out');
      cur = n;
      fillInfo(n);
      anim = card.animate([
        { opacity: 0, transform: `translateX(${dir * 70}px) scale(.96)` },
        { opacity: 1, transform: 'none' }
      ], { duration: reduced ? 1 : 380, easing: 'cubic-bezier(.16, .9, .26, 1)', fill: 'both' });
      anim.onfinish = () => { anim.cancel(); anim = null; busy = false; };
    }

    /* ---- the track's own player, when it has audio ---- */
    const len = () => (isFinite(audio.duration) && audio.duration) || items[cur]?.t.duration || 0;
    function paint() {
      const d = len(), t = audio.currentTime || 0;
      const pct = d ? Math.min(100, t / d * 100) : 0;
      ui.fill.style.width = `${pct}%`;
      ui.scrub.setAttribute('aria-valuenow', Math.round(pct));
      ui.time.textContent = t > 0 || !audio.paused ? time(t) : time(d);
    }
    function stopAudio() {
      audio.pause();
      el.classList.remove('is-playing');
      ui.fill.style.width = '0%';
    }
    ui.play.addEventListener('click', () => {
      if (cur === -1 || !LISTEN || !items[cur].t.audio) return;
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    });
    audio.addEventListener('play',  () => { el.classList.add('is-playing'); ui.play.setAttribute('aria-label', 'Pause'); });
    audio.addEventListener('pause', () => { el.classList.remove('is-playing'); ui.play.setAttribute('aria-label', 'Play'); });
    audio.addEventListener('timeupdate', () => !dragging && paint());
    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });

    const seek = ev => {
      const r = ui.scrub.getBoundingClientRect();
      const ratio = clamp((ev.clientX - r.left) / r.width, 0, 1);
      if (audio.paused) audio.play().catch(() => {});
      const go = () => jump(ratio * len());
      if (isFinite(audio.duration) && audio.duration) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
    };
    ui.scrub.addEventListener('pointerdown', ev => {
      dragging = true; ui.scrub.classList.add('is-held'); ui.scrub.setPointerCapture(ev.pointerId); seek(ev);
      setTimeout(() => dragging && ui.scrub.classList.add('is-scrubbing'), 90);
    });
    ui.scrub.addEventListener('pointermove', ev => { if (dragging && ui.scrub.hasPointerCapture(ev.pointerId)) seek(ev); });
    const release = () => { dragging = false; ui.scrub.classList.remove('is-held', 'is-scrubbing'); };
    ui.scrub.addEventListener('pointerup', release);
    ui.scrub.addEventListener('pointercancel', release);

    /* ---- ways out and along ---- */
    $('[data-close]', el).addEventListener('click', close);
    $('[data-veil]', el).addEventListener('click', close);
    $('[data-prev]', el).addEventListener('click', () => step(-1));
    $('[data-next]', el).addEventListener('click', () => step(1));
    document.addEventListener('keydown', ev => {
      if (cur === -1) return;
      if (ev.key === 'Escape') close();
      else if (ev.key === 'ArrowLeft') step(-1);
      else if (ev.key === 'ArrowRight') step(1);
      else if (ev.code === 'Space' && LISTEN && items[cur].t.audio && !ev.target.closest('a, button, [role=slider]')) {
        ev.preventDefault(); ui.play.click();
      }
    });
    /* a resize would strand the card mid-flight against a layout that has
       changed under it; simply put it away */
    addEventListener('resize', () => { if (cur !== -1 && !busy) close(); });

    return { open };
  })();

  /* the bar's title and artwork open that track's credits */
  NP.onOpen = ti => Focus.open(ti);
})();
