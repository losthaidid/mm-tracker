/** Private plan/actual timeline, quick interruptions, retrospective capture and later linking. */
(function (root) {
  'use strict';
  const E = root.WorkHubScheduleEngine;
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const copy = x => JSON.parse(JSON.stringify(x));
  const duration = n =>
    Math.round(n) >= 60
      ? Math.floor(Math.round(n) / 60) + 'h ' + (Math.round(n) % 60) + 'm'
      : Math.round(n) + 'm';
  const localStamp = at =>
    E.localDate(at) + 'T' + E.time(at) + ':' + String(new Date(at).getSeconds()).padStart(2, '0');
  const input = (name, label, value = '', type = 'text') =>
    `<label>${label}<input name="${name}" type="${type}"${type === 'datetime-local' ? ' step="1"' : ''} maxlength="500" value="${esc(value)}"></label>`;
  const button = (action, label, attrs = '') =>
    `<button type="button" data-work-schedule="${action}" ${attrs}>${label}</button>`;
  function install(a) {
    const owner = () => a.cloud().user?.id || '';
    let pendingLink = null;
    const getSession = (d, id) =>
      d.workhub.sessions.find(s => s.id === id) ||
      d.workhub.daySchedule?.retained.find(s => s.id === id);
    function guard(form = null) {
      if (
        !a.cloud().ready ||
        !owner() ||
        (form && (!form.isConnected || form.dataset.owner !== owner()))
      )
        throw Error('Reopen this work entry after signing in to the correct account.');
    }
    function options(rows, value = '', blank = 'Choose record') {
      return (
        `<option value="">${blank}</option>` +
        rows
          .map(
            ([id, label]) =>
              `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(label)}</option>`
          )
          .join('')
      );
    }
    function enhanceTimerForm(form, seed = {}) {
      if (!form) return;
      form.dataset.owner = owner();
      if (!form.querySelector('[name="captureMode"]')) {
        const area = document.createElement('div');
        area.className = 'wide day-work-capture';
        area.innerHTML = `<label>Record source<select name="captureMode"><option value="listed">Maintained record</option><option value="unlisted">Unlisted work · maintain later</option></select></label><div data-work-unlisted hidden>${input('unlistedName', 'Project / ticket name (optional)', seed.unlistedName || '')}${input('companyHint', 'Company name (optional)', seed.companyHint || '')}${input('reference', 'Ticket / project reference (optional)', seed.reference || '')}</div><div data-work-company></div>`;
        form.querySelector('.form-grid').prepend(area);
        if (form.dataset.switch === 'true') {
          const at = document.createElement('div');
          at.className = 'wide';
          at.innerHTML = input(
            'actualStart',
            'Switch at · adjust if you switched earlier',
            localStamp(Date.now()),
            'datetime-local'
          );
          form.querySelector('.form-grid').append(at);
        }
        if (seed.unlisted) form.elements.captureMode.value = 'unlisted';
      }
      const kind = form.elements.kind.value,
        unlisted =
          form.elements.captureMode.value === 'unlisted' && ['project', 'ticket'].includes(kind);
      form.querySelector('[name="captureMode"]').closest('label').hidden = ![
        'project',
        'ticket',
      ].includes(kind);
      form.querySelector('[data-work-unlisted]').hidden = !unlisted;
      const linked = form.querySelector('#hubTimerLink');
      if (linked) linked.hidden = unlisted;
      const charge = form.querySelector('#hubTimerCharge');
      if (charge) charge.hidden = unlisted;
      const company = form.querySelector('[data-work-company]'),
        projectId = kind === 'project' && !unlisted ? form.elements.linkId?.value : '';
      const current = company.querySelector('select')?.value || seed.companyId || '';
      const rows = (a.state().projectCompanies || []).filter(
        c => c.projectId === projectId && c.active !== false
      );
      company.innerHTML = projectId
        ? `<label>Company (optional)<select name="companyId">${options(
            rows.map(c => [c.id, c.name]),
            current,
            'Whole project'
          )}</select></label>`
        : '';
      const submit = form.querySelector('button[type="submit"]');
      submit.textContent = form.dataset.switch === 'true' ? 'Switch work' : 'Start work';
      if (form.elements.title && seed.title) form.elements.title.value = seed.title.slice(0, 500);
    }
    function workRow(s) {
      const state = a.state(),
        project = state.projects.find(p => p.id === s.projectId),
        ticket = state.tickets.find(t => t.id === s.linkId && s.kind === 'ticket');
      const company =
        state.projectCompanies?.find(c => c.id === s.companyId)?.name || s.companyHint;
      const unlinked = s.unlisted && !s.linkId;
      return `<article class="day-actual-row" data-actual-id="${esc(s.id)}"><div><strong>${esc(s.title)}</strong><small>${esc(s.date || E.localDate(Date.parse(s.start)))} · ${esc(s.time || E.time(Date.parse(s.start)))}–${esc(s.endTime || E.time(Date.parse(s.end)))} · ${duration(s.minutes ?? s.seconds / 60)}</small><small>${esc([project?.name || ticket?.ticket || s.unlistedName || s.kind, company, s.reference, [s.itemTitle, s.subItemTitle].filter(Boolean).join(' → ')].filter(Boolean).join(' · '))}</small></div><div class="day-actual-actions"><span class="day-status status-${(s.status || 'Actual').toLowerCase()}">${esc(s.status || 'Actual')}</span>${unlinked ? '<small>Unlisted · saved</small>' + button('link', 'Link / maintain', `data-id="${esc(s.id)}"`) : s.unlisted ? '<small>Captured unlisted · linked</small>' : ''}</div></article>`;
    }
    function section(date = a.today()) {
      const d = a.state(),
        rows = E.day(d, date, a.timer()),
        minutes = E.minutes(rows.flatMap(s => s.parts));
      const history = (d.workhub.daySchedule?.changes || []).flatMap(c =>
        c.entries.filter(e => e.date === date).map(e => ({ ...e, status: c.status }))
      );
      return `<section class="panel box day-execution" data-day-execution="${esc(date)}"><div class="flex-title"><div><span class="eyebrow">PLAN &amp; ACTUAL</span><h3>Actual work · ${esc(date)}</h3><p class="muted">${duration(minutes)} tracked · original bookings stay in the calendar above.</p></div><div class="actions">${button('switch', a.timer() ? '⇄ Switch work' : '▶ Start / switch work')}${button('earlier', 'I switched earlier')}</div></div><p class="hint">Badges change automatically. Without tracked changes, the plan is assumed followed. “Actual · From plan” is separate from tracked time.</p><div class="day-actual-list">${rows.map(workRow).join('') || '<p class="muted">No tracked work for this day. Use Start / switch work when your day changes.</p>'}</div>${history.length ? `<details class="day-plan-history"><summary>Moved / cancelled plans · ${history.length}</summary>${history.map(e => `<div class="day-history-row"><span>${esc(e.time)}–${esc(e.endTime)} · ${esc(e.title)}</span><span class="day-status">${e.status}</span></div>`).join('')}</details>` : ''}</section>`;
    }
    function details(slot) {
      if (!['custom', 'task', 'ticket', 'project'].includes(slot.kind)) return '';
      const info = E.describe(a.state(), slot, Date.now(), a.timer());
      return `<section class="day-booking-execution"><h3>Daily execution</h3><p><strong>${esc(info.status)}</strong> · ${esc(info.source)}</p>${!slot.sessionId ? `<p>${duration(info.plannedMinutes)} planned · ${duration(info.displacedMinutes)} interrupted · ${duration(info.trackedMinutes)} tracked on this activity.</p><p class="hint">${info.displacedMinutes ? 'Other work is recorded separately below Schedule. Remaining plan-following time: ' + duration(Math.max(0, info.plannedMinutes - info.displacedMinutes)) + '.' : 'The outcome of this booking is independent of its task, ticket or project status.'}</p>${button('booking', 'Start / switch to this work', `data-date="${esc(slot.date)}" data-time="${esc(slot.time)}"`)}` : '<p class="hint">Recorded work stays Actual even if the related record is reopened or session history is tidied.</p>'}</section>`;
    }
    function actualCards(date, hour = null, projectId = '') {
      const d = a.state(),
        legacy = new Set(d.schedule.filter(s => s.sessionId).map(s => s.sessionId));
      const hourStart =
        hour === null
          ? 0
          : new Date(date + 'T' + String(hour).padStart(2, '0') + ':00:00').getTime();
      const rows = E.day(d, date, a.timer()).filter(
        s =>
          !legacy.has(s.id) &&
          (!projectId || s.projectId === projectId) &&
          (hour === null || s.parts.some(p => p[0] < hourStart + 3600000 && p[1] > hourStart))
      );
      return (
        rows
          .slice(0, 4)
          .map(
            s =>
              `<button type="button" class="slot workhub-booking compact day-actual-card status-${s.status.toLowerCase()}" data-work-schedule="actual" data-id="${esc(s.id)}"><span class="booking-time">Tracked · ${esc(s.time)}–${esc(s.endTime)}</span><strong>${esc(s.title)}</strong><span class="slot-state" title="Tracked work · original plan stays separate">${s.status}</span></button>`
          )
          .join('') +
        (rows.length > 4
          ? button('day', '+' + (rows.length - 4) + ' more actual sessions', `data-date="${date}"`)
          : '')
      );
    }
    function actualDetails(id) {
      const s = E.sessions(a.state(), a.timer()).find(s => s.id === id);
      if (!s) throw Error('This work session is no longer available.');
      a.openModal(
        'Actual work session',
        `<h3>${esc(s.title)}</h3><p>${esc([s.unlistedName, s.companyHint, s.reference, s.itemTitle, s.subItemTitle].filter(Boolean).join(' · '))}</p><span class="day-status">${s.running ? 'Active' : a.timer()?.id === s.id ? 'Paused' : 'Actual'}</span><p class="hint">Tracked time. The original plan and related record progress are kept separately.</p><dl class="booking-facts">${s.intervals.map(p => `<div><dt>${esc(E.localDate(Date.parse(p.start)))}</dt><dd>${esc(E.time(Date.parse(p.start)))}–${esc(E.time(Date.parse(p.end)))} · ${duration((Date.parse(p.end) - Date.parse(p.start)) / 60000)}</dd></div>`).join('')}</dl><p class="prewrap">${esc(s.notes || '')}</p><div class="modal-actions">${button('close', 'Close')}${s.unlisted && !s.linkId && getSession(a.state(), s.id) ? button('link', 'Link / maintain', `data-id="${esc(s.id)}"`) : ''}</div>`
      );
    }
    function openEarlier() {
      guard();
      a.openModal(
        'Record an earlier change of work',
        `<form id="dayEarlierForm" data-owner="${esc(owner())}"><div class="form-grid"><label>Work type<select name="kind"><option value="custom">Other work</option><option value="ticket">Unlisted ticket</option><option value="project">Unlisted project</option></select></label>${input('title', 'What did you work on?')}${input('unlistedName', 'Project / ticket name (optional)')}${input('companyHint', 'Company name (optional)')}${input('reference', 'Reference (optional)')}${input('start', 'Actual start', localStamp(Date.now() - 1800000), 'datetime-local')}${input('end', 'Actual end', localStamp(Date.now()), 'datetime-local')}${input('notes', 'Notes (optional)')}</div><p class="hint">Record the time you actually switched. The original plan stays visible and its badge recalculates automatically.</p><div class="modal-actions">${button('close', 'Cancel')}<button type="submit" class="primary">Save actual work</button></div></form>`
      );
    }
    function recordEarlier(values) {
      guard();
      const start = new Date(values.start).toISOString(),
        end = new Date(values.end).toISOString();
      if (
        Date.parse(end) <= Date.parse(start) ||
        Date.parse(end) > Date.now() ||
        Date.parse(end) - Date.parse(start) > 366 * 86400000
      )
        throw Error('Choose a past start and a later end, within one year.');
      const s = {
        id: root.crypto.randomUUID(),
        kind: values.kind,
        title: values.title.trim(),
        linkId: '',
        projectId: '',
        start,
        end,
        intervals: [{ start, end }],
        seconds: (Date.parse(end) - Date.parse(start)) / 1000,
        notes: values.notes || '',
        chargeCode: '',
        unlisted: values.kind !== 'custom',
        unlistedName: values.unlistedName || '',
        companyHint: values.companyHint || '',
        reference: values.reference || '',
        scheduled: true,
        scheduleVersion: 1,
        endReason: 'stop',
      };
      s.captureIdentity = E.identity(s, a.state());
      E.validateSession(s);
      E.assertAvailable(a.state(), s.intervals, '', a.timer());
      if (
        a.mutate(d => {
          E.assertAvailable(d, s.intervals);
          d.workhub.sessions.push(s);
        })
      ) {
        a.closeModal();
        a.tell('Actual work saved. Schedule badges have been recalculated.');
      }
    }
    function linkForm(id) {
      guard();
      const s = getSession(a.state(), id);
      if (!s || !s.unlisted || s.linkId)
        throw Error('This unlisted session is no longer available.');
      pendingLink = { id, owner: owner(), before: JSON.stringify(s) };
      const rows =
        s.kind === 'project'
          ? a.state().projects.map(p => [p.id, p.name])
          : a.state().tickets.map(t => [t.id, t.ticket + ' · ' + t.description]);
      a.openModal(
        'Link earlier ' + s.kind + ' work',
        `<form id="dayLinkForm" data-owner="${esc(owner())}" data-id="${esc(id)}"><p><strong>${esc(s.title)}</strong> · ${esc(s.unlistedName)}${s.companyHint ? ' · ' + esc(s.companyHint) : ''}</p><label>Maintained ${s.kind}<select name="linkId">${options(rows)}</select></label><div id="dayLinkCompany"></div><p class="hint">Original dates, time and Schedule outcomes stay intact. This does not complete the linked record.</p><div class="modal-actions">${button('create', 'Create ' + s.kind + ' from this session', `data-id="${esc(id)}"`)}<button type="submit" class="primary">Link work</button></div></form>`
      );
    }
    function linkSession(id, target, companyId = '', expected = pendingLink) {
      guard();
      if (!expected || expected.id !== id || expected.owner !== owner())
        throw Error('Reopen this session before linking.');
      return a.mutate(d => {
        const s = getSession(d, id);
        if (!s || JSON.stringify(s) !== expected.before)
          throw Error('The session changed. Reopen it before linking.');
        const record = (s.kind === 'project' ? d.projects : d.tickets).find(r => r.id === target);
        if (!record) throw Error('Choose a maintained ' + s.kind + '.');
        if (
          companyId &&
          !d.projectCompanies.some(
            c => c.id === companyId && c.projectId === target && c.active !== false
          )
        )
          throw Error('Choose an active company from the selected project.');
        s.captureIdentity ||= E.identity(s, d);
        s.linkId = target;
        s.projectId = s.kind === 'project' ? target : '';
        s.companyId = s.kind === 'project' ? companyId : '';
        s.chargeCode = s.kind === 'project' ? record.code || '' : '';
      });
    }
    function linkCreated(kind, recordId, sessionId, account) {
      if (account !== owner() || pendingLink?.id !== sessionId) return;
      const s = getSession(a.state(), sessionId);
      if (s?.kind === kind && linkSession(sessionId, recordId)) {
        pendingLink = null;
        a.tell('Record created and earlier work linked with its original time.');
      }
    }
    function mount(tab) {
      if (pendingLink && pendingLink.owner !== owner()) pendingLink = null;
      if (tab === 'specs' && !document.getElementById('dayProjectWork')) {
        const id = a.state().activeProjectId,
          rows = E.sessions(a.state())
            .filter(s => s.projectId === id)
            .sort((a, b) => b.start.localeCompare(a.start));
        const section = document.createElement('section');
        section.id = 'dayProjectWork';
        section.className = 'panel box day-execution';
        section.innerHTML = `<div class="flex-title"><div><span class="eyebrow">ACTUAL PROJECT WORK</span><h3>Work history · ${duration(rows.reduce((n, s) => n + s.seconds / 60, 0))}</h3></div>${button('project', '▶ Start / switch project work', `data-id="${esc(id)}"`)}</div><p class="hint">Sessions are independent of project phase and daily plans. Archived sessions remain included.</p>${rows.slice(0, 50).map(workRow).join('') || '<p class="muted">Tracked project sessions will appear here.</p>'}`;
        document.getElementById('view')?.append(section);
      }
    }
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-work-schedule]');
      if (!b) return;
      event.preventDefault();
      try {
        guard();
        const action = b.dataset.workSchedule;
        if (action === 'close') a.closeModal();
        if (action === 'switch') a.timerEditor('custom', '', '', '', '', true);
        if (action === 'earlier') openEarlier();
        if (action === 'project') a.timerEditor('project', b.dataset.id, '', '', '', true);
        if (action === 'booking') {
          const slot = a
            .state()
            .schedule.find(
              s => !s.sessionId && s.date === b.dataset.date && s.time === b.dataset.time
            );
          if (!slot) throw Error('This booking changed. Reopen it first.');
          a.timerEditor(slot.kind, slot.linkId, '', slot.itemId, slot.subItemId, true, {
            title: E.title(a.state(), slot),
            allocationKey: E.key(slot),
            companyId: slot.companyId,
          });
        }
        if (action === 'link') linkForm(b.dataset.id);
        if (action === 'actual') actualDetails(b.dataset.id);
        if (action === 'day') a.openWorkDay(b.dataset.date);
        if (action === 'create') {
          const s = getSession(a.state(), b.dataset.id);
          if (!s || !pendingLink) throw Error('Reopen this session.');
          a.createWorkRecord(s.kind, s);
        }
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('change', event => {
      const form = event.target.form;
      if (
        form?.id === 'hubTimerStart' &&
        ['kind', 'linkId', 'captureMode'].includes(event.target.name)
      )
        enhanceTimerForm(form);
      if (form?.id === 'dayLinkForm' && event.target.name === 'linkId') {
        const s = getSession(a.state(), form.dataset.id);
        const rows = a
          .state()
          .projectCompanies.filter(c => c.projectId === event.target.value && c.active !== false);
        document.getElementById('dayLinkCompany').innerHTML =
          s?.kind === 'project'
            ? `<label>Company (optional)<select name="companyId">${options(
                rows.map(c => [c.id, c.name]),
                '',
                'Whole project'
              )}</select></label>`
            : '';
      }
    });
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!['dayEarlierForm', 'dayLinkForm'].includes(form.id)) return;
      event.preventDefault();
      try {
        guard(form);
        const v = Object.fromEntries(new FormData(form));
        if (form.id === 'dayEarlierForm') recordEarlier(v);
        else if (linkSession(form.dataset.id, v.linkId, v.companyId || '')) {
          pendingLink = null;
          a.closeModal();
          a.tell('Earlier work linked. Original time and Schedule outcomes are preserved.');
        }
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    function refreshActuals() {
      const el = document.querySelector('[data-day-execution]');
      if (el && a.cloud().ready) el.outerHTML = section(el.dataset.dayExecution);
      for (const container of document.querySelectorAll('[data-day-actuals]')) {
        const markup = actualCards(
          container.dataset.dayActuals,
          container.dataset.hour ? Number(container.dataset.hour) : null,
          container.dataset.project || ''
        );
        if (container.innerHTML !== markup) container.innerHTML = markup;
      }
    }
    return {
      section,
      details,
      actualCards,
      mount,
      refreshActuals,
      enhanceTimerForm,
      recordEarlier,
      linkSession,
      linkCreated,
    };
  }
  root.WorkHubWorkSchedule = { install };
})(window);
