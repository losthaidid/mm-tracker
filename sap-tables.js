/** SAP Tables inside Studio. The built-in catalogue is local and opens no SAP sessions. */
(function (root) {
  'use strict';

  const D = root.WorkHubSapTablesData;
  const E = root.WorkHubSapTablesEngine;
  const feature = 'studio.tables';
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]
    );
  const button = (op, label, attrs = '', type = 'small') =>
    `<button type="button" class="${type}" data-sap-table="${op}" ${attrs}>${label}</button>`;
  const options = (items, selected, empty = '') =>
    (empty ? `<option value="">${esc(empty)}</option>` : '') +
    items
      .map(
        ([value, label]) =>
          `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`
      )
      .join('');
  const systemLabels = { ecc: 'ECC', s4: 'S/4HANA', public: 'Public Edition' };
  const attributes = code => `data-code="${esc(code)}"`;
  const clickable = table =>
    button('open', esc(table.code), attributes(table.code), 'sap-table-link');
  const shortScope = table =>
    table.systems.map(system =>
      system === 's4' && table.compatibility ? 'S/4HANA compatibility' : systemLabels[system]
    );
  const kindLabel = table => (table.kind === 'cds' ? 'CDS view' : 'Table');
  const activeFilters = () => ({
    query: '',
    system: '',
    module: '',
    workflow: '',
    favorites: false,
    custom: false,
    archived: false,
  });

  function install(a) {
    let owner = '';
    let generation;
    let filters = activeFilters();
    let editor = null;
    let trail = [];
    const $ = id => document.getElementById(id);
    const allowed = (action = 'view') => a.ready() && a.active() && a.can(feature, action);
    const state = () => a.state();
    const tableByCode = code => E.editableRow(state(), code);
    const contextMatches = () => owner === a.owner() && generation === a.generation();

    function sync() {
      const nextOwner = a.ready() ? a.owner() : '';
      const epoch = a.generation();
      if (nextOwner !== owner || epoch !== generation) {
        owner = nextOwner;
        generation = epoch;
        filters = activeFilters();
        trail = [];
      }
      const room = $('sapTableDetail');
      const form = $('sapTableEditor');
      if (
        (room || form) &&
        $('modal')?.open &&
        (!allowed() ||
          (room || form).dataset.owner !== owner ||
          (room || form).dataset.generation !== String(generation) ||
          (form && !allowed(form.dataset.id || form.dataset.standard ? 'edit' : 'create')))
      ) {
        a.closeModal();
        editor = null;
      }
    }

    function guard(action = 'view') {
      if (!contextMatches() || !allowed(action))
        throw Error('Reopen SAP Tables with an account that has access to this action.');
    }

    function render() {
      sync();
      if (!allowed()) return '';
      const modules = [...new Set(E.catalogue(state()).map(table => table.module))];
      const moduleChoices = modules
        .sort()
        .map(code => [code, D.modules[code] ? code + ' · ' + D.modules[code] : code]);
      return `<section id="sapTablesRoot" class="tcodes-workspace sap-tables" data-access-feature="${feature}">
        <div class="tcodes-hero">
          <div><h2>SAP Tables</h2><p>Look up SAP tables and CDS views, then follow the fields that connect them.</p></div>
          ${allowed('create') ? button('add', '＋ Add custom table', '', 'primary') : ''}
        </div>
        <div class="tcodes-tools sap-table-tools">
          <label>Search tables<input id="sapTableSearch" type="search" value="${esc(filters.query)}" placeholder="EKPO, GR/IR, storage location, or a field"></label>
          <label>System<select data-sap-table-filter="system">${options(Object.entries(D.systems), filters.system, 'All systems')}</select></label>
          <label>Module<select data-sap-table-filter="module">${options(moduleChoices, filters.module, 'All modules')}</select></label>
        </div>
        <div class="sap-table-refiners">
          <label>Process<select data-sap-table-filter="workflow">${options(
            Object.entries(D.workflows).map(([key, flow]) => [key, flow.label]),
            filters.workflow,
            'All processes'
          )}</select></label>
          <div class="sap-table-checks">${[
            ['favorites', 'Favourites'],
            ['custom', 'Custom'],
            ['archived', 'Archived'],
          ]
            .map(
              ([key, label]) =>
                `<label class="check-label"><input type="checkbox" data-sap-table-filter="${key}"${filters[key] ? ' checked' : ''}>${label}</label>`
            )
            .join('')}</div>
          ${button('clear', 'Clear filters')}
        </div>
        <p class="sap-table-count" id="sapTableCount" role="status"></p>
        <div id="sapTableResults"></div>
      </section>`;
    }

    function card(table) {
      const attrs = attributes(table.code);
      return `<article class="tcode-card sap-table-card">
        <div class="tcode-card-head">${clickable(table)}
          ${
            allowed('edit')
              ? button(
                  'favorite',
                  table.favorite ? '★' : '☆',
                  `${attrs} aria-label="Favourite ${esc(table.code)}" aria-pressed="${table.favorite}"`
                )
              : ''
          }
        </div>
        <h4>${esc(table.title)}</h4>
        <div class="tcode-tags">
          ${[
            table.module,
            kindLabel(table),
            ...shortScope(table),
            ...(table.standard ? [] : ['Custom']),
          ]
            .map(label => `<span>${esc(label)}</span>`)
            .join('')}
        </div>
        <p class="tcode-notes">${esc(table.description || table.notes || 'Personal reference')}</p>
        <div class="actions">
          ${button('open', 'View fields & links', attrs)}
          ${table.archived ? '<span class="hub-badge">Archived</span>' : ''}
        </div>
      </article>`;
    }

    function paintResults() {
      const holder = $('sapTableResults');
      if (!holder) return;
      const rows = E.query(state(), filters);
      const groups = new Map();
      for (const row of rows) {
        if (!groups.has(row.group)) groups.set(row.group, []);
        groups.get(row.group).push(row);
      }
      $('sapTableCount').textContent = rows.length + (rows.length === 1 ? ' entry' : ' entries');
      const flow = Object.hasOwn(D.workflows, filters.workflow)
        ? D.workflows[filters.workflow]
        : null;
      const scope =
        filters.system === 'public'
          ? `<p class="sap-table-context">For SAP-delivered objects in Public Edition, check the released CDS views, supported capabilities and authorisations in <a href="${D.sources.viewBrowser[1]}" target="_blank" rel="noopener noreferrer">View Browser ↗</a>. Custom entries show the scope you assign.</p>`
          : '';
      holder.innerHTML =
        scope +
        (flow ? `<p class="sap-table-context">${esc(flow.detail)}</p>` : '') +
        [...groups]
          .map(
            ([group, entries]) =>
              `<section class="tcodes-group"><div class="tcodes-group-heading"><h3>${esc(group)}</h3><span>${entries.length}</span></div><div class="tcodes-grid">${entries.map(card).join('')}</div></section>`
          )
          .join('') +
        (rows.length
          ? ''
          : `<div class="tcodes-empty"><h3>No matching entries</h3>${button('clear', 'Clear filters')}</div>`);
    }

    function sourceLink(id) {
      const [title, url] = D.sources[id];
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`;
    }

    function related(table) {
      const links = E.linksFor(state(), table);
      const narrowed = filters.system
        ? links.filter(link => link.systems.includes(filters.system))
        : links;
      // A related entry may sit outside the list filter. Its cards should still explain its own links.
      const visible = narrowed.length && table.systems.includes(filters.system) ? narrowed : links;
      if (!visible.length)
        return '<p class="hub-meta">No relationships are documented for this entry.</p>';
      const other =
        Object.hasOwn(D.systems, filters.system) && table.systems.includes(filters.system)
          ? links.length - visible.length
          : 0;
      return `<ul class="sap-table-relations">${visible
        .map(link => {
          const target = tableByCode(link.code);
          const scope = link.systems.length
            ? link.systems.map(system => systemLabels[system]).join(' · ')
            : 'Check system availability';
          return `<li>
          <div class="sap-table-relation-head">
            ${target ? clickable(target) : `<code>${esc(link.code)}</code>`}
            <span>${esc(target?.module || '')}${target?.archived ? ' · Archived' : ''}</span>
          </div>
          <strong>${esc(link.title)}</strong>
          <p class="sap-table-direction"><code>${esc(link.from)}</code> → <code>${esc(link.to)}</code></p>
          ${link.fields ? `<p class="sap-table-field-map">${esc(link.fields)}</p>` : ''}
          ${link.note ? `<p>${esc(link.note)}</p>` : ''}
          <footer><small>${esc(scope)}</small>${link.source ? sourceLink(link.source) : ''}</footer>
        </li>`;
        })
        .join(
          ''
        )}</ul>${other ? '<p class="hub-meta">Select All systems to see relationships for other editions.</p>' : ''}`;
    }

    function detail(code) {
      guard();
      const table = tableByCode(code);
      if (!table) throw Error('This table is no longer in the catalogue.');
      const attrs = attributes(table.code);
      const alternative = table.alternative && tableByCode(table.alternative);
      const previous = trail.at(-1);
      const sources = table.standard
        ? table.sources.map(id => `<li>${sourceLink(id)}</li>`).join('')
        : table.sourceUrl
          ? `<li><a href="${esc(table.sourceUrl)}" target="_blank" rel="noopener noreferrer">Personal reference ↗</a></li>`
          : '';
      a.openModal(
        table.code,
        `<article id="sapTableDetail" class="sap-table-detail" data-access-feature="${feature}" data-code="${esc(table.code)}" data-owner="${esc(owner)}" data-generation="${esc(generation)}">
        <div class="sap-table-detail-summary">
          ${previous ? button('back', '← ' + esc(previous), attributes(previous)) : ''}
          <div class="tcode-tags">${[table.module, kindLabel(table), ...shortScope(table), ...(table.archived ? ['Archived'] : [])].map(label => `<span>${esc(label)}</span>`).join('')}</div>
          <h3>${esc(table.title)}</h3>
          ${table.description ? `<p>${esc(table.description)}</p>` : ''}
          ${table.systemLabel ? `<p><strong>System or landscape</strong> ${esc(table.systemLabel)}</p>` : ''}
          ${table.compatibility ? '<p class="sap-table-context">In S/4HANA, read this object through the legacy compatibility model. Check MATDOC or a material document CDS view for S/4HANA reporting.</p>' : ''}
          ${alternative ? `<p class="sap-table-alternative"><strong>CDS view to check</strong> ${clickable(alternative)}</p>` : ''}
          <div class="actions">
            ${a.can(feature, 'export') ? button('copy', 'Copy name', attrs) : ''}
            ${
              allowed('edit')
                ? [
                    button('edit', table.standard ? 'Edit my notes' : 'Edit custom table', attrs),
                    button(
                      'favorite',
                      table.favorite ? 'Remove from favourites' : 'Favourite',
                      `${attrs} aria-pressed="${table.favorite}"`
                    ),
                    button('archive', table.archived ? 'Restore' : 'Archive', attrs),
                  ].join('')
                : ''
            }
          </div>
        </div>
        ${table.fields.length ? `<section><h4>Fields to check</h4><div class="sap-table-fields">${table.fields.map(field => `<code>${esc(field)}</code>`).join('')}</div></section>` : ''}
        ${table.notes ? `<section><h4>My notes</h4><p class="tcode-notes">${esc(table.notes)}</p></section>` : ''}
        <section><h4>Table relationships</h4>${related(table)}</section>
        ${sources ? `<section><h4>Sources</h4><ul class="sap-table-sources">${sources}</ul>${table.standard ? `<p class="hub-meta">Reviewed ${esc(D.checkedAt)}.</p>` : ''}</section>` : ''}
        <div class="modal-actions"><button type="button" data-action="cancel">Close</button></div>
      </article>`
      );
      editor = null;
      $('sapTableDetail').tabIndex = -1;
      $('sapTableDetail').focus({ preventScroll: true });
      const body = $('modalBody');
      if (body) body.scrollTop = 0;
      $('modal').scrollTop = 0;
    }

    const field = (
      name,
      label,
      value = '',
      { type = 'text', max = 160, required = false, hint = '' } = {}
    ) =>
      `<label>${esc(label)}${
        type === 'textarea'
          ? `<textarea name="${name}" rows="3" maxlength="${max}">${esc(value)}</textarea>`
          : `<input name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}"${required ? ' required' : ''}>`
      }${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;

    function relationRow(link = {}) {
      return `<div class="sap-table-editor-link">
        ${field('relatedCode', 'Related table or view', link.code, { max: 60, hint: 'Enter its SAP technical name.' })}
        ${field('relatedFields', 'Fields to match', link.fields, { max: 180, hint: 'For example, EBELN + EBELP.' })}
        ${field('relatedNote', 'When to use this link', link.note, { max: 300 })}
        ${button('remove-link', 'Remove link')}
      </div>`;
    }

    function openEditor(code = '') {
      guard(code ? 'edit' : 'create');
      const existing = code ? tableByCode(code) : null;
      if (code && !existing) throw Error('This table is no longer in the catalogue.');
      const row = existing || {
        code: '',
        title: '',
        module: 'MM',
        group: 'Custom tables',
        kind: 'table',
        systems: [],
        fields: [],
        description: '',
        notes: '',
        links: [],
      };
      const notes = field('notes', 'My notes', row.notes, { type: 'textarea', max: 4000 });
      const details = row.standard
        ? `<p class="hub-meta">${esc(row.code)} · ${esc(row.title)}</p>${notes}`
        : `<div class="tcodes-editor-grid">
            ${field('code', 'Technical name', row.code, { max: 60, required: true, hint: 'For example, ZMM_PO_AUDIT or /ACME/PO_TRACE.' })}
            ${field('title', 'Title', row.title, { required: true })}
            ${field('module', 'SAP module', row.module, { max: 40, required: true, hint: 'For example, MM, FI, SD or your own area.' })}
            ${field('group', 'Group', row.group, { max: 80, required: true })}
            <label>Object type<select name="kind">${options(
              [
                ['table', 'Table'],
                ['cds', 'CDS view'],
              ],
              row.kind
            )}</select></label>
            ${field('systemLabel', 'System or landscape (optional)', row.systemLabel, { max: 100, hint: 'For example, ECC PRD or S/4HANA 2023 QA.' })}
          </div>
          <fieldset class="sap-table-editor-systems"><legend>Available in</legend>
            ${Object.entries(D.systems)
              .map(
                ([value, label]) =>
                  `<label class="check-label"><input type="checkbox" name="system" value="${value}"${row.systems.includes(value) ? ' checked' : ''}>${esc(label)}</label>`
              )
              .join('')}
          </fieldset>
          ${field('description', 'Purpose', row.description, { type: 'textarea', max: 1200 })}
          ${field('fields', 'Fields to check', row.fields.join(', '), { max: 1700, hint: 'Separate technical field names with commas.' })}
          <fieldset class="sap-table-editor-links"><legend>Related tables and views</legend>
            <div data-sap-table-links>${row.links.map(relationRow).join('')}</div>
            ${button('add-link', '＋ Add related table')}
          </fieldset>
          ${notes}
          ${field('sourceUrl', 'Reference URL (optional)', row.sourceUrl, { type: 'url', max: 2000 })}`;
      a.openModal(
        row.standard ? 'Edit my table notes' : existing ? 'Edit custom table' : 'Add custom table',
        `<form id="sapTableEditor" data-access-feature="${feature}" data-owner="${esc(owner)}" data-generation="${esc(generation)}" data-id="${esc(existing?.id || (existing?.standard ? existing.code : ''))}" data-standard="${row.standard ? 'yes' : ''}">
        ${details}
        <div class="modal-actions">
          <button type="button" data-action="cancel">Cancel</button>
          <button class="primary" type="submit">${row.standard ? 'Save notes' : 'Save table'}</button>
        </div>
      </form>`
      );
      editor = { form: $('sapTableEditor'), existing };
      editor.form.elements.namedItem(row.standard ? 'notes' : 'code').focus();
    }

    function save(form) {
      const old = editor?.existing;
      guard(old ? 'edit' : 'create');
      if (
        form !== editor?.form ||
        !$('modal').open ||
        !form.isConnected ||
        form.dataset.owner !== owner ||
        form.dataset.generation !== String(generation)
      )
        throw Error('Reopen the SAP table editor.');
      if (old && JSON.stringify(old) !== JSON.stringify(tableByCode(old.code)))
        throw Error(
          'This entry changed while the editor was open. Reopen it to edit the latest version.'
        );
      const entries = new FormData(form);
      const value = name => String(entries.get(name) || '').trim();
      const notes = value('notes');
      let code = old?.code;
      let ok;
      if (old?.standard) {
        ok = a.mutate(d => E.updateAnnotation(d, old, { notes }));
      } else {
        code = value('kind') === 'cds' ? value('code') : E.key(value('code'));
        const links = [...form.querySelectorAll('.sap-table-editor-link')]
          .map(row => ({
            code: row.querySelector('[name="relatedCode"]').value.trim(),
            fields: row.querySelector('[name="relatedFields"]').value.trim(),
            note: row.querySelector('[name="relatedNote"]').value.trim(),
          }))
          .filter(link => link.code || link.fields || link.note);
        const record = {
          id: old?.id || root.crypto.randomUUID(),
          code,
          title: value('title'),
          kind: value('kind'),
          module: value('module').toUpperCase(),
          group: value('group'),
          systemLabel: value('systemLabel'),
          systems: entries.getAll('system'),
          description: value('description'),
          fields: [
            ...new Set(
              value('fields')
                .split(/[,\s]+/)
                .filter(Boolean)
            ),
          ],
          links,
          notes,
          sourceUrl: value('sourceUrl'),
          favorite: old?.favorite || false,
          archived: old?.archived || false,
        };
        ok = a.mutate(d => E.saveCustom(d, record, old?.code));
      }
      if (ok) {
        detail(code);
        a.tell(old?.standard ? 'SAP table notes saved.' : 'Custom SAP table saved.');
      }
    }

    document.addEventListener('input', event => {
      if (event.target.id !== 'sapTableSearch' || !allowed()) return;
      filters.query = event.target.value;
      paintResults();
    });
    document.addEventListener('change', event => {
      const key = event.target.dataset.sapTableFilter;
      if (!key || !Object.hasOwn(filters, key) || !allowed()) return;
      filters[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      paintResults();
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'sapTableEditor') return;
      event.preventDefault();
      try {
        save(event.target);
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('click', async event => {
      const control = event.target.closest?.('[data-sap-table]');
      if (!control) return;
      const op = control.dataset.sapTable;
      const code = control.dataset.code;
      try {
        guard();
        if (op === 'clear') {
          filters = activeFilters();
          a.render();
          $('sapTableSearch')?.focus();
        } else if (op === 'open') {
          const source = control.closest('#sapTableDetail');
          if (source) trail.push(source.dataset.code);
          else trail = [];
          detail(code);
        } else if (op === 'back') {
          trail.pop();
          detail(code);
        } else if (op === 'add' || op === 'edit') {
          if (!code) trail = [];
          openEditor(code);
        } else if (op === 'add-link' || op === 'remove-link') {
          const form = control.closest('form');
          if (form !== editor?.form) return;
          guard(editor.existing ? 'edit' : 'create');
          if (op === 'add-link') {
            const host = form.querySelector('[data-sap-table-links]');
            if (host.childElementCount >= 16)
              throw Error('An entry supports up to 16 relationships.');
            host.insertAdjacentHTML('beforeend', relationRow());
            host.lastElementChild.querySelector('input').focus();
          } else {
            control.closest('.sap-table-editor-link').remove();
            form.querySelector('[data-sap-table="add-link"]').focus();
          }
        } else if (op === 'copy') {
          guard('export');
          const table = tableByCode(code);
          if (!table) return;
          const identity = [owner, generation];
          try {
            await root.navigator.clipboard.writeText(table.code);
            if (identity[0] === a.owner() && identity[1] === a.generation())
              a.tell('SAP object name copied.');
          } catch {
            if (identity[0] === a.owner() && identity[1] === a.generation())
              a.tell('Clipboard unavailable. Select and copy the name from the card.', true);
          }
        } else if (op === 'favorite' || op === 'archive') {
          guard('edit');
          const table = tableByCode(code);
          if (!table) throw Error('This table is no longer in the catalogue.');
          const flag = op === 'favorite' ? 'favorite' : 'archived';
          const fromDetail = !!control.closest('#sapTableDetail');
          if (a.mutate(d => E.updateAnnotation(d, table, { [flag]: !table[flag] }))) {
            if (fromDetail) detail(code);
            else {
              const next = [
                ...$('sapTablesRoot').querySelectorAll('[data-sap-table="favorite"]'),
              ].find(button => button.dataset.code === code);
              (next || $('sapTableSearch'))?.focus({ preventScroll: true });
            }
            if (op === 'archive')
              a.tell(table.archived ? 'SAP table restored.' : 'SAP table archived.');
          }
        }
      } catch (error) {
        a.tell(error.message, true);
      }
    });

    return {
      render,
      mount() {
        sync();
        if (allowed()) paintResults();
      },
    };
  }

  root.WorkHubSapTables = { install };
})(window);
