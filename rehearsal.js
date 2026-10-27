/** Animated personal rehearsal UI. Playback is temporary; edits use the existing private document save path. */
(function rehearsalUI(root) {
  'use strict';
  const E = root.WorkHubRehearsalEngine,
    esc = x =>
      String(x ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
  const ICONS = E.TYPE_ICONS;
  function install(a) {
    let selection = new Set(),
      selectionMode = false,
      selectionProcess = '',
      marquee = null;
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
      paletteDrag = null,
      interactive = false,
      answered = new Set(),
      visitChoices = {},
      presenter = null;
    let routeContext = '',
      routeModel = null,
      branchVisits = Object.create(null),
      routePreview = Object.create(null),
      linkFrom = '',
      linkDrop = null,
      wire = null,
      linkMessage = '',
      linkEffects = [];
    let panelOpen = false,
      paletteOpen = false,
      followCamera = false,
      pan = null,
      restoreView = null,
      editHistory = [],
      restoring = false,
      spacePan = false,
      linkSelection = new Map(),
      activeLink = null,
      linkGesture = null;
    const $ = id => document.getElementById(id),
      prefs = () => a.state().workhub.rehearsal.preferences;
    const screens = root.WorkHubPresentationScreen?.create({
      valid: () => a.ready() && a.owner() === owner,
      report: message => a.tell(message),
    });
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
      presenter?.close();
      screens?.clear();
      interactive = false;
      answered.clear();
      visitChoices = {};
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
      routeContext = '';
      routeModel = null;
      branchVisits = Object.create(null);
      routePreview = Object.create(null);
      linkFrom = '';
      linkSelection.clear();
      activeLink = linkGesture = null;
      linkDrop = wire = null;
      linkMessage = '';
      linkEffects = [];
      panelOpen = paletteOpen = followCamera = spacePan = false;
      pan = restoreView = null;
      editHistory = [];
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
      marquee?.element.remove();
      marquee = null;
      selection.clear();
      selectionMode = false;
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
    function normalPaths(step) {
      return [
        ...new Set(
          [
            step.next,
            ...(step.alternatives || []),
            ...(step.decision?.answers || []).map(a => a.next),
          ].filter(Boolean)
        ),
      ];
    }
    function observeGraph(p) {
      if (routeModel && routeModel.id === p.id) {
        const old = new Map(routeModel.steps.map(s => [s.id, E.connections(s)]));
        for (const step of p.steps)
          for (const to of E.connections(step)) {
            if (old.get(step.id)?.includes(to)) continue;
            linkEffects.push({ id: uid(), from: step.id, to, until: Date.now() + 2800 });
            if (normalPaths(step).includes(to)) {
              const queue = (routePreview[step.id] ||= []);
              if (!queue.includes(to)) queue.push(to);
              delete routeChoices[step.id];
            }
          }
        linkEffects = linkEffects.slice(-24);
      }
      routeModel = p;
    }
    function playbackRoutes(p) {
      const routes = Object.create(null);
      for (const step of p.steps) {
        const paths = normalPaths(step),
          queue = (routePreview[step.id] || []).filter(to => paths.includes(to));
        routePreview[step.id] = queue;
        if (queue.length) routes[step.id] = queue[0];
        else if (
          !interactive &&
          !step.decision &&
          paths.length > 1 &&
          !Object.hasOwn(scenario(p).routes || {}, step.id)
        )
          routes[step.id] = paths.reduce((best, to) =>
            (branchVisits[step.id]?.[to] || 0) < (branchVisits[step.id]?.[best] || 0) ? to : best
          );
      }
      return { ...routes, ...routeChoices };
    }
    function rebuild(keep = false, liveEdit = false) {
      reverse = null;
      const p = model(),
        context = owner + '|' + p.id + '|' + scenario(p).id;
      if (routeContext !== context) {
        routeContext = context;
        routeModel = null;
        branchVisits = Object.create(null);
        routePreview = Object.create(null);
        linkEffects = [];
        linkFrom = '';
        linkDrop = wire = null;
        linkMessage = '';
        liveEdit = false;
        keep = false;
      }
      observeGraph(p);
      if (!keep) visitChoices = {};
      try {
        if (liveEdit && route) {
          visitChoices = Object.fromEntries(
            Object.entries(visitChoices).filter(([, choice]) =>
              E.answers(p.steps.find(s => s.id === choice.id) || {}).some(
                a => a.next === choice.next && a.outcome === choice.outcome
              )
            )
          );
          const continued = E.resumePlan(
            p,
            scenario(p),
            route,
            index,
            elapsed,
            overrides,
            playbackRoutes(p),
            visitChoices
          );
          route = continued.route;
          index = continued.index;
          elapsed = continued.elapsed;
        } else route = E.plan(p, scenario(p), overrides, playbackRoutes(p), visitChoices);
      } catch (err) {
        route = { entries: [], ending: 'invalid', error: err.message };
        paused = true;
      }
      if (!keep && !liveEdit) {
        answered.clear();
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
      return [
        ...document.querySelectorAll(
          'dialog[open]:not(#processHubOverlay):not(#processPresenter):not(#processAudienceOverlay)'
        ),
      ].some(
        dialog =>
          !dialog.querySelector('#rehearsalProcessForm,#rehearsalScenarioForm,#rehearsalNewForm')
      );
    }
    function blocked() {
      return (
        (document.hidden && !presenter?.connected()) ||
        motionOff() ||
        !!presenter?.blocked() ||
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
        model().steps.map(s => [
          s.id,
          drag?.group?.[s.id]
            ? { ...s, x: drag.group[s.id].x, y: drag.group[s.id].y }
            : drag?.id === s.id
              ? { ...s, x: drag.x, y: drag.y }
              : s,
        ])
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
                `<path class="ph-edge-hit" data-from="${esc(s.id)}" data-to="${esc(id)}" data-rehearsal="manage-edge" d="${E.path(s, map.get(id), E.connector(p, s.id, id))}"/><path class="rehearsal-edge" data-from="${esc(s.id)}" data-to="${esc(id)}" data-kind="${kind}" data-rehearsal="manage-edge" data-selected="${linkSelection.has(JSON.stringify([s.id, id]))}" d="${E.path(s, map.get(id), E.connector(p, s.id, id))}" marker-end="url(#rehearsalArrow)"><title>${esc(E.answers(s).find(a => a.next === id)?.label || kind)}</title></path>${s.decision ? `<text class="ph-route-label" x="${(s.x + 210 + map.get(id).x) / 2}" y="${(s.y + map.get(id).y) / 2 + 38}">${esc(s.decision.answers.find(a => a.next === id)?.label || kind)}</text>` : ''}`
            )
        )
        .join('');
    }
    function linkTools(p = model()) {
      const from = p.steps.find(s => s.id === linkFrom);
      if (!from) return '<section id="processLinkTools" class="ph-link-tools" hidden></section>';
      const destinations = p.steps.filter(
        s => s.id !== from.id && !E.connections(from).includes(s.id)
      );
      const connected = E.connections(from);
      return `<section id="processLinkTools" class="ph-link-tools" aria-label="Link process steps"><header><div><span>CONNECTION MANAGER</span><strong>Link from ${esc(from.title)}</strong></div>${button('finish-linking', '✕', 'aria-label="Close connections"')}</header><p>Connect several destinations. Remove any connection below.</p><div class="ph-link-fields"><label>Starting step<select id="processLinkFrom">${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === from.id ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label></div><div class="ph-connected-list"><h4>Connected destinations <small>${connected.length}</small></h4>${
        connected
          .map(to => {
            const target = p.steps.find(s => s.id === to);
            return `<div><span><b>${esc(target?.title || to)}</b><small>${to === from.next ? 'Default route' : to === from.failNext ? 'Exception route' : 'Alternative route'}</small></span>${button('arrange-link', 'Arrange', `data-from="${esc(from.id)}" data-to="${esc(to)}"`)}${button('unlink', 'Unlink', `data-from="${esc(from.id)}" data-to="${esc(to)}" aria-label="Unlink ${esc(from.title)} from ${esc(target?.title || to)}"`)}</div>`;
          })
          .join('') || '<p>No outgoing links. Choose a destination to begin.</p>'
      }</div><details class="ph-add-connection" open><summary>Add a destination</summary><div class="ph-link-fields"><label>Existing destination<select id="processLinkTo">${destinations.length ? destinations.map(s => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('') : '<option value="">All other steps are already linked</option>'}</select></label>${button('connect-selected', 'Link selected step', destinations.length ? '' : 'disabled', 'primary small')}<label>New step type<select id="processLinkType">${E.TYPES.map(type => `<option value="${type}">${esc(E.TYPE_LABELS[type])}</option>`).join('')}</select></label>${button('add-linked', '＋ Add linked step')}</div></details>${button('finish-linking', 'Done linking')}<p role="status">${esc(linkMessage || 'Playback stays live. New branches join automatically on the next available pass.')}</p></section>`;
    }
    function syncLinkTools() {
      const panel = $('processLinkTools');
      const active = document.activeElement,
        held = panel?.contains(active)
          ? { id: active.id, action: active.dataset.rehearsal, scroll: panel.scrollTop }
          : null;
      if (panel) panel.outerHTML = linkTools();
      if (held) {
        const next = $('processLinkTools');
        const target = held.id
          ? $(held.id)
          : next?.querySelector('[data-rehearsal="' + held.action + '"]');
        target?.focus({ preventScroll: true });
        if (next) next.scrollTop = held.scroll;
      }
      const board = $('rehearsalBoard');
      if (board) board.dataset.linking = String(!!linkFrom);
      for (const node of document.querySelectorAll('#rehearsalBoard [data-node]')) {
        node.dataset.linkSource = String(node.dataset.node === linkFrom);
        const port = node.querySelector('[data-pc-port="out"]');
        port?.setAttribute('aria-pressed', String(node.dataset.node === linkFrom));
      }
      document
        .querySelector('[data-rehearsal="link-mode"]')
        ?.setAttribute('aria-pressed', String(!!linkFrom));
      syncPanels();
    }
    function startLink(id, point = null) {
      if (!model().steps.some(s => s.id === id)) return;
      linkFrom = id;
      linkDrop = point;
      linkMessage = '';
      followCamera = false;
      paletteOpen = panelOpen = false;
      syncPanels();
      syncLinkTools();
    }
    function syncPanels() {
      const inspector = document.querySelector('.ph-inspector-drawer');
      const heading = inspector?.querySelector('header strong');
      if (heading)
        heading.textContent = activeLink
          ? 'Edit connection'
          : editing
            ? 'Edit step'
            : 'Step details';
      if (inspector) inspector.hidden = !panelOpen;
      const links = $('processLinkTools');
      if (links) links.hidden = !linkFrom || panelOpen || paletteOpen;
      const palette = document.querySelector('#rehearsalRoot .ph-palette');
      if (palette) palette.hidden = !paletteOpen;
      const shell = document.querySelector('.ph-canvas-shell');
      if (shell)
        shell.dataset.panel = panelOpen
          ? 'details'
          : paletteOpen
            ? 'steps'
            : linkFrom
              ? 'links'
              : '';
      for (const [action, value] of [
        ['details', panelOpen],
        ['add-step', paletteOpen],
        ['follow', followCamera],
      ])
        document
          .querySelector('[data-rehearsal="' + action + '"]')
          ?.setAttribute('aria-pressed', String(value));
    }
    function rememberView() {
      const old = $('rehearsalRoot');
      if (!old) return;
      const active = document.activeElement,
        form = active?.closest('#rehearsalStepForm');
      restoreView = {
        owner: old.dataset.owner,
        process: old.dataset.process,
        mode: old.dataset.mode,
        x: root.scrollX || 0,
        y: root.scrollY || 0,
        outer: overlay?.firstElementChild?.scrollTop || 0,
        inspector: $('rehearsalInspector')?.scrollTop || 0,
        links: $('processLinkTools')?.scrollTop || 0,
        open: [...old.querySelectorAll('details[data-ph-panel][open]')].map(e => e.dataset.phPanel),
        focus:
          form && active.name
            ? {
                step: form.dataset.id,
                name: active.name,
                start: active.selectionStart,
                end: active.selectionEnd,
              }
            : null,
      };
    }
    function restorePosition() {
      const held = restoreView,
        el = $('rehearsalRoot');
      restoreView = null;
      if (
        !held ||
        held.owner !== owner ||
        held.process !== el?.dataset.process ||
        held.mode !== mode
      )
        return;
      for (const d of el.querySelectorAll('details[data-ph-panel]'))
        d.open = held.open.includes(d.dataset.phPanel);
      if (held.focus) {
        const form = $('rehearsalStepForm'),
          field = form?.elements.namedItem(held.focus.name);
        if (form?.dataset.id === held.focus.step && field?.focus) {
          field.focus({ preventScroll: true });
          try {
            if (held.focus.start !== null)
              field.setSelectionRange(held.focus.start, held.focus.end);
          } catch {}
        }
      }
      if ($('rehearsalInspector')) $('rehearsalInspector').scrollTop = held.inspector;
      if ($('processLinkTools')) $('processLinkTools').scrollTop = held.links;
      if (overlay?.firstElementChild) overlay.firstElementChild.scrollTop = held.outer;
      if ((root.scrollX || 0) !== held.x || (root.scrollY || 0) !== held.y)
        root.scrollTo?.({ left: held.x, top: held.y, behavior: 'instant' });
    }
    function connectSteps(from, to, expected = null) {
      guard(owner);
      if (expected && JSON.stringify(model()) !== JSON.stringify(expected))
        throw Error('The process changed. Start the connection again.');
      if (!from || !to || from === to) throw Error('Choose two different steps to link.');
      if (editing && $('rehearsalStepForm')) saveForm($('rehearsalStepForm'));
      const p = model(),
        source = p.steps.find(s => s.id === from),
        target = p.steps.find(s => s.id === to);
      if (!source || !target) throw Error('Choose two existing steps in this process.');
      linkFrom = from;
      if (E.connections(source).includes(to)) {
        linkMessage = 'These steps are already linked. Choose another destination.';
        syncLinkTools();
        return;
      }
      const ok = saveMutation(row => E.connect(row, from, to));
      if (ok !== false) {
        linkMessage =
          'Connected ' +
          source.title +
          ' → ' +
          target.title +
          '. Keep choosing destinations to add more branches.';
        syncLinkTools();
      }
    }
    function renderLinkHandles(preview = null) {
      const layer = document.querySelector('#rehearsalBoard .ph-link-overlay');
      if (layer)
        layer.innerHTML =
          mode !== 'present' && activeLink
            ? root.WorkHubProcessCanvasArt?.linkHandles(
                preview?.model || model(),
                preview?.edge || E.connector(model(), activeLink.from, activeLink.to)
              ) || ''
            : '';
      for (const edge of document.querySelectorAll(
        '#rehearsalBoard :is(.rehearsal-edge,.ph-edge-hit)'
      ))
        edge.dataset.selected = String(
          linkSelection.has(JSON.stringify([edge.dataset.from, edge.dataset.to]))
        );
    }
    function connectorInspector() {
      if (!activeLink) return '';
      const p = model(),
        edge = E.connector(p, activeLink.from, activeLink.to),
        steps = (key, value) =>
          `<label>${key === 'from' ? 'Starting step' : 'Destination step'}<select name="${key}">${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === value ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label>`,
        anchor = (key, value) =>
          `<fieldset class="ph-anchor-fields"><legend>${key === 'start' ? 'Starting point' : 'Endpoint'}</legend><label>Edge<select name="${key}Side">${['top', 'right', 'bottom', 'left'].map(side => `<option${side === value.side ? ' selected' : ''}>${side}</option>`).join('')}</select></label><label>Position %<input type="number" name="${key}Offset" value="${Math.round(value.offset * 100)}" min="0" max="100" step="1"></label></fieldset>`;
      return `<form id="processConnectorForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-updated="${esc(p.updatedAt)}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}"><span class="hub-kicker">CONNECTION / LIVE EDIT</span><p class="ph-link-help">Drag either end to any edge of a step. Drag the diamond to shape the route. Hold Shift for a 10 px grid.</p>${steps('from', edge.from)}${steps('to', edge.to)}<label>Route style<select name="style">${[
        ['curve', 'Smooth curve'],
        ['elbow', 'Right-angle / Visio'],
        ['straight', 'Straight line'],
      ]
        .map(([v, l]) => `<option value="${v}"${edge.style === v ? ' selected' : ''}>${l}</option>`)
        .join(
          ''
        )}</select></label><details class="ph-exact-anchors"><summary>Exact attachment positions</summary>${anchor('start', edge.start)}${anchor('end', edge.end)}</details><div class="ph-route-actions">${button('connector-bend', '＋ Route bend')}${button('connector-reset', 'Reset attachment & bends')}</div><div class="ph-inspector-footer"><button class="primary" type="submit">Apply connection</button>${button('connector-delete', linkSelection.size > 1 ? 'Delete selected links' : 'Delete link', '', 'danger small')}</div><p class="hub-meta">${linkSelection.size} link${linkSelection.size === 1 ? '' : 's'} selected · Delete selection removes links only. Undo restores them.</p></form>`;
    }
    function selectConnection(from, to, add = false) {
      const p = model();
      if (mode === 'present' || !saved(p)) return;
      if (editing) {
        a.tell('Save or cancel step details before editing a connection.');
        return;
      }
      const key = JSON.stringify([from, to]);
      if (!add) {
        selection.clear();
        linkSelection.clear();
        selected = '';
      }
      if (add && linkSelection.has(key)) linkSelection.delete(key);
      else linkSelection.set(key, { from, to });
      activeLink = [...linkSelection.values()].at(-1) || null;
      followCamera = false;
      panelOpen = !!activeLink;
      paletteOpen = false;
      linkFrom = '';
      paintSelection();
      renderLinkHandles();
      syncPanels();
      $('rehearsalInspector').innerHTML = connectorInspector();
      $('rehearsalViewport')?.focus({ preventScroll: true });
    }
    function deleteSelection() {
      const p = model();
      if (editing) {
        a.tell('Save or cancel step details before deleting steps or links.');
        return;
      }
      const edges = [...linkSelection.values()].filter(e =>
          p.steps.some(s => s.id === e.from && E.connections(s).includes(e.to))
        ),
        ids = [...selection].filter(id => p.steps.some(s => s.id === id));
      if (!ids.length && !edges.length && selected && p.steps.some(s => s.id === selected))
        ids.push(selected);
      if (!ids.length && !edges.length) {
        selectionMode = true;
        syncCanvasModes();
        a.tell('Select steps or click a link, then choose Delete selection.');
        return;
      }
      if (ids.length >= p.steps.length) throw Error('Keep at least one process step.');
      if (
        !root.confirm(
          'Delete ' +
            (ids.length
              ? ids.length + ' step' + (ids.length === 1 ? '' : 's') + ' and their connections'
              : '') +
            (ids.length && edges.length ? ' plus ' : '') +
            (edges.length
              ? edges.length + ' selected link' + (edges.length === 1 ? '' : 's')
              : '') +
            '?' +
            (edges.length && !ids.length ? ' Both steps will be kept.' : '') +
            '\nYou can undo this canvas edit.'
        )
      )
        return;
      followCamera = false;
      selected = '';
      panelOpen = false;
      selection.clear();
      linkSelection.clear();
      activeLink = null;
      if (ids.includes(linkFrom)) linkFrom = '';
      saveMutation(row => {
        for (const e of edges) E.disconnect(row, e.from, e.to);
        if (ids.length) E.removeSteps(row, ids);
      });
      renderLinkHandles();
      syncPanels();
      a.tell(
        ids.length
          ? 'Steps deleted. Undo can restore them.'
          : 'Links deleted. Both steps are kept. Undo can restore them.'
      );
    }
    function connectionTarget(point, p, other) {
      return p.steps
        .filter(
          s =>
            s.id !== other &&
            point.x >= s.x - 24 &&
            point.x <= s.x + 234 &&
            point.y >= s.y - 24 &&
            point.y <= s.y + 124
        )
        .sort(
          (a, b) =>
            Math.hypot(point.x - a.x - 105, point.y - a.y - 50) -
            Math.hypot(point.x - b.x - 105, point.y - b.y - 50)
        )[0];
    }
    function drawConnectionGesture(event) {
      const g = linkGesture,
        point = boardPoint(event),
        A = root.WorkHubProcessCanvasArt;
      if (!g || !point) return;
      g.moved ||= Math.hypot(event.clientX - g.client.x, event.clientY - g.client.y) > 4;
      const edge = E.copy(g.edge),
        p = E.copy(g.before),
        key = g.handle;
      if (event.shiftKey) {
        point.x = Math.round(point.x / 10) * 10;
        point.y = Math.round(point.y / 10) * 10;
      }
      point.x = A.clamp(point.x, 0, 8000);
      point.y = A.clamp(point.y, 0, 8000);
      let valid = true;
      if (key === 'start' || key === 'end') {
        const target = connectionTarget(point, p, key === 'start' ? edge.to : edge.from);
        g.target = target?.id || '';
        if (target) {
          edge[key] = A.nearestAnchor(target, point);
          edge[key === 'start' ? 'from' : 'to'] = target.id;
        } else {
          valid = false;
          const fake = { id: '__pointer__', x: point.x, y: point.y };
          p.steps.push(fake);
          edge[key === 'start' ? 'from' : 'to'] = fake.id;
          edge[key] = { side: 'left', offset: 0 };
        }
      } else {
        const index = key === 'bend-new' ? 0 : Number(key.slice(5));
        edge.via[index] = point;
      }
      g.next = valid ? edge : null;

      for (const node of document.querySelectorAll('#rehearsalBoard [data-node]'))
        node.dataset.linkTarget = String(node.dataset.node === g.target);
      const source = p.steps.find(s => s.id === edge.from),
        target = p.steps.find(s => s.id === edge.to);
      g.visual = { source, target, edge };
      for (const path of document.querySelectorAll(
        '#rehearsalBoard :is(.rehearsal-edge,.ph-edge-hit)'
      ))
        if (path.dataset.from === g.edge.from && path.dataset.to === g.edge.to)
          path.setAttribute('d', A.linkGeometry(source, target, edge).path);
      renderLinkHandles({ model: p, edge });
    }
    function linkPorts(step) {
      return ['in', 'out']
        .map(
          direction =>
            `<button type="button" class="ph-link-port ph-link-port-${direction}" data-rehearsal="link-port" data-pc-port="${direction}" data-pc-step="${esc(step.id)}" aria-label="${direction === 'out' ? 'Start links from ' : 'Link to '}${esc(step.title)}"${direction === 'out' ? ` aria-pressed="${linkFrom === step.id}"` : ''}><span aria-hidden="true">${direction === 'out' ? '＋' : '●'}</span></button>`
        )
        .join('');
    }
    function graph(p) {
      if (selectionProcess !== p.id) {
        selectionProcess = p.id;
        selection.clear();
        linkSelection.clear();
        activeLink = linkGesture = null;
        selectionMode = false;
        editHistory = [];
        panelOpen = paletteOpen = false;
      }

      const size = root.WorkHubProcessCanvasArt?.dimensions(p),
        width = Math.max(3200, (size?.width || 850) + 600),
        height = Math.max(2000, (size?.height || 450) + 500);
      return `<div id="rehearsalViewport" class="rehearsal-viewport" data-select-mode="${selectionMode}" tabindex="0" aria-label="Process canvas. Drag empty space to explore, or choose Select steps. Press 0 to fit."><div class="rehearsal-extent" style="width:${width * zoom}px;height:${height * zoom}px"><div id="rehearsalBoard" class="rehearsal-board" data-linking="${!!linkFrom}" style="width:${width}px;height:${height}px;transform:scale(${zoom})"><svg class="rehearsal-wires" width="${width}" height="${height}" aria-hidden="true"><defs><marker id="rehearsalArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"></path></marker></defs>${edges(p)}<path class="ph-wire-preview" hidden/><g class="pc-saved-annotations">${root.WorkHubProcessCanvasArt?.svg(p) || ''}</g></svg>${p.steps.map(s => `<article class="rehearsal-node" data-node="${esc(s.id)}" data-selected="${selection.has(s.id)}" data-link-source="${linkFrom === s.id}" data-type="${s.type}" style="left:${s.x}px;top:${s.y}px">${p.id !== '__demo__' ? `<button type="button" class="rehearsal-drag" data-rehearsal-drag="${esc(s.id)}" aria-label="Move ${esc(s.title)}. Drag or use arrow keys.">⠿</button>` + (mode !== 'present' ? linkPorts(s) : '') : ''}<button type="button" class="rehearsal-node-main" data-rehearsal="inspect" data-id="${esc(s.id)}"><span class="rehearsal-node-icon">${ICONS[s.type]}</span><span><small>${esc(s.type)}${s.tcode ? ' · ' + esc(s.tcode) : ''}</small><strong>${esc(s.title)}</strong></span></button><span class="rehearsal-node-state" aria-hidden="true"></span><div class="rehearsal-particles" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i style="--particle:${i}"></i>`).join('')}</div></article>`).join('')}<svg class="ph-link-overlay" width="${width}" height="${height}" aria-label="Selected connection handles"></svg><div id="rehearsalToken" class="rehearsal-token" aria-hidden="true"><span>▤</span></div><div class="rehearsal-scene-specks" aria-hidden="true"></div></div></div></div>`;
    }
    function captureDraftFields() {
      const form = $('processHubDetails');
      if (!draft || !form || form.dataset.owner !== a.owner()) return;
      for (const key of ['name', 'notes', ...E.PROCESS_FIELDS])
        draft[key] = form.elements.namedItem(key).value;
      draft.links ||= {};
      for (const key of ['projectId', 'noteId'])
        draft.links[key] = form.elements.namedItem('pc-' + key)?.value ?? draft.links[key] ?? '';
    }
    function palette() {
      return `<aside class="ph-palette" aria-label="Step types"${paletteOpen ? '' : ' hidden'}><header><div><span>INSERT NODE</span><h3>Step types</h3></div>${button('close-palette', '✕', 'aria-label="Close step types"')}</header><span class="hub-kicker">BUILD YOUR FLOW</span><p>Drag onto the canvas, or tap to add.</p>${E.TYPES.map(type => button('palette', `<b>${ICONS[type]}</b><span>${type[0].toUpperCase() + type.slice(1)}<small>${{ task: 'An action to perform', document: 'Create or check a record', decision: 'Choose a route', approval: 'Review and authorise', result: 'An outcome or finish' }[type] || E.TYPE_LABELS[type]}</small></span>`, `data-type="${type}" draggable="true" data-step-type="${type}"`, 'ph-step-type')).join('')}<div class="ph-palette-tip"><strong>Make the connection</strong><p>Drag a right-hand connection point to another step. Keep one source selected to create several branches. Playback stays live while you build.</p></div></aside>`;
    }
    function canvasLinks(p, prefix = 'pc-') {
      return [
        ['projectId', 'Related project', a.state().projects || [], 'name'],
        ['noteId', 'Knowledge note', a.state().workhub.notes || [], 'title'],
      ]
        .map(
          ([key, label, rows, title]) =>
            '<label>' +
            label +
            '<select name="' +
            prefix +
            key +
            '"><option value="">None</option>' +
            rows
              .map(
                r =>
                  '<option value="' +
                  esc(r.id) +
                  '"' +
                  (p.links?.[key] === r.id ? ' selected' : '') +
                  '>' +
                  esc(r[title]) +
                  '</option>'
              )
              .join('') +
            (p.links?.[key] && !rows.some(r => r.id === p.links[key])
              ? '<option selected value="' +
                esc(p.links[key]) +
                '">Saved reference (unavailable)</option>'
              : '') +
            '</select></label>'
        )
        .join('');
    }
    function entityFields(s) {
      return (
        '<details class="pc-entity-fields"><summary>Organization, material & valuation information</summary>' +
        E.ENTITY_FIELDS.map(
          ([key, label]) =>
            '<label>' +
            label +
            '<input name="entity-' +
            key +
            '" maxlength="300" value="' +
            esc(s.entity?.[key] || '') +
            '"></label>'
        ).join('') +
        '</details>'
      );
    }
    function processFields(p) {
      const field = (key, label, large = false) =>
        `<label>${label}${large ? `<textarea name="${key}" maxlength="32767" rows="2">${esc(p[key])}</textarea>` : `<input name="${key}" maxlength="${key === 'name' ? 500 : 300}" value="${esc(p[key])}"${key === 'name' ? ' required' : ''}>`}</label>`;
      return `<details class="ph-process-info" data-ph-panel="process-info"><summary>Process information <span>Name, purpose, audience &amp; your notes</span></summary><form id="processHubDetails" data-owner="${esc(owner)}">${field('name', 'Process name *')}${field('processOwner', 'Process owner / lead')}${field('revision', 'Version / revision')}<label>Use this process for<select name="audience">${[
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
        )}</select></label>${field('objective', 'Purpose / intended outcome', true)}${field('notes', 'Description & context', true)}${field('presenterNotes', 'Private presenter notes (hidden in presentation)', true)}${canvasLinks(p)}</form></details>`;
    }
    function canvasToolbar(p, isSaved, isPresent) {
      return `<div class="rehearsal-stage-bar"><div class="ph-flow-identity"><span class="ph-signal" aria-hidden="true"></span><div><strong>${esc(p.name)}</strong><span id="rehearsalStatus" aria-live="polite"></span></div></div><div class="actions ph-edit-tools">${isSaved && !isPresent ? button('add-step', '＋ Step', `aria-pressed="${paletteOpen}"`) + button('link-mode', '↗ Link steps', `aria-pressed="${!!linkFrom}"`) + button('manage-links', 'Unlink') + button('delete-steps', 'Delete selection', 'title="Delete selected steps or links"') + button('undo-canvas', '↶ Undo', editHistory.length ? '' : 'disabled') + button('layout', 'Auto arrange') : ''}${!isPresent ? button('pan-mode', '✥ Explore', `aria-pressed="${!selectionMode}"`) + button('select-mode', '▧ Select steps', `aria-pressed="${selectionMode}"`) + button('select-all', 'Select all') : ''}${button('details', '▤ Details', `aria-pressed="${panelOpen}"`)}${button('shortcuts', '⌨ Shortcuts', 'title="Keyboard shortcuts (?)" aria-keyshortcuts="? F1"')}</div></div>`;
    }
    function playbackDock() {
      return `<div class="ph-playback-dock" role="group" aria-label="Canvas playback controls"><div class="ph-dock-live"><i aria-hidden="true"></i><span id="phPlaybackState">LIVE FLOW</span><span class="ph-selection-count" role="status">${selection.size ? selection.size + ' selected' : ''}</span></div><div class="rehearsal-playbar">${button('back', '↶', 'aria-label="Previous step / rewind"')}${button('play', paused ? 'Play' : 'Pause', 'id="rehearsalPlay"', 'primary small')}${button('next', '↷', 'aria-label="Next step"')}${button('restart', '↺', 'aria-label="Restart"')}${button('sound', soundLabel(), 'id="rehearsalSound" aria-pressed="false" aria-describedby="rehearsalAudioStatus"')}${button('zoom-out', '−', 'aria-label="Zoom out"')}<span class="ph-zoom">${Math.round(zoom * 100)}%</span>${button('zoom-in', '＋', 'aria-label="Zoom in"')}${button('fit', 'Fit')}${button('follow', '◎ Follow', `aria-pressed="${followCamera}"`)}<details class="ph-dock-options" data-ph-panel="playback"><summary aria-label="Playback settings" title="Playback settings">⚙</summary><div><label>Decisions<select id="rehearsalDecisionMode"><option value="auto"${!interactive ? ' selected' : ''}>Automatic · explore connected paths</option><option value="interactive"${interactive ? ' selected' : ''}>Interactive · ask me</option></select></label><label>Speed<select id="rehearsalSpeed">${[0.5, 1, 1.5, 2].map(v => `<option value="${v}"${v === prefs().speed ? ' selected' : ''}>${v}×</option>`).join('')}</select></label><label>Volume<input id="rehearsalVolume" aria-label="Rehearsal volume" type="range" min="0" max="1" step="0.05" value="${prefs().volume}"></label><p id="rehearsalAudioStatus" class="hub-meta" role="status">${esc(audioMessage())}</p></div></details></div></div>`;
    }
    function workspaceHTML(p, isSaved, isPresent) {
      return `<div class="ph-canvas-layout"><div class="rehearsal-layout"><section class="rehearsal-stage">${canvasToolbar(p, isSaved, isPresent)}<div class="ph-canvas-shell"><div class="ph-canvas-coordinate" aria-hidden="true"><span>WORKSPACE / ${esc(p.revision || 'LIVE')}</span><span>DRAG TO EXPLORE · 0 TO FIT</span></div>${graph(p)}${!isPresent ? palette() + linkTools(p) : ''}<aside class="ph-inspector-drawer"${panelOpen ? '' : ' hidden'} aria-label="Step details"><header><div><span>INSPECTOR</span><strong>Step details</strong></div>${button('close-details', '✕', 'aria-label="Close step details"')}</header><div id="rehearsalInspector" class="rehearsal-inspector"></div></aside>${playbackDock()}<div class="ph-canvas-corner" aria-hidden="true">${p.steps.length} NODES <span>·</span> ${p.steps.reduce((n, step) => n + E.connections(step).length, 0)} CONNECTIONS</div></div><details class="ph-values-panel" data-ph-panel="values"><summary>Sample values <span>Inspect the running data</span></summary><div class="rehearsal-values"><div class="rehearsal-values-title"><strong>Sample values</strong><span>Changes follow your definitions</span></div><div id="rehearsalValues"></div></div></details></section></div></div>`;
    }
    function render() {
      rememberView();
      captureDraftFields();
      const oldForm = $('rehearsalStepForm'),
        view = $('rehearsalViewport');
      if (view && !viewScroll?.explicit)
        viewScroll = { left: view.scrollLeft, top: view.scrollTop };
      if (editing && oldForm && oldForm.dataset.owner === a.owner()) {
        const clone = oldForm.cloneNode(true);
        for (const [i, field] of [...oldForm.elements].entries()) {
          const target = clone.elements[i];
          if (target && 'value' in target) {
            target.value = field.value;
            if ('checked' in field) target.checked = field.checked;
          }
        }
        editorSnapshot = clone;
      }
      const p = model();
      if (selectionProcess !== p.id) {
        selectionProcess = p.id;
        selection.clear();
        linkSelection.clear();
        activeLink = linkGesture = null;
        selectionMode = false;
        editHistory = [];
        panelOpen = paletteOpen = false;
      }
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
      return `<section id="rehearsalRoot" class="hub rehearsal-workspace process-hub-workspace" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-theme="${prefs().theme}" data-effects="${prefs().effects}" data-mode="${mode}" data-draft="${!!draft}"><header class="rehearsal-hero"><div><span class="hub-kicker">${draft ? 'CREATE · CONNECT · EXPLAIN' : 'PROCESS / CANVAS WORKSPACE'}</span><h2>${draft ? 'Process canvas' : 'Process Hub'}<span class="ph-title-mark" aria-hidden="true">↗</span></h2><p>${draft ? 'Arrange the flow and maintain every detail in one space. Save when you are ready.' : 'From your own reference to a clear walkthrough. Watch each handoff come to life.'}</p></div><div class="actions">${actions}${mode !== 'normal' ? button('normal', '↙ Normal view') : button('fullscreen', '⛶ Full screen')}${!draft ? (!isPresent ? button('present', '▷ Present') : '') + button('presenter', '▣ Presenter controls') : ''}</div></header><div class="rehearsal-selection"><label>Saved process<select id="rehearsalProcess"${draft ? ' disabled' : ''}>${draft && !rows.some(x => x.id === p.id) ? `<option value="${esc(p.id)}" selected>Unsaved · ${esc(p.name)}</option>` : ''}${rows.map(x => `<option value="${esc(x.id)}"${x.id === p.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__demo__"${p.id === '__demo__' ? ' selected' : ''}>Sample · Procure to pay</option></select></label><label>Scenario<select id="rehearsalScenario">${p.scenarios.map(s => `<option value="${esc(s.id)}"${s.id === scenarioId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>${isSaved && !isPresent ? button('scenario', 'Edit scenario') + button('scenario-add', '＋ Scenario') : ''}<label>View<select id="processHubView"><option value="normal"${mode === 'normal' ? ' selected' : ''}>Normal</option><option value="full"${mode === 'full' ? ' selected' : ''}>Full screen</option><option value="present"${isPresent ? ' selected' : ''}>Presentation</option></select></label><span class="rehearsal-local-label">${draft ? 'Draft · saved only when you choose Save process' : `${p.steps.length} steps · ${p.scenarios.length} scenarios · ${p.revision ? esc(p.revision) + ' · ' : ''}Looping playback`}</span>${screens ? `<details class="ph-display-panel" data-ph-panel="display"><summary>▣ Presentation display</summary><div>${screens.markup('processPresentationScreen', 'data-rehearsal="screens"')}</div></details>` : ''}</div>${draft ? processFields(p) : `<details class="ph-context-panel" data-ph-panel="context"><summary>Process brief &amp; library actions</summary><div class="ph-library-bar"><div><strong>${esc(p.objective || p.notes || 'Build a process, then explore it at your own pace.')}</strong>${p.processOwner ? `<span>Owner · ${esc(p.processOwner)}</span>` : ''}</div><div class="actions">${!isPresent ? button('archive-view', archived ? 'Show active' : 'Archived processes') : ''}${isSaved && !isPresent ? button('archive', p.archived ? 'Restore process' : 'Archive') + button('export', '↓ Export PDF / Image') : ''}${isSaved && !isPresent ? button('settings', 'Process information') : ''}</div></div></details>`}${workspaceHTML(p, isSaved, isPresent)}<details class="ph-scene-panel" data-ph-panel="scene"><summary>Scene &amp; animation settings</summary><div class="rehearsal-options"><label>Scenery<select id="rehearsalTheme">${[
        ['desk', 'Cosy desk'],
        ['blueprint', 'Blueprint'],
        ['control', 'Control room'],
      ]
        .map(
          ([v, l]) => `<option value="${v}"${prefs().theme === v ? ' selected' : ''}>${l}</option>`
        )
        .join(
          ''
        )}</select></label><label>Effects<select id="rehearsalEffects">${['quiet', 'balanced', 'expressive'].map(v => `<option${prefs().effects === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label><label class="check-label"><input id="rehearsalExplore" type="checkbox"${prefs().explore ? ' checked' : ''}>Explore scenarios automatically</label><span>Live playback continues while you create, link and edit. Connected branches are explored automatically; named decisions keep their defaults.</span></div></details><details class="ph-trace-panel" data-ph-panel="journal"><summary>Playback journal <span>Explore the route history</span></summary><section class="rehearsal-journal"><div><h3>Playback journal</h3><span id="rehearsalJournalHeading">Current route</span></div><ol id="rehearsalJournal" aria-live="off"></ol></section></details></section>`;
    }
    function detailHTML(step) {
      if (!step)
        return '<div class="ph-inspector-empty"><span>↖</span><h3>Every step tells a story</h3><p>Select a card to read its details, or add a step type to start building.</p></div>';
      const presenting = mode === 'present',
        p = model(),
        row = (label, value) => (value ? `<dt>${label}</dt><dd>${esc(value)}</dd>` : '');
      const routes = [step.next, ...(step.alternatives || [])].filter(Boolean);
      return `<span class="hub-kicker">${presenting ? 'FOLLOW THE PROCESS' : 'STEP DETAILS'}</span><div class="rehearsal-detail-title"><span>${ICONS[step.type]}</span><h3>${esc(step.title)}</h3></div>${step.tcode ? `<span class="rehearsal-tcode">${esc(step.tcode)}</span>` : ''}<dl>${row('Who handles it', step.owner)}${row('Before you start', step.prerequisites)}${row('What happens', presenting ? step.audienceText || step.instruction : step.instruction)}${row('Inputs', step.inputs)}${row('Expected result', step.expected)}${row('Outputs', step.outputs)}${row('System / tool', step.system)}${row('Typical working time', step.workingTime)}${!presenting ? row('If it fails / common errors', step.failure) + row('Configuration / setup', step.configuration) + row('Testing checklist', step.testing) : ''}</dl>${step.image ? `<a class="rehearsal-image-link" href="${esc(step.image)}" target="_blank" rel="noopener"><img src="${esc(step.image)}" alt="Reference screenshot for ${esc(step.title)}"></a>` : ''}${!presenting && step.link ? `<a href="${esc(step.link)}" target="_blank" rel="noopener noreferrer">Open reference ↗</a>` : ''}${!presenting ? a.recordLinks?.(step) || '' : ''}${decisionHTML(step)}<div class="rehearsal-branches"><strong>Explore an outcome</strong>${button('success', 'Follow success', `data-id="${esc(step.id)}"`)}${button('failure', 'What if this fails?', `data-id="${esc(step.id)}"`)}${routes.length > 1 ? `<strong>Alternative routes</strong>${routes.map(id => button('route', esc(p.steps.find(s => s.id === id)?.title || id), `data-id="${esc(step.id)}" data-next="${esc(id)}"`)).join('')}` : ''}</div>${p.id !== '__demo__' && !presenting ? button('edit-step', 'Edit this step', `data-id="${esc(step.id)}"`, 'primary small') + button('link-from', '↗ Link from this step', `data-id="${esc(step.id)}"`) : ''}`;
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
        if (screens) void screens.fullscreen(stage);
        else if (stage?.requestFullscreen && !document.fullscreenElement)
          try {
            void stage
              .requestFullscreen()
              .catch(() =>
                a.tell('Fullscreen was unavailable. Keep this view on your shared screen.')
              );
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
      if (!source || !p.scenarios.some(s => s.id === scenarioId)) scenarioId = p.scenarios[0].id;
      if (!source) {
        routeChoices = {};
        overrides = {};
      }
      if (!source) route = null;
      editing = false;
      selected = '';
      editorSnapshot = null;
      if (!source) paused = false;
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
      lastModel = '';
      try {
        if (!a.mutate(d => E.store(d, candidate))) {
          draft = held;
          a.render();
          return;
        }
      } catch (err) {
        draft = held;
        a.render();
        throw err;
      }
      baseFingerprint = '';
      if (editHistory.length) editHistory.at(-1).after = JSON.stringify(model());
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
    function addStep(type = 'task', position = null, from = '') {
      if (editing && $('rehearsalStepForm')) saveForm($('rehearsalStepForm'));
      const p = model();
      if (!saved(p)) throw Error('Save the example or create a process before adding steps.');
      const view = $('rehearsalViewport'),
        source = p.steps.find(s => s.id === from),
        base = E.seed('temporary', now(), true).steps[0],
        s = {
          ...base,
          ...Object.fromEntries(E.STEP_FIELDS.map(k => [k, ''])),
          id: uid(),
          type,
          title: 'New ' + type,
          next: '',
          alternatives: [],
          x:
            position?.x ??
            (source
              ? Math.min(4000, source.x + 300)
              : Math.max(
                  0,
                  Math.min(
                    4000,
                    ((view?.scrollLeft || 0) + (view?.clientWidth || 850) / 2) / zoom - 105
                  )
                )),
          y:
            position?.y ??
            (source
              ? Math.min(4000, source.y + normalPaths(source).length * 140)
              : Math.max(
                  0,
                  Math.min(
                    4000,
                    ((view?.scrollTop || 0) + (view?.clientHeight || 450) / 2) / zoom - 50
                  )
                )),
        };
      if (p.steps.length >= (p.hubId ? 200 : 80))
        throw Error('This process has reached its step limit.');
      editing = false;
      editorSnapshot = null;
      saveMutation(row => {
        row.steps.push(s);
        if (source) E.connect(row, source.id, s.id);
        if (!row.startId) row.startId = s.id;
      });
      stepEditor(s.id);
    }
    function dropStep(type, event) {
      if (!saved(model()) || !E.TYPES.includes(type)) return;
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
      const size = root.WorkHubProcessCanvasArt?.dimensions(p),
        width = size?.width || Math.max(850, ...p.steps.map(s => s.x + 270)),
        height = size?.height || Math.max(450, ...p.steps.map(s => s.y + 180));
      followCamera = false;
      zoom = Math.max(
        0.2,
        Math.min(1.5, (view.clientWidth || 850) / width, (view.clientHeight || 440) / height)
      );
      viewScroll = { left: 0, top: 0, explicit: true };
      a.render();
    }
    function zoomCanvas(value) {
      const view = $('rehearsalViewport');
      if (!view) return;
      const factor = value / zoom;
      viewScroll = {
        left: Math.max(0, (view.scrollLeft + view.clientWidth / 2) * factor - view.clientWidth / 2),
        top: Math.max(0, (view.scrollTop + view.clientHeight / 2) * factor - view.clientHeight / 2),
        explicit: true,
      };
      zoom = value;
      followCamera = false;
      a.render();
    }
    function syncCanvasModes() {
      const view = $('rehearsalViewport');
      if (view) view.dataset.selectMode = String(selectionMode);
      document
        .querySelector('[data-rehearsal="select-mode"]')
        ?.setAttribute('aria-pressed', String(selectionMode));
      document
        .querySelector('[data-rehearsal="pan-mode"]')
        ?.setAttribute('aria-pressed', String(!selectionMode));
      paintSelection();
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
    function pendingDecision() {
      const entry = route?.entries[index],
        step = entry && model().steps.find(s => s.id === entry.id);
      return !!(
        interactive &&
        !draft &&
        !editing &&
        !linkFrom &&
        !wire &&
        !presenter?.editing() &&
        step &&
        E.answers(step).length > 1 &&
        !answered.has(index)
      );
    }
    function decisionHTML(step) {
      const options = E.answers(step);
      if (options.length < 2) return '';
      const waiting = pendingDecision() && route.entries[index]?.id === step.id;
      return `<section class="ph-decision" data-waiting="${waiting}"><span class="hub-kicker">${waiting ? 'YOUR CHOICE · PLAYBACK IS WAITING' : 'DECISION PATHS'}</span><h4>${esc(step.decision?.question || step.title)}</h4><div class="actions">${options.map((answer, i) => button('answer', `${esc(answer.label)}<small>${esc(model().steps.find(s => s.id === answer.next)?.title || 'End route')}</small>`, `data-id="${esc(step.id)}" data-answer="${i}"`, 'ph-answer')).join('')}</div></section>`;
    }
    function chooseAnswer(id, number) {
      const at =
        route?.entries[index]?.id === id ? index : route?.entries.findIndex(e => e.id === id);
      const step = model().steps.find(s => s.id === id),
        answer = step && E.answers(step)[number];
      if (!answer || at < 0 || at === undefined)
        throw Error('Choose an answer on the current route.');
      visitChoices = Object.fromEntries(
        Object.entries(visitChoices).filter(([i]) => Number(i) < at)
      );
      visitChoices[at] = { id, next: answer.next, outcome: answer.outcome };
      index = at;
      rebuild(true);
      answered = new Set([...answered].filter(i => i < at));
      answered.add(at);
      index = at;
      selected = '';
      elapsed = (route.entries[index]?.duration || 3) * 550;
      paused = false;
      paintKey = '';
      paint(false);
      cue();
    }
    function inspect(id) {
      reverse = null;
      const p = model();
      selected = id;
      selection = new Set([id]);
      linkSelection.clear();
      activeLink = null;
      renderLinkHandles();
      panelOpen = true;
      followCamera = false;
      syncPanels();
      paintSelection();
      if (!editing) $('rehearsalInspector').innerHTML = detailHTML(p.steps.find(s => s.id === id));
      paintKey = '';
      paint();
    }
    function camera(step) {
      const view = $('rehearsalViewport');
      if (
        !view ||
        !followCamera ||
        pan ||
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
        key = index + '|' + (entry ? phase >= 0.55 : 'end') + '|' + pendingDecision();
      if (linkEffects.length) {
        const effects = linkEffects.filter(effect => effect.until > Date.now());
        for (const edge of rootEl.querySelectorAll('.rehearsal-edge')) {
          const effect = effects.find(
            effect => effect.from === edge.dataset.from && effect.to === edge.dataset.to
          );
          if (effect) edge.dataset.linkEffect = effect.id;
          else delete edge.dataset.linkEffect;
        }
        for (const node of rootEl.querySelectorAll('[data-node]')) {
          const effect = effects.find(effect => effect.to === node.dataset.node);
          if (effect) node.dataset.linkArrival = effect.id;
          else delete node.dataset.linkArrival;
        }
        linkEffects = effects;
      }
      rootEl.dataset.playing = String((!paused || !!reverse) && !pendingDecision() && !blocked());
      rootEl.dataset.direction = reverse ? 'reverse' : 'forward';
      rootEl.dataset.reduced = String(motionOff());
      const playbackState = $('phPlaybackState');
      if (playbackState)
        playbackState.textContent =
          paused || motionOff() ? 'PAUSED' : pendingDecision() ? 'YOUR CHOICE' : 'LIVE FLOW';
      const play = $('rehearsalPlay');
      if (play) play.textContent = reverse ? 'Pause' : paused || motionOff() ? 'Play' : 'Pause';
      if (key !== paintKey) {
        const moved = paintKey.split('|')[0] !== String(index);
        paintKey = key;
        if (pendingDecision() && !editing && !paletteOpen) {
          panelOpen = true;
          syncPanels();
        }
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
          ? 'Live draft · changes join playback as you build · Save process to keep them'
          : pendingDecision()
            ? 'Choose an answer to continue · ' +
              (p.steps.find(s => s.id === entry?.id)?.decision?.question || entry?.title)
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
          const detailId = selected || display.id;
          if (activeLink) {
            if (!$('processConnectorForm'))
              $('rehearsalInspector').innerHTML = connectorInspector();
          } else
            $('rehearsalInspector').innerHTML = detailHTML(p.steps.find(s => s.id === detailId));
        }
        if (moved && entry) {
          const step = p.steps.find(s => s.id === entry.id);
          if (step && !paused && !blocked() && !draft && !editing && !linkFrom && !wire && !drag)
            camera(step);
          if (!paused && playSound) tone(entry);
        }
      }
      if (reverse) {
        const prev = p.steps.find(s => s.id === route.entries[reverse.target]?.id),
          current = p.steps.find(s => s.id === route.entries[reverse.source]?.id),
          token = $('rehearsalToken');
        if (prev && current && token) {
          const point = E.point(
            prev,
            current,
            1 - Math.min(1, reverse.elapsed / 850),
            E.connector(p, prev.id, current.id)
          );
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
        token.hidden = !entry || !from || !to || phase < 0.5 || motionOff() || pendingDecision();
        if (!token.hidden) {
          const preview =
            linkGesture?.edge.from === from.id && linkGesture?.edge.to === to.id
              ? linkGesture.visual
              : null;
          const point = preview
            ? root.WorkHubProcessCanvasArt.linkGeometry(
                preview.source,
                preview.target,
                preview.edge
              ).point(Math.min(1, (phase - 0.5) * 2))
            : E.point(from, to, Math.min(1, (phase - 0.5) * 2), E.connector(p, from.id, to.id));
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
      const dt = Math.min(presenter?.connected() ? 600 : 150, Math.max(0, t - last));
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
      } else if (!paused && !blocked() && !pendingDecision() && route?.entries.length) {
        elapsed += dt * prefs().speed;
        const entry = route.entries[index],
          duration = entry ? entry.duration * 1000 : 3200;
        if (elapsed >= duration) {
          if (entry?.nextId) {
            const visits = (branchVisits[entry.id] ||= Object.create(null));
            visits[entry.nextId] = (visits[entry.nextId] || 0) + 1;
            routePreview[entry.id] = (routePreview[entry.id] || []).filter(
              to => to !== entry.nextId
            );
          }
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
      presenter?.publish();
      raf = root.requestAnimationFrame(tick);
    }
    function mount() {
      resetOwner();
      presenter?.sync();
      if (a.active && !a.active()) {
        closeOverlay();
        pan = null;
        ((spacePan = false),
          (linkSelection = new Map()),
          (activeLink = null),
          (linkGesture = null));
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
        paused = false;
        elapsed = 0;
        index = 0;
      }
      if (key !== lastModel || !wasVisible) {
        lastModel = key;
        rebuild(true, wasVisible && routeContext === owner + '|' + p.id + '|' + scenario(p).id);
      }
      syncLinkTools();
      for (const [key, edge] of linkSelection)
        if (!p.steps.some(s => s.id === edge.from && E.connections(s).includes(edge.to)))
          linkSelection.delete(key);
      activeLink =
        activeLink && linkSelection.has(JSON.stringify([activeLink.from, activeLink.to]))
          ? activeLink
          : [...linkSelection.values()].at(-1) || null;
      renderLinkHandles();
      wasVisible = true;
      if (editing && editorSnapshot && editorSnapshot.dataset.owner === owner) {
        $('rehearsalInspector').replaceChildren(editorSnapshot);
        editorSnapshot = null;
        root.WorkHubProcessInspector?.enhance($('rehearsalStepForm'));
      }
      paintKey = '';
      paint();
      syncAudio();
      syncPanels();
      restorePosition();
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
    function saveMutation(fn, remember = true) {
      guard(owner);
      captureDraftFields();
      const before = remember && !restoring ? E.copy(model()) : null;
      const record = () => {
        if (before) {
          const after = JSON.stringify(model());
          editHistory.push({ before, after, weight: JSON.stringify(before).length + after.length });
          while (
            editHistory.length > 1 &&
            (editHistory.length > 20 ||
              editHistory.reduce((sum, row) => sum + row.weight, 0) > 4000000)
          )
            editHistory.shift();
          const undo = document.querySelector('[data-rehearsal="undo-canvas"]');
          if (undo) undo.disabled = false;
        }
      };
      if (draft) {
        const next = E.copy(draft);
        fn(next, a.state());
        next.updatedAt = now();
        const probe = E.copy(a.state());
        E.store(probe, { ...next, name: next.name.trim() || 'Untitled process' });
        E.validate(probe);
        draft = next;
        a.render();
        record();
        return true;
      }
      const ok = a.mutate(d => {
        const p = E.library(d).find(p => p.id === processId);
        if (!p) throw Error('Save the example before editing.');
        fn(p, d);
        p.updatedAt = now();
        E.store(d, p);
      });
      if (ok !== false) record();
      return ok;
    }
    function undoCanvas() {
      const lastEdit = editHistory.at(-1);
      if (!lastEdit) return;
      if (editing) throw Error('Save or cancel the step details before Undo.');
      if (JSON.stringify(model()) !== lastEdit.after)
        throw Error('The process changed after that edit. Undo will not overwrite newer changes.');
      restoring = true;
      try {
        if (
          saveMutation(row => {
            for (const key of Object.keys(row))
              if (!Object.hasOwn(lastEdit.before, key)) delete row[key];
            Object.assign(row, E.copy(lastEdit.before));
          }, false) !== false
        ) {
          editHistory.pop();
          if (editHistory.length) editHistory.at(-1).after = JSON.stringify(model());
          selection.clear();
          linkSelection.clear();
          activeLink = null;
          renderLinkHandles();
          selected = '';
          panelOpen = false;
          syncPanels();
          paintSelection();
          const undo = document.querySelector('[data-rehearsal="undo-canvas"]');
          if (undo) undo.disabled = !editHistory.length;
          a.tell('Canvas edit undone.');
        }
      } finally {
        restoring = false;
      }
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
        `<form id="rehearsalProcessForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-updated="${esc(p.updatedAt)}"><label>Process name<input name="name" required maxlength="300" value="${esc(p.name)}"></label><label>Description / context<textarea name="notes" maxlength="32767">${esc(p.notes)}</textarea></label>${canvasLinks(p)}${E.PROCESS_FIELDS.map(k => `<label>${{ objective: 'Purpose / intended outcome', audience: 'Audience / use', processOwner: 'Process owner', revision: 'Version / revision', presenterNotes: 'Private presenter notes' }[k]}<textarea name="${k}" maxlength="32767">${esc(p[k])}</textarea></label>`).join('')}<label>Starting step<select name="startId">${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === p.startId ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><div class="modal-actions">${button('delete-process', 'Delete process', '', 'danger small')}<button class="primary" type="submit">Save process</button></div></form>`
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
                step.alternatives?.length || step.decision
                  ? `<label>Normal route from ${esc(step.title)}<select name="route-${esc(step.id)}">${[
                      step.next,
                      ...step.alternatives,
                      ...(step.decision?.answers || []).map(a => a.next),
                    ]
                      .filter((id, i, list) => list.indexOf(id) === i)
                      .map(
                        id =>
                          `<option value="${esc(id)}"${(s.routes?.[step.id] ?? step.next) === id ? ' selected' : ''}>${esc((step.decision?.answers.find(a => a.next === id)?.label || 'Route') + ' → ' + (p.steps.find(x => x.id === id)?.title || 'End route'))}</option>`
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
    function decisionFields(step, p) {
      const choices = step.decision?.answers || [
        { label: 'Yes', next: step.next },
        { label: 'No', next: step.alternatives?.[0] || step.failNext || '' },
      ];
      return `<fieldset class="ph-decision-editor"${step.type !== 'decision' ? ' hidden' : ''}><legend>Decision question &amp; answers</legend><label class="check-label"><input name="decisionEnabled" type="checkbox"${step.decision ? ' checked' : ''}>Enable named answers</label><p>Maintain 2–6 answers with different destinations. The default is used in automatic playback; interactive playback waits for your choice. An empty destination ends the route.</p><label>Question<input name="decisionQuestion" maxlength="500" value="${esc(step.decision?.question || step.title)}"></label>${Array.from({ length: 6 }, (_, i) => `<div class="ph-answer-editor"><label>Answer ${i + 1}<input name="decisionLabel-${i}" maxlength="120" value="${esc(choices[i]?.label || '')}" placeholder="${i < 2 ? 'Answer label' : 'Optional answer'}"></label><label>Go to<select name="decisionNext-${i}"><option value="">End route</option>${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === choices[i]?.next ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><label class="check-label"><input type="radio" name="decisionDefault" value="${i}"${(step.decision ? !!choices[i] && choices[i].next === step.next : i === 0) ? ' checked' : ''}>Default</label></div>`).join('')}<p>Normal routes below are maintained from these answers when this is a decision step. Exception routing remains available separately.</p></fieldset>`;
    }
    function stepEditor(id) {
      const p = model(),
        step = p.steps.find(s => s.id === id);
      guard(owner);
      if (!saved(p) || !step) throw Error('Step no longer exists.');
      reverse = null;
      editing = true;
      selected = id;
      linkSelection.clear();
      activeLink = null;
      renderLinkHandles();
      const field = (k, label, type = 'text', max = 32767) =>
        `<label>${label}${type === 'textarea' ? `<textarea name="${k}" maxlength="${max}">${esc(step[k])}</textarea>` : `<input name="${k}" maxlength="${max}" value="${esc(step[k])}"${k === 'title' ? ' required' : ''}${k === 'tcode' ? ' list="rehearsalTcodes"' : ''}>`}</label>`;
      $('rehearsalInspector').innerHTML =
        `<form id="rehearsalStepForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-id="${esc(id)}" data-updated="${esc(p.updatedAt)}"><span class="hub-kicker">EDIT STEP · LIVE PLAYBACK</span>${field('title', 'Step title', 'text', 500)}<label>Step type<select name="type">${E.TYPES.map(t => `<option value="${t}"${t === step.type ? ' selected' : ''}>${esc(E.TYPE_LABELS[t])}</option>`).join('')}</select></label>${field('tcode', 'Transaction / reference codes', 'text', 32767)}<datalist id="rehearsalTcodes">${a
          .state()
          .workhub.tcodes.records.filter(r => !r.archived)
          .map(r => `<option value="${esc(r.code)}">${esc(r.title)}</option>`)
          .join(
            ''
          )}</datalist>${field('owner', 'Who handles it', 'text', 200)}${field('prerequisites', 'Before you start', 'textarea')}${field('instruction', 'Instructions', 'textarea')}${field('expected', 'Expected result', 'textarea')}${field('failure', 'If it fails / common errors & solutions', 'textarea')}${decisionFields(step, p)}${field('inputs', 'Inputs / required information', 'textarea')}${field('outputs', 'Outputs / deliverables', 'textarea')}${field('system', 'System / tool', 'text', 300)}${field('workingTime', 'Typical working time (separate from playback)', 'text', 300)}${entityFields(step)}${field('audienceText', 'Explanation to show users (optional)', 'textarea')}${field('configuration', 'Configuration / setup notes', 'textarea')}${field('testing', 'Testing / verification checklist', 'textarea')}<label>Normal next step<select name="next"><option value="">End route</option>${p.steps.map(s => `<option value="${esc(s.id)}"${s.id === step.next ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><fieldset><legend>Additional normal routes</legend>${p.steps
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
      panelOpen = true;
      paletteOpen = false;
      followCamera = false;
      syncPanels();
      root.WorkHubProcessInspector?.enhance($('rehearsalStepForm'));
      $('rehearsalInspector').querySelector('[name="title"]').focus({ preventScroll: true });
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
          row.links = { projectId: value('pc-projectId'), noteId: value('pc-noteId') };
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
          if (step.alternatives?.length || step.decision)
            routes[step.id] = value('route-' + step.id);
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
          entity: Object.fromEntries(
            E.ENTITY_FIELDS.map(([k]) => [
              k,
              form.elements.namedItem('entity-' + k)?.value || old.entity?.[k] || '',
            ])
          ),
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
        if (step.type === 'decision' && form.elements.namedItem('decisionEnabled').checked) {
          const answers = Array.from({ length: 6 }, (_, i) => ({
            label: value('decisionLabel-' + i).trim(),
            next: value('decisionNext-' + i),
            i,
          })).filter(a => a.label);
          const normal = answers.find(a => String(a.i) === value('decisionDefault'));
          if (!normal) throw Error('Choose a default among the maintained decision answers.');
          step.decision = {
            question: value('decisionQuestion').trim(),
            answers: answers.map(({ label, next }) => ({ label, next })),
          };
          step.next = normal.next;
          step.alternatives = answers.map(a => a.next).filter(id => id && id !== normal.next);
        } else delete step.decision;
        editing = false;
        editorSnapshot = null;
        try {
          saveMutation(row => {
            row.steps[row.steps.findIndex(s => s.id === id)] = step;
            E.pruneConnectors(row);
            if (form.elements.namedItem('isStart').checked) row.startId = id;
            for (const scenario of row.scenarios)
              if (
                scenario.routes?.[id] &&
                ![
                  step.next,
                  ...step.alternatives,
                  ...(step.decision?.answers || []).map(a => a.next),
                ].includes(scenario.routes[id])
              )
                delete scenario.routes[id];
          });
        } catch (err) {
          editing = true;
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
      saveMutation(p => {
        const step = p.steps.find(s => s.id === id);
        if (!step) throw Error('Step no longer exists.');
        const moving = selection.has(id) ? new Set(selection) : new Set([id]);
        let more = true;
        while (more) {
          more = false;
          for (const s of p.steps)
            if (s.stackParent && moving.has(s.stackParent) && !moving.has(s.id)) {
              moving.add(s.id);
              more = true;
            }
        }
        const rows = p.steps.filter(s => moving.has(s.id));
        const dx = Math.max(
          -Math.min(...rows.map(s => s.x)),
          Math.min(4000 - Math.max(...rows.map(s => s.x)), x - step.x)
        );
        const dy = Math.max(
          -Math.min(...rows.map(s => s.y)),
          Math.min(4000 - Math.max(...rows.map(s => s.y)), y - step.y)
        );
        for (const s of rows) {
          s.x += dx;
          s.y += dy;
          if (s.stackParent && !moving.has(s.stackParent)) delete s.stackParent;
        }
      });
    }
    function paintSelection() {
      for (const n of document.querySelectorAll('#rehearsalBoard [data-node]'))
        n.dataset.selected = String(selection.has(n.dataset.node));
      const status = document.querySelector('.ph-selection-count');
      if (status) status.textContent = selection.size ? selection.size + ' selected' : '';
    }
    function boardPoint(e) {
      const r = $('rehearsalBoard')?.getBoundingClientRect();
      return r ? { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom } : null;
    }
    async function handle(el) {
      guard(owner);
      const action = el.dataset.rehearsal,
        id = el.dataset.id,
        p = model();
      if (action === 'shortcuts') {
        root.WorkHubProcessShortcuts?.guide($('rehearsalRoot'), { readOnly: mode === 'present' });
        return;
      }
      if (action === 'details' || action === 'close-details') {
        if (editing && (action === 'close-details' || panelOpen)) {
          a.tell('Save or cancel the step details first.');
          return;
        }
        panelOpen = action === 'details' ? !panelOpen : false;
        paletteOpen = false;
        followCamera = false;
        syncPanels();
        return;
      }
      if (action === 'close-palette') {
        paletteOpen = false;
        syncPanels();
        return;
      }
      if (action === 'pan-mode') {
        linkSelection.clear();
        activeLink = null;
        renderLinkHandles();
        selectionMode = false;
        selection.clear();
        followCamera = false;
        $('rehearsalViewport')?.setAttribute('data-select-mode', 'false');
        paintSelection();
        syncCanvasModes();
        return;
      }
      if (action === 'follow') {
        followCamera = !followCamera;
        if (followCamera) {
          const step = p.steps.find(s => s.id === route?.entries[index]?.id);
          if (step) camera(step);
        }
        syncPanels();
        return;
      }
      if (action === 'arrange-link') {
        selectConnection(el.dataset.from, el.dataset.to);
        return;
      }
      if (action === 'manage-edge') {
        if (Date.now() < suppressClick) return;
        selectConnection(el.dataset.from, el.dataset.to);
        return;
      }
      if (action === 'manage-links') {
        startLink(selected || linkFrom || p.steps[0]?.id);
        return;
      }
      if (action === 'unlink') {
        if (editing && $('rehearsalStepForm')) saveForm($('rehearsalStepForm'));
        followCamera = false;
        saveMutation(row => E.disconnect(row, el.dataset.from, el.dataset.to));
        linkMessage = 'Connection removed. Undo can restore it.';
        syncLinkTools();
        return;
      }
      if (action === 'undo-canvas') {
        undoCanvas();
        return;
      }
      if (action === 'delete-steps') {
        deleteSelection();
        return;
      }
      if (
        action === 'connector-bend' ||
        action === 'connector-reset' ||
        action === 'connector-delete'
      ) {
        if (!activeLink) return;
        if (action === 'connector-delete') {
          deleteSelection();
          return;
        }
        const edge = E.copy(E.connector(p, activeLink.from, activeLink.to));
        if (action === 'connector-reset') {
          edge.via = [];
          edge.start = { side: 'right', offset: 0.5 };
          edge.end = { side: 'left', offset: 0.5 };
        } else {
          if (edge.via.length >= 8) throw Error('Use up to eight route bends.');
          const source = p.steps.find(s => s.id === edge.from),
            target = p.steps.find(s => s.id === edge.to),
            pt = root.WorkHubProcessCanvasArt.linkGeometry(source, target, edge).point(0.5);
          edge.via.push({ x: Math.max(0, pt.x + 40), y: Math.max(0, pt.y + 60) });
        }
        saveMutation(row => E.setConnector(row, edge));
        $('rehearsalInspector').innerHTML = connectorInspector();
        return;
      }
      if (action === 'link-mode' || action === 'link-from') {
        if (!saved(p)) throw Error('Save an editable copy before linking steps.');
        if (action === 'link-mode' && linkFrom) {
          linkFrom = '';
          linkDrop = null;
          syncLinkTools();
        } else startLink(id || selected || p.steps[0]?.id);
        return;
      }
      if (action === 'finish-linking') {
        linkFrom = '';
        linkDrop = null;
        syncLinkTools();
        return;
      }
      if (action === 'link-port') {
        if (Date.now() < suppressClick) return;
        if (el.dataset.pcPort === 'out') startLink(el.dataset.pcStep);
        else if (linkFrom) connectSteps(linkFrom, el.dataset.pcStep);
        else a.tell('Choose a right-hand connection point first.');
        return;
      }
      if (action === 'connect-selected') {
        connectSteps(linkFrom, $('processLinkTo')?.value);
        return;
      }
      if (action === 'add-linked') {
        const type = $('processLinkType')?.value || 'task';
        addStep(type, linkDrop, linkFrom);
        linkDrop = null;
        return;
      }
      if (action === 'select-mode' || action === 'select-all') {
        linkSelection.clear();
        activeLink = null;
        selectionMode = action === 'select-all' ? true : !selectionMode;
        selection = action === 'select-all' ? new Set(p.steps.map(s => s.id)) : new Set();
        a.render();
        return;
      }
      if (action === 'screens') {
        captureDraftFields();
        if (await screens?.discover()) a.render();
        return;
      }
      if (action === 'presenter') {
        if (draft || editing) throw Error('Save or cancel your changes before presenting.');
        presenter?.open();
        return;
      }
      if (action === 'answer') {
        if (editing) throw Error('Save or cancel the step editor first.');
        chooseAnswer(id, Number(el.dataset.answer));
        return;
      }
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
        paletteOpen = !paletteOpen;
        panelOpen = false;
        followCamera = false;
        linkFrom = '';
        syncLinkTools();
        syncPanels();
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
          saveMutation(row => E.removeStep(row, id));
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
        paintKey = '';
        paint(false);
        $('rehearsalInspector').innerHTML = detailHTML(p.steps.find(s => s.id === selected));
        syncPanels();
        return;
      }
      if (action === 'inspect') {
        if (Date.now() < suppressClick) return;
        if (linkFrom && id !== linkFrom) connectSteps(linkFrom, id);
        else inspect(id);
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
        if (reverse) {
          reverse = null;
          paused = true;
          paintKey = '';
          paint();
          return;
        }
        paused = !paused;
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
      if (action === 'next' && pendingDecision()) {
        a.tell('Choose an answer before continuing.');
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
        zoomCanvas(Math.max(0.2, Math.min(2, zoom + (action === 'zoom-in' ? 0.1 : -0.1))));
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
      if (!el || !saved(model())) return;
      event.dataTransfer.setData('application/x-workhub-process-step', el.dataset.stepType);
      event.dataTransfer.effectAllowed = 'copy';
    });
    document.addEventListener('dragover', event => {
      if (
        saved(model()) &&
        event.target.closest?.('#rehearsalViewport') &&
        [...event.dataTransfer.types].includes('application/x-workhub-process-step')
      ) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    });
    document.addEventListener('drop', event => {
      if (!saved(model()) || !event.target.closest?.('#rehearsalViewport')) return;
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
      const view = event.target.closest?.('#rehearsalViewport'),
        card = event.target.closest?.('[data-node]');
      const control = event.target.closest?.(
        '#rehearsalRoot .ph-edit-tools button, #rehearsalRoot .ph-playback-dock button, #processLinkTools button, #rehearsalRoot .ph-inspector-drawer button, #rehearsalRoot .rehearsal-node-main'
      );
      if (control && event.button === 0) {
        event.preventDefault();
        control.focus({ preventScroll: true });
      }
      const connectionHandle = event.target.closest?.('#rehearsalBoard [data-link-handle]'),
        edge = event.target.closest?.('#rehearsalBoard :is(.rehearsal-edge,.ph-edge-hit)');
      if (view && event.button === 0 && (connectionHandle || edge) && mode !== 'present') {
        event.preventDefault();
        followCamera = false;
        if (connectionHandle && activeLink && !editing) {
          linkGesture = {
            handle: connectionHandle.dataset.linkHandle,
            id: event.pointerId,
            owner,
            process: model().id,
            before: E.copy(model()),
            edge: E.copy(E.connector(model(), activeLink.from, activeLink.to)),
            client: { x: event.clientX, y: event.clientY },
            moved: false,
            next: null,
          };
          view.setPointerCapture?.(event.pointerId);
        } else if (edge) {
          selectConnection(
            edge.dataset.from,
            edge.dataset.to,
            event.ctrlKey || event.metaKey || event.shiftKey
          );
          suppressClick = Date.now() + 400;
        }
        return;
      }
      const port = event.target.closest?.('#rehearsalBoard [data-pc-port]');
      if (
        view &&
        !port &&
        !event.target.closest('.rehearsal-edge,.ph-edge-hit') &&
        event.isPrimary !== false &&
        (event.button === 1 || (event.button === 0 && (spacePan || (!selectionMode && !card))))
      ) {
        event.preventDefault();
        followCamera = false;
        pan = {
          id: event.pointerId,
          view,
          x: event.clientX,
          y: event.clientY,
          left: view.scrollLeft,
          top: view.scrollTop,
          moved: false,
          owner,
          process: model().id,
        };
        view.dataset.panning = 'true';
        view.setPointerCapture?.(event.pointerId);
        view.focus({ preventScroll: true });
        return;
      }
      if (view && port && event.button === 0 && mode !== 'present') {
        event.preventDefault();
        wire = {
          from: port.dataset.pcStep,
          direction: port.dataset.pcPort,
          owner,
          process: model().id,
          expected: E.copy(model()),
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
        view.setPointerCapture?.(event.pointerId);
        return;
      }
      if (selectionMode && view && event.button === 0 && !editing && mode !== 'present') {
        if (!card) {
          const point = boardPoint(event);
          if (!point) return;
          event.preventDefault();
          suppressClick = Date.now() + 400;
          const element = document.createElement('div');
          element.className = 'ph-marquee';
          element.setAttribute('aria-hidden', 'true');
          $('rehearsalBoard').append(element);
          const base = event.shiftKey || event.ctrlKey || event.metaKey ? [...selection] : [];
          selection = new Set(base);
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            linkSelection.clear();
            activeLink = null;
            renderLinkHandles();
          }
          marquee = {
            start: point,
            element,
            base,
            owner,
            process: model().id,
            id: event.pointerId,
          };
          view.setPointerCapture?.(event.pointerId);
          view.focus({ preventScroll: true });
          paintSelection();
          return;
        }
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          suppressClick = Date.now() + 400;
          if (selection.has(card.dataset.node)) selection.delete(card.dataset.node);
          else selection.add(card.dataset.node);
          paintSelection();
          return;
        }
      }
      const type = event.target.closest?.('[data-step-type]');
      if (type && saved(model()) && ['touch', 'pen'].includes(event.pointerType)) {
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
      const handle =
        event.target.closest?.('[data-rehearsal-drag]') ||
        (selectionMode && card ? card.querySelector('[data-rehearsal-drag]') : null);
      if (!handle || event.button > 0) return;
      if (editing) {
        a.tell('Save or cancel the step editor before moving cards.');
        return;
      }
      try {
        guard(owner);
        const s = model().steps.find(s => s.id === handle.dataset.rehearsalDrag);
        if (!s) return;
        if (!selection.has(s.id)) selection = new Set([s.id]);
        paintSelection();
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
          group: Object.fromEntries(
            model()
              .steps.filter(s => selection.has(s.id))
              .map(s => [s.id, { x: s.x, y: s.y, baseX: s.x, baseY: s.y }])
          ),
        };
        handle.setPointerCapture?.(event.pointerId);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('pointermove', event => {
      if (pan) {
        if (pan.id !== event.pointerId) return;
        if (!pan.view.isConnected || pan.owner !== a.owner() || pan.process !== model().id) {
          pan = null;
          return;
        }
        event.preventDefault();
        const dx = event.clientX - pan.x,
          dy = event.clientY - pan.y;
        pan.moved ||= Math.hypot(dx, dy) > 4;
        pan.view.scrollLeft = pan.left - dx;
        pan.view.scrollTop = pan.top - dy;
        return;
      }
      if (linkGesture) {
        if (linkGesture.id !== event.pointerId) return;
        if (
          !$('rehearsalRoot') ||
          (a.active && !a.active()) ||
          linkGesture.owner !== a.owner() ||
          linkGesture.process !== model().id
        ) {
          linkGesture = null;
          return;
        }
        event.preventDefault();
        drawConnectionGesture(event);
        return;
      }
      if (wire) {
        if (wire.id !== event.pointerId) return;
        if (wire.owner !== a.owner() || wire.process !== model().id) {
          wire = null;
          return;
        }
        const point = boardPoint(event),
          source = model().steps.find(s => s.id === wire.from),
          path = document.querySelector('#rehearsalBoard .ph-wire-preview');
        if (!point || !source || !path) return;
        event.preventDefault();
        wire.moved ||= Math.hypot(event.clientX - wire.x, event.clientY - wire.y) > 5;
        if (wire.moved) {
          path.removeAttribute('hidden');
          const x = source.x + (wire.direction === 'out' ? 210 : 0),
            y = source.y + 50;
          path.setAttribute(
            'd',
            `M${x},${y} C${x + (wire.direction === 'out' ? 90 : -90)},${y} ${point.x},${point.y} ${point.x},${point.y}`
          );
        }
        return;
      }
      if (marquee) {
        if (marquee.id !== event.pointerId) return;
        if (marquee.owner !== a.owner() || marquee.process !== model().id) {
          marquee.element.remove();
          marquee = null;
          selection.clear();
          return;
        }
        const pt = boardPoint(event);
        if (!pt) return;
        event.preventDefault();
        const x = Math.min(pt.x, marquee.start.x),
          y = Math.min(pt.y, marquee.start.y),
          w = Math.abs(pt.x - marquee.start.x),
          h = Math.abs(pt.y - marquee.start.y);
        Object.assign(marquee.element.style, {
          left: x + 'px',
          top: y + 'px',
          width: w + 'px',
          height: h + 'px',
        });
        selection = new Set(marquee.base);
        if (w + h > 4)
          for (const s of model().steps)
            if (s.x <= x + w && s.x + 210 >= x && s.y <= y + h && s.y + 100 >= y)
              selection.add(s.id);
        paintSelection();
        return;
      }
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
      const rows = Object.values(drag.group);
      const mx = Math.max(
        -Math.min(...rows.map(s => s.baseX)),
        Math.min(4000 - Math.max(...rows.map(s => s.baseX)), dx)
      );
      const my = Math.max(
        -Math.min(...rows.map(s => s.baseY)),
        Math.min(4000 - Math.max(...rows.map(s => s.baseY)), dy)
      );
      drag.x = drag.baseX + mx;
      drag.y = drag.baseY + my;
      drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 4;
      for (const [id, pos] of Object.entries(drag.group)) {
        pos.x = pos.baseX + mx;
        pos.y = pos.baseY + my;
        const node = [...document.querySelectorAll('#rehearsalBoard [data-node]')].find(
          n => n.dataset.node === id
        );
        if (node) {
          node.style.left = pos.x + 'px';
          node.style.top = pos.y + 'px';
        }
      }
      const map = positions();
      for (const edge of document.querySelectorAll('.rehearsal-edge,.ph-edge-hit')) {
        const a = map.get(edge.dataset.from),
          b = map.get(edge.dataset.to);
        if (a && b) edge.setAttribute('d', E.path(a, b, E.connector(model(), a.id, b.id)));
      }
      renderLinkHandles();
    });
    document.addEventListener('pointerup', event => {
      if (pan && pan.id === event.pointerId) {
        pan.view.dataset.panning = 'false';
        if (pan.moved) suppressClick = Date.now() + 400;
        try {
          pan.view.releasePointerCapture?.(event.pointerId);
        } catch {}
        pan = null;
        return;
      }
      if (linkGesture) {
        if (linkGesture.id !== event.pointerId) return;
        const done = linkGesture;
        linkGesture = null;
        suppressClick = Date.now() + 400;
        try {
          if (
            !$('rehearsalRoot') ||
            (a.active && !a.active()) ||
            done.owner !== a.owner() ||
            done.process !== model().id
          )
            return;
          if (done.moved) {
            if (!done.next)
              throw Error('Drop the endpoint on an edge of a step. The original link is kept.');
            if (JSON.stringify(model()) !== JSON.stringify(done.before))
              throw Error('The process changed. Start this connection edit again.');
            const edge = done.next;
            linkSelection.clear();
            activeLink = { from: edge.from, to: edge.to };
            linkSelection.set(JSON.stringify([edge.from, edge.to]), activeLink);
            saveMutation(row =>
              E.reconnect(row, done.edge.from, done.edge.to, edge.from, edge.to, edge)
            );
            $('rehearsalInspector').innerHTML = connectorInspector();
            a.tell('Connection updated. Playback continues. Undo can restore it.');
          }
        } catch (err) {
          linkSelection.clear();
          activeLink = { from: done.edge.from, to: done.edge.to };
          linkSelection.set(JSON.stringify([activeLink.from, activeLink.to]), activeLink);
          a.tell(err.message, true);
        } finally {
          for (const n of document.querySelectorAll('[data-link-target]'))
            delete n.dataset.linkTarget;
          const map = positions();
          for (const e of document.querySelectorAll(
            '#rehearsalBoard :is(.rehearsal-edge,.ph-edge-hit)'
          )) {
            const a = map.get(e.dataset.from),
              b = map.get(e.dataset.to);
            if (a && b) e.setAttribute('d', E.path(a, b, E.connector(model(), a.id, b.id)));
          }
          renderLinkHandles();
          try {
            $('rehearsalViewport')?.releasePointerCapture?.(event.pointerId);
          } catch {}
        }
        return;
      }
      if (wire) {
        if (wire.id !== event.pointerId) return;
        const done = wire;
        wire = null;
        suppressClick = Date.now() + 400;
        document.querySelector('#rehearsalBoard .ph-wire-preview')?.setAttribute('hidden', '');
        if (done.owner !== a.owner() || done.process !== model().id) return;
        try {
          if (!done.moved) {
            if (done.direction === 'out') startLink(done.from);
            else if (linkFrom) connectSteps(linkFrom, done.from, done.expected);
          } else {
            const element =
                document.elementFromPoint?.(event.clientX, event.clientY) || event.target,
              destination =
                element?.closest('[data-pc-step]')?.dataset.pcStep ||
                element?.closest('[data-node]')?.dataset.node;
            if (destination && destination !== done.from)
              connectSteps(
                done.direction === 'out' ? done.from : destination,
                done.direction === 'out' ? destination : done.from,
                done.expected
              );
            else if (done.direction === 'out') {
              startLink(done.from, boardPoint(event));
              linkMessage = 'Choose a new step type, then Add linked step to place it here.';
              syncLinkTools();
            }
          }
        } catch (err) {
          a.tell(err.message, true);
        }
        return;
      }
      if (marquee) {
        if (marquee.id !== event.pointerId) return;
        marquee.element.remove();
        marquee = null;
        suppressClick = Date.now() + 400;
        paintSelection();
        return;
      }
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
      if (linkGesture) {
        linkGesture = null;
        a.render();
      }
      if (pan) {
        pan.view.scrollLeft = pan.left;
        pan.view.scrollTop = pan.top;
        pan.view.dataset.panning = 'false';
        pan = null;
      }
      wire = null;
      document.querySelector('#rehearsalBoard .ph-wire-preview')?.setAttribute('hidden', '');
      if (marquee) {
        selection = new Set(marquee.base);
        marquee.element.remove();
        marquee = null;
        paintSelection();
      }
      paletteDrag?.ghost?.remove();
      paletteDrag = null;
      if (!drag) return;
      drag = null;
      a.render();
    });
    async function keyboardCommand(command, form = null) {
      guard(owner);
      if (command === 'help') {
        root.WorkHubProcessShortcuts.guide($('rehearsalRoot'), { readOnly: mode === 'present' });
        return;
      }
      if (command === 'save') {
        const openForm = form || $('rehearsalStepForm') || $('processConnectorForm');
        if (openForm && !openForm.reportValidity()) return;
        if (openForm?.id === 'processConnectorForm') openForm.requestSubmit();
        else if (draft) saveDraft();
        else if (openForm) saveForm(openForm);
        else a.tell('Canvas edits save automatically. This process is already saved.');
      } else if (command === 'edit') {
        if (editing) return;
        if (activeLink) {
          panelOpen = true;
          syncPanels();
          $('rehearsalInspector').innerHTML = connectorInspector();
        } else {
          const id = [...selection][0] || selected;
          if (!id) {
            a.tell('Select a step or link first, then press E to edit it.');
            return;
          }
          stepEditor(id);
        }
        $('rehearsalInspector')
          ?.querySelector('input,select,textarea')
          ?.focus({ preventScroll: true });
        return;
      } else {
        const action =
          {
            select: 'select-mode',
            explore: 'pan-mode',
            connect: 'link-mode',
            insert: 'add-step',
            undo: 'undo-canvas',
            delete: 'delete-steps',
          }[command] || command;
        if (['select', 'explore'].includes(command) && linkFrom)
          await handle({ dataset: { rehearsal: 'finish-linking' } });
        if (command !== 'select' || !selectionMode)
          await handle({ dataset: { rehearsal: action } });
        if (command === 'insert') {
          document.querySelector('.ph-palette [data-step-type]')?.focus({ preventScroll: true });
          return;
        }
      }
      $('rehearsalViewport')?.focus({ preventScroll: true });
    }
    document.addEventListener(
      'keydown',
      event => {
        const surface = event.target.closest?.('#rehearsalRoot'),
          form = event.target.closest?.('#rehearsalProcessForm,#rehearsalScenarioForm');
        if (
          a.ready() &&
          (!a.active || a.active()) &&
          root.WorkHubProcessShortcuts?.dispatch(event, {
            surface: surface || form,
            readOnly: mode === 'present',
            skip: command =>
              (!surface && command !== 'save') ||
              (command === 'delete' && !!event.target.closest('[data-link-handle]')),
            run: command => {
              void keyboardCommand(command, form).catch(err => a.tell(err.message, true));
            },
          })
        )
          return;
        if (
          event.target.closest?.('#rehearsalViewport') &&
          !event.target.closest('input,textarea,select,[contenteditable="true"]') &&
          mode !== 'present'
        ) {
          const handle = event.target.closest('[data-link-handle]')?.dataset.linkHandle;
          if (event.key === 'Escape' && (linkGesture || activeLink)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            linkGesture = null;
            activeLink = null;
            linkSelection.clear();
            panelOpen = false;
            a.render();
            return;
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'z'
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            try {
              undoCanvas();
            } catch (err) {
              a.tell(err.message, true);
            }
            return;
          }
          if (['Delete', 'Backspace'].includes(event.key) && (activeLink || selection.size)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            try {
              if (handle?.startsWith('bend-') && handle !== 'bend-new' && activeLink) {
                const edge = E.copy(E.connector(model(), activeLink.from, activeLink.to));
                edge.via.splice(Number(handle.slice(5)), 1);
                saveMutation(row => E.setConnector(row, edge));
              } else deleteSelection();
            } catch (err) {
              a.tell(err.message, true);
            }
            return;
          }
          if (
            handle &&
            activeLink &&
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const edge = E.copy(E.connector(model(), activeLink.from, activeLink.to)),
              n = event.shiftKey ? 10 : 2,
              dx = event.key === 'ArrowLeft' ? -n : event.key === 'ArrowRight' ? n : 0,
              dy = event.key === 'ArrowUp' ? -n : event.key === 'ArrowDown' ? n : 0;
            if (handle === 'start' || handle === 'end')
              edge[handle].offset = Math.max(
                0,
                Math.min(1, edge[handle].offset + (dx || dy) / 100)
              );
            else {
              const i = handle === 'bend-new' ? 0 : Number(handle.slice(5)),
                pt =
                  edge.via[i] ||
                  root.WorkHubProcessCanvasArt.linkGeometry(
                    model().steps.find(s => s.id === edge.from),
                    model().steps.find(s => s.id === edge.to),
                    edge
                  ).point(0.5);
              edge.via[i] = {
                x: Math.max(0, Math.min(8000, pt.x + dx)),
                y: Math.max(0, Math.min(8000, pt.y + dy)),
              };
            }
            try {
              saveMutation(row => E.setConnector(row, edge));
              document
                .querySelector(
                  '[data-link-handle="' + (handle === 'bend-new' ? 'bend-0' : handle) + '"]'
                )
                ?.focus({ preventScroll: true });
            } catch (err) {
              a.tell(err.message, true);
            }
            return;
          }
        }
        if (
          event.target.closest?.('#rehearsalViewport') &&
          !event.target.closest('input,textarea,select,[contenteditable="true"]')
        ) {
          if (event.key === ' ') {
            event.preventDefault();
            spacePan = true;
            $('rehearsalViewport').dataset.spacePan = 'true';
            return;
          }
          if (event.key === '0') {
            event.preventDefault();
            fit();
            return;
          }
          if (
            event.target.id === 'rehearsalViewport' &&
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
          ) {
            event.preventDefault();
            followCamera = false;
            const view = $('rehearsalViewport'),
              distance = event.shiftKey ? 160 : 60;
            view.scrollLeft +=
              event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0;
            view.scrollTop +=
              event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0;
            return;
          }
          if (event.key === 'Escape' && pan) {
            event.preventDefault();
            event.stopImmediatePropagation();
            pan.view.scrollLeft = pan.left;
            pan.view.scrollTop = pan.top;
            pan.view.dataset.panning = 'false';
            pan = null;
            return;
          }
        }
        if (
          event.key === 'Escape' &&
          (wire || linkFrom) &&
          event.target.closest?.('#rehearsalRoot') &&
          !event.target.matches('input,textarea,select')
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          wire = null;
          linkFrom = '';
          linkDrop = null;
          document.querySelector('#rehearsalBoard .ph-wire-preview')?.setAttribute('hidden', '');
          syncLinkTools();
          return;
        }
        if (
          event.target.closest?.('#rehearsalViewport') &&
          !event.target.matches('input,textarea,select,[contenteditable="true"]')
        ) {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            event.stopPropagation();
            selectionMode = true;
            selection = new Set(model().steps.map(s => s.id));
            a.render();
            $('rehearsalViewport')?.focus();
            return;
          }
          if (event.key === 'Escape' && selection.size) {
            event.preventDefault();
            event.stopImmediatePropagation();
            selection.clear();
            if (marquee) {
              marquee.element.remove();
              marquee = null;
            }
            paintSelection();
            return;
          }
        }
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
    document.addEventListener('keyup', event => {
      if (event.key === ' ') {
        ((spacePan = false),
          (linkSelection = new Map()),
          (activeLink = null),
          (linkGesture = null));
        if ($('rehearsalViewport')) $('rehearsalViewport').dataset.spacePan = 'false';
      }
    });
    root.addEventListener('blur', () => {
      ((spacePan = false), (linkSelection = new Map()), (activeLink = null), (linkGesture = null));
      if (pan) pan.view.dataset.panning = 'false';
      pan = null;
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'processConnectorForm') {
        event.preventDefault();
        try {
          const f = event.target,
            p = checkForm(f),
            value = k => f.elements.namedItem(k).value,
            edge = E.copy(E.connector(p, f.dataset.from, f.dataset.to));
          edge.style = value('style');
          for (const key of ['start', 'end'])
            edge[key] = { side: value(key + 'Side'), offset: Number(value(key + 'Offset')) / 100 };
          const from = value('from'),
            to = value('to');
          saveMutation(row => E.reconnect(row, edge.from, edge.to, from, to, edge));
          selectConnection(from, to);
          a.tell('Connection updated. Playback continues.');
        } catch (err) {
          a.tell(err.message, true);
        }
        return;
      }
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
        if (id === 'processLinkFrom') {
          startLink(el.value);
          return;
        }
        if (el.name === 'type' && el.closest('#rehearsalStepForm')) {
          el.closest('form').querySelector('.ph-decision-editor').hidden = el.value !== 'decision';
          return;
        }
        if (id === 'rehearsalDecisionMode') {
          interactive = el.value === 'interactive';
          answered.clear();
          paintKey = '';
          paint(false);
          return;
        }
        if (id === 'rehearsalImageInput') {
          void upload(el.files?.[0], el.closest('form')).catch(err => a.tell(err.message, true));
          return;
        }
        if (id === 'processPresentationScreen') {
          screens?.choose(el.value);
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
      presenter?.close();
      stopFrame();
      closeOverlay();
      draft = null;
      editorSnapshot = null;
      paletteDrag?.ghost?.remove();
      paletteDrag = null;
    });
    function audienceSnapshot() {
      const p = model(),
        entry = route?.entries[index],
        step = p.steps.find(s => s.id === entry?.id);
      return {
        kind: 'process',
        title: p.name,
        objective: p.objective,
        annotations: E.copy(p.annotations || []),
        theme: prefs().theme,
        reduced: motionOff() || prefs().effects === 'quiet',
        speed: prefs().speed,
        playing: !paused && !pendingDecision() && !motionOff() && !presenter?.blocked(),
        phase: entry ? Math.min(1, elapsed / (entry.duration * 1000)) : 1,
        duration: entry?.duration || 3,
        active: entry?.id || '',
        next: entry?.nextId || '',
        outcome: entry?.outcome || 'success',
        linkEffects: linkEffects.filter(effect => effect.until > Date.now()),
        count: index + 1,
        total: route?.entries.length || 0,
        steps: p.steps.map(s => ({
          id: s.id,
          title: s.title,
          type: s.type,
          x: s.x,
          y: s.y,
          entity: s.entity || {},
          stackParent: s.stackParent || '',
        })),
        edges: p.steps.flatMap(s =>
          E.connections(s).map(next => ({
            from: s.id,
            to: next,
            label: E.answers(s).find(a => a.next === next)?.label || '',
            failure: next === s.failNext,
            ...E.copy(E.connector(p, s.id, next)),
          }))
        ),
        detail: step
          ? {
              title: step.title,
              explanation: step.audienceText || step.instruction,
              expected: step.expected,
              owner: step.owner,
            }
          : { title: 'Route complete', explanation: 'The walkthrough will restart shortly.' },
        decision:
          pendingDecision() && step
            ? {
                question: step.decision?.question || step.title,
                answers: E.answers(step).map(a => ({ label: a.label })),
              }
            : null,
      };
    }
    presenter = root.WorkHubPresenter?.install({
      screens,
      canvas: {
        sound: () => handle({ dataset: { rehearsal: 'sound' } }),
        audio: () => ({
          label: soundLabel(),
          enabled: !!prefs().sound && audioReady && audio?.state === 'running',
        }),
        // Read-only cached model; the canvas copies only when staging an edit.
        model: () => model(),
        references: () => ({
          projects: (a.state().projects || []).map(r => ({ id: r.id, title: r.name })),
          notes: (a.state().workhub.notes || []).map(r => ({ id: r.id, title: r.title })),
        }),
        save(next, expected) {
          guard(owner);
          const current = model();
          if (current.id === '__demo__')
            throw Error('Save an editable copy of this process first.');
          if (current.id !== expected.id || JSON.stringify(current) !== JSON.stringify(expected))
            throw Error('The process changed. Reopen the canvas item before saving.');
          const ok = saveMutation(row => {
            for (const key of Object.keys(row)) if (!Object.hasOwn(next, key)) delete row[key];
            Object.assign(row, E.copy(next));
          });
          if (ok !== false) paint(false);
          return ok;
        },
        copy: () => saveCopy(false),
      },
      ready: () => a.ready() && !draft && !editing,
      owner: a.owner,
      active: () => !a.active || a.active(),
      snapshot: audienceSnapshot,
      privateInfo: () => {
        const p = model();
        return {
          processId,
          scenarioId,
          interactive,
          notes: p.presenterNotes,
          paused,
          processes: library()
            .filter(p => !p.archived)
            .map(p => ({ id: p.id, name: p.name })),
          scenarios: p.scenarios.map(s => ({ id: s.id, name: s.name })),
        };
      },
      command(action, value) {
        guard(owner);
        if (draft || editing) throw Error('Save or cancel your changes before presenting.');
        if (action === 'process' || action === 'scenario') {
          if (action === 'process') {
            processId = value;
            scenarioId = '';
          } else scenarioId = value;
          overrides = {};
          routeChoices = {};
          route = null;
          lastModel = '';
          paused = false;
          a.render();
        } else if (action === 'step') {
          const p = model();
          if (!p.steps.some(s => s.id === value)) return;
          route = E.plan({ ...p, startId: value }, scenario(p), overrides, routeChoices, {});
          reverse = null;
          visitChoices = {};
          answered.clear();
          index = 0;
          elapsed = 0;
          selected = value;
          paused = true;
          paintKey = '';
          paint(false);
        } else if (action === 'interactive') {
          interactive = value;
          answered.clear();
          paintKey = '';
          paint(false);
          const select = $('rehearsalDecisionMode');
          if (select) select.value = value ? 'interactive' : 'auto';
        } else if (action === 'answer') chooseAnswer(route.entries[index]?.id, Number(value));
        else if (['play', 'next', 'back', 'restart'].includes(action))
          return handle({ dataset: { rehearsal: action } });
      },
      backgroundPulse() {
        if (!document.hidden || !$('rehearsalRoot')) return;
        if (raf) root.cancelAnimationFrame(raf);
        tick(root.performance.now());
      },
      tell: a.tell,
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
      presenter,
      audienceSnapshot,
      plan: () => route,
      snapshot: () => ({
        selection: [...selection],
        selectedLinks: [...linkSelection.values()],
        selectionMode,
        index,
        elapsed,
        paused,
        editing,
        scenarioId,
        processId,
        loops,
        mode,
        drafting: !!draft,
        interactive,
        waitingForDecision: pendingDecision(),
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
