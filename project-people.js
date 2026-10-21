/**
 * project-people.js — People & Responsibilities workspace and accessible drag/drop.
 * Dragging moves cards locally; pointer-up saves once through the shared mutation path.
 * On touch or keyboard, select an activity and then a person. Forms and exports are
 * bound to the account/project that opened them, with stale-edit checks before saving.
 */
(function (root) {
  'use strict';
  const E = root.WorkHubProjectPeopleEngine, F = root.WorkHubProjectPeopleFiles;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => root.crypto?.randomUUID?.() || 'person-' + Date.now().toString(36) + Math.random().toString(36).slice(2), clone = x => JSON.parse(JSON.stringify(x));
  const button = (action, label, attrs = '', cls = '') => `<button type="button" class="pe-button ${cls}" data-pe="${action}" ${attrs}>${label}</button>`;
  const option = (id, label, selected) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(label)}</option>`;
  const input = (name, label, value = '', extra = '') => `<label class="pe-field">${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
  const select = (name, label, rows, selected = '', blank = '') => `<label class="pe-field">${label}<select name="${name}">${blank ? option('', blank, selected) : ''}${rows.map(([id, label]) => option(id, label, selected)).join('')}</select></label>`;
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '', pid = '', mode = root.innerWidth < 700 ? 'list' : 'chart', query = '', department = '', areaFilter = '', activityFilter = '',
      selected = '', armed = null, onlyUnassigned = false, showHidden = false, zoom = 1, scroll = { left: 0, top: 0 }, trayScroll = 0, drag = null, chipDrag = null, suppressChipClick = 0, dialog = null, exporting = false, trayCollapsed = root.innerWidth < 700;
    const state = () => a.state(), records = () => E.records(state(), pid), person = id => records().people.find(p => p.id === id);
    function guard(expected = owner, projectId = pid) {
      if (!a.ready() || !a.owner() || a.owner() !== expected || state().activeProjectId !== projectId || !state().projects.some(p => p.id === projectId))
        throw Error('Reopen People & Responsibilities after signing in or switching projects.');
      if (document.body.classList.contains('hub-private')) throw Error('Turn off screen privacy before editing or exporting contacts.');
    }
    function sync() {
      if (owner !== a.owner() || pid !== state().activeProjectId) {
        clearChipDrag();
        if (dialog && $('modal')?.querySelector('[data-pe-dialog]')) a.closeModal();
        owner = a.owner(); pid = state().activeProjectId;
        query = department = areaFilter = activityFilter = selected = ''; armed = drag = dialog = null;
        zoom = 1; scroll = { left: 0, top: 0 }; trayScroll = 0; onlyUnassigned = showHidden = false;
      }
      if (selected && !person(selected)) selected = '';
      const r = records(), areas = E.project(state(), pid).mmAreas;
      if (areaFilter && !areas.some(a => a.id === areaFilter)) areaFilter = '';
      if (activityFilter && !r.activities.some(a => a.id === activityFilter)) activityFilter = '';
      if (armed && !(armed.type === 'area' ? areas.some(a => a.id === armed.id) : r.activities.some(a => a.id === armed.id))) armed = null;
    }
    function rememberScroll() {
      const v = $('peViewport'), tray = document.querySelector('.pe-area-list');
      if (v) scroll = { left: v.scrollLeft, top: v.scrollTop };
      if (tray) trayScroll = tray.scrollTop;
    }
    function refresh() {
      rememberScroll();
      const focus = document.activeElement, focusId = focus?.id, start = focus?.selectionStart, end = focus?.selectionEnd;
      const el = $('peWorkspace'); if (!el) { a.render(); return; }
      el.outerHTML = render(pid); mount();
      if (focusId && $(focusId)) { $(focusId).focus({ preventScroll: true }); if (typeof start === 'number') $(focusId).setSelectionRange?.(start, end); }
    }
    function save(fn, message) {
      guard(); rememberScroll();
      const ok = a.mutate(fn);
      if (ok && message) a.tell(message);
      return ok;
    }
    function visiblePeople() { return E.filter(state(), pid, query, department, areaFilter, activityFilter); }
    function card(projectId) {
      const m = E.metrics(state(), projectId);
      return `<button type="button" class="pe-overview-card" data-action="project-view" data-view="people"><span class="pe-overview-symbol" aria-hidden="true">♧</span><span><small>THE PEOPLE BEHIND THE PROCESS</small><strong>People &amp; responsibilities</strong><span>${m.people} people · ${m.assignments} assignments · ${m.unassigned} unassigned activities</span></span><span class="pe-overview-arrow" aria-hidden="true">↗</span></button>`;
    }
    function chip(type, id, label, extra = '') {
      const on = armed?.type === type && armed.id === id;
      return `<div class="pe-chip-row${on ? ' is-armed' : ''}">${button('arm', `<span class="pe-grip" aria-hidden="true">⠿</span><span>${esc(label)}</span>`, `draggable="true" data-chip-type="${type}" data-id="${esc(id)}" aria-pressed="${!!on}" title="Drag onto a person, or select and then choose a person"`, type === 'area' ? 'pe-area-chip' : 'pe-activity-chip')}${extra}</div>`;
    }
    function tray() {
      const r = records(), assigned = new Set(r.assignments.map(r => r.activityId));
      return `<aside class="pe-tray${trayCollapsed ? ' is-collapsed' : ''}" aria-label="MM areas and activities"><div class="pe-tray-heading"><span class="pe-eyebrow">DRAG · DROP · CONNECT</span><h3>Your responsibilities</h3><p>Drag an activity onto a person. On mobile, tap it and then choose a person.</p>${button('toggle-tray', trayCollapsed ? 'Show activities ↓' : 'Hide activities ↑', `aria-expanded="${!trayCollapsed}"`, 'pe-tray-toggle')}</div><div class="pe-tray-options"><label><input id="peUnassigned" type="checkbox"${onlyUnassigned ? ' checked' : ''}> Unassigned activities only</label><label><input id="peShowHidden" type="checkbox"${showHidden ? ' checked' : ''}> Include hidden MM areas</label></div><div class="pe-area-list">${E.project(state(), pid).mmAreas.filter(a => a.visible || showHidden).map(area => {
        const activities = r.activities.filter(t => t.areaId === area.id && t.kind === 'activity' && (!onlyUnassigned || !assigned.has(t.id)));
        return `<section class="pe-area-group">${chip('area', area.id, area.name + (area.visible ? '' : ' · hidden'), button('lookup-area', '↗', `data-id="${esc(area.id)}" aria-label="Find people responsible for ${esc(area.name)}"`, 'pe-icon'))}<div class="pe-area-activities">${activities.map(t => chip('activity', t.id, t.name, `<span class="pe-activity-state${assigned.has(t.id) ? ' is-assigned' : ''}" title="${assigned.has(t.id) ? 'Assigned' : 'Unassigned'}">${assigned.has(t.id) ? '✓' : '○'}</span>${button('lookup-activity', '↗', `data-id="${esc(t.id)}" aria-label="Find people for ${esc(t.name)}"`, 'pe-icon')}${button('edit-activity', '⋯', `data-id="${esc(t.id)}" aria-label="Edit ${esc(t.name)}"`, 'pe-icon')}`)).join('') || `<p class="pe-tray-empty">${onlyUnassigned ? 'No unassigned activities here.' : 'Add an activity, or drag the entire area.'}</p>`}</div></section>`;
      }).join('')}</div><div class="pe-tray-footer">${button('activity', '+ Add activity')}${button('areas', 'Manage MM areas ↗')}${button('starter', 'Add PR / PO / GR examples', '', 'pe-quiet')}</div></aside>`;
    }
    function personCard(p, index) {
      const r = records(), links = r.assignments.filter(r => r.personId === p.id), manager = r.people.find(m => m.id === p.managerId), acts = new Map(r.activities.map(a => [a.id, a]));
      return `<article class="pe-person${selected === p.id ? ' is-selected' : ''}${armed ? ' is-target' : ''}" data-pe-person="${esc(p.id)}" style="--pe-x:${p.x}px;--pe-y:${p.y}px;--pe-tone:${F.tone(p.department)};--pe-order:${Math.min(index, 12)}" aria-label="${esc(p.name)}"><div class="pe-person-top"><span class="pe-avatar" aria-hidden="true">${esc(F.initials(p.name))}</span><div><span class="pe-department">${esc(p.department) || 'Department not set'}</span>${button('person', esc(p.name), `data-id="${esc(p.id)}"`, 'pe-person-name')}</div><button type="button" class="pe-move" data-pe-move="${esc(p.id)}" aria-label="Move ${esc(p.name)}. Use arrow keys when focused." title="Drag to move · arrow keys also work">⠿</button></div><p class="pe-job">${esc(p.title) || 'Job title not set'}</p><div class="pe-email"><span title="${esc(p.email)}">${esc(p.email) || 'Email not set'}</span>${p.email ? button('email', '⧉', `data-id="${esc(p.id)}" aria-label="Copy email for ${esc(p.name)}"`, 'pe-icon') : ''}</div><div class="pe-person-assignments">${links.slice(0, 2).map(link => `<span class="pe-mapped-chip"><strong>${esc(E.activityLabel(state(), acts.get(link.activityId)))}</strong><small>${esc(link.role)}${link.scope ? ' · ' + esc(link.scope) : ''}</small></span>`).join('') || '<span class="pe-drop-hint">＋ Drop a responsibility here</span>'}</div><div class="pe-person-bottom"><span title="${esc(manager?.name || '')}">${links.length > 2 ? '+' + (links.length - 2) + ' more · ' : ''}${manager ? '↳ ' + esc(manager.name) : 'No reporting manager'}</span>${button(armed ? 'place' : 'assign', armed ? 'Assign here' : '+ Assign', `data-id="${esc(p.id)}"`, 'pe-assign-button')}</div></article>`;
    }
    function connectors(people, override = null) {
      const all = new Map(people.map(p => [p.id, override?.id === p.id ? { ...p, ...override } : p]));
      return [...all.values()].map(p => {
        const m = all.get(p.managerId); if (!m) return '';
        const x = m.x + E.CARD.width / 2, y = m.y + E.CARD.height, x2 = p.x + E.CARD.width / 2, y2 = p.y;
        return `<path d="M${x},${y} C${x},${y + 38} ${x2},${y2 - 38} ${x2},${y2}"/><circle cx="${x2}" cy="${y2}" r="4"/>`;
      }).join('');
    }
    function render(projectId) {
      sync(); pid = projectId;
      const r = records(), m = E.metrics(state(), pid), people = visiblePeople(), b = E.bounds(r.people);
      const width = Math.max(960, b.x + b.width), height = Math.max(620, b.y + b.height);
      const filterLabel = areaFilter ? E.area(state(), pid, areaFilter).name : activityFilter ? E.activityLabel(state(), r.activities.find(t => t.id === activityFilter)) : '';
      return `<section id="peWorkspace" class="pe-workspace" data-owner="${esc(owner)}" data-project="${esc(pid)}"><header class="pe-hero"><div><span class="pe-eyebrow">PROJECT PEOPLE · A LITTLE MORE CONNECTED</span><h2>People &amp; responsibilities<span class="pe-title-dot" aria-hidden="true"></span></h2><p>The right person. The right process. All in one place.</p></div><div class="pe-hero-art" aria-hidden="true"><span>MM</span><i></i><b>PR</b><b>PO</b><b>GR</b></div><div class="pe-hero-actions">${button('person-new', '+ Add person', '', 'pe-primary')}${button('activity', '+ Add activity')}${button('reuse', 'Reuse a project setup')}</div></header><div class="pe-metrics"><div><span class="pe-metric-icon">♧</span><strong>${m.people}</strong><span>people</span></div><div><span class="pe-metric-icon">▦</span><strong>${m.departments}</strong><span>departments</span></div><div><span class="pe-metric-icon">↗</span><strong>${m.assignments}</strong><span>assignments</span></div><div class="${m.unassigned ? 'pe-needs-owner' : ''}"><span class="pe-metric-icon">○</span><strong>${m.unassigned}</strong><span>unassigned activities</span></div></div><div class="pe-toolbar"><div class="pe-view-switch" role="group" aria-label="People layout">${button('chart', '♧ Organisation chart', `aria-pressed="${mode === 'chart'}"`, mode === 'chart' ? 'is-active' : '')}${button('list', '☷ People list', `aria-pressed="${mode === 'list'}"`, mode === 'list' ? 'is-active' : '')}</div><label class="pe-search"><span aria-hidden="true">⌕</span><input id="peSearch" type="search" value="${esc(query)}" maxlength="200" placeholder="Find a person, process or scope" aria-label="Search people and responsibilities"></label><label class="sr-only" for="peDepartment">Filter department</label><select id="peDepartment"><option value="">All departments</option>${[...new Set(r.people.map(p => p.department).filter(Boolean))].sort().map(d => option(d, d, department)).join('')}</select><div class="pe-export-actions">${button('export-png', '↓ Picture')}${button('export-excel', '↓ Excel')}</div></div>${filterLabel ? `<div class="pe-filter-notice"><span>Showing people responsible for <strong>${esc(filterLabel)}</strong></span>${button('clear-filter', 'Clear filter ×')}</div>` : ''}${armed ? `<div class="pe-armed-bar" role="status"><span class="pe-armed-dot"></span><span><strong>${esc(armed.type === 'area' ? E.area(state(), pid, armed.id).name : E.activityLabel(state(), r.activities.find(t => t.id === armed.id)))}</strong> selected. Choose a person to assign it.</span>${button('disarm', 'Cancel ×')}</div>` : ''}<div class="pe-body">${tray()}<div class="pe-board"><div class="pe-board-top"><span><i></i> ${people.length} of ${r.people.length} people${mode === 'chart' ? ' · Lines show reporting relationships' : ''}</span><div>${mode === 'chart' ? `${button('zoom-out', '−', 'aria-label="Zoom out"', 'pe-icon')}<span id="peZoom">${Math.round(zoom * 100)}%</span>${button('zoom-in', '+', 'aria-label="Zoom in"', 'pe-icon')}${button('fit', 'Fit everyone')}${button('arrange', 'Auto arrange')}` : ''}</div></div>${r.people.length ? people.length ? mode === 'chart' ? `<div id="peViewport" class="pe-viewport" tabindex="0" aria-label="Organisation chart. Scroll to pan; use card handles to move people."><div id="peSizer" style="width:${width * zoom}px;height:${height * zoom}px"><div id="peWorld" class="pe-world" style="width:${width}px;height:${height}px;transform:scale(${zoom})"><svg id="peLinks" class="pe-links" width="${width}" height="${height}" aria-hidden="true">${connectors(people)}</svg>${people.map(personCard).join('')}</div></div></div>` : `<div class="pe-people-list">${people.map(personCard).join('')}</div>` : `<div class="pe-empty"><span aria-hidden="true">⌕</span><h3>No people match this view</h3><p>Clear your filters, or assign this responsibility to someone.</p>${button('clear-filter', 'Show all people')}</div>` : `<div class="pe-empty pe-onboarding"><div class="pe-empty-orbit" aria-hidden="true"><span>♧</span><i>PR</i><i>PO</i><i>GR</i></div><span class="pe-eyebrow">MAKE THE CONNECTION</span><h3>Every process starts with a person.</h3><p>Add your business users, set their reporting managers, then drop MM activities onto their cards.</p>${button('person-new', '+ Add your first person', '', 'pe-primary')}<ol><li><b>01</b> Add people</li><li><b>02</b> Drop responsibilities</li><li><b>03</b> Share the picture</li></ol></div>`}<footer class="pe-board-footer"><span>✧ ${mode === 'chart' ? 'Drag the dotted handle to arrange cards. Set reporting managers in person details.' : 'Select a responsibility, then tap Assign here. Details contain every assignment.'}</span><span>Saved with your project</span></footer></div></div><p class="pe-footnote">Business responsibility reference · No SAP access is granted. Company, plant and purchasing organisation can be recorded in each assignment’s scope.</p></section>`;
    }
    function mount() {
      sync(); const v = $('peViewport'); if (v) { v.scrollLeft = scroll.left; v.scrollTop = scroll.top; }
      const tray = document.querySelector('.pe-area-list'); if (tray) tray.scrollTop = trayScroll;
    }
    function openForm(kind, title, fields, row = null, footer = '') {
      guard(); dialog = { kind, id: row?.id || '', snapshot: row ? JSON.stringify(row) : '', owner, pid, token: uid() };
      a.openModal(title, `<form id="peForm" data-pe-dialog="${kind}" data-pe-token="${dialog.token}" data-owner="${esc(owner)}" data-project="${esc(pid)}"><div class="pe-form-intro"><span class="pe-eyebrow">PEOPLE &amp; RESPONSIBILITIES</span><p>${kind === 'person' ? 'A contact, a place in the team, and the work they own.' : kind === 'assignment' ? 'Connect a person to a process. Add the role and scope that make it clear.' : 'Your project’s maintained MM areas keep everything connected.'}</p></div><div class="pe-form-grid">${fields}</div><div class="modal-actions">${footer}<span></span>${button('cancel', 'Cancel')}<button type="submit" class="primary">${kind === 'reuse' ? 'Copy setup' : 'Save'}</button></div></form>`);
    }
    function personEditor(id = '') {
      const p = id ? person(id) : null;
      if (id && !p) throw Error('This person was removed.');
      openForm('person', p ? 'Edit person' : 'Add a business user',
        input('name', 'Full name *', p?.name, 'required maxlength="120" autocomplete="name"') + input('email', 'Email address', p?.email, 'type="email" maxlength="254" autocomplete="email"') +
        input('department', 'Department', p?.department, 'maxlength="120" list="peDepartmentSuggestions"') + `<datalist id="peDepartmentSuggestions">${[...new Set([...(state().lists.departments || []), ...records().people.map(p => p.department)])].filter(Boolean).map(d => option(d, d, '')).join('')}</datalist>` +
        input('title', 'Job title', p?.title, 'maxlength="160"') + input('phone', 'Phone / extension', p?.phone, 'type="tel" maxlength="60"') +
        select('managerId', 'Reports to', records().people.filter(m => m.id !== p?.id).map(m => [m.id, m.name + (m.department ? ' · ' + m.department : '')]), p?.managerId || '', 'No reporting manager'), p,
        p ? button('remove-person', 'Remove person', `data-id="${esc(p.id)}"`, 'pe-danger') : '');
      $('peForm').elements.namedItem('name').focus();
    }
    function activityEditor(id = '') {
      const r = id ? records().activities.find(t => t.id === id && t.kind === 'activity') : null;
      if (id && !r) throw Error('This activity was removed.');
      const mappings = (state().projectProcessMappings || []).filter(m => m.projectId === pid);
      openForm('activity', r ? 'Edit responsibility activity' : 'Add responsibility activity',
        select('areaId', 'SAP MM area *', E.project(state(), pid).mmAreas.map(a => [a.id, a.name + (a.visible ? '' : ' · hidden')]), r?.areaId || E.project(state(), pid).mmAreas.find(a => a.visible)?.id) +
        input('name', 'Activity name *', r?.name, 'required maxlength="160" placeholder="e.g. Create PO or Perform goods receipt"') +
        select('sourceMappingId', 'Optional: copy a maintained process', mappings.map(m => [m.id, m.item + ' · ' + m.area]), r?.sourceMappingId || '', 'Write an activity above') +
        '<p class="pe-form-note">Choosing a maintained process copies its current name and MM area. Later process edits do not replace your activity wording.</p>', r,
        r ? button('remove-activity', 'Delete activity', `data-id="${esc(r.id)}"`, 'pe-danger') : '');
    }
    function assignmentEditor(personId, assignmentId = '') {
      const p = person(personId), r = assignmentId ? records().assignments.find(r => r.id === assignmentId && r.personId === personId) : null;
      if (!p || (assignmentId && !r)) throw Error('The person or assignment was removed.');
      if (!records().activities.length && !E.project(state(), pid).mmAreas.length) throw Error('Add an activity first.');
      const rows = [...E.project(state(), pid).mmAreas.map(a => ['area:' + a.id, a.name + ' · Entire area']), ...records().activities.filter(a => a.kind === 'activity').map(t => ['activity:' + t.id, E.area(state(), pid, t.areaId).name + ' → ' + t.name])];
      const existing = r && records().activities.find(t => t.id === r.activityId);
      const value = existing ? (existing.kind === 'area' ? 'area:' + existing.areaId : 'activity:' + existing.id) : armed ? armed.type + ':' + armed.id : rows[0]?.[0];
      openForm('assignment', 'Assign responsibility · ' + p.name,
        `<input name="personId" type="hidden" value="${esc(personId)}">` + select('chip', 'Activity / MM area', rows, value) + select('role', 'Responsibility role', E.ROLES.map(r => [r, r]), r?.role || 'Primary') +
        input('scope', 'Scope · optional', r?.scope, 'maxlength="200" placeholder="e.g. Company 1000 · Plant 1100 · Purchasing org MY01"') + input('notes', 'Assignment note · optional', r?.notes, 'maxlength="1000"'), r);
    }
    function details(id) {
      guard(); const p = person(id); if (!p) throw Error('This person was removed.');
      selected = id; if ($('peWorkspace')) refresh();
      dialog = { kind: 'details', id, owner, pid };
      const r = records(), acts = new Map(r.activities.map(a => [a.id, a])), links = r.assignments.filter(r => r.personId === id);
      a.openModal('Person & responsibilities', `<div class="pe-person-detail" data-pe-dialog="details"><header style="--pe-tone:${F.tone(p.department)}"><span class="pe-avatar">${esc(F.initials(p.name))}</span><div><span class="pe-eyebrow">${esc(p.department) || 'BUSINESS CONTACT'}</span><h2>${esc(p.name)}</h2><p>${esc(p.title)}</p></div></header><dl><div><dt>Email</dt><dd>${esc(p.email) || 'Not set'} ${p.email ? button('email', 'Copy', `data-id="${esc(id)}"`) : ''}</dd></div><div><dt>Phone</dt><dd>${esc(p.phone) || 'Not set'}</dd></div><div><dt>Reports to</dt><dd>${esc(person(p.managerId)?.name) || 'No reporting manager'}</dd></div></dl><div class="pe-detail-heading"><h3>Responsibilities <span>${links.length}</span></h3>${button('assign', '+ Assign', `data-id="${esc(id)}"`)}</div><div class="pe-detail-assignments">${links.map(link => `<article><span class="pe-eyebrow">${esc(E.area(state(), pid, acts.get(link.activityId).areaId).name)}</span><h4>${esc(E.activityLabel(state(), acts.get(link.activityId)))}</h4><div class="pe-role-scope"><span>${esc(link.role)}</span>${esc(link.scope) || 'All scope / not specified'}</div>${link.notes ? `<p>${esc(link.notes)}</p>` : ''}<div class="actions">${button('edit-assignment', 'Edit', `data-id="${esc(link.id)}" data-person="${esc(id)}"`)}${button('unassign', 'Unassign', `data-id="${esc(link.id)}" data-person="${esc(id)}"`, 'pe-danger')}</div></article>`).join('') || '<p class="pe-form-note">No responsibilities yet. Assign an MM area or a specific activity.</p>'}</div><div class="modal-actions">${button('edit-person', 'Edit person', `data-id="${esc(id)}"`)}${button('cancel', 'Close')}</div></div>`);
    }
    function stale(kind, id, snapshot) {
      const key = { person: 'people', activity: 'activities', assignment: 'assignments' }[kind];
      const current = id ? records()[key].find(r => r.id === id) : null;
      if (id && (!current || JSON.stringify(current) !== snapshot)) throw Error('This record changed. Reopen it before saving your edit.');
      return current;
    }
    function submit(form) {
      const draft = dialog;
      if (!draft || form.dataset.peToken !== draft.token || form.dataset.peDialog !== draft.kind || form.dataset.owner !== draft.owner || form.dataset.project !== draft.pid) throw Error('Reopen this form before saving.');
      guard(draft.owner, draft.pid);
      const value = name => form.elements.namedItem(name)?.value.trim() || '', old = ['person', 'activity', 'assignment'].includes(draft.kind) ? stale(draft.kind, draft.id, draft.snapshot) : null;
      let ok = false;
      if (draft.kind === 'person') {
        const position = old || E.nextPosition(records().people);
        const p = { id: old?.id || uid(), projectId: pid, name: value('name'), email: value('email'), department: value('department'), title: value('title'), phone: value('phone'), managerId: value('managerId'), x: position.x, y: position.y };
        ok = save(d => E.upsertPerson(d, p), 'Person saved.'); selected = p.id;
      } else if (draft.kind === 'activity') {
        ok = save(d => E.upsertActivity(d, { id: old?.id || uid(), projectId: pid, kind: 'activity', areaId: value('areaId'), name: value('name'), sourceMappingId: value('sourceMappingId') }), 'Activity saved.');
      } else if (draft.kind === 'assignment') {
        const [type, ...parts] = value('chip').split(':');
        let result; ok = save(d => { result = E.assign(d, pid, value('personId'), { type, id: parts.join(':') }, { id: old?.id, role: value('role'), scope: value('scope'), notes: value('notes') }, uid); });
        if (ok) a.tell(result.duplicate ? 'That responsibility is already assigned with this role and scope.' : 'Responsibility assigned.');
        armed = null;
      } else if (draft.kind === 'reuse') {
        const source = value('source'), mapping = Object.fromEntries([...form.querySelectorAll('[data-pe-area-map]')].map(el => [el.dataset.peAreaMap, el.value]));
        ok = save(d => E.cloneSetup(d, source, pid, mapping, uid), 'Project setup copied. This project keeps its own independent contacts and assignments.');
      }
      if (ok) { dialog = null; a.closeModal(); refresh(); }
    }
    function place(personId, chip = armed) {
      guard(); if (!chip) return assignmentEditor(personId);
      let result;
      const ok = save(d => { result = E.assign(d, pid, personId, chip, {}, uid); });
      if (ok) { selected = personId; armed = null; refresh(); const card = [...document.querySelectorAll('[data-pe-person]')].find(el => el.dataset.pePerson === personId); card?.classList.add('just-assigned'); a.tell(result.duplicate ? 'Already assigned to this person. Open their details to change role or scope.' : 'Connected! Open person details to set the role, scope or backup contact.'); }
    }
    function arm(chip) {
      armed = armed?.id === chip.id && armed.type === chip.type ? null : chip;
      if (root.innerWidth < 700 && armed) trayCollapsed = true;
      refresh();
    }
    function clearChipDrag() {
      chipDrag?.ghost?.remove(); chipDrag = null;
      document.body.classList.remove('pe-is-assigning');
      document.querySelectorAll('.pe-person.is-over').forEach(el => el.classList.remove('is-over'));
    }
    function reuse(sourceId = '') {
      const sources = state().projects.filter(p => p.id !== pid && E.records(state(), p.id).people.length);
      if (!sources.length) throw Error('Add people in another project first to reuse its setup here.');
      const source = sources.find(p => p.id === sourceId) || sources[0], used = new Set(E.records(state(), source.id).activities.map(a => a.areaId));
      if (records().people.length || records().activities.length) throw Error('Reuse a setup in an empty People & Responsibilities workspace.');
      openForm('reuse', 'Reuse another project’s setup', select('source', 'Copy from project', sources.map(p => [p.id, p.name]), source.id) + '<p class="pe-form-note">Copies people, reporting lines, activities and assignments. Map the source MM areas below. Future edits remain independent.</p>' +
        source.mmAreas.filter(a => used.has(a.id)).map(sourceArea => `<label class="pe-field">${esc(sourceArea.name)} → target MM area<select data-pe-area-map="${esc(sourceArea.id)}">${E.project(state(), pid).mmAreas.map(t => option(t.id, t.name, E.project(state(), pid).mmAreas.find(a => a.name.toLowerCase() === sourceArea.name.toLowerCase())?.id)).join('')}</select></label>`).join(''));
    }
    function exportDialog() {
      openForm('export', 'Export organisation chart', select('selection', 'Picture contents', [['all', 'Full chart'], ['view', 'Current filtered view'], ...(selected ? [['selected', 'Selected person']] : [])], 'all') + '<label class="pe-field pe-check"><input type="checkbox" name="emails"> Include email addresses in the picture</label><p class="pe-form-note">Pictures preview up to two responsibilities per person. Excel includes every assignment, role, scope and contact. Very large pictures are scaled to fit browser image limits.</p>');
      $('peForm').querySelector('[type="submit"]').textContent = 'Download PNG';
    }
    async function exportFile(kind, form = null) {
      guard(); if (exporting) return;
      const exportOwner = owner, exportProject = pid, snapshot = clone(state()); exporting = true;
      const submitButton = form?.querySelector('[type="submit"]'); if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Preparing picture…'; }
      try {
        const name = E.project(snapshot, exportProject).name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 60) || 'Project';
        let blob, scaled = false;
        if (kind === 'excel') blob = await F.excel(snapshot, exportProject);
        else {
          const selection = form.elements.namedItem('selection').value;
          const ids = selection === 'selected' ? [selected] : selection === 'view' ? visiblePeople().map(p => p.id) : E.records(snapshot, exportProject).people.map(p => p.id);
          const result = await F.image(snapshot, exportProject, ids, { emails: form.elements.namedItem('emails').checked }); blob = result.blob; scaled = result.scaled;
        }
        guard(exportOwner, exportProject);
        a.download(blob, name + '-People-' + a.today() + (kind === 'excel' ? '.xlsx' : '.png'), kind === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'image/png');
        if (form?.isConnected) { dialog = null; a.closeModal(); }
        a.tell(kind === 'excel' ? 'Excel downloaded: People, Responsibility Assignments, Unassigned Activities and Area Coverage.' : 'Picture downloaded.' + (scaled ? ' Large chart scaled to fit; export a selection for larger text.' : ''));
      } finally { exporting = false; if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = 'Download PNG'; } }
    }
    function fit() {
      const v = $('peViewport'), world = $('peWorld'); if (!v || !world) return;
      const b = E.bounds(visiblePeople());
      zoom = Math.max(.1, Math.min(1.15, (v.clientWidth || 900) / (b.width + 24), (v.clientHeight || 600) / (b.height + 24)));
      scroll = { left: Math.max(0, (b.x - 12) * zoom), top: Math.max(0, (b.y - 12) * zoom) };
      const next = scroll; refresh(); scroll = next; mount();
    }
    function arrange() {
      guard(); if (!records().people.length) return;
      if (!root.confirm('Arrange everyone by reporting level? This replaces saved card positions; responsibilities stay the same.')) return;
      const positions = new Map(E.layout(records().people).map(p => [p.id, p]));
      save(d => { for (const p of E.records(d, pid).people) Object.assign(p, positions.get(p.id)); }, 'Chart arranged by reporting level.'); fit();
    }
    function starter() {
      guard(); const areas = E.project(state(), pid).mmAreas, procurement = areas.find(a => /procure|purchas/i.test(a.name)) || areas.find(a => a.visible) || areas[0], inventory = areas.find(a => /inventory|stock/i.test(a.name)) || procurement;
      const proposed = [[procurement, 'Create PR'], [procurement, 'Approve PR'], [procurement, 'Create PO'], [procurement, 'Approve PO'], [inventory, 'Perform goods receipt'], [inventory, 'Perform goods issue']];
      if (!root.confirm('Add six editable PR / PO / goods-movement example activities under ' + procurement.name + ' and ' + inventory.name + '? Existing activity names are kept.')) return;
      save(d => { for (const [area, name] of proposed) if (!E.records(d, pid).activities.some(a => a.areaId === area.id && a.kind === 'activity' && a.name.toLowerCase() === name.toLowerCase())) E.upsertActivity(d, { id: uid(), projectId: pid, areaId: area.id, kind: 'activity', name, sourceMappingId: '' }); }, 'Example activities added. You can rename or move them to another MM area.');
    }
    async function handle(el) {
      guard(); const action = el.dataset.pe, id = el.dataset.id;
      if (action === 'person-new') personEditor();
      else if (action === 'person') armed ? place(id) : details(id);
      else if (action === 'edit-person') personEditor(id);
      else if (action === 'activity' || action === 'edit-activity') activityEditor(id);
      else if (action === 'assign') assignmentEditor(id);
      else if (action === 'edit-assignment') assignmentEditor(el.dataset.person, id);
      else if (action === 'place') place(id);
      else if (action === 'arm') arm({ type: el.dataset.chipType, id });
      else if (action === 'toggle-tray') { trayCollapsed = !trayCollapsed; refresh(); }
      else if (action === 'disarm') { armed = null; refresh(); }
      else if (action === 'chart' || action === 'list') { mode = action; refresh(); }
      else if (action === 'lookup-area' || action === 'lookup-activity') { armed = null; areaFilter = action === 'lookup-area' ? id : ''; activityFilter = action === 'lookup-activity' ? id : ''; refresh(); if (mode === 'chart') fit(); }
      else if (action === 'clear-filter') { query = department = areaFilter = activityFilter = ''; refresh(); }
      else if (action === 'zoom-in' || action === 'zoom-out') { zoom = Math.max(.1, Math.min(2, zoom + (action === 'zoom-in' ? .1 : -.1))); refresh(); }
      else if (action === 'fit') fit();
      else if (action === 'arrange') arrange();
      else if (action === 'starter') starter();
      else if (action === 'areas') { dialog = null; a.manageMMAreas(); }
      else if (action === 'reuse') reuse();
      else if (action === 'export-png') exportDialog();
      else if (action === 'export-excel') await exportFile('excel');
      else if (action === 'cancel') { dialog = null; a.closeModal(); }
      else if (action === 'email') {
        const p = person(id); if (!p?.email) throw Error('No email address is maintained.');
        const copyOwner = owner, copyProject = pid;
        try { await navigator.clipboard.writeText(p.email); guard(copyOwner, copyProject); a.tell('Email address copied.'); }
        catch { guard(copyOwner, copyProject); a.openModal('Copy email address', `<div data-pe-dialog="copy"><label>Email address<input readonly value="${esc(p.email)}" aria-label="Email address to copy"></label><p>Select and copy this address.</p></div>`); }
      } else if (action === 'remove-person') {
        const p = person(id); if (!p) return;
        if (root.confirm('Remove ' + p.name + ' and their assignments? Their direct reports will have no manager. Activities remain available to reassign.')) {
          if (save(d => E.removePerson(d, pid, id), 'Person removed. Activities are available to reassign.')) { dialog = null; a.closeModal(); }
        }
      } else if (action === 'remove-activity') {
        const activity = records().activities.find(a => a.id === id); if (!activity) return;
        if (root.confirm('Delete ' + activity.name + ' and all its responsibility assignments?')) {
          if (save(d => E.removeActivity(d, pid, id), 'Activity and its assignments removed.')) { dialog = null; a.closeModal(); }
        }
      } else if (action === 'unassign') {
        if (root.confirm('Remove this responsibility from the person? The activity stays in your tray.')) {
          if (save(d => { const h = E.data(d); h.assignments = h.assignments.filter(r => r.id !== id || r.projectId !== pid); }, 'Responsibility unassigned.')) details(el.dataset.person);
        }
      }
    }
    function dropPayload(event) {
      const raw = event.dataTransfer?.getData('application/x-workhub-responsibility');
      if (!raw || raw.length > 1000) throw Error('Drag an MM activity from this project’s tray.');
      const chip = JSON.parse(raw);
      if (chip.owner !== owner || chip.projectId !== pid || !['area', 'activity'].includes(chip.type) || typeof chip.id !== 'string') throw Error('Choose a responsibility from the current account and project.');
      return chip;
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-pe]'); if (!el) return;
      if (el.dataset.pe === 'arm' && Date.now() < suppressChipClick) { event.preventDefault(); return; }
      event.preventDefault(); void handle(el).catch(err => a.tell(err.message, true));
    });
    document.addEventListener('input', event => {
      if (event.target.id !== 'peSearch') return;
      query = event.target.value; refresh();
    });
    document.addEventListener('scroll', event => {
      if (event.target.id === 'peViewport') scroll = { left: event.target.scrollLeft, top: event.target.scrollTop };
      else if (event.target.classList?.contains('pe-area-list')) trayScroll = event.target.scrollTop;
    }, true);
    document.addEventListener('change', event => {
      const el = event.target;
      try {
        if (el.id === 'peDepartment') { department = el.value; refresh(); }
        else if (el.id === 'peUnassigned') { onlyUnassigned = el.checked; refresh(); }
        else if (el.id === 'peShowHidden') { showHidden = el.checked; refresh(); }
        else if (el.closest('#peForm') && el.name === 'sourceMappingId') {
          const mapping = state().projectProcessMappings.find(m => m.id === el.value && m.projectId === pid);
          if (mapping) { const f = $('peForm'); f.elements.namedItem('name').value = mapping.item.slice(0, 160); f.elements.namedItem('areaId').value = E.project(state(), pid).mmAreas.find(a => a.name === mapping.area)?.id || ''; }
        } else if (el.closest('#peForm') && el.name === 'source' && dialog?.kind === 'reuse') reuse(el.value);
      } catch (err) { a.tell(err.message, true); }
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'peForm') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (dialog?.kind === 'export') void exportFile('png', event.target).catch(err => a.tell(err.message, true));
      else try { submit(event.target); } catch (err) { a.tell(err.message, true); }
    }, true);
    document.addEventListener('dragstart', event => {
      const chip = event.target.closest?.('[data-chip-type]'); if (!chip) return;
      if (chipDrag) { event.preventDefault(); return; }
      try { guard(); const payload = { owner, projectId: pid, type: chip.dataset.chipType, id: chip.dataset.id }; event.dataTransfer.setData('application/x-workhub-responsibility', JSON.stringify(payload)); event.dataTransfer.effectAllowed = 'copy'; $('peWorkspace')?.classList.add('is-dropping'); }
      catch (err) { event.preventDefault(); a.tell(err.message, true); }
    });
    document.addEventListener('dragover', event => {
      const card = event.target.closest?.('[data-pe-person]'); if (!card || !event.dataTransfer?.types?.includes('application/x-workhub-responsibility')) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; card.classList.add('is-over');
    });
    document.addEventListener('dragleave', event => event.target.closest?.('[data-pe-person]')?.classList.remove('is-over'));
    document.addEventListener('dragend', () => { $('peWorkspace')?.classList.remove('is-dropping'); document.querySelectorAll('.pe-person.is-over').forEach(el => el.classList.remove('is-over')); });
    document.addEventListener('drop', event => {
      const card = event.target.closest?.('[data-pe-person]'); if (!card) return;
      event.preventDefault();
      try { guard(); place(card.dataset.pePerson, dropPayload(event)); } catch (err) { a.tell(err.message, true); }
      $('peWorkspace')?.classList.remove('is-dropping'); card.classList.remove('is-over');
    });
    document.addEventListener('pointerdown', event => {
      const chip = event.target.closest?.('[data-chip-type]');
      if (chip && (event.button === undefined || event.button === 0)) {
        try {
          guard(); clearChipDrag();
          chipDrag = { owner, pid, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, type: chip.dataset.chipType, id: chip.dataset.id, label: chip.textContent.trim(), moved: false, ghost: null };
          chip.setPointerCapture?.(event.pointerId); event.preventDefault();
        } catch (err) { a.tell(err.message, true); }
        return;
      }
      const handle = event.target.closest?.('[data-pe-move]'); if (!handle || mode !== 'chart' || (event.button !== undefined && event.button !== 0)) return;
      try { guard(); const p = person(handle.dataset.peMove); if (!p) return;
        drag = { id: p.id, owner, pid, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, oldX: p.x, oldY: p.y, x: p.x, y: p.y, moved: false, element: handle.closest('[data-pe-person]') };
        handle.setPointerCapture?.(event.pointerId); handle.focus({ preventScroll: true }); event.preventDefault(); drag.element.classList.add('is-moving');
      } catch (err) { a.tell(err.message, true); }
    });
    document.addEventListener('pointermove', event => {
      if (chipDrag && event.pointerId === chipDrag.pointerId) {
        if (Math.abs(event.clientX - chipDrag.startX) + Math.abs(event.clientY - chipDrag.startY) > 8) chipDrag.moved = true;
        if (!chipDrag.moved) return;
        if (!chipDrag.ghost) {
          const ghost = document.createElement('div'); ghost.className = 'pe-drag-ghost'; ghost.textContent = '＋ ' + chipDrag.label; document.body.append(ghost); chipDrag.ghost = ghost; document.body.classList.add('pe-is-assigning');
        }
        chipDrag.ghost.style.left = event.clientX + 14 + 'px'; chipDrag.ghost.style.top = event.clientY + 14 + 'px';
        document.querySelectorAll('.pe-person.is-over').forEach(el => el.classList.remove('is-over'));
        document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-pe-person]')?.classList.add('is-over');
        event.preventDefault(); return;
      }
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x = Math.round(Math.max(24, Math.min(50000, drag.oldX + (event.clientX - drag.startX) / zoom)));
      drag.y = Math.round(Math.max(24, Math.min(50000, drag.oldY + (event.clientY - drag.startY) / zoom)));
      drag.moved ||= Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4;
      drag.element.style.setProperty('--pe-x', drag.x + 'px'); drag.element.style.setProperty('--pe-y', drag.y + 'px');
      if ($('peLinks')) $('peLinks').innerHTML = connectors(visiblePeople(), drag);
    });
    document.addEventListener('pointerup', event => {
      if (chipDrag && event.pointerId === chipDrag.pointerId) {
        const moved = chipDrag, target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-pe-person]');
        clearChipDrag(); suppressChipClick = Date.now() + 550;
        try { guard(moved.owner, moved.pid);
          if (!moved.moved) arm({ type: moved.type, id: moved.id });
          else if (target) place(target.dataset.pePerson, { type: moved.type, id: moved.id });
          else a.tell('Drop the responsibility onto a person, or select it and choose Assign here.');
        } catch (err) { a.tell(err.message, true); }
        event.preventDefault(); return;
      }
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved = drag; drag = null;
      try {
        guard(moved.owner, moved.pid);
        if (moved.moved) save(d => { const p = E.records(d, moved.pid).people.find(p => p.id === moved.id); if (!p || p.x !== moved.oldX || p.y !== moved.oldY) throw Error('The card position changed. Try moving it again.'); p.x = moved.x; p.y = moved.y; });
        else refresh();
      } catch (err) { refresh(); a.tell(err.message, true); }
    });
    document.addEventListener('pointercancel', () => { clearChipDrag(); if (drag) { drag = null; refresh(); } });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && chipDrag) clearChipDrag();
      if (event.key === 'Escape' && armed) { armed = null; refresh(); }
      const handle = event.target.closest?.('[data-pe-move]'); if (!handle || mode !== 'chart' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      try { guard(); const id = handle.dataset.peMove, step = event.shiftKey ? 80 : 24;
        save(d => { const p = E.records(d, pid).people.find(p => p.id === id); if (!p) throw Error('This person was removed.'); p.x = Math.max(24, Math.min(50000, p.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))); p.y = Math.max(24, Math.min(50000, p.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))); });
        [...document.querySelectorAll('[data-pe-move]')].find(el => el.dataset.peMove === id)?.focus({ preventScroll: true });
      } catch (err) { a.tell(err.message, true); }
    });
    $('modal')?.addEventListener('close', () => { dialog = null; });
    return { render, card, mount, sync, personEditor, activityEditor, assignmentEditor, details, submit, place, exportFile, arrange };
  }
  root.WorkHubProjectPeople = { install };
})(window);
