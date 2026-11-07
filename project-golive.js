/** Project-owned Go-Live issue register with reviewed imports and local exports. */
(function (root) {
  'use strict';
  const E = root.WorkHubGoLiveIssuesEngine,
    F = root.WorkHubGoLiveIssuesFiles,
    XF = root.WorkHubValidatorFiles;
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const copy = x => JSON.parse(JSON.stringify(x));
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'issue-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const btn = (action, label, attrs = '', cls = '') =>
    `<button type="button" class="gli-button ${cls}" data-gli="${action}" ${attrs}>${label}</button>`;
  const option = (value, label, selected) =>
    `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
  function install(a) {
    let owner = '',
      pid = '',
      editor = null,
      original = '',
      importing = false,
      paste = '',
      pasteMode = 'auto',
      book = null,
      sheetIndex = 0,
      headerRow = 1,
      mapping = null,
      sourceName = '',
      busy = false,
      controller = null,
      query = '',
      category = 'all',
      page = 0,
      notice = '',
      problem = false,
      serial = 0;
    const $ = id => document.getElementById(id),
      state = () => a.state(),
      project = () => state().projects.find(p => p.id === pid),
      records = () => project()?.goLiveIssues || [],
      can = action => !root.WorkHubCurrentAccess || root.WorkHubCurrentAccess.can('specs', action);
    function guard(action = 'edit', expectedOwner = owner, expectedProject = pid) {
      if (
        !a.ready() ||
        !expectedOwner ||
        a.owner() !== expectedOwner ||
        state().activeProjectId !== expectedProject ||
        !state().projects.some(p => p.id === expectedProject)
      )
        throw Error('Reopen Go-Live issues after signing in or switching projects.');
      if (!can(action)) throw Error('Your account cannot ' + action + ' this project.');
      if (document.body.classList.contains('hub-private'))
        throw Error('Turn off screen privacy before editing or exporting issues.');
    }
    function reset() {
      serial++;
      controller?.abort();
      controller = null;
      busy = false;
      editor = null;
      original = '';
      importing = false;
      paste = '';
      pasteMode = 'auto';
      book = null;
      sheetIndex = 0;
      headerRow = 1;
      mapping = null;
      sourceName = '';
      query = '';
      category = 'all';
      page = 0;
      notice = '';
      problem = false;
    }
    function sync() {
      const account = a.ready() ? a.owner() || '' : '',
        nextProject = state().activeProjectId || '';
      if (owner !== account || pid !== nextProject) {
        reset();
        owner = account;
        pid = nextProject;
      }
    }
    function refresh() {
      const el = $('gliWorkspace');
      if (!el) return;
      const focus = document.activeElement,
        id = focus?.id,
        start = focus?.selectionStart,
        end = focus?.selectionEnd;
      el.outerHTML = render(pid);
      if (id && $(id)) {
        $(id).focus({ preventScroll: true });
        if (typeof start === 'number') $(id).setSelectionRange?.(start, end);
      }
    }
    function fail(error) {
      if (error?.name === 'AbortError') return;
      notice = error?.message || 'The issue operation could not be completed.';
      problem = true;
      refresh();
    }
    function say(message) {
      notice = message;
      problem = false;
    }
    function visible() {
      const term = query.trim().toLowerCase();
      return records().filter(
        issue =>
          (category === 'all' || E.category(issue.status) === category) &&
          (!term ||
            E.FIELDS.some(([key]) =>
              String(issue[key] || '')
                .toLowerCase()
                .includes(term)
            ) ||
            issue.extras.some(x => (x.header + ' ' + x.value).toLowerCase().includes(term)))
      );
    }
    function card(projectId) {
      const p = state().projects.find(x => x.id === projectId),
        m = E.metrics(p?.goLiveIssues || []);
      return `<button type="button" class="gli-overview-card" data-action="project-view" data-view="go-live-issues"><span class="gli-overview-icon" aria-hidden="true">↗</span><span><small>PROJECT INTELLIGENCE</small><strong>Go-Live issue register</strong><span>${m.total} issues · ${m.open + m.progress} open / in progress</span></span><b aria-hidden="true">→</b></button>`;
    }
    function field(name, label, value, multiline = false) {
      const more =
        name === 'status'
          ? ' list="gliStatusOptions"'
          : name === 'priority'
            ? ' list="gliPriorityOptions"'
            : '';
      return `<label class="gli-field${multiline ? ' gli-wide' : ''}"><span>${esc(label)}${name === 'title' ? ' *' : ''}</span>${multiline ? `<textarea id="gliEdit-${name}" data-gli-field="${name}" rows="3" maxlength="${name === 'title' ? 500 : 32000}">${esc(value)}</textarea>` : `<input id="gliEdit-${name}" data-gli-field="${name}" value="${esc(value)}" maxlength="${name === 'title' ? 500 : 32000}"${more}${name === 'title' ? ' required' : ''}>`}</label>`;
    }
    function editorView() {
      if (!editor) return '';
      return `<section class="gli-panel gli-editor"><div class="gli-panel-head"><div><span class="gli-eyebrow">ISSUE DETAILS</span><h3>${original ? 'Edit issue' : 'Add an issue'}</h3><p>Capture the issue and update it as work progresses.</p></div>${btn('cancel-editor', 'Close', '', 'gli-quiet')}</div><form id="gliIssueForm"><div class="gli-form-grid">${E.FIELDS.map(([key, label]) => field(key, label, editor[key], ['title', 'description', 'resolution'].includes(key))).join('')}${editor.extras.map((x, i) => `<label class="gli-field gli-wide"><span>${esc(x.header)} · imported column</span><textarea id="gliExtra-${i}" data-gli-extra="${i}" rows="2" maxlength="32000">${esc(x.value)}</textarea></label>`).join('')}</div><datalist id="gliStatusOptions"><option>Open</option><option>In progress</option><option>Resolved</option><option>Closed</option><option>On hold</option></datalist><datalist id="gliPriorityOptions"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></datalist><div class="gli-actions"><button type="submit" class="gli-button gli-primary">Save issue</button>${btn('cancel-editor', 'Cancel', '', 'gli-quiet')}</div></form></section>`;
    }
    function currentSheet() {
      return book?.sheets[sheetIndex];
    }
    function prepareSheet(index, row = 1) {
      const sheet = book?.sheets[index],
        cols = E.columns(sheet, row);
      sheetIndex = index;
      headerRow = row;
      mapping = E.suggest(cols);
    }
    function importView() {
      if (!importing) return '';
      let preview = '';
      if (book && currentSheet()) {
        const sheet = currentSheet(),
          cols = E.columns(sheet, headerRow),
          count = sheet.rows
            .slice(headerRow)
            .filter(r => r?.some(x => String(x ?? '').trim())).length;
        const columnOptions = selected =>
          option(-1, 'Not mapped', selected) +
          cols.map(c => option(c.index, c.letter + ' · ' + c.label, selected)).join('');
        preview = `<div class="gli-review"><div class="gli-panel-head"><div><span class="gli-eyebrow">REVIEW BEFORE IMPORT</span><h4>${esc(sourceName)}</h4><p>Map the issue fields. Unmapped columns with values are kept as additional details.</p></div><strong>${count.toLocaleString()} issue rows</strong></div><div class="gli-form-grid"><label class="gli-field"><span>Worksheet</span><select id="gliSheet">${book.sheets.map((s, i) => option(i, s.name + (s.state && s.state !== 'visible' ? ' · hidden' : ''), sheetIndex)).join('')}</select></label><label class="gli-field"><span>Header row</span><input id="gliHeaderRow" type="number" min="1" max="${sheet.rows.length}" value="${headerRow}"></label>${E.FIELDS.map(([key, label]) => `<label class="gli-field"><span>${esc(label)}${key === 'title' ? ' *' : ''}</span><select data-gli-map="${key}">${columnOptions(mapping[key])}</select></label>`).join('')}</div><div class="gli-preview-table"><table><thead><tr>${cols
          .slice(0, 6)
          .map(c => `<th>${esc(c.label)}</th>`)
          .join('')}</tr></thead><tbody>${sheet.rows
          .slice(headerRow, headerRow + 3)
          .map(
            row =>
              `<tr>${cols
                .slice(0, 6)
                .map(c => `<td>${esc(row?.[c.index] ?? '')}</td>`)
                .join('')}</tr>`
          )
          .join(
            ''
          )}</tbody></table></div><p class="gli-hint">Preview shows the first ${Math.min(6, cols.length)} columns and 3 rows; all columns will be kept. Empty rows are skipped.</p><div class="gli-actions">${btn('commit-import', 'Add issues to project', busy || !can('edit') ? 'disabled' : '', 'gli-primary')}${btn('discard-source', 'Discard preview', '', 'gli-quiet')}</div></div>`;
      }
      return `<section class="gli-panel gli-import"><div class="gli-panel-head"><div><span class="gli-eyebrow">BRING YOUR ISSUES TOGETHER</span><h3>Import issues</h3><p>Upload an Excel or text file, or paste a list or table.</p></div>${btn('cancel-import', 'Close', '', 'gli-quiet')}</div><div class="gli-import-grid"><div class="gli-import-upload"><span class="gli-upload-symbol" aria-hidden="true">↥</span><strong>Upload a file</strong><p>Excel (.xlsx / .xls), text (.txt), CSV or TSV.</p>${btn('browse', busy ? 'Reading…' : 'Choose file', busy ? 'disabled' : '', 'gli-primary')}<input id="gliFile" type="file" accept=".xlsx,.xls,.txt,.csv,.tsv" hidden></div><div><label class="gli-field"><span>Paste a list or table</span><textarea id="gliPaste" rows="6" placeholder="One issue per line, or paste rows copied from Excel…">${esc(paste)}</textarea></label><label class="gli-field"><span>Paste format</span><select id="gliPasteMode">${option('auto', 'Automatic: tabular paste or one issue per line', pasteMode)}${option('list', 'One issue per line', pasteMode)}${option('table', 'Table with headers (tab or CSV)', pasteMode)}</select></label>${btn('preview-paste', 'Review pasted issues', busy ? 'disabled' : '', 'gli-secondary')}</div></div>${preview}</section>`;
    }
    function issueCard(issue, index) {
      const status = E.category(issue.status),
        extra = issue.extras.length;
      return `<article class="gli-issue" style="--gli-order:${Math.min(index, 8)}"><div class="gli-issue-top"><span class="gli-number">${esc(issue.reference || '#' + String(index + 1).padStart(2, '0'))}</span><div class="gli-tags"><span class="gli-status gli-status-${status}">${esc(issue.status || 'Status not set')}</span>${issue.priority ? `<span class="gli-priority">${esc(issue.priority)}</span>` : ''}</div></div><h3>${esc(issue.title)}</h3>${issue.description ? `<p class="gli-description">${esc(issue.description)}</p>` : ''}<div class="gli-meta"><span>◌ ${esc(issue.owner || 'Owner not set')}</span>${issue.reported ? `<span>◷ ${esc(issue.reported)}</span>` : ''}${extra ? `<span>＋ ${extra} additional detail${extra === 1 ? '' : 's'}</span>` : ''}</div>${issue.resolution ? `<div class="gli-resolution"><strong>Resolution / remarks</strong><p>${esc(issue.resolution)}</p></div>` : ''}${issue.extras.length ? `<details class="gli-extra"><summary>View additional details</summary>${issue.extras.map(x => `<div><strong>${esc(x.header)}</strong><p>${esc(x.value)}</p></div>`).join('')}</details>` : ''}${can('edit') ? `<div class="gli-issue-actions">${btn('edit', 'Edit', `data-id="${esc(issue.id)}"`, 'gli-quiet')}${btn('delete', 'Delete', `data-id="${esc(issue.id)}"`, 'gli-quiet gli-danger')}</div>` : ''}</article>`;
    }
    function render(projectId) {
      sync();
      pid = projectId;
      const all = records(),
        shown = visible(),
        m = E.metrics(all),
        pages = Math.max(1, Math.ceil(shown.length / 20));
      page = Math.min(page, pages - 1);
      return `<section id="gliWorkspace" class="gli-workspace" data-owner="${esc(owner)}" data-project="${esc(pid)}"><header class="gli-hero"><div><span class="gli-eyebrow">PROJECTS / GO-LIVE</span><h2>Every issue, in sight.</h2><p>A clear place to capture, follow and share the issues encountered during Go-Live.</p><div class="gli-actions">${can('edit') ? btn('new', '+ Add issue', '', 'gli-primary') + btn('open-import', '↥ Import issues', '', 'gli-light') : ''}</div></div><div class="gli-hero-mark" aria-hidden="true"><span>✓</span><i></i><b>01</b><b>02</b><b>03</b></div></header><div class="gli-stats"><div><span>ISSUES</span><strong>${m.total}</strong><small>in this project</small></div><div><span>OPEN / PENDING</span><strong>${m.open}</strong><small>needs attention</small></div><div><span>IN PROGRESS</span><strong>${m.progress}</strong><small>being worked on</small></div><div><span>RESOLVED / CLOSED</span><strong>${m.resolved}</strong><small>completed</small></div><div><span>OTHER / BLANK</span><strong>${m.other}</strong><small>other statuses</small></div></div>${notice ? `<div class="gli-notice${problem ? ' is-error' : ''}" role="status">${esc(notice)}</div>` : ''}${editorView()}${importView()}<section class="gli-panel gli-register"><div class="gli-panel-head"><div><span class="gli-eyebrow">THE ISSUE REGISTER</span><h3>Project issues</h3><p>Search or filter your list, then export the issues currently shown.</p></div><div class="gli-actions">${can('export') ? btn('export-pdf', 'PDF', busy ? 'disabled' : '', 'gli-secondary') + btn('export-jpg', 'JPG', busy ? 'disabled' : '', 'gli-secondary') + btn('export-excel', 'Excel', busy ? 'disabled' : '', 'gli-secondary') : ''}</div></div><p class="gli-hint">PDF and JPG are formatted as a report. If the JPG spans multiple pages, the download contains numbered JPG files in a ZIP.</p><div class="gli-toolbar"><label><span class="gli-sr">Search issues</span><input id="gliQuery" type="search" value="${esc(query)}" placeholder="Search issue, owner, status or details…"></label><label><span class="gli-sr">Filter by status</span><select id="gliCategory">${option('all', 'All statuses', category)}${option('open', 'Open / pending', category)}${option('progress', 'In progress', category)}${option('resolved', 'Resolved / closed', category)}${option('other', 'Other or blank', category)}</select></label><strong>${shown.length.toLocaleString()} shown</strong></div><div class="gli-issues">${
        shown
          .slice(page * 20, (page + 1) * 20)
          .map((issue, i) => issueCard(issue, page * 20 + i))
          .join('') ||
        `<div class="gli-empty"><span aria-hidden="true">✳</span><h4>${all.length ? 'No issues match this view' : 'Your register is ready'}</h4><p>${all.length ? 'Try a different search or status.' : 'Add an issue, upload a file, or paste your list to get started.'}</p></div>`
      }</div>${pages > 1 ? `<div class="gli-paging">${btn('previous', '← Previous', page ? '' : 'disabled', 'gli-quiet')}<span>Page ${page + 1} of ${pages}</span>${btn('next', 'Next →', page + 1 < pages ? '' : 'disabled', 'gli-quiet')}</div>` : ''}</section></section>`;
    }
    function newEditor(issue = null) {
      editor = issue
        ? copy(issue)
        : Object.fromEntries([
            ['id', uid()],
            ...E.FIELDS.map(([key]) => [key, '']),
            ['extras', []],
          ]);
      original = issue ? JSON.stringify(issue) : '';
    }
    function saveIssue() {
      guard('edit');
      if (!editor) throw Error('Open an issue first.');
      const current = records().find(x => x.id === editor.id);
      if (original && (!current || JSON.stringify(current) !== original))
        throw Error('This issue changed. Reopen it before saving.');
      const draft = copy(editor),
        id = pid;
      E.validateIssues([draft]);
      if (!original && records().length >= E.LIMITS.issues)
        throw Error('A project can hold up to 2,000 Go-Live issues.');
      const ok = a.mutate(d => {
        const p = d.projects.find(x => x.id === id);
        if (!p) throw Error('Project no longer exists.');
        const issues = p.goLiveIssues || (p.goLiveIssues = []),
          index = issues.findIndex(x => x.id === draft.id);
        if (original && index < 0) throw Error('Issue no longer exists.');
        if (index < 0) issues.push(draft);
        else issues[index] = draft;
      });
      if (ok) {
        editor = null;
        original = '';
        say('Issue saved to this project.');
        refresh();
      }
    }
    async function loadFile(file) {
      guard('edit');
      if (busy) throw Error('Wait for the current operation.');
      if (!file || !/\.(xlsx?|txt|csv|tsv)$/i.test(file.name))
        throw Error('Choose an Excel, text, CSV or TSV file.');
      if (file.size > 50000000) throw Error('Choose a file below 50 MB.');
      const expectedOwner = owner,
        expectedProject = pid,
        token = ++serial;
      controller = new root.AbortController();
      busy = true;
      say('Reading file…');
      refresh();
      try {
        let next;
        if (/\.xlsx?$/i.test(file.name))
          next = /\.xls$/i.test(file.name)
            ? await root.WorkHubValidatorXLS.read(file, { signal: controller.signal })
            : await XF.read(file, { displayValues: true, signal: controller.signal });
        else {
          const text =
            typeof file.text === 'function'
              ? await file.text()
              : new TextDecoder().decode(await file.arrayBuffer());
          next = {
            sheets: [
              E.textSheet(text, /\.(csv|tsv)$/i.test(file.name) ? 'table' : 'auto', file.name),
            ],
          };
        }
        guard('edit', expectedOwner, expectedProject);
        if (token !== serial) return;
        const i = next.sheets.findIndex(s => s.rows?.length && s.state !== 'hidden');
        const selected = i < 0 ? 0 : i;
        E.columns(next.sheets[selected], 1);
        book = next;
        sourceName = file.name;
        importing = true;
        prepareSheet(selected);
        say('Review the columns before adding issues.');
      } finally {
        if (token === serial) {
          busy = false;
          controller = null;
          refresh();
        }
      }
    }
    function pastePreview() {
      guard('edit');
      const sheet = E.textSheet(
        paste,
        pasteMode === 'list' ? 'list' : pasteMode === 'table' ? 'table' : 'auto'
      );
      book = { sheets: [sheet] };
      sourceName = 'Pasted issues';
      prepareSheet(0);
      say('Review the columns before adding issues.');
    }
    function commitImport() {
      guard('edit');
      if (!book || !mapping) throw Error('Review an import first.');
      const result = E.importRows(currentSheet(), headerRow, mapping, uid),
        existing = records().length;
      if (existing + result.records.length > E.LIMITS.issues)
        throw Error('This project can hold up to 2,000 Go-Live issues. Import fewer issues.');
      const id = pid,
        additions = result.records;
      const ok = a.mutate(d => {
        const p = d.projects.find(x => x.id === id);
        if (!p) throw Error('Project no longer exists.');
        (p.goLiveIssues || (p.goLiveIssues = [])).push(...additions);
      });
      if (ok) {
        book = null;
        mapping = null;
        paste = '';
        importing = false;
        page = 0;
        say(
          additions.length.toLocaleString() +
            ' issues added.' +
            (result.emptyRows.length ? ' ' + result.emptyRows.length + ' empty rows skipped.' : '')
        );
        refresh();
      }
    }
    async function exportReport(kind) {
      guard('export');
      if (busy) throw Error('Wait for the current operation.');
      const expectedOwner = owner,
        expectedProject = pid,
        token = ++serial,
        p = project();
      const pack = {
        project: p.name,
        workspace: state().workhub?.preferences?.workspace || 'WorkHub',
        createdAt: new Date().toISOString(),
        issues: copy(visible()),
        scope:
          query || category !== 'all'
            ? [
                'Filtered view · ' + visible().length + ' of ' + records().length + ' issues',
                category !== 'all'
                  ? 'Status: ' +
                    {
                      open: 'Open / pending',
                      progress: 'In progress',
                      resolved: 'Resolved / closed',
                      other: 'Other or blank',
                    }[category]
                  : '',
                query ? 'Search: ' + query : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : 'All project issues',
      };
      busy = true;
      say('Preparing your ' + kind.toUpperCase() + ' report…');
      refresh();
      const alive = () =>
        token === serial &&
        a.ready() &&
        a.owner() === expectedOwner &&
        state().activeProjectId === expectedProject &&
        can('export') &&
        !document.body.classList.contains('hub-private');
      try {
        const result =
          kind === 'excel' ? await F.excel(pack, { alive }) : await F.visual(pack, kind, { alive });
        guard('export', expectedOwner, expectedProject);
        if (!alive()) return;
        a.download(
          result.blob,
          F.fileBase(p.name) +
            '-Go-Live-Issues-' +
            pack.createdAt.slice(0, 10) +
            '.' +
            result.extension,
          result.type,
          'specs'
        );
        say(
          kind === 'jpg' && result.extension === 'zip'
            ? 'JPG report downloaded as a ZIP of numbered pages.'
            : kind.toUpperCase() + ' report downloaded.'
        );
      } finally {
        if (token === serial) {
          busy = false;
          refresh();
        }
      }
    }
    async function handle(el) {
      const action = el.dataset.gli;
      if (action === 'new') {
        guard('edit');
        newEditor();
        importing = false;
      } else if (action === 'edit') {
        guard('edit');
        const item = records().find(x => x.id === el.dataset.id);
        if (!item) throw Error('Issue no longer exists.');
        newEditor(item);
        importing = false;
      } else if (action === 'cancel-editor') {
        editor = null;
        original = '';
      } else if (action === 'open-import') {
        guard('edit');
        importing = true;
        editor = null;
      } else if (action === 'cancel-import') {
        importing = false;
        book = null;
        mapping = null;
      } else if (action === 'browse') {
        guard('edit');
        $('gliFile')?.click();
        return;
      } else if (action === 'preview-paste') pastePreview();
      else if (action === 'discard-source') {
        book = null;
        mapping = null;
      } else if (action === 'commit-import') {
        commitImport();
        return;
      } else if (action === 'previous') page = Math.max(0, page - 1);
      else if (action === 'next') page++;
      else if (action.startsWith('export-')) {
        await exportReport(action.slice(7));
        return;
      } else if (action === 'delete') {
        guard('edit');
        const account = owner,
          id = pid,
          item = records().find(x => x.id === el.dataset.id);
        if (!item) throw Error('Issue no longer exists.');
        if (
          !(await root.WorkHubDialogs.confirm('Delete this Go-Live issue? This cannot be undone.'))
        )
          return;
        guard('edit', account, id);
        const ok = a.mutate(d => {
          const p = d.projects.find(x => x.id === id);
          p.goLiveIssues = (p.goLiveIssues || []).filter(x => x.id !== item.id);
        });
        if (ok) say('Issue deleted.');
      }
      refresh();
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('#gliWorkspace [data-gli]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(fail);
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'gliIssueForm') return;
      event.preventDefault();
      try {
        saveIssue();
      } catch (error) {
        fail(error);
      }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (!el.closest?.('#gliWorkspace')) return;
      if (el.dataset.gliField && editor) editor[el.dataset.gliField] = el.value;
      else if (el.dataset.gliExtra !== undefined && editor)
        editor.extras[Number(el.dataset.gliExtra)].value = el.value;
      else if (el.id === 'gliPaste') paste = el.value;
      else if (el.id === 'gliQuery') {
        query = el.value;
        page = 0;
        refresh();
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (!el.closest?.('#gliWorkspace')) return;
      if (el.id === 'gliFile') {
        const file = el.files?.[0];
        el.value = '';
        if (file) void loadFile(file).catch(fail);
        return;
      }
      try {
        if (el.id === 'gliCategory') {
          category = el.value;
          page = 0;
        } else if (el.id === 'gliPasteMode') pasteMode = el.value;
        else if (el.id === 'gliSheet') prepareSheet(Number(el.value), 1);
        else if (el.id === 'gliHeaderRow') prepareSheet(sheetIndex, Number(el.value));
        else if (el.dataset.gliMap) mapping[el.dataset.gliMap] = Number(el.value);
        else return;
        refresh();
      } catch (error) {
        fail(error);
      }
    });
    root.addEventListener('pagehide', () => controller?.abort());
    return {
      render,
      card,
      sync,
      loadFile,
      handle,
      snapshot: () => ({
        owner,
        pid,
        busy,
        sourceName,
        importing,
        count: records().length,
        notice,
        problem,
      }),
    };
  }
  root.WorkHubGoLiveIssues = Object.freeze({ install });
})(window);
