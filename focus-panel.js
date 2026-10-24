/**
 * focus-panel.js
 * Draggable miniature focus timer with local soundscape controls.
 * Uses the existing focus timer and audio adapters. No account record writes.
 * Panel layout belongs in focus-panel.css; preserve keyboard movement and viewport bounds.
 * File map: docs/FILE-MAP.md
 */
/* A small focus companion. No backdrop, page navigation or account writes. */
(function (root) {
  'use strict';
  const STORE = 'mm-tracker.focus-panel.v1',
    esc = x =>
      String(x ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
  const art = (name, size = 17) =>
    '<svg width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
    ({
      focus: 'M9 3H4v5m11-5h5v5M4 16v5h5m11-5v5h-5M9 12h6m-3-3v6',
      rest: 'M8 3h8M9 3v4l-5 9a4 4 0 0 0 3.5 6h9a4 4 0 0 0 3.5-6l-5-9V3M12 17v-5m0 4c-3 0-4-2-3-3 2-1 3 1 3 3Zm0 1c3 0 4-2 3-3-2-1-3 1-3 3Z',
      move: 'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',
      sound: 'M3 16c3-8 5 8 9 0s6-8 9-3M3 8c3-8 5 8 9 0s6-8 9-3',
      pause: 'M8 5v14M16 5v14',
      play: 'M8 4l12 8-12 8V4Z',
      close: 'M6 6l12 12M6 18 18 6',
      minus: 'M5 12h14',
      expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    }[name] || '') +
    '"/></svg>';
  const button = (action, label, extra = '', cls = '') =>
    '<button type="button" data-focus="' +
    action +
    '" class="fp-button ' +
    cls +
    '" ' +
    extra +
    '>' +
    label +
    '</button>';
  const time = n =>
    String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  function install(a) {
    const $ = id => document.getElementById(id);
    const presentationBreak = root.WorkHubPresentationBreak?.install(a);
    let owner = '',
      opened = false,
      minimized = false,
      position = { x: 1, y: 1 },
      placed = false,
      drag = null,
      last = '',
      taskSignature = '',
      generation = 0;
    try {
      const p = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        position = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) };
        placed = true;
        minimized = p.minimized === true;
      }
    } catch {}
    const viewport = () => {
      const v = root.visualViewport;
      return {
        x: v?.offsetLeft || 0,
        y: v?.offsetTop || 0,
        w: Math.max(1, v?.width || root.innerWidth || 375),
        h: Math.max(1, v?.height || root.innerHeight || 667),
      };
    };
    const allowed = () =>
      a.ready() &&
      !document.hidden &&
      !document.body.matches('.hub-private,.hub-present') &&
      !document.querySelector('dialog[open]');
    function persist() {
      try {
        localStorage.setItem(STORE, JSON.stringify({ ...position, minimized }));
      } catch {}
    }
    function ensure() {
      if (!a.ready()) throw Error('Sign in to open Focus mode.');
    }
    function syncOwner() {
      presentationBreak?.sync();
      const next = a.owner();
      if (next !== owner) {
        const prior = owner;
        owner = next;
        generation++;
        opened = false;
        last = taskSignature = '';
        drag = null;
        $('focusPanel')?.remove();
        if (prior) {
          a.reset();
          a.soundscape()?.stop();
        }
        const label = $('focusModeButton')?.querySelector('span');
        if (label) label.textContent = 'Focus mode';
      }
      return next;
    }
    function toolbar() {
      const bar = $('hubToolbar');
      if (!bar) return;
      let b = $('focusModeButton');
      if (!b) {
        b = document.createElement('button');
        b.id = 'focusModeButton';
        b.type = 'button';
        b.dataset.focus = 'open';
        b.setAttribute('aria-controls', 'focusPanel');
        b.innerHTML = art('focus', 15) + '<span>Focus mode</span>';
      }
      b.hidden = !a.ready();
      b.setAttribute('aria-expanded', String(opened));
      let rest = $('breakTerrariumButton');
      if (!rest) {
        rest = document.createElement('button');
        rest.id = 'breakTerrariumButton';
        rest.type = 'button';
        // Reuse My Day's existing break action, duration and active-session handling.
        rest.dataset.md = 'break-start';
        rest.dataset.label = 'Rest your eyes';
        rest.setAttribute('aria-haspopup', 'dialog');
        rest.setAttribute('aria-controls', 'restRoom');
        rest.title = 'Start a break using your saved break length';
        rest.innerHTML = art('rest', 15) + '<span>Break Terrarium</span>';
      }
      rest.hidden = !a.ready();
      let shortcuts = $('focusShortcuts');
      if (!shortcuts) {
        shortcuts = document.createElement('div');
        shortcuts.id = 'focusShortcuts';
        shortcuts.className = 'hub-focus-shortcuts';
        shortcuts.setAttribute('role', 'group');
        shortcuts.setAttribute('aria-label', 'Focus and breaks');
      }
      if (b.parentElement !== shortcuts) shortcuts.append(b);
      if (b.nextElementSibling !== rest) b.after(rest);
      const reminder = $('reminderInboxButton');
      if (reminder && reminder.nextElementSibling !== shortcuts) reminder.after(shortcuts);
      else if (shortcuts.parentElement !== bar) bar.append(shortcuts);
      shortcuts.hidden = !a.ready();
      let presentation = $('presentationBreakButton');
      if (presentationBreak && !presentation) {
        presentation = document.createElement('button');
        presentation.id = 'presentationBreakButton';
        presentation.type = 'button';
        presentation.dataset.pb = 'open';
        presentation.setAttribute('aria-haspopup', 'dialog');
        presentation.innerHTML = art('expand', 15) + '<span>Presentation break</span>';
      }
      if (presentation) {
        if (shortcuts.nextElementSibling !== presentation) shortcuts.after(presentation);
        presentation.hidden = !a.ready();
      }
    }
    function build() {
      if ($('focusPanel')) return;
      const el = document.createElement('aside');
      el.id = 'focusPanel';
      el.className = 'focus-panel hub-private-only';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Floating Focus mode');
      el.innerHTML =
        '<header class="fp-header"><button type="button" class="fp-drag" data-focus="drag" aria-label="Move Focus panel. Drag or use arrow keys." title="Drag to move · arrow keys also work">' +
        art('move', 15) +
        '<span>Focus mode</span><span id="fpMiniClock" class="fp-mini-clock" aria-hidden="true"></span></button>' +
        button(
          'minimize',
          art('minus'),
          'aria-label="Minimise Focus panel" aria-expanded="true"',
          'fp-icon'
        ) +
        button(
          'close',
          art('close'),
          'aria-label="Hide Focus panel; the timer continues"',
          'fp-icon'
        ) +
        '</header><div class="fp-body"><div class="fp-intro"><span class="fp-eyebrow">A LITTLE ROOM FOR ONE THING</span><span class="fp-sun" aria-hidden="true"></span></div><div class="fp-clock-wrap"><span id="fpState" class="fp-state">Ready when you are</span><output id="fpClock" class="fp-clock" aria-label="Focus time remaining" aria-live="off">25:00</output><p id="fpTitle" class="fp-task hub-sensitive">Find your own rhythm.</p><div class="fp-progress" role="progressbar" aria-label="Focus session progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="fpProgress"></span></div></div><form id="fpFocusForm"><div class="fp-timer-fields"><label>Minutes<input id="fpMinutes" name="minutes" type="number" inputmode="numeric" min="1" max="1440" step="1" required value="25"></label><label id="fpTaskLabel">Focus on<select id="fpTask" name="task"><option value="">Focus freely</option></select></label></div><div class="fp-timer-actions"><button type="submit" id="fpStart" class="fp-button fp-primary">' +
        art('play', 14) +
        '<span>Start focus</span></button>' +
        button('pause', art('pause', 14) + '<span>Pause</span>', 'id="fpPause" hidden') +
        button('end', 'End', 'id="fpEnd" hidden', 'fp-quiet') +
        '</div></form><section class="fp-audio"><div class="fp-audio-heading"><h3>Your little soundtrack</h3>' +
        button('quiet', 'Stop audio', '', 'fp-text') +
        '</div><div id="fpSoundPane"><label class="fp-wide-label">Set the scene<select id="fpPreset"><option value="">Your saved mix</option><option value="rain">Rainy desk</option><option value="cafe">Café corner</option><option value="forest">Forest walk</option><option value="fireplace">By the fire</option><option value="lofi">Lo-fi study</option></select></label><div class="fp-sound-row">' +
        button('sound-play', art('play', 14) + '<span>Play</span>', 'id="fpSoundPlay"', 'fp-soft') +
        '<label class="fp-volume">Volume<input id="fpVolume" type="range" min="0" max="100" step="1" aria-label="Focus soundscape volume"></label>' +
        button('mute', 'Mute', 'id="fpMute" aria-pressed="false"', 'fp-text') +
        '</div>' +
        button('mix', 'Fine-tune your mix ↗', '', 'fp-text') +
        '</div><p id="fpAudioStatus" class="fp-audio-status" role="status">Choose a sound when you feel like it.</p></section><p class="fp-footer">Minimise for a little more space. Your timer keeps going.</p></div>';
      document.body.append(el);
      last = taskSignature = '';
      const minimize = el.querySelector('[data-focus="minimize"]');
      minimize.innerHTML = art(minimized ? 'expand' : 'minus');
      minimize.setAttribute(
        'aria-label',
        minimized ? 'Expand Focus panel' : 'Minimise Focus panel'
      );
      minimize.setAttribute('aria-expanded', String(!minimized));
      refresh(true);
    }
    function layout(avoid = false, pixels = null) {
      const el = $('focusPanel');
      if (!el) return;
      const v = viewport(),
        gap = Math.min(12, v.w / 6, v.h / 6),
        width = Math.max(1, Math.min(minimized ? 240 : 330, v.w - gap * 2)),
        maxHeight = Math.max(1, v.h - gap * 2);
      el.dataset.minimized = String(minimized);
      Object.assign(el.style, { width: width + 'px', maxHeight: maxHeight + 'px' });
      const height = Math.min(
          maxHeight,
          el.getBoundingClientRect().height || (minimized ? 54 : 492)
        ),
        rx = Math.max(0, v.w - width - gap * 2),
        ry = Math.max(0, v.h - height - gap * 2),
        left = v.x + gap,
        top = v.y + gap;
      if (pixels)
        position = {
          x: rx ? Math.max(0, Math.min(1, (pixels.x - left) / rx)) : 0,
          y: ry ? Math.max(0, Math.min(1, (pixels.y - top) / ry)) : 0,
        };
      if (avoid) {
        const obstacles = [
            ...document.querySelectorAll('#hubTimerBar,#soundscapeDock,#hubPet:not([hidden])'),
          ]
            .map(x => x.getBoundingClientRect())
            .filter(r => r.width && r.height),
          clear = p =>
            !obstacles.some(
              r =>
                p.x < r.right + 8 &&
                p.x + width > r.left - 8 &&
                p.y < r.bottom + 8 &&
                p.y + height > r.top - 8
            ),
          current = { x: left + rx * position.x, y: top + ry * position.y };
        if (!clear(current) || !placed) {
          const candidates = [
              { x: 1, y: 1 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: 0 },
              { x: 0.5, y: 0 },
            ],
            choice = candidates.find(p => clear({ x: left + rx * p.x, y: top + ry * p.y }));
          if (choice) position = choice;
          placed = true;
        }
      }
      el.style.left = left + rx * position.x + 'px';
      el.style.top = top + ry * position.y + 'px';
    }
    function refresh(force = false) {
      presentationBreak?.sync();
      const el = $('focusPanel');
      if (!el) return;
      const s = a.focus(),
        signature = JSON.stringify([s.active, s.paused, s.minutes, s.title, s.start]);
      if (force || signature !== last) {
        last = signature;
        $('fpMinutes').value = s.minutes;
        $('fpTaskLabel').hidden = s.active;
        $('fpStart').querySelector('span').textContent = s.active ? 'Update length' : 'Start focus';
        $('fpPause').hidden = $('fpEnd').hidden = !s.active;
        $('fpPause').querySelector('span').textContent = s.paused ? 'Resume' : 'Pause';
        $('fpPause').querySelector('svg').outerHTML = art(s.paused ? 'play' : 'pause', 14);
        $('fpPause').setAttribute(
          'aria-label',
          s.paused ? 'Resume focus timer' : 'Pause focus timer'
        );
        $('fpTitle').textContent = s.active
          ? s.title || 'One thing at a time.'
          : 'Find your own rhythm.';
      }
      const tasks = a.tasks(),
        sig = JSON.stringify(tasks.map(t => [t.id, t.task]));
      if (sig !== taskSignature) {
        taskSignature = sig;
        const chosen = $('fpTask').value;
        $('fpTask').innerHTML =
          '<option value="">Focus freely</option>' +
          tasks.map(t => '<option value="' + esc(t.id) + '">' + esc(t.task) + '</option>').join('');
        if (tasks.some(t => t.id === chosen)) $('fpTask').value = chosen;
      }
      const draft = Number($('fpMinutes').value),
        seconds = s.active
          ? s.remaining
          : (Number.isInteger(draft) && draft >= 1 && draft <= 1440 ? draft : s.minutes) * 60;
      $('fpClock').textContent = time(seconds);
      $('fpClock').dataset.long = String(seconds >= 60000);
      $('fpMiniClock').textContent = time(seconds);
      $('fpState').textContent = s.active
        ? s.paused
          ? 'A little pause'
          : 'In your focus flow'
        : 'Ready when you are';
      el.dataset.running = String(s.active && !s.paused);
      const pct = s.active
        ? Math.max(0, Math.min(100, Math.round((1 - s.remaining / (s.minutes * 60)) * 100)))
        : 0;
      $('fpProgress').style.width = pct + '%';
      el.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(pct));
      const sound = a.soundscape()?.snapshot();
      if (sound) {
        if (document.activeElement !== $('fpVolume')) $('fpVolume').value = sound.master;
        $('fpMute').textContent = sound.muted ? 'Unmute' : 'Mute';
        $('fpMute').setAttribute('aria-pressed', String(sound.muted));
        $('fpSoundPlay').querySelector('span').textContent = sound.playing ? 'Pause' : 'Play';
      }
      const audioStatus =
        sound?.error ||
        (sound?.playing
          ? sound.muted
            ? 'Soundscape is muted.'
            : 'Your soundscape is playing.'
          : 'Choose a scene, then press Play.');
      if ($('fpAudioStatus').textContent !== audioStatus)
        $('fpAudioStatus').textContent = audioStatus;
      $('focusModeButton')?.setAttribute('aria-expanded', String(opened));
      const label = $('focusModeButton')?.querySelector('span');
      if (label) {
        const name = s.active ? 'Focus mode · ' + (s.paused ? 'paused' : 'on') : 'Focus mode';
        if (label.textContent !== name) label.textContent = name;
      }
      const wasHidden = el.hidden;
      el.hidden = !opened || !allowed();
      if (wasHidden && !el.hidden) layout();
    }
    function mount() {
      syncOwner();
      toolbar();
      if (!$('focusPanel')) return;
      refresh();
      layout();
    }
    function open() {
      ensure();
      syncOwner();
      opened = true;
      build();
      refresh();
      layout(true);
      toolbar();
    }
    function hide() {
      opened = false;
      drag = null;
      refresh();
      toolbar();
      $('focusModeButton')?.focus({ preventScroll: true });
    }
    async function handle(el) {
      ensure();
      const action = el.dataset.focus;
      if (action === 'open') {
        open();
        return;
      }
      if (action === 'close') {
        hide();
        return;
      }
      if (action === 'drag') return;
      if (action === 'minimize') {
        minimized = !minimized;
        $('focusPanel').querySelector('[data-focus="minimize"]').innerHTML = art(
          minimized ? 'expand' : 'minus'
        );
        const b = $('focusPanel').querySelector('[data-focus="minimize"]');
        b.setAttribute('aria-label', minimized ? 'Expand Focus panel' : 'Minimise Focus panel');
        b.setAttribute('aria-expanded', String(!minimized));
        layout();
        persist();
        return;
      }
      if (action === 'pause') a.pause();
      if (action === 'end') a.end();
      if (action === 'sound-play') {
        const sound = a.soundscape();
        if (!sound) throw Error('Soundscape is unavailable.');
        const token = ++generation,
          account = owner;
        if (sound.snapshot().playing) sound.stop();
        else await sound.start();
        if (token !== generation || account !== a.owner()) return;
      }
      if (action === 'mute') {
        const sound = a.soundscape();
        sound?.setMuted(!sound.snapshot().muted);
      }
      if (action === 'mix') {
        a.soundscape()?.open();
        return;
      }
      if (action === 'quiet') {
        generation++;
        a.soundscape()?.stop();
      }
      refresh();
      layout(true);
    }
    document.addEventListener('click', e => {
      const el = e.target.closest?.('[data-focus]');
      if (!el) return;
      e.preventDefault();
      void handle(el).catch(err => a.tell(err.message, true));
    });
    document.addEventListener('submit', e => {
      if (e.target.id !== 'fpFocusForm') return;
      e.preventDefault();
      try {
        ensure();
        const f = e.target;
        a.start(Number(f.elements.namedItem('minutes').value), f.elements.namedItem('task').value);
        refresh(true);
        layout();
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'fpVolume') {
        a.soundscape()?.setMaster(Number(e.target.value));
        refresh();
      }
      if (
        e.target.id === 'fpMinutes' &&
        !a.focus().active &&
        Number.isInteger(Number(e.target.value)) &&
        Number(e.target.value) >= 1 &&
        Number(e.target.value) <= 1440
      )
        refresh();
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'fpPreset' && e.target.value) {
        a.soundscape()?.preset(e.target.value);
        refresh();
      }
    });
    document.addEventListener(
      'pointerdown',
      e => {
        const handle = e.target.closest?.('[data-focus="drag"]');
        if (!handle || e.button > 0) return;
        const el = $('focusPanel');
        drag = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          left: parseFloat(el.style.left),
          top: parseFloat(el.style.top),
          position: { ...position },
          handle,
        };
        try {
          handle.setPointerCapture?.(e.pointerId);
        } catch {}
      },
      { passive: true }
    );
    document.addEventListener(
      'pointermove',
      e => {
        if (!drag || drag.id !== e.pointerId) return;
        e.preventDefault();
        layout(false, { x: drag.left + e.clientX - drag.x, y: drag.top + e.clientY - drag.y });
      },
      { passive: false }
    );
    function endDrag(e, cancel = false) {
      if (!drag || (e && drag.id !== e.pointerId)) return;
      const old = drag;
      drag = null;
      if (cancel) {
        position = old.position;
        layout();
      } else persist();
      try {
        old.handle.releasePointerCapture?.(old.id);
      } catch {}
    }
    document.addEventListener('pointerup', e => endDrag(e));
    document.addEventListener('pointercancel', e => endDrag(e, true));
    root.addEventListener('blur', () => endDrag(null, true));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drag) {
        e.preventDefault();
        endDrag(null, true);
        return;
      }
      if (e.key === 'Escape' && e.target.closest?.('#focusPanel')) {
        e.preventDefault();
        hide();
        return;
      }
      if (
        !e.target.closest?.('[data-focus="drag"]') ||
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      )
        return;
      e.preventDefault();
      const el = $('focusPanel'),
        step = e.shiftKey ? 60 : 20;
      layout(false, {
        x:
          parseFloat(el.style.left) +
          (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
        y:
          parseFloat(el.style.top) +
          (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
      });
      persist();
    });
    root.addEventListener('resize', () => layout());
    root.visualViewport?.addEventListener('resize', () => layout());
    root.visualViewport?.addEventListener('scroll', () => layout());
    document.addEventListener('visibilitychange', () => refresh());
    if ($('modal'))
      new root.MutationObserver(() => refresh()).observe($('modal'), {
        attributes: true,
        attributeFilter: ['open'],
      });
    new root.MutationObserver(() => refresh()).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return {
      mount,
      open,
      hide,
      refresh,
      tick: refresh,
      layout,
      snapshot: () => ({ opened, minimized, source: 'soundscape', position: { ...position } }),
    };
  }
  root.WorkHubFocusPanel = { install };
})(window);
