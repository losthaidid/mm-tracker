/** Immersive, account-bound break lifecycle. Work only resumes after the Resume work button. */
(function (root) {
  'use strict';
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const clock = n =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  function scene() {
    return `<div class="rest-landscape" aria-hidden="true"><div class="rest-halo"></div><div class="rest-star-ring"></div><div class="rest-globe"><div class="rest-glass-light"></div><div class="rest-moon"></div><svg viewBox="0 0 600 500" class="rest-plants"><defs><linearGradient id="restEarth" x2="0" y2="1"><stop stop-color="#759b72"/><stop offset="1" stop-color="#244e48"/></linearGradient></defs><path d="M0 405Q125 335 270 390T600 370V500H0Z" fill="#46786a"/><path d="M0 448Q135 374 308 421T600 415V500H0Z" fill="url(#restEarth)"/><g class="rest-fern"><path d="M197 440Q186 315 121 238" fill="none" stroke="#c3d2a4" stroke-width="4"/><path d="M165 356Q66 346 74 285 139 279 165 356ZM146 307Q66 277 88 226 149 244 146 307ZM188 408Q72 401 68 349 143 328 188 408ZM167 354Q160 263 213 259 243 318 167 354ZM189 412Q191 326 246 335 264 388 189 412Z" fill="#97b991"/></g><g class="rest-fern second"><path d="M402 443Q405 324 472 256" fill="none" stroke="#c3d2a4" stroke-width="4"/><path d="M423 367Q432 277 487 288 498 352 423 367ZM448 314Q450 234 501 252 508 304 448 314ZM405 417Q420 336 473 351 487 413 405 417ZM425 366Q349 354 360 298 417 298 425 366ZM405 419Q322 407 332 355 393 355 405 419Z" fill="#719f91"/></g><g class="rest-sprout"><path d="M302 450V327" stroke="#d4d6a7" stroke-width="4"/><path d="M302 390Q233 374 255 335 305 342 302 390ZM302 365Q359 334 370 370 352 405 302 402Z" fill="#b0c99c"/><path d="M302 327Q273 273 300 255 336 278 302 327Z" fill="#d9d7ab"/></g></svg>${Array.from({ length: 16 }, (_, i) => `<i class="rest-firefly" style="--i:${i};left:${12 + ((i * 19) % 76)}%;top:${25 + ((i * 29) % 56)}%"></i>`).join('')}<div class="rest-globe-base"></div></div><div class="rest-water"></div><span class="rest-scene-note">A SMALL PAUSE. A LITTLE ROOM TO GROW.</span></div>`;
  }
  function install(a) {
    let owner = '',
      session = null,
      dialog = null,
      trigger = null,
      resuming = false;
    const audio = root.WorkHubRestAudio.install({
      ready: () => a.ready() && !!session && session.owner === a.owner(),
      change: () => paintAudio(),
    });
    function seconds() {
      return session
        ? Math.max(0, Math.ceil((session.end - (session.pausedAt || Date.now())) / 1000))
        : 0;
    }
    function snapshot() {
      return session
        ? {
            owner: session.owner,
            label: session.label,
            start: session.start,
            end: session.end,
            duration: session.duration,
            pausedAt: session.pausedAt,
            complete: session.complete,
            seconds: session.complete ? 0 : seconds(),
          }
        : null;
    }
    function close() {
      audio.stop();
      if (dialog) {
        try {
          dialog.close();
        } catch {}
        dialog.remove();
        dialog = null;
      }
      document.body.classList.remove('rest-room-open');
    }
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        session = null;
        close();
        owner = next;
        trigger = null;
      }
    }
    function paintAudio() {
      if (!dialog) return;
      const s = audio.snapshot();
      dialog.dataset.music = s.playing ? 'playing' : 'quiet';
      const select = dialog.querySelector('[data-rest-track]');
      if (select && document.activeElement !== select) select.value = s.track;
      const volume = dialog.querySelector('[data-rest-volume]');
      if (volume && document.activeElement !== volume) volume.value = s.volume;
      dialog.querySelector('[data-rest-volume-label]').textContent = s.volume + '%';
      dialog.querySelector('[data-rest-music]').textContent = session?.pausedAt
        ? 'Music paused with break'
        : s.starting
          ? 'Preparing sound…'
          : s.playing
            ? 'Ⅱ Pause rest music'
            : '♫ Play rest music';
      dialog.querySelector('[data-rest-music]').disabled = !!session?.pausedAt || s.starting;
      dialog.querySelector('[data-rest-music]').setAttribute('aria-pressed', String(s.music));
      dialog.querySelector('[data-rest-audio-status]').textContent = s.error
        ? session?.complete
          ? 'Sound is unavailable. Your break is over; resume work when you’re ready.'
          : 'Sound is unavailable. The break timer is still running. Use Retry sound to try again.'
        : s.starting
          ? 'Preparing your rest soundscape…'
          : session?.complete
            ? 'The alarm keeps ringing until you press Resume work.'
            : s.music
              ? 'Rest-only music · warm pads, gentle bells and no focus beat.'
              : 'Rest music is off. The break-end alarm will still ring until Resume work.';
      dialog.querySelector('[data-rest="retry"]').hidden = !s.error;
    }
    function ensureDialog() {
      if (dialog) return;
      dialog = document.createElement('dialog');
      dialog.id = 'restRoom';
      dialog.className = 'rest-room';
      dialog.setAttribute('aria-labelledby', 'restRoomTitle');
      dialog.setAttribute('aria-describedby', 'restRoomDescription');
      dialog.setAttribute('aria-modal', 'true');
      dialog.innerHTML = `<div class="rest-room-shell"><header class="rest-room-top"><span class="rest-wordmark"><i aria-hidden="true">♧</i> YOUR REST TERRARIUM</span><span class="rest-state-chip" data-rest-phase-label></span></header><div class="rest-room-main"><section class="rest-copy"><span class="rest-kicker" data-rest-label></span><h2 id="restRoomTitle">A little pause.<br><em>A world of calm.</em></h2><p id="restRoomDescription">Let the world wait a moment. Your work and focus timers are safely paused.</p><div class="rest-countdown" role="timer" aria-label="Break time remaining" aria-live="off"><span data-rest-clock>05:00</span><small data-rest-clock-label>TIME JUST FOR YOU</small></div><div class="rest-progress" aria-hidden="true"><i data-rest-progress></i></div><p class="rest-live-status" role="status" data-rest-status></p><div class="rest-room-actions"><button type="button" class="rest-primary" data-rest="pause">Pause break</button><button type="button" data-rest="end">End break early</button><button type="button" class="rest-primary" data-rest="resume" hidden>Resume work <span aria-hidden="true">↗</span></button></div></section>${scene()}</div><section class="rest-audio-panel" aria-label="Rest soundscape"><div class="rest-music-label"><span aria-hidden="true" class="rest-music-waves"><i></i><i></i><i></i><i></i></span><div><strong>A different rhythm for rest</strong><small>Your focus soundscape stays unchanged.</small></div></div><label class="rest-track-label">Rest soundscape<select data-rest-track aria-label="Rest soundscape">${Object.entries(
        root.WorkHubRestAudio.TRACKS
      )
        .map(([key, s]) => `<option value="${key}">${s.name} · ${s.detail}</option>`)
        .join(
          ''
        )}</select></label><button type="button" data-rest="music" data-rest-music>Ⅱ Pause rest music</button><label class="rest-volume">Volume <output data-rest-volume-label></output><input type="range" min="0" max="100" step="1" data-rest-volume aria-label="Rest soundscape volume"></label><p class="rest-alarm-note"><span aria-hidden="true">◷</span> Break-end alarm · rings until Resume work</p><button type="button" data-rest="retry" hidden>Retry sound</button><p data-rest-audio-status></p></section><footer class="rest-room-footer"><span>ONE SMALL BREAK CAN CHANGE THE FEEL OF A DAY.</span><span>Resume work only when you choose.</span></footer></div>`;
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        finish(false);
      });
      dialog.addEventListener('click', event => {
        const action = event.target.closest('[data-rest]')?.dataset.rest;
        if (!action) return;
        sync();
        if (!session || session.owner !== a.owner()) return;
        if (action === 'pause') pause();
        if (action === 'end') finish(false);
        if (action === 'resume') resume();
        if (action === 'music') {
          const s = audio.snapshot();
          if (s.playing) audio.change('music', false);
          else if (!session.complete) {
            audio.change('music', true);
            startSound();
          }
        }
        if (action === 'retry') {
          startSound();
        }
      });
      dialog.addEventListener('input', event => {
        if (event.target.hasAttribute('data-rest-volume'))
          audio.change('volume', +event.target.value);
      });
      dialog.addEventListener('change', event => {
        if (event.target.hasAttribute('data-rest-track')) audio.change('track', event.target.value);
      });
      document.body.append(dialog);
    }
    function open() {
      sync();
      if (!session) return;
      ensureDialog();
      document.body.classList.add('rest-room-open');
      if (!dialog.open) {
        dialog.showModal();
        dialog
          .querySelector(session.complete ? '[data-rest="resume"]' : '[data-rest="pause"]')
          .focus();
      }
      paint();
    }
    function paint() {
      if (!session || !dialog) return;
      const phase = session.complete ? 'complete' : session.pausedAt ? 'paused' : 'resting',
        remaining = session.complete ? 0 : seconds();
      const changed = dialog.dataset.phase !== phase;
      dialog.dataset.phase = phase;
      dialog.dataset.motion =
        !a.motion() ||
        document.hidden ||
        document.body.matches('.hub-private,.hub-present') ||
        root.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'still'
          : 'flow';
      dialog.querySelector('[data-rest-label]').textContent = session.label.toUpperCase();
      dialog.querySelector('[data-rest-phase-label]').textContent = {
        resting: 'A MOMENT TO RECHARGE',
        paused: 'BREAK PAUSED',
        complete: 'READY WHEN YOU ARE',
      }[phase];
      dialog.querySelector('[data-rest-clock]').textContent = clock(remaining);
      dialog.querySelector('[data-rest-progress]').style.width =
        100 * (1 - remaining / session.duration) + '%';
      dialog.querySelector('[data-rest="pause"]').textContent = session.pausedAt
        ? 'Resume break'
        : 'Pause break';
      for (const key of ['pause', 'end'])
        dialog.querySelector(`[data-rest="${key}"]`).hidden = session.complete;
      for (const key of ['resume'])
        dialog.querySelector(`[data-rest="${key}"]`).hidden = !session.complete;
      dialog.querySelector('[data-rest-music]').hidden = session.complete;
      if (changed) {
        dialog.querySelector('#restRoomTitle').innerHTML = session.complete
          ? 'Your break<br><em>is over.</em>'
          : 'A little pause.<br><em>A world of calm.</em>';
        dialog.querySelector('#restRoomDescription').textContent = session.complete
          ? 'Take your time. Your work stays paused until you press Resume work.'
          : 'Let the world wait a moment. Your work and focus timers are safely paused.';
        dialog.querySelector('[data-rest-status]').textContent = session.complete
          ? 'Break complete. Press Resume work when you’re ready.'
          : session.pausedAt
            ? 'Your break and rest music are paused.'
            : 'Watch the light. Let yourself unwind.';
        if (session.complete) dialog.querySelector('[data-rest="resume"]').focus();
      }
      paintAudio();
      for (const el of document.querySelectorAll('[data-md-break-clock]'))
        el.textContent = clock(remaining);
    }
    function notify() {
      a.change?.();
      paint();
    }
    function startSound() {
      const current = session,
        job = audio.start();
      if (current?.pausedAt) audio.pause(true);
      void job.then(() => {
        if (session === current && current?.complete) {
          if (current.natural) {
            if (!audio.snapshot().alerting) audio.finish();
          } else audio.stop();
        }
      });
    }
    function start(label, duration) {
      sync();
      if (!owner) return;
      if (session) {
        open();
        return;
      }
      trigger = document.activeElement;
      const work = a.pauseWork(),
        f = a.focus(),
        focus = f.active && !f.paused ? { start: f.start } : null;
      if (focus) a.pauseFocus();
      const sound = a.soundscape?.(),
        s = sound?.snapshot(),
        music = !!(s?.playing || s?.starting);
      sound?.stop();
      const start = Date.now();
      session = {
        owner,
        label: String(label || 'A moment for yourself').slice(0, 80),
        start,
        end: start + duration * 1000,
        duration,
        complete: false,
        resume: { work, focus, music },
      };
      open();
      startSound();
      notify();
    }
    function pause() {
      sync();
      if (!session || session.complete) return;
      if (session.pausedAt) {
        session.end += Date.now() - session.pausedAt;
        delete session.pausedAt;
      } else session.pausedAt = Date.now();
      audio.pause(!!session.pausedAt);
      notify();
    }
    function finish(natural = true) {
      sync();
      if (!session || session.complete) return;
      session.complete = true;
      session.natural = natural;
      delete session.pausedAt;
      if (natural) audio.finish();
      else {
        audio.stop();
      }
      notify();
      a.tell(
        natural
          ? 'Your break is over. Resume work when you’re ready.'
          : 'Break ended. Your work is still paused.'
      );
    }
    function resume() {
      sync();
      if (!session || !session.complete || resuming) return;
      resuming = true;
      const saved = session.resume,
        sessionOwner = session.owner;
      session = null;
      close();
      if (a.ready() && sessionOwner === a.owner()) {
        try {
          if (saved.work) a.resumeWork(saved.work);
        } catch (e) {
          a.tell(e.message, true);
        }
        try {
          if (saved.focus) a.resumeFocus(saved.focus);
        } catch (e) {
          a.tell(e.message, true);
        }
        if (saved.music) void a.soundscape?.()?.start();
      }
      resuming = false;
      a.change?.();
      const target = trigger?.isConnected
        ? trigger
        : document.querySelector('[data-md="break-start"]');
      target?.focus({ preventScroll: true });
      trigger = null;
    }
    function tick() {
      sync();
      if (!session) return;
      if (!session.complete && !session.pausedAt && Date.now() >= session.end) finish(true);
      audio.tick();
      paint();
    }
    document.addEventListener('visibilitychange', tick);
    document.addEventListener(
      'keydown',
      event => {
        if (dialog?.open && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
    root.addEventListener('pagehide', () => {
      session = null;
      close();
    });
    return {
      start,
      pause,
      finish,
      resume,
      open,
      tick,
      sync,
      snapshot,
      audio: () => audio.snapshot(),
    };
  }
  root.WorkHubRestRoom = { install };
})(window);
