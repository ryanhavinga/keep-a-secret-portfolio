/* ============================================================
   KEEP A SECRET — FOR PUBLISHERS (publishing.html)
   The door · the list · one player shared by every row
   Content lives in js/config.js, under CONFIG.publishing.
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const P = CONFIG.publishing || {};
  const KEY = 'kas-publishing';
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
      /* a publisher working down a list wants the next one, not silence */
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
    if (P.heading) $('[data-pub-heading]').textContent = P.heading;
    const contact = P.contact || CONFIG.bio?.contact;
    const top = $('[data-contact-link]');
    if (contact) top.href = `mailto:${contact}`; else top.hidden = true;
    document.title = `${P.heading || 'Demos'} for Publishers — ${CONFIG.brand?.logo || 'Keep A Secret'}`;

    const list = $('[data-rows]');
    (P.tracks || []).forEach((t, i) => {
      const mail = contact
        ? `mailto:${contact}?subject=${encodeURIComponent(`Demo enquiry — ${t.title}`)}`
        : null;
      const li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = `
        <span class="row__no">${String(i + 1).padStart(2, '0')}</span>
        <div class="row__info">
          <h2 class="row__title">${esc(t.title)}</h2>
          ${t.artist ? `<p class="row__artist">${esc(t.artist)}</p>` : ''}
          ${t.genre ? `<p class="row__meta">${esc(t.genre)}</p>` : ''}
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
        ${t.audio
          ? (mail ? `<a class="row__ask" href="${esc(mail)}">Enquire</a>` : '<span></span>')
          : '<p class="row__pending" style="grid-area:ask">Audio to follow</p>'}`;
      list.appendChild(li);
      Player.add(li, t);
    });
  }

  /* ==========================================================
     THE DOOR — only the HAP password opens this page
     (CONFIG.gate.redirects; same hashing as the portfolio's door)
     ========================================================== */
  function door() {
    const el = $('[data-gate]');
    const cfg = CONFIG.gate || {};
    const mine = (cfg.redirects || []).filter(r => r.key === KEY);
    if (!el || !mine.length) return el?.remove();

    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch (_) {}
    if (seen) return el.remove();

    const sha256Hex = async str => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const form = $('[data-gate-form]', el), input = $('[data-gate-input]', el);
    const want = mine.map(r => String(r.passwordHash).trim().toLowerCase());

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (!want.includes(await sha256Hex(input.value.trim().toUpperCase()))) {
        el.classList.remove('is-wrong');
        void el.offsetWidth;
        el.classList.add('is-wrong');
        input.value = '';
        input.focus();
        return;
      }
      el.classList.remove('is-wrong');
      el.classList.add('is-open');
      try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
      setTimeout(() => el.remove(), 3600);   // past .gate's own 3.4s fade
    });
    input.addEventListener('input', () => el.classList.remove('is-wrong'));
    input.focus();
  }

  fill();
  door();
})();
