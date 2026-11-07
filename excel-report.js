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
      sourceVersion = 0,
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
      listPrepared = false,
      pasteDraft = null,
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
      sourceVersion++;
      busy = false;
      filename = '';
      book = report = result = null;
      sheetIndex = 0;
      headerRow = 1;
      selected = new Set();
      columnSearch = filterSearch = listText = notice = '';
      listPrepared = false;
      pasteDraft = null;
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
      sourceVersion++;
      sheetIndex = index;
      headerRow = row;
      report = next;
      selected = new Set(next.columns.map(column => column.index));
      columnSearch = filterSearch = listText = '';
      listPrepared = false;
      pasteDraft = null;
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
    function selectionChanged() {
      clearTimeout(liveTimer);
      const checked = selectedColumns(),
        reviewed = result?.filters[selectedFilter]?.column;
      const removed = filters.filter(f => !selected.has(f.column)).length;
      filters = filters.filter(f => selected.has(f.column));
      const clearedLive = !selected.has(liveColumn) && !!liveText;
      if (!selected.has(liveColumn)) {
        liveColumn = checked[0]?.index ?? -1;
        liveText = '';
      }
      if (!checked.length) filterSearch = '';
      const choices = matches(checked, filterSearch);
      if (!choices.some(c => c.index === filterColumn)) filterColumn = choices[0]?.index ?? -1;
      result = E.evaluate(report, filters, live());
      selectedFilter = Math.max(
        0,
        filters.findIndex(f => f.column === reviewed)
      );
      rowPage = valuePage = tableColumnPage = 0;
      invalidate();
      if (removed || clearedLive) status('Filters using unchecked columns were cleared.');
    }
    function apply() {
      ensure('run');
      if (!report || !report.columns[filterColumn] || !selected.has(filterColumn))
        throw Error('Choose a checked report column to filter.');
      if (pasteDraft)
        throw Error('Choose which pasted column to keep, or discard the preview first.');
      if (!listPrepared && E.parsePaste(listText).width > 1) {
        openPastePreview();
        return;
      }
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
      return `<section class="er-card er-column-card"><div class="er-card-heading"><div><span class="er-step">02 · SHAPE YOUR REPORT</span><h3>Choose display columns</h3><p>Check the columns you want in the report. Checked columns are also available in Live Search and Check Your List.</p></div><strong class="er-count" aria-live="polite">${count(selected.size)} / ${count(report.columns.length)} selected</strong></div>
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
    function htmlPasteTable(html) {
      if (!html) return null;
      if (html.length > E.LIMITS.listCharacters)
        throw Error('The copied table is too large. Copy fewer rows.');
      const template = document.createElement('template');
      template.innerHTML = html;
      const tables = template.content.querySelectorAll('table');
      if (!tables.length) return null;
      if (tables.length !== 1)
        throw Error('Copy one table at a time, or paste tab-separated cells.');
      const table = tables[0];
      const rows = [];
      for (const row of table.querySelectorAll('tr')) {
        if (row.closest('table') !== table) continue;
        const cells = [...row.children].filter(cell => ['TD', 'TH'].includes(cell.tagName));
        if (cells.some(cell => cell.colSpan !== 1 || cell.rowSpan !== 1))
          throw Error(
            'The copied table contains merged cells. Copy unmerged cells or paste a tab-separated table.'
          );
        if (cells.length) rows.push(cells.map(cell => cell.textContent.trim()));
      }
      return rows.length ? E.pastedGrid(rows, 'html') : null;
    }
    function readPastedSource(text, html, format = 'auto') {
      if (format === 'html' || (!String(text).trim() && html)) {
        const table = htmlPasteTable(html);
        if (!table) throw Error('The clipboard does not contain a readable table.');
        return table;
      }
      const table = E.parsePaste(text, format);
      if (format === 'auto' && table.width === 1 && html) return htmlPasteTable(html) || table;
      return table;
    }
    function openPastePreview(text = listText, html = '') {
      ensure('run');
      const table = readPastedSource(text, html);
      pasteDraft = { text, html, format: 'auto', table, column: 0, skipHeader: false };
      status('Choose the pasted column you want to keep, then apply your list filter.');
    }
    function pastePreviewView() {
      if (!pasteDraft) return '';
      const d = pasteDraft,
        table = d.table,
        start = Math.max(0, Math.min(d.column - 3, table.width - 8)),
        columns = Array.from({ length: Math.min(8, table.width) }, (_, i) => start + i),
        sample = table.rows.slice(0, 5);
      let extracted = null,
        error = '';
      try {
        extracted = E.extractPasteColumn(table, d.column, d.skipHeader);
      } catch (e) {
        error = e.message;
      }
      const short = value => String(value ?? '').slice(0, 160);
      return `<section class="er-paste-preview" aria-label="Pasted table column preview"><div class="er-card-heading"><div><span class="er-step">PASTED TABLE</span><h4>Choose which column to keep</h4><p>${count(table.rows.length)} rows · ${count(table.width)} pasted columns. Use the column number from the copied table.</p></div>${button('discard-paste', 'Discard paste preview', '', 'val-quiet')}</div><div class="er-paste-options"><label>Paste format<select id="erPasteFormat">${[['auto', 'Automatic'], ['tabs', 'Excel / tab-separated'], ['pipes', 'Pipe / Markdown table'], ['csv', 'CSV / semicolon-separated'], ['spaces', 'Columns separated by 2+ spaces'], ['lines', 'One value per line'], ...(d.html ? [['html', 'Copied web table']] : [])].map(([value, label]) => option(value, label, d.format === value)).join('')}</select></label><label>Column to keep<select id="erPasteColumn">${Array.from({ length: table.width }, (_, i) => option(i, 'Column ' + (i + 1) + (table.rows[0]?.[i] ? ' · ' + short(table.rows[0][i]).slice(0, 60) : ''), d.column === i)).join('')}</select></label></div><label class="er-case"><input id="erPasteHeader" type="checkbox"${d.skipHeader ? ' checked' : ''}> First row contains headers — skip it</label><div class="er-table-wrap er-paste-table"><table><thead><tr><th>Pasted row</th>${columns.map(i => `<th class="${i === d.column ? 'is-kept' : ''}">${button('paste-column', 'Column ' + (i + 1), `data-index="${i}" aria-pressed="${i === d.column}"`, 'val-quiet')}</th>`).join('')}</tr></thead><tbody>${sample.map((row, i) => `<tr${i === 0 && d.skipHeader ? ' class="is-skipped"' : ''}><th scope="row">${i + 1}${i === 0 && d.skipHeader ? ' · header' : ''}</th>${columns.map(c => `<td${c === d.column ? ' class="is-kept"' : ''}>${esc(short(row[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><small>Preview: first 5 rows and columns ${start + 1}–${start + columns.length}. All rows are included when extracting. Values stay as text.</small><p class="er-paste-summary" role="status">${error ? esc(error) : `${count(extracted.values.length)} values will replace “Values to find”.${extracted.skipped ? ' ' + count(extracted.skipped) + ' blank cells skipped.' : ''}`}</p><div class="er-inline-actions">${button('use-paste-column', 'Use only column ' + (d.column + 1), error || busy ? 'disabled' : '', 'val-primary')}</div></section>`;
    }
    function usePasteColumn() {
      ensure('run');
      if (!pasteDraft) throw Error('Paste a table and choose a column first.');
      const column = pasteDraft.column,
        extracted = E.extractPasteColumn(pasteDraft.table, column, pasteDraft.skipHeader);
      listText = extracted.values.join('\n');
      listPrepared = true;
      pasteDraft = null;
      status(
        count(extracted.values.length) +
          ' values kept from pasted column ' +
          (column + 1) +
          '. Apply the list filter to check them.' +
          (extracted.skipped ? ' ' + count(extracted.skipped) + ' blank cells skipped.' : '')
      );
    }
    function filtersView() {
      const choices = matches(selectedColumns(), filterSearch);
      const field = choices.some(c => c.index === filterColumn)
        ? filterColumn
        : (choices[0]?.index ?? -1);
      const chips = result.filters
        .map(
          (filter, index) =>
            `<div class="er-filter-chip"><div><strong>${esc(report.columns[filter.column].letter + ' · ' + report.columns[filter.column].label)}</strong><small>${count(filter.found)} found · ${count(filter.missing)} not found${filter.caseSensitive ? ' · Case-sensitive' : ''}</small></div><div>${button('review-filter', 'View results', `data-index="${index}" aria-pressed="${selectedFilter === index}"`, 'val-quiet')}${button('edit-filter', 'Edit', `data-index="${index}"`, 'val-quiet')}${button('remove-filter', 'Remove', `data-index="${index}"`, 'val-quiet')}</div></div>`
        )
        .join('');
      return `<section class="er-card er-filter-card" data-val-context="er-list-${sourceVersion}"><div class="er-card-heading"><div><span class="er-step">03 · CHECK YOUR LIST</span><h3>Filter by pasted values</h3><p>Pick a checked report column. Paste a list, or paste a table and choose one column to keep.</p></div></div><div class="er-filter-grid"><div><label class="er-label" for="erFilterSearch">Find a filter column</label><input id="erFilterSearch" type="search" maxlength="200" value="${esc(filterSearch)}" placeholder="Search column names…"><label class="er-label" for="erFilterColumn">Column to check</label><select id="erFilterColumn"${choices.length ? '' : ' disabled'}>${choices.map(c => option(c.index, c.letter + ' · ' + c.label, c.index === field)).join('') || '<option value="-1">' + (selected.size ? 'No checked columns match this search' : 'Check report columns first') + '</option>'}</select><label class="er-case"><input type="checkbox" id="erCase"${caseSensitive ? ' checked' : ''}> Match upper and lower case</label></div><div><label class="er-label" for="erList">Values to find</label><textarea id="erList" rows="6" spellcheck="false" placeholder="Paste values here, one per line…">${esc(listText)}</textarea><small>Spaces around values are ignored. Leading zeros are kept.</small><div class="er-inline-actions er-paste-trigger">${button('preview-paste', 'Extract a column from pasted table', busy ? 'disabled' : '', 'val-secondary')}</div><div class="er-inline-actions">${button('apply-filter', filters.some(f => f.column === field) ? 'Update column filter' : 'Apply list filter', field < 0 || busy || pasteDraft || !can('run') ? 'disabled' : '', 'val-primary')}${filters.length ? button('clear-filters', 'Clear all filters', busy ? 'disabled' : '', 'val-quiet') : ''}</div></div></div>${pastePreviewView()}${chips ? `<div class="er-filter-chips"><h4>Active column filters</h4><p>Rows must match every active filter. Unchecking a column clears its filter.</p>${chips}</div>` : ''}</section>`;
    }
    function liveView() {
      const columns = selectedColumns();
      return `<section class="er-card er-live-card" data-val-context="er-live-${sourceVersion}-${liveColumn}"><div class="er-card-heading"><div><span class="er-step">LIVE SEARCH</span><h3>Find text as you type</h3><p>Search a column using text, <b>*</b> for any number of characters, or <b>?</b> for one character. Search matches anywhere in the cell.</p></div></div><div class="er-live-grid"><label>Column<select id="erLiveColumn"${columns.length ? '' : ' disabled'}>${columns.map(c => option(c.index, c.letter + ' · ' + c.label, c.index === liveColumn)).join('') || '<option value="-1">Check report columns first</option>'}</select></label><label>Search text<input id="erLiveText" type="search" maxlength="200"${columns.length ? '' : ' disabled'} value="${esc(liveText)}" placeholder="e.g. invoice*pending or A?01"></label><label class="er-case"><input id="erLiveCase" type="checkbox"${columns.length ? '' : ' disabled'}${liveCase ? ' checked' : ''}> Match upper and lower case</label></div><small>Only checked report columns can be filtered. Live search and pasted-list filters are combined. List results still check the complete source worksheet.</small></section>`;
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
      return `<section id="valExcelReport" class="er-workspace" data-er-owner="${esc(owner)}"><header class="er-hero"><div><span class="er-step">EXCEL REPORT · YOUR DATA, YOUR VIEW</span><h2>Find what is in your report.</h2><p>Upload an Excel workbook, choose your columns, and check a pasted list against its rows.</p></div><div class="er-hero-mark" aria-hidden="true"><span>✓</span><span>≡</span><span>↗</span></div></header><section class="er-card er-upload"><div class="er-card-heading"><div><span class="er-step">01 · OPEN YOUR FILE</span><h3>${filename ? esc(filename) : 'Choose an Excel workbook'}</h3><p>Supports .xlsx and .xls files up to 50 MB. Your workbook is read on this device.</p></div><div class="er-inline-actions">${button('browse', filename ? 'Replace file' : 'Upload Excel file', busy || !can('run') ? 'disabled' : '', 'val-primary')}${filename || busy ? button('clear', busy ? 'Cancel operation' : 'Clear file', '', 'val-quiet') : ''}</div></div><input id="erFile" type="file" accept=".xlsx,.xls" hidden>${notice ? `<p class="er-notice${problem ? ' is-error' : ''}" role="status">${esc(notice)}</p>` : ''}${busy ? '<progress aria-label="Preparing Excel report"></progress>' : ''}${book && report ? `<div class="er-source-grid"><label>Worksheet<select id="erSheet">${book.sheets.map((s, i) => option(i, s.name + (s.state && s.state !== 'visible' ? ' · hidden' : ''), i === sheetIndex)).join('')}</select></label><label>Header row<input id="erHeaderRow" type="number" min="1" max="${current.rows.length}" step="1" value="${headerRow}"></label><div><strong>${count(report.rows.length)} data rows · ${count(report.columns.length)} columns</strong><small>Values use Excel’s displayed format and saved formula results.</small></div></div>${caveats ? `<p class="er-source-note">${esc(caveats)}</p>` : ''}` : ''}</section>${report ? columnChooser() + filtersView() + listResults() + liveView() + reportView() : `<div class="er-start-grid"><article><span>01</span><h3>Upload a workbook</h3><p>Select the worksheet and row containing its column names.</p></article><article><span>02</span><h3>Choose your view</h3><p>Search the column list and select what belongs in your report.</p></article><article><span>03</span><h3>Check a list</h3><p>Paste values to see matching rows and identify values not found.</p></article></div>`}</section>`;
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
        selectionChanged();
      } else if (action === 'select-shown' || action === 'clear-shown') {
        const columns = matches(report.columns, columnSearch);
        for (const c of columns)
          action === 'select-shown' ? selected.add(c.index) : selected.delete(c.index);
        selectionChanged();
        columnPage = tableColumnPage = 0;
      } else if (action === 'column-view') {
        if (!['all', 'selected', 'unselected'].includes(el.dataset.view)) return;
        columnView = el.dataset.view;
        columnPage = 0;
      } else if (action === 'preview-paste') openPastePreview();
      else if (action === 'discard-paste') pasteDraft = null;
      else if (action === 'use-paste-column') usePasteColumn();
      else if (action === 'paste-column') {
        if (!pasteDraft || !Number.isInteger(index) || index < 0 || index >= pasteDraft.table.width)
          throw Error('Choose an available pasted column.');
        pasteDraft.column = index;
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
        listPrepared = true;
        pasteDraft = null;
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
      if (action === 'use-paste-column')
        document.getElementById('erList')?.focus({ preventScroll: true });
      else if ((action === 'preview-paste' || action === 'apply-filter') && pasteDraft)
        document.getElementById('erPasteColumn')?.focus();
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('#valExcelReport [data-er]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(fail);
    });
    document.addEventListener('paste', event => {
      if (
        event.target?.id !== 'erList' ||
        !event.target.closest?.('#valExcelReport') ||
        !event.clipboardData
      )
        return;
      try {
        ensure('run');
        const text = event.clipboardData.getData('text/plain'),
          html = event.clipboardData.getData('text/html');
        if (!text.trim() && !html) return;
        const table = readPastedSource(text, html);
        if (table.width > 1) {
          event.preventDefault();
          openPastePreview(text, html);
          paint();
          document.getElementById('erPasteColumn')?.focus();
        }
      } catch (error) {
        event.preventDefault();
        fail(error);
      }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (!el.closest?.('#valExcelReport')) return;
      if (el.id === 'erLiveText') {
        try {
          ensure('run');
          if (!selected.has(liveColumn))
            throw Error('Check a report column before using Live Search.');
          liveText = el.value;
          invalidate();
          clearTimeout(liveTimer);
          liveTimer = setTimeout(refreshLive, 100);
        } catch (error) {
          fail(error);
        }
        return;
      }
      if (el.id === 'erList') {
        listText = el.value;
        listPrepared = false;
        if (pasteDraft) {
          pasteDraft = null;
          paint();
        }
        return;
      }
      if (el.id === 'erColumnSearch') {
        columnSearch = el.value;
        columnPage = 0;
        paint();
      }
      if (el.id === 'erFilterSearch') {
        filterSearch = el.value;
        const options = matches(selectedColumns(), filterSearch);
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
          if (!selected.has(Number(el.value)))
            throw Error('Choose a checked report column for live search.');
          liveColumn = Number(el.value);
          invalidate();
          refreshLive();
          return;
        } else if (el.id === 'erLiveCase') {
          liveCase = el.checked;
          invalidate();
          refreshLive();
          return;
        } else if (el.id === 'erPasteColumn') {
          if (
            !pasteDraft ||
            !Number.isInteger(Number(el.value)) ||
            Number(el.value) < 0 ||
            Number(el.value) >= pasteDraft.table.width
          )
            throw Error('Choose an available pasted column.');
          pasteDraft.column = Number(el.value);
        } else if (el.id === 'erPasteHeader') {
          if (pasteDraft) pasteDraft.skipHeader = el.checked;
        } else if (el.id === 'erPasteFormat') {
          if (!pasteDraft) return;
          const table = readPastedSource(pasteDraft.text, pasteDraft.html, el.value);
          pasteDraft.table = table;
          pasteDraft.format = el.value;
          pasteDraft.column = Math.min(pasteDraft.column, table.width - 1);
        } else if (el.id === 'erFilterColumn') {
          if (!selected.has(Number(el.value)))
            throw Error('Choose a checked report column to check.');
          filterColumn = Number(el.value);
        } else if (el.id === 'erCase') caseSensitive = el.checked;
        else if (el.dataset.erColumn !== undefined) {
          const index = Number(el.dataset.erColumn);
          if (!report?.columns[index]) throw Error('Choose an available column.');
          el.checked ? selected.add(index) : selected.delete(index);
          if (
            (columnView === 'selected' && !el.checked) ||
            (columnView === 'unselected' && el.checked)
          )
            disappearingColumn = index;
          selectionChanged();
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
