/* ============================================================
   KEEP A SECRET — CENTRE-COVER PROTOTYPE (lab/center-cd.html)
   The site's own CSS 3D shelf (css/portfolio.css), but with a different arrangement: one cover always stands flat in the
   middle, facing you, and three stand edge-on on each side. Bringing another cover to the middle (click it, ← / →, or scroll)
   turns the row round one step at a time: the one in the middle turns back to its side, the next one slides out and turns to face you.
   Plain script, no build step; the covers come from CONFIG.portfolio.tracks. Nothing on the live site uses this file.
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;
  const time = v => { if (!isFinite(v) || v < 0) v = 0; return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SIDE = 3;                         // covers on each side of the middle one
  const SLOTS = SIDE * 2 + 1;
  const BACK = .28, LIFT = .09;           // how far the stacks stand back, as a share of a cover's width (the live shelf: .28) · how high the middle cover stands
  const SHRINK = 1.25 / (1.25 + BACK);    // how much smaller (and nearer the middle) something that far back is seen
  const MID = .80;                        // the middle cover's size, as a share of the side covers' (1 = as big as on the live shelf)
  const GAP = .035;                       // the least air between the middle cover and the first one beside it (a share of a cover's width)
  const BIG = 1.12;                       // the side covers' size, as a share of the live shelf's (the middle cover is MID of that)
  const FACE = 0;                         // how far the side covers are turned towards edge-on (0 = square, as on the live shelf; 1 = no artwork visible at all)
  const GLOW = 3.1;                       // how wide the light under the player bar is, as a share of the middle cover's width
  const BARGAP = 24;                      // the space (px) between the middle cover and the player bar under it
  const MIDLINE = .46;                    // where the middle of the middle cover stands: this share of the window's height from the top
  const STACKLINE = .56;                  // … and where the middle of the two stacks stands (about 1 cm lower than the middle of the page)
  const EDGE = .51;                       // where the outermost spine stands: this share of the window's width from the middle (.5 = the very edge)
  const SPACING = .32;                    // the distance from one side cover's spine to the next (a share of a cover's width; the live shelf uses .6)
  const SWAP_AT = 200;                    // ms into a step at which the cover that comes out passes in front of the one that goes back (half of its turn)
  const STEP = 520;                       // ms between two single steps when the row has to turn further than one
  const WAVE = .6;                        // how high the cover under the pointer lifts, as a share of the live shelf's (1 = as high as there)
  const REACH = [1, 0, 0];                // hover lift by distance along the row: only the cover under the pointer lifts, its neighbours stay put (the live shelf: [1, .36, .1])
  const hoverOn = matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced;

  /* ---------- the covers: the tracks, run round again until there are enough to fill all seven places ---------- */
  const base = (CONFIG.portfolio && CONFIG.portfolio.tracks) || [];
  if (!base.length) return;
  const list = [];
  while (list.length < SLOTS) base.forEach(t => list.push(t));
  const T = list.length;

  /* ---------- colour of a spine, and its lettering as a picture (as js/portfolio.js) ---------- */
  function hexToHsl(hex) {
    const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16);
    let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function paintTint(el, t) {
    const [h, s] = hexToHsl(t.color || '#444455');
    const yellowish = h > 30 && h < 75;
    el.style.setProperty('--h', Math.round(h));
    el.style.setProperty('--s', clamp(Math.round(s * 100), 45, 82));
    el.style.setProperty('--l', yellowish ? 44 : 38);
  }
  const letteringCache = new Map();
  function lettering(title, artist) {
    const key = title + '\u0001' + artist;
    if (letteringCache.has(key)) return letteringCache.get(key);
    const c = document.createElement('canvas'); c.width = 96; c.height = 1600;
    const x = c.getContext('2d');
    x.translate(48, 800); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.textAlign = 'left';
    if ('letterSpacing' in x) x.letterSpacing = '3px';
    const face = '"Helvetica Neue", Helvetica, Arial, sans-serif', gap = 26;
    const m = title.match(/^(.*?)(\s*\([^)]*\))$/), main = m ? m[1] : title, extra = m ? m[2] : '';
    const heavy = `800 59px ${face}`, medium = `500 59px ${face}`, thin = `300 59px ${face}`;
    x.font = heavy; const wm = x.measureText(main).width;
    x.font = medium; const we = extra ? x.measureText(extra).width : 0;
    x.font = thin; const wa = x.measureText(artist).width;
    const start = -(wm + we + gap + wa) / 2;
    x.font = heavy; x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 2.2; x.lineJoin = 'round';
    x.strokeText(main, start, 0); x.fillText(main, start, 0);
    if (extra) { x.font = medium; x.lineWidth = 1; x.strokeText(extra, start + wm, 0); x.fillText(extra, start + wm, 0); }
    x.font = thin; x.fillStyle = 'rgba(255,255,255,.72)'; x.fillText(artist, start + wm + we + gap, 0);
    const url = c.toDataURL('image/png');
    letteringCache.set(key, url);
    return url;
  }

  /* ---------- build the row ---------- */
  const pfEl = $('[data-pf]'), shelf = $('[data-shelf]'), floor = $('[data-floor]'), npEl = $('[data-np]');
  pfEl.style.setProperty('--n', SLOTS);                    // (an odd count would shift the viewpoint; the middle cover is flat here, so it is not marked data-odd)
  /* Each stack has a perspective of its own (css .stack), so each can follow the pointer without the other one moving: the covers of the left stack
     live in stk.l, those of the right in stk.r, and the middle cover directly in the shelf (at depth 0 no viewpoint can move it). Their reflections the same. */
  const mkStack = parent => { const d = document.createElement('div'); d.className = 'stack'; parent.appendChild(d); return d; };
  const stk = { l: mkStack(shelf), r: mkStack(shelf) }, fstk = { l: mkStack(floor), r: mkStack(floor) };
  const home = (it, k) => {
    const a = k === 0 ? shelf : stk[k < 0 ? 'l' : 'r'], b = k === 0 ? floor : fstk[k < 0 ? 'l' : 'r'];
    if (it.li.parentNode !== a) a.appendChild(it.li);
    if (it.fl.parentNode !== b) b.appendChild(it.fl);
  };
  /* The light of the cover in the middle on the floor: a soft pool of its own colour right under the player bar, wider than the bar, so it lights
     the floor there (and the bar's glass picks it up). It stands in for that cover's own pool in the floor, which is switched off (css .fl.is-front).
     Two layers take turns: when the row turns, the new cover's light travels with it, out of its stack and in under the player, while the old
     one goes out with the cover that leaves, into the stack on the other side, and fades. */
  const glows = [0, 1].map(() => { const g = document.createElement('div'); g.className = 'mid-light'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = '<div class="mid-glow"></div>'; document.body.appendChild(g); return g; });
  let ga = 0;
  function lightFloor(first, fromX) {
    if (first) { paintTint(glows[ga], list[cur]); glows[ga].classList.add('is-on'); return; }
    const old = glows[ga], neu = glows[1 - ga];
    const from = Number.isFinite(fromX) && fromX !== 0 ? fromX : 0;
    paintTint(neu, list[cur]);
    neu.style.transition = 'none';                             // starts in the stack the cover comes out of, unseen …
    neu.style.setProperty('--gx', `${from.toFixed(1)}px`);
    neu.classList.remove('is-on');
    void neu.offsetWidth;
    neu.style.transition = '';                                 // … and travels in under the player while it fades up
    neu.style.setProperty('--gx', '0px');
    neu.classList.add('is-on');
    old.style.setProperty('--gx', `${(-from).toFixed(1)}px`); // the old one goes the other way, with the cover that leaves
    old.classList.remove('is-on');
    ga = 1 - ga;
  }
  const art = t => '../' + t.artwork;
  const items = list.map((t, i) => {
    const li = document.createElement('li');
    li.className = 'cd cd--l';
    li.innerHTML = `
      <div class="cd__btn" role="button" tabindex="0" aria-label="Bring ${esc(t.title)} by ${esc(t.artist)} to the middle">
        <div class="cd__bob">
          <img class="cd__face" src="${esc(art(t))}" alt="${esc(t.title)} — artwork" decoding="async" fetchpriority="high">
          <div class="cd__shade"></div>
          <div class="cd__edge"><img class="cd__lettering" src="${lettering(t.title, t.artist)}" alt="" decoding="async"></div>
        </div>
      </div>`;
    shelf.appendChild(li);
    const fl = document.createElement('div');
    fl.className = 'fl cd--l';
    fl.innerHTML = '<div class="fl__glow"></div><div class="fl__edge"></div>';
    floor.appendChild(fl);
    paintTint(li, t); paintTint(fl, t);
    const it = { i, t, li, fl, side: 'l', k: null, mag: 0, vel: 0, ym: 0, lf: 0, zm: 0, tok: 0 };
    it.btn = li.querySelector('.cd__btn');
    it.btn.addEventListener('click', () => { if (it.k) go(it.k); });
    it.btn.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); it.btn.click(); } });
    return it;
  });
  const both = it => [it.li, it.fl];

  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;';
  pfEl.appendChild(probe);
  const px = name => { probe.style.width = `var(${name})`; return probe.getBoundingClientRect().width; };

  let cur = 0;                                               // the track in the middle
  const offset = i => {                                      // where track i stands: 0 the middle, -1 the first on the left …
    let k = (((i - cur) % T) + T) % T;
    if (k > T / 2) k -= T;
    return k;
  };
  const shown = k => Math.abs(k) <= SIDE;

  function setSide(it, side) {
    it.side = side;
    for (const el of both(it)) { el.classList.toggle('cd--l', side === 'l'); el.classList.toggle('cd--r', side === 'r'); }
  }
  /* write one cover's place into the CSS variables the shelf's stylesheet reads */
  function put(it, k) {
    const w = px('--w');
    const kk = clamp(k, -SIDE, SIDE);
    /* Two stacks, one on each side, close-packed and with their outermost spine at the side of the page; between the stacks and
       the middle cover is empty space. (Seen from the middle the side covers are a little smaller — the stack steps back —
       which is SHRINK: 1.25 / (1.25 + BACK).) The stack never comes closer to the middle cover than GAP. */
    const q = w * SPACING;
    const outer = innerWidth * EDGE / SHRINK;
    const c0 = Math.max(outer - (SIDE - 1) * q, w * (MID * .5 / SHRINK + GAP / SHRINK));
    let x = Math.sign(kk) * (c0 + (Math.abs(kk) - 1) * q), rot = 90, z = -w * BACK, zi = 20 - Math.abs(kk) * 2, fx = null;
    /* each side cover is turned a little past square so that its face is nearly edge-on to you wherever it stands: the stacks show
       spines (and a sliver of artwork), and the space between them and the middle cover stays empty */
    if (k !== 0) rot = 90 + FACE * Math.atan(Math.abs(x) / (w * (1.25 + BACK))) * 180 / Math.PI;
    if (k === 0) { x = it.side === 'l' ? -w / 2 : w / 2; fx = it.side === 'l' ? -w * MID / 2 : w * MID / 2; rot = 0; z = 0; zi = 40; }      // (at depth 0 the viewpoint's drift can't shift it: the picture in the middle never moves)
    for (const el of both(it)) {
      /* the middle cover is made smaller by scaling it about its own middle (its box stays full size, so it can turn and slide
         exactly like the others), and stands on the same floor as they do; its reflection is scaled about its hinge instead */
      el.style.setProperty('--x', `${(el === it.fl && fx !== null ? fx : x).toFixed(1)}px`);
      el.style.setProperty('--ms', k === 0 ? MID : BIG);
      el.style.setProperty('--rot', `${rot}deg`);
      el.style.setProperty('--z', `${z.toFixed(1)}px`);
      el.classList.toggle('is-front', k === 0);
      el.classList.toggle('is-rim', Math.abs(k) === SIDE);
    }
    it.li.classList.toggle('is-mid', k === 0);
    it.li.style.zIndex = String(zi);
    /* The middle cover stands a little above the middle of the page (MIDLINE), the two stacks lower (STACKLINE). */
    /* (a side cover that is bigger than the live shelf's grows upwards: it is lifted by half of what it has grown, so its foot stays where it was) */
    const off = innerHeight * (k === 0 ? MIDLINE : STACKLINE) - (shelf.getBoundingClientRect().top + w / 2) - (k === 0 ? 0 : (BIG - 1) * w * .67);
    it.li.style.setProperty('--ly', `${off.toFixed(1)}px`);    // (the whole height of the middle cover is in this one value, so it travels with the cover's own slide — no separate lift that eases in afterwards)
    it.fl.style.setProperty('--fy', `${off.toFixed(1)}px`);
    if (k === 0 && npEl) {                                   // the player bar stands under the middle cover, as wide as it
      npEl.style.setProperty('--np-top', `${Math.round(innerHeight * MIDLINE + w * MID / 2 + BARGAP)}px`);
      npEl.style.setProperty('--mid-k', MID);
      for (const g of glows) {
        g.style.setProperty('--np-top', npEl.style.getPropertyValue('--np-top'));
        g.style.setProperty('--gw', `${(w * MID * GLOW).toFixed(1)}px`);
      }
    }
    it.k = k;
  }

  /* One step of the row: everything slides one place, the cover in the middle turns back to its side, the next one comes out and turns to face you. */
  function layout(first) {
    let fromX = 0;                                             // where the cover that comes into the middle stands now (relative to the middle of the page)
    const swap = {};                                           // the cover that leaves the middle and the one that comes into it, to change places half-way
    items.forEach(it => {
      const k = offset(it.i), old = it.k;
      if (!first && old !== null && k === 0 && old !== 0) {
        const r = it.li.querySelector('.cd__face').getBoundingClientRect();
        fromX = r.left + r.width / 2 - innerWidth / 2;
        if (!shown(old)) fromX = Math.sign(old) * innerWidth * .4;
      }
      clearTimeout(it.flatT);
      if (first || old === null) { setSide(it, k < 0 ? 'l' : 'r'); home(it, k); put(it, k); if (!shown(k)) { it.li.classList.add('is-hide'); it.fl.classList.add('is-hide'); } if (k === 0) it.li.classList.add('is-flat'); return; }   // (the middle cover stands at its height from the first frame)
      if (k === old) return;
      if (k === 0 && Math.abs(old) === 1) swap.inn = { box: stk[old < 0 ? 'l' : 'r'] };
      const tok = ++it.tok;
      const jump = Math.abs(k - old) > 1;                    // it goes round the end of the row, from one side to the other: unseen, behind the others
      it.li.classList.remove('is-flat');
      if (jump || !shown(k) || !shown(old)) {
        /* The cover that goes round the end of the row leaves out of the side of the page (never fading in place over its neighbours, which made them look see-
           through and run into each other), is put at its new place unseen — already out beyond the edge on the other side — and slides in from there. */
        const away = Math.sign(old || k) * innerWidth * .3;
        it.li.style.zIndex = '1';                                  // (while it leaves it stays behind every other cover: with the same layer as the cover moving into its place, which one was in front depended on which had been put there last)
        for (const el of both(it)) {
          el.classList.add('is-fading');
          el.style.setProperty('--x', `${(parseFloat(el.style.getPropertyValue('--x')) + away).toFixed(1)}px`);
        }
        setTimeout(() => {
          if (it.tok !== tok) return;
          for (const el of both(it)) el.classList.add('no-tr');
          it.li.classList.add('is-hide'); it.fl.classList.add('is-hide');
          if (k !== 0) setSide(it, k < 0 ? 'l' : 'r');
          home(it, k);
          put(it, k);
          for (const el of both(it)) el.style.setProperty('--x', `${(parseFloat(el.style.getPropertyValue('--x')) + Math.sign(k || -old) * innerWidth * .3).toFixed(1)}px`);   // (waiting outside the edge)
          setTimeout(() => {
            if (it.tok !== tok) return;
            for (const el of both(it)) { el.classList.remove('no-tr', 'is-fading'); if (shown(k)) { el.classList.add('is-entering'); el.classList.remove('is-hide'); } }
            put(it, k);                                            // … and glides in to its place
            setTimeout(() => { for (const el of both(it)) el.classList.remove('is-entering'); }, 600);
          }, 70);
        }, 180);
        return;
      }
      /* the one leaving the middle: its hinge changes to the side it is heading for, while it still stands flat (which looks the same either way) */
      const want = k < 0 ? 'l' : 'r';
      if (old === 0) {
        for (const el of both(it)) el.classList.add('no-tr');
        if (it.side !== want) setSide(it, want);
        put(it, 0); home(it, k);                               // (standing flat at depth 0 it looks the same in either stack's perspective)
        for (const el of both(it)) el.classList.add('is-back');   // (it moves back to its side exactly as the new one comes forward: css .is-back / .is-front)
        setTimeout(() => { for (const el of both(it)) el.classList.remove('is-back'); }, 650);
        /* the cover that goes back to its side stays in front of the one that comes out, and exactly half-way through the swap the two change places:
           the new one comes up from behind the old one instead of the two passing through each other (see below, after the loop) */
        const box = stk[k < 0 ? 'l' : 'r'];
        box.style.zIndex = '4'; it.li.style.zIndex = '60';
        swap.out = { box, it, z: String(20 - Math.abs(k) * 2) };
        void it.li.offsetWidth;
        for (const el of both(it)) el.classList.remove('no-tr');
      } else if (k !== 0 && it.side !== want) setSide(it, want);
      put(it, k);
      if (k === 0) it.flatT = setTimeout(() => { it.li.classList.add('is-flat'); home(it, 0); }, 460);   // the turn is done: from here it is one plain picture, and it stands in the middle's own perspective
    });
    if (swap.out && swap.inn && swap.out.box !== swap.inn.box) {
      const { out, inn } = swap;
      clearTimeout(out.box.zT); clearTimeout(inn.box.zT);
      inn.box.style.zIndex = '1';
      out.box.zT = setTimeout(() => { out.box.style.zIndex = '1'; out.it.li.style.zIndex = out.z; inn.box.style.zIndex = '4'; }, SWAP_AT);   // half-way: now the new one is in front
      inn.box.zT = setTimeout(() => { inn.box.style.zIndex = ''; out.box.style.zIndex = ''; }, SWAP_AT + 500);
    }
    lightFloor(first, fromX);
    wake();
  }
  /* ---------- the player bar under the middle cover: the site's own NowPlaying (js/portfolio.js), over the same tracks. It plays the track of the
     cover in the middle; previous / next (and a track coming to its end) turn the row on to the next cover, and bringing another cover to
     the middle moves the bar on to that track, playing it if the last one was playing. ---------- */
  const NP = (() => {
    const el = $('[data-np]'), audio = $('[data-np-audio]');
    const queue = list.map((t, ti) => ({ t: Object.assign({}, t, { artwork: '../' + t.artwork, audio: t.audio ? '../' + t.audio : null }), ti })).filter(q => q.t.audio);
    const idle = { select() {}, onTrack: null, has: () => false, playTrack() {}, hold() {}, release() {}, stop() {}, isPlaying: () => false, current: () => -1, live: () => false, onOpen: null };
    if (!el || !audio || !queue.length) { if (el) el.hidden = true; return idle; }

    const ui = {
      art: $('[data-np-art]', el), title: $('[data-np-title]', el), artist: $('[data-np-artist]', el),
      play: $('[data-np-play]', el), prev: $('[data-np-prev]', el), next: $('[data-np-next]', el),
      who: $('[data-np-open]', el), scrub: $('[data-np-scrub]', el), fill: $('[data-np-fill]', el),
      mid: $('[data-np-mid]', el), tscrub: $('[data-np-tscrub]', el), tfill: $('[data-np-tfill]', el),
      elapsed: $$('[data-np-elapsed]', el), total: $$('[data-np-total]', el)
    };
    let i = 0, loaded = -1, dragging = false;
    const api = { onOpen: null, onTrack: null };       // onTrack(ti): the bar has moved on to another track (previous / next / the track ended)

    /* the fader level the player left off at, so the loudness doesn't jump */
    let vol = .4;
    try { const sv = parseFloat(localStorage.getItem('kas-volume')); if (isFinite(sv)) vol = clamp(sv, 0, 1); } catch (_) {}
    audio.volume = vol;

    /* the speaker at the right end slides left to the artwork's place and draws a horizontal volume line out behind it (css, lab/center-cd.html); same stored level as the player's */
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
      vfill.style.width = `${vol * 100}%`;
      vtrack.setAttribute('aria-valuenow', Math.round(vol * 100));
      muted = vol === 0;
      audio.muted = muted;
      paintMute();
      if (save) { try { localStorage.setItem('kas-volume', String(vol)); } catch (_) {} }
    }
    setVol(vol, false);
    /* How far the speaker travels: from where it stands to the middle of the artwork's place at the left of the bar's middle. */
    const placeVol = () => {
      const v = volEl.getBoundingClientRect(), m = ui.mid.getBoundingClientRect();
      el.style.setProperty('--vdx', `${Math.max(0, (v.left + v.width / 2) - (m.left + 19)).toFixed(1)}px`);
    };
    const setOpen = on => {
      if (on) placeVol();
      el.classList.toggle('is-vol', on);
      volBtn.setAttribute('aria-expanded', String(on));
    };
    addEventListener('resize', () => { if (el.classList.contains('is-vol')) placeVol(); });
    volBtn.addEventListener('click', () => { if (!el.classList.contains('is-vol')) setOpen(true); else setMuted(!muted); });
    document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.np__vol')) setOpen(false); });
    const fromX = ev => { const r = vtrack.getBoundingClientRect(); setVol((ev.clientX - r.left) / r.width, true); };
    let vdrag = false;
    vtrack.addEventListener('pointerdown', ev => { vdrag = true; try { vtrack.setPointerCapture(ev.pointerId); } catch (_) {} fromX(ev); });
    vtrack.addEventListener('pointermove', ev => { if (vdrag) fromX(ev); });
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
      if (api.onTrack) api.onTrack(queue[i].ti);
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
      /* the cover in the middle has changed: the bar moves on to its track, and plays it if the last one was playing */
      select(ti) {
        const n = queue.findIndex(q => q.ti === ti);
        if (n < 0 || (n === i && loaded === i)) return;
        load(n, !audio.paused);
      },
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

  /* ---------- turning the row: d places (+ brings the cover d to the right into the middle), one step at a time ---------- */
  /* `target` is the track the row is turning to; the player bar changes to it at once (the row itself follows, one step at a time).
     While the row is still turning (its animations are not finished) nothing can be chosen: clicks, keys, the wheel and the bar's previous / next are ignored. */
  let todo = 0, busy = false, target = cur, locked = false, lockT = 0;
  function go(d, force) {
    d = Math.round(d);
    if (!d || (locked && !force)) return;
    locked = true; clearTimeout(lockT);
    todo += d;
    target = (((target + d) % T) + T) % T;
    NP.select(target);                                         // the bar's track, title and artwork change the moment it is clicked
    if (!busy) run();
  }
  function run() {
    if (!todo) { busy = false; lockT = setTimeout(() => { locked = false; }, 160); return; }   // (the last step is still finishing its slide)
    busy = true;
    const s = Math.sign(todo); todo -= s;
    cur = (cur + s + T) % T;
    layout(false);
    setTimeout(run, STEP);
  }
  npEl.addEventListener('click', ev => {                       // the bar's previous / next are locked too
    if (locked && ev.target.closest('[data-np-prev], [data-np-next]')) { ev.stopPropagation(); ev.preventDefault(); }
  }, true);
  /* the bar moved on by itself (previous / next / the track ended): the row turns to that track */
  NP.onTrack = ti => {
    if (ti === target) return;
    let d = (((ti - target) % T) + T) % T;
    if (d > T / 2) d -= T;
    go(d, true);                                               // (the bar has already moved: the row has to follow, whatever it is doing)
  };
  addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') go(1); else if (ev.key === 'ArrowLeft') go(-1);
  });
  let wheelAcc = 0, wheelT = 0;
  addEventListener('wheel', ev => {
    const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
    wheelAcc += d; clearTimeout(wheelT); wheelT = setTimeout(() => { wheelAcc = 0; }, 160);
    if (Math.abs(wheelAcc) > 60 && !busy) { go(Math.sign(wheelAcc)); wheelAcc = 0; }
  }, { passive: true });

  /* ---------- hovering: the cover under the pointer lifts (the middle one only zooms a touch), the pair beside it rises less,
     and the viewpoint drifts with the pointer — none of it below the row ---------- */
  let hover = null, midHover = false, running = false, last = 0, drift = { l: { tx: 0, ty: 0, x: 0, y: 0 }, r: { tx: 0, ty: 0, x: 0, y: 0 } };
  const UP = 20, DOWN = 14.5, ZETA = .8;
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    const steps = Math.max(1, Math.ceil(dt / .004)), h = dt / steps, kk = 1 - Math.exp(-9 * dt);
    let busyF = false;
    items.forEach(it => {
      /* only the cover under the pointer lifts (REACH), and never the middle one */
      const dist = hover === null || it.k === null || it.k === 0 || Math.sign(it.k) !== Math.sign(hover) ? 9 : Math.abs(it.k - hover);
      const target = shown(it.k) ? (REACH[dist] || 0) : 0;
      const w0 = target < it.mag - .0005 ? DOWN : UP;
      let x = it.mag, v = it.vel;
      for (let n = 0; n < steps; n++) { v += (w0 * w0 * (target - x) - 2 * ZETA * w0 * v) * h; x += v * h; }
      it.mag = x; it.vel = v;
      if (Math.abs(x - target) > .001 || Math.abs(v) > .01) busyF = true; else { it.mag = target; it.vel = 0; }
      const lift = Math.max(0, it.mag), mid = it.k === 0;
      const up = mid ? 0 : lift * WAVE;                       // how high the wave actually lifts a cover
      it.ym += (up - it.ym) * kk;
      if (Math.abs(it.ym - up) > .002) busyF = true;
      for (const el of both(it)) el.style.setProperty('--mag', lift.toFixed(4));
      it.li.style.setProperty('--ym', it.ym.toFixed(4));
    });
    for (const side of ['l', 'r']) {                            // each stack's viewpoint drifts on its own
      const d = drift[side];
      d.x += (d.tx - d.x) * (1 - Math.exp(-5 * dt));
      d.y += (d.ty - d.y) * (1 - Math.exp(-5 * dt));
      if (Math.abs(d.tx - d.x) > .002 || Math.abs(d.ty - d.y) > .002) busyF = true; else { d.x = d.tx; d.y = d.ty; }
      for (const el of [stk[side], fstk[side]]) { el.style.setProperty('--px', d.x.toFixed(4)); el.style.setProperty('--py', d.y.toFixed(4)); }
    }
    if (busyF) requestAnimationFrame(frame); else running = false;
  };
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  function nearest(ev) {                                     // the gaps between covers belong to the nearest one
    const row = shelf.getBoundingClientRect();
    if (ev.clientY < row.top - 100 || ev.clientY > row.bottom) return null;
    let best = null, bd = Infinity;
    for (const it of items) {
      if (!shown(it.k)) continue;
      const a = it.li.querySelector('.cd__face').getBoundingClientRect(), b = it.li.querySelector('.cd__edge').getBoundingClientRect();
      const l = Math.min(a.left, b.left), r = Math.max(a.right, b.right);
      const d = ev.clientX < l ? l - ev.clientX : ev.clientX > r ? ev.clientX - r : 0;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  if (hoverOn) {
    shelf.addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch') return;
      const li = ev.target.closest && ev.target.closest('.cd');
      const it = (li && items.find(x => x.li === li)) || nearest(ev);
      const k = it ? it.k : null;
      const onMid = k === 0, wave = onMid ? null : k;        // the middle cover is not part of the wave
      if (wave !== hover || onMid !== midHover) { hover = wave; midHover = onMid; wake(); }
    });
    shelf.addEventListener('pointerleave', () => { if (hover !== null || midHover) { hover = null; midHover = false; wake(); } });
    addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch') return;
      if (midHover) return;                                    // over the middle cover nothing moves at all: the viewpoint holds still too
      const mine = ev.clientX < innerWidth / 2 ? 'l' : 'r', other = mine === 'l' ? 'r' : 'l';
      drift[other].tx = drift[other].ty = 0;                      // the stack on the other side stays still
      if (ev.clientY > shelf.getBoundingClientRect().bottom) drift[mine].tx = drift[mine].ty = 0;
      else { drift[mine].tx = clamp(ev.clientX / innerWidth * 2 - 1, -1, 1); drift[mine].ty = clamp(ev.clientY / innerHeight * 2 - 1, -1, 1); }
      wake();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { for (const d of Object.values(drift)) d.tx = d.ty = 0; wake(); });
  }

  /* the two small icons bottom left (as on the live page): shown only when CONFIG has a link for them */
  [['[data-instagram]', CONFIG.instagram && CONFIG.instagram.url], ['[data-spotify-playlist]', CONFIG.spotify && CONFIG.spotify.url]]
    .forEach(([sel, url]) => { const a = $(sel); if (a && url) { a.href = url; a.hidden = false; } });

  /* The page switcher (Portfolio | Demos) at the top, as on the live page (css .seg.is-away): it is only there while the pointer is in the strip
     above the covers or below them; as soon as it is over the artwork, the stacks or the player bar, it floats away, and it comes back when the pointer
     leaves them again. Until the mouse has moved it is there. */
  (function pillAway() {
    const pill = $('[data-seg]');
    if (!pill || !hoverOn) return;
    let away = false;
    addEventListener('pointermove', ev => {
      if (ev.pointerType !== 'mouse') return;
      const rects = items.filter(it => shown(it.k)).map(it => it.li.querySelector('.cd__face').getBoundingClientRect());
      const want = ev.clientY >= Math.min(...rects.map(r => r.top)) && ev.clientY <= Math.max(...rects.map(r => r.bottom));
      if (want !== away) { away = want; pill.classList.toggle('is-away', away); }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { away = false; pill.classList.remove('is-away'); });
  })();

  /* the first layout places the covers, it doesn't fly them in from where they were created */
  items.forEach(it => { it.li.classList.add('no-tr'); it.fl.classList.add('no-tr'); });
  layout(true);
  /* the first layout places the covers, it doesn't fly them in from where they were created */
  npEl.classList.add('is-live');                              // the bar is always there (on the live page it comes up with the first play)
  const settle = () => items.forEach(it => { it.li.classList.remove('no-tr'); it.fl.classList.remove('no-tr'); });
  requestAnimationFrame(() => requestAnimationFrame(settle));
  setTimeout(settle, 150);
  addEventListener('resize', () => items.forEach(it => put(it, it.k)));
})();
