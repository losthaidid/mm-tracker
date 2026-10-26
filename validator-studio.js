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
  const select = (name, label, rows, value) =>
    '<label class="val-label">' +
    label +
    '<select name="' +
    name +
    '">' +
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
  function install(a) {
    const $ = id => document.getElementById(id),
      store = () => a.state().workhub.validator;
    let owner = '',
      generation = 0,
      draft = null,
      selected = '',
      baseStamp = '',
      dirty = false,
      mode = 'columns',
      columnId = '',
      ruleId = '',
      message = '',
      search = '',
      book = null,
      sheetIndex = 0,
      headerRow = 1,
      headers = [],
      sourceRows = [],
      mapping = {},
      rows = [],
      result = null,
      resultSchema = null,
      version = 'draft',
      runCompanyId = '',
      fileName = '',
      filter = 'all',
      page = 0,
      busy = false,
      refEditing = '',
      targetRow = -1,
      selectedIssue = null,
      setupPreview = null,
      copyPreview = null,
      correction = null,
      liveTimer = null,
      livePending = false,
      liveCheck = null,
      pinnedRows = new Set();
    function cancelLive() {
      root.clearTimeout(liveTimer);
      liveTimer = null;
      livePending = false;
      liveCheck = null;
    }
    function sync() {
      const next = a.owner?.() || '';
      if (next !== owner) {
        cancelLive();
        pinnedRows.clear();
        owner = next;
        generation++;
        draft = null;
        selected = '';
        baseStamp = '';
        dirty = false;
        book = null;
        headers = [];
        sourceRows = [];
        rows = [];
        result = null;
        resultSchema = null;
        selectedIssue = null;
        fileName = '';
        busy = false;
        mode = 'columns';
        runCompanyId = '';
        setupPreview = null;
        correction = null;
        copyPreview = null;
        if ($('valCopyReview')) a.closeModal?.();
        if ($('valCorrectionReview')) a.closeModal?.();
        if ($('valSetupReview')) a.closeModal?.();
      }
      return next;
    }
    function paint() {
      a.render();
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
      busy = false;
      dirty = true;
      result = null;
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
    function clearFile() {
      cancelLive();
      pinnedRows.clear();
      generation++;
      runCompanyId = '';
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
        if (r.assertion.field === oldKey) r.assertion.field = newKey;
        if (r.assertion.otherField === oldKey) r.assertion.otherField = newKey;
        for (const pair of r.assertion.pairs || []) if (pair.field === oldKey) pair.field = newKey;
      }
      draft.uniqueGroups = draft.uniqueGroups.map(g => g.map(k => (k === oldKey ? newKey : k)));
      for (const c of draft.columns) if (c.sapReference === oldKey) c.sapReference = newKey;
    }
    function readClause(el) {
      if (!el) return null;
      const get = k => el.querySelector('[data-clause="' + k + '"]')?.value || '';
      return {
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
        r.assertion = readClause(rf.querySelector('[data-assertion]'));
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
        (op.startsWith('field')
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
        if (!/^(when|assertion|groups|conditions|\d+)$/.test(k))
          throw Error('Invalid condition path.');
        value = value[k];
      }
      return value;
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
            '<div class="val-then"><span class="val-eyebrow">THEN REQUIRE</span>' +
            clause(r.assertion, 'assertion', true) +
            '</div>' +
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
            esc(E.describe(r.assertion, draft)) +
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
        '</div><section class="val-card"><form id="valReferenceForm" data-id="' +
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
      if (sourceRows.length > 5000 || sourceRows.length * headers.length > E.LIMITS.cells)
        throw Error('Use up to 5,000 rows and 200,000 cells.');
      mapping = E.autoMap(headers, activeSchema());
      rows = [];
      result = null;
      resultSchema = null;
      page = 0;
    }
    async function loadFile(file, kind = 'data') {
      ensure();
      commitCurrent();
      if (!draft) throw Error('Create a template first.');
      const token = ++generation,
        account = owner;
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
      commitCurrent();
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
      cancelLive();
      pinnedRows.clear();
      commitCurrent();
      const t = activeSchema();
      E.checkSchema(t);
      const context = E.runContext(a.state(), t, runCompanyId);
      const mapped = E.mapRows(headers, sourceRows, t, mapping);
      if (!mapped.length) throw Error('Upload or paste at least one data row.');
      if (version === 'draft' && !saveDraft(true)) return;
      const token = ++generation,
        account = owner;
      busy = true;
      result = null;
      rows = mapped;
      selectedIssue = null;
      targetRow = -1;
      say('Checking columns, conditions and references…');
      paint();
      await new Promise(resolve => root.setTimeout(resolve, 50));
      if (token !== generation || account !== a.owner?.() || !a.ready()) return;
      try {
        E.runContext(a.state(), t, context.companyId);
        const checked = E.validateRows(t, rows, context);
        if (token !== generation || account !== a.owner?.()) return;
        result = checked;
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
        };
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
      if (!current) return;
      const template = document.createElement('template');
      template.innerHTML = resultsView();
      const next = template.content.firstElementChild;
      if (!next) return;
      const active = document.activeElement,
        selection = active?.matches?.('input[data-cell]')
          ? [active.selectionStart, active.selectionEnd, active.selectionDirection]
          : null,
        scroll = $('valResultsScroll'),
        position = scroll ? [scroll.scrollLeft, scroll.scrollTop] : null;
      const key = node => {
        if (node.nodeType !== 1) return '';
        if (node.id) return 'id:' + node.id;
        const d = node.dataset;
        if (d.cell !== undefined) return 'cell:' + d.cell + ':' + d.field;
        if (d.rowIndex !== undefined) return 'row:' + d.rowIndex;
        if (d.val === 'issue') return 'issue:' + d.issueKey;
        if (d.val) return [d.val, d.index, d.field, d.filter, d.delta].join(':');
        return '';
      };
      const same = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName;
      function patch(current, next) {
        if (current.nodeType !== 1) {
          if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
          return;
        }
        for (const attr of Array.from(current.attributes))
          if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
        for (const attr of Array.from(next.attributes))
          if (current.getAttribute(attr.name) !== attr.value)
            current.setAttribute(attr.name, attr.value);
        if (current.matches('input[data-cell]') && current.value !== next.value)
          current.value = next.value;
        const old = Array.from(current.childNodes),
          used = new Set(),
          keyed = new Map(old.filter(n => key(n)).map(n => [key(n), n]));
        let cursor = current.firstChild;
        for (const child of Array.from(next.childNodes)) {
          const id = key(child);
          let match = id ? keyed.get(id) : old.find(n => !used.has(n) && !key(n) && same(n, child));
          if (!match || !same(match, child)) match = child.cloneNode(true);
          else patch(match, child);
          used.add(match);
          if (cursor !== match) current.insertBefore(match, cursor);
          cursor = match.nextSibling;
        }
        for (const child of old) if (!used.has(child)) child.remove();
      }
      patch(current, next);
      if (position && scroll?.isConnected) {
        scroll.scrollLeft = position[0];
        scroll.scrollTop = position[1];
      }
      if (selection && active.isConnected) {
        if (document.activeElement !== active) active.focus({ preventScroll: true });
        active.setSelectionRange(...selection);
      }
      const status = document.querySelector('.validation-studio .val-message');
      if (status) status.textContent = message;
    }
    function checkEdit() {
      const check = liveCheck;
      if (!check) return;
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
      try {
        const context = E.runContext(a.state(), check.schema, runCompanyId);
        result = E.validateRows(check.schema, rows, context);
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
      } catch (error) {
        result = null;
        resultSchema = null;
        selectedIssue = null;
        message = 'Automatic check could not finish. ' + error.message;
        a.tell?.(message, true);
      }
      cancelLive();
      patchResults();
    }
    function editCell(index, field, value, immediate = false) {
      if (!rows[index] || !activeSchema().columns.some(c => c.key === field)) return;
      const source = Number(mapping[field]);
      if (!Number.isInteger(source) || source < 0)
        throw Error('Map this field before editing its value.');
      if (rows[index][field] === value && !livePending) return;
      rows[index][field] = value;
      sourceRows[index][source] = value;
      root.clearTimeout(liveTimer);
      generation++;
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
      for (const el of document.querySelectorAll('[data-val="report"],[data-val="accepted"]'))
        el.disabled = true;
      const status = $('valLiveStatus');
      if (status) status.textContent = 'Checking your edit…';
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
    function resultsView() {
      if (!rows.length) return '';
      const indices = rows
        .map((r, i) => i)
        .filter(
          i =>
            !result ||
            filter === 'all' ||
            pinnedRows.has(i) ||
            (filter === 'errors' && result.status[i].errors) ||
            (filter === 'warnings' && result.status[i].warnings) ||
            (filter === 'passed' && !result.status[i].errors)
        );
      page = Math.max(0, Math.min(page, Math.ceil(indices.length / 25) - 1));
      const shown = indices.slice(page * 25, page * 25 + 25),
        t = resultSchema || activeSchema(),
        issues = result?.issues || [],
        byCell = new Map();
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
        (result
          ? '<div class="val-metrics"><div class="val-metric passed"><span>Rows without errors</span><strong>' +
            result.passed +
            '<small> / ' +
            result.rows +
            '</small></strong></div><div class="val-metric errors"><span>Errors to correct</span><strong>' +
            result.errors +
            '</strong></div><div class="val-metric warnings"><span>Warnings to review</span><strong>' +
            result.warnings +
            '</strong></div><div class="val-metric"><span>Template used</span><strong class="val-version-text">' +
            (version === 'draft' ? 'Saved draft' : 'Version ' + version) +
            '</strong></div></div>'
          : '<div class="val-inline-note">Your data changed. Run validation again to refresh the results and exports.</div>') +
        '<section id="valResultsCard" class="val-card val-results"><div class="val-panel-title"><div><span class="val-eyebrow">LOOK CLOSER</span><h3>Your data, with the answers beside it</h3></div><div class="val-actions">' +
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
        '</div></div><p class="val-help">Accepted exports exclude rows with errors. Rows with warnings remain included for your review.</p><div class="val-result-toolbar"><div class="val-segments">' +
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
              filter === key ? 'is-active' : ''
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
            '</pre><small>The exact cell is selected below. Edit it, then Run validation again.</small></section>'
          : '') +
        '<div id="valResultsScroll" class="val-table-scroll"><table class="val-grid"><thead><tr><th>Excel row</th><th>Check</th>' +
        t.columns
          .map(c => '<th>' + esc(c.label) + '<code>' + esc(c.key) + '</code></th>')
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
              (headerRow + i + 1) +
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
                    : 'Passed') +
              '</span>' +
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
                    '" maxlength="32000" title="' +
                    esc(found.map(x => x.message).join('\n') || 'Edit this value') +
                    '">' +
                    (found.length &&
                    (c.values ||
                      t.rules.some(
                        r =>
                          r.enabled &&
                          r.assertion.field === c.key &&
                          ['lookup', 'lookupTuple', 'in'].includes(r.assertion.operator)
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
        (result && issues.length
          ? '<section id="valAttention" class="val-card"><div class="val-panel-title"><h3>What needs attention</h3><span class="val-chip">' +
            issues.length +
            ' listed' +
            (result.truncated ? ' · capped at 15,000' : '') +
            '</span></div><div class="val-issue-list">' +
            issues
              .slice(0, 100)
              .map((issue, issueIndex) =>
                btn(
                  'issue',
                  '<span class="val-issue-marker ' +
                    issue.severity +
                    '">' +
                    (issue.severity === 'error' ? '!' : 'i') +
                    '</span><span><strong>' +
                    esc(issue.message) +
                    '</strong><small>Row ' +
                    (headerRow + issue.index + 1) +
                    ' · ' +
                    esc(issue.column) +
                    ' · ' +
                    esc(issue.rule) +
                    '</small><small class="val-issue-value">Value: ' +
                    esc(issue.value || '(blank)') +
                    '</small></span><span>↗</span>',
                  'data-index="' +
                    issue.index +
                    '" data-issue="' +
                    issueIndex +
                    '" data-issue-key="' +
                    esc(JSON.stringify([issue.index, issue.field, issue.ruleId, issue.message])) +
                    '"'
                )
              )
              .join('') +
            '</div>' +
            (issues.length > 100
              ? '<p class="val-help">Showing the first 100 issues here. Export the workbook for all listed issues.</p>'
              : '') +
            '</section>'
          : '') +
        '</div>'
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
        '<div class="val-section-heading"><div><h3>Let’s give your file a check.</h3><p>Choose a version, connect your columns, then correct issues in place.</p></div><div class="val-version-picker">' +
        select('version', 'Validate against', versions, version) +
        '</div></div>' +
        validationScopeView() +
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
        '</h3><p>XLSX, CSV or TSV · Up to 200 columns, 5,000 rows and 200,000 cells total (1,000 rows at 200 columns)</p><div class="val-actions">' +
        btn('browse', fileName ? 'Choose another file' : 'Browse files', '', 'val-primary') +
        btn('download-template', 'Download Excel template', '', 'val-secondary') +
        '</div><div class="val-upload-foot">' +
        btn('sample', 'Try example data', '', 'val-quiet') +
        (book ? btn('clear-file', 'Clear file', '', 'val-quiet') : '') +
        '</div></section><details class="val-card val-paste"><summary>Or paste a table</summary><form id="valPasteForm">' +
        area(
          'data',
          'CSV or tab-separated data',
          '',
          'rows="6" placeholder="Include the header row" required'
        ) +
        '<button type="submit" class="val-btn val-secondary">Use pasted data</button></form><p class="val-help">Values only. Excel formulas must be pasted as values before upload.</p></details></div>' +
        (book ? mappingView() : '') +
        resultsView()
      );
    }
    function validationScopeView() {
      const t = activeSchema();
      if (!t.projectId)
        return '<p class="val-help">Standalone template · all enabled conditions apply.</p>';
      const companies = a
          .state()
          .projectCompanies.filter(c => c.projectId === t.projectId && c.active !== false),
        applicable = t.rules.filter(r => E.ruleApplies(r, { companyId: runCompanyId })).length,
        scoped = t.rules.filter(r => r.enabled && r.companyScope === 'selected').length;
      return (
        '<section class="val-card val-run-scope"><div><span class="val-eyebrow">PROJECT &amp; COMPANY</span><h3>' +
        esc(projectName(t)) +
        '</h3><p class="val-help">One company per file. Shared column checks and conditions always apply; company-specific conditions use your choice below.</p></div>' +
        select(
          'validationCompany',
          'Company for this validation',
          [['', 'Choose a company…'], ...companies.map(c => [c.id, c.name])],
          runCompanyId
        ) +
        '<p class="val-help">' +
        (runCompanyId && companies.some(c => c.id === runCompanyId)
          ? applicable + ' enabled condition(s) apply to this company.'
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
              ' warnings</small></div></article>'
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
        '<section class="validation-studio"><header class="val-heading"><div class="val-brand"><span class="val-brand-mark">' +
        icon('leaf', 29) +
        '</span><div><span class="val-eyebrow">YOUR WORKHUB TOOLKIT</span><h1>Validation Studio</h1></div></div><div class="val-heading-note"><span class="val-dot"></span> A calmer way to check your data</div></header><div class="val-shell">' +
        library() +
        '<main class="val-main">' +
        (draft
          ? header() +
            (message
              ? '<div class="val-message" role="status" aria-live="polite">' +
                esc(message) +
                '</div>'
              : '') +
            (
              { columns: columnEditor, rules: rulesEditor, references, check: checkView, history }[
                mode
              ] || columnEditor
            )()
          : empty()) +
        '</main></div><input id="valFile" type="file" accept=".xlsx,.csv,.tsv" hidden><input id="valSetupFile" type="file" accept=".xlsx" hidden><input id="valDefinitionFile" type="file" accept=".json" hidden><input id="valReferenceFile" type="file" accept=".xlsx,.csv,.tsv" hidden></section>'
      );
    }
    async function handle(el) {
      ensure();
      const action = el.dataset.val,
        id = el.dataset.id;
      message = '';
      if (action === 'setup-help') {
        a.openModal(
          'Fill your setup in 3 steps',
          `<section class="val-setup-guide"><p>Use <strong>simple General setup</strong> for everyday files, or <strong>simple SAP setup</strong> for DDIC field formats. Each file has just one <strong>Setup</strong> sheet.</p><ol><li><strong>Name it.</strong> Fill the name in B2 and choose General or SAP in B3.</li><li><strong>Replace the examples from row 9.</strong> One row creates one upload column. Keep the row 8 headers. Delete example rows you do not need. You can define up to 200 fields.</li><li><strong>Import and review.</strong> Choose Import Excel setup → your file → Create new draft → Save draft. Then use Validate to upload the records you want to check.</li></ol><div class="val-setup-table"><table><thead><tr><th>Fill this</th><th>What to enter</th></tr></thead><tbody><tr><td>Field</td><td>A unique key, e.g. VENDOR_CODE. Use letters and underscores; no spaces.</td></tr><tr><td>Label</td><td>Your data upload header, e.g. Vendor code. Optional: defaults to Field.</td></tr><tr><td>Data type</td><td>Choose from the dropdown. General: text, integer, decimal, date or boolean. SAP: choose the actual DDIC type.</td></tr><tr><td>Length / Decimals</td><td>General: Length is an optional maximum character count; leave Decimals blank. SAP: use SE11/DDIC length and decimal places, or leave blank for the displayed type defaults.</td></tr><tr><td>Required / Allowed values</td><td>Required defaults to No. Use X in Allowed values and Required = No to allow X or blank. A trailing comma is unnecessary.</td></tr><tr><td>Format / Reference field</td><td>Optional. General formats: digits, alphanumeric, email, url or identifier. SAP format is automatic; CURR can point to a CUKY field and QUAN to a UNIT field using its Field key.</td></tr><tr><td>Notes</td><td>Optional instructions for the person uploading data.</td></tr></tbody></table></div><p>Keep codes and long numbers as Excel <strong>Text</strong>. Enter values, not formulas. You can add Conditions and References inside Studio after import; the advanced workbook is only needed to maintain them in Excel.</p><p class="hint">Data uploads support 5,000 rows and 200,000 cells: at 200 columns, upload up to 1,000 rows per file. SAP mode checks the supported DDIC field formats; maintain your system's domain values and conversion rules separately.</p></section>`
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
            draft.columns.some(f => f.sapReference === c.key);
        if (used)
          throw Error(
            'This field is used in a condition, unique combination or SAP currency/unit reference. Update those first.'
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
        if (!issue) throw Error('Run validation again before opening this issue.');
        selectedIssue = E.copy(issue);
        targetRow = issue.index;
        filter = 'all';
        page = Math.floor(targetRow / 25);
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
      if (action === 'report' || action === 'accepted') {
        if (!result || !resultSchema || livePending)
          throw Error('Wait for validation to finish before exporting.');
        const outcome = E.copy(result);
        outcome.issues.forEach(i => (i.row = headerRow + i.index + 1));
        a.download(
          await F.report(resultSchema, rows, outcome, action === 'accepted'),
          safeName(
            resultSchema.name +
              (result.context?.companyName ? '-' + result.context.companyName : '')
          ) + (action === 'accepted' ? '-accepted.xlsx' : '-issues.xlsx'),
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
        '<fieldset class="val-company-scope"><legend>Conditions to copy</legend><div class="val-check-list">' +
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
          ? '<fieldset class="val-company-scope"><legend>Destination companies</legend><div class="val-check-list">' +
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
        activeSchema(),
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
      if (form.id === 'valCopyForm') {
        applyCopy(form);
        return;
      }
      if (form.id === 'valPasteForm') {
        commitCurrent();
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
        form.id === 'valRuleForm'
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
        say(error.message, true);
      });
    });
    document.addEventListener('submit', event => {
      if (!event.target.id.startsWith('val')) return;
      event.preventDefault();
      try {
        formSubmit(event.target);
      } catch (error) {
        say(error.message, true);
      }
    });
    document.addEventListener('input', event => {
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
      if (event.target.closest?.('#valColumnForm,#valRuleForm,#valMetaForm')) mark();
    });
    document.addEventListener('change', event => {
      const el = event.target;
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
        if (el.name === 'companyScope' && el.form?.id === 'valRuleForm') {
          commitCurrent();
          mark();
          paint();
          return;
        }
        if (el.name === 'validationCompany') {
          cancelLive();
          pinnedRows.clear();
          runCompanyId = el.value;
          generation++;
          busy = false;
          result = null;
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
        if (el.id === 'valFile') {
          if (el.files[0]) await loadFile(el.files[0]);
          return;
        }
        if (el.id === 'valSetupFile') {
          const file = el.files[0];
          el.value = '';
          if (file) await loadSetupFile(file);
          return;
        }
        if (el.id === 'valReferenceFile') {
          if (el.files[0]) await loadFile(el.files[0], 'reference');
          return;
        }
        if (el.id === 'valDefinitionFile') {
          const file = el.files[0];
          if (!file) return;
          if (file.size > 1000000) throw Error('Template definitions must be below 1 MB.');
          const account = owner,
            token = ++generation,
            value = JSON.parse(await file.text());
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
        if (el.id === 'valSearch') {
          search = el.value;
          paint();
          return;
        }
        if (el.name === 'version') {
          cancelLive();
          pinnedRows.clear();
          generation++;
          busy = false;
          version = el.value;
          runCompanyId = '';
          if (book) getDataFromSheet();
          result = null;
          rows = [];
          paint();
          return;
        }
        if (el.name === 'sheet' || el.name === 'headerRow') {
          cancelLive();
          pinnedRows.clear();
          generation++;
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
          busy = false;
          mapping[el.dataset.map] = Number(el.value);
          rows = [];
          result = null;
          paint();
          return;
        }
        if (el.dataset.cell !== undefined) {
          editCell(Number(el.dataset.cell), el.dataset.field, el.value, true);
          return;
        }
        if (el.dataset.clause === 'operator' || el.dataset.clause === 'lookupId') {
          commitCurrent();
          mark();
          paint();
        }
      })().catch(error => {
        busy = false;
        say(error.message, true);
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
        if (drop && event.dataTransfer?.files[0]) {
          void loadFile(event.dataTransfer.files[0]).catch(err => say(err.message, true));
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
      sync,
      handle,
      loadFile,
      loadSetupFile,
      openCorrections,
      applyCorrection,
      run,
      saveDraft,
      publish,
      addLibraryField,
      referenceDetails,
      snapshot: () => ({
        draft: E.copy(draft),
        dirty,
        mode,
        rows: E.copy(rows),
        result: E.copy(result),
        mapping: { ...mapping },
        runCompanyId,
        livePending,
        owner,
      }),
      loadSample,
    };
  }
  root.WorkHubValidatorStudio = { install };
})(window);
