/* ============================================================
   KEEP A SECRET — THE VAULT (vault.html)
   The list · one player shared by every row · the door for a direct link
   Content lives in js/config.js, under CONFIG.vault.
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const V = CONFIG.vault || {};
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

    function paint(e) {
      const d = length(e);
      const t = e === current ? audio.currentTime : 0;
      const pct = d ? Math.min(100, t / d * 100) : 0;
      e.fill.style.width = `${pct}%`;
      e.scrub.setAttribute('aria-valuenow', Math.round(pct));
      e.timeEl.textContent = e === current && (t > 0 || !audio.paused) ? time(t) : time(d);
    }
    function setPlaying(e, on) {
      e.row.classList.toggle('is-playing', on);
      e.btn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${e.track.title}`);
    }
    function select(e) {
      if (current === e) return;
      if (current) { const prev = current; setPlaying(prev, false); current = null; paint(prev); }
      current = e;
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
      const go = () => { audio.currentTime = ratio * (audio.duration || e.track.duration || 0); paint(e); };
      if (isFinite(audio.duration) && audio.duration) go();
      else audio.addEventListener('loadedmetadata', go, { once: true });
    }

    audio.addEventListener('play',  () => current && setPlaying(current, true));
    audio.addEventListener('pause', () => current && setPlaying(current, false));
    audio.addEventListener('timeupdate', () => current && !dragging && paint(current));
    audio.addEventListener('loadedmetadata', () => current && paint(current));
    audio.addEventListener('ended', () => {
      if (!current) return;
      const done = current, i = entries.indexOf(done);
      audio.currentTime = 0;
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
      add(row, track) {
        const e = {
          row, track,
          btn: $('.row__play', row), scrub: $('.row__scrub', row),
          fill: $('.row__fill', row), timeEl: $('.row__time', row)
        };
        entries.push(e);
        e.btn.addEventListener('click', () => toggle(e));
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
          audio.currentTime = Math.max(0, audio.currentTime + (ev.key === 'ArrowRight' ? 5 : -5));
          paint(e);
        });
      }
    };
  })();

  function fill() {
    const contact = V.contact || CONFIG.bio?.contact;
    const top = $('[data-contact-link]');
    if (contact) top.href = `mailto:${contact}`; else top.hidden = true;

    /* one list per language, in the order each first appears; a song with
       no language goes in a list of its own above them, without a heading */
    const groups = $('[data-groups]'), lists = new Map();
    const listFor = lang => {
      if (lists.has(lang)) return lists.get(lang);
      const sec = document.createElement('section');
      sec.className = 'group';
      if (lang) sec.innerHTML = `<h2 class="group__title">${esc(lang)}</h2>`;
      const ol = document.createElement('ol');
      ol.className = 'rows';
      sec.appendChild(ol);
      groups.appendChild(sec);
      lists.set(lang, ol);
      return ol;
    };
    const tracks = V.tracks || [];
    [...new Set(tracks.filter(t => !t.language).concat(tracks).map(t => t.language || ''))].forEach(listFor);

    tracks.forEach((t, i) => {
      const meta = [t.genre, t.bpm && `${t.bpm} BPM`, t.key].filter(Boolean).join(' · ');
      const state = STATUS_LABEL[t.status];                       // on hold / cut: no Request link
      const mail = contact && !state
        ? `mailto:${contact}?subject=${encodeURIComponent(`Demo request: ${t.title}`)}&body=${encodeURIComponent(`Hi,\n\nI'd like to request the demo of "${t.title}".\n\n`)}`
        : null;
      const li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = `
        <span class="row__no">${String(i + 1).padStart(2, '0')}</span>
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
  }

  /* ==========================================================
     THE DOOR — the Vault's password (CONFIG.gate; wired by js/nav.js)
     Almost everyone has already typed it at the page pill, and walks
     straight in. This door is for a link that goes directly to this page.
     ========================================================== */
  function door() {
    const el = $('[data-gate]');
    if (!el) return;
    if (window.kasVault.unlocked()) return el.remove();
    const input = window.kasVault.wire(el, () => {
      el.classList.add('is-open');
      setTimeout(() => el.remove(), 3600);   // past .gate's own 3.4s fade
    });
    input.focus();
  }

  fill();
  door();
})();
