/** Interactive My Day widgets. Account records use the shared app adapter; clocks and gestures stay local. */
(function (root) {
  'use strict';
  const E = root.WorkHubMyDayEngine;
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (action, label, extra = '', cls = '') =>
    `<button type="button" class="md-button ${cls}" data-md="${action}" ${extra}>${label}</button>`;
  const field = (name, label, value = '', type = 'text', extra = '') =>
    `<label class="md-field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const select = (name, label, rows, value, blank = 'Choose…') =>
    `<label class="md-field">${esc(label)}<select name="${name}">${blank !== null ? `<option value="">${esc(blank)}</option>` : ''}${rows.map(([id, text]) => `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  const area = (name, label, value = '', max = 4000) =>
    `<label class="md-field md-wide">${esc(label)}<textarea name="${name}" maxlength="${max}" rows="4">${esc(value)}</textarea></label>`;
  const check = (name, label, checked) =>
    `<label class="md-check"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}>${esc(label)}</label>`;
  const meta = text => `<p class="md-meta">${text}</p>`;
  const duration = n =>
    n >= 60
      ? `${Math.floor(n / 60)}h${Math.round(n % 60) ? ' ' + Math.round(n % 60) + 'm' : ''}`
      : `${Math.round(n)}m`;
  const blank = (title, text, action = '') =>
    `<div class="md-empty"><span aria-hidden="true">✧</span><h4>${esc(title)}</h4><p>${esc(text)}</p>${action}</div>`;
  const clockText = n =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  function install(a) {
    const $ = id => document.getElementById(id),
      state = () => a.state(),
      store = () => E.store(state()),
      today = () => a.today();
    let owner = '',
      selected = new Set(),
      expanded = new Set(),
      activeGroup = '',
      radarKind = '',
      upIndex = 0,
      gapMinutes = 20,
      replayMinute = 1440,
      drag = null,
      activityMove = null,
      suppressUntil = 0,
      audio = null,
      lastMissionCount = null;
    const contexts = new WeakMap();
    const visual = root.WorkHubMyDayVisuals.install({
      ready: a.ready,
      owner: a.owner,
      prefs: a.prefs,
      settings: () => store().settings,
      layout: a.layout,
    });
    const rest = root.WorkHubRestRoom.install({
      ready: a.ready,
      owner: a.owner,
      prefs: a.prefs,
      motion: () => a.prefs().motion !== 'off' && store().settings.effects !== 'calm',
      focus: a.focus,
      pauseFocus: a.pauseFocus,
      resumeFocus: a.resumeFocus,
      pauseWork: a.pauseWork,
      resumeWork: a.resumeWork,
      soundscape: a.soundscape,
      tell: a.tell,
      change: () => refresh('terrarium'),
    });
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        owner = next;
        selected.clear();
        expanded.clear();
        activeGroup = radarKind = '';
        upIndex = 0;
        replayMinute = 1440;
        clearDrag(false);
        clearActivityMove();
        lastMissionCount = null;
        undo = null;
        activityDrag = null;
        if (audio) {
          void audio.close().catch(() => {});
          audio = null;
        }
        document.querySelectorAll('.md-celebration').forEach(x => x.remove());
      }
      visual.sync();
      rest.sync();
      return next;
    }
    function ready() {
      sync();
      if (!owner) throw Error('Sign in to use My Day.');
    }
    function save(fn, message = 'My Day saved.') {
      ready();
      const ok = a.mutate(d => {
        E.upgrade(d);
        fn(d, E.store(d));
      });
      if (ok) a.tell(message);
      return ok;
    }
    function current() {
      return E.day(state(), today());
    }
    const nowMinute = () => new Date().getHours() * 60 + new Date().getMinutes();
    const effortLabel = k =>
      ({ low: 'Low energy', steady: 'Steady', challenge: 'Ready for a challenge' })[k];
    function form(title, id, body, record = null, key = '') {
      ready();
      a.openModal(
        title,
        `<form id="${id}" class="md-form"><div class="md-form-grid">${body}</div><div class="modal-actions">${button('close', 'Cancel')}<button type="submit" class="primary">Save</button></div></form>`
      );
      const f = $(id);
      contexts.set(f, {
        owner,
        record: key,
        base: record === null ? null : JSON.stringify(record),
        date: today(),
      });
      return f;
    }
    function contextRecord(key, date) {
      if (key === 'day') return E.day(state(), date);
      if (key === 'settings') return store().settings;
      if (key.startsWith('idea:')) return store().ideas.find(x => x.id === key.slice(5));
      if (key.startsWith('profile:')) return E.profile(state(), key.slice(8));
      if (key === 'groups') return store().groups;
      if (key.startsWith('convert:')) {
        const ids = key.slice(8).split(',');
        return store().ideas.filter(x => ids.includes(x.id));
      }
      return null;
    }
    function validForm(f) {
      ready();
      const c = contexts.get(f);
      if (!c || c.owner !== owner || c.date !== today())
        throw Error('This form belongs to an earlier account or day. Open it again.');
      if (c.base !== null && JSON.stringify(contextRecord(c.record, c.date)) !== c.base)
        throw Error(
          'These details changed while this form was open. Open it again to review the latest version.'
        );
      return c;
    }
    function completeCount() {
      return current().missions.filter(id => state().tasks.some(t => t.id === id && t.done)).length;
    }
    function hero() {
      sync();
      const d = current();
      return visual.hero({
        date: today(),
        name: a.prefs().name,
        done: completeCount(),
        total: d.missions.length,
        activities: E.agenda(state(), today()).length,
        open: E.openTasks(state()).length,
        actions:
          button('morning', d.started ? 'Review my plan' : 'Start my day', '', 'md-primary') +
          button('evening', d.closed ? 'Review day’s close' : 'Close my day') +
          button('settings', 'Effects & hours') +
          button('layout', 'Arrange dashboard'),
      });
    }
    function toolbar() {
      return visual.toolbar();
    }
    function wrapper(id, label, symbol, span, body, handle, controls) {
      return `<section class="hub-card hub-widget md-widget${expanded.has(id) ? ' md-expanded' : ''}" data-span="${span}" draggable="true" data-widget="${id}" data-mv-phase="${visual.phase(id)}"><div class="mv-widget-shell"><div class="hub-widget-head"><div class="mv-widget-heading"><span class="mv-widget-kicker"></span><h3><span class="hub-widget-symbol">${symbol}</span>${esc(label)}</h3></div><div class="hub-widget-actions">${handle}${controls}${button('expand', expanded.has(id) ? '↙' : '⤢', `data-id="${id}" aria-label="${expanded.has(id) ? 'Collapse' : 'Expand'} ${esc(label)}" aria-expanded="${expanded.has(id)}"`, 'small')}</div></div><div class="md-widget-body">${body}</div></div></section>`;
    }
    function taskButton(t, label = 'Open', action = 'task') {
      return button(action, label, `data-id="${esc(t.id)}"`);
    }
    function taskRow(t, extra = '') {
      const p = E.profile(state(), t.id),
        maintained = store().taskProfiles.some(x => x.id === t.id);
      return `<div class="md-task-row"><div><strong class="hub-sensitive">${esc(t.task)}</strong><small>${esc(t.priority || 'Unranked')} · ${duration(p.minutes)}${maintained ? '' : ' estimate'} · ${effortLabel(p.effort)}</small></div><div class="md-row-actions">${extra}${taskButton(t)}${taskButton(t, 'Estimate', 'estimate')}</div></div>`;
    }
    function journey() {
      const rows = E.agenda(state(), today()),
        s = store().settings,
        start = E.minute(s.workStart),
        end = E.minute(s.workEnd);
      const position = n => Math.max(0, Math.min(100, ((n - start) / (end - start)) * 100));
      return `<div class="md-journey-head"><div><span class="md-kicker">YOUR DAY IN MOTION</span><p>Open an activity or drag its time handle onto an hour to review a new time.</p></div>${button('new-activity', '＋ Plan activity')}</div><div class="md-time-rail" data-md-track data-start="${start}" data-end="${end}"><div class="md-now-marker" style="left:${position(nowMinute())}%"><i></i><span>Now · <b data-md-now>${E.clock(nowMinute())}</b></span></div>${Array.from({ length: Math.ceil((end - start) / 60) + 1 }, (_, i) => `<button type="button" data-md="hour" data-minute="${Math.min(end, start + i * 60)}" class="md-hour" style="left:${position(start + i * 60)}%" aria-label="Plan at ${E.clock(Math.min(end, start + i * 60))}">${E.clock(Math.min(end, start + i * 60))}</button>`).join('')}</div><div class="md-agenda-list">${rows.map((x, i) => `<div class="md-agenda-card${x.start <= nowMinute() && x.end > nowMinute() ? ' is-now' : ''}" data-entry="${esc(x.id)}"><span class="md-agenda-dot">${i + 1}</span><div><strong class="hub-sensitive">${esc(x.title)}</strong><small>${E.clock(x.start)}–${E.clock(x.end)} · ${duration(x.end - x.start)}</small></div>${button('booking', 'Open', `data-id="${esc(x.id)}"`)}<button type="button" class="md-time-handle" draggable="true" data-md-drag="activity" data-id="${esc(x.id)}" aria-label="Move ${esc(x.title)} to another time" title="Drag onto the time rail; click to edit">⠿</button></div>`).join('') || blank('A little room to shape your day', 'Your scheduled activities will appear here.')}</div>`;
    }
    function missions() {
      const d = current(),
        n = completeCount(),
        remaining = d.missions.filter(id => !state().tasks.find(t => t.id === id)?.done);
      return `<div class="md-mission-heading"><div class="md-progress-orbit" style="--progress:${d.missions.length ? (n / d.missions.length) * 100 : 0}%"><b>${n}/${d.missions.length || 3}</b></div><p>Three priorities.<br>Room for everything else.</p>${button('missions', 'Choose')}</div><div class="md-missions">${
        remaining
          .map((id, i) => {
            const t = state().tasks.find(x => x.id === id);
            return t
              ? `<div class="md-mission" data-md-priority="${esc(t.id)}"><span>${String(i + 1).padStart(2, '0')}</span><div><strong class="hub-sensitive">${esc(t.task)}</strong><small>${duration(E.profile(state(), id).minutes)} planned</small></div>${taskButton(t, 'Complete', 'complete')}</div>`
              : `<div class="md-mission">A selected task was removed. ${button('missions', 'Choose another')}</div>`;
          })
          .join('') ||
        (d.missions.length && n === d.missions.length
          ? blank(
              'Your intentions, fulfilled.',
              'Every priority is complete. Enjoy a little room to breathe.'
            )
          : blank(
              'Give today a direction',
              'Choose up to three tasks you want to move forward.',
              button('missions', 'Choose my priorities', '', 'md-primary')
            ))
      }</div>`;
    }
    function orb() {
      const f = a.focus();
      return `<div class="md-orb-wrap"><div class="md-focus-orb${f.active && !f.paused ? ' is-running' : ''}" data-md-orb style="--orb-progress:${100 * (1 - f.remaining / (f.minutes * 60))}%"><i class="mv-orb-orbit" aria-hidden="true"><b></b><b></b></i><div><span data-md-focus-clock>${clockText(f.remaining)}</span><small data-md-focus-state>${f.active ? (f.paused ? 'Paused' : 'One thing at a time') : 'Ready when you are'}</small></div></div><p class="hub-sensitive" data-md-focus-title>${esc(f.title) || 'A quiet place to begin.'}</p></div><div class="md-center-actions">${button('focus-open', f.active ? 'Adjust focus' : 'Start focus', '', 'md-primary')}${button('focus-pause', f.paused ? 'Resume' : 'Pause', `${!f.active ? ' disabled' : ''}`)}${button('focus-end', 'End', `${!f.active ? ' disabled' : ''}`)}</div>${meta('Uses your existing focus countdown. Use Track work on a task to record time for Plan & reality.')}`;
    }
    function radar() {
      const w = E.workload(state(), today()),
        names = {
          task: 'Tasks',
          project: 'Projects',
          custom: 'Other activities',
          leave: 'Leave / unavailable',
          free: 'Free time',
        },
        colors = {
          task: '#4d7c65',
          project: '#8797c0',
          custom: '#cb9a67',
          leave: '#af91b1',
          free: '#d7e4d4',
        };
      let cursor = 0;
      const segments = Object.entries(names).map(([k]) => {
        const begin = cursor;
        cursor += (w[k] / w.total) * 100;
        return `${colors[k]} ${begin}% ${cursor}%`;
      });
      const rows =
        radarKind === 'free'
          ? E.gaps(state(), today()).map(
              x => `<li>${E.clock(x.start)}–${E.clock(x.end)} · ${duration(x.minutes)}</li>`
            )
          : E.agenda(state(), today())
              .filter(
                x =>
                  (['task', 'project', 'custom'].includes(x.kind) ? x.kind : 'leave') === radarKind
              )
              .map(
                x =>
                  `<li>${button('booking', esc(x.title), `data-id="${esc(x.id)}"`)} <small>${E.clock(x.start)}–${E.clock(x.end)}</small></li>`
              );
      return `<div class="md-balance"><div class="md-donut" style="background:conic-gradient(${segments.join(',')})" aria-label="${duration(w.free)} free of ${duration(w.total)} working time"><div><b>${duration(w.free)}</b><span>room to plan</span></div></div><div class="md-balance-legend">${Object.entries(
        names
      )
        .map(([k, label]) =>
          button(
            'radar',
            `<i style="background:${colors[k]}"></i><span>${label}</span><b>${duration(w[k])}</b>`,
            `data-kind="${k}" aria-pressed="${radarKind === k}"`
          )
        )
        .join(
          ''
        )}</div></div>${radarKind ? `<div class="md-drilldown"><h4>${names[radarKind]}</h4><ul>${rows.join('') || '<li>No activities in this category.</li>'}</ul></div>` : meta('Select a category to explore the activities behind it.')}`;
    }
    function upNext() {
      const rows = E.agenda(state(), today()).filter(x => x.end > nowMinute());
      upIndex = Math.min(upIndex, Math.max(0, rows.length - 1));
      const x = rows[upIndex];
      if (!x)
        return blank(
          'Nothing else on the clock',
          'Enjoy the room, or plan your next activity.',
          button('new-activity', 'Plan activity')
        );
      return `<div class="md-up-stack"><div class="md-up-card"><span class="md-kicker">${upIndex + 1} OF ${rows.length} · ${x.start <= nowMinute() ? 'HAPPENING NOW' : 'COMING UP'}</span><h4 class="hub-sensitive">${esc(x.title)}</h4><p>${E.clock(x.start)}–${E.clock(x.end)} · ${duration(x.end - x.start)}</p><div class="md-center-actions">${button('booking', 'Open activity', `data-id="${esc(x.id)}"`, 'md-primary')}${button('reschedule', 'Reschedule', `data-id="${esc(x.id)}"`)}${x.kind === 'task' ? button('track', 'Track work', `data-id="${esc(x.row.linkId)}"`) : ''}</div></div></div><div class="md-stack-nav">${button('up-prev', '← Previous', upIndex === 0 ? 'disabled' : '')}${button('up-next', 'Next →', upIndex === rows.length - 1 ? 'disabled' : '')}</div>`;
    }
    function energy() {
      const d = current(),
        rows = E.taskOptions(state(), today(), d.energy).slice(0, 5);
      return `<p class="md-meta">How does today feel? Match work using the effort and duration you maintain.</p><div class="md-energy-choices">${E.EFFORT.map(k => button('energy', effortLabel(k), `data-energy="${k}" aria-pressed="${d.energy === k}"`)).join('')}</div><div class="md-task-list">${rows.map(t => taskRow(t, taskButton(t, 'Track work', 'track'))).join('') || blank('No matching tasks', 'Add a task or adjust its effort estimate.')}</div>`;
    }
    function gaps() {
      const slots = E.gaps(state(), today(), Math.ceil(nowMinute() / 5) * 5).filter(
          x => x.minutes >= gapMinutes
        ),
        tasks = E.taskOptions(state(), today(), null, gapMinutes).slice(0, 4);
      return `<label class="md-field md-gap-picker">I have<select data-md-gap aria-label="Available minutes">${[10, 20, 30, 45, 60, 90].map(n => `<option value="${n}"${n === gapMinutes ? ' selected' : ''}>${duration(n)}</option>`).join('')}</select></label>${meta(`${slots.length} opening${slots.length === 1 ? '' : 's'} remaining in your working hours. Default task estimate: 25 minutes until maintained.`)}<div class="md-task-list">${tasks.map(t => taskRow(t, slots[0] ? button('fit', 'Fit into my day', `data-id="${esc(t.id)}" data-start="${slots[0].start}"`) : '')).join('') || blank('No tasks fit this length', 'Maintain a shorter estimate on a task, or choose more time.')}</div>${
        slots.length
          ? `<div class="md-gap-slots">${slots
              .slice(0, 4)
              .map(x => `<span>${E.clock(x.start)}–${E.clock(x.end)}</span>`)
              .join('')}</div>`
          : meta(
              'No available opening fits this length. You can review your schedule to make room.'
            )
      }`;
    }
    function replay() {
      const d = current(),
        actual = E.actual(state(), today()),
        plan = d.plan;
      const planned = E.union(plan.map(x => [x.start, x.end])).reduce((n, [a, b]) => n + b - a, 0),
        worked = actual.reduce((n, x) => n + x.seconds / 60, 0);
      const tracks = (rows, kind) =>
        `<div class="md-replay-track"><span>${kind}</span><div>${rows
          .filter(x => x.start <= replayMinute)
          .map(
            x =>
              `<button type="button" data-md="${kind === 'Planned' ? 'plan-detail' : 'session-detail'}" data-id="${esc(x.id)}" style="left:${(x.start / 1440) * 100}%;width:${Math.max(0.8, ((Math.min(x.end, replayMinute) - x.start) / 1440) * 100)}%" aria-label="${esc(x.title)}"><span class="hub-sensitive">${esc(x.title)}</span></button>`
          )
          .join('')}</div></div>`;
      return `<div class="md-replay-totals"><span><b>${duration(planned)}</b> captured plan</span><span><b>${duration(worked)}</b> recorded work</span></div>${tracks(plan, 'Planned')}${tracks(
        actual.flatMap(x =>
          (x.intervals?.length ? x.intervals : [x]).map(part => ({
            ...x,
            start: part.start,
            end: part.end,
          }))
        ),
        'Recorded'
      )}<label class="md-field">Replay until <strong data-md-replay-label>${E.clock(replayMinute)}</strong><input data-md-replay type="range" min="0" max="1440" step="15" value="${replayMinute}" aria-label="Replay time"></label><div class="md-row-actions">${button('capture', 'Capture current plan')}${button('morning', 'Review plan')}</div>${meta('Capture the plan before working. Recorded time uses saved work sessions and excludes their pauses; it is not inferred from completed tasks.')}`;
    }
    function garden() {
      const n = completeCount(),
        total = current().missions.length,
        completed = current().missions.map(id => state().tasks.some(t => t.id === id && t.done));
      return `<div class="md-growing-garden" data-growth="${n}" aria-label="${n} completed priorities"><div class="md-garden-sky"></div>${[0, 1, 2].map((_, i) => `<button type="button" class="md-garden-plant${completed[i] ? ' has-bloom' : ''}" style="--plant:${i}" data-md="garden-detail" data-index="${i}" aria-label="${completed[i] ? 'View completed priority' : 'View daily priorities'}"><i class="md-stem"></i><i class="md-leaf md-leaf-left"></i><i class="md-leaf"></i><span>${completed[i] ? '✿' : '❧'}</span></button>`).join('')}<div class="md-garden-ground"></div></div><h4 class="md-garden-title">${n ? 'Small steps, taking root.' : 'A little room to grow.'}</h4>${meta(`${n} of ${total || 'your'} daily priorities complete. Select a plant to see its task.`)}${button('missions', 'Choose priorities')}`;
    }
    function terrarium() {
      const b = rest.snapshot(),
        seconds = b ? b.seconds : store().settings.breakMinutes * 60;
      return `<div class="md-terrarium${b && !b.pausedAt && !b.complete ? ' is-resting' : ''}"><div class="md-glass"><div class="md-glass-shine"></div><div class="md-terra-moon"></div><i class="md-terra-plant"></i><i class="md-terra-plant second"></i><div class="md-terra-earth"></div><span class="md-firefly"></span><span class="md-firefly second"></span></div><div class="md-break-time" data-md-break-clock>${clockText(seconds)}</div></div><p class="md-break-caption" data-md-break-caption>${b ? (b.complete ? 'Your break is over. Resume work when you’re ready.' : esc(b.label) + (b.pausedAt ? ' · paused' : ' · a moment for yourself')) : 'A full-screen garden, a calmer soundscape, a moment for yourself.'}</p><div class="md-break-options">${b ? button('break-open', 'Open rest terrarium') : button('break-start', 'Rest your eyes', 'data-label="Rest your eyes"') + button('break-start', 'Stretch', 'data-label="Stretch"') + button('break-start', 'Step away', 'data-label="Step away"')}</div><div class="md-center-actions">${b?.complete ? button('break-resume', 'Resume work', '', 'md-primary') : button('break-pause', b?.pausedAt ? 'Resume break' : 'Pause break', !b ? 'disabled' : '') + button('break-end', 'End break', !b ? 'disabled' : '')}</div>${meta('Starting opens a full-screen break with its own music and pauses active work and focus timers. Resume work only when you choose. Set the break length in Effects & hours.')}`;
    }
    function canvas() {
      const h = store(),
        ideas = h.ideas.filter(
          x => !activeGroup || (activeGroup === 'none' ? !x.groupId : x.groupId === activeGroup)
        );
      selected = new Set([...selected].filter(id => h.ideas.some(x => x.id === id)));
      const visible = new Set(ideas.map(x => x.id));
      return `<div class="md-canvas-toolbar"><div>${button('idea-new', '＋ Idea', '', 'md-primary')}${button('groups', 'Groups')}${button('connection', 'Connect ideas')}${button('connections', 'Connections')}</div><div>${button('convert', `Create tasks${selected.size ? ' (' + selected.size + ')' : ''}`, !selected.size ? 'disabled' : '')}${button('clear-selection', 'Clear selection', !selected.size ? 'disabled' : '')}</div></div><label class="md-field md-canvas-filter">Show group<select data-md-group aria-label="Canvas group"><option value="">All ideas</option><option value="none"${activeGroup === 'none' ? ' selected' : ''}>Ungrouped</option>${h.groups.map(g => `<option value="${esc(g.id)}"${activeGroup === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label><div class="md-canvas-viewport" tabindex="0" aria-label="Thinking canvas. Scroll to explore. Drag an idea handle or use its arrow keys."><div class="md-canvas-board"><svg class="md-canvas-links" viewBox="0 0 900 620" aria-hidden="true">${h.links
        .filter(l => visible.has(l.from) && visible.has(l.to))
        .map(l => {
          const f = h.ideas.find(x => x.id === l.from),
            t = h.ideas.find(x => x.id === l.to);
          return `<path data-link="${esc(l.id)}" d="M ${f.x + 105} ${f.y + 75} C ${f.x + 105} ${t.y + 75}, ${t.x + 105} ${f.y + 75}, ${t.x + 105} ${t.y + 75}"/>`;
        })
        .join(
          ''
        )}</svg>${ideas.map(x => `<article class="md-idea md-color-${x.color}${selected.has(x.id) ? ' is-selected' : ''}" data-idea="${esc(x.id)}" style="left:${x.x}px;top:${x.y}px"><div class="md-idea-head"><label class="md-idea-select"><input type="checkbox" data-md-select="${esc(x.id)}" aria-label="Select ${esc(x.title)}"${selected.has(x.id) ? ' checked' : ''}><span class="md-group-tag md-color-${h.groups.find(g => g.id === x.groupId)?.color || 'sage'}">${esc(h.groups.find(g => g.id === x.groupId)?.name || 'Idea')}</span></label><button type="button" class="md-idea-handle" data-md-drag="idea" data-id="${esc(x.id)}" aria-label="Move idea ${esc(x.title)}. Use arrow keys to move." title="Drag to move; arrow keys also work">⠿</button></div><h4 class="hub-sensitive">${esc(x.title)}</h4><p class="hub-sensitive">${esc(x.notes.slice(0, 110))}</p><div class="md-idea-actions">${button('idea-edit', 'Edit', `data-id="${esc(x.id)}" aria-label="Edit idea ${esc(x.title)}"`)}${x.taskId && state().tasks.some(t => t.id === x.taskId) ? button('task', 'Open task', `data-id="${esc(x.taskId)}"`) : ''}</div></article>`).join('') || `<div class="md-canvas-welcome"><span aria-hidden="true">✧</span><h4>A place for thoughts to take shape.</h4><p>Add ideas, move them around and make connections.<br>Select ideas when you’re ready to turn them into tasks.</p>${button('idea-new', 'Add your first idea', '', 'md-primary')}</div>`}</div></div>${meta('Your ideas, groups and positions save with your account. Use an idea’s dotted handle to move it; the widget’s handle rearranges the dashboard.')}`;
    }
    function widget(id) {
      sync();
      return {
        dayJourney: journey,
        missions,
        orb,
        radar,
        upNext,
        energy,
        gaps,
        replay,
        garden,
        terrarium,
        canvas,
      }[id]?.();
    }
    function missionFields() {
      const d = current(),
        completed = d.missions.filter(id => state().tasks.find(t => t.id === id)?.done),
        slots = 3 - completed.length,
        rows = slots
          ? state().tasks.filter(t => !t.done && (!t.archived || d.missions.includes(t.id)))
          : [];
      return `<div class="md-wide md-mission-picker"><p>${slots === 0 ? 'Your three daily priorities are complete.' : completed.length ? `${completed.length} ${completed.length === 1 ? 'priority' : 'priorities'} already complete. Choose up to ${slots} remaining priorities.` : 'Choose up to three priorities to move forward.'}</p>${completed.map(id => `<input type="hidden" name="mission" value="${esc(id)}">`).join('')}${rows.map(t => `<label class="md-check"><input type="checkbox" name="mission" value="${esc(t.id)}"${d.missions.includes(t.id) ? ' checked' : ''}><span class="hub-sensitive">${esc(t.task)}</span></label>`).join('') || `<p>${slots ? 'No open tasks to choose. ' : ''}Enjoy a little room to breathe.</p>`}</div>`;
    }
    function missionsForm() {
      form('Choose today’s priorities', 'mdMissions', missionFields(), current(), 'day');
    }
    function morning() {
      const d = current(),
        agenda = E.agenda(state(), today());
      form(
        'A little intention for today',
        'mdMorning',
        `<div class="md-wide md-routine-intro"><span class="md-kicker">MORNING LAUNCH</span><h3>What would make today feel worthwhile?</h3><p>Review your commitments, choose three priorities and start with a clear plan.</p></div>${select(
          'energy',
          'Today’s energy',
          E.EFFORT.map(k => [k, effortLabel(k)]),
          d.energy,
          null
        )}${missionFields()}<div class="md-wide"><h4>Your scheduled activities</h4><ul class="md-compact-list">${agenda.map(x => `<li><span>${E.clock(x.start)}–${E.clock(x.end)}</span> <strong class="hub-sensitive">${esc(x.title)}</strong></li>`).join('') || '<li>No activities planned yet.</li>'}</ul>${check('capture', d.plan.length ? 'Replace my captured plan with today’s current schedule' : 'Capture this schedule for Plan & reality', !d.plan.length)}</div>`,
        d,
        'day'
      );
    }
    function evening() {
      const d = current(),
        outstanding = d.missions
          .map(id => state().tasks.find(t => t.id === id))
          .filter(t => t && !t.done && !t.archived),
        next = new Date(today() + 'T12:00:00');
      next.setDate(next.getDate() + 1);
      const tomorrow = [
        next.getFullYear(),
        String(next.getMonth() + 1).padStart(2, '0'),
        String(next.getDate()).padStart(2, '0'),
      ].join('-');
      form(
        'Give your day a gentle close',
        'mdEvening',
        `<div class="md-wide md-routine-intro"><span class="md-kicker">EVENING CLOSE</span><h3>${completeCount()} priorities complete. Every step counts.</h3><p>${duration(E.actual(state(), today()).reduce((n, x) => n + x.seconds / 60, 0))} of recorded work today.</p></div>${area('reflection', 'What moved forward? What should you remember?', d.reflection)}<div class="md-wide"><h4>Carry unfinished priorities forward</h4><p class="md-meta">Selected tasks receive a new due date. Existing calendar bookings stay on their scheduled dates.</p>${outstanding.map(t => `<label class="md-check"><input type="checkbox" name="carry" value="${esc(t.id)}"><span class="hub-sensitive">${esc(t.task)}</span></label>`).join('') || '<p>No unfinished priorities to carry forward.</p>'}</div>${field('carryDate', 'New due date for selected tasks', tomorrow, 'date', 'required')}`,
        d,
        'day'
      );
    }
    function settings() {
      const s = store().settings;
      form(
        'Make My Day feel like you',
        'mdSettings',
        `${select(
          'effects',
          'Effects style',
          [
            ['calm', 'Calm · still and simple'],
            ['ambient', 'Cinematic · living landscape'],
            ['playful', 'Spectacle · extra motion & sparkle'],
          ],
          s.effects,
          null
        )}${field('breakMinutes', 'Break length (minutes)', s.breakMinutes, 'number', 'min="1" max="60" step="1" required')}${field('workStart', 'Working day starts', s.workStart, 'time', 'required')}${field('workEnd', 'Working day ends', s.workEnd, 'time', 'required')}<div class="md-wide md-settings-checks">${check('particles', 'Show ambient particles', s.particles)}${check('celebrations', 'Celebrate completed priorities', s.celebrations)}${check('sounds', 'Play a soft completion sound (also requires website sounds enabled)', s.sounds)}</div><div class="md-wide md-effects-sample" data-md-preview data-effects="${s.effects}"><div class="md-sample-orb"></div><span>Preview your rhythm</span><i></i><i></i><i></i></div>${meta('Effects respect the website’s motion setting and your device’s reduced-motion preference. Sounds start only after an interaction.')}`,
        s,
        'settings'
      );
    }
    function estimate(id) {
      const t = state().tasks.find(t => t.id === id);
      if (!t) throw Error('This task no longer exists.');
      const p = E.profile(state(), id);
      const f = form(
        'A little context for this task',
        'mdEstimate',
        `<p class="md-wide hub-sensitive">${esc(t.task)}</p>${field('minutes', 'Estimated remaining minutes', p.minutes, 'number', 'required min="1" max="1440" step="1"')}${select(
          'effort',
          'Effort needed',
          E.EFFORT.map(k => [k, effortLabel(k)]),
          p.effort,
          null
        )}`,
        p,
        'profile:' + id
      );
      f.dataset.id = id;
    }
    function ideaEditor(id = '') {
      const h = store(),
        idea = h.ideas.find(x => x.id === id);
      if (id && !idea) throw Error('This idea no longer exists.');
      const v = idea || {
        title: '',
        notes: '',
        color: 'sage',
        groupId: activeGroup === 'none' ? '' : activeGroup,
      };
      const f = form(
        idea ? 'Shape your idea' : 'A thought worth keeping',
        'mdIdea',
        `${field('title', 'Idea title', v.title, 'text', 'required maxlength="160"')}${select(
          'color',
          'Card colour',
          E.COLORS.map(k => [k, k[0].toUpperCase() + k.slice(1)]),
          v.color,
          null
        )}${select(
          'groupId',
          'Group',
          h.groups.map(g => [g.id, g.name]),
          v.groupId,
          'Ungrouped'
        )}${area('notes', 'Notes and next thoughts', v.notes)}${idea ? `<div class="md-wide">${button('idea-delete', 'Remove idea', `data-id="${esc(id)}"`, 'md-danger')}</div>` : ''}`,
        idea || null,
        idea ? 'idea:' + id : ''
      );
      f.dataset.id = id;
    }
    function groups() {
      form(
        'Give related ideas a home',
        'mdGroups',
        `<div class="md-wide md-group-editor">${store()
          .groups.map(
            g =>
              `<div>${field('group-' + g.id, 'Group name', g.name, 'text', 'required maxlength="80"')}${select(
                'color-' + g.id,
                'Group colour',
                E.COLORS.map(k => [k, k[0].toUpperCase() + k.slice(1)]),
                g.color,
                null
              )}${button('group-delete', 'Remove', `data-id="${esc(g.id)}" aria-label="Remove group ${esc(g.name)}"`)}</div>`
          )
          .join(
            ''
          )}</div>${field('newName', 'New group name', '', 'text', 'maxlength="80"')}${select(
          'newColor',
          'New group colour',
          E.COLORS.map(k => [k, k[0].toUpperCase() + k.slice(1)]),
          'sage',
          null
        )}`,
        store().groups,
        'groups'
      );
    }
    function connection() {
      if (store().ideas.length < 2) throw Error('Add at least two ideas to connect.');
      const rows = store().ideas.map(x => [x.id, x.title]),
        ids = [...selected];
      form(
        'Connect two thoughts',
        'mdConnection',
        select('from', 'First idea', rows, ids[0] || rows[0][0]) +
          select('to', 'Related idea', rows, ids[1] || rows[1][0])
      );
    }
    function connections() {
      ready();
      a.openModal(
        'Your idea connections',
        `<div class="md-connections-list">${
          store()
            .links.map(
              l =>
                `<div><span class="hub-sensitive">${esc(store().ideas.find(x => x.id === l.from)?.title)} <b>↔</b> ${esc(store().ideas.find(x => x.id === l.to)?.title)}</span>${button('connection-delete', 'Remove', `data-id="${esc(l.id)}"`)}</div>`
            )
            .join('') ||
          blank(
            'No connections yet',
            'Connect related ideas to see how they fit together.',
            button('connection', 'Connect ideas')
          )
        }</div>`
      );
    }
    let undo = null;
    function canvasUndo(record) {
      undo = { ...record, owner };
      a.tell('Removed. Undo is available on the thinking canvas.');
      a.render();
    }
    function conversion() {
      const ideas = store().ideas.filter(x => selected.has(x.id));
      if (!ideas.length) throw Error('Select at least one idea.');
      const f = form(
        'Turn your ideas into next steps',
        'mdConvert',
        `<div class="md-wide"><p>Each selected idea creates one editable task with its notes. The idea stays on your canvas and links to its task.</p><ul>${ideas.map(x => `<li class="hub-sensitive">${esc(x.title)}${x.taskId && state().tasks.some(t => t.id === x.taskId) ? ' · already linked; will be skipped' : ''}</li>`).join('')}</ul></div>`,
        ideas,
        'convert:' + ideas.map(x => x.id).join(',')
      );
      f.dataset.ids = ideas.map(x => x.id).join(',');
      f.querySelector('[type="submit"]').textContent = 'Create tasks';
    }
    function activity(id) {
      const x = E.agenda(state(), today()).find(x => x.id === id);
      if (!x) throw Error('This activity is no longer on today’s schedule.');
      return x;
    }
    function reschedule(id, start) {
      const x = activity(id),
        next = start === undefined ? x.start : start,
        end = next + (x.end - x.start);
      if (next < 0 || end > 1440) throw Error('Keep the full activity within one day.');
      a.editTime(today(), x.row.time, E.clock(next), E.clock(end));
    }
    function permittedEffects() {
      return (
        a.ready() &&
        a.prefs().motion !== 'off' &&
        !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
        store().settings.effects !== 'calm'
      );
    }
    function celebrate() {
      if (
        !permittedEffects() ||
        !store().settings.celebrations ||
        document.hidden ||
        document.body.matches('.hub-private,.hub-present')
      )
        return;
      visual.celebrate();
      tone();
    }
    function unlockAudio() {
      if (!store().settings.sounds || !a.prefs().sounds) return;
      try {
        const A = root.AudioContext || root.webkitAudioContext;
        if (A && !audio) audio = new A();
        void audio?.resume().catch(() => {});
      } catch {}
    }
    function tone() {
      if (!audio || !store().settings.sounds || !a.prefs().sounds || document.hidden) return;
      try {
        const gain = audio.createGain(),
          osc = audio.createOscillator();
        gain.connect(audio.destination);
        osc.connect(gain);
        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.6);
        osc.frequency.value = 660;
        osc.start();
        osc.stop(audio.currentTime + 0.6);
      } catch {}
    }
    function refresh(id) {
      const el = document.querySelector('.my-day-page [data-widget="' + id + '"] .md-widget-body');
      if (el) {
        el.innerHTML = widget(id);
        mount();
      }
    }
    async function handle(el) {
      ready();
      const action = el.dataset.md,
        id = el.dataset.id;
      if (action === 'close') {
        a.closeModal();
        mount();
        return;
      }
      if (action === 'layout') {
        a.layout();
        return;
      }
      if (action === 'expand') {
        visual.captureLayout();
        expanded.has(id) ? expanded.delete(id) : expanded.add(id);
        a.render();
        document.querySelector('[data-widget="' + id + '"] [data-md="expand"]')?.focus();
        return;
      }
      if (action === 'settings') {
        settings();
        return;
      }
      if (action === 'morning') {
        morning();
        return;
      }
      if (action === 'evening') {
        evening();
        return;
      }
      if (action === 'missions') {
        missionsForm();
        return;
      }
      if (action === 'complete') {
        unlockAudio();
        visual.markComplete(id);
        a.completeTask(id);
        return;
      }
      if (action === 'task') {
        a.task(id);
        return;
      }
      if (action === 'estimate') {
        estimate(id);
        return;
      }
      if (action === 'track') {
        a.track(id);
        return;
      }
      if (action === 'booking') {
        const x = activity(id);
        a.viewBooking(today(), x.row.time);
        return;
      }
      if (action === 'new-activity') {
        a.newActivity(today(), store().settings.workStart);
        return;
      }
      if (action === 'hour') {
        a.newActivity(today(), E.clock(Math.min(1425, +el.dataset.minute)));
        return;
      }
      if (action === 'reschedule') {
        reschedule(id);
        return;
      }
      if (action === 'up-prev' || action === 'up-next') {
        upIndex += action === 'up-next' ? 1 : -1;
        refresh('upNext');
        return;
      }
      if (action === 'radar') {
        const kind = el.dataset.kind;
        if (!['task', 'project', 'custom', 'leave', 'free'].includes(kind)) return;
        radarKind = radarKind === kind ? '' : kind;
        refresh('radar');
        return;
      }
      if (action === 'energy') {
        save(d => (E.day(d, today(), true).energy = el.dataset.energy), 'Energy preference saved.');
        return;
      }
      if (action === 'fit') {
        const t = state().tasks.find(x => x.id === id);
        if (!t || t.done || t.archived) throw Error('Choose an open task.');
        const minutes = E.profile(state(), id).minutes,
          start = +el.dataset.start;
        if (
          !E.gaps(state(), today(), nowMinute()).some(
            x => x.start <= start && x.end >= start + minutes
          )
        )
          throw Error('This opening changed. Refresh My Day to choose another.');
        a.scheduleTask(id, today(), E.clock(start), E.clock(start + minutes));
        return;
      }
      if (action === 'capture') {
        if (
          current().plan.length &&
          !root.confirm('Replace the captured plan with today’s current schedule?')
        )
          return;
        save(
          d => (E.day(d, today(), true).plan = E.snapshot(d, today())),
          'Current plan captured.'
        );
        return;
      }
      if (action === 'plan-detail') {
        const x = current().plan.find(x => x.id === id);
        if (!x) return;
        a.openModal(
          'Captured plan',
          `<h3 class="hub-sensitive">${esc(x.title)}</h3><p>${E.clock(x.start)}–${E.clock(x.end)}</p><p class="md-meta">This is the plan you captured, preserved even if the schedule later changes.</p>`
        );
        return;
      }
      if (action === 'session-detail') {
        const x = state().workhub.sessions.find(x => x.id === id);
        if (!x) return;
        a.openModal(
          'Recorded work',
          `<h3 class="hub-sensitive">${esc(x.title)}</h3><p>${duration(x.seconds / 60)} active time</p><p class="hub-sensitive">${esc(x.completedWork || x.notes || 'No session notes.')}</p>`
        );
        return;
      }
      if (action === 'focus-open') {
        const f = a.focus();
        const formEl = form(
          'One thing at a time',
          'mdFocus',
          field(
            'minutes',
            'Focus length (minutes)',
            f.minutes,
            'number',
            'required min="1" max="1440" step="1"'
          ) +
            (!f.active
              ? select(
                  'taskId',
                  'Focus on',
                  E.openTasks(state()).map(t => [t.id, t.task]),
                  '',
                  'Focus freely'
                )
              : '<p class="md-wide">Adjusting the total keeps elapsed time.</p>')
        );
        formEl.querySelector('[type="submit"]').textContent = f.active
          ? 'Update focus'
          : 'Start focus';
        return;
      }
      if (action === 'focus-pause') {
        a.pauseFocus();
        refresh('orb');
        return;
      }
      if (action === 'focus-end') {
        a.endFocus();
        refresh('orb');
        return;
      }
      if (action === 'garden-detail') {
        const id = current().missions[+el.dataset.index],
          t = state().tasks.find(t => t.id === id);
        if (t) a.task(id);
        else missionsForm();
        return;
      }
      if (action === 'break-start') {
        rest.start(el.dataset.label, store().settings.breakMinutes * 60);
        return;
      }
      if (action === 'break-pause') {
        rest.pause();
        return;
      }
      if (action === 'break-end') {
        rest.finish(false);
        return;
      }
      if (action === 'break-open') {
        rest.open();
        return;
      }
      if (action === 'break-resume') {
        rest.resume();
        return;
      }
      if (action === 'idea-new') {
        ideaEditor();
        return;
      }
      if (action === 'idea-edit') {
        ideaEditor(id);
        return;
      }
      if (action === 'groups') {
        groups();
        return;
      }
      if (action === 'connection') {
        connection();
        return;
      }
      if (action === 'connections') {
        connections();
        return;
      }
      if (action === 'convert') {
        conversion();
        return;
      }
      if (action === 'clear-selection') {
        selected.clear();
        refresh('canvas');
        return;
      }
      if (action === 'idea-delete') {
        const idea = store().ideas.find(x => x.id === id);
        if (!idea) return;
        const links = E.copy(store().links.filter(x => x.from === id || x.to === id));
        if (
          save((d, h) => {
            h.ideas = h.ideas.filter(x => x.id !== id);
            h.links = h.links.filter(x => x.from !== id && x.to !== id);
          }, 'Idea removed.')
        ) {
          a.closeModal();
          canvasUndo({ idea: E.copy(idea), links });
        }
        return;
      }
      if (action === 'group-delete') {
        const g = store().groups.find(x => x.id === id);
        if (!g) return;
        const assigned = store()
          .ideas.filter(x => x.groupId === id)
          .map(x => x.id);
        if (
          save((d, h) => {
            h.groups = h.groups.filter(x => x.id !== id);
            h.ideas.forEach(x => {
              if (x.groupId === id) x.groupId = '';
            });
          }, 'Group removed. Ideas stay on the canvas.')
        ) {
          if (activeGroup === id) activeGroup = '';
          canvasUndo({ group: E.copy(g), assigned });
          groups();
        }
        return;
      }
      if (action === 'connection-delete') {
        const link = store().links.find(x => x.id === id);
        if (!link) return;
        if (save((d, h) => (h.links = h.links.filter(x => x.id !== id)), 'Connection removed.')) {
          canvasUndo({ links: [E.copy(link)] });
          connections();
        }
        return;
      }
      if (action === 'undo') {
        if (!undo || undo.owner !== owner) return;
        const u = undo;
        if (
          save((d, h) => {
            if (u.group && !h.groups.some(x => x.id === u.group.id)) {
              h.groups.push(u.group);
              h.ideas.forEach(x => {
                if (u.assigned.includes(x.id) && !x.groupId) x.groupId = u.group.id;
              });
            }
            if (u.idea && !h.ideas.some(x => x.id === u.idea.id)) {
              const idea = E.copy(u.idea);
              if (idea.groupId && !h.groups.some(g => g.id === idea.groupId)) idea.groupId = '';
              h.ideas.push(idea);
            }
            for (const l of u.links || [])
              if (
                h.ideas.some(x => x.id === l.from) &&
                h.ideas.some(x => x.id === l.to) &&
                !h.links.some(
                  x =>
                    x.id === l.id ||
                    [x.from, x.to].sort().join('|') === [l.from, l.to].sort().join('|')
                )
              )
                h.links.push(l);
          }, 'Canvas item restored.')
        ) {
          undo = null;
          a.render();
        }
        return;
      }
    }
    function submit(f) {
      const c = validForm(f),
        v = new FormData(f),
        get = k => String(v.get(k) || '').trim();
      const chooseMissions = () => {
        const ids = v.getAll('mission').map(String);
        if (ids.length > 3) throw Error('Choose up to three priorities.');
        if (ids.some(id => !state().tasks.some(t => t.id === id)))
          throw Error('A chosen task no longer exists. Open the plan again.');
        const retained = current().missions.filter(id => ids.includes(id));
        return [...retained, ...ids.filter(id => !retained.includes(id))];
      };
      let ok = false;
      if (f.id === 'mdMissions' || f.id === 'mdMorning') {
        const ids = chooseMissions();
        ok = save(
          d => {
            const day = E.day(d, c.date, true);
            day.missions = ids;
            if (f.id === 'mdMorning') {
              day.started = true;
              day.closed = false;
              day.energy = get('energy');
              if (v.has('capture')) day.plan = E.snapshot(d, c.date);
            }
          },
          f.id === 'mdMorning' ? 'Your day is ready.' : 'Priorities saved.'
        );
      } else if (f.id === 'mdEvening') {
        const date = get('carryDate');
        if (!E.dateOK(date) || date <= today())
          throw Error('Choose a future date for carried tasks.');
        const ids = v.getAll('carry').map(String);
        ok = save(d => {
          const day = E.day(d, c.date, true);
          day.reflection = get('reflection');
          day.closed = true;
          for (const t of d.tasks)
            if (ids.includes(t.id) && day.missions.includes(t.id) && !t.done && !t.archived)
              t.dueDate = date;
        }, 'Day closed. Your progress and notes are saved.');
      } else if (f.id === 'mdSettings') {
        ok = save(
          (d, h) =>
            (h.settings = {
              effects: get('effects'),
              particles: v.has('particles'),
              celebrations: v.has('celebrations'),
              sounds: v.has('sounds'),
              workStart: get('workStart'),
              workEnd: get('workEnd'),
              breakMinutes: Number(get('breakMinutes')),
            }),
          'My Day look and working hours saved.'
        );
      } else if (f.id === 'mdEstimate') {
        if (!state().tasks.some(t => t.id === f.dataset.id))
          throw Error('This task no longer exists.');
        ok = save((d, h) => {
          const p = { id: f.dataset.id, minutes: Number(get('minutes')), effort: get('effort') },
            i = h.taskProfiles.findIndex(x => x.id === p.id);
          if (i < 0) h.taskProfiles.push(p);
          else h.taskProfiles[i] = p;
        }, 'Task estimate saved.');
      } else if (f.id === 'mdIdea') {
        ok = save((d, h) => {
          const old = h.ideas.find(x => x.id === f.dataset.id);
          if (f.dataset.id && !old) throw Error('This idea was removed.');
          const i = h.ideas.length;
          const idea = {
            ...old,
            id: old?.id || E.uid(),
            title: get('title'),
            notes: get('notes'),
            color: get('color'),
            groupId: get('groupId'),
            taskId: old?.taskId || '',
            x: old?.x ?? 40 + (i % 3) * 240,
            y: old?.y ?? 40 + (Math.floor(i / 3) % 3) * 180,
          };
          if (old) h.ideas[h.ideas.indexOf(old)] = idea;
          else h.ideas.push(idea);
        }, 'Idea saved to your canvas.');
      } else if (f.id === 'mdGroups') {
        ok = save((d, h) => {
          for (const g of h.groups) {
            g.name = get('group-' + g.id);
            g.color = get('color-' + g.id);
          }
          if (get('newName'))
            h.groups.push({ id: E.uid(), name: get('newName'), color: get('newColor') });
        }, 'Canvas groups saved.');
      } else if (f.id === 'mdConnection') {
        const from = get('from'),
          to = get('to');
        if (!from || !to || from === to) throw Error('Choose two different ideas.');
        if (
          store().links.some(x => [x.from, x.to].sort().join('|') === [from, to].sort().join('|'))
        )
          throw Error('These ideas are already connected.');
        ok = save((d, h) => h.links.push({ id: E.uid(), from, to }), 'Ideas connected.');
      } else if (f.id === 'mdConvert') {
        let count = 0;
        ok = save(d => {
          count = E.convertIdeas(d, f.dataset.ids.split(','), today()).length;
        }, 'Selected ideas are linked to tasks.');
        if (ok)
          a.tell(
            count
              ? `${count} editable task${count === 1 ? '' : 's'} created.`
              : 'These ideas already have tasks. No duplicates were created.'
          );
      } else if (f.id === 'mdFocus') {
        const taskId = get('taskId');
        if (taskId && !state().tasks.some(t => t.id === taskId && !t.done && !t.archived))
          throw Error('Choose an open task.');
        a.startFocus(Number(get('minutes')), taskId);
        a.closeModal();
        refresh('orb');
        return;
      }
      if (ok) a.closeModal();
    }
    function redrawLinks(movingId = '', position = null) {
      const h = store();
      for (const link of h.links) {
        const node = document.querySelector('.md-canvas-links [data-link="' + link.id + '"]');
        if (!node) continue;
        const from = h.ideas.find(x => x.id === link.from),
          to = h.ideas.find(x => x.id === link.to);
        if (!from || !to) continue;
        const f = from.id === movingId && position ? position : from,
          t = to.id === movingId && position ? position : to;
        node.setAttribute(
          'd',
          `M ${f.x + 105} ${f.y + 75} C ${f.x + 105} ${t.y + 75}, ${t.x + 105} ${f.y + 75}, ${t.x + 105} ${t.y + 75}`
        );
      }
    }
    function clearDrag(restore = true) {
      if (!drag) return;
      const old = drag;
      drag = null;
      if (restore && old.node?.isConnected) {
        old.node.style.left = old.idea.x + 'px';
        old.node.style.top = old.idea.y + 'px';
        if (a.ready()) redrawLinks();
      }
      old.node?.classList.remove('is-moving');
      try {
        old.handle.releasePointerCapture?.(old.pointerId);
      } catch {}
      return old;
    }
    function clearActivityMove() {
      if (!activityMove) return null;
      const old = activityMove;
      activityMove = null;
      old.ghost?.remove();
      old.track?.classList.remove('is-drop-target');
      try {
        old.handle.releasePointerCapture?.(old.pointerId);
      } catch {}
      return old;
    }
    document.addEventListener(
      'pointerdown',
      event => {
        const handle = event.target.closest?.('[data-md-drag="activity"]');
        if (!handle || event.button > 0) return;
        try {
          ready();
          event.preventDefault();
          event.stopPropagation();
          const entry = activity(handle.dataset.id);
          activityMove = {
            owner,
            id: entry.id,
            base: JSON.stringify(entry),
            handle,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
            track: handle.closest('[data-widget]').querySelector('[data-md-track]'),
          };
          handle.setPointerCapture?.(event.pointerId);
        } catch (e) {
          a.tell(e.message, true);
        }
      },
      true
    );
    document.addEventListener(
      'pointermove',
      event => {
        if (!activityMove || event.pointerId !== activityMove.pointerId) return;
        if (!a.ready() || a.owner() !== activityMove.owner) {
          clearActivityMove();
          sync();
          return;
        }
        if (
          !activityMove.moved &&
          Math.hypot(event.clientX - activityMove.x, event.clientY - activityMove.y) < 6
        )
          return;
        event.preventDefault();
        activityMove.moved = true;
        const rect = activityMove.track.getBoundingClientRect();
        activityMove.inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top - 10 &&
          event.clientY <= rect.bottom + 10;
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))
        );
        activityMove.minute =
          Math.round(
            (+activityMove.track.dataset.start +
              ratio * (+activityMove.track.dataset.end - +activityMove.track.dataset.start)) /
              15
          ) * 15;
        activityMove.track.classList.toggle('is-drop-target', activityMove.inside);
        if (!activityMove.ghost) {
          const ghost = document.createElement('div');
          ghost.className = 'md-time-ghost';
          ghost.setAttribute('aria-hidden', 'true');
          document.body.append(ghost);
          activityMove.ghost = ghost;
        }
        activityMove.ghost.textContent = activityMove.inside
          ? 'Review at ' + E.clock(activityMove.minute)
          : 'Move onto the hour rail';
        activityMove.ghost.style.left =
          Math.min(root.innerWidth - 180, Math.max(8, event.clientX + 12)) + 'px';
        activityMove.ghost.style.top = Math.max(8, event.clientY - 45) + 'px';
      },
      { passive: false }
    );
    document.addEventListener('pointerup', event => {
      if (!activityMove || event.pointerId !== activityMove.pointerId) return;
      const move = clearActivityMove();
      if (!move.moved) return;
      suppressUntil = Date.now() + 400;
      if (!move.inside) return;
      try {
        ready();
        if (move.owner !== owner || JSON.stringify(activity(move.id)) !== move.base)
          throw Error(
            'This activity changed while moving. Review the latest version and try again.'
          );
        reschedule(move.id, move.minute);
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener('pointercancel', clearActivityMove);
    document.addEventListener('pointerdown', event => {
      const handle = event.target.closest?.('[data-md-drag="idea"]');
      if (!handle || event.button > 0) return;
      try {
        ready();
        const idea = store().ideas.find(x => x.id === handle.dataset.id);
        if (!idea) return;
        event.preventDefault();
        event.stopPropagation();
        drag = {
          owner,
          idea: E.copy(idea),
          pointerId: event.pointerId,
          handle,
          node: handle.closest('[data-idea]'),
          startX: event.clientX,
          startY: event.clientY,
          x: idea.x,
          y: idea.y,
          moved: false,
        };
        handle.setPointerCapture?.(event.pointerId);
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener(
      'pointermove',
      event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (!a.ready() || a.owner() !== drag.owner) {
          clearDrag(false);
          sync();
          return;
        }
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6)
          return;
        event.preventDefault();
        drag.moved = true;
        drag.node.classList.add('is-moving');
        drag.x = Math.max(0, Math.min(680, drag.idea.x + event.clientX - drag.startX));
        drag.y = Math.max(0, Math.min(450, drag.idea.y + event.clientY - drag.startY));
        drag.node.style.left = drag.x + 'px';
        drag.node.style.top = drag.y + 'px';
        redrawLinks(drag.idea.id, drag);
      },
      { passive: false }
    );
    document.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const done = clearDrag(false);
      if (!done.moved) return;
      suppressUntil = Date.now() + 400;
      try {
        ready();
        if (done.owner !== owner) throw Error('The account changed. Your drag was cancelled.');
        if (
          JSON.stringify(store().ideas.find(x => x.id === done.idea.id)) !==
          JSON.stringify(done.idea)
        )
          throw Error('This idea changed while you moved it. Try again with the latest version.');
        save((d, h) => {
          const x = h.ideas.find(x => x.id === done.idea.id);
          x.x = Math.round(done.x);
          x.y = Math.round(done.y);
        }, 'Idea position saved.');
      } catch (e) {
        a.render();
        a.tell(e.message, true);
      }
    });
    document.addEventListener('pointercancel', () => clearDrag());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activityMove) {
        clearActivityMove();
        return;
      }
      if (event.key === 'Escape' && drag) {
        clearDrag();
        return;
      }
      const handle = event.target.closest?.('[data-md-drag="idea"]');
      if (!handle || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
        return;
      event.preventDefault();
      event.stopPropagation();
      try {
        ready();
        const id = handle.dataset.id,
          step = event.shiftKey ? 40 : 10;
        save((d, h) => {
          const x = h.ideas.find(x => x.id === id);
          if (!x) throw Error('This idea no longer exists.');
          x.x = Math.max(
            0,
            Math.min(
              680,
              x.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)
            )
          );
          x.y = Math.max(
            0,
            Math.min(
              450,
              x.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)
            )
          );
        }, 'Idea position saved.');
        document.querySelector('[data-md-drag="idea"][data-id="' + id + '"]')?.focus();
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    let activityDrag = null;
    document.addEventListener(
      'dragstart',
      event => {
        const h = event.target.closest?.('[data-md-drag="activity"]');
        if (!h) return;
        event.stopImmediatePropagation();
        activityDrag = { id: h.dataset.id, owner: a.owner() };
        event.dataTransfer?.setData('application/x-my-day-activity', h.dataset.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      },
      true
    );
    document.addEventListener(
      'dragover',
      event => {
        const track = event.target.closest?.('[data-md-track]');
        if (track && activityDrag) {
          event.preventDefault();
          event.stopImmediatePropagation();
          track.classList.add('is-drop-target');
        }
      },
      true
    );
    document.addEventListener(
      'drop',
      event => {
        const track = event.target.closest?.('[data-md-track]');
        if (!track || !activityDrag) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        track.classList.remove('is-drop-target');
        const value = activityDrag;
        activityDrag = null;
        try {
          ready();
          if (value.owner !== owner) throw Error('The account changed. Move cancelled.');
          const rect = track.getBoundingClientRect(),
            ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
            start = +track.dataset.start,
            end = +track.dataset.end;
          reschedule(value.id, Math.round((start + ratio * (end - start)) / 15) * 15);
        } catch (e) {
          a.tell(e.message, true);
        }
      },
      true
    );
    document.addEventListener('dragend', () => {
      activityDrag = null;
      document
        .querySelectorAll('.md-time-rail.is-drop-target')
        .forEach(x => x.classList.remove('is-drop-target'));
    });
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-md]'),
        activityHandle = event.target.closest?.('[data-md-drag="activity"]');
      if (!el && !activityHandle) return;
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() < suppressUntil) return;
      if (activityHandle) {
        try {
          ready();
          reschedule(activityHandle.dataset.id);
        } catch (e) {
          a.tell(e.message, true);
        }
        return;
      }
      void handle(el).catch(e => a.tell(e.message, true));
    });
    document.addEventListener('submit', event => {
      if (!event.target.id.startsWith('md')) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        submit(event.target);
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      try {
        if (el.dataset.mdSelect) {
          ready();
          el.checked ? selected.add(el.dataset.mdSelect) : selected.delete(el.dataset.mdSelect);
          const viewport = document.querySelector('.md-canvas-viewport'),
            x = viewport?.scrollLeft,
            y = viewport?.scrollTop;
          refresh('canvas');
          const fresh = document.querySelector('.md-canvas-viewport');
          if (fresh) {
            fresh.scrollLeft = x;
            fresh.scrollTop = y;
            fresh
              .querySelector('[data-md-select="' + el.dataset.mdSelect + '"]')
              ?.focus({ preventScroll: true });
          }
          return;
        }
        if (el.hasAttribute('data-md-group')) {
          activeGroup = el.value;
          refresh('canvas');
          return;
        }
        if (el.hasAttribute('data-md-gap')) {
          gapMinutes = Number(el.value);
          refresh('gaps');
          return;
        }
        if (el.form?.id === 'mdSettings') {
          const preview = el.form.querySelector('[data-md-preview]');
          if (preview) {
            preview.dataset.effects = el.form.elements.namedItem('effects').value;
            preview.classList.toggle(
              'no-particles',
              !el.form.elements.namedItem('particles').checked
            );
          }
        }
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (!el.hasAttribute('data-md-replay')) return;
      replayMinute = Number(el.value);
      const container = el.closest('.md-widget-body');
      if (container) {
        const preview = document.createElement('div');
        preview.innerHTML = replay();
        const tracks = [...preview.querySelectorAll('.md-replay-track')];
        [...container.querySelectorAll('.md-replay-track')].forEach((track, i) =>
          track.replaceWith(tracks[i])
        );
        container.querySelector('[data-md-replay-label]').textContent = E.clock(replayMinute);
      }
    });
    function runtime() {
      const f = a.focus();
      for (const el of document.querySelectorAll('[data-md-focus-clock]'))
        el.textContent = clockText(f.remaining);
      for (const el of document.querySelectorAll('[data-md-focus-state]'))
        el.textContent = f.active
          ? f.paused
            ? 'Paused'
            : 'One thing at a time'
          : 'Ready when you are';
      for (const el of document.querySelectorAll('[data-md-focus-title]'))
        el.textContent = f.title || 'A quiet place to begin.';
      for (const el of document.querySelectorAll('[data-md-orb]')) {
        el.classList.toggle('is-running', f.active && !f.paused);
        el.style.setProperty('--orb-progress', 100 * (1 - f.remaining / (f.minutes * 60)) + '%');
      }
      for (const el of document.querySelectorAll('[data-md="focus-pause"],[data-md="focus-end"]')) {
        el.disabled = !f.active;
        if (el.dataset.md === 'focus-pause') el.textContent = f.paused ? 'Resume' : 'Pause';
      }
      for (const el of document.querySelectorAll('[data-md-now]'))
        el.textContent = E.clock(nowMinute());
      for (const el of document.querySelectorAll('[data-md-track] .md-now-marker')) {
        const track = el.parentElement;
        el.style.left =
          Math.max(
            0,
            Math.min(
              100,
              ((nowMinute() - +track.dataset.start) / (+track.dataset.end - +track.dataset.start)) *
                100
            )
          ) + '%';
      }
    }
    function mount() {
      sync();
      if (!owner) return;
      const page = document.querySelector('.my-day-page');
      if (!page) return;
      page.dataset.effects = store().settings.effects;
      page.dataset.particles = String(store().settings.particles);
      const count = completeCount();
      if (lastMissionCount !== null && count > lastMissionCount) celebrate();
      lastMissionCount = count;
      if (undo?.owner === owner && !page.querySelector('[data-md="undo"]')) {
        const target = page.querySelector('[data-widget="canvas"] .md-canvas-toolbar');
        target?.insertAdjacentHTML(
          'afterend',
          `<div class="md-canvas-undo">${button('undo', '↶ Undo canvas removal')}</div>`
        );
      }
      visual.mount();
      rest.tick();
      runtime();
    }
    let lastMinute = -1;
    function tick() {
      sync();
      rest.tick();
      if (!owner || document.hidden) return;
      runtime();
      const minute = nowMinute();
      if (minute !== lastMinute && !drag && !activityMove && !activityDrag) {
        lastMinute = minute;
        if (!document.querySelector('dialog[open]'))
          for (const id of ['dayJourney', 'upNext', 'gaps']) refresh(id);
      }
    }
    return {
      visual,
      rest,
      hero,
      toolbar,
      wrapper,
      widget,
      mount,
      tick,
      sync,
      handle,
      submit,
      settings,
      ideaEditor,
      missionsForm,
      morning,
      evening,
      estimate,
      canvas,
      breakSnapshot: rest.snapshot,
    };
  }
  root.WorkHubMyDay = { install };
})(window);
