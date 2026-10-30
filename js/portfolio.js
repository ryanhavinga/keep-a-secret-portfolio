/* ============================================================
   KEEP A SECRET — PORTFOLIO (index.html — the landing page)
   The shelf · a cover pulled out into full view
   Content lives in js/config.js, under CONFIG.portfolio.
   ============================================================ */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
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
     THE LETTERING ON A SPINE — drawn once as a picture (title bold, artist thin, reading upwards, white). As a picture it is
     sharp at every size and wherever the cover is, as the artwork is; as live text in a layer that moves it was only drawn
     sharply once the cover had stopped, so the spine of a cover coming back into the row showed up blurry until it had arrived.
     ========================================================== */
  const letteringCache = new Map();
  function lettering(title, artist) {
    const key = title + '\u0001' + artist;
    if (letteringCache.has(key)) return letteringCache.get(key);
    const c = document.createElement('canvas'); c.width = 96; c.height = 1600;
    const x = c.getContext('2d');
    x.translate(48, 800); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.textAlign = 'left';
    if ('letterSpacing' in x) x.letterSpacing = '3px';
    const face = '"Helvetica Neue", Helvetica, Arial, sans-serif', gap = 26;
    /* the title is bold; a part of it in brackets, like "(Akoestisch)", is a step lighter */
    const m = title.match(/^(.*?)(\s*\([^)]*\))$/), main = m ? m[1] : title, extra = m ? m[2] : '';
    const heavy = `800 59px ${face}`, medium = `500 59px ${face}`, thin = `300 59px ${face}`;
    x.font = heavy; const wm = x.measureText(main).width;
    x.font = medium; const we = extra ? x.measureText(extra).width : 0;
    x.font = thin; const wa = x.measureText(artist).width;
    const start = -(wm + we + gap + wa) / 2;
    x.font = heavy; x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 2.2; x.lineJoin = 'round';
    x.strokeText(main, start, 0); x.fillText(main, start, 0);                          // (the same slight stroke the title always had)
    if (extra) { x.font = medium; x.lineWidth = 1; x.strokeText(extra, start + wm, 0); x.fillText(extra, start + wm, 0); }
    x.font = thin; x.fillStyle = 'rgba(255,255,255,.72)'; x.fillText(artist, start + wm + we + gap, 0);
    const url = c.toDataURL('image/png');
    letteringCache.set(key, url);
    return url;
  }

  /* ==========================================================
     THE SHELF
     ========================================================== */
  const shelf = $('[data-shelf]');
  const pfEl = $('[data-pf]');
  const floor = $('[data-floor]');
  /* One cover per track, and the set runs round again from the start until the row holds
     CONFIG.portfolio.fill covers. The extras are the same releases, so a click on any copy plays that release;
     only the first run is exposed to screen readers and the keyboard. */
  const T = tracks.length;
  const N = Math.max(T, Math.floor(PF.fill || T));
  const items = [];
  for (let i = 0; i < N; i++) {
    const t = tracks[i % T], ti = i % T, rep = Math.floor(i / T);
    const row = i - (N - 1) / 2;                           // its signed distance from the middle, in covers
    const side = row < 0 ? 'l' : 'r';                      // left of the middle: hinged on its left edge; right of it: on its right
    const li = document.createElement('li');
    li.className = `cd cd--${side}`;
    if (rep > 0) li.setAttribute('aria-hidden', 'true');
    li.innerHTML = `
      <div class="cd__btn" role="button" tabindex="${rep ? -1 : 0}" aria-label="Open ${esc(t.title)} by ${esc(t.artist)}">
        <div class="cd__bob">
          <img class="cd__face" src="${esc(t.artwork)}" alt="${rep ? '' : esc(t.title) + ' — artwork'}" decoding="async">
          <div class="cd__shade"></div>
          <div class="cd__edge"><img class="cd__lettering" src="${lettering(t.title, t.artist)}" alt="" decoding="async"></div>
        </div>
      </div>`;
    shelf.appendChild(li);
    /* its half of the ground: a pool of the cover's own colour and its spine's reflection,
       laid out like the cover itself (same place along the row, same turn) */
    const fl = document.createElement('div');
    fl.className = `fl cd--${side}`;
    fl.innerHTML = `<div class="fl__glow"></div><div class="fl__edge"></div>`;
    floor.appendChild(fl);
    const it = { ym: 0, zm: 0, lf: 0, li, fl, t, n: i, ti, rep, row, slot: i, pos: i, side, pose: 'slot', btn: $('.cd__btn', li), face: $('.cd__face', li), tint: tintOf(t, null) };
    paintTint(li, it.tint); paintTint(fl, it.tint);
    /* swap the configured colour for the real one as soon as the artwork has loaded */
    const real = () => { it.tint = tintOf(t, it.face); paintTint(li, it.tint); paintTint(fl, it.tint); };
    if (it.face.complete && it.face.naturalWidth) real(); else it.face.addEventListener('load', real, { once: true });
    /* Playing comes first. A click on a cover plays its track (the bar comes up); on the one that is already
       playing it opens the credits instead. */
    it.btn.addEventListener('click', () => {
      if (NP.has(it.ti) && !NP.isPlaying(it.ti)) {
        if (starting === it) return;                         // it is on its way out already
        pick = it;                                           // the copy that was clicked is the one that opens
        if (front === it) { NP.playTrack(it.ti); return; }   // already standing there (paused): just play
        setFront(it);
        starting = it;                                       // the music waits until the cover stands flat in front of you
        NP.hold(it.ti);                                      // started silently inside the click (browsers only allow audio from a click)…
        later(SETTLED, () => { if (starting !== it) return; starting = null; NP.release(); });   // …and heard from its start once the cover is flat
      } else Focus.open(it.n);
    });
    it.btn.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); it.btn.click(); } });
    items.push(it);
  }
  const veil = document.createElement('div');             // the soft-focus veil over the background (css: .shelf__veil)
  veil.className = 'shelf__veil'; veil.setAttribute('aria-hidden', 'true');
  shelf.appendChild(veil);
  if (PF.heading) $('[data-pf-heading]').textContent = PF.heading;
  pfEl.style.setProperty('--n', N);
  pfEl.toggleAttribute('data-odd', N % 2 === 1);

  /* the two small icons bottom left: shown only when CONFIG has a link for them */
  [['[data-instagram]', CONFIG.instagram && CONFIG.instagram.url], ['[data-spotify-playlist]', CONFIG.spotify && CONFIG.spotify.url]]
    .forEach(([sel, url]) => { const a = $(sel); if (a && url) { a.href = url; a.hidden = false; } });

  /* a CSS length custom property (--w, --p), in pixels */
  const probeEl = document.createElement('i');
  probeEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;';
  pfEl.appendChild(probeEl);
  const px = name => { probeEl.style.width = `var(${name})`; return probeEl.getBoundingClientRect().width; };
  const both = it => [it.li, it.fl];

  /* ---- the cover that is playing is pulled out of the stack ----
     The stack stays where it is, just stepping back a little, with a gap where the cover was. The cover
     slides straight out towards you with its spine first (pose 'pull'), then rises and turns smoothly and quickly to face
     you in the middle (pose 'flat'). The one it replaces turns back and slides home into its place. */
  const BACK = .28;                                        // how far the stack steps back, as a share of a cover's width
  const OUT = .2;                                          // how far a cover is slid out, spine first
  const hoverOn = matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced;
  const SWIPE = .55;                                       // how far up (share of its width) a cover swipes when it is put back
  const LIFT = .09;                                        // the cover that is out stands this much higher (a share of its width)
  let front = null;
  let wakeHover = () => {};                                // set below, where the hover spring lives
  let starting = null;                                     // the cover that has been clicked and is still coming out: its audio starts once it is flat
  const SETTLED = 900;                                     // ms from the click until it is flat (the slide out, then the turn)
  let pick = null;                                         // the copy of a release that was clicked (a release can be in the row twice)
  const timers = [];
  const later = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); };
  function setSide(it, side) {
    it.side = side;
    for (const el of both(it)) { el.classList.toggle('cd--l', side === 'l'); el.classList.toggle('cd--r', side === 'r'); }
  }
  function place() {
    const w = px('--w'), p = px('--p');
    items.forEach(it => {
      const row = it.slot - (N - 1) / 2;                      // its signed distance from the middle, in covers — where it stands NOW (the order changes when a cover is put back)
      const sideNow = row < 0 ? 'l' : 'r';
      if (it.side !== sideNow && it.pose !== 'pull' && it.pose !== 'flat' && it.pose !== 'swipe') {
        /* a cover that slides across the middle turns over to the other hinge once it is halfway across; one that is out of sight does so at once */
        if (it.pose === 'enter') setSide(it, sideNow);
        else if (!it.sideT) it.sideT = setTimeout(() => { it.sideT = 0; if (it.pose === 'slot') setSide(it, it.slot - (N - 1) / 2 < 0 ? 'l' : 'r'); }, 300);
      }
      let x = row * p, rot = 90, z = front ? -w * BACK : 0, zi = 20 - Math.round(Math.abs(row) * 2), ly = 0;
      if (it.pose === 'pull') { z = w * OUT; }                // sliding out: it keeps its place in the paint order, so its neighbours still cover it
      else if (it.pose === 'flat') { x = it.side === 'l' ? -w / 2 : w / 2; rot = 0; z = w * .05; zi = 40; }
      else if (it.pose === 'swipe') { x = it.side === 'l' ? -w / 2 : w / 2; rot = 0; z = w * .05; zi = 40; ly = -w * (LIFT + SWIPE); }   // being put back: swipes up, still facing you
      else if (it.pose === 'enter') { z -= w * .6; }        // …and is unseen in its slot again, far back, ready to come forward into it
      if (it.under) zi = 1;                                  // while it comes forward from the back it is behind every cover of the stack, never drawn over one
      if (!hoverOn && it.pose === 'flat') ly = -w * LIFT;   // (with a mouse the rise is eased in JS, in step with the hover lift going — see the frame loop)
      for (const el of both(it)) {
        el.style.setProperty('--x', `${x.toFixed(1)}px`);
        el.style.setProperty('--rot', `${rot}deg`);
        el.style.setProperty('--z', `${z.toFixed(1)}px`);
        el.classList.toggle('is-front', it.pose === 'flat' || it.pose === 'swipe');
        el.classList.toggle('is-rim', it.slot === 0 || it.slot === N - 1);         // the outermost two are softened
      }
      it.li.style.zIndex = String(zi);
      it.li.style.setProperty('--ly', `${ly.toFixed(1)}px`);
      it.pos = it.slot;
    });
  }
  place();
  addEventListener('resize', place);
  /* Putting a cover back: it swipes up and out as fast as the player bar sinks, fading with it (a flat cover is one plain
     picture, so it goes as one layer). Unseen, it is put far back in its own, empty place in the stack, blurred, and
     glides forward out of the back into it — slowing right down as it arrives, sharpening as it does, fading in.
     Nothing ever slides through its neighbours.
     (The covers do keep a `slot` each, so the row could be turned round — a cover put back at the far end, the others
     closing up — but that was tried and not wanted; every cover goes back to where it was.) */
  function sendHome(it) {
    clearTimeout(it.homeT); clearTimeout(it.seatT); clearTimeout(it.fadeT); clearTimeout(it.underT); it.under = false;
    const tok = it.tok = (it.tok || 0) + 1;
    for (const el of both(it)) el.classList.remove('is-entering', 'is-fading');
    it.li.classList.remove('is-hide');
    const flat = it.li.classList.contains('is-flat');
    it.pose = 'swipe'; place();
    it.li.classList.add('is-swiping');
    if (flat) it.li.classList.add('is-leaving');                                              // one layer: fades with the bar
    it.fadeT = setTimeout(() => {
      it.fl.classList.add('is-fading');                                                       // its light on the floor goes with it
      if (!flat) it.li.classList.add('is-fading');                                            // (not yet flat: its planes fade together instead)
    }, 50);
    it.homeT = setTimeout(() => {
      it.li.classList.remove('is-swiping', 'is-leaving', 'is-flat');
      it.li.classList.add('is-hide');                                                         // unseen, ready to come in
      for (const el of both(it)) el.classList.add('no-tr');
      it.pose = 'enter'; it.lf = 0; it.li.style.setProperty('--lf', '0'); place();      // far back in its place
      /* a few frames on (a timer, which also runs in a background tab), rather than forcing a layout in the middle of the animation */
      setTimeout(() => {
        if (it.tok !== tok) return;
        for (const el of both(it)) { el.classList.add('is-entering'); el.classList.remove('no-tr', 'is-fading'); }
        it.li.classList.remove('is-hide');                                                    // fades in, while …
        it.pose = 'slot'; place();                                                            // … gliding forward into its place
        it.seatT = setTimeout(() => { for (const el of both(it)) el.classList.remove('is-entering'); }, 800);
      }, 70);
    }, 540);                                               // (the swipe up and the fade out are done)
  }
  function setFront(f) {
    timers.splice(0).forEach(clearTimeout);
    starting = null;
    const prev = front;
    front = f;
    if (prev && prev !== f) sendHome(prev);
    html.classList.remove('bg-soft');                      // the background sharpens again…
    if (f) {
      clearTimeout(f.homeT); clearTimeout(f.seatT); clearTimeout(f.fadeT); clearTimeout(f.underT); f.under = false; f.tok = (f.tok || 0) + 1; for (const el of both(f)) el.classList.remove('is-fading', 'is-swiping', 'is-entering', 'is-leaving', 'is-flat', 'is-hide');
      f.pose = 'pull';                                     // spine first, out of the stack — still covered by its neighbours
      place();
      later(340, () => { f.pose = 'flat'; place(); });
      later(900, () => f.li.classList.add('is-flat'));         // the turn is done: from here on it is one plain picture
      later(950, () => html.classList.add('bg-soft'));         // the background only goes soft once the cover has settled, so the two never animate together   // once it is clear of its neighbours it comes in front, rises and turns to face you in one go — and the rest of the row goes slowly soft behind it
    }
    items.forEach(it => { if (it !== f && it !== prev && it.pose !== 'swipe' && it.pose !== 'enter') it.pose = 'slot'; });
    wakeHover();
  }
  /* of a track's copies in the row, the one nearest the middle comes out */
  const nearest = ti => items.filter(it => it.ti === ti).sort((a, b) => Math.abs(a.slot - (N - 1) / 2) - Math.abs(b.slot - (N - 1) / 2))[0];
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
        if (it.m !== m) { it.m = m; it.li.style.setProperty('--mag', m); it.fl.style.setProperty('--mag', m); }
        /* the cover that is pulled out gives up its hover lift and takes up the little zoom instead — eased,
           so nothing jumps at the moment it changes over */
        const pulled = it.pose === 'flat';                 // (until it turns, the hover lift stays, so it neither dips nor hops on its way out)
        const up = it.pose === 'flat' || it.pose === 'swipe' ? 1 : 0;   // the pulled-out cover stands higher
        const k = 1 - Math.exp(-9 * dt);
        /* the hover lift fades out while the standing height fades in, by the same curve, so a cover that was
           under the pointer when it was clicked keeps its height all the way — no dip, no hop */
        it.ym += ((pulled ? 0 : lift) - it.ym) * k;
        it.lf += (up - it.lf) * k;
        it.zm += ((pulled ? lift : 0) - it.zm) * k;
        if (Math.abs(it.ym - (pulled ? 0 : lift)) > .002 || Math.abs(it.zm - (pulled ? lift : 0)) > .002 || Math.abs(it.lf - up) > .002) busy = true;
        const ys = it.ym.toFixed(4), zs = it.zm.toFixed(4), ls = it.lf.toFixed(4);
        if (it.ys !== ys) { it.ys = ys; it.li.style.setProperty('--ym', ys); }
        if (it.zs !== zs) { it.zs = zs; it.li.style.setProperty('--zm', zs); }
        if (it.ls !== ls) { it.ls = ls; it.li.style.setProperty('--lf', ls); }
      });

      /* with a cover pulled out and playing the viewpoint stays still (it would turn the big cover with the pointer) */
      const gx = front ? 0 : tpx, gy = front ? 0 : tpy;
      pxv += (gx - pxv) * (1 - Math.exp(-5 * dt));
      pyv += (gy - pyv) * (1 - Math.exp(-5 * dt));
      if (Math.abs(gx - pxv) > .002 || Math.abs(gy - pyv) > .002) busy = true; else { pxv = gx; pyv = gy; }
      for (const el of [shelf, floor]) { el.style.setProperty('--px', pxv.toFixed(4)); el.style.setProperty('--py', pyv.toFixed(4)); }

      if (busy) requestAnimationFrame(frame); else running = false;
    };
    const wake = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
    wakeHover = wake;

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
    const idle = { has: () => false, playTrack() {}, hold() {}, release() {}, stop() {}, isPlaying: () => false, current: () => -1, live: () => false, onOpen: null };
    if (!el || !audio || !queue.length) { if (el) el.hidden = true; return idle; }

    const ui = {
      art: $('[data-np-art]', el), title: $('[data-np-title]', el), artist: $('[data-np-artist]', el),
      play: $('[data-np-play]', el), prev: $('[data-np-prev]', el), next: $('[data-np-next]', el),
      who: $('[data-np-open]', el), scrub: $('[data-np-scrub]', el), fill: $('[data-np-fill]', el),
      mid: $('[data-np-mid]', el), tscrub: $('[data-np-tscrub]', el), tfill: $('[data-np-tfill]', el),
      elapsed: $$('[data-np-elapsed]', el), total: $$('[data-np-total]', el)
    };
    let i = 0, loaded = -1, dragging = false;
    const api = { onOpen: null };

    /* the fader level the player left off at, so the loudness doesn't jump */
    let vol = .4;
    try { const sv = parseFloat(localStorage.getItem('kas-volume')); if (isFinite(sv)) vol = clamp(sv, 0, 1); } catch (_) {}
    audio.volume = vol;

    /* the speaker at the right end opens a vertical fader; same stored level as the player's */
    const volEl = $('.np__vol', el), volBtn = $('[data-np-vol]', el), vtrack = $('[data-np-vtrack]', el), vfill = $('[data-np-vfill]', el);
    /* As on the old player page: the fader taken down to nothing mutes, and any other level un-mutes; and a click on the
       speaker while the fader is open mutes or un-mutes (the level of the fader stays where it was). The native mute
       flag does it, so it works on iPhone too, where the volume itself can't be set. */
    let muted = false;
    const paintMute = () => {
      el.classList.toggle('is-muted', muted || vol === 0);
      volBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Volume');
    };
    function setMuted(next) {
      muted = next;
      audio.muted = muted;
      paintMute();
    }
    function setVol(v, save) {
      vol = clamp(v, 0, 1);
      audio.volume = vol;
      vfill.style.height = `${vol * 100}%`;
      vtrack.setAttribute('aria-valuenow', Math.round(vol * 100));
      muted = vol === 0;
      audio.muted = muted;
      paintMute();
      if (save) { try { localStorage.setItem('kas-volume', String(vol)); } catch (_) {} }
    }
    setVol(vol, false);
    const setOpen = on => { volEl.classList.toggle('is-open', on); volBtn.setAttribute('aria-expanded', String(on)); };
    volBtn.addEventListener('click', () => { if (!volEl.classList.contains('is-open')) setOpen(true); else setMuted(!muted); });
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
      ui.elapsed.forEach(e => { e.textContent = time(t); }); ui.total.forEach(e => { e.textContent = time(d); });
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
    /* every press on the thick timeline gives it, and the times with it, a quick swell and back — just for life */
    const timeFace = $('.np__time', el);
    let popping = null;
    const pop = () => {
      if (reduced || !timeFace.animate) return;
      /* a press in the middle of a swell carries on from the size it has reached, so rapid presses stay smooth */
      const from = parseFloat(getComputedStyle(timeFace).scale) || 1;
      if (popping) popping.cancel();
      popping = timeFace.animate([
        { scale: String(from), easing: 'cubic-bezier(.3, 0, .2, 1)' },
        { scale: '1.025', offset: .38, easing: 'cubic-bezier(.4, 0, .25, 1)' },
        { scale: '1' }
      ], { duration: 520 });
    };
    [ui.scrub, ui.tscrub].forEach(zone => {
      /* as on the player page: held from the press, and "scrubbing" (the fill follows the finger exactly)
         a beat later, so the first jump still eases */
      let hold = 0;
      zone.addEventListener('pointerdown', ev => { if (zone === ui.tscrub) pop(); dragging = true; zone.classList.add('is-held'); hold = setTimeout(() => dragging && zone.classList.add('is-scrubbing'), 90); try { zone.setPointerCapture(ev.pointerId); } catch (_) {} seek(zone, ev); });
      zone.addEventListener('pointermove', ev => { if (dragging && zone.hasPointerCapture(ev.pointerId)) seek(zone, ev); });
      const release = () => { dragging = false; clearTimeout(hold); zone.classList.remove('is-held', 'is-scrubbing'); if (!ui.mid.matches(':hover')) leaveTime(); };
      zone.addEventListener('pointerup', release);
      zone.addEventListener('pointercancel', release);
    });

    /* A little under half a second on the hairline brings up the thick timeline with the times in it, in a quick fade;
       leaving the middle sends it back down by the same fade played backwards (css/portfolio.css). */
    let enter = 0, leave = 0;
    const leaveTime = () => { clearTimeout(leave); leave = setTimeout(() => { if (!dragging) el.classList.remove('is-time'); }, 40); };
    ui.scrub.addEventListener('pointerenter', ev => {
      if (ev.pointerType !== 'mouse') return;
      clearTimeout(enter); clearTimeout(leave);
      enter = setTimeout(() => el.classList.add('is-time'), 380);
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
      /* stop altogether: back to the start, and the bar goes */
      stop() {
        audio.pause(); audio.muted = muted;
        try { audio.currentTime = 0; } catch (_) {}
        el.classList.remove('is-live', 'is-playing');
        paint(); changed();
      },
      isPlaying: ti => !audio.paused && queue[i].ti === ti,
      /* play this track, or pause it if it is the one already playing */
      playTrack(ti) {
        const n = queue.findIndex(q => q.ti === ti);
        if (n < 0) return;
        audio.muted = muted;
        if (n === i && loaded === i) toggle(); else load(n, true);
      },
      hold(ti) {
        const n = queue.findIndex(q => q.ti === ti);
        if (n < 0) return;
        audio.muted = true;
        load(n, true);
      },
      release() {
        try { audio.currentTime = 0; } catch (_) {}
        audio.muted = muted;                                // (heard again, unless the player itself was muted)
        if (audio.paused) audio.play().catch(() => {});
      }
    });
  })();

  /* The page pill at the top goes out of the way as soon as the mouse is on the covers — and is there again
     when the mouse is above or below them, unless a track is selected: then it stays away until the track is put
     back. (Only where there is a mouse to hover with.) */
  (function pillAway() {
    const pill = $('[data-seg]');
    if (!pill || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let lastY = -1, away = false;                    // until the mouse has moved, the pill is there
    const apply = () => {
      const rows = shelf.getBoundingClientRect();
      /* while a track is selected the pill stays away wherever the mouse is; it is only there again once the track is put back */
      const want = NP.live() || (lastY >= rows.top && lastY <= rows.bottom);
      if (want !== away) { away = want; pill.classList.toggle('is-away', away); }
    };
    addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') { lastY = ev.clientY; apply(); } }, { passive: true });
    document.addEventListener('np:change', apply);
  })();

  /* Put it back: the cover goes home into the stack, the music stops and the bar goes. A click on the empty
     space above or below the stack does it. */
  const putBack = () => { NP.stop(); pick = null; setFront(null); };
  document.addEventListener('click', ev => {
    if (!front && !NP.live()) return;
    if (html.classList.contains('is-focused')) return;
    if (ev.target.closest('.cd, .np, .seg, .socials, a, button, input, [role=slider], .focus')) return;      // (a click on a cover, by mouse or keyboard, is never "outside")
    const rows = shelf.getBoundingClientRect();
    if (ev.clientY < rows.top || ev.clientY > rows.bottom) putBack();
  });

  /* the track the bar is on comes to the front once something has been played */
  document.addEventListener('np:change', () => {
    html.classList.toggle('np-live', NP.live());
    if (starting) return;                                    // the bar can wait: the cover that was clicked is still on its way out
    if (!NP.live()) return;
    if (pick && pick.ti !== NP.current()) pick = null;       // the bar moved on to another release by itself
    const want = pick || nearest(NP.current());
    if (want && want !== front) setFront(want);
  });

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
      return { cx: f.left + f.width / 2, cy: f.top + f.height / 2, h: f.height, ry: items[n] === front && items[n].pose === 'flat' ? 0 : (items[n].side === 'l' ? 1 : -1) * 80 };
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
      const here = items[cur];
      const nextTi = mod(here.ti + dir, T);
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
