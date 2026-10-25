/** Private presenter controls. Only an explicit audience snapshot crosses the window boundary. */
(function (root) {
  'use strict';
  const base = new URL('./', document.currentScript?.src || document.baseURI);
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function install(a) {
    let connectionError = '',
      owner = '',
      popup = null,
      token = '',
      ready = false,
      lastSeen = 0,
      panel = null,
      preview = null,
      timer = 0,
      lastSent = 0;
    let cover = false,
      held = null,
      breakSession = null,
      marks = [],
      drawing = null,
      markFrame = 0,
      lastMarkSent = 0,
      sceneKey = '',
      infoKey = '';
    let tool = 'move',
      color = '#eab956',
      width = 4,
      textScale = 1,
      overview = false;
    const live = () =>
      !!(a.ready() && a.owner() && a.owner() === owner && (!a.active || a.active()));
    function connected() {
      try {
        return !!(live() && popup && !popup.closed && ready && Date.now() - lastSeen < 6000);
      } catch {
        return false;
      }
    }
    function notice(message) {
      const node = panel?.querySelector('[data-presenter-status]');
      if (node) node.textContent = message;
    }
    function send(type, fields = {}) {
      if (!popup) return;
      try {
        popup.postMessage({ type, token, ...fields }, root.location.origin);
      } catch {
        ready = false;
      }
    }
    function closePanel() {
      preview?.destroy();
      preview = null;
      if (panel) {
        panel.close();
        panel.remove();
        panel = null;
      }
      drawing = null;
      if (markFrame) root.cancelAnimationFrame(markFrame);
      markFrame = 0;
    }
    function close() {
      send('workhub-audience-end');
      try {
        popup?.close();
      } catch {}
      closePanel();
      if (timer) root.clearInterval(timer);
      timer = 0;
      popup = null;
      token = '';
      ready = false;
      lastSeen = 0;
      owner = '';
      cover = false;
      held = null;
      breakSession = null;
      marks = [];
      sceneKey = '';
      infoKey = '';
      tool = 'move';
      lastSent = 0;
    }
    function sync() {
      if (owner && !live()) {
        close();
        return;
      }
      if (popup) {
        try {
          if (popup.closed) {
            ready = false;
            notice('Audience window closed. Open it again when ready.');
          }
        } catch {
          ready = false;
        }
      }
    }
    function publicState() {
      if (cover)
        return {
          kind: 'cover',
          message: 'We’ll be right back.',
          subtitle: 'Please give us a moment.',
        };
      if (breakSession) {
        const now = breakSession.pausedAt ?? Date.now(),
          seconds = Math.max(0, Math.ceil((breakSession.end - now) / 1000));
        return {
          kind: 'break',
          message: breakSession.message,
          completeMessage: breakSession.completeMessage,
          scene: breakSession.scene,
          seconds,
          paused: breakSession.pausedAt != null,
          reduced:
            root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
            document.body.dataset.motion === 'off',
        };
      }
      if (held) return held;
      return a.snapshot();
    }
    function publish(force = false) {
      if (!live()) {
        if (owner) close();
        return;
      }
      if (!force && root.performance.now() - lastSent < 240) return;
      lastSent = root.performance.now();
      const snapshot = publicState(),
        key = snapshot.kind + '|' + snapshot.title + '|' + snapshot.active;
      if (sceneKey && sceneKey !== key) {
        marks = [];
        drawing = null;
      }
      sceneKey = key;
      const payload = {
        snapshot,
        marks: drawing ? [...marks, drawing] : marks,
        options: { textScale, overview },
      };
      if (connected()) send('workhub-audience-state', payload);
      preview?.update(payload.snapshot, payload.marks, payload.options);
      updateControls();
    }
    function updateControls() {
      if (!panel) return;
      const info = a.privateInfo(),
        state = a.snapshot(),
        key = JSON.stringify([info.processId, info.scenarioId, info.processes, info.scenarios]);
      if (key !== infoKey) {
        infoKey = key;
        for (const [name, rows, id] of [
          ['process', info.processes, info.processId],
          ['scenario', info.scenarios, info.scenarioId],
        ]) {
          const select = panel.querySelector(`[name="${name}"]`);
          select.innerHTML =
            (name === 'process' && !rows.some(r => r.id === id)
              ? '<option value="__demo__">Sample process</option>'
              : '') +
            rows
              .map(
                r =>
                  `<option value="${esc(r.id)}"${r.id === id ? ' selected' : ''}>${esc(r.name)}</option>`
              )
              .join('');
          select.value = id;
        }
      }
      panel.querySelector('[data-presenter-notes]').textContent =
        info.notes || 'No private notes maintained for this process.';
      panel.querySelector('[data-presenter-step]').textContent =
        state.detail?.title || 'Route complete';
      panel.querySelector('[name="interactive"]').checked = info.interactive;
      panel.querySelector('[data-presenter="play"]').textContent = info.paused ? 'Play' : 'Pause';
      for (const [action, on, label, off] of [
        ['hold', held, 'Release screen', 'Hold screen'],
        ['cover', cover, 'Show content', 'Hide content'],
      ]) {
        const b = panel.querySelector(`[data-presenter="${action}"]`);
        b.textContent = on ? label : off;
        b.setAttribute('aria-pressed', String(!!on));
      }
      panel.querySelector('[data-presenter="hold"]').disabled = !!(cover || breakSession);
      panel.querySelector('[data-presenter="break-pause"]').hidden = !breakSession;
      panel.querySelector('[data-presenter="break-end"]').hidden = !breakSession;
      panel.querySelector('[data-presenter="break-pause"]').textContent =
        breakSession?.pausedAt != null ? 'Resume countdown' : 'Pause countdown';
      const choices = panel.querySelector('[data-presenter-choices]'),
        q = state.decision;
      const html = q
        ? `<h3>${esc(q.question)}</h3>${q.answers.map((answer, i) => `<button type="button" data-presenter="answer" data-value="${i}">${esc(answer.label)}</button>`).join('')}`
        : '<p>Interactive answers appear here when a decision is reached.</p>';
      if (choices.innerHTML !== html) choices.innerHTML = html;
      if (connected())
        notice(
          cover
            ? 'Connected · audience content hidden'
            : held
              ? 'Connected · audience screen held'
              : breakSession
                ? 'Connected · presentation break'
                : 'Connected · share only the audience window'
        );
      else if (popup && !ready)
        notice('Waiting for audience window. If it was closed, select Open audience window.');
      else
        notice(
          connectionError || 'Audience connection interrupted. Reopen the window to reconnect.'
        );
      const locked = !!(held || cover || breakSession);
      for (const b of panel.querySelectorAll('[data-playback-control]')) b.disabled = locked;
      for (const b of choices.querySelectorAll('button')) b.disabled = locked;
    }
    function openWindow() {
      if (!live()) return;
      try {
        if (popup && !popup.closed) {
          popup.focus();
          return;
        }
      } catch {}
      token =
        root.crypto?.randomUUID?.() ||
        'audience-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      ready = false;
      lastSeen = 0;
      connectionError = '';
      const url = new URL('audience.html', base);
      url.hash = token;
      popup = root.open(url.href, 'workhub-audience-' + token, 'popup,width=1280,height=800');
      if (!popup) {
        connectionError =
          'The audience window was blocked. Allow pop-ups for this site, then select Open audience window.';
        notice(connectionError);
        a.tell?.('Allow pop-ups for this site, then choose Open audience window.');
      }
    }
    function open() {
      if (!a.ready() || !a.owner()) return;
      if (owner && owner !== a.owner()) close();
      owner = a.owner();
      if (!panel) {
        panel = document.createElement('dialog');
        panel.id = 'processPresenter';
        panel.className = 'presenter-panel';
        panel.setAttribute('aria-labelledby', 'presenterTitle');
        panel.innerHTML = `<header class="presenter-header"><div><span class="presenter-kicker">YOUR PRIVATE CONTROL ROOM</span><h2 id="presenterTitle">Present with confidence.</h2><p>Share the separate audience window. Your notes and controls stay here.</p></div><div class="actions"><button type="button" data-presenter="window">Open audience window ↗</button><button type="button" data-presenter="close-panel" aria-label="Close presenter controls">✕</button></div></header><div class="presenter-status" data-presenter-status role="status">Opening audience window…</div><div class="presenter-layout"><section class="presenter-screen"><div class="presenter-preview-label"><strong>AUDIENCE PREVIEW</strong><span>Move that window to your shared screen, then choose Full screen there.</span></div><div class="presenter-preview" tabindex="0" aria-label="Audience preview. Select a drawing tool to annotate."></div><div class="presenter-ink" role="group" aria-label="Live annotations"><button type="button" data-presenter="tool" data-value="move" aria-pressed="true">View</button><button type="button" data-presenter="tool" data-value="pen" aria-pressed="false">✎ Pen</button><button type="button" data-presenter="tool" data-value="arrow" aria-pressed="false">↗ Arrow</button><label>Colour<input type="color" name="color" value="${color}"></label><label>Width<input type="range" name="width" min="2" max="10" step="1" value="${width}"></label><button type="button" data-presenter="undo">Undo mark</button><button type="button" data-presenter="clear">Clear marks</button></div><p class="presenter-hint">Draw on this preview to highlight the audience screen. Marks clear when the step or scene changes; saved processes and exports stay unchanged. Up to 100 marks per scene.</p><div class="presenter-screen-options"><button type="button" data-presenter="hold" aria-pressed="false">Hold screen</button><button type="button" data-presenter="cover" aria-pressed="false">Hide content</button><label>Text size<input name="textScale" type="range" min="0.85" max="1.4" step="0.05" value="${textScale}"></label><label><input name="overview" type="checkbox"${overview ? ' checked' : ''}>Whole diagram</label></div><div class="presenter-notes"><span class="presenter-kicker">PRIVATE PRESENTER NOTES</span><h3 data-presenter-step></h3><p data-presenter-notes></p></div></section><aside class="presenter-controls"><section><h3>Your walkthrough</h3><label>Saved process<select name="process"></select></label><label>Scenario<select name="scenario"></select></label><div class="presenter-playback">${[
          ['back', '← Previous'],
          ['play', 'Pause'],
          ['next', 'Next →'],
          ['restart', 'Restart'],
        ]
          .map(
            ([action, label]) =>
              `<button type="button" data-presenter="${action}" data-playback-control>${label}</button>`
          )
          .join(
            ''
          )}</div><label class="presenter-check"><input name="interactive" type="checkbox">Ask me at decision steps</label><div class="presenter-choices" data-presenter-choices></div></section><section><h3>A break for your audience</h3><p>Silent presentation countdown. Your personal break and focus timers are unchanged.</p><form id="presenterBreakForm"><label>Your message<textarea name="message" maxlength="240" required placeholder="We’ll continue in a moment…"></textarea></label><div class="presenter-break-fields"><label>Minutes<input name="minutes" type="number" min="1" max="180" value="5" step="1" required></label><label>Scenery<select name="scene"><option value="coast">Coastal dawn</option><option value="mountains">Mountain dusk</option><option value="stars">Night sky</option></select></label></div><label>When finished<input name="completeMessage" maxlength="120" value="Ready to continue"></label><button type="submit">Show break on audience screen</button></form><div class="actions"><button type="button" data-presenter="break-pause" hidden>Pause countdown</button><button type="button" data-presenter="break-end" hidden>Return to process</button></div></section><button class="presenter-end" type="button" data-presenter="end">End presentation &amp; close audience</button></aside></div>`;
        document.body.append(panel);
        panel.showModal();
        const host = panel.querySelector('.presenter-preview');
        preview = root.WorkHubAudienceView.create(host);
        panel.addEventListener('cancel', e => {
          e.preventDefault();
          closePanel();
        });
        panel.addEventListener('click', event => {
          const b = event.target.closest('[data-presenter]');
          if (b)
            void action(b.dataset.presenter, b.dataset.value).catch(e => a.tell?.(e.message, true));
        });
        panel.addEventListener('change', event => {
          const el = event.target;
          if (el.name === 'color') color = el.value;
          else if (el.name === 'width') width = Number(el.value);
          else if (el.name === 'textScale') textScale = Number(el.value);
          else if (el.name === 'overview') overview = el.checked;
          else if (el.name === 'interactive') a.command('interactive', el.checked);
          else if (['process', 'scenario'].includes(el.name)) {
            if (held || cover || breakSession) {
              a.tell?.('Return to the live process before selecting another walkthrough.');
              infoKey = '';
            } else a.command(el.name, el.value);
          }
          publish(true);
        });
        panel.querySelector('form').addEventListener('submit', event => {
          event.preventDefault();
          if (!live()) return;
          const f = event.target,
            message = f.elements.namedItem('message').value.trim(),
            minutes = Number(f.elements.namedItem('minutes').value),
            scene = f.elements.namedItem('scene').value;
          if (
            !message ||
            message.length > 240 ||
            !Number.isInteger(minutes) ||
            minutes < 1 ||
            minutes > 180 ||
            !['coast', 'mountains', 'stars'].includes(scene)
          )
            return;
          breakSession = {
            message,
            scene,
            end: Date.now() + minutes * 60000,
            completeMessage:
              f.elements.namedItem('completeMessage').value.trim() || 'Ready to continue',
          };
          held = null;
          cover = false;
          marks = [];
          publish(true);
        });
        host.addEventListener('pointerdown', event => {
          if (tool === 'move' || event.button !== 0 || !live() || marks.length >= 100) return;
          event.preventDefault();
          host.setPointerCapture?.(event.pointerId);
          drawing = { type: tool, color, width, points: [point(event, host)] };
          publish(true);
        });
        host.addEventListener('pointermove', event => {
          if (!drawing) return;
          event.preventDefault();
          const p = point(event, host);
          if (drawing.type === 'arrow') drawing.points = [drawing.points[0], p];
          else if (drawing.points.length < 300) drawing.points.push(p);
          if (!markFrame)
            markFrame = root.requestAnimationFrame(() => {
              markFrame = 0;
              if (root.performance.now() - lastMarkSent >= 40) {
                lastMarkSent = root.performance.now();
                publish(true);
              }
            });
        });
        const finish = () => {
          if (!drawing) return;
          if (drawing.points.length > 1) marks.push(drawing);
          drawing = null;
          publish(true);
        };
        host.addEventListener('pointerup', finish);
        host.addEventListener('pointercancel', () => {
          drawing = null;
          publish(true);
        });
        infoKey = '';
      }
      openWindow();
      if (!timer)
        timer = root.setInterval(() => {
          sync();
          if (!live()) return;
          if (connected() && !held && !cover && !breakSession) a.backgroundPulse();
          publish(true);
        }, 500);
      publish(true);
    }
    function point(event, host) {
      const r = host.getBoundingClientRect();
      return [
        Math.max(0, Math.min(1, (event.clientX - r.left) / Math.max(1, r.width))),
        Math.max(0, Math.min(1, (event.clientY - r.top) / Math.max(1, r.height))),
      ];
    }
    async function action(name, value) {
      if (!live()) return;
      if (name === 'window') openWindow();
      else if (name === 'close-panel') closePanel();
      else if (name === 'end') {
        close();
        return;
      } else if (name === 'tool') {
        tool = value;
        panel.querySelector('.presenter-preview').dataset.tool = tool;
        for (const b of panel.querySelectorAll('[data-presenter="tool"]'))
          b.setAttribute('aria-pressed', String(b.dataset.value === tool));
      } else if (name === 'undo') marks.pop();
      else if (name === 'clear') {
        marks = [];
        drawing = null;
      } else if (name === 'cover') cover = !cover;
      else if (name === 'hold') {
        if (cover || breakSession) return;
        held = held ? null : { ...publicState(), playing: false };
        cover = false;
      } else if (name === 'break-end') {
        breakSession = null;
        held = null;
        cover = false;
        marks = [];
      } else if (name === 'break-pause' && breakSession) {
        if (breakSession.pausedAt != null) {
          breakSession.end += Date.now() - breakSession.pausedAt;
          delete breakSession.pausedAt;
        } else breakSession.pausedAt = Date.now();
      } else if (['play', 'next', 'back', 'restart', 'answer'].includes(name)) {
        if (held || cover || breakSession) return;
        await a.command(name, value);
      }
      publish(true);
    }
    root.addEventListener('message', event => {
      if (
        !live() ||
        event.origin !== root.location.origin ||
        event.source !== popup ||
        event.data?.token !== token
      )
        return;
      if (
        event.data.type === 'workhub-audience-ready' ||
        event.data.type === 'workhub-audience-heartbeat'
      ) {
        ready = true;
        lastSeen = Date.now();
        publish(true);
      } else if (event.data.type === 'workhub-audience-closed') {
        ready = false;
        notice('Audience window closed. Open it again when ready.');
      }
    });
    root.addEventListener('pagehide', close);
    return {
      open,
      close,
      sync,
      publish,
      connected,
      blocked: () => !!(held || cover || breakSession),
      snapshot: () => ({
        connected: connected(),
        holding: !!held,
        hidden: cover,
        breaking: !!breakSession,
        marks: marks.length,
      }),
    };
  }
  root.WorkHubPresenter = { install };
})(window);
