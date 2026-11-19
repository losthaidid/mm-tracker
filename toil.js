/** Earned and utilized TOIL, using the existing leave-type and yearly-policy records. */
(function (root) {
  'use strict';
  const E = root.WorkHubLeaveBalancesEngine;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const number = value => String(Math.round(value * 1000000) / 1000000);
  const id = () =>
    'toil-' +
    (root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  function card(d, year, kind, asOf, actionable = true) {
    const t = E.type(d, kind),
      b = E.balance(d, year, kind, asOf);
    if (!t?.toil) return '';
    return `<article class="leave-balance-card toil-balance-card${b.remaining < 0 ? ' leave-overdrawn' : ''}" data-leave-kind="${esc(kind)}" data-balance-state="${b.remaining < 0 ? 'overdrawn' : b.remaining ? 'available' : 'empty'}"><div class="leave-card-top"><div><span class="leave-card-code">${esc(t.code)} · TOIL</span><h3>${esc(t.name)}</h3></div><span class="leave-card-status">${t.archived ? 'Archived' : b.remaining < 0 ? 'Balance below zero' : 'Earned time off'}</span></div><div class="leave-card-value"><strong data-toil-value="remaining">${number(b.remaining)} <small>days available</small></strong></div><dl class="leave-balance-stats"><div><dt>Earned</dt><dd data-toil-value="earned">${number(b.earned)}</dd></div><div><dt>Utilized</dt><dd data-toil-value="utilized">${number(b.utilized)}</dd></div><div><dt>Reserved</dt><dd data-toil-value="reserved">${number(b.reserved)}</dd></div></dl><p class="leave-card-note">Earned − utilized − reserved = available.${b.pendingEarned ? ` ${number(b.pendingEarned)} day(s) of future-dated credits are not available yet.` : ''}</p>${actionable ? `<button type="button" class="leave-card-action" data-toil="open" data-kind="${esc(kind)}" data-year="${year}">TOIL earned &amp; utilized</button>` : ''}</article>`;
  }
  function install(a) {
    const $ = value => document.getElementById(value);
    const can = action => a.can?.('schedule', action) !== false;
    const snapshot = (d, year, kind) =>
      JSON.stringify({ types: E.types(d), policy: kind ? E.policy(d, year, kind) : null });
    let owner = '',
      draft = null;
    function open(year = a.today().slice(0, 4), kind, entryId = '') {
      if (!a.ready() || !can('view')) return;
      owner = a.owner();
      if (!E.validYear(year)) throw Error('Choose a TOIL year from 1900 to 9999.');
      const d = a.state(),
        custom = E.types(d).filter(t => !Object.hasOwn(E.TYPES, t.id));
      if (kind === undefined)
        kind =
          custom.find(t => t.toil && !t.archived)?.id ||
          custom.find(
            t => !t.archived && (t.code === 'TOIL' || /time off in lieu|\btoil\b/i.test(t.name))
          )?.id ||
          '';
      const t = kind ? E.type(d, kind) : null;
      if (kind && (!t || Object.hasOwn(E.TYPES, kind)))
        throw Error('Choose a custom TOIL or replacement leave type.');
      const p = kind
        ? E.policy(d, year, kind)
        : { allowance: null, openingUsed: 0, toilEntries: [] };
      const entry = entryId ? (p.toilEntries || []).find(row => row.id === entryId) : null;
      if (entryId && !entry) throw Error('This TOIL entry no longer exists. Reopen the ledger.');
      draft = { owner: a.owner(), year, kind, entryId, snapshot: snapshot(d, year, kind) };
      const rows = [...(p.toilEntries || [])].sort(
        (x, y) => y.date.localeCompare(x.date) || x.id.localeCompare(y.id)
      );
      const selectedDate = a.today().startsWith(year + '-') ? a.today() : year + '-01-01';
      a.openModal(
        'TOIL earned & utilized',
        `<section class="toil-ledger" id="toilLedger"><p>Record TOIL earned and time taken outside Schedule. TOIL leave bookings are counted automatically; do not enter them again here. Scheduled weekend work does not add earned credits automatically.</p><form id="toilContextForm" class="toil-context"><label>Year<input name="year" type="number" min="1900" max="9999" value="${year}" required></label><label>TOIL leave type<select name="kind"><option value=""${!kind ? ' selected' : ''}>Create a TOIL leave type</option>${custom
          .filter(row => !row.archived || row.id === kind || row.toil)
          .map(
            row =>
              `<option value="${esc(row.id)}"${row.id === kind ? ' selected' : ''}>${esc(row.name)} · ${esc(row.code)}${row.archived ? ' (archived)' : ''}</option>`
          )
          .join(
            ''
          )}</select></label><button type="submit">Open ledger</button></form><p class="hint">Save an entry before changing the year or leave type. ${!t?.toil ? 'The first saved entry enables TOIL tracking for the selected type. Existing allowance and earlier usage become opening earned and utilized totals.' : 'Each year has its own balance. Carry forward days explicitly as an opening balance or an earned entry.'}</p>${t?.toil ? card(d, year, kind, a.today(), false) : '<div class="toil-setup-note">Save your first earned entry to start the TOIL balance. A new TOIL type will then appear in Schedule.</div>'}${t?.toil ? `<p class="hint">Opening earned: ${number(p.allowance || 0)} days · opening utilized: ${number(p.openingUsed)} days. Maintain opening totals and counting weekdays in <button type="button" class="small" data-toil="allowances">Leave allowances &amp; balances</button>.</p>` : ''}<form id="toilEntryForm" class="toil-entry-form"><h3>${entry ? 'Edit TOIL entry' : 'Add TOIL entry'}</h3><div class="form-grid"><label>Date<input type="date" name="date" min="${year}-01-01" max="${year}-12-31" value="${esc(entry?.date || selectedDate)}" required></label><label>Entry type<select name="kind"><option value="earned"${entry?.kind !== 'utilized' ? ' selected' : ''}>Earned TOIL</option><option value="utilized"${entry?.kind === 'utilized' ? ' selected' : ''}>Utilized outside Schedule</option></select></label><label>Amount<input type="number" name="amount" min="0.000001" max="8784" step="any" value="${entry ? number(entry.days) : '1'}" required></label><label>Unit<select name="unit"><option value="days">Days</option><option value="hours">Hours</option></select></label><label data-toil-workday hidden>Working hours per day<input type="number" name="hoursPerDay" min="1" max="24" step="0.25" value="8"></label><label class="wide">Reference / notes<textarea name="note" maxlength="1000" rows="2" placeholder="For example: weekend support work or time taken before using Schedule">${esc(entry?.note || '')}</textarea></label></div><p id="toilEntryPreview" class="hint" role="status"></p><p class="hint">Approved TOIL leave dated today or earlier counts as utilized. Other Schedule bookings stay reserved. Future-dated credits become earned on their date; future-dated outside-Schedule usage stays reserved until its date.</p><div class="actions"><button class="primary" type="submit"${can(entry ? 'edit' : 'create') ? '' : ' disabled'}>${entry ? 'Save entry' : 'Add entry'}</button>${entry ? '<button type="button" data-toil="new">Cancel edit</button>' : ''}</div></form><h3>Dated entries</h3><div class="toil-table-wrap"><table class="toil-table"><thead><tr><th>Date</th><th>Type</th><th>Days</th><th>Reference / notes</th><th>Actions</th></tr></thead><tbody>${rows.map(row => `<tr data-toil-entry="${esc(row.id)}"><td>${esc(row.date)}</td><td>${row.kind === 'earned' ? 'Earned' : 'Utilized outside Schedule'}${row.date > a.today() ? ' (future)' : ''}</td><td>${number(row.days)}</td><td class="toil-note">${esc(row.note) || '—'}</td><td><div class="actions"><button type="button" class="small" data-toil="edit" data-id="${esc(row.id)}"${can('edit') ? '' : ' disabled'}>Edit</button><button type="button" class="small danger" data-toil="delete" data-id="${esc(row.id)}"${can('delete') ? '' : ' disabled'}>Delete</button></div></td></tr>`).join('') || '<tr><td colspan="5">No dated entries yet.</td></tr>'}</tbody></table></div><p class="hint">The balance also includes opening totals and TOIL in Schedule. Editing or removing a booking updates its usage automatically. Deleting a credit may leave a negative historical balance; it does not delete leave bookings.</p></section>`
      );
      updatePreview($('toilEntryForm'));
    }
    function check(form, action) {
      if (
        !a.ready() ||
        !draft ||
        draft.owner !== a.owner() ||
        form !== $('toilEntryForm') ||
        !form.closest('dialog[open]')
      )
        throw Error('Reopen the TOIL ledger for the current account.');
      if (!can(action)) throw Error('Your account cannot ' + action + ' TOIL entries.');
      if (snapshot(a.state(), draft.year, draft.kind) !== draft.snapshot)
        throw Error(
          'TOIL records changed while this form was open. Reopen the ledger before saving.'
        );
    }
    function readEntry(form) {
      const value = name => form.elements.namedItem(name).value;
      const amount = Number(value('amount')),
        unit = value('unit'),
        hours = Number(value('hoursPerDay'));
      if (
        !value('amount').trim() ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !['hours', 'days'].includes(unit)
      )
        throw Error('Enter a positive TOIL amount in days or hours.');
      if (
        unit === 'hours' &&
        (!Number.isFinite(hours) || hours < 1 || hours > 24 || !Number.isInteger(hours * 4))
      )
        throw Error('Enter 1–24 working hours per day in quarter-hour steps.');
      const days = Math.round((unit === 'hours' ? amount / hours : amount) * 1000000) / 1000000;
      const row = {
        id: draft.entryId || id(),
        date: value('date'),
        kind: value('kind'),
        days,
        note: value('note').trim(),
      };
      E.validateToilEntries([row], draft.year, { toil: true });
      return row;
    }
    function writePolicy(d, kind, entries) {
      let year = d.workhub.leaveBalances.find(row => row.id === draft.year);
      if (!year) {
        year = E.defaults(draft.year, d);
        d.workhub.leaveBalances.push(year);
      }
      year[kind] = {
        ...E.policy(d, draft.year, kind),
        allowance: E.policy(d, draft.year, kind).allowance ?? 0,
        toilEntries: entries,
      };
    }
    function save(form) {
      check(form, draft?.entryId ? 'edit' : 'create');
      const entry = readEntry(form),
        year = draft.year;
      let kind = draft.kind;
      const ok = a.mutate(d => {
        if (!kind) {
          kind = 'leave-' + id();
          let suffix = 1,
            name = 'Time off in lieu',
            code = 'TOIL';
          while (
            E.types(d).some(t => t.name.toLowerCase() === name.toLowerCase() || t.code === code)
          ) {
            suffix++;
            name = 'Time off in lieu ' + suffix;
            code = 'TOIL-' + suffix;
          }
          d.workhub.leaveTypes.push({ id: kind, name, code, archived: false, toil: true });
        } else {
          const t = E.type(d, kind);
          if (!t || Object.hasOwn(E.TYPES, kind)) throw Error('Reopen a custom TOIL leave type.');
          t.toil = true;
        }
        const entries = [...(E.policy(d, year, kind).toilEntries || [])];
        if (draft.entryId) {
          const index = entries.findIndex(row => row.id === draft.entryId);
          if (index < 0) throw Error('This TOIL entry no longer exists.');
          entries[index] = entry;
        } else entries.push(entry);
        writePolicy(d, kind, entries);
      });
      if (ok) {
        open(year, kind);
        a.tell('TOIL entry saved. Earned, utilized and available days updated.');
      }
      return ok;
    }
    function remove(entryId) {
      check($('toilEntryForm'), 'delete');
      const year = draft.year,
        kind = draft.kind;
      if (
        !kind ||
        !(E.policy(a.state(), year, kind).toilEntries || []).some(row => row.id === entryId)
      )
        throw Error('This TOIL entry no longer exists.');
      const ok = a.mutate(d =>
        writePolicy(
          d,
          kind,
          E.policy(d, year, kind).toilEntries.filter(row => row.id !== entryId)
        )
      );
      if (ok) {
        open(year, kind);
        a.tell('TOIL entry deleted. Balance recalculated.');
      }
      return ok;
    }
    function updatePreview(form) {
      if (!form || !draft) return;
      const hours = form.elements.unit.value === 'hours';
      form.querySelector('[data-toil-workday]').hidden = !hours;
      form.elements.hoursPerDay.disabled = !hours;
      try {
        const row = readEntry(form);
        $('toilEntryPreview').textContent =
          number(row.days) +
          ' day(s) will be recorded. Use outside-Schedule utilization only for time not already booked in Schedule.';
      } catch (error) {
        $('toilEntryPreview').textContent = error.message;
      }
    }
    function mount(tab) {
      const current = a.ready() ? a.owner() : '';
      if (current !== owner) {
        owner = current;
        draft = null;
        if ($('toilLedger')) a.closeModal();
      }
      const host =
        $('hubSettingsAppearance') || document.querySelector('#settingsMenu .settings-panel');
      if (host && !$('toilSettingsButton')) {
        const button = document.createElement('button');
        button.id = 'toilSettingsButton';
        button.type = 'button';
        button.dataset.toil = 'open';
        button.textContent = 'TOIL earned & utilized';
        host.append(button);
      }
      if ($('toilSettingsButton')) $('toilSettingsButton').hidden = !a.ready() || !can('view');
      const actions =
        tab === 'schedule'
          ? document.querySelector('#leaveScheduleBalances .leave-heading-actions')
          : null;
      if (actions && !actions.querySelector('[data-toil]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.toil = 'open';
        button.dataset.year = a.month().slice(0, 4);
        button.textContent = 'TOIL earned & utilized';
        actions.append(button);
      }
    }
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-toil]');
      if (!button) return;
      try {
        const action = button.dataset.toil;
        if (action === 'open')
          open(button.dataset.year || a.today().slice(0, 4), button.dataset.kind);
        if (action === 'edit') open(draft.year, draft.kind, button.dataset.id);
        if (action === 'new') open(draft.year, draft.kind);
        if (action === 'delete') remove(button.dataset.id);
        if (action === 'allowances') a.allowances(draft.year, draft.kind);
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('submit', event => {
      if (!['toilContextForm', 'toilEntryForm'].includes(event.target.id)) return;
      event.preventDefault();
      try {
        if (event.target.id === 'toilEntryForm') save(event.target);
        else open(event.target.elements.year.value, event.target.elements.kind.value);
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    for (const name of ['input', 'change'])
      document.addEventListener(name, event => {
        if (event.target.form?.id === 'toilEntryForm') updatePreview(event.target.form);
      });
    return { open, save, remove, mount };
  }
  root.WorkHubToil = { install, card };
})(window);
