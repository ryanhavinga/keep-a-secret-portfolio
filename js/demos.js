/* ============================================================
   KEEP A SECRET — DEMOS (demos.html)
   The list · one player shared by every row
   Content lives in js/config.js, under CONFIG.demos.
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const V = CONFIG.demos || {};
  const STATUS_LABEL = { 'on hold': 'On hold', 'cut': 'Cut' };   // 'available' (the default) gets the Request link instead
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = s => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  /* a song's whole length is shown the same everywhere — in its row and in the player bar — rounded to the nearest second
     (the config's `duration` is that rounded length). Only the running time counts down whole seconds. */
  const total = s => time(Math.round(isFinite(s) && s > 0 ? s : 0));

  /* ==========================================================
     THE LIST
     ========================================================== */
  const PLAY = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 19 12 9 18.5Z"/></svg>' +
               '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5" width="5" height="14" rx="1.5"/><rect x="13.5" y="5" width="5" height="14" rx="1.5"/></svg>';

  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* a small seeded random: the same song always gets the same shapes */
  const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* the tile in front of every song: a small music note on a dark purple tile, as on the site as it was. (A track with an `artwork`
     in config.js shows that picture instead.) */
  const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 18V6.2l8-1.7v11.2"/><circle cx="7.2" cy="18" r="2.3"/><circle cx="15.7" cy="15.7" r="2.3"/></svg>';
  const art = t => t.artwork ? `<img src="${esc(t.artwork)}" alt="" loading="lazy">` : NOTE;

  /* the bars of a row's waveform: a smooth, uneven shape drawn from the song's name (not measured from the audio) */
  const WAVE_BARS = 64;
  const wave = title => {
    const rnd = seeded(hash(title));
    let prev = .5, out = '';
    for (let k = 0; k < WAVE_BARS; k++) {
      prev = prev * .5 + rnd() * .5;
      const swell = .62 + .38 * Math.sin(Math.PI * (k + 1) / (WAVE_BARS + 1));          // a little quieter at both ends
      out += `<i style="height:${Math.round(14 + 86 * Math.min(1, prev * 1.25) * swell)}%"></i>`;
    }
    return out;
  };

  const Player = (() => {
    const audio = $('[data-audio]');
    const entries = [];
    let current = null, dragging = false;

    /* the fader level the portfolio left off at (or its 40% first-visit
       default) — so moving between the pages doesn't jump in loudness.
       iOS keeps volume on the hardware buttons and ignores this. */
    let vol = .4;
    try {
      const sv = parseFloat(localStorage.getItem('kas-volume'));
      if (isFinite(sv)) vol = Math.min(1, Math.max(0, sv));
    } catch (_) {}
    audio.volume = vol;

    let swapTimer = 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* the now-playing bar (demos.html): the song that is loaded, previous / play / next, a timeline, the volume */
    const np = {
      el: $('[data-np]'), art: $('[data-np-art]'), title: $('[data-np-title]'),
      play: $('[data-np-play]'), prev: $('[data-np-prev]'), next: $('[data-np-next]'),
      bar: $('[data-np-bar]'), fill: $('[data-np-fill]'), cur: $('[data-np-cur]'), dur: $('[data-np-dur]'),
      seek: $('[data-np-seek]'), who: $('.np__who'),
      volEl: $('.np__vol', document), vbtn: $('[data-np-vol]'), vtrack: $('[data-np-vtrack]'), vfill: $('[data-np-vfill]')
    };
    /* the speaker at the far right slides left over the time and timeline and draws a volume line out behind it (css/demos.css);
       the same stored level as the portfolio's player. As there: the fader taken down to nothing mutes, any other level un-mutes,
       and a press on the speaker while the line is out mutes or un-mutes (the level stays where it was). */
    let muted = false, popVol = () => {};
    const paintMute = () => {
      np.el.classList.toggle('is-muted', muted || vol === 0);
      np.vbtn.setAttribute('aria-label', muted ? 'Unmute' : 'Volume');
    };
    function setVol(v, save) {
      vol = Math.min(1, Math.max(0, v));
      audio.volume = vol;
      np.vfill.style.width = `${vol * 100}%`;
      np.vtrack.setAttribute('aria-valuenow', Math.round(vol * 100));
      muted = vol === 0;
      audio.muted = muted;
      paintMute();
      if (save) { try { localStorage.setItem('kas-volume', String(vol)); } catch (_) {} }
    }
    setVol(vol, false);
    /* how far the speaker travels: from where it stands to the start of the time */
    const placeVol = () => {
      const v = np.volEl.getBoundingClientRect(), m = np.seek.getBoundingClientRect();
      np.el.style.setProperty('--vdx', `${Math.max(0, (v.left + v.width / 2) - (m.left + 21)).toFixed(1)}px`);
    };
    const setOpen = on => {
      if (on) placeVol();
      np.el.classList.toggle('is-vol', on);
      np.vbtn.setAttribute('aria-expanded', String(on));
    };
    addEventListener('resize', () => { if (np.el.classList.contains('is-vol')) placeVol(); });
    np.vbtn.addEventListener('click', () => { if (!np.el.classList.contains('is-vol')) setOpen(true); else { muted = !muted; audio.muted = muted; paintMute(); } });
    document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.np__vol')) setOpen(false); });
    const volFromX = ev => { const r = np.vtrack.getBoundingClientRect(); setVol((ev.clientX - r.left) / r.width, true); };
    let vdrag = false;
    np.vtrack.addEventListener('pointerdown', ev => { popVol(); vdrag = true; try { np.vtrack.setPointerCapture(ev.pointerId); } catch (_) {} volFromX(ev); });
    np.vtrack.addEventListener('pointermove', ev => { if (vdrag) volFromX(ev); });
    np.vtrack.addEventListener('pointerup', () => { vdrag = false; });
    np.vtrack.addEventListener('pointercancel', () => { vdrag = false; });
    np.vtrack.addEventListener('keydown', ev => {
      const d = { ArrowUp: .05, ArrowRight: .05, ArrowDown: -.05, ArrowLeft: -.05 }[ev.key];
      if (d === undefined) { if (ev.key === 'Escape') { setOpen(false); np.vbtn.focus(); } return; }
      ev.preventDefault(); ev.stopPropagation(); setVol(vol + d, true);
    });

    const length = e => (e === current && isFinite(audio.duration) && audio.duration) || e.track.duration || 0;

    /* While a jump is landing (the browser has to fetch from the new place first) the timeline shows where it was sent, not the
       old position the element may still report for a moment — so the white line never hangs or steps back after a tap. */
    let landing = null;
    const here = () => (landing !== null ? landing : audio.currentTime);
    audio.addEventListener('seeked', () => { landing = null; });

    function paint(e) {
      const d = length(e);
      const t = e === current ? here() : 0;
      const pct = d ? Math.min(100, Math.max(0, t / d * 100)) : 0;
      const w = `${pct.toFixed(2)}%`;
      if (e.w !== w) { e.w = w; e.fill.style.clipPath = `inset(0 ${(100 - pct).toFixed(2)}% 0 0)`; }
      const n = String(Math.round(pct));
      if (e.n !== n) { e.n = n; e.scrub.setAttribute('aria-valuenow', n); }
      const txt = e === current && (t > 0 || !audio.paused) ? time(t) : total(d);
      if (e.txt !== txt) { e.txt = txt; e.timeEl.textContent = txt; }
      if (e === current) {                                          // the bar follows the same song
        np.fill.style.width = w;
        np.bar.setAttribute('aria-valuenow', n);
        np.cur.textContent = time(t); np.dur.textContent = total(d);
      }
    }
    /* the line is drawn every frame while a track plays (the browser's own timeupdate only comes a few times a second) */
    let raf = 0;
    const tick = () => {
      raf = 0;
      if (!current || audio.paused) return;
      if (!dragging) paint(current);
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };

    /* The next track is fetched ahead of time (touching a row, and once something plays), so it starts at once instead of after the download. */
    const warmed = new Set();
    function warm(t) {
      if (!t || !t.audio || warmed.has(t.audio)) return;
      warmed.add(t.audio);
      fetch(t.audio).then(r => r.arrayBuffer()).catch(() => {});
    }

    function setPlaying(e, on) {
      e.row.classList.toggle('is-playing', on);
      e.btn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${e.track.title}`);
    }
    function select(e) {
      if (current === e) return;
      if (current) { const prev = current; setPlaying(prev, false); prev.row.classList.remove('is-current'); current = null; paint(prev); }
      current = e; landing = null;
      e.row.classList.add('is-current');                      // the loaded song's row stays lit, also while it is paused
      audio.preload = 'auto';
      audio.src = e.track.audio;
      /* the bar slides up (once) and shows this song — when it was already showing another, the old one fades away and the new one fades in */
      const wasOn = np.el.classList.contains('is-on');
      const showSong = () => { np.title.textContent = e.track.title; np.art.innerHTML = e.art; np.who.classList.remove('is-swap'); np.seek.classList.remove('is-swap'); };
      clearTimeout(swapTimer);
      if (!wasOn || reducedMotion || !np.title.textContent) showSong();
      else { np.who.classList.add('is-swap'); np.seek.classList.add('is-swap'); swapTimer = setTimeout(showSong, 240); }
      np.el.classList.add('is-on'); document.body.classList.add('has-np');
      np.next.disabled = !entries.slice(entries.indexOf(e) + 1).some(n => n.track.audio);
      paint(e);
    }
    /* previous: back to the start of this song, or (in its first seconds) to the one before; next: the one after */
    function step(dir) {
      if (!current) return;
      if (dir < 0 && audio.currentTime > 3) { landing = audio.currentTime = 0; paint(current); return; }
      let i = entries.indexOf(current) + dir;
      while (entries[i] && !entries[i].track.audio) i += dir;
      const n = entries[i];
      if (!n) return;
      select(n);
      audio.play().catch(() => setPlaying(n, false));
    }
    function toggle(e) {
      if (!e.track.audio) return;
      if (current !== e) select(e);
      if (audio.paused) audio.play().catch(() => setPlaying(e, false));
      else audio.pause();
    }
    function seek(e, ev, from = e.scrub) {
      if (!e.track.audio) return;
      const r = from.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      if (current !== e) { select(e); audio.play().catch(() => setPlaying(e, false)); }
      const go = () => { landing = audio.currentTime = ratio * (audio.duration || e.track.duration || 0); paint(e); };
      if (isFinite(audio.duration) && audio.duration) go();
      else audio.addEventListener('loadedmetadata', go, { once: true });
    }

    /* the bar's own controls */
    np.play.addEventListener('click', () => current && toggle(current));
    np.prev.addEventListener('click', () => step(-1));
    np.next.addEventListener('click', () => step(1));
    /* every press on the timeline gives it, and the time with it, a quick swell and back — just for life (as on the portfolio) */
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const popper = node => {
      let popping = null;
      return () => {
        if (reduced || !node.animate) return;
        const from = parseFloat(getComputedStyle(node).scale) || 1;     // a press in the middle of a swell carries on from the size it has reached
        if (popping) popping.cancel();
        popping = node.animate([
          { scale: String(from), easing: 'cubic-bezier(.3, 0, .2, 1)' },
          { scale: '1.025', offset: .38, easing: 'cubic-bezier(.4, 0, .25, 1)' },
          { scale: '1' }
        ], { duration: 520 });
      };
    };
    const pop = popper(np.seek);
    popVol = popper(np.vtrack);
    np.bar.addEventListener('pointerdown', ev => {
      if (!current) return;
      pop();
      dragging = true; np.bar.classList.add('is-held');
      try { np.bar.setPointerCapture(ev.pointerId); } catch (_) {}
      seek(current, ev, np.bar);
    });
    np.bar.addEventListener('pointermove', ev => { if (dragging && current && np.bar.hasPointerCapture(ev.pointerId)) seek(current, ev, np.bar); });
    const npRelease = () => { dragging = false; np.bar.classList.remove('is-held'); };
    np.bar.addEventListener('pointerup', npRelease);
    np.bar.addEventListener('pointercancel', npRelease);
    np.bar.addEventListener('keydown', ev => {
      if (!current || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      ev.preventDefault();
      landing = audio.currentTime = Math.max(0, here() + (ev.key === 'ArrowRight' ? 5 : -5));
      paint(current);
    });

    audio.addEventListener('play',  () => {
      np.el.classList.add('is-playing'); np.play.setAttribute('aria-label', 'Pause');
      if (!current) return;
      setPlaying(current, true); run();
      warm(entries.slice(entries.indexOf(current) + 1).find(n => n.track.audio)?.track);   // the next one is on its way before this one ends
    });
    audio.addEventListener('pause', () => {
      np.el.classList.remove('is-playing'); np.play.setAttribute('aria-label', 'Play');
      if (current) { setPlaying(current, false); paint(current); }
    });
    audio.addEventListener('timeupdate', () => {
      if (landing !== null && !audio.seeking && Math.abs(audio.currentTime - landing) < 1) landing = null;
      if (current && !dragging) paint(current);
    });
    audio.addEventListener('loadedmetadata', () => current && paint(current));
    audio.addEventListener('ended', () => {
      if (!current) return;
      const done = current;
      audio.currentTime = 0; landing = null;
      setPlaying(done, false);
      paint(done);
      /* the song ends and stops: nothing starts by itself, the listener picks the next one */
    });

    /* Space always plays / pauses the song that is loaded, whatever has the focus (the waveform, a button, the volume …) — and never
       scrolls the page. Only a text field keeps its own spaces. */
    const spaceIsMine = ev => ev.code === 'Space' && current && !ev.target.closest('input, textarea, select, [contenteditable]');
    document.addEventListener('keydown', ev => {
      if (!spaceIsMine(ev)) return;
      ev.preventDefault();                                    // no scroll, and no click on a focused button
      if (!ev.repeat) toggle(current);
    });
    /* a focused button would also click on the key coming up: that one is stopped too */
    document.addEventListener('keyup', ev => { if (spaceIsMine(ev)) ev.preventDefault(); });

    return {
      /* the list is being rebuilt (another collection): stop what is playing and forget the old rows */
      reset() {
        current = null; dragging = false; landing = null; entries.length = 0;
        np.el.classList.remove('is-on', 'is-playing', 'is-vol'); document.body.classList.remove('has-np');
        audio.pause();
        audio.removeAttribute('src');
        try { audio.load(); } catch (_) {}
      },
      /* the first song is fetched ahead, so a first tap on play starts at once */
      warmFirst() { const f = entries.find(n => n.track.audio); if (f) warm(f.track); },
      add(row, track, cov) {
        const e = {
          row, track, art: cov,
          btn: $('.row__play', row), scrub: $('.row__scrub', row), info: $('.row__info', row),
          fill: $('.row__fill', row), timeEl: $('.row__time', row)
        };
        entries.push(e);
        e.btn.addEventListener('click', () => toggle(e));
        if (track.audio) {
          /* the song's name plays it too */
          e.info.classList.add('is-tap');
          e.info.addEventListener('click', () => toggle(e));
          row.addEventListener('pointerdown', () => warm(track), { passive: true });
        }
        e.scrub.addEventListener('pointerdown', ev => {
          if (!track.audio) return;
          dragging = true;
          e.scrub.classList.add('is-held');
          e.scrub.setPointerCapture(ev.pointerId);
          seek(e, ev);
          /* the first jump eases in; the dragging after it follows the finger */
          setTimeout(() => dragging && e.scrub.classList.add('is-scrubbing'), 90);
        });
        e.scrub.addEventListener('pointermove', ev => {
          if (dragging && e.scrub.hasPointerCapture(ev.pointerId)) seek(e, ev);
        });
        const release = () => {
          dragging = false;
          e.scrub.classList.remove('is-held', 'is-scrubbing');
        };
        e.scrub.addEventListener('pointerup', release);
        e.scrub.addEventListener('pointercancel', release);
        e.scrub.addEventListener('keydown', ev => {
          if (current !== e || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
          ev.preventDefault();
          landing = audio.currentTime = Math.max(0, here() + (ev.key === 'ArrowRight' ? 5 : -5));
          paint(e);
        });
      }
    };
  })();

  const contact = V.contact || CONFIG.bio?.contact;
  const collections = V.collections || {};
  const groups = $('[data-groups]');
  let active = null;                                          // the collection being shown (a key of CONFIG.demos.collections), or null for everything

  function render(reveal = false) {
    groups.innerHTML = '';
    groups.classList.toggle('is-bare', !active);                // no list yet: just the line under the bar, close to it
    const lists = new Map();
    /* one list per language, in the order each first appears; a song with
       no language goes in a list of its own above them, without a heading */
    const listFor = lang => {
      if (lists.has(lang)) return lists.get(lang);
      const sec = document.createElement('section');
      sec.className = 'group';
      if (lang && headings) sec.innerHTML = `<h2 class="group__title">${esc(lang)}</h2>`;     // (a heading only when there is more than one language to tell apart)
      const ol = document.createElement('ol');
      ol.className = 'rows';
      sec.appendChild(ol);
      groups.appendChild(sec);
      lists.set(lang, ol);
      return ol;
    };
    /* nothing is listed until a code has been given: then only the tracks tagged with it */
    if (!active) {
      groups.innerHTML = '<p class="empty">Enter the code you were given to see your demos.</p>';
      return;
    }
    const tracks = (V.tracks || []).filter(t => (t.collections || []).includes(active));
    const headings = new Set(tracks.map(t => t.language || '')).size > 1;
    if (!tracks.length) {
      groups.innerHTML = '<p class="empty">No demos in this collection yet.</p>';
      return;
    }
    [...new Set(tracks.filter(t => !t.language).concat(tracks).map(t => t.language || ''))].forEach(listFor);

    /* a collection can switch the Request link off (request: false in CONFIG.demos.collections) */
    const canAsk = collections[active].request !== false;
    /* with nothing to put in the right-hand column (no Request link, no "on hold") the column goes */
    groups.classList.toggle('no-ask', tracks.every(t => t.audio && !STATUS_LABEL[t.status] && !(contact && canAsk)));

    tracks.forEach((t, i) => {
      const meta = [t.year, t.genre, t.bpm && `${t.bpm} BPM`, t.key].filter(Boolean).join(' · ');
      const state = STATUS_LABEL[t.status];                       // on hold / cut: no Request link
      const forWho = active ? ` (selection: ${collections[active].name || active})` : '';
      const mail = contact && canAsk && !state
        ? `mailto:${contact}?subject=${encodeURIComponent(`Demo request: ${t.title}`)}&body=${encodeURIComponent(`Hi Keep A Secret,\n\nI'd like to request the demo of "${t.title}"${forWho}.\n\nKind regards,\n`)}`
        : null;
      const bars = wave(t.title);
      const li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = `
        <span class="row__no">${String(i + 1).padStart(2, '0')}</span>
        <span class="row__icon" aria-hidden="true">${art(t)}</span>
        <div class="row__info">
          <h2 class="row__title"><span>${esc(t.title)}</span></h2>
          ${meta ? `<p class="row__meta">${esc(meta)}</p>` : ''}
          ${t.note ? `<p class="row__note">${esc(t.note)}</p>` : ''}
        </div>
        <div class="row__player">
          <button class="row__play" type="button" ${t.audio ? '' : 'disabled'}
                  aria-label="Play ${esc(t.title)}">${PLAY}</button>
          <div class="row__scrub" role="slider" tabindex="${t.audio ? 0 : -1}" aria-label="Seek ${esc(t.title)}"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" ${t.audio ? '' : 'aria-disabled="true"'}>
            <div class="row__track" aria-hidden="true"><div class="wave">${bars}</div><div class="wave row__fill">${bars}</div></div>
          </div>
          <span class="row__time">${t.audio ? total(t.duration) : ''}</span>
        </div>
        ${state ? `<p class="row__pending">${state}</p>`
          : !t.audio ? '<p class="row__pending">Audio to follow</p>'
          : mail ? `<a class="row__ask" href="${esc(mail)}">Request</a>` : '<span></span>'}`;
      listFor(t.language || '').appendChild(li);
      Player.add(li, t, art(t));
    });
    Player.warmFirst();
    /* a code was just typed: the head and the rows come in one after the other instead of all at once */
    if (reveal) {
      groups.classList.add('is-reveal');
      groups.querySelectorAll('.group__title, .row').forEach((el, n) => el.style.setProperty('--i', Math.min(n, 12)));
    }
  }

  /* ==========================================================
     THE CODE BAR — a code shows one collection, nothing in it hides the rest of the page behind a lock
     ========================================================== */
  const form = $('[data-code-form]'), input = $('[data-code-input]'), note = $('[data-code-note]');
  const activeBox = $('[data-code-active]'), activeName = $('[data-code-name]');
  const band = $('[data-band]');
  /* the bar takes room at the top: the list starts under it (--band-h = where its lower edge is) */
  const syncBand = () => document.documentElement.style.setProperty('--band-h', `${band.hidden ? 0 : Math.round(band.getBoundingClientRect().bottom)}px`);
  if (window.ResizeObserver) new ResizeObserver(syncBand).observe(band);
  addEventListener('resize', syncBand);
  const keyOf = raw => Object.keys(collections).find(k => k.toLowerCase() === String(raw || '').trim().toLowerCase()) || null;

  function show(key, reveal = false) {
    active = key;
    Player.reset();
    render(reveal);
    form.hidden = !!key;                                        // a collection is open: the code bar steps aside for more room ("Clear" brings it back)
    band.hidden = !key; document.body.classList.toggle('has-band', !!key); syncBand();
    activeBox.hidden = !key;
    activeBox.classList.remove('is-in');
    if (key && reveal) { void activeBox.offsetWidth; activeBox.classList.add('is-in'); }
    if (key) activeName.textContent = collections[key].name || key;
    note.textContent = '';
    /* the address carries the code, so a link ending in ?code=HAP opens the collection straight away */
    try {
      const u = new URL(location.href);
      if (key) u.searchParams.set('code', key); else u.searchParams.delete('code');
      history.replaceState(null, '', u);
    } catch (_) {}
  }

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const raw = input.value.trim();
    if (!raw) { if (active) show(null); return; }              // an empty bar shows everything again
    const key = keyOf(raw);
    if (key) { show(key, true); input.value = ''; input.blur(); return; }
    note.textContent = 'That code isn’t recognised.';
    form.classList.remove('is-wrong'); void form.offsetWidth; form.classList.add('is-wrong');
  });
  input.addEventListener('input', () => { note.textContent = ''; });
  $('[data-code-clear]').addEventListener('click', () => { show(null); input.value = ''; });

  /* ==========================================================
     THE NOW-PLAYING BAR is centred on the list: the middle of the area the list scrolls in, scrollbar excluded
     ========================================================== */
  const scroller = $('.vlt');
  const npEl = $('[data-np]');
  const syncNp = () => document.documentElement.style.setProperty('--vw', `${scroller.clientWidth}px`);
  syncNp(); addEventListener('resize', syncNp);
  if (window.ResizeObserver) new ResizeObserver(syncNp).observe(scroller);

  const top = $('[data-contact-link]');
  if (contact) top.href = `mailto:${contact}`; else top.hidden = true;
  /* A collection opens only from a link that carries its code (?code=HAP) or from typing the code — nothing is remembered,
     so a visitor who comes by any other way never finds one already open. (An older version kept the code in the tab's
     session; that is cleared here.) */
  try { sessionStorage.removeItem('kas-code'); } catch (_) {}
  show(keyOf(new URLSearchParams(location.search).get('code')));
})();
