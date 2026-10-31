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

  /* ==========================================================
     THE LIST
     ========================================================== */
  const PLAY = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 19 12 9 18.5Z"/></svg>' +
               '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5" width="5" height="14" rx="1.5"/><rect x="13.5" y="5" width="5" height="14" rx="1.5"/></svg>';

  /* a small music note on a dark tile, in front of every song */
  const NOTE = '<svg viewBox="0 0 24 24"><path d="M9.5 18V6.2l8-1.7v11.2"/><circle cx="7.2" cy="18" r="2.3"/><circle cx="15.7" cy="15.7" r="2.3"/></svg>';

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
      if (e.w !== w) { e.w = w; e.fill.style.width = w; }
      const n = String(Math.round(pct));
      if (e.n !== n) { e.n = n; e.scrub.setAttribute('aria-valuenow', n); }
      const txt = e === current && (t > 0 || !audio.paused) ? time(t) : time(d);
      if (e.txt !== txt) { e.txt = txt; e.timeEl.textContent = txt; }
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
      if (current) { const prev = current; setPlaying(prev, false); current = null; paint(prev); }
      current = e; landing = null;
      audio.preload = 'auto';
      audio.src = e.track.audio;
    }
    function toggle(e) {
      if (!e.track.audio) return;
      if (current !== e) select(e);
      if (audio.paused) audio.play().catch(() => setPlaying(e, false));
      else audio.pause();
    }
    function seek(e, ev) {
      if (!e.track.audio) return;
      const r = e.scrub.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      if (current !== e) { select(e); audio.play().catch(() => setPlaying(e, false)); }
      const go = () => { landing = audio.currentTime = ratio * (audio.duration || e.track.duration || 0); paint(e); };
      if (isFinite(audio.duration) && audio.duration) go();
      else audio.addEventListener('loadedmetadata', go, { once: true });
    }

    audio.addEventListener('play',  () => {
      if (!current) return;
      setPlaying(current, true); run();
      warm(entries.slice(entries.indexOf(current) + 1).find(n => n.track.audio)?.track);   // the next one is on its way before this one ends
    });
    audio.addEventListener('pause', () => { if (current) { setPlaying(current, false); paint(current); } });
    audio.addEventListener('timeupdate', () => {
      if (landing !== null && !audio.seeking && Math.abs(audio.currentTime - landing) < 1) landing = null;
      if (current && !dragging) paint(current);
    });
    audio.addEventListener('loadedmetadata', () => current && paint(current));
    audio.addEventListener('ended', () => {
      if (!current) return;
      const done = current, i = entries.indexOf(done);
      audio.currentTime = 0; landing = null;
      setPlaying(done, false);
      paint(done);
      /* someone working down a list wants the next one, not silence */
      const next = entries.slice(i + 1).find(n => n.track.audio);
      if (next) toggle(next);
    });

    /* space plays/pauses whatever is loaded, like the portfolio's player */
    document.addEventListener('keydown', ev => {
      if (ev.code !== 'Space' || !current || ev.target.closest('a, button, input, [role=slider]')) return;
      ev.preventDefault();
      toggle(current);
    });

    return {
      /* the list is being rebuilt (another collection): stop what is playing and forget the old rows */
      reset() {
        current = null; dragging = false; landing = null; entries.length = 0;
        audio.pause();
        audio.removeAttribute('src');
        try { audio.load(); } catch (_) {}
      },
      /* the first song is fetched ahead, so a first tap on play starts at once */
      warmFirst() { const f = entries.find(n => n.track.audio); if (f) warm(f.track); },
      add(row, track) {
        const e = {
          row, track,
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

  function render() {
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
    /* "Your selection" and how many songs it holds, over the lists */
    const head = document.createElement('div');
    head.className = 'sel';
    head.innerHTML = `<h2 class="sel__title">Your selection</h2><span class="sel__count">${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}</span>`;
    groups.appendChild(head);
    [...new Set(tracks.filter(t => !t.language).concat(tracks).map(t => t.language || ''))].forEach(listFor);

    /* a collection can switch the Request link off (request: false in CONFIG.demos.collections) */
    const canAsk = collections[active].request !== false;
    /* with nothing to put in the right-hand column (no Request link, no "on hold") the column goes */
    groups.classList.toggle('no-ask', tracks.every(t => t.audio && !STATUS_LABEL[t.status] && !(contact && canAsk)));

    tracks.forEach((t, i) => {
      const meta = [t.year, t.genre, t.bpm && `${t.bpm} BPM`, t.key].filter(Boolean).join(' · ');
      const state = STATUS_LABEL[t.status];                       // on hold / cut: no Request link
      const forWho = active ? `Collection: ${collections[active].name || active}\n` : '';
      const mail = contact && canAsk && !state
        ? `mailto:${contact}?subject=${encodeURIComponent(`Demo request: ${t.title}`)}&body=${encodeURIComponent(`Hi,\n\nI'd like to request the demo of "${t.title}".\n${forWho}\n`)}`
        : null;
      const li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = `
        <span class="row__no">${String(i + 1).padStart(2, '0')}</span>
        <span class="row__icon" aria-hidden="true">${NOTE}</span>
        <div class="row__info">
          <h2 class="row__title">${esc(t.title)}</h2>
          ${meta ? `<p class="row__meta">${esc(meta)}</p>` : ''}
          ${t.note ? `<p class="row__note">${esc(t.note)}</p>` : ''}
        </div>
        <div class="row__player">
          <button class="row__play" type="button" ${t.audio ? '' : 'disabled'}
                  aria-label="Play ${esc(t.title)}">${PLAY}</button>
          <div class="row__scrub" role="slider" tabindex="${t.audio ? 0 : -1}" aria-label="Seek ${esc(t.title)}"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" ${t.audio ? '' : 'aria-disabled="true"'}>
            <div class="row__track"><div class="row__fill"></div></div>
          </div>
          <span class="row__time">${t.audio ? time(t.duration) : ''}</span>
        </div>
        ${state ? `<p class="row__pending">${state}</p>`
          : !t.audio ? '<p class="row__pending">Audio to follow</p>'
          : mail ? `<a class="row__ask" href="${esc(mail)}">Request</a>` : '<span></span>'}`;
      listFor(t.language || '').appendChild(li);
      Player.add(li, t);
    });
    Player.warmFirst();
  }

  /* ==========================================================
     THE CODE BAR — a code shows one collection, nothing in it hides the rest of the page behind a lock
     ========================================================== */
  const form = $('[data-code-form]'), input = $('[data-code-input]'), note = $('[data-code-note]');
  const activeBox = $('[data-code-active]'), activeName = $('[data-code-name]');
  const keyOf = raw => Object.keys(collections).find(k => k.toLowerCase() === String(raw || '').trim().toLowerCase()) || null;

  function show(key) {
    active = key;
    Player.reset();
    render();
    activeBox.hidden = !key;
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
    if (key) { show(key); input.value = ''; input.blur(); return; }
    note.textContent = 'That code isn’t recognised.';
    form.classList.remove('is-wrong'); void form.offsetWidth; form.classList.add('is-wrong');
  });
  input.addEventListener('input', () => { note.textContent = ''; });
  $('[data-code-clear]').addEventListener('click', () => { show(null); input.value = ''; });

  const top = $('[data-contact-link]');
  if (contact) top.href = `mailto:${contact}`; else top.hidden = true;
  /* A collection opens only from a link that carries its code (?code=HAP) or from typing the code — nothing is remembered,
     so a visitor who comes by any other way never finds one already open. (An older version kept the code in the tab's
     session; that is cleared here.) */
  try { sessionStorage.removeItem('kas-code'); } catch (_) {}
  show(keyOf(new URLSearchParams(location.search).get('code')));
})();
