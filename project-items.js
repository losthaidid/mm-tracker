/** Project cards/table, bounded child lists and reviewed bulk edits. Uses the core save path. */
(function (root) {
  'use strict';
  const E = root.WorkHubProjectItemsEngine;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (action, text, attrs = '', cls = '') =>
    `<button type="button" class="${cls}" data-pi="${action}" ${attrs}>${text}</button>`;
  const choices = (values, value) =>
    values
      .map(v => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${v === '' ? 'No priority' : esc(v)}</option>`)
      .join('');
  const empty = value => esc(value) || '<span class="pi-empty">—</span>';
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      projectId = '',
      selected = new Set(),
      expanded = new Set(),
      childLimits = new Map(),
      rows = [],
      pageRows = [],
      page = 0,
      layout = 'cards',
      sort = '',
      direction = 'asc',
      size = 50,
      widths = {},
      edit = null,
      bulk = null,
      drag = null;
    const options = () => ({ statuses: a.statuses, priorities: a.priorities, today: a.today() });
    const canEdit = () => a.canEdit();
    function guard() {
      if (
        !a.ready() ||
        !owner ||
        owner !== a.owner() ||
        projectId !== a.state().activeProjectId ||
        !a.active()
      )
        throw Error('Open Project items for your current account and project first.');
      if (!canEdit()) throw Error('Your permissions do not allow editing project items.');
    }
    function readLayout() {
      layout = 'cards';
      sort = '';
      direction = 'asc';
      size = 50;
      widths = {};
      try {
        const value = JSON.parse(
          root.localStorage.getItem('mm-tracker.project-items.layout.v1:' + owner) || '{}'
        );
        if (value.layout === 'table') layout = 'table';
        if (E.columns.some(([key]) => key === value.sort)) sort = value.sort;
        if (value.direction === 'desc') direction = 'desc';
        if ([25, 50, 100].includes(value.size)) size = value.size;
        for (const [key] of E.columns)
          if (Number.isFinite(value.widths?.[key]))
            widths[key] = Math.max(100, Math.min(900, value.widths[key]));
      } catch {}
    }
    function saveLayout() {
      try {
        root.localStorage.setItem(
          'mm-tracker.project-items.layout.v1:' + owner,
          JSON.stringify({ layout, sort, direction, size, widths })
        );
      } catch {}
    }
    function sync() {
      const nextOwner = a.ready() ? a.owner() : '',
        nextProject = a.state().activeProjectId;
      if (nextOwner !== owner || nextProject !== projectId || !a.active()) {
        const changedOwner = nextOwner !== owner;
        owner = nextOwner;
        projectId = nextProject;
        selected.clear();
        expanded.clear();
        childLimits.clear();
        page = 0;
        edit = null;
        drag = null;
        rows = [];
        pageRows = [];
        if (bulk && $('modalBody')?.querySelector('[data-pi-room]')) a.closeModal();
        bulk = null;
        if (changedOwner) readLayout();
      }
    }
    function prepare(matching) {
      sync();
      rows = E.order(matching, sort, direction, a.state().projectCompanies);
      const ids = new Set(rows.map(row => row.id));
      selected = new Set([...selected].filter(id => ids.has(id)));
      expanded = new Set([...expanded].filter(id => ids.has(id)));
      if (edit && !ids.has(edit.id)) edit = null;
      page = Math.max(0, Math.min(page, Math.ceil(rows.length / size) - 1));
      pageRows = rows.slice(page * size, (page + 1) * size);
      return pageRows;
    }
    function toolbar() {
      return `<div class="pi-toolbar"><div class="pi-view-switch" role="group" aria-label="Project item layout">${button('layout', '▦ Cards', `data-value="cards" aria-pressed="${layout === 'cards'}"`)}${button('layout', '☷ Table', `data-value="table" aria-pressed="${layout === 'table'}"`)}</div><label class="pi-sort">Sort by<select data-pi-sort aria-label="Sort project items"><option value="">Original order</option>${E.columns.map(([key, title]) => `<option value="${key}"${sort === key ? ' selected' : ''}>${title}</option>`).join('')}</select></label>${button('direction', direction === 'asc' ? '↑ Ascending' : '↓ Descending', !sort ? 'disabled' : '')}</div><div class="pi-selection-bar"><label><input type="checkbox" data-pi-select-page aria-label="Select all project items on this page"${pageRows.length ? '' : ' disabled'}> Select page</label><strong data-pi-selected aria-live="polite">${selected.size} selected</strong><div class="actions">${button('select-matching', `Select all ${rows.length} matching`, rows.length ? '' : 'disabled')}${button('clear', 'Clear selection', selected.size ? '' : 'disabled')}${button('bulk', 'Edit selected', !selected.size || !canEdit() ? 'disabled' : '', 'primary')}</div></div>`;
    }
    function footer() {
      return `<div class="pi-pagination"><span>${rows.length ? page * size + 1 : 0}–${Math.min(rows.length, (page + 1) * size)} of ${rows.length} items</span><div class="actions"><label>Per page <select data-pi-size aria-label="Project items per page">${choices([25, 50, 100].map(String), String(size))}</select></label>${button('page', 'Previous', `data-delta="-1"${page ? '' : ' disabled'}`)}<span>Page ${page + 1} of ${Math.max(1, Math.ceil(rows.length / size))}</span>${button('page', 'Next', `data-delta="1"${(page + 1) * size < rows.length ? '' : ' disabled'}`)}</div></div>`;
    }
    function selection(item) {
      return `<label class="pi-item-select"><input type="checkbox" data-pi-select="${esc(item.id)}" aria-label="Select ${esc(E.label(item))}"${selected.has(item.id) ? ' checked' : ''}><span>Select item</span></label>`;
    }
    function childList(item) {
      const subs = item.subItems || [],
        limit = childLimits.get(item.id) || 10,
        visible = subs.slice(0, limit);
      return `<div class="pi-child-list">${visible.map(sub => `<div class="subitem-card pi-inline-child" data-pi-child="${esc(sub.id)}"><div class="pi-child-heading"><strong class="hub-sensitive">${esc(sub.title)}</strong><label>Status<select data-pi-child-status="${esc(sub.id)}" data-parent="${esc(item.id)}" aria-label="Status for ${esc(sub.title)}"${canEdit() ? '' : ' disabled'}>${choices(a.subStatuses, sub.status)}</select></label></div><div class="pi-child-meta"><span>${sub.owner ? 'Owner: ' + esc(sub.owner) : 'No owner'}</span><span>${sub.dueDate ? 'Due ' + esc(sub.dueDate) : 'No due date'}</span>${sub.status !== 'Completed' && sub.dueDate && sub.dueDate < a.today() ? '<strong class="pi-overdue">Overdue</strong>' : ''}</div>${sub.remarks ? `<p class="prewrap hub-sensitive">${esc(sub.remarks)}</p>` : ''}${a.feedback(item, sub)}${a.trackedTime(item.id, sub.id)}<div class="actions pi-child-actions">${a.timerButton(item, sub)}<button type="button" class="small" data-action="edit-subitem" data-parent="${esc(item.id)}" data-id="${esc(sub.id)}"${canEdit() ? '' : ' disabled'}>Edit sub-item</button><button type="button" class="small project-status-date" data-project-status-date="${esc(item.id)}" data-sub="${esc(sub.id)}">Status history</button></div></div>`).join('')}${subs.length > limit ? button('more-children', `Show next ${Math.min(20, subs.length - limit)} sub-items · ${subs.length - limit} remaining`, `data-id="${esc(item.id)}"`, 'pi-more') : ''}<div class="pi-child-footer"><span>${Math.min(subs.length, limit)} of ${subs.length} sub-items</span><button type="button" class="small" data-action="new-subitem" data-parent="${esc(item.id)}"${canEdit() ? '' : ' disabled'}>＋ Add sub-item</button></div></div>`;
    }
    function children(item) {
      const count = item.subItems?.length || 0,
        isOpen = expanded.has(item.id),
        id = 'pi-children-' + encodeURIComponent(item.id);
      if (!count)
        return `<div class="pi-inline"><button type="button" class="pi-expand" data-action="new-subitem" data-parent="${esc(item.id)}"${canEdit() ? '' : ' disabled'}>＋ Add first sub-item</button></div>`;
      return `<div class="pi-inline${isOpen ? ' pi-inline-open' : ''}">${button('expand', `${isOpen ? '▾ Hide' : '▸ Show'} ${count} sub-item${count === 1 ? '' : 's'}`, `data-id="${esc(item.id)}" aria-expanded="${isOpen}" aria-controls="${esc(id)}"`, 'pi-expand')}<div id="${esc(id)}"${isOpen ? '' : ' hidden'}>${isOpen ? childList(item) : ''}</div></div>`;
    }
    function editor(item, field) {
      const value = edit.value,
        title = E.columns.find(([key]) => key === field)[1],
        control =
          field === 'status' || field === 'priority'
            ? `<select name="value" aria-label="${title}">${choices(field === 'status' ? a.statuses : ['', ...a.priorities], value)}</select>`
            : field === 'description'
              ? `<textarea name="value" aria-label="${title}" maxlength="32767" required>${esc(value)}</textarea>`
              : `<input name="value" aria-label="${title}" type="date" min="1900-01-01" max="9999-12-31" value="${esc(value)}">`;
      return `<form id="piInlineEdit" data-id="${esc(item.id)}" data-field="${field}" class="pi-cell-editor">${control}<div class="actions"><button type="submit" class="primary small">Save</button>${button('cancel-cell', 'Cancel', '', 'small')}</div>${field === 'status' ? '<small>Completed also finishes unfinished sub-items.</small>' : ''}${edit.error ? `<p role="alert">${esc(edit.error)}</p>` : ''}</form>`;
    }
    function cell(item, field) {
      if (edit?.id === item.id && edit.field === field) return editor(item, field);
      let value = item[field];
      if (field === 'itemId')
        return `<button type="button" class="pi-record-link" data-action="view-item-links" data-id="${esc(item.id)}">${empty(item.itemId || item.ricefw || E.label(item))}</button><small>${esc(item.itemType)}</small>`;
      if (field === 'company')
        return empty(
          a.state().projectCompanies.find(c => c.id === item.companyId)?.name || 'Unassigned'
        );
      if (field === 'progress') {
        const n = item.subItems?.length || 0,
          done = (item.subItems || []).filter(s => s.status === 'Completed').length;
        return `<strong>${done}/${n} complete</strong><div class="pi-mini-progress"><span style="width:${n ? (done / n) * 100 : 0}%"></span></div>${button('expand', expanded.has(item.id) ? 'Hide sub-items' : 'Show sub-items', `data-id="${esc(item.id)}" aria-expanded="${expanded.has(item.id)}"`, 'small')}`;
      }
      const editable = E.fields.includes(field),
        overdue = field === 'dueDate' && value && value < a.today() && item.status !== 'Completed';
      return `<div class="${field === 'status' ? 'pi-status-cell' : ''}">${editable ? button('edit-cell', `<span>${empty(value)}</span><span class="pi-pencil" aria-hidden="true">✎</span>`, `data-id="${esc(item.id)}" data-field="${field}" aria-label="Edit ${esc(E.columns.find(([key]) => key === field)[1].toLowerCase())} for ${esc(E.label(item))}"${canEdit() ? '' : ' disabled'}`, 'pi-cell-value' + (field === 'description' ? ' hub-sensitive' : '')) : empty(value)}</div>${overdue ? '<small class="pi-overdue">Overdue</small>' : ''}`;
    }
    function table() {
      return `<p class="pi-table-help">Select a value to edit it. Enter saves a date or selection; Ctrl/⌘ + Enter saves a description. Escape cancels. Drag a column edge or focus it and use arrow keys to resize.</p><div class="pi-table-scroll" tabindex="0" role="region" aria-label="Project items table"><table class="pi-table"><caption class="sr-only">Project items. Sort with the column headings; edit values with their buttons.</caption><colgroup><col style="width:48px">${E.columns.map(([key, , width]) => `<col data-pi-col="${key}" style="width:${widths[key] || width}px">`).join('')}<col style="width:220px"></colgroup><thead><tr><th scope="col"><span class="sr-only">Selection</span></th>${E.columns.map(([key, title, width]) => `<th scope="col" aria-sort="${sort === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}">${button('sort', `${title}${sort === key ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}`, `data-field="${key}"`)}<span class="pi-resizer" role="separator" tabindex="0" aria-label="Resize ${title} column" aria-orientation="vertical" aria-valuemin="100" aria-valuemax="900" aria-valuenow="${widths[key] || width}" data-pi-resize="${key}"></span></th>`).join('')}<th scope="col">Actions</th></tr></thead><tbody>${pageRows.map(item => `<tr data-pi-row="${esc(item.id)}" class="${selected.has(item.id) ? 'pi-row-selected' : ''}"><td>${selection(item)}</td>${E.columns.map(([field]) => `<td data-pi-cell="${field}">${cell(item, field)}</td>`).join('')}<td><div class="actions pi-table-actions"><button type="button" class="small" data-action="edit" data-group="specs" data-id="${esc(item.id)}">Edit item</button><button type="button" class="small" data-action="view-item-links" data-id="${esc(item.id)}">Details &amp; links</button><button type="button" class="small" data-hub="timer-new" data-kind="project" data-id="${esc(item.projectId)}" data-item="${esc(item.id)}">Track time</button><button type="button" class="small" data-project-status-date="${esc(item.id)}">Status history</button></div></td></tr>${expanded.has(item.id) ? `<tr class="pi-child-table-row"><td colspan="10"><div class="pi-table-children"><h4>${esc(E.label(item))} · Sub-items</h4>${childList(item)}</div></td></tr>` : ''}`).join('')}</tbody></table></div>`;
    }
    function paintSelection() {
      const count = selected.size,
        onPage = pageRows.filter(row => selected.has(row.id)).length;
      for (const checkbox of document.querySelectorAll('[data-pi-select]'))
        checkbox.checked = selected.has(checkbox.dataset.piSelect);
      const all = document.querySelector('[data-pi-select-page]');
      if (all) {
        all.checked = !!pageRows.length && onPage === pageRows.length;
        all.indeterminate = onPage > 0 && onPage < pageRows.length;
      }
      const counter = document.querySelector('[data-pi-selected]');
      if (counter) counter.textContent = count + ' selected';
      for (const b of document.querySelectorAll('[data-pi="bulk"]'))
        b.disabled = !count || !canEdit();
      for (const b of document.querySelectorAll('[data-pi="clear"]')) b.disabled = !count;
      for (const row of document.querySelectorAll('[data-pi-row]'))
        row.classList.toggle('pi-row-selected', selected.has(row.dataset.piRow));
    }
    function mount() {
      sync();
      paintSelection();
      document
        .querySelector('.project-items-workspace')
        ?.classList.toggle('pi-table-mode', layout === 'table');
      // Keep the existing context, timeline and snippet tools in the Actions column.
      // Their shared decorators otherwise use the first cell of a table row.
      for (const row of document.querySelectorAll('[data-pi-row]')) {
        const actions = row.querySelector('.pi-table-actions');
        if (!actions) continue;
        let tools = actions.querySelector('.pi-extra-tools');
        if (!tools) {
          tools = document.createElement('details');
          tools.className = 'pi-extra-tools';
          tools.innerHTML = '<summary>More tools</summary><div></div>';
          actions.append(tools);
        }
        const host = tools.querySelector('div');
        for (const node of row.querySelectorAll(
            'td:first-child > .batch-record-context, td:first-child > .wl-record-tools, .pi-table-actions > [data-project-status-date], .pi-table-actions > [data-hub="timer-new"]'
        ))
          host.append(node);
      }
      $('modal')?.classList.toggle('pi-dialog', !!$('modalBody')?.querySelector('[data-pi-room]'));
      for (const node of document.querySelectorAll('.pi-inline-child [data-pi-child-status]')) {
        const parent = a.state().specs.find(r => r.id === node.dataset.parent),
          sub = parent?.subItems?.find(r => r.id === node.dataset.piChildStatus);
        if (sub) node.dataset.before = JSON.stringify(sub);
      }
      for (const card of document.querySelectorAll('.project-items-workspace .item-card'))
        card.classList.toggle('pi-expanded', !!card.querySelector('.pi-inline-open'));
    }
    function rememberScroll() {
      const scroller = document.querySelector('.pi-table-scroll'),
        x = scroller?.scrollLeft || 0,
        y = scroller?.scrollTop || 0,
        top = root.scrollY || 0;
      return () => {
        const next = document.querySelector('.pi-table-scroll');
        if (next) {
          next.scrollLeft = x;
          next.scrollTop = y;
        }
        if ((root.scrollY || 0) !== top) root.scrollTo?.(0, top);
      };
    }
    function refresh() {
      const restore = rememberScroll();
      a.render();
      restore();
    }
    function assertBulk() {
      guard();
      if (
        !bulk ||
        bulk.owner !== owner ||
        bulk.projectId !== projectId ||
        bulk.generation !== a.generation()
      )
        throw Error('Reopen bulk editing for your current account and project.');
      E.assertSnapshot(a.state(), projectId, bulk.snapshots);
    }
    function bulkForm() {
      const patch = bulk.draft || {},
        date = bulk.statusDate || a.today();
      a.openModal(
        'Edit selected project items',
        `<form id="piBulkForm" data-pi-room><div class="pi-bulk-hero"><span class="eyebrow">BULK EDIT · ${bulk.ids.length} SELECTED</span><h3>Choose what to update.</h3><p>Only checked fields change. Review the main items and affected sub-items before applying.</p></div><div class="pi-bulk-fields">${[
          'status',
          'priority',
          'expectedDate',
          'dueDate',
        ]
          .map(field => {
            const title = E.columns.find(([key]) => key === field)[1],
              checked = Object.hasOwn(patch, field);
            return `<section><label class="pi-bulk-check"><input type="checkbox" name="change_${field}"${checked ? ' checked' : ''}> Change ${title.toLowerCase()}</label><label for="piBulk-${field}" class="sr-only">New ${title.toLowerCase()}</label>${field === 'status' || field === 'priority' ? `<select id="piBulk-${field}" name="${field}"${checked ? '' : ' disabled'}>${choices(field === 'status' ? a.statuses : ['', ...a.priorities], checked ? patch[field] : (field === 'status' ? a.statuses[0] : a.priorities[0]))}</select>` : `<input id="piBulk-${field}" type="date" min="1900-01-01" max="9999-12-31" name="${field}" value="${esc(patch[field] || '')}"${checked ? '' : ' disabled'}><small>Leave blank to clear this date on selected items.</small>`}</section>`;
          })
          .join(
            ''
          )}</div><div class="pi-bulk-status-date"><label for="piBulkStatusDate">Status change date</label><input id="piBulkStatusDate" name="statusDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(date)}"${Object.hasOwn(patch, 'status') ? '' : ' disabled'}><p class="hint">Used when changing status. Completing a main item also completes its unfinished sub-items.</p></div><div class="pi-error" data-pi-error role="alert"></div><div class="modal-actions">${button('cancel-bulk', 'Cancel')}<button type="submit" class="primary">Preview changes</button></div></form>`
      );
      mount();
    }
    function openBulk() {
      guard();
      const ids = rows.filter(row => selected.has(row.id)).map(row => row.id);
      bulk = {
        owner,
        projectId,
        generation: a.generation(),
        ids,
        snapshots: E.capture(a.state(), projectId, ids),
        draft: {},
        statusDate: a.today(),
        review: null,
        page: 0,
      };
      bulkForm();
    }
    function preview(form) {
      assertBulk();
      const patch = {};
      for (const field of ['status', 'priority', 'expectedDate', 'dueDate'])
        if (form.elements.namedItem('change_' + field).checked)
          patch[field] = form.elements.namedItem(field).value;
      bulk.draft = patch;
      bulk.statusDate = form.elements.namedItem('statusDate').value;
      const config = { ...options(), statusDate: patch.status ? bulk.statusDate : '' };
      bulk.review = E.plan(a.state(), projectId, bulk.ids, patch, config, bulk.snapshots);
      bulk.page = 0;
      showPreview();
    }
    function showPreview() {
      assertBulk();
      const p = bulk.review,
        start = bulk.page * 50,
        changes = p.changes.slice(start, start + 50);
      a.openModal(
        'Review project item changes',
        `<div class="pi-bulk-review" data-pi-room><div class="pi-bulk-hero"><span class="eyebrow">REVIEW BEFORE SAVING</span><h3>${p.changes.length ? 'Here is exactly what will change.' : 'These items already have the chosen values.'}</h3><p>Notes, feedback, owners, links and other fields stay with their respective records.</p></div><div class="pi-review-stats"><div><strong>${p.ids.length}</strong><span>selected items</span></div><div><strong>${p.changedItems}</strong><span>items changing</span></div><div><strong>${p.children}</strong><span>sub-items completed</span></div></div>${p.changes.length ? `<div class="pi-review-scroll" tabindex="0" role="region" aria-label="Bulk change comparison"><table><thead><tr><th>Item / sub-item</th><th>Field</th><th>Current</th><th>New value</th></tr></thead><tbody>${changes.map(change => `<tr><td><strong class="hub-sensitive">${esc(change.item)}</strong>${change.child ? `<small class="hub-sensitive">↳ ${esc(change.child)}</small>` : ''}</td><td>${esc(change.label)}</td><td class="hub-sensitive">${empty(change.before)}</td><td class="pi-new-value hub-sensitive">${empty(change.after)}</td></tr>`).join('')}</tbody></table></div><div class="pi-pagination"><span>${start + 1}–${Math.min(start + 50, p.changes.length)} of ${p.changes.length} field changes</span><div class="actions">${button('review-page', 'Previous', `data-delta="-1"${bulk.page ? '' : ' disabled'}`)}${button('review-page', 'Next', `data-delta="1"${start + 50 < p.changes.length ? '' : ' disabled'}`)}</div></div>` : ''}<div class="pi-error" data-pi-error role="alert"></div><div class="modal-actions"><div class="actions">${button('back-bulk', 'Back to fields')}${button('cancel-bulk', 'Cancel')}</div>${button('apply-bulk', 'Apply changes', p.changes.length ? '' : 'disabled', 'primary')}</div></div>`
      );
      mount();
    }
    function applyBulk() {
      assertBulk();
      const p = bulk.review;
      if (!p?.changes.length) throw Error('Preview changes before applying.');
      if (a.mutate(data => E.apply(data, p, options()))) {
        selected.clear();
        bulk = null;
        a.closeModal();
        refresh();
        a.tell('Project item changes saved.');
      }
    }
    function startEdit(id, field) {
      guard();
      if (!E.fields.includes(field) || !pageRows.some(row => row.id === id))
        throw Error('Choose a visible editable field.');
      if (edit && (edit.id !== id || edit.field !== field))
        throw Error('Save or cancel the current field first.');
      const item = a.state().specs.find(row => row.id === id);
      edit = {
        id,
        field,
        value: item[field] || '',
        snapshots: E.capture(a.state(), projectId, [id]),
        generation: a.generation(),
        error: '',
      };
      refresh();
      $('piInlineEdit')?.elements.namedItem('value')?.focus();
    }
    function saveCell(form) {
      guard();
      if (
        !edit ||
        form.dataset.id !== edit.id ||
        form.dataset.field !== edit.field ||
        edit.generation !== a.generation()
      )
        throw Error('Reopen this field before editing.');
      edit.value = form.elements.namedItem('value').value;
      const p = E.plan(
          a.state(),
          projectId,
          [edit.id],
          { [edit.field]: edit.value },
          options(),
          edit.snapshots
        ),
        prior = edit;
      edit = null;
      try {
        if (!p.changes.length) {
          refresh();
          return;
        }
        if (a.mutate(data => E.apply(data, p, options()))) a.tell('Project item updated.');
        else edit = prior;
      } catch (error) {
        edit = prior;
        throw error;
      }
      refresh();
    }
    function childStatus(node) {
      guard();
      const parentId = node.dataset.parent,
        id = node.dataset.piChildStatus,
        value = node.value,
        prior = node.dataset.before;
      if (!a.subStatuses.includes(value)) throw Error('Choose a valid sub-item status.');
      const restore = rememberScroll();
      a.mutate(data => {
        const parent = data.specs.find(row => row.id === parentId),
          sub = parent?.subItems.find(row => row.id === id);
        if (!parent || parent.projectId !== projectId || !sub || JSON.stringify(sub) !== prior)
          throw Error('This sub-item changed. Reopen it before editing.');
        if (sub.status !== value) {
          sub.status = value;
          sub.updatedAt = new Date().toISOString();
        }
      });
      restore();
      a.tell('Sub-item status updated.');
    }
    function errorMessage(error) {
      const target = document.querySelector('[data-pi-error]');
      if (target) target.textContent = error.message;
      else if (edit) {
        edit.error = error.message;
        refresh();
      }
      a.tell(error.message, true);
    }
    document.addEventListener('click', event => {
      const node = event.target.closest?.('[data-pi]');
      if (!node) return;
      try {
        const action = node.dataset.pi;
        if (
          !a.ready() ||
          owner !== a.owner() ||
          projectId !== a.state().activeProjectId ||
          !a.active()
        )
          throw Error('Reopen Project items for your current account.');
        if (action === 'layout') {
          layout = node.dataset.value === 'table' ? 'table' : 'cards';
          saveLayout();
          refresh();
        } else if (action === 'sort') {
          sort === node.dataset.field
            ? (direction = direction === 'asc' ? 'desc' : 'asc')
            : ((sort = node.dataset.field), (direction = 'asc'));
          page = 0;
          saveLayout();
          refresh();
        } else if (action === 'direction') {
          direction = direction === 'asc' ? 'desc' : 'asc';
          saveLayout();
          refresh();
        } else if (action === 'page') {
          page += Number(node.dataset.delta);
          refresh();
        } else if (action === 'select-matching') {
          selected = new Set(rows.map(row => row.id));
          paintSelection();
        } else if (action === 'clear') {
          selected.clear();
          paintSelection();
        } else if (action === 'expand') {
          expanded.has(node.dataset.id)
            ? expanded.delete(node.dataset.id)
            : expanded.add(node.dataset.id);
          refresh();
        } else if (action === 'more-children') {
          childLimits.set(node.dataset.id, (childLimits.get(node.dataset.id) || 10) + 20);
          refresh();
        } else if (action === 'bulk') openBulk();
        else if (action === 'cancel-bulk') {
          bulk = null;
          a.closeModal();
        } else if (action === 'back-bulk') {
          assertBulk();
          bulkForm();
        } else if (action === 'review-page') {
          bulk.page += Number(node.dataset.delta);
          showPreview();
        } else if (action === 'apply-bulk') applyBulk();
        else if (action === 'edit-cell') startEdit(node.dataset.id, node.dataset.field);
        else if (action === 'cancel-cell') {
          edit = null;
          refresh();
        }
      } catch (error) {
        errorMessage(error);
      }
    });
    document.addEventListener('change', event => {
      const node = event.target;
      try {
        if (node.matches('[data-pi-select]')) {
          node.checked
            ? selected.add(node.dataset.piSelect)
            : selected.delete(node.dataset.piSelect);
          paintSelection();
        } else if (node.matches('[data-pi-select-page]')) {
          for (const item of pageRows)
            node.checked ? selected.add(item.id) : selected.delete(item.id);
          paintSelection();
        } else if (node.matches('[data-pi-sort]')) {
          sort = node.value;
          page = 0;
          saveLayout();
          refresh();
        } else if (node.matches('[data-pi-size]')) {
          size = [25, 50, 100].includes(Number(node.value)) ? Number(node.value) : 50;
          page = 0;
          saveLayout();
          refresh();
        } else if (node.matches('[data-pi-child-status]')) childStatus(node);
        else if (node.closest('#piBulkForm') && node.name.startsWith('change_')) {
          const field = node.name.slice(7);
          node.form.elements.namedItem(field).disabled = !node.checked;
          if (field === 'status')
            node.form.elements.namedItem('statusDate').disabled = !node.checked;
        }
      } catch (error) {
        errorMessage(error);
        if (node.matches('[data-pi-child-status]')) refresh();
      }
    });
    document.addEventListener('input', event => {
      if (event.target.closest('#piInlineEdit') && edit) edit.value = event.target.value;
    });
    document.addEventListener('submit', event => {
      if (!['piBulkForm', 'piInlineEdit'].includes(event.target.id)) return;
      event.preventDefault();
      try {
        event.target.id === 'piBulkForm' ? preview(event.target) : saveCell(event.target);
      } catch (error) {
        errorMessage(error);
      }
    });
    document.addEventListener('keydown', event => {
      const node = event.target;
      if (node.closest?.('#piInlineEdit')) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          edit = null;
          refresh();
        } else if (
          event.key === 'Enter' &&
          node.matches('input,select,textarea') &&
          (node.tagName !== 'TEXTAREA' || event.ctrlKey || event.metaKey) &&
          !event.isComposing
        ) {
          event.preventDefault();
          try {
            saveCell(node.closest('form'));
          } catch (error) {
            errorMessage(error);
          }
        }
      }
      if (
        node.matches?.('[data-pi-resize]') &&
        ['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)
      ) {
        event.preventDefault();
        const key = node.dataset.piResize,
          initial = E.columns.find(([id]) => id === key)[2];
        widths[key] =
          event.key === 'Home'
            ? initial
            : Math.max(
                100,
                Math.min(900, (widths[key] || initial) + (event.key === 'ArrowRight' ? 16 : -16))
              );
        document
          .querySelector(`[data-pi-col="${key}"]`)
          ?.style.setProperty('width', widths[key] + 'px');
        node.setAttribute('aria-valuenow', widths[key]);
        saveLayout();
      }
    });
    document.addEventListener('pointerdown', event => {
      const node = event.target.closest?.('[data-pi-resize]');
      if (!node || event.button !== 0) return;
      event.preventDefault();
      const key = node.dataset.piResize;
      drag = {
        key,
        start: event.clientX,
        width: widths[key] || E.columns.find(([id]) => id === key)[2],
        owner,
      };
      node.setPointerCapture?.(event.pointerId);
    });
    document.addEventListener('pointermove', event => {
      if (!drag || drag.owner !== a.owner()) return;
      widths[drag.key] = Math.round(
        Math.max(100, Math.min(900, drag.width + event.clientX - drag.start))
      );
      document
        .querySelector(`[data-pi-col="${drag.key}"]`)
        ?.style.setProperty('width', widths[drag.key] + 'px');
      document
        .querySelector(`[data-pi-resize="${drag.key}"]`)
        ?.setAttribute('aria-valuenow', widths[drag.key]);
    });
    for (const name of ['pointerup', 'pointercancel'])
      document.addEventListener(name, () => {
        if (drag) {
          drag = null;
          saveLayout();
        }
      });
    return {
      sync,
      prepare,
      toolbar,
      footer,
      selection,
      children,
      table,
      mount,
      isTable: () => layout === 'table',
      openBulk,
      preview,
      applyBulk,
      startEdit,
      saveCell,
    };
  }
  root.WorkHubProjectItems = { install };
})(window);
