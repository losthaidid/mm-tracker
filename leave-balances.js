/** AL / MC Settings and live Schedule balance previews; uses the existing account save adapter. */
(function (root) {
  'use strict';
  const E = root.WorkHubLeaveBalancesEngine,
    esc = v =>
      String(v ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      ),
    label = kind => (kind === 'annual-leave' ? 'Annual leave · AL' : 'Medical leave · MC'),
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
  function cards(d, year) {
    return `<div class="leave-balance-cards">${Object.keys(E.TYPES)
      .map(kind => {
        const b = E.balance(d, year, kind);
        return `<article class="leave-balance-card${b.remaining !== null && b.remaining < 0 ? ' leave-overdrawn' : ''}"><span>${label(kind)}</span><strong>${b.remaining === null ? 'Allowance not set' : number(b.remaining) + ' <small>days remaining</small>'}</strong><p>${b.allowance === null ? 'Set a yearly allowance to enable the limit.' : number(b.allowance) + ' allowance − ' + number(b.openingUsed) + ' used outside Schedule − ' + number(b.scheduled) + ' scheduled'}</p></article>`;
      })
      .join('')}</div>`;
  }
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      editingOwner = '',
      editingSnapshot = '',
      rangeDraft = null;
    const thisYear = () => a.today().slice(0, 4);
    function settings(year = thisYear()) {
      if (!a.ready()) return;
      if (!E.validYear(year)) throw Error('Choose a year from 1900 to 9999.');
      editingOwner = a.owner();
      rangeDraft = null;
      const d = a.state(),
        saved = d.workhub.leaveBalances.find(y => y.id === year) || E.defaults(year);
      editingSnapshot = JSON.stringify(saved);
      a.openModal(
        'Annual leave & MC allowances',
        `<form id="leaveBalanceForm" data-year="${year}"><div class="leave-allowance-intro"><p>Set the allowance for each calendar year. Planned, requested and approved leave in Schedule all reserve days.</p><div class="leave-year-picker"><label for="leaveBalanceYear">Allowance year</label><input id="leaveBalanceYear" name="year" type="number" min="1900" max="9999" step="1" value="${year}" required><button type="button" data-leave-balance="load-year">Open year</button></div><p class="hint">Use Open year to switch years. Save your edits before opening another year; Open year loads that year’s saved allowances.</p></div>${cards(d, year)}<div class="leave-allowance-grid">${Object.keys(
          E.TYPES
        )
          .map(kind => {
            const p = saved[kind];
            return `<fieldset class="leave-allowance-type"><legend>${label(kind)}</legend><label for="${kind}-allowance">Yearly allowance (days)</label><input id="${kind}-allowance" name="${kind}-allowance" type="number" min="0" max="366" step="0.5" value="${p.allowance ?? ''}" placeholder="Not set"><label for="${kind}-used">Already taken outside Schedule (days)</label><input id="${kind}-used" name="${kind}-used" type="number" min="0" max="366" step="0.5" value="${p.openingUsed}" required><p class="hint">Enter leave taken in earlier months, or any leave not recorded in Schedule. Leave already in Schedule is counted automatically; do not include it again here.</p><span class="leave-days-label" id="${kind}-weekdays-label">Count leave on</span><div class="leave-weekdays" role="group" aria-labelledby="${kind}-weekdays-label">${DAYS.map(([day, name]) => `<label><input type="checkbox" name="${kind}-weekday" value="${day}"${p.weekdays.includes(day) ? ' checked' : ''}>${name}</label>`).join('')}</div></fieldset>`;
          })
          .join(
            ''
          )}</div><p class="hint">Full day = 1 day; morning / afternoon = 0.5 day. Custom hours let you choose 0.5 or 1 day. Dates outside the selected weekdays are not charged. Public holidays are not detected automatically. A blank allowance keeps that type unlimited until you set it.</p><p class="hint">For example: 12 days allowed − 10 used outside Schedule = 2 days available before any scheduled leave. Removing a booking restores its reserved days.</p><div id="leaveSettingsPreview" class="leave-settings-preview" role="status" aria-live="polite"></div><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save allowances</button></div></form>`
      );
      updateSettings($('leaveBalanceForm'));
    }
    function readSettings(form) {
      const year = form.elements.namedItem('year').value.trim();
      if (year !== form.dataset.year)
        throw Error('Choose Open year before saving a different year.');
      const row = E.defaults(year);
      for (const kind of Object.keys(E.TYPES)) {
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
      E.validate({ workhub: { leaveBalances: [row] }, schedule: [] });
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
        current = a.state().workhub.leaveBalances.find(y => y.id === row.id) || E.defaults(row.id);
      if (JSON.stringify(current) !== editingSnapshot)
        throw Error(
          'These leave allowances changed while this form was open. Reopen Settings to review the latest balances.'
        );
      const ok = a.mutate(d => {
        d.workhub.leaveBalances = withSettings(d, row).workhub.leaveBalances;
      });
      if (ok) {
        a.closeModal();
        a.tell('Annual leave and MC allowances saved.');
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
        host.innerHTML = `<div class="leave-request-preview${warning ? ' leave-overdrawn' : ''}">${result.rows.map(b => `<p><strong>${b.year} · ${label(kind)}:</strong> ${number(b.requested)} day(s) in this range${b.remaining === null ? ' · set this year’s allowance to see a remaining balance.' : ' · <strong>' + number(b.remaining) + ' day(s) remaining after saving.</strong>'}</p>`).join('')}${warning ? `<p class="leave-limit-warning">${esc(warning)}</p>` : ''}<small>Existing bookings count once. Editing replaces this booking. Full days count as 1; half-days as 0.5. Only your configured weekdays are charged.</small></div>`;
      } catch (error) {
        host.textContent = error.message;
      }
    }
    function mount(tab) {
      const nextOwner = a.ready() ? a.owner() : '';
      if (nextOwner !== owner) {
        owner = nextOwner;
        rangeDraft = null;
        if ($('leaveBalanceForm')) a.closeModal();
      }
      const host =
        $('hubSettingsAppearance') || document.querySelector('#settingsMenu .settings-panel');
      if (host && !$('leaveBalanceSettingsButton')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'leaveBalanceSettingsButton';
        b.dataset.leaveBalance = 'settings';
        b.textContent = 'Annual leave & MC';
        host.append(b);
      }
      if ($('leaveBalanceSettingsButton')) $('leaveBalanceSettingsButton').hidden = !a.ready();
      if (tab !== 'schedule' || !a.ready()) return;
      const schedule = document.querySelector('#view .schedule-workspace');
      if (schedule && !$('leaveScheduleBalances')) {
        const section = document.createElement('section'),
          year = a.month().slice(0, 4);
        section.id = 'leaveScheduleBalances';
        section.className = 'panel leave-schedule-balances';
        section.innerHTML = `<div class="leave-balance-heading"><div><span class="eyebrow">YOUR TIME OFF</span><h2>Leave balances · ${year}</h2></div><button type="button" data-leave-balance="settings" data-year="${year}">Maintain allowances</button></div>${cards(a.state(), year)}<p class="hint">Scheduled leave includes planned, requested and approved bookings for the whole year.</p>`;
        schedule.prepend(section);
      }
    }
    document.addEventListener('click', event => {
      const b = event.target.closest('[data-leave-balance]');
      if (!b) return;
      try {
        if (b.dataset.leaveBalance === 'settings') settings(b.dataset.year || thisYear());
        if (b.dataset.leaveBalance === 'load-year') settings($('leaveBalanceYear').value.trim());
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('submit', event => {
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
    return { mount, settings, saveSettings, range, updateRange };
  }
  root.WorkHubLeaveBalances = { install };
})(window);
