/**
 * TNG review desk: upload, dates, on-site suggestions, manual rows and evidence.
 * Draft rows/PDFs are local and temporary. Confirmed rows use the shared expense save.
 * All asynchronous work is checked against the account and current document generation.
 */
(function (root) {
  'use strict';
  const E = root.WorkHubTngEngine,
    C = root.WorkHubClaimsEngine,
    F = root.WorkHubTngFiles;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (action, label, extra = '', cls = '') =>
    `<button type="button" class="${cls}" data-tng="${action}" ${extra}>${label}</button>`;
  const options = (entries, value) =>
    entries
      .map(
        ([id, label]) =>
          `<option value="${esc(id)}"${value === id ? ' selected' : ''}>${esc(label)}</option>`
      )
      .join('');
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      generation = 0,
      exportToken = 0,
      session = null,
      rows = [],
      message = '',
      warnings = [],
      busy = false,
      exporting = false;
    let basis = 'transaction',
      from = '',
      to = '',
      chosenDates = new Set(),
      filter = 'all',
      page = 0,
      preview = '',
      includeHeader = true,
      claimType = 'client-site',
      captions = {},
      editing = '';
    let pendingSource = null;
    let drag = null,
      previewToken = 0;
    const day = r => (basis === 'posted' ? r.postedDate : r.date);
    const openNow = () => !!$('tngStudio') && !!$('modal')?.open;
    const alive = (token, account) => a.ready() && a.owner() === account && generation === token;
    const selectable = r =>
      !E.isExcluded(r) &&
      !r.errors.length &&
      (!savedExpense(r) || C.claimType(savedExpense(r)) === claimType);
    const editable = r => selectable(r) && !isDuplicate(r);
    let keysForState = null,
      importedKeys = new Set(),
      importedExpenses = new Map();
    const savedExpense = r => {
      isDuplicate(r); // Refresh the lookup when the account document changes.
      return !r.manual && session
        ? importedExpenses.get(E.sourceKey(session.source.cardKey, r))
        : null;
    };
    const isDuplicate = r => {
      const d = a.state();
      if (d !== keysForState) {
        keysForState = d;
        importedKeys = new Set(
          d.workhub.claims.expenses.filter(e => e.tngSource).map(e => e.tngSource.key)
        );
        importedExpenses = new Map(
          d.workhub.claims.expenses.filter(e => e.tngSource).map(e => [e.tngSource.key, e])
        );
      }
      return (
        r.saved ||
        (!r.manual && session && importedKeys.has(E.sourceKey(session.source.cardKey, r)))
      );
    };
    const selected = () => rows.filter(r => r.selected && editable(r));
    const evidenceRows = () => rows.filter(r => r.selected && !r.manual && selectable(r));
    const visible = () =>
      rows.filter(
        r =>
          (!from || day(r) >= from) &&
          (!to || day(r) <= to) &&
          (!chosenDates.size || chosenDates.has(day(r))) &&
          (filter === 'all' || filter === r.kind)
      );
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        if (openNow()) a.closeModal();
        generation++;
        exportToken++;
        previewToken++;
        session?.close();
        session = null;
        rows = [];
        owner = next;
        busy = false;
        exporting = false;
        preview = '';
        editing = '';
        message = '';
        warnings = [];
        chosenDates.clear();
        drag = null;
        pendingSource = null;
        keysForState = null;
        importedKeys.clear();
        importedExpenses.clear();
        claimType = 'client-site';
        captions = {};
      }
    }
    function mount(tab) {
      sync();
      if (!a.ready() || tab !== 'schedule') return;
      const host = $('claimMonthSummary')?.querySelector('.claim-summary-actions');
      if (host && !host.querySelector('[data-tng="open"]')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.tng = 'open';
        b.className = 'primary';
        b.innerHTML = '<span aria-hidden="true">▤</span> TNG PDF extractor';
        host.prepend(b);
      }
    }
    function totals() {
      const shown = visible(),
        picked = selected();
      return `<div class="tng-total tng-picked"><span>Selected for expenses</span><strong>${C.money(picked.reduce((n, r) => n + r.amountCents, 0))}</strong><small>${picked.length} new records · ${evidenceRows().length} PDF records selected for evidence</small></div><div class="tng-total"><span>Tolls in this view</span><strong>${C.money(shown.filter(r => r.kind === 'toll').reduce((n, r) => n + (r.amountCents || 0), 0))}</strong><small>${shown.filter(r => r.kind === 'toll').length} transactions</small></div><div class="tng-total"><span>Reloads in this view</span><strong>${C.money(shown.filter(r => r.kind === 'reload').reduce((n, r) => n + (r.amountCents || 0), 0))}</strong><small>Kept separate from expenses</small></div>`;
    }
    function datesHTML() {
      const dates = [...new Set(rows.map(day).filter(Boolean))].sort();
      return dates
        .map(date => {
          const list = rows.filter(r => day(r) === date && r.kind === 'toll'),
            sum = list.reduce((n, r) => n + (r.amountCents || 0), 0),
            visits = E.matches(a.state(), date, claimType);
          return button(
            'date',
            `<strong>${esc(new Date(date + 'T12:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }))}</strong><span>${C.money(sum)}</span>${visits.length ? '<small>↗ On-site day</small>' : ''}`,
            `data-date="${date}" aria-pressed="${chosenDates.has(date)}"`,
            'tng-date-chip'
          );
        })
        .join('');
    }
    function rowHTML(r) {
      const dup = isDuplicate(r),
        visits = E.matches(a.state(), day(r), claimType);
      return `<tr class="${r.selected ? 'is-selected ' : ''}${dup ? 'is-duplicate' : ''}"><td><input type="checkbox" data-tng-select="${esc(r.id)}" aria-label="Select ${esc(r.transactionNo || r.description)}"${r.selected ? ' checked' : ''}${selectable(r) ? '' : ' disabled'}></td><td><strong>${esc(day(r) || 'Review date')}</strong><small>${esc(r.time)}${r.date !== r.postedDate ? (r.section === 'ewallet' ? ' · Statement ' : ' · Posted ') + esc(r.postedDate) : ''}</small></td><td><strong class="hub-sensitive">${esc(r.description || 'Review description')}</strong><small>${esc(r.manual ? 'Manual entry' : r.type + ' · ' + r.section + ' · p' + r.page)}</small>${r.errors.length ? '<small class="tng-error">' + esc(r.errors.join(' · ')) + '</small>' : ''}</td><td><span class="tng-kind" data-kind="${r.kind}">${esc(r.kind === 'reload' ? 'Reload · excluded' : r.kind === 'credit' ? 'Credit / refund · excluded' : r.kind === 'transfer' ? 'Transfer · excluded' : r.kind === 'unsuccessful' ? 'Not successful · excluded' : r.kind === 'unsupported' ? 'Unknown type · excluded' : r.manual ? 'Manual' : C.CATEGORIES[r.category])}</span><small>${dup ? 'Already imported · ' + esc(C.CLAIM_TYPES[C.claimType(savedExpense(r))]) : r.saved ? 'Saved to expenses' : ''}</small></td><td class="tng-money">${r.amountCents === null ? 'Review' : C.money(r.amountCents)}</td><td><select data-tng-booking="${esc(r.id)}" aria-label="Link visit for ${esc(r.transactionNo || r.description)}"${E.isExcluded(r) ? ' disabled' : ''}><option value="">${visits.length > 1 ? 'Choose one of ' + visits.length + ' visits' : 'No linked visit'}</option>${options(
        visits.map(v => [v.key, [v.locationName, v.title, v.project].filter(Boolean).join(' · ')]),
        r.bookingKey
      )}</select>${visits.length > 1 && !r.bookingKey ? '<small>Several visits: please allocate</small>' : ''}</td><td><div class="tng-row-actions">${!r.manual ? button('preview', 'Crop', `data-id="${esc(r.id)}"`, 'small') : ''}${!dup && !E.isExcluded(r) ? button('edit', 'Edit', `data-id="${esc(r.id)}"`, 'small') : ''}${r.manual ? button('remove', 'Remove', `data-id="${esc(r.id)}"`, 'small') : ''}</div></td></tr>`;
    }
    function editorHTML() {
      if (!editing) return '';
      const r = rows.find(r => r.id === editing) || {
        date: a.today(),
        postedDate: a.today(),
        amountCents: null,
        description: '',
        category: 'toll',
        notes: '',
      };
      return `<form id="tngRowForm" data-owner="${esc(owner)}" data-generation="${generation}" data-id="${esc(r.id || '')}"><div class="tng-editor-head"><h3>${r.id ? 'Review transaction' : 'Add a manual expense'}</h3>${button('cancel-edit', 'Close', '', 'small')}</div><div class="form-grid"><div><label>Transaction date<input type="date" name="date" value="${esc(r.date)}" required></label></div><div><label>${r.section === 'ewallet' ? 'Statement / posted date' : 'Posted date'}<input type="date" name="postedDate" value="${esc(r.postedDate)}" required></label></div><div><label>Transaction time<input type="time" name="time" step="1" value="${esc(r.time || '')}"></label></div><div><label>Amount (RM)<input type="number" name="amount" min="0.01" max="1000000" step="0.01" value="${r.amountCents === null ? '' : (r.amountCents / 100).toFixed(2)}" required></label></div><div><label>Category<select name="category">${options(Object.entries(C.CATEGORIES), r.category)}</select></label></div><div class="wide"><label>Description<input name="description" maxlength="300" value="${esc(r.description)}" required></label></div><div class="wide"><label>Notes<textarea name="notes" maxlength="2000">${esc(r.notes || '')}</textarea></label></div></div><p class="hint">${r.id && !r.manual ? 'Corrections affect your expense draft. The source crop stays faithful to the PDF.' : 'Manual entries join your selected expenses. They have no PDF crop.'}</p><button class="primary" type="submit">Keep in review</button></form>`;
    }
    function previewHTML() {
      const r = rows.find(r => r.id === preview);
      if (!r || r.manual)
        return `<div class="tng-preview-empty"><span aria-hidden="true">⌗</span><h3>Your evidence, up close</h3><p>Choose Crop beside a transaction to inspect its source page and adjust the evidence area.</p></div>`;
      return `<div class="tng-preview-head"><span class="hub-kicker">SOURCE PAGE ${r.page}</span><h3>${esc(r.transactionNo)}</h3><p>Move the frame or drag its corners. Arrow keys move it; Shift + arrows resize it.</p></div><div id="tngPageFrame" class="tng-page-frame"><canvas id="tngPageCanvas" aria-label="Statement page ${r.page}"></canvas><div id="tngCropFrame" tabindex="0" role="group" aria-label="Evidence crop. Arrow keys move; Shift and arrows resize."><i data-tng-corner="nw"></i><i data-tng-corner="ne"></i><i data-tng-corner="sw"></i><i data-tng-corner="se"></i></div></div><div class="tng-crop-fields">${['x', 'y', 'w', 'h'].map(k => `<label>${{ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[k]}<input type="number" data-tng-rect="${k}" value="${Math.round(r.rect[k] * 10) / 10}" step="0.5" min="${k === 'w' || k === 'h' ? 1 : 0}" aria-label="Crop ${k}"></label>`).join('')}</div><label class="tng-header-check"><input id="tngIncludeHeader" type="checkbox"${includeHeader ? ' checked' : ''}>Include the table headings with each crop</label><div class="actions">${button('reset-crop', 'Reset crop', '', 'small')}${button('png', '↓ Download PNG', exporting ? 'disabled' : '', 'primary')}</div><p class="hint">PDF contents stay on this device. Reattach the same statement when you need source images in a later visit.</p>`;
    }
    function evidenceHTML() {
      const groups = claimType === 'client-site' ? E.evidenceGroups(evidenceRows()) : [];
      return `<section class="tng-evidence-plan"><div><span class="hub-kicker">YOUR CLAIM PACK</span><h3>${claimType === 'client-site' ? 'One journey, one caption.' : 'Special claims evidence'}</h3><p>${claimType === 'client-site' ? 'Toll crops join by transaction date: To before 12:00 noon, Return from noon onward. Posted-date filters do not change the PDF grouping. Captions are editable; they do not change your expenses.' : 'Your existing evidence format is kept: individual source crops, without To / Return grouping or toll captions.'}</p></div>${groups.length ? `<div class="tng-evidence-groups">${groups.map(g => `<label class="tng-evidence-group"><span>${esc(g.date)} · ${g.rows.length} crop${g.rows.length === 1 ? '' : 's'}${g.direction === 'review' ? ' · Edit the missing time first' : ''}</span><input data-tng-caption="${esc(g.key)}" maxlength="120" aria-label="Caption for ${esc(g.date + ' ' + g.direction)}" value="${esc(captions[g.key] ?? g.caption)}"></label>`).join('')}</div>` : claimType === 'client-site' ? '<p class="hint">Select PDF records to see the journey groups and edit their captions. Manual entries have no source crop.</p>' : ''}</section>`;
    }
    function html() {
      const shown = visible(),
        size = 50;
      page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(shown.length / size) - 1)));
      return `<section id="tngStudio" class="tng-studio"><div class="tng-hero"><div><span class="hub-kicker">A LITTLE LESS PAPERWORK</span><h2>TNG statement desk</h2><p>Find your travel days. Review the details. Keep the evidence.</p></div><div class="tng-hero-mark" aria-hidden="true">▤<span>↗</span></div></div><div class="tng-claim-type"><label for="tngClaimType">Claim type<select id="tngClaimType">${options(Object.entries(C.CLAIM_TYPES), claimType)}</select></label><p>${claimType === 'client-site' ? 'Combined To / Return evidence with editable captions.' : 'Original evidence format. No journey grouping.'} Saved rows of the other claim type stay in their own pack.</p></div><div class="tng-upload" id="tngDrop"><div><strong>${session ? esc(session.source.fileName) : 'Drop your TNG card or eWallet statement here'}</strong><p>${session ? session.source.pages + ' pages · ' + rows.filter(r => !r.manual).length + ' extracted records' : 'Card statements and eWallet transaction history · PDF up to 20 MB'}</p></div><label class="tng-file-label">${busy ? 'Reading…' : session ? 'Choose another PDF' : 'Choose PDF'}<input type="file" id="tngFile" accept=".pdf,application/pdf"${busy ? ' disabled' : ''}></label>${session ? button('clear', 'Clear PDF', '', 'small') : ''}</div><div class="tng-notice" id="tngMessage" role="status"${message ? '' : ' hidden'}>${esc(message)}</div>${warnings.length ? '<div class="tng-warning">' + warnings.map(esc).join('<br>') + '</div>' : ''}<div class="tng-summary">${totals()}</div>${evidenceHTML()}<div class="tng-main"><div class="tng-review"><div class="tng-filters"><label>From<input type="date" id="tngFrom" value="${esc(from)}"></label><label>To<input type="date" id="tngTo" value="${esc(to)}"></label><label>Date basis<select id="tngBasis">${options(
        [
          [
            'transaction',
            rows.some(r => r.section === 'ewallet')
              ? 'Transaction / Details date'
              : 'Journey / exit date',
          ],
          [
            'posted',
            rows.some(r => r.section === 'ewallet') ? 'Statement / posted date' : 'Posted date',
          ],
        ],
        basis
      )}</select></label><label>Show<select id="tngKind">${options(
        [
          ['all', 'All transactions'],
          ['toll', 'Tolls'],
          ['parking', 'Parking'],
          ['other', 'Other spending'],
          ['reload', 'Reloads'],
          ['credit', 'Credits / refunds'],
          ['transfer', 'Transfers · excluded'],
          ['unsuccessful', 'Unsuccessful · excluded'],
          ['unsupported', 'Unknown type · excluded'],
        ],
        filter
      )}</select></label></div><p class="tng-date-note">${rows.some(r => r.section === 'ewallet') ? 'eWallet transaction dates/times follow Details when printed; Statement/posted date follows the Date column. Missing times remain blank.' : 'Journey date follows Exit Date & Time. Posted dates may be later.'} Date and category filters change the view; your selected rows remain selected.</p><div class="tng-dates">${datesHTML()}</div><div class="tng-review-actions">${button('match', '↗ Match on-site dates', '', 'primary')}${button('select-visible', 'Select visible expenses')}${button('clear-selection', 'Clear selection')}${button('all-dates', 'All dates')}${button('manual', '＋ Manual entry')}</div>${editorHTML()}<div class="tng-table-wrap"><table class="tng-table"><thead><tr><th>Select</th><th>Date / time</th><th>Transaction</th><th>Type / status</th><th>Amount</th><th>Link to a visit</th><th>Review</th></tr></thead><tbody>${
        shown
          .slice(page * size, (page + 1) * size)
          .map(rowHTML)
          .join('') ||
        '<tr><td colspan="7"><div class="tng-empty">' +
          (rows.length
            ? 'No transactions in this view. Adjust the date or type filters.'
            : 'Upload a statement, or start with a manual toll or parking expense.') +
          '</div></td></tr>'
      }</tbody></table></div><div class="tng-pagination">${button('previous', 'Previous', page ? '' : 'disabled', 'small')}<span>${shown.length ? Math.min(page * size + 1, shown.length) : 0}–${Math.min((page + 1) * size, shown.length)} of ${shown.length}</span>${button('next', 'Next', (page + 1) * size < shown.length ? '' : 'disabled', 'small')}</div></div><aside class="tng-preview">${previewHTML()}</aside></div><div class="tng-savebar"><div><strong>${selected().length} selected · ${C.money(selected().reduce((n, r) => n + r.amountCents, 0))}</strong><small>Save adds confirmed expenses to Schedule’s monthly claims.</small></div><div class="actions">${button('pdf', exporting ? 'Preparing…' : '↓ Evidence PDF', exporting ? 'disabled' : '')}${button('zip', '↓ Crop images ZIP', exporting ? 'disabled' : '')}${button('save', '✓ Save selected expenses', busy || !selected().length ? 'disabled' : '', 'primary')}</div></div></section>`;
    }
    function paint() {
      if (!openNow()) return;
      previewToken++;
      $('modalBody').innerHTML = html();
      void drawPreview();
    }
    function open() {
      sync();
      if (!a.ready()) return;
      a.openModal('TNG statement desk', html());
      $('modal').classList.remove('hub-drawer');
      void drawPreview();
    }
    function openSource(id) {
      sync();
      const expense = a.state().workhub.claims.expenses.find(e => e.id === id);
      if (!expense?.tngSource) return;
      claimType = C.claimType(expense);
      for (const row of rows) if (!selectable(row)) row.selected = false;
      pendingSource = { ...expense.tngSource };
      const r =
        session &&
        rows.find(r => !r.manual && E.sourceKey(session.source.cardKey, r) === pendingSource.key);
      if (r) {
        preview = r.id;
        r.selected = true;
      } else
        message =
          'Reattach ' +
          pendingSource.fileName +
          ' to view or download this saved transaction. Your expense stays in the ledger.';
      open();
    }
    function say(text) {
      message = text;
      const el = $('tngMessage');
      if (el) {
        el.hidden = !text;
        el.textContent = text;
      }
    }
    async function loadFile(file) {
      sync();
      if (!a.ready()) throw Error('Sign in before opening statements.');
      if (
        session &&
        rows.some(r => !r.manual && !r.saved && r.selected) &&
        !root.confirm(
          'Replace this statement review? Unsaved PDF selections and crop adjustments will be cleared. Saved expenses and manual drafts are kept.'
        )
      )
        return;
      const manualRows = rows.filter(r => r.manual && !r.saved);
      const account = owner,
        token = ++generation;
      exportToken++;
      previewToken++;
      session?.close();
      session = null;
      rows = manualRows;
      preview = '';
      editing = '';
      captions = {};
      warnings = [];
      busy = true;
      exporting = false;
      say('Opening statement…');
      paint();
      try {
        const result = await F.read(file, {
          alive: () => alive(token, account) && openNow(),
          progress: text => {
            if (alive(token, account)) say(text);
          },
        });
        if (!alive(token, account) || !openNow()) {
          result.close();
          return;
        }
        session = result;
        rows = [...result.rows, ...manualRows];
        warnings = result.warnings;
        from = '';
        to = '';
        chosenDates.clear();
        page = 0;
        filter = 'all';
        if (pendingSource) {
          const found = rows.find(
            r => E.sourceKey(session.source.cardKey, r) === pendingSource.key
          );
          if (found) {
            if (session.source.fileHash === pendingSource.fileHash)
              found.rect = { ...pendingSource.rect };
            preview = found.id;
            found.selected = true;
            pendingSource = null;
          }
        }
        say(
          pendingSource
            ? `Read ${rows.length} transactions, but the saved source record was not found. Reattach ${pendingSource.fileName} for that record, or review this statement separately.`
            : `Read ${rows.length} transactions. Choose dates or match your on-site visits, then review before saving.`
        );
      } catch (error) {
        if (alive(token, account)) say(error.message);
      } finally {
        if (alive(token, account)) {
          busy = false;
          paint();
        }
      }
    }
    function matchVisits() {
      sync();
      if (!a.ready() || !openNow()) return;
      let count = 0,
        ambiguous = 0;
      for (const r of visible()) {
        const visits = E.matches(a.state(), day(r), claimType);
        if (r.kind !== 'toll' || !editable(r) || !visits.length) continue;
        r.selected = true;
        count++;
        r.bookingKey = visits.length === 1 ? visits[0].key : '';
        if (visits.length > 1) ambiguous++;
      }
      say(
        count
          ? `Suggested ${count} toll transactions on on-site dates. Check personal trips before saving.${ambiguous ? ' ' + ambiguous + ' records have several visits: choose their allocation.' : ''}`
          : 'No new tolls match the on-site bookings in this view. You can select expenses manually.'
      );
      paint();
    }
    function save() {
      sync();
      if (!a.ready()) throw Error('Sign in before saving expenses.');
      const picked = selected();
      const list = E.expenses(a.state(), picked, session?.source || {}, basis, claimType);
      if (
        a.mutate(d => {
          const checked = E.expenses(d, picked, session?.source || {}, basis, claimType);
          d.workhub.claims.expenses.push(...checked);
        })
      ) {
        for (const r of picked) {
          r.selected = !r.manual;
          r.saved = true;
        }
        say(
          `Saved ${list.length} expenses (${C.money(list.reduce((n, e) => n + e.amountCents, 0))}). They now appear in the monthly claim totals. PDF rows stay selected for evidence downloads.`
        );
        paint();
      }
    }
    function rowForm(form) {
      sync();
      if (
        !a.ready() ||
        !openNow() ||
        form !== $('tngRowForm') ||
        form.dataset.owner !== owner ||
        form.dataset.generation !== String(generation)
      )
        throw Error('Reopen the review before editing.');
      const val = k => form.elements.namedItem(k).value.trim(),
        old = rows.find(r => r.id === form.dataset.id),
        amount = Cents(val('amount'));
      if (
        !C.validDate(val('date')) ||
        !C.validDate(val('postedDate')) ||
        amount === null ||
        !val('description') ||
        !Object.hasOwn(C.CATEGORIES, val('category'))
      )
        throw Error('Enter valid dates, a description and a positive amount.');
      const time = val('time');
      if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))
        throw Error('Enter a valid transaction time.');
      const row = old || {
        id: root.crypto.randomUUID(),
        transactionNo: '',
        section: 'manual',
        manual: true,
        kind: 'other',
        time: '',
        errors: [],
        selected: true,
        bookingKey: '',
      };
      if (old && (E.isExcluded(old) || (!editable(old) && !old.errors.length)))
        throw Error('This transaction cannot be edited as a new expense.');
      Object.assign(row, {
        date: val('date'),
        time,
        postedDate: val('postedDate'),
        amountCents: amount,
        description: val('description'),
        category: val('category'),
        notes: val('notes'),
        errors: [],
        selected: true,
      });
      row.kind =
        row.category === 'toll' ? 'toll' : row.category === 'parking' ? 'parking' : 'other';
      if (!old) rows.push(row);
      row.bookingKey = '';
      editing = '';
      page = 0;
      say('Draft updated. Confirm with Save selected expenses when ready.');
      paint();
    }
    const Cents = value =>
      /^\d+(?:\.\d{1,2})?$/.test(value)
        ? E.cents(
            value.includes('.')
              ? value.split('.')[0] + '.' + value.split('.')[1].padEnd(2, '0')
              : value + '.00'
          )
        : null;
    async function drawPreview() {
      const r = rows.find(r => r.id === preview);
      if (!r || r.manual || !session || !openNow()) return;
      const token = ++previewToken,
        account = owner,
        source = session;
      try {
        const canvas = await source.renderPage(r.page);
        if (token !== previewToken || source !== session || a.owner() !== account || !openNow())
          return;
        const target = $('tngPageCanvas');
        if (!target) return;
        target.width = canvas.width;
        target.height = canvas.height;
        target.getContext('2d').drawImage(canvas, 0, 0);
        updateFrame();
      } catch (error) {
        if (token === previewToken && a.owner() === account) say(error.message);
      }
    }
    function updateFrame() {
      const r = rows.find(r => r.id === preview),
        frame = $('tngCropFrame');
      if (!r || !frame) return;
      Object.assign(frame.style, {
        left: (r.rect.x / r.width) * 100 + '%',
        top: (r.rect.y / r.height) * 100 + '%',
        width: (r.rect.w / r.width) * 100 + '%',
        height: (r.rect.h / r.height) * 100 + '%',
      });
      for (const field of document.querySelectorAll('[data-tng-rect]'))
        if (field !== document.activeElement)
          field.value = (Math.round(r.rect[field.dataset.tngRect] * 10) / 10).toString();
    }
    async function download(kind) {
      sync();
      if (exporting) return;
      const account = owner,
        source = session,
        token = ++exportToken;
      const valid = () =>
        a.ready() &&
        a.owner() === account &&
        session === source &&
        exportToken === token &&
        openNow();
      const list = JSON.parse(
        JSON.stringify(
          kind === 'png' ? [rows.find(r => r.id === preview)].filter(Boolean) : evidenceRows()
        )
      );
      if (!source || !list.length || list.some(r => r.manual))
        throw Error('Select at least one PDF transaction for evidence.');
      if (list.length > 200) throw Error('Export up to 200 evidence crops at a time.');
      exporting = true;
      say('Preparing your cropped evidence…');
      paint();
      try {
        const header = includeHeader,
          exportOptions = { claimType, captions: { ...captions } };
        const blob =
          kind === 'png'
            ? await F.png(await F.crop(source, list[0], header))
            : kind === 'pdf'
              ? await F.pdfPack(source, list, header, valid, exportOptions)
              : await F.zipPack(source, list, header, valid);
        if (!valid()) return;
        a.download(
          blob,
          kind === 'png'
            ? F.filename(list[0])
            : `tng-evidence-${a.today()}.${kind === 'pdf' ? 'pdf' : 'zip'}`,
          blob.type
        );
        say('Evidence downloaded. Check the crops before attaching them to a claim.');
      } finally {
        if (a.owner() === account && session === source) {
          exporting = false;
          paint();
        }
      }
    }
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-tng]');
      if (!b || b.disabled) return;
      const action = b.dataset.tng;
      if (action === 'open') {
        open();
        return;
      }
      if (action === 'open-source') {
        openSource(b.dataset.id);
        return;
      }
      sync();
      if (!a.ready() || !openNow()) return;
      if (busy && action !== 'clear') {
        say('Wait for the statement to finish reading, or clear it to cancel.');
        return;
      }
      try {
        if (action === 'match') return matchVisits();
        if (action === 'save') return save();
        if (['pdf', 'zip', 'png'].includes(action)) {
          void download(action).catch(e => say(e.message));
          return;
        }
        if (action === 'preview') {
          preview = b.dataset.id;
          editing = '';
        }
        if (action === 'manual') {
          editing = 'new';
        }
        if (action === 'edit') editing = b.dataset.id;
        if (action === 'cancel-edit') editing = '';
        if (action === 'remove') rows = rows.filter(r => r.id !== b.dataset.id);
        if (action === 'date') {
          chosenDates.has(b.dataset.date)
            ? chosenDates.delete(b.dataset.date)
            : chosenDates.add(b.dataset.date);
          page = 0;
        }
        if (action === 'all-dates') {
          chosenDates.clear();
          from = '';
          to = '';
          page = 0;
        }
        if (action === 'select-visible')
          for (const r of visible()) if (editable(r)) r.selected = true;
        if (action === 'clear-selection') for (const r of rows) r.selected = false;
        if (action === 'previous') page--;
        if (action === 'next') page++;
        if (action === 'reset-crop') {
          const r = rows.find(r => r.id === preview);
          if (r) r.rect = { ...r.originalRect };
        }
        if (action === 'clear') {
          generation++;
          exportToken++;
          session?.close();
          session = null;
          rows = rows.filter(r => r.manual);
          preview = '';
          busy = false;
          exporting = false;
          captions = {};
          say('Statement cleared. Manual drafts are kept.');
        }
        paint();
      } catch (error) {
        say(error.message);
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'tngRowForm') {
        event.preventDefault();
        try {
          rowForm(event.target);
        } catch (error) {
          say(error.message);
        }
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (!el.closest?.('#tngStudio')) return;
      sync();
      if (!a.ready() || !openNow()) return;
      if (el.id === 'tngFile') {
        if (el.files[0]) void loadFile(el.files[0]);
        return;
      }
      if (el.dataset.tngSelect) {
        const r = rows.find(r => r.id === el.dataset.tngSelect);
        if (r && selectable(r)) r.selected = el.checked;
        paint();
        return;
      }
      if (el.dataset.tngBooking) {
        const r = rows.find(r => r.id === el.dataset.tngBooking);
        if (r) r.bookingKey = el.value;
        return;
      }
      if (el.id === 'tngFrom') from = el.value;
      if (el.id === 'tngTo') to = el.value;
      if (el.id === 'tngBasis') {
        basis = el.value;
        chosenDates.clear();
        for (const r of rows) r.bookingKey = '';
      }
      if (el.id === 'tngKind') filter = el.value;
      if (el.id === 'tngClaimType') {
        claimType = el.value;
        exportToken++;
        exporting = false;
        for (const r of rows) {
          r.bookingKey = '';
          if (!selectable(r)) r.selected = false;
        }
        paint();
        return;
      }
      if (el.id === 'tngIncludeHeader') {
        includeHeader = el.checked;
        return;
      }
      if (el.dataset.tngRect) {
        const r = rows.find(r => r.id === preview);
        if (r) {
          r.rect = E.clampRect(
            { ...r.rect, [el.dataset.tngRect]: Number(el.value) },
            r.width,
            r.height
          );
          updateFrame();
        }
        return;
      }
      if (['tngFrom', 'tngTo', 'tngBasis', 'tngKind'].includes(el.id)) {
        page = 0;
        paint();
      }
    });
    document.addEventListener('dragover', event => {
      if (event.target.closest?.('#tngDrop')) event.preventDefault();
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (el.closest?.('#tngStudio') && el.dataset.tngCaption && a.owner() === owner)
        captions[el.dataset.tngCaption] = el.value;
    });
    document.addEventListener('drop', event => {
      if (event.target.closest?.('#tngDrop')) {
        event.preventDefault();
        if (event.dataTransfer?.files[0]) void loadFile(event.dataTransfer.files[0]);
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest?.('#tngCropFrame')) return;
      sync();
      const frame = event.target.closest?.('#tngCropFrame'),
        r = rows.find(r => r.id === preview),
        box = $('tngPageFrame');
      if (!frame || !r || !box || !a.ready() || !openNow()) return;
      const b = box.getBoundingClientRect();
      if (!b.width || !b.height) return;
      event.preventDefault();
      frame.focus();
      drag = {
        id: r.id,
        owner,
        corner: event.target.dataset.tngCorner || '',
        start: { x: event.clientX, y: event.clientY },
        rect: { ...r.rect },
        sx: r.width / b.width,
        sy: r.height / b.height,
      };
      frame.setPointerCapture?.(event.pointerId);
    });
    document.addEventListener('pointermove', event => {
      if (!drag || drag.owner !== a.owner() || !openNow()) return;
      const r = rows.find(r => r.id === drag.id);
      if (!r) return;
      const dx = (event.clientX - drag.start.x) * drag.sx,
        dy = (event.clientY - drag.start.y) * drag.sy,
        v = { ...drag.rect };
      if (!drag.corner) {
        v.x += dx;
        v.y += dy;
        v.x = Math.min(r.width - v.w, Math.max(0, v.x));
        v.y = Math.min(r.height - v.h, Math.max(0, v.y));
      } else {
        if (drag.corner.includes('w')) {
          v.x += dx;
          v.w -= dx;
        } else v.w += dx;
        if (drag.corner.includes('n')) {
          v.y += dy;
          v.h -= dy;
        } else v.h += dy;
      }
      r.rect = E.clampRect(v, r.width, r.height);
      updateFrame();
    });
    for (const type of ['pointerup', 'pointercancel'])
      document.addEventListener(type, () => {
        drag = null;
      });
    document.addEventListener('keydown', event => {
      if (event.target.id !== 'tngCropFrame' || !event.key.startsWith('Arrow')) return;
      sync();
      if (!a.ready() || !openNow()) return;
      const r = rows.find(r => r.id === preview);
      if (!r) return;
      event.preventDefault();
      const v = { ...r.rect },
        delta = event.altKey ? 10 : 1;
      if (event.shiftKey) {
        v.w += event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0;
        v.h += event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0;
      } else {
        v.x += event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0;
        v.y += event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0;
      }
      r.rect = E.clampRect(v, r.width, r.height);
      updateFrame();
    });
    return {
      mount,
      sync,
      open,
      openSource,
      loadFile,
      matchVisits,
      save,
      rowForm,
      download,
      snapshot: () => ({
        rows: JSON.parse(JSON.stringify(rows)),
        source: session ? { ...session.source } : null,
        busy,
        exporting,
        basis,
        claimType,
        selected: selected().length,
      }),
    };
  }
  root.WorkHubTng = { install };
})(window);
