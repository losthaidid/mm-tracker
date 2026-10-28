/**
 * studio.js
 * Workspace shell and feature coordinator: My day, Knowledge, Process Hub, Studio and timers.
 * Saved workspace preferences live in state.workhub; animation and running timers stay local.
 * DEFAULTS and WIDGETS describe defaults; install(a) connects feature modules to app.js.
 * File map: docs/FILE-MAP.md
 */
/* WorkHub Studio: local animation and compact, account-owned records. */
(function (root) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'hub-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const dataValue = (el, key, value) => {
    if (el && el.dataset[key] !== String(value)) el.dataset[key] = String(value);
  };
  const styleValue = (el, key, value) => {
    if (el && el.style.getPropertyValue(key) !== value) el.style.setProperty(key, value);
  };
  const styleValues = (el, values) => {
    for (const [key, value] of Object.entries(values))
      if (el.style[key] !== value) el.style[key] = value;
  };
  const DEFAULT_WIDGETS = ['today', 'tasks', 'waiting', 'journey', 'achievements', 'desk'];
  const WIDGETS = {
    today: 'Your day',
    tasks: 'Next actions',
    waiting: 'Waiting on',
    journey: 'Project journey',
    achievements: 'Daily achievements',
    desk: 'Your growing workspace',
    focus: 'Focus timer', // Legacy backup ID; My Day upgrades it to the Focus orb.
    knowledge: 'Knowledge shortcut',
    ...Object.fromEntries(
      Object.entries(root.WorkHubMyDayEngine.WIDGETS).map(([id, value]) => [id, value[0]])
    ),
  };
  const DEFAULTS = {
    name: '',
    workspace: 'My WorkHub',
    theme: 'ocean',
    accent: '#2563eb',
    radius: 16,
    font: 'system',
    background: 'mist',
    motion: 'calm',
    sounds: false,
    mascot: true,
    mascotName: 'Momo',
    roaming: true,
    accessory: 'glasses',
    outfit: 'daily',
    outfitPalette: 'daily',
    hobbies: true,
    displayMode: 'auto',
    density: 'comfortable',
    desk: true,
  };
  const BOARD = { todo: 'To do', doing: 'In progress', blocked: 'Blocked', done: 'Done' };
  const TIME_OPTIONS = ['custom', 'task', 'project', 'ticket'];
  function subtaskCompletionButton(task, sub, detail = false) {
    const done = sub.status === 'Completed';
    return `<button type="button" class="small hub-subtask-complete" data-hub="subtask-complete" data-parent="${esc(task.id)}" data-id="${esc(sub.id)}"${detail ? ' data-detail="true"' : ''}${done || task.archived ? ' disabled' : ''} aria-label="${done ? 'Completed: ' : 'Mark subtask as completed: '}${esc(sub.title)}">${done ? '✓ Completed' : '✓ Complete'}</button>`;
  }
  function subtaskFeedbackButton(task, sub) {
    return `<button type="button" class="small hub-subtask-feedback" data-hub="subtask-feedback" data-parent="${esc(task.id)}" data-id="${esc(sub.id)}" aria-label="Add feedback for sub-task: ${esc(sub.title)}">Add feedback</button>`;
  }
  /** Add missing workspace fields to older documents while retaining existing saved values. */
  function upgrade(d) {
    if (!d || typeof d !== 'object') return d;
    if (!d.workhub) d.workhub = {};
    const h = d.workhub;
    for (const key of ['notes', 'processes', 'waiting', 'sessions', 'scrapbook'])
      if (h[key] === undefined) h[key] = [];
    if (h.preferences === undefined) h.preferences = { ...DEFAULTS };
    else h.preferences = { ...DEFAULTS, ...h.preferences };
    root.WorkHubAppearance.upgrade(h.preferences);
    root.WorkHubProjectDates.upgrade(d);
    root.WorkHubLeave.upgrade(d);
    root.WorkHubLeaveBalancesEngine.upgrade(d);
    root.WorkHubClaimsEngine.upgrade(d);
    root.WorkHubRecipientsEngine.upgrade(d);
    if (h.widgets === undefined)
      h.widgets = DEFAULT_WIDGETS.map(id => ({
        id,
        span: ['today', 'journey'].includes(id) ? 'wide' : 'normal',
      }));
    if (h.ticketClosures === undefined) h.ticketClosures = [];
    root.WorkHubNotesEngine?.upgrade(d);
    root.WorkHubMyDayEngine.upgrade(d);
    root.WorkHubScheduleEngine?.upgrade(d);
    root.WorkHubReminders?.upgrade(d);
    if (h.headerSubtitle === undefined) h.headerSubtitle = 'Your work, your rhythm.';
    root.WorkHubWorkbench?.upgrade(d);
    root.WorkHubValidatorEngine?.upgrade(d);
    root.WorkHubBatchEngine?.upgrade(d);
    root.WorkHubWorkLibraryEngine?.upgrade(d);
    root.WorkHubProjectStandupEngine?.upgrade(d);
    root.WorkHubProjectPeopleEngine?.upgrade(d);
    root.WorkHubSolutionEngine?.upgrade(d);
    root.WorkHubRehearsalEngine?.upgrade(d);
    root.WorkHubExperienceEngine?.upgrade(d);
    root.WorkHubSapTcodesEngine?.upgrade(d);
    if (h.simulator === undefined)
      h.simulator = {
        quantity: 100,
        price: 10,
        received: 80,
        invoiced: 80,
        invoicePrice: 10,
        tolerance: 2,
      };
    for (const t of d.tasks || []) if (!t.boardStatus) t.boardStatus = t.done ? 'done' : 'todo';
    return d;
  }
  function validate(d) {
    root.WorkHubNotesEngine?.validate(d);
    root.WorkHubMyDayEngine.validate(d);
    root.WorkHubScheduleEngine?.validate(d);
    root.WorkHubWorkbench?.validate(d);
    root.WorkHubValidatorEngine?.validateState(d);
    root.WorkHubBatchEngine?.validate(d);
    root.WorkHubWorkLibraryEngine?.validate(d);
    root.WorkHubProjectStandupEngine?.validate(d);
    root.WorkHubProjectPeopleEngine?.validate(d);
    root.WorkHubSolutionEngine?.validate(d);
    root.WorkHubRehearsalEngine?.validate(d);
    root.WorkHubExperienceEngine?.validate(d);
    root.WorkHubSapTcodesEngine?.validate(d);
    root.WorkHubReminders?.validate(d);
    root.WorkHubProjectDates.validate(d);
    root.WorkHubLeave.validate(d);
    root.WorkHubLeaveBalancesEngine.validate(d);
    root.WorkHubClaimsEngine.validate(d);
    root.WorkHubRecipientsEngine.validate(d);
    const h = d.workhub;
    if (!h || typeof h !== 'object' || Array.isArray(h))
      throw Error('Check the workspace records.');
    function text(v, max = 32767) {
      return (
        typeof v === 'string' &&
        v.length <= max &&
        !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
      );
    }
    for (const k of ['notes', 'processes', 'waiting', 'sessions', 'scrapbook']) {
      if (!Array.isArray(h[k]) || h[k].length > 2000)
        throw Error('The ' + k + ' collection supports up to 2,000 records.');
      const ids = new Set();
      for (const r of h[k]) {
        if (!r || !text(r.id, 100) || !r.id || ids.has(r.id))
          throw Error('Check the ' + k + ' record IDs.');
        ids.add(r.id);
        if (!text(r.title || r.name || '', 500)) throw Error('Check the record title.');
      }
    }
    for (const n of h.notes)
      if (
        !n.title?.trim() ||
        ![
          'body',
          'tags',
          'tcodes',
          'configuration',
          'errors',
          'testing',
          'projectId',
          'ticketId',
          'itemId',
        ].every(k => text(n[k] || ''))
      )
        throw Error('Check the knowledge note.');
    for (const w of h.waiting)
      if (
        !w.title?.trim() ||
        !text(w.person, 200) ||
        !text(w.notes) ||
        typeof w.resolved !== 'boolean' ||
        !/^$|^\d{4}-\d{2}-\d{2}$/.test(w.followUp)
      )
        throw Error('Check the follow-up details.');
    for (const p of h.processes) {
      if (
        !p.name?.trim() ||
        !text(p.description || '') ||
        typeof p.archived !== 'boolean' ||
        !Array.isArray(p.steps) ||
        p.steps.length > 200
      )
        throw Error('Check the process.');
      const ids = new Set(p.steps.map(s => s.id));
      if (ids.size !== p.steps.length) throw Error('Process step IDs must be unique.');
      for (const s of p.steps)
        if (
          !text(s.id, 100) ||
          !s.id ||
          !text(s.title, 500) ||
          !s.title.trim() ||
          ![
            'tcodes',
            'notes',
            'configuration',
            'prerequisites',
            'errors',
            'testing',
            'projectId',
            'ticketId',
            'itemId',
            'noteId',
          ].every(k => text(s[k] || '')) ||
          !Array.isArray(s.next) ||
          s.next.some(id => !ids.has(id))
        )
          throw Error('Check process steps and connections.');
    }
    for (const s of h.sessions)
      if (
        !Number.isFinite(s.seconds) ||
        s.seconds < 0 ||
        s.seconds > 366 * 86400 ||
        ![
          'start',
          'end',
          'notes',
          'kind',
          'linkId',
          'subTaskId',
          'itemId',
          'subItemId',
          'chargeCode',
        ].every(k => text(s[k] || '')) ||
        !TIME_OPTIONS.includes(s.kind) ||
        (s.archived !== undefined && typeof s.archived !== 'boolean')
      )
        throw Error('Check the work session.');
    if (h.headerSubtitle !== undefined && !text(h.headerSubtitle, 200))
      throw Error('Keep the header subtitle within 200 characters.');
    if (
      !Array.isArray(h.ticketClosures) ||
      h.ticketClosures.length > 5000 ||
      new Set(h.ticketClosures.map(x => x.id)).size !== h.ticketClosures.length ||
      h.ticketClosures.some(
        x => !x || typeof x.id !== 'string' || !root.WorkHubReminders.validDate(x.date)
      )
    )
      throw Error('Check ticket closure dates.');
    const p = h.preferences;
    if (
      typeof p?.mascotName !== 'string' ||
      !p.mascotName.trim() ||
      p.mascotName.length > 32 ||
      /[\u0000-\u001f\u007f]/.test(p.mascotName)
    )
      throw Error('Choose a companion name with 1–32 characters on one line.');
    if (
      !p ||
      !['name', 'workspace'].every(k => text(p[k], 200)) ||
      ![...Object.keys(root.WorkHubAppearance.THEMES), 'custom'].includes(p.theme) ||
      !/^#[0-9a-f]{6}$/i.test(p.accent) ||
      ![6, 12, 16, 24].includes(p.radius) ||
      !['system', 'rounded', 'serif'].includes(p.font) ||
      !root.WorkHubAppearance.BACKGROUNDS.some(([id]) => id === p.background) ||
      !['calm', 'playful', 'off'].includes(p.motion) ||
      !['comfortable', 'compact'].includes(p.density) ||
      !['auto', 'smooth', 'full'].includes(p.displayMode) ||
      !root.WorkHubMomoWardrobe.ACCESSORIES.some(([id]) => id === p.accessory) ||
      !['sounds', 'mascot', 'roaming', 'desk'].every(k => typeof p[k] === 'boolean')
    )
      throw Error('Check the theme settings.');
    root.WorkHubAppearance.validate(p);
    root.WorkHubMomoWardrobe.validate(p);
    if (
      !Array.isArray(h.widgets) ||
      h.widgets.length > Object.keys(WIDGETS).length ||
      new Set(h.widgets.map(w => w.id)).size !== h.widgets.length ||
      h.widgets.some(w => !Object.hasOwn(WIDGETS, w.id) || !['wide', 'normal'].includes(w.span))
    )
      throw Error('Check the dashboard layout.');
    for (const k of ['quantity', 'price', 'received', 'invoiced', 'invoicePrice', 'tolerance'])
      if (!Number.isFinite(h.simulator[k]) || h.simulator[k] < 0 || h.simulator[k] > 1e9)
        throw Error('Check simulator values.');
    for (const t of d.tasks || [])
      if (!Object.hasOwn(BOARD, t.boardStatus)) throw Error('Check the task board status.');
  }
  /** Receive the shared application adapter. Submodules use it instead of writing directly to cloud storage. */
  function install(a) {
    let batchA = null,
      validator = null,
      library = null,
      notes = null,
      reader = null,
      batchC = null,
      standup = null,
      people = null,
      solution = null,
      rehearsal = null,
      tcodes = null,
      focusPanel = null,
      life = null,
      atmosphere = null,
      workbench = null,
      soundscape = null,
      moments = null,
      adventures = null,
      claims = null,
      leaveBalances = null,
      tng = null,
      recipients = null,
      settingsPanel = null,
      projectDates = null,
      processDeck = null,
      chromeUX = null,
      myDay = null,
      experience = null,
      wardrobe = null,
      backgrounds = null,
      workSchedule = null;
    const reminders = root.WorkHubReminders?.install({
      ...a,
      hubAction: el => handle(el),
      react: (...args) => react(...args),
    });
    const $ = id => document.getElementById(id),
      data = () => a.state().workhub,
      prefs = () => data().preferences;
    let currentTool = 'theme',
      processId = '',
      stepId = '',
      processArchive = false,
      sessionView = 'active',
      search = '',
      board = false,
      dragId = '',
      walkTimer = 0,
      focus = null,
      petTimer = 0,
      timerDraft = null,
      timerOwner = '',
      viewTab = 'home',
      themePreview = null;
    const focusMinutesKey = 'mm-tracker.focus-minutes.v1',
      validFocusMinutes = n => Number.isInteger(n) && n >= 1 && n <= 1440;
    let focusMinutes = 25;
    try {
      const saved = Number(localStorage.getItem(focusMinutesKey));
      if (validFocusMinutes(saved)) focusMinutes = saved;
    } catch {}
    const now = () => new Date().toISOString(),
      today = () => a.today(),
      dateOf = d =>
        [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0'),
        ].join('-'),
      clock = d =>
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const btn = (action, label, extra = '', cls = '') =>
      `<button type="button" class="${cls}" data-hub="${action}" ${extra}>${label}</button>`;
    const options = (rows, value, blank = 'None') =>
      `<option value="">${esc(blank)}</option>` +
      rows
        .map(
          ([id, label]) =>
            `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(label)}</option>`
        )
        .join('');
    const field = (name, label, value = '', type = 'text', required = false) =>
      `<div class="${type === 'textarea' ? 'wide' : ''}"><label for="hub-${name}">${esc(label)}</label>${type === 'textarea' ? `<textarea id="hub-${name}" name="${name}" maxlength="32767">${esc(value)}</textarea>` : `<input id="hub-${name}" name="${name}" type="${type}" maxlength="${name === 'title' || name === 'name' ? 500 : 200}" value="${esc(value)}"${required ? ' required' : ''}>`}</div>`;
    const select = (name, label, rows, value, blank = 'None') =>
      `<div><label for="hub-${name}">${esc(label)}</label><select name="${name}" id="hub-${name}">${options(rows, value, blank)}</select></div>`;
    const projects = () => a.state().projects.map(p => [p.id, p.name]);
    const projectName = id => a.state().projects.find(p => p.id === id)?.name || 'General';
    function links(r) {
      return (
        select('projectId', 'Related project', projects(), r.projectId) +
        select(
          'ticketId',
          'Related ticket',
          a.state().tickets.map(t => [t.id, t.ticket + ' · ' + t.description]),
          r.ticketId
        ) +
        select(
          'itemId',
          'Related project item',
          a.state().specs.map(t => [t.id, t.description]),
          r.itemId
        )
      );
    }
    function form(title, id, body, recordId = '', extra = '') {
      a.openModal(
        title,
        `<form id="${id}" data-id="${esc(recordId)}"><div class="form-grid">${body}</div>${extra}<div class="modal-actions">${btn('close', 'Cancel')}<button type="submit" class="primary">Save</button></div></form>`
      );
    }
    function save(change, message = 'Saved.') {
      const ok = a.mutate(d => {
        upgrade(d);
        change(d.workhub, d);
      });
      if (ok) {
        a.tell(message);
        react('happy');
      }
      return ok;
    }
    function head(kicker, title, description, actions = '') {
      const home = kicker === 'YOUR PERSONAL WORKSPACE',
        controls = '<div class="actions">' + actions + '</div>';
      return `<div class="hub-head${home ? ' hero-home' : ''}"><div${home ? ' class="hub-hero-copy"' : ''}><span class="hub-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p>${home ? controls : ''}</div>${home ? heroArt() : controls}</div>`;
    }
    function empty(title, text, action = '') {
      return `<div class="hub-empty"><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
    }
    let paletteKey = '';
    function applyTheme(p = themePreview || prefs()) {
      // Colour resolution reads computed styles and rewrites inherited tokens. Ordinary
      // saves/navigation reuse the resolved palette; real previews/account changes apply now.
      const key = JSON.stringify([
        a.cloud().ready,
        a.cloud().user?.id,
        p.theme,
        p.accent,
        p.colors,
      ]);
      if (paletteKey !== key || document.body.dataset.hubTheme !== p.theme) {
        root.WorkHubAppearance.apply(p);
        paletteKey = key;
      }
      root.WorkHubRenderProfile?.setMode(p.displayMode);
      dataValue(document.body, 'hubTheme', p.theme);
      dataValue(document.body, 'motion', p.motion);
      dataValue(document.body, 'density', p.density);
      dataValue(document.body, 'hubBackground', p.background);
      styleValue(document.documentElement, '--hub-radius', p.radius + 'px');
      styleValue(
        document.documentElement,
        '--hub-font',
        p.font === 'serif'
          ? 'Georgia,serif'
          : p.font === 'rounded'
            ? '"Trebuchet MS",system-ui,sans-serif'
            : 'system-ui,-apple-system,"Segoe UI",sans-serif'
      );
      if ($('hubPet')) $('hubPet').hidden = !p.mascot || !a.cloud().ready;
      root.WorkHubMomoWardrobe.apply(p, a.cloud().user?.id || '');
      if (!p.roaming || !p.mascot || p.motion === 'off') stopCompanionWalk();
      atmosphere?.sync();
    }
    function confetti() {
      if (experience?.celebrate()) {
        chime();
        return;
      }
      if (prefs().motion === 'off' || root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        return;
      const box = document.createElement('div');
      box.className = 'hub-confetti';
      box.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 22; i++) {
        const s = document.createElement('span');
        s.style.cssText = `left:${Math.random() * 100}vw;animation-delay:${Math.random() * 0.3}s;background:${['#2563eb', '#22b89a', '#ffbc63', '#f87894'][i % 4]}`;
        box.append(s);
      }
      document.body.append(box);
      setTimeout(() => box.remove(), 2500);
      chime();
    }
    function chime() {
      if (!prefs().sounds) return;
      try {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        const c = new AC(),
          o = c.createOscillator(),
          g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.frequency.setValueAtTime(660, c.currentTime);
        o.frequency.linearRampToValueAtTime(880, c.currentTime + 0.13);
        g.gain.setValueAtTime(0.035, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
        o.start();
        o.stop(c.currentTime + 0.3);
        o.onended = () => void c.close();
      } catch {}
    }
    function react(mood = 'busy', message = '', duration = 4000) {
      if (life?.sleeping?.()) return;
      document.body.dataset.mascotMood = mood;
      if (
        ![
          'stumble',
          'sneeze',
          'wink',
          'blep',
          'shy',
          'held',
          'land',
          'nap',
          'startled',
          'annoyed',
          'idle-sleep',
          'idle-sit',
        ].includes($('hubPet')?.dataset.pose)
      )
        life?.express(mood === 'happy' ? 'delighted' : mood === 'sleep' ? 'sleepy' : 'curious');
      clearTimeout(petTimer);
      const b = $('hubPetBubble');
      if (b) {
        b.textContent =
          message ||
          {
            happy: 'A little progress. A little celebration.',
            busy: 'One thing at a time. You’ve got this.',
            sleep: 'Taking a quiet moment.',
          }[mood];
        b.hidden = !message;
      }
      petTimer = setTimeout(() => {
        document.body.dataset.mascotMood = 'idle';
        if (b) b.hidden = true;
      }, duration);
    }
    // Keep the companion in viewport space, independently of page height or CSS loading.
    const petPositionKey = 'mm-tracker.companion-position.v1';
    let petPosition = { x: 1, y: 0.42 },
      petDrag = null,
      companionPinned = false,
      petSuppressClickUntil = 0,
      petWalk = null,
      petFrame = 0,
      petNextWalk = 0,
      petStation = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(petPositionKey) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        companionPinned = saved.pinned === true;
        petPosition = {
          x: Math.min(1, Math.max(0, saved.x)),
          y: Math.min(1, Math.max(0, saved.y)),
        };
      }
    } catch {}
    function companionBounds() {
      const v = root.visualViewport,
        width = v?.width || root.innerWidth || document.documentElement.clientWidth || 375,
        height = v?.height || root.innerHeight || document.documentElement.clientHeight || 667;
      const margin = 12,
        umbrella = $('hubPet')?.dataset.umbrella === 'true',
        overhead = umbrella ? 0.48 : 0,
        right = umbrella ? 0.08 : 0,
        size = Math.max(
          16,
          Math.min(
            width < 600 ? 112 : 144,
            (width - margin * 2) / (1 + right * 2),
            (height - margin * 2) / (1 + overhead)
          )
        );
      return {
        left: (v?.offsetLeft || 0) + margin + size * right,
        top: (v?.offsetTop || 0) + margin + size * overhead,
        width: Math.max(0, width - size * (1 + right * 2) - margin * 2),
        height: Math.max(0, height - size * (1 + overhead) - margin * 2),
        size,
        viewportWidth: width,
      };
    }
    function positionCompanion(pixels = null) {
      const pet = $('hubPet');
      if (!pet) return;
      const before = { x: parseFloat(pet.style.left) || 0, y: parseFloat(pet.style.top) || 0 };
      const b = companionBounds();
      if (pixels)
        petPosition = {
          x: b.width ? Math.min(1, Math.max(0, (pixels.x - b.left) / b.width)) : 0,
          y: b.height ? Math.min(1, Math.max(0, (pixels.y - b.top) / b.height)) : 0,
        };
      const left = b.left + petPosition.x * b.width,
        top = b.top + petPosition.y * b.height;
      styleValues(pet, {
        position: 'fixed',
        left: left + 'px',
        top: top + 'px',
        right: 'auto',
        bottom: 'auto',
        width: b.size + 'px',
        height: b.size + 'px',
        zIndex: '90',
        padding: '0px',
        border: '0px',
        background: 'transparent',
        boxShadow: 'none',
      });
      const svg = pet.querySelector('svg');
      if (svg) styleValues(svg, { width: '100%', height: '100%', display: 'block' });
      const button = pet.querySelector('button');
      if (button)
        styleValues(button, {
          width: '100%',
          height: '100%',
          padding: '0px',
          border: '0px',
          background: 'transparent',
          boxShadow: 'none',
          touchAction: 'none',
          cursor: petDrag ? 'grabbing' : 'grab',
        });
      const bubble = $('hubPetBubble'),
        bubbleWidth = Math.min(240, b.viewportWidth - 24),
        bubbleLeft = Math.max(
          b.left,
          Math.min(b.left + b.viewportWidth - 24 - bubbleWidth, left + b.size / 2 - bubbleWidth / 2)
        );
      if (bubble)
        styleValues(bubble, {
          position: 'absolute',
          width: bubbleWidth + 'px',
          maxWidth: 'none',
          left: bubbleLeft - left + 'px',
          right: 'auto',
          top: top - b.top < 110 ? 'calc(100% + 10px)' : 'auto',
          bottom: top - b.top < 110 ? 'auto' : 'calc(100% + 10px)',
        });
      dataValue(pet, 'positionPinned', companionPinned);
      life?.layout();
      adventures?.moved(before, { x: left, y: top });
    }
    function rememberCompanion() {
      try {
        localStorage.setItem(
          petPositionKey,
          JSON.stringify({ ...petPosition, pinned: companionPinned })
        );
      } catch {}
    }
    function pinCompanion(value) {
      stopCompanionWalk();
      moments?.finish(false);
      adventures?.finish(false);
      life?.manualMove();
      companionPinned = value;
      rememberCompanion();
      if ($('hubPet')) $('hubPet').dataset.positionPinned = String(value);
      petNextWalk = Date.now() + 20000;
    }
    document.addEventListener('pointerdown', event => {
      const button = event.target.closest?.('#hubPet > button');
      if (!button || event.button > 0) return;
      moments?.finish(false);
      adventures?.finish(false);
      stopCompanionWalk();
      petNextWalk = Date.now() + 20000;
      const pet = $('hubPet');
      petDrag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: parseFloat(pet.style.left),
        top: parseFloat(pet.style.top),
        moved: false,
        button,
      };
      try {
        button.setPointerCapture?.(event.pointerId);
      } catch {}
    });
    document.addEventListener(
      'pointermove',
      event => {
        if (!petDrag || event.pointerId !== petDrag.id) return;
        const dx = event.clientX - petDrag.startX,
          dy = event.clientY - petDrag.startY;
        if (!petDrag.moved && Math.hypot(dx, dy) < 6) return;
        petDrag.moved = true;
        event.preventDefault();
        positionCompanion({ x: petDrag.left + dx, y: petDrag.top + dy });
      },
      { passive: false }
    );
    function endCompanionDrag(event) {
      if (!petDrag || event.pointerId !== petDrag.id) return;
      const drag = petDrag;
      petDrag = null;
      if (drag.moved) {
        petSuppressClickUntil = Date.now() + 600;
        pinCompanion(true);
      }
      try {
        drag.button.releasePointerCapture?.(event.pointerId);
      } catch {}
      positionCompanion();
    }
    document.addEventListener('pointerup', endCompanionDrag);
    document.addEventListener('pointercancel', endCompanionDrag);
    document.addEventListener('lostpointercapture', endCompanionDrag);
    document.addEventListener('keydown', event => {
      if (
        !event.target.closest?.('#hubPet > button') ||
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      )
        return;
      event.preventDefault();
      if (life?.sleeping()) return;
      pinCompanion(true);
      petNextWalk = Date.now() + 20000;
      const pet = $('hubPet'),
        step = event.shiftKey ? 32 : 12;
      positionCompanion({
        x:
          parseFloat(pet.style.left) +
          (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y:
          parseFloat(pet.style.top) +
          (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      });
      rememberCompanion();
    });
    function stopCompanionWalk() {
      petWalk = null;
      if (petFrame) root.cancelAnimationFrame(petFrame);
      petFrame = 0;
      dataValue($('hubPet'), 'roaming', false);
    }
    function canCompanionWalk() {
      const p = themePreview || prefs(),
        pet = $('hubPet');
      return (
        !life?.busy() &&
        !document.body.classList.contains('lab-drag-active') &&
        a.cloud().ready &&
        p.mascot &&
        p.roaming &&
        !companionPinned &&
        p.motion !== 'off' &&
        !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
        !document.hidden &&
        !document.body.classList.contains('hub-present') &&
        !petDrag &&
        !timerDrag &&
        !document.querySelector('dialog[open]') &&
        !document.activeElement?.matches(
          'input,select,textarea,[contenteditable="true"],#hubPet button'
        ) &&
        pet &&
        !pet.hidden
      );
    }
    function tickCompanion() {
      if (!canCompanionWalk()) {
        stopCompanionWalk();
        return;
      }
      if (petWalk || Date.now() < petNextWalk) return;
      const stations = [
        [1, 0.24],
        [1, 0.67],
        [0.66, 0.86],
        [0.15, 0.86],
        [0, 0.6],
        [0, 0.23],
        [0.38, 0.16],
        [0.82, 0.18],
      ];
      const target = stations[petStation++ % stations.length];
      if (Math.hypot(target[0] - petPosition.x, target[1] - petPosition.y) < 0.1) {
        petNextWalk = Date.now() + 1000;
        return;
      }
      const p = themePreview || prefs(),
        duration = p.motion === 'playful' ? 3200 : 5200;
      petWalk = {
        from: { ...petPosition },
        to: { x: target[0], y: target[1] },
        start: root.performance.now(),
        duration,
      };
      $('hubPet').dataset.roaming = 'true';
      $('hubPet').dataset.facing = target[0] < petPosition.x ? 'left' : 'right';
      document.body.dataset.mascotMood = 'idle';
      function frame(time) {
        if (!petWalk || !canCompanionWalk()) {
          stopCompanionWalk();
          return;
        }
        const walk = petWalk,
          t = Math.min(1, Math.max(0, (time - walk.start) / walk.duration)),
          ease = t * t * (3 - 2 * t);
        petPosition = {
          x: walk.from.x + (walk.to.x - walk.from.x) * ease,
          y: walk.from.y + (walk.to.y - walk.from.y) * ease,
        };
        positionCompanion();
        if (t < 1) petFrame = root.requestAnimationFrame(frame);
        else {
          stopCompanionWalk();
          petNextWalk = Date.now() + (p.motion === 'playful' ? 4500 : 9000);
        }
      }
      petFrame = root.requestAnimationFrame(frame);
    }
    const resizeFloaters = () => {
      positionCompanion();
      positionTimer();
    };
    root.addEventListener('resize', resizeFloaters);
    root.visualViewport?.addEventListener('resize', resizeFloaters);
    root.visualViewport?.addEventListener('scroll', resizeFloaters);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopCompanionWalk();
        if (petDrag) endCompanionDrag({ pointerId: petDrag.id });
      }
    });
    document.addEventListener('focusin', () => {
      if (!canCompanionWalk()) stopCompanionWalk();
    });
    document.addEventListener(
      'pointerover',
      event => {
        if (event.target.closest?.('#hubPet')) {
          stopCompanionWalk();
          petNextWalk = Date.now() + 8000;
        }
      },
      { passive: true }
    );
    function icon(name) {
      const paths = {
        snippets: 'M4 4h16v16H4V4M8 8h8M8 12h8M8 16h5',
        validator: 'M4 4h16v16H4V4M4 9h16M9 9v11m4-7 2 2 4-4',
        home: 'M3 10l9-7 9 7M5 9v11h14V9M9 20v-7h6v7',
        tickets: 'M4 5h16v5a2 2 0 000 4v5H4v-5a2 2 0 000-4V5M15 5v3m0 3v2m0 3v3',
        tasks: 'M8 6h13M8 12h13M8 18h13M2 6l1 1 2-2M2 12l1 1 2-2M2 18l1 1 2-2',
        schedule: 'M4 5h16v16H4V5M8 2v6M16 2v6M4 10h16M8 14h3m3 3h3',
        specs: 'M3 7h7l2-3h9v16H3V7M3 10h18',
        notes: 'M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2 0v18M9 8h7M9 12h5',
        knowledge: 'M12 5c-3-3-7-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-2-10 1v15',
        processhub: 'M8 3h8v5H8V3M4 16h6v5H4v-5M15 16h6v5h-6v-5M12 8v4M7 16v-4h11v4',
        waiting: 'M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4',
        studio: 'M12 3l2.5 6 6.5 3-6.5 3-2.5 6-2.5-6L3 12l6.5-3L12 3',
        drag: 'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',
      };
      return (
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
        (paths[name] || paths.studio) +
        '"/></svg>'
      );
    }
    function mountShell() {
      const header = document.querySelector('body > header');
      if (header) {
        header.id = 'hubHeader';
        let brand = header.querySelector('.hub-header-brand');
        if (!brand) {
          brand = header.firstElementChild;
          brand.className = 'hub-header-brand';
          brand.innerHTML =
            '<span class="hub-brand-mark">' +
            icon('studio') +
            '</span><div class="hub-header-copy"><h1 id="hubSiteTitle"></h1><p id="hubSiteSubtitle"></p></div>';
        }
        const title = $('hubSiteTitle');
        if (title.dataset.brandTitle !== prefs().workspace) {
          title.dataset.brandTitle = prefs().workspace;
          title.textContent = prefs().workspace;
        }
        root.WorkHubBrandMotion?.mount(brand, title, () => a.navigate('home'));
        if (a.cloud().ready) {
          root.WorkHubStartup?.name(prefs().workspace);
          root.WorkHubStartup?.appearance(prefs());
        }
        $('hubSiteSubtitle').textContent = data().headerSubtitle || '';
        if (a.cloud().ready || !document.documentElement.hasAttribute('data-workhub-startup'))
          document.title = prefs().workspace;
        const settings = header.querySelector('.settings-panel');
        if (settings && !$('hubSettingsHeader')) {
          const group = document.createElement('div');
          group.id = 'hubSettingsAppearance';
          group.innerHTML =
            btn('header-edit', 'Edit header', 'id="hubSettingsHeader"') +
            btn('tool', 'Appearance & motion', 'data-tool="theme"');
          settings.querySelector('.settings-status').after(group);
        }
        if ($('hubSettingsAppearance')) $('hubSettingsAppearance').hidden = !a.cloud().ready;
      }
      const page = document.querySelector('main.page');
      if (!page) return;
      let shell = $('hubShell');
      if (!shell) {
        shell = document.createElement('div');
        shell.id = 'hubShell';
        page.before(shell);
        shell.append(page);
        const side = document.createElement('aside');
        side.className = 'hub-sidebar';
        side.id = 'hubSidebar';
        side.innerHTML =
          '<div class="hub-side-intro"><span class="hub-kicker">YOUR WORKSPACE</span><p>A good place to make things happen.</p></div><div class="hub-side-note"><span>✦</span> Small steps count.</div>';
        shell.prepend(side);
        side.insertBefore($('tabs'), side.lastElementChild);
      }
      $('hubSidebar').hidden = !a.cloud().ready;
      shell.dataset.ready = String(a.cloud().ready);
      const bar = $('hubToolbar');
      if (bar && bar.parentElement !== page) page.insertBefore(bar, $('view'));
      const names = {
        home: 'My day',
        tickets: 'Tickets',
        tasks: 'Tasks',
        schedule: 'Schedule',
        specs: 'Projects',
        notes: 'Notes',
        knowledge: 'Knowledge',
        processhub: 'Process Hub',
        waiting: 'Waiting on',
        studio: 'Studio',
        lab: 'Troubleshooting lab',
        validator: 'Validation Studio',
        snippets: 'Snippets',
      };
      for (const b of $('tabs').querySelectorAll('[data-tab]')) {
        const key = b.dataset.tab;
        if (!names[key]) continue;
        if (b.querySelector('.hub-nav-label')?.textContent !== names[key])
          b.innerHTML =
            '<span class="hub-nav-icon">' +
            icon(key) +
            '</span><span class="hub-nav-label">' +
            names[key] +
            '</span>';
        if (key === 'specs') {
          const title = 'Projects · ' + projectName(a.state().activeProjectId);
          if (b.title !== title) b.title = title;
        }
      }
    }
    function syncViewModes() {
      if (!a.cloud().ready) document.body.classList.remove('hub-private', 'hub-present');
      const privacy = document.body.classList.contains('hub-private'),
        present = document.body.classList.contains('hub-present');
      const sensitive =
        '#view .hub-row strong,#view .hub-row small,#view .hub-card > h3,#view .hub-card > p,#view .hub-detail p,#view .hub-detail h3,#view .hub-step strong,#view .hub-connector span,#view .hub-task h4,#view .ticket-title,#view .task-title,#view .task-main-title,#view .task-subtitle,#view .project-banner h2,#view .item-title,#view .calendar-event,#view .slot,#view .schedule-entry-title';
      document.querySelectorAll(sensitive).forEach(el => el.classList.add('hub-sensitive'));
      for (const button of document.querySelectorAll('[data-hub="privacy"]')) {
        button.setAttribute('aria-pressed', String(privacy));
        if (button.closest('#hubToolbar'))
          button.textContent = privacy ? '◉ Privacy on' : '◉ Privacy';
      }
      for (const button of document.querySelectorAll('[data-hub="presentation"]'))
        button.setAttribute('aria-pressed', String(present));
      let status = $('hubViewStatus');
      if (privacy && a.cloud().ready) {
        if (!status) {
          status = document.createElement('div');
          status.id = 'hubViewStatus';
          status.className = 'hub-view-status';
          status.setAttribute('role', 'status');
          $('view').before(status);
        }
        status.innerHTML =
          '<span><strong>Privacy is on</strong> Record details are blurred on this screen.</span>' +
          btn('privacy', 'Show details', '', 'hub-mode-exit');
      } else status?.remove();
      let exit = $('hubExitPresentation');
      if (present && !exit) {
        exit = document.createElement('button');
        exit.id = 'hubExitPresentation';
        exit.dataset.hub = 'presentation';
        exit.textContent = 'Exit presentation';
        exit.className = 'hub-exit-presentation';
        exit.setAttribute('aria-pressed', 'true');
        document.body.append(exit);
      }
      if (!present) exit?.remove();
      if (present) stopCompanionWalk();
      atmosphere?.sync();
      myDay?.visual?.sync();
    }
    function heroArt() {
      return '<div class="hub-hero-art" aria-hidden="true"><svg viewBox="0 0 280 170" fill="none"><ellipse cx="150" cy="145" rx="103" ry="12" fill="#d9e2df"/><circle cx="206" cy="61" r="46" fill="#f8dba4"/><rect x="45" y="41" width="114" height="99" rx="12" transform="rotate(-9 45 41)" fill="#c8dfd6" stroke="#456d68" stroke-width="2"/><rect x="75" y="27" width="118" height="114" rx="12" transform="rotate(8 75 27)" fill="#fffef7" stroke="#2c4359" stroke-width="2"/><path d="M96 57l5 5 10-12M95 82l5 5 10-12M95 107l5 5 10-12" stroke="#328976" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M124 57h43M122 82h40M121 107h28" stroke="#9baab5" stroke-width="4" stroke-linecap="round"/><path d="M204 139v-35M204 111c-28-3-30-22-22-28 13-7 24 10 22 28zM204 101c-1-25 19-29 26-20 7 12-9 22-26 20z" stroke="#366d5b" stroke-width="2" fill="#8bc5a3"/><path d="M188 121h33l-5 24h-23z" fill="#dd967e" stroke="#734f48" stroke-width="2"/><path d="M43 24l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8zM239 25l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" fill="#8d7dcb"/><circle cx="241" cy="117" r="4" fill="#e7b26d"/></svg></div>';
    }
    function mountChrome() {
      if (!$('hubPet')) {
        const pet = document.createElement('aside');
        pet.id = 'hubPet';
        pet.className = 'hub-pet';
        pet.innerHTML =
          '<div id="hubPetBubble" class="hub-pet-bubble" hidden></div><button type="button" data-hub="pet" aria-label="Momo, your floating companion. Drag to pick up, tap for play controls, or use arrow keys." title="Drag to pick up · tap to play">' +
          root.WorkHubMomoArt.svg(prefs().accessory) +
          '</button>';
        document.body.append(pet);
        root.WorkHubMomoArt.mount(pet);
      }

      if (!$('hubToolbar')) {
        const bar = document.createElement('div');
        bar.id = 'hubToolbar';
        bar.className = 'hub-toolbar hub-private-only';
        bar.innerHTML =
          btn('commands', '⌕ Search & commands', 'aria-label="Search records and commands"') +
          btn('quick', '＋ Quick add') +
          btn('timer-new', '◷ Start timer') +
          btn('privacy', '◉ Privacy', 'aria-pressed="false"') +
          btn('presentation', '▣ Present', 'aria-pressed="false"');
        $('tabs').before(bar);
      }
      const extra = {
        home: '⌂ My day',
        notes: 'Notes',
        knowledge: 'Knowledge',
        processhub: 'Process Hub',
        waiting: 'Waiting on',
        studio: 'Studio',
        lab: 'Troubleshooting lab',
        validator: 'Validation Studio',
        snippets: 'Snippets',
      };
      for (const [id, label] of Object.entries(extra))
        if (!$('tabs').querySelector(`[data-tab="${id}"]`)) {
          const b = document.createElement('button');
          b.dataset.tab = id;
          b.textContent = label;
          if (id === 'home') $('tabs').prepend(b);
          else $('tabs').append(b);
        }
      mountShell();
      const toolbar = $('hubToolbar');
      toolbar.hidden = !a.cloud().ready;
      positionCompanion();
      if (!a.cloud().ready) themePreview = null;
      applyTheme();
      if (a.cloud().ready) recoverTimer();
      else {
        timerOwner = '';
        timerDraft = null;
        undo = null;
        $('hubUndo')?.remove();
      }
      renderTimerBar();
      syncViewModes();
      life?.mount();
      atmosphere?.mount();
      workbench?.decorate();
      soundscape?.mount();
      moments?.mount();
    }
    function desk() {
      const completed = a.state().tasks.filter(t => t.done).length,
        level = Math.min(5, 1 + Math.floor(completed / 3));
      return `<div class="hub-desk"><div class="desk-scene" aria-label="Your growing workspace, level ${level}"><div class="desk-shelf">${Array.from({ length: level + 1 }, (_, i) => `<i class="desk-book" style="--book:${i}"></i>`).join('')}</div><div class="desk-lamp"></div><div class="desk-plant"><i></i><i></i><i></i></div><span>${esc(prefs().workspace)}</span></div><div class="hub-meta">Workspace level ${level} · ${completed} completed tasks. Your space grows; there are no streak penalties.</div>${btn('tool', 'Decorate your space', 'data-tool="theme"', 'small')}</div>`;
    }
    function journey() {
      const p =
          a.state().projects.find(p => p.id === a.state().activeProjectId) || a.state().projects[0],
        phases = a.state().lists.projectPhases,
        i = phases.indexOf(p.phase);
      return `<h3>${esc(p.name)}</h3><div class="hub-journey">${phases.map((phase, n) => `<div class="hub-phase ${n < i ? 'done' : n === i ? 'current' : ''}"><span>${n < i ? '✓' : n + 1}</span><strong>${esc(phase)}</strong></div>`).join('')}</div>${btn('project', 'Open project', 'data-id="' + esc(p.id) + '"', 'small')}`;
    }
    function widget(id) {
      if (Object.hasOwn(root.WorkHubMyDayEngine.WIDGETS, id)) return myDay?.widget(id) || '';
      const s = a.state(),
        open = s.tasks.filter(
          t => !t.done && !t.archived && !root.WorkHubReminders.isSnoozed(s, 'tasks', t.id, today())
        ),
        waiting = data().waiting.filter(w => !w.resolved),
        done = s.tasks.filter(t => t.done && t.doneDate === today()),
        entries = a.entries(today());
      if (id === 'today')
        return `<div class="hub-stats"><div><span>Open tasks</span><strong>${open.length}</strong></div><div><span>Today’s activities</span><strong>${entries.length}</strong></div><div><span>Waiting on</span><strong>${waiting.length}</strong></div><div><span>Done today</span><strong>${done.length}</strong></div></div><div class="hub-list">${
          entries
            .slice(0, 4)
            .map(
              e =>
                `<div class="hub-row"><span class="hub-badge">${esc(e.time)}–${esc(e.endTime)}</span><strong>${esc(a.entryTitle(e))}</strong>${btn('booking', 'View', 'data-date="' + today() + '" data-time="' + e.time + '"', 'small')}</div>`
            )
            .join('') || '<p class="hub-meta">Room to plan your day.</p>'
        }</div>`;
      if (id === 'tasks')
        return `<div class="hub-list">${
          open
            .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
            .slice(0, 5)
            .map(
              t =>
                `<div class="hub-row"><span><strong class="hub-sensitive">${esc(t.task)}</strong><small>${esc(t.dueDate) || 'No due date'} · ${esc(t.priority)}</small></span>${btn('task-detail', 'Open', 'data-id="' + esc(t.id) + '"', 'small')}</div>`
            )
            .join('') ||
          empty('A clear list', 'Add a task when you’re ready.', btn('new-task', 'Add task'))
        }</div>`;
      if (id === 'waiting')
        return `<div class="hub-list">${
          waiting
            .sort((a, b) => (a.followUp || '9999').localeCompare(b.followUp || '9999'))
            .slice(0, 4)
            .map(
              w =>
                `<div class="hub-row"><span><strong class="hub-sensitive">${esc(w.title)}</strong><small>${esc(w.person) || 'Someone'} · ${esc(w.followUp) || 'No follow-up date'}</small></span>${btn('waiting-edit', 'Open', 'data-id="' + esc(w.id) + '"', 'small')}</div>`
            )
            .join('') ||
          empty(
            'Nothing waiting',
            'Keep your follow-ups in one place.',
            btn('waiting-edit', 'Add follow-up')
          )
        }</div>`;
      if (id === 'journey') return journey();
      if (id === 'desk') return desk();
      if (id === 'achievements')
        return `<p class="hub-result">${done.length ? '✦ ' + done.length + ' task' + (done.length === 1 ? '' : 's') + ' completed today' : 'Every small step counts.'}</p><p class="hub-meta">${data().sessions.filter(x => x.start.slice(0, 10) === today()).length} work sessions recorded · ${s.tasks.reduce((n, t) => n + (t.subTasks || []).filter(x => x.status === 'Completed').length, 0)} subtasks complete</p>${btn('celebrate', 'A little celebration', '', 'small')}`;
      if (id === 'knowledge')
        return `${empty('Make knowledge easy to find', 'Keep useful fixes, T-codes and testing notes.', btn('navigate', 'Open notebook', 'data-tab="knowledge"'))}`;
      return '';
    }
    function dashboard() {
      const symbols = {
        today: '◷',
        tasks: '✓',
        waiting: '↗',
        journey: '⚑',
        achievements: '✦',
        desk: '❀',
        focus: '◉',
        knowledge: '▤',
      };
      return `<section class="hub my-day-page">${myDay.hero()}${myDay.toolbar()}<div class="hub-layout">${data()
        .widgets.filter(w => w.id !== 'focus' && (w.id !== 'desk' || prefs().desk))
        .map(w => {
          const handle = `<button type="button" class="hub-drag-handle" data-hub="drag-help" data-hub-drag="widget" aria-label="Drag ${WIDGETS[w.id]} to rearrange, or use up and down arrow keys" title="Drag to rearrange">${icon('drag')}</button>`;
          const controls =
            btn(
              'widget-up',
              '↑',
              'data-id="' + w.id + '" aria-label="Move ' + WIDGETS[w.id] + ' up"',
              'small'
            ) +
            btn(
              'widget-size',
              w.span === 'wide' ? '↙' : '↔',
              'data-id="' + w.id + '" aria-label="Resize ' + WIDGETS[w.id] + '"',
              'small'
            );
          return myDay.wrapper(
            w.id,
            WIDGETS[w.id],
            symbols[w.id] || root.WorkHubMyDayEngine.WIDGETS[w.id]?.[1] || '✧',
            w.span,
            widget(w.id),
            handle,
            controls
          );
        })
        .join('')}</div></section>`;
    }
    function layoutEditor() {
      form(
        'Arrange your dashboard',
        'hubLayout',
        `<div class="wide"><p>Drag widgets on My day to reorder them, or use their arrow buttons. Choose which widgets to show.</p>${Object.entries(
          WIDGETS
        )
          .filter(([id]) => id !== 'focus')
          .map(
            ([id, label]) =>
              `<label class="check-label"><input type="checkbox" name="widget" value="${id}"${data().widgets.some(w => w.id === id) ? ' checked' : ''}>${label}</label>`
          )
          .join('')}</div>`
      );
    }
    function knowledge() {
      const rows = data().notes.filter(
        n =>
          (n.title + ' ' + n.body + ' ' + n.tags + ' ' + n.tcodes + ' ' + n.errors)
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!batchA || batchA.matches('notes', n.id))
      );
      return `<section class="hub">${head('YOUR SAP MM REFERENCE', 'Knowledge notebook', 'Keep the solution. Find it the next time.', btn('note-edit', '＋ New note', '', 'primary'))}<div class="hub-toolbar"><input id="hubSearch" type="search" value="${esc(search)}" placeholder="Search titles, tags, T-codes and solutions" aria-label="Search knowledge"></div><div class="hub-grid">${rows.map(n => `<article class="hub-card"><span class="hub-kicker">${esc(n.tags) || 'KNOWLEDGE NOTE'}</span><h3 class="hub-sensitive">${esc(n.title)}</h3><p>${esc(n.body.slice(0, 180))}${n.body.length > 180 ? '…' : ''}</p><div class="hub-tags"><span class="hub-badge">${esc(n.tcodes) || 'No T-code'}</span><span class="hub-meta">${esc(projectName(n.projectId))}</span></div><div class="actions">${btn('note-view', 'Read note', 'data-id="' + esc(n.id) + '"')}${btn('note-edit', 'Edit', 'data-id="' + esc(n.id) + '"', 'small')}</div></article>`).join('') || empty('Your own reference library', 'Add a fix, configuration note, test checklist or T-code reference.', btn('note-edit', 'Create your first note'))}</div></section>`;
    }
    function noteEditor(id = '') {
      const n = data().notes.find(n => n.id === id) || {};
      form(
        id ? 'Edit knowledge note' : 'New knowledge note',
        'hubNote',
        field('title', 'Title', n.title, 'text', true) +
          field('tags', 'Tags, separated by commas', n.tags) +
          field('tcodes', 'T-codes', n.tcodes) +
          field('body', 'Situation, cause and solution', n.body, 'textarea') +
          field('configuration', 'Configuration / SPRO paths', n.configuration, 'textarea') +
          field('errors', 'Common errors and resolutions', n.errors, 'textarea') +
          field('testing', 'Testing checklist', n.testing, 'textarea') +
          links(n),
        id,
        id ? btn('note-delete', 'Delete note', 'data-id="' + esc(id) + '"', 'danger') : ''
      );
    }
    function recordLinks(r) {
      const s = a.state();
      return `<div class="hub-tags">${r.projectId && s.projects.some(x => x.id === r.projectId) ? btn('project', esc(projectName(r.projectId)), 'data-id="' + esc(r.projectId) + '"', 'small') : ''}${r.ticketId && s.tickets.some(x => x.id === r.ticketId) ? btn('ticket', 'Open ticket', 'data-id="' + esc(r.ticketId) + '"', 'small') : ''}${r.itemId && s.specs.some(x => x.id === r.itemId) ? btn('item', 'Open project item', 'data-id="' + esc(r.itemId) + '"', 'small') : ''}${r.noteId && data().notes.some(x => x.id === r.noteId) ? btn('note-view', 'Read knowledge note', 'data-id="' + esc(r.noteId) + '"', 'small') : ''}${r.labCaseId && data().lab.some(c => c.id === r.labCaseId) ? '<button type="button" data-bench="open" data-kind="lab" data-id="' + esc(r.labCaseId) + '">Return to investigation board ↗</button>' : ''}</div>`;
    }
    function viewNote(id) {
      const n = data().notes.find(n => n.id === id);
      if (!n) throw Error('Note no longer exists.');
      a.openModal(
        n.title,
        `<div class="hub-detail"><span class="hub-kicker">${esc(n.tags)}</span><p class="hub-badge">${esc(n.tcodes) || 'Reference note'}</p>${[
          ['Situation, cause and solution', n.body],
          ['Configuration', n.configuration],
          ['Common errors', n.errors],
          ['Testing checklist', n.testing],
        ]
          .map(([label, v]) =>
            v
              ? `<section><h3>${label}</h3><p class="prewrap hub-sensitive">${esc(v)}</p></section>`
              : ''
          )
          .join(
            ''
          )}${recordLinks(n)}<div class="actions">${btn('note-edit', 'Edit note', 'data-id="' + esc(id) + '"')}${btn('note-copy', 'Copy note', 'data-id="' + esc(id) + '"')}</div></div>`
      );
    }
    function waiting() {
      const rows = data().waiting.filter(w =>
        (w.title + ' ' + w.person + ' ' + w.notes).toLowerCase().includes(search.toLowerCase())
      );
      return `<section class="hub">${head('KEEP FOLLOW-UPS MOVING', 'Waiting on', 'A clear place for things that need someone else.', btn('waiting-edit', '＋ Add follow-up', '', 'primary'))}<div class="hub-toolbar"><input id="hubSearch" type="search" value="${esc(search)}" placeholder="Search follow-ups or people" aria-label="Search follow-ups"></div><div class="hub-grid">${
        rows
          .sort(
            (a, b) =>
              Number(a.resolved) - Number(b.resolved) ||
              (a.followUp || '9999').localeCompare(b.followUp || '9999')
          )
          .map(
            w =>
              `<article class="hub-card"><div class="flex-title"><span class="hub-badge">${w.resolved ? '✓ Received' : w.followUp && w.followUp <= today() ? 'Follow up now' : 'Waiting'}</span><span class="hub-meta">${esc(w.followUp) || 'No date'}</span></div><h3 class="hub-sensitive">${esc(w.title)}</h3><p>Waiting on <strong>${esc(w.person) || 'Not specified'}</strong></p><p class="prewrap">${esc(w.notes)}</p><p class="hub-meta">${esc(projectName(w.projectId))}</p><div class="actions">${btn('waiting-toggle', w.resolved ? 'Reopen' : '✓ Received', 'data-id="' + esc(w.id) + '"', w.resolved ? '' : 'primary')}${btn('waiting-edit', 'Edit', 'data-id="' + esc(w.id) + '"', 'small')}${btn('waiting-delete', 'Delete', 'data-id="' + esc(w.id) + '"', 'small danger')}</div></article>`
          )
          .join('') ||
        empty(
          'No loose ends',
          'Record a person, a follow-up date and the next thing you need.',
          btn('waiting-edit', 'Add follow-up')
        )
      }</div></section>`;
    }
    function waitingEditor(id = '') {
      const w = data().waiting.find(w => w.id === id) || {};
      form(
        id ? 'Edit follow-up' : 'Waiting on…',
        'hubWaiting',
        field('title', 'What are you waiting for?', w.title, 'text', true) +
          field('person', 'Person or team', w.person) +
          field('followUp', 'Follow-up date', w.followUp, 'date') +
          select('projectId', 'Project', projects(), w.projectId) +
          field('notes', 'Notes / next step', w.notes, 'textarea'),
        id
      );
    }
    function taskStatus(t) {
      return t.done ? 'done' : t.boardStatus === 'done' ? 'todo' : t.boardStatus || 'todo';
    }
    function taskBoard() {
      const tasks = a
        .state()
        .tasks.filter(
          t =>
            !t.archived &&
            !root.WorkHubReminders.isSnoozed(a.state(), 'tasks', t.id, today()) &&
            (!batchA || batchA.matches('tasks', t.id))
        );
      return `<section class="hub">${head('MOVE WORK FORWARD', 'Task board', 'Each card keeps its main title and its own subtasks.', btn('toggle-board', 'List view') + btn('new-task', '＋ Add task', '', 'primary'))}<p class="hub-drag-hint">${icon('drag')} Drag a card’s dotted handle into a column. On your phone, drag the handle or use Move to.</p><div class="hub-board">${Object.entries(
        BOARD
      )
        .map(
          ([key, label]) =>
            `<section class="hub-column" data-column="${key}"><div class="flex-title"><h3>${label}</h3><span class="hub-badge">${tasks.filter(t => taskStatus(t) === key).length}</span></div>${
              tasks
                .filter(t => taskStatus(t) === key)
                .map(
                  t =>
                    `<article class="hub-task" draggable="true" data-task-card="${esc(t.id)}"><div class="flex-title"><span class="hub-kicker">${esc(t.priority)} · ${esc(t.taskType)}</span><button type="button" class="hub-drag-handle" data-hub="drag-help" data-hub-drag="task" aria-label="Drag task to a column, or use left and right arrow keys" title="Drag to move">${icon('drag')}</button></div><h4 class="hub-sensitive">${esc(t.task)}</h4><p class="hub-meta">${esc(a.taskLabel(t))}</p>${a.taskCompanyLabel?.(t) ? `<p class="hub-meta task-company-label">Company · ${esc(a.taskCompanyLabel(t))}</p>` : ''}${a.taskReferences?.(t) || ''}<div class="hub-progress"><span style="width:${t.subTasks.length ? (t.subTasks.filter(s => s.status === 'Completed').length / t.subTasks.length) * 100 : 0}%"></span></div><p class="hub-meta">${t.subTasks.filter(s => s.status === 'Completed').length}/${t.subTasks.length} subtasks · ${esc(t.dueDate) || 'No due date'}</p><div class="actions">${btn('task-detail', 'Details', 'data-id="' + esc(t.id) + '"', 'small')}${btn('task-feedback', 'Add feedback', 'data-id="' + esc(t.id) + '"', 'small')}${btn('timer-new', '▶', 'data-kind="task" data-id="' + esc(t.id) + '" aria-label="Start timer"', 'small')}</div><label class="hub-meta">Move to<select data-hub-move="${esc(t.id)}">${Object.entries(
                      BOARD
                    )
                      .map(
                        ([v, l]) =>
                          `<option value="${v}"${v === key ? ' selected' : ''}>${l}</option>`
                      )
                      .join('')}</select></label></article>`
                )
                .join('') || '<p class="hub-meta">Drop a card here.</p>'
            }</section>`
        )
        .join('')}</div></section>`;
    }
    function moveTask(id, status) {
      if (!Object.hasOwn(BOARD, status)) throw Error('Choose a valid column.');
      save(
        (h, d) => {
          const t = d.tasks.find(t => t.id === id);
          if (!t || t.archived) throw Error('Task no longer available.');
          t.boardStatus = status;
          t.done = status === 'done';
          t.doneDate = t.done ? t.doneDate || today() : '';
        },
        'Task moved to ' + BOARD[status] + '.'
      );
      if (status === 'done') confetti();
    }
    function completeSubtask(parentId, id, detail = false) {
      const task = a.state().tasks.find(t => t.id === parentId),
        sub = task?.subTasks.find(s => s.id === id);
      if (!task || !sub) throw Error('Sub-task no longer exists.');
      if (task.archived) throw Error('Restore the task before completing a sub-task.');
      if (sub.status === 'Completed') return;
      const ok = save((h, d) => {
        const child = d.tasks.find(t => t.id === parentId).subTasks.find(s => s.id === id);
        child.status = 'Completed';
        child.updatedAt = now();
      }, 'Sub-task completed.');
      if (ok && detail) taskDetail(parentId);
    }
    function taskDetail(id) {
      const t = a.state().tasks.find(t => t.id === id);
      if (!t) throw Error('Task no longer exists.');
      a.openModal(
        t.task,
        `<div class="hub-detail"><span class="hub-kicker">MAIN TASK · ${esc(a.taskLabel(t))}</span><p>${esc(t.priority)} · ${BOARD[taskStatus(t)]}</p>${standup?.taskContext(t.id) || ''}${a.taskCompanyLabel?.(t) ? `<p class="task-company-label">Company · ${esc(a.taskCompanyLabel(t))}</p>` : ''}${a.taskReferences?.(t) || ''}<h3>Remarks</h3><p class="prewrap hub-sensitive">${esc(t.remarks) || 'No remarks yet.'}</p><h3>Feedback</h3><p class="prewrap hub-sensitive">${esc(t.feedback) || 'No feedback yet.'}</p>${btn('task-feedback', 'Add feedback', 'data-id="' + esc(id) + '"', 'small')}<h3>Subtasks</h3>${t.subTasks.map(s => `<div class="hub-card task-detail-subtask" data-subtask-id="${esc(s.id)}"><strong>${esc(s.title)}</strong><span class="hub-badge">${esc(s.status)}</span><p class="prewrap">${esc(s.remarks)}</p><p class="hub-meta">Feedback</p><p class="prewrap hub-sensitive">${esc(s.feedback) || 'No feedback yet.'}</p><div class="actions">${subtaskCompletionButton(t, s, true)}${subtaskFeedbackButton(t, s)}${btn('subtask-edit', 'Edit', 'data-parent="' + esc(id) + '" data-id="' + esc(s.id) + '"', 'small')}${btn('timer-new', '▶ Track time', 'data-kind="task" data-id="' + esc(id) + '" data-sub="' + esc(s.id) + '"', 'small')}</div></div>`).join('') || '<p>No subtasks yet.</p>'}<div class="modal-actions">${btn('task-edit', 'Edit main task', 'data-id="' + esc(id) + '"')}${btn('subtask-edit', '＋ Add subtask', 'data-parent="' + esc(id) + '"')}</div></div>`
      );
    }
    const updateForms = {
      tasks: {
        id: 'hubTaskFeedback',
        field: 'feedback',
        title: 'Add feedback',
        label: 'feedback',
        record: 'Task',
        kicker: 'MAIN TASK',
      },
      specs: {
        id: 'hubItemFeedback',
        field: 'feedback',
        title: 'Add feedback',
        label: 'feedback',
        record: 'Project item',
        kicker: 'PROJECT ITEM',
      },
      tickets: {
        id: 'hubTicketUpdate',
        field: 'history',
        title: 'Status update',
        label: 'status update',
        record: 'Ticket',
        kicker: 'TICKET',
      },
    };
    function feedbackTarget(kind, item, subId = '') {
      if (!subId) return item;
      const sub = (kind === 'tasks' ? item.subTasks : item.subItems).find(sub => sub.id === subId);
      if (!sub)
        throw Error(
          (kind === 'tasks' ? 'Sub-task' : 'Sub-item') +
            ' no longer exists. Reopen Add feedback to choose a target.'
        );
      return sub;
    }
    function feedbackHistory(kind, item, subId = '') {
      const target = feedbackTarget(kind, item, subId),
        noun = kind === 'tasks' ? 'task' : 'item',
        label = subId
          ? 'Sub-' + noun + ' · ' + target.title
          : 'Main ' + noun + ' · ' + (item.task || item.description);
      return `<p class="hub-meta hub-sensitive">Feedback for ${esc(label)}</p>${target.feedback ? `<details class="task-feedback-history"><summary>Earlier feedback</summary><p class="prewrap hub-sensitive">${esc(target.feedback)}</p></details>` : `<p class="hub-meta">No feedback yet for this ${kind === 'tasks' ? 'task' : 'item'}.</p>`}`;
    }
    function refreshFeedbackHistory(form) {
      if (!a.cloud().ready || form.dataset.owner !== a.cloud().user?.id)
        throw Error('Finish signing in and reopen Add feedback before continuing.');
      const kind = form.dataset.kind,
        config = updateForms[kind],
        record = a.state()[kind].find(record => record.id === form.dataset.id);
      if (!record) throw Error(config.record + ' no longer exists.');
      $(config.id + 'History').innerHTML = feedbackHistory(
        kind,
        record,
        form.elements.namedItem('feedbackTarget').value
      );
    }
    function recordUpdate(kind, id, subId = '') {
      const config = updateForms[kind];
      if (!a.cloud().ready || !a.cloud().user)
        throw Error('Finish signing in before adding an update.');
      const record = a.state()[kind].find(t => t.id === id);
      if (!record) throw Error(config.record + ' no longer exists.');
      const reference =
          kind === 'tasks'
            ? a.taskLabel(record)
            : kind === 'specs'
              ? a.itemLabel(record)
              : record.ticket,
        history = record[config.field] || '',
        input = kind === 'tickets' ? 'newHistory' : 'feedback',
        children = kind === 'tasks' ? record.subTasks : kind === 'specs' ? record.subItems : [],
        noun = kind === 'tasks' ? 'task' : 'item',
        targetField =
          kind !== 'tickets'
            ? `<label for="${config.id}Target">Feedback for</label><select id="${config.id}Target" name="feedbackTarget"><option value=""${!subId ? ' selected' : ''}>Main ${noun} · ${esc(record.task || record.description)}</option>${children.length ? `<optgroup label="Sub-${noun}s">${children.map(sub => `<option value="${esc(sub.id)}"${sub.id === subId ? ' selected' : ''}>Sub-${noun} · ${esc(sub.title)}</option>`).join('')}</optgroup>` : ''}</select>`
            : '',
        earlier =
          kind !== 'tickets'
            ? `<div id="${config.id}History" aria-live="polite">${feedbackHistory(kind, record, subId)}</div>`
            : history
              ? `<details class="task-feedback-history"><summary>Earlier ${kind === 'tickets' ? 'updates' : 'feedback'}</summary><p class="prewrap hub-sensitive">${esc(history)}</p></details>`
              : '';
      a.openModal(
        config.title,
        `<form id="${config.id}" class="task-feedback-form" data-kind="${kind}" data-id="${esc(id)}" data-owner="${esc(a.cloud().user.id)}"><div class="task-feedback-context"><span class="hub-kicker">${config.kicker} · ${esc(reference)}</span><h3 class="hub-sensitive">${esc(record.task || record.description)}</h3></div>${targetField}<label for="${config.id}Text">New ${config.label}</label><textarea id="${config.id}Text" name="${input}" maxlength="${kind === 'tickets' ? 10000 : 32767}" required autofocus aria-describedby="${config.id}Hint"></textarea><p id="${config.id}Hint" class="hub-meta">Date and time are added when you save. Earlier ${kind === 'tickets' ? 'updates are' : 'feedback is'} kept.</p>${earlier}<div class="modal-actions">${btn('close', 'Cancel')}<button type="submit" class="primary">Save ${config.label}</button></div></form>`
      );
    }
    function saveRecordUpdate(form) {
      const kind = form.dataset.kind,
        config = updateForms[kind];
      if (!config || form.id !== config.id) throw Error('Reopen the update form before saving.');
      if (form.dataset.saved === 'true') return;
      if (!a.cloud().ready || !a.cloud().user || form.dataset.owner !== a.cloud().user.id)
        throw Error('Finish signing in and reopen ' + config.title + ' before saving.');
      if (!form.isConnected || !$('modal').open || $(config.id) !== form)
        throw Error('Reopen ' + config.title + ' before saving.');
      const targetControl = kind !== 'tickets' ? form.elements.namedItem('feedbackTarget') : null;
      if (kind !== 'tickets' && !targetControl) throw Error('Reopen Add feedback before saving.');
      const subId = targetControl?.value || '';
      const text = form.elements
        .namedItem(kind === 'tickets' ? 'newHistory' : 'feedback')
        .value.trim();
      if (!text) throw Error('Enter ' + config.label + ' before saving.');
      const savedAt = new Date(),
        stamp = dateOf(savedAt).split('-').reverse().join('-') + ' ' + clock(savedAt);
      const ok = save(
        (h, state) => {
          const parent = state[kind].find(t => t.id === form.dataset.id);
          if (!parent) throw Error(config.record + ' no longer exists.');
          const record = kind !== 'tickets' ? feedbackTarget(kind, parent, subId) : parent;
          if (kind === 'tickets') a.appendTicketHistory(record, text);
          else
            record.feedback =
              (record.feedback ? record.feedback + '\n\n' : '') + text + ' [' + stamp + ']';
          if (record[config.field].length > 32767)
            throw Error(
              kind === 'tickets'
                ? 'Status update history is full. Shorten this update or edit earlier history to make room.'
                : 'Feedback history is full. Shorten this update or edit earlier feedback to make room.'
            );
          if (kind !== 'tickets' && subId) record.updatedAt = savedAt.toISOString();
        },
        kind === 'tickets' ? 'Status update added.' : 'Feedback added.'
      );
      if (ok) {
        form.dataset.saved = 'true';
        a.closeModal();
      }
    }
    function currentProcess() {
      return (
        data().processes.find(p => p.id === processId) ||
        data().processes.find(p => p.archived === processArchive)
      );
    }
    function processHub() {
      return (
        rehearsal?.render() ||
        '<section class="hub"><h2>Process Hub</h2><p>Refresh this page to load the process canvas.</p></section>'
      );
    }
    function processEditor(id = '') {
      const p = data().processes.find(p => p.id === id) || {};
      form(
        id ? 'Edit process' : 'Create process',
        'hubProcessForm',
        field('name', 'Process name', p.name, 'text', true) +
          field('description', 'Description', p.description, 'textarea'),
        id,
        id ? btn('process-delete', 'Delete process', 'data-id="' + esc(id) + '"', 'danger') : ''
      );
    }
    function stepEditor(pid, id = '') {
      const p = data().processes.find(p => p.id === pid);
      if (!p) throw Error('Choose a process first.');
      const s = p.steps.find(s => s.id === id) || {};
      form(
        id ? 'Edit process step' : 'Add process step',
        'hubStep',
        field('title', 'Step title', s.title, 'text', true) +
          field('tcodes', 'T-codes, separated by commas', s.tcodes) +
          field('notes', 'Usage notes', s.notes, 'textarea') +
          field('prerequisites', 'Prerequisites', s.prerequisites, 'textarea') +
          field('configuration', 'Configuration / SPRO paths', s.configuration, 'textarea') +
          field('errors', 'Common errors and solutions', s.errors, 'textarea') +
          field('testing', 'Testing checklist', s.testing, 'textarea') +
          links(s) +
          select(
            'noteId',
            'Knowledge note',
            data().notes.map(n => [n.id, n.title]),
            s.noteId
          ) +
          `<div class="wide"><h3>Next steps / branches</h3>${
            p.steps
              .filter(x => x.id !== id)
              .map(
                x =>
                  `<label class="check-label"><input type="checkbox" name="next" value="${esc(x.id)}"${s.next?.includes(x.id) ? ' checked' : ''}>${esc(x.title)}</label>`
              )
              .join('') || '<p class="hub-meta">Add another step to create a connection.</p>'
          }</div>`,
        id,
        `<input type="hidden" name="processId" value="${esc(pid)}">`
      );
    }
    function exampleProcess() {
      const id = uid(),
        steps = [
          ['Purchase requisition', 'ME51N, ME52N, ME53N'],
          ['Purchase order', 'ME21N, ME22N, ME23N'],
          ['Goods receipt', 'MIGO'],
          ['Invoice verification', 'MIRO'],
        ].map(([title, tcodes]) => ({
          id: uid(),
          title,
          tcodes,
          notes:
            'Editable example. Confirm the transactions and steps for your own SAP version and company process.',
          configuration: '',
          prerequisites: '',
          errors: '',
          testing: '',
          projectId: '',
          ticketId: '',
          itemId: '',
          noteId: '',
          next: [],
        }));
      steps.forEach((s, i) => {
        if (steps[i + 1]) s.next = [steps[i + 1].id];
      });
      save(h =>
        h.processes.push({
          id,
          name: 'Procurement · example',
          description: 'A starting point to customise for your business.',
          archived: false,
          steps,
        })
      );
      processId = id;
      stepId = steps[0].id;
      a.render();
    }
    function walk() {
      clearTimeout(walkTimer);
      return processDeck?.open(currentProcess()?.id);
    }
    function themeStudio() {
      const p = themePreview || prefs(),
        palettes = [
          ...Object.entries(root.WorkHubAppearance.THEMES).map(([id, [name, color]]) => [
            id,
            name,
            color,
          ]),
          ['custom', 'Custom colours', p.accent],
        ];
      return `<div class="hub-theme-layout"><section class="hub-card hub-theme-controls"><div class="flex-title"><div><span class="hub-kicker">MAKE YOURSELF AT HOME</span><h3>Your space, your style</h3><p>Try a look, then save it to your account.</p></div><div class="actions">${btn('theme-export', 'Export')}${btn('theme-import', 'Import')}</div></div><form id="hubTheme"><section class="hub-theme-section"><h4>Choose your colours</h4><input type="hidden" name="theme" value="${esc(p.theme)}"><div class="hub-palette-options" role="group" aria-label="Workspace colour palette">${palettes.map(([id, name, color]) => btn('theme-choice', '<span class="hub-palette-swatch" style="--palette:' + color + '"></span><span>' + name + '</span>', 'data-theme-choice="' + id + '" aria-pressed="' + (id === p.theme) + '"', 'hub-palette-choice')).join('')}</div><div class="form-grid">${field('accent', 'Your custom colour', p.accent, 'color')}${select('background', 'Page background', root.WorkHubAppearance.BACKGROUNDS, p.background, 'Choose background')}</div>${root.WorkHubAppearance.fields(p)}<div class="actions"><button type="button" data-photo="open">My background pictures</button></div></section><section class="hub-theme-section"><h4>Text & layout</h4><div class="form-grid">${select(
        'font',
        'Typography',
        [
          ['system', 'Modern · clean & clear'],
          ['rounded', 'Friendly · soft & rounded'],
          ['serif', 'Editorial · classic serif'],
        ],
        p.font,
        'Choose font'
      )}${select(
        'radius',
        'Card corners',
        [
          [6, 'Subtle'],
          [12, 'Soft'],
          [16, 'Rounded'],
          [24, 'Very rounded'],
        ].map(([v, l]) => [String(v), l]),
        String(p.radius),
        'Choose shape'
      )}${select(
        'density',
        'Spacing',
        [
          ['comfortable', 'Comfortable'],
          ['compact', 'Compact'],
        ],
        p.density,
        'Choose spacing'
      )}${field('name', 'Your name in greetings', p.name)}</div><p class="hub-meta">Change the website title and subtitle in Settings → Edit header.</p></section><section class="hub-theme-section"><h4>A little personality</h4><div class="form-grid">${select(
        'motion',
        'Animation style',
        [
          ['calm', 'Gentle'],
          ['playful', 'Playful'],
          ['off', 'Off'],
        ],
        p.motion,
        'Choose motion'
      )}${select(
        'accessory',
        (p.mascotName || 'Momo') + '’s accessory',
        root.WorkHubMomoWardrobe.ACCESSORIES,
        p.accessory,
        'Choose accessory'
      )}${select(
        'displayMode',
        'Display rendering',
        [
          ['auto', 'Automatic · adapt to the display'],
          ['smooth', 'Smooth · TVs and high-resolution monitors'],
          ['full', 'Full effects'],
        ],
        p.displayMode
      )}${root.WorkHubMomoWardrobe.fields(p)}<div class="wide">${[
        ['hobbies', 'Let him enjoy quiet, automatic hobbies'],
        ['mascot', 'Show ' + (p.mascotName || 'Momo') + ', your companion'],
        ['roaming', 'Let ' + (p.mascotName || 'Momo') + ' wander around the screen'],
        ['sounds', 'Play a soft sound when work is completed'],
        ['desk', 'Show my growing workspace'],
      ]
        .map(
          ([k, l]) =>
            `<label class="check-label"><input type="checkbox" name="${k}"${p[k] ? ' checked' : ''}>${esc(l)}</label>`
        )
        .join(
          ''
        )}</div></div><p class="hub-meta"><button type="button" data-momo-style="gallery">Wardrobe & hobbies</button><br>Your companion pauses while you type or drag him. Your device’s reduced-motion setting is respected.</p></section><div class="actions"><button type="submit" class="primary">Save theme</button>${btn('theme-reset-preview', 'Discard preview')}</div><p id="hubThemeStatus" class="hub-meta" role="status">${themePreview ? 'Preview only · save to keep this look.' : 'Your saved appearance is active.'}</p></form><input type="file" id="hubThemeFile" accept=".json,application/json" hidden></section><aside class="hub-card hub-theme-preview"><span class="hub-kicker">LIVE PREVIEW</span><h3>A little more you.</h3><p>See your colours, type and spacing come together.</p><div class="hub-preview-mini"><span class="hub-badge">YOUR WORKSPACE</span><h3>A good day starts here.</h3><p>One clear task. A little progress.</p><div class="hub-preview-sample"><span class="hub-preview-dot">✓</span><span><strong>Review the next step</strong><small>Ready when you are</small></span></div><div class="hub-progress"><span style="width:68%"></span></div>${btn('celebrate', 'Try a celebration', '', 'primary')}</div><p class="hub-meta">Your saved look follows your account on phone and laptop.</p></aside></div>`;
    }
    function previewTheme(form) {
      const p = themeValues(form),
        d = copy(a.state());
      d.workhub.preferences = p;
      validate(d);
      themePreview = p;
      applyTheme(p);
      form
        .querySelectorAll('[data-theme-choice]')
        .forEach(el => el.setAttribute('aria-pressed', String(el.dataset.themeChoice === p.theme)));
      form
        .querySelector('[data-theme-choice="custom"] .hub-palette-swatch')
        ?.style.setProperty('--palette', p.accent);
      if ($('hubThemeStatus')) {
        $('hubThemeStatus').textContent = 'Preview only · save to keep this look.';
        $('hubThemeStatus').dataset.saved = 'false';
      }
    }

    function simulationValues(values) {
      const q = Number(values.quantity),
        p = Number(values.price),
        r = Number(values.received),
        i = Number(values.invoiced),
        ip = Number(values.invoicePrice),
        t = Number(values.tolerance);
      return {
        order: q * p,
        receipt: r * p,
        invoice: i * ip,
        quantityDifference: i - r,
        priceDifference: ip - p,
        priceVariance: p ? ((ip - p) / p) * 100 : ip === 0 ? 0 : 100,
        withinTolerance: p ? Math.abs(((ip - p) / p) * 100) <= t : ip === 0,
      };
    }
    function focusWidget() {
      return `<form id="hubFocusForm" class="hub-focus-form"><div class="hub-focus-clock" id="hubFocusClock" data-long="${(focus?.minutes || focusMinutes) >= 1000}">${focus ? focusText() : String(focusMinutes).padStart(2, '0') + ':00'}</div><p class="hub-meta">${focus?.title ? esc(focus.title) : 'A quiet space for one thing at a time.'}</p>${
        !focus
          ? select(
              'focusTask',
              'Focus on',
              a
                .state()
                .tasks.filter(t => !t.done && !t.archived)
                .map(t => [t.id, t.task]),
              '',
              'Choose a task or focus freely'
            )
          : ''
      }<div class="hub-focus-duration"><label for="hubFocusMinutes">${focus ? 'Total length' : 'Duration'} (minutes)</label><input id="hubFocusMinutes" name="minutes" type="number" inputmode="numeric" min="1" max="1440" step="1" value="${focus?.minutes || focusMinutes}" aria-describedby="hubFocusDurationHint" required><small id="hubFocusDurationHint" class="hub-meta">${focus ? 'Updating the total keeps elapsed time. A shorter total may finish this session.' : 'Choose 1–1,440 minutes. Your last used length is remembered on this device.'}</small></div><div class="actions"><button type="submit" class="primary">${focus ? 'Update length' : 'Start focus'}</button>${focus ? btn('focus-stop', 'End focus') : ''}</div></form>`;
    }
    function startFocus(form) {
      const minutes = Number(form?.elements.namedItem('minutes')?.value);
      if (!validFocusMinutes(minutes))
        throw Error('Choose a whole number of minutes between 1 and 1,440.');
      focusMinutes = minutes;
      try {
        localStorage.setItem(focusMinutesKey, String(minutes));
      } catch {}
      if (focus) {
        focus.minutes = minutes;
        focus.end = focus.start + minutes * 60000;
        if (focus.end <= (focus.pausedAt || Date.now())) {
          focus = null;
          document.body.classList.remove('hub-focus');
          confetti();
          a.tell('Focus session complete. Take a moment to recharge.');
        } else a.tell('Focus length updated.');
      } else {
        const start = Date.now();
        focus = {
          start,
          end: start + minutes * 60000,
          minutes,
          title:
            a.state().tasks.find(t => t.id === form.elements.namedItem('focusTask')?.value)?.task ||
            '',
        };
      }
      renderFocus();
    }
    function focusText() {
      const secs = Math.max(0, Math.ceil((focus.end - (focus.pausedAt || Date.now())) / 1000));
      return (
        String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0')
      );
    }
    function focusSnapshot() {
      return {
        active: !!focus,
        paused: !!focus?.pausedAt,
        minutes: focus?.minutes || focusMinutes,
        title: focus?.title || '',
        start: focus?.start || 0,
        remaining: focus
          ? Math.max(0, Math.ceil((focus.end - (focus.pausedAt || Date.now())) / 1000))
          : focusMinutes * 60,
      };
    }
    function renderFocus() {
      document.body.classList.toggle('hub-focus', !!focus);
      const form = $('hubFocusForm');
      if (form) form.outerHTML = focusWidget();
      focusPanel?.refresh();
    }
    function pauseFocus() {
      if (!focus) return;
      if (focus.pausedAt) {
        const gap = Date.now() - focus.pausedAt;
        focus.start += gap;
        focus.end += gap;
        delete focus.pausedAt;
      } else focus.pausedAt = Date.now();
      renderFocus();
    }
    function endFocus() {
      focus = null;
      renderFocus();
    }
    function scrapbook() {
      return `<section class="hub-card"><h3>Milestone scrapbook</h3><p>Project phase changes create small keepsakes. Add your own lessons and outcomes.</p>${btn('scrap-edit', '＋ Add keepsake')}<div class="hub-grid hub-scrapbook">${
        data()
          .scrapbook.slice()
          .reverse()
          .map(
            x =>
              `<article class="hub-card"><span class="hub-kicker">${esc(x.date)}</span><h4>${esc(x.title)}</h4><p class="prewrap">${esc(x.notes)}</p>${btn('scrap-edit', 'Edit', 'data-id="' + esc(x.id) + '"', 'small')}${btn('scrap-replay', 'Replay celebration', '', 'small')}${btn('scrap-delete', 'Delete', 'data-id="' + esc(x.id) + '"', 'small danger')}</article>`
          )
          .join('') ||
        empty(
          'Good work deserves remembering',
          'Add your first milestone or advance a project phase.'
        )
      }</div></section>`;
    }
    function dailySummary() {
      const s = a.state(),
        completed = s.tasks.filter(t => t.doneDate === today()),
        open = s.tasks.filter(t => !t.done && !t.archived),
        tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return `<section class="hub-card"><h3>Your daily wrap-up</h3><div class="hub-grid"><div><h4>Completed today · ${completed.length}</h4>${completed.map(t => `<p>✓ ${esc(t.task)}</p>`).join('') || '<p>A day can contain useful work without a finished task.</p>'}</div><div><h4>Still in progress · ${open.length}</h4>${open
        .slice(0, 8)
        .map(t => `<p>${esc(t.task)}</p>`)
        .join('')}</div><div><h4>Tomorrow</h4>${
        a
          .entries(dateOf(tomorrow))
          .map(e => `<p>${esc(e.time)} · ${esc(a.entryTitle(e))}</p>`)
          .join('') || '<p>No activities planned yet.</p>'
      }</div><div><h4>Time recorded</h4><p>${Math.round(
        data()
          .sessions.filter(x => dateOf(new Date(x.start)) === today())
          .reduce((n, x) => n + x.seconds, 0) / 60
      )} active minutes today</p>${timerDraft ? '<p>A work timer is still running or paused.</p>' : ''}</div></div></section>`;
    }
    function sessionsView() {
      const all = data().sessions,
        rows = all
          .filter(
            s => sessionView === 'all' || (sessionView === 'archived' ? s.archived : !s.archived)
          )
          .slice()
          .reverse();
      return `<section class="hub-card hub-sessions"><div class="flex-title"><div><span class="hub-kicker">YOUR TIME, CAPTURED</span><h3>Recorded work sessions</h3></div>${btn('timer-new', '▶ Start activity', '', 'primary')}</div><p class="hub-meta">Archive to tidy this list and restore later. Archived time stays in reports. Archiving or deleting a session keeps its existing Schedule and Project entries.</p><div class="hub-toolbar" role="group" aria-label="Work session view">${[
        ['active', 'Active', all.filter(s => !s.archived).length],
        ['archived', 'Archived', all.filter(s => s.archived).length],
        ['all', 'All', all.length],
      ]
        .map(([id, label, count]) =>
          btn(
            'session-view',
            label + ' · ' + count,
            'data-view="' + id + '" aria-pressed="' + (sessionView === id) + '"',
            sessionView === id ? 'primary' : ''
          )
        )
        .join(
          ''
        )}</div><div class="hub-list">${rows.map(s => `<article class="hub-row hub-session-row" data-session-id="${esc(s.id)}"><div class="hub-session-copy"><strong class="hub-sensitive">${esc(s.title)}</strong><small>${esc(new Date(s.start).toLocaleString())} · ${Math.floor(s.seconds / 3600)}h ${Math.floor((s.seconds % 3600) / 60)}m ${s.seconds % 60}s · ${esc(s.chargeCode) || 'No charge code'}</small>${s.notes ? `<small class="hub-sensitive">${esc(s.notes)}</small>` : ''}<span class="hub-badge">${s.archived ? 'Archived · ' : ''}${s.scheduled ? 'Scheduled' : 'Needs calendar review'}</span></div><div class="actions">${!s.archived && !s.scheduled ? btn('session-retry', 'Schedule', 'data-id="' + esc(s.id) + '"', 'small') : ''}${btn(s.archived ? 'session-restore' : 'session-archive', s.archived ? '↶ Restore' : 'Archive', 'data-id="' + esc(s.id) + '"', 'small')}${btn('session-delete', 'Delete', 'data-id="' + esc(s.id) + '" aria-label="Delete session: ' + esc(s.title) + '"', 'small danger')}</div></article>`).join('') || empty(sessionView === 'archived' ? 'Nothing archived yet' : 'Your work, captured', sessionView === 'archived' ? 'Archived sessions will appear here, ready to restore.' : sessionView === 'all' ? 'Stop a work timer to record a session.' : 'Stop a work timer to record a session, or check your archive.')}</div></section>`;
    }
    function studio() {
      const tools = {
        theme: 'Theme studio',
        reader: 'JSON & IDoc Reader',
        tcodes: 'SAP T-codes',
        focus: 'Focus room',
        journey: 'Project journey',
        scrapbook: 'Scrapbook',
        wrap: 'Daily wrap-up',
        sessions: 'Work sessions',
        screenshots: 'Screenshot tools',
      };
      if (!Object.hasOwn(tools, currentTool)) currentTool = 'theme';
      const available = Object.keys(tools).filter(
        id =>
          !a.state().preferences.hiddenTabs?.includes('studio.' + id) &&
          (!root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('studio.' + id))
      );
      if (!available.includes(currentTool)) currentTool = available[0] || '';
      if (!currentTool)
        return '<section class="access-empty"><h2>No Studio tools are available</h2><p>Check Screen visibility or ask the Owner to review your access.</p></section>';
      return `<section class="hub">${head('A WORKSPACE WITH PERSONALITY', 'Studio', 'Useful tools. A little play. Everything in its place.')}<div class="hub-toolbar">${Object.entries(
        tools
      )
        .map(([id, name]) =>
          btn('tool', name, 'data-tool="' + id + '"', id === currentTool ? 'primary' : '')
        )
        .join(
          ''
        )}</div>${currentTool === 'reader' ? reader?.render() || '' : currentTool === 'screenshots' ? batchC?.cards() || '' : currentTool === 'theme' ? themeStudio() : currentTool === 'tcodes' ? tcodes?.render() || '' : currentTool === 'focus' ? `<section class="hub-card">${focusWidget()}${prefs().desk ? desk() : ''}</section>` : currentTool === 'journey' ? `<section class="hub-card">${journey()}</section>` : currentTool === 'scrapbook' ? scrapbook() : currentTool === 'wrap' ? dailySummary() : sessionsView()}</section>`;
    }
    function timerKey() {
      return a.cloud().user ? 'mm-tracker.timer.v1:' + a.cloud().user.id : null;
    }
    function persistTimer() {
      const key = timerKey();
      if (!key) return;
      try {
        if (timerDraft) localStorage.setItem(key, JSON.stringify(timerDraft));
        else localStorage.removeItem(key);
      } catch {
        a.tell(
          'Timer recovery could not be stored. Keep this page open until the session is saved.',
          true
        );
      }
    }
    function recoverTimer() {
      const owner = a.cloud().user?.id || '';
      if (owner === timerOwner) return;
      undo = null;
      $('hubUndo')?.remove();
      timerOwner = owner;
      timerDraft = null;
      if (!owner) return;
      try {
        const raw = localStorage.getItem(timerKey());
        if (raw) {
          const d = JSON.parse(raw);
          if (
            typeof d.id === 'string' &&
            d.id.length <= 100 &&
            typeof d.title === 'string' &&
            d.title.length <= 500 &&
            TIME_OPTIONS.includes(d.kind) &&
            Array.isArray(d.segments) &&
            d.segments.length <= 1000 &&
            Number.isFinite(Date.parse(d.started)) &&
            (!d.runningSince || Number.isFinite(Date.parse(d.runningSince))) &&
            d.segments.every(
              x =>
                Number.isFinite(Date.parse(x.start)) &&
                Number.isFinite(Date.parse(x.end)) &&
                Date.parse(x.end) >= Date.parse(x.start)
            )
          )
            timerDraft = d;
        }
      } catch {
        a.tell('A timer recovery copy could not be read. Other records are unaffected.', true);
      }
      if (timerDraft && data().sessions.some(s => s.id === timerDraft.id)) {
        timerDraft = null;
        persistTimer();
      }
    }
    function timerSeconds(t = timerDraft, at = Date.now()) {
      if (!t) return 0;
      return Math.max(
        0,
        t.segments.reduce((n, s) => n + (Date.parse(s.end) - Date.parse(s.start)) / 1000, 0) +
          (t.runningSince ? (at - Date.parse(t.runningSince)) / 1000 : 0)
      );
    }
    function timerText() {
      const n = Math.floor(timerSeconds());
      return (
        String(Math.floor(n / 3600)).padStart(2, '0') +
        ':' +
        String(Math.floor((n % 3600) / 60)).padStart(2, '0') +
        ':' +
        String(n % 60).padStart(2, '0')
      );
    }
    const timerPositionKey = 'mm-tracker.timer-position.v1';
    let timerPosition = { x: 0.88, y: 0.16 },
      timerMinimized = false,
      timerDrag = null;
    try {
      const saved = JSON.parse(localStorage.getItem(timerPositionKey) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        timerPosition = {
          x: Math.min(1, Math.max(0, saved.x)),
          y: Math.min(1, Math.max(0, saved.y)),
        };
        timerMinimized = saved.minimized === true;
      }
    } catch {}
    function positionTimer(pixels = null) {
      const el = $('hubTimerBar');
      if (!el) return;
      const viewport = root.visualViewport,
        w = viewport?.width || root.innerWidth || 375,
        h = viewport?.height || root.innerHeight || 667,
        left = (viewport?.offsetLeft || 0) + 12,
        top = (viewport?.offsetTop || 0) + 12;
      const width = Math.max(80, Math.min(timerMinimized ? 264 : w < 600 ? 304 : 344, w - 24)),
        maxHeight = Math.max(80, h - 24);
      Object.assign(el.style, {
        position: 'fixed',
        width: width + 'px',
        maxWidth: 'none',
        maxHeight: maxHeight + 'px',
        height: 'auto',
        overflowY: 'auto',
        right: 'auto',
        bottom: 'auto',
        transform: 'none',
        zIndex: '85',
      });
      const height = Math.min(
          maxHeight,
          el.getBoundingClientRect().height || (timerMinimized ? 64 : 250)
        ),
        rangeX = Math.max(0, w - width - 24),
        rangeY = Math.max(0, h - height - 24);
      if (pixels)
        timerPosition = {
          x: rangeX ? Math.min(1, Math.max(0, (pixels.x - left) / rangeX)) : 0,
          y: rangeY ? Math.min(1, Math.max(0, (pixels.y - top) / rangeY)) : 0,
        };
      el.style.left = left + timerPosition.x * rangeX + 'px';
      el.style.top = top + timerPosition.y * rangeY + 'px';
    }
    function rememberTimerPosition() {
      try {
        localStorage.setItem(
          timerPositionKey,
          JSON.stringify({ ...timerPosition, minimized: timerMinimized })
        );
      } catch {}
    }
    function renderTimerBar() {
      let el = $('hubTimerBar');
      if (!timerDraft || !a.cloud().ready) {
        el?.remove();
        timerDrag = null;
        return;
      }
      if (!el) {
        el = document.createElement('aside');
        el.id = 'hubTimerBar';
        el.className = 'hub-timerbar';
        el.setAttribute('aria-label', 'Floating work stopwatch');
        document.body.append(el);
      }
      el.dataset.minimized = String(timerMinimized);
      el.dataset.running = String(!!timerDraft.runningSince);
      el.innerHTML = `<div class="hub-timer-head"><button type="button" class="hub-float-handle" data-hub="timer-drag" aria-label="Move timer. Drag or use arrow keys." title="Drag to move timer">${icon('drag')}</button><span class="hub-kicker">${timerMinimized ? '<span id="hubTimerClock" class="hub-timer">' + timerText() + '</span>' : timerDraft.runningSince ? 'TIME WELL SPENT' : 'TAKE YOUR TIME'}</span>${btn('timer-minimize', timerMinimized ? '↗' : '−', 'aria-label="' + (timerMinimized ? 'Expand timer' : 'Minimise timer') + '" aria-expanded="' + !timerMinimized + '"', 'small')}</div>${timerMinimized ? '' : `<div class="hub-timer-body"><strong class="hub-sensitive">${esc(timerDraft.title)}</strong>${timerDraft.itemTitle ? '<div class="hub-timer-context hub-sensitive">' + esc(timerDraft.itemTitle) + (timerDraft.subItemTitle ? ' → ' + esc(timerDraft.subItemTitle) : '') + '</div>' : ''}<p class="hub-meta">${timerDraft.runningSince ? '● Running' : 'Ⅱ Paused'} · <span class="hub-sensitive">${esc(timerDraft.unlisted ? [timerDraft.unlistedName || 'Unlisted ' + timerDraft.kind, timerDraft.companyHint].filter(Boolean).join(' · ') : projectName(timerDraft.projectId))}</span></p><span id="hubTimerClock" class="hub-timer">${timerText()}</span><div class="actions">${btn(timerDraft.runningSince ? 'timer-pause' : 'timer-resume', timerDraft.runningSince ? 'Pause' : 'Resume', '', 'small')}${btn('timer-switch', '⇄ Switch work', '', 'small')}${btn('timer-notes', 'Notes', '', 'small')}${btn('timer-stop', 'Stop & save', '', 'primary small')}</div></div>`}`;
      positionTimer();
    }
    document.addEventListener('pointerdown', event => {
      const handle = event.target.closest?.('[data-hub="timer-drag"]');
      if (!handle || event.button > 0) return;
      const el = $('hubTimerBar');
      stopCompanionWalk();
      timerDrag = {
        id: event.pointerId,
        handle,
        x: event.clientX,
        y: event.clientY,
        left: parseFloat(el.style.left),
        top: parseFloat(el.style.top),
        moved: false,
      };
      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch {}
    });
    document.addEventListener(
      'pointermove',
      event => {
        if (!timerDrag || event.pointerId !== timerDrag.id) return;
        const dx = event.clientX - timerDrag.x,
          dy = event.clientY - timerDrag.y;
        if (!timerDrag.moved && Math.hypot(dx, dy) < 6) return;
        event.preventDefault();
        timerDrag.moved = true;
        positionTimer({ x: timerDrag.left + dx, y: timerDrag.top + dy });
      },
      { passive: false }
    );
    function endTimerDrag(event) {
      if (!timerDrag || event.pointerId !== timerDrag.id) return;
      const drag = timerDrag;
      timerDrag = null;
      try {
        drag.handle.releasePointerCapture?.(event.pointerId);
      } catch {}
      if (drag.moved) rememberTimerPosition();
    }
    document.addEventListener('pointerup', endTimerDrag);
    document.addEventListener('pointercancel', endTimerDrag);
    document.addEventListener('keydown', event => {
      if (
        !event.target.closest?.('[data-hub="timer-drag"]') ||
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      )
        return;
      event.preventDefault();
      const el = $('hubTimerBar'),
        step = event.shiftKey ? 32 : 12;
      positionTimer({
        x:
          parseFloat(el.style.left) +
          (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y:
          parseFloat(el.style.top) +
          (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      });
      rememberTimerPosition();
    });

    const timerTicketOpen = t =>
      !['completed', 'closed'].includes(String(t.status).trim().toLowerCase());
    function timerRows(kind) {
      return kind === 'project'
        ? projects()
        : kind === 'task'
          ? a
              .state()
              .tasks.filter(t => !t.archived && !t.done)
              .map(t => [t.id, t.task])
          : kind === 'ticket'
            ? a
                .state()
                .tickets.filter(timerTicketOpen)
                .map(t => [t.id, t.ticket + ' · ' + t.description])
            : [];
    }
    function timerChargeFields(kind, projectId, current = '') {
      if (kind !== 'project') return '';
      const codes = [
        ...new Set(
          a
            .state()
            .projects.map(p => p.code)
            .filter(Boolean)
        ),
      ];
      const value = codes.includes(current)
        ? current
        : a.state().projects.find(p => p.id === projectId)?.code || '';
      return select(
        'chargeCode',
        'Charge code',
        codes.map(code => [code, code]),
        value,
        'No charge code'
      );
    }
    function projectTimerFields(projectId, itemId = '', subItemId = '') {
      const items = a.state().specs.filter(p => p.projectId === projectId),
        item = items.find(p => p.id === itemId);
      return (
        select(
          'itemId',
          'Project item (optional)',
          items.map(p => [p.id, [p.itemId || p.ricefw, p.description].filter(Boolean).join(' · ')]),
          itemId,
          'Whole project'
        ) +
        select(
          'subItemId',
          'Sub-item (optional)',
          (item?.subItems || []).map(p => [p.id, p.title]),
          subItemId,
          item ? 'Whole item' : 'Choose an item first'
        )
      );
    }
    function timerEditor(
      kind = 'custom',
      linkId = '',
      subTaskId = '',
      itemId = '',
      subItemId = '',
      switching = false,
      seed = {}
    ) {
      if (timerDraft && !switching) {
        a.tell('A timer is already running or paused. Stop it before starting another.');
        renderTimerBar();
        return;
      }
      const tasks = a.state().tasks.filter(t => !t.archived && !t.done),
        rows = timerRows(kind);
      if (!rows.some(r => r[0] === linkId)) linkId = '';
      form(
        switching && timerDraft ? 'Switch your work' : 'Start a work session',
        'hubTimerStart',
        select(
          'kind',
          'Activity type',
          [
            ['custom', 'Custom activity'],
            ['task', 'Task'],
            ['project', 'Project'],
            ['ticket', 'Ticket'],
          ],
          kind,
          'Choose type'
        ) +
          `<div id="hubTimerLink">${kind !== 'custom' ? select('linkId', 'Linked record', rows, linkId, 'Choose record') : ''}${
            kind === 'task'
              ? select(
                  'subTaskId',
                  'Optional subtask',
                  (tasks.find(t => t.id === linkId)?.subTasks || [])
                    .filter(s => !s.done && s.status !== 'Completed')
                    .map(s => [s.id, s.title]),
                  subTaskId
                )
              : ''
          }${kind === 'project' ? '<div id="hubTimerProjectItems">' + projectTimerFields(linkId, itemId, subItemId) + '</div>' : ''}</div>` +
          field('title', 'Session title (optional for linked work)', '') +
          '<div id="hubTimerCharge">' +
          timerChargeFields(kind, linkId) +
          '</div>' +
          field('notes', 'Session remarks', '', 'textarea'),
        '',
        '<p class="hint">Sub-item sessions keep their main item and project link. Stop & save records actual time alongside your original Schedule plan and in project work history. Pauses are excluded.</p>'
      );
      const startForm = $('hubTimerStart');
      startForm.dataset.switch = String(switching);
      if (seed.allocationKey) startForm.dataset.allocation = seed.allocationKey;
      workSchedule?.enhanceTimerForm(startForm, seed);
    }
    function startTimer(values, switching = false) {
      if (!a.cloud().ready || !a.cloud().user?.id) throw Error('Sign in before starting work.');
      if (timerDraft && !switching) throw Error('Stop the existing timer first.');
      const s = a.state(),
        kind = values.kind,
        unlisted =
          (values.captureMode === 'unlisted' || values.unlisted === true) &&
          ['project', 'ticket'].includes(kind),
        linkId = unlisted ? '' : values.linkId || '',
        task = kind === 'task' ? s.tasks.find(t => t.id === linkId) : null,
        project = kind === 'project' ? s.projects.find(p => p.id === linkId) : null,
        ticket = kind === 'ticket' ? s.tickets.find(t => t.id === linkId) : null;
      if (
        !TIME_OPTIONS.includes(kind) ||
        (kind === 'task' && !task) ||
        (kind === 'project' && !project && !unlisted) ||
        (kind === 'ticket' && !ticket && !unlisted)
      )
        throw Error('Choose a valid activity and linked record.');
      if (task && (task.done || task.archived)) throw Error('Choose an active, unfinished task.');
      if (ticket && !timerTicketOpen(ticket)) throw Error('Choose an open, unfinished ticket.');
      if (
        kind === 'project' &&
        !unlisted &&
        values.chargeCode &&
        !s.projects.some(p => p.code === values.chargeCode)
      )
        throw Error('Choose a charge code from your maintained projects.');
      const sub = kind === 'task' ? task.subTasks.find(s => s.id === values.subTaskId) : null,
        item =
          kind === 'project' && values.itemId
            ? s.specs.find(p => p.id === values.itemId && p.projectId === linkId)
            : null,
        subItem = item?.subItems.find(p => p.id === values.subItemId);
      if (
        kind === 'project' &&
        !unlisted &&
        ((values.itemId && !item) || (values.subItemId && !subItem))
      )
        throw Error('Choose an item and sub-item belonging to this project.');
      if (kind === 'task' && values.subTaskId && !sub)
        throw Error('Choose a subtask belonging to this task.');
      if (sub?.done || sub?.status === 'Completed') throw Error('Choose an unfinished subtask.');
      const title =
        values.title?.trim() ||
        (unlisted ? values.unlistedName?.trim() : '') ||
        subItem?.title ||
        item?.description ||
        sub?.title ||
        task?.task ||
        project?.name ||
        ticket?.description;
      if (!title || title.length > 500)
        throw Error('Enter a session title of up to 500 characters.');
      const companyId = !unlisted && kind === 'project' ? values.companyId || '' : '';
      if (
        companyId &&
        !s.projectCompanies.some(
          c => c.id === companyId && c.projectId === linkId && c.active !== false
        )
      )
        throw Error('Choose an active company from this project.');
      const plannedAllocation = values.allocationKey
        ? s.schedule.find(slot => root.WorkHubScheduleEngine.key(slot) === values.allocationKey)
        : null;
      const allocationKey =
        !unlisted &&
        plannedAllocation &&
        root.WorkHubScheduleEngine.matches(
          plannedAllocation,
          { kind, linkId, projectId: kind === 'project' ? linkId : '', title, companyId },
          s
        )
          ? values.allocationKey
          : '';
      for (const key of ['unlistedName', 'companyHint', 'reference'])
        if (values[key] && (typeof values[key] !== 'string' || values[key].length > 500))
          throw Error('Keep work context within 500 characters.');
      let started = values.actualStart ? new Date(values.actualStart).toISOString() : now();
      if (
        timerDraft &&
        Date.parse(started) < Date.parse(timerDraft.started) &&
        root.WorkHubScheduleEngine.localDate(Date.parse(started)) ===
          root.WorkHubScheduleEngine.localDate(Date.parse(timerDraft.started)) &&
        root.WorkHubScheduleEngine.time(Date.parse(started)) ===
          root.WorkHubScheduleEngine.time(Date.parse(timerDraft.started))
      )
        started = timerDraft.started;
      if (
        Date.parse(started) > Date.now() ||
        (timerDraft && Date.parse(started) < Date.parse(timerDraft.started))
      )
        throw Error('The switch time must be between this session’s start and now.');
      if (Date.now() - Date.parse(started) > 366 * 86400000)
        throw Error('Check the actual start time.');
      root.WorkHubScheduleEngine?.assertAvailable(s, [{ start: started, end: now() }]);
      if (timerDraft && switching) {
        checkTimerOwner();
        const cutoff = Date.parse(started),
          parts = [
            ...timerDraft.segments,
            ...(timerDraft.runningSince ? [{ start: timerDraft.runningSince, end: started }] : []),
          ];
        const elapsed = parts.reduce(
          (n, p) => n + Math.max(0, Math.min(cutoff, Date.parse(p.end)) - Date.parse(p.start)),
          0
        );
        if (!elapsed) {
          timerDraft = null;
          persistTimer();
        } else finishTimer(false, started, 'switch');
        if (timerDraft) return false;
      }
      const key = timerKey();
      if (key && localStorage.getItem(key))
        throw Error('Another tab already has a timer. Refresh to recover it.');
      timerDraft = {
        id: uid(),
        title,
        kind,
        linkId,
        subTaskId: sub?.id || '',
        itemId: unlisted ? '' : item?.id || '',
        subItemId: unlisted ? '' : subItem?.id || '',
        itemTitle: item?.description || '',
        subItemTitle: subItem?.title || '',
        projectId:
          kind === 'project'
            ? linkId
            : kind === 'task' && task.taskType === 'Project'
              ? task.linkId
              : '',
        started,
        runningSince: started,
        segments: [],
        notes: values.notes || '',
        chargeCode: kind === 'project' && !unlisted ? values.chargeCode || '' : '',
        companyId,
        unlisted,
        unlistedName: unlisted ? values.unlistedName?.trim() || '' : '',
        companyHint: unlisted ? values.companyHint?.trim() || '' : '',
        reference: unlisted ? values.reference?.trim() || '' : '',
        allocationKey,
        scheduleVersion: 1,
      };
      timerDraft.captureIdentity = root.WorkHubScheduleEngine?.identity(timerDraft, s);
      batchA?.timerStarted(timerDraft);
      persistTimer();
      a.closeModal();
      renderTimerBar();
      a.refreshSchedule?.();
      workSchedule?.refreshActuals();
      react('busy', 'Timer started. Make room for one thing.');
    }
    function checkTimerOwner() {
      const raw = localStorage.getItem(timerKey());
      if (!raw || JSON.parse(raw).id !== timerDraft?.id)
        throw Error('The timer changed in another tab. Refresh before continuing.');
    }
    function pauseTimer() {
      if (!timerDraft?.runningSince) return;
      checkTimerOwner();
      const end = now();
      timerDraft.segments.push({ start: timerDraft.runningSince, end });
      timerDraft.runningSince = null;
      persistTimer();
      renderTimerBar();
      a.refreshSchedule?.();
      workSchedule?.refreshActuals();
    }
    function resumeTimer() {
      if (!timerDraft || timerDraft.runningSince) return;
      checkTimerOwner();
      timerDraft.runningSince = now();
      batchA?.timerResumed(timerDraft);
      persistTimer();
      renderTimerBar();
      a.refreshSchedule?.();
      workSchedule?.refreshActuals();
    }
    function sessionRanges(session) {
      const parts = [];
      for (const seg of session.intervals) {
        let start = new Date(seg.start),
          end = new Date(seg.end);
        if (end <= start) continue;
        if (end - start > 366 * 86400000)
          throw Error('This timer is unusually long. Review the finishing time first.');
        start.setSeconds(0, 0);
        if (end.getSeconds() || end.getMilliseconds()) end.setMinutes(end.getMinutes() + 1, 0, 0);
        while (start < end) {
          const next = new Date(start);
          next.setHours(24, 0, 0, 0);
          const until = end < next ? end : next;
          parts.push({
            date: dateOf(start),
            time: clock(start),
            endTime: until.getTime() === next.getTime() ? '24:00' : clock(until),
          });
          start = next;
        }
      }
      const out = [];
      for (const part of parts.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
        const last = out.at(-1);
        if (last && last.date === part.date && last.endTime >= part.time)
          last.endTime = last.endTime > part.endTime ? last.endTime : part.endTime;
        else out.push({ ...part });
      }
      return out;
    }
    function scheduleSession(session, d) {
      if (session.scheduleVersion === 1) {
        root.WorkHubScheduleEngine.assertAvailable(d, session.intervals, session.id);
        session.scheduled = true;
        return;
      }
      const ranges = sessionRanges(session);
      if (!ranges.length) throw Error('Record at least a moment of work before stopping.');
      for (const r of ranges)
        if (a.overlaps(d.schedule, [r.date], r.time, r.endTime))
          throw Error('The recorded time overlaps an existing activity.');
      const projectId =
          session.projectId && d.projects.some(p => p.id === session.projectId)
            ? session.projectId
            : '',
        task = session.kind === 'task' ? d.tasks.find(t => t.id === session.linkId) : null;
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i],
          id = session.id + '-' + i,
          metadata = {
            itemId: session.itemId || '',
            subItemId: session.subItemId || '',
            itemTitle: session.itemTitle || '',
            subItemTitle: session.subItemTitle || '',
          },
          location = d.lists.workLocations[0] || 'Office',
          text = [
            session.title,
            session.itemTitle ? 'Project item: ' + session.itemTitle : '',
            session.subItemTitle ? 'Sub-item: ' + session.subItemTitle : '',
            session.notes,
            session.chargeCode ? 'Charge code: ' + session.chargeCode : '',
            session.subTaskId
              ? 'Subtask: ' +
                (task?.subTasks.find(s => s.id === session.subTaskId)?.title || session.subTaskId)
              : '',
          ]
            .filter(Boolean)
            .join('\n');
        if (projectId)
          d.projectPlans.push({
            id,
            projectId,
            title: session.title,
            activity: d.lists.projectActivities[0] || '',
            text,
            date: r.date,
            endDate: r.date,
            time: r.time,
            endTime: r.endTime,
            location,
            status: 'Completed',
            source: 'Stopwatch',
            ...metadata,
            actualTask: session.notes || session.title,
            actualSame: null,
            actualReviewedAt: now(),
            sessionId: session.id,
            ...(session.kind === 'ticket' ? { ticketId: session.linkId } : {}),
          });
        for (const seg of a.rangeSegments(r.time, r.endTime))
          d.schedule.push({
            date: r.date,
            time: seg.time,
            endTime: seg.endTime,
            text,
            kind: projectId ? 'project' : task ? 'task' : 'custom',
            linkId: projectId || task?.id || '',
            activity: projectId ? d.lists.projectActivities[0] || '' : '',
            location: projectId ? location : '',
            bookingId: id,
            planId: projectId ? id : '',
            sessionId: session.id,
            ...metadata,
            ...(session.kind === 'ticket' ? { ticketId: session.linkId } : {}),
          });
      }
      session.scheduled = true;
    }
    function finishTimer(skipCalendar = false, overrideEnd = '', endReason = 'stop') {
      if (!timerDraft) return;
      checkTimerOwner();
      pauseTimer();
      const t = timerDraft,
        intervals = copy(t.segments);
      if (overrideEnd) {
        const end = new Date(overrideEnd).toISOString();
        for (let i = intervals.length - 1; i >= 0; i--) {
          if (intervals[i].start >= end) intervals.splice(i, 1);
          else if (intervals[i].end > end) intervals[i].end = end;
        }
      }
      const seconds = Math.max(
        0,
        Math.round(
          intervals.reduce((n, s) => n + (Date.parse(s.end) - Date.parse(s.start)) / 1000, 0)
        )
      );
      if (!seconds)
        throw Error('The session has no active time. Resume it or adjust the finish time.');
      const session = {
        id: t.id,
        title: t.title,
        kind: t.kind,
        linkId: t.linkId,
        subTaskId: t.subTaskId,
        itemId: t.itemId || '',
        subItemId: t.subItemId || '',
        itemTitle: t.itemTitle || '',
        subItemTitle: t.subItemTitle || '',
        projectId: t.projectId,
        start: t.started,
        end: intervals.at(-1).end,
        intervals,
        seconds,
        notes: t.notes,
        chargeCode: t.chargeCode,
        scheduled: false,
        ...(batchA?.timerFields(t) || {}),
        ...(t.scheduleVersion === 1
          ? {
              scheduleVersion: 1,
              endReason,
              unlisted: t.unlisted || false,
              unlistedName: t.unlistedName || '',
              companyHint: t.companyHint || '',
              reference: t.reference || '',
              companyId: t.companyId || '',
              allocationKey: t.allocationKey || '',
              captureIdentity: t.captureIdentity,
            }
          : {}),
      };
      if (!skipCalendar) {
        try {
          scheduleSession(session, copy(a.state()));
        } catch (err) {
          a.openModal(
            'Review recorded time',
            `<p>${esc(err.message)} Your timer is paused and preserved.</p><p>Keep the session for later calendar review, or adjust its finishing time and try again.</p><form id="hubTimerFinish">${field('end', 'Actual finishing time', dateOf(new Date(session.end)) + 'T' + clock(new Date(session.end)), 'datetime-local', true)}<button class="primary" type="submit">Try adjusted time</button></form><div class="modal-actions">${btn('close', 'Keep timer paused')}${btn('timer-record-only', 'Save session for review')}</div>`
          );
          return;
        }
      }
      const ok = save(
        (h, d) => {
          if (h.sessions.some(s => s.id === session.id)) return;
          if (!skipCalendar) scheduleSession(session, d);
          h.sessions.push(session);
          root.WorkHubBatchEngine?.attachSession(d, session);
        },
        skipCalendar
          ? 'Session saved for calendar review.'
          : 'Session saved to Schedule' + (session.projectId ? ' and the project calendar.' : '.')
      );
      if (ok) {
        timerDraft = null;
        persistTimer();
        renderTimerBar();
        a.closeModal();
        a.refreshSchedule?.();
        workSchedule?.refreshActuals();
        confetti();
        return true;
      }
      return false;
    }
    workSchedule = root.WorkHubWorkSchedule?.install({
      ...a,
      timer: () => timerDraft,
      timerEditor,
    });
    function commands(query = '') {
      const q = query.toLowerCase().trim(),
        s = a.state(),
        rows = [
          ['go:home', 'Open My day'],
          ['go:tickets', 'Open Tickets'],
          ['go:tasks', 'Open Tasks'],
          ['go:schedule', 'Open Schedule'],
          ['go:specs', 'Open Projects'],
          ['go:notes', 'Open Notes'],
          ['go:knowledge', 'Open Knowledge'],
          ['go:processhub', 'Open Process Hub'],
          ['go:waiting', 'Open Waiting on'],
          ['go:studio', 'Open Studio'],
          ['go:validator', 'Open Validation Studio'],
          ['go:snippets', 'Open Snippets'],
          ['new-task', 'Add task'],
          ['new-ticket', 'Add ticket'],
          ['note-edit', 'Add knowledge note'],
          ['timer-new', 'Start work timer'],
        ];
      const results = [
        ...rows.map(([id, title]) => ({ id, title, type: 'command' })),
        ...s.tasks.map(t => ({ id: t.id, title: t.task, type: 'task-detail' })),
        ...s.tickets.map(t => ({
          id: t.id,
          title: t.ticket + ' · ' + t.description,
          type: 'ticket',
        })),
        ...s.projects.map(p => ({ id: p.id, title: p.name, type: 'project' })),
        ...data().notes.map(n => ({
          id: n.id,
          title: n.title + ' ' + n.tcodes,
          type: 'note-view',
        })),
        ...root.WorkHubRehearsalEngine.library(a.state()).map(p => ({
          id: p.id,
          title: p.name,
          type: 'process-open',
        })),
      ]
        .filter(x => x.title.toLowerCase().includes(q))
        .slice(0, 30);
      return (
        results
          .map(r =>
            btn(
              r.type === 'command' ? 'command' : r.type,
              esc(r.title),
              'data-id="' + esc(r.id) + '"',
              'hub-link-card'
            )
          )
          .join('') || '<p>No matching records or commands.</p>'
      );
    }
    function openCommands() {
      a.openModal(
        'Search & commands',
        `<label for="hubCommandQuery">Find a record or action</label><input id="hubCommandQuery" type="search" placeholder="Try a task, project, T-code, or Add task" autocomplete="off"><div id="hubCommandResults" class="hub-commands">${commands()}</div>`
      );
      $('hubCommandQuery').focus();
    }
    function navigate(t) {
      search = '';
      viewTab = t;
      a.navigate(t);
    }
    function exportTheme() {
      a.download(
        JSON.stringify({ app: 'mm-tracker-theme', version: 1, preferences: prefs() }, null, 2),
        'workhub-theme.json',
        'application/json'
      );
    }
    async function importTheme(file) {
      if (!file) return;
      if (file.size > 20000) throw Error('Theme files must be smaller than 20 KB.');
      const x = JSON.parse(await file.text());
      if (x.app !== 'mm-tracker-theme' || x.version !== 1)
        throw Error('Choose a WorkHub theme file.');
      const d = copy(a.state());
      d.workhub.preferences = { ...DEFAULTS, ...x.preferences };
      root.WorkHubAppearance.upgrade(d.workhub.preferences);
      validate(d);
      themePreview = null;
      save(h => (h.preferences = d.workhub.preferences), 'Theme imported.');
    }
    /** Run feature preparation hooks before the application validates and saves one document. */
    function prepare(next, previous, restoring = false) {
      upgrade(next);
      root.WorkHubClaimsEngine.prepare(next, previous, restoring);
      root.WorkHubValidatorEngine?.prepare(next, previous, restoring);
      root.WorkHubProjectDates.prepare(next, previous, today(), restoring);
      root.WorkHubProjectStandupEngine?.prepare(next, previous, restoring);
      root.WorkHubProjectPeopleEngine?.prepare(next, previous, restoring);
      root.WorkHubSolutionEngine?.prepare(next, previous, restoring);
      const h = next.workhub;
      for (const t of next.tickets) {
        const old = previous?.tickets.find(x => x.id === t.id),
          closed = x => ['Closed', 'Completed'].includes(x?.status),
          i = h.ticketClosures.findIndex(x => x.id === t.id);
        if (closed(t) && old && !closed(old)) {
          const entry = { id: t.id, date: today() };
          if (i < 0) h.ticketClosures.push(entry);
          else h.ticketClosures[i] = entry;
        }
        if (!closed(t) && i >= 0) h.ticketClosures.splice(i, 1);
      }
      for (const p of next.projects) {
        const old = previous?.projects.find(x => x.id === p.id);
        if (old && old.phase !== p.phase) {
          h.scrapbook.push({
            id: uid(),
            title: p.name + ' · ' + p.phase,
            date: today(),
            notes: 'Project phase advanced from ' + old.phase + '.',
            projectId: p.id,
          });
          if (h.scrapbook.length > 2000) h.scrapbook.shift();
        }
      }
      const oldTasks = new Map((previous?.tasks || []).map(t => [t.id, t]));
      for (const t of next.tasks) {
        if (t.done) {
          t.boardStatus = 'done';
          if (!oldTasks.get(t.id)?.done) {
            const completedAt = now();
            for (const sub of t.subTasks)
              if (sub.status !== 'Completed') {
                sub.status = 'Completed';
                sub.updatedAt = completedAt;
              }
          }
        } else if (t.boardStatus === 'done') t.boardStatus = 'todo';
      }
      root.WorkHubBatchEngine?.prepare(next, previous, restoring);
      root.WorkHubWorkLibraryEngine?.prepare(next, previous, restoring);
    }
    function saved(previous, next) {
      const before = previous.tasks.filter(t => t.done).length,
        after = next.tasks.filter(t => t.done).length,
        sub = d =>
          d.tasks.reduce((n, t) => n + t.subTasks.filter(s => s.status === 'Completed').length, 0),
        phase = next.projects.some(
          p => previous.projects.find(x => x.id === p.id)?.phase !== p.phase
        );
      if (after > before || sub(next) > sub(previous) || phase) confetti();
      else react('busy');
    }
    function arrangeTaskActions() {
      const art = {
        feedback: 'M21 11a8 8 0 0 1-8 8H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4ZM7 8h10M7 12h7',
        edit: 'M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
        archive: 'M4 8h16v12H4V8M3 3h18v5H3V3M9 12h6',
        reminder: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
        timer: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
      };
      for (const card of $('view').querySelectorAll('.task-main-card')) {
        const heading = card.querySelector('.task-card-heading');
        if (!heading) continue;
        let cluster = heading.querySelector('.task-action-cluster');
        if (!cluster) {
          cluster = document.createElement('div');
          cluster.className = 'task-action-cluster';
          cluster.setAttribute('role', 'group');
          cluster.setAttribute('aria-label', 'Main task actions');
          cluster.innerHTML =
            '<div class="task-action-status"></div><div class="task-action-buttons"></div>';
          heading.append(cluster);
        }
        const status = card.querySelector('[data-bench="status"][data-kind="tasks"]');
        if (status) cluster.querySelector('.task-action-status').append(status);
        const target = cluster.querySelector('.task-action-buttons'),
          footer = card.querySelector('.task-card-footer'),
          reminder = card.querySelector('.reminder-item-control'),
          timer = card.querySelector('[data-hub="timer-new"][data-kind="task"]');
        let feedback = card.querySelector('[data-hub="task-feedback"]');
        if (!feedback) {
          const id = card.querySelector('[data-action="edit"][data-group="tasks"]')?.dataset.id;
          if (id) {
            feedback = document.createElement('button');
            feedback.type = 'button';
            feedback.dataset.hub = 'task-feedback';
            feedback.dataset.id = id;
            feedback.textContent = 'Add feedback';
          }
        }
        const controls = [
          ...(feedback ? [feedback] : []),
          ...(footer?.querySelectorAll('button') || []),
          ...(reminder?.querySelectorAll('button') || []),
          ...(timer ? [timer] : []),
        ];
        for (const b of controls) {
          const type = b.dataset.reminder
            ? 'reminder'
            : b.dataset.hub === 'task-feedback'
              ? 'feedback'
              : b.dataset.hub === 'timer-new'
                ? 'timer'
                : b.dataset.action === 'edit'
                  ? 'edit'
                  : 'archive';
          b.classList.add('task-action-button', 'task-action-' + type);
          if (!b.querySelector('svg'))
            b.insertAdjacentHTML(
              'afterbegin',
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
                art[type] +
                '"/></svg>'
            );
          if (b.dataset.reminder && reminder) {
            target.append(reminder);
          } else target.append(b);
        }
        if (feedback) target.prepend(feedback);
        if (footer && !footer.children.length) footer.remove();
      }
    }
    /** Refresh the workspace shell and feature decorations after app.js renders a screen. */
    function afterRender(tab) {
      const feedbackForm = document.querySelector('.task-feedback-form, #historyForm');
      if (
        feedbackForm &&
        $('modal').open &&
        (!a.cloud().ready || feedbackForm.dataset.owner !== a.cloud().user?.id)
      )
        a.closeModal();
      batchA?.sync();
      validator?.sync();
      library?.sync();
      notes?.sync();
      reader?.sync();
      batchC?.sync();
      myDay?.sync();
      standup?.sync();
      people?.sync();
      solution?.sync();
      if (tab !== 'studio' || currentTool !== 'theme') themePreview = null;
      if (sorting && !sorting.source.isConnected) clearSort();
      if (tab !== 'processhub') clearTimeout(walkTimer);
      viewTab = tab;
      mountChrome();
      chromeUX?.mount();
      reminders?.decorate(tab);
      projectDates?.decorate();
      batchA?.mount(tab);
      library?.mount();
      notes?.mount();
      reader?.mount();
      people?.mount();
      mountUndo();
      workSchedule?.mount(tab);
      myDay?.mount();
      document.body.classList.toggle('hub-focus', !!focus);
      const extra = $('hubBoardToggle');
      if (extra) extra.remove();
      if (tab === 'tasks' && !board) {
        const target = $('view').querySelector(
          '.workspace-heading .actions,.workspace-heading,.panel-top'
        );
        if (target) {
          const b = document.createElement('button');
          b.id = 'hubBoardToggle';
          b.dataset.hub = 'toggle-board';
          b.textContent = '▥ Board view';
          target.append(b);
        }
      }
      if (['tickets', 'tasks', 'specs'].includes(tab)) {
        const cards = $('view').querySelectorAll(
          tab === 'tasks' ? '.task-main-card' : tab === 'tickets' ? '.ticket-card' : '.item-card'
        );
        for (const card of cards) {
          const edit = card.querySelector('[data-action="edit"]');
          if (!edit) continue;
          const timer = document.createElement('button');
          timer.type = 'button';
          timer.className = 'small hub-private-only';
          timer.dataset.hub = 'timer-new';
          timer.dataset.kind = tab === 'tasks' ? 'task' : tab === 'tickets' ? 'ticket' : 'project';
          timer.dataset.id =
            tab === 'specs'
              ? a.state().specs.find(x => x.id === edit.dataset.id)?.projectId || ''
              : edit.dataset.id;
          if (tab === 'specs') timer.dataset.item = edit.dataset.id;
          timer.textContent = '◷ Track time';
          card.append(timer);
        }
      }
      if (tab === 'tasks') arrangeTaskActions();
      focusPanel?.mount();
      adventures?.mount();
      claims?.mount(tab);
      leaveBalances?.mount(tab);
      tng?.mount(tab);
      recipients?.mount(tab);
      wardrobe?.mount();
      backgrounds?.mount();
      experience?.mount();
      settingsPanel?.mount();
      rehearsal?.mount();
      tcodes?.mount();
    }
    const renderers = {
      home: dashboard,
      notes: () => notes?.render(),
      knowledge,
      processhub: processHub,
      waiting,
      studio,
      lab: () => workbench?.render(),
      validator: () => validator?.render(),
      snippets: () => library?.render(),
    };
    function render(tab) {
      if (viewTab !== tab) search = '';
      viewTab = tab;
      return tab === 'tasks' && board ? taskBoard() : renderers[tab]?.();
    }
    let undo = null,
      lastInteraction = Date.now();
    function remove(collection, id) {
      const found = data()[collection].find(x => x.id === id);
      if (!found) return;
      const record = copy(found);
      if (
        !confirm(
          collection === 'sessions'
            ? 'Delete this recorded session? Its existing Schedule and Project entries will be kept. You can undo this deletion from the workspace toolbar.'
            : 'Delete this record? You can undo this action.'
        )
      )
        return;
      if (
        save((h, d) => {
          if (collection === 'sessions') root.WorkHubScheduleEngine?.retain(d, record);
          h[collection] = h[collection].filter(x => x.id !== id);
        }, 'Deleted. Use Undo in the workspace toolbar to restore.')
      ) {
        undo = { collection, record };
        mountUndo();
        a.closeModal();
      }
    }
    function mountUndo() {
      let b = $('hubUndo');
      if (undo && !b) {
        b = document.createElement('button');
        b.id = 'hubUndo';
        b.dataset.hub = 'undo';
        b.textContent = '↶ Undo deletion';
        $('hubToolbar')?.append(b);
      }
      if (!undo) b?.remove();
    }
    function themeValues(form) {
      const v = {
        ...prefs(),
        ...Object.fromEntries(new FormData(form)),
        ...root.WorkHubAppearance.values(form, prefs()),
      };
      for (const k of Object.keys(v)) if (k.startsWith('color-')) delete v[k];
      v.radius = Number(v.radius);
      for (const k of ['sounds', 'mascot', 'roaming', 'desk', 'hobbies'])
        v[k] = form.elements.namedItem(k)?.checked ?? prefs()[k];
      return v;
    }
    async function handle(el) {
      const action = el.dataset.hub,
        id = el.dataset.id;
      if (action === 'header-edit') {
        $('settingsMenu').open = false;
        form(
          'Make the header yours',
          'hubHeaderForm',
          field('workspace', 'Website title', prefs().workspace, 'text', true) +
            field('headerSubtitle', 'Subtitle', data().headerSubtitle || '')
        );
        return;
      }
      if (action === 'drag-help') {
        a.tell(
          'Drag the dotted handle to move this item. Arrow keys work when the handle is focused.'
        );
        return;
      }
      if (action === 'close') {
        a.closeModal();
        return;
      }
      if (action === 'navigate') {
        navigate(el.dataset.tab);
        return;
      }
      if (action === 'commands') {
        openCommands();
        return;
      }
      if (action === 'command') {
        a.closeModal();
        if (id.startsWith('go:')) navigate(id.slice(3));
        else await handle({ dataset: { hub: id } });
        return;
      }
      if (action === 'quick') {
        a.openModal(
          'Make something happen',
          `<div class="hub-grid">${btn('new-task', '＋ Task')}${btn('new-ticket', '＋ Ticket')}${btn('new-item', '＋ Project item')}${btn('new-range', '＋ Schedule activity')}${btn('note-edit', '＋ Knowledge note')}${btn('waiting-edit', '＋ Follow-up')}</div>`
        );
        return;
      }
      if (action === 'new-task') {
        a.editRecord('tasks');
        return;
      }
      if (action === 'new-ticket') {
        a.editRecord('tickets');
        return;
      }
      if (action === 'new-item') {
        a.editRecord('specs');
        return;
      }
      if (action === 'new-range') {
        a.newRange();
        return;
      }
      if (action === 'task-edit') {
        a.editRecord('tasks', id);
        return;
      }
      if (action === 'task-detail') {
        taskDetail(id);
        return;
      }
      if (action === 'subtask-feedback') {
        recordUpdate('tasks', el.dataset.parent, id);
        return;
      }
      if (action === 'task-feedback') {
        recordUpdate('tasks', id);
        return;
      }
      if (action === 'item-feedback') {
        recordUpdate('specs', id, el.dataset.sub || '');
        return;
      }
      if (action === 'ticket-update') {
        recordUpdate('tickets', id);
        return;
      }
      if (action === 'subtask-edit') {
        a.editSub(el.dataset.parent, id || '');
        return;
      }
      if (action === 'subtask-complete') {
        completeSubtask(el.dataset.parent, id, el.dataset.detail === 'true');
        return;
      }
      if (action === 'project') {
        a.project(id);
        return;
      }
      if (action === 'ticket') {
        a.ticket(id);
        return;
      }
      if (action === 'item') {
        a.editRecord('specs', id);
        return;
      }
      if (action === 'booking') {
        a.viewBooking(el.dataset.date, el.dataset.time);
        return;
      }
      if (action === 'toggle-board') {
        board = !board;
        a.render();
        return;
      }
      if (action === 'layout') {
        layoutEditor();
        return;
      }
      if (action === 'widget-up') {
        myDay?.visual?.captureLayout();
        save(h => {
          const i = h.widgets.findIndex(w => w.id === id);
          if (i > 0) [h.widgets[i - 1], h.widgets[i]] = [h.widgets[i], h.widgets[i - 1]];
        });
        return;
      }
      if (action === 'widget-size') {
        myDay?.visual?.captureLayout();
        save(h => {
          const w = h.widgets.find(w => w.id === id);
          w.span = w.span === 'wide' ? 'normal' : 'wide';
        });
        return;
      }
      if (action === 'note-edit') {
        noteEditor(id);
        return;
      }
      if (action === 'note-view') {
        viewNote(id);
        return;
      }
      if (action === 'note-delete') {
        remove('notes', id);
        return;
      }
      if (action === 'note-copy') {
        const n = data().notes.find(n => n.id === id);
        try {
          await navigator.clipboard.writeText(
            [n.title, n.tcodes, n.body, n.configuration, n.errors, n.testing]
              .filter(Boolean)
              .join('\n\n')
          );
          a.tell('Note copied.');
        } catch {
          a.tell('Copy is unavailable here. Select the note text to copy it.', true);
        }
        return;
      }
      if (action === 'waiting-edit') {
        waitingEditor(id);
        return;
      }
      if (action === 'waiting-toggle') {
        const resolved = !data().waiting.find(w => w.id === id).resolved;
        save(h => {
          const w = h.waiting.find(w => w.id === id);
          w.resolved = resolved;
          w.resolvedAt = resolved ? now() : '';
        });
        if (resolved) confetti();
        return;
      }
      if (action === 'waiting-delete') {
        remove('waiting', id);
        return;
      }
      if (action === 'process-edit') {
        navigate('processhub');
        if (id) {
          rehearsal?.open(id);
          rehearsal?.beginDraft(false, rehearsal.model());
        } else rehearsal?.beginDraft(true);
        return;
      }
      if (action === 'process-open') {
        rehearsal?.open(id);
        processId = id;
        stepId = '';
        a.closeModal();
        navigate('processhub');
        return;
      }
      if (action === 'process-delete') {
        remove('processes', id);
        processId = '';
        return;
      }
      if (action === 'process-archive') {
        save(h => {
          const p = h.processes.find(p => p.id === id);
          p.archived = !p.archived;
        });
        processId = '';
        a.render();
        return;
      }
      if (action === 'process-archive-view') {
        processArchive = !processArchive;
        processId = '';
        stepId = '';
        a.render();
        return;
      }
      if (action === 'process-example') {
        exampleProcess();
        return;
      }
      if (action === 'step-edit') {
        stepEditor(el.dataset.process, id);
        return;
      }
      if (action === 'step-view') {
        clearTimeout(walkTimer);
        stepId = id;
        a.render();
        return;
      }
      if (action === 'step-up') {
        save(h => {
          const p = h.processes.find(p => p.id === processId),
            i = p.steps.findIndex(s => s.id === id);
          if (i > 0) [p.steps[i - 1], p.steps[i]] = [p.steps[i], p.steps[i - 1]];
        });
        return;
      }
      if (action === 'step-delete') {
        if (confirm('Delete this process step and its connections?')) {
          save(h => {
            const p = h.processes.find(p => p.id === processId);
            p.steps = p.steps.filter(s => s.id !== id);
            p.steps.forEach(s => (s.next = s.next.filter(x => x !== id)));
          });
          stepId = '';
          a.render();
        }
        return;
      }
      if (action === 'walk') {
        walk();
        return;
      }
      if (action === 'walk-stop') {
        clearTimeout(walkTimer);
        processDeck?.close();
        return;
      }
      if (action === 'tool') {
        $('settingsMenu').open = false;
        currentTool = el.dataset.tool;
        a.closeModal();
        navigate(currentTool === 'simulator' ? 'processhub' : 'studio');
        return;
      }
      if (action === 'theme-export') {
        exportTheme();
        return;
      }
      if (action === 'theme-import') {
        $('hubThemeFile').click();
        return;
      }
      if (action === 'theme-reset-preview') {
        themePreview = null;
        applyTheme();
        a.render();
        return;
      }
      if (action === 'theme-choice') {
        const form = $('hubTheme');
        form.elements.namedItem('theme').value = el.dataset.themeChoice;
        previewTheme(form);
        return;
      }
      if (action === 'celebrate' || action === 'scrap-replay') {
        confetti();
        react('happy', 'A moment worth celebrating.');
        return;
      }
      if (action === 'pet') {
        if (Date.now() < petSuppressClickUntil) return;
        if (life) {
          life.menu();
          return;
        }
        const lines = [
          'One small step is still progress.',
          'Need a calmer space? Try Studio → Theme studio.',
          'Your records, your rhythm.',
          'Take a breath. Pick your next step.',
        ];
        react('happy', lines[Math.floor(Math.random() * lines.length)]);
        return;
      }
      if (action === 'privacy') {
        document.body.classList.toggle('hub-private');
        syncViewModes();
        return;
      }
      if (action === 'presentation') {
        document.body.classList.toggle('hub-present');
        syncViewModes();
        return;
      }
      if (action === 'focus-start') {
        startFocus($('hubFocusForm'));
        return;
      }
      if (action === 'focus-stop') {
        endFocus();
        return;
      }
      if (action === 'scrap-edit') {
        const x = data().scrapbook.find(x => x.id === id) || {};
        form(
          'Milestone keepsake',
          'hubScrap',
          field('title', 'Title', x.title, 'text', true) +
            field('date', 'Date', x.date || today(), 'date', true) +
            select('projectId', 'Project', projects(), x.projectId) +
            field('notes', 'What went well / lessons learned', x.notes, 'textarea'),
          id
        );
        return;
      }
      if (action === 'scrap-delete') {
        remove('scrapbook', id);
        return;
      }
      if (action === 'timer-drag') return;
      if (action === 'timer-minimize') {
        timerMinimized = !timerMinimized;
        rememberTimerPosition();
        renderTimerBar();
        return;
      }
      if (action === 'palette-save') {
        const f = $('hubTheme'),
          name = $('workspacePaletteName')?.value.trim();
        if (!name || name.length > 60)
          throw Error('Give the colour combination a name, up to 60 characters.');
        const p = themeValues(f),
          existing = p.palettes.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (!existing && p.palettes.length >= 12)
          throw Error('You can keep 12 combinations. Delete one to make room.');
        const entry = root.WorkHubAppearance.palette(p, name);
        if (existing) {
          entry.id = existing.id;
          p.palettes = p.palettes.map(x => (x.id === existing.id ? entry : x));
        } else p.palettes = [...p.palettes, entry];
        themePreview = null;
        save(h => (h.preferences = p), 'Colour combination saved.');
        return;
      }
      if (action === 'palette-load' || action === 'palette-delete') {
        const selected = $('workspacePalette')?.value,
          p = prefs(),
          entry = p.palettes.find(x => x.id === selected);
        if (!entry) throw Error('Choose a saved combination first.');
        themePreview = null;
        if (action === 'palette-delete')
          save(
            h => (h.preferences.palettes = h.preferences.palettes.filter(x => x.id !== selected)),
            'Colour combination deleted.'
          );
        else
          save(
            h =>
              (h.preferences = {
                ...h.preferences,
                theme: 'custom',
                accent: entry.accent,
                colors: { ...entry.colors },
                background: entry.background,
              }),
            'Colour combination applied and saved.'
          );
        return;
      }
      if (action === 'timer-switch') {
        timerEditor('custom', '', '', '', '', true);
        return;
      }
      if (action === 'timer-new') {
        timerEditor(
          el.dataset.kind || 'custom',
          id || '',
          el.dataset.sub || '',
          el.dataset.item || '',
          el.dataset.subitem || '',
          !!timerDraft
        );
        return;
      }
      if (action === 'timer-pause') {
        if (batchA) batchA.pauseTimerPrompt();
        else pauseTimer();
        return;
      }
      if (action === 'timer-resume') {
        resumeTimer();
        return;
      }
      if (action === 'timer-stop') {
        if (batchA) batchA.wrapTimerPrompt();
        else finishTimer();
        return;
      }
      if (action === 'timer-record-only') {
        finishTimer(true);
        return;
      }
      if (action === 'timer-notes') {
        form(
          'Session remarks',
          'hubTimerNotes',
          field('notes', 'Remarks while you work', timerDraft?.notes || '', 'textarea')
        );
        return;
      }
      if (action === 'session-view') {
        if (['active', 'archived', 'all'].includes(el.dataset.view)) {
          sessionView = el.dataset.view;
          a.render();
        }
        return;
      }
      if (action === 'session-archive' || action === 'session-restore') {
        save(
          h => {
            const s = h.sessions.find(s => s.id === id);
            if (!s) throw Error('This session is no longer available.');
            s.archived = action === 'session-archive';
          },
          action === 'session-archive'
            ? 'Session archived. Restore it from Archived whenever you like.'
            : 'Session restored.'
        );
        return;
      }
      if (action === 'session-delete') {
        remove('sessions', id);
        return;
      }
      if (action === 'session-retry') {
        save((h, d) => {
          const s = h.sessions.find(s => s.id === id);
          if (!s || s.scheduled || s.archived) return;
          scheduleSession(s, d);
        }, 'Session added to the calendar.');
        return;
      }
      if (action === 'undo' && undo) {
        const u = undo;
        if (
          save(h => {
            if (h[u.collection].some(r => r.id === u.record.id))
              throw Error('This record already exists.');
            h[u.collection].push(
              u.collection === 'sessions'
                ? copy(h.daySchedule?.retained.find(s => s.id === u.record.id) || u.record)
                : u.record
            );
          }, 'Deletion undone.')
        ) {
          undo = null;
          mountUndo();
        }
        return;
      }
    }
    /** Dispatch known workspace forms and save reviewed record changes through the shared adapter. */
    function submit(form) {
      const values = Object.fromEntries(new FormData(form)),
        id = form.dataset.id;
      if (Object.values(updateForms).some(config => config.id === form.id)) {
        saveRecordUpdate(form);
        return;
      }
      if (form.id === 'hubFocusForm') {
        startFocus(form);
        return;
      }
      if (form.id === 'hubHeaderForm') {
        if (!values.workspace.trim()) throw Error('Enter a website title.');
        save(h => {
          h.preferences.workspace = values.workspace.trim();
          h.headerSubtitle = values.headerSubtitle.trim();
        }, 'Header updated.');
        a.closeModal();
        return;
      }
      if (form.id === 'hubTheme') {
        const p = themeValues(form),
          d = copy(a.state());
        d.workhub.preferences = p;
        validate(d);
        themePreview = null;
        if (save(h => (h.preferences = p), 'Your theme is saved.')) {
          applyTheme();
          if ($('hubThemeStatus')) {
            $('hubThemeStatus').textContent = 'Theme saved · your look is active.';
            $('hubThemeStatus').dataset.saved = 'true';
          }
        } else {
          themePreview = p;
          applyTheme(p);
        }
        return;
      }
      if (form.id === 'hubNote') {
        const n = {
          ...data().notes.find(n => n.id === id),
          id: id || uid(),
          ...Object.fromEntries(
            [
              'title',
              'body',
              'tags',
              'tcodes',
              'configuration',
              'errors',
              'testing',
              'projectId',
              'ticketId',
              'itemId',
            ].map(k => [k, (values[k] || '').trim()])
          ),
          updatedAt: now(),
        };
        save((h, d) => {
          const i = h.notes.findIndex(x => x.id === id);
          if (i >= 0) h.notes[i] = n;
          else h.notes.push(n);
          batchA?.capture(d, form, 'notes', n.id);
        });
        a.closeModal();
        return;
      }
      if (form.id === 'hubWaiting') {
        const old = data().waiting.find(w => w.id === id),
          w = {
            id: id || uid(),
            title: values.title.trim(),
            person: values.person.trim(),
            followUp: values.followUp,
            notes: values.notes,
            projectId: values.projectId,
            resolved: old?.resolved || false,
            createdAt: old?.createdAt || now(),
            resolvedAt: old?.resolvedAt || '',
          };
        save(h => {
          const i = h.waiting.findIndex(x => x.id === id);
          if (i >= 0) h.waiting[i] = w;
          else h.waiting.push(w);
        });
        a.closeModal();
        return;
      }
      if (form.id === 'hubProcessForm') {
        const old = data().processes.find(p => p.id === id),
          p = {
            id: id || uid(),
            name: values.name.trim(),
            description: values.description,
            archived: old?.archived || false,
            steps: old?.steps || [],
          };
        save(h => {
          const i = h.processes.findIndex(x => x.id === id);
          if (i >= 0) h.processes[i] = p;
          else h.processes.push(p);
        });
        processId = p.id;
        a.closeModal();
        a.render();
        return;
      }
      if (form.id === 'hubStep') {
        const s = {
          id: id || uid(),
          ...Object.fromEntries(
            [
              'title',
              'tcodes',
              'notes',
              'configuration',
              'prerequisites',
              'errors',
              'testing',
              'projectId',
              'ticketId',
              'itemId',
              'noteId',
            ].map(k => [k, (values[k] || '').trim()])
          ),
          next: [...form.querySelectorAll('[name="next"]:checked')].map(x => x.value),
        };
        save(h => {
          const p = h.processes.find(p => p.id === values.processId),
            i = p.steps.findIndex(s => s.id === id);
          if (i >= 0) p.steps[i] = s;
          else p.steps.push(s);
        });
        processId = values.processId;
        stepId = s.id;
        a.closeModal();
        a.render();
        return;
      }
      if (form.id === 'hubLayout') {
        const selected = [...form.querySelectorAll('[name="widget"]:checked')].map(x => x.value);
        save(h => {
          h.widgets = [
            ...h.widgets.filter(w => selected.includes(w.id)),
            ...selected
              .filter(id => !h.widgets.some(w => w.id === id))
              .map(id => ({ id, span: 'normal' })),
          ];
        });
        a.closeModal();
        return;
      }
      if (form.id === 'hubTimerStart') {
        if (!form.isConnected || form.dataset.owner !== a.cloud().user?.id)
          throw Error('Reopen the work form in the correct account.');
        startTimer(
          { ...values, allocationKey: form.dataset.allocation || '' },
          form.dataset.switch === 'true'
        );
        return;
      }
      if (form.id === 'hubTimerNotes') {
        if (!timerDraft) throw Error('The timer is no longer active.');
        timerDraft.notes = values.notes;
        persistTimer();
        a.closeModal();
        return;
      }
      if (form.id === 'hubTimerFinish') {
        finishTimer(false, values.end);
        return;
      }
      if (form.id === 'hubScrap') {
        const x = {
          id: id || uid(),
          title: values.title.trim(),
          date: values.date,
          notes: values.notes,
          projectId: values.projectId,
        };
        save(h => {
          const i = h.scrapbook.findIndex(x => x.id === id);
          if (i >= 0) h.scrapbook[i] = x;
          else h.scrapbook.push(x);
        });
        a.closeModal();
        return;
      }
    }
    // Pointer-based sorting works with a mouse or touch; only handles capture gestures.
    let sorting = null,
      sortSuppressClickUntil = 0;
    function clearSort(committing = false) {
      if (!sorting) return null;
      const done = sorting;
      sorting = null;
      if (done.type === 'widget') myDay?.visual?.endSort(committing);
      done.ghost?.remove();
      done.source.classList.remove('hub-dragging');
      document
        .querySelectorAll('.hub-drop-target')
        .forEach(el => el.classList.remove('hub-drop-target'));
      document.body.classList.remove('hub-sorting');
      try {
        done.handle.releasePointerCapture?.(done.pointerId);
      } catch {}
      return done;
    }
    function reorderWidget(id, targetId) {
      if (id === targetId) return;
      myDay?.visual?.captureLayout();
      save(h => {
        const from = h.widgets.findIndex(w => w.id === id),
          to = h.widgets.findIndex(w => w.id === targetId);
        if (from >= 0 && to >= 0) h.widgets.splice(to, 0, h.widgets.splice(from, 1)[0]);
      }, 'Dashboard rearranged.');
    }
    document.addEventListener('pointerdown', event => {
      const handle = event.target.closest?.('[data-hub-drag]');
      if (!handle || event.button > 0) return;
      const type = handle.dataset.hubDrag,
        source = handle.closest(type === 'widget' ? '[data-widget]' : '[data-task-card]');
      if (!source) return;
      event.preventDefault();
      sorting = {
        type,
        source,
        handle,
        pointerId: event.pointerId,
        id: type === 'widget' ? source.dataset.widget : source.dataset.taskCard,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: null,
      };
      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch {}
    });
    document.addEventListener(
      'pointermove',
      event => {
        if (!sorting || event.pointerId !== sorting.pointerId) return;
        if (!sorting.moved && Math.hypot(event.clientX - sorting.x, event.clientY - sorting.y) < 6)
          return;
        event.preventDefault();
        if (!sorting.moved) {
          sorting.moved = true;
          sorting.source.classList.add('hub-dragging');
          document.body.classList.add('hub-sorting');
          const ghost = sorting.source.cloneNode(true);
          ghost.removeAttribute('id');
          ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
          ghost.className =
            'hub-sort-ghost hub-card' +
            (sorting.source.closest('.my-day-page') ? ' mv-sort-ghost' : '');
          ghost.setAttribute('aria-hidden', 'true');
          ghost.inert = true;
          const rect = sorting.source.getBoundingClientRect();
          Object.assign(ghost.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '1000',
            width: Math.min(rect.width || 300, root.innerWidth - 32, 400) + 'px',
            maxHeight: '170px',
            overflow: 'hidden',
            opacity: '.96',
            transform: 'rotate(-2deg)',
            margin: '0',
          });
          document.body.append(ghost);
          sorting.ghost = ghost;
        }
        Object.assign(sorting.ghost.style, {
          left: Math.max(8, Math.min(root.innerWidth - 120, event.clientX - 70)) + 'px',
          top: Math.max(8, event.clientY - 30) + 'px',
        });
        const hit = document.elementFromPoint?.(event.clientX, event.clientY),
          target = hit?.closest(sorting.type === 'widget' ? '[data-widget]' : '[data-column]');
        document
          .querySelectorAll('.hub-drop-target')
          .forEach(el => el.classList.remove('hub-drop-target'));
        const previewGrid = sorting.type === 'widget' && sorting.source.closest('.hub-layout'),
          overPreview =
            sorting.target &&
            previewGrid &&
            (target === sorting.source || (!target && hit?.closest('.hub-layout') === previewGrid));
        if (!overPreview) sorting.target = target && target !== sorting.source ? target : null;
        sorting.target?.classList.add('hub-drop-target');
        if (sorting.type === 'widget') {
          myDay?.visual?.previewSort(sorting.source, sorting.target);
          // Reparenting the preview can release capture; keep the gesture bound to its handle.
          try {
            sorting.handle.setPointerCapture?.(sorting.pointerId);
          } catch {}
        }
        if (event.clientY < 65) root.scrollBy?.(0, -14);
        else if (event.clientY > root.innerHeight - 65) root.scrollBy?.(0, 14);
        if (sorting.type === 'task') {
          const board = document.querySelector('.hub-board'),
            rect = board?.getBoundingClientRect();
          if (rect) {
            if (event.clientX > rect.right - 40) board.scrollLeft += 12;
            else if (event.clientX < rect.left + 40) board.scrollLeft -= 12;
          }
        }
      },
      { passive: false }
    );
    document.addEventListener('pointerup', event => {
      if (!sorting || event.pointerId !== sorting.pointerId) return;
      const done = clearSort(!!sorting.target && sorting.moved);
      if (!done.moved) return;
      sortSuppressClickUntil = Date.now() + 600;
      event.preventDefault();
      if (!done.target) return;
      try {
        if (done.type === 'widget') reorderWidget(done.id, done.target.dataset.widget);
        else moveTask(done.id, done.target.dataset.column);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('pointercancel', event => {
      if (sorting && event.pointerId === sorting.pointerId) clearSort();
    });
    document.addEventListener('keydown', event => {
      const handle = event.target.closest?.('[data-hub-drag]');
      if (!handle) return;
      try {
        if (handle.dataset.hubDrag === 'widget' && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const id = handle.closest('[data-widget]').dataset.widget,
            widgets = data().widgets,
            i = widgets.findIndex(w => w.id === id),
            next = widgets[i + (event.key === 'ArrowUp' ? -1 : 1)];
          if (next) {
            reorderWidget(id, next.id);
            document.querySelector('[data-widget="' + id + '"] [data-hub-drag]')?.focus();
          }
        }
        if (handle.dataset.hubDrag === 'task' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          const id = handle.closest('[data-task-card]').dataset.taskCard,
            t = a.state().tasks.find(t => t.id === id),
            keys = Object.keys(BOARD),
            i = keys.indexOf(taskStatus(t)),
            next = keys[i + (event.key === 'ArrowLeft' ? -1 : 1)];
          if (next) {
            moveTask(id, next);
            [...document.querySelectorAll('[data-task-card]')]
              .find(el => el.dataset.taskCard === id)
              ?.querySelector('[data-hub-drag]')
              ?.focus();
          }
        }
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener(
      'click',
      event => {
        const el = event.target.closest?.('[data-hub]');
        if (!el) return;
        if (el.dataset.hub === 'drag-help' && Date.now() < sortSuppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        lastInteraction = Date.now();
        void handle(el).catch(err => a.tell(err.message, true));
      },
      true
    );
    document.addEventListener('submit', event => {
      if (!event.target.id.startsWith('hub')) return;
      event.preventDefault();
      try {
        submit(event.target);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'hubFocusMinutes' && !focus) {
        const minutes = Number(event.target.value);
        if (validFocusMinutes(minutes)) {
          focusMinutes = minutes;
          if ($('hubFocusClock')) {
            $('hubFocusClock').textContent = String(minutes).padStart(2, '0') + ':00';
            $('hubFocusClock').dataset.long = String(minutes >= 1000);
          }
        }
        return;
      }
      const el = event.target;
      if (el.id === 'hubSearch') {
        search = el.value;
        const start = el.selectionStart;
        a.render();
        const input = $('hubSearch');
        input?.focus();
        input?.setSelectionRange(start, start);
      }
      if (el.id === 'hubCommandQuery') $('hubCommandResults').innerHTML = commands(el.value);
      if (el.form?.id === 'hubTheme') {
        try {
          if (el.name === 'accent' || el.name.startsWith('color-'))
            el.form.elements.namedItem('theme').value = 'custom';
          previewTheme(el.form);
        } catch {}
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      try {
        if (['hubItemFeedbackTarget', 'hubTaskFeedbackTarget'].includes(el.id))
          refreshFeedbackHistory(el.form);
        if (el.form?.id === 'hubTheme') previewTheme(el.form);
        if (el.dataset.hubMove) moveTask(el.dataset.hubMove, el.value);
        if (el.id === 'hubProcess') {
          clearTimeout(walkTimer);
          processId = el.value;
          stepId = '';
          a.render();
        }
        if (el.form?.id === 'hubTimerStart' && ['kind', 'linkId', 'itemId'].includes(el.name)) {
          const form = el.form,
            kind = form.elements.namedItem('kind').value,
            id = el.name === 'kind' ? '' : form.elements.namedItem('linkId')?.value || '',
            rows = timerRows(kind);
          if (el.name === 'itemId')
            $('hubTimerProjectItems').innerHTML = projectTimerFields(id, el.value);
          else
            $('hubTimerLink').innerHTML =
              (kind === 'custom'
                ? ''
                : select('linkId', 'Linked record', rows, id, 'Choose record')) +
              (kind === 'task'
                ? select(
                    'subTaskId',
                    'Optional subtask',
                    (a.state().tasks.find(t => t.id === id)?.subTasks || [])
                      .filter(s => !s.done && s.status !== 'Completed')
                      .map(s => [s.id, s.title]),
                    ''
                  )
                : '') +
              (kind === 'project'
                ? '<div id="hubTimerProjectItems">' + projectTimerFields(id) + '</div>'
                : '');
          if (el.name !== 'itemId') $('hubTimerCharge').innerHTML = timerChargeFields(kind, id);
        }

        if (el.id === 'hubThemeFile')
          void importTheme(el.files[0]).catch(err => a.tell(err.message, true));
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('dragstart', event => {
      const card = event.target.closest?.('[data-task-card],[data-widget]');
      if (!card || event.target.closest?.('button,input,select,textarea')) return;
      dragId = card.dataset.taskCard
        ? 'task:' + card.dataset.taskCard
        : 'widget:' + card.dataset.widget;
      event.dataTransfer?.setData('text/plain', dragId);
    });
    document.addEventListener('dragover', event => {
      if (event.target.closest?.('[data-column],[data-widget]')) event.preventDefault();
    });
    document.addEventListener('drop', event => {
      const col = event.target.closest?.('[data-column]'),
        widget = event.target.closest?.('[data-widget]');
      if (!col && !widget) return;
      event.preventDefault();
      const value = event.dataTransfer?.getData('text/plain') || dragId;
      try {
        if (col && value.startsWith('task:')) moveTask(value.slice(5), col.dataset.column);
        else if (widget && value.startsWith('widget:'))
          save(h => {
            const from = h.widgets.findIndex(w => w.id === value.slice(7)),
              to = h.widgets.findIndex(w => w.id === widget.dataset.widget);
            if (from >= 0 && to >= 0) h.widgets.splice(to, 0, h.widgets.splice(from, 1)[0]);
          });
      } catch (err) {
        a.tell(err.message, true);
      }
      dragId = '';
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommands();
      }
      if (event.key === 'Escape' && document.body.classList.contains('hub-present')) {
        document.body.classList.remove('hub-present');
        syncViewModes();
      }
    });
    document.addEventListener(
      'pointerdown',
      () => {
        lastInteraction = Date.now();
        if (document.body.dataset.mascotMood === 'sleep') document.body.dataset.mascotMood = 'idle';
      },
      { passive: true }
    );
    root.addEventListener('storage', event => {
      if (event.key === timerKey()) {
        timerOwner = '';
        recoverTimer();
        renderTimerBar();
      }
    });
    setInterval(() => {
      soundscape?.tick();
      processDeck?.tick();
      myDay?.tick();
      if (document.hidden) return;
      workbench?.tick();
      atmosphere?.tick();
      wardrobe?.tick();
      experience?.tick();
      adventures?.tick();
      life?.tick();
      moments?.tick();
      tickCompanion();
      if ($('hubTimerClock') && $('hubTimerClock').textContent !== timerText())
        $('hubTimerClock').textContent = timerText();
      if (focus) {
        if ($('hubFocusClock') && $('hubFocusClock').textContent !== focusText())
          $('hubFocusClock').textContent = focusText();
        if (!focus.pausedAt && Date.now() >= focus.end) {
          focus = null;
          document.body.classList.remove('hub-focus');
          confetti();
          a.tell('Focus session complete. Take a moment to recharge.');
          renderFocus();
        }
      }
      focusPanel?.tick();
      if (Date.now() - lastInteraction > 120000 && !petWalk)
        document.body.dataset.mascotMood = 'sleep';
    }, 1000);
    myDay = root.WorkHubMyDay.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      prefs,
      layout: layoutEditor,
      focus: focusSnapshot,
      startFocus: (minutes, taskId) =>
        startFocus({
          elements: { namedItem: k => ({ value: k === 'minutes' ? String(minutes) : taskId }) },
        }),
      pauseFocus,
      endFocus,
      task: taskDetail,
      completeTask: id => moveTask(id, 'done'),
      track: id => timerEditor('task', id),
      pauseWork: () => {
        if (!timerDraft?.runningSince) return null;
        const token = { id: timerDraft.id, started: timerDraft.started };
        pauseTimer();
        return token;
      },
      resumeWork: token => {
        if (
          timerDraft?.id === token.id &&
          timerDraft.started === token.started &&
          !timerDraft.runningSince
        )
          resumeTimer();
      },
      resumeFocus: token => {
        if (focus?.pausedAt && focus.start === token.start) pauseFocus();
      },
      soundscape: () => soundscape,
    });
    life = root.WorkHubMomoLife?.install({
      prefs: () => themePreview || prefs(),
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      weather: () =>
        atmosphere?.snapshot().preferences.rain ? 'rain' : atmosphere?.snapshot().weather,
      remember: (kind, detail) => adventures?.remember(kind, detail),
      contextLine: () => adventures?.contextLine(),
      canResume: () =>
        !adventures?.snapshot().active &&
        !adventures?.snapshot().bookmark &&
        !moments?.snapshot().active,
      pinned: () => companionPinned,
      pin: pinCompanion,
      habitat: () => a.state().workhub.experience?.appearance.habitat || 'auto',
      pet: () => $('hubPet'),
      move: positionCompanion,
      stop: stopCompanionWalk,
      react,
    });
    atmosphere = root.WorkHubAtmosphere?.install({
      lighting: () => a.state().workhub.experience?.appearance.lighting || 'auto',
      ready: () => a.cloud().ready,
      prefs: () => themePreview || prefs(),
      react,
      tell: a.tell,
      openModal: a.openModal,
      closeModal: a.closeModal,
      visitor: kind => moments?.visitor(kind),
      visitorArrived: kind => adventures?.visitorArrived(kind),
      visitorHello: kind => adventures?.visitorHello(kind),
      visitorEnd: () => {
        moments?.visitorEnd();
        adventures?.visitorEnd();
      },
    });
    workbench = root.WorkHubWorkbench?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      hubAction: handle,
      prefs: () => themePreview || prefs(),
      life: () => life,
      moments: () => moments,
      react,
    });
    batchA = root.WorkHubBatchA?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      hubAction: handle,
      timer: () => timerDraft,
      pauseTimer,
      resumeTimer,
      finishTimer,
      persistTimer,
    });
    library = root.WorkHubWorkLibrary?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      hubAction: handle,
    });
    notes = root.WorkHubNotes?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    validator = root.WorkHubValidatorStudio?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      fieldLibrary: (source, onInsert) => library?.openFields(source, onInsert),
    });
    reader = root.WorkHubDataReader?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    soundscape = root.WorkHubSoundscape?.install({
      ready: () => a.cloud().ready,
      tell: a.tell,
      openModal: a.openModal,
    });
    rehearsal = root.WorkHubRehearsal?.install({
      ...a,
      active: () => viewTab === 'processhub',
      recordLinks,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      prefs: () => themePreview || prefs(),
    });
    tcodes = root.WorkHubSapTcodes?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    projectDates = root.WorkHubProjectDates.install(a);
    standup = root.WorkHubProjectStandup?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      hubAction: handle,
    });
    batchC = root.WorkHubBatchC?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    people = root.WorkHubProjectPeople?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    solution = root.WorkHubSolutionStudio?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    processDeck = root.WorkHubProcessDeck.install({
      ...a,
      ready: () => a.cloud().ready,
      onSelect: (pid, sid) => {
        processId = pid;
        stepId = sid;
      },
    });
    chromeUX = root.WorkHubChromeUX.install({ prefs: () => themePreview || prefs() });
    moments = root.WorkHubMomoMoments?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      prefs: () => themePreview || prefs(),
      life: () => life,
      workbench: () => workbench,
      move: positionCompanion,
      canAutoMove: () => !companionPinned,
      react,
    });
    focusPanel = root.WorkHubFocusPanel?.install({
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      tasks: () => a.state().tasks.filter(t => !t.done && !t.archived),
      focus: focusSnapshot,
      start: (minutes, task) =>
        startFocus({
          elements: { namedItem: k => ({ value: k === 'minutes' ? String(minutes) : task }) },
        }),
      pause: pauseFocus,
      end: endFocus,
      reset: endFocus,
      soundscape: () => soundscape,
      tell: a.tell,
    });
    adventures = root.WorkHubMomoAdventures?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      prefs: () => themePreview || prefs(),
      life: () => life,
      moments: () => moments,
      atmosphere: () => atmosphere,
      workbench: () => workbench,
      move: positionCompanion,
      stop: stopCompanionWalk,
      canAutoMove: () => !companionPinned,
      react,
    });
    claims = root.WorkHubClaims.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    leaveBalances = root.WorkHubLeaveBalances.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    tng = root.WorkHubTng.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    recipients = root.WorkHubRecipients.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    wardrobe = root.WorkHubMomoWardrobe.install({
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      prefs: () => themePreview || prefs(),
      life: () => life,
      openModal: a.openModal,
      closeModal: a.closeModal,
      tell: a.tell,
      appearance: () => handle({ dataset: { hub: 'tool', tool: 'theme' } }),
    });
    root.addEventListener('workhub:momo-wardrobe', () => wardrobe.gallery());
    backgrounds = root.WorkHubPhotoBackground?.install({
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      openModal: a.openModal,
      closeModal: a.closeModal,
      tell: a.tell,
      refreshTheme: applyTheme,
    });
    experience = root.WorkHubExperience?.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
      prefs: () => themePreview || prefs(),
      life: () => life,
      hubAction: handle,
      react,
    });
    settingsPanel = root.WorkHubSettings.install({
      ...a,
      ready: () => a.cloud().ready,
      owner: () => a.cloud().user?.id || '',
    });
    return {
      myDay,
      experience,
      settingsPanel,
      recipients,
      claims,
      leaveBalances,
      tng,
      adventures,
      batchA,
      validator,
      library,
      notes,
      reader,
      patchReader: () => currentTool === 'reader' && reader?.patchRender(),
      batchC,
      standup,
      people,
      solution,
      rehearsal,
      tcodes,
      focusPanel,
      focusSnapshot,
      reminders,
      life,
      wardrobe,
      backgrounds,
      atmosphere,
      workbench,
      soundscape,
      moments,
      projectDates,
      processDeck,
      chromeUX,
      render,
      afterRender,
      prepare,
      saved,
      handle,
      submit,
      upgrade,
      validate,
      moveTask,
      simulationValues,
      sessionRanges,
      scheduleSession,
      workSchedule,
      timerEditor,
      startTimer,
      pauseTimer,
      resumeTimer,
      finishTimer,
      timer: () => timerDraft,
      importTheme,
      themeValues,
      setBoard(value) {
        board = value;
      },
      setTool(value) {
        currentTool = value;
      },
      currentTool: () => currentTool,
      refreshTheme: applyTheme,
    };
  }
  root.WorkHubStudio = {
    upgrade,
    validate,
    install,
    DEFAULTS,
    WIDGETS,
    subtaskCompletionButton,
    subtaskFeedbackButton,
  };
})(window);
