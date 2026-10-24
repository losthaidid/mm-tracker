/** Animated personal rehearsal UI. Playback is temporary; edits use the existing private document save path. */
(function rehearsalUI(root) {
  'use strict';
  const E = root.WorkHubRehearsalEngine,
    esc = x =>
      String(x ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
  const ICONS = { task: '✓', document: '▤', decision: '◇', approval: '✦', result: '⚑' };
  function install(a) {
    let owner = '',
      processId = '',
      scenarioId = '',
      selected = '',
      editing = false,
      zoom = 1,
      wasVisible = false,
      paused = false,
      raf = 0,
      last = 0,
      elapsed = 0,
      index = 0,
      loops = 0,
      route = null,
      lastModel = '',
      paintKey = '',
      overrides = {},
      drag = null,
      suppressClick = 0;
    let audio = null,
      audioReady = false,
      audioPending = null,
      audioEpoch = 0,
      audioError = '',
      notes = [],
      demo = null,
      editorSnapshot = null,
      reverse = null;
    let draft = null,
      baseFingerprint = '',
      mode = 'normal',
      archived = false,
      routeChoices = {},
      exporting = false,
      exportUrl = '',
      overlay = null,
      viewScroll = null,
      cachedState = null,
      cachedRows = [],
      paletteDrag = null;
    const $ = id => document.getElementById(id),
      prefs = () => a.state().workhub.rehearsal.preferences;
    const guard = expected => {
      if (!a.ready() || !a.owner() || (expected && expected !== a.owner()))
        throw Error('Sign in and reopen your rehearsal.');
    };
    const now = () => new Date().toISOString(),
      uid = () =>
        root.crypto?.randomUUID?.() ||
        'flow-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const button = (action, label, attributes = '', cls = 'small') =>
      `<button type="button" class="${cls}" data-rehearsal="${action}" ${attributes}>${label}</button>`;
    function library() {
      const state = a.state();
      if (cachedState !== state) {
        cachedState = state;
        cachedRows = E.library(state);
      }
      return cachedRows;
    }
    function syncAudio() {
      const button = $('rehearsalSound'),
        status = $('rehearsalAudioStatus');
      if (button) {
        button.textContent = soundLabel();
        button.setAttribute(
          'aria-pressed',
          String(!!prefs().sound && audioReady && audio?.state === 'running')
        );
      }
      if (status) status.textContent = audioMessage();
    }
    function clearAudio() {
      audioEpoch++;
      audioPending = null;
      audioReady = false;
      for (const n of notes) {
        try {
          n.stop();
        } catch {}
      }
      notes = [];
      try {
        audio?.suspend()?.catch(() => {});
      } catch {}
      syncAudio();
    }
    function resetOwner() {
      if (owner === a.owner()) return;
      closeOverlay();
      if ($('processHubExport')) a.closeModal();
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
        exportUrl = '';
      }
      owner = a.owner();
      reverse = null;
      processId = '';
      scenarioId = '';
      selected = '';
      editing = false;
      overrides = {};
      lastModel = '';
      route = null;
      elapsed = 0;
      index = 0;
      loops = 0;
      paused = false;
      draft = null;
      baseFingerprint = '';
      mode = 'normal';
      archived = false;
      routeChoices = {};
      editorSnapshot = null;
      viewScroll = null;
      cachedState = null;
      paletteDrag = null;
      clearAudio();
      try {
        audio?.close()?.catch(() => {});
      } catch {}
      audio = null;
      audioReady = false;
      audioError = '';
      editorSnapshot = null;
      drag = null;
      demo = E.seed('__demo__', now());
    }
    function model() {
      resetOwner();
      if (draft) return draft;
      const rows = library().filter(p => p.archived === archived);
      let p = processId === '__demo__' ? demo : rows.find(p => p.id === processId);
      if (!p) {
        p = rows[0] || demo;
        processId = p.id;
        scenarioId = p.scenarios[0].id;
      }
      if (!p.scenarios.some(s => s.id === scenarioId)) scenarioId = p.scenarios[0].id;
      return p;
    }
    function scenario(p = model()) {
      return p.scenarios.find(s => s.id === scenarioId) || p.scenarios[0];
    }
    function rebuild(keep = false) {
      reverse = null;
      const p = model();
      try {
        route = E.plan(p, scenario(p), overrides, routeChoices);
      } catch (err) {
        route = { entries: [], ending: 'invalid', error: err.message };
        paused = true;
      }
      if (!keep) {
        index = 0;
        elapsed = 0;
      } else index = Math.min(index, Math.max(0, route.entries.length - 1));
      paintKey = '';
    }
    function motionOff() {
      return (
        a.prefs?.().motion === 'off' ||
        root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      );
    }
    function otherDialog() {
      return !!document.querySelector('dialog[open]:not(#processHubOverlay)');
    }
    function blocked() {
      return (
        document.hidden ||
        motionOff() ||
        editing ||
        !!draft ||
        otherDialog() ||
        document.body.matches('.hub-private,.hub-present,.hub-focus')
      );
    }
    function stopFrame() {
      if (raf) root.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      clearAudio();
    }
    // Motion preferences stop animation, while explicitly requested sound remains available.
    function audioBlocked() {
      return (
        !a.ready() ||
        owner !== a.owner() ||
        !$('rehearsalRoot') ||
        document.hidden ||
        editing ||
        !!draft ||
        otherDialog() ||
        document.body.matches('.hub-private,.hub-present,.hub-focus')
      );
    }
    function soundLabel() {
      return prefs().sound && audioPending
        ? 'Enabling sound…'
        : prefs().sound && audioReady && audio?.state === 'running'
          ? 'Mute sound'
          : 'Enable sound';
    }
    function audioMessage() {
      return (
        audioError ||
        (!prefs().sound
          ? 'Sound is off.'
          : prefs().volume === 0
            ? 'Volume is zero. Raise it to hear step sounds.'
            : audioReady && audio?.state === 'running'
              ? 'Sound ready · short tones at each step.'
              : audioPending
                ? 'Waiting for browser audio. Playback controls remain available.'
                : 'Click Enable sound to hear a preview and step sounds.')
      );
    }
    function unlock() {
      if (audioBlocked() || !prefs().sound) return Promise.resolve(false);
      if (audio?.state === 'running') {
        audioReady = true;
        audioError = '';
        syncAudio();
        return Promise.resolve(true);
      }
      if (audioPending) return audioPending.promise;
      const identity = owner,
        epoch = ++audioEpoch;
      try {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) {
          audioError = 'Sound is unavailable in this browser.';
          syncAudio();
          return Promise.resolve(false);
        }
        if (!audio || audio.state === 'closed') {
          const context = (audio = new Audio());
          context.onstatechange = () => {
            if (context !== audio) return;
            audioReady = context.state === 'running' && prefs().sound && !audioBlocked();
            syncAudio();
          };
        }
        const context = audio,
          request = { promise: null };
        audioError = '';
        audioPending = request;
        // Call resume synchronously within the click; a pending browser prompt must not stall controls.
        request.promise = Promise.resolve(context.resume())
          .then(
            () => {
              if (
                context !== audio ||
                epoch !== audioEpoch ||
                identity !== a.owner() ||
                audioBlocked() ||
                !prefs().sound
              ) {
                if (context !== audio || audioBlocked() || !prefs().sound)
                  try {
                    context.suspend()?.catch(() => {});
                  } catch {}
                return false;
              }
              audioReady = context.state === 'running';
              return audioReady;
            },
            () => {
              if (context === audio && epoch === audioEpoch) {
                audioReady = false;
                audioError = 'Sound could not start. Click Enable sound to try again.';
              }
              return false;
            }
          )
          .finally(() => {
            if (audioPending === request) audioPending = null;
            syncAudio();
          });
        syncAudio();
        return request.promise;
      } catch {
        audioPending = null;
        audioReady = false;
        audioError = 'Sound could not start. Click Enable sound to try again.';
        syncAudio();
        return Promise.resolve(false);
      }
    }
    function cue() {
      const identity = owner,
        currentRoute = route,
        at = index;
      void unlock().then(ok => {
        if (ok && identity === a.owner() && currentRoute === route && at === index)
          tone(route?.entries[index]);
      });
    }
    function tone(entry) {
      if (
        !entry ||
        !audioReady ||
        !audio ||
        audio.state !== 'running' ||
        !prefs().sound ||
        audioBlocked() ||
        prefs().volume === 0
      )
        return;
      const frequencies =
        entry.outcome === 'failure'
          ? [174, 146]
          : entry.type === 'approval'
            ? [523, 659, 784]
            : entry.type === 'document'
              ? [330, 440]
              : [392, 523];
      for (let i = 0; i < frequencies.length; i++) {
        const osc = audio.createOscillator(),
          gain = audio.createGain(),
          t = audio.currentTime + i * 0.065;
        osc.type = entry.outcome === 'failure' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frequencies[i], t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(prefs().volume * 0.12, t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.26);
        notes.push(osc);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
          notes = notes.filter(n => n !== osc);
        };
      }
    }
    function positions() {
      return new Map(
        model().steps.map(s => [s.id, drag?.id === s.id ? { ...s, x: drag.x, y: drag.y } : s])
      );
    }
    function edges(p) {
      const map = new Map(p.steps.map(s => [s.id, s]));
      return p.steps
        .flatMap(s =>
          [
            ['success', s.next],
            ...(s.alternatives || []).map(id => ['success', id]),
            ['failure', s.failNext],
          ]
            .filter(([, id]) => id && map.has(id))
            .map(
              ([kind, id]) =>
                `<path class="rehearsal-edge" data-from="${esc(s.id)}" data-to="${esc(id)}" data-kind="${kind}" d="${E.path(s, map.get(id))}" marker-end="url(#rehearsalArrow)"></path>`
            )
        )
        .join('');
    }
    function graph(p) {
      const width = Math.max(850, ...p.steps.map(s => s.x + 270)),
        height = Math.max(440, ...p.steps.map(s => s.y + 180));
      return `<div id="rehearsalViewport" class="rehearsal-viewport" tabindex="0" aria-label="Process canvas. Scroll to explore."><div class="rehearsal-extent" style="width:${width * zoom}px;height:${height * zoom}px"><div id="rehearsalBoard" class="rehearsal-board" style="width:${width}px;height:${height}px;transform:scale(${zoom})"><svg class="rehearsal-wires" width="${width}" height="${height}" aria-hidden="true"><defs><marker id="rehearsalArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"></path></marker></defs>${edges(p)}</svg>${p.steps.map(s => `<article class="rehearsal-node" data-node="${esc(s.id)}" data-type="${s.type}" style="left:${s.x}px;top:${s.y}px">${p.id !== '__demo__' ? `<button type="button" class="rehearsal-drag" data-rehearsal-drag="${esc(s.id)}" aria-label="Move ${esc(s.title)}. Drag or use arrow keys.">⠿</button>` : ''}<button type="button" class="rehearsal-node-main" data-rehearsal="inspect" data-id="${esc(s.id)}"><span class="rehearsal-node-icon">${ICONS[s.type]}</span><span><small>${esc(s.type)}${s.tcode ? ' · ' + esc(s.tcode) : ''}</small><strong>${esc(s.title)}</strong></span></button><span class="rehearsal-node-state" aria-hidden="true"></span><div class="rehearsal-particles" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i style="--particle:${i}"></i>`).join('')}</div></article>`).join('')}<div id="rehearsalToken" class="rehearsal-token" aria-hidden="true"><span>▤</span></div><div class="rehearsal-scene-specks" aria-hidden="true"></div></div></div></div>`;
    }
    function captureDraftFields() {
      const form = $('processHubDetails');
      if (!draft || !form || form.dataset.owner !== a.owner()) return;
      for (const key of ['name', 'notes', ...E.PROCESS_FIELDS])
        draft[key] = form.elements.namedItem(key).value;
    }
    function palette() {
      return `<aside class="ph-palette" aria-label="Step types"><span class="hub-kicker">BUILD YOUR FLOW</span><h3>Step types</h3><p>Drag onto the canvas, or tap to add.</p>${E.TYPES.map(type => button('palette', `<b>${ICONS[type]}</b><span>${type[0].toUpperCase() + type.slice(1)}<small>${{ task: 'An action to perform', document: 'Create or check a record', decision: 'Choose a route', approval: 'Review and authorise', result: 'An outcome or finish' }[type]}</small></span>`, `data-type="${type}" draggable="true" data-step-type="${type}"`, 'ph-step-type')).join('')}<div class="ph-palette-tip"><strong>Make the connection</strong><p>Open a step to set its normal, alternative and exception routes. Move cards by their dotted handles.</p></div></aside>`;
    }
    function processFields(p) {
      const field = (key, label, large = false) =>
        `<label>${label}${large ? `<textarea name="${key}" maxlength="32767" rows="2">${esc(p[key])}</textarea>` : `<input name="${key}" maxlength="${key === 'name' ? 500 : 300}" value="${esc(p[key])}"${key === 'name' ? ' required' : ''}>`}</label>`;
      return `<details class="ph-process-info"><summary>Process information <span>Name, purpose, audience &amp; your notes</span></summary><form id="processHubDetails" data-owner="${esc(owner)}">${field('name', 'Process name *')}${field('processOwner', 'Process owner / lead')}${field('revision', 'Version / revision')}<label>Use this process for<select name="audience">${[
        ['', 'Personal reference & user walkthrough'],
        ['personal', 'My own reference'],
        ['users', 'Explaining to users'],
        ['both', 'Both'],
      ]
        .map(
          ([v, label]) =>
            `<option value="${v}"${p.audience === v ? ' selected' : ''}>${label}</option>`
        )
        .join(
          ''
        )}</select></label>${field('objective', 'Purpose / intended outcome', true)}${field('notes', 'Description & context', true)}${field('presenterNotes', 'Private presenter notes (hidden in presentation)', true)}</form></details>`;
    }
    function render() {
      captureDraftFields();
      const oldForm = $('rehearsalStepForm'),
        view = $('rehearsalViewport');
      if (view) viewScroll = { left: view.scrollLeft, top: view.scrollTop };
      if (editing && oldForm && oldForm.dataset.owner === a.owner()) {
        const clone = oldForm.cloneNode(true);
        for (const field of oldForm.elements) {
          const target = clone.elements.namedItem(field.name);
          if (target && 'value' in target) target.value = field.value;
        }
        editorSnapshot = clone;
      }
      const p = model();
      if (!route) rebuild();
      const rows = library().filter(x => x.archived === archived),
        isPresent = mode === 'present',
        isSaved = p.id !== '__demo__';
      const actions = isPresent
        ? ''
        : draft
          ? button('save-draft', '✓ Save process', '', 'primary') +
            button('discard-draft', 'Discard changes')
          : button('new', '＋ New process', '', 'primary') +
            (isSaved
              ? button('edit-process', 'Edit process') + button('duplicate', 'Duplicate')
              : button('keep', 'Save this example'));
      return `<section id="rehearsalRoot" class="hub rehearsal-workspace process-hub-workspace" data-owner="${esc(owner)}" data-theme="${prefs().theme}" data-effects="${prefs().effects}" data-mode="${mode}" data-draft="${!!draft}"><header class="rehearsal-hero"><div><span class="hub-kicker">${draft ? 'CREATE · CONNECT · EXPLAIN' : 'YOUR LIVING PROCESS LIBRARY'}</span><h2>${draft ? 'Process canvas' : 'Process Hub'}<span class="ph-title-mark" aria-hidden="true">↗</span></h2><p>${draft ? 'Arrange the flow and maintain every detail in one space. Save when you are ready.' : 'From your own reference to a clear walkthrough. Watch each handoff come to life.'}</p></div><div class="actions">${actions}${mode !== 'normal' ? button('normal', '↙ Normal view') : button('fullscreen', '⛶ Full screen')}${!draft && !isPresent ? button('present', '▷ Present') : ''}</div></header><div class="rehearsal-selection"><label>Saved process<select id="rehearsalProcess"${draft ? ' disabled' : ''}>${draft && !rows.some(x => x.id === p.id) ? `<option value="${esc(p.id)}" selected>Unsaved · ${esc(p.name)}</option>` : ''}${rows.map(x => `<option value="${esc(x.id)}"${x.id === p.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__demo__"${p.id === '__demo__' ? ' selected' : ''}>Sample · Procure to pay</option></select></label><label>Scenario<select id="rehearsalScenario">${p.scenarios.map(s => `<option value="${esc(s.id)}"${s.id === scenarioId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>${isSaved && !isPresent ? button('scenario', 'Edit scenario') + button('scenario-add', '＋ Scenario') : ''}<label>View<select id="processHubView"><option value="normal"${mode === 'normal' ? ' selected' : ''}>Normal</option><option value="full"${mode === 'full' ? ' selected' : ''}>Full screen</option><option value="present"${isPresent ? ' selected' : ''}>Presentation</option></select></label><span class="rehearsal-local-label">${draft ? 'Draft · saved only when you choose Save process' : `${p.steps.length} steps · ${p.scenarios.length} scenarios · ${p.revision ? esc(p.revision) + ' · ' : ''}Looping playback`}</span></div>${draft ? processFields(p) : `<div class="ph-library-bar"><div><strong>${esc(p.objective || p.notes || 'Build a process, then explore it at your own pace.')}</strong>${p.processOwner ? `<span>Owner · ${esc(p.processOwner)}</span>` : ''}</div><div class="actions">${!isPresent ? button('archive-view', archived ? 'Show active' : 'Archived processes') : ''}${isSaved && !isPresent ? button('archive', p.archived ? 'Restore process' : 'Archive') + button('export', '↓ Export PDF / Image') : ''}${isSaved && !isPresent ? button('settings', 'Process information') : ''}</div></div>`}<div class="ph-canvas-layout">${draft ? palette() : ''}<div class="rehearsal-layout"><div class="rehearsal-stage"><div class="rehearsal-stage-bar"><div><strong>${esc(p.name)}</strong><span id="rehearsalStatus" aria-live="polite"></span></div><div class="actions">${isSaved && !isPresent ? button('add-step', '＋ Step') + button('layout', 'Auto arrange') : ''}${button('fit', 'Fit')}${button('zoom-out', '−', 'aria-label="Zoom out"')}${button('zoom-in', '＋', 'aria-label="Zoom in"')}<span class="ph-zoom">${Math.round(zoom * 100)}%</span></div></div>${graph(p)}<div class="rehearsal-values"><div class="rehearsal-values-title"><strong>Sample values</strong><span>Changes follow your definitions</span></div><div id="rehearsalValues"></div></div><div class="rehearsal-playbar">${button('back', '↶', 'aria-label="Previous step / rewind"')}${button('play', draft ? 'Preview after saving' : 'Pause', 'id="rehearsalPlay"', 'primary small')}${button('next', '↷', 'aria-label="Next step"')}${button('restart', 'Restart')}<label>Speed<select id="rehearsalSpeed">${[0.5, 1, 1.5, 2].map(v => `<option value="${v}"${v === prefs().speed ? ' selected' : ''}>${v}×</option>`).join('')}</select></label>${button('sound', soundLabel(), 'id="rehearsalSound" aria-pressed="false" aria-describedby="rehearsalAudioStatus"')}<label>Volume<input id="rehearsalVolume" aria-label="Rehearsal volume" type="range" min="0" max="1" step="0.05" value="${prefs().volume}"></label></div><p id="rehearsalAudioStatus" class="hub-meta" role="status">${esc(audioMessage())}</p></div><aside id="rehearsalInspector" class="rehearsal-inspector"></aside></div></div><div class="rehearsal-options"><label>Scenery<select id="rehearsalTheme">${[
        ['desk', 'Cosy desk'],
        ['blueprint', 'Blueprint'],
        ['control', 'Control room'],
      ]
        .map(
          ([v, l]) => `<option value="${v}"${prefs().theme === v ? ' selected' : ''}>${l}</option>`
        )
        .join(
          ''
        )}</select></label><label>Effects<select id="rehearsalEffects">${['quiet', 'balanced', 'expressive'].map(v => `<option${prefs().effects === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label><label class="check-label"><input id="rehearsalExplore" type="checkbox"${prefs().explore ? ' checked' : ''}>Explore scenarios automatically</label><span>Animated playback loops. Editing pauses the scene.</span></div><section class="rehearsal-journal"><div><h3>Playback journal</h3><span id="rehearsalJournalHeading">Current route</span></div><ol id="rehearsalJournal" aria-live="off"></ol></section></section>`;
    }
    function detailHTML(step) {
      if (!step)
        return '<div class="ph-inspector-empty"><span>↖</span><h3>Every step tells a story</h3><p>Select a card to read its details, or add a step type to start building.</p></div>';
      const presenting = mode === 'present',
        p = model(),
        row = (label, value) => (value ? `<dt>${label}</dt><dd>${esc(value)}</dd>` : '');
      const routes = [step.next, ...(step.alternatives || [])].filter(Boolean);
      return `<span class="hub-kicker">${presenting ? 'FOLLOW THE PROCESS' : 'STEP DETAILS'}</span><div class="rehearsal-detail-title"><span>${ICONS[step.type]}</span><h3>${esc(step.title)}</h3></div>${step.tcode ? `<span class="rehearsal-tcode">${esc(step.tcode)}</span>` : ''}<dl>${row('Who handles it', step.owner)}${row('Before you start', step.prerequisites)}${row('What happens', presenting ? step.audienceText || step.instruction : step.instruction)}${row('Inputs', step.inputs)}${row('Expected result', step.expected)}${row('Outputs', step.outputs)}${row('System / tool', step.system)}${row('Typical working time', step.workingTime)}${!presenting ? row('If it fails / common errors', step.failure) + row('Configuration / setup', step.configuration) + row('Testing checklist', step.testing) : ''}</dl>${step.image ? `<a class="rehearsal-image-link" href="${esc(step.image)}" target="_blank" rel="noopener"><img src="${esc(step.image)}" alt="Reference screenshot for ${esc(step.title)}"></a>` : ''}${!presenting && step.link ? `<a href="${esc(step.link)}" target="_blank" rel="noopener noreferrer">Open reference ↗</a>` : ''}${!presenting ? a.recordLinks?.(step) || '' : ''}<div class="rehearsal-branches"><strong>Explore an outcome</strong>${button('success', 'Follow success', `data-id="${esc(step.id)}"`)}${button('failure', 'What if this fails?', `data-id="${esc(step.id)}"`)}${routes.length > 1 ? `<strong>Alternative routes</strong>${routes.map(id => button('route', esc(p.steps.find(s => s.id === id)?.title || id), `data-id="${esc(step.id)}" data-next="${esc(id)}"`)).join('')}` : ''}</div>${p.id !== '__demo__' && !presenting ? button('edit-step', 'Edit this step', `data-id="${esc(step.id)}"`, 'primary small') : ''}`;
    }
    function closeOverlay() {
      if (!overlay) return;
      const element = overlay;
      overlay = null;
      if (document.fullscreenElement && element.contains(document.fullscreenElement))
        try {
          void document.exitFullscreen?.()?.catch(() => {});
        } catch {}
      element.close?.();
      element.remove();
      document.body.classList.remove('process-hub-full-open');
    }
    function placeOverlay() {
      if (mode === 'normal') {
        closeOverlay();
        return;
      }
      const el = document.querySelector('#view #rehearsalRoot') || $('rehearsalRoot');
      if (!el) return;
      if (!overlay) {
        overlay = document.createElement('dialog');
        overlay.id = 'processHubOverlay';
        overlay.setAttribute('aria-label', 'Full-screen Process Hub');
        overlay.innerHTML = '<div class="ph-fullscreen-stage"></div>';
        overlay.addEventListener('cancel', event => {
          event.preventDefault();
          setMode('normal', false);
        });
        document.body.append(overlay);
        overlay.showModal();
      }
      const stage = overlay.firstElementChild;
      if (!stage.contains(el)) stage.replaceChildren(el);
      document.body.classList.add('process-hub-full-open');
    }
    function setMode(value, native = true) {
      if (!['normal', 'full', 'present'].includes(value)) return;
      if (value === 'present' && draft) {
        a.tell('Save your process before presenting it.');
        return;
      }
      mode = value;
      paintKey = '';
      a.render();
      if (value !== 'normal' && native) {
        const stage = overlay?.firstElementChild;
        if (stage?.requestFullscreen && !document.fullscreenElement)
          try {
            void stage.requestFullscreen().catch(() => {});
          } catch {}
      }
      if (value === 'normal') $('rehearsalProcess')?.focus();
    }
    function beginDraft(blank = false, source = null) {
      guard(owner);
      if (draft && !root.confirm('Discard the current process draft?')) return;
      if (editing && !draft && !root.confirm('Discard the unsaved step details?')) return;
      captureDraftFields();
      const p = source ? E.copy(source) : E.normalize(E.seed(uid(), now(), blank));
      baseFingerprint = source
        ? JSON.stringify(E.library(a.state()).find(x => x.id === source.id))
        : '';
      draft = p;
      processId = p.id;
      scenarioId = p.scenarios[0].id;
      routeChoices = {};
      overrides = {};
      route = null;
      editing = false;
      selected = '';
      editorSnapshot = null;
      paused = true;
      if (!source) {
        p.name = 'My new process';
        p.notes = '';
        p.processOwner = '';
      }
      setMode('full');
    }
    function saveDraft() {
      guard(owner);
      const stepForm = $('rehearsalStepForm');
      if (editing && stepForm) saveForm(stepForm);
      captureDraftFields();
      if (!draft) return;
      const candidate = E.copy(draft);
      candidate.name = candidate.name.trim();
      if (!candidate.name) throw Error('Enter a process name.');
      candidate.updatedAt = now();
      const current = E.library(a.state()).find(p => p.id === candidate.id);
      if (baseFingerprint && (!current || JSON.stringify(current) !== baseFingerprint))
        throw Error(
          'This process changed on another save. Discard this draft and reopen the saved process before editing.'
        );
      const snapshot = E.copy(a.state());
      E.store(snapshot, candidate);
      E.validate(snapshot);
      // Clear the draft for the synchronous render, restoring it if persistence fails.
      const held = draft;
      draft = null;
      editing = false;
      editorSnapshot = null;
      route = null;
      lastModel = '';
      paused = false;
      try {
        if (!a.mutate(d => E.store(d, candidate))) {
          draft = held;
          paused = true;
          a.render();
          return;
        }
      } catch (err) {
        draft = held;
        paused = true;
        a.render();
        throw err;
      }
      baseFingerprint = '';
      a.tell('Process saved. Animated playback is looping.');
    }
    function discardDraft() {
      if (!draft || !root.confirm('Discard your unsaved process changes?')) return;
      draft = null;
      editing = false;
      editorSnapshot = null;
      baseFingerprint = '';
      processId = '';
      route = null;
      lastModel = '';
      paused = false;
      setMode('normal', false);
    }
    function addStep(type = 'task', position = null) {
      if (editing && $('rehearsalStepForm')) saveForm($('rehearsalStepForm'));
      const p = model();
      if (!saved(p)) throw Error('Save the example or create a process before adding steps.');
      const base = E.seed('temporary', now(), true).steps[0],
        s = {
          ...base,
          ...Object.fromEntries(E.STEP_FIELDS.map(k => [k, ''])),
          id: uid(),
          type,
          title: 'New ' + type,
          next: '',
          alternatives: [],
          x: position?.x ?? 60,
          y: position?.y ?? Math.min(4000, 80 + p.steps.length * 120),
        };
      if (p.steps.length >= (p.hubId ? 200 : 80))
        throw Error('This process has reached its step limit.');
      editing = false;
      editorSnapshot = null;
      saveMutation(row => {
        row.steps.push(s);
        if (!row.startId) row.startId = s.id;
      });
      stepEditor(s.id);
    }
    function dropStep(type, event) {
      if (!draft || !E.TYPES.includes(type)) return;
      const board = $('rehearsalBoard');
      if (!board) return;
      const r = board.getBoundingClientRect();
      addStep(type, {
        x: Math.max(0, Math.min(4000, (event.clientX - r.left) / zoom - 105)),
        y: Math.max(0, Math.min(4000, (event.clientY - r.top) / zoom - 50)),
      });
    }
    function fit() {
      const view = $('rehearsalViewport'),
        p = model();
      if (!view) return;
      const width = Math.max(850, ...p.steps.map(s => s.x + 270)),
        height = Math.max(440, ...p.steps.map(s => s.y + 180));
      zoom = Math.max(
        0.2,
        Math.min(1.5, (view.clientWidth || 850) / width, (view.clientHeight || 440) / height)
      );
      viewScroll = { left: 0, top: 0 };
      a.render();
      $('rehearsalViewport')?.scrollTo?.({ left: 0, top: 0 });
    }
    function exportDialog() {
      guard(owner);
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
        exportUrl = '';
      }
      if (draft) throw Error('Save the process before exporting.');
      a.openModal(
        'Export process',
        `<form id="processHubExport" data-owner="${esc(owner)}"><p>Export <strong>${esc(model().name)}</strong>.</p><label>File format<select name="format"><option value="pdf">PDF · diagram and step-by-step guide</option><option value="png">PNG image · complete process diagram</option><option value="pdf-zip">PDF in ZIP · alternative download</option></select></label><label>PDF detail level<select name="scope"><option value="audience">User handout · explanations and outcomes</option><option value="reference">Full reference · technical details and scenarios</option></select></label><p class="hub-meta">Private presenter notes are included only in Full reference. Images contain the diagram, step titles and routes. Large diagrams are scaled to fit.</p><div class="modal-actions"><button type="button" data-hub="close">Cancel</button><button type="submit" class="primary">Prepare file</button><span id="processHubExportReady"></span></div><p id="processHubExportStatus" role="status"></p></form>`
      );
    }
    async function exportProcess(form) {
      guard(form.dataset.owner);
      if (exporting) return;
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
        exportUrl = '';
      }
      $('processHubExportReady').replaceChildren();
      const identity = owner,
        p = E.copy(model()),
        kind = form.elements.namedItem('format').value,
        scope = form.elements.namedItem('scope').value;
      if (draft || p.id === '__demo__') throw Error('Save your process before exporting.');
      const alive = () =>
        a.ready() && identity === a.owner() && form.isConnected && form.closest('dialog')?.open;
      const submit = form.querySelector('[type="submit"]');
      exporting = true;
      submit.disabled = true;
      for (const field of form.querySelectorAll('select')) field.disabled = true;
      $('processHubExportStatus').textContent = 'Preparing your download…';
      try {
        const file = await root.WorkHubProcessFiles.export(p, {
          format: kind,
          scope,
          state: E.copy(a.state()),
          alive,
        });
        if (!alive()) return;
        const filename =
          (p.name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 70) || 'Process') +
          '-process.' +
          (kind === 'pdf-zip' ? 'zip' : kind);
        exportUrl = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = exportUrl;
        link.download = filename;
        link.className = 'ph-download-link';
        link.textContent =
          kind === 'pdf'
            ? 'Download PDF'
            : kind === 'pdf-zip'
              ? 'Download PDF ZIP'
              : 'Download PNG';
        $('processHubExportReady').replaceChildren(link);
        $('processHubExportStatus').textContent =
          'Your file is ready. Select ' + link.textContent + ' to save it.';
        submit.textContent = 'Prepare again';
      } finally {
        exporting = false;
        if (submit.isConnected) {
          submit.disabled = false;
          for (const field of form.querySelectorAll('select')) field.disabled = false;
          const status = $('processHubExportStatus');
          if (status && !$('processHubExportReady').children.length) status.textContent = '';
        }
      }
    }
    function inspect(id) {
      reverse = null;
      const p = model();
      selected = id;
      paused = true;
      elapsed = 0;
      const at = route.entries.findIndex(e => e.id === id);
      if (at >= 0) index = at;
      if (!editing) $('rehearsalInspector').innerHTML = detailHTML(p.steps.find(s => s.id === id));
      paintKey = '';
      paint();
    }
    function camera(step) {
      const view = $('rehearsalViewport');
      if (
        !view ||
        motionOff() ||
        prefs().effects === 'quiet' ||
        typeof view.scrollTo !== 'function'
      )
        return;
      view.scrollTo({
        left: Math.max(0, step.x * zoom - view.clientWidth / 2 + 105 * zoom),
        top: Math.max(0, step.y * zoom - view.clientHeight / 2 + 50 * zoom),
        behavior: 'smooth',
      });
    }
    function paint(playSound = true) {
      const rootEl = $('rehearsalRoot');
      if (!rootEl || !route) return;
      if (reverse && motionOff()) {
        index = reverse.target;
        reverse = null;
        elapsed = 0;
        paintKey = '';
      }
      const p = model(),
        entry = route.entries[index],
        display = entry || route.entries.at(-1),
        duration = entry ? entry.duration * 1000 : 3200,
        phase = entry ? Math.min(1, elapsed / duration) : 1,
        key = index + '|' + (entry ? phase >= 0.55 : 'end');
      rootEl.dataset.playing = String((!paused || !!reverse) && !blocked());
      rootEl.dataset.direction = reverse ? 'reverse' : 'forward';
      rootEl.dataset.reduced = String(motionOff());
      const play = $('rehearsalPlay');
      if (play) play.textContent = reverse ? 'Pause' : paused || motionOff() ? 'Play' : 'Pause';
      if (key !== paintKey) {
        const moved = paintKey.split('|')[0] !== String(index);
        paintKey = key;
        for (const el of rootEl.querySelectorAll('[data-node]')) {
          const id = el.dataset.node,
            seen = route.entries.slice(0, index).some(e => e.id === id),
            active = entry?.id === id;
          el.dataset.state = active
            ? entry.outcome === 'failure'
              ? 'failed'
              : 'active'
            : seen
              ? 'done'
              : 'waiting';
          el.querySelector('.rehearsal-node-state').textContent =
            active && phase >= 0.55
              ? entry.outcome === 'failure'
                ? 'EXCEPTION'
                : el.dataset.type === 'approval'
                  ? 'APPROVED'
                  : '✓'
              : '';
        }
        for (const edge of rootEl.querySelectorAll('.rehearsal-edge'))
          edge.dataset.active = String(
            !!entry &&
              edge.dataset.from === entry.id &&
              edge.dataset.to === entry.nextId &&
              edge.dataset.kind === entry.outcome
          );
        const values = display
          ? entry && phase < 0.55
            ? display.before
            : display.values
          : scenario(p).initial;
        $('rehearsalValues').innerHTML =
          Object.entries(values)
            .map(
              ([k, v]) =>
                `<div class="${phase >= 0.55 && display?.changes.some(c => c.field === k) ? 'is-changing' : ''}"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`
            )
            .join('') || '<p>Add sample fields in your scenario.</p>';
        $('rehearsalStatus').textContent = draft
          ? 'Editing · Save process to start looping playback'
          : motionOff()
            ? 'Reduced motion · use Next to step through'
            : route.error ||
              (!entry
                ? `${route.ending === 'loop-guard' ? 'Defined loop limit reached' : route.ending === 'failed' ? 'Exception route ended' : 'Route complete'} · restarting…`
                : `${index + 1}/${route.entries.length} · ${entry.outcome === 'failure' ? 'Exception' : 'Running'} · ${scenario(p).name}`);
        const reached = route.entries.slice(0, Math.min(index + 1, route.entries.length));
        $('rehearsalJournal').innerHTML = reached
          .map(
            (e, i) =>
              `<li data-outcome="${e.outcome}"${i === index ? ' aria-current="step"' : ''}>${button('journal', `<span>${i + 1}</span><strong>${esc(e.title)}</strong><small>${e.outcome === 'failure' ? 'Exception' : e.nextId ? 'Handoff' : 'Result'}</small>`, `data-index="${i}"`)}</li>`
          )
          .join('');
        $('rehearsalJournalHeading').textContent = scenario(p).name + ' · loop ' + (loops + 1);
        if (!editing && display) {
          const detailId = paused && selected ? selected : display.id;
          selected = detailId;
          $('rehearsalInspector').innerHTML = detailHTML(p.steps.find(s => s.id === detailId));
        }
        if (moved && entry) {
          const step = p.steps.find(s => s.id === entry.id);
          if (step && !paused && !blocked()) camera(step);
          if (!paused && playSound) tone(entry);
        }
      }
      if (reverse) {
        const prev = p.steps.find(s => s.id === route.entries[reverse.target]?.id),
          current = p.steps.find(s => s.id === route.entries[reverse.source]?.id),
          token = $('rehearsalToken');
        if (prev && current && token) {
          const point = E.point(prev, current, 1 - Math.min(1, reverse.elapsed / 850));
          token.hidden = false;
          token.style.left = point.x + 'px';
          token.style.top = point.y + 'px';
          token.dataset.type = prev.type;
          token.dataset.outcome = 'success';
          $('rehearsalStatus').textContent = 'Rewinding · ' + prev.title;
          for (const edge of rootEl.querySelectorAll('.rehearsal-edge'))
            edge.dataset.active = String(
              edge.dataset.from === prev.id && edge.dataset.to === current.id
            );
        }
        return;
      }
      const token = $('rehearsalToken'),
        from = entry && p.steps.find(s => s.id === entry.id),
        to = entry && p.steps.find(s => s.id === entry.nextId);
      if (token) {
        token.hidden = !entry || !from || !to || phase < 0.5 || motionOff();
        if (!token.hidden) {
          const point = E.point(from, to, Math.min(1, (phase - 0.5) * 2));
          token.style.left = point.x + 'px';
          token.style.top = point.y + 'px';
          token.dataset.type = entry.type;
          token.dataset.outcome = entry.outcome;
        }
      }
    }
    function tick(t) {
      raf = 0;
      if (!$('rehearsalRoot') || !a.ready() || owner !== a.owner()) {
        stopFrame();
        return;
      }
      if (!last) last = t;
      const dt = Math.min(150, Math.max(0, t - last));
      last = t;
      if (reverse && !blocked()) {
        reverse.elapsed += dt * prefs().speed;
        if (reverse.elapsed >= 850) {
          index = reverse.target;
          reverse = null;
          elapsed = 0;
          selected = '';
          paintKey = '';
          cue();
        }
      } else if (!paused && !blocked() && route?.entries.length) {
        elapsed += dt * prefs().speed;
        const entry = route.entries[index],
          duration = entry ? entry.duration * 1000 : 3200;
        if (elapsed >= duration) {
          elapsed = 0;
          index++;
          if (index > route.entries.length) {
            loops++;
            if (prefs().explore) {
              const p = model(),
                n = p.scenarios.findIndex(s => s.id === scenarioId);
              scenarioId = p.scenarios[(n + 1) % p.scenarios.length].id;
              overrides = {};
              routeChoices = {};
            }
            rebuild();
          }
        }
      }
      paint();
      raf = root.requestAnimationFrame(tick);
    }
    function mount() {
      resetOwner();
      if (a.active && !a.active()) {
        closeOverlay();
        wasVisible = false;
        stopFrame();
        return;
      }
      const field = document.querySelector(
        '#rehearsalStepForm,#rehearsalProcessForm,#rehearsalScenarioForm,#rehearsalNewForm,#processHubExport'
      );
      if (field && (!a.ready() || field.dataset.owner !== a.owner())) {
        a.closeModal();
        editing = false;
      }
      resetOwner();
      const el = $('rehearsalRoot');
      if (!el || !a.ready()) {
        if (!a.ready() && exportUrl) {
          URL.revokeObjectURL(exportUrl);
          exportUrl = '';
        }
        closeOverlay();
        wasVisible = false;
        stopFrame();
        return;
      }
      if (el.dataset.owner !== a.owner()) {
        stopFrame();
        return;
      }
      placeOverlay();
      const p = model(),
        key = owner + '|' + JSON.stringify(p) + '|' + scenarioId;
      if (!wasVisible) {
        paused = !!draft;
        elapsed = 0;
        index = 0;
      }
      if (key !== lastModel || !wasVisible) {
        lastModel = key;
        rebuild();
      }
      wasVisible = true;
      if (editing && editorSnapshot && editorSnapshot.dataset.owner === owner) {
        $('rehearsalInspector').replaceChildren(editorSnapshot);
        editorSnapshot = null;
      }
      paintKey = '';
      paint();
      syncAudio();
      if (viewScroll) {
        const view = $('rehearsalViewport');
        view.scrollLeft = viewScroll.left;
        view.scrollTop = viewScroll.top;
        viewScroll = null;
      }
      if (!raf) raf = root.requestAnimationFrame(tick);
    }
    function saved(p) {
      return p.id !== '__demo__';
    }
    function saveMutation(fn) {
      guard(owner);
      captureDraftFields();
      if (draft) {
        const next = E.copy(draft);
        fn(next, a.state());
        next.updatedAt = now();
        const probe = E.copy(a.state());
        E.store(probe, { ...next, name: next.name.trim() || 'Untitled process' });
        E.validate(probe);
        draft = next;
        route = null;
        a.render();
        return true;
      }
      return a.mutate(d => {
        const p = E.library(d).find(p => p.id === processId);
        if (!p) throw Error('Save the example before editing.');
        fn(p, d);
        p.updatedAt = now();
        E.store(d, p);
      });
    }
    function saveCopy(blank = false, name = '') {
      guard(owner);
      const p = blank ? E.seed(uid(), now(), true) : E.copy(model());
      delete p.hubId;
      p.id = uid();
      p.archived = false;
      p.name = name || p.name + ' · copy';
      p.createdAt = now();
      p.updatedAt = now();
      processId = p.id;
      scenarioId = p.scenarios[0].id;
      overrides = {};
      route = null;
      lastModel = '';
      paused = false;
      const ok = a.mutate(d => d.workhub.rehearsal.processes.push(p));
      if (ok) {
        a.closeModal();
        a.tell('Process saved.');
      }
      return ok;
    }
    function processEditor() {
      const p = model();
      guard(owner);
      if (!saved(p)) throw Error('Save the example first.');
      a.openModal(
        'Process settings',
        `<form id="rehearsalProcessForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-updated="${esc(p.updatedAt)}"><label>Process name<input name="name" required maxlength="300" value="${esc(p.name)}"></label><label>Description / context<textarea name="notes" maxlength="32767">${esc(p.notes)}</textarea></label>${E.PROCESS_FIELDS.map(k => `<label>${{ objective: 'Purpose / intended outcome', audience: 'Audience / use', processOwner: 'Process owner', revision: 'Version / revision', presenterNotes: 'Private presenter notes' }[k]}<textarea name="${k}" maxlength="32767">${esc(p[k])}</textarea></label>`).join('')}<label>Starting step<select name="startId">${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === p.startId ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><div class="modal-actions">${button('delete-process', 'Delete process', '', 'danger small')}<button class="primary" type="submit">Save process</button></div></form>`
      );
    }
    function scenarioEditor(id = scenarioId) {
      const p = model(),
        s = p.scenarios.find(s => s.id === id);
      guard(owner);
      if (!saved(p) || !s) throw Error('Save the example first.');
      a.openModal(
        'Scenario settings',
        `<form id="rehearsalScenarioForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-id="${esc(s.id)}" data-updated="${esc(p.updatedAt)}"><label>Scenario name<input name="name" required maxlength="200" value="${esc(s.name)}"></label><label>Notes<textarea name="notes" maxlength="32767">${esc(s.notes)}</textarea></label><label>Initial sample values<textarea name="initial" rows="7">${esc(
          Object.entries(s.initial)
            .map(([k, v]) => k + ' = ' + v)
            .join('\n')
        )}</textarea></label><p class="hub-meta">One field = value per line. Numbers remain numeric; other values are text.</p><fieldset><legend>Automatic outcome at each step</legend>${p.steps
          .map(
            step =>
              `<label>${esc(step.title)}<select name="outcome-${esc(step.id)}"><option value="success">Success / normal path</option><option value="failure"${s.choices[step.id] === 'failure' ? ' selected' : ''}>Failure / exception path</option></select></label>${
                step.alternatives?.length
                  ? `<label>Normal route from ${esc(step.title)}<select name="route-${esc(step.id)}">${[
                      step.next,
                      ...step.alternatives,
                    ]
                      .filter(Boolean)
                      .map(
                        id =>
                          `<option value="${esc(id)}"${(s.routes?.[step.id] || step.next) === id ? ' selected' : ''}>${esc(p.steps.find(x => x.id === id)?.title)}</option>`
                      )
                      .join('')}</select></label>`
                  : ''
              }`
          )
          .join(
            ''
          )}</fieldset><div class="modal-actions">${p.scenarios.length > 1 ? button('scenario-delete', 'Delete scenario', '', 'danger small') : ''}<button class="primary" type="submit">Save scenario</button></div></form>`
      );
    }
    function checkForm(form) {
      guard(form.dataset.owner);
      const p =
        draft?.id === form.dataset.process
          ? draft
          : E.library(a.state()).find(p => p.id === form.dataset.process);
      if (!p || p.id !== processId || p.updatedAt !== form.dataset.updated)
        throw Error('This process changed. Reopen the editor before saving.');
      return p;
    }
    function stepEditor(id) {
      const p = model(),
        step = p.steps.find(s => s.id === id);
      guard(owner);
      if (!saved(p) || !step) throw Error('Step no longer exists.');
      reverse = null;
      paused = true;
      editing = true;
      selected = id;
      const field = (k, label, type = 'text', max = 32767) =>
        `<label>${label}${type === 'textarea' ? `<textarea name="${k}" maxlength="${max}">${esc(step[k])}</textarea>` : `<input name="${k}" maxlength="${max}" value="${esc(step[k])}"${k === 'title' ? ' required' : ''}${k === 'tcode' ? ' list="rehearsalTcodes"' : ''}>`}</label>`;
      $('rehearsalInspector').innerHTML =
        `<form id="rehearsalStepForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-id="${esc(id)}" data-updated="${esc(p.updatedAt)}"><span class="hub-kicker">EDIT STEP · PLAYBACK PAUSED</span>${field('title', 'Step title', 'text', 500)}<label>Step type<select name="type">${E.TYPES.map(t => `<option${t === step.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>${field('tcode', 'Transaction / reference codes', 'text', 32767)}<datalist id="rehearsalTcodes">${a
          .state()
          .workhub.tcodes.records.filter(r => !r.archived)
          .map(r => `<option value="${esc(r.code)}">${esc(r.title)}</option>`)
          .join(
            ''
          )}</datalist>${field('owner', 'Who handles it', 'text', 200)}${field('prerequisites', 'Before you start', 'textarea')}${field('instruction', 'Instructions', 'textarea')}${field('expected', 'Expected result', 'textarea')}${field('failure', 'If it fails / common errors & solutions', 'textarea')}${field('inputs', 'Inputs / required information', 'textarea')}${field('outputs', 'Outputs / deliverables', 'textarea')}${field('system', 'System / tool', 'text', 300)}${field('workingTime', 'Typical working time (separate from playback)', 'text', 300)}${field('audienceText', 'Explanation to show users (optional)', 'textarea')}${field('configuration', 'Configuration / setup notes', 'textarea')}${field('testing', 'Testing / verification checklist', 'textarea')}<label>Normal next step<select name="next"><option value="">End route</option>${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === step.next ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><fieldset><legend>Additional normal routes</legend>${p.steps
          .filter(s => s.id !== id)
          .map(
            s =>
              `<label class="check-label"><input type="checkbox" name="alternatives" value="${esc(s.id)}"${step.alternatives?.includes(s.id) ? ' checked' : ''}>${esc(s.title)}</label>`
          )
          .join(
            ''
          )}</fieldset><label>Failure / exception next step<select name="failNext"><option value="">Stop at the exception</option>${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === step.failNext ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><label class="check-label"><input name="isStart" type="checkbox"${p.startId === id ? ' checked' : ''}>Start this process here</label>${[
          ['projectId', 'Related project', a.state().projects || [], 'name'],
          ['ticketId', 'Related ticket', a.state().tickets || [], 'ticket'],
          ['itemId', 'Related project item', a.state().specs || [], 'description'],
          ['noteId', 'Knowledge note', a.state().workhub.notes || [], 'title'],
        ]
          .map(
            ([key, label, rows, title]) =>
              `<label>${label}<select name="${key}"><option value="">None</option>${rows.map(row => `<option value="${esc(row.id)}"${step[key] === row.id ? ' selected' : ''}>${esc(row[title])}</option>`).join('')}${step[key] && !rows.some(row => row.id === step[key]) ? `<option value="${esc(step[key])}" selected>Saved reference (unavailable)</option>` : ''}</select></label>`
          )
          .join(
            ''
          )}<label>Sample value changes<textarea name="changes" placeholder="Received quantity += @Delivery quantity">${esc(step.changes.map(c => c.field + (c.operator === 'add' ? ' += ' : ' = ') + c.value).join('\n'))}</textarea></label><p class="hub-meta">Use = to set a value; += to add a number. @Field reads another sample field. No code is executed.</p><label>Seconds on this step (0 = automatic)<input name="duration" type="number" min="0" max="30" step="0.5" value="${step.duration}"></label>${field('link', 'Reference URL', 'text', 2000)}<label>Reference screenshot<input id="rehearsalImageInput" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="hub-meta">Optimized screenshot saved with the process. Up to 2 MB of screenshots across your rehearsals.</p><input name="image" type="hidden" value="${esc(step.image)}"><div id="rehearsalImagePreview">${step.image ? `<img src="${esc(step.image)}" alt="Step screenshot">` : ''}</div>${button('remove-image', 'Remove screenshot')}<div class="actions"><button type="submit" class="primary">Save step</button>${button('cancel-edit', 'Cancel')}</div>${p.steps.length > 1 ? button('delete-step', 'Delete step', `data-id="${esc(id)}"`, 'danger small') : ''}</form>`;
      $('rehearsalInspector').querySelector('[name="title"]').focus();
      clearAudio();
    }
    function saveForm(form) {
      const value = k => form.elements.namedItem(k).value;
      if (form.id === 'rehearsalNewForm') {
        guard(form.dataset.owner);
        saveCopy(value('template') === 'blank', value('name').trim());
        return;
      }
      const p = checkForm(form);
      if (form.id === 'rehearsalProcessForm') {
        const name = value('name').trim();
        if (!name) throw Error('Enter the process name.');
        saveMutation(row => {
          row.name = name;
          row.notes = value('notes');
          row.startId = value('startId');
          for (const k of E.PROCESS_FIELDS) row[k] = value(k);
        });
        a.closeModal();
      } else if (form.id === 'rehearsalScenarioForm') {
        const name = value('name').trim(),
          initial = E.values(value('initial')),
          choices = {},
          routes = {};
        if (!name) throw Error('Enter a scenario name.');
        for (const step of p.steps)
          if (value('outcome-' + step.id) === 'failure') choices[step.id] = 'failure';
        for (const step of p.steps)
          if (step.alternatives?.length) routes[step.id] = value('route-' + step.id);
        const changed = {
          id: form.dataset.id,
          name,
          notes: value('notes'),
          initial,
          choices,
          routes,
        };
        saveMutation(row => {
          const i = row.scenarios.findIndex(s => s.id === changed.id);
          if (i < 0) throw Error('Scenario no longer exists.');
          row.scenarios[i] = changed;
        });
        a.closeModal();
        overrides = {};
        rebuild();
        paint();
      } else {
        const id = form.dataset.id,
          old = p.steps.find(s => s.id === id);
        if (!old) throw Error('Step no longer exists.');
        const step = {
          ...old,
          title: value('title').trim(),
          type: value('type'),
          tcode: value('tcode').trim().toUpperCase(),
          owner: value('owner').trim(),
          prerequisites: value('prerequisites'),
          instruction: value('instruction'),
          expected: value('expected'),
          failure: value('failure'),
          next: value('next'),
          failNext: value('failNext'),
          changes: E.changes(value('changes')),
          duration: Number(value('duration')),
          link: value('link').trim(),
          image: value('image'),
          alternatives: [...form.querySelectorAll('[name="alternatives"]:checked')]
            .map(el => el.value)
            .filter(id => id !== value('next')),
          ...Object.fromEntries(E.STEP_FIELDS.map(k => [k, value(k)])),
        };
        editing = false;
        editorSnapshot = null;
        paused = false;
        try {
          saveMutation(row => {
            row.steps[row.steps.findIndex(s => s.id === id)] = step;
            if (form.elements.namedItem('isStart').checked) row.startId = id;
            for (const scenario of row.scenarios)
              if (
                scenario.routes?.[id] &&
                ![step.next, ...step.alternatives].includes(scenario.routes[id])
              )
                delete scenario.routes[id];
          });
        } catch (err) {
          editing = true;
          paused = true;
          throw err;
        }
      }
      a.tell(
        draft
          ? 'Step saved in this draft. Choose Save process to keep all changes.'
          : 'Process updated.'
      );
    }
    async function upload(file, form) {
      guard(form.dataset.owner);
      if (!file) return;
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw Error('Choose a PNG, JPEG or WebP screenshot up to 5 MB.');
      const identity = a.owner(),
        input = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(Error('Screenshot could not be read.'));
          r.readAsDataURL(file);
        });
      const image = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(Error('Screenshot could not be opened.'));
        i.src = input;
      });
      if (!form.isConnected || a.owner() !== identity || form.dataset.owner !== identity) return;
      const canvas = document.createElement('canvas'),
        scale = Math.min(1, 1000 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('This browser could not optimize the screenshot.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let encoded = canvas.toDataURL('image/jpeg', 0.75);
      if (encoded.length > 180000) encoded = canvas.toDataURL('image/jpeg', 0.5);
      if (encoded.length > 180000) throw Error('Crop or reduce the screenshot before uploading.');
      if (!form.isConnected || a.owner() !== identity) return;
      form.elements.namedItem('image').value = encoded;
      $('rehearsalImagePreview').innerHTML = `<img src="${encoded}" alt="Step screenshot">`;
    }
    function setPreference(key, value) {
      guard(owner);
      a.mutate(d => {
        d.workhub.rehearsal.preferences[key] = value;
      });
      if (key === 'sound' && !value) clearAudio();
    }
    function moveStep(id, x, y) {
      paused = true;
      saveMutation(p => {
        const s = p.steps.find(s => s.id === id);
        if (!s) throw Error('Step no longer exists.');
        s.x = Math.max(0, Math.min(4000, x));
        s.y = Math.max(0, Math.min(4000, y));
      });
    }
    async function handle(el) {
      guard(owner);
      const action = el.dataset.rehearsal,
        id = el.dataset.id,
        p = model();
      if (action === 'sound') {
        if (prefs().sound && (audioPending || (audioReady && audio?.state === 'running'))) {
          setPreference('sound', false);
          audioError = '';
          syncAudio();
        } else {
          if (!prefs().sound) setPreference('sound', true);
          cue();
        }
        return;
      }
      void unlock();
      if (action === 'new') {
        beginDraft(true);
        return;
      }
      if (action === 'edit-process') {
        beginDraft(false, p);
        return;
      }
      if (action === 'save-draft') {
        saveDraft();
        return;
      }
      if (action === 'discard-draft') {
        discardDraft();
        return;
      }
      if (action === 'fullscreen' || action === 'present' || action === 'normal') {
        setMode(action === 'fullscreen' ? 'full' : action === 'present' ? 'present' : 'normal');
        return;
      }
      if (action === 'fit') {
        fit();
        return;
      }
      if (action === 'palette') {
        if (Date.now() < suppressClick) return;
        addStep(el.dataset.type);
        return;
      }
      if (action === 'archive-view') {
        archived = !archived;
        processId = '';
        scenarioId = '';
        route = null;
        lastModel = '';
        overrides = {};
        routeChoices = {};
        a.render();
        return;
      }
      if (action === 'archive') {
        saveMutation(row => {
          row.archived = !row.archived;
        });
        processId = '';
        route = null;
        a.render();
        return;
      }
      if (action === 'export') {
        exportDialog();
        return;
      }
      if (
        editing &&
        [
          'inspect',
          'journal',
          'scenario',
          'scenario-add',
          'add-step',
          'layout',
          'settings',
          'restart',
          'route',
          'success',
          'failure',
        ].includes(action)
      ) {
        a.tell('Save or cancel the step editor first.');
        return;
      }
      if (action === 'keep' || action === 'duplicate') {
        saveCopy(false, action === 'keep' ? 'My procure-to-pay rehearsal' : '');
        return;
      }
      if (action === 'settings') {
        processEditor();
        return;
      }
      if (action === 'scenario') {
        scenarioEditor();
        return;
      }
      if (action === 'scenario-add') {
        const s = E.copy(scenario(p));
        s.id = uid();
        s.name += ' · variation';
        saveMutation(row => row.scenarios.push(s));
        scenarioId = s.id;
        scenarioEditor(s.id);
        return;
      }
      if (action === 'scenario-delete') {
        if (p.scenarios.length > 1 && root.confirm('Delete this scenario?')) {
          const old = scenarioId;
          scenarioId = p.scenarios.find(s => s.id !== old).id;
          saveMutation(row => {
            row.scenarios = row.scenarios.filter(s => s.id !== old);
          });
          a.closeModal();
        }
        return;
      }
      if (action === 'delete-process') {
        if (root.confirm('Delete this saved process and its screenshots?')) {
          processId = '';
          route = null;
          editing = false;
          paused = false;
          a.mutate(d => E.remove(d, p));
          a.closeModal();
        }
        return;
      }
      if (action === 'add-step') {
        addStep();
        return;
      }
      if (action === 'layout') {
        saveMutation(row => E.layout(row));
        return;
      }
      if (action === 'edit-step') {
        stepEditor(id);
        return;
      }
      if (action === 'delete-step') {
        if (p.steps.length > 1 && root.confirm('Delete this step and remove its connections?')) {
          editing = false;
          editorSnapshot = null;
          saveMutation(row => {
            row.steps = row.steps.filter(s => s.id !== id);
            if (row.startId === id) row.startId = row.steps[0].id;
            for (const s of row.steps) {
              if (s.next === id) s.next = '';
              if (s.failNext === id) s.failNext = '';
              s.alternatives = s.alternatives.filter(x => x !== id);
            }
            for (const scenario of row.scenarios) {
              delete scenario.choices[id];
              for (const [from, to] of Object.entries(scenario.routes || {}))
                if (from === id || to === id) delete scenario.routes[from];
            }
          });
        }
        return;
      }
      if (action === 'remove-image') {
        $('rehearsalStepForm').elements.namedItem('image').value = '';
        $('rehearsalImagePreview').innerHTML = '';
        return;
      }
      if (action === 'cancel-edit') {
        editing = false;
        editorSnapshot = null;
        paused = true;
        $('rehearsalInspector').innerHTML = detailHTML(p.steps.find(s => s.id === selected));
        return;
      }
      if (action === 'inspect') {
        if (Date.now() < suppressClick) return;
        inspect(id);
        return;
      }
      if (action === 'route') {
        if (!route.entries.some(entry => entry.id === id)) {
          a.tell('Choose a scenario that reaches this step first.');
          return;
        }
        routeChoices[id] = el.dataset.next;
        overrides[id] = 'success';
        rebuild();
        paused = false;
        paintKey = '';
        paint(false);
        cue();
        return;
      }
      if (action === 'success' || action === 'failure') {
        if (!route.entries.some(entry => entry.id === id)) {
          a.tell('This step is outside the current route. Choose a scenario that reaches it.');
          return;
        }
        overrides[id] = action;
        const at = index;
        rebuild();
        index = Math.min(at, route.entries.length - 1);
        paused = false;
        paintKey = '';
        paint(false);
        cue();
        return;
      }
      if (action === 'journal') {
        reverse = null;
        selected = '';
        index = Math.max(0, Math.min(route.entries.length - 1, Number(el.dataset.index)));
        elapsed = 0;
        paused = true;
        editing = false;
        paintKey = '';
        paint();
        cue();
        return;
      }
      if (action === 'play') {
        if (draft) {
          a.tell('Save your process to start looping playback.');
          return;
        }
        if (reverse) {
          reverse = null;
          paused = true;
          paintKey = '';
          paint();
          return;
        }
        if (editing) {
          a.tell('Save or cancel the step editor first.');
          return;
        }
        paused = !paused;
        selected = '';
        paintKey = '';
        paint(false);
        if (!paused) cue();
        else clearAudio();
        return;
      }
      if (action === 'restart') {
        selected = '';
        overrides = {};
        routeChoices = {};
        rebuild();
        paused = false;
        editing = false;
        paint(false);
        cue();
        return;
      }
      if (
        action === 'back' &&
        index > 0 &&
        index < route.entries.length &&
        !motionOff() &&
        !editing
      ) {
        paused = true;
        reverse = { source: index, target: index - 1, elapsed: 0 };
        paintKey = '';
        paint();
        return;
      }
      if (action === 'back' || action === 'next') {
        reverse = null;
        if (editing) {
          a.tell('Save or cancel the step editor first.');
          return;
        }
        selected = '';
        index = Math.max(
          0,
          Math.min(route.entries.length - 1, index + (action === 'back' ? -1 : 1))
        );
        elapsed = 0;
        paused = true;
        paintKey = '';
        paint();
        cue();
        return;
      }
      if (action === 'zoom-in' || action === 'zoom-out') {
        zoom = Math.max(0.2, Math.min(1.5, zoom + (action === 'zoom-in' ? 0.1 : -0.1)));
        a.render();
      }
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-rehearsal]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(err => a.tell(err.message, true));
    });
    document.addEventListener('dragstart', event => {
      const el = event.target.closest?.('[data-step-type]');
      if (!el || !draft) return;
      event.dataTransfer.setData('application/x-workhub-process-step', el.dataset.stepType);
      event.dataTransfer.effectAllowed = 'copy';
    });
    document.addEventListener('dragover', event => {
      if (
        draft &&
        event.target.closest?.('#rehearsalViewport') &&
        [...event.dataTransfer.types].includes('application/x-workhub-process-step')
      ) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    });
    document.addEventListener('drop', event => {
      if (!draft || !event.target.closest?.('#rehearsalViewport')) return;
      const type = event.dataTransfer.getData('application/x-workhub-process-step');
      if (!E.TYPES.includes(type)) return;
      event.preventDefault();
      try {
        guard(owner);
        dropStep(type, event);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('pointerdown', event => {
      const type = event.target.closest?.('[data-step-type]');
      if (type && draft && ['touch', 'pen'].includes(event.pointerType)) {
        paletteDrag = {
          type: type.dataset.stepType,
          startX: event.clientX,
          startY: event.clientY,
          owner,
          moved: false,
          ghost: null,
        };
        type.setPointerCapture?.(event.pointerId);
        return;
      }
      const handle = event.target.closest?.('[data-rehearsal-drag]');
      if (!handle || event.button > 0) return;
      if (editing) {
        a.tell('Save or cancel the step editor before moving cards.');
        return;
      }
      try {
        guard(owner);
        const s = model().steps.find(s => s.id === handle.dataset.rehearsalDrag);
        if (!s) return;
        paused = true;
        event.preventDefault();
        drag = {
          id: s.id,
          x: s.x,
          y: s.y,
          baseX: s.x,
          baseY: s.y,
          startX: event.clientX,
          startY: event.clientY,
          owner,
          process: model().id,
          moved: false,
        };
        handle.setPointerCapture?.(event.pointerId);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('pointermove', event => {
      if (paletteDrag) {
        const d = paletteDrag;
        if (Math.abs(event.clientX - d.startX) + Math.abs(event.clientY - d.startY) > 8)
          d.moved = true;
        if (d.moved) {
          event.preventDefault();
          if (!d.ghost) {
            d.ghost = document.createElement('div');
            d.ghost.className = 'ph-drag-ghost';
            d.ghost.textContent = ICONS[d.type] + ' ' + d.type;
            (overlay?.firstElementChild || document.body).append(d.ghost);
          }
          d.ghost.style.transform = `translate(${event.clientX + 12}px,${event.clientY + 12}px)`;
        }
        return;
      }
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / zoom,
        dy = (event.clientY - drag.startY) / zoom;
      drag.x = Math.max(0, Math.min(4000, drag.baseX + dx));
      drag.y = Math.max(0, Math.min(4000, drag.baseY + dy));
      drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 4;
      const node = [...document.querySelectorAll('[data-node]')].find(
        n => n.dataset.node === drag.id
      );
      if (node) {
        node.style.left = drag.x + 'px';
        node.style.top = drag.y + 'px';
      }
      const map = positions();
      for (const edge of document.querySelectorAll('.rehearsal-edge')) {
        const a = map.get(edge.dataset.from),
          b = map.get(edge.dataset.to);
        if (a && b) edge.setAttribute('d', E.path(a, b));
      }
    });
    document.addEventListener('pointerup', event => {
      if (paletteDrag) {
        const d = paletteDrag;
        paletteDrag = null;
        d.ghost?.remove();
        if (d.moved) {
          suppressClick = Date.now() + 400;
          const r = $('rehearsalViewport')?.getBoundingClientRect();
          if (
            r &&
            d.owner === a.owner() &&
            event.clientX >= r.left &&
            event.clientX <= r.right &&
            event.clientY >= r.top &&
            event.clientY <= r.bottom
          )
            try {
              dropStep(d.type, event);
            } catch (err) {
              a.tell(err.message, true);
            }
        }
        return;
      }
      const d = drag;
      drag = null;
      if (!d) return;
      if (d.moved) {
        suppressClick = Date.now() + 400;
        if (d.owner === a.owner() && d.process === model().id)
          try {
            moveStep(d.id, d.x, d.y);
          } catch (err) {
            a.tell(err.message, true);
          }
      }
    });
    document.addEventListener('pointercancel', () => {
      paletteDrag?.ghost?.remove();
      paletteDrag = null;
      if (!drag) return;
      drag = null;
      a.render();
    });
    document.addEventListener(
      'keydown',
      event => {
        const el = event.target.closest?.('[data-rehearsal-drag]');
        if (!el || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (editing) {
          a.tell('Save or cancel the step editor before moving cards.');
          return;
        }
        try {
          const s = model().steps.find(s => s.id === el.dataset.rehearsalDrag),
            n = event.shiftKey ? 30 : 10;
          if (s) {
            moveStep(
              s.id,
              s.x + (event.key === 'ArrowLeft' ? -n : event.key === 'ArrowRight' ? n : 0),
              s.y + (event.key === 'ArrowUp' ? -n : event.key === 'ArrowDown' ? n : 0)
            );
            [...document.querySelectorAll('[data-rehearsal-drag]')]
              .find(node => node.dataset.rehearsalDrag === s.id)
              ?.focus();
          }
        } catch (err) {
          a.tell(err.message, true);
        }
      },
      true
    );
    document.addEventListener('submit', event => {
      if (event.target.id === 'processHubDetails') {
        event.preventDefault();
        return;
      }
      if (event.target.id === 'processHubExport') {
        event.preventDefault();
        void exportProcess(event.target).catch(err => {
          if (event.target.dataset.owner === a.owner()) a.tell(err.message, true);
        });
        return;
      }
      if (
        ![
          'rehearsalStepForm',
          'rehearsalProcessForm',
          'rehearsalScenarioForm',
          'rehearsalNewForm',
        ].includes(event.target.id)
      )
        return;
      event.preventDefault();
      try {
        saveForm(event.target);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('change', event => {
      const el = event.target,
        id = el.id;
      try {
        if (id === 'rehearsalImageInput') {
          void upload(el.files?.[0], el.closest('form')).catch(err => a.tell(err.message, true));
          return;
        }
        if (id === 'processHubView') {
          setMode(el.value);
          return;
        }
        if (id === 'rehearsalProcess') {
          if (editing) {
            el.value = processId;
            a.tell('Save or cancel the step editor first.');
            return;
          }
          processId = el.value;
          scenarioId = '';
          lastModel = '';
          overrides = {};
          routeChoices = {};
          route = null;
          editing = false;
          paused = false;
          if (processId === '__demo__') {
            demo = E.seed('__demo__', now());
          }
          a.render();
          return;
        }
        if (id === 'rehearsalScenario') {
          if (editing) {
            el.value = scenarioId;
            a.tell('Save or cancel the step editor first.');
            return;
          }
          scenarioId = el.value;
          lastModel = '';
          overrides = {};
          routeChoices = {};
          rebuild();
          paused = false;
          a.render();
          return;
        }
        const fields = {
            rehearsalSpeed: 'speed',
            rehearsalVolume: 'volume',
            rehearsalTheme: 'theme',
            rehearsalEffects: 'effects',
            rehearsalExplore: 'explore',
          },
          key = fields[id];
        if (key) {
          setPreference(
            key,
            el.type === 'checkbox'
              ? el.checked
              : ['speed', 'volume'].includes(key)
                ? Number(el.value)
                : el.value
          );
          if (key === 'volume') {
            if (prefs().volume === 0) clearAudio();
            else cue();
          }
          syncAudio();
        }
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('visibilitychange', () => {
      last = 0;
      if (document.hidden) clearAudio();
      else if (audio && !paused) cue();
      else if (audio) void unlock();
    });
    root.addEventListener('pageshow', event => {
      if (event.persisted && a.ready() && (!a.active || a.active())) {
        mode = 'normal';
        editing = false;
        route = null;
        a.render();
      }
    });
    root.addEventListener('beforeunload', event => {
      if (draft || editing) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    root.addEventListener('pagehide', () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
        exportUrl = '';
      }
      stopFrame();
      closeOverlay();
      draft = null;
      editorSnapshot = null;
      paletteDrag?.ghost?.remove();
      paletteDrag = null;
    });
    return {
      render,
      mount,
      saveForm,
      stepEditor,
      scenarioEditor,
      model,
      beginDraft,
      saveDraft,
      setMode,
      addStep,
      open(id) {
        resetOwner();
        const p = library().find(x => x.id === id || x.hubId === id);
        if (!p) return false;
        processId = p.id;
        archived = p.archived;
        scenarioId = '';
        route = null;
        lastModel = '';
        overrides = {};
        routeChoices = {};
        editing = false;
        return true;
      },
      plan: () => route,
      snapshot: () => ({
        index,
        elapsed,
        paused,
        editing,
        scenarioId,
        processId,
        loops,
        mode,
        drafting: !!draft,
        archived,
        sound: audioReady && audio?.state === 'running' && prefs().sound,
        audioPending: !!audioPending,
        audioError,
        rewinding: !!reverse,
      }),
      tick,
      stop: stopFrame,
    };
  }
  root.WorkHubRehearsal = { install };
})(window);
