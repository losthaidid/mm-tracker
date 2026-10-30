/** Independent two-file comparison workspace. No template, validation run or cloud writes. */
(function (root) {
  'use strict';
  const C = root.WorkHubValidatorCompareEngine,
    F = root.WorkHubValidatorFiles;
  const QUEUE_LIMITS = Object.freeze({
    pairs: 10,
    inputBytes: 150000000,
    packedBytes: 100000000,
    reportBytes: 250000000,
    sessionText: 300000000,
  });
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
      original: null,
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
      selectedRow = 0,
      pairs = [],
      activeId = '',
      nextPair = 0,
      queueEpoch = 0,
      queueBusy = false,
      queueIO = false,
      queueStopping = false;
    const can = action =>
      !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('validator', action);
    function sync() {
      const next = a.owner?.() || '';
      if (next !== owner || !a.ready()) {
        epoch++;
        queueEpoch++;
        owner = next;
        pairs = [];
        activeId = '';
        nextPair = 0;
        queueBusy = queueIO = queueStopping = false;
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
    function invalidate(resetSetup = true) {
      epoch++;
      result = null;
      busy = exporting = false;
      page = selectedRow = 0;
      const job = activePair();
      if (job) {
        job.dirty = true;
        job.summary = null;
        job.error = '';
        if (resetSetup) {
          job.confirmed = false;
          job.status = 'needs-setup';
        }
      }
    }
    function tell(text, error = false) {
      message = text;
      errorMessage = error;
    }
    function activePair() {
      return pairs.find(job => job.id === activeId);
    }
    function idle() {
      if (queueBusy || queueIO || busy || exporting || files.A.reading || files.B.reading)
        throw Error('Wait for the current comparison operation, or stop the queue.');
    }
    function guard(token, account) {
      if (token !== queueEpoch || account !== a.owner?.() || !a.ready() || queueStopping) {
        const error = Error('The comparison queue or account changed.');
        error.name = 'AbortError';
        throw error;
      }
    }
    function makePair() {
      const number = ++nextPair;
      return {
        id: 'comparison-pair-' + number,
        name: 'Pair ' + number,
        number,
        originals: { A: null, B: null },
        versions: { A: 0, B: 0 },
        packed: null,
        confirmed: false,
        status: 'needs-setup',
        summary: null,
        error: '',
        dirty: true,
      };
    }
    function promoteCurrent() {
      if (pairs.length || (!files.A.name && !files.B.name)) return;
      const job = makePair();
      job.originals = { A: files.A.original, B: files.B.original };
      job.versions = { A: files.A.original ? 1 : 0, B: files.B.original ? 1 : 0 };
      if (result) {
        job.confirmed = true;
        job.status = 'completed';
        job.summary = reportSummary(result);
      }
      pairs.push(job);
      activeId = job.id;
    }
    function reportSummary(r) {
      return {
        match: r.match,
        rows: r.rowCount,
        differentRows: r.differentRows,
        differentCells: r.differentCells,
      };
    }
    function reportMetadata(r) {
      if (!r) return null;
      const { a: _a, b: _b, rowDifferences, ...metadata } = r;
      return { ...metadata, rowDifferences: Array.from(rowDifferences) };
    }
    async function parkCurrent(token = queueEpoch, account = owner) {
      const job = activePair();
      if (!job) return;
      job.view = { filter, page, selectedRow };
      if (!job.dirty && job.packed) return;
      const capture = {
        versions: { ...job.versions },
        files: {},
        result: reportMetadata(result),
        filter,
        page,
        selectedRow,
      };
      for (const side of ['A', 'B']) {
        const { original: _original, data: _data, reading: _reading, ...slot } = files[side];
        capture.files[side] = slot;
      }
      const text = JSON.stringify(capture);
      if (text.length > QUEUE_LIMITS.sessionText)
        throw Error(
          'This pair is too large to park. Export it and remove it before switching pairs.'
        );
      const zip = new root.JSZip();
      zip.file('pair.json', text);
      const packed = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      guard(token, account);
      if (
        pairs.reduce(
          (n, pair) => n + (pair === job ? 0 : pair.packed?.byteLength || 0),
          packed.byteLength
        ) > QUEUE_LIMITS.packedBytes
      )
        throw Error(
          'The queue has reached 100 MB of compressed working data. Download and remove completed pairs before adding more.'
        );
      job.packed = packed;
      job.dirty = false;
    }
    async function openPair(id, internal = false, action = 'run') {
      ensure(action);
      if (!internal) idle();
      const job = pairs.find(pair => pair.id === id);
      if (!job) throw Error('Choose a pair from this queue.');
      if (
        id === activeId &&
        files.A.original === job.originals.A &&
        files.B.original === job.originals.B
      )
        return;
      const token = queueEpoch,
        account = owner;
      const previousIO = queueIO;
      queueIO = true;
      a.render();
      try {
        await parkCurrent(token, account);
        guard(token, account);
        let saved = null;
        if (job.packed) {
          const zip = await root.JSZip.loadAsync(job.packed);
          guard(token, account);
          const entry = zip.file('pair.json');
          if (!entry || Number(entry._data?.uncompressedSize) > QUEUE_LIMITS.sessionText)
            throw Error('This saved comparison pair is unavailable. Upload it again.');
          const text = await entry.async('string');
          guard(token, account);
          if (text.length > QUEUE_LIMITS.sessionText)
            throw Error('This saved comparison pair is too large.');
          saved = JSON.parse(text);
        }
        guard(token, account);
        epoch++;
        result = null;
        busy = exporting = false;
        files = { A: empty(), B: empty() };
        activeId = id;
        filter = job.view?.filter || saved?.filter || 'different';
        page = job.view?.page ?? saved?.page ?? 0;
        selectedRow = job.view?.selectedRow ?? saved?.selectedRow ?? 0;
        let unchanged = !!saved;
        for (const side of ['A', 'B']) {
          if (saved && saved.versions[side] === job.versions[side]) {
            files[side] = { ...empty(), ...saved.files[side], original: job.originals[side] };
            refresh(side);
          } else unchanged = false;
          if (job.originals[side] && !files[side].original) {
            if (action === 'export') throw Error('Review ' + job.name + ' before exporting.');
            await loadFile(side, job.originals[side], true);
            guard(token, account);
          }
        }
        if (unchanged && saved.result)
          result = {
            ...saved.result,
            rowDifferences: new Uint16Array(saved.result.rowDifferences),
            a: chosen('A'),
            b: chosen('B'),
          };
        tell(
          job.error || job.name + ' opened. Review both uploads and skip settings.',
          !!job.error
        );
      } catch (error) {
        guard(token, account);
        throw error;
      } finally {
        if (token === queueEpoch && account === a.owner?.() && a.ready()) {
          queueIO = previousIO;
          a.render();
        }
      }
    }
    async function addPair() {
      ensure();
      idle();
      const count = pairs.length || (files.A.name || files.B.name ? 1 : 0);
      if (count >= QUEUE_LIMITS.pairs) throw Error('Add up to 10 comparison pairs per queue.');
      promoteCurrent();
      const job = makePair();
      pairs.push(job);
      const token = queueEpoch,
        account = owner;
      try {
        await openPair(job.id);
      } catch (error) {
        if (token === queueEpoch && account === a.owner?.() && a.ready() && activeId !== job.id) {
          pairs = pairs.filter(pair => pair !== job);
          a.render();
        }
        throw error;
      }
      return job.id;
    }
    async function addFiles(side, input) {
      ensure();
      idle();
      const token = queueEpoch,
        account = owner;
      if (!['A', 'B'].includes(side)) throw Error('Choose Template A or Template B.');
      const list = Array.from(input || []);
      if (!list.length) return;
      const originals = pairs.length
        ? pairs.flatMap(job => Object.values(job.originals))
        : [files.A.original, files.B.original];
      if (
        list.some(
          file =>
            !/\.(xlsx|csv|tsv)$/i.test(file.name) ||
            !Number.isFinite(file.size) ||
            file.size < 0 ||
            file.size > root.WorkHubValidatorEngine.LIMITS.fileBytes
        )
      )
        throw Error('Choose XLSX, CSV or TSV files below 50 MB each.');
      if (
        [...originals, ...list].reduce((n, file) => n + (file?.size || 0), 0) >
        QUEUE_LIMITS.inputBytes
      )
        throw Error('Keep the combined original files in this queue below 150 MB.');
      const currentHasFiles = files.A.name || files.B.name,
        count = pairs.length || (currentHasFiles ? 1 : 0),
        spaces = pairs.length
          ? pairs.filter(job => !job.originals[side]).length
          : currentHasFiles && !files[side].original
            ? 1
            : 0;
      if (count + Math.max(0, list.length - spaces) > QUEUE_LIMITS.pairs)
        throw Error('Add up to 10 comparison pairs per queue.');
      promoteCurrent();
      let first = '';
      for (const file of list) {
        let job = pairs.find(pair => !pair.originals[side]);
        if (!job) {
          job = makePair();
          pairs.push(job);
        }
        job.originals[side] = file;
        job.versions[side]++;
        job.confirmed = false;
        job.status = 'needs-setup';
        job.summary = null;
        job.error = '';
        job.dirty = true;
        first ||= job.id;
      }
      if (activePair() && activePair().originals[side] !== files[side].original) {
        queueIO = true;
        a.render();
        try {
          await loadFile(side, activePair().originals[side], true);
          guard(token, account);
        } finally {
          if (token === queueEpoch && account === a.owner?.() && a.ready()) {
            queueIO = false;
            a.render();
          }
        }
      } else if (!activeId) await openPair(first);
      else a.render();
      guard(token, account);
      tell('Files added in selection order. Review each A/B pairing and confirm its setup.');
      a.render();
    }
    function confirmPair() {
      ensure();
      idle();
      const job = activePair();
      if (!job) throw Error('Add a file pair to the queue first.');
      chosen('A');
      chosen('B');
      job.confirmed = true;
      job.error = '';
      job.status = result ? 'completed' : 'ready';
      job.dirty = true;
      tell(job.name + ' setup confirmed.');
      a.render();
    }
    async function startQueue() {
      ensure();
      idle();
      if (!pairs.length) throw Error('Add file pairs to the queue first.');
      if (pairs.some(job => job.status === 'needs-setup'))
        throw Error('Open each pair and confirm its setup before starting the queue.');
      const pending = pairs.filter(job => job.confirmed && job.status !== 'completed');
      if (!pending.length) throw Error('There are no confirmed pairs waiting to run.');
      const token = queueEpoch,
        account = owner;
      queueBusy = true;
      queueStopping = false;
      tell('Comparing queued file pairs…');
      a.render();
      try {
        for (const job of pending) {
          guard(token, account);
          ensure();
          try {
            await openPair(job.id, true);
            guard(token, account);
            await run(true);
            guard(token, account);
            await parkCurrent(token, account);
            guard(token, account);
          } catch (error) {
            if (error.name === 'AbortError') throw error;
            job.status = 'failed';
            job.error = error.message;
            job.summary = null;
          }
          a.render();
        }
        tell(
          'Queue finished. Open a completed pair to inspect its results or download all completed reports.'
        );
      } catch (error) {
        if (token === queueEpoch && account === a.owner?.() && a.ready())
          tell(
            queueStopping
              ? 'Queue stopped. Completed results and confirmed setups are kept.'
              : error.message,
            !queueStopping
          );
      } finally {
        if (token === queueEpoch && account === a.owner?.() && a.ready()) {
          queueBusy = queueIO = queueStopping = false;
          if (activePair()?.status === 'running')
            activePair().status = activePair().confirmed ? 'ready' : 'needs-setup';
          a.render();
        }
      }
    }
    function stopQueue() {
      ensure();
      if (!queueBusy) return;
      queueStopping = true;
      epoch++;
      busy = false;
      tell('Stopping queue…');
      a.render();
    }
    async function removePair(id) {
      ensure();
      idle();
      const current = activeId === id;
      pairs = pairs.filter(job => job.id !== id);
      if (current) {
        epoch++;
        activeId = '';
        files = { A: empty(), B: empty() };
        result = null;
        page = selectedRow = 0;
      }
      if (current && pairs.length) await openPair(pairs[0].id);
      tell('Pair removed.');
      a.render();
    }
    function clearQueue() {
      ensure();
      idle();
      queueEpoch++;
      epoch++;
      pairs = [];
      activeId = '';
      nextPair = 0;
      files = { A: empty(), B: empty() };
      result = null;
      page = selectedRow = 0;
      tell('Comparison queue cleared.');
      a.render();
    }
    const safeName = name =>
      String(name || 'file')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .slice(0, 45) || 'file';
    const reportName = job =>
      job
        ? String(job.number).padStart(2, '0') +
          '-' +
          safeName(job.originals.A?.name) +
          '--' +
          safeName(job.originals.B?.name) +
          '.xlsx'
        : 'file-comparison.xlsx';
    async function exportAll() {
      ensure('export');
      idle();
      const completed = pairs.filter(job => job.status === 'completed' && job.summary);
      if (!completed.length) throw Error('Complete a comparison pair before downloading reports.');
      const token = queueEpoch,
        account = owner,
        previous = activeId;
      queueIO = true;
      queueStopping = false;
      tell('Preparing completed comparison reports…');
      a.render();
      try {
        await parkCurrent(token, account);
        guard(token, account);
        const archive = new root.JSZip();
        let size = 0;
        for (const job of completed) {
          await openPair(job.id, true, 'export');
          guard(token, account);
          if (!result) throw Error('Review ' + job.name + ' before exporting.');
          const blob = await F.workbook(reportSheets(result, job.name));
          guard(token, account);
          size += blob.size;
          if (size > QUEUE_LIMITS.reportBytes)
            throw Error(
              'Completed reports exceed 250 MB. Download individual pair reports instead.'
            );
          const bytes = new root.Uint8Array(await blob.arrayBuffer());
          guard(token, account);
          archive.file(reportName(job), bytes, { compression: 'STORE' });
        }
        const output = await archive.generateAsync({ type: 'blob', compression: 'STORE' });
        guard(token, account);
        ensure('export');
        a.download(output, 'comparison-queue.zip', 'application/zip');
        tell(
          completed.length +
            ' completed comparison reports downloaded. Each contains Summary and Field Comparison.'
        );
      } catch (error) {
        if (token === queueEpoch && account === a.owner?.() && a.ready()) tell(error.message, true);
      } finally {
        if (token === queueEpoch && account === a.owner?.() && a.ready()) {
          const completedMessage = message,
            completedError = errorMessage;
          let restoreError = null;
          try {
            if (previous && pairs.some(job => job.id === previous))
              await openPair(previous, true, 'export');
          } catch (error) {
            restoreError = error;
          }
          if (token === queueEpoch && account === a.owner?.() && a.ready()) {
            if (restoreError) tell(restoreError.message, true);
            else tell(completedMessage, completedError);
            queueIO = false;
            a.render();
          }
        }
      }
    }
    function queueView() {
      const locked =
          queueBusy || queueIO || busy || exporting || files.A.reading || files.B.reading,
        disabled = locked || !can('run') ? 'disabled' : '',
        completed = pairs.filter(job => job.status === 'completed').length,
        ready =
          pairs.some(job => job.confirmed && job.status !== 'completed') &&
          !pairs.some(job => job.status === 'needs-setup');
      const label = job =>
        ({
          'needs-setup': 'Needs setup',
          ready: 'Ready',
          running: 'Running',
          failed: 'Failed',
          completed: job.summary?.match ? 'Match' : 'Not match',
        })[job.status];
      return `<section class="val-card vfc-queue" id="vfcQueue"><div class="val-panel-title"><div><span class="val-eyebrow">A1 ↔ B1 · A2 ↔ B2</span><h3>Comparison queue</h3><p class="val-help">Add separate A/B file pairs. Bulk uploads fill the next empty A or B slots in selection order; review each pairing before starting.</p></div><span class="val-chip">${pairs.length} / 10 pairs</span></div>
        <div class="val-actions">${button('queue-add', '＋ Add file pair', disabled)}${button('queue-upload', 'Add A files', `data-side="A" ${disabled}`)}${button('queue-upload', 'Add B files', `data-side="B" ${disabled}`)}</div>
        ${
          pairs.length
            ? `<div class="val-table-scroll"><table class="val-grid vfc-queue-table"><thead><tr><th>Pair</th><th>Template A</th><th>Template B</th><th>Status</th><th>Not match rows / fields</th><th>Actions</th></tr></thead><tbody>${pairs.map(job => `<tr class="${job.id === activeId ? 'vfc-current-pair' : ''}"><th>${esc(job.name)}${job.id === activeId ? '<small>Open pair</small>' : ''}</th><td>${esc(job.originals.A?.name || 'Choose A file')}</td><td>${esc(job.originals.B?.name || 'Choose B file')}</td><td><span class="vfc-status ${job.status === 'completed' ? (job.summary?.match ? 'is-match' : 'is-different') : ''}">${label(job)}</span>${job.error ? `<small class="vfc-queue-error">${esc(job.error)}</small>` : ''}</td><td>${job.summary ? job.summary.differentRows.toLocaleString() + ' / ' + job.summary.differentCells.toLocaleString() : '—'}</td><td><div class="val-actions">${button('queue-open', 'Open / setup', `data-id="${job.id}" ${disabled}`, 'val-quiet')}${button('queue-report', 'Report', `data-id="${job.id}" ${locked || !can('export') || job.status !== 'completed' ? 'disabled' : ''}`, 'val-quiet')}${button('queue-remove', 'Remove', `data-id="${job.id}" ${disabled}`, 'val-quiet')}</div></td></tr>`).join('')}</tbody></table></div>
        <div class="vfc-queue-footer"><span role="status">${completed} / ${pairs.length} pairs complete${queueBusy ? (queueStopping ? ' · Stopping…' : ' · Comparing…') : queueIO ? ' · Preparing pair data…' : ''}</span><div class="val-actions">${button('queue-start', 'Start queue', disabled || !ready ? 'disabled' : '', 'val-primary')}${queueBusy ? button('queue-stop', 'Stop queue', queueStopping ? 'disabled' : '') : button('queue-clear', 'Clear queue', disabled, 'val-quiet')}${button('queue-export', 'Download all reports', locked || !completed || !can('export') ? 'disabled' : '')}</div></div>`
            : ''
        }
        <p class="val-help">Up to 10 pairs · 150 MB of original files combined. Only the open pair is fully loaded; other configured pairs are compressed in this browser session.</p><input id="vfcQueueA" type="file" multiple accept=".xlsx,.csv,.tsv" data-vfc-queue-file="A" hidden><input id="vfcQueueB" type="file" multiple accept=".xlsx,.csv,.tsv" data-vfc-queue-file="B" hidden></section>`;
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
    async function loadFile(side, file, internal = false) {
      ensure();
      if (!['A', 'B'].includes(side) || !file) return;
      if (!internal && (queueBusy || queueIO))
        throw Error('Wait for the current queue operation, or stop the queue.');
      const job = activePair();
      if (job) {
        const total = pairs.reduce(
          (n, pair) =>
            n +
            ['A', 'B'].reduce(
              (size, key) =>
                size + (pair === job && key === side ? 0 : pair.originals[key]?.size || 0),
              0
            ),
          file.size
        );
        if (total > QUEUE_LIMITS.inputBytes)
          throw Error('Keep the combined original files in this queue below 150 MB.');
        if (job.originals[side] !== file) {
          job.originals[side] = file;
          job.versions[side]++;
        }
      }
      invalidate();
      const slot = files[side],
        token = ++slot.token,
        account = owner;
      Object.assign(slot, {
        name: file.name,
        original: file,
        book: null,
        data: null,
        reading: true,
        error: '',
      });
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
          const failure = files.A.error || files.B.error;
          if (job && failure) {
            job.status = 'failed';
            job.error = failure;
          }
          a.render();
        }
      }
    }
    function sideView(side) {
      const file = files[side],
        locked = busy || exporting || queueBusy || queueIO,
        disabled = locked ? ' disabled' : '',
        data = file.data,
        count = data?.headers.length || 0;
      let selection = null;
      if (data)
        try {
          selection = chosen(side);
        } catch {}
      return `<section class="val-card vfc-file" data-vfc-side="${side}" data-val-context="${activeId}:${side}:${file.token}:${file.sheetIndex}:${file.headerRow}">
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
      return `<details class="val-card vfc-alignment" id="vfcAlignment" open><summary>Column alignment · ${a.columns.length} in A / ${b.columns.length} in B</summary><p class="val-help">Remaining columns are paired in order. Header names are labels; only data values are compared.</p>${a.columns.length !== b.columns.length ? '<p class="vfc-problem">The remaining column counts differ. Extra columns will be reported as Not match.</p>' : ''}<div class="val-table-scroll"><table class="val-grid"><thead><tr><th>Pair</th><th>Template A column</th><th>Template B column</th></tr></thead><tbody>${Array.from(
        { length: width },
        (_, i) => {
          const ai = a.columns[i] ?? null,
            bi = b.columns[i] ?? null;
          return `<tr><th>${i + 1}</th><td>${esc(columnLabel(a, ai))}</td><td>${esc(columnLabel(b, bi))}</td></tr>`;
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
        <div class="vfc-totals"><div><strong>${r.matchingRows.toLocaleString()}</strong><span>Matching data rows</span></div><div><strong>${r.differentRows.toLocaleString()}</strong><span>Rows that do not match</span></div><div><strong>${r.differentCells.toLocaleString()}</strong><span>Fields that do not match</span></div><div><strong>${r.matchingCells.toLocaleString()}</strong><span>Matching fields</span></div></div>
        <p class="val-help">${esc(r.a.fileName)} ↔ ${esc(r.b.fileName)} · ${r.a.rows.length.toLocaleString()} / ${r.b.rows.length.toLocaleString()} data rows. Header names are labels and do not affect the result. ${!r.rowCount ? 'There are no data rows to compare. Only the remaining column counts were checked.' : ''}</p>
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
      return `<div id="valStandaloneCompare"><div class="vfc-intro"><span class="val-eyebrow">TWO FILES · ONE CLEAR ANSWER</span><h2>Compare two files</h2><p>Compare one A/B file pair, or queue several pairs. Skip columns, then see exactly what matches.</p></div>${queueView()}${activePair() ? `<h3 class="vfc-open-pair" id="vfcPairHeading">${esc(activePair().name)} · uploads and setup</h3>` : ''}<div class="vfc-file-grid">${sideView('A')}${sideView('B')}</div>
        ${alignmentView()}<section class="val-card vfc-run"><div><strong>Compare in the same order</strong><p>After skipping, the first remaining column in A is compared with the first in B. Data rows are paired in their existing order, including any exploded records. Spaces, case, leading zeros and blanks are compared exactly. Header names are labels only.</p></div><div class="val-actions">${button('clear', pairs.length ? 'Clear pair' : 'Clear files', queueBusy || queueIO || exporting ? 'disabled' : '', 'val-quiet')}${activePair() ? button('queue-confirm', 'Confirm pair setup', !ready || reading || busy || queueBusy || queueIO || exporting || !can('run') ? 'disabled' : '', 'val-secondary') : ''}${queueBusy ? button('queue-stop', 'Stop queue', queueStopping ? 'disabled' : '') : busy ? button('cancel', 'Cancel comparison') : button('run', 'Compare files', !ready || reading || exporting || queueIO || !can('run') ? 'disabled' : '', 'val-primary')}</div></section>
        ${message ? `<p class="${errorMessage ? 'vfc-problem' : 'val-message'}" role="${errorMessage ? 'alert' : 'status'}" aria-live="polite">${esc(message)}</p>` : ''}${reportView()}
        <p class="val-help vfc-privacy">Formula cells use saved results, including XLOOKUP. Recalculate and save in Excel first to refresh those values. Up to 25,000 data rows and 200 columns per file. Files stay in this browser session and clear when you reload or change accounts.</p></div>`;
    }
    async function run(internal = false) {
      ensure();
      if (
        files.A.reading ||
        files.B.reading ||
        busy ||
        exporting ||
        (!internal && (queueBusy || queueIO))
      )
        return;
      const left = chosen('A'),
        right = chosen('B');
      invalidate(false);
      const token = epoch,
        account = owner;
      busy = true;
      const job = activePair();
      if (job) {
        job.status = 'running';
        job.confirmed = true;
      }
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
        if (job) {
          job.summary = reportSummary(report);
          job.status = 'completed';
          job.error = '';
          job.dirty = true;
        }
        filter = report.differentRows ? 'different' : 'all';
        page = 0;
        selectedRow = Math.max(
          0,
          report.rowDifferences.findIndex(n => n > 0)
        );
        tell(
          report.match
            ? 'Comparison complete. All selected data values match.'
            : 'Comparison complete. Review the highlighted differences.'
        );
        return report;
      } catch (error) {
        if (current() && error.name !== 'AbortError') {
          tell(error.message, true);
          if (job) {
            job.status = 'failed';
            job.error = error.message;
            job.summary = null;
            job.dirty = true;
          }
        }
      } finally {
        if (current()) {
          busy = false;
          a.render();
          root.document.getElementById('vfcReportTitle')?.focus({ preventScroll: true });
        }
      }
    }
    function reportSheets(r, pairName = 'Comparison') {
      const styled = (v, different) => (different ? { value: v, style: 2 } : v),
        label = match => (match ? 'Match' : 'Not match'),
        missing = (source, row) =>
          row < source.rows.length ? source.headerRow + row + 1 : 'Missing row';
      const summaryCount = r.differentCells + (!r.rowCount ? r.extraColumns : 0);
      return [
        {
          name: 'Summary',
          width: 13,
          rowCount: summaryCount + 2,
          widths: [22, 14, 30, 20, 16, 32, 42, 30, 20, 16, 32, 42, 70],
          rows: function* () {
            yield [
              'Result',
              'Record',
              'Template A file',
              'A worksheet',
              'A row',
              'A field',
              'A value',
              'Template B file',
              'B worksheet',
              'B row',
              'B field',
              'B value',
              'Details',
            ];
            yield [
              styled(label(r.match), !r.match),
              '',
              r.a.fileName,
              r.a.sheet,
              '',
              '',
              '',
              r.b.fileName,
              r.b.sheet,
              '',
              '',
              '',
              pairName +
                ' · ' +
                r.differentRows +
                ' rows / ' +
                r.differentCells +
                ' fields do not match. ' +
                r.extraColumns +
                ' unpaired columns. ' +
                r.a.rows.length +
                ' A rows / ' +
                r.b.rows.length +
                ' B rows. ' +
                (!r.rowCount ? 'No data rows; remaining column counts checked. ' : '') +
                'Values compare exactly in order after skipping columns. Header names are labels only. Formula cells use saved values. Generated ' +
                r.generatedAt,
            ];
            for (let row = 0; row < r.rowCount; row++) {
              if (!r.rowDifferences[row]) continue;
              for (let col = 0; col < r.columns.length; col++) {
                const pair = r.columns[col],
                  c = C.cell(r, row, col);
                if (c.match) continue;
                const detail =
                  row >= r.a.rows.length
                    ? 'Missing row in Template A'
                    : row >= r.b.rows.length
                      ? 'Missing row in Template B'
                      : pair.a === null
                        ? 'Missing column in Template A'
                        : pair.b === null
                          ? 'Missing column in Template B'
                          : 'Different values';
                yield [
                  styled('Not match', true),
                  row + 1,
                  r.a.fileName,
                  r.a.sheet,
                  missing(r.a, row),
                  columnLabel(r.a, pair.a),
                  styled(c.hasA ? c.a : '(Missing row or column)', true),
                  r.b.fileName,
                  r.b.sheet,
                  missing(r.b, row),
                  columnLabel(r.b, pair.b),
                  styled(c.hasB ? c.b : '(Missing row or column)', true),
                  detail,
                ];
              }
            }
            if (!r.rowCount)
              for (const pair of r.columns)
                if (pair.a === null || pair.b === null)
                  yield [
                    styled('Not match', true),
                    '',
                    r.a.fileName,
                    r.a.sheet,
                    '',
                    columnLabel(r.a, pair.a),
                    '',
                    r.b.fileName,
                    r.b.sheet,
                    '',
                    columnLabel(r.b, pair.b),
                    '',
                    pair.a === null
                      ? 'Missing column in Template A; no data rows'
                      : 'Missing column in Template B; no data rows',
                  ];
          },
        },
        {
          name: 'Field Comparison',
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
      if (!result || busy || exporting || queueBusy || queueIO)
        throw Error('Compare the files before exporting a report.');
      const report = result,
        token = epoch,
        account = owner;
      exporting = true;
      tell('Preparing the complete Excel comparison report…');
      a.render();
      try {
        const blob = await F.workbook(reportSheets(report, activePair()?.name));
        if (token !== epoch || account !== a.owner?.() || !a.ready()) return;
        ensure('export');
        a.download(
          blob,
          reportName(activePair()),
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
      ensure(
        ['export', 'queue-export', 'queue-report'].includes(el.dataset.vfc) ? 'export' : 'run'
      );
      const action = el.dataset.vfc;
      if (action === 'queue-add') return addPair();
      if (action === 'queue-open') return openPair(el.dataset.id);
      if (action === 'queue-confirm') return confirmPair();
      if (action === 'queue-start') return startQueue();
      if (action === 'queue-stop') return stopQueue();
      if (action === 'queue-remove') return removePair(el.dataset.id);
      if (action === 'queue-clear') return clearQueue();
      if (action === 'queue-export') return exportAll();
      if (action === 'queue-report') {
        idle();
        await openPair(el.dataset.id, false, 'export');
        return exportReport();
      }
      if (action === 'queue-upload') {
        idle();
        root.document.getElementById('vfcQueue' + el.dataset.side)?.click();
        return;
      }
      if (action === 'run') return run();
      if (action === 'export') return exportReport();
      if (action === 'clear') {
        if (queueBusy || queueIO)
          throw Error('Wait for the current queue operation, or stop the queue.');
        invalidate();
        files = { A: empty(), B: empty() };
        const job = activePair();
        if (job) {
          job.originals = { A: null, B: null };
          job.versions.A++;
          job.versions.B++;
        }
        tell('Files cleared.');
      } else if (action === 'cancel') {
        if (queueBusy) {
          stopQueue();
          return;
        }
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
      if (error.name === 'AbortError' || !a.ready()) return;
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
        if (el.dataset.vfcQueueFile) {
          const list = Array.from(el.files || []);
          el.value = '';
          if (list.length) void addFiles(el.dataset.vfcQueueFile, list).catch(failed);
          return;
        }
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
        if (!file || busy || exporting || queueBusy || queueIO) return;
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
      addPair,
      addFiles,
      openPair,
      confirmPair,
      startQueue,
      stopQueue,
      removePair,
      clearQueue,
      exportAll,
      snapshot: () => ({
        result,
        busy,
        exporting,
        owner,
        activePairId: activeId,
        queueBusy,
        queueIO,
        queue: pairs.map(job => ({
          id: job.id,
          name: job.name,
          status: job.status,
          confirmed: job.confirmed,
          files: { A: job.originals.A?.name || '', B: job.originals.B?.name || '' },
          summary: job.summary,
          error: job.error,
          packedBytes: job.packed?.byteLength || 0,
          hasLiveData: job.id === activeId,
        })),
        files: {
          A: { name: files.A.name, reading: files.A.reading },
          B: { name: files.B.name, reading: files.B.reading },
        },
      }),
    };
  }
  root.WorkHubValidatorCompare = Object.freeze({ install, QUEUE_LIMITS });
})(window);
