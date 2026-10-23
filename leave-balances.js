/** AL / MC Settings and live Schedule balance previews; uses the existing account save adapter. */
(function (root) {
  'use strict';
  const E = root.WorkHubLeaveBalancesEngine,
    esc = v =>
      String(v ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      ),
    label = (kind, d) => {
      const t = E.type(d, kind);
      return t ? t.name + ' · ' + t.code : 'Saved leave';
    },
    number = n => (n === null ? 'Not set' : String(n)),
    DAYS = [
      [1, 'Mon'],
      [2, 'Tue'],
      [3, 'Wed'],
      [4, 'Thu'],
      [5, 'Fri'],
      [6, 'Sat'],
      [0, 'Sun'],
    ];
  const icon = kind =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind === 'annual-leave' ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>' : kind === 'medical-leave' ? '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8v8m-4-4h8"/>' : '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h3"/>'}</svg>`;
  function cards(d, year, actionable = false) {
    return `<div class="leave-balance-cards">${E.types(d)
      .filter(
        t =>
          !t.archived ||
          E.balance(d, year, t.id).scheduled > 0 ||
          E.balance(d, year, t.id).openingUsed > 0 ||
          E.balance(d, year, t.id).allowance !== null
      )
      .map(t => {
        const kind = t.id;
        const b = E.balance(d, year, kind),
          configured = b.allowance !== null,
          used = b.openingUsed + b.scheduled,
          state = !configured
            ? 'setup'
            : b.remaining < 0
              ? 'overdrawn'
              : b.remaining === 0
                ? 'empty'
                : 'available',
          status = {
            setup: 'Setup needed',
            overdrawn: 'Over allowance',
            empty: 'Fully used / reserved',
            available: 'Available to plan',
          }[state],
          earlierWidth =
            b.allowance > 0
              ? Math.min(100, (b.openingUsed / b.allowance) * 100)
              : b.openingUsed
                ? 100
                : 0,
          scheduledWidth =
            b.allowance > 0
              ? Math.min(100 - earlierWidth, (b.scheduled / b.allowance) * 100)
              : b.scheduled
                ? 100 - earlierWidth
                : 0;
        return `<article class="leave-balance-card${state === 'overdrawn' ? ' leave-overdrawn' : ''}" data-leave-kind="${kind}" data-balance-state="${state}" aria-label="${esc(label(kind, d))} balance for ${year}"><div class="leave-card-top"><div class="leave-card-identity"><span class="leave-card-icon">${icon(kind)}</span><div><span class="leave-card-code">${esc(t.code)}</span><h3>${esc(t.name)}</h3></div></div><span class="leave-card-status">${t.archived ? 'Archived' : status}</span></div><div class="leave-card-value"><strong>${b.remaining === null ? '—' : number(b.remaining)} <small>days remaining</small></strong></div><dl class="leave-balance-stats"><div><dt>Allowance</dt><dd>${b.allowance === null ? '—' : number(b.allowance)}</dd></div><div><dt>Taken earlier</dt><dd>${number(b.openingUsed)}</dd></div><div><dt>Scheduled</dt><dd>${number(b.scheduled)}</dd></div></dl>${configured ? `<div class="leave-usage-track" role="img" aria-label="${b.openingUsed} days taken outside Schedule and ${b.scheduled} days scheduled, out of ${b.allowance} allowed"><span class="leave-usage-earlier" style="width:${earlierWidth}%"></span><span class="leave-usage-scheduled" style="width:${scheduledWidth}%"></span></div><p class="leave-card-note">${b.remaining < 0 ? `${number(-b.remaining)} day(s) over allowance. Review your usage or allowance.` : `${number(used)} of ${number(b.allowance)} days taken or reserved.`}</p>` : '<p class="leave-card-note"><strong>Allowance not set.</strong> Add your yearly allowance and earlier usage to see your balance.</p>'}${actionable ? `<button type="button" class="leave-card-action" data-leave-balance="settings" data-year="${year}" data-kind="${kind}">${configured ? 'Manage' : 'Set up'} ${esc(t.name)} <span aria-hidden="true">↗</span></button>` : ''}</article>`;
      })
      .join('')}</div>`;
  }
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      editingOwner = '',
      editingSnapshot = '',
      editingTypesSnapshot = '',
      rangeDraft = null,
      typeDraft = null;
    const thisYear = () => a.today().slice(0, 4);
    function manageTypes() {
      if (!a.ready()) return;
      typeDraft = null;
      a.openModal(
        'Leave types',
        `<section id="leaveTypesManager"><div class="leave-types-intro"><div><p>Maintain the leave types you use. Active types appear in Schedule and have their own yearly balance.</p><p class="hint">Archive a type to hide it from new bookings. Existing bookings and saved balances stay available.</p></div><button type="button" class="primary" data-leave-balance="new-type">＋ Add leave type</button></div><div class="leave-type-list">${E.types(
          a.state()
        )
          .map(
            t =>
              `<article class="leave-type-row"><span class="leave-type-code">${esc(t.code)}</span><div><h3>${esc(t.name)}</h3><p>${t.archived ? 'Archived · available on existing bookings' : 'Active · available in Schedule'}${Object.hasOwn(E.TYPES, t.id) ? ' · original type' : ''}</p></div><button type="button" data-leave-balance="edit-type" data-kind="${t.id}" aria-label="Edit ${esc(t.name)}">Edit</button></article>`
          )
          .join(
            ''
          )}</div><div class="modal-actions"><button type="button" data-action="cancel">Close</button></div></section>`
      );
    }
    function editType(id = '') {
      if (!a.ready()) return;
      const old = id ? E.type(a.state(), id) : null;
      if (id && !old) throw Error('This leave type is no longer available. Reopen the list.');
      typeDraft = { owner: a.owner(), id, snapshot: old ? JSON.stringify(old) : '' };
      a.openModal(
        old ? 'Edit leave type' : 'Add leave type',
        `<form id="leaveTypeForm"><div class="form-grid"><div class="span2"><label for="leaveTypeName">Leave type name *</label><input id="leaveTypeName" name="name" maxlength="80" value="${esc(old?.name || '')}" placeholder="e.g. Compassionate Leave" required></div><div><label for="leaveTypeCode">Short code *</label><input id="leaveTypeCode" name="code" maxlength="12" pattern="[A-Za-z0-9][A-Za-z0-9-]{0,11}" value="${esc(old?.code || '')}" placeholder="e.g. CL" required></div>${old ? `<div class="wide"><label class="check-label"><input type="checkbox" name="archived"${old.archived ? ' checked' : ''}>Archive this leave type</label></div>` : ''}</div><p class="hint">A leave type has its own yearly allowance and earlier-usage total. Set those in Leave allowances & balances after saving. Existing calendar titles and hours are preserved when a type is renamed.</p><div class="modal-actions"><button type="button" data-leave-balance="types">Back to leave types</button><button type="submit" class="primary">Save leave type</button></div></form>`
      );
    }
    function saveType(form) {
      if (!a.ready() || !typeDraft || typeDraft.owner !== a.owner())
        throw Error('Reopen leave types for the current account.');
      const old = typeDraft.id ? E.type(a.state(), typeDraft.id) : null;
      if (typeDraft.id && JSON.stringify(old) !== typeDraft.snapshot)
        throw Error('This leave type changed while the form was open. Reopen it before saving.');
      const row = {
        id:
          old?.id ||
          'leave-' +
            (root.crypto?.randomUUID?.() ||
              Date.now().toString(36) + Math.random().toString(36).slice(2)),
        name: form.elements.namedItem('name').value.trim(),
        code: form.elements.namedItem('code').value.trim().toUpperCase(),
        archived: !!form.elements.namedItem('archived')?.checked,
      };
      const rows = old
        ? E.types(a.state()).map(t => (t.id === old.id ? row : t))
        : [...E.types(a.state()), row];
      E.validateTypes(rows);
      const ok = a.mutate(d => {
        d.workhub.leaveTypes = rows;
      });
      if (ok) {
        manageTypes();
        a.tell('Leave type saved and Schedule updated.');
      }
      return ok;
    }
    function settings(year = thisYear(), kind = '') {
      if (!a.ready()) return;
      if (!E.validYear(year)) throw Error('Choose a year from 1900 to 9999.');
      editingOwner = a.owner();
      rangeDraft = null;
      const d = a.state(),
        saved = { ...E.defaults(year, d), ...d.workhub.leaveBalances.find(y => y.id === year) };
      editingSnapshot = JSON.stringify(saved);
      editingTypesSnapshot = JSON.stringify(E.types(d));
      a.openModal(
        'Leave allowances & balances',
        `<form id="leaveBalanceForm" data-year="${year}"><div class="leave-allowance-intro"><p>Set the allowance for each calendar year. Planned, requested and approved leave in Schedule all reserve days.</p><div class="leave-year-picker"><label for="leaveBalanceYear">Allowance year</label><input id="leaveBalanceYear" name="year" type="number" min="1900" max="9999" step="1" value="${year}" required><button type="button" data-leave-balance="load-year">Open year</button></div><p class="hint">Use Open year to switch years. Save your edits before opening another year; Open year loads that year’s saved allowances.</p></div>${cards(d, year)}<div class="leave-allowance-grid">${E.types(
          d
        )
          .map(t => {
            const kind = t.id;
            const p = saved[kind];
            return `<fieldset class="leave-allowance-type"><legend>${esc(label(kind, d))}${t.archived ? ' · archived' : ''}</legend><label for="${kind}-allowance">Yearly allowance (days)</label><input id="${kind}-allowance" name="${kind}-allowance" type="number" min="0" max="366" step="0.5" value="${p.allowance ?? ''}" placeholder="Not set"><label for="${kind}-used">Already taken outside Schedule (days)</label><input id="${kind}-used" name="${kind}-used" type="number" min="0" max="366" step="0.5" value="${p.openingUsed}" required><p class="hint">Enter leave taken in earlier months, or any leave not recorded in Schedule. Leave already in Schedule is counted automatically; do not include it again here.</p><span class="leave-days-label" id="${kind}-weekdays-label">Count leave on</span><div class="leave-weekdays" role="group" aria-labelledby="${kind}-weekdays-label">${DAYS.map(([day, name]) => `<label><input type="checkbox" name="${kind}-weekday" value="${day}"${p.weekdays.includes(day) ? ' checked' : ''}>${name}</label>`).join('')}</div></fieldset>`;
          })
          .join(
            ''
          )}</div><p class="hint">Full day = 1 day; morning / afternoon = 0.5 day. Custom hours let you choose 0.5 or 1 day. Dates outside the selected weekdays are not charged. Public holidays are not detected automatically. A blank allowance keeps that type unlimited until you set it.</p><p class="hint">For example: 12 days allowed − 10 used outside Schedule = 2 days available before any scheduled leave. Removing a booking restores its reserved days.</p><div id="leaveSettingsPreview" class="leave-settings-preview" role="status" aria-live="polite"></div><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save allowances</button></div></form>`
      );
      updateSettings($('leaveBalanceForm'));
      if (E.type(d, kind)) $(kind + '-allowance')?.focus();
    }
    function readSettings(form) {
      if (JSON.stringify(E.types(a.state())) !== editingTypesSnapshot)
        throw Error(
          'Leave types changed while this form was open. Reopen allowances to load the latest list.'
        );
      const year = form.elements.namedItem('year').value.trim();
      if (year !== form.dataset.year)
        throw Error('Choose Open year before saving a different year.');
      const row = E.defaults(year, a.state());
      for (const t of E.types(a.state())) {
        const kind = t.id;
        const value = form.elements.namedItem(kind + '-allowance').value.trim(),
          used = form.elements.namedItem(kind + '-used').value.trim();
        if (!used) throw Error('Enter the leave already used (0 if none).');
        row[kind] = {
          allowance: value === '' ? null : Number(value),
          openingUsed: Number(used),
          weekdays: [...form.querySelectorAll(`[name="${kind}-weekday"]:checked`)].map(el =>
            Number(el.value)
          ),
        };
      }
      E.validate({
        workhub: { leaveBalances: [row], leaveTypes: E.types(a.state()) },
        schedule: [],
      });
      return row;
    }
    function withSettings(d, row) {
      return {
        ...d,
        workhub: {
          ...d.workhub,
          leaveBalances: [...d.workhub.leaveBalances.filter(y => y.id !== row.id), row],
        },
      };
    }
    function updateSettings(form) {
      const host = form?.querySelector('#leaveSettingsPreview');
      if (!host) return;
      try {
        const row = readSettings(form),
          next = withSettings(a.state(), row);
        host.innerHTML = `<h3>Balance after saving · ${row.id}</h3>${cards(next, row.id)}`;
      } catch (error) {
        host.textContent = error.message;
      }
    }
    function saveSettings(form) {
      if (!a.ready() || editingOwner !== a.owner())
        throw Error('Reopen leave settings for the current account.');
      const row = readSettings(form),
        current = {
          ...E.defaults(row.id, a.state()),
          ...a.state().workhub.leaveBalances.find(y => y.id === row.id),
        };
      if (JSON.stringify(current) !== editingSnapshot)
        throw Error(
          'These leave allowances changed while this form was open. Reopen Settings to review the latest balances.'
        );
      const ok = a.mutate(d => {
        d.workhub.leaveBalances = withSettings(d, row).workhub.leaveBalances;
      });
      if (ok) {
        a.closeModal();
        a.tell('Leave allowances and earlier usage saved.');
      }
      return ok;
    }
    function range(draft) {
      rangeDraft = { ...draft };
      const year = (draft.date || a.today()).slice(0, 4);
      return `<section class="leave-range-balances wide" aria-label="Leave balances"><div class="leave-balance-heading"><h3>Leave balance · <span data-leave-balance-years>${year}</span></h3><span class="hint">Maintain in Settings → Annual leave & MC</span></div><div data-leave-range-current>${cards(a.state(), year)}</div><div data-leave-range-preview role="status" aria-live="polite"></div></section>`;
    }
    function updateRange(form) {
      if (!form?.querySelector('[data-leave-range-current]') || !a.ready()) return;
      const get = k => form.elements.namedItem(k)?.value || '',
        kind = get('kind'),
        year = E.validYear(get('date').slice(0, 4)) ? get('date').slice(0, 4) : thisYear();
      const custom = form.querySelector('[data-leave-custom-days]'),
        customInput = form.elements.namedItem('leaveDaysPerDate');
      if (custom) {
        custom.hidden = get('leavePortion') !== 'custom';
        customInput.disabled = custom.hidden;
      }
      form.querySelector('[data-leave-balance-years]').textContent = year;
      form.querySelector('[data-leave-range-current]').innerHTML = cards(a.state(), year);
      const host = form.querySelector('[data-leave-range-preview]');
      if (!root.WorkHubLeave.isLeave(kind)) {
        host.textContent = '';
        return;
      }
      try {
        const leave = {
          portion: get('leavePortion'),
          daysPerDate: Number(get('leaveDaysPerDate') || 1),
        };
        if (leave.portion === 'custom' && ![0.5, 1].includes(leave.daysPerDate))
          throw Error('Choose 0.5 or 1 day for custom leave.');
        const draft = {
            ...rangeDraft,
            kind,
            date: get('date'),
            endDate: get('endDate'),
            time: get('time'),
            leave,
          },
          result = E.preview(a.state(), draft);
        form.querySelector('[data-leave-balance-years]').textContent = result.years.join(' / ');
        form.querySelector('[data-leave-range-current]').innerHTML = result.years
          .map(y => (result.years.length > 1 ? `<h4>${y}</h4>` : '') + cards(a.state(), y))
          .join('');
        let warning = '';
        try {
          E.assertWithinBalance(a.state(), result.next);
        } catch (error) {
          warning = error.message;
        }
        host.innerHTML = `<div class="leave-request-preview${warning ? ' leave-overdrawn' : ''}">${result.rows.map(b => `<p><strong>${b.year} · ${esc(label(kind, a.state()))}:</strong> ${number(b.requested)} day(s) in this range${b.remaining === null ? ' · set this year’s allowance to see a remaining balance.' : ' · <strong>' + number(b.remaining) + ' day(s) remaining after saving.</strong>'}</p>`).join('')}${warning ? `<p class="leave-limit-warning">${esc(warning)}</p>` : ''}<small>Existing bookings count once. Editing replaces this booking. Full days count as 1; half-days as 0.5. Only your configured weekdays are charged.</small></div>`;
      } catch (error) {
        host.textContent = error.message;
      }
    }
    function mount(tab) {
      const nextOwner = a.ready() ? a.owner() : '';
      if (nextOwner !== owner) {
        owner = nextOwner;
        rangeDraft = null;
        if ($('leaveBalanceForm') || $('leaveTypeForm') || $('leaveTypesManager')) a.closeModal();
        typeDraft = null;
      }
      const host =
        $('hubSettingsAppearance') || document.querySelector('#settingsMenu .settings-panel');
      if (host && !$('leaveBalanceSettingsButton')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'leaveBalanceSettingsButton';
        b.dataset.leaveBalance = 'settings';
        b.textContent = 'Leave allowances & balances';
        host.append(b);
      }
      if ($('leaveBalanceSettingsButton')) $('leaveBalanceSettingsButton').hidden = !a.ready();
      if (host && !$('leaveTypeSettingsButton')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'leaveTypeSettingsButton';
        b.dataset.leaveBalance = 'types';
        b.textContent = 'Leave types';
        host.append(b);
      }
      if ($('leaveTypeSettingsButton')) $('leaveTypeSettingsButton').hidden = !a.ready();
      if (tab !== 'schedule' || !a.ready()) return;
      const schedule = document.querySelector('#view .schedule-workspace');
      if (schedule && !$('leaveScheduleBalances')) {
        const section = document.createElement('section'),
          year = a.month().slice(0, 4);
        section.id = 'leaveScheduleBalances';
        section.className = 'panel leave-schedule-balances';
        section.innerHTML = `<div class="leave-balance-heading"><div><span class="eyebrow">YOUR TIME OFF</span><h2>Leave balances · ${year}</h2><p class="leave-balance-subtitle">A clear view of the days you have, have taken and have planned.</p></div><div class="leave-heading-actions"><button type="button" data-leave-balance="types">Manage leave types</button><button type="button" class="leave-maintain-button" data-leave-balance="settings" data-year="${year}">Maintain allowances <span aria-hidden="true">↗</span></button></div></div>${cards(a.state(), year, true)}<div class="leave-balance-footer"><span class="leave-info-icon" aria-hidden="true">i</span><p><strong>Allowance − taken earlier − scheduled = remaining.</strong> Taken earlier means leave outside Schedule. Planned, requested and approved bookings reserve days for the whole year.</p></div>`;
        schedule.prepend(section);
      }
    }
    document.addEventListener('click', event => {
      const b = event.target.closest('[data-leave-balance]');
      if (!b) return;
      try {
        if (b.dataset.leaveBalance === 'settings')
          settings(b.dataset.year || thisYear(), b.dataset.kind || '');
        if (b.dataset.leaveBalance === 'load-year') settings($('leaveBalanceYear').value.trim());
        if (b.dataset.leaveBalance === 'types') manageTypes();
        if (b.dataset.leaveBalance === 'new-type') editType();
        if (b.dataset.leaveBalance === 'edit-type') editType(b.dataset.kind);
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'leaveTypeForm') {
        event.preventDefault();
        try {
          saveType(event.target);
        } catch (error) {
          a.tell(error.message, true);
        }
        return;
      }
      if (event.target.id !== 'leaveBalanceForm') return;
      event.preventDefault();
      try {
        saveSettings(event.target);
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    for (const name of ['input', 'change'])
      document.addEventListener(name, event => {
        if (event.target.form?.id === 'leaveBalanceForm') updateSettings(event.target.form);
        if (['scheduleForm', 'planForm'].includes(event.target.form?.id))
          updateRange(event.target.form);
      });
    return { mount, settings, saveSettings, range, updateRange, manageTypes, editType, saveType };
  }
  root.WorkHubLeaveBalances = { install };
})(window);
