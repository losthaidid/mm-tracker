/**
 * validator-studio.js
 * Template editor, mapping preview and validation results interface.
 * Uses validator-engine.js plus validator-files.js. Uploaded rows remain in memory.
 * Reviewed definitions/run summaries save through a.mutate(); do not store uploaded rows by accident.
 * File map: docs/FILE-MAP.md
 */
/* Validation Studio: account-owned definitions; uploaded rows stay in memory. */
(function (root) {
  'use strict';
  const E = root.WorkHubValidatorEngine,
    F = root.WorkHubValidatorFiles,
    S = root.WorkHubValidatorSetup;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const icon = (name, size = 22) =>
    '<svg width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ({
      leaf: '<path d="M19 4C8 3 3 8 6 15c5 5 13 1 13-11Z"/><path d="m5 20 10-11"/>',
      upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
      columns:
        '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M10 9v11M16 9v11"/>',
      rules:
        '<path d="M5 5h7v7h7M12 5h7M5 19h7v-7"/><circle cx="5" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="12" r="2"/>',
      check: '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/>',
      reference:
        '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4ZM20 4h-4a3 3 0 0 0-3 3"/><path d="M20 4v14h-3"/>',
      history: '<path d="M3 5v5h5M4 10a8 8 0 1 1 1 8m7-12v6l4 2"/>',
      file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 14h8M8 17h5"/>',
      spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
    }[name] || '') +
    '</svg>';
  const btn = (action, label, attrs = '', cls = '') =>
    '<button type="button" class="val-btn ' +
    cls +
    '" data-val="' +
    action +
    '" ' +
    attrs +
    '>' +
    label +
    '</button>';
  const countLabel = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const options = (rows, value) =>
    rows
      .map(
        ([v, label]) =>
          '<option value="' +
          esc(v) +
          '"' +
          (String(v) === String(value) ? ' selected' : '') +
          '>' +
          esc(label) +
          '</option>'
      )
      .join('');
  const input = (name, label, value = '', type = 'text', attrs = '') =>
    '<label class="val-label">' +
    label +
    '<input name="' +
    name +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" ' +
    attrs +
    '></label>';
  const select = (name, label, rows, value, attrs = '') =>
    '<label class="val-label">' +
    label +
    '<select name="' +
    name +
    '"' +
    (attrs ? ' ' + attrs : '') +
    '>' +
    options(rows, value) +
    '</select></label>';
  const area = (name, label, value = '', attrs = '') =>
    '<label class="val-label">' +
    label +
    '<textarea name="' +
    name +
    '" ' +
    attrs +
    '>' +
    esc(value) +
    '</textarea></label>';
  const toggle = (name, label, checked) =>
    '<label class="val-toggle"><input type="checkbox" name="' +
    name +
    '"' +
    (checked ? ' checked' : '') +
    '><span>' +
    label +
    '</span></label>';
  const stamp = s =>
    s
      ? new Date(s).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  // Group only the same check on the same field(s). Row-specific duplicate
  // pointers vary, but are presentation details of the engine's duplicate check.
  // Custom condition messages are never broadly normalized or merged by wording.
  function groupIssues(issues) {
    const groups = new Map();
    issues.forEach((issue, index) => {
      if (issue.ignored) return;
      let message = issue.message;
      const duplicate =
        issue.ruleId === 'unique' &&
        issue.rule === 'Duplicate check' &&
        /^Duplicate (?:value\.|combination: )/.test(message);
      if (duplicate) message = message.replace(/ Also appears on row \d+\.$/, '');
      const fields =
        duplicate && message.startsWith('Duplicate combination: ')
          ? message.slice('Duplicate combination: '.length).replace(/\.$/, '').split(' + ')
          : [issue.field];
      const identity = [issue.severity, fields, issue.ruleId, issue.rule, message];
      if (issue.requirementIndex !== undefined) identity.push(issue.requirementIndex);
      const key = JSON.stringify(identity);
      if (!groups.has(key))
        groups.set(key, {
          key,
          message,
          fields,
          field: issue.field,
          column: issue.column,
          ruleId: issue.ruleId,
          rule: issue.rule,
          severity: issue.severity,
          entries: [],
          rowSet: new Set(),
        });
      const group = groups.get(key);
      group.entries.push({ issue, index });
      group.rowSet.add(issue.index);
    });
    return [...groups.values()]
      .map(({ rowSet, ...group }) => ({ ...group, indices: [...rowSet].sort((a, b) => a - b) }))
      .sort(
        (a, b) =>
          (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) ||
          b.indices.length - a.indices.length ||
          b.entries.length - a.entries.length ||
          a.column.localeCompare(b.column) ||
          a.message.localeCompare(b.message) ||
          a.key.localeCompare(b.key)
      );
  }
  function install(a) {
    const $ = id => document.getElementById(id),
      store = () => a.state().workhub.validator;
    const runner = root.WorkHubValidatorRunner?.create();
    let owner = '',
      generation = 0,
      draft = null,
      selected = '',
      baseStamp = '',
      dirty = false,
      mode = 'columns',
      columnId = '',
      ruleId = '',
      columnGroupId = '',
      valueSetId = '',
      message = '',
      search = '',
      book = null,
      sheetIndex = 0,
      headerRow = 1,
      headers = [],
      sourceRows = [],
      originalRows = [],
      preparedRows = [],
      origins = [],
      comparisonCache = null,
      comparisonFilter = 'changes',
      comparisonField = 'all',
      comparisonRow = '',
      comparisonPage = 0,
      preparation = null,
      preparationSteps = [],
      preparationUndo = [],
      mapping = {},
      rows = [],
      result = null,
      rawResult = null,
      currentRunId = '',
      ignoreReason = '',
      issuePage = 0,
      ignoredPage = 0,
      attentionGroup = null,
      attentionSearch = '',
      attentionSeverity = 'all',
      attentionPage = 0,
      attentionCache = null,
      roomyReview = false,
      resultSchema = null,
      version = 'draft',
      runCompanyId = '',
      runSelection = null,
      runProfileId = '',
      setupSearch = '',
      setupReferenceSearch = '',
      extraReferenceChoices = [],
      fileName = '',
      filter = 'all',
      page = 0,
      busy = false,
      refEditing = '',
      referenceEpoch = 0,
      targetRow = -1,
      selectedIssue = null,
      setupPreview = null,
      copyPreview = null,
      correction = null,
      liveTimer = null,
      livePending = false,
      liveCheck = null,
      fileQueue = [],
      queueActiveId = '',
      queueEpoch = 0,
      queueBusy = false,
      queueIO = false,
      queueInternal = false,
      queueStop = false,
      pinnedRows = new Set(),
      ignoredIssues = new Map(),
      issueSelection = new Set();
    function resetReview() {
      rawResult = null;
      currentRunId = '';
      ignoreReason = '';
      issuePage = 0;
      ignoredPage = 0;
      attentionGroup = null;
      attentionSearch = '';
      attentionSeverity = 'all';
      attentionPage = 0;
      attentionCache = null;
      ignoredIssues.clear();
      issueSelection.clear();
    }
    function resetQueue() {
      queueEpoch++;
      fileQueue = [];
      queueActiveId = '';
      queueBusy = false;
      queueIO = false;
      queueStop = true;
      queueInternal = false;
    }
    function queueAccess(action = 'run') {
      ensure();
      if (root.WorkHubCurrentAccess && !root.WorkHubCurrentAccess.can('validator', action))
        throw Error('Your account cannot ' + action + ' validation files.');
    }
    function queueStamp() {
      return JSON.stringify({ version, schema: activeSchema() });
    }
    function queueConfig() {
      return JSON.stringify({
        sheetIndex,
        headerRow,
        mapping,
        runCompanyId,
        runSelection: setupChoices(),
        steps: preparationSteps,
      });
    }
    function activeQueueJob() {
      return fileQueue.find(j => j.id === queueActiveId);
    }
    function queueStatus(job) {
      if (job.status === 'running' || job.status === 'failed') return job.status;
      if (job.id === queueActiveId && book) {
        if (job.schema !== queueStamp() || job.config !== queueConfig()) return 'needs-review';
        if (job.error) return 'failed';
        return result && !livePending ? 'completed' : 'ready';
      }
      if (job.schema !== queueStamp()) return 'needs-review';
      return job.status;
    }
    function queueGuard(epoch, account) {
      if (epoch !== queueEpoch || account !== a.owner?.() || !a.ready()) {
        const error = Error('The queue or account changed.');
        error.name = 'AbortError';
        throw error;
      }
    }
    function queueCapture() {
      const baseline = preparationSteps.length ? preparedRows : originalRows,
        diffs = [];
      sourceRows.forEach((row, i) =>
        row.forEach((value, j) => {
          if (value !== baseline[i]?.[j]) diffs.push([i, j, value]);
        })
      );
      return {
        book,
        sheetIndex,
        headerRow,
        headers,
        mapping,
        preparedRows: preparationSteps.length ? preparedRows : null,
        diffs,
        origins,
        preparationSteps,
        preparationUndo,
        runCompanyId,
        runSelection,
        runProfileId,
        extraReferenceChoices,
        rawResult,
        resultSchema,
        currentRunId,
        ignored: [...ignoredIssues],
        schemaStamp: queueStamp(),
      };
    }
    async function queueSaveCurrent() {
      const job = activeQueueJob();
      if (!job || !book) return;
      const epoch = queueEpoch,
        account = owner;
      if (livePending) await checkEdit();
      queueGuard(epoch, account);
      if (livePending) throw Error('Wait for the current edit to finish checking.');
      const config = queueConfig();
      if (
        job.savedGeneration === generation &&
        job.savedResult === result &&
        job.savedConfig === config
      )
        return;
      const serialized = JSON.stringify(queueCapture());
      if (serialized.length > 300000000)
        throw Error(
          'This prepared session is too large to park in the queue. Export it before switching files.'
        );
      if (!root.JSZip) throw Error('Refresh the page to load queue storage.');
      const archive = new root.JSZip();
      archive.file('session.json', serialized);
      const packed = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      queueGuard(epoch, account);
      if (
        fileQueue.reduce((n, j) => n + (j.id === job.id ? 0 : j.packed?.size || 0), packed.size) >
        100000000
      )
        throw Error(
          'The queue has reached 100 MB of compressed working data. Download and remove completed files before adding more work.'
        );
      job.packed = packed;
      job.status = queueStatus(job);
      job.savedGeneration = generation;
      job.savedResult = result;
      job.savedConfig = config;
      job.setupSummary = {
        rows: sourceRows.length,
        company: a.state().projectCompanies.find(c => c.id === runCompanyId)?.name || 'Standalone',
        errors: '—',
        warnings: '—',
      };
      job.summary = result
        ? {
            rows: result.rows,
            passed: result.passed,
            errors: result.errors,
            warnings: result.warnings,
            ignored: result.ignored || 0,
            company: result.context?.companyName || 'Standalone',
          }
        : null;
    }
    function restoreQueueSession(session, job) {
      cancelLive();
      runner?.cancel();
      generation++;
      closePreparation();
      pinnedRows.clear();
      resetReview();
      comparisonCache = null;
      book = session.book;
      sheetIndex = session.sheetIndex;
      headerRow = session.headerRow;
      headers = session.headers;
      mapping = session.mapping;
      originalRows = book.sheets[sheetIndex].rows
        .slice(headerRow)
        .map(r => Array.from({ length: headers.length }, (_, i) => String(r[i] ?? '')));
      while (originalRows.length && originalRows.at(-1).every(E.blank)) originalRows.pop();
      preparationSteps = session.preparationSteps;
      preparationUndo = session.preparationUndo;
      preparedRows = session.preparedRows || originalRows.map(r => r.slice());
      sourceRows = preparedRows.map(r => r.slice());
      for (const [i, j, value] of session.diffs) sourceRows[i][j] = value;
      origins = session.origins;
      runCompanyId = session.runCompanyId;
      runSelection = session.runSelection;
      runProfileId = session.runProfileId;
      extraReferenceChoices = session.extraReferenceChoices;
      rawResult = session.rawResult;
      resultSchema = session.resultSchema;
      currentRunId = session.currentRunId;
      for (const [key, value] of session.ignored) ignoredIssues.set(key, value);
      const fresh = session.schemaStamp === queueStamp();
      if (!fresh) {
        rawResult = null;
        resultSchema = null;
        currentRunId = '';
        runSelection = null;
        runProfileId = '';
        ignoredIssues.clear();
        job.config = '';
        job.schema = '';
      }
      try {
        rows = E.mapRows(headers, sourceRows, resultSchema || activeSchema(), mapping);
        if (resultSchema) E.runContext(a.state(), resultSchema, runCompanyId);
        result = rawResult ? reviewed(rawResult) : null;
      } catch {
        rows = [];
        result = null;
        rawResult = null;
        resultSchema = null;
        job.config = '';
      }
      fileName = job.file.name;
      filter = 'all';
      page = 0;
      selectedIssue = null;
      targetRow = -1;
      mode = 'check';
      busy = false;
      job.savedGeneration = generation;
      job.savedResult = result;
      job.savedConfig = queueConfig();
    }
    async function addQueueFiles(files) {
      queueAccess();
      if (queueBusy || queueIO || busy || livePending)
        throw Error('Finish the current operation before adding files.');
      const list = Array.from(files || []);
      if (!list.length) return;
      if (fileQueue.length + list.length > 10) throw Error('Add up to 10 files per queue.');
      if (
        fileQueue.reduce((n, j) => n + j.file.size, 0) + list.reduce((n, f) => n + f.size, 0) >
        150000000
      )
        throw Error('A queue supports up to 150 MB of original files.');
      for (const f of list)
        if (!/\.(xlsx|csv|tsv)$/i.test(f.name) || f.size > E.LIMITS.fileBytes)
          throw Error('Choose XLSX, CSV or TSV files up to 50 MB each.');
      if (
        !fileQueue.length &&
        book &&
        !root.confirm(
          'Start a file queue? Download the current single-file results first if you need them.'
        )
      )
        return;
      const empty = !fileQueue.length;
      for (const file of list)
        fileQueue.push({
          id: E.uid(),
          file,
          status: 'needs-review',
          schema: '',
          config: '',
          error: '',
          packed: null,
          summary: null,
        });
      if (empty) await openQueueJob(fileQueue[0].id);
      else paint();
    }
    async function openQueueJob(id, internal = false) {
      queueAccess();
      if ((queueBusy || queueIO || busy) && !internal)
        throw Error('Wait for the current queue operation.');
      const job = fileQueue.find(j => j.id === id);
      if (!job) throw Error('Choose a current queue file.');
      if (!internal && id === queueActiveId && book) {
        $('valDropzone')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        return;
      }
      const epoch = queueEpoch,
        account = owner,
        wasIO = queueIO,
        previous = activeQueueJob();
      queueIO = true;
      paint();
      try {
        await queueSaveCurrent();
        queueGuard(epoch, account);
        if (job.packed) {
          const archive = await root.JSZip.loadAsync(
            new root.Uint8Array(await job.packed.arrayBuffer())
          );
          const session = JSON.parse(await archive.file('session.json').async('string'));
          queueGuard(epoch, account);
          restoreQueueSession(session, job);
          queueActiveId = id;
        } else {
          queueInternal = true;
          try {
            await loadFile(job.file);
          } finally {
            queueInternal = false;
          }
          queueGuard(epoch, account);
          queueActiveId = id;
          runCompanyId = '';
          runSelection = null;
          runProfileId = '';
          job.status = 'needs-review';
          job.error = '';
        }
        if (previous && previous !== job) previous.savedResult = null;
        say(
          'Review ' +
            job.file.name +
            ': company, worksheet, mapping and preparation, then Confirm file setup.'
        );
      } catch (error) {
        if (epoch === queueEpoch && account === a.owner?.()) {
          job.error = error.message;
          job.status = 'failed';
        }
        throw error;
      } finally {
        if (epoch === queueEpoch && account === a.owner?.()) {
          queueIO = wasIO;
          paint();
        }
      }
    }
    function confirmQueueJob() {
      queueAccess();
      if (queueBusy || queueIO || busy || livePending)
        throw Error('Wait for the current operation.');
      const job = activeQueueJob();
      if (!job || !book) throw Error('Open a queue file first.');
      const schema = activeSchema();
      E.checkSchema(schema);
      E.runContext(a.state(), schema, runCompanyId);
      setupPlan(schema);
      if (!E.mapRows(headers, sourceRows, schema, mapping).length)
        throw Error('Choose a file with at least one data record.');
      job.schema = queueStamp();
      job.config = queueConfig();
      job.error = '';
      job.status = result ? 'completed' : 'ready';
      say('File setup confirmed. Configure the next file or Start queue.');
      paint();
    }
    function cancelQueue() {
      if (!queueBusy && !queueIO) return;
      queueStop = true;
      queueEpoch++;
      generation++;
      runner?.cancel();
      cancelLive();
      busy = false;
      const job = activeQueueJob();
      if (job?.status === 'running') {
        job.status = 'ready';
        job.error = '';
      }
      queueBusy = false;
      queueIO = false;
      say('Queue stopped. Completed results and remaining file setups are retained.');
      paint();
    }
    async function startQueue() {
      queueAccess();
      if (queueBusy || queueIO || busy) throw Error('Wait for the current operation.');
      if (!fileQueue.length) throw Error('Add files to the queue first.');
      if (fileQueue.some(j => !['ready', 'completed'].includes(queueStatus(j))))
        throw Error('Open and confirm every file setup before starting the queue.');
      const pending = fileQueue.filter(j => queueStatus(j) === 'ready');
      if (!pending.length) throw Error('All configured files already have current results.');
      queueBusy = true;
      queueStop = false;
      const account = owner,
        epoch = queueEpoch;
      paint();
      try {
        await queueSaveCurrent();
        queueGuard(epoch, account);
        for (const job of pending) {
          if (queueStop || epoch !== queueEpoch || account !== a.owner?.() || !a.ready()) break;
          try {
            await openQueueJob(job.id, true);
            if (queueStop) break;
            job.status = 'running';
            paint();
            await run();
            if (queueStop || epoch !== queueEpoch || account !== a.owner?.() || !a.ready()) break;
            if (!result) throw Error('Validation did not finish. Review this file and try again.');
            job.status = 'completed';
            await queueSaveCurrent();
          } catch (error) {
            if (queueStop || epoch !== queueEpoch || account !== a.owner?.() || !a.ready()) break;
            job.status = 'failed';
            job.error = error.message;
            job.summary = null;
          }
          paint();
        }
      } finally {
        if (epoch === queueEpoch && account === a.owner?.()) {
          queueBusy = false;
          queueIO = false;
          if (!queueStop)
            say(
              'Queue finished. Open any file to review its records or download completed reports.'
            );
          paint();
        }
      }
    }
    async function exportQueue() {
      queueAccess('export');
      if (queueBusy || queueIO || busy) throw Error('Wait for the current operation.');
      const epoch = queueEpoch,
        account = owner;
      queueIO = true;
      paint();
      try {
        await queueSaveCurrent();
        queueGuard(epoch, account);
        const completed = fileQueue.filter(j => queueStatus(j) === 'completed');
        if (!completed.length) throw Error('There are no current completed reports to download.');
        const archive = new root.JSZip(),
          summary = [
            [
              'File',
              'Status',
              'Company',
              'Rows',
              'Rows without errors',
              'Errors',
              'Warnings',
              'Report',
            ],
          ];
        for (const [i, job] of fileQueue.entries()) {
          let name = '';
          if (completed.includes(job)) {
            await openQueueJob(job.id, true);
            queueGuard(epoch, account);
            if (!result || livePending)
              throw Error('Review ' + job.file.name + ' before exporting.');
            E.runContext(a.state(), resultSchema, runCompanyId);
            const outcome = E.copy(result);
            outcome.issues.forEach(x => (x.row = headerRow + x.index + 1));
            const blob = await F.report(resultSchema, rows, outcome, false, {
              ...comparisonUpload(),
              comparisonFirst: true,
            });
            queueGuard(epoch, account);
            name =
              String(i + 1).padStart(2, '0') +
              '-' +
              safeName(job.file.name.replace(/\.[^.]+$/, '')) +
              '-comparison.xlsx';
            archive.file(name, new root.Uint8Array(await blob.arrayBuffer()), {
              compression: 'STORE',
            });
          }
          const s = job.summary;
          summary.push([
            job.file.name,
            queueStatus(job),
            s?.company || '',
            s?.rows || '',
            s?.passed ?? '',
            s?.errors ?? '',
            s?.warnings ?? '',
            name || job.error || '',
          ]);
        }
        const overview = await F.workbook([{ name: 'Queue summary', rows: summary }]);
        archive.file('Queue-summary.xlsx', new root.Uint8Array(await overview.arrayBuffer()), {
          compression: 'STORE',
        });
        const output = await archive.generateAsync({ type: 'blob', compression: 'STORE' });
        queueGuard(epoch, account);
        a.download(
          output,
          safeName(activeSchema().name) + '-validation-queue.zip',
          'application/zip'
        );
        say(completed.length + ' completed report(s) downloaded, with the queue summary.');
      } finally {
        if (epoch === queueEpoch && account === a.owner?.()) {
          queueIO = false;
          paint();
        }
      }
    }
    function queueView() {
      const labels = {
        'needs-review': 'Review setup',
        ready: 'Ready',
        running: 'Validating',
        completed: 'Completed',
        failed: 'Needs review',
      };
      const locked = queueBusy || queueIO,
        statuses = fileQueue.map(queueStatus),
        done = statuses.filter(status => status === 'completed').length,
        review = statuses.filter(
          status => !['ready', 'completed', 'running'].includes(status)
        ).length,
        canStart = !locked && !review && statuses.includes('ready');
      return `<section id="valFileQueue" class="val-card val-file-queue"><div class="val-panel-title"><div><span class="val-eyebrow">MULTIPLE FILES · ONE TEMPLATE</span><h3>File validation queue</h3><p class="val-help">Review each file’s company, mapping and preparation. Files run one at a time; their records and results stay separate.</p></div>${btn('queue-add', 'Add files', locked ? 'disabled' : '', 'val-secondary')}</div>
      ${
        fileQueue.length
          ? `<div class="val-queue-progress"><strong>${done} / ${fileQueue.length} files complete</strong><progress value="${done}" max="${fileQueue.length}" aria-label="Files completed"></progress><span>${queueBusy ? 'Processing queue…' : queueIO ? 'Preparing file data…' : review ? 'Confirm setup for ' + review + ' file(s) before starting' : 'Up to 10 files · 25,000 records per file'}</span></div><div class="val-table-scroll"><table class="val-queue-table"><thead><tr><th>File</th><th>Company</th><th>Status</th><th>Rows</th><th>Errors / warnings</th><th>Review</th></tr></thead><tbody>${fileQueue
              .map(job => {
                const status = queueStatus(job),
                  current = job.id === queueActiveId,
                  s =
                    current && book
                      ? {
                          rows: sourceRows.length,
                          errors: result?.errors ?? '—',
                          warnings: result?.warnings ?? '—',
                          company:
                            a.state().projectCompanies.find(c => c.id === runCompanyId)?.name ||
                            (activeSchema().projectId ? 'Choose in file setup' : 'Standalone'),
                        }
                      : job.summary || job.setupSummary;
                return `<tr class="${current ? 'is-current' : ''}" data-queue-row="${esc(job.id)}"><th>${esc(job.file.name)}${current ? '<small>Currently open</small>' : ''}${job.error ? '<small class="val-queue-error">' + esc(job.error) + '</small>' : ''}</th><td>${esc(s?.company || 'Choose in file setup')}</td><td><span class="val-queue-state ${status}">${labels[status]}</span></td><td>${s?.rows ?? '—'}</td><td>${s ? s.errors + ' / ' + s.warnings : '—'}</td><td>${btn('queue-open', current ? 'Open file' : status === 'completed' ? 'Review results' : 'Configure / review', 'data-id="' + esc(job.id) + '"' + (locked ? ' disabled' : ''), 'val-quiet')}${btn('queue-remove', 'Remove', 'data-id="' + esc(job.id) + '"' + (locked ? ' disabled' : ''), 'val-quiet')}</td></tr>`;
              })
              .join(
                ''
              )}</tbody></table></div><div class="val-actions val-queue-actions">${btn('queue-confirm', 'Confirm file setup', locked || !activeQueueJob() ? 'disabled' : '', 'val-secondary')}${btn('queue-start', 'Start queue', canStart ? '' : 'disabled', 'val-primary')}${btn('queue-export', 'Download completed reports', locked || !done ? 'disabled' : '', 'val-secondary')}${locked ? btn('queue-cancel', 'Stop queue', '', 'val-secondary') : btn('queue-clear', 'Clear queue', '', 'val-quiet')}</div><p class="val-help">Completed reports include original, prepared and validated values. Queue files and compressed working sessions stay in this browser’s memory and clear on reload or account change.</p>`
          : '<p class="val-help">Add up to 10 XLSX, CSV or TSV files. Each file can contain up to 25,000 records and 200 columns. Start by reviewing the first file.</p>'
      }</section>`;
    }
    function closePreparation() {
      preparation = null;
      const room = document.querySelector('.val-preparation-room');
      if (room) {
        room.replaceChildren();
        a.closeModal?.();
      }
    }
    function resetPreparation() {
      closePreparation();
      originalRows = [];
      preparedRows = [];
      origins = [];
      comparisonCache = null;
      comparisonFilter = 'changes';
      comparisonField = 'all';
      comparisonRow = '';
      comparisonPage = 0;
      roomyReview = false;
      preparationSteps = [];
      preparationUndo = [];
    }
    function prepareAccess() {
      ensure();
      if (root.WorkHubCurrentAccess && !root.WorkHubCurrentAccess.can('validator', 'run'))
        throw Error('Preparing uploaded data is disabled for this account.');
      if (!root.WorkHubValidatorTransform)
        throw Error('Refresh the page to load the preparation tools.');
      if (busy) throw Error('Wait for the current operation to finish.');
      if (!book || !sourceRows.length) throw Error('Upload or paste data first.');
    }
    function preparationOptions(form) {
      if (preparation.kind === 'sap')
        return Object.fromEntries(
          [...form.querySelectorAll('[data-prep-mode]')].map(el => [el.dataset.prepMode, el.value])
        );
      return {
        primary: Number(form.elements.primary.value),
        mapped: [...form.querySelectorAll('[name="mapped"]:checked')].map(el => Number(el.value)),
        delimiter:
          form.elements.delimiter.value === 'custom'
            ? form.elements.customDelimiter.value
            : form.elements.delimiter.value,
        trim: form.elements.trim.checked,
        repeatSingle: form.elements.repeatSingle.checked,
      };
    }
    function openPreparation(kind) {
      prepareAccess();
      if (livePending) checkEdit();
      if (livePending) throw Error('Wait for the current edit to finish checking.');
      commitCurrent();
      const schema = activeSchema();
      E.checkSchema(schema);
      if (kind === 'sap' && schema.mode !== 'sap')
        throw Error('Choose a SAP template to apply SAP formatting.');
      closePreparation();
      preparation = {
        kind,
        owner,
        token: generation,
        source: sourceRows,
        schema: JSON.stringify(schema),
        mapping: JSON.stringify(mapping),
        company: runCompanyId,
        plan: null,
      };
      const fields =
        kind === 'sap'
          ? `<p>Use your maintained SAP types and lengths. NUMC / CLNT codes gain leading zeros; ISO dates become YYYYMMDD and colon-separated times become HHMMSS. Blanks stay blank. Other values are retained.</p><p class="val-help">For Availability Check defined as CHAR length 2, choose <strong>Zero-pad code</strong> to turn 2 into 02. This is an explicit field conversion, not a guess based on its name. No domain lookups, unit conversions, rounding or truncation are performed.</p><div class="val-prep-fields">${schema.columns
              .map(c => {
                const s = E.sapSettings(c),
                  mapped = Number(mapping[c.key]) >= 0;
                return `<label class="val-prep-field"><span><strong>${esc(c.label)}</strong><small>${esc(c.key)} · ${s.type} (${s.length})${mapped ? '' : ' · not mapped'}</small></span><select data-prep-mode="${esc(c.key)}" aria-label="Formatting for ${esc(c.label)}"${mapped ? '' : ' disabled'}>${options([['auto', 'SAP type format'], ...(['CHAR', 'NUMC', 'CLNT'].includes(s.type) ? [['zero', 'Zero-pad code']] : []), ['keep', 'Keep unchanged']], mapped ? 'auto' : 'keep')}</select></label>`;
              })
              .join('')}</div>`
          : `<p>Choose the column that determines the number of records, then map other lists by position. Every other upload column is copied. Empty positions are retained; no combinations are generated.</p><div class="val-fields">${select(
              'primary',
              'Column to explode',
              headers.map((h, i) => [i, F.col(i) + ' · ' + h]),
              0
            )}${select(
              'delimiter',
              'Delimiter',
              [
                [',', 'Comma (,)'],
                [';', 'Semicolon (;)'],
                ['|', 'Pipe (|)'],
                ['\t', 'Tab'],
                ['custom', 'Custom delimiter'],
              ],
              ','
            )}${input('customDelimiter', 'Custom delimiter', '', 'text', 'maxlength="5" placeholder="Used only when Custom is selected"')}</div><fieldset class="val-prep-mapped"><legend>Map these columns in the same sequence</legend>${headers.map((h, i) => `<label class="val-toggle"><input type="checkbox" name="mapped" value="${i}"${i === 0 ? ' disabled' : ''}><span>${esc(F.col(i) + ' · ' + h)}</span></label>`).join('')}</fieldset>${toggle('trim', 'Trim spaces around each split value', true)}${toggle('repeatSingle', 'Repeat a single mapped value across all primary values (including blanks)', false)}<p class="val-help">Example: FF01, FF02, FF03 with ST00, WH00, WH01 creates three paired records. Unequal list counts block Apply. Delimiters are literal characters inside each cell.</p>`;
      a.openModal(
        kind === 'sap' ? 'Apply SAP formatting' : 'Explode & map rows',
        `<section class="val-preparation-room" data-access-feature="validator"><span class="val-eyebrow">PREPARE YOUR UPLOAD</span><form id="valPreparationForm">${fields}<button type="submit" class="val-btn val-secondary">Preview changes</button></form><div id="valPreparationPreview" aria-live="polite"><p class="val-help">Your data stays unchanged until you preview and apply.</p></div><div class="val-actions">${btn('prep-cancel', 'Cancel', '', 'val-quiet')}${btn('prep-apply', 'Apply to working data', 'disabled', 'val-primary')}</div><p class="val-help">The original file and saved template are unchanged. Uploaded values, previews and undo remain in this browser only.</p></section>`
      );
      if (kind === 'explode')
        $('valPreparationForm').elements.customDelimiter.closest('label').hidden = true;
    }
    function currentPreparation() {
      const form = $('valPreparationForm');
      if (
        !preparation ||
        !form?.isConnected ||
        form.closest('dialog')?.open === false ||
        preparation.owner !== a.owner?.() ||
        preparation.token !== generation ||
        preparation.source !== sourceRows ||
        preparation.schema !== JSON.stringify(activeSchema()) ||
        preparation.mapping !== JSON.stringify(mapping) ||
        preparation.company !== runCompanyId
      )
        throw Error('The upload or context changed. Reopen preparation and preview it again.');
      return form;
    }
    function previewPreparation(form) {
      prepareAccess();
      if (form !== currentPreparation()) throw Error('Reopen preparation.');
      preparation.plan = null;
      document.querySelector('[data-val="prep-apply"]').disabled = true;
      const opts = preparationOptions(form),
        T = root.WorkHubValidatorTransform;
      const plan =
        preparation.kind === 'sap'
          ? T.sap(headers, sourceRows, activeSchema(), mapping, opts)
          : T.explode(headers, sourceRows, opts);
      preparation.plan = plan;
      preparation.options = JSON.stringify(opts);
      const previewValue = v => esc(String(v).length > 160 ? String(v).slice(0, 160) + '…' : v);
      const sample =
        plan.kind === 'sap'
          ? `<table><thead><tr><th>Source row</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${plan.sample.map(x => `<tr><td>${origins[x.index]?.row || headerRow + x.index + 1}</td><td>${esc(x.field)}</td><td>${previewValue(x.before)}</td><td><strong>${previewValue(x.after)}</strong></td></tr>`).join('')}</tbody></table>`
          : `<table><thead><tr><th>Source row</th><th>Part</th>${headers.map((h, i) => `<th>${esc(h)}${plan.columns?.includes(i) ? ' · split' : ' · copied'}</th>`).join('')}</tr></thead><tbody>${plan.sample.map((x, n) => `<tr><td>${origins[x.index]?.row || headerRow + x.index + 1}</td><td>${[origins[x.index]?.part, plan.parents[n].part].filter(Boolean).join('.') || 'Unsplit'}</td>${plan.rows[n].map(v => `<td>${previewValue(v || '(blank)')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      $('valPreparationPreview').innerHTML =
        `<div class="val-prep-summary${plan.blocked ? ' is-blocked' : ''}"><strong>${plan.kind === 'sap' ? plan.changes + ' cell value(s) will change' : sourceRows.length + ' records → ' + plan.outputCount + ' records'}</strong><span>${plan.warningCount ? plan.warningCount + (plan.blocked ? ' pairing mismatch(es). Nothing will be applied.' : ' value(s) retained for review.') : 'Preview ready.'}</span></div>${plan.warnings.length ? `<ul class="val-prep-warnings">${plan.warnings.map(w => `<li>Source row ${origins[w.index]?.row || headerRow + w.index + 1} · ${esc(w.field)}: ${esc(w.message)}</li>`).join('')}</ul>` : ''}${plan.sample.length ? `<p class="val-help">First ${plan.sample.length} ${plan.kind === 'sap' ? 'changed values' : 'output records'} shown.</p><div class="val-table-scroll">${sample}</div>` : ''}${!plan.changes ? '<p>No values need changing with these options.</p>' : ''}`;
      document.querySelector('[data-val="prep-apply"]').disabled = plan.blocked || !plan.changes;
      if (plan.sample.length)
        $('valPreparationPreview').insertAdjacentHTML(
          'beforeend',
          '<p class="val-help">Long preview values are shortened; working data and exports keep the full value.</p>'
        );
    }
    function resetPreparedResults() {
      cancelLive();
      pinnedRows.clear();
      generation++;
      runner?.cancel();
      busy = false;
      result = null;
      resultSchema = null;
      selectedIssue = null;
      targetRow = -1;
      resetReview();
      filter = 'all';
      page = 0;
      // Keep preparation usable before required fields have all been mapped.
      try {
        rows = E.mapRows(headers, sourceRows, activeSchema(), mapping);
      } catch {
        rows = [];
      }
    }
    function applyPreparation() {
      prepareAccess();
      const form = currentPreparation(),
        p = preparation,
        plan = p.plan;
      if (
        !plan ||
        plan.blocked ||
        !plan.changes ||
        p.options !== JSON.stringify(preparationOptions(form))
      )
        throw Error('Preview the current options before applying.');
      const schema = activeSchema();
      if (schema.projectId && runCompanyId) E.runContext(a.state(), schema, runCompanyId);
      preparationUndo.push({
        rows: sourceRows.map(r => r.slice()),
        preparedRows,
        origins: origins.map(o => ({ ...o })),
        steps: preparationSteps.slice(),
      });
      while (preparationUndo.length > 3) preparationUndo.shift();
      sourceRows = plan.rows;
      preparedRows = sourceRows.map(r => r.slice());
      if (plan.kind === 'explode')
        origins = plan.parents.map(p => ({
          row: origins[p.index].row,
          part: [origins[p.index].part, p.part].filter(Boolean).join('.'),
        }));
      preparationSteps.push({
        kind: plan.kind,
        changes: plan.changes,
        rows: sourceRows.length,
        options: JSON.parse(p.options),
      });
      closePreparation();
      resetPreparedResults();
      say(
        'Preparation applied to ' +
          sourceRows.length +
          ' working row(s). Run validation to check and export these values.'
      );
      paint();
    }
    function undoPreparation(restore = false) {
      prepareAccess();
      if (!preparationUndo.length && !restore) throw Error('There is no preparation to undo.');
      if (
        !root.confirm(
          (restore ? 'Restore the original upload?' : 'Undo the last transformation?') +
            ' Later cell corrections and current validation results will be cleared.'
        )
      )
        return;
      closePreparation();
      if (restore) {
        sourceRows = originalRows.map(r => r.slice());
        preparedRows = sourceRows.map(r => r.slice());
        origins = sourceRows.map((r, i) => ({ row: headerRow + i + 1, part: '' }));
        preparationSteps = [];
        preparationUndo = [];
      } else {
        const previous = preparationUndo.pop();
        sourceRows = previous.rows;
        preparedRows = previous.preparedRows;
        origins = previous.origins;
        preparationSteps = previous.steps;
      }
      resetPreparedResults();
      say(
        restore
          ? 'Original upload restored. Run validation again.'
          : 'Last transformation undone. Run validation again.'
      );
      paint();
    }
    function preparationView() {
      return `<section class="val-prep-toolbar"><div><span class="val-eyebrow">PREPARE BEFORE YOU CHECK</span><h3>Your data, ready for the next step.</h3><p>${sourceRows.length} working row(s) · ${originalRows.length} original row(s)${preparationSteps.length ? ' · ' + preparationSteps.length + ' preparation(s) applied' : ''}. Preview first. The file on your device stays unchanged.</p></div><div class="val-actions">${btn('prep-sap', 'Apply SAP formatting', activeSchema().mode !== 'sap' || busy ? 'disabled title="Use a SAP template for field formatting"' : '', 'val-secondary')}${btn('prep-explode', 'Explode & map rows', busy ? 'disabled' : '', 'val-secondary')}${btn('prep-undo', 'Undo last change', !preparationUndo.length || busy ? 'disabled' : '', 'val-quiet')}${btn('prep-restore', 'Restore original upload', !preparationSteps.length || busy ? 'disabled' : '', 'val-quiet')}</div><p class="val-help">Formatting uses the current column mapping and selected template version. Undo keeps the last three transformations. Validate after preparing to refresh issue counts and exports.</p></section>`;
    }
    function setupAccess(action = 'run') {
      ensure();
      if (root.WorkHubCurrentAccess && !root.WorkHubCurrentAccess.can('validator', action))
        throw Error('Your account cannot ' + action + ' validation setups.');
    }
    function profiles() {
      return (store().profiles || []).filter(p => p.templateId === draft?.id);
    }
    function setupChoices(t = activeSchema()) {
      return (
        runSelection || {
          ruleIds: t.rules
            .filter(r => E.ruleApplies(r, { companyId: runCompanyId }))
            .map(r => r.id),
          referenceChecks: [],
        }
      );
    }
    function profileChanged(p) {
      const s = setupChoices();
      return (
        JSON.stringify([s.ruleIds, s.referenceChecks, runCompanyId]) !==
        JSON.stringify([p.ruleIds, p.referenceChecks, p.companyId || ''])
      );
    }
    function setupName() {
      const p = profiles().find(p => p.id === runProfileId);
      return p
        ? p.name + (profileChanged(p) ? ' (modified)' : '')
        : runSelection
          ? 'Custom selection'
          : 'All applicable checks';
    }
    function setupPlan(t = activeSchema()) {
      const plan = E.runSetup(t, setupChoices(t), { companyId: runCompanyId });
      plan.summary.name = setupName();
      plan.summary.profileId = runProfileId;
      return plan;
    }
    function setupChanged() {
      closePreparation();
      correction = null;
      if ($('valCorrectionReview')) a.closeModal?.();
      resetPreparedResults();
      say(
        'Validation setup changed. Your upload, mapping and corrections are kept. Run validation to refresh the results.'
      );
      paint();
    }
    function chooseProfile(id) {
      setupAccess();
      if (id === '__custom' && runSelection && !runProfileId) return;
      if (!id) {
        runSelection = null;
        runProfileId = '';
      } else {
        const p = profiles().find(p => p.id === id);
        if (!p) throw Error('Choose an available profile for this template.');
        const t = activeSchema();
        if ((p.projectId || '') !== (t.projectId || ''))
          throw Error(
            'This profile uses a different linked project. Choose its original version or save a new profile.'
          );
        if (p.companyId) E.runContext(a.state(), t, p.companyId);
        runSelection = E.copy({ ruleIds: p.ruleIds, referenceChecks: p.referenceChecks });
        runProfileId = p.id;
        runCompanyId = p.companyId || '';
      }
      setupChanged();
    }
    function openProfileForm(update = false) {
      setupAccess(update ? 'edit' : 'create');
      commitCurrent();
      const t = activeSchema(),
        saved = store().templates.find(t => t.id === draft.id),
        p = profiles().find(p => p.id === runProfileId);
      if (
        !saved ||
        (version === 'draft' && JSON.stringify(E.schema(saved)) !== JSON.stringify(E.schema(draft)))
      )
        throw Error('Save your template changes before saving a validation profile.');
      setupPlan(t);
      if (update && !p) throw Error('Select a saved profile to update.');
      a.openModal(
        update ? 'Update validation profile' : 'Save validation profile',
        `<section class="val-profile-room" data-access-feature="validator"><form id="valProfileForm" data-id="${update ? esc(p.id) : ''}" data-owner="${esc(owner)}" data-template="${esc(draft.id)}" data-token="${generation}" data-stamp="${update ? esc(p.updatedAt) : ''}">${input('profileName', 'Profile name', update ? p.name : '', 'text', 'maxlength="120" placeholder="Company A — Material Master" required')}${t.projectId ? toggle('rememberCompany', 'Remember the current company with this profile', !!runCompanyId) : ''}<p class="val-help">Saves the selected check identifiers and reference mappings for this template. Uploaded records are never included. This profile uses definitions from the template version selected when you run.</p><button type="submit" class="val-btn val-primary">${update ? 'Update profile' : 'Save profile'}</button><p id="valProfileError" role="status"></p></form></section>`
      );
    }
    function saveProfileForm(form) {
      const id = form.dataset.id;
      setupAccess(id ? 'edit' : 'create');
      if (
        form.dataset.owner !== a.owner?.() ||
        form.dataset.template !== draft?.id ||
        Number(form.dataset.token) !== generation
      )
        throw Error('The setup changed. Close this dialog and save the profile again.');
      const t = activeSchema(),
        selection = setupChoices(t);
      setupPlan(t);
      if (form.elements.rememberCompany?.checked && t.projectId)
        E.runContext(a.state(), t, runCompanyId);
      const p = {
        id: id || E.uid(),
        templateId: draft.id,
        name: form.elements.profileName.value.trim(),
        projectId: t.projectId || '',
        companyId: form.elements.rememberCompany?.checked ? runCompanyId : '',
        ...E.copy(selection),
        updatedAt: new Date().toISOString(),
      };
      const ok = a.mutate(d => {
        const v = d.workhub.validator;
        v.profiles ||= [];
        const i = v.profiles.findIndex(p => p.id === id && p.templateId === draft.id);
        if (id && i >= 0 && v.profiles[i].updatedAt !== form.dataset.stamp)
          throw Error('This profile changed elsewhere. Reopen it before updating.');
        if (id && i < 0) throw Error('This profile was removed elsewhere. Save a new profile.');
        if (i < 0) v.profiles.push(p);
        else v.profiles[i] = p;
        E.checkProfiles(v);
      });
      if (!ok) throw Error('The profile could not be saved. Try again.');
      runProfileId = p.id;
      runSelection = E.copy(selection);
      // A profile without a remembered company can still use the current company for this run.
      a.closeModal?.();
      say('Validation profile saved. Your template rules and uploaded records are unchanged.');
      paint();
    }
    function referenceKey(c) {
      return JSON.stringify([c.field, c.lookupId, c.lookupColumn]);
    }
    function referenceChoices(t = activeSchema(), s = setupChoices(t)) {
      const choices = new Map(),
        selected = new Set(s.referenceChecks.map(referenceKey));
      const add = c => {
        const key = referenceKey(c);
        if (choices.has(key)) return choices.get(key);
        const field = t.columns.find(f => f.key === c.field),
          list = t.lookups.find(l => l.id === c.lookupId),
          available = !!field && !!list?.headers.includes(c.lookupColumn);
        const choice = {
          key,
          check: { field: c.field, lookupId: c.lookupId, lookupColumn: c.lookupColumn },
          field: field?.label || c.field,
          name: list?.name || 'Unavailable reference',
          available,
          selected: selected.has(key),
          requiredBy: [],
        };
        choices.set(key, choice);
        return choice;
      };
      for (const r of t.rules)
        for (const c of E.ruleReferences(r)) {
          if (c.operator !== 'lookup') continue;
          const choice = add(c);
          if (s.ruleIds.includes(r.id) && E.ruleApplies(r, { companyId: runCompanyId }))
            choice.requiredBy.push(r.name);
        }
      for (const c of [
        ...profiles().flatMap(p => p.referenceChecks),
        ...extraReferenceChoices,
        ...s.referenceChecks,
      ])
        add(c);
      return [...choices.values()].filter(c => c.available || c.selected);
    }
    function rememberReferenceChoices(s) {
      for (const c of s.referenceChecks)
        if (!extraReferenceChoices.some(x => referenceKey(x) === referenceKey(c)))
          extraReferenceChoices.push(E.copy(c));
    }
    function deselectRunReferences(s, keys) {
      const dependent = activeSchema().rules.filter(
        r =>
          s.ruleIds.includes(r.id) &&
          E.ruleApplies(r, { companyId: runCompanyId }) &&
          E.ruleReferences(r).some(c => c.operator === 'lookup' && keys.has(referenceKey(c)))
      );
      if (
        dependent.length &&
        !root.confirm(
          'Deselecting these reference checks will also deselect these conditions for this validation run:\n\n' +
            dependent.map(r => '• ' + r.name).join('\n') +
            '\n\nYour saved template and profiles stay unchanged. Continue?'
        )
      )
        return false;
      const ids = new Set(dependent.map(r => r.id));
      s.ruleIds = s.ruleIds.filter(id => !ids.has(id));
      rememberReferenceChoices(s);
      s.referenceChecks = s.referenceChecks.filter(c => !keys.has(referenceKey(c)));
      return true;
    }
    function runReferencesView(t, s, can) {
      const choices = referenceChoices(t, s),
        q = setupReferenceSearch.trim().toLowerCase(),
        matches = c =>
          !q || [c.name, c.field, c.check.lookupColumn].join(' ').toLowerCase().includes(q),
        unmapped = t.lookups.filter(l => !choices.some(c => c.check.lookupId === l.id)),
        tuples = t.rules
          .filter(r => s.ruleIds.includes(r.id) && E.ruleApplies(r, { companyId: runCompanyId }))
          .flatMap(r =>
            E.ruleReferences(r)
              .filter(c => c.operator === 'lookupTuple')
              .map(c => ({
                name: t.lookups.find(l => l.id === c.lookupId)?.name || 'Unavailable reference',
                field: c.pairs
                  .map(
                    p =>
                      (t.columns.find(f => f.key === p.field)?.label || p.field) +
                      ' → ' +
                      p.referenceColumn
                  )
                  .join('; '),
                check: { lookupColumn: '' },
                requiredBy: r.name,
              }))
          );
      const control = c =>
        `<label class="val-setup-choice"><input type="checkbox" data-setup-reference="${esc(c.key)}"${c.selected || c.requiredBy.length ? ' checked' : ''}${!can('run') || busy || (!c.available && !c.selected) ? ' disabled' : ''}><span><strong>${esc(c.name)} · ${esc(c.field)} → ${esc(c.check.lookupColumn)}</strong><small>${c.requiredBy.length ? 'Required by ' + esc([...new Set(c.requiredBy)].join(', ')) + (c.selected ? ' · Also selected independently' : '') + ' · Untick to review dependent conditions' : !c.available ? 'Unavailable in this version · Uncheck to remove it from this run' : c.selected ? 'Selected for this run' : 'Skipped · not selected'}</small></span></label>`;
      const entries =
        choices.filter(matches).map(control).join('') +
        tuples
          .filter(matches)
          .map(
            c =>
              `<label class="val-setup-choice"><input type="checkbox" checked disabled><span><strong>${esc(c.name)} · ${esc(c.field)}</strong><small>Required by ${esc(c.requiredBy)} · Combined field check · Manage in Conditions</small></span></label>`
          )
          .join('') +
        unmapped
          .filter(l => !q || l.name.toLowerCase().includes(q))
          .map(
            l =>
              `<div class="val-setup-choice"><span><strong>${esc(l.name)}</strong><small>No field mapping yet. Use Map another reference check below to choose its uploaded field and reference column.</small></span></div>`
          )
          .join('');
      return `<details class="val-setup-details"><summary>References · choose individually</summary><p class="val-help">Tick the reference checks for this run. Unticking a single-field reference asks you to confirm which dependent conditions will also be deselected for this run. Independent checks validate the mapped field on every row. Blank values follow the existing reference behaviour; mark a column Required to require a value.</p><div class="val-setup-condition-tools"><label class="val-label">Find references<input id="valSetupReferenceSearch" type="search" value="${esc(setupReferenceSearch)}" placeholder="Search references or fields"></label><div class="val-actions">${btn('run-setup-references-all', 'Select applicable', !can('run') || busy ? 'disabled' : '', 'val-quiet')}${btn('run-setup-references-none', 'Deselect all', !can('run') || busy ? 'disabled' : '', 'val-quiet')}</div></div><div class="val-setup-choices val-setup-reference-choices">${entries || '<p class="val-help">No matching reference checks. Maintain reference lists in References, or map a check below.</p>'}</div><details class="val-setup-details"><summary>Map another reference check</summary><form id="valRunReferenceForm"><div class="val-fields">${select(
        'setupField',
        'Uploaded field',
        t.columns.map(c => [c.key, c.label]),
        t.columns[0]?.key
      )}${select(
        'setupReference',
        'Reference',
        t.lookups.map(l => [l.id, l.name]),
        t.lookups[0]?.id
      )}${select(
        'setupReferenceColumn',
        'Reference column',
        (t.lookups[0]?.headers || []).map(h => [h, h]),
        t.lookups[0]?.codeColumn || t.lookups[0]?.headers[0]
      )}</div><button type="submit" class="val-btn val-secondary"${!can('run') || !t.lookups.length || !t.columns.length || busy ? ' disabled' : ''}>Add reference check</button></form></details></details>`;
    }
    function runSetupView() {
      const t = activeSchema(),
        s = setupChoices(t),
        ids = new Set(s.ruleIds),
        p = profiles().find(p => p.id === runProfileId),
        q = setupSearch.trim().toLowerCase(),
        can = action =>
          !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('validator', action);
      let plan,
        problem = '';
      try {
        plan = setupPlan(t);
      } catch (error) {
        problem = error.message;
      }
      const rules = t.rules.filter(
        r =>
          !q ||
          [
            r.name,
            r.message,
            ...E.ruleReferences(r).map(c => t.lookups.find(l => l.id === c.lookupId)?.name || ''),
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)
      );
      const missing = s.ruleIds.filter(id => !t.rules.some(r => r.id === id));
      const control = r => {
        const available = E.ruleApplies(r, { companyId: runCompanyId }),
          refs = E.ruleReferences(r);
        return `<label class="val-setup-choice"><input type="checkbox" data-setup-rule="${esc(r.id)}"${ids.has(r.id) ? ' checked' : ''}${!can('run') || busy || (!available && !ids.has(r.id)) ? ' disabled' : ''}><span><strong>${esc(r.name)}</strong><small>${!r.enabled ? 'Paused in template' : !available ? 'Different company — skipped' : ids.has(r.id) ? 'Selected for this run' : 'Skipped · not selected'}${refs.length ? ' · Uses ' + esc([...new Set(refs.map(c => t.lookups.find(l => l.id === c.lookupId)?.name))].join(', ')) : ''}</small></span></label>`;
      };
      const used = plan?.summary.references || [];
      return `<section id="valRunSetup" class="val-run-setup" data-val-context="${esc(runProfileId + ':' + runCompanyId + ':' + version)}"><div class="val-panel-title"><div><span class="val-eyebrow">CHOOSE WHAT TO CHECK</span><h3>Validation setup</h3><p>Your columns stay the same. Choose the conditions and reference checks for this run.</p></div><span class="val-chip">${esc(setupName())}</span></div><div class="val-setup-profile">${select('validationProfile', 'Validation profile', [['', 'All applicable checks'], ...(!runProfileId && runSelection ? [['__custom', 'Custom selection']] : []), ...profiles().map(p => [p.id, p.name])], runProfileId || (runSelection ? '__custom' : ''), !can('run') || busy ? 'disabled' : '')}<div class="val-actions">${btn('run-setup-save', 'Save as new profile', !can('create') || busy ? 'disabled' : '', 'val-secondary')}${btn('run-setup-update', 'Update profile', !p || !can('edit') || busy ? 'disabled' : '', 'val-quiet')}${btn('profile-delete', 'Delete profile', !p || !can('delete') || busy ? 'disabled' : '', 'val-quiet')}</div></div>${p && profileChanged(p) ? '<p class="val-help">Temporary changes · the saved profile is unchanged until you choose Update profile.</p>' : ''}<div class="val-setup-summary" role="status"><strong>${plan ? countLabel(plan.summary.conditions.length, 'condition') + ' · ' + countLabel(used.length, 'reference check') + ' · ' + countLabel(plan.summary.skipped.length, 'skipped condition') : 'Review this setup'}</strong><span>Base column checks always apply: required fields, types/SAP formats, lengths, allowed values and duplicate checks.</span></div>${problem ? `<p class="val-setup-problem" role="alert">${esc(problem)}</p>` : ''}<details class="val-setup-details"><summary>Conditions · choose individually</summary><div class="val-setup-condition-tools"><label class="val-label">Find conditions<input id="valSetupSearch" type="search" value="${esc(setupSearch)}" placeholder="Search conditions or references"></label><div class="val-actions">${btn('run-setup-all', 'Select applicable', !can('run') || busy ? 'disabled' : '', 'val-quiet')}${btn('run-setup-none', 'Deselect all', !can('run') || busy ? 'disabled' : '', 'val-quiet')}</div></div><div class="val-setup-choices">${rules.map(control).join('') || '<p class="val-help">No matching conditions. Maintain business rules in Conditions.</p>'}${missing.map(id => `<label class="val-setup-choice"><input type="checkbox" data-setup-rule="${esc(id)}" checked${!can('run') || busy ? ' disabled' : ''}><span>Unavailable condition · ${esc(id)}<small>Uncheck to remove it from this run.</small></span></label>`).join('')}</div></details>${runReferencesView(t, s, can)}<p class="val-help">Choose a profile or adjust these selections, then Run validation. Your upload and mapping stay in place. Profiles use the chosen template version; paused and company-restricted conditions cannot be forced on.</p></section>`;
    }
    function addRunReference(form) {
      setupAccess();
      const s = E.copy(setupChoices()),
        c = {
          id: E.uid(),
          field: form.elements.setupField.value,
          lookupId: form.elements.setupReference.value,
          lookupColumn: form.elements.setupReferenceColumn.value,
        };
      if (
        s.referenceChecks.some(
          x => x.field === c.field && x.lookupId === c.lookupId && x.lookupColumn === c.lookupColumn
        )
      )
        throw Error('This additional reference check is already selected.');
      if (
        activeSchema().rules.some(
          r =>
            s.ruleIds.includes(r.id) &&
            E.ruleApplies(r, { companyId: runCompanyId }) &&
            E.ruleReferences(r).some(
              x =>
                x.field === c.field &&
                x.lookupId === c.lookupId &&
                x.lookupColumn === c.lookupColumn
            )
        )
      )
        throw Error(
          'A selected condition already uses this reference mapping. It is included automatically.'
        );
      s.referenceChecks.push(c);
      E.runSetup(activeSchema(), s, { companyId: runCompanyId });
      rememberReferenceChoices(s);
      runSelection = s;
      setupChanged();
    }
    function reviewed(raw) {
      const keys = new Set(raw.issues.map(E.issueKey));
      for (const [key, decision] of ignoredIssues)
        if (!keys.has(key) || decision.row !== JSON.stringify(rows[decision.index]))
          ignoredIssues.delete(key);
      for (const key of issueSelection) if (!keys.has(key)) issueSelection.delete(key);
      return E.reviewIssues(raw, rows, ignoredIssues);
    }
    function applyIssueReview(action, el) {
      if (livePending) checkEdit();
      if (livePending) throw Error('Wait for the current edit to finish checking.');
      if (!rawResult || !result || !resultSchema)
        throw Error('Run validation before reviewing issues.');
      const before = new Map(ignoredIssues),
        previous = result;
      if (action === 'ignore-selected') {
        const selected = result.issues.filter(i => !i.ignored && issueSelection.has(E.issueKey(i)));
        if (!selected.length) throw Error('Select at least one current issue to ignore.');
        const snapshots = new Map();
        for (const issue of selected) {
          if (!snapshots.has(issue.index))
            snapshots.set(issue.index, JSON.stringify(rows[issue.index]));
          ignoredIssues.set(E.issueKey(issue), {
            index: issue.index,
            row: snapshots.get(issue.index),
            reason: ignoreReason.trim(),
          });
        }
      } else if (action === 'restore-issues') ignoredIssues.clear();
      else {
        const issue = result.issues[Number(el.dataset.issue)];
        if (!issue || el.dataset.issueKey !== E.issueKey(issue))
          throw Error('Choose a current ignored issue.');
        ignoredIssues.delete(E.issueKey(issue));
      }
      result = reviewed(rawResult);
      issueSelection.clear();
      try {
        const ok = a.mutate(d => {
          const summary = d.workhub.validator.runs.find(r => r.id === currentRunId);
          if (!summary) throw Error('This run summary is unavailable. Run validation again.');
          Object.assign(summary, {
            ignored: result.ignored,
            ignoredErrors: result.ignoredErrors,
            ignoredWarnings: result.ignoredWarnings,
            reviewedPassed: result.passed,
            reviewedErrors: result.errors,
            reviewedWarnings: result.warnings,
            reviewedAt: new Date().toISOString(),
          });
        });
        if (!ok) throw Error('The review summary could not be saved. Try again.');
      } catch (error) {
        ignoredIssues.clear();
        for (const [key, value] of before) ignoredIssues.set(key, value);
        result = previous;
        throw error;
      }
      say(result.ignored + ' ignored issue(s) · ' + result.errors + ' unresolved errors.');
      patchResults();
    }
    function cancelLive() {
      root.clearTimeout(liveTimer);
      liveTimer = null;
      livePending = false;
      liveCheck = null;
    }
    function sync() {
      const next = a.owner?.() || '';
      if (next !== owner) {
        resetQueue();
        resetPreparation();
        cancelLive();
        pinnedRows.clear();
        owner = next;
        generation++;
        runner?.cancel();
        draft = null;
        selected = '';
        baseStamp = '';
        dirty = false;
        book = null;
        headers = [];
        sourceRows = [];
        rows = [];
        result = null;
        resetReview();
        resultSchema = null;
        selectedIssue = null;
        fileName = '';
        busy = false;
        mode = 'columns';
        runCompanyId = '';
        runSelection = null;
        runProfileId = '';
        setupSearch = '';
        setupReferenceSearch = '';
        extraReferenceChoices = [];
        setupPreview = null;
        correction = null;
        copyPreview = null;
        if ($('valCopyReview')) a.closeModal?.();
        if ($('valCorrectionReview')) a.closeModal?.();
        if ($('valSetupReview')) a.closeModal?.();
        const profileRoom = document.querySelector('.val-profile-room');
        if (profileRoom) {
          profileRoom.replaceChildren();
          a.closeModal?.();
        }
      }
      return next;
    }
    // Reconcile the current workspace instead of replacing it on every edit.
    // Preserve uncommitted controls unless the new model explicitly changes them.
    function surfaceKey(node) {
      if (node.nodeType !== 1) return '';
      const d = node.dataset;
      if (node.id) return 'id:' + node.id + (node.tagName === 'FORM' ? ':' + (d.id || '') : '');
      for (const key of [
        'columnId',
        'groupField',
        'groupValue',
        'issueRowKey',
        'rowIndex',
        'setupRule',
        'setupReference',
        'attentionGroupKey',
      ])
        if (d[key] !== undefined) return key + ':' + d[key];
      if (d.map !== undefined) return 'mapping:' + d.map;
      if (d.cell !== undefined) return 'cell:' + d.cell + ':' + d.field;
      if (d.path !== undefined) return 'path:' + node.className + ':' + d.path;
      if (d.clause !== undefined) return 'clause:' + d.clause;
      if (d.val !== undefined)
        return (
          'action:' +
          [
            d.val,
            d.id,
            d.index,
            d.field,
            d.filter,
            d.delta,
            d.path,
            d.mode,
            d.version,
            d.issueKey,
            d.choice,
            d.groupKey,
          ].join(':')
        );
      if (node.hasAttribute('name'))
        return (
          node.tagName +
          ':' +
          node.name +
          ':' +
          node.type +
          (['checkbox', 'radio'].includes(node.type) ? ':' + node.value : '')
        );
      if (node.tagName === 'OPTION') return 'option:' + node.value;
      if (node.tagName === 'LABEL') {
        const control = node.querySelector('input,textarea,select');
        if (control) return 'label:' + surfaceKey(control);
      }
      if (node.tagName === 'MAIN' && node.classList.contains('val-main'))
        return 'main:' + d.valSection;
      if (
        ['DIV', 'SECTION', 'ASIDE', 'NAV', 'FIELDSET', 'DETAILS'].includes(node.tagName) &&
        node.className
      )
        return node.tagName + ':' + node.className;
      return '';
    }
    function patchSurface(current, html, preservePage = true) {
      const template = document.createElement('template');
      template.innerHTML = html;
      const next = template.content.firstElementChild;
      if (!next) return false;
      const active = document.activeElement,
        position = [root.scrollX || 0, root.scrollY || 0];
      let selection = null;
      try {
        if (
          active &&
          current.contains(active) &&
          active.selectionStart !== null &&
          active.selectionStart !== undefined
        )
          selection = [active.selectionStart, active.selectionEnd, active.selectionDirection];
      } catch {}
      const scrolling = [current, ...current.querySelectorAll('*')]
        .filter(el => el.scrollTop || el.scrollLeft)
        .map(el => [el, el.scrollLeft, el.scrollTop]);
      const same = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName;
      const selected = (el, defaults = false) => {
        const choices = Array.from(el.options),
          values = choices
            .filter(o => (defaults ? o.defaultSelected : o.selected))
            .map(o => o.value);
        return values.length || el.multiple ? values : [choices[0]?.value || ''];
      };
      const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      function patch(node, next, fresh = false) {
        if (node.nodeType !== 1) {
          if (node.nodeValue !== next.nodeValue) node.nodeValue = next.nodeValue;
          return;
        }
        fresh ||=
          node.dataset.valContext !== next.dataset.valContext ||
          (node.tagName === 'FORM' && node.dataset.set !== next.dataset.set);
        let control = null;
        if (node.tagName === 'SELECT') {
          const live = selected(node),
            original = selected(node, true),
            desired = selected(next);
          control = {
            value:
              !fresh &&
              equal(desired, original) &&
              live.every(value => Array.from(next.options).some(o => o.value === value))
                ? live
                : desired,
            select: true,
          };
        } else if (
          node.tagName === 'TEXTAREA' ||
          (node.tagName === 'INPUT' && node.type !== 'file')
        ) {
          const check = ['checkbox', 'radio'].includes(node.type),
            live = check ? node.checked : node.value,
            original = check ? node.defaultChecked : node.defaultValue,
            desired = check ? next.checked : next.value;
          control = { value: !fresh && desired === original ? live : desired, check };
        }
        const open = node.tagName === 'DETAILS' ? node.open : null;
        const resized = node.tagName === 'TEXTAREA' ? [node.style.width, node.style.height] : null;
        for (const attr of Array.from(node.attributes))
          if (!next.hasAttribute(attr.name)) node.removeAttribute(attr.name);
        for (const attr of Array.from(next.attributes))
          if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
        const old = Array.from(node.childNodes),
          used = new Set(),
          keyed = new Map();
        for (const child of old) {
          const key = surfaceKey(child);
          if (key) {
            if (!keyed.has(key)) keyed.set(key, []);
            keyed.get(key).push(child);
          }
        }
        let cursor = node.firstChild;
        for (const child of Array.from(next.childNodes)) {
          const key = surfaceKey(child);
          let match = key
            ? keyed.get(key)?.find(n => !used.has(n) && same(n, child))
            : old.find(n => !used.has(n) && !surfaceKey(n) && same(n, child));
          if (!match) match = child.cloneNode(true);
          else patch(match, child, fresh);
          used.add(match);
          if (cursor !== match) node.insertBefore(match, cursor);
          cursor = match.nextSibling;
        }
        for (const child of old) if (!used.has(child)) child.remove();
        if (control?.select) {
          for (const option of node.options) option.selected = control.value.includes(option.value);
        } else if (control?.check) {
          if (node.checked !== control.value) node.checked = control.value;
        } else if (control && node.value !== control.value) node.value = control.value;
        if (open !== null) node.open = open;
        if (resized) {
          if (resized[0]) node.style.width = resized[0];
          if (resized[1]) node.style.height = resized[1];
        }
      }
      patch(current, next);
      for (const [el, left, top] of scrolling)
        if (el.isConnected) {
          el.scrollLeft = left;
          el.scrollTop = top;
        }
      if (active && current.contains(active) && active.isConnected) {
        if (document.activeElement !== active) active.focus({ preventScroll: true });
        if (selection)
          try {
            active.setSelectionRange(...selection);
          } catch {}
      }
      if (preservePage && (root.scrollX !== position[0] || root.scrollY !== position[1]))
        root.scrollTo?.(...position);
      return true;
    }
    function patchRender() {
      const current = document.querySelector('.validation-studio');
      if (!current || !a.ready()) return false;
      const html = render();
      if (current.dataset.valOwner !== owner || current.dataset.valTemplate !== (draft?.id || ''))
        return false;
      return patchSurface(current, html, current.dataset.valMode === mode);
    }
    function paint() {
      if (!patchRender()) a.render();
    }
    function say(text, error = false) {
      message = text;
      a.tell?.(text, error);
    }
    function ensure() {
      sync();
      if (!a.ready()) throw Error('Sign in to open Validation Studio.');
    }
    function mark() {
      cancelLive();
      pinnedRows.clear();
      generation++;
      runner?.cancel();
      busy = false;
      dirty = true;
      result = null;
      resetReview();
      resultSchema = null;
      selectedIssue = null;
      const el = $('valDraftStatus');
      if (el) el.textContent = 'Unsaved draft';
    }
    function activeSchema() {
      if (version === 'draft') return E.schema(draft);
      const r = draft?.releases.find(r => String(r.version) === version);
      if (!r) throw Error('Choose an available template version.');
      return E.copy(r.schema);
    }
    function pick(id, force = false) {
      if (!force && dirty && !root.confirm('Switch templates and discard unsaved draft changes?'))
        return;
      const t = store().templates.find(t => t.id === id);
      draft = t ? E.copy(t) : null;
      selected = t?.id || '';
      baseStamp = t?.updatedAt || '';
      dirty = false;
      columnId = draft?.columns[0]?.id || '';
      ruleId = draft?.rules[0]?.id || '';
      version = draft?.releases.length ? String(draft.releases.at(-1).version) : 'draft';
      clearFile();
      message = '';
    }
    function clearFile(preserveQueue = false) {
      if (!preserveQueue) resetQueue();
      resetPreparation();
      cancelLive();
      pinnedRows.clear();
      generation++;
      runner?.cancel();
      runCompanyId = '';
      runSelection = null;
      runProfileId = '';
      setupSearch = '';
      setupReferenceSearch = '';
      extraReferenceChoices = [];
      selectedIssue = null;
      targetRow = -1;
      setupPreview = null;
      copyPreview = null;
      correction = null;
      book = null;
      headers = [];
      sourceRows = [];
      mapping = {};
      rows = [];
      result = null;
      resetReview();
      resultSchema = null;
      fileName = '';
      page = 0;
      busy = false;
    }
    function create(example = false) {
      if (dirty && !root.confirm('Create a template and discard unsaved draft changes?')) return;
      draft = example ? E.example() : E.create();
      selected = draft.id;
      baseStamp = '';
      columnId = draft.columns[0]?.id || '';
      ruleId = draft.rules[0]?.id || '';
      dirty = true;
      version = 'draft';
      mode = 'columns';
      clearFile();
      message = example ? 'An example to explore. All fields and rules are yours to change.' : '';
      paint();
    }
    function rewire(oldKey, newKey) {
      for (const r of draft.rules) {
        const walk = g => {
          for (const c of g.conditions) {
            if (c.field === oldKey) c.field = newKey;
            if (c.otherField === oldKey) c.otherField = newKey;
            for (const pair of c.pairs || []) if (pair.field === oldKey) pair.field = newKey;
          }
          for (const c of g.groups) walk(c);
        };
        walk(r.when);
        for (const c of E.requirements(r)) {
          if (c.field === oldKey) c.field = newKey;
          if (c.otherField === oldKey) c.otherField = newKey;
          for (const pair of c.pairs || []) if (pair.field === oldKey) pair.field = newKey;
        }
      }
      for (const g of draft.columnGroups || []) {
        g.fields = g.fields.map(k => (k === oldKey ? newKey : k));
        for (const set of g.sets)
          if (Object.hasOwn(set.values, oldKey)) {
            set.values[newKey] = set.values[oldKey];
            delete set.values[oldKey];
          }
      }
      draft.uniqueGroups = draft.uniqueGroups.map(g => g.map(k => (k === oldKey ? newKey : k)));
      for (const c of draft.columns) if (c.sapReference === oldKey) c.sapReference = newKey;
    }
    function readClause(el) {
      if (!el) return null;
      const get = k => el.querySelector('[data-clause="' + k + '"]')?.value || '';
      const field = get('field'),
        operator = get('operator');
      const binding =
        get('valueSource') === 'group' && E.GROUP_OPS.includes(operator)
          ? (draft.columnGroups || []).find(
              g => g.id === get('groupId') && g.fields.includes(field)
            ) || (draft.columnGroups || []).find(g => g.fields.includes(field))
          : null;
      const set = binding?.sets.find(v => v.id === get('valueSetId')) || binding?.sets[0];
      return {
        ...(binding && set
          ? { valueSource: 'group', groupId: binding.id, valueSetId: set.id }
          : {}),
        field: get('field'),
        operator: get('operator'),
        value: get('value'),
        otherField: get('otherField'),
        lookupId: get('lookupId'),
        lookupColumn: get('lookupColumn'),
        ...(get('operator') === 'lookupTuple'
          ? {
              pairs: Array.from(el.querySelectorAll('[data-tuple-pair]')).map(pair => ({
                field: pair.querySelector('[data-pair-field]').value,
                referenceColumn: pair.querySelector('[data-pair-reference]').value,
              })),
            }
          : {}),
      };
    }
    function readGroup(el) {
      return {
        join: el.querySelector(':scope > .val-group-head select').value,
        conditions: Array.from(el.querySelectorAll(':scope > .val-group-items > .val-clause')).map(
          readClause
        ),
        groups: Array.from(
          el.querySelectorAll(':scope > .val-group-items > .val-condition-group')
        ).map(readGroup),
      };
    }
    function commitCurrent() {
      if (!draft) return;
      commitColumnGroup();
      const meta = $('valMetaForm');
      if (meta) {
        draft.name = meta.elements.namedItem('name').value.trim();
        draft.description = meta.elements.namedItem('description').value;
        draft.mode = meta.elements.namedItem('mode')?.value || draft.mode || 'general';
        const projectId = meta.elements.namedItem('projectId')?.value || '';
        if (
          projectId !== (draft.projectId || '') &&
          draft.rules.some(r => r.companyScope === 'selected')
        )
          throw Error('Reassign company conditions before changing the linked project.');
        draft.projectId = projectId;
        draft.projectName =
          a.state().projects.find(p => p.id === projectId)?.name || draft.projectName || '';
        if (!projectId) draft.projectName = '';
      }
      const cf = $('valColumnForm');
      if (cf) {
        const c = draft.columns.find(c => c.id === cf.dataset.id),
          old = c.key;
        for (const k of [
          'key',
          'label',
          'type',
          'minLength',
          'maxLength',
          'min',
          'max',
          'values',
          'aliases',
          'description',
          'format',
          'sapType',
          'sapLength',
          'sapDecimals',
          'sapReference',
        ])
          if (cf.elements.namedItem(k)) c[k] = cf.elements.namedItem(k).value;
        for (const k of ['required', 'unique', 'trim', 'caseSensitive'])
          c[k] = cf.elements.namedItem(k).checked;
        if (old !== c.key) rewire(old, c.key);
      }
      const rf = $('valRuleForm');
      if (rf) {
        const r = draft.rules.find(r => r.id === rf.dataset.id);
        r.name = rf.elements.namedItem('name').value;
        r.severity = rf.elements.namedItem('severity').value;
        r.message = rf.elements.namedItem('message').value;
        r.enabled = rf.elements.namedItem('enabled').checked;
        r.companyScope = rf.elements.namedItem('companyScope')?.value || 'all';
        r.companies =
          r.companyScope === 'selected'
            ? Array.from(rf.querySelectorAll('[name="ruleCompany"]:checked')).map(el => {
                const current = a
                  .state()
                  .projectCompanies.find(c => c.id === el.value && c.projectId === draft.projectId);
                return {
                  id: el.value,
                  name:
                    current?.name || r.companies?.find(c => c.id === el.value)?.name || el.value,
                };
              })
            : [];
        r.when = readGroup(rf.querySelector('[data-group-root]'));
        const checks = [...rf.querySelectorAll('[data-assertion]')].map(readClause);
        r.assertion = checks[0];
        if (checks.length > 1) r.additionalAssertions = checks.slice(1);
        else delete r.additionalAssertions;
      }
    }
    function saveDraft(quiet = false) {
      ensure();
      commitCurrent();
      E.checkSchema(draft, true);
      const existing = store().templates.find(t => t.id === draft.id);
      if (existing && existing.updatedAt !== baseStamp)
        throw Error(
          'This template changed elsewhere. Export your draft, then reopen the saved template before replacing it.'
        );
      const saved = E.copy(draft);
      saved.updatedAt = new Date().toISOString();
      const ok = a.mutate(d => {
        const list = d.workhub.validator.templates,
          i = list.findIndex(t => t.id === saved.id);
        if (i < 0) list.push(saved);
        else list[i] = saved;
      });
      if (!ok) return false;
      draft = saved;
      selected = saved.id;
      baseStamp = saved.updatedAt;
      dirty = false;
      if (!quiet) say('Template draft saved.');
      return true;
    }
    function publish() {
      commitCurrent();
      E.checkSchema(draft);
      if (draft.releases.length >= E.LIMITS.versions)
        throw Error(
          'This template has 15 published versions. Duplicate it to start a new version series.'
        );
      if (!saveDraft(true)) return;
      const release = {
        version: (draft.releases.at(-1)?.version || 0) + 1,
        publishedAt: new Date().toISOString(),
        schema: E.schema(draft),
      };
      draft.releases.push(release);
      dirty = true;
      if (saveDraft(true)) {
        version = String(release.version);
        result = null;
        resetReview();
        say('Version ' + version + ' published. Its rules are now frozen.');
        paint();
      }
    }
    function library() {
      const list = store().templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
      );
      return (
        '<aside class="val-library"><div class="val-library-heading"><span>Your templates</span><span>' +
        store().templates.length +
        '</span></div><label class="val-search"><span class="sr-only">Find a template</span><input id="valSearch" type="search" placeholder="Find a template…" value="' +
        esc(search) +
        '"></label><div class="val-template-list">' +
        list
          .map(t =>
            btn(
              'open',
              icon('file', 18) +
                '<span><strong>' +
                esc(t.name) +
                '</strong><small>' +
                t.columns.length +
                ' columns · ' +
                (t.mode === 'sap' ? 'SAP · ' : 'General · ') +
                (t.releases.length ? 'v' + t.releases.at(-1).version : 'Draft') +
                (t.projectId ? ' · ' + esc(projectName(t)) : '') +
                '</small></span>',
              'data-id="' + esc(t.id) + '"',
              t.id === selected ? 'is-active' : ''
            )
          )
          .join('') +
        (!list.length ? '<p class="val-muted">Your next useful template starts here.</p>' : '') +
        '</div>' +
        btn('new', '＋ New template', '', 'val-wide') +
        btn('import-setup', 'Import Excel setup', '', 'val-wide val-secondary') +
        '<a class="val-btn val-wide val-secondary val-setup-download" href="./validation-setup-simple.xlsx" download>Download simple General setup</a><a class="val-btn val-wide val-quiet val-setup-download" href="./validation-setup-sap.xlsx" download>Download simple SAP setup</a>' +
        btn('setup-help', 'How to fill the setup', '', 'val-wide val-quiet') +
        '<p class="val-setup-help">One sheet. Choose the template type, replace the example field rows, then import. Up to 200 fields.</p><details class="val-setup-advanced"><summary>Advanced setup: conditions &amp; references</summary><p>Optional. Use this when you want to maintain conditions and reference lists in Excel.</p><a class="val-btn val-wide val-quiet" href="./validation-setup-template.xlsx?v=20261026-sap-200-simple-1" download>Download advanced setup template</a></details>' +
        btn('import-definition', 'Import definition', '', 'val-wide val-quiet') +
        '<div class="val-library-note">' +
        icon('leaf', 24) +
        '<p>Make the rules once.<br>Use them whenever you need.</p></div></aside>'
      );
    }
    function empty() {
      return (
        '<div class="val-welcome"><div class="val-welcome-art"><div class="val-paper val-paper-back"></div><div class="val-paper">' +
        icon('columns', 60) +
        '<i></i><i></i><i></i></div><span class="val-art-check">' +
        icon('check', 28) +
        '</span><span class="val-art-spark">' +
        icon('spark', 25) +
        '</span></div><span class="val-eyebrow">A HOME FOR YOUR DATA RULES</span><h2>Any file. Your rules.</h2><p>Give your columns a name, shape the conditions and let your data tell you what needs attention.</p><div class="val-actions">' +
        btn('new', 'Create a template', '', 'val-primary') +
        btn('example', 'Explore an example', '', 'val-secondary') +
        '</div><div class="val-welcome-steps"><span>' +
        icon('columns') +
        'Design columns</span><span>' +
        icon('rules') +
        'Build conditions</span><span>' +
        icon('check') +
        'Check & correct</span></div><small>XLSX, CSV and TSV · No SAP connection needed</small></div>'
      );
    }
    function header() {
      const latest = draft.releases.at(-1);
      return (
        '<div class="val-work-head"><div><span class="val-eyebrow">' +
        (latest ? 'PUBLISHED v' + latest.version : 'YOUR WORKING DRAFT') +
        '</span><h2>' +
        esc(draft.name || 'Untitled template') +
        '</h2><p>' +
        esc(draft.description || 'A flexible home for columns, conditions and clean data.') +
        '</p>' +
        (draft.projectId
          ? '<span class="val-scope-badge">Project · ' + esc(projectName(draft)) + '</span>'
          : '') +
        '<span id="valDraftStatus" class="val-save-state">' +
        (dirty ? 'Unsaved draft' : 'Draft saved') +
        '</span></div><div class="val-actions">' +
        btn('save', 'Save draft', '', 'val-secondary') +
        btn('publish', icon('spark', 16) + ' Publish version', '', 'val-primary') +
        '<details class="val-more"><summary aria-label="Template options">•••</summary><div>' +
        btn('export-definition', 'Export definition') +
        btn('duplicate', 'Duplicate template') +
        btn('copy-template', 'Copy to project / companies…') +
        btn('delete-template', 'Delete template', '', 'val-danger') +
        '</div></details></div></div><nav class="val-tabs" aria-label="Validation workspace">' +
        [
          ['columns', 'Columns', 'columns'],
          ['rules', 'Conditions', 'rules'],
          ...(draft.mode === 'sap' || draft.columnGroups?.length
            ? [['column-groups', 'Column groups', 'columns']]
            : []),
          ['references', 'References', 'reference'],
          ['check', 'Validate', 'check'],
          ['history', 'Versions & runs', 'history'],
        ]
          .map(([key, label, art]) =>
            btn(
              'mode',
              icon(art, 17) + label,
              'data-mode="' + key + '" aria-current="' + (mode === key ? 'page' : 'false') + '"',
              mode === key ? 'is-active' : ''
            )
          )
          .join('') +
        '</nav>'
      );
    }
    function projectName(t) {
      return (
        a.state().projects.find(p => p.id === t.projectId)?.name ||
        t.projectName ||
        'Unavailable project'
      );
    }
    function projectOptions() {
      const projects = a.state().projects;
      return [
        ['', 'Standalone · no project link'],
        ...projects.map(p => [p.id, p.name]),
        ...(draft.projectId && !projects.some(p => p.id === draft.projectId)
          ? [[draft.projectId, (draft.projectName || 'Saved project') + ' (unavailable)']]
          : []),
      ];
    }
    function companyScopeEditor(r) {
      const companies = a
          .state()
          .projectCompanies.filter(c => c.projectId === draft.projectId && c.active !== false),
        retained = (r.companies || []).filter(saved => !companies.some(c => c.id === saved.id));
      return (
        '<fieldset class="val-company-scope"><legend>Company scope</legend>' +
        select(
          'companyScope',
          'Apply this condition to',
          [
            ['all', draft.projectId ? 'All companies in this project' : 'All validation runs'],
            ...(draft.projectId ? [['selected', 'Selected companies only']] : []),
          ],
          r.companyScope || 'all'
        ) +
        (!draft.projectId
          ? '<p class="val-help">Link this template to a project in Columns to maintain company-specific conditions.</p>'
          : '<div class="val-company-choices"' +
            (r.companyScope !== 'selected' ? ' hidden' : '') +
            '><p class="val-help">Choose one or more companies from ' +
            esc(projectName(draft)) +
            '. This condition runs only for those companies.</p><div class="val-check-list">' +
            [...companies, ...retained]
              .map(
                c =>
                  '<label class="val-toggle"><input type="checkbox" name="ruleCompany" value="' +
                  esc(c.id) +
                  '"' +
                  ((r.companies || []).some(saved => saved.id === c.id) ? ' checked' : '') +
                  '><span>' +
                  esc(c.name) +
                  (retained.includes(c) ? ' (inactive or unavailable)' : '') +
                  '</span></label>'
              )
              .join('') +
            '</div>' +
            (!companies.length
              ? '<p class="val-help">Add or activate companies in Projects → Companies &amp; processes.</p>'
              : '') +
            '</div>') +
        '<p class="val-help">Column checks and conditions for all companies still apply alongside company-specific conditions.</p></fieldset>'
      );
    }
    function sapColumnFields(c) {
      const settings = E.sapSettings(c),
        spec = settings.spec || E.SAP_TYPES.CHAR;
      const referenceType =
        settings.type === 'CURR' ? 'CUKY' : settings.type === 'QUAN' ? 'UNIT' : '';
      return (
        select(
          'sapType',
          'SAP data type (DDIC)',
          Object.entries(E.SAP_TYPES).map(([id, s]) => [id, id + ' · ' + s.label]),
          settings.type
        ) +
        input(
          'sapLength',
          settings.type === 'RAW' ? 'SAP length (bytes)' : 'SAP length (digits / characters)',
          settings.length,
          'number',
          'min="' +
            (spec.min || spec.length) +
            '" max="' +
            (spec.max || spec.length) +
            '"' +
            (spec.min ? '' : ' readonly')
        ) +
        input(
          'sapDecimals',
          'SAP decimal places',
          settings.decimals,
          'number',
          'min="' +
            (settings.type === 'CURR' ? 1 : 0) +
            '" max="14"' +
            (spec.decimals === undefined ? ' readonly' : '')
        ) +
        (referenceType
          ? select(
              'sapReference',
              referenceType === 'CUKY' ? 'Currency field (optional)' : 'Unit field (optional)',
              [
                ['', 'Format only · no reference field'],
                ...draft.columns
                  .filter(f => f.id !== c.id && E.sapSettings(f).type === referenceType)
                  .map(f => [f.key, f.label + ' (' + f.key + ')']),
              ],
              settings.reference
            )
          : '') +
        '<div class="val-sap-format"><strong>SAP format check · automatic</strong><p>' +
        esc(spec.format) +
        '</p><small>Use your actual SE11/DDIC length and scale. Domain values, conversion exits and system-specific currency rules need your own Conditions or References. No values are padded, rounded or converted.</small></div>'
      );
    }
    function columnEditor() {
      const c = draft.columns.find(c => c.id === columnId) || draft.columns[0];
      if (c) columnId = c.id;
      return (
        '<div class="val-section-heading"><div><h3>Give your data a shape</h3><p>Display labels for people. Technical field names for your rules.</p></div>' +
        '<div class="val-actions">' +
        btn('import-setup', 'Import Excel setup', '', 'val-secondary') +
        btn('field-library', 'Field library', '', 'val-secondary') +
        btn('add-column', '＋ Add column', '', 'val-secondary') +
        '</div>' +
        '</div><div class="val-designer"><div class="val-outline"><div class="val-outline-title">UPLOAD COLUMNS <span>' +
        draft.columns.length +
        '/' +
        E.LIMITS.columns +
        '</span></div>' +
        draft.columns
          .map(
            (f, i) =>
              '<div class="val-column-item' +
              (f.id === columnId ? ' is-active' : '') +
              '" draggable="true" data-column-id="' +
              esc(f.id) +
              '">' +
              btn(
                'select-column',
                '<span class="val-grip">⠿</span><span class="val-col-index">' +
                  F.col(i) +
                  '</span><span><strong>' +
                  esc(f.label) +
                  '</strong><code>' +
                  esc(f.key) +
                  '</code></span>' +
                  (f.required ? '<b title="Required">*</b>' : ''),
                'data-id="' + esc(f.id) + '"'
              ) +
              '<div class="val-order">' +
              btn(
                'move-column',
                '↑',
                'data-id="' +
                  esc(f.id) +
                  '" data-delta="-1" aria-label="Move ' +
                  esc(f.label) +
                  ' up"' +
                  (!i ? ' disabled' : '')
              ) +
              btn(
                'move-column',
                '↓',
                'data-id="' +
                  esc(f.id) +
                  '" data-delta="1" aria-label="Move ' +
                  esc(f.label) +
                  ' down"' +
                  (i === draft.columns.length - 1 ? ' disabled' : '')
              ) +
              '</div></div>'
          )
          .join('') +
        (!draft.columns.length
          ? '<div class="val-empty-small">' +
            icon('columns', 34) +
            '<p>Add your first column.<br>You decide what belongs here.</p></div>'
          : '') +
        '</div><div class="val-inspector"><form id="valMetaForm" class="val-meta">' +
        input('name', 'Template name', draft.name, 'text', 'maxlength="120" required') +
        select(
          'mode',
          'Template type',
          [
            ['general', 'General · existing checks'],
            ['sap', 'SAP · DDIC field formats'],
          ],
          draft.mode || 'general'
        ) +
        area(
          'description',
          'A little context',
          draft.description,
          'maxlength="2000" rows="2" placeholder="What will this template help you check?"'
        ) +
        select('projectId', 'Linked project', projectOptions(), draft.projectId || '') +
        '<p class="val-help">Optional. Use one template for multiple companies, then assign each condition in Conditions. Companies are maintained in Projects → Companies &amp; processes.</p>' +
        '</form>' +
        (c
          ? '<form id="valColumnForm" data-id="' +
            esc(c.id) +
            '"><div class="val-panel-title"><div><span class="val-eyebrow">COLUMN DETAILS</span><h3>' +
            esc(c.label) +
            '</h3></div>' +
            '<div class="val-actions">' +
            btn('field-save', 'Keep this field', '', 'val-secondary') +
            btn('remove-column', 'Remove', 'data-id="' + esc(c.id) + '"', 'val-quiet val-danger') +
            '</div>' +
            '</div><div class="val-fields">' +
            input('label', 'Column label', c.label, 'text', 'maxlength="120" required') +
            input(
              'key',
              'Technical field name',
              c.key,
              'text',
              'maxlength="64" spellcheck="false" autocapitalize="off" required'
            ) +
            (draft.mode === 'sap'
              ? sapColumnFields(c)
              : select(
                  'type',
                  'Data type',
                  E.TYPES.map(x => [
                    x,
                    x === 'integer'
                      ? 'Whole number'
                      : x === 'decimal'
                        ? 'Decimal number'
                        : x[0].toUpperCase() + x.slice(1),
                  ]),
                  c.type
                ) +
                select(
                  'format',
                  'Format check',
                  [['', 'Any format'], ...Object.keys(E.FORMATS).map(x => [x, x])],
                  c.format
                ) +
                input('minLength', 'Minimum length', c.minLength, 'number', 'min="0" max="32000"') +
                input('maxLength', 'Maximum length', c.maxLength, 'number', 'min="0" max="32000"') +
                input('min', 'Minimum number', c.min, 'number', 'step="any"') +
                input('max', 'Maximum number', c.max, 'number', 'step="any"')) +
            '</div><div class="val-toggle-grid">' +
            toggle('required', 'Required', c.required) +
            toggle('unique', 'Unique values', c.unique) +
            toggle('trim', 'Ignore surrounding spaces', c.trim) +
            toggle('caseSensitive', 'Case-sensitive comparisons', c.caseSensitive) +
            '</div>' +
            area(
              'values',
              'Allowed values',
              c.values,
              'rows="3" placeholder="One value per line, or comma separated" maxlength="8000"'
            ) +
            input(
              'aliases',
              'Other accepted upload headers',
              c.aliases,
              'text',
              'placeholder="Separate alternative headers with commas" maxlength="8000"'
            ) +
            area(
              'description',
              'Instructions for this column',
              c.description,
              'rows="2" maxlength="8000"'
            ) +
            '<p class="val-help">' +
            (draft.mode === 'sap'
              ? 'SAP uses internal field formats. DATS uses YYYYMMDD (00000000 is an initial value), TIMS uses HHMMSS. Keep codes and long numbers as Excel Text. General settings are preserved but inactive.'
              : 'Dates use YYYY-MM-DD. Keep identifiers as Text to preserve leading zeros and every digit. Number limits apply to whole-number and decimal columns.') +
            '</p><button class="val-btn val-secondary" type="submit">Apply column changes</button></form>'
          : '<p class="val-muted">Your column settings will appear here.</p>') +
        '</div></div><section class="val-card val-combinations"><div><h3>Unique combinations</h3><p>For example: the same ID may appear in different plants, but each ID + plant pair must be unique.</p></div>' +
        draft.uniqueGroups
          .map(
            (g, i) =>
              '<div class="val-combination"><span>' +
              g.map(k => '<code>' + esc(k) + '</code>').join(' + ') +
              '</span>' +
              btn(
                'remove-combination',
                '×',
                'data-index="' + i + '" aria-label="Remove unique combination"',
                'val-quiet'
              ) +
              '</div>'
          )
          .join('') +
        '<form id="valUniqueForm"><div class="val-check-list">' +
        draft.columns.map(c => toggle(c.key, esc(c.label), false)).join('') +
        '</div><button type="submit" class="val-btn val-secondary">Add selected combination</button></form></section>'
      );
    }
    function commitColumnGroup() {
      const form = $('valColumnGroupForm');
      if (!form || !draft) return;
      const group = draft.columnGroups?.find(g => g.id === form.dataset.id);
      if (!group) throw Error('Reopen this column group.');
      const fields = Array.from(form.querySelectorAll('[name="groupField"]:checked')).map(
        el => el.value
      );
      if (!fields.length) throw Error('Select at least one grouped column.');
      if (E.groupReferences(draft, group.id).some(c => !fields.includes(c.field)))
        throw Error(
          'A condition uses a column you removed from this group. Update that condition first.'
        );
      const values = new Map(
        Array.from(form.querySelectorAll('[data-group-value]')).map(el => [
          el.dataset.groupValue,
          el.value,
        ])
      );
      const proposed = E.copy(group);
      proposed.name = form.elements.namedItem('groupName').value.trim();
      proposed.fields = fields;
      for (const set of proposed.sets) {
        set.values = Object.fromEntries(
          fields.map(key => [
            key,
            set.id === form.dataset.set && values.has(key)
              ? values.get(key)
              : set.values[key] || '',
          ])
        );
        if (set.id === form.dataset.set) set.name = form.elements.namedItem('setName').value.trim();
      }
      const check = {
        ...draft,
        columnGroups: draft.columnGroups.map(g => (g.id === group.id ? proposed : g)),
      };
      E.checkColumnGroups(check);
      draft.columnGroups = check.columnGroups;
    }
    function columnGroupValue(key, set) {
      const column = draft.columns.find(c => c.key === key);
      return `<label class="val-label" data-group-field="${esc(key)}">${esc(column.label)} <code>${esc(key)}</code><textarea data-group-value="${esc(key)}" maxlength="8000" rows="2" placeholder="Values separated by commas, e.g. 60,50">${esc(set.values[key])}</textarea></label>`;
    }
    // Keep the expanded picker and its inputs mounted while membership changes.
    // Only add/remove value fields; a workspace render closes details and loses focus.
    function patchColumnGroup(form) {
      const group = draft.columnGroups.find(g => g.id === form.dataset.id),
        set = group.sets.find(v => v.id === form.dataset.set),
        grid = form.querySelector('.val-group-values'),
        previous = new Map(Array.from(grid.children).map(el => [el.dataset.groupField, el]));
      let cursor = grid.firstElementChild;
      for (const key of group.fields) {
        let node = previous.get(key);
        if (!node) {
          const template = document.createElement('template');
          template.innerHTML = columnGroupValue(key, set);
          node = template.content.firstElementChild;
        }
        if (cursor !== node) grid.insertBefore(node, cursor);
        cursor = node.nextElementSibling;
        previous.delete(key);
      }
      for (const node of previous.values()) node.remove();
      form.querySelector('.val-group-columns summary').textContent =
        'Grouped columns · ' + group.fields.length;
      const outline = Array.from(
        document.querySelectorAll('[data-val="column-group-select"]')
      ).find(el => el.dataset.id === group.id);
      if (outline) {
        outline.querySelector('strong').textContent = group.name;
        outline.querySelector('small').textContent =
          group.fields.length + ' columns · ' + group.sets.length + ' saved sets';
      }
      form.elements.namedItem('groupSet').selectedOptions[0].textContent = set.name;
    }
    function columnGroupsEditor() {
      const groups = draft.columnGroups || [],
        group = groups.find(g => g.id === columnGroupId) || groups[0];
      const set = group?.sets.find(v => v.id === valueSetId) || group?.sets[0];
      columnGroupId = group?.id || '';
      valueSetId = set?.id || '';
      return `<div class="val-section-heading"><div><h3>Related columns. Reusable setups.</h3><p>Keep common column checks, then choose a named value set in each condition.</p></div>${btn('column-group-add', '＋ New column group', !draft.columns.length ? 'disabled' : '', 'val-secondary')}</div><div class="val-designer"><aside class="val-outline"><div class="val-outline-title">COLUMN GROUPS <span>${groups.length}</span></div>${groups.map(g => btn('column-group-select', `<span><strong>${esc(g.name)}</strong><small>${g.fields.length} columns · ${g.sets.length} saved sets</small></span>`, 'data-id="' + esc(g.id) + '"', g.id === group?.id ? 'is-active' : '')).join('') || '<p class="val-help">Create a group such as Sales area or Plant setup.</p>'}</aside><section class="val-inspector">${
        group && set
          ? `<form id="valColumnGroupForm" data-id="${esc(group.id)}" data-set="${esc(set.id)}"><div class="val-panel-title"><span class="val-eyebrow">GROUPED SAP VALUES</span>${btn('column-group-remove', 'Remove group', 'data-id="' + esc(group.id) + '"', 'val-quiet val-danger')}</div>${input('groupName', 'Column group name', group.name, 'text', 'maxlength="120" required')}<details class="val-group-columns"><summary>Grouped columns · ${group.fields.length}</summary><div class="val-check-list">${draft.columns.map(c => `<label class="val-toggle"><input type="checkbox" name="groupField" value="${esc(c.key)}"${group.fields.includes(c.key) ? ' checked' : ''}><span>${esc(c.label)} <code>${esc(c.key)}</code></span></label>`).join('')}</div></details><div class="val-set-picker">${select(
              'groupSet',
              'Saved value set',
              group.sets.map(v => [v.id, v.name]),
              set.id
            )}<div class="val-actions">${btn('value-set-add', '＋ New set', '', 'val-quiet')}${btn('value-set-duplicate', 'Duplicate as new set', '', 'val-secondary')}${btn('value-set-remove', 'Remove set', '', 'val-quiet val-danger')}</div></div><p class="val-help">Duplicate this set before changing values to keep the previous setup. Each condition chooses its own saved set; other column checks stay the same.</p>${input('setName', 'Value set name', set.name, 'text', 'maxlength="120" required')}<div class="val-group-values">${group.fields.map(key => columnGroupValue(key, set)).join('')}</div><div class="val-actions"><button type="submit" class="val-btn val-primary">Apply group changes</button>${btn('value-set-condition', 'Use this set in a condition', '', 'val-secondary')}</div><p class="val-help">Values keep leading zeros and follow each column’s SAP type. Keep global Allowed values blank when they would conflict with different sets.</p></form>`
          : '<div class="val-empty-small"><h3>One template. Several setups.</h3><p>Group Sales Organization, Distribution Channel and Division. Save one set for FPSO and another for a different organization.</p></div>'
      }</section></div>`;
    }
    function groupValueControls(c) {
      const groups = (draft.columnGroups || []).filter(g => g.fields.includes(c.field)),
        g = groups.find(g => g.id === c.groupId) || groups[0];
      const set = g?.sets.find(v => v.id === c.valueSetId) || g?.sets[0];
      return `<div class="val-group-binding"><label class="val-label">Column group<select data-clause="groupId">${options(
        groups.map(g => [g.id, g.name]),
        g?.id
      )}</select></label><label class="val-label">Value set<select data-clause="valueSetId">${options(
        (g?.sets || []).map(v => [v.id, v.name]),
        set?.id
      )}</select></label><small>Values: ${esc(set?.values[c.field] || '(empty — maintain this set first)')}</small></div>`;
    }
    function clause(c, path, assertion = false) {
      const fields = draft.columns.map(f => [f.key, f.label + ' (' + f.key + ')']),
        op = c.operator || 'eq',
        reference = draft.lookups.find(l => l.id === c.lookupId) || draft.lookups[0];
      const control = (key, rows, value) =>
        '<select data-clause="' +
        key +
        '" aria-label="' +
        key +
        '">' +
        options(rows, value) +
        '</select>';
      return (
        '<div class="val-clause" data-path="' +
        esc(path) +
        '"' +
        (assertion ? ' data-assertion' : '') +
        '>' +
        control('field', fields, c.field) +
        control('operator', Object.entries(E.OPS), op) +
        (E.GROUP_OPS.includes(op) &&
        (draft.columnGroups || []).some(g => g.fields.includes(c.field))
          ? '<label class="val-label val-value-source">Value source' +
            control(
              'valueSource',
              [
                ['literal', 'Enter values'],
                ['group', 'Saved column group'],
              ],
              c.valueSource || 'literal'
            ) +
            '</label>'
          : '') +
        (c.valueSource === 'group' && E.GROUP_OPS.includes(op)
          ? groupValueControls(c)
          : op.startsWith('field')
            ? control('otherField', fields, c.otherField)
            : op === 'lookupTuple'
              ? tupleView(c, path, reference, fields)
              : op === 'lookup'
                ? '<div class="val-lookup-select">' +
                  control(
                    'lookupId',
                    draft.lookups.map(l => [l.id, l.name]),
                    c.lookupId || reference?.id
                  ) +
                  control(
                    'lookupColumn',
                    (reference?.headers || []).map(h => [h, h]),
                    c.lookupColumn
                  ) +
                  '</div>'
                : op === 'pattern'
                  ? control(
                      'value',
                      Object.keys(E.FORMATS).map(f => [f, f]),
                      c.value
                    )
                  : ['empty', 'notEmpty'].includes(op)
                    ? '<span class="val-clause-note">No value needed</span>'
                    : '<input data-clause="value" aria-label="Condition value" value="' +
                      esc(c.value) +
                      '" placeholder="Value' +
                      (['in', 'notIn'].includes(op) ? 's, separated by commas' : '') +
                      '" maxlength="8000">') +
        (!assertion
          ? btn(
              'remove-clause',
              '×',
              'data-path="' + esc(path) + '" aria-label="Remove condition"',
              'val-quiet'
            )
          : '') +
        '</div>'
      );
    }
    function tupleView(c, path, reference, fields) {
      const pairs = c.pairs?.length
        ? c.pairs
        : [
            { field: c.field, referenceColumn: reference?.headers[0] || '' },
            {
              field: draft.columns.find(f => f.key !== c.field)?.key || '',
              referenceColumn: reference?.headers[1] || '',
            },
          ];
      return (
        '<div class="val-tuple"><label class="val-label">Trusted reference<select data-clause="lookupId" aria-label="lookupId">' +
        options(
          draft.lookups.map(l => [l.id, l.name]),
          c.lookupId || reference?.id
        ) +
        '</select></label><p class="val-help">All mapped values must match the same reference row. The field above is highlighted when this check fails.</p>' +
        pairs
          .map(
            (pair, i) =>
              '<div class="val-tuple-pair" data-tuple-pair><select data-pair-field aria-label="Upload field ' +
              (i + 1) +
              '">' +
              options(fields, pair.field) +
              '</select><span>→</span><select data-pair-reference aria-label="Reference column ' +
              (i + 1) +
              '">' +
              options(
                (reference?.headers || []).map(h => [h, h]),
                pair.referenceColumn
              ) +
              '</select>' +
              btn(
                'tuple-remove',
                '×',
                'data-path="' +
                  esc(path) +
                  '" data-index="' +
                  i +
                  '" aria-label="Remove mapping ' +
                  (i + 1) +
                  '"' +
                  (pairs.length <= 2 ? ' disabled' : ''),
                'val-quiet'
              ) +
              '</div>'
          )
          .join('') +
        btn(
          'tuple-add',
          '＋ Map another field',
          'data-path="' + esc(path) + '"' + (pairs.length >= 10 ? ' disabled' : ''),
          'val-quiet'
        ) +
        '</div>'
      );
    }
    function groupView(g, path, depth = 0) {
      return (
        '<div class="val-condition-group" data-path="' +
        path +
        '"' +
        (!depth ? ' data-group-root' : '') +
        '><div class="val-group-head"><span>' +
        (depth ? 'Nested group' : 'WHEN') +
        '</span><select aria-label="Condition group logic">' +
        options(
          [
            ['all', 'ALL of these (AND)'],
            ['any', 'ANY of these (OR)'],
          ],
          g.join
        ) +
        '</select>' +
        (depth
          ? btn(
              'remove-group',
              '×',
              'data-path="' + path + '" aria-label="Remove nested group"',
              'val-quiet'
            )
          : '') +
        '</div><div class="val-group-items">' +
        g.conditions.map((c, i) => clause(c, path + '.conditions.' + i)).join('') +
        g.groups.map((child, i) => groupView(child, path + '.groups.' + i, depth + 1)).join('') +
        (!g.conditions.length && !g.groups.length
          ? '<p class="val-every-row">Every row. Add a condition to make this rule conditional.</p>'
          : '') +
        '</div><div class="val-group-actions">' +
        btn('add-clause', '＋ Condition', 'data-path="' + path + '"', 'val-quiet') +
        (depth < 4
          ? btn('add-group', '＋ AND/OR group', 'data-path="' + path + '"', 'val-quiet')
          : '') +
        '</div></div>'
      );
    }
    function getPath(path) {
      let value = draft.rules.find(r => r.id === ruleId);
      for (const k of path.split('.')) {
        if (!/^(when|assertion|additionalAssertions|groups|conditions|\d+)$/.test(k))
          throw Error('Invalid condition path.');
        value = value[k];
      }
      return value;
    }
    function requirementsSummary(r) {
      const summary = E.describeRequirements(r, draft);
      return summary.length > 4000
        ? summary.slice(0, 4000) + '… (see all field checks above)'
        : summary;
    }
    function requirementsView(r) {
      const checks = E.requirements(r);
      return (
        '<section class="val-then" aria-label="THEN requirements"><div class="val-then-heading"><span class="val-eyebrow">THEN REQUIRE</span><span class="val-chip">' +
        checks.length +
        ' requirement' +
        (checks.length === 1 ? '' : 's') +
        ' · ALL must pass</span></div><p class="val-help">For records matching WHEN, all field requirements below must pass.</p>' +
        checks
          .map(
            (c, i) =>
              '<div class="val-requirement" data-requirement="' +
              i +
              '"><div class="val-requirement-heading"><strong>' +
              (i ? 'AND · ' : '') +
              'Requirement ' +
              (i + 1) +
              '</strong>' +
              (checks.length > 1
                ? btn(
                    'remove-requirement',
                    'Remove',
                    'data-index="' + i + '" aria-label="Remove requirement ' + (i + 1) + '"',
                    'val-quiet'
                  )
                : '') +
              '</div>' +
              clause(c, i ? 'additionalAssertions.' + (i - 1) : 'assertion', true) +
              '</div>'
          )
          .join('') +
        btn(
          'add-requirement',
          '＋ Add field requirement',
          checks.length >= E.LIMITS.requirements ? 'disabled' : '',
          'val-secondary'
        ) +
        '</section>'
      );
    }
    function rulesEditor() {
      const r = draft.rules.find(r => r.id === ruleId) || draft.rules[0];
      if (r) ruleId = r.id;
      return (
        '<div class="val-section-heading"><div><h3>Small conditions. Clear answers.</h3><p>Combine AND/OR groups, compare fields and choose what an issue should say.</p></div>' +
        '<div class="val-actions">' +
        btn('copy-conditions', 'Copy conditions…', '', 'val-secondary') +
        btn(
          'add-rule',
          '＋ Add condition',
          !draft.columns.length ? 'disabled' : '',
          'val-secondary'
        ) +
        '</div></div><div class="val-designer"><div class="val-outline"><div class="val-outline-title">YOUR CONDITIONS <span>' +
        draft.rules.length +
        '</span></div>' +
        draft.rules
          .map(r =>
            btn(
              'select-rule',
              '<span class="val-rule-dot ' +
                r.severity +
                '"></span><span><strong>' +
                esc(r.name) +
                '</strong><small>' +
                (r.enabled ? (r.severity === 'warning' ? 'Warning' : 'Error') : 'Paused') +
                ' · ' +
                esc(
                  r.companyScope === 'selected'
                    ? (r.companies || []).map(c => c.name).join(', ') || 'Choose companies'
                    : 'All companies'
                ) +
                '</small></span>',
              'data-id="' + esc(r.id) + '"',
              r.id === ruleId ? 'is-active' : ''
            )
          )
          .join('') +
        (!draft.rules.length
          ? '<div class="val-empty-small">' +
            icon('rules', 34) +
            '<p>Basic column checks already work. Add conditions for your business rules.</p></div>'
          : '') +
        '</div><div class="val-inspector">' +
        (r
          ? '<form id="valRuleForm" data-id="' +
            esc(r.id) +
            '"><div class="val-panel-title"><span class="val-eyebrow">VISUAL CONDITION BUILDER</span>' +
            btn('remove-rule', 'Remove', 'data-id="' + esc(r.id) + '"', 'val-quiet val-danger') +
            '</div><div class="val-fields">' +
            input('name', 'Rule name', r.name, 'text', 'maxlength="160" required') +
            select(
              'severity',
              'When this fails',
              [
                ['error', 'Error — must be corrected'],
                ['warning', 'Warning — needs review'],
              ],
              r.severity
            ) +
            '</div>' +
            toggle('enabled', 'Enable this condition', r.enabled) +
            companyScopeEditor(r) +
            groupView(r.when, 'when') +
            requirementsView(r) +
            area(
              'message',
              'Your validation message',
              r.message,
              'maxlength="1000" rows="2" placeholder="Explain what needs to change"'
            ) +
            '<div class="val-rule-summary">' +
            icon('leaf', 18) +
            '<p>If ' +
            esc(F.describeGroup(r.when, draft)) +
            ', require ' +
            esc(requirementsSummary(r)) +
            '.</p></div><button type="submit" class="val-btn val-secondary">Apply condition</button></form>'
          : '<div class="val-empty-small"><h3>Let your rules do the checking.</h3><p>“If type is Urgent, require an owner.”<br>“End date must be after start date.”<br>“This value must exist in my reference list.”</p></div>') +
        '</div></div>'
      );
    }
    function references() {
      const current = draft.lookups.find(l => l.id === refEditing);
      return (
        '<div class="val-section-heading"><div><h3>Your trusted reference shelf</h3><p>Maintain your own codes and values, then check individual values or a combination in the same reference row.</p></div>' +
        btn('reference-new', '＋ New reference', '', 'val-secondary') +
        '</div><div class="val-reference-grid">' +
        draft.lookups
          .map(
            l =>
              '<article class="val-card"><span class="val-ref-icon">' +
              icon('reference', 26) +
              '</span><h3>' +
              esc(l.name) +
              '</h3><p>' +
              l.rows.length +
              ' rows · ' +
              l.headers.length +
              ' columns</p><div class="val-ref-tags">' +
              l.headers.map(h => '<code>' + esc(h) + '</code>').join('') +
              '</div><div class="val-actions">' +
              btn('reference-edit', 'Edit list', 'data-id="' + esc(l.id) + '"', 'val-secondary') +
              btn(
                'reference-remove',
                'Remove',
                'data-id="' + esc(l.id) + '"',
                'val-quiet val-danger'
              ) +
              '</div></article>'
          )
          .join('') +
        '</div><section class="val-card"><form id="valReferenceForm" data-val-context="' +
        referenceEpoch +
        '" data-id="' +
        esc(current?.id || '') +
        '"><div class="val-panel-title"><h3>' +
        (current ? 'Edit ' + esc(current.name) : 'Add a reference list') +
        '</h3>' +
        btn('reference-file', icon('upload', 16) + ' Import file', '', 'val-secondary') +
        '</div>' +
        input(
          'name',
          'List name',
          current?.name || '',
          'text',
          'maxlength="120" placeholder="For example: Approved cost centres" required'
        ) +
        area(
          'data',
          'Headers and values',
          current ? E.csv([current.headers, ...current.rows]).replace(/^\uFEFF/, '') : '',
          'rows="7" placeholder="CODE,DESCRIPTION\n1000,Head office\n2000,Regional office" required'
        ) +
        (current
          ? '<fieldset class="val-description-options"><legend>Readable reference details</legend><div class="val-fields">' +
            select(
              'codeColumn',
              'Code column',
              current.headers.map(h => [h, h]),
              current.codeColumn || current.headers[0]
            ) +
            select(
              'nameColumn',
              'Display-name column',
              [['', 'No display name'], ...current.headers.map(h => [h, h])],
              current.nameColumn || ''
            ) +
            '</div><p class="val-help">Choose up to five description columns. Matched codes can then be explained beside your results.</p><div class="val-check-list">' +
            current.headers
              .map(
                h =>
                  '<label class="val-toggle"><input type="checkbox" name="refDescription" value="' +
                  esc(h) +
                  '"' +
                  (current.descriptionColumns?.includes(h) ? ' checked' : '') +
                  '><span>' +
                  esc(h) +
                  '</span></label>'
              )
              .join('') +
            '</div></fieldset>'
          : '<p class="val-help">After adding the list, choose its code, display name and description columns here.</p>') +
        '<p class="val-help">Paste CSV/TSV with a header row, or import the first worksheet of an XLSX file. Up to 2,000 reference rows per list.</p><button class="val-btn val-primary" type="submit">' +
        (current ? 'Apply reference changes' : 'Add to draft') +
        '</button></form></section>'
      );
    }
    function getDataFromSheet() {
      if (!book) return;
      const sheet = book.sheets[sheetIndex];
      if (!sheet) throw Error('Choose a worksheet.');
      const start = headerRow - 1;
      headers = (sheet.rows[start] || []).map(v => String(v ?? '').trim());
      while (headers.length && !headers.at(-1)) headers.pop();
      sourceRows = sheet.rows
        .slice(start + 1)
        .map(row => Array.from({ length: headers.length }, (_, i) => String(row[i] ?? '')));
      while (sourceRows.length && sourceRows.at(-1).every(E.blank)) sourceRows.pop();
      if (!headers.length) throw Error('The selected header row is empty.');
      if (sourceRows.length > E.LIMITS.rows || sourceRows.length * headers.length > E.LIMITS.cells)
        throw Error('Use up to 25,000 rows and 5,000,000 cells.');
      resetPreparation();
      originalRows = sourceRows.map(r => r.slice());
      preparedRows = sourceRows.map(r => r.slice());
      origins = sourceRows.map((r, i) => ({ row: headerRow + i + 1, part: '' }));
      mapping = E.autoMap(headers, activeSchema());
      rows = [];
      result = null;
      resetReview();
      resultSchema = null;
      page = 0;
    }
    async function loadFile(file, kind = 'data') {
      ensure();
      if (!queueInternal && (queueBusy || queueIO))
        throw Error('Wait for the queue operation to finish.');
      if (!queueInternal && kind === 'data' && fileQueue.length)
        throw Error('Use Add files to extend the queue, or Clear queue to start a single file.');
      commitCurrent();
      if (!draft) throw Error('Create a template first.');
      const token = ++generation,
        account = owner;
      runner?.cancel();
      busy = true;
      say('Reading ' + file.name + '…');
      paint();
      try {
        const value = await F.read(file);
        if (token !== generation || account !== a.owner?.() || !a.ready()) return;
        if (kind === 'reference') {
          busy = false;
          mode = 'references';
          paint();
          const form = $('valReferenceForm');
          form.elements.namedItem('name').value = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
          form.elements.namedItem('data').value = E.csv(value.sheets[0].rows).replace(
            /^\uFEFF/,
            ''
          );
          say('Review the reference name and values, then add it to your draft.');
          return;
        }
        book = value;
        sheetIndex = 0;
        headerRow = 1;
        fileName = file.name;
        getDataFromSheet();
        mode = 'check';
        say('File ready. Check the column mapping before validating.');
      } finally {
        if (token === generation && account === a.owner?.()) {
          busy = false;
          paint();
        }
      }
    }
    function sapSample(c) {
      if (E.tokens(c.values).length) return E.tokens(c.values)[0];
      const s = E.sapSettings(c);
      if (s.type === 'DATS') return '20261026';
      if (s.type === 'TIMS') return '093000';
      if (s.type === 'NUMC' || s.type === 'CLNT') return '1'.padStart(s.length, '0');
      if (s.type === 'LANG') return 'E';
      if (s.type === 'CUKY') return 'MYR';
      if (s.type === 'UNIT') return 'KG';
      if (s.type === 'RAW') return '00'.repeat(s.length);
      if (s.spec.range) return '1';
      if (s.spec.decimals !== undefined)
        return (
          (s.length > s.decimals ? '1' : '0') + (s.decimals ? '.' + '0'.repeat(s.decimals) : '')
        );
      return 'Example'.slice(0, s.length);
    }
    function loadSample() {
      if (fileQueue.length) throw Error('Clear the queue before loading example data.');
      commitCurrent();
      generation++;
      runner?.cancel();
      cancelLive();
      busy = false;
      const t = activeSchema();
      E.checkSchema(t);
      const sample = t.columns.map(c =>
        t.mode === 'sap'
          ? sapSample(c)
          : c.type === 'date'
            ? '2026-10-20'
            : c.type === 'integer'
              ? '1'
              : c.type === 'decimal'
                ? '25.50'
                : c.type === 'boolean'
                  ? 'true'
                  : E.tokens(c.values)[0] || 'Example'
      );
      book = {
        sheets: [
          {
            name: 'Example data',
            rows: [
              t.columns.map(c => c.label),
              sample,
              sample.map((v, i) => (i === 0 ? 'Example 2' : v)),
            ],
          },
        ],
      };
      if (
        t.mode !== 'sap' &&
        t.columns.map(c => c.key).join(',') === 'REQUEST_ID,TYPE,OWNER,AMOUNT,START_DATE,END_DATE'
      )
        book.sheets[0].rows = [
          t.columns.map(c => c.label),
          ['REQ-001', 'Standard', 'Aisha', '250', '2026-10-20', '2026-10-22'],
          ['REQ-002', 'Urgent', '', '-5', '2026-10-22', '2026-10-20'],
          ['REQ-003', 'Standard', 'Daniel', '15000', '2026-10-23', '2026-10-24'],
        ];
      sheetIndex = 0;
      headerRow = 1;
      fileName = 'Example data';
      getDataFromSheet();
      mode = 'check';
      paint();
    }
    async function run() {
      ensure();
      if (root.WorkHubCurrentAccess && !root.WorkHubCurrentAccess.can('validator', 'run'))
        throw Error('Running validation is disabled for this account.');
      cancelLive();
      pinnedRows.clear();
      commitCurrent();
      const base = activeSchema();
      E.checkSchema(base);
      const context = E.runContext(a.state(), base, runCompanyId);
      const plan = setupPlan(base),
        t = plan.schema;
      const mapped = E.mapRows(headers, sourceRows, t, mapping);
      if (!mapped.length) throw Error('Upload or paste at least one data row.');
      if (version === 'draft') {
        if (root.WorkHubCurrentAccess && !root.WorkHubCurrentAccess.can('validator', 'edit')) {
          const saved = store().templates.find(saved => saved.id === draft.id);
          if (!saved || JSON.stringify(E.schema(saved)) !== JSON.stringify(E.schema(draft)))
            throw Error(
              'You can run saved templates. Ask the Owner to save these template changes first.'
            );
        } else if (!saveDraft(true)) return;
      }
      const token = ++generation,
        account = owner;
      runner?.cancel();
      busy = true;
      result = null;
      resetReview();
      rows = mapped;
      selectedIssue = null;
      targetRow = -1;
      say('Checking columns, conditions and references…');
      paint();
      await new Promise(resolve => root.setTimeout(resolve, 50));
      if (token !== generation || account !== a.owner?.() || !a.ready()) return;
      try {
        E.runContext(a.state(), t, context.companyId);
        const checked = runner
          ? await runner.run(t, rows, context)
          : E.validateRows(t, rows, context);
        if (token !== generation || account !== a.owner?.() || !a.ready()) return;
        // Company availability may change while a worker is running.
        E.runContext(a.state(), t, context.companyId);
        checked.setup = E.copy(plan.summary);
        rawResult = checked;
        result = reviewed(checked);
        resultSchema = E.copy(t);
        filter = 'all';
        page = 0;
        const summary = {
          id: E.uid(),
          templateId: draft.id,
          templateName: t.name,
          fileName: fileName.slice(0, 240),
          version: version === 'draft' ? 0 : Number(version),
          at: new Date().toISOString(),
          rows: checked.rows,
          passed: checked.passed,
          errors: checked.errors,
          warnings: checked.warnings,
          context: E.copy(context),
          setup: {
            name: plan.summary.name,
            profileId: runProfileId,
            conditions: plan.summary.conditions.length,
            references: plan.summary.references.length,
            skipped: plan.summary.skipped.length,
          },
        };
        currentRunId = summary.id;
        a.mutate(d => {
          const history = d.workhub.validator.runs;
          history.unshift(summary);
          if (history.length > 150) history.length = 150;
        });
        say(
          checked.errors
            ? checked.errors + ' errors found. Let’s tidy those up.'
            : checked.warnings
              ? 'No errors. ' + checked.warnings + ' warnings to review.'
              : 'All ' + checked.rows + ' rows passed. Nicely done.'
        );
      } catch (error) {
        if (error.name !== 'AbortError' || token === generation) throw error;
      } finally {
        if (token === generation) {
          busy = false;
          paint();
        }
      }
    }
    // Reconcile only result nodes. Keep keyed cells/buttons in place so blur does not
    // swallow the next click, and editing never rebuilds the surrounding workspace.
    function patchResults() {
      const current = $('valResultsArea');
      if (current) patchSurface(current, resultsView());
      const queue = $('valFileQueue');
      if (queue) patchSurface(queue, queueView());
      const status = document.querySelector('.validation-studio .val-message');
      if (status) status.textContent = message;
    }
    function checkEdit() {
      const check = liveCheck;
      if (!check) return;
      if (check.promise) return check.promise;
      root.clearTimeout(liveTimer);
      liveTimer = null;
      if (
        check.token !== generation ||
        check.owner !== a.owner?.() ||
        !a.ready() ||
        resultSchema !== check.schema
      ) {
        cancelLive();
        return;
      }
      const apply = checked => {
        if (
          check !== liveCheck ||
          check.token !== generation ||
          check.owner !== a.owner?.() ||
          !a.ready() ||
          resultSchema !== check.schema
        )
          return;
        E.runContext(a.state(), check.schema, runCompanyId);
        const setup = rawResult?.setup;
        rawResult = checked;
        if (setup) rawResult.setup = E.copy(setup);
        result = reviewed(rawResult);
        if (selectedIssue)
          selectedIssue =
            result.issues.find(
              i => i.index === selectedIssue.index && i.field === selectedIssue.field
            ) || null;
        message =
          'Edit checked automatically · ' +
          result.errors +
          ' errors · ' +
          result.warnings +
          ' warnings.';
      };
      const failed = error => {
        if (check !== liveCheck || check.token !== generation || check.owner !== a.owner?.())
          return;
        result = null;
        resetReview();
        resultSchema = null;
        selectedIssue = null;
        message = 'Automatic check could not finish. ' + error.message;
        a.tell?.(message, true);
      };
      const finish = () => {
        if (check === liveCheck) {
          cancelLive();
          patchResults();
        }
      };
      try {
        const context = E.runContext(a.state(), check.schema, runCompanyId);
        if (runner && rows.length * check.schema.columns.length >= 20000) {
          check.promise = runner
            .run(check.schema, rows, context)
            .then(apply)
            .catch(failed)
            .finally(finish);
          return check.promise;
        }
        apply(E.validateRows(check.schema, rows, context));
      } catch (error) {
        failed(error);
      }
      finish();
    }
    function editCell(index, field, value, immediate = false) {
      if (!rows[index] || !activeSchema().columns.some(c => c.key === field)) return;
      const source = Number(mapping[field]);
      if (!Number.isInteger(source) || source < 0)
        throw Error('Map this field before editing its value.');
      if (rows[index][field] === value && !livePending) return;
      for (const [key, decision] of ignoredIssues)
        if (decision.index === index) ignoredIssues.delete(key);
      issueSelection.clear();
      rows[index][field] = value;
      sourceRows[index][source] = value;
      root.clearTimeout(liveTimer);
      generation++;
      runner?.cancel();
      busy = false;
      if (!resultSchema || !result) {
        cancelLive();
        return;
      }
      pinnedRows.add(index);
      const focused = document.activeElement;
      if (focused?.dataset.cell !== undefined) pinnedRows.add(Number(focused.dataset.cell));
      livePending = true;
      liveCheck = { token: generation, owner, schema: resultSchema };
      for (const el of document.querySelectorAll(
        '[data-val="report"],[data-val="accepted"],[data-val="export-comparison"]'
      ))
        el.disabled = true;
      const status = $('valLiveStatus');
      if (status) status.textContent = 'Checking your edit…';
      const comparisonStatus = $('valComparisonStatus');
      if (comparisonStatus)
        comparisonStatus.textContent = 'Checking your edit before refreshing this comparison…';
      if (immediate) checkEdit();
      else liveTimer = root.setTimeout(checkEdit, 250);
    }
    function mappingView() {
      const t = activeSchema(),
        unmapped = t.columns.filter(c => Number(mapping[c.key]) < 0).length;
      return (
        '<section class="val-card val-mapping"><div class="val-panel-title"><div><span class="val-eyebrow">CONNECT YOUR COLUMNS</span><h3>One small check before we start</h3></div><span class="val-chip">' +
        sourceRows.length +
        ' rows · ' +
        unmapped +
        ' unmapped fields</span></div><div class="val-file-options">' +
        select(
          'sheet',
          'Worksheet',
          book.sheets.map((s, i) => [i, s.name]),
          sheetIndex
        ) +
        input('headerRow', 'Header row', headerRow, 'number', 'min="1" max="5001"') +
        '</div><div class="val-map-grid">' +
        t.columns
          .map(
            c =>
              '<label class="val-map-row"><span><strong>' +
              esc(c.label) +
              (c.required ? ' *' : '') +
              '</strong><code>' +
              esc(c.key) +
              '</code></span><span aria-hidden="true">→</span><select data-map="' +
              esc(c.key) +
              '" aria-label="Map ' +
              esc(c.label) +
              '">' +
              options(
                [
                  [-1, c.required ? 'Choose a column' : 'Skip this field'],
                  ...headers.map((h, i) => [i, F.col(i) + ' · ' + h]),
                ],
                mapping[c.key]
              ) +
              '</select></label>'
          )
          .join('') +
        '</div><div class="val-run-bar"><p>Uploaded rows stay in this browser. Only the run summary is saved.</p>' +
        btn('run', icon('check', 18) + ' Run validation', busy ? 'disabled' : '', 'val-primary') +
        '</div></section>'
      );
    }
    function comparisonUpload() {
      return {
        headers,
        originalRows,
        preparedRows,
        sourceRows,
        origins,
        mapping,
        headerRow,
        fileName,
        sheet: book.sheets[sheetIndex].name,
        steps: preparationSteps,
      };
    }
    function dataComparison() {
      if (
        !comparisonCache ||
        comparisonCache.generation !== generation ||
        comparisonCache.result !== result
      )
        comparisonCache = {
          generation,
          result,
          report: F.comparison(resultSchema, comparisonUpload(), result),
        };
      return comparisonCache.report;
    }
    function comparisonValue(value) {
      const full = '<pre>' + esc(value === '' ? '(blank)' : value) + '</pre>';
      return value.length > 240
        ? '<details><summary>Show full value · ' +
            value.length +
            ' characters</summary>' +
            full +
            '</details><p class="val-comparison-preview">' +
            esc(value.slice(0, 160)) +
            '…</p>'
        : full;
    }
    function comparisonView() {
      if (!result || !resultSchema || !book) return '';
      // Never present old check status alongside a newly typed, unchecked value.
      if (livePending)
        return '<section id="valComparison" class="val-card"><h3>Original vs validated</h3><p role="status">Checking your edit before refreshing the comparison…</p></section>';
      const report = dataComparison();
      function scan() {
        const shown = [];
        let total = 0;
        if (comparisonFilter === 'all') {
          const width = comparisonField === 'all' ? report.fields.length : 1,
            count = comparisonRow ? 1 : report.rows.length;
          total = count * width;
          for (let n = comparisonPage * 50; n < Math.min(total, comparisonPage * 50 + 50); n++)
            shown.push([
              comparisonRow ? Number(comparisonRow) - 1 : Math.floor(n / width),
              comparisonField === 'all' ? n % width : Number(comparisonField),
            ]);
          return { shown, total };
        }
        for (const row of report.rows) {
          if (comparisonRow && row.index + 1 !== Number(comparisonRow)) continue;
          const status = result.status[row.index];
          if (comparisonFilter === 'corrected' && !row.corrected) continue;
          if (
            comparisonFilter === 'issues' &&
            !status.errors &&
            !status.warnings &&
            !status.ignored
          )
            continue;
          if (
            comparisonFilter === 'changes' &&
            !row.prepared &&
            !row.corrected &&
            !status.errors &&
            !status.warnings &&
            !status.ignored
          )
            continue;
          for (const field of report.fields) {
            if (comparisonField !== 'all' && field.index !== Number(comparisonField)) continue;
            const cell = F.comparisonCell(report, row.index, field.index);
            if (
              comparisonFilter === 'changes' &&
              !cell.preparedChange &&
              !cell.corrected &&
              !cell.errors &&
              !cell.warnings &&
              !cell.ignored
            )
              continue;
            if (comparisonFilter === 'corrected' && !cell.corrected) continue;
            if (comparisonFilter === 'issues' && !cell.errors && !cell.warnings && !cell.ignored)
              continue;
            if (total >= comparisonPage * 50 && shown.length < 50)
              shown.push([row.index, field.index]);
            total++;
          }
        }
        return { shown, total };
      }
      let scanned = scan();
      const clamped = Math.max(0, Math.min(comparisonPage, Math.ceil(scanned.total / 50) - 1));
      if (clamped !== comparisonPage) {
        comparisonPage = clamped;
        scanned = scan();
      }
      const { shown, total } = scanned;
      return `<section id="valComparison" class="val-card val-comparison" aria-label="Original and validated data comparison"><div class="val-panel-title"><div><span class="val-eyebrow">TRACE EVERY CHANGE</span><h3>Original vs validated</h3></div>${btn('export-comparison', 'Export comparison report', '', 'val-secondary')}</div>
        <p id="valComparisonStatus" class="val-help" role="status">Compare exact values from the original upload, the latest preparation and the validated working data. Split parts stay linked to their original worksheet row. Spaces, case, leading zeros and blanks are compared exactly.</p>
        <div class="val-comparison-counts"><span><strong>${originalRows.length}</strong> original rows</span><span><strong>${sourceRows.length}</strong> validated rows</span><span><strong>${report.changedRows}</strong> rows differ from original</span><span><strong>${report.changedCells}</strong> fields differ from original</span><span><strong>${report.correctedCells}</strong> corrections since preparation</span><span><strong>${report.splitRows}</strong> split output rows</span></div>
        <p class="val-help">Blue marks preparation changes, including expected exploded values. Amber marks corrections or differences from the original. Red marks unresolved validation errors. A data change alone is not a validation failure. Prepared values are captured after the latest preparation and include any earlier corrections.</p>
        ${report.unmappedFields.length ? `<p class="val-inline-note">Template fields not mapped: ${report.unmappedFields.map(esc).join(', ')}. Upload columns outside the mapping are compared and labelled Not checked.</p>` : ''}
        <div class="val-fields val-comparison-filters">${select(
          'comparisonFilter',
          'Show',
          [
            ['changes', 'Changes & issues'],
            ['all', 'All fields'],
            ['corrected', 'Corrections since preparation'],
            ['issues', 'Validation issues'],
          ],
          comparisonFilter
        )}${select('comparisonField', 'Upload column', [['all', 'All columns'], ...report.fields.map(f => [f.index, F.col(f.index) + ' · ' + f.header])], comparisonField)}${input('comparisonRow', 'Working data row (1-based)', comparisonRow, 'number', `id="valComparisonRow" min="1" max="${sourceRows.length}" step="1" placeholder="All rows"`)}</div>
        <p class="val-help">Showing ${shown.length ? comparisonPage * 50 + 1 : 0}–${comparisonPage * 50 + shown.length} of ${total} fields. The exported report includes all rows and fields regardless of these filters.${report.rows.length * report.fields.length > 50000 ? ' Large reports use side-by-side field comparisons and numbered continuation sheets.' : ''}</p>
        ${
          shown.length
            ? `<div class="val-table-scroll"><table class="val-grid val-comparison-grid"><thead><tr><th>Working row</th><th>Original source</th><th>Upload column / field</th><th>Original value</th><th>Prepared value</th><th>Validated value</th><th>Comparison</th><th>Field check</th></tr></thead><tbody>${shown
                .map(([i, j]) => {
                  const row = report.rows[i],
                    field = report.fields[j],
                    cell = F.comparisonCell(report, i, j);
                  return `<tr data-compare-row="${i}" data-compare-field="${j}"><th>${i + 1}<small>Excel row ${headerRow + i + 1}</small></th><td>${esc(book.sheets[sheetIndex].name)}<small>Original row ${row.origin.row} · ${row.origin.part ? 'Part ' + esc(row.origin.part) : 'Unsplit'}</small></td><td>${esc(field.header)}<code>${esc(field.key || 'Not mapped to template')}</code></td><td class="${cell.changed ? 'val-difference' : ''}">${comparisonValue(cell.original)}</td><td class="${cell.preparedChange ? 'val-prepared-change' : ''}">${comparisonValue(cell.prepared)}</td><td class="${cell.errors ? 'error' : cell.corrected || cell.warnings ? 'val-difference' : cell.changed ? 'val-prepared-change' : ''}">${comparisonValue(cell.current)}</td><td><span class="val-comparison-label ${cell.kind}">${esc(cell.label)}</span></td><td>${esc(cell.check)}</td></tr>`;
                })
                .join('')}</tbody></table></div>`
            : '<p class="val-inline-note">No fields match these filters. Choose All fields to review unchanged values.</p>'
        }
        <div class="val-pagination">${btn('comparison-page', '← Previous', 'data-delta="-1"' + (!comparisonPage ? ' disabled' : ''), 'val-quiet')}<span>Page ${comparisonPage + 1} of ${Math.max(1, Math.ceil(total / 50))}</span>${btn('comparison-page', 'Next →', 'data-delta="1"' + ((comparisonPage + 1) * 50 >= total ? ' disabled' : ''), 'val-quiet')}</div></section>`;
    }
    function resultsView() {
      if (!rows.length) return '';
      const group = currentAttentionGroup(),
        affected = group ? new Set(group.indices) : null,
        indices = rows
          .map((r, i) => i)
          .filter(
            i =>
              (!group &&
                (!result ||
                  filter === 'all' ||
                  pinnedRows.has(i) ||
                  (filter === 'errors' && result.status[i].errors) ||
                  (filter === 'warnings' && result.status[i].warnings) ||
                  (filter === 'passed' && !result.status[i].errors))) ||
              (group && (affected.has(i) || pinnedRows.has(i)))
          );
      page = Math.max(0, Math.min(page, Math.ceil(indices.length / 25) - 1));
      const shown = indices.slice(page * 25, page * 25 + 25),
        t = resultSchema || activeSchema(),
        issues = (result?.issues || []).filter(i => !i.ignored),
        byCell = new Map(),
        extraColumns = group
          ? headers
              .map((label, index) => ({ label, index }))
              .filter(c => !t.columns.some(field => Number(mapping[field.key]) === c.index))
          : [];
      for (const issue of issues) {
        const key = issue.index + ':' + issue.field;
        if (!byCell.has(key)) byCell.set(key, []);
        byCell.get(key).push(issue);
      }
      return (
        '<div id="valResultsArea"><p id="valLiveStatus" class="val-live-status" role="status" aria-live="polite">' +
        (livePending
          ? 'Checking your edit…'
          : result
            ? 'Live checks on · Edits and suggested corrections recheck automatically.'
            : 'Run validation to check this upload.') +
        '</p>' +
        (filter !== 'all' && pinnedRows.size
          ? '<p class="val-help">Edited rows stay visible while you work. Change the filter to refresh the list.</p>'
          : '') +
        (result?.setup
          ? `<details class="val-card val-setup-results"><summary>Checks used · ${esc(result.setup.name)} · ${countLabel(result.setup.conditions.length, 'condition')} · ${countLabel(result.setup.references.length, 'reference check')}</summary><p class="val-help">Base column checks ran. Listed conditions were active; skipped conditions were not evaluated or counted as passed.</p><div class="val-setup-audit">${result.setup.conditions.map(r => `<div><strong>${esc(r.name)}</strong><span>Active condition</span></div>`).join('')}${result.setup.references.map(r => `<div><strong>${esc(r.field)} → ${esc(r.name)}</strong><span>Active reference check · ${esc(r.column)}</span></div>`).join('')}${result.setup.skipped.map(r => `<div><strong>${esc(r.name)}</strong><span>Skipped · ${esc(r.reason)}</span></div>`).join('')}</div></details>`
          : '') +
        (result
          ? '<div class="val-metrics"><div class="val-metric passed"><span>Rows without errors</span><strong>' +
            result.passed +
            '<small> / ' +
            result.rows +
            '</small></strong></div><div class="val-metric errors"><span>Errors to correct</span><strong>' +
            result.errors +
            '</strong></div><div class="val-metric warnings"><span>Warnings to review</span><strong>' +
            result.warnings +
            '</strong></div><div class="val-metric ignored"><span>Ignored issues</span><strong>' +
            result.ignored +
            '</strong></div><div class="val-metric"><span>Template used</span><strong class="val-version-text">' +
            (version === 'draft' ? 'Saved draft' : 'Version ' + version) +
            '</strong></div></div>'
          : '<div class="val-inline-note">Your data changed. Run validation again to refresh the results and exports.</div>') +
        issueReviewView() +
        '<section id="valResultsCard" class="val-card val-results' +
        (group ? ' val-group-records' : '') +
        '"><div class="val-panel-title"><div><span class="val-eyebrow">' +
        (group ? 'FOCUSED REVIEW' : 'LOOK CLOSER') +
        '</span><h3 id="valRecordsTitle" tabindex="-1">' +
        (group ? 'Affected records' : 'Your data, with the answers beside it') +
        '</h3></div><div class="val-actions">' +
        btn(
          'review-wide',
          roomyReview ? 'Exit roomy view' : 'Roomy view',
          'aria-pressed="' + roomyReview + '"',
          'val-quiet'
        ) +
        btn(
          'report',
          'Export issue workbook',
          !result || livePending ? 'disabled' : '',
          'val-secondary'
        ) +
        btn(
          'accepted',
          'Export accepted rows',
          !result || livePending || !result.passed ? 'disabled' : '',
          'val-primary'
        ) +
        '</div></div>' +
        (group
          ? `<section id="valGroupContext" class="val-group-context ${group.severity}"><div><span class="val-eyebrow">${group.indices.length ? 'SELECTED ISSUE GROUP' : 'GROUP REVIEWED'}</span><strong>${esc(group.message)}</strong><p>${esc(attentionFieldLabel(group))} · ${esc(group.rule)} · ${countLabel(group.indices.length, 'affected record')}${result.truncated ? ' listed' : ''} · ${countLabel(group.entries.length, 'issue')}</p></div><div class="val-actions">${btn('attention-back', '← Back to error groups', '', 'val-secondary')}${pinnedRows.size ? btn('attention-refresh', 'Refresh record list', livePending ? 'disabled' : '', 'val-quiet') : ''}</div>${!group.indices.length ? `<p class="val-group-resolved">${result.truncated ? 'No listed issues remain in this group. Other unlisted issues may still exist.' : 'No unresolved issues remain in this group.'}${pinnedRows.size ? ' Edited records stay visible so you can finish typing.' : ''}</p>` : ''}</section>`
          : '') +
        `<p class="val-help">${group ? 'Edit the highlighted fields in their full record. Every edit rechecks automatically.' + (extraColumns.length ? ' Extra upload columns are shown read-only and were not checked by the template.' : '') + (pinnedRows.size ? ' Edited records stay visible until you refresh the list or choose another group.' : '') : 'Accepted exports exclude unresolved errors. Rows with warnings or explicitly ignored issues remain included.'} Exports always include their complete run scope, regardless of this view.</p><div class="val-result-toolbar"><div class="val-segments">` +
        [
          ['all', 'All rows'],
          ['errors', 'Errors'],
          ['warnings', 'Warnings'],
          ['passed', 'Without errors'],
        ]
          .map(([key, label]) =>
            btn(
              'filter',
              label,
              'data-filter="' + key + '"' + (!result && key !== 'all' ? ' disabled' : ''),
              !group && filter === key ? 'is-active' : ''
            )
          )
          .join('') +
        '</div><span>Showing ' +
        (shown.length ? page * 25 + 1 : 0) +
        '–' +
        (page * 25 + shown.length) +
        ' of ' +
        indices.length +
        '</span></div>' +
        (result && selectedIssue
          ? '<section id="valSelectedIssue" class="val-selected-issue" aria-label="Selected validation issue" aria-live="polite"><strong>Row ' +
            (headerRow + selectedIssue.index + 1) +
            ' · ' +
            esc(selectedIssue.column) +
            '</strong><p>' +
            esc(selectedIssue.message) +
            '</p><span class="val-eyebrow">CURRENT VALUE</span><pre>' +
            esc(rows[selectedIssue.index]?.[selectedIssue.field] || '(blank)') +
            '</pre><small>The exact cell is selected below. Edits recheck automatically and restore ignored issues on that row.</small></section>'
          : '') +
        '<div id="valResultsScroll" class="val-table-scroll"><table class="val-grid"><thead><tr><th>' +
        (group ? 'Record / source' : preparationSteps.length ? 'Working Excel row' : 'Excel row') +
        '</th><th>Check</th>' +
        t.columns
          .map(
            c =>
              '<th' +
              (group?.fields.includes(c.key) ? ' class="val-group-column"' : '') +
              '>' +
              esc(c.label) +
              '<code>' +
              esc(c.key) +
              '</code></th>'
          )
          .join('') +
        extraColumns
          .map(
            c =>
              '<th>' + esc(c.label) + '<code>Upload ' + F.col(c.index) + ' · read-only</code></th>'
          )
          .join('') +
        '</tr></thead><tbody>' +
        shown
          .map(
            i =>
              '<tr data-row-index="' +
              i +
              '"' +
              (targetRow === i ? ' class="val-target-row"' : '') +
              '><th>' +
              (group
                ? `<strong>Record ${i + 1}</strong><small class="val-row-origin">Working Excel row ${headerRow + i + 1}</small><small class="val-row-origin">${esc(book.sheets[sheetIndex].name)} · original row ${origins[i]?.row || headerRow + i + 1}${origins[i]?.part ? ' · part ' + esc(origins[i].part) : ' · unsplit'}</small>`
                : headerRow + i + 1) +
              (!group && origins[i]?.part
                ? '<small class="val-row-origin">Source ' +
                  origins[i].row +
                  ' · part ' +
                  esc(origins[i].part) +
                  '</small>'
                : '') +
              '</th><td><span class="val-status ' +
              (!result
                ? 'pending'
                : result.status[i].errors
                  ? 'error'
                  : result.status[i].warnings
                    ? 'warning'
                    : 'passed') +
              '">' +
              (!result
                ? 'Not checked'
                : result.status[i].errors
                  ? 'Needs correction'
                  : result.status[i].warnings
                    ? 'Review'
                    : result.status[i].ignored
                      ? 'Accepted · ignored issues'
                      : 'Passed') +
              '</span>' +
              (group && !affected.has(i)
                ? '<small class="val-row-resolved">Resolved in this group</small>'
                : '') +
              (result && t.lookups.some(l => l.nameColumn || l.descriptionColumns?.length)
                ? btn(
                    'reference-details',
                    'Reference details',
                    'data-index="' + i + '"',
                    'val-quiet val-reference-button'
                  )
                : '') +
              '</td>' +
              t.columns
                .map(c => {
                  const found = byCell.get(i + ':' + c.key) || [],
                    severity = found.some(x => x.severity === 'error')
                      ? 'error'
                      : found.length
                        ? 'warning'
                        : '';
                  return (
                    '<td class="' +
                    severity +
                    (group?.fields.includes(c.key) && affected.has(i) ? ' val-group-cell' : '') +
                    (selectedIssue?.index === i && selectedIssue.field === c.key
                      ? ' val-target-cell'
                      : '') +
                    '"><input data-cell="' +
                    i +
                    '" data-field="' +
                    esc(c.key) +
                    '" aria-label="Row ' +
                    (headerRow + i + 1) +
                    ' ' +
                    esc(c.label) +
                    '" value="' +
                    esc(rows[i][c.key]) +
                    '" maxlength="32000" aria-invalid="' +
                    (severity === 'error') +
                    '" title="' +
                    esc(found.map(x => x.message).join('\n') || 'Edit this value') +
                    '">' +
                    (found.length &&
                    (c.values ||
                      t.rules.some(
                        r =>
                          r.enabled &&
                          E.requirements(r).some(
                            check =>
                              check.field === c.key &&
                              ['lookup', 'lookupTuple', 'in'].includes(check.operator)
                          )
                      ))
                      ? btn(
                          'suggest',
                          'Suggest correction',
                          'data-index="' +
                            i +
                            '" data-field="' +
                            esc(c.key) +
                            '" aria-label="Suggest correction for row ' +
                            (headerRow + i + 1) +
                            ' ' +
                            esc(c.label) +
                            '"',
                          'val-suggest-button'
                        )
                      : '') +
                    '</td>'
                  );
                })
                .join('') +
              extraColumns
                .map(
                  c =>
                    '<td class="val-unmapped-record"><div class="val-read-only">' +
                    esc(sourceRows[i][c.index] || '(blank)') +
                    '</div><small>Not checked · read-only</small></td>'
                )
                .join('') +
              '</tr>'
          )
          .join('') +
        '</tbody></table></div><div class="val-pagination">' +
        btn('page', '← Previous', 'data-delta="-1"' + (!page ? ' disabled' : ''), 'val-quiet') +
        '<span>Page ' +
        (page + 1) +
        ' of ' +
        Math.max(1, Math.ceil(indices.length / 25)) +
        '</span>' +
        btn(
          'page',
          'Next →',
          'data-delta="1"' + ((page + 1) * 25 >= indices.length ? ' disabled' : ''),
          'val-quiet'
        ) +
        '</div></section>' +
        comparisonView() +
        '</div>'
      );
    }
    function attentionData() {
      if (!attentionCache || attentionCache.result !== result)
        attentionCache = { result, groups: groupIssues(result?.issues || []) };
      return attentionCache.groups;
    }
    function currentAttentionGroup() {
      if (!attentionGroup || !result) return null;
      return (
        attentionData().find(g => g.key === attentionGroup.key) || {
          ...attentionGroup,
          entries: [],
          indices: [],
        }
      );
    }
    function attentionFieldLabel(group) {
      const schema = resultSchema || activeSchema();
      return group.fields
        .map(key => schema.columns.find(c => c.key === key)?.label || key)
        .join(' + ');
    }
    function reviewEntries() {
      const group = currentAttentionGroup();
      return group
        ? group.entries
        : (result?.issues || [])
            .map((issue, index) => ({ issue, index }))
            .filter(x => !x.issue.ignored);
    }
    function attentionOverviewView(open) {
      const groups = attentionData(),
        errors = groups.filter(g => g.severity === 'error'),
        warnings = groups.filter(g => g.severity === 'warning'),
        affected = new Set(open.map(x => x.issue.index)),
        needle = attentionSearch.trim().toLocaleLowerCase(),
        filtered = groups.filter(
          g =>
            (attentionSeverity === 'all' || attentionSeverity === g.severity) &&
            [g.message, g.column, g.fields.join(' '), g.rule, attentionFieldLabel(g)]
              .join(' ')
              .toLocaleLowerCase()
              .includes(needle)
        );
      attentionPage = Math.max(0, Math.min(attentionPage, Math.ceil(filtered.length / 6) - 1));
      const shown = filtered.slice(attentionPage * 6, attentionPage * 6 + 6);
      return `<div class="val-attention-heading"><div><span class="val-eyebrow">REVIEW ONE PATTERN AT A TIME</span><h3 tabindex="-1" id="valAttentionTitle">What needs attention</h3><p>Choose an issue group to see and edit its affected records.</p></div><div class="val-attention-totals"><span><strong>${errors.length}</strong> error ${errors.length === 1 ? 'group' : 'groups'}</span><span><strong>${warnings.length}</strong> warning ${warnings.length === 1 ? 'group' : 'groups'}</span><span><strong>${affected.size}</strong> affected ${affected.size === 1 ? 'record' : 'records'}${result.truncated ? ' listed' : ''}</span></div></div>
        ${result.truncated ? '<p class="val-attention-cap" role="note">Groups cover the first 15,000 listed issues. Additional issues still count toward validation totals; split the file for a complete review.</p>' : ''}
        <div class="val-attention-filters"><div class="val-segments" role="group" aria-label="Issue group severity">${[
          ['all', 'All groups'],
          ['error', 'Errors'],
          ['warning', 'Warnings'],
        ]
          .map(([key, label]) =>
            btn(
              'attention-filter',
              label,
              'data-filter="' + key + '" aria-pressed="' + (attentionSeverity === key) + '"',
              attentionSeverity === key ? 'is-active' : ''
            )
          )
          .join(
            ''
          )}</div><label class="val-label">Find a group<input id="valAttentionSearch" type="search" value="${esc(attentionSearch)}" placeholder="Search message, field or check" maxlength="160"></label></div>
        <div class="val-attention-groups">${shown.length ? shown.map(g => btn('attention-open', `<span class="val-attention-group-top"><span class="val-attention-kind ${g.severity}">${g.severity === 'error' ? '! Error' : 'i Warning'}</span><span>${esc(attentionFieldLabel(g))}</span></span><strong>${esc(g.message)}</strong><span class="val-attention-rule">${esc(g.rule)} · ${esc(g.fields.join(' + '))}</span><span class="val-attention-group-foot"><span><b>${g.indices.length}</b> ${g.indices.length === 1 ? 'record' : 'records'}${result.truncated ? ' listed' : ''} <small>· ${g.entries.length} ${g.entries.length === 1 ? 'issue' : 'issues'}</small></span><span>Review records →</span></span>`, `data-group-key="${esc(g.key)}" data-attention-group-key="${esc(g.key)}" aria-controls="valResultsCard" aria-pressed="${attentionGroup?.key === g.key}"${livePending ? ' disabled' : ''}`, 'val-attention-group ' + g.severity + (attentionGroup?.key === g.key ? ' is-selected' : ''))).join('') : '<p class="val-attention-empty">' + (groups.length ? 'No issue groups match these filters.' : 'There are no unresolved listed issue groups.') + '</p>'}</div>
        ${filtered.length > 6 ? `<div class="val-pagination">${btn('attention-page', '← Previous', 'data-delta="-1"' + (!attentionPage ? ' disabled' : ''), 'val-quiet')}<span>Groups ${attentionPage * 6 + 1}–${Math.min(filtered.length, (attentionPage + 1) * 6)} of ${filtered.length}</span>${btn('attention-page', 'Next →', 'data-delta="1"' + ((attentionPage + 1) * 6 >= filtered.length ? ' disabled' : ''), 'val-quiet')}</div>` : ''}`;
    }
    function issueReviewView() {
      if (!result || (!result.issues.length && !attentionGroup)) return '';
      const open = result.issues
          .map((issue, index) => ({ issue, index }))
          .filter(x => !x.issue.ignored),
        ignored = result.issues
          .map((issue, index) => ({ issue, index }))
          .filter(x => x.issue.ignored);
      const scope = reviewEntries();
      issuePage = Math.max(0, Math.min(issuePage, Math.ceil(scope.length / 100) - 1));
      ignoredPage = Math.max(0, Math.min(ignoredPage, Math.ceil(ignored.length / 100) - 1));
      const shown = scope.slice(issuePage * 100, issuePage * 100 + 100),
        selected = shown.filter(x => issueSelection.has(E.issueKey(x.issue))).length;
      const row = ({ issue, index }, isIgnored = false) =>
        `<div class="val-review-issue" data-issue-row-key="${esc(E.issueKey(issue))}">${!isIgnored ? `<label class="val-issue-check"><input type="checkbox" data-issue-choice="${index}" data-issue-key="${esc(E.issueKey(issue))}" aria-label="Select issue on row ${headerRow + issue.index + 1}: ${esc(issue.message)}"${issueSelection.has(E.issueKey(issue)) ? ' checked' : ''}${livePending ? ' disabled' : ''}></label>` : ''}${btn('issue', `<span class="val-issue-marker ${isIgnored ? 'ignored' : issue.severity}">${isIgnored ? '✓' : issue.severity === 'error' ? '!' : 'i'}</span><span><strong>${esc(issue.message)}</strong><small>Row ${headerRow + issue.index + 1} · ${esc(issue.column)} · ${esc(issue.rule)}</small><small class="val-issue-value">Value: ${esc(issue.value || '(blank)')}</small>${isIgnored ? `<small>Ignored${issue.ignoreReason ? ': ' + esc(issue.ignoreReason) : ' · no reason entered'}</small>` : ''}</span><span>↗</span>`, `data-index="${issue.index}" data-issue="${index}" data-issue-key="${esc(E.issueKey(issue))}"`)}${isIgnored ? btn('restore-issue', 'Restore', `data-issue="${index}" data-issue-key="${esc(E.issueKey(issue))}"${livePending ? ' disabled' : ''}`, 'val-quiet') : ''}</div>`;
      const pager = (kind, at, count) =>
        count > 100
          ? `<div class="val-pagination">${btn('issue-page', '← Previous', `data-kind="${kind}" data-delta="-1"${!at ? ' disabled' : ''}`, 'val-quiet')}<span>${at * 100 + 1}–${Math.min(count, (at + 1) * 100)} of ${count}</span>${btn('issue-page', 'Next →', `data-kind="${kind}" data-delta="1"${(at + 1) * 100 >= count ? ' disabled' : ''}`, 'val-quiet')}</div>`
          : '';
      return (
        (open.length || attentionGroup
          ? `<section id="valAttention" class="val-card val-attention">${attentionOverviewView(open)}${scope.length ? `<details class="val-individual-review"><summary>Individual issues &amp; ignore review · ${scope.length}${attentionGroup ? ' in this group' : ''}</summary><div class="val-review-toolbar"><div class="val-actions">${btn('select-issues', selected === shown.length ? 'Deselect this page' : 'Select this page', livePending ? 'disabled' : '', 'val-secondary')}${btn('ignore-selected', 'Ignore selected (' + issueSelection.size + ')', !issueSelection.size || livePending ? 'disabled' : '', 'val-secondary')}</div><label class="val-label">Reason (optional)<input id="valIgnoreReason" maxlength="500" value="${esc(ignoreReason)}" placeholder="Why is this acceptable for this upload?"></label></div><p class="val-help">Select this page applies to the ${attentionGroup ? 'selected group' : 'unresolved issue list'}. Ignore applies to this run; editing a record restores its checks.</p><div class="val-issue-list">${shown.map(x => row(x)).join('')}</div>${pager('open', issuePage, scope.length)}</details>` : ''}</section>`
          : '') +
        (ignored.length
          ? `<section id="valIgnoredIssues" class="val-card val-ignored-issues"><div class="val-panel-title"><h3>Ignored issues · ${ignored.length}</h3>${btn('restore-issues', 'Restore all', livePending ? 'disabled' : '', 'val-secondary')}</div><p class="val-help">Source values and rules are unchanged. These issues are excluded from unresolved totals and included in exports.</p><div class="val-issue-list">${ignored
              .slice(ignoredPage * 100, ignoredPage * 100 + 100)
              .map(x => row(x, true))
              .join('')}</div>${pager('ignored', ignoredPage, ignored.length)}</section>`
          : '')
      );
    }
    function checkView() {
      const versions = [
        ['draft', 'Current draft'],
        ...draft.releases
          .slice()
          .reverse()
          .map(r => [r.version, 'Published version ' + r.version]),
      ];
      return (
        queueView() +
        '<fieldset class="val-queue-session"' +
        (queueBusy || queueIO ? ' disabled' : '') +
        '><div class="val-section-heading"><div><h3>Let’s give your file a check.</h3><p>Choose a version, connect your columns, then correct issues in place.</p></div><div class="val-version-picker">' +
        select('version', 'Validate against', versions, version) +
        '</div></div>' +
        validationScopeView() +
        runSetupView() +
        (busy
          ? '<div class="val-scanning" role="status"><span class="val-scanner-orb">' +
            icon('spark', 28) +
            '</span><div><strong>Making sense of your data…</strong><p>' +
            esc(message) +
            '</p></div><i></i></div>'
          : '') +
        '<div class="val-upload-layout"><section class="val-dropzone" id="valDropzone"><span class="val-upload-icon">' +
        icon('upload', 30) +
        '</span><h3>' +
        esc(fileName || 'Drop a file. Find your clarity.') +
        '</h3><p>XLSX, CSV or TSV · Up to 200 columns, 25,000 rows and 5,000,000 cells per file · 50 MB</p><div class="val-actions">' +
        btn(
          fileQueue.length ? 'queue-add' : 'browse',
          fileQueue.length ? 'Add more files' : fileName ? 'Choose another file' : 'Browse files',
          '',
          'val-primary'
        ) +
        btn('download-template', 'Download Excel template', '', 'val-secondary') +
        '</div><div class="val-upload-foot">' +
        (fileQueue.length ? '' : btn('sample', 'Try example data', '', 'val-quiet')) +
        (book
          ? fileQueue.length
            ? btn(
                'queue-remove',
                'Remove this file',
                'data-id="' + esc(queueActiveId) + '"',
                'val-quiet'
              )
            : btn('clear-file', 'Clear file', '', 'val-quiet')
          : '') +
        '</div></section><details class="val-card val-paste"><summary>Or paste a table</summary><form id="valPasteForm">' +
        area(
          'data',
          'CSV or tab-separated data',
          '',
          'rows="6" placeholder="Include the header row" required'
        ) +
        '<button type="submit" class="val-btn val-secondary">Use pasted data</button></form><p class="val-help">Values only. Excel formulas must be pasted as values before upload.</p></details></div>' +
        (book ? preparationView() + mappingView() : '') +
        resultsView() +
        '</fieldset>'
      );
    }
    function validationScopeView() {
      const t = activeSchema();
      if (!t.projectId)
        return '<p class="val-help">Standalone template · choose checks in Validation setup below.</p>';
      const companies = a
          .state()
          .projectCompanies.filter(c => c.projectId === t.projectId && c.active !== false),
        applicable = t.rules.filter(r => E.ruleApplies(r, { companyId: runCompanyId })).length,
        scoped = t.rules.filter(r => r.enabled && r.companyScope === 'selected').length;
      return (
        '<section class="val-card val-run-scope"><div><span class="val-eyebrow">PROJECT &amp; COMPANY</span><h3>' +
        esc(projectName(t)) +
        '</h3><p class="val-help">One company per file. Base column checks always apply. Select conditions in Validation setup; company restrictions still apply.</p></div>' +
        select(
          'validationCompany',
          'Company for this validation',
          [['', 'Choose a company…'], ...companies.map(c => [c.id, c.name])],
          runCompanyId
        ) +
        '<p class="val-help">' +
        (runCompanyId && companies.some(c => c.id === runCompanyId)
          ? applicable + ' condition(s) available for this company before your setup selection.'
          : 'Choose an active company before running validation.') +
        (scoped ? ' ' + scoped + ' company-specific condition(s) maintained.' : '') +
        (!companies.length
          ? ' Add or activate companies in Projects → Companies &amp; processes.'
          : '') +
        '</p>' +
        (result?.context?.companyId
          ? '<p class="val-scope-badge">Results for ' +
            esc(result.context.companyName) +
            ' · ' +
            result.appliedRules +
            ' condition(s) applied</p>'
          : '') +
        '</section>'
      );
    }
    function history() {
      const runs = store().runs.filter(r => r.templateId === draft.id);
      return (
        '<div class="val-section-heading"><div><h3>A little history, clearly kept.</h3><p>Published versions stay frozen. Run history contains counts, never uploaded rows.</p></div></div><div class="val-history-layout"><section class="val-card"><h3>Published versions</h3>' +
        draft.releases
          .slice()
          .reverse()
          .map(
            r =>
              '<article class="val-release"><span class="val-version-bubble">' +
              r.version +
              '</span><div><strong>Version ' +
              r.version +
              '</strong><p>' +
              stamp(r.publishedAt) +
              '<br>' +
              r.schema.columns.length +
              ' columns · ' +
              r.schema.rules.length +
              ' conditions</p></div>' +
              btn(
                'restore-version',
                'Copy to draft',
                'data-version="' + r.version + '"',
                'val-secondary'
              ) +
              '</article>'
          )
          .join('') +
        (!draft.releases.length
          ? '<p class="val-muted">Publish a version when your template is ready. Later draft edits won’t change it.</p>'
          : '') +
        '</section><section class="val-card"><h3>Recent checks</h3>' +
        runs
          .slice(0, 30)
          .map(
            r =>
              '<article class="val-run-history"><span class="val-rule-dot ' +
              (r.errors ? 'error' : r.warnings ? 'warning' : 'passed') +
              '"></span><div><strong>' +
              esc(r.fileName) +
              '</strong><p>' +
              stamp(r.at) +
              ' · ' +
              (r.version ? 'v' + r.version : 'Draft') +
              (r.context?.companyId
                ? ' · ' + esc(r.context.projectName) + ' / ' + esc(r.context.companyName)
                : '') +
              '</p><small>' +
              r.rows +
              ' rows · ' +
              r.errors +
              ' errors · ' +
              r.warnings +
              ' warnings' +
              (r.setup
                ? ' · ' +
                  esc(r.setup.name) +
                  ' · ' +
                  r.setup.conditions +
                  ' conditions / ' +
                  r.setup.references +
                  ' reference checks / ' +
                  r.setup.skipped +
                  ' skipped'
                : '') +
              (r.reviewedAt
                ? ' · reviewed: ' +
                  r.reviewedErrors +
                  ' unresolved errors, ' +
                  r.ignored +
                  ' ignored'
                : '') +
              '</small></div></article>'
          )
          .join('') +
        (!runs.length
          ? '<p class="val-muted">Your validation summaries will appear here after the first check.</p>'
          : '') +
        '</section></div>'
      );
    }
    function render() {
      sync();
      if (!draft && store().templates.length) pick(store().templates[0].id, true);
      return (
        '<section class="validation-studio' +
        (roomyReview && mode === 'check' && rows.length ? ' val-review-wide' : '') +
        '" data-val-owner="' +
        esc(owner) +
        '" data-val-template="' +
        esc(draft?.id || '') +
        '" data-val-mode="' +
        esc(mode) +
        '"><header class="val-heading"><div class="val-brand"><span class="val-brand-mark">' +
        icon('leaf', 29) +
        '</span><div><span class="val-eyebrow">YOUR WORKHUB TOOLKIT</span><h1>Validation Studio</h1></div></div><div class="val-heading-note"><span class="val-dot"></span> A calmer way to check your data</div></header><div class="val-shell">' +
        library() +
        '<main class="val-main" data-val-section="' +
        esc(mode) +
        '">' +
        (draft
          ? header() +
            (message
              ? '<div class="val-message" role="status" aria-live="polite">' +
                esc(message) +
                '</div>'
              : '') +
            (
              {
                columns: columnEditor,
                rules: rulesEditor,
                'column-groups': columnGroupsEditor,
                references,
                check: checkView,
                history,
              }[mode] || columnEditor
            )()
          : empty()) +
        '</main></div><input id="valFile" type="file" accept=".xlsx,.csv,.tsv" hidden><input id="valQueueFiles" type="file" multiple accept=".xlsx,.csv,.tsv" hidden><input id="valSetupFile" type="file" accept=".xlsx" hidden><input id="valDefinitionFile" type="file" accept=".json" hidden><input id="valReferenceFile" type="file" accept=".xlsx,.csv,.tsv" hidden></section>'
      );
    }
    async function handle(el) {
      ensure();
      const action = el.dataset.val,
        id = el.dataset.id;
      message = '';
      if (action === 'queue-cancel') {
        cancelQueue();
        return;
      }
      if (queueBusy || queueIO)
        throw Error('Wait for the current queue operation, or use Stop queue.');
      if (action === 'queue-add') {
        queueAccess();
        $('valQueueFiles').click();
        return;
      }
      if (action === 'queue-open') {
        await openQueueJob(id);
        return;
      }
      if (action === 'queue-confirm') {
        confirmQueueJob();
        return;
      }
      if (action === 'queue-start') {
        await startQueue();
        return;
      }
      if (action === 'queue-export') {
        await exportQueue();
        return;
      }
      if (action === 'queue-clear') {
        queueAccess();
        if (
          root.confirm(
            'Clear all queue files and working results? Download any reports you need first.'
          )
        ) {
          clearFile();
          paint();
        }
        return;
      }
      if (action === 'queue-remove') {
        queueAccess();
        const job = fileQueue.find(j => j.id === id);
        if (!job) return;
        if (!root.confirm('Remove ' + job.file.name + ' and its working results?')) return;
        const current = id === queueActiveId;
        fileQueue = fileQueue.filter(j => j.id !== id);
        if (current) {
          queueActiveId = '';
          clearFile(true);
          if (fileQueue.length) await openQueueJob(fileQueue[0].id);
        }
        paint();
        return;
      }
      if (action === 'comparison-page') {
        comparisonPage += Number(el.dataset.delta);
        patchResults();
        return;
      }
      if (action === 'review-wide') {
        roomyReview = !roomyReview;
        paint();
        $('valResultsCard')?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
        return;
      }
      if (action.startsWith('attention-')) {
        if (livePending) throw Error('Wait for the current edit to finish checking.');
        if (action === 'attention-open') {
          const group = attentionData().find(g => g.key === el.dataset.groupKey);
          if (!group) throw Error('This issue group changed. Choose a current group.');
          attentionGroup = {
            key: group.key,
            message: group.message,
            fields: group.fields.slice(),
            field: group.field,
            column: group.column,
            rule: group.rule,
            ruleId: group.ruleId,
            severity: group.severity,
          };
          pinnedRows.clear();
          issueSelection.clear();
          issuePage = 0;
          selectedIssue = null;
          targetRow = -1;
          page = 0;
        }
        if (action === 'attention-back') {
          attentionGroup = null;
          pinnedRows.clear();
          issueSelection.clear();
          issuePage = 0;
          selectedIssue = null;
          targetRow = -1;
          filter = 'all';
          page = 0;
        }
        if (action === 'attention-refresh') {
          pinnedRows.clear();
          page = 0;
        }
        if (action === 'attention-filter') {
          attentionSeverity = el.dataset.filter;
          attentionPage = 0;
        }
        if (action === 'attention-page') attentionPage += Number(el.dataset.delta);
        patchResults();
        if (action === 'attention-open') {
          $('valResultsCard')?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
          const group = currentAttentionGroup(),
            first = group?.indices[0];
          const cell = [...document.querySelectorAll('#valResultsCard input[data-cell]')].find(
            n => Number(n.dataset.cell) === first && group.fields.includes(n.dataset.field)
          );
          cell?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'auto' });
          $('valRecordsTitle')?.focus({ preventScroll: true });
        }
        if (action === 'attention-back') {
          const heading = $('valAttentionTitle') || $('valRecordsTitle');
          heading?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
          heading?.focus({ preventScroll: true });
        }
        return;
      }
      if (action.startsWith('run-setup-')) {
        setupAccess();
        commitCurrent();
        if (action === 'run-setup-save' || action === 'run-setup-update') {
          openProfileForm(action === 'run-setup-update');
          return;
        }
        const s = E.copy(setupChoices());
        if (action === 'run-setup-all')
          s.ruleIds = activeSchema()
            .rules.filter(r => E.ruleApplies(r, { companyId: runCompanyId }))
            .map(r => r.id);
        if (action === 'run-setup-none') s.ruleIds = [];
        if (action === 'run-setup-references-all') {
          for (const c of referenceChoices(activeSchema(), s))
            if (c.available && !c.requiredBy.length && !c.selected)
              s.referenceChecks.push({ id: E.uid(), ...c.check });
          E.runSetup(activeSchema(), s, { companyId: runCompanyId });
        }
        if (action === 'run-setup-references-none') {
          const keys = new Set(referenceChoices(activeSchema(), s).map(c => c.key));
          if (!deselectRunReferences(s, keys)) return;
        }
        runSelection = s;
        setupChanged();
        return;
      }
      if (action === 'profile-delete') {
        setupAccess('delete');
        const p = profiles().find(p => p.id === runProfileId);
        if (!p) throw Error('Choose a saved profile first.');
        if (
          !root.confirm(
            'Delete profile "' +
              p.name +
              '"? The template, conditions, references and uploaded data will remain.'
          )
        )
          return;
        if (
          !a.mutate(d => {
            d.workhub.validator.profiles = (d.workhub.validator.profiles || []).filter(
              x => x.id !== p.id
            );
          })
        )
          throw Error('The profile could not be deleted.');
        runProfileId = '';
        setupChanged();
        return;
      }
      if (action === 'prep-sap' || action === 'prep-explode') {
        openPreparation(action === 'prep-sap' ? 'sap' : 'explode');
        return;
      }
      if (action === 'prep-cancel') {
        closePreparation();
        return;
      }
      if (action === 'prep-apply') {
        applyPreparation();
        return;
      }
      if (action === 'prep-undo' || action === 'prep-restore') {
        undoPreparation(action === 'prep-restore');
        return;
      }
      if (action === 'setup-help') {
        a.openModal(
          'Fill your setup in 3 steps',
          `<section class="val-setup-guide"><p>Use <strong>simple General setup</strong> for everyday files, or <strong>simple SAP setup</strong> for DDIC field formats. Each file has just one <strong>Setup</strong> sheet.</p><ol><li><strong>Name it.</strong> Fill the name in B2 and choose General or SAP in B3.</li><li><strong>Replace the examples from row 9.</strong> One row creates one upload column. Keep the row 8 headers. Delete example rows you do not need. You can define up to 200 fields.</li><li><strong>Import and review.</strong> Choose Import Excel setup → your file → Create new draft → Save draft. Then use Validate to upload the records you want to check.</li></ol><div class="val-setup-table"><table><thead><tr><th>Fill this</th><th>What to enter</th></tr></thead><tbody><tr><td>Field</td><td>A unique key, e.g. VENDOR_CODE. Use letters and underscores; no spaces.</td></tr><tr><td>Label</td><td>Your data upload header, e.g. Vendor code. Optional: defaults to Field.</td></tr><tr><td>Data type</td><td>Choose from the dropdown. General: text, integer, decimal, date or boolean. SAP: choose the actual DDIC type.</td></tr><tr><td>Length / Decimals</td><td>General: Length is an optional maximum character count; leave Decimals blank. SAP: use SE11/DDIC length and decimal places, or leave blank for the displayed type defaults.</td></tr><tr><td>Required / Allowed values</td><td>Required defaults to No. Use X in Allowed values and Required = No to allow X or blank. A trailing comma is unnecessary.</td></tr><tr><td>Format / Reference field</td><td>Optional. General formats: digits, alphanumeric, email, url or identifier. SAP format is automatic; CURR can point to a CUKY field and QUAN to a UNIT field using its Field key.</td></tr><tr><td>Notes</td><td>Optional instructions for the person uploading data.</td></tr></tbody></table></div><p>Keep codes and long numbers as Excel <strong>Text</strong>. Enter values, not formulas. You can add Conditions and References inside Studio after import; the advanced workbook is only needed to maintain them in Excel.</p><p class="hint">Data uploads support 25,000 rows and 5,000,000 cells, including up to 25,000 rows at 200 columns. SAP mode checks the supported DDIC field formats; maintain your system's domain values and conversion rules separately.</p></section>`
        );
        return;
      }
      if (action === 'new' || action === 'example') {
        create(action === 'example');
        return;
      }
      if (action === 'open') {
        pick(id);
        paint();
        return;
      }
      if (action === 'reference-close') {
        $('valReferenceDialog')?.close();
        return;
      }
      if (action === 'reference-details') {
        referenceDetails(Number(el.dataset.index));
        return;
      }
      if (action === 'import-definition') {
        $('valDefinitionFile').click();
        return;
      }
      if (action === 'import-setup') {
        $('valSetupFile').click();
        return;
      }
      if (action === 'cancel-setup') {
        setupPreview = null;
        a.closeModal();
        return;
      }
      if (action === 'apply-setup') {
        if (
          !setupPreview ||
          setupPreview.owner !== owner ||
          setupPreview.token !== generation ||
          !$('valSetupReview')?.closest('dialog[open]')
        )
          throw Error('This preview has changed. Upload the setup workbook again.');
        const next = setupPreview.template;
        E.checkSchema(next);
        draft = next;
        selected = next.id;
        baseStamp = '';
        dirty = true;
        columnId = next.columns[0].id;
        ruleId = next.rules[0]?.id || '';
        version = 'draft';
        mode = 'columns';
        clearFile();
        a.closeModal();
        say('Excel setup imported as a new draft. Review each tab, then Save draft.');
        paint();
        return;
      }
      if (action === 'suggest') {
        openCorrections(Number(el.dataset.index), el.dataset.field);
        return;
      }
      if (action === 'apply-correction') {
        applyCorrection(Number(el.dataset.choice));
        return;
      }
      if (!draft) throw Error('Create or choose a template first.');
      commitCurrent();
      if (['ignore-selected', 'restore-issue', 'restore-issues'].includes(action)) {
        applyIssueReview(action, el);
        return;
      }
      if (action === 'select-issues') {
        if (livePending || !result) throw Error('Wait for validation to finish.');
        const shown = reviewEntries()
            .map(x => x.issue)
            .slice(issuePage * 100, issuePage * 100 + 100),
          all = shown.every(i => issueSelection.has(E.issueKey(i)));
        shown.forEach(i =>
          all ? issueSelection.delete(E.issueKey(i)) : issueSelection.add(E.issueKey(i))
        );
        patchResults();
        return;
      }
      if (action === 'issue-page') {
        if (el.dataset.kind === 'ignored') ignoredPage += Number(el.dataset.delta);
        else issuePage += Number(el.dataset.delta);
        patchResults();
        return;
      }
      if (action === 'copy-template' || action === 'copy-conditions') {
        copyPreview = {
          owner,
          token: generation,
          templateId: draft.id,
          kind: action === 'copy-template' ? 'template' : 'conditions',
        };
        copyDialog();
        return;
      }
      if (action === 'save') {
        saveDraft();
        paint();
        return;
      }
      if (action === 'publish') {
        publish();
        return;
      }
      if (action === 'mode') {
        mode = el.dataset.mode;
        paint();
        return;
      }
      if (action === 'field-library' || action === 'field-save') {
        if (!a.fieldLibrary) throw Error('Open the field library from your signed-in workspace.');
        const account = owner,
          templateId = draft.id;
        a.fieldLibrary(
          action === 'field-save' ? E.copy(draft.columns.find(c => c.id === columnId)) : null,
          definition => {
            if (account !== a.owner?.() || draft?.id !== templateId)
              throw Error('Reopen this template before inserting a field.');
            addLibraryField(definition);
          }
        );
        return;
      }
      if (action === 'column-group-add') {
        if (!draft.columns.length) throw Error('Add a column first.');
        draft.columnGroups ||= [];
        if (draft.columnGroups.length >= 40) throw Error('Use up to 40 column groups.');
        let name = 'Column group',
          n = 2;
        while (draft.columnGroups.some(g => g.name.toLowerCase() === name.toLowerCase()))
          name = 'Column group ' + n++;
        const group = {
          id: E.uid(),
          name,
          fields: [draft.columns[0].key],
          sets: [{ id: E.uid(), name: 'Value set 1', values: { [draft.columns[0].key]: '' } }],
        };
        draft.columnGroups.push(group);
        columnGroupId = group.id;
        valueSetId = group.sets[0].id;
        mode = 'column-groups';
        mark();
      }
      if (action === 'column-group-select') {
        columnGroupId = id;
        valueSetId = '';
      }
      if (action === 'column-group-remove') {
        if (E.groupReferences(draft, id).length)
          throw Error('A condition uses this column group. Update that condition first.');
        draft.columnGroups = draft.columnGroups.filter(g => g.id !== id);
        columnGroupId = '';
        valueSetId = '';
        mark();
      }
      if (
        [
          'value-set-add',
          'value-set-duplicate',
          'value-set-remove',
          'value-set-condition',
        ].includes(action)
      ) {
        const g = draft.columnGroups?.find(g => g.id === columnGroupId),
          set = g?.sets.find(v => v.id === valueSetId);
        if (!g || !set) throw Error('Select a column group and value set first.');
        if (action === 'value-set-remove') {
          if (g.sets.length === 1) throw Error('Keep at least one value set in this group.');
          if (E.groupReferences(draft, g.id, set.id).length)
            throw Error(
              'A condition uses this value set. Choose another set in that condition first.'
            );
          g.sets = g.sets.filter(v => v.id !== set.id);
          valueSetId = g.sets[0].id;
        } else if (action === 'value-set-condition') {
          const r = E.rule(g.fields[0]);
          r.name = (g.name + ' · ' + set.name).slice(0, 160);
          r.assertion = {
            ...E.condition(g.fields[0]),
            operator: 'in',
            valueSource: 'group',
            groupId: g.id,
            valueSetId: set.id,
          };
          draft.rules.push(r);
          ruleId = r.id;
          mode = 'rules';
        } else {
          if (g.sets.length >= 30) throw Error('Use up to thirty value sets per group.');
          const next = {
            id: E.uid(),
            name:
              action === 'value-set-duplicate' ? set.name.slice(0, 100) + ' copy' : 'New value set',
            values:
              action === 'value-set-duplicate'
                ? E.copy(set.values)
                : Object.fromEntries(g.fields.map(k => [k, ''])),
          };
          let n = 2,
            base = next.name;
          while (g.sets.some(v => v.name.toLowerCase() === next.name.toLowerCase()))
            next.name = base + ' ' + n++;
          g.sets.push(next);
          valueSetId = next.id;
        }
        mark();
      }
      if (action === 'tuple-add') {
        const c = getPath(el.dataset.path);
        c.pairs ||= [];
        const ref = draft.lookups.find(l => l.id === c.lookupId);
        if (c.pairs.length >= 10) throw Error('Map up to ten fields.');
        c.pairs.push({
          field: draft.columns.find(f => !c.pairs.some(p => p.field === f.key))?.key || '',
          referenceColumn:
            ref?.headers.find(h => !c.pairs.some(p => p.referenceColumn === h)) || '',
        });
        mark();
      }
      if (action === 'tuple-remove') {
        const c = getPath(el.dataset.path);
        if (c.pairs.length > 2) {
          c.pairs.splice(Number(el.dataset.index), 1);
          mark();
        }
      }
      if (action === 'add-column') {
        if (draft.columns.length >= E.LIMITS.columns) throw Error('Use up to 200 columns.');
        let n = draft.columns.length,
          c = E.column(n);
        while (draft.columns.some(f => f.key === c.key)) c = E.column(++n);
        draft.columns.push(c);
        columnId = c.id;
        mark();
      }
      if (action === 'select-column') {
        columnId = id;
      }
      if (action === 'move-column') {
        const i = draft.columns.findIndex(c => c.id === id),
          j = i + Number(el.dataset.delta);
        if (j >= 0 && j < draft.columns.length) {
          draft.columns.splice(j, 0, draft.columns.splice(i, 1)[0]);
          mark();
        }
      }
      if (action === 'remove-column') {
        const c = draft.columns.find(c => c.id === id),
          used =
            draft.rules.some(r => JSON.stringify(r).includes('"' + c.key + '"')) ||
            draft.uniqueGroups.some(g => g.includes(c.key)) ||
            (draft.columnGroups || []).some(g => g.fields.includes(c.key)) ||
            draft.columns.some(f => f.sapReference === c.key);
        if (used)
          throw Error(
            'This field is used in a condition, column group, unique combination or SAP currency/unit reference. Update those first.'
          );
        draft.columns = draft.columns.filter(c => c.id !== id);
        columnId = draft.columns[0]?.id || '';
        mark();
      }
      if (action === 'add-rule') {
        if (!draft.columns.length) throw Error('Add a column before making conditions.');
        const r = E.rule(draft.columns[0].key);
        draft.rules.push(r);
        ruleId = r.id;
        mark();
      }
      if (action === 'select-rule') ruleId = id;
      if (action === 'remove-rule') {
        draft.rules = draft.rules.filter(r => r.id !== id);
        ruleId = draft.rules[0]?.id || '';
        mark();
      }
      if (action === 'add-requirement') {
        const r = draft.rules.find(r => r.id === ruleId),
          checks = E.requirements(r);
        if (checks.length >= E.LIMITS.requirements)
          throw Error('Use up to 200 THEN requirements per condition.');
        if (
          draft.rules.reduce((n, rule) => n + E.requirements(rule).length - 1, 0) >=
          E.LIMITS.additionalRequirements
        )
          throw Error('Use up to 400 additional THEN requirements per template.');
        const field =
          draft.columns.find(c => !checks.some(check => check.field === c.key)) || draft.columns[0];
        (r.additionalAssertions ||= []).push({ ...E.condition(field.key), operator: 'notEmpty' });
        mark();
      }
      if (action === 'remove-requirement') {
        const r = draft.rules.find(r => r.id === ruleId),
          index = Number(el.dataset.index),
          checks = E.requirements(r);
        if (checks.length <= 1) throw Error('Keep at least one THEN requirement.');
        if (!Number.isInteger(index) || index < 0 || index >= checks.length)
          throw Error('Choose a current requirement.');
        checks.splice(index, 1);
        r.assertion = checks[0];
        if (checks.length > 1) r.additionalAssertions = checks.slice(1);
        else delete r.additionalAssertions;
        mark();
      }
      if (action === 'add-clause') {
        getPath(el.dataset.path).conditions.push(E.condition(draft.columns[0].key));
        mark();
      }
      if (action === 'add-group') {
        const g = E.group(draft.columns[0].key);
        getPath(el.dataset.path).groups.push(g);
        mark();
      }
      if (action === 'remove-clause' || action === 'remove-group') {
        const parts = el.dataset.path.split('.'),
          i = Number(parts.pop());
        getPath(parts.join('.')).splice(i, 1);
        mark();
      }
      if (action === 'remove-combination') {
        draft.uniqueGroups.splice(Number(el.dataset.index), 1);
        mark();
      }
      if (action === 'reference-new') {
        referenceEpoch++;
        refEditing = '';
      }
      if (action === 'reference-edit') refEditing = id;
      if (action === 'reference-remove') {
        if (draft.rules.some(r => JSON.stringify(r).includes('"' + id + '"')))
          throw Error('A condition uses this reference. Update that condition before removing it.');
        draft.lookups = draft.lookups.filter(l => l.id !== id);
        refEditing = '';
        mark();
      }
      if (action === 'reference-file') {
        $('valReferenceFile').click();
        return;
      }
      if (action === 'browse') {
        $('valFile').click();
        return;
      }
      if (action === 'clear-file') clearFile();
      if (action === 'sample') {
        loadSample();
        return;
      }
      if (action === 'run') {
        await run();
        return;
      }
      if (action === 'filter') {
        attentionGroup = null;
        issueSelection.clear();
        issuePage = 0;
        pinnedRows.clear();
        filter = el.dataset.filter;
        page = 0;
      }
      if (action === 'page') {
        pinnedRows.clear();
        page += Number(el.dataset.delta);
      }
      if (action === 'issue') {
        const issue = result?.issues[Number(el.dataset.issue)];
        if (!issue || (el.dataset.issueKey && el.dataset.issueKey !== E.issueKey(issue)))
          throw Error('Run validation again before opening this issue.');
        selectedIssue = E.copy(issue);
        targetRow = issue.index;
        filter = 'all';
        const group = currentAttentionGroup();
        if (group && (!group.indices.includes(issue.index) || issue.ignored)) attentionGroup = null;
        page = attentionGroup
          ? Math.floor(currentAttentionGroup().indices.indexOf(targetRow) / 25)
          : Math.floor(targetRow / 25);
      }
      if (action === 'download-template') {
        const t = activeSchema();
        a.download(
          await F.template(t),
          safeName(t.name) + '-template.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        return;
      }
      if (action === 'report' || action === 'accepted' || action === 'export-comparison') {
        if (root.WorkHubCurrentAccess && !root.WorkHubCurrentAccess.can('validator', 'export'))
          throw Error('Exporting validation data is disabled for this account.');
        if (!result || !resultSchema || livePending)
          throw Error('Wait for validation to finish before exporting.');
        const outcome = E.copy(result);
        const exportToken = generation,
          exportOwner = owner;
        outcome.issues.forEach(i => (i.row = headerRow + i.index + 1));
        const exported = await F.report(
          resultSchema,
          rows,
          outcome,
          action === 'accepted',
          action !== 'accepted' || preparationSteps.length
            ? {
                ...comparisonUpload(),
                comparisonFirst: action === 'export-comparison',
              }
            : null
        );
        if (exportToken !== generation || exportOwner !== a.owner?.() || !a.ready()) return;
        a.download(
          exported,
          safeName(
            resultSchema.name +
              (result.context?.companyName ? '-' + result.context.companyName : '')
          ) +
            (action === 'accepted'
              ? '-accepted.xlsx'
              : action === 'export-comparison'
                ? '-comparison.xlsx'
                : '-issues.xlsx'),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        return;
      }
      if (action === 'export-definition') {
        E.checkSchema(draft, true);
        a.download(
          JSON.stringify({ app: 'workhub-validator', version: 1, template: draft }, null, 2),
          safeName(draft.name) + '.json',
          'application/json'
        );
        return;
      }
      if (action === 'duplicate') {
        const t = E.copy(draft);
        t.id = E.uid();
        t.name = (t.name + ' copy').slice(0, 120);
        t.releases = [];
        t.createdAt = new Date().toISOString();
        draft = t;
        selected = t.id;
        baseStamp = '';
        dirty = true;
        clearFile();
        mode = 'columns';
      }
      if (action === 'delete-template') {
        if (
          !root.confirm(
            'Delete this template and its saved versions? Export its definition first if you want to keep a copy.'
          )
        )
          return;
        const templateId = draft.id;
        if (
          a.mutate(d => {
            d.workhub.validator.templates = d.workhub.validator.templates.filter(
              t => t.id !== templateId
            );
            if (d.workhub.validator.profiles)
              d.workhub.validator.profiles = d.workhub.validator.profiles.filter(
                p => p.templateId !== templateId
              );
          })
        ) {
          draft = null;
          selected = '';
          dirty = false;
          clearFile();
        }
      }
      if (action === 'restore-version') {
        if (dirty && !root.confirm('Replace the current draft with this published version?'))
          return;
        const r = draft.releases.find(r => String(r.version) === el.dataset.version);
        Object.assign(draft, { projectId: '', projectName: '' }, E.copy(r.schema));
        runCompanyId = '';
        columnId = draft.columns[0]?.id || '';
        ruleId = draft.rules[0]?.id || '';
        version = 'draft';
        mark();
        mode = 'columns';
      }
      paint();
      if (action === 'issue') {
        const cell = Array.from(document.querySelectorAll('.val-grid input[data-cell]')).find(
          el =>
            Number(el.dataset.cell) === selectedIssue.index &&
            el.dataset.field === selectedIssue.field
        );
        $('valSelectedIssue')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        cell?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        cell?.focus({ preventScroll: true });
        cell?.select();
      }
    }
    function addLibraryField(definition) {
      ensure();
      if (!draft) throw Error('Create a template first.');
      if (draft.columns.length >= E.LIMITS.columns) throw Error('Use up to 200 columns.');
      const c = E.copy(definition);
      c.id = E.uid();
      let n = 1,
        key = c.key,
        label = c.label;
      while (
        draft.columns.some(
          f =>
            f.key.toLowerCase() === key.toLowerCase() || E.headerKey(f.label) === E.headerKey(label)
        )
      ) {
        n++;
        const suffix = '_' + n;
        key = c.key.slice(0, 64 - suffix.length) + suffix;
        const ls = ' (' + n + ')';
        label = c.label.slice(0, 120 - ls.length) + ls;
      }
      c.key = key;
      c.label = label;
      draft.columns.push(c);
      columnId = c.id;
      mode = 'columns';
      mark();
      a.closeModal?.();
      paint();
      say('Field inserted as an independent copy.');
    }
    function referenceDetails(index) {
      if (!result || !resultSchema || !rows[index])
        throw Error('Run validation to inspect the current row.');
      const matches = E.referenceDetails(resultSchema, rows[index], new Map(), result.context);
      const body =
        '<div class="wl-intro"><span class="val-eyebrow">READ THE CODE IN CONTEXT</span><h3>Reference details · row ' +
        (headerRow + index + 1) +
        '</h3><p>Values below come from matching rows in your configured reference lists.</p></div><div class="val-reference-explanations">' +
        matches
          .map(
            m =>
              '<article class="val-reference-explanation"><span class="val-eyebrow">' +
              esc(m.reference) +
              '</span><h3>' +
              esc(m.displayName || m.code) +
              '</h3><code>' +
              esc(m.code) +
              '</code><p>' +
              esc(m.description || 'No additional description configured.') +
              '</p><small>Reference row ' +
              m.sourceRow +
              ' · ' +
              esc(m.fields.join(' + ')) +
              (m.matchCount > 1 ? ' · ' + m.matchCount + ' matches; first five shown' : '') +
              '</small></article>'
          )
          .join('') +
        '</div>' +
        (!matches.length
          ? '<p class="val-help">No matching reference description for this row. Check the values, conditions and selected description columns.</p>'
          : '');
      if (a.openModal) a.openModal('Reference details', body);
      else {
        let dialog = $('valReferenceDialog');
        if (!dialog) {
          dialog = document.createElement('dialog');
          dialog.id = 'valReferenceDialog';
          document.body.append(dialog);
        }
        dialog.innerHTML = body + btn('reference-close', 'Close');
        dialog.showModal();
      }
    }
    function safeName(name) {
      return (
        String(name)
          .replace(/[^A-Za-z0-9_-]+/g, '-')
          .slice(0, 80) || 'validation'
      );
    }
    function copyDialog(form = null) {
      const p = copyPreview;
      if (!p || p.owner !== a.owner?.() || p.token !== generation || p.templateId !== draft?.id)
        throw Error('Reopen the copy dialog for the current template.');
      const get = key => form?.elements.namedItem(key)?.value,
        projectId =
          p.kind === 'template'
            ? (get('copyProject') ?? draft.projectId ?? '')
            : draft.projectId || '',
        sourceId = get('copySource') || draft.id,
        source = sourceId === draft.id ? draft : store().templates.find(t => t.id === sourceId);
      if (!source) throw Error('Choose an available source template.');
      const companies = a
          .state()
          .projectCompanies.filter(c => c.projectId === projectId && c.active !== false),
        scope = projectId ? get('copyScope') || 'selected' : 'all',
        sourceCompanies = [
          ...new Map(source.rules.flatMap(r => r.companies || []).map(c => [c.id, c])).values(),
        ],
        requestedCompany =
          get('copySourceCompany') ||
          (p.kind === 'template' && sourceCompanies.length ? sourceCompanies[0].id : '*'),
        sourceCompany = ['*', 'shared', ...sourceCompanies.map(c => c.id)].includes(
          requestedCompany
        )
          ? requestedCompany
          : '*',
        sourceRules = source.rules.filter(
          r =>
            sourceCompany === '*' ||
            (sourceCompany === 'shared'
              ? r.companyScope !== 'selected'
              : r.companyScope !== 'selected' || r.companies.some(c => c.id === sourceCompany))
        );
      const sources = [draft, ...store().templates.filter(t => t.id !== draft.id)],
        selectedRules =
          form && p.sourceId === sourceId && p.sourceCompany === sourceCompany
            ? new Set(
                Array.from(form.querySelectorAll('[name="copyRule"]:checked')).map(el => el.value)
              )
            : null,
        selectedCompanies =
          form && p.projectId === projectId
            ? new Set(
                Array.from(form.querySelectorAll('[name="copyCompany"]:checked')).map(
                  el => el.value
                )
              )
            : new Set();
      Object.assign(p, {
        sourceId,
        sourceCompany,
        projectId,
        sourceSchema: JSON.stringify(E.schema(source)),
      });
      const body =
        '<form id="valCopyForm"><section id="valCopyReview" class="val-copy-review"><p>' +
        (p.kind === 'template'
          ? 'Create an independent template draft with its columns, conditions and references. Published versions and run history are not copied.'
          : 'Add selected conditions to this draft. Referenced lists are copied too. Matching technical field names must exist in the destination; existing conditions are kept.') +
        '</p>' +
        (p.kind === 'template'
          ? input(
              'copyName',
              'New template name',
              get('copyName') ?? (draft.name + ' copy').slice(0, 120),
              'text',
              'maxlength="120" required'
            ) +
            select(
              'copyProject',
              'Destination project',
              [
                ['', 'Standalone · no project link'],
                ...a.state().projects.map(project => [project.id, project.name]),
              ],
              projectId
            )
          : '<p><strong>Destination:</strong> ' +
            esc(draft.name) +
            (draft.projectId ? ' · ' + esc(projectName(draft)) : ' · Standalone') +
            '</p>' +
            select(
              'copySource',
              'Source template',
              sources.map(t => [
                t.id,
                t.name + (t.projectId ? ' · ' + projectName(t) : ' · Standalone'),
              ]),
              sourceId
            )) +
        select(
          'copySourceCompany',
          'Source company conditions',
          [
            ['*', 'All conditions'],
            ['shared', 'Shared conditions only'],
            ...sourceCompanies.map(c => [c.id, 'Shared + ' + c.name]),
          ],
          sourceCompany
        ) +
        '<fieldset class="val-company-scope" data-val-context="' +
        esc(JSON.stringify([sourceId, sourceCompany])) +
        '"><legend>Conditions to copy</legend><div class="val-check-list">' +
        sourceRules
          .map(
            r =>
              '<label class="val-toggle"><input type="checkbox" name="copyRule" value="' +
              esc(r.id) +
              '"' +
              (!selectedRules || selectedRules.has(r.id) ? ' checked' : '') +
              '><span>' +
              esc(r.name) +
              '<small> · ' +
              esc(
                r.companyScope === 'selected'
                  ? r.companies.map(c => c.name).join(', ')
                  : 'All companies'
              ) +
              (r.enabled ? '' : ' · Paused') +
              '</small></span></label>'
          )
          .join('') +
        '</div>' +
        (!sourceRules.length ? '<p>No conditions in this selection.</p>' : '') +
        '</fieldset>' +
        select(
          'copyScope',
          'Apply copied conditions to',
          [
            ['all', projectId ? 'All companies in destination project' : 'All validation runs'],
            ...(projectId ? [['selected', 'Selected destination companies only']] : []),
          ],
          scope
        ) +
        (scope === 'selected'
          ? '<fieldset class="val-company-scope" data-val-context="' +
            esc(projectId) +
            '"><legend>Destination companies</legend><div class="val-check-list">' +
            companies
              .map(
                c =>
                  '<label class="val-toggle"><input type="checkbox" name="copyCompany" value="' +
                  esc(c.id) +
                  '"' +
                  (selectedCompanies.has(c.id) ? ' checked' : '') +
                  '><span>' +
                  esc(c.name) +
                  '</span></label>'
              )
              .join('') +
            '</div>' +
            (!companies.length
              ? '<p>Add or activate companies in the destination project first.</p>'
              : '') +
            '</fieldset>'
          : '') +
        '<p class="val-help">Every copied condition uses the destination scope above. Source conditions stay unchanged. Paused conditions remain paused. Review the new draft, then Save draft.</p><div class="modal-actions"><button type="submit" class="primary">' +
        (p.kind === 'template' ? 'Create template copy' : 'Copy selected conditions') +
        '</button></div></section></form>';
      const current = $('valCopyForm');
      if (current?.closest('dialog[open]')) patchSurface(current, body);
      else
        a.openModal(
          p.kind === 'template'
            ? 'Copy template to another project or company'
            : 'Copy conditions from a project or company',
          body
        );
    }
    function applyCopy(form) {
      const p = copyPreview;
      if (
        !p ||
        p.owner !== a.owner?.() ||
        p.token !== generation ||
        p.templateId !== draft?.id ||
        form !== $('valCopyForm') ||
        !form.closest('dialog[open]')
      )
        throw Error('Reopen the copy dialog for the current template.');
      const get = key => form.elements.namedItem(key)?.value || '',
        projectId = p.kind === 'template' ? get('copyProject') : draft.projectId || '',
        project = a.state().projects.find(project => project.id === projectId),
        companies = Array.from(form.querySelectorAll('[name="copyCompany"]:checked')).map(el => {
          const c = a
            .state()
            .projectCompanies.find(
              c => c.id === el.value && c.projectId === projectId && c.active !== false
            );
          if (!c) throw Error('Choose active destination companies from this project.');
          return { id: c.id, name: c.name };
        }),
        destination = {
          projectId,
          projectName: project?.name || '',
          companyScope: get('copyScope'),
          companies,
        };
      if (projectId && !project) throw Error('Choose a maintained destination project.');
      if (destination.companyScope === 'selected' && !companies.length)
        throw Error('Select at least one destination company.');
      let next;
      if (p.kind === 'template') {
        if (p.sourceSchema !== JSON.stringify(E.schema(draft)))
          throw Error('The source template changed. Reopen the copy dialog.');
        next = E.copyTemplate(
          draft,
          get('copyName').trim(),
          destination,
          Array.from(form.querySelectorAll('[name="copyRule"]:checked')).map(el => el.value)
        );
        if (dirty && !saveDraft(true)) return;
        draft = next;
        selected = next.id;
        baseStamp = '';
        columnId = next.columns[0]?.id || '';
        ruleId = next.rules[0]?.id || '';
        version = 'draft';
        mode = 'columns';
        clearFile();
      } else {
        const sourceId = get('copySource'),
          source = sourceId === draft.id ? draft : store().templates.find(t => t.id === sourceId);
        if (!source) throw Error('Choose an available source template.');
        if (p.sourceSchema !== JSON.stringify(E.schema(source)))
          throw Error('The source template changed. Reopen the copy dialog.');
        next = E.copyConditions(
          source,
          draft,
          Array.from(form.querySelectorAll('[name="copyRule"]:checked')).map(el => el.value),
          destination
        );
        ruleId = next.rules[draft.rules.length]?.id || '';
        draft = next;
        mode = 'rules';
      }
      copyPreview = null;
      mark();
      a.closeModal();
      say(
        p.kind === 'template'
          ? 'Independent template copy created. Review its company conditions, then Save draft.'
          : 'Conditions and their references copied. Review the destination scopes, then Save draft.'
      );
      paint();
    }
    function openCorrections(index, field) {
      if (livePending) checkEdit();
      if (livePending) throw Error('Wait for the current edit to finish checking.');
      if (!result || !rows[index] || !resultSchema)
        throw Error('Run validation before choosing a correction.');
      if (!Number.isInteger(Number(mapping[field])) || Number(mapping[field]) < 0)
        throw Error('Map this field to an upload column before choosing a correction.');
      const column = resultSchema.columns.find(c => c.key === field);
      if (!column) throw Error('Choose an existing field.');
      correction = {
        owner,
        token: generation,
        index,
        field,
        row: JSON.stringify(rows[index]),
        schema: JSON.stringify(activeSchema()),
        context: E.copy(result.context),
        choices: [],
      };
      a.openModal(
        'Suggested corrections',
        `<section id="valCorrectionReview"><span class="eyebrow">ROW ${headerRow + index + 1} · ${esc(column.label)}</span><h3>Choose a maintained value</h3><p>Current value: <strong>${esc(rows[index][field] || '(blank)')}</strong></p><p class="hint">Reference combinations keep the other mapped values in this row. Choosing a value automatically rechecks the whole upload. The original file on your device is unchanged.</p><label for="valSuggestionSearch">Search reference choices</label><input id="valSuggestionSearch" type="search" maxlength="120" placeholder="Search code, name or description"><div id="valSuggestionChoices" class="val-suggestion-choices" aria-live="polite"></div></section>`
      );
      paintCorrections();
    }
    function paintCorrections() {
      if (!correction || correction.owner !== a.owner?.() || correction.token !== generation)
        return;
      const result = E.suggestions(
        resultSchema,
        rows[correction.index],
        correction.field,
        $('valSuggestionSearch')?.value || '',
        correction.context
      );
      correction.choices = result.choices;
      $('valSuggestionChoices').innerHTML =
        `<p class="hint">${result.total} valid choice(s)${result.total > 30 ? ' · first 30 shown; search to narrow the list' : ''}.</p>${result.choices.length ? result.choices.map((c, index) => `<button type="button" data-val="apply-correction" data-choice="${index}"><strong>${esc(c.value)}</strong>${c.detail ? `<span>${esc(c.detail)}</span>` : ''}<small>${esc(c.source)}</small><span class="val-correction-apply">Apply value ↗</span></button>`).join('') : '<p>No maintained choices match this field and the current reference combination. Check the other mapped fields or update your reference list.</p>'}`;
    }
    function applyCorrection(choice) {
      if (
        !correction ||
        correction.owner !== a.owner?.() ||
        correction.token !== generation ||
        !$('valCorrectionReview')?.closest('dialog[open]') ||
        correction.row !== JSON.stringify(rows[correction.index]) ||
        correction.schema !== JSON.stringify(activeSchema())
      )
        throw Error(
          'This correction preview changed. Run validation and open the suggestions again.'
        );
      if (!Number.isInteger(choice) || !correction.choices[choice])
        throw Error('Choose an available correction.');
      const { index, field } = correction,
        value = correction.choices[choice].value,
        source = Number(mapping[field]);
      if (!Number.isInteger(source) || source < 0)
        throw Error('Map the field before applying a correction.');
      correction = null;
      targetRow = index;
      a.closeModal();
      editCell(index, field, value, true);
    }
    async function loadSetupFile(file) {
      ensure();
      if (!file || !/\.xlsx$/i.test(file.name))
        throw Error('Choose an .xlsx setup workbook. Download the setup template to get started.');
      commitCurrent();
      const token = ++generation,
        account = owner;
      runner?.cancel();
      setupPreview = null;
      busy = true;
      say('Reading Excel setup…');
      try {
        const value = await F.read(file);
        if (token !== generation || account !== a.owner?.() || !a.ready()) return;
        const t = S.parse(value);
        setupPreview = { template: t, token, owner: account };
        a.openModal(
          'Review Excel setup',
          `<section id="valSetupReview" class="val-setup-review"><span class="eyebrow">NEW TEMPLATE DRAFT</span><h3>${esc(t.name)}</h3><p>${esc(t.description || 'Columns, conditions and reference lists from your workbook.')}</p><div class="val-setup-counts">${[
            [t.columns.length, 'Columns'],
            [t.mode === 'sap' ? 'SAP' : 'General', 'Template type'],
            [t.rules.length, 'Conditions'],
            [t.lookups.length, 'Reference lists'],
            [t.uniqueGroups.length, 'Unique combinations'],
          ]
            .map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`)
            .join(
              ''
            )}</div><div class="val-setup-table"><table><thead><tr><th>Field</th><th>Label</th><th>Type</th><th>Required</th></tr></thead><tbody>${t.columns
            .slice(0, 8)
            .map(
              c =>
                `<tr><td>${esc(c.key)}</td><td>${esc(c.label)}</td><td>${esc(t.mode === 'sap' ? E.sapSettings(c).type + ' (' + E.sapSettings(c).length + ')' : c.type)}</td><td>${c.required ? 'Yes' : 'No'}</td></tr>`
            )
            .join(
              ''
            )}</tbody></table></div>${t.columns.length > 8 ? '<p class="hint">First 8 columns shown. All columns will be added.</p>' : ''}${t.lookups.length ? `<p><strong>References:</strong> ${t.lookups.map(l => `${esc(l.name)} (${l.rows.length} rows)`).join(', ')}.</p>` : ''}<p class="hint">Creates a new draft. Your saved templates and published versions stay in place. Reference values become part of the definition when you save.${dirty ? ' Your current unsaved draft will be replaced in the editor. Cancel and save it first if you want to keep those edits.' : ''}</p><div class="modal-actions"><button type="button" data-val="cancel-setup">Cancel</button><button type="button" class="primary" data-val="apply-setup">Create new draft</button></div></section>`
        );
      } finally {
        if (token === generation && account === a.owner?.()) busy = false;
      }
    }
    function formSubmit(form) {
      ensure();
      if (queueBusy || queueIO) throw Error('Wait for the current queue operation.');
      if (form.id === 'valProfileForm') {
        saveProfileForm(form);
        return;
      }
      if (form.id === 'valRunReferenceForm') {
        addRunReference(form);
        return;
      }
      if (form.id === 'valPreparationForm') {
        previewPreparation(form);
        return;
      }
      if (form.id === 'valCopyForm') {
        applyCopy(form);
        return;
      }
      if (form.id === 'valPasteForm') {
        if (fileQueue.length) throw Error('Clear the queue before using pasted data.');
        commitCurrent();
        generation++;
        runner?.cancel();
        cancelLive();
        busy = false;
        book = {
          sheets: [
            { name: 'Pasted data', rows: E.parseCSV(form.elements.namedItem('data').value) },
          ],
        };
        sheetIndex = 0;
        headerRow = 1;
        fileName = 'Pasted data';
        getDataFromSheet();
        paint();
        return;
      }
      if (form.id === 'valUniqueForm') {
        commitCurrent();
        const keys = Array.from(form.querySelectorAll('input:checked')).map(el => el.name);
        if (keys.length < 2) throw Error('Select at least two fields.');
        draft.uniqueGroups.push(keys);
        form.reset();
        mark();
        paint();
        return;
      }
      if (form.id === 'valReferenceForm') {
        commitCurrent();
        const table = E.parseCSV(form.elements.namedItem('data').value),
          headers = table.shift() || [],
          l = {
            id: form.dataset.id || E.uid(),
            name: form.elements.namedItem('name').value.trim(),
            headers,
            rows: table,
            codeColumn: headers.includes(form.elements.namedItem('codeColumn')?.value)
              ? form.elements.namedItem('codeColumn').value
              : headers[0],
            nameColumn: headers.includes(form.elements.namedItem('nameColumn')?.value)
              ? form.elements.namedItem('nameColumn').value
              : '',
            descriptionColumns: Array.from(form.querySelectorAll('[name="refDescription"]:checked'))
              .map(x => x.value)
              .filter(h => headers.includes(h)),
          };
        const proposed = E.copy(draft),
          i = proposed.lookups.findIndex(x => x.id === l.id);
        if (i < 0) proposed.lookups.push(l);
        else proposed.lookups[i] = l;
        E.checkSchema(proposed, true);
        draft = proposed;
        refEditing = l.id;
        mark();
        say('Reference list added to the draft.');
        paint();
        return;
      }
      commitCurrent();
      E.checkSchema(draft, true);
      mark();
      say(
        form.id === 'valColumnGroupForm'
          ? 'Column group and value set applied to draft.'
          : form.id === 'valRuleForm'
            ? 'Condition applied to draft.'
            : 'Column changes applied to draft.'
      );
      paint();
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-val]');
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      void handle(el).catch(error => {
        busy = false;
        if (el.dataset.val.startsWith('prep-') && $('valPreparationPreview'))
          $('valPreparationPreview').textContent = error.message;
        say(error.message, true);
        if (
          (el.dataset.val.startsWith('run-setup-') || el.dataset.val === 'profile-delete') &&
          a.ready() &&
          draft
        )
          paint();
      });
    });
    document.addEventListener('submit', event => {
      if (!event.target.id.startsWith('val')) return;
      event.preventDefault();
      try {
        formSubmit(event.target);
      } catch (error) {
        if (event.target.id === 'valProfileForm' && $('valProfileError'))
          $('valProfileError').textContent = error.message;
        if (event.target.id === 'valPreparationForm' && $('valPreparationPreview'))
          $('valPreparationPreview').textContent = error.message;
        say(error.message, true);
        if (event.target.id === 'valRunReferenceForm') paint();
      }
    });
    document.addEventListener('input', event => {
      if (queueBusy || queueIO) return;
      if (event.target.id === 'valAttentionSearch') {
        attentionSearch = event.target.value;
        attentionPage = 0;
        patchResults();
        return;
      }
      if (event.target.name === 'comparisonRow' && event.target.closest?.('#valComparison')) {
        const n = Number(event.target.value);
        comparisonRow = Number.isInteger(n) && n >= 1 && n <= sourceRows.length ? String(n) : '';
        comparisonPage = 0;
        patchResults();
        return;
      }
      if (['valSetupSearch', 'valSetupReferenceSearch'].includes(event.target.id)) {
        if (event.target.id === 'valSetupSearch') setupSearch = event.target.value;
        else setupReferenceSearch = event.target.value;
        paint();
        return;
      }
      if (event.target.form?.id === 'valPreparationForm') {
        if (preparation) preparation.plan = null;
        const apply = document.querySelector('[data-val="prep-apply"]');
        if (apply) apply.disabled = true;
        if ($('valPreparationPreview'))
          $('valPreparationPreview').textContent =
            'Options changed. Preview again before applying.';
      }
      if (event.target.id === 'valIgnoreReason') ignoreReason = event.target.value;
      if (event.target.id === 'valSuggestionSearch') paintCorrections();
      if (event.target.matches?.('.val-grid input[data-cell]')) {
        try {
          ensure();
          editCell(
            Number(event.target.dataset.cell),
            event.target.dataset.field,
            event.target.value
          );
        } catch (error) {
          say(error.message, true);
        }
      }
      if (event.target.closest?.('#valColumnForm,#valRuleForm,#valMetaForm,#valColumnGroupForm'))
        mark();
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (queueBusy || queueIO) return;
      if (el.form?.id === 'valPreparationForm') {
        if (el.name === 'delimiter')
          el.form.elements.customDelimiter.closest('label').hidden = el.value !== 'custom';
        if (el.name === 'primary')
          for (const choice of el.form.querySelectorAll('[name="mapped"]')) {
            choice.disabled = choice.value === el.value;
            if (choice.disabled) choice.checked = false;
          }
        if (preparation) preparation.plan = null;
        const apply = document.querySelector('[data-val="prep-apply"]');
        if (apply) apply.disabled = true;
        if ($('valPreparationPreview'))
          $('valPreparationPreview').textContent =
            'Options changed. Preview again before applying.';
        return;
      }
      if (
        el.form?.id === 'valCopyForm' &&
        ['copyProject', 'copySource', 'copySourceCompany', 'copyScope'].includes(el.name)
      ) {
        try {
          ensure();
          copyDialog(el.form);
        } catch (error) {
          say(error.message, true);
        }
        return;
      }
      if (!el.closest?.('.validation-studio')) return;
      void (async () => {
        ensure();
        if (el.name === 'validationProfile') {
          try {
            chooseProfile(el.value);
          } catch (error) {
            el.value = runProfileId;
            throw error;
          }
          return;
        }
        if (el.dataset.setupRule !== undefined) {
          try {
            setupAccess();
            const s = E.copy(setupChoices()),
              id = el.dataset.setupRule;
            if (
              el.checked &&
              !activeSchema().rules.some(
                r => r.id === id && E.ruleApplies(r, { companyId: runCompanyId })
              )
            )
              throw Error('This condition is paused or unavailable for the selected company.');
            s.ruleIds = el.checked
              ? [...new Set([...s.ruleIds, id])]
              : s.ruleIds.filter(x => x !== id);
            runSelection = s;
            setupChanged();
          } catch (error) {
            el.checked = !el.checked;
            throw error;
          }
          return;
        }
        if (el.dataset.setupReference !== undefined) {
          try {
            setupAccess();
            const s = E.copy(setupChoices()),
              c = referenceChoices(activeSchema(), s).find(
                c => c.key === el.dataset.setupReference
              );
            if (!c || (el.checked && !c.available)) throw Error('This reference is unavailable.');
            if (!el.checked && !deselectRunReferences(s, new Set([c.key]))) {
              el.checked = true;
              return;
            }
            rememberReferenceChoices(s);
            s.referenceChecks = s.referenceChecks.filter(x => referenceKey(x) !== c.key);
            if (el.checked) s.referenceChecks.push({ id: E.uid(), ...c.check });
            // Allow removing stale mappings one at a time before validating the full setup.
            if (el.checked) E.runSetup(activeSchema(), s, { companyId: runCompanyId });
            runSelection = s;
            setupChanged();
          } catch (error) {
            el.checked = !el.checked;
            throw error;
          }
          return;
        }
        if (el.name === 'setupReference' && el.form?.id === 'valRunReferenceForm') {
          setupAccess();
          const l = activeSchema().lookups.find(l => l.id === el.value),
            target = el.form.elements.setupReferenceColumn;
          target.innerHTML = options(
            (l?.headers || []).map(h => [h, h]),
            l?.codeColumn || l?.headers[0]
          );
          return;
        }
        if (el.dataset.issueChoice !== undefined) {
          const issue = result?.issues[Number(el.dataset.issueChoice)];
          if (!issue || livePending || issue.ignored || E.issueKey(issue) !== el.dataset.issueKey)
            throw Error('Select a current unresolved issue.');
          el.checked
            ? issueSelection.add(E.issueKey(issue))
            : issueSelection.delete(E.issueKey(issue));
          patchResults();
          return;
        }
        if (el.name === 'projectId' && el.form?.id === 'valMetaForm') {
          if (
            el.value !== (draft.projectId || '') &&
            draft.rules.some(r => r.companyScope === 'selected')
          ) {
            if (
              !root.confirm(
                'Changing project will clear company assignments and pause company-specific conditions. Reassign their companies and enable them again in Conditions. Continue?'
              )
            ) {
              el.value = draft.projectId || '';
              return;
            }
            for (const r of draft.rules)
              if (r.companyScope === 'selected') {
                r.companyScope = 'all';
                r.companies = [];
                r.enabled = false;
              }
          }
          commitCurrent();
          runCompanyId = '';
          mark();
          paint();
          return;
        }
        if (el.name === 'groupSet' && el.form?.id === 'valColumnGroupForm') {
          commitCurrent();
          valueSetId = el.value;
          paint();
          return;
        }
        if (el.name === 'groupField' && el.form?.id === 'valColumnGroupForm') {
          try {
            commitCurrent();
            mark();
            patchColumnGroup(el.form);
          } catch (error) {
            el.checked = !el.checked;
            throw error;
          }
          return;
        }
        if (el.name === 'companyScope' && el.form?.id === 'valRuleForm') {
          commitCurrent();
          mark();
          paint();
          return;
        }
        if (el.name === 'validationCompany') {
          setupAccess();
          cancelLive();
          pinnedRows.clear();
          runCompanyId = el.value;
          generation++;
          runner?.cancel();
          busy = false;
          result = null;
          resetReview();
          resultSchema = null;
          correction = null;
          if ($('valCorrectionReview')) a.closeModal?.();
          filter = 'all';
          page = 0;
          paint();
          return;
        }
        if (el.name === 'mode' && el.form?.id === 'valMetaForm') {
          commitCurrent();
          mark();
          paint();
          return;
        }
        if (el.name === 'sapType' && el.form?.id === 'valColumnForm') {
          const spec = E.SAP_TYPES[el.value];
          if (!spec) return;
          el.form.elements.namedItem('sapLength').value = spec.length;
          el.form.elements.namedItem('sapDecimals').value = spec.decimals || 0;
          if (el.form.elements.namedItem('sapReference'))
            el.form.elements.namedItem('sapReference').value = '';
          commitCurrent();
          mark();
          paint();
          return;
        }
        if (el.id === 'valQueueFiles') {
          const files = Array.from(el.files);
          el.value = '';
          await addQueueFiles(files);
          return;
        }
        if (el.id === 'valFile') {
          const file = el.files[0];
          el.value = '';
          if (file) await loadFile(file);
          return;
        }
        if (el.id === 'valSetupFile') {
          const file = el.files[0];
          el.value = '';
          if (file) await loadSetupFile(file);
          return;
        }
        if (el.id === 'valReferenceFile') {
          const file = el.files[0];
          el.value = '';
          if (file) await loadFile(file, 'reference');
          return;
        }
        if (el.id === 'valDefinitionFile') {
          const file = el.files[0];
          el.value = '';
          if (!file) return;
          if (file.size > 1000000) throw Error('Template definitions must be below 1 MB.');
          const account = owner,
            token = ++generation;
          runner?.cancel();
          const value = JSON.parse(await file.text());
          if (token !== generation || account !== a.owner?.()) return;
          if (value.app !== 'workhub-validator' || value.version !== 1)
            throw Error('Choose a Validation Studio template definition.');
          const t = value.template;
          E.validateState({ workhub: { validator: { templates: [t], runs: [] } } });
          if (dirty && !root.confirm('Import this definition and discard unsaved draft changes?'))
            return;
          draft = E.copy(t);
          draft.id = E.uid();
          draft.createdAt = new Date().toISOString();
          selected = draft.id;
          baseStamp = '';
          dirty = true;
          columnId = draft.columns[0]?.id || '';
          ruleId = draft.rules[0]?.id || '';
          version = 'draft';
          mode = 'columns';
          clearFile();
          paint();
          return;
        }
        if (['comparisonFilter', 'comparisonField', 'comparisonRow'].includes(el.name)) {
          if (el.name === 'comparisonFilter') comparisonFilter = el.value;
          if (el.name === 'comparisonField') comparisonField = el.value;
          if (el.name === 'comparisonRow') {
            const n = Number(el.value);
            comparisonRow =
              Number.isInteger(n) && n >= 1 && n <= sourceRows.length ? String(n) : '';
            el.value = comparisonRow;
          }
          comparisonPage = 0;
          patchResults();
          return;
        }
        if (el.id === 'valSearch') {
          search = el.value;
          paint();
          return;
        }
        if (el.name === 'version') {
          if (
            preparationSteps.length &&
            !root.confirm(
              'Changing version restores the original upload and clears preparations and cell corrections. Continue?'
            )
          ) {
            el.value = version;
            return;
          }
          cancelLive();
          pinnedRows.clear();
          generation++;
          runner?.cancel();
          busy = false;
          version = el.value;
          runCompanyId = '';
          runSelection = null;
          runProfileId = '';
          setupSearch = '';
          setupReferenceSearch = '';
          extraReferenceChoices = [];
          if (book) getDataFromSheet();
          result = null;
          resetReview();
          rows = [];
          paint();
          return;
        }
        if (el.name === 'sheet' || el.name === 'headerRow') {
          if (
            preparationSteps.length &&
            !root.confirm(
              'Changing the worksheet or header restores its original values and clears preparations and cell corrections. Continue?'
            )
          ) {
            el.value = el.name === 'sheet' ? sheetIndex : headerRow;
            return;
          }
          cancelLive();
          pinnedRows.clear();
          generation++;
          runner?.cancel();
          busy = false;
          if (el.name === 'sheet') sheetIndex = Number(el.value);
          else headerRow = Number(el.value);
          if (!Number.isInteger(headerRow) || headerRow < 1)
            throw Error('Enter a valid header row.');
          getDataFromSheet();
          paint();
          return;
        }
        if (el.dataset.map) {
          cancelLive();
          pinnedRows.clear();
          generation++;
          runner?.cancel();
          busy = false;
          mapping[el.dataset.map] = Number(el.value);
          rows = [];
          result = null;
          resetReview();
          paint();
          return;
        }
        if (el.dataset.cell !== undefined) {
          editCell(Number(el.dataset.cell), el.dataset.field, el.value, true);
          return;
        }
        if (
          ['operator', 'lookupId', 'valueSource', 'groupId', 'valueSetId', 'field'].includes(
            el.dataset.clause
          )
        ) {
          commitCurrent();
          mark();
          paint();
        }
      })().catch(error => {
        busy = false;
        say(error.message, true);
        if (
          el.name === 'validationProfile' ||
          el.dataset.setupRule !== undefined ||
          el.dataset.setupReference !== undefined
        )
          paint();
      });
    });
    let dragging = '';
    document.addEventListener('dragstart', event => {
      const el = event.target.closest?.('[data-column-id]');
      if (el) {
        commitCurrent();
        dragging = el.dataset.columnId;
        event.dataTransfer?.setData('text/plain', dragging);
      }
    });
    document.addEventListener('dragover', event => {
      const target = event.target.closest?.('#valDropzone,[data-column-id]');
      if (target) {
        event.preventDefault();
        target.classList.add('val-drag-over');
      }
    });
    document.addEventListener('dragleave', event =>
      event.target.closest?.('#valDropzone,[data-column-id]')?.classList.remove('val-drag-over')
    );
    document.addEventListener('drop', event => {
      const drop = event.target.closest?.('#valDropzone'),
        target = event.target.closest?.('[data-column-id]');
      if (!drop && !target) return;
      event.preventDefault();
      event.stopPropagation();
      document
        .querySelectorAll('.val-drag-over')
        .forEach(el => el.classList.remove('val-drag-over'));
      try {
        ensure();
        if (queueBusy || queueIO) throw Error('Wait for the current queue operation.');
        if (drop && event.dataTransfer?.files[0]) {
          const files = event.dataTransfer.files;
          void (
            files.length > 1 || fileQueue.length ? addQueueFiles(files) : loadFile(files[0])
          ).catch(err => say(err.message, true));
          return;
        }
        if (target && dragging) {
          const from = draft.columns.findIndex(c => c.id === dragging),
            to = draft.columns.findIndex(c => c.id === target.dataset.columnId);
          if (from >= 0 && to >= 0) {
            draft.columns.splice(to, 0, draft.columns.splice(from, 1)[0]);
            mark();
            paint();
          }
          dragging = '';
        }
      } catch (err) {
        say(err.message, true);
      }
    });
    return {
      render,
      patchRender,
      sync,
      handle,
      loadFile,
      loadSetupFile,
      openCorrections,
      applyCorrection,
      run,
      addQueueFiles,
      openQueueJob,
      confirmQueueJob,
      startQueue,
      cancelQueue,
      exportQueue,
      saveDraft,
      publish,
      addLibraryField,
      referenceDetails,
      snapshot: () => ({
        draft: E.copy(draft),
        dirty,
        mode,
        rows: E.copy(rows),
        sourceRows: E.copy(sourceRows),
        originalRows: E.copy(originalRows),
        preparedRows: E.copy(preparedRows),
        origins: E.copy(origins),
        preparations: E.copy(preparationSteps),
        undoCount: preparationUndo.length,
        result: E.copy(result),
        mapping: { ...mapping },
        runCompanyId,
        runSelection: draft ? E.copy(setupChoices()) : null,
        runProfileId,
        livePending,
        queue: fileQueue.map(job => ({
          id: job.id,
          name: job.file.name,
          status: queueStatus(job),
          summary: job.summary,
        })),
        queueActiveId,
        queueBusy: queueBusy || queueIO,
        attentionGroup: attentionGroup?.key || '',
        owner,
      }),
      loadSample,
      openPreparation,
      applyPreparation,
      undoPreparation,
    };
  }
  root.WorkHubValidatorStudio = { install, groupIssues };
})(window);
