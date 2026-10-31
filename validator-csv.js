/** Excel-to-CSV workspace. Uploads, formatted values and verified files stay in memory. */
(function (root) {
  'use strict';
  const F = root.WorkHubValidatorFiles;
  const LIMITS = Object.freeze({ ...F.CSV_LIMITS, outputBytes: 250000000 });
  const escape = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const pause = () => new Promise(resolve => root.setTimeout(resolve, 0));
  const safeName = (value, extension = false) =>
    String(value || 'workbook')
      .replace(extension ? /\.[^.]+$/ : /$^/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 75) || 'workbook';
  const shape = sheet => ({
    rows: sheet.rows.length,
    columns:
      sheet.width ??
      sheet.rows.reduce((n, row) => Math.max(n, row.length), sheet.rows.length ? 1 : 0),
  });
  const valueAt = (sheet, row, col) => String(sheet.rows[row]?.[col] ?? '');

  // The encoder always quotes every field. This parser verifies the actual UTF-8
  // bytes independently, including embedded quotes/newlines and blank edge rows.
  async function verify(blob, sheet, { guard = () => {}, progress = () => {} } = {}) {
    const { rows, columns } = shape(sheet),
      decoder = new root.TextDecoder('utf-8', { fatal: true });
    let state = 'field',
      cell = '',
      row = 0,
      column = 0,
      first = true,
      checked = 0;
    const fail = () => {
      throw Error(
        'CSV verification failed at worksheet row ' +
          (row + 1) +
          ', column ' +
          F.col(column) +
          '. No file will be offered.'
      );
    };
    const endCell = () => {
      if (row >= rows || column >= columns || cell !== valueAt(sheet, row, column)) fail();
      cell = '';
      column++;
      checked++;
    };
    const feed = text => {
      for (const c of text) {
        if (first) {
          first = false;
          if (c === '\uFEFF') continue;
        }
        if (state === 'field') {
          if (c !== '"') fail();
          state = 'quoted';
        } else if (state === 'quoted') {
          if (c === '"') state = 'close';
          else cell += c;
        } else if (state === 'close') {
          if (c === '"') {
            cell += '"';
            state = 'quoted';
          } else if (c === ',') {
            endCell();
            state = 'field';
          } else if (c === '\r') {
            endCell();
            if (column !== columns) fail();
            column = 0;
            row++;
            state = 'lf';
          } else fail();
        } else if (state === 'lf') {
          if (c !== '\n') fail();
          state = 'field';
        }
      }
    };
    const reader = blob.stream?.().getReader();
    try {
      if (reader) {
        let batches = 0;
        while (true) {
          guard();
          const next = await reader.read();
          if (next.done) break;
          feed(decoder.decode(next.value, { stream: true }));
          progress({ stage: 'Verifying CSV values', done: checked, total: rows * columns });
          if (++batches % 8 === 0) await pause();
        }
        feed(decoder.decode());
      } else {
        guard();
        feed(decoder.decode(await blob.arrayBuffer()));
      }
      guard();
      if (state !== 'field' || cell || column || row !== rows || checked !== rows * columns) fail();
      return { rows, columns, cells: checked, verified: true };
    } catch (error) {
      if (reader) await reader.cancel(error).catch(() => {});
      throw error;
    } finally {
      reader?.releaseLock();
    }
  }

  async function csv(sheet, { guard = () => {}, progress = () => {} } = {}) {
    const { rows, columns } = shape(sheet),
      encoder = new root.TextEncoder(),
      parts = [];
    if (rows > LIMITS.rows || columns > LIMITS.columns || rows * columns > LIMITS.cells)
      throw Error(
        'The worksheet exceeds the CSV conversion limits. No rows or columns were removed.'
      );
    let text = '\uFEFF',
      bytes = 0;
    const flush = () => {
      if (!text) return;
      const block = encoder.encode(text);
      bytes += block.length;
      if (bytes > LIMITS.outputBytes)
        throw Error('The CSV exceeds 250 MB. Use a smaller worksheet.');
      parts.push(block);
      text = '';
    };
    for (let row = 0; row < rows; row++) {
      guard();
      text +=
        Array.from(
          { length: columns },
          (_, col) => '"' + valueAt(sheet, row, col).replace(/"/g, '""') + '"'
        ).join(',') + '\r\n';
      if (text.length >= 262144) {
        flush();
        progress({
          stage: 'Creating CSV values',
          done: (row + 1) * columns,
          total: rows * columns,
        });
        await pause();
      }
    }
    flush();
    guard();
    const blob = new root.Blob(parts, { type: 'text/csv;charset=utf-8' });
    const checks = await verify(blob, sheet, { guard, progress });
    return { blob, ...checks };
  }

  async function prepare(book, selection, filename, options = {}) {
    const { guard = () => {}, progress = () => {} } = options;
    if (
      !Array.isArray(selection) ||
      !selection.length ||
      new Set(selection).size !== selection.length ||
      selection.some(i => !Number.isInteger(i) || !book.sheets[i])
    )
      throw Error('Select at least one available worksheet.');
    const indices = selection.slice().sort((a, b) => a - b),
      names = new Set(),
      files = [];
    let total = 0,
      cells = 0;
    for (const index of indices) {
      const size = shape(book.sheets[index]);
      cells += size.rows * size.columns;
    }
    if (cells > LIMITS.cells) throw Error('The selected worksheets exceed 6,000,000 cells.');
    for (const index of indices) {
      guard();
      const sheet = book.sheets[index],
        stem = safeName(filename, true) + '-' + safeName(sheet.name);
      let name = stem + '.csv',
        suffix = 1;
      while (names.has(name.toLowerCase())) name = stem + '-' + ++suffix + '.csv';
      names.add(name.toLowerCase());
      const generated = await csv(sheet, {
        guard,
        progress: p => progress({ ...p, sheet: sheet.name }),
      });
      guard();
      total += generated.blob.size;
      if (total > LIMITS.outputBytes)
        throw Error('The selected CSV files exceed 250 MB. Select fewer worksheets.');
      files.push({ ...generated, name, sheet: sheet.name });
    }
    const details = () => files.map(({ blob, ...metadata }) => metadata);
    if (files.length === 1)
      return { ...files[0], type: 'text/csv;charset=utf-8', files: details(), cells };
    if (!root.JSZip) throw Error('Refresh the page to load CSV ZIP export.');
    const archive = new root.JSZip();
    for (const file of files) {
      guard();
      const bytes = new root.Uint8Array(await file.blob.arrayBuffer());
      guard();
      archive.file(file.name, bytes, { createFolders: false, compression: 'DEFLATE' });
    }
    progress({ stage: 'Packaging verified CSV files', done: cells, total: cells });
    const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    guard();
    return {
      blob,
      name: safeName(filename, true) + '-csv.zip',
      type: 'application/zip',
      files: details(),
      cells,
      verified: true,
    };
  }

  function install(a) {
    let owner = '',
      epoch = 0,
      book = null,
      filename = '',
      selected = [],
      preview = 0,
      rowPage = 0,
      columnPage = 0,
      busy = false,
      message = '',
      problem = false,
      ready = null,
      requested = false,
      controller = null,
      progressState = null,
      lastPaint = 0;
    const can = action =>
      !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('validator', action);
    function sync() {
      const next = a.owner?.() || '';
      if (next !== owner) {
        controller?.abort();
        owner = next;
        epoch++;
        book = null;
        filename = '';
        selected = [];
        preview = rowPage = columnPage = 0;
        busy = false;
        ready = null;
        requested = false;
        message = '';
        problem = false;
        controller = null;
        progressState = null;
      }
    }
    function ensure(action = 'run') {
      sync();
      if (!a.ready()) throw Error('Sign in to use Excel to CSV.');
      if (!can(action)) throw Error('Your account cannot ' + action + ' Excel-to-CSV files.');
    }
    function guard(token, account) {
      if (token !== epoch || account !== a.owner?.() || !a.ready()) {
        const error = Error('CSV conversion cancelled because its file or account changed.');
        error.name = 'AbortError';
        throw error;
      }
    }
    const paint = () => {
      if (document.getElementById('valCSVWorkspace')) a.render();
    };
    function tell(text, error = false) {
      message = text;
      problem = error;
      a.tell?.(text, error);
    }
    function invalidate() {
      epoch++;
      ready = null;
      requested = false;
      progressState = null;
    }
    async function loadFile(file) {
      ensure();
      if (busy) throw Error('Wait for the current CSV operation, or choose Cancel.');
      invalidate();
      book = null;
      filename = file?.name || '';
      selected = [];
      preview = rowPage = columnPage = 0;
      if (!file || !/\.xlsx?$/i.test(file.name))
        throw Error('Choose an .xls or .xlsx Excel workbook.');
      const token = epoch,
        account = owner;
      controller = new root.AbortController();
      busy = true;
      tell('Reading saved Excel values and number formats…');
      paint();
      try {
        const legacy = /\.xls$/i.test(file.name);
        if (legacy && !root.WorkHubValidatorXLS)
          throw Error('Refresh the page to load XLS conversion support.');
        const loaded = legacy
          ? await root.WorkHubValidatorXLS.read(file, { signal: controller.signal })
          : await F.read(file, { displayValues: true, signal: controller.signal });
        guard(token, account);
        book = loaded;
        preview = Math.max(
          0,
          loaded.sheets.findIndex(s => s.state === 'visible')
        );
        selected = [preview];
        tell(
          'Workbook loaded. Select worksheets and review their formatted values before converting.'
        );
      } catch (error) {
        if (token === epoch && account === a.owner?.() && a.ready()) tell(error.message, true);
      } finally {
        if (token === epoch && account === a.owner?.() && a.ready()) {
          busy = false;
          controller = null;
          paint();
        }
      }
    }
    async function convert() {
      ensure();
      if (busy) throw Error('Wait for the current CSV operation.');
      if (!book) throw Error('Upload an Excel workbook first.');
      invalidate();
      const token = epoch,
        account = owner,
        chosen = selected.slice(),
        source = book;
      busy = true;
      progressState = { stage: 'Preparing CSV values', done: 0, total: 0 };
      tell('Creating CSV files and verifying every cell…');
      paint();
      try {
        const output = await prepare(source, chosen, filename, {
          guard: () => guard(token, account),
          progress(p) {
            guard(token, account);
            progressState = p;
            if (Date.now() - lastPaint > 100) {
              lastPaint = Date.now();
              paint();
            }
          },
        });
        guard(token, account);
        ready = output;
        tell(
          'Verified ' +
            output.cells.toLocaleString() +
            ' cell values across ' +
            output.files.length +
            ' worksheet(s). Your download is ready.'
        );
      } catch (error) {
        if (token === epoch && account === a.owner?.() && a.ready()) tell(error.message, true);
      } finally {
        if (token === epoch && account === a.owner?.() && a.ready()) {
          busy = false;
          progressState = null;
          paint();
        }
      }
    }
    function clear() {
      ensure();
      controller?.abort();
      invalidate();
      book = null;
      filename = '';
      selected = [];
      preview = rowPage = columnPage = 0;
      busy = false;
      controller = null;
      tell('CSV workspace cleared.');
      paint();
    }
    function download() {
      ensure('export');
      if (!ready || busy) throw Error('Convert and verify the selected worksheets first.');
      a.download(ready.blob, ready.name, ready.type);
      requested = true;
      tell('Download requested. You can choose Download again without repeating the conversion.');
      paint();
    }
    const button = (action, text, disabled = false, cls = '', attrs = '') =>
      '<button type="button" class="val-btn ' +
      cls +
      '" data-vcsv="' +
      action +
      '"' +
      (disabled ? ' disabled' : '') +
      (attrs ? ' ' + attrs : '') +
      '>' +
      text +
      '</button>';
    function render() {
      sync();
      const locked = busy || !can('run'),
        sheet = book?.sheets[preview],
        size = sheet ? shape(sheet) : null;
      const options = book?.sheets
        .map(
          (s, i) =>
            '<option value="' +
            i +
            '"' +
            (i === preview ? ' selected' : '') +
            '>' +
            escape(s.name) +
            '</option>'
        )
        .join('');
      const sample = sheet
        ? '<div class="vcsv-preview-toolbar"><label class="val-label">Preview worksheet<select id="valCSVPreviewSheet" aria-label="Preview worksheet"' +
          (busy ? ' disabled' : '') +
          '>' +
          options +
          '</select></label><span>' +
          size.rows.toLocaleString() +
          ' worksheet rows · ' +
          size.columns +
          ' columns</span></div><div class="val-table-scroll"><table class="vcsv-preview-table"><thead><tr><th>Excel row</th>' +
          Array.from(
            { length: Math.min(8, Math.max(0, size.columns - columnPage * 8)) },
            (_, i) => '<th>' + F.col(columnPage * 8 + i) + '</th>'
          ).join('') +
          '</tr></thead><tbody>' +
          Array.from(
            { length: Math.min(10, Math.max(0, size.rows - rowPage * 10)) },
            (_, i) =>
              '<tr><th>' +
              (rowPage * 10 + i + 1) +
              '</th>' +
              Array.from(
                { length: Math.min(8, Math.max(0, size.columns - columnPage * 8)) },
                (_, j) =>
                  '<td>' + escape(valueAt(sheet, rowPage * 10 + i, columnPage * 8 + j)) + '</td>'
              ).join('') +
              '</tr>'
          ).join('') +
          '</tbody></table></div><div class="val-actions vcsv-pages">' +
          button('rows-prev', '← Rows', !rowPage || busy) +
          '<span>Rows ' +
          (size.rows ? rowPage * 10 + 1 : 0) +
          '–' +
          Math.min(size.rows, rowPage * 10 + 10) +
          ' of ' +
          size.rows +
          '</span>' +
          button('rows-next', 'Rows →', (rowPage + 1) * 10 >= size.rows || busy) +
          button('cols-prev', '← Columns', !columnPage || busy) +
          '<span>Columns ' +
          (size.columns ? F.col(columnPage * 8) : '—') +
          '–' +
          (size.columns ? F.col(Math.min(size.columns - 1, columnPage * 8 + 7)) : '—') +
          ' of ' +
          size.columns +
          '</span>' +
          button('cols-next', 'Columns →', (columnPage + 1) * 8 >= size.columns || busy) +
          '</div>'
        : '';
      const notes = sheet?.notes;
      const details = notes
        ? '<div class="vcsv-notes">' +
          (notes.formulas
            ? '<p>' +
              notes.formulas +
              ' formula definition(s): saved results are used. Formulas and external links are not recalculated.</p>'
            : '') +
          (notes.localeFormats
            ? '<p>Built-in date formats can depend on Excel’s locale. Check the date preview before downloading.</p>'
            : '') +
          (notes.hiddenRows || notes.hiddenColumns
            ? '<p>Includes ' +
              notes.hiddenRows +
              ' hidden row(s) and ' +
              notes.hiddenColumns +
              ' hidden column(s).</p>'
            : '') +
          (notes.mergedRanges
            ? '<p>Merged cells retain their value in the top-left cell; the remaining positions stay blank.</p>'
            : '') +
          (notes.errors
            ? '<p>' +
              notes.errors +
              ' saved Excel error value(s), such as #N/A, will be preserved as text.</p>'
            : '') +
          '</div>'
        : '';
      return (
        '<section id="valCSVWorkspace" class="vcsv"><div class="val-section-heading"><div><span class="val-eyebrow">EXCEL IN · CSV OUT</span><h2>Excel to CSV</h2><p>Keep formatted cell values, worksheet positions and saved formula results.</p></div><div class="val-actions">' +
        button(
          'browse',
          filename ? 'Choose another Excel file' : 'Upload Excel workbook',
          locked,
          'val-primary'
        ) +
        (filename
          ? button('clear', busy ? 'Cancel' : 'Clear file', !can('run'), 'val-quiet')
          : '') +
        '</div></div><p class="val-help">Convert one .xls or .xlsx workbook locally. Select one worksheet for a CSV, or several for a ZIP of separate CSV files. The source workbook stays unchanged.</p><input id="valCSVFile" type="file" accept=".xls,.xlsx" hidden>' +
        '<div class="vcsv-message' +
        (problem ? ' vcsv-error' : '') +
        '" role="status">' +
        escape(message || 'Upload a workbook to start. No validation template is needed.') +
        '</div>' +
        (busy
          ? '<div class="vcsv-progress"><span>' +
            escape(
              progressState
                ? (progressState.sheet ? progressState.sheet + ' · ' : '') + progressState.stage
                : 'Reading workbook…'
            ) +
            '</span><progress' +
            (progressState?.total
              ? ' value="' + progressState.done + '" max="' + progressState.total + '"'
              : '') +
            ' aria-label="CSV preparation progress"></progress></div>'
          : '') +
        (book
          ? '<div class="vcsv-layout"><section class="val-card"><h3>Choose worksheets</h3><p class="val-help">' +
            escape(filename) +
            '</p><div class="val-actions">' +
            button('select-all', 'Select all', locked) +
            button('select-none', 'Deselect all', locked) +
            '</div><div class="vcsv-sheets" data-val-context="' +
            epoch +
            '">' +
            book.sheets
              .map((s, i) => {
                const d = shape(s);
                return (
                  '<label class="vcsv-sheet"><input id="valCSVSheet' +
                  i +
                  '" type="checkbox" data-vcsv-sheet="' +
                  i +
                  '"' +
                  (selected.includes(i) ? ' checked' : '') +
                  (locked ? ' disabled' : '') +
                  '><span><strong>' +
                  escape(s.name) +
                  '</strong><small>' +
                  d.rows.toLocaleString() +
                  ' rows · ' +
                  d.columns +
                  ' columns' +
                  (s.state !== 'visible' ? ' · Hidden worksheet' : '') +
                  '</small></span></label>'
                );
              })
              .join('') +
            '</div></section><section class="val-card vcsv-preview"><h3>Review formatted values</h3>' +
            sample +
            details +
            '</section></div><section class="val-card vcsv-output"><div><h3>Verify, then download</h3><p>Every CSV cell is checked against the formatted source values. Preview pages never limit the export.</p></div><div class="val-actions">' +
            button('convert', 'Convert & verify', locked || !selected.length, 'val-secondary') +
            button(
              'download',
              requested
                ? 'Download again'
                : ready?.files.length > 1
                  ? 'Download CSV ZIP'
                  : 'Download CSV',
              !ready || busy || !can('export'),
              'val-primary'
            ) +
            '</div>' +
            (ready
              ? '<p class="val-help">' +
                escape(ready.name) +
                ' · ' +
                (ready.blob.size / 1000000).toFixed(2) +
                ' MB · ' +
                ready.cells.toLocaleString() +
                ' cell values verified</p>'
              : '') +
            '</section>'
          : '') +
        '<details class="val-setup-details vcsv-guidance"><summary>Keeping values intact in Excel</summary><p>CSV stores plain text values and does not retain Excel cell types, styles, charts or images. Number and date displays follow the workbook’s stored formats, including their displayed rounding.</p><p>To preserve codes, long identifiers and formula-like text when opening the CSV in Excel, use <strong>Data → From Text/CSV</strong> and set those columns to <strong>Text</strong>. Double-clicking a CSV lets Excel guess the types.</p><p>UTF-8 with a byte-order mark preserves Unicode. Commas, quotes, spaces and embedded line breaks are quoted without adding apostrophes or formulas. Missing formula results and unsupported number formats stop conversion with a source-cell message.</p><p>Limits: 50 MB workbook · 25,001 worksheet rows · 1,000 columns · 6 million cells across the workbook · 250 MB combined CSV output.</p></details></section>'
      );
    }
    async function handle(el) {
      const action = el.dataset.vcsv;
      if (action === 'download') return download();
      ensure();
      if (action === 'clear') return clear();
      if (busy) throw Error('Wait for the current CSV operation, or choose Cancel.');
      if (action === 'browse') {
        document.getElementById('valCSVFile').click();
        return;
      }
      if (action === 'convert') return convert();
      if (!book) return;
      if (action === 'select-all' || action === 'select-none') {
        invalidate();
        selected = action === 'select-all' ? book.sheets.map((s, i) => i) : [];
        tell('Worksheet selection updated. Convert and verify before downloading.');
      }
      if (action === 'rows-prev') rowPage = Math.max(0, rowPage - 1);
      if (action === 'rows-next')
        rowPage = Math.min(
          Math.max(0, Math.ceil(shape(book.sheets[preview]).rows / 10) - 1),
          rowPage + 1
        );
      if (action === 'cols-prev') columnPage = Math.max(0, columnPage - 1);
      if (action === 'cols-next')
        columnPage = Math.min(
          Math.max(0, Math.ceil(shape(book.sheets[preview]).columns / 8) - 1),
          columnPage + 1
        );
      paint();
    }
    function failure(error) {
      sync();
      if (a.ready()) {
        tell(error.message, true);
        paint();
      }
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-vcsv]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(failure);
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (el.id === 'valCSVFile') {
        const file = el.files?.[0];
        el.value = '';
        if (file) void loadFile(file).catch(failure);
      } else if (el.id === 'valCSVPreviewSheet' || el.dataset.vcsvSheet !== undefined) {
        try {
          ensure();
          if (busy) throw Error('Wait for the current CSV operation.');
          if (el.id === 'valCSVPreviewSheet') {
            const next = Number(el.value);
            if (!Number.isInteger(next) || !book?.sheets[next])
              throw Error('Choose an available worksheet.');
            preview = next;
            rowPage = columnPage = 0;
          } else {
            const i = Number(el.dataset.vcsvSheet);
            if (!book?.sheets[i]) throw Error('Choose an available worksheet.');
            invalidate();
            selected = el.checked ? [...new Set([...selected, i])] : selected.filter(n => n !== i);
            tell('Worksheet selection updated. Convert and verify before downloading.');
          }
          paint();
        } catch (error) {
          failure(error);
        }
      }
    });
    return {
      render,
      sync,
      loadFile,
      convert,
      download,
      clear,
      handle,
      snapshot: () => ({
        owner,
        filename,
        busy,
        selected: selected.slice(),
        preview,
        message,
        problem,
        sheets: book?.sheets.map(s => ({ name: s.name, ...shape(s), notes: s.notes })) || [],
        ready: ready
          ? {
              name: ready.name,
              cells: ready.cells,
              bytes: ready.blob.size,
              files: ready.files.map(f => ({
                name: f.name,
                rows: f.rows,
                columns: f.columns,
                cells: f.cells,
              })),
            }
          : null,
      }),
    };
  }
  root.WorkHubValidatorCSV = Object.freeze({ install, csv, verify, prepare, LIMITS });
})(window);
