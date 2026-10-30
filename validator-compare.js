/** Independent two-file comparison workspace. No template, validation run or cloud writes. */
(function (root) {
  'use strict';
  const C = root.WorkHubValidatorCompareEngine,
    F = root.WorkHubValidatorFiles;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (action, label, attrs = '', cls = 'val-secondary') =>
    `<button type="button" class="val-btn ${cls}" data-vfc="${action}" ${attrs}>${label}</button>`;
  const status = match =>
    `<span class="vfc-status ${match ? 'is-match' : 'is-different'}">${match ? 'Match' : 'Not match'}</span>`;
  const columnLabel = (source, index) =>
    index === null
      ? 'Missing column'
      : F.col(index) + ' · ' + (source.headers[index] || '(blank header)');
  const value = (text, exists) =>
    !exists
      ? '<em>Missing</em>'
      : text === ''
        ? '<em>(blank)</em>'
        : `<pre class="vfc-value">${esc(text)}</pre>`;
  function install(a) {
    const empty = () => ({
      book: null,
      name: '',
      sheetIndex: 0,
      headerRow: 1,
      mode: 'count',
      count: 0,
      skipped: [],
      data: null,
      error: '',
      reading: false,
      token: 0,
    });
    let owner = '',
      epoch = 0,
      files = { A: empty(), B: empty() },
      result = null,
      busy = false,
      exporting = false,
      message = '',
      errorMessage = false,
      filter = 'different',
      page = 0,
      selectedRow = 0;
    const can = action =>
      !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('validator', action);
    function sync() {
      const next = a.owner?.() || '';
      if (next !== owner || !a.ready()) {
        epoch++;
        owner = next;
        files = { A: empty(), B: empty() };
        result = null;
        busy = exporting = false;
        message = '';
        page = selectedRow = 0;
        filter = 'different';
      }
    }
    function ensure(action = 'run') {
      sync();
      if (!a.ready()) throw Error('Sign in to compare files.');
      if (!can(action))
        throw Error(
          'Your account does not have permission to ' +
            (action === 'export' ? 'export reports.' : 'compare files.')
        );
    }
    function invalidate() {
      epoch++;
      result = null;
      busy = exporting = false;
      page = selectedRow = 0;
    }
    function tell(text, error = false) {
      message = text;
      errorMessage = error;
    }
    function chosen(side) {
      const file = files[side];
      if (!file.data) throw Error(file.error || 'Upload Template ' + side + ' first.');
      return { ...C.selected(file.data, file), fileName: file.name };
    }
    function problem(side) {
      try {
        chosen(side);
        return '';
      } catch (error) {
        return error.message;
      }
    }
    function refresh(side, reset = false) {
      const file = files[side];
      file.data = null;
      file.error = '';
      if (!file.book) return;
      try {
        file.data = C.sheet(file.book, file.sheetIndex, Number(file.headerRow));
        if (reset) {
          file.count = 0;
          file.skipped = [];
        }
      } catch (error) {
        file.error = error.message;
      }
    }
    async function loadFile(side, file) {
      ensure();
      if (!['A', 'B'].includes(side) || !file) return;
      invalidate();
      const slot = files[side],
        token = ++slot.token,
        account = owner;
      Object.assign(slot, { name: file.name, book: null, data: null, reading: true, error: '' });
      tell('Reading Template ' + side + '…');
      a.render();
      const current = () =>
        files[side] === slot && token === slot.token && account === a.owner?.() && a.ready();
      try {
        const book = await F.read(file, { valuesOnly: true });
        if (!current()) return;
        Object.assign(slot, {
          book,
          sheetIndex: 0,
          headerRow: 1,
          mode: 'count',
          count: 0,
          skipped: [],
        });
        refresh(side);
        tell(
          slot.error || 'Template ' + side + ' is ready. Choose the columns to compare.',
          !!slot.error
        );
      } catch (error) {
        if (current()) {
          slot.error = error.message;
          tell(error.message, true);
        }
      } finally {
        if (current()) {
          slot.reading = false;
          a.render();
        }
      }
    }
    function sideView(side) {
      const file = files[side],
        locked = busy || exporting,
        disabled = locked ? ' disabled' : '',
        data = file.data,
        count = data?.headers.length || 0;
      let selection = null;
      if (data)
        try {
          selection = chosen(side);
        } catch {}
      return `<section class="val-card vfc-file" data-vfc-side="${side}" data-val-context="${side}:${file.token}:${file.sheetIndex}:${file.headerRow}">
        <div class="val-panel-title"><div><span class="val-eyebrow">UPLOAD ${side}</span><h3>Template ${side}</h3></div><span class="vfc-file-letter" aria-hidden="true">${side}</span></div>
        <label class="val-label">${file.name ? 'Replace' : 'Choose'} Template ${side}<input id="vfcFile${side}" type="file" accept=".xlsx,.csv,.tsv" data-vfc-file="${side}"${disabled}></label>
        ${file.name ? `<p class="vfc-file-name"><strong>${esc(file.name)}</strong>${file.reading ? '<small>Reading file…</small>' : data ? `<small>${data.rows.length.toLocaleString()} data rows · ${count} columns</small>` : ''}</p>` : '<p class="val-help">Excel (.xlsx), CSV or TSV · up to 50 MB</p>'}
        ${file.book ? `<div class="val-fields vfc-sheet-options"><label class="val-label">Worksheet<select name="vfcSheet${side}" data-vfc-setting="sheetIndex" data-side="${side}"${disabled}>${file.book.sheets.map((sheet, i) => `<option value="${i}"${i === file.sheetIndex ? ' selected' : ''}>${esc(sheet.name)}</option>`).join('')}</select></label><label class="val-label">Header row<input name="vfcHeader${side}" type="number" min="1" max="${file.book.sheets[file.sheetIndex]?.rows.length || 1}" value="${esc(file.headerRow)}" data-vfc-setting="headerRow" data-side="${side}"${disabled}></label></div>` : ''}
        ${
          data
            ? `<fieldset class="vfc-method"><legend>Choose how to skip columns</legend><div class="vfc-method-options">${[
                ['count', 'Enter a skip count'],
                ['checkboxes', 'Choose with checkboxes'],
              ]
                .map(
                  ([key, label]) =>
                    `<label><input type="radio" name="vfcMode${side}" value="${key}" data-vfc-setting="mode" data-side="${side}"${file.mode === key ? ' checked' : ''}${disabled}><span>${label}</span></label>`
                )
                .join('')}</div>
        ${file.mode === 'count' ? `<label class="val-label">Number of columns to skip from the left<input name="vfcCount${side}" type="number" min="0" max="${count - 1}" step="1" value="${esc(file.count)}" data-vfc-setting="count" data-side="${side}"${disabled}></label><p class="val-help">0 keeps Column A. 3 skips A, B and C, and starts at D.</p>` : `<p class="val-help">Tick the columns to skip. Unticked columns will be compared.</p><div class="val-actions">${button('skip-none', 'Keep all columns', `data-side="${side}"${disabled}`, 'val-quiet')}</div><div class="vfc-columns">${data.headers.map((header, i) => `<label class="vfc-column" for="vfcSkip${side}${i}"><input id="vfcSkip${side}${i}" type="checkbox" name="vfcSkip${side}" value="${i}" data-vfc-skip="${i}" data-side="${side}"${file.skipped.includes(i) ? ' checked' : ''}${disabled}><span><strong>${F.col(i)}</strong> ${esc(header || '(blank header)')}</span><small>${file.skipped.includes(i) ? 'Skip' : 'Compare'}</small></label>`).join('')}</div>`}</fieldset>
        ${selection ? `<p class="vfc-selection-summary">${selection.skipped.length} skipped · <strong>${selection.columns.length} columns to compare</strong> · starts at ${F.col(selection.columns[0])}</p>` : `<p class="vfc-problem" role="alert">${esc(problem(side))}</p>`}`
            : file.error
              ? `<p class="vfc-problem" role="alert">${esc(file.error)}</p>`
              : ''
        }</section>`;
    }
    function alignmentView() {
      let a, b;
      try {
        a = chosen('A');
        b = chosen('B');
      } catch {
        return '';
      }
      const width = Math.max(a.columns.length, b.columns.length);
      return `<details class="val-card vfc-alignment" id="vfcAlignment" open><summary>Column alignment · ${a.columns.length} in A / ${b.columns.length} in B</summary><p class="val-help">Remaining columns are paired in order. Headers are checked exactly as well as data values.</p>${a.columns.length !== b.columns.length ? '<p class="vfc-problem">The remaining column counts differ. Extra columns will be reported as Not match.</p>' : ''}<div class="val-table-scroll"><table class="val-grid"><thead><tr><th>Pair</th><th>Template A column</th><th>Template B column</th><th>Header comparison</th></tr></thead><tbody>${Array.from(
        { length: width },
        (_, i) => {
          const ai = a.columns[i] ?? null,
            bi = b.columns[i] ?? null;
          return `<tr><th>${i + 1}</th><td>${esc(columnLabel(a, ai))}</td><td>${esc(columnLabel(b, bi))}</td><td>${status(ai !== null && bi !== null && a.headers[ai] === b.headers[bi])}</td></tr>`;
        }
      ).join('')}</tbody></table></div></details>`;
    }
    function reportView() {
      if (!result) return '';
      const r = result,
        indices = [];
      for (let i = 0; i < r.rowCount; i++)
        if (
          filter === 'all' ||
          (filter === 'different' ? r.rowDifferences[i] > 0 : r.rowDifferences[i] === 0)
        )
          indices.push(i);
      page = Math.max(0, Math.min(page, Math.ceil(indices.length / 25) - 1));
      const shown = indices.slice(page * 25, page * 25 + 25);
      return `<section class="val-card vfc-report" id="vfcReport"><div class="val-panel-title"><div><span class="val-eyebrow">COMPARISON REPORT</span><h3 tabindex="-1" id="vfcReportTitle">${r.match ? 'The files match' : 'The files do not match'}</h3></div>${status(r.match)}</div>
        <div class="vfc-totals"><div><strong>${r.matchingRows.toLocaleString()}</strong><span>Matching data rows</span></div><div><strong>${r.differentRows.toLocaleString()}</strong><span>Rows that do not match</span></div><div><strong>${r.differentCells.toLocaleString()}</strong><span>Fields that do not match</span></div><div><strong>${r.headerDifferences}</strong><span>Headers that do not match</span></div></div>
        <p class="val-help">${esc(r.a.fileName)} ↔ ${esc(r.b.fileName)} · ${r.a.rows.length.toLocaleString()} / ${r.b.rows.length.toLocaleString()} data rows. Row results describe data values; header results are listed in Column alignment. ${!r.rowCount ? 'There are no data rows; only headers were compared.' : ''}</p>
        <div class="vfc-report-tools"><label class="val-label">Show rows<select name="vfcFilter" data-vfc-filter><option value="different"${filter === 'different' ? ' selected' : ''}>Not match</option><option value="all"${filter === 'all' ? ' selected' : ''}>All rows</option><option value="match"${filter === 'match' ? ' selected' : ''}>Match</option></select></label>${button('export', exporting ? 'Preparing report…' : 'Export comparison report', exporting || !can('export') ? 'disabled' : '')}</div>
        ${shown.length ? `<div class="val-table-scroll"><table class="val-grid vfc-row-grid"><thead><tr><th>Record</th><th>Template A row</th><th>Template B row</th><th>Matching fields</th><th>Different fields</th><th>Result</th><th>Inspect</th></tr></thead><tbody>${shown.map(i => `<tr${i === selectedRow ? ' class="vfc-selected-row"' : ''}><th>${i + 1}</th><td>${i < r.a.rows.length ? r.a.headerRow + i + 1 : 'Missing row'}</td><td>${i < r.b.rows.length ? r.b.headerRow + i + 1 : 'Missing row'}</td><td>${r.columns.length - r.rowDifferences[i]}</td><td>${r.rowDifferences[i]}</td><td>${status(!r.rowDifferences[i])}</td><td>${button('row', 'View fields', `data-row="${i}" aria-pressed="${i === selectedRow}"`, 'val-quiet')}</td></tr>`).join('')}</tbody></table></div>` : `<p class="vfc-empty">${filter === 'different' && !r.differentRows ? 'All compared data rows match. Choose All rows to inspect them.' : 'No records in this view.'}</p>`}
        <div class="val-pagination">${button('page', '← Previous', `data-delta="-1"${!page ? ' disabled' : ''}`, 'val-quiet')}<span>Page ${page + 1} of ${Math.max(1, Math.ceil(indices.length / 25))} · ${indices.length.toLocaleString()} rows</span>${button('page', 'Next →', `data-delta="1"${(page + 1) * 25 >= indices.length ? ' disabled' : ''}`, 'val-quiet')}</div>
        <p class="val-help">The Excel report includes all selected rows and fields, regardless of this filter.</p></section>${r.rowCount ? fieldsView(r, selectedRow) : ''}`;
    }
    function fieldsView(r, row) {
      return `<section class="val-card vfc-fields" id="vfcFields"><div class="val-panel-title"><div><span class="val-eyebrow">FIELD BY FIELD</span><h3 id="vfcFieldsTitle" tabindex="-1">Record ${row + 1}</h3><p class="val-help">Template A: ${esc(r.a.sheet)} · row ${row < r.a.rows.length ? r.a.headerRow + row + 1 : 'missing'} / Template B: ${esc(r.b.sheet)} · row ${row < r.b.rows.length ? r.b.headerRow + row + 1 : 'missing'}</p></div>${status(!r.rowDifferences[row])}</div><div class="val-table-scroll"><table class="val-grid vfc-field-grid"><thead><tr><th>Template A field</th><th>Template A value</th><th>Template B field</th><th>Template B value</th><th>Result</th></tr></thead><tbody>${r.columns
        .map((pair, j) => {
          const c = C.cell(r, row, j);
          return `<tr class="${c.match ? 'vfc-match' : 'vfc-difference'}"><th>${esc(columnLabel(r.a, pair.a))}</th><td>${value(c.a, c.hasA)}</td><th>${esc(columnLabel(r.b, pair.b))}</th><td>${value(c.b, c.hasB)}</td><td>${status(c.match)}</td></tr>`;
        })
        .join('')}</tbody></table></div></section>`;
    }
    function render() {
      sync();
      const reading = files.A.reading || files.B.reading,
        ready = !problem('A') && !problem('B');
      return `<div id="valStandaloneCompare"><div class="vfc-intro"><span class="val-eyebrow">TWO FILES · ONE CLEAR ANSWER</span><h2>Compare two files</h2><p>Upload Template A and Template B. Skip columns, then see exactly what matches.</p></div><div class="vfc-file-grid">${sideView('A')}${sideView('B')}</div>
        ${alignmentView()}<section class="val-card vfc-run"><div><strong>Compare in the same order</strong><p>After skipping, the first remaining column in A is compared with the first in B. Data rows are paired in their existing order, including any exploded records. Spaces, case, leading zeros and blanks are compared exactly.</p></div><div class="val-actions">${button('clear', 'Clear files', '', 'val-quiet')}${busy ? button('cancel', 'Cancel comparison') : button('run', 'Compare files', !ready || reading || exporting || !can('run') ? 'disabled' : '', 'val-primary')}</div></section>
        ${message ? `<p class="${errorMessage ? 'vfc-problem' : 'val-message'}" role="${errorMessage ? 'alert' : 'status'}" aria-live="polite">${esc(message)}</p>` : ''}${reportView()}
        <p class="val-help vfc-privacy">Formula cells use saved results, including XLOOKUP. Recalculate and save in Excel first to refresh those values. Up to 25,000 data rows and 200 columns per file. Files stay in this browser session and clear when you reload or change accounts.</p></div>`;
    }
    async function run() {
      ensure();
      if (files.A.reading || files.B.reading || busy || exporting) return;
      const left = chosen('A'),
        right = chosen('B');
      invalidate();
      const token = epoch,
        account = owner;
      busy = true;
      tell('Comparing all selected rows and fields…');
      a.render();
      const current = () => token === epoch && account === a.owner?.() && a.ready();
      try {
        const report = await C.compare(left, right, {
          pause: () => new Promise(resolve => root.setTimeout(resolve, 0)),
          cancelled: () => !current(),
        });
        if (!current()) return;
        result = report;
        filter = report.differentRows ? 'different' : 'all';
        page = 0;
        selectedRow = Math.max(
          0,
          report.rowDifferences.findIndex(n => n > 0)
        );
        tell(
          report.match
            ? 'Comparison complete. All selected headers and data values match.'
            : 'Comparison complete. Review the highlighted differences.'
        );
      } catch (error) {
        if (current() && error.name !== 'AbortError') tell(error.message, true);
      } finally {
        if (current()) {
          busy = false;
          a.render();
          root.document.getElementById('vfcReportTitle')?.focus({ preventScroll: true });
        }
      }
    }
    function reportSheets(r) {
      const styled = (v, different) => (different ? { value: v, style: 2 } : v),
        label = match => (match ? 'Match' : 'Not match'),
        missing = (source, row) =>
          row < source.rows.length ? source.headerRow + row + 1 : 'Missing row';
      return [
        {
          name: 'Comparison summary',
          widths: [36, 88],
          rows: [
            ['Comparison', 'Details'],
            ['Overall result', styled(label(r.match), !r.match)],
            ['Generated', r.generatedAt],
            [
              'Comparison policy',
              'Remaining columns and data rows are paired in their existing order. Headers and values compare exactly, including spaces, case, leading zeros and blanks.',
            ],
            [
              'Formula policy',
              'Excel formula cells use their saved results, including XLOOKUP. No formulas are evaluated or written to this report. Recalculate and save the source workbooks in Excel first to refresh their results.',
            ],
            ['Template A file', r.a.fileName],
            ['Template A worksheet', r.a.sheet],
            ['Template A header row', r.a.headerRow],
            [
              'Template A skip method',
              r.a.skipMode === 'count' ? 'Count from Column A' : 'Column checkboxes',
            ],
            ['Template A skipped columns', r.a.skipped.map(i => F.col(i)).join(', ') || 'None'],
            ['Template A data rows', r.a.rows.length],
            ['Template B file', r.b.fileName],
            ['Template B worksheet', r.b.sheet],
            ['Template B header row', r.b.headerRow],
            [
              'Template B skip method',
              r.b.skipMode === 'count' ? 'Count from Column A' : 'Column checkboxes',
            ],
            ['Template B skipped columns', r.b.skipped.map(i => F.col(i)).join(', ') || 'None'],
            ['Template B data rows', r.b.rows.length],
            ['Matching data rows', r.matchingRows],
            ['Rows that do not match', r.differentRows],
            ['Matching fields', r.matchingCells],
            ['Fields that do not match', r.differentCells],
            ['Headers that do not match', r.headerDifferences],
            [
              'Report scope',
              'All selected rows and fields. Screen filters do not limit this report. Blank rows between records are retained; fully empty trailing rows are ignored.',
            ],
          ],
        },
        {
          name: 'Column comparison',
          rows: [
            [
              'Pair',
              'Template A column',
              'Template A header',
              'Template B column',
              'Template B header',
              'Header result',
              'Different data fields',
            ],
            ...r.columns.map((pair, i) => [
              i + 1,
              pair.a === null ? 'Missing column' : F.col(pair.a),
              pair.aHeader,
              pair.b === null ? 'Missing column' : F.col(pair.b),
              pair.bHeader,
              styled(label(pair.headerMatch), !pair.headerMatch),
              pair.differences,
            ]),
          ],
        },
        {
          name: 'Row comparison',
          width: 6,
          rowCount: r.rowCount + 1,
          rows: function* () {
            yield [
              'Record',
              'Template A row',
              'Template B row',
              'Matching fields',
              'Different fields',
              'Result',
            ];
            for (let row = 0; row < r.rowCount; row++)
              yield [
                row + 1,
                missing(r.a, row),
                missing(r.b, row),
                r.columns.length - r.rowDifferences[row],
                r.rowDifferences[row],
                styled(label(!r.rowDifferences[row]), !!r.rowDifferences[row]),
              ];
          },
        },
        {
          name: 'Field comparison',
          width: 4 + r.columns.length * 3,
          rowCount: r.rowCount + 1,
          rows: function* () {
            yield [
              'Record',
              'Template A row',
              'Template B row',
              'Row result',
              ...r.columns.flatMap(pair => [
                'A · ' + columnLabel(r.a, pair.a),
                'B · ' + columnLabel(r.b, pair.b),
                'Field result',
              ]),
            ];
            for (let row = 0; row < r.rowCount; row++) {
              const out = [
                row + 1,
                missing(r.a, row),
                missing(r.b, row),
                styled(label(!r.rowDifferences[row]), !!r.rowDifferences[row]),
              ];
              for (let col = 0; col < r.columns.length; col++) {
                const c = C.cell(r, row, col);
                out.push(
                  styled(c.hasA ? c.a : '(Missing row or column)', !c.match),
                  styled(c.hasB ? c.b : '(Missing row or column)', !c.match),
                  styled(label(c.match), !c.match)
                );
              }
              yield out;
            }
          },
        },
      ];
    }
    async function exportReport() {
      ensure('export');
      if (!result || busy || exporting) throw Error('Compare the files before exporting a report.');
      const report = result,
        token = epoch,
        account = owner;
      exporting = true;
      tell('Preparing the complete Excel comparison report…');
      a.render();
      try {
        const blob = await F.workbook(reportSheets(report));
        if (token !== epoch || account !== a.owner?.() || !a.ready()) return;
        ensure('export');
        a.download(
          blob,
          'file-comparison.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        tell('Comparison report exported.');
      } catch (error) {
        if (token === epoch && account === a.owner?.() && a.ready()) tell(error.message, true);
      } finally {
        if (token === epoch && account === a.owner?.() && a.ready()) {
          exporting = false;
          a.render();
        }
      }
    }
    async function handle(el) {
      ensure(el.dataset.vfc === 'export' ? 'export' : 'run');
      const action = el.dataset.vfc;
      if (action === 'run') return run();
      if (action === 'export') return exportReport();
      if (action === 'clear') {
        invalidate();
        files = { A: empty(), B: empty() };
        tell('Files cleared.');
      } else if (action === 'cancel') {
        invalidate();
        tell('Comparison cancelled. Your files and choices are kept.');
      } else if (action === 'skip-none') {
        invalidate();
        files[el.dataset.side].skipped = [];
        tell('');
      } else if (action === 'page') {
        page += Number(el.dataset.delta);
      } else if (action === 'row') {
        selectedRow = Number(el.dataset.row);
      }
      a.render();
      if (action === 'row') {
        const title = root.document.getElementById('vfcFieldsTitle');
        title?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
        title?.focus({ preventScroll: true });
      }
    }
    function failed(error) {
      tell(error.message, true);
      a.render();
    }
    root.document.addEventListener('click', event => {
      const el = event.target.closest?.('#valStandaloneCompare [data-vfc]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(failed);
    });
    function changed(event) {
      const el = event.target;
      if (!el.closest?.('#valStandaloneCompare')) return;
      try {
        ensure();
        if (el.dataset.vfcFile) {
          if (el.files?.[0]) void loadFile(el.dataset.vfcFile, el.files[0]).catch(failed);
          return;
        }
        if (el.hasAttribute('data-vfc-filter')) {
          filter = el.value;
          page = 0;
          a.render();
          return;
        }
        const side = el.dataset.side,
          file = files[side];
        if (!file || busy || exporting) return;
        const setting = el.dataset.vfcSetting;
        if (setting || el.dataset.vfcSkip !== undefined) {
          if (['count', 'headerRow'].includes(setting) && String(file[setting]) === el.value)
            return;
          invalidate();
          tell('');
          if (setting === 'mode') file.mode = el.value;
          else if (setting === 'sheetIndex') {
            file.sheetIndex = Number(el.value);
            file.headerRow = 1;
            refresh(side, true);
          } else if (setting === 'headerRow') {
            file.headerRow = el.value;
            refresh(side, true);
          } else if (setting === 'count') file.count = el.value;
          else {
            const skipped = new Set(file.skipped),
              index = Number(el.dataset.vfcSkip);
            if (el.checked) skipped.add(index);
            else skipped.delete(index);
            file.skipped = [...skipped];
          }
          a.render();
        }
      } catch (error) {
        failed(error);
      }
    }
    root.document.addEventListener('change', changed);
    root.document.addEventListener('input', event => {
      if (['count', 'headerRow'].includes(event.target.dataset?.vfcSetting)) changed(event);
    });
    return {
      render,
      sync,
      loadFile,
      run,
      handle,
      exportReport,
      reportSheets,
      snapshot: () => ({
        result,
        busy,
        exporting,
        owner,
        files: {
          A: { name: files.A.name, reading: files.A.reading },
          B: { name: files.B.name, reading: files.B.reading },
        },
      }),
    };
  }
  root.WorkHubValidatorCompare = Object.freeze({ install });
})(window);
