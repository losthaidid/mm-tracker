/** Private, in-memory JSON & IDoc workspace. Mounted editors survive unrelated application saves. */
(function (root) {
  'use strict';
  const E = root.WorkHubDataReaderEngine,
    F = root.WorkHubDataReaderFiles;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (action, text, attrs = '', cls = '') =>
    `<button type="button" class="dr-button ${cls}" data-dr="${action}" ${attrs}>${text}</button>`;
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      doc = null,
      draft = '',
      name = '',
      title = '',
      error = '',
      tab = 'report',
      selected = '',
      scope = '',
      scopeGroup = false,
      group = false,
      rootIndex = 0,
      query = '',
      hideEmpty = false,
      friendly = true,
      page = 0,
      treeLimit = 100,
      revision = 0,
      busy = false,
      searchTimer = 0;
    let aliases = Object.create(null),
      excluded = new Set(),
      expanded = new Set(),
      parents = new Map(),
      rootIds = new Set(),
      originalBytes = null,
      activeExport = null,
      columnPage = 0,
      prepared = null,
      customTitle = false;
    const mounted = new WeakSet(),
      allowed = () => a.ready() && !!a.owner();
    function clearDownload() {
      if (prepared) root.URL.revokeObjectURL(prepared.url);
      prepared = null;
      $('drPreparedDownload')?.remove();
    }
    function changed() {
      revision++;
      clearDownload();
    }
    function reset() {
      changed();
      root.clearTimeout(searchTimer);
      doc = null;
      draft = name = title = error = query = selected = scope = '';
      aliases = Object.create(null);
      excluded = new Set();
      expanded = new Set();
      parents = new Map();
      rootIds = new Set();
      originalBytes = null;
      activeExport = null;
      rootIndex = page = columnPage = 0;
      treeLimit = 100;
      busy = hideEmpty = group = scopeGroup = false;
      friendly = true;
      customTitle = false;
      tab = 'report';
    }
    function sync() {
      const next = allowed() ? a.owner() : '';
      if (next !== owner) {
        reset();
        owner = next;
        const node = $('dataReader');
        if (node) {
          node.innerHTML = '';
          node.dataset.owner = '';
        }
      }
      return !!owner;
    }
    function guard() {
      if (!sync()) throw Error('Sign in to use the reader.');
    }
    function options() {
      return { hideEmpty, friendly, aliases };
    }
    function currentRoot() {
      return doc?.roots[rootIndex];
    }
    function current() {
      return doc?.byId.get(selected) || currentRoot();
    }
    function rootSet() {
      rootIds = new Set();
      const walk = n => {
        rootIds.add(n.id);
        for (const c of n.children) walk(c);
      };
      if (currentRoot()) walk(currentRoot());
    }
    function records(n, asGroup) {
      if (!asGroup) return n.type === 'array' ? n.children : [n];
      const p = doc.byId.get(parents.get(n.id));
      return p ? p.children.filter(c => c.key === n.key) : [n];
    }
    function sourceSummary() {
      return doc
        ? `${doc.kind === 'idoc' ? 'IDoc XML' : 'JSON'} · ${doc.fields.toLocaleString()} values · ${doc.name}`
        : 'JSON or IDoc XML · Up to 2 MB';
    }
    function formatLabel(n) {
      return friendly ? E.label(E.local(n), aliases) : n.key;
    }
    function sectionList() {
      if (!doc) return [];
      let start = doc.byId.get(scope) || currentRoot();
      if (scopeGroup) {
        const p = doc.byId.get(parents.get(start.id));
        if (p) start = { ...p, children: records(start, true) };
      }
      const sections = E.sections(start, options());
      if (scope === currentRoot().id && !scopeGroup) {
        let rows = [
          ['Source file', doc.name],
          ['Format', doc.kind === 'idoc' ? 'IDoc XML' : 'JSON'],
          ['Values in file', String(doc.fields)],
        ];
        if (doc.kind === 'idoc') {
          const i = E.idocInfo(currentRoot());
          rows.push(
            ...[
              ['IDoc number', i.number],
              ['IDoc type', i.type],
              ['Message type', i.message],
              ['Sender partner', i.sender],
              ['Receiver partner', i.receiver],
              ['Technical status code', i.status],
              ['Exported status text', i.statusText],
              [
                'Created · source time',
                [E.date(i.date) || i.date, E.time(i.time) || i.time].filter(Boolean).join(' · '),
              ],
            ].filter(r => r[1])
          );
        }
        sections.unshift({
          id: currentRoot().id + '-overview',
          title: 'Document overview',
          source: currentRoot().path,
          columns: ['Field', 'Value'],
          rows,
        });
      }
      return sections;
    }
    function report() {
      const sections = sectionList().filter(s => !excluded.has(s.id));
      if (!sections.length)
        throw Error(
          'Select at least one report section. Empty containers have no field rows to export.'
        );
      return {
        title: title.trim() || 'Readable data report',
        kind: doc.kind,
        subtitle: sourceSummary(),
        sections,
      };
    }
    function shell() {
      guard();
      return `<section id="dataReader" class="dr-workspace" data-owner="${esc(owner)}" aria-label="JSON and IDoc reader">
        <header class="dr-hero"><div><span class="dr-eyebrow">A CLEARER VIEW OF YOUR DATA</span><h2>Data, made readable.</h2><p>Open the structure. Follow the details. Create a report worth sharing.</p><span class="dr-privacy">◈ Browser memory only</span></div><div class="dr-art" aria-hidden="true"><i></i><i></i><div><span>{ }</span><b></b><b></b><b></b><em>✦</em></div></div></header>
        <div class="dr-import"><div class="dr-import-actions">${button('browse', '↥ Open JSON / IDoc', '', 'dr-primary')}${button('sample-json', 'Try JSON example')}${button('sample-idoc', 'Try IDoc example')}${button('clear', 'Clear reader')}</div><input id="drFile" type="file" accept=".json,.xml,.idoc,.txt,application/json,application/xml,text/xml" hidden><details id="drComposer"${doc ? '' : ' open'}><summary>Paste content or change the file</summary><form id="drPaste"><label for="drSource">JSON or IDoc XML</label><textarea id="drSource" name="source" spellcheck="false" placeholder="Paste JSON or an XML IDoc here…">${esc(draft)}</textarea><div class="dr-import-actions"><button class="dr-button dr-primary" type="submit">Read content</button><span>Content is cleared when you leave this account or reload.</span></div></form></details></div>
        <p id="drStatus" role="status" class="dr-status" aria-live="polite">${esc(error || sourceSummary())}</p>
        <div id="drTools" class="dr-tools"${doc ? '' : ' hidden'}><div class="dr-view-tabs" role="group" aria-label="Reader view">${[
          ['report', 'Report'],
          ['explore', 'Explore'],
          ['raw', 'Original source'],
        ]
          .map(([id, text]) => button('tab', text, `data-tab="${id}" aria-pressed="${tab === id}"`))
          .join(
            ''
          )}</div><div class="dr-export-actions">${button('xlsx', '↓ Excel')}${button('csv', '↓ CSV')}${button('pdf', '↓ PDF', '', 'dr-primary')}${button('original', '↓ Original')}</div></div>
        <details id="drOptions" class="dr-options"${doc ? '' : ' hidden'}><summary>Report options &amp; field labels</summary><div class="dr-options-grid"><div><label for="drTitle">Report title</label><input id="drTitle" maxlength="120" value="${esc(title)}"><label class="dr-check"><input id="drHideEmpty" type="checkbox"${hideEmpty ? ' checked' : ''}> Hide empty fields</label><label class="dr-check"><input id="drFriendly" type="checkbox"${friendly ? ' checked' : ''}> Friendly field labels</label><p>Exports include your selected report sections. Search filters the on-screen explorer.</p></div><form id="drAliasForm"><label for="drAliasKey">Original field name</label><input id="drAliasKey" maxlength="200" placeholder="e.g. ZCUSTOM_FIELD" required><label for="drAliasValue">Display label</label><input id="drAliasValue" maxlength="100" placeholder="Your readable label" required><button class="dr-button" type="submit">Apply label</button><p>Labels apply to this open file. Codes and values keep their original meaning.</p></form><div><strong>Include report sections</strong><div id="drSectionOptions" class="dr-section-options"></div></div></div></details>
        <div id="drEmpty" class="dr-empty"${doc ? ' hidden' : ''}><span aria-hidden="true">{ ✧ }</span><h3>Every structure has a story.</h3><p>Open a file or try an example. Objects become sections, repeated records become tables, and the original values stay close at hand.</p><p>XML IDocs are detected dynamically. Fixed-width IDoc text requires a segment definition and is not decoded here.</p></div>
        <div id="drGrid" class="dr-reader-grid"${doc ? '' : ' hidden'}><aside class="dr-navigation" aria-label="Document navigation"><label for="drDocument">Document</label><select id="drDocument"></select><label for="drSearch">Find a field or value</label><input id="drSearch" type="search" maxlength="200" value="${esc(query)}" placeholder="Search this document…"><div id="drTree" class="dr-tree"></div></aside><div id="drContent" class="dr-content" tabindex="-1"></div></div>
      </section>`;
    }
    function mount() {
      if (!sync()) return;
      const el = $('dataReader');
      if (!el || mounted.has(el)) return;
      mounted.add(el);
      paint(true);
    }
    function patchRender() {
      return sync() && $('dataReader')?.dataset.owner === owner;
    }
    function notice(text, problem = false) {
      error = problem ? text : '';
      const status = $('drStatus');
      if (status) {
        status.textContent = text;
        status.classList.toggle('dr-error', problem);
        if (
          !problem &&
          prepared &&
          prepared.revision === revision &&
          prepared.owner === a.owner()
        ) {
          const link = document.createElement('a');
          link.id = 'drPreparedDownload';
          link.href = prepared.url;
          link.download = prepared.name;
          link.textContent =
            'Download ' +
            prepared.kind.toUpperCase() +
            (prepared.kind === 'original' ? ' source' : ' report');
          status.append(document.createTextNode(' '), link);
        }
      }
    }
    function tree() {
      const items = [];
      let total = 0;
      function walk(n, depth) {
        if (!rootIds.has(n.id)) return;
        const match =
          !query ||
          [n.key, n.path, n.children.length ? '' : n.value].some(v =>
            v.toLocaleLowerCase().includes(query.toLocaleLowerCase())
          );
        if (match) {
          total++;
          if (items.length < treeLimit) items.push({ n, depth });
        }
        if (query || expanded.has(n.id)) for (const child of n.children) walk(child, depth + 1);
      }
      walk(currentRoot(), 0);
      return (
        `<p class="dr-tree-count">${query ? total + ' matches' : 'Structure'}${doc.duplicates ? ' · ' + doc.duplicates + ' duplicate JSON keys retained' : ''}</p>` +
        items
          .map(
            ({ n, depth }) =>
              `<div class="dr-tree-row" style="--dr-depth:${Math.min(depth, 6)}">${n.children.length ? button('expand', expanded.has(n.id) ? '−' : '+', `data-id="${n.id}" aria-label="${expanded.has(n.id) ? 'Collapse' : 'Expand'} ${esc(n.key)}" aria-expanded="${expanded.has(n.id)}"`) : '<span class="dr-tree-dot">·</span>'}${button('select', `<span>${esc(n.key)}</span><small>${n.children.length ? esc(n.type) + ' · ' + n.children.length : esc(n.type)}</small>`, `data-id="${n.id}" title="${esc(n.path)}" aria-current="${selected === n.id ? 'true' : 'false'}"`, 'dr-tree-select')}</div>`
          )
          .join('') +
        (total > items.length
          ? button('more-tree', 'Show more · ' + (total - items.length) + ' remaining')
          : '') +
        (query && !total ? '<p>No matching field or value in this document.</p>' : '')
      );
    }
    function overview() {
      if (doc.kind === 'json')
        return `<div class="dr-report-intro"><span class="dr-eyebrow">JSON REPORT</span><h2 data-report-title>${esc(title)}</h2><p>${esc(doc.name)} · ${doc.fields} values · Numbers and identifiers retain their original text.</p>${doc.duplicates ? '<p class="dr-note">Duplicate JSON keys are retained as separate occurrences.</p>' : ''}</div>`;
      const info = E.idocInfo(currentRoot());
      return `<div class="dr-report-intro"><span class="dr-eyebrow">IDOC REPORT · DOCUMENT ${rootIndex + 1} OF ${doc.roots.length}</span><h2 data-report-title>${esc(title)}</h2><p>${esc(info.type || doc.wrapper)}${info.message ? ' · ' + esc(info.message) : ''}</p></div><div class="dr-summary-cards">${[
        ['IDoc number', info.number || 'Not supplied'],
        ['Technical status', info.status || 'Not supplied'],
        [
          'Sender → receiver',
          (info.sender || 'Not supplied') + ' → ' + (info.receiver || 'Not supplied'),
        ],
        [
          'Created · source time',
          [E.date(info.date) || info.date, E.time(info.time) || info.time]
            .filter(Boolean)
            .join(' · ') || 'Not supplied',
        ],
      ]
        .map(
          ([key, value]) =>
            `<article><span>${esc(key)}</span><strong>${esc(value)}</strong></article>`
        )
        .join(
          ''
        )}</div>${info.statusText ? '<p class="dr-note">Exported status text: ' + esc(info.statusText) + '</p>' : ''}<p class="dr-context">Custom segment statuses appear in their own sections. The supplied codes and messages are shown as exported. Source timestamps have no assumed time zone.</p>${timeline(info.statuses)}`;
    }
    function timeline(statuses) {
      if (!statuses.length) return '';
      return `<details class="dr-history" open><summary>Exported status history · ${statuses.length}</summary><ol>${statuses
        .slice(0, 50)
        .map(
          n =>
            `<li><b>${esc(E.field(n, 'STATUS') || '—')}</b><div><span>${esc(E.field(n, 'STATXT') || 'Status entry')}</span><small>${esc([E.date(E.field(n, 'LOGDAT')) || E.field(n, 'LOGDAT'), E.time(E.field(n, 'LOGTIM')) || E.field(n, 'LOGTIM')].filter(Boolean).join(' · '))}</small></div>${button('select', 'Inspect', `data-id="${n.id}"`)}</li>`
        )
        .join(
          ''
        )}</ol>${statuses.length > 50 ? '<p>First 50 entries shown here. All exported entries remain in the report tables and explorer.</p>' : ''}</details>`;
    }
    function reportView() {
      try {
        const all = sectionList(),
          visible = all.filter(s => !excluded.has(s.id));
        return (
          overview() +
          `<div class="dr-scope">Report scope: <code>${esc((doc.byId.get(scope) || currentRoot()).path)}</code>${scope !== currentRoot().id || scopeGroup ? button('reset-scope', 'Use whole document') : ''}</div>` +
          visible
            .map(
              s =>
                `<section class="dr-report-section"><header><div><span class="dr-eyebrow">${s.rows.length} ${s.columns[0] === 'Field' ? 'FIELDS' : 'RECORDS'}</span><h3>${esc(s.title)}</h3><code>${esc(s.source)}</code></div>${button('inspect-section', 'Explore', `data-id="${s.id}"`)}</header><div class="dr-table-scroll"><table><thead><tr>${s.columns
                  .slice(0, 8)
                  .map(c => `<th scope="col">${esc(c)}</th>`)
                  .join('')}</tr></thead><tbody>${s.rows
                  .slice(0, 8)
                  .map(
                    row =>
                      `<tr>${row
                        .slice(0, 8)
                        .map(
                          v =>
                            `<td>${esc(E.visibleText(v)) || '<span class="dr-empty-value">Empty</span>'}</td>`
                        )
                        .join('')}</tr>`
                  )
                  .join(
                    ''
                  )}</tbody></table></div>${s.rows.length > 8 || s.columns.length > 8 ? '<p class="dr-context">Preview: ' + Math.min(8, s.rows.length) + ' of ' + s.rows.length + ' rows, ' + Math.min(8, s.columns.length) + ' of ' + s.columns.length + ' columns. Explore to browse all values; exports include the complete selected section.</p>' : ''}</section>`
            )
            .join('') +
          (!visible.length
            ? '<div class="dr-empty"><h3>No report sections selected</h3><p>Choose sections in Report options.</p></div>'
            : '')
        );
      } catch (err) {
        return `<div class="dr-empty"><h3>Choose a smaller report scope</h3><p>${esc(err.message)}</p>${button('tab', 'Open Explore', 'data-tab="explore"', 'dr-primary')}</div>`;
      }
    }
    function valueCell(n) {
      if (!n) return '<span class="dr-empty-value">Not present</span>';
      const hint = E.hint(n),
        value = E.scalar(n);
      return `<span class="dr-value">${esc(E.visibleText(value)) || '<span class="dr-empty-value">Empty</span>'}</span>${hint ? '<small class="dr-date-hint">' + esc(hint) + '</small>' : ''}${n.children.length || ['object', 'array', 'segment'].includes(n.type) ? button('select', 'Open', `data-id="${n.id}"`) : button('copy', 'Copy', `data-id="${n.id}" aria-label="Copy ${esc(n.key)}"`, 'dr-copy')}`;
    }
    function explorer() {
      const n = current(),
        rows = records(n, group),
        t = E.table(rows, hideEmpty),
        asTable = group || n.type === 'array';
      columnPage = Math.min(columnPage, Math.max(0, Math.ceil(t.columns.length / 25) - 1));
      const columns = t.columns.slice(columnPage * 25, (columnPage + 1) * 25);
      const searchMatch = c =>
        !query ||
        [c.key, c.path, E.scalar(c)].some(v =>
          v.toLocaleLowerCase().includes(query.toLocaleLowerCase())
        );
      let content;
      if (asTable) {
        const filtered = t.rows.filter(
            r => !query || Array.from(r.cells.values()).some(searchMatch)
          ),
          last = Math.max(0, Math.ceil(filtered.length / 30) - 1);
        page = Math.min(page, last);
        content = `<p class="dr-context">${filtered.length} of ${t.rows.length} records · ${t.columns.length} fields. “Not present” and an empty value are distinct.</p>${t.columns.length > 25 ? `<div class="dr-pagination">${button('columns', '← Fields', `data-delta="-1"${columnPage === 0 ? ' disabled' : ''}`)}<span>Fields ${columnPage * 25 + 1}–${Math.min((columnPage + 1) * 25, t.columns.length)} of ${t.columns.length}</span>${button('columns', 'Fields →', `data-delta="1"${(columnPage + 1) * 25 >= t.columns.length ? ' disabled' : ''}`)}</div>` : ''}<div class="dr-table-scroll"><table><thead><tr><th scope="col">Record</th>${columns.map(c => `<th scope="col">${esc(friendly ? E.label(c.original, aliases) : c.title)}${friendly ? '<small>' + esc(c.title) + '</small>' : ''}</th>`).join('')}</tr></thead><tbody>${filtered
          .slice(page * 30, (page + 1) * 30)
          .map(
            r =>
              `<tr><td>${button('select', String(rows.indexOf(r.record) + 1), `data-id="${r.record.id}" aria-label="Open record ${rows.indexOf(r.record) + 1}"`)}</td>${columns.map(c => `<td>${valueCell(r.cells.get(c.key))}</td>`).join('')}</tr>`
          )
          .join(
            ''
          )}</tbody></table></div><div class="dr-pagination">${button('page', '← Previous', `data-delta="-1"${page === 0 ? ' disabled' : ''}`)}<span>Page ${page + 1} of ${last + 1}</span>${button('page', 'Next →', `data-delta="1"${page === last ? ' disabled' : ''}`)}</div>`;
      } else {
        const leaves = (n.children.length ? n.children : [n]).filter(
            c =>
              !c.children.length &&
              !['object', 'array', 'segment'].includes(c.type) &&
              (!hideEmpty || !E.blank(c)) &&
              searchMatch(c)
          ),
          last = Math.max(0, Math.ceil(leaves.length / 50) - 1);
        page = Math.min(page, last);
        content = `<div class="dr-table-scroll"><table><thead><tr><th scope="col">Field</th><th scope="col">Original value</th><th scope="col">Type</th></tr></thead><tbody>${leaves
          .slice(page * 50, (page + 1) * 50)
          .map(
            c =>
              `<tr><th scope="row">${esc(formatLabel(c))}<small>${esc(c.key)}</small></th><td>${valueCell(c)}</td><td>${esc(c.type)}</td></tr>`
          )
          .join(
            ''
          )}</tbody></table></div>${leaves.length > 50 ? `<div class="dr-pagination">${button('page', '← Previous', `data-delta="-1"${page === 0 ? ' disabled' : ''}`)}<span>Page ${page + 1} of ${last + 1}</span>${button('page', 'Next →', `data-delta="1"${page === last ? ' disabled' : ''}`)}</div>` : ''}<div class="dr-child-groups">${E.groups(
          n
        )
          .slice(0, 100)
          .map(
            g =>
              `<article><div><strong>${esc(friendly ? E.label(E.local(g.records[0]), aliases) : g.key)}</strong><small>${esc(g.key)} · ${g.records.length} ${g.records.length === 1 ? 'section' : 'records'}</small></div>${button(g.records.length > 1 ? 'group' : 'select', g.records.length > 1 ? 'View table' : 'Open', `data-id="${g.records[0].id}"`)}</article>`
          )
          .join(
            ''
          )}</div>${E.groups(n).length > 100 ? '<p>Use search or the navigation tree to reach additional sections.</p>' : ''}${!n.children.length && ['object', 'array', 'segment'].includes(n.type) ? '<p>This is an empty ' + esc(n.type) + '.</p>' : ''}`;
      }
      return `<header class="dr-explore-heading"><span class="dr-eyebrow">${group ? 'REPEATED RECORDS' : esc(n.type.toUpperCase())}</span><h2>${esc(formatLabel(n))}</h2><code>${esc(n.path)}</code><div class="dr-import-actions">${button('scope', 'Report this section')}${parents.has(n.id) ? button('parent', '↑ Parent section', 'data-id="' + parents.get(n.id) + '"') : ''}</div></header>${n.attrs.length ? '<details class="dr-attributes"><summary>XML attributes</summary><dl>' + n.attrs.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl></details>' : ''}${content}`;
    }
    function paint(full = false) {
      const el = $('dataReader');
      if (!el || el.dataset.owner !== owner) return;
      el.classList.toggle('dr-loaded', !!doc);
      for (const id of ['drTools', 'drOptions', 'drGrid']) $(id).hidden = !doc;
      $('drEmpty').hidden = !!doc;
      for (const b of el.querySelectorAll(
        '[data-dr="xlsx"],[data-dr="csv"],[data-dr="pdf"],[data-dr="original"]'
      ))
        b.disabled = busy;
      if (full) {
        $('drSource').value = draft;
        $('drSearch').value = query;
        $('drAliasKey').value = '';
        $('drAliasValue').value = '';
        $('drTitle').value = title;
        $('drHideEmpty').checked = hideEmpty;
        $('drFriendly').checked = friendly;
      }
      if (!doc) {
        for (const id of ['drTree', 'drContent', 'drSectionOptions', 'drDocument'])
          $(id).replaceChildren();
        notice(error || sourceSummary(), !!error);
        return;
      }
      $('drDocument').innerHTML = doc.roots
        .map(
          (n, i) =>
            `<option value="${i}"${i === rootIndex ? ' selected' : ''}>${doc.kind === 'idoc' ? 'IDoc ' + (i + 1) + ' · ' + esc(E.idocInfo(n).number || E.idocInfo(n).type || 'Document') : 'JSON document'}</option>`
        )
        .join('');
      const old = $('drTree').scrollTop,
        active = document.activeElement?.closest?.('[data-dr="select"],[data-dr="expand"]'),
        action = active?.dataset.dr,
        activeId = active?.dataset.id;
      $('drTree').innerHTML = tree();
      $('drTree').scrollTop = old;
      if (activeId)
        $('drTree')
          .querySelector(`[data-dr="${action}"][data-id="${activeId}"]`)
          ?.focus({ preventScroll: true });
      for (const b of el.querySelectorAll('[data-dr="tab"]'))
        b.setAttribute('aria-pressed', String(tab === b.dataset.tab));
      $('drContent').innerHTML =
        tab === 'raw'
          ? `<header><span class="dr-eyebrow">ORIGINAL SOURCE</span><h2>Your file, intact.</h2><p>${esc(doc.name)} · Original text, including whitespace and CDATA.</p></header><textarea class="dr-raw" aria-label="Original source" readonly spellcheck="false">${esc(doc.source)}</textarea>`
          : tab === 'explore'
            ? explorer()
            : reportView();
      let sections = [];
      try {
        sections = sectionList();
      } catch {}
      $('drSectionOptions').innerHTML =
        sections
          .map(
            s =>
              `<label class="dr-check"><input type="checkbox" data-section="${s.id}"${excluded.has(s.id) ? '' : ' checked'}><span>${esc(s.title)} <small>· ${s.rows.length} rows</small></span></label>`
          )
          .join('') || '<p>Choose a smaller section in Explore to create a report.</p>';
      notice(error || sourceSummary(), !!error);
    }
    async function openText(text, filename = '', bytes = null) {
      guard();
      clearDownload();
      const token = ++revision,
        account = owner;
      activeExport = null;
      busy = true;
      error = '';
      doc = null;
      originalBytes = null;
      draft = text;
      name = filename;
      paint(true);
      notice('Reading the structure…');
      await new Promise(resolve => root.setTimeout(resolve, 30));
      if (token !== revision || !allowed() || a.owner() !== account) return;
      try {
        const next = E.parse(text, filename);
        if (token !== revision || a.owner() !== account || !allowed()) return;
        doc = next;
        originalBytes = bytes;
        rootIndex = 0;
        selected = scope = doc.roots[0].id;
        scopeGroup = group = false;
        tab = 'report';
        query = '';
        page = columnPage = 0;
        treeLimit = 100;
        aliases = Object.create(null);
        excluded = new Set();
        parents = new Map();
        for (const n of doc.nodes) for (const c of n.children) parents.set(c.id, n.id);
        expanded = new Set([selected]);
        rootSet();
        title =
          doc.kind === 'idoc'
            ? (E.idocInfo(currentRoot()).type || doc.wrapper) + ' · IDoc report'
            : doc.name.replace(/\.[^.]+$/, '') + ' · Data report';
        customTitle = false;
        $('drComposer')?.removeAttribute('open');
      } catch (err) {
        error = err.message;
        doc = null;
      } finally {
        if (token === revision && a.owner() === account) {
          busy = false;
          paint(true);
        }
      }
    }
    async function loadFile(file) {
      guard();
      if (!file) return;
      if (file.size > E.LIMITS.bytes) throw Error('Open files up to 2 MB.');
      clearDownload();
      const token = ++revision,
        account = owner;
      activeExport = null;
      busy = true;
      error = '';
      doc = null;
      draft = '';
      originalBytes = null;
      paint(true);
      notice('Reading ' + file.name + '…');
      try {
        const bytes = await file.arrayBuffer();
        if (token !== revision || a.owner() !== account || !allowed()) return;
        const data = new Uint8Array(bytes);
        let encoding =
          data[0] === 255 && data[1] === 254
            ? 'utf-16le'
            : data[0] === 254 && data[1] === 255
              ? 'utf-16be'
              : 'utf-8';
        const header = new TextDecoder('utf-8').decode(data.slice(0, 256)),
          declared = /^\s*<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(header)?.[1];
        if (declared) encoding = declared;
        let text;
        try {
          text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
        } catch {
          throw Error('The file encoding could not be read. Export it as UTF-8 XML or JSON.');
        }
        await openText(text, file.name, bytes);
      } catch (err) {
        if (token === revision && a.owner() === account && allowed()) {
          error = err.message;
          notice(error, true);
        }
      } finally {
        if (token === revision && a.owner() === account) {
          busy = false;
          paint();
        }
      }
    }
    function filename(extension) {
      return (
        (title || 'Data report').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 100) +
        '.' +
        extension
      );
    }
    async function exportFile(kind) {
      guard();
      if (!doc) throw Error('Open a file first.');
      if (busy) throw Error('Wait for the current read or export to finish.');
      clearDownload();
      const token = revision,
        account = owner,
        opened = doc,
        job = {};
      activeExport = job;
      const alive = () =>
        activeExport === job &&
        token === revision &&
        allowed() &&
        a.owner() === account &&
        doc === opened;
      busy = true;
      paint();
      notice('Preparing your ' + kind.toUpperCase() + ' export…');
      try {
        let blob, downloadName, type;
        if (kind === 'original') {
          type = doc.kind === 'json' ? 'application/json' : 'application/xml';
          blob = originalBytes || doc.source;
          downloadName = doc.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
        } else {
          const model = report();
          if (kind === 'xlsx') {
            blob = await root.WorkHubValidatorFiles.workbook(F.worksheets(model.sections));
            type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (kind === 'csv') {
            const rows = [['Section', 'Source path', 'Record', 'Field', 'Value']];
            let estimatedSize = 0;
            for (const s of model.sections)
              for (const [i, row] of s.rows.entries())
                for (const [j, value] of row.entries()) {
                  estimatedSize +=
                    (s.title.length +
                      s.source.length +
                      s.columns[j].length +
                      String(value).length +
                      64) *
                    4;
                  if (estimatedSize > 20 * 1024 * 1024)
                    throw Error(
                      'The CSV expands beyond 20 MB. Choose fewer sections or download the original source.'
                    );
                  rows.push([s.title, s.source, String(i + 1), s.columns[j], value]);
                }
            blob = E.csv(rows);
            type = 'text/csv;charset=utf-8';
          } else {
            blob = await F.pdf(model, alive);
            type = 'application/pdf';
          }
          downloadName = filename(kind);
        }
        if (!alive()) return;
        prepared = {
          url: root.URL.createObjectURL(
            blob instanceof root.Blob ? blob : new root.Blob([blob], { type })
          ),
          name: downloadName,
          kind,
          revision,
          owner: account,
        };
        try {
          a.download(blob, downloadName, type);
        } catch {
          /* The visible link supports browsers requiring a fresh download gesture. */
        }
        notice(
          kind === 'csv'
            ? 'CSV downloaded. Use Excel export to preserve leading zeros as text.'
            : 'Your ' + kind.toUpperCase() + ' download is ready.'
        );
      } catch (err) {
        if (alive()) notice(err.message, true);
      } finally {
        if (activeExport === job) {
          activeExport = null;
          busy = false;
          if (a.owner() === account && doc === opened) {
            for (const b of $('dataReader')?.querySelectorAll(
              '[data-dr="xlsx"],[data-dr="csv"],[data-dr="pdf"],[data-dr="original"]'
            ) || [])
              b.disabled = false;
            if (token !== revision)
              notice('The report changed. Export again to use the latest options.');
          }
        }
      }
    }
    function choose(id, asGroup = false) {
      if (!rootIds.has(id)) return;
      selected = id;
      group = asGroup;
      page = columnPage = 0;
      tab = 'explore';
      const n = current();
      if (n.children.length) expanded.add(id);
      for (let p = parents.get(id); p; p = parents.get(p)) expanded.add(p);
      paint();
    }
    async function handle(el) {
      guard();
      const op = el.dataset.dr;
      if (op === 'browse') {
        $('drFile').click();
        return;
      }
      if (op === 'sample-json' || op === 'sample-idoc') {
        const kind = op === 'sample-json' ? 'json' : 'idoc';
        await openText(E.sample(kind), 'Example.' + (kind === 'json' ? 'json' : 'xml'));
        return;
      }
      if (op === 'clear') {
        reset();
        paint(true);
        $('drComposer').open = true;
        notice('Reader cleared. Open another file whenever you are ready.');
        return;
      }
      if (!doc) return;
      if (['xlsx', 'csv', 'pdf', 'original'].includes(op)) {
        await exportFile(op);
        return;
      }
      if (op === 'tab') {
        tab = el.dataset.tab;
        paint();
        return;
      }
      if (op === 'select' || op === 'parent' || op === 'group') {
        choose(el.dataset.id, op === 'group');
        return;
      }
      if (op === 'expand') {
        const id = el.dataset.id;
        if (!rootIds.has(id)) return;
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        paint();
        return;
      }
      if (op === 'more-tree') {
        treeLimit += 100;
        paint();
        return;
      }
      if (op === 'page') {
        page = Math.max(0, page + Number(el.dataset.delta));
        paint();
        return;
      }
      if (op === 'columns') {
        columnPage = Math.max(0, columnPage + Number(el.dataset.delta));
        paint();
        return;
      }
      if (op === 'inspect-section') {
        choose(
          el.dataset.id.replace(/-(?:rows|overview)$/, ''),
          el.dataset.id.endsWith('-rows') &&
            doc.byId.get(el.dataset.id.replace(/-rows$/, ''))?.type !== 'array'
        );
        return;
      }
      if (op === 'scope' || op === 'reset-scope') {
        scope = op === 'scope' ? selected : currentRoot().id;
        scopeGroup = op === 'scope' && group;
        excluded.clear();
        changed();
        tab = 'report';
        paint();
        return;
      }
      if (op === 'copy') {
        const n = doc.byId.get(el.dataset.id);
        if (!n || !rootIds.has(n.id)) return;
        const token = revision,
          account = owner;
        await root.navigator.clipboard.writeText(n.value);
        if (token === revision && account === a.owner()) notice('Original value copied.');
      }
    }
    document.addEventListener('click', event => {
      if (
        event.target.closest?.('#drPreparedDownload') &&
        (!allowed() || prepared?.owner !== a.owner() || prepared?.revision !== revision)
      ) {
        event.preventDefault();
        sync();
        clearDownload();
        return;
      }
      const el = event.target.closest?.('#dataReader [data-dr]');
      if (el) {
        event.preventDefault();
        void handle(el).catch(err => notice(err.message, true));
      }
    });
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!form.closest?.('#dataReader')) return;
      if (form.id === 'drPaste') {
        event.preventDefault();
        void openText($('drSource').value).catch(err => notice(err.message, true));
      }
      if (form.id === 'drAliasForm') {
        event.preventDefault();
        try {
          guard();
          if (!doc) return;
          aliases[$('drAliasKey').value.trim()] = $('drAliasValue').value.trim();
          changed();
          paint();
        } catch (err) {
          notice(err.message, true);
        }
      }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (!el.closest?.('#dataReader')) return;
      try {
        guard();
        if (el.id === 'drSource') draft = el.value;
        if (el.id === 'drTitle') {
          title = el.value;
          customTitle = true;
          changed();
          for (const h of $('drContent').querySelectorAll('[data-report-title]'))
            h.textContent = title;
        }
        if (el.id === 'drSearch') {
          query = el.value;
          page = 0;
          treeLimit = 100;
          root.clearTimeout(searchTimer);
          const token = revision,
            account = owner;
          searchTimer = root.setTimeout(() => {
            if (token === revision && account === a.owner() && allowed()) paint();
          }, 150);
        }
      } catch (err) {
        notice(err.message, true);
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (!el.closest?.('#dataReader')) return;
      try {
        guard();
        if (el.id === 'drFile') {
          const file = el.files[0];
          el.value = '';
          void loadFile(file).catch(err => {
            busy = false;
            notice(err.message, true);
          });
          return;
        }
        if (!doc) return;
        if (el.id === 'drDocument') {
          const index = Number(el.value);
          if (!Number.isInteger(index) || !doc.roots[index]) return;
          rootIndex = index;
          selected = scope = currentRoot().id;
          scopeGroup = group = false;
          page = 0;
          query = '';
          $('drSearch').value = '';
          excluded.clear();
          expanded = new Set([selected]);
          if (!customTitle) {
            title = (E.idocInfo(currentRoot()).type || doc.wrapper) + ' · IDoc report';
            $('drTitle').value = title;
          }
          changed();
          rootSet();
        }
        if (el.id === 'drHideEmpty') {
          hideEmpty = el.checked;
          changed();
        }
        if (el.id === 'drFriendly') {
          friendly = el.checked;
          changed();
        }
        if (el.dataset.section) {
          if (el.checked) excluded.delete(el.dataset.section);
          else excluded.add(el.dataset.section);
          changed();
        }
        paint();
      } catch (err) {
        notice(err.message, true);
      }
    });
    document.addEventListener('dragover', event => {
      if (event.target.closest?.('#dataReader')) {
        event.preventDefault();
        $('dataReader').classList.add('dr-dragging');
      }
    });
    document.addEventListener('dragleave', event => {
      if (event.target.id === 'dataReader') event.target.classList.remove('dr-dragging');
    });
    document.addEventListener('drop', event => {
      if (!event.target.closest?.('#dataReader')) return;
      event.preventDefault();
      $('dataReader').classList.remove('dr-dragging');
      const file = event.dataTransfer?.files[0];
      if (file) void loadFile(file).catch(err => notice(err.message, true));
    });
    root.addEventListener('pagehide', () => {
      reset();
      const el = $('dataReader');
      if (el) el.innerHTML = '';
    });
    root.addEventListener('pageshow', event => {
      if (event.persisted && $('dataReader')) a.render();
    });
    return {
      render: shell,
      mount,
      sync,
      patchRender,
      openText,
      loadFile,
      exportFile,
      report,
      handle,
      snapshot: () => ({
        owner,
        kind: doc?.kind || '',
        roots: doc?.roots.length || 0,
        nodes: doc?.nodes.length || 0,
        selected,
        scope,
        tab,
        busy,
        error,
        source: doc?.source || '',
        title,
      }),
    };
  }
  root.WorkHubDataReader = { install };
})(window);
