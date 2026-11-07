/** Independent, account-scoped Excel report workspace. Uploaded values stay in browser memory. */
(function (root) {
  'use strict';
  const E = root.WorkHubExcelReportEngine,
    F = root.WorkHubValidatorFiles,
    PAGE = 40,
    COLUMN_PAGE = 60,
    TABLE_COLUMNS = 16;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (op, label, attrs = '', cls = '') =>
    `<button type="button" class="val-btn ${cls}" data-er="${op}" ${attrs}>${label}</button>`;
  const option = (value, label, selected) =>
    `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
  const count = n => Number(n).toLocaleString();
  function install(a) {
    let owner = '',
      epoch = 0,
      controller = null,
      activeJob = null,
      busy = false,
      filename = '',
      book = null,
      sheetIndex = 0,
      headerRow = 1,
      report = null,
      selected = new Set(),
      columnSearch = '',
      columnView = 'all',
      columnPage = 0,
      filterSearch = '',
      filterColumn = -1,
      liveColumn = 0,
      liveText = '',
      liveCase = false,
      liveTimer = null,
      listText = '',
      caseSensitive = false,
      filters = [],
      result = null,
      selectedFilter = 0,
      valueMode = 'all',
      valuePage = 0,
      rowPage = 0,
      tableColumnPage = 0,
      notice = '',
      problem = false,
      prepared = null;
    const can = action =>
      !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('validator', action);
    const panel = () => document.getElementById('valExcelReport');
    const paint = () => {
      if (panel()) a.render();
    };
    function clearPrepared() {
      if (prepared) root.URL.revokeObjectURL(prepared.url);
      prepared = null;
    }
    function invalidate() {
      epoch++;
      clearPrepared();
    }
    function reset() {
      controller?.abort();
      clearTimeout(liveTimer);
      liveTimer = null;
      controller = null;
      activeJob = null;
      invalidate();
      busy = false;
      filename = '';
      book = report = result = null;
      sheetIndex = 0;
      headerRow = 1;
      selected = new Set();
      columnSearch = filterSearch = listText = notice = '';
      columnView = 'all';
      columnPage = selectedFilter = valuePage = rowPage = tableColumnPage = 0;
      filterColumn = -1;
      liveColumn = 0;
      liveText = '';
      liveCase = false;
      filters = [];
      valueMode = 'all';
      caseSensitive = problem = false;
    }
    function sync() {
      const next = a.ready() ? a.owner?.() || '' : '';
      if (next !== owner) {
        reset();
        owner = next;
      }
      return !!owner;
    }
    function ensure(action = 'run') {
      if (!sync()) throw Error('Sign in to use Excel Report.');
      if (!can(action)) throw Error('Your account cannot ' + action + ' Excel Report.');
    }
    function fail(error) {
      sync();
      if (a.ready() && error?.name !== 'AbortError') {
        notice = error.message || 'The report could not be prepared.';
        problem = true;
        paint();
      }
    }
    function guard(token, account, action = 'run') {
      if (
        token !== epoch ||
        owner !== account ||
        !a.ready() ||
        a.owner?.() !== account ||
        !can(action)
      ) {
        const error = Error(
          'The report operation was cancelled because its file or access changed.'
        );
        error.name = 'AbortError';
        throw error;
      }
    }
    function status(text, error = false) {
      notice = text;
      problem = error;
    }
    function chooseSheet(index, row = 1) {
      if (!Number.isInteger(index) || !book?.sheets[index])
        throw Error('Choose an available worksheet.');
      const next = E.createReport(book.sheets[index], row);
      invalidate();
      sheetIndex = index;
      headerRow = row;
      report = next;
      selected = new Set(next.columns.map(column => column.index));
      columnSearch = filterSearch = listText = '';
      columnView = 'all';
      columnPage = selectedFilter = valuePage = rowPage = tableColumnPage = 0;
      filterColumn = next.columns[0]?.index ?? -1;
      liveColumn = 0;
      liveText = '';
      liveCase = false;
      filters = [];
      result = E.evaluate(report, filters);
      caseSensitive = false;
      valueMode = 'all';
      status('Worksheet loaded. Choose columns and paste values to filter.');
    }
    async function loadFile(file) {
      ensure('run');
      if (busy) throw Error('Wait for the current operation, or cancel it first.');
      if (!file || !/\.xlsx?$/i.test(file.name))
        throw Error('Choose an .xls or .xlsx Excel workbook.');
      if (file.size > F.CSV_LIMITS.fileBytes) throw Error('Choose an Excel workbook below 50 MB.');
      controller?.abort();
      invalidate();
      const token = epoch,
        account = owner;
      const job = {};
      activeJob = job;
      controller = new root.AbortController();
      busy = true;
      status('Reading workbook and displayed values…');
      paint();
      try {
        const loaded = /\.xls$/i.test(file.name)
          ? await root.WorkHubValidatorXLS.read(file, { signal: controller.signal })
          : await F.read(file, { displayValues: true, signal: controller.signal });
        guard(token, account);
        const suitable = s => s.rows.length && (s.width || s.rows.some(row => row?.length));
        const preferred = loaded.sheets.findIndex(s => s.state === 'visible' && suitable(s));
        const index = preferred >= 0 ? preferred : loaded.sheets.findIndex(suitable);
        if (index < 0) throw Error('The workbook does not contain a worksheet with data.');
        E.createReport(loaded.sheets[index], 1);
        book = loaded;
        filename = file.name;
        chooseSheet(index, 1);
        status('Excel file loaded. Choose columns, then paste a list to check.');
      } catch (error) {
        if (token === epoch && account === a.owner?.() && a.ready()) {
          status(error.message, true);
          throw error;
        }
      } finally {
        if (activeJob === job && account === a.owner?.() && a.ready()) {
          activeJob = null;
          controller = null;
          busy = false;
          paint();
        }
      }
    }
    function matches(columns, query) {
      const needle = query.trim().toLowerCase();
      return !needle
        ? columns
        : columns.filter(c => (c.letter + ' ' + c.header).toLowerCase().includes(needle));
    }
    function effectiveRows() {
      return result?.rows || [];
    }
    function selectedColumns() {
      return report?.columns.filter(c => selected.has(c.index)) || [];
    }
    const live = () => ({ column: liveColumn, text: liveText, caseSensitive: liveCase });
    function apply() {
      ensure('run');
      if (!report || !report.columns[filterColumn]) throw Error('Choose a column to filter.');
      const values = E.parseList(listText);
      const entry = { column: filterColumn, values, caseSensitive };
      const index = filters.findIndex(f => f.column === filterColumn);
      if (index < 0 && filters.length >= E.LIMITS.filters)
        throw Error('Use up to 20 column filters at a time.');
      const next = filters.slice();
      if (index < 0) next.push(entry);
      else next[index] = entry;
      const calculated = E.evaluate(report, next, live());
      invalidate();
      filters = next;
      result = calculated;
      selectedFilter = index < 0 ? next.length - 1 : index;
      rowPage = valuePage = 0;
      valueMode = 'all';
      status('Filter applied. List results are checked against the original worksheet.');
    }
    function removeFilter(index) {
      ensure('run');
      if (!Number.isInteger(index) || !filters[index]) throw Error('Choose an active filter.');
      const next = filters.filter((_, i) => i !== index),
        calculated = E.evaluate(report, next, live());
      invalidate();
      filters = next;
      result = calculated;
      selectedFilter = Math.min(selectedFilter, Math.max(0, next.length - 1));
      valuePage = rowPage = 0;
      valueMode = 'all';
      status('Filter removed.');
    }
    function reviewValues() {
      const current = result?.filters[selectedFilter];
      if (!current) return [];
      return current.values.filter(
        item => valueMode === 'all' || (valueMode === 'found' ? item.count > 0 : item.count === 0)
      );
    }
    function pageControls(kind, page, total, size) {
      const pages = Math.max(1, Math.ceil(total / size));
      page = Math.max(0, Math.min(page, pages - 1));
      return `<div class="er-paging" aria-label="${esc(kind)} pages">${button(kind + '-prev', '← Previous', page ? '' : 'disabled', 'val-quiet')}<span>Page ${page + 1} of ${pages}</span>${button(kind + '-next', 'Next →', page + 1 < pages ? '' : 'disabled', 'val-quiet')}</div>`;
    }
    function columnChooser() {
      const matching = matches(report.columns, columnSearch),
        all = matching.filter(
          c =>
            columnView === 'all' ||
            (columnView === 'selected' ? selected.has(c.index) : !selected.has(c.index))
        ),
        pages = Math.max(1, Math.ceil(all.length / COLUMN_PAGE));
      columnPage = Math.min(columnPage, pages - 1);
      const visible = all.slice(columnPage * COLUMN_PAGE, (columnPage + 1) * COLUMN_PAGE);
      const empty = columnSearch.trim()
        ? 'No columns match this search and view.'
        : columnView === 'selected'
          ? 'No columns are checked. Choose All or Unchecked to select columns.'
          : 'No unchecked columns. Choose All or Checked to review your selection.';
      return `<section class="er-card er-column-card"><div class="er-card-heading"><div><span class="er-step">02 · SHAPE YOUR REPORT</span><h3>Choose display columns</h3><p>Check the columns you want in the report. Your filters can use any column.</p></div><strong class="er-count" aria-live="polite">${count(selected.size)} / ${count(report.columns.length)} selected</strong></div>
        <div class="er-column-bulk" role="group" aria-label="All worksheet columns">${button('select-all-columns', 'Check all columns', selected.size === report.columns.length ? 'disabled' : '', 'val-secondary')}${button('uncheck-all-columns', 'Uncheck all columns', selected.size === 0 ? 'disabled' : '', 'val-quiet')}<small>Applies to every column in this worksheet.</small></div>
        <label class="er-label" for="erColumnSearch">Search columns</label><input id="erColumnSearch" type="search" maxlength="200" value="${esc(columnSearch)}" placeholder="Type a column name or letter…">
        ${columnSearch.trim() ? `<div class="er-column-search-actions">${button('select-shown', 'Check search results', matching.length ? '' : 'disabled', 'val-secondary')}${button('clear-shown', 'Uncheck search results', matching.length ? '' : 'disabled', 'val-quiet')}<small>Applies to all ${count(matching.length)} matching columns, across pages.</small></div>` : ''}
        <div class="er-column-view-bar"><div class="er-column-views" role="group" aria-label="Show columns">${[
          ['all', 'All', report.columns.length],
          ['selected', 'Checked', selected.size],
          ['unselected', 'Unchecked', report.columns.length - selected.size],
        ]
          .map(([view, label, number]) =>
            button(
              'column-view',
              `${label} <span>${count(number)}</span>`,
              `data-view="${view}" aria-pressed="${columnView === view}"`,
              columnView === view ? 'is-active' : 'val-quiet'
            )
          )
          .join('')}</div><small>${count(all.length)} in this view</small></div>
        <div class="er-column-grid">${visible.map(c => `<label class="er-column-option${selected.has(c.index) ? ' is-selected' : ''}"><input id="erColumn-${c.index}" type="checkbox" data-er-column="${c.index}"${selected.has(c.index) ? ' checked' : ''}><span><b>${c.letter}</b><span>${esc(c.label)}</span></span></label>`).join('') || `<p class="er-empty">${empty}</p>`}</div>${all.length > COLUMN_PAGE ? pageControls('column', columnPage, all.length, COLUMN_PAGE) : ''}</section>`;
    }
    function filtersView() {
      const choices = matches(report.columns, filterSearch);
      const field = choices.some(c => c.index === filterColumn)
        ? filterColumn
        : (choices[0]?.index ?? -1);
      const chips = result.filters
        .map(
          (filter, index) =>
            `<div class="er-filter-chip"><div><strong>${esc(report.columns[filter.column].letter + ' · ' + report.columns[filter.column].label)}</strong><small>${count(filter.found)} found · ${count(filter.missing)} not found${filter.caseSensitive ? ' · Case-sensitive' : ''}</small></div><div>${button('review-filter', 'View results', `data-index="${index}" aria-pressed="${selectedFilter === index}"`, 'val-quiet')}${button('edit-filter', 'Edit', `data-index="${index}"`, 'val-quiet')}${button('remove-filter', 'Remove', `data-index="${index}"`, 'val-quiet')}</div></div>`
        )
        .join('');
      return `<section class="er-card er-filter-card"><div class="er-card-heading"><div><span class="er-step">03 · CHECK YOUR LIST</span><h3>Filter by pasted values</h3><p>Pick a column and paste one value per line, or paste cells copied from Excel.</p></div></div><div class="er-filter-grid"><div><label class="er-label" for="erFilterSearch">Find a filter column</label><input id="erFilterSearch" type="search" maxlength="200" value="${esc(filterSearch)}" placeholder="Search column names…"><label class="er-label" for="erFilterColumn">Column to check</label><select id="erFilterColumn">${choices.map(c => option(c.index, c.letter + ' · ' + c.label, c.index === field)).join('') || '<option value="">No matching columns</option>'}</select><label class="er-case"><input type="checkbox" id="erCase"${caseSensitive ? ' checked' : ''}> Match upper and lower case</label></div><div><label class="er-label" for="erList">Values to find</label><textarea id="erList" rows="6" spellcheck="false" placeholder="Paste values here, one per line…">${esc(listText)}</textarea><small>Spaces around values are ignored. Leading zeros are kept.</small><div class="er-inline-actions">${button('apply-filter', filters.some(f => f.column === field) ? 'Update column filter' : 'Apply list filter', field < 0 || busy || !can('run') ? 'disabled' : '', 'val-primary')}${filters.length ? button('clear-filters', 'Clear all filters', busy ? 'disabled' : '', 'val-quiet') : ''}</div></div></div>${chips ? `<div class="er-filter-chips"><h4>Active column filters</h4><p>Rows must match every active filter.</p>${chips}</div>` : ''}</section>`;
    }
    function liveView() {
      return `<section class="er-card er-live-card"><div class="er-card-heading"><div><span class="er-step">LIVE SEARCH</span><h3>Find text as you type</h3><p>Search a column using text, <b>*</b> for any number of characters, or <b>?</b> for one character. Search matches anywhere in the cell.</p></div></div><div class="er-live-grid"><label>Column<select id="erLiveColumn">${report.columns.map(c => option(c.index, c.letter + ' · ' + c.label, c.index === liveColumn)).join('')}</select></label><label>Search text<input id="erLiveText" type="search" maxlength="200" value="${esc(liveText)}" placeholder="e.g. invoice*pending or A?01"></label><label class="er-case"><input id="erLiveCase" type="checkbox"${liveCase ? ' checked' : ''}> Match upper and lower case</label></div><small>The live search and pasted-list filters are combined. List results still check the complete source worksheet.</small></section>`;
    }
    function refreshLive() {
      if (!report || !result) return;
      result.rows = E.rowsFor(report, result.filters, live());
      rowPage = 0;
      paint();
    }
    function listResults() {
      const current = result?.filters[selectedFilter];
      if (!current) return '';
      const data = reviewValues(),
        pages = Math.max(1, Math.ceil(data.length / PAGE));
      valuePage = Math.min(valuePage, pages - 1);
      const rows = data.slice(valuePage * PAGE, (valuePage + 1) * PAGE);
      return `<section class="er-card er-results-card"><div class="er-card-heading"><div><span class="er-step">LIST RESULTS</span><h3>Found or not found</h3><p>Presence counts all rows in the original worksheet, before other filters.</p></div><strong class="er-count">${esc(report.columns[current.column].letter + ' · ' + report.columns[current.column].label)}</strong></div><div class="er-summary"><span>${count(current.values.length)} pasted</span><span class="er-found">${count(current.found)} found</span><span class="er-missing">${count(current.missing)} not found</span></div><div class="er-match-track" role="progressbar" aria-label="Pasted values found in the source report" aria-valuemin="0" aria-valuemax="${current.values.length}" aria-valuenow="${current.found}"><span style="width:${current.values.length ? Math.round((current.found / current.values.length) * 100) : 0}%"></span></div><div class="er-inline-actions" role="group" aria-label="List result filter">${['all', 'found', 'missing'].map(mode => button('value-mode', mode === 'all' ? 'All values' : mode === 'found' ? 'Found' : 'Not found', `data-mode="${mode}" aria-pressed="${valueMode === mode}"`, valueMode === mode ? 'val-secondary' : 'val-quiet')).join('')}</div><div class="er-table-wrap er-list-table"><table><thead><tr><th>Value</th><th>Result</th><th>Matching source rows</th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.value)}</td><td><span class="er-badge ${item.count ? 'er-found' : 'er-missing'}">${item.count ? 'Found' : 'Not found'}</span></td><td>${count(item.count)}</td></tr>`).join('') || '<tr><td colspan="3">No values in this view.</td></tr>'}</tbody></table></div>${data.length > PAGE ? pageControls('value', valuePage, data.length, PAGE) : ''}</section>`;
    }
    function reportView() {
      const columns = selectedColumns(),
        rows = effectiveRows(),
        rowPages = Math.max(1, Math.ceil(rows.length / PAGE)),
        colPages = Math.max(1, Math.ceil(columns.length / TABLE_COLUMNS));
      rowPage = Math.min(rowPage, rowPages - 1);
      tableColumnPage = Math.min(tableColumnPage, colPages - 1);
      const visibleColumns = columns.slice(
          tableColumnPage * TABLE_COLUMNS,
          (tableColumnPage + 1) * TABLE_COLUMNS
        ),
        visibleRows = rows.slice(rowPage * PAGE, (rowPage + 1) * PAGE);
      return `<section class="er-card er-report-card"><div class="er-card-heading"><div><span class="er-step">YOUR REPORT</span><h3>${esc(report.sheet)}</h3><p>${count(rows.length)} ${filters.length || liveText ? 'matching' : 'available'} rows · ${count(report.rows.length)} source rows · ${count(columns.length)} visible columns</p></div><div class="er-inline-actions">${button('prepare-export', busy ? 'Preparing…' : 'Prepare Excel download', !columns.length || busy || !can('export') ? 'disabled' : '', 'val-primary')}${prepared ? `<a class="val-btn val-secondary" id="erDownload" href="${esc(prepared.url)}" download="${esc(prepared.name)}">Download report</a>` : ''}</div></div>${columns.length ? `<div class="er-table-wrap er-data-table"><table><thead><tr><th scope="col">Excel row</th>${visibleColumns.map(c => `<th scope="col"><small>${c.letter}</small>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${visibleRows.map(i => `<tr><th scope="row">${i + headerRow + 1}</th>${visibleColumns.map(c => `<td>${esc(report.rows[i]?.[c.index] ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${visibleColumns.length + 1}">No report rows match the active filters.</td></tr>`}</tbody></table></div>${columns.length > TABLE_COLUMNS ? pageControls('table-column', tableColumnPage, columns.length, TABLE_COLUMNS) : ''}${rows.length > PAGE ? pageControls('row', rowPage, rows.length, PAGE) : ''}` : '<p class="er-empty">Select at least one display column to see the report and prepare a download.</p>'}</section>`;
    }
    function render() {
      sync();
      const current = book?.sheets[sheetIndex],
        notes = current?.notes;
      const caveats = [
        notes?.hiddenRows ? 'Hidden worksheet rows are included.' : '',
        notes?.hiddenColumns ? 'Hidden worksheet columns are included.' : '',
        notes?.mergedRanges ? 'Merged headers appear in their original cells.' : '',
        notes?.formulas ? 'Formula cells use their saved results.' : '',
        notes?.localeFormats ? 'Some date formats depend on Excel’s locale.' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<section id="valExcelReport" class="er-workspace" data-er-owner="${esc(owner)}"><header class="er-hero"><div><span class="er-step">EXCEL REPORT · YOUR DATA, YOUR VIEW</span><h2>Find what is in your report.</h2><p>Upload an Excel workbook, choose your columns, and check a pasted list against its rows.</p></div><div class="er-hero-mark" aria-hidden="true"><span>✓</span><span>≡</span><span>↗</span></div></header><section class="er-card er-upload"><div class="er-card-heading"><div><span class="er-step">01 · OPEN YOUR FILE</span><h3>${filename ? esc(filename) : 'Choose an Excel workbook'}</h3><p>Supports .xlsx and .xls files up to 50 MB. Your workbook is read on this device.</p></div><div class="er-inline-actions">${button('browse', filename ? 'Replace file' : 'Upload Excel file', busy || !can('run') ? 'disabled' : '', 'val-primary')}${filename || busy ? button('clear', busy ? 'Cancel operation' : 'Clear file', '', 'val-quiet') : ''}</div></div><input id="erFile" type="file" accept=".xlsx,.xls" hidden>${notice ? `<p class="er-notice${problem ? ' is-error' : ''}" role="status">${esc(notice)}</p>` : ''}${busy ? '<progress aria-label="Preparing Excel report"></progress>' : ''}${book && report ? `<div class="er-source-grid"><label>Worksheet<select id="erSheet">${book.sheets.map((s, i) => option(i, s.name + (s.state && s.state !== 'visible' ? ' · hidden' : ''), i === sheetIndex)).join('')}</select></label><label>Header row<input id="erHeaderRow" type="number" min="1" max="${current.rows.length}" step="1" value="${headerRow}"></label><div><strong>${count(report.rows.length)} data rows · ${count(report.columns.length)} columns</strong><small>Values use Excel’s displayed format and saved formula results.</small></div></div>${caveats ? `<p class="er-source-note">${esc(caveats)}</p>` : ''}` : ''}</section>${report ? columnChooser() + liveView() + filtersView() + listResults() + reportView() : `<div class="er-start-grid"><article><span>01</span><h3>Upload a workbook</h3><p>Select the worksheet and row containing its column names.</p></article><article><span>02</span><h3>Choose your view</h3><p>Search the column list and select what belongs in your report.</p></article><article><span>03</span><h3>Check a list</h3><p>Paste values to see matching rows and identify values not found.</p></article></div>`}</section>`;
    }
    async function prepareExport() {
      ensure('export');
      if (busy || !report) throw Error('Wait for the current operation and choose a file.');
      clearTimeout(liveTimer);
      result.rows = E.rowsFor(report, result.filters, live());
      const columns = selectedColumns(),
        rowIndices = effectiveRows().slice(),
        current = report,
        active = result;
      if (!columns.length) throw Error('Select at least one display column.');
      const account = owner,
        token = epoch;
      const job = {};
      activeJob = job;
      clearPrepared();
      busy = true;
      status('Preparing the selected report and list results…');
      paint();
      try {
        const sheets = [
          {
            name: 'Report',
            width: columns.length,
            rowCount: rowIndices.length + 1,
            keepTogether: true,
            escapeText: true,
            rows: function* () {
              yield columns.map(c => c.header);
              for (const i of rowIndices)
                yield columns.map(c => String(current.rows[i]?.[c.index] ?? ''));
            },
          },
        ];
        if (active.filters.length) {
          const total = active.filters.reduce((n, f) => n + f.values.length, 0);
          sheets.push({
            name: 'List results',
            width: 5,
            rowCount: total + 1,
            keepTogether: true,
            escapeText: true,
            rows: function* () {
              yield ['Column', 'Pasted value', 'Result', 'Matching source rows', 'Case sensitive'];
              for (const f of active.filters)
                for (const item of f.values)
                  yield [
                    current.columns[f.column].letter + ' · ' + current.columns[f.column].label,
                    item.value,
                    item.count ? 'Found' : 'Not found',
                    item.count,
                    f.caseSensitive ? 'Yes' : 'No',
                  ];
            },
          });
        }
        const blob = await F.workbook(sheets);
        guard(token, account, 'export');
        const name =
          (filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'Excel-report').slice(
            0,
            70
          ) + '-filtered-report.xlsx';
        prepared = { url: root.URL.createObjectURL(blob), name };
        status('Your report is ready. The workbook includes selected rows and list results.');
      } catch (error) {
        if (error.name === 'AbortError' && activeJob === job && account === a.owner?.())
          status('The report changed while preparing. Please prepare it again.');
        else throw error;
      } finally {
        if (activeJob === job && account === a.owner?.() && a.ready()) {
          activeJob = null;
          busy = false;
          paint();
        }
      }
    }
    async function handle(el) {
      ensure('run');
      const action = el.dataset.er,
        index = Number(el.dataset.index),
        delta = action.endsWith('-prev') ? -1 : 1;
      if (action === 'browse') {
        document.getElementById('erFile')?.click();
        return;
      }
      if (action === 'clear') {
        reset();
        status('File cleared.');
        paint();
        return;
      }
      if (!report) throw Error('Upload an Excel workbook first.');
      if (action === 'select-all-columns' || action === 'uncheck-all-columns') {
        selected = new Set(action === 'select-all-columns' ? report.columns.map(c => c.index) : []);
        columnView = 'all';
        columnPage = tableColumnPage = 0;
        invalidate();
      } else if (action === 'select-shown' || action === 'clear-shown') {
        const columns = matches(report.columns, columnSearch);
        for (const c of columns)
          action === 'select-shown' ? selected.add(c.index) : selected.delete(c.index);
        invalidate();
        columnPage = tableColumnPage = 0;
      } else if (action === 'column-view') {
        if (!['all', 'selected', 'unselected'].includes(el.dataset.view)) return;
        columnView = el.dataset.view;
        columnPage = 0;
      } else if (action === 'apply-filter') apply();
      else if (action === 'remove-filter') removeFilter(index);
      else if (action === 'clear-filters') {
        invalidate();
        filters = [];
        result = E.evaluate(report, filters, live());
        selectedFilter = rowPage = valuePage = 0;
        status('All list filters cleared.');
      } else if (action === 'review-filter') {
        if (!result.filters[index]) throw Error('Choose a filter to review.');
        selectedFilter = index;
        valueMode = 'all';
        valuePage = 0;
      } else if (action === 'edit-filter') {
        const f = filters[index];
        if (!f) throw Error('Choose a filter to edit.');
        filterSearch = '';
        filterColumn = f.column;
        listText = f.values.join('\n');
        caseSensitive = f.caseSensitive;
      } else if (action === 'value-mode') {
        if (!['all', 'found', 'missing'].includes(el.dataset.mode)) return;
        valueMode = el.dataset.mode;
        valuePage = 0;
      } else if (action === 'prepare-export') {
        await prepareExport();
        return;
      } else if (action.startsWith('column-')) columnPage = Math.max(0, columnPage + delta);
      else if (action.startsWith('table-column-'))
        tableColumnPage = Math.max(0, tableColumnPage + delta);
      else if (action.startsWith('value-')) valuePage = Math.max(0, valuePage + delta);
      else if (action.startsWith('row-')) rowPage = Math.max(0, rowPage + delta);
      paint();
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('#valExcelReport [data-er]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(fail);
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (!el.closest?.('#valExcelReport')) return;
      if (el.id === 'erLiveText') {
        liveText = el.value;
        invalidate();
        clearTimeout(liveTimer);
        liveTimer = setTimeout(refreshLive, 100);
        return;
      }
      if (el.id === 'erList') {
        listText = el.value;
        return;
      }
      if (el.id === 'erColumnSearch') {
        columnSearch = el.value;
        columnPage = 0;
        paint();
      }
      if (el.id === 'erFilterSearch') {
        filterSearch = el.value;
        const options = matches(report.columns, filterSearch);
        if (!options.some(c => c.index === filterColumn)) filterColumn = options[0]?.index ?? -1;
        paint();
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (!el.closest?.('#valExcelReport')) return;
      if (el.id === 'erFile') {
        const file = el.files?.[0];
        el.value = '';
        if (file) void loadFile(file).catch(fail);
        return;
      }
      try {
        ensure('run');
        let disappearingColumn = null;
        if (el.id === 'erSheet') chooseSheet(Number(el.value), 1);
        else if (el.id === 'erHeaderRow') chooseSheet(sheetIndex, Number(el.value));
        else if (el.id === 'erLiveColumn') {
          liveColumn = Number(el.value);
          invalidate();
          refreshLive();
          return;
        } else if (el.id === 'erLiveCase') {
          liveCase = el.checked;
          invalidate();
          refreshLive();
          return;
        } else if (el.id === 'erFilterColumn') filterColumn = Number(el.value);
        else if (el.id === 'erCase') caseSensitive = el.checked;
        else if (el.dataset.erColumn !== undefined) {
          const index = Number(el.dataset.erColumn);
          if (!report?.columns[index]) throw Error('Choose an available column.');
          el.checked ? selected.add(index) : selected.delete(index);
          if (
            (columnView === 'selected' && !el.checked) ||
            (columnView === 'unselected' && el.checked)
          )
            disappearingColumn = index;
          invalidate();
          tableColumnPage = 0;
        } else return;
        paint();
        if (disappearingColumn !== null) {
          const choices = [...document.querySelectorAll('#valExcelReport [data-er-column]')];
          const next =
            choices.find(choice => Number(choice.dataset.erColumn) > disappearingColumn) ||
            choices.at(-1);
          (
            next ||
            document.querySelector(
              `#valExcelReport [data-er="column-view"][data-view="${columnView}"]`
            )
          )?.focus({ preventScroll: true });
        }
      } catch (error) {
        if (el.id === 'erHeaderRow') el.value = headerRow;
        if (el.id === 'erSheet') el.value = String(sheetIndex);
        fail(error);
      }
    });
    root.addEventListener('pagehide', () => controller?.abort());
    return {
      render,
      sync,
      loadFile,
      prepareExport,
      handle,
      snapshot: () => ({
        owner,
        filename,
        sheetIndex,
        headerRow,
        live: { ...live() },
        selected: [...selected],
        filters:
          result?.filters.map(f => ({
            column: f.column,
            found: f.found,
            missing: f.missing,
            values: f.values.map(v => ({ ...v })),
          })) || [],
        rows: effectiveRows().slice(),
        busy,
        notice,
        problem,
        prepared: prepared ? { name: prepared.name } : null,
      }),
    };
  }
  root.WorkHubExcelReport = Object.freeze({ install });
})(window);
