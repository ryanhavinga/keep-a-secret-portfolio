/* ============================================================
   KEEP A SECRET — app
   Environment · Carousel · Player
   All editable content lives in js/config.js
   ============================================================ */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SOUND_ENABLED = true;   // the gate woosh — set false to mute it again

  /* Shared by the volume fader (real playback volume is hardware-buttons-
     only on iOS by policy) and by triggerHaptic below (no Vibration API
     on iOS at all) — both are genuine iOS/WebKit platform restrictions,
     not runtime-probeable, so both key off this once rather than each
     guessing at it separately. iPadOS 13+ reports as a plain Mac
     (navigator.platform === 'MacIntel'), so a real Mac is told apart
     from an iPad by touch support — a Mac has none. */
  const IS_IOS = /iP(hone|od|ad)/.test(navigator.platform)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ---- haptic feedback -------------------------------------------
     navigator.vibrate() is the obvious way to ask for this, and it's
     exactly what earlier passes here used — except iOS Safari has never
     implemented the Vibration API at all, for any browser there (Chrome,
     Firefox and everything else on iOS are all forced onto the same
     WebKit engine), so vibrate() is simply undefined on an iPhone no
     matter what. This isn't that: it's the technique the tiny (MIT,
     no-dep) "tactus" package (https://github.com/aadeexyz/tactus) uses —
     a native <input type="checkbox" switch> plus its <label>, Safari's
     own new "switch"-styled checkbox. Toggling a REAL one of those is a
     native control interaction, and WebKit gives native control
     interactions their own real Taptic Engine tick as a normal side
     effect — nothing to do with the Vibration API, so the iOS
     restriction on that API never applies to it.

     Kept "visually hidden" (off-screen, 1px, opacity near-zero) rather
     than display:none, on purpose — a display:none element is dropped
     from the render tree entirely, never laid out or painted at all,
     and the native OS widget backing that a switch's haptic rides on is
     reasonably suspect to depend on the element actually being
     rendered. display:none was the first version here and reportedly
     produced no felt tap at all on a real iPhone 11 — this is the most
     likely reason, so it's the first thing worth ruling out. Two
     genuine platform limits remain regardless of this: the `switch`
     attribute itself only exists from Safari 17.4 (iOS 17.4) on, a no-op
     on anything older; and iOS's own Settings > Sounds & Haptics >
     System Haptics toggle gates every haptic on the device, this trick
     included, same as it gates the keyboard's own click-taps.

     Built once, reused for every call — a plain label.click() is enough
     to fire the tick, iOS asks for no more "real" a gesture than that.
     Elsewhere (no Vibration API restriction to route around) this just
     calls vibrate() directly, same as before. */
  let hapticSwitchInput = null, hapticSwitchLabel = null;
  function hideButRender(el) {
    el.style.cssText =
      'position:fixed; left:0; bottom:0; width:1px; height:1px;' +
      'margin:0; padding:0; border:0; overflow:hidden; opacity:.01; pointer-events:none;';
  }
  function mountHapticSwitch() {
    if (hapticSwitchInput) return;
    hapticSwitchInput = document.createElement('input');
    hapticSwitchInput.type = 'checkbox';
    hapticSwitchInput.id = '___kas-haptic-switch___';
    hapticSwitchInput.setAttribute('switch', '');
    hapticSwitchInput.setAttribute('aria-hidden', 'true');
    hapticSwitchInput.tabIndex = -1;
    hideButRender(hapticSwitchInput);
    document.body.appendChild(hapticSwitchInput);
    hapticSwitchLabel = document.createElement('label');
    hapticSwitchLabel.htmlFor = hapticSwitchInput.id;
    hideButRender(hapticSwitchLabel);
    document.body.appendChild(hapticSwitchLabel);
  }
  function triggerHaptic(duration = 15) {
    if (IS_IOS) {
      if (!hapticSwitchLabel) mountHapticSwitch();
      hapticSwitchLabel?.click();
    } else {
      try { navigator.vibrate?.(duration); } catch (_) {}
    }
  }

  const time = s => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  /* ==========================================================
     COLOUR — dominant artwork colour, muted for the panel
     ========================================================== */
  /* artwork with no colour in it to speak of still has to light the room —
     it borrows the house violet rather than burning out to white */
  const NEUTRAL_H = .72;

  /* A track with no artwork has no colour to borrow, so the room falls back
     to its own house light: a bright, near-neutral white lamp with only a
     whisper of warmth alternating through it cell by cell — kept faint on
     purpose so the checkerboard reads white against white rather than
     white against yellow. The base is a hair off #fff on purpose: a pure
     white lamp reads as a blown highlight instead of as light. */
  const DEMO_LIGHT = {
    panel: [16, 16, 19],
    ring:  [255, 255, 253],
    deep:  [62, 61, 57],
    b:     [255, 247, 227],
    c:     [255, 253, 244]
  };

  const Colour = {
    toRgb(hex) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    },
    toHsl([r, g, b]) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      let h = 0, s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > .5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
      }
      return [h, s, l];
    },
    toRgbFromHsl([h, s, l]) {
      if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
      const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      const f = t => {
        t = (t + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
    },

    /* elegant, never oversaturated — for the player panel */
    mute(rgb) {
      let [h, s, l] = Colour.toHsl(rgb);
      if (s < .08) return Colour.toRgbFromHsl([h, s, clamp(l, .05, .11)]);   // near-neutral art stays graphite
      return Colour.toRgbFromHsl([h, clamp(s * .78, 0, .40), clamp(l * .62, .13, .29)]);
    },

    /* the opposite treatment — a bright lamp colour for the band. Pushed
       hard on saturation and held down in lightness on purpose: a lamp
       that climbs past ~.62 lightness starts reading as a white highlight
       rather than as coloured light, which is the one thing the band must
       never do. Neutral artwork gets the house violet instead of white. */
    vivid(rgb) {
      const [h, s, l] = Colour.toHsl(rgb);
      if (s < .12) return Colour.toRgbFromHsl([NEUTRAL_H, .42, .58]);
      return Colour.toRgbFromHsl([h, clamp(s * 1.6, .74, 1), clamp(l * 1.12, .5, .62)]);
    },

    /* the same hue taken right down — what the lamp throws onto the surface
       either side of the lit band. Dark enough to stay a wash, saturated
       enough that it never greys out. */
    deep(rgb) {
      const [h, s, l] = Colour.toHsl(rgb);
      if (s < .12) return Colour.toRgbFromHsl([NEUTRAL_H, .5, .16]);
      return Colour.toRgbFromHsl([h, clamp(s * 1.35, .7, 1), clamp(l * .5, .12, .2)]);
    },

    /* Which way the contrasting particles step round the wheel. Always
       towards the more luminous side of the lamp's own hue, so the accents
       read as hotter cells in the same light rather than as a second
       colour laid over it — and never far enough to land somewhere the
       eye reads as unrelated. */
    accentTurns(h) {
      if (h >= .50 && h < .72) return [-26, -52];   // blue    -> cyan, mint-green
      if (h >= .72 && h < .88) return [ 26,  50];   // purple  -> magenta, pink-violet
      if (h >= .88 || h < .05) return [-24, -48];   // pink    -> magenta, violet
      return [-28, -56];                            // warm, green
    },

    /* one accent colour, `deg` round the wheel from the lamp. Deliberately
       no brighter than the lamp itself: three bright hues screening over
       each other is how a coloured field turns pale, and the particles are
       supposed to read as a different colour, not a hotter one. */
    accent(rgb, deg, lift) {
      const [h, s, l] = Colour.toHsl(rgb);
      const turn = deg / 360;
      if (s < .12) return Colour.toRgbFromHsl([(NEUTRAL_H + turn + 1) % 1, .5, clamp(.54 + lift, .5, .66)]);
      return Colour.toRgbFromHsl([
        (h + turn + 1) % 1,
        clamp(s * 1.05, .6, 1),
        clamp(l * 1.02 + lift, .46, .64)
      ]);
    },

    /* sample an <img>: saturation-weighted bucket vote */
    fromImage(img) {
      try {
        const N = 28;
        const c = document.createElement('canvas');
        c.width = c.height = N;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, N, N);
        const px = ctx.getImageData(0, 0, N, N).data;
        const bins = new Map();
        for (let i = 0; i < px.length; i += 4) {
          const rgb = [px[i], px[i + 1], px[i + 2]];
          const [h, s, l] = Colour.toHsl(rgb);
          const w = Math.pow(s, 1.3) * (1 - Math.abs(l - .5) * 1.1);
          if (w <= 0) continue;
          const key = `${Math.floor(h * 18) % 18}:${Math.floor(l * 4)}`;
          const e = bins.get(key) || [0, 0, 0, 0];
          e[0] += w; e[1] += rgb[0] * w; e[2] += rgb[1] * w; e[3] += rgb[2] * w;
          bins.set(key, e);
        }
        if (!bins.size) return null;
        const best = [...bins.values()].sort((a, b) => b[0] - a[0])[0];
        return [best[1] / best[0], best[2] / best[0], best[3] / best[0]].map(Math.round);
      } catch (_) {
        return null;   // canvas tainted (file://) — the configured colour is used instead
      }
    }
  };

  /* ==========================================================
     ENVIRONMENT — grain
     ========================================================== */
  const Env = (() => {
    const grain = $('[data-grain]');
    let gctx, pattern, last = 0;

    const tile = (alpha, size = 128) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 120 + Math.random() * 135;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * alpha;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    };

    /* Slack around the viewport, so the grain can be jogged in any
       direction without ever pulling its own edge into frame. */
    const GRAIN_PAD = 80;

    /* Drawn exactly once and then moved — a transform on an already-
       uploaded texture, which the compositor does without touching the
       main thread at all. Re-rendering the pattern itself on every jog
       would mean a canvas fill plus a texture upload landing every frame
       for no visible gain, since the redraw only ever produces the same
       noise at a new random offset. */
    function sizeGrain() {
      const s = .62;                                   // render at 62% for a softer, cheaper grain
      const w = innerWidth + GRAIN_PAD * 2, h = innerHeight + GRAIN_PAD * 2;
      grain.width  = Math.ceil(w * s);
      grain.height = Math.ceil(h * s);
      /* oversized and offset back by the same amount, so what sits over the
         viewport is the middle of the sheet however far it is jogged */
      grain.style.width  = `${w}px`;
      grain.style.height = `${h}px`;
      grain.style.left = grain.style.top = `${-GRAIN_PAD}px`;
      gctx = grain.getContext('2d');
      pattern = gctx.createPattern(tile(210), 'repeat');
      gctx.fillStyle = pattern;
      gctx.fillRect(0, 0, grain.width, grain.height);
    }

    function frame(t) {
      if (t - last > 70) {                             // ~14fps — cinematic, not fizzy
        last = t;
        grain.style.transform =
          `translate3d(${-Math.random() * GRAIN_PAD}px, ${-Math.random() * GRAIN_PAD}px, 0)`;
      }
      requestAnimationFrame(frame);
    }

    return {
      init() {
        if (reduced) return;
        sizeGrain();
        addEventListener('resize', sizeGrain);
        requestAnimationFrame(frame);
      }
    };
  })();

  /* ==========================================================
     CAROUSEL — 3 panel rotating disc
     ========================================================== */
  const Carousel = (() => {
    const root = $('[data-carousel]');

    /* Fraction of a side panel left on screen — negative, so a resting side
       panel sits entirely off the edge with clearance to spare. The panels
       are full size now, and they carry up to 9px of blur, which spreads
       roughly 27px past their own box; .16 of a panel clears both at every
       viewport the layout supports. Nothing is visible but the centre one. */
    const PEEK = -.16;

    let blocks = [], index = 0, dragging = false, captured = false,
        moved = 0, startX = 0, dragT = 0, pid = null;
    const listeners = [];

    /* With one panel this must stay 0 — the general formula always lands
       on -1 when blocks.length is 1, which would push the only panel off
       to the side and never mark it active. */
    const offsetOf = i => blocks.length <= 1
      ? 0
      : ((i - index + 1) % blocks.length + blocks.length) % blocks.length - 1;

    /* Side panels sit clear of the window edges by PEEK of a panel each.
       Straight horizontal offset — no depth, nothing passing behind anything.
       The panel is sized off the viewport, so a viewport narrower than the panel
       is a bad reading (it happens mid-load in some embedders) — keep the last
       good span rather than collapsing everything into the middle. */
    let span = 0;
    function shift() {
      const w = root.offsetWidth;
      const view = Math.max(document.documentElement.clientWidth, innerWidth || 0);
      if (view >= w) span = view / 2 + w * (.5 - PEEK);
      return span || w * 1.06;
    }

    function place(el, t, offset) {
      const a = clamp(Math.abs(t), 0, 1.4);
      el.style.transform = `translate3d(${(t * offset).toFixed(2)}px, 0, 0)`;
      el.style.opacity = String(1 - .38 * a);
      el.style.zIndex = String(30 - Math.round(a * 20));
      /* only the centred block is ever fully sharp — everything else, and
         anything currently in transit toward or away from centre, carries
         a visible blur that scales with how far off-centre it is */
      el.style.filter = a > .02 ? `blur(${Math.min(9, a * 6.5).toFixed(2)}px)` : 'none';
    }

    /* One measurement per pass, so every panel is placed against the same
       numbers. Skipped entirely while the page has no layout yet.

       Transitions are armed here rather than in init, on the first pass that
       actually places anything. A render before the carousel has a width
       bails out, and if transitions were already on by the time the real
       measurement lands, the side panels animate out from the centre in full
       view instead of simply starting off screen. */
    let armed = false;
    function render(extra = 0) {
      if (!root.offsetWidth) return;
      const offset = shift();
      blocks.forEach((el, i) => place(el, offsetOf(i) + extra, offset));
      if (armed) return;
      armed = true;
      requestAnimationFrame(() => blocks.forEach(el => el.classList.add('is-animating')));
    }

    function paintState() {
      blocks.forEach((el, i) => {
        const active = offsetOf(i) === 0;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-hidden', String(!active));
        el.tabIndex = active ? 0 : -1;
      });
      listeners.forEach(fn => fn(blocks[index].dataset.block));
    }

    function animate() {
      blocks.forEach(el => el.classList.add('is-animating'));
      render();
      paintState();
    }

    function go(next) {
      const n = blocks.length;
      index = ((next % n) + n) % n;
      animate();
    }

    /* ---- drag ----
       The pointer is captured only once a real drag begins. Capturing on
       pointerdown would retarget the click away from whatever was pressed. */
    function down(e) {
      if (blocks.length <= 1) return;       // nothing to drag to
      if (e.target.closest('.ctrl, a, .scrub')) return;
      dragging = true; captured = false; moved = 0; startX = e.clientX; dragT = 0; pid = e.pointerId;
    }
    function move(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (!captured) {
        if (moved < 6) return;
        captured = true;
        root.setPointerCapture?.(pid);
        blocks.forEach(el => el.classList.remove('is-animating'));
      }
      dragT = clamp(dx / (root.offsetWidth * .62), -1, 1);
      render(dragT);
    }
    function up(e) {
      if (!dragging) return;
      dragging = false;
      if (captured && pid !== null) root.releasePointerCapture?.(pid);
      pid = null; captured = false;

      if (Math.abs(dragT) > .18) {
        go(index - Math.sign(dragT));
      } else if (moved < 6) {
        const hit = e.target.closest('[data-block]');
        const i = blocks.indexOf(hit);
        if (i > -1 && offsetOf(i) !== 0) go(i);
        else animate();
      } else {
        animate();
      }
      dragT = 0;
    }

    return {
      init(order) {
        blocks = order.map(name => $(`[data-block="${name}"]`)).filter(Boolean);

        root.addEventListener('pointerdown', down);
        root.addEventListener('pointermove', move);
        root.addEventListener('pointerup', up);
        root.addEventListener('pointercancel', up);
        root.addEventListener('dragstart', e => e.preventDefault());

        /* ←/→ belong to the player now (see Player.init) — with a single
           panel there is nothing here for them to move between */
        addEventListener('resize', () => render());
        /* the side panels are placed against the window edges, so re-place them
           whenever the layout viewport changes — not every host fires `resize` */
        new ResizeObserver(() => render()).observe(document.documentElement);

        render();
        paintState();
      },
      onChange(fn) { listeners.push(fn); },
      current: () => blocks[index]?.dataset.block,
      wasDragged: () => moved > 6,
      next: () => go(index + 1),
      prev: () => go(index - 1)
    };
  })();

  /* ==========================================================
     PLAYER
     ========================================================== */
  const Player = (() => {
    const audio = $('[data-audio]');
    const el = {
      covers: $('[data-covers]'), meta: $('[data-meta]'),
      fill: $('[data-fill]'),
      cur: $('[data-current]'), dur: $('[data-duration]'),
      play: $('[data-play]'), prev: $('[data-prev]'), next: $('[data-next]'),
      scrub: $('[data-scrub]'), note: $('[data-note]'),
      volToggle: $('[data-vol-toggle]'), volume: $('[data-volume]'),
      volTrack: $('[data-vol-track]'), volFill: $('[data-vol-fill]'), volHead: $('[data-vol-head]')
    };

    let tracks = [], covers = [], metaItems = [], i = 0,
        playing = false, fallback = false, fakeTime = 0, lastTick = 0, scrubbing = false,
        changeTimer = null, lightTimer = null;

    /* swipe-to-rotate state — see swipeDown/swipeMove/swipeUp below */
    let swipeDragging = false, swipeCaptured = false, swipeMoved = 0,
        swipeStartX = 0, dragExtra = 0, swipePid = null,
        dragVelocity = 0, lastMoveT = 0, swipePointerType = 'touch',
        dragSlotPx = 0;   // slotWidth(), measured once per gesture — see swipeDown

    const track = () => tracks[i];
    const duration = () => (fallback || !isFinite(audio.duration) || !audio.duration)
      ? track().duration || 180 : audio.duration;
    const position = () => fallback ? fakeTime : audio.currentTime;

    /* long titles (the DEMO track's, mainly) would otherwise wrap onto a
       second line and push everything below it down — a visible "hop"
       whenever that track becomes active. Force one line and shrink the
       font just enough to fit it, rather than letting it wrap at all.
       Fitted once per title, when its .meta-item is first built — each
       one belongs permanently to a single track now, rather than one
       shared element whose text (and required size) changed underneath
       it on every load(). */
    /* Measure the *text*, not the box it is clipped by. `.player__title` is
       a centred flex container with overflow:hidden, and on those
       scrollWidth only reports the overflow spilling off one side — with
       `justify-content: center` a too-long title spills off both equally,
       so scrollWidth comes back at roughly half the real excess. That is
       what left "Alles Waar Je Spijt Van Hebt" cut off at both ends: it
       measured 560px against a 504px box and shrank ~12%, when the text is
       actually 617px and needed ~18%. A Range over the text nodes reports
       the true laid-out width regardless of how the container clips or
       aligns it. */
    const titleRange = document.createRange();
    function textWidth(el_) {
      titleRange.selectNodeContents(el_);
      return titleRange.getBoundingClientRect().width;
    }

    function fitTitleEl(titleEl) {
      titleEl.style.fontSize = '';
      const max = titleEl.clientWidth;
      if (!max) return;
      let natural = textWidth(titleEl);
      if (natural <= max) return;

      /* Text width is near enough linear in font size to solve for
         directly rather than walking the size down a step at a time (which
         used to cost dozens of forced layouts per call, on every track
         change and every frame of a resize). It is not exactly linear —
         hinting and letter-spacing round differently at each size — so one
         corrective pass follows, and only if the first solve left it long.
         Two measurements in the normal case, three in the worst. */
      const base = parseFloat(getComputedStyle(titleEl).fontSize);
      let size = Math.max(10, base * (max / natural));
      titleEl.style.fontSize = `${size}px`;

      natural = textWidth(titleEl);
      if (natural > max) {
        size = Math.max(10, size * (max / natural) * .995);
        titleEl.style.fontSize = `${size}px`;
      }
    }

    /* Which of the two .light-bank stacks (index.html) is lit right now.
       The other one is dark, and is where the next track's colours go. */
    let litBank = 'a';

    /* load() reaches applyLight twice for one track change — once with the
       track's configured fallback colour, then again the moment
       sampleColour() has the real colour out of the artwork, usually in
       the same tick because the decoded bitmap is already warm. Recording
       the colours here and committing separately (below) coalesces any
       same-tick calls into one, so however many times this runs in a row
       the last colours win and the banks swap exactly once for them.

       The other reason a commit is never immediate: pressing next/prev
       fast, or a quick run of swipes, calls this again well before the
       previous crossfade's --tint span is over. Committing on top of an
       in-flight one used to mean recolouring whichever bank was still
       mid-fade rather than genuinely dark — forcing it to black first to
       avoid a hue snapping in at whatever opacity it had reached, which
       just moved the snap from the hue to the opacity itself, and read as
       a flash on every fast change. scheduleCommit() below is what
       actually fixes that: a commit due while one is still running waits
       for it to finish rather than interrupting it, so a flurry of rapid
       changes never starts more than one crossfade at a time — the light
       just settles, once, calmly, on wherever the user finally lands. */
    let pendingLight = null, lightRaf = 0, lightBusyUntil = 0, lightWaitTimer = null;

    function applyLight({ panel, ring, deep, b, c }) {
      const rgb = ([r, g, bl]) => `${r} ${g} ${bl}`;
      /* --dominant is the player panel's own tint, not part of the light
         rig, and nothing animates it — it stays on the root. */
      document.documentElement.style.setProperty('--dominant', rgb(panel));
      pendingLight = { ring: rgb(ring), deep: rgb(deep), b: rgb(b), c: rgb(c) };
      scheduleCommit();
    }

    function scheduleCommit() {
      const now = performance.now();
      if (now < lightBusyUntil) {
        clearTimeout(lightWaitTimer);
        lightWaitTimer = setTimeout(scheduleCommit, lightBusyUntil - now);
        return;
      }
      if (lightRaf) return;   // same-tick coalescing, see the note above
      lightRaf = requestAnimationFrame(() => { lightRaf = 0; commitLight(pendingLight); });
    }

    /* The colours themselves never interpolate any more: they are written
       onto the dark bank in one go, and the *cross-fade* between the two
       banks is what animates. See the long note on .light-bank in
       css/styles.css for why — interpolating these on <html> repainted
       five gradient layers per step, and that was the whole of the drag
       lag after a track change. */
    function commitLight({ ring, deep, b, c }) {
      const next = litBank === 'a' ? 'b' : 'a';
      const incoming = document.querySelectorAll(`.light-bank--${next}`);
      const outgoing = document.querySelectorAll(`.light-bank--${litBank}`);

      incoming.forEach(el => {
        /* scheduleCommit() above guarantees this bank has already finished
           fading out to genuinely dark by the time a commit is allowed to
           land — this reset is a defensive no-op for that ordinary case
           (snapping 0 to 0 is invisible) and only actually does something
           on the very first commit of the page, before either bank has
           run a transition at all. */
        el.style.transition = 'none';
        el.classList.remove('is-lit');
        void el.offsetWidth;              // land the jump before the transition comes back
        el.style.transition = '';
        el.style.setProperty('--ring', ring);
        el.style.setProperty('--ring-deep', deep);
        el.style.setProperty('--led-b', b);
        el.style.setProperty('--led-c', c);
      });

      outgoing.forEach(el => el.classList.remove('is-lit'));
      incoming.forEach(el => el.classList.add('is-lit'));
      litBank = next;

      /* Blocks the next commit until this crossfade has actually finished
         — read off the bank's own resolved transition-duration rather than
         re-deriving --tint here, so the two can't drift apart. */
      lightBusyUntil = performance.now() + parseFloat(getComputedStyle(incoming[0]).transitionDuration) * 1000;

      /* The brightness/saturation surge used to fire from load() on every
         raw press, independently of whether a crossfade was actually
         starting — rapid presses pumped it up and down out of step with
         the (now properly queued) hue changes, its own flash on top of
         theirs. Tied to the same real commit instead, so the two only
         ever move together. */
      flashLight();
    }

    function applyColour(rgb) {
      /* the two contrasting particle colours scattered through the field —
         cyan and mint on a blue lamp, magenta and pink on a purple one.
         Both are stepped off the *lamp* colour rather than the raw artwork:
         taken off the artwork they inherit its saturation, which on a muted
         cover leaves the particles duller than the band they sit in and the
         alternation stops reading at all. */
      const lamp = Colour.vivid(rgb);
      const [t1, t2] = Colour.accentTurns(Colour.toHsl(lamp)[0]);
      applyLight({
        panel: Colour.mute(rgb),
        ring:  lamp,
        deep:  Colour.deep(rgb),
        b:     Colour.accent(lamp, t1, .02),
        c:     Colour.accent(lamp, t2, .07)
      });
    }

    /* a slow surge on every track change, then an even slower release — a
       real lamp climbing to a brighter filament state doesn't snap there in
       under half a second, so the rise now takes as long as the old version
       took to fall. Driven by a body class rather than animated custom
       properties: a plain `filter` transition toggled by class (see
       body.is-surging in css/styles.css, on the .light-surge wrappers) is
       the same class-swap mechanism already used for .gate.is-open and
       .block.is-animating, and doesn't depend on @property support the way
       the previous --flash/--charge version did. The flicker loop keeps
       running underneath the whole time, so the tail of the release still
       carries its own small flicker. */
    let flashTimer = null;
    function flashLight() {
      const body = document.body.classList;
      body.add('is-surging');
      clearTimeout(flashTimer);
      /* --surge-in is a calc() off --tint now (css/styles.css), not a
         fixed number, so its actual duration is read straight off a real
         .light-surge element via transitionDuration rather than
         re-deriving or duplicating that calc() here — the two can't drift
         apart this way, whatever --tint ends up set to. */
      const ms = parseFloat(getComputedStyle($('.light-surge')).transitionDuration) * 1000;
      flashTimer = setTimeout(() => {
        /* released once the rise has actually finished, so the class
           always comes off exactly when there's nothing left for it to
           interrupt */
        body.remove('is-surging');
      }, ms);
    }

    /* The sampled colour of a given piece of artwork never changes, so it
       is worth exactly one measurement for the life of the page. Reading
       it costs a downscaling drawImage of a ~1090px cover plus a
       getImageData — measured at ~24ms the first time an image is put
       through it, and ~0.2ms every time after, once the decoded bitmap is
       warm. Left uncached that 24ms landed on the main thread inside the
       click that changed track, which is a dropped frame right where the
       cursor and the slide are both moving. */
    const sampled = new Map();

    function colourOf(n) {
      if (sampled.has(n)) return sampled.get(n);
      const img = covers[n]?.querySelector('img');
      if (!img || !img.complete || !img.naturalWidth) return undefined;   // not ready — don't cache a miss
      const rgb = Colour.fromImage(img);
      sampled.set(n, rgb);                          // null included: a tainted canvas won't start working later
      return rgb;
    }

    /* refine the panel colour from the real pixels once the cover has decoded */
    function sampleColour() {
      const img = covers[i]?.querySelector('img');
      if (!img) return;
      const n = i;
      const read = () => {
        if (n !== i) return;                       // track changed while decoding
        const rgb = colourOf(n);
        if (rgb) applyColour(rgb);
      };
      if (img.complete && img.naturalWidth) read();
      else img.addEventListener('load', read, { once: true });
    }

    /* Put every cover through the sampler once, while the gate is still up
       and nothing is competing for the main thread — so that by the time
       any of this is reachable the answer is already in the map and a
       track change never samples at all. Spread one per idle callback
       rather than in a single pass, so even this can't hold a frame. */
    function presampleColours() {
      const queue = covers.map((_, n) => n).filter(n => tracks[n].artwork);
      const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 24));
      /* a cover whose file is missing or broken never reports complete, so
         retries are capped rather than open-ended — it simply stays
         unsampled and falls back to its configured `color`, which is what
         would have happened anyway */
      let passes = covers.length * 6;
      const step = () => {
        const n = queue.shift();
        if (n === undefined) return;
        const img = covers[n]?.querySelector('img');
        if (img && img.complete && img.naturalWidth) colourOf(n);
        else if (img && passes-- > 0) queue.push(n);   // not decoded yet — come back to it
        if (queue.length) idle(step);
      };
      idle(step);
    }

    /* build one cover per track — the artwork is a plain <img>, so swapping a
       cover later is just a new path in js/config.js */
    function buildCovers() {
      /* only the cover buttons, not innerHTML = '' — .volume (the flyout
         slider) lives in this same container so it can sit beside the
         artwork, and a blanket clear would delete it along with them. */
      $$('.cover', el.covers).forEach(c => c.remove());
      lastD = null;   // rebuilt covers have no history — re-derive on next placeCovers
      covers = tracks.map((t, n) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'cover';
        c.dataset.cover = n;
        c.setAttribute('aria-label', `Play ${t.title}`);
        /* decoding="async" and, for everything but the opening track,
           fetchpriority="low": these are ~1-2MB artwork images, and
           without this the browser tends to decode all of them right at
           the moment the gate lifts and they first become visible —
           which is exactly when the reveal transition and the light are
           also asking for a frame, and is the "laggy for a few seconds"
           the whole entrance had. Explicit async decoding, plus the eager
           img.decode() calls in Player.preloadArt() run while the gate is
           still up, move that cost earlier so it's finished before
           there's anything to compete with. */
        const priority = n === 0 ? 'high' : 'low';
        c.innerHTML = t.artwork
          ? `<img src="${t.artwork}" alt="${t.title} — artwork" draggable="false" decoding="async" fetchpriority="${priority}">`
          : '<span class="cover__demo"><span>Demo</span></span>';
        c.addEventListener('click', () => {
          if (Carousel.wasDragged() || n === i) return;
          load(n, playing);
        });
        el.covers.appendChild(c);
        return c;
      });
    }

    /* build one .meta-item per track, mirroring buildCovers above — each
       permanently holds one track's title/artist, and app.js only ever
       moves it around (see placeMeta/paintMeta), never rewrites its
       text. fitTitleEl runs once here rather than on every load(), for
       the same reason: the text a given element holds never changes
       again after this. */
    function buildMeta() {
      $$('.meta-item', el.meta).forEach(m => m.remove());
      lastMetaD = null;   // rebuilt items have no history — re-derive on next placeMeta
      metaItems = tracks.map(t => {
        const wrap = document.createElement('div');
        wrap.className = 'meta-item';
        const h1 = document.createElement('h1');
        h1.className = 'player__title';
        h1.textContent = t.title;
        const p = document.createElement('p');
        p.className = 'player__artist';
        p.textContent = t.artist;
        wrap.append(h1, p);
        el.meta.appendChild(wrap);
        const m = { el: wrap, titleEl: h1 };
        fitTitleEl(h1);
        return m;
      });
    }

    /* Ask the browser to fully decode every cover's artwork now, while the
       gate is still up — rather than leaving it to happen implicitly the
       instant each image is first painted, which used to land right on
       top of the reveal transition. img.decode() is exactly this: fetch
       (already under way) plus decode, off the render path, resolving
       once the bitmap is ready to paint for free. Errors are swallowed —
       a missing or unreadable file just decodes normally when it's
       eventually shown instead, same as before this existed.

       One at a time, though, not all at once: these are ~1-2MB images,
       and firing every decode() together means their completions can
       still land in the same handful of frames, which is exactly the
       kind of burst that competes with the one thing actually on screen
       behind the gate — the lagging cursor. Chaining off each promise's
       own resolution, with an idle tick between, spreads that out
       instead of trading one pile-up for another. */
    function preloadArt() {
      const queue = $$('img', el.covers).filter(img => img.decode);
      const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 24));
      const step = () => {
        const img = queue.shift();
        if (!img) return;
        img.decode().catch(() => {}).then(() => { if (queue.length) idle(step); });
      };
      if (queue.length) idle(step);
    }

    /* Neighbours tuck in behind the playing cover, a sliver showing each
       side. With an even track count, exactly one cover is always sitting
       "opposite" the playing one — equidistant going either way round —
       and a fixed left-or-right rule for that one meant it periodically
       swept all the way across the visible stack while fading, instead of
       leaving off whichever side it had actually entered from. `lastD`
       remembers each cover's own last slot, so a cover already parked far
       left keeps going further left (a clean exit), and one already
       parked far right keeps extending right, rather than a single global
       rule picking a side for all of them.

       The one case that still needs help: a cover parked far on side A
       that must now become the new near neighbour on side B (it has
       cycled all the way round). Sliding it across would be the exact bug
       this replaces, so instead it's teleported — transition off, jump to
       the mirror position on side B while it is still fully invisible,
       force the browser to register that position, transition back on —
       and *then* eased in from there. Two paints, no visible motion in
       the first. */
    let lastD = null;

    /* `extra` is the live drag offset (see the drag block below) — a
       fraction of a slot, added on top of every cover's resting integer
       slot for exactly as long as a drag is in progress. Everything that
       only makes sense at a discrete slot (which side a cover counts as,
       whether it can take the pointer, tab order) still keys off the
       plain integer `d`. */
    /* The artwork no longer tracks a swipe at all (see the note on .cover
       in styles.css) — it only ever moves when a track actually changes,
       so `d` is always exactly -1, 0 or 1 here. Kept as its own function
       from when it did handle a live drag rather than folded away,
       since the teleport-jump logic below still earns its keep on every
       plain track change (next/prev is still one cover swapping sides
       every single step, circular-3-stack math unchanged) and reads
       clearest staying close to paintCover. */
    function placeCovers() {
      const n = tracks.length;
      if (!lastD || lastD.length !== n) {
        lastD = covers.map((_, j) => {
          const d0 = (j - i + n) % n;
          return d0 > n / 2 ? d0 - n : d0;
        });
      }

      covers.forEach((c, j) => {
        const d0 = (j - i + n) % n;
        const near = d0 === 0 ? 0 : d0 === 1 ? 1 : d0 === n - 1 ? -1 : null;
        let d;

        if (near !== null) {
          /* Parked on the wrong side to enter smoothly — jump it to the
             mirrored far position first, invisibly, then let it slide in
             from there. With exactly 3 tracks every cover sits at exactly
             -1, 0 or +1 at rest (never further out), so the old
             `Math.abs(lastD[j]) > 1` guard here never actually matched a
             sign flip in ordinary next/prev use — only a cover already
             out past ±1 mid-drag tripped it. That left the one cover
             that has to swap sides on every single step (inherent to a
             3-item circular stack: the "prev" cover is always exactly the
             next "next" cover too) visibly sweeping straight across the
             stack instead of entering from its edge like this branch
             intends. `lastD[j] !== 0` is the correct guard: only a cover
             that was actually sitting on a side (not centred) needs the
             teleport, regardless of how far out it was. */
          if (near !== 0 && lastD[j] !== 0 && Math.sign(lastD[j]) !== Math.sign(near)) {
            c.style.transition = 'none';
            paintCover(c, Math.sign(near) * 2);
            void c.offsetWidth;          // force the jump to land before re-enabling
            c.style.transition = '';
          }
          d = near;
        } else {
          /* still off to one side — keep extending the same way it was
             already headed rather than re-deriving a fresh shortest path */
          d = lastD[j] < 0 ? d0 - n : d0;
        }

        lastD[j] = d;
        const a = Math.abs(d);
        const side = a === 1;
        c.classList.toggle('cover--side', side);
        paintCover(c, d);
        c.style.zIndex = String(10 - a);
        /* the playing cover takes the pointer too, so it can lift on hover
           like its neighbours — its click handler is a no-op. Only the
           fully hidden ones stay out of the way. */
        c.style.pointerEvents = a <= 1 ? 'auto' : 'none';
        c.tabIndex = side ? 0 : -1;
      });
    }

    /* Tucked in behind the playing cover, a closer sliver showing each
       side than before — brought in from 19% toward the middle for a
       tidier stack now that it's static rather than something a drag
       used to pull wide open. No scale and no opacity fade: a side cover
       reading dimmer is the veil pseudo-element below, a flat overlay
       rather than a transparency change on the cover itself, which on a
       3-track stack (every cover is always centred or one of the two
       sides — there's no fourth, fully hidden slot to fade toward) would
       otherwise show the track behind it through mid-change. */
    function paintCover(c, d) {
      c.style.transform = `translate(-50%, -50%) translateX(${(d * 13).toFixed(2)}%)`;
    }

    /* ---- title/artist carousel ---------------------------------
       Where the artwork's old drag-tracking behaviour actually lives now
       — the title and artist for every track sit stacked in the same
       box (.player__meta), one .meta-item each, and sliding one all the
       way off to a side (±100%, a full container-width) is what brings
       the next or previous one fully in. Same shape as placeCovers/
       paintCover above (same teleport-jump handling for the one item
       that has to swap sides every step, same continuous `d`), just with
       its own history array and its own, much simpler paint — one
       property, no z-index/pointer-events bookkeeping, since only text
       ever needs to actually receive input here (the currently-centred
       item; the rest sit under .player__meta's own overflow:hidden). */
    let lastMetaD = null;

    function placeMeta(extra = 0) {
      const n = tracks.length;
      if (!lastMetaD || lastMetaD.length !== n) {
        lastMetaD = metaItems.map((_, j) => {
          const d0 = (j - i + n) % n;
          return d0 > n / 2 ? d0 - n : d0;
        });
      }

      metaItems.forEach((m, j) => {
        const d0 = (j - i + n) % n;
        const near = d0 === 0 ? 0 : d0 === 1 ? 1 : d0 === n - 1 ? -1 : null;
        let d;

        if (near !== null) {
          if (near !== 0 && lastMetaD[j] !== 0 && Math.sign(lastMetaD[j]) !== Math.sign(near)) {
            m.el.style.transition = 'none';
            paintMeta(m, Math.sign(near) * 2);
            void m.el.offsetWidth;
            m.el.style.transition = '';
          }
          d = near;
        } else {
          d = lastMetaD[j] < 0 ? d0 - n : d0;
        }

        lastMetaD[j] = d;
        /* keyed off the resting slot alone, not `extra` — the track a
         screen reader should announce as current doesn't change just
         because a swipe is live-previewing a neighbour, only once that
         swipe actually commits (which moves `i`, and so `d`, itself).
         Also sidesteps needing an exact float match against a spring's
         last, possibly not-quite-zero frame. */
        m.el.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
        paintMeta(m, d + extra);
      });
    }

    function paintMeta(m, d) {
      m.el.style.transform = `translateX(${(d * 100).toFixed(2)}%)`;
    }

    /* ---- swipe-to-rotate ---------------------------------------
       Apple Music-style: dragging left or right across the artwork (or
       the title/artist itself) spins the title/artist carousel above,
       live-tracking the pointer the whole way rather than only reacting
       once released, while the artwork sits still. The stack only
       actually swaps once a track change lands — see the note on .cover
       in styles.css. `swipeMoved` tells a real drag apart from a tap on
       a side cover, which still switches tracks the old way (the
       existing click listener in buildCovers). */
    /* fraction of the artwork's width that counts as one full slot of
       drag — lower is more sensitive. Raised a good deal from an initial
       .58 (itself close to Carousel's own .62): that read as reacting
       to almost nothing, a small movement already most of the way to
       committing. Raised again, further still, after that still let a
       single long-held drag (an ordinary swipe travels well past the
       artwork's own width) reach LIVE_DRAG_CAP below. Still measured off
       the artwork (el.covers) even though it's the meta carousel moving
       now — same physical surface either way, and a consistent, familiar
       feel is worth more here than a number re-derived from the text
       box's own (much larger, full-width) travel. */
    const DRAG_SLOT = 1.9;
    /* a mouse can drag the cursor further than a thumb can ever drag a
       touch point — the artwork itself is a small, fixed target, but a
       mouse isn't limited to it the way a finger practically is.
       Measuring mouse input off that same small reference meant an
       ordinary mouse drag could sail straight past LIVE_DRAG_CAP and
       then just sit there, pinned, while the cursor kept moving — a dead
       zone that read as the carousel seizing up mid-drag. Tried scaling
       this off the viewport instead (innerWidth * 3) — wrong in the
       other direction: on an actual laptop screen that put a full slot
       several thousand px away, so nothing visibly moved for any drag a
       hand normally makes. A fixed distance turned out to be the right
       call either way — mouse drags don't get longer on a bigger screen,
       people just don't drag a mouse that far — chosen so a normal few-
       hundred-px drag clearly shows the neighbour, while still wanting a
       genuinely deliberate pull to reach the cap. */
    const MOUSE_SLOT_PX = 620;
    /* how far, in CSS px, one full slot of drag is — touch/pen scale off
       the artwork's own width, mouse is the fixed distance above */
    function slotWidth(pointerType) {
      return pointerType === 'mouse' ? MOUSE_SLOT_PX : (el.covers.offsetWidth || 1) * DRAG_SLOT;
    }
    /* however far past that a held drag still goes, it's never allowed to
       actually finish the trip on its own — the incoming title can get
       close to centred while the finger is still down, never exactly
       there. Reaching 0 is what a *release* means (a commit's spring
       settle, or the settle-back snapping there instantly); reaching it
       just by holding and dragging far enough collapsed that distinction
       entirely, and read as the carousel finishing the swap on its own
       before the gesture had actually ended. */
    const LIVE_DRAG_CAP = .78;
    const DRAG_COMMIT = .18; // matches Carousel's own commit threshold
    /* a flick can commit well short of DRAG_COMMIT's distance if it's
       fast enough — units are DRAG_SLOT-normalised extra per ms, so this
       is "cover a bit over half a slot in 100ms". Raised alongside
       DRAG_SLOT above and MAX_SPRING_VELOCITY below — same complaint,
       one cause: small, fast flicks were both easy to trigger and, once
       released, energetic enough to overshoot past the very neighbour
       they'd just committed to (see the note on MAX_SPRING_VELOCITY). */
    const FLICK_VELOCITY = .006;

    /* ---- release physics ---------------------------------------
       A flick should carry its own speed into the settle rather than
       every release animating at the same fixed rate regardless of how
       fast the finger was moving — modelled as a critically damped
       spring released from wherever the drag actually left off, at the
       speed it was actually moving. `.player__meta.is-sliding` is what
       keeps .meta-item's own CSS transition off during this — the same
       class the drag itself uses — so this reads as the drag continuing
       under its own momentum after the fingertip lets go, right up
       until it settles.

       Critically damped only rules out *oscillation* (repeatedly
       crossing the target and correcting) — it doesn't rule out a
       single overshoot, and a fast enough release velocity absolutely
       produces one: released close to a neighbouring slot with enough
       speed, the maths carries it straight through 0 and out the other
       side, which is exactly how a small, quick flick was showing a
       *second* neighbour it never should have reached at all. Two belts
       for that one buckle: the speed actually fed to the spring is
       capped well below where that becomes possible, and the position
       is hard-clamped to ±1 every frame regardless — nothing this
       reads as a track away, however hard the flick, full stop.

       Raised from 210 — a typical release now settles in roughly the
       same window as .cover's own fixed .36s transition (still
       critically damped throughout, SPRING_DAMPING is derived from
       this, not a separate number to keep in sync by hand), so a
       swiped change reads as noticeably snappier without losing the
       "continues under its own momentum" feel a plain CSS transition
       wouldn't have given it. */
    const SPRING_STIFFNESS = 340;
    const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS);
    const SPRING_REST_EPS = .001;
    const MAX_SPRING_VELOCITY = 3.5;
    let springRaf = null;

    function stopSpring() {
      if (springRaf) cancelAnimationFrame(springRaf);
      springRaf = null;
      el.meta.classList.remove('is-sliding');
    }

    function springTo(target, initialVelocity, onSettle) {
      stopSpring();
      el.meta.classList.add('is-sliding');
      let velocity = clamp(initialVelocity, -MAX_SPRING_VELOCITY, MAX_SPRING_VELOCITY);
      let last = performance.now();
      (function step(now) {
        const dt = Math.min((now - last) / 1000, 1 / 30);   // clamp a stalled tab's catch-up jump
        last = now;
        const accel = -SPRING_STIFFNESS * (dragExtra - target) - SPRING_DAMPING * velocity;
        velocity += accel * dt;
        dragExtra = clamp(dragExtra + velocity * dt, -1, 1);
        if (Math.abs(dragExtra - target) < SPRING_REST_EPS && Math.abs(velocity) < SPRING_REST_EPS) {
          dragExtra = target;
          placeMeta(dragExtra);
          springRaf = null;
          el.meta.classList.remove('is-sliding');
          onSettle?.();
          return;
        }
        placeMeta(dragExtra);
        springRaf = requestAnimationFrame(step);
      })(last);
    }

    /* bound to both the artwork and the title/artist itself — see init()
       below — so either one answers a swipe; e.currentTarget (not
       e.target) is what receives pointer capture, whichever of the two
       the gesture actually started on */
    let swipeSurface = null;

    function swipeDown(e) {
      if (tracks.length <= 1) return;   // nothing to drag to
      if (e.target.closest('.ctrl, a, .scrub')) return;
      /* grabbing the carousel again mid-settle picks up from wherever the
         spring already had it, rather than snapping to 0 first — offset
         swipeStartX so the very next swipeMove reconstructs the current
         dragExtra exactly, and only moves it from there */
      swipePointerType = e.pointerType || 'touch';
      /* measured once here rather than inside swipeMove below, which used
         to call slotWidth() — and for touch, its el.covers.offsetWidth
         read — on every single raw pointermove. That forces a synchronous
         layout flush, and while that's normally near-free, the perf HUD
         (?perf=1) showed a run of dropped frames starting right at track
         change and lasting ~2s that persisted even with the light's own
         crossfade and surge transitions independently ruled out — i.e.
         something else was still settling for the browser to flush on
         every one of those forced reads. The artwork's width can't
         change mid-drag, so there's nothing this loses by only reading
         it once per gesture instead of dozens of times a second. */
      dragSlotPx = slotWidth(swipePointerType);
      swipeStartX = e.clientX - dragExtra * dragSlotPx;
      stopSpring();
      swipeSurface = e.currentTarget;
      swipeDragging = true; swipeCaptured = false; swipeMoved = 0;
      dragVelocity = 0; lastMoveT = performance.now();
      swipePid = e.pointerId;
    }
    /* Pointermove can fire far faster than the screen redraws — a real
       mouse or trackpad easily beats 60Hz — and placeMeta() writes a
       transform on every meta-item each time it runs. Without this, a
       fast drag was queuing up several full repaints per frame for paint
       work the previous one hadn't even reached the screen for yet,
       which is exactly the kind of self-inflicted lag that also drags
       the cursor down with it. Only the latest pointer position before
       each frame ever needs painting, so pending moves collapse into one
       instead of piling up. Velocity is tracked here instead, off the
       raw events rather than the throttled paint, since it's what feeds
       the release spring below and a paint-frame's worth of lag on that
       would read as the flick not quite matching the finger. */
    let swipeMoveQueued = false;
    function swipeMove(e) {
      if (!swipeDragging) return;
      const dx = e.clientX - swipeStartX;
      swipeMoved = Math.max(swipeMoved, Math.abs(dx));
      if (!swipeCaptured) {
        if (swipeMoved < 6) return;
        swipeCaptured = true;
        swipeSurface?.setPointerCapture?.(swipePid);
        el.meta.classList.add('is-sliding');
      }
      const next = clamp(dx / dragSlotPx, -LIVE_DRAG_CAP, LIVE_DRAG_CAP);
      const now = performance.now(), dt = now - lastMoveT;
      if (dt > 0) {
        /* smoothed rather than taken raw — consecutive pointermove deltas
           are noisy enough (device sampling, sub-pixel jitter) that the
           instantaneous value alone spikes around on an otherwise steady
           drag. Weighted toward the newest sample rather than a slower,
           heavier average: a real flick is over in 2-4 events, and a
           slower-converging blend was still mostly reflecting the
           standing-start 0 it began from by the time the finger lifted,
           never getting the chance to register as fast at all. */
        const instant = (next - dragExtra) / dt;
        dragVelocity = dragVelocity * .45 + instant * .55;
      }
      lastMoveT = now;
      dragExtra = next;
      if (swipeMoveQueued) return;
      swipeMoveQueued = true;
      requestAnimationFrame(() => {
        swipeMoveQueued = false;
        if (swipeCaptured) placeMeta(dragExtra);
      });
    }
    function swipeUp(e = {}) {
      if (!swipeDragging) return;
      swipeDragging = false;
      if (swipeCaptured && swipePid !== null) swipeSurface?.releasePointerCapture?.(swipePid);
      swipePid = null; swipeSurface = null;

      if (swipeCaptured) {
        const committed = Math.abs(dragExtra) > DRAG_COMMIT || Math.abs(dragVelocity) > FLICK_VELOCITY;
        let hapticGenForSwipe = null;
        if (committed) {
          const stepDir = Math.sign(dragExtra) || Math.sign(dragVelocity);
          // swaps the artwork itself, instantly — see .cover's own transition.
          // textSpring:true tells hapticStart the title/artist below isn't
          // on a fixed CSS transition this time — the spring's own settle
          // (onSettle below) reports its own landing in instead.
          load(i - stepDir, playing, { textSpring: true });
          hapticGenForSwipe = hapticGen;
          /* the carousel continues from here, in the new index's frame,
             one slot further along rather than restarting from a
             standing start */
          dragExtra -= stepDir;
          placeMeta(dragExtra);
        }
        // ms -> seconds, to match the spring's own units. Only a committed
        // change is waiting on a haptic pulse — a released-but-uncommitted
        // drag just springs back to the same track, nothing to buzz for.
        springTo(0, dragVelocity * 1000, committed
          ? () => { hapticTextReady = true; hapticCheck(hapticGenForSwipe); }
          : undefined);
      } else if (swipeMoved < 6) {
        /* a tap rather than a drag — same behaviour as the side covers'
           own click listener, just reached through the pointer sequence
           instead of a separate click event */
        const hit = e.target?.closest('.cover');
        const n = covers.indexOf(hit);
        if (n > -1 && n !== i) load(n, playing);
      }
      swipeCaptured = false;
    }

    /* A guard against accidental rapid re-fires, not a rate limit on
       deliberate browsing. Measured directly: the slide's own transition
       (duration, easing, target values) is already byte-for-byte identical
       regardless of which control calls load() — verified with matched,
       controlled runs through both the small transport buttons and the
       big arrows. The one real difference is physical: the small buttons
       are a fraction of the big arrows' hit area and sit flush against the
       artwork, which makes an accidental double-click far more likely
       there — and a second load() landing mid-slide restarts the
       transition from wherever it already got to, which looks and feels
       shorter than the full thing. This closes that gap for every trigger
       at once, since they all funnel through here. */
    let lastLoadAt = -Infinity;   // never blocks the very first call, however early it runs

    /* ---- haptic pulse on landing ---------------------------------
       One short buzz right as the artwork and the title/artist actually
       land centred together — not on every load() call in isolation,
       since the two don't always finish at the same time by the same
       mechanism. On a button/keyboard/click-triggered change both are
       plain, fixed .36s CSS transitions (matched exactly — see
       .cover/.meta-item in css/styles.css), so a single timer covers
       both. A swipe's own release instead settles .meta-item through
       the spring above (springTo), whose duration depends on how fast
       the flick was — there's no fixed number to time a second call
       against, so that path is told to wait (textSpring below) and the
       spring's own settle (springTo's onSettle callback) reports in
       for real once it actually happens. Two independent "ready" flags,
       gated by generation so a second change landing before the first
       finishes cancels its pending pulse rather than firing two. */
    let hapticGen = 0, hapticCoverReady = false, hapticTextReady = false;
    function hapticPulse() {
      triggerHaptic();   // real Taptic tick on iOS, navigator.vibrate() elsewhere — see triggerHaptic, top of file
    }
    function hapticCheck(gen) {
      if (gen === hapticGen && hapticCoverReady && hapticTextReady) hapticPulse();
    }
    function hapticStart({ textSpring = false } = {}) {
      hapticGen++;
      const gen = hapticGen;
      hapticCoverReady = false;
      hapticTextReady = false;
      setTimeout(() => { hapticCoverReady = true; hapticCheck(gen); }, 360);
      if (!textSpring) setTimeout(() => { hapticTextReady = true; hapticCheck(gen); }, 360);
      return gen;
    }

    function load(n, autoplay, { haptic = true, textSpring = false } = {}) {
      const now = performance.now();
      if (now - lastLoadAt < 220) return;
      lastLoadAt = now;

      i = ((n % tracks.length) + tracks.length) % tracks.length;
      const t = track();

      /* Covers a cover's hover lift/veil-fade for exactly as long as the
         swap below runs (.3s — matches .cover's own transform transition).
         Without it, whichever cover the pointer happens to already be
         resting on when it lands would ALSO start its hover transition on
         top of the swap — the small transport buttons sit right under the
         artwork, so that's the common case there, and it's what read as
         an extra hop only on that path. Cleared and reset on every call
         so a rapid run of clicks keeps it suppressed the whole time
         rather than flickering back on between them. */
      el.covers.classList.add('is-changing');
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => el.covers.classList.remove('is-changing'), 450);

      /* the artwork swaps straight to its new resting slots — paintCover's
         own short CSS transition. placeMeta() here is the default entry
         a button, keyboard or direct tap needs; a swipe's own commit (see
         swipeUp) overrides this transient call itself, in the same tick,
         before it ever gets a frame to be seen — .player__meta is still
         mid-drag (is-sliding, transition off) at this exact point either
         way, so nothing here flashes regardless of which path called it. */
      placeCovers();
      placeMeta();
      if (haptic) hapticStart({ textSpring });

      /* Held back rather than fired in the same tick as the slide above —
         starting the light's own repaint work (applyColour's --tint
         crossfade) at the exact moment the cover and meta-item transitions
         also start had them fighting over the same handful of frames,
         doubling up exactly where things were already tightest.
         .meta-item's transform transition matches .cover's own exactly now
         (.36s each — see css/styles.css), so this just waits that long
         before asking for anything else. Guarded by index
         the same way sampleColour() below already is: if another load()
         lands before this fires, i has moved on and this one's result is
         stale, so it's skipped rather than briefly flashing the wrong
         track's colour in over the new one.

         flashLight() used to be called from here too, on every press —
         now it only ever runs from inside commitLight() (above), which
         itself won't actually commit until any crossfade already running
         has finished. A fast run of next/prev used to start a new surge
         on each press regardless of whether the hue crossfade underneath
         it was even ready to move, which is what read as instant flashing
         rather than one settled change. */
      clearTimeout(lightTimer);
      const lightFor = i;
      lightTimer = setTimeout(() => {
        if (lightFor !== i) return;
        if (t.demo || !t.artwork) {
          applyLight(DEMO_LIGHT);
        } else {
          applyColour(Colour.toRgb(t.color || '#141418'));
          sampleColour();
        }
      }, 400);

      fallback = false; fakeTime = 0;
      /* a copy already in memory is seekable from the first frame, so use
         it when there is one and only fall back to streaming the URL
         while the download is still in flight — see makeSeekable() */
      audio.src = audioBlobs.get(i) || t.audio || '';
      audio.load();
      if (t.audio && !audioBlobs.has(i)) makeSeekable(i);
      el.note.hidden = true;
      resetPaintCache();
      paint();
      /* duration() falls back to the config value above until the file's
         real metadata is in — repaint once it lands so a stale/incorrect
         config number (or a paused track, which tick()'s loop never
         touches) still settles on the right total instead of getting
         stuck. Guarded by track index in case another load() already
         moved on by the time this fires. */
      const switchedTo = i;
      audio.addEventListener('loadedmetadata', () => { if (switchedTo === i) paint(); }, { once: true });
      if (autoplay) play();
    }

    /* ---- seekable audio ------------------------------------------
       Neither the dev server nor the live host answers HTTP Range
       requests for these files: both return the whole thing with a plain
       200 and no `accept-ranges`. A media element fed that way reports
       `seekable` as [0, 0] and silently ignores every `currentTime`
       write — which is why the timeline only ever moved on the one track
       with no audio file at all, since that runs on the JS fallback clock
       instead of the element.

       Downloading the file once and handing the element a blob: URL
       sidesteps the whole negotiation: the bytes are already local, so
       the browser will seek anywhere in them. Verified directly —
       `seekable` goes from [0, 0] to [0, duration] on the swap. */
    const audioBlobs = new Map();     // track index -> object URL
    const audioFetches = new Map();   // track index -> in-flight promise

    function fetchAudioBlob(n) {
      if (audioBlobs.has(n)) return Promise.resolve(audioBlobs.get(n));
      if (audioFetches.has(n)) return audioFetches.get(n);
      const src = tracks[n]?.audio;
      if (!src) return Promise.resolve(null);

      const p = fetch(encodeURI(src))
        .then(r => r.ok ? r.blob() : null)
        .then(b => {
          if (!b) return null;
          const url = URL.createObjectURL(b);
          audioBlobs.set(n, url);
          return url;
        })
        /* a failed download just leaves the streaming source in place —
           playback still works, only scrubbing stays unavailable */
        .catch(() => null)
        .finally(() => audioFetches.delete(n));

      audioFetches.set(n, p);
      return p;
    }

    /* Swap the element onto the downloaded copy once it lands, keeping the
       playhead and the play state exactly where they were. Bails out if
       the track changed while the download was in flight. */
    function makeSeekable(n) {
      fetchAudioBlob(n).then(url => {
        if (!url || n !== i) return;
        const at = audio.currentTime;
        const wasPlaying = !audio.paused;
        audio.src = url;
        audio.load();
        audio.addEventListener('loadedmetadata', () => {
          if (n !== i) return;
          const resume = () => { if (wasPlaying) audio.play().catch(() => {}); };
          /* Resuming right after setting currentTime, without waiting for the
             seek to actually land, is a race: the browser can start playback
             from 0 instead, which is exactly what this function exists to
             avoid — the track would audibly jump back to the beginning the
             moment the background download finished. `seeked` is the
             browser's own confirmation the position took. */
          if (at) {
            audio.addEventListener('seeked', resume, { once: true });
            audio.currentTime = at;
          } else {
            resume();
          }
        }, { once: true });
      });
    }

    /* Last values actually written to the DOM. paint() runs on every frame,
       so the rule here is that nothing is touched unless it changed — the
       old version rewrote all five of these 60 times a second.

       That was the whole reason the bar looked laggy rather than smooth:
       .scrub__fill and .scrub__head carry a .18s transition, and rewriting
       their target every frame restarts it every frame, so they never got
       to finish and always trailed the real position. Writing only on a
       real change lets the transition do its job — it now smooths the step
       between updates instead of fighting them.

       The clock was the other half: currentTime moves continuously but the
       label only shows seconds, so 59 of every 60 writes reflowed the
       timeline to produce identical text. */
    let lastStep = -1, lastCur = '', lastDur = '', lastAria = -1;

    function paint() {
      const d = duration(), p = d ? clamp(position() / d, 0, 1) : 0;

      /* a thousandth of the bar is well under a pixel at any size this
         layout reaches, so this is finer than the eye and still turns a
         per-frame write into a handful per second */
      const step = Math.round(p * 1000);
      if (step !== lastStep) {
        lastStep = step;
        el.fill.style.width = `${step / 10}%`;
      }

      const cur = time(position());
      if (cur !== lastCur) { lastCur = cur; el.cur.textContent = cur; }

      const dur = time(d);
      if (dur !== lastDur) { lastDur = dur; el.dur.textContent = dur; }

      const aria = Math.round(p * 100);
      if (aria !== lastAria) { lastAria = aria; el.scrub.setAttribute('aria-valuenow', aria); }
    }

    /* a track change moves the playhead back to zero — the cached values
       have to go with it, or the first paint of the new track is skipped
       as "unchanged" and the bar stays where the last one ended */
    function resetPaintCache() { lastStep = -1; lastCur = ''; lastDur = ''; lastAria = -1; }

    function play() {
      playing = true;
      el.play.dataset.state = 'playing';
      el.play.setAttribute('aria-label', 'Pause');
      lastTick = performance.now();
      if (!fallback) audio.play().catch(() => { fallback = true; el.note.hidden = false; });
    }
    function pause() {
      playing = false;
      el.play.dataset.state = 'paused';
      el.play.setAttribute('aria-label', 'Play');
      if (!fallback) audio.pause();
    }
    /* the button's own "punch" on every press — a brief scale-down-and-back
       (css/styles.css, .ctrl--play.is-punching) layered under the icon
       swap's grow-from-nothing. Restarted from scratch (remove, force a
       reflow, re-add) rather than just re-adding, so mashing the button
       replays the punch each time instead of the class already being
       present doing nothing on the second press. */
    let punchTimer = null;
    function punchPlay() {
      el.play.classList.remove('is-punching');
      void el.play.offsetWidth;
      el.play.classList.add('is-punching');
      clearTimeout(punchTimer);
      punchTimer = setTimeout(() => el.play.classList.remove('is-punching'), 380);
    }
    const toggle = () => { punchPlay(); playing ? pause() : play(); };

    /* Used to cap paint() to ~15 calls/sec while playing (a throttling
       EXPERIMENT, guarding against a suspected perf cost that turned out
       not to be this). Reverted: at that cadence, .scrub__fill's own
       .18s transition was catching up in bursts between writes rather
       than reading as one continuous sweep — every ~66ms a chunk of
       travel would land and ease in, then sit still until the next
       write, over and over, which is exactly what read as the bar
       stepping rather than filling. paint() runs on every rAF tick
       again now; at the fine 1/1000 step resolution below, most frames
       still don't actually touch the DOM (a real change in the rounded
       step, not the frame rate, is still what gates a write) — this
       just lets it write as often as the position genuinely moves,
       instead of on a fixed clock that didn't line up with it. */
    function tick(now) {
      if (playing && fallback && !scrubbing) {
        fakeTime += (now - lastTick) / 1000;
        if (fakeTime >= duration()) { fakeTime = 0; load(i + 1, true); }
      }
      lastTick = now;
      /* Nothing moves while paused, so there is nothing to repaint. This
         used to run every frame regardless, rebuilding both clock strings
         and re-deriving the bar position sixty times a second for a
         playhead that was standing still. Every other thing that moves the
         playhead — load(), a seek, metadata arriving — paints for itself. */
      if (playing && !scrubbing) paint();
      requestAnimationFrame(tick);
    }

    /* "previous" rewinds to the top of the current track first, the way a
       physical transport does, and only steps back if you hit it again
       within the first few seconds */
    const prevTrack = () => load(position() > 4 ? i : i - 1, playing);
    const nextTrack = () => load(i + 1, playing);

    /* Every scrub gesture — tap, hold-and-release-in-place, or a genuine
       drag — used to call a version of this that set audio.currentTime
       directly, whether from pointerdown or every subsequent pointermove.
       During playback that meant it was audibly fast-forwarding for the
       entire time a finger was down, not just once it lifted — and
       holding at the far right kept re-setting currentTime to (at or
       past) duration on every move event still firing while held there,
       which could re-trigger the audio element's own 'ended' handler
       (load(i+1, true)) more than once in a row: read as rapidly
       skipping through several tracks back to back, and inconsistently
       so depending on exactly how many move events landed before
       release. previewFromEvent is the fix: it paints where a release
       would land — the fill and the live clock — without ever touching
       audio.currentTime/fakeTime itself. scrubRelease below is the only
       place that actually commits it, exactly once per gesture, so
       'ended' can only ever fire at most once, right at release, same
       as a real seek always should. */
    let scrubPreviewP = null;
    function previewFromEvent(e) {
      const r = el.scrub.getBoundingClientRect();
      const p = clamp((e.clientX - r.left) / r.width, 0, 1);
      scrubPreviewP = p;
      el.fill.style.width = `${(p * 100).toFixed(1)}%`;
      el.cur.textContent = time(p * duration());
      el.scrub.setAttribute('aria-valuenow', Math.round(p * 100));
    }

    /* ---- volume -----------------------------------------------
       A vertical fader in the flyout .volume opens beside the artwork
       (js/app.js Volume wiring in init(), styles in css/styles.css). Reads
       bottom-up, like a physical fader: 0% at the bottom, 100% at the top. */
    let volDragging = false, muted = false;
    function setVolume(v, { persist = true } = {}) {
      v = clamp(v, 0, 1);
      audio.volume = v;
      const pct = `${(v * 100).toFixed(1)}%`;
      el.volFill.style.height = pct;
      el.volHead.style.bottom = pct;
      el.volTrack.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      if (persist) { try { localStorage.setItem('kas-volume', String(v)); } catch (_) {} }
    }
    function volumeFromEvent(e) {
      const r = el.volTrack.getBoundingClientRect();
      setVolume((r.bottom - e.clientY) / r.height);
    }
    /* The native mute flag, not "drop the fader to 0 and remember where
       to restore it to" (the previous approach here) — that relied on
       setVolume(0), which writes to audio.volume, and audio.volume is
       read-only in practice on iOS (Apple reserves volume for the
       hardware buttons only, since iOS 5 — assigning to it silently
       no-ops). That's exactly why mute did nothing at all on iPhone:
       every setMuted() call was a no-op write under the hood there.
       audio.muted carries none of that restriction and works identically
       everywhere, and it leaves the fader's own level untouched while
       muted instead of this having to save and restore it by hand. */
    function setMuted(next) {
      if (next === muted) return;
      muted = next;
      audio.muted = muted;
      el.volToggle.classList.toggle('is-muted', muted);
      el.volToggle.setAttribute('aria-label', muted ? 'Unmute' : 'Volume');
    }
    function openVolume() {
      el.volume.classList.add('is-open');
      el.volToggle.classList.add('is-open');
      el.volToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-volume-open');
    }
    function closeVolume() {
      el.volume.classList.remove('is-open');
      el.volToggle.classList.remove('is-open');
      el.volToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-volume-open');
    }

    return {
      init(list) {
        tracks = list;
        buildCovers();
        buildMeta();
        preloadArt();
        presampleColours();

        el.play.dataset.state = 'paused';
        el.play.addEventListener('click', toggle);
        el.prev.addEventListener('click', prevTrack);
        el.next.addEventListener('click', nextTrack);

        /* swipe either the artwork or the title/artist itself to step
           through tracks, in either direction — see
           swipeDown/swipeMove/swipeUp above. Bound to both surfaces so
           either answers the gesture; only the title/artist actually
           moves (Apple Music-style — see the note on .cover in
           styles.css), regardless of which one the drag started on. */
        for (const surface of [el.covers, el.meta]) {
          surface.addEventListener('pointerdown', swipeDown);
          surface.addEventListener('pointermove', swipeMove);
          surface.addEventListener('pointerup', swipeUp);
          surface.addEventListener('pointercancel', swipeUp);
          /* fires whenever capture is taken away for any reason, not just
             a pointerup/pointercancel this code itself triggered — the
             one that actually matters is a mouse: releasing the button
             while the cursor has drifted outside the browser window
             entirely isn't guaranteed to deliver pointerup back to the
             page at all, and without this the drag was left permanently
             "held", chasing every future mousemove around the screen
             until the page reloaded.

             Mouse only, deliberately — iOS Safari fires this one early
             (right as setPointerCapture is called, not when capture is
             actually lost) for touch input, which was ending every swipe
             the instant it started capturing and reads as "swiping does
             nothing at all". Touch never has the off-window-release
             problem this exists for in the first place, so scoping it to
             mouse loses nothing and stops it misfiring there. */
          surface.addEventListener('lostpointercapture', e => { if (e.pointerType === 'mouse') swipeUp(e); });
          surface.addEventListener('dragstart', e => e.preventDefault());
        }
        /* belt-and-braces alongside lostpointercapture above — losing
           focus (alt-tab, clicking another app) mid-drag with the mouse
           button still down won't always fire either capture event, but
           it always fires this. */
        addEventListener('blur', () => { if (swipeDragging) swipeUp(); });

        /* ←/→ step tracks now that the carousel is a single panel. The
           scrubber stops these reaching here when it has focus, so seeking
           with the keyboard still works. */
        addEventListener('keydown', e => {
          if (e.key === 'ArrowRight') nextTrack();
          if (e.key === 'ArrowLeft')  prevTrack();
        });

        audio.addEventListener('error', () => { fallback = true; el.note.hidden = false; });
        audio.addEventListener('loadedmetadata', () => { fallback = false; el.note.hidden = true; paint(); });
        audio.addEventListener('ended', () => load(i + 1, true));

        /* scrubbing */
        el.scrub.addEventListener('pointerdown', e => {
          scrubbing = true;
          el.scrub.classList.add('is-held');   // the track's own thickness — see styles.css
          el.scrub.setPointerCapture(e.pointerId);
          /* previewFromEvent even here, not a real seek — holding down
             and going nowhere used to jump the track immediately on
             touch, before there was any way to tell a press-and-hold
             apart from a quick tap. Every gesture now previews on down
             and commits exactly once on release (below); a genuinely
             quick tap still reads as instant, since its release follows
             within a handful of milliseconds of the down that already
             painted the preview there. */
          previewFromEvent(e);
        });
        el.scrub.addEventListener('pointermove', e => {
          if (!scrubbing) return;
          /* real movement, not just a held tap — from here on the fill
             should sit under the finger, not ease toward it (that .18s
             is for playback filling in between updates; dragging it
             yourself, it reads as lag). Added on the first actual move
             rather than a timer off pointerdown itself: a timer was
             cutting the tap's own animation short after one frame
             regardless of whether the gesture was still just a tap,
             which defeated the point of it entirely. */
          el.scrub.classList.add('is-scrubbing');
          previewFromEvent(e);
        });
        const scrubRelease = e => {
          if (!scrubbing) return;
          scrubbing = false;
          el.scrub.classList.remove('is-scrubbing', 'is-held');
          el.scrub.releasePointerCapture(e.pointerId);
          /* the actual seek, committed exactly once, on every release —
             tap, hold-and-release-in-place, or a genuine drag alike. */
          if (scrubPreviewP !== null) {
            const d = duration();
            if (fallback) fakeTime = scrubPreviewP * d; else audio.currentTime = scrubPreviewP * d;
            paint();
          }
          scrubPreviewP = null;
        };
        el.scrub.addEventListener('pointerup', scrubRelease);
        el.scrub.addEventListener('pointercancel', scrubRelease);
        el.scrub.addEventListener('keydown', e => {
          const d = duration();
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.stopPropagation();
            const step = (e.key === 'ArrowRight' ? 5 : -5);
            if (fallback) fakeTime = clamp(fakeTime + step, 0, d);
            else audio.currentTime = clamp(audio.currentTime + step, 0, d);
            paint();
          }
        });

        addEventListener('keydown', e => {
          if (e.code === 'Space' && Carousel.current() === 'player'
              && !e.target.closest('a, button')) { e.preventDefault(); toggle(); }
        });

        /* volume */
        let savedVolume = 1;
        try {
          const sv = parseFloat(localStorage.getItem('kas-volume'));
          if (isFinite(sv)) savedVolume = clamp(sv, 0, 1);
        } catch (_) {}
        setVolume(savedVolume, { persist: false });

        /* iOS Safari (and every other browser on iOS — Chrome, Firefox,
           all of them are forced onto the same WebKit engine there)
           makes real playback volume hardware-buttons-only by policy.
           Used to be detected at runtime instead — write a throwaway
           value to audio.volume, then check whether it actually stuck.
           That doesn't hold up on a real iPhone: on current iOS/WebKit
           the *property* round-trips completely normally (read back
           whatever was just assigned), even though the real audible
           output never moves — so the probe reported "controllable",
           the fader opened, and dragging it visibly moved but silently
           did nothing, which is exactly what this looked like live.
           IS_IOS (top of file, shared with triggerHaptic) sidesteps that
           the same way: platform-detected, nothing at runtime to be
           fooled by. */
        const volumeControllable = !IS_IOS;

        /* first click opens the fader; a second click landing directly
           on the icon while it's already open mutes instead of closing
           it — closing only ever happens from a press elsewhere, below.
           Skipped when volume isn't controllable: a single tap just
           toggles mute directly, since there is no fader worth opening. */
        el.volToggle.addEventListener('click', e => {
          e.stopPropagation();
          if (!volumeControllable) { setMuted(!muted); return; }
          if (!el.volume.classList.contains('is-open')) openVolume();
          else setMuted(!muted);
        });
        /* closes on any press outside the flyout or its toggle — pointerdown
           rather than click, so it shuts the instant a drag starts
           elsewhere instead of waiting for that gesture to finish */
        document.addEventListener('pointerdown', e => {
          if (!el.volume.classList.contains('is-open')) return;
          if (e.target.closest('.volume, [data-vol-toggle]')) return;
          closeVolume();
        });
        el.volTrack.addEventListener('pointerdown', e => {
          if (muted) setMuted(false);   // adjusting the fader by hand always means "audible"
          volDragging = true;
          el.volTrack.setPointerCapture?.(e.pointerId);
          volumeFromEvent(e);   // a plain tap lands here and nowhere else — the
                                 // full .45s ease plays out, untouched by is-dragging
        });
        el.volTrack.addEventListener('pointermove', e => {
          if (!volDragging) return;
          /* real movement — see the identical note on el.scrub's own
             pointermove above */
          el.volTrack.classList.add('is-dragging');
          volumeFromEvent(e);
        });
        /* pointerup alone used to be it — but a drag that ends in a
           pointercancel instead (the browser's own gesture recognition
           stepping in, losing capture, anything short of a clean release)
           never fired it, leaving volDragging and is-dragging stuck on
           permanently. Every fader move after that read as an instant
           jump with no eased animation at all, since .is-dragging turns
           the transition off — exactly the intermittent "sometimes no
           delayed animation" this was. .scrub's own release handler
           already covers both events (see scrubRelease above); this
           just brings the volume fader in line with it. */
        const volRelease = e => {
          volDragging = false;
          el.volTrack.classList.remove('is-dragging');
          el.volTrack.releasePointerCapture?.(e.pointerId);
        };
        el.volTrack.addEventListener('pointerup', volRelease);
        el.volTrack.addEventListener('pointercancel', volRelease);
        el.volTrack.addEventListener('keydown', e => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); if (muted) setMuted(false); setVolume(audio.volume + .05); }
          if (e.key === 'ArrowDown') { e.preventDefault(); if (muted) setMuted(false); setVolume(audio.volume - .05); }
        });

        /* the artwork's width is a flex-layout result (driven by available
           height, not a plain percentage), so the timeline can't just be
           given a CSS width — measure the real cover box and hand that
           number down as a custom property instead. */
        /* On .player rather than the root element: this fires on every
           frame of a window resize, and setting a custom property on <html>
           invalidates style for the whole document each time. Only the
           timeline reads it, and the timeline is in here. */
        const player = el.covers.closest('.player');
        let lastArtW = 0;
        const syncArtWidth = () => {
          const w = Math.round(el.covers.getBoundingClientRect().width);
          if (w && w !== lastArtW) {
            lastArtW = w;
            player.style.setProperty('--art-w', `${w}px`);
            metaItems.forEach(m => fitTitleEl(m.titleEl));
          }
        };
        new ResizeObserver(syncArtWidth).observe(el.covers);
        syncArtWidth();

        /* .cover and .meta-item's CSS transitions are unconditional (no
           gating class the way .block's is-animating one is) — without
           this, the transform load(0) below sets as it calls placeCovers/
           placeMeta for the very first time animates in from each
           element's untransformed default position rather than landing
           silently. Invisible behind a fresh password entry's entrance
           lamp, but every refresh of an already-remembered session skips
           straight to content with nothing covering it, which is exactly
           when this was visible. Transition off, let load(0) paint the
           real positions, force the jump to land, transition back on —
           same technique placeCovers already uses per-cover for its own
           teleport-jump case, just covering every cover and meta-item
           once up front here instead. */
        const firstPaintEls = [...covers, ...metaItems.map(m => m.el)];
        firstPaintEls.forEach(node => { node.style.transition = 'none'; });
        load(0, false, { haptic: false });   // a teleport into place, not a change — nothing to buzz for
        void el.covers.offsetWidth;
        firstPaintEls.forEach(node => { node.style.transition = ''; });
        requestAnimationFrame(tick);
      },
      pause
    };
  })();

  /* ==========================================================
     BRAND
     ========================================================== */
  function fillContent() {
    const b = CONFIG.brand;
    const logo = $('[data-logo]');
    if (b.logoImage) {
      logo.innerHTML = `<img src="${b.logoImage}" alt="${b.logo}">`;
    } else {
      $('[data-logo-main]').textContent = b.logo;
      const sub = $('[data-logo-sub]');
      if (b.sublogo) { sub.textContent = b.sublogo; sub.hidden = false; } else { sub.hidden = true; }
    }
    $('[data-tagline]').textContent = b.tagline || '';

    const ig = CONFIG.instagram;
    const igLink = $('[data-instagram]');
    if (ig?.url) igLink.href = ig.url; else igLink.hidden = true;
    document.title = `${b.logo} — Private Listening`;
  }

  /* A one-off "decrypting" reveal for a single line of text. Left to
     right, each letter cycles through random characters for a moment and
     then settles on the real one, with only a couple of letters ever in
     flux at once — a tight moving window rather than the whole line
     buzzing, which is the difference between a terminal resolving a
     readout and a wall of Matrix rain.

     Every letter is two overlapping copies of itself (see .decrypt-char in
     styles.css): a hidden one holding the real character, which reserves
     its exact final width from the first frame, and a visible one on top,
     absolutely positioned, which is the only thing that changes. Nothing
     about the line's width, position or spacing moves at any point.

     Returns nothing — it is the last thing on screen to settle and has
     nothing to hand off to. */
  function decryptReveal(el, { stagger = 55, window: WINDOW = 130, tick = 34 } = {}) {
    if (!el || reduced) return;   // reduced motion keeps the plain text fillContent() already set
    const text = el.textContent;
    if (!text) return;

    const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const letters = [...text];
    el.textContent = '';
    el.setAttribute('aria-label', text);   // the real words, for the whole time the glyphs are in flux

    letters.forEach((ch, idx) => {
      if (ch === ' ') { el.append(' '); return; }   // nothing to decrypt in a space

      const cell = document.createElement('span');
      cell.className = 'decrypt-char';
      cell.setAttribute('aria-hidden', 'true');
      const final = document.createElement('span');
      final.className = 'decrypt-char__final';
      final.textContent = ch;
      const glyph = document.createElement('span');
      glyph.className = 'decrypt-char__glyph';
      cell.append(final, glyph);
      el.appendChild(cell);

      setTimeout(() => {
        cell.classList.add('is-active');
        const iv = setInterval(() => {
          glyph.textContent = CHARSET[(Math.random() * CHARSET.length) | 0];
        }, tick);
        setTimeout(() => {
          clearInterval(iv);
          glyph.textContent = ch;
          cell.classList.add('is-locked');
        }, WINDOW);
      }, idx * stagger);
    });

    /* Once every letter has landed, hand the line back to the real
       characters — by revealing the hidden copy that was already holding
       each letter's box, and dropping the animated one on top of it.

       Deliberately NOT a collapse back to one plain text node: an
       inline-block cell per letter rounds its own width, and those
       roundings accumulate left-to-right (measured: ~8px by the end of
       this line), so swapping the scaffolding for plain text re-flowed
       every character a few pixels to the left in one visible jump at
       the very end. Reusing the boxes that are already there keeps the
       glyphs exactly where they have been since the first frame, and
       still leaves real, selectable text behind. */
    setTimeout(() => {
      el.removeAttribute('aria-label');
      $$('.decrypt-char', el).forEach(cell => {
        cell.removeAttribute('aria-hidden');
        cell.classList.add('is-settled');
        cell.querySelector('.decrypt-char__glyph')?.remove();
      });
    }, (letters.length - 1) * stagger + WINDOW + 220);
  }

  /* The sub-line only. The main wordmark is plain text from the first
     frame — one line resolving under a name that is already there reads as
     a system coming up; both of them doing it reads as an effect.

     Gate.init calls this as `enter()` on *every* successful entry, remembered
     ones included — so navigating to contact.html and back (a real page
     load, gate already unlocked this session) was replaying the reveal
     each time. Gated the same way the gate's own remember flag is: once
     sessionStorage has seen it, later calls just leave fillContent()'s
     plain text in place, same as decryptReveal already does for reduced
     motion. */
  const SUB_INTRO_KEY = 'kas-sub-intro-played';
  function playSubIntro() {
    const sub = $('[data-logo-sub]');
    if (!sub || sub.hidden) return;
    try {
      if (sessionStorage.getItem(SUB_INTRO_KEY) === '1') return;
      sessionStorage.setItem(SUB_INTRO_KEY, '1');
    } catch (_) {}
    decryptReveal(sub);
  }

  /* The entrance lamp — see `intro-lamp` in styles.css, which is where the
     shape of it lives. Only ever called from the gate's successful submit,
     so it is tied to the act of entering the password rather than to the
     page appearing: a reload, or a second visit inside a session that has
     already been let in, goes straight to a lit room. */
  const ENTRANCE_MS = 4600;   // must match `intro-lamp`'s duration in styles.css
  function playEntranceLamp() {
    if (reduced) return;      // reduced motion: the room is simply lit, no theatrics
    document.body.classList.add('is-entering');
    setTimeout(() => document.body.classList.remove('is-entering'), ENTRANCE_MS);
  }

  /* ==========================================================
     THE GATE — a doorman, not a lock. See CONFIG.gate.
     ========================================================== */
  const Gate = (() => {
    const el = $('[data-gate]');
    const cfg = CONFIG.gate || {};
    const KEY = 'kas-entered';

    /* The woosh, synthesised rather than shipped as a file — nothing to
       download, nothing to license. Filtered noise sweeping up through the
       middle and away again, with a sub underneath for the weight you feel
       rather than hear. Built on the submit, which is the user gesture the
       browser wants before it will let a page make any sound at all. */
    function woosh() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      let ctx;
      try { ctx = new AC(); } catch (_) { return; }

      const t = ctx.currentTime, dur = 2.7;

      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let n = 0; n < data.length; n++) data[n] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;

      /* the sweep — the whole character of the sound is in this curve */
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = .9;
      band.frequency.setValueAtTime(150, t);
      band.frequency.exponentialRampToValueAtTime(1700, t + dur * .44);
      band.frequency.exponentialRampToValueAtTime(105, t + dur);

      /* takes the top off so it reads as moving air, not static */
      const tame = ctx.createBiquadFilter();
      tame.type = 'lowpass';
      tame.frequency.value = 5000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(.4, t + dur * .4);
      gain.gain.exponentialRampToValueAtTime(.0001, t + dur);

      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(72, t);
      sub.frequency.exponentialRampToValueAtTime(33, t + dur);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(.0001, t);
      subGain.gain.exponentialRampToValueAtTime(.15, t + dur * .3);
      subGain.gain.exponentialRampToValueAtTime(.0001, t + dur);

      src.connect(band).connect(tame).connect(gain).connect(ctx.destination);
      sub.connect(subGain).connect(ctx.destination);

      src.start(t); src.stop(t + dur);
      sub.start(t); sub.stop(t + dur);
      src.onended = () => ctx.close();
    }

    const remembers = () => cfg.remember !== false;

    return {
      /* `enter` runs on both paths — it is whatever should happen once the
         room is on screen. `unlocked` runs only when a password was
         actually just accepted, and is where anything tied to the act of
         entering belongs: crossing the threshold is not the same event as
         arriving, and a reload is an arrival, not a crossing. */
      init(enter, unlocked) {
        /* no gate configured, or they are already inside — straight through,
           and the element goes rather than lingering as a dead overlay.
           `is-unlocked` (see .ring/.leds in styles.css) is what lets the
           ambient light animations run at all — there is no gate here to
           hide behind, so they may as well start immediately. */
        const straightIn = () => { document.body.classList.add('is-unlocked'); el?.remove(); enter(); };
        if (!el || !cfg.password) return straightIn();

        let seen = false;
        if (remembers()) { try { seen = sessionStorage.getItem(KEY) === '1'; } catch (_) {} }
        if (seen) return straightIn();

        const form = $('[data-gate-form]', el);
        const input = $('[data-gate-input]', el);
        const want = String(cfg.password).trim().toUpperCase();

        form.addEventListener('submit', e => {
          e.preventDefault();
          if (input.value.trim().toUpperCase() !== want) {
            el.classList.remove('is-wrong');
            void el.offsetWidth;                 // restart the shake
            el.classList.add('is-wrong');
            input.value = '';
            input.focus();
            return;
          }
          if (SOUND_ENABLED) woosh();
          el.classList.remove('is-wrong');
          el.classList.add('is-open');
          document.body.classList.add('is-unlocked');
          if (remembers()) { try { sessionStorage.setItem(KEY, '1'); } catch (_) {} }
          setTimeout(() => el.remove(), 2400);   // past the fade (.gate's own 2.2s opacity transition)
          unlocked();
          enter();
        });

        /* clear the refusal the moment they start again */
        input.addEventListener('input', () => el.classList.remove('is-wrong'));
        input.focus();
      }
    };
  })();

  /* ==========================================================
     BOOT
     ========================================================== */
  fillContent();
  Carousel.init(CONFIG.order);
  Player.init(CONFIG.tracks);
  Env.init();

  /* Everything behind the gate is already on screen, at full opacity, the
     instant it opens — the only thing left to run is the sub-line
     resolving, which starts immediately either way, and re-arming the
     cursor so it waits for a fresh move inside the room rather than
     showing up already wherever the gate's Enter button was clicked. The
     lamp is the one thing reserved for an actual password entry. */
  Gate.init(playSubIntro, playEntranceLamp);
})();
