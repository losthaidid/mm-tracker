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
      lastSent = 0,
      canvasUI = null,
      publicOverlay = null,
      publicView = null,
      launchEpoch = 0,
      launchPlacement = '',
      previousTitle = null;
    const rich = !!(a.canvas && root.WorkHubProcessCanvas);
    let cover = false,
      held = null,
      breakSession = null,
      marks = [],
      drawing = null,
      markFrame = 0,
      sceneKey = '',
      infoKey = '';
    let laser = null,
      laserFrame = 0,
      textDraft = '',
      textSize = 24,
      gesture = null,
      selectedMark = -1,
      camera = null,
      mapOnly = true,
      audienceFull = false,
      fullscreenPending = false;
    let tool = 'move',
      color = '#eab956',
      width = 4,
      textScale = 1,
      overview = true;
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
    function clearLaser() {
      laser = null;
      if (laserFrame) root.cancelAnimationFrame(laserFrame);
      laserFrame = 0;
      preview?.pointer(null);
      publicView?.pointer(null);
      send('workhub-audience-pointer', { pointer: null });
    }
    function pointLaser(event, host) {
      laser = point(event, host);
      if (!laserFrame)
        laserFrame = root.requestAnimationFrame(() => {
          laserFrame = 0;
          if (!live() || !panel || tool !== 'laser') return;
          preview?.pointer(laser);
          publicView?.pointer(laser);
          if (connected()) send('workhub-audience-pointer', { pointer: laser });
        });
    }

    function setTool(value) {
      if (!['move', 'select', 'pen', 'arrow', 'text', 'laser'].includes(value)) return;
      clearLaser();
      tool = value;
      if (value !== 'select') selectedMark = -1;
      if (!panel) return;
      panel.querySelector('.presenter-preview').dataset.tool = tool;
      for (const b of panel.querySelectorAll('[data-presenter="tool"]'))
        b.setAttribute('aria-pressed', String(b.dataset.value === tool));
    }
    function selectMark(index) {
      selectedMark = index >= 0 && index < marks.length ? index : -1;
      const m = marks[selectedMark];
      if (m && panel) {
        color = m.color;
        width = m.width;
        panel.querySelector('[name="color"]').value = color;
        panel.querySelector('[name="width"]').value = width;
      }
      if (m?.type === 'text' && panel) {
        textDraft = m.text;
        textSize = m.fontSize;
        panel.querySelector('[name="annotationText"]').value = textDraft;
        panel.querySelector('[name="annotationSize"]').value = textSize;
      }
    }
    function cancelGesture() {
      if (gesture?.kind === 'mark' && marks[gesture.index]) marks[gesture.index] = gesture.original;
      if (gesture?.kind === 'pan') camera = gesture.previousCamera;
      gesture = null;
      drawing = null;
    }
    function queuePublish() {
      if (!markFrame)
        markFrame = root.requestAnimationFrame(() => {
          markFrame = 0;
          if (!live() || !panel) return;
          publish(true);
        });
    }
    function zoomCanvas(factor, event) {
      const host = panel?.querySelector('.presenter-preview'),
        graph = host?.querySelector('.av-graph'),
        c = preview?.camera();
      if (!graph || !c || held || cover || breakSession || publicState().kind !== 'process') return;
      const rect = graph.getBoundingClientRect(),
        point = event
          ? root.WorkHubAudienceView.graphPoint([event.clientX, event.clientY], rect, c)
          : { x: c.x + c.width / 2, y: c.y + c.height / 2 };
      factor = Math.max(
        Math.max(200 / c.width, 100 / c.height),
        Math.min(Math.min(20000 / c.width, 20000 / c.height), factor)
      );
      camera = {
        x: point.x - (point.x - c.x) * factor,
        y: point.y - (point.y - c.y) * factor,
        width: c.width * factor,
        height: c.height * factor,
      };
      publish(true);
    }
    async function fullscreenAudience() {
      if (!live() || !popup || fullscreenPending) return;
      const current = popup,
        currentToken = token;
      let target;
      try {
        target = current.document.documentElement;
      } catch {}
      if (!target) return;
      fullscreenPending = true;
      try {
        if (!current.document.fullscreenElement) {
          if (a.screens) await a.screens.fullscreen(target);
          else await target.requestFullscreen?.({ navigationUI: 'hide' });
        }
      } catch {
      } finally {
        fullscreenPending = false;
        if (!live() || current !== popup || token !== currentToken) return;
        try {
          audienceFull = !!current.document.fullscreenElement;
        } catch {
          audienceFull = false;
        }
        if (!audienceFull) {
          send('workhub-audience-fullscreen-needed');
          try {
            current.focus();
          } catch {}
        }
        updateControls();
      }
    }
    function closePanel() {
      clearLaser();
      tool = 'move';
      canvasUI?.destroy();
      canvasUI = null;
      preview?.destroy();
      preview = null;
      if (panel) {
        panel.close();
        panel.remove();
        panel = null;
      }
      cancelGesture();
      selectedMark = -1;
      if (markFrame) root.cancelAnimationFrame(markFrame);
      markFrame = 0;
    }
    function close() {
      launchEpoch++;
      if (previousTitle !== null) {
        document.title = previousTitle;
        previousTitle = null;
      }
      document.body.classList.remove('pc-presenting');
      publicView?.destroy();
      publicView = null;
      if (publicOverlay) {
        const stage = publicOverlay.firstElementChild;
        if (document.fullscreenElement === stage) void document.exitFullscreen?.().catch(() => {});
        publicOverlay.close();
        publicOverlay.remove();
        publicOverlay = null;
      }
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
      camera = null;
      overview = true;
      mapOnly = true;
      audienceFull = false;
      fullscreenPending = false;
    }
    function sync() {
      if (owner && !live()) {
        close();
        return;
      }
      if (popup) {
        try {
          if (rich && popup.closed) {
            close();
            return;
          }
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
      canvasUI?.sync();
      const raw = publicState(),
        snapshot = canvasUI && !held && !cover && !breakSession ? canvasUI.snapshot(raw) : raw,
        key = snapshot.kind + '|' + snapshot.title + '|' + snapshot.active;
      if (sceneKey && sceneKey !== key) {
        marks = [];
        drawing = null;
        gesture = null;
        selectedMark = -1;
        clearLaser();
      }
      if (
        sceneKey &&
        sceneKey.split('|').slice(0, 2).join('|') !== key.split('|').slice(0, 2).join('|')
      )
        camera = null;
      sceneKey = key;
      const payload = {
        snapshot,
        marks: drawing ? [...marks, drawing] : marks,
        options: { textScale, overview, camera, mapOnly },
      };
      if (connected()) send('workhub-audience-state', payload);
      publicView?.update(payload.snapshot, payload.marks, payload.options);
      preview?.update(payload.snapshot, payload.marks, {
        ...payload.options,
        selected: selectedMark,
        interactive: true,
        ...canvasUI?.options(),
      });
      updateControls();
    }
    function updateControls() {
      if (!panel) return;
      if (rich && publicOverlay) {
        audienceFull = document.fullscreenElement === publicOverlay.firstElementChild;
        const title = 'Audience · ' + a.snapshot().title;
        if (document.title !== title) document.title = title;
      }
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
      for (const button of panel.querySelectorAll('[data-presenter="play"]'))
        button.textContent = info.paused ? 'Play' : 'Pause';
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
                : rich
                  ? 'Connected · share the original audience window; keep this private canvas unshared'
                  : 'Connected · share only the audience window'
        );
      else if (popup && !ready)
        notice(
          rich
            ? 'Opening private controls…'
            : 'Waiting for audience window. If it was closed, select Open audience window.'
        );
      else
        notice(
          connectionError || 'Audience connection interrupted. Reopen the window to reconnect.'
        );
      const display = panel.querySelector('[data-presenter-display-status]');
      if (display)
        display.textContent = audienceFull
          ? 'Audience is in true fullscreen · Esc exits'
          : rich
            ? 'Audience fills its window · native fullscreen was not granted by this browser'
            : 'Audience is windowed · click Start full screen in the audience window if requested';
      const markStatus = panel.querySelector('[data-presenter-mark-status]');
      if (markStatus)
        markStatus.textContent =
          selectedMark >= 0
            ? 'Selected ' +
              marks[selectedMark]?.type +
              ' · drag or use arrow keys; Delete removes it'
            : 'Choose Select / move, then click a text note or arrow.';
      const update = panel.querySelector('[data-presenter="update-text"]');
      if (update)
        update.textContent =
          rich || marks[selectedMark]?.type === 'text'
            ? 'Update selected text'
            : 'Update last text';
      const remove = panel.querySelector('[data-presenter="delete-mark"]');
      if (remove) remove.disabled = rich ? !canvasUI?.state().selected : selectedMark < 0;
      const locked = !!(held || cover || breakSession);
      for (const b of panel.querySelectorAll('[data-playback-control]')) b.disabled = locked;
      for (const b of choices.querySelectorAll('button')) b.disabled = locked;
    }

    function adoptControls() {
      if (!rich || !popup || !panel) return;
      try {
        if (panel.ownerDocument !== popup.document) {
          panel.close();
          popup.document.body.replaceChildren();
          popup.document.body.append(panel);
          panel.showModal();
        }
        popup.focus();
      } catch {
        notice('Private controls could not open. End this presentation and launch it again.');
      }
    }
    function startPublicStage() {
      if (!rich) {
        openWindow();
        return;
      }
      const epoch = ++launchEpoch;
      launchPlacement =
        'popup,left=' +
        Math.round((root.screenX || 0) + 40) +
        ',top=' +
        Math.round((root.screenY || 0) + 40) +
        ',width=' +
        Math.min(1440, root.screen?.availWidth || 1280) +
        ',height=' +
        Math.min(1000, root.screen?.availHeight || 850);
      if (publicOverlay) {
        try {
          popup?.focus();
        } catch {}
        return;
      }
      previousTitle = document.title;
      document.body.classList.add('pc-presenting');
      publicOverlay = document.createElement('dialog');
      publicOverlay.id = 'processAudienceOverlay';
      publicOverlay.innerHTML =
        '<section id="processAudienceStage" aria-label="Audience presentation"></section>';
      publicOverlay.addEventListener('cancel', e => {
        e.preventDefault();
        close();
      });
      document.body.append(publicOverlay);
      publicOverlay.showModal();
      const stage = publicOverlay.firstElementChild;
      publicView = root.WorkHubAudienceView.create(stage);
      publish(true);
      // Same sequence as Presentation Break: the click requests fullscreen on
      // the current document's audience-only stage before opening the companion.
      let request;
      try {
        request = a.screens
          ? a.screens.fullscreen(stage)
          : stage.requestFullscreen?.({ navigationUI: 'hide' });
      } catch {
        request = false;
      }
      Promise.resolve(request)
        .catch(() => false)
        .then(() => {
          if (epoch !== launchEpoch || !live() || !publicOverlay) {
            if (document.fullscreenElement === stage)
              void document.exitFullscreen?.().catch(() => {});
            return;
          }
          audienceFull = document.fullscreenElement === stage;
          openWindow();
          if (!popup) {
            publicView.destroy();
            publicView = null;
            publicOverlay.close();
            publicOverlay.remove();
            publicOverlay = null;
            if (document.fullscreenElement === stage)
              void document.exitFullscreen?.().catch(() => {});
            notice(
              'Allow pop-ups for the private presenter window, then close these controls and launch Presenter controls again.'
            );
          } else if (!audienceFull)
            notice(
              'The audience fills the window. This browser did not allow native fullscreen; Esc returns to the workspace.'
            );
        });
    }
    function openWindow() {
      if (!live()) return;
      try {
        if (popup && !popup.closed) {
          if (!popup.document?.fullscreenElement) a.screens?.place(popup);
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
      const url = new URL(rich ? 'presenter-window.html' : 'audience.html', base);
      url.hash = token;
      url.searchParams.set('fullscreen', '1');
      popup = root.open(
        url.href,
        'workhub-audience-' + token,
        rich ? launchPlacement : a.screens?.features() || 'popup,width=1280,height=800'
      );
      if (!popup) {
        connectionError = rich
          ? 'Allow pop-ups for the private presenter window, then end this presentation and launch Presenter controls again.'
          : 'The audience window was blocked. Allow pop-ups for this site, then select Open audience window.';
        notice(connectionError);
        if (rich) {
          const hint = panel.querySelector('[data-pc-notice]');
          if (hint) hint.textContent = connectionError;
          document.body.classList.remove('pc-presenting');
          if (previousTitle !== null) document.title = previousTitle;
        }
        a.tell?.(connectionError);
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
        panel.innerHTML = `<header class="presenter-header"><div><span class="presenter-kicker">YOUR PRIVATE CONTROL ROOM</span><h2 id="presenterTitle">Present with confidence.</h2><p>Share the separate audience window. Your notes and controls stay here.</p></div><div class="actions"><button type="button" data-presenter="expand" aria-pressed="false">Expand canvas</button><button type="button" data-presenter="window">Open audience window ↗</button><button type="button" data-presenter="close-panel" aria-label="Close presenter controls">✕</button></div></header><div class="presenter-status" data-presenter-status role="status">Opening audience window…</div><div class="presenter-display-actions"><button type="button" data-presenter="fullscreen">⛶ Audience full screen</button><span data-presenter-display-status role="status"></span><details class="presenter-screen-setup"><summary>Choose display</summary>${a.screens ? a.screens.markup('presenterScreen', 'data-presenter="screens"') : ''}</details></div><div class="presenter-layout"><section class="presenter-screen"><div class="presenter-preview-label"><strong>AUDIENCE PREVIEW</strong><span>Drag the diagram to pan, scroll to zoom, or click a step to explain it.</span></div><div class="presenter-preview" tabindex="0" data-tool="move" aria-label="Interactive process canvas. Drag to pan, scroll to zoom, click a step, or choose Select / move for annotations."></div><div class="presenter-canvas-tools"><button type="button" data-presenter="back" data-playback-control aria-label="Previous process step">←</button><button type="button" data-presenter="play" data-playback-control>Pause</button><button type="button" data-presenter="next" data-playback-control aria-label="Next process step">→</button><button type="button" data-presenter="zoom-out" aria-label="Zoom diagram out">−</button><button type="button" data-presenter="zoom-in" aria-label="Zoom diagram in">＋</button><button type="button" data-presenter="fit">Fit diagram</button><button type="button" data-presenter="follow">Follow current step</button><label><input name="details" type="checkbox">Show step details</label><span data-presenter-mark-status role="status"></span></div><div class="presenter-ink" role="group" aria-label="Live annotations"><button type="button" data-presenter="tool" data-value="move" aria-pressed="true">Explore</button><button type="button" data-presenter="tool" data-value="select" aria-pressed="false">Select / move</button><button type="button" data-presenter="tool" data-value="pen" aria-pressed="false">✎ Pen</button><button type="button" data-presenter="tool" data-value="arrow" aria-pressed="false">↗ Arrow</button><button type="button" data-presenter="tool" data-value="text" aria-pressed="false">T Text</button><button type="button" data-presenter="tool" data-value="laser" aria-pressed="false">● Laser pointer</button><label>Colour<input type="color" name="color" value="${color}"></label><label>Width<input type="range" name="width" min="2" max="10" step="1" value="${width}"></label><button type="button" data-presenter="delete-mark" disabled>Delete selected</button><button type="button" data-presenter="undo">Undo mark</button><button type="button" data-presenter="clear">Clear marks</button></div><div class="presenter-text-tools"><label>Live text<textarea name="annotationText" maxlength="240" rows="2" placeholder="Type a message, choose Text, then click the preview to place it.">${esc(textDraft)}</textarea></label><label>Text size<input name="annotationSize" type="number" min="16" max="40" step="2" value="${textSize}"></label><button type="button" data-presenter="update-text">Update last text</button></div><p class="presenter-hint">Explore moves the diagram; Select / move repositions placed text, arrows and pen marks. Select a note to edit its text. Marks stay on the screen while you pan or zoom; Escape cancels a drag. Marks clear when the step or scene changes; saved processes and exports stay unchanged. Up to 100 marks per scene.</p><div class="presenter-screen-options"><button type="button" data-presenter="hold" aria-pressed="false">Hold screen</button><button type="button" data-presenter="cover" aria-pressed="false">Hide content</button><label>Text size<input name="textScale" type="range" min="0.85" max="1.4" step="0.05" value="${textScale}"></label><label><input name="overview" type="checkbox"${overview ? ' checked' : ''}>Whole diagram</label></div><div class="presenter-notes"><span class="presenter-kicker">PRIVATE PRESENTER NOTES</span><h3 data-presenter-step></h3><p data-presenter-notes></p></div></section><aside class="presenter-controls"><section><h3>Your walkthrough</h3><label>Saved process<select name="process"></select></label><label>Scenario<select name="scenario"></select></label><div class="presenter-playback">${[
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
          if (rich) close();
          else closePanel();
        });
        panel.addEventListener('click', event => {
          const b = event.target.closest('[data-presenter]');
          if (b)
            void action(b.dataset.presenter, b.dataset.value).catch(e => a.tell?.(e.message, true));
        });
        panel.addEventListener('change', event => {
          const el = event.target;
          if (el.matches('[data-presentation-screen]')) {
            a.screens?.choose(el.value);
            return;
          }
          if (el.name === 'annotationText') textDraft = el.value.slice(0, 240);
          else if (el.name === 'annotationSize')
            textSize = Math.max(16, Math.min(40, Number(el.value) || 24));
          else if (el.name === 'color') {
            color = el.value;
            if (tool === 'select' && marks[selectedMark]) marks[selectedMark].color = color;
          } else if (el.name === 'width') {
            width = Number(el.value);
            if (tool === 'select' && marks[selectedMark]) marks[selectedMark].width = width;
          } else if (el.name === 'textScale') textScale = Number(el.value);
          else if (el.name === 'overview') {
            overview = el.checked;
            camera = null;
          } else if (el.name === 'details') mapOnly = !el.checked;
          else if (el.name === 'interactive') a.command('interactive', el.checked);
          else if (['process', 'scenario'].includes(el.name)) {
            if (held || cover || breakSession) {
              a.tell?.('Return to the live process before selecting another walkthrough.');
              infoKey = '';
            } else a.command(el.name, el.value);
          }
          publish(true);
        });
        panel.querySelector('#presenterBreakForm').addEventListener('submit', event => {
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
          clearLaser();
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
          if (event.button !== 0 || !live() || gesture || drawing) return;
          if (tool === 'laser') {
            pointLaser(event, host);
            return;
          }
          const p = point(event, host),
            V = root.WorkHubAudienceView;
          if (tool === 'move') {
            const graph = host.querySelector('.av-graph'),
              c = preview.camera();
            if (!event.target.closest('.av-map') || !graph || !c || held || cover || breakSession)
              return;
            gesture = {
              kind: 'pan',
              id: event.pointerId,
              start: [event.clientX, event.clientY],
              rect: graph.getBoundingClientRect(),
              camera: c,
              previousCamera: camera,
              node: event.target.closest('[data-node]')?.dataset.node,
              moved: false,
            };
          } else if (tool === 'select') {
            selectMark(V.hitMark(marks, p));
            if (selectedMark >= 0)
              gesture = {
                kind: 'mark',
                id: event.pointerId,
                index: selectedMark,
                start: p,
                original: marks[selectedMark],
              };
            publish(true);
          } else {
            if (marks.length >= 100) return;
            if (!held && !cover && !breakSession && !a.privateInfo().paused) void a.command('play');
            if (tool === 'text') {
              const text = panel
                .querySelector('[name="annotationText"]')
                .value.trim()
                .slice(0, 240);
              if (!text) {
                a.tell?.('Type your live text first, then click the preview.');
                return;
              }
              const size = Math.max(
                16,
                Math.min(40, Number(panel.querySelector('[name="annotationSize"]').value) || 24)
              );
              const mark = { type: 'text', text, fontSize: size, color, width, points: [p] };
              marks.push(V.moveMark(mark, 0, 0));
              selectMark(marks.length - 1);
              setTool('select');
              publish(true);
              return;
            }
            drawing = { type: tool, color, width, points: [p], pointerId: event.pointerId };
            publish(true);
          }
          event.preventDefault();
          host.focus({ preventScroll: true });
          try {
            host.setPointerCapture?.(event.pointerId);
          } catch {}
        });
        host.addEventListener('pointermove', event => {
          if (!live()) return;
          if (tool === 'laser') {
            pointLaser(event, host);
            return;
          }
          if (gesture) {
            if (event.pointerId !== gesture.id) return;
            event.preventDefault();
            if (gesture.kind === 'mark') {
              const p = point(event, host);
              marks[gesture.index] = root.WorkHubAudienceView.moveMark(
                gesture.original,
                p[0] - gesture.start[0],
                p[1] - gesture.start[1]
              );
            } else {
              if (
                Math.hypot(event.clientX - gesture.start[0], event.clientY - gesture.start[1]) <
                  4 &&
                !gesture.moved
              )
                return;
              gesture.moved = true;
              const V = root.WorkHubAudienceView,
                from = V.graphPoint(gesture.start, gesture.rect, gesture.camera),
                to = V.graphPoint([event.clientX, event.clientY], gesture.rect, gesture.camera);
              camera = {
                ...gesture.camera,
                x: gesture.camera.x + from.x - to.x,
                y: gesture.camera.y + from.y - to.y,
              };
            }
            queuePublish();
            return;
          }
          if (!drawing || event.pointerId !== drawing.pointerId) return;
          event.preventDefault();
          const p = point(event, host);
          if (drawing.type === 'arrow') drawing.points = [drawing.points[0], p];
          else if (drawing.points.length < 300) drawing.points.push(p);
          queuePublish();
        });
        const finish = event => {
          if (gesture && event.pointerId === gesture.id) {
            const completed = gesture;
            gesture = null;
            if (
              completed.kind === 'pan' &&
              !completed.moved &&
              completed.node &&
              !held &&
              !cover &&
              !breakSession
            )
              void Promise.resolve(a.command('step', completed.node)).catch(e =>
                a.tell?.(e.message, true)
              );
            publish(true);
          }
          if (drawing && event.pointerId === drawing.pointerId) {
            const mark = drawing;
            drawing = null;
            if (mark.points.length > 1) {
              delete mark.pointerId;
              marks.push(mark);
              if (mark.type === 'arrow') {
                selectMark(marks.length - 1);
                setTool('select');
              }
            }
            publish(true);
          }
          try {
            if (host.hasPointerCapture?.(event.pointerId))
              host.releasePointerCapture(event.pointerId);
          } catch {}
        };
        host.addEventListener('pointerup', finish);
        host.addEventListener('pointerleave', clearLaser);
        for (const name of ['pointercancel', 'lostpointercapture'])
          host.addEventListener(name, event => {
            if (
              (gesture && gesture.id === event.pointerId) ||
              (drawing && drawing.pointerId === event.pointerId)
            ) {
              cancelGesture();
              publish(true);
            }
            clearLaser();
          });
        host.addEventListener(
          'wheel',
          event => {
            if (
              !live() ||
              !event.target.closest('.av-map') ||
              !['move', 'select'].includes(tool) ||
              gesture ||
              drawing
            )
              return;
            event.preventDefault();
            zoomCanvas(Math.exp(Math.max(-0.3, Math.min(0.3, event.deltaY * 0.0015))), event);
          },
          { passive: false }
        );
        host.addEventListener('keydown', event => {
          if (!live()) return;
          if (event.key === 'Escape' && (gesture || drawing)) {
            event.preventDefault();
            event.stopPropagation();
            cancelGesture();
            publish(true);
            return;
          }
          if (tool === 'select' && marks[selectedMark]) {
            if (['Delete', 'Backspace'].includes(event.key)) {
              event.preventDefault();
              marks.splice(selectedMark, 1);
              selectedMark = -1;
              publish(true);
            }
            const d = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            }[event.key];
            if (d) {
              event.preventDefault();
              const n = event.shiftKey ? 10 : 2;
              marks[selectedMark] = root.WorkHubAudienceView.moveMark(
                marks[selectedMark],
                (d[0] * n) / 1000,
                (d[1] * n) / 562.5
              );
              publish(true);
            }
          } else if (
            tool === 'move' &&
            !held &&
            !cover &&
            !breakSession &&
            event.key.startsWith('Arrow') &&
            preview?.camera()
          ) {
            event.preventDefault();
            const c = preview.camera(),
              d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
                event.key
              ];
            if (d) {
              camera = { ...c, x: c.x + d[0] * c.width * 0.08, y: c.y + d[1] * c.height * 0.08 };
              publish(true);
            }
          } else if (['+', '=', '-'].includes(event.key)) {
            event.preventDefault();
            zoomCanvas(event.key === '-' ? 1.2 : 1 / 1.2);
          } else if (
            event.target.closest('[data-node]') &&
            ['Enter', ' '].includes(event.key) &&
            !held &&
            !cover &&
            !breakSession
          ) {
            event.preventDefault();
            void a.command('step', event.target.closest('[data-node]').dataset.node);
            publish(true);
          }
        });
        if (rich) {
          panel.classList.add('pc-presenter');
          for (const b of panel.querySelectorAll(
            '[data-presenter="window"],[data-presenter="fullscreen"],[data-presenter="expand"],[data-presenter="close-panel"]'
          ))
            b.remove();
          const stage = document.createElement('div');
          stage.className = 'pc-stage';
          host.replaceWith(stage);
          stage.append(host);
          canvasUI = root.WorkHubProcessCanvas.install({
            panel,
            host,
            stage,
            canvas: a.canvas,
            live: () => live() && !held && !cover && !breakSession,
            info: a.privateInfo,
            command: a.command,
            camera: () => preview?.camera(),
            setTool,
            publish: () => publish(true),
          });
        }
        infoKey = '';
      }
      if (rich) startPublicStage();
      else openWindow();
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
      if (name === 'screens') {
        const current = panel;
        if ((await a.screens?.discover()) && panel === current && live()) {
          const picker = panel.querySelector('.presentation-screen-picker');
          if (picker)
            picker.outerHTML = a.screens.markup('presenterScreen', 'data-presenter="screens"');
        }
      } else if (name === 'fullscreen') {
        openWindow();
        if (connected()) await fullscreenAudience();
      } else if (name === 'window') openWindow();
      else if (name === 'close-panel') closePanel();
      else if (name === 'end') {
        close();
        return;
      } else if (name === 'tool') {
        cancelGesture();
        setTool(value);
      } else if (name === 'expand') {
        const wide = panel.dataset.expanded !== 'true';
        panel.dataset.expanded = String(wide);
        const b = panel.querySelector('[data-presenter="expand"]');
        b.textContent = wide ? 'Restore controls' : 'Expand canvas';
        b.setAttribute('aria-pressed', String(wide));
      } else if (name === 'fit' || name === 'follow') {
        if (held || cover || breakSession) return;
        camera = null;
        overview = name === 'fit';
        panel.querySelector('[name="overview"]').checked = overview;
      } else if (name === 'zoom-in' || name === 'zoom-out')
        zoomCanvas(name === 'zoom-in' ? 1 / 1.2 : 1.2);
      else if (name === 'delete-mark') {
        if (selectedMark >= 0) marks.splice(selectedMark, 1);
        selectedMark = -1;
      } else if (name === 'update-text') {
        const mark =
          marks[selectedMark]?.type === 'text'
            ? marks[selectedMark]
            : [...marks].reverse().find(m => m.type === 'text');
        const text = panel.querySelector('[name="annotationText"]').value.trim().slice(0, 240);
        if (mark && text) {
          mark.text = text;
          mark.fontSize = textSize;
          mark.color = color;
        } else
          a.tell?.(
            'Place a text note first, then type its replacement and choose Update last text.'
          );
      } else if (name === 'undo') {
        marks.pop();
        selectedMark = -1;
      } else if (name === 'clear') {
        marks = [];
        drawing = null;
        selectedMark = -1;
      } else if (name === 'cover') {
        clearLaser();
        cover = !cover;
      } else if (name === 'hold') {
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
        event.data.type === 'workhub-audience-heartbeat' ||
        event.data.type === 'workhub-presenter-ready' ||
        event.data.type === 'workhub-presenter-heartbeat'
      ) {
        ready = true;
        lastSeen = Date.now();
        if (rich) adoptControls();
        publish(true);
        if (!rich && event.data.type === 'workhub-audience-ready') void fullscreenAudience();
      } else if (event.data.type === 'workhub-audience-fullscreen') {
        audienceFull = event.data.fullscreen === true;
        updateControls();
      } else if (event.data.type === 'workhub-presenter-blur') {
        clearLaser();
      } else if (event.data.type === 'workhub-presenter-closed') {
        close();
      } else if (event.data.type === 'workhub-audience-closed') {
        ready = false;
        notice('Audience window closed. Open it again when ready.');
      }
    });
    root.addEventListener('pagehide', close);
    root.addEventListener('blur', clearLaser);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearLaser();
    });
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
        selectedMark,
        camera: camera ? { ...camera } : null,
        audienceFull,
        canvas: canvasUI?.state() || null,
      }),
    };
  }
  root.WorkHubPresenter = { install };
})(window);
