/* ============================================================
   KEEP A SECRET — app
   Environment · Cursor · Carousel · Player
   All editable content lives in js/config.js
   ============================================================ */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine    = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SOUND_ENABLED = true;   // the gate woosh — set false to mute it again

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
     to its own house light: a bright white lamp with yellow alternating
     through it cell by cell. Both accents are yellow — one saturated, one
     pale — so the checkerboard reads white against yellow rather than
     white against white. The base is a hair off #fff on purpose: a pure
     white lamp reads as a blown highlight instead of as light. */
  const DEMO_LIGHT = {
    panel: [16, 16, 19],
    ring:  [255, 253, 247],
    deep:  [70, 58, 34],
    b:     [255, 212, 84],
    c:     [252, 233, 152]
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
     ENVIRONMENT — grain, cursor halo, lagging cursor
     ========================================================== */
  const Env = (() => {
    const grain = $('[data-grain]');
    const halo  = $('[data-halo]');

    const HALO = 260;
    /* the halo trails further behind than the dot does — the dot itself
       belongs to js/cursor.js now, which owns the pointer position and
       the one rAF loop both of these run on */
    const slow  = { x: innerWidth / 2, y: innerHeight / 2 };
    let gctx, hctx, pattern, haloPattern, haloMask, last = 0;

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

    /* The grain and the halo are each drawn exactly once and then moved.

       Both used to be re-rendered every 70ms — a pattern fill across a
       near-viewport-sized canvas, plus a second one for the halo, plus the
       texture upload that follows any canvas whose pixels changed. That is
       main-thread and upload work landing ~14 times a second forever, in
       the same rAF callback that positions the cursor, which is why the
       cursor could never be reliably smooth: any frame that also carried a
       grain redraw was a long frame. Since what the redraw actually
       produced was the same noise at a new random offset, the offset is
       now all that changes — a transform on an already-uploaded texture,
       which the compositor does without touching the main thread at all. */
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

    function setupHalo() {
      halo.width = halo.height = HALO;
      hctx = halo.getContext('2d');
      haloPattern = hctx.createPattern(tile(190, 96), 'repeat');
      haloMask = hctx.createRadialGradient(HALO / 2, HALO / 2, 0, HALO / 2, HALO / 2, HALO / 2);
      haloMask.addColorStop(0,   'rgba(0,0,0,.6)');
      haloMask.addColorStop(.45, 'rgba(0,0,0,.22)');
      haloMask.addColorStop(1,   'rgba(0,0,0,0)');

      hctx.fillStyle = haloPattern;
      hctx.fillRect(0, 0, HALO, HALO);
      hctx.globalCompositeOperation = 'destination-in';
      hctx.fillStyle = haloMask;
      hctx.fillRect(0, 0, HALO, HALO);
      hctx.globalCompositeOperation = 'source-over';
    }

    /* The whole per-frame budget: two transform writes, no pixels
       touched, nothing read back off the DOM. Runs on js/cursor.js's
       loop — the same smoothing factor as before, just re-derived from
       real elapsed time so it holds up at any refresh rate. */
    const HALO_EASE = .16, STEP = 1000 / 60;
    const smooth = (from, to, dt) => from + (to - from) * (1 - Math.pow(1 - HALO_EASE, dt / STEP));

    function frame(target, dt, t) {
      if (fine && halo) {
        slow.x = smooth(slow.x, target.x, dt);
        slow.y = smooth(slow.y, target.y, dt);
        halo.style.transform = `translate3d(${slow.x - HALO / 2}px, ${slow.y - HALO / 2}px, 0)`;
      }

      if (t - last > 70) {                             // ~14fps — cinematic, not fizzy
        last = t;
        grain.style.transform =
          `translate3d(${-Math.random() * GRAIN_PAD}px, ${-Math.random() * GRAIN_PAD}px, 0)`;
      }
    }

    return {
      init() {
        if (reduced) return;   // cursor.js sits out too, so there is no loop to hook
        sizeGrain();
        addEventListener('resize', sizeGrain);
        if (fine) setupHalo();

        /* the halo fades in and out with the dot rather than tracking a
           second copy of the same "has the pointer moved yet" state */
        Cursor.onLive(v => halo?.classList.toggle('is-live', v));
        Cursor.onFrame(frame);
      },
      hideCursorUntilMove() { Cursor.hideUntilMove(); }
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
      covers: $('[data-covers]'), meta: $('.player__meta'),
      title: $('[data-title]'), artist: $('[data-artist]'),
      fill: $('[data-fill]'), head: $('[data-head]'),
      cur: $('[data-current]'), dur: $('[data-duration]'),
      play: $('[data-play]'), prev: $('[data-prev]'), next: $('[data-next]'),
      scrub: $('[data-scrub]'), note: $('[data-note]'),
      volToggle: $('[data-vol-toggle]'), volume: $('[data-volume]'),
      volTrack: $('[data-vol-track]'), volFill: $('[data-vol-fill]'), volHead: $('[data-vol-head]')
    };

    let tracks = [], covers = [], i = 0,
        playing = false, fallback = false, fakeTime = 0, lastTick = 0, scrubbing = false,
        swapTimer = null, changeTimer = null;

    /* cover-stack drag state — see coverDown/coverMove/coverUp below */
    let coverDragging = false, coverCaptured = false, coverMoved = 0,
        coverStartX = 0, dragExtra = 0, coverPid = null;

    const track = () => tracks[i];
    const duration = () => (fallback || !isFinite(audio.duration) || !audio.duration)
      ? track().duration || 180 : audio.duration;
    const position = () => fallback ? fakeTime : audio.currentTime;

    /* long titles (the DEMO track's, mainly) would otherwise wrap onto a
       second line and push everything below it down — a visible "hop"
       whenever that track becomes active. Force one line and shrink the
       font just enough to fit it, rather than letting it wrap at all. */
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

    function fitTitle() {
      el.title.style.fontSize = '';
      const max = el.title.clientWidth;
      if (!max) return;
      let natural = textWidth(el.title);
      if (natural <= max) return;

      /* Text width is near enough linear in font size to solve for
         directly rather than walking the size down a step at a time (which
         used to cost dozens of forced layouts per call, on every track
         change and every frame of a resize). It is not exactly linear —
         hinting and letter-spacing round differently at each size — so one
         corrective pass follows, and only if the first solve left it long.
         Two measurements in the normal case, three in the worst. */
      const base = parseFloat(getComputedStyle(el.title).fontSize);
      let size = Math.max(10, base * (max / natural));
      el.title.style.fontSize = `${size}px`;

      natural = textWidth(el.title);
      if (natural > max) {
        size = Math.max(10, size * (max / natural) * .995);
        el.title.style.fontSize = `${size}px`;
      }
    }

    /* Artist, BPM and key on one line — "Gilles * 122 BPM * A Minor".
       Built out of nodes rather than a template string so a title with an
       & or a < in it can never be read as markup, and so each separator
       can be its own element: it is dimmer than the text around it, and
       aria-hidden, so the line is still read aloud as three plain facts
       rather than with an "asterisk" between each one. Any of the three
       being absent just drops that segment and its separator. */
    function writeMeta(t) {
      const bits = [t.artist, t.bpm ? `${t.bpm} BPM` : null, t.key].filter(Boolean);
      el.artist.textContent = '';
      bits.forEach((bit, n) => {
        if (n) {
          const sep = document.createElement('span');
          sep.className = 'player__sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '*';
          el.artist.appendChild(sep);
        }
        el.artist.appendChild(document.createTextNode(bit));
      });
    }

    function applyLight({ panel, ring, deep, b, c }) {
      const root = document.documentElement.style;
      const set = (name, [r, g, bl]) => root.setProperty(name, `${r} ${g} ${bl}`);
      set('--dominant', panel);
      set('--ring', ring);
      set('--ring-deep', deep);
      set('--led-b', b);
      set('--led-c', c);
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
      flashTimer = setTimeout(() => {
        /* released over roughly the same span the colour cross-fades in, so
           the lamp settles to its new hue, brightness and saturation
           together rather than dropping out from under the crossfade */
        body.remove('is-surging');
      }, 1900);
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
       plain integer `d`; only the paint itself moves continuously. */
    function placeCovers(extra = 0) {
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
          if (near !== 0 && Math.abs(lastD[j]) > 1 && Math.sign(lastD[j]) !== Math.sign(near)) {
            /* parked on the wrong side to enter smoothly — jump it to the
               mirrored far position first, invisibly */
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
        paintCover(c, d + extra);
        c.style.zIndex = String(10 - a);
        /* the playing cover takes the pointer too, so it can lift on hover
           like its neighbours — its click handler is a no-op. Only the
           fully hidden ones stay out of the way. */
        c.style.pointerEvents = a <= 1 ? 'auto' : 'none';
        c.tabIndex = side ? 0 : -1;
      });
    }

    /* Continuous versions of the three discrete states the old fixed-`d`
       calls used to jump between (centre / side / far) — `a` is the same
       distance-from-centre used for those, just not rounded, so a cover
       fades, blurs and shrinks smoothly under a dragging finger instead of
       snapping at each integer boundary. */
    function paintCover(c, d) {
      const a = clamp(Math.abs(d), 0, 2);
      const opacity = a <= 1 ? lerp(1, .9, a) : lerp(.9, 0, a - 1);
      const blur = lerp(0, 1.5, clamp(a, 0, 1));
      const scale = lerp(1, .86, clamp(a, 0, 1));
      c.style.transform = `translate(-50%, -50%) translateX(${(d * 19).toFixed(2)}%) scale(${scale.toFixed(3)})`;
      c.style.opacity = opacity.toFixed(3);
      /* blur(0px) rather than none — a filter list interpolates against a
         matching list, and `none` is not one, so the blur was snapping on
         and off at the ends of the slide instead of easing with it */
      c.style.filter = blur > .02 ? `blur(${blur.toFixed(2)}px)` : 'blur(0px)';
    }

    /* ---- drag-to-rotate --------------------------------------
       Grabbing the cover stack and dragging left or right steps through
       tracks in whichever direction the drag goes, live-tracking the
       pointer the whole way rather than only reacting once released —
       the same shape as Carousel's own drag above, adapted from a block
       index to the covers' continuous `d` slots. `coverMoved` tells a
       real drag apart from a tap on a side cover, which still switches
       tracks the old way (the existing click listener in buildCovers). */
    /* fraction of the stack's width that counts as one full slot of drag —
       lower is more sensitive. .9 read as heavy/unresponsive, needing
       almost the artwork's full width dragged before anything moved;
       matched closer to Carousel's own .62 instead. */
    const DRAG_SLOT = .58;
    const DRAG_COMMIT = .18; // matches Carousel's own commit threshold

    function coverDown(e) {
      if (tracks.length <= 1) return;   // nothing to drag to
      if (e.target.closest('.ctrl, a, .scrub')) return;
      coverDragging = true; coverCaptured = false; coverMoved = 0;
      coverStartX = e.clientX; dragExtra = 0; coverPid = e.pointerId;
    }
    /* Pointermove can fire far faster than the screen redraws — a real
       mouse or trackpad easily beats 60Hz — and placeCovers() writes
       transform/opacity/filter on every cover each time it runs. Without
       this, a fast drag was queuing up several full repaints per frame
       for paint work the previous one hadn't even reached the screen
       for yet, which is exactly the kind of self-inflicted lag that also
       drags the cursor down with it. Only the latest pointer position
       before each frame ever needs painting, so pending moves collapse
       into one instead of piling up. */
    let coverMoveQueued = false;
    function coverMove(e) {
      if (!coverDragging) return;
      const dx = e.clientX - coverStartX;
      coverMoved = Math.max(coverMoved, Math.abs(dx));
      if (!coverCaptured) {
        if (coverMoved < 6) return;
        coverCaptured = true;
        el.covers.setPointerCapture?.(coverPid);
        el.covers.classList.add('is-dragging');
      }
      const w = el.covers.offsetWidth || 1;
      dragExtra = clamp(dx / (w * DRAG_SLOT), -1, 1);
      if (coverMoveQueued) return;
      coverMoveQueued = true;
      requestAnimationFrame(() => {
        coverMoveQueued = false;
        if (coverCaptured) placeCovers(dragExtra);
      });
    }
    function coverUp(e) {
      if (!coverDragging) return;
      coverDragging = false;
      if (coverCaptured && coverPid !== null) el.covers.releasePointerCapture?.(coverPid);
      coverPid = null;

      if (coverCaptured) {
        el.covers.classList.remove('is-dragging');
        if (Math.abs(dragExtra) > DRAG_COMMIT) load(i - Math.sign(dragExtra), playing);
        else placeCovers();          // under threshold — settle back where it started
      } else if (coverMoved < 6) {
        /* a tap rather than a drag — same behaviour as the side covers'
           own click listener, just reached through the pointer sequence
           instead of a separate click event */
        const hit = e.target.closest('.cover');
        const n = covers.indexOf(hit);
        if (n > -1 && n !== i) load(n, playing);
      }
      coverCaptured = false; dragExtra = 0;
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

    function load(n, autoplay) {
      const now = performance.now();
      if (now - lastLoadAt < 220) return;
      lastLoadAt = now;

      i = ((n % tracks.length) + tracks.length) % tracks.length;
      const t = track();

      /* Covers a cover's hover lift/veil-fade for exactly as long as the
         slide below runs (1s — matches .cover's own transform/opacity/
         filter transition). Without it, whichever cover the pointer
         happens to already be resting on when it lands would ALSO start
         its hover transition mid-slide — the small transport buttons sit
         right under the artwork, so that's the common case there, and it's
         what read as an extra hop only on that path. Cleared and reset on
         every call so a rapid run of clicks keeps it suppressed the whole
         time rather than flickering back on between them. */
      el.covers.classList.add('is-changing');
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => el.covers.classList.remove('is-changing'), 1000);

      placeCovers();
      el.meta.classList.add('is-swapping');
      clearTimeout(swapTimer);
      /* just past the .22s fade-out, so the words are actually invisible
         when they change — and fitTitle's font-size jump lands here too,
         where nothing can see it */
      swapTimer = setTimeout(() => {
        el.title.textContent = t.title;
        writeMeta(t);
        fitTitle();
        el.meta.classList.remove('is-swapping');
      }, 240);

      if (t.demo || !t.artwork) {
        applyLight(DEMO_LIGHT);
      } else {
        applyColour(Colour.toRgb(t.color || '#141418'));
        sampleColour();
      }
      flashLight();

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
        const pct = `${step / 10}%`;
        el.fill.style.width = pct;
        el.head.style.left = pct;
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
    const toggle = () => playing ? pause() : play();

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

    function seekFromEvent(e) {
      const r = el.scrub.getBoundingClientRect();
      const p = clamp((e.clientX - r.left) / r.width, 0, 1);
      const d = duration();
      if (fallback) fakeTime = p * d; else audio.currentTime = p * d;
      /* through paint() rather than writing the bar directly, so the cached
         values above stay in step with what is actually on screen */
      paint();
    }

    /* ---- volume -----------------------------------------------
       A vertical fader in the flyout .volume opens beside the artwork
       (js/app.js Volume wiring in init(), styles in css/styles.css). Reads
       bottom-up, like a physical fader: 0% at the bottom, 100% at the top. */
    let volDragging = false;
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
    function openVolume() {
      el.volume.classList.add('is-open');
      el.volToggle.classList.add('is-open');
      el.volToggle.setAttribute('aria-expanded', 'true');
    }
    function closeVolume() {
      el.volume.classList.remove('is-open');
      el.volToggle.classList.remove('is-open');
      el.volToggle.setAttribute('aria-expanded', 'false');
    }

    return {
      init(list) {
        tracks = list;
        buildCovers();
        preloadArt();
        presampleColours();

        el.play.dataset.state = 'paused';
        el.play.addEventListener('click', toggle);
        el.prev.addEventListener('click', prevTrack);
        el.next.addEventListener('click', nextTrack);

        /* drag the cover stack itself to step through tracks, in either
           direction — see coverDown/coverMove/coverUp above */
        el.covers.addEventListener('pointerdown', coverDown);
        el.covers.addEventListener('pointermove', coverMove);
        el.covers.addEventListener('pointerup', coverUp);
        el.covers.addEventListener('pointercancel', coverUp);
        el.covers.addEventListener('dragstart', e => e.preventDefault());

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
          scrubbing = true; el.scrub.classList.add('is-scrubbing');
          el.scrub.setPointerCapture(e.pointerId); seekFromEvent(e);
        });
        el.scrub.addEventListener('pointermove', e => scrubbing && seekFromEvent(e));
        el.scrub.addEventListener('pointerup', e => {
          if (!scrubbing) return;
          scrubbing = false; el.scrub.classList.remove('is-scrubbing');
          el.scrub.releasePointerCapture(e.pointerId);
        });
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

        el.volToggle.addEventListener('click', e => {
          e.stopPropagation();
          if (el.volume.classList.contains('is-open')) closeVolume(); else openVolume();
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
          volDragging = true;
          el.volTrack.setPointerCapture?.(e.pointerId);
          volumeFromEvent(e);
        });
        el.volTrack.addEventListener('pointermove', e => volDragging && volumeFromEvent(e));
        el.volTrack.addEventListener('pointerup', e => {
          volDragging = false;
          el.volTrack.releasePointerCapture?.(e.pointerId);
        });
        el.volTrack.addEventListener('keydown', e => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); setVolume(audio.volume + .05); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(audio.volume - .05); }
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
            fitTitle();
          }
        };
        new ResizeObserver(syncArtWidth).observe(el.covers);
        syncArtWidth();

        load(0, false);
        requestAnimationFrame(tick);
      },
      pause,
      prev: () => prevTrack(),
      next: () => nextTrack()
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
     a system coming up; both of them doing it reads as an effect. */
  function playSubIntro() {
    const sub = $('[data-logo-sub]');
    if (sub && !sub.hidden) decryptReveal(sub);
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
          setTimeout(() => el.remove(), 1800);   // past the fade
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

  /* the big arrows drive the player, not the carousel — there is only one
     panel left to sit in */
  $('[data-nav-prev]').addEventListener('click', Player.prev);
  $('[data-nav-next]').addEventListener('click', Player.next);

  /* Everything behind the gate is already on screen, at full opacity, the
     instant it opens — the only thing left to run is the sub-line
     resolving, which starts immediately either way, and re-arming the
     cursor so it waits for a fresh move inside the room rather than
     showing up already wherever the gate's Enter button was clicked. The
     lamp is the one thing reserved for an actual password entry. */
  Gate.init(() => { playSubIntro(); Env.hideCursorUntilMove(); }, playEntranceLamp);
})();
