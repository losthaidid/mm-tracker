/** Independent original A / exploded B workspace. No validation run or template dependency. */
(function (root) {
  'use strict';
  const C = root.WorkHubValidatorReconcileEngine,
    F = root.WorkHubValidatorFiles;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (action, label, attrs = '', cls = 'val-secondary') =>
    `<button type="button" class="val-btn ${cls}" data-vrc="${action}" ${attrs}>${label}</button>`;
  const short = label =>
    String(label ?? '').length > 160 ? String(label).slice(0, 160) + '…' : String(label ?? '');
  const option = (value, label, current) =>
    `<option value="${value}"${String(value) === String(current) ? ' selected' : ''}>${esc(short(label))}</option>`;
  const value = text =>
    text === ''
      ? '<em>(blank)</em>'
      : `<pre>${esc(text.length > 400 ? text.slice(0, 400) + '…' : text)}</pre>${text.length > 400 ? '<small>Full values are included in the report.</small>' : ''}`;
  function install(a) {
    const empty = () => ({
      name: '',
      book: null,
      data: null,
      sheetIndex: 0,
      headerRow: 1,
      startColumn: 0,
      reading: false,
      error: '',
      token: 0,
    });
    let owner = '',
      epoch = 0,
      revision = 0,
      files = { A: empty(), B: empty() },
      fields = [],
      relationship = { enabled: false, parent: -1, dependent: -1 },
      result = null,
      busy = false,
      exporting = false,
      message = '',
      errorMessage = false,
      page = 0,
      filter = 'all',
      cachedExport = null;
    const readers = new Map();
    const can = action =>
      !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('validator', action);
    function abort(side) {
      for (const [key, controller] of readers) {
        if (side && key !== side) continue;
        controller.abort();
        readers.delete(key);
      }
    }
    function closeDetail() {
      const room = root.document.querySelector('.vrc-detail');
      if (room) {
        room.replaceChildren();
        a.closeModal?.();
      }
    }
    function sync() {
      const next = a.owner?.() || '';
      if (next !== owner || !a.ready()) {
        abort();
        closeDetail();
        owner = next;
        epoch++;
        revision++;
        files = { A: empty(), B: empty() };
        fields = [];
        relationship = { enabled: false, parent: -1, dependent: -1 };
        result = null;
        cachedExport = null;
        busy = exporting = false;
        message = '';
        page = 0;
        filter = 'all';
      }
    }
    function ensure(action = 'run') {
      sync();
      if (!a.ready()) throw Error('Sign in to compare files.');
      if (!can(action))
        throw Error(
          'Your account cannot ' +
            (action === 'export'
              ? 'export reports.'
              : action === 'view'
                ? 'view this comparison.'
                : 'recombine and compare files.')
        );
    }
    function tell(text, error = false) {
      message = text;
      errorMessage = error;
    }
    function invalidate() {
      epoch++;
      revision++;
      result = null;
      cachedExport = null;
      busy = exporting = false;
      page = 0;
      closeDetail();
    }
    const starts = () => ({ A: files.A.startColumn, B: files.B.startColumn });
    const allowed = field => C.eligible(field, starts());
    const selected = field => field.key || (field.include && allowed(field));
    function updateRelationship() {
      if (
        relationship.enabled &&
        fields.some(
          f =>
            [relationship.parent, relationship.dependent].includes(f.a) && (!selected(f) || f.b < 0)
        )
      ) {
        relationship.enabled = false;
        return true;
      }
      return false;
    }
    function bulkState() {
      const free = fields.filter(f => !f.key && allowed(f)),
        count = free.filter(f => f.include).length;
      return {
        free,
        checked: free.length > 0 && count === free.length,
        mixed: count > 0 && count < free.length,
      };
    }
    function patchBulkState() {
      root.queueMicrotask(() => {
        if (owner !== a.owner?.() || !a.ready()) return;
        const checkbox = root.document?.querySelector('#valStandaloneRecombined [data-vrc-all]');
        if (checkbox) {
          const state = bulkState();
          checkbox.checked = state.checked;
          checkbox.indeterminate = state.mixed;
        }
      });
    }
    function resetMapping() {
      fields = files.A.data && files.B.data ? C.autoFields(files.A.data, files.B.data) : [];
      relationship = files.A.data
        ? C.autoRelationship(files.A.data, fields.filter(selected))
        : { enabled: false, parent: -1, dependent: -1 };
    }
    function refresh(side) {
      const slot = files[side];
      slot.data = null;
      slot.error = '';
      if (slot.book)
        try {
          slot.data = {
            ...C.sheet(slot.book, slot.sheetIndex, Number(slot.headerRow)),
            fileName: slot.name,
          };
        } catch (error) {
          slot.error = error.message;
        }
      resetMapping();
    }
    async function loadFile(side, file) {
      ensure();
      if (!['A', 'B'].includes(side) || !file) return;
      abort(side);
      invalidate();
      const slot = { ...empty(), name: file.name, reading: true, token: files[side].token + 1 },
        account = owner,
        controller = new root.AbortController();
      files[side] = slot;
      readers.set(side, controller);
      const current = () =>
        files[side] === slot && account === a.owner?.() && a.ready() && !controller.signal.aborted;
      tell('Reading File ' + side + '…');
      a.render();
      try {
        const legacy = /\.xls$/i.test(file.name);
        if (legacy && !root.WorkHubValidatorXLS) throw Error('Refresh to load XLS support.');
        const book = legacy
          ? await root.WorkHubValidatorXLS.read(file, {
              valuesOnly: true,
              signal: controller.signal,
            })
          : await F.read(file, {
              valuesOnly: true,
              identifierValues: true,
              signal: controller.signal,
            });
        if (!current()) return;
        slot.book = book;
        refresh(side);
        tell(
          slot.error || 'File ' + side + ' is ready. Review the matching keys and column mapping.',
          !!slot.error
        );
      } catch (error) {
        if (current() && error.name !== 'AbortError') {
          slot.error = error.message;
          tell(error.message, true);
        }
      } finally {
        if (readers.get(side) === controller) readers.delete(side);
        if (current()) {
          slot.reading = false;
          a.render();
        }
      }
    }
    function settings() {
      return {
        fields: fields.map(f => ({ ...f })),
        relationship: { ...relationship },
        starts: starts(),
      };
    }
    function problem() {
      try {
        if (!files.A.data || !files.B.data) return 'Upload File A and File B to continue.';
        C.configure(files.A.data, files.B.data, settings());
        return '';
      } catch (error) {
        return error.message;
      }
    }
    function configure(next) {
      ensure();
      if (busy || exporting) throw Error('Wait for the current operation.');
      let range;
      if (next.starts) {
        if (!files.A.data || !files.B.data)
          throw Error('Upload both files before choosing starting columns.');
        range = C.columnRange(files.A.data, files.B.data, { ...starts(), ...next.starts });
      }
      invalidate();
      if (range) for (const side of ['A', 'B']) files[side].startColumn = range[side];
      if (next.fields) fields = next.fields.map(f => ({ ...f }));
      if (next.relationship) relationship = { ...next.relationship };
      updateRelationship();
      tell('Settings changed. Recombine and compare again.');
      a.render();
    }
    async function run() {
      ensure();
      if (busy || exporting || files.A.reading || files.B.reading)
        throw Error('Wait for the current operation.');
      if (problem()) throw Error(problem());
      const token = ++epoch,
        account = owner,
        left = files.A.data,
        right = files.B.data,
        setup = settings();
      closeDetail();
      result = null;
      cachedExport = null;
      busy = true;
      page = 0;
      tell('Recombining File B and comparing with File A…');
      a.render();
      const current = () => token === epoch && account === a.owner?.() && a.ready();
      try {
        const report = await C.compare(left, right, setup, {
          pause: () => new Promise(resolve => root.setTimeout(resolve, 0)),
          cancelled: () => !current(),
        });
        if (!current()) return;
        ensure();
        result = report;
        tell(
          report.match
            ? 'All ' + report.rows.length + ' comparison records match.'
            : report.different + ' comparison record(s) need attention.'
        );
        return report;
      } catch (error) {
        if (current() && error.name !== 'AbortError') tell(error.message, true);
      } finally {
        if (current()) {
          busy = false;
          a.render();
          if (result)
            root.document
              .getElementById('vrcReport')
              ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        }
      }
    }
    async function exportReport() {
      ensure('export');
      if (!result || busy || exporting) throw Error('Recombine and compare before exporting.');
      const report = result,
        token = epoch,
        account = owner;
      exporting = true;
      tell('Preparing Summary and Field Comparison…');
      a.render();
      const current = () =>
        token === epoch && account === a.owner?.() && a.ready() && report === result;
      try {
        const blob =
          cachedExport?.result === report
            ? cachedExport.blob
            : await F.workbook(C.reportSheets(report));
        if (!current()) return;
        ensure('export');
        cachedExport = { result: report, blob };
        a.download(
          blob,
          'original-vs-recombined.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        tell('Comparison report exported.');
      } catch (error) {
        if (current()) tell(error.message, true);
      } finally {
        if (current()) {
          exporting = false;
          a.render();
        }
      }
    }
    function sideView(side) {
      const slot = files[side],
        disabled = busy || exporting || !can('run') ? ' disabled' : '';
      return `<section class="val-card vrc-file" data-val-context="${esc(owner)}:${side}:${slot.token}:${slot.sheetIndex}:${slot.headerRow}"><div class="val-panel-title"><div><span class="val-eyebrow">FILE ${side}</span><h3>${side === 'A' ? 'Original · one row per record' : 'Exploded / validated · multiple rows per record'}</h3></div><span class="vfc-file-letter">${side}</span></div><label class="val-label">${side === 'A' ? 'Original file A' : 'Exploded file B'}<input id="vrcFile${side}" type="file" accept=".xls,.xlsx,.csv,.tsv" data-vrc-file="${side}"${disabled}></label><p class="val-help">${esc(slot.name || 'XLS, XLSX, CSV or TSV · up to 50 MB')}${slot.reading ? ' · Reading…' : slot.data ? ' · ' + slot.data.rows.length + ' rows · ' + slot.data.headers.length + ' columns' : ''}</p>${slot.book ? `<div class="val-fields"><label class="val-label">File ${side} worksheet<select data-vrc-setting="sheetIndex" data-side="${side}"${disabled}>${slot.book.sheets.map((s, i) => option(i, s.name, slot.sheetIndex)).join('')}</select></label><label class="val-label">File ${side} header row<input type="number" min="1" max="${slot.book.sheets[slot.sheetIndex]?.rows.length || 1}" value="${esc(slot.headerRow)}" data-vrc-setting="headerRow" data-side="${side}"${disabled}></label></div>` : ''}${slot.data ? `<label class="val-label vrc-start-column">File ${side} start from column<select data-vrc-setting="startColumn" data-side="${side}"${disabled}>${slot.data.headers.map((h, i) => option(i, F.col(i) + ' · ' + (h || '(blank header)'), slot.startColumn)).join('')}</select></label><p class="val-help">Columns to the left are skipped for comparison. Matching keys remain available.</p>` : ''}${slot.error ? `<p class="vrc-error" role="alert">${esc(slot.error)}</p>` : ''}</section>`;
    }
    function mappingView() {
      if (!files.A.data || !files.B.data) return '';
      const locked = busy || exporting || !can('run'),
        disabled = locked ? ' disabled' : '',
        available = fields.filter(f => selected(f) && f.b >= 0),
        bulk = bulkState(),
        mappedB = new Set(available.map(f => f.b)),
        unmapped = files.B.data.headers.filter((_, i) => !mappedB.has(i));
      return `<section class="val-card vrc-mapping" data-val-context="${revision}"><div class="val-panel-title"><div><span class="val-eyebrow">CONNECT THE TWO FILES</span><h3>Match records, then compare their values.</h3></div><span class="val-chip">${fields.filter(f => f.key).length} matching key(s)</span></div><p class="val-help">Choose keys that stay unchanged when records are exploded. Material can be a key; add an original record ID if the same Material occurs on several original rows. Matching keys stay included and compare as exact text. Uncheck a key before excluding its field. Repeated keys in File A are flagged as ambiguous. Values keep their case and leading zeros.</p><details class="vrc-columns" open><summary>Columns and matching keys</summary><div class="val-table-scroll"><table class="val-grid"><thead><tr><th>Compare<label class="vrc-select-all"><input type="checkbox" data-vrc-all aria-label="Select all comparison columns" aria-checked="${bulk.mixed ? 'mixed' : String(bulk.checked)}"${bulk.checked ? ' checked' : ''}${locked || !bulk.free.length ? ' disabled' : ''} title="${bulk.free.length ? 'Select or clear the eligible comparison fields. Matching keys stay included.' : 'No non-key fields in the comparison range. Matching keys stay included.'}"><span>All</span></label></th><th>Matching key</th><th>File A field</th><th>File B field</th><th>Compare values as</th></tr></thead><tbody>${fields.map((f, i) => `<tr data-vrc-map-row="${i}"><td><input type="checkbox" data-vrc-field="include" data-index="${i}" aria-label="Compare ${esc(short(files.A.data.headers[f.a]))}"${selected(f) ? ' checked' : ''}${f.key || !allowed(f) || locked ? ' disabled' : ''}></td><td><input type="checkbox" data-vrc-field="key" data-index="${i}" aria-label="Matching key ${esc(short(files.A.data.headers[f.a]))}"${f.key ? ' checked' : ''}${disabled}></td><th>${esc(F.col(f.a) + ' · ' + (files.A.data.headers[f.a] || '(blank header)'))}${!allowed(f) ? '<small class="vrc-range-note">' + (f.key ? 'Matching key kept before start' : 'Skipped before starting column') + '</small>' : ''}</th><td><select data-vrc-field="b" data-index="${i}" aria-label="File B mapping for ${esc(short(files.A.data.headers[f.a]))}"${disabled}>${option(-1, 'Missing / choose a column', f.b)}${files.B.data.headers.map((h, j) => option(j, F.col(j) + ' · ' + (h || '(blank header)'), f.b)).join('')}</select></td><td><select data-vrc-field="mode" data-index="${i}" aria-label="Compare ${esc(short(files.A.data.headers[f.a]))} values as"${f.key || locked ? ' disabled' : ''}>${option('text', 'Exact text', f.key ? 'text' : f.mode)}${option('values', 'Comma-separated values', f.key ? 'text' : f.mode)}</select></td></tr>`).join('')}</tbody></table></div></details><p class="val-help">Select all affects the non-key fields within both starting-column ranges. Matching keys stay separately selected, including keys before the starts. Distinct File B values are joined with commas. Comma-list comparisons ignore list order and spaces around each item; Exact text compares the whole resulting text. Header names are labels. ${unmapped.length ? 'File B columns not compared: ' + esc(unmapped.map(short).join(', ')) + '.' : ''}</p><fieldset class="vrc-pair-options"><legend>Parent / dependent assignments</legend><label class="val-toggle"><input type="checkbox" data-vrc-pair="enabled"${relationship.enabled ? ' checked' : ''}${disabled}><span>Also compare which dependent values belong to each parent</span></label><div class="val-fields"><label class="val-label">Parent field<select data-vrc-pair="parent"${disabled}>${option(-1, 'Choose a parent field', relationship.parent)}${available.map(f => option(f.a, files.A.data.headers[f.a], relationship.parent)).join('')}</select></label><label class="val-label">Dependent field<select data-vrc-pair="dependent"${disabled}>${option(-1, 'Choose a dependent field', relationship.dependent)}${available.map(f => option(f.a, files.A.data.headers[f.a], relationship.dependent)).join('')}</select></label></div><p class="val-help">For Plant / Storage Location: File A can contain explicit (plant) groups or lists paired by position. File B should have one plant and storage location per row. Details show missing and extra distinct pairings. Other formats are flagged for review.</p></fieldset></section>`;
    }
    function reportView() {
      if (!result) return '';
      const selected = result.rows
        .map((r, i) => ({ r, i }))
        .filter(
          ({ r }) =>
            filter === 'all' || (filter === 'ambiguous' ? r.ambiguous : r.status !== 'Match')
        );
      page = Math.max(0, Math.min(page, Math.ceil(selected.length / 20) - 1));
      const shown = selected.slice(page * 20, page * 20 + 20);
      return `<section class="val-card" id="vrcReport"><div class="val-panel-title"><div><span class="val-eyebrow">${esc(result.a.fileName)} ↔ ${esc(result.b.fileName)}</span><h3>${result.match ? 'The files match.' : 'Differences need attention.'}</h3></div>${button('export', 'Download comparison report', !can('export') || exporting ? 'disabled' : '', 'val-primary')}</div><div class="val-recombined-metrics"><div><span>Original File A</span><strong>${result.a.rows.length}</strong><small>${result.b.rows.length} exploded File B rows</small></div><div class="passed"><span>Match</span><strong>${result.matched}</strong><small>${result.bGroups} recombined B keys</small></div><div class="warning"><span>Not match</span><strong>${result.different}</strong><small>${result.missing} missing · ${result.extra} extra records</small></div><div class="error"><span>Ambiguous keys</span><strong>${result.ambiguous}</strong><small>${result.blankKeys} blank-key records</small></div></div><p class="val-help">Amber marks different values, missing records and wrong assignments. Red marks keys that cannot safely identify a record. Each original File A row remains separate. The report includes all comparison records and fields; long values continue on additional rows.</p><div class="val-recombined-tools"><label class="val-label">Show records<select data-vrc-filter>${option('all', 'All records', filter)}${option('different', 'Not match / review', filter)}${option('ambiguous', 'Ambiguous original keys', filter)}</select></label><span>${selected.length} comparison record(s) · screen filters do not restrict the report</span></div><div class="val-table-scroll"><table class="val-grid val-recombined-grid"><thead><tr><th>Matching record / source</th><th>Comparison</th>${result.fields.map(f => '<th>' + esc(short(result.a.headers[f.a])) + (f.key ? '<small>Matching key</small>' : '') + '</th>').join('')}</tr></thead><tbody>${
        shown
          .map(
            ({ r, i }) =>
              `<tr data-vrc-row="${i}"><th><strong>${esc(C.rowKey(result, r).slice(0, 160))}</strong><small>A row ${r.aIndex === null ? 'Missing' : result.a.headerRow + r.aIndex + 1} · ${r.bIndices.length} B row(s)</small></th><td><span class="val-recombined-status ${r.ambiguous || r.blankKey ? 'error' : r.status === 'Match' ? 'passed' : 'warning'}">${esc(r.status)}</span>${button('detail', 'Review record', `data-index="${i}"`, 'val-quiet')}<small>${esc(C.detail(r))}</small></td>${result.fields
                .map((_, j) => {
                  const c = C.cell(result, i, j);
                  return `<td data-vrc-cell="${j}" class="${r.ambiguous || r.blankKey ? 'error' : c.match ? '' : 'val-difference'}"><small>ORIGINAL FILE A</small>${c.hasA ? value(c.a) : '<em>Missing record</em>'}<small>RECOMBINED FILE B</small>${r.ambiguous ? '<em>Unassigned — choose additional matching keys</em>' : c.hasB ? value(c.b) : '<em>Missing record / field</em>'}</td>`;
                })
                .join('')}</tr>`
          )
          .join('') ||
        '<tr><td colspan="' +
          (result.fields.length + 2) +
          '">No records match this filter.</td></tr>'
      }</tbody></table></div><div class="val-pagination">${button('page', '← Previous', `data-delta="-1"${!page ? ' disabled' : ''}`, 'val-quiet')}<span>Page ${page + 1} of ${Math.max(1, Math.ceil(selected.length / 20))}</span>${button('page', 'Next →', `data-delta="1"${(page + 1) * 20 >= selected.length ? ' disabled' : ''}`, 'val-quiet')}</div></section>`;
    }
    function detail(index) {
      ensure('view');
      const report = result,
        row = report?.rows[index];
      if (!row) throw Error('Recombine and compare again before opening this record.');
      const pairs = (label, values) =>
        `<h4>${label}</h4>${
          values.length
            ? '<div class="val-table-scroll"><table><thead><tr><th>Parent</th><th>Dependent</th></tr></thead><tbody>' +
              values
                .slice(0, 100)
                .map(p => '<tr><td>' + value(p[0]) + '</td><td>' + value(p[1]) + '</td></tr>')
                .join('') +
              '</tbody></table></div>' +
              (values.length > 100
                ? '<p>First 100 shown. The full assignments are included in the field values in the report.</p>'
                : '')
            : '<p>None.</p>'
        }`;
      a.openModal?.(
        'Comparison record ' + (index + 1) + ' · ' + row.status,
        `<section class="vrc-detail val-recombined-detail"><p><strong>${esc(C.rowKey(report, row))}</strong></p><p>${esc(C.detail(row))}</p><div class="val-table-scroll"><table><thead><tr><th>Field</th><th>File A value</th><th>Recombined File B value</th><th>Comparison</th></tr></thead><tbody>${report.fields
          .map((f, j) => {
            const c = C.cell(report, index, j);
            return `<tr class="${c.match ? '' : 'val-difference'}"><th>${esc(short(report.a.headers[f.a]))}</th><td>${value(c.a)}</td><td>${row.ambiguous ? 'Unassigned' : value(c.b)}</td><td>${esc(c.reason)}</td></tr>`;
          })
          .join(
            ''
          )}</tbody></table></div>${row.pair ? `<p>${esc(row.pair.error)}</p>${pairs('Missing assignments from File B', row.pair.missing)}${pairs('Extra assignments in File B', row.pair.extra)}` : ''}<h4>${row.ambiguous ? 'Candidate File B rows · not assigned' : 'Source rows in File B'}</h4><p>${esc(report.b.sheet)} · Excel rows ${esc(C.rowReferences(report.b, row.bIndices).slice(0, 500))}</p><div class="val-table-scroll"><table><thead><tr><th>B Excel row</th>${report.fields.map(f => '<th>' + esc(short(report.a.headers[f.a])) + '</th>').join('')}</tr></thead><tbody>${row.bIndices
          .slice(0, 50)
          .map(
            i =>
              '<tr><th>' +
              (report.b.headerRow + i + 1) +
              '</th>' +
              report.fields
                .map(
                  f =>
                    '<td>' +
                    value(f.b < 0 ? '(Missing column)' : String(report.b.rows[i]?.[f.b] ?? '')) +
                    '</td>'
                )
                .join('') +
              '</tr>'
          )
          .join(
            ''
          )}</tbody></table></div>${row.bIndices.length > 50 ? '<p>First 50 source rows shown. All distinct values are included in the report.</p>' : ''}</section>`
      );
    }
    function render() {
      sync();
      patchBulkState();
      const blocked =
        busy || exporting || files.A.reading || files.B.reading || !can('run') || problem();
      return `<div id="valStandaloneRecombined" data-access-feature="validator"><section class="val-card val-recombined-intro"><div><span class="val-eyebrow">ORIGINAL VS RECOMBINED · TWO FILES</span><h2>Two files. One clear comparison.</h2><p>Upload the original file as A and the exploded or validated file as B. Recombine B using matching keys, join distinct field values with commas, and compare against A.</p><p class="val-help">This tool works independently. Upload both files here; a validation run is not required.</p></div></section><div class="vrc-file-grid">${sideView('A')}${sideView('B')}</div>${mappingView()}<section class="val-card vrc-run"><div><strong>${busy ? 'Recombining and comparing…' : exporting ? 'Preparing report…' : 'Ready to bring the records back together.'}</strong><p class="val-help">${esc(problem() || 'Formula cells use their saved values. Only comparison results are produced; the source files stay as uploaded.')}</p></div><div class="val-actions">${button('run', 'Recombine & compare', blocked ? 'disabled' : '', 'val-primary')}${busy ? button('cancel', 'Cancel comparison') : button('clear', 'Clear files', exporting || !can('run') ? 'disabled' : '', 'val-quiet')}</div></section>${message ? `<p class="vrc-message${errorMessage ? ' vrc-error' : ''}" role="status">${esc(message)}</p>` : ''}${reportView()}</div>`;
    }
    function clear() {
      ensure();
      abort();
      invalidate();
      files = { A: empty(), B: empty() };
      fields = [];
      relationship = { enabled: false, parent: -1, dependent: -1 };
      tell('Comparison files cleared.');
      a.render();
    }
    async function handle(el) {
      const action = el.dataset.vrc;
      if (action === 'run') return run();
      if (action === 'export') return exportReport();
      if (action === 'detail') return detail(Number(el.dataset.index));
      if (action === 'clear') return clear();
      ensure('view');
      if (action === 'page') {
        page += Number(el.dataset.delta);
        a.render();
      }
      if (action === 'cancel') {
        invalidate();
        tell('Comparison cancelled. Your two uploaded files remain available.');
        a.render();
      }
    }
    function failed(error) {
      if (error.name === 'AbortError') return;
      tell(error.message, true);
      a.render();
    }
    root.document.addEventListener('click', event => {
      const el = event.target.closest?.('#valStandaloneRecombined [data-vrc]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(failed);
    });
    function changed(event) {
      const el = event.target;
      if (!el.closest?.('#valStandaloneRecombined')) return;
      try {
        if (el.hasAttribute('data-vrc-filter')) {
          ensure('view');
          filter = el.value;
          page = 0;
          a.render();
          return;
        }
        ensure();
        if (el.dataset.vrcFile) {
          const file = el.files?.[0];
          el.value = '';
          if (file) void loadFile(el.dataset.vrcFile, file).catch(failed);
          return;
        }
        if (busy || exporting) return;
        if (el.hasAttribute('data-vrc-all')) {
          invalidate();
          for (const f of bulkState().free) f.include = el.checked;
          const pairOff = updateRelationship();
          tell(
            'Comparison columns ' +
              (el.checked ? 'selected' : 'cleared') +
              '. Matching keys are kept.' +
              (pairOff
                ? ' The assignment check is off because one of its fields is excluded.'
                : '') +
              ' Recombine and compare again.'
          );
          a.render();
          return;
        }
        if (el.dataset.vrcSetting) {
          const side = el.dataset.side,
            slot = files[side],
            name = el.dataset.vrcSetting;
          if (String(slot[name]) === el.value) return;
          if (name === 'startColumn') {
            const index = Number(el.value);
            if (
              el.value === '' ||
              !slot.data ||
              !Number.isInteger(index) ||
              index < 0 ||
              index >= slot.data.headers.length
            )
              throw Error('Choose a starting column from this file’s headers.');
            invalidate();
            slot.startColumn = index;
            const pairOff = updateRelationship();
            tell(
              'Starting column changed. Matching keys and column mappings are kept.' +
                (pairOff
                  ? ' The assignment check is off because one of its fields is outside the range.'
                  : '') +
                ' Recombine and compare again.'
            );
            a.render();
            return;
          }
          invalidate();
          slot[name] = name === 'sheetIndex' ? Number(el.value) : el.value;
          if (name === 'sheetIndex') slot.headerRow = 1;
          slot.startColumn = 0;
          refresh(side);
          tell('Worksheet selection changed. Review matching keys again.');
          a.render();
          return;
        }
        if (el.dataset.vrcField) {
          const f = fields[Number(el.dataset.index)],
            name = el.dataset.vrcField;
          if (!f) return;
          invalidate();
          f[name] = ['include', 'key'].includes(name)
            ? el.checked
            : name === 'b'
              ? Number(el.value)
              : el.value;
          if (f.key) f.include = true;
          updateRelationship();
          tell('Mapping changed. Recombine and compare again.');
          a.render();
          return;
        }
        if (el.dataset.vrcPair) {
          invalidate();
          const name = el.dataset.vrcPair;
          relationship[name] = name === 'enabled' ? el.checked : Number(el.value);
          tell('Assignment check changed. Recombine and compare again.');
          a.render();
        }
      } catch (error) {
        failed(error);
      }
    }
    root.document.addEventListener('change', changed);
    root.document.addEventListener('input', event => {
      if (event.target.dataset?.vrcSetting === 'headerRow') changed(event);
    });
    root.addEventListener('pagehide', () => {
      abort();
      epoch++;
    });
    return {
      render,
      sync,
      loadFile,
      configure,
      run,
      handle,
      exportReport,
      clear,
      snapshot: () => ({
        result,
        busy,
        exporting,
        owner,
        settings: settings(),
        files: {
          A: { name: files.A.name, reading: files.A.reading, error: files.A.error },
          B: { name: files.B.name, reading: files.B.reading, error: files.B.error },
        },
      }),
    };
  }
  root.WorkHubValidatorReconcile = Object.freeze({ install });
})(window);
